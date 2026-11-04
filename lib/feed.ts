import { fmtDate, getDocs, getSectionDocs, getTagDocs, type Doc } from "./content";
import type { FeedItem, FeedScope } from "@/components/infinite-items";

export const PAGE_SIZE = 30;

/** current — slug of the open section: posts from nested sections show their section name */
export const toFeed = (docs: Doc[], current?: string): FeedItem[] =>
  docs.map((d) => ({
    href: d.href,
    title: d.title,
    description: d.description || d.excerpt,
    dateLabel: fmtDate(d.date),
    folder: [d.section !== current ? d.sectionTitle : "", d.folder].filter(Boolean).join(" / "),
    tags: d.tags,
  }));

/** Feed page: whole site, a section (with nested ones) or a tag */
export function queryFeed(scope: FeedScope, offset = 0, limit = PAGE_SIZE) {
  const docs = scope.section ? getSectionDocs(scope.section) : scope.tag ? getTagDocs(scope.tag) : getDocs();
  return { items: toFeed(docs.slice(offset, offset + limit), scope.section), total: docs.length };
}
