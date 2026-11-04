---
title: Newspaper is live — a news engine built on markdown
description: "No database, no logins: drop a .md file into a folder, run build — and the site is updated."
tags: [launch, engine]
date: 2026-11-03
---

![[cover.svg]]

Today we are launching **Newspaper** — a news feed engine that works directly with files.

## The idea

You write notes in Obsidian, upload the folder to your server and run `npm run build`. The engine does the rest:

- walks the directories and builds the menu from `meta.json`;
- reads `title`, `description` and `tags` from the file header;
- sorts the feed by file creation time and shows later edits as "updated";
- indexes the text for search — **Ctrl+K**.

See the guide [[Quick start]] for details.
