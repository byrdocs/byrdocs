import { createContext, useContext, useEffect } from "react"

type Theme = "dark" | "light" | "system"

type ThemeProviderProps = {
  children: React.ReactNode
  defaultTheme?: Theme
  storageKey?: string
}

type ThemeProviderState = {
  theme: Theme
  setTheme: (theme: Theme) => void
}

const initialState: ThemeProviderState = {
  theme: "system",
  setTheme: () => null,
}

const ThemeProviderContext = createContext<ThemeProviderState>(initialState)

export function ThemeProvider({
  children,
  ...props
}: ThemeProviderProps) {

  useEffect(() => {
    const root = window.document.documentElement

    function update() {
      const theme = window.matchMedia("(prefers-color-scheme: dark)")
      const systemTheme = theme.matches
        ? "dark"
        : "light"

      root.classList.remove("light", "dark")
      root.classList.add(systemTheme)
    }
    update()
    window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", update)
    return () => {
      window.matchMedia("(prefers-color-scheme: dark)").removeEventListener("change", update)
    }
  }, [])

  const value = {
    theme: "system" as Theme,
    setTheme: () => {},
  }

  return (
    <ThemeProviderContext.Provider {...props} value={value}>
      {children}
    </ThemeProviderContext.Provider>
  )
}

// eslint-disable-next-line react-refresh/only-export-components
export const useTheme = () => {
  const context = useContext(ThemeProviderContext)

  if (context === undefined)
    throw new Error("useTheme must be used within a ThemeProvider")

  return context
}
