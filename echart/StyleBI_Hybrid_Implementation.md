# StyleBI Chart Redesign — Hybrid Implementation Document

## Overview

This document describes the hybrid approach for applying the flat design system to
StyleBI's chart rendering engine. It covers all architectural decisions, concerns raised
during investigation, and their resolutions.

**Hybrid definition:** Three rendering tracks sharing one data pipeline.

| Track | Renderer | Purpose | Chart scope |
|---|---|---|---|
| Track 1 (charts) | ECharts SSR via Node.js sidecar | Export — PDF, Excel, PowerPoint | Standard charts (25 types); map charts (Phase 8) |
| Track 1 (non-chart) | Batik / VGraph | Export — non-chart elements | Contour, Faceted, Gauges, Tables, Crosstabs |
| Track 2 | ECharts (new) | Browser — interactive, animated | Standard + geo/map charts |
| Track 3 | Batik SVG → `<img>` (unchanged) | Browser — contour and faceted charts stay server-rendered | Scatter Contour, Map Contour, Faceted (small multiples) |

All tracks share `ViewsheetSandbox` → `ChartInfo + VSDataSet` as a common data source.
`EChartsOptionBuilder` is the single option mapper — it feeds both the browser (Track 2)
and the Node.js sidecar (Track 1), so visual changes are made once and appear everywhere.

---

## 1. Core Architecture Decision

### Question

Can the flat design's interactive features (on-load animation, hover dimming, hover
tooltips, dark mode) be achieved in the browser while keeping server-side rendering
intact for export?

### Investigation

StyleBI renders charts server-side via Batik/VGraph → `SVGGraphics2D` → SVG image.
The export pipeline (`PDFVSExporter`, `PoiExcelVSExporter`, `PPTVSExporter`) calls
`vgraph.paintGraph(g2, false)` directly — the same rendering path as screen display.
All chart interactions are server round-trips via WebSocket through `ViewsheetSandbox`.

The lookfeel SVGs require JavaScript execution and CSS animations that are blocked in
`<img>`-loaded SVG. Moving to inline SVG requires deep changes to Batik's flat output
format to add semantic structure. Moving entirely to ECharts breaks the export pipeline.

### Decision

**Two-track hybrid.** Export retains Batik, updated only for visual style. Browser
rendering moves to ECharts, which handles animation, hover, and interactivity natively.
The export pipeline is architecturally unchanged. All cross-chart interaction events
continue through the existing WebSocket pipeline.

When the design version flag is off (§ Phase 0), the system falls back to the existing
`<img>` / Batik path identically to today.

---

## 2. What Lives Where

### Data Pipeline

```
ViewsheetSandbox
  └── ChartInfo + VSDataSet        ← single source of truth (unchanged)
        ├── Track 1 (standard charts): EChartsOptionBuilder → SsrRenderClient
        │                               → POST /render → Node.js sidecar
        │                               → renderToSVGString() → SVG string
        │                               → Batik SVGTranscoder → PDF / Excel / PPT
        ├── Track 1 (non-chart):     VGraphPair → Batik → PDF / Excel / PPT
        └── Track 2:                 JSON endpoint → ECharts option → browser canvas
```

### Rendering Ownership After Redesign

| Element | Track 1 (export) | Track 2 (ECharts / browser) | Track 3 (Batik `<img>` / browser) |
|---|---|---|---|
| Bar / line / point geometry | ECharts SSR (Node.js sidecar) | ECharts series | — |
| Map polygon / point | ECharts SSR — Phase 8 | ECharts `map` + `geo` (GeoJSON) | Fallback if web tile background |
| Contour (scatter + map) | VGraph `DensityFormVO` (unchanged) | — not used — | `DensityFormVO` → SVG `<img>` (unchanged) |
| Faceted charts | VGraph (unchanged) | — not used — | Batik `<img>` (unchanged) |
| Gauges, Tables, Crosstabs | VGraph → Batik (unchanged) | — not charts — | — |
| Axis tick labels | ECharts SSR (via option) | ECharts `xAxis` / `yAxis` | Batik (unchanged) |
| Legend | ECharts SSR (via option) | ECharts `legend` component | Batik (unchanged) |
| On-load animation | None (correct for print/export) | ECharts `animationDelay` function | None |
| Hover dimming | None | ECharts `emphasis` / `blur` system | None |
| Tooltip bubble | None | ECharts `tooltip` component | None |
| Dark mode | N/A (export is always light) | ECharts theme swap | N/A |
| Color palette | `EChartsOptionBuilder` → option.color[] → SSR | ECharts `color` array in theme | Batik palette (unchanged) |
| Cross-chart brush | VGraphPair brush selection (unchanged) | ECharts → WebSocket → server | Batik canvas → WebSocket (unchanged) |
| Cross-chart filter propagation | `ViewsheetSandbox.processChange()` (unchanged) | Unchanged — server-side | Unchanged — server-side |

---

## 3. Track 1 — Export Rendering

### Decision: ECharts SSR via Node.js Sidecar

Export chart rendering uses ECharts SSR (v5.3+ `renderToSVGString()`) via a Node.js
sidecar process. The same `EChartsOptionBuilder` that generates option JSON for the browser
also feeds the sidecar — one mapper, two consumers.

This eliminates the need to separately update Batik chart rendering for every visual style
change. Colors, typography, animation configuration, and layout all flow through the option
object and render identically in browser and export.

### 3.1 ECharts SSR — SVG Mode

ECharts 5.3+ provides a zero-dependency SSR entry point:

```javascript
const { renderToSVGString } = require('echarts/ssr');
const svg = renderToSVGString(option, { width, height, theme });
// svg is a complete <svg>…</svg> string, ready for Batik SVGTranscoder
```

SVG mode is preferred over canvas mode (which requires native `node-canvas` C++ bindings).
The SVG string feeds Batik's existing `SVGTranscoder` at the same integration point as
before — no PDF/Excel/PPT pipeline changes needed.

### 3.2 Node.js Sidecar

SBI's built-in JS engine (Apache Rhino 1.7.14) cannot run ECharts — see §3.6 for
details. The sidecar is a separate Node.js process launched at SBI startup.

**Sidecar design:**

```
SBI JVM                                   Node.js Sidecar
─────────────────────────────────────     ──────────────────────────────────
AbstractVSExporter
  └─ ChartVSAssemblyInfo
       └─ EChartsOptionBuilder ──POST /render──▶  render-server.js
            (same JSON as browser)                      │
                                           renderToSVGString(option)
                                                        │
       ◀──── { svg: "<svg>…</svg>" } ──────────────────┘
  │
  └─ Batik SVGTranscoder.transcode(svgReader, g2)
       └─ embedded in PDF / Excel / PPT
```

**HTTP contract:**

```
POST http://localhost:7734/render
Content-Type: application/json

{
  "option": { /* ECharts option object */ },
  "width": 800,
  "height": 500,
  "theme": "flatLight"   // or "print"
}

Response 200: { "svg": "<svg xmlns=\"http://www.w3.org/2000/svg\" …>…</svg>" }
Response 400/500: { "error": "message" }
```

**`render-server.js`:**

```javascript
'use strict';
const http = require('http');
const echarts = require('echarts');
const { renderToSVGString } = require('echarts/ssr');

echarts.registerTheme('flatLight', require('./themes/flat-light.json'));
echarts.registerTheme('print',     require('./themes/flat-print.json'));

const server = http.createServer(function(req, res) {
  if (req.method !== 'POST' || req.url !== '/render') {
    res.writeHead(404); res.end(); return;
  }
  var body = '';
  req.on('data', function(chunk) { body += chunk; });
  req.on('end', function() {
    try {
      var payload = JSON.parse(body);
      var svg = renderToSVGString(payload.option, {
        width:  payload.width  || 800,
        height: payload.height || 500,
        theme:  payload.theme  || 'flatLight'
      });
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ svg: svg }));
    } catch (err) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: err.message }));
    }
  });
});

server.listen(7734, '127.0.0.1', function() {
  process.stdout.write('ready\n');  // signal to JVM that sidecar is up
});
```

**`SsrRenderClient.java`:**

