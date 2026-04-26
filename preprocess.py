"""
South Park Level 1 — Data Preprocessor
=======================================

Reads: data/south-park-data.csv (next to this repo; override with SOUTH_PARK_CSV).
  Columns: Season (int), Episode (int), Character (str), Line (str)

Generates JSON files in public/data/:
  meta.json                — dataset-level statistics
  overview.json            — all-cast scatterplot data (page 1 / page 7)
  hierarchy.json           — recurring-cast ranking with multi-metric (page 2)
  seasonal-share.json      — per-season word share for top chars (page 3)
  episode-runs.json        — per-episode words per character (page 4)
  rank-divergence.json     — presence rank vs volume rank comparison (page 5)
  episode-share.json       — per-episode word-share distribution per character (page 6)
  ensemble.json            — cast architecture with role clusters (page 7)

FILTERING LOGIC
---------------
The dataset has 3,949 unique speakers (after name normalisation).
- 3,097 appear in only ONE episode (one-episode share ≈ 78.42 %)
- "recurring" = 8+ episode appearances (165 speakers)
- "core recurring" = 12+ episode appearances (105 speakers)

We expose three scopes:
  scope="recurring"  → 8+ episodes  (default throughout the UI)
  scope="core"       → 12+ episodes (stricter control)
  scope="all"        → everyone     (page 1 long-tail context, page 7 cluster)

NAME NORMALISATION
------------------
Conservative: trim + collapse whitespace only.
Drop rows where Character is empty, purely numeric, or is the sentinel '['.
No fuzzy merging — the canonical dataset labels are kept unless they are
obviously junk (single punctuation chars, empty strings, etc.).

METRICS PRODUCED
----------------
  episodes_appeared          – distinct episode keys a character appears in
  total_words                – sum of word counts across all their lines
  total_lines                – count of dialogue lines
  avg_words_per_line         – total_words / total_lines
  avg_words_per_episode      – total_words / episodes_appeared
  top_speaker_episodes       – episodes where the character has more words than
                               any other character in that episode
  max_episode_word_share     – max(char_words / ep_total_words) over all episodes
  seasonal_word_share        – per season: character_words / season_total_words
"""

import json
import os
import re
from pathlib import Path

import pandas as pd

# ── paths ───────────────────────────────────────────────────────────────────
ROOT = Path(__file__).resolve().parent
DATA_DIR = ROOT / 'public' / 'data'
DATA_DIR.mkdir(parents=True, exist_ok=True)
_csv_default = ROOT / 'data' / 'south-park-data.csv'
CSV_PATH = Path(os.environ.get('SOUTH_PARK_CSV', _csv_default))

# ── load ────────────────────────────────────────────────────────────────────
if not CSV_PATH.is_file():
    raise FileNotFoundError(
        f'Missing CSV: {CSV_PATH}\n'
        'Place south-park-data.csv in data/ or set SOUTH_PARK_CSV to its path.'
    )
df = pd.read_csv(CSV_PATH)

# ── basic cleaning ──────────────────────────────────────────────────────────
def clean_name(x: str) -> str:
    """
    Conservative normalisation:
    - strip leading/trailing whitespace
    - collapse internal runs of whitespace to a single space
    """
    return re.sub(r'\s+', ' ', str(x).replace('\xa0', ' ')).strip()

df['Character'] = df['Character'].map(clean_name)
df['Line']      = df['Line'].astype(str).str.strip()

# Drop junk rows:
#   - empty character names
#   - purely numeric names (episode numbers leaked into character column)
#   - single-char punctuation sentinels (e.g. '[')
#   - empty lines
junk_mask = (
    (df['Character'] == '') |
    (df['Character'].str.fullmatch(r'\d+')) |
    (df['Character'].str.len() <= 1) |
    (df['Line'] == '') |
    (df['Line'].isna())
)
df = df[~junk_mask].copy()

# Coerce Season / Episode to int
df['Season']  = df['Season'].astype(int)
df['Episode'] = df['Episode'].astype(int)

# Word count: split on whitespace
df['word_count'] = df['Line'].str.split().str.len().fillna(0).astype(int)

# Unique episode identifier (e.g. "01x05")
df['ep_key'] = (
    df['Season'].astype(str).str.zfill(2) + 'x' +
    df['Episode'].astype(str).str.zfill(2)
)

