# 通用打卡 · 网页 App（写作 / 早睡 / 方法）

> 一个手机优先的纯静态网页，把三类「用一次 / 做一次就打一次卡」的行为统一管理：
> **✍️ 写作**（高频词汇库打卡）、**🌙 早睡**（记录入睡时间、23:00 前达标）、**💡 方法**（巴菲特阅读手段 + 徐新研究手段，自定义字段）。
> 手机 / 电脑打开同一个链接即可使用，打卡数据存云端、多设备自动同步。

**公网地址（GitHub Pages）**
https://huanghua-2019.github.io/check-in/

---

## 一、这个项目做了什么

### 1. 写作打卡（原「高频词汇打卡」）
把《002-高频词汇库》等素材做成可打卡的卡片：用一次点一下 `+1`，自动记次数、首次/最近使用时间、掌握度（未用 → 偶尔 → 熟练）。支持按分类 / 掌握度 / 状态筛选，按词、同义词、释义搜索，展开看同义词与例句。共 **1232 条**词条，分 7 个子标签（词汇 / 句式 / 金句 / 比喻 / 规则 / 案例 / 幽默）。

### 2. 早睡打卡
记录每天的入睡时间，目标 **23:00**，早于目标算达标，页面给出连续达标天数与历史记录。这是一个「计时型」习惯，结构与其他两类打卡完全一致。

### 3. 方法打卡
两套可自定义的「手段」打卡，字段由数据定义，不在前端写死：
- **巴菲特阅读手段**：用了哪个阅读法（每天 500 页 / 读年报 / 思维模型 / 主题阅读）、读了什么、页数、心得。
- **徐新研究手段**：用了哪个研究手段（消费者访谈 / 看赛道 / 长期持有研究 / 专家访谈）、访谈或研究对象、关键结论。

### 4. 数据层
所有打卡记录存进同一个 Supabase 项目（共 4 张表），手机和电脑打开同一链接自动同步；若 Supabase 不可达，自动回退本机浏览器存储，不崩。

---

## 二、为什么这样设计（每一步背后的原因）

下面逐条说明关键决策及其理由，方便以后维护时判断「能不能改、改了会怎样」。

### 决策 1：纯静态网页（HTML/CSS/JS），无框架、无构建步骤
- **原因**：手机优先、部署简单。任何静态托管（GitHub Pages）上传目录即可，不需要 Node 构建、不需要后端服务器。维护成本低，迁仓库零成本（后来从 CloudStudio 迁到 GitHub Pages 只改了一个链接）。
- **代价**：逻辑全在前端，复杂交互要手写；对个人单用户场景完全够用。

### 决策 2：手机优先 + 护眼配色（米色 `#f5f0e6` + 金棕 `#b8861b` + 近白卡片 `#fffdf8` + 深灰文字 `#1c1d22`）
- **原因**：用户主要在手机上阅读、且明确不喜欢深色 / 近黑底（「眼睛要瞎了」）。浅色护眼底长期阅读不刺眼，金棕主色与「知识库」气质一致。

### 决策 3：左侧垂直侧栏导航（而非顶部横排标签）
- **原因**：用户习惯左侧导航（原话「标签放到最左边」）。三层结构用「左侧 sidebar + 右侧 content」的 flex 布局，写作模块的 7 个子标签放在左侧栏，外层三大模块放在页面顶部大标签。

### 决策 4：三层大标签（写作 / 早睡 / 方法）
- **原因**：用户要的是「各种各样的打卡」通用软件，但又不想覆盖原来已经用起来的写作打卡。做法是保留写作模块原样放在第一个标签，外面再套两个新标签（早睡、方法）。新增一类打卡 = 加一个大标签 + 在 Supabase 加一行习惯定义，互不干扰。

### 决策 5：数据双层存储 —— Supabase 云端优先 + localStorage 降级
- **原因**：要「多端共同维护」，就必须有云端。Supabase 免费、提供 REST API，纯前端用 `anon key` 直连即可，无需自己写后端。
- **降级**：网络异常或表未建时，自动回退 localStorage，页面照常可用、不白屏。用户也可以完全不配 Supabase，当纯本地 App 用（设置弹层里 URL/key 留空即可）。

### 决策 6：单一 Supabase 项目、四张表共存
- **原因**：用户曾担心「会不会建出好几个项目」。实际上从一开始（daily_counter、checkin）到最后（habits、checkins）全部落在**同一个项目** `buzfmugezbemyfdmbgyt`，只是按业务分了 4 张表。好处是一个项目就能管全部打卡数据，不会有多项目维护负担。

