import { fmtDate, getSite, lastUpdated } from "@/lib/content";
import { SectionIcon } from "./icons";

export function EmptyReader() {
  const site = getSite();
  return (
    <div className="hidden flex-1 flex-col items-center justify-center gap-3 text-center lg:flex">
      <SectionIcon name={site.icon} color={site.color} className="size-24 stroke-1" />
      <h2 className="mt-4 text-3xl font-medium">{site.title}</h2>
      {site.description && <p className="max-w-sm text-sm text-muted-foreground">{site.description}</p>}
      <p className="mt-16 text-xs text-muted-foreground">Updated {fmtDate(lastUpdated())}</p>
    </div>
  );
}
