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

// ── module state ──────────────────────────────────────────────────────────────
let resizeHandler       = null;
let removeTermListeners = null;
let removePairListeners = null;
let removeTimingListeners = null;
let latestTermAnalysis  = null;
let latestSearchQuery   = 'you guys';
let latestPair          = null;
let latestPairSelection = [];
let activeTimingChars   = [];
let activeTimingSeason  = '';

// ── utility ────────────────────────────────────────────────────────────────────
function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

// ── template ──────────────────────────────────────────────────────────────────
function renderTemplate(rootEl, pairsData, timingChars) {
  const [defaultA, defaultB] = pairsData.meta.defaultPair;

  // Unique sorted characters that appear in at least one precomputed pair
  const pairChars = [...new Set(pairsData.pairs.flatMap((p) => p.characters))].sort();

  const seasonOptions = Array.from({ length: 18 }, (_, i) =>
    `<option value="${i + 1}">Season ${i + 1}</option>`
  ).join('');

  const pairCharOptions = pairChars
    .map((c) => `<option value="${escapeHtml(c)}">${escapeHtml(c)}</option>`)
    .join('');

  const timingPills = timingChars
    .map(
      (c, i) =>
        `<button type="button" class="dialogue-pill l4-timing-pill${i < 6 ? ' active' : ''}" data-char="${escapeHtml(c)}">${escapeHtml(c)}</button>`
    )
    .join('');

  rootEl.innerHTML = `
    <section id="level-4-intro" class="level-shell">
      <div class="section-inner level-hero">
        <div class="level-hero__copy">
          <span class="level-hero__eyebrow">Level 4</span>
          <h1 class="level-hero__title">Pair Dialogue &amp; Phrase Evolution</h1>
          <p class="level-hero__lede">
            Select two characters to compare their conversation vocabulary, search for when words and phrases
            first appear, and explore where in episodes characters tend to speak.
          </p>
        </div>
      </div>
    </section>

    <section id="level-4-dialogue" class="page-section" data-page="4">
      <div class="section-inner">
        <div class="section-header">
          <span class="section-num">01</span>
          <h2 class="section-title">What They Say To Each Other</h2>
          <p class="section-lede" id="l4-pair-subtitle">
            Select two characters to compare their pair-context vocabulary.
          </p>
        </div>

        <div class="pair-selector-row">
          <label class="pair-selector-label" for="l4-char-a">Character A</label>
          <select id="l4-char-a" class="char-select pair-selector-select" aria-label="Character A">
            ${pairChars
              .map(
                (c) =>
                  `<option value="${escapeHtml(c)}"${c === defaultA ? ' selected' : ''}>${escapeHtml(c)}</option>`
              )
              .join('')}
          </select>
          <span class="pair-selector-vs" aria-hidden="true">vs</span>
          <select id="l4-char-b" class="char-select pair-selector-select" aria-label="Character B">
            ${pairChars
              .map(
                (c) =>
                  `<option value="${escapeHtml(c)}"${c === defaultB ? ' selected' : ''}>${escapeHtml(c)}</option>`
              )
              .join('')}
          </select>
          <label class="pair-selector-label" for="l4-char-b">Character B</label>
        </div>
        <p id="l4-pair-error" class="pair-selector-error" role="alert" aria-live="assertive"></p>

        <div class="pair-dialogue-layout split-panel--wide">
          <div class="pair-context-chart-card">
            <div
              class="chart-area chart-area--pair-dialogue"
              id="chart-l4-pair-words"
              aria-label="Diverging bar chart: character pair word rates"
            ></div>
            <div class="chart-note">
              Vocabulary counted from sliding 5-line transcript windows where both characters are active.
              Scene approximation — not manually labelled scenes.
            </div>
            <div class="pair-context-summary" id="l4-pair-stats" aria-live="polite"></div>
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

    <section id="level-4-timing" class="page-section" data-page="4">
      <div class="section-inner">
        <div class="section-header">
          <span class="section-num">03</span>
          <h2 class="section-title">When Do Characters Speak?</h2>
          <p class="section-lede">
            Each dot is one episode. Its horizontal position shows where in that episode the character
            tends to speak — left = early, right = late. The vertical tick marks the character's
            overall median across all shown episodes.
          </p>
        </div>

        <div class="timing-controls">
          <label class="pair-selector-label" for="l4-timing-season">Season</label>
          <select id="l4-timing-season" class="char-select" aria-label="Filter by season">
            <option value="">All Seasons</option>
            ${seasonOptions}
          </select>
        </div>

        <div class="dialogue-pill-row l4-timing-pill-row" aria-label="Toggle characters">
          ${timingPills}
        </div>

        <div
          class="chart-area chart-area--timing"
          id="chart-l4-timing"
          aria-label="Strip chart: character speaking position within episodes"
        ></div>
        <div class="chart-note">
          Each dot = one episode. X-axis = that character's median line position within the episode
          (0% = first line, 100% = last line). Vertical tick = overall median across all shown episodes.
          Toggle characters to compare.
        </div>
      </div>
    </section>

    <section id="level-4-kenny" class="page-section" data-page="4">
      <div class="section-inner">
        <div class="section-header">
          <span class="section-num">04</span>
          <h2 class="section-title">Kenny's Tragic Journey</h2>
          <p class="section-lede">
            Kenny is immortal and dies way too often. Explore when his iconic deaths occur and how they cluster across seasons.
          </p>
        </div>

        <div class="pair-context-chart-card">
          <div
            class="chart-area chart-area--kenny-deaths"
            id="chart-l4-kenny-deaths"
            aria-label="Bar chart: Kenny deaths by season"
          ></div>
          <div class="chart-note">
            Running count of episodes in which Kenny dies. The "Kenny dies" running gag was most frequent in early seasons.
          </div>
          <div class="kenny-stats" id="l4-kenny-stats" aria-live="polite"></div>
        </div>
      </div>
    </section>
  `;
}

