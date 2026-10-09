# -*- coding: utf-8 -*-
"""通用字段补丁器：把一个 {id: {字段: 值}} 补丁合并进 data.js。

用法：
  python apply_patch.py --patch build/wordpatch/meanfix.json
  python apply_patch.py --patch build/wordpatch/meanfix.json --apply
"""
import argparse, datetime, json, os, re, shutil

ORDER = ['id', 'tab', 'tier', 'use', 'cat', 'word', 'syn', 'mean', 'example', 'scene']


def main(patch_path, src, apply):
    raw = open(src, encoding='utf-8').read()
    vocab = json.loads(re.search(r'window\.VOCAB=(\[.*?\]);', raw, re.S).group(1))
    cats = json.loads(re.search(r'window\.CATEGORIES=(\[.*?\]);', raw, re.S).group(1))
    topics = json.loads(re.search(r'window\.TOPICS=(\[.*?\]);', raw, re.S).group(1))
    by_id = {e['id']: e for e in vocab}
    patch = json.load(open(patch_path, encoding='utf-8'))

    n = 0
    for k, v in patch.items():
        e = by_id.get(int(k))
        if not e:
            print('!! 找不到 id', k)
            continue
        for f, val in v.items():
            if f not in ORDER:
                print('!! 非法字段', k, f)
                continue
            e[f] = val
        n += 1
    print(f'{os.path.basename(patch_path)}: 合并 {n} 条')

    bad = 0
    for e in vocab:
        for f in ('word', 'syn', 'mean', 'example', 'scene'):
            if not str(e.get(f, '')).strip():
                print('!! 空字段', e['id'], f); bad += 1
    print('校验问题数:', bad)
    if bad or not apply:
        print('[未落盘]' if not bad else '[校验失败]')
        return

    os.makedirs('build/backup', exist_ok=True)
    stamp = datetime.datetime.now().strftime('%Y%m%d-%H%M%S')
    shutil.copy(src, f'build/backup/data.js.{stamp}.bak')
    out = [{k: e[k] for k in ORDER if k in e} for e in vocab]
    lines = [
        '/* build: %s */' % datetime.datetime.now().isoformat(),
        'window.VOCAB=' + json.dumps(out, ensure_ascii=False, separators=(',', ':')) + ';',
        'window.CATEGORIES=' + json.dumps(cats, ensure_ascii=False, separators=(',', ':')) + ';',
        'window.TOPICS=' + json.dumps(topics, ensure_ascii=False, separators=(',', ':')) + ';',
    ]
    with open(src, 'w', encoding='utf-8', newline='\r\n') as f:
        f.write('\n'.join(lines) + '\n')
    print(f'已写入 {src}（备份 build/backup/data.js.{stamp}.bak）')


if __name__ == '__main__':
    ap = argparse.ArgumentParser()
    ap.add_argument('--patch', required=True)
    ap.add_argument('--src', default='data.js')
    ap.add_argument('--apply', action='store_true')
    a = ap.parse_args()
    main(a.patch, a.src, a.apply)
