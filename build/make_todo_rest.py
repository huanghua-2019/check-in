"""生成剩余 460 条待补清单 todo_rest.json + 分片"""
import json, re, collections, os

BUILD = os.path.dirname(os.path.abspath(__file__))
SRC = os.path.join(BUILD, '..', 'data.js')
line = [l for l in open(SRC, encoding='utf-8').read().split('\n') if l.startswith('window.VOCAB=')][0]
vocab = json.loads(line[len('window.VOCAB='):].rstrip('\r\n;'))

FIELD = ['word', 'syn', 'mean', 'example', 'scene']
TABS = ['quote', 'met', 'humor', 'cases', 'rule']

todo = []
for x in vocab:
    if x.get('tab') not in TABS:
        continue
    miss = [f for f in ['syn', 'mean', 'scene'] if not str(x.get(f, '') or '').strip()]
    # syn 为纯数字视为垃圾，需重写
    syn = str(x.get('syn', '') or '').strip()
    if syn.isdigit() and 'syn' not in miss:
        miss.insert(0, 'syn')
    if not miss:
        continue
    todo.append({
        'id': x['id'], 'tab': x['tab'], 'cat': x['cat'],
        'word': x['word'], 'syn': syn if not syn.isdigit() else '',
        'mean': str(x.get('mean', '') or ''),
        'example': str(x.get('example', '') or ''),
        'miss': miss,
    })

json.dump(todo, open(os.path.join(BUILD, 'todo_rest.json'), 'w', encoding='utf-8'),
          ensure_ascii=False, indent=1)
print('待补总条数:', len(todo))

by_tab = collections.Counter(x['tab'] for x in todo)
print('按 tab:', dict(by_tab))

print('\n各 tab 下的 cat 分布：')
for t in TABS:
    rows = [x for x in todo if x['tab'] == t]
    if not rows: continue
    c = collections.Counter(x['cat'] for x in rows)
    print(f'  [{t}] {len(rows)} 条')
    for cat, n in sorted(c.items(), key=lambda kv: -kv[1]):
        print(f'      {n:3d}  {cat}')

# 垃圾 syn 清单
bad = [x['id'] for x in todo if x['syn'] == '' and str(
    next((v.get('syn') for v in vocab if v['id'] == x['id']), '')).strip().isdigit()]
print('\n原 syn 为纯数字(需重写)的 id:', bad)
