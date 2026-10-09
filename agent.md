# Agent 操作手册 · check-in 词库

> 本文件供 AI agent 在修改 check-in 词库（尤其是新增/编辑词汇）时直接参考。
> 所有改动的唯一真源与部署源是 **`D:\我的GitHub\check-in`**（git 仓库，GitHub Pages）。
> 工作区 `C:\Users\Lenovo\WorkBuddy\*\vocab-checkin` 是**过期平行副本**，一律不碰。

---

## 0. 铁律（违反必出事故）

1. **只改 `D:\我的GitHub\check-in`**。线上跑的是这个仓库，改错副本线上永远不变。
2. **绝不可跑 `sync.py`**（会把旧版 md 回灌，污染数据）。
3. **改哪个文件就把 `index.html` 里对应 `?v=` 缓存号 +1**；用户需 **Ctrl/Cmd+Shift+R 强刷**才能看到新数据。
4. **data.js 铁律：只增条目、绝不重编 id**（打卡进度按 id 存 localStorage）。新词用当前最大 id +1。
5. **先规划再干活**：任何改动先给简短方案让用户拍板，不要直接动文件反复试错。
6. **发布走 git 安全序列**（见 §5），用 merge FETCH_HEAD 而非 rebase。
7. ⚠️ **改分类标签必须逐条读释义判断，禁止用关键词规则批量打标签**。用户原话："你不能瞎分类""不能瞎搞"。历史上已因此出错两次：①按词性关键词把 223 条批量归类，把形容词/副词塞进灵活词；②把「体重达300斤」「确切的体重数值」这类**整句碎片**当成词条分类。**判断不了的一律丢「❓ 待定」分类，不要硬塞。**

---

## 1. 文件结构

- `index.html`：入口，含三个缓存号 `data.js?v=N`、`app.js?v=N`、`styles.css?v=N`。
- `data.js`：词库主数据。结构是**四行**——
  ```
  /* build: <ISO时间戳> */
  window.VOCAB=[...];
  window.CATEGORIES=[...];
  window.TOPICS=[...];
  ```
  要求：JSON 无空格（紧凑）、每行以 LF 结尾（裸 LF 应为 4 行）、不引入 CRLF 之外的杂散换行。
- `app.js` / `styles.css`：前端逻辑与样式。

### VOCAB 条目字段（10 个，键顺序对齐如下）
```
{id, tab, tier, use, cat, word, syn, mean, example, scene}
```
- `id`：整数，全局唯一，不重排不重编。
- `tab`：`vocab`/`phr`/`met`/`quote`/`humor`/`cases`/`rule`/`diff`。
- `tier`：`核心`/`进阶`/`备用`（按重要程度，非掌握程度）。
- `use`：**数组**，17 类写作用途之一或多个，如 `["🎯 立论判断"]`。
- `cat`：留档用旧分类字符串（如 `"01-观点与论述"`），前端已不依赖。
- `word`：词条本身（vocab 为词/短语；phr 为带占位符模板；quote/met 等为原话）。
- `syn`：同义/近似表达，逗号分隔；可附互链标注「（同类：X、Y）」。
- `mean`：释义。
- `example`：完整示范句（无待填空位）或原话。
- `scene`：使用场景说明。

---

## 2. ⚠️ 解析 data.js 的唯一正确方式（血泪教训）

**绝不手算偏移量！** 字符串 `window.VOCAB=[` 实际是 **14 个字符**（`window.VOCAB=` 13 + `[` 1）。
用 `+12` 会把定位点落在 `=` 上，切片头变成 `=[{...}`，JSON 永远解析失败，进而误判"文件坏了"。

✅ **正确做法：用正则定位数组首尾，全程不碰手算偏移。**

```python
import re, json
P = r"D:\我的GitHub\check-in\data.js"
src = open(P, encoding="utf-8").read()

# 贪婪匹配到 '];\nwindow.CATEGORIES' 之前——这是唯一稳妥的切法
m = re.search(r"window\.VOCAB=(\[.*\]);\nwindow\.CATEGORIES", src, re.S)
assert m, "未找到 VOCAB 数组"
arr = json.loads(m.group(1))          # ← 先确认能解析，再动
```

其它切片写法（`src.index("window.VOCAB=[")+12`、`.find("]")` 等）都栽过跟头，**一律不用**。

### 校验"文件是否损坏"也用同一正则
不要自己 `src[s:e]` 切片——s/e 算错就误报。直接跑上面的 `m = re.search(...)` 看是否 `assert` 通过。

---

## 3. 新增词汇标准流程（照抄即可）

以"新增一条 vocab 词条"为例：

