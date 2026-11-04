import { notFound } from "next/navigation";
import { getSection } from "@/lib/content";
import { queryFeed } from "@/lib/feed";
import { Feed } from "@/components/feed";

export default async function SectionLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ section: string }>;
}) {
  const { section: raw } = await params;
  const section = getSection(decodeURIComponent(raw));
  if (!section) notFound();
  const { items, total } = queryFeed({ section: section.slug });
  return (
    <>
      <Feed title={section.title} description={section.description} scope={{ section: section.slug }} initial={items} total={total} />
      {children}
    </>
  );
}
