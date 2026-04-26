/**
 * South Park — Dialogue Anatomy
 * main.js
 *
 * Seven-page Level 1 narrative site built with D3 v7.
 *
 * Architecture:
 *  - Global state: currentScope ('recurring' | 'core'), selectedChar (page 4)
 *  - Data loading: all JSON files loaded on startup via Promise.all
 *  - Each page has a draw() function that respects the current state
 *  - Global scope toggle re-draws all relevant charts
 *  - Tooltip is a shared singleton positioned via mouse events
 *
 * Filtering logic (matches preprocess.py):
 *  - 'recurring' scope = characters with episodeCount >= 8  (165 chars)
 *  - 'core'      scope = characters with episodeCount >= 12 (105 chars)
 *  - 'all'       scope = all speakers (page 1 long-tail + page 7 only)
 *
 * Chart implementations:
 *  Page 1 — Scatterplot: x=episodeCoverage, y=totalWords, size=maxEpWordShare
 *  Page 2 — Horizontal lollipop/bar: metric switcher (words/eps/avg)
 *  Page 3 — Multi-line chart: seasonal word share; rank bump view
 *  Page 4 — Heatmap: one cell per episode, colour = words spoken
 *  Page 5 — Slope chart: rank by presence (left) vs rank by volume (right)
 *  Page 6 — Beeswarm: per-episode word share per character
 *  Page 7 — Clustered scatterplot: ensemble architecture
 */

import * as d3 from 'd3';

const LEVEL1_TEMPLATE = `
  <section id="level-1-intro" class="level-shell">
    <div class="section-inner level-hero">
      <div class="level-hero__copy">
        <span class="level-hero__eyebrow">Level 1</span>
        <h1 class="level-hero__title">Character Importance</h1>
        <p class="level-hero__lede">
          Who matters, how much they speak, and how that changes by season and episode.
        </p>
      </div>
      <div class="level-hero__controls">
        <div class="scope-control level-scope-control" role="group" aria-label="Character scope filter">
          <button class="scope-btn active" data-scope="recurring" title="Show recurring cast: 8+ episode appearances">
            Recurring <span class="scope-count" id="scope-count-recurring"></span>
          </button>
          <button class="scope-btn" data-scope="core" title="Show core cast: 12+ episode appearances">
            Core <span class="scope-count" id="scope-count-core"></span>
          </button>
        </div>
        <p class="level-hero__note">
          Use the scope toggle to simplify the cast.
        </p>
      </div>
    </div>
  </section>

  <section id="page-0" class="page-section" data-page="0">
    <div class="section-inner">
      <div class="section-header">
        <span class="section-num">00</span>
        <h2 class="section-title">South Park 101</h2>
        <p class="section-lede">
          Quick context for people who have not watched the show before.
        </p>
      </div>

      <div class="info-grid" aria-label="South Park basics for new viewers">
        <article class="info-card">
          <h3>When did it run, and where?</h3>
          <p>
            <strong>South Park</strong> premiered in <strong>1997</strong> and is still running.
            It is a <strong>Comedy Central</strong> original series.
          </p>
        </article>

        <article class="info-card">
          <h3>What genre is it?</h3>
          <p>
            Adult animated sitcom, satire, and dark comedy.
          </p>
        </article>

        <article class="info-card">
          <h3>What is the general premise?</h3>
          <p>
            The show follows four boys in the small town of South Park, Colorado,
            using absurd and often controversial stories to satirize current events,
            culture, and everyday life.
          </p>
        </article>
      </div>

      <div id="sp101-main-cast" aria-label="Main cast portraits" style="margin-top:20px;"></div>
    </div>
  </section>

  <section id="page-1" class="page-section" data-page="1">
    <div class="section-inner">
      <div class="section-header">
        <span class="section-num">01</span>
        <h2 class="section-title">Who Actually Matters</h2>
        <p class="section-lede">
          <strong id="meta-seasons"></strong> seasons, <strong id="meta-episodes"></strong> episodes,
          <strong id="meta-words"></strong> words, and <strong id="meta-speakers"></strong> speakers.
          <strong id="meta-one-ep-pct"></strong>% appear only once.
        </p>
      </div>

      <div class="chart-area" id="chart-p1" aria-label="Scatterplot: episode coverage vs total words">
        <div class="chart-loading">Loading…</div>
      </div>

      <div class="chart-note">
        <strong>x-axis</strong> — episode coverage (share of all <span id="meta-ep-count"></span> episodes)&ensp;
        <strong>y-axis</strong> — total words spoken&ensp;
        <strong>bubble size</strong> — max single-episode word share
      </div>

      <p class="chart-blurb">
        The plot shows how a handful of characters carry most of the dialogue, with Cartman, Stan, Kyle, and Kenny standing out as the main characters.
      </p>

      <div class="page1-scope-toggle">
        <button class="text-btn active" id="p1-show-recurring" data-p1scope="recurring">Recurring only</button>
        <button class="text-btn" id="p1-show-all" data-p1scope="all">Show all speakers</button>
      </div>
    </div>
  </section>

  <section id="page-2" class="page-section" data-page="2">
    <div class="section-inner">
      <div class="section-header">
        <span class="section-num">02</span>
        <h2 class="section-title">The Main Hierarchy</h2>
        <p class="section-lede">
          Rank the recurring cast by total words, episode count, or average words per episode.
        </p>
      </div>

      <div class="metric-switcher" role="group" aria-label="Ranking metric">
        <button class="metric-btn active" data-metric="totalWords">Total words</button>
        <button class="metric-btn" data-metric="episodeCount">Episodes</button>
        <button class="metric-btn" data-metric="avgWordsPerEpisode">Avg words / episode</button>
      </div>

      <div class="chart-area" id="chart-p2" aria-label="Horizontal bar chart: character ranking"></div>
    </div>
  </section>

  <section id="page-3" class="page-section" data-page="3">
    <div class="section-inner">
      <div class="section-header">
        <span class="section-num">03</span>
        <h2 class="section-title">How Importance Changes by Season</h2>
        <p class="section-lede">
          Track who rises, falls, or stays steady across the run of the show.
        </p>
      </div>

      <div class="season-view-toggle" role="group" aria-label="Season view">
        <button class="metric-btn active" data-seasonview="share">Word share</button>
        <button class="metric-btn" data-seasonview="rank">Rank</button>
      </div>

      <div class="chart-area" id="chart-p3" aria-label="Multi-line chart: seasonal word share by character"></div>

      <div class="legend-area" id="legend-p3"></div>
    </div>
  </section>

  <section id="page-4" class="page-section" data-page="4">
    <div class="section-inner">
      <div class="section-header">
        <span class="section-num">04</span>
        <h2 class="section-title">Character Run Across Episodes</h2>
        <p class="section-lede">
          Each square is one episode. Darker cells mean more words; blank cells mean absence.
        </p>
      </div>

      <div class="char-selector-wrap">
        <label for="p4-char-select" class="sr-only">Select character</label>
        <select id="p4-char-select" class="char-select" aria-label="Select character for episode run view">
          <option value="">Select a character…</option>
        </select>
      </div>

      <div class="chart-area chart-area--heatmap" id="chart-p4" aria-label="Episode heatmap: presence and speaking volume"></div>

      <div class="p4-stats" id="p4-stats" hidden>
        <dl class="stat-row">
          <div class="stat-item"><dt>Episodes appeared</dt><dd id="p4-stat-ep"></dd></div>
          <div class="stat-item"><dt>Total words</dt><dd id="p4-stat-words"></dd></div>
          <div class="stat-item"><dt>Avg words / episode</dt><dd id="p4-stat-avg"></dd></div>
          <div class="stat-item"><dt>Peak episode</dt><dd id="p4-stat-peak"></dd></div>
        </dl>
      </div>
    </div>
  </section>

  <section id="page-5" class="page-section" data-page="5">
    <div class="section-inner">
      <div class="section-header">
        <span class="section-num">05</span>
        <h2 class="section-title">Presence Is Not Power</h2>
        <p class="section-lede">
          Compare being present often with actually dominating the dialogue.
        </p>
      </div>

      <div class="chart-area" id="chart-p5" aria-label="Slope / dumbbell chart: presence rank vs volume rank"></div>

      <div class="chart-note">
        <strong>Left</strong> — rank by episode appearances&ensp;
        <strong>Right</strong> — rank by total words spoken&ensp;
        Lines slanting right = more words than their presence suggests; left = less.
      </div>
    </div>
  </section>

  <section id="page-6" class="page-section" data-page="6">
    <div class="section-inner">
      <div class="section-header">
        <span class="section-num">06</span>
        <h2 class="section-title">Who Owns an Episode</h2>
        <p class="section-lede">
          See how much of an episode's dialogue a character can take over.
        </p>
      </div>

      <div class="chart-area chart-area--beeswarm" id="chart-p6" aria-label="Beeswarm chart: per-episode word share distribution by character"></div>

      <div class="chart-note">
        Each dot = one episode the character appears in. Position = share of that episode's total words.
      </div>
    </div>
  </section>

  <section id="page-7" class="page-section" data-page="7">
    <div class="section-inner">
      <div class="section-header">
        <span class="section-num">07</span>
        <h2 class="section-title">The Ensemble Machine</h2>
        <p class="section-lede">
          Map the cast into anchors, spotlight characters, and supporting roles.
        </p>
      </div>

      <div class="cluster-legend" id="cluster-legend" aria-label="Cluster legend"></div>

      <div class="chart-area chart-area--ensemble" id="chart-p7" aria-label="Clustered scatterplot: cast architecture"></div>

      <div class="chart-note">
        <strong>x-axis</strong> — episode coverage&ensp;
        <strong>y-axis</strong> — avg words per episode&ensp;
        <strong>Scope filter above</strong> also controls this view.
      </div>
    </div>
  </section>
`;

