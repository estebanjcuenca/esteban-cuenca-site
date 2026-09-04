# figma-token-foundations Specification

## Purpose

Defines full coverage of the site's design tokens as Figma Variables and Text Styles, including how fluid (`clamp()`-based) values are represented despite Figma having no native fluid-value mechanism, plus a documented Foundations page presenting the whole system.

## Requirements

### Requirement: Token variable coverage matches the full token file
The system SHALL maintain a Figma variable collection whose variables cover every custom property defined in `styles.css`'s `:root` token set, not a partial subset chosen per push.

#### Scenario: A token exists in styles.css but not yet in Figma
- **WHEN** the token variable collection is audited against `styles.css`'s `:root`
- **THEN** every token has a corresponding Figma Variable, or the gap is explicitly reported rather than silently left uncovered

### Requirement: Fluid tokens are represented as documented static endpoints
For a token defined as a fluid `clamp(min, preferred, max)` value, the system SHALL represent it in Figma using variable modes for its static endpoints (at minimum, the `clamp()`'s min and max), with each variable's description recording the real `clamp()` formula it approximates.

#### Scenario: A clamp()-based token is added as a Figma Variable
- **WHEN** a token like `--nav-size: clamp(15px, 1.2vw, 18px)` is represented in Figma
- **THEN** the variable has at least two modes (e.g. Desktop/Mobile) holding the clamp's max and min values, and its description states the full `clamp()` formula
- **AND** the system does not claim or imply that Figma reproduces the fluid, continuously-interpolated value between those endpoints

### Requirement: Type roles have Figma Text Styles bound to token variables
For each distinct typographic role the site uses (e.g. name/H1, nav/label, body, bio, section label), the system SHALL create a corresponding Figma Text Style with its font size (and, where applicable, letter-spacing/line-height) bound to the matching token variable.

#### Scenario: Applying a type role to new text
- **WHEN** a text layer needs the site's "nav/label" typographic role
- **THEN** a Text Style exists for it, bound to the corresponding size token variable, and applying that Text Style reproduces the role's typography

### Requirement: Typeface exploration is testable through a FONT_FAMILY-scoped variable
The system SHALL maintain at least one `STRING` Figma Variable scoped to `FONT_FAMILY`, with modes for comparing typeface choices, bindable to text nodes' `fontFamily` property the same way color/size variables bind to fills and dimensions.

#### Scenario: Comparing two typeface options
- **WHEN** a typeface alternative is being explored against the current stand-in
- **THEN** a `FONT_FAMILY`-scoped variable with multiple modes lets that comparison happen by switching modes, without manually re-selecting the font on every text node

#### Scenario: The value space is constrained by MCP font availability
- **WHEN** a `FONT_FAMILY` variable's mode value is set
- **THEN** the value must be a font available to the connected MCP server's font list (confirmed live: `PPRadioGrotesk` is not, per the archived change's finding) — this is a documented constraint on the mechanism's values, not a limitation of the binding mechanism itself, which works regardless

### Requirement: A Foundations page documents the token system visually
The Figma file SHALL contain a dedicated page presenting the token system for human reference: color swatches bound to their variables, a type ramp using the defined Text Styles, a visual spacing scale using the spacing token variables, and any reusable effect (e.g. the A4-preview shadow).

#### Scenario: Reviewing the design system without inspecting individual nodes
- **WHEN** someone opens the Figma file's Foundations page
- **THEN** they can see the full color palette, type ramp, and spacing scale without needing to select individual nodes and read their bound variables
