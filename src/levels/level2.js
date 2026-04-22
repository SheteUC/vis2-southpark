function renderEmptyLevel(rootEl, levelNumber, title, summary) {
  rootEl.innerHTML = `
    <section id="level-2-summary" class="level-shell">
      <div class="section-inner level-hero">
        <div class="level-hero__copy">
          <span class="level-hero__eyebrow">Level ${levelNumber}</span>
          <h1 class="level-hero__title">${title}</h1>
          <p class="level-hero__lede">
            ${summary}
          </p>
        </div>
      </div>
    </section>
  `;
}

export const level2View = {
  id: 'level-2',
  label: 'Level 2: Character Language',
  shortLabel: 'Level 2',
  defaultSection: 'level-2-summary',
  sections: [
    { id: 'level-2-summary', label: 'Empty' },
  ],
  render(ctx) {
    renderEmptyLevel(
      ctx.container,
      2,
      'Character Language',
      'This level is intentionally empty for now. The route is here so the project structure stays organized while you decide what to add next.'
    );
  },
  destroy(ctx) {
    ctx.container.innerHTML = '';
  },
};
