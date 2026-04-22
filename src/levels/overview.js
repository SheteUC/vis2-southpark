export const overviewView = {
  id: 'overview',
  label: 'Overview',
  shortLabel: 'Overview',
  defaultSection: 'overview-start',
  sections: [
    { id: 'overview-start', label: 'Project' },
    { id: 'overview-roadmap', label: 'Levels' },
  ],
  async render(ctx) {
    const data = await ctx.loadLevelData('overview');
    const meta = data.meta;

    ctx.container.innerHTML = `
      <section id="overview-start" class="level-shell">
        <div class="section-inner level-hero">
          <div class="level-hero__copy">
            <span class="level-hero__eyebrow">Project Overview</span>
            <h1 class="level-hero__title">A level-based South Park dialogue explorer</h1>
            <p class="level-hero__lede">
              Each assignment level has its own view and navigation.
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
              <p>Reserved for the next milestone.</p>
            </a>
            <a class="roadmap-card" href="#level-3-network">
              <span class="roadmap-card__eyebrow">Level 3</span>
              <h3>Character Relationships</h3>
              <p>Reserved for the network milestone.</p>
            </a>
            <a class="roadmap-card" href="#level-4-search">
              <span class="roadmap-card__eyebrow">Level 4</span>
              <h3>Phrase Evolution</h3>
              <p>Reserved for the final extension.</p>
            </a>
          </div>
        </div>
      </section>
    `;
  },
  destroy(ctx) {
    ctx.container.innerHTML = '';
  },
};
