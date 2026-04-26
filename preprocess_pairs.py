"""
Level 4 — Pair Dialogue Preprocessor (Extended)
================================================
Finds the top N character pairs by episode co-occurrence, then computes
pair-context vocabulary analysis for each.

Output: public/data/pair-dialogue.json  (replaces existing file)

Field names are generic (charACount / charBCount / charARate / charBRate)
so the frontend can work with any pair, not just Cartman/Kyle.
Pair ordering: alphabetical by character name so pairKey is deterministic.

Run: python preprocess_pairs.py
"""

import json
import os
import re
from collections import Counter, defaultdict
from pathlib import Path

import pandas as pd

# ── config ──────────────────────────────────────────────────────────────────
ROOT = Path(__file__).resolve().parent
DATA_DIR = ROOT / 'public' / 'data'
DATA_DIR.mkdir(parents=True, exist_ok=True)
CSV_PATH = Path(os.environ.get('SOUTH_PARK_CSV', ROOT / 'data' / 'south-park-data.csv'))

TOP_N_PAIRS         = 8
MIN_SHARED_EPISODES = 20   # discard pairs that barely overlap

PAIR_WINDOW_SIZE       = 5
PAIR_WINDOW_MIN_LINES  = 4  # pair lines inside window to count as pair context
PAIR_SNIPPET_MIN_RUN   = 2
PAIR_SNIPPET_MAX_RUN   = 6
PAIR_MIN_TOKEN_COUNT   = 8  # token must appear at least this many times across both

# Words that carry almost no signal
BASE_STOPWORDS = {
    'a', 'about', 'after', 'all', 'also', 'am', 'an', 'and', 'any', 'are',
    'as', 'at', 'back', 'be', 'because', 'been', 'before', 'being', 'both',
    'but', 'by', 'can', "can't", 'come', 'could', "couldn't", 'did',
    "didn't", 'do', 'does', "doesn't", 'doing', "don't", 'down', 'even',
    'for', 'from', 'get', 'getting', 'go', 'going', 'gonna', 'got', 'had',
    "hadn't", 'has', "hasn't", 'have', "haven't", 'having', 'he', "he'd",
    "he'll", "he's", 'her', 'here', 'hers', 'herself', 'him', 'himself',
    'his', 'how', 'huh', 'i', "i'd", "i'll", "i'm", "i've", 'if', 'in',
    'into', 'is', "isn't", 'it', "it's", 'its', 'itself', 'just', 'let',
    "let's", 'like', 'lot', 'lots', 'me', 'more', 'most', 'much', 'my',
    'myself', 'need', 'no', 'not', 'now', 'of', 'off', 'oh', 'ok', 'okay',
    'on', 'once', 'one', 'only', 'or', 'other', 'our', 'ours', 'ourselves',
    'out', 'over', 'own', 'really', 'right', 'same', 'say', 'see', 'she',
    "she'd", "she'll", "she's", 'should', "shouldn't", 'so', 'some', 'still',
    'such', 'than', 'that', "that's", 'the', 'their', 'theirs', 'them',
    'themselves', 'then', 'there', "there's", 'these', 'they', "they'd",
    "they'll", "they're", "they've", 'this', 'those', 'through', 'to', 'too',
    'uh', 'umm', 'up', 'very', 'was', "wasn't", 'way', 'we', "we'd",
    "we'll", "we're", "we've", 'well', 'were', "weren't", 'what', "what's",
    'when', 'where', 'which', 'who', "who's", 'why', 'will', 'with', 'would',
    "wouldn't", 'yeah', 'yes', 'you', "you'd", "you'll", "you're", "you've",
    'your', 'yours', 'yourself', 'yourselves', 'hey',
}

TOKEN_RE = re.compile(r"[a-z']+")


def clean_name(x: str) -> str:
    return re.sub(r'\s+', ' ', str(x).replace('\xa0', ' ')).strip()


def tokenize(line: str) -> list:
    return TOKEN_RE.findall(str(line).lower().replace('’', "'"))


def make_stopwords(char_a: str, char_b: str) -> set:
    """Include the characters' name tokens so they don't dominate the chart."""
    stops = set(BASE_STOPWORDS)
    for name in [char_a, char_b]:
        stops.update(name.lower().split())
    return stops


