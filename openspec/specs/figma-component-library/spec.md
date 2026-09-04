# figma-component-library Specification

## Purpose

Defines how each `components/*.js` file is represented in Figma as a true, reusable Component — with real variants for interactive state and structural breakpoints, and nested composition mirroring the code's own call graph — rather than as a disconnected flat frame.

## Requirements

### Requirement: Pushed components are true Figma Components, not flat frames
When a `components/*.js` file is pushed to Figma, the system SHALL represent it as a `COMPONENT` or `COMPONENT_SET` node (not a plain frame), so it can be instanced elsewhere in the file.

#### Scenario: First push of a component
- **WHEN** a component with no prior Figma representation is pushed
- **THEN** the system creates a `COMPONENT` (or `COMPONENT_SET`, if it has variant axes) node, not a plain `FRAME`

#### Scenario: Converting an existing flat-frame push
- **WHEN** a component was previously pushed as a plain frame (e.g. the `componentize-figma-design-loop` proof-of-loop push)
- **THEN** the system converts it to a true Component before any variant work proceeds on it, and updates its entry in `components/figma-map.json` accordingly

### Requirement: Structural breakpoints get distinct variants; continuous fluid resize does not
When a component's CSS branches into a genuinely different structure at a breakpoint (different grid, different element positioning — not just a smaller version of the same layout), the system SHALL represent each structural variant explicitly. The system SHALL NOT attempt to model continuous fluid (`clamp()`-based) resizing as a Figma variant or frame per viewport width.

#### Scenario: Component with a real structural breakpoint
- **WHEN** a component's CSS has a `@media` rule that changes its layout structure (e.g. `recordRow`'s switch from a column grid to a stacked card below 700px)
- **THEN** the pushed component includes a `breakpoint` variant axis with one value per distinct structure

#### Scenario: Component with no structural breakpoint
- **WHEN** a component's CSS reflows continuously with no structural `@media` branch
- **THEN** the system pushes a single variant/frame for it and does not fabricate breakpoint variants

### Requirement: Interactive CSS states get variants
When a component has a CSS interactive state (e.g. `:hover`) that changes its appearance, the system SHALL represent that state as a named variant carrying the corresponding visual change.

#### Scenario: Component with a hover state
- **WHEN** a component's CSS defines a `:hover` rule
- **THEN** the pushed component includes a `state` variant axis with at least `Default` and `Hover` values, the `Hover` value carrying that rule's visual change

### Requirement: Nested composition mirrors the code's call graph
When a component's render function calls another `components/*.js` function to render part of its output, the system SHALL represent that relationship in Figma as a nested instance of the called component's own Figma Component, not as flattened, disconnected layers.

#### Scenario: A component composed of other components
- **WHEN** a component (e.g. `recordRow.js`) calls other component functions (e.g. `statusDot`, `entityBlock`) to produce part of its output
- **THEN** the pushed Figma Component contains instances of those components' own Figma Components, nested in the same structural position

### Requirement: Reference content is real and representative, not placeholder text
When pushing a component whose visual layout is sensitive to content length, the system SHALL use real content drawn from the site's actual data (`content.md`), spanning a representative range of lengths, rather than lorem ipsum or other placeholder text.

#### Scenario: Pushing a content-length-sensitive component
- **WHEN** a component's layout can visibly change shape based on content length (e.g. `recordRow`'s festivals/awards lists, entity title/sub wrapping)
- **THEN** the system pushes multiple real reference instances spanning short, medium, and long content from `content.md`, not placeholder text

### Requirement: Component coverage is scoped by design-system completeness, not code-side reuse
The system SHALL represent every visually distinct piece needed to render the site as a true Figma Component, regardless of whether that piece is extracted as a reusable function in `components/*.js`. A component SHALL NOT be excluded from Figma representation solely because it has no code-side reuse case.

