#!/usr/bin/env python3
# 生成 mcporter 调用参数文件：加字段 / 删默认列 / 分批写记录
import re, json

SRC = r"D:\华的obsidian\210-写作提高\002-知识图谱\002-高频词汇库.md"
FILE_ID = "HgrtVNcpgTly"
SHEET_ID = "BB08J2"
OUT = r"C:\Users\Lenovo\WorkBuddy\2026-07-21-16-55-18\vocab-checkin\build"

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
    if not cells or not cells[0].startswith('**') or '高级表达' in cells[0]:
        continue
    if len(cells) < 5:
        cells = cells + [''] * (5 - len(cells))
    word = strip_md(cells[0])
    if not word:
        continue
    rows.append({'cat': cur, 'word': word, 'syn': strip_md(cells[1]),
                 'meaning': strip_md(cells[2]), 'example': strip_md(cells[3]),
                 'scene': strip_md(cells[4])})

CATS = sorted(set(r['cat'] for r in rows))
STYLES = [3, 4, 5, 6, 7, 1, 2, 8, 3, 4]
cat_options = [{"text": c, "style": STYLES[i % len(STYLES)]} for i, c in enumerate(CATS)]

FIELDS = [
    {"field_title": "分类", "field_type": "singleSelect",
     "property_single_select": {"options": cat_options, "is_multiple": False, "is_quick_add": True}},
    {"field_title": "高级表达", "field_type": "text", "property_text": {}},
    {"field_title": "口语化同义词", "field_type": "text", "property_text": {}},
    {"field_title": "释义", "field_type": "text", "property_text": {}},
    {"field_title": "例句", "field_type": "text", "property_text": {}},
    {"field_title": "使用场景", "field_type": "text", "property_text": {}},
    {"field_title": "打卡次数", "field_type": "number",
     "property_number": {"decimal_places": 0, "use_separate": False}},
    {"field_title": "首次使用", "field_type": "dateTime",
     "property_date_time": {"format": "yyyy-mm-dd", "auto_fill": False}},
    {"field_title": "最近使用", "field_type": "dateTime",
     "property_date_time": {"format": "yyyy-mm-dd", "auto_fill": False}},
    {"field_title": "掌握度", "field_type": "singleSelect",
     "property_single_select": {"options": [
         {"text": "未用", "style": 7}, {"text": "偶尔", "style": 3}, {"text": "熟练", "style": 4}],
         "is_multiple": False, "is_quick_add": True}},
]
# add_fields 入参 fields 为对象数组
fields_args = {"file_id": FILE_ID, "sheet_id": SHEET_ID, "fields": FIELDS}
with open(f"{OUT}/args_add_fields.json", "w", encoding='utf-8') as f:
    json.dump(fields_args, f, ensure_ascii=False)

# 删默认列（含刚才的测试列 fiU86d）
delete_args = {"file_id": FILE_ID, "sheet_id": SHEET_ID,
               "field_ids": ["f68CTP", "f7TNED", "fHYWeN", "fTxDpU", "fuSx02", "fiU86d"]}
with open(f"{OUT}/args_delete_fields.json", "w", encoding='utf-8') as f:
    json.dump(delete_args, f, ensure_ascii=False)

def rec(r):
    fv = [
        {"field": "分类", "option_value": {"items": [{"text": r['cat']}]}},
        {"field": "高级表达", "text_value": {"items": [{"text": r['word'], "type": "text"}]}},
        {"field": "口语化同义词", "text_value": {"items": [{"text": r['syn'], "type": "text"}]}},
        {"field": "释义", "text_value": {"items": [{"text": r['meaning'], "type": "text"}]}},
        {"field": "例句", "text_value": {"items": [{"text": r['example'], "type": "text"}]}},
        {"field": "使用场景", "text_value": {"items": [{"text": r['scene'], "type": "text"}]}},
        {"field": "打卡次数", "number_value": 0},
        {"field": "掌握度", "option_value": {"items": [{"text": "未用"}]}},
    ]
    return {"field_values": fv}

BATCH = 20
n = 0
for i in range(0, len(rows), BATCH):
    batch = [rec(r) for r in rows[i:i + BATCH]]
    args = {"file_id": FILE_ID, "sheet_id": SHEET_ID, "records": batch}  # 对象数组
    with open(f"{OUT}/args_records_{n:02d}.json", "w", encoding='utf-8') as f:
        json.dump(args, f, ensure_ascii=False)
    n += 1

print("生成参数文件：10字段 / 删5列 /", n, "个记录批次（每批≤100）")
