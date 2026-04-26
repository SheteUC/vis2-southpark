import * as d3 from 'd3';

const CHAR_KEY_MAP = {
  cartman:  '--char-cartman',
  stan:     '--char-stan',
  kyle:     '--char-kyle',
  kenny:    '--char-kenny',
  butters:  '--char-butters',
  randy:    '--char-randy',
  wendy:    '--char-wendy',
  garrison: '--char-garrison',
};

function resolveCharColor(name) {
  const lower  = (name || '').toLowerCase();
  const key    = Object.keys(CHAR_KEY_MAP).find(k => lower.includes(k));
  const cssVar = key ? CHAR_KEY_MAP[key] : '--color-primary';
  return getComputedStyle(document.documentElement)
    .getPropertyValue(cssVar).trim() || '#1e4d8c';
}

const FILTERED_WORDS = new Set([
  // Contractions — positive form
  "i'm","i'll","i've","i'd",
  "you're","you'll","you've","you'd",
  "he's","he'll","he'd",
  "she's","she'll","she'd",
  "it's","it'll",
  "we're","we'll","we've","we'd",
  "they're","they'll","they've","they'd",
  "that's","that'll","that'd",
  "there's","there'll",
  "here's",
  "who's","who'll","who'd",
  "what's","what'll",
  "where's","when's","how's",
  "let's",
  // Negative contractions
  "don't","didn't","doesn't",
  "isn't","aren't","wasn't","weren't",
  "won't","wouldn't","can't","couldn't",
  "shouldn't","mustn't","needn't",
  "haven't","hasn't","hadn't","ain't",
  // Bare function words that sneak through
  "let","get","got","go","going","come","came",
  "gonna","gotta","wanna","wanta",
  "yeah","yep","nope","nah",
  "oh","uh","um","ah","er","eh",
  "ok","okay",
  "like","just","really","actually","maybe",
  "well","now","still","already","also","even",
  "back","up","down","out","off","way",
  "right","sure","mean","means","meant",
  "will","would","could","should","shall",
  "much","little","more","less","most","least",
  "thing","things","something","anything",
  "kind","sort","lot","lots","bit",
  "here","there","where","when","then",
  "away","around","again","together",
]);

/** Remove filtered words from a pre-computed word list */
function filterWords(wordList) {
  return wordList.filter(({ word }) => !FILTERED_WORDS.has(word.toLowerCase()));
}

function buildIndex(data) {
  const index = new Map();
  for (const entry of data) {
    const name = String(entry.character || '').trim();
    if (!name) continue;
    index.set(name, {
      topWords:   entry.topWords   || [],
      topPhrases: entry.topPhrases || [],
      sampleLines:entry.sampleLines|| [],
      seasonText: (entry.seasonText || []).sort((a, b) => a.season - b.season),
    });
  }
  const chars = [...index.keys()].sort((a, b) => {
    const totA = index.get(a).topWords.reduce((s, w) => s + w.count, 0);
    const totB = index.get(b).topWords.reduce((s, w) => s + w.count, 0);
    return totB - totA;
  });
  return { index, chars };
}

function getScope(entry, season) {
  if (season === 'all') {
    return {
      topWords:    filterWords(entry.topWords),
      topPhrases:  entry.topPhrases,
      sampleLines: entry.sampleLines,
    };
  }
  const s = entry.seasonText.find(st => st.season === season);
  return s
    ? { topWords: filterWords(s.topWords), topPhrases: s.topPhrases, sampleLines: s.sampleLines }
    : { topWords: [], topPhrases: [], sampleLines: [] };
}

