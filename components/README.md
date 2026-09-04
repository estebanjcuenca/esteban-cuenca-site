# Components

Small, single-purpose render functions extracted from `index.html`'s inline
render script. This is a structural refactor only — every function here
produces byte-identical HTML to what the inline script generated before
extraction. No visual or behavioral change.

## Convention

- **One function per file.** The file's basename names its function
  (`recordRow.js` exports `recordRow`, etc.) — no exceptions, so there's
  never a question of where a given piece of markup lives.
- **No build step, no ES modules.** Each file is a plain `<script>` tag,
  loaded via a classic (non-module) `<script src="components/...">` in
  `index.html`, before the inline render script that calls them.
- **Namespaced on `window.Components`** to avoid global-scope collisions
  across files: `window.Components.recordRow(...)`,
  `window.Components.entityBlock(...)`, etc. Each file does
  `window.Components = window.Components || {};` at the top so load order
  between component files doesn't matter (they only get *called* later, at
  `render()` time, by which point every script tag — components and the
  inline script — has already executed and defined its globals).
- **Functions take a plain data object (or primitive) and return an HTML
  string.** No DOM node construction, no template engine — this matches the
  rest of the codebase's string-building style, so the diff against the
  prior inline logic stays mechanical.
- Components call shared helpers (`parseInline`, `slugify`, etc.) as
  globals — those are still defined in the inline script in `index.html`
  and are available on `window` by the time any component function actually
  runs (component *files* just declare functions at load time; nothing in
  them executes until `render()` calls them).

## Files

| File | Exports | Used by |
|---|---|---|
| `statusDot.js` | `statusDot(done)` | `recordRow.js` (status column) |
| `entityBlock.js` | `entityBlock(title, sub?)` | `formatCell`, `splitEntityCell` in `index.html` |
| `paragraphBlock.js` | `paragraphBlock(text)` | bio render + section paragraphs in `index.html` |
| `footerLink.js` | `footerLink({wrapCls?, anchorCls?, href?, text})` | footer assembly in `render()` |
| `recordRow.js` | `recordRow({raw, html, canon})` | `buildTable` in `index.html` |
| `section.js` | `section({id, title, bodyHtml})` | the `sections.map(...)` call site in `render()` |

Note the scope boundary: this table only covers *repeated, parameterized*
render patterns. The toolbar and hero markup are static, singular HTML
directly in `index.html`'s body — they have real Figma representations (see
below) but deliberately no `components/*.js` file, since there's no
code-side reuse case to extract.

## Figma design system

Two changes built this out, in order:

1. **`componentize-figma-design-loop`** (archived) — proved the Figma
   push→edit→pull loop once, on one component (`recordRow`), as a flat
   frame. Established the MCP connection, this mapping file's original
   format, and the `design-sync` capability (now in `openspec/specs/`).
2. **`figma-design-system-buildout`** — turned that one proof into an
   actual design system: true Components with variants, full token
   coverage, a whole-site assembly, and interaction sketches. Everything
   below describes what that second change built.

Figma's official Code Connect framework integrations (React/Web
Components/SwiftUI/Compose) don't cover vanilla JS like this, and its
framework-agnostic `.figma.ts` template files are treated as optional
future polish, not a dependency — `figma-map.json` is the whole mechanism.

### True Components, not flat frames

Every pushed/built piece is a real Figma `COMPONENT` or `COMPONENT_SET` —
instanceable, with real component properties for variable content — never
a flat frame that just happens to look right once. Coverage is scoped by
**design-system completeness**, not by whether something has a
`components/*.js` file: the toolbar, hero, and several small interactive
atoms (hide/show button, dark-mode button, scroll-CTA, an underline-mark
reference, image treatments) exist as real Figma Components with no code
counterpart, because a design system needs every visually distinct,
stylable piece represented, not just the code's repeated patterns.

**Inventory** (file/team: `Z5ovK9oyPY12Y4cMkexbHq` in the `EstebanCuenca`
team — see `figma-map.json` for exact node IDs):

