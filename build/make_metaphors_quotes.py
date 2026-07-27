"""
解析 003-金句调用地图.md 和 004-比喻调用地图.md。
格式：| # | 场景 | 句子 | (3列)
字段映射：
  word = 场景
  syn  = 编号（去掉前导零）
  example = 句子（strip <br>、strip markdown）
  mean/scene = 空
"""
import json, re

SRC_003 = r"D:\华的obsidian\210-写作提高\002-知识图谱\003-金句调用地图.md"
SRC_004 = r"D:\华的obsidian\210-写作提高\002-知识图谱\004-比喻调用地图.md"
OUT = r"C:\Users\Lenovo\WorkBuddy\2026-07-21-16-55-18\vocab-checkin\build\metaphors_quotes.json"

def strip_md(s: str) -> str:
    s = s.strip()
    s = re.sub(r'\[([^\]]+)\]\([^)]+\)', r'\1', s)
    s = re.sub(r'(\*\*|__)(.*?)\1', r'\2', s)
    s = re.sub(r'(?<!\*)\*(?!\*)(.+?)\*(?!\*)', r'\1', s)
    s = re.sub(r'`([^`]+)`', r'\1', s)
    s = re.sub(r'~~(.+?)~~', r'\1', s)
    s = re.sub(r'<br\s*/?>', '\n', s, flags=re.I)
    s = s.replace('\\.', '.')
    s = re.sub(r'\s*\n\s*', '\n', s)
    return s.strip()

def norm(s: str) -> str:
    s = re.sub(r'[\s|]+', '', s).lower()
    if s == '#': s = '编号'
    return s

def col_map(headers):
    nm = [norm(h) for h in headers]
    def find(priorities, skip=None):
        for kw in priorities:
            for i, h in enumerate(nm):
                if i == skip: continue
                if kw in h: return i
        return -1
    word = find(['场景', '比喻', '金句', '句子', '模板', '句式结构', '句式名称', '主题'])
    syn = find(['编号', '序号', '场景', '句式名称'], skip=word)
    meaning = find(['要点', '释义'], skip=word)
    example = find(['句子', '例句', '示例', '比喻', '金句'], skip=word)
    scene = find(['适用场景', '使用场景'], skip=word)
    return {'word': word, 'syn': syn, 'meaning': meaning, 'example': example, 'scene': scene}

def is_sep_row(cells):
    return all(re.match(r'^:?-+:?$', c.strip()) for c in cells if c.strip())

def parse(path):
    lines = open(path, encoding='utf-8').read().splitlines()
    current_cat = None
    in_table = False
    headers = []
    cmap = None
    items = []
    cats_seen = []
    for line in lines:
        if line.startswith('## '):
            current_cat = strip_md(line[3:]).strip()
            if current_cat and current_cat not in cats_seen:
                cats_seen.append(current_cat)
            in_table = False; headers = []; cmap = None
            continue
        if line.startswith('### '):
            in_table = False; headers = []; cmap = None
            continue
        if not current_cat: continue
        if line.lstrip().startswith('|'):
            cells = [c.strip() for c in line.strip().strip('|').split('|')]
            if is_sep_row(cells):
                in_table = True
                cmap = col_map(headers)
                continue
            if not in_table:
                headers = cells
                continue
            def get(idx):
                return strip_md(cells[idx]) if 0 <= idx < len(cells) else ''
            w = get(cmap['word']) if cmap['word'] >= 0 else ''
            if not w: continue
            syn = get(cmap['syn']) if cmap['syn'] >= 0 else ''
            example = get(cmap['example']) if cmap['example'] >= 0 else ''
            scene = get(cmap['scene']) if cmap['scene'] >= 0 else ''
            items.append({
                'cat': current_cat, 'word': w, 'syn': syn,
                'meaning': '', 'example': example, 'scene': scene,
            })
        else:
            in_table = False; headers = []; cmap = None
    return items, cats_seen

if __name__ == '__main__':
    items, cats = [], []
    for path in [SRC_003, SRC_004]:
        its, cs = parse(path)
        items.extend(its)
        cats.extend(cs)
        for c in cs:
            if c not in cats: cats.append(c)
    from collections import Counter
    cnt = Counter(i['cat'] for i in items)
    print(f"分类数: {len(cats)}")
    for c in cats: print("  -", c)
    print(f"\n条目总数: {len(items)}")
    for c, n in cnt.items(): print(f"  {c}: {n}")
    json.dump({'items': items, 'cats': cats}, open(OUT, 'w', encoding='utf-8'), ensure_ascii=False, indent=2)
    print(f"\n已写入: {OUT}")
