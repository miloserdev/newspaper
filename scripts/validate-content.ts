/**
 * Content validator: run it in CI before building, so a broken document never becomes a broken site.
 *
 *   npm run validate                 # validates config.contentDir (or $CONTENT_DIR)
 *   npm run validate -- --strict     # warnings fail the run too
 *   npm run validate -- --json       # machine-readable report
 *
 * Errors  = things that break the site or lose content (invalid meta.json / YAML, missing images, broken relative links…)
 * Warnings = suspicious but renderable (unresolved wikilinks, unknown icon, ignored files…)
 */
import fs from "node:fs";
import path from "node:path";
import matter from "gray-matter";
import { icons } from "lucide-react";
import {
  asMs,
  contentRoot,
  findAsset,
  findDocByName,
  findDocByPath,
  getDocs,
  getSections,
  parseLooseJson,
  type Doc,
} from "../lib/content";

type Level = "error" | "warning";
export interface Issue {
  level: Level;
  code: string;
  file: string;
  line?: number;
  message: string;
}

const issues: Issue[] = [];
const add = (level: Level, code: string, file: string, message: string, line?: number) =>
  issues.push({ level, code, file, message, ...(line ? { line } : {}) });

const rel = (f: string) => path.relative(contentRoot, f).split(path.sep).join("/") || ".";
const lineOf = (text: string, index: number) => text.slice(0, index).split("\n").length;

