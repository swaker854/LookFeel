# StyleBI Composer Implementation Roadmap

## Purpose

This document translates the Composer palette and layering strategy into an implementation sequence for the current `portal` codebase.

It is intended to answer:

- what Composer should inherit from the shell first
- where Composer-specific state tokens should be adopted
- which worksheet-specific tokens remain necessary
- which files are the likely implementation touchpoints
- what should be deferred until shell work is stable

This roadmap assumes the shell token and shared-shell adoption work are already underway or complete. It should not be used to replace the shell roadmap.

## Related Specs

- [theme-strategy-overview.md](E:\home\dev\github\lookfeel\theme-strategy-overview.md)
- [shell-design-spec.md](E:\home\dev\github\lookfeel\shell-design-spec.md)
- [shell-implementation-roadmap.md](E:\home\dev\github\lookfeel\shell-implementation-roadmap.md)
- [composer-palette-spec.md](E:\home\dev\github\lookfeel\composer-palette-spec.md)

## Layering Rule

Composer should adopt visual changes in this order:

1. shared shell foundations
2. shared Composer authoring-state tokens
3. worksheet-specific extensions only where needed

This means:

- shared dialogs, forms, tabs, panels, nav, and toolbar structure should consume shell tokens first
- Composer-specific state meaning should be added only where the UI is expressing authoring state rather than normal shell hierarchy
- worksheet-specific `--inet-ws-*` tokens should remain only where graph, schema, connection, or detail-row behavior cannot be expressed cleanly through shell plus shared Composer tokens

## Delivery Model

Use three change types throughout this roadmap:

- `token`
  - define or refine runtime `--inet-composer-*` variables
- `adoption`
  - update selectors so Composer surfaces consume shell and Composer tokens consistently
- `containment`
  - keep worksheet-only states narrow so they do not leak back into shared shell chrome

## Value Source Rule

Unless otherwise noted:

- shared shell values come from [shell-design-spec.md](E:\home\dev\github\lookfeel\shell-design-spec.md) and [shell-implementation-roadmap.md](E:\home\dev\github\lookfeel\shell-implementation-roadmap.md)
- Composer state values come from [composer-palette-spec.md](E:\home\dev\github\lookfeel\composer-palette-spec.md)

## Composer Scope

Composer includes:

- worksheet editing chrome
- viewsheet editing chrome
- wizard-guided creation flows
- shared authoring panes and inspectors
- shared Composer dialogs, toolbars, sidebars, and tabs

Composer does not include:

- portal-only shell chrome
- visualization widget internals
- broad EM alignment

## Primary Code Targets

These are the most likely current implementation targets based on the shell code structure:

| File / area | Main responsibility |
|---|---|
| [web/projects/portal/src/scss/_variables.scss](E:\home\dev\github\stylebi-visual_BI_tool\stylebi\web\projects\portal\src\scss\_variables.scss:1) | define and alias shared `--inet-composer-*` tokens and any retained `--inet-ws-*` extensions |
| [web/projects/portal/src/scss/_themeable.scss](E:\home\dev\github\stylebi-visual_BI_tool\stylebi\web\projects\portal\src\scss\_themeable.scss:1) | adopt shell and Composer tokens in shared Composer chrome, worksheet panes, graph states, and related utilities |
| [web/projects/portal/src/scss/_bootstrap-override.scss](E:\home\dev\github\stylebi-visual_BI_tool\stylebi\web\projects\portal\src\scss\_bootstrap-override.scss:1) | shared Bootstrap-shaped controls used inside Composer dialogs, forms, tabs, and toolbars |
| shared Composer templates and components in `web/projects/portal/src/app` | targeted follow-up only when shared SCSS adoption is not enough |

## Component Application Mapping

### Shared Composer Chrome

These areas should remain shell-driven first:

- top toolbars
- pane tabs
- inspectors and sidebars
- dialogs
- forms
- shared button patterns

Target behavior:

- shell surfaces, spacing, border, radius, and typography remain the baseline
- shell neutral control hierarchy remains intact
- Composer tokens appear only when the UI is communicating authoring state

### Shared Authoring States

These areas should adopt shared Composer tokens:

- selected edit targets
- in-focus or related context
- dimmed or unavailable authoring surfaces
- key authoring emphasis states

Target token families:

- `--inet-composer-context-*`
- `--inet-composer-selected-*`
- `--inet-composer-primary-*`
- `--inet-composer-dimmed-*`

### Worksheet Extensions

These should remain narrower extensions on top of the Composer palette:

- schema compatibility states
- graph connection states
- worksheet detail-row states

Target token families:

- `--inet-ws-schema-*`
- `--inet-ws-connection-*`
- `--inet-ws-row-*`

Avoid introducing new worksheet-only tokens unless the meaning is clearly graph- or schema-specific.

## Current Code Touchpoints

The current shell code already exposes some Composer-specific and worksheet-specific hooks:

- Composer surface tokens in [_variables.scss](E:\home\dev\github\stylebi-visual_BI_tool\stylebi\web\projects\portal\src\scss\_variables.scss:1)
  - `--inet-composer-main-panel-bg-color`
  - `--inet-composer-side-panel-bg-color`
  - `--inet-composer-navbar-*`
