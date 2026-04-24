import * as d3 from 'd3';

import {
  charColor,
  fmt,
  fmtPct,
  hideTooltip,
  makeSvg,
  positionTooltip,
  showTooltip,
  svgDims,
} from '../shared/chart-helpers.js';

let resizeHandler = null;

function clampIndex(index, max) {
  if (!max) return 0;
  return Math.max(0, Math.min(index, max - 1));
}

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function renderTemplate(rootEl, pair) {
  const [cartmanStats, kyleStats] = pair.speakerStats;
  rootEl.innerHTML = `
    <section id="level-4-intro" class="level-shell">
      <div class="section-inner level-hero">
        <div class="level-hero__copy">
          <span class="level-hero__eyebrow">Level 4</span>
          <h1 class="level-hero__title">Cartman vs Kyle, In Conversation</h1>
          <p class="level-hero__lede">
            This level zooms in on <strong>Cartman</strong> and <strong>Kyle Broflovski</strong> to ask a narrower question:
            when they are effectively talking to each other, do they sound different? The chart uses short transcript
            windows to approximate shared scene context.
          </p>
        </div>
      </div>
    </section>

    <section id="level-4-dialogue" class="page-section" data-page="4">
      <div class="section-inner">
        <div class="section-header">
          <span class="section-num">01</span>
          <h2 class="section-title">What They Say To Each Other</h2>
          <p class="section-lede">
            The left bars show words Cartman uses at a higher rate in Cartman/Kyle context; the right side does the same for Kyle.
          </p>
        </div>

        <div class="pair-dialogue-layout split-panel--wide">
          <div class="pair-context-chart-card">
            <div class="chart-area chart-area--pair-dialogue" id="chart-l4-pair-words" aria-label="Diverging bar chart: Cartman vs Kyle pair-context words"></div>
            <div class="chart-note">
              Vocabulary here comes from short local transcript windows. It is a scene-like approximation, not a manually labeled scene dataset.
            </div>
            <div class="pair-context-summary" aria-label="Pair context summary">
              <p>
                Across <strong>${fmt(pair.pairContextLineCount)}</strong> pair-context lines,
                there were <strong>${fmt(pair.adjacentExchangeCount)}</strong> adjacent Cartman/Kyle exchanges
                spanning <strong>${fmt(pair.episodeCount)}</strong> episodes with exchanges.
                Within those windows, Cartman had <strong>${fmt(cartmanStats.pairContextWords)}</strong> words across
                <strong>${fmt(cartmanStats.pairContextLines)}</strong> lines, while Kyle had
                <strong>${fmt(kyleStats.pairContextWords)}</strong> words across
                <strong>${fmt(kyleStats.pairContextLines)}</strong> lines.
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  `;
}

function buildDisplayWords(pair) {
  const cartmanWords = pair.chartWords
    .filter((row) => row.dominantSpeaker === 'Cartman')
    .slice(0, 6);
  const kyleWords = pair.chartWords
    .filter((row) => row.dominantSpeaker === 'Kyle')
    .slice(0, 6);

  return [
    ...cartmanWords.map((row) => ({ ...row, rowSide: 'Cartman' })),
    ...kyleWords.map((row) => ({ ...row, rowSide: 'Kyle' })),
  ];
}

