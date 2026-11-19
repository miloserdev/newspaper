import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");

interface Report {
  posts: number;
  sections: number;
  errors: number;
  warnings: number;
  issues: { level: string; code: string; file: string; line?: number; message: string }[];
}

/** Runs the real validator CLI against a fixture vault, exactly as CI does */
function validate(fixture: string, ...args: string[]) {
  const r = spawnSync(
    path.join(root, "node_modules/.bin/tsx"),
    ["--tsconfig", "tsconfig.scripts.json", "scripts/validate-content.ts", "--json", ...args],
    { cwd: root, env: { ...process.env, CONTENT_DIR: path.join("fixtures", fixture) }, encoding: "utf8" },
  );
  const out = r.stdout.slice(r.stdout.indexOf("{"));
  return { status: r.status, report: JSON.parse(out) as Report };
}

const codes = (r: Report, level?: string) => [...new Set(r.issues.filter((i) => !level || i.level === level).map((i) => i.code))].sort();

test("basic vault (cyrillic, spaces, (groups), nested sections, every link kind) is clean even in --strict mode", () => {
  const { status, report } = validate("basic", "--strict");
  assert.deepEqual(report.issues, []);
  assert.equal(status, 0);
  assert.equal(report.sections, 4); // handbook, news, Заметки and the section nested inside it
  assert.equal(report.posts, 6);
});

test("broken vault fails with every expected error code", () => {
  const { status, report } = validate("broken");
  assert.equal(status, 1);
  assert.deepEqual(codes(report, "error"), [
    "broken-asset", // missing image + missing front matter cover
    "broken-embed", // ![[ghost.png]]
    "broken-link", // missing relative posts
    "duplicate-slug", // dup.md + dup.mdx
    "frontmatter-date-invalid",
    "frontmatter-invalid", // unquoted colon in YAML
    "link-outside-content",
    "meta-invalid-json",
    "meta-script-invalid",
  ]);
});

test("broken vault reports warnings separately from errors", () => {
  const { report } = validate("broken");
  assert.deepEqual(codes(report, "warning"), [
    "frontmatter-tags-type",
    "meta-unknown-icon",
    "no-title",
    "outside-section",
    "pages-unmatched",
    "unresolved-wikilink",
  ]);
});

test("issues point at the file and line", () => {
  const { report } = validate("broken");
  const missing = report.issues.find((i) => i.code === "broken-link" && i.message.includes("./nope.md"));
  assert.equal(missing?.file, "docs/links.md");
  assert.equal(missing?.line, 6);
});

test("code fences are not checked for links", () => {
  const { report } = validate("basic");
  assert.ok(!report.issues.some((i) => i.message.includes("not-a-real-file")));
});
