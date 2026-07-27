# 通用打卡网页 App · 从 0 到 1 完整手册

> 一个手机优先的纯静态网页，把三类「用一次 / 做一次就打一次卡」的行为统一管起来：**✍️ 写作**（高频词汇库）+ **🌙 早睡**（记入睡时间）+ **💡 方法**（巴菲特阅读 / 徐新研究，自定义字段）。多设备自动同步，部署在 GitHub Pages。
>
> 成品地址：https://huanghua-2019.github.io/check-in/
> 适用：想自己搭同类网页的人，或以后要维护本项目的人。

---

## 一、先搞懂原理（读一遍，后面步骤就好懂）

动手前先建立心智模型。整套系统由**三个零件**组成：

| 零件 | 角色 | 存什么 | 打比方 |
|------|------|--------|--------|
| 词汇笔记（Obsidian 源 md） | 原材料，不动 | 1232 个词 + 意思 + 例句 | 菜谱原本 |
| 打卡网页（GitHub Pages） | 你点着玩的界面 | 网页画面本身 | 厨房 |
| 云端账本（Supabase） | 记「每个词打了几次」 | 次数、时间、掌握度 | 记账本子 |

**一句话**：笔记是菜谱 → 网页是厨房 → 云端是本子。

### 1.1 数据存在哪：双层存储
网页有一份存在「你这台手机浏览器」里的小记事本（`localStorage`），没网也能打卡，但换设备 / 清缓存 / 换浏览器就看不到。所以再加 Supabase 当「第二层、网上的本子」做跨设备同步：
- **第一层 localStorage**：秒开、没网也能用；
- **第二层 Supabase**：跨设备同步、不怕清缓存。
> Supabase 不可达时，网页自动回退 localStorage，不白屏。

### 1.2 云端那张表长什么样
`checkin` 表一行对应一个词，5 个格子：

| 字段 | 记什么 | 例子 |
|------|--------|------|
| `id` | 词的编号（永不变） | `5` |
| `count` | 打卡次数（起 0） | `3` |
| `first_used` | 首次打卡时间 | `2026-07-22 09:10` |
| `last_used` | 最近打卡时间 | `2026-07-22 21:30` |
| `mastery` | 掌握度（未用/偶尔/熟练） | `偶尔` |

> 词本身的文字不在这张表里，打包在网页 `data.js` 中。云端表只记「状态」，所以本子很薄、同步很快。

### 1.3 点一下打卡，背后发生了什么
1. 你点某个词（如「博大精深」）→ 网页知道它是第 5 号；
2. 网页向云端发话：「第 5 行次数 +1，最近使用写成现在」；
3. 云端写入 → 你或另一台设备刷新 → 网页拉回整本子 → 显示数字和绿点。
> 打开页面时，浏览器先拿本机数据秒开，再偷偷从云端拉最新覆盖。所以**没网也能打卡**，有网自动补。

### 1.4 为什么手机电脑是同一份
因为它们打开**同一个网页**、翻**同一个云端本子**：手机把第 5 行改成 3 → 写进云端；电脑刷新 → 拿到 3。**同步本质 = 大家都翻同一本云本子，不是两台设备互抄。** 所以不用导、不用手动传。

### 1.5 术语翻译表
| 技术词 | 大白话 |
|--------|--------|
| 前端 / 网页 | 你点着玩的那个界面 |
| GitHub Pages | 把网页挂到网上、给链接（常驻免费） |
| Supabase | 网上的共享本子（数据库） |
| localStorage | 浏览器自己的小记事本（换手机看不到） |
| RLS 策略 | 本子的门禁：谁能翻、谁能写 |
| publishable key | 打开本子的公开钥匙（写进网页很正常） |
| anon | 不登录的陌生人 |
| last-write-wins | 后写的覆盖先写的 |

### 1.6 一个要知道的小毛病
同步规则是「**后写的覆盖先写的**」：同一个词若在两台设备都断网各打一次再联网，可能只算 1 次。单人正常用基本碰不到，严丝合缝累加对个人打卡是杀鸡用牛刀。

---

## 二、从零搭建（按时间顺序）

### 阶段一：先做「写作打卡」能用的版本

**步骤 1 · 技术选型**
- **做什么**：用「纯 HTML/CSS/JS + 一份数据文件」，不引框架、不写后端；配色米色 `#f5f0e6` + 金棕 `#b8861b`，导航放左侧。
- **为什么**：个人单用户、千级数据，框架的构建成本不划算；纯静态任意托管商上传即用、迁移零成本。浅色护眼底长期不刺眼（用户明确讨厌深色底）；左侧栏是用户习惯。

