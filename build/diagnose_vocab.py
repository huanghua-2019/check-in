#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
词库体检脚本（结构化词库通用，默认面向 check-in / data.js）

用途：在动手清洗或补缺之前，先出一份**可复核的诊断报告**，把"感觉重复太多""感觉覆盖不够"
这类直觉翻译成数字。对应问题：① 类似词汇太多  ② 涵盖范围不够广。

用法：
  python diagnose_vocab.py --src data.js
  python diagnose_vocab.py --src data.js --domains domains.txt   # 自定义缺口词表

缺口词表格式（每行一组，制表符或冒号分隔）：
  投资交易法务: 对赌,回购权,优先清算,领售权,反稀释
  估值与财务:   ROIC,自由现金流,机会成本

输出分五段：规模与分布 / 重复与冗余 / 结构病 / 覆盖缺口 / 分类树冲突
"""
import argparse
import json
import re
import sys
from collections import Counter, defaultdict
from pathlib import Path

# 默认缺口词表（按用户主战场定制：股权投资 + 二级市场 + 法务审核）
DEFAULT_DOMAINS = {
    '投资交易法务': ['对赌', '回购权', '优先清算', '领售权', '反稀释', '竞业限制', '违约金',
                     '尽职调查', '交割', '对价', '增资', '股转', '章程', '仲裁', '管辖权',
                     '陈述与保证', '锁定期', '业绩补偿', '同业竞争'],
    '估值与财务': ['ROIC', '投入资本回报率', '自由现金流', '机会成本', '沉没成本', '商誉减值',
                   '应收账款', '存货周转', '折现率', '风险溢价', '股息率', '分红率', '派息',
                   '可转债', '定增', '定向增发', '股权质押', '关联交易', '资本开支', '营运资本',
                   '资产负债率', '毛利率', '净利率', '周转率'],
    '宏观与周期': ['通胀', '通缩', '利率', '汇率', '流动性', '加息', '降息', '财政政策',
                   '货币政策', '信贷', '顺周期', '逆周期', '滞胀'],
    '逻辑与论证': ['归谬', '反证', '类比', '层递', '论据', '反驳', '幸存者偏差',
                   '相关不等于因果', '以偏概全', '双标', '反例', '前提假设'],
    '职场与管理': ['对齐', '闭环', '归口', '卡点', '向上管理', '预期管理', '人才梯队',
                   '人效', '搭班子'],
    '组织与文化': ['组织架构', '人才密度', '激励机制', '合伙人', '股权激励', '职业经理人', '传承'],
    '品牌与消费': ['复购', '渗透率', '客单价', '动销', '渠道库存', '尝鲜', '市占率'],
    '投资心态': ['知足', '侥幸', '自负', '羊群效应', '独立判断', '不作为'],
}

# 句式/长句特征（用于识别"句子混进词库"）
EUPH = re.compile(r'（现在叫[:：]')          # 「XX（现在叫：YY）」是网络新词，合法
SENT_MARK = re.compile(r'…|^“|^‘|XX|YY|[\u4e00-\u9fa5]A[，,]')
# emoji 主区（刻意不含 U+FE0F 变体选择符，否则 ✍️ / ⚖️ 这类会被数成 2 个）
EMOJI_RE = re.compile('[\U0001F300-\U0001FAFF\u2600-\u27BF\u2B00-\u2BFF]')


def load(path: Path):
    raw = path.read_text(encoding='utf-8')
    vocab = json.loads(re.search(r'window\.VOCAB=(\[.*?\]);', raw, re.S).group(1))
    m = re.search(r'window\.CATEGORIES=(\[.*?\]);', raw, re.S)
    cats = json.loads(m.group(1)) if m else []
    return vocab, cats


def toks(entry):
    """取条目的释义词元（syn + mean 按标点切分）。"""
    s = (entry.get('syn') or '') + '、' + (entry.get('mean') or '')
    return {t.strip() for t in re.split(r'[、,，/／;；\s]+', s) if t.strip()}


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--src', default='data.js')
    ap.add_argument('--domains', default=None, help='自定义缺口词表文件')
    a = ap.parse_args()

    vocab, cats = load(Path(a.src))
    n = len(vocab)

    # ---------- 1. 规模与分布 ----------
    print('=' * 78)
    print(f'词库规模：{n} 条 / {len(cats)} 分类')
    print('=' * 78)
    tab = Counter(x.get('tab') or '(无)' for x in vocab)
    print('tab 分布：' + '  '.join(f'{k}={v}' for k, v in tab.most_common()))
    print()
    cc = Counter(x['cat'] for x in vocab)
    print('分类分布（前 20）：')
    for k, v in cc.most_common(20):
        print(f'  {v:5d}  {k}')
    top2 = sum(v for _, v in cc.most_common(2))
    print(f'  → 前两大分类合计占 {top2 / n * 100:.0f}%（>25% 说明分类粒度过粗或某类在吞并一切）')

    # ---------- 2. 重复与冗余 ----------
    print()
    print('=' * 78)
    print('问题一：类似词汇太多')
    print('=' * 78)
    wc = Counter(x['word'] for x in vocab)
    dup = [(k, v) for k, v in wc.items() if v > 1]
    print(f'完全不同 word    : {len(dup)} 个 / 冗余 {sum(v - 1 for _, v in dup)} 条'
          f'（{sum(v - 1 for _, v in dup) / n * 100:.1f}%）')
    for k, v in sorted(dup, key=lambda t: -t[1])[:20]:
        cs = sorted({x['cat'] for x in vocab if x['word'] == k})
        print(f'   x{v}  {k}   {cs}')

    w2c = defaultdict(set)
    for x in vocab:
        w2c[x['word']].add(x['cat'])
    cross = {k: v for k, v in w2c.items() if len(v) > 1}
    print(f'同一词跨多个分类 : {len(cross)} 个')
    for k, v in list(cross.items())[:10]:
        print(f'   {k} → {sorted(v)}')

    v = [x for x in vocab if x.get('tab') == 'vocab']
    pairs = []
    for i in range(len(v)):
        for j in range(i + 1, len(v)):
            A, B = toks(v[i]), toks(v[j])
            if A and B:
                inter = A & B
                if len(inter) >= 2 and len(inter) / min(len(A), len(B)) >= 0.5:
                    pairs.append((len(inter), v[i]['word'], v[j]['word'], '、'.join(sorted(inter))))
    pairs.sort(reverse=True)
    print(f'释义高度重合词对 : {len(pairs)} 对（同义冗余的主要来源）')
    for k, x, y, it in pairs[:10]:
        print(f'   [{k}] {x} ~ {y}   ← 共有释义：{it}')

    ws = sorted({x['word'] for x in v})
    sub = [(x, y) for x in ws for y in ws if x != y and len(x) >= 2 and x in y]
    print(f'互为子串         : {len(sub)} 对（碎片条目与整条目并存）')
    for x, y in sub[:8]:
        print(f'   {x} ⊂ {y}')

    # ---------- 3. 结构病 ----------
    print()
    print('=' * 78)
    print('结构病')
    print('=' * 78)
    sent = [x for x in v if (x.get('tab') == 'vocab') and not EUPH.search(x['word'] or '')
            and SENT_MARK.search(x['word'] or '')]
    longv = [x for x in v if (x.get('tab') == 'vocab') and len(x.get('word') or '') >= 8]
    print(f'tab=vocab 但是整句/句式（高精度判定）: {len(sent)} 条 → 应归位到 tab=phr')
    for x in sent[:10]:
        print(f'   id{x["id"]} [{x["cat"]}] {x["word"][:44]}')
    print(f'tab=vocab 但 word>=8 字（需人工判定）: {len(longv)} 条')
    odd = [c for c in cc if len(EMOJI_RE.findall(c)) >= 2]
    print(f'疑似畸形分类名（同一名里堆了 ≥2 个 emoji，多为合并残留）: {odd}')
    print()
    empty = [c for c in cats if not any(x['cat'] == c for x in vocab)]
    print(f'CATEGORIES 里的空分类: {len(empty)}  {empty}')
    out = sorted({x['cat'] for x in vocab} - set(cats))
    print(f'VOCAB 有但 CATEGORIES 缺的分类: {out}')

    # ---------- 4. 覆盖缺口 ----------
    print()
    print('=' * 78)
    print('问题二：涵盖范围不够广')
    print('=' * 78)
    domains = DEFAULT_DOMAINS
    if a.domains:
        domains = {}
        for line in Path(a.domains).read_text(encoding='utf-8').splitlines():
            if not line.strip():
                continue
            parts = re.split(r'[:：]', line, maxsplit=1)
            if len(parts) < 2:
                continue
            domains[parts[0].strip()] = [w.strip() for w in re.split(r'[,，、\s]+', parts[1]) if w.strip()]
    allw = set(wc)
    blob = '\n'.join((x.get('word') or '') + '|' + (x.get('syn') or '') + '|' + (x.get('mean') or '')
                     + '|' + (x.get('scene') or '') for x in vocab)
    print(f'{"领域":<14}{"已有词条":>8}{"仅出现在释义":>12}{"完全缺失":>10}   缺失词')
    tot = 0
    for g, kws in domains.items():
        kws = list(dict.fromkeys(kws))
        have = [w for w in kws if w in allw]
        only_blob = [w for w in kws if w not in allw and w in blob]
        miss = [w for w in kws if w not in allw and w not in blob]
        tot += len(miss)
        print(f'{g:<14}{len(have):>8}{len(only_blob):>12}{len(miss):>10}   '
              + '、'.join(miss[:10]) + ('…' if len(miss) > 10 else ''))
    print(f'\n合计完全缺失候选词：{tot} 个')

    # ---------- 5. 分类树冲突 ----------
    print()
    print('=' * 78)
    print('分类树冲突（同主题多分类，边界打架）')
    print('=' * 78)
    groups = defaultdict(list)
    for c in cats:
        for kw in ['认知', '风险', '投资', '人性', '组织', '管理', '品牌', '消费', '宏观']:
            if kw in c:
                groups[kw].append(c)
    for kw, cs in groups.items():
        if len(cs) > 1:
            print(f'  「{kw}」相关分类 {len(cs)} 个：' + ' | '.join(f'{c}({cc[c]})' for c in cs))

    print()
    print('=' * 78)
    print('提示：口径先定，再动手。清洗前务必备份并提交 git，id 是打卡进度主键，绝不重编号。')
    print('=' * 78)
    return 0


if __name__ == '__main__':
    sys.exit(main())
