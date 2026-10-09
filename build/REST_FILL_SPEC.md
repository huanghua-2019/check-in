# 金句 / 比喻 / 段子 / 案例 字段补齐规范（syn / mean / scene）

## 任务
读分给你的 `build/todo_rest_*.json`，为每条补齐 `miss` 列出的字段，产出补丁 JSON。

## 输入
数组，每项：
```json
{"id":828,"tab":"quote","cat":"🧠 人性与认知",
 "word":"强调习惯的力量，开始时不易察觉，后来却难以摆脱",
 "syn":"","mean":"",
 "example":"习惯的力量。\n常言道，习惯的枷锁，开始的时候轻的难以察觉，到后来却重的无法摆脱。这话特别在理。",
 "miss":["syn","mean","scene"]}
```
- `word` 是**这条寓意的概括**（不是被解释的词）；
- `example` 是**原话/原文**（已存在，不要改、不要补）；
- **只补 miss 里的字段**，已有字段原样不动。

## 输出
写到 `build/patch_rest_<片名>.json`：
```json
{"828": {"syn":"...", "mean":"...", "scene":"..."}}
```
- key 为 id 字符串；只含 miss 字段；UTF-8 `ensure_ascii=False`。

## 三个字段怎么写

### mean（释义）—— 一句话说清这条寓意讲的是什么
- 25–50 字，解释性文字，不堆同义词。
- 把 `word` 那句概括**展开成完整判断**，说清道理本身。
- 例：`习惯形成时阻力极小，一旦固化便极难改变，强调尽早养成好习惯。`

### syn（同义表达）—— 同一意思的另一种说法
- 15–40 字，用「、」分隔的 2–4 个短表达；可以是白话改述、成语、谚语、另一句名言。
- **必须真的同义**，不能是无关的另一句金句。
- 例（习惯枷锁那条）：`习惯养成悄无声息、戒除却积重难返、坏习惯是温水煮青蛙`
- 若 `example` 是名人原话，syn 优先给「同一道理的更凝练说法」，不要伪造该名人的其他发言。

### scene（使用场景）—— 什么时候会引用它
- 20–45 字，句式对齐现有条目：`用于……，常见于……等场景。`
- 说清「在什么话题、什么场合、为了说明什么」被引用。
- 例：`用于阐述习惯的复利效应与路径依赖，常见于自我管理、行为养成、组织惯性等话题。`

## 按 tab 的处理侧重

| tab | 是什么 | 侧重 |
|---|---|---|
| `quote` | 金句、名人原话 | mean 提炼道理；syn 给同类说法；scene 写引用场合 |
| `met` | 比喻、类比（芒格式） | mean 点破比喻背后的直白道理；syn 给同道理的通俗说法；scene 写用来说服/打比方的话题 |
| `humor` | 段子、玩梗、自嘲 | mean 说清笑点所在；syn 给同类梗说法；scene 写适合活跃气氛/消解尴尬的场合 |
| `cases` | 案例（故事） | mean 点出案例的启示；syn 给启示的另一种表述；scene 写适合用来论证什么 |
| `rule` | 写作规则 | mean 说清规则内容；syn 给同类规则说法；scene 写写作中什么时候用 |

## 质量红线（违反即返工）
1. **禁套话**：不许「用于各种场合」「在多种情境下使用」这类放之四海皆准的空话。
2. **禁雷同**：同一分类内多条 scene 不能是同一句换词，必须贴合各自内容。
3. **禁编造**：不写具体数字、不虚构事件、**不得伪造名人未说过的发言**。
4. **禁 Markdown**：字段值里不要出现 `**`、`-`、`#`、`|`。
5. **禁词不达意**：mean/syn 必须贴合该条本意，不能张冠李戴。
6. **syn 不得是纯数字或单个字**（现有 828、883 两条是历史脏数据，按上面规则重写）。

## 校验（写完自己跑，问题数必须为 0）
```bash
PY="/c/Users/Lenovo/.workbuddy/binaries/python/versions/3.13.12/python.exe"
$PY -c "
import json,sys
patch='build/patch_rest_<片名>.json'
todo='build/todo_rest_<片名>.json'
p=json.load(open(patch,encoding='utf-8'))
t={str(x['id']):x for x in json.load(open(todo,encoding='utf-8'))}
print('补丁条数:',len(p),'/',len(t))
bad=0
for k,v in p.items():
    if k not in t: print('未知id',k); bad+=1; continue
    miss=t[k]['miss']
    for f in v:
        if f not in miss: print('多余字段',k,f); bad+=1
    for f in miss:
        if f not in v or not str(v[f]).strip(): print('还缺',k,f); bad+=1
    for f,val in v.items():
        val=str(val)
        if '**' in val or len(val)<8: print('可疑',k,f,val[:30]); bad+=1
        if f=='syn' and val.strip().isdigit(): print('syn是数字',k); bad+=1
print('问题数:',bad)
"
```
