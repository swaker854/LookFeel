# Chart Design System (High-Level)

This document is used alongside reference charts which provide concrete code examples. When implementing a new chart type, always request the relevant reference chart first.

---

## 1. Standard Color Palette

### What it defines

A single source of truth for all chart colors using CSS classes.

### Core rules (non-negotiable)

* Use `.series-N` classes for all categorical colors — never inline hex
* Use `svg.dark .series-N` overrides for dark mode — **not** `#root.dark .series-N`. For a pure SVG file (`<svg id="root">`), `svg.dark` matches the element itself and is the correct selector. `#root.dark` is only correct when the SVG is inlined inside an HTML document. All card shell dark overrides follow the same `svg.dark` pattern.
* Semantic colors (e.g. bull/bear) must map to existing palette values, not invent new hex

### What to avoid (anti-patterns)

* ❌ Hardcoding `fill="#hex"` in SVG elements or JS
* ❌ Creating new colors outside the palette
* ❌ Using `#root.dark` selectors in a pure SVG file — use `svg.dark` throughout

---

## 2. Dark Mode Toggle Pattern

### What it tries to achieve

Consistent theme switching with zero per-element mutation.

### Core rules (non-negotiable)

* Use a single `isDark` boolean as the state guard — declare it **before** any build or animation code runs
* Toggle only the `svg.dark` class — CSS handles all color changes automatically
* Default must initialize in light mode (`cx="16"`, label `"Dark"`)
* `setMode()` must guard with `if (wantDark === isDark) return` — never re-read from DOM

### What to avoid (anti-patterns)

* ❌ Using `classList.contains('dark')` as the state check
* ❌ `swapColors()`-style JS functions — a sign that colors are hardcoded, not CSS-classed
* ❌ Declaring `isDark` after `build()` executes — code inside `build()` that reads `isDark` will see `undefined`

---

## 3. Onload Animation Pattern

### What it tries to achieve

A layered entrance that gives the chart a sense of arrival. Elements reveal sequentially — one after another — so the viewer's eye follows the data building up. Each element simultaneously fades in with a soft opacity ease, so nothing snaps or jolts into view. For certain chart types (donut, sunburst) the fade combines with a geometric transformation — rotation or scale — making the entrance feel more kinetic. All of this must complete cleanly and hand off to hover without any visual glitch.

### Method selection — pick one per chart type

The method depends on **what is animated** and **whether the animated element is also the hover target**:

| Situation | Method | Charts |
|---|---|---|
| Opacity-only; animated element is a **child** of the hover target | **A2** — CSS `@keyframes`, `both` fill-mode, no gating needed | Bar, Stacked bar, Pareto, Candle |
| Opacity-only; animated element **is** the hover target | **A1** — CSS `@keyframes` + `animationend` + `.visible` + `.ready` gate | Icicle, Treemap, Flame graph, Marimekko, Line, Circle packing |
| Geometry + opacity together | **rAF** — JS `requestAnimationFrame`, clear inline opacity on completion | Donut, Sunburst |

> **Key decision:** If the same element is both animated and dimmed on hover, use A1. If they are separate nested elements, use A2. Only use rAF when you need to animate a geometric property alongside opacity.

### Core rules (non-negotiable)

* **A2:** Animated `.data-body` is a child `<g>` inside the hover-dimmed `.data-item`. `both` fill-mode is safe because animation never touches the outer element.
* **A1:** Trigger the animation via **inline `style.animation`** (no fill-mode). On `animationend`, set `style.animation = 'none'` and add `.visible` — `.item.visible { opacity:1 }` in CSS then owns the stable state. Gate hover with `.ready` added after the last animation completes (last delay + duration + 100ms buffer). Never put the `animation:` declaration on `.visible` itself — that reintroduces fill-mode conflict.
* **rAF:** Set initial `opacity:0` as **inline style** (not CSS). At loop end, two cases apply:
  * **Hover-dimmed elements** (e.g. slices): clear with `el.style.opacity = ''` so CSS hover rules take over cleanly. Add `.ready` after clearing.
  * **Decorative / non-hover elements** (e.g. hole group, centre label): lock with `el.style.opacity = '1'` — leaving inline style in place is safe since no CSS hover rule needs to override it.

