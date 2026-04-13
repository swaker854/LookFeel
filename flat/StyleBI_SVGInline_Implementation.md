# StyleBI Chart Redesign — Implementation Document

## Overview

This document describes the approach for applying the flat design system
(`flat/` reference SVGs + `Chart_Design_long.md`) to StyleBI's chart
rendering engine. It records all architectural decisions, concerns raised
during investigation, and their resolutions.

---

## 1. Core Architecture Decision

### Question
Can the flat design's interactive features (on-load animation, hover
dimming, hover tooltips, dark mode) be achieved within StyleBI's existing
multi-tile SVG architecture?

### Investigation
StyleBI renders each chart as ~14 separate SVG tiles served as
`image/svg+xml` and displayed via `<img src="blob:...">` tags:

| Tile | Content |
|---|---|
| `plot_area` | Bars, lines, data points, grid lines |
| `bottom_x_axis`, `left_y_axis`, etc. | Axis lines + tick labels |
| `x_title`, `y_title`, etc. | Axis title text only |
| `legend_content`, `legend_title` | Legend items and heading |
| `facetTL/TR/BL/BR` | Facet corner borders |

SVG loaded as `<img>` is sandboxed by the browser — no JS execution,
no CSS `:hover`, no `@keyframes` (unreliable cross-browser).

### Decision
**Inline all 14 SVG tiles.** All tiles are fetched as text and injected
inline via `DomSanitizer`. This gives every tile access to CSS class-based
dark mode, print mode, and theming through a single `dark` / `print` class
toggle on each `<svg>` element. Legend scroll was verified to be pure CSS
`overflow-y: auto` on the Angular host `<div>` — no clip paths or viewBox
tricks inside any tile — making full inline injection safe.

When the flat design flag is off (§ Phase 0), all tiles fall back to
the existing `<img>` / blob-URL path identically to today.

---

## 2. What Lives Where

### Confirmed: Plot Area SVG Contains Only Data Visualization

`VGraphPair.getPlotGraphic()` → `GraphBounds.getPlotBounds()` returns
the pure data area. Confirmed to contain only:
- Bar/line/point data elements
- Grid lines
- Plot background

**Does NOT contain:**
- Axis tick labels (`bottom_x_axis`, `left_y_axis`, etc.)
- Axis title text (`x_title`, `y_title`, etc.)
- Legend (`legend_content`, `legend_title`)
- Chart title (separate Angular `<chart-title-area>` component)
- Subtitle / footer — **these concepts do not exist in StyleBI at all**

### Ownership After Redesign

| Element | Owner |
|---|---|
| Bar colors, animations, hover, tooltips | Inline plot SVG (CSS + Angular JS) |
| Axis tick labels | Inline axis tile — `<style>` block handles dark/print mode |
| Axis titles | Inline axis title tile — `<style>` block handles dark/print mode |
| Legend | Inline legend tile — `<style>` block handles dark/print mode |
| Facet labels | Inline facet tile — `<style>` block handles dark/print mode |
| Chart title | Angular `<chart-title-area>` — no change |
| Dark mode toggle | Angular UI — propagates `dark` class to all inline `<svg>` elements |
| Print mode | Angular UI (interactive) / `VSExportService` (export) — propagates `print` class |
| Subtitle / footer | Angular UI if needed — new addition |

---

## 3. What the Inline Plot SVG Must Emit

### Backend (Java/Batik) Emits

```xml
<svg id="chart-{uniqueId}" width="{w}" height="{h}">
  <defs>
    <style>
      /* Color palette — scoped to this chart instance */
      .bar-1 { fill:#00D4E8; } .bar-2 { fill:#00B87A; } ...

      /* Dark mode — Angular adds/removes 'dark' class on <svg> element */
      #chart-{id}.dark .bar-1 { fill:#22D3EE; } ...

      /* On-load animation */
      @keyframes barFadeIn { from{opacity:0} to{opacity:1} }
      .bb { animation: barFadeIn 0.8s ease-out both; }
      .b1 { animation-delay:0.00s; } .b2 { animation-delay:0.25s; } ...

      /* Hover dimming */
      .bw { cursor:pointer; }
      .ca.hovering .bw        { opacity:0.20; transition:opacity 0.15s; }
      .ca.hovering .bw.active { opacity:1; }

      /* Tooltip */
      .bubble { opacity:0; pointer-events:none; transition:opacity 0.15s; }
      .bw.active .bubble { opacity:1; }
      /* ... full bubble CSS from design system ... */
    </style>
  </defs>

  <!-- static axis lines, grid lines — no classes needed -->
  <line .../> <text .../>

  <!-- data layer with structural nesting -->
  <g class="ca">
    <g class="bw" id="bw1" data-bar-cx="130" data-bar-top="212">
      <g class="bb b1">
        <rect class="bar-1" x="102" y="212" width="56" height="288" rx="10"/>
      </g>
      <g class="bubble" id="bub1">
        <rect class="bub-bg" rx="9"/>
        <path class="bub-bdr"/><path class="bub-tip"/>
        <text class="bub-val">$72M</text>
        <text class="bub-lbl">Cyan</text>
      </g>
    </g>
  </g>
  <!-- NO <script> block — Angular owns all JS -->
</svg>
```

### Angular Handles (Post-Injection)

- Fetch SVG as `responseType: 'text'` (not blob)
- Inject inline via `DomSanitizer.bypassSecurityTrustHtml()`
- Run `initBubbles()` — calls `getBBox()` to size and position tooltip paths
- Attach `mouseenter`/`mouseleave` listeners to `.bw` elements
- Propagate app-level dark mode: add/remove `dark` class on `<svg>` element
- Coordinate with tooltip/data tip system (see §8)

---

## 4. CSS / JS Compatibility When Inlined

### Question
Can the flat design's CSS and JS transfer unchanged when the SVG is
inlined into Angular's DOM?

### Answer — Mostly Yes, Four Adjustments Needed

| Issue | Standalone SVG | Inline SVG fix |
|---|---|---|
| `svg.dark` selector | Correct — matches root element | Breaks — matches all `<svg>` on page. Use `#chart-{id}.dark` |
| CSS class names (`.ct`, `.ca`, `.gl`) | No collision risk | Must scope to `#chart-{id}` or namespace — collide with Angular styles |
| `<script>` tags | Execute normally | Angular strips them — extract and execute via Angular post-injection |
| `document.getElementById('root')` | Works — one chart per file | Breaks with multiple charts — backend generates unique ID per render |

The backend SVG generator handles all four automatically by scoping
everything to a generated unique chart ID.

---

## 5. Backend Engineering Challenges

Batik (`SVGGraphics2D`) generates flat SVG with inline `fill="rgb(...)"` —
no CSS classes, no structural grouping, no style blocks. Three changes
are needed:

### Challenge 1: CSS Class Names on Elements

**Current output:**
```xml
<rect x="102" y="212" width="56" height="288" fill="rgb(0,212,232)"/>
```

**Required:**
```xml
<rect class="bar-1" x="102" y="212" width="56" height="288" rx="10"/>
```

**Approach:** After `paintGraph()` completes, post-process the SVG DOM.
Walk elements, match `fill="rgb(...)"` values against the known palette,
replace inline fill with `class="bar-N"`. No changes to the painting
pipeline. Implemented in `getSubGraphic()` after `graph.paintGraph(g, ctx)`.

### Challenge 2: Structural Grouping (`.ca > .bw > .bb`)

Batik paints all elements flat. The design requires nested groups for
hover dimming and animation to work independently.

