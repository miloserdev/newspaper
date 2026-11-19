import { test, before } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

/**
 * Renders the representative vaults with the real static export and checks the generated site.
 * Slow (a full `next build`), so it is a separate script: `npm run test:build`.
 */
const root = path.resolve(import.meta.dirname, "../..");
const out = path.join(root, ".fixture-out/basic");
const read = (f: string) => fs.readFileSync(path.join(out, f), "utf8");
const hrefs = (html: string) => [...html.matchAll(/href="([^"]*)"/g)].map((m) => m[1]);

before(() => {
  fs.rmSync(out, { recursive: true, force: true });
  const r = spawnSync("npx", ["next", "build"], {
    cwd: root,
    encoding: "utf8",
    env: { ...process.env, CONTENT_DIR: "fixtures/basic", STATIC_EXPORT: "1", BASE_PATH: "/fx", EXPORT_DIR: ".fixture-out/basic" },
  });
  assert.equal(r.status, 0, r.stdout + r.stderr);
});

test("every post and section of the awkward vault becomes a page", () => {
  for (const f of [
    "index.html",
    "handbook.html",
    "handbook/setup.html",
    "news/2026/launch.html", // folder 2026 stays in the URL
    "news/old post.html", // "(archive)" group is not part of the URL
    "notes-ru/Привет мир.html", // cyrillic + space
    "nested-ru/глубоко.html", // section nested inside another section
    "tag/project~alpha.html", // a tag with a slash
    "tag/заметка.html",
    "404.html",
  ]) assert.ok(fs.existsSync(path.join(out, f)), `missing ${f}`);
});

test("relative links between posts are rewritten to site URLs", () => {
  const links = hrefs(read("handbook/index.html"));
  assert.ok(links.includes("/fx/handbook/setup"), "./setup.md");
  assert.ok(links.includes("/fx/news/2026/launch#intro"), "../news/2026/launch.md#intro");
  assert.ok(links.includes("/fx/news/old%20post"), "<../news/(archive)/old post.md>");
  assert.ok(!links.includes("setup"), "extension-less relative link must be rewritten too");
  assert.ok(!links.some((l) => l.endsWith(".md")), "no link may keep a .md target");
});

test("wikilinks, embeds and images resolve under the base path", () => {
  const setup = read("handbook/setup.html");
  assert.ok(hrefs(setup).includes("/fx/news/2026/launch"), "[[Launch]]");
  assert.ok(hrefs(setup).some((l) => decodeURIComponent(l) === "/fx/notes-ru/Привет мир"), "[[Привет мир]]");
  assert.match(setup, /src="\/fx\/files\/handbook\/img\/diagram\.svg"/);
  assert.ok(fs.existsSync(path.join(out, "files/handbook/img/diagram.svg")));
});

test("search index and feed pages are generated and contain the posts", () => {
  const index = fs.readFileSync(path.join(out, "data/search-index.json"), "utf8");
  assert.ok(index.includes("Handbook home") && index.includes("Глубоко"));
  const feed = JSON.parse(read("data/feed/all/0.json")) as { total: number };
  assert.equal(feed.total, 6);
});

test("site metadata comes from the vault's root meta.json", () => {
  const home = read("index.html");
  assert.match(home, /<title>Fixture Basic<\/title>/);
  assert.ok(hrefs(home).includes("https://example.com"));
});
