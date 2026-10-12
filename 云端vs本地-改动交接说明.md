# 词库改动交接说明 · 云端 vs 本地

> **给另一台电脑上执行修改的 agent 读。**
> 生成时间：2026-10-12
> 生成方：当前电脑（WorkBuddy 会话，Windows）
> 用途：把「云端真源」相对「本地旧副本」的差异讲清楚，避免改错地方或用错结构

---

## 零、接手前必读：另一台电脑的情况

**本文档中的路径、命令全部基于当前这台Windows 电脑。** 如果你在另一台电脑上执行，**先替换以下三项**：

| 项 | 本文档里的值 | 怎么改成你那边的 |
|---|---|---|
| 仓库路径 | `D:\我的GitHub\check-in` | 你 clone 到的实际路径（**必须是 git 仓库**） |
| python | `C:\Users\Lenovo\.workbuddy\binaries\python\versions\3.13.12\python.exe` | 用`python` / `python3` 即可，或你机器上的实际路径 |
| node | `C:\Users\Lenovo\.workbuddy\binaries\node\versions\22.22.2-6\node.exe` | 用 `node` 即可 |

**如果你的机器上有Mac 侧的另一份仓库副本**（历史上有过），同样注意：**只有 git 仓库那份是真源**，非git 目录一律不改。判断方法：目录下有 `.git` 文件夹 = 仓库 = 真源。

**强烈建议先做这三步确认**：

```bash
# 1. 确认你改的是真源（应有 .git 目录，且远端指向 huanghua-2019/check-in）
cd<你的仓库路径>
git remote -v
# 2. 拉到最新（别人可能已经改过）
git fetch origin && git merge FETCH_HEAD --no-edit
# 3. 校验当前状态（应与本文档第六节快照一致：1398 条）
python build/verify.py --expect 1398
```

> ⚠️ **多人同时改同一个仓库会冲突**。动手前先 `git fetch` 看有没有别人的新提交；如果有未拉取的改动，**先跟对方确认**再改，别直接覆盖。

---

## ⚠️ 先读这一段（三条铁律）

**1. 云端才是真源，本地副本是死的**

| | 路径 | 状态 |
|---|---|---|
| ✅ **云端真源** | `D:\我的GitHub\check-in` | git 仓库，**GitHub Pages 部署源**，线上跑的就是它 |
| ❌ **本地旧副本** | `C:\Users\Lenovo\WorkBuddy\2026-07-21-16-55-18\vocab-checkin` | **不是 git 仓库、无部署、已过期**，只作历史参考 |

**改任何东西都必须改云端真源**。改本地副本 → 线上毫无变化（历史上已因改错副本导致线上无变化，见下方事故记录）。

**2. 两边数据结构不兼容，本地副本的数据不能直接拿来用**

| | 本地旧副本 | 云端真源 |
|---|---|---|
| 条目数 | **1232** | **1398** |
| 字段数 | **8 个**（无 `tier`、无 `use`） | **10 个** |
| 字段清单 | `id/tab/word/syn/mean/example/scene/cat` | 上列 + **`tier`** + **`use`** |
| CATEGORIES | **46 个**（`01-观点与论述` 这类扁平分类） | **20 个**（emoji + 写作用途，两轴模型） |
| TOPICS | **无** | **11 个主题包** |
| 分级 | 无 | `核心`479 / `进阶`688 / `备用`231 |
| 缓存号 | `data.js?v=7` / `app.js?v=15` / `css?v=15` / `habits.js?v=1` | `data.js?v=25` / `app.js?v=24` / `css?v=22` / `habits.js?v=20` |
| 版本时间 | 2026-07-23 ~ 10-09 | 2026-09-10 ~ 10-10 |

**结论：本地副本是 2026-10-09 之前的旧架构**（那时还是「用词精准」那套分类），云端已经过3 轮大重构。**不要把本地数据往云端合并，也不要把云端数据往本地写**。

**3. 绝不可跑 `build/sync.py`**——会把旧版 md 数据回灌，污染线上词库。

---

## 一、云端相比本地，改了什么

### 1.1 分类体系整体重构（最关键的改动）

**旧结构（本地）**：46 个扁平分类，形如 `01-观点与论述`、`04-行为与动作`、`📒 03蒋凡回应…`、`😂 自嘲与玩梗`——混杂了写作用途、内容领域、来源栏目、幽默类型，检索价值低。

**新结构（云端）**：20 个分类，**两轴模型**：

```
use[0]  = 主归属（唯一，决定分组统计）
use[1:] = 场景索引（可多个，用于筛选，不重复计数）
```

