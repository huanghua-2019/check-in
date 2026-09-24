#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
词库清洗脚本（check-in / data.js）

铁律：
  1. 绝不重新编号 id —— id 是打卡进度主键（localStorage vocab_checkin_state_v1 + 云端 checkin 表）。
  2. 改分类必须同步改写 window.CATEGORIES，且同一分类内 tab 必须统一（前端 CAT_TAB 按分类推导）。
  3. 保持原文件格式：CRLF 换行、JSON 无空格、ensure_ascii=False。

用法：
  python clean_vocab.py --src data.js              # 干跑：只打印变更清单
  python clean_vocab.py --src data.js --apply      # 落盘（先自动备份）
"""
import argparse
import json
import re
import shutil
import sys
from collections import Counter, defaultdict
from datetime import datetime
from pathlib import Path

# ---------- 新分类 ----------
NEW_SENT_CAT = '✍️ 表达句式与模板'      # 句式型条目归位到此分类（tab=phr）
CASE_CAT = '📒 案例库'                  # 9 个碎案例分类合一
CAT_FIX = {
    '💎 🧠 人性与认知': '🧠 人性与认知',
    '🎨 ⚠️ 风险与警示': '⚠️ 风险与警示',
}

# 「XX（现在叫：YY）」是刻意设计的网络新词对照条，必须保留在词汇，不算句式。
EUPH = re.compile(r'（现在叫[:：]')
# 句式模板的高精度特征：省略号占位 / 引号开头 / XX·YY·A·B 占位符
# 注意：不把 " vs " 当句式特征 —— 那类是"概念对比"（如「模糊的正确 vs 精确的错误」），属于词条。
SENT_MARK = re.compile(r'…|^“|^‘|XX|YY|[\u4e00-\u9fa5]A[，,]')


def is_sentence_form(word: str) -> bool:
    """高精度判断 word 是不是"句式模板"。宁可漏判，不可误判。"""
    if not word or EUPH.search(word):
        return False
    return bool(SENT_MARK.search(word))


# word 字段里混入的机器注释，剥出来还给 syn
MANGLE_RULES = [
    (re.compile(r'^(.+?)（同义词[:：](.+?)）$'), 2),
    (re.compile(r'^(.+?)[：:]近似词[:：](.+)$'), 2),
]


def normalize_word(entry: dict):
    """把 word 里混入的注释剥离到 syn。返回 (旧word, 新word, 补入的syn) 或 None。"""
    raw = entry.get('word') or ''
    for pat, gi in MANGLE_RULES:
        m = pat.match(raw)
        if m:
            new_word, extra = m.group(1), m.group(gi)
            old_syn = (entry.get('syn') or '').strip()
            if not old_syn or len(extra) > len(old_syn):
                entry['syn'] = extra
            entry['word'] = new_word
            return raw, new_word, entry['syn']
    return None


def quality_score(entry: dict) -> tuple:
    """去重时判断哪一条更值得保留。分数越高越优。"""
    mean = (entry.get('mean') or '').strip()
    syn = (entry.get('syn') or '').strip()
    s = 0
    if mean:
        s += 3
    if mean and mean != syn:
        s += 3                                   # syn 与 mean 不同才算字段齐备
    s += min(len(mean), 60) / 60
    s += min(len(entry.get('scene') or ''), 40) / 40
    s += min(len(entry.get('example') or ''), 80) / 80
    if entry.get('tab') == 'rule':
        s += 1                                   # 规则条目优先（如破折号用法）
    return (s, -entry['id'])                     # 同分时保留 id 靠前的


def load(path: Path):
    raw = path.read_text(encoding='utf-8')
    vocab = json.loads(re.search(r'window\.VOCAB=(\[.*?\]);', raw, re.S).group(1))
    cats = json.loads(re.search(r'window\.CATEGORIES=(\[.*?\]);', raw, re.S).group(1))
    return vocab, cats, raw


def dump(path: Path, vocab, cats):
    now = datetime.now().isoformat(timespec='microseconds')
    body = (
        f'/* build: {now} */\n'
        f'window.VOCAB={json.dumps(vocab, ensure_ascii=False, separators=(",", ":"))};\n'
        f'window.CATEGORIES={json.dumps(cats, ensure_ascii=False, separators=(",", ":"))};\n'
    )
    path.write_text(body, encoding='utf-8', newline='\r\n')


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--src', default='data.js')
    ap.add_argument('--out', default=None)
    ap.add_argument('--apply', action='store_true')
    a = ap.parse_args()

    src = Path(a.src)
    out = Path(a.out) if a.out else src
    vocab, cats, _ = load(src)
    n0 = len(vocab)
    log = []

    # ---- 0. 剥离 word 字段里混入的机器注释 ----
    norm_n = 0
    for e in vocab:
        r = normalize_word(e)
        if r:
            norm_n += 1
            log.append(f'[字段剥离] id{e["id"]} word「{r[0]}」→「{r[1]}」，注释归还 syn')

    # ---- 1. 分类畸名归位 ----
    fixed = 0
    for e in vocab:
        if e['cat'] in CAT_FIX:
            log.append(f"[分类归位] id{e['id']} {e['word']} : {e['cat']} → {CAT_FIX[e['cat']]}")
            e['cat'] = CAT_FIX[e['cat']]
            fixed += 1

    # ---- 2. 9 个碎案例分类合一 ----
    case_n = 0
    for e in vocab:
        if e['cat'].startswith('📒 ') and e['cat'] != CASE_CAT:
            e['cat'] = CASE_CAT
            case_n += 1
    if case_n:
        log.append(f'[案例合一] {case_n} 条 → {CASE_CAT}')

    # ---- 3. 句式型条目从 vocab 归位到 phr ----
    moved = 0
    for e in vocab:
        if e.get('tab') == 'vocab' and is_sentence_form(e.get('word', '')):
            log.append(f"[句式归位] id{e['id']} [{e['cat']}] {e['word'][:34]} → {NEW_SENT_CAT}")
            e['cat'] = NEW_SENT_CAT
            e['tab'] = 'phr'
            moved += 1

    # ---- 4. 去重（同 word 只留一条）----
    by_word = defaultdict(list)
    for e in vocab:
        by_word[e['word']].append(e)
    drop_ids = set()
    for w, group in by_word.items():
        if len(group) < 2:
            continue
        keep = max(group, key=quality_score)
        for e in group:
            if e is not keep:
                drop_ids.add(e['id'])
                log.append(f"[去重] 删 id{e['id']} [{e['cat']}] {w}  ← 保留 id{keep['id']}")

    vocab = [e for e in vocab if e['id'] not in drop_ids]

    # ---- 5. 分类内 tab 一致性（防 CAT_TAB 抖动）----
    cat_tabs = defaultdict(Counter)
    for e in vocab:
        if e.get('tab'):
            cat_tabs[e['cat']][e['tab']] += 1
    for c, cnt in cat_tabs.items():
        if len(cnt) > 1:
            main_tab = cnt.most_common(1)[0][0]
            for e in vocab:
                if e['cat'] == c and e.get('tab') != main_tab:
                    log.append(f"[tab统一] id{e['id']} {e['word'][:24]} : {e['tab']} → {main_tab}")
                    e['tab'] = main_tab

    # ---- 6. 重建 CATEGORIES（保留原顺序，新增分类插到末尾）----
    new_cats = []
    for c in cats:
        c = CAT_FIX.get(c, c)
        if c.startswith('📒 ') and c != CASE_CAT:
            continue
        if c not in new_cats:
            new_cats.append(c)
    if case_n and CASE_CAT not in new_cats:
        new_cats.append(CASE_CAT)
    if moved and NEW_SENT_CAT not in new_cats:
        new_cats.append(NEW_SENT_CAT)
    # 兜底：VOCAB 里出现但 CATEGORIES 漏掉的分类
    for e in vocab:
        if e['cat'] not in new_cats:
            new_cats.append(e['cat'])
            log.append(f'[补分类] CATEGORIES 缺失 → {e["cat"]}')

    # ---- 7. 质量体检（只报告，不改内容）----
    v = [e for e in vocab if e.get('tab') == 'vocab']
    no_word = [e for e in vocab if not (e.get('word') or '').strip()]
    no_mean = [e for e in v if not (e.get('mean') or '').strip()]
    syn_eq_mean = [e for e in v if e.get('syn') and e['syn'].strip() == (e.get('mean') or '').strip()]
    syn_long = [e for e in v if len(e.get('syn') or '') > 18 or '。' in (e.get('syn') or '')]
    heap = [e for e in v if (e.get('mean') or '').strip()
            and len(e['mean'].strip()) <= 12 and not re.search(r'[。；]', e['mean'])]

    print('=' * 70)
    print(f'源文件 {src}   清洗前 {n0} 条 / {len(cats)} 分类')
    print('=' * 70)
    for line in log:
        print(' ', line)
    print('-' * 70)
    print(f'  删除重复        : {len(drop_ids)} 条')
    print(f'  字段剥离        : {norm_n} 条')
    print(f'  句式条目归位    : {moved} 条 → {NEW_SENT_CAT}')
    print(f'  畸名分类归位    : {fixed} 条')
    print(f'  案例分类合一    : {case_n} 条 → {CASE_CAT}')
    print(f'  清洗后          : {len(vocab)} 条 / {len(new_cats)} 分类')
    print('-' * 70)
    print('  质量体检（仅报告，内容待重写）:')
    print(f'    word 为空          : {len(no_word)} 条  {[e["id"] for e in no_word][:12]}')
    print(f'    mean 为空          : {len(no_mean)} 条  {[e["id"] for e in no_mean][:12]}')
    print(f'    syn 与 mean 相同   : {len(syn_eq_mean)} 条')
    print(f'    syn 写成了释义句   : {len(syn_long)} 条')
    print(f'    mean 是纯同义堆砌  : {len(heap)} 条')
    long_left = [e for e in v if len(e.get('word') or '') >= 8]
    print(f'    长条目未自动归位   : {len(long_left)} 条（需人工判定，清单见 build/review_long.txt）')
    print('=' * 70)

    if not a.apply:
        print('（干跑，未落盘。加 --apply 执行）')
        return 0

    # 输出待人工判定清单，供用户过目
    rv = src.parent / 'build' / 'review_long.txt'
    with rv.open('w', encoding='utf-8') as f:
        f.write(f'# 长条目待人工判定（{len(long_left)} 条）\n')
        f.write('# 这些条目 word>=8 字但没含句式占位符，可能是：术语群 / 金句 / 字段错位的坏条目\n\n')
        for e in long_left:
            f.write(f'id{e["id"]}\t[{e["cat"]}]\t{e["word"]}\n')
            f.write(f'\tsyn : {e.get("syn","")}\n')
            f.write(f'\tmean: {e.get("mean","")}\n')
            f.write(f'\tscene: {(e.get("scene") or "")[:80]}\n\n')

    bak = src.parent / 'build' / 'backup' / f'data_preclean_{datetime.now():%Y%m%d_%H%M%S}.js'
    bak.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy2(src, bak)
    dump(out, vocab, cats=new_cats)
    print(f'已备份 → {bak}')
    print(f'已写入 → {out}')
    return 0


if __name__ == '__main__':
    sys.exit(main())