**步骤 2 · 把 Obsidian 素材变成网页数据**
- **做什么**：用 Python 解析体系把 9 个 md 源文件统一生成 `data.js`（`window.VOCAB` + `window.CATEGORIES`）。核心文件：`build/sources.json`（词库登记簿）、`build/sync.py`（统一入口：解析→分配稳定 id→生成→版本号+1）、`build/id_registry.json`（id 永久映射）、各类型底层 parser。
- **为什么**：素材在 Obsidian 持续更新，必须「源文件是唯一真相」，网页数据一键重生、不能手改。
- **⚠️ id 不可变**：云端记录按 `id` 关联词条，id 一旦分配永不改，否则老记录对应错词（详见 3.3 风险③）。`id_registry.json` 锁死映射，`sync.py` 还会拉取云端有记录的 id 强制保留。
- 用户决定：`001/008/009` 三个导航/方法论文件**永久不上线**；其余 6 个已上线。

**步骤 3 · 写前端三件套**（index.html / styles.css / app.js）
- **做什么**：左侧栏 7 子标签 + 顶部统计 + 搜索筛选 + 卡片列表 + 设置弹层；`app.js` 管打卡/渲染/分类 Tab/同步。7 个子标签用分类名 emoji 前缀判定（💎金句 / 🎨比喻 / 📖规则 / 其他 emoji 句式 / 无 emoji 词汇）。
- **为什么（含坑）**：分类靠 emoji 前缀，但 **JS 正则处理 emoji 必须加 `u` flag**，漏写会让句式被误判为词汇。已固化：`/^[💎🎨📖]/u.test(c)`。

**步骤 4 · 先接本地存储**
- **做什么**：打卡记录先存 `localStorage`，双击 `index.html` 即用，换设备不互通。
- **为什么**：先让单机零配置可用，多端同步后面再加（原理见 1.1）。

**步骤 5 · 接 Supabase 做多端同步**
- **做什么**：同一 Supabase 项目建两张表（SQL 见下），把记录从本机提到云端，凭据写死进 `app.js`。
```
Supabase URL:    https://buzfmugezbemyfdmbgyt.supabase.co
Publishable Key: sb_publishable_HvD6YPPY-RpHLRicuoobSw_aSw1B_Ow
```
- `supabase-schema.sql`（词汇计数表）：
```sql
create table if not exists checkin (
  id integer primary key,
  count integer not null default 0,
  first_used timestamptz, last_used timestamptz,
  mastery text not null default '未用'
);
alter table checkin enable row level security;
drop policy if exists "anon_all" on checkin;
create policy "anon_all" on checkin for all to anon using (true) with check (true);
```
- `daily_counter.sql`（每日趋势表）：
```sql
create table if not exists daily_counter (
  day text primary key, n integer not null default 0
);
alter table daily_counter enable row level security;
drop policy if exists "anon_all" on daily_counter;
create policy "anon_all" on daily_counter for all to anon using (true) with check (true);
```
- **为什么**：要「多端维护」必须有云端；Supabase 免费、REST API 纯前端直连免后端。`anon_all` 策略因表里只存计数、不含敏感信息，对个人单用户可接受。`create table if not exists` 保证反复执行零覆盖。

**步骤 6 · 部署上线**
- **做什么**：先试 CloudStudio 连续 400/500（沙盒配额/起不来）放弃 → 改 GitHub Pages：本地建仓库 push 到 `git@github.com:huanghua-2019/check-in.git` → 仓库 Settings → Pages → 选 `main`/(root) → `curl` 验证 200。
- **为什么**：CloudStudio 沙盒会休眠、额度有限且当时故障；GitHub Pages 常驻免费、与代码同源，push 即生效。

### 阶段二：扩展成「通用打卡」（早睡 / 方法）

**步骤 7 · 设计通用打卡数据模型**
- **做什么**：把早睡/巴菲特/徐新抽象成「习惯定义表 + 打卡记录表」。`habits_schema.sql`：
```sql
create table if not exists habits (
  id serial primary key, key text unique,
  name text not null, icon text, color text,
  type text default 'toggle', fields jsonb, target text,
  sort int default 0, created_at timestamptz default now()
);
create table if not exists checkins (
  id serial primary key, habit_id int references habits(id) on delete cascade,
  ts timestamptz default now(), value jsonb, created_at timestamptz default now()
);
alter table habits enable row level security;
alter table checkins enable row level security;
drop policy if exists "anon_all" on habits;
create policy "anon_all" on habits for all to anon using (true) with check (true);
drop policy if exists "anon_all" on checkins;
create policy "anon_all" on checkins for all to anon using (true) with check (true);
```
- **为什么**：三类结构不同，但本质都是「一个习惯 + 多次打卡」。用 `habits` 定义习惯（含 `fields` 自定义字段数组），`checkins` 存每次答案（jsonb）。**加新习惯只插 `habits` 一行，前端按 `fields` 自动渲染表单，不用改代码**。仍落在同一 Supabase 项目，与 `checkin`/`daily_counter` 并列共存、不覆盖。

