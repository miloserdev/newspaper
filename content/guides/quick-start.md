---
title: Quick start
description: From cloning the repository to your first post in five minutes.
tags: [start, guide]
date: 2026-10-30
---

1. Put your files into `contentDir` (set in `config.ts`).
2. In every section directory create a `meta.json`:

```json
{
  "title": "News",
  "$id": "news",
  "root": true,
  "icon": "Newspaper",
  "color": "hsl(168 76% 45%)"
}
```

3. Run `npm run dev` and open <http://localhost:3000>.

Next — [[Deploying to a server]].
