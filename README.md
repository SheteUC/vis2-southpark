# South Park — Dialogue Anatomy

A Level 1 narrative analysis site built on the South Park dialogue dataset.
Seven pages of D3-powered charts that dissect who speaks, how much, and when.

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

Run `python preprocess.py` from the project root to regenerate all JSON data files.

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

| File | Used on pages | Content |
|------|--------------|---------|
| `meta.json` | All | Dataset-level stats, filter thresholds |
| `overview.json` | 1, 7 | All 3,948 speakers with full metrics and scope tag |
| `hierarchy.json` | 2 | Recurring cast with multi-metric data |
| `seasonal-share.json` | 3 | Core cast seasonal word share and rank by season |
| `episode-runs.json` | 4 | Per-character episode-by-episode words (sparse) |
| `rank-divergence.json` | 5 | Presence rank vs volume rank for recurring cast |
| `episode-share.json` | 6 | Per-episode word share distributions with box stats |
| `ensemble.json` | 7 | All characters with cluster classification |

---

## The Seven Pages

### 01 — Who Actually Matters
Scatterplot: x = episode coverage, y = total words, bubble size = max single-episode word share.
Annotations call out the key narrative archetypes: anchors (Cartman, Stan, Kyle), spotlight characters (Randy, Butters), and the quiet frequent (Kenny).

### 02 — The Main Hierarchy
Horizontal lollipop chart of recurring cast sorted by the selected metric.
**Metric switcher:** total words / episodes appeared / avg words per episode.

### 03 — How Importance Changes by Season
Multi-line chart (word share view) or bump chart (rank view) for the core recurring cast.
Line hover highlights one character and dims the rest.
Shows Cartman's stable dominance and Randy/Butters's mid-series rise.

### 04 — Character Run Across Episodes
Episode heatmap: 18 rows (one per season), columns = episodes within each season.
Colour intensity = words spoken by the selected character. White = absent.
Stats row below shows totals and the peak episode.

### 05 — Presence Is Not Power
Slope chart comparing rank by episode appearances (left) to rank by total words (right).
Kenny's dramatic drop from #5 presence → #20 volume is the headline story.
Randy shows the opposite: fewer episodes but more words per appearance.

### 06 — Who Owns an Episode
Beeswarm with box summary per character.
Each dot = one episode the character appeared in; x = share of that episode's words.
Cartman's ceiling: 55.7%. Stan/Kyle: capped around 30%. Randy/Butters: bimodal — quiet or dominant.

### 07 — The Ensemble Machine
Clustered scatterplot: x = episode coverage, y = avg words per episode, size = total words.
Colour = cast cluster (anchor / spotlight / adult support / school kids / other recurring / guest).
Scope filter controls which characters appear.

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

- **South Park–inspired but editorial.** Off-white parchment surfaces, slate blue primary accent, ochre data highlight. Paper-cutout mountain silhouette in the SVG logo.
- **Light + dark mode.** System preference default with manual toggle. CSS variables update all chart colours on switch.
- **No framework overhead.** Entire app is 87 kB bundled JS (including D3). Instant first paint.
- **Responsive.** Mobile-first layout; charts re-render on resize. Heatmap and beeswarm adapt to narrow viewports.
- **Accessible.** Semantic HTML, `aria-label` on charts, `role="group"` on filter controls, keyboard-navigable.
