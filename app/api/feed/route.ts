import { PAGE_SIZE, queryFeed } from "@/lib/feed";

export const dynamic = "force-dynamic";

export function GET(req: Request) {
  const p = new URL(req.url).searchParams;
  const offset = Math.max(0, Number(p.get("offset")) || 0);
  const limit = Math.min(100, Number(p.get("limit")) || PAGE_SIZE);
  return Response.json(
    queryFeed({ section: p.get("section") ?? undefined, tag: p.get("tag") ?? undefined }, offset, limit),
  );
}
