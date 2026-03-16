import { Hono, type Context } from 'hono';
import { getSignedCookie, setSignedCookie } from 'hono/cookie'

import { Counter } from './objects/counter';
export { Counter } from './objects/counter';

import apiRoute from './api';
import { PrismaD1 } from '@prisma/adapter-d1';
import { PrismaClient } from './generated/prisma/client';
import { isBupt, isMD5, isSearchEngineBot, sign } from './utils';
import { SearchPage } from './detail';
import { Item, MetaData, WikiTestItem } from '../src/types';
export { OAuth } from './objects/oauth';

const CORS_ALLOW_HEADERS = 'Authorization, Content-Type, X-Byrdocs-Token';
const CORS_ALLOW_METHODS = 'GET,HEAD,POST,PUT,PATCH,DELETE,OPTIONS';
const CORS_MAX_AGE = '86400';

function initSearchItem<T extends Item | WikiTestItem>(item: T, wikiId: number): T {
    if (item.type !== 'test') return item;

    const time = item.data.time.start === item.data.time.end
        ? item.data.time.start
        : `${item.data.time.start}-${item.data.time.end}`;

    item.data.title = `${time}${item.data.time.semester === 'First'
        ? ' 第一学期'
        : item.data.time.semester === 'Second'
            ? ' 第二学期'
            : ''} ${item.data.course.name}${item.data.time.stage ? ' ' + item.data.time.stage : ''}${item.data.content.length === 1 && item.data.content[0] === '答案'
        ? '答案'
        : '试卷'}`;

    if (item.data.filetype === 'wiki') {
        item.id = `wiki-${wikiId}`;
    }

    return item;
}

function normalizeOrigin(value: string | undefined): string | null {
    if (!value) return null;
    try {
        return new URL(value).origin;
    } catch {
        return null;
    }
}

function getAllowedOrigins(env: Cloudflare.Env): Set<string> {
    const origins = [
        normalizeOrigin(env.PUBLISH_SITE_URL),
        normalizeOrigin(env.PUBLISH_DEV_SITE_URL),
    ].filter((origin): origin is string => Boolean(origin));
    return new Set(origins);
}

function buildCorsHeaders(env: Cloudflare.Env, originHeader: string | undefined): Headers | null {
    if (!originHeader) return null;
    const allowedOrigins = getAllowedOrigins(env);
    if (!allowedOrigins.has(originHeader)) return null;
    const headers = new Headers();
    headers.set('Access-Control-Allow-Origin', originHeader);
    headers.set('Access-Control-Allow-Credentials', 'true');
    headers.set('Access-Control-Allow-Methods', CORS_ALLOW_METHODS);
    headers.set('Access-Control-Allow-Headers', CORS_ALLOW_HEADERS);
    headers.set('Access-Control-Max-Age', CORS_MAX_AGE);
    headers.set('Vary', 'Origin');
    return headers;
}

export async function setCookie(c: Context) {
    await setSignedCookie(c, "login", Date.now().toString(), c.env.JWT_SECRET, {
        maxAge: 2592000,
        secure: true,
        sameSite: "None",
        path: "/"
    })
}

