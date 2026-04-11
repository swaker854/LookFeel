# Chart Design System

## 1. Standard Color Palette

Defined as CSS classes on every chart. Single source of truth — JS never stores hex.

```css
/* Light mode */
.bar-1 { fill:#00D4E8; } .bar-2 { fill:#00B87A; }
.bar-3 { fill:#F59E0B; } .bar-4 { fill:#F43F5E; }
.bar-5 { fill:#8B5CF6; } .bar-6 { fill:#3B82F6; }
.bar-7 { fill:#0D9488; } .bar-8 { fill:#64748B; }

/* Dark mode */
svg.dark .bar-1 { fill:#22D3EE; } svg.dark .bar-2 { fill:#10B981; }
svg.dark .bar-3 { fill:#FBB724; } svg.dark .bar-4 { fill:#FB6181; }
svg.dark .bar-5 { fill:#A78BFA; } svg.dark .bar-6 { fill:#60A5FA; }
svg.dark .bar-7 { fill:#2DD4BF; } svg.dark .bar-8 { fill:#94A3B8; }
```

> **Pure SVG charts** (no outer HTML document) use `svg.dark .bar-N`
> when the root element is `<svg id="root">` — `svg.dark` matches the
> element itself because the selector targets `<svg>` elements that also
> have the `dark` class. Use `#root.dark .bar-N` only when the SVG is
> inlined inside an HTML document where `svg` as a selector might match
> outer SVG elements unexpectedly. All card shell dark overrides follow
> the same `svg.dark` pattern — never mix `#root.dark` and `svg.dark`
> in the same chart.

### Semantic color extension

For charts where color encodes meaning rather than category (e.g. bull/bear,
positive/negative), define semantic classes whose values are aligned to the
standard palette — never invent new hex values.

```css
/* Example: candle chart — aligned to bar-2 green and bar-4 rose */
.c-bull { fill:#00B87A; }  /* = bar-2 light */
.c-bear { fill:#F43F5E; }  /* = bar-4 light */
svg.dark .c-bull { fill:#10B981; }  /* = bar-2 dark */
svg.dark .c-bear { fill:#FB6181; }  /* = bar-4 dark */
```

The semantic class names describe meaning (`c-bull`, `c-bear`), not sequence.
Dark mode overrides follow the same `svg.dark` pattern as `.bar-N`.

---

## 2. Dark Mode Toggle Pattern

Identical across all charts. CSS handles the palette swap automatically
on class toggle. JS only moves the thumb and swaps the label.

**Required:** always use an `isDark` boolean variable as the guard. Never
use `svg.classList.contains('dark')` as the guard — that is one extra DOM
query per call and diverges from the standard pattern.

**Default state:** toggle must initialise in light mode — `cx="16"`,
label `"Dark"`. Never initialise in dark state.

**No `swapColors()` JS function.** If a `swapColors` or `swapCellColors`
function exists in JS, that is a sign that element colors are stored as
hardcoded `fill="#hex"` attributes rather than `bar-N` CSS classes, which
violates §1. The fix is to use CSS classes — then dark mode is automatic.

```js
var isDark = false;  // always declare as module-level boolean

function setMode(wantDark) {
  if (wantDark === isDark) return;  // guard uses isDark, not classList.contains
  isDark = wantDark;
  if (wantDark) { svg.classList.add('dark'); thumb.setAttribute('cx','52'); lbl.textContent='Light'; }
  else          { svg.classList.remove('dark'); thumb.setAttribute('cx','16'); lbl.textContent='Dark'; }
  // hierarchical charts also call recolor() here to re-read CSS and reblend tints
}
```

**`isDark` must be declared before the first `build()` call.** If `isDark` is declared after `build()` executes, any code inside `build()` that reads the outer `isDark` (e.g. `getTint()`) will see `undefined` rather than `false`. Declaring after only appears safe when `isDark` is also passed as an explicit parameter — a fragile coincidence. Always hoist the declaration:

```js
var isDark = false;  // ← declared before build()

build();             // ← build() reads isDark from outer scope via getTint() etc.
```

---

## 3. Onload Animation Pattern

Two strategies are used. The choice depends on whether the animation
is purely opacity-based or involves geometric transformation alongside opacity.

**Never use SMIL `<animate>` or `<animateTransform>` with `fill="freeze"`.**
The `fill="freeze"` attribute locks the animated property at its end value
via the animation engine. This is the same conflict as CSS `fill-mode:both`
or `forwards` — the frozen value overrides any subsequent CSS rule, including
hover dimming. SMIL animations are also being deprecated in browsers. Always
use CSS `@keyframes` instead.

---

### Method A — CSS `@keyframes`
**Charts: bar, line, icicle, treemap, flame graph**

Use when animation is opacity-only with no geometric transform.

Two sub-cases depending on whether the animated element and the hover-dimmed
element are the same or separate:

---

#### Method A1 — same element animated and hover-dimmed
**Charts: icicle, treemap, flame graph**

The same `<g>` is both animated on load and dimmed on hover. Must use
`animationend` + `.visible` pattern — `both`/`forwards` fill-mode would
lock an inline animation value that CSS hover rules cannot override.

