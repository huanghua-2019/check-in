# 通用打卡网页 App —— 从 0 到 1 完整搭建记录

> 这是一份**按时间顺序**的搭建手册：假设今天你从零开始，跟着做就能复现当前这个「写作 / 早睡 / 方法」三合一打卡网页。
> 每一步都写清楚**做了什么、为什么这样做**。当前成品：https://huanghua-2019.github.io/check-in/
>
> 适用人群：想自己搭一个同类打卡网页的人，或以后要维护 / 扩展本项目的人。

---

## 现在做成什么样（先给结果）

| 模块 | 内容 |
|------|------|
| ✍️ 写作 | 1232 条词汇素材，7 个子标签（词汇/句式/金句/比喻/规则/案例/幽默），点击 `+1` 打卡，记次数+掌握度 |
| 🌙 早睡 | 记入睡时间，目标 23:00，达标统计 |
| 💡 方法 | 巴菲特阅读手段 + 徐新研究手段，自定义字段打卡 |

- 纯静态网页（无框架、无后端），手机优先、护眼配色。
- 数据存 Supabase（一个项目 4 张表），多设备自动同步；Supabase 不可达时自动回退本机存储。
- 部署在 GitHub Pages，push 即生效。

---

# 阶段一：先做出「写作打卡」能用的版本

## 步骤 1：确定技术选型（纯静态 + 护眼 + 左侧栏）

**做什么**：决定用「纯 HTML/CSS/JS 三个文件 + 一份数据文件」做，不引入 React/Vue 等框架，不写后端。配色定为米色 `#f5f0e6` + 金棕 `#b8861b`，导航放左侧。

**为什么**：
- 个人单用户、数据量小（千级词条），框架带来的构建复杂度不划算；纯静态文件任意托管商上传即用，迁移零成本。
- 用户主要在手机阅读且明确讨厌深色底，浅色护眼底 + 金棕主色长期不刺眼。
- 用户习惯左侧导航，确认用「左侧 sidebar + 右侧 content」布局。

## 步骤 2：把 Obsidian 写作素材变成网页数据

**做什么**：素材源是 Obsidian 里的 9 个 md 文件（高频词汇库、金句、比喻、句式、案例、幽默等）。写一个 Python 解析体系，把它们统一生成前端数据 `data.js`（`window.VOCAB` + `window.CATEGORIES`）。

核心文件：
- `build/sources.json`：词库登记簿（每个源文件路径 + parser 类型 + 是否启用）。新增词库只加一行。
- `build/sync.py`：统一入口，一条命令解析全部源 → 分配稳定 id → 生成 `data.js` → 版本号 +1。
- `build/id_registry.json`：id 注册表（`key → id` 永久映射），保证重新解析后同一个词永远拿到同一个 id。
- `build/parse.py`、`make_phrases.py`、`make_metaphors_quotes.py`、`merge_phrases.py`：各类型的底层解析器，被 `sync.py` 调用。

**为什么**：
- 素材在 Obsidian 里持续更新，必须让「源文件是唯一真相」，网页数据一键重新生成，不能手改网页。
- **id 不可变**：云端打卡记录按 id 关联词条，id 一旦分配永远不改，否则老记录会对应到错词。所以专门用 `id_registry.json` 锁死映射，`sync.py` 还会拉取 Supabase 里有记录的 id 强制保留。

> 用户决定：`001-知识图谱总览`、`008-使用指南`、`009-要点总结方法` 三个文件是导航/方法论，**永久不上线**；其余 6 个已上线。

## 步骤 3：写前端三件套（index.html / styles.css / app.js）

**做什么**：
- `index.html`：左侧栏（7 个子标签）+ 顶部统计 + 搜索/筛选工具栏 + 卡片列表 + 设置弹层。
- `styles.css`：手机优先的护眼样式。
- `app.js`：打卡逻辑、渲染、分类 Tab、Supabase 同步。7 个子标签用分类名的 emoji 前缀判定（💎金句 / 🎨比喻 / 📖规则 / 其他 emoji 句式 / 无 emoji 词汇）。

**为什么（含一个关键坑）**：
- 分类靠 emoji 前缀识别，但 **JS 正则处理 emoji 必须加 `u` flag**。早期漏写导致 7 个句式分类被误判为词汇（句式 Tab 只剩 2 个）。教训已固化进代码：`/^[💎🎨📖]/u.test(c)`。