#### Scenario: A static, singular piece of markup
- **WHEN** a piece of the site's markup is visually distinct and stylable but appears only once in `index.html` with no repeated/parameterized render function behind it (e.g. the toolbar, the hero section, the scroll-CTA)
- **THEN** it still gets a Figma Component, without requiring or implying a matching `components/*.js` file

#### Scenario: A CSS-only pattern with no JS unit at all
- **WHEN** a visual pattern exists purely in CSS with no corresponding JS function anywhere (e.g. the underline text-decoration mark used across hover states)
- **THEN** it is still represented as its own small Figma Component or style, not redrawn ad hoc inside every component that uses it

### Requirement: Content-sensitive fields are component properties, not fixed static content
For a component whose content can vary (text length, presence/absence of an optional field), the system SHALL expose those fields as Figma component properties (TEXT for content, BOOLEAN for presence/absence) rather than baking a single fixed content set into the pushed layers.

#### Scenario: Overriding an instance's content
- **WHEN** an instance of a content-sensitive component needs different text than its master's default
- **THEN** the override is made via a component property on that instance, and the instance remains linked to its master for every property it did not override

#### Scenario: Testing content-length extremes
- **WHEN** a component's resilience to content length needs verification beyond what today's real records happen to cover
- **THEN** a synthetic short/medium/heavy text preset can be applied via the same component properties, without detaching the instance or duplicating the component

### Requirement: A documented state matrix covers every interactive element
The system SHALL maintain a documented matrix of every interactive element's real CSS states (e.g. Default/Hover, Toggled) and SHALL represent each state a component actually has as a variant — not fabricate a state the CSS doesn't define (e.g. a pressed/active state with no `:active` rule in `styles.css`).

#### Scenario: An element with hover and toggle states
- **WHEN** an interactive element like the section hide/show button has multiple real CSS-driven states
- **THEN** its Figma Component has a variant for each real state, named to match

#### Scenario: An element with no state beyond default
- **WHEN** an element's CSS defines no interactive state rules
- **THEN** the system does not invent one just to fill out a matrix

### Requirement: No pushed component hard-codes a value that has a token
The system SHALL bind every fill, size, and spacing value in a pushed or converted component to its corresponding Figma Variable or Text Style wherever one exists, and SHALL use auto-layout for every container with structurally related children, rather than fixed positioning.

#### Scenario: A value with an existing token
- **WHEN** a component uses a color, size, or spacing value that has a corresponding token
- **THEN** the pushed layer binds to that token's Variable (or Text Style), never a literal

#### Scenario: A structural container
- **WHEN** a pushed component contains children with a structural relationship (stacked, gapped, aligned)
- **THEN** the containing frame uses auto-layout, not absolute `x`/`y` positioning

### Requirement: The file separates generic, reusable pieces from this project's specific theme
The system SHALL organize the Figma file so generic, theme-agnostic components and token structure live separately from this project's specific token values and content, so the generic pieces are portable to another project without untangling project-specific values first.

#### Scenario: Reusing a component in a future project
- **WHEN** a component built for this site is considered for reuse in a different project
- **THEN** its generic structure can be copied without carrying this project's specific token values or content along with it

### Requirement: Non-active components have an explicit lifecycle status
The system SHALL tag every Figma component/node tracked in `components/figma-map.json` with a status (`active`, `idea`, `deprecated`, or `speculative`), and SHALL keep any component not marked `active` on a page visually separated from production components (e.g. an "Ideas / Unused" page).

#### Scenario: An exploratory component with no code counterpart
- **WHEN** a component is built as an idea or exploration and is not (yet) adopted for the live site
- **THEN** it is placed on the Ideas/Unused page and tagged with a non-`active` status, so it is never mistaken for a production component

#### Scenario: A speculative template ahead of a content-model decision
- **WHEN** a template anticipates a product decision that hasn't been made yet (e.g. a per-project detail page)
- **THEN** it is tagged `speculative` and kept off the production Site-assembly pages until the decision is made
