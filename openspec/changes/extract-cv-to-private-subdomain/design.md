## Context

Verified in-session, exact locations in the current `index.html`:
- `#toolbar-export` (Back/1pg/DRIFT/100%/EAVE toolbar row): lines 68-74.
- `#a4-stage` (the two A4 pages + EAVE/EAVE-IPP letterhead pages): lines 94-130.
- The footer export icon + hidden `#footer-export-actions`: generated dynamically inside `render()`'s `footerRight.push(...)` call, lines 571-581.
- The entire print/export/CV-variant JS system: `PRINT_PAGE_H_PX` (line 631) through the end of `initA4Controls()` (line ~1063) — `isA4Mode`, `isOnePageMode`, `isEaveMode`, `setOnePageMode`, the whole `CV_VARIANTS` system, `setEaveMode`, `activeNavBar`, `applyWorkScale`, `autoFitWorkScale`, `distributeOnePageSectionGap`, `preparePrintLayout`, `syncA4ToolbarOffset`, `updateA4ViewportScale`, `mountA4Content`, `unmountA4Content`, `syncExportNav`, `setA4Mode`, `enterExportMode`, `exportA4`, `initA4Controls`.
- `document.addEventListener('DOMContentLoaded', ...)` currently calls `setA4Mode(false); render(); initA4Controls();` — needs `setA4Mode(false)` and `initA4Controls()` removed, `render()` kept.
- **Found during review, unrelated pre-existing leftover**: `#beat-guide` markup (lines 133-136) is dead HTML from the audio/beat-studio removal — its `.beat-guide` CSS was already deleted in that change, and no JS references it. Not part of this change's scope, but touched in the same edit pass since it's adjacent; removed as a small bonus cleanup.
- `#print-work` (the CV content container that `mountA4Content`/`unmountA4Content` move in and out of the A4 pages) stays exactly as-is — it's the always-visible CV content wrapper, not export-specific, just happened to be referenced by the code being removed.

GitHub Pages serves one custom domain per repository (via its `CNAME` file); it cannot host two distinct domains from one repo. The `beat-studio` extraction earlier in this project already established the working pattern for this: a separate GitHub repo, its own Pages deployment, its own `CNAME` file.

## Goals / Non-Goals

**Goals:**
- Public site: zero reachable UI path or shipped code for print/export/CV-variant functionality; CV content itself (name, bio, sections, tables) renders exactly as before.
- New `cv` repo: full print/export/CV-variant system intact and working, at `cv.estebancuenca.com`, marked `noindex`.
- Be explicit with the user about what "private" actually means here (unindexed + unlinked, not access-controlled) so no false expectation is created.

**Non-Goals:**
- Not implementing real access control (password, auth) — the user explicitly chose the obscurity approach knowing the limitation.
- Not changing `content.md`, `styles.css`'s CV/table rules, or any portfolio content.
- Not configuring DNS or GitHub Pages custom-domain settings ourselves — outside this session's reach; delivered as clear steps for the user.

## Decisions

1. **New repo via the same pattern as `beat-studio`.** Create a GitHub repo named `cv`, push a full duplicate of the current `esteban-cuenca-site` codebase to it (at the commit right before this change's removals, so it captures the working print/export system intact), set its `CNAME` file to `cv.estebancuenca.com`, add `noindex` meta + `robots.txt`.
   - Alternative considered: a private GitHub repo instead of a public one with `noindex`. Rejected for now — GitHub Pages from a private repo requires GitHub Pro/Team, which may not be available on the user's plan; `noindex` + obscurity was the user's explicit choice, consistent either way. If the user later has a paid plan, flip the new repo to private for a real (if still not bulletproof) access improvement — noted as a follow-up, not done now.

2. **Remove the print/export system from the public repo entirely, not just its entry point.** The user asked to remove "the icon," but leaving ~440 lines of now-unreachable JS and the associated DOM/CSS behind would violate the "no traces of a removed feature" precedent already set in `remove-audio-beat-studio`. Since the toolbar-export row is only ever shown via `setA4Mode(true)`, and the only path to that is the icon being removed, the whole system becomes dead code — removed wholesale.

3. **`print.css` moves, doesn't stay.** It has no purpose on the public site once the A4/export DOM it styles is gone. Deleted here, kept in the new `cv` repo.

4. **`styles.css` is not touched.** It contains the CV table/typography rules that govern the inline, on-page CV display — unrelated to print/export, confirmed by checking there's no `.a4-` or print-specific selector logic there (that all lives in `print.css`).

## Risks / Trade-offs

- **[Risk]** Removing the JS block accidentally removes a function still called from somewhere else (e.g. `render()` calling into A4 code) → **Mitigation**: grep the removed function names against the surviving code after deletion, not just visually confirm the block boundaries.
- **[Trade-off]** The new `cv` repo is a full duplicate at extraction time, meaning any future edit to shared code (styles.css table rules, content.md) needs to be manually ported to both repos if the user wants them to stay in sync — same trade-off already accepted for `beat-studio`. Not solved here; noted for the user.
- **[Honesty, not a risk to mitigate]** `noindex` + an unlinked subdomain is not real privacy. Stated plainly in the proposal and in the handover, not glossed over.

## Migration Plan

1. Create the `cv` GitHub repo, push a full duplicate of the current codebase (before removals).
2. Add `noindex` meta tag + `robots.txt` disallow-all to the new repo. Set its `CNAME` file.
3. Give the user the exact DNS record to add (`CNAME cv → estebanjcuenca.github.io`) and where to confirm the custom domain in the new repo's Pages settings.
4. In the public repo: remove the DOM (`#toolbar-export`, `#a4-stage`, the footer export button + `#footer-export-actions`, and the stray `#beat-guide` leftover), the JS block, and the `DOMContentLoaded` calls into it.
5. Remove the `print.css` `<link>` tag and delete the file from the public repo.
6. Full regression pass: console clean, dark mode, section hide/show, CV tables, hero CTA all still work; confirm no leftover reference to any removed function/DOM id anywhere in the public repo.
7. Commit the public-repo removal; commit + push the new `cv` repo.
