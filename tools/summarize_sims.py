"""Summarize deterministic Godot AI simulations and validate their completeness."""
import argparse
import csv
import json
import math
from collections import Counter
from statistics import mean

parser = argparse.ArgumentParser()
parser.add_argument('files', nargs='+')
parser.add_argument('--expected', type=int)
parser.add_argument('--out')
args = parser.parse_args()
reports = []
for path in args.files:
    with open(path) as file:
        rows = list(csv.DictReader(file))
    if not rows or (args.expected is not None and len(rows) != args.expected):
        raise SystemExit(f'{path}: incomplete sample ({len(rows)} games)')
    if len({r['seed'] for r in rows}) != len(rows):
        raise SystemExit(f'{path}: duplicate seeds')
    counts = Counter(r['winner'] for r in rows)
    if set(counts) - {'han', 'xiongnu'}:
        raise SystemExit(f'{path}: unfinished game')
    n = len(rows)
    p = counts['han'] / n
    z = 1.96
    center = (p + z*z/(2*n)) / (1 + z*z/n)
    radius = z*math.sqrt(p*(1-p)/n + z*z/(4*n*n)) / (1 + z*z/n)
    reports.append({
        'file': path, 'games': n, 'seed_range': [min(int(r['seed']) for r in rows), max(int(r['seed']) for r in rows)],
        'decision_ticks': sorted({int(r['decision_ticks']) for r in rows}),
        'wins': dict(counts), 'han_win_percent': round(p*100, 1),
        'han_95_percent_interval': [round((center-radius)*100, 1), round((center+radius)*100, 1)],
        'average_years': round(mean(int(r['months']) for r in rows)/12, 2),
        'hexi_ever_captured_percent': round(sum(int(r['hexi_lost']) > 0 for r in rows)/n*100, 1),
        'games_without_battles': sum(int(r['battles']) == 0 for r in rows),
        'expiry_games': sum(r['reason'].startswith('到期') for r in rows),
        'rejected_commands': sum(int(r['rejected']) for r in rows),
        'within_target': 0.4 <= p <= 0.6,
    })
result = json.dumps(reports, ensure_ascii=False, indent=2)
print(result)
if args.out:
    with open(args.out, 'w') as file:
        file.write(result + '\n')
