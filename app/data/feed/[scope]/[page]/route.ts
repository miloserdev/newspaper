import { PAGE_SIZE, allFeedFiles, parseFeedKey, queryFeed } from "@/lib/feed";

// prebuilt at `next build` (one JSON file per feed page); recomputed per request in `next dev`
export const dynamic = "force-static";

export function generateStaticParams() {
  return allFeedFiles();
}

export async function GET(_: Request, ctx: { params: Promise<{ scope: string; page: string }> }) {
  const { scope, page } = await ctx.params;
  const n = Math.max(0, parseInt(page, 10) || 0);
  return Response.json(queryFeed(parseFeedKey(decodeURIComponent(scope)), n * PAGE_SIZE, PAGE_SIZE));
}
