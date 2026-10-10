# AGENTS.md

> **这是 AI coding agent 的入口文件。** 改本仓库任何代码前，先读完本文件。
> 人类向的搭建教程见 `README.md`；改动规范与事故清单见 `agent.md`（本文件的详细版）。

---

## 30秒速览

| 项 | 值 |
|---|---|
| 项目 | 写作词库打卡单页应用（1398 条词/句式/隐喻/金句） |
| 技术栈 | 原生 HTML/CSS/JS，**零构建、零依赖、零 npm** |
| 唯一真源 | `D:\我的GitHub\check-in`（分支 `main`） |
| 线上 | https://huanghua-2019.github.io/check-in/ |
| 改完必做 | 升 `index.html` 缓存号 → `python build/verify.py` → git 安全序列提交 |

---

## 5 条铁律

1. **只改 `D:\我的GitHub\check-in`**。工作区里`vocab-checkin` 是过期副本，改它线上永远不变。
2. **绝不可跑 `build/sync.py`**——会把旧版 md 回灌，污染数据。
3. **改哪个文件就把 `index.html` 里对应 `?v=` +1**，用户需 `Ctrl/Cmd+Shift+R` 强刷。
4. **`data.js` 绝不重编 id**（打卡进度按 id 存 localStorage），新条目用最大 id +1。
5. **改分类标签必须逐条读释义判断，禁止关键词批量打标签**。拿不准的丢「❓ 待定」，不要硬塞。

---

## 架构

```
index.html         入口，含 4 个缓存号
├─ data.js         728K  window.VOCAB / CATEGORIES / TOPICS
├─ habits.js        48K  4 张习惯框架卡（独立 IIFE）
├─ app.js60K  全部交互逻辑（单 IIFE）
└─ styles.css       40K  护眼米色主题（--brand 金棕 #b8861b）

*.sql                Supabase 建表脚本（手动执行一次）
build/verify.py     改动校验脚本 ← 改完必跑
build/              其余为历史脚本，非运行时依赖
```

### `data.js` 必须保持四行

```
/* build: <ISO时间戳> */
window.VOCAB=[...];
window.CATEGORIES=[...];
window.TOPICS=[...];
```

JSON 紧凑无空格、LF 换行（裸 LF 恰为 4）。

### 分类模型：`use` 数组两轴约定

- `use[0]` = **主归属**（唯一，决定分组统计）
- `use[1:]` = **场景索引**（可多个，用于筛选）

一条词只存一份，点任一场景都能调出，但统计只算主归属，**不重复计数**。

---

## 改动后必跑

```bash
cd D:\我的GitHub\check-in

# 1. 校验（可加 --expect 1398 断言条目数）
"C:\Users\Lenovo\.workbuddy\binaries\python\versions\3.13.12\python.exe" build/verify.py

# 2. 提交（安全序列，不用 rebase / --force）
git add data.js index.html
git commit -m "feat(vocab): ..."
git fetch origin && git merge FETCH_HEAD --no-edit && git push
```

`verify.py` 覆盖：文件存在性 / data.js 四行结构与分隔符 / 条目数·id 唯一·字段完整·无空值 /
use·tab·tier 合法性 / `app.js` 语法 / 缓存号齐全 / git 工作区状态。**退出码非 0 就是没改对。**

---

## 解析 `data.js` 的唯一正确方式

**绝不手算偏移量**——`window.VOCAB=[` 是 14 个字符，用 `+12` 会切出`=[{...}]` 导致解析失败，
进而误判"文件坏了"（历史上因此白翻一轮 git 历史）。

```python
m = re.search(r"window\.VOCAB=(\[.*\]);\nwindow\.CATEGORIES", src, re.S)
arr = json.loads(m.group(1))     # 先确认能解析，再动
```

写回用 `m.start(1)` / `m.end(1)`。完整模板见 `agent.md`。

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

## 详细文档

`agent.md` 含：完整架构说明、localStorage 键清单、Supabase 约定、新增词条可抄模板、
分类标签自查三步法、9 条常见坑速查、用户偏好。