# SBI Chart Rendering Strategy: Inline SVG vs ECharts

This document summarises the architectural analysis of replacing SBI's server-side chart
rendering, covering the lookfeel animation update, cross-chart interactions, export/print,
and the recommended hybrid approach.

---

## 1. Current Architecture

SBI uses a custom grammar-of-graphics engine:

```
EGraph (spec) → Plotter → VGraph (layout) → SVGGraphics2D (Apache Batik) → SVG bytes → <img> tag
```

The frontend loads charts as image tiles via HTTP. All chart interactions — brush, zoom,
drill, flyover, sort, and 18 others (21 event types total) — are server round-trips over
WebSocket. `ViewsheetSandbox` is the single source of truth for all chart state and
cross-chart dependency propagation.

---

## 2. The Lookfeel Problem

The lookfeel SVGs (`bar_flat.svg`, `line_flat.svg`, etc.) contain CSS keyframe animations
and JavaScript (`bootstrapChart`, `_chartInit`, gradient generation, hover state
management). **None of this executes when SVG is loaded as `<img>`** — browsers block
JavaScript in `<img>`-embedded SVGs. The entire `chart-shared.js` bootstrap system and
`postMessage` API exists to work around this limitation.

This is the root cause of why the lookfeel update requires significant SBI changes: the
delivery mechanism must change before any animation can run.

---

## 3. Approach 1 — Inline SVG

Move from `<img>`-based chart delivery to inline SVG DOM injection so the lookfeel JS and
CSS animations execute.

### Backend — High effort

The current Batik renderer outputs flat graphics: raw `rect`, `path`, `text` with no
semantic meaning. The lookfeel animations require a semantic structure: `.data-item`,
`.data-body`, `.stagger-N`, `.series-N`, `data-item-cx`, `data-item-top`. The server must
compute chart geometry **and** emit it with this structure. This requires deep changes to
`VGraph`/`GraphElement`/`Plotter` — the rendering engine has no concept of semantic
grouping. This is nearly as invasive as building an ECharts option mapper, with less
payoff.

### Frontend — High effort

- `chart-image.directive.ts` must switch from blob `<img src>` to text fetch + `innerHTML`
  injection
- CSP must be relaxed to allow inline SVG scripts (`script-src 'unsafe-inline'` or nonce)
- **Canvas overlay conflict**: SBI's hover, selection, drill-down, and flyover run on a
  canvas layer over the chart image. The lookfeel SVG has its own `mouseenter`/`mouseleave`
  JS. These two systems conflict and must be reconciled or one retired.
- `postMessage` on `window` means all inline charts on a page share the same listener —
  needs verification for multi-chart dashboards

### Animation fidelity — Full design control

Designers own the exact output. The lookfeel repo becomes the deployment artifact. Two
teams (lookfeel + SBI) must stay in sync on the semantic class contract.

### Export

Zero impact. Batik/VGraph export pipeline is completely unchanged. The lookfeel SVG is
screen-only. Optionally, if the server generates semantic SVGs, those could be fed back
into Batik's `SVGTranscoder` for export, giving closer visual consistency between screen
and PDF.

---

## 4. Approach 2 — ECharts

Add client-side ECharts rendering for the browser. Keep server-side Batik for export
(updated to match new visual style).

### Backend — Moderate effort

New JSON endpoint replacing the image endpoint. `ChartInfo + VSDataSet` → ECharts `option`
object mapper, one per chart type. `VGraph`/`GraphElement`/`Plotter`/Batik are untouched.
The data pipeline (`ViewsheetSandbox`, `VSDataSet`) is unchanged.

### Frontend — Moderate effort

- Replace `<img>`-based chart loading with an Angular ECharts component (`ngx-echarts` or
  manual wrapper)
- Map ECharts events (`brushEnd`, `click`, `mouseover`) to the existing 21 WebSocket event
  types