### Timing constants (non-negotiable)

Duration and easing are fixed for all charts. Stagger has a maximum of 0.25s but scales down for large element counts:

| Parameter | Value | Notes |
|---|---|---|
| Duration | `0.8s` | Fixed — all methods |
| Stagger | `min(0.25, 1.0 / count)` | 0.25s max; scale down when count is large |
| Easing | `ease-out` | Fixed — all methods |
| `.ready` delay | `(lastDelay + duration + 0.1) * 1000` ms | 100ms buffer after last animation |

**Adaptive stagger rule:** `0.25s` is the maximum stagger, correct for small element counts (e.g. 8 bars = 1.75s total spread). When element count is large, cap the total spread at ~1s by scaling the stagger down:

```js
var stagger = Math.min(0.25, 1.0 / count);
var lastDelay = (count - 1) * stagger;
```

This keeps the feel consistent — small charts animate at the full 0.25s cadence, large charts (30-bar, dense icicle columns) complete in roughly the same wall-clock window. Duration and easing never change.

### What to avoid (anti-patterns)

* ❌ SMIL animations (`<animate fill="freeze">`) — deprecated and blocks hover overrides
* ❌ `animation-fill-mode: forwards` when animation and hover target the same element
* ❌ Using rAF for a bar chart — bar animation is opacity-only with nested elements; A2 is correct
* ❌ Using a fixed 0.25s stagger regardless of element count — a 50-element chart will animate for 12+ seconds

### Reference implementation

See: Bar Chart (A2), Icicle (A1), Donut (rAF)

---

## 4. Hover Interaction Pattern

### What it tries to achieve

When the user hovers, everything except the focused element fades back, creating a single point of attention. A tooltip anchored to the element surfaces the precise value. The effect should feel immediate and stable — no flicker, no lag, no elements fighting each other.

### Core rules (non-negotiable)

* Add `.hovering` to the container on mouseenter, remove on mouseleave — CSS drives the dim
* Mark the active element with `.active` (A2/bar) or `.hovered` (A1/treemap)
* **Always clear all stale active classes on mouseenter** — fast cursor movement can skip mouseleave; the forEach clear is not optional
* Dimmed opacity: `0.20`. Transition: `0.2s ease`. These values are fixed across all charts.
* A1 charts: gate hover rules on `.ready` so dimming never fires during the entrance animation
* **Default pattern:** remove `.hovering` on the **individual element's** `mouseleave`. This is correct for bar, pareto, and any chart where hit targets have clear gaps between them.
* **Exception — adjacent or overlapping hit targets (donut, treemap, marimekko, icicle):** remove `.hovering` on the **container's** `mouseleave` instead. Moving quickly between adjacent elements fires the element's `mouseleave` before the next element's `mouseenter`, momentarily clearing `.hovering` and causing a visible flicker. Container-level removal prevents this.

**`mouseleave` placement by chart type:**

| Chart | `mouseleave` on |
|---|---|
| Bar, Pareto, Candle, Line, Tree | Individual element — hit targets have clear gaps |
| Donut, Sunburst, Treemap, Marimekko, Icicle, Radar | Container — adjacent or overlapping hit targets |

### What to avoid (anti-patterns)

* ❌ Not clearing stale `.active` / `.hovered` on mouseenter — causes two elements highlighted simultaneously
* ❌ Setting JS inline opacity on elements that **CSS hover also targets** — they will fight. This does not apply to overlay elements (e.g. a pareto line) that are never targeted by any `.hovering` rule.
* ❌ Using container `mouseleave` to remove `.hovering` on charts with gapped hit targets (bar, pareto) — element-level removal is correct there; container-level is only needed for adjacent/overlapping targets

