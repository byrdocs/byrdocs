import { renderHomePage } from "../src/entry-server";
import { buildSearchDocuments } from "../src/lib/search-items";
import { buildDefaultSeo, buildItemSeo, type PageSeo } from "../src/lib/seo";
import { createExactMatchSearchSnapshot } from "../src/lib/search-snapshot";
import type { SsrBootstrap } from "../src/ssr-context";
import type { CategoryType, Item, MetaData, WikiTestItem } from "../src/types";

type RenderMd5SsrPageParams = {
    category: CategoryType;
    env: Cloudflare.Env;
    executionCtx: ExecutionContext;
    md5: string;
    pageUrl: string;
    request: Request;
};

type HeadState = {
    hasCanonical: boolean;
    hasDescription: boolean;
    hasKeywords: boolean;
    hasOgDescription: boolean;
    hasOgImage: boolean;
    hasOgTitle: boolean;
    hasOgType: boolean;
    hasOgUrl: boolean;
    hasTitle: boolean;
    hasTwitterCard: boolean;
    hasTwitterDescription: boolean;
    hasTwitterTitle: boolean;
};

const SSR_CACHE_CONTROL = "public, max-age=0, s-maxage=3600";

function escapeHtml(value: string): string {
    return value
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll("\"", "&quot;");
}

function serializeForScript(value: unknown): string {
    return JSON.stringify(value)
        .replaceAll("<", "\\u003c")
        .replaceAll(">", "\\u003e")
        .replaceAll("&", "\\u0026")
        .replaceAll("\u2028", "\\u2028")
        .replaceAll("\u2029", "\\u2029");
}

export function normalizeCategoryType(value: string | null | undefined): CategoryType {
    if (value === "book" || value === "test" || value === "doc" || value === "all") {
        return value;
    }
    return "all";
}

function getDefaultCache(): Cache {
    return (globalThis.caches as CacheStorage & { default: Cache }).default;
}

function createMd5SsrUrl(baseUrl: string, md5: string, category: CategoryType): URL {
    const url = new URL(baseUrl);
    url.pathname = "/";
    url.search = "";
    url.searchParams.set("q", md5);
    if (category !== "all") {
        url.searchParams.set("c", category);
    }
    return url;
}

function createMd5SsrCacheKey(env: Cloudflare.Env, md5: string, category: CategoryType): Request {
    return new Request(createMd5SsrUrl(env.BYRDOCS_SITE_URL, md5, category).toString());
}

function createCacheableSsrResponse(response: Response): Response {
    const headers = new Headers(response.headers);
    headers.set("Cache-Control", SSR_CACHE_CONTROL);
    headers.delete("Set-Cookie");
    return new Response(response.body, {
        headers,
        status: response.status,
        statusText: response.statusText,
    });
}

function escapeInlineStyle(value: string): string {
    return value.replaceAll("</style", "<\\/style");
}

async function fetchMd5SsrDocuments(env: Cloudflare.Env, md5: string): Promise<Item[]> {
    const metadataResponse = await fetch(`${env.R2_DATA_SITE_URL}/metadata.json`);
    if (!metadataResponse.ok) return [];

    const metadataJson = await metadataResponse.json() as MetaData;
    const matched = metadataJson.find((item) => item.id === md5);
    if (!matched) return [];

    let wikiItems: WikiTestItem[] = [];
    if (matched.type === "test" && matched.data.filetype === "pdf") {
        try {
            const wikiResponse = await fetch(`${env.R2_DATA_SITE_URL}/wiki.json`);
            if (wikiResponse.ok) {
                const wikiJson = await wikiResponse.json() as WikiTestItem[];
                const matchedWiki = wikiJson.find((item) => item.id === md5);
                if (matchedWiki) wikiItems = [matchedWiki];
            }
        } catch (error) {
            console.warn("Failed to fetch wiki metadata for md5 SSR page", error);
        }
    }

    return buildSearchDocuments([matched], wikiItems);
}

class StylesheetLinkCollector {
    readonly hrefs: string[] = [];

    element(element: Element) {
        const href = element.getAttribute("href");
        if (href) {
            this.hrefs.push(href);
        }
    }
}

class StylesheetLinkHandler {
    private readonly enabled: boolean;

    constructor(enabled: boolean) {
        this.enabled = enabled;
    }

    element(element: Element) {
        if (this.enabled) {
            element.remove();
        }
    }
}

class RootHandler {
    private readonly appHtml: string;

    constructor(appHtml: string) {
        this.appHtml = appHtml;
    }

    element(element: Element) {
        element.setInnerContent(this.appHtml, { html: true });
    }
}

class TitleHandler {
    private readonly state: HeadState;
    private readonly title: string;

    constructor(title: string, state: HeadState) {
        this.title = title;
        this.state = state;
    }

    element(element: Element) {
        this.state.hasTitle = true;
        element.setInnerContent(this.title);
    }
}

