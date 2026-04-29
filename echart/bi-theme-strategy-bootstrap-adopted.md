# BI Application Theme Strategy (Next-Gen Dense UI)

## Goal

Design a modern, high-density BI interface that:

- maximizes data visibility
- maintains clarity and usability
- feels modern rather than legacy BI
- coordinates cleanly with a quiet shell design

## Key Decision

Keep Bootstrap as a foundation, but do not let it define the design system.

Instead:

- build a density-first visualization layer on top of Bootstrap and the existing custom grid
- let the shell own product structure and calmness
- let visualization surfaces own density and analytical meaning

## Core Design Model

Hybrid approach:

- Bootstrap foundation
- Figma-style shell
- Airtable-style data layer
- BI density techniques

## System Architecture

## Two-Layer Design System

### Layer 1: Application Shell

The shell should be modern, quiet, and structurally strong.

Use Bootstrap for:

- layout grid
- base components

Override with shell principles:

- minimal routine color usage
- neutral surfaces
- clear typography
- restrained radius and elevation
- compact but consistent controls
- simplified component styling with less visible Bootstrap character

Goal:

- keep the shell modern and quiet
- avoid spending color and visual energy before the user gets to the data

### Layer 2: Visualization Surfaces

Visualization surfaces are the actual BI outputs inside the shell:

- tables
- charts
- KPI widgets
- filters and widget chrome that live inside BI surfaces

Leverage the existing custom grid as the core.

Enhance it with:

- Airtable-inspired grid interaction
- BI-oriented density
- stronger analytical state language
- richer conditional rendering

Goal:

- maximize information density and efficiency
- keep visualization output appropriate for a BI application, not just a compact app UI

## What Changes And What Doesn't

## Keep

- Bootstrap layout system
- Bootstrap utilities where useful
- existing custom grid and visualization infrastructure

## Override Or Extend

- typography scale
- spacing tokens
- component density
- table and widget rendering
- interaction patterns
- token coordination between shell and visualization

## Visual Strategy

## Color Philosophy

Color should be used intentionally.

- routine shell chrome should be mostly neutral
- visualization surfaces may use color when it carries data meaning, state meaning, or action priority
- the shell should keep one routine accent color
- visualization layers should own categorical, sequential, diverging, and analytical emphasis colors

Restated rule:

- color is not for routine chrome
- color is allowed where it conveys meaning

## Reduce Bootstrap Feel

Override:

- heavy default buttons
- oversized form spacing
- card-heavy layouts
- thick borders

Replace with:

- flatter surfaces
- lighter borders
- tighter spacing
- denser but still legible layout rhythm

## Structure vs Spacing

Use structure instead of whitespace in dense areas.

- subtle separators
- alignment
- grid rhythm
- hierarchy through typography and border contrast

## Core System Decisions

## 1. Density Strategy

Density should not be one global compression rule.

Instead define:

- shell density tokens
- visualization density tokens

### Shell density

Shell should stay compact and stable.

Recommended baseline:

- controls around 30px
- shell table/list rows around 32-34px
- shell spacing driven by 4px, 6px, 8px, 12px rhythm

### Visualization density

Visualization should support BI-specific density modes because data surfaces need to fit more information than the shell.

Recommended visualization modes:

- Comfortable
- Compact
- Dense

Dense should be treated as the primary BI target, but only for data surfaces, not by collapsing every shell control.

### Visualization target specs

- row height: 26-30px
- font size: 12-13px
- cell padding: 4-8px
- single-line cells with ellipsis by default

## 2. Table System

Treat the custom grid as the primary visualization surface.

### Required behavior

- column resize
- column reorder
- frozen columns
- inline editing
- hidden-until-needed row actions
- context menus
- keyboard navigation
- virtualization
- strong numeric alignment
- tabular numerals

## 3. Bootstrap Integration Strategy

Do not rely on:

- `.table` defaults
- `.table-sm`
- default Bootstrap component density for BI outputs

Instead:

- create custom table and widget classes
- override Bootstrap variables selectively
- use Bootstrap utilities where helpful
- treat Bootstrap as infrastructure, not widget design

## Shell-To-Visualization Token Contract