// ════════════════════════════════════════════════════════════════════════════
// GLOBAL STATE
// ════════════════════════════════════════════════════════════════════════════

const state = {
  scope: 'recurring',      // 'recurring' | 'core'
  p1Scope: 'recurring',    // page-1 also has 'all' option
  p2Metric: 'totalWords',  // page-2 metric switcher
  p3View: 'share',         // page-3: 'share' | 'rank'
  p4Char: null,            // page-4 selected character
  p5Scope: 'recurring',    // page-5 uses global scope
};

// ════════════════════════════════════════════════════════════════════════════
// DATA — loaded once at startup
// ════════════════════════════════════════════════════════════════════════════

let DATA = {};
let rootEl = null;

function assignData(loaded) {
  DATA = {
    ...loaded,
    seasonal_share: loaded['seasonal-share'],
    episode_runs: loaded['episode-runs'],
    rank_divergence: loaded['rank-divergence'],
    episode_share: loaded['episode-share'],
  };
}

// ════════════════════════════════════════════════════════════════════════════
// TOOLTIP
// ════════════════════════════════════════════════════════════════════════════

function showTooltip(html, event) {
  const tooltip = document.getElementById('tooltip');
  if (!tooltip) return;
  tooltip.innerHTML = html;
  tooltip.removeAttribute('hidden');
  positionTooltip(event);
}

function hideTooltip() {
  const tooltip = document.getElementById('tooltip');
  if (!tooltip) return;
  tooltip.setAttribute('hidden', '');
}

function positionTooltip(event) {
  const tooltip = document.getElementById('tooltip');
  if (!tooltip) return;
  const { clientX: x, clientY: y } = event;
  const tw = tooltip.offsetWidth;
  const th = tooltip.offsetHeight;
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  // Prefer right of cursor; flip if near edge
  let left = x + 14;
  let top  = y - 10;
  if (left + tw > vw - 8) left = x - tw - 14;
  if (top + th > vh - 8)  top  = vh - th - 8;
  tooltip.style.left = `${left}px`;
  tooltip.style.top  = `${top}px`;
}

// ════════════════════════════════════════════════════════════════════════════
// UTILITIES
// ════════════════════════════════════════════════════════════════════════════

function fmt(n) { return d3.format(',')(Math.round(n)); }
function fmtPct(n) { return d3.format('.1%')(n); }
function fmtPct1(n) { return d3.format('.1%')(n); }

/**
 * Filter a dataset by the current scope.
 * 'recurring' = episodeCount >= 8 (or scope field === 'recurring' || 'core')
 * 'core'      = episodeCount >= 12 (or scope field === 'core')
 */
function filterByScope(data, scopeField = 'scope', scope = state.scope) {
  if (scope === 'all') return data;
  if (scope === 'core')      return data.filter(d => d[scopeField] === 'core');
  // 'recurring' = recurring OR core
  return data.filter(d => d[scopeField] === 'recurring' || d[scopeField] === 'core');
}

/** Returns SVG dimensions from container element. Adds small padding. */
function svgDims(containerId, { marginTop = 24, marginRight = 24, marginBottom = 40, marginLeft = 60 } = {}) {
  const el = document.getElementById(containerId);
  const W  = Math.max(el.offsetWidth, 320);
  const H  = Math.max(el.offsetHeight, 300);
  return {
    W, H,
    innerW: W - marginLeft - marginRight,
    innerH: H - marginTop - marginBottom,
    marginTop, marginRight, marginBottom, marginLeft,
  };
}

/** Create or replace an SVG inside a container */
function makeSvg(containerId, dims) {
  const container = d3.select(`#${containerId}`);
  container.selectAll('svg').remove();
  // Remove any loading placeholder
  container.selectAll('.chart-loading').remove();
  const svg = container.append('svg')
    .attr('width',  dims.W)
    .attr('height', dims.H)
    .attr('viewBox', `0 0 ${dims.W} ${dims.H}`)
    .attr('style', 'overflow: visible;');
  const g = svg.append('g')
    .attr('transform', `translate(${dims.marginLeft},${dims.marginTop})`);
  return { svg, g };
}

/** Add subtle grid lines */
function addGrid(g, scale, isX, count, innerW, innerH) {
  const axis = isX
    ? d3.axisBottom(scale).ticks(count).tickSize(-innerH).tickFormat('')
    : d3.axisLeft(scale).ticks(count).tickSize(-innerW).tickFormat('');
  g.append('g')
    .attr('class', 'grid')
    .attr('transform', isX ? `translate(0,${innerH})` : '')
    .call(axis);
}

// Character colour map — CSS-variable aware (reads live values for theme support).
// Keys map to --char-* CSS variables; fallback to data series tokens.
const CHAR_CSS_VARS = {
  'Cartman':      '--char-cartman',
  'Stan':         '--char-stan',
  'Kyle':         '--char-kyle',
  'Kenny':        '--char-kenny',
  'Randy':        '--char-randy',
  'Butters':      '--char-butters',
  'Wendy':        '--char-wendy',
  'Mr. Garrison': '--char-garrison',
};

// Additional characters — fixed hex values chosen to be readable in both themes
const CHAR_FIXED = {
  'Chef':      '#c0581a',
  'Mr. Mackey':'#2e7dbf',
  'Sharon':    '#9060c0',
  'Jimmy':     '#2ea060',
  'Craig':     '#b84820',
  'Tweek':     '#1a9898',
  'Gerald':    '#6878a0',
  'Clyde':     '#d06030',
  'Token':     '#388090',
  'Timmy':     '#8840b0',
  'Bebe':      '#d04880',
};

