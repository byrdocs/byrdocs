import { useContext, useState, createContext, ReactNode, useRef, useEffect } from 'react'
import { cn } from "@/lib/utils"

import { Check, ChevronsUpDown } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { ChevronDownIcon, ChevronUpIcon } from '@radix-ui/react-icons'

interface MultiSelectProps {
  children: Array<ReactNode>;
  onChange: (selected: string[]) => void;
  selected: string[];
  className?: string;
  search?: boolean;
  single?: boolean;
  placeholder?: string;
}

const MultiSelectContext = createContext<{
  selected: string[]
  onSelect: (select: string, name: string) => void
}>({ selected: [], onSelect: () => { } });

function MultiSelectOption({ children, value }: {
  children: string;
  value: string;
}) {
  const { onSelect, selected } = useContext(MultiSelectContext);
  return (
    <CommandItem
      className='flex justify-between px-3 cursor-pointer'
      onSelect={() => onSelect(value, children)}
    >
      <span>{children}</span>
      <Check
        className={cn(
          "h-4 w-4",
          selected.includes(value) ? "opacity-100" : "opacity-0"
        )}
      />
    </CommandItem>
  )
}

function MultiSelect({ children, onChange, selected, className, search, placeholder, single, ...props }: MultiSelectProps) {
  const selectedName = useRef<Map<string, string>>(new Map())
  const rootRef = useRef<HTMLDivElement>(null);
  const [showChevronUp, setShowChevronUp] = useState(false);
  const [showChevronDown, setShowChevronDown] = useState(true);
  const commandListRef = useRef<HTMLDivElement>(null);
  const scrollIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const handleScroll = () => {
    if (commandListRef.current) {
      const scrollTop = commandListRef.current.scrollTop;
      const scrollHeight = commandListRef.current.scrollHeight;
      const clientHeight = commandListRef.current.clientHeight;
      if (scrollTop === 0 || scrollTop + clientHeight === scrollHeight) {
        stopScrolling();
      }
      setShowChevronUp(scrollTop > 0);
      setShowChevronDown(scrollTop + clientHeight < scrollHeight);
    }
  };

  const startScrolling = (direction: "up" | "down") => {
    if (commandListRef.current) {
      const scrollAmount = direction === "up" ? -1 : 1;

      scrollIntervalRef.current = setInterval(() => {
        if (commandListRef.current) {
          commandListRef.current.scrollTop += scrollAmount;
          handleScroll();
        }
      }, 1);
    }
  };

  const stopScrolling = () => {
    if (scrollIntervalRef.current) {
      clearInterval(scrollIntervalRef.current);
      scrollIntervalRef.current = null;
    }
  };

  const triggerRef = useRef<HTMLButtonElement>(null)

  const [open, setOpen] = useState(false)
  const [width, setWidth] = useState(0)

  useEffect(() => {
    const observer = new MutationObserver(() => {
      handleScroll()
    })
    observer.observe(document.body, { childList: true, subtree: true })
    return () => {
      observer.disconnect()
    }
  }, [open])

  return (
    <div ref={rootRef}>
      <Popover open={open} onOpenChange={(open) => {
        setOpen(open)
        if (open && triggerRef.current) {
          setWidth(triggerRef.current.offsetWidth)
        }
      }} {...props}>
        <PopoverTrigger asChild>
          <Button
            ref={triggerRef}
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className={cn(
              `w-full justify-between`,
              {
                'border-primary': selected.length !== 0
              }
            )}
            onClick={() => setOpen(!open)}
          >
            <div className='flex-1 text-left'>
              <span className={cn({
                "text-muted-foreground": selected.length === 0 || single !== true
              })}>
                {single === true && selected.length === 1 ? selected[0] : placeholder || "选择..."}
              </span>
            </div>
            {selected.length && single !== true ? <div className='text-gray-500 px-2 pb-[2px] hidden sm:block'>
              ({selected.length} 项)
            </div> : null}
            <ChevronsUpDown className="h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="p-0 z-10" style={{ width: `${width}px` }}>
          <Command className={className}>
            {search &&
              <CommandInput placeholder="搜索..." />
            }
            <div className='relative'>
              <div className='overflow-clip fixed h-4 w-[calc(100%-2px)] z-10'>
                <div className={cn(
                    'flex justify-center items-center h-4 rounded-md',
                    {
                      'bg-background': showChevronUp,
                      'bg-transparent border-t border-background': !showChevronUp
                    }
                  )}
                  onMouseEnter={() => startScrolling("up")}
                  onMouseLeave={stopScrolling}
                >
                  {showChevronUp && <ChevronUpIcon className="h-4 w-4" />}
                </div>
              </div>
              <CommandList>
                <CommandEmpty>空</CommandEmpty>
                <CommandGroup ref={commandListRef} onScroll={handleScroll} className='max-h-72 w-full overflow-auto no-scrollbar relative'>
                  <MultiSelectContext.Provider value={{
                    selected, onSelect: (select, name) => {
                      if (single === true) {
                        if (selected.includes(select)) onChange([])
                        else onChange([select])
                        setOpen(false)
                        setOpen(false)
                        return
                      }
                      const next = selected.includes(select)
                        ? selected.filter((item) => item !== select)
                        : [...selected, select]
                      selectedName.current.set(select, name)
                      onChange(next)
                      setOpen(true)
                    }
                  }}>
                    {children}
                  </MultiSelectContext.Provider>
                </CommandGroup>
              </CommandList>
              <div className='rounded-b-md overflow-clip fixed bottom-px h-4 w-[calc(100%-2px)]'>
                <div className={cn(
                    'flex justify-center items-center h-4',
                    {
                      'bg-background': showChevronDown,
                      'bg-transparent border-b border-background': !showChevronDown
                    }
                  )}
                  onMouseEnter={() => startScrolling("down")}
                  onMouseLeave={stopScrolling}
                >
                  {showChevronDown && <ChevronDownIcon className="h-4 w-4" />}
                </div>
              </div>
            </div>
          </Command>
        </PopoverContent>
      </Popover>
    </div>
  )
}

export { MultiSelect, MultiSelectOption }
