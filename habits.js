/* 通用打卡模块：三层大标签中的「早睡」「方法」
 * 数据层：Supabase (habits + checkins 表)，与写作数据同通道。
 * 降级：若 Supabase 不可达（表未建 / 网络异常），自动回退 localStorage，不崩。
 *
 * v2 改动：
 *  - 方法界面全动态：渲染所有「非 sleep 且未归档」的 habit；支持新建/编辑/归档/恢复；
 *    每个方法自带统计（累计 / 本周 / 连续）与可展开的历史记录；字段全部由 habits.fields 驱动。
 *  - 早睡界面增强：统计卡（平均入睡 / 达标率 / 连续达标 / 累计）、当月热力日历、
 *    达标线可编辑、趋势图近 7 / 30 天切换。
 *  - habits 表需含 archived 字段（布尔，默认 false）。 */
(function () {
  'use strict';
  const SB_URL = 'https://buzfmugezbemyfdmbgyt.supabase.co';
  const SB_KEY = 'sb_publishable_HvD6YPPY-RpHLRicuoobSw_aSw1B_Ow';
  const LS = 'habit_logs_v1';

  // 种子习惯（仅本地降级 / 首次 seed 用；key 为业务稳定 ID）
  const SEED = [
    { key: 'sleep', name: '早睡打卡', icon: '🌙', color: '#3a6ea5', type: 'timed', target: '00:40',
      fields: [{ key: 'sleep_time', label: '入睡时间', type: 'time' }] },
    { key: 'buffett', name: '巴菲特阅读手段', icon: '💎', color: '#8a5cc4', type: 'pick', target: null, fields: [] },
    { key: 'xu', name: '徐新研究三原则', icon: '🔍', color: '#2f8f9d', type: 'pick', target: null, fields: [] },
    { key: 'covey1', name: '积极主动', icon: '🌱', color: '#b8861b', type: 'pick', target: null, fields: [] },
    { key: 'covey2', name: '以终为始', icon: '🎯', color: '#c08a1e', type: 'pick', target: null, fields: [] },
    { key: 'covey3', name: '要事第一', icon: '⏰', color: '#a87d18', type: 'pick', target: null, fields: [] },
    { key: 'covey4', name: '双赢思维', icon: '🤝', color: '#9c7220', type: 'pick', target: null, fields: [] },
    { key: 'covey5', name: '知彼解己', icon: '👂', color: '#cd9a2e', type: 'pick', target: null, fields: [] },
    { key: 'covey6', name: '统合综效', icon: '🧩', color: '#8f6a14', type: 'pick', target: null, fields: [] },
    { key: 'covey7', name: '不断更新', icon: '🔄', color: '#d4a838', type: 'pick', target: null, fields: [] },
    { key: 'concl-first', name: '结论优先', icon: '📌', color: '#c0504d', type: 'pick', target: null, fields: [] },
    { key: 'drawer', name: '抽屉分类', icon: '🗂️', color: '#1f9e8a', type: 'pick', target: null, fields: [] },
    { key: 'sandwich', name: '三明治回应', icon: '🥪', color: '#6a51a3', type: 'pick', target: null, fields: [] },
    { key: 'disagree', name: '表达不同意见', icon: '🤝', color: '#2f7ec4', type: 'pick', target: null, fields: [] }
  ];

  const ICONS = ['💎','🔍','📚','🧠','💡','🎯','🔬','📝','⚡','🌟','🧩','🚀','🔭','💼','📊','🗂️','🌱','🧭'];
  const PALETTE = ['#8a5cc4','#2f8f9d','#b8861b','#2f9e44','#c0504d','#3a6ea5','#d9883b','#6a51a3','#1f9e8a','#a8632b'];
  const FIELD_TYPES = ['text','number','time','select'];

  // 内置框架卡片的静态一句话简介（直接写在网页上，不进数据库，避免 reserved keyword 问题）
  const FRAME_DESC = {
    buffett: '每年海量阅读年报、财报与传记，用多学科思维模型看懂生意再下注。',
    xu: '靠一手消费者 / 专家访谈与赛道研判做长期投资，重仓真正看懂的生意。',
    covey1: '把精力放在影响圈，对自己的选择负责，不怨天尤人。',
    covey2: '先在脑中想清目标与原则，再以此为依据行动。',
    covey3: '优先做重要不紧急的事，以原则而非情绪安排时间。',
    covey4: '寻求互利的解决方案，把人际看作合作而非零和。',
    covey5: '先真心理解对方，再求被理解，移情倾听优先。',
    covey6: '尊重差异、取长补短，创造 1+1>2 的第三方案。',
    covey7: '在身体、精神、智力、社会情感四个维度持续投资自己。',
    'concl-first': '开口先给结论与核心判断，再展开依据，避免铺垫太长让人抓不住重点。',
    'drawer': '把混杂信息按维度拆成互不重叠的"抽屉"，一点一抽屉，避免内容交叉混乱。',
    'sandwich': '被质疑时先认可对方合理处、再陈述自己的依据、最后回到共识，不急于辩解。',
    'disagree': '提不同意见时先肯定对方合理的部分，再引出自己的观点，避免一开口就唱反调。'
  };

  let useCloud = false;
  let habits = [];
  const habitByKey = {};
  const habitById = {};
  let checkins = [];
  const localLogs = loadLocal();
  let sleepRange = 30; // 趋势图范围：7 / 30
  let sleepSub = 'home';   // 早睡子视图：home(总览) / checkin(打卡)
  let methodSub = 'home';  // 框架子视图：home(总览) / checkin(框架列表)

  function loadLocal() { try { return JSON.parse(localStorage.getItem(LS)) || {}; } catch (e) { return {}; } }
  function saveLocal() { localStorage.setItem(LS, JSON.stringify(localLogs)); }
  function todayKey() { const d = new Date(); return d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate(); }
  function nowStr() { const d = new Date(); const p = x => ('' + x).padStart(2, '0'); return p(d.getHours()) + ':' + p(d.getMinutes()); }
  function timeToMin(t) { const a = (t || '').split(':'); if (a.length < 2) return 0; return (+a[0]) * 60 + (+a[1]); }
  function localDayOf(iso) { const d = new Date(iso); return d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate(); }
  function dayDiff(a, b) { const x = new Date(a + 'T00:00:00'), y = new Date(b + 'T00:00:00'); return Math.round((y - x) / 86400000); }
  function esc(s) { return (s == null ? '' : ('' + s)).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }

  async function sbFetch(path, opts) {
    opts = opts || {};
    opts.headers = Object.assign({ 'apikey': SB_KEY, 'Authorization': 'Bearer ' + SB_KEY }, opts.headers || {});
    const res = await fetch(SB_URL + '/rest/v1/' + path, opts);
    if (!res.ok) throw new Error('SB ' + res.status);
    if (res.status === 204) return null;
    return res.json();
  }

  async function initCloud() {
    try {
      const hs = await sbFetch('habits?select=*&order=sort.asc');
      useCloud = true;
      if (!hs || hs.length === 0) {
        const ins = SEED.map((h, i) => ({ key: h.key, name: h.name, icon: h.icon, color: h.color, type: h.type, target: h.target, fields: h.fields, sort: i, archived: false }));
        const created = await sbFetch('habits?select=*', { method: 'POST', headers: { 'Content-Type': 'application/json', 'Prefer': 'return=representation' }, body: JSON.stringify(ins) });
        habits = created && created.length ? created : ins.map((h, i) => ({ ...h, id: i + 1 }));
      } else {
        habits = hs;
      }
      indexHabits();
      checkins = await sbFetch('checkins?select=*&order=ts.desc') || [];
      await migrateLocal();
    } catch (e) {
      useCloud = false;
      habits = SEED.map((h, i) => ({ ...h, id: h.key }));
      indexHabits();
    }
  }

  function indexHabits() {
    habits.forEach(h => { habitByKey[h.key] = h; habitById[h.id] = h; });
  }

  async function migrateLocal() {
    if (checkins.length > 0) return;
    if (!localLogs || !Object.keys(localLogs).length) return;
    const has = Object.keys(localLogs).some(k => localLogs[k] && localLogs[k].length);
    if (!has) return;
    for (const key of Object.keys(localLogs)) {
      const h = habitByKey[key]; if (!h) continue;
      for (const rec of localLogs[key]) {
        await postCheckin(h.id, rec.ts || new Date(rec.day).toISOString(), rec.value);
      }
    }
    checkins = await sbFetch('checkins?select=*&order=ts.desc') || [];
  }

  async function postCheckin(habitId, ts, value) {
    if (!useCloud) {
      const key = (habitById[habitId] && habitById[habitId].key) || habitId;
      localLogs[key] = localLogs[key] || [];
      localLogs[key].push({ day: localDayOf(ts), ts, value });
      saveLocal(); return;
    }
    await sbFetch('checkins', { method: 'POST', headers: { 'Content-Type': 'application/json', 'Prefer': 'return=representation' }, body: JSON.stringify({ habit_id: habitId, ts, value }) });
    checkins = await sbFetch('checkins?select=*&order=ts.desc') || [];
  }

  async function deleteCheckin(id) {
    if (!useCloud) return;
    await sbFetch('checkins?id=eq.' + id, { method: 'DELETE' });
    checkins = checkins.filter(c => c.id !== id);
  }

  // ---------- habits CRUD ----------
  async function upsertHabit(data, existingId) {
    if (!useCloud) { toast('本地模式暂不支持新建/编辑'); return null; }
    const body = {
      name: data.name, icon: data.icon, color: data.color, type: data.type || 'pick',
      target: data.target == null ? null : data.target, fields: data.fields, archived: false
    };
    if (existingId != null) {
      await sbFetch('habits?id=eq.' + existingId, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    } else {
      const maxSort = habits.reduce((m, h) => Math.max(m, h.sort || 0), 0);
      body.key = 'h_' + Date.now().toString(36);
      body.sort = maxSort + 1;
      await sbFetch('habits', { method: 'POST', headers: { 'Content-Type': 'application/json', 'Prefer': 'return=representation' }, body: JSON.stringify(body) });
    }
    habits = await sbFetch('habits?select=*&order=sort.asc') || [];
    indexHabits();
    return true;
  }

  async function setArchived(id, archived) {
    if (!useCloud) { toast('本地模式暂不支持归档'); return; }
    await sbFetch('habits?id=eq.' + id, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ archived }) });
    habits = await sbFetch('habits?select=*&order=sort.asc') || [];
    indexHabits();
  }

  function todaysOf(key) {
    if (!useCloud) return (localLogs[key] || []).filter(r => r.day === todayKey());
    const h = habitByKey[key]; if (!h) return [];
    return checkins.filter(c => c.habit_id === h.id && localDayOf(c.ts) === todayKey());
  }
  function allOf(key) {
    if (!useCloud) return (localLogs[key] || []).slice();
    const h = habitByKey[key]; if (!h) return [];
    return checkins.filter(c => c.habit_id === h.id);
  }
  async function deleteRec(key, rec) {
    if (useCloud && rec.id != null) { await deleteCheckin(rec.id); return; }
    const day = rec.day || localDayOf(rec.ts);
    localLogs[key] = (localLogs[key] || []).filter(r => (r.day || localDayOf(r.ts)) !== day);
    saveLocal();
  }

  /* ---------- 模块切换 ---------- */
  const MODS = ['writing', 'sleep', 'method'];
  function showMod(m) {
    closeSb();
    MODS.forEach(x => { const el = document.getElementById('mod-' + x); if (el) el.hidden = (x !== m); });
    document.querySelectorAll('.btab').forEach(b => b.classList.toggle('active', b.dataset.mod === m));
    try { localStorage.setItem('vocab_bigmod', m); } catch (e) {}
    if (m === 'sleep') renderSleep();
    if (m === 'method') renderMethod();
  }
  document.querySelectorAll('.btab').forEach(b => b.addEventListener('click', () => showMod(b.dataset.mod)));

  // 早睡 / 框架 两个子模块各自的左侧抽屉（菜单/遮罩/关闭）
  function wireSidebars() {
    closeSb();
    const pairs = [['sleepMenu', 'sleepBackdrop', 'sleepClose'], ['methodMenu', 'methodBackdrop', 'methodClose']];
    for (const [m, b, c] of pairs) {
      const me = document.getElementById(m), bd = document.getElementById(b), ce = document.getElementById(c);
      if (me) me.addEventListener('click', () => document.body.classList.add('sb-open'));
      if (bd) bd.addEventListener('click', closeSb);
      if (ce) ce.addEventListener('click', closeSb);
    }
  }
  wireSidebars();

  /* ---------- 字段输入控件 ---------- */
  function fieldEl(f, val) {
    if (f.type === 'select') {
      const wrap = document.createElement('div'); wrap.className = 'habit-form';
      const lab = document.createElement('label'); lab.textContent = f.label; wrap.appendChild(lab);
      const chips = document.createElement('div'); chips.className = 'chips';
      let cur = val || f.options[0];
      f.options.forEach(o => {
        const s = document.createElement('span'); s.textContent = o; if (o === cur) s.className = 'on';
        s.addEventListener('click', () => { chips.querySelectorAll('span').forEach(x => x.classList.remove('on')); s.classList.add('on'); });
        chips.appendChild(s);
      });
      wrap.appendChild(chips);
      return { el: wrap, getValue: () => ((chips.querySelector('span.on') || {}).textContent) || f.options[0] };
    }
    const wrap = document.createElement('div'); wrap.className = 'habit-form';
    const lab = document.createElement('label'); lab.textContent = f.label; wrap.appendChild(lab);
    let inp;
    if (f.type === 'number') { inp = document.createElement('input'); inp.type = 'number'; }
    else if (f.type === 'time') { inp = document.createElement('input'); inp.type = 'time'; inp.value = val || nowStr(); }
    else { inp = document.createElement('input'); inp.type = 'text'; inp.value = val || ''; }
    wrap.appendChild(inp);
    return { el: wrap, getValue: () => inp.value };
  }

  function getFields(key) { const h = habitByKey[key]; return (h && h.fields) || []; }
  function getHabit(key) { return habitByKey[key]; }

  // ---------- 通用统计 ----------
  function methodHabits() { return habits.filter(h => h.key !== 'sleep' && !h.archived); }
  function archivedHabits() { return habits.filter(h => h.key !== 'sleep' && h.archived); }

  // 熟练度（参考词汇打卡：未用 / 偶尔 / 熟练，按累计实践次数自动判定）
  function methodLevel(key) {
    const n = allOf(key).length;
    if (n === 0) return { label: '未用', cls: 'lv0' };
    if (n <= 2) return { label: '偶尔', cls: 'lv1' };
    return { label: '熟练', cls: 'lv2' };
  }

  function recsOf(key) { return allOf(key).slice().sort((a, b) => new Date(a.ts) - new Date(b.ts)); }

  function weekCount(key) {
    const recs = allOf(key); const wk = todayKey();
    return recs.filter(r => dayDiff(localDayOf(r.ts), wk) >= 0 && dayDiff(localDayOf(r.ts), wk) <= 6).length;
  }
  function streakOf(key) {
    const days = new Set(allOf(key).map(r => localDayOf(r.ts)));
    if (days.size === 0) return 0;
    let s = 0; const d = new Date();
    // 若今天没打卡，从昨天起算连续
    if (!days.has(todayKey())) d.setDate(d.getDate() - 1);
    while (days.has(d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate())) {
      s++; d.setDate(d.getDate() - 1);
    }
    return s;
  }

  /* ---------- 早睡模块 ---------- */
  function minToHHMM(m) {
    m = Math.round(m);
    const h = ((Math.floor(m / 60)) % 24 + 24) % 24;
    const mm = ((m % 60) + 60) % 60;
    return (h < 10 ? '0' : '') + h + ':' + (mm < 10 ? '0' : '') + mm;
  }
  // 跨午夜偏移轴：21:00 起算，00:xx 放到次日段，使"早于 target 即达标"在 23:xx~00:xx 正确
  function sleepOffset(t) { const m = timeToMin(t); return m < 1260 ? m + 1440 : m; }

  function sleepStats() {
    const recs = recsOf('sleep');
    if (!recs.length) return null;
    const pts = recs.map(r => sleepOffset((r.value && r.value.sleep_time) || '00:40'));
    const avg = pts.reduce((a, b) => a + b, 0) / pts.length;
    const tgt = sleepOffset(getHabit('sleep').target);
    const hit = recs.filter(r => r.value && r.value.on_target).length;
    // 连续达标（结束于今天/昨天）
    const days = new Set(recs.filter(r => r.value && r.value.on_target).map(r => localDayOf(r.ts)));
    let s = 0; const d = new Date();
    if (!days.has(todayKey())) d.setDate(d.getDate() - 1);
    while (days.has(d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate())) { s++; d.setDate(d.getDate() - 1); }
    return { avg: avg, rate: hit / recs.length, streakHit: s, total: recs.length, target: getHabit('sleep').target };
  }

  function buildStatsCard(stats, editableTarget) {
    const card = document.createElement('div'); card.className = 'stat-card';
    const items = [
      { n: stats.avg ? minToHHMM(stats.avg % 1440) : '—', l: '平均入睡' },
      { n: Math.round(stats.rate * 100) + '%', l: '达标率' },
      { n: stats.streakHit, l: '连续达标' },
      { n: stats.total, l: '累计打卡' }
    ];
    items.forEach(it => {
      const d = document.createElement('div'); d.className = 'stat';
      d.innerHTML = '<div class="sn">' + it.n + '</div><div class="sl">' + it.l + '</div>';
      card.appendChild(d);
    });
    if (editableTarget) {
      const tg = document.createElement('div'); tg.className = 'stat target-stat';
      tg.innerHTML = '<div class="sn" id="sleep-target-val">' + (stats.target || '00:40') + '</div><div class="sl">达标线 · 点改 ✎</div>';
      tg.addEventListener('click', () => editSleepTarget(tg));
      card.appendChild(tg);
    }
    return card;
  }

  function editSleepTarget(el) {
    const cur = getHabit('sleep').target || '00:40';
    el.innerHTML = '<input type="time" id="sleep-target-input" value="' + cur + '" style="font-size:15px;width:70px">';
    const inp = el.querySelector('input');
    inp.focus();
    const save = async () => {
      const v = inp.value || cur;
      if (useCloud) {
        await sbFetch('habits?key=eq.sleep', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ target: v }) });
        habits = await sbFetch('habits?select=*&order=sort.asc') || []; indexHabits();
      } else { toast('本地模式不可改'); }
      renderSleep();
    };
    inp.addEventListener('change', save);
    inp.addEventListener('blur', save);
  }

  function buildHeatmap() {
    const wrap = document.createElement('div'); wrap.className = 'sleep-heat';
    wrap.innerHTML = '<div class="sec-t">🗓️ 本月打卡热力</div>';
    const now = new Date();
    const y = now.getFullYear(), m = now.getMonth();
    const days = new Date(y, m + 1, 0).getDate();
    const recByDay = {};
    recsOf('sleep').forEach(r => { recByDay[localDayOf(r.ts)] = r; });
    const grid = document.createElement('div'); grid.className = 'heat-grid';
    for (let d = 1; d <= days; d++) {
      const k = y + '-' + (m + 1) + '-' + d;
      const cell = document.createElement('div'); cell.className = 'heat-cell';
      const rec = recByDay[k];
      if (rec) cell.classList.add(rec.value && rec.value.on_target ? 'hit' : 'miss');
      cell.textContent = d;
      cell.title = k + (rec ? (' · ' + (rec.value.sleep_time) + (rec.value.on_target ? ' 达标' : ' 未达标')) : ' · 未打卡');
      grid.appendChild(cell);
    }
    wrap.appendChild(grid);
    const legend = document.createElement('div'); legend.className = 'heat-legend';
    legend.innerHTML = '<span><i class="dot hit"></i>达标</span><span><i class="dot miss"></i>未达标</span><span><i class="dot"></i>未打卡</span>';
    wrap.appendChild(legend);
    return wrap;
  }

  function buildTrend(recs) {
    const wrap = document.createElement('div'); wrap.className = 'sleep-trend';
    const head = document.createElement('div'); head.className = 'sec-t';
    head.innerHTML = '📈 入睡时间趋势';
    const toggle = document.createElement('div'); toggle.className = 'range-toggle';
    [7, 30].forEach(n => {
      const b = document.createElement('span'); b.textContent = '近' + n + '天';
      if (sleepRange === n) b.className = 'on';
      b.addEventListener('click', () => { sleepRange = n; renderSleep(); });
      toggle.appendChild(b);
    });
    head.appendChild(toggle);
    wrap.appendChild(head);

    const data = recs.slice(Math.max(0, recs.length - sleepRange));
    if (data.length < 2) {
      const tip = document.createElement('div'); tip.className = 'trend-empty';
      tip.textContent = recs.length === 0 ? '还没有打卡记录' : '至少打卡 2 天才能看到趋势';
      wrap.appendChild(tip); return wrap;
    }
    const W = 360, H = 172, padL = 38, padR = 12, padT = 14, padB = 26;
    const pts = data.map(r => sleepOffset((r.value && r.value.sleep_time) || '00:40'));
    let minM = Math.min.apply(null, pts), maxM = Math.max.apply(null, pts);
    if (maxM - minM < 60) { const c = (minM + maxM) / 2; minM = c - 30; maxM = c + 30; }
    minM -= 15; maxM += 15;
    const n = pts.length;
    const X = i => padL + (n === 1 ? 0 : (i / (n - 1)) * (W - padL - padR));
    const Y = m => padT + (1 - (m - minM) / (maxM - minM)) * (H - padT - padB);
    const tMin = sleepOffset(getHabit('sleep').target);
    let s = '<svg class="trend-svg" viewBox="0 0 ' + W + ' ' + H + '" preserveAspectRatio="xMidYMid meet">';
    for (let k = 0; k <= 2; k++) {
      const m = minM + (maxM - minM) * k / 2;
      const yy = Y(m);
      s += '<line x1="' + padL + '" y1="' + yy.toFixed(1) + '" x2="' + (W - padR) + '" y2="' + yy.toFixed(1) + '" stroke="#ece5d6"/>';
      s += '<text x="' + (padL - 4) + '" y="' + (yy + 3).toFixed(1) + '" text-anchor="end">' + minToHHMM(m % 1440) + '</text>';
    }
    if (tMin >= minM && tMin <= maxM) {
      const ty = Y(tMin);
      s += '<line x1="' + padL + '" y1="' + ty.toFixed(1) + '" x2="' + (W - padR) + '" y2="' + ty.toFixed(1) + '" stroke="#2f9e44" stroke-width="1" stroke-dasharray="4 4"/>';
      s += '<text x="' + (W - padR) + '" y="' + (ty - 3).toFixed(1) + '" text-anchor="end" fill="#2f9e44">' + minToHHMM(tMin % 1440) + ' 达标线</text>';
    }
    let line = '';
    data.forEach((r, i) => { line += X(i).toFixed(1) + ',' + Y(pts[i]).toFixed(1) + ' '; });
    s += '<polyline points="' + line.trim() + '" fill="none" stroke="#b8861b" stroke-width="2" stroke-linejoin="round"/>';
    data.forEach((r, i) => {
      const onT = r.value && r.value.on_target;
      const col = onT ? '#2f9e44' : '#b8861b';
      const lab = localDayOf(r.ts) + ' ' + ((r.value && r.value.sleep_time) || '');
      s += '<circle cx="' + X(i).toFixed(1) + '" cy="' + Y(pts[i]).toFixed(1) + '" r="3" fill="' + col + '"><title>' + lab + '</title></circle>';
    });
    s += '<text x="' + X(0).toFixed(1) + '" y="' + (H - 8) + '" text-anchor="start">' + localDayOf(data[0].ts).slice(5) + '</text>';
    s += '<text x="' + X(n - 1).toFixed(1) + '" y="' + (H - 8) + '" text-anchor="end">' + localDayOf(data[n - 1].ts).slice(5) + '</text>';
    s += '</svg>';
    wrap.innerHTML += s;
    return wrap;
  }

  function buildHistory(recs, key) {
    const wrap = document.createElement('div'); wrap.className = 'sleep-history';
    wrap.innerHTML = '<div class="sec-t">📋 历史记录 <span class="cnt">' + recs.length + '</span></div>';
    if (!recs.length) { const e = document.createElement('div'); e.className = 'trend-empty'; e.textContent = '暂无记录'; wrap.appendChild(e); return wrap; }
    const ul = document.createElement('div'); ul.className = 'hist-list';
    recs.slice().reverse().forEach(r => {
      const t = (r.value && r.value.sleep_time) || '';
      const onT = r.value && r.value.on_target;
      const day = localDayOf(r.ts);
      const item = document.createElement('div'); item.className = 'hist-item' + (onT ? ' ok' : '');
      item.innerHTML = '<span class="hd">' + day.slice(5) + '</span><span class="ht">' + (t || '—') + '</span><span class="hb">' + (onT ? '🌟达标' : '—') + '</span>';
      const del = document.createElement('button'); del.className = 'hist-del'; del.textContent = '×';
      del.addEventListener('click', async () => { await deleteRec(key, r); renderSleep(); toast('已删除'); });
      item.appendChild(del);
      ul.appendChild(item);
    });
    wrap.appendChild(ul);
    return wrap;
  }

  function renderSleep() {
    renderSleepSidebar();
    const root = document.getElementById('sleep-list'); if (!root) return;
    root.innerHTML = '';
    if (sleepSub === 'home') buildSleepHome(root); else buildSleepCheckin(root);
  }

  function buildSleepCheckin(root) {
    const h = getHabit('sleep');
    const today = todaysOf('sleep')[0];

    // 打卡卡片
    const card = document.createElement('div'); card.className = 'habit-card'; card.style.setProperty('--hc', h.color);
    let html = '<div class="hc-top"><div class="hc-ico">' + h.icon + '</div><div class="hc-name">' + h.name + '</div>';
    html += today ? '<span class="ok-badge">已打卡 ' + ((today.value && today.value.sleep_time) || '') + ((today.value && today.value.on_target) ? ' 🌟达标' : '') + '</span>' : '<span class="hc-status">今日未打卡</span>';
    html += '</div>';
    card.innerHTML = html;

    if (today) {
      const undo = document.createElement('button'); undo.className = 'btn-ghost'; undo.style.marginTop = '10px'; undo.textContent = '撤销今日打卡';
      undo.addEventListener('click', async () => {
        if (useCloud && today.id != null) await deleteCheckin(today.id);
        else { localLogs.sleep = (localLogs.sleep || []).filter(r => r.day !== todayKey()); saveLocal(); }
        renderSleep(); toast('已撤销');
      });
      card.appendChild(undo);
    } else {
      const form = document.createElement('div'); form.className = 'habit-form'; form.style.marginTop = '8px';
      const lab = document.createElement('label'); lab.textContent = '入睡时间（默认现在，可改）';
      const ti = document.createElement('input'); ti.type = 'time'; ti.value = nowStr();
      const btn = document.createElement('button'); btn.className = 'btn-primary'; btn.textContent = '打卡';
      btn.addEventListener('click', async () => {
        const t = ti.value || nowStr();
        const onTarget = sleepOffset(t) <= sleepOffset(h.target);
        await postCheckin(h.id, new Date().toISOString(), { sleep_time: t, on_target: onTarget });
        renderSleep(); toast('✓ 已打卡 · ' + (onTarget ? '🌟达标' : '未达标'));
      });
      form.appendChild(lab); form.appendChild(ti); form.appendChild(btn);
      card.appendChild(form);
    }
    const strip = document.createElement('div'); strip.className = 'week-strip';
    const wk = [];
    for (let i = 6; i >= 0; i--) { const d = new Date(); d.setDate(d.getDate() - i); wk.push(d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate()); }
    wk.forEach(k => {
      const rec = recsOf('sleep').find(r => localDayOf(r.ts) === k);
      const el = document.createElement('div'); el.className = 'd' + (rec ? ' on' : '');
      el.textContent = rec ? rec.value.sleep_time : k.replace(/-/g, '/').slice(5);
      strip.appendChild(el);
    });
    card.appendChild(strip);
    root.appendChild(card);

    // 统计卡
    const st = sleepStats();
    if (st) root.appendChild(buildStatsCard(st, true));
    // 趋势
    root.appendChild(buildTrend(recsOf('sleep')));
    // 历史
    root.appendChild(buildHistory(recsOf('sleep'), 'sleep'));

    if (!useCloud) { const tag = document.createElement('div'); tag.style.cssText = 'font-size:11px;color:#999;margin-top:6px'; tag.textContent = '（本地模式：去 Supabase 跑 habits_schema.sql 后自动转云端）'; root.appendChild(tag); }
  }

  function buildSleepHome(root) {
    const st = sleepStats();
    const dash = document.createElement('div'); dash.className = 'dash';
    if (st) {
      const items = [
        { n: minToHHMM(st.avg % 1440), l: '平均入睡' },
        { n: Math.round(st.rate * 100) + '%', l: '达标率' },
        { n: st.streakHit, l: '连续达标' },
        { n: st.total, l: '累计打卡' }
      ];
      dash.appendChild(buildHero(items, Math.round(st.rate * 100), '达标率', 'rg-sleep'));
    } else {
      dash.appendChild(emptyHome('🌙', '还没有早睡打卡记录', '去「打卡」记录一次，这里会显示平均入睡与达标率'));
    }
    // 本月热力（总览核心）
    dash.appendChild(buildHeatmap());
    // 最近一次
    const recs = recsOf('sleep');
    if (recs.length) {
      const last = recs[recs.length - 1];
      const sec = document.createElement('section'); sec.className = 'dash-section';
      sec.innerHTML = '<h2 class="dash-h">最近一次</h2>';
      const card = document.createElement('div'); card.className = 'dash-card'; card.style.setProperty('--tc', '#3a6ea5');
      card.innerHTML = '<div class="dc-top"><span class="dc-ico">🌙</span><span class="dc-name">' + localDayOf(last.ts) + '</span><span class="dc-num">' + ((last.value && last.value.sleep_time) || '—') + '</span></div>' +
        '<div class="dc-sub">' + ((last.value && last.value.on_target) ? '🌟 达标' : '未达标') + '</div>';
      sec.appendChild(card); dash.appendChild(sec);
    }
    root.appendChild(dash);
  }

  function renderSleepSidebar() {
    const el = document.getElementById('sleepTabs'); if (!el) return;
    el.innerHTML = '';
    el.appendChild(sideTab('🏠', '首页', sleepSub === 'home', '#3a6ea5', () => { sleepSub = 'home'; renderSleep(); closeSb(); }));
    const sep = document.createElement('div'); sep.className = 'sb-sep'; el.appendChild(sep);
    el.appendChild(sideTab('🌙', '打卡', sleepSub === 'checkin', '#3a6ea5', () => { sleepSub = 'checkin'; renderSleep(); closeSb(); }));
  }

  /* ---------- 方法模块（全动态） ---------- */
  function fieldSummary(habit, value) {
    const fs = habit.fields || [];
    return fs.filter(f => value && value[f.key] != null && value[f.key] !== '').map(f => (value[f.key])).join(' · ');
  }

  function renderMethod() {
    renderMethodSidebar();
    const root = document.getElementById('method-list'); if (!root) return;
    root.innerHTML = '';
    if (methodSub === 'home') buildMethodHome(root); else buildMethodCheckin(root);
  }

  function buildMethodCheckin(root) {
    // 新建框架按钮
    const addBtn = document.createElement('button'); addBtn.className = 'btn-add'; addBtn.textContent = '＋ 新建框架';
    addBtn.addEventListener('click', () => openHabitForm(null));
    root.appendChild(addBtn);

    const list = methodHabits();
    if (!list.length) {
      const e = document.createElement('div'); e.className = 'trend-empty'; e.textContent = '还没有框架，点上方「＋ 新建框架」添加一个';
      root.appendChild(e);
    }
    list.forEach(h => root.appendChild(methodCard(h)));

    // 已归档
    const arch = archivedHabits();
    if (arch.length) {
      const box = document.createElement('div'); box.className = 'arch-box';
      box.innerHTML = '<div class="sec-t">🗄️ 已归档（' + arch.length + '）</div>';
      arch.forEach(h => {
        const row = document.createElement('div'); row.className = 'arch-row';
        row.innerHTML = '<span>' + h.icon + ' ' + h.name + '</span>';
        const rb = document.createElement('button'); rb.className = 'btn-ghost sm'; rb.textContent = '恢复';
        rb.addEventListener('click', async () => { await setArchived(h.id, false); renderMethod(); toast('已恢复'); });
        row.appendChild(rb);
        box.appendChild(row);
      });
      root.appendChild(box);
    }
    if (!useCloud) { const tag = document.createElement('div'); tag.style.cssText = 'font-size:11px;color:#999;margin-top:6px'; tag.textContent = '（本地模式：新建/编辑不可用，去 Supabase 跑 habits_schema.sql 后自动转云端）'; root.appendChild(tag); }
  }

  function buildMethodHome(root) {
    const list = methodHabits();
    let totalPractices = 0, todayPractices = 0, m0 = 0, m1 = 0, m2 = 0;
    const total = list.length;
    const rows = list.map(h => {
      const recs = allOf(h.key);
      const n = recs.length; totalPractices += n;
      const lv = methodLevel(h.key);
      if (lv.label === '未用') m0++; else if (lv.label === '偶尔') m1++; else m2++;
      const todayN = recs.filter(r => localDayOf(r.ts) === todayKey()).length; todayPractices += todayN;
      return { h, n, lv, todayN };
    });
    const dash = document.createElement('div'); dash.className = 'dash';
    if (total) {
      const items = [
        { n: total, l: '框架总数' },
        { n: totalPractices, l: '已实践次数' },
        { n: todayPractices, l: '今日实践' },
        { n: m2, l: '熟练框架' }
      ];
      const coverage = Math.round((total - m0) / total * 100);
      dash.appendChild(buildHero(items, coverage, '覆盖度', 'rg-method'));
    } else {
      dash.appendChild(emptyHome('💡', '还没有框架', '去「框架」点「＋ 新建框架」添加一个'));
    }
    // 框架实践排行
    const sec = document.createElement('section'); sec.className = 'dash-section';
    sec.innerHTML = '<h2 class="dash-h">框架实践排行</h2>';
    const grid = document.createElement('div'); grid.className = 'dash-grid';
    const maxN = Math.max(1, ...rows.map(r => r.n));
    for (const r of rows) {
      const pct = Math.round(r.n / maxN * 100);
      const card = document.createElement('button'); card.type = 'button'; card.className = 'dash-card'; card.style.setProperty('--tc', r.h.color);
      card.innerHTML = '<div class="dc-top"><span class="dc-ico">' + r.h.icon + '</span><span class="dc-name">' + esc(r.h.name) + '</span><span class="dc-num">' + r.n + '</span></div>' +
        '<div class="dc-bar"><div class="dc-fill" style="width:' + pct + '%"></div></div>' +
        '<div class="dc-sub">已实践 ' + r.n + ' 次 · ' + r.lv.label + '</div>';
      card.addEventListener('click', () => { methodSub = 'checkin'; renderMethod(); closeSb(); });
      grid.appendChild(card);
    }
    sec.appendChild(grid); dash.appendChild(sec);
    // 熟练度分布
    dash.appendChild(buildFrameMastery(m0, m1, m2));
    root.appendChild(dash);
  }

  function buildFrameMastery(m0, m1, m2) {
    const total = m0 + m1 + m2 || 1;
    const p = [m0, m1, m2].map(x => Math.round(x / total * 100));
    const sec = document.createElement('section'); sec.className = 'dash-section';
    sec.innerHTML = '<h2 class="dash-h">熟练度分布</h2>';
    const wrap = document.createElement('div'); wrap.className = 'mast-wrap';
    const items = [
      { label: '未用', n: m0, pct: p[0], cls: 'm0' },
      { label: '偶尔', n: m1, pct: p[1], cls: 'm1' },
      { label: '熟练', n: m2, pct: p[2], cls: 'm2' }
    ];
    for (const it of items) {
      const row = document.createElement('div'); row.className = 'mast-row';
      row.innerHTML = '<div class="mast-label">' + it.label + '</div><div class="mast-bar"><div class="mast-fill ' + it.cls + '" style="width:' + it.pct + '%"></div></div><div class="mast-num">' + it.n + ' <small>' + it.pct + '%</small></div>';
      wrap.appendChild(row);
    }
    sec.appendChild(wrap); return sec;
  }

  function renderMethodSidebar() {
    const el = document.getElementById('methodTabs'); if (!el) return;
    el.innerHTML = '';
    el.appendChild(sideTab('🏠', '首页', methodSub === 'home', '#b8861b', () => { methodSub = 'home'; renderMethod(); closeSb(); }));
    const sep = document.createElement('div'); sep.className = 'sb-sep'; el.appendChild(sep);
    el.appendChild(sideTab('💡', '框架', methodSub === 'checkin', '#b8861b', () => { methodSub = 'checkin'; renderMethod(); closeSb(); }));
  }

  /* ---------- 通用：首页仪表盘构件 ---------- */
  function closeSb() { document.body.classList.remove('sb-open'); }
  function sideTab(ico, name, active, color, onClick) {
    const b = document.createElement('button');
    b.className = 'tab' + (active ? ' active' : '');
    if (color) b.style.setProperty('--tc', color);
    b.innerHTML = '<span class="t-ico">' + ico + '</span><span class="t-name">' + name + '</span>';
    b.addEventListener('click', onClick);
    return b;
  }
  function buildHero(items, pct, caption, gid) {
    const hero = document.createElement('section'); hero.className = 'dash-hero';
    const R = 54, C = 2 * Math.PI * R, off = C * (1 - pct / 100);
    const ring = document.createElement('div'); ring.className = 'ring';
    ring.innerHTML =
      '<svg viewBox="0 0 140 140" width="140" height="140">' +
      '<defs><linearGradient id="' + gid + '" x1="0" y1="0" x2="1" y2="1">' +
      '<stop offset="0%" stop-color="#d4a017"/><stop offset="100%" stop-color="#b8861b"/></linearGradient></defs>' +
      '<circle cx="70" cy="70" r="' + R + '" fill="none" stroke="#e8e0d2" stroke-width="12"/>' +
      '<circle cx="70" cy="70" r="' + R + '" fill="none" stroke="url(#' + gid + ')" stroke-width="12" stroke-linecap="round" ' +
      'stroke-dasharray="' + C.toFixed(1) + '" stroke-dashoffset="' + off.toFixed(1) + '" transform="rotate(-90 70 70)"/>' +
      '<text x="70" y="63" text-anchor="middle" class="ring-pct">' + pct + '%</text>' +
      '<text x="70" y="86" text-anchor="middle" class="ring-cap">' + caption + '</text>' +
      '</svg>';
    const stats = document.createElement('div'); stats.className = 'hero-stats';
    for (const it of items) {
      const d = document.createElement('div'); d.className = 'hstat';
      d.innerHTML = '<b>' + it.n + '</b><span>' + it.l + '</span>';
      stats.appendChild(d);
    }
    hero.appendChild(ring); hero.appendChild(stats);
    return hero;
  }
  function emptyHome(ico, title, sub) {
    const sec = document.createElement('section'); sec.className = 'dash-section';
    sec.innerHTML = '<div class="empty" style="padding:34px 18px;text-align:center;color:var(--sub);font-size:14px">' + ico + ' ' + title + '<br><small style="opacity:.8">' + sub + '</small></div>';
    return sec;
  }

  function methodCard(h) {
    const card = document.createElement('div'); card.className = 'habit-card method-card'; card.style.setProperty('--hc', h.color);
    const today = todaysOf(h.key)[0];
    let html = '<div class="hc-top"><div class="hc-ico">' + h.icon + '</div><div class="hc-name">' + h.name + '</div>';
    html += today ? '<span class="ok-badge">今日已打卡</span>' : '<span class="hc-status">今日未打卡</span>';
    html += '</div>';
    const intro = h.desc || FRAME_DESC[h.key];
    if (intro) html += '<div class="m-desc">' + esc(intro) + '</div>';
    // 熟练度（替代原来的 累计/本周/连续 统计）
    const lv = methodLevel(h.key);
    html += '<div class="m-level"><span class="lv-badge ' + lv.cls + '">' + lv.label + '</span><span class="lv-sub">已实践 ' + allOf(h.key).length + ' 次</span></div>';
    if (today) html += '<div class="m-today">' + (esc(today.value && today.value.note) || '已打卡') + '</div>';
    card.innerHTML = html;

    // 操作行
    const ops = document.createElement('div'); ops.className = 'm-ops';
    if (!today) {
      const cb = document.createElement('button'); cb.className = 'btn-primary'; cb.textContent = '打卡';
      cb.addEventListener('click', () => openCheckin(h, card));
      ops.appendChild(cb);
    } else {
      const ub = document.createElement('button'); ub.className = 'btn-ghost'; ub.textContent = '撤销今日';
      ub.addEventListener('click', async () => {
        if (useCloud && today.id != null) await deleteCheckin(today.id);
        else { localLogs[h.key] = (localLogs[h.key] || []).filter(r => r.day !== todayKey()); saveLocal(); }
        renderMethod(); toast('已撤销');
      });
      ops.appendChild(ub);
    }
    const rb = document.createElement('button'); rb.className = 'btn-ghost'; rb.textContent = '记录';
    rb.addEventListener('click', () => { const p = card.querySelector('.m-records'); if (p) { p.hidden = !p.hidden; rb.textContent = p.hidden ? '记录' : '收起'; } });
    ops.appendChild(rb);
    const eb = document.createElement('button'); eb.className = 'btn-ghost'; eb.textContent = '编辑';
    eb.addEventListener('click', () => openHabitForm(h));
    ops.appendChild(eb);
    const ab = document.createElement('button'); ab.className = 'btn-ghost danger'; ab.textContent = '归档';
    ab.addEventListener('click', async () => { if (confirm('归档「' + h.name + '」？历史记录会保留，可恢复。')) { await setArchived(h.id, true); renderMethod(); toast('已归档'); } });
    ops.appendChild(ab);
    card.appendChild(ops);

    // 记录面板
    const recs = recsOf(h.key);
    const panel = document.createElement('div'); panel.className = 'm-records'; panel.hidden = true;
    panel.innerHTML = '<div class="sec-t">📋 记录 <span class="cnt">' + recs.length + '</span></div>';
    if (!recs.length) { const e = document.createElement('div'); e.className = 'trend-empty'; e.textContent = '暂无记录'; panel.appendChild(e); }
    else {
      const ul = document.createElement('div'); ul.className = 'hist-list';
      recs.slice().reverse().forEach(r => {
        const item = document.createElement('div'); item.className = 'hist-item';
        const note = (r.value && r.value.note) || '';
        item.innerHTML = '<span class="hd">' + localDayOf(r.ts).slice(5) + '</span><span class="ht">' + (esc(note) || '已打卡') + '</span>';
        const del = document.createElement('button'); del.className = 'hist-del'; del.textContent = '×';
        del.addEventListener('click', async () => { await deleteRec(h.key, r); renderMethod(); toast('已删除'); });
        item.appendChild(del);
        ul.appendChild(item);
      });
      panel.appendChild(ul);
    }
    card.appendChild(panel);
    return card;
  }

  function openCheckin(h, card) {
    card.innerHTML = '<div class="hc-top"><div class="hc-ico">' + h.icon + '</div><div class="hc-name">' + h.name + '</div></div>';
    const form = document.createElement('div'); form.className = 'habit-form'; form.style.marginTop = '8px';
    const lab = document.createElement('label'); lab.textContent = '这次做了什么 / 体会到什么（可留空）'; form.appendChild(lab);
    const ta = document.createElement('textarea'); ta.className = 'refl'; ta.rows = 3; ta.placeholder = '手写一句反思，例如：今天用「先懂生意再下注」看了一家公司的年报'; form.appendChild(ta);
    const submit = document.createElement('button'); submit.className = 'btn-primary'; submit.textContent = '提交打卡';
    submit.addEventListener('click', async () => {
      const value = { note: ta.value.trim() };
      await postCheckin(h.id, new Date().toISOString(), value);
      renderMethod(); toast('✓ 已打卡');
    });
    const cancel = document.createElement('button'); cancel.className = 'btn-ghost'; cancel.style.marginTop = '8px'; cancel.textContent = '取消';
    cancel.addEventListener('click', renderMethod);
    form.appendChild(submit); form.appendChild(cancel);
    card.appendChild(form);
  }

  /* ---------- 习惯新建 / 编辑 弹层 ---------- */
  function openHabitForm(habit) {
    const overlay = document.createElement('div'); overlay.className = 'modal-overlay';
    const box = document.createElement('div'); box.className = 'edit-modal';
    const isEdit = !!habit;
    const data = habit || { name: '', icon: ICONS[0], color: PALETTE[0], fields: [] };
    box.innerHTML = '<div class="modal-t">' + (isEdit ? '编辑框架' : '新建框架') + '</div>';

    // 名称
    const nameWrap = document.createElement('div'); nameWrap.className = 'habit-form';
    nameWrap.innerHTML = '<label>方法名称（必填，可随时改名）</label>';
    const nameInp = document.createElement('input'); nameInp.type = 'text'; nameInp.value = data.name; nameInp.placeholder = '如：段永平研究手段';
    nameWrap.appendChild(nameInp); box.appendChild(nameWrap);

    // 图标
    const iconWrap = document.createElement('div'); iconWrap.className = 'habit-form';
    iconWrap.innerHTML = '<label>图标</label>';
    const iconRow = document.createElement('div'); iconRow.className = 'icon-row';
    let curIcon = data.icon;
    ICONS.forEach(em => {
      const s = document.createElement('span'); s.textContent = em; if (em === curIcon) s.className = 'on';
      s.addEventListener('click', () => { iconRow.querySelectorAll('span').forEach(x => x.classList.remove('on')); s.classList.add('on'); curIcon = em; });
      iconRow.appendChild(s);
    });
    iconWrap.appendChild(iconRow); box.appendChild(iconWrap);

    // 颜色
    const colWrap = document.createElement('div'); colWrap.className = 'habit-form';
    colWrap.innerHTML = '<label>颜色</label>';
    const colRow = document.createElement('div'); colRow.className = 'color-row';
    let curColor = data.color;
    PALETTE.forEach(c => {
      const s = document.createElement('span'); s.style.background = c; if (c === curColor) s.className = 'on';
      s.addEventListener('click', () => { colRow.querySelectorAll('span').forEach(x => x.classList.remove('on')); s.classList.add('on'); curColor = c; });
      colRow.appendChild(s);
    });
    colWrap.appendChild(colRow); box.appendChild(colWrap);

    // 字段编辑器
    const fWrap = document.createElement('div'); fWrap.className = 'habit-form';
    fWrap.innerHTML = '<label>字段（点输入框可直接改名 · 可增删）</label>';
    const fList = document.createElement('div'); fList.className = 'field-list';
    fWrap.appendChild(fList);
    function addFieldRow(f) {
      f = f || { label: '', type: 'text', options: [], key: '' };
      const row = document.createElement('div'); row.className = 'field-row';
      if (f.key) row.dataset.fkey = f.key; // 保留原字段 key，编辑时不破坏历史打卡数据
      const lab = document.createElement('input'); lab.type = 'text'; lab.className = 'f-label'; lab.placeholder = '字段名'; lab.value = f.label || '';
      const typ = document.createElement('select'); typ.className = 'f-type';
      FIELD_TYPES.forEach(t => { const o = document.createElement('option'); o.value = t; o.textContent = ({ text: '文本', number: '数字', time: '时间', select: '单选' })[t]; if (t === f.type) o.selected = true; typ.appendChild(o); });
      const opt = document.createElement('input'); opt.type = 'text'; opt.className = 'f-opt'; opt.placeholder = '单选选项(逗号分隔)'; opt.value = (f.options || []).join(','); opt.style.flex = '2';
      const rm = document.createElement('button'); rm.className = 'field-rm'; rm.textContent = '×';
      rm.addEventListener('click', () => row.remove());
      typ.addEventListener('change', () => { opt.style.display = typ.value === 'select' ? '' : 'none'; });
      opt.style.display = f.type === 'select' ? '' : 'none';
      row.appendChild(lab); row.appendChild(typ); row.appendChild(opt); row.appendChild(rm);
      fList.appendChild(row);
    }
    (data.fields || []).forEach(addFieldRow);
    const addF = document.createElement('button'); addF.className = 'btn-ghost sm'; addF.textContent = '＋ 添加字段';
    addF.addEventListener('click', () => addFieldRow());
    fWrap.appendChild(addF);
    box.appendChild(fWrap);

    // 提交 / 取消
    const op = document.createElement('div'); op.className = 'modal-ops';
    const submit = document.createElement('button'); submit.className = 'btn-primary'; submit.textContent = isEdit ? '保存' : '创建';
    submit.addEventListener('click', async () => {
      const name = nameInp.value.trim();
      if (!name) { toast('请填名称'); return; }
      const fields = [];
      fList.querySelectorAll('.field-row').forEach(row => {
        const lab = row.querySelector('.f-label');
        const typ = row.querySelector('.f-type');
        const opt = row.querySelector('.f-opt');
        const label = (lab.value || '').trim();
        const type = typ.value;
        if (!label) return;
        // 编辑已有字段时保留原 key；仅新建字段才按名称生成 key
        const key = row.dataset.fkey || ('f_' + label.replace(/[^\w一-龥]/g, ''));
        const fld = { key, label, type };
        if (type === 'select') { const opts = (opt.value || '').split(',').map(s => s.trim()).filter(Boolean); fld.options = opts.length ? opts : ['选项1']; }
        fields.push(fld);
      });
      try {
        await upsertHabit({ name, icon: curIcon, color: curColor, type: 'pick', target: null, fields }, habit ? habit.id : null);
        overlay.remove(); renderMethod(); toast(isEdit ? '✓ 已保存' : '✓ 已创建');
      } catch (e) {
        toast('保存失败，请稍后重试');
      }
    });
    const cancel = document.createElement('button'); cancel.className = 'btn-ghost'; cancel.textContent = '取消';
    cancel.addEventListener('click', () => overlay.remove());
    op.appendChild(submit); op.appendChild(cancel);
    box.appendChild(op);
    overlay.appendChild(box);
    overlay.addEventListener('click', e => { if (e.target === overlay) overlay.remove(); });
    document.body.appendChild(overlay);
  }

  function toast(msg) {
    const t = document.getElementById('toast'); if (!t) return;
    t.textContent = msg; t.classList.remove('hidden');
    clearTimeout(t._tm); t._tm = setTimeout(() => t.classList.add('hidden'), 1800);
  }

  /* ---------- 初始化 ---------- */
  const saved = (function () { try { return localStorage.getItem('vocab_bigmod'); } catch (e) { return null; } })() || 'writing';
  initCloud().then(() => showMod(saved));
})();