// ── pair lookup ───────────────────────────────────────────────────────────────
function findPair(pairsData, charA, charB) {
  const key1 = `${charA}__${charB}`;
  const key2 = `${charB}__${charA}`;
  return pairsData.pairs.find((p) => p.pairKey === key1 || p.pairKey === key2) || null;
}

function syncPairSelectOptions(selA, selB) {
  const valueA = selA?.value || '';
  const valueB = selB?.value || '';

  Array.from(selA?.options || []).forEach((option) => {
    option.disabled = option.value === valueB && option.value !== valueA;
  });

  Array.from(selB?.options || []).forEach((option) => {
    option.disabled = option.value === valueA && option.value !== valueB;
  });
}

function setPairError(message) {
  const errorEl = document.getElementById('l4-pair-error');
  const selA = document.getElementById('l4-char-a');
  const selB = document.getElementById('l4-char-b');
  const hasError = Boolean(message);

  if (errorEl) errorEl.textContent = message || '';
  if (selA) {
    selA.setCustomValidity(message || '');
    selA.setAttribute('aria-invalid', hasError ? 'true' : 'false');
  }
  if (selB) {
    selB.setCustomValidity(message || '');
    selB.setAttribute('aria-invalid', hasError ? 'true' : 'false');
  }
}

function restorePairSelection(charA, charB) {
  const selA = document.getElementById('l4-char-a');
  const selB = document.getElementById('l4-char-b');
  if (!selA || !selB) return;

  selA.value = charA;
  selB.value = charB;
  syncPairSelectOptions(selA, selB);
}

// ── pair chart ────────────────────────────────────────────────────────────────
function renderPairStats(pair) {
  const statsEl    = document.getElementById('l4-pair-stats');
  const subtitleEl = document.getElementById('l4-pair-subtitle');
  if (!pair) return;
  const [statsA, statsB] = pair.speakerStats;
  const [charA, charB]   = pair.characters;
  if (subtitleEl) {
    subtitleEl.innerHTML = `Words <strong>${escapeHtml(charA)}</strong> and <strong>${escapeHtml(charB)}</strong> use more around each other vs their overall speech.`;
  }
  if (statsEl) {
    statsEl.innerHTML = `<p>
      Across <strong>${fmt(pair.pairContextLineCount)}</strong> pair-context lines,
      there were <strong>${fmt(pair.adjacentExchangeCount)}</strong> adjacent exchanges
      spanning <strong>${fmt(pair.episodeCount)}</strong> episodes.
      ${escapeHtml(charA)} had <strong>${fmt(statsA.pairContextWords)}</strong> words
      across <strong>${fmt(statsA.pairContextLines)}</strong> lines;
      ${escapeHtml(charB)} had <strong>${fmt(statsB.pairContextWords)}</strong> words
      across <strong>${fmt(statsB.pairContextLines)}</strong> lines.
    </p>`;
  }
}

function buildDisplayWords(pair) {
  const [charA, charB] = pair.characters;
  return [
    ...pair.chartWords.filter((r) => r.dominantSpeaker === charA).slice(0, 6).map((r) => ({ ...r, rowSide: charA })),
    ...pair.chartWords.filter((r) => r.dominantSpeaker === charB).slice(0, 6).map((r) => ({ ...r, rowSide: charB })),
  ];
}

