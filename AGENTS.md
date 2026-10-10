# AGENTS.md

> **这是 AI coding agent 的入口文件。** 改本仓库任何代码前，先读完本文件。
> `README.md` 是给**人类**看的从 0 到 1 搭建教程（如何部署、如何建表），改代码不必读。

---

## 30 秒速览

| 项 | 值 |
|---|---|
| 项目 | 「打卡」——写作词库打卡单页应用（1398 条词/句式/隐喻/金句/近义辨析） |
| 技术栈 | 原生 HTML/CSS/JS，**零构建、零依赖、零 npm** |
| 唯一真源 | `D:\我的GitHub\check-in`（git 仓库，分支 `main`） |
| 远端 | `git@github.com:huanghua-2019/check-in.git` |
| 线上 | https://huanghua-2019.github.io/check-in/ |
| 改完必做 | 升`index.html` 缓存号 → `python build/verify.py` → git 安全序列提交 |

---

## 铁律（违反必出事故）

1. **只改 `D:\我的GitHub\check-in`**。线上跑的就是这个仓库，改到别处线上永远不变。
   `C:\Users\Lenovo\WorkBuddy\*\vocab-checkin` 是**过期平行副本**，一律不碰。
2. **绝不可跑 `build/sync.py`**——会把旧版 md 回灌，污染数据。
3. **改哪个文件，就把 `index.html` 里对应 `?v=` +1**。用户需 `Ctrl/Cmd+Shift+R` 强刷才生效。
   - 当前值：`styles.css?v=22`、`data.js?v=25`、`app.js?v=24`、`habits.js?v=20`
4. **`data.js` 只增条目、绝不重编 id**。打卡进度按 id 存 localStorage，改 id 会丢用户记录。
   新条目用当前最大 id +1（现为 1920 起）。
5. **先规划再动手**。任何改动先给简短方案让用户拍板，不要闷头改、不要反复试错。
6. **发布走 git 安全序列**（见「发布」），用 `merge FETCH_HEAD`，**不用 rebase、不用 `--force`、不跳 hook**。
7. **改完必跑 `build/verify.py`**，退出码非 0 就是没改对，别带着红灯提交。
8. ⚠️ **改分类标签必须逐条读释义判断，禁止关键词规则批量打标签**。用户原话："你不能瞎分类"。
   已因此出错两次（把形容词塞进动词类；把整句碎片当词条）。**判断不了的一律丢「❓ 待定」，不要硬塞。**

---

## 架构

```
index.html         入口，含 4 个缓存号
├─ data.js      726K  window.VOCAB / CATEGORIES / TOPICS
├─ habits.js     48K  4 张习惯框架卡（独立 IIFE，挂 window.Habits）
├─ app.js        59K  全部交互逻辑（单 IIFE）
└─ styles.css    40K  护眼米色主题（--brand 金棕 #b8861b、底 #f5f0e6）

*.sql                Supabase 建表脚本（手动在 SQL Editor 执行一次）
build/verify.py      改动校验脚本 ← 改完必跑
build/               其余为历史脚本，非运行时依赖
```

### `data.js` 必须保持四行

```
/* build: <ISO时间戳> */
window.VOCAB=[...];
window.CATEGORIES=[...];
window.TOPICS=[...];
```

JSON 紧凑无空格（`separators=(",",":")`）、LF 换行（裸 LF 恰为 4 行）、结尾无多余字符。

### VOCAB 条目（10 字段，键序固定）

| 字段 | 说明 |
|---|---|
| `id` | 整数，全局唯一，**永不重编** |
| `tab` | `vocab`(751) `met`(248) `quote`(165) `phr`(149) `humor`(30) `diff`(44) `cases`(9) `rule`(2) |
| `tier` | `核心`(479) / `进阶`(688) / `备用`(231)，按重要程度，**非掌握程度** |
| `use` | 数组，见下方「分类模型」 |
| `cat` | 留档用旧分类串（如 `01-观点与论述`），前端已不依赖 |
| `word` | 词条本体。vocab=词；phr=带占位符模板（`……`/`XX`/`A B`）；quote/met=原话 |
| `syn` | 同义/近似表达，可附「（同类：X、Y）」互链标注 |
| `mean` | 释义 |
| `example` | 完整示范句（无空位）或原话 |
| `scene` | 使用场景 |