- **主归属（形式类）**：`🔤 精准形容词` / `🗣️ 灵活动词` / `↔️ 副词连词` / `📐 概念指代` / `❓ 待定`
- **场景索引（场景类15 个）**：`🎯 立论判断` `🔗 论证推理` `⚖️ 对比转折` `📊 举证说明` `💡 打比方` `🔍 洞察本质` `⚠️ 警示风险` `🏆 竞争格局` `👥 人性心理` `🏗️ 管理组织` `💰 投资决策` `🌿 人生修养` `🖋️ 描写刻画` `✍️ 写作技法` `😂 幽默调侃`

> 说明：`🔤 精准形容词` / `🗣️ 灵活动词` / `↔️ 副词连词` 是较新加入的 3 类，由用户提供的「精准形容词 / 灵活动词 / 副词连词」三分类框架扩展而来。
> `❓ 待定` 是专门收纳「AI 判断不了归属」的词的兜底类。

**TOPICS 新增 11 个主题包**（关键词匹配，零维护）：护城河与竞争优势 / 估值与安全边际 / 能力圈与认知 / 风险与失败 / 周期与宏观 / 竞争与格局 / 管理文化 / 现金流与财务 / 心态与长期主义 / 护人与识人 / 写作与表达。

### 1.2 新增字段

| 字段 | 作用 |
|---|---|
| `tier` | 分级：`核心`(479) / `进阶`(688) / `备用`(231)。按重要程度，**不是掌握程度** |
| `use` | 分类标签数组，见上方两轴模型 |

`cat` 字段保留但**前端已不依赖**，仅留档（如 `01-观点与论述`）。

### 1.3 tab 形式分布变化

| tab | 本地 | 云端 | 差异 |
|---|---|---|---|
| `vocab` 词 | 686 | 751 | **+65** |
| `phr` 句式 | 87 | 149 | **+62** |
| `diff` 近义辨析 | 0 | 44 | **+44**（全新） |
| `humor` 幽默 | 28 | 30 | +2 |
| `cases` 案例 | 8 | 9 | +1 |
| `met` 隐喻 | 254 | 248 | −6 |
| `quote` 金句 | 167 | 165 | −2 |
| `rule` 规则 | 2 | 2 | 0 |
| **合计** | **1232** | **1398** | **+166** |

**词条级差异**（按 word 文本比对）：
- 两边都有：**685**
- 仅云端有：**712**
- 仅本地有：**505**

> 注：「仅本地有」不代表云端丢了东西——其中大量是早期把**整句/例句碎片当词条录入**的垃圾（如`"我的任务是辅佐格罗兹上尉"——芒格…`、`** 分析下游行业扩张带来的市场机遇`、`一针见血`等），云端已在清理过程中删除或移入「❓ 待定」。

### 1.4 前端功能新增（云端 app.js 609行 vs 本地 356行）

| 功能 | 说明 |
|---|---|
| **取用台（desk）** | 跨 8 种 tab 聚合，按用途/主题/关键词统一检索，点行即复制 |
| **主归属 / 场景索引可视化** | 详情页主归属为实心金棕 tag，场景索引为虚线可点 chip（点击跳转筛选） |
| **详情页词条标题区** | `.d-head`，21px 大字显示词本体（此前详情页压根不显示是哪个词） |
| **例句骨架词加粗** | `exBold()`，85 个关联词（不在/而在于/背后是/因为…）标金棕 |
| **句式占位符加粗** | `phrBold()`，`……`/`XX`/`A B` 占位符标金棕 |
| **使用盲区** | 首页按用途维度统计未打卡项，点击跳取用台跨形式筛选 |
| **主题包筛选** | 11 个 TOPICS 关键词自动归包 |
| **框架卡页** | `habits.js` 从 9KB 扩到 49KB，4 张习惯框架卡 |

### 1.5 文件清单差异

**云端独有**：
```
AGENTS.md                    ← agent 唯一入口（含全部改动规范）
build/verify.py              ← 改动校验脚本，19项检查
supabase-schema.sql          打卡记录建表
writing_log.sql              我的例句建表
habits_schema.sql            习惯卡建表
daily_counter.sql            每日计数建表
```

**本地独有**（都是过时的历史文档，云端已删）：
```
README-腾讯多维表格.md
Supabase原理讲解.md
建站方法指南.md
README.md（旧版，与云端不同）
```

---

## 二、你要在云端改东西时，必须遵守的规范

完整版见云端的 `AGENTS.md`（**动手前先读那个文件**）。核心六条：

### 1. 只改 `D:\我的GitHub\check-in`，绝不碰本地副本