function drawPairWordsChart(pair) {
  const [charA, charB] = pair.characters;
  const chartData      = buildDisplayWords(pair);
  const container      = d3.select('#chart-l4-pair-words');
  container.selectAll('*').remove();

  if (!chartData.length) {
    container.append('div').attr('class', 'chart-loading')
      .text('Not enough shared vocabulary to display for this pair.');
    return;
  }

  const dims = svgDims('chart-l4-pair-words', {
    marginTop: 54, marginRight: 26, marginBottom: 36, marginLeft: 26,
  });
  const { svg, g } = makeSvg('chart-l4-pair-words', dims);

  const maxRate = d3.max(chartData, (r) => Math.max(r.charARate, r.charBRate)) || 0.01;
  const x = d3.scaleLinear().domain([-maxRate, maxRate]).nice().range([0, dims.innerW]);
  const y = d3.scaleBand().domain(chartData.map((r) => r.word)).range([0, dims.innerH]).padding(0.26);

  g.append('g')
    .attr('class', 'axis')
    .attr('transform', `translate(0,${dims.innerH})`)
    .call(
      d3.axisBottom(x)
        .tickValues(d3.ticks(-maxRate, maxRate, 6))
        .tickFormat((v) => fmtPct(Math.abs(v)))
    )
    .call((axis) => axis.select('.domain').remove());

  // Centre divider
  g.append('line')
    .attr('x1', x(0)).attr('x2', x(0)).attr('y1', 0).attr('y2', dims.innerH)
    .attr('stroke', 'var(--color-border)').attr('stroke-width', 1.5).attr('stroke-dasharray', '4 4');

  g.append('text').attr('class', 'pair-chart__heading')
    .attr('x', x(-maxRate / 2)).attr('y', -18).attr('text-anchor', 'middle')
    .text(`${charA} words`);
  g.append('text').attr('class', 'pair-chart__heading')
    .attr('x', x(maxRate / 2)).attr('y', -18).attr('text-anchor', 'middle')
    .text(`${charB} words`);

  const rows = g.selectAll('.pair-chart__row')
    .data(chartData)
    .join('g')
    .attr('class', 'pair-chart__row')
    .attr('transform', (r) => `translate(0,${y(r.word)})`);

  // charA bar (extends left)
  rows.append('rect')
    .attr('x', (r) => x(-r.charARate))
    .attr('y', 0)
    .attr('width', (r) => Math.max(0, x(0) - x(-r.charARate)))
    .attr('height', y.bandwidth())
    .attr('rx', 6)
    .attr('fill', charColor(charA))
    .attr('opacity', (r) => (r.rowSide === charA ? 0.95 : 0.35));

  // charB bar (extends right)
  rows.append('rect')
    .attr('x', x(0))
    .attr('y', 0)
    .attr('width', (r) => Math.max(0, x(r.charBRate) - x(0)))
    .attr('height', y.bandwidth())
    .attr('rx', 6)
    .attr('fill', charColor(charB))
    .attr('opacity', (r) => (r.rowSide === charB ? 0.95 : 0.35));

  // Word label centred on divider
  rows.append('text')
    .attr('class', 'pair-chart__label')
    .attr('x', x(0)).attr('y', y.bandwidth() / 2).attr('dy', '0.35em')
    .attr('text-anchor', 'middle')
    .attr('paint-order', 'stroke')
    .attr('stroke', 'var(--color-surface-raised)').attr('stroke-width', 5)
    .text((r) => r.word);

  // Transparent hit area for tooltip
  rows.append('rect')
    .attr('x', 0).attr('y', -2)
    .attr('width', dims.innerW).attr('height', y.bandwidth() + 4)
    .attr('fill', 'transparent')
    .on('mouseenter', (event, r) => {
      showTooltip(`
        <strong>${escapeHtml(r.word)}</strong>
        <div class="t-row"><span class="t-label">${escapeHtml(charA)}</span><span class="t-val">${fmt(r.charACount)} · ${fmtPct(r.charARate)}</span></div>
        <div class="t-row"><span class="t-label">${escapeHtml(charB)}</span><span class="t-val">${fmt(r.charBCount)} · ${fmtPct(r.charBRate)}</span></div>
        <div class="t-row"><span class="t-label">Dominant</span><span class="t-val">${escapeHtml(r.dominantSpeaker)}</span></div>
      `, event);
    })
    .on('mousemove', positionTooltip)
    .on('mouseleave', hideTooltip);

  svg.append('text').attr('class', 'pair-chart__caption')
    .attr('x', dims.W / 2).attr('y', dims.H - 8).attr('text-anchor', 'middle')
    .text(`Rate within ${charA}/${charB} pair-context words`);
}

function activatePair(pair) {
  latestPair = pair;
  latestPairSelection = pair?.characters ? [...pair.characters] : [];
  renderPairStats(pair);
  drawPairWordsChart(pair);
}

// ── pair selector wiring ──────────────────────────────────────────────────────
function wirePairSelector(pairsData) {
  const selA = document.getElementById('l4-char-a');
  const selB = document.getElementById('l4-char-b');
  if (!selA || !selB) return () => {};

  syncPairSelectOptions(selA, selB);

  const onChange = () => {
    const charA = selA.value;
    const charB = selB.value;
    if (charA === charB) {
      setPairError('Select two different characters.');
      if (latestPairSelection.length === 2) {
        restorePairSelection(latestPairSelection[0], latestPairSelection[1]);
        const pair = findPair(pairsData, latestPairSelection[0], latestPairSelection[1]);
        if (pair) activatePair(pair);
      }
      return;
    }

    setPairError('');
    const pair = findPair(pairsData, charA, charB);
    if (pair) {
      activatePair(pair);
    } else {
      const statsEl    = document.getElementById('l4-pair-stats');
      const subtitleEl = document.getElementById('l4-pair-subtitle');
      if (subtitleEl) subtitleEl.innerHTML = `<strong>${escapeHtml(charA)}</strong> vs <strong>${escapeHtml(charB)}</strong>`;
      if (statsEl) {
        statsEl.innerHTML = `<p>This pair hasn't been precomputed. Available pairs: Cartman/Kyle, Cartman/Stan, Kyle/Stan, Butters/Cartman, and the four main boys with Kenny.</p>`;
      }
      d3.select('#chart-l4-pair-words').selectAll('*').remove();
    }

    syncPairSelectOptions(selA, selB);
  };

  selA.addEventListener('change', onChange);
  selB.addEventListener('change', onChange);
  return () => {
    selA.removeEventListener('change', onChange);
    selB.removeEventListener('change', onChange);
  };
}