# ── episode-level totals ─────────────────────────────────────────────────────
ep_totals = (
    df.groupby(['Season', 'Episode', 'ep_key'])
    .agg(ep_total_words=('word_count', 'sum'), ep_total_lines=('Line', 'count'))
    .reset_index()
)

# ── character-episode breakdown ──────────────────────────────────────────────
char_ep = (
    df.groupby(['Character', 'Season', 'Episode', 'ep_key'])
    .agg(lines=('Line', 'count'), words=('word_count', 'sum'))
    .reset_index()
)

# Attach episode totals so we can compute word share per episode
char_ep = char_ep.merge(ep_totals[['ep_key', 'ep_total_words']], on='ep_key', how='left')
char_ep['ep_word_share'] = char_ep['words'] / char_ep['ep_total_words'].clip(lower=1)

# ── character summary ────────────────────────────────────────────────────────
char_sum = (
    char_ep.groupby('Character')
    .agg(
        total_lines    = ('lines',  'sum'),
        total_words    = ('words',  'sum'),
        episode_count  = ('ep_key', 'nunique'),
        season_count   = ('Season', 'nunique'),
    )
    .reset_index()
)
char_sum['avg_words_per_line']    = (char_sum['total_words'] / char_sum['total_lines'].clip(lower=1)).round(2)
char_sum['avg_words_per_episode'] = (char_sum['total_words'] / char_sum['episode_count'].clip(lower=1)).round(2)

# ── top-speaker episodes ─────────────────────────────────────────────────────
# For every episode find the character with the most words
ep_top = (
    char_ep.sort_values('words', ascending=False)
    .drop_duplicates(subset='ep_key', keep='first')
    [['ep_key', 'Character']]
    .rename(columns={'Character': 'top_char'})
)
top_speaker_counts = (
    ep_top.groupby('top_char')['ep_key']
    .count()
    .reset_index()
    .rename(columns={'top_char': 'Character', 'ep_key': 'top_speaker_episodes'})
)
char_sum = char_sum.merge(top_speaker_counts, on='Character', how='left')
char_sum['top_speaker_episodes'] = char_sum['top_speaker_episodes'].fillna(0).astype(int)

# ── max single-episode word share ───────────────────────────────────────────
max_share = (
    char_ep.groupby('Character')['ep_word_share']
    .max()
    .reset_index()
    .rename(columns={'ep_word_share': 'max_ep_word_share'})
)
char_sum = char_sum.merge(max_share, on='Character', how='left')
char_sum['max_ep_word_share'] = char_sum['max_ep_word_share'].round(4)

# ── filter sets ─────────────────────────────────────────────────────────────
#   recurring = 8+ episodes  (165 speakers)
#   core      = 12+ episodes (105 speakers)
recurring_chars = set(char_sum[char_sum['episode_count'] >= 8]['Character'])
core_chars      = set(char_sum[char_sum['episode_count'] >= 12]['Character'])

# ── total words per season (for share computation) ───────────────────────────
season_words = (
    df.groupby('Season')['word_count'].sum()
    .reset_index()
    .rename(columns={'word_count': 'season_total_words'})
)

# ── seasonal word share ──────────────────────────────────────────────────────
# For each character+season: their share of all words spoken that season
char_season = (
    char_ep.groupby(['Character', 'Season'])
    .agg(s_words=('words', 'sum'), s_episodes=('ep_key', 'nunique'))
    .reset_index()
)
char_season = char_season.merge(season_words, on='Season', how='left')
char_season['season_word_share'] = (char_season['s_words'] / char_season['season_total_words']).round(4)

# ── per-episode words for all recurring chars ─────────────────────────────────
# Needed for page 4 (episode run heatmap) and page 6 (beeswarm / box)
char_ep_recurring = char_ep[char_ep['Character'].isin(recurring_chars)].copy()

# ── season episode totals ────────────────────────────────────────────────────
season_ep_count = (
    ep_totals.groupby('Season')['ep_key']
    .nunique()
    .reset_index()
    .rename(columns={'ep_key': 'ep_count'})
)

# ════════════════════════════════════════════════════════════════════════════
# BUILD OUTPUTS
# ════════════════════════════════════════════════════════════════════════════

