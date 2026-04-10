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

> **Pure SVG charts** (no outer HTML document) use `#root.dark .bar-N`
> instead of `svg.dark .bar-N` — necessary divergence, same intent.

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

```js
function setMode(wantDark) {
  if (wantDark === isDark) return;
  isDark = wantDark;
  if (wantDark) { svg.classList.add('dark'); thumb.setAttribute('cx','52'); lbl.textContent='Light'; }
  else          { svg.classList.remove('dark'); thumb.setAttribute('cx','16'); lbl.textContent='Dark'; }
  // hierarchical charts also call recolor() here to re-read CSS and reblend tints
}
```

---

## 3. Onload Animation Pattern

Two strategies are used. The choice depends on whether the animation
is purely opacity-based or involves geometric transformation alongside opacity.

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
| Candle      | A2 — nested `@keyframes` | `.bb` inside `.cw`, no conflict |
| Line        | A1 — `@keyframes` + `.visible` | Opacity + stroke-dashoffset (no conflict on dashoffset, but same-element pattern used for consistency) |
| Icicle      | A1 — `@keyframes` + `.visible` | Same element animated and hover-dimmed |
| Treemap     | A1 — `@keyframes` + `.visible` | Same element animated and hover-dimmed |
| Flame graph | A1 — `@keyframes` + `.visible` | Same element animated and hover-dimmed |
| Donut       | B — rAF           | Rotation + opacity together |
| Sunburst    | B — rAF           | Rotation + opacity together |

---

## 4. Hover Interaction Pattern

All charts share the same hover model: one element stays bright,
all others dim to `0.20`.

### CSS contract

```css
/* gated on .ready — never fires during onload animation */
.container.ready.hovering .item         { opacity:0.20; transition:opacity .2s ease; }
.container.ready.hovering .item.hovered { opacity:1;    transition:opacity .2s ease; }
```

| Token          | Value       | Notes                          |
|----------------|-------------|--------------------------------|
| Dimmed opacity | `0.20`      | Consistent across all charts   |
| Active opacity | `1`         | Hovered element always full    |
| Transition     | `0.2s ease` | Consistent across all charts   |

### JS contract

```js
// mouseenter
container.classList.add('hovering');
items.forEach(function(x){ x.classList.remove('hovered'); }); // clear stale
item.classList.add('hovered');
showTooltip(x, y, data);

// mouseleave
container.classList.remove('hovering');
item.classList.remove('hovered');
hideTooltip();
```

### Tooltip bubble classes

Shared across all charts — CSS only, no hex in JS:

```css
.bub-bg  { fill:#FFFBFE; }
.bub-bdr { fill:#FFFBFE; stroke:#79747E; stroke-width:1; }
.bub-tip { fill:#FFFBFE; stroke:#79747E; stroke-width:1; } /* arrow — path or polygon */
.bub-val { fill:#1C1B1F; font-size:13px; font-weight:500; }
.bub-lbl { fill:#49454F; font-size:10px; font-weight:400; }
.bub-pct { fill:#79747E; font-size:10px; font-weight:400; } /* optional — omit if no pct */

svg.dark .bub-bg  { fill:#1C1B1F; }
svg.dark .bub-bdr { fill:#1C1B1F; stroke:#938F99; }
svg.dark .bub-tip { fill:#1C1B1F; stroke:#938F99; }
svg.dark .bub-val { fill:#E6E0E9; }
svg.dark .bub-lbl { fill:#CAC4D0; }
svg.dark .bub-pct { fill:#938F99; }
```

### Tooltip approaches

Two approaches are used depending on element size and position predictability.

**CSS-driven (bar chart)**

Use when elements are large, fixed-position, and the tooltip can be
placed at a predictable offset. The tooltip `<g>` lives inside the
item group. No JS opacity needed — CSS parent→child selector handles
show/hide.

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

Limitations: tooltip position is fixed at build time. Does not suit
small or densely packed elements where the fixed offset may overlap
other content.

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

| Chart   | Tooltip approach | Reason |
|---------|-----------------|--------|
| Bar     | CSS-driven      | Large fixed bars, predictable offset |
| Line    | JS-driven       | Small dots at variable positions |
| Donut   | JS-driven       | Small slices at variable angles |
| Icicle  | JS-driven       | Small densely-packed cells |
| Candle  | JS-driven (fixed) | Fixed position per candle, no repositioning needed |

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

### Text contrast on tinted cells

| Depth | Fill opacity | Min size to show label      |
|-------|-------------|-----------------------------|
| L0–L2 | white, 1.0  | 13px height                 |
| L3–L4 | white, 0.85 | 13px height                 |
| Any   | suppress    | < 13px height or < 32px width |
