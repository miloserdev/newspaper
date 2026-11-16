import { getAllTags, tagSlug } from "@/lib/content";
import { queryFeed } from "@/lib/feed";
import { Feed } from "@/components/feed";
import { EmptyReader } from "@/components/empty-reader";

export function generateStaticParams() {
  return getAllTags().map((t) => ({ tag: tagSlug(t) }));
}

export default async function TagPage({ params }: { params: Promise<{ tag: string }> }) {
  const slug = decodeURIComponent((await params).tag);
  const tag = getAllTags().find((t) => tagSlug(t) === slug) ?? slug; // original spelling for the title
  const { items, total } = queryFeed({ tag });
  return (
    <>
      <Feed title={`#${tag}`} scope={{ tag }} initial={items} total={total} />
      <EmptyReader />
    </>
  );
}
