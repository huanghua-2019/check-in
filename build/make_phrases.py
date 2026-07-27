"""
自适应解析 005-句式工具箱.md，输出 phrases.json。
规则：
- ## 作为分类（含 emoji）
- ### 不新建分类，归入当前 ## 分类
- 表格：表头关键字映射列 → word/syn/meaning/example/scene
- 跳过空行、序号列、表头/分隔行
- 清理 markdown 标记
"""
import json, re, sys

SRC = r"D:\华的obsidian\210-写作提高\002-知识图谱\005-句式工具箱.md"
OUT = r"C:\Users\Lenovo\WorkBuddy\2026-07-21-16-55-18\vocab-checkin\build\phrases.json"

def strip_md(s: str) -> str:
    s = s.strip()
    # 链接 [text](url) -> text
    s = re.sub(r'\[([^\]]+)\]\([^)]+\)', r'\1', s)
    # 强调标记 **bold** / __bold__ / *em* / `code` / ~~del~~
    s = re.sub(r'(\*\*|__)(.*?)\1', r'\2', s)
    s = re.sub(r'(?<!\*)\*(?!\*)(.+?)\*(?!\*)', r'\1', s)
    s = re.sub(r'`([^`]+)`', r'\1', s)
    s = re.sub(r'~~(.+?)~~', r'\1', s)
    return s.strip()

def norm(s: str) -> str:
    return re.sub(r'[\s|]+', '', s).lower()

def col_map(headers):
    """按关键字优先级匹配列。优先匹配第一个命中的列。"""
    nm = [norm(h) for h in headers]
    def find(priorities, skip=None):
        for kw in priorities:
            for i, h in enumerate(nm):
                if i == skip: continue
                if kw in h: return i
        return -1
    word = find(['句式结构', '模板', '句式名称', '主题'])
    syn = find(['句式名称', '模板', '主题'], skip=word)
    meaning = find(['要点', '释义'])
    example = find(['例句', '示例'])
    scene = find(['适用场景', '场景'])
    return {'word': word, 'syn': syn, 'meaning': meaning, 'example': example, 'scene': scene}

def is_sep_row(cells):
    return all(re.match(r'^:?-+:?$', c.strip()) for c in cells if c.strip())

def parse():
    lines = open(SRC, encoding='utf-8').read().splitlines()
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
            # 子标题：保留在父分类下，不新建分类
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
            # 数据行
            def get(idx):
                return strip_md(cells[idx]) if 0 <= idx < len(cells) else ''
            w = get(cmap['word']) if cmap['word'] >= 0 else ''
            if not w: continue
            # 跳过纯序号行（word 是纯数字）
            if re.match(r'^\d+$', w): continue
            syn = get(cmap['syn']) if cmap['syn'] >= 0 else ''
            meaning = get(cmap['meaning']) if cmap['meaning'] >= 0 else ''
            example = get(cmap['example']) if cmap['example'] >= 0 else ''
            scene = get(cmap['scene']) if cmap['scene'] >= 0 else ''
            items.append({
                'cat': current_cat, 'word': w, 'syn': syn,
                'meaning': meaning, 'example': example, 'scene': scene,
            })
        else:
            in_table = False; headers = []; cmap = None
    return items, cats_seen

if __name__ == '__main__':
    items, cats = parse()
    print(f"分类数: {len(cats)}")
    for c in cats: print("  -", c)
    from collections import Counter
    cnt = Counter(i['cat'] for i in items)
    print(f"\n条目总数: {len(items)}")
    for c, n in cnt.items(): print(f"  {c}: {n}")
    json.dump({'items': items, 'cats': cats}, open(OUT, 'w', encoding='utf-8'), ensure_ascii=False, indent=2)
    print(f"\n已写入: {OUT}")
