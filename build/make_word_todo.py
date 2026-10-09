# -*- coding: utf-8 -*-
"""导出 word 归位分片：quote/met/humor/cases 的 word 是"释义式标题"，需改回可直取的原话。"""
import json, re, os

raw = open('data.js', encoding='utf-8').read()
v = json.loads(re.search(r'window\.VOCAB=(\[.*?\]);', raw, re.S).group(1))

groups = {}
shards = {
    'q1': [x for x in v if x['tab'] == 'quote'][:83],
    'q2': [x for x in v if x['tab'] == 'quote'][83:],
    'm1': [x for x in v if x['tab'] == 'met'][:83],
    'm2': [x for x in v if x['tab'] == 'met'][83:166],
    'm3': [x for x in v if x['tab'] == 'met'][166:],
    'x':  [x for x in v if x['tab'] in ('humor', 'cases')],
}
os.makedirs('build/wordtodo', exist_ok=True)
for k, rows in shards.items():
    out = []
    for x in rows:
        out.append({
            'id': x['id'], 'tab': x['tab'], 'use': x['use'], 'cat': x['cat'],
            'word': x['word'], 'syn': x['syn'], 'mean': x['mean'],
            'example': x['example'], 'scene': x['scene'],
        })
        if x['tab'] == 'cases':
            out[-1]['needmean'] = True
    p = f'build/wordtodo/{k}.json'
    json.dump(out, open(p, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    print(f'{k}: {len(out)} 条 -> {p}')
print('合计:', sum(len(r) for r in shards.values()))
