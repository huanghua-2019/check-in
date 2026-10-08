#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
修正词库中 syn / mean 字段错位与串抄（同一句释义抄到多个词上）。

用法:
    python fix_fields.py --src data.js            # 干跑，只打印将要做的改动
    python fix_fields.py --src data.js --apply    # 落盘（自动备份到 build/backup/）

背景:
    词库采用「syn=简短近义词、mean=释义」的两字段结构。
    实际数据中若干条目的 syn 被误填为别的词的释义（如统一的「精准、精确、到位」），
    个别条目 syn / mean 整个颠倒。本脚本按 id 精确修正，不改动其他任何字段与条目。
"""
import argparse
import json
import re
import shutil
import sys
from datetime import datetime
from pathlib import Path

# ---------------------------------------------------------------- 补丁表
# 键 = 条目 id；值 = {字段: 新值}
# 原则：syn 放简短近义词（不超过 ~12 字，可多个用「、」分隔）；
#       mean 放一句可独立读懂的释义。
PATCHES = {
    # syn/mean 整个颠倒：原 syn 是完整释义句、原 mean 才是近义词
    78: {
        'mean': '为不创造超额价值的资源（人、资本、业务）支付过高溢价的行为。',
        'syn': '为低效资产付溢价、为平庸支付溢价',
    },
    # mean 被串抄成「精准、精确、到位」，与本词义无关
    105: {
        'mean': '指判断的精准程度，以及所涉及的影响范围。',
        'syn': '精准度与影响面',
    },
    # mean 写成了使用场景说明（该内容属 scene 字段），不是释义
    124: {
        'mean': '引述他人观点时，形容其表述直击要害、一语中的。',
        'syn': '一语中的地指出、切中要害地指出',
    },
    # 与 id124 释义逐字相同，做差异化：本词侧重言辞锋利、不留情面
    125: {
        'mean': '引述他人观点时，形容其言辞锋利、不留情面地指出问题。',
        'syn': '尖锐指出、直言不讳地指出',
    },
    # mean 用自己的词解释自己（循环释义）
    133: {
        'mean': '形容话语简短，但直接命中问题本质。',
        'syn': '说到点子上、直击要害',
    },
    # syn 被串抄成「精准、精确、到位」，与本词义无关
    649: {
        'syn': '处在、位于、处于……状态',
    },
    669: {
        'syn': '精雕细琢、精准施策',
    },
}


def load_vocab(raw: str):
    m = re.search(r'window\.VOCAB=(\[.*?\]);', raw, re.S)
    if not m:
        raise SystemExit('未找到 window.VOCAB 段')
    return json.loads(m.group(1))


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument('--src', default='data.js', help='词库文件路径')
    ap.add_argument('--apply', action='store_true', help='实际落盘（默认只干跑）')
    a = ap.parse_args()

    src = Path(a.src)
    raw = src.read_bytes().decode('utf-8')
    vocab = load_vocab(raw)

    by_id = {x['id']: x for x in vocab}
    changed = 0
    for i, patch in PATCHES.items():
        if i not in by_id:
            print(f'!! id{i} 不存在，跳过')
            continue
        e = by_id[i]
        diff = [(k, e.get(k, ''), v) for k, v in patch.items() if e.get(k, '') != v]
        if not diff:
            continue
        changed += 1
        print(f'id{i} {e["word"]}  [{e["cat"]}]')
        for k, old, new in diff:
            print(f'    {k}: {old or "（空）"}')
            print(f'     → {new}')
            e[k] = new
        print()

    print(f'共 {changed} 条待修正')
    if not a.apply:
        print('（干跑，未落盘。加 --apply 执行）')
        return 0

    if changed == 0:
        print('无改动，跳过落盘')
        return 0

    bak_dir = src.parent / 'build' / 'backup'
    bak_dir.mkdir(parents=True, exist_ok=True)
    bak = bak_dir / f'data_prefields_{datetime.now():%Y%m%d_%H%M%S}.js'
    shutil.copy2(src, bak)
    print(f'已备份 → {bak}')

    stamp = datetime.now().isoformat()
    body = json.dumps(vocab, ensure_ascii=False, separators=(',', ':'))
    cats = re.search(r'window\.CATEGORIES=(\[.*?\]);', raw, re.S).group(1)
    out = f'/* build: {stamp} */\r\nwindow.VOCAB={body};\r\nwindow.CATEGORIES={cats};\r\n'
    src.write_bytes(out.encode('utf-8'))
    print(f'已落盘 → {src}')
    return 0


if __name__ == '__main__':
    sys.exit(main())
