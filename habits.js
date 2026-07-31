/* 通用打卡模块：三层大标签中的「早睡」「方法」
 * 数据层：Supabase (habits + checkins 表)，与写作数据同通道。
 * 降级：若 Supabase 不可达（表未建 / 网络异常），自动回退 localStorage，不崩。 */
(function () {
  'use strict';
  const SB_URL = 'https://buzfmugezbemyfdmbgyt.supabase.co';
  const SB_KEY = 'sb_publishable_HvD6YPPY-RpHLRicuoobSw_aSw1B_Ow';
  const LS = 'habit_logs_v1';

  // 种子习惯（云端 habits 表为空时写入；key 为业务稳定 ID）
  const SEED = [
    { key: 'sleep', name: '早睡打卡', icon: '🌙', color: '#3a6ea5', type: 'timed', target: '00:40',
      fields: [{ key: 'sleep_time', label: '入睡时间', type: 'time' }] },
    { key: 'buffett', name: '巴菲特阅读手段', icon: '💎', color: '#8a5cc4', type: 'pick', target: null,
      fields: [
        { key: 'method', label: '用了哪个阅读法', type: 'select', options: ['每天500页', '读年报', '思维模型', '主题阅读'] },
        { key: 'book', label: '读了什么', type: 'text' },
        { key: 'pages', label: '页数', type: 'number' },
        { key: 'note', label: '心得', type: 'text' }
      ] },
    { key: 'xu', name: '徐新研究手段', icon: '🔍', color: '#2f8f9d', type: 'pick', target: null,
      fields: [
        { key: 'method', label: '用了哪个研究手段', type: 'select', options: ['消费者访谈', '看赛道', '长期持有研究', '专家访谈'] },
        { key: 'target', label: '访谈/研究对象', type: 'text' },
        { key: 'finding', label: '关键结论', type: 'text' }
      ] }
  ];

  let useCloud = false;
  let habits = [];
  const habitByKey = {};
  let checkins = [];
  const localLogs = loadLocal();

  function loadLocal() { try { return JSON.parse(localStorage.getItem(LS)) || {}; } catch (e) { return {}; } }
  function saveLocal() { localStorage.setItem(LS, JSON.stringify(localLogs)); }
  function todayKey() { const d = new Date(); return d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate(); }
  function nowStr() { const d = new Date(); const p = x => ('' + x).padStart(2, '0'); return p(d.getHours()) + ':' + p(d.getMinutes()); }
  function timeToMin(t) { const a = (t || '').split(':'); if (a.length < 2) return 0; return (+a[0]) * 60 + (+a[1]); }
  function localDayOf(iso) { const d = new Date(iso); return d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate(); }

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
        const ins = SEED.map((h, i) => ({ key: h.key, name: h.name, icon: h.icon, color: h.color, type: h.type, target: h.target, fields: h.fields, sort: i }));
        const created = await sbFetch('habits?select=*', { method: 'POST', headers: { 'Content-Type': 'application/json', 'Prefer': 'return=representation' }, body: JSON.stringify(ins) });
        habits = created && created.length ? created : ins.map((h, i) => ({ ...h, id: i + 1 }));
      } else {
        habits = hs;
      }
      habits.forEach(h => habitByKey[h.key] = h);
      checkins = await sbFetch('checkins?select=*&order=ts.desc') || [];
      await migrateLocal();
    } catch (e) {
      useCloud = false;
      habits = SEED.map((h, i) => ({ ...h, id: h.key }));
      habits.forEach(h => habitByKey[h.key] = h);
    }
  }

  // 一次性迁移：云端为空且本地有旧数据时，把本地记录转成 checkins 上传
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
      const key = Object.keys(habitByKey).find(k => habitByKey[k].id === habitId) || habitId;
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

  function todaysOf(key) {
    if (!useCloud) return (localLogs[key] || []).filter(r => r.day === todayKey());
    const h = habitByKey[key]; if (!h) return [];
    return checkins.filter(c => c.habit_id === h.id && localDayOf(c.ts) === todayKey());
  }
  function weekOf(key) {
    if (!useCloud) return (localLogs[key] || []).map(r => ({ k: r.day, rec: r }));
    const h = habitByKey[key]; if (!h) return [];
    const out = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(); d.setDate(d.getDate() - i);
      const k = d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate();
      out.push({ k, rec: checkins.find(c => c.habit_id === h.id && localDayOf(c.ts) === k) });
    }
    return out;
  }

  /* ---------- 模块切换 ---------- */
  const MODS = ['writing', 'sleep', 'method'];
  function showMod(m) {
    MODS.forEach(x => { const el = document.getElementById('mod-' + x); if (el) el.hidden = (x !== m); });
    document.querySelectorAll('.btab').forEach(b => b.classList.toggle('active', b.dataset.mod === m));
    try { localStorage.setItem('vocab_bigmod', m); } catch (e) {}
    if (m === 'sleep') renderSleep();
    if (m === 'method') renderMethod();
  }
  document.querySelectorAll('.btab').forEach(b => b.addEventListener('click', () => showMod(b.dataset.mod)));

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

  /* ---------- 早睡模块 ---------- */
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
  function minToHHMM(m) {
    m = Math.round(m);
    const h = ((Math.floor(m / 60)) % 24 + 24) % 24;
    const mm = ((m % 60) + 60) % 60;
    return (h < 10 ? '0' : '') + h + ':' + (mm < 10 ? '0' : '') + mm;
  }
  // 跨午夜偏移轴：21:00 起算，00:xx 放到次日段，使"早于 target 即达标"在 23:xx~00:xx 正确
  function sleepOffset(t) { const m = timeToMin(t); return m < 1260 ? m + 1440 : m; }

  function buildTrend(recs) {
    const wrap = document.createElement('div'); wrap.className = 'sleep-trend';
    wrap.innerHTML = '<div class="sec-t">📈 入睡时间趋势</div>';
    if (recs.length < 2) {
      const tip = document.createElement('div'); tip.className = 'trend-empty';
      tip.textContent = recs.length === 0 ? '还没有打卡记录' : '至少打卡 2 天才能看到趋势';
      wrap.appendChild(tip); return wrap;
    }
    const W = 360, H = 172, padL = 38, padR = 12, padT = 14, padB = 26;
    const pts = recs.map(r => sleepOffset(timeToMin((r.value && r.value.sleep_time) || '00:40')));
    let minM = Math.min.apply(null, pts), maxM = Math.max.apply(null, pts);
    if (maxM - minM < 60) { const c = (minM + maxM) / 2; minM = c - 30; maxM = c + 30; }
    minM -= 15; maxM += 15;
    const n = pts.length;
    const X = i => padL + (n === 1 ? 0 : (i / (n - 1)) * (W - padL - padR));
    const Y = m => padT + (1 - (m - minM) / (maxM - minM)) * (H - padT - padB);
    const tMin = sleepOffset(timeToMin((habitByKey.sleep && habitByKey.sleep.target) || '00:40'));
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
    recs.forEach((r, i) => { line += X(i).toFixed(1) + ',' + Y(pts[i]).toFixed(1) + ' '; });
    s += '<polyline points="' + line.trim() + '" fill="none" stroke="#b8861b" stroke-width="2" stroke-linejoin="round"/>';
    recs.forEach((r, i) => {
      const onT = r.value && r.value.on_target;
      const col = onT ? '#2f9e44' : '#b8861b';
      const lab = localDayOf(r.ts) + ' ' + ((r.value && r.value.sleep_time) || '');
      s += '<circle cx="' + X(i).toFixed(1) + '" cy="' + Y(pts[i]).toFixed(1) + '" r="3" fill="' + col + '"><title>' + lab + '</title></circle>';
    });
    s += '<text x="' + X(0).toFixed(1) + '" y="' + (H - 8) + '" text-anchor="start">' + localDayOf(recs[0].ts).slice(5) + '</text>';
    s += '<text x="' + X(n - 1).toFixed(1) + '" y="' + (H - 8) + '" text-anchor="end">' + localDayOf(recs[n - 1].ts).slice(5) + '</text>';
    s += '</svg>';
    wrap.innerHTML += s;
    return wrap;
  }

  function buildHistory(recs) {
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
      del.addEventListener('click', async () => { await deleteRec('sleep', r); renderSleep(); toast('已删除'); });
      item.appendChild(del);
      ul.appendChild(item);
    });
    wrap.appendChild(ul);
    return wrap;
  }

  function renderSleep() {
    const root = document.getElementById('sleep-list'); if (!root) return;
    root.innerHTML = '';
    const h = getHabit('sleep');
    const today = todaysOf('sleep')[0];
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
    weekOf('sleep').forEach(o => {
      const el = document.createElement('div'); el.className = 'd' + (o.rec ? ' on' : '');
      el.textContent = o.rec ? o.rec.value.sleep_time : o.k.replace(/-/g, '/').slice(5);
      strip.appendChild(el);
    });
    card.appendChild(strip);
    root.appendChild(card);

    const recs = allOf('sleep').slice().sort((a, b) => new Date(a.ts) - new Date(b.ts));
    root.appendChild(buildTrend(recs));
    root.appendChild(buildHistory(recs));

    if (!useCloud) { const tag = document.createElement('div'); tag.style.cssText = 'font-size:11px;color:#999;margin-top:6px'; tag.textContent = '（本地模式：去 Supabase 跑 habits_schema.sql 后自动转云端）'; card.appendChild(tag); }
  }

  /* ---------- 方法模块（巴菲特 + 徐新） ---------- */
  function renderMethod() {
    const root = document.getElementById('method-list'); if (!root) return;
    root.innerHTML = '';
    ['buffett', 'xu'].forEach(key => {
      const h = getHabit(key);
      const today = todaysOf(key)[0];
      const card = document.createElement('div'); card.className = 'habit-card'; card.style.setProperty('--hc', h.color);
      let html = '<div class="hc-top"><div class="hc-ico">' + h.icon + '</div><div class="hc-name">' + h.name + '</div>';
      html += today ? '<span class="ok-badge">已打卡</span>' : '<span class="hc-status">今日未打卡</span>';
      html += '</div>';
      if (today) html += '<div style="font-size:13px;color:var(--ink-2);margin-top:6px">' + ((today.value && today.value.method) || '') + ((today.value && today.value.book) ? (' · ' + today.value.book) : '') + '</div>';
      card.innerHTML = html;

      if (today) {
        const undo = document.createElement('button'); undo.className = 'btn-ghost'; undo.style.marginTop = '10px'; undo.textContent = '撤销今日打卡';
        undo.addEventListener('click', async () => {
          if (useCloud && today.id != null) await deleteCheckin(today.id);
          else { localLogs[key] = (localLogs[key] || []).filter(r => r.day !== todayKey()); saveLocal(); }
          renderMethod(); toast('已撤销');
        });
        card.appendChild(undo);
      } else {
        const btn = document.createElement('button'); btn.className = 'btn-primary'; btn.style.marginTop = '10px'; btn.textContent = '打卡';
        btn.addEventListener('click', () => {
          card.innerHTML = '<div class="hc-top"><div class="hc-ico">' + h.icon + '</div><div class="hc-name">' + h.name + '</div></div>';
          const form = document.createElement('div'); form.className = 'habit-form'; form.style.marginTop = '8px';
          const inputs = [];
          getFields(key).forEach(f => { const fi = fieldEl(f, ''); form.appendChild(fi.el); inputs.push(fi); });
          const submit = document.createElement('button'); submit.className = 'btn-primary'; submit.textContent = '提交打卡';
          submit.addEventListener('click', async () => {
            const value = {}; getFields(key).forEach((f, i) => { value[f.key] = inputs[i].getValue(); });
            await postCheckin(h.id, new Date().toISOString(), value);
            renderMethod(); toast('✓ 已打卡');
          });
          const cancel = document.createElement('button'); cancel.className = 'btn-ghost'; cancel.style.marginTop = '8px'; cancel.textContent = '取消';
          cancel.addEventListener('click', renderMethod);
          form.appendChild(submit); form.appendChild(cancel);
          card.appendChild(form);
        });
        card.appendChild(btn);
      }
      root.appendChild(card);
    });
    if (!useCloud) { const tag = document.createElement('div'); tag.style.cssText = 'font-size:11px;color:#999;margin-top:6px'; tag.textContent = '（本地模式：去 Supabase 跑 habits_schema.sql 后自动转云端）'; root.appendChild(tag); }
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