**Approach:** `BarVO.paint()` calls begin/end callbacks on a context
object before/after painting each bar. Post-processor wraps the
captured element ranges in `<g class="bw">` / `<g class="bb bN">`.

### Challenge 3: Tooltip Skeleton

Tooltip paths/text don't exist in the current pipeline — JS sizes them
via `getBBox()` at runtime. Backend emits the skeleton only:

```xml
<g class="bubble" id="bub1">
  <rect class="bub-bg" rx="9"/>
  <path class="bub-bdr"/><path class="bub-tip"/>
  <text class="bub-val">$72M</text>
  <text class="bub-lbl">Cyan</text>
</g>
```

Sizes and positions are empty. Angular's `initBubbles()` fills them in
after SVG injection using `getBBox()`. Backend only needs to inject the
data values (from the chart dataset) into `.bub-val` and `.bub-lbl`.

### Corner Radius

`IntervalElement.cornerRadius` already exists, defaults to `0`. Set to
`~0.15` for bars to approximate `rx=10` on standard bar widths.

---

## 6. Existing StyleBI Interactivity — No Interference

### Question
Will inlining the plot SVG break StyleBI's existing chart interactions
(context menu, show detail, drill-down, selection, pan, zoom)?

### Investigation
All StyleBI mouse event handlers are on the **host container `<div>`**,
not on the canvas or `<img>`. Hit detection uses a **region tree spatial
index** (coordinate math), completely independent of DOM structure.
The canvas overlay only **draws** selection highlights — it has no
event listeners.

Confirmed safe for all chart types:

| Interaction | Event target | Safe with inline SVG? |
|---|---|---|
| Click / context menu / show detail | Host `<div>` | Yes |
| Hover → data tip / tooltip | Host `<div>` (mousemove) | Yes |
| Region selection | Host `<div>` → region tree | Yes |
| Pan (map/geo charts) | Host `<div>` (mousedown/move) | Yes |
| Pinch zoom | Chart container | Yes |
| Axis resize drag | `chart-axis-area` host `<div>` | Yes |
| Legend drag/resize | `chart-legend-area` host `<div>` | Yes |

### One CSS Change Required

The canvas overlay (`pointer-events: auto` by default) sits above the
SVG in z-order. With default settings, the mouse physically enters the
canvas first, preventing the SVG elements' `mouseenter`/`mouseleave`
from firing — breaking hover dimming and bubble tooltips.

**Fix:**
```css
.chart-plot-area__canvas,
.chart-plot-area__reference-canvas {
  pointer-events: none;
}
```

Safe because all StyleBI handlers are on the host `<div>`. Canvas can
still draw selection highlights — `pointer-events: none` only affects
event receiving, not rendering.

### One Code Change Required

The only canvas event binding in the codebase:
```html
<!-- chart-plot-area.component.html line 104 -->
<canvas #objectCanvas (dblclick)="brushChart.emit()">
```

Move to host `<div>` to remove the only dependency on canvas pointer events:
```html
<div class="chart-plot-area" (dblclick)="brushChart.emit()" ...>
```

---

## 7. Tooltip / Data Tip Coordination

### Question
StyleBI shows tooltip or data tip on hover. The flat design also shows a
bubble tooltip on hover. Do they conflict?

### StyleBI Hover States

StyleBI has two mutually exclusive hover states:

| State | Condition | What shows |
|---|---|---|
| Built-in tooltip | No data tip configured (default) | Simple text string from region metadata, Angular overlay div |
| Data tip | `model.dataTip` is set | Rich VS assembly popup, server-refreshed, Angular overlay div |

Code path (`chart-plot-area.ts`):
```typescript
if (this.dataTip && !this.dataTipOnClick) {
  this.showDataTip.emit(chartSelection);  // data tip — rich popup
} else {
  this.emitTooltip(regions);             // built-in tooltip — text string
}
```

### Resolution

Hover dimming (`.ca.hovering`) always fires — it is purely aesthetic,
independent of which tooltip system is active.

SVG bubble visibility is controlled by Angular adding/removing `.active`
on `.bw`. Angular decides per hover:

| Condition | `.hovering` | `.active` | Tooltip shown |
|---|---|---|---|
| No data tip configured | Added | Added | SVG bubble (replaces built-in tooltip) |
| Data tip configured | Added | Not added | StyleBI data tip popup |
| Data tip + `dataTipOnClick` | Added | Added | SVG bubble on hover, data tip on click |

The built-in tooltip is suppressed in the no-data-tip case by not
setting `tooltipString` in `chart-area.component.ts:showTooltip()` when
the SVG bubble is active.

---

## 8. Chart Groups and Implementation Approach

All 24 flat design chart types are compatible with the inline SVG
approach. They divide into four groups by animation method.

### Group 1 — A2 Animation (Simplest)

**Charts:** Bar, Stacked Bar, Candle, Waterfall, Gantt, Pareto

Animation: Pure CSS `@keyframes`, `both` fill-mode. Safe because the
animated element (`.bb`) is a **child** of the hover target (`.bw`) —
fill-mode never touches the outer element, so hover dimming is unaffected.

Tooltip: CSS-driven. `.bubble` lives inside `.bw`. Shown via
`.bw.active .bubble { opacity:1 }`.

Backend emits: Full static structure. All geometry, CSS classes,
grouping, tooltip skeleton. No JS in SVG.

Angular post-injection:
- `initBubbles()` — sizes and positions tooltip paths via `getBBox()`
- Attach `mouseenter`/`mouseleave` to `.bw` elements
- Angular manages `.active` / `.hovering`

### Group 2 — A1 Animation

**Charts:** Treemap, Icicle, Marimekko, Circle Packing, Steparea,
Stepline, Jumpline

Animation uses `animationend` + `.visible` class pattern. Required
because the **same element** is both animated and the hover target.
CSS `both` fill-mode would lock opacity and break hover dimming.

Backend emits: Same as Group 1 — full static structure with CSS
classes. `@keyframes` definition in `<style>` block.

Angular post-injection (additional step vs Group 1):
```typescript
// Fire animation via inline style (not CSS class — avoids fill-mode)
el.style.animation = 'itemFade 0.8s ease-out';
el.addEventListener('animationend', () => {
  el.style.animation = 'none';
  el.classList.add('visible');  // CSS: .item.visible { opacity:1 }
});
// Gate hover until all animations complete
const lastDelay = (count - 1) * Math.min(0.25, 1.0 / count);
setTimeout(() => container.classList.add('ready'),
  (lastDelay + 0.8 + 0.1) * 1000);
```

### Group 3 — rAF Animation

**Charts:** Pie, Sunburst, Radar, Bubble

Combines geometric transformation (rotation, scale) with opacity — CSS
`@keyframes` alone cannot do this.

Note: In the standalone flat SVG files, JS also *builds* the geometry
(slices, arcs, polygon points). In StyleBI, Java/Batik already renders
all geometry. The rAF animation in the flat file is repurposed: it
animates from `opacity:0, transform:scale(0.8)` to
`opacity:1, transform:scale(1)` on the element group. No geometry
construction needed.

Backend emits: Static geometry with CSS classes. No animation code in SVG.

Angular post-injection (additional step vs Group 1):
```typescript
// Angular runs rAF loop — geometry already rendered by Java
function animate(timestamp) {
  const t = easeOut((timestamp - start) / 800);
  el.style.opacity = t;
  el.style.transform = `scale(${0.8 + 0.2 * t})`;
  if (t < 1) requestAnimationFrame(animate);
  else { el.style.opacity = ''; el.style.transform = ''; }
}
requestAnimationFrame(animate);
```

### Group 4 — Line and Area Charts

