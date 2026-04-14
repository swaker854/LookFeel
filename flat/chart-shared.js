/* chart-shared.js
   Shared bootstrap for flat SVG charts.

   Each SVG loads this file via <script href="chart-shared.js"> and calls:
     bootstrapChart(svg);

   Optional hooks on each SVG:
     svg._chartInit(svgEl, ctx)
     svg._onModeChange(wantDark)
*/
(function (global) {
  'use strict';

  var DEFAULT_LIGHT_PALETTE = ['#00D4E8', '#00B87A', '#F59E0B', '#F43F5E', '#8B5CF6', '#3B82F6', '#0D9488', '#64748B'];
  var DEFAULT_DARK_PALETTE = ['#22D3EE', '#10B981', '#FBB724', '#FB6181', '#A78BFA', '#60A5FA', '#2DD4BF', '#94A3B8'];
  var TONE_STEPS = [
    { lightness: 0.00, saturation: 0.00 },
    { lightness: 0.10, saturation: -0.04 },
    { lightness: -0.10, saturation: 0.03 },
    { lightness: 0.18, saturation: -0.10 }
  ];

  function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
  }

  function hexToRgb(hex) {
    var raw = (hex || '').replace('#', '').trim();
    if (raw.length === 3) raw = raw.replace(/(.)/g, '$1$1');
    if (raw.length !== 6) return null;
    return {
      r: parseInt(raw.slice(0, 2), 16),
      g: parseInt(raw.slice(2, 4), 16),
      b: parseInt(raw.slice(4, 6), 16)
    };
  }

  function rgbToHsl(rgb) {
    var r = rgb.r / 255;
    var g = rgb.g / 255;
    var b = rgb.b / 255;
    var max = Math.max(r, g, b);
    var min = Math.min(r, g, b);
    var h = 0;
    var s = 0;
    var l = (max + min) / 2;

    if (max !== min) {
      var d = max - min;
      s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
      switch (max) {
        case r: h = (g - b) / d + (g < b ? 6 : 0); break;
        case g: h = (b - r) / d + 2; break;
        default: h = (r - g) / d + 4; break;
      }
      h /= 6;
    }

    return { h: h, s: s, l: l };
  }

  function hslToRgb(hsl) {
    var h = hsl.h;
    var s = hsl.s;
    var l = hsl.l;

    if (s === 0) {
      var gray = Math.round(l * 255);
      return { r: gray, g: gray, b: gray };
    }

    function hueToRgb(p, q, t) {
      if (t < 0) t += 1;
      if (t > 1) t -= 1;
      if (t < 1 / 6) return p + (q - p) * 6 * t;
      if (t < 1 / 2) return q;
      if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
      return p;
    }

    var q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    var p = 2 * l - q;

    return {
      r: Math.round(hueToRgb(p, q, h + 1 / 3) * 255),
      g: Math.round(hueToRgb(p, q, h) * 255),
      b: Math.round(hueToRgb(p, q, h - 1 / 3) * 255)
    };
  }

  function rgbToHex(rgb) {
    function channel(value) {
      var hex = value.toString(16);
      return hex.length === 1 ? '0' + hex : hex;
    }

    return '#' + channel(rgb.r) + channel(rgb.g) + channel(rgb.b);
  }

  function shiftTone(hex, toneIndex, wantDark) {
    var rgb = hexToRgb(hex);
    if (!rgb) return hex;

    var hsl = rgbToHsl(rgb);
    var tone = TONE_STEPS[toneIndex % TONE_STEPS.length];
    var cycle = Math.floor(toneIndex / TONE_STEPS.length);
    var cycleBump = cycle * (wantDark ? 0.05 : 0.04);

    hsl.l = clamp(hsl.l + tone.lightness + cycleBump, wantDark ? 0.26 : 0.18, wantDark ? 0.82 : 0.88);
    hsl.s = clamp(hsl.s + tone.saturation - cycle * 0.02, 0.18, 0.95);
    return rgbToHex(hslToRgb(hsl));
  }

  function resolveBaseColors(baseColors, wantDark) {
    if (!baseColors || !baseColors.length) {
      return (wantDark ? DEFAULT_DARK_PALETTE : DEFAULT_LIGHT_PALETTE).slice();
    }

    return baseColors.map(function (color) {
      return wantDark ? shiftTone(color, 1, true) : color;
    });
  }

  function extractSeriesCount(svgEl) {
    var max = 0;

    Array.prototype.forEach.call(svgEl.querySelectorAll('[class]'), function (node) {
      Array.prototype.forEach.call(node.classList, function (name) {
        var match = /^series-(\d+)$/.exec(name);
        if (match) max = Math.max(max, parseInt(match[1], 10));
      });
    });

    return Math.max(max, 8);
  }

  function buildPalette(baseColors, count, wantDark) {
    var colors = resolveBaseColors(baseColors, wantDark);
    var resolved = [];
    var i;

    for (i = 0; i < count; i++) {
      var base = colors[i % colors.length];
      var toneIndex = Math.floor(i / colors.length);
      resolved.push(toneIndex === 0 ? base : shiftTone(base, toneIndex, wantDark));
    }

    return resolved;
  }

  function applyPalette(svgEl, colors, wantDark) {
    var count = Math.max(extractSeriesCount(svgEl), 24);
    var resolved = buildPalette(colors, count, wantDark);

    resolved.forEach(function (color, index) {
      var seriesName = '.series-' + (index + 1);
      svgEl.style.setProperty('--series-' + (index + 1), color);
      Array.prototype.forEach.call(svgEl.querySelectorAll(seriesName), function (node) {
        var computed;
        if (node.hasAttribute('data-ci') || node.getAttribute('data-arc') === 'o') return;
        if (node.__chartUsesFill == null || node.__chartUsesStroke == null) {
          computed = global.getComputedStyle ? global.getComputedStyle(node) : null;
          node.__chartUsesFill = !!(computed && computed.fill && computed.fill !== 'none');
          node.__chartUsesStroke = !!(computed && computed.stroke && computed.stroke !== 'none');
        }
        if (node.__chartUsesFill) node.style.fill = color;
        if (node.__chartUsesStroke) node.style.stroke = color;
      });
    });

    svgEl.__chartPalette = colors && colors.length ? colors.slice() : null;
  }

  function initChart(svgEl) {
    if (!svgEl || svgEl.__chartSharedInitialized) return;
    svgEl.__chartSharedInitialized = true;

    var isDark = false;
    var isPrint = svgEl.classList.contains('print');

    function $$(sel) { return svgEl.querySelector(sel); }
    function $$all(sel) { return Array.prototype.slice.call(svgEl.querySelectorAll(sel)); }

    function setMode(wantDark) {
      if (wantDark === isDark) return;
      isDark = wantDark;
      svgEl.classList.toggle('dark', wantDark);
      applyPalette(svgEl, svgEl.__chartPalette, wantDark);

      var thumb = $$('#tthumb');
      var lbl = $$('#tlabel');
      if (thumb) thumb.setAttribute('cx', wantDark ? '52' : '16');
      if (lbl) lbl.textContent = wantDark ? 'Light' : 'Dark';

      if (typeof svgEl._onModeChange === 'function') svgEl._onModeChange(wantDark);
    }

    function setPrint(wantPrint) {
      if (wantPrint === isPrint) return;
      isPrint = wantPrint;
      svgEl.classList.toggle('print', wantPrint);

      var thumb = $$('#pthumb');
      var lbl = $$('#plabel');
      if (thumb) thumb.setAttribute('cx', wantPrint ? '52' : '16');
      if (lbl) lbl.textContent = wantPrint ? 'Screen' : 'Print';
    }

    var dt = $$('#dark-toggle');
    if (dt) dt.addEventListener('click', function () { setMode(!isDark); });

    var pt = $$('#print-toggle');
    if (pt) pt.addEventListener('click', function () { setPrint(!isPrint); });

    if (typeof svgEl._chartInit === 'function') {
      svgEl._chartInit(svgEl, { $$: $$, $$all: $$all });
    }

    applyPalette(svgEl, svgEl.__chartPalette, svgEl.classList.contains('dark'));
    setMode(svgEl.classList.contains('dark'));
    setPrint(svgEl.classList.contains('print'));

    window.addEventListener('message', function (e) {
      var colors;

      if (!e.data || typeof e.data !== 'object') return;
      if (e.data.type === 'setMode') setMode(!!e.data.dark);
      if (e.data.type === 'setPrint') setPrint(!!e.data.print);
      if (e.data.type === 'setPalette') {
        colors = Array.isArray(e.data.colors) ? e.data.colors.filter(Boolean) : [];
        svgEl.__chartPalette = colors.length ? colors : null;
        applyPalette(svgEl, svgEl.__chartPalette, isDark);
      }
    });
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
  global.applyChartPalette = applyPalette;

  window.addEventListener('load', function () {
    bootstrapChart(document.documentElement);
  });
}(window));
