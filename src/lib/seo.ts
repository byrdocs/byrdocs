import type { Item, WikiTestItem } from "../types";

export type PageSeo = {
    title: string;
    description: string;
    keywords: string;
    canonicalUrl: string;
    ogImageUrl: string;
    ogType: "website" | "article";
};

export function resolveUrl(base: string, path: string): string {
    try {
        return new URL(path, base).toString();
    } catch {
        return path;
    }
}

function joinValues(values?: Array<string | undefined>): string {
    return values?.filter(Boolean).join("、") || "未提供";
}

function formatSemester(semester?: "First" | "Second"): string {
    if (semester === "First") return "第一学期";
    if (semester === "Second") return "第二学期";
    return "未提供";
}

function formatTimeRange(start: string, end: string): string {
    return start === end ? start : `${start}-${end}`;
}

function getItemTypeLabel(item: Item | WikiTestItem): string {
    if (item.type === "book") return "书籍";
    if (item.type === "doc") return "课程资料";
    if (item.data.filetype === "wiki") return "试卷 Wiki 条目";
    return "试卷";
}

function getCourseSummary(item: Item | WikiTestItem): string {
    if (item.type === "book") return "教材与参考书";
    if (item.type === "doc") {
        return joinValues(item.data.course.map((course) => {
            if (!course.name) return undefined;
            return course.type ? `${course.name}（${course.type}）` : course.name;
        }));
    }

    return item.data.course.type
        ? `${item.data.course.name}（${item.data.course.type}）`
        : item.data.course.name;
}

export function getItemDescription(item: Item | WikiTestItem): string {
    if (item.type === "book") {
        const details = [
            `作者：${joinValues(item.data.authors)}`,
            item.data.translators?.length ? `译者：${joinValues(item.data.translators)}` : undefined,
            item.data.publisher ? `出版社：${item.data.publisher}` : undefined,
            item.data.publish_year ? `出版年份：${item.data.publish_year}` : undefined,
            item.data.edition ? `版次：${item.data.edition}` : undefined,
        ].filter(Boolean).join("，");
        return details || "BYR Docs 收录的书籍资料。";
    }

    if (item.type === "doc") {
        return `适用课程：${getCourseSummary(item)}。资料类型：${joinValues(item.data.content)}。`;
    }

    const parts = [
        `课程：${getCourseSummary(item)}`,
        `考试时间：${formatTimeRange(item.data.time.start, item.data.time.end)}`,
        item.data.time.semester ? `学期：${formatSemester(item.data.time.semester)}` : undefined,
        item.data.time.stage ? `考试阶段：${item.data.time.stage}` : undefined,
        `内容类型：${joinValues(item.data.content)}`,
        item.data.college?.length ? `学院：${joinValues(item.data.college)}` : undefined,
    ].filter(Boolean).join("。");
    return `${parts}。`;
}

export function getItemKeywords(item: Item | WikiTestItem): string {
    const keywords = new Set<string>(["BYR Docs", "北京邮电大学", "北邮", item.data.title, getItemTypeLabel(item)]);

    if (item.type === "book") {
        item.data.authors.forEach((author) => keywords.add(author));
        item.data.isbn.forEach((isbn) => keywords.add(isbn));
        if (item.data.publisher) keywords.add(item.data.publisher);
    }

    if (item.type === "doc") {
        item.data.course.forEach((course) => {
            if (course.name) keywords.add(course.name);
            if (course.type) keywords.add(course.type);
        });
        item.data.content.forEach((content) => keywords.add(content));
    }

    if (item.type === "test") {
        keywords.add(item.data.course.name);
        if (item.data.course.type) keywords.add(item.data.course.type);
        item.data.content.forEach((content) => keywords.add(content));
        item.data.college?.forEach((college) => keywords.add(college));
    }

    return Array.from(keywords).join(", ");
}

export function buildDefaultSeo(pageUrl: string, siteUrl: string): PageSeo {
    const description = "北京邮电大学资料分享平台，旨在使校内学生更方便地获取与北邮课程有关的教育资源，包括电子书籍、考试题目和复习资料等。";

    return {
        title: "BYR Docs",
        description,
        keywords: "北邮, 北京邮电大学, 资料, 电子书籍, 考试题目, 复习资料",
        canonicalUrl: pageUrl,
        ogImageUrl: resolveUrl(siteUrl, "/og.png"),
        ogType: "website",
    };
}

export function buildItemSeo(item: Item | WikiTestItem, pageUrl: string, siteUrl: string): PageSeo {
    return {
        title: `${item.data.title} - BYR Docs`,
        description: getItemDescription(item),
        keywords: getItemKeywords(item),
        canonicalUrl: pageUrl,
        ogImageUrl: resolveUrl(siteUrl, "/og.png"),
        ogType: "article",
    };
}

type MetaSelector = {
    attr: "name" | "property";
    key: string;
    content: string;
};

function upsertMetaTag(tag: MetaSelector) {
    if (typeof document === "undefined") return;

    let element = document.head.querySelector<HTMLMetaElement>(`meta[${tag.attr}="${tag.key}"]`);
    if (!element) {
        element = document.createElement("meta");
        element.setAttribute(tag.attr, tag.key);
        document.head.appendChild(element);
    }
    element.setAttribute("content", tag.content);
}

function upsertLinkTag(rel: string, href: string) {
    if (typeof document === "undefined") return;

    let element = document.head.querySelector<HTMLLinkElement>(`link[rel="${rel}"]`);
    if (!element) {
        element = document.createElement("link");
        element.setAttribute("rel", rel);
        document.head.appendChild(element);
    }
    element.setAttribute("href", href);
}

export function applySeoToDocument(seo: PageSeo) {
    if (typeof document === "undefined") return;

    document.title = seo.title;

    const metaTags: MetaSelector[] = [
        { attr: "name", key: "description", content: seo.description },
        { attr: "name", key: "keywords", content: seo.keywords },
        { attr: "property", key: "og:title", content: seo.title },
        { attr: "property", key: "og:description", content: seo.description },
        { attr: "property", key: "og:type", content: seo.ogType },
        { attr: "property", key: "og:url", content: seo.canonicalUrl },
        { attr: "property", key: "og:image", content: seo.ogImageUrl },
        { attr: "name", key: "twitter:card", content: "summary" },
        { attr: "name", key: "twitter:title", content: seo.title },
        { attr: "name", key: "twitter:description", content: seo.description },
    ];

    metaTags.forEach(upsertMetaTag);
    upsertLinkTag("canonical", seo.canonicalUrl);
}

export function getSeoItemFromDocuments(
    documents: Item[],
    md5: string,
    category: "all" | "book" | "test" | "doc",
): Item | null {
    const matched = documents.find((item) => item.id === md5);
    if (!matched) return null;
    if (category !== "all" && matched.type !== category) return null;
    return matched;
}
