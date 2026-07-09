# surajgaud.github.io

Personal site and writing, served directly by GitHub Pages from `main` — no build step runs in CI, so whatever's committed is what's live.

## Adding a new essay

1. Write the essay as `data/<slug>.md`. First line must be a single `# Title` (used as the page title everywhere).
2. Add an entry under the current month's `## Writing` section in `data/journal.md`:
   ```
   - [Title](essays/<slug>.html) | Blog | One-sentence excerpt.
   ```
   This file is the single source of truth for the homepage's Writing list and the `/journal.html` archive — both render from it at runtime.
3. Generate the static essay page:
   ```
   npm install   # first time only
   npm run build
   ```
   This runs `scripts/build-essays.js`, which reads every `data/*.md` (except `journal.md`) and writes a standalone `essays/<slug>.html` — real `<h1>`, meta description, OG/Twitter tags, canonical URL, and `BlogPosting` JSON-LD baked directly into the HTML, so it's readable by crawlers that don't execute JavaScript (GPTBot, ClaudeBot, PerplexityBot, CCBot).
4. If the essay needs a date/description in search results or link previews, add an entry to the `META` object in `scripts/build-essays.js` (mirrors the one in `blog.html`) — these aren't reliably derivable from the markdown alone.
5. Commit the `.md` source **and** the regenerated `essays/<slug>.html` together. `essays/` isn't build output in the disposable sense — it's what GitHub Pages actually serves, so it has to be committed.
6. Update `sitemap.xml` with the new essay URL.

## Local preview

No dev server is required for most of the site (plain HTML/CSS/JS), but `index.html`, `journal.html`, and `blog.html` fetch `data/*.md` at runtime, which browsers block under `file://`. Serve the repo root over HTTP to preview those:

```
npx http-server -p 8080
```

`essays/*.html` pages are fully static and work even via `file://`.

## Legacy: blog.html

`blog.html?post=data/<slug>.md` still works as a client-side renderer of any essay (kept for old bookmarked links), but its dynamic `<link rel="canonical">` points at the corresponding `essays/<slug>.html` — that's the URL that should be shared, indexed, and linked to.
