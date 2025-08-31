import { ExternalLink } from "lucide-react";
import { Link } from "react-router-dom";
import { cn } from "./lib/utils";

const GITHUB_URL = "https://github.com/byrdocs/byrdocs-archive";
const BANNER_VIEW_KEY = "byrdocs_banner_views";
const MAX_VIEWS = 10;

export function Banner({ className }: { className?: string }) {
    let views = 0;
    if (typeof window !== "undefined") {
        views = parseInt(localStorage.getItem(BANNER_VIEW_KEY) || "0", 10);

        if (views < MAX_VIEWS) {
            localStorage.setItem(BANNER_VIEW_KEY, (views + 1).toString());
        } else {
            return null;
        }
    }

    return (
        <div className={cn("w-full text-sm bg-secondary text-muted-foreground flex flex-row flex-wrap justify-center py-2", className)}>
            <Link to={GITHUB_URL} target="_blank" className="text-primary/70 dark:text-primary hover:underline">
                如果 BYR Docs 有帮助，Star 我们的 GitHub 仓库！
            </Link>
            <div className="ml-1 flex items-center">
                <ExternalLink size={12} />
            </div>
        </div>
    );
}
