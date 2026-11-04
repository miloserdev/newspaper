import "server-only";
import fs from "node:fs";
import path from "node:path";
import matter from "gray-matter";
import { config } from "@/config";

export interface Section {
  title: string;
  description: string;
  slug: string;
  /** Section directory relative to contentDir */
  dir: string;
  /** Lucide icon name (PascalCase), as in fumadocs meta.json */
  icon: string;
  color: string;
  order: number;
  /** slug of the nearest parent section (menu tree) */
  parent: string | null;
  depth: number;
  /** `pages` from meta.json: order of children, "---" separators, "..." = the rest */
  pages: string[];
  /** Posts in the section itself and in all nested ones */
  count: number;
}

export type MenuItem =
  | { kind: "section"; section: Section }
  | { kind: "separator"; label: string; depth: number };

export interface Site {
  pages: string[];
  title: string;
  description: string;
  icon: string;
  color: string;
}

export interface Doc {
  id: string;
  section: string;
  sectionTitle: string;
  slug: string[];
  href: string;
  title: string;
  description: string;
  tags: string[];
  /** Publication date (frontmatter `date` or file creation time), ms */
  date: number;
  /** Last file edit time, ms */
  updated: number;
  image?: string;
  /** Subfolder inside the section */
  folder: string;
  /** File directory relative to contentDir (for relative links) */
  relDir: string;
  body: string;
  excerpt: string;
  text: string;
}

const ROOT = path.resolve(process.cwd(), config.contentDir);
const ASSET_EXT = /\.(png|jpe?g|gif|webp|svg|avif|pdf|mp4|webm)$/i;
const DOC_EXT = /\.mdx?$/i;

export const contentRoot = ROOT;

const fileCache = new Map<string, { mtimeMs: number; doc: Doc }>();
let snapshot: { at: number; docs: Doc[]; assets: Map<string, string>; sections: Section[]; menu: MenuItem[]; site: Site } | null = null;
const TTL = 1000;

function walk(dir: string, out: string[] = []): string[] {
  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return out;
  }
  for (const e of entries) {
    if (e.name.startsWith(".") || e.name === "node_modules") continue;
    const full = path.join(dir, e.name);
    if (e.isDirectory()) walk(full, out);
    else out.push(full);
  }
  return out;
}

