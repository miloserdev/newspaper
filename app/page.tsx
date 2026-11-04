import { getHomeLanding, getRootIndex, getSite } from "@/lib/content";
import { queryFeed } from "@/lib/feed";
import { Feed } from "@/components/feed";
import { EmptyReader } from "@/components/empty-reader";
import { ArticleView } from "@/components/article";
import { AutoOpen } from "@/components/auto-open";

/** Home: global feed. On the right — index.md from the contentDir root, otherwise the first article, otherwise the splash screen */
export default function Home() {
  const site = getSite();
  const rootIndex = getRootIndex();
  const { items, total } = queryFeed({});
  const landing = rootIndex ? undefined : getHomeLanding();
  return (
    <>
      <Feed title="All posts" description={site.description} scope={{}} initial={items} total={total} />
      {rootIndex ? (
        <ArticleView doc={rootIndex} className="hidden lg:block" back={false} />
      ) : landing ? (
        <AutoOpen href={landing.href} />
      ) : (
        <EmptyReader />
      )}
    </>
  );
}
