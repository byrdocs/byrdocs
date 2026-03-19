import { renderToString } from "react-dom/server";
import { StaticRouter } from "react-router-dom";

import { ThemeProvider } from "./components/theme-provider";
import { Toaster } from "./components/ui/sonner";
import Home from "./pages/Home";
import { SsrProvider, type SsrBootstrap } from "./ssr-context";

export function renderHomePage(url: string, bootstrap: SsrBootstrap = {}) {
    return renderToString(
        <SsrProvider value={bootstrap}>
            <ThemeProvider defaultTheme="system">
                <StaticRouter location={url}>
                    <Home />
                </StaticRouter>
                <Toaster position="bottom-center" richColors={true} />
            </ThemeProvider>
        </SsrProvider>,
    );
}
