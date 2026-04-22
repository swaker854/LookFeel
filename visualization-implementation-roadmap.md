# StyleBI Visualization Implementation Roadmap

## Purpose

This document translates the visualization design spec into an implementation sequence for StyleBI visualization surfaces.

It is intended to answer:

- what visualization should inherit from shell
- which token groups visualization should own
- what should be implemented first
- how tables, charts, KPI widgets, and embedded controls should be standardized
- what should be deferred until the foundation is stable

This roadmap is a companion to the visualization spec. It should not be used to redefine shell or Composer behavior.

## Related Specs

- [theme-strategy-overview.md](E:\home\dev\github\lookfeel\theme-strategy-overview.md)
- [shell-design-spec.md](E:\home\dev\github\lookfeel\shell-design-spec.md)
- [shell-implementation-roadmap.md](E:\home\dev\github\lookfeel\shell-implementation-roadmap.md)
- [visualization-design-spec.md](E:\home\dev\github\lookfeel\visualization-design-spec.md)
- [palette-coordination-recommendations.md](E:\home\dev\github\lookfeel\palette-coordination-recommendations.md)

## Layering Rule

Visualization should adopt and extend in this order:

1. inherit shared shell foundations
2. define visualization-specific density and widget-state tokens
3. define chart and analytical color systems

This means:

- visualization should inherit shell typography, neutral surfaces, borders, radius, focus treatment, and primary action color unless there is a clear reason to diverge
- visualization should not inherit shell density assumptions automatically
- chart palettes, analytical ramps, conditional formatting, and widget-specific states should be visualization-owned

## Delivery Model

Use three change types throughout this roadmap:

- `foundation`
  - define inherited versus visualization-owned tokens and contracts
- `adoption`
  - update visualization surfaces so they consume those tokens consistently
- `specialization`
  - add denser, more analytical behavior only where the surface requires it

## Value Source Rule

Unless otherwise noted:

- inherited shell values come from [shell-design-spec.md](E:\home\dev\github\lookfeel\shell-design-spec.md)
- visualization-specific behavior comes from [visualization-design-spec.md](E:\home\dev\github\lookfeel\visualization-design-spec.md)
- cross-layer color rules come from [palette-coordination-recommendations.md](E:\home\dev\github\lookfeel\palette-coordination-recommendations.md)

## Visualization Scope

Visualization includes:

- tables and grids
- chart chrome
- KPI and summary widgets
- embedded filters and controls inside BI widgets
- widget-level interaction and state behavior

Visualization does not include:

- shared shell dialogs, tabs, forms, and navigation
- shared Composer authoring-state language
- generalized shell panel and toolbar treatment outside visualization surfaces

## Token Ownership Model

### Inherited From Shell

Visualization should inherit:

- font family
- text hierarchy
- neutral surfaces
- default borders
- radius scale
- focus ring treatment
- primary action color

### Visualization-Owned

Visualization should own:

- density tokens
- widget-state tokens
- chart palettes
- analytical ramps
- conditional formatting primitives
- compact widget chrome sizing where needed

### Shared But Overridable

Visualization may inherit shell defaults and then override for:

- row height
- toolbar density
- compact control size inside widgets
- widget chrome spacing

## Primary Implementation Areas

These are the major implementation areas implied by the spec:

| Area | Main responsibility |
|---|---|
| density layer | compact row heights, spacing, and control sizes for visualization surfaces |
| widget-state layer | hover, selected, active, contextual, sorted, filtered, pinned, warning, anomaly, dimmed |
| table/grid standardization | shell-cohesive but BI-dense table behavior |
| chart chrome standardization | headers, legends, axes, gridlines, tooltips, inline widget controls |
| KPI and summary widgets | analytical hierarchy without heavy shell framing |
| analytical color systems | categorical palettes, sequential ramps, diverging ramps, conditional formatting |

## Phase 0: Guardrails

### Goal

Keep visualization work analytically focused without backsliding into shell-style over-framing or uncontrolled color usage.

### Tasks

- confirm which surfaces are visualization-owned versus shell-owned
- avoid using chart palette colors for routine widget chrome
- avoid treating shell table selectors as a substitute for dense visualization tables

### Output

- clear boundary between shell, Composer, and visualization work

## Phase 1: Foundation Contract

### Goal

Define inherited versus visualization-owned token groups explicitly.

### Tasks

- document which shell tokens visualization consumes directly
- define the initial visualization token groups for:
  - density
  - widget state
  - chart color
  - analytical thresholds and conditional formatting
- keep the shell-to-visualization contract stable and explicit

### Output

- stable token contract between shell and visualization

## Phase 2: Density Foundation

### Goal

Establish BI-appropriate density as a first-class visualization behavior.

### Tasks

- define row-height and padding targets for visualization surfaces
- define compact toolbar and control sizing inside widgets
- ensure density comes from spacing, alignment, and interaction design rather than just shrinking text

### Output

- a reusable visualization density baseline distinct from shell sizing

## Phase 3: Table And Grid State Standardization

### Goal

Standardize the core table/grid behavior used across visualization surfaces.

### Tasks

- define row hover, selection, active, sort, filter, and pinned states
- define subtle but readable gridline and header behavior
- keep numeric alignment, tabular numerals, and single-line scanability as core requirements
- ensure dense tables remain distinct from shell lists and shell tables

### Output

- a consistent visualization table/grid state model

## Phase 4: Chart Chrome Standardization

### Goal

Standardize the non-mark portions of charts so they feel cohesive with the shell without borrowing shell visual density.

### Tasks

- standardize chart headers, legends, axes, gridlines, and tooltip surfaces
- keep chart chrome neutral and visually lighter than data marks
- ensure embedded chart controls use compact shell language without taking on chart categorical colors

### Output

- chart containers and chrome that frame data without competing with it

## Phase 5: KPI And Embedded Controls

### Goal

Standardize KPI widgets and embedded widget controls around analytical hierarchy and compact interaction.

### Tasks

- define KPI value, comparison, sparkline, and semantic emphasis behavior
- define embedded filters and controls using visualization density with shell-derived control language
- keep routine filter and widget controls neutral unless true state meaning is needed

### Output

- KPI and embedded-control patterns that feel analytical rather than shell-card-driven

## Phase 6: Analytical Color Systems

### Goal

Define the visualization-owned color systems that should not be borrowed from shell.

### Tasks

- define categorical palettes
- define sequential and diverging ramps
- define threshold and anomaly primitives
- define conditional formatting tokens and usage rules
- keep these color systems separate from shell routine chrome

### Output

- explicit visualization-owned color systems for data meaning

## Phase 7: Validation

### Functional checks

- dense tables remain readable and usable
- widget states are distinguishable without becoming noisy
- chart chrome remains subordinate to data
- embedded controls remain compact and understandable

### Visual checks

- visualization feels denser and more analytical than shell
- shell and visualization feel coordinated rather than disconnected
- chart colors are used for data meaning, not routine chrome

### Coordination checks

- shell neutrals still frame the visualization cleanly
- primary accent is used intentionally, not as the default first chart color
- semantic families remain aligned across shell and visualization without becoming identical in intensity

## Deferred Work

These should not block the first visualization implementation phase:

- exhaustive chart-type-specific polish
- advanced conditional formatting systems beyond the initial primitives
- optional density modes beyond the primary BI baseline
- deeper visualization-authoring coordination inside Composer-specific editing UIs

## Recommended First Sprint

If visualization implementation begins now, the best first sprint is:

1. Phase 1 foundation contract
2. Phase 2 density foundation
3. Phase 3 table and grid state standardization

That establishes the highest-leverage visualization baseline before deeper chart and KPI work.