function renderWordPack(el, words, color) {
  el.innerHTML = '';
  const W = el.clientWidth  || 520;
  const H = el.clientHeight || 440;

  const svg = d3.select(el)
    .append('svg')
    .attr('width',  W)
    .attr('height', H)
    .attr('role', 'img')
    .attr('aria-label', 'Word frequency bubble chart');

  if (!words.length) {
    svg.append('text')
      .attr('x', W / 2).attr('y', H / 2)
      .attr('text-anchor', 'middle')
      .style('fill', 'var(--color-text-faint)')
      .style('font-size', '14px')
      .text('No word data for this selection.');
    return;
  }

  const display  = words.slice(0, 60);
  const maxCount = display[0].count;

  const root = d3.hierarchy({ name: 'root', children: display })
    .sum(d => d.count)
    .sort((a, b) => b.value - a.value);

  d3.pack().size([W - 8, H - 8]).padding(3)(root);

  const g = svg.append('g').attr('transform', 'translate(4,4)');

  const leaf = g.selectAll('.wp-leaf')
    .data(root.leaves())
    .join('g')
    .attr('class', 'wp-leaf')
    .attr('transform', d => `translate(${d.x},${d.y})`);

  leaf.append('circle')
    .attr('r', d => d.r)
    .style('fill',         color)
    .style('fill-opacity', d => (0.10 + 0.65 * Math.pow(d.data.count / maxCount, 0.4)).toFixed(3))
    .style('stroke',       color)
    .style('stroke-width', '1.5px')
    .style('stroke-opacity', '0.35')
    .style('cursor', 'default')
    .style('transition', 'fill-opacity .14s ease');

  leaf.append('text')
    .attr('text-anchor',      'middle')
    .attr('dominant-baseline','middle')
    .style('font-family',   'var(--font-display)')
    .style('font-weight',   '700')
    .style('pointer-events','none')
    .style('user-select',   'none')
    .style('fill',          'var(--color-text)')
    .style('font-size',     d => `${Math.max(9, Math.min(d.r * 0.52, 22))}px`)
    .text(d => d.r >= 13 ? d.data.word : '');

  leaf.append('title')
    .text(d => `${d.data.word}: ${d.data.count.toLocaleString()}`);

  const tip = d3.select('#l2-tooltip');

  leaf
    .on('mouseover', (event, d) => {
      d3.select(event.currentTarget).select('circle')
        .style('fill-opacity', '0.88')
        .style('stroke-opacity', '0.9');
      tip.style('display', 'block').html(
        `<strong>${d.data.word}</strong>` +
        `<div class="t-row">` +
        `<span class="t-label">Count</span>` +
        `<span class="t-val">${d.data.count.toLocaleString()}</span>` +
        `</div>`,
      );
    })
    .on('mousemove', event => {
      tip.style('left', event.clientX + 14 + 'px')
         .style('top',  event.clientY - 8  + 'px');
    })
    .on('mouseleave', (event, d) => {
      d3.select(event.currentTarget).select('circle')
        .style('fill-opacity', (0.10 + 0.65 * Math.pow(d.data.count / maxCount, 0.4)).toFixed(3))
        .style('stroke-opacity', '0.35');
      tip.style('display', 'none');
    });
}

function renderTopBar(el, words, color) {
  el.innerHTML = '';
  const top = words.slice(0, 15);
  if (!top.length) return;

  // Update the heading to reflect how many words are actually shown
  const heading = el.closest('.detail-card')?.querySelector('h3');
  if (heading) heading.textContent = `Top ${top.length} Words`;

  const W   = el.clientWidth || 260;
  const rowH = 28;
  const H   = top.length * rowH + 16;
  const ML  = 96, MR = 52;
  const iW  = Math.max(60, W - ML - MR);

  const svg = d3.select(el).append('svg').attr('width', W).attr('height', H);

  const x = d3.scaleLinear().domain([0, top[0].count]).range([0, iW]);
  const y = d3.scaleBand().domain(top.map(d => d.word)).range([8, H - 8]).padding(0.2);

  const g = svg.append('g').attr('transform', `translate(${ML},0)`);

  g.selectAll('rect').data(top).join('rect')
    .attr('class', 'bar-rect')
    .attr('x', 0)
    .attr('y',      d => y(d.word))
    .attr('width',  d => Math.max(2, x(d.count)))
    .attr('height', y.bandwidth())
    .style('fill',         color)
    .style('fill-opacity', '0.60')
    .attr('rx', 2);

  svg.selectAll('.bar-lbl').data(top).join('text')
    .attr('class', 'bar-lbl')
    .attr('x', ML - 6)
    .attr('y', d => y(d.word) + y.bandwidth() / 2)
    .attr('dominant-baseline', 'middle')
    .attr('text-anchor', 'end')
    .style('font-size',   '11px')
    .style('font-weight', '600')
    .style('fill', 'var(--color-text-muted)')
    .text(d => d.word);

  g.selectAll('.bar-cnt').data(top).join('text')
    .attr('class', 'bar-cnt')
    .attr('x', d => x(d.count) + 4)
    .attr('y', d => y(d.word) + y.bandwidth() / 2)
    .attr('dominant-baseline', 'middle')
    .style('font-size', '10px')
    .style('fill', 'var(--color-text-faint)')
    .style('font-variant-numeric', 'tabular-nums')
    .text(d => d.count.toLocaleString());
}