```css
@keyframes itemFade { from{opacity:0} to{opacity:1} }
.item         { opacity:0; cursor:pointer; transition:opacity .2s ease; }
.item.visible { opacity:1; }

/* hover dimming gated on .ready */
.ca.ready.hovering .item.visible         { opacity:0.20; }
.ca.ready.hovering .item.visible.hovered { opacity:1; }
```

```js
// no fill-mode — animationend clears animation and adds .visible
el.style.animation = 'itemFade 0.5s ease-out ' + delay + 's';
el.addEventListener('animationend', function() {
  el.style.animation = 'none';
  el.classList.add('visible');
}, { once: true });

// one setTimeout gates .ready after last animation finishes
var lastFinish = (lastDelay + duration) * 1000 + 100;
setTimeout(function(){ container.classList.add('ready'); }, lastFinish);
```

---

#### Method A2 — separate nested elements
**Charts: bar, stacked bar, candle**

The animated element (`.bb`) is a child `<g>` nested inside the
hover-dimmed element (`.bw`/`.col-g`/`.cw`). `both` fill-mode only
affects the inner `.bb` opacity — hover dimming targets the outer
element which has no animation on it. No conflict, no `.ready` gate needed.

```css
/* both fill-mode safe — .bb and .bw are separate elements */
@keyframes barFadeIn { from{opacity:0} to{opacity:1} }
.bb { animation: barFadeIn 0.8s ease-out both; }
.b1 { animation-delay:0.00s; } /* etc */

/* no .ready gate needed — animation never touches outer element opacity */
.ca.hovering .item        { opacity:0.20; transition:opacity .2s ease; }
.ca.hovering .item.active { opacity:1; }
```

```html
<!-- outer: hover target -->
<g class="bw b1">
  <!-- inner: animation target -->
  <g class="bb b1">
    <rect .../>
  </g>
  <!-- tooltip inside outer so CSS .bw.active .bubble works -->
  <g class="bubble">...</g>
</g>
```

---

### Method B — JS `requestAnimationFrame`
**Charts: donut, sunburst, candle**

Use when animation involves geometric transformation (rotation, scale) or
per-element stagger with easing that CSS keyframes cannot drive cleanly —
particularly when opacity must animate simultaneously with another property.

**Rule: never set initial `opacity:0` in CSS for rAF-animated elements.**
If CSS sets `opacity:0` and rAF clears it with `el.style.opacity = ''`
at the end, the CSS rule wins and the element disappears again. Initial
hidden state must be set via inline style so `''` truly removes all
opacity control.

**Elements with hover dimming (e.g. slices, candles):**
Clear with `el.style.opacity = ''` at loop end — browser defaults to
`opacity:1` with nothing left to fight CSS hover rules.

```js
// before rAF — set initial state via inline style, not CSS
items.forEach(function(el){ el.style.opacity = '0'; });

// each rAF frame
el.style.opacity = easedValue;

// at loop end — clear so CSS hover takes over, then gate hover
el.style.opacity = '';
container.classList.add('ready');
```

```css
/* no CSS default opacity — browser default opacity:1 takes over after clear */
.item { cursor:pointer; }
.container.ready.hovering .item        { opacity:0.20; transition:opacity .2s ease; }
.container.ready.hovering .item.active { opacity:1;    transition:opacity .2s ease; }
```

**Elements without hover dimming (e.g. hole, decorative):**
Lock at `'1'` at loop end — leaving inline style in place is safe since
no CSS rule needs to override it.

```js
holeEl.style.opacity = '0';        // before rAF
holeEl.style.opacity = easedValue; // each frame
holeEl.style.opacity = '1';        // at loop end — stays as inline, no conflict
```

---

### Method per chart type

| Chart       | Method            | Reason |
|-------------|-------------------|--------|
| Bar         | A2 — nested `@keyframes` | `.bb` inside `.bw`, no conflict |
| Stacked bar | A2 — nested `@keyframes` | `.bb` inside `.col-g`, no conflict |
| Pareto      | A2 — nested `@keyframes` | `.bb` inside `.bw`, same as bar |
| Marimekko   | A1 — `@keyframes` + `.visible` | Same element animated and hover-dimmed |
| Candle      | A2 — nested `@keyframes` | `.bb` inside `.cw`, no conflict |
| Line        | A1 — `@keyframes` + `.visible` | Opacity + stroke-dashoffset (no conflict on dashoffset, but same-element pattern used for consistency) |
| Icicle      | A1 — `@keyframes` + `.visible` | Same element animated and hover-dimmed |
| Treemap     | A1 — `@keyframes` + `.visible` | Same element animated and hover-dimmed |
| Flame graph | A1 — `@keyframes` + `.visible` | Same element animated and hover-dimmed |
| Donut       | B — rAF           | Rotation + opacity together |
| Sunburst    | B — rAF           | Rotation + opacity together |
| Circle packing | A1 — `@keyframes` + `.visible` | Same element animated and hover-dimmed |

---

## 4. Hover Interaction Pattern

All charts share the same hover model: one element stays bright,
all others dim to `0.20`.

### CSS contract

Method A1 (same element animated and hover-dimmed — treemap, marimekko, etc.):
```css
/* gated on .ready — never fires during onload animation */
.container.ready.hovering .item         { opacity:0.20; transition:opacity .2s ease; }
.container.ready.hovering .item.hovered { opacity:1;    transition:opacity .2s ease; }
```

