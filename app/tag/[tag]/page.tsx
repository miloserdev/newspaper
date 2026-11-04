import { queryFeed } from "@/lib/feed";
import { Feed } from "@/components/feed";
import { EmptyReader } from "@/components/empty-reader";

export default async function TagPage({ params }: { params: Promise<{ tag: string }> }) {
  const tag = decodeURIComponent((await params).tag);
  const { items, total } = queryFeed({ tag });
  return (
    <>
      <Feed title={`#${tag}`} scope={{ tag }} initial={items} total={total} />
      <EmptyReader />
    </>
  );
}
