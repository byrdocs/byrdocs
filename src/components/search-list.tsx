import { Item } from "@/types"
import { useEffect, useRef, useState, use } from "react"
import { ItemDisplay } from "./item"
import MiniSearch from "minisearch"
import { detect_search_type } from "@/lib/search"
import { Badge } from "@/components/ui/badge"
import { MultiSelect, MultiSelectOption } from "./ui/multiselect"
import init, { cut_for_search } from 'jieba-wasm';
import { cn } from "@/lib/utils"
import {
    buildFilterOptions,
    createExactMatchSearchSnapshot,
    initialFilter,
    type FilterType,
    type SearchSnapshot,
    type SearchType,
    sortFilteredResults,
} from "@/lib/search-snapshot"

const minisearch = new MiniSearch({
    fields: ["data.title", "data.authors", "data.translators", "data.publisher",
        "data.edition", "data.course.name", "data.course.type", "data.stage"],
    storeFields: ['type', 'data', 'id', 'url'],
    tokenize: s => {
        const res = cut_for_search(s).filter(word => word.trim() !== '')
        return res
    },
    extractField: (document, fieldName) => {
        return fieldName.split('.').reduce((doc, key) => doc && doc[key], document)
    }
})

let wasmInit: Promise<unknown> | null = null

function getWasmInit() {
    if (!wasmInit) {
        wasmInit = init('/jieba_rs_wasm_bg_2.2.0.wasm')
    }
    return wasmInit
}

const PAGE_SIZE = 20