| Layer | Piece | Page | Variants |
|---|---|---|---|
| Atom | `statusDot` | Core | Done / WIP |
| Atom | `entityBlock` | Core | WithSub / NoSub |
| Atom | `paragraphBlock` | Core | — |
| Atom | `footerLink` | Core | Privacy / Location / Copyright / Email |
| Atom | Hide/Show Toggle | Core | Default / Hover / Toggled-Show |
| Atom | Dark Mode Toggle | Core | Default / Hover |
| Atom | Scroll CTA | Core | Default / Hover |
| Atom | Underline Mark (Link demo) | Core | Default / Hover |
| Atom | Hero Photo | Theme | — (real photo, grayscale via blend mode) |
| Atom | Favicon | Theme | — |
| Molecule | Section Header | Core | — (nests Hide/Show Toggle) |
| Molecule/Organism | `recordRow` | Theme | state × breakpoint (4) |
| Organism | `section` | Theme | — (nests Section Header) |
| Organism | toolbar | Theme | — |
| Organism | hero | Theme | breakpoint (Desktop/Mobile) |
| Organism | footer | Theme | breakpoint (Desktop/Mobile) |

Nested composition mirrors the JS call graph on purpose: `recordRow`
nests real instances of `statusDot` and `entityBlock` (matching how
`recordRow.js` calls `Components.statusDot()`/`entityBlock()`), rather
than flattening everything into one frame's layers.

### Content: real records + component properties, not lorem ipsum

Content-sensitive fields are Figma **component properties** (TEXT for
content, BOOLEAN for presence/absence — e.g. `hasFestivals`/`hasAwards` on
`recordRow`, which genuinely collapses that row when false, matching the
real `td:empty` CSS behavior). Real content from `content.md` ships as the
defaults (all public Film/Commercial/Events/Education records are pushed
as real instances); a synthetic "heavy" stress instance tests wrapping
under content longer than anything currently real.