## 步骤 4：先接本地存储（localStorage）

**做什么**：打卡记录先存浏览器 `localStorage`，双击 `index.html` 就能用，换设备不互通。

**为什么**：第一步先让单机可用、零配置；多端同步是后面才加的，不影响基础体验。

## 步骤 5：接 Supabase 做多端同步

**做什么**：注册免费 Supabase，在同一项目里建两张表，把打卡记录从本机提到云端。

`supabase-schema.sql`（词汇打卡计数表）：
```sql
create table if not exists checkin (
  id          integer     primary key,
  count       integer     not null default 0,
  first_used  timestamptz,
  last_used   timestamptz,
  mastery     text        not null default '未用'
);
alter table checkin enable row level security;
drop policy if exists "anon_all" on checkin;
create policy "anon_all" on checkin for all to anon using (true) with check (true);
```

`daily_counter.sql`（每日趋势表）：
```sql
create table if not exists daily_counter (
  day text primary key,   -- 本地日期 YYYY-M-D
  n   integer not null default 0
);
alter table daily_counter enable row level security;
drop policy if exists "anon_all" on daily_counter;
create policy "anon_all" on daily_counter for all to anon using (true) with check (true);
```

凭据写死进 `app.js`（个人单用户、纯前端直连、免后端）：
```
Supabase URL:    https://buzfmugezbemyfdmbgyt.supabase.co
Publishable Key: sb_publishable_HvD6YPPY-RpHLRicuoobSw_aSw1B_Ow
```

**为什么**：
- 要「多端共同维护」就必须有云端；Supabase 免费、提供 REST API，纯前端用 `anon key` 直连即可，不用自己写服务器。
- `anon_all` RLS 策略：表里只存打卡计数，**不含敏感信息**，`anon key` 本就公开，放开读写对个人单用户可接受。
- `create table if not exists`：建表脚本可反复执行且零覆盖（后面加别的表也不会动它）。

## 步骤 6：部署上线

**做什么**：
1. 先试 CloudStudio 部署 —— 连续返回 400/500（免费沙盒配额耗尽、新沙盒起不来），放弃。
2. 改部署到 GitHub Pages：本地建仓库 → push 到 `git@github.com:huanghua-2019/check-in.git` → 仓库 Settings → Pages → 选 `main` / `(root)`。
3. 验证：`curl` 确认 https://huanghua-2019.github.io/check-in/ 返回 200 且含新版特征。

**为什么**：CloudStudio 沙盒会休眠、额度有限且工具当时故障；GitHub Pages 常驻、免费、与代码同源，push 即生效，维护链路最短。

---

# 阶段一补充：Supabase 原理白话（为什么能多端同步）

> 这一段用大白话讲清楚「点一下打卡」背后发生了什么，以及为什么手机和电脑看到的是同一份。看不懂术语就查最下面的翻译表。

## 整套东西由三个零件组成

| 零件 | 扮演的角色 | 存什么 | 打比方 |
|------|-----------|--------|--------|
| **词汇笔记**（源 md 文件） | 原材料，一直不动 | 1232 个词 + 意思 + 例句 | 菜谱原本 |
| **打卡网页**（GitHub Pages） | 你点着玩的界面 | 网页画面本身（不含记录） | 厨房（做菜的地方） |
| **云端账本**（Supabase） | 记「每个词打了几次」 | 次数、时间、掌握度 | 记账的本子 |

一句话串起来：**词汇笔记是菜谱 → 网页是厨房 → 云端账本是本子（记你做了几道菜）。**

## 那张「打卡表」长什么样（5 个格子）

云端账本里 `checkin` 表一行对应一个词，每行有 5 个格子：

| 格子（字段） | 记的东西 | 例子 |
|------|------|------|
| `id` | 词的编号（第几个词，永不变） | `5` |
| `count` | 你打卡的次数（开始是 0） | `3` |
| `first_used` | 第一次打卡的时间 | `2026-07-22 09:10` |
| `last_used` | 最近一次打卡的时间 | `2026-07-22 21:30` |
| `mastery` | 掌握程度（未用/偶尔/熟练） | `偶尔` |

