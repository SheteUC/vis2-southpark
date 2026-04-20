import csv
import json
from collections import Counter, defaultdict
from pathlib import Path

base = Path('/home/user/workspace/tv-time-app')

with open(base / 'public/data/meta.json') as f:
    meta = json.load(f)
with open(base / 'public/data/major-characters.json') as f:
    major = json.load(f)
with open(base / 'public/data/character-text.json') as f:
    text = json.load(f)

csv_path = base / 'data/south-park-data.csv'

season_words = Counter()
season_lines = Counter()
episode_words = Counter()
episode_lines = Counter()
character_words = Counter()
character_lines = Counter()
char_episode_set = defaultdict(set)
char_season_set = defaultdict(set)
char_word_in_episode_max = defaultdict(lambda: (None, -1))
char_lines_in_episode_max = defaultdict(lambda: (None, -1))

with open(csv_path, newline='') as f:
    reader = csv.DictReader(f)
    for row in reader:
        season = int(row['Season'])
        episode = int(row['Episode'])
        character = row['Character']
        line = row['Line'].strip()
        words = len(line.split())
        ep_key = f"{season:02d}x{episode:02d}"

        season_words[season] += words
        season_lines[season] += 1
        episode_words[ep_key] += words
        episode_lines[ep_key] += 1
        character_words[character] += words
        character_lines[character] += 1
        char_episode_set[character].add(ep_key)
        char_season_set[character].add(season)
        if words > char_word_in_episode_max[character][1]:
            char_word_in_episode_max[character] = (ep_key, words)
        if 1 > char_lines_in_episode_max[character][1]:
            char_lines_in_episode_max[character] = (ep_key, 1)

major_names = {d['character'] for d in major}
major_rows = [d for d in major if d['character'] in major_names]

by_avg_words_episode = sorted(
    [d for d in major_rows if d['episodeCount'] >= 8],
    key=lambda d: d['avgWordsPerEpisode'],
    reverse=True,
)

by_words = sorted(major_rows, key=lambda d: d['totalWords'], reverse=True)
by_lines = sorted(major_rows, key=lambda d: d['totalLines'], reverse=True)
by_episodes = sorted(major_rows, key=lambda d: d['episodeCount'], reverse=True)
most_efficient = sorted(
    [d for d in major_rows if d['episodeCount'] >= 20],
    key=lambda d: d['totalWords'] / max(d['episodeCount'], 1),
    reverse=True,
)
quiet_ubiquitous = sorted(
    [d for d in major_rows if d['episodeCount'] >= 70],
    key=lambda d: d['avgWordsPerEpisode'],
)

season_rank = sorted(season_words.items(), key=lambda x: x[1], reverse=True)
episode_rank = sorted(episode_words.items(), key=lambda x: x[1], reverse=True)

text_map = {d['character']: d for d in text}
phrase_leaders = []
word_leaders = []
for name, data in text_map.items():
    tp = data.get('topPhrases') or []
    tw = data.get('topWords') or []
    if tp:
        phrase_leaders.append((name, tp[0]['phrase'], tp[0]['count']))
    if tw:
        word_leaders.append((name, tw[0]['word'], tw[0]['count']))
phrase_leaders.sort(key=lambda x: x[2], reverse=True)
word_leaders.sort(key=lambda x: x[2], reverse=True)

summary = {
    'dataset': meta,
    'top_words_total': by_words[:10],
    'top_lines_total': by_lines[:10],
    'top_episode_presence': by_episodes[:10],
    'highest_avg_words_per_episode': by_avg_words_episode[:10],
    'quiet_ubiquitous': quiet_ubiquitous[:10],
    'most_efficient_talkers': most_efficient[:10],
    'loudest_seasons': [{'season': s, 'words': w, 'lines': season_lines[s]} for s, w in season_rank[:6]],
    'quietest_seasons': [{'season': s, 'words': w, 'lines': season_lines[s]} for s, w in season_rank[-6:]],
    'wordiest_episodes': [{'episodeKey': ep, 'words': w, 'lines': episode_lines[ep]} for ep, w in episode_rank[:12]],
    'phrase_leaders': [
        {'character': c, 'phrase': p, 'count': n} for c, p, n in phrase_leaders[:12]
    ],
    'word_leaders': [
        {'character': c, 'word': w, 'count': n} for c, w, n in word_leaders[:12]
    ],
}

out = base / 'fun-facts-summary.json'
out.write_text(json.dumps(summary, indent=2))
print(out)