Method A2 (separate nested elements — bar, pareto, etc.):
```css
/* no .ready gate needed — animation is on inner .bb, not outer .bw */
.ca.hovering .bw        { opacity:0.20; transition:opacity .2s ease; }
.ca.hovering .bw.active { opacity:1; }
```

| Token          | Value       | Notes                          |
|----------------|-------------|--------------------------------|
| Dimmed opacity | `0.20`      | Consistent across all charts   |
| Active opacity | `1`         | Hovered element always full    |
| Transition     | `0.2s ease` | Consistent across all charts   |

### JS contract

**Always clear stale `.active`/`.hovered` on mouseenter.** If the user moves quickly between elements without triggering mouseleave (possible with fast cursor movement or overlapping hit targets), the previous element's active class is never removed. This leaves two elements highlighted simultaneously. The `forEach` clear on every mouseenter is not optional:

```js
// mouseenter
items.forEach(function(x){ x.classList.remove('hovered'); }); // clear stale — never omit
container.classList.add('hovering');
item.classList.add('hovered');
showTooltip(x, y, data);

// mouseleave
container.classList.remove('hovering');
item.classList.remove('hovered');
hideTooltip();
```

**`mouseleave` placement — element-level vs container-level.** Where `.hovering` is removed depends on whether hit targets have gaps between them:

- **Element-level `mouseleave`** (default): correct when hit targets have clear gaps. Moving between elements always fires `mouseleave` on the departing element before `mouseenter` on the next, so element-level removal is safe and immediate.
- **Container-level `mouseleave`**: required when hit targets are adjacent or overlapping. Moving between adjacent elements fires the element's `mouseleave` before the next `mouseenter`, momentarily leaving `.hovering` set with no `.active` element — all items flash to `opacity:0.20` simultaneously. Container-level removal prevents this.

| Chart | `mouseleave` on |
|---|---|
| Bar, Pareto, Candle, Line, Tree | Individual element — hit targets have clear gaps |
| Donut, Sunburst, Treemap, Marimekko, Icicle, Radar | Container — adjacent or overlapping hit targets |

### Tooltip bubble classes

Shared across all charts — CSS only, no hex in JS:

```css
.bub-bg  { fill:#FFFBFE; }
.bub-bdr { fill:#FFFBFE; stroke:#79747E; stroke-width:1; }
.bub-tip { fill:#FFFBFE; stroke:#79747E; stroke-width:1; } /* arrow — path or polygon */
.bub-val { fill:#1C1B1F; font-size:13px; font-weight:500; }
.bub-lbl { fill:#49454F; font-size:10px; font-weight:400; }
.bub-pct { fill:#79747E; font-size:10px; font-weight:400; } /* omit only if chart has no pct data at all */

svg.dark .bub-bg  { fill:#1C1B1F; }
svg.dark .bub-bdr { fill:#1C1B1F; stroke:#938F99; }
svg.dark .bub-tip { fill:#1C1B1F; stroke:#938F99; }
svg.dark .bub-val { fill:#E6E0E9; }
svg.dark .bub-lbl { fill:#CAC4D0; }
svg.dark .bub-pct { fill:#938F99; }
```

**`.bub-tip` must never have `fill:none`.** The tail triangle interior must
be filled with the same colour as `.bub-bg` so it appears solid. `fill:none`
leaves the tail transparent, exposing whatever is behind it.

**`.bub-bdr` must be a `<path>`, never a `<rect>`.** A `<rect>` draws a closed border on all four sides, including across the bottom where the tail root connects. This produces a visible stroke line separating the bubble body from the tail, breaking the seamless silhouette.

The correct construction uses three layers:

| Element | Class | Purpose |
|---|---|---|
| `<rect>` | `.bub-bg` | Fills the interior — **no stroke**, just `fill` |
| `<path>` | `.bub-bdr` | Traces the rounded-rect outline **with a gap** at the tail root — stroked but intentionally **not closed** (`Z` omitted) |
| `<path>` | `.bub-tip` | The tail triangle — its two root points match exactly where `.bub-bdr` stopped, so the stroke joins seamlessly |

The border path must start at one side of the tail opening, traverse the full perimeter (top, sides, rounded corners), and end at the other side of the tail opening — leaving the bottom centre open. The tail path plugs that gap. No `Z`, no crossing stroke.

```svg
<!-- bub-bg: solid fill, no stroke — paints the interior -->
<rect x="-hw" y="0" width="hw*2" height="bh" rx="9" class="bub-bg"/>

<!-- bub-bdr: open-bottom path — gap of ±tw at bottom centre.
     Starts at right gap edge, traverses CCW around top, ends at left gap edge.
     hw = half bubble width (from getBBox), bh = bubble height, rx = corner radius, tw = half tail width -->
<path d="M tw,bh  L (hw-rx),bh  Q hw,bh hw,(bh-rx)  L hw,rx  Q hw,0 (hw-rx),0
         L -(hw-rx),0  Q -hw,0 -hw,rx  L -hw,(bh-rx)  Q -hw,bh -(hw-rx),bh  L -tw,bh"
      class="bub-bdr"/>

<!-- bub-tip: tail triangle — root points ±tw,bh match the gap endpoints exactly -->
<path d="M tw,bh  L 0,(bh+tail)  L -tw,bh" class="bub-tip"/>
```

