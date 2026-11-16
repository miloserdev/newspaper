import type { Options, SearchOptions } from "minisearch";

// light stemming for Cyrillic terms, so Russian content stays searchable
const CYR = /[а-я]/;
export const normTerm = (t: string) => {
  t = t.toLowerCase().replace(/ё/g, "е");
  if (CYR.test(t)) {
    if (t.length > 5) return t.slice(0, -2);
    if (t.length > 4) return t.slice(0, -1);
  }
  return t;
};

export interface IndexedDoc {
  id: string;
  title: string;
  description: string;
  /** indexed: tags joined by space */
  tags: string;
  /** indexed: the full plain text */
  text: string;
  /** stored for results: */
  href: string;
  section: string;
  tagList: string[];
  preview: string;
}

/** Same options for building the index (server) and loading it (browser) */
export const indexOptions: Options<IndexedDoc> = {
  fields: ["title", "description", "tags", "text"],
  storeFields: ["title", "href", "section", "tagList", "preview", "description"],
  idField: "id",
  processTerm: normTerm,
};

export const queryOptions: SearchOptions = {
  prefix: true,
  fuzzy: (t: string) => (t.length > 4 ? 0.2 : false),
  combineWith: "AND",
  boost: { title: 4, tags: 2.5, description: 1.5 },
};

export const PREVIEW_CHARS = 4000;

export function makeSnippet(preview: string, description: string, query: string) {
  const lower = preview.toLowerCase().replace(/ё/g, "е");
  for (const w of query.toLowerCase().split(/\s+/).filter(Boolean)) {
    const stem = normTerm(w);
    const i = lower.indexOf(stem.length >= 3 ? stem : w);
    if (i >= 0) {
      const s = Math.max(0, i - 50);
      return (s > 0 ? "…" : "") + preview.slice(s, i + 110) + "…";
    }
  }
  return description || preview.slice(0, 160);
}
