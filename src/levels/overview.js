const SP101_MAIN_CAST = ['Cartman', 'Stan', 'Kyle', 'Kenny', 'Butters'];
const SP101_BLURBS = {
  Cartman: 'Manipulative, loud, and often central to conflict. He drives many of the show\'s biggest satire episodes.',
  Stan: 'The grounded observer of the group. Stan often reacts to chaos and gives the audience a moral anchor.',
  Kyle: 'Idealistic and argumentative, usually pushing back when things go too far. He is often Cartman\'s foil.',
  Kenny: 'Quiet but iconic. Kenny appears constantly, with influence that is bigger than his line count.',
  Butters: 'Naive, earnest, and frequently pulled into bizarre situations. He becomes a surprising spotlight character.',
};

function sp101PortraitSrc(character) {
  const slug = character.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  return `/images/characters/${slug}.png`;
}

function sp101FormatNumber(value) {
  return Math.round(value).toLocaleString();
}

function renderOverviewSouthPark101Cast() {
  const container = document.getElementById('overview-sp101-main-cast');
  if (!container) return;

  const hierarchy = Array.isArray(container.__hierarchy) ? container.__hierarchy : [];
  const hierarchyByName = new Map(hierarchy.map((item) => [item.character, item]));
  const cast = SP101_MAIN_CAST.filter((name) => hierarchyByName.has(name));
  if (!cast.length) {
    container.innerHTML = '<p class="chart-note">Main cast data is unavailable.</p>';
    return;
  }

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

  cast.forEach((name) => {
    const stats = hierarchyByName.get(name);

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

    const portrait = document.createElement('img');
    portrait.src = sp101PortraitSrc(name);
    portrait.alt = `${name} portrait`;
    portrait.loading = 'lazy';
    portrait.style.cssText = [
      'width:58px',
      'height:58px',
      'border-radius:999px',
      'object-fit:cover',
      'border:2px solid var(--color-divider)',
      'background:var(--color-surface-offset)',
    ].join(';');
    slide.appendChild(portrait);

    const body = document.createElement('div');
    body.innerHTML = `
      <h4 style="margin:0 0 4px 0;font-size:15px;color:var(--color-text);">${name}</h4>
      <p style="margin:0 0 6px 0;font-size:12px;color:var(--color-text-muted);">${sp101FormatNumber(stats.episodeCount)} episodes · ${sp101FormatNumber(stats.totalWords)} words · ${sp101FormatNumber(stats.avgWordsPerEpisode)} avg words/ep</p>
      <p style="margin:0;font-size:13px;line-height:1.45;color:var(--color-text);">${SP101_BLURBS[name] || ''}</p>
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

  let currentIndex = 0;
  const dotButtons = cast.map((name, index) => {
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
    dot.addEventListener('click', () => setSlide(index));
    dots.appendChild(dot);
    return dot;
  });

  controls.appendChild(prevBtn);
  controls.appendChild(dots);
  controls.appendChild(nextBtn);
  container.appendChild(controls);

  function setSlide(index) {
    const size = cast.length;
    currentIndex = ((index % size) + size) % size;
    track.style.transform = `translateX(-${currentIndex * 100}%)`;
    dotButtons.forEach((dot, dotIndex) => {
      dot.style.background = dotIndex === currentIndex ? 'var(--color-accent)' : 'var(--color-surface-offset)';
    });
  }

  prevBtn.addEventListener('click', () => setSlide(currentIndex - 1));
  nextBtn.addEventListener('click', () => setSlide(currentIndex + 1));
  setSlide(0);
}

export const overviewView = {
  id: 'overview',
  label: 'Overview',
  shortLabel: 'Overview',
  defaultSection: 'overview-start',
  sections: [
    { id: 'overview-start', label: 'Project' },
    { id: 'overview-sp101', label: 'South Park 101' },
    { id: 'overview-roadmap', label: 'Levels' },
  ],
  async render(ctx) {
    const data = await ctx.loadLevelData('overview');
    const meta = data.meta;
    const hierarchy = await ctx.loadDataset('hierarchy');

    ctx.container.innerHTML = `
      <section id="overview-start" class="level-shell">
        <div class="section-inner level-hero">
          <div class="level-hero__copy">
            <h1 class="level-hero__title">Explore South Park!</h1>
            <p class="level-hero__lede">
              Some quick stats!.
            </p>
          </div>
          <div class="overview-grid">
            <article class="overview-card">
              <span class="overview-card__label">Seasons</span>
              <strong>${meta.seasonsInDataset}</strong>
            </article>
            <article class="overview-card">
              <span class="overview-card__label">Episodes</span>
              <strong>${meta.episodesInDataset}</strong>
            </article>
            <article class="overview-card">
              <span class="overview-card__label">Words</span>
              <strong>${meta.wordsInDataset.toLocaleString()}</strong>
            </article>
            <article class="overview-card">
              <span class="overview-card__label">Recurring cast</span>
              <strong>${meta.recurringCount}</strong>
            </article>
          </div>
        </div>
      </section>

      <section id="overview-sp101" class="page-section">
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

          <div id="overview-sp101-main-cast" aria-label="Main cast portraits" style="margin-top:20px;"></div>
        </div>
      </section>

      <section id="overview-roadmap" class="page-section">
        <div class="section-inner">
          <div class="section-header">
            <span class="section-num">Map</span>
            <h2 class="section-title">How the levels are organized</h2>
            <p class="section-lede">
              Each level is its own route, so the project can grow without becoming one long page.
            </p>
          </div>

          <div class="roadmap-grid">
            <a class="roadmap-card" href="#level-1-intro">
              <span class="roadmap-card__eyebrow">Level 1</span>
              <h3>Character Importance</h3>
              <p>Importance, seasons, episode runs, and ensemble structure.</p>
            </a>
            <a class="roadmap-card" href="#level-2-summary">
              <span class="roadmap-card__eyebrow">Level 2</span>
              <h3>Character Language</h3>
              <p>Understand how characters use language differently and how it changes over time.</p>
            </a>
            <a class="roadmap-card" href="#level-3-network">
              <span class="roadmap-card__eyebrow">Level 3</span>
              <h3>Character Relationships</h3>
              <p>Explore how characters interact and influence each other throughout the series.</p>
            </a>
            <a class="roadmap-card" href="#level-4-search">
              <span class="roadmap-card__eyebrow">Level 4</span>
              <h3>Phrase Evolution</h3>
              <p>Track how phrases change over time and how characters talk to each other.</p>
            </a>
          </div>
        </div>
      </section>
    `;

    const castContainer = document.getElementById('overview-sp101-main-cast');
    if (castContainer) {
      castContainer.__hierarchy = hierarchy;
    }
    renderOverviewSouthPark101Cast();
  },
  destroy(ctx) {
    ctx.container.innerHTML = '';
  },
};