```java
public class SsrRenderClient {
    private static final String SSR_URL = "http://localhost:7734/render";

    public String renderToSvg(JsonObject option, int width, int height,
                               boolean print) throws IOException {
        String theme = print ? "print" : "flatLight";
        JsonObject payload = new JsonObject();
        payload.add("option", option);
        payload.addProperty("width", width);
        payload.addProperty("height", height);
        payload.addProperty("theme", theme);

        HttpURLConnection conn = (HttpURLConnection)
            new URL(SSR_URL).openConnection();
        conn.setRequestMethod("POST");
        conn.setRequestProperty("Content-Type", "application/json");
        conn.setDoOutput(true);
        conn.setConnectTimeout(2000);
        conn.setReadTimeout(10000);

        try (OutputStream out = conn.getOutputStream()) {
            out.write(payload.toString().getBytes(StandardCharsets.UTF_8));
        }
        if (conn.getResponseCode() != 200) {
            throw new IOException("SSR sidecar error: HTTP " + conn.getResponseCode());
        }
        try (InputStream in = conn.getInputStream()) {
            return JsonParser.parseReader(
                new InputStreamReader(in, StandardCharsets.UTF_8))
                .getAsJsonObject().get("svg").getAsString();
        }
    }
}
```

**Integration in `AbstractVSExporter`:**

```java
private void exportChart(ChartVSAssemblyInfo info, Graphics2D g2,
                          Rectangle2D bounds) {
    if (featureFlag.isEnabled("echart-ssr-export") && isFlatDesignChart(info)) {
        JsonObject option = echartsOptionBuilder.build(info);
        String svgStr = ssrClient.renderToSvg(
            option, (int) bounds.getWidth(), (int) bounds.getHeight(), isPrint);
        SVGTranscoder transcoder = new SVGTranscoder();
        transcoder.transcode(new TranscoderInput(new StringReader(svgStr)), g2, bounds);
    } else {
        vgraphPair.paintGraph(g2);  // existing path — contour, faceted, gauges, etc.
    }
}
```

**Sidecar lifecycle** — managed by a `SsrSidecarManager` service:

```
SBI startup  → ProcessBuilder("node", "render-server.js")
               wait for "ready\n" on stdout (max 10s)
SBI shutdown → process.destroy()
Health check → GET /health (500ms timeout) before each export batch;
               restart sidecar if unreachable
```

### 3.3 One Mapper, Two Consumers

`EChartsOptionBuilder` is the single source of chart configuration for both tracks:

```
EChartsOptionBuilder.build(ChartVSAssemblyInfo)
          │
          ├── /getChartOption/{...}  ◀── Angular browser component (Track 2)
          │
          └── SsrRenderClient.renderToSvg()  ◀── Export pipeline (Track 1)
```

Visual changes — palette, typography, corner radius, grid lines — are made once in the
option builder and automatically propagate to both browser rendering and exported documents.

### 3.4 What Remains on Batik

| Element | Why Batik Stays |
|---|---|
| Contour charts | KDE + MarchingSquares → GeneralPath; no ECharts equivalent |
| Faceted charts (small multiples) | Grammar-of-graphics trellis; N panels data-driven; no native ECharts concept |
| Gauges (Speedometer) | SBI's custom polar gauge; not standard ECharts gauge |
| Crosstab / table cells | VGraph text-flow and cell merging; not a chart |
| PDF page layout / pagination | Apache FOP + Batik document assembly |
| Non-chart images (logos, screenshots) | Not chart data |

Batik's chart scope reduces from ~25 types to the items above.

> **Permanent vs. deferred:** Contour and faceted are permanently on Batik — no ECharts
> equivalent exists. Map charts are deferred ECharts work (Phase 8) and should not be
> grouped with contour/faceted as a permanent exception.

### 3.5 Batik Style Updates for Non-ECharts Elements

The elements remaining on Batik (tables, gauges, contour, faceted) still need flat design
visual updates. These are applied via the existing Batik/VGraph style layer, gated on
`GraphPaintContext.isFlatDesign()`.

**Palette:** Add `Flat` palette to `defaults.css` with `variant='light'`/`variant='dark'`
selectors. Backward compatible — existing palettes without `variant` treated as light mode.

```css
ChartPalette[name='Flat'][variant='light'][index='1'] { color: #00D4E8; }
ChartPalette[name='Flat'][variant='dark'][index='1']  { color: #22D3EE; }
```

**Typography:** Update `GDefaults` font family to Inter / Helvetica Neue / Arial to match
flat design. Applied gated on `isFlatDesign()`.

**Grid lines and axis styling:** Lighter grid line color and reduced tick density in
`AxisSpec`, applied in `VGraphPair` post-processing.

**Files to Modify (Batik non-chart elements):**

| File | Change |
|---|---|
| `defaults.css` | Add `Flat` palette with `variant='light'`/`variant='dark'` selectors |
| `ColorPalettes.java` | `getLightPalette(name)` / `getDarkPalette(name)`; check theme JAR |
| `CategoricalColorModel.java` | Add `darkColors[]` field alongside `colors[]` |
| `GDefaults.java` | Update default font family to Inter / Helvetica Neue / Arial |
| `AxisSpec.java` | Grid line color and weight for flat design |
| `VGraphPair.java` | Apply flat design axis styling gated on `isFlatDesign()` |

### 3.6 Why Rhino Cannot Host ECharts SSR

SBI uses Apache Rhino 1.7.14 as its embedded JS engine. ECharts 5.x is an ES2020+ bundle
that cannot run under Rhino due to fundamental language-level incompatibilities:

| Feature required by ECharts 5.x | Rhino 1.7.14 |
|---|---|
| Arrow functions `() =>` | No |
| Classes `class Foo {}` | No |
| `let` / `const` | Partial only |
| `Promise` / `async` | No |
| `Symbol`, `Map`, `Set` | No |
| CommonJS `require()` | No |
| DOM APIs (`document.createElement`) | No |

ECharts would fail to parse at the first arrow function (~line 200 of the bundle).
Rhino is scoped for short user-authored scripts and is not a general-purpose runtime.
The Node.js sidecar is necessary.

### 3.7 GraalVM — Future In-Process Path

GraalVM JavaScript (ES2022+, runs inside the JVM) could eventually replace the Node.js
sidecar:

```java
// Conceptual — requires GraalVM polyglot dependency
Context jsCtx = Context.newBuilder("js")
    .allowHostAccess(HostAccess.NONE).allowIO(IOAccess.NONE).build();
jsCtx.eval("js", echartsBundle);
String svg = jsCtx.eval("js",
    "renderToSVGString(" + optionJson + ", {width:" + w + ",height:" + h + "})")
    .asString();
```

This is a **separate major project**, not a prerequisite: migrating from Rhino requires
touching 54 scriptable APIs, rebuilding the security sandbox, and a full QA regression.
The Node.js sidecar is the correct path today; GraalVM is the future upgrade that
decommissions the sidecar.

### 3.8 SSR Risks

| Risk | Severity | Mitigation |
|---|---|---|
| Sidecar crash during export batch | Medium | Health check before batch; restart on failure; fallback to Batik via feature flag |
| `renderToSVGString` does not support all option features | Medium | Test all 25 chart types; file ECharts issues for gaps |
| SVG output rejected by Batik SVGTranscoder | Low | Verify in Phase 1b; SVG mode output is standards-conformant |
| Sidecar startup adds latency to SBI startup | Low | Start async; mark export unavailable until ready |
| Node.js version management in deployment | Low | Pin LTS; document in deployment guide |

---

## 4. Track 2 — ECharts Browser Rendering

### Backend JSON Endpoint

A new endpoint replaces the image endpoint for browser rendering:

```
GET /getChartOption/{vid}/{aid}/{width}/{height}
```

Returns a JSON body containing two keys:

```json
{
  "option":  { /* ECharts option object */ },
  "meta":    { /* SBI-specific metadata for event wiring */ }
}
```

`meta` carries the field-name-to-series-index mapping needed by the WebSocket event
translator (§ 6).

The image endpoint (`/getAssemblyImage/...`) is retained unchanged — it continues to
serve the `<img>` fallback path and export.

### ChartInfo → ECharts Option Mapper

A new `EChartsOptionBuilder` class in the Java backend reads `ChartInfo` and `VSDataSet`
and produces the ECharts `option` JSON. One builder method per chart type, all
sharing common helpers for theme, axes, legend, and tooltip config.

