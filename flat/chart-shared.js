/* ── chart-shared.js ──────────────────────────────────────────────────────────
   initChart(svgEl) — wire dark/print toggles for one SVG chart.

   Each SVG loads this file via <script href="chart-shared.js"> and calls:
     bootstrapChart(svg);   // at end of its own IIFE

   Each SVG's <script> registers chart-specific logic before that call:
     svg._chartInit    = function(svgEl, ctx) { ... }   // required
     svg._onModeChange = function(wantDark)   { ... }   // optional (gradients etc.)

   ctx helpers: ctx.$$(sel) → querySelector, ctx.$$all(sel) → querySelectorAll[]
   ──────────────────────────────────────────────────────────────────────────── */
(function (global) {
  'use strict';

  function initChart(svgEl) {
    if (!svgEl || svgEl.__chartSharedInitialized) return;
    svgEl.__chartSharedInitialized = true;

    var isDark = false;

    /* Scoped query helpers passed to _chartInit */
    function $$(sel)    { return svgEl.querySelector(sel); }
    function $$all(sel) { return Array.prototype.slice.call(svgEl.querySelectorAll(sel)); }

    /* Dark-mode toggle — updates class, thumb position, label text */
    function setMode(wantDark) {
      if (wantDark === isDark) return;
      isDark = wantDark;
      svgEl.classList.toggle('dark', wantDark);
      var thumb = $$('#tthumb'), lbl = $$('#tlabel');
      if (thumb) thumb.setAttribute('cx', wantDark ? '52' : '16');
      if (lbl)   lbl.textContent = wantDark ? 'Light' : 'Dark';
      /* Notify chart-specific code (gradient recolor, band tint, etc.) */
      if (typeof svgEl._onModeChange === 'function') svgEl._onModeChange(wantDark);
    }

    /* Dark toggle click */
    var dt = $$('#dark-toggle');
    if (dt) dt.addEventListener('click', function () { setMode(!isDark); });

    /* Print toggle click */
    var pt = $$('#print-toggle');
    if (pt) pt.addEventListener('click', function () {
      var thumb = $$('#pthumb'), lbl = $$('#plabel');
      var on = svgEl.classList.toggle('print');
      if (thumb) thumb.setAttribute('cx', on ? '52' : '16');
      if (lbl)   lbl.textContent = on ? 'Screen' : 'Print';
    });

    /* Run chart-specific init (animations, tooltip geometry, hover wiring) */
    if (typeof svgEl._chartInit === 'function') {
      svgEl._chartInit(svgEl, { $$: $$, $$all: $$all });
    }

    /* Apply initial dark state — portal adds class="dark" before calling initChart */
    setMode(svgEl.classList.contains('dark'));
  }

  function bootstrapChart(svgEl) {
    if (!svgEl) return;
    if (window.location.href.indexOf('theme=dark') !== -1) {
      svgEl.classList.add('dark');
    }
    initChart(svgEl);
  }

  global.initChart = initChart;
  global.bootstrapChart = bootstrapChart;

  /* Fallback auto-init for charts that have not yet switched to explicit startup. */
  window.addEventListener('load', function () { bootstrapChart(document.documentElement); });
}(window));
