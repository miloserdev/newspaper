import path from "node:path";
import Link from "next/link";
import ReactMarkdown, { type Components } from "react-markdown";
import { InfiniteItems } from "./infinite-items";
import { queryFeed } from "@/lib/feed";
import remarkGfm from "remark-gfm";
import rehypeRaw from "rehype-raw";
import rehypeSlug from "rehype-slug";
import rehypeHighlight from "rehype-highlight";
import "highlight.js/styles/github-dark.css";
import { isValidElement, type ComponentProps, type ReactElement, type ReactNode } from "react";
import { AlertOctagon, AlertTriangle, CheckCircle2, Info, Lightbulb, Quote, type LucideIcon } from "lucide-react";
import { CopyButton } from "./copy-button";
import type { Doc } from "@/lib/content";
import { preprocess } from "@/lib/markdown";

const textOf = (n: ReactNode): string =>
  typeof n === "string" || typeof n === "number"
    ? String(n)
    : Array.isArray(n)
      ? n.map(textOf).join("")
      : isValidElement(n)
        ? textOf((n as ReactElement<{ children?: ReactNode }>).props.children)
        : "";

function Pre({ children }: { children?: ReactNode }) {
  const code = isValidElement(children) ? (children as ReactElement<{ className?: string; children?: ReactNode }>) : null;
  const lang = /language-([\w+-]+)/.exec(code?.props.className ?? "")?.[1];
  const text = textOf(children).replace(/\n$/, "");
  return (
    <div className="not-prose my-6 overflow-hidden rounded-lg border bg-[#0d1117]">
      <div className="flex h-9 items-center justify-between border-b border-white/10 bg-white/[0.03] pl-4 pr-2">
        <span className="font-mono text-xs text-neutral-400">{lang ?? "text"}</span>
        <CopyButton text={text} />
      </div>
      <pre className="overflow-x-auto p-4 font-mono text-[13px] leading-relaxed">{children}</pre>
    </div>
  );
}

type MdNode = { type: string; value?: string; children?: MdNode[]; data?: Record<string, unknown> };

/** remark plugin: `> [!note] Title` → blockquote with data-callout / data-title */
function remarkCallouts() {
  const walk = (n: MdNode) => {
    if (n.type === "blockquote") {
      const p = n.children?.[0];
      const t = p?.type === "paragraph" ? p.children?.[0] : undefined;
      const m = t?.type === "text" && t.value?.match(/^\[!(\w+)\][+-]?[ \t]*([^\n]*)\n?/);
      if (t && m) {
        t.value = t.value!.slice(m[0].length);
        n.data = { hProperties: { "data-callout": m[1].toLowerCase(), "data-title": m[2] } };
      }
    }
    n.children?.forEach(walk);
  };
  return walk;
}

const CALLOUTS: Record<string, { label: string; cls: string; icon: LucideIcon }> = {
  note: { label: "Note", cls: "border-blue-500/40 bg-blue-500/10 text-blue-600 dark:text-blue-400", icon: Info },
  info: { label: "Info", cls: "border-blue-500/40 bg-blue-500/10 text-blue-600 dark:text-blue-400", icon: Info },
  tip: { label: "Tip", cls: "border-emerald-500/40 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400", icon: Lightbulb },
  success: { label: "Done", cls: "border-emerald-500/40 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400", icon: CheckCircle2 },
  warning: { label: "Warning", cls: "border-amber-500/40 bg-amber-500/10 text-amber-600 dark:text-amber-400", icon: AlertTriangle },
  danger: { label: "Danger", cls: "border-red-500/40 bg-red-500/10 text-red-600 dark:text-red-400", icon: AlertOctagon },
  error: { label: "Error", cls: "border-red-500/40 bg-red-500/10 text-red-600 dark:text-red-400", icon: AlertOctagon },
  quote: { label: "Quote", cls: "border-foreground/20 bg-foreground/5 text-muted-foreground", icon: Quote },
};

function Blockquote(props: ComponentProps<"blockquote"> & { "data-callout"?: string; "data-title"?: string }) {
  const type = props["data-callout"];
  if (!type) return <blockquote>{props.children}</blockquote>;
  const c = CALLOUTS[type] ?? CALLOUTS.note;
  const Icon = c.icon;
  return (
    <div className={`not-prose my-6 rounded-lg border p-4 ${c.cls}`}>
      <div className="flex items-center gap-2 font-medium">
        <Icon className="size-4 shrink-0" /> {props["data-title"] || c.label}
      </div>
      <div className="mt-2 text-sm text-foreground/90 [&_code]:rounded [&_code]:bg-foreground/10 [&_code]:px-1 [&>p+p]:mt-2">
        {props.children}
      </div>
    </div>
  );
}

/** <NewsList /> or <NewsList section="news" tag="release" /> — a list of posts that loads more on scroll */
function NewsList({ section, tag }: { section?: string; tag?: string }) {
  const scope = { section: section || undefined, tag: tag || undefined };
  const { items, total } = queryFeed(scope);
  return (
    <div className="not-prose my-6 -mx-3">
      <InfiniteItems scope={scope} initial={items} total={total} />
    </div>
  );
}

const enc = (p: string) => p.split("/").map(encodeURIComponent).join("/");

export function Markdown({ doc }: { doc: Doc }) {
  const resolve = (src: string) => {
    if (/^([a-z]+:)?\/\//i.test(src) || src.startsWith("/") || src.startsWith("data:")) return src;
    const rel = path.posix.normalize(path.posix.join(doc.relDir.split(path.sep).join("/"), decodeURIComponent(src)));
    return `/files/${enc(rel)}`;
  };
  return (
    <div className="prose prose-neutral dark:prose-invert max-w-none prose-img:rounded-lg prose-li:my-1 prose-h1:text-2xl prose-h2:mt-10 break-words [overflow-wrap:anywhere]">
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkCallouts]}
        rehypePlugins={[rehypeRaw, rehypeSlug, [rehypeHighlight, { detect: false, ignoreMissing: true }]]}
        components={({
          pre: Pre,
          newslist: NewsList,
          blockquote: Blockquote,
          table: ({ children }) => (
            <div className="my-6 overflow-x-auto rounded-lg border">
              <table>{children}</table>
            </div>
          ),
          // eslint-disable-next-line @next/next/no-img-element
          img: ({ src, alt }) => <img src={resolve(String(src ?? ""))} alt={alt ?? ""} loading="lazy" />,
          a: ({ href = "", children }) =>
            href.startsWith("/") || href.startsWith("#") ? (
              <Link href={href}>{children}</Link>
            ) : (
              <a href={href} target="_blank" rel="noreferrer">{children}</a>
            ),
        }) as Components}
      >
        {preprocess(doc.body)}
      </ReactMarkdown>
    </div>
  );
}
