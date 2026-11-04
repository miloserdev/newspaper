---
title: Deploying to a server
description: Uploaded the files, ran npm run build — the site is updated.
tags: [deploy, guide]
date: 2026-10-25
---

```bash
rsync -av vault/ server:/srv/newspaper/content/
ssh server 'cd /srv/newspaper && npm run build && pm2 restart newspaper'
```

No database: the structure is built by walking the directory, so syncing the files is enough.
