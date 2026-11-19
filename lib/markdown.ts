import "server-only";
import path from "node:path";
import { findAsset, findDocByName, findDocByPath, type Doc } from "./content";

const enc = (p: string) => p.split("/").map(encodeURIComponent).join("/");

/** Obsidian syntax → plain markdown: ![[img]] and [[wikilink]] */
export function preprocess(md: string, doc?: Doc): string {
  return md
    .split(/(```[\s\S]*?```)/g)
    .map((part, i) => {
      if (i % 2) return part;
      return part
        // [text](../other/post.md#heading), [text](<../other/my post.md>) or [text](other-post) → link to that post
        // (relative to this file). Only targets that really resolve to a post are rewritten.
        .replace(
          /\]\((?:<([^>\n]+)>|([^)\s]+))(\s+"[^"]*")?\)/g,
          (m, angle: string | undefined, plain: string | undefined, title?: string) => {
            const full = angle ?? plain ?? "";
            if (!doc || /^([a-z][a-z0-9+.-]*:|[/#?])/i.test(full)) return m;
            const cut = full.search(/[#?]/);
            const target = cut < 0 ? full : full.slice(0, cut);
            const tail = cut < 0 ? "" : full.slice(cut);
            let rel: string;
            try {
              rel = path.posix.join(doc.relDir.split(path.sep).join("/"), decodeURIComponent(target));
            } catch {
              return m;
            }
            const hit = findDocByPath(rel);
            return hit ? `](${hit.href}${tail}${title ?? ""})` : m;
          },
        )
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
