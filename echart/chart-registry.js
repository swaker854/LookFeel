(function(global) {
  const DEFAULT_PALETTE = ['#00D4E8', '#00B87A', '#F59E0B', '#F43F5E', '#8B5CF6', '#3B82F6', '#0D9488', '#64748B'];

  function clampTooltipPosition(pos, rect, size, bottomPad) {
    const edgePad = 8;
    const x = Math.max(edgePad, Math.min(pos[0] - size.contentSize[0] / 2, size.viewSize[0] - size.contentSize[0] - edgePad));
    const preferredY = rect ? rect.y - size.contentSize[1] - 14 : pos[1] - size.contentSize[1] - 18;
    const fallbackY = rect ? rect.y + rect.height + 14 : pos[1] + 18;
    const maxY = size.viewSize[1] - size.contentSize[1] - (bottomPad || edgePad);
    const y = preferredY < edgePad ? Math.min(maxY, fallbackY) : preferredY;
    return [x, Math.max(edgePad, Math.min(y, maxY))];
  }

  function tooltipCard(dark, bodyHtml, minWidth) {
    const bg = dark ? '#1C1B1F' : '#FFFBFE';
    const border = dark ? '#938F99' : '#79747E';
    return '<div data-tip-card style="position:relative;' + (minWidth ? ('min-width:' + minWidth + ';') : '') + 'padding:10px 12px;border-radius:10px;background:' + bg + ';border:1px solid ' + border + ';">' +
      '<div data-tip-scroll style="max-height:132px;overflow-y:auto;scrollbar-width:none;-ms-overflow-style:none;">' + bodyHtml + '</div>' +
      '<div data-tip-tail-join style="position:absolute;pointer-events:none;background:' + bg + ';"></div>' +
      '<div data-tip-tail-border style="position:absolute;width:0;height:0;"></div>' +
      '<div data-tip-tail-fill style="position:absolute;width:0;height:0;"></div>' +
    '</div>';
  }

  function setTriangle(el, direction, size, color) {
    if (!el) return;
    el.style.borderLeft = '';
    el.style.borderRight = '';
    el.style.borderTop = '';
    el.style.borderBottom = '';
    if (direction === 'left') {
      el.style.borderTop = size + 'px solid transparent';
      el.style.borderBottom = size + 'px solid transparent';
      el.style.borderRight = size + 'px solid ' + color;
    } else if (direction === 'right') {
      el.style.borderTop = size + 'px solid transparent';
      el.style.borderBottom = size + 'px solid transparent';
      el.style.borderLeft = size + 'px solid ' + color;
    } else if (direction === 'up') {
      el.style.borderLeft = size + 'px solid transparent';
      el.style.borderRight = size + 'px solid transparent';
      el.style.borderBottom = size + 'px solid ' + color;
    } else if (direction === 'down') {
      el.style.borderLeft = size + 'px solid transparent';
      el.style.borderRight = size + 'px solid transparent';
      el.style.borderTop = size + 'px solid ' + color;
    }
  }

  function applyTooltipPlacement(dom, placement, anchorX, anchorY, x, y, width, height, dark) {
    const joinEl = dom.querySelector('[data-tip-tail-join]');
    const borderEl = dom.querySelector('[data-tip-tail-border]');
    const fillEl = dom.querySelector('[data-tip-tail-fill]');
    const bg = dark ? '#1C1B1F' : '#FFFBFE';
    const border = dark ? '#938F99' : '#79747E';
    if (!joinEl || !borderEl || !fillEl) return;
    joinEl.style.left = '';
    joinEl.style.right = '';
    joinEl.style.top = '';
    joinEl.style.bottom = '';
    joinEl.style.width = '';
    joinEl.style.height = '';
    joinEl.style.transform = '';
    joinEl.style.background = bg;
    borderEl.style.left = '';
    borderEl.style.right = '';
    borderEl.style.top = '';
    borderEl.style.bottom = '';
    borderEl.style.transform = '';
    fillEl.style.left = '';
    fillEl.style.right = '';
    fillEl.style.top = '';
    fillEl.style.bottom = '';
    fillEl.style.transform = '';

    if (placement === 'left' || placement === 'right') {
      const tailY = Math.max(14, Math.min(height - 14, anchorY - y));
      const borderOffset = placement === 'left' ? '-9px' : '-9px';
      const fillOffset = placement === 'left' ? '-8px' : '-8px';
      joinEl.style.top = tailY + 'px';
      joinEl.style.width = '2px';
      joinEl.style.height = '16px';
      joinEl.style.transform = 'translateY(-50%)';
      borderEl.style.top = tailY + 'px';
      borderEl.style.transform = 'translateY(-50%)';
      fillEl.style.top = tailY + 'px';
      fillEl.style.transform = 'translateY(-50%)';
      if (placement === 'left') {
        joinEl.style.right = '-1px';
        borderEl.style.right = borderOffset;
        fillEl.style.right = fillOffset;
        setTriangle(borderEl, 'right', 8, border);
        setTriangle(fillEl, 'right', 7, bg);
      } else {
        joinEl.style.left = '-1px';
        borderEl.style.left = borderOffset;
        fillEl.style.left = fillOffset;
        setTriangle(borderEl, 'left', 8, border);
        setTriangle(fillEl, 'left', 7, bg);
      }
    } else {
      const tailX = Math.max(14, Math.min(width - 14, anchorX - x));
      joinEl.style.left = tailX + 'px';
      joinEl.style.width = '16px';
      joinEl.style.height = '2px';
      joinEl.style.transform = 'translateX(-50%)';
      borderEl.style.left = tailX + 'px';
      borderEl.style.transform = 'translateX(-50%)';
      fillEl.style.left = tailX + 'px';
      fillEl.style.transform = 'translateX(-50%)';
      if (placement === 'top') {
        joinEl.style.bottom = '-1px';
        borderEl.style.bottom = '-9px';
        fillEl.style.bottom = '-8px';
        setTriangle(borderEl, 'down', 8, border);
        setTriangle(fillEl, 'down', 7, bg);
      } else {
        joinEl.style.top = '-1px';
        borderEl.style.top = '-9px';
        fillEl.style.top = '-8px';
        setTriangle(borderEl, 'up', 8, border);
        setTriangle(fillEl, 'up', 7, bg);
      }
    }
  }

  function smartTooltipPosition(pos, rect, size, dom, dark, preferHorizontal, bottomPad) {
    const edgePad = 8;
    const gap = 18;
    const width = size.contentSize[0];
    const height = size.contentSize[1];
    const viewWidth = size.viewSize[0];
    const viewHeight = size.viewSize[1];
    const anchorX = rect ? rect.x + rect.width / 2 : pos[0];
    const anchorY = rect ? rect.y + rect.height / 2 : pos[1];

    const placements = preferHorizontal
      ? (anchorX < viewWidth / 2 ? ['right', 'left', 'top', 'bottom'] : ['left', 'right', 'top', 'bottom'])
      : (anchorY < viewHeight / 2 ? ['bottom', 'top', 'right', 'left'] : ['top', 'bottom', 'right', 'left']);

    function coordsFor(placement) {
      if (placement === 'left') return { x: anchorX - width - gap, y: anchorY - height / 2 };
      if (placement === 'right') return { x: anchorX + gap, y: anchorY - height / 2 };
      if (placement === 'top') return { x: anchorX - width / 2, y: anchorY - height - gap };
      return { x: anchorX - width / 2, y: anchorY + gap };
    }

    function fits(placement) {
      const p = coordsFor(placement);
      const maxY = viewHeight - height - (bottomPad || edgePad);
      return p.x >= edgePad && p.x <= viewWidth - width - edgePad && p.y >= edgePad && p.y <= maxY;
    }

    let placement = placements.find(fits) || placements[0];
    const preferred = coordsFor(placement);
    const maxY = viewHeight - height - (bottomPad || edgePad);
    const x = Math.max(edgePad, Math.min(preferred.x, viewWidth - width - edgePad));
    const y = Math.max(edgePad, Math.min(preferred.y, maxY));
    applyTooltipPlacement(dom, placement, anchorX, anchorY, x, y, width, height, dark);
    return [x, y];
  }

  function ensureOverlayStyles(container) {
    const doc = container && container.ownerDocument;
    const root = doc && (doc.head || doc.body);
    if (!root || root.querySelector('[data-lookfeel-overlay-styles]')) return;
    const style = doc.createElement('style');
    style.setAttribute('data-lookfeel-overlay-styles', 'true');
    style.textContent = '[data-chart-legend-overlay]::-webkit-scrollbar,[data-tip-scroll]::-webkit-scrollbar{width:0;height:0;}';
    root.appendChild(style);
  }

  function createManagedChart(container, buildOption, afterRender) {
    const chart = echarts.init(container, null, { renderer: 'svg' });
    const initialDarkAttr = container && typeof container.getAttribute === 'function'
      ? container.getAttribute('data-initial-dark')
      : null;
    const state = {
      dark: initialDarkAttr == null ? true : initialDarkAttr !== '0',
      colors: DEFAULT_PALETTE.slice()
    };

    function samePalette(colors) {
      if (!Array.isArray(colors) || colors.length !== state.colors.length) return false;
      for (let i = 0; i < colors.length; i += 1) {
        if (colors[i] !== state.colors[i]) return false;
      }
      return true;
    }

    function render() {
      ensureOverlayStyles(container);
      chart.setOption(buildOption(chart, state, container), true);
      applyLegendOverlay(container);
      if (afterRender) afterRender(chart, state, container);
    }

    render();

    return {
      chart: chart,
      setMode: function(dark) {
        if (state.dark === !!dark) return;
        state.dark = !!dark;
        render();
      },
      setPalette: function(colors) {
        if (!Array.isArray(colors) || !colors.length || samePalette(colors)) return;
        state.colors = colors.slice();
        render();
      },
      resize: function() {
        chart.resize();
        render();
      },
      dispose: function() {
        chart.dispose();
      }
    };
  }

  function legendOverlayLayout(chart) {
    const mode = getChartMode(chart);
    if (mode === 'compact') return { mode: mode, width: 92, right: 8, top: 10, bottom: 10, titleFont: 10, itemFont: 10, swatch: 8, paddingTop: 12, paddingX: 10, paddingBottom: 10 };
    if (mode === 'medium') return { mode: mode, width: 104, right: 8, top: 6, bottom: 8, titleFont: 10, itemFont: 10, swatch: 8, paddingTop: 12, paddingX: 10, paddingBottom: 10 };
    return { mode: mode, width: 124, right: 12, top: 8, bottom: 8, titleFont: 10, itemFont: 11, swatch: 14, paddingTop: 14, paddingX: 14, paddingBottom: 12 };
  }

  function legendGridRight(chart) {
    const layout = legendOverlayLayout(chart);
    return layout.width + layout.right + 12;
  }

  function setLegendOverlayConfig(container, config) {
    container.__legendOverlayConfig = config || null;
  }

  function escapeHtml(value) {
    return String(value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function applyLegendOverlay(container) {
    const existing = container.querySelector('[data-chart-legend-overlay]');
    const config = container.__legendOverlayConfig;
    if (!config || !config.items || !config.items.length) {
      if (existing) existing.remove();
      return;
    }
    if (!container.style.position) container.style.position = 'relative';
    const overlay = existing || document.createElement('div');
    const layout = config.layout;
    const bg = config.dark ? '#2A2630' : '#F3EDF7';
    const border = config.dark ? '#938F99' : '#79747E';
    const titleColor = config.dark ? '#938F99' : '#79747E';
    const textColor = config.dark ? '#E6E0E9' : '#1C1B1F';
    overlay.setAttribute('data-chart-legend-overlay', 'true');
    overlay.style.position = 'absolute';
    overlay.style.right = layout.right + 'px';
    overlay.style.top = layout.top + 'px';
    overlay.style.bottom = layout.bottom + 'px';
    overlay.style.width = layout.width + 'px';
    overlay.style.background = bg;
    overlay.style.border = '1px solid ' + border;
    overlay.style.borderRadius = '14px';
    overlay.style.overflowY = 'auto';
    overlay.style.scrollbarWidth = 'none';
    overlay.style.msOverflowStyle = 'none';
    overlay.style.padding = layout.paddingTop + 'px ' + layout.paddingX + 'px ' + layout.paddingBottom + 'px';
    overlay.style.boxSizing = 'border-box';
    overlay.style.zIndex = '4';
    overlay.style.pointerEvents = 'auto';
    overlay.innerHTML =
      '<div style="position:sticky;top:0;background:' + bg + ';margin-top:-' + layout.paddingTop + 'px;padding-top:' + layout.paddingTop + 'px;padding-bottom:4px;color:' + titleColor + ';font:500 ' + layout.titleFont + 'px Roboto, Helvetica Neue, Arial, sans-serif;letter-spacing:0.02em;line-height:1;z-index:1;">SERIES</div>' +
      '<div style="display:grid;gap:6px;">' +
      config.items.map(function(item) {
        return '<div style="display:flex;align-items:center;gap:8px;min-width:0;">' +
          '<span style="width:' + layout.swatch + 'px;height:' + layout.swatch + 'px;border-radius:3px;background:' + item.color + ';flex:0 0 auto;"></span>' +
          '<span style="color:' + textColor + ';font:400 ' + layout.itemFont + 'px Roboto, Helvetica Neue, Arial, sans-serif;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">' + escapeHtml(item.name) + '</span>' +
        '</div>';
      }).join('') +
      '</div>';
    if (!existing) container.appendChild(overlay);
  }

  function getChartMode(chart) {
    const width = chart.getWidth();
    const height = chart.getHeight();
    if (width < 420 || height < 180) return 'compact';
    if (width < 700 || height < 300) return 'medium';
    return 'wide';
  }

  function isCompactChart(chart) {
    return getChartMode(chart) === 'compact';
  }

  function isMediumChart(chart) {
    return getChartMode(chart) === 'medium';
  }

  function legendPanelMetrics(chart, count, compactRowStartY, regularRowStartY) {
    const mode = getChartMode(chart);
    const compact = mode === 'compact';
    const medium = mode === 'medium';
    const panelWidth = compact ? 0 : (medium ? 106 : 124);
    const panelY = compact ? 0 : (medium ? 6 : 8);
    const panelHeight = compact ? 0 : Math.min(medium ? 172 : 220, Math.max(medium ? 138 : 180, chart.getHeight() - panelY - 8));
    const rowStartY = compact ? 0 : (medium ? (compactRowStartY || 32) : (regularRowStartY || 38));
    return {
      mode: mode,
      compact: compact,
      medium: medium,
      panelWidth: panelWidth,
      panelX: compact ? 0 : Math.max(0, chart.getWidth() - panelWidth - (medium ? 8 : 12)),
      panelY: panelY,
      panelHeight: panelHeight,
      rowStartY: rowStartY,
      rowHeight: compact ? 0 : Math.floor((panelHeight - rowStartY - 10) / count)
    };
  }

  function compactScrollLegend(items, colors, dark) {
    return {
      type: 'scroll',
      orient: 'vertical',
      right: 4,
      top: 10,
      bottom: 14,
      width: 88,
      itemWidth: 8,
      itemHeight: 8,
      itemGap: 4,
      icon: 'roundRect',
      pageIconColor: dark ? '#E6E0E9' : '#1C1B1F',
      pageIconInactiveColor: dark ? '#938F99' : '#79747E',
      pageTextStyle: { color: dark ? '#938F99' : '#79747E', fontSize: 8 },
      textStyle: {
        color: dark ? '#E6E0E9' : '#1C1B1F',
        fontSize: 10,
        fontFamily: 'Roboto, Helvetica Neue, Arial, sans-serif'
      },
      backgroundColor: dark ? '#2A2630' : '#F3EDF7',
      borderColor: dark ? '#938F99' : '#79747E',
      borderWidth: 1,
      borderRadius: 12,
      padding: [24, 8, 10, 8],
      formatter: function(name) { return name; },
      data: items.map(function(name, idx) {
        return { name: name, icon: 'roundRect', itemStyle: { color: colors[idx] } };
      })
    };
  }

  function compactLegendTitle(chart, dark) {
    return [{
      type: 'text',
      right: 18,
      top: 20,
      silent: true,
      z: 100,
      zlevel: 10,
      style: {
        text: 'SERIES',
        fill: dark ? '#938F99' : '#79747E',
        font: '500 8px Roboto, Helvetica Neue, Arial, sans-serif'
      }
    }];
  }

  function truncateTooltipRows(rows, maxRows, dark) {
    if (!Array.isArray(rows) || rows.length <= maxRows) return rows || [];
    const clipped = rows.slice(0, maxRows);
    clipped.push('<div style="margin-top:6px;color:' + (dark ? '#938F99' : '#79747E') + ';font-size:10px;">...</div>');
    return clipped;
  }

  function makeBarChart(container) {
    const categories = ['Cyan', 'Emerald', 'Amber', 'Rose', 'Violet', 'Blue', 'Teal', 'Other'];
    const values = [72, 68, 60, 55, 79, 64, 61, 48];

    function tooltip(state, params) {
      const p = params[0];
      const dark = state.dark;
      return tooltipCard(dark,
        '<div style="color:' + (dark ? '#E6E0E9' : '#1C1B1F') + ';font-size:13px;font-weight:600;">' + p.name + '</div>' +
        '<div style="margin-top:4px;color:' + (dark ? '#CAC4D0' : '#49454F') + ';font-size:10px;">Revenue</div>' +
        '<div style="margin-top:6px;color:' + (dark ? '#E6E0E9' : '#1C1B1F') + ';font-size:11px;font-weight:600;">$' + p.value + 'M</div>',
        '110px'
      );
    }

    function legendGraphic(chart, dark, colors) {
      const metrics = legendPanelMetrics(chart, categories.length);
      const compactLegend = metrics.compact;
      const panelWidth = compactLegend ? 94 : metrics.panelWidth;
      const panelX = compactLegend ? Math.max(0, chart.getWidth() - panelWidth - 8) : metrics.panelX;
      const panelY = compactLegend ? 10 : metrics.panelY;
      const panelHeight = compactLegend ? Math.min(144, Math.max(126, chart.getHeight() - panelY - 10)) : metrics.panelHeight;
      const rowStartY = compactLegend ? 30 : metrics.rowStartY;
      const rowHeight = compactLegend ? 12 : metrics.rowHeight;
      const smallLegend = metrics.compact || metrics.medium;
      const markerSize = smallLegend ? 8 : 14;
      const markerRadius = smallLegend ? 2 : 3;
      const titleFont = smallLegend ? '500 8px Roboto, Helvetica Neue, Arial, sans-serif' : '500 10px Roboto, Helvetica Neue, Arial, sans-serif';
      const labelFont = smallLegend ? '400 7px Roboto, Helvetica Neue, Arial, sans-serif' : '400 11px Roboto, Helvetica Neue, Arial, sans-serif';
      const group = {
        type: 'group', left: panelX, top: panelY, bounding: 'all',
        children: [{
          type: 'rect',
          shape: { x: 0, y: 0, width: panelWidth, height: panelHeight, r: 14 },
          style: { fill: dark ? '#2A2630' : '#F3EDF7', stroke: dark ? '#938F99' : '#79747E', lineWidth: 1, opacity: dark ? 0.95 : 1 }
        }, {
          type: 'text',
          style: { x: smallLegend ? 10 : 18, y: smallLegend ? 13 : 18, text: 'SERIES', fill: dark ? '#938F99' : '#79747E', font: titleFont }
        }]
      };
      categories.forEach(function(name, idx) {
        const y = rowStartY + idx * rowHeight;
        group.children.push({ type: 'rect', shape: { x: smallLegend ? 10 : 18, y: y - Math.round(markerSize / 2), width: markerSize, height: markerSize, r: markerRadius }, style: { fill: colors[idx], opacity: 1 } });
        group.children.push({ type: 'text', style: { x: smallLegend ? 22 : 40, y: y, text: name, textVerticalAlign: 'middle', fill: dark ? '#E6E0E9' : '#1C1B1F', font: labelFont } });
      });
      return [group];
    }

    return createManagedChart(container, function(chart, state, containerEl) {
      const dark = state.dark;
      const compact = isCompactChart(chart);
      const medium = isMediumChart(chart);
      const darkPalette = ['#22D3EE', '#10B981', '#FBB724', '#FB6181', '#A78BFA', '#60A5FA', '#2DD4BF', '#94A3B8'];
      const colors = dark ? darkPalette : state.colors;
      setLegendOverlayConfig(containerEl, {
        dark: dark,
        layout: legendOverlayLayout(chart),
        items: categories.map(function(name, idx) { return { name: name, color: colors[idx] }; })
      });
      return {
        animationDuration: 400,
        animationDurationUpdate: 250,
        animationEasing: 'cubicOut',
        color: colors,
        backgroundColor: 'transparent',
        grid: { left: compact ? 26 : (medium ? 30 : 48), right: legendGridRight(chart), top: compact ? 16 : 24, bottom: compact ? 28 : 40 },
        tooltip: {
          trigger: 'axis',
          confine: true,
          axisPointer: { type: 'shadow', shadowStyle: { color: dark ? 'rgba(255,255,255,0.04)' : 'rgba(121,116,126,0.08)' } },
          backgroundColor: 'transparent',
          borderWidth: 0,
          padding: 0,
          extraCssText: 'box-shadow:none;background:transparent;',
          formatter: function(params) { return tooltip(state, params); },
          position: function(pos, params, dom, rect, size) { return smartTooltipPosition(pos, rect, size, dom, dark, true, 20); }
        },
        graphic: [],
        xAxis: { type: 'category', data: categories, axisLine: { lineStyle: { color: dark ? '#938F99' : '#79747E', width: 1.5 } }, axisTick: { show: false }, axisLabel: { color: dark ? '#938F99' : '#79747E', fontSize: compact ? 8 : (medium ? 9 : 10), margin: compact ? 8 : (medium ? 10 : 14), interval: compact ? 1 : 0 } },
        yAxis: { type: 'value', min: 0, max: 100, interval: compact ? 50 : 25, axisLine: { show: true, lineStyle: { color: dark ? '#938F99' : '#79747E', width: 1.5 } }, axisTick: { show: false }, axisLabel: { color: dark ? '#938F99' : '#79747E', fontSize: compact ? 8 : (medium ? 9 : 10), formatter: function(v) { return '$' + v + 'M'; } }, splitLine: { lineStyle: { color: dark ? '#49454F' : '#E7E0EC' } } },
        series: [{ type: 'bar', name: 'Revenue', barWidth: compact ? 18 : (medium ? 24 : 30), animationEasing: 'cubicOut', animationDelay: function(idx) { return idx * 224; }, data: values.map(function(value, idx) { return { value: value, itemStyle: { color: colors[idx % colors.length] } }; }), itemStyle: { borderRadius: [5, 5, 5, 5] }, emphasis: { focus: 'self', blurScope: 'coordinateSystem' }, blur: { itemStyle: { opacity: 0.2 } }, label: { show: false } }]
      };
    });
  }

  function makeParetoChart(container) {
    const data = [
      { name: 'Violet', value: 79, paletteIndex: 4 },
      { name: 'Cyan', value: 72, paletteIndex: 0 },
      { name: 'Emerald', value: 68, paletteIndex: 1 },
      { name: 'Blue', value: 64, paletteIndex: 5 },
      { name: 'Teal', value: 61, paletteIndex: 6 },
      { name: 'Amber', value: 60, paletteIndex: 2 },
      { name: 'Rose', value: 55, paletteIndex: 3 },
      { name: 'Other', value: 48, paletteIndex: 7 }
    ];
    const total = data.reduce(function(sum, item) { return sum + item.value; }, 0);
    let running = 0;
    data.forEach(function(item) {
      item.share = item.value / total * 100;
      running += item.value;
      item.cumulative = running / total * 100;
    });
    const paretoCutoffIndex = data.findIndex(function(item) { return item.cumulative >= 79.7; });

    function tooltip(state, params) {
      const dark = state.dark;
      const barParam = params.find(function(param) { return param.seriesName === 'Revenue'; }) || params[0];
      const item = data[barParam.dataIndex];
      const paretoColor = dark ? '#A78BFA' : '#8B5CF6';
      return tooltipCard(dark,
        '<div style="color:' + (dark ? '#E6E0E9' : '#1C1B1F') + ';font-size:13px;font-weight:600;">' + item.name + '</div>' +
        '<div style="margin-top:4px;color:' + (dark ? '#CAC4D0' : '#49454F') + ';font-size:10px;">Revenue</div>' +
        '<div style="margin-top:6px;color:' + (dark ? '#E6E0E9' : '#1C1B1F') + ';font-size:11px;font-weight:600;">$' + item.value + 'M</div>' +
        '<div style="margin-top:4px;color:' + paretoColor + ';font-size:10px;font-weight:600;">' + item.share.toFixed(1) + '% share · cum. ' + item.cumulative.toFixed(1) + '%</div>',
        '128px'
      );
    }

    return createManagedChart(container, function(chart, state, containerEl) {
      const dark = state.dark;
      const compact = isCompactChart(chart);
      const medium = isMediumChart(chart);
      const darkBase = ['#22D3EE', '#10B981', '#FBB724', '#FB6181', '#A78BFA', '#60A5FA', '#2DD4BF', '#94A3B8'];
      const baseColors = dark ? darkBase : state.colors;
      const colors = data.map(function(item) { return baseColors[item.paletteIndex]; });
      const paretoColor = dark ? '#A78BFA' : '#8B5CF6';
      const gridLeft = compact ? 28 : (medium ? 32 : 48);
      const gridRight = compact ? 28 : (legendGridRight(chart) + (medium ? 26 : 34));
      const gridTop = compact ? 18 : 24;
      const gridBottom = compact ? 34 : 42;
      const plotWidth = Math.max(180, chart.getWidth() - gridLeft - gridRight);
      const plotHeight = Math.max(120, chart.getHeight() - gridTop - gridBottom);
      const rightGrid40Y = gridTop + plotHeight * 0.6;
      const rightGrid80Y = gridTop + plotHeight * 0.2;
      const lineDelayBase = (data.length - 1) * 120 + 900;
      setLegendOverlayConfig(containerEl, {
        dark: dark,
        layout: legendOverlayLayout(chart),
        items: data.map(function(item, idx) {
          return { name: item.name + ' $' + item.value + 'M', color: colors[idx] };
        }).concat([
          { name: 'Cumulative %', color: paretoColor },
          { name: 'Top ' + (paretoCutoffIndex + 1) + ' of ' + data.length + ' = ' + data[paretoCutoffIndex].cumulative.toFixed(1) + '%', color: dark ? '#938F99' : '#79747E' },
          { name: 'of total revenue', color: dark ? '#938F99' : '#79747E' }
        ])
      });

      return {
        animationDuration: 800,
        animationDurationUpdate: 250,
        animationEasing: 'cubicOut',
        backgroundColor: 'transparent',
        color: colors,
        grid: { left: gridLeft, right: gridRight, top: gridTop, bottom: gridBottom },
        tooltip: {
          trigger: 'axis',
          confine: true,
          axisPointer: { type: 'shadow', shadowStyle: { color: dark ? 'rgba(255,255,255,0.04)' : 'rgba(121,116,126,0.08)' } },
          backgroundColor: 'transparent',
          borderWidth: 0,
          padding: 0,
          extraCssText: 'box-shadow:none;background:transparent;',
          formatter: function(params) { return tooltip(state, params); },
          position: function(pos, params, dom, rect, size) { return smartTooltipPosition(pos, rect, size, dom, dark, true, 20); }
        },
        graphic: compact ? [] : [{
          type: 'line',
          shape: { x1: gridLeft, y1: rightGrid40Y, x2: gridLeft + plotWidth, y2: rightGrid40Y },
          style: { stroke: dark ? '#4F4A8A' : '#C7B8F5', lineWidth: 1, lineDash: [4, 3], opacity: 0.7 }
        }, {
          type: 'line',
          shape: { x1: gridLeft, y1: rightGrid80Y, x2: gridLeft + plotWidth, y2: rightGrid80Y },
          style: { stroke: paretoColor, lineWidth: 1.2, lineDash: [5, 4], opacity: 0.55 }
        }],
        xAxis: {
          type: 'category',
          data: data.map(function(item) { return item.name; }),
          axisLine: { lineStyle: { color: dark ? '#938F99' : '#79747E', width: 1.5 } },
          axisTick: { show: false },
          axisLabel: { color: dark ? '#938F99' : '#79747E', fontSize: compact ? 8 : (medium ? 9 : 10), margin: compact ? 8 : 14, interval: 0 }
        },
        yAxis: [{
          type: 'value',
          min: 0,
          max: 100,
          interval: compact ? 50 : 25,
          axisLine: { show: true, lineStyle: { color: dark ? '#938F99' : '#79747E', width: 1.5 } },
          axisTick: { show: false },
          axisLabel: { color: dark ? '#938F99' : '#79747E', fontSize: compact ? 8 : (medium ? 9 : 10), formatter: function(v) { return '$' + v + (v === 0 ? '' : 'M'); } },
          splitLine: { lineStyle: { color: dark ? '#49454F' : '#E7E0EC' } }
        }, {
          type: 'value',
          min: 0,
          max: 100,
          position: 'right',
          axisLine: { show: true, lineStyle: { color: dark ? '#938F99' : '#79747E', width: 1.5, opacity: 0.4 } },
          axisTick: { show: false },
          axisLabel: {
            color: paretoColor,
            fontSize: compact ? 8 : (medium ? 9 : 10),
            margin: compact ? 8 : (medium ? 10 : 12),
            formatter: function(v) {
              return (v === 0 || v === 40 || v === 80 || v === 100) ? (v + '%') : '';
            }
          },
          splitLine: { show: false }
        }],
        series: [{
          type: 'bar',
          name: 'Revenue',
          barWidth: compact ? 18 : (medium ? 24 : 30),
          animationDuration: 800,
          animationEasing: 'cubicOut',
          animationDelay: function(idx) { return idx * 120; },
          data: data.map(function(item, idx) {
            return { value: item.value, itemStyle: { color: colors[idx] } };
          }),
          itemStyle: { borderRadius: [5, 5, 5, 5] },
          emphasis: { focus: 'self', blurScope: 'coordinateSystem' },
          blur: { itemStyle: { opacity: 0.2 } },
          z: 2
        }, {
          type: 'line',
          name: 'Cumulative %',
          yAxisIndex: 1,
          data: data.map(function(item) { return Number(item.cumulative.toFixed(1)); }),
          symbol: 'none',
          smooth: false,
          animationDuration: 500,
          animationDelay: function() { return lineDelayBase; },
          animationEasing: 'cubicOut',
          lineStyle: { color: paretoColor, width: 2.5 },
          itemStyle: { color: paretoColor },
          tooltip: { show: false },
          emphasis: { disabled: true },
          silent: true,
          z: 4,
          markLine: compact ? undefined : {
            silent: true,
            symbol: 'none',
            animation: false,
            lineStyle: { color: paretoColor, width: 1.2, type: 'dashed', opacity: 0.55 },
            label: { show: false },
            data: [{ yAxis: 80 }]
          }
        }, {
          type: 'scatter',
          name: 'Cumulative Dots',
          yAxisIndex: 1,
          data: data.map(function(item) { return Number(item.cumulative.toFixed(1)); }),
          symbolSize: compact ? 6 : 8,
          animationDuration: 250,
          animationDelay: function(idx) { return lineDelayBase + idx * 60; },
          animationEasing: 'cubicOut',
          itemStyle: { color: paretoColor },
          tooltip: { show: false },
          emphasis: { disabled: true },
          silent: true,
          z: 5
        }]
      };
    });
  }

  function makeWaterfallChart(container) {
    const steps = [
      { name: 'Cyan', value: 72, paletteIndex: 0 },
      { name: 'Emerald', value: 68, paletteIndex: 1 },
      { name: 'Amber', value: 60, paletteIndex: 2 },
      { name: 'Rose', value: 55, paletteIndex: 3 },
      { name: 'Violet', value: 79, paletteIndex: 4 },
      { name: 'Blue', value: 64, paletteIndex: 5 },
      { name: 'Teal', value: 61, paletteIndex: 6 },
      { name: 'Other', value: 48, paletteIndex: 7 }
    ];
    let running = 0;
    const bars = steps.map(function(step) {
      const start = running;
      running += step.value;
      return {
        name: step.name,
        value: step.value,
        start: start,
        end: running,
        paletteIndex: step.paletteIndex
      };
    });
    const total = running;
    const categories = steps.map(function(step) { return step.name; }).concat(['Total']);

    function tooltip(state, params) {
      const dark = state.dark;
      const p = params.find(function(param) { return param.seriesName === 'Bridge' || param.seriesName === 'Total'; }) || params[0];
      const item = p.data && p.data.meta ? p.data.meta : null;
      if (!item) return '';
      return tooltipCard(dark,
        '<div style="color:' + (dark ? '#E6E0E9' : '#1C1B1F') + ';font-size:13px;font-weight:600;">' + item.name + '</div>' +
        '<div style="margin-top:4px;color:' + (dark ? '#CAC4D0' : '#49454F') + ';font-size:10px;">' + (item.total ? 'Waterfall total' : 'Cumulative build') + '</div>' +
        '<div style="margin-top:6px;color:' + (dark ? '#E6E0E9' : '#1C1B1F') + ';font-size:11px;font-weight:600;">' + (item.total ? '$' + item.value + 'M' : '+$' + item.value + 'M') + '</div>',
        '124px'
      );
    }

    return createManagedChart(container, function(chart, state, containerEl) {
      const dark = state.dark;
      const compact = isCompactChart(chart);
      const medium = isMediumChart(chart);
      const darkPalette = ['#22D3EE', '#10B981', '#FBB724', '#FB6181', '#A78BFA', '#60A5FA', '#2DD4BF', '#94A3B8'];
      const baseColors = dark ? darkPalette : state.colors;
      const colors = steps.map(function(step) { return baseColors[step.paletteIndex]; });
      const totalColor = dark ? '#60A5FA' : '#3B82F6';
      const connectorColor = dark ? '#49454F' : '#B0A8B9';

      setLegendOverlayConfig(containerEl, {
        dark: dark,
        layout: legendOverlayLayout(chart),
        items: steps.map(function(step, idx) {
          return { name: step.name + ' +$' + step.value + 'M', color: colors[idx] };
        }).concat([{ name: 'Total $' + total + 'M', color: totalColor }])
      });

      const bridgeData = bars.map(function(bar, idx) {
        return {
          value: bar.value,
          itemStyle: { color: colors[idx] },
          meta: { name: bar.name, value: bar.value }
        };
      }).concat([{ value: '-', itemStyle: { color: 'transparent', opacity: 0 }, meta: null }]);

      const baseData = bars.map(function(bar) { return bar.start; }).concat([0]);
      const totalData = bars.map(function() { return '-'; }).concat([{
        value: total,
        itemStyle: { color: totalColor },
        meta: { name: 'Total', value: total, total: true }
      }]);

      const graphic = compact ? [] : bars.map(function(bar, idx) {
        if (idx === bars.length - 1) return null;
        const plotLeft = compact ? 26 : (medium ? 30 : 48);
        const plotRight = legendGridRight(chart);
        const plotTop = compact ? 16 : 24;
        const plotBottom = compact ? 28 : 40;
        const plotWidth = Math.max(180, chart.getWidth() - plotLeft - plotRight);
        const plotHeight = Math.max(120, chart.getHeight() - plotTop - plotBottom);
        const xStep = plotWidth / categories.length;
        const x1 = plotLeft + xStep * (idx + 0.5) + (compact ? 9 : (medium ? 12 : 15));
        const x2 = plotLeft + xStep * (idx + 1.5) - (compact ? 9 : (medium ? 12 : 15));
        const y = plotTop + plotHeight * (1 - (bar.end / 500));
        return {
          type: 'line',
          shape: { x1: x1, y1: y, x2: x2, y2: y },
          style: { stroke: connectorColor, lineWidth: 1, lineDash: [4, 3] },
          silent: true,
          z: 1
        };
      }).filter(Boolean);

      return {
        animationDuration: 800,
        animationDurationUpdate: 250,
        animationEasing: 'cubicOut',
        backgroundColor: 'transparent',
        color: colors,
        grid: { left: compact ? 26 : (medium ? 30 : 48), right: legendGridRight(chart), top: compact ? 16 : 24, bottom: compact ? 28 : 40 },
        tooltip: {
          trigger: 'axis',
          confine: true,
          axisPointer: { type: 'shadow', shadowStyle: { color: dark ? 'rgba(255,255,255,0.04)' : 'rgba(121,116,126,0.08)' } },
          backgroundColor: 'transparent',
          borderWidth: 0,
          padding: 0,
          extraCssText: 'box-shadow:none;background:transparent;',
          formatter: function(params) { return tooltip(state, params); },
          position: function(pos, params, dom, rect, size) { return smartTooltipPosition(pos, rect, size, dom, dark, true, 20); }
        },
        graphic: graphic,
        xAxis: {
          type: 'category',
          data: categories,
          axisLine: { lineStyle: { color: dark ? '#938F99' : '#79747E', width: 1.5 } },
          axisTick: { show: false },
          axisLabel: { color: dark ? '#938F99' : '#79747E', fontSize: compact ? 8 : (medium ? 9 : 10), margin: compact ? 8 : 14, interval: 0 }
        },
        yAxis: {
          type: 'value',
          min: 0,
          max: 500,
          interval: compact ? 100 : 100,
          axisLine: { show: true, lineStyle: { color: dark ? '#938F99' : '#79747E', width: 1.5 } },
          axisTick: { show: false },
          axisLabel: { color: dark ? '#938F99' : '#79747E', fontSize: compact ? 8 : (medium ? 9 : 10), formatter: function(v) { return '$' + v + (v === 0 ? '' : 'M'); } },
          splitLine: { lineStyle: { color: dark ? '#49454F' : '#E7E0EC' } }
        },
        series: [{
          type: 'bar',
          name: 'Base',
          stack: 'waterfall',
          silent: true,
          itemStyle: { color: 'transparent' },
          emphasis: { disabled: true },
          data: baseData,
          tooltip: { show: false }
        }, {
          type: 'bar',
          name: 'Bridge',
          stack: 'waterfall',
          barWidth: compact ? 18 : (medium ? 24 : 30),
          animationDuration: 800,
          animationEasing: 'cubicOut',
          animationDelay: function(idx) { return idx * 111; },
          data: bridgeData,
          itemStyle: { borderRadius: [5, 5, 5, 5] },
          emphasis: { focus: 'self', blurScope: 'coordinateSystem' },
          blur: { itemStyle: { opacity: 0.2 } },
          z: 2
        }, {
          type: 'bar',
          name: 'Total',
          barWidth: compact ? 18 : (medium ? 24 : 30),
          animationDuration: 800,
          animationEasing: 'cubicOut',
          animationDelay: function() { return bars.length * 111; },
          data: totalData,
          itemStyle: { borderRadius: [5, 5, 5, 5], color: totalColor },
          emphasis: { focus: 'self', blurScope: 'coordinateSystem' },
          blur: { itemStyle: { opacity: 0.2 } },
          z: 3
        }]
      };
    });
  }

  function makeSunburstChart(container) {
    const categories = [
      { name: 'Violet', value: 79, paletteIndex: 4, quarters: [18, 20, 21, 20] },
      { name: 'Cyan', value: 72, paletteIndex: 0, quarters: [16, 18, 20, 18] },
      { name: 'Emerald', value: 68, paletteIndex: 1, quarters: [15, 17, 18, 18] },
      { name: 'Blue', value: 64, paletteIndex: 5, quarters: [14, 16, 17, 17] },
      { name: 'Teal', value: 61, paletteIndex: 6, quarters: [13, 15, 16, 17] },
      { name: 'Amber', value: 60, paletteIndex: 2, quarters: [13, 15, 16, 16] },
      { name: 'Rose', value: 55, paletteIndex: 3, quarters: [12, 13, 15, 15] },
      { name: 'Other', value: 48, paletteIndex: 7, quarters: [11, 12, 12, 13] }
    ];
    const quarterNames = ['Q1', 'Q2', 'Q3', 'Q4'];
    const total = categories.reduce(function(sum, item) { return sum + item.value; }, 0);

    function blendToward(baseHex, targetHex, ratio) {
      const from = echarts.color.parse(baseHex);
      const to = echarts.color.parse(targetHex);
      const mixed = [0, 1, 2].map(function(i) {
        return Math.round(from[i] + (to[i] - from[i]) * ratio);
      });
      return 'rgb(' + mixed.join(',') + ')';
    }

    function buildSunburstData(baseColors, dark) {
      const bg = dark ? '#1C1B1F' : '#FFFBFE';
      const blends = dark ? [0.32, 0.18, 0.08, 0.0] : [0.72, 0.48, 0.24, 0.0];
      return categories.map(function(category) {
        const baseColor = baseColors[category.paletteIndex];
        return {
          name: category.name,
          value: category.value,
          itemStyle: { color: baseColor },
          children: category.quarters.map(function(value, idx) {
            return {
              name: quarterNames[idx],
              value: value,
              fullName: category.name + ' · ' + quarterNames[idx],
              itemStyle: { color: blendToward(baseColor, bg, blends[idx]) }
            };
          })
        };
      });
    }

    function tooltip(state, param) {
      const dark = state.dark;
      const treePath = (param.treePathInfo || []).slice(1);
      const label = treePath.length > 1 ? (treePath[0].name + ' · ' + treePath[1].name) : param.name;
      const amount = param.value || 0;
      const pctText = treePath.length > 1
        ? ((amount / treePath[0].value) * 100).toFixed(0) + '% of ' + treePath[0].name
        : ((amount / total) * 100).toFixed(1) + '% of total';
      return tooltipCard(dark,
        '<div style="color:' + (dark ? '#E6E0E9' : '#1C1B1F') + ';font-size:13px;font-weight:600;">' + label + '</div>' +
        '<div style="margin-top:4px;color:' + (dark ? '#CAC4D0' : '#49454F') + ';font-size:10px;">Revenue breakdown</div>' +
        '<div style="margin-top:6px;color:' + (dark ? '#E6E0E9' : '#1C1B1F') + ';font-size:11px;font-weight:600;">$' + amount + 'M</div>' +
        '<div style="margin-top:4px;color:' + (dark ? '#938F99' : '#79747E') + ';font-size:10px;">' + pctText + '</div>',
        '136px'
      );
    }

    return createManagedChart(container, function(chart, state, containerEl) {
      const dark = state.dark;
      const compact = isCompactChart(chart);
      const medium = isMediumChart(chart);
      const darkPalette = ['#22D3EE', '#10B981', '#FBB724', '#FB6181', '#A78BFA', '#60A5FA', '#2DD4BF', '#94A3B8'];
      const baseColors = dark ? darkPalette : state.colors;
      const data = buildSunburstData(baseColors, dark);
      const centerX = compact ? '34%' : (medium ? '36%' : '39%');
      const centerY = compact ? '53%' : '54%';
      const radius = compact ? ['22%', '78%'] : (medium ? ['20%', '80%'] : ['18%', '82%']);
      const categoryOrder = [4, 0, 1, 5, 6, 2, 3, 7];

      setLegendOverlayConfig(containerEl, {
        dark: dark,
        layout: legendOverlayLayout(chart),
        items: categoryOrder.map(function(idx) {
          return { name: categories.find(function(c) { return c.paletteIndex === idx; }).name + ' $' + categories.find(function(c) { return c.paletteIndex === idx; }).value + 'M', color: baseColors[idx] };
        }).concat([
          { name: 'Q1 · lightest', color: dark ? '#6d7d91' : '#D5D8DE' },
          { name: 'Q2 · mid-light', color: dark ? '#546173' : '#B4BBC6' },
          { name: 'Q3 · mid-dark', color: dark ? '#3D4756' : '#8F98A7' },
          { name: 'Q4 · darkest', color: dark ? '#2A313C' : '#5F697A' }
        ])
      });

      return {
        animationDuration: 1200,
        animationDurationUpdate: 250,
        animationEasing: 'cubicOut',
        backgroundColor: 'transparent',
        tooltip: {
          trigger: 'item',
          confine: true,
          backgroundColor: 'transparent',
          borderWidth: 0,
          padding: 0,
          extraCssText: 'box-shadow:none;background:transparent;',
          formatter: function(param) { return tooltip(state, param); },
          position: function(pos, params, dom, rect, size) { return smartTooltipPosition(pos, rect, size, dom, dark, true, 20); }
        },
        graphic: [{
          type: 'group',
          left: centerX,
          top: centerY,
          bounding: 'raw',
          children: [{
            type: 'text',
            style: {
              x: 0,
              y: -10,
              text: 'Total',
              textAlign: 'center',
              textVerticalAlign: 'middle',
              fill: dark ? '#938F99' : '#79747E',
              font: '400 ' + (compact ? 9 : 10) + 'px Roboto, Helvetica Neue, Arial, sans-serif'
            }
          }, {
            type: 'text',
            style: {
              x: 0,
              y: 10,
              text: '$' + total + 'M',
              textAlign: 'center',
              textVerticalAlign: 'middle',
              fill: dark ? '#E6E0E9' : '#1C1B1F',
              font: '600 ' + (compact ? 13 : 20) + 'px Roboto, Helvetica Neue, Arial, sans-serif'
            }
          }, {
            type: 'text',
            style: {
              x: 0,
              y: compact ? 26 : 30,
              text: 'total revenue',
              textAlign: 'center',
              textVerticalAlign: 'middle',
              fill: dark ? '#938F99' : '#79747E',
              font: '400 ' + (compact ? 8 : 10) + 'px Roboto, Helvetica Neue, Arial, sans-serif'
            }
          }]
        }],
        series: [{
          type: 'sunburst',
          center: [centerX, centerY],
          radius: radius,
          sort: null,
          nodeClick: false,
          emphasis: { focus: 'ancestor' },
          blur: { itemStyle: { opacity: 0.2 } },
          label: {
            rotate: 'radial',
            color: '#FFFBFE',
            fontSize: compact ? 8 : 9,
            formatter: function(param) {
              return param.treePathInfo && param.treePathInfo.length === 2 ? param.name : '';
            }
          },
          itemStyle: {
            borderColor: dark ? '#151825' : '#FFFBFE',
            borderWidth: 1
          },
          levels: [{
          }, {
            r0: compact ? '22%' : (medium ? '20%' : '18%'),
            r: compact ? '46%' : (medium ? '46%' : '44%'),
            label: { rotate: 'radial', color: '#FFFBFE', fontSize: compact ? 8 : 9 },
            itemStyle: { borderColor: dark ? '#151825' : '#FFFBFE', borderWidth: 1 }
          }, {
            r0: compact ? '47%' : (medium ? '47%' : '45%'),
            r: compact ? '78%' : (medium ? '80%' : '82%'),
            label: {
              color: '#FFFBFE',
              fontSize: compact ? 7 : 8,
              formatter: function(param) { return '$' + param.value + 'M'; }
            },
            itemStyle: { borderColor: dark ? '#151825' : '#FFFBFE', borderWidth: 1 }
          }],
          data: data
        }]
      };
    });
  }

  function makeCirclePackingChart(container) {
    const shippingClasses = [
      { id: 'standard', name: 'Standard Class', shortLabel: ['Standard', 'Class'], value: 5968, pct: 54, colorIndex: 1, depth: 1, offsetX: -77, offsetY: -20, radius: 120, fontSize: 13 },
      { id: 'first', name: 'First Class', shortLabel: ['First Class'], value: 1992, pct: 18, colorIndex: 5, depth: 1, offsetX: 115, offsetY: -51, radius: 75, fontSize: 12 },
      { id: 'second', name: 'Second Class', shortLabel: ['Second Class'], value: 1945, pct: 18, colorIndex: 4, depth: 1, offsetX: 61, offsetY: 112, radius: 72, fontSize: 12 },
      { id: 'same-day', name: 'Same Day', shortLabel: ['Same Day'], value: 543, pct: 5, colorIndex: 2, depth: 2, offsetX: 153, offsetY: 55, radius: 37, fontSize: 10 }
    ];
    const totalOrders = 10447;

    function blendToward(baseHex, targetHex, ratio) {
      const from = echarts.color.parse(baseHex);
      const to = echarts.color.parse(targetHex);
      const mixed = [0, 1, 2].map(function(i) {
        return Math.round(from[i] + (to[i] - from[i]) * ratio);
      });
      return 'rgb(' + mixed.join(',') + ')';
    }

    function depthTint(baseHex, depth, dark) {
      const bg = dark ? '#2C2B30' : '#FFFBFE';
      const blend = depth <= 1 ? 0 : 0.45;
      return blendToward(baseHex, bg, blend);
    }

    function tooltip(state, param) {
      const dark = state.dark;
      const meta = (param.data && param.data.meta) || {};
      return tooltipCard(dark,
        '<div style="color:' + (dark ? '#E6E0E9' : '#1C1B1F') + ';font-size:13px;font-weight:600;">' + (meta.value || 0).toLocaleString() + '</div>' +
        '<div style="margin-top:4px;color:' + (dark ? '#CAC4D0' : '#49454F') + ';font-size:10px;">' + (meta.name || '') + ' · ' + (meta.pct || 0) + '% of orders</div>',
        '148px'
      );
    }

    return createManagedChart(container, function(chart, state, containerEl) {
      const dark = state.dark;
      const compact = isCompactChart(chart);
      const medium = isMediumChart(chart);
      const darkPalette = ['#22D3EE', '#10B981', '#FBB724', '#FB6181', '#A78BFA', '#60A5FA', '#2DD4BF', '#94A3B8'];
      const palette = dark ? darkPalette : state.colors;
      const legendLayout = legendOverlayLayout(chart);
      const plotLeft = compact ? 20 : (medium ? 28 : 36);
      const plotRight = legendGridRight(chart) + (compact ? 8 : 10);
      const plotTop = compact ? 16 : 18;
      const plotBottom = compact ? 18 : 22;
      const plotWidth = Math.max(180, chart.getWidth() - plotLeft - plotRight);
      const plotHeight = Math.max(160, chart.getHeight() - plotTop - plotBottom);
      const rootR = Math.min(plotHeight / 2, plotWidth / 2) - (compact ? 8 : 12);
      const rootX = plotLeft + plotWidth / 2;
      const rootY = plotTop + plotHeight / 2;
      const scale = rootR / 200;
      const outerStroke = dark ? '#49454F' : '#E7E0EC';
      const labelColor = dark ? '#E6E0E9' : '#1C1B1F';
      const data = shippingClasses.map(function(item) {
        return {
          id: item.id,
          value: [
            rootX + item.offsetX * scale,
            rootY + item.offsetY * scale,
            item.radius * scale
          ],
          meta: {
            name: item.name,
            pct: item.pct,
            value: item.value,
            depth: item.depth,
            labels: item.shortLabel,
            fill: depthTint(palette[item.colorIndex], item.depth, dark),
            fontSize: Math.max(8, item.fontSize * scale * (compact ? 0.92 : 1))
          }
        };
      });

      setLegendOverlayConfig(containerEl, {
        dark: dark,
        layout: legendLayout,
        items: shippingClasses.map(function(item) {
          return { name: item.name + ' ' + item.value.toLocaleString(), color: palette[item.colorIndex] };
        }).concat([{ name: 'Total Orders ' + totalOrders.toLocaleString(), color: dark ? '#938F99' : '#79747E' }])
      });

      function renderNode(params, api) {
        const item = data[params.dataIndex];
        const x = api.value(0);
        const y = api.value(1);
        const r = api.value(2);
        const meta = item.meta;
        const children = [{
          type: 'circle',
          shape: { cx: x, cy: y, r: r },
          style: { fill: meta.fill },
          transition: ['shape', 'style']
        }];
        const lineOffset = meta.labels.length > 1 ? Math.min(10, r * 0.14) : 0;
        meta.labels.forEach(function(line, idx) {
          children.push({
            type: 'text',
            silent: true,
            style: {
              x: x,
              y: y + (idx === 0 ? -lineOffset : lineOffset),
              text: line,
              textAlign: 'center',
              textVerticalAlign: 'middle',
              fill: labelColor,
              font: '500 ' + Math.max(8, meta.fontSize) + 'px Roboto, Helvetica Neue, Arial, sans-serif'
            }
          });
        });
        return { type: 'group', children: children };
      }

      const graphics = [{
        type: 'circle',
        silent: true,
        shape: { cx: rootX, cy: rootY, r: rootR },
        style: { stroke: outerStroke, lineWidth: compact ? 1 : 1.5, fill: 'transparent' }
      }];

      return {
        animationDuration: 900,
        animationDurationUpdate: 250,
        animationEasing: 'cubicOut',
        backgroundColor: 'transparent',
        tooltip: {
          trigger: 'item',
          confine: true,
          backgroundColor: 'transparent',
          borderWidth: 0,
          padding: 0,
          extraCssText: 'box-shadow:none;background:transparent;',
          formatter: function(param) { return tooltip(state, param); },
          position: function(pos, params, dom, rect, size) { return smartTooltipPosition(pos, rect, size, dom, dark, true, 20); }
        },
        xAxis: { type: 'value', min: 0, max: chart.getWidth(), show: false },
        yAxis: { type: 'value', min: 0, max: chart.getHeight(), show: false },
        grid: { left: 0, right: 0, top: 0, bottom: 0 },
        graphic: graphics,
        series: [{
          type: 'custom',
          coordinateSystem: 'cartesian2d',
          renderItem: renderNode,
          data: data,
          z: 3,
          animationDelay: function(idx) { return idx * 140; },
          emphasis: { focus: 'self' },
          blur: { itemStyle: { opacity: 0.2 } }
        }]
      };
    });
  }

  function makeIcicleChart(container) {
    let introPlayed = false;
    let introTimer = null;
    const totalValue = 819293;
    const chartTop = 100;
    const chartHeight = 400;
    const nodes = [
      ['flare', 819293, 0, 1],
      ['analytics', 48716, 1, 1], ['animate', 93278, 1, 2], ['data', 30284, 1, 3],
      ['display', 24254, 1, 4], ['flex', 4877, 1, 5], ['physics', 29934, 1, 6],
      ['query', 75492, 1, 7], ['scale', 31294, 1, 8], ['util', 91480, 1, 2], ['vis', 389684, 1, 3],
      ['cluster', 15207, 2, 1], ['graph', 26435, 2, 1], ['optimization', 7074, 2, 1],
      ['Easing', 17010, 2, 2], ['FunctionSequence', 5842, 2, 2], ['interpolate', 23457, 2, 2],
      ['Parallel', 5176, 2, 2], ['Scheduler', 5593, 2, 2], ['Sequence', 5534, 2, 2],
      ['Transition', 9201, 2, 2], ['Transitioner', 19975, 2, 2],
      ['converters', 18349, 2, 3], ['DataField', 1759, 2, 3], ['DataSchema', 2165, 2, 3],
      ['DataSource', 3331, 2, 3], ['DataUtil', 3322, 2, 3],
      ['DirtySprite', 8833, 2, 4], ['LineSprite', 1732, 2, 4], ['RectSprite', 3623, 2, 4], ['TextSprite', 10066, 2, 4],
      ['FlexSprite', 4877, 2, 5],
      ['NBodyForce', 10498, 2, 6], ['Particle', 2822, 2, 6], ['Simulation', 9983, 2, 6],
      ['Spring', 2213, 2, 6], ['SpringForce', 1681, 2, 6],
      ['AggregateExpression', 1616, 2, 7], ['Arithmetic', 3891, 2, 7], ['Comparison', 5103, 2, 7],
      ['DateUtil', 4141, 2, 7], ['Expression', 5130, 2, 7], ['Fn', 3240, 2, 7],
      ['Query', 13896, 2, 7], ['StringUtil', 4130, 2, 7],
      ['LogScale', 3151, 2, 8], ['OrdinalScale', 3770, 2, 8], ['QuantitativeScale', 4839, 2, 8],
      ['Scale', 4268, 2, 8], ['TimeScale', 5833, 2, 8],
      ['Arrays', 8258, 2, 2], ['Colors', 10001, 2, 2], ['Dates', 8217, 2, 2], ['Displays', 12555, 2, 2],
      ['Geometry', 10993, 2, 2], ['math', 9346, 2, 2], ['Property', 5559, 2, 2],
      ['Sort', 6887, 2, 2], ['Stats', 6557, 2, 2],
      ['axis', 33886, 2, 3], ['controls', 53040, 2, 3], ['vis_data', 110230, 2, 3],
      ['legend', 36003, 2, 3], ['operator', 139985, 2, 3],
      ['Axis', 24593, 3, 3], ['CartesianAxes', 6703, 3, 3],
      ['AnchorControl', 2138, 3, 3], ['ClickControl', 3824, 3, 3], ['ControlList', 4665, 3, 3],
      ['DragControl', 2649, 3, 3], ['HoverControl', 4896, 3, 3], ['NavigationControl', 7862, 3, 3],
      ['PanZoomControl', 5771, 3, 3], ['SelectionControl', 7852, 3, 3], ['TooltipControl', 8435, 3, 3],
      ['Data', 20544, 3, 3], ['DataList', 19788, 3, 3], ['DataSprite', 10349, 3, 3],
      ['NodeSprite', 19382, 3, 3], ['render', 8514, 3, 3], ['ScaleBinding', 11275, 3, 3], ['Tree', 7147, 3, 3],
      ['Legend', 20859, 3, 3], ['LegendItem', 4614, 3, 3], ['LegendRange', 10530, 3, 3],
      ['distortion', 14219, 3, 3], ['encoder', 10759, 3, 3], ['filter_op', 11893, 3, 3],
      ['label', 17057, 3, 3], ['layout', 67804, 3, 3],
      ['AxisLayout', 6702, 4, 3], ['CircleLayout', 5618, 4, 3], ['CirclePackingLayout', 12003, 4, 3],
      ['ForceDirectedLayout', 8411, 4, 3], ['IcicleTreeLayout', 4864, 4, 3], ['RadialTreeLayout', 7982, 4, 3],
      ['StackedAreaLayout', 9121, 4, 3], ['BifocalDistortion', 4461, 4, 3], ['Distortion', 6314, 4, 3],
      ['FisheyeDistortion', 3444, 4, 3]
    ];
    const yPos = {
      'flare': 100,
      'analytics': 100, 'animate': 123.8, 'data': 169.5, 'display': 184.3, 'flex': 199.1,
      'physics': 201.1, 'query': 214.8, 'scale': 251.5, 'util': 265.2, 'vis': 310.3,
      'cluster': 100, 'graph': 107.4, 'optimization': 120.2,
      'Easing': 123.8, 'FunctionSequence': 132.0, 'interpolate': 134.8,
      'Parallel': 143.2, 'Scheduler': 145.7, 'Sequence': 147.9, 'Transition': 150.2, 'Transitioner': 153.9,
      'converters': 169.5, 'DataField': 178.5, 'DataSchema': 179.3, 'DataSource': 180.3, 'DataUtil': 181.9,
      'DirtySprite': 184.3, 'LineSprite': 188.6, 'RectSprite': 189.4, 'TextSprite': 190.8,
      'FlexSprite': 199.1,
      'NBodyForce': 201.1, 'Particle': 206.2, 'Simulation': 207.5, 'Spring': 212.3, 'SpringForce': 213.4,
      'AggregateExpression': 214.8, 'Arithmetic': 215.6, 'Comparison': 217.5, 'DateUtil': 221.2,
      'Expression': 223.5, 'Fn': 225.8, 'Query': 227.4, 'StringUtil': 234.0,
      'LogScale': 251.5, 'OrdinalScale': 252.9, 'QuantitativeScale': 254.4, 'Scale': 256.1, 'TimeScale': 257.6,
      'Arrays': 265.2, 'Colors': 268.6, 'Dates': 272.4, 'Displays': 275.8, 'Geometry': 281.6,
      'math': 286.4, 'Property': 290.2, 'Sort': 292.5, 'Stats': 295.1,
      'axis': 310.3, 'controls': 323.8, 'vis_data': 347.0, 'legend': 374.2, 'operator': 388.7,
      'Axis': 310.3, 'CartesianAxes': 322.2,
      'AnchorControl': 323.8, 'ClickControl': 324.8, 'ControlList': 326.5, 'DragControl': 329.0,
      'HoverControl': 330.2, 'NavigationControl': 332.6, 'PanZoomControl': 336.1,
      'SelectionControl': 338.7, 'TooltipControl': 342.2,
      'Data': 347.0, 'DataList': 355.0, 'DataSprite': 362.4, 'NodeSprite': 366.5,
      'render': 374.0, 'ScaleBinding': 377.4, 'Tree': 382.8,
      'Legend': 374.2, 'LegendItem': 383.3, 'LegendRange': 384.9,
      'distortion': 388.7, 'encoder': 394.5, 'filter_op': 399.0, 'label': 403.3, 'layout': 410.5,
      'AxisLayout': 410.5, 'CircleLayout': 413.4, 'CirclePackingLayout': 416.0,
      'ForceDirectedLayout': 420.8, 'IcicleTreeLayout': 424.5,
      'RadialTreeLayout': 426.8, 'StackedAreaLayout': 430.2,
      'BifocalDistortion': 388.7, 'Distortion': 390.6, 'FisheyeDistortion': 393.0
    };
    const depthLabels = ['L0 · root', 'L1 · module', 'L2 · submodule', 'L3 · class', 'L4 · leaf'];

    function hexToRgb(hex) {
      const value = parseInt(hex.replace('#', ''), 16);
      return [(value >> 16) & 255, (value >> 8) & 255, value & 255];
    }

    function blendRgb(base, bg, ratio) {
      return 'rgb(' + [0, 1, 2].map(function(idx) {
        return Math.round(base[idx] + (bg[idx] - base[idx]) * ratio);
      }).join(',') + ')';
    }

    function depthTint(color, depth, dark) {
      const lightRatios = [0.15, 0, 0.45, 0.62, 0.75];
      const darkRatios = [0.08, 0, 0.24, 0.38, 0.50];
      return blendRgb(hexToRgb(color), hexToRgb(dark ? '#2C2B30' : '#FFFBFE'), (dark ? darkRatios : lightRatios)[Math.min(depth, 4)]);
    }

    function buildIcicleData(colors, dark, seeded) {
      return nodes.map(function(node) {
        const y = (yPos[node[0]] || chartTop) - chartTop;
        return {
          name: node[0],
          value: [node[2], y, seeded ? 0 : (node[1] * chartHeight / totalValue), node[0], node[1], node[3], node[2], dark ? '#E6E0E9' : (node[2] > 1 ? '#FFFBFE' : '#1C1B1F')],
          itemStyle: {
            color: depthTint(colors[node[3] - 1] || colors[0], node[2], dark),
            fill: depthTint(colors[node[3] - 1] || colors[0], node[2], dark),
            stroke: dark ? '#151825' : '#FFFBFE',
            lineWidth: 1,
            opacity: dark ? 0.96 : 0.92
          }
        };
      });
    }

    function tooltip(state, param) {
      const dark = state.dark;
      const value = param.data && param.data.value;
      if (!value) return '';
      const lines = value[4];
      const pct = ((lines / totalValue) * 100).toFixed(lines > 100000 ? 0 : 1);
      return tooltipCard(dark,
        '<div style="color:' + (dark ? '#E6E0E9' : '#1C1B1F') + ';font-size:13px;font-weight:600;">' + param.name + '</div>' +
        '<div style="margin-top:4px;color:' + (dark ? '#CAC4D0' : '#49454F') + ';font-size:10px;">' + depthLabels[Math.min(value[6], 4)] + '</div>' +
        '<div style="margin-top:6px;color:' + (dark ? '#E6E0E9' : '#1C1B1F') + ';font-size:11px;font-weight:600;">' + lines.toLocaleString('en-US') + ' LOC</div>' +
        '<div style="margin-top:4px;color:' + (dark ? '#938F99' : '#79747E') + ';font-size:10px;">' + pct + '% of root</div>',
        '144px'
      );
    }

    function renderIcicleItem(params, api) {
      const depth = api.value(0);
      const startY = api.value(1);
      const displayHeight = api.value(2);
      const style = api.style();
      const xStart = api.coord([depth, 0])[0];
      const xEnd = api.coord([depth + 1, 0])[0];
      const yTop = api.coord([0, startY])[1];
      const yBottom = api.coord([0, startY + displayHeight])[1];
      const width = Math.max(8, xEnd - xStart - 4);
      const rect = echarts.graphic.clipRectByRect({
        x: xStart + 2,
        y: Math.min(yTop, yBottom),
        width: width,
        height: Math.max(0.8, Math.abs(yBottom - yTop)),
        r: 0
      }, {
        x: params.coordSys.x,
        y: params.coordSys.y,
        width: params.coordSys.width,
        height: params.coordSys.height
      });
      if (!rect) return null;
      const children = [{
        type: 'rect',
        shape: rect,
        style: style,
        transition: ['shape', 'style']
      }];
      if (rect.height >= 16 && rect.width >= 54) {
        children.push({
          type: 'text',
          silent: true,
          style: {
            x: rect.x + 8,
            y: rect.y + Math.min(rect.height / 2, 14),
            text: api.value(3),
            textVerticalAlign: 'middle',
            textAlign: 'left',
            fill: api.value(7),
            font: '500 10px Roboto, Helvetica Neue, Arial, sans-serif',
            opacity: style.opacity
          }
        });
      }
      return {
        type: 'group',
        children: children
      };
    }

    return createManagedChart(container, function(chart, state, containerEl) {
      const dark = state.dark;
      const compact = isCompactChart(chart);
      const medium = isMediumChart(chart);
      const darkPalette = ['#22D3EE', '#10B981', '#FBB724', '#FB6181', '#A78BFA', '#60A5FA', '#2DD4BF', '#94A3B8'];
      const colors = dark ? darkPalette : state.colors;
      const topModules = nodes.filter(function(node) { return node[2] === 1; });
      setLegendOverlayConfig(containerEl, {
        dark: dark,
        layout: legendOverlayLayout(chart),
        items: topModules.map(function(node) {
          return { name: node[0] + ' ' + node[1].toLocaleString('en-US'), color: depthTint(colors[node[3] - 1] || colors[0], 1, dark) };
        })
      });
      return {
        animationDuration: 800,
        animationDurationUpdate: 800,
        animationEasing: 'cubicOut',
        backgroundColor: 'transparent',
        color: colors,
        graphic: depthLabels.map(function(label, depth) {
          const plotLeft = compact ? 20 : (medium ? 26 : 28);
          const plotRight = legendGridRight(chart);
          const plotWidth = Math.max(1, chart.getWidth() - plotLeft - plotRight);
          return {
            type: 'text',
            silent: true,
            left: plotLeft + plotWidth * ((depth + 0.5) / 5),
            top: compact ? 2 : 6,
            style: {
              text: label,
              fill: dark ? '#938F99' : '#79747E',
              font: '400 ' + (compact ? 8 : 10) + 'px Roboto, Helvetica Neue, Arial, sans-serif',
              textAlign: 'center'
            }
          };
        }),
        tooltip: {
          trigger: 'item',
          confine: true,
          backgroundColor: 'transparent',
          borderWidth: 0,
          padding: 0,
          extraCssText: 'box-shadow:none;background:transparent;',
          formatter: function(param) { return tooltip(state, param); },
          position: function(pos, params, dom, rect, size) { return smartTooltipPosition(pos, rect, size, dom, dark, true, 20); }
        },
        grid: {
          left: compact ? 20 : (medium ? 26 : 28),
          right: legendGridRight(chart),
          top: compact ? 20 : 28,
          bottom: compact ? 12 : 16
        },
        xAxis: {
          type: 'value',
          min: 0,
          max: 5,
          show: false
        },
        yAxis: {
          type: 'value',
          min: 0,
          max: chartHeight,
          inverse: true,
          show: false
        },
        series: [{
          type: 'custom',
          id: 'icicle-series',
          name: 'Icicle',
          coordinateSystem: 'cartesian2d',
          renderItem: renderIcicleItem,
          progressive: 0,
          encode: { x: 0, y: [1, 2], tooltip: [3] },
          animationDelay: function(idx) { return Math.min(260, idx * 10); },
          animationDelayUpdate: function(idx) { return Math.min(260, idx * 10); },
          emphasis: { focus: 'self', blurScope: 'coordinateSystem' },
          blur: { itemStyle: { opacity: 0.18 } },
          data: buildIcicleData(colors, dark, !introPlayed)
        }]
      };
    }, function(chart, state) {
      if (introPlayed || introTimer) return;
      introTimer = setTimeout(function() {
        introTimer = null;
        introPlayed = true;
        chart.setOption({
          series: [{
            id: 'icicle-series',
            data: buildIcicleData(state.dark ? ['#22D3EE', '#10B981', '#FBB724', '#FB6181', '#A78BFA', '#60A5FA', '#2DD4BF', '#94A3B8'] : state.colors, state.dark, false)
          }]
        });
      }, 40);
    });
  }

  function makeTreeChart(container) {
    const nodes = [
      { id: 'ceo', label: 'Chief Product', sublabel: 'Officer', parent: null, branch: 0 },
      { id: 'eng', label: 'Engineering', sublabel: '42 engineers', parent: 'ceo', branch: 1 },
      { id: 'des', label: 'Design', sublabel: '11 designers', parent: 'ceo', branch: 2 },
      { id: 'dat', label: 'Data & ML', sublabel: '18 analysts', parent: 'ceo', branch: 3 },
      { id: 'fe', label: 'Frontend', sublabel: '14 engineers', parent: 'eng', branch: 1 },
      { id: 'be', label: 'Backend', sublabel: '18 engineers', parent: 'eng', branch: 1 },
      { id: 'platform', label: 'Platform', sublabel: '10 engineers', parent: 'eng', branch: 1 },
      { id: 'ux', label: 'UX Research', sublabel: '5 researchers', parent: 'des', branch: 2 },
      { id: 'vis', label: 'Visual Design', sublabel: '6 designers', parent: 'des', branch: 2 },
      { id: 'anal', label: 'Analytics', sublabel: '8 analysts', parent: 'dat', branch: 3 },
      { id: 'ml', label: 'ML Eng', sublabel: '10 engineers', parent: 'dat', branch: 3 },
      { id: 'mob', label: 'Mobile', sublabel: '7 engineers', parent: 'fe', branch: 1 },
      { id: 'web', label: 'Web', sublabel: '7 engineers', parent: 'fe', branch: 1 },
      { id: 'api', label: 'API', sublabel: '9 engineers', parent: 'be', branch: 1 }
    ];
    const byId = {};
    const childrenById = {};
    nodes.forEach(function(node) {
      byId[node.id] = node;
      childrenById[node.id] = [];
    });
    nodes.forEach(function(node) {
      if (node.parent) childrenById[node.parent].push(node.id);
    });

    function hexToRgb(hex) {
      const parsed = echarts.color.parse(hex) || [0, 0, 0, 1];
      return [parsed[0], parsed[1], parsed[2]];
    }

    function rgbToHex(rgb) {
      return '#' + rgb.map(function(channel) {
        const value = Math.max(0, Math.min(255, Math.round(channel)));
        return value.toString(16).padStart(2, '0');
      }).join('');
    }

    function mixColor(baseHex, bgHex, ratio) {
      const base = hexToRgb(baseHex);
      const bg = hexToRgb(bgHex);
      return rgbToHex(base.map(function(channel, index) {
        return bg[index] + (channel - bg[index]) * ratio;
      }));
    }

    function getDepth(id) {
      let node = byId[id];
      let depth = 0;
      while (node && node.parent) {
        depth += 1;
        node = byId[node.parent];
      }
      return depth;
    }

    function assignLeafRows(rootId) {
      const leaves = nodes.filter(function(node) { return !childrenById[node.id].length; });
      const yById = {};
      let leafIndex = 0;

      function walk(id) {
        const childIds = childrenById[id];
        if (!childIds.length) {
          yById[id] = leafIndex;
          leafIndex += 1;
          return yById[id];
        }
        const childRows = childIds.map(walk);
        yById[id] = (Math.min.apply(null, childRows) + Math.max.apply(null, childRows)) / 2;
        return yById[id];
      }

      walk(rootId);
      return { yById: yById, leafCount: leaves.length };
    }

    function tooltip(state, param) {
      const dark = state.dark;
      const meta = param.data && param.data.meta;
      if (!meta) return '';
      const parentLabel = meta.parent ? byId[meta.parent].label : 'Root';
      return tooltipCard(dark,
        '<div style="color:' + (dark ? '#E6E0E9' : '#1C1B1F') + ';font-size:13px;font-weight:600;">' + meta.label + '</div>' +
        '<div style="margin-top:4px;color:' + (dark ? '#CAC4D0' : '#49454F') + ';font-size:10px;">' + meta.sublabel + '</div>' +
        '<div style="margin-top:6px;color:' + (dark ? '#938F99' : '#79747E') + ';font-size:10px;">Depth ' + meta.depth + ' · parent ' + parentLabel + '</div>',
        '176px'
      );
    }

    return createManagedChart(container, function(chart, state, containerEl) {
      const dark = state.dark;
      const compact = isCompactChart(chart);
      const medium = isMediumChart(chart);
      const darkPalette = ['#22D3EE', '#10B981', '#FBB724', '#FB6181', '#A78BFA', '#60A5FA', '#2DD4BF', '#94A3B8'];
      const colors = dark ? darkPalette : state.colors;
      const treeLegendLayout = Object.assign({}, legendOverlayLayout(chart), {
        width: compact ? 92 : (medium ? 102 : 122),
        right: compact ? 6 : 8
      });
      const legendReserve = treeLegendLayout.width + treeLegendLayout.right + (compact ? 22 : (medium ? 28 : 38));
      const rootId = 'ceo';
      const rootLayout = assignLeafRows(rootId);
      const maxDepth = nodes.reduce(function(max, node) { return Math.max(max, getDepth(node.id)); }, 0);
      const nodeWidth = compact ? 56 : (medium ? 74 : 100);
      const nodeHeight = compact ? 28 : (medium ? 32 : 36);
      const xSpan = maxDepth + 1;
      const ySpan = Math.max(1, rootLayout.leafCount - 1);
      const plotPaddingX = compact ? 0.34 : 0.42;
      const plotPaddingY = compact ? 0.42 : 0.58;
      const bg = dark ? '#1C1B1F' : '#FFFBFE';
      const depthRatios = dark ? [0.92, 0.70, 0.50, 0.34] : [1.00, 0.72, 0.48, 0.28];

      setLegendOverlayConfig(containerEl, {
        dark: dark,
        layout: treeLegendLayout,
        items: [
          { name: 'Product', color: mixColor(colors[0], bg, depthRatios[0]) },
          { name: 'Engineering', color: mixColor(colors[1], bg, depthRatios[1]) },
          { name: 'Design', color: mixColor(colors[2], bg, depthRatios[1]) },
          { name: 'Data & ML', color: mixColor(colors[3], bg, depthRatios[1]) }
        ]
      });

      const nodeData = nodes.map(function(node) {
        const depth = getDepth(node.id);
        const baseColor = colors[node.branch] || colors[0];
        const ratio = depthRatios[Math.min(depth, depthRatios.length - 1)];
        const fill = mixColor(baseColor, bg, ratio);
        const border = mixColor(baseColor, bg, Math.min(1, ratio + 0.18));
        return {
          id: node.id,
          name: node.label,
          value: [depth + plotPaddingX, rootLayout.yById[node.id] + plotPaddingY],
          meta: {
            id: node.id,
            label: node.label,
            sublabel: node.sublabel,
            parent: node.parent,
            depth: depth
          },
          fill: fill,
          border: border
        };
      });

      const edgeData = nodes.filter(function(node) { return node.parent; }).map(function(node) {
        return {
          id: node.parent + '-' + node.id,
          source: node.parent,
          target: node.id,
          value: 1,
          meta: {
            source: node.parent,
            target: node.id
          }
        };
      });

      function renderEdge(params, api) {
        const item = edgeData[params.dataIndex];
        const source = nodeData.find(function(node) { return node.id === item.source; });
        const target = nodeData.find(function(node) { return node.id === item.target; });
        if (!source || !target) return null;

        const from = api.coord(source.value);
        const to = api.coord(target.value);
        const startX = from[0] + nodeWidth / 2;
        const endX = to[0] - nodeWidth / 2;
        const midX = startX + (endX - startX) * 0.5;
        const stroke = dark ? '#49454F' : '#CAC4D0';

        return {
          type: 'group',
          silent: true,
          children: [
            {
              type: 'line',
              shape: { x1: startX, y1: from[1], x2: midX, y2: from[1] },
              style: { stroke: stroke, lineWidth: 1.5, opacity: 0.9 },
              transition: ['shape']
            },
            {
              type: 'line',
              shape: { x1: midX, y1: from[1], x2: midX, y2: to[1] },
              style: { stroke: stroke, lineWidth: 1.5, opacity: 0.9 },
              transition: ['shape']
            },
            {
              type: 'line',
              shape: { x1: midX, y1: to[1], x2: endX, y2: to[1] },
              style: { stroke: stroke, lineWidth: 1.5, opacity: 0.9 },
              transition: ['shape']
            }
          ]
        };
      }

      function renderNode(params, api) {
        const item = nodeData[params.dataIndex];
        const point = api.coord(item.value);
        const x = point[0] - nodeWidth / 2;
        const y = point[1] - nodeHeight / 2;
        const rect = echarts.graphic.clipRectByRect({
          x: x,
          y: y,
          width: nodeWidth,
          height: nodeHeight
        }, {
          x: params.coordSys.x,
          y: params.coordSys.y,
          width: params.coordSys.width,
          height: params.coordSys.height
        });
        if (!rect) return null;

        const titleSize = compact ? 6 : (medium ? 8 : 11);
        const subSize = compact ? 5 : (medium ? 6 : 10);
        const titleY = rect.y + rect.height / 2 - (compact ? 4 : 6);
        const subY = rect.y + rect.height / 2 + (compact ? 5 : 8);

        return {
          type: 'group',
          children: [
            {
              type: 'rect',
              shape: { x: rect.x, y: rect.y, width: rect.width, height: rect.height, r: 8 },
              style: { fill: item.fill, stroke: item.border, lineWidth: 1.5 },
              transition: ['shape', 'style']
            },
            {
              type: 'text',
              silent: true,
              style: {
                x: rect.x + rect.width / 2,
                y: titleY,
                text: item.meta.label,
                textAlign: 'center',
                textVerticalAlign: 'middle',
                fill: dark ? '#E6E0E9' : '#1C1B1F',
                font: '600 ' + titleSize + 'px Roboto, Helvetica Neue, Arial, sans-serif'
              }
            },
            {
              type: 'text',
              silent: true,
              style: {
                x: rect.x + rect.width / 2,
                y: subY,
                text: item.meta.sublabel,
                textAlign: 'center',
                textVerticalAlign: 'middle',
                fill: dark ? '#CAC4D0' : '#49454F',
                font: '400 ' + subSize + 'px Roboto, Helvetica Neue, Arial, sans-serif'
              }
            }
          ]
        };
      }

      return {
        animationDuration: 850,
        animationDurationUpdate: 250,
        animationEasing: 'cubicOut',
        backgroundColor: 'transparent',
        tooltip: {
          trigger: 'item',
          confine: true,
          backgroundColor: 'transparent',
          borderWidth: 0,
          padding: 0,
          extraCssText: 'box-shadow:none;background:transparent;',
          formatter: function(param) { return tooltip(state, param); },
          position: function(pos, params, dom, rect, size) {
            return smartTooltipPosition(pos, rect || { x: pos[0], y: pos[1], width: 0, height: 0 }, size, dom, dark, true, 20);
          }
        },
        xAxis: {
          min: 0,
          max: xSpan,
          show: false,
          type: 'value'
        },
        yAxis: {
          min: 0,
          max: rootLayout.leafCount + plotPaddingY * 2 - 1,
          show: false,
          inverse: true,
          type: 'value'
        },
        grid: {
          left: compact ? 8 : 14,
          right: legendReserve,
          top: compact ? 10 : 14,
          bottom: compact ? 10 : 14
        },
        series: [
          {
            type: 'custom',
            coordinateSystem: 'cartesian2d',
            renderItem: renderEdge,
            data: edgeData,
            silent: true,
            animationDelay: function(idx) { return idx * 35; },
            progressive: 0,
            z: 1
          },
          {
            type: 'custom',
            coordinateSystem: 'cartesian2d',
            renderItem: renderNode,
            data: nodeData,
            animationDelay: function(idx) { return edgeData.length * 35 + idx * 55; },
            progressive: 0,
            z: 3,
            encode: { x: 0, y: 1, tooltip: 2 },
            emphasis: { focus: 'self' },
            blur: { itemStyle: { opacity: 0.2 } }
          }
        ]
      };
    });
  }

  function makeBoxplotChart(container) {
    const seriesData = [
      { name: 'Cyan', min: 42, q1: 58, median: 72, q3: 84, max: 94, outliers: [98], paletteIndex: 0 },
      { name: 'Emerald', min: 40, q1: 56, median: 68, q3: 79, max: 90, outliers: [96], paletteIndex: 1 },
      { name: 'Amber', min: 35, q1: 50, median: 60, q3: 74, max: 85, outliers: [32], paletteIndex: 2 },
      { name: 'Rose', min: 30, q1: 46, median: 55, q3: 68, max: 80, outliers: [88], paletteIndex: 3 },
      { name: 'Violet', min: 55, q1: 68, median: 79, q3: 90, max: 100, outliers: [52], paletteIndex: 4 },
      { name: 'Blue', min: 38, q1: 55, median: 64, q3: 76, max: 87, outliers: [93], paletteIndex: 5 },
      { name: 'Teal', min: 36, q1: 52, median: 61, q3: 72, max: 83, outliers: [30], paletteIndex: 6 },
      { name: 'Other', min: 22, q1: 36, median: 48, q3: 58, max: 68, outliers: [72], paletteIndex: 7 }
    ];

    function tooltip(state, param) {
      const dark = state.dark;
      if (param.seriesName === 'Outliers') {
        return tooltipCard(dark,
          '<div style="color:' + (dark ? '#E6E0E9' : '#1C1B1F') + ';font-size:13px;font-weight:600;">' + param.name + '</div>' +
          '<div style="margin-top:4px;color:' + (dark ? '#CAC4D0' : '#49454F') + ';font-size:10px;">Outlier</div>' +
          '<div style="margin-top:6px;color:' + (dark ? '#E6E0E9' : '#1C1B1F') + ';font-size:11px;font-weight:600;">$' + param.value[1] + 'M</div>',
          '112px'
        );
      }
      const stats = param.data || [];
      return tooltipCard(dark,
        '<div style="color:' + (dark ? '#E6E0E9' : '#1C1B1F') + ';font-size:13px;font-weight:600;">' + param.name + '</div>' +
        '<div style="margin-top:4px;color:' + (dark ? '#CAC4D0' : '#49454F') + ';font-size:10px;">Revenue distribution</div>' +
        '<div style="margin-top:6px;color:' + (dark ? '#E6E0E9' : '#1C1B1F') + ';font-size:11px;font-weight:600;">Median $' + stats[2] + 'M</div>' +
        '<div style="margin-top:4px;color:' + (dark ? '#938F99' : '#79747E') + ';font-size:10px;">IQR $' + stats[1] + 'M-$' + stats[3] + 'M · range $' + stats[0] + 'M-$' + stats[4] + 'M</div>',
        '156px'
      );
    }

    function renderBoxplotItem(params, api) {
      const idx = api.value(0);
      const min = api.value(1);
      const q1 = api.value(2);
      const median = api.value(3);
      const q3 = api.value(4);
      const max = api.value(5);
      const boxWidth = api.value(6);
      const medianColor = api.value(7);
      const style = api.style();
      const x = api.coord([idx, median])[0];
      const yMin = api.coord([idx, min])[1];
      const yQ1 = api.coord([idx, q1])[1];
      const yMedian = api.coord([idx, median])[1];
      const yQ3 = api.coord([idx, q3])[1];
      const yMax = api.coord([idx, max])[1];
      const halfBox = boxWidth / 2;
      const halfCap = Math.max(8, Math.round(boxWidth * 0.36));

      return {
        type: 'group',
        children: [{
          type: 'line',
          silent: true,
          shape: { x1: x, y1: yMax, x2: x, y2: yQ3 },
          style: { stroke: style.fill, lineWidth: 2, opacity: style.opacity }
        }, {
          type: 'line',
          silent: true,
          shape: { x1: x - halfCap, y1: yMax, x2: x + halfCap, y2: yMax },
          style: { stroke: style.fill, lineWidth: 2, opacity: style.opacity }
        }, {
          type: 'line',
          silent: true,
          shape: { x1: x, y1: yQ1, x2: x, y2: yMin },
          style: { stroke: style.fill, lineWidth: 2, opacity: style.opacity }
        }, {
          type: 'line',
          silent: true,
          shape: { x1: x - halfCap, y1: yMin, x2: x + halfCap, y2: yMin },
          style: { stroke: style.fill, lineWidth: 2, opacity: style.opacity }
        }, {
          type: 'rect',
          shape: {
            x: x - halfBox,
            y: yQ3,
            width: boxWidth,
            height: Math.max(1, yQ1 - yQ3),
            r: 6
          },
          style: style
        }, {
          type: 'line',
          silent: true,
          shape: { x1: x - halfBox + 4, y1: yMedian, x2: x + halfBox - 4, y2: yMedian },
          style: { stroke: medianColor, lineWidth: 2.5, lineCap: 'round' }
        }]
      };
    }

    return createManagedChart(container, function(chart, state, containerEl) {
      const dark = state.dark;
      const compact = isCompactChart(chart);
      const medium = isMediumChart(chart);
      const darkPalette = ['#22D3EE', '#10B981', '#FBB724', '#FB6181', '#A78BFA', '#60A5FA', '#2DD4BF', '#94A3B8'];
      const colors = dark ? darkPalette : state.colors;
      const medianColor = dark ? '#1C1B1F' : '#FFFBFE';
      const boxWidth = compact ? 18 : (medium ? 24 : 30);
      setLegendOverlayConfig(containerEl, {
        dark: dark,
        layout: legendOverlayLayout(chart),
        items: seriesData.map(function(item) {
          return { name: item.name + ' $' + item.median + 'M med', color: colors[item.paletteIndex] };
        })
      });

      return {
        animationDuration: 800,
        animationDurationUpdate: 250,
        animationEasing: 'cubicOut',
        backgroundColor: 'transparent',
        color: colors,
        tooltip: {
          trigger: 'item',
          confine: true,
          backgroundColor: 'transparent',
          borderWidth: 0,
          padding: 0,
          extraCssText: 'box-shadow:none;background:transparent;',
          formatter: function(param) { return tooltip(state, param); },
          position: function(pos, params, dom, rect, size) { return smartTooltipPosition(pos, rect, size, dom, dark, true, 20); }
        },
        grid: { left: compact ? 26 : (medium ? 30 : 48), right: legendGridRight(chart), top: compact ? 16 : 24, bottom: compact ? 28 : 40 },
        xAxis: {
          type: 'category',
          data: seriesData.map(function(item) { return item.name; }),
          boundaryGap: true,
          axisLine: { lineStyle: { color: dark ? '#938F99' : '#79747E', width: 1.5 } },
          axisTick: { show: false },
          axisLabel: { color: dark ? '#938F99' : '#79747E', fontSize: compact ? 8 : (medium ? 9 : 10), margin: compact ? 8 : 14, interval: 0 }
        },
        yAxis: {
          type: 'value',
          min: 0,
          max: 100,
          interval: compact ? 50 : 25,
          axisLine: { show: true, lineStyle: { color: dark ? '#938F99' : '#79747E', width: 1.5 } },
          axisTick: { show: false },
          axisLabel: { color: dark ? '#938F99' : '#79747E', fontSize: compact ? 8 : (medium ? 9 : 10), formatter: function(v) { return '$' + v + (v === 0 ? '' : 'M'); } },
          splitLine: { lineStyle: { color: dark ? '#49454F' : '#E7E0EC' } }
        },
        series: [{
          type: 'custom',
          name: 'Distribution',
          coordinateSystem: 'cartesian2d',
          renderItem: renderBoxplotItem,
          progressive: 0,
          encode: { x: 0, y: [1, 2, 3, 4, 5] },
          animationDelay: function(idx) { return idx * 140; },
          itemStyle: {
            color: function(param) { return colors[seriesData[param.dataIndex].paletteIndex]; },
            fill: function(param) { return colors[seriesData[param.dataIndex].paletteIndex]; },
            opacity: dark ? 0.92 : 0.88
          },
          emphasis: {
            focus: 'self',
            blurScope: 'coordinateSystem'
          },
          blur: { itemStyle: { opacity: 0.2 } },
          data: seriesData.map(function(item, idx) {
            return {
              name: item.name,
              value: [idx, item.min, item.q1, item.median, item.q3, item.max, boxWidth, medianColor],
              itemStyle: {
                color: colors[item.paletteIndex],
                fill: colors[item.paletteIndex],
                opacity: dark ? 0.92 : 0.88
              }
            };
          })
        }, {
          type: 'scatter',
          name: 'Outliers',
          symbolSize: compact ? 5 : 7,
          itemStyle: {
            color: 'transparent',
            borderWidth: 1.8,
            borderColor: function(param) { return colors[seriesData[param.value[0]].paletteIndex]; }
          },
          emphasis: { focus: 'self', blurScope: 'coordinateSystem' },
          blur: { itemStyle: { opacity: 0.2 } },
          animationDelay: function(idx) { return idx * 140 + 120; },
          data: seriesData.flatMap(function(item, categoryIdx) {
            return item.outliers.map(function(value) { return [categoryIdx, value]; });
          })
        }]
      };
    });
  }

  function makeGanttChart(container) {
    let introPlayed = false;
    let introTimer = null;
    const lanes = ['Discovery', 'Design', 'Frontend', 'Backend', 'QA', 'Infra', 'Launch'];
    const tasks = [
      { name: 'User Research', lane: 'Discovery', start: '2026-04-01', end: '2026-04-30', paletteIndex: 0 },
      { name: 'Competitive Analysis', lane: 'Discovery', start: '2026-04-10', end: '2026-05-10', paletteIndex: 1 },
      { name: 'UX Wireframes', lane: 'Design', start: '2026-04-28', end: '2026-05-31', paletteIndex: 2 },
      { name: 'Visual Design System', lane: 'Design', start: '2026-05-15', end: '2026-07-15', paletteIndex: 4 },
      { name: 'Component Library', lane: 'Frontend', start: '2026-05-01', end: '2026-06-30', paletteIndex: 0 },
      { name: 'App Integration & E2E', lane: 'Frontend', start: '2026-06-15', end: '2026-08-31', paletteIndex: 5 },
      { name: 'API Development', lane: 'Backend', start: '2026-04-15', end: '2026-06-30', paletteIndex: 3 },
      { name: 'Data Pipeline & ML Models', lane: 'Backend', start: '2026-06-01', end: '2026-08-15', paletteIndex: 6 },
      { name: 'Integration Testing', lane: 'QA', start: '2026-07-01', end: '2026-08-15', paletteIndex: 2 },
      { name: 'UAT & Acceptance', lane: 'QA', start: '2026-08-15', end: '2026-09-15', paletteIndex: 3 },
      { name: 'Cloud Provisioning', lane: 'Infra', start: '2026-04-01', end: '2026-05-15', paletteIndex: 7 }
    ];
    const milestones = [
      { name: 'Alpha', lane: 'Launch', date: '2026-06-30', color: '#F59E0B' },
      { name: 'Beta', lane: 'Launch', date: '2026-08-15', color: '#8B5CF6' },
      { name: 'GA Launch', lane: 'Launch', date: '2026-09-30', color: '#F43F5E' }
    ];
    const startDate = +new Date('2026-04-01T00:00:00');
    const endDate = +new Date('2026-09-30T00:00:00');
    const todayDate = +new Date('2026-04-14T00:00:00');
    const dayMs = 24 * 60 * 60 * 1000;

    function laneIndex(name) {
      return lanes.indexOf(name);
    }

    function formatDate(value) {
      return new Date(value).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    }

    function formatSpanDays(start, end) {
      return Math.max(1, Math.round((end - start) / dayMs) + 1);
    }

    function buildTaskSeriesData(colors, dark, seeded) {
      return tasks.map(function(task) {
        const startValue = +new Date(task.start + 'T00:00:00');
        const endValue = +new Date(task.end + 'T00:00:00');
        const seedValue = seeded ? startValue : endValue;
        return {
          name: task.name,
          value: [laneIndex(task.lane), startValue, seedValue, task.name, dark ? '#151825' : '#FFFBFE'],
          taskMeta: {
            name: task.name,
            lane: task.lane,
            startValue: startValue,
            endValue: endValue
          },
          itemStyle: {
            fill: colors[task.paletteIndex],
            opacity: dark ? 0.94 : 0.9
          }
        };
      });
    }

    function tooltip(state, param) {
      const dark = state.dark;
      if (param.seriesName === 'Milestones') {
        return tooltipCard(dark,
          '<div style="color:' + (dark ? '#E6E0E9' : '#1C1B1F') + ';font-size:13px;font-weight:600;">' + param.name + '</div>' +
          '<div style="margin-top:4px;color:' + (dark ? '#CAC4D0' : '#49454F') + ';font-size:10px;">Milestone</div>' +
          '<div style="margin-top:6px;color:' + (dark ? '#E6E0E9' : '#1C1B1F') + ';font-size:11px;font-weight:600;">' + formatDate(param.value[0]) + '</div>' +
          '<div style="margin-top:4px;color:' + (dark ? '#938F99' : '#79747E') + ';font-size:10px;">' + param.data.lane + '</div>',
          '126px'
        );
      }
      const task = param.data && param.data.taskMeta;
      if (!task) return '';
      const span = formatSpanDays(task.startValue, task.endValue);
      return tooltipCard(dark,
        '<div style="color:' + (dark ? '#E6E0E9' : '#1C1B1F') + ';font-size:13px;font-weight:600;">' + task.name + '</div>' +
        '<div style="margin-top:4px;color:' + (dark ? '#CAC4D0' : '#49454F') + ';font-size:10px;">' + task.lane + '</div>' +
        '<div style="margin-top:6px;display:flex;align-items:center;justify-content:space-between;gap:12px;color:' + (dark ? '#E6E0E9' : '#1C1B1F') + ';font-size:11px;font-weight:600;"><span>' + formatDate(task.startValue) + '</span><span>' + formatDate(task.endValue) + '</span></div>' +
        '<div style="margin-top:4px;color:' + (dark ? '#938F99' : '#79747E') + ';font-size:10px;">' + span + ' day window</div>',
        '170px'
      );
    }

    function renderGanttTask(params, api) {
      const laneIdx = api.value(0);
      const start = api.value(1);
      const end = api.value(2);
      const label = api.value(3);
      const style = api.style();
      const startCoord = api.coord([start, laneIdx]);
      const endCoord = api.coord([end, laneIdx]);
      const categoryHeight = api.size([0, 1])[1];
      const barHeight = Math.max(12, Math.round(categoryHeight * 0.5));
      const x = startCoord[0];
      const y = startCoord[1] - barHeight / 2;
      const width = Math.max(8, endCoord[0] - startCoord[0]);
      const rect = echarts.graphic.clipRectByRect({
        x: x,
        y: y,
        width: width,
        height: barHeight,
        r: Math.max(4, Math.min(6, Math.round(barHeight * 0.28)))
      }, {
        x: params.coordSys.x,
        y: params.coordSys.y,
        width: params.coordSys.width,
        height: params.coordSys.height
      });
      if (!rect) return null;
      const children = [{
        type: 'rect',
        shape: rect,
        style: style,
        transition: ['shape', 'style']
      }];
      if (rect.width >= 74) {
        children.push({
          type: 'text',
          silent: true,
          style: {
            x: rect.x + 10,
            y: rect.y + rect.height / 2,
            text: label,
            textVerticalAlign: 'middle',
            textAlign: 'left',
            fill: api.value(4),
            font: '500 10px Roboto, Helvetica Neue, Arial, sans-serif',
            opacity: style.opacity
          }
        });
      }
      return { type: 'group', children: children };
    }

    return createManagedChart(container, function(chart, state, containerEl) {
      const dark = state.dark;
      const compact = isCompactChart(chart);
      const medium = isMediumChart(chart);
      const darkPalette = ['#22D3EE', '#10B981', '#FBB724', '#FB6181', '#A78BFA', '#60A5FA', '#2DD4BF', '#94A3B8'];
      const colors = dark ? darkPalette : state.colors;
      const axisColor = dark ? '#938F99' : '#79747E';
      const gridLine = dark ? '#49454F' : '#E7E0EC';
      const labelColor = dark ? '#E6E0E9' : '#1C1B1F';
      const todayColor = dark ? '#E6E0E9' : '#49454F';
      const gridLeft = compact ? 84 : (medium ? 102 : 132);
      const gridTop = compact ? 18 : 26;
      const gridBottom = compact ? 28 : 40;
      const plotRight = legendGridRight(chart);
      const plotWidth = Math.max(1, chart.getWidth() - gridLeft - plotRight);
      const plotBottom = chart.getHeight() - gridBottom;
      const todayX = gridLeft + ((todayDate - startDate) / Math.max(1, endDate - startDate)) * plotWidth;

      setLegendOverlayConfig(containerEl, {
        dark: dark,
        layout: legendOverlayLayout(chart),
        items: tasks.map(function(task) {
          return { name: task.name, color: colors[task.paletteIndex] };
        }).concat([{ name: 'Today', color: todayColor }]).concat(milestones.map(function(item) {
          return { name: item.name, color: item.color };
        }))
      });

      return {
        animationDuration: 700,
        animationDurationUpdate: 700,
        animationEasing: 'cubicOut',
        backgroundColor: 'transparent',
        color: colors,
        graphic: isFinite(todayX) ? [{
          type: 'group',
          silent: true,
          children: [{
            type: 'line',
            shape: { x1: todayX, y1: gridTop, x2: todayX, y2: plotBottom },
            style: {
              stroke: todayColor,
              lineWidth: 1.5,
              lineDash: [5, 4],
              opacity: 0.92
            }
          }, {
            type: 'rect',
            shape: { x: todayX - 24, y: gridTop - 14, width: 48, height: 16, r: 6 },
            style: {
              fill: dark ? '#151825' : '#FFFBFE',
              stroke: dark ? '#49454F' : '#D0C7D8',
              lineWidth: 1,
              opacity: 0.98
            }
          }, {
            type: 'text',
            style: {
              x: todayX,
              y: gridTop - 6,
              text: 'Today',
              textAlign: 'center',
              textVerticalAlign: 'middle',
              fill: todayColor,
              font: '500 ' + (compact ? 8 : 10) + 'px Roboto, Helvetica Neue, Arial, sans-serif'
            }
          }]
        }] : [],
        grid: {
          left: gridLeft,
          right: plotRight,
          top: gridTop,
          bottom: gridBottom
        },
        tooltip: {
          trigger: 'item',
          confine: true,
          backgroundColor: 'transparent',
          borderWidth: 0,
          padding: 0,
          extraCssText: 'box-shadow:none;background:transparent;',
          formatter: function(param) { return tooltip(state, param); },
          position: function(pos, params, dom, rect, size) { return smartTooltipPosition(pos, rect, size, dom, dark, true, 20); }
        },
        xAxis: {
          type: 'time',
          min: startDate,
          max: endDate,
          splitNumber: 6,
          minInterval: 28 * dayMs,
          axisLine: { show: true, lineStyle: { color: axisColor, width: 1.5 } },
          axisTick: { show: false },
          axisLabel: {
            color: axisColor,
            fontSize: compact ? 8 : (medium ? 9 : 10),
            formatter: function(value) {
              return new Date(value).toLocaleDateString('en-US', { month: 'short' });
            }
          },
          splitLine: { lineStyle: { color: gridLine } }
        },
        yAxis: {
          type: 'category',
          inverse: true,
          data: lanes,
          axisLine: { show: true, lineStyle: { color: axisColor, width: 1.5 } },
          axisTick: { show: false },
          axisLabel: {
            color: axisColor,
            fontSize: compact ? 8 : (medium ? 9 : 10),
            margin: compact ? 10 : 14
          },
          splitLine: { show: false }
        },
        series: [{
          type: 'custom',
          id: 'gantt-roadmap',
          name: 'Roadmap',
          coordinateSystem: 'cartesian2d',
          renderItem: renderGanttTask,
          progressive: 0,
          encode: { x: [1, 2], y: 0, tooltip: [1, 2] },
          animationDelay: function(idx) { return idx * 90; },
          animationDelayUpdate: function(idx) { return idx * 90; },
          emphasis: { focus: 'self', blurScope: 'coordinateSystem' },
          blur: { itemStyle: { opacity: 0.2 } },
          data: buildTaskSeriesData(colors, dark, !introPlayed)
        }, {
          type: 'scatter',
          id: 'gantt-milestones',
          name: 'Milestones',
          coordinateSystem: 'cartesian2d',
          symbol: 'diamond',
          symbolSize: compact ? 12 : (medium ? 14 : 16),
          animationDelay: function(idx) { return (introPlayed ? 0 : tasks.length * 90) + idx * 120; },
          animationDelayUpdate: function(idx) { return tasks.length * 90 + idx * 120; },
          z: 4,
          itemStyle: {
            color: function(param) { return param.data.itemStyle.color; },
            borderColor: dark ? '#151825' : '#FFFBFE',
            borderWidth: 1.5
          },
          emphasis: { focus: 'self', blurScope: 'coordinateSystem', scale: 1.08 },
          blur: { itemStyle: { opacity: 0.2 } },
          data: milestones.map(function(item) {
            return {
              name: item.name,
              value: [+new Date(item.date + 'T00:00:00'), laneIndex(item.lane)],
              lane: item.lane,
              itemStyle: { color: item.color }
            };
          })
        }]
      };
    }, function(chart, state) {
      if (introPlayed || introTimer) return;
      introTimer = setTimeout(function() {
        introTimer = null;
        introPlayed = true;
        chart.setOption({
          series: [{
            id: 'gantt-roadmap',
            data: buildTaskSeriesData(state.dark ? ['#22D3EE', '#10B981', '#FBB724', '#FB6181', '#A78BFA', '#60A5FA', '#2DD4BF', '#94A3B8'] : state.colors, state.dark, false)
          }]
        });
      }, 40);
    });
  }

  function makeBubbleChart(container) {
    const points = [
      { name: 'Cyan', value: [38, 72, 56], revenue: 72, share: 38 },
      { name: 'Emerald', value: [22, 68, 52], revenue: 68, share: 22 },
      { name: 'Amber', value: [44, 60, 48], revenue: 60, share: 44 },
      { name: 'Rose', value: [15, 55, 44], revenue: 55, share: 15 },
      { name: 'Violet', value: [31, 79, 64], revenue: 79, share: 31 },
      { name: 'Blue', value: [27, 64, 50], revenue: 64, share: 27 },
      { name: 'Teal', value: [42, 61, 48], revenue: 61, share: 42 },
      { name: 'Other', value: [12, 48, 38], revenue: 48, share: 12 }
    ];

    function tooltip(state, param) {
      const dark = state.dark;
      return tooltipCard(dark,
        '<div style="color:' + (dark ? '#E6E0E9' : '#1C1B1F') + ';font-size:13px;font-weight:600;">' + param.name + '</div>' +
        '<div style="margin-top:4px;color:' + (dark ? '#CAC4D0' : '#49454F') + ';font-size:10px;">Revenue · Share</div>' +
        '<div style="margin-top:6px;display:flex;align-items:center;justify-content:space-between;gap:12px;color:' + (dark ? '#E6E0E9' : '#1C1B1F') + ';font-size:11px;font-weight:600;"><span>$' + param.data.revenue + 'M</span><span>' + param.data.share + '%</span></div>',
        '126px'
      );
    }

    function legendGraphic(chart, dark, colors) {
      const metrics = legendPanelMetrics(chart, points.length);
      if (metrics.compact) return [];
      const panelWidth = metrics.panelWidth;
      const panelX = metrics.panelX;
      const panelY = metrics.panelY;
      const panelHeight = metrics.panelHeight;
      const rowStartY = metrics.compact ? 30 : metrics.rowStartY;
      const rowHeight = metrics.rowHeight;
      const markerSize = metrics.medium ? 8 : 14;
      const markerRadius = metrics.medium ? 2 : 3;
      const titleFont = metrics.medium ? '500 8px Roboto, Helvetica Neue, Arial, sans-serif' : '500 10px Roboto, Helvetica Neue, Arial, sans-serif';
      const labelFont = metrics.medium ? '400 7px Roboto, Helvetica Neue, Arial, sans-serif' : '400 11px Roboto, Helvetica Neue, Arial, sans-serif';
      const group = {
        type: 'group',
        left: panelX,
        top: panelY,
        bounding: 'all',
        children: [{
          type: 'rect',
          shape: { x: 0, y: 0, width: panelWidth, height: panelHeight, r: 14 },
          style: { fill: dark ? '#2A2630' : '#F3EDF7', stroke: dark ? '#938F99' : '#79747E', lineWidth: 1, opacity: dark ? 0.95 : 1 }
        }, {
          type: 'text',
          style: { x: metrics.medium ? 10 : 18, y: metrics.medium ? 13 : 18, text: 'SERIES', fill: dark ? '#938F99' : '#79747E', font: titleFont }
        }]
      };

      points.forEach(function(point, idx) {
        const y = rowStartY + idx * rowHeight;
        group.children.push({
          type: 'rect',
          shape: { x: metrics.medium ? 10 : 18, y: y - Math.round(markerSize / 2), width: markerSize, height: markerSize, r: markerRadius },
          style: { fill: colors[idx], opacity: 1 }
        });
        group.children.push({
          type: 'text',
          style: { x: metrics.medium ? 22 : 40, y: y, text: point.name, textVerticalAlign: 'middle', fill: dark ? '#E6E0E9' : '#1C1B1F', font: labelFont }
        });
      });

      return [group];
    }

    return createManagedChart(container, function(chart, state, containerEl) {
      const dark = state.dark;
      const compact = isCompactChart(chart);
      const medium = isMediumChart(chart);
      const darkPalette = ['#22D3EE', '#10B981', '#FBB724', '#FB6181', '#A78BFA', '#60A5FA', '#2DD4BF', '#94A3B8'];
      const colors = dark ? darkPalette : state.colors;
      setLegendOverlayConfig(containerEl, {
        dark: dark,
        layout: legendOverlayLayout(chart),
        items: points.map(function(point, idx) { return { name: point.name, color: colors[idx] }; })
      });
      return {
        animationDuration: 500,
        animationDurationUpdate: 250,
        animationEasing: 'cubicOut',
        color: colors,
        backgroundColor: 'transparent',
        grid: { left: compact ? 26 : (medium ? 30 : 48), right: legendGridRight(chart), top: compact ? 16 : 24, bottom: compact ? 28 : 40 },
        graphic: [],
        tooltip: {
          trigger: 'item',
          confine: true,
          backgroundColor: 'transparent',
          borderWidth: 0,
          padding: 0,
          extraCssText: 'box-shadow:none;background:transparent;',
          formatter: function(param) { return tooltip(state, param); },
          position: function(pos, params, dom, rect, size) { return smartTooltipPosition(pos, rect, size, dom, dark, true, 20); }
        },
        xAxis: {
          type: 'value',
          min: 0,
          max: 50,
          interval: 10,
          axisLine: { show: true, lineStyle: { color: dark ? '#938F99' : '#79747E', width: 1.5 } },
          axisTick: { show: false },
          axisLabel: { color: dark ? '#938F99' : '#79747E', fontSize: compact ? 8 : (medium ? 9 : 10), formatter: function(v) { return v + '%'; } },
          splitLine: { lineStyle: { color: dark ? '#49454F' : '#E7E0EC' } }
        },
        yAxis: {
          type: 'value',
          min: 0,
          max: 100,
          interval: 20,
          name: 'Revenue',
          nameLocation: 'middle',
          nameGap: 40,
          axisLine: { show: true, lineStyle: { color: dark ? '#938F99' : '#79747E', width: 1.5 } },
          axisTick: { show: false },
          axisLabel: { color: dark ? '#938F99' : '#79747E', fontSize: compact ? 8 : (medium ? 9 : 10), formatter: function(v) { return '$' + v + 'M'; } },
          splitLine: { lineStyle: { color: dark ? '#49454F' : '#E7E0EC' } },
          nameTextStyle: { color: dark ? '#938F99' : '#79747E', fontSize: compact ? 9 : 10 }
        },
        series: points.map(function(point, idx) {
          return {
            type: 'scatter',
            name: point.name,
            data: [{
              value: point.value,
              revenue: point.revenue,
              share: point.share,
              itemStyle: { color: colors[idx] }
            }],
            symbolSize: function(data) {
              const scale = compact ? 0.26 : (medium ? 0.34 : 0.46);
              return Math.max(compact ? 10 : 12, Math.round(data[2] * scale));
            },
            animationDelay: function() { return idx * 180; },
            animationDuration: 800,
            animationEasing: 'cubicOut',
            emphasis: { focus: 'series', blurScope: 'coordinateSystem', scale: 1.06 },
            blur: { itemStyle: { opacity: 0.2 } },
            itemStyle: { opacity: 0.96, shadowBlur: dark ? 14 : 10, shadowColor: dark ? 'rgba(21,24,37,0.28)' : 'rgba(28,27,31,0.10)' }
          };
        })
      };
    });
  }

  function makeNetworkChart(container) {
    const nodes = [
      { id: 'web-app', label: 'Web App', cluster: 0, x: 148, y: 220 },
      { id: 'mobile', label: 'Mobile', cluster: 0, x: 148, y: 360 },
      { id: 'cdn', label: 'CDN', cluster: 0, x: 220, y: 290 },
      { id: 'api-gw', label: 'API GW', cluster: 1, x: 360, y: 210 },
      { id: 'user-svc', label: 'User Svc', cluster: 1, x: 360, y: 300 },
      { id: 'order-svc', label: 'Order Svc', cluster: 1, x: 360, y: 390 },
      { id: 'notify', label: 'Notify', cluster: 1, x: 460, y: 450 },
      { id: 'postgres', label: 'Postgres', cluster: 2, x: 530, y: 290 },
      { id: 'redis', label: 'Redis', cluster: 2, x: 530, y: 390 },
      { id: 'kafka', label: 'Kafka', cluster: 2, x: 610, y: 200 },
      { id: 'analytics', label: 'Analytics', cluster: 2, x: 660, y: 340 },
      { id: 'k8s', label: 'K8s', cluster: 3, x: 750, y: 240 },
      { id: 'monitor', label: 'Monitor', cluster: 3, x: 760, y: 370 },
      { id: 'cicd', label: 'CI/CD', cluster: 3, x: 810, y: 160 },
      { id: 'auth-svc', label: 'Auth Svc', cluster: 4, x: 450, y: 135 },
      { id: 'oauth', label: 'OAuth', cluster: 4, x: 560, y: 130 }
    ];
    const links = [
      { source: 'web-app', target: 'cdn' },
      { source: 'mobile', target: 'cdn' },
      { source: 'cdn', target: 'api-gw' },
      { source: 'web-app', target: 'api-gw' },
      { source: 'api-gw', target: 'user-svc' },
      { source: 'api-gw', target: 'order-svc' },
      { source: 'order-svc', target: 'notify' },
      { source: 'user-svc', target: 'notify' },
      { source: 'user-svc', target: 'postgres' },
      { source: 'order-svc', target: 'postgres' },
      { source: 'user-svc', target: 'redis' },
      { source: 'order-svc', target: 'redis' },
      { source: 'notify', target: 'kafka' },
      { source: 'api-gw', target: 'kafka' },
      { source: 'kafka', target: 'analytics' },
      { source: 'postgres', target: 'analytics' },
      { source: 'auth-svc', target: 'api-gw' },
      { source: 'auth-svc', target: 'oauth' },
      { source: 'oauth', target: 'k8s' },
      { source: 'k8s', target: 'api-gw' },
      { source: 'k8s', target: 'postgres' },
      { source: 'k8s', target: 'monitor' },
      { source: 'cicd', target: 'k8s' },
      { source: 'monitor', target: 'analytics' }
    ];
    const clusterNames = ['Frontend', 'Backend', 'Data', 'Infra', 'Auth'];
    const byId = {};
    nodes.forEach(function(node) {
      byId[node.id] = Object.assign({}, node, { degree: 0, neighbors: [] });
    });
    links.forEach(function(link) {
      byId[link.source].degree += 1;
      byId[link.target].degree += 1;
      byId[link.source].neighbors.push(link.target);
      byId[link.target].neighbors.push(link.source);
    });

    function hexToRgb(hex) {
      const parsed = echarts.color.parse(hex) || [0, 0, 0, 1];
      return [parsed[0], parsed[1], parsed[2]];
    }

    function rgbToHex(rgb) {
      return '#' + rgb.map(function(channel) {
        const value = Math.max(0, Math.min(255, Math.round(channel)));
        return value.toString(16).padStart(2, '0');
      }).join('');
    }

    function mixColor(baseHex, bgHex, ratio) {
      const base = hexToRgb(baseHex);
      const bg = hexToRgb(bgHex);
      return rgbToHex(base.map(function(channel, index) {
        return bg[index] + (channel - bg[index]) * ratio;
      }));
    }

    function tooltip(state, param) {
      const dark = state.dark;
      const meta = param.data || {};
      return tooltipCard(dark,
        '<div style="color:' + (dark ? '#E6E0E9' : '#1C1B1F') + ';font-size:13px;font-weight:600;">' + meta.label + '</div>' +
        '<div style="margin-top:4px;color:' + (dark ? '#CAC4D0' : '#49454F') + ';font-size:10px;">' + clusterNames[meta.cluster] + ' cluster</div>' +
        '<div style="margin-top:6px;color:' + (dark ? '#E6E0E9' : '#1C1B1F') + ';font-size:11px;font-weight:600;">' + meta.degree + ' connection' + (meta.degree === 1 ? '' : 's') + '</div>' +
        '<div style="margin-top:4px;color:' + (dark ? '#938F99' : '#79747E') + ';font-size:10px;">' + meta.neighbors.join(' · ') + '</div>',
        '188px'
      );
    }

    return createManagedChart(container, function(chart, state, containerEl) {
      const dark = state.dark;
      const compact = isCompactChart(chart);
      const medium = isMediumChart(chart);
      const darkPalette = ['#22D3EE', '#10B981', '#FBB724', '#FB6181', '#A78BFA', '#60A5FA', '#2DD4BF', '#94A3B8'];
      const colors = dark ? darkPalette : state.colors;
      const bg = dark ? '#1C1B1F' : '#FFFBFE';
      const legendLayout = Object.assign({}, legendOverlayLayout(chart), {
        width: compact ? 92 : (medium ? 102 : 122),
        right: compact ? 6 : 8
      });
      const legendReserve = legendLayout.width + legendLayout.right + (compact ? 26 : (medium ? 34 : 42));
      setLegendOverlayConfig(containerEl, {
        dark: dark,
        layout: legendLayout,
        items: clusterNames.map(function(name, idx) {
          return { name: name, color: colors[idx] };
        })
      });

      const nodeSize = compact ? 13 : (medium ? 16 : 18);
      const edgeOpacity = dark ? 0.78 : 0.9;
      const plotLeft = compact ? 28 : (medium ? 38 : 52);
      const plotRight = compact ? (legendReserve + 10) : (legendReserve + (medium ? 16 : 24));
      const plotTop = compact ? 14 : (medium ? 18 : 22);
      const plotBottom = compact ? 22 : (medium ? 26 : 30);
      const plotWidth = Math.max(150, chart.getWidth() - plotLeft - plotRight);
      const plotHeight = Math.max(130, chart.getHeight() - plotTop - plotBottom);
      const sourceMinX = 68;
      const sourceMaxX = 850;
      const sourceMinY = 100;
      const sourceMaxY = 500;
      const plotNodes = nodes.map(function(node) {
        const source = byId[node.id];
        const fill = mixColor(colors[node.cluster], bg, dark ? 0.9 : 1);
        const stroke = mixColor(colors[node.cluster], bg, dark ? 0.96 : 0.72);
        const symbolSize = nodeSize + Math.min(source.degree, 6) * (compact ? 1.1 : (medium ? 1.35 : 1.55));
        const radius = symbolSize / 2;
        const x = plotLeft + ((node.x - sourceMinX) / (sourceMaxX - sourceMinX)) * plotWidth;
        const y = plotTop + ((node.y - sourceMinY) / (sourceMaxY - sourceMinY)) * plotHeight;
        const xClampMin = plotLeft + radius + 10;
        const xClampMax = plotLeft + plotWidth - radius - 8;
        const yClampMin = plotTop + radius + 4;
        const yClampMax = plotTop + plotHeight - radius - (compact ? 16 : 20);
        return {
          id: node.id,
          name: node.label,
          x: Math.max(xClampMin, Math.min(xClampMax, x)),
          y: Math.max(yClampMin, Math.min(yClampMax, y)),
          symbolSize: symbolSize,
          label: node.label,
          cluster: node.cluster,
          degree: source.degree,
          neighbors: source.neighbors.map(function(id) { return byId[id].label; }),
          itemStyle: {
            color: fill,
            borderColor: stroke,
            borderWidth: 2
          },
          labelCfg: {
            color: dark ? '#E6E0E9' : '#1C1B1F',
            fontSize: compact ? 8 : 9.5
          }
        };
      });
      const plotLinks = links.map(function(link) {
        return {
          source: link.source,
          target: link.target,
          lineStyle: {
            color: colors[byId[link.source].cluster],
            width: 1.5,
            opacity: edgeOpacity
          }
        };
      });

      return {
        animationDuration: 900,
        animationDurationUpdate: 250,
        animationEasing: 'cubicOut',
        backgroundColor: 'transparent',
        tooltip: {
          trigger: 'item',
          confine: true,
          backgroundColor: 'transparent',
          borderWidth: 0,
          padding: 0,
          extraCssText: 'box-shadow:none;background:transparent;',
          formatter: function(param) {
            if (param.dataType === 'edge') return '';
            return tooltip(state, param);
          },
          position: function(pos, params, dom, rect, size) {
            return smartTooltipPosition(pos, rect || { x: pos[0], y: pos[1], width: 0, height: 0 }, size, dom, dark, true, 20);
          }
        },
        series: [{
          type: 'graph',
          coordinateSystem: null,
          layout: 'none',
          left: plotLeft,
          top: plotTop,
          right: plotRight,
          bottom: plotBottom,
          roam: false,
          nodeScaleRatio: 1,
          data: plotNodes.map(function(node) {
            return {
              id: node.id,
              name: node.name,
              x: node.x,
              y: node.y,
              value: node.degree,
              symbol: 'circle',
              symbolSize: node.symbolSize,
              itemStyle: node.itemStyle,
              meta: {
                label: node.label,
                cluster: node.cluster,
                degree: node.degree,
                neighbors: node.neighbors
              },
              label: {
                show: true,
                position: 'bottom',
                distance: compact ? 4 : 6,
                color: node.labelCfg.color,
                fontSize: node.labelCfg.fontSize
              },
              emphasis: {
                itemStyle: {
                  borderColor: dark ? '#E6E0E9' : '#1C1B1F',
                  borderWidth: 2
                }
              }
            };
          }),
          links: plotLinks,
          lineStyle: {
            curveness: 0,
            opacity: edgeOpacity
          },
          edgeSymbol: ['none', 'none'],
          edgeLabel: { show: false },
          animationDelay: function(idx) { return idx * 42; },
          emphasis: {
            focus: 'adjacency',
            lineStyle: { width: 2, opacity: 1 }
          },
          blur: {
            itemStyle: { opacity: 0.2 },
            lineStyle: { opacity: 0.08 }
          },
          draggable: false,
          z: 3
        }]
      };
    });
  }

  function makeCircularNetworkChart(container) {
    const nodes = [
      { id: 'web-app', label: 'Web App', cluster: 0 },
      { id: 'mobile', label: 'Mobile', cluster: 0 },
      { id: 'cdn', label: 'CDN', cluster: 0 },
      { id: 'api-gw', label: 'API GW', cluster: 1 },
      { id: 'user-svc', label: 'User Svc', cluster: 1 },
      { id: 'order-svc', label: 'Order Svc', cluster: 1 },
      { id: 'notify', label: 'Notify', cluster: 1 },
      { id: 'postgres', label: 'Postgres', cluster: 2 },
      { id: 'redis', label: 'Redis', cluster: 2 },
      { id: 'kafka', label: 'Kafka', cluster: 2 },
      { id: 'analytics', label: 'Analytics', cluster: 2 },
      { id: 'k8s', label: 'K8s', cluster: 3 },
      { id: 'monitor', label: 'Monitor', cluster: 3 },
      { id: 'cicd', label: 'CI/CD', cluster: 3 },
      { id: 'auth-svc', label: 'Auth Svc', cluster: 4 },
      { id: 'oauth', label: 'OAuth', cluster: 4 }
    ];
    const links = [
      { source: 'web-app', target: 'cdn' },
      { source: 'mobile', target: 'cdn' },
      { source: 'cdn', target: 'api-gw' },
      { source: 'web-app', target: 'api-gw' },
      { source: 'api-gw', target: 'user-svc' },
      { source: 'api-gw', target: 'order-svc' },
      { source: 'order-svc', target: 'notify' },
      { source: 'user-svc', target: 'notify' },
      { source: 'user-svc', target: 'postgres' },
      { source: 'order-svc', target: 'postgres' },
      { source: 'user-svc', target: 'redis' },
      { source: 'order-svc', target: 'redis' },
      { source: 'notify', target: 'kafka' },
      { source: 'api-gw', target: 'kafka' },
      { source: 'kafka', target: 'analytics' },
      { source: 'postgres', target: 'analytics' },
      { source: 'auth-svc', target: 'api-gw' },
      { source: 'auth-svc', target: 'oauth' },
      { source: 'oauth', target: 'k8s' },
      { source: 'k8s', target: 'api-gw' },
      { source: 'k8s', target: 'postgres' },
      { source: 'k8s', target: 'monitor' },
      { source: 'cicd', target: 'k8s' },
      { source: 'monitor', target: 'analytics' }
    ];
    const clusterNames = ['Frontend', 'Backend', 'Data', 'Infra', 'Auth'];
    const byId = {};
    nodes.forEach(function(node) {
      byId[node.id] = Object.assign({}, node, { degree: 0, neighbors: [] });
    });
    links.forEach(function(link) {
      byId[link.source].degree += 1;
      byId[link.target].degree += 1;
      byId[link.source].neighbors.push(link.target);
      byId[link.target].neighbors.push(link.source);
    });

    function hexToRgb(hex) {
      const parsed = echarts.color.parse(hex) || [0, 0, 0, 1];
      return [parsed[0], parsed[1], parsed[2]];
    }

    function rgbToHex(rgb) {
      return '#' + rgb.map(function(channel) {
        const value = Math.max(0, Math.min(255, Math.round(channel)));
        return value.toString(16).padStart(2, '0');
      }).join('');
    }

    function mixColor(baseHex, bgHex, ratio) {
      const base = hexToRgb(baseHex);
      const bg = hexToRgb(bgHex);
      return rgbToHex(base.map(function(channel, index) {
        return bg[index] + (channel - bg[index]) * ratio;
      }));
    }

    function tooltip(state, param) {
      const dark = state.dark;
      const meta = param.data || {};
      return tooltipCard(dark,
        '<div style="color:' + (dark ? '#E6E0E9' : '#1C1B1F') + ';font-size:13px;font-weight:600;">' + meta.label + '</div>' +
        '<div style="margin-top:4px;color:' + (dark ? '#CAC4D0' : '#49454F') + ';font-size:10px;">' + clusterNames[meta.cluster] + ' cluster</div>' +
        '<div style="margin-top:6px;color:' + (dark ? '#E6E0E9' : '#1C1B1F') + ';font-size:11px;font-weight:600;">' + meta.degree + ' connection' + (meta.degree === 1 ? '' : 's') + '</div>' +
        '<div style="margin-top:4px;color:' + (dark ? '#938F99' : '#79747E') + ';font-size:10px;">' + meta.neighbors.join(' · ') + '</div>',
        '192px'
      );
    }

    return createManagedChart(container, function(chart, state, containerEl) {
      const dark = state.dark;
      const compact = isCompactChart(chart);
      const medium = isMediumChart(chart);
      const darkPalette = ['#22D3EE', '#10B981', '#FBB724', '#FB6181', '#A78BFA', '#60A5FA', '#2DD4BF', '#94A3B8'];
      const colors = dark ? darkPalette : state.colors;
      const bg = dark ? '#1C1B1F' : '#FFFBFE';
      const legendLayout = Object.assign({}, legendOverlayLayout(chart), {
        width: compact ? 92 : (medium ? 102 : 122),
        right: compact ? 6 : 8
      });
      const legendReserve = legendLayout.width + legendLayout.right + (compact ? 14 : (medium ? 20 : 28));

      setLegendOverlayConfig(containerEl, {
        dark: dark,
        layout: legendLayout,
        items: clusterNames.map(function(name, idx) {
          return { name: name, color: colors[idx] };
        })
      });

      const plotLeft = compact ? 34 : (medium ? 44 : 56);
      const plotRight = compact ? (legendReserve + 12) : (legendReserve + 18);
      const plotTop = compact ? 14 : (medium ? 18 : 22);
      const plotBottom = compact ? 18 : (medium ? 22 : 28);
      const plotWidth = Math.max(140, chart.getWidth() - plotLeft - plotRight);
      const plotHeight = Math.max(140, chart.getHeight() - plotTop - plotBottom);
      const centerX = plotLeft + plotWidth / 2;
      const centerY = plotTop + plotHeight / 2;
      const ringRadius = Math.max(72, Math.min(plotWidth, plotHeight) / 2 - (compact ? 12 : (medium ? 16 : 22)));
      const labelRadius = ringRadius + (compact ? 18 : 22);
      const gapDeg = compact ? 8 : 10;
      const totalGapDeg = clusterNames.length * gapDeg;
      const nodeArcDeg = 360 - totalGapDeg;
      const degPerNode = nodeArcDeg / nodes.length;
      let angleDeg = -90 - nodeArcDeg / 2;
      let previousCluster = null;

      const nodeData = nodes.map(function(node) {
        if (previousCluster !== null && node.cluster !== previousCluster) angleDeg += gapDeg;
        const angle = angleDeg + degPerNode / 2;
        angleDeg += degPerNode;
        previousCluster = node.cluster;
        const rad = angle * Math.PI / 180;
        const source = byId[node.id];
        const symbolSize = (compact ? 13 : (medium ? 16 : 18)) + Math.min(source.degree, 6) * (compact ? 1.1 : (medium ? 1.3 : 1.55));
        const radius = symbolSize / 2;
        const x = centerX + Math.cos(rad) * ringRadius;
        const y = centerY + Math.sin(rad) * ringRadius;
        const labelX = centerX + Math.cos(rad) * labelRadius;
        const labelY = centerY + Math.sin(rad) * labelRadius;
        const fill = mixColor(colors[node.cluster], bg, dark ? 0.9 : 1);
        const stroke = mixColor(colors[node.cluster], bg, dark ? 0.96 : 0.72);
        return {
          id: node.id,
          value: [x, y, radius, labelX, labelY],
          meta: {
            label: node.label,
            cluster: node.cluster,
            degree: source.degree,
            neighbors: source.neighbors.map(function(id) { return byId[id].label; }),
            fill: fill,
            stroke: stroke,
            align: Math.cos(rad) > 0.12 ? 'left' : (Math.cos(rad) < -0.12 ? 'right' : 'center'),
            fontSize: compact ? 8 : 9.5
          }
        };
      });

      const nodeIndex = {};
      nodeData.forEach(function(node) { nodeIndex[node.id] = node; });
      const edgeData = links.map(function(link, idx) {
        return {
          id: link.source + '-' + link.target,
          value: idx,
          meta: {
            source: link.source,
            target: link.target,
            color: colors[byId[link.source].cluster]
          }
        };
      });

      function renderEdge(params, api) {
        const item = edgeData[params.dataIndex];
        const source = nodeIndex[item.meta.source];
        const target = nodeIndex[item.meta.target];
        if (!source || !target) return null;
        return {
          type: 'line',
          silent: true,
          shape: {
            x1: source.value[0],
            y1: source.value[1],
            x2: target.value[0],
            y2: target.value[1]
          },
          style: {
            stroke: item.meta.color,
            lineWidth: 1.5,
            opacity: dark ? 0.78 : 0.9
          },
          transition: ['shape', 'style']
        };
      }

      function renderNode(params, api) {
        const item = nodeData[params.dataIndex];
        const x = api.value(0);
        const y = api.value(1);
        const r = api.value(2);
        const labelX = api.value(3);
        const labelY = api.value(4);
        const meta = item.meta;
        return {
          type: 'group',
          children: [
            {
              type: 'circle',
              shape: { cx: x, cy: y, r: r },
              style: { fill: meta.fill, stroke: meta.stroke, lineWidth: 2 },
              transition: ['shape', 'style']
            },
            {
              type: 'text',
              silent: true,
              style: {
                x: labelX,
                y: labelY,
                text: meta.label,
                textAlign: meta.align,
                textVerticalAlign: 'middle',
                fill: dark ? '#E6E0E9' : '#1C1B1F',
                font: '500 ' + meta.fontSize + 'px Roboto, Helvetica Neue, Arial, sans-serif'
              }
            }
          ]
        };
      }

      return {
        animationDuration: 900,
        animationDurationUpdate: 250,
        animationEasing: 'cubicOut',
        backgroundColor: 'transparent',
        tooltip: {
          trigger: 'item',
          confine: true,
          backgroundColor: 'transparent',
          borderWidth: 0,
          padding: 0,
          extraCssText: 'box-shadow:none;background:transparent;',
          formatter: function(param) { return tooltip(state, param); },
          position: function(pos, params, dom, rect, size) {
            return smartTooltipPosition(pos, rect || { x: pos[0], y: pos[1], width: 0, height: 0 }, size, dom, dark, true, 20);
          }
        },
        xAxis: { type: 'value', min: 0, max: chart.getWidth(), show: false },
        yAxis: { type: 'value', min: 0, max: chart.getHeight(), inverse: true, show: false },
        grid: { left: 0, right: 0, top: 0, bottom: 0 },
        series: [
          {
            type: 'custom',
            coordinateSystem: 'cartesian2d',
            renderItem: renderEdge,
            data: edgeData,
            silent: true,
            animationDelay: function(idx) { return idx * 35; },
            progressive: 0,
            z: 1
          },
          {
            type: 'custom',
            coordinateSystem: 'cartesian2d',
            renderItem: renderNode,
            data: nodeData,
            animationDelay: function(idx) { return edgeData.length * 35 + idx * 45; },
            progressive: 0,
            z: 3,
            encode: { x: 0, y: 1, tooltip: 2 },
            emphasis: { focus: 'self' },
            blur: { itemStyle: { opacity: 0.15 } }
          }
        ]
      };
    });
  }

  function makeStackedBarChart(container) {
    const quarters = ["Q1 '22", "Q2 '22", "Q3 '22", "Q4 '22", "Q1 '23", "Q2 '23", "Q3 '23", "Q4 '23"];
    const seriesData = [
      { name: 'Cyan', values: [38, 42, 46, 50, 55, 60, 66, 72] },
      { name: 'Emerald', values: [18, 20, 21, 23, 25, 27, 31, 35] },
      { name: 'Amber', values: [11, 12, 13, 14, 15, 17, 19, 22] },
      { name: 'Violet', values: [32, 35, 38, 41, 45, 50, 56, 62] },
      { name: 'Slate', values: [10, 11, 12, 13, 14, 16, 17, 19] }
    ];
    const stackedSeries = seriesData.slice().reverse();
    const totals = quarters.map(function(_, idx) { return seriesData.reduce(function(sum, s) { return sum + s.values[idx]; }, 0); });

    function tooltip(state, params) {
      const dark = state.dark;
      const maxRows = state.compact ? 3 : (state.medium ? 4 : 8);
      const rows = truncateTooltipRows(params.slice().reverse().map(function(param) {
        return '<div style="display:flex;align-items:center;justify-content:space-between;gap:12px;margin-top:6px;">' +
          '<div style="display:flex;align-items:center;gap:8px;color:' + (dark ? '#CAC4D0' : '#49454F') + ';font-size:10px;"><span style="width:8px;height:8px;border-radius:999px;background:' + param.color + ';display:inline-block;"></span><span>' + param.seriesName + '</span></div>' +
          '<div style="color:' + (dark ? '#E6E0E9' : '#1C1B1F') + ';font-size:11px;font-weight:600;">$' + param.value + 'M</div></div>';
      }), maxRows, dark).join('');
      const total = totals[params[0].dataIndex];
      return tooltipCard(dark,
        '<div style="color:' + (dark ? '#E6E0E9' : '#1C1B1F') + ';font-size:13px;font-weight:600;">' + params[0].axisValue + '</div>' +
        '<div style="margin-top:6px;border-top:1px solid ' + (dark ? '#49454F' : '#E7E0EC') + ';"></div>' + rows +
        '<div style="margin-top:8px;border-top:1px solid ' + (dark ? '#49454F' : '#E7E0EC') + ';"></div>' +
        '<div style="display:flex;align-items:center;justify-content:space-between;gap:12px;margin-top:8px;"><div style="color:' + (dark ? '#CAC4D0' : '#49454F') + ';font-size:10px;">Total</div><div style="color:' + (dark ? '#E6E0E9' : '#1C1B1F') + ';font-size:11px;font-weight:600;">$' + total + 'M</div></div>',
        '158px'
      );
    }

    function legendGraphic(chart, dark, colors) {
      const metrics = legendPanelMetrics(chart, seriesData.length, 34, 38);
      if (metrics.compact) return [];
      const panelWidth = metrics.panelWidth;
      const panelX = metrics.panelX;
      const panelY = metrics.panelY;
      const rowStartY = metrics.compact ? 30 : metrics.rowStartY;
      const rowHeight = metrics.compact ? 15 : 18;
      const panelHeight = metrics.compact ? Math.min(144, Math.max(118, chart.getHeight() - panelY - 10)) : Math.min(metrics.panelHeight, rowStartY + seriesData.length * rowHeight + 12);
      const markerSize = metrics.medium ? 8 : 14;
      const markerRadius = metrics.medium ? 2 : 3;
      const titleFont = metrics.medium ? '500 8px Roboto, Helvetica Neue, Arial, sans-serif' : '500 10px Roboto, Helvetica Neue, Arial, sans-serif';
      const labelFont = metrics.medium ? '400 7px Roboto, Helvetica Neue, Arial, sans-serif' : '400 11px Roboto, Helvetica Neue, Arial, sans-serif';
      const group = { type: 'group', left: panelX, top: panelY, bounding: 'all', children: [{
        type: 'rect', shape: { x: 0, y: 0, width: panelWidth, height: panelHeight, r: 14 }, style: { fill: dark ? '#2A2630' : '#F3EDF7', stroke: dark ? '#938F99' : '#79747E', lineWidth: 1 }
      }, {
        type: 'text', style: { x: metrics.medium ? 10 : 18, y: metrics.medium ? 13 : 18, text: 'SERIES', fill: dark ? '#938F99' : '#79747E', font: titleFont }
      }] };
      seriesData.forEach(function(s, idx) {
        const y = rowStartY + idx * rowHeight;
        group.children.push({ type: 'rect', shape: { x: metrics.medium ? 10 : 18, y: y - Math.round(markerSize / 2), width: markerSize, height: markerSize, r: markerRadius }, style: { fill: colors[idx] } });
        group.children.push({ type: 'text', style: { x: metrics.medium ? 22 : 40, y: y, text: s.name, textVerticalAlign: 'middle', fill: dark ? '#E6E0E9' : '#1C1B1F', font: labelFont } });
      });
      return [group];
    }

    return createManagedChart(container, function(chart, state, containerEl) {
      const dark = state.dark;
      const compact = isCompactChart(chart);
      const medium = isMediumChart(chart);
      state.compact = compact;
      state.medium = medium;
      const darkPalette = ['#22D3EE', '#10B981', '#FBB724', '#A78BFA', '#94A3B8'];
      const lightPalette = ['#00D4E8', '#00B87A', '#F59E0B', '#8B5CF6', '#64748B'];
      const colors = dark ? darkPalette : lightPalette;
      setLegendOverlayConfig(containerEl, {
        dark: dark,
        layout: legendOverlayLayout(chart),
        items: seriesData.map(function(series, idx) { return { name: series.name, color: colors[idx] }; })
      });
      const colorByName = seriesData.reduce(function(map, s, idx) { map[s.name] = colors[idx]; return map; }, {});
      const gridLeft = compact ? 28 : (medium ? 32 : 48);
      const gridRight = legendGridRight(chart);
      const plotW = chart.getWidth() - gridLeft - gridRight;
      return {
        animationDuration: 400, animationDurationUpdate: 250, animationEasing: 'cubicOut', backgroundColor: 'transparent', color: colors,
        grid: { left: gridLeft, right: gridRight, top: compact ? 14 : (medium ? 18 : 24), bottom: 34 },
        tooltip: {
          trigger: 'axis',
          axisPointer: { type: 'shadow', shadowStyle: { color: dark ? 'rgba(255,255,255,0.04)' : 'rgba(121,116,126,0.08)' } },
          backgroundColor: 'transparent', borderWidth: 0, padding: 0, extraCssText: 'box-shadow:none;background:transparent;',
          formatter: function(params) { return tooltip(state, params); },
          position: function(pos, params, dom, rect, size) { return smartTooltipPosition(pos, rect, size, dom, dark, true, 24); }
        },
        graphic: [{
          type: 'line', left: gridLeft + plotW / 2, top: compact ? 18 : 24, shape: { x1: 0, y1: 0, x2: 0, y2: chart.getHeight() - (compact ? 46 : 58) }, style: { stroke: dark ? '#938F99' : '#c0b8a8', lineWidth: 1, opacity: 0.6, lineDash: [5, 4] }
        }, {
          type: 'text', left: gridLeft + plotW / 4 - 14, top: compact ? 0 : 2, style: { text: '2022', fill: dark ? '#938F99' : '#79747E', font: '400 ' + (compact ? 9 : 10) + 'px Roboto, Helvetica Neue, Arial, sans-serif' }
        }, {
          type: 'text', left: gridLeft + plotW * 0.75 - 14, top: compact ? 0 : 2, style: { text: '2023', fill: dark ? '#938F99' : '#79747E', font: '400 ' + (compact ? 9 : 10) + 'px Roboto, Helvetica Neue, Arial, sans-serif' }
        }],
        xAxis: { type: 'category', data: quarters, axisLine: { lineStyle: { color: dark ? '#938F99' : '#79747E', width: 1.5 } }, axisTick: { show: false }, axisLabel: { color: dark ? '#938F99' : '#79747E', fontSize: compact ? 8 : (medium ? 9 : 10), margin: compact ? 8 : (medium ? 10 : 14) } },
        yAxis: { type: 'value', min: 0, max: 250, interval: compact ? 100 : 50, axisLine: { show: true, lineStyle: { color: dark ? '#938F99' : '#79747E', width: 1.5 } }, axisTick: { show: false }, axisLabel: { color: dark ? '#938F99' : '#79747E', fontSize: compact ? 8 : (medium ? 9 : 10), formatter: function(v) { return '$' + v + 'M'; } }, splitLine: { lineStyle: { color: dark ? '#49454F' : '#E7E0EC' } } },
        series: stackedSeries.map(function(series, idx) {
          return { type: 'bar', name: series.name, stack: 'total', barWidth: compact ? 18 : (medium ? 24 : 30), emphasis: { focus: 'series', blurScope: 'coordinateSystem' }, blur: { itemStyle: { opacity: 0.2 } }, animationDuration: 400, animationEasing: 'cubicOut', animationDelay: function(dataIndex) { return dataIndex * 224; }, itemStyle: { color: colorByName[series.name], borderRadius: idx === 0 ? [0, 0, 5, 5] : (idx === stackedSeries.length - 1 ? [5, 5, 0, 0] : [0, 0, 0, 0]) }, label: { show: false }, data: series.values };
        })
      };
    });
  }

  function makeStepLineChart(container) {
    const years = ['1994', '1995', '1996', '1998', '1999', '2000', '2001', '2002', '2003', '2004', '2005', '2006', '2007', '2008', '2009', '2015', '2016', '2017', '2018', '2020', '2022', '2023'];
    const seriesData = [
      { name: '1994-99 Cycle', values: [3.0, 6.0, 5.5, 4.75, 5.5, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null], paletteIndex: 0 },
      { name: '2000-03 Easing', values: [null, null, null, null, 6.5, null, 4.0, 2.0, 1.0, null, null, null, null, null, null, null, null, null, null, null, null, null], paletteIndex: 1 },
      { name: '2004-06 Hiking', values: [null, null, null, null, null, null, null, null, 1.0, 2.0, 4.0, 5.25, null, null, null, null, null, null, null, null, null, null], paletteIndex: 2 },
      { name: '2007-09 GFC Cut', values: [null, null, null, null, null, null, null, null, null, null, null, 5.25, 4.0, 2.0, 0.5, null, null, null, null, null, null, null], paletteIndex: 3 },
      { name: '2015-20 Cycle', values: [null, null, null, null, null, null, null, null, null, null, null, null, null, null, 0.25, 0.25, 1.0, 1.75, 2.5, 0.25, null, null], paletteIndex: 4 },
      { name: '2022-23 Inflation', values: [null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, 0.25, 1.5, 4.0], paletteIndex: 5 }
    ];

    function formatRate(value) {
      if (Math.abs(value - Math.round(value)) < 0.001) return value.toFixed(1) + '%';
      if (Math.abs(value * 10 - Math.round(value * 10)) < 0.001) return value.toFixed(1) + '%';
      return value.toFixed(2).replace(/0+$/, '').replace(/\.$/, '') + '%';
    }

    function toSeriesValues(values) {
      return values.map(function(value) {
        if (typeof value !== 'number') return '-';
        return value;
      });
    }

    function tooltip(state, params) {
      const dark = state.dark;
      const rows = params.filter(function(param) {
        return typeof param.value === 'number';
      }).map(function(param) {
        return '<div style="display:flex;align-items:center;justify-content:space-between;gap:12px;margin-top:6px;">' +
          '<div style="display:flex;align-items:center;gap:8px;color:' + (dark ? '#CAC4D0' : '#49454F') + ';font-size:10px;"><span style="width:8px;height:8px;border-radius:999px;background:' + param.color + ';display:inline-block;"></span><span>' + param.seriesName + '</span></div>' +
          '<div style="color:' + (dark ? '#E6E0E9' : '#1C1B1F') + ';font-size:11px;font-weight:600;">' + formatRate(param.value) + '</div></div>';
      }).join('');
      const label = params[0] ? params[0].axisValueLabel : '';
      return tooltipCard(dark,
        '<div style="color:' + (dark ? '#E6E0E9' : '#1C1B1F') + ';font-size:13px;font-weight:600;">' + label + '</div>' +
        '<div style="margin-top:4px;color:' + (dark ? '#938F99' : '#79747E') + ';font-size:10px;">Federal funds rate</div>' +
        rows,
        '168px'
      );
    }

    return createManagedChart(container, function(chart, state, containerEl) {
      const dark = state.dark;
      const compact = isCompactChart(chart);
      const medium = isMediumChart(chart);
      const darkPalette = ['#22D3EE', '#10B981', '#FBB724', '#FB6181', '#A78BFA', '#60A5FA'];
      const lightPalette = [state.colors[0], state.colors[1], state.colors[2], state.colors[3], state.colors[4], state.colors[5]];
      const colors = dark ? darkPalette : lightPalette;
      setLegendOverlayConfig(containerEl, {
        dark: dark,
        layout: legendOverlayLayout(chart),
        items: seriesData.map(function(series, idx) { return { name: series.name, color: colors[idx] }; })
      });
      return {
        animationDuration: 800,
        animationDurationUpdate: 250,
        animationEasing: 'cubicOut',
        backgroundColor: 'transparent',
        color: colors,
        grid: { left: compact ? 26 : (medium ? 30 : 48), right: legendGridRight(chart), top: compact ? 16 : 24, bottom: compact ? 28 : 40 },
        tooltip: {
          trigger: 'axis',
          confine: true,
          axisPointer: { type: 'line', lineStyle: { color: dark ? '#938F99' : '#79747E', width: 1, type: 'dashed' } },
          backgroundColor: 'transparent',
          borderWidth: 0,
          padding: 0,
          extraCssText: 'box-shadow:none;background:transparent;',
          formatter: function(params) { return tooltip(state, params); },
          position: function(pos, params, dom, rect, size) { return smartTooltipPosition(pos, rect || { x: pos[0], y: pos[1], width: 0, height: 0 }, size, dom, dark, true, 22); }
        },
        xAxis: {
          type: 'category',
          boundaryGap: false,
          data: years,
          axisLine: { show: true, lineStyle: { color: dark ? '#938F99' : '#79747E', width: 1.5 } },
          axisTick: { show: false },
          axisLabel: {
            color: dark ? '#938F99' : '#79747E',
            fontSize: compact ? 8 : (medium ? 9 : 10),
            interval: function(index) {
              return [0, 3, 6, 9, 12, 15, 21].indexOf(index) === -1;
            }
          },
          splitLine: { show: false }
        },
        yAxis: {
          type: 'value',
          min: 0,
          max: 10,
          interval: 2,
          axisLine: { show: true, lineStyle: { color: dark ? '#938F99' : '#79747E', width: 1.5 } },
          axisTick: { show: false },
          axisLabel: {
            color: dark ? '#938F99' : '#79747E',
            fontSize: compact ? 8 : (medium ? 9 : 10),
            formatter: function(v) { return v + '%'; }
          },
          splitLine: { lineStyle: { color: dark ? '#49454F' : '#E7E0EC' } }
        },
        series: seriesData.map(function(series, idx) {
          return {
            type: 'line',
            id: 'step-line-' + idx,
            name: series.name,
            step: 'end',
            showSymbol: true,
            symbol: 'circle',
            symbolSize: compact ? 6 : (medium ? 7 : 8),
            connectNulls: false,
            data: toSeriesValues(series.values),
            lineStyle: {
              width: compact ? 2 : 2.5,
              color: colors[idx],
              type: 'solid'
            },
            itemStyle: {
              color: colors[idx],
              borderColor: dark ? '#151825' : '#FFFBFE',
              borderWidth: 0
            },
            emphasis: { focus: 'series', blurScope: 'coordinateSystem' },
            blur: { lineStyle: { opacity: 0.2 }, itemStyle: { opacity: 0.2 } },
            animationDelay: function() { return idx * 160; },
            animationDuration: 900,
            animationEasing: 'cubicOut',
            z: 5 + idx
          };
        })
      };
    });
  }

  function makeJumpLineChart(container) {
    const quarters = ["Q1 '22", "Q2 '22", "Q3 '22", "Q4 '22", "Q1 '23", "Q2 '23", "Q3 '23", "Q4 '23"];
    const seriesData = [
      { name: 'North America', values: [1.0, 1.5, 2.5, 3.5, 4.75, 5.0, 5.25, 5.25], paletteIndex: 0 },
      { name: 'Europe', values: [0.5, 0.5, 1.0, 2.0, 3.0, 3.5, 4.0, 4.25], paletteIndex: 1 },
      { name: 'Asia-Pacific', values: [0.25, 0.5, 0.75, 1.25, 2.0, 2.5, 2.75, 3.0], paletteIndex: 2 }
    ];

    function formatRate(value) {
      if (Math.abs(value - Math.round(value)) < 0.001) return value.toFixed(1) + '%';
      if (Math.abs(value * 10 - Math.round(value * 10)) < 0.001) return value.toFixed(1) + '%';
      return value.toFixed(2).replace(/0+$/, '').replace(/\.$/, '') + '%';
    }

    function buildSeriesValues(values) {
      return values.map(function(value) {
        return value;
      });
    }

    function tooltip(state, params) {
      const dark = state.dark;
      const rows = params.map(function(param) {
        return '<div style="display:flex;align-items:center;justify-content:space-between;gap:12px;margin-top:6px;">' +
          '<div style="display:flex;align-items:center;gap:8px;color:' + (dark ? '#CAC4D0' : '#49454F') + ';font-size:10px;"><span style="width:8px;height:8px;border-radius:999px;background:' + param.color + ';display:inline-block;"></span><span>' + param.seriesName + '</span></div>' +
          '<div style="color:' + (dark ? '#E6E0E9' : '#1C1B1F') + ';font-size:11px;font-weight:600;">' + formatRate(param.value) + '</div></div>';
      }).join('');
      return tooltipCard(dark,
        '<div style="color:' + (dark ? '#E6E0E9' : '#1C1B1F') + ';font-size:13px;font-weight:600;">' + params[0].axisValue + '</div>' +
        '<div style="margin-top:4px;color:' + (dark ? '#938F99' : '#79747E') + ';font-size:10px;">Benchmark rates by region</div>' +
        rows,
        '172px'
      );
    }

    return createManagedChart(container, function(chart, state, containerEl) {
      const dark = state.dark;
      const compact = isCompactChart(chart);
      const medium = isMediumChart(chart);
      const darkPalette = ['#22D3EE', '#10B981', '#FBB724'];
      const lightPalette = [state.colors[0], state.colors[1], state.colors[2]];
      const colors = dark ? darkPalette : lightPalette;
      setLegendOverlayConfig(containerEl, {
        dark: dark,
        layout: legendOverlayLayout(chart),
        items: seriesData.map(function(series, idx) {
          return { name: series.name + ' ' + formatRate(series.values[series.values.length - 1]), color: colors[idx] };
        })
      });
      return {
        animationDuration: 800,
        animationDurationUpdate: 800,
        animationEasing: 'cubicOut',
        backgroundColor: 'transparent',
        color: colors,
        grid: { left: compact ? 26 : (medium ? 30 : 48), right: legendGridRight(chart), top: compact ? 16 : 24, bottom: compact ? 28 : 40 },
        tooltip: {
          trigger: 'axis',
          confine: true,
          axisPointer: { type: 'line', lineStyle: { color: dark ? '#938F99' : '#79747E', width: 1, type: 'dashed' } },
          backgroundColor: 'transparent',
          borderWidth: 0,
          padding: 0,
          extraCssText: 'box-shadow:none;background:transparent;',
          formatter: function(params) { return tooltip(state, params); },
          position: function(pos, params, dom, rect, size) { return smartTooltipPosition(pos, rect || { x: pos[0], y: pos[1], width: 0, height: 0 }, size, dom, dark, true, 22); }
        },
        xAxis: {
          type: 'category',
          boundaryGap: false,
          data: quarters,
          axisLine: { show: true, lineStyle: { color: dark ? '#938F99' : '#79747E', width: 1.5 } },
          axisTick: { show: false },
          axisLabel: { color: dark ? '#938F99' : '#79747E', fontSize: compact ? 8 : (medium ? 9 : 10), margin: compact ? 8 : 12 }
        },
        yAxis: {
          type: 'value',
          min: 0,
          max: 8,
          interval: 2,
          axisLine: { show: true, lineStyle: { color: dark ? '#938F99' : '#79747E', width: 1.5 } },
          axisTick: { show: false },
          axisLabel: {
            color: dark ? '#938F99' : '#79747E',
            fontSize: compact ? 8 : (medium ? 9 : 10),
            formatter: function(v) { return v + '%'; }
          },
          splitLine: { lineStyle: { color: dark ? '#49454F' : '#E7E0EC' } }
        },
        series: seriesData.map(function(series, idx) {
          return {
            type: 'line',
            id: 'jump-line-' + idx,
            name: series.name,
            step: 'end',
            showSymbol: true,
            symbol: 'circle',
            symbolSize: compact ? 7 : (medium ? 8 : 10),
            data: buildSeriesValues(series.values),
            lineStyle: {
              width: compact ? 2 : 2.5,
              color: colors[idx]
            },
            itemStyle: {
              color: dark ? '#1C1B1F' : '#FFFBFE',
              borderColor: colors[idx],
              borderWidth: 2
            },
            emphasis: { focus: 'series', blurScope: 'coordinateSystem' },
            blur: { lineStyle: { opacity: 0.2 }, itemStyle: { opacity: 0.2 } },
            animationDelay: function() { return idx * 220; },
            animationDuration: 900,
            animationEasing: 'cubicOut',
            z: 6 + idx
          };
        })
      };
    });
  }

  function makeStepAreaChart(container) {
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct'];
    const seriesData = [
      { name: 'Engineering', values: [95, 95, 110, 110, 128, 128, 155, 155, 182, 182], paletteIndex: 0 },
      { name: 'Data & ML', values: [60, 72, 72, 88, 88, 105, 105, 120, 143, 143], paletteIndex: 1 },
      { name: 'Product', values: [38, 38, 45, 45, 52, 52, 60, 60, 67, 67], paletteIndex: 2 },
      { name: 'Marketing', values: [28, 28, 32, 32, 38, 38, 40, 44, 44, 44], paletteIndex: 3 }
    ];

    function areaGradient(color, dark) {
      return new echarts.graphic.LinearGradient(0, 0, 0, 1, [
        { offset: 0, color: echarts.color.modifyAlpha(color, dark ? 0.22 : 0.18) },
        { offset: 1, color: echarts.color.modifyAlpha(color, 0.03) }
      ]);
    }

    function tooltip(state, params) {
      const dark = state.dark;
      const rows = params.filter(function(param) {
        return param.seriesName.indexOf('markers') === -1;
      }).map(function(param) {
        return '<div style="display:flex;align-items:center;justify-content:space-between;gap:12px;margin-top:6px;">' +
          '<div style="display:flex;align-items:center;gap:8px;color:' + (dark ? '#CAC4D0' : '#49454F') + ';font-size:10px;"><span style="width:8px;height:8px;border-radius:999px;background:' + param.color + ';display:inline-block;"></span><span>' + param.seriesName + '</span></div>' +
          '<div style="color:' + (dark ? '#E6E0E9' : '#1C1B1F') + ';font-size:11px;font-weight:600;">$' + param.value + 'k</div></div>';
      }).join('');
      return tooltipCard(dark,
        '<div style="color:' + (dark ? '#E6E0E9' : '#1C1B1F') + ';font-size:13px;font-weight:600;">' + params[0].axisValue + '</div>' +
        '<div style="margin-top:4px;color:' + (dark ? '#938F99' : '#79747E') + ';font-size:10px;">Cloud spend by department</div>' +
        rows,
        '170px'
      );
    }

    return createManagedChart(container, function(chart, state, containerEl) {
      const dark = state.dark;
      const compact = isCompactChart(chart);
      const medium = isMediumChart(chart);
      const darkPalette = ['#22D3EE', '#10B981', '#FBB724', '#FB6181'];
      const lightPalette = [state.colors[0], state.colors[1], state.colors[2], state.colors[3]];
      const colors = dark ? darkPalette : lightPalette;
      setLegendOverlayConfig(containerEl, {
        dark: dark,
        layout: legendOverlayLayout(chart),
        items: seriesData.map(function(series, idx) {
          return { name: series.name + ' $' + series.values[series.values.length - 1] + 'k', color: colors[idx] };
        })
      });
      return {
        animationDuration: 900,
        animationDurationUpdate: 250,
        animationEasing: 'cubicOut',
        backgroundColor: 'transparent',
        color: colors,
        grid: { left: compact ? 26 : (medium ? 30 : 48), right: legendGridRight(chart), top: compact ? 16 : 24, bottom: compact ? 28 : 40 },
        tooltip: {
          trigger: 'axis',
          confine: true,
          axisPointer: { type: 'line', lineStyle: { color: dark ? '#938F99' : '#79747E', width: 1, type: 'dashed' } },
          backgroundColor: 'transparent',
          borderWidth: 0,
          padding: 0,
          extraCssText: 'box-shadow:none;background:transparent;',
          formatter: function(params) { return tooltip(state, params); },
          position: function(pos, params, dom, rect, size) { return smartTooltipPosition(pos, rect || { x: pos[0], y: pos[1], width: 0, height: 0 }, size, dom, dark, true, 22); }
        },
        xAxis: {
          type: 'category',
          boundaryGap: false,
          data: months,
          axisLine: { show: true, lineStyle: { color: dark ? '#938F99' : '#79747E', width: 1.5 } },
          axisTick: { show: false },
          axisLabel: { color: dark ? '#938F99' : '#79747E', fontSize: compact ? 8 : (medium ? 9 : 10), margin: compact ? 8 : 12 }
        },
        yAxis: {
          type: 'value',
          min: 0,
          max: 200,
          interval: 50,
          axisLine: { show: true, lineStyle: { color: dark ? '#938F99' : '#79747E', width: 1.5 } },
          axisTick: { show: false },
          axisLabel: {
            color: dark ? '#938F99' : '#79747E',
            fontSize: compact ? 8 : (medium ? 9 : 10),
            formatter: function(v) { return '$' + v + (v === 0 ? '' : 'k'); }
          },
          splitLine: { lineStyle: { color: dark ? '#49454F' : '#E7E0EC' } }
        },
        series: seriesData.slice().reverse().map(function(series) {
          const idx = series.paletteIndex;
          return {
            type: 'line',
            id: 'step-area-' + idx,
            name: series.name,
            step: 'end',
            showSymbol: false,
            symbol: 'circle',
            connectNulls: false,
            data: series.values,
            lineStyle: {
              width: compact ? 2 : 2.5,
              color: colors[idx]
            },
            itemStyle: {
              color: dark ? '#1C1B1F' : '#FFFBFE',
              borderColor: colors[idx],
              borderWidth: 2
            },
            areaStyle: {
              color: areaGradient(colors[idx], dark)
            },
            emphasis: { focus: 'series', blurScope: 'coordinateSystem' },
            blur: { lineStyle: { opacity: 0.2 }, itemStyle: { opacity: 0.2 }, areaStyle: { opacity: 0.14 } },
            animationDelay: function() { return idx * 160; },
            z: 5 + idx
          };
        }).concat(seriesData.map(function(series) {
          const idx = series.paletteIndex;
          return {
            type: 'scatter',
            id: 'step-area-markers-' + idx,
            name: series.name + ' markers',
            data: months.map(function(month, dataIdx) { return [month, series.values[dataIdx]]; }),
            symbol: 'circle',
            symbolSize: compact ? 6 : (medium ? 7 : 8),
            itemStyle: {
              color: dark ? '#1C1B1F' : '#FFFBFE',
              borderColor: colors[idx],
              borderWidth: 2
            },
            emphasis: { focus: 'series', blurScope: 'coordinateSystem', scale: 1.1 },
            blur: { itemStyle: { opacity: 0.2 } },
            tooltip: { show: false },
            animationDelay: function(dataIdx) { return idx * 160 + dataIdx * 36; },
            z: 20 + idx
          };
        }))
      };
    });
  }

  function makeLineChart(container) {
    const quarters = ["Q1 '22", "Q2 '22", "Q3 '22", "Q4 '22", "Q1 '23", "Q2 '23", "Q3 '23", "Q4 '23"];
    const seriesData = [
      { name: 'Cyan', values: [32, 38, 41, 35, 31, 44, 58, 72] },
      { name: 'Violet', values: [28, 31, 35, 40, 44, 49, 55, 62] },
      { name: 'Emerald', values: [18, 22, 25, 29, 36, 42, 31, 35] },
      { name: 'Amber', values: [12, 15, 18, 24, 34, 20, 16, 22] },
      { name: 'Slate', values: [10, 13, 11, 15, 13, 28, 40, 19] }
    ];

    function tooltip(state, params) {
      const dark = state.dark;
      const maxRows = state.compact ? 3 : (state.medium ? 4 : 6);
      const lines = truncateTooltipRows(params.filter(function(param) { return param.seriesName.indexOf('markers') === -1 && param.seriesName.indexOf(' hit') === -1; }).map(function(param) {
        return '<div style="display:flex;align-items:center;justify-content:space-between;gap:14px;margin-top:6px;">' +
          '<div style="display:flex;align-items:center;gap:8px;color:' + (dark ? '#CAC4D0' : '#49454F') + ';font-size:10px;"><span style="width:8px;height:8px;border-radius:999px;background:' + param.color + ';display:inline-block;"></span><span>' + param.seriesName + '</span></div>' +
          '<div style="color:' + (dark ? '#E6E0E9' : '#1C1B1F') + ';font-size:11px;font-weight:600;">$' + param.value + 'M</div></div>';
      }), maxRows, dark).join('');
      return tooltipCard(dark,
        '<div style="color:' + (dark ? '#E6E0E9' : '#1C1B1F') + ';font-size:13px;font-weight:600;">' + params[0].axisValue + '</div>' +
        '<div style="margin-top:4px;color:' + (dark ? '#938F99' : '#79747E') + ';font-size:10px;">Performance trend</div>' + lines,
        '138px'
      );
    }

    function areaGradient(color, dark) {
      return new echarts.graphic.LinearGradient(0, 0, 0, 1, [
        { offset: 0, color: echarts.color.modifyAlpha(color, dark ? 0.28 : 0.22) },
        { offset: 1, color: echarts.color.modifyAlpha(color, 0.02) }
      ]);
    }

    function legendGraphic(chart, dark, colors) {
      const metrics = legendPanelMetrics(chart, seriesData.length, 36, 42);
      if (metrics.compact) return [];
      const panelWidth = metrics.panelWidth;
      const panelX = metrics.panelX;
      const panelY = metrics.panelY;
      const rowStartY = metrics.medium ? 30 : metrics.rowStartY;
      const rowHeight = metrics.medium ? 15 : 18;
      const panelHeight = Math.min(metrics.panelHeight, rowStartY + seriesData.length * rowHeight + 12);
      const markerSize = metrics.medium ? 8 : 14;
      const markerRadius = metrics.medium ? 2 : 3;
      const titleFont = metrics.medium ? '500 8px Roboto, Helvetica Neue, Arial, sans-serif' : '500 10px Roboto, Helvetica Neue, Arial, sans-serif';
      const labelFont = metrics.medium ? '400 7px Roboto, Helvetica Neue, Arial, sans-serif' : '400 11px Roboto, Helvetica Neue, Arial, sans-serif';
      const children = [{
        type: 'rect', shape: { x: 0, y: 0, width: panelWidth, height: panelHeight, r: 14 }, style: { fill: dark ? '#2A2630' : '#F3EDF7', stroke: dark ? '#938F99' : '#79747E', lineWidth: 1, opacity: dark ? 0.95 : 1 }
      }, {
        type: 'text', style: { x: metrics.medium ? 10 : 18, y: metrics.medium ? 13 : 18, text: 'SERIES', fill: dark ? '#938F99' : '#79747E', font: titleFont }
      }];
      seriesData.forEach(function(series, idx) {
        const y = rowStartY + idx * rowHeight;
        children.push({ type: 'rect', shape: { x: metrics.medium ? 10 : 18, y: y - Math.round(markerSize / 2), width: markerSize, height: markerSize, r: markerRadius }, style: { fill: colors[idx] } });
        children.push({ type: 'text', style: { x: metrics.medium ? 22 : 40, y: y, text: series.name, textVerticalAlign: 'middle', fill: dark ? '#E6E0E9' : '#1C1B1F', font: labelFont } });
      });
      return [{ type: 'group', left: panelX, top: panelY, bounding: 'all', children: children }];
    }

    function bindHoverSync(chart) {
      function applyActiveSeries(seriesName) {
        chart.setOption({
          series: seriesData.map(function(series) {
            const active = !seriesName || series.name === seriesName;
            return {
              id: 'line-' + series.name,
              lineStyle: { opacity: active ? 1 : 0.2 },
              itemStyle: { opacity: active ? 1 : 0.2 },
              areaStyle: { opacity: active ? 1 : 0.14 }
            };
          }).concat(seriesData.map(function(series) {
            const active = !seriesName || series.name === seriesName;
            return {
              id: 'marker-' + series.name,
              itemStyle: { opacity: active ? 1 : 0.2 }
            };
          }))
        }, false);
      }

      chart.off('mouseover');
      chart.off('mouseout');
      chart.off('globalout');
      chart.on('mouseover', function(params) {
        if (params.componentType !== 'series' || typeof params.seriesId !== 'string') return;
        let seriesName = null;
        if (params.seriesId.indexOf('marker-') === 0) seriesName = params.seriesId.slice('marker-'.length);
        if (params.seriesId.indexOf('hit-') === 0) seriesName = params.seriesId.slice('hit-'.length);
        if (!seriesName) return;
        applyActiveSeries(seriesName);
      });
      chart.on('mouseout', function(params) {
        if (params.componentType !== 'series') return;
        applyActiveSeries(null);
      });
      chart.on('globalout', function() { applyActiveSeries(null); });
    }

    return createManagedChart(container, function(chart, state, containerEl) {
      const dark = state.dark;
      const compact = isCompactChart(chart);
      const medium = isMediumChart(chart);
      state.compact = compact;
      state.medium = medium;
      const darkPalette = ['#22D3EE', '#A78BFA', '#10B981', '#FBB724', '#94A3B8'];
      const lightPalette = [state.colors[0], state.colors[4], state.colors[1], state.colors[2], state.colors[7]];
      const colors = dark ? darkPalette : lightPalette;
      setLegendOverlayConfig(containerEl, {
        dark: dark,
        layout: legendOverlayLayout(chart),
        items: seriesData.map(function(series, idx) { return { name: series.name, color: colors[idx] }; })
      });
      const gridLeft = compact ? 26 : (medium ? 30 : 48);
      const gridRight = legendGridRight(chart);
      const plotWidth = Math.max(180, chart.getWidth() - gridLeft - gridRight);
      return {
        animationDuration: 800, animationDurationUpdate: 250, animationEasing: 'cubicOut', color: colors, backgroundColor: 'transparent',
        grid: { left: gridLeft, right: gridRight, top: compact ? 16 : (medium ? 18 : 24), bottom: compact ? 28 : 34 },
        tooltip: {
          trigger: 'axis', confine: true, axisPointer: { type: 'line', lineStyle: { color: dark ? '#938F99' : '#c0b8a8', width: 1, type: 'dashed', dashOffset: 0 } },
          backgroundColor: 'transparent', borderWidth: 0, padding: 0, extraCssText: 'box-shadow:none;background:transparent;',
          formatter: function(params) { return tooltip(state, params); }, order: 'seriesAsc',
          position: function(pos, params, dom, rect, size) { return smartTooltipPosition(pos, rect || { x: pos[0], y: pos[1], width: 0, height: 0 }, size, dom, dark, true, 24); }
        },
        graphic: [{
          type: 'line', left: gridLeft + plotWidth / 2, top: compact ? 18 : (medium ? 18 : 24), shape: { x1: 0, y1: 0, x2: 0, y2: chart.getHeight() - (compact ? 46 : 58) }, style: { stroke: dark ? '#938F99' : '#c0b8a8', lineWidth: 1, opacity: 0.6, lineDash: [5, 4] }
        }, {
          type: 'text', left: gridLeft + plotWidth / 4 - 12, top: compact ? 0 : 2, style: { text: '2022', fill: dark ? '#938F99' : '#79747E', font: '400 ' + (compact ? 9 : 10) + 'px Roboto, Helvetica Neue, Arial, sans-serif' }
        }, {
          type: 'text', left: gridLeft + plotWidth * 0.75 - 12, top: compact ? 0 : 2, style: { text: '2023', fill: dark ? '#938F99' : '#79747E', font: '400 ' + (compact ? 9 : 10) + 'px Roboto, Helvetica Neue, Arial, sans-serif' }
        }],
        xAxis: { type: 'category', boundaryGap: false, data: quarters, axisLine: { lineStyle: { color: dark ? '#938F99' : '#79747E', width: 1.5 } }, axisTick: { show: false }, axisLabel: { color: dark ? '#938F99' : '#79747E', fontSize: compact ? 8 : (medium ? 9 : 10), margin: compact ? 8 : 12 } },
        yAxis: { type: 'value', min: 0, max: 100, interval: compact ? 50 : 25, axisLine: { show: true, lineStyle: { color: dark ? '#938F99' : '#79747E', width: 1.5 } }, axisTick: { show: false }, axisLabel: { color: dark ? '#938F99' : '#79747E', fontSize: compact ? 8 : (medium ? 9 : 10), formatter: function(v) { return '$' + v + 'M'; } }, splitLine: { lineStyle: { color: dark ? '#49454F' : '#E7E0EC' } } },
        series: seriesData.map(function(series, idx) {
          const color = colors[idx];
          return { type: 'line', id: 'line-' + series.name, name: series.name, smooth: false, symbol: 'none', data: series.values, showSymbol: false, silent: true, lineStyle: { width: compact ? (series.name === 'Slate' ? 1.3 : 1.6) : (medium ? (series.name === 'Slate' ? 1.6 : 2) : (series.name === 'Slate' ? 2 : 2.5)), color: color, type: series.name === 'Slate' ? 'dashed' : 'solid' }, itemStyle: { color: color, borderColor: dark ? '#151825' : '#f8f5fb', borderWidth: 0 }, emphasis: { focus: 'series', blurScope: 'coordinateSystem' }, blur: { lineStyle: { opacity: 0.2 }, itemStyle: { opacity: 0.2 } }, areaStyle: { color: areaGradient(color, dark) }, animationDelay: function() { return idx * 180; }, z: 5 + (seriesData.length - idx) };
        }).concat(seriesData.map(function(series, idx) {
          return { type: 'line', id: 'hit-' + series.name, name: series.name + ' hit', data: series.values, symbol: 'none', showSymbol: false, tooltip: { show: false }, lineStyle: { width: 16, color: 'rgba(0,0,0,0)', opacity: 0 }, itemStyle: { opacity: 0 }, emphasis: { disabled: true }, silent: false, z: 200 + idx, zlevel: 2 };
        })).concat(seriesData.map(function(series, idx) {
          const color = colors[idx];
          return { type: 'scatter', id: 'marker-' + series.name, name: series.name + ' markers', data: quarters.map(function(quarter, dataIdx) { return [quarter, series.values[dataIdx]]; }), symbol: 'circle', symbolSize: compact ? 6 : (medium ? 8 : 10), itemStyle: { color: color, borderColor: dark ? '#151825' : '#f8f5fb', borderWidth: 0 }, emphasis: { scale: 1.18, itemStyle: { color: color } }, blur: { itemStyle: { opacity: 0.2 } }, tooltip: { show: false }, z: 300 + idx, zlevel: 3 };
        }))
      };
    }, bindHoverSync);
  }

  function makeAreaChart(container) {
    const quarters = ["Q1 '22", "Q2 '22", "Q3 '22", "Q4 '22", "Q1 '23", "Q2 '23", "Q3 '23", "Q4 '23"];
    const seriesData = [
      { name: 'Cyan', values: ['-', '-', '-', 55, 80, 70, 50, 65] },
      { name: 'Violet', values: [20, 45, 70, 55, 35, 75, 85, 72] },
      { name: 'Emerald', values: ['-', 30, 55, 80, 60, 40, '-', '-'] },
      { name: 'Amber', values: [15, 50, 18, 25, 55, 30, 45, 60] },
      { name: 'Slate', values: [55, 25, 23, 26, 24, 27, 22, 25] }
    ];
    const totals = quarters.map(function(_, idx) {
      return seriesData.reduce(function(sum, series) {
        const value = series.values[idx];
        return sum + (typeof value === 'number' ? value : 0);
      }, 0);
    });

    function tooltip(state, params) {
      const dark = state.dark;
      const maxRows = state.compact ? 3 : (state.medium ? 4 : 6);
      const rows = truncateTooltipRows(params.filter(function(param) {
        return param.seriesName.indexOf('markers') === -1 && param.seriesName.indexOf(' hit') === -1;
      }).map(function(param) {
        return '<div style="display:flex;align-items:center;justify-content:space-between;gap:12px;margin-top:6px;">' +
          '<div style="display:flex;align-items:center;gap:8px;color:' + (dark ? '#CAC4D0' : '#49454F') + ';font-size:10px;"><span style="width:8px;height:8px;border-radius:999px;background:' + param.color + ';display:inline-block;"></span><span>' + param.seriesName + '</span></div>' +
          '<div style="color:' + (dark ? '#E6E0E9' : '#1C1B1F') + ';font-size:11px;font-weight:600;">$' + (param.value == null || param.value === '-' ? 0 : param.value) + 'M</div></div>';
      }), maxRows, dark).join('');
      const total = totals[params[0].dataIndex];
      return tooltipCard(dark,
        '<div style="color:' + (dark ? '#E6E0E9' : '#1C1B1F') + ';font-size:13px;font-weight:600;">' + params[0].axisValue + '</div>' +
        '<div style="margin-top:4px;color:' + (dark ? '#938F99' : '#79747E') + ';font-size:10px;">Flat area reference</div>' +
        rows +
        '<div style="margin-top:8px;border-top:1px solid ' + (dark ? '#49454F' : '#E7E0EC') + ';"></div>' +
        '<div style="display:flex;align-items:center;justify-content:space-between;gap:12px;margin-top:8px;"><div style="color:' + (dark ? '#CAC4D0' : '#49454F') + ';font-size:10px;">Total</div><div style="color:' + (dark ? '#E6E0E9' : '#1C1B1F') + ';font-size:11px;font-weight:600;">$' + total + 'M</div></div>',
        '156px'
      );
    }

    function areaGradient(color, dark) {
      return new echarts.graphic.LinearGradient(0, 0, 0, 1, [
        { offset: 0, color: echarts.color.modifyAlpha(color, dark ? 0.24 : 0.20) },
        { offset: 1, color: echarts.color.modifyAlpha(color, 0.02) }
      ]);
    }

    function bindHoverSync(chart) {
      function applyActiveSeries(seriesName) {
        chart.setOption({
          series: seriesData.map(function(series) {
            const active = !seriesName || series.name === seriesName;
            return {
              id: 'line-' + series.name,
              lineStyle: { opacity: active ? 1 : 0.2 },
              itemStyle: { opacity: active ? 1 : 0.2 },
              areaStyle: { opacity: active ? 1 : 0.2 }
            };
          }).concat(seriesData.map(function(series) {
            const active = !seriesName || series.name === seriesName;
            return {
              id: 'marker-' + series.name,
              itemStyle: { opacity: active ? 0 : 0 }
            };
          }))
        }, false);
      }

      chart.off('mouseover');
      chart.off('mouseout');
      chart.off('globalout');
      chart.on('mouseover', function(params) {
        if (params.componentType !== 'series' || typeof params.seriesId !== 'string') return;
        let seriesName = null;
        if (params.seriesId.indexOf('marker-') === 0) seriesName = params.seriesId.slice('marker-'.length);
        if (params.seriesId.indexOf('hit-') === 0) seriesName = params.seriesId.slice('hit-'.length);
        if (!seriesName) return;
        applyActiveSeries(seriesName);
      });
      chart.on('mouseout', function(params) {
        if (params.componentType !== 'series') return;
        applyActiveSeries(null);
      });
      chart.on('globalout', function() { applyActiveSeries(null); });
    }

    return createManagedChart(container, function(chart, state, containerEl) {
      const dark = state.dark;
      const compact = isCompactChart(chart);
      const medium = isMediumChart(chart);
      state.compact = compact;
      state.medium = medium;
      const darkPalette = ['#22D3EE', '#A78BFA', '#10B981', '#FBB724', '#94A3B8'];
      const lightPalette = [state.colors[0], state.colors[4], state.colors[1], state.colors[2], state.colors[7]];
      const colors = dark ? darkPalette : lightPalette;
      setLegendOverlayConfig(containerEl, {
        dark: dark,
        layout: legendOverlayLayout(chart),
        items: seriesData.map(function(series, idx) { return { name: series.name, color: colors[idx] }; })
      });
      const gridLeft = compact ? 26 : (medium ? 30 : 48);
      const gridRight = legendGridRight(chart);
      const plotWidth = Math.max(180, chart.getWidth() - gridLeft - gridRight);
      return {
        animationDuration: 900,
        animationDurationUpdate: 250,
        animationEasing: 'cubicOut',
        color: colors,
        backgroundColor: 'transparent',
        grid: { left: gridLeft, right: gridRight, top: compact ? 16 : (medium ? 18 : 24), bottom: compact ? 28 : 34 },
        tooltip: {
          trigger: 'axis',
          confine: true,
          axisPointer: { type: 'line', lineStyle: { color: dark ? '#938F99' : '#c0b8a8', width: 1, type: 'dashed' } },
          backgroundColor: 'transparent',
          borderWidth: 0,
          padding: 0,
          extraCssText: 'box-shadow:none;background:transparent;',
          formatter: function(params) { return tooltip(state, params); },
          order: 'seriesAsc',
          position: function(pos, params, dom, rect, size) { return smartTooltipPosition(pos, rect || { x: pos[0], y: pos[1], width: 0, height: 0 }, size, dom, dark, true, 24); }
        },
        graphic: [{
          type: 'line', left: gridLeft + plotWidth / 2, top: compact ? 18 : (medium ? 18 : 24),
          shape: { x1: 0, y1: 0, x2: 0, y2: chart.getHeight() - (compact ? 46 : 58) },
          style: { stroke: dark ? '#938F99' : '#c0b8a8', lineWidth: 1, opacity: 0.6, lineDash: [5, 4] }
        }, {
          type: 'text', left: gridLeft + plotWidth / 4 - 12, top: compact ? 0 : 2,
          style: { text: '2022', fill: dark ? '#938F99' : '#79747E', font: '400 ' + (compact ? 9 : 10) + 'px Roboto, Helvetica Neue, Arial, sans-serif' }
        }, {
          type: 'text', left: gridLeft + plotWidth * 0.75 - 12, top: compact ? 0 : 2,
          style: { text: '2023', fill: dark ? '#938F99' : '#79747E', font: '400 ' + (compact ? 9 : 10) + 'px Roboto, Helvetica Neue, Arial, sans-serif' }
        }],
        xAxis: { type: 'category', boundaryGap: false, data: quarters, axisLine: { lineStyle: { color: dark ? '#938F99' : '#79747E', width: 1.5 } }, axisTick: { show: false }, axisLabel: { color: dark ? '#938F99' : '#79747E', fontSize: compact ? 8 : (medium ? 9 : 10), margin: compact ? 8 : 12 } },
        yAxis: { type: 'value', min: 0, max: 100, interval: compact ? 50 : 25, axisLine: { show: true, lineStyle: { color: dark ? '#938F99' : '#79747E', width: 1.5 } }, axisTick: { show: false }, axisLabel: { color: dark ? '#938F99' : '#79747E', fontSize: compact ? 8 : (medium ? 9 : 10), formatter: function(v) { return '$' + v + 'M'; } }, splitLine: { lineStyle: { color: dark ? '#49454F' : '#E7E0EC' } } },
        series: seriesData.map(function(series, idx) {
          const color = colors[idx];
          return {
            type: 'line',
            id: 'line-' + series.name,
            name: series.name,
            smooth: true,
            connectNulls: false,
            symbol: 'none',
            data: series.values,
            showSymbol: false,
            lineStyle: { width: compact ? (series.name === 'Slate' ? 1.3 : 1.8) : (medium ? (series.name === 'Slate' ? 1.6 : 2) : 2), color: color, type: series.name === 'Slate' ? 'dashed' : 'solid' },
            itemStyle: { color: color, borderWidth: 0 },
            emphasis: { focus: 'series', blurScope: 'coordinateSystem' },
            blur: { lineStyle: { opacity: 0.2 }, itemStyle: { opacity: 0.2 }, areaStyle: { opacity: 0.12 } },
            areaStyle: { color: areaGradient(color, dark), opacity: compact ? 0.16 : 0.20 },
            animationDelay: function() { return idx * 180; },
            z: 5 + (seriesData.length - idx)
          };
        }).concat(seriesData.map(function(series, idx) {
          return {
            type: 'line',
            id: 'hit-' + series.name,
            name: series.name + ' hit',
            data: series.values,
            connectNulls: false,
            symbol: 'none',
            showSymbol: false,
            tooltip: { show: false },
            lineStyle: { width: 16, color: 'rgba(0,0,0,0)', opacity: 0 },
            itemStyle: { opacity: 0 },
            emphasis: { disabled: true },
            silent: false,
            z: 200 + idx,
            zlevel: 2
          };
        })).concat(seriesData.map(function(series, idx) {
          const color = colors[idx];
          return {
            type: 'scatter',
            id: 'marker-' + series.name,
            name: series.name + ' markers',
            data: quarters.map(function(quarter, dataIdx) {
              const value = series.values[dataIdx];
              return value === '-' ? null : [quarter, value];
            }).filter(Boolean),
            symbol: 'circle',
            symbolSize: compact ? 6 : (medium ? 8 : 10),
            itemStyle: { color: color, opacity: 0, borderWidth: 0 },
            emphasis: { scale: 1.18, itemStyle: { color: color, opacity: 0 } },
            blur: { itemStyle: { opacity: 0 } },
            tooltip: { show: false },
            z: 300 + idx,
            zlevel: 3,
            silent: false
          };
        }))
      };
    }, bindHoverSync);
  }

  function makePieChart(container) {
    const data = [
      { value: 220, name: 'Royal Blue' }, { value: 180, name: 'Emerald' }, { value: 150, name: 'Amber' },
      { value: 130, name: 'Rose' }, { value: 100, name: 'Violet' }, { value: 90, name: 'Blue' },
      { value: 70, name: 'Teal' }, { value: 60, name: 'Slate' }, { value: 200, name: 'Other' }
    ];
    const total = data.reduce(function(sum, item) { return sum + item.value; }, 0);
    function tooltip(state, param) {
      const dark = state.dark;
      return tooltipCard(dark,
        '<div style="color:' + (dark ? '#E6E0E9' : '#1C1B1F') + ';font-size:13px;font-weight:600;">' + param.name + '</div>' +
        '<div style="margin-top:4px;color:' + (dark ? '#CAC4D0' : '#49454F') + ';font-size:10px;">Share of total</div>' +
        '<div style="margin-top:6px;color:' + (dark ? '#E6E0E9' : '#1C1B1F') + ';font-size:11px;font-weight:600;">$' + param.value + 'M</div>' +
        '<div style="margin-top:4px;color:' + (dark ? '#938F99' : '#79747E') + ';font-size:10px;">' + param.percent + '%</div>',
        '120px'
      );
    }
    return createManagedChart(container, function(chart, state, containerEl) {
      const dark = state.dark;
      const compact = isCompactChart(chart);
      const medium = isMediumChart(chart);
      const darkPalette = ['#22D3EE', '#10B981', '#FBB724', '#FB6181', '#A78BFA', '#60A5FA', '#2DD4BF', '#94A3B8'];
      const colors = dark ? darkPalette : state.colors;
      setLegendOverlayConfig(containerEl, {
        dark: dark,
        layout: legendOverlayLayout(chart),
        items: data.map(function(item, idx) {
          return { name: item.name, color: [colors[0], colors[1], colors[2], colors[3], colors[4], colors[5], colors[6], colors[7], '#AAB7C8'][idx] };
        })
      });
      const pieCenterX = compact ? '31%' : (medium ? '33%' : '36%');
      const pieCenterY = compact ? '54%' : (medium ? '54%' : '54%');
      const pieRadius = compact ? ['34%', '74%'] : (medium ? ['36%', '78%'] : ['34%', '76%']);
      return {
        animationDuration: 800, animationDurationUpdate: 250, animationEasing: 'cubicOut', animationDelay: function(idx) { return idx * 80; },
        color: [colors[0], colors[1], colors[2], colors[3], colors[4], colors[5], colors[6], colors[7], '#AAB7C8'], backgroundColor: 'transparent',
        tooltip: { trigger: 'item', confine: true, backgroundColor: 'transparent', borderWidth: 0, padding: 0, extraCssText: 'box-shadow:none;background:transparent;', formatter: function(param) { return tooltip(state, param); }, position: function(pos, params, dom, rect, size) { return smartTooltipPosition(pos, rect, size, dom, dark, true, 20); } },
        graphic: [{ type: 'group', left: pieCenterX, top: pieCenterY, bounding: 'raw', children: [{ type: 'text', style: { x: 0, y: -10, text: 'Total', textAlign: 'center', textVerticalAlign: 'middle', fill: dark ? '#938F99' : '#79747E', font: '400 ' + (compact ? 9 : 10) + 'px Roboto, Helvetica Neue, Arial, sans-serif' }, z: 10 }, { type: 'text', style: { x: 0, y: 8, text: '$' + (total / 1000).toFixed(1).replace('.0', '') + 'B', textAlign: 'center', textVerticalAlign: 'middle', fill: dark ? '#E6E0E9' : '#1C1B1F', font: '600 ' + (compact ? 12 : 14) + 'px Roboto, Helvetica Neue, Arial, sans-serif' }, z: 10 }] }],
        series: [{ type: 'pie', radius: pieRadius, center: [pieCenterX, pieCenterY], startAngle: 120, avoidLabelOverlap: true, padAngle: 0, itemStyle: { borderRadius: 0, borderColor: 'transparent', borderWidth: 0 }, emphasis: { focus: 'self', scale: true, scaleSize: 6, itemStyle: { shadowBlur: 20, shadowColor: dark ? 'rgba(0,0,0,0.35)' : 'rgba(28,27,31,0.18)' } }, blur: { itemStyle: { opacity: 0.2 } }, label: { show: false }, labelLine: { show: false }, data: data }]
      };
    });
  }

  function makeRadarChart(container) {
    const seriesData = [
      { name: 'Cyan', values: [72, 65, 58, 80, 74, 55, 68] },
      { name: 'Violet', values: [55, 82, 70, 63, 58, 88, 72] },
      { name: 'Emerald', values: [64, 50, 85, 71, 82, 62, 90] }
    ];
    function tooltip(state, param) {
      const dark = state.dark;
      return tooltipCard(dark,
        '<div style="color:' + (dark ? '#E6E0E9' : '#1C1B1F') + ';font-size:13px;font-weight:600;">' + param.name + '</div>' +
        '<div style="margin-top:6px;color:' + (dark ? '#CAC4D0' : '#49454F') + ';font-size:10px;">' + param.value.join(' · ') + '</div>',
        '120px'
      );
    }
    return createManagedChart(container, function(chart, state, containerEl) {
      const dark = state.dark;
      const compact = isCompactChart(chart);
      const medium = isMediumChart(chart);
      const darkPalette = ['#22D3EE', '#10B981', '#FBB724', '#FB6181', '#A78BFA', '#60A5FA', '#2DD4BF', '#94A3B8'];
      const colors = dark ? [darkPalette[0], darkPalette[4], darkPalette[1]] : [state.colors[0], state.colors[4], state.colors[1]];
      setLegendOverlayConfig(containerEl, {
        dark: dark,
        layout: legendOverlayLayout(chart),
        items: seriesData.map(function(series, idx) { return { name: series.name, color: colors[idx] }; })
      });
      return {
        animationDuration: 800, animationDurationUpdate: 250, animationEasing: 'cubicOut', color: colors, backgroundColor: 'transparent',
        tooltip: { trigger: 'item', confine: true, backgroundColor: 'transparent', borderWidth: 0, padding: 0, extraCssText: 'box-shadow:none;background:transparent;', formatter: function(param) { return tooltip(state, param); }, position: function(pos, params, dom, rect, size) { return smartTooltipPosition(pos, rect, size, dom, dark, true, 20); } },
        radar: { center: [compact ? '38%' : '41%', '53%'], radius: compact ? '70%' : (medium ? '66%' : '62%'), splitNumber: 5, indicator: [{ name: 'Revenue', max: 100 }, { name: 'Growth', max: 100 }, { name: 'Margin', max: 100 }, { name: 'Satisfaction', max: 100 }, { name: 'Retention', max: 100 }, { name: 'Innovation', max: 100 }, { name: 'Quality', max: 100 }], axisName: { color: dark ? '#938F99' : '#79747E', fontSize: compact ? 9 : 11 }, axisLine: { lineStyle: { color: dark ? 'rgba(147,143,153,0.25)' : 'rgba(121,116,126,0.25)' } }, splitLine: { lineStyle: { color: dark ? '#49454F' : '#E7E0EC' } }, splitArea: { areaStyle: { color: ['transparent'] } } },
        series: [{ type: 'radar', symbol: 'circle', symbolSize: compact ? 4 : (medium ? 5 : 7), lineStyle: { width: compact ? 1.5 : (medium ? 1.8 : 2.5) }, areaStyle: { opacity: compact ? 0.14 : 0.18 }, animationDuration: 1100, animationEasing: 'cubicOut', animationDelay: function(idx) { return idx * 180; }, emphasis: { focus: 'self', blurScope: 'coordinateSystem' }, blur: { lineStyle: { opacity: 0.2 }, itemStyle: { opacity: 0.2 }, areaStyle: { opacity: 0.12 } }, data: [{ value: seriesData[0].values, name: seriesData[0].name, itemStyle: { color: colors[0] }, lineStyle: { color: colors[0] }, areaStyle: { color: colors[0], opacity: compact ? 0.14 : 0.18 } }, { value: seriesData[1].values, name: seriesData[1].name, itemStyle: { color: colors[1] }, lineStyle: { color: colors[1] }, areaStyle: { color: colors[1], opacity: compact ? 0.14 : 0.18 } }, { value: seriesData[2].values, name: seriesData[2].name, itemStyle: { color: colors[2] }, lineStyle: { color: colors[2] }, areaStyle: { color: colors[2], opacity: compact ? 0.14 : 0.18 } }] }]
      };
    });
  }

  function makeStackedLineChart(container) {
    const quarters = ["Q1 '22", "Q2 '22", "Q3 '22", "Q4 '22", "Q1 '23", "Q2 '23", "Q3 '23", "Q4 '23"];
    const seriesData = [
      { name: 'Cyan', values: [38, 42, 46, 50, 55, 60, 66, 72] },
      { name: 'Violet', values: [32, 35, 38, 41, 45, 50, 56, 62] },
      { name: 'Emerald', values: [18, 20, 21, 23, 25, 27, 31, 35] },
      { name: 'Amber', values: [11, 12, 13, 14, 15, 17, 19, 22] },
      { name: 'Slate', values: [10, 11, 12, 13, 14, 16, 17, 19] }
    ];
    const totals = quarters.map(function(_, idx) { return seriesData.reduce(function(sum, series) { return sum + series.values[idx]; }, 0); });
    function tooltip(state, params) {
      const dark = state.dark;
      const maxRows = state.compact ? 3 : (state.medium ? 4 : 8);
      const rows = truncateTooltipRows(params.slice().reverse().map(function(param) {
        return '<div style="display:flex;align-items:center;justify-content:space-between;gap:12px;margin-top:6px;">' +
          '<div style="display:flex;align-items:center;gap:8px;color:' + (dark ? '#CAC4D0' : '#49454F') + ';font-size:10px;"><span style="width:8px;height:8px;border-radius:999px;background:' + param.color + ';display:inline-block;"></span><span>' + param.seriesName + '</span></div>' +
          '<div style="color:' + (dark ? '#E6E0E9' : '#1C1B1F') + ';font-size:11px;font-weight:600;">$' + param.value + 'M</div></div>';
      }), maxRows, dark).join('');
      const total = totals[params[0].dataIndex];
      return tooltipCard(dark,
        '<div style="color:' + (dark ? '#E6E0E9' : '#1C1B1F') + ';font-size:13px;font-weight:600;">' + params[0].axisValue + '</div>' +
        '<div style="margin-top:6px;border-top:1px solid ' + (dark ? '#49454F' : '#E7E0EC') + ';"></div>' + rows +
        '<div style="margin-top:8px;border-top:1px solid ' + (dark ? '#49454F' : '#E7E0EC') + ';"></div>' +
        '<div style="display:flex;align-items:center;justify-content:space-between;gap:12px;margin-top:8px;"><div style="color:' + (dark ? '#CAC4D0' : '#49454F') + ';font-size:10px;">Total</div><div style="color:' + (dark ? '#E6E0E9' : '#1C1B1F') + ';font-size:11px;font-weight:600;">$' + total + 'M</div></div>',
        '158px'
      );
    }
    function legendGraphic(chart, dark, colors) {
      const metrics = legendPanelMetrics(chart, seriesData.length, 36, 42);
      if (metrics.compact) return [];
      const panelWidth = metrics.panelWidth;
      const panelX = metrics.panelX;
      const panelY = metrics.panelY;
      const rowStartY = metrics.medium ? 30 : metrics.rowStartY;
      const rowHeight = metrics.medium ? 15 : 18;
      const panelHeight = Math.min(metrics.panelHeight, rowStartY + seriesData.length * rowHeight + 12);
      const markerSize = metrics.medium ? 8 : 14;
      const markerRadius = metrics.medium ? 2 : 3;
      const titleFont = metrics.medium ? '500 8px Roboto, Helvetica Neue, Arial, sans-serif' : '500 10px Roboto, Helvetica Neue, Arial, sans-serif';
      const labelFont = metrics.medium ? '400 7px Roboto, Helvetica Neue, Arial, sans-serif' : '400 11px Roboto, Helvetica Neue, Arial, sans-serif';
      const group = { type: 'group', left: panelX, top: panelY, bounding: 'all', children: [{ type: 'rect', shape: { x: 0, y: 0, width: panelWidth, height: panelHeight, r: 14 }, style: { fill: dark ? '#2A2630' : '#F3EDF7', stroke: dark ? '#938F99' : '#79747E', lineWidth: 1, opacity: dark ? 0.95 : 1 } }, { type: 'text', style: { x: metrics.medium ? 10 : 18, y: metrics.medium ? 13 : 18, text: 'SERIES', fill: dark ? '#938F99' : '#79747E', font: titleFont } }] };
      seriesData.forEach(function(series, idx) {
        const y = rowStartY + idx * rowHeight;
        group.children.push({ type: 'rect', shape: { x: metrics.medium ? 10 : 18, y: y - Math.round(markerSize / 2), width: markerSize, height: markerSize, r: markerRadius }, style: { fill: colors[idx] } });
        group.children.push({ type: 'text', style: { x: metrics.medium ? 22 : 40, y: y, text: series.name, textVerticalAlign: 'middle', fill: dark ? '#E6E0E9' : '#1C1B1F', font: labelFont } });
      });
      return [group];
    }
    return createManagedChart(container, function(chart, state, containerEl) {
      const dark = state.dark;
      const compact = isCompactChart(chart);
      const medium = isMediumChart(chart);
      state.compact = compact;
      state.medium = medium;
      const darkPalette = ['#22D3EE', '#A78BFA', '#10B981', '#FBB724', '#94A3B8'];
      const lightPalette = [state.colors[0], state.colors[4], state.colors[1], state.colors[2], state.colors[7]];
      const colors = dark ? darkPalette : lightPalette;
      setLegendOverlayConfig(containerEl, {
        dark: dark,
        layout: legendOverlayLayout(chart),
        items: seriesData.map(function(series, idx) { return { name: series.name, color: colors[idx] }; })
      });
      const gridLeft = compact ? 26 : (medium ? 30 : 48);
      const gridRight = legendGridRight(chart);
      const plotWidth = Math.max(180, chart.getWidth() - gridLeft - gridRight);
      return {
        animationDuration: 500, animationDurationUpdate: 250, animationEasing: 'cubicOut', color: colors, backgroundColor: 'transparent',
        grid: { left: gridLeft, right: gridRight, top: compact ? 16 : (medium ? 18 : 24), bottom: compact ? 28 : 34 },
        tooltip: { trigger: 'axis', confine: true, axisPointer: { type: 'line', lineStyle: { color: dark ? '#938F99' : '#c0b8a8', width: 1, type: 'dashed' } }, backgroundColor: 'transparent', borderWidth: 0, padding: 0, extraCssText: 'box-shadow:none;background:transparent;', formatter: function(params) { return tooltip(state, params); }, order: 'seriesAsc', position: function(pos, params, dom, rect, size) { return smartTooltipPosition(pos, rect || { x: pos[0], y: pos[1], width: 0, height: 0 }, size, dom, dark, true, 24); } },
        graphic: [{ type: 'line', left: gridLeft + plotWidth / 2, top: compact ? 18 : (medium ? 18 : 24), shape: { x1: 0, y1: 0, x2: 0, y2: chart.getHeight() - (compact ? 46 : 58) }, style: { stroke: dark ? '#938F99' : '#c0b8a8', lineWidth: 1, opacity: 0.6, lineDash: [5, 4] } }, { type: 'text', left: gridLeft + plotWidth / 4 - 12, top: compact ? 0 : 2, style: { text: '2022', fill: dark ? '#938F99' : '#79747E', font: '400 ' + (compact ? 9 : 10) + 'px Roboto, Helvetica Neue, Arial, sans-serif' } }, { type: 'text', left: gridLeft + plotWidth * 0.75 - 12, top: compact ? 0 : 2, style: { text: '2023', fill: dark ? '#938F99' : '#79747E', font: '400 ' + (compact ? 9 : 10) + 'px Roboto, Helvetica Neue, Arial, sans-serif' } }],
        xAxis: { type: 'category', boundaryGap: false, data: quarters, axisLine: { lineStyle: { color: dark ? '#938F99' : '#79747E', width: 1.5 } }, axisTick: { show: false }, axisLabel: { color: dark ? '#938F99' : '#79747E', fontSize: compact ? 8 : (medium ? 9 : 10), margin: compact ? 8 : 12 } },
        yAxis: { type: 'value', min: 0, max: 250, interval: compact ? 100 : 50, axisLine: { show: true, lineStyle: { color: dark ? '#938F99' : '#79747E', width: 1.5 } }, axisTick: { show: false }, axisLabel: { color: dark ? '#938F99' : '#79747E', fontSize: compact ? 8 : (medium ? 9 : 10), formatter: function(v) { return '$' + v + 'M'; } }, splitLine: { lineStyle: { color: dark ? '#49454F' : '#E7E0EC' } } },
        series: seriesData.slice().reverse().map(function(series, reverseIdx, reversed) {
          const idx = reversed.length - 1 - reverseIdx;
          const color = colors[idx];
          return { type: 'line', name: series.name, stack: 'total', smooth: false, symbol: 'circle', symbolSize: compact ? 4 : (medium ? 5.5 : 7), showSymbol: true, data: series.values, lineStyle: { width: compact ? (series.name === 'Slate' ? 1.3 : 1.6) : (medium ? (series.name === 'Slate' ? 1.6 : 2) : (series.name === 'Slate' ? 2 : 2.5)), color: color, type: series.name === 'Slate' ? 'dashed' : 'solid' }, areaStyle: { color: echarts.color.modifyAlpha(color, dark ? 0.88 : 0.82) }, itemStyle: { color: color, borderWidth: 0 }, emphasis: { focus: 'series', blurScope: 'coordinateSystem' }, blur: { lineStyle: { opacity: 0.2 }, itemStyle: { opacity: 0.2 }, areaStyle: { opacity: 0.15 } }, animationDelay: function(dataIndex) { return reverseIdx * 120 + dataIndex * 36; }, z: 5 + idx };
        })
      };
    });
  }

  function makeStackedAreaChart(container) {
    const quarters = ["Q1 '22", "Q2 '22", "Q3 '22", "Q4 '22", "Q1 '23", "Q2 '23", "Q3 '23", "Q4 '23"];
    const seriesData = [
      { name: 'Cyan', values: [38, 42, 46, 50, 55, 60, 66, 72] },
      { name: 'Violet', values: [32, 35, 38, 41, 45, 50, 56, 62] },
      { name: 'Emerald', values: [18, 20, 21, 23, 25, 27, 31, 35] },
      { name: 'Amber', values: [11, 12, 13, 14, 15, 17, 19, 22] },
      { name: 'Slate', values: [10, 11, 12, 13, 14, 16, 17, 19] }
    ];
    const totals = quarters.map(function(_, idx) { return seriesData.reduce(function(sum, series) { return sum + series.values[idx]; }, 0); });

    function tooltip(state, params) {
      const dark = state.dark;
      const maxRows = state.compact ? 3 : (state.medium ? 4 : 8);
      const rows = truncateTooltipRows(params.slice().reverse().map(function(param) {
        return '<div style="display:flex;align-items:center;justify-content:space-between;gap:12px;margin-top:6px;">' +
          '<div style="display:flex;align-items:center;gap:8px;color:' + (dark ? '#CAC4D0' : '#49454F') + ';font-size:10px;"><span style="width:8px;height:8px;border-radius:999px;background:' + param.color + ';display:inline-block;"></span><span>' + param.seriesName + '</span></div>' +
          '<div style="color:' + (dark ? '#E6E0E9' : '#1C1B1F') + ';font-size:11px;font-weight:600;">$' + param.value + 'M</div></div>';
      }), maxRows, dark).join('');
      const total = totals[params[0].dataIndex];
      return tooltipCard(dark,
        '<div style="color:' + (dark ? '#E6E0E9' : '#1C1B1F') + ';font-size:13px;font-weight:600;">' + params[0].axisValue + '</div>' +
        '<div style="margin-top:6px;border-top:1px solid ' + (dark ? '#49454F' : '#E7E0EC') + ';"></div>' + rows +
        '<div style="margin-top:8px;border-top:1px solid ' + (dark ? '#49454F' : '#E7E0EC') + ';"></div>' +
        '<div style="display:flex;align-items:center;justify-content:space-between;gap:12px;margin-top:8px;"><div style="color:' + (dark ? '#CAC4D0' : '#49454F') + ';font-size:10px;">Total</div><div style="color:' + (dark ? '#E6E0E9' : '#1C1B1F') + ';font-size:11px;font-weight:600;">$' + total + 'M</div></div>',
        '158px'
      );
    }

    return createManagedChart(container, function(chart, state, containerEl) {
      const dark = state.dark;
      const compact = isCompactChart(chart);
      const medium = isMediumChart(chart);
      state.compact = compact;
      state.medium = medium;
      const darkPalette = ['#22D3EE', '#A78BFA', '#10B981', '#FBB724', '#94A3B8'];
      const lightPalette = [state.colors[0], state.colors[4], state.colors[1], state.colors[2], state.colors[7]];
      const colors = dark ? darkPalette : lightPalette;
      setLegendOverlayConfig(containerEl, {
        dark: dark,
        layout: legendOverlayLayout(chart),
        items: seriesData.map(function(series, idx) { return { name: series.name, color: colors[idx] }; })
      });
      const gridLeft = compact ? 26 : (medium ? 30 : 48);
      const gridRight = legendGridRight(chart);
      const plotWidth = Math.max(180, chart.getWidth() - gridLeft - gridRight);
      return {
        animationDuration: 700, animationDurationUpdate: 250, animationEasing: 'cubicOut', color: colors, backgroundColor: 'transparent',
        grid: { left: gridLeft, right: gridRight, top: compact ? 16 : (medium ? 18 : 24), bottom: compact ? 28 : 34 },
        tooltip: { trigger: 'axis', confine: true, axisPointer: { type: 'line', lineStyle: { color: dark ? '#938F99' : '#c0b8a8', width: 1, type: 'dashed' } }, backgroundColor: 'transparent', borderWidth: 0, padding: 0, extraCssText: 'box-shadow:none;background:transparent;', formatter: function(params) { return tooltip(state, params); }, order: 'seriesAsc', position: function(pos, params, dom, rect, size) { return smartTooltipPosition(pos, rect || { x: pos[0], y: pos[1], width: 0, height: 0 }, size, dom, dark, true, 24); } },
        graphic: [{ type: 'line', left: gridLeft + plotWidth / 2, top: compact ? 18 : (medium ? 18 : 24), shape: { x1: 0, y1: 0, x2: 0, y2: chart.getHeight() - (compact ? 46 : 58) }, style: { stroke: dark ? '#938F99' : '#c0b8a8', lineWidth: 1, opacity: 0.6, lineDash: [5, 4] } }, { type: 'text', left: gridLeft + plotWidth / 4 - 12, top: compact ? 0 : 2, style: { text: '2022', fill: dark ? '#938F99' : '#79747E', font: '400 ' + (compact ? 9 : 10) + 'px Roboto, Helvetica Neue, Arial, sans-serif' } }, { type: 'text', left: gridLeft + plotWidth * 0.75 - 12, top: compact ? 0 : 2, style: { text: '2023', fill: dark ? '#938F99' : '#79747E', font: '400 ' + (compact ? 9 : 10) + 'px Roboto, Helvetica Neue, Arial, sans-serif' } }],
        xAxis: { type: 'category', boundaryGap: false, data: quarters, axisLine: { lineStyle: { color: dark ? '#938F99' : '#79747E', width: 1.5 } }, axisTick: { show: false }, axisLabel: { color: dark ? '#938F99' : '#79747E', fontSize: compact ? 8 : (medium ? 9 : 10), margin: compact ? 8 : 12 } },
        yAxis: { type: 'value', min: 0, max: 250, interval: compact ? 100 : 50, axisLine: { show: true, lineStyle: { color: dark ? '#938F99' : '#79747E', width: 1.5 } }, axisTick: { show: false }, axisLabel: { color: dark ? '#938F99' : '#79747E', fontSize: compact ? 8 : (medium ? 9 : 10), formatter: function(v) { return '$' + v + 'M'; } }, splitLine: { lineStyle: { color: dark ? '#49454F' : '#E7E0EC' } } },
        series: seriesData.slice().reverse().map(function(series, reverseIdx, reversed) {
          const idx = reversed.length - 1 - reverseIdx;
          const color = colors[idx];
          const width = compact ? (series.name === 'Slate' ? 1.2 : (idx === 0 ? 2.4 : idx === 1 ? 2.1 : idx === 2 ? 1.8 : 1.5)) : (medium ? (series.name === 'Slate' ? 1.4 : (idx === 0 ? 2.8 : idx === 1 ? 2.4 : idx === 2 ? 2 : 1.7)) : (series.name === 'Slate' ? 1.5 : (idx === 0 ? 3.5 : idx === 1 ? 2.5 : idx === 2 ? 2.5 : 2)));
          return {
            type: 'line',
            name: series.name,
            stack: 'total',
            smooth: true,
            symbol: 'none',
            showSymbol: false,
            data: series.values,
            lineStyle: { width: width, color: color, type: series.name === 'Slate' ? 'dashed' : 'solid' },
            areaStyle: { color: echarts.color.modifyAlpha(color, dark ? (idx === 0 ? 0.85 : idx === 1 ? 0.75 : idx === 2 ? 0.65 : idx === 3 ? 0.55 : 0.45) : (idx === 0 ? 0.78 : idx === 1 ? 0.68 : idx === 2 ? 0.58 : idx === 3 ? 0.48 : 0.40)) },
            itemStyle: { color: color, borderWidth: 0 },
            emphasis: { focus: 'series', blurScope: 'coordinateSystem' },
            blur: { lineStyle: { opacity: 0.2 }, itemStyle: { opacity: 0.2 }, areaStyle: { opacity: 0.18 } },
            animationDelay: function(dataIndex) { return reverseIdx * 120 + dataIndex * 36; },
            z: 5 + idx
          };
        })
      };
    });
  }

  function makeCandleChart(container) {
    const months = ['Oct', 'Nov', 'Dec', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep'];
    const candleData = [
      { month: 'Oct', open: 132, high: 148, low: 125, close: 144 },
      { month: 'Nov', open: 144, high: 155, low: 138, close: 139 },
      { month: 'Dec', open: 139, high: 142, low: 118, close: 122 },
      { month: 'Jan', open: 122, high: 135, low: 115, close: 131 },
      { month: 'Feb', open: 131, high: 150, low: 128, close: 148 },
      { month: 'Mar', open: 148, high: 162, low: 143, close: 158 },
      { month: 'Apr', open: 158, high: 165, low: 144, close: 147 },
      { month: 'May', open: 147, high: 152, low: 130, close: 134 },
      { month: 'Jun', open: 134, high: 149, low: 129, close: 146 },
      { month: 'Jul', open: 146, high: 168, low: 140, close: 165 },
      { month: 'Aug', open: 165, high: 172, low: 151, close: 155 },
      { month: 'Sep', open: 155, high: 160, low: 138, close: 142 }
    ];

    function tooltip(state, param) {
      const dark = state.dark;
      const item = candleData[param.dataIndex];
      const bullish = item.close >= item.open;
      const trendColor = bullish ? (dark ? '#10B981' : '#00B87A') : (dark ? '#FB6181' : '#F43F5E');
      return tooltipCard(dark,
        '<div style="color:' + (dark ? '#CAC4D0' : '#49454F') + ';font-size:10px;">Open <span style="color:' + (dark ? '#E6E0E9' : '#1C1B1F') + ';font-weight:600;">$' + item.open + '</span> · High <span style="color:' + (dark ? '#E6E0E9' : '#1C1B1F') + ';font-weight:600;">$' + item.high + '</span></div>' +
        '<div style="margin-top:4px;color:' + (dark ? '#CAC4D0' : '#49454F') + ';font-size:10px;">Low <span style="color:' + (dark ? '#E6E0E9' : '#1C1B1F') + ';font-weight:600;">$' + item.low + '</span> · Close <span style="color:' + (dark ? '#E6E0E9' : '#1C1B1F') + ';font-weight:600;">$' + item.close + '</span></div>' +
        '<div style="margin-top:10px;color:' + trendColor + ';font-size:12px;font-weight:600;">' + item.month + ' · ' + (bullish ? 'Bullish' : 'Bearish') + '</div>',
        '148px'
      );
    }

    function infoGraphic(chart, dark) {
      const compact = isCompactChart(chart);
      const medium = isMediumChart(chart);
      const panelWidth = compact ? 108 : (medium ? 122 : 156);
      const right = compact ? 8 : 12;
      const titleFont = compact ? '500 10px Roboto, Helvetica Neue, Arial, sans-serif' : '500 10px Roboto, Helvetica Neue, Arial, sans-serif';
      const labelFont = compact ? '400 9px Roboto, Helvetica Neue, Arial, sans-serif' : '400 10px Roboto, Helvetica Neue, Arial, sans-serif';
      const boxFill = dark ? '#2A2630' : '#F3EDF7';
      const boxStroke = dark ? '#938F99' : '#79747E';
      const textFill = dark ? '#E6E0E9' : '#1C1B1F';
      const subtle = dark ? '#938F99' : '#79747E';
      const bull = dark ? '#10B981' : '#00B87A';
      const bear = dark ? '#FB6181' : '#F43F5E';
      const yearHigh = Math.max.apply(null, candleData.map(function(item) { return item.high; }));
      const yearLow = Math.min.apply(null, candleData.map(function(item) { return item.low; }));
      const startPrice = candleData[0].open;
      const endPrice = candleData[candleData.length - 1].close;
      const panelX = Math.max(0, chart.getWidth() - panelWidth - right);
      const topHeight = compact ? 132 : 148;
      const bottomHeight = compact ? 86 : 96;
      const bottomY = compact ? 150 : 168;
      return [{
        type: 'group',
        left: panelX,
        top: compact ? 10 : 8,
        bounding: 'all',
        children: [{
          type: 'rect',
          shape: { x: 0, y: 0, width: panelWidth, height: topHeight, r: 14 },
          style: { fill: boxFill, stroke: boxStroke, lineWidth: 1, opacity: dark ? 0.95 : 1 }
        }, {
          type: 'text',
          style: { x: 14, y: 18, text: 'CANDLE', fill: subtle, font: titleFont }
        }, {
          type: 'rect',
          shape: { x: 14, y: 30, width: 10, height: 10, r: 2 },
          style: { fill: bull }
        }, {
          type: 'text',
          style: { x: 30, y: 39, text: compact ? 'Bullish' : 'Bullish (close ≥ open)', fill: textFill, font: labelFont }
        }, {
          type: 'rect',
          shape: { x: 14, y: 54, width: 10, height: 10, r: 2 },
          style: { fill: bear }
        }, {
          type: 'text',
          style: { x: 30, y: 63, text: compact ? 'Bearish' : 'Bearish (close < open)', fill: textFill, font: labelFont }
        }, {
          type: 'line',
          shape: { x1: 14, y1: 76, x2: panelWidth - 14, y2: 76 },
          style: { stroke: dark ? '#49454F' : '#D0C7DA', lineWidth: 1 }
        }, {
          type: 'text',
          style: { x: 14, y: 96, text: 'STRUCTURE', fill: subtle, font: titleFont }
        }, {
          type: 'line',
          shape: { x1: 19, y1: 108, x2: 19, y2: compact ? 132 : 138 },
          style: { stroke: subtle, lineWidth: 1.5 }
        }, {
          type: 'rect',
          shape: { x: 14, y: compact ? 114 : 116, width: 10, height: compact ? 12 : 16, r: 0 },
          style: { fill: subtle, opacity: 0.35 }
        }, {
          type: 'text',
          style: { x: 34, y: 112, text: 'High', fill: textFill, font: labelFont }
        }, {
          type: 'text',
          style: { x: 34, y: 124, text: 'Open / Close', fill: textFill, font: labelFont }
        }, {
          type: 'text',
          style: { x: 34, y: 136, text: 'Low', fill: textFill, font: labelFont }
        }]
      }, {
        type: 'group',
        left: panelX,
        top: bottomY,
        bounding: 'all',
        children: [{
          type: 'rect',
          shape: { x: 0, y: 0, width: panelWidth, height: bottomHeight, r: 14 },
          style: { fill: boxFill, stroke: boxStroke, lineWidth: 1, opacity: dark ? 0.95 : 1 }
        }, {
          type: 'text',
          style: { x: 14, y: 18, text: 'RANGE', fill: subtle, font: titleFont }
        }, {
          type: 'text',
          style: { x: 14, y: 38, text: 'Year High', fill: textFill, font: labelFont }
        }, {
          type: 'text',
          style: { x: panelWidth - 14, y: 38, text: '$' + yearHigh, textAlign: 'right', fill: textFill, font: labelFont }
        }, {
          type: 'text',
          style: { x: 14, y: 56, text: 'Year Low', fill: textFill, font: labelFont }
        }, {
          type: 'text',
          style: { x: panelWidth - 14, y: 56, text: '$' + yearLow, textAlign: 'right', fill: textFill, font: labelFont }
        }, {
          type: 'text',
          style: { x: 14, y: 74, text: compact ? 'Start' : 'Start Price', fill: textFill, font: labelFont }
        }, {
          type: 'text',
          style: { x: panelWidth - 14, y: 74, text: '$' + startPrice, textAlign: 'right', fill: textFill, font: labelFont }
        }, {
          type: 'text',
          style: { x: 14, y: 92, text: compact ? 'End' : 'End Price', fill: textFill, font: labelFont }
        }, {
          type: 'text',
          style: { x: panelWidth - 14, y: 92, text: '$' + endPrice, textAlign: 'right', fill: textFill, font: labelFont }
        }]
      }];
    }

    return createManagedChart(container, function(chart, state, containerEl) {
      const dark = state.dark;
      const compact = isCompactChart(chart);
      const medium = isMediumChart(chart);
      const bull = dark ? '#10B981' : '#00B87A';
      const bear = dark ? '#FB6181' : '#F43F5E';
      const subtle = dark ? '#938F99' : '#79747E';
      const yearHigh = Math.max.apply(null, candleData.map(function(item) { return item.high; }));
      const yearLow = Math.min.apply(null, candleData.map(function(item) { return item.low; }));
      const startPrice = candleData[0].open;
      const endPrice = candleData[candleData.length - 1].close;
      setLegendOverlayConfig(containerEl, {
        dark: dark,
        layout: legendOverlayLayout(chart),
        items: [
          { name: compact ? 'Bullish' : 'Bullish (close >= open)', color: bull },
          { name: compact ? 'Bearish' : 'Bearish (close < open)', color: bear },
          { name: 'Year High $' + yearHigh, color: subtle },
          { name: 'Year Low $' + yearLow, color: subtle },
          { name: 'Start $' + startPrice, color: subtle },
          { name: 'End $' + endPrice, color: subtle }
        ]
      });
      return {
        animationDuration: 900,
        animationDurationUpdate: 250,
        animationEasing: 'cubicOut',
        backgroundColor: 'transparent',
        grid: { left: compact ? 26 : (medium ? 30 : 48), right: legendGridRight(chart), top: compact ? 16 : 24, bottom: compact ? 28 : 40 },
        tooltip: {
          trigger: 'item',
          confine: true,
          backgroundColor: 'transparent',
          borderWidth: 0,
          padding: 0,
          extraCssText: 'box-shadow:none;background:transparent;',
          formatter: function(param) { return tooltip(state, param); },
          position: function(pos, params, dom, rect, size) { return smartTooltipPosition(pos, rect, size, dom, dark, true, 20); }
        },
        xAxis: {
          type: 'category',
          data: months,
          boundaryGap: true,
          axisLine: { lineStyle: { color: dark ? '#938F99' : '#79747E', width: 1.5 } },
          axisTick: { show: false },
          axisLabel: { color: dark ? '#938F99' : '#79747E', fontSize: compact ? 8 : (medium ? 9 : 10), margin: compact ? 8 : 12, interval: compact ? 1 : 0 }
        },
        yAxis: {
          type: 'value',
          min: 80,
          max: 180,
          interval: 25,
          axisLine: { show: true, lineStyle: { color: dark ? '#938F99' : '#79747E', width: 1.5 } },
          axisTick: { show: false },
          axisLabel: { color: dark ? '#938F99' : '#79747E', fontSize: compact ? 8 : (medium ? 9 : 10), formatter: function(v) { return '$' + v; } },
          splitLine: { lineStyle: { color: dark ? '#49454F' : '#E7E0EC' } }
        },
        graphic: [],
        series: [{
          type: 'candlestick',
          data: candleData.map(function(item) { return [item.open, item.close, item.low, item.high]; }),
          itemStyle: {
            color: bull,
            color0: bear,
            borderColor: bull,
            borderColor0: bear,
            borderWidth: 1
          },
          emphasis: { focus: 'self', blurScope: 'coordinateSystem' },
          blur: { itemStyle: { opacity: 0.2 } },
          barMaxWidth: compact ? 14 : (medium ? 20 : 28),
          animationDelay: function(idx) { return idx * 160; }
        }]
      };
    });
  }

  function makeFunnelChart(container) {
    const data = [{ value: 48200, name: 'Awareness' }, { value: 28900, name: 'Interest' }, { value: 14600, name: 'Consideration' }, { value: 7840, name: 'Intent' }, { value: 3920, name: 'Evaluation' }, { value: 1960, name: 'Purchase' }];
    function tooltip(state, param) {
      const dark = state.dark;
      return tooltipCard(dark,
        '<div style="color:' + (dark ? '#E6E0E9' : '#1C1B1F') + ';font-size:13px;font-weight:600;">' + param.name + '</div>' +
        '<div style="margin-top:4px;color:' + (dark ? '#CAC4D0' : '#49454F') + ';font-size:10px;">Qualified users</div>' +
        '<div style="margin-top:6px;color:' + (dark ? '#E6E0E9' : '#1C1B1F') + ';font-size:11px;font-weight:600;">' + param.value + '</div>' +
        '<div style="margin-top:4px;color:' + (dark ? '#938F99' : '#79747E') + ';font-size:10px;">' + param.percent + '% of total</div>',
        '132px'
      );
    }
    return createManagedChart(container, function(chart, state, containerEl) {
      const dark = state.dark;
      const compact = isCompactChart(chart);
      const medium = isMediumChart(chart);
      const darkPalette = ['#22D3EE', '#10B981', '#FBB724', '#FB6181', '#A78BFA', '#60A5FA', '#2DD4BF', '#94A3B8'];
      const colors = dark ? darkPalette : state.colors;
      setLegendOverlayConfig(containerEl, {
        dark: dark,
        layout: legendOverlayLayout(chart),
        items: data.map(function(item, idx) { return { name: item.name, color: colors[idx] }; })
      });
      return {
        animationDuration: 800, animationDurationUpdate: 250, animationEasing: 'cubicOut', color: [colors[0], colors[1], colors[2], colors[3], colors[4], colors[5]], backgroundColor: 'transparent',
        tooltip: { trigger: 'item', confine: true, backgroundColor: 'transparent', borderWidth: 0, padding: 0, extraCssText: 'box-shadow:none;background:transparent;', formatter: function(param) { return tooltip(state, param); }, position: function(pos, params, dom, rect, size) { return smartTooltipPosition(pos, rect, size, dom, dark, true, 20); } },
        series: [{ type: 'funnel', left: compact ? 12 : 24, right: legendGridRight(chart), top: compact ? 14 : 18, bottom: compact ? 14 : 18, min: 0, max: 48200, minSize: '7%', maxSize: '92%', sort: 'descending', gap: compact ? 6 : 8, label: { show: !compact && !medium, position: 'right', color: dark ? '#E6E0E9' : '#1C1B1F', fontSize: 11, formatter: function(param) { return param.name; } }, labelLine: { show: !compact && !medium, length: 10, lineStyle: { color: dark ? '#938F99' : '#79747E' } }, itemStyle: { borderColor: compact || medium ? 'transparent' : (dark ? '#151825' : '#f8f5fb'), borderWidth: compact || medium ? 0 : 3 }, emphasis: { focus: 'self', blurScope: 'series' }, blur: { itemStyle: { opacity: 0.2 } }, animationDelay: function(idx) { return idx * 140; }, data: data }]
      };
    });
  }

  function makeTreemapChart(container) {
    const data = [{ name: 'Violet', value: 320 }, { name: 'Cyan', value: 210 }, { name: 'Emerald', value: 150 }, { name: 'Amber', value: 120 }, { name: 'Blue', value: 85 }, { name: 'Teal', value: 65 }, { name: 'Rose', value: 45 }, { name: 'Other', value: 30 }];
    const treemapOuterPad = 8;
    const treemapTileGap = 4;
    let introPlayed = false;
    let introTimer = null;
    function tooltip(state, param) {
      const dark = state.dark;
      const total = data.reduce(function(sum, item) { return sum + item.value; }, 0);
      const pct = ((param.value || 0) / total * 100).toFixed(1);
      return tooltipCard(dark,
        '<div style="color:' + (dark ? '#E6E0E9' : '#1C1B1F') + ';font-size:13px;font-weight:600;">' + param.name + '</div>' +
        '<div style="margin-top:4px;color:' + (dark ? '#CAC4D0' : '#49454F') + ';font-size:10px;">Revenue by category</div>' +
        '<div style="margin-top:6px;color:' + (dark ? '#E6E0E9' : '#1C1B1F') + ';font-size:11px;font-weight:600;">$' + (param.value || 0) + 'M</div>' +
        '<div style="margin-top:4px;color:' + (dark ? '#938F99' : '#79747E') + ';font-size:10px;">' + pct + '% of total</div>',
        '136px'
      );
    }
    return createManagedChart(container, function(chart, state, containerEl) {
      const dark = state.dark;
      const darkPalette = ['#22D3EE', '#10B981', '#FBB724', '#FB6181', '#A78BFA', '#60A5FA', '#2DD4BF', '#94A3B8'];
      const colors = dark ? darkPalette : state.colors;
      const seededData = data.map(function(item) { return { name: item.name, value: 1 }; });
      const liveData = introPlayed ? data : seededData;
      setLegendOverlayConfig(containerEl, {
        dark: dark,
        layout: legendOverlayLayout(chart),
        items: data.map(function(item, idx) { return { name: item.name, color: colors[[4, 0, 1, 2, 5, 6, 3, 7][idx]] || colors[idx] }; })
      });
      return {
        animationDuration: 1200, animationDurationUpdate: 1200, animationEasing: 'quarticOut', color: colors, backgroundColor: 'transparent',
        tooltip: { trigger: 'item', confine: true, backgroundColor: 'transparent', borderWidth: 0, padding: 0, extraCssText: 'box-shadow:none;background:transparent;', formatter: function(param) { return tooltip(state, param); }, position: function(pos, params, dom, rect, size) { return smartTooltipPosition(pos, rect, size, dom, dark, true, 20); } },
        series: [{ type: 'treemap', left: treemapOuterPad, right: legendGridRight(chart) - 4, top: treemapOuterPad, bottom: treemapOuterPad, roam: false, nodeClick: false, animation: true, animationDuration: 1200, animationDurationUpdate: 1200, animationDelay: function(idx) { return idx * 180; }, animationDelayUpdate: function(idx) { return idx * 180; }, breadcrumb: { show: false }, label: { show: introPlayed, formatter: function(param) { return param.name || ''; }, color: dark ? '#E6E0E9' : '#1C1B1F', fontSize: 11, lineHeight: 14 }, upperLabel: { show: false, height: 22, color: dark ? '#E6E0E9' : '#1C1B1F', fontSize: 11, fontWeight: '600' }, itemStyle: { borderColor: dark ? '#151825' : '#f8f5fb', borderWidth: treemapTileGap, gapWidth: treemapTileGap, borderRadius: 12 }, emphasis: { focus: 'self', itemStyle: { borderColor: dark ? '#E6E0E9' : '#1C1B1F', borderWidth: 2 } }, blur: { itemStyle: { opacity: 0.2 } }, levels: [{ color: [colors[4], colors[0], colors[1], colors[2], colors[5], colors[6], colors[3], colors[7]], itemStyle: { borderColor: dark ? '#151825' : '#f8f5fb', borderWidth: treemapTileGap, gapWidth: treemapTileGap, borderRadius: 14 } }], data: liveData }]
      };
    }, function(chart, state) {
      if (introPlayed || introTimer) return;
      introTimer = setTimeout(function() {
        introTimer = null;
        introPlayed = true;
        chart.setOption({
          series: [{
            label: { show: true },
            data: data
          }]
        });
      }, 40);
    });
  }

  function makeMarimekkoChart(container) {
    const products = [
      { name: 'Product A', total: 346, shareLabel: '25%', values: { USA: 97, China: 14, UK: 63, Germany: 97, France: 26, India: 49 } },
      { name: 'Product B', total: 430, shareLabel: '31%', values: { USA: 97, China: 87, UK: 67, Germany: 65, France: 29, India: 85 } },
      { name: 'Product C', total: 261, shareLabel: '19%', values: { USA: 45, China: 54, UK: 18, Germany: 36, France: 24, India: 84 } },
      { name: 'Product D', total: 329, shareLabel: '24%', values: { USA: 61, China: 32, UK: 66, Germany: 73, France: 47, India: 50 } }
    ];
    const countries = ['USA', 'China', 'UK', 'Germany', 'France', 'India'];
    const darkPalette = ['#22D3EE', '#10B981', '#FBB724', '#FB6181', '#A78BFA', '#60A5FA'];
    const totalValue = products.reduce(function(sum, product) { return sum + product.total; }, 0);
    const countryTotals = countries.map(function(country) {
      return products.reduce(function(sum, product) { return sum + product.values[country]; }, 0);
    });
    let introPlayed = false;
    let introTimer = null;
    const productRows = [];
    let xCursor = 0;
    products.forEach(function(product, productIdx) {
      let topPct = 100;
      countries.forEach(function(country, countryIdx) {
        const value = product.values[country];
        const shareWithinProduct = value / product.total * 100;
        const nextTop = topPct - shareWithinProduct;
        productRows.push({
          name: country + ' · ' + product.name,
          product: product.name,
          country: country,
          rawValue: value,
          productTotal: product.total,
          totalShare: value / totalValue * 100,
          productShare: shareWithinProduct,
          value: [xCursor, xCursor + product.total, nextTop, topPct, productIdx, countryIdx, value]
        });
        topPct = nextTop;
      });
      xCursor += product.total;
    });

    function tooltip(state, param) {
      const dark = state.dark;
      const item = param.data || {};
      return tooltipCard(dark,
        '<div style="color:' + (dark ? '#E6E0E9' : '#1C1B1F') + ';font-size:13px;font-weight:600;">' + item.country + ' · ' + item.product + '</div>' +
        '<div style="margin-top:4px;color:' + (dark ? '#CAC4D0' : '#49454F') + ';font-size:10px;">Sales · Share within product</div>' +
        '<div style="margin-top:6px;display:flex;align-items:center;justify-content:space-between;gap:12px;color:' + (dark ? '#E6E0E9' : '#1C1B1F') + ';font-size:11px;font-weight:600;"><span>' + item.rawValue + '</span><span>' + Math.round(item.productShare) + '%</span></div>' +
        '<div style="margin-top:4px;color:' + (dark ? '#938F99' : '#79747E') + ';font-size:10px;">' + item.product + ' total ' + item.productTotal + ' · overall ' + item.totalShare.toFixed(1) + '%</div>',
        '164px'
      );
    }

    function renderMarimekkoCell(params, api) {
      const x0 = api.value(0);
      const x1 = api.value(1);
      const y0 = api.value(2);
      const y1 = api.value(3);
      const rawValue = api.value(6);
      const start = api.coord([x0, y0]);
      const end = api.coord([x1, y1]);
      const rect = echarts.graphic.clipRectByRect({
        x: Math.min(start[0], end[0]),
        y: Math.min(start[1], end[1]),
        width: Math.abs(end[0] - start[0]),
        height: Math.abs(end[1] - start[1])
      }, {
        x: params.coordSys.x,
        y: params.coordSys.y,
        width: params.coordSys.width,
        height: params.coordSys.height
      });
      if (!rect) return null;
      const style = api.style();
      const children = [{
        type: 'rect',
        shape: rect,
        style: style,
        transition: ['shape', 'style']
      }];
      if (rect.width > 46 && rect.height > 24) {
        children.push({
          type: 'text',
          silent: true,
          style: {
            x: rect.x + rect.width / 2,
            y: rect.y + rect.height / 2,
            text: String(rawValue),
            fill: '#F8FAFC',
            font: '600 11px Roboto, Helvetica Neue, Arial, sans-serif',
            textAlign: 'center',
            textVerticalAlign: 'middle'
          }
        });
      }
      return { type: 'group', children: children };
    }

    function buildMarimekkoSeriesData(rows, colors) {
      return rows.map(function(item) {
        const color = colors[item.value[5]];
        return {
          name: item.name,
          product: item.product,
          country: item.country,
          rawValue: item.rawValue,
          productTotal: item.productTotal,
          totalShare: item.totalShare,
          productShare: item.productShare,
          value: item.value,
          itemStyle: { color: color, opacity: 0.96 }
        };
      });
    }

    return createManagedChart(container, function(chart, state, containerEl) {
      const dark = state.dark;
      const compact = isCompactChart(chart);
      const medium = isMediumChart(chart);
      const colors = (dark ? darkPalette : state.colors).slice(0, countries.length);
      const liveRows = introPlayed ? productRows : productRows.map(function(item) {
        const yMid = (item.value[2] + item.value[3]) / 2;
        return {
          name: item.name,
          product: item.product,
          country: item.country,
          rawValue: item.rawValue,
          productTotal: item.productTotal,
          totalShare: item.totalShare,
          productShare: item.productShare,
          value: [item.value[0], item.value[1], yMid, yMid, item.value[4], item.value[5], item.rawValue]
        };
      });
      setLegendOverlayConfig(containerEl, {
        dark: dark,
        layout: legendOverlayLayout(chart),
        items: countries.map(function(country, idx) {
          return { name: country + ' ' + countryTotals[idx], color: colors[idx] };
        })
      });
      const gridLeft = compact ? 18 : (medium ? 24 : 40);
      const gridRight = legendGridRight(chart);
      const gridTop = compact ? 28 : (medium ? 30 : 38);
      const gridBottom = compact ? 52 : (medium ? 58 : 68);
      const plotWidth = Math.max(160, chart.getWidth() - gridLeft - gridRight);
      const plotHeight = Math.max(120, chart.getHeight() - gridTop - gridBottom);
      const labelColor = dark ? '#938F99' : '#79747E';
      const borderColor = dark ? '#938F99' : '#C0B8A8';
      const lineColor = dark ? '#E6E0E9' : '#FFFFFF';
      const graphics = [{
        type: 'text',
        left: gridLeft + plotWidth / 2,
        top: compact ? 0 : 2,
        style: {
          text: 'Total = ' + totalValue.toLocaleString(),
          fill: dark ? '#E6E0E9' : '#1C1B1F',
          font: '500 ' + (compact ? 10 : 11) + 'px Roboto, Helvetica Neue, Arial, sans-serif',
          textAlign: 'center'
        }
      }, {
        type: 'rect',
        shape: { x: gridLeft, y: gridTop, width: plotWidth, height: plotHeight, r: 0 },
        style: { stroke: borderColor, lineWidth: 1, fill: 'transparent', opacity: 0.95 }
      }];
      let running = 0;
      products.forEach(function(product, idx) {
        const nextRunning = running + product.total;
        const centerRatio = (running + product.total / 2) / totalValue;
        const centerX = gridLeft + plotWidth * centerRatio;
        graphics.push({
          type: 'text',
          left: centerX,
          top: chart.getHeight() - gridBottom + 10,
          style: {
            text: product.name,
            fill: dark ? '#E6E0E9' : '#1C1B1F',
            font: '500 ' + (compact ? 8 : (medium ? 9 : 10)) + 'px Roboto, Helvetica Neue, Arial, sans-serif',
            textAlign: 'center'
          }
        }, {
          type: 'text',
          left: centerX,
          top: chart.getHeight() - gridBottom + 24,
          style: {
            text: String(product.total),
            fill: labelColor,
            font: '400 ' + (compact ? 8 : 9) + 'px Roboto, Helvetica Neue, Arial, sans-serif',
            textAlign: 'center'
          }
        }, {
          type: 'text',
          left: centerX,
          top: chart.getHeight() - gridBottom + 38,
          style: {
            text: product.shareLabel,
            fill: labelColor,
            font: '400 ' + (compact ? 8 : 9) + 'px Roboto, Helvetica Neue, Arial, sans-serif',
            textAlign: 'center'
          }
        });
        if (idx < products.length - 1) {
          const dividerX = gridLeft + plotWidth * (nextRunning / totalValue);
          graphics.push({
            type: 'line',
            shape: { x1: dividerX, y1: gridTop, x2: dividerX, y2: gridTop + plotHeight },
            style: { stroke: lineColor, lineWidth: 1, opacity: dark ? 0.72 : 0.98 }
          });
        }
        running = nextRunning;
      });
      return {
        animationDuration: 700,
        animationDurationUpdate: 700,
        animationEasing: 'cubicOut',
        backgroundColor: 'transparent',
        color: colors,
        graphic: graphics,
        tooltip: {
          trigger: 'item',
          confine: true,
          backgroundColor: 'transparent',
          borderWidth: 0,
          padding: 0,
          extraCssText: 'box-shadow:none;background:transparent;',
          formatter: function(param) { return tooltip(state, param); },
          position: function(pos, params, dom, rect, size) { return smartTooltipPosition(pos, rect, size, dom, dark, true, 22); }
        },
        xAxis: {
          type: 'value',
          min: 0,
          max: totalValue,
          show: false
        },
        yAxis: {
          type: 'value',
          min: 0,
          max: 100,
          show: false
        },
        grid: { left: gridLeft, right: gridRight, top: gridTop, bottom: gridBottom },
        series: [{
          type: 'custom',
          coordinateSystem: 'cartesian2d',
          renderItem: renderMarimekkoCell,
          data: buildMarimekkoSeriesData(liveRows, colors),
          encode: { x: [0, 1], y: [2, 3], tooltip: 6 },
          progressive: 0,
          animationDelay: function(idx) { return idx * 45; },
          animationDelayUpdate: function(idx) { return idx * 45; },
          emphasis: { focus: 'self', blurScope: 'coordinateSystem' },
          blur: { itemStyle: { opacity: 0.18 } },
          silent: false
        }]
      };
    }, function(chart, state) {
      if (introPlayed || introTimer) return;
      introTimer = setTimeout(function() {
        introTimer = null;
        introPlayed = true;
        chart.setOption({
          series: [{
            data: buildMarimekkoSeriesData(productRows, (state.dark ? darkPalette : state.colors).slice(0, countries.length))
          }]
        });
      }, 40);
    });
  }

  const registry = {
    'bar-echarts': makeBarChart,
    'pareto-echarts': makeParetoChart,
    'waterfall-echarts': makeWaterfallChart,
    'gantt-echarts': makeGanttChart,
    'bubble-echarts': makeBubbleChart,
    'network-echarts': makeNetworkChart,
    'circular-network-echarts': makeCircularNetworkChart,
    'stacked-bar-echarts': makeStackedBarChart,
    'stepline-echarts': makeStepLineChart,
    'jumpline-echarts': makeJumpLineChart,
    'steparea-echarts': makeStepAreaChart,
    'line-echarts': makeLineChart,
    'area-echarts': makeAreaChart,
    'stacked-line-echarts': makeStackedLineChart,
    'stacked-area-echarts': makeStackedAreaChart,
    'candle-echarts': makeCandleChart,
    'pie-echarts': makePieChart,
    'sunburst-echarts': makeSunburstChart,
    'circle-packing-echarts': makeCirclePackingChart,
    'icicle-echarts': makeIcicleChart,
    'tree-echarts': makeTreeChart,
    'boxplot-echarts': makeBoxplotChart,
    'radar-echarts': makeRadarChart,
    'funnel-echarts': makeFunnelChart,
    'treemap-echarts': makeTreemapChart,
    'marimekko-echarts': makeMarimekkoChart
  };

  global.LookfeelCharts = {
    registry: registry,
    defaultPalette: DEFAULT_PALETTE.slice(),
    mount: function(container, key) {
      if (!registry[key]) throw new Error('Unknown chart key: ' + key);
      return registry[key](container);
    }
  };
}(window));
