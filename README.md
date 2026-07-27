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

**当前公网地址**：https://huanghua-2019.github.io/check-in/
**Supabase 项目**：`buzfmugezbemyfdmbgyt`（4 张表：checkin / daily_counter / habits / checkins）
