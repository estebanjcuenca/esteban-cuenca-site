## Why

The public portfolio currently exposes a full CV print/export system — a footer icon that generates a printable A4 document, plus DRIFT/100% Film/EAVE application-specific variants — to any visitor. The user wants to keep the public site focused purely on the portfolio (CV data still shown inline on the page, as it is today) and move the print/export/application-variant tooling to a separate `cv.estebancuenca.com` subdomain that isn't advertised or discoverable from the public site.

Reviewed and agreed with the user: the entry-point icon is removed from the public site; the export/print/variant system moves wholesale to a new, separate GitHub repo + Pages deployment at `cv.estebancuenca.com`; privacy is via an unindexed, unlinked subdomain (not real access control — GitHub Pages has no server-side auth, confirmed and accepted as the honest trade-off).

## What Changes

**Public site (`esteban-cuenca-site`):**
- Remove the footer "Export PDF" icon — the only entry point into print/export mode.
- Remove the now-unreachable print/export/CV-variant system entirely: the `#a4-stage` DOM tree, the `#toolbar-export` toolbar row (Back/1pg/DRIFT/100%/EAVE), the `#footer-export-actions` wrapper, and every supporting JS function (`isA4Mode` through `initA4Controls` — roughly 440 lines of the inline script).
- Remove the `<link rel="stylesheet" href="print.css">` tag and delete `print.css` from this repo (it moves to the new repo).
- **Explicitly preserved, unchanged**: the CV content still renders inline on the public page exactly as it does today (name, bio, all CV tables, section hide/show, dark mode) — only the print/export/variant overlay leaves, not the CV data itself.

**New repo + subdomain (`cv`, deployed at `cv.estebancuenca.com`):**
- A full duplicate of the current codebase (same technique as the earlier `beat-studio` extraction: separate GitHub repo, own Pages deployment, own `CNAME` file), keeping the entire print/export/CV-variant system intact and reachable there.
- `<meta name="robots" content="noindex, nofollow">` added, plus a `robots.txt` disallowing all crawlers — not access control, but keeps it out of search results.
- Requires the user to add a DNS `CNAME` record (`cv` → `estebanjcuenca.github.io`) at their domain registrar — outside what this session can do — and to confirm the custom domain in the new repo's GitHub Pages settings.

## Capabilities

### Modified Capabilities
- `portfolio-site` (from `remove-audio-beat-studio`, unarchived): adds a requirement that the public site does not expose print/export/CV-variant functionality or any entry point into it.

## Impact

- **Files removed from this repo**: `print.css`; the `#a4-stage`/`#toolbar-export`/`#footer-export-actions` DOM and ~440 lines of supporting JS in `index.html`.
- **Files unaffected**: `content.md`, `styles.css` (table/typography rules stay — those govern the inline CV view, not print), all portfolio content and images.
- **New repo created**: `cv` — full duplicate at the time of extraction, then diverges (keeps the print/export system; the public repo does not).
- **Out of this session's reach**: actual DNS configuration (CNAME record) and GitHub Pages custom-domain confirmation — the user does these themselves; this change delivers everything needed for them to do it in a few steps.
- **Honest limitation, stated plainly**: this is obscurity (unindexed, unlinked, unguessable-by-search subdomain), not real privacy — anyone who learns the URL can view it, since GitHub Pages cannot gate access server-side. Accepted by the user as a known trade-off.