export function toPlain(md: string): string {
  return md
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/`([^`]*)`/g, "$1")
    .replace(/!\[\[[^\]]*\]\]|!\[[^\]]*\]\([^)]*\)/g, " ")
    .replace(/\[\[([^\]|]+)\|([^\]]+)\]\]/g, "$2")
    .replace(/\[\[([^\]]+)\]\]/g, "$1")
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/<[^>]+>/g, " ")
    .replace(/^\s*[-*+]\s+\[[ xX]\]\s+/gm, "- ")
    .replace(/^\s{0,3}(#{1,6}|>|[-*+]|\d+\.)\s+/gm, "")
    .replace(/[*_~|]{1,3}/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

const asArray = (v: unknown): string[] =>
  Array.isArray(v)
    ? v.map(String)
    : typeof v === "string"
      ? v.split(/[,\s]+/).filter(Boolean)
      : [];

const asMs = (v: unknown): number | null => {
  if (v instanceof Date) return v.getTime();
  if (typeof v === "string" || typeof v === "number") {
    const t = new Date(v).getTime();
    return Number.isNaN(t) ? null : t;
  }
  return null;
};

/** gray-matter, and on invalid YAML a lenient `key: value` line parser, so one bad file can't take the site down */
function parseMatter(raw: string): { data: Record<string, unknown>; content: string } {
  try {
    // options={} disables gray-matter's internal cache (after a YAML error it returns an empty result)
    return matter(raw, {});
  } catch (e) {
    const m = raw.match(/^\uFEFF?---\r?\n([\s\S]*?)\r?\n---[ \t]*(?:\r?\n|$)/);
    if (!m) return { data: {}, content: raw };
    console.warn("[content] invalid frontmatter, parsed leniently:", (e as Error).message.split("\n")[0]);
    const data: Record<string, unknown> = {};
    for (const line of m[1].split(/\r?\n/)) {
      const kv = line.match(/^([\w$-]+):\s*(.*)$/);
      if (!kv) continue;
      const v = kv[2].trim().replace(/^(["'])(.*)\1$/, "$2");
      const list = v.match(/^\[(.*)\]$/);
      data[kv[1]] = list ? list[1].split(",").map((x) => x.trim().replace(/^["']|["']$/g, "")).filter(Boolean) : v;
    }
    return { data, content: raw.slice(m[0].length) };
  }
}

function parseFile(file: string, stat: fs.Stats, section: Section): Doc | null {
  const raw = fs.readFileSync(file, "utf8");
  const { data, content } = parseMatter(raw);
  if (data.draft === true && !config.showDrafts) return null;

  const rel = path.relative(path.resolve(ROOT, section.dir), file);
  const slug = rel.replace(DOC_EXT, "").split(path.sep).filter((x) => !/^\(.*\)$/.test(x));
  const baseName = slug[slug.length - 1];

  let body = /\.mdx$/i.test(file) ? content.replace(/^(import|export)\s.*$/gm, "") : content;
  let title = typeof data.title === "string" ? data.title : "";
  const h1 = body.match(/^\s*#\s+(.+?)\s*$/m);
  if (!title && h1 && body.trimStart().startsWith("#")) {
    title = h1[1];
  }
  // the title is rendered separately — drop the duplicate leading H1
  if (h1 && body.trimStart().startsWith("# ") && h1[1].trim() === (title || "").trim()) {
    body = body.replace(/^\s*#\s+.+\n?/, "");
  }
  if (!title) title = baseName;

  const text = toPlain(body);
  const created = stat.birthtimeMs > 0 ? stat.birthtimeMs : stat.mtimeMs;
  const date = asMs(data.date) ?? Math.min(created, stat.mtimeMs);

  return {
    id: `${section.slug}/${slug.join("/")}`,
    section: section.slug,
    sectionTitle: section.title,
    slug,
    href: `/${section.slug}/${slug.map(encodeURIComponent).join("/")}`,
    title,
    description:
      typeof data.description === "string" ? data.description : "",
    tags: asArray(data.tags),
    date,
    updated: stat.mtimeMs,
    image: [data.image, data.cover].find((x): x is string => typeof x === "string"),
    folder: slug.length > 1 ? slug.slice(0, -1).join(" / ") : "",
    relDir: path.relative(ROOT, path.dirname(file)),
    body,
    excerpt: text.slice(0, 220),
    text,
  };
}

function scan() {
  const now = Date.now();
  if (snapshot && now - snapshot.at < TTL) return snapshot;

  const docs: Doc[] = [];
  const seen = new Set<string>();
  const { sections, menu } = discoverSections();
  const site = readSite();

  for (const section of sections) {
    const nested = sections.filter((o) => o !== section && o.dir.startsWith(section.dir + "/"));
    const isNested = (f: string) =>
      nested.some((o) => path.relative(ROOT, f).split(path.sep).join("/").startsWith(o.dir + "/"));
    for (const file of walk(path.resolve(ROOT, section.dir))) {
      if (!DOC_EXT.test(file) || isNested(file)) continue;
      const stat = fs.statSync(file);
      const key = `${section.slug}:${file}`;
      seen.add(key);
      let c = fileCache.get(key);
      if (!c || c.mtimeMs !== stat.mtimeMs) {
        const doc = parseFile(file, stat, section);
        if (!doc) {
          fileCache.delete(key);
          continue;
        }
        c = { mtimeMs: stat.mtimeMs, doc };
        fileCache.set(key, c);
      }
      docs.push(c.doc);
    }
  }
  for (const k of fileCache.keys()) if (!seen.has(k)) fileCache.delete(k);

  docs.sort((a, b) => b.date - a.date);

  const assets = new Map<string, string>();
  for (const f of walk(ROOT)) {
    if (ASSET_EXT.test(f)) {
      const rel = path.relative(ROOT, f).split(path.sep).join("/");
      assets.set(path.basename(f).toLowerCase(), rel);
    }
  }

  snapshot = { at: now, docs, assets, sections, menu, site };
  return snapshot;
}

/** Sections = directories with meta.json where `root: true` (like root folders in fumadocs) */
function discoverSections(): { sections: Section[]; menu: MenuItem[] } {
  const out: Section[] = [];
  for (const file of walk(ROOT)) {
    if (path.basename(file) !== "meta.json") continue;
    let meta: Record<string, unknown>;
    try {
      meta = JSON.parse(fs.readFileSync(file, "utf8"));
    } catch {
      continue;
    }
    if (meta.root !== true) continue;
    const dir = path.relative(ROOT, path.dirname(file)).split(path.sep).join("/");
    if (!dir) continue;
    const plain = dir.split("/").filter((x) => !/^\(.*\)$/.test(x)).join("-") || dir;
    out.push({
      title: typeof meta.title === "string" ? meta.title : path.basename(dir),
      description: typeof meta.description === "string" ? meta.description : "",
      slug: typeof meta.$id === "string" && meta.$id ? meta.$id : plain,
      dir,
      icon: typeof meta.icon === "string" ? meta.icon : "Folder",
      color: typeof meta.color === "string" ? meta.color : "",
      order: typeof meta.order === "number" ? meta.order : 0,
      parent: null,
      depth: 0,
      pages: asPages(meta.pages),
      count: 0,
    });
  }
  // tree: the parent is the nearest section up the path
  for (const sec of out) {
    const ancestors = out
      .filter((o) => o !== sec && sec.dir.startsWith(o.dir + "/"))
      .sort((a, b) => b.dir.length - a.dir.length);
    sec.parent = ancestors[0]?.slug ?? null;
    sec.depth = ancestors.length;
  }
  const site = readSite();
  const menu = buildMenu(out, site.pages);
  const sections = menu.flatMap((m) => (m.kind === "section" ? [m.section] : []));
  return { sections, menu };
}

const asPages = (v: unknown): string[] => (Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : []);

/** "a/(group)/b.md" → "a/b": groups and extensions are not part of the page key */
const normKey = (p: string) =>
  p.replace(/\.mdx?$/i, "").split("/").filter((x) => x && x !== "." && !/^\(.*\)$/.test(x)).join("/");

const isSeparator = (e: string) => e.startsWith("---");
const separatorLabel = (e: string) => e.replace(/^---\s*/, "").replace(/\s*---$/, "").trim();

/** Keys a `pages` entry may use to refer to a child section: relative path, folder name, $id */
function sectionKeys(sec: Section, parent: Section | null) {
  const rel = parent ? sec.dir.slice(parent.dir.length + 1) : sec.dir;
  return new Set([rel, normKey(rel), path.basename(sec.dir), sec.slug]);
}

/** Menu tree in `pages` order (meta.json of the parent, or of contentDir for top level) */
function buildMenu(all: Section[], rootPages: string[]): MenuItem[] {
  const cmp = (a: Section, b: Section) => a.order - b.order || a.dir.localeCompare(b.dir);
  const out: MenuItem[] = [];

  const level = (parent: Section | null, pages: string[]) => {
    const depth = parent ? parent.depth + 1 : 0;
    const sibs = all.filter((o) => o.parent === (parent?.slug ?? null)).sort(cmp);
    const listed = new Set<Section>();
    for (const e of pages) {
      if (isSeparator(e) || e === "...") continue;
      const hit = sibs.find((x) => !listed.has(x) && sectionKeys(x, parent).has(e));
      if (hit) listed.add(hit);
    }
    const used = new Set<Section>();
    const emit = (x: Section) => {
      out.push({ kind: "section", section: x });
      level(x, x.pages);
    };
    let restDone = false;
    const rest = () => {
      if (restDone) return;
      restDone = true;
      for (const x of sibs) if (!listed.has(x)) emit(x);
    };
    for (const e of pages) {
      if (isSeparator(e)) out.push({ kind: "separator", label: separatorLabel(e), depth });
      else if (e === "...") rest();
      else {
        const hit = sibs.find((x) => !used.has(x) && sectionKeys(x, parent).has(e));
        if (hit) { used.add(hit); emit(hit); }
      }
    }
    rest(); // sections not mentioned in `pages` go to the end
  };
  level(null, rootPages);

  // drop empty/duplicate unlabeled separators (leading, trailing, doubled)
  return out.filter((m, i) => {
    if (m.kind !== "separator" || m.label) return true;
    const prev = out[i - 1], next = out[i + 1];
    return prev?.kind === "section" && next?.kind === "section";
  });
}

/** The root meta.json in contentDir describes the site itself: title, description, icon */
function readSite(): Site {
  let meta: Record<string, unknown> = {};
  try {
    meta = JSON.parse(fs.readFileSync(path.join(ROOT, "meta.json"), "utf8"));
  } catch {}
  const str = (v: unknown, d: string) => (typeof v === "string" && v ? v : d);
  return {
    pages: asPages(meta.pages),
    title: str(meta.title, "Newspaper"),
    description: str(meta.description, ""),
    icon: str(meta.icon, "BookOpen"),
    color: str(meta.color, ""),
  };
}

export function getDocs(): Doc[] {
  return scan().docs;
}

export function getSections(): Section[] {
  return scan().sections.map((s) => ({ ...s, count: getSectionDocs(s.slug).length }));
}

export function getMenu(): MenuItem[] {
  return scan().menu.map((m) => (m.kind === "section" ? { ...m, section: { ...m.section, count: getSectionDocs(m.section.slug).length } } : m));
}

export function getSite(): Site {
  return scan().site;
}

/** slug of the section and all nested ones */
function subtree(slug: string): Set<string> {
  const all = scan().sections;
  const out = new Set([slug]);
  for (let grew = true; grew; ) {
    grew = false;
    for (const s of all) if (s.parent && out.has(s.parent) && !out.has(s.slug)) { out.add(s.slug); grew = true; }
  }
  return out;
}

export function getSection(slug: string) {
  return getSections().find((s) => s.slug === slug);
}

/** Section posts together with nested sections */
export function getSectionDocs(slug: string) {
  const set = subtree(slug);
  const docs = getDocs().filter((d) => set.has(d.section));
  return orderByPages(docs, slug, scan().sections.find((x) => x.slug === slug)?.pages ?? []);
}

/** Posts named in `pages` are pinned in that order; "..." marks where the rest (by date) goes */
function orderByPages(docs: Doc[], section: string, pages: string[]): Doc[] {
  const names = pages.filter((e) => !isSeparator(e));
  if (!names.some((e) => e !== "...")) return docs;
  const rest = names.indexOf("...");
  const pinned = new Map<string, Doc>();
  for (const e of names) {
    if (e === "...") continue;
    const k = normKey(e);
    const d = docs.find((x) => x.section === section && normKey(x.slug.join("/")) === k);
    if (d) pinned.set(e, d);
  }
  const used = new Set(pinned.values());
  const pick = (list: string[]) => list.flatMap((e) => (pinned.has(e) ? [pinned.get(e)!] : []));
  const before = rest < 0 ? names : names.slice(0, rest);
  const after = rest < 0 ? [] : names.slice(rest + 1);
  return [...pick(before), ...docs.filter((d) => !used.has(d)), ...pick(after)];
}

export function getDoc(section: string, slug: string[]) {
  const id = `${section}/${slug.join("/")}`;
  return getDocs().find((d) => d.id === id);
}

export function getTagDocs(tag: string) {
  const t = tag.toLowerCase();
  return getDocs().filter((d) => d.tags.some((x) => x.toLowerCase() === t));
}

export function findAsset(name: string): string | undefined {
  return scan().assets.get(path.basename(name).toLowerCase());
}

/** Finds a note for a [[wikilink]] by file name or title */
export function findDocByName(name: string): Doc | undefined {
  const n = name.trim().toLowerCase();
  return getDocs().find(
    (d) => d.slug[d.slug.length - 1].toLowerCase() === n || d.title.toLowerCase() === n,
  );
}

export function lastUpdated(): number {
  return getDocs().reduce((m, d) => Math.max(m, d.updated), 0);
}

export function fmtDate(ms: number) {
  return new Date(ms).toLocaleDateString("en-US", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

const isIndex = (d: Doc) => d.slug.length === 1 && d.slug[0].toLowerCase() === "index";

/** What to open when entering a section: index.md(x) in the directory root, otherwise the first post in the feed */
export function getLandingDoc(slug: string): Doc | undefined {
  const own = getDocs().filter((d) => d.section === slug);
  return own.find(isIndex) ?? getSectionDocs(slug)[0];
}

/** Home: index.md(x) in the contentDir root (not part of sections or search) */
export function getRootIndex(): Doc | undefined {
  const file = ["index.md", "index.mdx"].map((n) => path.join(ROOT, n)).find((f) => fs.existsSync(f));
  if (!file) return undefined;
  const site = getSite();
  const doc = parseFile(file, fs.statSync(file), {
    title: site.title, description: site.description, slug: "", dir: "", icon: site.icon,
    color: site.color, order: 0, parent: null, depth: 0, pages: [], count: 0,
  });
  return doc ? { ...doc, href: "/", section: "", sectionTitle: site.title } : undefined;
}

export function getHomeLanding(): Doc | undefined {
  return getDocs().find(isIndex) ?? getDocs()[0];
}