### 2. 改完必须升缓存号
改 `data.js` → `index.html` 里 `data.js?v=N` +1；`app.js`/`styles.css`/`habits.js` 同理。
用户需 `Ctrl/Cmd+Shift+R` 强刷才能看到。

> 只改 HTML 内容（如改标题文字）时**不需要**升缓存号。

### 3. `data.js` 绝不重编 id
打卡进度按 id 存 localStorage，改 id 会让用户的打卡记录丢失。
新条目用当前最大 id + 1 = **1920 起**（当前最大 id 1919）。

### 4. 解析 data.js 必须用正则，绝不手算偏移量

```python
import re, json
src = open(r"D:\我的GitHub\check-in\data.js", encoding="utf-8").read()
m = re.search(r"window\.VOCAB=(\[.*\]);\nwindow\.CATEGORIES", src, re.S)
assert m, "未找到 VOCAB 数组"
arr = json.loads(m.group(1))      # 先确认能解析，再动
```

> **血泪教训**：`window.VOCAB=[` 是 **14 个字符**（`window.VOCAB=` 13 + `[` 1）。用 `+12` 会把定位点落在 `=` 上，切片变成 `=[{...}]`，JSON永远解析失败，进而**误判"文件坏了"**——历史上因此白翻一整轮 git 历史。写回时用 `m.start(1)` / `m.end(1)`。

`data.js` 必须保持**四行**结构：
```
/* build: <ISO时间戳> */
window.VOCAB=[...];
window.CATEGORIES=[...];
window.TOPICS=[...];
```
JSON 紧凑无空格、LF 换行（裸 LF 恰为 4行）、结尾必须是 `];\nwindow.CATEGORIES`。

### 5. 改分类标签必须逐条读释义判断，禁止关键词批量打标签

用户原话："**你不能瞎分类**"。已因此出过两次事故：
- 把形容词/副词塞进「灵活动词」（迅速/全方位/过度/难以…）
- 把整句碎片当词条分类（体重达300斤/确切的体重数值…）

**判断不了的一律丢「❓ 待定」分类，不要硬塞。**

改标签前跑一遍自查：
```bash
python -c "
import re,json
src=open(r'D:\我的GitHub\check-in\data.js',encoding='utf-8').read()
arr=json.loads(re.search(r'window\.VOCAB=(\[.*\]);\nwindow\.CATEGORIES',src,re.S).group(1))
for w in sorted(arr,key=lambda x:x['id']):
    print(w['use'][0],'|',w['word'][:20],'|',(w.get('mean') or '')[:40])
"
```

### 6. 改完必跑校验脚本

```bash
cd D:\我的GitHub\check-in
"C:\Users\Lenovo\.workbuddy\binaries\python\versions\3.13.12\python.exe" build/verify.py --expect 1398
```

`--expect N` 断言改动后的条目总数。**退出码非 0 就是没改对**，别带着红灯提交。

### 7. 发布用 git 安全序列

```bash
cd D:\我的GitHub\check-in
git add data.js index.html        # 只 add 本次真正改的文件
git commit -m "feat(vocab): ..."
git fetch origin
git merge FETCH_HEAD --no-edit
git push
```

**不用 `git rebase`、`git push --force`、`--no-verify`。**

---

## 三、新增词条模板（照抄）

```python
import re, json, datetime
P = r"D:\我的GitHub\check-in\data.js"
src = open(P, encoding="utf-8").read()
m = re.search(r"window\.VOCAB=(\[.*\]);\nwindow\.CATEGORIES", src, re.S)
arr = json.loads(m.group(1))
base = len(arr)
max_id = max(w["id"] for w in arr)

arr.append({
  "id": max_id + 1,
  "tab": "vocab",           # vocab/phr/met/quote/humor/cases/rule/diff
  "tier": "进阶",            # 核心 / 进阶 / 备用
  "use": ["🎯 立论判断"],           # [主归属, ...场景索引]
  "cat": "01-观点与论述",           # 留档用，前端不依赖
  "word": "新词",
  "syn": "近义1、近义2",
  "mean": "释义……",
  "example": "完整示范句……",
  "scene": "使用场景说明……",
})

ts = datetime.datetime.now().strftime("%Y-%m-%dT%H:%M:%S.%f")
out = re.sub(r"/\* build: [^*]* \*/", "/* build: %s */" % ts, src, count=1)
out = out[:m.start(1)] + json.dumps(arr, ensure_ascii=False, separators=(",", ":")) + src[m.end(1):]
open(P, "w", encoding="utf-8").write(out)
```

