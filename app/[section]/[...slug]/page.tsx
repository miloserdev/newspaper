import { notFound } from "next/navigation";
import { getDoc, getDocs } from "@/lib/content";
import { ArticleView } from "@/components/article";

type P = { section: string; slug: string[] };
const dec = (s: string) => { try { return decodeURIComponent(s); } catch { return s; } };

export function generateStaticParams() {
  return getDocs().map((d) => ({ section: d.section, slug: d.slug }));
}

export async function generateMetadata({ params }: { params: Promise<P> }) {
  const p = await params;
  const doc = getDoc(dec(p.section), p.slug.map(dec));
  return { title: doc?.title, description: doc?.description };
}

export default async function ArticlePage({ params }: { params: Promise<P> }) {
  const p = await params;
  const doc = getDoc(dec(p.section), p.slug.map(dec));
  if (!doc) notFound();
  return <ArticleView doc={doc} />;
}
