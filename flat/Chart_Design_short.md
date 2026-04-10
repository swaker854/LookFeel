# Chart Design System (Restructured)

---

## 1. Standard Color Palette

### What it defines
A single source of truth for all chart colors using CSS classes. JavaScript must never store or apply hex values.

### Specification
- Use `.bar-N` classes for categorical colors
- Use `svg.dark` overrides for dark mode
- Semantic colors must map to existing palette values

```css
.bar-1 { fill:#00D4E8; }
svg.dark .bar-1 { fill:#22D3EE; }
```

### Common mistakes
- Hardcoding `fill="#hex"` in SVG
- Creating new colors outside the palette

---

## 2. Dark Mode Toggle Pattern

### What it tries to achieve
- Consistent theme switching
- Zero per-element mutation
- CSS-driven color changes

### Why this design exists
Centralizing color logic in CSS avoids divergence, reduces JS complexity, and guarantees consistency.

### How to do it
- Use a single `isDark` boolean
- Toggle `svg.dark` class
- Initialize in light mode only

```js
var isDark = false;

function setMode(wantDark) {
  if (wantDark === isDark) return;
  isDark = wantDark;
  if (wantDark) svg.classList.add('dark');
  else svg.classList.remove('dark');
}
```

### What to avoid (anti-patterns)
- Using `classList.contains` as state
- `swapColors()` functions
- Declaring `isDark` after `build()`

---

## 3. Onload Animation Pattern

### What it tries to achieve
- Smooth entrance animations
- No conflict with hover interactions

### Why this design exists
Animation engines can override CSS states. Improper use (e.g. fill-mode) breaks hover behavior.

### How to do it

#### Method A — CSS keyframes
Use for opacity-only animations

- A1: same element → use `.visible` + `animationend`
- A2: nested elements → safe to use `both`

#### Method B — requestAnimationFrame
Use for geometry + opacity

- Initialize opacity via inline style
- Clear inline style after animation

### What to avoid (anti-patterns)
- SMIL animations (`<animate>`)
- `fill="freeze"` or `animation-fill-mode: forwards`
- Setting initial opacity in CSS for rAF animations

---

## 4. Hover Interaction Pattern

### What it tries to achieve
- One highlighted element
- All others dimmed consistently

### Why this design exists
Consistent interaction model improves usability and reduces cognitive load.

### How to do it
- Use `.hovering` on container
- Use `.active` / `.hovered` on items
- Always clear stale states on mouseenter

```js
items.forEach(x => x.classList.remove('hovered'));
item.classList.add('hovered');
```

### What to avoid (anti-patterns)
- Not clearing previous hover state
- Mixing JS and CSS opacity control inconsistently

---

## 5. Tooltip System

### What it tries to achieve
- Clear, readable data display
- Visually anchored to the data point
- Always rendered above all chart elements
- Consistent shape and behavior across charts

### Why this design exists
Tooltip issues are the #1 source of visual bugs due to:
- SVG lacking z-index (paint-order problems)
- Dynamic positioning (edge clipping, flipping)
- Shape construction (tail alignment + seamless border)

A strict system prevents repeated trial-and-error.

### How to do it

#### 1) Layering (non-negotiable)
- Tooltips must render in the **last painted layer**
- Use a dedicated `#bubble-overlay` or `#tooltip-layer`

```html
<g class="ca">...</g>
<polyline .../> <!-- overlays -->
<g id="bubble-overlay">...</g> <!-- always last -->
```

---

#### 2) Placement rules

**X positioning (always clamped):**
- Prevent overflow beyond chart edges
- Formula:
```
clampedX = Math.max(min, Math.min(mouseX, max))
```

**Y positioning (flip logic):**
- Default: tooltip above cursor/element
- If not enough space → flip below

```
flip = mouseY < (bubbleHeight + tail + padding)
```

---

#### 3) Tail construction (critical)

Tooltip must be built from **3 elements**:

1. `.bub-bg` → filled rect (no stroke)
2. `.bub-bdr` → border path (NOT closed)
3. `.bub-tip` → triangle tail

**Key rule:**
- Border path must have a **gap where the tail connects**
- Tail endpoints must exactly match that gap

```svg
<rect class="bub-bg" .../>
<path class="bub-bdr" d="... open path ..."/>
<path class="bub-tip" d="M tw,bh L 0,(bh+tail) L -tw,bh"/>
```

**Flipped version:**
- Gap moves to top
- Tail points upward

---

#### 4) Show / hide behavior

