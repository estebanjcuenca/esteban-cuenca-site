## MODIFIED Requirements

### Requirement: Print and export CV tooling lives on a separate, unindexed subdomain
The public portfolio site SHALL NOT expose any print/export/CV-variant functionality or any entry point into it (no visible icon, button, or reachable UI path). The full print/export system — full multi-page print, one-page mode, the DRIFT resume variant, the 100% Film resume variant, and the EAVE motivation statement variant — SHALL instead be available at a separate `cv.estebancuenca.com` subdomain, excluded from search indexing.

#### Scenario: No export entry point on the public site
- **WHEN** a visitor loads the public portfolio site and inspects the toolbar and footer
- **THEN** there is no icon, button, or other control that triggers print/export mode, and no way to reach it through the public site's UI

#### Scenario: No reachable print/export code on the public site
- **WHEN** the public site's shipped `index.html` and CSS are inspected
- **THEN** they contain no print/export/CV-variant DOM (`#a4-stage`, `#toolbar-export`, `#footer-export-actions`) and no supporting JavaScript for it, and `print.css` is not linked or present

#### Scenario: Full export system available on the CV subdomain
- **WHEN** a visitor with the `cv.estebancuenca.com` URL loads that site
- **THEN** the standard multi-page print/export, one-page mode, and the DRIFT, 100% Film, and EAVE variants all render and function exactly as they did on the public site before this change

#### Scenario: CV subdomain excluded from search indexing
- **WHEN** a search engine crawler requests the CV subdomain
- **THEN** a `noindex, nofollow` robots meta tag and a disallow-all `robots.txt` are both present, though the page remains technically reachable by anyone with the direct URL (no server-side access control exists on this static hosting — an accepted, stated limitation, not a claim of real privacy)

## ADDED Requirements

### Requirement: Inline CV content on the public site is unaffected
The public site SHALL continue to render the full CV inline on the page (name, bio, all sections and tables, section hide/show, dark mode) exactly as before this change — only the print/export/variant overlay is removed, not the underlying CV content or its display.

#### Scenario: Public site still shows the full CV
- **WHEN** a visitor loads the public portfolio site
- **THEN** all CV sections, tables, and content render inline exactly as they did before this change, with no reduction in visible information
