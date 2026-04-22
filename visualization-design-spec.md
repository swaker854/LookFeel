# StyleBI Visualization Design Spec

## Purpose

This document defines how BI outputs inside the shell should look and behave.

It is scoped to visualization surfaces:

- tables and grids
- charts
- KPI widgets
- filters and controls that live inside BI widgets
- widget-level state and interaction patterns

High-level product strategy lives in [theme-strategy-overview.md](E:\home\dev\github\lookfeel\theme-strategy-overview.md).

For execution details such as token ownership, rollout order, and validation, use [visualization-implementation-roadmap.md](E:\home\dev\github\lookfeel\visualization-implementation-roadmap.md).

## Scope

Visualization design should answer:

- how dense BI outputs should be
- what widget-level states exist
- which tokens visualization inherits from the shell
- which tokens visualization owns
- how tables, charts, KPIs, and embedded widget controls should behave

## Inherited Shell Foundations

Visualization should inherit the following from the shell unless there is a strong reason to diverge:

- base font family
- text hierarchy
- neutral surfaces
- default border colors
- radius scale
- focus ring treatment
- primary action color

This keeps the product cohesive.

## Visualization-Owned Foundations

Visualization should define its own:

- density tokens
- widget-state tokens
- chart palettes
- conditional formatting colors
- compact widget chrome spacing
- table/grid interaction patterns

## Density System

Visualization density should be handled as a first-class concern in this layer.

### Density modes

- Comfortable
- Compact
- Dense

Dense is the primary BI target for data-heavy views.

### Target specs

| Token role | Target |
|---|---|
| table row height | `26-30px` |
| widget chrome row height | `26-30px` |
| font size | `12-13px` |
| cell padding x | `4-8px` |
| cell padding y | `2-6px` |
| toolbar control height | `24-30px` |

### Density guidance

- density should increase data visibility without making interaction fragile
- dense mode should prioritize scanability, alignment, and structure
- visualization density should never be achieved only by shrinking text

## Widget-State Model

Visualization surfaces need explicit state tokens.

### Required state categories

- default
- hover
- selected
- active
- contextual
- inline-edit
- sorted
- filtered
- pinned/frozen
- warning
- anomaly
- disabled/dimmed

### Examples

| State | Typical use |
|---|---|
| hover | row hover, mark hover, toolbar reveal |
| selected | selected row, selected point, selected legend item |
| active | active cell, active filter, open popover anchor |
| contextual | related rows, focused header strip, scoped filter region |
| inline-edit | editable cell or input in data surface |
| sorted | active sort header or sort glyph |
| filtered | filter-on state in widget chrome |
| pinned/frozen | frozen column divider or pinned region treatment |
| warning | threshold warning, validation warning |
| anomaly | outlier, exception, error-like data condition |

## Table And Grid Rules

Tables and grids are the primary BI surfaces.

### Visual rules

- default chrome should be minimal
- use subtle gridlines
- prefer alignment and rhythm over heavy borders
- keep rows single-line with ellipsis by default
- numeric columns should be right-aligned
- use tabular numerals

### Behavior rules

- column resize
- column reorder
- frozen columns
- virtualization
- inline editing
- hover-reveal row actions
- keyboard navigation
- context menus

### Table state rules

- selected rows should have a defined selected-state fill and text treatment
- hovered rows should use a lighter, lower-priority fill than selected rows
- contextual or grouped headers may use a dedicated contextual background
- active sort/filter state should be visible without becoming visually noisy

## Chart Chrome Rules

Visualization spec should cover not just marks, but the chrome around charts.

### Chart chrome includes

- headers
- legends
- axes
- gridlines
- tooltip containers
- inline toolbar actions
- filter chips or controls attached to charts

### Chart chrome guidance

- chart chrome should inherit shell neutrals
- chart chrome should be visually lighter than the data itself
- legends should use neutral text and spacing structure first
- chart controls should follow compact shell control hierarchy
- chart palettes should not bleed into surrounding widget chrome

## KPI And Summary Widget Rules

KPI widgets are visualization outputs, not generic shell cards.

### Guidance

- KPI emphasis should come from data hierarchy, not heavy framing
- semantic colors should be used when the KPI meaning justifies it
- sparkline or trend elements should remain subordinate to the primary KPI value
- KPI containers should stay visually quieter than dashboards full of data marks

## Embedded Filter And Control Rules

Controls inside BI widgets should follow visualization density, but still inherit shell control language.

### Guidance

- keep embedded filters compact
- use neutral ghost or outline patterns for passive controls
- use primary only for real actions or high-priority commits
- do not color routine filter chrome with chart hues
- use clear filtered/on states through dedicated widget-state tokens

## Color Rules For Visualization

### Allowed shared use with shell

- neutrals
- primary for deliberate emphasis
- semantic families when meaning aligns

### Visualization-owned color

- categorical palettes
- sequential ramps
- diverging ramps
- heatmap colors
- conditional formatting colors
- analytical highlight colors

### Prohibitions

- do not use chart categorical hues for routine widget chrome
- do not let vivid chart colors replace shell control states
- do not use multiple accent hues in surrounding widget UI without meaning

## Interaction Rules

Visualization should gain density through interaction design, not just compact styling.

### Preferred patterns

- hover-reveal actions
- progressive disclosure
- compact contextual menus
- keyboard-first navigation where practical
- inline editing only where it remains readable and stable

### Avoid

- permanent rows of low-value buttons
- over-framed widgets
- dense controls with unclear hit targets
- using color as the only indicator of interactivity

## Token Groups To Define

Visualization should eventually define explicit token groups such as:

### Density

- `--inet-viz-row-height`
- `--inet-viz-cell-padding-x`
- `--inet-viz-cell-padding-y`
- `--inet-viz-toolbar-height`

### State

- `--inet-viz-hover-bg`
- `--inet-viz-selected-bg`
- `--inet-viz-selected-text`
- `--inet-viz-context-bg`
- `--inet-viz-active-border`
- `--inet-viz-filtered-bg`
- `--inet-viz-sorted-color`
- `--inet-viz-warning-bg`
- `--inet-viz-anomaly-bg`

### Chart

- `--inet-viz-chart-series-*`
- `--inet-viz-ramp-sequential-*`
- `--inet-viz-ramp-diverging-*`
- `--inet-viz-threshold-*`

## Implementation Guidance

Start implementation in this order:

1. define inherited vs visualization-owned tokens
2. define visualization density tokens
3. standardize table/grid widget states
4. standardize chart chrome behavior
5. standardize KPI and embedded-control rules
6. define chart palette and conditional formatting primitives

## Design Intent Summary

Visualization design should make StyleBI outputs feel:

- dense
- analytical
- compact
- readable
- purpose-built for BI

The shell should frame these outputs, not compete with them.
