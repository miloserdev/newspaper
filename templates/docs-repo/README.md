# docs

Markdown content, published as a website with [newspaper](https://github.com/miloserdev/newspaper).

Only content lives here — the engine is fetched by the GitHub Actions workflow on every push.

## Layout

```
meta.json            site: title, description, icon, links, pages
index.mdx            home page (optional, can contain <NewsList />)
<section>/
  meta.json          { "root": true, "title": "...", "icon": "..." } → a menu item
  *.md               posts (title / description / tags / date in the frontmatter)
```

Root `meta.json` example:

```json
{
  "title": "docs",
  "description": "documentation from markdown files",
  "icon": "BookOpen",
  "links": [{ "title": "@miloserdev", "href": "https://miloser.dev" }],
  "pages": ["---Menu---", "readme", "---", "..."]
}
```

## Publishing

1. Settings → Pages → Source: **GitHub Actions**.
2. Push to `main` — the site is rebuilt and deployed to `https://<user>.github.io/<repo>/`.
3. After the *engine* changes, re-run the workflow (Actions → Deploy to GitHub Pages → Run workflow).

Every push and pull request first **validates** the content (front matter, `meta.json`, images, relative links); errors are shown as annotations on the changed files and stop the deploy. A pull request also builds a **preview** from its exact commit — download it from the workflow run's Artifacts and open it with any static server. Only pushes to `main` deploy.

Preview locally: clone the engine next to this repo and run
`CONTENT_DIR=../docs npm run dev` in it.

## Access to the engine repository

The workflow downloads the engine (`ENGINE_REPO` in the workflow) on every run.

- **Public engine repo** — nothing to do.
- **Private engine repo** — the default workflow token can only read *this* repo. Create a fine-grained personal access token with **read-only "Contents"** access to the engine repo, and save it in this repo as the secret `ENGINE_TOKEN` (Settings → Secrets and variables → Actions). The workflow picks it up automatically.

## Rebuilding when the engine changes

A content push rebuilds the site, but an engine update doesn't on its own. Options:

1. **Manually:** Actions → Deploy to GitHub Pages → Run workflow.
2. **On a schedule:** uncomment the `schedule:` block in the workflow.
3. **Automatically from the engine repo:** add a step there that fires the `engine-updated` event (needs a token with write access to this repo, stored in the engine repo as `DOCS_TOKEN`):

   ```yaml
   - run: gh api repos/<user>/docs/dispatches -f event_type=engine-updated
     env:
       GH_TOKEN: ${{ secrets.DOCS_TOKEN }}
   ```

   To keep builds reproducible, pin `ENGINE_REF` to a tag and bump it deliberately instead.