// Read a CSS custom property from the root element
function cssVar(name) {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

// Fallback: categorical scale for characters not in the map
const fallbackScale = d3.scaleOrdinal(d3.schemeTableau10);

function charColor(name) {
  if (CHAR_CSS_VARS[name]) return cssVar(CHAR_CSS_VARS[name]);
  if (CHAR_FIXED[name])    return CHAR_FIXED[name];
  return fallbackScale(name);
}

const MAIN_CAST = ['Cartman', 'Stan', 'Kyle', 'Kenny', 'Butters'];
const PORTRAIT_CHARACTERS = new Set(MAIN_CAST);
const CHARACTER_BLURBS = {
  Cartman: 'Manipulative, loud, and often central to conflict. He drives many of the show\'s biggest satire episodes.',
  Stan: 'The grounded observer of the group. Stan often reacts to chaos and gives the audience a moral anchor.',
  Kyle: 'Idealistic and argumentative, usually pushing back when things go too far. He is often Cartman\'s foil.',
  Kenny: 'Quiet but iconic. Kenny appears constantly, with influence that is bigger than his line count.',
  Butters: 'Naive, earnest, and frequently pulled into bizarre situations. He becomes a surprising spotlight character.',
};
const PORTRAIT_BASE_PATH = '/images/characters';
const PORTRAIT_EXT = 'png';
const PORTRAIT_FILE_MAP = {
  Cartman: 'cartman',
  Stan: 'stan',
  Kyle: 'kyle',
  Kenny: 'kenny',
  Randy: 'randy',
  Butters: 'butters',
  Wendy: 'wendy',
  'Mr. Garrison': 'mr-garrison',
};

function portraitSrc(character) {
  const slug = PORTRAIT_FILE_MAP[character]
    || character.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  return `${PORTRAIT_BASE_PATH}/${slug}.${PORTRAIT_EXT}`;
}

function initials(character) {
  return character
    .replace(/\./g, '')
    .split(/\s+/)
    .filter(Boolean)
    .map(part => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
}

function buildPortraitNode(character, { size = 28, ringColor = 'var(--color-divider)' } = {}) {
  const wrap = document.createElement('span');
  wrap.style.cssText = [
    'display:inline-grid',
    'place-items:center',
    `width:${size}px`,
    `height:${size}px`,
    'border-radius:999px',
    'overflow:hidden',
    `border:2px solid ${ringColor}`,
    'background:var(--color-surface-offset)',
    'flex:0 0 auto',
  ].join(';');

  const img = document.createElement('img');
  img.src = portraitSrc(character);
  img.alt = `${character} portrait`;
  img.loading = 'lazy';
  img.style.cssText = 'width:100%;height:100%;object-fit:cover;display:block;';

  const fallback = document.createElement('span');
  fallback.textContent = initials(character);
  fallback.setAttribute('aria-hidden', 'true');
  fallback.style.cssText = [
    'display:none',
    'width:100%',
    'height:100%',
    'font-size:10px',
    'font-weight:700',
    'color:var(--color-text-muted)',
    'align-items:center',
    'justify-content:center',
  ].join(';');

  img.addEventListener('error', () => {
    img.remove();
    fallback.style.display = 'inline-flex';
  });

  wrap.appendChild(img);
  wrap.appendChild(fallback);
  return wrap;
}

function characterTooltipHeader(character) {
  if (!PORTRAIT_CHARACTERS.has(character)) {
    return `<strong>${character}</strong>`;
  }
  const src = portraitSrc(character);
  return `
    <div style="display:flex;align-items:center;gap:8px;margin-bottom:4px;">
      <img src="${src}" alt="${character} portrait" style="width:26px;height:26px;border-radius:999px;object-fit:cover;border:1px solid var(--color-divider);"
        onerror="this.style.display='none'">
      <strong>${character}</strong>
    </div>
  `;
}

function renderSouthPark101Cast() {
  const container = document.getElementById('sp101-main-cast');
  if (!container) return;

  const hierarchyByName = new Map((DATA.hierarchy || []).map(d => [d.character, d]));
  const cast = MAIN_CAST.filter(name => hierarchyByName.has(name));

  container.innerHTML = '';

  const title = document.createElement('h3');
  title.textContent = 'Main cast carousel';
  title.style.margin = '0 0 10px 0';
  container.appendChild(title);

  const frame = document.createElement('div');
  frame.style.cssText = [
    'position:relative',
    'overflow:hidden',
    'border:1px solid var(--color-divider)',
    'border-radius:14px',
    'background:var(--color-surface)',
  ].join(';');

  const track = document.createElement('div');
  track.style.cssText = [
    'display:flex',
    'transition:transform 260ms ease',
    'will-change:transform',
  ].join(';');

  cast.forEach(name => {
    const stat = hierarchyByName.get(name);
    const slide = document.createElement('article');
    slide.style.cssText = [
      'flex:0 0 100%',
      'padding:16px',
      'display:grid',
      'grid-template-columns:auto 1fr',
      'gap:12px',
      'align-items:start',
    ].join(';');
    slide.setAttribute('aria-label', name);

    slide.appendChild(buildPortraitNode(name, { size: 58, ringColor: charColor(name) }));

    const body = document.createElement('div');
    body.innerHTML = `
      <h4 style="margin:0 0 4px 0;font-size:15px;color:var(--color-text);">${name}</h4>
      <p style="margin:0 0 6px 0;font-size:12px;color:var(--color-text-muted);">${fmt(stat.episodeCount)} episodes · ${fmt(stat.totalWords)} words · ${fmt(stat.avgWordsPerEpisode)} avg words/ep</p>
      <p style="margin:0;font-size:13px;line-height:1.45;color:var(--color-text);">${CHARACTER_BLURBS[name] || ''}</p>
    `;
    slide.appendChild(body);
    track.appendChild(slide);
  });

  frame.appendChild(track);
  container.appendChild(frame);

  const controls = document.createElement('div');
  controls.style.cssText = 'display:flex;align-items:center;justify-content:space-between;gap:10px;margin-top:10px;';

  const prevBtn = document.createElement('button');
  prevBtn.type = 'button';
  prevBtn.textContent = 'Previous';
  prevBtn.style.cssText = 'padding:6px 10px;border-radius:999px;border:1px solid var(--color-divider);background:var(--color-surface);color:var(--color-text);';

  const nextBtn = document.createElement('button');
  nextBtn.type = 'button';
  nextBtn.textContent = 'Next';
  nextBtn.style.cssText = 'padding:6px 10px;border-radius:999px;border:1px solid var(--color-divider);background:var(--color-surface);color:var(--color-text);';

  const dots = document.createElement('div');
  dots.style.cssText = 'display:flex;align-items:center;gap:8px;';

  const dotButtons = cast.map((name, i) => {
    const dot = document.createElement('button');
    dot.type = 'button';
    dot.setAttribute('aria-label', `Go to ${name}`);
    dot.style.cssText = [
      'width:10px',
      'height:10px',
      'padding:0',
      'border-radius:999px',
      'border:1px solid var(--color-divider)',
      'background:var(--color-surface-offset)',
      'cursor:pointer',
    ].join(';');
    dot.addEventListener('click', () => setSlide(i));
    dots.appendChild(dot);
    return dot;
  });

  controls.appendChild(prevBtn);
  controls.appendChild(dots);
  controls.appendChild(nextBtn);
  container.appendChild(controls);

  let activeIndex = 0;

  function setSlide(index) {
    if (cast.length === 0) return;
    activeIndex = ((index % cast.length) + cast.length) % cast.length;
    track.style.transform = `translateX(-${activeIndex * 100}%)`;
    dotButtons.forEach((dot, i) => {
      dot.style.background = i === activeIndex ? charColor(cast[i]) : 'var(--color-surface-offset)';
      dot.style.borderColor = i === activeIndex ? charColor(cast[i]) : 'var(--color-divider)';
    });
  }

  prevBtn.addEventListener('click', () => setSlide(activeIndex - 1));
  nextBtn.addEventListener('click', () => setSlide(activeIndex + 1));

  frame.tabIndex = 0;
  frame.addEventListener('keydown', (event) => {
    if (event.key === 'ArrowLeft') {
      event.preventDefault();
      setSlide(activeIndex - 1);
    }
    if (event.key === 'ArrowRight') {
      event.preventDefault();
      setSlide(activeIndex + 1);
    }
  });

  setSlide(0);
}

// ════════════════════════════════════════════════════════════════════════════
// PAGE 1 — Who Actually Matters
// ════════════════════════════════════════════════════════════════════════════

/**
 * Scatterplot:
 *   x = episodeCoverage (0–1 ratio of episodes_appeared / total_episodes)
 *   y = totalWords
 *   bubble size = maxEpWordShare (how much of an episode they can own)
 *   colour = scope tier
 *
 * Filtering:
 *   Default: 'recurring' scope (8+ episodes) to avoid overplotting.
 *   'all' mode adds the guest/one-off long-tail in small grey dots.
 *
 * Annotations:
 *   Hard-coded callouts for the key narrative characters.
 */
function drawPage1() {
  const dims = svgDims('chart-p1', {
    marginTop: 30, marginRight: 120, marginBottom: 50, marginLeft: 70,
  });
  const { g } = makeSvg('chart-p1', dims);
  const { innerW, innerH } = dims;

  const scopeData = DATA.overview.filter(d =>
    state.p1Scope === 'all'
      ? true
      : (d.scope === 'recurring' || d.scope === 'core')
  );

  // Scales
  const xMax = d3.max(scopeData, d => d.episodeCoverage);
  const x = d3.scaleLinear()
    .domain([0, Math.min(xMax * 1.05, 1)])
    .range([0, innerW]);

  const y = d3.scaleLinear()
    .domain([0, d3.max(scopeData, d => d.totalWords) * 1.08])
    .nice()
    .range([innerH, 0]);

  // Bubble size: map maxEpWordShare → radius px
  const rScale = d3.scaleSqrt()
    .domain([0, d3.max(scopeData, d => d.maxEpWordShare)])
    .range([state.p1Scope === 'all' ? 2 : 3, 28]);

  // Grid
  addGrid(g, x, true,  5, innerW, innerH);
  addGrid(g, y, false, 5, innerW, innerH);

  // Axes
  g.append('g')
    .attr('class', 'axis')
    .attr('transform', `translate(0,${innerH})`)
    .call(d3.axisBottom(x).ticks(5).tickFormat(fmtPct));

  g.append('g')
    .attr('class', 'axis')
    .call(d3.axisLeft(y).ticks(5).tickFormat(d => d >= 1000 ? `${d/1000}k` : d));

  // Axis labels
  g.append('text')
    .attr('class', 'axis-label')
    .attr('x', innerW / 2)
    .attr('y', innerH + 40)
    .attr('text-anchor', 'middle')
    .text('EPISODE COVERAGE');

  g.append('text')
    .attr('class', 'axis-label')
    .attr('transform', 'rotate(-90)')
    .attr('x', -(innerH / 2))
    .attr('y', -55)
    .attr('text-anchor', 'middle')
    .text('TOTAL WORDS');

  // Sort: guests first (painted under), recurring on top
  const sorted = [...scopeData].sort((a, b) => {
    const order = { guest: 0, recurring: 1, core: 2 };
    return (order[a.scope] || 0) - (order[b.scope] || 0);
  });

  // Bubbles
  g.selectAll('.bubble')
    .data(sorted)
    .join('circle')
    .attr('class', 'bubble')
    .attr('cx', d => x(d.episodeCoverage))
    .attr('cy', d => y(d.totalWords))
    .attr('r',  d => rScale(d.maxEpWordShare))
    .attr('fill', d => d.scope === 'guest' ? 'var(--color-divider)' : charColor(d.character))
    .attr('opacity', d => d.scope === 'guest' ? 0.35 : 0.82)
    .attr('stroke', d => d.scope === 'guest' ? 'none' : 'var(--color-bg)')
    .attr('stroke-width', 1)
    .on('mousemove', (event, d) => {
      showTooltip(`
        <strong>${d.character}</strong>
        <div class="t-row"><span class="t-label">Episodes</span><span class="t-val">${fmt(d.episodeCount)} (${fmtPct(d.episodeCoverage)})</span></div>
        <div class="t-row"><span class="t-label">Total words</span><span class="t-val">${fmt(d.totalWords)}</span></div>
        <div class="t-row"><span class="t-label">Avg words/ep</span><span class="t-val">${fmt(d.avgWordsPerEpisode)}</span></div>
        <div class="t-row"><span class="t-label">Max ep share</span><span class="t-val">${fmtPct(d.maxEpWordShare)}</span></div>
        <div class="t-row"><span class="t-label">Top-speaker eps</span><span class="t-val">${d.topSpeakerEpisodes}</span></div>
      `, event);
    })
    .on('mouseleave', hideTooltip);

  // Annotations for key characters
  // Desktop can support the fuller editorial labels; on compact widths we reduce
  // the number and length of labels so the scatter does not turn into a tangle.
  const isCompact = dims.W < 640;
  const annotations = isCompact
    ? [
        { name: 'Cartman', label: 'Cartman', dx: -18, dy: -18 },
        { name: 'Randy',   label: 'Randy',   dx: 10,  dy: -12 },
      ]
    : [
        { name: 'Cartman',  label: 'Cartman — structurally dominant',  dx: 10,  dy: -16 },
        { name: 'Stan',     label: 'Stan',                              dx: -58, dy: -10 },
        { name: 'Kyle',     label: 'Kyle',                              dx: 8,   dy: 14 },
        { name: 'Randy',    label: 'Randy — spotlight power',           dx: 8,   dy: -14 },
        { name: 'Butters',  label: 'Butters — episode hijacker',        dx: 8,   dy: 14 },
        { name: 'Kenny',    label: 'Kenny — present but quiet',         dx: 8,   dy: -14 },
      ];

  annotations.forEach(ann => {
    const d = scopeData.find(c => c.character === ann.name);
    if (!d) return;
    const cx = x(d.episodeCoverage);
    const cy = y(d.totalWords);
    const pad = 8;
    const approxWidth = ann.label.length * (isCompact ? 5.5 : 6.2);
    let tx = cx + ann.dx;
    let anchor = ann.dx < 0 ? 'end' : 'start';

    // Keep labels inside the plotting area so long desktop annotations do not clip.
    if (anchor === 'start' && tx + approxWidth > innerW - pad) {
      tx = innerW - pad;
      anchor = 'end';
    }
    if (anchor === 'end' && tx - approxWidth < pad) {
      tx = pad;
      anchor = 'start';
    }

    const lineEndX = anchor === 'start' ? Math.max(pad, tx - 4) : Math.min(innerW - pad, tx + 4);

    g.append('line')
      .attr('class', 'annotation-line')
      .attr('x1', cx).attr('y1', cy)
      .attr('x2', lineEndX).attr('y2', cy + ann.dy - 4);

    g.append('text')
      .attr('class', 'annotation-text')
      .attr('x', tx)
      .attr('y', cy + ann.dy)
      .attr('text-anchor', anchor)
      .text(ann.label);
  });

}

// ════════════════════════════════════════════════════════════════════════════
// PAGE 2 — The Main Hierarchy
// ════════════════════════════════════════════════════════════════════════════

/**
 * Horizontal lollipop chart.
 * Metric switcher: totalWords | episodeCount | avgWordsPerEpisode
 * Filtered by current scope (recurring | core).
 * Sorted descending by chosen metric.
 * Top-speaker episodes shown as small ticks on the Cartman bar.
 */
function drawPage2() {
  // Filter by scope, then top N by the chosen metric for readability
  const scope   = state.scope;
  const metric  = state.p2Metric;
  const rawData = filterByScope(DATA.hierarchy, 'scope', scope);

  // Sort by metric descending, cap at 40 for legibility
  const data = [...rawData]
    .sort((a, b) => b[metric] - a[metric])
    .slice(0, 40);

  const metricLabel = {
    totalWords:          'Total words spoken',
    episodeCount:        'Episodes appeared in',
    avgWordsPerEpisode:  'Average words per episode',
  }[metric];

  const dims = svgDims('chart-p2', {
    marginTop: 10, marginRight: 80, marginBottom: 50, marginLeft: 130,
  });
  const { g } = makeSvg('chart-p2', dims);
  const { innerW, innerH } = dims;

  // Adjust height for number of bars
  const barH   = Math.max(14, Math.min(28, (innerH - 10) / data.length));
  const totalH = data.length * barH + dims.marginTop + dims.marginBottom;

  // Re-draw SVG with correct height
  const container = d3.select('#chart-p2');
  container.selectAll('svg').remove();
  const svg2 = container.append('svg')
    .attr('width', dims.W)
    .attr('height', totalH);
  const g2 = svg2.append('g')
    .attr('transform', `translate(${dims.marginLeft},${dims.marginTop})`);
  const innerH2 = data.length * barH;
  const innerW2 = dims.W - dims.marginLeft - dims.marginRight;

  const x = d3.scaleLinear()
    .domain([0, d3.max(data, d => d[metric]) * 1.05])
    .range([0, innerW2]);

  const y = d3.scaleBand()
    .domain(data.map(d => d.character))
    .range([0, innerH2])
    .padding(0.3);

  // Grid
  g2.append('g')
    .attr('class', 'grid')
    .attr('transform', `translate(0,${innerH2})`)
    .call(d3.axisBottom(x).ticks(5).tickSize(-innerH2).tickFormat(''));

  // Stem (track line)
  g2.selectAll('.lollipop-stem')
    .data(data)
    .join('line')
    .attr('class', 'lollipop-stem')
    .attr('x1', 0)
    .attr('y1', d => y(d.character) + y.bandwidth() / 2)
    .attr('x2', d => x(d[metric]))
    .attr('y2', d => y(d.character) + y.bandwidth() / 2)
    .attr('stroke', 'var(--color-divider)')
    .attr('stroke-width', 1);

  // Dot (lollipop head)
  g2.selectAll('.lollipop-dot')
    .data(data)
    .join('circle')
    .attr('class', 'bar-rect lollipop-dot')
    .attr('cx', d => x(d[metric]))
    .attr('cy', d => y(d.character) + y.bandwidth() / 2)
    .attr('r',  Math.max(5, y.bandwidth() / 2))
    .attr('fill', d => charColor(d.character))
    .attr('opacity', 0.88)
    .on('mousemove', (event, d) => {
      showTooltip(`
        <strong>${d.character}</strong>
        <div class="t-row"><span class="t-label">Total words</span><span class="t-val">${fmt(d.totalWords)}</span></div>
        <div class="t-row"><span class="t-label">Episodes</span><span class="t-val">${d.episodeCount}</span></div>
        <div class="t-row"><span class="t-label">Avg words/ep</span><span class="t-val">${fmt(d.avgWordsPerEpisode)}</span></div>
        <div class="t-row"><span class="t-label">Top speaker</span><span class="t-val">${d.topSpeakerEpisodes} ep</span></div>
        <div class="t-row"><span class="t-label">Max ep share</span><span class="t-val">${fmtPct(d.maxEpWordShare)}</span></div>
      `, event);
    })
    .on('mouseleave', hideTooltip);

  // Value labels
  g2.selectAll('.bar-label')
    .data(data)
    .join('text')
    .attr('class', 'bar-label')
    .attr('x', d => x(d[metric]) + 8)
    .attr('y', d => y(d.character) + y.bandwidth() / 2 + 4)
    .attr('font-size', 11)
    .attr('fill', 'var(--color-text-muted)')
    .text(d => {
      if (metric === 'totalWords')         return fmt(d[metric]);
      if (metric === 'episodeCount')       return d[metric];
      if (metric === 'avgWordsPerEpisode') return fmt(d[metric]);
    });

  // Y-axis (character names)
  g2.append('g')
    .attr('class', 'axis')
    .call(d3.axisLeft(y).tickSize(0))
    .select('.domain').remove();

  g2.selectAll('.axis text')
    .attr('font-size', 12)
    .attr('fill', 'var(--color-text)');

  // X-axis
  g2.append('g')
    .attr('class', 'axis')
    .attr('transform', `translate(0,${innerH2})`)
    .call(d3.axisBottom(x).ticks(5).tickFormat(
      metric === 'episodeCount' ? d3.format('d') : d => d >= 1000 ? `${d/1000}k` : d
    ));

  g2.append('text')
    .attr('class', 'axis-label')
    .attr('x', innerW2 / 2)
    .attr('y', innerH2 + 40)
    .attr('text-anchor', 'middle')
    .text(metricLabel.toUpperCase());

  // Update container height
  document.getElementById('chart-p2').style.minHeight = `${totalH}px`;
}

// ════════════════════════════════════════════════════════════════════════════
// PAGE 3 — How Importance Changes by Season
// ════════════════════════════════════════════════════════════════════════════

/**
 * Multi-line chart (share view) or bump chart (rank view).
 * Core recurring characters only (12+ episodes) — keeps chart readable.
 * Line hover highlights selected character, dims others.
 */
function drawPage3() {
  const allSeries = DATA['seasonal-share'].series;

  // Pick top N core characters by overall word volume for legibility
  // We rank by sum of share across all seasons
  const ranked = allSeries
    .map(s => ({
      ...s,
      totalShare: d3.sum(s.data, d => d.share),
    }))
    .sort((a, b) => b.totalShare - a.totalShare)
    .slice(0, 16);  // top 16 is readable

  const seasons = DATA['seasonal-share'].seasons;
  const view    = state.p3View;

  const dims = svgDims('chart-p3', {
    marginTop: 20, marginRight: 130, marginBottom: 50, marginLeft: 50,
  });
  const { g } = makeSvg('chart-p3', dims);
  const { innerW, innerH } = dims;

  // Scales
  const x = d3.scalePoint()
    .domain(seasons)
    .range([0, innerW])
    .padding(0.2);

  let y;
  if (view === 'share') {
    const maxShare = d3.max(ranked, s => d3.max(s.data, d => d.share));
    y = d3.scaleLinear()
      .domain([0, maxShare * 1.1])
      .nice()
      .range([innerH, 0]);
  } else {
    // Rank view: rank 1 at top
    const maxRank = d3.max(ranked, s => d3.max(s.data, d => d.rank || 0)) || ranked.length;
    y = d3.scaleLinear()
      .domain([1, maxRank])
      .range([0, innerH]);
  }

  // Grid
  if (view === 'share') addGrid(g, y, false, 5, innerW, innerH);

  // Axes
  g.append('g')
    .attr('class', 'axis')
    .attr('transform', `translate(0,${innerH})`)
    .call(d3.axisBottom(x).tickFormat(d => `S${d}`));

  if (view === 'share') {
    g.append('g')
      .attr('class', 'axis')
      .call(d3.axisLeft(y).ticks(5).tickFormat(d3.format('.0%')));
  } else {
    g.append('g')
      .attr('class', 'axis')
      .call(d3.axisLeft(y).ticks(ranked.length).tickFormat(d => `#${d}`));
  }

  // Draw lines
  const lineGen = d3.line()
    .defined(d => view === 'share' ? d.share > 0 : (d.rank > 0))
    .x(d => x(d.season))
    .y(d => view === 'share' ? y(d.share) : y(d.rank))
    .curve(d3.curveMonotoneX);

  const lines = g.selectAll('.season-line')
    .data(ranked)
    .join('path')
    .attr('class', 'season-line')
    .attr('d', s => lineGen(s.data))
    .attr('stroke', s => charColor(s.character))
    .attr('fill', 'none')
    .attr('stroke-width', 2)
    .attr('opacity', 0.85);

  // End-of-line labels (anti-collision — only label characters with enough separation)
  const TOP_LABEL_CHARS = new Set(['Cartman', 'Stan', 'Kyle', 'Randy', 'Butters', 'Mr. Garrison']);
  const usedEndY = [];
  const END_GAP = 13;

  // Sort by y-position to place labels from top to bottom
  const labelCandidates = ranked
    .map(s => {
      const lastPoint = s.data[s.data.length - 1];
      if (!lastPoint || (view === 'share' && lastPoint.share === 0)) return null;
      const yVal = view === 'share' ? y(lastPoint.share) : y(lastPoint.rank || 0);
      return { s, yVal, lastPoint };
    })
    .filter(Boolean)
    .sort((a, b) => a.yVal - b.yVal);

  labelCandidates.forEach(({ s, yVal, lastPoint }) => {
    const isFocus = TOP_LABEL_CHARS.has(s.character);
    const canPlace = usedEndY.every(y => Math.abs(y - yVal) >= END_GAP);
    if (!isFocus && !canPlace) return;
    if (isFocus || canPlace) {
      g.append('text')
        .attr('x', x(lastPoint.season) + 6)
        .attr('y', yVal + 4)
        .attr('font-size', 11)
        .attr('font-weight', isFocus ? 600 : 400)
        .attr('fill', charColor(s.character))
        .text(s.character);
      usedEndY.push(yVal);
    }
  });

  // Interaction: hover line highlights it, dims others
  const handleMouseOver = (_, hovered) => {
    lines
      .attr('opacity', s => s.character === hovered.character ? 1 : 0.1)
      .attr('stroke-width', s => s.character === hovered.character ? 3 : 1)
      .classed('dimmed', s => s.character !== hovered.character);
  };
  const handleMouseOut = () => {
    lines.attr('opacity', 0.85).attr('stroke-width', 2).classed('dimmed', false);
  };

  // Invisible wider hit-area lines
  g.selectAll('.season-line-hit')
    .data(ranked)
    .join('path')
    .attr('d', s => lineGen(s.data))
    .attr('stroke', 'transparent')
    .attr('stroke-width', 12)
    .attr('fill', 'none')
    .attr('cursor', 'pointer')
    .on('mouseover', handleMouseOver)
    .on('mousemove', (event, s) => {
      // Find closest season
      const [mx] = d3.pointer(event, g.node());
      const closest = seasons.reduce((prev, cur) => {
        return Math.abs(x(cur) - mx) < Math.abs(x(prev) - mx) ? cur : prev;
      });
      const point = s.data.find(d => d.season === closest);
      if (!point) return;
      showTooltip(`
        ${characterTooltipHeader(s.character)}
        <div class="t-row"><span class="t-label">Season</span><span class="t-val">${closest}</span></div>
        <div class="t-row"><span class="t-label">Word share</span><span class="t-val">${fmtPct(point.share)}</span></div>
        <div class="t-row"><span class="t-label">Words</span><span class="t-val">${fmt(point.words)}</span></div>
        <div class="t-row"><span class="t-label">Episodes</span><span class="t-val">${point.episodes}</span></div>
        ${view === 'rank' ? `<div class="t-row"><span class="t-label">Rank</span><span class="t-val">#${point.rank}</span></div>` : ''}
      `, event);
    })
    .on('mouseout', () => { handleMouseOut(); hideTooltip(); });

  // Legend
  const legendEl = document.getElementById('legend-p3');
  legendEl.innerHTML = '';
  ranked.forEach(s => {
    const item = document.createElement('div');
    item.className = 'legend-item';
    if (PORTRAIT_CHARACTERS.has(s.character)) {
      const portrait = buildPortraitNode(s.character, { size: 22, ringColor: charColor(s.character) });
      portrait.style.marginRight = '6px';
      item.appendChild(portrait);
    } else {
      const swatch = document.createElement('span');
      swatch.className = 'legend-swatch';
      swatch.style.background = charColor(s.character);
      item.appendChild(swatch);
    }

    const label = document.createElement('span');
    label.textContent = s.character;
    item.appendChild(label);

    item.addEventListener('mouseenter', () => handleMouseOver(null, s));
    item.addEventListener('mouseleave', handleMouseOut);
    legendEl.appendChild(item);
  });
}

// ════════════════════════════════════════════════════════════════════════════
// PAGE 4 — Character Run Across Episodes
// ════════════════════════════════════════════════════════════════════════════

/**
 * Heatmap: rows = seasons, columns = episodes within season.
 * One cell per episode.
 * Colour intensity = words spoken in that episode.
 * Empty cells = character absent from that episode.
 * Selected character controlled via <select>.
 */
function drawPage4(characterName) {
  if (!characterName) return;

  const allEps = DATA['episode-runs'].episodes;
  const runs   = DATA['episode-runs'].runs[characterName] || [];

  // Index character's episodes by epKey for O(1) lookup
  const runsMap = {};
  runs.forEach(r => { runsMap[r.epKey] = r; });

  // Compute max words for colour scale (character-local)
  const maxWords = d3.max(runs, d => d.words) || 1;

  const dims = svgDims('chart-p4', {
    marginTop: 30, marginRight: 20, marginBottom: 20, marginLeft: 40,
  });
  const { g } = makeSvg('chart-p4', dims);
  const { innerW, innerH } = dims;

  // Group episodes by season
  const seasons = d3.group(allEps, d => d.season);
  const seasonList = Array.from(seasons.keys()).sort((a, b) => a - b);
  const maxEpsPerSeason = d3.max(seasonList, s => seasons.get(s).length);

  const cellGap = 2;
  const cellH   = Math.max(14, (innerH - seasonList.length * cellGap) / seasonList.length);
  const cellW   = Math.max(8, (innerW - maxEpsPerSeason * cellGap) / maxEpsPerSeason);

  // Re-size the chart area to fit
  const neededH = seasonList.length * (cellH + cellGap) + dims.marginTop + dims.marginBottom;
  document.getElementById('chart-p4').style.minHeight = `${neededH}px`;

  // Colour scale: sequential from surface to character colour
  const color = d3.scaleSequential()
    .domain([0, maxWords])
    .interpolator(d3.interpolate('var(--color-surface-offset)', charColor(characterName)));

  seasonList.forEach((season, si) => {
    const eps = seasons.get(season).sort((a, b) => a.episode - b.episode);
    const yPos = si * (cellH + cellGap);

    // Season label
    g.append('text')
      .attr('x', -8)
      .attr('y', yPos + cellH / 2 + 4)
      .attr('text-anchor', 'end')
      .attr('font-size', 10)
      .attr('fill', 'var(--color-text-faint)')
      .text(`S${season}`);

    eps.forEach((ep, ei) => {
      const xPos = ei * (cellW + cellGap);
      const run  = runsMap[ep.epKey];
      const fill = run
        ? color(run.words)
        : 'var(--color-surface-offset)';

      g.append('rect')
        .attr('class', 'heatmap-cell')
        .attr('x', xPos)
        .attr('y', yPos)
        .attr('width',  cellW)
        .attr('height', cellH)
        .attr('rx', 1)
        .attr('fill', fill)
        .attr('opacity', run ? 0.9 : 0.3)
        .on('mousemove', event => {
          if (run) {
            showTooltip(`
              <strong>${characterName}</strong>
              <div class="t-row"><span class="t-label">Episode</span><span class="t-val">S${season}E${ep.episode}</span></div>
              <div class="t-row"><span class="t-label">Words</span><span class="t-val">${fmt(run.words)}</span></div>
              <div class="t-row"><span class="t-label">Lines</span><span class="t-val">${run.lines}</span></div>
              <div class="t-row"><span class="t-label">Ep share</span><span class="t-val">${fmtPct(run.share)}</span></div>
            `, event);
          } else {
            showTooltip(`
              <strong>${characterName}</strong>
              <div class="t-row"><span class="t-label">Episode</span><span class="t-val">S${season}E${ep.episode}</span></div>
              <span style="color:var(--color-text-muted)">Not present</span>
            `, event);
          }
        })
        .on('mouseleave', hideTooltip);
    });
  });

  // Stats
  const totalWords = d3.sum(runs, d => d.words);
  const avgWords   = totalWords / runs.length;
  const peakRun    = runs.reduce((a, b) => a.words > b.words ? a : b, runs[0]);

  document.getElementById('p4-stat-ep').textContent    = runs.length;
  document.getElementById('p4-stat-words').textContent = fmt(totalWords);
  document.getElementById('p4-stat-avg').textContent   = fmt(avgWords);
  document.getElementById('p4-stat-peak').textContent  =
    peakRun ? `S${peakRun.season}E${peakRun.episode} (${fmt(peakRun.words)} words)` : '—';

  document.getElementById('p4-stats').removeAttribute('hidden');
}

/** Populate character selector for page 4 */
function populatePage4Select() {
  const sel = document.getElementById('p4-char-select');
  const chars = DATA['episode-runs'].characters;

  // Default order: by total words (derived from hierarchy)
  const byWords = {};
  DATA.hierarchy.forEach(h => { byWords[h.character] = h.totalWords; });
  const sorted = [...chars].sort((a, b) => (byWords[b] || 0) - (byWords[a] || 0));

  sorted.forEach(c => {
    const opt = document.createElement('option');
    opt.value = c;
    opt.textContent = c;
    if (c === 'Cartman') opt.selected = true;
    sel.appendChild(opt);
  });

  sel.addEventListener('change', () => {
    state.p4Char = sel.value;
    if (state.p4Char) drawPage4(state.p4Char);
  });

  // Initial draw
  state.p4Char = 'Cartman';
  drawPage4('Cartman');
}

// ════════════════════════════════════════════════════════════════════════════
// PAGE 5 — Presence Is Not Power
// ════════════════════════════════════════════════════════════════════════════

/**
 * Slope / dumbbell chart.
 * Left column: rank by episode appearances (presence).
 * Right column: rank by total words (volume).
 * Characters with large divergence are highlighted.
 * Filtered by current scope.
 *
 * Key annotation:
 *  - Kenny: wide gap (presence >> volume)
 *  - Randy: slight gap other direction (volume > presence)
 *  - Cartman: top on both
 */
function drawPage5() {
  const data  = filterByScope(DATA['rank-divergence'], 'scope', state.scope);
  // Show top 25 by presence rank for readability
  const shown = [...data]
    .sort((a, b) => a.rankPresence - b.rankPresence)
    .slice(0, 20);

  const dims = svgDims('chart-p5', {
    marginTop: 20, marginRight: 140, marginBottom: 40, marginLeft: 140,
  });
  const { g } = makeSvg('chart-p5', dims);
  const { innerW, innerH } = dims;

  const maxRank = d3.max(shown, d => Math.max(d.rankPresence, d.rankVolume));
  const y = d3.scaleLinear()
    .domain([1, maxRank])
    .range([0, innerH]);

  // Two x-positions: left (presence) and right (volume)
  const xLeft  = 0;
  const xRight = innerW;

  // Column headers
  g.append('text')
    .attr('x', xLeft).attr('y', -8).attr('text-anchor', 'middle')
    .attr('class', 'axis-label').text('PRESENCE RANK');
  g.append('text')
    .attr('x', xRight).attr('y', -8).attr('text-anchor', 'middle')
    .attr('class', 'axis-label').text('VOLUME RANK');

  // Connecting lines
  shown.forEach(d => {
    const yL = y(d.rankPresence);
    const yR = y(d.rankVolume);
    const isHighlight = d.rankDiverge >= 5;
    const isFocus = ['Kenny', 'Randy', 'Cartman', 'Butters'].includes(d.character);

    g.append('line')
      .attr('class', `slope-line ${isFocus ? 'highlight' : ''}`)
      .attr('x1', xLeft + 6)
      .attr('y1', yL)
      .attr('x2', xRight - 6)
      .attr('y2', yR)
      .attr('stroke', isFocus ? charColor(d.character) : 'var(--color-divider)')
      .attr('stroke-width', isFocus ? 2.5 : 1)
      .attr('opacity', isHighlight || isFocus ? 1 : 0.5);
  });

  // Characters we always label (narrative focus)
  const FOCUS_CHARS = new Set(['Kenny', 'Randy', 'Cartman', 'Butters', 'Stan', 'Kyle', 'Mr. Garrison', 'Chef']);

  // Track y-positions used on each side for anti-overlap
  const usedL = [], usedR = [];
  const MIN_GAP = 14;

  function canPlace(usedArr, yPos) {
    return usedArr.every(y => Math.abs(y - yPos) >= MIN_GAP);
  }

  // Dots + labels — left side (presence)
  shown.forEach(d => {
    const yPos = y(d.rankPresence);
    const isFocus = FOCUS_CHARS.has(d.character);

    g.append('circle')
      .attr('class', 'slope-dot')
      .attr('cx', xLeft).attr('cy', yPos)
      .attr('r', isFocus ? 5 : 3.5)
      .attr('fill', charColor(d.character))
      .attr('opacity', isFocus ? 0.95 : 0.6);

    const shouldLabel = (isFocus || d.rankDiverge >= 6) && canPlace(usedL, yPos);
    if (shouldLabel) {
      g.append('text')
        .attr('x', xLeft - 10)
        .attr('y', yPos + 4)
        .attr('text-anchor', 'end')
        .attr('font-size', 11)
        .attr('fill', 'var(--color-text)')
        .attr('font-weight', isFocus ? 600 : 400)
        .text(`#${d.rankPresence} ${d.character}`);
      usedL.push(yPos);
    }
  });

  // Dots + labels — right side (volume)
  shown.forEach(d => {
    const yPos = y(d.rankVolume);
    const isFocus = FOCUS_CHARS.has(d.character);

    g.append('circle')
      .attr('class', 'slope-dot')
      .attr('cx', xRight).attr('cy', yPos)
      .attr('r', isFocus ? 5 : 3.5)
      .attr('fill', charColor(d.character))
      .attr('opacity', isFocus ? 0.95 : 0.6);

    const shouldLabel = (isFocus || d.rankDiverge >= 6) && canPlace(usedR, yPos);
    if (shouldLabel) {
      g.append('text')
        .attr('x', xRight + 10)
        .attr('y', yPos + 4)
        .attr('text-anchor', 'start')
        .attr('font-size', 11)
        .attr('fill', 'var(--color-text)')
        .attr('font-weight', isFocus ? 600 : 400)
        .text(`#${d.rankVolume} ${d.character}`);
      usedR.push(yPos);
    }
  });

  // Invisible hover rects over lines for tooltip
  shown.forEach(d => {
    const yL = y(d.rankPresence);
    const yR = y(d.rankVolume);
    // Midpoint for hover target
    const mx = innerW / 2;
    const my = (yL + yR) / 2;

    g.append('circle')
      .attr('cx', mx).attr('cy', my)
      .attr('r', 12)
      .attr('fill', 'transparent')
      .attr('cursor', 'pointer')
      .on('mousemove', event => {
        showTooltip(`
          <strong>${d.character}</strong>
          <div class="t-row"><span class="t-label">Presence rank</span><span class="t-val">#${d.rankPresence}</span></div>
          <div class="t-row"><span class="t-label">Volume rank</span><span class="t-val">#${d.rankVolume}</span></div>
          <div class="t-row"><span class="t-label">Divergence</span><span class="t-val">${d.rankDiverge} places</span></div>
          <div class="t-row"><span class="t-label">Episodes</span><span class="t-val">${d.episodeCount}</span></div>
          <div class="t-row"><span class="t-label">Total words</span><span class="t-val">${fmt(d.totalWords)}</span></div>
        `, event);
      })
      .on('mouseleave', hideTooltip);
  });
}

// ════════════════════════════════════════════════════════════════════════════
// PAGE 6 — Who Owns an Episode (Beeswarm)
// ════════════════════════════════════════════════════════════════════════════

/**
 * Beeswarm chart.
 * Each dot = one episode the character appeared in.
 * x = per-episode word share (0–1)
 * Characters stacked vertically in rows, sorted by median share.
 * Box summary overlaid.
 *
 * Uses core (12+) characters for readability.
 */
function drawPage6() {
  const shareData = DATA['episode-share'];
  // Order characters by median share, descending
  const chars = shareData.characters
    .filter(c => shareData.data[c])
    .sort((a, b) => shareData.data[b].median - shareData.data[a].median);

  if (chars.length === 0) return;

  const rowH  = 44;
  const totalH = chars.length * rowH + 80;
  document.getElementById('chart-p6').style.minHeight = `${totalH}px`;

  const dims = svgDims('chart-p6', {
    marginTop: 30, marginRight: 30, marginBottom: 50, marginLeft: 110,
  });

  const container = d3.select('#chart-p6');
  container.selectAll('svg').remove();
  const svgH = totalH;
  const svg  = container.append('svg')
    .attr('width', dims.W)
    .attr('height', svgH);
  const g = svg.append('g')
    .attr('transform', `translate(${dims.marginLeft},${dims.marginTop})`);
  const innerW = dims.W - dims.marginLeft - dims.marginRight;

  const x = d3.scaleLinear()
    .domain([0, Math.min(d3.max(chars, c => shareData.data[c].max), 0.65)])
    .range([0, innerW]);

  // Grid
  g.append('g')
    .attr('class', 'grid')
    .call(d3.axisLeft(d3.scaleLinear().domain([0,1]).range([0, chars.length * rowH]))
      .ticks(0).tickSize(-innerW).tickFormat(''));

  addGrid(g, x, true, 5, innerW, chars.length * rowH);

  g.append('g')
    .attr('class', 'axis')
    .attr('transform', `translate(0,${chars.length * rowH})`)
    .call(d3.axisBottom(x).ticks(5).tickFormat(d3.format('.0%')));

  g.append('text')
    .attr('class', 'axis-label')
    .attr('x', innerW / 2)
    .attr('y', chars.length * rowH + 40)
    .attr('text-anchor', 'middle')
    .text('SHARE OF EPISODE WORDS');

  chars.forEach((char, i) => {
    const d    = shareData.data[char];
    const cy   = i * rowH + rowH / 2;
    const r    = Math.max(3, Math.min(6, rowH * 0.12));
    const col  = charColor(char);

    // Character label
    g.append('text')
      .attr('x', -8).attr('y', cy + 4)
      .attr('text-anchor', 'end')
      .attr('font-size', 11)
      .attr('fill', 'var(--color-text)')
      .text(char);

    // IQR box
    g.append('rect')
      .attr('x',      x(d.q1))
      .attr('y',      cy - rowH * 0.22)
      .attr('width',  Math.max(1, x(d.q3) - x(d.q1)))
      .attr('height', rowH * 0.44)
      .attr('fill',   col)
      .attr('opacity', 0.12)
      .attr('rx', 2);

    // Median line
    g.append('line')
      .attr('x1', x(d.median)).attr('y1', cy - rowH * 0.22)
      .attr('x2', x(d.median)).attr('y2', cy + rowH * 0.22)
      .attr('stroke', col)
      .attr('stroke-width', 2.5)
      .attr('opacity', 0.8);

    // Dots (simulate beeswarm with jitter)
    // Use a simple offset to avoid D3 force (lighter weight)
    const sorted = [...d.shares].sort((a, b) => a - b);
    const spread = rowH * 0.38;

    sorted.forEach((share, di) => {
      // Bin dots that are very close together vertically
      const jitter = ((di % 5) - 2) * (spread / 4.5);
      g.append('circle')
        .attr('class', 'bee-dot')
        .attr('cx', x(share))
        .attr('cy', cy + jitter)
        .attr('r',  r)
        .attr('fill', col)
        .attr('opacity', 0.55)
        .on('mousemove', event => {
          showTooltip(`
            <strong>${char}</strong>
            <div class="t-row"><span class="t-label">Ep word share</span><span class="t-val">${fmtPct(share)}</span></div>
            <div class="t-row"><span class="t-label">Median</span><span class="t-val">${fmtPct(d.median)}</span></div>
            <div class="t-row"><span class="t-label">Max</span><span class="t-val">${fmtPct(d.max)}</span></div>
          `, event);
        })
        .on('mouseleave', hideTooltip);
    });

    // Max label for notable characters
    if (['Cartman', 'Randy', 'Butters'].includes(char)) {
      g.append('text')
        .attr('x', x(d.max) + 4)
        .attr('y', cy - 2)
        .attr('font-size', 9)
        .attr('fill', col)
        .text(`max ${fmtPct(d.max)}`);
    }
  });
}

// ════════════════════════════════════════════════════════════════════════════
// PAGE 7 — The Ensemble Machine
// ════════════════════════════════════════════════════════════════════════════

/**
 * Clustered scatterplot.
 * x = episodeCoverage
 * y = avgWordsPerEpisode
 * Colour = cluster (anchor / spotlight / adult_support / school_support / other)
 * Size = totalWords (log scale)
 * Scope-filtered; 'all' shows guest long-tail in faint grey.
 */

const CLUSTER_LABELS = {
  anchor:         'Anchor (main 4)',
  spotlight:      'Spotlight character',
  adult_support:  'Adult support',
  school_support: 'School / kids',
  other_recurring:'Other recurring',
  guest:          'Guest / one-off',
};

const CLUSTER_COLORS = {
  anchor:         'var(--cluster-anchor)',
  spotlight:      'var(--cluster-spotlight)',
  adult_support:  'var(--cluster-adult)',
  school_support: 'var(--cluster-school)',
  other_recurring:'var(--cluster-other)',
  guest:          'var(--cluster-guest)',
};

function drawPage7() {
  const allData = DATA.ensemble;
  // Apply scope filter
  const filtered = state.scope === 'all'
    ? allData
    : allData.filter(d => d.scope === state.scope || d.scope === 'core' ||
        (state.scope === 'recurring' && d.scope === 'recurring'));

  const dims = svgDims('chart-p7', {
    marginTop: 20, marginRight: 50, marginBottom: 55, marginLeft: 65,
  });
  const { g } = makeSvg('chart-p7', dims);
  const { innerW, innerH } = dims;

  const x = d3.scaleLinear()
    .domain([0, d3.max(filtered, d => d.episodeCoverage) * 1.05])
    .range([0, innerW]);

  const y = d3.scaleLinear()
    .domain([0, d3.max(filtered, d => d.avgWordsPerEpisode) * 1.08])
    .nice()
    .range([innerH, 0]);

  const rScale = d3.scaleSqrt()
    .domain([0, d3.max(filtered, d => d.totalWords)])
    .range([3, 18]);

  addGrid(g, x, true,  5, innerW, innerH);
  addGrid(g, y, false, 5, innerW, innerH);

  g.append('g')
    .attr('class', 'axis')
    .attr('transform', `translate(0,${innerH})`)
    .call(d3.axisBottom(x).ticks(5).tickFormat(fmtPct));

  g.append('g')
    .attr('class', 'axis')
    .call(d3.axisLeft(y).ticks(5).tickFormat(d => `${d3.format(',')(Math.round(d))}`));

  g.append('text')
    .attr('class', 'axis-label')
    .attr('x', innerW / 2)
    .attr('y', innerH + 42)
    .attr('text-anchor', 'middle')
    .text('EPISODE COVERAGE');

  g.append('text')
    .attr('class', 'axis-label')
    .attr('transform', 'rotate(-90)')
    .attr('x', -(innerH / 2))
    .attr('y', -50)
    .attr('text-anchor', 'middle')
    .text('AVG WORDS / EPISODE');

  // Sort: guests first, anchors last (painted on top)
  const clusterOrder = { guest: 0, other_recurring: 1, school_support: 2, adult_support: 3, spotlight: 4, anchor: 5 };
  const sorted = [...filtered].sort((a, b) =>
    (clusterOrder[a.cluster] || 0) - (clusterOrder[b.cluster] || 0)
  );

  g.selectAll('.bubble')
    .data(sorted)
    .join('circle')
    .attr('class', 'bubble')
    .attr('cx', d => x(d.episodeCoverage))
    .attr('cy', d => y(d.avgWordsPerEpisode))
    .attr('r',  d => rScale(d.totalWords))
    .attr('fill', d => CLUSTER_COLORS[d.cluster] || 'var(--cluster-other)')
    .attr('opacity', d => d.cluster === 'guest' ? 0.3 : 0.78)
    .attr('stroke', 'var(--color-bg)')
    .attr('stroke-width', 0.5)
    .on('mousemove', (event, d) => {
      showTooltip(`
        <strong>${d.character}</strong>
        <div class="t-row"><span class="t-label">Cluster</span><span class="t-val">${CLUSTER_LABELS[d.cluster]}</span></div>
        <div class="t-row"><span class="t-label">Episodes</span><span class="t-val">${d.episodeCount} (${fmtPct(d.episodeCoverage)})</span></div>
        <div class="t-row"><span class="t-label">Total words</span><span class="t-val">${fmt(d.totalWords)}</span></div>
        <div class="t-row"><span class="t-label">Avg words/ep</span><span class="t-val">${fmt(d.avgWordsPerEpisode)}</span></div>
        <div class="t-row"><span class="t-label">Max ep share</span><span class="t-val">${fmtPct(d.maxEpWordShare)}</span></div>
      `, event);
    })
    .on('mouseleave', hideTooltip);

  // Labels for anchor characters
  sorted.filter(d => d.cluster === 'anchor').forEach(d => {
    g.append('text')
      .attr('x', x(d.episodeCoverage) + 8)
      .attr('y', y(d.avgWordsPerEpisode) + 4)
      .attr('font-size', 11)
      .attr('font-weight', 600)
      .attr('fill', 'var(--color-text)')
      .text(d.character);
  });

  // Cluster legend
  const legendEl = document.getElementById('cluster-legend');
  legendEl.innerHTML = '';
  Object.entries(CLUSTER_LABELS).forEach(([key, label]) => {
    const item = document.createElement('div');
    item.className = 'legend-item';
    item.innerHTML = `
      <span class="legend-swatch" style="background:${CLUSTER_COLORS[key]}"></span>
      <span>${label}</span>
    `;
    legendEl.appendChild(item);
  });
}

// ════════════════════════════════════════════════════════════════════════════
// THEME TOGGLE
// ════════════════════════════════════════════════════════════════════════════

function initThemeToggle() {
  const btn  = document.querySelector('[data-theme-toggle]');
  const root = document.documentElement;

  // Default to system preference
  let theme = matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  root.setAttribute('data-theme', theme);
  updateThemeIcon(btn, theme);

  btn.addEventListener('click', () => {
    theme = theme === 'dark' ? 'light' : 'dark';
    root.setAttribute('data-theme', theme);
    updateThemeIcon(btn, theme);
    // Redraw charts to pick up new CSS variable colours
    redrawAll();
  });
}

function updateThemeIcon(btn, theme) {
  btn.setAttribute('aria-label', `Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`);
  btn.innerHTML = theme === 'dark'
    ? `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="5"/><path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/></svg>`
    : `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>`;
}

// ════════════════════════════════════════════════════════════════════════════
// SCOPE CONTROL (global)
// ════════════════════════════════════════════════════════════════════════════

function initScopeControl() {
  const meta = DATA.meta;
  document.getElementById('scope-count-recurring').textContent = `(${meta.recurringCount})`;
  document.getElementById('scope-count-core').textContent      = `(${meta.coreCount})`;

  document.querySelectorAll('.scope-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const newScope = btn.dataset.scope;
      if (newScope === state.scope) return;
      state.scope = newScope;
      document.querySelectorAll('.scope-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      redrawAll();
    });
  });
}