**步骤 8 · 三层大标签集成，不覆盖写作**
- **做什么**：`index.html` 顶部加 `✍️写作 / 🌙早睡 / 💡方法` 三个大标签，原写作模块整体包进第一个，新增两模块由 `habits.js` 驱动。写作放第一，原数据/逻辑不动。
- **为什么**：用户要「各种打卡」通用软件，又不想覆盖已用起来的写作打卡。新加一类 = 加大标签 + `habits` 插一行，互不干扰。

**步骤 9 · 本地预览确认**
- **做什么**：先本地 `python -m http.server` 预览三标签组合，确认「写作第一、早睡/方法表单正常」再部署；预览期 `habits.js` 走 localStorage 版。
- **为什么**：部署前先肉眼验收，避免上公网才发现布局/逻辑问题再回滚。

**步骤 10 · habits 模块接云端**
- **做什么**：写 `habits_schema.sql`（步骤 7），把 `habits.js` 改为 Supabase 优先版（URL/KEY 写死，空表自动 seed sleep/buffett/xu 三条，检测不到云端回退 localStorage 提示「本地模式」），`index.html` 升到 `habits.js?v=3`。
- **为什么**：用户跑一次建表（幂等、零覆盖 `checkin` 的 57 条老记录），之后早睡/方法写 `checkins` 表即多端同步。降级保证表没建/断网时页面照常可用。

**步骤 11 · 修复 seed 失败（PGRST102）**
- **做什么**：刷新后 `habits` 仍空。根因：`habits.js` 批量 POST 三条时**字段键不一致**（sleep 有 `target`，buffett/xu 无）→ Supabase 报 `PGRST102 All object keys must match` → 回退本地。修复：①Python heredoc 直接 seed（补齐 `target:null`）成功；②改 `habits.js` 给 buffett/xu 补 `target:null`，升 `v=3` 推送。
- **为什么（经验）**：PostgREST 批量 insert 要求所有行键完全一致；命令行拼 JSON+emoji 易被 shell 破坏，改用 `python - <<'PY'` heredoc 最稳。

**步骤 12 · 强刷验证收尾**
- **做什么**：强刷公网链接（Ctrl/Cmd+Shift+R），前端检测到 `habits` 已有 3 条 → 切云端模式；复检 `checkin` 仍 57 条 = 零覆盖铁证。
- **为什么**：版本号 `?v=N` 变了浏览器有缓存，必须强刷才拉新。

---

## 三、容量限制、风险与运维

### 3.1 四层限制总览
| 层 | 角色 | 关键约束 |
|----|------|---------|
| ① `data.js` | 首屏必须下载 | **实际瓶颈**，~337KB / 1232 条，建议 ≤ 1MB |
| ② GitHub Pages | 挂网页给链接 | 常驻免费、不休眠 |
| ③ Supabase | 多端同步本子 | 500MB 库 / 5GB 带宽月 / **7 天无活动暂停** |
| ④ localStorage | 单机临时本子 | ~5MB/域名，约 50000 条 |

### 3.2 逐层详解
- **① data.js**：1MB 约容 3500 条，超 1MB 手机 4G 会白屏 1~3 秒；当前约 2~3 年才到上限，届时按 Tab 拆分。
- **② GitHub Pages**：纯静态托管，所有计数/掌握度逻辑在浏览器 JS 跑，无后端。
- **③ Supabase 免费额度**：500MB 库、5GB 月带宽、5 万 MAU——你都用不到 1%，唯一要防的是 7 天暂停。
- **④ localStorage**：每域名 ~5MB，每天打 20 条连续 6 年才满，完全不用担心。

### 3.3 三个关键风险
1. 🔴 **7 天自动暂停（最危险）**：免费项目连续 7 天无 API 调用会自动暂停，云端同步失效，需控制台手动恢复。**对策：每周至少打开一次打卡页点几下**；或升 Pro（$25/月）永不暂停。
2. **无自动备份**：免费版不自动备份，误删/ `drop table` 无法恢复。**对策**：`supabase db dump --db-url postgresql://postgres:[密码]@db.[ref].supabase.co:5432/postgres > backup.sql` 手动导出。
3. **id 不可变**：打卡数据按 `id` 关联词条，id 一旦分配永不能改/重排，追加新词只能从 `max(id)+1` 起。重排会让云端记录对应错词。

