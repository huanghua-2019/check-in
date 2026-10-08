# -*- coding: utf-8 -*-
"""
sync_registry.py —— 把 id_registry.json 与当前 data.js 对齐（补登缺失 key、推进 next_id）

为什么需要：
  sync.py 分配新 id 时从 registry.next_id 起递增。若 registry 落后于 data.js
  （例如本地脚本直接往 data.js 里加词、没走 sync.py），next_id 会落在已被占用的
  号段上，导致新词与旧词 id 冲突 → 打卡记录错配到别的词上。

本脚本做什么：
  1. 读 data.js 的每条 entry，算 key = tab \\x01 cat \\x01 word
  2. key 未登记 且 其 id 未被别的 key 占用 → 补登
  3. key 已登记但 id 与 data.js 不一致 → 只报告，不自动改（需人工判断）
  4. next_id 推进到 max(所有已登记 id, data.js 最大 id) + 1

用法：
  python sync_registry.py --src data.js            # 干跑，只出报告
  python sync_registry.py --src data.js --apply    # 落盘（自动备份旧注册表）
"""
import argparse
import json
import re
import shutil
import sys
from datetime import datetime
from pathlib import Path

SEP = "\u0001"


def load_vocab(path: Path):
    txt = path.read_text(encoding="utf-8")
    m = re.search(r'window\.VOCAB\s*=\s*(\[[\s\S]*?\])\s*;', txt)
    if not m:
        raise SystemExit(f"✗ 没在 {path} 里找到 window.VOCAB")
    return json.loads(m.group(1))


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--src", default="data.js", help="data.js 路径")
    ap.add_argument("--reg", default="build/id_registry.json", help="注册表路径")
    ap.add_argument("--apply", action="store_true", help="落盘（默认只干跑）")
    a = ap.parse_args()

    src, regp = Path(a.src), Path(a.reg)
    vocab = load_vocab(src)
    reg = json.loads(regp.read_text(encoding="utf-8"))
    entries = reg["entries"]

    claimed = {}          # id -> key（已登记 id 的归属）
    for k, v in entries.items():
        claimed.setdefault(v, k)

    added, mismatched, unregistered = [], [], []
    for e in vocab:
        key = "%s%s%s%s%s" % (e.get("tab", ""), SEP, e["cat"], SEP, e["word"])
        if key in entries:
            if entries[key] != e["id"]:
                mismatched.append((key, entries[key], e["id"]))
            continue
        if e["id"] in claimed:
            unregistered.append((key, e["id"], claimed[e["id"]]))
            continue
        added.append((key, e["id"]))
        entries[key] = e["id"]
        claimed[e["id"]] = key

    max_id = max([v for v in entries.values()] + [x["id"] for x in vocab])
    old_next = reg.get("next_id", 1)
    new_next = max(max_id + 1, old_next)

    print("=" * 62)
    print("data.js 条数        : %d" % len(vocab))
    print("注册表原有          : %d 条，next_id=%d" % (len(entries) - len(added), old_next))
    print("补登 key            : %d 条" % len(added))
    print("id 已被占用未登记    : %d 条" % len(unregistered))
    print("key 已登记但 id 冲突 : %d 条" % len(mismatched))
    print("next_id             : %d → %d" % (old_next, new_next))
    if added:
        print("\n补登样例：")
        for k, i in added[:10]:
            p = k.split(SEP)
            print("  id%-5d [%s] %s  (%s)" % (i, p[0], p[2][:24], p[1][:26]))
        if len(added) > 10:
            print("  … 其余 %d 条" % (len(added) - 10))
    if unregistered:
        print("\n⚠ id 已被别的 key 占用（未自动登记，需人工判断）：")
        for k, i, owner in unregistered[:10]:
            print("  id%-5d %s  ← 占用者是 %s" % (i, k.split(SEP)[2][:26], owner.split(SEP)[2][:26]))
    if mismatched:
        print("\n⚠⚠ key 已登记但 id 与 data.js 不符（会造成重复 id，建议人工核对）：")
        for k, old, new in mismatched[:10]:
            print("  %s  注册表=%s  data.js=%s" % (k.split(SEP)[2][:26], old, new))
    print("=" * 62)

    if not a.apply:
        print("（干跑，未落盘。加 --apply 执行）")
        return 0

    bak = regp.parent / "backup" / ("id_registry_%s.json" % datetime.now().strftime("%Y%m%d_%H%M%S"))
    bak.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy2(regp, bak)
    print("已备份 → %s" % bak)

    reg["next_id"] = new_next
    reg["count"] = len(entries)
    reg["updated"] = datetime.now().isoformat()
    regp.write_text(json.dumps(reg, ensure_ascii=False, indent=2), encoding="utf-8")
    print("已写入 → %s" % regp)
    return 0


if __name__ == "__main__":
    sys.exit(main())
