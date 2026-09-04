## MODIFIED Requirements

### Requirement: Component-to-node mapping is explicit and repo-tracked
The system SHALL maintain a mapping between each `components/*.js` file and its corresponding Figma node ID in a single repo-tracked file, and SHALL treat a component with no mapping entry as not yet connected to Figma. For a component represented as a `COMPONENT_SET` with variants, the mapping SHALL additionally record each variant's own node ID, not just the set's top-level ID.

#### Scenario: Pushing an unmapped component
- **WHEN** a component with no existing mapping entry is pushed to Figma for the first time
- **THEN** the system creates a new mapping entry recording the resulting Figma node ID

#### Scenario: Resyncing a mapped component
- **WHEN** a resync is requested for a component that has a mapping entry
- **THEN** the system uses the mapped node ID to locate the Figma frame to pull from

#### Scenario: Mapping a component with variants
- **WHEN** a component is pushed as a `COMPONENT_SET` with `state`/`breakpoint` variants
- **THEN** the mapping entry records the component set's node ID plus each individual variant's node ID, keyed by its variant property values

#### Scenario: A non-active mapping entry is never a resync target
- **WHEN** a mapping entry's `status` field is anything other than `active` (e.g. `idea`, `deprecated`, `speculative`)
- **THEN** the system does not treat it as a valid resync target, even if a node ID is present

### Requirement: Pushed components use design tokens, not hardcoded values
When a component is pushed to Figma as editable layers, the system SHALL express its colors, spacing, and typography as references to the token file's values (as Figma Variables where the connected MCP server's write tools support creating or referencing variables), rather than as hardcoded values baked into the pushed layers. Where a token is fluid (`clamp()`-based), the system SHALL bind to the appropriate variable mode per the `figma-token-foundations` capability rather than baking in a single literal.

#### Scenario: Token has a corresponding Figma Variable
- **WHEN** a pushed component uses a value defined in the token file
- **THEN** the pushed Figma layer references a Figma Variable for that value instead of a literal

#### Scenario: MCP write tools cannot create/bind a variable for a value
- **WHEN** the connected MCP server's write tools do not support creating or binding a Figma Variable for a given token
- **THEN** the system pushes the literal value and reports which values could not be bound to a variable

#### Scenario: Token is fluid across breakpoints
- **WHEN** a pushed component's Desktop and Mobile breakpoint variants use a fluid token
- **THEN** each variant binds to that token's variable in the mode matching its own breakpoint, rather than both using the same static value

### Requirement: Resync regenerates only the targeted component
On an explicit resync instruction naming a component, the system SHALL pull that component's current design context and variable definitions from its mapped Figma frame and SHALL regenerate only that component's source file, leaving all other component files untouched. For a component with multiple variants, the system SHALL pull each variant relevant to the resync and reconcile them into that single source file's logic (e.g. a `state` variant informing a CSS `:hover` rule, a `breakpoint` variant informing a `@media` rule) rather than regenerating only the default variant.

#### Scenario: Resync affects only the named component
- **WHEN** a resync is requested for one component
- **THEN** only that component's file is regenerated and no other file in `components/` is modified

#### Scenario: Resync of a component with variants
- **WHEN** a resync is requested for a component pushed as a `COMPONENT_SET` with `state`/`breakpoint` variants
- **THEN** the system pulls each variant and reconciles them into the appropriate parts of that component's single source file (base styles, `:hover` rule, `@media` rule) rather than only reading the default variant
