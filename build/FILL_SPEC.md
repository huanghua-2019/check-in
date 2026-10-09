# 词库字段补齐规范（example / scene / mean）

## 任务
读 `build/todo_vocab.json`，取本分片负责分类的条目，为每条补齐缺失字段，产出补丁 JSON。

## 输入
`build/todo_vocab.json` 是数组，每项：
```json
{"id":12,"cat":"01-观点与论述","word":"缺乏信心","syn":"没信心、没底气","mean":"对未来没有把握...","example":"","scene":"","miss":["example","scene"]}
```
`miss` 列出该条缺哪几个字段。**只补 miss 里的字段**，已有的字段原样不动。

## 输出
写到 `build/patch_<片名>.json`，格式：
```json
{
  "12": {"example":"...", "scene":"..."},
  "79": {"mean":"...", "example":"...", "scene":"..."}
}
```
- key 是 id 的字符串
- 只含 miss 里的字段
- UTF-8，`ensure_ascii=False`

## 字段写法

### example（例句）
- 25–45 字，一个通顺完整的句子，把该词自然嵌进去。
- 语境：投研 / 商业 / 职场 / 管理 / 阅读写作。
- 主语用**泛指**（这家公司、某消费企业、这位投资者、管理层、一份研报）或**广为公认的事实**（茅台提价、巴菲特长期持有可口可乐、亚马逊的飞轮）。
- **严禁**编造具体财务数字、具体未发生的公司事件、伪造引语。写不实就换泛指。
- 不加引号包裹整句；句中如需引用可正常用中文引号。

### scene（使用场景）
- 20–40 字，句式对齐现有条目：`用于……，常见于……等场景。`
- 说清「这个词在什么场合、为了什么目的」被使用。
- 参考现有写法：
  - `用于对事物进行高度评价，强调其优越性、独特性等，常见于行业分析、企业评价等场景。`
  - `在描述企业、个人等对自身能力、产品等具有很强信心的场景，如企业战略决策、产品推广等方面的分析。`

### mean（释义｜仅 miss 含 mean 时才补）
- 一句解释性文字，说清「是什么意思、和近义词差在哪」，**不要用同义词堆砌充数**。
- 例：`对未来没有把握，没有底气，不相信事情能向好发展`（好）／`没信心、没底气`（差，这是 syn 的活）。

## 质量红线（违反即返工）
1. **禁套话**：不许写「用于各种场合」「在多种情境下使用」这种放之四海皆准的空话。
2. **禁雷同**：同一分类内多条 scene 不能是同一句换个词，必须贴合各自词义。
3. **禁编造**：不写具体数字（如"增长37%"）、不虚构事件、不伪造名人对该词的发言。
4. **禁 Markdown**：字段值里不要出现 `**`、`-`、`#` 等到标记符号。
5. **禁词不达意**：example 里该词必须真的用对了（如「不具备」不能写成肯定句）。

## 边界情况
- **word 本身就是整句**（如 `不是对胜者的奖赏，而是下一轮竞赛的鼓点`）：example 写「在什么语境下怎么用」，不要重复 word 原句。
- **word 含斜杠/并列**（如 `侵蚀/瓦解`、`一团乱麻 vs 一套乐高`）：example 用其中一个或两个，scene 覆盖整体含义。
- **反义/否定词**（不具备、不存在、并非必要、难以维系）：example 必须是符合词义的否定表述。

## 校验（写完自己跑一遍）
```bash
"/c/Users/Lenovo/.workbuddy/binaries/python/versions/3.13.12/python.exe" -c "
import json
p=json.load(open('build/patch_<片名>.json',encoding='utf-8'))
t={str(x['id']):x for x in json.load(open('build/todo_vocab.json',encoding='utf-8'))}
print('补丁条数:',len(p))
bad=0
for k,v in p.items():
    miss=t[k]['miss']
    for f in v:
        if f not in miss: print('  多余字段',k,f); bad+=1
    for f in miss:
        if f not in v or not str(v[f]).strip(): print('  还缺',k,f); bad+=1
    for f,val in v.items():
        if '**' in val or len(val)<8: print('  可疑',k,f,val[:30]); bad+=1
print('问题数:',bad)
"
```
`问题数` 必须为 0。
