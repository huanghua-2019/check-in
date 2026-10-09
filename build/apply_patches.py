#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""把字段补齐补丁合并进 data.js。

来源：
  patch_01.json / patch_04.json / patch_02_03.json / patch_05_07.json  —— 519 条缺失字段
  patch_01_meanfix.json / meanfix_04.json / extra_fix.json            —— 字段错位修正
并全局清理字段里的 ** Markdown 残留。

用法：
  python apply_patches.py --src data.js            # 干跑
  python apply_patches.py --src data.js --apply    # 落盘（自动备份）
"""
import argparse
import json
import re
import shutil
from datetime import datetime
from pathlib import Path

PATCH_FILES = [
    'patch_01.json',
    'patch_04.json',
    'patch_02_03.json',
    'patch_05_07.json',
    'patch_phr_a.json',
    'patch_phr_b.json',
    'patch_01_meanfix.json',
    'meanfix_04.json',
    'extra_fix.json',
]
FIELDS = ['syn', 'mean', 'example', 'scene']
TEXT_FIELDS = ['word', 'syn', 'mean', 'example', 'scene']


def load_patches(build: Path):
    merged = {}
    stat = []
    for fn in PATCH_FILES:
        p = build / fn
        if not p.exists():
            print(f'  跳过（不存在）: {fn}')
            continue
        data = json.loads(p.read_text(encoding='utf-8'))
        n = 0
        for k, v in data.items():
            v = {a: b for a, b in v.items() if not a.startswith('_')}
            if not v:
                continue
            merged.setdefault(int(k), {}).update(v)
            n += 1
        stat.append((fn, n))
    return merged, stat


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--src', required=True, help='data.js 路径')
    ap.add_argument('--apply', action='store_true', help='落盘（默认干跑）')
    a = ap.parse_args()

    src = Path(a.src)
    raw = src.read_bytes()
    text = raw.decode('utf-8')

    mv = re.search(r'window\.VOCAB=(\[.*?\]);', text, re.S)
    mc = re.search(r'window\.CATEGORIES=(\[.*?\]);', text, re.S)
    vocab = json.loads(mv.group(1))
    cats = json.loads(mc.group(1))
    before = len(vocab)

    build = src.parent / 'build'
    merged, stat = load_patches(build)
    print('=== 补丁合并 ===')
    for fn, n in stat:
        print(f'  {fn:<26} {n:>4} 条')
    print(f'  合并后唯一 id: {len(merged)}')

    by_id = {x['id']: x for x in vocab}

    # ---- 1. 应用补丁 ----
    applied = miss = 0
    field_hits = {f: 0 for f in FIELDS}
    for i, patch in merged.items():
        x = by_id.get(i)
        if x is None:
            miss += 1
            print(f'  [警告] id {i} 不存在，跳过')
            continue
        for f, val in patch.items():
            if f not in FIELDS and f != 'word':
                print(f'  [警告] id {i} 未知字段 {f}')
                continue
            x[f] = val
            field_hits[f] = field_hits.get(f, 0) + 1
        applied += 1
    print('=== 应用结果 ===')
    print(f'  命中条目: {applied}   未找到: {miss}')
    for f, n in field_hits.items():
        if n:
            print(f'    {f:<8} 写入 {n} 条')

    # ---- 2. 清理 ** 残留 ----
    cleaned = 0
    for x in vocab:
        for f in TEXT_FIELDS:
            v = x.get(f)
            if isinstance(v, str) and '**' in v:
                x[f] = v.replace('**', '').strip()
                cleaned += 1
    print(f'=== 清理 Markdown 残留: {cleaned} 个字段 ===')

    # ---- 3. 完整性复核 ----
    def bad(v):
        v = (v or '').strip()
        return (not v) or v in ('-', '—', '无')

    left = [x for x in vocab if x.get('tab') == 'vocab' and any(bad(x.get(f)) for f in FIELDS)]
    print(f'=== vocab 仍有空字段: {len(left)} 条 ===')
    for x in left[:10]:
        print('   id%-5s %s 缺 %s' % (x['id'], x['word'][:16],
                                      [f for f in FIELDS if bad(x.get(f))]))

    if not a.apply:
        print('\n（干跑，未落盘。加 --apply 执行）')
        return

    # ---- 4. 落盘 ----
    bak_dir = build / 'backup'
    bak_dir.mkdir(parents=True, exist_ok=True)
    bak = bak_dir / f'data_prefill_{datetime.now():%Y%m%d_%H%M%S}.js'
    shutil.copy2(src, bak)
    print(f'已备份 → {bak}')

    stamp = datetime.now().isoformat()
    head = text[:mv.start()]
    head = re.sub(r'/\* build: .*? \*/', f'/* build: {stamp} */', head, count=1)
    if '/* build:' not in head:
        head = f'/* build: {stamp} */\r\n' + head.lstrip('\r\n')
    tail = text[mv.end():]
    new_vocab = json.dumps(vocab, ensure_ascii=False, separators=(',', ':'))
    out = head + 'window.VOCAB=' + new_vocab + ';' + tail
    src.write_bytes(out.encode('utf-8'))

    # ---- 5. 校验 ----
    rb = src.read_bytes()
    rs = rb.decode('utf-8')
    rv = json.loads(re.search(r'window\.VOCAB=(\[.*?\]);', rs, re.S).group(1))
    rc = json.loads(re.search(r'window\.CATEGORIES=(\[.*?\]);', rs, re.S).group(1))
    print('=== 落盘校验 ===')
    print(f'  条数: {before} → {len(rv)}（应相等）')
    print(f'  分类数: {len(rc)}（应={len(cats)}）')
    print(f'  id 唯一: {len({x["id"] for x in rv}) == len(rv)}')
    print(f'  word 唯一: {len({x["word"] for x in rv}) == len(rv)}')
    print(f'  分类越界: {sum(1 for x in rv if x["cat"] not in rc)}')
    print(f'  CRLF: {rb.count(chr(13).encode() + chr(10).encode())}  '
          f'裸LF: {rb.count(chr(10).encode()) - rb.count(chr(13).encode() + chr(10).encode())}')
    print(f'  残留 **: {sum(1 for x in rv for f in TEXT_FIELDS if "**" in (x.get(f) or ""))}')


if __name__ == '__main__':
    main()
