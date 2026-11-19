import fs from "node:fs";
import path from "node:path";
import { contentRoot, getAssetPaths } from "@/lib/content";

export const dynamic = "force-static";

// `output: export` needs at least one generated route, even when the content has no images/files
const EMPTY = "_empty.txt";

export function generateStaticParams() {
  const paths = getAssetPaths();
  return (paths.length ? paths : [EMPTY]).map((p) => ({ path: p.split("/") }));
}

const TYPES: Record<string, string> = {
  ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".gif": "image/gif",
  ".webp": "image/webp", ".svg": "image/svg+xml", ".avif": "image/avif",
  ".pdf": "application/pdf", ".mp4": "video/mp4", ".webm": "video/webm",
};

export async function GET(_: Request, ctx: { params: Promise<{ path: string[] }> }) {
  const { path: segs } = await ctx.params;
  const rel = segs.map((s) => decodeURIComponent(s)).join("/");
  if (rel === EMPTY) return new Response("", { headers: { "content-type": "text/plain" } });
  const full = path.resolve(contentRoot, rel);
  const type = TYPES[path.extname(full).toLowerCase()];
  if (!type || !full.startsWith(contentRoot + path.sep) || !fs.existsSync(full)) {
    return new Response("Not found", { status: 404 });
  }
  return new Response(fs.readFileSync(full), {
    headers: { "content-type": type, "cache-control": "public, max-age=60" },
  });
}