// ── term search (unchanged logic) ────────────────────────────────────────────
function normalizeTerm(value) {
  return String(value || '').trim().toLowerCase().replace(/\s+/g, ' ');
}

function analyzeTermUsage(characterText, query) {
  const normalizedQuery = normalizeTerm(query);
  const isPhrase        = normalizedQuery.includes(' ');
  const key             = isPhrase ? 'phrase' : 'word';
  const collection      = isPhrase ? 'topPhrases' : 'topWords';

  const seasons          = new Set();
  const totalsBySeason   = new Map();
  const totalsBySpeaker  = new Map();

  characterText.forEach((characterEntry) => {
    let speakerTotal = 0;
    (characterEntry.seasonText || []).forEach((seasonEntry) => {
      seasons.add(seasonEntry.season);
      const rows  = seasonEntry[collection] || [];
      const match = rows.find((row) => normalizeTerm(row[key]) === normalizedQuery);
      const count = match?.count || 0;
      if (!count) return;
      totalsBySeason.set(seasonEntry.season, (totalsBySeason.get(seasonEntry.season) || 0) + count);
      speakerTotal += count;
    });
    if (speakerTotal > 0) totalsBySpeaker.set(characterEntry.character, speakerTotal);
  });

  const sortedSeasons  = Array.from(seasons).sort((a, b) => a - b);
  const timeline       = sortedSeasons.map((season) => ({ season, count: totalsBySeason.get(season) || 0 }));
  const activeEntries  = timeline.filter((e) => e.count > 0);
  const firstUse       = activeEntries[0] || null;
  const lastUse        = activeEntries[activeEntries.length - 1] || null;
  const peak           = activeEntries.length
    ? activeEntries.reduce((best, cur) => (cur.count > best.count ? cur : best), activeEntries[0])
    : null;
  const totalCount     = activeEntries.reduce((sum, e) => sum + e.count, 0);

  let fadeAfterSeason = null;
  if (lastUse) {
    const lastIdx  = timeline.findIndex((e) => e.season === lastUse.season);
    const trailing = timeline.slice(lastIdx + 1);
    if (trailing.length && trailing.every((e) => e.count === 0)) {
      fadeAfterSeason = lastUse.season;
    }
  }

  const topSpeakers = Array.from(totalsBySpeaker, ([character, count]) => ({
    character,
    count,
    share: totalCount > 0 ? count / totalCount : 0,
  })).sort((a, b) => d3.descending(a.count, b.count));

  return { query: normalizedQuery, isPhrase, key, timeline, totalCount, firstUse, lastUse, peak, fadeAfterSeason, topSpeakers };
}

