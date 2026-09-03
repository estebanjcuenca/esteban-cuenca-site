## 1. Create the `cv` repo (full duplicate, print/export system intact)

- [x] 1.1 Created (by the user) — `https://github.com/estebanjcuenca/cv.git`
- [x] 1.2 Pushed a full duplicate of the current codebase (pre-removal HEAD `10505234`) to it — also cleaned up an unrelated leftover untracked `shared/` directory (dead experiment from earlier this session) that had accidentally been copied along
- [x] 1.3 Added `<meta name="robots" content="noindex, nofollow">` to its `index.html`
- [x] 1.4 Replaced `robots.txt` with a disallow-all
- [x] 1.5 Set `CNAME` to `cv.estebancuenca.com`
- [x] 1.6 Committed and pushed — also removed `sitemap.xml` (referenced the wrong domain, irrelevant to an unindexed site), `BEATSTUDIO.md` (unrelated), and `openspec`/`.claude` (planning tooling, not needed in a content-mirror repo)

## 2. Hand the user the DNS/Pages steps they need to do themselves

- [ ] 2.1 Give the exact DNS record to add at their registrar: `CNAME cv → estebanjcuenca.github.io`
- [ ] 2.2 Give the exact steps to confirm the custom domain in the new repo's GitHub Pages settings (Settings → Pages → Custom domain → `cv.estebancuenca.com` → Save; wait for DNS check to pass; optionally enforce HTTPS once available)
- [ ] 2.3 Be explicit that this step needs the user's own DNS registrar access and can't be done from this session

## 3. Remove the print/export system from the public site — DOM

- [x] 3.1 Removed the `#toolbar-export` div
- [x] 3.2 Removed the `#a4-stage` div (both A4 pages, EAVE/EAVE-IPP letterhead pages)
- [x] 3.3 Removed the footer export icon button + `#footer-export-actions`
- [x] 3.4 Removed the stray `#beat-guide` markup
- [x] 3.5 Verified: zero remaining DOM references to any removed id; only JS `getElementById` calls remain (2, to be removed in section 4)

## 4. Remove the print/export system from the public site — JS

- [x] 4.1 Removed the full block from `PRINT_PAGE_H_PX` through the end of `initA4Controls()`
- [x] 4.2 Updated `DOMContentLoaded`: removed `setA4Mode(false);` and `initA4Controls();`, kept `render();`
- [x] 4.3 **Found an additional leftover during the grep sweep**: `render()` itself still called `CV_VARIANTS.forEach(...)` and `parseCvVariantParas(...)` (both now-deleted) to separate `{drift}`/`{100film}` sections, plus wrote `{eave}`/`{eave-ipp}` content into the now-removed `#a4-eave-page`/`#a4-eave-ipp-page` elements. Simplified to a plain filter (`sections = sections.filter(s => !s.title.includes(...))` for all four markers) that keeps the essential behavior — these application-only sections still don't leak into the inline CV — without any dead references or no-op DOM writes. Re-ran the full grep after this fix: zero remaining references to any removed function, variable, or DOM id
- [x] 4.4 Removed the `<link rel="stylesheet" href="print.css">` tag
- [x] 4.5 Deleted `print.css` (`git rm`)
- [x] 4.6 (added) Verified JS syntax validity with `node --check` on the extracted inline script — passes clean

## 5. Full verification pass

- [x] 5.1 Loaded the public site fresh — console clean, zero messages
- [x] 5.2 Verified via DOM: `#footer-actions`/`#btn-export` both gone; confirmed visually — footer shows only email, Privacy Policy, location, copyright
- [x] 5.3 Verified: hero, bio, all 4 section headers (clean, no leaked `{drift}`/`{eave}` markers), dark mode toggle, and section hide/show all still work exactly as before
- [x] 5.4 Verified via fresh network capture: exactly 7 requests on load, `print.css` not among them (previous stale capture had shown it from an earlier, pre-change test — cleared and re-verified fresh)
- [x] 5.5 Served the `cv` repo locally on a separate port and verified: `enterExportMode()`/`isA4Mode()` work, `#btn-drift` exists and `isDriftMode()` toggles correctly, `#btn-export` still exists there, `noindex, nofollow` meta confirmed, `robots.txt` disallow-all confirmed

## 6. Commit

- [x] 6.1 Confirmed: `index.html` (-556 net lines) and `print.css` (deleted, -678 lines) only; 2 files changed, 11 insertions(+), 1234 deletions(-)
- [x] 6.2 Commit the public repo with a clear message referencing this OpenSpec change
- [x] 6.3 Confirmed the `cv` repo is pushed (`git ls-remote` verified earlier in section 1)
