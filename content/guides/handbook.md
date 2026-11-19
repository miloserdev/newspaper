---
title: The Newspaper handbook
description: A long, structured guide with several levels of headings — handy for trying out the "On this page" table of contents.
tags: [guide, handbook, markdown]
date: 2026-11-18
---

This page is intentionally long. It has several top-level parts (`#`), sections (`##`), subsections (`###`) and a few deep ones (`####`), so you can scroll and watch the table of contents follow you. The content is real, too — it doubles as a compact manual for the engine.

# Part 1 — Getting started

Everything in Newspaper starts with a folder of markdown files. There is no database, no admin panel and no build-time configuration beyond a single `config.ts`.

## Installing

You need Node.js 20.9 or newer. Clone the repository and install the dependencies:

```bash
git clone https://github.com/miloserdev/newspaper.git
cd newspaper
npm install
```

### Running the dev server

```bash
npm run dev
```

The dev server re-reads your files on every request, so edits show up immediately — including new files, renamed folders and changes to `meta.json`.

### Building for production

```bash
npm run build
npm start
```

A production build prerenders the pages and the search index. New files appear after the next build.

## Your first post

Create `content/news/hello.md`:

```md
---
title: Hello, world
description: My very first post.
tags: [intro]
---

Some **markdown** here.
```

> [!tip] No frontmatter? No problem
> If you skip the frontmatter, the title is taken from the first `# H1` and the description from the beginning of the text.

### Where the date comes from

The date shown in the feed is, in order of priority:

1. `date:` in the frontmatter;
2. the first git commit of the file (in the GitHub Pages workflow);
3. the file's creation time.

#### Time zones

Dates are formatted on the server, so everyone sees the same day regardless of their own time zone.

# Part 2 — Organizing content

## Sections

A **section** is a folder that contains a `meta.json` with `"root": true`. It becomes an item in the left menu.

```json
{
  "title": "Guides",
  "description": "How to use the engine",
  "$id": "guides",
  "root": true,
  "icon": "GraduationCap",
  "color": "hsl(217 90% 65%)"
}
```

### Icons and colors

Any [lucide](https://lucide.dev/icons) icon name works (`Cpu`, `FlaskConical`, `Newspaper`). The `color` is used for the menu icon — and for the table of contents on this very page.

### Nested sections

A section inside a section becomes a child item in the menu. The parent's feed includes the posts of all its children.

## Ordering

Without any configuration everything is sorted by date. When you need a specific order, use `pages` in `meta.json`.

### Menu order

```json
{ "pages": ["news", "guides", "---Community---", "events", "---", "..."] }
```

- `"---"` draws a divider, `"---Label---"` a divider with a caption;
- `"..."` stands for "everything not listed above".

### Pinned posts

In a section's `meta.json`, `pages` can also list posts by file name. Listed posts go first, in the given order; the rest keep the date order.

#### Pinning to the bottom

Put `"..."` before a name to send that post to the end of the feed.

## Pages without a section

Files outside of any `root` folder are ignored. The only exception is `index.md` (or `index.mdx`) in the content root — it becomes the home page.

# Part 3 — Writing

## Markdown you can use

Everything from GitHub-flavoured markdown works: tables, task lists, strikethrough, autolinks and fenced code.

### Text and links

You can write **bold**, *italic*, ~~strikethrough~~ and `inline code`. Links can be [external](https://nextjs.org), relative, or Obsidian-style wikilinks like [[Quick start]] or [[Deploying to a server|the deploy guide]].

### Lists

- Unordered
  - Nested
    - Deeply nested
- Another item

1. First
2. Second
   1. Nested numbered
   2. Another one

### Task lists

- [x] Write the post
- [x] Add tags
- [ ] Publish

### Tables

| Feature | Dev | Production | Static export |
| --- | :---: | :---: | :---: |
| Live reload | yes | — | — |
| Search | yes | yes | yes |
| Needs a server | yes | yes | no |

## Code blocks

Code gets syntax highlighting and a copy button.

### TypeScript

```ts
export async function GET(req: Request) {
  const url = new URL(req.url);
  const query = url.searchParams.get("q") ?? "";
  return Response.json({ query, results: [] });
}
```

### Shell

```bash
STATIC_EXPORT=1 BASE_PATH=/my-repo npm run build
npx serve out
```

### Long lines

```text
This line is intentionally very long to check that the block scrolls horizontally instead of breaking the layout of the page around it, even on a narrow screen.
```

## Callouts

Obsidian-style callouts are supported out of the box.

> [!note] A note
> Notes are blue and good for neutral remarks.

> [!warning] Careful
> Warnings are amber. Use them for things that can bite.

> [!danger] Danger
> Danger is red. Reserve it for destructive operations.

> [!success] Done
> Success is green.

## Images and files

Drop an image next to your post and reference it with the usual syntax or the Obsidian embed:

```md
![A cover](cover.png)
![[cover.png]]
```

#### Sizes

Obsidian's size suffix (`![[cover.png|300]]`) is accepted and ignored.

# Part 4 — Search and navigation

## Search

Press <kbd>Ctrl</kbd>+<kbd>K</kbd> anywhere. Search covers titles, descriptions, tags and the full text.

### How ranking works

Titles weigh the most, then tags, then descriptions, then the body. Matching is prefix-based and tolerates small typos.

### Russian and other languages

A light stemmer for Cyrillic means that searching for «новость» also finds «новости».

## Tags

Every tag has its own page at `/tag/<tag>`. Tags with a slash (`project/alpha`) are supported too.

## Table of contents

The panel on the right — the one you are probably looking at right now — is generated from the headings of the page.

### On wide screens

It is pinned next to the article, with a thin track line, a thumb that follows the headings in view and the accent color of the section.

### On narrow screens

It collapses into a small "On this page" block under the description.

# Part 5 — Publishing

## GitHub Pages

Push the repository and enable Pages with the **GitHub Actions** source. The workflow builds a static export and deploys it.

### Base path

For a project site (`user.github.io/repo/`) the workflow sets `BASE_PATH=/repo` automatically.

### Dates from git

A fresh checkout gives every file the same timestamp, so the workflow reads dates from the git history instead.

## A separate content repository

Keep the engine in one repository and the markdown in another. The content repository's workflow checks out the engine and builds it against the content.

### Updating the engine

Re-run the workflow in the content repository after the engine changes.

## Self-hosting

Run `npm run build && npm start` behind any reverse proxy. Set `PORT` to change the port.

# Part 6 — Troubleshooting

## The site title is wrong

Check the `meta.json` in the root of the content folder. Comments and trailing commas are fine; real syntax errors are reported in the build log.

## A section is missing

The folder needs a `meta.json` with `"root": true`. Files outside of such folders are ignored.

## The build fails with an empty route

Static export needs at least one route per dynamic segment; the engine already handles content without images or tags.

### Still stuck?

Open an issue in the repository and attach the build log.

# The end

That's the whole tour. Scroll back up and click any heading in the table of contents to jump there.