**Charts:** Line, Stacked Line, Area, Stacked Area

Same as Group 1/2 for paths and fills. One additional concern:

**Dot markers on line charts.** The flat design places interactive hit
dots at each data point (`.bw` wrappers with bubbles). In the flat SVG
files these are built by JS with known pixel coordinates. In StyleBI,
Java renders the line path but does not emit dot markers.

Backend must emit dot marker skeletons at each data point position:
```xml
<g class="bw" id="bwN" data-bar-cx="{px}" data-bar-top="{py}">
  <circle class="dot bar-N" cx="{px}" cy="{py}" r="5"/>
  <g class="bubble" id="bubN">...</g>
</g>
```

Java has data point pixel coordinates at render time (they are used to
draw the line path). They just need to also be emitted as dot group
attributes.

### Group 5 — Relation Charts (Tree, Network, Circular Network)

**Charts:** Tree, Network, Circular Network

**Why these were flagged as uncertain:** The standalone flat SVG files
build all geometry in JS — tree layout, force-directed positions,
circular coordinates. This looked like a client-side dependency.

**Resolution:** StyleBI computes all layout server-side via the mxGraph
library before SVG generation. Java executes the full layout algorithm
and paints complete geometry to Batik:

| Chart | Algorithm | Computed where |
|---|---|---|
| Tree | `mxCompactTreeLayout` | Java — fully |
| Network | `mxOrganicLayout` (force-directed) | Java — fully |
| Circular Network | `mxCircleLayout` (radial) | Java — fully |

The browser receives complete static geometry. No client-side layout
computation required. These charts use the same backend pipeline as
all other groups.

**Animation:** A1 — same as Group 2. The `node-g` element is both the
animated element and the hover target.

**What differs from Group 2: topology-aware hover**

Bar/treemap hover dims everything except the active element. Relation
chart hover keeps the **connected subgraph** visible:

| Chart | Stays visible on hover |
|---|---|
| Tree | Hovered node + direct parent + direct children + their edges |
| Network | Hovered node + all neighbours + connected edges |
| Circular Network | Same as Network |

This requires Angular to know node connections at hover time. The
backend emits connection data as attributes:

```xml
<!-- Tree node -->
<g class="node-g bar-2" id="nodeN"
   data-parent="nodeA"
   data-children="nodeB,nodeC">
  <rect class="node-rect" .../>
  <text class="node-title">Label</text>
  <text class="node-sub">Sublabel</text>
</g>

<!-- Network / Circular Network node -->
<g class="node-g bar-3" id="nodeN"
   data-neighbours="nodeX,nodeY,nodeZ">
  <circle class="node-circle" cx="..." cy="..." r="..."/>
  <text class="node-lbl">Label</text>
</g>

<!-- Edge with source/target for .connected lookup -->
<line class="edge" data-source="nodeA" data-target="nodeB" .../>
```

Angular builds a neighbour map from these attributes once after
injection. On `mouseenter`:
- Add `.hovered` to the active node
- Add `.connected` to all neighbours and their edges
- Add `.hovering` to `.ca`

Hover CSS:
```css
.ca.hovering .node-g           { opacity:0.20; transition:opacity 0.15s; }
.ca.hovering .edge             { opacity:0.10; transition:opacity 0.15s; }
.ca.hovering .node-g.hovered   { opacity:1; }
.ca.hovering .node-g.connected { opacity:1; }
.ca.hovering .edge.connected   { opacity:1; }
```

**Tooltip:** JS-driven (same pattern as Group 2 JS-tooltip charts).
Angular positions tooltip after `initBubbles()` using `getBBox()`.

**Node shape by chart type:**

| Chart | Node shape | Edge shape |
|---|---|---|
| Tree | `<rect>` (boxes) | `<path>` (elbow connectors) |
| Network | `<circle>` | `<line>` (straight) |
| Circular Network | `<circle>` | `<path>` (quadratic bezier) |

All are handled by the same Angular hover/animation logic — only the
CSS class names on the geometry elements differ.

---

## 9. Legend Coordination

### Current State

The legend renders as two separate `<img>` SVG tiles (`legend_content`,
`legend_title`) via the same Batik pipeline as the plot area. Current
output has no CSS classes on elements, no rounded corners, colors baked
in as `fill="rgb(...)"`. No hover effects on legend items. No dark mode
propagation from Angular to the legend SVG.

### What the Flat Design Requires

The flat design legend (from `bar_flat.svg`) is informational only —
it does not respond to bar hover and has no click interactions. The
requirements against the flat design are:

| Feature | Required | Notes |
|---|---|---|
| Styled rounded background (`.lgd-bg`) | Yes | Scoped to legend ID |
| Color swatches with `.bar-N` classes | Yes | Enables dark mode switching |
| Dark mode response | Yes | Angular adds `dark` to legend `<svg>` |
| Typography matching flat design | Yes | `.lgd-ttl`, `.lt` classes |
| Print-mode values (`.lgd-val`) | No | Deferred — out of scope |
| Highlight legend item on bar hover | No | Not in flat design |
| Click legend item to hide/show series | No | StyleBI feature, not in flat design |

### The Core Problem: Dark Mode Mismatch

When Angular switches dark mode:
- Plot `<svg>` gets `dark` class → CSS instantly updates bar colors ✓
- Legend `<img>` tiles are unaffected → colors remain light-mode ✗

The two SVGs fall out of sync on every theme switch.

### Decision: Inline the Legend SVG (Option A)

Apply the same technique as the plot area. The legend is simpler geometry
— no structural grouping, no tooltip skeleton, no animation. The delta
from the plot area approach is small.

**Backend adds to legend SVG:**
- Unique `id` on root `<svg>` (e.g., `id="lgd-abc123"`)
- `<style>` block: `.bar-N` palette, `#lgd-{id}.dark` overrides,
  `.lgd-bg` rounded background, `.lgd-ttl` / `.lt` typography
- `class="bar-N"` on each color swatch rect (same color-match technique
  as plot area — post-process DOM, match `fill="rgb(...)"` to palette)
- `class="lgd-bg"` on background rect, `class="lgd-ttl"` on title text,
  `class="lt"` on item label text

**Angular adds:**
- `chart-legend-area.component.ts`: fetch legend SVG as text, inject
  inline via `DomSanitizer` (same directive change as plot area)
- On dark mode toggle: add/remove `dark` class on all inline `<svg>`
  elements in the chart — both plot and legend update together

### Existing Legend Interactions Are Unaffected

All legend interactions — click to select, "show only" context menu,
drag, resize — use the same coordinate-based region tree spatial index
as the plot area. The `<img>` tile plays no role in hit detection.
Replacing it with inline `<svg>` changes nothing about event routing
or region lookup.

Confirmed safe interactions after inlining:

| Interaction | Mechanism | Affected? |
|---|---|---|
| Click legend swatch | Host `<div>` → `getTreeRegions(x,y)` → `selectRegion` event | No |
| "Show only" context menu | Right-click → region detection → context menu handler | No |
| Drag legend panel | `chart-legend-container` host `<div>` mousedown/move | No |
| Resize legend panel | `chart-legend-container` resize directive | No |
| Hover tooltip | Host `<div>` mousemove → region → tooltip string | No |

**Legend canvas: no `pointer-events` change needed.** Unlike the plot
area, the flat design adds no `mouseenter`/`mouseleave` listeners to
individual legend items — the legend is purely visual. The legend
canvas can remain at its default `pointer-events: auto` and will not
intercept anything that matters.

### What Is NOT Needed

