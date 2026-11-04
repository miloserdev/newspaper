import "server-only";
import { findAsset, findDocByName } from "./content";

const enc = (p: string) => p.split("/").map(encodeURIComponent).join("/");

/** Obsidian syntax → plain markdown: ![[img]] and [[wikilink]] */
export function preprocess(md: string): string {
  return md
    .split(/(```[\s\S]*?```)/g)
    .map((part, i) => {
      if (i % 2) return part;
      return part
        // <NewsList /> → <NewsList></NewsList>: HTML has no self-closing custom tags
        .replace(/<NewsList([^>]*?)\s*\/>/g, "\n\n<NewsList$1>\n</NewsList>\n\n")
        .replace(/!\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g, (m, name: string, alias?: string) => {
          const rel = findAsset(name);
          if (!rel) return m;
          const alt = alias && !/^\d+(x\d+)?$/.test(alias) ? alias : "";
          return `![${alt}](/files/${enc(rel)})`;
        })
        .replace(/\[\[([^\]|#]+)(?:#[^\]|]*)?(?:\|([^\]]+))?\]\]/g, (_m, name: string, alias?: string) => {
          const doc = findDocByName(name);
          const label = alias ?? name;
          return doc ? `[${label}](${doc.href})` : label;
        });
    })
    .join("");
}