function renderTermMetrics(analysis) {
  const hitCountEl = document.getElementById('l4-term-hit-count');
  const kindEl     = document.getElementById('l4-term-kind');
  const firstUseEl = document.getElementById('l4-term-first-use');
  const lastUseEl  = document.getElementById('l4-term-last-use');
  const fadeEl     = document.getElementById('l4-term-fade');
  const peakEl     = document.getElementById('l4-term-peak');
  if (!hitCountEl) return;

  if (!analysis.totalCount) {
    hitCountEl.textContent = '0 hits';
    kindEl.textContent     = `No ${analysis.isPhrase ? 'phrase' : 'word'} matches for "${analysis.query}" in seasonal top lists.`;
    firstUseEl.textContent = 'No first use found';
    lastUseEl.textContent  = 'Try another spelling or a shorter phrase.';
    fadeEl.textContent     = 'No fade-out signal';
    peakEl.textContent     = 'No seasonal peak';
    return;
  }

  hitCountEl.textContent = `${fmt(analysis.totalCount)} hits`;
  kindEl.textContent     = `${analysis.isPhrase ? 'Phrase' : 'Word'} match: "${analysis.query}"`;
  firstUseEl.textContent = `First used in Season ${analysis.firstUse?.season}`;
  lastUseEl.textContent  = `Last active season: ${analysis.lastUse?.season}`;
  fadeEl.textContent     = analysis.fadeAfterSeason
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
    container.append('div').attr('class', 'chart-loading').text('No season coverage for timeline.');
    return;
  }

  const dims = svgDims('chart-l4-term-timeline', { marginTop: 26, marginRight: 26, marginBottom: 44, marginLeft: 44 });
  const { svg, g } = makeSvg('chart-l4-term-timeline', dims);

  const x = d3.scaleLinear().domain(d3.extent(analysis.timeline, (r) => r.season)).range([0, dims.innerW]);
  const y = d3.scaleLinear().domain([0, d3.max(analysis.timeline, (r) => r.count) || 1]).nice().range([dims.innerH, 0]);

  const area = d3.area().x((r) => x(r.season)).y0(y(0)).y1((r) => y(r.count)).curve(d3.curveMonotoneX);
  const line = d3.line().x((r) => x(r.season)).y((r) => y(r.count)).curve(d3.curveMonotoneX);

  g.append('g').attr('class', 'axis').attr('transform', `translate(0,${dims.innerH})`)
    .call(d3.axisBottom(x).ticks(Math.min(analysis.timeline.length, 10)).tickFormat(d3.format('d')))
    .call((a) => a.select('.domain').remove());
  g.append('g').attr('class', 'axis')
    .call(d3.axisLeft(y).ticks(5).tickFormat(d3.format('d')))
    .call((a) => a.select('.domain').remove());

  g.append('path').datum(analysis.timeline).attr('class', 'l4-term-line-area').attr('d', area)
    .attr('fill', 'color-mix(in srgb, var(--color-primary) 24%, transparent)');
  g.append('path').datum(analysis.timeline).attr('class', 'l4-term-line').attr('d', line)
    .attr('fill', 'none').attr('stroke', 'var(--color-primary)').attr('stroke-width', 2.5);

  if (analysis.firstUse) {
    g.append('line').attr('class', 'l4-term-marker')
      .attr('x1', x(analysis.firstUse.season)).attr('x2', x(analysis.firstUse.season))
      .attr('y1', 0).attr('y2', dims.innerH)
      .attr('stroke', 'var(--char-kyle)').attr('stroke-dasharray', '4 4');
  }
  if (analysis.fadeAfterSeason) {
    g.append('line').attr('class', 'l4-term-marker')
      .attr('x1', x(analysis.fadeAfterSeason)).attr('x2', x(analysis.fadeAfterSeason))
      .attr('y1', 0).attr('y2', dims.innerH)
      .attr('stroke', 'var(--char-cartman)').attr('stroke-dasharray', '5 5');
  }

  g.selectAll('.l4-term-dot').data(analysis.timeline).join('circle')
    .attr('class', 'l4-term-dot')
    .attr('cx', (r) => x(r.season)).attr('cy', (r) => y(r.count)).attr('r', 4)
    .attr('fill', (r) => (r.count > 0 ? 'var(--color-primary)' : 'var(--color-border)'))
    .on('mouseenter', (event, r) => {
      showTooltip(`
        <strong>Season ${r.season}</strong>
        <div class="t-row"><span class="t-label">${escapeHtml(analysis.key)}</span><span class="t-val">${escapeHtml(analysis.query)}</span></div>
        <div class="t-row"><span class="t-label">Count</span><span class="t-val">${fmt(r.count)}</span></div>
      `, event);
    })
    .on('mousemove', positionTooltip)
    .on('mouseleave', hideTooltip);

  svg.append('text').attr('class', 'pair-chart__caption')
    .attr('x', dims.W / 2).attr('y', dims.H - 8).attr('text-anchor', 'middle')
    .text('Seasonal frequency of the searched term');
}

function drawTermSpeakersChart(analysis) {
  const container = d3.select('#chart-l4-term-speakers');
  container.selectAll('*').remove();

  const speakerRows = analysis.topSpeakers.slice(0, 8);
  if (!speakerRows.length) {
    container.append('div').attr('class', 'chart-loading').text('No characters matched that term.');
    return;
  }

  const dims = svgDims('chart-l4-term-speakers', { marginTop: 20, marginRight: 26, marginBottom: 30, marginLeft: 146 });
  const { svg, g } = makeSvg('chart-l4-term-speakers', dims);

  const x = d3.scaleLinear().domain([0, d3.max(speakerRows, (r) => r.count) || 1]).nice().range([0, dims.innerW]);
  const y = d3.scaleBand().domain(speakerRows.map((r) => r.character)).range([0, dims.innerH]).padding(0.24);

  g.append('g').attr('class', 'axis').attr('transform', `translate(0,${dims.innerH})`)
    .call(d3.axisBottom(x).ticks(5).tickFormat(d3.format('d')))
    .call((a) => a.select('.domain').remove());
  g.append('g').attr('class', 'axis')
    .call(d3.axisLeft(y))
    .call((a) => a.select('.domain').remove());

  g.selectAll('.l4-term-speaker-bar').data(speakerRows).join('rect')
    .attr('class', 'l4-term-speaker-bar')
    .attr('x', 0).attr('y', (r) => y(r.character))
    .attr('height', y.bandwidth()).attr('width', (r) => x(r.count))
    .attr('fill', (r) => charColor(r.character)).attr('opacity', 0.85)
    .on('mouseenter', (event, r) => {
      showTooltip(`
        <strong>${escapeHtml(r.character)}</strong>
        <div class="t-row"><span class="t-label">Count</span><span class="t-val">${fmt(r.count)}</span></div>
        <div class="t-row"><span class="t-label">Share</span><span class="t-val">${fmtPct(r.share)}</span></div>
      `, event);
    })
    .on('mousemove', positionTooltip)
    .on('mouseleave', hideTooltip);

  g.selectAll('.l4-term-speaker-label').data(speakerRows).join('text')
    .attr('class', 'l4-term-speaker-label')
    .attr('x', (r) => Math.min(x(r.count) + 8, dims.innerW - 6))
    .attr('y', (r) => (y(r.character) || 0) + y.bandwidth() / 2)
    .attr('dy', '0.35em').attr('fill', 'var(--color-text-muted)').attr('font-size', 11)
    .text((r) => `${fmt(r.count)} (${fmtPct(r.share)})`);

  svg.append('text').attr('class', 'pair-chart__caption')
    .attr('x', dims.W / 2).attr('y', dims.H - 6).attr('text-anchor', 'middle')
    .text('Who says it most often');
}