The flat design does not require coordination between a bar hover and
the legend. No `.active` / `.hovering` class management is needed on
legend elements. The legend is a passive visual — it only needs dark
mode styling to stay in sync with the plot SVG.

### Future Enhancement (Beyond Flat Design Scope)

If hover coordination is added later (e.g., hovering a bar dims
non-matching legend items), the inline legend SVG enables this trivially:
Angular adds `.dimmed` to legend items whose series index does not match
the hovered bar's color index. CSS drives the opacity change. No
architectural change needed at that point.

---

## 10. Color Palette System

### Question
StyleBI currently has no separate color palettes for light and dark
mode. How should dual-mode palettes be added, and where should
user-supplied custom palettes live?

### Current State

StyleBI already has a solid named palette system:

- **Named palettes** defined in CSS: `ChartPalette[name='Soft'][index='1'] { color: #hex; }`
- **15+ built-in palettes**: Default, Soft, Pastel, Red, Green, Blue, Orange, Gray, Heat 8/16/24
- **Organization-scoped**: `ColorPalettes.java` loads per org via `OrganizationManager`
- **API endpoint**: `GET /api/composer/chart/colorpalettes` returns all palettes for current org
- **UI picker**: `palette-dialog.component.ts` and `graph-palette-dialog.component.ts`
- **No dark variants**: one color per palette per index — the gap to fill
- **No user-created palettes**: predefined in `defaults.css` only

### Custom Palettes Belong in the Theme System

StyleBI already has a theme mechanism (`CustomTheme`, `CustomThemesManager`).
Theme JARs can contain arbitrary files. `ThemeProtocolResolver` already
serves files from theme JARs via `theme://` URLs. Themes are already
org-scoped and user/group/role assignable. The admin upload UI already
exists.

**The single missing piece:** `ColorPalettes.java` loads only from
`portal/format.css` in the DataSpace — it never checks the active
theme JAR. Everything else is already in place.

**The fix — one targeted change to `ColorPalettes.java`:**
```java
private void loadPalettes() {
    // Existing: load built-in defaults from classpath
    CSSDictionary base = CSSDictionary.getDictionary();

    // New: if a custom theme is active, merge from theme JAR
    String themeId = CustomThemesManager.getManager().getSelectedTheme();
    if(themeId != null) {
        String themeCss = "theme://" + themeId + "/chart-palettes.css";
        CSSDictionary themed = CSSDictionary.getDictionary(themeCss);
        // theme palettes override built-ins of the same name
    }
}
```

An organization includes `chart-palettes.css` in their theme JAR.
No new storage mechanism. No new admin screen. Existing theme upload
handles it.

### Dual Palette Format (Light + Dark)

Extend the CSS palette format with a `variant` attribute:

```css
/* defaults.css — built-in Flat palette */
ChartPalette[name='Flat'][variant='light'][index='1'] { color: #00D4E8; }
ChartPalette[name='Flat'][variant='dark'][index='1']  { color: #22D3EE; }

/* OrgA theme JAR — chart-palettes.css */
ChartPalette[name='BrandBlue'][variant='light'][index='1'] { color: #0055CC; }
ChartPalette[name='BrandBlue'][variant='dark'][index='1']  { color: #3388FF; }
```

Backward compatibility: existing palettes without `variant` are treated
as light mode. The CSS format extension is additive.

### How It Flows Into the SVG Style Block

The active palette name is already stored per chart in chart config.
When `VGraphPair` generates the plot SVG `<style>` block:

```
ColorPalettes.getLightPalette(activePaletteName) → 8 Colors
ColorPalettes.getDarkPalette(activePaletteName)  → 8 Colors (falls back to light if no dark variant)

<style>
  .bar-1                  { fill: lightColors[0]; }
  #chart-abc.dark .bar-1  { fill: darkColors[0];  }
  ... × 8
</style>
```

No hardcoded hex values in SVG generation code. Palette always read
from config system. Same logic applies to the legend SVG style block.

### What Changes

**Backend (Java):**

| File | Change |
|---|---|
| `defaults.css` | Add `variant='light'`/`variant='dark'` to all `ChartPalette` selectors. Add new `Flat` palette with flat design colors. |
| `ColorPalettes.java` | (1) Check active theme JAR for `chart-palettes.css` and merge. (2) New `getLightPalette(name)` and `getDarkPalette(name)` methods. |
| `CategoricalColorModel.java` | Add `darkColors[]` field alongside existing `colors[]` |
| `VGraphPair.java` | Use both palette variants when generating SVG `<style>` block for plot and legend SVGs |
| `AssemblyImageService.java` | Pass active palette name to SVG generator |

**Frontend (Angular):**

| File | Change |
|---|---|
| `palette-dialog.component.ts` | Show light + dark swatch pairs per palette row; preview toggles between modes |
| `default-palette.ts` | Add flat design palette colors to color picker swatch grid |

**Theme JAR (documentation only — no code change):**
Document that a theme JAR may include `chart-palettes.css` with
`ChartPalette[name][variant][index]` selectors. Organizations include
this file in their theme JAR via the existing theme upload flow.

No new admin screen. No new API endpoints beyond extending the existing
`/api/composer/chart/colorpalettes` to return `darkColors[]`.

---

## 11. Recommended Build Order

Each phase is independently testable and delivers visible progress.
Every phase also implicitly requires `StyleBI_Chart_Redesign_Implementation.md`
(this document) as context.

---

### Phase 0 — Design Version Flag (Backend + Frontend, prerequisite)

Must be completed before any other phase. All subsequent changes are
gated behind this flag so existing behaviour is never broken by default.

**Design principle:** none of the Java defaults (`GDefaults`, `AxisSpec`,
`AxisLine`) change unconditionally. Grid line visibility, tick removal,
and axis colors all come from the injected `<style>` block or
post-processing step — both of which are gated. When the flag is off
the system behaves identically to today.

**Three-tier flag resolution** (each tier overrides the one above):

| Tier | Storage | Default |
|---|---|---|
| System | `SreeEnv` property `inetsoft.graph.flatDesign` | `true` |
| Org | Per-org setting in `OrganizationManager` | inherits system |
| Embed | `<inetsoft-chart flat-design="false">` attribute | inherits org |

New installs get the new design automatically. Existing installs
upgrading can set `inetsoft.graph.flatDesign=false` to preserve the
current look, then migrate org-by-org or embed-by-embed.

**Steps:**

1. Add `inetsoft.graph.flatDesign` boolean to `SreeEnv` with default `true`
2. Add `flatDesign` field to `OrganizationSettings` (or equivalent
   per-org settings class); admin UI toggle in the org settings screen
3. Add `boolean flatDesign` field to `GraphPaintContext` — resolved by
   combining system + org tier at request time in `AssemblyImageService`
4. `BatikSVGSupport`: check `GraphPaintContext.isFlatDesign()` before
   injecting `<style>` block — skip entirely when false
5. `VGraphPair`: check same flag before post-processing SVG DOM — skip
   class names, grouping, and tooltip skeleton when false
6. Expose resolved flag to Angular via an existing settings API response
   (one new boolean field — no new endpoint needed)
7. Angular `FlatDesignService` reads flag at init; `chart-image.directive.ts`
   checks it before deciding inline vs. `<img>` fetch mode
8. Web Component: accept `flat-design` attribute, override service value

**Deliverable:** Flag infrastructure in place. All subsequent phases
work correctly with the flag on. Flag off = identical to current
production behaviour. Verified with a side-by-side screenshot.

**Files to modify:**

