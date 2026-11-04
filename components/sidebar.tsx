"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ExternalLink, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { useSearch } from "./search";
import { ModeToggle } from "./mode-toggle";

export type MenuEntry =
  | { kind: "section"; title: string; slug: string; icon: React.ReactNode; count: number; depth: number }
  | { kind: "separator"; label: string };

interface Props {
  siteName: string;
  siteIcon: React.ReactNode;
  items: MenuEntry[];
  links: { title: string; href: string }[];
}

export function Sidebar({ siteName, siteIcon, items, links }: Props) {
  const pathname = usePathname();
  const { open } = useSearch();
  const sections = items.flatMap((i) => (i.kind === "section" ? [i] : []));
  const current = decodeURIComponent(pathname).split("/")[1];

  return (
    <>
      {/* mobile top bar */}
      <header className="shrink-0 border-b lg:hidden">
        <div className="flex h-12 items-center justify-between px-4">
          <Link href="/" className="flex items-center gap-2 font-semibold">
            {siteIcon} {siteName}
          </Link>
          <div className="flex items-center gap-3">
            <button onClick={open} aria-label="Search"><Search className="size-5" /></button>
            <ModeToggle side="bottom" />
          </div>
        </div>
        <nav className="flex gap-2 overflow-x-auto px-4 pb-2">
          {sections.map((s) => (
            <Link
              key={s.slug}
              href={`/${s.slug}`}
              className={cn(
                "shrink-0 rounded-full border px-3 py-1 text-sm",
                current === s.slug ? "bg-accent text-accent-foreground" : "text-muted-foreground",
              )}
            >
              {s.title} <span className="opacity-60">{s.count}</span>
            </Link>
          ))}
        </nav>
      </header>

      {/* desktop sidebar */}
      <aside className="hidden w-60 shrink-0 flex-col border-r bg-sidebar text-sidebar-foreground lg:flex xl:w-64">
        <Link href="/" className="flex h-16 items-center gap-3 px-6 text-lg font-semibold">
          {siteIcon} {siteName}
        </Link>
        <div className="flex-1 overflow-y-auto px-3">
          <nav className="space-y-0.5">
            {items.map((s, i) =>
              s.kind === "separator" ? (
                s.label ? (
                  <div key={`sep-${i}`} className="px-3 pb-1 pt-4 text-xs font-medium uppercase tracking-wide text-muted-foreground/70">{s.label}</div>
                ) : (
                  <div key={`sep-${i}`} className="mx-3 my-2 border-t" />
                )
              ) : (
              <Link
                key={s.slug}
                href={`/${s.slug}`}
                style={s.depth ? { marginLeft: s.depth * 14 } : undefined}
                className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors hover:bg-accent/60",
                  s.depth > 0 && "border-l border-border rounded-l-none pl-3",
                  current === s.slug ? "bg-accent font-medium text-accent-foreground" : "text-muted-foreground",
                )}
              >
                {s.icon}
                <span className="flex-1">{s.title}</span>
                <span className="text-xs tabular-nums">{s.count}</span>
              </Link>
              ),
            )}
          </nav>
          {links.length > 0 && (
            <nav className="mt-4 space-y-0.5 border-t pt-4">
              {links.map((l) => (
                <a
                  key={l.href}
                  href={l.href}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-muted-foreground hover:bg-accent/60"
                >
                  <ExternalLink className="size-4" /> {l.title}
                </a>
              ))}
            </nav>
          )}
        </div>
        <div className="flex items-center gap-2 p-3">
        <button
          onClick={open}
          className="flex min-w-0 flex-1 items-center gap-2 rounded-lg border px-3 h-9 text-sm text-muted-foreground hover:bg-accent/60"
        >
          <Search className="size-4" /> Search
          <kbd className="ml-auto rounded border px-1.5 text-[10px]">Ctrl K</kbd>
        </button>
          <ModeToggle />
        </div>
      </aside>
    </>
  );
}