// ════════════════════════════════════════════════════════════════════════════
// PAGE 1 SCOPE BUTTONS (local long-tail toggle)
// ════════════════════════════════════════════════════════════════════════════

function initPage1ScopeToggle() {
  document.querySelectorAll('[data-p1scope]').forEach(btn => {
    btn.addEventListener('click', () => {
      state.p1Scope = btn.dataset.p1scope;
      document.querySelectorAll('[data-p1scope]').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      drawPage1();
    });
  });
}

// ════════════════════════════════════════════════════════════════════════════
// PAGE 2 METRIC SWITCHER
// ════════════════════════════════════════════════════════════════════════════

function initMetricSwitcher() {
  document.querySelectorAll('[data-metric]').forEach(btn => {
    btn.addEventListener('click', () => {
      state.p2Metric = btn.dataset.metric;
      document.querySelectorAll('[data-metric]').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      drawPage2();
    });
  });
}

// ════════════════════════════════════════════════════════════════════════════
// PAGE 3 VIEW SWITCHER (share vs rank)
// ════════════════════════════════════════════════════════════════════════════

function initSeasonViewSwitcher() {
  document.querySelectorAll('[data-seasonview]').forEach(btn => {
    btn.addEventListener('click', () => {
      state.p3View = btn.dataset.seasonview;
      document.querySelectorAll('[data-seasonview]').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      drawPage3();
    });
  });
}

