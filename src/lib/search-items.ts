import type { Item, MetaData, TestItem, WikiTest, WikiTestItem } from "../types";

let wikiId = 0;

export function resetWikiIdCounter() {
    wikiId = 0;
}

function nextWikiId() {
    wikiId += 1;
    return wikiId;
}

export function initSearchItem<T extends Item | WikiTestItem>(item: T): T {
    if (item.type !== "test") return item;

    const time = item.data.time.start === item.data.time.end
        ? item.data.time.start
        : `${item.data.time.start}-${item.data.time.end}`;

    item.data.title = `${time}${item.data.time.semester === "First"
        ? " 第一学期"
        : item.data.time.semester === "Second"
            ? " 第二学期"
            : ""} ${item.data.course.name}${item.data.time.stage ? ` ${item.data.time.stage}` : ""}${item.data.content.length === 1 && item.data.content[0] === "答案"
        ? "答案"
        : "试卷"}`;

    if (item.data.filetype === "wiki") {
        item.id = `wiki-${nextWikiId()}`;
    }

    return item;
}

export function buildSearchDocuments(metadata: MetaData, wikiData: WikiTestItem[] = []): Item[] {
    resetWikiIdCounter();

    const documents = metadata.map((item) => initSearchItem(structuredClone(item) as Item));
    const idMap = new Map<string, number>();

    documents.forEach((item, index) => {
        if (item.id) idMap.set(item.id, index);
    });

    wikiData.forEach((item) => {
        if (item.id && idMap.has(item.id)) {
            const mainItem = documents[idMap.get(item.id)!];
            if (mainItem.type === "test" && mainItem.data.filetype === "pdf") {
                mainItem.data.wiki = {
                    url: item.url,
                    data: initSearchItem(structuredClone(item)).data as WikiTest,
                };
            }
            return;
        }

        documents.push(initSearchItem(structuredClone(item) as Item));
    });

    return documents;
}

export function attachWikiToMatchedItem(
    item: Item | null,
    wikiData: WikiTestItem[],
): Item | null {
    if (!item || item.type !== "test" || item.data.filetype !== "pdf") return item;

    const matchedWiki = wikiData.find((wikiItem) => wikiItem.id === item.id);
    if (!matchedWiki) return item;

    const nextItem = structuredClone(item) as TestItem;
    nextItem.data.wiki = {
        url: matchedWiki.url,
        data: initSearchItem(structuredClone(matchedWiki)).data as WikiTest,
    };
    return nextItem;
}
