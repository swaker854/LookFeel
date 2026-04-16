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
  var STAGGER_TOTAL_WINDOW = 2.0;
  var DEFAULT_ANIMATION_DURATION = 0.8;
  var DEFAULT_READY_BUFFER = 0.1;
  var TONE_STEPS = [
    { lightness: 0.00, saturation: 0.00 },
    { lightness: 0.10, saturation: -0.04 },
    { lightness: -0.10, saturation: 0.03 },
    { lightness: 0.18, saturation: -0.10 }
  ];

  function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
  }

  function normalizeCount(count) {
    return Math.max(0, count | 0);
  }

  function parseSeconds(value, fallback) {
    var raw = typeof value === 'string' ? value.trim() : '';
    var numeric;
    if (!raw) return fallback;
    if (/ms$/i.test(raw)) {
      numeric = parseFloat(raw);
      return isNaN(numeric) ? fallback : Math.max(0, numeric / 1000);
    }
    if (/s$/i.test(raw)) {
      numeric = parseFloat(raw);
      return isNaN(numeric) ? fallback : Math.max(0, numeric);
    }
    numeric = Number(raw);
    return isNaN(numeric) ? fallback : Math.max(0, numeric);
  }

  function resolveStaggerWindow(svgEl, totalWindow) {
    if (totalWindow != null) return Math.max(0, Number(totalWindow) || 0);
    if (svgEl && global.getComputedStyle) {
      return parseSeconds(global.getComputedStyle(svgEl).getPropertyValue('--chart-stagger-window'), STAGGER_TOTAL_WINDOW);
    }
    return STAGGER_TOTAL_WINDOW;
  }

  function getStaggerStep(count, totalWindow, svgEl) {
    var n = normalizeCount(count);
    var windowSeconds = resolveStaggerWindow(svgEl, totalWindow);
    return n > 1 ? windowSeconds / (n - 1) : 0;
  }

  function getStaggerDelay(index, count, totalWindow, svgEl) {
    var n = normalizeCount(count);
    var i = clamp(index | 0, 0, Math.max(0, n - 1));
    return i * getStaggerStep(n, totalWindow, svgEl);
  }

  function getStaggerTiming(count, options, svgEl) {
    var opts = options || {};
    var n = normalizeCount(count);
    var duration = opts.duration == null ? DEFAULT_ANIMATION_DURATION : Math.max(0, Number(opts.duration) || 0);
    var buffer = opts.buffer == null ? DEFAULT_READY_BUFFER : Math.max(0, Number(opts.buffer) || 0);
    var totalWindow = resolveStaggerWindow(svgEl || opts.svgEl, opts.totalWindow);
    var step = getStaggerStep(n, totalWindow, svgEl || opts.svgEl);
    var lastDelay = n > 0 ? (n - 1) * step : 0;

    return {
      count: n,
      totalWindow: totalWindow,
      duration: duration,
      buffer: buffer,
      step: step,
      lastDelay: lastDelay,
      readyDelayMs: (lastDelay + duration + buffer) * 1000
    };
  }

  function getRevealReadyDelayMs(options) {
    var opts = options || {};
    var delays = Array.isArray(opts.delays) ? opts.delays : [];
    var duration = opts.duration == null ? DEFAULT_ANIMATION_DURATION : Math.max(0, Number(opts.duration) || 0);
    var buffer = opts.buffer == null ? DEFAULT_READY_BUFFER : Math.max(0, Number(opts.buffer) || 0);
    var lastDelay = 0;

    delays.forEach(function (value) {
      var delay = Math.max(0, Number(value) || 0);
      if (delay > lastDelay) lastDelay = delay;
    });

    return (lastDelay + duration + buffer) * 1000;
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

  function getViewBoxRect(svgEl) {
    var viewBox = svgEl && svgEl.viewBox && svgEl.viewBox.baseVal;
    if (viewBox && (viewBox.width || viewBox.height)) {
      return { x: viewBox.x, y: viewBox.y, width: viewBox.width, height: viewBox.height };
    }

    var raw = svgEl && svgEl.getAttribute ? svgEl.getAttribute('viewBox') : '';
    var parts = raw ? raw.trim().split(/[\s,]+/) : [];
    if (parts.length === 4) {
      return {
        x: Number(parts[0]) || 0,
        y: Number(parts[1]) || 0,
        width: Number(parts[2]) || 0,
        height: Number(parts[3]) || 0
      };
    }

    return { x: 0, y: 0, width: 0, height: 0 };
  }

  function getCombinedBBox(nodes) {
    var minX = Infinity;
    var minY = Infinity;
    var maxX = -Infinity;
    var maxY = -Infinity;

    Array.prototype.slice.call(nodes || []).forEach(function (node) {
      var box;
      if (!node || typeof node.getBBox !== 'function') return;
      try {
        box = node.getBBox();
      } catch (error) {
        return;
      }
      if (!box || !(box.width || box.height)) return;
      minX = Math.min(minX, box.x);
      minY = Math.min(minY, box.y);
      maxX = Math.max(maxX, box.x + box.width);
      maxY = Math.max(maxY, box.y + box.height);
    });

    if (!isFinite(minX) || !isFinite(maxX)) return null;
    return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
  }

  function setTranslateX(node, dx) {
    var base;
    if (!node) return;
    if (node.__chartBaseTransform == null) {
      node.__chartBaseTransform = node.getAttribute('transform') || '';
    }
    base = node.__chartBaseTransform;
    if (!dx) {
      node.setAttribute('transform', base);
      return;
    }
    node.setAttribute('transform', (base ? base + ' ' : '') + 'translate(' + dx + ' 0)');
  }

  function rebalancePlotArea(svgEl, options) {
    var opts = options || {};
    var measureNodes = opts.measureNodes || opts.nodes || [];
    var moveNodes = opts.moveNodes || measureNodes;
    var legendEl = opts.legendEl || null;
    var bounds = getCombinedBBox(measureNodes);
    var viewBox;
    var legendBox;
    var slotLeft;
    var slotRight;
    var plotCenter;
    var slotCenter;
    var minShift;
    var maxShift;
    var shiftX;

    if (!svgEl || !bounds) return { shiftX: 0, bounds: bounds };
    if (!legendEl && opts.legendSelector) legendEl = svgEl.querySelector(opts.legendSelector);
    if (!legendEl || typeof legendEl.getBBox !== 'function') return { shiftX: 0, bounds: bounds };

    try {
      legendBox = legendEl.getBBox();
    } catch (error) {
      return { shiftX: 0, bounds: bounds };
    }

    viewBox = getViewBoxRect(svgEl);
    slotLeft = opts.slotLeft != null ? Number(opts.slotLeft) : viewBox.x + (opts.outerLeft != null ? Number(opts.outerLeft) : 24);
    slotRight = opts.slotRight != null ? Number(opts.slotRight) : legendBox.x - (opts.legendGap != null ? Number(opts.legendGap) : 32);
    if (!(slotRight > slotLeft)) return { shiftX: 0, bounds: bounds };

    plotCenter = bounds.x + bounds.width / 2;
    slotCenter = (slotLeft + slotRight) / 2;
    shiftX = slotCenter - plotCenter;

    if (opts.clamp !== false) {
      minShift = slotLeft - bounds.x;
      maxShift = slotRight - (bounds.x + bounds.width);
      shiftX = clamp(shiftX, minShift, maxShift);
    }

    if (opts.round !== false) shiftX = Math.round(shiftX);
    Array.prototype.slice.call(moveNodes || []).forEach(function (node) {
      setTranslateX(node, shiftX);
    });

    return {
      shiftX: shiftX,
      bounds: bounds,
      slotLeft: slotLeft,
      slotRight: slotRight,
      legendBox: legendBox
    };
  }

  function animateAndMarkVisible(node, animationValue, visibleClass) {
    if (!node) return;
    var cls = visibleClass || 'visible';
    node.style.animation = animationValue;
    node.addEventListener('animationend', function handler() {
      node.removeEventListener('animationend', handler);
      node.style.animation = 'none';
      node.classList.add(cls);
    }, { once: true });
  }

  /*
   * Reveal helpers intentionally stop at the mechanical layer:
   * - assign animation / delay
   * - clean up inline animation
   * - add the stable post-reveal class
   *
   * Each chart still owns reveal ordering and sequencing so we do not
   * accidentally change chart feel while sharing the plumbing.
   */
  function initRevealSequence(nodes, options) {
    var opts = options || {};
    var items = Array.prototype.slice.call(nodes || []);
    var delays = Array.isArray(opts.delays) ? opts.delays : [];
    var reverse = !!opts.reverse;
    var duration = opts.duration == null ? 0.8 : Math.max(0, Number(opts.duration) || 0);
    var easing = opts.easing || 'cubic-bezier(0.4,0,0.2,1)';
    var animationName = opts.animationName || '';
    var visibleClass = opts.visibleClass || 'visible';

    items.forEach(function (node, index) {
      var delayIndex = reverse ? (items.length - 1 - index) : index;
      var delay = Math.max(0, Number(delays[delayIndex]) || 0);
      if (!node || !animationName) return;
      animateAndMarkVisible(node, animationName + ' ' + duration + 's ' + easing + ' ' + delay + 's', visibleClass);
    });

    return items;
  }

  function initStrokeReveal(node, options) {
    var opts = options || {};
    var delay = Math.max(0, Number(opts.delay) || 0);
    var visibleClass = opts.visibleClass || 'visible';

    if (!node) return null;
    node.style.animationDelay = delay + 's';
    node.classList.add(visibleClass);
    return node;
  }

  function animateClipRevealRect(rect, opts) {
    if (!rect) return;
    var options = opts || {};
    var delay = Math.max(0, Number(options.delay) || 0);
    var duration = Math.max(0, Number(options.duration) || 0);
    var fullWidth = Math.max(0, Number(options.fullWidth) || 0);
    var easing = typeof options.easing === 'function'
      ? options.easing
      : function easeOutCubic(t) { return 1 - Math.pow(1 - t, 3); };
    var startAt = performance.now() + delay * 1000;

    function tick(now) {
      if (now < startAt) {
        global.requestAnimationFrame(tick);
        return;
      }
      var progress = duration > 0 ? Math.min((now - startAt) / duration, 1) : 1;
      rect.setAttribute('width', String(fullWidth * easing(progress)));
      if (progress < 1) global.requestAnimationFrame(tick);
    }

    global.requestAnimationFrame(tick);
  }

  function initAreaClipReveal(svgEl, options) {
    var opts = options || {};
    var defs = opts.defs || (svgEl && svgEl.querySelector ? svgEl.querySelector('defs') : null);
    var area = opts.area || null;
    var clipId = opts.clipId || '';
    var clipRect = opts.clipRect || null;
    var rectX;
    var rectY;
    var rectWidth;
    var rectHeight;
    var revealRect;
    var areaClip;

    if (!svgEl || !defs || !area || !clipId) return null;

    rectX = opts.x;
    rectY = opts.y;
    rectWidth = opts.width;
    rectHeight = opts.height;

    if (clipRect) {
      if (rectX == null) rectX = parseFloat(clipRect.getAttribute('x'));
      if (rectY == null) rectY = parseFloat(clipRect.getAttribute('y'));
      if (rectWidth == null) rectWidth = parseFloat(clipRect.getAttribute('width'));
      if (rectHeight == null) rectHeight = parseFloat(clipRect.getAttribute('height'));
    }

    rectX = rectX == null ? 0 : rectX;
    rectY = rectY == null ? 0 : rectY;
    rectWidth = rectWidth == null ? 0 : rectWidth;
    rectHeight = rectHeight == null ? 0 : rectHeight;

    areaClip = createSvgEl('clipPath', { id: clipId, clipPathUnits: 'userSpaceOnUse' });
    revealRect = createSvgEl('rect', { x: rectX, y: rectY, width: 0, height: rectHeight });
    areaClip.appendChild(revealRect);
    defs.appendChild(areaClip);
    area.setAttribute('clip-path', 'url(#' + clipId + ')');
    area.classList.add(opts.visibleClass || 'visible');

    animateClipRevealRect(revealRect, {
      delay: opts.delay,
      duration: opts.duration,
      fullWidth: rectWidth,
      easing: opts.easing
    });

    return { clipPath: areaClip, rect: revealRect };
  }

  function resolveSeriesSelector(selector, id, qi) {
    if (!selector) return null;
    if (typeof selector === 'function') return selector(id, qi);
    return String(selector)
      .replace(/\{id\}/g, String(id))
      .replace(/\{qi\}/g, String(qi));
  }

  function getNearestSeriesIdAtColumn(series, qi, mouseY) {
    var items = Array.isArray(series) ? series : [];
    var bestSid;
    var bestDist = Infinity;

    if (!items.length) return null;
    bestSid = items[0].id;
    if (typeof mouseY !== 'number') return bestSid;

    items.forEach(function (entry) {
      var ys = entry && entry.ys;
      var pointY = ys && ys[qi];
      var dist;
      if (typeof pointY !== 'number') return;
      dist = Math.abs(pointY - mouseY);
      if (dist < bestDist) {
        bestDist = dist;
        bestSid = entry.id;
      }
    });

    return bestSid;
  }

  function setSeriesHoverState(svgEl, options) {
    var opts = options || {};
    var seriesIds = Array.isArray(opts.seriesIds) ? opts.seriesIds : [];
    var activeSid = opts.activeSid;
    var hoverLayer = opts.hoverLayer || null;
    var pointIndices = Array.isArray(opts.pointIndices) ? opts.pointIndices : null;
    var pointCount = opts.pointCount == null ? 0 : Math.max(0, opts.pointCount | 0);

    if (hoverLayer && opts.hovering != null) {
      hoverLayer.classList.toggle('hovering', !!opts.hovering);
    }

    if (!pointIndices && pointCount > 0) {
      pointIndices = [];
      for (var qi = 0; qi < pointCount; qi += 1) pointIndices.push(qi);
    }

    seriesIds.forEach(function (id) {
      var isActive = activeSid != null && id === activeSid;
      var lineSelector = resolveSeriesSelector(opts.lineSelector, id);
      var areaSelector = resolveSeriesSelector(opts.areaSelector, id);
      var lineNode = lineSelector ? svgEl.querySelector(lineSelector) : null;
      var areaNode = areaSelector ? svgEl.querySelector(areaSelector) : null;

      if (lineNode) lineNode.classList.toggle('active', isActive);
      if (areaNode) areaNode.classList.toggle('active', isActive);

      if (!opts.dotSelector || !pointIndices) return;
      pointIndices.forEach(function (pointIndex) {
        var dotSelector = resolveSeriesSelector(opts.dotSelector, id, pointIndex);
        var dotNode = dotSelector ? svgEl.querySelector(dotSelector) : null;
        if (dotNode) dotNode.classList.toggle('active', isActive);
      });
    });
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

  function initSideBubbles(svgEl, ctx, opts) {
    var options = opts || {};
    var itemSelector = options.itemSelector || '.data-item';
    var tipSelector = options.tipSelector || '.data-tip';
    var tipLayerSelector = options.tipLayerSelector || '#tip-layer';
    var anchorXAttr = options.anchorXAttr || 'data-item-cx';
    var anchorYAttr = options.anchorYAttr || 'data-item-top';
    var tipLayerEl = ctx.$$(tipLayerSelector);
    var items;

    if (!tipLayerEl) return [];

    items = ctx.$$all(itemSelector);
    items.forEach(function (itemEl) {
      var tipEl = itemEl.querySelector(tipSelector);
      var anchorX;
      var anchorY;
      var lines;

      if (!tipEl) return;

      anchorX = parseFloat(itemEl.getAttribute(anchorXAttr));
      anchorY = parseFloat(itemEl.getAttribute(anchorYAttr));
      lines = typeof options.getLines === 'function' ? options.getLines(itemEl, tipEl) : [
        { text: ((tipEl.querySelector('.tip-value') || {}).textContent || ''), className: 'tip-value' },
        { text: ((tipEl.querySelector('.tip-label') || {}).textContent || ''), className: 'tip-label' }
      ];

      layoutSideTooltip(tipEl, {
        anchorX: anchorX,
        anchorY: anchorY,
        anchorInset: options.anchorInset || 0,
        plotL: options.plotL,
        plotR: options.plotR,
        plotT: options.plotT,
        plotB: options.plotB,
        lines: lines,
        lineHeights: options.lineHeights,
        minWidth: options.minWidth,
        paddingX: options.paddingX,
        paddingY: options.paddingY,
        gap: options.gap,
        rx: options.rx,
        tw: options.tw
      });

      tipLayerEl.appendChild(tipEl);
      itemEl._tip = tipEl;
    });

    return items;
  }

  function initRadialHover(chartEl, sliceEls, options) {
    var opts = options || {};
    var onActivate = typeof opts.onActivate === 'function' ? opts.onActivate : null;
    var onDeactivate = typeof opts.onDeactivate === 'function' ? opts.onDeactivate : null;
    var slices = Array.prototype.slice.call(sliceEls || []);

    slices.forEach(function (sliceEl) {
      sliceEl.addEventListener('mouseenter', function () {
        chartEl.classList.add('hovering');
        activateExclusive(slices, sliceEl);
        if (onActivate) onActivate(sliceEl);
      });
    });

    chartEl.addEventListener('mouseleave', function () {
      setClassState(slices, 'active', false);
      chartEl.classList.remove('hovering');
      if (onDeactivate) onDeactivate();
    });

    return slices;
  }

  function initExclusiveHover(chartEl, itemEls, options) {
    var opts = options || {};
    var items = Array.prototype.slice.call(itemEls || []);
    var activeClass = opts.activeClass || 'active';
    var hoverClass = opts.hoverClass === false ? '' : (opts.hoverClass || 'hovering');
    var leaveTarget = opts.leaveTarget || chartEl;
    var onActivate = typeof opts.onActivate === 'function' ? opts.onActivate : null;
    var onDeactivate = typeof opts.onDeactivate === 'function' ? opts.onDeactivate : null;

    function clearHover() {
      setClassState(items, activeClass, false);
      if (chartEl && hoverClass) chartEl.classList.remove(hoverClass);
      if (onDeactivate) onDeactivate();
    }

    items.forEach(function (itemEl) {
      itemEl.addEventListener('mouseenter', function () {
        clearHover();
        if (chartEl && hoverClass) chartEl.classList.add(hoverClass);
        activateExclusive(items, itemEl, activeClass);
        if (onActivate) onActivate(itemEl);
      });
    });

    if (leaveTarget && leaveTarget.addEventListener) {
      leaveTarget.addEventListener('mouseleave', clearHover);
    }

    return { items: items, clearHover: clearHover };
  }

  function initExclusiveHoverTips(chartEl, itemEls, options) {
    var opts = options || {};
    var items = Array.prototype.slice.call(itemEls || []);
    var resolveTip = typeof opts.resolveTip === 'function'
      ? opts.resolveTip
      : function (itemEl) { return itemEl && itemEl._tip ? itemEl._tip : null; };
    var beforeShow = typeof opts.beforeShow === 'function' ? opts.beforeShow : null;
    var afterHide = typeof opts.afterHide === 'function' ? opts.afterHide : null;

    function clearTips() {
      items.forEach(function (itemEl) {
        setOpacity(resolveTip(itemEl), null);
      });
    }

    return initExclusiveHover(chartEl, items, {
      activeClass: opts.activeClass,
      hoverClass: opts.hoverClass,
      leaveTarget: opts.leaveTarget,
      onActivate: function (itemEl) {
        var tipEl = resolveTip(itemEl);
        clearTips();
        if (beforeShow) beforeShow(itemEl, tipEl);
        setOpacity(tipEl, 1);
        if (typeof opts.onActivate === 'function') opts.onActivate(itemEl, tipEl);
      },
      onDeactivate: function () {
        clearTips();
        if (afterHide) afterHide();
        if (typeof opts.onDeactivate === 'function') opts.onDeactivate();
      }
    });
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

  function initStackedColumnHover(svgEl, options) {
    var opts = options || {};
    var xs = Array.isArray(opts.xs) ? opts.xs : [];
    var quarters = Array.isArray(opts.quarters) ? opts.quarters : [];
    var series = Array.isArray(opts.series) ? opts.series : [];
    var totals = Array.isArray(opts.totals) ? opts.totals : [];
    var tipLayer = opts.tipLayer || null;
    var hitLayer = opts.hitLayer || null;
    var plotL = opts.plotL == null ? 0 : opts.plotL;
    var plotR = opts.plotR == null ? 0 : opts.plotR;
    var plotT = opts.plotT == null ? 0 : opts.plotT;
    var plotB = opts.plotB == null ? 0 : opts.plotB;
    var anchorY = opts.anchorY == null ? plotT : opts.anchorY;
    var hitTop = opts.hitTop == null ? plotT : opts.hitTop;
    var hitHeight = opts.hitHeight == null ? Math.max(0, plotB - plotT) : opts.hitHeight;
    var hitHalfWidth = opts.hitHalfWidth == null ? 56 : opts.hitHalfWidth;
    var hitMinX = opts.hitMinX == null ? plotL : opts.hitMinX;
    var hitMaxX = opts.hitMaxX == null ? plotR : opts.hitMaxX;
    var hitIdPrefix = opts.hitIdPrefix || '';
    var crosshairSelector = opts.crosshairSelector || '#ch{qi}';
    var onEnter = typeof opts.onEnter === 'function' ? opts.onEnter : null;
    var onMove = typeof opts.onMove === 'function' ? opts.onMove : null;
    var onLeave = typeof opts.onLeave === 'function' ? opts.onLeave : null;
    var tips = {};
    var hits = {};
    var crosshairs = {};

    if (!svgEl || !tipLayer || !hitLayer || !xs.length) {
      return { tips: tips, hits: hits, crosshairs: crosshairs };
    }

    xs.forEach(function (x, qi) {
      var tipG = buildStackedSideTooltip(tipLayer, {
        id: 'tip_' + qi,
        header: quarters[qi],
        rows: series.map(function (entry) {
          return { cls: entry.cls, label: entry.label, value: '$' + entry.vals[qi] + 'M' };
        }),
        totalLabel: 'Total',
        totalValue: '$' + totals[qi] + 'M',
        anchorX: x,
        anchorY: anchorY,
        plotL: plotL,
        plotR: plotR,
        plotT: plotT,
        plotB: plotB
      });
      var hx1 = Math.max(hitMinX, x - hitHalfWidth);
      var hx2 = Math.min(hitMaxX, x + hitHalfWidth);
      var hit = createSvgEl('rect', {
        x: hx1,
        y: hitTop,
        width: hx2 - hx1,
        height: hitHeight,
        fill: 'transparent',
        cursor: 'crosshair'
      });
      if (hitIdPrefix) hit.setAttribute('id', hitIdPrefix + qi);
      var ch = svgEl.querySelector(crosshairSelector.replace(/\{qi\}/g, String(qi)));

      tipLayer.appendChild(tipG);
      hitLayer.appendChild(hit);
      tips[qi] = tipG;
      hits[qi] = hit;
      crosshairs[qi] = ch;

      hit.addEventListener('mouseenter', function (event) {
        var sp = eventToSvgPoint(svgEl, event);
        if (onEnter) onEnter(qi, sp, tipG, ch, hit);
      });
      hit.addEventListener('mousemove', function (event) {
        var sp = eventToSvgPoint(svgEl, event);
        if (onMove) onMove(qi, sp, tipG, ch, hit);
      });
      hit.addEventListener('mouseleave', function () {
        if (onLeave) onLeave(qi, tipG, ch, hit);
      });
    });

    return { tips: tips, hits: hits, crosshairs: crosshairs };
  }

  function initPointSeriesHover(svgEl, options) {
    var opts = options || {};
    var series = Array.isArray(opts.series) ? opts.series : [];
    var xs = Array.isArray(opts.xs) ? opts.xs : [];
    var dotsLayer = opts.dotsLayer || null;
    var tipLayer = opts.tipLayer || null;
    var hoverLayer = opts.hoverLayer || null;
    var plotL = opts.plotL == null ? 0 : opts.plotL;
    var plotR = opts.plotR == null ? 0 : opts.plotR;
    var plotT = opts.plotT == null ? 0 : opts.plotT;
    var plotB = opts.plotB == null ? 0 : opts.plotB;
    var quarters = Array.isArray(opts.quarters) ? opts.quarters : [];
    var lineSelector = opts.lineSelector || null;
    var areaSelector = opts.areaSelector || null;
    var dotSelector = opts.dotSelector || '#d{id}_{qi} .dot-inner';
    var animateDots = opts.animateDots !== false;
    var animateDot = typeof opts.animateDot === 'function' ? opts.animateDot : null;
    var dotDelay = typeof opts.dotDelay === 'function' ? opts.dotDelay : null;
    var baseRadius = opts.baseRadius == null ? 5 : opts.baseRadius;
    var hoverRadius = opts.hoverRadius == null ? 7 : opts.hoverRadius;
    var tips = {};
    var dots = {};

    if (!svgEl || !dotsLayer || !tipLayer || !series.length || !xs.length) {
      return { tips: tips, dots: dots, setHover: function () {}, clearHover: function () {} };
    }

    function applyHover(activeSid, hovering) {
      setSeriesHoverState(svgEl, {
        hoverLayer: hoverLayer,
        hovering: hovering,
        activeSid: activeSid,
        seriesIds: series.map(function (entry) { return entry.id; }),
        pointCount: xs.length,
        lineSelector: lineSelector,
        areaSelector: areaSelector,
        dotSelector: dotSelector
      });
    }

    series.forEach(function (entry) {
      xs.forEach(function (x, qi) {
        var y = entry.ys[qi];
        var key = entry.id + '_' + qi;
        var dg = createSvgEl('g', { 'class': 'dot-g', id: 'd' + key });
        var inner = createSvgEl('g', { 'class': 'dot-inner', style: 'transform-origin:' + x + 'px ' + y + 'px' });
        var dot = createSvgEl('circle', { cx: x, cy: y, r: baseRadius, 'class': entry.cls, stroke: 'none' });
        var tipG = createSvgEl('g', { 'class': 'tip', id: 't' + key });
        var ch = svgEl.querySelector('#ch' + qi);
        var delaySeconds = dotDelay ? dotDelay(entry, qi) : 0;

        if (animateDot) {
          animateDot(inner, delaySeconds, entry, qi);
        } else if (animateDots) {
          animateAndMarkVisible(inner, 'popDot 0.35s cubic-bezier(0.34,1.4,0.64,1) ' + delaySeconds + 's');
        } else {
          inner.classList.add('visible');
        }

        inner.appendChild(dot);
        dg.appendChild(inner);
        dotsLayer.appendChild(dg);
        tipLayer.appendChild(tipG);
        dots[key] = dg;
        tips[key] = tipG;

        layoutSideTooltip(tipG, {
          anchorX: x,
          anchorY: y,
          plotL: plotL,
          plotR: plotR,
          plotT: plotT,
          plotB: plotB,
          lines: [
            { text: '$' + entry.vals[qi] + 'M', className: 'tip-value' },
            { text: entry.label + ' - ' + quarters[qi], className: 'tip-label' }
          ],
          lineHeights: [70, 70],
          minWidth: 220,
          paddingX: 20,
          paddingY: 30
        });

        dg.addEventListener('mouseenter', function () {
          setOpacity(tipG, 1);
          setOpacity(ch, 1);
          dot.setAttribute('r', String(hoverRadius));
          applyHover(entry.id, true);
        });
        dg.addEventListener('mouseleave', function () {
          setOpacity(tipG, null);
          setOpacity(ch, null);
          dot.setAttribute('r', String(baseRadius));
          applyHover(null, false);
        });
      });
    });

    return {
      tips: tips,
      dots: dots,
      setHover: function (activeSid) { applyHover(activeSid, true); },
      clearHover: function () { applyHover(null, false); }
    };
  }

  function initSeriesVerticalGradients(svgEl, options) {
    var opts = options || {};
    var defs = opts.defs || (svgEl && svgEl.querySelector ? svgEl.querySelector('defs') : null);
    var ns = 'http://www.w3.org/2000/svg';
    var series = Array.isArray(opts.series) ? opts.series : [];
    var topOpacities = Array.isArray(opts.topOpacities) ? opts.topOpacities : [];
    var bottomOpacity = opts.bottomOpacity == null ? 0.02 : Number(opts.bottomOpacity);
    var gradientIdPrefix = opts.gradientIdPrefix || 'grad-';
    var areaIdPrefix = opts.areaIdPrefix || 'area-';
    var probeTag = opts.probeTag || 'rect';
    var setFill = opts.setFill !== false;

    if (!svgEl || !defs || !series.length) {
      return function noop() {};
    }

    series.forEach(function (entry, index) {
      var opacity = topOpacities[index];
      var gradient = document.createElementNS(ns, 'linearGradient');
      var stopTop = document.createElementNS(ns, 'stop');
      var stopBottom = document.createElementNS(ns, 'stop');

      gradient.setAttribute('id', gradientIdPrefix + entry.id);
      gradient.setAttribute('x1', '0');
      gradient.setAttribute('y1', '0');
      gradient.setAttribute('x2', '0');
      gradient.setAttribute('y2', '1');

      stopTop.setAttribute('id', gradientIdPrefix + entry.id + '-s0');
      stopTop.setAttribute('offset', '0%');
      stopTop.setAttribute('stop-opacity', String(opacity == null ? 0.2 : opacity));

      stopBottom.setAttribute('id', gradientIdPrefix + entry.id + '-s1');
      stopBottom.setAttribute('offset', '100%');
      stopBottom.setAttribute('stop-opacity', String(isNaN(bottomOpacity) ? 0.02 : bottomOpacity));

      gradient.appendChild(stopTop);
      gradient.appendChild(stopBottom);
      defs.appendChild(gradient);

      if (setFill) {
        var area = svgEl.querySelector('#' + areaIdPrefix + entry.id);
        if (area) area.setAttribute('fill', 'url(#' + gradientIdPrefix + entry.id + ')');
      }
    });

    return function syncSeriesVerticalGradients() {
      var probe = document.createElementNS(ns, probeTag);
      probe.style.visibility = 'hidden';
      probe.style.position = 'absolute';
      svgEl.appendChild(probe);

      series.forEach(function (entry) {
        var color;
        var stopTop = svgEl.querySelector('#' + gradientIdPrefix + entry.id + '-s0');
        var stopBottom = svgEl.querySelector('#' + gradientIdPrefix + entry.id + '-s1');
        var area = setFill ? svgEl.querySelector('#' + areaIdPrefix + entry.id) : null;

        probe.setAttribute('class', entry.cls || '');
        color = global.getComputedStyle(probe).fill;

        if (stopTop) stopTop.setAttribute('stop-color', color);
        if (stopBottom) stopBottom.setAttribute('stop-color', color);
        if (area) area.setAttribute('fill', 'url(#' + gradientIdPrefix + entry.id + ')');
      });

      svgEl.removeChild(probe);
    };
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

      if (typeof svgEl._onModeChange === 'function') svgEl._onModeChange(wantDark);
    }

    function setPrint(wantPrint) {
      if (wantPrint === isPrint) return;
      isPrint = wantPrint;
      svgEl.classList.toggle('print', wantPrint);
    }

    if (typeof svgEl._chartInit === 'function') {
      svgEl._chartInit(svgEl, {
        $$: $$,
        $$all: $$all,
        el: createSvgEl,
        buildTip: buildChartTip,
        layoutSideTooltip: layoutSideTooltip,
        initSideBubbles: function (options) { return initSideBubbles(svgEl, { $$: $$, $$all: $$all }, options); },
        initRadialHover: initRadialHover,
        initExclusiveHover: initExclusiveHover,
        initExclusiveHoverTips: initExclusiveHoverTips,
        buildStackedSideTooltip: buildStackedSideTooltip,
        initStackedColumnHover: function (options) { return initStackedColumnHover(svgEl, options); },
        initPointSeriesHover: function (options) { return initPointSeriesHover(svgEl, options); },
        getStaggerStep: function (count, totalWindow) { return getStaggerStep(count, totalWindow, svgEl); },
        getStaggerDelay: function (index, count, totalWindow) { return getStaggerDelay(index, count, totalWindow, svgEl); },
        getStaggerTiming: function (count, options) { return getStaggerTiming(count, options, svgEl); },
        getRevealReadyDelayMs: getRevealReadyDelayMs,
        buildChartTip: buildChartTip,
        activateExclusive: activateExclusive,
        setElementsActive: setElementsActive,
        setClassState: setClassState,
        setOpacity: setOpacity,
        animateAndMarkVisible: animateAndMarkVisible,
        initRevealSequence: initRevealSequence,
        initStrokeReveal: initStrokeReveal,
        animateClipRevealRect: animateClipRevealRect,
        initAreaClipReveal: function (options) { return initAreaClipReveal(svgEl, options); },
        getNearestSeriesIdAtColumn: getNearestSeriesIdAtColumn,
        setSeriesHoverState: function (options) { return setSeriesHoverState(svgEl, options); },
        eventToSvgPoint: eventToSvgPoint,
        initSeriesVerticalGradients: function (options) { return initSeriesVerticalGradients(svgEl, options); },
        rebalancePlotArea: function (options) { return rebalancePlotArea(svgEl, options); }
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
  global.getChartStaggerStep = getStaggerStep;
  global.getChartStaggerDelay = getStaggerDelay;
  global.getChartStaggerTiming = getStaggerTiming;

  window.addEventListener('load', function () {
    bootstrapChart(document.documentElement);
  });
}(window));
