function renderEmptyLevel(rootEl, levelNumber, sectionId, title, summary) {
  rootEl.innerHTML = `
    <section id="${sectionId}" class="level-shell">
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

export const level4View = {
  id: 'level-4',
  label: 'Level 4: Phrase Evolution',
  shortLabel: 'Level 4',
  defaultSection: 'level-4-search',
  sections: [
    { id: 'level-4-search', label: 'Empty' },
  ],
  render(ctx) {
    renderEmptyLevel(
      ctx.container,
      4,
      'level-4-search',
      'Phrase Evolution',
      'This level is intentionally empty for now. It is reserved for your final extension once you decide which advanced question you want to explore.'
    );
  },
  destroy(ctx) {
    ctx.container.innerHTML = '';
  },
};
