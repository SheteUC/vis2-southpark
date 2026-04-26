"""
Level 4 — Speaker Timing Preprocessor
=======================================
For each of the top 15 characters by total line count, computes the
fractional position of every line within its episode.

Position = line_index_within_episode / (total_lines_in_episode - 1)
  0.0 = first line of the episode
  1.0 = last line of the episode
  Episodes with only 1 line get position 0.5.

Output schema (public/data/episode-timing.json):
{
  "characters": ["Cartman", ...],    // ordered list (for UI)
  "data": {
    "Cartman": {
      "byEpisode": [
        {
          "season": 1,
          "episode": 1,
          "epKey": "01x01",
          "positions": [0.12, 0.45, 0.78],   // sorted asc
          "medianPosition": 0.45,
          "firstPosition": 0.12,
          "lastPosition": 0.78,
          "lineCount": 3
        },
        ...
      ]
    },
    ...
  }
}

Run: python preprocess_timing.py
"""

import json
import os
import re
from pathlib import Path

import pandas as pd

# ── config ───────────────────────────────────────────────────────────────────
ROOT     = Path(__file__).resolve().parent
DATA_DIR = ROOT / 'public' / 'data'
DATA_DIR.mkdir(parents=True, exist_ok=True)
CSV_PATH = Path(os.environ.get('SOUTH_PARK_CSV', ROOT / 'data' / 'south-park-data.csv'))

TOP_N_CHARS = 15

# ── load & clean ─────────────────────────────────────────────────────────────
print('Loading CSV…')
df = pd.read_csv(CSV_PATH)

def clean_name(x: str) -> str:
    return re.sub(r'\s+', ' ', str(x).replace('\xa0', ' ')).strip()

df['Character'] = df['Character'].map(clean_name)
df['Line']      = df['Line'].astype(str).str.strip()

junk = (
    (df['Character'] == '') |
    df['Character'].str.fullmatch(r'\d+') |
    (df['Character'].str.len() <= 1) |
    (df['Line'] == '') |
    df['Line'].isna()
)
df = df[~junk].copy()
df['Season']  = df['Season'].astype(int)
df['Episode'] = df['Episode'].astype(int)
df['ep_key']  = (
    df['Season'].astype(str).str.zfill(2) + 'x' +
    df['Episode'].astype(str).str.zfill(2)
)
df = df.reset_index(drop=True)
print(f'  {len(df):,} clean rows')

# ── select top N characters by total line count ───────────────────────────────
line_counts = df.groupby('Character').size().sort_values(ascending=False)
top_chars   = line_counts.head(TOP_N_CHARS).index.tolist()
print(f'Top {TOP_N_CHARS} characters by line count:')
for c in top_chars:
    print(f'  {c:<22} {line_counts[c]:>5} lines')

# ── compute fractional position for every row ─────────────────────────────────
# cumcount() gives 0-based index within each episode group
df['ep_line_idx']   = df.groupby('ep_key').cumcount()
ep_total_lines      = df.groupby('ep_key').size().rename('ep_total_lines')
df                  = df.join(ep_total_lines, on='ep_key')

# For a single-line episode denom would be 0; clip to 1 so position = 0.0
df['position'] = df['ep_line_idx'] / (df['ep_total_lines'] - 1).clip(lower=1)

# ── build output ──────────────────────────────────────────────────────────────
output = {
    'characters': top_chars,
    'data':       {},
}

for char in top_chars:
    char_df    = df[df['Character'] == char].copy()
    by_episode = []

    for (season, episode, ep_key), grp in char_df.groupby(
        ['Season', 'Episode', 'ep_key'], sort=True
    ):
        pos       = grp['position']
        positions = sorted(pos.tolist())
        by_episode.append({
            'season':         int(season),
            'episode':        int(episode),
            'epKey':          ep_key,
            'positions':      [round(float(p), 4) for p in positions],
            'medianPosition': round(float(pos.median()), 4),
            'firstPosition':  round(float(pos.min()), 4),
            'lastPosition':   round(float(pos.max()), 4),
            'lineCount':      int(len(positions)),
        })

    output['data'][char] = {'byEpisode': by_episode}
    print(f'  {char:<22} {len(by_episode)} episodes')

out_path = DATA_DIR / 'episode-timing.json'
with open(out_path, 'w') as fh:
    json.dump(output, fh, indent=2)
print(f'\nWrote {out_path}  ({len(output["characters"])} characters)')
