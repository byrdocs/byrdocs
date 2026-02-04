import { Input } from "@/components/ui/input"
import { Logo } from "./logo"
import { useState, useRef, useEffect, Suspense } from "react"
import { cn } from "@/lib/utils"
import { toast } from "sonner"
import { CategoryType, Item, WikiTest } from "@/types"
import { useNavigate, useSearchParams } from "react-router-dom"
import { ChartLine, StepForward } from "lucide-react"
import {
    Drawer,
    DrawerContent,
    DrawerTitle
} from "@/components/ui/drawer"
import {
    SidebarProvider,
    SidebarContent,
    Sidebar,
} from "@/components/ui/sidebar"
import { useIsMobile } from "@/hooks/use-mobile"
import { TabItem, TabList } from "./tab"
import { EmptySearchList, SearchList } from "./search-list"
import { useDebounce, useDebounceFn } from "@/hooks/use-debounce"

const DEBOUNCE_TIME = 500;
let wiki_id = 0;


function initItem(item: Item) {
    if (item.type === 'test') {
        let time = item.data.time.start;
        if (item.data.time.start !== item.data.time.end) {
            time = `${item.data.time.start}-${item.data.time.end}`
        }
        item.data.title = `${time}${item.data.time.semester === 'First' ?
            " 第一学期" :
            item.data.time.semester === 'Second' ?
                " 第二学期" : ""
            } ${item.data.course.name}${item.data.time.stage ? ' ' + item.data.time.stage : ''}${item.data.content.length == 1 && item.data.content[0] == "答案" ?
                "答案" : "试卷"
            }`
        if (item.data.filetype === 'wiki') {
            item.id = `wiki-${++wiki_id}`
        }
    }
    return item
}