---

## 5. Tooltip System

### What it tries to achieve

Readable data display anchored to data point, always visible within the card.

### Approach selection — pick one per chart type

| Situation | Approach | Charts |
|---|---|---|
| Large fixed elements, no layers painted above them | **CSS-driven** — bubble lives inside `.data-item`; `.data-item.active .data-tip { opacity:1 }` | Bar |
| Fixed elements but a data layer (line, markers) paints above | **CSS-driven + overlay** — extract bubbles to `#bubble-overlay` group at end of SVG; toggle via JS inline style | Pareto |
| Small/dense/variable-position elements | **JS-driven** — single `#tip-layer` at end of SVG; JS positions and shows/hides | Donut, Sunburst, Icicle, Candle, Line, Radar, Treemap, Marimekko, Circle packing |

> **Bar chart specifically uses CSS-driven.** Bubbles live inside `.data-item`. Only move to an overlay when another data layer would paint on top.

### Core rules (non-negotiable)

* Tooltips always render in the **last painted layer** — either as a child of their `.data-item` (CSS-driven) or in a dedicated `#tip-layer` / `#bubble-overlay` group placed last in the SVG
* **For JS-built charts (donut, sunburst):** `#data-layer` must wrap both the slice group **and** the tooltip layer. CSS hover selectors only fire if slice elements are descendants of `#data-layer`. Placing `#tip-layer` outside `#data-layer` is the most common structural error in JS-built charts — hover architecture silently breaks even though JS inline-style show/hide may appear to work.
* Always clamp `tx` horizontally so the bubble never exits the card edges
* Always flip vertically (above/below element) when near the top of the plot area
* Measure bubble width with `getBBox()` after setting text — never use any fixed or estimated width (fixed pixel constants and character-count heuristics both fail silently across different labels and zoom levels)
* **3-part construction** — all three elements required; `.tip-pct` is a fourth optional element, omit only if the chart has no percentage data at all:
  * `.tip-bg` — `<rect>` with fill only, **no stroke**
  * `.tip-border` — `<path>` tracing the rounded-rect outline with a **gap at the tail root**, **no `Z`**; fill must match `.tip-bg` (not `none`)
  * `.tip-tail` — `<path>` for the tail triangle; root points align exactly to the `.tip-border` gap endpoints; fill must match `.tip-bg` (not `none`)
  * `.tip-pct` *(optional)* — secondary text line for percentage or contextual value

### What to avoid (anti-patterns)

* ❌ CSS-driven bubbles when another layer paints above the bar group — the line/overlay will render on top of the bubble
* ❌ Using `<rect>` for `.tip-border` — draws a closed border across the tail root, breaking the seamless silhouette
* ❌ `fill:none` on `.tip-border` or `.tip-tail` — leaves the interior transparent, exposing content behind the bubble
* ❌ Closing `.tip-border` path with `Z` — produces a visible stroke line across the tail opening
* ❌ Not clamping or flipping — bubble can exit card bounds

### Reference implementation

See: Bar Chart (CSS-driven), Pareto (overlay), Icicle / Donut (JS-driven)

---

## 6. Depth-Tinting System (Hierarchical Only)

### What it tries to achieve

Visual encoding of hierarchy depth while preserving palette consistency.

### Core rules (non-negotiable)

* Tint is computed from base color + background — never hardcoded
* Base color must be **probed live from `.series-N` via `getComputedStyle`** — never stored as a hex constant in JS. The canonical utility is `probeColor(cls)`: create a hidden `<rect>`, stamp the class, read `getComputedStyle().fill`. This way palette updates and dark-mode swaps propagate automatically.
* Use CSS variables for blend levels (`--blend-d0` … `--blend-d4`, `--bg-light`, `--bg-dark`)
* Call `recolor()` on dark mode toggle to recompute from updated background — **never call `build()` to recolor**, as that re-triggers animation and discards hover state
* Never rebuild the DOM to change colors

