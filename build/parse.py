import re, json
from collections import Counter

SRC = r"D:\华的obsidian\210-写作提高\002-知识图谱\002-高频词汇库.md"
OUT = r"C:\Users\Lenovo\WorkBuddy\2026-07-21-16-55-18\vocab-checkin\vocab.js"

entries = []
categories = []
current_cat = None
cat_order = 0
gid = 0

def strip_star(s):
    return s.replace('**', '').strip()

with open(SRC, encoding='utf-8') as f:
    lines = f.readlines()

for line in lines:
    line = line.rstrip('\n')
    if line.startswith('## '):
        m = line[3:].strip()
        code = m.split('-', 1)[0]
        current_cat = m
        cat_order += 1
        categories.append({'code': code, 'name': m, 'order': cat_order})
        continue
    if not line.startswith('|'):
        continue
    if '高级表达' in line:
        continue
    # separator row like | --- | --- |
    if set(line.replace('|', '').strip()) <= set('-: '):
        continue
    cells = [c.strip() for c in line.split('|')]
    if cells and cells[0] == '':
        cells = cells[1:]
    while cells and cells[-1] == '':
        cells = cells[:-1]
    if not cells:
        continue
    cells = cells[:5] + [''] * (5 - len(cells))
    word = strip_star(cells[0])
    if not word:
        continue
    gid += 1
    entries.append({
        'id': gid,
        'cat': current_cat,
        'word': word,
        'syn': strip_star(cells[1]),
        'mean': strip_star(cells[2]),
        'example': strip_star(cells[3]),
        'scene': strip_star(cells[4]),
    })

js = "window.VOCAB = " + json.dumps(entries, ensure_ascii=False, separators=(',', ':')) + ";\n"
js += "window.CATEGORIES = " + json.dumps([c['name'] for c in categories], ensure_ascii=False, separators=(',', ':')) + ";\n"
with open(OUT, 'w', encoding='utf-8') as f:
    f.write(js)

cc = Counter(e['cat'] for e in entries)
print("total entries:", len(entries))
print("categories:", len(categories))
for c in categories:
    print(f"  {c['name']}: {cc.get(c['name'], 0)}")
