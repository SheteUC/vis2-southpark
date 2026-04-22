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

export const level3View = {
  id: 'level-3',
  label: 'Level 3: Character Relationships',
  shortLabel: 'Level 3',
  defaultSection: 'level-3-network',
  sections: [
    { id: 'level-3-network', label: 'Empty' },
  ],
  render(ctx) {
    renderEmptyLevel(
      ctx.container,
      3,
      'level-3-network',
      'Character Relationships',
      'This level is intentionally empty for now. It stays reserved for the relationship or network view when you are ready to build it.'
    );
  },
  destroy(ctx) {
    ctx.container.innerHTML = '';
  },
};