- Canvas overlay for interactions can be retired — ECharts has its own event system
- No CSP changes needed

### Animation fidelity — Approximate

ECharts built-in animation covers the design intent. Specific lookfeel visual effects
(stroke-dasharray line draw, dot pop, gradient generation) cannot be replicated exactly —
ECharts uses different animation mechanisms. Lookfeel SVGs become design reference, not
deployed artifacts. Animation style is re-expressed in ECharts theme configuration (see
Section 6).

### Export

Breaks three format exporters (`PDFVSExporter.writeChart()`,
`PoiExcelVSExporter.getChartImage()`, `PPTVSExporter.getChartImage()`). All call
`vgraph.paintGraph(g2, false)` which requires a server-side `VGraphPair`. Resolution
options:

1. **Client `chart.getDataURL()`** → POST to server before export. ECharts built-in, but
   requires all charts rendered and visible; complex coordination for off-screen charts.
2. **Headless browser** (Playwright/Puppeteer) server-side — new infrastructure, slow.
3. **Node.js ECharts SSR sidecar** (`@echarts/server-side`) — new infrastructure.

---

## 5. Cross-Chart Interactions

### How SBI interaction works

All 21 chart interaction types are server round-trips. When a user brushes chart A:

1. `VSChartBrushEvent` → WebSocket → `/events/vschart/brush`
2. Server stores selection in `ChartVSAssembly`
3. `ViewsheetSandbox.processChange()` re-executes all dependent charts
4. Server re-queries data for dependent charts with the new filter applied
5. Updated chart data pushed back to all affected clients

This is not visual highlighting — it is actual server-side data re-filtering. Brushing
chart A changes what data chart B **queries**.

### ECharts and cross-chart interactions

ECharts has `echarts.connect(groupId)` and `brushLink: 'all'` for client-side visual
synchronisation (tooltip following, zoom levels). These are a bonus but are not what
provides SBI's cross-chart filtering. The server-side `ViewsheetSandbox` propagation model
must stay intact for both approaches.

For ECharts, the flow becomes:

```
ECharts brush event
  → translate selection to SBI format
  → fire existing WebSocket VSChartBrushEvent  (unchanged)
  → server processes (unchanged)
  → server sends updated data back
  → update ECharts instance with new option/data
```

**Key challenge**: ECharts brush events return data indices or coordinate ranges. SBI
expects an encoded selection string: `name^VALUE:value^INDEX:rowIndex^AND^name2^VALUE:value2`.
`ChartVSSelectionUtil` (630 lines) shows this is non-trivial, with special cases per chart
type (boxplot, treemap, sunburst, cube, scatter). This is a well-scoped translation
problem, not an architectural blocker.

**Bonus from ECharts**: `echarts.connect()` provides free lightweight visual
synchronisation (tooltip following, zoom sync) that SBI currently handles with expensive
server round-trips or does not support at all.

For inline SVG, the same WebSocket events must be fired from SVG JS, with the same
selection format produced from DOM region detection. No built-in cross-chart coordination
benefit.

---

## 6. Animation: ECharts Mapping to Lookfeel Spec

The lookfeel spec (`Chart_Design_short.md`) defines two key interaction behaviours.

### 6.1 Onload Animation (Section 3 of spec)

The spec defines three methods (A2, A1, rAF) because **CSS animation fill-mode and CSS
hover rules conflict in SVG**. That distinction is the entire reason for the complexity.
ECharts uses its own render pipeline and this conflict does not exist — all three methods
collapse into one.

**Spec adaptive stagger formula:**
```js
var stagger = Math.min(0.25, 1.0 / count);   // 0.25s max, scales down for dense charts
var lastDelay = (count - 1) * stagger;
```

**ECharts direct equivalent:**
```js
animationDuration: 800,           // spec: 0.8s fixed
animationEasing:   'cubicOut',    // spec: ease-out fixed
animationDelay: function(idx) {
  return idx * Math.min(250, 1000 / data.length);  // spec formula, verbatim
}
```

