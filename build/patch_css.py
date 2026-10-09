p = "styles.css"
s = open(p, encoding="utf-8").read()
css = """
/* 句式模板占位符加粗（金棕） */
.w-text b, .detail .val b, .tr-w b, .dr-w b, .mr-w b { color: var(--brand); font-weight: 700; }
"""
if ".w-text b" not in s:
    s = s.rstrip() + "\n" + css
    open(p, "w", encoding="utf-8").write(s)
    print("OK css appended")
else:
    print("css already present, skip")