> 词本身的文字（意思、例句）**不在这张表里**，它们打包在网页 `data.js` 里。云端表只记「打卡状态」——这样本子很薄、同步很快。

## 你点一下「打卡」，背后发生了什么

1. 你点网页上某个词（比如「博大精深」）。
2. 网页知道它是第 5 号。
3. 网页给云端账本发话：**「第 5 行次数 +1，最近使用写成现在。」**
4. 云端账本把新数字写进本子。
5. 你（或另一台设备）刷新 → 网页把整本子拉回来 → 把数字和绿点显示出来。

> 打开网页那一瞬间，浏览器先拿「上次存在本机的数据」秒开页面（快），再偷偷从云端拉最新状态覆盖（准）。所以**没网也能打卡**，有网后自动补上。

## 为什么手机和电脑看到的是同一份

因为手机和电脑打开的**是同一个网页**，网页翻的**是同一个云端本子**：

- 手机把第 5 行改成 `count=3` → 写进云端；
- 电脑一刷新 → 从云端拿到第 5 行的新值 `3`。

**同步的本质 = 大家都翻同一本云本子，而不是两台设备互相抄。** 所以你什么都不用导、不用手动传。

## 网页自己的「小记事本」（双层存储）

网页有一份存在「你这台手机浏览器」里的小记事本（`localStorage`），没网也能打卡。但它有天花板：

| 情况 | 只靠这个小记事本会怎样 |
|------|----------------------|
| 换手机 / 电脑 | 看不到另一台的数据 |
| 清了浏览器缓存 | 记录没了 |
| 同一台机换浏览器（Chrome→Safari） | 也看不到 |

所以才加了 Supabase 当「第二层、网上的本子」。现在两层配合：

- **第一层（手机自带小记事本）**：秒开、没网也能用；
- **第二层（Supabase 云端本子）**：跨设备同步、不怕清缓存。

一句话：**网页自己有个临时小本子（单机够用），但「换设备也不丢」靠的是云端那本。**

## 技术词大白话翻译表

| 技术词 | 大白话 |
|------|------|
| 网页 / 前端 | 你点着玩的那个屏幕界面 |
| GitHub Pages | 把网页挂到网上、给你链接的地方（常驻、免费） |
| Supabase | 网上的一个共享本子（数据库），记打卡次数 |
| 数据库 / 表 | 就是一张大表格，一行一个词 |
| localStorage | 你手机浏览器自己的小记事本（换手机看不到） |
| RLS 策略 | 本子的门禁：谁能翻、谁能写 |
| publishable key | 打开本子的公开钥匙（本来就能给人看，写进网页很正常） |
| anon（匿名） | 不登录的陌生人 |
| last-write-wins | 后写的覆盖先写的（见下节「小毛病」） |

## 一个要知道的小毛病

同步规则是「**后写的覆盖先写的**」：

- 如果同一个词，你在手机和电脑**都断网**各打了一次，再联网——可能只算 1 次（后一次盖掉前一次），不是 2 次。
- 一个人正常使用基本碰不到（你不会同时两台设备离线打同一个词）。真要严丝合缝地累加，得加复杂逻辑，对个人打卡是杀鸡用牛刀。

---

# 阶段二：扩展成「通用打卡」（早睡 / 方法）

## 步骤 7：设计通用打卡数据模型

**做什么**：用户要加「早睡打卡、巴菲特阅读手段、徐新研究手段」。抽象成一张「习惯定义表 + 一张打卡记录表」：

`habits_schema.sql`：
```sql
create table if not exists habits (
  id serial primary key,
  key text unique,          -- 业务稳定 ID：sleep / buffett / xu
  name text not null,
  icon text,
  color text,
  type text default 'toggle',
  fields jsonb,             -- 自定义字段数组
  target text,              -- timed 类型达标阈值，如 "23:00"
  sort int default 0,
  created_at timestamptz default now()
);
create table if not exists checkins (
  id serial primary key,
  habit_id int references habits(id) on delete cascade,
  ts timestamptz default now(),
  value jsonb,              -- 按 fields 的答案集合
  created_at timestamptz default now()
);
alter table habits enable row level security;
alter table checkins enable row level security;
drop policy if exists "anon_all" on habits;
create policy "anon_all" on habits for all to anon using (true) with check (true);
drop policy if exists "anon_all" on checkins;
create policy "anon_all" on checkins for all to anon using (true) with check (true);
```