### 3.4 容量增长预测
| 时间 | 词条数 | data.js | 状态 |
|------|--------|---------|------|
| 现在 | 1,232 | ~337KB | ✅ 健康 |
| +2 年 | ~3,000 | ~860KB | ✅ 健康 |
| +5 年 | ~6,000 | ~1.7MB | ⚠️ 需优化 |
| 极限 | ~12,000 | ~3.5MB | 🔴 加载慢 |

### 3.5 运维清单
- **每周**：打开一次打卡页（防 7 天暂停）；浏览各 Tab 确认正常。
- **每次更新词库后**：新分类 emoji 前缀匹配规则一致；`app.js` emoji 正则都加 `u`；`index.html` 版本号 `?v=N` 已递增；push 后 curl 验证新数据生效。
- **永不执行**：❌ 重排词条 id；❌ 直接改 `checkin` 表结构；❌ 改已分配 id。

### 3.6 故障排查
| 现象 | 原因 | 解决 |
|------|------|------|
| 数据不同步到其他设备 | Supabase 被暂停（7 天无活动） | 控制台手动恢复 + 每周打开一次 |
| 句式跑到词汇 Tab | 正则缺 `u` flag | 给 emoji 正则加 `u` |
| 更新后还是旧内容 | 浏览器缓存旧 data.js | 改 `?v=N` + 强刷 |
| 手机加载慢白屏久 | data.js 超 1MB | 按 Tab 拆分 |

---

## 四、踩过的坑（关键教训）

| 坑 | 现象 | 解决 |
|----|------|------|
| emoji 正则漏 `u` flag | 句式 Tab 只剩 2 个分类 | 所有 emoji 正则加 `/u` |
| 批量 insert 键不一致 | `PGRST102`，seed 整批失败 | 所有行字段键对齐（补 `target:null`） |
| 浏览器顽固缓存 | 改了 JS 页面无变化 | script 加 `?v=N` 并递增 + 强刷 |
| CloudStudio 部署 400/500 | 公网链接起不来 | 改用 GitHub Pages |
| git rebase 损坏 `.git` | `not a git repository` | 只用 `commit → fetch → merge`，禁 rebase/stash |
| id 重排 | 云端记录对应错词 | id 永不变，只从 max+1 追加 |

---

## 五、文件地图与命令速查

### 5.1 文件地图
| 文件 | 作用 | 改的频率 |
|------|------|---------|
| `index.html` | 入口，三大标签 + 设置弹层 | 极少 |
| `styles.css` | 护眼样式 | 极少 |
| `app.js`（?v=14） | 写作打卡逻辑 + 同步 | 更词库后 bump 版本 |
| `data.js`（?v=7） | 1232 条词条 | 每次新增必改 |
| `habits.js`（?v=3） | 早睡/方法打卡，云端优先 + 降级 | 改习惯时 |
| `supabase-schema.sql` | `checkin` 建表（首次） | 不改 |
| `daily_counter.sql` | `daily_counter` 建表（首次） | 不改 |
| `habits_schema.sql` | `habits`+`checkins` 建表（首次） | 不改 |
| `build/sync.py` | 统一同步入口 | 词库更新时用 |
| `build/sources.json` | 词库登记簿 | 新增词库时 |
| `build/id_registry.json` | id 永久映射 | 自动维护 |

### 5.2 命令速查
```bash
# 更新词库（Obsidian 改了源 md 后）
cd D:\我的GitHub\check-in
python build/sync.py
# 然后改 index.html 里 data.js 的 ?v=N +1，再 commit + push

# 推送到 GitHub Pages（用 merge，不用 rebase）
cd D:\我的GitHub\check-in
git add -A
git -c user.name=huanghua-2019 -c user.email=huanghua-2019@users.noreply.github.com commit -m "说明"
git fetch origin
git merge FETCH_HEAD --no-edit
GIT_SSH_COMMAND="ssh -o StrictHostKeyChecking=no -i ~/.ssh/id_ed25519" git push origin main

# 本地预览
cd D:\我的GitHub\check-in
python -m http.server 8090   # 开 http://127.0.0.1:8090
```

---

**公网地址**：https://huanghua-2019.github.io/check-in/
**Supabase 项目**：`buzfmugezbemyfdmbgyt`（4 张表：checkin / daily_counter / habits / checkins）
