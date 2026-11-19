import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { fmtDate, getSection, getSite, tagSlug, type Doc } from "@/lib/content";
import { BASE_PATH } from "@/lib/base-path";
import { Markdown } from "@/components/markdown";
import { Toc } from "@/components/toc";
import { Badge } from "@/components/ui/badge";

export function ArticleView({ doc, className = "", back = true }: { doc: Doc; className?: string; back?: boolean }) {
  // accent color of the section (meta.json `color`); the root index uses the site's color
  const accent = (doc.section ? getSection(doc.section)?.color : getSite().color) || undefined;
  const edited = doc.updated - doc.date > 60_000 && fmtDate(doc.updated) !== fmtDate(doc.date);

  return (
    <article className={`min-w-0 flex-1 overflow-y-auto ${className}`}>
      <div className="mx-auto flex max-w-[76rem] items-start gap-12 px-5 py-6 sm:px-8 sm:py-8">
      <div className="min-w-0 max-w-3xl flex-1">
        {back && <Link href={`/${doc.section}`} className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground lg:hidden">
          <ArrowLeft className="size-4" /> {doc.sectionTitle}
        </Link>}
        {doc.image && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={doc.image.startsWith("/") && !doc.image.startsWith("//") ? BASE_PATH + doc.image : doc.image} alt="" className="mb-6 w-full rounded-xl border" />
        )}
        <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
          <Badge variant="secondary">{doc.sectionTitle}</Badge>
          {doc.tags.map((t) => (
            <Link key={t} href={`/tag/${encodeURIComponent(tagSlug(t))}`}>
              <Badge variant="outline">#{t}</Badge>
            </Link>
          ))}
          <span className="ml-auto">
            {fmtDate(doc.date)}
            {edited && <> · updated {fmtDate(doc.updated)}</>}
          </span>
        </div>
        <h1 className="mt-4 text-2xl font-semibold leading-tight sm:text-3xl">{doc.title}</h1>
        {doc.description && <p className="mt-3 text-lg text-muted-foreground">{doc.description}</p>}
        <Toc key={doc.href + "#inline"} variant="inline" />
        <div className="mt-8">
          <Markdown doc={doc} />
        </div>
      </div>
      <aside className="sticky top-8 hidden max-h-[calc(100dvh-4rem)] w-56 shrink-0 flex-col min-[1700px]:flex">
        <Toc key={doc.href} variant="aside" color={accent} />
      </aside>
      </div>
    </article>
  );
}
