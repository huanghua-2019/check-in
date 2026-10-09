#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""语义去冗：删除真重复条目 + 修正字段串写。

判定依据（逐条人工核过，见 memory/2026-10-09）：
  真重复 → 删劣留优
    177 换言之        ≡ 269 换而言之（"换言之"并入 269 的 syn）
    258 但            ≡ 257 但是（"不过"并入 257 的 syn）
    1209 产品研发      ⊂ 1191 描述以数据驱动的产品研发逻辑（1209 的 example 是半截短语）
    1202 极小概率风险   ⊂ 1183 界定极小概率的风险事件（半截）
    1206 研发迭代      ⊂ 1188 描述研发体系的动态迭代能力（半截）
  保留（非重复）
    585/586 生产性资产 / 非生产性资产 → 反义，两条都要
  修字段（非重复但 syn/mean 串写）
    443 其一 / 444 其二 → syn 都误写成"第一、一是、一来"，且 mean 串了"其一/其二"
    121 说过 / 122 提到 → mean 完全相同，需差异化

用法：python fix_dupes.py --src data.js [--apply]
"""
import argparse, json, re, shutil
from datetime import datetime
from pathlib import Path

DELETE_IDS = [177, 258, 1209, 1202, 1206]

PATCHES = {
    '269': {'syn': '换句话说、换言之、也就是说'},
    '257': {'syn': '不过、可是、然而'},
    '443': {'syn': '第一、一是、一则',
            'mean': '用于列举第一项理由或方面，属正式书面语，常与“其二”配套使用。'},
    '444': {'syn': '第二、二是、二则',
            'mean': '用于列举第二项理由或方面，与“其一”配套，属正式书面语。'},
    '121': {'syn': '说过、讲过、曾表示',
            'mean': '表示某人过去曾经讲过某句话，强调“曾经说过”，语气随意，多用于引述非核心言论。'},
    '122': {'syn': '提到、说起、谈及',
            'mean': '表示在某处谈及某个话题或事项，不强调是否复述原话，语气中性。'},
}
FIELDS = ['syn', 'mean', 'example', 'scene']


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--src', required=True)
    ap.add_argument('--apply', action='store_true')
    a = ap.parse_args()

    src = Path(a.src)
    build = src.parent / 'build'
    text = src.read_bytes().decode('utf-8')

    mv = re.search(r'window\.VOCAB=(\[.*?\]);', text, re.S)
    vocab = json.loads(mv.group(1))
    before = len(vocab)
    by_id = {x['id']: x for x in vocab}

    # ---- 1. 确认待删条目 ----
    print('=== 待删条目核对 ===')
    for i in DELETE_IDS:
        x = by_id.get(i)
        print(f'  [{i}] ' + (f'{x["tab"]} / {x["cat"]} / {x["word"][:34]}' if x else '!! 不存在'))

    # ---- 2. 修字段 ----
    print('\n=== 字段修正 ===')
    for k, patch in PATCHES.items():
        x = by_id.get(int(k))
        if x is None:
            print(f'  !! id {k} 不存在')
            continue
        changes = []
        for f, v in patch.items():
            old = str(x.get(f, ''))
            if old == v:
                continue
            changes.append(f'{f}: 「{old[:26]}」→「{v[:26]}」')
            x[f] = v
        print(f'  [{k}] {x["word"][:20]}  ' + ('; '.join(changes) if changes else '无变化'))

    # ---- 3. 删条目 ----
    removed = [x for x in vocab if x['id'] in DELETE_IDS]
    vocab = [x for x in vocab if x['id'] not in DELETE_IDS]
    print(f'\n=== 删除 {len(removed)} 条 → 剩 {len(vocab)} 条 ===')

    # ---- 4. 复核 ----
    print('=== 复核 ===')
    print(f'  id 唯一: {len({x["id"] for x in vocab}) == len(vocab)}')
    print(f'  被删 id 已消失: {not any(x["id"] in DELETE_IDS for x in vocab)}')
    blank = sum(1 for x in vocab if any(
        not str(x.get(f, '') or '').strip() for f in ('syn', 'mean', 'example', 'scene')))
    print(f'  有空字段的条目: {blank}')

    if not a.apply:
        print('\n（干跑，未落盘。加 --apply 执行）')
        return

    bak_dir = build / 'backup'
    bak_dir.mkdir(parents=True, exist_ok=True)
    bak = bak_dir / f'data_prededupe_{datetime.now():%Y%m%d_%H%M%S}.js'
    shutil.copy2(src, bak)
    print(f'已备份 → {bak}')

    stamp = datetime.now().isoformat()
    head = re.sub(r'/\* build: .*? \*/', f'/* build: {stamp} */', text[:mv.start()], count=1)
    new_vocab = json.dumps(vocab, ensure_ascii=False, separators=(',', ':'))
    src.write_bytes((head + 'window.VOCAB=' + new_vocab + ';' + text[mv.end():]).encode('utf-8'))

    rb = src.read_bytes()
    rs = rb.decode('utf-8')
    rv = json.loads(re.search(r'window\.VOCAB=(\[.*?\]);', rs, re.S).group(1))
    print('=== 落盘校验 ===')
    print(f'  条数: {before} → {len(rv)}')
    print(f'  id 唯一: {len({x["id"] for x in rv}) == len(rv)}')
    print(f'  CRLF: {rb.count(b"\r\n")}  裸LF: {rb.count(b"\n") - rb.count(b"\r\n")}')


if __name__ == '__main__':
    main()