# ── meta.json ──────────────────────────────────────────────────────────────
total_speakers    = df['Character'].nunique()
one_ep_speakers   = int((char_sum['episode_count'] == 1).sum())
one_ep_share      = round(one_ep_speakers / total_speakers, 4)
seasons_in_data   = sorted(df['Season'].unique().tolist())

meta = {
    'title':             'South Park',
    'subtitle':          'A dialogue anatomy',
    'description':       'Level 1 narrative analysis of South Park dialogue across all available seasons.',
    'sourceCsv':         'https://raw.githubusercontent.com/yaylinda/south-park-dialog/master/data.csv',
    'sourceRepo':        'https://github.com/yaylinda/south-park-dialog',
    'seasonsInDataset':  len(seasons_in_data),
    'seasonRange':       [int(seasons_in_data[0]), int(seasons_in_data[-1])],
    'episodesInDataset': int(ep_totals.shape[0]),
    'linesInDataset':    int(df.shape[0]),
    'wordsInDataset':    int(df['word_count'].sum()),
    'totalSpeakers':     int(total_speakers),
    'oneEpisodeSpeakers':int(one_ep_speakers),
    'oneEpisodeShare':   float(one_ep_share),
    # Filter thresholds
    'recurringThreshold': 8,   # 8+ episodes = "recurring" (default)
    'coreThreshold':      12,  # 12+ episodes = "core recurring"
    'recurringCount':     int(len(recurring_chars)),
    'coreCount':          int(len(core_chars)),
    # Season summary
    'seasonSummary': [
        {
            'season':       int(r['Season']),
            'episodes':     int(r['ep_count']),
            'totalWords':   int(season_words[season_words['Season'] == r['Season']]['season_total_words'].values[0]),
        }
        for _, r in season_ep_count.iterrows()
    ],
}
with open(DATA_DIR / 'meta.json', 'w') as f:
    json.dump(meta, f, indent=2)
print('wrote meta.json')

# ── overview.json — Page 1 scatterplot + Page 7 ensemble context ─────────────
# Include ALL speakers with >= 1 episode (very large, but page 1 uses it for
# long-tail context; page 7 subset filtered client-side)
# We also tag each entry with their scope tier for client-side filtering.
def scope_tag(ep_count: int) -> str:
    if ep_count >= 12:
        return 'core'
    elif ep_count >= 8:
        return 'recurring'
    else:
        return 'guest'

# For the scatterplot axes:
#   x = episode coverage ratio = episode_count / total_episodes_in_dataset
total_eps = int(ep_totals.shape[0])

overview_records = []
for _, r in char_sum.iterrows():
    overview_records.append({
        'character':           r['Character'],
        'episodeCount':        int(r['episode_count']),
        'episodeCoverage':     round(int(r['episode_count']) / total_eps, 4),
        'totalWords':          int(r['total_words']),
        'totalLines':          int(r['total_lines']),
        'avgWordsPerLine':     float(r['avg_words_per_line']),
        'avgWordsPerEpisode':  float(r['avg_words_per_episode']),
        'topSpeakerEpisodes':  int(r['top_speaker_episodes']),
        'maxEpWordShare':      float(r['max_ep_word_share']),
        'scope':               scope_tag(int(r['episode_count'])),
    })

# Sort by total_words descending so top chars render last (on top) in the viz
overview_records.sort(key=lambda x: x['totalWords'], reverse=True)

with open(DATA_DIR / 'overview.json', 'w') as f:
    json.dump(overview_records, f, indent=2)
print(f'wrote overview.json  ({len(overview_records)} characters)')

# ── hierarchy.json — Page 2 bar/lollipop with metric switcher ────────────────
# Recurring cast only (8+ episodes).
# Metrics exposed: episodeCount, totalWords, avgWordsPerEpisode
hierarchy_records = []
for _, r in char_sum[char_sum['Character'].isin(recurring_chars)].iterrows():
    hierarchy_records.append({
        'character':          r['Character'],
        'episodeCount':       int(r['episode_count']),
        'totalWords':         int(r['total_words']),
        'totalLines':         int(r['total_lines']),
        'avgWordsPerEpisode': float(r['avg_words_per_episode']),
        'avgWordsPerLine':    float(r['avg_words_per_line']),
        'topSpeakerEpisodes': int(r['top_speaker_episodes']),
        'maxEpWordShare':     float(r['max_ep_word_share']),
        'scope':              scope_tag(int(r['episode_count'])),
    })