// ════════════════════════════════════════════════════════════════════════════
// ACTIVE NAV LINK ON SCROLL
// ════════════════════════════════════════════════════════════════════════════

function initScrollSpy() {
  const sections = document.querySelectorAll('.page-section');
  const links    = document.querySelectorAll('.page-nav__link');

  const observer = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        const pageNum = entry.target.dataset.page;
        links.forEach(l => {
          l.classList.toggle('active', l.dataset.page === pageNum);
        });
      }
    });
  }, { rootMargin: '-40% 0px -55% 0px' });

  sections.forEach(s => observer.observe(s));
}

// ════════════════════════════════════════════════════════════════════════════
// META STATS FILL
// ════════════════════════════════════════════════════════════════════════════

function fillMetaStats() {
  const m = DATA.meta;
  document.getElementById('meta-seasons').textContent  = m.seasonsInDataset;
  document.getElementById('meta-episodes').textContent = d3.format(',')(m.episodesInDataset);
  document.getElementById('meta-words').textContent    = d3.format(',')(m.wordsInDataset);
  document.getElementById('meta-speakers').textContent = d3.format(',')(m.totalSpeakers);
  document.getElementById('meta-one-ep-pct').textContent = Math.round(m.oneEpisodeShare * 100);
  document.getElementById('meta-ep-count').textContent = m.episodesInDataset;
}

