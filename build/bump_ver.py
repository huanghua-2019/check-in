p = "index.html"
s = open(p, encoding="utf-8").read()
s2 = s.replace("app.js?v=19", "app.js?v=20").replace("styles.css?v=19", "styles.css?v=20")
if s2 != s:
    open(p, "w", encoding="utf-8").write(s2)
    print("bumped app.js/styles.css -> v20")
else:
    print("no change (check current version in index.html)")