| File | Change |
|---|---|
| `SreeEnv.java` | Add `inetsoft.graph.flatDesign` property (default `true`) |
| `OrganizationSettings.java` | Add `flatDesign` boolean field + getter/setter |
| `OrganizationManager.java` | Expose `isFlatDesign(orgId)` combining system + org tier |
| `GraphPaintContext.java` | Add `boolean flatDesign` field + getter/setter |
| `AssemblyImageService.java` | Resolve system + org flag; set on `GraphPaintContext` |
| `BatikSVGSupport.java` | Gate `<style>` injection on `GraphPaintContext.isFlatDesign()` |
| `VGraphPair.java` | Gate all SVG post-processing on `GraphPaintContext.isFlatDesign()` |
| Settings API controller | Add `flatDesign` boolean to existing chart/portal settings response |
| `FlatDesignService.ts` (new) | Angular service — reads flag from API, exposes `isFlatDesign()` |
| `chart-image.directive.ts` | Inject `FlatDesignService`; choose inline vs. `<img>` path |
| Web Component host | Accept `flat-design` attribute; override `FlatDesignService` value |

**Design references to load:**

- `StyleBI_Chart_Redesign_Implementation.md` — this document

---

### Phase 1 — Colors and Animation (Backend only)

> **Flag gate:** all steps below execute only when
> `GraphPaintContext.isFlatDesign()` is `true` (set up in Phase 0).

1. Generate unique chart ID, set on `<svg id="chart-{id}">`
2. Inject `<style>` block: color palette (`.bar-N`), dark mode overrides
   (`#chart-{id}.dark .bar-N`), print mode overrides (`#chart-{id}.print`),
   `@keyframes`, hover CSS, tooltip CSS
3. Post-process DOM: replace inline `fill="rgb(...)"` with `class="bar-N"`
4. Set `IntervalElement.cornerRadius` default to `~0.15` (in post-processing,
   not in `IntervalElement.java` — keeps Java default at 0 when flag is off)

**Deliverable:** Colors and staggered fade-in animation work in the
existing `<img>` display. Proves the backend pipeline before Angular changes.

> Note: CSS `@keyframes` in `<img>`-loaded SVG is partially supported in
> some browsers. Phase 1 is a backend validation step. Full reliability
> requires Phase 3 (inline injection).

**Files to modify:**

| File | Change |
|---|---|
| `BatikSVGSupport.java` | Hook into `writeSVG(OutputStream)` before `stream()` — inject `<style>` block (palette, dark mode, **print mode**, animation, hover, tooltip rules); set chart ID on root `<svg>` |
| `VGraphPair.java` | Post-process SVG DOM after `paintGraph()` — replace inline `fill="rgb(...)"` with `class="bar-N"` |
| `IntervalElement.java` | Set default `cornerRadius` to `~0.15` |

**Print mode CSS injected into every SVG `<style>` block:**

```css
/* print mode — legend values visible, interactive tooltips suppressed */
.lv { opacity: 0; }
#chart-{id}.print .lv     { opacity: 1; }
#chart-{id}.print .bubble { opacity: 0 !important; }
#chart-{id}.print .tip    { opacity: 0 !important; }
```

**Design references to load:**

- `Chart_Design_short.md` — color palette class names, dark mode selector rules, animation method table
- `Chart_Design_long.md` — full `@keyframes` definition, timing constants, stagger formula
- `bar_flat.svg` — reference `<style>` block (`.bar-N` palette, `@keyframes`, hover CSS, print mode rules)

---

### Phase 2 — Structural Grouping (Backend)

5. `.ca` wrapper group around all data elements
6. `.bw` / `.bb` grouping per data element with stagger class (`.b1`, `.b2` ...)
7. `data-bar-cx`, `data-bar-top` attributes on `.bw` groups
8. Tooltip skeleton injection (`.bubble`, `.bub-bg`, `.bub-bdr`, `.bub-tip`, value/label text)

**Deliverable:** SVG structure matches the flat design. Ready for Angular.

**Files to modify:**

| File | Change |
|---|---|
| `VGraphPair.java` | Post-process SVG DOM — add `.ca` wrapper, `.bw`/`.bb` grouping, stagger classes, data attributes on bar groups |
| `BarVO.java` | Begin/end callbacks for per-bar element range tracking (needed to identify element boundaries in post-processing) |
| `AssemblyImageService.java` | Pass dataset values to SVG generator for tooltip skeleton text |

**Design references to load:**

- `bar_flat.svg` — `.ca`, `.bw`, `.bb` nesting structure; stagger class pattern; tooltip skeleton markup (`.bubble`, `.bub-bg`, `.bub-bdr`, `.bub-tip`)
- `Chart_Design_long.md` — tooltip 3-part construction rules, clamping, vertical flip logic

---

### Phase 3 — Angular Inline Injection (Frontend)

> **Flag gate:** `chart-image.directive.ts` checks `FlatDesignService.isFlatDesign()`
> before choosing inline vs. `<img>` path. When false, the directive behaves
> identically to today. All Angular post-injection logic (steps 12–15) is
> also gated — skipped entirely when the flag is off.

9. Change `chart-image.directive.ts`: fetch as `responseType: 'text'`,
   inject inline via `DomSanitizer`
10. Add `pointer-events: none` to canvas overlays
11. Move `(dblclick)="brushChart.emit()"` from canvas to host `<div>`
12. Angular runs `initBubbles()` after SVG injection
13. Angular attaches `mouseenter`/`mouseleave` to `.bw` elements,
    manages `.active` / `.hovering`
14. Dark mode: Angular propagates `dark` class to all inline `<svg>` elements
15. Print mode: Angular propagates `print` class to all inline `<svg>` elements
    when `printLayout` input is `true`

**Deliverable:** Full interactivity working for Group 1 charts (bar,
stacked bar, candle, waterfall, gantt, pareto).

**Files to modify:**

| File | Change |
|---|---|
| `chart-image.directive.ts` | Fetch as `responseType: 'text'`, inject inline via `DomSanitizer.bypassSecurityTrustHtml()` |
| `chart-plot-area.component.ts` | Post-injection: `initBubbles()`, `mouseenter`/`mouseleave` on `.bw`, `.active`/`.hovering` management, dark mode propagation to `<svg>` |
| `chart-plot-area.component.html` | Move `(dblclick)="brushChart.emit()"` from canvas element to host `<div>` |
| `chart-plot-area.component.scss` | Add `pointer-events: none` to `.chart-plot-area__canvas` and `.chart-plot-area__reference-canvas` |
| `chart-area.component.ts` | Suppress built-in `tooltipString` when SVG bubble is active; propagate `dark` and `print` classes to all inline `<svg>` elements |
| `_directives.scss` | Update `.widget__default-tooltip` to match flat design visual style (see below) |
| `vs-chart.component.scss` | Add card shell drop shadow to `.chart-area__background` (see below) |

**SBI HTML tooltip — visual update** (`_directives.scss`)

The existing `.widget__default-tooltip` should visually match the flat
design bubble for the transition period and for any edge case where the
SVG bubble cannot show. This is **not gated by the flat design flag** —
it is a global CSS update applied unconditionally because it improves
all tooltip appearances regardless of chart design version:

```scss
.widget__default-tooltip {
  background: #FFFBFE;
  color: #1C1B1F;
  border: 1px solid #79747E;
  border-radius: 8px;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.15);
  font-family: Inter, 'Helvetica Neue', Arial, sans-serif;
  font-size: 11px;
  padding: 6px 10px;
}
// Dark mode
.dark .widget__default-tooltip {
  background: #49454F;
  color: #E6E0E9;
  border-color: #938F99;
}
```

