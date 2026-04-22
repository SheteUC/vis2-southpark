# South Park — Dialogue Anatomy

A level-based South Park dialogue explorer built on the public transcript dataset.
The app is organized around the course milestones so Level 1, 2, 3, and 4 each have their own routed view and their own internal navigation.

---

## What It Is

Plain HTML / CSS / JavaScript with D3 v7. No framework, minimal tooling.
Vite is used only for module bundling and the ES module import of D3.
The site is fully static after build — no server required.

---

## Dataset

- **Source:** [South Park dialogue dataset](https://github.com/yaylinda/south-park-dialog)
- **CSV:** `south-park-data.csv` — columns: `Season`, `Episode`, `Character`, `Line`
- **Coverage:** Seasons 1–18, 257 episodes, 142,442 raw rows
- **After cleaning:** 70,876 lines, 813,625 words, 3,948 unique speakers

---

## Preprocessing

Run `python preprocess.py` from the project root to regenerate the derived JSON data files used by the routed app shell.

### Name normalisation (conservative)

- Trim and collapse whitespace
- Drop empty strings, single-character labels, purely numeric names
- No fuzzy merging — canonical dataset labels are kept unless obviously junk

### Filtering model

The dataset has 3,948 unique speakers after cleaning:

| Tier | Threshold | Count | Notes |
|------|-----------|-------|-------|
| One-off / guest | 1 episode | 3,096 | 78.42% of all speakers |
| Recurring | **≥ 8 episodes** | **165** | Default view throughout the UI |
| Core recurring | **≥ 12 episodes** | **105** | Stricter view; used for seasonal chart |

The global scope control in the header switches between "Recurring" (default) and "Core".
Page 1 adds a third option to show all speakers for long-tail context.

### Metrics produced per character

| Metric | Definition |
|--------|-----------|
| `episodeCount` | Distinct (Season, Episode) pairs where the character has at least one line |
| `totalWords` | Sum of word counts across all their lines |
| `totalLines` | Count of dialogue rows |
| `avgWordsPerLine` | `totalWords / totalLines` |
| `avgWordsPerEpisode` | `totalWords / episodeCount` |
| `topSpeakerEpisodes` | Episodes where this character has more words than any other character |
| `maxEpWordShare` | Max of `(charWords / episodeTotalWords)` across all episodes appeared in |
| `seasonWordShare` | Per season: `(charSeasonWords / seasonTotalWords)` |

### Output files (in `public/data/`)

| File | Used by | Content |
|------|---------|---------|
| `meta.json` | All routes | Dataset-level stats and filter thresholds |
| `overview.json` | Level 1 | All speakers with scope tags and summary metrics |
| `hierarchy.json` | Level 1 | Recurring-cast ranking metrics |
| `seasonal-share.json` | Level 1 | Core-cast seasonal share and rank history |
| `episode-runs.json` | Level 1 | Per-character episode run data |
| `rank-divergence.json` | Level 1 | Presence vs volume rank comparison |
| `episode-share.json` | Level 1 | Per-episode ownership distributions |
| `ensemble.json` | Level 1 | Cast architecture clusters |
| `character-text.json` | Level 2 | Per-character top words, phrases, sample lines, and season slices |
| `character-by-season.json` | Level 2 | Per-character seasonal totals |
| `major-characters.json` | Level 2 | Character summary stats for language view cards |
| `fun-facts-summary.json` | Overview / Methods | Dataset summary and supporting notes |
| `relationship-network.json` | Level 3 | Approximate interaction graph overall and by season |
| `phrase-trends.json` | Level 4 | Searchable word and phrase trend index with top speakers |

---

## App Structure

### Overview
Landing page for the project with dataset coverage, assignment framing, and links into each level.

### Level 1 — Character Importance
Preserves the original seven-chart narrative:
who matters overall, hierarchy, seasonal change, episode runs, presence vs power, episode ownership, and the ensemble machine.

### Level 2 — Character Language
Character selector plus whole-show or season scope.
Includes a word cloud, repeated phrases, sample lines, and a seasonal dialogue volume chart.

### Level 3 — Character Relationships
Approximate interaction network based on adjacent dialogue turns in each episode.
Includes a season filter, top-pair list, and details-on-demand panel.

### Level 4 — Phrase Evolution
Searchable trend view for indexed words and short phrases.
Shows season-by-season counts, top speakers, and sample mentions.

### Methods / Sources
Documents filtering decisions, preprocessing logic, design rationale, and deployment assumptions.

---

## Key Findings

| Character | Total words | Episodes | Top-speaker eps | Max ep share |
|-----------|------------|----------|-----------------|-------------|
| Cartman   | 130,037    | 244      | **102**         | 55.69%      |
| Stan      | 68,977     | 243      | 24              | 31.11%      |
| Kyle      | 63,736     | 241      | 16              | 28.92%      |
| Randy     | 31,121     | 129      | 19              | 39.00%      |
| Butters   | 29,420     | 165      | 8               | 45.43%      |
| Kenny     | 4,168      | 161      | 0               | —           |

**Narrative framing:**
- **Cartman** is structurally dominant — not just verbose. 102 top-speaker episodes is nearly the combined total of everyone else.
- **Stan and Kyle** are steady anchors. High coverage, consistent volume, low ceiling.
- **Randy and Butters** are spotlight characters / episode hijackers. When the episode belongs to them, they take over completely.
- **Kenny** is the quietest frequent character in the dataset — present but near-silent.

---

## Install & Run

```bash
# Install dependencies (D3 + Vite only)
npm install

# Regenerate JSON data files
python preprocess.py

# Development server (hot reload)
npm run dev

# Production build → dist/
npm run build

# Preview production build locally
npm run preview
```

Requirements: Node ≥ 18, Python 3 with `pandas` and `numpy`.

---

## Design Notes

- **Level-based information architecture.** Primary navigation chooses the assignment level; secondary navigation changes with the current route.
- **South Park–inspired but editorial.** Off-white parchment surfaces, slate blue primary accent, ochre highlights, and a paper-cutout mountain sign system.
- **Lazy data loading.** Each level fetches only the datasets it needs, then caches them for revisits.
- **Static deployment friendly.** Plain HTML, CSS, and JavaScript with Vite and D3; no framework routing dependency required.
- **Responsive.** Primary and secondary navigation stay usable on mobile, and routed charts re-render on resize.
