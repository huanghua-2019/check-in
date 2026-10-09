import io
p = "app.js"
s = open(p, encoding="utf-8").read()

# A. 插入 phrBold 函数（在 stripEmoji 之前）
anchor = "  function stripEmoji(s) {"
assert anchor in s, "anchor missing"
ins = '''  /* 句式模板占位符加粗：省略号 / XX YY / 独立 A B */
  function phrBold(s) {
    return s
      .replace(/(…{1,})/g, "<b>$1</b>")
      .replace(/(?<![A-Za-z])(XX|YY)(?![A-Za-z])/g, "<b>$1</b>")
      .replace(/(?<![A-Za-z])([AB])(?![A-Za-z])/g, "<b>$1</b>");
  }'''
s = s.replace(anchor, ins + "\n" + anchor, 1)

# B. 卡片标题（也是详情页展开的 word 标题）
oldB = '''    tap.innerHTML = `<div class="w-text">${highlight(w.word, q)}${myDot}</div>` +'''
newB = '''    tap.innerHTML = `<div class="w-text">${w.tab === "phr" ? phrBold(esc(w.word)) : highlight(w.word, q)}${myDot}</div>` +'''
assert oldB in s, "B missing"
s = s.replace(oldB, newB, 1)

# C. 详情页「同类句式」行（phr 的 syn 也是模板）
oldC = '''      r.innerHTML = `<div class="label">${esc(label)}</div><div class="val">${highlight(val, q)}</div>`;'''
newC = '''      const valHTML = (w.tab === "phr" && label === L[0]) ? phrBold(esc(val)) : highlight(val, q);
      r.innerHTML = `<div class="label">${esc(label)}</div><div class="val">${valHTML}</div>`;'''
assert oldC in s, "C missing"
s = s.replace(oldC, newC, 1)

# D. 今日 5 条
oldD = '''      row.innerHTML = '<div class="tr-main"><div class="tr-w">' + esc(w.word) + '</div>' +'''
newD = '''      row.innerHTML = '<div class="tr-main"><div class="tr-w">' + (w.tab === "phr" ? phrBold(esc(w.word)) : esc(w.word)) + '</div>' +'''
assert oldD in s, "D missing"
s = s.replace(oldD, newD, 1)

# E. 我的表达（引用原句式）
oldE = '''      row.innerHTML = '<div class="mr-w">' + esc(w ? w.word : '(已删条目)') + '<small>' + esc(fmt(it.at)) + '</small></div>' +'''
newE = '''      const refWord = w ? w.word : "(已删条目)";
      const refHTML = (w && w.tab === "phr") ? phrBold(esc(refWord)) : esc(refWord);
      row.innerHTML = '<div class="mr-w">' + refHTML + '<small>' + esc(fmt(it.at)) + '</small></div>' +'''
assert oldE in s, "E missing"
s = s.replace(oldE, newE, 1)

# F. 取用台
oldF = '''        row.innerHTML = '<div class="dr-main"><div class="dr-w">' + esc(w.word) + '</div>' +'''
newF = '''        row.innerHTML = '<div class="dr-main"><div class="dr-w">' + (w.tab === "phr" ? phrBold(esc(w.word)) : esc(w.word)) + '</div>' +'''
assert oldF in s, "F missing"
s = s.replace(oldF, newF, 1)

open(p, "w", encoding="utf-8").write(s)
print("OK: phrBold inserted + 5 render points updated")