function walk(dir: string, out: string[] = []): string[] {
  let entries: fs.Dirent[] = [];
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

const groupless = (p: string) => p.split("/").filter((x) => x && x !== "." && !/^\(.*\)$/.test(x)).join("/");
const isSep = (e: string) => e.startsWith("---");

// ---------------------------------------------------------------- meta.json
const files = walk(contentRoot);
const metaFiles = files.filter((f) => path.basename(f) === "meta.json");

for (const f of metaFiles) {
  let meta: unknown;
  try {
    meta = parseLooseJson(fs.readFileSync(f, "utf8"));
    if (!meta || typeof meta !== "object" || Array.isArray(meta)) throw new Error("expected a JSON object");
  } catch (e) {
    add("error", "meta-invalid-json", rel(f), `invalid JSON: ${(e as Error).message}`);
    continue;
  }
  const m = meta as Record<string, unknown>;
  const isRootMeta = path.dirname(f) === contentRoot;
  if (m.root === true || isRootMeta) {
    if (typeof m.title !== "string" || !m.title) add("warning", "meta-no-title", rel(f), "no `title` (the folder name / default is used)");
    if (typeof m.icon === "string" && m.icon && !(m.icon in icons)) {
      add("warning", "meta-unknown-icon", rel(f), `\`${m.icon}\` is not a lucide icon name (a default icon is used)`);
    }
  }
  if (m.pages !== undefined && !Array.isArray(m.pages)) add("error", "meta-pages-type", rel(f), "`pages` must be an array of strings");
  if (m.links !== undefined && !Array.isArray(m.links)) add("warning", "meta-links-type", rel(f), "`links` must be an array of { title, href }");
}
if (!metaFiles.some((f) => path.dirname(f) === contentRoot)) {
  add("warning", "site-meta-missing", "meta.json", "no meta.json in the content root: the site gets a default title and icon");
}

// ---------------------------------------------------------------- sections
const sections = getSections();
const seenIds = new Map<string, string>();
for (const s of sections) {
  const prev = seenIds.get(s.slug);
  if (prev) add("error", "section-duplicate-id", `${s.dir}/meta.json`, `section id \`${s.slug}\` is also used by \`${prev}\` — URLs would collide`);
  else seenIds.set(s.slug, s.dir);
}

const docs = getDocs();

// `pages` entries that match nothing (typos)
function checkPages(metaPath: string, pages: unknown, names: Set<string>) {
  if (!Array.isArray(pages)) return;
  for (const e of pages) {
    if (typeof e !== "string" || isSep(e) || e === "...") continue;
    if (!names.has(e) && !names.has(groupless(e))) add("warning", "pages-unmatched", metaPath, `\`pages\` entry "${e}" matches no post or section`);
  }
}
for (const f of metaFiles) {
  let m: Record<string, unknown>;
  try {
    m = parseLooseJson(fs.readFileSync(f, "utf8")) as Record<string, unknown>;
  } catch {
    continue;
  }
  const dir = rel(path.dirname(f));
  const isRoot = dir === ".";
  if (!isRoot && m.root !== true) continue;
  const names = new Set<string>();
  const children = sections.filter((s) => (isRoot ? s.parent === null : s.dir === dir ? false : s.parent === sections.find((x) => x.dir === dir)?.slug));
  for (const c of children) {
    const relDir = isRoot ? c.dir : c.dir.slice(dir.length + 1);
    [relDir, groupless(relDir), path.basename(c.dir), c.slug].forEach((n) => names.add(n));
  }
  if (!isRoot) {
    const sec = sections.find((x) => x.dir === dir);
    for (const d of docs.filter((d) => d.section === sec?.slug)) {
      const k = d.file.slice(dir.length + 1).replace(/\.mdx?$/i, "");
      names.add(k);
      names.add(groupless(k));
    }
  }
  checkPages(rel(f), m.pages, names);
}

// ---------------------------------------------------------------- duplicate URLs
const byHref = new Map<string, Doc[]>();
for (const d of docs) byHref.set(d.href.toLowerCase(), [...(byHref.get(d.href.toLowerCase()) ?? []), d]);
for (const list of byHref.values()) {
  if (list.length > 1) for (const d of list) add("error", "duplicate-slug", d.file, `same URL as ${list.filter((x) => x !== d).map((x) => x.file).join(", ")} (${d.href})`);
}

// ---------------------------------------------------------------- posts
/** Blank out fenced and inline code (keeping newlines) so links in code samples are not checked */
const maskCode = (t: string) =>
  t.replace(/```[\s\S]*?```|~~~[\s\S]*?~~~|`[^`\n]*`/g, (m) => m.replace(/[^\n]/g, " "));

const EXTERNAL = /^([a-z][a-z0-9+.-]*:|\/\/)/i;

function checkPost(d: Doc) {
  const file = path.join(contentRoot, d.file);
  const raw = fs.readFileSync(file, "utf8");

  let data: Record<string, unknown> = {};
  try {
    data = matter(raw, {}).data;
  } catch (e) {
    const msg = (e as Error).message.split("\n")[0];
    add("error", "frontmatter-invalid", d.file, `invalid front matter YAML: ${msg} (tip: quote values containing ": ")`);
  }

  if (data.date !== undefined && asMs(data.date) === null) add("error", "frontmatter-date-invalid", d.file, `\`date: ${String(data.date)}\` is not a valid date`);
  if (data.title !== undefined && typeof data.title !== "string") add("warning", "frontmatter-title-type", d.file, "`title` should be a string");
  if (data.tags !== undefined && typeof data.tags !== "string" && !Array.isArray(data.tags)) add("warning", "frontmatter-tags-type", d.file, "`tags` should be a list like [a, b] or a string");
  if (!d.title || d.title === d.slug[d.slug.length - 1]) {
    if (typeof data.title !== "string" && !/^\s*#\s+\S/m.test(raw)) add("warning", "no-title", d.file, "no `title` and no `# H1`: the file name is used as the title");
  }
  for (const key of ["image", "cover"]) {
    const v = data[key];
    if (typeof v === "string" && !EXTERNAL.test(v) && !v.startsWith("/")) {
      if (!fs.existsSync(path.join(path.dirname(file), decodeURI(v)))) add("error", "broken-asset", d.file, `front matter \`${key}: ${v}\` — file not found`);
    }
  }

  const text = maskCode(raw);

  // [text](target) and ![alt](target)
  // the target is either <angle bracketed> (may contain spaces and parentheses) or a plain run without spaces
  for (const m of text.matchAll(/(!?)\[[^\]]*\]\(\s*(?:<([^>\n]+)>|([^)\s]+))(?:\s+"[^"]*")?\s*\)/g)) {
    const isImage = m[1] === "!";
    let target = m[2] ?? m[3];
    if (EXTERNAL.test(target) || target.startsWith("#") || target.startsWith("/")) continue;
    target = target.replace(/[#?].*$/, "");
    if (!target) continue;
    let decoded: string;
    try {
      decoded = decodeURIComponent(target);
    } catch {
      add("error", "broken-link", d.file, `malformed link target \`${target}\``, lineOf(raw, m.index!));
      continue;
    }
    const abs = path.resolve(path.dirname(file), decoded);
    const relToRoot = path.relative(contentRoot, abs).split(path.sep).join("/");
    if (relToRoot.startsWith("..")) {
      add("error", "link-outside-content", d.file, `\`${decoded}\` points outside the content folder`, lineOf(raw, m.index!));
    } else if (/\.mdx?$/i.test(decoded) || (!isImage && !path.extname(decoded))) {
      if (!findDocByPath(relToRoot)) add("error", "broken-link", d.file, `link to \`${decoded}\` — no such post`, lineOf(raw, m.index!));
    } else if (!fs.existsSync(abs)) {
      add("error", isImage ? "broken-asset" : "broken-link", d.file, `${isImage ? "image" : "file"} \`${decoded}\` not found`, lineOf(raw, m.index!));
    }
  }

  // ![[embed]] and [[wikilink]]
  for (const m of text.matchAll(/(!?)\[\[([^\]|#]+)(?:#[^\]|]*)?(?:\|[^\]]*)?\]\]/g)) {
    const name = m[2].trim();
    if (m[1] === "!") {
      if (!findAsset(name)) {
        if (findDocByName(name)) add("warning", "note-embed-unsupported", d.file, `![[${name}]] embeds a note — only images/files can be embedded`, lineOf(raw, m.index!));
        else add("error", "broken-embed", d.file, `![[${name}]] — file not found`, lineOf(raw, m.index!));
      }
    } else if (!findDocByName(name)) {
      add("warning", "unresolved-wikilink", d.file, `[[${name}]] does not match any post (rendered as plain text)`, lineOf(raw, m.index!));
    }
  }
}
for (const d of docs) checkPost(d);

// ---------------------------------------------------------------- files the site silently ignores
const known = new Set(docs.map((d) => d.file));
for (const f of files) {
  if (!/\.mdx?$/i.test(f)) continue;
  const r = rel(f);
  if (known.has(r)) continue;
  if (/^index\.mdx?$/i.test(r)) continue; // home page
  try {
    if (matter(fs.readFileSync(f, "utf8"), {}).data.draft === true) continue;
  } catch {
    /* reported when it is a post; here it is outside any section anyway */
  }
  add("warning", "outside-section", r, "not part of any section (no parent folder with a meta.json that has `\"root\": true`) — this file is not published");
}

// ---------------------------------------------------------------- report
const errors = issues.filter((i) => i.level === "error");
const warnings = issues.filter((i) => i.level === "warning");
const strict = process.argv.includes("--strict");
const failed = errors.length > 0 || (strict && warnings.length > 0);

if (process.argv.includes("--json")) {
  console.log(JSON.stringify({ root: contentRoot, posts: docs.length, sections: sections.length, errors: errors.length, warnings: warnings.length, issues }, null, 2));
} else {
  const gh = process.env.GITHUB_ACTIONS === "true";
  const where = (i: Issue) => (i.line ? `${i.file}:${i.line}` : i.file);
  for (const i of [...errors, ...warnings]) {
    if (gh) {
      const f = path.relative(process.cwd(), path.join(contentRoot, i.file));
      console.log(`::${i.level} file=${f}${i.line ? `,line=${i.line}` : ""},title=${i.code}::${i.message}`);
    } else {
      console.log(`${i.level === "error" ? "✖" : "⚠"} ${where(i)}  [${i.code}]  ${i.message}`);
    }
  }
  console.log(`\n${docs.length} posts, ${sections.length} sections — ${errors.length} error(s), ${warnings.length} warning(s)${strict ? " (strict)" : ""}`);
}
process.exit(failed ? 1 : 0);