改 `CATEGORIES` 用：`window\.CATEGORIES=(\[.*?\]);\nwindow\.TOPICS`

---

## 四、字段说明

### VOCAB 条目 10 字段（键序固定）

| 字段 | 说明 |
|---|---|
| `id` | 整数，全局唯一，**永不重编** |
| `tab` | `vocab`(751) `met`(248) `quote`(165) `phr`(149) `humor`(30) `diff`(44) `cases`(9) `rule`(2) |
| `tier` | `核心`(479) / `进阶`(688) / `备用`(231)，按重要程度非掌握程度 |
| `use` | 数组，`use[0]`=主归属、`use[1:]`=场景索引 |
| `cat` | 留档用旧分类串（如 `01-观点与论述`），前端已不依赖 |
| `word` | 词条本体。vocab=词；phr=带占位符模板（`……`/`XX`/`A B`）；quote/met=原话 |
| `syn` | 同义/近似表达，可附「（同类：X、Y）」互链标注 |
| `mean` | 释义 |
| `example` | 完整示范句（无空位）或原话 |
| `scene` | 使用场景说明 |

### localStorage 键（改名 = 丢用户数据）

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
- 表未建时功能降级为纯本地，不报错。

---

## 五、历史事故清单（别重蹈）

| 现象 | 真相 | 解法 |
|---|---|---|
| `json.loads` 报 `Extra data` / `Expecting value` | 自己切片偏移算错，**不是文件坏** | 用正则定位，不手算偏移 |
| 误以为"文件坏了"去翻 git 历史回滚 | 文件本来完好，越修越乱 | 先跑正则确认能解析 |
| 改完线上没变化 | 改的是本地旧副本 vocab-checkin | 改 `D:\我的GitHub\check-in` |
| 强刷后仍没变化 | 漏升缓存号 | 升对应 `?v=` |
| 详情页看不到是哪个词 | 缺标题区 | 检查 `.d-head` 是否渲染 |
| 盲区/用途维度点开为空 | 用途天然跨形式，不能落单 tab | 跨形式入口走「取用台」，勿写死 `currentTab='vocab'` |
| 例句加粗没生效 | 加粗只做在某处渲染点 | 确认覆盖用户所指的那一处 |
| 分类打完用户说"瞎分类" | 关键词批量打标签，没读释义 | 逐条读释义，拿不准入「❓ 待定」 |
| 改完条目数莫名变化 | 写回时切片边界算错 | 跑 `build/verify.py` |
| 加两条词花了很久还差点弄坏文件 | 自己写正则重建整个文件，边界反复出错 | git 回滚 + 一步追加，别重建 |

---

## 六、当前状态快照（2026-10-12）

```
条目总数      1398
最大 id       1919（新条目从 1920 起编）
CATEGORIES    20 个
TOPICS        11 个
缓存号        data.js?v=25  app.js?v=24  styles.css?v=22  habits.js?v=20
线上地址      https://huanghua-2019.github.io/check-in/
git 仓库      git@github.com:huanghua-2019/check-in.git（分支 main）
主归属分布    🎯立论判断176  📐概念指代117  🗣️灵活动词115  🔗论证推理105
              ✍️写作技法114  🔍洞察本质111  💰投资决策95   ⚠️警示风险92
              🖋️描写刻画80   🏗️管理组织42   👥人性心理59   🌿人生修养50
              ↔️副词连词51    😂幽默调侃56   🔤精准形容词52  ⚖️对比转折14
              🏆竞争格局31    📊举证说明23   💡打比方0      ❓待定15
```

> 已知遗留：`💡 打比方` 主归属为 0 条（全部被当索引用），不影响筛选但作为主分类是空的。

---

## 七、待办（可选，看你要不要做）

1. **98 条概念指代词补场景索引**——目前只有主归属没场景索引（如护城河→竞争格局、决策树→投资决策）
2. **`💡 打比方` 主归属归零**——是扶正成主分类，还是让它只做索引
3. **16 条释义是同义改写、信息量为零**——如「无限」的释义写「无限」、「亮眼」写「亮眼、出色」，需补写
4. **`build/` 目录清理**——堆了 60+ 历史脚本（含禁用的 `sync.py`），建议归档到 `build/archive/` 并加 README 说明，避免误碰

---

## 八、一句话总结

**云端 `D:\我的GitHub\check-in` 是唯一真源（1398 条、10 字段、20 个两轴分类、11 个主题包）；本地 `vocab-checkin` 是 7 月的老副本（1232 条、8 字段、46 个扁平分类），结构不兼容，只作参考、一律不改。**
