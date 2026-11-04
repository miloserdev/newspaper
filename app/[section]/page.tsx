import { EmptyReader } from "@/components/empty-reader";
import { ArticleView } from "@/components/article";
import { AutoOpen } from "@/components/auto-open";
import { getLandingDoc } from "@/lib/content";

export default async function SectionPage({ params }: { params: Promise<{ section: string }> }) {
  const slug = decodeURIComponent((await params).section);
  const doc = getLandingDoc(slug);
  if (!doc) return <EmptyReader />;
  return (
    <>
      <AutoOpen href={doc.href} />
      <ArticleView doc={doc} className="hidden lg:block" back={false} />
    </>
  );
}
