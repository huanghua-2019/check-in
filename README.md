# 高频词汇打卡 · 网页 App

把《002-高频词汇库》的 686 个词条做成可打卡的网页：用一次点一下 `+1`，自动记次数与最近使用时间，支持按分类/掌握度筛选、搜索、展开看同义词与例句。手机/电脑打开同一链接即可同步。

## 文件说明
- `index.html` — 页面入口
- `styles.css` — 手机优先样式
- `app.js` — 打卡逻辑 + 本地存储 + Supabase 云同步
- `vocab.js` — 由词汇库解析生成的 686 词条数据（`window.VOCAB`）
- `supabase-schema.sql` — 云同步建表脚本
- `build/parse.py` — 从 Obsidian md 重新生成 `vocab.js` 的脚本（源数据更新时用）

## 用法
**方式一：纯本地（零配置）**
直接双击 `index.html` 用浏览器打开即可。打卡记录存在本机浏览器（localStorage），换设备不互通。

**方式二：多设备同步（推荐，需一个免费 Supabase 账号）**
1. 注册免费 Supabase：https://supabase.com （邮箱即可）。
2. 新建一个 Project，等待就绪。
3. 左侧 **SQL Editor** → New query → 粘贴 `supabase-schema.sql` 全部内容 → **Run**。
4. 左侧 **Project Settings → API**，复制：
   - `Project URL`（形如 `https://xxxx.supabase.co`）
   - `anon public` 密钥（Project API keys 里）
5. 打开本 App → 右上角 ⚙ → 粘贴 URL 与 anon key → **保存并连接**。
   状态显示“连接成功”即完成。之后手机、电脑打开同一链接，打卡会自动合并同步。

> 同步规则：每条词以“最近使用时间”为准（后操作的胜出）。正常单人不冲突；
> 若同一词在两台设备离线各打一次、再联网，会以较晚那次为准（少计 1 次），属可接受范围。

**方式三：手动备份/迁移**
设置面板里可用「导出 JSON / 导入 JSON」把打卡记录拷到另一台设备。

## 部署到手机可访问
- 用 WorkBuddy 的 CloudStudio 部署：把本目录作为静态站点部署，得到公网链接，手机浏览器直接打开。
- 或任意静态托管（GitHub Pages / Vercel / 宝塔）上传本目录即可。

## 重新生成词汇数据
若源 md 有更新，运行：
```
python build/parse.py
```
会重新生成 `vocab.js`（全局 id 顺序可能变化，旧打卡记录按 id 对应，建议更新前先导出备份）。

## 字段对应关系
源表 5 列 → 卡片展开内容：
高级表达 / 口语化同义词 / 释义（使用说明） / 例句 / 使用场景。
打卡专属字段：打卡次数、首次使用、最近使用、掌握度（未用→偶尔→熟练）。
