import type { Metadata } from "next";
import "./globals.css";
import { config } from "@/config";
import { getMenu, getSite } from "@/lib/content";
import { Sidebar } from "@/components/sidebar";
import { ThemeProvider } from "@/components/theme-provider";
import { SearchProvider } from "@/components/search";
import { SectionIcon } from "@/components/icons";

export function generateMetadata(): Metadata {
  const site = getSite();
  return {
    title: { default: site.title, template: `%s — ${site.title}` },
    description: site.description,
  };
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const site = getSite();
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="h-dvh overflow-hidden antialiased">
        <ThemeProvider>
        <SearchProvider>
          <div className="flex h-full flex-col lg:flex-row">
            <Sidebar siteName={site.title} siteIcon={<SectionIcon name={site.icon} color={site.color} className="size-5" />} items={getMenu().map((m) =>
              m.kind === "section"
                ? { kind: "section" as const, title: m.section.title, slug: m.section.slug, count: m.section.count, depth: m.section.depth, icon: <SectionIcon name={m.section.icon} color={m.section.color} className="size-4" /> }
                : m,
            )} links={config.links} />
            <main className="flex min-h-0 min-w-0 flex-1">{children}</main>
          </div>
        </SearchProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
