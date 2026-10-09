# -*- coding: utf-8 -*-
"""
合并 word 归位补丁 + 追加近义辨析卡。

  build/wordpatch/{q1,q2,m1,m2,m3,x}.json  —— word/use/mean 补丁
  build/wordpatch/{diff_a,diff_b}.json     —— 44 组辨析卡（追加为新条目，tab='diff'）

用法：
  python apply_word.py --src data.js           # 干跑
  python apply_word.py --src data.js --apply   # 落盘
"""
import argparse, datetime, json, os, re, shutil

WORD_SHARDS = ['q1', 'q2', 'm1', 'm2', 'm3', 'x']
DIFF_SHARDS = ['diff_a', 'diff_b']
DIFF_ID_START = 1826
DIFF_CAT = '🔍 近义辨析'


def main(src, apply):
    raw = open(src, encoding='utf-8').read()
    vocab = json.loads(re.search(r'window\.VOCAB=(\[.*?\]);', raw, re.S).group(1))
    cats = json.loads(re.search(r'window\.CATEGORIES=(\[.*?\]);', raw, re.S).group(1))
    topics = json.loads(re.search(r'window\.TOPICS=(\[.*?\]);', raw, re.S).group(1))
    by_id = {e['id']: e for e in vocab}

    # ---- 1. word 补丁 ----
    n_word = n_use = n_mean = 0
    changed = []
    for s in WORD_SHARDS:
        p = json.load(open(f'build/wordpatch/{s}.json', encoding='utf-8'))
        for k, v in p.items():
            e = by_id.get(int(k))
            if not e:
                print('!! 找不到 id', k)
                continue
            old = e['word']
            if 'word' in v:
                e['word'] = v['word']
                n_word += 1
                changed.append((e['id'], old, v['word']))
            if 'use' in v and v['use']:
                e['use'] = v['use']
                n_use += 1
            if 'mean' in v and v['mean'].strip():
                e['mean'] = v['mean']
                n_mean += 1

    # ---- 2. 辨析卡 ----
    diff = []
    nid = DIFF_ID_START
    for s in DIFF_SHARDS:
        arr = json.load(open(f'build/wordpatch/{s}.json', encoding='utf-8'))
        for c in arr:
            diff.append({
                'id': nid, 'tab': 'diff', 'tier': '核心', 'use': c['use'],
                'cat': DIFF_CAT, 'word': c['word'], 'syn': c['syn'],
                'mean': c['mean'], 'example': c['example'], 'scene': c['scene'],
            })
            nid += 1
    vocab.extend(diff)

    print(f'word 改写 {n_word} 条 / use 复核 {n_use} 条 / mean 返工 {n_mean} 条')
    print(f'辨析卡追加 {len(diff)} 条（id {DIFF_ID_START}–{nid - 1}）')
    print(f'总计 {len(vocab)} 条')
    print('\n--- word 改写抽样 ---')
    for i, (i2, o, n) in enumerate(changed):
        if i % 47 == 0:
            print(f'  [{i2}] {o[:40]}\n       → {n}')
    print('\n--- 辨析卡 ---')
    for c in diff:
        print(f'  [{c["id"]}] {c["word"]}')

    # ---- 校验 ----
    bad = 0
    if len(set(e['id'] for e in vocab)) != len(vocab):
        print('!! id 重复'); bad += 1
    for e in vocab:
        for f in ('word', 'syn', 'mean', 'example', 'scene'):
            if not str(e.get(f, '')).strip():
                print('!! 空字段', e['id'], f); bad += 1
        if not e.get('use') or not e.get('tier') or not e.get('tab'):
            print('!! 缺维度', e['id']); bad += 1
    print('\n校验问题数:', bad)
    if bad:
        print('校验不通过，拒绝落盘。'); return
    if not apply:
        print('[干跑] 未落盘。加 --apply 生效。'); return

    # ---- 落盘 ----
    os.makedirs('build/backup', exist_ok=True)
    stamp = datetime.datetime.now().strftime('%Y%m%d-%H%M%S')
    shutil.copy(src, f'build/backup/data.js.{stamp}.bak')
    order = ['id', 'tab', 'tier', 'use', 'cat', 'word', 'syn', 'mean', 'example', 'scene']
    out = [{k: e[k] for k in order if k in e} for e in vocab]
    lines = [
        '/* build: %s */' % datetime.datetime.now().isoformat(),
        'window.VOCAB=' + json.dumps(out, ensure_ascii=False, separators=(',', ':')) + ';',
        'window.CATEGORIES=' + json.dumps(cats, ensure_ascii=False, separators=(',', ':')) + ';',
        'window.TOPICS=' + json.dumps(topics, ensure_ascii=False, separators=(',', ':')) + ';',
    ]
    with open(src, 'w', encoding='utf-8', newline='\r\n') as f:
        f.write('\n'.join(lines) + '\n')
    print(f'已写入 {src}（备份 build/backup/data.js.{stamp}.bak）')

    # ---- 同步 id_registry ----
    reg = json.load(open('build/id_registry.json', encoding='utf-8'))
    for e in diff:
        reg['entries'][f"diff\x01{DIFF_CAT}\x01{e['word']}"] = e['id']
    reg['next_id'] = nid
    reg['count'] = len(reg['entries'])
    reg['updated'] = datetime.datetime.now().isoformat()
    json.dump(reg, open('build/id_registry.json', 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    print(f"id_registry 已同步：next_id={nid}，条目 {reg['count']}")


if __name__ == '__main__':
    ap = argparse.ArgumentParser()
    ap.add_argument('--src', default='data.js')
    ap.add_argument('--apply', action='store_true')
    a = ap.parse_args()
    main(a.src, a.apply)
