"""词库结构体检：分类体系诊断"""
import json, re, collections, os

SRC = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'data.js')
text = open(SRC, encoding='utf-8').read()
vocab = json.loads(re.search(r'window\.VOCAB=(\[.*?\]);', text, re.S).group(1))
cats = json.loads(re.search(r'window\.CATEGORIES=(\[.*?\]);', text, re.S).group(1))

print(f'条目 {len(vocab)}  |  CATEGORIES {len(cats)}  |  tab {len(set(x.get("tab") for x in vocab))}')

# ---- 1. tab × cat 交叉 ----
print('\n===== tab × cat 交叉表 =====')
cross = collections.defaultdict(collections.Counter)
for x in vocab:
    cross[x.get('tab')][x['cat']] += 1
for t, c in cross.items():
    print(f'\n[{t}]  共 {sum(c.values())} 条, {len(c)} 个分类')
    for cat, n in c.most_common():
        print(f'    {n:>4}  {cat}')

# ---- 2. cat 是否跨 tab ----
print('\n===== 同一分类跨多个 tab 的情况 =====')
m = collections.defaultdict(set)
for x in vocab:
    m[x['cat']].add(x.get('tab'))
for cat, ts in m.items():
    if len(ts) > 1:
        print(f'    {cat}  →  {sorted(ts)}')

# ---- 3. CATEGORIES 里但没条目 / 有条目但不在 CATEGORIES ----
print('\n===== 分类清单一致性 =====')
used = set(x['cat'] for x in vocab)
print('  在 CATEGORIES 但无条目:', [c for c in cats if c not in used])
print('  有条目但不在 CATEGORIES:', [c for c in used if c not in cats])

# ---- 4. 命名体系 =====
print('\n===== 命名风格 =====')
num = [c for c in cats if re.match(r'^\d', c)]
emo = [c for c in cats if c and ord(c[0]) > 0x2000]
other = [c for c in cats if c not in num and c not in emo]
print(f'  数字编号式 ({len(num)}): {num}')
print(f'  emoji/主题式 ({len(emo)}): {emo}')
print(f'  其他 ({len(other)}): {other}')

# ---- 5. 各 tab 的 word 样例 ----
print('\n===== 各 tab 抽样 (word 前 20 字) =====')
for t in sorted(cross, key=lambda k: -sum(cross[k].values())):
    rows = [x for x in vocab if x.get('tab') == t]
    print(f'\n[{t}] {len(rows)} 条 — 抽样 8 条:')
    step = max(1, len(rows) // 8)
    for x in rows[::step][:8]:
        print(f'    {x["word"][:34]}')