// ════════════════════════════════════════════════════════════════════════════
// RESIZE HANDLER — redraw all charts on significant resize
// ════════════════════════════════════════════════════════════════════════════

let resizeTimer;
function handleResize() {
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(redrawAll, 250);
}

function redrawAll() {
  drawPage1();
  drawPage2();
  drawPage3();
  if (state.p4Char) drawPage4(state.p4Char);
  drawPage5();
  drawPage6();
  drawPage7();
}

// ════════════════════════════════════════════════════════════════════════════
// INIT
// ════════════════════════════════════════════════════════════════════════════

function renderLevel1() {
  if (!rootEl) return;
  rootEl.innerHTML = LEVEL1_TEMPLATE;
  // Fill meta stats
  fillMetaStats();
  renderSouthPark101Cast();

  // Wire up controls
  initScopeControl();
  initPage1ScopeToggle();
  initMetricSwitcher();
  initSeasonViewSwitcher();

  // Populate page 4 selector (also triggers first draw)
  populatePage4Select();

  // Draw all pages
  drawPage1();
  drawPage2();
  drawPage3();
  drawPage5();
  drawPage6();
  drawPage7();
}

export const level1View = {
  id: 'level-1',
  label: 'Level 1: Character Importance',
  shortLabel: 'Level 1',
  defaultSection: 'level-1-intro',
  sections: [
    { id: 'level-1-intro', label: 'Overview' },
    { id: 'page-0', label: 'South Park 101' },
    { id: 'page-1', label: 'Importance' },
    { id: 'page-3', label: 'Seasons' },
    { id: 'page-4', label: 'Episode runs' },
    { id: 'page-7', label: 'Ensemble' },
  ],
  async init(ctx) {
    rootEl = ctx.container;
    assignData(await ctx.loadLevelData('level-1'));
    window.addEventListener('resize', handleResize);
  },
  async render(ctx) {
    rootEl = ctx.container;
    if (!DATA.meta) {
      assignData(await ctx.loadLevelData('level-1'));
    }
    renderLevel1();
  },
  destroy() {
    window.removeEventListener('resize', handleResize);
    hideTooltip();
    if (rootEl) {
      rootEl.innerHTML = '';
    }
  },
};
