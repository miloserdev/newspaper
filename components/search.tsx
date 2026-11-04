"use client";

import { createContext, useContext, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Search as SearchIcon, Loader2 } from "lucide-react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";

interface Result { title: string; href: string; section: string; tags: string[]; snippet: string }

const Ctx = createContext<{ open: () => void }>({ open: () => {} });
export const useSearch = () => useContext(Ctx);

export function SearchProvider({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [results, setResults] = useState<Result[]>([]);
  const [loading, setLoading] = useState(false);
  const [active, setActive] = useState(0);
  const router = useRouter();
  const seq = useRef(0);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    if (!q.trim()) return;
    const id = ++seq.current;
    const t = setTimeout(async () => {
      setLoading(true);
      try {
        const r = await fetch(`/api/search?q=${encodeURIComponent(q)}`);
        const j = await r.json();
        if (id === seq.current) {
          setResults(j.results);
          setActive(0);
        }
      } finally {
        if (id === seq.current) setLoading(false);
      }
    }, 150);
    return () => clearTimeout(t);
  }, [q]);

  const go = (r: Result) => {
    setOpen(false);
    router.push(r.href);
  };

  return (
    <Ctx.Provider value={{ open: () => setOpen(true) }}>
      {children}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent showCloseButton={false} className="top-[15%] translate-y-0 gap-0 p-0 sm:max-w-xl">
          <DialogTitle className="sr-only">Search</DialogTitle>
          <div className="flex items-center gap-2 border-b px-3">
            {loading ? (
              <Loader2 className="size-4 animate-spin text-muted-foreground" />
            ) : (
              <SearchIcon className="size-4 text-muted-foreground" />
            )}
            <Input
              autoFocus
              value={q}
              onChange={(e) => setQ(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "ArrowDown") { e.preventDefault(); setActive((a) => Math.min(a + 1, results.length - 1)); }
                if (e.key === "ArrowUp") { e.preventDefault(); setActive((a) => Math.max(a - 1, 0)); }
                if (e.key === "Enter" && results[active]) go(results[active]);
              }}
              placeholder="Search titles, tags and text…"
              className="h-12 border-0 bg-transparent px-0 shadow-none focus-visible:ring-0 dark:bg-transparent"
            />
          </div>
          <div className="max-h-[60vh] overflow-y-auto p-2">
            {q.trim() && !loading && results.length === 0 && (
              <p className="p-6 text-center text-sm text-muted-foreground">Nothing found</p>
            )}
            {!q.trim() && (
              <p className="p-6 text-center text-sm text-muted-foreground">Start typing to search</p>
            )}
            {(q.trim() ? results : []).map((r, i) => (
              <button
                key={r.href}
                onMouseEnter={() => setActive(i)}
                onClick={() => go(r)}
                className={`block w-full rounded-md px-3 py-2 text-left ${i === active ? "bg-accent" : ""}`}
              >
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <span>{r.section}</span>
                  {r.tags.slice(0, 3).map((t) => (
                    <Badge key={t} variant="secondary" className="h-4 px-1.5 text-[10px]">{t}</Badge>
                  ))}
                </div>
                <div className="text-sm font-medium">{r.title}</div>
                <div className="line-clamp-2 text-xs text-muted-foreground">{r.snippet}</div>
              </button>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </Ctx.Provider>
  );
}

export function SearchButton({ className }: { className?: string }) {
  const { open } = useSearch();
  return (
    <button onClick={open} aria-label="Search" className={className}>
      <SearchIcon className="size-5" />
    </button>
  );
}
