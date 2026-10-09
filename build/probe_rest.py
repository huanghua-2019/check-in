"""探查剩余条目(非 vocab/phr)的字段覆盖情况"""
import json, re, collections, os

SRC = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'data.js')
raw = open(SRC, encoding='utf-8').read()
line = [l for l in raw.split('\n') if l.startswith('window.VOCAB=')][0]
vocab = json.loads(line[len('window.VOCAB='):].rstrip('\r\n;'))
print('总条数:', len(vocab))

tabs = collections.Counter(x.get('tab', '?') for x in vocab)
print('tab 分布:', dict(tabs))

FIELD = ['word', 'syn', 'mean', 'example', 'scene']
for t in ['quote', 'met', 'humor', 'cases', 'rule']:
    rows = [x for x in vocab if x.get('tab') == t]
    print(f'\n===== tab={t}  共 {len(rows)} 条 =====')
    # 字段缺失统计
    miss_cnt = collections.Counter()
    for x in rows:
        for f in FIELD:
            if not str(x.get(f, '') or '').strip():
                miss_cnt[f] += 1
    print('缺失字段统计:', dict(miss_cnt))
    # 看前3条样例
    for x in rows[:3]:
        print(json.dumps(x, ensure_ascii=False)[:600])