hierarchy_records.sort(key=lambda x: x['totalWords'], reverse=True)

with open(DATA_DIR / 'hierarchy.json', 'w') as f:
    json.dump(hierarchy_records, f, indent=2)
print(f'wrote hierarchy.json  ({len(hierarchy_records)} characters)')

# ── seasonal-share.json — Page 3 bump / multi-line chart ─────────────────────
# Top recurring characters (core = 12+) only to keep the chart readable.
# Provide season-by-season word share for each character.
# Also include a season-level ranking by word share so bump chart can be drawn.

top_chars_for_season = list(core_chars)

# For each character, collect their seasonal word share
seasonal_by_char = {}
for char in top_chars_for_season:
    rows = char_season[char_season['Character'] == char].sort_values('Season')
    by_season = {int(r['Season']): float(r['season_word_share']) for _, r in rows.iterrows()}
    seasonal_by_char[char] = by_season

# Build a rank table: for each season, rank core chars by word share
all_seasons_sorted = sorted(seasons_in_data)
rank_table = []  # list of {character, season, share, rank}
for s in all_seasons_sorted:
    s_data = []
    for char in top_chars_for_season:
        share = seasonal_by_char.get(char, {}).get(s, 0.0)
        s_data.append((char, share))
    s_data.sort(key=lambda x: -x[1])
    for rank_idx, (char, share) in enumerate(s_data, start=1):
        rank_table.append({'character': char, 'season': s, 'share': share, 'rank': rank_idx})

seasonal_share_output = {
    'characters': top_chars_for_season,
    'seasons':    all_seasons_sorted,
    'series':     [
        {
            'character': char,
            'data': [
                {
                    'season': s,
                    'share': seasonal_by_char.get(char, {}).get(s, 0.0),
                    'rank':  next((r['rank'] for r in rank_table if r['character'] == char and r['season'] == s), None),
                    # also include absolute words for tooltip
                    'words': int(
                        char_season[
                            (char_season['Character'] == char) & (char_season['Season'] == s)
                        ]['s_words'].sum()
                    ),
                    'episodes': int(
                        char_season[
                            (char_season['Character'] == char) & (char_season['Season'] == s)
                        ]['s_episodes'].sum()
                    ),
                }
                for s in all_seasons_sorted
            ]
        }
        for char in top_chars_for_season
    ]
}

with open(DATA_DIR / 'seasonal-share.json', 'w') as f:
    json.dump(seasonal_share_output, f, indent=2)
print(f'wrote seasonal-share.json  ({len(top_chars_for_season)} characters, {len(all_seasons_sorted)} seasons)')

# ── episode-runs.json — Page 4 character run heatmap ─────────────────────────
# For each recurring character: the list of every episode they appear in,
# with words and ep_word_share.  Client-side: user selects character, renders
# the episode timeline / heatmap.
# Episodes are identified by (Season, Episode, ep_key) triplets.

# All episode keys in order
all_eps_sorted = (
    ep_totals[['Season', 'Episode', 'ep_key', 'ep_total_words']]
    .sort_values(['Season', 'Episode'])
    .to_dict('records')
)

episode_runs_output = {
    'characters': sorted(list(recurring_chars)),
    'episodes': [
        {
            'season':     int(r['Season']),
            'episode':    int(r['Episode']),
            'epKey':      r['ep_key'],
            'totalWords': int(r['ep_total_words']),
        }
        for r in all_eps_sorted
    ],
    # Per-character episode data (sparse — only episodes they appear in)
    'runs': {}
}

for char in sorted(recurring_chars):
    rows = char_ep[char_ep['Character'] == char].sort_values(['Season', 'Episode'])
    episode_runs_output['runs'][char] = [
        {
            'epKey':      r['ep_key'],
            'season':     int(r['Season']),
            'episode':    int(r['Episode']),
            'words':      int(r['words']),
            'lines':      int(r['lines']),
            'share':      round(float(r['ep_word_share']), 4),
        }
        for _, r in rows.iterrows()
    ]

with open(DATA_DIR / 'episode-runs.json', 'w') as f:
    json.dump(episode_runs_output, f, indent=2)
print(f'wrote episode-runs.json  ({len(recurring_chars)} characters)')

# ── rank-divergence.json — Page 5 slope / dumbbell ──────────────────────────
# Rank recurring characters by:
#   rank_presence = rank by episode_count  (1 = most episodes)
#   rank_volume   = rank by total_words    (1 = most words)
# Divergence = |rank_presence - rank_volume|

