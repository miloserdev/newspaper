import "server-only";
import MiniSearch from "minisearch";
import { getDocs } from "./content";
import { indexOptions, PREVIEW_CHARS, type IndexedDoc } from "./search-shared";

let cache: { sig: string; json: string } | null = null;

/** Serialized MiniSearch index of all posts (rebuilt only when files change) */
export function buildSearchIndex(): string {
  const docs = getDocs();
  const sig = docs.map((d) => d.id + d.updated).join("|");
  if (cache?.sig === sig) return cache.json;
  const ms = new MiniSearch<IndexedDoc>(indexOptions);
  ms.addAll(
    docs.map((d) => ({
      id: d.id,
      title: d.title,
      description: d.description,
      tags: d.tags.join(" "),
      text: d.text,
      href: d.href,
      section: d.sectionTitle,
      tagList: d.tags,
      preview: d.text.slice(0, PREVIEW_CHARS),
    })),
  );
  cache = { sig, json: JSON.stringify(ms) };
  return cache.json;
}