export function Search({ onPreview: onLayoutPreview }: { onPreview: (preview: boolean) => void }) {
    const [query, setQuery] = useSearchParams()
    const q = query.get("q") || ""
    const type = query.get("c") || ""
    const [top, setTop] = useState(false)
    const input = useRef<HTMLInputElement>(null)
    const [showClear, setShowClear] = useState(q !== "")
    const showedTip = useRef(false)
    const [active, setActive] = useState<CategoryType>(type as CategoryType ?? 'book')
    const [inputFixed, setInputFixed] = useState(false)
    const relative = useRef<HTMLDivElement>(null)
    const navigate = useNavigate()
    const [docsData, setDocsData] = useState<Item[]>([])
    const [searching, setSearching] = useState(false)
    const [preview, setPreview] = useState("")
    const [desktopPreview, setDesktopPreview] = useState("")
    const isMobile = useIsMobile()
    const [announcements, setAnnouncements] = useState<any[]>([])
    const updateQeury = useDebounceFn(setQuery, DEBOUNCE_TIME)
    const [loading, setLoading] = useState(true)
    const [keyword, setKeyword] = useState(q)
    const [debouncedKeyword, debouncing] = useDebounce(keyword, DEBOUNCE_TIME)
    const [miniSearching, setMiniSearching] = useState(false);
    const [suspenseLoading, setSuspenseLoading] = useState(true);
    const [showSigma, setShowSigma] = useState(false);

    if (isMobile) {
        if (desktopPreview) {
            onLayoutPreview(false)
            setPreview(desktopPreview)
            setDesktopPreview("")
        }
    } else {
        if (preview) {
            onLayoutPreview(true)
            setDesktopPreview(preview)
            setPreview("")
        }
    }

    function reset() {
        setTop(false)
        setKeyword("")
        setActive("book")
        input.current?.focus()
        setShowClear(false)
        navigate("/")
    }

    useEffect(() => {
        if (q) {
            setKeyword(q)
            setSearching(true)
        } else {
            setKeyword("")
            setSearching(false)
        }
        if (type) {
            setActive(type as CategoryType)
        } else {
            setActive("book")
        }
    }, [q, type])

    useEffect(() => {
        function handleKeyDown(e: KeyboardEvent) {
            if (document.activeElement !== document.body) return
            if (e.key === "/") {
                e.preventDefault()
                input.current?.focus()
            } else {
                if (showedTip.current) return
                if (e.key.length !== 1 || e.altKey || e.ctrlKey || e.metaKey) return
                toast("按 / 即可跳到搜索框", {
                    action: {
                        label: "OK",
                        onClick: () => { },
                    },
                })
                showedTip.current = true
            }
        }

        function handleScroll() {
            if (!relative.current || !input.current) return
            const y = relative.current?.getBoundingClientRect().y || input.current?.getBoundingClientRect().y
            setInputFixed(y <= 16)
        }
        document.addEventListener("keydown", handleKeyDown)
        window.addEventListener("scroll", handleScroll)

        input.current?.focus()

        const wiki_req = fetch(`/schema/wiki.json`)
            .then(res => {
                if (!res.ok) {
                    console.warn("Warning: /schema/wiki.json not found. You cannot get the metadata from wiki.");
                    return [];
                }
                return res.json();
            })
            .catch(err => {
                console.warn("Warning: failed to fetch /schema/wiki.json.", err);
                return [];
            });

        fetch(`/schema/metadata.json`)
            .then(res => res.json())
            .then((docs_raw_data: Item[]) => {
                const data = docs_raw_data.map(initItem)
                const idMap = new Map<string, number>()
                data.forEach((item, index) => {
                    if (item.id) idMap.set(item.id, index)
                })
                wiki_req.then((wiki_raw_data: Item[]) => {
                    wiki_raw_data.forEach((item) => {
                        if (item.id && idMap.has(item.id)) {
                            const mainItem = data[idMap.get(item.id)!]
                            if (mainItem.type === 'test' && mainItem.data.filetype === 'pdf') {
                                mainItem.data.wiki = {
                                    url: item.url,
                                    data: item.data as WikiTest
                                }
                            }
                        } else {
                            data.push(initItem(item))
                        }
                    })
                    setLoading(false)
                    setDocsData(data)
                })
            })
        return () => {
            document.removeEventListener("keydown", handleKeyDown)
            window.removeEventListener("scroll", handleScroll)
        }
    }, [])

    useEffect(() => {
        fetch("https://blog.byrdocs.org/feed.json")
            .then(res => res.json())
            .then(data => {
                const pages = data?.items
                    ?.filter((item: any) => item && item?.tags?.includes("主站公告") && item.title && item.summary)
                    ?.sort((a: any, b: any) => new Date(b.date_modified).getTime() - new Date(a.date_modified).getTime())
                setAnnouncements(pages)
            })
    }, [])

    useEffect(() => {
        if (!top && q) {
            setTop(true)
        }
        setKeyword(q)
        setSearching(true)
    }, [])

    const LoadedIndicator = () => {
        useEffect(() => {
            setSuspenseLoading(false);
            return () => {
                setSuspenseLoading(true);
            };
        }, []);
        return null;
    };

    return (
        <SidebarProvider open={desktopPreview !== ""} className="h-full" >
            <div className={cn("flex flex-col w-full my-auto", {
                    "h-full": top,
                })}>
                <div className={cn(
                    "md:w-[800px] w-full md:mx-auto px-5 flex flex-col"
                )}>
                    <div className={cn(
                        "w-full",
                        {
                            "pb-24": !top
                        }
                    )}>
                        <div className={cn(
                            "w-full m-auto",
                            {
                                "h-12 mb-8 md:mb-12": !top,
                                "h-8 xl:h-0 my-4 sm:my-6 md:my-8": top,
                            }
                        )}
                            onClick={reset}
                        >
                            <Logo size={top ? 0 : 2} confetti={!top} className={cn({ "block xl:hidden": top })} />
                        </div>
                        <div className={cn("h-12 md:h-14", { "hidden": !inputFixed })} ref={relative}></div>
                        <div className={cn(
                            "z-20 transition-shadow duration-200",
                            {
                                "fixed top-0 left-0 w-full py-4 bg-background shadow-md": inputFixed,
                                "w-[60vw]": inputFixed && desktopPreview !== "",
                                "md:w-[800px] max-w-full md:m-auto": !inputFixed,
                            }
                        )}>
                            <div className={cn(
                                {
                                    "md:w-[800px] max-w-full md:m-auto px-5": inputFixed
                                }
                            )}>
                                <div className="relative">
                                    {top && desktopPreview === "" && (<div className="hidden xl:block absolute left-3 transform -translate-x-[240px] translate-y-[3px]" onClick={reset}>
                                        <Logo size={0} />
                                    </div>)}

                                    <div className="absolute left-[15px] top-1/2 transform -translate-y-1/2 w-6 h-6 text-muted-foreground">
                                        {top && suspenseLoading || loading || debouncing || miniSearching ?
                                            <svg className="animate-spin text-gray-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                            </svg> :
                                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor">
                                                <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
                                            </svg>}
                                    </div>
                                    <Input
                                        className={cn(
                                            "pl-12 h-12 md:h-14 text-lg hover:shadow-lg shadow-md focus-visible:ring-0 dark:ring-1",
                                            {
                                                "pr-12": showClear,
                                            }
                                        )}
                                        placeholder="搜索书籍、试卷和资料..."
                                        value={keyword}
                                        onInput={e => {
                                            const value = e.currentTarget.value
                                            setKeyword(value)
                                            updateQeury(new URLSearchParams({ q: value, c: active }))
                                            setTop(true)
                                            setSearching(!!value)
                                            setShowClear(!!value)
                                        }}
                                        ref={input}
                                    />
                                    {showClear && (
                                        <div className="absolute right-3 top-1/2 transform -translate-y-1/2 w-6 h-6  text-muted-foreground cursor-pointer" onClick={() => {
                                            input.current?.focus()
                                            setShowClear(false)
                                            setSearching(false)
                                            setKeyword("")
                                            setQuery(new URLSearchParams())
                                        }}>
                                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor">
                                                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                                            </svg>
                                        </div>)}


                                    {!top && announcements && announcements.length !== 0 &&
                                        <div className="absolute w-full -bottom-8 translate-y-full space-y-2 max-h-[40vh] overflow-scroll pb-8 no-scrollbar">
                                            {announcements.map((announcement) => (
                                                <div
                                                    className="p-4 w-full rounded-lg border border-gray-400 dark:border-gray-900 text-gray-600 dark:text-gray-500 hover:dark:border-gray-800 shadow-xs hover:shadow-md transition-all cursor-pointer group"
                                                    onClick={(e) => {
                                                        if ((e.target as HTMLElement).tagName === "A" && !(e.target as HTMLElement).classList.contains("title-link")) return
                                                        window.open(announcement.url)
                                                    }}
                                                    key={announcement.id}
                                                >
                                                    <h2 className="mb-1 group-hover:underline underline-offset-4 decoration-1 text-base font-bold tracking-tight text-[color:var(--vp-c-brand-light)] dark:text-[color:var(--vp-c-brand-dark)]">
                                                        <a className="title-link">{announcement.title}</a>
                                                    </h2>
                                                    <p className="font-light text-sm [&_a]:text-primary/80 hover:[&_a]:underline"
                                                        dangerouslySetInnerHTML={{
                                                            __html: announcement.summary
                                                        }} />
                                                    <div className="flex justify-between items-center">
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    }
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
                {top && (
                    <>
                        <div className="w-full left-0 border-b-[0.5px] border-muted-foreground pb-0 mx-auto">
                            <div className="md:w-[800px] max-w-full md:m-auto px-5">
                                <div className="flex mt-2 md:mt-4 text-2xl font-light">
                                    <div className="flex items-center mx-auto space-x-4 md:space-x-8 ">
                                        <TabList onSelect={select => {
                                            setActive(select as CategoryType)
                                            setQuery(new URLSearchParams({ c: select, q: keyword }))
                                        }} active={active}>
                                            <TabItem value="book"><b>书籍</b></TabItem>
                                            <TabItem value="test"><b>试卷</b></TabItem>
                                            <TabItem value="doc"><b>资料</b></TabItem>
                                        </TabList>
                                    </div>
                                    <div className="items-end hidden md:block py-1">
                                        <button
                                            className={cn(
                                                "h-full px-1 text-xs hover:bg-muted/60 active:bg-muted/40 transition-colors rounded-md",
                                                {
                                                    "text-muted-foreground": showSigma,
                                                    "text-muted-foreground/40": !showSigma,
                                                }
                                            )}
                                            onClick={() => {
                                                setShowSigma(!showSigma)
                                            }}
                                        >
                                            <ChartLine size={16} />
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                        <Suspense fallback={<EmptySearchList />}>
                            <LoadedIndicator />
                            <SearchList
                                documents={docsData}
                                keyword={debouncedKeyword}
                                debounceing={debouncing}
                                category={active}
                                loading={loading}
                                searching={searching}
                                showSigma={showSigma}
                                onPreview={url => {
                                    if (isMobile) {
                                        setPreview(url)
                                    } else {
                                        setDesktopPreview(url)
                                        onLayoutPreview(true)
                                    }
                                }}
                                onSearching={(searching) => {
                                    setMiniSearching(searching)
                                }}
                            />
                        </Suspense>
                    </>
                )}
                <Drawer open={preview !== ""} onClose={() => setPreview("")}>
                    <DrawerContent>
                        <DrawerTitle></DrawerTitle>
                        <div className="md:h-[85vh] h-[70vh]">
                            <iframe
                                src={
                                    preview.startsWith("/files") ?
                                        `/pdf-viewer/web/viewer.html?file=${encodeURIComponent(preview)}` :
                                        preview
                                }
                                className="w-full h-full"
                            />
                        </div>
                    </DrawerContent>
                </Drawer>
            </div>
            <Sidebar side="right" className="z-30">
                {desktopPreview !== "" && (
                    <div className="absolute top-0 left-0 h-[33px] flex justify-center items-center -translate-x-full bg-[#f9f9fa] dark:bg-[#38383d] dark:border-[#0c0c0d] rounded-bl-md border-[#b8b8b8] border-[1px] border-r-0 border-t-0">
                        <StepForward strokeWidth={1} className="w-6 h-6 mx-1 cursor-pointer" onClick={() => {
                            setDesktopPreview("")
                            onLayoutPreview(false)
                        }} />
                        <div className="block w-0 h-[70%]" style={{
                            borderLeft: "1px solid rgb(0 0 0 / 0.3)",
                            boxSizing: "border-box",
                            marginInline: "2px"
                        }}>

                        </div>
                    </div>
                )}
                <SidebarContent>
                    <iframe
                        src={
                            desktopPreview.startsWith("/files") ?
                                `/pdf-viewer/web/viewer.html?file=${encodeURIComponent(desktopPreview)}` :
                                desktopPreview
                        }
                        className="w-full h-full"
                    />
                </SidebarContent>
            </Sidebar>
        </SidebarProvider>
    )
}
