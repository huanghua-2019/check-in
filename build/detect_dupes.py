"""语义去冗检测：找字面不同但语义高度重叠的条目"""
import json, re, os, itertools, difflib, collections

SRC = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'data.js')
text = open(SRC, encoding='utf-8').read()
vocab = json.loads(re.search(r'window\.VOCAB=(\[.*?\]);', text, re.S).group(1))

bytab = collections.defaultdict(list)
for x in vocab:
    bytab[x['tab']].append(x)


def syn_set(s):
    return {p.strip() for p in re.split(r'[、,，/]', s or '') if len(p.strip()) >= 2}


print('##### A. 同 tab 内 word 高相似 (>=0.82) #####')
for t, rows in bytab.items():
    pairs = []
    for a, b in itertools.combinations(rows, 2):
        r = difflib.SequenceMatcher(None, a['word'], b['word']).ratio()
        if r >= 0.82:
            pairs.append((r, a, b))
    pairs.sort(key=lambda p: -p[0])
    print(f'\n[{t}] {len(rows)} 条 → {len(pairs)} 对')
    for r, a, b in pairs[:18]:
        print(f'  {r:.2f} [{a["id"]:>4}] {a["word"][:32]}')
        print(f'       [{b["id"]:>4}] {b["word"][:32]}')

print('\n\n##### B. 同 tab 内 syn 集合高度重叠 (Jaccard>=0.75, 各>=2项) #####')
for t, rows in bytab.items():
    pairs = []
    for a, b in itertools.combinations(rows, 2):
        sa, sb = syn_set(a.get('syn')), syn_set(b.get('syn'))
        if len(sa) >= 2 and len(sb) >= 2:
            j = len(sa & sb) / len(sa | sb)
            if j >= 0.75:
                pairs.append((j, a, b, sa & sb))
    pairs.sort(key=lambda p: -p[0])
    if not pairs:
        continue
    print(f'\n[{t}] {len(pairs)} 对')
    for j, a, b, common in pairs[:18]:
        print(f'  {j:.2f} [{a["id"]:>4}] {a["word"][:22]}  <->  [{b["id"]:>4}] {b["word"][:22]}')
        print(f'        共同项: {"、".join(sorted(common))[:60]}')

print('\n\n##### C. mean 高相似 (>=0.80) #####')
for t, rows in bytab.items():
    pairs = []
    for a, b in itertools.combinations(rows, 2):
        ma, mb = a.get('mean') or '', b.get('mean') or ''
        if len(ma) >= 8 and len(mb) >= 8:
            r = difflib.SequenceMatcher(None, ma, mb).ratio()
            if r >= 0.80:
                pairs.append((r, a, b))
    pairs.sort(key=lambda p: -p[0])
    if not pairs:
        continue
    print(f'\n[{t}] {len(pairs)} 对')
    for r, a, b in pairs[:18]:
        print(f'  {r:.2f} [{a["id"]:>4}] {a["word"][:24]}  <->  [{b["id"]:>4}] {b["word"][:24]}')
        print(f'        {a["mean"][:52]}')
        print(f'        {b["mean"][:52]}')