A CSS `::before` arrow can approximate the SVG bubble tail. It will
not be pixel-perfect but maintains visual consistency.

**Card shell** (`vs-chart.component.scss`)

The chart container gains a drop shadow matching the flat design card
elevation. Gated by a `.flat-design` class applied by Angular when
`FlatDesignService.isFlatDesign()` is true:

```scss
.flat-design .chart-area__background {
  filter: drop-shadow(0 1px 2px rgba(0, 0, 0, 0.10));
}
.flat-design.dark .chart-area__background {
  filter: drop-shadow(0 1px 4px rgba(0, 0, 0, 0.25));
}
```

Background color (`#FFFBFE` light / `#1C1B1F` dark) is already driven
by the `--inet-main-panel-bg-color` CSS variable — update the variable's
default value in `_variables.scss`. Border radius default set to `8px`
via `model.objectFormat.roundCorner` Java default (users can override
per-chart). This is applied in `VGraphPair` only when `isFlatDesign()`.

**Design references to load:**

- `bar_flat.svg` — full hover JS pattern (`.active`, `.hovering`, stale-clear on mouseenter), bubble show/hide logic
- `Chart_Design_short.md` — hover interaction rules (stale-clear, dimmed opacity, mouseleave placement table), tooltip CSS-driven approach, card shell CSS values
- `bar_stacked_flat.svg`, `candle_flat.svg`, `waterfall_flat.svg`, `gantt_flat.svg`, `pareto_flat.svg` — Group 1 chart variations

---

### Phase 4 — A1 Animation (Frontend, Group 2 charts)

15. Angular fires inline `style.animation` per element after injection
16. `animationend` handler sets `style.animation = 'none'`, adds `.visible`
17. `setTimeout` adds `.ready` class to container after last animation completes

**Deliverable:** Group 2 charts animated (treemap, icicle, marimekko, funnel,
circle packing, boxplot).

**Files to modify:**

| File | Change |
|---|---|
| `chart-plot-area.component.ts` | A1 animation runner: set inline `style.animation` per element with stagger delay; `animationend` adds `.visible`; `setTimeout` adds `.ready` |

**Design references to load:**

- `Chart_Design_long.md` — A1 animation pattern in full detail (no fill-mode, `.visible` ownership, `.ready` gate, timing constants)
- `icicle_flat.svg` — canonical A1 reference implementation
- `treemap_flat.svg`, `marimekko_flat.svg`, `funnel_flat.svg`, `circle_packing_flat.svg`, `boxplot_flat.svg` — Group 2 chart variations

---

### Phase 5 — rAF Animation (Frontend, Group 3 charts)

18. Angular rAF runner with `ease-out` easing animates scale + opacity per slice
19. On loop completion: clear inline opacity on hover-dimmed elements, lock
    inline opacity on decorative elements; add `.ready`

**Deliverable:** Group 3 charts animated (pie, sunburst, radar, bubble).

**Files to modify:**

| File | Change |
|---|---|
| `chart-plot-area.component.ts` | rAF runner: easing loop, simultaneous geometry + opacity animation; clear vs. lock inline opacity at completion; add `.ready` |

**Design references to load:**

- `Chart_Design_long.md` — rAF animation pattern: hover-dimmed vs. decorative opacity handling, `.ready` placement
- `pie_flat.svg` — canonical rAF reference implementation (donut)
- `sunburst_flat.svg`, `radar_flat.svg`, `bubble_flat.svg` — Group 3 chart variations

---

### Phase 6 — Line / Area Dot Markers (Backend + Frontend)

19. Backend emits `<circle>` dot marker skeletons at each data point with
    `data-x`, `data-y`, `data-value` attributes
20. Angular `initBubbles()` handles dot tooltips same as bar tooltips

**Deliverable:** Full interactivity on line, area, step, jump, and stacked
line/area charts.

**Files to modify:**

| File | Change |
|---|---|
| `VGraphPair.java` | Emit `<circle class="dot-marker">` skeletons at data point positions with value data attributes |
| `chart-plot-area.component.ts` | Extend `initBubbles()` to handle dot marker hover and tooltip positioning |

**Design references to load:**

- `line_flat.svg` — dot marker structure, tooltip positioning for line charts
- `area_flat.svg`, `pareto_flat.svg`, `stepline_flat.svg`, `steparea_flat.svg`, `line_stacked_flat.svg`, `area_stacked_flat.svg`, `jumpline_flat.svg` — Group 4 chart variations

---

### Phase 7 — Relation Charts (Backend + Frontend)

21. Backend emits `data-parent`, `data-children` (tree) or `data-neighbours`
    (network/circular) on each `node-g` element
22. Backend emits `data-source`, `data-target` on each edge element
23. Angular builds neighbour map from data attributes after injection
24. `mouseenter` adds `.hovered` + `.connected` to connected subgraph;
    A1 animation same as Phase 4

**Deliverable:** Full interactivity on Tree, Network, Circular Network.

**Files to modify:**

| File | Change |
|---|---|
| `RelationVO.java` | Emit `data-parent`/`data-children` (tree) or `data-neighbours` (network) on each node `<g>` element |
| `RelationEdgeVO.java` | Emit `data-source`/`data-target` on each edge element |
| `chart-plot-area.component.ts` | Build neighbour map post-injection; `mouseenter` adds `.hovered` + `.connected` to connected subgraph; edge highlight logic |

**Design references to load:**

- `tree_flat.svg` — node/edge structure, data attribute conventions, connected-subgraph hover pattern
- `network_flat.svg`, `circular_network_flat.svg` — Group 5 chart variations

---

### Phase 8 — Legend Inline SVG + Visual Styling (Backend + Frontend)

> **Flag gate:** legend post-processing and `<style>` injection are gated
> by `GraphPaintContext.isFlatDesign()` (backend) and
> `FlatDesignService.isFlatDesign()` (frontend). When off, legend tiles
> remain as `<img>` tags with no class modifications.

25. Backend: add `class="bar-N"` to swatch rects, `class="lgd-bg"` to
    background rect, `class="lgd-ttl"` to title text, `class="lt"` to
    item labels, `class="lgd-div"` to any divider lines
26. Backend: apply visual default changes (see gap analysis below) —
    background color, border color, swatch size and corner radius
27. Backend: inject `<style>` block + unique legend ID into
    `legend_content` and `legend_title` SVGs
28. Frontend: `chart-legend-area.component.ts` fetches legend as text,
    injects inline
29. Frontend: `chart-area.component.ts` propagates `dark` and `print`
    classes to all inline `<svg>` elements (plot + legend together)
30. Backend (export path): `VSExportService` sets `class="print"` on all
    inline `<svg>` elements when generating the print layout export

**Deliverable:** Legend visually matches flat design — correct background,
border, title weight, label color, swatch size and rounding — and stays
in sync with plot SVG on dark mode and print mode switches.

### Legend Visual Gap Analysis