function renderDrift(el, entry) {
  el.innerHTML = '';
  const seasons = entry.seasonText;
  if (!seasons || seasons.length < 2) {
    el.innerHTML = '<p class="chart-loading">Not enough seasons for this character.</p>';
    return;
  }

  const trackWords = filterWords(entry.topWords).slice(0, 6).map(d => d.word);
  if (!trackWords.length) {
    el.innerHTML = '<p class="chart-loading">No word data available.</p>';
    return;
  }

  const series = trackWords.map(word => ({
    word,
    values: seasons.map(st => {
      const total   = st.topWords.reduce((s, w) => s + w.count, 0) || 1;
      const wEntry  = st.topWords.find(w => w.word === word);
      const rate    = ((wEntry?.count || 0) / total) * 1000;
      return { season: st.season, rate };
    }),
  }));

  const W  = el.clientWidth  || 560;
  const H  = Math.max(280, el.clientHeight || 300);
  const mg = { top: 20, right: 110, bottom: 38, left: 50 };
  const iW = W - mg.left - mg.right;
  const iH = H - mg.top  - mg.bottom;

  const svg = d3.select(el).append('svg').attr('width', W).attr('height', H);
  const g   = svg.append('g').attr('transform', `translate(${mg.left},${mg.top})`);

  const seasonNums = seasons.map(s => s.season);
  const x = d3.scalePoint().domain(seasonNums).range([0, iW]).padding(0.3);
  const maxRate = d3.max(series.flatMap(s => s.values.map(v => v.rate))) || 1;
  const y = d3.scaleLinear().domain([0, maxRate]).range([iH, 0]).nice();

  g.append('g').attr('class', 'grid')
    .call(d3.axisLeft(y).ticks(5).tickSize(-iW).tickFormat(''))
    .call(a => a.select('.domain').remove());

  g.append('g').attr('class', 'axis')
    .attr('transform', `translate(0,${iH})`)
    .call(d3.axisBottom(x).tickFormat(s => `S${s}`));

  g.append('g').attr('class', 'axis')
    .call(d3.axisLeft(y).ticks(5));

  svg.append('text').attr('class', 'axis-label')
    .attr('transform', 'rotate(-90)')
    .attr('x', -(mg.top + iH / 2))
    .attr('y', 13)
    .attr('text-anchor', 'middle')
    .text('PER 1K WORDS');

  const palette = ['#c0241a','#1a5aa8','#1e8c3a','#e07c00','#6b4fb8','#b8366e'];

  const lineGen = d3.line()
    .x(d => x(d.season))
    .y(d => y(d.rate))
    .defined(d => d.rate > 0)
    .curve(d3.curveCatmullRom.alpha(0.5));

  const tip = d3.select('#l2-tooltip');

  series.forEach(({ word, values }, i) => {
    const col = palette[i % palette.length];

    g.append('path').datum(values)
      .attr('class', 'season-line')
      .attr('stroke', col)
      .attr('stroke-width', '2.2px')
      .attr('fill', 'none')
      .attr('d', lineGen);

    g.selectAll(`.dot-w${i}`).data(values).join('circle')
      .attr('class', `season-dot dot-w${i}`)
      .attr('cx', d => x(d.season))
      .attr('cy', d => y(d.rate))
      .attr('r', 4)
      .style('fill', col)
      .style('stroke', 'var(--color-surface-raised)')
      .style('stroke-width', '2px')
      .style('cursor', 'default')
      .on('mouseover', (event, d) => {
        tip.style('display', 'block').html(
          `<strong>${word}</strong>` +
          `<div class="t-row"><span class="t-label">Season</span><span class="t-val">${d.season}</span></div>` +
          `<div class="t-row"><span class="t-label">Rate</span><span class="t-val">${d.rate.toFixed(2)} / 1k</span></div>`,
        );
      })
      .on('mousemove', event => {
        tip.style('left', event.clientX + 14 + 'px')
           .style('top',  event.clientY - 8  + 'px');
      })
      .on('mouseleave', () => tip.style('display', 'none'));

    const last = [...values].reverse().find(v => v.rate > 0);
    if (last) {
      g.append('text')
        .attr('x', x(last.season) + 8)
        .attr('y', y(last.rate))
        .attr('dominant-baseline', 'middle')
        .style('font-size', '10px')
        .style('font-weight', '700')
        .style('fill', col)
        .text(word);
    }
  });
}

