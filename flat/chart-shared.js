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

  /*
   * buildChartTip(ancX, ancY, bw, bh, plotL, plotR, plotT, plotB)
   *
   * Computes a smart tooltip position that:
   *  - stays inside the plot area (plotL/R/T/B)
   *  - places the box above or below the anchor, choosing the side with more room
   *  - generates the rounded-rect border path (with tail gap) and tail triangle path
   *
   * Returns { bL, bT, bR, bB, bCx, tailUp, borderPath, tailPath }
   *   bL/bT/bR/bB  – absolute SVG coords of the tooltip box corners
   *   tailUp        – true when tail is at the top of the box (box below anchor)
   *   borderPath    – SVG path d string for the open-sided rounded rect
   *   tailPath      – SVG path d string for the tail triangle
   *
   * Internal geometry constants (not exposed so callers stay simple):
   *   rx=12  corner radius
   *   tw=10  half-width of the tail opening on the box edge
   *   TAIL=12  length of the tail triangle
   */
  function buildChartTip(ancX, ancY, bw, bh, plotL, plotR, plotT, plotB) {
    var rx = 12, tw = 10, TAIL = 12;
    var hw = bw / 2;

    // Horizontal: center on anchor, clamp to plot bounds
    var bCx = Math.min(Math.max(ancX, plotL + hw), plotR - hw);

    // Vertical: prefer the side with more room
    var tailUp = (plotB - ancY) >= (ancY - plotT);
    var bT, bB;
    if (tailUp) {
      bT = ancY + TAIL; bB = bT + bh;
      if (bB > plotB) { bB = plotB; bT = bB - bh; }
      if (bT < plotT) { bT = plotT; bB = bT + bh; }
    } else {
      bB = ancY - TAIL; bT = bB - bh;
      if (bT < plotT) { bT = plotT; bB = bT + bh; }
      if (bB > plotB) { bB = plotB; bT = bB - bh; }
    }
    // Safety flip if clamping caused the box to engulf the anchor
    if (tailUp && ancY >= bT) {
      tailUp = false; bB = ancY - TAIL; bT = bB - bh;
      if (bT < plotT) { bT = plotT; bB = bT + bh; }
    } else if (!tailUp && ancY <= bB) {
      tailUp = true; bT = ancY + TAIL; bB = bT + bh;
      if (bB > plotB) { bB = plotB; bT = bB - bh; }
    }

    var bL = bCx - hw, bR = bCx + hw;
    // Tail X: track anchor but stay clear of rounded corners
    var tX = Math.max(bL + rx + tw, Math.min(bR - rx - tw, ancX));

    var op, tp;
    if (tailUp) {
      // Tail at top of box, pointing up to anchor
      op = 'M'+(tX-tw)+','+bT+' L'+(bL+rx)+','+bT+' Q'+bL+','+bT+' '+bL+','+(bT+rx)+
           ' L'+bL+','+(bB-rx)+' Q'+bL+','+bB+' '+(bL+rx)+','+bB+
           ' L'+(bR-rx)+','+bB+' Q'+bR+','+bB+' '+bR+','+(bB-rx)+
           ' L'+bR+','+(bT+rx)+' Q'+bR+','+bT+' '+(bR-rx)+','+bT+' L'+(tX+tw)+','+bT;
      tp = 'M'+(tX+tw)+','+bT+' L'+tX+','+ancY+' L'+(tX-tw)+','+bT;
    } else {
      // Tail at bottom of box, pointing down to anchor
      op = 'M'+(tX+tw)+','+bB+' L'+(bR-rx)+','+bB+' Q'+bR+','+bB+' '+bR+','+(bB-rx)+
           ' L'+bR+','+(bT+rx)+' Q'+bR+','+bT+' '+(bR-rx)+','+bT+
           ' L'+(bL+rx)+','+bT+' Q'+bL+','+bT+' '+bL+','+(bT+rx)+
           ' L'+bL+','+(bB-rx)+' Q'+bL+','+bB+' '+(bL+rx)+','+bB+' L'+(tX-tw)+','+bB;
      tp = 'M'+(tX-tw)+','+bB+' L'+tX+','+ancY+' L'+(tX+tw)+','+bB;
    }

    return { bL: bL, bT: bT, bR: bR, bB: bB, bCx: bCx, tailUp: tailUp, borderPath: op, tailPath: tp };
  }

  function createSvgEl(tag, attrs) {
    var e = document.createElementNS('http://www.w3.org/2000/svg', tag);
    Object.keys(attrs || {}).forEach(function (key) {
      e.setAttribute(key, attrs[key]);
    });
    return e;
  }

  function setClassState(nodes, className, active) {
    Array.prototype.slice.call(nodes || []).forEach(function (node) {
      if (!node) return;
      node.classList.toggle(className, !!active);
    });
  }

  function activateExclusive(nodes, activeNode, className) {
    var cls = className || 'active';
    Array.prototype.slice.call(nodes || []).forEach(function (node) {
      if (!node) return;
      node.classList.toggle(cls, node === activeNode);
    });
  }

  function setElementsActive(nodes, predicate, className) {
    var cls = className || 'active';
    Array.prototype.slice.call(nodes || []).forEach(function (node, index) {
      if (!node) return;
      node.classList.toggle(cls, !!predicate(node, index));
    });
  }

  function setOpacity(node, value) {
    if (!node) return;
    node.style.opacity = value == null ? '' : String(value);
  }

  function eventToSvgPoint(svgEl, event) {
    var pt = svgEl.createSVGPoint();
    pt.x = event.clientX;
    pt.y = event.clientY;
    return pt.matrixTransform(svgEl.getScreenCTM().inverse());
  }

  function clearTooltipContent(tipG) {
    Array.prototype.slice.call(tipG.querySelectorAll('[data-tip-line],[data-tip-divider]')).forEach(function (node) {
      if (node && node.parentNode) node.parentNode.removeChild(node);
    });
  }

  function ensureTooltipChrome(tipG, rx) {
    var bg = tipG.querySelector('[data-tip-role="bg"]');
    var border = tipG.querySelector('[data-tip-role="border"]');
    var tail = tipG.querySelector('[data-tip-role="tail"]');
    if (!bg) {
      bg = createSvgEl('rect', { 'class': 'tip-bg', rx: String(rx || 12), 'data-tip-role': 'bg' });
      tipG.insertBefore(bg, tipG.firstChild || null);
    } else {
      bg.setAttribute('rx', String(rx || 12));
    }
    if (!border) {
      border = createSvgEl('path', { 'class': 'tip-border', 'data-tip-role': 'border' });
      tipG.insertBefore(border, bg.nextSibling);
    }
    if (!tail) {
      tail = createSvgEl('path', { 'class': 'tip-tail', 'data-tip-role': 'tail' });
      tipG.insertBefore(tail, border.nextSibling);
    }
    return { bg: bg, border: border, tail: tail };
  }

  function buildSideTooltipChrome(anchorX, anchorY, bw, bh, plotL, plotR, plotT, plotB, anchorInset, gap, rx, tw) {
    var spaceR = plotR - anchorX;
    var spaceL = anchorX - plotL;
    var goRight = spaceR >= spaceL;
    var ancX = goRight ? anchorX + anchorInset : anchorX - anchorInset;
    var bL, bR;
    if (goRight) {
      bL = ancX + gap;
      bR = bL + bw;
    } else {
      bR = ancX - gap;
      bL = bR - bw;
    }

    var bT = anchorY - bh / 2;
    var bB = bT + bh;
    if (bT < plotT) { bT = plotT; bB = bT + bh; }
    if (bB > plotB) { bB = plotB; bT = bB - bh; }
    var tY = Math.max(bT + rx + tw, Math.min(bB - rx - tw, anchorY));
    var borderPath, tailPath;

    if (goRight) {
      borderPath = 'M' + bL + ',' + (tY - tw) +
        ' L' + bL + ',' + (bT + rx) + ' Q' + bL + ',' + bT + ' ' + (bL + rx) + ',' + bT +
        ' L' + (bR - rx) + ',' + bT + ' Q' + bR + ',' + bT + ' ' + bR + ',' + (bT + rx) +
        ' L' + bR + ',' + (bB - rx) + ' Q' + bR + ',' + bB + ' ' + (bR - rx) + ',' + bB +
        ' L' + (bL + rx) + ',' + bB + ' Q' + bL + ',' + bB + ' ' + bL + ',' + (bB - rx) +
        ' L' + bL + ',' + (tY + tw);
      tailPath = 'M' + bL + ',' + (tY + tw) + ' L' + ancX + ',' + anchorY + ' L' + bL + ',' + (tY - tw);
    } else {
      borderPath = 'M' + bR + ',' + (tY + tw) +
        ' L' + bR + ',' + (bB - rx) + ' Q' + bR + ',' + bB + ' ' + (bR - rx) + ',' + bB +
        ' L' + (bL + rx) + ',' + bB + ' Q' + bL + ',' + bB + ' ' + bL + ',' + (bB - rx) +
        ' L' + bL + ',' + (bT + rx) + ' Q' + bL + ',' + bT + ' ' + (bL + rx) + ',' + bT +
        ' L' + (bR - rx) + ',' + bT + ' Q' + bR + ',' + bT + ' ' + bR + ',' + (bT + rx) +
        ' L' + bR + ',' + (tY - tw);
      tailPath = 'M' + bR + ',' + (tY - tw) + ' L' + ancX + ',' + anchorY + ' L' + bR + ',' + (tY + tw);
    }

    return {
      bL: bL, bR: bR, bT: bT, bB: bB, bw: bw, bh: bh, goRight: goRight, ancX: ancX, tY: tY,
      borderPath: borderPath, tailPath: tailPath
    };
  }

  function layoutSideTooltip(tipG, opts) {
    var lines = (opts.lines || []).slice();
    var padX = opts.paddingX != null ? opts.paddingX : 20;
    var padY = opts.paddingY != null ? opts.paddingY : 18;
    var lineHeights = opts.lineHeights || lines.map(function (line) {
      return line.className === 'tip-value' ? 42 : 32;
    });
    var minWidth = opts.minWidth != null ? opts.minWidth : 220;
    var gap = opts.gap != null ? opts.gap : 14;
    var rx = opts.rx != null ? opts.rx : 12;
    var tw = opts.tw != null ? opts.tw : 10;
    var chrome = ensureTooltipChrome(tipG, rx);

    clearTooltipContent(tipG);

    var textEls = lines.map(function (line, index) {
      var attrs = {
        'class': line.className || 'tip-label',
        'data-tip-line': '1',
        'dominant-baseline': 'central'
      };
      attrs['text-anchor'] = line.align === 'start' ? 'start' : 'middle';
      if (line.fontSize) attrs['font-size'] = String(line.fontSize);
      if (line.fontWeight) attrs['font-weight'] = String(line.fontWeight);
      var textEl = createSvgEl('text', attrs);
      textEl.textContent = line.text;
      tipG.appendChild(textEl);
      return textEl;
    });

    var maxWidth = 0;
    textEls.forEach(function (textEl) {
      maxWidth = Math.max(maxWidth, textEl.getBBox().width);
    });
    var bw = Math.max(maxWidth + padX * 2, minWidth);
    var bh = padY * 2 + lineHeights.reduce(function (sum, h) { return sum + h; }, 0);
    var geom = buildSideTooltipChrome(
      opts.anchorX, opts.anchorY, bw, bh,
      opts.plotL, opts.plotR, opts.plotT, opts.plotB,
      opts.anchorInset || 0, gap, rx, tw
    );

    chrome.bg.setAttribute('x', String(geom.bL));
    chrome.bg.setAttribute('y', String(geom.bT));
    chrome.bg.setAttribute('width', String(bw));
    chrome.bg.setAttribute('height', String(bh));
    chrome.border.setAttribute('d', geom.borderPath);
    chrome.tail.setAttribute('d', geom.tailPath);

    var y = geom.bT + padY;
    textEls.forEach(function (textEl, index) {
      var lh = lineHeights[index];
      var align = lines[index].align === 'start' ? 'start' : 'middle';
      textEl.setAttribute('x', String(align === 'start' ? geom.bL + padX : geom.bL + bw / 2));
      textEl.setAttribute('y', String(y + lh / 2));
      y += lh;
    });

    return geom;
  }

  function buildStackedSideTooltip(tipLayer, opts) {
    var PAD = 22, DOT_R = 5, DOT_X = 20, LBL_X = 38, rx = 12;
    var rowH = 42, hdrH = 38, divH = 12, totH = 46;
    var rows = opts.rows || [];
    var bh = hdrH + divH + rows.length * rowH + divH + totH + PAD;
    var tipG = createSvgEl('g', { 'class': 'tip', id: opts.id || '' });
    tipLayer.appendChild(tipG);

    var chrome = ensureTooltipChrome(tipG, rx);
    var qLbl = createSvgEl('text', { 'text-anchor':'middle', 'dominant-baseline':'central', 'class':'tip-label', 'data-tip-line':'1' });
    qLbl.textContent = opts.header || '';
    tipG.appendChild(qLbl);

    var rowEls = rows.map(function (row) {
      var dot  = createSvgEl('circle', { cx:'0', cy:'0', r:DOT_R, 'class': row.cls || '', 'style':'stroke:none', 'data-tip-line':'1' });
      var sLbl = createSvgEl('text', { x:'0', y:'0', 'dominant-baseline':'central', 'class':'tip-label', 'data-tip-line':'1' });
      sLbl.textContent = row.label || '';
      var sVal = createSvgEl('text', { x:'0', y:'0', 'text-anchor':'end', 'dominant-baseline':'central', 'class':'tip-value', 'font-size':'18', 'data-tip-line':'1' });
      sVal.textContent = row.value || '';
      tipG.appendChild(dot);
      tipG.appendChild(sLbl);
      tipG.appendChild(sVal);
      return { dot: dot, sLbl: sLbl, sVal: sVal };
    });

    var totLbl = createSvgEl('text', { x:'0', y:'0', 'dominant-baseline':'central', 'class':'tip-label', 'data-tip-line':'1' });
    totLbl.textContent = opts.totalLabel || 'Total';
    var totVal = createSvgEl('text', { x:'0', y:'0', 'text-anchor':'end', 'dominant-baseline':'central', 'class':'tip-value', 'data-tip-line':'1' });
    totVal.textContent = opts.totalValue || '';
    tipG.appendChild(totLbl);
    tipG.appendChild(totVal);

    var maxLblW = 0;
    rowEls.forEach(function (row) { maxLblW = Math.max(maxLblW, LBL_X + row.sLbl.getBBox().width + 8); });
    maxLblW = Math.max(maxLblW, LBL_X + totLbl.getBBox().width + 8);
    var maxValW = 0;
    rowEls.forEach(function (row) { maxValW = Math.max(maxValW, row.sVal.getBBox().width); });
    maxValW = Math.max(maxValW, totVal.getBBox().width);
    var bw = Math.max((maxLblW + maxValW) + PAD * 2, 320);
    var geom = buildSideTooltipChrome(
      opts.anchorX, opts.anchorY, bw, bh,
      opts.plotL, opts.plotR, opts.plotT, opts.plotB,
      opts.anchorInset || 0, opts.gap != null ? opts.gap : 14, rx, opts.tw != null ? opts.tw : 10
    );

    chrome.bg.setAttribute('x', String(geom.bL));
    chrome.bg.setAttribute('y', String(geom.bT));
    chrome.bg.setAttribute('width', String(bw));
    chrome.bg.setAttribute('height', String(bh));
    chrome.border.setAttribute('d', geom.borderPath);
    chrome.tail.setAttribute('d', geom.tailPath);

    qLbl.setAttribute('x', String(geom.bL + bw / 2));
    qLbl.setAttribute('y', String(geom.bT + hdrH / 2));

    rowEls.forEach(function (row, index) {
      var rowY = geom.bT + hdrH + divH + index * rowH + rowH / 2;
      row.dot.setAttribute('cx', String(geom.bL + DOT_X));
      row.dot.setAttribute('cy', String(rowY));
      row.sLbl.setAttribute('x', String(geom.bL + LBL_X));
      row.sLbl.setAttribute('y', String(rowY));
      row.sVal.setAttribute('x', String(geom.bR - 16));
      row.sVal.setAttribute('y', String(rowY));
    });

    var totY = geom.bT + hdrH + divH + rows.length * rowH + divH + totH / 2;
    totLbl.setAttribute('x', String(geom.bL + LBL_X));
    totLbl.setAttribute('y', String(totY));
    totVal.setAttribute('x', String(geom.bR - 16));
    totVal.setAttribute('y', String(totY));

    tipG.appendChild(createSvgEl('line', { x1:geom.bL + 14, y1:geom.bT + hdrH + divH / 2, x2:geom.bR - 14, y2:geom.bT + hdrH + divH / 2, 'class':'tip-divider', 'data-tip-divider':'1' }));
    tipG.appendChild(createSvgEl('line', { x1:geom.bL + 14, y1:geom.bT + hdrH + divH + rows.length * rowH + divH / 2, x2:geom.bR - 14, y2:geom.bT + hdrH + divH + rows.length * rowH + divH / 2, 'class':'tip-divider', 'data-tip-divider':'1' }));

    return tipG;
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
      svgEl._chartInit(svgEl, {
        $$: $$,
        $$all: $$all,
        el: createSvgEl,
        buildTip: buildChartTip,
        layoutSideTooltip: layoutSideTooltip,
        buildStackedSideTooltip: buildStackedSideTooltip,
        activateExclusive: activateExclusive,
        setElementsActive: setElementsActive,
        setClassState: setClassState,
        setOpacity: setOpacity,
        eventToSvgPoint: eventToSvgPoint
      });
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
  global.buildChartTip = buildChartTip;

  window.addEventListener('load', function () {
    bootstrapChart(document.documentElement);
  });
}(window));
