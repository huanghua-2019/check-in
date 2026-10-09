"""导出 460 条最终条目供质量抽查，并打印分类设计所需样例"""
import json, re, os, collections

BUILD = os.path.dirname(os.path.abspath(__file__))
text = open(os.path.join(BUILD, '..', 'data.js'), encoding='utf-8').read()
vocab = json.loads(re.search(r'window\.VOCAB=(\[.*?\]);', text, re.S).group(1))
by_id = {x['id']: x for x in vocab}

# ---- 1. 导出审查材料（按 todo_rest 分片合并）----
GROUPS = {
    'q':  ['todo_rest_q1.json', 'todo_rest_q2.json'],
    'm':  ['todo_rest_m1.json', 'todo_rest_m2.json'],
    'mx': ['todo_rest_m3.json', 'todo_rest_x.json'],
}
FIELDS = ['id', 'tab', 'cat', 'word', 'syn', 'mean', 'example', 'scene']
for name, files in GROUPS.items():
    rows = []
    for fn in files:
        for t in json.load(open(os.path.join(BUILD, fn), encoding='utf-8')):
            x = by_id.get(t['id'])
            if x:
                rows.append({f: x.get(f, '') for f in FIELDS})
    p = os.path.join(BUILD, f'review_{name}.json')
    json.dump(rows, open(p, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    print(f'review_{name}.json  {len(rows)} 条')

# ---- 2. 分类设计样例：每个 cat 抽 4 条 ----
print('\n\n##### 各分类抽样（供设计新维度）#####')
bycat = collections.defaultdict(list)
for x in vocab:
    bycat[x['cat']].append(x)
for cat in sorted(bycat, key=lambda c: (bycat[c][0]['tab'], -len(bycat[c]))):
    rows = bycat[cat]
    tabs = {r['tab'] for r in rows}
    print(f'\n【{cat}】 {len(rows)} 条  tab={sorted(tabs)}')
    step = max(1, len(rows) // 4)
    for x in rows[::step][:4]:
        print(f'    · {x["word"][:44]}')
