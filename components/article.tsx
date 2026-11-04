import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { fmtDate, type Doc } from "@/lib/content";
import { Markdown } from "@/components/markdown";
import { Badge } from "@/components/ui/badge";

export function ArticleView({ doc, className = "", back = true }: { doc: Doc; className?: string; back?: boolean }) {
  const edited = doc.updated - doc.date > 60_000 && fmtDate(doc.updated) !== fmtDate(doc.date);

  return (
    <article className={`min-w-0 flex-1 overflow-y-auto ${className}`}>
      <div className="mx-auto max-w-3xl px-5 py-6 sm:px-8 sm:py-8">
        {back && <Link href={`/${doc.section}`} className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground lg:hidden">
          <ArrowLeft className="size-4" /> {doc.sectionTitle}
        </Link>}
        {doc.image && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={doc.image} alt="" className="mb-6 w-full rounded-xl border" />
        )}
        <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
          <Badge variant="secondary">{doc.sectionTitle}</Badge>
          {doc.tags.map((t) => (
            <Link key={t} href={`/tag/${encodeURIComponent(t)}`}>
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
        <div className="mt-8">
          <Markdown doc={doc} />
        </div>
      </div>
    </article>
  );
}