| Property | Current StyleBI | Flat Design (light) | Flat Design (dark) | How to fix |
|---|---|---|---|---|
| Background fill | `null` (transparent) | `#E7E0EC` | `#49454F` | Java `LegendSpec` default + CSS class override |
| Border color | `#EEEEEE` | `#79747E` | `#938F99` | Java `LegendSpec` default + CSS dark override |
| Border width | `0.5px` | `0.5px` | — | No change |
| Title color | `#2B2B2B` | `#79747E` | `#938F99` | CSS `.lgd-ttl` rule |
| Title weight | `PLAIN` (400) | `500` (medium) | — | CSS `font-weight: 500` |
| Title letter-spacing | none | `0.4px` | — | CSS `letter-spacing: 0.4px` |
| Item label color | `#4B4B4B` | `#1C1B1F` | `#E6E0E9` | CSS `.lt` rule |
| Item label size | `10pt` | `11px` | — | CSS `font-size: 11px` |
| Swatch size | `12×12px` | `14×14px` | — | Java `LegendSpec.setSymbolSize(14)` |
| Swatch corner radius | `0` (square) | `rx="3"` (3px) | — | Java: set `rx` attribute on swatch `<rect>` |
| Swatch border | `#A3A3A3` (fixed) | matches swatch fill | — | Java: set swatch stroke = fill color |
| Divider | none | `#79747E`, opacity `0.3` | stroke `#938F99` | CSS `.lgd-div` rule (if element exists) |

**CSS `<style>` block injected by `BatikSVGSupport` for legend tiles:**

```css
/* light mode */
.lgd-bg  { fill: #E7E0EC; stroke: #79747E; stroke-width: 0.5; }
.lgd-ttl { fill: #79747E; font-weight: 500; letter-spacing: 0.4px; }
.lt      { fill: #1C1B1F; font-size: 11px; }
.lgd-div { stroke: #79747E; stroke-width: 0.5; opacity: 0.3; }

/* dark mode */
#legend-{id}.dark .lgd-bg  { fill: #49454F; stroke: #938F99; }
#legend-{id}.dark .lgd-ttl { fill: #938F99; }
#legend-{id}.dark .lt      { fill: #E6E0E9; }
#legend-{id}.dark .lgd-div { stroke: #938F99; }

/* print mode — legend values visible */
.lv { opacity: 0; }
#legend-{id}.print .lv { opacity: 1; }
```

**Files to modify:**

| File | Change |
|---|---|
| `Legend.java` | Post-process SVG DOM: add class names to background rect, title text, item labels, dividers; set legend background to `#E7E0EC` and border to `#79747E`; inject `<style>` block + unique legend ID |
| `LegendItem.java` | Replace inline `fill="rgb(...)"` on swatch rect with `class="bar-N"`; set swatch size to 14px; set `rx="3"` on swatch rect; set swatch stroke to match fill |
| `BatikSVGSupport.java` | Inject legend `<style>` block including print mode `.lv` rules (same hook as plot area and axis tiles) |
| `chart-legend-area.component.ts` | Fetch `legend_content` and `legend_title` SVGs as text; inject inline via `DomSanitizer` |
| `chart-area.component.ts` | Propagate `dark` and `print` classes to all inline `<svg>` elements (plot + legend) on theme and print mode toggle |
| `VSExportService.java` | Set `class="print"` on all inline `<svg>` elements when building the print layout HTML export |

**Design references to load:**

- `bar_flat.svg` — full legend `<style>` block (all class names, light + dark values, swatch size/radius)
- `line_flat.svg` — legend with divider line treatment
- `pie_flat.svg` — legend with section label (`.lp`) if applicable

---

### Phase 9 — Color Palette System (Backend + Frontend)

29. `defaults.css` — add `variant` attribute to all existing palettes;
    add new `Flat` palette with flat design light + dark colors
30. `ColorPalettes.java` — load theme JAR `chart-palettes.css` if active
    theme is set; add `getLightPalette()` / `getDarkPalette()`
31. `VGraphPair.java` — use both palette variants when generating `<style>`
    blocks for plot and legend SVGs
32. `palette-dialog.component.ts` — show light + dark swatch pairs

**Deliverable:** SVG style blocks use palette from config (not hardcoded).
Orgs can supply custom palettes via theme JAR. Dark mode uses correct
color variant.

**Files to modify:**

| File | Change |
|---|---|
| `defaults.css` | Add `variant='light'`/`variant='dark'` to all existing `ChartPalette` selectors; add new `Flat` palette entries |
| `ColorPalettes.java` | Check active theme JAR for `chart-palettes.css` and merge; add `getLightPalette()` / `getDarkPalette()` |
| `CategoricalColorModel.java` | Add `darkColors[]` field alongside existing `colors[]` |
| `VGraphPair.java` | Select light or dark palette variant when generating `<style>` blocks |
| `palette-dialog.component.ts` | Show light + dark swatch pairs per palette row; preview toggles between modes |
| `default-palette.ts` | Add flat design palette colors to color picker swatch grid |

**Design references to load:**

- `Chart_Design_short.md` — color palette class naming convention, dark mode override selector pattern
- `Chart_Design_long.md` — full palette CSS values, theme JAR integration notes
- `bar_flat.svg` — reference `<style>` block showing both light and dark palette color values

---

## 12. Web Component Compatibility

### Question
StyleBI charts can be embedded in external web apps as Web Components
(`<inetsoft-chart>`). Does the redesign interfere with this?

### Investigation

The Web Component is built with Angular Elements (`@angular/elements` +
`createCustomElement`). It uses **the exact same Angular chart
components** as the portal — `chart-area`, `chart-plot-area`,
`chart-legend-area` — controlled by an `embedAssembly: true` flag on
the context provider. There is no separate rendering path.

The Web Component uses **Shadow DOM** via Angular's
`ɵDomSharedStylesHost`. Normally this raises a concern: external
`document.head` styles do not penetrate a shadow root. However, none
of our changes rely on `document.head`.

### Compatibility Assessment

| Change | Where styles / logic live | Shadow DOM issue? |
|---|---|---|
| SVG `<style>` block | Inside the inline `<svg>` — already within the shadow root | None — self-contained |
| `#chart-id.dark .bar-N` selectors | Inside SVG `<style>` block | None — scoped to the element |
| `pointer-events: none` on canvas | Component `styleUrls` SCSS — Angular propagates to shadow root via `ɵDomSharedStylesHost` | None |
| Angular post-injection logic | Angular lifecycle hooks | Identical inside Web Component |
| Dark mode `dark` class | Angular sets directly on `<svg>` element | None — class is on the element, not injected via external CSS |
| Palette CSS class scoping (`#chart-id`) | Inside SVG `<style>` block | Shadow DOM strengthens isolation — prevents collision with host page styles |

Shadow DOM is not an obstacle — it actively helps. Our `#chart-id`
scoping prevents any collision with the host page's own styles, which
is precisely the isolation Web Components are designed to provide.

### Conclusion

**No changes needed for Web Component compatibility.** Every change
made to the portal chart components automatically applies to the
embedded Web Component. The redesign works identically in both modes.

### One Item to Verify

`DomSanitizer.bypassSecurityTrustHtml()` is used to inject inline SVG.
Angular's sanitizer behaviour inside a shadow root is the same as in
the portal — this is an Angular-level operation, not a DOM-level one.
No issue expected, but a smoke test on first integration is recommended.

---

## 13. Non-Inline SVG Tiles — Visual Changes Required

**Flag gate:** all changes in this section — `<style>` injection into
axis tiles, visual Java default changes applied via post-processing,
and inline injection of axis tiles — are gated by
`GraphPaintContext.isFlatDesign()` (backend) and
`FlatDesignService.isFlatDesign()` (frontend). When the flag is off,
axis tiles remain as `<img>` tags, Java defaults are unchanged, and
the current rendering is preserved exactly.

**Decision: inline all tiles.** Legend scroll was verified to be driven
by CSS `overflow-y: auto` on the Angular host `<div>` — no clip paths or
viewBox tricks inside the SVG tiles themselves. Each tile is a
self-contained SVG containing only the content that fits in its bounds.
Inlining is safe for all tiles.