function renderTermAnalysis(characterText, query) {
  const analysis  = analyzeTermUsage(characterText, query);
  latestSearchQuery  = query;
  latestTermAnalysis = analysis;
  renderTermMetrics(analysis);
  drawTermTimelineChart(analysis);
  drawTermSpeakersChart(analysis);
}

function wireTermSearch(characterText) {
  const form  = document.getElementById('l4-term-form');
  const input = document.getElementById('l4-term-input');
  const pills = Array.from(document.querySelectorAll('.l4-term-pill'));
  if (!form || !input) return () => {};

  const runSearch = (rawValue) => {
    const normalized = normalizeTerm(rawValue);
    if (!normalized) return;
    input.value = normalized;
    renderTermAnalysis(characterText, normalized);
  };

  const onSubmit = (event) => { event.preventDefault(); runSearch(input.value); };
  form.addEventListener('submit', onSubmit);

  const pillCleanups = pills.map((pill) => {
    const onClick = () => runSearch(pill.dataset.term || '');
    pill.addEventListener('click', onClick);
    return () => pill.removeEventListener('click', onClick);
  });

  return () => {
    form.removeEventListener('submit', onSubmit);
    pillCleanups.forEach((fn) => fn());
  };
}

// ── timing chart ──────────────────────────────────────────────────────────────
function drawTimingChart(timingData, chars, season) {
  const container = d3.select('#chart-l4-timing');
  container.selectAll('*').remove();

  if (!chars.length) {
    container.append('div').attr('class', 'chart-loading').text('Select at least one character above.');
    return;
  }

  const ROW_H = 44;
  const totalH = chars.length * ROW_H + 80;
  const el = document.getElementById('chart-l4-timing');
  if (el) el.style.minHeight = `${totalH}px`;

  const dims = svgDims('chart-l4-timing', { marginTop: 30, marginRight: 30, marginBottom: 50, marginLeft: 130 });
  const svgH = chars.length * ROW_H + dims.marginTop + dims.marginBottom;

  container.selectAll('svg').remove();
  const svg = container.append('svg')
    .attr('width', dims.W).attr('height', svgH)
    .attr('viewBox', `0 0 ${dims.W} ${svgH}`)
    .attr('style', 'overflow: visible;');
  const g = svg.append('g').attr('transform', `translate(${dims.marginLeft},${dims.marginTop})`);
  const innerW = dims.W - dims.marginLeft - dims.marginRight;
  const innerH = chars.length * ROW_H;

  const x = d3.scaleLinear().domain([0, 1]).range([0, innerW]);

  // Grid
  g.append('g').attr('class', 'grid').attr('transform', `translate(0,${innerH})`)
    .call(d3.axisBottom(x).ticks(5).tickSize(-innerH).tickFormat(''));

  // X axis with start/end labels replacing 0% and 100%
  g.append('g').attr('class', 'axis').attr('transform', `translate(0,${innerH})`)
    .call(
      d3.axisBottom(x).ticks(5).tickFormat((v) => {
        if (v === 0) return 'Episode Start';
        if (v === 1) return 'Episode End';
        return d3.format('.0%')(v);
      })
    );

  chars.forEach((char, i) => {
    const charData = timingData.data[char];
    if (!charData) return;

    const episodes = season
      ? charData.byEpisode.filter((ep) => String(ep.season) === String(season))
      : charData.byEpisode;

    const cy  = i * ROW_H + ROW_H / 2;
    const col = charColor(char);
    const spread = ROW_H * 0.38;

    // Character label
    g.append('text')
      .attr('x', -8).attr('y', cy + 4)
      .attr('text-anchor', 'end').attr('font-size', 11)
      .attr('fill', 'var(--color-text)')
      .text(char);

    if (!episodes.length) return;

    // Dots — sorted by medianPosition, jitter within row to reduce overplotting
    const sorted = [...episodes].sort((a, b) => a.medianPosition - b.medianPosition);
    sorted.forEach((ep, di) => {
      const jitter = ((di % 5) - 2) * (spread / 4.5);
      g.append('circle')
        .attr('cx', x(ep.medianPosition))
        .attr('cy', cy + jitter)
        .attr('r', 3.5)
        .attr('fill', col)
        .attr('opacity', 0.5)
        .on('mouseenter', (event) => {
          showTooltip(`
            <strong>${escapeHtml(char)}</strong>
            <div class="t-row"><span class="t-label">Episode</span><span class="t-val">S${ep.season}E${ep.episode}</span></div>
            <div class="t-row"><span class="t-label">Median position</span><span class="t-val">${d3.format('.0%')(ep.medianPosition)}</span></div>
            <div class="t-row"><span class="t-label">Lines in episode</span><span class="t-val">${ep.lineCount}</span></div>
          `, event);
        })
        .on('mousemove', positionTooltip)
        .on('mouseleave', hideTooltip);
    });

    // Overall median tick for this character (across shown episodes)
    const overallMedian = d3.median(episodes, (ep) => ep.medianPosition);
    if (overallMedian != null) {
      g.append('line')
        .attr('x1', x(overallMedian)).attr('x2', x(overallMedian))
        .attr('y1', cy - ROW_H * 0.32).attr('y2', cy + ROW_H * 0.32)
        .attr('stroke', col).attr('stroke-width', 2.5).attr('opacity', 0.9);
    }
  });
}

