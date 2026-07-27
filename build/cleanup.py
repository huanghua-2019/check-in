#!/usr/bin/env python3
# 分页找出空记录(建表默认产生的空行)并删除
import json, subprocess

FILE_ID = "HgrtVNcpgTly"
SHEET_ID = "BB08J2"
MCP = "tencent-docs"
MCP_BIN = r"C:\Users\Lenovo\AppData\Roaming\npm\mcporter.cmd"

def call(tool, args):
    cmd = [MCP_BIN, "call", MCP, tool, "--args", json.dumps(args, ensure_ascii=False)]
    r = subprocess.run(cmd, capture_output=True, text=True, shell=True)
    if r.returncode != 0:
        return {"error": r.stderr[:200]}
    try:
        return json.loads(r.stdout.strip())
    except Exception:
        return {"error": r.stdout[:200]}

empty_ids = []
offset = 0
while True:
    res = call("smartsheet.list_records",
               {"file_id": FILE_ID, "sheet_id": SHEET_ID, "limit": 100, "offset": offset})
    if res.get("error"):
        print("list error:", res)
        break
    recs = res.get("records", [])
    for rec in recs:
        if not rec.get("field_values"):
            empty_ids.append(rec["record_id"])
    if not res.get("has_more"):
        break
    offset = res.get("next", offset + 100)

print("空记录数:", len(empty_ids), empty_ids)
if empty_ids:
    d = call("smartsheet.delete_records",
             {"file_id": FILE_ID, "sheet_id": SHEET_ID, "record_ids": empty_ids})
    print("删除结果:", ("OK" if not d.get("error") else d))
    # 复查总数
    chk = call("smartsheet.list_records", {"file_id": FILE_ID, "sheet_id": SHEET_ID, "limit": 1})
    print("删除后总数:", chk.get("total"))
