#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""抽查问题修复：删除同源重复 + 修正 mean 同义反复 / syn 张冠李戴 / mean 误读。

依据：3 份抽查报告（build/issues_q.json / issues_m.json / issues_mx.json）+ 逐条人工复核。

删除（同源重复，删劣留优）：
  1380 ← 1244（芒格"不能永远持续的事终将停止"，1244 的 example 是原话）
  1524 ← 1519（后视镜 vs 挡风玻璃，1519 example 更完整）
  1555 ← 1551（巴菲特"听话的吉娃娃 vs 大丹犬"，同源）
  1619 ← 1602（杰克·班尼得奖感言，同源）
  1631 ← 1617（"猎象之枪弹药上膛"，1617 是巴菲特原话）
  1577 ← 1653（"清华扩招和你有关系吗"，跨 tab 重复；该句是讽刺不是比喻，归属 humor 更准）

用法：python fix_review.py --src data.js [--apply]
"""
import argparse, json, re, shutil
from datetime import datetime
from pathlib import Path

DELETE_IDS = [1380, 1524, 1555, 1619, 1631, 1577]

PATCHES = {
    # --- quote：mean 同义反复（word 已是完整陈述，mean 只换词复述）---
    '1230': {'mean': '在把事情做对的过程中，出错是固有的一部分，追求零失误并不现实，真正可控的只是把出错频率压低。'},
    '1244': {'mean': '任何趋势都有其边界，不能假定它会无限延续；判断时要追问“这能撑多久”，而不是默认它一直下去。'},
    '1250': {'mean': '麻烦一旦上身，脱身的代价远高于事先避开，所以策略的重点在预防，而非事后补救。'},
    '1363': {'mean': '事物按其自身逻辑发生，不理会人的期待与一厢情愿；承认这一点，才是尊重事实的起点。'},
    '1364': {'mean': '结果由行为决定，同一套做法反复投入只会得到同一个结果；结果不如意时，先检查自己的做法有没有变。'},
    # --- quote：syn 张冠李戴 ---
    '1315': {'syn': '嘴上说不要身体很诚实、说的和做的相反、承诺与行为相悖'},
    # --- met：syn 张冠李戴（硬套看着相关的成语，方向或侧重走偏）---
    '1495': {'syn': '理想很丰满现实很骨感、壮志难酬、梦想败给现实'},
    '1456': {'syn': '前车之鉴、引以为戒、不必亲自踩坑'},
    '1470': {'syn': '猜风向发不了财、跟随他人观点赚不到钱、别人的分析代替不了自己的判断'},
    '1477': {'syn': '把金矿位置公布于众、毫无保留地分享、好消息与众人共享'},
    '1519': {'syn': '后视镜比挡风玻璃清楚、用过去推未来、以历史经验预判未来'},
    '1545': {'syn': '竹篮打水一场空、白忙一场、力气花在没用的地方'},
    '1388': {'syn': '用豌豆枪打大象、杯水车薪、拿小锤敲大钟'},
    '1420': {'syn': '猴子掰玉米掰一个丢一个、三天打鱼两天晒网、半途而废难成事'},
    # --- met：mean 误读原文 ---
    '1506': {'mean': '对股市预测的反讽：预测家毫无准确性可言，其唯一价值是反衬出算命先生还算靠谱。'},
    # --- humor：mean 与原话不符 ---
    '1667': {'mean': '反转式荒诞：一场冲突下来双方都在哭，谁也没赢，狼狈得如出一辙。'},
}


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

    print('=== 待删同源重复 ===')
    for i in DELETE_IDS:
        x = by_id.get(i)
        print(f'  [{i}] ' + (f'{x["word"][:42]}' if x else '!! 不存在'))

    print('\n=== 字段修正 ===')
    for k, patch in PATCHES.items():
        x = by_id.get(int(k))
        if x is None:
            print(f'  !! id {k} 不存在'); continue
        for f, v in patch.items():
            old = str(x.get(f, ''))
            print(f'  [{k}] {x["word"][:16]:<18} {f}:')
            print(f'        旧 {old[:64]}')
            print(f'        新 {v[:64]}')
            x[f] = v

    vocab = [x for x in vocab if x['id'] not in DELETE_IDS]
    print(f'\n=== 删除 {len(DELETE_IDS)} 条 → 剩 {len(vocab)} 条 ===')

    # 复核：删掉的 id 里，是否有被保留条目的 syn 引用到（避免同义指向已删词）
    print('=== 复核 ===')
    print(f'  id 唯一: {len({x["id"] for x in vocab}) == len(vocab)}')
    blank = sum(1 for x in vocab if any(not str(x.get(f, '') or '').strip()
                                       for f in ('syn', 'mean', 'example', 'scene')))
    print(f'  有空字段: {blank}')

    if not a.apply:
        print('\n（干跑，未落盘。加 --apply 执行）')
        return

    bak = build / 'backup' / f'data_prereview_{datetime.now():%Y%m%d_%H%M%S}.js'
    bak.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy2(src, bak)
    print(f'已备份 → {bak}')

    head = re.sub(r'/\* build: .*? \*/', f'/* build: {datetime.now().isoformat()} */',
                  text[:mv.start()], count=1)
    new_vocab = json.dumps(vocab, ensure_ascii=False, separators=(',', ':'))
    src.write_bytes((head + 'window.VOCAB=' + new_vocab + ';' + text[mv.end():]).encode('utf-8'))

    rb = src.read_bytes()
    rv = json.loads(re.search(r'window\.VOCAB=(\[.*?\]);', rb.decode('utf-8'), re.S).group(1))
    print('=== 落盘校验 ===')
    print(f'  条数: {before} → {len(rv)}    id 唯一: {len({x["id"] for x in rv}) == len(rv)}')
    print(f'  CRLF: {rb.count(b"\r\n")}  裸LF: {rb.count(b"\n") - rb.count(b"\r\n")}')


if __name__ == '__main__':
    main()