const app = new Hono<{ Bindings: Cloudflare.Env }>()
    .options('*', (c) => {
        const headers = buildCorsHeaders(c.env, c.req.header('Origin'));
        if (!headers) return new Response(null, { status: 204 });
        return new Response(null, { status: 204, headers });
    })
    .use('*', async (c, next) => {
        await next();
        const headers = buildCorsHeaders(c.env, c.req.header('Origin'));
        if (!headers) return;
        try {
            headers.forEach((value, key) => c.res.headers.set(key, value));
        } catch {
            const res = c.res;
            const mergedHeaders = new Headers(res.headers);
            headers.forEach((value, key) => mergedHeaders.set(key, value));
            const responseInit: ResponseInit & { cf?: Response['cf']; webSocket?: Response['webSocket'] } = {
                status: res.status,
                statusText: res.statusText,
                headers: mergedHeaders,
                cf: res.cf,
                webSocket: res.webSocket,
            };
            c.res = new Response(res.body, responseInit);
        }
    })
    .route("/api", apiRoute)
    .get("/data/:path{.*?}", c => fetch(`${c.env.R2_DATA_SITE_URL}/${c.req.param("path")}`))
    .get("/schema/:path{.*?}", c => fetch(`${c.env.R2_DATA_SITE_URL}/${c.req.param("path")}`))
    .get("/files/:path{.*?}", async c => {
        const path = c.req.param("path")
        const isFile = !path.endsWith(".jpg") && !path.endsWith(".webp")
        const filename = c.req.query("filename")
        if (isFile) {
            const token = c.req.header("X-Byrdocs-Token")
            const ip = c.req.header("CF-Connecting-IP")
            const cookie = await getSignedCookie(c, c.env.JWT_SECRET, "login")
            if (
                (!isBupt(c.req.raw.cf)) &&
                token !== c.env.BYRDOCS_SITE_TOKEN &&
                (!cookie || isNaN(parseInt(cookie)) || Date.now() - parseInt(cookie) > 2592000 * 1000)
            ) {
                const toq = new URL(c.req.url).searchParams
                if ((c.req.path === "" || c.req.path === '/') && toq.size === 0) return c.redirect("/login")
                const to = c.req.path + (toq.size > 0 ? "?" + toq.toString() : "")
                return c.redirect("/login?" + new URLSearchParams({ to }).toString())
            }
            const range = c.req.header("Range")
            if (c.req.method === "GET" && (!range || range.startsWith("bytes=0-"))) {
                if (filename) {
                    const id: DurableObjectId = c.env.COUNTER.idFromName("counter");
                    const stub: DurableObjectStub<Counter<Cloudflare.Env>> = c.env.COUNTER.get(id);
                    c.executionCtx.waitUntil(stub.add(path))
                }
                c.env.AE.writeDataPoint({
                    blobs: [
                        "download_file",
                        path,
                        filename || null,
                        c.req.query("f") || null,
                        ip || null,
                        cookie || null,
                        range || null
                    ],
                    indexes: [
                        Math.random().toString(36).substring(2, 15)
                    ]
                })
            }
        }
        const cacheKey = new Request(new URL(new URL(c.req.url).pathname, c.env.BYRDOCS_SITE_URL))
        let res = await caches.default.match(cacheKey)
        if (!res) {
            console.log({
                type: "cache",
                status: "miss",
                path
            })
            res = await sign(c.env, path, c.req.raw.headers)
        } else {
            console.log({
                type: "cache",
                status: "hit",
                path
            })
        }
        if (filename && res.status === 200) {
            const headers = new Headers(res.headers)
            headers.set("Content-Disposition", `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`)
            res = new Response(res.body, {
                status: res.status,
                statusText: res.statusText,
                webSocket: res.webSocket,
                cf: res.cf,
                headers
            })
        }
        c.executionCtx.waitUntil(new Promise<void>(async r => {
            const cacheValue = res.clone()
            cacheValue.headers.set("Cache-Control", "public, s-maxage=31536000, max-age=31536000, immutable")
            cacheValue.headers.delete("Set-Cookie")
            await caches.default.put(cacheKey, cacheValue)
            console.log({
                type: "cache",
                status: "set",
                path
            })
            r()
        }))
        return res
    })
    .get('/', async c => {
        const q = c.req.query("q")
        if (q && isSearchEngineBot(c) && isMD5(q)) {
            const metadata = await fetch(`${c.env.R2_DATA_SITE_URL}/metadata.json`)
            const metadata_json = await metadata.json() as MetaData
            const matched = metadata_json.find((item) => item.id === q)
            if (!matched) {
                return c.notFound()
            }

            let wikiId = 0
            let item: Item | WikiTestItem = initSearchItem(structuredClone(matched), ++wikiId)

            if (matched.type === 'test' && item.type === 'test' && item.data.filetype === 'pdf') {
                try {
                    const wikiResponse = await fetch(`${c.env.R2_DATA_SITE_URL}/wiki.json`)
                    if (wikiResponse.ok) {
                        const wikiJson = await wikiResponse.json() as WikiTestItem[]
                        const wikiMatched = wikiJson.find((wikiItem) => wikiItem.id === q)
                        if (wikiMatched) {
                            item.data.wiki = {
                                url: wikiMatched.url,
                                data: initSearchItem(structuredClone(wikiMatched), ++wikiId).data,
                            }
                        }
                    }
                } catch (error) {
                    console.warn('Failed to fetch wiki metadata for SEO page', error)
                }
            }

            return c.html(SearchPage({
                item,
                pageUrl: c.req.url,
                siteUrl: c.env.BYRDOCS_SITE_URL,
            }))
        }
        const target = new URL(c.req.url)
        target.pathname = "/"
        return c.env.ASSETS.fetch(target, c.req);
    })


export default {
    fetch: app.fetch,
    async scheduled(_event: ScheduledEvent, env: Cloudflare.Env, _ctx: ExecutionContext) {
        const prisma = new PrismaClient({ adapter: new PrismaD1(env.DB) })
        const files = await prisma.file.findMany({
            where: {
                OR: [
                    {
                        AND: [
                            { status: { notIn: ['Uploaded', 'Published'] } },
                            { createdAt: { lte: new Date(Date.now() - 3600 * 1000) } }
                        ],
                    },
                    {
                        AND: [
                            { status: 'Uploaded' },
                            { createdAt: { lte: new Date(Date.now() - 14 * 24 * 3600 * 1000) } }
                        ],
                    },
                ],
            },
        });
        for (const file of files) {
            console.log('DELETE', file.fileName, "Reason:", file.status === "Uploaded" ? "Expired" : "Timeout")
            // Delete from R2
            await env.R2.delete(file.fileName)
            // Update database status
            await prisma.file.update({
                where: {
                    id: file.id
                },
                data: {
                    status: file.status === "Uploaded" ? "Expired" : "Timeout"
                }
            })
        }
    }
}
