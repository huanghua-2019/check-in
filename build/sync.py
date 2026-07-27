# -*- coding: utf-8 -*-
"""
sync.py —— 高频词汇打卡网页的「统一同步脚本」（方案 A 联动机制核心）

职责（一条命令完成全部）：
  1. 读 sources.json，用对应 parser 解析所有已启用的词库文件
  2. 对照 id_registry.json 分配【稳定 id】：已有词条沿用旧 id，新词条从 next_id 追加
     —— 首次运行自动从现有 data.js 迁移 1134 条旧 id
  3. 【云端记录保护】自动拉取 Supabase 中有打卡记录的 id，强制保留其对应旧词条
     （即使源文件已更新导致 key 不匹配，也用旧 id+旧内容输出，进度绝不丢失）
  4. 【tab 消失保护】若某 tab 在新解析中整体消失（如 rule），保留其旧条目，防止 tab 凭空消失
  5. 生成 data.js（每条 entry 带 tab 字段，前端按 tab 而非 emoji 猜分类）
  6. 自动把 index.html 里 data.js?v=N / app.js?v=N 版本号 +1（根治浏览器缓存）
  7. 打印 diff 报告 + 云端记录保全验证

用法：
  python sync.py            # 正常同步
  python sync.py --dry      # 只打印报告，不写文件
  python sync.py --init     # 强制重新从现有 data.js 迁移注册表
  python sync.py --no-cloud # 跳过云端查询，仅用本地缓存 keep_ids

设计要点：
  - 注册表 key = tab + "\u0001" + cat + "\u0001" + norm(word)
  - 词条被删除时，注册表【保留】其 key→id 映射，防止 id 回收后错配云端记录
  - 修改释义/例句/故事不影响 id；重名词条会视为「删旧+增新」，旧记录需手动迁移（见指南）
"""
import json, re, os, sys, ssl, urllib.request
from collections import Counter
from datetime import datetime

ROOT    = r"C:\Users\Lenovo\WorkBuddy\2026-07-21-16-55-18\vocab-checkin"
SRC     = os.path.join(ROOT, "build", "sources.json")
REG     = os.path.join(ROOT, "build", "id_registry.json")
DATA_JS = os.path.join(ROOT, "data.js")
INDEX   = os.path.join(ROOT, "index.html")
SEP     = "\u0001"   # 注册表 key 的分隔符

# Supabase（只读 anon key，仅用于查询哪些 id 有打卡记录以便保护）
SB_URL = 'https://buzfmugezbemyfdmbgyt.supabase.co'
SB_KEY = 'sb_publishable_HvD6YPPY-RpHLRicuoobSw_aSw1B_Ow'

# ---------------------------------------------------------------------------
# 通用工具
# ---------------------------------------------------------------------------
def strip_md(s: str) -> str:
    s = (s or "").strip()
    s = re.sub(r'\[([^\]]+)\]\([^)]+\)', r'\1', s)
    s = re.sub(r'(\*\*|__)(.*?)\1', r'\2', s)
    s = re.sub(r'(?<!\*)\*(?!\*)(.+?)\*(?!\*)', r'\1', s)
    s = re.sub(r'`([^`]+)`', r'\1', s)
    s = re.sub(r'~~(.+?)~~', r'\1', s)
    s = re.sub(r'<br\s*/?>', '\n', s, flags=re.I)
    s = re.sub(r'\s*\n\s*', '\n', s)
    return s.strip()

def norm_key(s: str) -> str:
    return (s or "").replace('**', '').strip()

def is_sep_row(cells):
    return all(re.match(r'^:?-+:?$', c.strip()) for c in cells if c.strip())

