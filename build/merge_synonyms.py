#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
词库同义碎片合并：短词与长词语义相同（同词干）时，删短留长。

用法:
    python merge_synonyms.py --src data.js            # 干跑
    python merge_synonyms.py --src data.js --apply    # 落盘（自动备份）

判定原则（仅合并"同一个意思"的碎片）:
    合并 —— 短词 = 长词去掉修饰/功能成分（的、起、是、过、上…），语义完全相同。
    不合并 —— 反义（具备/不具备）、包含但不同义（利率/净利率）、巧合子串（其一/终其一生）、
              加了限定而语义有别（青睐/青睐有加；水位/水位（估值））。

MERGES 表: {保留的 id: {'drop': [删除的 id], 'set': {字段: 新值}}}
    - 保留条目的名字若为「XX/YY」「XX、YY」这类畸形合名，取规范的一方为准。
    - 被删条目的有效信息（如独特释义）并入保留条目，不丢信息。
"""
import argparse
import json
import re
import shutil
import sys
from datetime import datetime
from pathlib import Path

MERGES = {
    # ① 一针见血 / 一针见血的指出
    124: {'drop': [133], 'set': {}},
    # ② 犀利指出 / 犀利的指出（归一化后完全同形）
    135: {
        'drop': [125],
        'set': {
            'syn': '尖锐指出、直言不讳地指出',
            'mean': '引述他人观点时，形容其言辞锋利、不留情面地指出问题。',
        },
    },
    # ③ 实则 / 实则是
    312: {
        'drop': [365],
        'set': {
            'syn': '实则、其实、实际上',
            'mean': '用来揭示表象之下的真实情况，语气比"其实"更书面。',
        },
    },
    # ④ 实际 / 实际上
    469: {
        'drop': [308],
        'set': {
            'syn': '实质上、其实',
            'mean': '强调真实情况与表象不同，用于纠正或补充判断。',
        },
    },
    # ⑤ 恰是 / 恰恰是
    89: {'drop': [199], 'set': {}},
    # ⑥ 提及 / 曾提及
    62: {
        'drop': [331],
        'set': {
            'syn': '之前提到过、说过',
            'mean': '表示此前曾提到过某事，用于回溯或呼应前文。',
        },
    },
    # ⑦ 构建 / 构建起
    483: {
        'drop': [496],
        'set': {
            'syn': '构建、建立、打造',
            'mean': '用于描述系统性、结构性地创建壁垒或积累优势的过程。',
        },
    },
    # ⑧ 某种程度 / 某种程度上
    318: {
        'drop': [317],
        'set': {
            'syn': '一定程度上、在某种程度上',
            'mean': '用于严谨地限定判断的范围和程度，是《晚点》常用的缓和语气词。',
        },
    },
    # ⑨ 用于 / 应用于
    221: {
        'drop': [435],
        'set': {
            'syn': '用于、用在、运用到',
            'mean': '表示把某方法、技术或资源投入使用。',
        },
    },
    # ⑩ 设定 / 设定过
    384: {
        'drop': [481],
        'set': {
            'syn': '设定过、定过',
            'mean': '表示此前已经设定过某项标准或参数。',
        },
    },
    # ⑪ 核心标尺 / 终极标尺 / 终极标尺-核心标尺（三合一，保规范名）
    583: {
        'drop': [580, 579],
        'set': {
            'syn': '核心标准、终极标尺',
            'mean': '衡量事物本质与价值的核心标准；在估值语境中，终极标尺是未来现金流折现（DCF）。',
        },
    },
    # ⑫ 洞察 / 洞察-洞见（保规范名，信息取最全）
    5: {
        'drop': [95],
        'set': {
            'syn': '洞见、看透本质',
            'mean': '对事物本质与底层逻辑的深刻认识；既指这种认知能力，也指由此得出的有深度的见解。',
        },
    },
    # ⑬ 缺乏 / 缺少 / 缺少-缺乏（三合一，保规范名）
    374: {
        'drop': [141, 173],
        'set': {
            'syn': '缺少、缺',
            'mean': '表示没有或不够，比"不具备"更简洁，多用于抽象事物。',
        },
    },
}


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument('--src', default='data.js')
    ap.add_argument('--apply', action='store_true')
    a = ap.parse_args()

    src = Path(a.src)
    raw = src.read_bytes().decode('utf-8')
    vocab = json.loads(re.search(r'window\.VOCAB=(\[.*?\]);', raw, re.S).group(1))
    by_id = {x['id']: x for x in vocab}

    drop_all = []
    for keep, spec in MERGES.items():
        if keep not in by_id:
            print(f'!! 保留 id{keep} 不存在，整组跳过')
            continue
        k = by_id[keep]
        names = []
        for d in spec['drop']:
            if d in by_id:
                names.append(f'{by_id[d]["word"]}(id{d})')
                drop_all.append(d)
        if spec.get('set'):
            for f, v in spec['set'].items():
                if k.get(f) != v:
                    k[f] = v
        print(f'保留 {k["word"]}(id{keep})  ←  删 {", ".join(names)}')

    drop_all = [i for i in drop_all if i in by_id]
    print()
    print(f'合并 {len(MERGES)} 组，删除 {len(drop_all)} 条：{len(vocab)} → {len(vocab)-len(drop_all)}')

    if not a.apply:
        print('（干跑，未落盘。加 --apply 执行）')
        return 0

    if not drop_all:
        print('无改动')
        return 0

    bak_dir = src.parent / 'build' / 'backup'
    bak_dir.mkdir(parents=True, exist_ok=True)
    bak = bak_dir / f'data_premerge_{datetime.now():%Y%m%d_%H%M%S}.js'
    shutil.copy2(src, bak)
    print(f'已备份 → {bak}')

    drop_set = set(drop_all)
    new = [x for x in vocab if x['id'] not in drop_set]

    stamp = datetime.now().isoformat()
    body = json.dumps(new, ensure_ascii=False, separators=(',', ':'))
    cats = re.search(r'window\.CATEGORIES=(\[.*?\]);', raw, re.S).group(1)
    out = f'/* build: {stamp} */\r\nwindow.VOCAB={body};\r\nwindow.CATEGORIES={cats};\r\n'
    src.write_bytes(out.encode('utf-8'))
    print(f'已落盘 → {src}')
    return 0


if __name__ == '__main__':
    sys.exit(main())