export function SearchList({
    keyword,
    documents,
    searching,
    category,
    debounceing,
    loading,
    showSigma,
    onPreview,
    onSearching,
    initialSnapshot,
}: {
    keyword: string
    documents: Item[]
    searching: boolean
    debounceing: boolean
    category: "all" | "test" | "doc" | "book"
    loading: boolean
    showSigma: boolean
    onPreview: (url: string) => void
    onSearching: (searching: boolean) => void
    initialSnapshot?: SearchSnapshot | null
}) {
    const [searchResults, setSearchResults] = useState<Item[]>(initialSnapshot?.searchResults ?? []);
    const [filterdResults, setFilterdResults] = useState<Item[]>(initialSnapshot?.filteredResults ?? []);
    const [miniSearching, setMiniSearching] = useState(false);
    const [searchType, setSearchType] = useState<SearchType>(initialSnapshot?.searchType ?? 'normal')
    const [pageSize, setPageSize] = useState(PAGE_SIZE)
    const [filter, setFilter] = useState<Record<FilterType, string[]>>(initialFilter)
    const [filterOptions, setFilterOptions] = useState<Record<FilterType, string[]>>(initialSnapshot?.filterOptions ?? initialFilter)
    const listEnd = useRef<HTMLDivElement>(null);
    const [searchTime, setSearchTime] = useState<number | null>(null)

    if (typeof window !== "undefined" && detect_search_type(keyword) === "normal") {
        use(getWasmInit());
    }

    useEffect(() => {
        setPageSize(PAGE_SIZE)
    }, [keyword, documents, searching, category])

    useEffect(() => {
        if (detect_search_type(keyword) !== "normal") {
            return;
        }
        minisearch.addAll(documents)
        return () => {
            minisearch.removeAll()
        }
    }, [documents, keyword])

    useEffect(() => {
        function onScroll() {
            if (listEnd.current && listEnd.current.getBoundingClientRect().top < window.innerHeight && filterdResults.length > pageSize) {
                setPageSize(pageSize => pageSize + PAGE_SIZE)
            }
        }
        onScroll()
        window.addEventListener('scroll', onScroll)
        return () => window.removeEventListener('scroll', onScroll)
    }, [filterdResults, pageSize])

    useEffect(() => {
        setFilter(initialFilter)
    }, [filterOptions])

    useEffect(() => {
        const start = performance.now()
        setMiniSearching(true)
        onSearching(true)
        setFilter(initialFilter)

        const exactMatchSnapshot = createExactMatchSearchSnapshot(keyword, documents, category)
        let results: Item[] = []

        if (exactMatchSnapshot) {
            setSearchType(exactMatchSnapshot.searchType)
            setFilterOptions(exactMatchSnapshot.filterOptions)
            setSearchResults(exactMatchSnapshot.searchResults)
            setFilterdResults(exactMatchSnapshot.filteredResults)
        } else {
            const type = detect_search_type(keyword)
            setSearchType('normal')
            console.time('minisearch')
            const searchResult = minisearch.search(keyword, {
                filter: (result) => category === 'all' || category === result.type,
                combineWith: 'AND'
            })
            console.timeEnd('minisearch')
            results = searchResult.filter((item) => item.score > 1) as unknown as Item[];
            if (type === 'normal') {
                setFilterOptions(buildFilterOptions(results))
                setSearchResults(results)
            }
        }

        onSearching(false)
        setMiniSearching(false)
        setSearchTime(performance.now() - start)
    }, [keyword, category, documents]);

    useEffect(() => {
        let filterdResults = searchResults.filter((item) => {
            if (item.type === 'test') {
                if (filter.college.length > 0 && !filter.college.some(college => item.data.college?.includes(college))) return false
                if (filter.course.length > 0 && !filter.course.some(course => item.data.course.name === course)) return false
                if (filter.content.length > 0 && !filter.content.some(type => item.data.content.includes(type as any))) return false
                if (filter.type.length > 0 && !filter.type.some(type => (item.data.time.stage ?? '其他') === type)) return false
            } else if (item.type === 'doc') {
                if (filter.course.length > 0 && !filter.course.some(course => item.data.course.some(c => c.name === course))) return false
                if (filter.content.length > 0 && !filter.content.some(type => item.data.content.includes(type as any))) return false
            }
            return true
        })
        setFilterdResults(sortFilteredResults(filterdResults, category))
    }, [filter, searchResults])

    if (loading || !searching || filterdResults.length === 0 && (debounceing || miniSearching)) {
        return <EmptySearchList />
    }

    return (<div className="space-y-2 md:space-y-3 md:w-[800px] w-full md:mx-auto p-0 md:px-5 pt-2">
        {
            searchType === 'isbn' ?
            <Badge className="text-muted-foreground mx-2 md:mx-0" variant={"outline"}>
                搜索类型：ISBN
            </Badge> :
            searchType === 'md5' ?
            <Badge className="text-muted-foreground mx-2 md:mx-0" variant={"outline"}>
                搜索类型：MD5
            </Badge> : 
            category == 'test' || category == 'doc' ?
            <div className="flex-row flex">
                <div className="flex-1">
                    {category === 'test' ? 
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-x-2 gap-y-1 px-2 md:px-0">
                            <MultiSelect
                                selected={filter.college}
                                key="colledge"
                                placeholder="学院"
                                onChange={(selected) => {
                                    setFilter({ ...filter, college: selected })
                                }}
                                search={true}
                            >
                                {filterOptions.college.map(college => (
                                    <MultiSelectOption key={college} value={college}>{college}</MultiSelectOption>
                                ))}
                            </MultiSelect>
                            <MultiSelect
                                selected={filter.course}
                                key="course"
                                placeholder="课程"
                                onChange={(selected) => {
                                    setFilter({ ...filter, course: selected })
                                }}
                                search={true}
                            >
                                {filterOptions.course.map(course => (
                                    <MultiSelectOption key={course} value={course}>{course}</MultiSelectOption>
                                ))}
                            </MultiSelect>
                            <MultiSelect
                                selected={filter.content}
                                key="content"
                                placeholder="类别"
                                onChange={(selected) => {
                                    setFilter({ ...filter, content: selected })
                                }}
                            >
                                {filterOptions.content.map(content => (
                                    <MultiSelectOption key={content} value={content}>{content}</MultiSelectOption>
                                ))}
                            </MultiSelect>
                            <MultiSelect
                                selected={filter.type}
                                key="type"
                                placeholder="阶段"
                                onChange={(selected) => {
                                    setFilter({ ...filter, type: selected })
                                }}
                                search={false}
                            >
                                {filterOptions.type.map(type => (
                                    <MultiSelectOption key={type} value={type}>{type}</MultiSelectOption>
                                ))}
                            </MultiSelect>
                        </div>
                        :
                        category === 'doc' ?
                            <div className="grid grid-cols-2 gap-x-2 px-2 md:px-0">
                                <MultiSelect
                                    selected={filter.course}
                                    key="docCourse"
                                    placeholder="课程"
                                    onChange={(selected) => {
                                        setFilter({ ...filter, course: selected })
                                    }}
                                    search={true}
                                >
                                    {filterOptions.course.map(course => (
                                        <MultiSelectOption key={course} value={course}>{course}</MultiSelectOption>
                                    ))}
                                </MultiSelect>
                                <MultiSelect
                                    selected={filter.content}
                                    key="docType"
                                    placeholder="类别"
                                    onChange={(selected) => {
                                        setFilter({ ...filter, content: selected })
                                    }}
                                >
                                    {filterOptions.content.map(course => (
                                        <MultiSelectOption key={course} value={course}>{course}</MultiSelectOption>
                                    ))}
                                </MultiSelect>
                            </div>
                            : null}
                </div>
            </div> : null
        }
        {filterdResults.length !== 0 ?
            <>
                {searchType === 'normal' && <div 
                    className={cn(
                        "text-sm text-muted-foreground px-2 md:px-0 transition-all overflow-hidden",
                        {
                            "max-h-0": !showSigma,
                            "max-h-[100px]": showSigma,
                        }
                    )}
                >
                    找到 {filterdResults.length} 条结果
                    {searchTime !== null ? `，耗时 ${searchTime.toFixed(2)} ms` : null}
                </div>}
                {(filterdResults.slice(0, pageSize)).map((item, index) => (
                    <ItemDisplay key={item.id} item={item as unknown as Item} index={index} onPreview={onPreview} />
                ))}
            </>
            : <div className="text-center text-muted-foreground p-0 md:p-5 flex h-[40vh]">
                <div className="text-xl sm:text-2xl font-light m-auto ">
                    <div className="px-2">
                        <div className="mb-4">没有找到相关结果</div>
                        <div className="text-xs sm:text-base mb-2">注意使用全称搜索，例如“高等数学”而非“高数”</div>
                        <hr />
                        <div className="text-xs sm:text-base mt-2">
                            已有文件？<a className="text-blue-500 hover:text-blue-400" target="_blank" href="https://github.com/byrdocs/byrdocs-archive/blob/master/CONTRIBUTING.md">上传到 BYR Docs</a>
                        </div>
                    </div>
                </div>
            </div>
        }
        <div ref={listEnd}></div>
    </div>)
}

export function EmptySearchList() {
    return (
        <div className="h-full text-center text-muted-foreground p-0 md:p-5 flex">
            <div className="text-xl sm:text-2xl font-light m-auto ">
                搜索书籍、试卷和资料
            </div>
        </div>
    )
}