**为什么**：
- 早睡、巴菲特、徐新结构各不相同，但本质都是「一个习惯 + 多次打卡」。用 `habits` 定义习惯（含 `fields` 自定义字段数组），`checkins` 存每次答案（jsonb）。**加一个新习惯只需在 `habits` 插一行**，前端按 `fields` 自动渲染表单，不用改代码。
- 同样落在**同一个 Supabase 项目**（`buzfmugezbemyfdmbgyt`），与 `checkin`/`daily_counter` 并列共存，不新建项目、不覆盖老数据。
- 自定义字段（`fields`）：让巴菲特（用了哪个阅读法/读了什么/页数/心得）、徐新（哪个研究手段/对象/关键结论）这种「带多个属性」的打卡也能通用表达。

## 步骤 8：三层大标签集成，不覆盖写作

**做什么**：在 `index.html` 顶部加三个大标签 `✍️写作 / 🌙早睡 / 💡方法`，把原写作模块整体包进第一个标签，新增两个模块由 `habits.js` 驱动。写作放第一，原有数据和逻辑原样保留。

**为什么**：用户要「各种打卡」通用软件，但不想覆盖已经用起来的写作打卡。做法是「外面套新标签、里面写作不动」，新增一类 = 加一个大标签 + 在 `habits` 插一行，互不干扰。

## 步骤 9：本地预览确认效果

**做什么**：先本地起 `python -m http.server` 预览三标签组合，用户确认「写作放第一、早睡/方法表单正常」后再部署。预览期 `habits.js` 先走 localStorage 版。

**为什么**：部署前先肉眼验收，避免直接上公网发现布局/逻辑问题再回滚。

## 步骤 10：把 habits 模块接上云端

**做什么**：写 `habits_schema.sql`（步骤 7），把 `habits.js` 从 localStorage 版改写为 Supabase 优先版（URL/KEY 写死，检测空表自动 seed 三条习惯 sleep/buffett/xu，检测不到云端时回退 localStorage 并提示「本地模式」）。`index.html` 引用升到 `habits.js?v=3`。

**为什么**：
- 用户去 Supabase SQL Editor 跑一次 `habits_schema.sql` 建表（幂等、零覆盖 `checkin` 的 57 条老记录），以后早睡/方法打卡写 `checkins` 表，多端同步达成。
- 降级逻辑保证：表没建 / 网络异常时页面照常可用、不白屏。

## 步骤 11：修复 seed 失败（PGRST102）

**做什么**：用户刷新后 `habits` 表仍空。排查发现 `habits.js` 批量 POST 三条 seed 时**字段键不一致**（sleep 有 `target`，buffett/xu 无）→ Supabase 报 `PGRST102 All object keys must match` → 前端 catch 回退本地、云端化失败。修复：①用 Python heredoc 直接 seed 三条（补齐 `target:null`）成功；②改 `habits.js` 给 buffett/xu 加 `target:null` 使 SEED 键一致，升 `v=3` 推送。

**为什么（关键经验）**：
- **PostgREST 批量 insert 要求所有行键完全一致**，否则整批拒绝。
- 在沙箱里用命令行拼 JSON + emoji 容易被 shell 破坏，改用 `python - <<'PY'` heredoc 最稳。

## 步骤 12：强刷验证，收尾

**做什么**：用户强刷公网链接（Ctrl/Cmd + Shift + R），前端检测到 `habits` 已有 3 条 → 切云端模式。复检 `checkin` 仍 57 条 = 零覆盖铁证。当前状态：词汇打卡 57 条 + 早睡/方法接云端，三套数据同项目共存。

**为什么**：强刷是因为浏览器对静态文件有缓存，版本号（`?v=N`）变了必须强制重新拉取，否则看到旧版。

---

# 附录 A：文件地图