function drawPairWordsChart(pair) {
  const chartData = buildDisplayWords(pair);
  const container = d3.select('#chart-l4-pair-words');
  container.selectAll('*').remove();

  if (!chartData.length) {
    container.append('div')
      .attr('class', 'chart-loading')
      .text('No pair-specific words were available for this character pairing.');
    return;
  }

  const dims = svgDims('chart-l4-pair-words', {
    marginTop: 54,
    marginRight: 26,
    marginBottom: 36,
    marginLeft: 26,
  });
  const { svg, g } = makeSvg('chart-l4-pair-words', dims);

  const maxRate = d3.max(chartData, (row) => Math.max(row.cartmanRate, row.kyleRate)) || 0.01;
  const x = d3.scaleLinear()
    .domain([-maxRate, maxRate])
    .nice()
    .range([0, dims.innerW]);

  const y = d3.scaleBand()
    .domain(chartData.map((row) => row.word))
    .range([0, dims.innerH])
    .padding(0.26);

  const xAxis = d3.axisBottom(x)
    .tickValues(d3.ticks(-maxRate, maxRate, 6))
    .tickFormat((value) => fmtPct(Math.abs(value)));

  g.append('g')
    .attr('class', 'axis')
    .attr('transform', `translate(0,${dims.innerH})`)
    .call(xAxis)
    .call((axis) => axis.select('.domain').remove());

  g.append('line')
    .attr('class', 'pair-chart__midline')
    .attr('x1', x(0))
    .attr('x2', x(0))
    .attr('y1', 0)
    .attr('y2', dims.innerH)
    .attr('stroke', 'var(--color-border)')
    .attr('stroke-width', 1.5)
    .attr('stroke-dasharray', '4 4');

  g.append('text')
    .attr('class', 'pair-chart__heading')
    .attr('x', x(-maxRate / 2))
    .attr('y', -18)
    .attr('text-anchor', 'middle')
    .text('Cartman words');

  g.append('text')
    .attr('class', 'pair-chart__heading')
    .attr('x', x(maxRate / 2))
    .attr('y', -18)
    .attr('text-anchor', 'middle')
    .text('Kyle words');

  const rows = g.selectAll('.pair-chart__row')
    .data(chartData)
    .join('g')
    .attr('class', 'pair-chart__row')
    .attr('transform', (row) => `translate(0,${y(row.word)})`);

  rows.append('rect')
    .attr('class', 'pair-chart__bar pair-chart__bar--cartman')
    .attr('x', (row) => x(-row.cartmanRate))
    .attr('y', 0)
    .attr('width', (row) => Math.max(0, x(0) - x(-row.cartmanRate)))
    .attr('height', y.bandwidth())
    .attr('rx', 6)
    .attr('fill', charColor('Cartman'))
    .attr('opacity', (row) => (row.rowSide === 'Cartman' ? 0.95 : 0.35));

  rows.append('rect')
    .attr('class', 'pair-chart__bar pair-chart__bar--kyle')
    .attr('x', x(0))
    .attr('y', 0)
    .attr('width', (row) => Math.max(0, x(row.kyleRate) - x(0)))
    .attr('height', y.bandwidth())
    .attr('rx', 6)
    .attr('fill', charColor('Kyle'))
    .attr('opacity', (row) => (row.rowSide === 'Kyle' ? 0.95 : 0.35));

  rows.append('text')
    .attr('class', 'pair-chart__label')
    .attr('x', x(0))
    .attr('y', y.bandwidth() / 2)
    .attr('dy', '0.35em')
    .attr('text-anchor', 'middle')
    .attr('paint-order', 'stroke')
    .attr('stroke', 'var(--color-surface-raised)')
    .attr('stroke-width', 5)
    .text((row) => row.word);

  rows.append('rect')
    .attr('class', 'pair-chart__hit')
    .attr('x', 0)
    .attr('y', -2)
    .attr('width', dims.innerW)
    .attr('height', y.bandwidth() + 4)
    .attr('fill', 'transparent')
    .on('mouseenter', function onEnter(event, row) {
      showTooltip(`
        <strong>${escapeHtml(row.word)}</strong>
        <div class="t-row"><span class="t-label">Cartman</span><span class="t-val">${fmt(row.cartmanCount)} · ${fmtPct(row.cartmanRate)}</span></div>
        <div class="t-row"><span class="t-label">Kyle</span><span class="t-val">${fmt(row.kyleCount)} · ${fmtPct(row.kyleRate)}</span></div>
        <div class="t-row"><span class="t-label">Dominant</span><span class="t-val">${escapeHtml(row.dominantSpeaker)}</span></div>
      `, event);
    })
    .on('mousemove', positionTooltip)
    .on('mouseleave', hideTooltip);

  svg.append('text')
    .attr('class', 'pair-chart__caption')
    .attr('x', dims.W / 2)
    .attr('y', dims.H - 8)
    .attr('text-anchor', 'middle')
    .text('Rate within Cartman/Kyle pair-context words');
}

function renderEmpty(rootEl, message) {
  rootEl.innerHTML = `
    <section id="level-4-intro" class="level-shell">
      <div class="section-inner level-hero">
        <div class="level-hero__copy">
          <span class="level-hero__eyebrow">Level 4</span>
          <h1 class="level-hero__title">Pair Dialogue</h1>
          <p class="level-hero__lede">${escapeHtml(message)}</p>
        </div>
      </div>
    </section>
  `;
}

export const level4View = {
  id: 'level-4',
  label: 'Level 4: Pair Dialogue',
  shortLabel: 'Level 4',
  defaultSection: 'level-4-intro',
  sections: [
    { id: 'level-4-intro', label: 'Intro' },
    { id: 'level-4-dialogue', label: 'Dialogue' },
  ],
  async render(ctx) {
    const loaded = await ctx.loadLevelData('level-4');
    const pairData = loaded['pair-dialogue'];
    const pair = pairData?.pairs?.[0];

    if (!pair) {
      renderEmpty(ctx.container, 'The pair-dialogue dataset did not contain a Cartman/Kyle entry.');
      return;
    }

    renderTemplate(ctx.container, pair);
    drawPairWordsChart(pair);

    if (resizeHandler) {
      window.removeEventListener('resize', resizeHandler);
    }
    resizeHandler = () => drawPairWordsChart(pair);
    window.addEventListener('resize', resizeHandler);
  },
  destroy(ctx) {
    if (resizeHandler) {
      window.removeEventListener('resize', resizeHandler);
      resizeHandler = null;
    }
    hideTooltip();
    ctx.container.innerHTML = '';
  },
};