**Shared option base (all chart types):**

```java
// Common base applied to every chart
option.put("backgroundColor", "transparent");
option.put("animation", true);
option.put("animationDuration", 800);
option.put("animationEasing", "cubicOut");
// animationDelay injected per series (see §5)

option.put("tooltip", buildTooltip());       // confine:true, HTML formatter
option.put("legend", buildLegend(chartInfo));
option.put("color",  buildColorArray(palette, isDark));
```

### ECharts `animationDelay` Pattern (All Cartesian Charts)

The adaptive stagger from `Chart_Design_short.md` maps directly to ECharts' per-item
delay function:

```java
// Java — serialised as a JS function literal in the JSON response
// Special marker triggers Angular to deserialize as Function, not string
"animationDelay": "function(idx){return idx*Math.min(250,1000/" + count + ");}"
```

Angular deserializes this string as a live Function before passing to ECharts:

```typescript
if (typeof opt.series[i].animationDelay === 'string') {
  opt.series[i].animationDelay = new Function('idx', 
    'return (' + opt.series[i].animationDelay + ')(idx)');
}
```

This is the only special deserialization step. Everything else in the option object is
plain JSON.

---

## 5. Per-Chart-Type Animation Config

All charts use `animationDuration: 800`, `animationEasing: 'cubicOut'`, and the adaptive
`animationDelay` function. The table below documents what ECharts animates per type and
any additional config beyond the shared base.

Charts marked **custom series** require a custom ECharts series implementation. The
animation config still applies identically.

| Chart | Spec method | ECharts series | Animation behavior | Additional config |
|---|---|---|---|---|
| Bar | A2 | `bar` | Bars grow from x-axis with per-bar stagger | `animationDelay` per item |
| Stacked bar | A2 | `bar` + `stack` | Segments grow within each bar; per-series stagger | `animationDelay` per series |
| Waterfall | — | `bar` (invisible base) | Bars grow from their base value with stagger | `animationDelay` per item |
| Candle | A2 | `candlestick` | Bodies grow from midpoint with stagger | `animationDelay` per item |
| Pareto | A2 | `bar` + `line` | Bars stagger first; cumulative line draws after last bar | Line delay = `(count-1)*stagger + 800` |
| Line | A1 | `line` | Path clips left to right — progressive draw | `animationDelay` per series |
| Stacked line | A1 | `line` + `stack` | Per-layer path clip with series stagger | `animationDelay` per series |
| Step line | — | `line` + `step:'end'` | Path clip same as line; step shape | `animationDelay` per series |
| Jump line | — | `line` + `step:'middle'` | Path clip with step shape | May need custom series for gaps |
| Area | — | `line` + `areaStyle` | Area fills in from left with path clip | `animationDelay` per series |
| Stacked area | A1 | `line` + `stack` + `areaStyle` | Each area layer with series stagger | `animationDelay` per series |
| Step area | — | `line` + `step` + `areaStyle` | Step shape + area fill | `animationDelay` per series |
| Bubble | — | `scatter` | Each bubble scales from 0 (pop-in) with stagger | `animationDelay` per point |
| Pie / Donut | rAF | `pie` | Sectors sweep with combined rotation + scale from centre | `animationType:'expansion'`; donut via `radius:['40%','70%']` |
| Sunburst | rAF | `sunburst` | Rings expand outward level by level | Built-in radial expansion |
| Treemap | A1 | `treemap` | Tiles expand from parent bounds outward | Built-in; drill-down animation included |
| Icicle | A1 | `treemap` (custom layout) | Columns expand top-down | Custom series required for full fidelity |
| Marimekko | A1 | Custom series | Variable-width columns grow from axis | Custom series; `animationDelay` per item |
| Circle packing | A1 | Custom series | Circles scale from 0 with depth-based stagger | Custom series; `animationDelay` per item |
| Radar | — | `radar` | Polygon vertices extend outward simultaneously | `animationDuration`, `animationEasing` |
| Boxplot | — | `boxplot` | Boxes extend from median with stagger | `animationDelay` per item |
| Funnel | — | `funnel` | Segments expand from narrow end with stagger | `animationDelay` per segment |
| Tree | — | `tree` | Nodes expand from root outward level by level | Built-in level expansion |
| Network | — | `graph` + `layout:'force'` | Nodes fade in and settle via force simulation | `animationDelay` per node |
| Circular network | — | `graph` + `layout:'circular'` | Nodes place on circle with stagger; edges draw after | `animationDelay` per node |
| Gantt | — | Custom series (`bar` base) | Task bars grow from start date with row stagger | Custom series; `animationDelay` per item |

---

## 6. Hover Dimming and Tooltip

### Question

StyleBI has its own hover system (data tip, flyover, built-in tooltip) triggered from
canvas mouse events. ECharts has its own emphasis/blur system. Do they conflict?

### Investigation

StyleBI hover is driven from `chart-plot-area.component.ts` via mouse events on the host
`<div>`, routing through a region tree spatial index. The canvas overlay **draws**
selection highlights but has no role in hover detection. ECharts manages hover entirely
within its own canvas.

When the ECharts component replaces the `<img>` element, it occupies the same DOM slot.
The host `<div>` mouse handler and region tree remain. Two hover systems would both fire
for the same mouse event.

### Decision — ECharts Owns Hover for Flat Design Charts

When `isFlatDesign()` is true and the chart renders via ECharts:

| Hover condition | ECharts emphasis/blur | SBI data tip | SBI built-in tooltip |
|---|---|---|---|
| No data tip configured | Active (`focus:'series'`) | Suppressed | Suppressed |
| Data tip configured | Active (dimming only) | Active | Suppressed |
| Data tip + `dataTipOnClick` | Active (dimming only) | On click only | Suppressed |

Hover dimming (ECharts `blur`) always fires — it is purely aesthetic.
SBI data tip continues to work where configured; ECharts tooltip shown only when no
data tip is configured.

**ECharts emphasis/blur config (all charts):**

```javascript
emphasis: {
  focus: 'series',
  blurScope: 'coordinateSystem'
},
blur: {
  itemStyle: { opacity: 0.2 }    // spec: 0.20 exact
}
```

**ECharts tooltip config:**

```javascript
tooltip: {
  trigger: 'item',
  confine: true,               // clamps within container — spec requirement
  show: !model.dataTip,        // suppressed when SBI data tip is configured
  formatter: (params) => {
    return `<div class="ec-tip">
      <span class="ec-tip-val">${params.value}</span>
      <span class="ec-tip-lbl">${params.name}</span>
    </div>`;
  }
}
```

The 3-part SVG tooltip construction (`.tip-bg`, `.tip-border`, `.tip-tail`, `getBBox()`)
from the lookfeel spec is eliminated entirely. ECharts renders tooltips in the HTML layer;
CSS `border-radius` and a CSS `::before` triangle replace the SVG path construction.

---

## 7. Cross-Chart Interaction Wiring

### How It Works

All 21 SBI chart interaction types remain server round-trips. ECharts does not replace
the `ViewsheetSandbox` propagation model — it plugs into the existing WebSocket pipeline
at both ends.

```
ECharts event fires (brush, click, zoom, etc.)
  → Angular ECharts event handler
  → translate to SBI selection format
  → fire existing WebSocket event (unchanged)
  → server processes via ViewsheetSandbox (unchanged)
  → server sends updated ChartOption back
  → Angular updates ECharts instance via setOption()
```

### Selection Format Translation

SBI expects a specific encoded string: `name^VALUE:value^INDEX:rowIndex^AND^...`

ECharts brush events return selected data indices. Angular's `EChartsEventTranslator`
converts them using the `meta.fieldMap` from the JSON endpoint:

```typescript
// meta.fieldMap: { seriesIndex: fieldName, ... }
onBrushEnd(params: BrushEndEvent): void {
  const selected = params.areas.flatMap(area =>
    area.coordRange ?
      this.translateCoordRange(area, this.meta.fieldMap) :
      this.translateDataIndices(area.dataIndex, this.meta.fieldMap)
  );
  const encoded = SBISelectionEncoder.encode(selected);
  this.chartService.brushChart(this.assemblyName, encoded);  // existing service call
}
```