rec_df = char_sum[char_sum['Character'].isin(recurring_chars)].copy()
rec_df = rec_df.sort_values('episode_count', ascending=False).reset_index(drop=True)
rec_df['rank_presence'] = rec_df['episode_count'].rank(ascending=False, method='min').astype(int)
rec_df['rank_volume']   = rec_df['total_words'].rank(ascending=False, method='min').astype(int)
rec_df['rank_diverge']  = (rec_df['rank_presence'] - rec_df['rank_volume']).abs()

rank_div_records = []
for _, r in rec_df.iterrows():
    rank_div_records.append({
        'character':    r['Character'],
        'episodeCount': int(r['episode_count']),
        'totalWords':   int(r['total_words']),
        'rankPresence': int(r['rank_presence']),
        'rankVolume':   int(r['rank_volume']),
        'rankDiverge':  int(r['rank_diverge']),
        'scope':        scope_tag(int(r['episode_count'])),
    })
rank_div_records.sort(key=lambda x: x['rankPresence'])

with open(DATA_DIR / 'rank-divergence.json', 'w') as f:
    json.dump(rank_div_records, f, indent=2)
print(f'wrote rank-divergence.json  ({len(rank_div_records)} characters)')

# ── episode-share.json — Page 6 beeswarm / box plot ─────────────────────────
# For each recurring character: the distribution of their per-episode word
# share (ep_word_share) across all episodes they appear in.
# Includes summary statistics for box-plot rendering.

ep_share_output = {'characters': [], 'data': {}}

# Only show core (12+) characters on this page to keep it scannable
for char in sorted(core_chars):
    rows = char_ep[char_ep['Character'] == char].copy()
    shares = sorted(rows['ep_word_share'].tolist())
    if len(shares) == 0:
        continue

    import numpy as np
    arr = pd.Series(shares)
    ep_share_output['characters'].append(char)
    ep_share_output['data'][char] = {
        'shares':  [round(float(s), 4) for s in shares],
        'q1':      round(float(arr.quantile(0.25)), 4),
        'median':  round(float(arr.quantile(0.50)), 4),
        'q3':      round(float(arr.quantile(0.75)), 4),
        'mean':    round(float(arr.mean()), 4),
        'max':     round(float(arr.max()), 4),
        'min':     round(float(arr.min()), 4),
        'iqr':     round(float(arr.quantile(0.75) - arr.quantile(0.25)), 4),
        'n':       int(len(shares)),
    }

with open(DATA_DIR / 'episode-share.json', 'w') as f:
    json.dump(ep_share_output, f, indent=2)
print(f'wrote episode-share.json  ({len(ep_share_output["characters"])} characters)')

# ── ensemble.json — Page 7 cast architecture ─────────────────────────────────
# Classify every recurring character into a role cluster:
#   "anchor"          – top 4 by total_words AND episode_count (the four boys)
#   "spotlight"       – high max_ep_word_share (>0.25) relative to their rank
#   "adult_support"   – recurring adults
#   "school_support"  – recurring school kids / supporting kids
#   "other_recurring" – everyone else recurring
#
# We use a simple heuristic:
#   anchor: top-5 by total_words AND episode_count >= 200
#   spotlight: max_ep_word_share >= 0.30 AND episode_count >= 20
#   adult: heuristic list (names known from the show)
#   school: heuristic list
#   The remainder = other_recurring

KNOWN_ADULTS = {
    'Randy', 'Gerald', 'Sharon', 'Sheila', 'Stuart', 'Linda', 'Liane',
    'Garrison', 'Mr. Garrison', 'Mackey', 'Mr. Mackey', 'Barbrady',
    'Officer Barbrady', 'Chef', 'Jimbo', 'Ned', 'Richard', 'Chris',
    'Steven', 'Herbert', 'PC Principal', 'Victoria', 'Principal Victoria',
    'Wendy\'s Mom', 'Randy Marsh', 'Sharon Marsh',
}

KNOWN_SCHOOL_KIDS = {
    'Wendy', 'Craig', 'Tweek', 'Clyde', 'Jimmy', 'Timmy', 'Token',
    'Bebe', 'Kevin', 'Red', 'Annie', 'Nelly', 'Heidi', 'Scott',
    'Token Black', 'Craig Tucker', 'Clyde Donovan',
}