This is the coordination layer between shell design and visualization output.

### Tokens visualization should inherit from shell

These should stay shared unless there is a strong reason to diverge.

- text colors
- neutral surface colors
- default border colors
- radius scale
- focus ring style
- primary action color
- base typography family

This keeps the product feeling cohesive.

### Tokens visualization may override for density

Visualization should be allowed to define its own:

- row height
- cell padding
- toolbar density
- widget chrome spacing
- compact button sizing inside widgets
- frozen-column divider treatment

### Tokens visualization should own

These should not be driven by shell tokens.

- categorical chart palette
- sequential ramps
- diverging ramps
- conditional formatting colors
- in-chart highlight colors
- data-state emphasis colors

### Widget-state tokens that sit between shell and visualization

These should be explicitly defined for visualization surfaces rather than improvised ad hoc.

- selected row background
- active cell background
- hover row background
- contextual header background
- inline edit state
- filter-on state
- sort-active state
- pinned/frozen divider state
- warning or anomaly state inside widgets

These tokens may share shell families, but should be documented separately because they are widget-specific states.

## Interaction Strategy

Shift from visual density to interaction density.

- hover actions instead of persistent button clutter
- context menus
- keyboard navigation
- progressive disclosure
- compact controls only where interaction remains clear

## Airtable-Inspired Enhancements

- grid-first layout
- minimal widget chrome
- expandable records where appropriate
- flexible columns
- hidden secondary actions until needed

## BI Enhancements

- conditional formatting
- aggregations
- frozen columns
- virtualization
- comparison-friendly numeric alignment
- readable KPI emphasis

## Low-Risk, High-ROI Enhancements

- subtle gridlines
- right-aligned numbers
- tabular numerals
- collapsible filters and toolbars
- hover-based actions
- compact filter bars
- calmer widget chrome around charts and tables

## Foundation Changes Still Required

Even with Bootstrap:

- reduce row height
- reduce padding
- use smaller, BI-appropriate typography
- move from persistent chrome to interaction-driven UI
- formalize shared shell and visualization token boundaries

## Coordination Rules

To ensure shell and visualization stay coordinated:

- shell owns structure
- visualization owns density and analytical meaning
- shell neutrals should frame the data, not compete with it
- visualization should inherit shell foundations before adding its own states
- no vivid chart colors should become routine shell chrome
- widget UI inside visualization surfaces should use an explicit state token model

## Guiding Principles

- Bootstrap is infrastructure, not design
- structure replaces spacing
- interaction replaces clutter
- routine chrome is neutral
- color conveys meaning, not decoration
- density is surface-specific, not globally compressed

## Avoid Pitfalls

## Don't

- mix Bootstrap defaults with dense overrides inconsistently
- leave default table spacing in place
- use Bootstrap tables as-is for BI output
- overuse cards and panels around data surfaces
- collapse shell and visualization density into one global rule
- let widget-state colors emerge without a token model

## Do

- standardize overrides
- create a clear shell-to-visualization token contract
- keep shell modern and quiet
- keep visualization dense and analytical
- preserve a stable shell while allowing richer widget-state behavior

## Implementation Plan

## Phase 1: Shared Foundation Alignment

- finalize shell foundations
- define shared inherited tokens
- define neutral control model
- establish shell-to-visualization token contract

## Phase 2: Visualization Density Foundation

- add visualization density tokens
- apply dense table specs to the custom grid
- standardize compact toolbar and filter patterns
- define widget-state tokens

## Phase 3: Interaction And BI Enhancements

- add hover-reveal actions
- add keyboard-first flows
- improve inline editing and context menus
- add BI-specific rendering enhancements

## Phase 4: Advanced

- add optional density modes for data surfaces
- expand conditional formatting primitives
- refine chart and widget chrome coordination

## Target Outcome

- feels like modern SaaS in the shell
- feels purpose-built for BI in the visualization layer
- runs on Bootstrap plus custom grid
- handles data with Airtable-like efficiency and Tableau/Power BI-style density

## Final Insight

You do not need to remove Bootstrap.

You need to stop Bootstrap from deciding:

- shell visual language
- control density
- data-surface density
- widget-state behavior
