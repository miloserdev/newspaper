"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { AlignLeft } from "lucide-react";
import { cn } from "@/lib/utils";

interface Item {
  id: string;
  text: string;
  depth: number; // 0 = h1/h2 level (they share one level, like fumadocs), 1 = h3, 2 = h4
  el: HTMLElement;
}

interface Geometry {
  d: string;
  width: number;
  height: number;
  rows: { top: number; bottom: number }[];
}

const TEXT_STEP = 12; // text indent per heading level
const LINE_STEP = 8; // the track shifts less than the text, so deeper rows get a little more air (and the line never wanders far right)
const PAD = 12; // text offset from the track line
const INSET = 6; // a row's track segment starts/ends this far inside the row; the gap between rows becomes the diagonal

const xOf = (depth: number) => 1 + depth * LINE_STEP;

function scan(): Item[] {
  const els = [...document.querySelectorAll<HTMLElement>("article .prose :is(h1, h2, h3, h4)[id]")];
  // h1 and h2 sit on the same level; only h3 and h4 go deeper. A page that starts at h3 is shifted back to 0.
  const level = (el: HTMLElement) => Math.max(0, Number(el.tagName[1]) - 2);
  const base = Math.min(...els.map(level));
  return els.map((el) => ({
    id: el.id,
    text: el.textContent?.trim() ?? "",
    depth: level(el) - base,
    el,
  }));
}

/** Headings whose section overlaps the visible part of the reader are "active" (the thumb spans all of them) */
function useScrollSpy(items: Item[]) {
  const [active, setActive] = useState<string[]>([]);
  useEffect(() => {
    if (!items.length) return;
    const scroller = items[0].el.closest("article");
    if (!scroller) return;
    let raf = 0;
    const update = () => {
      raf = 0;
      const box = scroller.getBoundingClientRect();
      const bandTop = box.top + 8;
      // The active band normally covers the upper 70% of the reader. Over the last viewport of scrolling it grows to the
      // full height, so the final (short) sections can become active and the thumb reaches the end of the outline.
      const remaining = scroller.scrollHeight - scroller.clientHeight - scroller.scrollTop;
      const toEnd = Math.min(1, Math.max(0, 1 - remaining / box.height));
      const bandBottom = box.top + box.height * (0.7 + 0.3 * toEnd);
      const prose = items[0].el.closest(".prose");
      const end = prose ? prose.getBoundingClientRect().bottom : bandBottom;
      const ids = items
        .filter((it, i) => {
          const top = it.el.getBoundingClientRect().top;
          const next = items[i + 1] ? items[i + 1].el.getBoundingClientRect().top : end;
          return top < bandBottom && next > bandTop;
        })
        .map((it) => it.id);
      // above the first heading: highlight the first one
      setActive((prev) => {
        const nextIds = ids.length ? ids : [items[0].id];
        return prev.length === nextIds.length && prev.every((x, i) => x === nextIds[i]) ? prev : nextIds;
      });
    };
    const onScroll = () => { if (!raf) raf = requestAnimationFrame(update); };
    update();
    scroller.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      scroller.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      if (raf) cancelAnimationFrame(raf);
    };
  }, [items]);
  return active;
}

function go(item: Item) {
  item.el.scrollIntoView({ behavior: "smooth", block: "start" });
}

/** Clerk-style "On this page": a track line that bends with heading depth and a thumb sliding over the visible sections */
export function Toc({ variant = "aside", color }: { variant?: "aside" | "inline"; color?: string }) {
  const [items, setItems] = useState<Item[]>([]);
  // headings are rendered by the server markdown; read them from the DOM once mounted
  useEffect(() => {
    const raf = requestAnimationFrame(() => setItems(scan()));
    return () => cancelAnimationFrame(raf);
  }, []);

  if (items.length < 2) return null;
  return variant === "inline" ? <InlineToc items={items} /> : <AsideToc items={items} color={color} />;
}