**CSS-driven (simple charts):**
- Use `.active` on parent

**JS-driven (most charts):**
- Use inline opacity

```js
// show
bub.style.opacity = '1';

// hide (important: clear, not 0)
bub.style.opacity = '';
```

---

#### 5) Positioning strategy

| Case | Strategy |
|------|---------|
| Large fixed bars | CSS offset |
| Small / dense elements | JS cursor-follow |
| Fixed anchor (tiles, candles) | JS anchored position |

---

### What to avoid (anti-patterns)

- ❌ Placing tooltips inside data layers (gets covered)
- ❌ Using `<rect>` for border (creates seam at tail)
- ❌ Using `fill:none` on tail (creates visual hole)
- ❌ Closing border path (`Z`) → breaks seamless join
- ❌ Not clamping X → tooltip goes off screen
- ❌ Not flipping Y → tooltip gets cut off at top
- ❌ Using fixed offsets for dynamic charts

---


## 6. Depth-Tinting System (Hierarchical Only)

### What it tries to achieve
- Visual depth encoding
- Maintain palette consistency

### Why this design exists
Pure categorical color is insufficient for hierarchical depth perception.

### How to do it
- Blend base color with background using CSS variables
- Recompute on dark mode toggle using `recolor()`

### What to avoid (anti-patterns)
- Rebuilding DOM on theme change
- Hardcoding tinted colors

---

## 7. SVG Paint Order

### What it defines
Rendering order in SVG (no z-index support)

### Specification
1. Grid / axes
2. Data layer (`.ca`)
3. Overlays
4. Tooltips (last)

### Common mistakes
- Rendering tooltips before overlays
- Placing tooltip layers outside container

---

## 8. Iframe Embedding

### What it defines
Rules for correct SVG rendering inside iframes

### Specification
- Always include `@import` in `<style>`
- Escape `&` as `&amp;`

### Common mistakes
- Missing font import causing layout issues

---

## 9. Card Shell & Layout Grid

### What it defines
Standard layout, spacing, and safe boundaries for all chart elements

### Why this design exists
A common failure mode is allowing the plot area to expand too far, which:
- Collides with title/subtitle at the top
- Collides with footer at the bottom
- Overlaps or crowds the legend on the right
- Creates a visually cramped layout even if technically correct

The layout system enforces **breathing room** and consistent visual hierarchy.

### How to do it

#### 1) Fixed layout boundaries (non-negotiable)

- ViewBox: `1100 × 620`

**Plot area constraints:**

| Edge   | Value |
|--------|-------|
| Left   | x = 68  |
| Right  | x = 850 |
| Top    | y = 100 |
| Bottom | y = 500 |

👉 All data elements must stay strictly within this box.

---

#### 2) Reserved zones (must remain clear)

**Top zone (titles):**
- Title: y = 50
- Subtitle: y = 70
- Minimum padding below subtitle → plot must start at **y = 100**

**Bottom zone (footer):**
- Footer: y = 600
- Plot must end at **y = 500** (100px buffer)

**Right zone (legend):**
- Legend starts at x = 870
- Plot must end at **x = 850** (20px gap minimum)

---

#### 3) Internal padding within plot

Even inside the plot box, avoid edge collisions:
- Bars / points should not sit exactly on top/bottom edges
- Leave ~8–16px visual breathing room where possible

---

#### 4) Scaling behavior

- All scaling (y-axis, radius, etc.) must respect the plot box
- Never expand domain visually beyond bounds to “fit more”
- Instead: compress scale or adjust margins internally

---

### What to avoid (anti-patterns)

- ❌ Extending bars/points beyond y = 100 or y = 500
- ❌ Letting labels overlap title/subtitle
- ❌ Allowing chart to visually touch legend panel
- ❌ Using full height for data area (no top/bottom breathing room)
- ❌ Dynamically resizing plot bounds per chart (breaks consistency)

---

### Visual Reference — Plot Area Spacing

![Plot Area Spacing Diagram](sandbox:/mnt/data/chart_layout_diagram.png)

**Interpretation:**
- Left: Correct layout — plot area respects top, bottom, and right reserved zones
- Right: Incorrect layout — plot area expands too far, causing overlap with titles, footer, and legend

---

## Guiding Principles

- CSS owns styling; JS owns behavior
- Never duplicate state between DOM and JS
- Prefer structure over mutation
- Avoid anything that breaks hover consistency
- Always design for both light and dark mode
- Protect layout spacing as strictly as functional correctness