`SBISelectionEncoder` mirrors `ChartVSSelectionUtil`'s format — one encoder method per
chart type, covering the same special cases (boxplot quartiles, treemap paths, sunburst
hierarchy, scatter point identity).

### ECharts `connect()` Bonus

`echarts.connect(groupId)` provides free lightweight visual synchronisation between
ECharts instances on the same dashboard — tooltip following, zoom mirroring — at no
extra cost. This is in addition to, not instead of, the server-round-trip propagation.

```typescript
// In ViewsheetComponent after all ECharts instances are mounted
const ids = this.echartsRefs.map(r => r.getEchartsInstance());
echarts.connect(this.runtimeId);  // group by viewsheet ID
```

### All 21 Interaction Types

| Interaction | ECharts event | WebSocket event | Notes |
|---|---|---|---|
| Brush selection | `brushEnd` | `VSChartBrushEvent` | Coord range → field values |
| Zoom in / out | `datazoom` | `VSChartZoomEvent` | Axis range → zoom params |
| Drill down | `click` (on drillable element) | `VSChartDrillEvent` | Element identity from `meta` |
| Drill action | `click` (context) | `VSChartDrillActionEvent` | Context menu intercept |
| Flyover | `mouseover` | `VSChartFlyoverEvent` | Lightweight — condition string only |
| Sort axis | Via Angular toolbar | `VSChartSortAxisEvent` | Not an ECharts event |
| Legend relocate | ECharts legend drag | `VSChartLegendRelocateEvent` | Position from drag end |
| Axes visibility | Via Angular toolbar | `VSChartAxesVisibilityEvent` | Not an ECharts event |
| Remaining 13 types | Via Angular UI controls | Existing WebSocket events | Not ECharts-originated |

---

## 8. Dark Mode and Theme

### ECharts Theme System

Dark mode is a theme swap, not a class toggle. A `flatLight` and `flatDark` ECharts
theme object are registered at app init and swapped when the user toggles dark mode:

```typescript
// app.module.ts — register once
import * as echarts from 'echarts';
echarts.registerTheme('flatLight', FLAT_LIGHT_THEME);
echarts.registerTheme('flatDark',  FLAT_DARK_THEME);

// EChartsComponent — on dark mode change
this.chartInstance.dispose();
this.chartInstance = echarts.init(this.el, isDark ? 'flatDark' : 'flatLight');
this.chartInstance.setOption(this.currentOption);
```

Theme objects encode the flat design palette, grid line colors, axis label font/color,
legend styling, and tooltip CSS class names. No per-element color mutation at toggle time.

**FLAT_LIGHT_THEME (excerpt):**

```javascript
{
  color: ['#00D4E8','#00B87A','#F59E0B','#F43F5E','#8B5CF6','#3B82F6','#0D9488','#64748B'],
  backgroundColor: 'transparent',
  textStyle: { fontFamily: "Inter,'Helvetica Neue',Arial,sans-serif" },
  legend: { textStyle: { color: '#1C1B1F' } },
  categoryAxis: { axisLine: { lineStyle: { color: '#CAC4D0' } },
                  axisLabel: { color: '#49454F' },
                  splitLine: { lineStyle: { color: '#E7E0EC', width: 1 } } }
}
```

**FLAT_DARK_THEME** mirrors the above with dark palette values and `#E6E0E9` text.

---

## 9. Existing StyleBI Interactivity — Compatibility

### Question

Will replacing the `<img>` chart element with an ECharts canvas break StyleBI's
existing chart interactions (context menu, show detail, drill-down, selection, pan, zoom)?

### Investigation

Most SBI interactions are on the **host container `<div>`**, not on the `<img>` element.
Hit detection uses a region tree spatial index (coordinate math). However, ECharts
renders to a `<canvas>` element that fills the same space as the former `<img>`. Mouse
events that previously passed through to the host `<div>` will now be partially consumed
by ECharts' own event system.

### Resolution — Event Passthrough

For interactions where ECharts fires its own event (brush, zoom, click), Angular maps
to the SBI WebSocket event (§ 7). For interactions not originated by ECharts (context
menu, show detail, axis resize), ECharts must pass mouse events through to the host `<div>`.

ECharts supports this via the `on` method with explicit propagation:

```typescript
this.chartInstance.on('contextmenu', (params) => {
  params.event.event.stopPropagation();   // prevent ECharts default
  this.hostEl.dispatchEvent(
    new MouseEvent('contextmenu', params.event.event)  // re-dispatch to host
  );
});
```

Interactions confirmed safe after ECharts integration:

| Interaction | Mechanism | Handling |
|---|---|---|
| Context menu | Re-dispatched to host `<div>` | ECharts `contextmenu` → passthrough |
| Show detail | Re-dispatched to host `<div>` | `click` not consumed by brush/drill |
| Drill-down | ECharts `click` → WebSocket | Mapped in § 7 |
| Region selection | ECharts `brush` → WebSocket | Mapped in § 7 |
| Axis resize drag | `chart-axis-area` host `<div>` | Unaffected — separate component |
| Legend drag/resize | `chart-legend-area` host `<div>` | Unaffected — separate component |
| Pan (map/geo) | Override ECharts roam or use host | Needs case-by-case review |
| Pinch zoom | ECharts `dataZoom` → WebSocket | Mapped in § 7 |

---

## 10. Color Palette System

### Question

The hybrid plan has palette changes scattered across Phase 1 (Batik backend) and §8
(ECharts theme objects). How does a single user-configured palette flow into both
renderers, and how does dark mode work in each track?

### Current State in SBI

- Named palettes defined in CSS: `ChartPalette[name='Soft'][index='1'] { color: #hex; }`
- 15+ built-in palettes; organisation-scoped via `OrganizationManager`
- API endpoint `GET /api/composer/chart/colorpalettes` returns palettes for current org
- UI picker: `palette-dialog.component.ts` and `graph-palette-dialog.component.ts`
- **No dark variants**: one color per index — the gap to fill
- **No user-created palettes**: predefined in `defaults.css` only

### Dual-Mode Palette Format

Extend the existing CSS palette format with a `variant` attribute. Backward compatible —
existing palettes without `variant` are treated as light mode.

```css
/* defaults.css — built-in Flat palette */
ChartPalette[name='Flat'][variant='light'][index='1'] { color: #00D4E8; }
ChartPalette[name='Flat'][variant='dark'][index='1']  { color: #22D3EE; }

/* OrgA theme JAR — chart-palettes.css (custom org palette) */
ChartPalette[name='BrandBlue'][variant='light'][index='1'] { color: #0055CC; }
ChartPalette[name='BrandBlue'][variant='dark'][index='1']  { color: #3388FF; }
```

Custom org palettes live in the theme JAR alongside other theme assets. The single
missing piece is that `ColorPalettes.java` currently loads only from the DataSpace CSS —
it never checks the active theme JAR. One targeted change to `loadPalettes()` closes
this gap (see Phase 1).

### How the Palette Flows Into Each Track

All three tracks read from the same `ColorPalettes` Java backend. The paths diverge only
at the renderer boundary:

```
ColorPalettes.getLightPalette(name)  →  8+ hex colors
ColorPalettes.getDarkPalette(name)   →  8+ hex colors (falls back to light if no dark variant)
         │
         ├── Track 1 (Batik / export)
         │     VGraphPair uses lightPalette only — export is always light mode
         │
         ├── Track 2 (ECharts / browser — standard + geo charts)
         │     EChartsOptionBuilder puts lightPalette in option.color[]
         │     option.color[] overrides FLAT_LIGHT_THEME default at per-chart level
         │     Dark palette returned in meta.darkPalette — Angular applies on theme swap
         │
         └── Track 3 (Batik <img> / browser — contour charts)
               Excluded from flat design — existing palette unchanged
```

### Dark Mode Palette in ECharts

The inline SVG approach embeds dark overrides in the SVG `<style>` block
(`#chart-id.dark .bar-N { fill: darkColor }`). ECharts uses a different mechanism:
the dark palette is applied at theme-swap time as an `option.color` override,
not as CSS.

`EChartsOptionBuilder` includes both palettes in the JSON response:

