# StyleBI Theme Strategy

## Scope

This strategy covers the **application shell only** — the Bootstrap-based portal UI and (in a later phase) the Angular Material EM admin. The visualization layer (vsobjects canvas) is custom Angular with no Bootstrap dependency and is addressed in a separate strategy.

## Architecture

```
portal/    → Bootstrap shell + ng-bootstrap (modals/tabs)  ← this document
em/        → Angular Material (tables, forms, navigation)  ← this document, Phase 2 only
shared/    → Shared utilities
```

---

## Core Principles

### Contain Bootstrap via the existing CSS variable layer

Portal's `_variables.scss` already overrides Bootstrap via SCSS variables and exposes ~100 `--inet-*` CSS custom properties. A modern visual redesign can be achieved almost entirely by changing those values.

### Color is for data, not UI — including within UI chrome

This has two layers:

- **Layer 1:** UI chrome should be grayscale. Accent color appears only on primary actions and data. Status colors (success, warning, danger) appear only for feedback, not decoration.
- **Layer 2:** Even within UI chrome, secondary and tertiary hierarchy should be expressed through **form** — border weight, fill vs. outline vs. ghost, opacity, size — not through a second or third hue.

StyleBI currently assigns distinct hues to each semantic role. `$primary` is orange, `$secondary` is teal — two competing accent colors appearing constantly in buttons across the UI. The fix is eliminating the second hue from UI chrome entirely. Teal is retained as a data/status color only.

### Every visual change ships as a CSS custom property

This ensures customers can inherit all modernization improvements through their existing theme uploads without code changes.

---

## Customer Theming

StyleBI exposes a Themes UI in EM admin where customers inject `portalCss` and `emCss` at runtime. Any `--inet-*` CSS custom property can be overridden this way — colors, fonts, backgrounds, hover states, panel colors, button variants.

**What customers can theme today:** ~80% of visual identity — enough for full brand matching.

**What customers cannot theme today:** interaction patterns (hover-reveal, context menus), and grayscale utility classes that use SCSS variables compiled at build time. Token surface expansion in Phase 1 directly addresses the grayscale utility gap.

---

## Color System — Current vs Target

### Current (Bootstrap model)

| Role | Color |
|---|---|
| Primary buttons | Orange `#ed711c` |
| Secondary buttons | Teal `#105e5a` |
| Default buttons | Teal outline |
| Status: success / warning / danger | Green / yellow / red |

### Target (Single accent model)

| Role | Treatment | Color |
|---|---|---|
| Primary buttons | Filled | Orange — one accent |
| Secondary buttons | Outlined / ghost | Neutral gray border, no fill |
| Tertiary / icon buttons | No border, text-only weight | Neutral |
| Hover states | Subtle fill | `$inet-offwhite3` or `$inet-gray1` |
| Status feedback | Filled or outlined | Green / yellow / red — reserved for data/status only |

Retiring teal from button chrome is the **highest-visibility single change** in the entire plan. It reads as modern SaaS immediately, before anything else changes.

---

## Phase 1 — Portal Token Consolidation + Single Accent Shift

**Scope: portal only**

### 1. Single accent — retire secondary from UI chrome

- Redefine `--inet-button-secondary-*` tokens as outlined/ghost variants — neutral border, no teal fill
- Redefine `--inet-button-default-*` tokens as ghost/text-only
- All button tier differentiation expressed through form: filled → outlined → ghost
- Infrastructure already exists in `_variables.scss` — this is a value change, not structural work

### 2. Token surface expansion

- Convert hardcoded values in `_themeable.scss` and component SCSS to `--inet-*` variables:
  `--inet-button-padding`, `--inet-input-height`, `--inet-dialog-padding`, `--inet-toolbar-height`
- Convert direct SCSS variable usages (`$inet-offwhite1`, `$inet-gray1` etc. in utility classes) to CSS custom properties so they become runtime-overridable
- Every new token gets a default value matching the new modernized design

### 3. Tighten visual defaults

- Reduce button padding, dialog padding, input height, border weight — all via token values
- Enforce grayscale-only shell: audit where orange appears in non-primary portal UI and remove it
- Font already Roboto at 13px — validate consistency, fix outliers

### 4. Expose new tokens to the EM themes UI

- Add new tokens to the `ThemeCssVariableModel[]` list so customers see them in the theme editor
- Customers get all Phase 1 improvements through theme upload, no code needed

---

## Phase 2 — EM Alignment

**Scope: portal + em**

1. Align EM's Angular Material theme tokens with the portal `--inet-*` system so both apps feel like one product
2. Evaluate ng-bootstrap component replacements only if specific UX gaps emerge — not for framework reasons

---

## Target Outcome

> Modern, clean shell — feels like Linear/Figma — that stays out of the way of the data.

The foundation is already partially built into StyleBI's CSS architecture. The single most impactful change — retiring the second accent color from UI chrome — requires no new infrastructure, only updated token values.