def col_map(headers):
    nm = [re.sub(r'[\s|]+', '', h).lower() for h in headers]
    def find(priorities, skip=None):
        for kw in priorities:
            for i, h in enumerate(nm):
                if i == skip: continue
                if kw in h: return i
        return -1
    word    = find(['场景', '比喻', '金句', '句子', '模板', '句式结构', '句式名称', '主题', '观点'])
    syn     = find(['编号', '序号', '场景', '句式名称'], skip=word)
    meaning = find(['要点', '释义'], skip=word)
    example = find(['句子', '例句', '示例', '比喻', '金句'], skip=word)
    scene   = find(['适用场景', '使用场景'], skip=word)
    return {'word': word, 'syn': syn, 'meaning': meaning, 'example': example, 'scene': scene}

EMO = re.compile(r'[\U0001F300-\U0001FAFF\U00002600-\U000027BF]')

def infer_tab(cat: str) -> str:
    """从分类标题推断 tab（仅首次迁移旧 data.js / 保留旧条目用；新数据由 parser 直接给 tab）。"""
    if cat.startswith('💎'): return 'quote'
    if cat.startswith('🎨'): return 'met'
    if cat.startswith('📖'): return 'rule'
    if cat.startswith('📒'): return 'cases'
    if EMO.search(cat): return 'phr'
    return 'vocab'

# ---------------------------------------------------------------------------
# Parsers —— 每个返回 (items, cats)，items 每条带 tab 字段
# ---------------------------------------------------------------------------
def parse_vocab(path):
    items, cats, cur = [], [], None
    for line in open(path, encoding='utf-8').read().splitlines():
        line = line.rstrip('\n')
        if line.startswith('## '):
            cur = line[3:].strip()
            if cur and cur not in cats: cats.append(cur)
            continue
        if not line.startswith('|'): continue
        if '高级表达' in line: continue
        if set(line.replace('|', '').strip()) <= set('-: '): continue
        cells = [c.strip() for c in line.split('|')]
        if cells and cells[0] == '': cells = cells[1:]
        while cells and cells[-1] == '': cells = cells[:-1]
        if not cells: continue
        cells = cells[:5] + [''] * (5 - len(cells))
        word = strip_md(cells[0])
        if not word: continue
        items.append({'cat': cur, 'word': word, 'syn': strip_md(cells[1]),
                      'mean': strip_md(cells[2]), 'example': strip_md(cells[3]),
                      'scene': strip_md(cells[4]), 'tab': 'vocab'})
    return items, cats

def parse_phrases(path):
    items, cats, cur = [], [], None
    in_table, headers, cmap = False, [], None
    for line in open(path, encoding='utf-8').read().splitlines():
        if line.startswith('## '):
            cur = strip_md(line[3:]).strip()
            if cur and cur not in cats: cats.append(cur)
            in_table, headers, cmap = False, [], None
            continue
        if line.startswith('### '):
            in_table, headers, cmap = False, [], None
            continue
        if not cur: continue
        if line.lstrip().startswith('|'):
            cells = [c.strip() for c in line.strip().strip('|').split('|')]
            if is_sep_row(cells):
                in_table = True; cmap = col_map(headers); continue
            if not in_table:
                headers = cells; continue
            w = strip_md(cells[cmap['word']]) if cmap and cmap['word'] >= 0 else ''
            if not w or re.match(r'^\d+$', w): continue
            items.append({'cat': cur, 'word': w,
                          'syn': strip_md(cells[cmap['syn']]) if cmap and cmap['syn'] >= 0 else '',
                          'mean': strip_md(cells[cmap['meaning']]) if cmap and cmap['meaning'] >= 0 else '',
                          'example': strip_md(cells[cmap['example']]) if cmap and cmap['example'] >= 0 else '',
                          'scene': strip_md(cells[cmap['scene']]) if cmap and cmap['scene'] >= 0 else '',
                          'tab': 'phr'})
        else:
            in_table, headers, cmap = False, [], None
    return items, cats

