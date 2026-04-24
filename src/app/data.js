const LEVEL_DATASETS = {
  overview: ['meta'],
  'level-1': ['meta', 'overview', 'hierarchy', 'seasonal-share', 'episode-runs', 'rank-divergence', 'episode-share', 'ensemble'],
  'level-2': [],
  'level-3': [],
  'level-4': ['pair-dialogue'],
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