| 文件 | 作用 | 修改频率 |
|------|------|---------|
| `index.html` | 页面入口，三大标签 + 设置弹层 | 极少 |
| `styles.css` | 手机优先护眼样式 | 极少 |
| `app.js`（?v=14） | 写作打卡逻辑 + Supabase 同步 | 更词库后 bump 版本 |
| `data.js`（?v=7） | 1232 条词条数据 | 每次新增内容必改 |
| `habits.js`（?v=3） | 早睡/方法打卡，Supabase 优先 + 降级 | 改习惯定义时 |
| `supabase-schema.sql` | `checkin` 建表（首次执行） | 不改 |
| `daily_counter.sql` | `daily_counter` 建表（首次执行） | 不改 |
| `habits_schema.sql` | `habits` + `checkins` 建表（首次执行） | 不改 |
| `build/sync.py` | 统一同步：解析源→分配 id→生成 data.js | 词库更新时用 |
| `build/sources.json` | 词库登记簿 | 新增词库时 |
| `build/id_registry.json` | id 注册表（永久映射） | 自动维护 |

# 附录 B：常用命令速查

```bash
# 1) 更新词库（Obsidian 改了源 md 后）
cd D:\我的GitHub\check-in
python build/sync.py
# 然后改 index.html 里 data.js 的 ?v=N +1，commit + push

# 2) 推送到 GitHub Pages（注意用 merge，不用 rebase）
cd D:\我的GitHub\check-in
git add -A
git -c user.name=huanghua-2019 -c user.email=huanghua-2019@users.noreply.github.com commit -m "说明"
git fetch origin
git merge FETCH_HEAD --no-edit
GIT_SSH_COMMAND="ssh -o StrictHostKeyChecking=no -i ~/.ssh/id_ed25519" git push origin main

# 3) 本地预览
cd D:\我的GitHub\check-in
python -m http.server 8090
# 浏览器开 http://127.0.0.1:8090
```

# 附录 C：踩过的坑（关键教训）

| 坑 | 现象 | 解决 |
|----|------|------|
| emoji 正则漏 `u` flag | 句式 Tab 只剩 2 个分类 | 所有 emoji 正则加 `/u` |
| 批量 insert 键不一致 | `PGRST102`，seed 整批失败 | 所有行字段键对齐（补 `target:null`） |
| 浏览器顽固缓存 | 改了 JS 页面无变化 | script 引用加 `?v=N` 并递增，用户强刷 |
| CloudStudio 部署 400/500 | 公网链接起不来 | 改用 GitHub Pages |
| git rebase 损坏 `.git` | `not a git repository` | 只用 `commit → fetch → merge`，禁 rebase/stash |
| id 重排 | 云端记录对应错词 | id 一旦分配永不变，只从 max+1 追加 |

---

# 附录 D：容量限制、风险与运维注意事项

> 汇总整个打卡系统的容量上限、计费边界和运维注意事项，覆盖：数据文件层 / 部署层 / Supabase 云端层 / localStorage 本地层。

## 四层限制总览

| 层 | 角色 | 关键约束 |
|----|------|---------|
| ① `data.js` 前端数据文件 | 页面加载必须完整下载 | **实际瓶颈**，当前 ~337KB / 1232 条，建议 ≤ 1MB |
| ② 部署层（GitHub Pages） | 挂网页、给链接 | 常驻免费、不休眠、无流量焦虑（静态站） |
| ③ Supabase 云端同步 | 多端同步的本子 | 500MB 库 / 5GB 带宽月 / **7 天无活动自动暂停** |
| ④ localStorage 本地缓存 | 单机临时本子 | ~5MB/域名，约 50000 条记录 |

## 逐层详解

### ① data.js（前端数据文件）
- 当前 ~337KB（1232 条），单条约 286 字节；1MB 约可容纳 3500 条，建议上限 **≤ 1MB**。
- 瓶颈原因：它是页面首屏必须完整下载的 JS。手机 4G 下超过 1MB 会明显白屏（1~3 秒）。
- 建议：以当前扩充速度（每次几十到几百条），约 2~3 年才到 1MB；届时按 Tab 拆分数据文件、按需加载。

### ② 部署层（GitHub Pages）
- 常驻运行、免费、与代码同源；push 即生效，链接固定。
- 没有沙盒休眠问题（不同于早期试过的 CloudStudio）。
- 纯静态托管，所有「打卡计数 / 掌握度」逻辑都在浏览器 JS 里跑，没有后端计算。