def parse_quote_like(path, tab):
    """金句 / 比喻 / 幽默 共用：| # | 场景 | 句子 | 三列格式。"""
    items, cats, cur = [], [], None
    in_table, headers, cmap = False, [], None
    for line in open(path, encoding='utf-8').read().splitlines():
        if line.startswith('## '):
            cur = strip_md(line[3:]).strip()
            if cur and cur not in cats: cats.append(cur)
            in_table, headers, cmap = False, [], None
            continue
        if line.startswith('### '):
            in_table, headers, cmap = False, [], None
            continue
        if not cur: continue
        if line.lstrip().startswith('|'):
            cells = [c.strip() for c in line.strip().strip('|').split('|')]
            if is_sep_row(cells):
                in_table = True; cmap = col_map(headers); continue
            if not in_table:
                headers = cells; continue
            w = strip_md(cells[cmap['word']]) if cmap and cmap['word'] >= 0 else ''
            if not w or re.match(r'^\d+$', w): continue
            items.append({'cat': cur, 'word': w,
                          'syn': strip_md(cells[cmap['syn']]) if cmap and cmap['syn'] >= 0 else '',
                          'mean': '',
                          'example': strip_md(cells[cmap['example']]) if cmap and cmap['example'] >= 0 else '',
                          'scene': strip_md(cells[cmap['scene']]) if cmap and cmap['scene'] >= 0 else '',
                          'tab': tab})
        else:
            in_table, headers, cmap = False, [], None
    return items, cats

def parse_quotes(path):    return parse_quote_like(path, 'quote')
def parse_metaphors(path): return parse_quote_like(path, 'met')
def parse_humor(path):     return parse_quote_like(path, 'humor')

def parse_cases(path):
    """006 案例素材库：## 分类 + |项目|内容| 的 key-value，一个分类=一个案例。"""
    items, cats, cur, kv = [], [], None, {}
    def flush():
        nonlocal kv, cur
        if cur and kv:
            view  = kv.get('核心观点', '')
            story = kv.get('故事') or kv.get('背景') or ''
            scene = kv.get('引用时机') or kv.get('引用场景') or ''
            cat = '📒 ' + cur
            if cat not in cats: cats.append(cat)
            items.append({'cat': cat, 'word': view, 'syn': '',
                          'mean': view, 'example': story, 'scene': scene, 'tab': 'cases'})
        kv.clear()
    for line in open(path, encoding='utf-8').read().splitlines():
        if line.startswith('## '):
            flush()
            cur = strip_md(line[3:]).strip()
            continue
        if not line.lstrip().startswith('|'): continue
        cells = [c.strip() for c in line.strip().strip('|').split('|')]
        if is_sep_row(cells): continue
        if len(cells) >= 2:
            k = norm_key(cells[0])
            v = strip_md(cells[1])
            if k in ('项目', '内容'): continue
            kv[k] = v
    flush()
    return items, cats

PARSERS = {
    'vocab': parse_vocab, 'phrases': parse_phrases, 'quotes': parse_quotes,
    'metaphors': parse_metaphors, 'cases': parse_cases, 'humor': parse_humor,
}

# ---------------------------------------------------------------------------
# 云端记录保护
# ---------------------------------------------------------------------------
def fetch_cloud_ids():
    """拉取云端有打卡记录的 id，确保这些词条的进度绝不丢失。"""
    ids = set()
    try:
        url = SB_URL + '/rest/v1/checkin?select=id,count&count=gt.0'
        req = urllib.request.Request(url, headers={'apikey': SB_KEY, 'Authorization': 'Bearer ' + SB_KEY})
        ctx = ssl.create_default_context()
        with urllib.request.urlopen(req, timeout=20, context=ctx) as r:
            rows = json.loads(r.read().decode('utf-8'))
        for row in rows: ids.add(int(row['id']))
        print(f"  ✓ 云端有打卡记录的 id：{len(ids)} 条（自动保护，进度绝不丢失）")
    except Exception as ex:
        print(f"  ⚠ 云端查询失败（{ex}），将仅用本地缓存 keep_ids")
    # 合并本地缓存（供离线或云端不可达时兜底）
    keep_file = os.path.join(ROOT, 'build', 'cloud_keep_ids.json')
    if os.path.exists(keep_file):
        try:
            cached = set(json.load(open(keep_file, encoding='utf-8')))
            if cached - ids: print(f"  ✓ 合并本地缓存 keep_ids：+{len(cached - ids)} 条")
            ids |= cached
        except Exception: pass
    if ids:
        try: json.dump(sorted(ids), open(keep_file, 'w', encoding='utf-8'), ensure_ascii=False)
        except Exception: pass
    return ids