function wireTimingControls(timingData) {
  const pills     = Array.from(document.querySelectorAll('.l4-timing-pill'));
  const seasonSel = document.getElementById('l4-timing-season');
  if (!pills.length || !seasonSel) return () => {};

  const redraw = () => drawTimingChart(timingData, activeTimingChars, activeTimingSeason);

  const onPillClick = function onPillClick() {
    this.classList.toggle('active');
    activeTimingChars = pills.filter((p) => p.classList.contains('active')).map((p) => p.dataset.char);
    redraw();
  };

  const onSeasonChange = () => {
    activeTimingSeason = seasonSel.value;
    redraw();
  };

  pills.forEach((p) => p.addEventListener('click', onPillClick));
  seasonSel.addEventListener('change', onSeasonChange);

  return () => {
    pills.forEach((p) => p.removeEventListener('click', onPillClick));
    seasonSel.removeEventListener('change', onSeasonChange);
  };
}

// ── empty fallback ─────────────────────────────────────────────────────────────
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

// ── kenny deaths chart ────────────────────────────────────────────────────────
function renderKennyStats(kennyData) {
  const statsEl = document.getElementById('l4-kenny-stats');
  if (!statsEl || !kennyData?.deaths?.length) return;

  const totalDeaths = kennyData.deaths.reduce((sum, d) => sum + d.count, 0);
  const avgDeaths = (totalDeaths / kennyData.deaths.length).toFixed(1);
  const peakSeason = kennyData.deaths.reduce((best, cur) => (cur.count > best.count ? cur : best), kennyData.deaths[0]);
  const episodesWithDeaths = kennyData.deaths.filter((d) => d.count > 0).length;

  statsEl.innerHTML = `
    <p>
      Across <strong>${fmt(kennyData.deaths.length)}</strong> seasons, Kenny died in episodes a total of
      <strong>${fmt(totalDeaths)}</strong> times, averaging <strong>${avgDeaths}</strong> deaths per season.
      His deadliest season was <strong>Season ${peakSeason.season}</strong> with <strong>${peakSeason.count}</strong> deaths.
      Kenny stays alive in the later seasons, probably to not use the joke too much. If you would like another view, look at this <a href="https://www.reddit.com/r/dataisbeautiful/comments/ileivk/all_the_times_they_killed_kenny_in_south_park_you/#lightbox" target="_blank" rel="noopener noreferrer">Reddit thread</a>.
    </p>
  `;
}

function drawKennyDeathsChart(kennyData) {
  const container = d3.select('#chart-l4-kenny-deaths');
  container.selectAll('*').remove();

  if (!kennyData?.deaths?.length) {
    container.append('div').attr('class', 'chart-loading').text('Kenny deaths data not available.');
    return;
  }

  const dims = svgDims('chart-l4-kenny-deaths', {
    marginTop: 26, marginRight: 26, marginBottom: 44, marginLeft: 44,
  });
  const { svg, g } = makeSvg('chart-l4-kenny-deaths', dims);

  const x = d3.scaleLinear().domain(d3.extent(kennyData.deaths, (d) => d.season)).range([0, dims.innerW]);
  const y = d3.scaleLinear().domain([0, d3.max(kennyData.deaths, (d) => d.count) || 1]).nice().range([dims.innerH, 0]);

  // Grid
  g.append('g').attr('class', 'grid').attr('transform', `translate(0,${dims.innerH})`)
    .call(d3.axisBottom(x).tickValues([1, 5, 10, 15, 20, 21]).tickSize(-dims.innerH).tickFormat(''));

  // X axis
  g.append('g').attr('class', 'axis').attr('transform', `translate(0,${dims.innerH})`)
    .call(d3.axisBottom(x).tickValues([1, 5, 10, 15, 20, 21]).tickFormat(d3.format('d')))
    .call((a) => a.select('.domain').remove());

  // Y axis
  g.append('g').attr('class', 'axis')
    .call(d3.axisLeft(y).ticks(5).tickFormat(d3.format('d')))
    .call((a) => a.select('.domain').remove());

  // Bars
  g.selectAll('.kenny-bar').data(kennyData.deaths).join('rect')
    .attr('class', 'kenny-bar')
    .attr('x', (d) => x(d.season) - 8)
    .attr('y', (d) => y(d.count))
    .attr('width', 16)
    .attr('height', (d) => dims.innerH - y(d.count))
    .attr('fill', (d) => d.count > 0 ? '#D4AF37' : 'var(--color-border)')
    .attr('opacity', (d) => d.count > 0 ? 0.85 : 0.4)
    .on('mouseenter', (event, d) => {
      showTooltip(`
        <strong>Season ${d.season}</strong>
        <div class="t-row"><span class="t-label">Deaths</span><span class="t-val">${fmt(d.count)}</span></div>
      `, event);
    })
    .on('mousemove', positionTooltip)
    .on('mouseleave', hideTooltip);

  svg.append('text').attr('class', 'pair-chart__caption')
    .attr('x', dims.W / 2).attr('y', dims.H - 8).attr('text-anchor', 'middle')
    .text('Number of episodes in which Kenny dies');
}