### 分类模型（20 个 CATEGORIES，两轴约定）

`use` 数组遵循 **`use[0]`=主归属、`use[1:]`=场景索引**：

- **主归属（唯一，决定分组统计）**：🔤精准形容词 / 🗣️灵活动词 / ↔️副词连词 / 📐概念指代 / ❓待定，
  以及尚未迁完的历史场景类主归属（🎯立论判断等）。
- **场景索引（可多个，用于筛选）**：🎯立论判断 🔗论证推理 ⚖️对比转折 📊举证说明 💡打比方 🔍洞察本质 ⚠️警示风险 🏆竞争格局 👥人性心理 🏗️管理组织 💰投资决策 🌿人生修养 🖋️描写刻画 ✍️写作技法 😂幽默调侃

规则：
- 一条词**只存一份**，点任一场景索引都能调出，但分组统计只算主归属，**不重复计数**。
- 前端已按此实现：`useOf()` 取 `use[0]`，`subUses()` 取 `use.slice(1)`。
- 已知遗留：`💡打比方` 主归属为 0 条（全部被当索引用），不影响筛选。

### TOPICS（11 个主题包）

护城河与竞争优势 / 估值与安全边际 / 能力圈与认知 / 风险与失败 / 周期与宏观 / 竞争与格局 /
管理与文化 / 现金流与财务 / 心态与长期主义 / 护人与识人 / 写作与表达。
按 `keys` 关键词匹配，**零维护**——新词含任一 `keys` 关键词即自动归包。

### localStorage 键（勿随意改名，改名=丢用户数据）

| 键 | 内容 |
|---|---|
| `vocab_checkin_state_v1` | 打卡记录（count / first_used / last_used / mastery） |
| `vocab_current_tab_v1` | 当前所在 tab |
| `vocab_mine_v1` | 我的例句 |
| `vocab_daily_v1` | 每日统计 |
| `vocab_sb_config_v1` | Supabase url + anon key |
| `habit_logs_v1`（habits.js） | 习惯卡日志 |

### Supabase

- 仅用 **anon key** 直连，**禁止嵌入 service_role key**。
- 建表脚本：`supabase-schema.sql`(打卡) / `writing_log.sql`(我的例句) / `habits_schema.sql`(习惯卡) / `daily_counter.sql`(每日计数)。
- 表未建时功能降级为纯本地，**不报错**。

---

## 常用命令

```bash
cd D:\我的GitHub\check-in

# 改完必跑：全量校验（退出码非 0 就是没改对）
"C:\Users\Lenovo\.workbuddy\binaries\python\versions\3.13.12\python.exe" build/verify.py --expect 1400

# 语法检查
"C:\Users\Lenovo\.workbuddy\binaries\node\versions\22.22.2-6\node.exe" --check app.js

# 解析 data.js（唯一正确方式，见下节）
python -c "import re,json;src=open(r'D:\我的GitHub\check-in\data.js',encoding='utf-8').read();arr=json.loads(re.search(r'window\.VOCAB=(\[.*\]);\nwindow\.CATEGORIES',src,re.S).group(1));print(len(arr))"

# 查看状态 / 查缓存号
git status --short && git log --oneline -3
grep -n "?v=" index.html
```

---

## ⚠️ 解析 data.js 的唯一正确方式

**绝不手算偏移量。** `window.VOCAB=[` 是 **14 个字符**（`window.VOCAB=` 13 + `[` 1）。
用 `+12` 会把定位点落在 `=` 上，切片变成 `=[{...}]`，JSON 永远解析失败，
进而**误判"文件坏了"**——历史上因此白翻一整轮 git 历史。