When the bubble is flipped above the bar (not enough headroom), the gap moves to the **top** edge and the tail points upward:

```svg
<!-- Flipped: gap at top, tail points up -->
<path d="M -tw,0  L -(hw-rx),0  Q -hw,0 -hw,rx  L -hw,(bh-rx)  Q -hw,bh -(hw-rx),bh
         L (hw-rx),bh  Q hw,bh hw,(bh-rx)  L hw,rx  Q hw,0 (hw-rx),0  L tw,0"
      class="bub-bdr"/>
<path d="M -tw,0  L 0,-tail  L tw,0" class="bub-tip"/>
```

When `getBBox()` changes `hw`, both the border path and the tail path must be regenerated in JS — the gap endpoints `±tw` are fixed constants, but the rest of the border path scales with `hw`.

**Semantic `.bub-pct` colour.** When `.bub-pct` is used for a semantically
meaningful value (e.g. a cumulative % on a pareto line), override its fill
to match the semantic colour class rather than the default muted grey:

```css
/* Example: pareto chart — cumulative % coloured to match the pareto line */
.bub-pct         { fill:#8B5CF6; font-size:10px; font-weight:500; } /* = bar-5 */
svg.dark .bub-pct { fill:#A78BFA; }                                  /* = bar-5 dark */
```

### Tooltip approaches

Two approaches are used depending on element size and position predictability.

**CSS-driven (bar, pareto)**

Use when elements are large, fixed-position, and the tooltip can be
placed at a predictable offset. No JS opacity needed for simple cases —
CSS parent→child selector handles show/hide.

```css
.bubble              { opacity:0; pointer-events:none; transition:opacity .15s ease; }
.item.active .bubble { opacity:1; }
svg.print .bubble    { opacity:0 !important; }
```

```js
// mouseenter — just toggle classes, CSS does the rest
item.classList.add('active');
container.classList.add('hovering');

// mouseleave
item.classList.remove('active');
container.classList.remove('hovering');
```

**Bubble overlay caveat — layering with other data layers.**
When a chart has additional layers drawn on top of the bar group (e.g. a
pareto cumulative % line), the CSS-driven approach breaks: the bubbles live
inside the bar group and paint before the line, so the line renders on top
of the bubbles.

Fix: extract all `.bubble` groups from their parent `.item` groups into a
dedicated `#bubble-overlay` group placed last in the SVG (after all data
layers). Switch show/hide from CSS to JS inline style:

```html
<!-- Paint order: bars → line/dots → bubble overlay -->
<g class="ca">
  <g class="bw" id="bw1" data-bubble="bub1">
    <g class="bb b1"><rect .../></g>
    <!-- no bubble here -->
  </g>
</g>
<polyline .../>  <!-- line layer -->
<g id="bubble-overlay">
  <g class="bubble" id="bub1" transform="...">...</g>
</g>
```

```js
var bub = document.getElementById(bw.getAttribute('data-bubble'));
bw.addEventListener('mouseenter', function() {
  container.classList.add('hovering');
  bw.classList.add('active');
  if (bub) bub.style.opacity = '1';
});
bw.addEventListener('mouseleave', function() {
  container.classList.remove('hovering');
  bw.classList.remove('active');
  if (bub) bub.style.opacity = '';
});
```

**JS-driven (donut, icicle, line, candle)**

Use when elements are small, densely packed, or at variable positions
where a fixed offset would be unreliable. The tooltip `<g>` lives in
a separate `#tip-layer` rendered above everything else. JS positions
and shows/hides it on each hover event.

```js
// mouseenter
tip.style.opacity = '1';
positionTip(mouseX, mouseY, data);  // clamps x, flips above/below

// mousemove — reposition as cursor moves (omit if tooltip is anchored
// to a fixed element midpoint rather than following the cursor)
positionTip(mouseX, mouseY, data);

// mouseleave
tip.style.opacity = '';  // clear inline style
```

Tooltip x is always clamped: `Math.max(BW/2+8, Math.min(mx, viewBoxW-BW/2-8))`.
Arrow flips above/below based on: `flip = my < BH + TAIL + 20`.

**Which approach per chart type**

| Chart      | Tooltip approach          | Reason |
|------------|--------------------------|--------|
| Bar        | CSS-driven               | Large fixed bars, predictable offset, no layers above bars |
| Pareto     | CSS-driven + overlay     | Large fixed bars, but pareto line renders above bars — needs `#bubble-overlay` |
| Marimekko  | JS-driven (fixed anchor) | Bubble anchored to tile top-center, shown/hidden via inline style |
| Treemap    | JS-driven (fixed anchor) | Bubble anchored to tile top-center, shown/hidden via inline style |
| Line       | JS-driven                | Small dots at variable positions |
| Donut      | JS-driven                | Small slices at variable angles |
| Sunburst   | JS-driven                | Small slices at variable angles — same reason as donut |
| Icicle     | JS-driven                | Small densely-packed cells |
| Candle     | JS-driven (fixed)        | Fixed position per candle, no repositioning needed |
| Radar      | JS-driven (dot anchored) | One bubble per dot; hit targets in separate `#dot-hit-layer` painted last |
| Circle packing | JS-driven (circle anchored) | Circles at variable positions; bubble anchored above each circle's top edge |

### Print mode

