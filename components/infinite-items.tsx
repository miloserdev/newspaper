"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

export interface FeedItem {
  href: string;
  title: string;
  description: string;
  dateLabel: string;
  folder: string;
  tags: string[];
}

export interface FeedScope {
  section?: string;
  tag?: string;
}

/** Post list: the first page comes from the server, the rest load on scroll */
export function InfiniteItems({
  scope,
  initial,
  total,
  className,
}: {
  scope: FeedScope;
  initial: FeedItem[];
  total: number;
  className?: string;
}) {
  const pathname = decodeURIComponent(usePathname());
  const [items, setItems] = useState(initial);
  const [loading, setLoading] = useState(false);
  const busy = useRef(false);
  const sentinel = useRef<HTMLDivElement>(null);
  const hasMore = items.length < total;

  const loadMore = useCallback(async () => {
    if (busy.current) return;
    busy.current = true;
    setLoading(true);
    try {
      const q = new URLSearchParams({ offset: String(items.length) });
      if (scope.section) q.set("section", scope.section);
      if (scope.tag) q.set("tag", scope.tag);
      const r = await fetch(`/api/feed?${q}`);
      const j: { items: FeedItem[] } = await r.json();
      setItems((prev) => [...prev, ...j.items.filter((n) => !prev.some((p) => p.href === n.href))]);
    } finally {
      busy.current = false;
      setLoading(false);
    }
  }, [items.length, scope.section, scope.tag]);

  useEffect(() => {
    const el = sentinel.current;
    if (!el || !hasMore) return;
    const io = new IntersectionObserver((e) => e[0].isIntersecting && loadMore(), { rootMargin: "400px" });
    io.observe(el);
    return () => io.disconnect();
  }, [hasMore, loadMore]);

  return (
    <div className={cn("space-y-1", className)}>
      {items.length === 0 && <p className="p-6 text-center text-sm text-muted-foreground">Nothing here yet</p>}
      {items.map((it) => (
        <Link
          key={it.href}
          href={it.href}
          className={cn(
            "block rounded-lg px-3 py-3 transition-colors hover:bg-accent/50",
            decodeURIComponent(it.href) === pathname && "bg-accent",
          )}
        >
          {it.folder && <div className="mb-0.5 truncate text-xs text-muted-foreground">{it.folder}</div>}
          <div className="flex items-baseline justify-between gap-3">
            <div className="line-clamp-2 text-sm font-medium">{it.title}</div>
            <time className="shrink-0 text-xs text-muted-foreground">{it.dateLabel}</time>
          </div>
          {it.description && <div className="mt-0.5 line-clamp-2 text-sm text-muted-foreground">{it.description}</div>}
        </Link>
      ))}
      {hasMore && (
        <div ref={sentinel} className="flex h-12 items-center justify-center text-muted-foreground">
          {loading && <Loader2 className="size-4 animate-spin" />}
        </div>
      )}
    </div>
  );
}