```json
{
  "option": { "color": ["#00D4E8", "#00B87A", ...] },
  "meta":   { "darkPalette": ["#22D3EE", "#10B981", ...] }
}
```

Angular's `EChartsChartComponent` applies the dark palette when switching themes:

```typescript
onDarkModeChange(isDark: boolean): void {
  this.chartInstance.dispose();
  const theme = isDark ? 'flatDark' : 'flatLight';
  this.chartInstance = echarts.init(this.el, theme);
  const option = isDark
    ? { ...this.currentOption, color: this.meta.darkPalette }
    : this.currentOption;
  this.chartInstance.setOption(option);
}
```

The `FLAT_DARK_THEME` object carries the default flat design dark palette.
`meta.darkPalette` overrides it when the chart has a specific configured palette.

### Custom Org Palettes for ECharts

When a user selects "BrandBlue" as their chart palette:
- Backend: `EChartsOptionBuilder` reads `ColorPalettes.getLightPalette("BrandBlue")` →
  writes to `option.color[]`; `getDarkPalette("BrandBlue")` → writes to `meta.darkPalette`
- No ECharts theme re-registration needed — `option.color[]` overrides the theme default
  at the per-chart level
- Works identically for all 27 chart types and both browser tracks

### Frontend Palette Dialog Changes

The `palette-dialog.component.ts` UI change is the same as in the inline SVG plan:
show light and dark swatch pairs per palette row; preview toggles between modes.
The API response from `/api/composer/chart/colorpalettes` is extended to return
`darkColors[]` alongside the existing `colors[]`.

### Files to Modify

| File | Change |
|---|---|
| `defaults.css` | Add `variant='light'`/`variant='dark'` to all existing `ChartPalette` selectors; add new `Flat` palette entries |
| `ColorPalettes.java` | Check active theme JAR for `chart-palettes.css` and merge; add `getLightPalette()` / `getDarkPalette()` |
| `CategoricalColorModel.java` | Add `darkColors[]` field alongside existing `colors[]` |
| `VGraphPair.java` | Use `getLightPalette()` for export rendering (Track 1) |
| `EChartsOptionBuilder.java` | Put `getLightPalette()` in `option.color[]`; put `getDarkPalette()` in `meta.darkPalette` |
| `EChartsChartComponent.ts` | Apply `meta.darkPalette` on theme swap |
| `palette-dialog.component.ts` | Show light + dark swatch pairs; preview toggles between modes |
| `default-palette.ts` | Add flat design palette colors to color picker swatch grid |
| Chart colorpalettes API controller | Return `darkColors[]` alongside `colors[]` |

**Design references:**

- `Chart_Design_short.md` §1 — palette color values, `.series-N` class rules
- `bar_flat.svg` — light and dark palette color values reference

---

## 11. Web Component Compatibility

### Question

StyleBI charts can be embedded in external web apps as Web Components
(`<inetsoft-chart>`). Does replacing `<img>` chart loading with ECharts canvas
interfere with Shadow DOM isolation?

### Investigation

The Web Component is built with Angular Elements (`@angular/elements` +
`createCustomElement`). It uses the same Angular chart components as the portal —
`chart-area`, `chart-plot-area`, `chart-legend-area` — controlled by an
`embedAssembly: true` flag. The Web Component uses Shadow DOM via Angular's
`ɵDomSharedStylesHost`.

ECharts renders to a `<canvas>` element and appends its tooltip `<div>` to
`document.body` by default. Both behaviours need assessment in a Shadow DOM context.

### Compatibility Assessment

| Change | Shadow DOM concern | Resolution |
|---|---|---|
| ECharts `<canvas>` | Canvas inside shadow root | None — canvas renders identically inside shadow DOM |
| ECharts tooltip `<div>` | **Appended to `document.body` by default** — outside shadow root; component styles don't reach it | Fix: `tooltip.appendTo` option (see below) |
| `echarts.registerTheme()` | Global call on ECharts module object — not DOM-scoped | None — registration is global JS state, unaffected by shadow DOM |
| `echarts.connect(groupId)` | Global instance registry | None — works across shadow roots; `runtimeId` from host app scopes the group |
| `FlatDesignService` flag | Angular service inside shadow root | None — `flat-design` attribute override already handled in Phase 0 |
| ECharts resize observer | `ResizeObserver` on container element | None expected — verify on first integration |
| ECharts GL (if used for large scatter) | WebGL context in shadow DOM | None — WebGL canvas behaves same as 2D canvas |

### Tooltip Fix — `appendTo`

ECharts 5.x provides an `appendTo` option controlling where the tooltip DOM is inserted.
Set it to append inside the ECharts container (which is inside the shadow root) rather
than to `document.body`:

```typescript
tooltip: {
  trigger: 'item',
  confine: true,
  appendTo: (container: HTMLElement) => container,  // stays inside shadow root
  // remaining tooltip config unchanged
}
```