```css
svg.print .tip    { opacity:0 !important; }
svg.print .bubble { opacity:0 !important; }
```

---

## 5. Depth-Tinting System (opt-in)

### When to use

| Chart type                  | Use tinting? |
|-----------------------------|-------------|
| Bar, line, scatter          | No — flat `.bar-N` only |
| Donut / pie                 | No — flat `.bar-N` only |
| Icicle, treemap             | **Yes** |
| Sunburst, flame graph       | **Yes** |
| Indented / collapsible tree | **Yes** |
| Circle packing              | **Yes** — depth encodes hierarchy level within the packing |

### CSS additions (hierarchical charts only)

```css
#root {
  --blend-d0: 0.15;
  --blend-d1: 0;
  --blend-d2: 0.45;
  --blend-d3: 0.62;
  --blend-d4: 0.75;
  --bg-light: #FFFBFE;
  --bg-dark:  #2C2B30;
}
```

### Shared JS utility (copy verbatim into any hierarchical chart)

```js
var _probe = null;
function probeColor(cls) {
  if (!_probe) {
    _probe = document.createElementNS(ns, 'rect');
    _probe.style.visibility = 'hidden';
    _probe.style.position   = 'absolute';
    svg.appendChild(_probe);
  }
  _probe.setAttribute('class', cls);
  var fill = window.getComputedStyle(_probe).fill;
  var m = fill.match(/[\d.]+/g);
  return m ? [+m[0], +m[1], +m[2]] : [0, 0, 0];
}

function blendRgb(base, bgHex, t) {
  var bg = hexToRgb(bgHex);
  return 'rgb(' + [0,1,2].map(function(i) {
    return Math.round(base[i] + (bg[i] - base[i]) * t);
  }).join(',') + ')';
}

function hexToRgb(h) {
  var n = parseInt(h.replace('#',''), 16);
  return [(n>>16)&255, (n>>8)&255, n&255];
}

function cssVar(name) {
  return window.getComputedStyle(svg).getPropertyValue(name).trim();
}

function getTint(ci, depth) {
  var base = probeColor('bar-' + ci);
  var t    = parseFloat(cssVar('--blend-d' + Math.min(depth, 4)));
  var bg   = cssVar(isDark ? '--bg-dark' : '--bg-light');
  return blendRgb(base, bg, t);
}
```

### Node data contract

```html
<g class="icell"
   data-ci="3"
   data-depth="2">
```

### Recolor on dark mode toggle

```js
function recolor() {
  cellEls.forEach(function(c) {
    c.r.setAttribute('fill', getTint(c.ci, c.depth));
  });
  buildLegend();
}
```

**`recolor()` vs. full `build()` on dark toggle.** Never call a full DOM rebuild (`build()`) just to change the color mode. `recolor()` is sufficient — it re-reads the CSS vars (which switch with the `.dark` class) and re-blends only the fill attributes. Rebuilding tears down and recreates all elements, which re-triggers the onload animation and discards any hover state.

**Element registry for dynamically-built charts.** For charts where the DOM is built by JS (sunburst, donut) rather than authored as static HTML, `recolor()` needs an array of references populated during `build()`:

```js
var arcEls = [];  // [{el, ci, depth}] — populated in build(), consumed in recolor()

// inside build(), for each arc created:
arcEls.push({ el: pathEl, ci: cat.ci, depth: depth });

// recolor re-reads CSS and patches only fill attrs:
function recolor() {
  arcEls.forEach(function(a) {
    a.el.setAttribute('fill', getTint(a.ci, a.depth));
  });
}
```

The registry must be reset (`arcEls = []`) at the top of `build()` if `build()` is ever called more than once (e.g. data update), so stale references don't accumulate.

### Text contrast on tinted cells

| Depth | Fill opacity | Min size to show label      |
|-------|-------------|-----------------------------|
| L0–L2 | white, 1.0  | 13px height                 |
| L3–L4 | white, 0.85 | 13px height                 |
| Any   | suppress    | < 13px height or < 32px width |

---

## 6. SVG Paint Order

SVG has no z-index — elements paint in document order, last wins.
The required layer stack from bottom to top is:

| Layer | Contents | Notes |
|-------|----------|-------|
| 1 | Grid lines, axes, labels | Always behind data |
| 2 | `.ca` — bars / cells / segments | Hover dimming targets this group |
| 3 | Data overlays | Lines, cumulative % curves, reference marks drawn on top of bars |
| 4 | `#bubble-overlay` | Tooltips always painted last — above everything |

**Rule: bubble groups must always be the last layer painted.**

When no data overlay exists above `.ca`, bubbles may live inside their
`.bw` parent (Method A2 Variant A — CSS-driven show/hide). When any
element is drawn after `.ca` in document order (e.g. a pareto line),
bubbles must be extracted into a separate `#bubble-overlay` group placed
after that element, and shown/hidden via JS inline style instead:

```html
<!-- correct order when a data overlay exists -->
<g class="ca" id="ca">
  <!-- bars — .bw groups with .bb animation children, no .bubble inside -->
</g>

<!-- data overlay — drawn on top of bars -->
<polyline id="pareto-line" .../>
<circle   id="pd1" .../>

<!-- bubble overlay — drawn last, always in front -->
<g id="bubble-overlay">
  <g class="bubble" id="bub1">...</g>
</g>
```

