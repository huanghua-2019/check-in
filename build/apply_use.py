# -*- coding: utf-8 -*-
"""
为词库新增两个维度，替代/补充原有 45 个混乱分类：

  use  —— 写作用途，17 类，跨 7 个 tab 统一（"我要下结论" → 🎯 立论判断）
  tier —— 内容分级：核心（写作骨架）/ 进阶（常用内容）/ 备用（素材与娱乐）

原 cat 字段保留在数据里作留档，前端不再展示。
同时写入 window.CATEGORIES（= USES，供前端分组）与 window.TOPICS（预设主题包）。

用法：
  python apply_use.py --src data.js            # 干跑，只看统计
  python apply_use.py --src data.js --apply    # 落盘（自动备份）
"""
import argparse, datetime, json, os, re, shutil, sys

USES = [
    '🎯 立论判断', '🔗 论证推理', '⚖️ 对比转折', '📊 举证说明', '💡 打比方',
    '🔍 洞察本质', '⚠️ 警示风险', '🏆 竞争格局', '👥 人性心理', '🏗️ 管理组织',
    '💰 投资决策', '🌿 人生修养', '🧩 用词精准', '📐 概念指代', '🖋️ 描写刻画',
    '✍️ 写作技法', '😂 幽默调侃',
]

# 45 个旧分类 → 新用途（每项 1~2 个）
CAT2USE = {
    # ---- 词汇/句式侧：语言功能类（数字编号） ----
    '01-观点与论述': ['🎯 立论判断'],
    '02-逻辑关系': ['🔗 论证推理'],
    '03-程度与属性': ['🧩 用词精准'],
    '04-行为与动作': ['🧩 用词精准'],
    '05-事物与指代': ['📐 概念指代'],
    '06-概念与术语': ['📐 概念指代'],
    '07A-素材与描写·人物与群体': ['🖋️ 描写刻画'],
    '07B-素材与描写·事物与状态': ['🖋️ 描写刻画'],
    '07C-素材与描写·时空与环境': ['🖋️ 描写刻画'],
    '07D-素材与描写·动作与行为': ['🖋️ 描写刻画'],
    # ---- 句式模板类 ----
    '✍️ 表达句式与模板': ['✍️ 写作技法'],
    '💼 商务写作句式模板': ['✍️ 写作技法'],
    # ---- 金句/比喻侧：主题类 ----
    '🧠 认知与思维': ['🔍 洞察本质'],
    '🧠 人性与认知': ['👥 人性心理'],
    '🔮 规律与真相': ['🔍 洞察本质'],
    '🔄 变化与趋势': ['🔍 洞察本质'],
    '⚠️ 风险与警示': ['⚠️ 警示风险'],
    '⚔️ 竞争与生存': ['🏆 竞争格局'],
    '🏗️ 组织与管理': ['🏗️ 管理组织'],
    '🏢 管理与领导力': ['🏗️ 管理组织'],
    '💼 商业判断': ['🏆 竞争格局'],
    '🛒 品牌与消费': ['🏆 竞争格局'],
    '👥 人性与关系': ['👥 人性心理'],
    '🌿 人生感悟': ['🌿 人生修养'],
    '📈 投资理念': ['💰 投资决策'],
    '💵 估值与财务': ['💰 投资决策'],
    '💰 估值与财务': ['💰 投资决策'],
    '⚖️ 投资交易与法务': ['💰 投资决策'],
    '🧘 投资心态': ['💰 投资决策'],
    '🌐 宏观与周期': ['💰 投资决策'],
    # ---- 句式技巧类（emoji 版，phr 用） ----
    '⚖️ 判断断言类': ['🎯 立论判断'],
    '🔍 逻辑与论证': ['🔗 论证推理'],
    '🔄 对比揭示类': ['⚖️ 对比转折'],
    '📋 列举论证类': ['📊 举证说明'],
    '📊 因果分析类': ['🔗 论证推理'],
    '📈 数据论证类': ['📊 举证说明'],
    '🚀 文章开篇类': ['✍️ 写作技法'],
    '🎯 设问与反问类': ['✍️ 写作技法'],
    '✨ 排比与金句类': ['✍️ 写作技法'],
    '📖 写作基础知识': ['✍️ 写作技法'],
    # ---- 案例/幽默 ----
    '📒 案例库': ['📊 举证说明'],
    '😂 自嘲与玩梗': ['😂 幽默调侃'],
    '😏 讽刺与调侃': ['😂 幽默调侃'],
    '😅 反转与荒诞': ['😂 幽默调侃'],
    '🔫 段子与网络梗': ['😂 幽默调侃'],
    '📌 其他幽默': ['😂 幽默调侃'],
}
# cases 的分类是 "📒 0X 标题" 形式，前缀统一归并
for _c in list(CAT2USE):
    if _c.startswith('📒'):
        pass

TIER_CORE_CATS = {'01-观点与论述', '02-逻辑关系', '03-程度与属性'}
TIER_ADV_CATS = {'04-行为与动作', '05-事物与指代', '06-概念与术语'}
TIER_ADV_USES = {'💰 投资决策', '🏆 竞争格局', '⚠️ 警示风险', '🔍 洞察本质', '⚖️ 对比转折', '📊 举证说明', '🎯 立论判断'}
TIER_SPARE_TABS = {'humor'}

