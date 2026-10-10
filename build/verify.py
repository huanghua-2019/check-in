# -*- coding: utf-8 -*-
"""
verify.py — check-in 词库改动校验（改完 data.js/app.js 必跑）

用法：
    python verify.py                # 校验当前仓库状态
    python verify.py --expect 1400   # 额外断言条目数
    python verify.py --quiet         # 只输出结果，不打印明细

退出码：0 全部通过 / 1 有校验失败
"""
import argparse
import json
import os
import re
import subprocess
import sys

REPO = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA = os.path.join(REPO, "data.js")
INDEX = os.path.join(REPO, "index.html")
APP = os.path.join(REPO, "app.js")

REQUIRED_FIELDS = {"id", "tab", "tier", "use", "cat",
                   "word", "syn", "mean", "example", "scene"}
VALID_TABS = {"vocab", "phr", "met", "quote", "humor", "cases", "rule", "diff"}
VALID_TIERS = {"核心", "进阶", "备用"}

GREEN, RED, YELLOW, DIM, RESET = (
    "\033[32m", "\033[31m", "\033[33m", "\033[2m", "\033[0m")


class Checker:
    def __init__(self, quiet=False):
        self.quiet = quiet
        self.failed = []

    def ok(self, msg, detail=""):
        if not self.quiet:
            print("  %sPASS%s %s%s" % (GREEN, RESET, msg,
                                       ("  " + DIM + detail + RESET) if detail else ""))
        return True

    def fail(self, msg, detail=""):
        self.failed.append(msg)
        print("  %sFAIL%s %s%s" % (RED, RESET, msg,
                                   ("  " + detail) if detail else ""))
        return False

    def warn(self, msg):
        if not self.quiet:
            print("  %sWARN%s %s" % (YELLOW, RESET, msg))

    def head(self, title):
        if not self.quiet:
            print("\n%s%s%s" % (DIM, title, RESET))


def parse_data_js(c):
    """用正则定位并解析三段数据（绝不手算偏移）"""
    src = open(DATA, encoding="utf-8").read()
    m_v = re.search(r"window\.VOCAB=(\[.*\]);\nwindow\.CATEGORIES", src, re.S)
    m_c = re.search(r"window\.CATEGORIES=(\[.*?\]);\nwindow\.TOPICS", src, re.S)
    m_t = re.search(r"window\.TOPICS=(\[.*?\]);?\s*$", src, re.S)
    if not (m_v and m_c and m_t):
        raise SystemExit("FATAL: 无法定位 data.js 三段结构，文件可能被破坏")
    return (src, json.loads(m_v.group(1)),
            json.loads(m_c.group(1)), json.loads(m_t.group(1)))