**For JS-built charts (sunburst, donut), `#ca` must wrap both the slice group and the tooltip layer.** The `.ca.ready.hovering .slice` CSS selectors only fire if `.slice` elements are descendants of `#ca`. If the tooltip layer is outside `#ca`, its `.bubble` elements are also outside the hover container — they will not respond to any `.ca`-scoped CSS rules. Both groups must be children of `#ca`:

```html
<!-- correct structure for JS-built charts -->
<g class="ca" id="ca">
  <g id="sunburst" transform="translate(390,336)"/>        <!-- slices built here by JS -->
  <g id="tooltip-layer" transform="translate(390,336)"
     pointer-events="none"/>                               <!-- bubbles built here by JS -->
</g>
```

Placing `#tooltip-layer` outside `#ca` is the most common structural error in dynamically-built charts, and it silently breaks the entire hover architecture.

---

## 7. Iframe Embedding

When a standalone SVG file is loaded as an `<iframe>` inside a grid layout,
`width="100%"` on the `<svg>` element must resolve against the iframe
viewport. Browsers do this correctly only when the SVG's `<style>` block
contains an `@import` rule — this forces the stylesheet to be parsed in full
document mode.

**Always include the Google Fonts `@import` as the first line of `<style>`:**

```svg
<defs>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&amp;display=swap');
    /* rest of styles */
  </style>
</defs>
```

Note the `&amp;` — SVG is XML, so bare `&` in attribute values is illegal
and will cause a parse error (`EntityRef: expecting ';'`). Always escape it.

---

## 8. Card Shell & Layout Grid

Every chart uses an identical card shell and layout grid. Copy verbatim — never invent new dimensions.

### SVG root

```svg
<svg id="root" viewBox="0 0 1100 620" width="100%" height="100%"
     preserveAspectRatio="xMidYMid meet"
     xmlns="http://www.w3.org/2000/svg"
     font-family="'Inter','Helvetica Neue',Arial,sans-serif">
```

### Card background + border rings

```svg
<rect class="bg-main" width="1100" height="620" rx="18"/>
<g class="border-dark">
  <rect x="0.75" y="0.75" width="1098.5" height="618.5" rx="17.5"
        fill="none" stroke="rgba(0,242,255,0.22)" stroke-width="1.5"/>
</g>
<g class="border-light">
  <rect x="0.75" y="0.75" width="1098.5" height="618.5" rx="17.5"
        fill="none" stroke="rgba(0,0,0,0.10)" stroke-width="1.5"/>
</g>
```

The `border-dark` ring is hidden in light mode and shown in dark mode via CSS (see dark mode overrides). Never use a single border rect — the two-ring pattern is required so each mode gets its own stroke colour.

```css
.border-dark  { display:none; }
.border-light { display:block; }
svg.dark .border-dark  { display:block; }
svg.dark .border-light { display:none; }
```

### Typography positions

| Element      | x   | y   | Class  | Notes                        |
|--------------|-----|-----|--------|------------------------------|
| Title        | 68  | 50  | `.ct`  | 18px / 500 / −0.2px tracking |
| Subtitle     | 68  | 70  | `.cs`  | 11px / 400 / muted           |
| Footer       | 68  | 600 | `.footer` | 10px / 400 / muted        |

### Toggle positions

| Toggle  | transform          | id            |
|---------|--------------------|---------------|
| Dark    | translate(930, 52) | `dark-toggle` |
| Print   | translate(1012, 52)| `print-toggle`|

Each toggle is a `<g class="t-wrap">` containing a track rect, thumb circle, and label. Dark uses `.t-track`/`.t-thumb`/`.t-label`. Print uses `.pt-track`/`.pt-thumb`/`.pt-label`.

```svg
<g class="t-wrap" id="dark-toggle" transform="translate(930,52)">
  <rect x="0" y="-13" width="68" height="26" rx="13" class="t-track"/>
  <circle id="tthumb" cx="16" cy="0" r="10" class="t-thumb"/>
  <text id="tlabel" x="44" y="4" class="t-label" text-anchor="middle">Dark</text>
</g>
<g class="t-wrap" id="print-toggle" transform="translate(1012,52)">
  <rect x="0" y="-13" width="68" height="26" rx="13" class="pt-track"/>
  <circle id="pthumb" cx="16" cy="0" r="10" class="pt-thumb"/>
  <text id="plabel" x="44" y="4" class="pt-label" text-anchor="middle">Print</text>
</g>
```

### Plot area

The plot area is bounded by:

| Edge   | Value |
|--------|-------|
| Left   | x = 68  |
| Right  | x = 850 |
| Top    | y = 100 |
| Bottom | y = 500 |

This gives 782 × 400 px. All data elements must fit within this box.
For charts without a y-axis (circle packing, donut, etc.) the full box is still the layout constraint — no element edge should cross these bounds. Center circular charts at the plot area midpoint (`x ≈ 459, y ≈ 300`).

**`x=850` is an outer boundary, not a fill target.** The data area may end before `x=850` when layout requires it — for example, a dual-axis chart may run gridlines and bars only to `x=820`, reserving the `x=820–850` corridor for the secondary axis line and its labels. All elements including those labels must still stay within `x=850`. Secondary axis labels in that corridor are correct, not a violation.

### Legend