| 表名 | 存什么 | 来源 |
|------|--------|------|
| `checkin` | 词汇打卡计数（id / count / first_used / last_used / mastery），57 条老数据 | 最早的写作打卡 |
| `daily_counter` | 每日打卡总次数（day / n），支撑「本周趋势」 | 趋势统计 |
| `habits` | 习惯定义（sleep / buffett / xu），含自定义字段 | 通用打卡模型 |
| `checkins` | 早睡 / 方法的打卡明细（habit_id / ts / value jsonb） | 通用打卡模型 |

### 决策 7：`create table if not exists` —— 幂等、零覆盖
- **原因**：建表 SQL 反复执行也安全。跑 `habits_schema.sql` 时**不会碰**已有的 `checkin`（57 条词汇记录）、`daily_counter` 表，只是新增两张表。这也是用户最担心的「覆盖老数据」问题的根本保障——执行前后复检 `checkin` 仍是 57 条即为铁证。

### 决策 8：通用打卡模型 = `habits` + `checkins` 两表 + `fields` jsonb
- **原因**：早睡、巴菲特、徐新结构各不相同，但本质是「一个习惯 + 多次打卡记录」。用一张 `habits` 定义习惯（名称、图标、类型、目标、自定义字段数组），一张 `checkins` 存每次打卡的答案集合（jsonb）。**加一个新习惯只需在 `habits` 插一行**，前端自动渲染表单，不用改代码。自定义字段（`fields`）让巴菲特 / 徐新这类「带多个属性」的打卡也能通用表达。

### 决策 9：`anon` 行级安全策略（RLS `to anon using(true) with check(true)`）
- **原因**：这是个人单用户、纯前端直连的场景，没有登录系统。`anon key` 本就公开，配合该策略即可让网页免登录读写。表中只存打卡计数与自定义字段，**不含任何敏感信息**，所以放开 anon 读写是可接受的。若以后要多人隔离，再引入登录与按用户隔离的策略即可。

### 决策 10：用 GitHub Pages 托管（而非 CloudStudio）
- **原因**：CloudStudio 沙盒会休眠、免费额度有限，且部署工具一度连续返回 400/500 起不来。GitHub Pages 常驻、免费、国内访问稳定（或经代理），且与代码仓库同源 —— 改动 push 后即生效，维护链路最短。链接固定为 `https://huanghua-2019.github.io/check-in/`。

### 决策 11：引用加 `?v=N` 版本号（当前 data.js?v=7 / app.js?v=14 / habits.js?v=3）
- **原因**：浏览器对静态文件有顽固缓存，改了 JS / 数据却不刷新会让人以为「没生效」。给 script 引用加版本号，文件内容变了就递增版本号，强制浏览器重新拉取。这是修过「打开链接无变化」问题后留下的标准做法。

### 决策 12：词条 `id` 不可变
- **原因**：云端打卡记录按 `id` 关联词条。一旦某词拿到 id=731，就永远不能改；否则云端记录会对应到错误的词。新增词条时 id 只能从 `max(id)+1` 递增，**绝不回退重排**。

### 决策 13：`build/id_registry.json` 稳定 id 注册表
- **原因**：词库从 Obsidian 源文件重新解析生成时，必须保证同一个词永远拿到同一个 id。`id_registry.json` 记录 `key → id` 的永久映射；`sync.py` 还会拉取 Supabase 里有打卡记录的 id 强制保留，确保更新词库后老进度绝不丢失。

---

## 三、文件说明

| 文件 | 作用 | 修改频率 |
|------|------|---------|
| `index.html` | 页面入口，含三大标签与设置弹层 | 极少（加新大标签时） |
| `styles.css` | 手机优先样式（米色 + 金棕护眼风） | 极少 |
| `app.js`（?v=14） | 写作打卡逻辑 + Supabase 同步 + 分类 Tab | 更新词库后要改版本号 |
| `data.js`（?v=7） | 1232 条词条数据（`window.VOCAB` / `window.CATEGORIES`） | 每次新增内容必改 |
| `habits.js`（?v=3） | 早睡 / 方法打卡逻辑，Supabase 优先 + localStorage 降级 | 改习惯定义 / 加新习惯时 |
| `supabase-schema.sql` | `checkin` 表建表脚本（仅首次执行） | 不改 |
| `daily_counter.sql` | `daily_counter` 表建表脚本（仅首次执行） | 不改 |
| `habits_schema.sql` | `habits` + `checkins` 表建表脚本（仅首次执行） | 不改 |
| `build/sync.py` | 统一同步：解析全部源 → 分配稳定 id → 生成 data.js → 版本号 +1 | 词库更新时用 |
| `build/sources.json` | 词库登记簿：每个源文件路径、parser 类型、是否启用 | 新增词库时 |
| `build/id_registry.json` | id 注册表（心脏）：`key → id` 永久映射 | 自动维护 |
| `build/parse.py`、`make_phrases.py`、`make_metaphors_quotes.py`、`merge_phrases.py` | 各素材类型的底层解析器，被 `sync.py` 调用 | 词库更新时用 |