| Spec requirement | ECharts property | Match |
|---|---|---|
| Duration `0.8s` fixed | `animationDuration: 800` | Exact |
| Stagger `min(0.25, 1.0/count)` | `animationDelay` function | Exact |
| Easing `ease-out` | `animationEasing: 'cubicOut'` | Near-exact |
| Geometry + opacity (donut/sunburst) | `animationType: 'expansion'` on pie series | Same kinetic feel |

The A1-specific complexity — `animationend` listener, `.visible` class, `.ready` gate to
prevent hover firing during animation — is entirely eliminated. ECharts gates its own hover
state until after animation completes internally.

### 6.2 Per-Chart-Type Onload Animation

All charts use the same base config (`animationDuration: 800`, `animationEasing: 'cubicOut'`,
adaptive `animationDelay` function). The column below notes what ECharts animates and any
deviation from that base.

Charts marked **custom series** do not have a native ECharts type and require a custom
series implementation; the animation config still applies.

| Chart | Spec method | ECharts series | What ECharts animates | Notes |
|---|---|---|---|---|
| Bar | A2 | `bar` | Bars grow up from x-axis with stagger | Growth animation is more dynamic than spec's opacity-only fade; same sequential reveal intent |
| Stacked bar | A2 | `bar` + `stack` | Segments grow within each bar; series stagger via `animationDelay` on each series | |
| Area | — | `line` + `areaStyle` | Area fills in from left; line draws progressively | Same path-clip mechanism as Line |
| Stacked area | A1 | `line` + `stack` + `areaStyle` | Each layer fills in with per-series delay | `animationDelay` offset between series |
| Line | A1 | `line` | Path clips from left to right — progressive draw | More dynamic than spec's opacity fade; same "data building up" intent |
| Line stacked | A1 | `line` + `stack` | Same path-clip per layer with series stagger | |
| Step line | — | `line` + `step: 'end'` | Same path-clip as line | `step` changes shape, not animation |
| Step area | — | `line` + `step` + `areaStyle` | Same as step line with fill | |
| Jump line | — | `line` + `step: 'middle'` or custom | Path-clip with step shape | May need custom series for true jump-line gaps |
| Bubble | — | `scatter` | Each bubble scales from 0 (pop-in) with stagger | `symbolSize` encodes bubble area; `animationDelay` per point |
| Candle | A2 | `candlestick` | Candle bodies grow from midpoint with stagger | `animationDelay` per candle |
| Pareto | A2 | `bar` + `line` | Bars stagger first; cumulative line draws after last bar completes | Line `animationDelay` base = `(count-1) * stagger + 800` |
| Waterfall | — | `bar` (invisible base + visible bar) | Bars grow from their base value with stagger | Standard waterfall trick; `animationDelay` function |
| Pie / Donut | rAF | `pie` | Sectors sweep from start angle; combined rotation + scale from centre | `animationType: 'expansion'`; donut via `radius: ['40%','70%']` |
| Sunburst | rAF | `sunburst` | Rings expand outward level by level from centre | Built-in radial expansion; depth-based stagger is automatic |
| Treemap | A1 | `treemap` | Tiles expand from parent bounds outward | Built-in; drill-down animation also included |
| Icicle | A1 | `treemap` (modified) or custom series | Tiles expand column by column | ECharts treemap can approximate icicle layout; full fidelity needs custom series |
| Marimekko | A1 | Custom series | Columns grow from axis with variable-width stagger | No native ECharts type; custom series with `animationDelay` |
| Circle packing | A1 | Custom series | Circles scale from 0 with depth-based stagger | No native ECharts type; custom series with `animationDelay` |
| Radar | — | `radar` | Polygon vertices extend outward from centre simultaneously | `animationDuration` + `animationEasing`; no per-vertex stagger in native type |
| Boxplot | — | `boxplot` | Box and whiskers extend from median outward with stagger | `animationDelay` per box |
| Funnel | — | `funnel` | Segments expand from narrow end with stagger | `animationDelay` per segment; `sort: 'descending'` |
| Tree | — | `tree` | Nodes expand from root outward, level by level | Built-in level-by-level expansion; `animationDuration` per level |
| Network | — | `graph` + `layout: 'force'` | Nodes fade in and settle via force simulation | Force simulation provides organic entry; `animationDelay` per node |
| Circular network | — | `graph` + `layout: 'circular'` | Nodes place on circle with stagger; edges draw after | `animationDelay` per node |
| Gantt | — | Custom series (`bar` base) | Task bars grow from start date with row stagger | No native ECharts type; custom series with `animationDelay` |