The legend panel always sits at x = 870, right edge at x = 1080 (20 px from card edge), starting at y = 100.

```svg
<rect x="870" y="100" width="210" height="[H]" rx="14" class="lgd-bg"/>
<text x="888" y="124" class="lgd-ttl">SERIES TITLE</text>
<!-- first row at y=140, then +30 per row -->
<g transform="translate(888,140)">
  <rect class="bar-N" x="0" y="0" width="14" height="14" rx="3"/>
  <text x="22" y="11" class="lt">Label</text>
  <text x="188" y="11" class="lv lgd-val" text-anchor="end">Value</text>
</g>
```

`lgd-val` is hidden by default and revealed in print mode — never show values in screen mode unless specifically required.

Divider lines between legend sections:
```svg
<line x1="888" y1="[y]" x2="1062" y2="[y]" class="lgd-div"/>
```

### CSS for card shell classes

```css
.bg-main  { fill:#FFFBFE; filter:drop-shadow(0 1px 2px rgba(0,0,0,0.10)); }
.ct       { font-size:18px; font-weight:500; fill:#1C1B1F; letter-spacing:-0.2px; }
.cs       { font-size:11px; fill:#79747E; font-weight:400; }
.lt       { font-size:11px; fill:#1C1B1F; font-weight:400; }
.lv       { font-size:11px; fill:#1C1B1F; font-weight:500; }
.lgd-bg   { fill:#E7E0EC; stroke:#79747E; stroke-width:0.5; }
.lgd-div  { stroke:#79747E; stroke-width:0.5; opacity:0.3; }
.lgd-ttl  { font-size:10px; fill:#79747E; font-weight:500; letter-spacing:0.4px; }
.footer   { font-size:10px; fill:#79747E; font-weight:400; }
.t-wrap   { cursor:pointer; }
.t-track  { fill:#E7E0EC; }
.t-thumb  { fill:#ffffff; }
.t-label  { font-size:11px; font-weight:500; fill:#49454F; }
.pt-track { fill:#E7E0EC; transition:fill 0.3s; }
.pt-thumb { fill:#ffffff; }
.pt-label { font-size:11px; font-weight:500; fill:#49454F; }
.lgd-val  { opacity:0; transition:opacity 0.2s; }
svg.print .lgd-val  { opacity:1; }
svg.print .pt-track { fill:#d97316; }

/* Dark overrides for card shell */
svg.dark .bg-main  { fill:#1C1B1F; filter:drop-shadow(0 1px 4px rgba(0,0,0,0.25)); }
svg.dark .ct       { fill:#E6E0E9; }
svg.dark .cs       { fill:#938F99; }
svg.dark .lt       { fill:#E6E0E9; }
svg.dark .lv       { fill:#E6E0E9; }
svg.dark .lgd-bg   { fill:#49454F; stroke:#938F99; }
svg.dark .lgd-div  { stroke:#938F99; }
svg.dark .lgd-ttl  { fill:#938F99; }
svg.dark .footer   { fill:#938F99; }
svg.dark .t-track  { fill:#49454F; }
svg.dark .t-label  { fill:#CAC4D0; }
svg.dark .pt-track { fill:#49454F; }
svg.dark .pt-label { fill:#CAC4D0; }
svg.dark.print .pt-track { fill:#d97316; }
```

### Full JS toggle pattern (both toggles)

```js
var isDark = false;

function setMode(wantDark) {
  if (wantDark === isDark) return;
  isDark = wantDark;
  var thumb = document.getElementById('tthumb');
  var lbl   = document.getElementById('tlabel');
  if (wantDark) {
    svg.classList.add('dark');
    if (thumb) thumb.setAttribute('cx', '52');
    if (lbl)   lbl.textContent = 'Light';
  } else {
    svg.classList.remove('dark');
    if (thumb) thumb.setAttribute('cx', '16');
    if (lbl)   lbl.textContent = 'Dark';
  }
  // hierarchical charts also call recolor() here
}

document.getElementById('dark-toggle').addEventListener('click', function() { setMode(!isDark); });
document.getElementById('print-toggle').addEventListener('click', function() {
  var thumb = document.getElementById('pthumb'), lbl = document.getElementById('plabel');
  if (svg.classList.toggle('print')) { thumb.setAttribute('cx','52'); lbl.textContent='Screen'; }
  else                               { thumb.setAttribute('cx','16'); lbl.textContent='Print'; }
});

// Inter-frame dark mode sync (for iframe embeds)
window.setMode = setMode;
window.addEventListener('message', function(e) {
  if (e.data && e.data.type === 'setMode') setMode(e.data.dark);
});
setMode(window.location.href.indexOf('theme=dark') !== -1);
```

---

## 9. Tooltip Bubble Sizing

**Never estimate bubble width from character count.** Character-count heuristics (`text.length * 8`) break silently across different labels, font sizes, and zoom levels, causing text to spill outside the border.

**Always use `getBBox()` after setting text content** to measure the actual rendered width, then size the bubble around it.

```js
// Set text content first
tipVal.textContent = val;
tipLbl.textContent = label;

// Then measure actual rendered widths
var pad = 20;
var valW = tipVal.getBBox().width + pad;
var lblW = tipLbl.getBBox().width + pad;
var hw   = Math.max(valW, lblW, 60) / 2;  // half-width, minimum 60px total
```

