## Why

The site's render pipeline (`index.html`'s inline `<script>`) generates every repeated visual pattern — record rows, entity title/sub blocks, section wrappers, footer links — via ad hoc inline string concatenation, with at least one pattern (entity title/sub) duplicated across two different functions. This makes the markup hard to reuse, hard to reason about, and impossible to hand to a visual design tool. Separately, the owner wants to design visually in Figma and bring changes back into code, which requires (a) markup organized into addressable units and (b) a real, verified connection to Figma rather than an assumed one. Now is the right time because the CV/print split is already complete (`extract-cv-to-private-subdomain`) and the token system is partially in place, leaving a clean surface to componentize before wiring up an external tool.

## What Changes

- Extract every repeated inline-rendered pattern identified in the audit into single-purpose JS functions under a new `components/` directory (record row, entity title/sub block, section wrapper, status dot, footer link, bio/paragraph block). Markdown parsing, data shaping (`normalizeTable`, `tableKind`, `MASTER_COLS`), and current visual output are preserved exactly — this is a structural refactor only.
- Deduplicate the entity title/sub block, currently implemented independently in `formatCell` and `splitEntityCell`, into one function both call.
- Unify the near-duplicate `.tb-btn`/`.tb-icon-btn` and `.footer-btn`/`.footer-icon-btn` CSS into one shared button pattern used by both toolbar and footer.
- Sweep remaining hardcoded CSS values (colors/spacing/sizes in the A4-mode block, mobile breakpoint overrides, etc.) into the existing `:root` token system in `styles.css` — extending it, not replacing it. No visual change.
- Register and verify the Figma Dev Mode MCP server as a connected MCP server for this project (owner performs the manual Figma-desktop enable step; Claude Code registers/verifies the connection and confirms which tools are available).
- Define a manual naming/mapping convention between `components/*.js` files and Figma node IDs (a JSON or front-matter-style map maintained in the repo), since Code Connect's officially-branded framework integrations do not cover vanilla JS — Code Connect's framework-agnostic template files (`.figma.ts`) are noted as an optional future enhancement, not a dependency of the mapping.
- Push one component (the record/table row — the closest real analog to a "project card" on this single-page CV site) to a new Figma frame as editable layers, using the token file's values as Figma Variables where the MCP write tools support it.
- Implement a resync workflow: on explicit instruction, pull the pushed frame's design context and variable definitions via the MCP server and regenerate only that component's file, reporting any drift or values that had to be guessed rather than read.
- **BREAKING**: none — no visual or behavioral change to the live site is in scope. Any Figma-driven redesign requires separate, explicit approval before it touches the live site.

## Capabilities

### New Capabilities
- `design-sync`: the repeatable loop connecting `components/*.js` files to Figma — the MCP connection, the component↔node-ID mapping convention, pushing a component to Figma as editable layers backed by design tokens, and pulling a resync back into the component's source file on request.

### Modified Capabilities
(none — componentization and token consolidation preserve all existing `portfolio-site` and `visual-design` behavior exactly; no requirement-level change)

## Impact

- **Affected code**: `index.html` (inline render script split into `components/*.js` modules it imports/calls), `styles.css` (token additions, button-pattern dedup). No change to `content.md`, `fonts.css`, `print.css`, or the private CV subdomain.
- **New files**: `components/` directory (one file per extracted pattern), a component↔Figma-node mapping file, and any files a resync regenerates.
- **New dependency**: a registered Figma Dev Mode MCP server connection (local, owner-authorized) — no npm/build dependency introduced; still no framework. Connection verified live in Phase 4: authenticated as Esteban Cuenca, with the `EstebanCuenca` team (`team::1677721160377991729`) designated as where this site's Figma work happens (not the `Raff` team also on the account). Note: `whoami` reports a **View** seat on `EstebanCuenca` — write-tool access needs a live confirmation before Phase 6's push, not just an assumption from the seat label (see design.md - Risks).
- **Process**: work proceeds in the phase-by-phase order captured in `tasks.md`, stopping for explicit confirmation between phases, per the owner's stated constraint.