### 6.3 Hover Dimming (Section 4 of spec)

**Spec**: add `.hovering` to container → dim all non-active elements to `opacity: 0.20`,
transition `0.2s ease`. Gate on `.ready`. Clear stale `.active` classes on fast cursor
movement. Different `mouseleave` placement for adjacent vs. gapped hit targets.

**ECharts `emphasis`/`blur` system:**
```js
emphasis: {
  focus: 'series',
  blurScope: 'coordinateSystem'
},
blur: {
  itemStyle: { opacity: 0.2 }    // spec: 0.20 exact
}
```

| Spec concern | ECharts handling |
|---|---|
| Dim to `0.20` | `blur.itemStyle.opacity: 0.2` — exact |
| `0.2s ease` transition | ECharts animates blur transitions internally |
| Stale `.active` on fast cursor | ECharts owns its hover state machine — no stale state |
| `.ready` gate during animation | ECharts defers hover activation until animation completes |
| Adjacent target `mouseleave` placement (donut, treemap) | Canvas hit testing handles overlapping targets — no `mouseleave` placement concern |

### 6.4 Tooltip (Section 5 of spec)

The spec's 3-part SVG construction (`.tip-bg` rect, `.tip-border` path with tail gap,
`.tip-tail` path) and `getBBox()` measurement exist because SVG has no z-index and the
tooltip must always be in the last painted layer. ECharts renders tooltips in the HTML
layer above the chart, so all of this is unnecessary.

```js
tooltip: {
  trigger: 'item',
  confine: true,    // clamps within container — spec requirement
  formatter: (params) => `<b>${params.name}</b><br/>${params.value}`
}
```

| Spec requirement | ECharts handling |
|---|---|
| Always last painted layer | HTML layer, always above canvas — by definition |
| Clamp horizontally within card | `confine: true` |
| Flip vertically near top | Automatic position detection |
| Measure with `getBBox()` after text | HTML layout engine measures automatically |
| 3-part tip-bg/tip-border/tip-tail construction | CSS `border-radius` + CSS triangle — SVG workaround eliminated |

### 6.5 Summary

The lookfeel spec's animation complexity — the A1/A2/rAF distinction, the `.ready` gate,
stale-class clearing, 3-part tooltip construction, `mouseleave` placement table — is almost
entirely SVG-in-browser workarounds. ECharts' render model eliminates the constraints that
made those workarounds necessary. The **design intent** maps cleanly to ECharts
configuration. The **implementation complexity** largely does not carry over.

---

## 7. Export / Print Pipeline

### Current pipeline

Export is entirely server-side and uses the same VGraph/Batik rendering pipeline as screen
display:

```
Export request
  → AbstractVSExporter.writeChart()
  → box.getVGraphPair(name, true, ...)
  → vgraph.paintGraph(g2, false)        ← same call as screen render
  → BufferedImage at 2x scale
  → embedded in PDF / Excel / PPT
```

Charts are always exported as embedded images, never as native Excel charts or PPT shapes
— a deliberate choice for fidelity. Tables, gauges, and other elements are rendered by
format-specific helpers independently.

