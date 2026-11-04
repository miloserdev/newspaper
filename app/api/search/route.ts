import MiniSearch from "minisearch";
import { getDocs, type Doc } from "@/lib/content";

export const dynamic = "force-dynamic";

// light stemming for Cyrillic terms, so Russian content stays searchable
const CYR = /[а-я]/;
const norm = (t: string) => {
  t = t.toLowerCase().replace(/ё/g, "е");
  if (CYR.test(t)) {
    if (t.length > 5) return t.slice(0, -2);
    if (t.length > 4) return t.slice(0, -1);
  }
  return t;
};

let cache: { sig: string; ms: MiniSearch; byId: Map<string, Doc> } | null = null;

function index() {
  const docs = getDocs();
  const sig = docs.map((d) => d.id + d.updated).join("|");
  if (cache?.sig === sig) return cache;
  const ms = new MiniSearch({
    fields: ["title", "description", "tags", "text"],
    idField: "id",
    processTerm: norm,
  });
  ms.addAll(
    docs.map((d) => ({
      id: d.id,
      title: d.title,
      description: d.description,
      tags: d.tags.join(" "),
      text: d.text,
    })),
  );
  cache = { sig, ms, byId: new Map(docs.map((d) => [d.id, d])) };
  return cache;
}

function snippet(d: Doc, words: string[]) {
  const lower = d.text.toLowerCase().replace(/ё/g, "е");
  for (const w of words) {
    const stem = norm(w);
    const i = lower.indexOf(stem.length >= 3 ? stem : w);
    if (i >= 0) {
      const s = Math.max(0, i - 50);
      return (s > 0 ? "…" : "") + d.text.slice(s, i + 110) + "…";
    }
  }
  return d.description || d.excerpt;
}

export async function GET(req: Request) {
  const q = new URL(req.url).searchParams.get("q")?.trim() ?? "";
  if (!q) return Response.json({ results: [] });
  const { ms, byId } = index();
  const words = q.toLowerCase().split(/\s+/).filter(Boolean);
  const hits = ms
    .search(q, {
      prefix: true,
      fuzzy: (t) => (t.length > 4 ? 0.2 : false),
      combineWith: "AND",
      boost: { title: 4, tags: 2.5, description: 1.5 },
    })
    .slice(0, 20);
  const results = hits.flatMap((h) => {
    const d = byId.get(h.id);
    return d
      ? [{ title: d.title, href: d.href, section: d.sectionTitle, tags: d.tags, snippet: snippet(d, words) }]
      : [];
  });
  return Response.json({ results });
}
