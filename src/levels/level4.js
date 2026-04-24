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
let removeTermListeners = null;
let latestTermAnalysis = null;
let latestSearchQuery = 'you guys';

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

    <section id="level-4-term-search" class="page-section" data-page="4">
      <div class="section-inner">
        <div class="section-header">
          <span class="section-num">02</span>
          <h2 class="section-title">Track A Word Or Phrase Over Time</h2>
          <p class="section-lede">
            Search a word or short phrase to see when it first appears, how often it is used by season,
            and whether it disappears later in the run.
          </p>
        </div>

        <div class="pair-context-chart-card pair-context-chart-card--term-search">
          <form id="l4-term-form" class="search-row l4-term-form" role="search" aria-label="Search word or phrase timeline">
            <input
              id="l4-term-input"
              class="search-input"
              type="search"
              name="term"
              placeholder="Try: you guys, god damnit, cheesy poofs"
              value="you guys"
              autocomplete="off"
              aria-label="Search term"
            />
            <button type="submit" class="dialogue-nav__btn">Search</button>
          </form>

          <div class="dialogue-pill-row l4-term-pill-row" aria-label="Suggested searches">
            <button type="button" class="dialogue-pill l4-term-pill" data-term="you guys">you guys</button>
            <button type="button" class="dialogue-pill l4-term-pill" data-term="god damnit">god damnit</button>
            <button type="button" class="dialogue-pill l4-term-pill" data-term="cheesy poofs">cheesy poofs</button>
            <button type="button" class="dialogue-pill l4-term-pill" data-term="respect my authoritah">respect my authoritah</button>
          </div>

          <div class="pair-stats pair-stats--term" id="l4-term-metrics" aria-live="polite">
            <article class="pair-stat-card">
              <strong id="l4-term-hit-count">0 hits</strong>
              <p id="l4-term-kind">Waiting for search...</p>
            </article>
            <article class="pair-stat-card">
              <strong id="l4-term-first-use">No first use yet</strong>
              <p id="l4-term-last-use">Search to see first/last active seasons.</p>
            </article>
            <article class="pair-stat-card">
              <strong id="l4-term-fade">No fade-out signal</strong>
              <p id="l4-term-peak">Search to see peak usage season.</p>
            </article>
          </div>

          <div class="chart-area chart-area--term-timeline" id="chart-l4-term-timeline" aria-label="Timeline of searched term frequency by season"></div>
          <div class="chart-area chart-area--term-speakers" id="chart-l4-term-speakers" aria-label="Top characters using the searched term"></div>
          <div class="chart-note">
            Counts come from character-level seasonal top lists, so very low-frequency uses may be omitted.
          </div>
        </div>
      </div>
    </section>
  `;
}

function normalizeTerm(value) {
  return String(value || '').trim().toLowerCase().replace(/\s+/g, ' ');
}

function analyzeTermUsage(characterText, query) {
  const normalizedQuery = normalizeTerm(query);
  const isPhrase = normalizedQuery.includes(' ');
  const key = isPhrase ? 'phrase' : 'word';
  const collection = isPhrase ? 'topPhrases' : 'topWords';

  const seasons = new Set();
  const totalsBySeason = new Map();
  const totalsBySpeaker = new Map();

  characterText.forEach((characterEntry) => {
    let speakerTotal = 0;
    (characterEntry.seasonText || []).forEach((seasonEntry) => {
      seasons.add(seasonEntry.season);
      const rows = seasonEntry[collection] || [];
      const match = rows.find((row) => normalizeTerm(row[key]) === normalizedQuery);
      const count = match?.count || 0;
      if (!count) return;

      totalsBySeason.set(seasonEntry.season, (totalsBySeason.get(seasonEntry.season) || 0) + count);
      speakerTotal += count;
    });

    if (speakerTotal > 0) {
      totalsBySpeaker.set(characterEntry.character, speakerTotal);
    }
  });

  const sortedSeasons = Array.from(seasons).sort((a, b) => a - b);
  const timeline = sortedSeasons.map((season) => ({
    season,
    count: totalsBySeason.get(season) || 0,
  }));

  const activeEntries = timeline.filter((entry) => entry.count > 0);
  const firstUse = activeEntries[0] || null;
  const lastUse = activeEntries[activeEntries.length - 1] || null;
  const peak = activeEntries.length
    ? activeEntries.reduce((best, current) => (current.count > best.count ? current : best), activeEntries[0])
    : null;
  const totalCount = activeEntries.reduce((sum, entry) => sum + entry.count, 0);

  let fadeAfterSeason = null;
  if (lastUse) {
    const lastIndex = timeline.findIndex((entry) => entry.season === lastUse.season);
    const trailing = timeline.slice(lastIndex + 1);
    if (trailing.length && trailing.every((entry) => entry.count === 0)) {
      fadeAfterSeason = lastUse.season;
    }
  }

  const topSpeakers = Array.from(totalsBySpeaker, ([character, count]) => ({
    character,
    count,
    share: totalCount > 0 ? count / totalCount : 0,
  }))
    .sort((a, b) => d3.descending(a.count, b.count));

  return {
    query: normalizedQuery,
    isPhrase,
    key,
    timeline,
    totalCount,
    firstUse,
    lastUse,
    peak,
    fadeAfterSeason,
    topSpeakers,
  };
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

function renderTermMetrics(analysis) {
  const hitCountEl = document.getElementById('l4-term-hit-count');
  const kindEl = document.getElementById('l4-term-kind');
  const firstUseEl = document.getElementById('l4-term-first-use');
  const lastUseEl = document.getElementById('l4-term-last-use');
  const fadeEl = document.getElementById('l4-term-fade');
  const peakEl = document.getElementById('l4-term-peak');
  if (!hitCountEl || !kindEl || !firstUseEl || !lastUseEl || !fadeEl || !peakEl) return;

  if (!analysis.totalCount) {
    hitCountEl.textContent = '0 hits';
    kindEl.textContent = `No ${analysis.isPhrase ? 'phrase' : 'word'} matches found for "${analysis.query}" in seasonal top lists.`;
    firstUseEl.textContent = 'No first use found';
    lastUseEl.textContent = 'Try another spelling or a shorter phrase.';
    fadeEl.textContent = 'No fade-out signal';
    peakEl.textContent = 'No seasonal peak';
    return;
  }

  hitCountEl.textContent = `${fmt(analysis.totalCount)} hits`;
  kindEl.textContent = `${analysis.isPhrase ? 'Phrase' : 'Word'} match: "${analysis.query}"`;
  firstUseEl.textContent = `First used in Season ${analysis.firstUse?.season}`;
  lastUseEl.textContent = `Last active season: ${analysis.lastUse?.season}`;
  fadeEl.textContent = analysis.fadeAfterSeason
    ? `Drops to zero after Season ${analysis.fadeAfterSeason}`
    : 'No clear fade-out before final season';
  peakEl.textContent = analysis.peak
    ? `Peak usage: Season ${analysis.peak.season} (${fmt(analysis.peak.count)})`
    : 'No seasonal peak';
}

function drawTermTimelineChart(analysis) {
  const container = d3.select('#chart-l4-term-timeline');
  container.selectAll('*').remove();

  if (!analysis.timeline.length) {
    container.append('div')
      .attr('class', 'chart-loading')
      .text('No season coverage was available for timeline analysis.');
    return;
  }

  const dims = svgDims('chart-l4-term-timeline', {
    marginTop: 26,
    marginRight: 26,
    marginBottom: 44,
    marginLeft: 44,
  });
  const { svg, g } = makeSvg('chart-l4-term-timeline', dims);

  const seasonExtent = d3.extent(analysis.timeline, (row) => row.season);
  const x = d3.scaleLinear()
    .domain(seasonExtent)
    .range([0, dims.innerW]);
  const maxCount = d3.max(analysis.timeline, (row) => row.count) || 1;
  const y = d3.scaleLinear()
    .domain([0, maxCount])
    .nice()
    .range([dims.innerH, 0]);

  const area = d3.area()
    .x((row) => x(row.season))
    .y0(y(0))
    .y1((row) => y(row.count))
    .curve(d3.curveMonotoneX);

  const line = d3.line()
    .x((row) => x(row.season))
    .y((row) => y(row.count))
    .curve(d3.curveMonotoneX);

  g.append('g')
    .attr('class', 'axis')
    .attr('transform', `translate(0,${dims.innerH})`)
    .call(d3.axisBottom(x).ticks(Math.min(analysis.timeline.length, 10)).tickFormat(d3.format('d')))
    .call((axis) => axis.select('.domain').remove());

  g.append('g')
    .attr('class', 'axis')
    .call(d3.axisLeft(y).ticks(5).tickFormat(d3.format('d')))
    .call((axis) => axis.select('.domain').remove());

  g.append('path')
    .datum(analysis.timeline)
    .attr('class', 'l4-term-line-area')
    .attr('d', area)
    .attr('fill', 'color-mix(in srgb, var(--color-primary) 24%, transparent)');

  g.append('path')
    .datum(analysis.timeline)
    .attr('class', 'l4-term-line')
    .attr('d', line)
    .attr('fill', 'none')
    .attr('stroke', 'var(--color-primary)')
    .attr('stroke-width', 2.5);

  if (analysis.firstUse) {
    g.append('line')
      .attr('class', 'l4-term-marker')
      .attr('x1', x(analysis.firstUse.season))
      .attr('x2', x(analysis.firstUse.season))
      .attr('y1', 0)
      .attr('y2', dims.innerH)
      .attr('stroke', 'var(--char-kyle)')
      .attr('stroke-dasharray', '4 4');
  }

  if (analysis.fadeAfterSeason) {
    g.append('line')
      .attr('class', 'l4-term-marker')
      .attr('x1', x(analysis.fadeAfterSeason))
      .attr('x2', x(analysis.fadeAfterSeason))
      .attr('y1', 0)
      .attr('y2', dims.innerH)
      .attr('stroke', 'var(--char-cartman)')
      .attr('stroke-dasharray', '5 5');
  }

  g.selectAll('.l4-term-dot')
    .data(analysis.timeline)
    .join('circle')
    .attr('class', 'l4-term-dot')
    .attr('cx', (row) => x(row.season))
    .attr('cy', (row) => y(row.count))
    .attr('r', 4)
    .attr('fill', (row) => (row.count > 0 ? 'var(--color-primary)' : 'var(--color-border)'))
    .on('mouseenter', (event, row) => {
      showTooltip(`
        <strong>Season ${row.season}</strong>
        <div class="t-row"><span class="t-label">${escapeHtml(analysis.key)}</span><span class="t-val">${escapeHtml(analysis.query)}</span></div>
        <div class="t-row"><span class="t-label">Count</span><span class="t-val">${fmt(row.count)}</span></div>
      `, event);
    })
    .on('mousemove', positionTooltip)
    .on('mouseleave', hideTooltip);

  svg.append('text')
    .attr('class', 'pair-chart__caption')
    .attr('x', dims.W / 2)
    .attr('y', dims.H - 8)
    .attr('text-anchor', 'middle')
    .text('Seasonal frequency of the searched term');
}

function drawTermSpeakersChart(analysis) {
  const container = d3.select('#chart-l4-term-speakers');
  container.selectAll('*').remove();

  const speakerRows = analysis.topSpeakers.slice(0, 8);
  if (!speakerRows.length) {
    container.append('div')
      .attr('class', 'chart-loading')
      .text('No characters matched that term in the seasonal top lists.');
    return;
  }

  const dims = svgDims('chart-l4-term-speakers', {
    marginTop: 20,
    marginRight: 26,
    marginBottom: 30,
    marginLeft: 146,
  });
  const { svg, g } = makeSvg('chart-l4-term-speakers', dims);

  const x = d3.scaleLinear()
    .domain([0, d3.max(speakerRows, (row) => row.count) || 1])
    .nice()
    .range([0, dims.innerW]);
  const y = d3.scaleBand()
    .domain(speakerRows.map((row) => row.character))
    .range([0, dims.innerH])
    .padding(0.24);

  g.append('g')
    .attr('class', 'axis')
    .attr('transform', `translate(0,${dims.innerH})`)
    .call(d3.axisBottom(x).ticks(5).tickFormat(d3.format('d')))
    .call((axis) => axis.select('.domain').remove());

  g.append('g')
    .attr('class', 'axis')
    .call(d3.axisLeft(y))
    .call((axis) => axis.select('.domain').remove());

  g.selectAll('.l4-term-speaker-bar')
    .data(speakerRows)
    .join('rect')
    .attr('class', 'l4-term-speaker-bar')
    .attr('x', 0)
    .attr('y', (row) => y(row.character))
    .attr('height', y.bandwidth())
    .attr('width', (row) => x(row.count))
    .attr('fill', (row) => charColor(row.character))
    .attr('opacity', 0.85)
    .on('mouseenter', (event, row) => {
      showTooltip(`
        <strong>${escapeHtml(row.character)}</strong>
        <div class="t-row"><span class="t-label">Count</span><span class="t-val">${fmt(row.count)}</span></div>
        <div class="t-row"><span class="t-label">Share</span><span class="t-val">${fmtPct(row.share)}</span></div>
      `, event);
    })
    .on('mousemove', positionTooltip)
    .on('mouseleave', hideTooltip);

  g.selectAll('.l4-term-speaker-label')
    .data(speakerRows)
    .join('text')
    .attr('class', 'l4-term-speaker-label')
    .attr('x', (row) => Math.min(x(row.count) + 8, dims.innerW - 6))
    .attr('y', (row) => (y(row.character) || 0) + y.bandwidth() / 2)
    .attr('dy', '0.35em')
    .attr('fill', 'var(--color-text-muted)')
    .attr('font-size', 11)
    .text((row) => `${fmt(row.count)} (${fmtPct(row.share)})`);

  svg.append('text')
    .attr('class', 'pair-chart__caption')
    .attr('x', dims.W / 2)
    .attr('y', dims.H - 6)
    .attr('text-anchor', 'middle')
    .text('Who says it most often');
}

function renderTermAnalysis(characterText, query) {
  const analysis = analyzeTermUsage(characterText, query);
  latestSearchQuery = query;
  latestTermAnalysis = analysis;
  renderTermMetrics(analysis);
  drawTermTimelineChart(analysis);
  drawTermSpeakersChart(analysis);
}

function wireTermSearch(characterText) {
  const form = document.getElementById('l4-term-form');
  const input = document.getElementById('l4-term-input');
  const pills = Array.from(document.querySelectorAll('.l4-term-pill'));
  if (!form || !input) return () => {};

  const runSearch = (rawValue) => {
    const normalized = normalizeTerm(rawValue);
    if (!normalized) return;
    input.value = normalized;
    renderTermAnalysis(characterText, normalized);
  };

  const onSubmit = (event) => {
    event.preventDefault();
    runSearch(input.value);
  };
  form.addEventListener('submit', onSubmit);

  const pillCleanups = pills.map((pill) => {
    const onClick = () => runSearch(pill.dataset.term || '');
    pill.addEventListener('click', onClick);
    return () => pill.removeEventListener('click', onClick);
  });

  return () => {
    form.removeEventListener('submit', onSubmit);
    pillCleanups.forEach((cleanup) => cleanup());
  };
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
    { id: 'level-4-term-search', label: 'Search Term' },
  ],
  async render(ctx) {
    const loaded = await ctx.loadLevelData('level-4');
    const pairData = loaded['pair-dialogue'];
    const characterText = loaded['character-text'];
    const pair = pairData?.pairs?.[0];

    if (!pair || !Array.isArray(characterText)) {
      renderEmpty(ctx.container, 'The pair-dialogue dataset did not contain a Cartman/Kyle entry.');
      return;
    }

    renderTemplate(ctx.container, pair);
    drawPairWordsChart(pair);
    renderTermAnalysis(characterText, latestSearchQuery);
    if (removeTermListeners) {
      removeTermListeners();
    }
    removeTermListeners = wireTermSearch(characterText);

    if (resizeHandler) {
      window.removeEventListener('resize', resizeHandler);
    }
    resizeHandler = () => {
      drawPairWordsChart(pair);
      if (latestTermAnalysis) {
        drawTermTimelineChart(latestTermAnalysis);
        drawTermSpeakersChart(latestTermAnalysis);
      }
    };
    window.addEventListener('resize', resizeHandler);
  },
  destroy(ctx) {
    if (resizeHandler) {
      window.removeEventListener('resize', resizeHandler);
      resizeHandler = null;
    }
    if (removeTermListeners) {
      removeTermListeners();
      removeTermListeners = null;
    }
    latestTermAnalysis = null;
    hideTooltip();
    ctx.container.innerHTML = '';
  },
};