### ③ Supabase 云端同步
免费版额度与你的消耗：

| 维度 | 免费额度 | 你的消耗 | 风险 |
|------|---------|---------|------|
| 数据库存储 | 500 MB | < 1 MB | ✅ 永远打不到 |
| 带宽（月） | 5 GB | ~10 MB/月 | ✅ |
| 活跃用户 | 50000 MAU | 就你一人 | ✅ |
| 自动暂停 | **7 天无活动停机** | — | 🔴 最需留意 |

**🔴 三个关键风险**：
1. **7 天自动暂停（最危险）**：免费版项目连续 7 天无任何 API 调用会自动暂停，云端同步失效，需去控制台手动恢复。对策：每周至少打开一次打卡页点几下；或升 Pro（$25/月）永不暂停。
2. **无自动备份**：免费版不自动备份，`drop table` 或误删无法恢复。对策：用 Supabase CLI 手动导出：`supabase db dump --db-url postgresql://postgres:[密码]@db.[ref].supabase.co:5432/postgres > backup.sql`。
3. **id 不可变**：打卡数据通过 `id` 关联词条，id 一旦分配永不能改/重排，追加新词只能从 `max(id)+1` 起。重排会让云端记录对应错词。

### ④ localStorage（浏览器本地）
- 每域名上限 ~5MB，每条记录约 100 字节，可存约 50000 条；当前用量 < 1KB。
- 估算：每天打 20 条、连续 6 年才存满。完全不用担心。
- 注意：它是浏览器私有的，不同设备不自动同步——这正是要 Supabase 做跨设备同步的原因。

## 容量增长预测

| 时间点 | 词条数 | data.js 大小 | 状态 |
|-------|-------|-------------|------|
| 现在（2026-07） | 1,232 条 | ~337 KB | ✅ 健康 |
| +2 年正常扩充 | ~3,000 条 | ~860 KB | ✅ 健康 |
| +5 年大量扩充 | ~6,000 条 | ~1.7 MB | ⚠️ data.js 需优化 |
| 系统极限 | ~12,000 条 | ~3.5 MB | 🔴 data.js 加载慢 |

## 运维最佳实践清单

**每日 / 每周**
- [ ] 打开一次打卡页（防 Supabase 7 天暂停）
- [ ] 浏览各 Tab，确认分类和数据显示正常

**每次更新词库后**
- [ ] 新分类 emoji 前缀是否与 Tab 匹配规则一致
- [ ] `app.js` 所有 emoji 正则都加了 `u` flag
- [ ] `sync.py` 读的是正确的 JSON 源
- [ ] `index.html` 版本号 `?v=N` 已递增
- [ ] `data.js` 已覆盖为新版
- [ ] push 后 curl 验证新数据生效

**永不执行**
- ❌ 绝对不要重排词条 id（破坏云端打卡数据）
- ❌ 不要在 Supabase 直接改 `checkin` 表结构
- ❌ 不要修改已分配的 id（哪怕某词条不再需要）

## 故障排查速查表

| 现象 | 原因 | 解决 |
|------|------|------|
| 打卡数据不同步到其他设备 | Supabase 项目被暂停（7 天无活动） | 去控制台手动恢复，并每周打开一次 |
| 句式分类跑到词汇 Tab | `app.js` 正则缺 `u` flag | 给 emoji 正则加 `u` |
| 更新后页面还是旧内容 | 浏览器缓存了旧 data.js | 改 `?v=N` 版本号 + 强刷 |
| 手机加载慢、白屏久 | data.js 超过 1MB | 考虑按 Tab 拆分 |
| 云端同步完全失效 | 表被删 / 项目暂停 | 查 Supabase 控制台；必要时从备份恢复 |

## 升 Pro 的时机

当前免费版完全够用，**不需要付费**。只在以下情况考虑升 Pro（$25/月）：
1. 连续超过 7 天不打卡，又不想丢自动同步能力；
2. 担心数据安全，需要自动备份；
3. 词条超 5000 条导致 data.js 加载变慢（这是前端优化问题，不是 Supabase 问题）。

---

**当前公网地址**：https://huanghua-2019.github.io/check-in/
**Supabase 项目**：`buzfmugezbemyfdmbgyt`（4 张表：checkin / daily_counter / habits / checkins）