def classify_character(name: str, row: pd.Series) -> str:
    total_w = int(row['total_words'])
    ep_cnt  = int(row['episode_count'])
    max_sh  = float(row['max_ep_word_share'])
    # Anchors: top total words AND very high episode count
    if ep_cnt >= 200 and total_w >= 40000:
        return 'anchor'
    # Strong spotlight: can dominate episodes when present
    if max_sh >= 0.30 and ep_cnt >= 20:
        return 'spotlight'
    # Adults
    for n in KNOWN_ADULTS:
        if name.lower().startswith(n.lower()) or n.lower().startswith(name.lower().split()[0]):
            return 'adult_support'
    # School kids
    for n in KNOWN_SCHOOL_KIDS:
        if name.lower().startswith(n.lower()):
            return 'school_support'
    return 'other_recurring'

# Build ensemble for ALL speakers (will be client-side filtered by scope)
ensemble_records = []
for _, r in char_sum.iterrows():
    cluster = classify_character(r['Character'], r)
    ensemble_records.append({
        'character':          r['Character'],
        'episodeCount':       int(r['episode_count']),
        'episodeCoverage':    round(int(r['episode_count']) / total_eps, 4),
        'totalWords':         int(r['total_words']),
        'avgWordsPerEpisode': float(r['avg_words_per_episode']),
        'maxEpWordShare':     float(r['max_ep_word_share']),
        'topSpeakerEpisodes': int(r['top_speaker_episodes']),
        'cluster':            cluster,
        'scope':              scope_tag(int(r['episode_count'])),
    })
ensemble_records.sort(key=lambda x: x['totalWords'], reverse=True)

with open(DATA_DIR / 'ensemble.json', 'w') as f:
    json.dump(ensemble_records, f, indent=2)
print(f'wrote ensemble.json  ({len(ensemble_records)} total characters)')

# ── network.json — Level 3 character relationships ──────────────────────────
def build_network(df, chars):
    df_filtered = df[df['Character'].isin(chars)]
    edges = {}
    for ep_key in df_filtered['ep_key'].unique():
        ep_df = df_filtered[df_filtered['ep_key'] == ep_key].sort_index()  # assume index is line order
        prev_char = None
        for _, row in ep_df.iterrows():
            char = row['Character']
            if prev_char and prev_char != char:
                key = tuple(sorted([prev_char, char]))
                edges[key] = edges.get(key, 0) + 1
            prev_char = char
    nodes = sorted(list(chars))
    node_index = {node: i for i, node in enumerate(nodes)}
    links = [{'source': node_index[a], 'target': node_index[b], 'value': v} for (a, b), v in edges.items()]
    return {'nodes': nodes, 'links': links}

# For all seasons combined
network_all = build_network(df, recurring_chars)
network_output = {'all': network_all}

# Per season
for season in seasons_in_data:
    season_df = df[df['Season'] == season]
    network_season = build_network(season_df, recurring_chars)
    network_output[str(season)] = network_season

with open(DATA_DIR / 'network.json', 'w') as f:
    json.dump(network_output, f, indent=2)
print(f'wrote network.json  (recurring characters, all seasons and per season)')

# ── summary ──────────────────────────────────────────────────────────────────
print()
print('=== Dataset summary ===')
print(f'  Seasons in dataset:        {len(seasons_in_data)}  ({seasons_in_data[0]}–{seasons_in_data[-1]})')
print(f'  Episodes in dataset:       {total_eps}')
print(f'  Lines in dataset:          {df.shape[0]:,}')
print(f'  Words in dataset:          {df["word_count"].sum():,}')
print(f'  Unique speakers (cleaned): {total_speakers:,}')
print(f'  One-episode-only:          {one_ep_speakers:,}  ({one_ep_share*100:.2f}%)')
print(f'  Recurring (8+ episodes):   {len(recurring_chars)}')
print(f'  Core recurring (12+):      {len(core_chars)}')
print()
print('=== Top 10 by total words ===')
for r in hierarchy_records[:10]:
    print(f'  {r["character"]:<20}  {r["totalWords"]:>7,} words  {r["episodeCount"]:>3} ep  top-speaker: {r["topSpeakerEpisodes"]:>3}  maxShare: {r["maxEpWordShare"]:.4f}')