```python
import re, json
src = open(r"D:\我的GitHub\check-in\data.js", encoding="utf-8").read()
m = re.search(r"window\.VOCAB=(\[.*\]);\nwindow\.CATEGORIES", src, re.S)
assert m, "未找到 VOCAB 数组"
arr = json.loads(m.group(1))          # 先确认能解析，再动
```

写回时用 `m.start(1)` / `m.end(1)` 定位，不要手算。
改 `CATEGORIES` 用 `window\.CATEGORIES=(\[.*?\]);\nwindow\.TOPICS`。

---

## 新增词条标准流程

```python
import re, json, datetime
P = r"D:\我的GitHub\check-in\data.js"
src = open(P, encoding="utf-8").read()
m = re.search(r"window\.VOCAB=(\[.*\]);\nwindow\.CATEGORIES", src, re.S)
arr = json.loads(m.group(1))
base = len(arr)
max_id = max(w["id"] for w in arr)

arr.append({
  "id": max_id + 1, "tab": "vocab", "tier": "进阶",
  "use": ["🎯 立论判断"],           # [主归属, ...场景索引]
  "cat": "01-观点与论述",
  "word": "新词", "syn": "近义1、近义2",
  "mean": "释义……", "example": "完整示范句……", "scene": "使用场景……",
})

ts = datetime.datetime.now().strftime("%Y-%m-%dT%H:%M:%S.%f")
out = re.sub(r"/\* build: [^*]* \*/", "/* build: %s */" % ts, src, count=1)
out = out[:m.start(1)] + json.dumps(arr, ensure_ascii=False, separators=(",", ":")) + src[m.end(1):]
open(P, "w", encoding="utf-8").write(out)
```

批量新增就循环 `arr.append(...)`，校验时把 `--expect` 改成 `base+N`。

---

## 改动校验

**首选：直接跑脚本**（覆盖下面全部检查项，比手抄代码块可靠）：

```bash
cd D:\我的GitHub\check-in
"C:\Users\Lenovo\.workbuddy\binaries\python\versions\3.13.12\python.exe" build/verify.py --expect 1400
```

`--expect N` 断言改动后的条目总数；`--quiet` 只输出结论。**退出码非 0 就是没改对**，先修到通过再提交。

19 项检查分 6 组：① 文件存在性 ② data.js 结构（三段可解析 / 裸 LF=4 / 结尾分隔符 / build 时间戳头）
③ 条目完整性（条目数·id 唯一·10 字段·无空值） ④ 分类合法性（use·tab·tier·无重复标签）
⑤ 前端一致性（`node --check app.js` · 缓存号齐全） ⑥ git 工作区状态。

若需在自定义脚本内嵌校验，等价逻辑如下：

```python
src2 = open(P, encoding="utf-8").read()
m2 = re.search(r"window\.VOCAB=(\[.*\]);\nwindow\.CATEGORIES", src2, re.S)
arr2 = json.loads(m2.group(1))
cats = json.loads(re.search(r"window\.CATEGORIES=(\[.*?\]);\nwindow\.TOPICS", src2, re.S).group(1))

assert len(arr2) == base + N              # 条数符合预期
assert len({w["id"] for w in arr2}) == len(arr2)          # id 唯一
req = {"id","tab","tier","use","cat","word","syn","mean","example","scene"}
assert not [w["id"] for w in arr2 if set(w) != req]        # 字段完整
assert not [w["id"] for w in arr2 if any(x not in cats for x in w["use"])]  # use 合法
assert "];\nwindow.CATEGORIES" in src2# 结尾分隔符完好
assert src2.count("\n") - src2.count("\r\n") == 4# 裸 LF 恰为 4
```

---

## 分类标签自查（改 use 前必做）

批量打/改分类前**必须**先自查三步，否则会被判定为"瞎分类"。

**① 全量导出人工过一遍**——至少读一遍 `word + mean`，确认词性与释义和所挂分类一致：

