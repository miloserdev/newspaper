"use client";

import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { SearchButton } from "./search";
import { InfiniteItems, type FeedItem, type FeedScope } from "./infinite-items";

export type { FeedItem, FeedScope };

interface Props {
  title: string;
  description?: string;
  scope: FeedScope;
  initial: FeedItem[];
  total: number;
}

export function Feed({ title, description, scope, initial, total }: Props) {
  const pathname = decodeURIComponent(usePathname());
  const parts = pathname.split("/").filter(Boolean);
  const articleOpen = parts[0] !== "tag" && parts.length >= 2;

  return (
    <section
      className={cn(
        "min-h-0 w-full shrink-0 flex-col border-r lg:flex lg:w-[340px] xl:w-[400px]",
        articleOpen ? "hidden" : "flex",
      )}
    >
      <div className="flex h-16 shrink-0 items-center justify-between px-6">
        <div className="min-w-0">
          <h1 className="truncate text-lg font-medium leading-tight">{title}</h1>
          {description && <p className="truncate text-xs text-muted-foreground">{description}</p>}
        </div>
        <SearchButton className="text-muted-foreground hover:text-foreground" />
      </div>
      <div className="flex-1 overflow-y-auto px-3 pb-6">
        {/* key: the list restarts when the section or the set of files changes */}
        <InfiniteItems key={`${scope.section}|${scope.tag}|${total}|${initial[0]?.href}`} scope={scope} initial={initial} total={total} />
      </div>
    </section>
  );
}
