(function () {
  'use strict';
  const LS_STATE = 'vocab_checkin_state_v1';
  const LS_SB = 'vocab_sb_config_v1';
  const LS_MINE = 'vocab_mine_v1';
  const MASTERY = ['未用', '偶尔', '熟练'];

  const VOCAB = window.VOCAB || [];
  const USES = window.CATEGORIES || [];
  const TOPICS = window.TOPICS || [];
  let state = {};
  let mine = {};
  let sbUrl = 'https://buzfmugezbemyfdmbgyt.supabase.co', sbKey = 'sb_publishable_HvD6YPPY-RpHLRicuoobSw_aSw1B_Ow', sbOn = true;
  const filters = { status: 'all', mastery: 'all', tier: 'all', use: 'all', q: '' };
  const desk = { q: '', use: 'all', topic: 'all' };
  const openIds = new Set();
  const collapsedGroups = new Set(USES);
  const isFiltering = () => filters.q.trim() || filters.status !== 'all' || filters.mastery !== 'all' || filters.tier !== 'all';

  /* ---------- 七个形式（tab）+ 首页 + 取用台 ---------- */
  const TABS = [
    { id: 'vocab', name: '词汇', icon: '📚', color: '#b8861b' },
    { id: 'phr',   name: '句式', icon: '✍️', color: '#2f8f9d' },
    { id: 'met',   name: '比喻', icon: '🎨', color: '#e07856' },
    { id: 'quote', name: '金句', icon: '💎', color: '#8a5cc4' },
    { id: 'diff',  name: '辨析', icon: '🔀', color: '#c0553a' },
    { id: 'humor', name: '幽默', icon: '😂', color: '#d4568a' },
    { id: 'cases', name: '案例', icon: '📒', color: '#3a6ea5' },
    { id: 'rule',  name: '规则', icon: '📐', color: '#6b8e23' },
  ];
  function tabOf(entry) { return (entry && entry.tab) || 'vocab'; }
  function tabName(id) { const t = TABS.find(x => x.id === id); return t ? t.name : id; }
  function tabVocab(tabId) { return VOCAB.filter(w => tabOf(w) === tabId); }
  function useOf(entry) { return (entry && entry.use && entry.use[0]) || '（未分）'; }
  function subUses(entry) { return (entry && entry.use && entry.use.slice(1)) || []; }
  function tabUses(tabId) {
    const s = new Set();
    for (const w of VOCAB) if (tabOf(w) === tabId) s.add(useOf(w));
    return USES.filter(u => s.has(u)).concat([...s].filter(u => USES.indexOf(u) < 0));
  }
  const LS_TAB = 'vocab_current_tab_v1';
  let currentTab = (function () { try { return localStorage.getItem(LS_TAB) || 'home'; } catch (e) { return 'home'; } })();

  /* 详情页字段名：按 tab 定制（同一字段在不同形式里叫法不同） */
  const LABELS = {
    vocab: ['口语化同义词', '释义', '例句', '使用场景'],
    phr:   ['同类句式', '用在什么时候', '例句', '使用场景'],
    met:   ['同类说法', '比喻背后的道理', '原话', '使用场景'],
    quote: ['同类说法', '这句话在讲什么', '原话', '使用场景'],
    diff:  ['选词口诀', '逐词辨析', '对比例句', '怎么选'],
    humor: ['同类梗', '笑点在哪', '原文', '适合什么场合'],
    cases: ['同类启示', '案例说明了什么', '案例', '适合什么场合'],
    rule:  ['要点', '说明', '例句', '使用场景'],
  };

  try { state = JSON.parse(localStorage.getItem(LS_STATE)) || {}; } catch (e) { state = {}; }
  try { mine = JSON.parse(localStorage.getItem(LS_MINE)) || {}; } catch (e) { mine = {}; }
  try { const c = JSON.parse(localStorage.getItem(LS_SB)); if (c && c.url && c.key) { sbUrl = c.url; sbKey = c.key; } } catch (e) {}
  sbOn = !!(sbUrl && sbKey);

  /* ---------- 每日打卡计数 ---------- */
  const LS_DAILY = 'vocab_daily_v1';
  let dailyStats = {};
  try { dailyStats = JSON.parse(localStorage.getItem(LS_DAILY)) || {}; } catch (e) { dailyStats = {}; }
  function dayKey(d) { return d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate(); }
  function saveDaily() { try { localStorage.setItem(LS_DAILY, JSON.stringify(dailyStats)); } catch (e) {} }

  /* ---------- Supabase REST 同步 ---------- */
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
  function baseDaily() { return sbUrl.replace(/\/$/, '') + '/rest/v1/daily_counter'; }
  async function syncDailyPull() {
    if (!sbOn) return;
    try {
      const rows = await fetch(baseDaily() + '?select=day,n', { headers: { apikey: sbKey, Authorization: 'Bearer ' + sbKey } }).then(r => { if (!r.ok) throw new Error(r.status); return r.json(); });
      for (const row of rows) dailyStats[row.day] = Math.max(dailyStats[row.day] || 0, row.n);
      saveDaily();
    } catch (e) {}
  }
  async function syncDailyPush(day, delta) {
    const cur = dailyStats[day] || 0;
    const n = Math.max(0, cur + delta);
    dailyStats[day] = n; saveDaily();
    if (!sbOn) return;
    try {
      await fetch(baseDaily(), {
        method: 'POST',
        headers: { apikey: sbKey, Authorization: 'Bearer ' + sbKey, 'Content-Type': 'application/json', Prefer: 'resolution=merge-duplicates,return=minimal' },
        body: JSON.stringify([{ day, n }])
      });
    } catch (e) {}
  }
  async function syncDailyPushAll() {
    if (!sbOn) return;
    for (const day in dailyStats) {
      try { await fetch(baseDaily(), { method: 'POST', headers: { apikey: sbKey, Authorization: 'Bearer ' + sbKey, 'Content-Type': 'application/json', Prefer: 'resolution=merge-duplicates,return=minimal' }, body: JSON.stringify([{ day, n: dailyStats[day] }]) }); } catch (e) {}
    }
  }
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

  /* ---------- 我的例句（写作回流）：本地存 + 可选云端 writing_log ---------- */
  function saveMine() { try { localStorage.setItem(LS_MINE, JSON.stringify(mine)); } catch (e) {} }
  function baseMine() { return sbUrl.replace(/\/$/, '') + '/rest/v1/writing_log'; }
  async function minePull() {
    if (!sbOn) return;
    try {
      const rows = await fetch(baseMine() + '?select=id,text,at', { headers: { apikey: sbKey, Authorization: 'Bearer ' + sbKey } }).then(r => { if (!r.ok) throw new Error(r.status); return r.json(); });
      for (const row of rows) {
        const l = mine[row.id];
        if (!l || (row.at && (!l.at || row.at > l.at))) mine[row.id] = { text: row.text || '', at: row.at || null };
      }
      saveMine();
    } catch (e) {}
  }
  async function minePush(id) {
    if (!sbOn) return;
    const v = mine[id]; if (!v) return;
    try {
      await fetch(baseMine(), {
        method: 'POST',
        headers: { apikey: sbKey, Authorization: 'Bearer ' + sbKey, 'Content-Type': 'application/json', Prefer: 'resolution=merge-duplicates,return=minimal' },
        body: JSON.stringify([{ id: +id, text: v.text, at: v.at }])
      });
    } catch (e) {}
  }
  async function minePushAll() {
    if (!sbOn) return;
    for (const id in mine) { try { await minePush(id); } catch (e) {} }
  }
  function setMine(id, text) {
    mine[id] = { text: text, at: new Date().toISOString() };
    saveMine(); render();
    if (sbOn) minePush(id);
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
    const terms = q.trim().split(/\s+/).filter(Boolean);
    if (!terms.length) return safe;
    const re = new RegExp('(' + terms.map(t => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|') + ')', 'gi');
    return safe.replace(re, '<mark>$1</mark>');
  }
  function stripEmoji(s) { return (s || '').replace(/^[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{2B00}-\u{2BFF}]\s*/u, ''); }
  function isToday(iso) { if (!iso) return false; const d = new Date(iso), n = new Date(); return d.getFullYear() === n.getFullYear() && d.getMonth() === n.getMonth() && d.getDate() === n.getDate(); }
  function fmt(iso) { if (!iso) return ''; const d = new Date(iso); const p = x => ('' + x).padStart(2, '0'); return `${d.getMonth() + 1}/${d.getDate()} ${p(d.getHours())}:${p(d.getMinutes())}`; }

  function copyText(text, okMsg) {
    const done = () => toast(okMsg || '已复制');
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(done).catch(() => fallback());
    } else fallback();
    function fallback() {
      try {
        const ta = document.createElement('textarea');
        ta.value = text; ta.style.position = 'fixed'; ta.style.opacity = '0';
        document.body.appendChild(ta); ta.focus(); ta.select();
        document.execCommand('copy'); document.body.removeChild(ta); done();
      } catch (e) { toast('复制失败，请手动选中'); }
    }
  }

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
    toast(`✓ 已打卡 · 今日第 ${todayCount()} 个`, '撤销', () => undoCheckIn(lastUndo));
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
      const v = state[id]; if (!v || !v.last_used) continue;
      const t = new Date(v.last_used);
      if (t.getFullYear() === y && t.getMonth() === mo && t.getDate() === d) c++;
    }
    return c;
  }
  function streak() {
    const days = new Set();
    for (const id in state) {
      const v = state[id]; if (!v || !v.last_used) continue;
      const t = new Date(v.last_used);
      days.add(t.getFullYear() + '-' + (t.getMonth() + 1) + '-' + t.getDate());
    }
    if (!days.size) return 0;
    let s = 0;
    const today = new Date();
    while (true) {
      const d = today.getFullYear() + '-' + (today.getMonth() + 1) + '-' + today.getDate();
      if (days.has(d)) { s++; today.setDate(today.getDate() - 1); } else break;
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
  function needReview(rec) {
    const lu = rec.last_used ? new Date(rec.last_used) : null;
    const days = lu ? Math.floor((Date.now() - lu.getTime()) / 86400000) : null;
    return (rec.count === 0) || (days === null) || (days > 7);
  }

  /* ---------- 搜索相关度 ---------- */
  function matchScore(w, q) {
    if (!q) return 0;
    const terms = q.trim().toLowerCase().split(/\s+/).filter(Boolean);
    if (!terms.length) return 0;
    const word = (w.word || '').toLowerCase(), syn = (w.syn || '').toLowerCase(),
      mean = (w.mean || '').toLowerCase(), ex = (w.example || '').toLowerCase(),
      sc = (w.scene || '').toLowerCase(), us = (w.use || []).join(' ').toLowerCase(),
      tn = tabName(w.tab).toLowerCase();
    let total = 0;
    for (const t of terms) {
      let best = 0;
      if (word === t) best = 120;
      else if (word.indexOf(t) >= 0) best = 100;
      else if (syn.indexOf(t) >= 0) best = 72;
      else if (us.indexOf(t) >= 0 || tn.indexOf(t) >= 0) best = 62;
      else if (mean.indexOf(t) >= 0) best = 50;
      else if (ex.indexOf(t) >= 0) best = 34;
      else if (sc.indexOf(t) >= 0) best = 24;
      if (!best) return -1;
      total += best;
    }
    return total;
  }

  /* ---------- 渲染：列表 ---------- */
  const list = document.getElementById('list');
  function visibleWords() {
    const q = filters.q.trim();
    let arr = VOCAB.filter(w => {
      if (tabOf(w) !== currentTab) return false;
      const rec = getRec(w.id);
      if (filters.status === 'unused' && rec.count > 0) return false;
      if (filters.status === 'used' && rec.count === 0) return false;
      if (filters.status === 'review' && !needReview(rec)) return false;
      if (filters.status === 'sham' && !(rec.count >= 3 && rec.mastery !== '熟练')) return false;
      if (filters.mastery !== 'all' && rec.mastery !== filters.mastery) return false;
      if (filters.tier !== 'all' && w.tier !== filters.tier) return false;
      if (filters.use !== 'all' && (w.use || []).indexOf(filters.use) < 0) return false;
      if (q && matchScore(w, q) < 0) return false;
      return true;
    });
    if (q) {
      const sc = {};
      for (const w of arr) sc[w.id] = matchScore(w, q);
      arr.sort((a, b) => sc[b.id] - sc[a.id]);
    }
    return arr;
  }
  function groupDone(use) {
    let d = 0, t = 0;
    for (const w of VOCAB) {
      if (useOf(w) !== use) continue;
      if (tabOf(w) !== currentTab) continue;
      t++; if (state[w.id] && state[w.id].count > 0) d++;
    }
    return { d, t };
  }
  function buildDetail(w, rec) {
    const d = document.createElement('div');
    d.className = 'detail';
    const q = filters.q.trim();
    const L = LABELS[w.tab] || LABELS.vocab;
    const rows = [];
    if (w.syn) rows.push([L[0], w.syn]);
    if (w.mean) rows.push([L[1], w.mean]);
    if (w.example) rows.push([L[2], w.example]);
    if (w.scene) rows.push([L[3], w.scene]);
    for (const [label, val] of rows) {
      const r = document.createElement('div'); r.className = 'row';
      r.innerHTML = `<div class="label">${esc(label)}</div><div class="val">${highlight(val, q)}</div>`;
      d.appendChild(r);
    }
    // 维度标签
    const tags = document.createElement('div'); tags.className = 'row';
    tags.innerHTML = `<div class="label">标签</div><div class="val"><span class="tag">${esc(tabName(w.tab))}</span>` +
      (w.use || []).map(u => `<span class="tag">${esc(u)}</span>`).join('') +
      (w.tier ? `<span class="tag t-${w.tier === '核心' ? 'a' : w.tier === '进阶' ? 'b' : 'c'}">${esc(w.tier)}</span>` : '') + '</div>';
    d.appendChild(tags);
    const rd = document.createElement('div'); rd.className = 'row';
    rd.innerHTML = `<div class="label">打卡记录</div><div class="val">首次 ${fmt(rec.first_used) || '—'} · 最近 ${fmt(rec.last_used) || '—'} · 共 ${rec.count || 0} 次</div>`;
    d.appendChild(rd);
    const m = document.createElement('div'); m.className = 'mastery';
    for (const mm of MASTERY) {
      const b = document.createElement('button');
      b.textContent = mm; if (rec.mastery === mm) b.className = 'on';
      b.addEventListener('click', ev => { ev.stopPropagation(); setMastery(w.id, mm); });
      m.appendChild(b);
    }
    d.appendChild(m);

    // 复制条
    const cp = document.createElement('div'); cp.className = 'act-row';
    const b1 = document.createElement('button'); b1.className = 'act primary'; b1.textContent = '⧉ 复制这条';
    b1.addEventListener('click', ev => { ev.stopPropagation(); copyText(w.word, '已复制：' + w.word.slice(0, 12)); });
    const b2 = document.createElement('button'); b2.className = 'act'; b2.textContent = '⧉ 复制详情';
    b2.addEventListener('click', ev => {
      ev.stopPropagation();
      const t = [w.word, w.syn ? L[0] + '：' + w.syn : '', w.mean ? L[1] + '：' + w.mean : '',
        w.example ? L[2] + '：' + w.example : '', w.scene ? L[3] + '：' + w.scene : ''].filter(Boolean).join('\n');
      copyText(t, '已复制整条详情');
    });
    cp.appendChild(b1); cp.appendChild(b2);
    d.appendChild(cp);

    // 我的例句（写作回流）
    const my = mine[w.id];
    const mb = document.createElement('div'); mb.className = 'mine-box';
    mb.innerHTML = '<div class="label">我的例句' + (my && my.at ? '<small>' + esc(fmt(my.at)) + '</small>' : '') + '</div>';
    const ta = document.createElement('textarea');
    ta.rows = 2; ta.placeholder = '写一句你自己用它造的话，存下来就是「我的表达」…';
    ta.value = (my && my.text) || '';
    ta.addEventListener('click', ev => ev.stopPropagation());
    const sb = document.createElement('button'); sb.className = 'act primary'; sb.textContent = '保存我的例句';
    sb.addEventListener('click', ev => { ev.stopPropagation(); setMine(w.id, ta.value.trim()); toast(ta.value.trim() ? '已存入「我的表达」' : '已清空'); });
    mb.appendChild(ta); mb.appendChild(sb);
    d.appendChild(mb);
    return d;
  }
  function cardEl(w) {
    const rec = getRec(w.id);
    const open = openIds.has(w.id);
    const q = filters.q.trim();
    const div = document.createElement('div');
    div.className = 'word' + (open ? ' open' : '') + (rec.count > 0 ? ' has-count' : '') + ' m-' + rec.mastery;
    const cbtn = document.createElement('button');
    cbtn.type = 'button';
    cbtn.className = 'checkin-btn' + (isToday(rec.last_used) ? ' today' : '');
    cbtn.setAttribute('aria-label', '打卡：' + w.word);
    cbtn.innerHTML = rec.count > 0 ? '<span class="n">' + rec.count + '</span>' : '<span class="plus">✚</span>';
    cbtn.addEventListener('click', e => { e.stopPropagation(); checkIn(w.id); });
    const tap = document.createElement('div'); tap.className = 'tap';
    const lastStr = lastUsedStr(rec.last_used);
    const extra = subUses(w).map(u => `<span class="utag">${esc(u)}</span>`).join('');
    const myDot = mine[w.id] && mine[w.id].text ? '<span class="mydot" title="我写过例句">✎</span>' : '';
    tap.innerHTML = `<div class="w-text">${highlight(w.word, q)}${myDot}</div>` +
      (w.syn ? `<div class="w-sub">${highlight(w.syn, q)}</div>` : '') +
      (extra || lastStr ? `<div class="w-foot">${extra}${lastStr ? `<span class="w-last">${esc(lastStr)}</span>` : ''}</div>` : '');
    tap.addEventListener('click', () => { open ? openIds.delete(w.id) : openIds.add(w.id); render(); });
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
  function groupEl(use, arr) {
    const sec = document.createElement('section');
    const collapsed = collapsedGroups.has(use) && !isFiltering() && !filters.q;
    sec.className = 'cat' + (collapsed ? ' collapsed' : '');
    const { d, t } = groupDone(use);
    const head = document.createElement('div'); head.className = 'cat-head';
    head.innerHTML = `<div><span class="name">${esc(use)}</span><span class="meta">已打卡 ${d}/${t}</span></div><span class="arrow">▾</span>`;
    head.addEventListener('click', () => { collapsedGroups.has(use) ? collapsedGroups.delete(use) : collapsedGroups.add(use); render(); });
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
      renderDashboard(); updateStats(); renderTabs(); return;
    }
    if (currentTab === 'desk') {
      document.body.classList.add('on-home');
      renderDesk(); updateStats(); renderTabs(); return;
    }
    document.body.classList.remove('on-home');
    const words = visibleWords();
    const byGroup = {};
    for (const w of words) (byGroup[useOf(w)] = byGroup[useOf(w)] || []).push(w);
    list.innerHTML = '';
    let any = false;
    for (const u of tabUses(currentTab)) {
      const arr = byGroup[u]; if (!arr || !arr.length) continue;
      any = true; list.appendChild(groupEl(u, arr));
    }
    if (!any) { const e = document.createElement('div'); e.className = 'empty'; e.textContent = '没有匹配的词条'; list.appendChild(e); }
    updateStats(); renderTabs(); renderUseFilter(); updateToggleAll(); updateReviewBtn();
  }
  function currentVocab() { return (currentTab === 'home' || currentTab === 'desk') ? VOCAB : tabVocab(currentTab); }
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
  function checkedSet() { return new Set(Object.keys(state).filter(k => state[k] && state[k].count > 0).map(Number)); }
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
    dash.appendChild(buildToday());
    dash.appendChild(buildBlind(doneSet));
    dash.appendChild(buildWeekChart());
    dash.appendChild(buildTabsBreakdown(doneSet));
    dash.appendChild(buildMastery(m0, m1, m2));
    dash.appendChild(buildMineList());
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
      { n: done, l: '已打卡词条' },
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

  /* 今日 5 条：按日期定种子，保证当天稳定；可换一批 */
  function mulberry32(a) {
    return function () {
      a |= 0; a = a + 0x6D2B79F5 | 0;
      let t = Math.imul(a ^ a >>> 15, 1 | a);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }
  function seedOf(str) { let h = 2166136261; for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
  const LS_TODAY_NONCE = 'vocab_today_nonce_v1';
  function pickToday() {
    let nonce = 0;
    try { nonce = +(localStorage.getItem(LS_TODAY_NONCE + dayKey(new Date())) || 0); } catch (e) {}
    const rnd = mulberry32(seedOf(dayKey(new Date()) + '#' + nonce));
    const stale = [], fresh = [];
    for (const w of VOCAB) {
      const rec = getRec(w.id);
      if (rec.count > 0 && needReview(rec)) stale.push(w);
      else if (rec.count === 0) fresh.push(w);
    }
    const shuffle = a => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); const t = a[i]; a[i] = a[j]; a[j] = t; } return a; };
    // 优先：待复习且属「核心/进阶」的，再补未碰过的
    const poolA = shuffle(stale.filter(w => w.tier !== '备用')).concat(shuffle(fresh.filter(w => w.tier !== '备用')));
    const poolB = shuffle(stale).concat(shuffle(fresh));
    const out = [], seen = new Set();
    for (const pool of [poolA, poolB]) {
      for (const w of pool) {
        if (out.length >= 5) break;
        if (seen.has(w.id)) continue;
        seen.add(w.id); out.push(w);
      }
      if (out.length >= 5) break;
    }
    return out;
  }
  function buildToday() {
    const sec = document.createElement('section'); sec.className = 'dash-section';
    const head = document.createElement('div'); head.className = 'sec-head';
    head.innerHTML = '<h2 class="dash-h">今日 5 条</h2>';
    const btn = document.createElement('button'); btn.className = 'link-btn'; btn.textContent = '换一批 ⟳';
    btn.addEventListener('click', () => {
      let n = 0; try { n = +(localStorage.getItem(LS_TODAY_NONCE + dayKey(new Date())) || 0); } catch (e) {}
      try { localStorage.setItem(LS_TODAY_NONCE + dayKey(new Date()), String(n + 1)); } catch (e) {}
      if (currentTab === 'home') renderDashboard();
    });
    head.appendChild(btn);
    sec.appendChild(head);
    const picks = pickToday();
    if (!picks.length) {
      const e = document.createElement('div'); e.className = 'empty'; e.textContent = '都打过卡了，去「取用台」找点新料'; sec.appendChild(e); return sec;
    }
    const wrap = document.createElement('div'); wrap.className = 'today-list';
    for (const w of picks) {
      const rec = getRec(w.id);
      const row = document.createElement('div'); row.className = 'today-row';
      row.innerHTML = '<div class="tr-main"><div class="tr-w">' + esc(w.word) + '</div>' +
        '<div class="tr-s">' + esc(w.syn || w.mean || '') + '</div></div>' +
        '<div class="tr-tags"><span class="tag">' + esc(tabName(w.tab)) + '</span>' +
        (rec.count ? '<span class="tag t-a">' + rec.count + '次</span>' : '<span class="tag t-c">没碰过</span>') + '</div>';
      const cb = document.createElement('button'); cb.className = 'tr-go'; cb.type = 'button'; cb.textContent = '打卡';
      cb.addEventListener('click', () => checkIn(w.id));
      row.appendChild(cb);
      wrap.appendChild(row);
    }
    sec.appendChild(wrap);
    return sec;
  }

  /* 使用盲区：只看「用途」维度（各形式的完成度已在下面单列，避免重复） */
  function buildBlind(doneSet) {
    const sec = document.createElement('section'); sec.className = 'dash-section';
    sec.innerHTML = '<h2 class="dash-h">使用盲区 <small>哪类用途你几乎没碰过</small></h2>';
    const rows = [];
    for (const u of USES) {
      let d = 0, t = 0;
      for (const w of VOCAB) { if (useOf(w) !== u) continue; t++; if (doneSet.has(w.id)) d++; }
      if (!t) continue;
      rows.push({ label: u, d, t, pct: Math.round(d / t * 100), use: u });
    }
    rows.sort((a, b) => a.pct - b.pct);
    const wrap = document.createElement('div'); wrap.className = 'blind-wrap';
    for (const r of rows.slice(0, 6)) {
      const row = document.createElement('button'); row.type = 'button'; row.className = 'blind-row';
      row.innerHTML = '<div class="bl-top"><span class="bl-name">' + esc(r.label) + '</span>' +
        '<span class="bl-num">' + r.d + '/' + r.t + '<small> ' + r.pct + '%</small></span></div>' +
        '<div class="dc-bar"><div class="dc-fill" style="width:' + r.pct + '%"></div></div>';
      row.addEventListener('click', () => {
        currentTab = 'vocab'; filters.use = r.use; filters.status = 'unused';
        filters.tier = 'all'; filters.mastery = 'all';
        try { localStorage.setItem(LS_TAB, currentTab); } catch (e) {}
        collapsedGroups.delete(r.use);
        syncChips(); closeSidebar(); render();
        toast('已筛出「' + r.label + '」里没打卡的');
      });
      wrap.appendChild(row);
    }
    sec.appendChild(wrap);
    // 假性掌握
    let sham = 0;
    for (const w of VOCAB) { const rec = getRec(w.id); if (rec.count >= 3 && rec.mastery !== '熟练') sham++; }
    if (sham > 0) {
      const b = document.createElement('button'); b.type = 'button'; b.className = 'blind-row sham-row';
      b.innerHTML = '<div class="bl-top"><span class="bl-name">⚠️ 看了 3 次以上却还没标「熟练」</span><span class="bl-num">' + sham + ' 条</span></div>' +
        '<div class="bl-sub">反复翻看≠记住。点开逐条自测，能默写出例句再标熟练。</div>';
      b.addEventListener('click', () => {
        currentTab = 'vocab'; filters.status = 'sham'; filters.use = 'all'; filters.tier = 'all'; filters.mastery = 'all';
        try { localStorage.setItem(LS_TAB, currentTab); } catch (e) {}
        syncChips(); closeSidebar(); render();
      });
      sec.appendChild(b);
    }
    return sec;
  }

  /* 我的表达 */
  function buildMineList() {
    const arr = Object.keys(mine).map(k => ({ id: +k, ...mine[k] })).filter(x => x.text).sort((a, b) => (b.at || '').localeCompare(a.at || ''));
    const sec = document.createElement('section'); sec.className = 'dash-section';
    sec.innerHTML = '<h2 class="dash-h">我的表达 <small>你亲手写过的句子</small></h2>';
    if (!arr.length) {
      const e = document.createElement('div'); e.className = 'empty';
      e.textContent = '还没有。展开任意一条 → 在「我的例句」写一句，这里就会长出来。';
      sec.appendChild(e); return sec;
    }
    const wrap = document.createElement('div'); wrap.className = 'mine-list';
    for (const it of arr.slice(0, 12)) {
      const w = VOCAB.find(x => x.id === it.id);
      const row = document.createElement('div'); row.className = 'mine-row';
      row.innerHTML = '<div class="mr-w">' + esc(w ? w.word : '(已删条目)') + '<small>' + esc(fmt(it.at)) + '</small></div>' +
        '<div class="mr-t">' + esc(it.text) + '</div>';
      const cp = document.createElement('button'); cp.className = 'mr-cp'; cp.type = 'button'; cp.textContent = '⧉';
      cp.addEventListener('click', () => copyText(it.text, '已复制我的例句'));
      row.appendChild(cp);
      wrap.appendChild(row);
    }
    if (arr.length > 12) { const m = document.createElement('div'); m.className = 'mine-more'; m.textContent = '共 ' + arr.length + ' 条，只显示最近 12 条'; wrap.appendChild(m); }
    sec.appendChild(wrap);
    return sec;
  }

  function buildTabsBreakdown(doneSet) {
    const sec = document.createElement('section'); sec.className = 'dash-section';
    sec.innerHTML = '<h2 class="dash-h">各形式完成度</h2>';
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
      card.addEventListener('click', () => { currentTab = t.id; try { localStorage.setItem(LS_TAB, currentTab); } catch (e) {} filters.use = 'all'; closeSidebar(); render(); });
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
    const wd = now.getDay();
    const offset = (wd === 0) ? 6 : (wd - 1);
    const monday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - offset);
    const labels = ['一', '二', '三', '四', '五', '六', '日'];
    const arr = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(monday); d.setDate(monday.getDate() + i);
      arr.push({ label: labels[i], n: dailyStats[dayKey(d)] || 0, today: (i === offset) });
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

  /* ---------- 取用台：写的时候调得出 ---------- */
  function deskResults() {
    let arr = VOCAB.slice();
    if (desk.use !== 'all') arr = arr.filter(w => (w.use || []).indexOf(desk.use) >= 0);
    if (desk.topic !== 'all') {
      const tp = TOPICS.find(t => t.name === desk.topic);
      if (tp) {
        arr = arr.filter(w => {
          const hay = (w.word + ' ' + (w.syn || '') + ' ' + (w.mean || '') + ' ' + (w.example || '') + ' ' + (w.scene || '')).toLowerCase();
          return tp.keys.some(k => hay.indexOf(k.toLowerCase()) >= 0);
        });
      }
    }
    const q = desk.q.trim();
    if (q) {
      const sc = {};
      for (const w of arr) { const s = matchScore(w, q); if (s >= 0) sc[w.id] = s; }
      arr = arr.filter(w => sc[w.id] >= 0).sort((a, b) => sc[b.id] - sc[a.id]);
    }
    return arr;
  }
  function renderDesk() {
    const wrap = document.createElement('div'); wrap.className = 'desk';
    const head = document.createElement('section'); head.className = 'desk-head';
    head.innerHTML = '<h2 class="dash-h">🎯 取用台 <small>按你要写的动作找料</small></h2>' +
      '<div class="desk-hint">输入你想表达的意思（例：这生意很稳 / 别人恐惧时我贪婪），或点下面的用途、主题。所有形式一起找。</div>';
    const inp = document.createElement('input');
    inp.type = 'search'; inp.className = 'desk-search'; inp.placeholder = '我想表达……';
    inp.value = desk.q;
    inp.addEventListener('input', () => { desk.q = inp.value; renderDeskBody(body); });
    head.appendChild(inp);
    const urow = document.createElement('div'); urow.className = 'chip-row desk-chips';
    const uAll = document.createElement('button'); uAll.className = 'chip' + (desk.use === 'all' ? ' active' : ''); uAll.textContent = '用途·全部';
    uAll.addEventListener('click', () => { desk.use = 'all'; renderDeskBody(body); markChips(urow, desk.use); });
    urow.appendChild(uAll);
    for (const u of USES) {
      const b = document.createElement('button'); b.className = 'chip' + (desk.use === u ? ' active' : ''); b.dataset.u = u;
      b.textContent = u;
      b.addEventListener('click', () => { desk.use = (desk.use === u ? 'all' : u); renderDeskBody(body); markChips(urow, desk.use); });
      urow.appendChild(b);
    }
    head.appendChild(urow);
    const trow = document.createElement('div'); trow.className = 'chip-row desk-chips';
    const tAll = document.createElement('button'); tAll.className = 'chip' + (desk.topic === 'all' ? ' active' : ''); tAll.textContent = '主题·全部';
    tAll.addEventListener('click', () => { desk.topic = 'all'; renderDeskBody(body); markChips(trow, desk.topic, 't'); });
    trow.appendChild(tAll);
    for (const tp of TOPICS) {
      const b = document.createElement('button'); b.className = 'chip' + (desk.topic === tp.name ? ' active' : ''); b.dataset.t = tp.name;
      b.textContent = tp.icon + ' ' + tp.name;
      b.addEventListener('click', () => { desk.topic = (desk.topic === tp.name ? 'all' : tp.name); renderDeskBody(body); markChips(trow, desk.topic, 't'); });
      trow.appendChild(b);
    }
    head.appendChild(trow);
    wrap.appendChild(head);
    const body = document.createElement('div'); body.id = 'deskBody';
    wrap.appendChild(body);
    list.innerHTML = ''; list.appendChild(wrap);
    renderDeskBody(body);
    function markChips(row, val, key) {
      row.querySelectorAll('.chip').forEach(x => {
        const v = key === 't' ? x.dataset.t : x.dataset.u;
        x.classList.toggle('active', val === 'all' ? !v : v === val);
      });
    }
  }
  function renderDeskBody(body) {
    const arr = deskResults();
    body.innerHTML = '';
    const meta = document.createElement('div'); meta.className = 'desk-meta';
    meta.textContent = '命中 ' + arr.length + ' 条' + (desk.q.trim() ? '（按相关度排序）' : '');
    body.appendChild(meta);
    if (!arr.length) {
      const e = document.createElement('div'); e.className = 'empty';
      e.textContent = '没找到。换个说法试试，比如只搜一个词。'; body.appendChild(e); return;
    }
    const CAP = 120;
    const shown = arr.slice(0, CAP);
    const byTab = {};
    for (const w of shown) (byTab[w.tab] = byTab[w.tab] || []).push(w);
    for (const t of TABS) {
      const rows = byTab[t.id]; if (!rows) continue;
      const sec = document.createElement('section'); sec.className = 'desk-group';
      sec.innerHTML = '<div class="dg-head"><span>' + t.icon + ' ' + t.name + '</span><span class="dg-n">' + rows.length + '</span></div>';
      for (const w of rows) {
        const row = document.createElement('div'); row.className = 'desk-row';
        const rec = getRec(w.id);
        const sub = (w.use || []).slice(1).map(u => '<span class="utag">' + esc(u) + '</span>').join('');
        row.innerHTML = '<div class="dr-main"><div class="dr-w">' + esc(w.word) + '</div>' +
          '<div class="dr-s">' + esc(w.syn || w.mean || '') + '</div></div>' +
          '<div class="dr-right">' + sub + (rec.count ? '<span class="dr-c">' + rec.count + '</span>' : '') + '<span class="dr-cp">⧉</span></div>';
        row.addEventListener('click', () => {
          copyText(w.word, '已复制：' + w.word.slice(0, 14));
          const c = row.querySelector('.dr-cp'); if (c) { c.textContent = '✓'; setTimeout(() => { c.textContent = '⧉'; }, 900); }
        });
        sec.appendChild(row);
      }
      body.appendChild(sec);
    }
    if (arr.length > CAP) {
      const m = document.createElement('div'); m.className = 'mine-more';
      m.textContent = '还有 ' + (arr.length - CAP) + ' 条未显示，再补一个关键词缩小范围'; body.appendChild(m);
    }
  }

  /* ---------- 侧栏 tab ---------- */
  function renderTabs() {
    const el = document.getElementById('tabs'); if (!el) return;
    el.innerHTML = '';
    const home = document.createElement('button');
    home.className = 'tab tab-home' + (currentTab === 'home' ? ' active' : '');
    home.innerHTML = '<span class="t-ico">🏠</span><span class="t-name">首页</span>';
    home.style.setProperty('--tc', '#b8861b');
    home.addEventListener('click', () => go('home'));
    el.appendChild(home);
    const deskBtn = document.createElement('button');
    deskBtn.className = 'tab tab-home' + (currentTab === 'desk' ? ' active' : '');
    deskBtn.innerHTML = '<span class="t-ico">🎯</span><span class="t-name">取用台</span>';
    deskBtn.style.setProperty('--tc', '#c0553a');
    deskBtn.addEventListener('click', () => go('desk'));
    el.appendChild(deskBtn);
    const sep = document.createElement('div'); sep.className = 'sb-sep'; el.appendChild(sep);
    for (const t of TABS) {
      const v = tabVocab(t.id);
      let d = 0, sum = 0;
      for (const w of v) { if (state[w.id] && state[w.id].count > 0) d++; sum += state[w.id] ? (state[w.id].count || 0) : 0; }
      const b = document.createElement('button');
      b.className = 'tab' + (t.id === currentTab ? ' active' : '');
      b.style.setProperty('--tc', t.color);
      b.innerHTML = `<span class="t-ico">${t.icon}</span><span class="t-name">${t.name}</span><span class="t-count">${d}<small>/${v.length}</small></span><small class="t-sum">${sum}次</small>`;
      b.addEventListener('click', () => go(t.id));
      el.appendChild(b);
    }
    function go(id) { currentTab = id; try { localStorage.setItem(LS_TAB, currentTab); } catch (e) {} filters.use = 'all'; closeSidebar(); render(); }
  }
  function renderUseFilter() {
    const cf = document.getElementById('catFilter'); if (!cf) return;
    cf.innerHTML = '';
    const all = document.createElement('button');
    all.className = 'chip' + (filters.use === 'all' ? ' active' : ''); all.dataset.use = 'all'; all.textContent = '全部用途';
    cf.appendChild(all);
    for (const u of tabUses(currentTab)) {
      const b = document.createElement('button');
      b.className = 'chip' + (filters.use === u ? ' active' : ''); b.dataset.use = u;
      b.textContent = u + ' ' + (function () { let t = 0; for (const w of VOCAB) if (tabOf(w) === currentTab && useOf(w) === u) t++; return t; })();
      cf.appendChild(b);
    }
    cf.querySelectorAll('.chip').forEach(b => {
      b.addEventListener('click', () => {
        cf.querySelectorAll('.chip').forEach(x => x.classList.remove('active'));
        b.classList.add('active');
        filters.use = b.dataset.use;
        // 单类筛选时自动展开该类
        if (filters.use !== 'all') collapsedGroups.delete(filters.use);
        render();
      });
    });
  }

  /* ---------- 筛选 UI ---------- */
  function wireChips(container, attr, key) {
    if (!container) return;
    container.querySelectorAll('.chip').forEach(b => {
      b.addEventListener('click', () => {
        container.querySelectorAll('.chip').forEach(x => x.classList.remove('active'));
        b.classList.add('active');
        filters[key] = b.dataset[attr];
        render();
      });
    });
  }
  function syncChips() {
    const map = [['statusFilter', 'f', 'status'], ['masteryFilter', 'm', 'mastery'], ['tierFilter', 't', 'tier']];
    for (const [id, attr, key] of map) {
      const c = document.getElementById(id); if (!c) continue;
      c.querySelectorAll('.chip').forEach(x => x.classList.toggle('active', x.dataset[attr] === filters[key]));
    }
    const cf = document.getElementById('catFilter');
    if (cf) cf.querySelectorAll('.chip').forEach(x => x.classList.toggle('active', x.dataset.use === filters.use));
  }
  wireChips(document.getElementById('statusFilter'), 'f', 'status');
  wireChips(document.getElementById('masteryFilter'), 'm', 'mastery');
  wireChips(document.getElementById('tierFilter'), 't', 'tier');
  document.getElementById('search').addEventListener('input', e => { filters.q = e.target.value; render(); });

  /* ---------- 展开/收起全部分类 ---------- */
  const toggleAllBtn = document.getElementById('toggleAll');
  if (toggleAllBtn) toggleAllBtn.addEventListener('click', () => {
    const gs = tabUses(currentTab);
    if (!gs.length) return;
    const allCollapsed = gs.every(c => collapsedGroups.has(c));
    if (allCollapsed) gs.forEach(c => collapsedGroups.delete(c));
    else gs.forEach(c => collapsedGroups.add(c));
    render();
  });
  function updateToggleAll() {
    if (!toggleAllBtn) return;
    const gs = tabUses(currentTab);
    const allCollapsed = gs.length > 0 && gs.every(c => collapsedGroups.has(c));
    toggleAllBtn.textContent = allCollapsed ? '展开全部 ▾' : '收起全部 ▴';
  }
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
    const on = (filters.status === 'review' || filters.status === 'sham') && currentTab !== 'home' && currentTab !== 'desk';
    expandReviewBtn.hidden = !on;
    if (on) expandReviewBtn.textContent = '展开全部 (' + visibleWords().length + ') ▾';
  }

  /* ---------- 设置弹层 ---------- */
  const modal = document.getElementById('settingsModal');
  function closeSettings() { modal.classList.add('hidden'); }
  document.getElementById('settingsBtn').addEventListener('click', openSettings);
  const sb2 = document.getElementById('settingsBtn2'); if (sb2) sb2.addEventListener('click', () => { closeSidebar(); openSettings(); });
  document.getElementById('closeSettings').addEventListener('click', closeSettings);
  modal.addEventListener('click', e => { if (e.target === modal) closeSettings(); });

  /* ---------- 侧栏抽屉 ---------- */
  function openSidebar() { document.body.classList.add('sb-open'); }
  function closeSidebar() { document.body.classList.remove('sb-open'); }
  const menuBtn = document.getElementById('menuBtn'); if (menuBtn) menuBtn.addEventListener('click', openSidebar);
  const menuBtn2 = document.getElementById('menuBtn2'); if (menuBtn2) menuBtn2.addEventListener('click', openSidebar);
  const closeSidebarBtn = document.getElementById('closeSidebar'); if (closeSidebarBtn) closeSidebarBtn.addEventListener('click', closeSidebar);
  const backdrop = document.getElementById('backdrop'); if (backdrop) backdrop.addEventListener('click', closeSidebar);
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
      await minePull(); await minePushAll();
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
    const blob = new Blob([JSON.stringify({ state: state, mine: mine }, null, 2)], { type: 'application/json' });
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
      try {
        const obj = JSON.parse(reader.result);
        if (obj && obj.state) { Object.assign(state, obj.state); if (obj.mine) { Object.assign(mine, obj.mine); saveMine(); } }
        else Object.assign(state, obj);
        save(); render(); toast('导入成功');
      } catch (e) { toast('导入失败：格式错误'); }
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
  if (['home', 'desk'].indexOf(currentTab) < 0 && !TABS.some(t => t.id === currentTab)) currentTab = 'home';
  render();
  if (sbOn) {
    syncPull().then(() => syncPushAll())
      .then(syncDailyPull).then(migrateDailyFromState).then(syncDailyPushAll)
      .then(minePull).then(minePushAll)
      .then(render).catch(e => toast('云端同步失败：' + e.message));
  }
})();