# ── load & clean ─────────────────────────────────────────────────────────────
print('Loading CSV…')
df = pd.read_csv(CSV_PATH)
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
df['Season']     = df['Season'].astype(int)
df['Episode']    = df['Episode'].astype(int)
df['word_count'] = df['Line'].str.split().str.len().fillna(0).astype(int)
df['ep_key']     = (
    df['Season'].astype(str).str.zfill(2) + 'x' +
    df['Episode'].astype(str).str.zfill(2)
)
df = df.reset_index(drop=True)
print(f'  {len(df):,} clean rows')

# ── find top N pairs by episode co-occurrence ────────────────────────────────
# Recurring = 8+ episodes
char_eps    = df.groupby('Character')['ep_key'].apply(set)
ep_counts   = char_eps.apply(len)
recurring   = sorted(ep_counts[ep_counts >= 8].index.tolist())
print(f'  {len(recurring)} recurring characters')

print('Computing episode co-occurrence…')
pair_shared: list = []
for i, a in enumerate(recurring):
    for b in recurring[i + 1:]:
        shared = len(char_eps[a] & char_eps[b])
        if shared >= MIN_SHARED_EPISODES:
            # always store alphabetically so key is deterministic
            pair_shared.append((min(a, b), max(a, b), shared))

pair_shared.sort(key=lambda t: -t[2])
print('Top 15 pairs by shared episodes:')
for a, b, n in pair_shared[:15]:
    print(f'  {a:20} / {b:20}  {n} eps')

# Ensure Cartman/Kyle is first (it's the default displayed pair)
ck = ('Cartman', 'Kyle')
selected: list = []
if any(a == ck[0] and b == ck[1] for a, b, _ in pair_shared):
    selected.append(ck)
    rest = [(a, b) for a, b, _ in pair_shared if (a, b) != ck]
    selected.extend(rest[:TOP_N_PAIRS - 1])
else:
    selected = [(a, b) for a, b, _ in pair_shared[:TOP_N_PAIRS]]

print(f'\nSelected {len(selected)} pairs:')
for a, b in selected:
    print(f'  {a} / {b}')

# ── build per-episode row index ───────────────────────────────────────────────
rows_by_episode: dict = defaultdict(list)
all_rows: list = []
for idx, row in enumerate(df.itertuples(index=False)):
    rec = {
        'rowIndex':  idx,
        'season':    int(row.Season),
        'episode':   int(row.Episode),
        'character': row.Character,
        'line':      row.Line,
        'epKey':     row.ep_key,
        'wordCount': int(row.word_count),
    }
    all_rows.append(rec)
    rows_by_episode[row.ep_key].append(rec)


