(function () {
  'use strict';
  const LS_STATE = 'vocab_checkin_state_v1';
  const LS_SB = 'vocab_sb_config_v1';
  const MASTERY = ['未用', '偶尔', '熟练'];

  const VOCAB = window.VOCAB || [];
  const CATS = window.CATEGORIES || [];
  let state = {};
  let sbUrl = 'https://buzfmugezbemyfdmbgyt.supabase.co', sbKey = 'sb_publishable_HvD6YPPY-RpHLRicuoobSw_aSw1B_Ow', sbOn = true;
  const filters = { status: 'all', mastery: 'all', cat: 'all', q: '' };
  const openIds = new Set();
  const collapsedCats = new Set(CATS);
  const isFiltering = () => filters.q.trim() || filters.status !== 'all' || filters.mastery !== 'all';

  /* ---------- Tabs 大类（词汇 / 句式 / 金句 / 比喻 / 规则 / 案例 / 幽默）---------- */
  const TABS = [
    { id: 'vocab', name: '词汇', icon: '📚', color: '#b8861b', match: c => !/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u.test(c) },
    { id: 'phr',   name: '句式', icon: '✍️', color: '#2f8f9d', match: c => /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u.test(c) && !/^[💎🎨📖📒😂😏😅🔫📌]/u.test(c) },
    { id: 'quote', name: '金句', icon: '💎', color: '#8a5cc4', match: c => c.indexOf('💎') === 0 },
    { id: 'met',   name: '比喻', icon: '🎨', color: '#e07856', match: c => c.indexOf('🎨') === 0 },
    { id: 'rule',  name: '规则', icon: '📐', color: '#6b8e23', match: c => c.indexOf('📖') === 0 },
    { id: 'cases', name: '案例', icon: '📒', color: '#3a6ea5', match: c => c.indexOf('📒') === 0 },
    { id: 'humor', name: '幽默', icon: '😂', color: '#d4568a', match: c => /^[😂😏😅🔫📌]/u.test(c) },
  ];
  // 分类 → tab 映射（来自 entry.tab，前端不再靠 emoji 猜分类，彻底避免误归）
  const CAT_TAB = {};
  for (const w of VOCAB) if (w.tab) CAT_TAB[w.cat] = w.tab;
  function tabOf(entry) {
    if (entry && entry.tab) return entry.tab;
    const cat = (entry && entry.cat) || '';
    for (const t of TABS) if (t.match(cat)) return t.id;
    return 'vocab';
  }
  function tabCats(tabId) { return CATS.filter(c => (CAT_TAB[c] || tabOf({ cat: c })) === tabId); }
  function tabVocab(tabId) { return VOCAB.filter(w => tabOf(w) === tabId); }
  const LS_TAB = 'vocab_current_tab_v1';
  let currentTab = (function () { try { return localStorage.getItem(LS_TAB) || 'vocab'; } catch (e) { return 'vocab'; } })();

  try { state = JSON.parse(localStorage.getItem(LS_STATE)) || {}; } catch (e) { state = {}; }
  try { const c = JSON.parse(localStorage.getItem(LS_SB)); if (c && c.url && c.key) { sbUrl = c.url; sbKey = c.key; } } catch (e) {}
  sbOn = !!(sbUrl && sbKey);

  /* ---------- 每日打卡计数（用于首页「本周趋势」柱图，本地存储） ---------- */
  const LS_DAILY = 'vocab_daily_v1';
  let dailyStats = {};
  try { dailyStats = JSON.parse(localStorage.getItem(LS_DAILY)) || {}; } catch (e) { dailyStats = {}; }
  function dayKey(d) { return d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate(); }
  function saveDaily() { try { localStorage.setItem(LS_DAILY, JSON.stringify(dailyStats)); } catch (e) {} }

  /* ---------- Supabase REST 同步（无 SDK 依赖） ---------- */
  function base() { return sbUrl.replace(/\/$/, '') + '/rest/v1/checkin'; }
  async function restGet() {
    const r = await fetch(base() + '?select=*', { headers: { apikey: sbKey, Authorization: 'Bearer ' + sbKey } });
    if (!r.ok) throw new Error('读取失败 ' + r.status);
    return await r.json();
  }
  async function restUpsert(rows) {
    const r = await fetch(base(), {
      method: 'POST',
      headers: { apikey: sbKey, Authorization: 'Bearer ' + sbKey, 'Content-Type': 'application/json', Prefer: 'resolution=merge-duplicates,return=minimal' },
      body: JSON.stringify(rows)
    });
    if (!r.ok) throw new Error('写入失败 ' + r.status + ' ' + (await r.text()));
  }
  /* ---------- 每日计数云端同步（让"本周趋势"跨设备/跨域名持久）---------- */
  function baseDaily() { return sbUrl.replace(/\/$/, '') + '/rest/v1/daily_counter'; }
  async function syncDailyPull() {
    if (!sbOn) return;
    try {
      const rows = await fetch(baseDaily() + '?select=day,n', { headers: { apikey: sbKey, Authorization: 'Bearer ' + sbKey } }).then(r => { if (!r.ok) throw new Error(r.status); return r.json(); });
      for (const row of rows) dailyStats[row.day] = Math.max(dailyStats[row.day] || 0, row.n); // 取大，防本地丢失
      saveDaily();
    } catch (e) { /* 表未建或网络异常时忽略，降级为纯本地 */ }
  }
  async function syncDailyPush(day, delta) {
    const cur = dailyStats[day] || 0;
    const n = Math.max(0, cur + delta);
    dailyStats[day] = n; saveDaily();           // 无论是否联网都先更新本地
    if (!sbOn) return;
    try {
      await fetch(baseDaily(), {
        method: 'POST',
        headers: { apikey: sbKey, Authorization: 'Bearer ' + sbKey, 'Content-Type': 'application/json', Prefer: 'resolution=merge-duplicates,return=minimal' },
        body: JSON.stringify([{ day, n }])
      });
    } catch (e) { /* 表未建时忽略 */ }
  }
  async function syncDailyPushAll() {
    if (!sbOn) return;
    for (const day in dailyStats) {
      try { await fetch(baseDaily(), { method: 'POST', headers: { apikey: sbKey, Authorization: 'Bearer ' + sbKey, 'Content-Type': 'application/json', Prefer: 'resolution=merge-duplicates,return=minimal' }, body: JSON.stringify([{ day, n: dailyStats[day] }]) }); } catch (e) {}
    }
  }
  // 首次/云端为空时，用各词条 last_used 近似回填每日计数（每词每天记 1 次）
  // 仅在 dailyStats 完全为空时执行，且结果写入 localStorage，不会重复叠加
  function migrateDailyFromState() {
    const has = Object.keys(dailyStats).some(k => dailyStats[k] > 0);
    if (has) return;
    for (const id in state) {
      const lu = state[id] && state[id].last_used;
      if (!lu) continue;
      const dk = dayKey(new Date(lu));
      dailyStats[dk] = (dailyStats[dk] || 0) + 1;
    }
    saveDaily();
  }

  let remoteMap = {};
  async function syncPull() {
    if (!sbOn) return;
    const rows = await restGet();
    remoteMap = {};
    for (const row of rows) {
      remoteMap[row.id] = row;
      const l = state[row.id];
      if (!l || (row.last_used && (!l.last_used || row.last_used > l.last_used))) {
        state[row.id] = { count: row.count || 0, first_used: row.first_used || null, last_used: row.last_used || null, mastery: row.mastery || '未用' };
      }
    }
    save();
  }
  async function syncPush(id, force) {
    if (!sbOn) return;
    const v = state[id]; if (!v) return;
    const rem = remoteMap[id];
    if (!force && rem && rem.last_used && v.last_used && rem.last_used >= v.last_used) return;
    await restUpsert([{ id: +id, count: v.count, first_used: v.first_used, last_used: v.last_used, mastery: v.mastery }]);
    remoteMap[id] = v;
  }
  async function syncPushAll() {
    if (!sbOn) return;
    for (const id of Object.keys(state)) { try { await syncPush(id); } catch (e) { console.warn(e); } }
  }

  /* ---------- 工具 ---------- */
  function save() { localStorage.setItem(LS_STATE, JSON.stringify(state)); }
  function getRec(id) { return state[id] || { count: 0, first_used: null, last_used: null, mastery: '未用' }; }
  function esc(s) { return (s || '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }
  function highlight(text, q) {
    if (!text) return '';
    const safe = esc(text);
    if (!q) return safe;
    const re = new RegExp('(' + q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + ')', 'gi');
    return safe.replace(re, '<mark>$1</mark>');
  }
  function isToday(iso) { if (!iso) return false; const d = new Date(iso), n = new Date(); return d.getFullYear() === n.getFullYear() && d.getMonth() === n.getMonth() && d.getDate() === n.getDate(); }
  function fmt(iso) { if (!iso) return ''; const d = new Date(iso); const p = x => ('' + x).padStart(2, '0'); return `${d.getMonth() + 1}/${d.getDate()} ${p(d.getHours())}:${p(d.getMinutes())}`; }

  let lastUndo = null;
  function checkIn(id) {
    const before = { ...getRec(id) };
    const v = getRec(id);
    const now = new Date().toISOString();
    v.count = (v.count || 0) + 1;
    if (!v.first_used) v.first_used = now;
    v.last_used = now;
    if (v.mastery === '未用' && v.count > 0) v.mastery = '偶尔';
    state[id] = v; save();
    const dk = dayKey(new Date()); syncDailyPush(dk, 1);
    lastUndo = { id, before };
    render();
    if (sbOn) syncPush(id).catch(e => toast('同步失败：' + e.message));
    const today = todayCount();
    toast(`✓ 已打卡 · 今日第 ${today} 个`, '撤销', () => undoCheckIn(lastUndo));
    try { if (navigator.vibrate) navigator.vibrate(15); } catch (e) {}
  }
  function undoCheckIn(u) {
    if (!u) return;
    state[u.id] = u.before; save();
    const dk = dayKey(new Date()); syncDailyPush(dk, -1);
    render();
    if (sbOn) syncPush(u.id, true).catch(e => toast('同步失败：' + e.message));
    toast('已撤销打卡');
  }
  function setMastery(id, m) {
    const v = getRec(id); v.mastery = m; state[id] = v; save();
    render();
    if (sbOn) syncPush(id).catch(e => toast('同步失败：' + e.message));
  }

  /* ---------- 今日进度 & 连续天数 ---------- */
  function todayCount() {
    const n = new Date(); const y = n.getFullYear(), mo = n.getMonth(), d = n.getDate();
    let c = 0;
    for (const id in state) {
      const v = state[id];
      if (!v || !v.last_used) continue;
      const t = new Date(v.last_used);
      if (t.getFullYear() === y && t.getMonth() === mo && t.getDate() === d) c++;
    }
    return c;
  }
  function streak() {
    const days = new Set();
    for (const id in state) {
      const v = state[id];
      if (!v || !v.last_used) continue;
      const t = new Date(v.last_used);
      days.add(t.getFullYear() + '-' + (t.getMonth() + 1) + '-' + t.getDate());
    }
    if (!days.size) return 0;
    let s = 0;
    const today = new Date();
    while (true) {
      const d = today.getFullYear() + '-' + (today.getMonth() + 1) + '-' + today.getDate();
      if (days.has(d)) { s++; today.setDate(today.getDate() - 1); }
      else break;
    }
    return s;
  }
  function lastUsedStr(iso) {
    if (!iso) return '';
    const n = new Date(), t = new Date(iso);
    const ms = n - t;
    const day = 24 * 3600 * 1000;
    if (ms < day && n.getDate() === t.getDate()) return '今天';
    const diff = Math.floor(ms / day);
    if (diff === 0) return '昨天';
    if (diff < 30) return diff + '天前';
    const mo = Math.floor(diff / 30);
    return mo + '月前';
  }

  /* ---------- 渲染 ---------- */
  const list = document.getElementById('list');
  function visibleWords() {
    const q = filters.q.trim().toLowerCase();
    return VOCAB.filter(w => {
      if (tabOf(w) !== currentTab) return false;
      const rec = getRec(w.id);
      if (filters.status === 'unused' && rec.count > 0) return false;
      if (filters.status === 'used' && rec.count === 0) return false;
      if (filters.status === 'review') {
        const lu = rec.last_used ? new Date(rec.last_used) : null;
        const days = lu ? Math.floor((Date.now() - lu.getTime()) / 86400000) : null;
        const need = (rec.count === 0) || (days === null) || (days > 7);
        if (!need) return false;
      }
      if (filters.mastery !== 'all' && rec.mastery !== filters.mastery) return false;
      if (filters.cat !== 'all' && w.cat !== filters.cat) return false;
      if (q) {
        const hay = (w.word + ' ' + (w.syn || '') + ' ' + (w.mean || '') + ' ' + (w.example || '') + ' ' + (w.scene || '')).toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }
  function catDone(cat) {
    let d = 0, t = 0;
    for (const w of VOCAB) { if (w.cat === cat) { t++; if (state[w.id] && state[w.id].count > 0) d++; } }
    return { d, t };
  }
  function buildDetail(w, rec) {
    const d = document.createElement('div');
    d.className = 'detail';
    const q = filters.q.trim();
    const rows = [];
    if (w.syn) rows.push(['口语化同义词', w.syn]);
    if (w.mean) rows.push(['释义', w.mean]);
    if (w.example) rows.push(['例句', w.example]);
    if (w.scene) rows.push(['使用场景', w.scene]);
    for (const [label, val] of rows) {
      const r = document.createElement('div'); r.className = 'row';
      r.innerHTML = `<div class="label">${esc(label)}</div><div class="val">${highlight(val, q)}</div>`;
      d.appendChild(r);
    }
    const rd = document.createElement('div'); rd.className = 'row';
    rd.innerHTML = `<div class="label">打卡记录</div><div class="val">首次 ${fmt(rec.first_used) || '—'} · 最近 ${fmt(rec.last_used) || '—'}</div>`;
    d.appendChild(rd);
    const m = document.createElement('div'); m.className = 'mastery';
    for (const mm of MASTERY) {
      const b = document.createElement('button');
      b.textContent = mm; if (rec.mastery === mm) b.className = 'on';
      b.addEventListener('click', ev => { ev.stopPropagation(); setMastery(w.id, mm); });
      m.appendChild(b);
    }
    d.appendChild(m);
    return d;
  }
  function cardEl(w) {
    const rec = getRec(w.id);
    const open = openIds.has(w.id);
    const q = filters.q.trim();
    const div = document.createElement('div');
    div.className = 'word' + (open ? ' open' : '') + (rec.count > 0 ? ' has-count' : '') + ' m-' + rec.mastery;
    // 左侧：独立圆形打卡按钮（只负责打卡，与展开物理分离）
    const cbtn = document.createElement('button');
    cbtn.type = 'button';
    cbtn.className = 'checkin-btn' + (isToday(rec.last_used) ? ' today' : '');
    cbtn.setAttribute('aria-label', '打卡：' + w.word);
    cbtn.innerHTML = rec.count > 0 ? '<span class="n">' + rec.count + '</span>' : '<span class="plus">✚</span>';
    cbtn.addEventListener('click', e => { e.stopPropagation(); checkIn(w.id); });
    // 中间：卡片主体（只负责展开/收起）
    const tap = document.createElement('div'); tap.className = 'tap';
    const lastStr = lastUsedStr(rec.last_used);
    tap.innerHTML = `<div class="w-text">${highlight(w.word, q)}</div>` + (w.syn ? `<div class="w-sub">${highlight(w.syn, q)}</div>` : '') + (lastStr ? `<div class="w-last">${esc(lastStr)}</div>` : '');
    tap.addEventListener('click', () => { open ? openIds.delete(w.id) : openIds.add(w.id); render(); });
    // 右侧：展开箭头（展开语义，安全不触发打卡）
    const exp = document.createElement('button'); exp.type = 'button'; exp.className = 'expand-btn';
    exp.innerHTML = open
      ? '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 15 12 9 18 15"></polyline></svg>'
      : '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg>';
    exp.setAttribute('aria-label', open ? '收起' : '展开');
    exp.addEventListener('click', e => { e.stopPropagation(); open ? openIds.delete(w.id) : openIds.add(w.id); render(); });
    div.appendChild(cbtn); div.appendChild(tap); div.appendChild(exp);
    if (open) div.appendChild(buildDetail(w, rec));
    return div;
  }
  function catEl(cat, arr) {
    const sec = document.createElement('section');
    const collapsed = collapsedCats.has(cat) && !isFiltering();
    sec.className = 'cat' + (collapsed ? ' collapsed' : '');
    const { d, t } = catDone(cat);
    const head = document.createElement('div'); head.className = 'cat-head';
    head.innerHTML = `<div><span class="name">${esc(cat)}</span><span class="meta">已打卡 ${d}/${t}</span></div><span class="arrow">▾</span>`;
    head.addEventListener('click', () => { collapsedCats.has(cat) ? collapsedCats.delete(cat) : collapsedCats.add(cat); render(); });
    const body = document.createElement('div'); body.className = 'cat-body';
    for (const w of arr) body.appendChild(cardEl(w));
    const prog = document.createElement('div'); prog.className = 'cat-progress';
    const pct = t ? Math.round(d / t * 100) : 0;
    const pbar = document.createElement('div'); pbar.className = 'bar'; pbar.style.width = pct + '%';
    prog.appendChild(pbar);
    sec.appendChild(head); sec.appendChild(prog); sec.appendChild(body);
    return sec;
  }
  function render() {
    if (currentTab === 'home') {
      document.body.classList.add('on-home');
      renderDashboard();
      updateStats();
      renderTabs();
      return;
    }
    document.body.classList.remove('on-home');
    const words = visibleWords();
    const byCat = {};
    for (const w of words) (byCat[w.cat] = byCat[w.cat] || []).push(w);
    list.innerHTML = '';
    let any = false;
    for (const cat of tabCats(currentTab)) {
      const arr = byCat[cat]; if (!arr || !arr.length) continue;
      any = true; list.appendChild(catEl(cat, arr));
    }
    if (!any) { const e = document.createElement('div'); e.className = 'empty'; e.textContent = '没有匹配的词条'; list.appendChild(e); }
    updateStats();
    renderTabs();
    renderCatFilter();
    updateToggleAll();
    updateReviewBtn();
  }
  function currentVocab() { return currentTab === 'home' ? VOCAB : tabVocab(currentTab); }
  function updateStats() {
    const tabV = currentVocab();
    const doneSet = new Set(Object.keys(state).filter(k => state[k] && state[k].count > 0).map(Number));
    let done = 0, total = 0;
    for (const w of tabV) { if (doneSet.has(w.id)) done++; total += state[w.id] ? (state[w.id].count || 0) : 0; }
    document.getElementById('done').textContent = done;
    document.getElementById('totalWords').textContent = tabV.length;
    document.getElementById('totalCount').textContent = total;
    const tpct = tabV.length ? Math.round(done / tabV.length * 100) : 0;
    const pb = document.getElementById('progressBar'); if (pb) pb.style.width = tpct + '%';
    const tc = document.getElementById('todayCount'); if (tc) tc.textContent = todayCount();
    const sk = document.getElementById('streak'); if (sk) sk.textContent = streak();
  }

  /* ---------- 首页仪表盘 ---------- */
  function checkedSet() {
    return new Set(Object.keys(state).filter(k => state[k] && state[k].count > 0).map(Number));
  }
  function renderDashboard() {
    const totalWords = VOCAB.length;
    const doneSet = checkedSet();
    let done = 0, total = 0;
    for (const w of VOCAB) { if (doneSet.has(w.id)) done++; total += (state[w.id] ? (state[w.id].count || 0) : 0); }
    const pct = totalWords ? Math.round(done / totalWords * 100) : 0;
    let m0 = 0, m1 = 0, m2 = 0;
    for (const w of VOCAB) {
      const m = (state[w.id] && state[w.id].mastery) || '未用';
      if (m === '未用') m0++; else if (m === '偶尔') m1++; else m2++;
    }
    const dash = document.createElement('div'); dash.className = 'dash';
    dash.appendChild(buildHero(totalWords, done, total, pct));
    dash.appendChild(buildWeekChart());
    dash.appendChild(buildTabsBreakdown(doneSet));
    dash.appendChild(buildMastery(m0, m1, m2));
    list.innerHTML = '';
    list.appendChild(dash);
  }
  function buildHero(totalWords, done, total, pct) {
    const hero = document.createElement('section'); hero.className = 'dash-hero';
    const R = 54, C = 2 * Math.PI * R, off = C * (1 - pct / 100);
    const ring = document.createElement('div'); ring.className = 'ring';
    ring.innerHTML =
      '<svg viewBox="0 0 140 140" width="140" height="140">' +
      '<defs><linearGradient id="rg" x1="0" y1="0" x2="1" y2="1">' +
      '<stop offset="0%" stop-color="#d4a017"/><stop offset="100%" stop-color="#b8861b"/></linearGradient></defs>' +
      '<circle cx="70" cy="70" r="' + R + '" fill="none" stroke="#e8e0d2" stroke-width="12"/>' +
      '<circle cx="70" cy="70" r="' + R + '" fill="none" stroke="url(#rg)" stroke-width="12" stroke-linecap="round" ' +
      'stroke-dasharray="' + C.toFixed(1) + '" stroke-dashoffset="' + off.toFixed(1) + '" transform="rotate(-90 70 70)"/>' +
      '<text x="70" y="63" text-anchor="middle" class="ring-pct">' + pct + '%</text>' +
      '<text x="70" y="86" text-anchor="middle" class="ring-cap">已打卡</text>' +
      '</svg>';
    const stats = document.createElement('div'); stats.className = 'hero-stats';
    const items = [
      { n: totalWords, l: '词条总量' },
      { n: done, l: '已打卡' },
      { n: total, l: '累计次数' },
      { n: todayCount(), l: '今日打卡' },
      { n: streak(), l: '连续天数' },
    ];
    for (const it of items) {
      const d = document.createElement('div'); d.className = 'hstat';
      d.innerHTML = '<b>' + it.n + '</b><span>' + it.l + '</span>';
      stats.appendChild(d);
    }
    hero.appendChild(ring); hero.appendChild(stats);
    return hero;
  }
  function buildTabsBreakdown(doneSet) {
    const sec = document.createElement('section'); sec.className = 'dash-section';
    sec.innerHTML = '<h2 class="dash-h">分类完成度</h2>';
    const grid = document.createElement('div'); grid.className = 'dash-grid';
    for (const t of TABS) {
      const v = tabVocab(t.id);
      let d = 0, s = 0;
      for (const w of v) { if (doneSet.has(w.id)) d++; s += (state[w.id] ? (state[w.id].count || 0) : 0); }
      const pct = v.length ? Math.round(d / v.length * 100) : 0;
      const card = document.createElement('button'); card.type = 'button'; card.className = 'dash-card'; card.style.setProperty('--tc', t.color);
      card.innerHTML =
        '<div class="dc-top"><span class="dc-ico">' + t.icon + '</span><span class="dc-name">' + t.name + '</span><span class="dc-num">' + d + '/' + v.length + '</span></div>' +
        '<div class="dc-bar"><div class="dc-fill" style="width:' + pct + '%"></div></div>' +
        '<div class="dc-sub">' + s + ' 次打卡</div>';
      card.addEventListener('click', () => { currentTab = t.id; try { localStorage.setItem(LS_TAB, currentTab); } catch (e) {} filters.cat = 'all'; closeSidebar(); render(); });
      grid.appendChild(card);
    }
    sec.appendChild(grid);
    return sec;
  }
  function buildMastery(m0, m1, m2) {
    const total = m0 + m1 + m2 || 1;
    const p = [m0, m1, m2].map(x => Math.round(x / total * 100));
    const sec = document.createElement('section'); sec.className = 'dash-section';
    sec.innerHTML = '<h2 class="dash-h">掌握度分布</h2>';
    const wrap = document.createElement('div'); wrap.className = 'mast-wrap';
    const items = [
      { label: '未用', n: m0, pct: p[0], cls: 'm0' },
      { label: '偶尔', n: m1, pct: p[1], cls: 'm1' },
      { label: '熟练', n: m2, pct: p[2], cls: 'm2' },
    ];
    for (const it of items) {
      const row = document.createElement('div'); row.className = 'mast-row';
      row.innerHTML =
        '<div class="mast-label">' + it.label + '</div>' +
        '<div class="mast-bar"><div class="mast-fill ' + it.cls + '" style="width:' + it.pct + '%"></div></div>' +
        '<div class="mast-num">' + it.n + ' <small>' + it.pct + '%</small></div>';
      wrap.appendChild(row);
    }
    sec.appendChild(wrap);
    return sec;
  }
  function weekTrend() {
    const now = new Date();
    const wd = now.getDay(); // 0=周日
    const offset = (wd === 0) ? 6 : (wd - 1); // 距本周一的天数
    const monday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - offset);
    const labels = ['一', '二', '三', '四', '五', '六', '日'];
    const arr = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(monday); d.setDate(monday.getDate() + i);
      const k = dayKey(d);
      arr.push({ label: labels[i], n: dailyStats[k] || 0, today: (i === offset) });
    }
    return arr;
  }
  function buildWeekChart() {
    const sec = document.createElement('section'); sec.className = 'dash-section';
    sec.innerHTML = '<h2 class="dash-h">本周打卡趋势</h2>';
    const data = weekTrend();
    let sum = 0; for (const d of data) sum += d.n;
    const totalEl = document.createElement('div'); totalEl.className = 'week-total'; totalEl.textContent = '本周共打卡 ' + sum + ' 次';
    sec.appendChild(totalEl);
    const wrap = document.createElement('div'); wrap.className = 'week-chart';
    const maxN = Math.max(1, ...data.map(d => d.n));
    for (const d of data) {
      const col = document.createElement('div'); col.className = 'wk-col' + (d.today ? ' today' : '');
      const h = Math.round(d.n / maxN * 100);
      col.innerHTML =
        '<div class="wk-bar-wrap"><div class="wk-num">' + (d.n || '') + '</div>' +
        '<div class="wk-bar" style="height:' + h + '%"></div></div>' +
        '<div class="wk-label">周' + d.label + '</div>';
      wrap.appendChild(col);
    }
    sec.appendChild(wrap);
    return sec;
  }
  function renderTabs() {
    const el = document.getElementById('tabs'); if (!el) return;
    el.innerHTML = '';
    // 首页（仪表盘）
    const home = document.createElement('button');
    home.className = 'tab tab-home' + (currentTab === 'home' ? ' active' : '');
    home.innerHTML = `<span class="t-ico">🏠</span><span class="t-name">首页</span>`;
    home.style.setProperty('--tc', '#b8861b');
    home.addEventListener('click', () => { currentTab = 'home'; try { localStorage.setItem(LS_TAB, currentTab); } catch (e) {} filters.cat = 'all'; closeSidebar(); render(); });
    el.appendChild(home);
    const sep = document.createElement('div'); sep.className = 'sb-sep'; el.appendChild(sep);
    for (const t of TABS) {
      const v = tabVocab(t.id);
      let d = 0, sum = 0;
      for (const w of v) { if (state[w.id] && state[w.id].count > 0) d++; sum += state[w.id] ? (state[w.id].count || 0) : 0; }
      const b = document.createElement('button');
      b.className = 'tab' + (t.id === currentTab ? ' active' : '');
      b.style.setProperty('--tc', t.color);
      b.innerHTML = `<span class="t-ico">${t.icon}</span><span class="t-name">${t.name}</span><span class="t-count">${d}<small>/${v.length}</small></span><small class="t-sum">${sum}次</small>`;
      b.addEventListener('click', () => { currentTab = t.id; try { localStorage.setItem(LS_TAB, currentTab); } catch (e) {} filters.cat = 'all'; closeSidebar(); render(); });
      el.appendChild(b);
    }
  }
  function renderCatFilter() {
    const cf = document.getElementById('catFilter'); if (!cf) return;
    cf.innerHTML = '';
    const all = document.createElement('button'); all.className = 'chip' + (filters.cat === 'all' ? ' active' : ''); all.dataset.cat = 'all'; all.textContent = '全部分类'; cf.appendChild(all);
    for (const c of tabCats(currentTab)) {
      const b = document.createElement('button'); b.className = 'chip' + (filters.cat === c ? ' active' : ''); b.dataset.cat = c; b.textContent = c; cf.appendChild(b);
    }
    cf.querySelectorAll('.chip').forEach(b => {
      b.addEventListener('click', () => {
        cf.querySelectorAll('.chip').forEach(x => x.classList.remove('active'));
        b.classList.add('active');
        filters.cat = b.dataset.cat;
        render();
      });
    });
  }

  /* ---------- 筛选 UI ---------- */
  function wireChips(container, attr, key) {
    container.querySelectorAll('.chip').forEach(b => {
      b.addEventListener('click', () => {
        container.querySelectorAll('.chip').forEach(x => x.classList.remove('active'));
        b.classList.add('active');
        filters[key] = b.dataset[attr];
        render();
      });
    });
  }
  wireChips(document.getElementById('statusFilter'), 'f', 'status');
  wireChips(document.getElementById('masteryFilter'), 'm', 'mastery');
  document.getElementById('search').addEventListener('input', e => { filters.q = e.target.value; render(); });

  /* ---------- 展开/收起全部分类 ---------- */
  const toggleAllBtn = document.getElementById('toggleAll');
  if (toggleAllBtn) toggleAllBtn.addEventListener('click', () => {
    const cats = tabCats(currentTab);
    if (!cats.length) return;
    const allCollapsed = cats.every(c => collapsedCats.has(c));
    if (allCollapsed) cats.forEach(c => collapsedCats.delete(c));
    else cats.forEach(c => collapsedCats.add(c));
    render();
  });
  function updateToggleAll() {
    if (!toggleAllBtn) return;
    const cats = tabCats(currentTab);
    const allCollapsed = cats.length > 0 && cats.every(c => collapsedCats.has(c));
    toggleAllBtn.textContent = allCollapsed ? '展开全部 ▾' : '收起全部 ▴';
  }

  /* ---------- 待复习：一键展开全部（集中补卡） ---------- */
  const expandReviewBtn = document.getElementById('expandReview');
  if (expandReviewBtn) expandReviewBtn.addEventListener('click', () => {
    const ws = visibleWords();
    let n = 0;
    for (const w of ws) { if (!openIds.has(w.id)) { openIds.add(w.id); n++; } }
    render();
    toast(n ? ('已展开 ' + n + ' 个待复习词条') : '待复习已全部展开');
  });
  function updateReviewBtn() {
    if (!expandReviewBtn) return;
    const on = filters.status === 'review' && currentTab !== 'home';
    expandReviewBtn.hidden = !on;
    if (on) { const n = visibleWords().length; expandReviewBtn.textContent = '展开待复习 (' + n + ') ▾'; }
  }

  /* ---------- 设置弹层 ---------- */
  const modal = document.getElementById('settingsModal');
  function closeSettings() { modal.classList.add('hidden'); }
  document.getElementById('settingsBtn').addEventListener('click', openSettings);
  const sb2 = document.getElementById('settingsBtn2'); if (sb2) sb2.addEventListener('click', () => { closeSidebar(); openSettings(); });
  document.getElementById('closeSettings').addEventListener('click', closeSettings);
  modal.addEventListener('click', e => { if (e.target === modal) closeSettings(); });

  /* ---------- 侧栏抽屉（移动端） ---------- */
  function openSidebar() { document.body.classList.add('sb-open'); }
  function closeSidebar() { document.body.classList.remove('sb-open'); }
  const menuBtn = document.getElementById('menuBtn');
  if (menuBtn) menuBtn.addEventListener('click', openSidebar);
  const menuBtn2 = document.getElementById('menuBtn2');
  if (menuBtn2) menuBtn2.addEventListener('click', openSidebar);
  const closeSidebarBtn = document.getElementById('closeSidebar');
  if (closeSidebarBtn) closeSidebarBtn.addEventListener('click', closeSidebar);
  const backdrop = document.getElementById('backdrop');
  if (backdrop) backdrop.addEventListener('click', closeSidebar);
  function openSettings() {
    document.getElementById('sbUrl').value = sbUrl;
    document.getElementById('sbKey').value = sbKey;
    setSbStatus(sbOn ? '已连接（本地 + 云端同步）' : '未连接，仅本地保存', sbOn ? 'ok' : '');
    modal.classList.remove('hidden');
  }
  function setSbStatus(msg, cls) { const s = document.getElementById('sbStatus'); s.textContent = msg; s.className = 'status ' + (cls || 'err'); }
  document.getElementById('sbSave').addEventListener('click', async () => {
    sbUrl = document.getElementById('sbUrl').value.trim();
    sbKey = document.getElementById('sbKey').value.trim();
    if (!sbUrl || !sbKey) { setSbStatus('请填写 URL 与 anon key', 'err'); return; }
    localStorage.setItem(LS_SB, JSON.stringify({ url: sbUrl, key: sbKey }));
    sbOn = true; setSbStatus('正在连接…', '');
    try {
      await syncPull(); await syncPushAll();
      await syncDailyPull(); migrateDailyFromState(); await syncDailyPushAll();
      render();
      setSbStatus('连接成功，已与云端同步', 'ok');
    } catch (e) { sbOn = false; setSbStatus('连接失败：' + e.message, 'err'); }
  });
  document.getElementById('sbClear').addEventListener('click', () => {
    sbUrl = ''; sbKey = ''; sbOn = false; localStorage.removeItem(LS_SB);
    document.getElementById('sbUrl').value = ''; document.getElementById('sbKey').value = '';
    setSbStatus('已断开，仅本地保存', '');
  });
  document.getElementById('exportBtn').addEventListener('click', () => {
    const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
    a.download = 'vocab-checkin-' + new Date().toISOString().slice(0, 10) + '.json'; a.click();
    toast('已导出 JSON');
  });
  const importFile = document.getElementById('importFile');
  document.getElementById('importBtn').addEventListener('click', () => importFile.click());
  importFile.addEventListener('change', () => {
    const f = importFile.files[0]; if (!f) return;
    const reader = new FileReader();
    reader.onload = () => {
      try { const obj = JSON.parse(reader.result); Object.assign(state, obj); save(); render(); toast('导入成功'); }
      catch (e) { toast('导入失败：格式错误'); }
    };
    reader.readAsText(f); importFile.value = '';
  });
  document.getElementById('resetBtn').addEventListener('click', () => {
    if (!confirm('确定清空本地全部打卡记录？此操作不可恢复（云端不受影响）。')) return;
    state = {}; save(); render(); toast('已清空');
  });

  /* ---------- Toast ---------- */
  let toastTimer;
  function toast(msg, actionLabel, actionFn) {
    const t = document.getElementById('toast');
    t.textContent = '';
    const s = document.createElement('span'); s.textContent = msg; t.appendChild(s);
    let dur = 1600;
    if (actionLabel && actionFn) {
      const b = document.createElement('button'); b.className = 'undo'; b.type = 'button'; b.textContent = actionLabel;
      b.addEventListener('click', () => { clearTimeout(toastTimer); t.classList.add('hidden'); actionFn(); });
      t.appendChild(b);
      dur = 4500;
    }
    t.classList.remove('hidden');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => t.classList.add('hidden'), dur);
  }

  /* ---------- 启动 ---------- */
  render();
  if (sbOn) {
    syncPull().then(() => syncPushAll())
      .then(syncDailyPull).then(migrateDailyFromState).then(syncDailyPushAll)
      .then(render).catch(e => toast('云端同步失败：' + e.message));
  }
})();
