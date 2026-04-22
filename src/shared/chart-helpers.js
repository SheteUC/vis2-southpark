import * as d3 from 'd3';

export function fmt(n) {
  return d3.format(',')(Math.round(n));
}

export function fmtPct(n) {
  return d3.format('.1%')(n);
}

export function svgDims(containerId, {
  marginTop = 24,
  marginRight = 24,
  marginBottom = 40,
  marginLeft = 60,
} = {}) {
  const el = document.getElementById(containerId);
  const W = Math.max(el?.offsetWidth || 0, 320);
  const H = Math.max(el?.offsetHeight || 0, 300);
  return {
    W,
    H,
    innerW: W - marginLeft - marginRight,
    innerH: H - marginTop - marginBottom,
    marginTop,
    marginRight,
    marginBottom,
    marginLeft,
  };
}

export function makeSvg(containerId, dims) {
  const container = d3.select(`#${containerId}`);
  container.selectAll('svg').remove();
  container.selectAll('.chart-loading').remove();
  const svg = container.append('svg')
    .attr('width', dims.W)
    .attr('height', dims.H)
    .attr('viewBox', `0 0 ${dims.W} ${dims.H}`)
    .attr('style', 'overflow: visible;');
  const g = svg.append('g')
    .attr('transform', `translate(${dims.marginLeft},${dims.marginTop})`);
  return { svg, g };
}

export function addGrid(g, scale, isX, count, innerW, innerH) {
  const axis = isX
    ? d3.axisBottom(scale).ticks(count).tickSize(-innerH).tickFormat('')
    : d3.axisLeft(scale).ticks(count).tickSize(-innerW).tickFormat('');
  g.append('g')
    .attr('class', 'grid')
    .attr('transform', isX ? `translate(0,${innerH})` : '')
    .call(axis);
}

export function cssVar(name) {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

const CHAR_CSS_VARS = {
  Cartman: '--char-cartman',
  Stan: '--char-stan',
  Kyle: '--char-kyle',
  Kenny: '--char-kenny',
  Randy: '--char-randy',
  Butters: '--char-butters',
  Wendy: '--char-wendy',
  'Mr. Garrison': '--char-garrison',
};

const CHAR_FIXED = {
  Chef: '#c0581a',
  'Mr. Mackey': '#2e7dbf',
  Sharon: '#9060c0',
  Jimmy: '#2ea060',
  Craig: '#b84820',
  Tweek: '#1a9898',
  Gerald: '#6878a0',
  Clyde: '#d06030',
  Token: '#388090',
  Timmy: '#8840b0',
  Bebe: '#d04880',
};

const fallbackScale = d3.scaleOrdinal(d3.schemeTableau10);

export function charColor(name) {
  if (CHAR_CSS_VARS[name]) return cssVar(CHAR_CSS_VARS[name]);
  if (CHAR_FIXED[name]) return CHAR_FIXED[name];
  return fallbackScale(name);
}

function tooltipEl() {
  return document.getElementById('tooltip');
}

export function showTooltip(html, event) {
  const tooltip = tooltipEl();
  if (!tooltip) return;
  tooltip.innerHTML = html;
  tooltip.removeAttribute('hidden');
  positionTooltip(event);
}

export function hideTooltip() {
  tooltipEl()?.setAttribute('hidden', '');
}

export function positionTooltip(event) {
  const tooltip = tooltipEl();
  if (!tooltip || !event) return;
  const { clientX: x, clientY: y } = event;
  const tw = tooltip.offsetWidth;
  const th = tooltip.offsetHeight;
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  let left = x + 14;
  let top = y - 10;
  if (left + tw > vw - 8) left = x - tw - 14;
  if (top + th > vh - 8) top = vh - th - 8;
  tooltip.style.left = `${left}px`;
  tooltip.style.top = `${top}px`;
}