# ── compute one pair ─────────────────────────────────────────────────────────
def compute_pair(char_a: str, char_b: str) -> dict:
    stops      = make_stopwords(char_a, char_b)
    pair_set   = {char_a, char_b}
    ctx_ep_keys: set  = set()
    ctx_indices: set  = set()
    adj_exchanges     = 0
    line_counts       = Counter()
    word_counts       = Counter()
    token_counts      = {char_a: Counter(), char_b: Counter()}
    snippet_cands: dict = {}

    for ep_key, ep_rows in rows_by_episode.items():
        if len(ep_rows) >= PAIR_WINDOW_SIZE:
            for start in range(len(ep_rows) - PAIR_WINDOW_SIZE + 1):
                window     = ep_rows[start:start + PAIR_WINDOW_SIZE]
                w_chars    = {r['character'] for r in window}
                pair_lines = sum(1 for r in window if r['character'] in pair_set)
                if pair_set.issubset(w_chars) and pair_lines >= PAIR_WINDOW_MIN_LINES:
                    ctx_ep_keys.add(ep_key)
                    for r in window:
                        if r['character'] in pair_set:
                            ctx_indices.add(r['rowIndex'])

        # Adjacent exchange detection + snippet extraction
        for idx in range(len(ep_rows) - 1):
            first  = ep_rows[idx]
            second = ep_rows[idx + 1]
            if first['character'] == second['character']:
                continue
            if {first['character'], second['character']} != pair_set:
                continue
            adj_exchanges += 1

            run     = [first, second]
            nxt     = idx + 2
            while nxt < len(ep_rows) and len(run) < PAIR_SNIPPET_MAX_RUN:
                cur = ep_rows[nxt]
                if cur['character'] not in pair_set:
                    break
                if cur['character'] == run[-1]['character']:
                    break
                run.append(cur)
                nxt += 1

            if len(run) < PAIR_SNIPPET_MIN_RUN:
                continue

            key = '|'.join(f"{r['character']}:{r['line']}" for r in run)
            wc  = sum(r['wordCount'] for r in run)
            snip = {
                'epKey':     first['epKey'],
                'season':    int(first['season']),
                'episode':   int(first['episode']),
                'lineCount': int(len(run)),
                'wordCount': int(wc),
                'score':     int(len(run) * 10 + wc),
                'lines':     [{'speaker': r['character'], 'text': r['line']} for r in run],
            }
            prev = snippet_cands.get(key)
            if prev is None or snip['score'] > prev['score']:
                snippet_cands[key] = snip

    # Accumulate tokens for context rows
    for row in all_rows:
        if row['rowIndex'] not in ctx_indices:
            continue
        sp = row['character']
        if sp not in pair_set:
            continue
        line_counts[sp] += 1
        word_counts[sp] += row['wordCount']
        for tok in tokenize(row['line']):
            cleaned = tok.strip("'")
            if len(cleaned) >= 3 and cleaned not in stops:
                token_counts[sp][cleaned] += 1

    # Build chart words with generic field names
    all_tokens = sorted(set(token_counts[char_a]) | set(token_counts[char_b]))
    chart_words: list = []
    for tok in all_tokens:
        a_cnt = int(token_counts[char_a].get(tok, 0))
        b_cnt = int(token_counts[char_b].get(tok, 0))
        if a_cnt + b_cnt < PAIR_MIN_TOKEN_COUNT:
            continue
        a_rate    = a_cnt / max(int(word_counts[char_a]), 1)
        b_rate    = b_cnt / max(int(word_counts[char_b]), 1)
        rate_diff = a_rate - b_rate
        dominant  = char_a if rate_diff >= 0 else char_b
        chart_words.append({
            'word':          tok,
            'charACount':    a_cnt,
            'charBCount':    b_cnt,
            'charARate':     round(a_rate, 4),
            'charBRate':     round(b_rate, 4),
            'dominantSpeaker': dominant,
            'rateDiff':      round(rate_diff, 4),
            'absRateDiff':   round(abs(rate_diff), 4),
        })
    chart_words.sort(key=lambda r: (-r['absRateDiff'], r['word']))

    count_key = {char_a: 'charACount', char_b: 'charBCount'}
    rate_key  = {char_a: 'charARate',  char_b: 'charBRate'}

    speaker_stats: list = []
    for sp in [char_a, char_b]:
        dominant_rows = [r for r in chart_words if r['dominantSpeaker'] == sp][:8]
        speaker_stats.append({
            'character':          sp,
            'pairContextLines':   int(line_counts[sp]),
            'pairContextWords':   int(word_counts[sp]),
            'topDistinctiveWords': [
                {
                    'word':     r['word'],
                    'count':    int(r[count_key[sp]]),
                    'rate':     float(r[rate_key[sp]]),
                    'rateDiff': float(r['rateDiff']),
                }
                for r in dominant_rows
            ],
        })

    snippets = sorted(
        snippet_cands.values(),
        key=lambda r: (-r['score'], -r['lineCount'], -r['wordCount'], r['epKey'])
    )[:6]

    return {
        'pairKey':               f'{char_a}__{char_b}',
        'characters':            [char_a, char_b],
        'pairContextLineCount':  int(sum(line_counts.values())),
        'pairContextWordCount':  int(sum(word_counts.values())),
        'adjacentExchangeCount': int(adj_exchanges),
        'episodeCount':          int(len(ctx_ep_keys)),
        'speakerStats':          speaker_stats,
        'chartWords':            chart_words,
        'snippets':              snippets,
    }


# ── run all pairs ─────────────────────────────────────────────────────────────
output = {
    'meta': {
        'defaultPair':            list(selected[0]),
        'conversationModel':      'window-5-plus-adjacent-snippets',
        'windowSize':             PAIR_WINDOW_SIZE,
        'pairDominanceThreshold': PAIR_WINDOW_MIN_LINES,
        'minTokenCount':          PAIR_MIN_TOKEN_COUNT,
    },
    'pairs': [],
}

for char_a, char_b in selected:
    print(f'\nComputing {char_a} / {char_b}…')
    pair = compute_pair(char_a, char_b)
    output['pairs'].append(pair)
    print(
        f'  context lines: {pair["pairContextLineCount"]:,} | '
        f'exchanges: {pair["adjacentExchangeCount"]:,} | '
        f'episodes: {pair["episodeCount"]} | '
        f'chart words: {len(pair["chartWords"])}'
    )

out_path = DATA_DIR / 'pair-dialogue.json'
with open(out_path, 'w') as fh:
    json.dump(output, fh, indent=2)
print(f'\nWrote {out_path}  ({len(output["pairs"])} pairs)')