With tooltip inside the shadow root, the `.ec-tip` SCSS styles (defined in
`EChartsChartComponent`'s `styleUrls`) apply correctly. No CSS custom property
workaround needed.

This is the **only code change required** for Web Component compatibility beyond what
Phase 0 already provides.

### Conclusion

One targeted fix (`tooltip.appendTo`) plus the Phase 0 `flat-design` attribute
handling. Everything else works identically inside the Web Component. Unlike the inline
SVG approach — where Shadow DOM actually helped by strengthening `#chart-id` selector
isolation — ECharts is neutral to Shadow DOM except for the tooltip placement.

### Files to Modify

| File | Change |
|---|---|
| `EChartsOptionBuilder.java` | Add `appendTo` function literal to tooltip config (serialised same as `animationDelay`) |
| `EChartsChartComponent.ts` | Deserialise `appendTo` from option JSON as a Function before passing to ECharts |

---

## 12. Recommended Build Order

Each phase is independently testable and delivers visible progress. Phase 0 is
a prerequisite for all other phases. Tracks 1 and 2 can progress in parallel
after Phase 0 completes.

---

### Phase 0 — Design Version Flag (prerequisite)

Must be completed before any other phase. All subsequent changes are gated behind
this flag so existing behaviour is never broken by default.

**Three-tier flag resolution:**

| Tier | Storage | Default |
|---|---|---|
| System | `SreeEnv` property `inetsoft.graph.flatDesign` | `true` |
| Org | Per-org setting in `OrganizationManager` | inherits system |
| Embed | `<inetsoft-chart flat-design="false">` attribute | inherits org |

New installs get the new design automatically. Existing installs upgrading can set
`inetsoft.graph.flatDesign=false` to preserve the current look, then migrate org-by-org.

**Steps:**

1. Add `inetsoft.graph.flatDesign` boolean to `SreeEnv` (default `true`)
2. Add `flatDesign` field to `OrganizationSettings`; admin UI toggle in org settings screen
3. Add `boolean flatDesign` to `GraphPaintContext`; resolved at request time in
   `AssemblyImageService`
4. Expose resolved flag to Angular via existing settings API response (one new boolean field)
5. Angular `FlatDesignService` reads flag at init
6. `EChartsChartComponent` checks flag — when false, renders `<img>` via existing
   `chart-image.directive.ts` path identically to today

**Deliverable:** Flag infrastructure in place. Flag off = identical to current production.
Side-by-side screenshot verification.

**Files to modify:**

| File | Change |
|---|---|
| `SreeEnv.java` | Add `inetsoft.graph.flatDesign` property (default `true`) |
| `OrganizationSettings.java` | Add `flatDesign` boolean field + getter/setter |
| `OrganizationManager.java` | Expose `isFlatDesign(orgId)` combining system + org tier |
| `GraphPaintContext.java` | Add `boolean flatDesign` field + getter/setter |
| `AssemblyImageService.java` | Resolve system + org flag; set on `GraphPaintContext` |
| Settings API controller | Add `flatDesign` boolean to existing chart/portal settings response |
| `FlatDesignService.ts` (new) | Angular service — reads flag from API, exposes `isFlatDesign()` |
| `EChartsChartComponent.ts` (new skeleton) | Flag-gated stub — renders `<img>` when false |
| Web Component host | Accept `flat-design` attribute; override `FlatDesignService` value |

---

### Phase 1a — Track 1: Node.js Sidecar Setup

> **Prerequisite for all export SSR work.**

Set up the Node.js sidecar process and verify end-to-end SVG round-trip for one chart
type before proceeding to full option builder work.

**Steps:**

1. Create `ssr/` directory in SBI project: `render-server.js`, `package.json`,
   `themes/flat-light.json`, `themes/flat-print.json`
2. `SsrSidecarManager.java` (new): `ProcessBuilder` launch on SBI startup, stdout
   reader waiting for `"ready\n"`, `GET /health` check, restart-on-failure logic,
   `destroy()` on SBI shutdown
3. `SsrRenderClient.java` (new): HTTP POST to `localhost:7734/render`; returns SVG string
4. `AbstractVSExporter.java`: add `exportChart()` helper gated on `echart-ssr-export`
   feature flag; wire `SsrRenderClient` + `SVGTranscoder` path
5. Smoke test: render a single bar chart option object through the sidecar; verify SVG
   output is accepted by `SVGTranscoder` and appears in a test PDF

**Deliverable:** Sidecar starts with SBI, accepts render requests, and produces SVG
that Batik can embed in PDF. Feature flag `echart-ssr-export` controls which path is used.

**Files to modify / create:**

| File | Change |
|---|---|
| `ssr/render-server.js` (new) | Node.js HTTP server wrapping `renderToSVGString` |
| `ssr/package.json` (new) | `echarts` dependency, pinned version |
| `ssr/themes/flat-light.json` (new) | ECharts flat light theme object |
| `ssr/themes/flat-print.json` (new) | ECharts print theme (no transparency, CMYK-safe colors) |
| `SsrSidecarManager.java` (new) | Sidecar lifecycle: start, health check, restart, stop |
| `SsrRenderClient.java` (new) | HTTP client for POST /render |
| `AbstractVSExporter.java` | `exportChart()` with SSR vs. Batik flag gate |

---

### Phase 1b — Track 1: Batik Style Updates (Non-ECharts Elements)

> **Flag gate:** all changes execute only when `GraphPaintContext.isFlatDesign()` is true.

Updates visual style in export for elements that remain on Batik — contour charts, faceted
charts, gauges, tables, and crosstabs. Standard chart types no longer need Batik style
updates as they render via ECharts SSR after Phase 1a + Phase 2.

**Steps:**

1. Add `Flat` palette to `defaults.css` with `variant='light'` / `variant='dark'`
2. `ColorPalettes.java`: add `getLightPalette(name)` / `getDarkPalette(name)` methods;
   check active theme JAR for `chart-palettes.css` override
3. `CategoricalColorModel.java`: add `darkColors[]` alongside `colors[]`
4. `GDefaults.java`: update default font family to Inter / Helvetica Neue / Arial
5. `AxisSpec.java`: lighter grid lines, reduced tick weight for flat design
6. `VGraphPair.java`: apply flat design axis styling gated on `isFlatDesign()`

**Deliverable:** Batik-rendered elements (tables, gauges, contour charts, faceted charts)
export with flat design palette and updated typography in PDF, Excel, and PowerPoint.

**Files to modify:**

| File | Change |
|---|---|
| `defaults.css` | Add `Flat` palette with `variant='light'`/`variant='dark'` selectors |
| `ColorPalettes.java` | Dual-mode palette methods; theme JAR override |
| `CategoricalColorModel.java` | Add `darkColors[]` field |
| `GDefaults.java` | Update font family default |
| `AxisSpec.java` | Grid line color/weight for flat design |
| `VGraphPair.java` | Apply flat design axis styling; pass palette to export path |
| `AssemblyImageService.java` | Pass active palette to `VGraphPair` |

**Design references:**

- `Chart_Design_short.md` — color palette, typography specifications
- `bar_flat.svg` — palette color values, axis style reference

---

### Phase 2 — Track 2: ECharts Backend (JSON Endpoint + Option Mapper)

New endpoint and option builder for cartesian chart types. No Angular changes yet — the
endpoint can be tested directly via HTTP.

**Steps:**

1. Add `GET /getChartOption/{vid}/{aid}/{width}/{height}` controller method in
   `GetImageController.java`
2. `EChartsOptionBuilder.java` (new class): shared option base (theme, tooltip, legend,
   animation config), plus per-type builder methods
3. Implement option builders for: Bar, Stacked Bar, Line, Stacked Line, Area,
   Stacked Area, Step Line, Step Area, Candle, Waterfall, Pareto
4. `EChartsMetaBuilder.java` (new class): builds `meta.fieldMap` for WebSocket event
   translation
5. `animationDelay` function serialisation (JS function literal in JSON)

**Deliverable:** All cartesian chart types return valid ECharts `option` JSON. Verify
in a standalone HTML page with ECharts loaded.

**Files to modify / create:**

| File | Change |
|---|---|
| `GetImageController.java` | Add `getChartOption()` endpoint |
| `EChartsOptionBuilder.java` (new) | Option builder — shared base + cartesian chart types |
| `EChartsMetaBuilder.java` (new) | `meta.fieldMap` builder from `ChartInfo` |
| `AssemblyImageService.java` | Wire new endpoint to `EChartsOptionBuilder` |

**Design references:**

- `bar_flat.svg`, `line_flat.svg`, `area_flat.svg` — series structure, stagger timing
- `Chart_Design_short.md` §3 — adaptive stagger formula, timing constants

---

### Phase 3 — Track 2: Angular ECharts Component (Basic Rendering + Dark Mode)

Replace `<img>` loading with ECharts rendering for flat design mode. No interaction
wiring yet — charts render but do not respond to brush/zoom/drill.

**Steps:**

1. Install `ngx-echarts` (or manual ECharts wrapper)
2. Register `flatLight` and `flatDark` themes at app init
3. `EChartsChartComponent` fetches `/getChartOption/...`, initialises ECharts instance
4. On dark mode toggle: dispose + reinit with alternate theme (§ 8)
5. `vs-chart.component.html`: switch between `<img>` path and `<EChartsChartComponent>`
   based on `FlatDesignService.isFlatDesign()`
6. `chart-plot-area.component.ts`: suppress SBI built-in tooltip when ECharts is active
   and no data tip is configured

**Deliverable:** Cartesian charts render in browser via ECharts with flat design palette,
animation, and dark mode. Regression test: verify non-flat-design mode unchanged.

**Files to modify / create:**

| File | Change |
|---|---|
| `EChartsChartComponent.ts` (new) | Fetches option, inits ECharts, handles resize |
| `EChartsChartComponent.html` (new) | Single `<div>` host for ECharts canvas |
| `FlatThemes.ts` (new) | `FLAT_LIGHT_THEME` and `FLAT_DARK_THEME` objects |
| `app.module.ts` | Register ECharts themes at init |
| `vs-chart.component.html` | Flag-gated switch between `<img>` and ECharts component |
| `chart-plot-area.component.ts` | Suppress built-in tooltip when ECharts active + no data tip |
| `vs-chart.component.scss` | Card shell drop shadow (same as inline SVG Phase 3) |

**Design references:**

- `Chart_Design_short.md` §1 — palette color values for theme objects
- `portal-dark.html` — dark mode palette reference

---

### Phase 4 — Track 2: Hover, Tooltip, and Emphasis

Wire ECharts hover events to SBI tooltip and data tip systems. Verify dimming, tooltip
display, and data tip coordination for all cartesian chart types.

**Steps:**

1. Add `emphasis` / `blur` config to all cartesian series (§ 6)
2. Style ECharts tooltip to match flat design: CSS class `ec-tip`, border-radius,
   Inter font, light/dark variants
3. `EChartsChartComponent`: subscribe to ECharts `mouseover` → fire
   `VSChartFlyoverEvent` via existing `chartService.chartFlyover()` when data tip configured
4. Coordinate ECharts tooltip visibility with SBI data tip: hide ECharts tooltip when
   `model.dataTip` is set (§ 6 table)
5. Add `.ready` guard: disable hover emphasis during ECharts animation. ECharts handles
   this natively — verify no dimming fires before `animationend` completes

**Deliverable:** Hover dimming to 0.20, HTML tooltip, and data tip coordination working
for all cartesian chart types.

**Files to modify:**

| File | Change |
|---|---|
| `EChartsOptionBuilder.java` | Add `emphasis`/`blur` config to all series builders |
| `EChartsOptionBuilder.java` | Add `tooltip` config with `confine:true` and HTML formatter |
| `EChartsChartComponent.ts` | ECharts `mouseover` → `VSChartFlyoverEvent`; tooltip show/hide coordination |
| `_echarts-tooltip.scss` (new) | `.ec-tip` styles matching flat design bubble (light + dark) |

**Design references:**

- `Chart_Design_short.md` §4 — dimmed opacity 0.20, transition 0.2s ease
- `Chart_Design_short.md` §5 — tooltip clamping, vertical flip, typography
- `bar_flat.svg` — hover JS pattern reference (intent; implementation is ECharts config)

---

### Phase 5 — Track 2: Cross-Chart Interaction Wiring

Wire all 21 ECharts events to SBI WebSocket event pipeline. After this phase, brushing,
zooming, and drilling work across charts.

**Steps:**

1. `EChartsEventTranslator.ts` (new): maps ECharts events to SBI selection format strings
   using `meta.fieldMap` from the JSON endpoint
2. `EChartsChartComponent`: subscribe to `brushEnd`, `datazoom`, `click` — delegate to
   `EChartsEventTranslator`, then call existing `chartService` methods
3. Re-dispatch `contextmenu` and other passthrough events to host `<div>` (§ 9)
4. `echarts.connect(runtimeId)` call in `ViewsheetComponent` after all instances mounted
5. Verify cross-chart filter propagation: brush chart A → chart B re-queries and
   re-renders with updated `option` from server

**Deliverable:** Full cross-chart interaction parity with current production for
cartesian chart types. `echarts.connect()` provides bonus tooltip/zoom visual sync.

**Files to modify / create:**

| File | Change |
|---|---|
| `EChartsEventTranslator.ts` (new) | ECharts event → SBI selection format encoder |
| `EChartsChartComponent.ts` | Subscribe to all relevant ECharts events; passthrough for context menu |
| `ViewsheetComponent.ts` | `echarts.connect(runtimeId)` after mount |
| `vs-chart.component.ts` | Pass `meta` from JSON response down to event translator |

---

### Phase 6 — Track 2: Geometric and Hierarchical Chart Types

Extend the option mapper to geometric chart types. Update backend and Angular for
types with built-in ECharts animation (no custom series needed).

**Chart types in this phase:** Pie / Donut, Sunburst, Treemap, Radar, Funnel, Bubble,
Boxplot, Jump line, Tree, Network, Circular Network.

**Steps:**

1. `EChartsOptionBuilder`: add builder methods for all chart types in this phase
2. `EChartsMetaBuilder`: extend `fieldMap` for hierarchical types (treemap paths,
   sunburst hierarchy IDs)
3. `EChartsEventTranslator`: add decoders for treemap path selection, sunburst
   hierarchy selection, radar vertex selection
4. Tree / Network / Circular Network: emit `meta.adjacencyMap` from server for
   connected-subgraph hover (ECharts `graph` series `focusNodeAdjacency: true` handles
   this natively)
5. Verify `animationType: 'expansion'` on Pie / Donut / Sunburst

**Deliverable:** All built-in ECharts chart types rendering and interactive. Custom series
types deferred to Phase 7.

**Files to modify:**

| File | Change |
|---|---|
| `EChartsOptionBuilder.java` | Builder methods for Pie, Sunburst, Treemap, Radar, Funnel, Bubble, Boxplot, Jump line, Tree, Network, Circular Network |
| `EChartsMetaBuilder.java` | Hierarchical type field maps; adjacency map for network types |
| `EChartsEventTranslator.ts` | Selection decoders for hierarchical and network types |

**Design references:**

- `pie_flat.svg`, `sunburst_flat.svg`, `treemap_flat.svg`, `radar_flat.svg` — design intent
- `Chart_Design_short.md` §3 — rAF intent for pie/sunburst (ECharts `expansion` equivalent)
- `network_flat.svg`, `circular_network_flat.svg`, `tree_flat.svg` — hover subgraph intent

---

### Phase 7 — Track 2: Custom Series (Icicle, Marimekko, Circle Packing, Gantt)

Four chart types require ECharts custom series because no native type exists. Each
custom series registers a renderer and participates in the same animation / hover
pipeline as native types.

**Steps (per chart type):**

1. Register ECharts custom series (`echarts.use([CustomChart])`)
2. Implement `renderItem` function: translates data items to SVG/canvas shapes
3. `EChartsOptionBuilder`: add builder method using `type: 'custom'`
4. `EChartsEventTranslator`: add selection decoder for the custom layout
5. Verify `animationDelay` function applies to custom series items

| Chart | Custom series approach |
|---|---|
| Icicle | Rectangular tiles with depth-based coloring; same layout as treemap but top-down |
| Marimekko | Variable-width bar columns; width proportional to category total |
| Circle packing | Nested circles; positions from server-side layout computation |
| Gantt | Time-axis bars with row index; uses `bar` base with custom clip shapes |

**Deliverable:** All 27 chart types rendering and interactive in ECharts.

**Files to modify / create:**

| File | Change |
|---|---|
| `EChartsOptionBuilder.java` | Builder methods for Icicle, Marimekko, Circle Packing, Gantt |
| `IcicleChartRenderer.ts` (new) | ECharts custom series renderer for icicle |
| `MarimekkoChartRenderer.ts` (new) | ECharts custom series renderer for marimekko |
| `CirclePackingChartRenderer.ts` (new) | ECharts custom series renderer for circle packing |
| `GanttChartRenderer.ts` (new) | ECharts custom series renderer for gantt |
| `EChartsEventTranslator.ts` | Selection decoders for custom series types |

**Design references:**

- `icicle_flat.svg`, `marimekko_flat.svg`, `circle_packing_flat.svg`, `gantt_flat.svg` — visual reference
- `Chart_Design_short.md` §3 — A1 animation intent (ECharts `animationDelay` equivalent)

---

### Phase 8 — Track 2: Geographic / Map Charts

Convert SBI's WKT map assets to GeoJSON and implement ECharts geo rendering for map
polygon and map point chart types.

**Steps:**

1. `GeoJsonConverter.java` (new): reads SBI's WKT CSV format
   (`ID|px|py|sx|sy|WKT_GEOMETRY`), outputs RFC 7946 GeoJSON FeatureCollection
2. Convert all 6 built-in maps at build time; output to `resources/geojson/`
3. Add `GET /api/mapdata/{mapName}` endpoint serving cached GeoJSON (built-in + custom)
4. `EChartsOptionBuilder`: add `buildMapOption()` — choropleth (`map` series) and
   point-on-map (`scatter` on `geo`)
5. `EChartsMetaBuilder`: map region name → field value mapping for brush event wiring
6. Angular `EChartsChartComponent`: for map types, fetch GeoJSON via `/api/mapdata/`,
   call `echarts.registerMap(name, geoJson)` before `setOption()`
7. `EChartsEventTranslator`: map region click/brush → SBI selection format
   (region name → `name^VALUE:regionName`)
8. `FlatDesignService`: return `false` for `CHART_SCATTER_CONTOUR` and
   `CHART_MAP_CONTOUR` — these always use the `<img>` path

**GeoJSON conversion — one-time per map asset:**

```java
// GeoJsonConverter.java
FeatureCollection convert(String mapCsvPath) {
    // Read pipe-delimited CSV
    // Parse WKT geometry per row using JTS WKTReader (already a SBI dependency)
    // Output GeoJSON FeatureCollection with region ID as feature property
}
```

JTS (Java Topology Suite) is already in SBI's dependency tree via the geo pipeline.
`WKTReader` → `GeoJSONWriter` is a direct conversion requiring no new libraries.

**Custom user maps:**

Users can upload custom map files (same WKT CSV format). The converter runs on upload
via `MapGenerator`'s existing upload handler, caching the GeoJSON alongside the source
file. No manual conversion step for users.

**Deliverable:** Map polygon and map point chart types rendering interactively in ECharts
with flat design theme, hover dimming, tooltip, and brush event wiring. Contour charts
confirmed still rendering via `<img>` path unchanged.

**Files to modify / create:**

| File | Change |
|---|---|
| `GeoJsonConverter.java` (new) | WKT CSV → GeoJSON FeatureCollection converter |
| `MapDataController.java` (new) | `GET /api/mapdata/{mapName}` — serves cached GeoJSON |
| `MapGenerator.java` | Trigger `GeoJsonConverter` on custom map upload; cache result |
| `EChartsOptionBuilder.java` | `buildMapOption()` for choropleth + map point types |
| `EChartsMetaBuilder.java` | Region name → field mapping for map types |
| `EChartsChartComponent.ts` | Fetch GeoJSON + `echarts.registerMap()` before `setOption()` |
| `EChartsEventTranslator.ts` | Map region selection → SBI brush format |
| `FlatDesignService.ts` | Return `false` for contour chart types |

---

### Phase 9 — Color Palette System (Backend + Frontend)

Completes the palette system begun in Phase 1. Phase 1 covered the Batik/export side;
this phase wires dual-mode palettes into ECharts and updates the palette picker UI.

**Steps:**

1. `EChartsOptionBuilder`: add `getDarkPalette(name)` result to `meta.darkPalette` in
   JSON response
2. `EChartsChartComponent`: apply `meta.darkPalette` as `option.color` override on
   dark theme swap (§ 10)
3. Chart colorpalettes API controller: extend response to include `darkColors[]`
4. `palette-dialog.component.ts`: show light + dark swatch pairs per palette row;
   preview button toggles between modes
5. `default-palette.ts`: add flat design palette swatches to color picker grid
6. Theme JAR documentation: add `chart-palettes.css` format spec to theme authoring guide

**Deliverable:** User-configured palettes apply correctly in both light and dark mode
across all chart types and all three rendering tracks. Custom org palettes in theme JARs
are picked up automatically by both Batik and ECharts renderers.

**Files to modify:**

| File | Change |
|---|---|
| `EChartsOptionBuilder.java` | Add `meta.darkPalette` field using `getDarkPalette()` |
| `EChartsChartComponent.ts` | Apply `meta.darkPalette` on dark theme swap |
| Chart colorpalettes API controller | Return `darkColors[]` alongside `colors[]` |
| `palette-dialog.component.ts` | Light + dark swatch pairs; mode preview toggle |
| `default-palette.ts` | Add flat design palette to color picker swatch grid |

**Design references:**

- `Chart_Design_short.md` §1 — palette color values, dark mode palette values

---

## 13. Specialized Chart Types — Map, Contour, and Scatter Density

### Question

SBI includes specialized chart types that are fundamentally different from standard
categorical charts — geographic maps, KDE contour overlays, and density scatter. These
are excluded from the lookfeel flat design update. How do they fit into the hybrid
architecture?

### Investigation

**SBI's specialized chart types and their rendering:**

| Chart type | Constant | Coordinate | Rendering | Output |
|---|---|---|---|---|
| Map polygon (choropleth) | `CHART_MAP` | `GeoCoord` (Mercator) | `PolygonVO` via WKT polygons | Vector (GeneralPath) |
| Map point | `CHART_MAP` | `GeoCoord` | `PointVO` on geo coord | Vector |
| Scatter contour | `CHART_SCATTER_CONTOUR` (0x50) | `RectCoord` | `DensityFormVO` — KDE + Marching Squares | Vector (GeneralPath) |
| Map contour | `CHART_MAP_CONTOUR` (0x51) | `GeoCoord` | `DensityFormVO` over map background | Vector |

**Contour rendering pipeline** (`DensityFormVO.java`):
1. Divides plot area into 2D KDE grid (configurable cell size, bandwidth)
2. Loops all `PointVO` objects, computes Gaussian KDE per cell
3. Expands grid ×10 via cubic spline interpolation for smooth curves
4. Runs `MarchingSquaresContour.createShapes()` — classical 16-case iso-line algorithm
5. Paints resulting `GeneralPath[]` via `Graphics2D.fill()` — pure vector, no raster

**Map data** (`GeoMap.java`, `BufferedGeoMap.java`):
- 6+ built-in maps stored as pipe-delimited CSV with WKT geometry:
  `US, US_WEB, CANADA, MEXICO, EUROPE, ASIA, WORLD` + custom user maps
- Coordinates transformed via `GeoCoord` using Mercator, Miller, or WebMercator
  projection (`GeoProjection` interface)
- Optional web tile background via `WebMapService` / `WebMapPainter`
  (MapBox, Google Maps integration)

**ECharts capability match:**

| SBI chart | ECharts native support | Gap |
|---|---|---|
| Map polygon / choropleth | ✓ `map` series + GeoJSON | WKT CSV → GeoJSON conversion needed |
| Map point | ✓ `scatter` on `geo` component | Same GeoJSON conversion |
| Web tile background | ✓ Community (`mapbox-echarts`) | Additional integration work |
| Scatter contour (KDE iso-lines) | ✗ No native contour series | No equivalent exists |
| Map contour | ✗ No native contour on geo | No equivalent exists |
| Color-grid heatmap (not iso-lines) | ✓ `heatmap` on `cartesian2d` or `geo` | Different visual — not a replacement |

### Decision — Three-Tier Classification

#### Tier A — ECharts (with GeoJSON conversion): Map polygon, Map point

ECharts `map` series accepts custom GeoJSON. SBI's WKT CSV map files are converted to
GeoJSON server-side once per map asset. The converted files are cached alongside the
originals and served as static assets. This is a one-time data pipeline addition, not
an ongoing per-render conversion.

All six built-in maps plus any user-uploaded custom maps go through the same converter.
ECharts geo charts then participate in the full Track 2 pipeline: flat design theme,
`emphasis`/`blur` hover, zoom/pan, WebSocket event wiring.

Web tile background is a **deferred enhancement** (see §10.1 below).

#### Tier B — Batik `<img>` retained (browser + export): Scatter Contour, Map Contour, Faceted Charts

**Contour charts:** The KDE + Marching Squares contour algorithm is a complex, high-quality
server-side computation with no ECharts equivalent. The output is already pure vector and
renders well at any resolution.

**Faceted charts (small multiples / trellis):** SBI's grammar-of-graphics engine generates
N panels dynamically based on a "facet by" dimension — the panel count is data-driven and
unknown at option-build time. ECharts has no native facet concept. Its multiple `grid`
components require static, manually-specified layouts and provide no built-in axis
synchronization across panels. Approximating facets by emitting N separate ECharts instances
would require pre-splitting data server-side and losing cross-panel scale coordination.

Both types:

- Are explicitly **excluded from the lookfeel flat design update** — no animation, no
  hover dimming, no tooltip redesign applies to them
- Continue to be served as Batik-rendered SVG `<img>` in the browser (Track 3)
- Continue to be rendered via Batik for export (Track 1) — no change

`FlatDesignService.isFlatDesign()` returns `false` for these chart types regardless
of the global flag. The `EChartsChartComponent` renders an `<img>` for them
identically to today.

#### Rendering track summary (updated)

```
ViewsheetSandbox
  ├── Export (all):          VGraphPair → Batik → PDF / Excel / PPT
  ├── Browser — standard:   JSON option → ECharts → canvas   (Phases 2–7)
  ├── Browser — map/geo:    JSON + GeoJSON → ECharts geo → canvas  (Phase 8 — deferred)
  └── Browser — contour/faceted: Batik SVG → <img>  (unchanged, no flag gate — permanent)
```

> **Permanent vs. deferred Batik:** Contour and faceted charts stay on Batik indefinitely
> because no ECharts equivalent exists. Map charts are **deferred ECharts work** (Phase 8)
> — ECharts natively handles choropleth and point-on-map via GeoJSON, and the WKT→GeoJSON
> conversion uses JTS which is already in SBI. Maps can be cut from an initial release but
> should not be permanently classified alongside contour/faceted as Batik-only.

### 13.1 Web Tile Base Map — Deferred Enhancement

Map charts with a MapBox or Google Maps tile background require a layered architecture:
Leaflet or MapLibre GL as the tile base, ECharts `geo` overlay on top. This is feasible
but significantly more complex than the standard geo path and should be treated as a
separate initiative after Phase 8 is stable.

In the interim, maps with web tile backgrounds continue to use the Batik `<img>` path
in the browser (same as contour charts — Track 3).