class AttributeHandler {
    private readonly attribute: string;
    private readonly onSeen: () => void;
    private readonly value: string;

    constructor(attribute: string, value: string, onSeen: () => void) {
        this.attribute = attribute;
        this.value = value;
        this.onSeen = onSeen;
    }

    element(element: Element) {
        this.onSeen();
        element.setAttribute(this.attribute, this.value);
    }
}

class HeadHandler {
    private readonly inlineStyles: string | null;
    private readonly seo: PageSeo;
    private readonly state: HeadState;

    constructor(seo: PageSeo, state: HeadState, inlineStyles: string | null) {
        this.inlineStyles = inlineStyles;
        this.seo = seo;
        this.state = state;
    }

    element(element: Element) {
        element.onEndTag((endTag) => {
            const missingTags: string[] = [];

            if (this.inlineStyles) {
                missingTags.push(`<style data-ssr-inline-css="true">${escapeInlineStyle(this.inlineStyles)}</style>`);
            }
            if (!this.state.hasTitle) {
                missingTags.push(`<title>${escapeHtml(this.seo.title)}</title>`);
            }
            if (!this.state.hasDescription) {
                missingTags.push(`<meta name="description" content="${escapeHtml(this.seo.description)}">`);
            }
            if (!this.state.hasKeywords) {
                missingTags.push(`<meta name="keywords" content="${escapeHtml(this.seo.keywords)}">`);
            }
            if (!this.state.hasOgTitle) {
                missingTags.push(`<meta property="og:title" content="${escapeHtml(this.seo.title)}">`);
            }
            if (!this.state.hasOgDescription) {
                missingTags.push(`<meta property="og:description" content="${escapeHtml(this.seo.description)}">`);
            }
            if (!this.state.hasOgType) {
                missingTags.push(`<meta property="og:type" content="${this.seo.ogType}">`);
            }
            if (!this.state.hasOgImage) {
                missingTags.push(`<meta property="og:image" content="${escapeHtml(this.seo.ogImageUrl)}">`);
            }
            if (!this.state.hasOgUrl) {
                missingTags.push(`<meta property="og:url" content="${escapeHtml(this.seo.canonicalUrl)}">`);
            }
            if (!this.state.hasTwitterCard) {
                missingTags.push('<meta name="twitter:card" content="summary">');
            }
            if (!this.state.hasTwitterTitle) {
                missingTags.push(`<meta name="twitter:title" content="${escapeHtml(this.seo.title)}">`);
            }
            if (!this.state.hasTwitterDescription) {
                missingTags.push(`<meta name="twitter:description" content="${escapeHtml(this.seo.description)}">`);
            }
            if (!this.state.hasCanonical) {
                missingTags.push(`<link rel="canonical" href="${escapeHtml(this.seo.canonicalUrl)}">`);
            }

            if (missingTags.length > 0) {
                endTag.before(missingTags.join(""), { html: true });
            }
        });
    }
}

class BodyHandler {
    private readonly bootstrap: SsrBootstrap;

    constructor(bootstrap: SsrBootstrap) {
        this.bootstrap = bootstrap;
    }

    element(element: Element) {
        element.append(
            `<script>window.__BYRDOCS_SSR__=${serializeForScript(this.bootstrap)};</script>`,
            { html: true },
        );
    }
}

function rewriteHtmlResponse(
    response: Response,
    appHtml: string,
    bootstrap: SsrBootstrap,
    seo: PageSeo,
    inlineStyles: string | null,
): Response {
    const state: HeadState = {
        hasCanonical: false,
        hasDescription: false,
        hasKeywords: false,
        hasOgDescription: false,
        hasOgImage: false,
        hasOgTitle: false,
        hasOgType: false,
        hasOgUrl: false,
        hasTitle: false,
        hasTwitterCard: false,
        hasTwitterDescription: false,
        hasTwitterTitle: false,
    };

    const rewritten = new HTMLRewriter()
        .on("#root", new RootHandler(appHtml))
        .on("link[rel=\"stylesheet\"]", new StylesheetLinkHandler(Boolean(inlineStyles)))
        .on("title", new TitleHandler(seo.title, state))
        .on("meta[name=\"description\"]", new AttributeHandler("content", seo.description, () => {
            state.hasDescription = true;
        }))
        .on("meta[name=\"keywords\"]", new AttributeHandler("content", seo.keywords, () => {
            state.hasKeywords = true;
        }))
        .on("meta[property=\"og:title\"]", new AttributeHandler("content", seo.title, () => {
            state.hasOgTitle = true;
        }))
        .on("meta[property=\"og:description\"]", new AttributeHandler("content", seo.description, () => {
            state.hasOgDescription = true;
        }))
        .on("meta[property=\"og:type\"]", new AttributeHandler("content", seo.ogType, () => {
            state.hasOgType = true;
        }))
        .on("meta[property=\"og:image\"]", new AttributeHandler("content", seo.ogImageUrl, () => {
            state.hasOgImage = true;
        }))
        .on("meta[property=\"og:url\"]", new AttributeHandler("content", seo.canonicalUrl, () => {
            state.hasOgUrl = true;
        }))
        .on("meta[name=\"twitter:card\"]", new AttributeHandler("content", "summary", () => {
            state.hasTwitterCard = true;
        }))
        .on("meta[name=\"twitter:title\"]", new AttributeHandler("content", seo.title, () => {
            state.hasTwitterTitle = true;
        }))
        .on("meta[name=\"twitter:description\"]", new AttributeHandler("content", seo.description, () => {
            state.hasTwitterDescription = true;
        }))
        .on("link[rel=\"canonical\"]", new AttributeHandler("href", seo.canonicalUrl, () => {
            state.hasCanonical = true;
        }))
        .on("head", new HeadHandler(seo, state, inlineStyles))
        .on("body", new BodyHandler(bootstrap))
        .transform(response);

    const headers = new Headers(rewritten.headers);
    headers.set("Content-Type", "text/html; charset=UTF-8");
    return new Response(rewritten.body, {
        status: rewritten.status,
        statusText: rewritten.statusText,
        headers,
    });
}