**One real limitation, confirmed live, not assumed**: a nested instance's
own component properties (e.g. `entityBlock`'s `title`/`sub`) can't be
exposed up to its parent (`recordRow`)'s property panel — Figma rejects
that specific pass-through for TEXT properties. To change a record's
title/subtitle, select the nested `entityBlock` instance directly (one
extra click) rather than doing it from `recordRow`'s own panel.

### Instance-override discipline

A Figma instance stays linked to its master for everything it hasn't
explicitly overridden — editing the master ripples to every instance
*except* what that instance overrode via a component property, a swapped
nested instance, or a toggled visibility. `Detach Instance` is the only
thing that permanently severs the link, and is treated as a last resort,
not a normal workflow step. Rule: anything expected to vary per-instance
becomes a component property; a manual override is for genuine one-offs
only.

### Redesign-proofing: tokens/styles only, no exceptions

No component may bind a fill, size, or spacing value to a literal when a
token exists for it — verified programmatically after every phase (0
unbound colors, 0 unbound font sizes across 297 text nodes in the final
audit). Every container uses auto-layout, not fixed `x`/`y`. This protects
the same "one `content.md`, everything renders automatically" property the
codebase already has, applied to the design side: a redesign becomes
"change token values," not "manually re-touch every node."

### Token collections

Three Figma variable collections (not one — `styles.css` has two
independent mode axes, and a Figma collection only supports one):

- **Colors** (Light/Dark modes) — `ink`, `mid`, `bg`, `line`, plus the
  `a4-*` set (forced print palette, same value both modes since it's
  theme-independent by design).
- **Sizes** (Desktop/Mobile modes) — `bar-h`, `nav-size`, `body-size`,
  `bio-size`, `pad-x`, `space-xl/lg/md/sm`, `a4-page-w/h`, plus two
  Figma-only variables with no real CSS token backing them:
  `name-size` (`#cv-name`'s inlined clamp) and `ent-title-size`/
  `ent-sub-size` (`.ent-title`/`.ent-sub`'s desktop em-relative sizing /
  mobile dedicated clamps).
- **Typography** (Primary/Alt modes) — `font-family`, a `FONT_FAMILY`-
  scoped `STRING` variable for typeface exploration (verified live: this
  binding mechanism works the same way color variables do; the value
  space is limited to fonts available to this MCP connection — no
  `PPRadioGrotesk`, the site's real self-hosted font).

**Reference viewports are real, computed numbers**, not arbitrary choices:
Desktop mode = the value at **1600px** (verified as the exact width where
every desktop-scale `clamp()` token is simultaneously saturated to its
max); Mobile mode = the value at **390px** (a standard phone width inside
the real `≤768px` breakpoint — some tokens needed correcting here, since a
mobile clamp's *max* isn't the same as its value at an actual phone
width). **For a bound value to resolve correctly by breakpoint, the
consuming context needs an explicit mode set** on the Sizes collection
(`setExplicitVariableModeForCollection`) — without one, everything
silently resolves to the collection's default (Desktop) mode regardless of
which breakpoint variant it's in. Both assembly pages (below) set this
explicitly; a new page assembling Mobile content needs to as well.

### Whole-site assembly

Two Figma `SECTION`s on the Theme page — "Site — Desktop" (1600px) and
"Site — Mobile" (390px) — assembled entirely from real instances (never
copies) in the site's actual order, with every real public record from
`content.md` across all four tables (Film & Immersive Work, Commercial
Production, Events & Jury, Education & Languages). This is a visual-QA /
reuse-proofing artifact, separate from the push/pull loop — editing an
instance inside it doesn't drive a resync; that stays scoped to each
component's own mapped node.

### Core vs. Theme: built for reuse from day one

The Figma file's pages split generic, theme-agnostic structure (**Core** —
atoms/molecules with no this-site-specific token *values*) from this
project's real content/values (**Theme — EstebanCuenca CV**). The
`EstebanCuenca` Figma team is now on a Professional plan (upgraded
mid-change), so "Core" could be published as a real Team Library if ever
useful for another project — the split already exists either way, so nothing
needs restructuring first.

### Ideas / Unused page + lifecycle status

Anything speculative, exploratory, or not (yet) adopted lives on a
dedicated **Ideas / Unused** page, kept visually separate from production
work. Every `figma-map.json` entry carries a `status`:
`active` | `idea` | `deprecated` | `speculative`. Only `active` entries are
ever valid resync targets — this is how a `speculative` piece (like the
Project Detail template below) can exist in the file without ever being
mistaken for something with a real `components/*.js` counterpart to pull
into.

**`Project Detail (speculative)`** anticipates a real, still-undecided
product question (does a per-project detail page exist? what content moves
there vs. staying in the web/CV tables?) without deciding it. It includes a
named `project-image-fill` slot (same grayscale-via-blend-mode technique as
Hero Photo) for whenever a per-project media schema is decided — see
`openspec/changes/figma-design-system-buildout/design.md` § Open Questions
for both of these tracked-but-deliberately-unresolved decisions.

### Interaction sketches

Three real site behaviors sketched using Figma's native prototyping
(`node.reactions`), each verified by reading the reaction data back off the
node: dark/light toggle (`SET_VARIABLE_MODE` on the Colors collection — a
close mechanistic match, since the site's real toggle *is* a token-value
swap), section hide/show (Smart Animate between toggle variants), row hover
(Smart Animate to the Hover variant). These are sketches for a human/Claude
to translate into real code on a future resync — not codegen. Figma's
interaction model has no equivalent to this site's actual stateful,
localStorage-backed JS behavior.

### Mapping file (`figma-map.json`)

One JSON file holding:

- `team` — `EstebanCuenca` (`team::1677721160377991729`), confirmed live
  via `whoami`, not `Raff` (the account's other team).
- `referenceViewports` — the 1600px/390px reference widths above, with why.
- `components` — keyed by component **filename**, each entry holding
  `status`, `fileKey`, `frameId`/`nodeId`, `variantNodeIds` (for
  `COMPONENT_SET`s), `componentProperties`, `contentInstances` where
  relevant, and `lastSynced` (stays `null` until a resync pull actually
  happens — a push alone doesn't set it).
- `organisms` — toolbar/hero/footer: no `components/*.js` counterpart, so
  a separate section from `components` above, same field shape.
- `atoms` — the small Core-page pieces with no dedicated file section of
  their own.
- `ideas` — speculative/non-active work, e.g. the Project Detail template.
- `interactionSketches` — the three prototype reactions, with their real
  limitations noted (e.g. the dark/light toggle is one-directional).

### Why one file, not per-component front-matter

A resync needs to read and write this state atomically without touching
the component's own source — scattering it as comments inside each
`components/*.js` file would make that harder to do safely and harder to
diff/review in git than one small JSON file.

### Updating the map

Edited by hand (or by the push/pull steps themselves) — not
auto-generated. Keep an entry for every component/atom/organism that
exists in Figma, even non-`active` ones, so the map's key set never
silently drifts from what's actually in the file.