// ── export ────────────────────────────────────────────────────────────────────
export const level4View = {
  id:             'level-4',
  label:          'Level 4: Pair Dialogue',
  shortLabel:     'Level 4',
  defaultSection: 'level-4-intro',
  sections: [
    { id: 'level-4-intro',       label: 'Intro' },
    { id: 'level-4-dialogue',    label: 'Dialogue' },
    { id: 'level-4-term-search', label: 'Search' },
    { id: 'level-4-timing',      label: 'Speaker Timing' },
    { id: 'level-4-kenny',       label: "Kenny's Deaths" },
  ],

  async render(ctx) {
    const loaded        = await ctx.loadLevelData('level-4');
    const pairsData     = loaded['pair-dialogue'];
    const characterText = loaded['character-text'];
    const timingData    = loaded['episode-timing'];
    const kennyData     = loaded['kenny-deaths'];

    if (!pairsData?.pairs?.length || !Array.isArray(characterText) || !timingData) {
      renderEmpty(ctx.container, 'Failed to load Level 4 data.');
      return;
    }

    renderTemplate(ctx.container, pairsData, timingData.characters);

    // Restore last pair or fall back to default
    const defaultKey  = pairsData.meta.defaultPair.join('__');
    const initialPair =
      (latestPair && pairsData.pairs.find((p) => p.pairKey === latestPair.pairKey)) ||
      pairsData.pairs.find((p) => p.pairKey === defaultKey) ||
      pairsData.pairs[0];

    activatePair(initialPair);

    // Sync selects to match the actual displayed pair
    const selA = document.getElementById('l4-char-a');
    const selB = document.getElementById('l4-char-b');
    if (selA && selB && initialPair) {
      selA.value = initialPair.characters[0];
      selB.value = initialPair.characters[1];
      syncPairSelectOptions(selA, selB);
    }

    renderTermAnalysis(characterText, latestSearchQuery);

    if (removeTermListeners) removeTermListeners();
    removeTermListeners = wireTermSearch(characterText);

    if (removePairListeners) removePairListeners();
    removePairListeners = wirePairSelector(pairsData);

    // Timing chart — restore active chars / season from module state if present
    if (!activeTimingChars.length) activeTimingChars = timingData.characters.slice(0, 6);
    drawTimingChart(timingData, activeTimingChars, activeTimingSeason);

    // Sync pill UI to match activeTimingChars
    document.querySelectorAll('.l4-timing-pill').forEach((pill) => {
      pill.classList.toggle('active', activeTimingChars.includes(pill.dataset.char));
    });

    if (removeTimingListeners) removeTimingListeners();
    removeTimingListeners = wireTimingControls(timingData);

    // Kenny deaths chart
    if (kennyData?.deaths?.length) {
      renderKennyStats(kennyData);
      drawKennyDeathsChart(kennyData);
    }

    if (resizeHandler) window.removeEventListener('resize', resizeHandler);
    resizeHandler = () => {
      if (latestPair) drawPairWordsChart(latestPair);
      if (latestTermAnalysis) {
        drawTermTimelineChart(latestTermAnalysis);
        drawTermSpeakersChart(latestTermAnalysis);
      }
      drawTimingChart(timingData, activeTimingChars, activeTimingSeason);
      if (kennyData?.deaths?.length) drawKennyDeathsChart(kennyData);
    };
    window.addEventListener('resize', resizeHandler);
  },

  destroy(ctx) {
    if (resizeHandler)        { window.removeEventListener('resize', resizeHandler); resizeHandler = null; }
    if (removeTermListeners)  { removeTermListeners();  removeTermListeners  = null; }
    if (removePairListeners)  { removePairListeners();  removePairListeners  = null; }
    if (removeTimingListeners){ removeTimingListeners(); removeTimingListeners = null; }
    latestTermAnalysis = null;
    hideTooltip();
    ctx.container.innerHTML = '';
  },
};