async function collectStylesheetHrefs(response: Response): Promise<string[]> {
    const collector = new StylesheetLinkCollector();
    await new HTMLRewriter()
        .on("link[rel=\"stylesheet\"]", collector)
        .transform(response)
        .text();
    return collector.hrefs;
}

async function fetchInlineStyles(
    env: Cloudflare.Env,
    pageUrl: string,
    request: Request,
    htmlResponse: Response,
): Promise<string | null> {
    const hrefs = Array.from(new Set(await collectStylesheetHrefs(htmlResponse)));
    if (hrefs.length === 0) {
        return null;
    }

    const cssList = await Promise.all(hrefs.map(async (href) => {
        const styleUrl = new URL(href, pageUrl);
        const styleRequest = new Request(styleUrl.toString(), request);
        const response = await env.ASSETS.fetch(styleRequest);
        if (!response.ok) {
            console.warn("Failed to fetch stylesheet for SSR inline CSS", {
                href,
                status: response.status,
            });
            return null;
        }
        const contentType = response.headers.get("Content-Type") ?? "";
        if (!contentType.includes("text/css")) {
            console.info("Skip SSR inline CSS for non-CSS stylesheet response", {
                contentType,
                href,
            });
            return null;
        }
        return response.text();
    }));

    if (cssList.some((css) => css === null)) {
        return null;
    }

    const inlineStyles = cssList.filter((css): css is string => Boolean(css)).join("\n");
    return inlineStyles || null;
}

export async function renderMd5SsrPage({
    category,
    env,
    executionCtx,
    md5,
    pageUrl,
    request,
}: RenderMd5SsrPageParams): Promise<Response> {
    const cacheKey = createMd5SsrCacheKey(env, md5, category);
    const defaultCache = getDefaultCache();
    const cached = await defaultCache.match(cacheKey);
    if (cached) {
        console.log({
            type: "cache",
            status: "hit",
            scope: "ssr",
            key: cacheKey.url,
        });
        return cached;
    }

    console.log({
        type: "cache",
        status: "miss",
        scope: "ssr",
        key: cacheKey.url,
    });

    const target = new URL(pageUrl);
    target.pathname = "/";
    const assetResponse = await env.ASSETS.fetch(target, request);
    const inlineStyles = await fetchInlineStyles(env, pageUrl, request, assetResponse.clone());
    const initialDocuments = await fetchMd5SsrDocuments(env, md5);
    const initialSearchSnapshot = createExactMatchSearchSnapshot(md5, initialDocuments, category);
    const seoItem = initialSearchSnapshot?.filteredResults[0] ?? null;
    const normalizedPageUrl = createMd5SsrUrl(pageUrl, md5, category).toString();
    const seo = seoItem
        ? buildItemSeo(seoItem, normalizedPageUrl, env.BYRDOCS_SITE_URL)
        : buildDefaultSeo(normalizedPageUrl, env.BYRDOCS_SITE_URL);
    const bootstrap: SsrBootstrap = {
        initialDocuments,
        initialSearchSnapshot,
    };
    const appHtml = renderHomePage(normalizedPageUrl, bootstrap);
    let response = rewriteHtmlResponse(assetResponse, appHtml, bootstrap, seo, inlineStyles);

    if (response.status === 200) {
        response = createCacheableSsrResponse(response);
        const cacheWrite = defaultCache.put(cacheKey, response.clone());
        executionCtx.waitUntil(cacheWrite);
        console.log({
            type: "cache",
            status: "set",
            scope: "ssr",
            key: cacheKey.url,
        });
    }

    return response;
}