### Export and the lookfeel update

Export needs the **visual style update only** — new colour palette, rounded corners,
typography, spacing. It does not need animations or interactivity. These are targeted
visual property changes to the existing Java rendering code, not the JS animation
structure. The export pipeline is architecturally unchanged.

---

## 8. Recommended: Hybrid Architecture

The discussion converged on a two-track approach that resolves the export problem and
minimises architectural risk.

### Track 1 — Update Batik/VGraph for lookfeel (serves export)

Update the existing renderer with the new visual style: colour palette, rounded bar
corners, typography, spacing. This is targeted visual property changes to existing Java
code. The export pipeline is architecturally unchanged. PDF/Excel/PPT receive the updated
look — static and animation-free, which is appropriate for print.

### Track 2 — Add ECharts for browser (serves interactive use)

Independent parallel track. New JSON endpoint + `ChartInfo`→ECharts option mapper +
Angular ECharts component. ECharts handles animations, hover, zoom, and brush in the
browser, wired to the existing WebSocket event pipeline for cross-chart interactions.

```
ViewsheetSandbox  (unchanged)
  ├── Export:  VGraphPair → Batik (updated visuals) → PDF / Excel / PPT
  └── Browser: ChartInfo + VSDataSet → JSON → ECharts → browser
```

### Why this split works

The two tracks serve genuinely different purposes — static fidelity for export vs.
interactive animation for browser. They share the same data pipeline but diverge at the
renderer. Batik becomes maintenance-stable (style updates only, no new features). ECharts
is where new interactive capability lands.

Visual consistency between screen and export is approximate but acceptable — same palette,
similar style, no animations in PDF (expected by users).

---

## 9. Full Comparison

| Concern | Inline SVG | ECharts | Hybrid |
|---|---|---|---|
| Backend rendering changes | Deep — VGraph semantic output restructuring | Moderate — JSON endpoint + option mapper | Moderate (ECharts) + Minimal (Batik style update) |
| Frontend changes | High — inline injection, CSP, canvas conflict | Moderate — new component, event wiring | Moderate |
| Onload animation | Exact per spec (CSS keyframes, stagger) | Near-exact via `animationDelay` function | Near-exact (browser); none (export — correct) |
| Hover dimming to 0.20 | Exact per spec (`.hovering` + CSS) | Exact via `blur.itemStyle.opacity: 0.2` | Exact (browser) |
| Tooltip system | Full 3-part SVG construction required | HTML layer — 3-part construction eliminated | Simplified (browser) |
| A1/A2/rAF animation methods | All three required | Collapse to one ECharts config | One config |
| `.ready` gate complexity | Required (A1, rAF charts) | Eliminated — ECharts handles internally | Eliminated |
| Lookfeel animation fidelity | Exact — designers own output | Near-exact — design intent preserved | Near-exact (browser) |
| Lookfeel repo role | Deployment artifact | Design reference only | Screen: design ref; Export: drives Batik style update |
| Cross-chart brush/filter | WebSocket events unchanged; DOM → selection format | WebSocket events unchanged; ECharts → selection format | Same as ECharts track |
| Cross-chart visual sync bonus | None | `echarts.connect()` — tooltip/zoom sync free | Yes |
| Export pipeline | Unchanged | Breaks 3 format exporters; needs new solution | Unchanged |
| New infrastructure required | No | Possibly (for export) | No |
| CSP changes | Yes — inline script relaxation needed | No | No |
| Canvas overlay conflict | Yes — must reconcile | No — can retire cleanly | No |
| Per-chart-type coordination | Two teams (lookfeel SVG + SBI semantic output) | One team (option mapper) | One team |
| Built-in zoom/brush/tooltip | No | Yes | Yes (browser) |
| Ongoing maintenance | SVG templates + SBI semantic structure in sync | Option mapper per chart type | Two renderers, single data pipeline |
