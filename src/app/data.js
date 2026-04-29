const LEVEL_DATASETS = {
  overview: ['meta'],
  'level-1': ['meta', 'overview', 'hierarchy', 'seasonal-share', 'episode-runs', 'rank-divergence', 'episode-share', 'ensemble'],
  'level-2': ['character-text'],
  'level-3': ['network', 'hierarchy'],
  'level-4': ['pair-dialogue', 'character-text', 'episode-timing', 'kenny-deaths'],
};

export function createDataLoader() {
  const cache = new Map();

  async function loadDataset(name) {
    if (!cache.has(name)) {
      cache.set(
        name,
        fetch(`/data/${name}.json`)
          .then((response) => {
            if (!response.ok) {
              throw new Error(`Failed to load ${name}.json (${response.status})`);
            }
            return response.json();
          })
      );
    }

    return cache.get(name);
  }

  async function loadLevelData(levelId) {
    const names = LEVEL_DATASETS[levelId] || [];
    if (levelId === 'level-4') {
      const settled = await Promise.allSettled(names.map((name) => loadDataset(name)));
      const loaded = {};
      settled.forEach((result, i) => {
        const name = names[i];
        if (result.status === 'fulfilled') {
          loaded[name] = result.value;
        } else {
          const err = result.reason;
          console.warn(
            `[data] ${name}.json not loaded for ${levelId}:`,
            err?.message || err
          );
        }
      });
      return loaded;
    }

    const loaded = await Promise.all(
      names.map(async (name) => [name, await loadDataset(name)])
    );
    return Object.fromEntries(loaded);
  }

  return {
    loadDataset,
    loadLevelData,
  };
}