TOPICS = [
    {"name": "护城河与竞争优势", "icon": "🏰",
     "keys": ["护城河", "壁垒", "竞争优势", "定价权", "议价", "差异化", "不可替代", "领先"]},
    {"name": "估值与安全边际", "icon": "💰",
     "keys": ["估值", "安全边际", "折现", "市盈", "内在价值", "高估", "低估", "赔率", "便宜", "价格"]},
    {"name": "能力圈与认知", "icon": "🧭",
     "keys": ["能力圈", "认知", "思维模型", "第一性原理", "偏见", "误区", "盲区", "常识", "误解"]},
    {"name": "风险与失败", "icon": "⚠️",
     "keys": ["风险", "失败", "教训", "杠杆", "亏损", "陷阱", "黑天鹅", "尾部", "崩溃", "危险"]},
    {"name": "周期与宏观", "icon": "🌀",
     "keys": ["周期", "宏观", "利率", "通胀", "流动性", "财政", "货币", "衰退", "泡沫", "信用"]},
    {"name": "竞争与格局", "icon": "🏆",
     "keys": ["竞争", "格局", "份额", "龙头", "颠覆", "替代", "洗牌", "价格战", "赛道", "市占"]},
    {"name": "管理与文化", "icon": "🏗️",
     "keys": ["管理", "文化", "组织", "团队", "人才", "激励", "领导", "授权", "创始人", "用人"]},
    {"name": "现金流与财务", "icon": "💵",
     "keys": ["现金流", "利润", "毛利", "周转", "负债", "资本开支", "ROE", "ROIC", "分红", "财报"]},
    {"name": "心态与长期主义", "icon": "🌿",
     "keys": ["长期", "耐心", "复利", "心态", "情绪", "恐惧", "贪婪", "习惯", "坚持", "时间"]},
    {"name": "护人与识人", "icon": "👥",
     "keys": ["人性", "动机", "信任", "关系", "沟通", "说服", "信誉", "合作", "博弈"]},
    {"name": "写作与表达", "icon": "✍️",
     "keys": ["写作", "表达", "句式", "论证", "开头", "结尾", "逻辑", "修辞", "破折号", "措辞"]},
]


def cat2use(cat):
    if cat in CAT2USE:
        return list(CAT2USE[cat])
    # cases 的分类形如 "📒 01 xxx"
    if cat.startswith('📒'):
        return ['📊 举证说明']
    # 兜底：按 emoji 粗判
    for k, v in CAT2USE.items():
        if k and cat.startswith(k.split()[0]):
            return list(v)
    return ['🔍 洞察本质']


def tier_of(entry):
    tab, cat, uses = entry.get('tab', ''), entry.get('cat', ''), entry['use']
    if tab in ('phr', 'rule'):
        return '核心'
    if tab == 'vocab':
        if cat in TIER_CORE_CATS:
            return '核心'
        if cat in TIER_ADV_CATS:
            return '进阶'
        # vocab 里带题材分类的（投资/组织/品牌/宏观等）
        if any(u in TIER_ADV_USES for u in uses):
            return '进阶'
        return '备用'
    if tab in TIER_SPARE_TABS:
        return '备用'
    if any(u in TIER_ADV_USES for u in uses):
        return '进阶'
    return '备用'


def parse(src):
    raw = open(src, encoding='utf-8').read()
    mv = re.search(r'window\.VOCAB=(\[.*?\]);\s*$', raw, re.S | re.M)
    vocab = json.loads(mv.group(1))
    return vocab


def build(src, apply=False):
    vocab = parse(src)
    unmapped = {}
    for e in vocab:
        u = cat2use(e.get('cat', ''))
        e['use'] = u
        e['tier'] = tier_of(e)
        if e.get('cat', '') not in CAT2USE and not str(e.get('cat', '')).startswith('📒'):
            unmapped[e['cat']] = unmapped.get(e['cat'], 0) + 1

    # ---- 统计 ----
    from collections import Counter
    print('总条数:', len(vocab))
    print('\n--- use 分布 ---')
    for k, n in Counter(u for e in vocab for u in e['use']).most_common():
        print(f'  {n:>5}  {k}')
    print('\n--- tier 分布 ---')
    for k, n in Counter(e['tier'] for e in vocab).most_common():
        print(f'  {n:>5}  {k}')
    print('\n--- tier × tab ---')
    tt = Counter((e['tier'], e['tab']) for e in vocab)
    for (t, tab), n in sorted(tt.items()):
        print(f'  {t}  {tab:<6} {n}')
    if unmapped:
        print('\n!!! 未映射的分类:')
        for k, n in unmapped.items():
            print(f'  {n:>5}  {k!r}')
        if apply:
            print('存在未映射分类，拒绝落盘。')
            return
    if not apply:
        print('\n[干跑] 未落盘。加 --apply 生效。')
        return

    # ---- 落盘 ----
    os.makedirs('build/backup', exist_ok=True)
    stamp = datetime.datetime.now().strftime('%Y%m%d-%H%M%S')
    shutil.copy(src, f'build/backup/data.js.{stamp}.bak')

    order = ['id', 'tab', 'tier', 'use', 'cat', 'word', 'syn', 'mean', 'example', 'scene']
    out = []
    for e in vocab:
        out.append({k: e[k] for k in order if k in e})
    lines = [
        '/* build: %s */' % datetime.datetime.now().isoformat(),
        'window.VOCAB=' + json.dumps(out, ensure_ascii=False, separators=(',', ':')) + ';',
        'window.CATEGORIES=' + json.dumps(USES, ensure_ascii=False, separators=(',', ':')) + ';',
        'window.TOPICS=' + json.dumps(TOPICS, ensure_ascii=False, separators=(',', ':')) + ';',
    ]
    with open(src, 'w', encoding='utf-8', newline='\r\n') as f:
        f.write('\n'.join(lines) + '\n')
    print(f'\n已写入 {src}（备份 build/backup/data.js.{stamp}.bak）')


if __name__ == '__main__':
    ap = argparse.ArgumentParser()
    ap.add_argument('--src', default='data.js')
    ap.add_argument('--apply', action='store_true')
    a = ap.parse_args()
    build(a.src, a.apply)
