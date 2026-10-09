#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""把「金句/比喻/段子/案例/写作规则」四字段补丁合并进 data.js。

来源：patch_rest_q1.json / q2 / m1 / m2 / m3 / x.json
基准：todo_rest.json（460 条待补清单）

用法：
  python apply_rest.py --src data.js            # 干跑
  python apply_rest.py --src data.js --apply    # 落盘（自动备份）
"""
import argparse
import json
import re
import shutil
from datetime import datetime
from pathlib import Path

PATCH_FILES = ['patch_rest_q1.json', 'patch_rest_q2.json', 'patch_rest_m1.json',
               'patch_rest_m2.json', 'patch_rest_m3.json', 'patch_rest_x.json']
FIELDS = ['syn', 'mean', 'example', 'scene']
TEXT_FIELDS = ['word', 'syn', 'mean', 'example', 'scene']
TABS = ['quote', 'met', 'humor', 'cases', 'rule']


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--src', required=True)
    ap.add_argument('--apply', action='store_true')
    a = ap.parse_args()

    src = Path(a.src)
    build = src.parent / 'build'
    raw = src.read_bytes()
    text = raw.decode('utf-8')

    mv = re.search(r'window\.VOCAB=(\[.*?\]);', text, re.S)
    mc = re.search(r'window\.CATEGORIES=(\[.*?\]);', text, re.S)
    vocab = json.loads(mv.group(1))
    cats = json.loads(mc.group(1))
    before = len(vocab)
    by_id = {x['id']: x for x in vocab}

    todo = json.loads((build / 'todo_rest.json').read_text(encoding='utf-8'))
    need = {x['id']: x for x in todo}

    # ---- 1. 载入并校验补丁 ----
    print('=== 补丁载入 ===')
    merged, problems = {}, []
    for fn in PATCH_FILES:
        p = build / fn
        if not p.exists():
            problems.append(f'缺文件 {fn}')
            continue
        data = json.loads(p.read_text(encoding='utf-8'))
        for k, v in data.items():
            i = int(k)
            merged.setdefault(i, {}).update(v)
        print(f'  {fn:<26} {len(data):>4} 条')

    print(f'  合并后唯一 id: {len(merged)}  (应={len(need)})')

    for i, patch in merged.items():
        t = need.get(i)
        if t is None:
            problems.append(f'id {i} 不在待补清单')
            continue
        if i not in by_id:
            problems.append(f'id {i} 在 data.js 中不存在')
            continue
        for f, val in patch.items():
            if f not in FIELDS:
                problems.append(f'id {i} 未知字段 {f}')
                continue
            if f not in t['miss']:
                problems.append(f'id {i} 补了非缺失字段 {f}')
            s = str(val).strip()
            if not s or s.isdigit() or '**' in s or len(s) < 8:
                problems.append(f'id {i} 字段 {f} 可疑: {s[:30]}')
    for i, t in need.items():
        if i not in merged:
            problems.append(f'id {i} 完全没补')
        else:
            for f in t['miss']:
                if f not in merged[i]:
                    problems.append(f'id {i} 仍缺 {f}')

    print(f'=== 校验问题: {len(problems)} ===')
    for p in problems[:30]:
        print('   ', p)

    # ---- 2. 应用 ----
    hits = {f: 0 for f in FIELDS}
    for i, patch in merged.items():
        x = by_id.get(i)
        if x is None:
            continue
        for f, val in patch.items():
            if f in FIELDS:
                x[f] = val
                hits[f] += 1
    print('=== 应用结果 ===')
    for f, n in hits.items():
        if n:
            print(f'    {f:<8} 写入 {n} 条')

    # ---- 3. 全库复核：460 条字段是否齐 ----
    still = []
    for t in todo:
        x = by_id[t['id']]
        for f in ('syn', 'mean', 'scene'):
            v = str(x.get(f, '') or '').strip()
            if not v or v.isdigit():
                still.append((t['id'], t['tab'], f, v[:20]))
    print(f'=== 剩余空/脏字段: {len(still)} 处 ===')
    for s in still[:15]:
        print('    ', s)

    # 各 tab 字段完整度
    print('=== 各 tab 字段完整度 ===')
    for t in TABS:
        rows = [x for x in vocab if x.get('tab') == t]
        blank = sum(1 for x in rows if any(
            not str(x.get(f, '') or '').strip() for f in ('syn', 'mean', 'example', 'scene')))
        print(f'    {t:<7} {len(rows):>4} 条, 有空字段 {blank} 条')

    if not a.apply:
        print('\n（干跑，未落盘。加 --apply 执行）')
        return
    if problems:
        print('\n存在校验问题，拒绝落盘。修好再来。')
        return

    # ---- 4. 落盘 ----
    bak_dir = build / 'backup'
    bak_dir.mkdir(parents=True, exist_ok=True)
    bak = bak_dir / f'data_prerest_{datetime.now():%Y%m%d_%H%M%S}.js'
    shutil.copy2(src, bak)
    print(f'已备份 → {bak}')

    stamp = datetime.now().isoformat()
    head = text[:mv.start()]
    head = re.sub(r'/\* build: .*? \*/', f'/* build: {stamp} */', head, count=1)
    if '/* build:' not in head:
        head = f'/* build: {stamp} */\r\n' + head.lstrip('\r\n')
    tail = text[mv.end():]
    new_vocab = json.dumps(vocab, ensure_ascii=False, separators=(',', ':'))
    src.write_bytes((head + 'window.VOCAB=' + new_vocab + ';' + tail).encode('utf-8'))

    # ---- 5. 落盘校验 ----
    rb = src.read_bytes()
    rs = rb.decode('utf-8')
    rv = json.loads(re.search(r'window\.VOCAB=(\[.*?\]);', rs, re.S).group(1))
    rc = json.loads(re.search(r'window\.CATEGORIES=(\[.*?\]);', rs, re.S).group(1))
    print('=== 落盘校验 ===')
    print(f'  条数: {before} → {len(rv)}（应相等）')
    print(f'  id 唯一: {len({x["id"] for x in rv}) == len(rv)}')
    print(f'  分类数: {len(rc)}（应={len(cats)}）')
    print(f'  分类越界: {sum(1 for x in rv if x["cat"] not in rc)}')
    print(f'  残留 **: {sum(1 for x in rv for f in TEXT_FIELDS if "**" in (x.get(f) or ""))}')
    print(f'  CRLF: {rb.count(b"\r\n")}  裸LF: {rb.count(b"\n") - rb.count(b"\r\n")}')


if __name__ == '__main__':
    main()
