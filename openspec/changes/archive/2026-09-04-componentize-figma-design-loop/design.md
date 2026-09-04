## Context

See `proposal.md` - Why for motivation. Key constraints established during audit and Figma feasibility research (not restated in full here, see the phase-1 audit and the Figma MCP deep-dive in this change's origin conversation):

- No build step, no framework, vanilla JS only. `index.html`'s inline `<script>` currently does parsing, data-shaping, and markup generation in one pass.
- `normalizeTable`/`tableKind`/`MASTER_COLS`/`COL_LABELS` already form a working data-shaping layer; this change touches only the markup-generation step downstream of it.
- `styles.css` already has a partial token system (`--ink`, `--mid`, `--bg`, `--line`, `--font`, size/space scale); this change extends it rather than inventing a new one.
- The local Dev Mode MCP server (`127.0.0.1:3845`, via Figma desktop's "Enable desktop MCP server") was tried first and rejected: it requires a paid Figma plan (Pro/Org/Enterprise), which the owner does not want to purchase for this. The **free remote server** (`https://mcp.figma.com/mcp`, OAuth-authenticated, no local Figma desktop process required) is used instead — this is also the path Figma's own docs recommend for broader feature access. It has been registered in this project's Claude Code config (`claude mcp add --transport http figma https://mcp.figma.com/mcp`); the one remaining step is the owner completing the OAuth `/mcp` → Authenticate → Allow Access flow in a fresh Claude Code session (new MCP registrations aren't picked up mid-session).
- The Figma MCP server exposes both read tools (`get_design_context`, `get_metadata`, `get_screenshot`, `get_variable_defs`, `download_assets`, `get_code_connect_map`) and write tools (`use_figma`, `generate_figma_design`, `create_new_file`, `upload_assets`). The push→edit→pull loop runs entirely on this tool set. **Live-verified in Phase 4** (`whoami` + `claude mcp list` against the connected remote server): the assumed tool set above is confirmed present, plus a larger surface not needed by this change (Code Connect helper tools, shader authoring, generative plugins, FigJam, motion context, video export, a `weave_*` sub-tool-runner). No gap between docs and live behavior for the tools this change actually uses.
- **Team to work in: `EstebanCuenca`** (`team::1677721160377991729`), confirmed via live `whoami` as the team holding this personal site's design work — not `Raff` (`team::770567628582737858`), the other team on the account. **Open risk**: `whoami` reports the seat on `EstebanCuenca` as **View**, not **Full/Edit**. A View seat may not permit the write tools (`create_new_file`, `use_figma`'s write mode, `upload_assets`) inside that team's files — this wasn't previously assumed and needs to be confirmed with an actual write attempt (or an owner seat/plan check) before Phase 6 push is attempted. See Risks.
- Figma Code Connect (React/Web Components/SwiftUI/Compose integrations, or its framework-agnostic `.figma.ts` template files) is a separate, optional mechanism for what Dev Mode displays — it is not required for push or pull and is treated as a future enhancement, not a dependency.

## Goals / Non-Goals

**Goals:**
- Componentize the render pipeline's repeated markup into single-purpose functions without changing output.
- Finish centralizing hardcoded CSS values into the existing token system without changing output.
- Establish a real, verified (not assumed) connection to a Figma MCP server.
- Build a component↔Figma-node mapping convention that works without Code Connect or a framework.
- Prove the full push→edit→pull loop on one real component (the record/table row).

**Non-Goals:**
- Redesigning the live site's visuals. Any Figma-driven visual change requires separate, explicit approval before touching the live site.
- Achieving official Figma Code Connect framework support for vanilla JS — not possible, not attempted.
- Automating the resync trigger (e.g., watching Figma for changes). Resync is pull-on-request only, per the owner's phased/confirm-before-proceeding workflow.
- Touching `content.md`, `print.css`, or the private CV subdomain.

## Decisions

**Component function shape.** Each `components/*.js` file exports one function taking a plain data object and returning an HTML string, matching the existing codebase's string-building style (no template engine, no virtual DOM) so the diff against current inline logic stays mechanical and reviewable. Alternative considered: returning DOM nodes via `document.createElement` — rejected, since it would touch every call site's contract and add risk to a change meant to be output-preserving.

**Where componentized functions live and how they're loaded.** Plain `<script>` tags in `index.html` (no ES modules, no bundler), consistent with "no build step, no framework." Each component file defines a function on a shared namespace object (e.g., `window.Components.recordRow(...)`) to avoid global-scope collisions across files. Alternative considered: ES module `import`/`export` — rejected because it would require serving with correct MIME/CORS handling and adds a toolchain assumption not currently present; plain scripts match the site's existing zero-build posture.