This means **all 14 tiles use the same mechanism**: fetch as text,
inject inline via `DomSanitizer`, Angular propagates the `dark` class
to every `<svg>` element, CSS handles all color changes. No `?dark`
query parameter, no `GraphPaintContext.dark` field, no Angular re-fetch
logic — just one unified dark mode path.

The `chart-image.directive.ts` change from Phase 3 applies to every
tile automatically. No additional Angular work is needed for axis or
facet tiles beyond Phase 3.

### Gap Analysis — Current vs. Flat Design

The following Java defaults must change to match flat design styling.
These affect light mode rendering; dark mode is handled by the `<style>`
block injected by `BatikSVGSupport` (same hook as `plot_area`).

| Element | Current default | Flat design target | Source constant |
|---|---|---|---|
| Axis line color | `#eeeeee` | `#79747E` | `GDefaults.DEFAULT_LINE_COLOR` |
| Axis line weight | 1 px | 1.5 px | `AxisLine.java` (implicit) |
| Grid line color | `#eeeeee` | `#E7E0EC` | `GDefaults.DEFAULT_GRIDLINE_COLOR` |
| Grid lines enabled | Off (`GraphConstants.NONE`) | On — thin line | `AxisSpec.java` default `gridStyle` |
| Tick marks | 4 px major / 2 px minor | None (ticks removed) | `AxisLine.MAJOR_TICK_LENGTH` / `MINOR_TICK_LENGTH` |
| Axis label color | `#4b4b4b` | `#79747E` | `GDefaults.DEFAULT_TEXT_COLOR` |
| Axis label font | `"Default"` family, 10 pt | Inter, 10 px, weight 400 | `GDefaults.DEFAULT_TEXT_FONT` |
| Axis title color | `#2b2b2b` | `#79747E` (inherits label color) | `GDefaults.DEFAULT_TITLE_COLOR` |
| Axis title font | `"Default"` family, 11 pt | Inter, 11 px, weight 500 | `GDefaults.DEFAULT_TITLE_FONT` |

### Exact Java Changes

**`inetsoft/graph/internal/GDefaults.java`**

```java
// Axis/grid line colors
public static final Color DEFAULT_LINE_COLOR     = new Color(0x79, 0x74, 0x7E); // was #eeeeee
public static final Color DEFAULT_GRIDLINE_COLOR = new Color(0xE7, 0xE0, 0xEC); // was #eeeeee

// Label and title colors
public static final Color DEFAULT_TEXT_COLOR  = new Color(0x79, 0x74, 0x7E); // was #4b4b4b
public static final Color DEFAULT_TITLE_COLOR = new Color(0x79, 0x74, 0x7E); // was #2b2b2b

// Fonts (Inter must be registered — see font registration below)
public static final Font DEFAULT_TEXT_FONT  = new Font("Inter", Font.PLAIN, 10); // was "Default", 10pt
public static final Font DEFAULT_TITLE_FONT = new Font("Inter", Font.PLAIN, 11); // was "Default", 11pt
```

**`inetsoft/graph/AxisSpec.java`**

```java
private int gridStyle = GraphConstants.THIN_LINE; // was GraphConstants.NONE
```

**`inetsoft/graph/guide/axis/AxisLine.java`**

```java
public static final int MAJOR_TICK_LENGTH = 0; // was 4
public static final int MINOR_TICK_LENGTH = 0; // was 2
```

If ticks need to remain configurable (e.g. financial charts use them),
gate on `AxisSpec.getTickStyle()` rather than zeroing the constants.

**Font registration — Inter**

Batik must find the Inter font at runtime. Ship `Inter-Regular.ttf` and
`Inter-Medium.ttf` inside the StyleBI distribution JAR (under `fonts/`)
and register them at startup in `SreeEnv` or `GraphFactory`:

```java
GraphicsEnvironment.getLocalGraphicsEnvironment()
    .registerFont(Font.createFont(Font.TRUETYPE_FONT, stream));
```

If Inter is unavailable the `Font` constructor silently falls back to
the system default; catching and retrying with `"Helvetica Neue"` then
`"Arial"` is optional but recommended. Theme JARs can supply a custom
font via the same registration point.

### Dark Mode via Inline `<style>` Block

Because all axis tiles are now inline SVGs, dark mode works exactly the
same way as the plot area: Angular sets the `dark` class on the `<svg>`
element, and the `<style>` block inside the SVG handles all color changes.

`BatikSVGSupport` injects the following into each axis / title / facet
tile's `<style>` block:

```css
/* light mode — matches GDefaults values above */
.bl  { stroke: #79747E; stroke-width: 1.5; }
.gl  { stroke: #E7E0EC; stroke-width: 1; }
.an, .al, .at { fill: #79747E; font-family: Inter, 'Helvetica Neue', Arial, sans-serif; }

/* dark mode */
#tile-{id}.dark .bl  { stroke: #938F99; }
#tile-{id}.dark .gl  { stroke: #49454F; }
#tile-{id}.dark .an,
#tile-{id}.dark .al,
#tile-{id}.dark .at  { fill: #938F99; }
```

The `tile-{id}` is generated the same way as `chart-{id}` for the plot
area. Angular propagates the `dark` class to all inline `<svg>` elements
in one pass — no tile needs special handling.

### Chart-Specific Axis Variations

**Radar** — rings and spokes live inside the plot SVG (already inlined);
they inherit CSS dark-mode automatically via the plot `<style>` block.
No separate axis tile change needed.
- `.rl` (outer ring): `stroke:#C4BECE; stroke-width:0.75`
- `.spk` (spokes): `stroke:#79747E; opacity:0.25`
- Dark: `#chart-id.dark .rl { stroke:#49454F }`

**Gantt** — time-grid lines are drawn inside the plot SVG, not in axis
tiles. Emit as `<line class="gantt-gl">` and style via the plot SVG
`<style>` block: `stroke:#79747E; stroke-width:0.5; opacity:0.2`.

**Facet labels** (`facetTL/TR/BL/BR`) — text only; `GDefaults.java`
font/color changes apply automatically. The `BatikSVGSupport` style
injection covers dark mode with the same `.at` class selector.

### Files to Modify

| File | Change |
|---|---|
| `GDefaults.java` | Update axis/grid line colors, label/title colors and fonts |
| `AxisSpec.java` | Enable grid lines by default (`THIN_LINE`) |
| `AxisLine.java` | Set tick lengths to zero (or gate on `AxisSpec.getTickStyle()`) |
| `BatikSVGSupport.java` | Inject axis/label dark mode CSS into every tile's `<style>` block (same hook already used for plot area) |
| Font resources | Add `Inter-Regular.ttf` / `Inter-Medium.ttf` to distribution JAR; register at startup |

Note: `chart-image.directive.ts` (Phase 3) already handles all tiles —
no additional Angular change needed for axis or facet tiles.

### Design References to Load

- `Chart_Design_long.md` — axis line/grid line/label color specs, dark mode color values
- `bar_flat.svg` — axis line weight, label styling, dark mode overrides in the `<style>` block
- `gantt_flat.svg` — Gantt-specific time-grid line treatment
- `radar_flat.svg` — radar ring and spoke styling

---

## 14. Out of Scope / Deferred

- **Legend print-mode values (`.lgd-val`)** — flat design shows data
  values in the legend in print mode. Not replicated; deferred.
- **Legend↔plot hover coordination** — hovering a bar dims non-matching
  legend items (and vice versa). Not in the flat design spec. The inline
  legend SVG makes this trivial to add later but it is out of scope now.
- **Full tiling rearchitecture** — replacing all 14 tiles with a single
  SVG. Estimated 10–14 weeks of effort. Not needed for the agreed approach.