function renderPhraseList(el, phrases, color) {
  if (!phrases.length) {
    el.innerHTML =
      '<li class="phrase-item--empty">No recurring phrases found for this scope.</li>';
    return;
  }
  const max = phrases[0].count;
  el.innerHTML = phrases
    .slice(0, 5)
    .map(({ phrase, count }) => {
      const barW = Math.max(8, Math.round((count / max) * 90));
      return `<li class="phrase-item">
        <span class="phrase-item__text">&ldquo;${phrase}&rdquo;</span>
        <span style="display:inline-flex;align-items:center;gap:6px;margin-left:auto;flex-shrink:0;">
          <span style="display:inline-block;width:${barW}px;height:6px;
            background:${color};opacity:.6;border-radius:3px;"></span>
          <span class="phrase-item__count">${count.toLocaleString()}&times;</span>
        </span>
      </li>`;
    })
    .join('');
}

function renderStats(el, { topWords, topPhrases }) {
  const totalWords  = topWords.reduce((s, w) => s + w.count, 0);
  const uniqueWords = topWords.length;
  el.innerHTML = `
    <div class="stat-item">
      <dt>Unique words</dt>
      <dd>${uniqueWords.toLocaleString()}</dd>
    </div>
    <div class="stat-item">
      <dt>Word tokens</dt>
      <dd>${totalWords.toLocaleString()}</dd>
    </div>
    <div class="stat-item">
      <dt>Repeated phrases</dt>
      <dd>${topPhrases.length.toLocaleString()}</dd>
    </div>
  `;
}

function buildScopeBtns(wrapEl, entry, currentSeason, onSelect) {
  const seasons = entry.seasonText.map(s => s.season);
  wrapEl.innerHTML = `
    <button class="scope-btn${currentSeason === 'all' ? ' active' : ''}" data-s="all">All</button>
    ${seasons.map(s =>
      `<button class="scope-btn${currentSeason === s ? ' active' : ''}" data-s="${s}">S${s}</button>`
    ).join('')}
  `;
  wrapEl.querySelectorAll('.scope-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const next = btn.dataset.s === 'all' ? 'all' : +btn.dataset.s;
      wrapEl.querySelectorAll('.scope-btn')
        .forEach(b => b.classList.toggle('active', b === btn));
      onSelect(next);
    });
  });
}

function buildShell(chars) {
  return /* html */`
  <section id="level-2-summary" class="level-shell">
    <div class="section-inner level-hero">
      <div class="level-hero__copy">
        <span class="level-hero__eyebrow">Level 2</span>
        <h1 class="level-hero__title">Character Language</h1>
        <p class="level-hero__lede">
          Pick a character and a season scope to explore their vocabulary,
          catchphrases, and how their language shifts across the show's run.
        </p>
      </div>
      <div class="level-hero__controls">
        <div class="char-selector-wrap">
          <label for="l2-char-select" class="sr-only">Select character</label>
          <select id="l2-char-select" class="char-select">
            ${chars.map(c => `<option value="${c}">${c}</option>`).join('')}
          </select>
        </div>
        <div id="l2-scope" class="scope-control level-scope-control"></div>
        <dl id="l2-stats" class="stat-row p4-stats"></dl>
      </div>
    </div>
  </section>

  <section id="level-2-words" class="page-section">
    <div class="section-inner">
      <div class="section-header">
        <span class="section-num">01</span>
        <h2 class="section-title">Word Landscape</h2>
        <p class="section-lede">
          Each bubble is a word sized by how often this character uses it in the
          selected scope.
        </p>
      </div>
      <div class="split-panel split-panel--wide">
        <div id="l2-pack" class="chart-area" style="min-height:440px;"></div>
        <div class="detail-card" style="display:flex;flex-direction:column;gap:var(--sp-3);">
          <h3 style="font-size:var(--text-xs);text-transform:uppercase;
                     letter-spacing:.12em;color:var(--color-text-faint);font-weight:700;">
            Top 15 Words
          </h3>
          <div id="l2-bar" style="overflow:hidden;flex:1;min-height:280px;"></div>
        </div>
      </div>
    </div>
  </section>

  <section id="level-2-phrases" class="page-section">
    <div class="section-inner">
      <div class="section-header">
        <span class="section-num">02</span>
        <h2 class="section-title">Signature Phrases</h2>
        <p class="section-lede">
          Multi-word sequences this character repeats most in the selected scope.
        </p>
      </div>
      <div class="split-panel">
        <div class="detail-card">
          <h3 style="margin-bottom:var(--sp-4);">Recurring phrases</h3>
          <ul id="l2-phrase-list" class="phrase-list"></ul>
        </div>
        <div class="detail-card">
          <h3 style="margin-bottom:var(--sp-3);">How to read this</h3>
          <p style="color:var(--color-text-muted);font-size:var(--text-sm);max-width:none;">
            Repeated word sequences this character says throughout the show. 
            Filler words at the start or end are excluded, and longer phrases 
            are preferred over shorter overlapping ones.
          </p>
        </div>
      </div>
    </div>
  </section>

  <section id="level-2-drift" class="page-section">
    <div class="section-inner">
      <div class="section-header">
        <span class="section-num">03</span>
        <h2 class="section-title">Seasonal Drift</h2>
        <p class="section-lede">
          Tracks this character's six most-used words across every season.
          This view always covers the full run regardless of the season selected.
        </p>
      </div>
      <div id="l2-drift" class="chart-area" style="min-height:320px;"></div>
      <p class="chart-note">
        Y-axis = occurrences per 1,000 words in that season's top-word set.
        Dots with no connecting line indicate the word didn't appear in the top words that season.
      </p>
    </div>
  </section>
  `;
}

