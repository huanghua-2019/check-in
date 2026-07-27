"""把 phrases.json 合并到 vocab.js：id 从 max+1 起，分类名追加到 CATEGORIES 末尾。"""
import json, re

ROOT = r"C:\Users\Lenovo\WorkBuddy\2026-07-21-16-55-18\vocab-checkin"
JS = f"{ROOT}/vocab.js"
PHR = f"{ROOT}/build/metaphors_quotes.json"

content = open(JS, encoding='utf-8').read()
vocab = json.loads(re.search(r'window\.VOCAB\s*=\s*(\[[\s\S]*?\])\s*;', content).group(1))
cats  = json.loads(re.search(r'window\.CATEGORIES\s*=\s*(\[[\s\S]*?\])\s*;', content).group(1))

phr = json.load(open(PHR, encoding='utf-8'))
next_id = max(v['id'] for v in vocab) + 1
new_count = 0
for it in phr['items']:
    vocab.append({
        'id': next_id,
        'cat': it['cat'],
        'word': it['word'],
        'syn': it.get('syn', ''),
        'mean': it.get('meaning', ''),
        'example': it.get('example', ''),
        'scene': it.get('scene', ''),
    })
    next_id += 1
    new_count += 1

# 追加新分类到 CATEGORIES（去重保序）
for c in phr['cats']:
    if c not in cats:
        cats.append(c)

# 重写 vocab.js（保持单行 JSON + 一行 CATEGORIES）
out = "window.VOCAB=" + json.dumps(vocab, ensure_ascii=False) + ";\n"
out += "window.CATEGORIES=" + json.dumps(cats, ensure_ascii=False) + ";\n"
open(JS, 'w', encoding='utf-8').write(out)
print(f"合并完成：原 {len(vocab)-new_count} + 新 {new_count} = {len(vocab)} 条")
print(f"分类：原 {len(cats)-len(phr['cats'])} + 新增 {sum(1 for c in phr['cats'] if c not in cats[:len(cats)-len(phr['cats'])])} = 总 {len(cats)} 个")
print(f"新分类: {[c for c in phr['cats'] if c in cats and c not in cats[:len(cats)-len(phr['cats'])]]}")
