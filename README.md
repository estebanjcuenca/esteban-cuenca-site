# Esteban Cuenca — Personal Site

Portfolio site for film & immersive producer Esteban Cuenca. No build step.

## Structure

- `index.html` — markup and JS
- `fonts.css` — PP Radio Grotesk `@font-face` rules (base64-embedded)
- `styles.css` — all other CSS (tokens, layout, dark mode, print, etc.)
- `content.md` — all site content (markdown + frontmatter). **Edit this to change content.**
- `photo.jpg` — hero photo, referenced via `photo:` in the frontmatter
- `privacy.html` — standalone privacy policy page, linked from footer via `privacy:` in frontmatter

## How it works

On load, the JS fetches `content.md`, parses the frontmatter (`photo`, `subtitle`, `location`, `email`, `privacy`) and markdown body, and renders the DOM.

## Local preview

Because content is fetched at runtime, the site must be served over HTTP — opening `index.html` directly from the file system will show a load error. Either:

```bash
python3 -m http.server      # then open http://localhost:8000
```

or use the Live Server extension in Cursor/VS Code.

## ⚠️ Note for tool-assisted editing

`index.html` has two script tags: `<script type="application/ld+json">` in `<head>` (SEO) and one bare `<script>` (no attributes) at the end of `<body>` — the actual JS. The embedded markdown block from the single-file era is gone; content now lives in `content.md`.

## Design system

- Font: PP Radio Grotesk (Regular, Italic, Black) — base64-embedded in `<style>`
- CSS tokens: `--ink` `--bg` `--mid` `--border` `--pad-x`
- Dark mode: `html.dark` class, toggled via `◐` button, persisted in `localStorage` (key `ec-dark`)
- Layout: desktop = text left + sticky photo right (54%); mobile = photo top, text below

## Features (verified working as of 2026-06-10)

- Markdown-driven content rendering (fetched from `content.md`, with a friendly error if not served over HTTP)
- Dark/light mode with localStorage persistence
- Section hide/show with localStorage persistence
- Scroll fade-in animations (IntersectionObserver)
- Web Audio harmonic sound system (table-row hover plays notes); Sound: Off/On toggle, defaults Off
- ⛥ icon opens sound settings panel (wave, volume, attack, decay, detune, root)
- Print CSS (A4, hides UI, respects hidden sections)
- Mobile responsive layout
- SEO: meta description, Open Graph tags, JSON-LD Person schema (top of `<head>`, before the heavy font CSS, so link-preview scrapers see them)

## TODO

- [ ] **Replace `https://yourdomain.com` placeholders** in OG tags and JSON-LD with the real URL once domain / GitHub Pages URL is known
- [x] Extract base64 photo to `photo.jpg`, reference via frontmatter — done 2026-06-10
- [x] Extract markdown content to `content.md` — done 2026-06-10
- [ ] Persist sound settings panel values to localStorage (`Sound.params` resets on reload)
- [ ] Mobile: sound panel should be a bottom sheet on small screens (currently side panel)
- [ ] Mobile: toolbar has too many buttons at small breakpoints
- [ ] Deploy to GitHub Pages

## Deploy (GitHub Pages)

```bash
git init
git add .
git commit -m "Initial commit: single-file portfolio site"
git branch -M main
git remote add origin git@github.com:USERNAME/REPO.git
git push -u origin main
```

Then: repo → Settings → Pages → Source: "Deploy from a branch" → branch `main`, folder `/ (root)` → Save. Site appears at `https://USERNAME.github.io/REPO/` within a minute or two.
