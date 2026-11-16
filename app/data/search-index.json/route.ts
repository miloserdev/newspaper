import { buildSearchIndex } from "@/lib/search-index";

// prebuilt at `next build`; recomputed per request in `next dev`
export const dynamic = "force-static";

export function GET() {
  return new Response(buildSearchIndex(), { headers: { "content-type": "application/json" } });
}
