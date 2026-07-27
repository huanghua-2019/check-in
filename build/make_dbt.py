#!/usr/bin/env python3
# 解析高频词汇库 → 生成 .dbt 建表参数(JSON) 与 批量记录(JSON字符串)
import re, json

SRC = r"D:\华的obsidian\210-写作提高\002-知识图谱\002-高频词汇库.md"
OUT_DIR = r"C:\Users\Lenovo\WorkBuddy\2026-07-21-16-55-18\vocab-checkin\build"

def strip_md(s: str) -> str:
    s = s.strip()
    s = re.sub(r'^\*\*(.*?)\*\*$', r'\1', s)
    s = re.sub(r'`(.*?)`', r'\1', s)
    return s.strip()

rows = []
cur = ''
for ln in open(SRC, encoding='utf-8'):
    if ln.startswith('## '):
        cur = ln[3:].strip()
        continue
    if not ln.lstrip().startswith('|'):
        continue
    cells = [c.strip() for c in ln.strip().strip('|').split('|')]
    if not cells:
        continue
    if not cells[0].startswith('**'):
        continue
    if '高级表达' in cells[0]:
        continue
    if len(cells) < 5:
        cells = cells + [''] * (5 - len(cells))
    word = strip_md(cells[0])
    if not word:
        continue
    rows.append({
        'cat': cur,
        'word': word,
        'syn': strip_md(cells[1]),
        'meaning': strip_md(cells[2]),
        'example': strip_md(cells[3]),
        'scene': strip_md(cells[4]),
    })

FIELDS = [
    {"name": "分类", "type": "singleSelect"},
    {"name": "高级表达", "type": "text"},
    {"name": "口语化同义词", "type": "text"},
    {"name": "释义", "type": "text"},
    {"name": "例句", "type": "text"},
    {"name": "使用场景", "type": "text"},
    {"name": "打卡次数", "type": "number"},
    {"name": "首次使用", "type": "date"},
    {"name": "最近使用", "type": "date"},
    {"name": "掌握度", "type": "singleSelect"},
]

def rec(r):
    f = {
        "分类": r['cat'],
        "高级表达": r['word'],
        "口语化同义词": r['syn'],
        "释义": r['meaning'],
        "例句": r['example'],
        "使用场景": r['scene'],
        "打卡次数": 0,
        "掌握度": "未用",
    }
    return {"fields": f}

# 小批量测试建表参数（2 条）
test = {
    "name": "高频词汇打卡.dbt",
    "fields": FIELDS,
    "records": [rec(rows[0]), rec(rows[1])],
}
with open(f"{OUT_DIR}/test_create.json", "w", encoding='utf-8') as f:
    json.dump(test, f, ensure_ascii=False, indent=2)

# 全量记录（每条为独立 JSON 字符串，适配 dbsheet.create_records 的 string[] 入参）
all_records = [json.dumps(rec(r), ensure_ascii=False) for r in rows]
with open(f"{OUT_DIR}/all_records.jsonl", "w", encoding='utf-8') as f:
    f.write("\n".join(all_records))

print("总词条:", len(rows))
print("分类数:", len(set(r['cat'] for r in rows)))
print("test_create.json / all_records.jsonl 已生成")