# ---------------------------------------------------------------------------
# 注册表加载 / 迁移
# ---------------------------------------------------------------------------
def load_existing_vocab(path):
    txt = open(path, encoding='utf-8').read()
    m = re.search(r'window\.VOCAB\s*=\s*(\[[\s\S]*?\])\s*;', txt)
    return json.loads(m.group(1))

def build_registry_from_existing():
    """首次运行：从现有 data.js 复用 1134 条旧 id。"""
    old = load_existing_vocab(DATA_JS)
    entries = {}
    next_id = 1
    for e in old:
        t = infer_tab(e['cat'])
        key = t + SEP + e['cat'] + SEP + norm_key(e['word'])
        entries[key] = e['id']
        next_id = max(next_id, e['id'] + 1)
    return {'next_id': next_id, 'entries': entries, 'created': datetime.now().isoformat()}

# ---------------------------------------------------------------------------
# 主流程
# ---------------------------------------------------------------------------
def main():
    dry = '--dry' in sys.argv
    force_init = '--init' in sys.argv
    no_cloud = '--no-cloud' in sys.argv

    cfg = json.load(open(SRC, encoding='utf-8'))
    root = cfg['root']
    sources = sorted([s for s in cfg['sources'] if s.get('enabled')], key=lambda s: s.get('order', 99))

    # 1) 解析所有启用源
    all_items, all_cats = [], []
    for s in sources:
        path = os.path.join(root, s['file'])
        its, cs = PARSERS[s['parser']](path)
        all_items.extend(its)
        for c in cs:
            if c not in all_cats: all_cats.append(c)
        print(f"  ✓ {s['file']:24s} 解析 {len(its):3d} 条 / {len(cs)} 分类")

    new_tabs = set(it['tab'] for it in all_items)
    current_keys = set(it['tab'] + SEP + it['cat'] + SEP + norm_key(it['word']) for it in all_items)

    # 2) 加载或迁移注册表
    if os.path.exists(REG) and not force_init:
        reg = json.load(open(REG, encoding='utf-8'))
        old_keys = set(reg.get('entries', {}).keys())
        print(f"  ✓ 加载注册表：已登记 {len(old_keys)} 条，next_id={reg.get('next_id')}")
    else:
        reg = build_registry_from_existing()
        old_keys = set(reg['entries'].keys())
        print(f"  ✓ 首次迁移：从现有 data.js 复用 {len(old_keys)} 条旧 id，next_id={reg['next_id']}")

    # 3) 分配稳定 id（key 匹配复用，否则新分配）
    result = []
    for it in all_items:
        key = it['tab'] + SEP + it['cat'] + SEP + norm_key(it['word'])
        if key in reg['entries']:
            eid = reg['entries'][key]
        else:
            eid = reg['next_id']; reg['next_id'] += 1
            reg['entries'][key] = eid
        result.append({'id': eid, 'cat': it['cat'], 'word': it['word'], 'syn': it.get('syn', ''),
                       'mean': it.get('mean', ''), 'example': it.get('example', ''),
                       'scene': it.get('scene', ''), 'tab': it['tab']})

    # 4) 保护：云端有记录的 id + tab 整体消失的旧条目
    old_map = {e['id']: e for e in load_existing_vocab(DATA_JS)}
    protected = set()
    if not no_cloud:
        protected |= fetch_cloud_ids()
    else:
        kf = os.path.join(ROOT, 'build', 'cloud_keep_ids.json')
        if os.path.exists(kf):
            protected |= set(json.load(open(kf, encoding='utf-8')))
            print(f"  ✓ --no-cloud：使用本地 keep_ids {len(protected)} 条")
    # tab 消失保护
    for e in old_map.values():
        if infer_tab(e['cat']) not in new_tabs:
            protected.add(e['id'])

    result_ids = {it['id'] for it in result}
    protected_keys = set()
    for kid in sorted(protected):
        if kid in result_ids or kid not in old_map:
            continue
        e = old_map[kid]
        t = infer_tab(e['cat'])
        protected_keys.add(t + SEP + e['cat'] + SEP + norm_key(e['word']))
        result.append({'id': kid, 'cat': e['cat'], 'word': e['word'], 'syn': e.get('syn', ''),
                       'mean': e.get('mean', ''), 'example': e.get('example', ''),
                       'scene': e.get('scene', ''), 'tab': t})
        result_ids.add(kid)
        if e['cat'] not in all_cats: all_cats.append(e['cat'])
    result.sort(key=lambda x: x['id'])

    # 5) diff 统计
    removed = [k for k in old_keys if k not in current_keys and k not in protected_keys]
    reused = len(current_keys & old_keys)

    # 6) 写文件
    if not dry:
        out = "/* build: " + datetime.now().isoformat() + " */\n"
        out += "window.VOCAB=" + json.dumps(result, ensure_ascii=False, separators=(',', ':')) + ";\n"
        out += "window.CATEGORIES=" + json.dumps(all_cats, ensure_ascii=False, separators=(',', ':')) + ";\n"
        open(DATA_JS, 'w', encoding='utf-8').write(out)

        reg['updated'] = datetime.now().isoformat()
        reg['count'] = len(reg['entries'])
        json.dump(reg, open(REG, 'w', encoding='utf-8'), ensure_ascii=False, indent=2)

        html = open(INDEX, encoding='utf-8').read()
        new_html = html
        for fn in ('data.js', 'app.js'):
            m = re.search(r'(' + fn + r'\?v=)(\d+)', html)
            if m:
                nv = int(m.group(2)) + 1
                new_html = new_html.replace(m.group(0), f'{fn}?v={nv}')
        if new_html != html:
            open(INDEX, 'w', encoding='utf-8').write(new_html)
            print(f"  ✓ index.html 版本号已更新（data.js/app.js ?v+1）")

    # 7) 验证：云端记录全部保留
    out_map = {it['id']: it for it in result}
    missing = [i for i in protected if i not in out_map]
    if missing:
        print(f"\n  ⚠⚠⚠ 严重：以下受保护 id 未出现在输出中：{missing}")
    else:
        print(f"\n  ✓ 云端 {len([i for i in protected if i in out_map])} 条受保护记录全部保留在 data.js")

    # 8) 报告
    print("\n" + "=" * 56)
    print(f"同步完成：共 {len(result)} 条 / {len(all_cats)} 分类")
    print(f"  复用旧 id : {reused} 条")
    print(f"  新增分配  : {len(current_keys) - reused} 条")
    print(f"  强制保留  : {len(protected)} 条（云端记录 + tab 保护）")
    print(f"  已移除    : {len(removed)} 条（注册表保留其 id，防云端记录错配）")
    cnt = Counter(it['tab'] for it in result)
    print("  各 Tab 条数：")
    for t, n in cnt.items():
        print(f"    {t:8s} {n}")
    if removed:
        print("\n  移除样例（注册表保留 id）：")
        for k in removed[:15]:
            parts = k.split(SEP)
            print(f"    - [{parts[0]}] {parts[2][:30]}  （{parts[1][:20]}）")
    print("=" * 56)

if __name__ == '__main__':
    main()