- Worksheet and graph-state tokens in [_variables.scss](E:\home\dev\github\stylebi-visual_BI_tool\stylebi\web\projects\portal\src\scss\_variables.scss:1)
  - `--inet-graph-assembly-*`
  - `--inet-schema-*`
  - `--inet-ws-*`
- Shared Composer adoption in [_themeable.scss](E:\home\dev\github\stylebi-visual_BI_tool\stylebi\web\projects\portal\src\scss\_themeable.scss:1)
  - Composer toolbars
  - Composer navbars
  - worksheet graph elements
  - side panes and split-pane gutters

Practical rule:

- reuse and reinterpret existing hooks first
- add new `--inet-composer-*` aliases only where the current names are too worksheet-specific or too legacy to express the broader Composer state model clearly

## Phase 0: Guardrails

### Goal

Keep Composer work layered on top of shell work instead of reopening shell decisions.

### Tasks

- treat shell token and shared shell adoption work as the prerequisite
- identify which Composer selectors are truly shared authoring chrome versus worksheet-only
- avoid rewriting shell-driven selectors with Composer-only values unless they are communicating authoring state

### Output

- clear boundary between shell adoption and Composer adoption

## Phase 1: Composer Token Alignment

### Goal

Define the shared Composer authoring-state token layer without duplicating shell foundations.

### Primary file

- [web/projects/portal/src/scss/_variables.scss](E:\home\dev\github\stylebi-visual_BI_tool\stylebi\web\projects\portal\src\scss\_variables.scss:1)

### Tasks

- add or refine shared `--inet-composer-*` aliases for:
  - context
  - selected
  - primary authoring emphasis
  - dimmed
- keep shell surfaces, text, radius, spacing, and focus inherited rather than redefined
- retain worksheet-specific `--inet-ws-*` families only where they represent truly narrower worksheet behavior

### Output

- stable shared Composer token surface layered on top of shell

## Phase 2: Shared Composer Chrome Adoption

### Goal

Make shared Composer chrome consume shell rules consistently before adding state styling.

### Primary files

- [web/projects/portal/src/scss/_themeable.scss](E:\home\dev\github\stylebi-visual_BI_tool\stylebi\web\projects\portal\src\scss\_themeable.scss:1)
- [web/projects/portal/src/scss/_bootstrap-override.scss](E:\home\dev\github\stylebi-visual_BI_tool\stylebi\web\projects\portal\src\scss\_bootstrap-override.scss:1)

### Tasks

- align shared Composer toolbars and side panes to shell subtle-surface behavior
- align shared Composer tabs and nav states to shell nav rules
- keep dialogs and forms shell-driven unless they are expressing authoring state
- reduce accidental use of worksheet-specific colors in shared chrome

### Output

- shared Composer chrome reads as shell-aligned authoring UI rather than as a separate mini-theme

## Phase 3: Shared Authoring-State Adoption

### Goal

Apply the shared Composer state grammar across authoring surfaces.

### Primary file

- [web/projects/portal/src/scss/_themeable.scss](E:\home\dev\github\stylebi-visual_BI_tool\stylebi\web\projects\portal\src\scss\_themeable.scss:1)

### Tasks

- adopt context states where a surface is related or in-focus
- adopt selected states for explicit active edit targets
- adopt dimmed states for inactive or unavailable authoring surfaces
- adopt Composer primary emphasis for key authoring affordances without replacing shell primary behavior globally

### Output

- a shared authoring-state model across worksheet, viewsheet, and wizard surfaces

## Phase 4: Worksheet Extension Containment

### Goal

Keep worksheet-specific states precise and narrow.

### Tasks

- map schema compatibility states to the retained worksheet token families
- map graph connection states to the retained worksheet token families
- map worksheet detail-table row states to the retained worksheet token families
- avoid reusing worksheet-specific states in shared Composer panes, dialogs, or generic controls

### Output

- worksheet remains expressive without fragmenting the broader Composer palette

## Phase 5: Validation

### Functional checks

- shared Composer dialogs, forms, tabs, and toolbars still align with shell
- selected/context/dimmed states are consistent across authoring surfaces
- worksheet graph, schema, and detail states still communicate clearly

### Visual checks

- shared Composer chrome feels shell-aligned
- authoring-state styling appears only where meaning requires it
- worksheet-specific state remains narrower than the overall Composer palette

### Themeability checks

- new Composer tokens remain runtime-themeable where intended
- old token names still behave reasonably if customer themes reference them

## Deferred Work

These should not block the first Composer implementation phase:

- broad component-by-component rewrites
- viewsheet- or wizard-specific micro-polish beyond shared state adoption
- visualization widget internals
- exhaustive cleanup of all legacy worksheet naming in one pass

## Recommended First Sprint

If Composer implementation begins after shell stabilization, the best first sprint is:

1. Phase 1 Composer token alignment
2. Phase 2 shared Composer chrome adoption
3. Phase 3 shared authoring-state adoption

That gives a clear layered model before doing narrower worksheet follow-up.