### What to avoid (anti-patterns)

* ❌ Hardcoding tinted colors
* ❌ Rebuilding chart on theme change

### Reference implementation

See: Icicle, Treemap

---

## 7. SVG Paint Order

### What it defines

Rendering order in SVG (no z-index support — later elements paint on top).

### Core rules (non-negotiable)

1. Grid / axes
2. Data layer (`.data-layer`)
3. Overlays (lines, markers)
4. Tooltips / tip layer (always last)

### What to avoid (anti-patterns)

* ❌ Rendering tooltips before overlays — overlays will paint on top of bubbles
* ❌ Placing `#tip-layer` or `#bubble-overlay` before data layers
* ❌ For JS-built charts: placing `#tip-layer` outside `#data-layer` — CSS hover selectors scoped to `#data-layer` will not reach it

---

## 8. Iframe Embedding

### What it defines

Rules for consistent rendering in embedded contexts.

### Core rules (non-negotiable)

* Always include `@import url(...)` for Inter in `<style>`
* Escape `&` as `&amp;` in import URLs inside SVG

### What to avoid (anti-patterns)

* ❌ Missing font import — causes layout shift and measurement errors in `getBBox()`

---

## 9. Card Shell & Layout Grid

### What it defines

Standard layout boundaries and spacing system.

### Typography positions (fixed — audit these directly)

| Element | x | y | Class |
|---|---|---|---|
| Title | 68 | 50 | `.card-title` |
| Subtitle | 68 | 70 | `.card-subtitle` |
| Footer | 68 | **600** | `.footer` |

### Card shell CSS values (required — must match exactly)

```css
.card-bg { fill:#FFFBFE; filter:drop-shadow(0 1px 2px rgba(0,0,0,0.10)); }
svg.dark .card-bg { fill:#1C1B1F; filter:drop-shadow(0 1px 4px rgba(0,0,0,0.25)); }
```

The `drop-shadow` filter is required on `.card-bg` in both modes. Omitting it removes the card's elevation entirely.

### Core rules (non-negotiable)

* Plot area fixed bounds — no element edge may cross these. Applies to **all chart types**, including axisless charts (donut, treemap, circle packing):

  | Edge | Value |
  |------|-------|
  | Left | 68 |
  | Right | 850 |
  | Top | 100 |
  | Bottom | 500 |

* x=850 is an **outer boundary**, not a fill target. The data area may end before x=850 when layout requires it — for example, a dual-axis chart may run gridlines and bars only to x=820, using the x=820–850 corridor for the secondary axis line and its labels. All elements including those labels must still stay within x=850.

* Reserved zones outside the plot area:
  * Top (y < 100) → title, subtitle, toggles
  * Bottom (y > 500) → x-axis labels, footer
  * Right (x > 850) → legend panel (x: 870–1080)

* **For axisless charts (donut, treemap, circle packing):** the full plot area box is the layout constraint. Center circular charts at the plot area midpoint (x ≈ 459, y ≈ 300). The legend always sits at x: 870–1080 regardless of chart type — never expand the chart horizontally to fill the legend zone.

### What to avoid (anti-patterns)

* ❌ Plot area overlapping title, footer, or legend
* ❌ Dynamically changing layout bounds at runtime
* ❌ Spreading a circular or axisless chart across the full card width — the legend zone (x > 850) is always reserved
* ❌ Treating x=850 as a strict data-area right edge on dual-axis charts — secondary axis labels between x=820 and x=850 are correct, not a violation

### Reference implementation

See: Bar Chart (layout standard)

---

## Guiding Principles

* CSS owns styling; JS owns behavior
* Never duplicate state between DOM and JS
* Prefer structure over mutation
* Protect hover consistency at all times — the stale-clear on mouseenter is never optional
* Always support both light and dark mode from the start
* Layout spacing is as important as visual correctness
