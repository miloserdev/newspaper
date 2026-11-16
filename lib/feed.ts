import { fmtDate, getDocs, getSections, getSectionDocs, getTagDocs, getAllTags, tagSlug, type Doc } from "./content";
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

/** URL-safe key of a feed: `all`, `s~<section>`, `t~<tag>` */
export const feedKey = (s: FeedScope) => (s.section ? `s~${s.section}` : s.tag ? `t~${tagSlug(s.tag)}` : "all");

export function parseFeedKey(key: string): FeedScope {
  if (key.startsWith("s~")) return { section: key.slice(2) };
  if (key.startsWith("t~")) return { tag: key.slice(2) };
  return {};
}

export const feedPageName = (page: number) => `${page}.json`;

/** Every (scope, page) pair — the feed is served as prebuilt JSON files */
export function allFeedFiles(): { scope: string; page: string }[] {
  const scopes: FeedScope[] = [{}, ...getSections().map((s) => ({ section: s.slug })), ...getAllTags().map((tag) => ({ tag }))];
  return scopes.flatMap((scope) => {
    const pages = Math.max(1, Math.ceil(queryFeed(scope).total / PAGE_SIZE));
    return Array.from({ length: pages }, (_, i) => ({ scope: feedKey(scope), page: feedPageName(i) }));
  });
}