**Dedup of the entity title/sub block.** `formatCell` and `splitEntityCell` currently implement the same visual pattern independently. Both are refactored to call one new `components/entityBlock.js` function; the two call sites keep their different input-shaping logic (they parse different raw cell formats) but converge on the same rendering step.

**Token extension, not replacement.** New tokens follow the existing two-level naming (`--ink`/`--mid` primary/secondary convention, `--space-*`/`--*-size` scale) rather than introducing a second token vocabulary (e.g., numbered scale like `--space-1`). Keeps the diff additive and consistent with what's already there.

**Remote server over local desktop server.** The local Dev Mode MCP server was the original assumption but turned out to gate on a paid Figma plan; the remote server (`mcp.figma.com`) is free and requires no local Figma desktop process, at the cost of an OAuth login instead of a one-click desktop toggle. Registration (`claude mcp add`) is something Claude Code can do directly; the OAuth grant itself is not — it opens a browser consent screen only the owner can approve, and only takes effect once the owner runs `/mcp` → Authenticate → Allow Access in a Claude Code session started after registration. Claude Code verifies the connection afterward via a tool-listing call before any push is attempted, per the spec's connection-verification requirement.

**Mapping file format.** A single JSON file (e.g., `components/figma-map.json`) keyed by component filename, storing the Figma node ID, file/frame ID, and last-synced timestamp. Alternative considered: per-component front-matter comments inside each `.js` file — rejected because it scatters state that a resync needs to read/write atomically, and a single file is easier to diff and review in git.

**Token-to-Variable binding is best-effort, not guaranteed.** Whether a given CSS custom property can become a bound Figma Variable depends on what the connected MCP server's write tools actually support at push time (variable creation/binding capability wasn't independently verified against a live server in this research pass — only the tool list was confirmed from documentation). The spec requires reporting, not blocking, when a value can't be bound. Phase 6 execution is where this gets tested for real, and Phase 4 (MCP setup) is placed before Phase 6 specifically to confirm live tool behavior before the design tokens work is treated as "will definitely become Figma Variables."

## Risks / Trade-offs

- [Documentation vs. live tool behavior may diverge — the exact write-tool capabilities (variable creation/binding, especially) were confirmed from Figma's public docs, not by calling a live connected server] → Phase 4 explicitly re-verifies available tools against the real connected server before Phase 6 push is attempted; Phase 6's task list includes reporting any capability gap found.
- [Plain-`<script>` namespacing (`window.Components.*`) can silently collide if a future component reuses a name] → keep one function per file, one file per pattern, and name functions after their file; add this as a lint-by-convention note in `components/README.md` created during Phase 2.
- [Manual owner step (the OAuth grant) blocks Phase 4 until performed] → Phase 4's task list starts with a check for the live server before doing anything else, so the phase fails fast and visibly rather than silently.
- [Remote server's tool set or write-capability may differ from the local desktop server's, since only the local server's docs were used for the original tool inventory] → Phase 4's tool-listing call re-verifies against the actual connected remote server, same as any other live-behavior check in this design.
- [Figma Variable binding may only partially cover the token set, leaving a mixed styled/hardcoded pushed component] → spec requires reporting which values couldn't be bound; owner decides whether that's acceptable per component rather than the system deciding silently.
- [`whoami` reports a **View** seat, not Full/Edit, on the `EstebanCuenca` team chosen for this work] → before Phase 6's push, confirm write access into a real `EstebanCuenca` file (e.g. attempt `create_new_file` or `use_figma` against a scratch file) rather than assuming the seat name blocks writes; a View *seat* on the team plan does not necessarily equal view-only *file* permissions if the owner has editor access on specific files. Report the result either way before proceeding with the real push.

## Migration Plan

No deployment/rollback in the traditional sense — this is a structural refactor plus a new local tooling connection, not a service change. Rollback for Phase 2/3 is a plain git revert if visual regression is found (there is none expected, since output is preserved exactly). The Figma design-sync capability (Phase 4-7) has no effect on the deployed site until the owner explicitly approves a Figma-driven visual change, per the spec's "no visual change without approval" requirement — so there is nothing to roll back on the live site from that work by construction.

## Open Questions

None — the two questions that would have changed scope (whether Code Connect is required, and whether the MCP server supports push at all) were resolved during this change's research pass: Code Connect is confirmed optional, and the MCP server's write tools confirm push is architecturally possible. Remaining unknowns (exact live variable-binding behavior) are execution-time verification, not open design decisions, and are handled by Phase 4/6's reporting requirements above.
