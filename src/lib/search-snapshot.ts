import { detect_search_type } from "./search";
import type { CategoryType, Item, TestItem } from "../types";

export const initialFilter = {
    college: [],
    course: [],
    content: [],
    type: [],
};

export type FilterType = keyof typeof initialFilter;
export type SearchType = "isbn" | "md5" | "normal";

export type SearchSnapshot = {
    searchResults: Item[];
    filteredResults: Item[];
    filterOptions: Record<FilterType, string[]>;
    searchType: SearchType;
};

export function buildFilterOptions(results: Item[]): Record<FilterType, string[]> {
    const colleges = new Set<string>();
    const courses = new Set<string>();
    const content = new Set<string>();

    for (const item of results) {
        if (item.type === "test") {
            item.data.college?.forEach((college) => colleges.add(college));
            if (item.data.course.name) courses.add(item.data.course.name);
            item.data.content.forEach((entry) => content.add(entry));
            continue;
        }

        if (item.type === "doc") {
            item.data.course.forEach((course) => {
                if (course.name) courses.add(course.name);
            });
            item.data.content.forEach((entry) => content.add(entry));
        }
    }

    return {
        college: Array.from(colleges).sort(),
        course: Array.from(courses).sort(),
        content: Array.from(content).sort().reverse(),
        type: ["期中", "期末", "其他"],
    };
}

export function sortFilteredResults(results: Item[], category: CategoryType): Item[] {
    if (category !== "test") return results;

    return [...results].sort((a, b) => {
        const testA = a as TestItem;
        const testB = b as TestItem;
        const aTime = testA.data.time ? new Date(testA.data.time.start).getTime() : 0;
        const bTime = testB.data.time ? new Date(testB.data.time.start).getTime() : 0;

        if (aTime !== bTime) return bTime - aTime;

        const aSemester = testA.data.time.semester ?? "";
        const bSemester = testB.data.time.semester ?? "";
        if (aSemester !== bSemester) return bSemester.localeCompare(aSemester);

        return testB.id.localeCompare(testA.id);
    });
}

export function createExactMatchSearchSnapshot(
    keyword: string,
    documents: Item[],
    category: CategoryType,
): SearchSnapshot | null {
    const searchType = detect_search_type(keyword);
    let searchResults: Item[] = [];

    if (searchType === "isbn") {
        const searchIsbn = keyword.replaceAll("-", "");
        searchResults = documents.filter((item) =>
            item.type === "book" &&
            item.data.isbn.some((isbn) => isbn.replaceAll("-", "") === searchIsbn) &&
            (category === "all" || category === item.type),
        );
    } else if (searchType === "md5") {
        searchResults = documents.filter((item) => item.id === keyword && (category === "all" || category === item.type));
    } else {
        return null;
    }

    return {
        searchResults,
        filteredResults: sortFilteredResults(searchResults, category),
        filterOptions: buildFilterOptions(searchResults),
        searchType,
    };
}