---

## 四、用法

**打开即用**：手机 / 电脑浏览器访问 https://huanghua-2019.github.io/check-in/ （如显示旧版，强刷 Ctrl/Cmd + Shift + R）。

- **写作打卡**：顶部点「✍️ 写作」→ 左侧选子标签（词汇 / 句式 / 金句…）→ 搜词或按分类筛选 → 每条卡片点 `+1` 打卡。右上角 ⚙ 可导出 / 导入 JSON、清空本地记录。
- **早睡打卡**：顶部点「🌙 早睡」→ 填入睡时间 → 提交。早于 23:00 算达标，显示连续达标天数。
- **方法打卡**：顶部点「💡 方法」→ 选巴菲特 / 徐新 → 按自定义字段填表提交。

**多设备同步**：默认已接入 Supabase（凭据写在 `habits.js` / `app.js` 内）。若从零配置，在设置弹层粘贴项目 URL 与 `anon key` 即可；留空则仅本机本地保存。

---

## 五、Supabase 建表（只需执行一次）

在同一个 Supabase 项目（`buzfmugezbemyfdmbgyt`）的 **SQL Editor** 里，分别粘贴执行以下三个脚本，每个跑一次：

1. `supabase-schema.sql` → 建 `checkin` 表（词汇打卡）
2. `daily_counter.sql` → 建 `daily_counter` 表（每日趋势）
3. `habits_schema.sql` → 建 `habits` + `checkins` 表（通用打卡）

三者都用 `create table if not exists` + `anon_all` 策略，**对已有表零侵入、零覆盖**。执行完可在表浏览器确认：`checkin` 仍为 57 条（若之前已有词汇记录），新增的 `habits` / `checkins` 为空表，前端首次打开会自动写入 3 条习惯种子（sleep / buffett / xu）。

凭据（已写死进前端，无需手动填）：
```
Supabase URL:    https://buzfmugezbemyfdmbgyt.supabase.co
Publishable Key: sb_publishable_HvD6YPPY-RpHLRicuoobSw_aSw1B_Ow
```

---

## 六、词库更新流程（新增词汇 / 句式 / 金句等）

词库的唯一源头是 Obsidian 源 md 文件。更新后一条命令重新生成数据：

```
cd D:\我的GitHub\check-in
python build/sync.py
```

`sync.py` 会自动：解析全部启用的源 → 复用旧 id / 分配新 id → 生成 `data.js` → 版本号 +1 → 打印复用 / 新增报告 → 校验云端已有打卡记录全部保留。然后 push 到 GitHub 即生效。

> 改了 `data.js` / `app.js` / `habits.js` 后，记得把 `index.html` 里对应的 `?v=N` 版本号 +1，否则浏览器可能读缓存。

---

## 七、部署（GitHub Pages）

本仓库即 GitHub Pages 源。`main` 分支根目录的静态文件会被自动发布到
https://huanghua-2019.github.io/check-in/ 。

本地改完文件后：
```
git add -A
git commit -m "更新说明"
git fetch origin
git merge FETCH_HEAD --no-edit   # 用 merge，不用 rebase
git push origin main
```
push 成功后稍等几十秒，强刷页面即可看到更新。

---

## 八、已知限制 / 注意事项

- **同步冲突**：单人正常使用不冲突；若同一词在两台设备离线各打一次再联网，以「最近使用时间」较新者为准（少计 1 次），属可接受范围。
- **RLS 放开 anon**：当前为个人单用户、纯前端场景，表内不含敏感信息。若要多人共用或放敏感数据，需引入登录与按用户隔离的策略。
- **iOS 不支持振动**：打卡时的 `navigator.vibrate` 已用 try/catch 包裹，iOS Safari 不会报错。
- **CloudStudio 已弃用**：本项目不再使用 CloudStudio 部署，相关旧文档（如 `建站方法指南.md` 中仍写 CloudStudio）以本 README 为准。
