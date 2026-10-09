"""把 todo_rest.json 切成 6 片（同分类聚簇，均衡）"""
import json, os, collections

BUILD = os.path.dirname(os.path.abspath(__file__))
todo = json.load(open(os.path.join(BUILD, 'todo_rest.json'), encoding='utf-8'))

# 片名 -> 该片包含的 cat 列表（None 表示 humor/cases/rule 全部）
ASSIGN = {
    'q1': ['📈 投资理念', '💼 商业判断'],
    'q2': ['🌿 人生感悟', '🔮 规律与真相', '🧠 人性与认知', '🏢 管理与领导力'],
    'm1': ['🧠 认知与思维'],
    'm2': ['⚠️ 风险与警示'],
    'm3': ['⚔️ 竞争与生存', '👥 人性与关系', '🔄 变化与趋势'],
    'x':  '__X__',
}

buckets = collections.defaultdict(list)
for r in todo:
    key = r['cat'] if r['tab'] in ('quote', 'met') else '__X__'
    buckets[key].append(r)

used = set()
for fn, cats in ASSIGN.items():
    rows = []
    if cats == '__X__':
        rows = buckets['__X__']
    else:
        for c in cats:
            rows.extend(buckets[c])
            used.add(c)
    json.dump(rows, open(os.path.join(BUILD, f'todo_rest_{fn}.json'), 'w', encoding='utf-8'),
              ensure_ascii=False, indent=1)
    c = collections.Counter(r['cat'] for r in rows)
    print(f'{fn:4s} {len(rows):3d} 条 | ' + ' / '.join(f'{k}×{v}' for k, v in c.items()))
print('合计', sum(len(json.load(open(os.path.join(BUILD, f"todo_rest_{f}.json"), encoding="utf-8")))
                  for f in ASSIGN))