The bubble rect and border path are then both sized to `hw * 2` wide. This is guaranteed to fit regardless of content.

### JS-driven bubble coordinate system

For JS-driven tooltips (circles, donuts, variable-position elements), use the following local coordinate convention consistently:

- The tip `<g>` is translated to `(tx, ty)` where `ty` is the **top edge** of the bubble rect.
- The rect draws **downward** from `y=0` to `y=bh` in local coordinates.
- The arrow tail extends **below** the rect (at `y=bh`) pointing toward the element below.

```
  ┌─────────────┐  ← ty (translate y) = local y=0
  │   val text  │
  │   lbl text  │
  └──────┬──────┘  ← local y=bh
         │ tail
         ▼ arrow tip touches element top edge
```

This means:
```js
var ty = cy - r - tail - bh - 4;  // bubble top = circle top minus tail minus bubble height
```

**NOT** `cy - r` (that places the origin at the circle top, with the bubble drawn upward using negative y, which is harder to reason about and prone to sign errors).

When flipping below the element (not enough headroom):
```js
var flip = ty < 90;  // 90 = top of plot area + some margin
if (flip) ty = cy + r + tail + 4;  // bubble top = circle bottom plus tail
// arrow points up from y=0 edge instead of down from y=bh
```

### Viewbox clamping

Always clamp `tx` so the bubble never exits the left or right card edge:

```js
var tx = Math.max(hw + 8, Math.min(cx, 1100 - hw - 8));
```

---

## 10. Animation Timing Reference

Duration and easing are fixed for all charts. Stagger has a maximum of `0.25s` but must scale down when element count is large.

| Parameter      | Value  | Notes                                      |
|----------------|--------|--------------------------------------------|
| Duration       | `0.8s` | Fixed — `itemFade` / `barFadeIn` duration  |
| Stagger        | `min(0.25, 1.0 / count)` | 0.25s max; scale down for large counts |
| Easing         | `ease-out` | Fixed — consistent across all charts   |
| `.ready` delay | `(lastDelay + duration + 0.1) * 1000` ms | 100ms buffer after last animation |

### Standard case — small element count

For charts with few elements (e.g. 8-bar chart), the full `0.25s` stagger applies and produces the intended cadence (1.75s total spread):

```js
// Standard — small count, full stagger
var duration  = 0.8;
var stagger   = 0.25;
var lastDelay = (items.length - 1) * stagger;

items.forEach(function(el, i) {
  el.style.animation = 'itemFade ' + duration + 's ease-out ' + (i * stagger) + 's';
  el.addEventListener('animationend', function() {
    el.style.animation = 'none';
    el.classList.add('visible');
  }, { once: true });
});

setTimeout(function() {
  container.classList.add('ready');
}, (lastDelay + duration + 0.1) * 1000);
```

### Adaptive case — large element count

When element count is large (e.g. a 30-bar chart, or a dense icicle column with 50+ cells), a fixed `0.25s` stagger produces an unacceptably long animation — 50 elements × 0.25s = 12.5s before the last element appears. Cap the total spread at ~1s by scaling the stagger down:

```js
// Adaptive — large count, stagger scales to fit ~1s window
var duration  = 0.8;
var WINDOW    = 1.0;  // max spread duration in seconds
var stagger   = Math.min(0.25, WINDOW / items.length);
var lastDelay = (items.length - 1) * stagger;

items.forEach(function(el, i) {
  el.style.animation = 'itemFade ' + duration + 's ease-out ' + (i * stagger).toFixed(2) + 's';
  el.addEventListener('animationend', function() {
    el.style.animation = 'none';
    el.classList.add('visible');
  }, { once: true });
});

setTimeout(function() {
  container.classList.add('ready');
}, (lastDelay + duration + 0.1) * 1000);
```

This formula is self-correcting: for 8 elements `min(0.25, 1.0/8) = 0.125` — still fast and comfortable. For 50 elements `min(0.25, 1.0/50) = 0.02` — the full column spreads in 1s. Duration and easing never change.

**Do not shorten duration** — only stagger adapts. The 0.8s per-element fade is a deliberate design choice that remains consistent regardless of element count.

---

## 11. Guiding Principles

These apply across every section and every chart type.

* **CSS owns styling; JS owns behavior.** If JS is mutating colors, fills, or opacities outside of the animation loop, that is a signal that something belongs in CSS instead.
* **Never duplicate state between DOM and JS.** `isDark` is the source of truth for dark mode — never re-read it from `classList`. The DOM reflects state; it does not define it.
* **Prefer structure over mutation.** The A1 animation pattern (`.visible` class + CSS state) is cleaner than mutating inline styles after the fact. The depth-tinting `recolor()` pattern mutates only fill attributes — it never rebuilds the DOM.
* **Protect hover consistency at all times.** The stale-clear on `mouseenter` is never optional. Two elements highlighted simultaneously is always a bug, and it always comes from a missing stale-clear or a wrong `mouseleave` placement.
* **Always support both light and dark mode from the start.** Dark mode added as an afterthought produces `swapColors()`-style JS hacks. Built-in from the start, it is purely a CSS class toggle with zero JS color logic.
* **Layout spacing is as important as visual correctness.** A chart that renders correctly but clips into the title zone, misplaces the footer, or expands into the legend area fails the standard even if the data rendering is perfect.
