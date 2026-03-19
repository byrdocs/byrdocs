import { createContext, useContext, type ReactNode } from "react";

import type { Item } from "./types";
import type { SearchSnapshot } from "./lib/search-snapshot";

export type SsrBootstrap = {
    initialDocuments?: Item[];
    initialSearchSnapshot?: SearchSnapshot | null;
};

const SsrContext = createContext<SsrBootstrap>({});

export function SsrProvider({
    children,
    value,
}: {
    children: ReactNode;
    value?: SsrBootstrap;
}) {
    return <SsrContext.Provider value={value ?? {}}>{children}</SsrContext.Provider>;
}

export function useSsrBootstrap() {
    return useContext(SsrContext);
}

declare global {
    interface Window {
        __BYRDOCS_SSR__?: SsrBootstrap;
    }
}

export function readSsrBootstrap() {
    if (typeof window === "undefined") return {};
    return window.__BYRDOCS_SSR__ ?? {};
}
