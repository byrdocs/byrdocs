import MiniSearch from "minisearch";
import { search as jmespathSearch } from "@jmespath-community/jmespath";
import { createExactMatchSearchSnapshot, sortFilteredResults } from "../../src/lib/search-snapshot";
import { buildSearchDocuments } from "../../src/lib/search-items";
import type { CategoryType, Item, MetaData, WikiTestItem } from "../../src/types";
import { cut_for_search } from "./jieba";
import type { Env } from "./env";

export type SearchCategory = CategoryType;

export interface SearchParams {
    keyword?: string;
    jmespath?: string;
    type?: SearchCategory;
    limit?: number;
    shorten?: boolean;
    shortenToken?: string;
}

export interface SearchResult {
    total: number;
    results: unknown[];
}

export class InvalidJmespathError extends Error {
    constructor(message: string) {
        super(message);
        this.name = "InvalidJmespathError";
    }
}

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;
const CACHE_TTL_MS = 5 * 60 * 1000;

interface DocumentCache {
    documents: Item[];
    minisearch: MiniSearch;
    fetchedAt: number;
}

let cache: DocumentCache | null = null;
let inflight: Promise<DocumentCache> | null = null;

function buildIndex(documents: Item[]): MiniSearch {
    const minisearch = new MiniSearch({
        fields: [
            "data.title", "data.authors", "data.translators", "data.publisher",
            "data.edition", "data.course.name", "data.course.type", "data.stage",
        ],
        storeFields: ["type", "data", "id", "url"],
        tokenize: (s) => cut_for_search(s).filter((word) => word.trim() !== ""),
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        extractField: (document: any, fieldName) =>
            fieldName.split(".").reduce((doc, key) => doc && doc[key], document),
    });
    minisearch.addAll(documents);
    return minisearch;
}

async function fetchDocuments(env: Env): Promise<DocumentCache> {
    const [metaRes, wikiRes] = await Promise.all([
        fetch(env.DATA_URL),
        fetch(env.WIKI_URL),
    ]);

    if (!metaRes.ok) {
        throw new Error(`Failed to fetch metadata: ${metaRes.status}`);
    }
    const metadata = await metaRes.json() as MetaData;

    let wiki: WikiTestItem[] = [];
    if (wikiRes.ok) {
        try {
            wiki = await wikiRes.json() as WikiTestItem[];
        } catch {
            wiki = [];
        }
    }

    const documents = buildSearchDocuments(metadata, wiki);
    return { documents, minisearch: buildIndex(documents), fetchedAt: Date.now() };
}

async function loadCache(env: Env): Promise<DocumentCache> {
    if (cache && Date.now() - cache.fetchedAt < CACHE_TTL_MS) {
        return cache;
    }
    if (!inflight) {
        inflight = fetchDocuments(env)
            .then((next) => {
                cache = next;
                return next;
            })
            .finally(() => {
                inflight = null;
            });
    }
    try {
        return await inflight;
    } catch (error) {
        if (cache) return cache;
        throw error;
    }
}

function encodeUrl(url: string): string {
    try {
        return new URL(url).toString();
    } catch {
        return url;
    }
}

function normalizeItemUrls(item: Item): Item {
    let url = item.url;
    if (url) {
        try {
            const parsed = new URL(url);
            if (parsed.pathname.startsWith("/files/")) {
                parsed.searchParams.set("filename", `${item.data.title}.${item.data.filetype}`);
                parsed.searchParams.set("f", "1");
            }
            url = parsed.toString();
        } catch {
            // keep original url if unparseable
        }
    }

    if (item.type === "test" && item.data.filetype === "pdf" && item.data.wiki) {
        return {
            ...item,
            url,
            data: { ...item.data, wiki: { ...item.data.wiki, url: encodeUrl(item.data.wiki.url) } },
        };
    }

    return { ...item, url };
}

function applyJmespath(results: Item[], expression: string): unknown[] {
    let projected: unknown;
    try {
        projected = jmespathSearch(results as unknown as Parameters<typeof jmespathSearch>[0], expression);
    } catch (error) {
        throw new InvalidJmespathError((error as Error).message);
    }
    if (Array.isArray(projected)) return projected;
    if (projected === null || projected === undefined) return [];
    return [projected];
}

const SHORTEN_ENDPOINT = "https://go.byrdocs.org/api/shorten";

function isItem(value: unknown): value is Item {
    return (
        typeof value === "object" &&
        value !== null &&
        !Array.isArray(value) &&
        "type" in value &&
        "data" in value &&
        "url" in value
    );
}

async function shortenUrl(url: string, token: string): Promise<string | null> {
    try {
        const res = await fetch(SHORTEN_ENDPOINT, {
            method: "POST",
            headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
            body: JSON.stringify({ url }),
        });
        if (!res.ok) return null;
        const data = (await res.json()) as { short_url?: unknown };
        return typeof data.short_url === "string" ? data.short_url : null;
    } catch {
        return null;
    }
}

async function shortenResults(results: unknown[], token: string): Promise<unknown[]> {
    const urls = new Set<string>();
    for (const item of results) {
        if (!isItem(item)) continue;
        if (item.url) urls.add(item.url);
        if (item.type === "test" && item.data.filetype === "pdf" && item.data.wiki?.url) {
            urls.add(item.data.wiki.url);
        }
    }
    if (urls.size === 0) return results;

    const entries = await Promise.all(
        [...urls].map(async (u) => [u, await shortenUrl(u, token)] as const),
    );
    const map = new Map<string, string>();
    for (const [orig, short] of entries) {
        if (short) map.set(orig, short);
    }
    if (map.size === 0) return results;

    return results.map((item) => {
        if (!isItem(item)) return item;
        const url = item.url && map.has(item.url) ? map.get(item.url)! : item.url;
        if (
            item.type === "test" &&
            item.data.filetype === "pdf" &&
            item.data.wiki?.url &&
            map.has(item.data.wiki.url)
        ) {
            return {
                ...item,
                url,
                data: { ...item.data, wiki: { ...item.data.wiki, url: map.get(item.data.wiki.url)! } },
            };
        }
        return { ...item, url };
    });
}

export async function runSearch(env: Env, params: SearchParams): Promise<SearchResult> {
    const { documents, minisearch } = await loadCache(env);
    const keyword = (params.keyword ?? "").trim();
    const category: SearchCategory = params.type ?? "all";

    let results: Item[];
    if (keyword === "") {
        const scoped = category === "all"
            ? documents
            : documents.filter((item) => item.type === category);
        results = sortFilteredResults(scoped, category);
    } else {
        const exact = createExactMatchSearchSnapshot(keyword, documents, category);
        if (exact) {
            results = exact.filteredResults;
        } else {
            const raw = minisearch.search(keyword, {
                filter: (result) => category === "all" || category === result.type,
                combineWith: "AND",
            });
            const filtered = raw
                .filter((item) => item.score > 1)
                .map((item) => ({ type: item.type, id: item.id, data: item.data, url: item.url }) as Item);
            results = sortFilteredResults(filtered, category);
        }
    }

    results = results.map(normalizeItemUrls);

    let output: unknown[] = results;
    const expression = params.jmespath?.trim();
    if (expression) {
        output = applyJmespath(results, expression);
    }

    const limit = Math.min(Math.max(params.limit ?? DEFAULT_LIMIT, 1), MAX_LIMIT);
    let finalResults = output.slice(0, limit);
    if (params.shorten && params.shortenToken) {
        finalResults = await shortenResults(finalResults, params.shortenToken);
    }
    return { total: output.length, results: finalResults };
}