```python
import re, json
P = r"D:\我的GitHub\check-in\data.js"
src = open(P, encoding="utf-8").read()

m = re.search(r"window\.VOCAB=(\[.*\]);\nwindow\.CATEGORIES", src, re.S)
arr = json.loads(m.group(1))
base = len(arr)                        # 记下基线条数（如 1362）

# 找最大 id
max_id = max(w.get("id", 0) for w in arr)
new_id = max_id + 1

# 追加新条目（字段顺序、键名严格对齐现有格式）
arr.append({
  "id": new_id,
  "tab": "vocab",
  "tier": "进阶",                       # 或 核心/备用
  "use": ["🎯 立论判断"],               # 按实际用途填
  "cat": "01-观点与论述",
  "word": "新词",
  "syn": "近义1、近义2",
  "mean": "释义……",
  "example": "完整示范句……",
  "scene": "使用场景说明……"
})

# 如需互链：给同类词条的 syn 末尾追加标注
for tid in (59, 122):                  # 例如「提到」「指出」
    w = next(x for x in arr if x["id"] == tid)
    if "（同类：新词）" not in w["syn"]:
        w["syn"] = w["syn"] + "（同类：新词）"

# 原格式写回（保留 build 行与 CATEGORIES/TOPICS 原样）
out = src[:m.start(1)] + json.dumps(arr, ensure_ascii=False, separators=(",", ":")) + src[m.end(1):]
open(P, "w", encoding="utf-8").write(out)

# ===== 写回后二次校验（必须跑）=====
src2 = open(P, encoding="utf-8").read()
m2 = re.search(r"window\.VOCAB=(\[.*\]);\nwindow\.CATEGORIES", src2, re.S)
arr2 = json.loads(m2.group(1))
assert len(arr2) == base + 1, f"条数异常：{len(arr2)}"
assert any(w["id"] == new_id for w in arr2), "新词未写入"
req = {"id","tab","tier","use","cat","word","syn","mean","example","scene"}
bad = [w["id"] for w in arr2 if set(w) != req]
assert not bad, f"字段不完全一致：{bad}"
print("✅ 写回成功，条目数", len(arr2))
```

### 批量新增
同上，循环 `arr.append(...)` 多条即可，`base+1` 改为 `base+N`。

---

## 4. 缓存号与发布

新增/改 data.js 后：**只升 `data.js?v=`**（app.js、styles.css 没动就不升）。

`index.html` 里把：
```html
<script src="data.js?v=21"></script>
```
改为 `?v=22`（当前值见文件，+1 即可）。

---

## 5. Git 安全序列（发布）

```bash
cd D:\我的GitHub\check-in
git add data.js index.html
git commit -m "feat(vocab): 新增「XX」词条(id NNNN)，与「YY」互链"
git fetch origin
git merge FETCH_HEAD --no-edit
git push
```

**不要用 `git rebase`、`git push --force`、跳过 hook。**

---

## 6. 常见坑速查

| 现象 | 真相 | 解法 |
|---|---|---|
| `json.loads` 报 `Extra data` / `Expecting value` | 几乎都是**自己切片偏移算错**，不是文件坏 | 改用 §2 正则，不手算偏移 |
| 误以为"文件坏了"去翻 git 历史回滚 | 文件其实完好，越修越乱 | 先跑 §2 正则确认能解析再动手 |
| 改完线上没变 | 改的是工作区过期副本 vocab-checkin | 改 `D:\我的GitHub\check-in` |
| 改完强刷仍没变 | 漏升缓存号 / 改错文件 | 升对应 `?v=`，确认改的是真仓库 |
| 盲区/用途维度点开为空 | 用途天然跨形式（vocab 外也有），不能落单 tab | 跨形式入口走"取用台"，勿写死 `currentTab='vocab'` |
| 句式/例句加粗没生效 | 加粗逻辑改在详情页/取用台，列表卡片用的是 `word` 字段 | 确认加粗渲染点覆盖用户所指位置 |
| 分类打完用户说"瞎分类" | 用关键词规则批量打标签，没逐条读释义 | 见 §8 分类自查三步，先自查再交付 |

---

## 8. 分类标签自查（改 use 前必做）

批量给条目打/改分类标签前，**必须**先跑一遍下面三步自查，否则会被用户判定为"瞎分类"。

### 8.1 全量导出人工过一遍
```bash
python -c "
import re,json
src=open(r'D:\我的GitHub\check-in\data.js',encoding='utf-8').read()
arr=json.loads(re.search(r'window\.VOCAB=(\[.*\]);\nwindow\.CATEGORIES',src,re.S).group(1))
for w in sorted(arr,key=lambda x:x['id']):
    print(w['use'][0],'|',w['word'][:20],'|',(w.get('mean') or '')[:40])
"
```
至少读一遍 `word + mean`，确认「词性" 和释义"与所挂分类一致。

### 8.2 机械筛出可疑项（先捞出来再逐条判）
```python
# 判据1：word 含分隔符 / 斜杠 / 顿号 / 长句 → 多半是碎片或多词拼接
if any(c in word for c in "/、，）：") or len(word) > 5
# 判据2：释义与 word 同义改写（信息量为零，如「无限」的释义是「无限」）
if len(mean) <= 6 and (word in mean or mean in word)
# 判据3：释义开头词性与所挂分类矛盾（如"副词…"却挂在灵活词）
if mean.startswith(("名词","形容词","副词")) and 挂的是"灵活词"
```
**注意**：判据2/3 命中的不一定删，可能只是释义写得敷衍——要读 example 判断。

### 8.3 处理原则
| 问题类型 | 处理 |
|---|---|
| 整句/碎片/与词库无关的垃圾 | 直接删 |
| 词性错位（形容词挂在动词类） | 按真实词性改挂 |
| 概念/术语误挂在形容词类 | 改挂「📐 概念指代」 |
| 拿不准 / 多词拼接 / 释义残缺 | 移入「❓ 待定」，**不硬分类** |
| 只是释义写得敷衍（词本身是好的） | 保留原分类，提示用户补释义 |

---

## 7. 用户偏好（加词相关）

- 加词类需求若有两种以上解读（如"作为提及的类似词"可能=并入同义词 / 建独立词条），**先用 AskUserQuestion 确认**，别猜。
- 用户要的是"写时调得出"的工具，不是藏品；分类维度可加，但用途维度（use）天然跨形式。
- 排版/UI 偏好：浅色护眼 + 金棕主色（`--brand` 金棕），不用深色底。
