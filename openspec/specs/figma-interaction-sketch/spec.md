# figma-interaction-sketch Specification

## Purpose

Defines how the site's real interactions (dark/light toggle, section hide/show, row hover) are sketched using Figma's native prototyping model, and the discipline for treating pulled interaction data as translation input rather than generated code.

## Requirements

### Requirement: Documented site interactions have a corresponding prototype-flow sketch
For each interaction explicitly chosen for this work (dark/light toggle, section hide/show, row hover), the system SHALL build a Figma prototype flow using native triggers and actions (e.g. "While hovering", "On click", "Set variable mode", Smart Animate) that visually approximates the site's real behavior.

#### Scenario: Sketching the dark/light toggle
- **WHEN** the dark/light toggle interaction is sketched
- **THEN** a Figma prototype interaction uses the "Set variable mode" action against the token variable collection's modes, approximating the site's real token-swap mechanism

#### Scenario: Sketching section hide/show
- **WHEN** the section hide/show interaction is sketched
- **THEN** a Figma prototype interaction uses Smart Animate to approximate the site's real collapse animation

### Requirement: Pulled interaction data is read as structured translation input, not generated code
When a resync pulls a node's interaction data (Figma's `reactions`), the system SHALL treat it as structured intent (trigger type, action type, target) to inform a hand-written implementation, and SHALL NOT claim or attempt to generate working application code directly from it.

#### Scenario: Resync encounters a prototype interaction
- **WHEN** a pull reads a node with one or more `reactions`
- **THEN** the system reports the trigger/action/target as data for a human or Claude to translate into real code, following the same drift/guesswork reporting discipline used for colors and spacing

#### Scenario: An interaction has no equivalent in the site's current code
- **WHEN** a pulled reaction describes behavior with no corresponding function or pattern in the current codebase
- **THEN** the system reports it as a gap requiring a new implementation decision, rather than silently fabricating one