def main():
    ap = argparse.ArgumentParser(description="check-in 词库改动校验")
    ap.add_argument("--expect", type=int, default=None, help="断言条目总数")
    ap.add_argument("--quiet", action="store_true", help="只输出结果")
    args = ap.parse_args()

    c = Checker(args.quiet)
    print("=" * 58)
    print(" check-in 词库校验  %s" % REPO)
    print("=" * 58)

    # ---------- 1. 文件存在 ----------
    c.head("[1/6] 文件存在性")
    for name, path in (("data.js", DATA), ("index.html", INDEX), ("app.js", APP)):
        if os.path.exists(path):
            c.ok(name, "%d KB" % (os.path.getsize(path) // 1024))
        else:
            c.fail(name + " 不存在")

    # ---------- 2. data.js 结构 ----------
    c.head("[2/6] data.js 结构")
    try:
        src, arr, cats, tops = parse_data_js(c)
        c.ok("三段结构可解析", "VOCAB=%d CATEGORIES=%d TOPICS=%d"
             % (len(arr), len(cats), len(tops)))
    except SystemExit as e:
        c.fail(str(e))
        return 1

    lf = src.count("\n") - src.count("\r\n")
    if lf == 4:
        c.ok("裸 LF 行数 = 4", "格式正确")
    else:
        c.fail("裸 LF 行数异常", "期望 4，实际 %d" % lf)

    if "];\nwindow.CATEGORIES" in src:
        c.ok("VOCAB 结尾分隔符完好")
    else:
        c.fail("VOCAB 结尾分隔符被破坏", "缺 '];\\nwindow.CATEGORIES'")

    if re.match(r"^/\* build: [^*]* \*/\nwindow\.VOCAB=", src):
        c.ok("build 时间戳头完整")
    else:
        c.fail("build 时间戳头格式异常")

    # ---------- 3. 条目完整性 ----------
    c.head("[3/6] 条目完整性")
    if args.expect is not None:
        if len(arr) == args.expect:
            c.ok("条目数符合预期", "%d 条" % len(arr))
        else:
            c.fail("条目数不符", "期望 %d，实际 %d" % (args.expect, len(arr)))
    else:
        c.ok("条目数", "%d 条" % len(arr))

    ids = [w["id"] for w in arr]
    if len(set(ids)) == len(ids):
        c.ok("id 唯一", "最大 id = %d" % max(ids))
    else:
        dup = [i for i in set(ids) if ids.count(i) > 1]
        c.fail("id 重复", "重复值：%s" % dup[:10])

    bad = [w["id"] for w in arr if set(w) != REQUIRED_FIELDS]
    if not bad:
        c.ok("10 字段齐全", "共 %d 条" % len(arr))
    else:
        c.fail("字段缺失/多余", "%d 条异常：%s" % (len(bad), bad[:10]))

    empty = [w["id"] for w in arr
             if not (w["word"] or "").strip() or not (w["mean"] or "").strip()]
    if not empty:
        c.ok("word / mean 无空值")
    else:
        c.fail("存在空 word/mean", "%d 条：%s" % (len(empty), empty[:10]))

    # ---------- 4. 分类合法性 ----------
    c.head("[4/6] 分类与标签")
    illegal_use = [w["id"] for w in arr if any(x not in cats for x in w["use"])]
    if not illegal_use:
        c.ok("use 全为合法分类", "共 %d 个分类" % len(cats))
    else:
        c.fail("非法 use 值", "%d 条：%s" % (len(illegal_use), illegal_use[:10]))

    bad_tab = [w["id"] for w in arr if w["tab"] not in VALID_TABS]
    if not bad_tab:
        c.ok("tab 全合法", "  ".join(
            "%s=%d" % (t, sum(1 for w in arr if w["tab"] == t))
            for t in sorted(VALID_TABS)))
    else:
        c.fail("非法 tab", "%s" % bad_tab[:10])

    bad_tier = [w["id"] for w in arr if w["tier"] not in VALID_TIERS]
    if not bad_tier:
        c.ok("tier 全合法", "  ".join(
            "%s=%d" % (t, sum(1 for w in arr if w["tier"] == t))
            for t in ("核心", "进阶", "备用")))
    else:
        c.fail("非法 tier", "%s" % bad_tier[:10])

    dup_tag = [w["id"] for w in arr if len(w["use"]) != len(set(w["use"]))]
    if not dup_tag:
        c.ok("use 无重复标签")
    else:
        c.warn("use 存在重复标签：%s" % dup_tag[:10])

    # ---------- 5. 前端一致性 ----------
    c.head("[5/6] 前端一致性")
    app = open(APP, encoding="utf-8").read()
    node = os.path.join(os.environ.get("USERPROFILE", ""),
                        ".workbuddy", "binaries", "node",
                        "versions", "22.22.2-6", "node.exe")
    if os.path.exists(node):
        r = subprocess.run([node, "--check", APP],
                           capture_output=True, text=True)
        if r.returncode == 0:
            c.ok("app.js 语法正确")
        else:
            c.fail("app.js 语法错误", r.stderr.strip()[:120])
    else:
        c.warn("未找到 node，跳过 app.js 语法检查")

    html = open(INDEX, encoding="utf-8").read()
    versions = dict(re.findall(r"(\w+\.js|\w+\.css)\?v=(\d+)", html))
    missing = [n for n in ("data.js", "app.js", "styles.css", "habits.js")
               if n not in versions]
    if not missing:
        c.ok("缓存号齐全", "  ".join("%s?v=%s" % (k, v)
                                     for k, v in sorted(versions.items())))
    else:
        c.fail("缺缓存号", "未找到：%s" % missing)

    # ---------- 6. git 状态 ----------
    c.head("[6/6] git 状态")
    try:
        r = subprocess.run(["git", "status", "--short"], cwd=REPO,
                           capture_output=True, text=True, timeout=20)
        dirty = [l for l in r.stdout.strip().splitlines() if l.strip()]
        if not dirty:
            c.ok("工作区干净（无未提交改动）")
        else:
            c.warn("有未提交改动：%s" % len(dirty))
            if not args.quiet:
                for line in dirty[:8]:
                    print("       " + DIM + line + RESET)
    except Exception as e:
        c.warn("git 不可用：%s" % e)

    # ---------- 汇总 ----------
    print("\n" + "-" * 58)
    if c.failed:
        print(" %s校验失败：%d 项不通过%s" % (RED, len(c.failed), RESET))
        for f in c.failed:
            print("   - %s" % f)
        print("-" * 58)
        return 1
    print(" %s全部通过%s" % (GREEN, RESET))
    print("-" * 58)
    return 0


if __name__ == "__main__":
    sys.exit(main())