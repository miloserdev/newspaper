import "server-only";
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import matter from "gray-matter";
import { config } from "@/config";
import { parseScriptTag, type ScriptTag } from "./script-tags";

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
  /** <script> tags for every page's <head> (root meta.json `scripts`) */
  scripts: ScriptTag[];
  /** Links at the bottom of the menu (root meta.json `links`, else config.links) */
  links: { title: string; href: string }[];
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
  /** Path of the source file relative to contentDir (posix) */
  file: string;
  body: string;
  excerpt: string;
  text: string;
}

/** Removes // and /* *\/ comments and trailing commas (outside strings) so hand-edited meta.json still parses */
function stripLooseJson(src: string): string {
  const out: string[] = [];
  let i = 0;
  if (src.charCodeAt(0) === 0xfeff) i = 1;
  while (i < src.length) {
    const c = src[i];
    if (c === '"') {
      let j = i + 1;
      while (j < src.length && src[j] !== '"') j += src[j] === "\\" ? 2 : 1;
      out.push(src.slice(i, j + 1));
      i = j + 1;
    } else if (c === "/" && src[i + 1] === "/") {
      while (i < src.length && src[i] !== "\n") i++;
    } else if (c === "/" && src[i + 1] === "*") {
      const end = src.indexOf("*/", i + 2);
      i = end < 0 ? src.length : end + 2;
    } else {
      if (c === "}" || c === "]") {
        let k = out.length - 1;
        while (k >= 0 && /^\s*$/.test(out[k])) k--;
        if (k >= 0 && out[k] === ",") out.splice(k, 1);
      }
      out.push(c);
      i++;
    }
  }
  return out.join("");
}

/** Parses loose JSON (comments, trailing commas, BOM). Throws on real syntax errors. */
export const parseLooseJson = (raw: string): unknown => JSON.parse(stripLooseJson(raw));

const warned = new Set<string>();

/** meta.json reader: loose JSON allowed; a missing file is fine, a broken one is reported (once per edit) instead of silently ignored */
function readMeta(file: string): Record<string, unknown> | null {
  let raw: string;
  let mtime: number;
  try {
    raw = fs.readFileSync(file, "utf8");
    mtime = fs.statSync(file).mtimeMs;
  } catch {
    return null;
  }
  try {
    const v = parseLooseJson(raw);
    if (v && typeof v === "object" && !Array.isArray(v)) return v as Record<string, unknown>;
    throw new Error("expected a JSON object");
  } catch (e) {
    const key = `${file}:${mtime}`;
    if (!warned.has(key)) {
      warned.add(key);
      console.warn(`[content] ${path.relative(process.cwd(), file)}: invalid JSON, ignored (${(e as Error).message})`);
    }
    return null;
  }
}

// the content directory is chosen at runtime — keep Turbopack from tracing the whole project for it
/**
 * GIT_DATES=1 (set by the GitHub Actions workflow): take created/updated times from git history,
 * because a fresh checkout gives every file the same filesystem time.
 */
let gitDates: Map<string, { created: number; updated: number }> | null | undefined;
function getGitDates(root: string) {
  if (gitDates !== undefined) return gitDates;
  gitDates = null;
  if (process.env.GIT_DATES !== "1") return gitDates;
  try {
    const out = execFileSync(
      "git",
      ["-c", "core.quotepath=off", "log", "--relative", "--name-only", "--no-renames", "--format=@%ct", "--", "."],
      { cwd: root, encoding: "utf8", maxBuffer: 256 * 1024 * 1024 },
    );
    const map = new Map<string, { created: number; updated: number }>();
    let ts = 0;
    for (const line of out.split("\n")) {
      if (line.startsWith("@")) ts = Number(line.slice(1)) * 1000;
      else if (line.trim()) {
        const f = path.join(root, line.trim());
        const e = map.get(f); // log is newest-first: first hit = last change, last hit = creation
        if (e) e.created = ts;
        else map.set(f, { created: ts, updated: ts });
      }
    }
    gitDates = map;
  } catch (e) {
    console.warn("[content] GIT_DATES=1 but git history is unavailable (shallow clone?):", (e as Error).message.split("\n")[0]);
  }
  return gitDates;
}

const ROOT = path.resolve(/*turbopackIgnore: true*/ process.cwd(), config.contentDir);
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

export const asMs = (v: unknown): number | null => {
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

  const rel = path.relative(path.resolve(/*turbopackIgnore: true*/ ROOT, section.dir), file);
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
  const git = getGitDates(ROOT)?.get(file);
  const created = git?.created ?? (stat.birthtimeMs > 0 ? stat.birthtimeMs : stat.mtimeMs);
  const modified = git?.updated ?? stat.mtimeMs;
  const date = asMs(data.date) ?? Math.min(created, modified);

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
    updated: modified,
    image: [data.image, data.cover].find((x): x is string => typeof x === "string"),
    folder: slug.length > 1 ? slug.slice(0, -1).join(" / ") : "",
    relDir: path.relative(ROOT, path.dirname(file)),
    file: path.relative(ROOT, file).split(path.sep).join("/"),
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
    for (const file of walk(path.resolve(/*turbopackIgnore: true*/ ROOT, section.dir))) {
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
    const meta = readMeta(file);
    if (!meta || meta.root !== true) continue;
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
  const meta = readMeta(path.join(ROOT, "meta.json")) ?? {};
  const str = (v: unknown, d: string) => (typeof v === "string" && v ? v : d);
  const links = Array.isArray(meta.links)
    ? meta.links.flatMap((l: unknown) => {
        const o = l as { title?: unknown; href?: unknown };
        return typeof o?.title === "string" && typeof o?.href === "string" ? [{ title: o.title, href: o.href }] : [];
      })
    : config.links;
  const scripts = Array.isArray(meta.scripts) ? meta.scripts.flatMap((e) => parseScriptTag(e) ?? []) : [];
  return {
    scripts,
    links,
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

/** Tags may contain "/" (Obsidian nested tags) — keep URLs to one segment */
export const tagSlug = (t: string) => t.toLowerCase().replace(/[\\/]+/g, "~");

export function getTagDocs(tag: string) {
  const t = tagSlug(tag);
  return getDocs().filter((d) => d.tags.some((x) => tagSlug(x) === t));
}

/** One entry per distinct tag (first spelling wins) */
export function getAllTags(): string[] {
  const seen = new Map<string, string>();
  for (const d of getDocs()) for (const t of d.tags) if (!seen.has(tagSlug(t))) seen.set(tagSlug(t), t);
  return [...seen.values()];
}

/** Content-relative paths of all images/files (for static export) */
export function getAssetPaths(): string[] {
  return [...scan().assets.values()];
}

export function findAsset(name: string): string | undefined {
  return scan().assets.get(path.basename(name).toLowerCase());
}

/** Finds a note for a [[wikilink]] by file name or title */
/** Finds a post by its source path relative to contentDir (`news/a.md`; the extension may be omitted) */
export function findDocByPath(rel: string): Doc | undefined {
  const norm = path.posix.normalize(rel.split(path.sep).join("/")).replace(/^\.\//, "");
  const candidates = new Set([norm, `${norm}.md`, `${norm}.mdx`, `${norm}/index.md`, `${norm}/index.mdx`]);
  return getDocs().find((d) => candidates.has(d.file));
}

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
  const file = ["index.md", "index.mdx"].map((n) => path.join(/*turbopackIgnore: true*/ ROOT, n)).find((f) => fs.existsSync(f));
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