function ensureTip() {
  if (document.getElementById('l2-tooltip')) return;
  const tip = document.createElement('div');
  tip.id        = 'l2-tooltip';
  tip.className = 'tooltip';
  tip.style.cssText = 'display:none;position:fixed;z-index:9999;pointer-events:none;';
  document.body.appendChild(tip);
}

export const level2View = {
  id:             'level-2',
  label:          'Level 2: Character Language',
  shortLabel:     'Level 2',
  defaultSection: 'level-2-summary',

  sections: [
    { id: 'level-2-summary', label: 'Overview' },
    { id: 'level-2-words',   label: 'Words'    },
    { id: 'level-2-phrases', label: 'Phrases'  },
    { id: 'level-2-drift',   label: 'Drift'    },
  ],

  async render(ctx) {
    const raw  = await ctx.loadLevelData('level-2');

    // loadLevelData returns { 'character-text': [...] }
    const data = raw?.['character-text'];

    if (!Array.isArray(data) || !data.length) {
      ctx.container.innerHTML =
        `<p class="chart-loading">No character data found. Make sure
         "character-text" is listed in LEVEL_DATASETS["level-2"].</p>`;
      return;
    }

    const { index, chars } = buildIndex(data);

    if (!chars.length) {
      ctx.container.innerHTML =
        '<p class="chart-loading">Index built but no characters found.</p>';
      return;
    }

    let char   = chars[0];
    let season = 'all';

    ctx.container.innerHTML = buildShell(chars);
    ensureTip();

    const q         = sel => ctx.container.querySelector(sel);
    const charSel   = q('#l2-char-select');
    const scopeWrap = q('#l2-scope');
    const statsEl   = q('#l2-stats');
    const packEl    = q('#l2-pack');
    const barEl     = q('#l2-bar');
    const phraseEl  = q('#l2-phrase-list');
    const driftEl   = q('#l2-drift');

    charSel.value = char;
    charSel.addEventListener('change', e => {
      char   = e.target.value;
      season = 'all';
      rebuildScope();
      refresh();
    });

    function rebuildScope() {
      buildScopeBtns(scopeWrap, index.get(char), season, s => {
        season = s;
        refresh();
      });
    }

    function refresh() {
      const entry = index.get(char);
      const scope = getScope(entry, season);
      const color = resolveCharColor(char);
      renderStats(statsEl, scope);
      renderWordPack(packEl, scope.topWords, color);
      renderTopBar(barEl, scope.topWords, color);
      renderPhraseList(phraseEl, scope.topPhrases, color);
      renderDrift(driftEl, entry);
    }

    rebuildScope();
    refresh();

    const ro = new ResizeObserver(() => {
      const entry = index.get(char);
      const scope = getScope(entry, season);
      const color = resolveCharColor(char);
      renderWordPack(packEl, scope.topWords, color);
      renderTopBar(barEl, scope.topWords, color);
      renderDrift(driftEl, entry);
    });
    ro.observe(ctx.container);
    ctx._l2_ro = ro;
  },

  destroy(ctx) {
    if (ctx._l2_ro) { ctx._l2_ro.disconnect(); delete ctx._l2_ro; }
    document.getElementById('l2-tooltip')?.remove();
    ctx.container.innerHTML = '';
  },
};