```bash
python -c "
import re,json
src=open(r'D:\我的GitHub\check-in\data.js',encoding='utf-8').read()
arr=json.loads(re.search(r'window\.VOCAB=(\[.*\]);\nwindow\.CATEGORIES',src,re.S).group(1))
for w in sorted(arr,key=lambda x:x['id']):
    print(w['use'][0],'|',w['word'][:20],'|',(w.get('mean') or '')[:40])
"
```

**② 机械筛可疑项**：

```python
if any(c in word for c in "/、，）：") or len(word) > 5: ...        # 碎片或多词拼接
if len(mean) <= 6 and (word in mean or mean in word): ...        # 释义同义改写，信息量为零
if mean.startswith(("名词","形容词","副词")) and 挂的是"灵活词": ...  # 词性与分类矛盾
```

**③ 处理原则**：

| 问题类型 | 处理 |
|---|---|
| 整句/碎片/与词库无关的垃圾 | 直接删 |
| 词性错位（形容词挂动词类） | 按真实词性改挂 |
| 概念/术语误挂形容词类 | 改挂「📐 概念指代」 |
| 拿不准 / 多词拼接 / 释义残缺 | 移入「❓ 待定」，**不硬分类** |
| 只是释义写得敷衍（词本身是好的） | 保留原分类，提示用户补释义 |

判据 ②③ 命中不一定删，要读 `example` 再判断。

---

## 发布

```bash
cd D:\我的GitHub\check-in
git add data.js index.html        # 只 add 本次真正改的文件
git commit -m "feat(vocab): 新增「XX」词条(id NNNN)"
git fetch origin
git merge FETCH_HEAD --no-edit
git push
```

**不用 `git rebase`、`git push --force`、`--no-verify`。**

---

## 常见坑速查

| 现象 | 真相 | 解法 |
|---|---|---|
| `json.loads` 报 `Extra data` / `Expecting value` | 自己切片偏移算错，**不是文件坏** | 用正则定位，不手算偏移 |
| 误以为"文件坏了"去翻 git 历史回滚 | 文件本来完好，越修越乱 | 先跑正则确认能解析 |
| 改完线上没变 | 改的是过期副本 vocab-checkin | 改 `D:\我的GitHub\check-in` |
| 强刷后仍没变 | 漏升缓存号 | 升对应 `?v=` |
| 详情页看不到是哪个词 | 缺标题区 | 检查 `.d-head` 是否渲染 |
| 盲区/用途维度点开为空 | 用途天然跨形式，不能落单 tab | 跨形式入口走「取用台」，勿写死 `currentTab='vocab'` |
| 例句加粗没生效 | 加粗只做在某处渲染点 | 确认覆盖用户所指的那一处 |
| 分类打完用户说"瞎分类" | 关键词批量打标签，没读释义 | 见「分类标签自查」 |
| 改完条目数莫名变化 | 写回时切片边界算错 | 跑 `build/verify.py` |

---

## 提交前自查

- [ ] 改的是 `D:\我的GitHub\check-in`（不是工作区副本）
- [ ] 对应 `?v=` 已 +1
- [ ] `build/verify.py` 退出码为 0
- [ ] 改分类的话，逐条读过释义、没有靠关键词规则
- [ ] 拿不准的词进了「❓ 待定」而不是硬塞
- [ ] 改 `app.js` 跑过 `node --check`
- [ ] 用 merge FETCH_HEAD，未用 rebase / --force / --no-verify

---

## 用户偏好

- 要"写时调得出"的工具，不是藏品。分类维度可加，但用途天然跨形式。
- **先规划再动手**：小改动也先给方案 + 最终文案让用户拍板，别自作主张。
- 对分类准确度要求极严：**宁可留「❓ 待定」也不要 AI 硬分类充数**。
- 需求有两种以上解读时，先用 AskUserQuestion 确认，别猜。
- UI：浅色护眼 + 金棕主色（`--brand:#b8861b`、底 `#f5f0e6`），**不用深色底**；左侧 sidebar 导航。
- 结论要直接，不写"以客户为中心"这类不可验证的套话。