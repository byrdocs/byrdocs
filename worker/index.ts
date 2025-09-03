import { Hono, type Context } from 'hono';
import { getSignedCookie, setSignedCookie } from 'hono/cookie'

import { Counter } from './objects/counter';
export { Counter } from './objects/counter';

import { createChecker } from 'is-in-subnet';
import { buptSubnets } from '../bupt';

import { AwsClient } from 'aws4fetch'

import apiRoute from './api';
import { drizzle } from 'drizzle-orm/d1';
import { or, and, eq, lte, notInArray } from 'drizzle-orm';
import { file as fileTable } from './schema';
import { sign } from './utils';
export { OAuth } from './objects/oauth';

const ipChecker = createChecker(buptSubnets);

export async function setCookie(c: Context) {
    await setSignedCookie(c, "login", Date.now().toString(), c.env.JWT_SECRET, {
        maxAge: 2592000,
        secure: true,
        sameSite: "None",
        path: "/"
    })
}

const app = new Hono<{ Bindings: Cloudflare.Env }>()
    .route("/api", apiRoute)
    .get("/schema/:path{.*?}", c => fetch("https://files.byrdocs.org/" + c.req.param("path")))
    .get("/files/:path{.*?}", async c => {
        const path = c.req.param("path")
        const isFile = !path.endsWith(".jpg") && !path.endsWith(".webp")
        const filename = c.req.query("filename")
        if (isFile) {
            const token = c.req.header("X-Byrdocs-Token")
            const ip = c.req.header("CF-Connecting-IP")
            const cookie = await getSignedCookie(c, c.env.JWT_SECRET, "login")
            if (
                (!ip || !ipChecker(ip)) &&
                token !== c.env.TOKEN &&
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
        const cacheKey = new Request(new URL(new URL(c.req.url).pathname, "https://byrdocs.org"))
        let res = await caches.default.match(cacheKey)
        if (!res) {
            console.log({
                type: "cache",
                status: "miss",
                path
            })
            const req = await sign(c.env, path, c.req.raw.headers)
            res = await fetch(req)
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

export default {
    fetch: app.fetch,
    async scheduled(_event: ScheduledEvent, env: Cloudflare.Env, _ctx: ExecutionContext) {
        const s3 = new AwsClient({
            accessKeyId: env.S3_ADMIN_ACCESS_KEY_ID,
            secretAccessKey: env.S3_ADMIN_SECRET_ACCESS_KEY,
            service: "s3",
        })

        const db = drizzle(env.DB)
        const files = await db.select().from(fileTable).where(
            or(
                and(
                    notInArray(fileTable.status, ['Uploaded', 'Published']),
                    lte(fileTable.createdAt, new Date(Date.now() - 3600 * 1000))
                ),
                and(
                    eq(fileTable.status, 'Uploaded'),
                    lte(fileTable.createdAt, new Date(Date.now() - 14 * 24 * 3600 * 1000))
                )
            )
        );
        for (const fileRecord of files) {
            console.log('DELETE', fileRecord.fileName, "Reason:", fileRecord.status === "Uploaded" ? "Expired" : "Timeout")
            await s3.fetch(`${env.S3_HOST}/${env.S3_BUCKET}/${fileRecord.fileName}`, {
                method: "DELETE"
            })
            await db.update(fileTable).set({
                status: fileRecord.status === "Uploaded" ? "Expired" : "Timeout"
            }).where(eq(fileTable.id, fileRecord.id))
        }
    }
}