function AsideToc({ items, color }: { items: Item[]; color?: string }) {
  const active = useScrollSpy(items);
  const listRef = useRef<HTMLUListElement>(null);
  const areaRef = useRef<HTMLDivElement>(null);
  const [geo, setGeo] = useState<Geometry | null>(null);

  const measure = useCallback(() => {
    const list = listRef.current;
    if (!list) return;
    const rows = [...list.querySelectorAll<HTMLElement>("[data-toc-row]")].map((a) => ({
      top: a.offsetTop,
      bottom: a.offsetTop + a.offsetHeight,
    }));
    // each row owns a vertical segment; between rows the line either continues straight or bends in a smooth S-curve
    let d = "";
    let prev: { x: number; y: number } | null = null;
    items.forEach((it, i) => {
      const x = xOf(it.depth);
      const top = rows[i].top + INSET;
      const bottom = rows[i].bottom - INSET;
      if (!prev) d += `M${x} ${top}`;
      else if (prev.x === x) d += ` L${x} ${top}`;
      else {
        const mid = (prev.y + top) / 2;
        d += ` C${prev.x} ${mid} ${x} ${mid} ${x} ${top}`;
      }
      d += ` L${x} ${bottom}`;
      prev = { x, y: bottom };
    });
    setGeo({ d, width: 3 + Math.max(...items.map((i) => i.depth)) * LINE_STEP, height: list.offsetHeight, rows });
  }, [items]);

  useLayoutEffect(() => {
    measure();
    const list = listRef.current;
    if (!list) return;
    const ro = new ResizeObserver(measure);
    ro.observe(list);
    return () => ro.disconnect();
  }, [measure]);

  // like fumadocs: the (scrollbar-less) outline follows the page by centering the first active row, smoothly
  const mounted = useRef(false);
  useEffect(() => {
    const area = areaRef.current;
    const row = active.length ? listRef.current?.querySelector<HTMLElement>(`[href="#${CSS.escape(active[0])}"]`) : null;
    if (!area || !row) return;
    const top = row.offsetTop - area.clientHeight / 2 + row.offsetHeight / 2;
    area.scrollTo({ top: Math.max(0, top), behavior: mounted.current ? "smooth" : "instant" });
    mounted.current = true;
  }, [active]);

  // thumb = clip of the highlighted path between the first and last active row
  // The thumb starts and ends exactly at the ends of the first/last active row's segment (never inside a neighbouring
  // heading) and finishes with a dot.
  let clip: string | undefined;
  let dot: { x: number; y: number } | null = null;
  if (geo && active.length) {
    const idx = active.map((id) => items.findIndex((i) => i.id === id)).filter((i) => i >= 0);
    const top = Math.min(...idx.map((i) => geo.rows[i].top)) + INSET;
    const lastIdx = Math.max(...idx);
    const bottom = geo.rows[lastIdx].bottom - INSET;
    clip = `inset(${top}px 0 ${Math.max(0, geo.height - bottom)}px 0)`;
    dot = { x: xOf(items[lastIdx].depth) + 0.5, y: bottom };
  }

  return (
    <nav
      aria-label="On this page"
      className="flex min-h-0 flex-1 flex-col text-sm"
      // accent = the section's `color` from meta.json (falls back to the foreground color)
      style={{ "--toc-accent": color || "var(--foreground)" } as React.CSSProperties}
    >
      <div className="flex items-center gap-2 text-muted-foreground">
        <AlignLeft className="size-4" strokeWidth={1.5} /> On this page
      </div>
      <div
        ref={areaRef}
        // scrollable but with no scrollbar; both edges fade out (same recipe as fumadocs / shadcn)
        className="relative mt-1 min-h-0 overflow-y-auto overscroll-contain py-3 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        style={{
          maskImage: "linear-gradient(to bottom, transparent, black 16px, black calc(100% - 16px), transparent)",
          WebkitMaskImage: "linear-gradient(to bottom, transparent, black 16px, black calc(100% - 16px), transparent)",
        }}
      >
        <div className="relative">
        {geo && (
          <>
            <svg className="pointer-events-none absolute left-0 top-0 text-foreground/15" width={geo.width} height={geo.height} aria-hidden>
              <path d={geo.d} fill="none" stroke="currentColor" strokeWidth={1} />
            </svg>
            <svg
              className="pointer-events-none absolute left-0 top-0 transition-[clip-path] duration-300 ease-out"
              width={geo.width}
              height={geo.height}
              style={{ clipPath: clip, color: "var(--toc-accent)" }}
              aria-hidden
            >
              <path d={geo.d} fill="none" stroke="currentColor" strokeWidth={1.5} />
            </svg>
            {dot && (
              <span
                aria-hidden
                className="pointer-events-none absolute left-0 top-0 size-[5px] rounded-full transition-transform duration-300 ease-out"
                style={{ background: "var(--toc-accent)", transform: `translate(${dot.x - 2.5}px, ${dot.y - 2.5}px)` }}
              />
            )}
          </>
        )}
        <ul ref={listRef} className="relative">
          {items.map((it) => (
            <li key={it.id}>
              <a
                data-toc-row
                href={`#${it.id}`}
                onClick={(e) => { e.preventDefault(); go(it); }}
                style={{
                  paddingLeft: PAD + it.depth * TEXT_STEP,
                  color: active.includes(it.id) ? "var(--toc-accent)" : undefined,
                }}
                className={cn(
                  "block py-1.5 pr-1 leading-snug transition-colors",
                  !active.includes(it.id) && "text-muted-foreground hover:text-foreground",
                )}
              >
                {it.text}
              </a>
            </li>
          ))}
        </ul>
        </div>
      </div>
    </nav>
  );
}

function InlineToc({ items }: { items: Item[] }) {
  return (
    <details className="group mt-6 rounded-lg border px-4 py-3 text-sm min-[1700px]:hidden">
      <summary className="flex cursor-pointer list-none items-center gap-2 font-medium">
        <AlignLeft className="size-4" /> On this page
      </summary>
      <ul className="mt-2 space-y-1 border-l pl-3">
        {items.map((it) => (
          <li key={it.id} style={{ paddingLeft: it.depth * TEXT_STEP }}>
            <a
              href={`#${it.id}`}
              onClick={(e) => { e.preventDefault(); go(it); }}
              className="block py-0.5 text-muted-foreground hover:text-foreground"
            >
              {it.text}
            </a>
          </li>
        ))}
      </ul>
    </details>
  );
}
