/* 通用打卡模块（预览版）：三层大标签中的「早睡」「方法」
 * 数据层先用 localStorage，部署时再切 Supabase（habits / checkins 表）。
 * 与现有写作 app.js 完全解耦，互不干扰。 */
(function () {
  'use strict';
  const LS = 'habit_logs_v1';
  let logs = {};
  try { logs = JSON.parse(localStorage.getItem(LS)) || {}; } catch (e) { logs = {}; }
  function save() { localStorage.setItem(LS, JSON.stringify(logs)); }
  function todayKey() { const d = new Date(); return d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate(); }
  function nowStr() { const d = new Date(); const p = x => ('' + x).padStart(2, '0'); return p(d.getHours()) + ':' + p(d.getMinutes()); }
  function timeToMin(t) { const a = (t || '').split(':'); if (a.length < 2) return 0; return (+a[0]) * 60 + (+a[1]); }

  // 习惯定义（对应设计文档 habits.fields）
  const HABITS = {
    sleep: { id: 'sleep', name: '早睡打卡', icon: '🌙', color: '#3a6ea5', type: 'timed', target: '23:00',
      fields: [{ key: 'sleep_time', label: '入睡时间', type: 'time' }] },
    buffett: { id: 'buffett', name: '巴菲特阅读手段', icon: '💎', color: '#8a5cc4', type: 'pick',
      fields: [
        { key: 'method', label: '用了哪个阅读法', type: 'select', options: ['每天500页', '读年报', '思维模型', '主题阅读'] },
        { key: 'book', label: '读了什么', type: 'text' },
        { key: 'pages', label: '页数', type: 'number' },
        { key: 'note', label: '心得', type: 'text' }
      ] },
    xu: { id: 'xu', name: '徐新研究手段', icon: '🔍', color: '#2f8f9d', type: 'pick',
      fields: [
        { key: 'method', label: '用了哪个研究手段', type: 'select', options: ['消费者访谈', '看赛道', '长期持有研究', '专家访谈'] },
        { key: 'target', label: '访谈/研究对象', type: 'text' },
        { key: 'finding', label: '关键结论', type: 'text' }
      ] }
  };

  function todays(habitId) { return (logs[habitId] || []).filter(r => r.day === todayKey()); }

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

  /* ---------- 早睡模块 ---------- */
  function renderSleep() {
    const root = document.getElementById('sleep-list'); if (!root) return;
    root.innerHTML = '';
    const h = HABITS.sleep;
    const today = todays('sleep')[0];
    const card = document.createElement('div'); card.className = 'habit-card'; card.style.setProperty('--hc', h.color);
    let html = '<div class="hc-top"><div class="hc-ico">' + h.icon + '</div><div class="hc-name">' + h.name + '</div>';
    html += today ? '<span class="ok-badge">已打卡 ' + (today.value.sleep_time || '') + (today.value.on_target ? ' 🌟达标' : '') + '</span>' : '<span class="hc-status">今日未打卡</span>';
    html += '</div>';
    card.innerHTML = html;

    if (today) {
      const undo = document.createElement('button'); undo.className = 'btn-ghost'; undo.style.marginTop = '10px'; undo.textContent = '撤销今日打卡';
      undo.addEventListener('click', () => { logs.sleep = (logs.sleep || []).filter(r => r.day !== todayKey()); save(); renderSleep(); toast('已撤销'); });
      card.appendChild(undo);
    } else {
      const form = document.createElement('div'); form.className = 'habit-form'; form.style.marginTop = '8px';
      const lab = document.createElement('label'); lab.textContent = '入睡时间（默认现在，可改）';
      const ti = document.createElement('input'); ti.type = 'time'; ti.value = nowStr();
      const btn = document.createElement('button'); btn.className = 'btn-primary'; btn.textContent = '打卡';
      btn.addEventListener('click', () => {
        const t = ti.value || nowStr();
        const onTarget = timeToMin(t) <= timeToMin(h.target);
        logs.sleep = logs.sleep || [];
        logs.sleep.push({ day: todayKey(), ts: new Date().toISOString(), value: { sleep_time: t, on_target: onTarget } });
        save(); renderSleep(); toast('✓ 已打卡 · ' + (onTarget ? '🌟达标' : '未达标'));
      });
      form.appendChild(lab); form.appendChild(ti); form.appendChild(btn);
      card.appendChild(form);
    }
    const strip = document.createElement('div'); strip.className = 'week-strip';
    const now = new Date();
    for (let i = 6; i >= 0; i--) {
      const d = new Date(now); d.setDate(now.getDate() - i);
      const k = d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate();
      const rec = (logs.sleep || []).find(r => r.day === k);
      const el = document.createElement('div'); el.className = 'd' + (rec ? ' on' : '');
      el.textContent = rec ? rec.value.sleep_time : ((d.getMonth() + 1) + '/' + d.getDate());
      strip.appendChild(el);
    }
    card.appendChild(strip);
    root.appendChild(card);
  }

  /* ---------- 方法模块（巴菲特 + 徐新） ---------- */
  function renderMethod() {
    const root = document.getElementById('method-list'); if (!root) return;
    root.innerHTML = '';
    ['buffett', 'xu'].forEach(id => {
      const h = HABITS[id];
      const today = todays(id)[0];
      const card = document.createElement('div'); card.className = 'habit-card'; card.style.setProperty('--hc', h.color);
      let html = '<div class="hc-top"><div class="hc-ico">' + h.icon + '</div><div class="hc-name">' + h.name + '</div>';
      html += today ? '<span class="ok-badge">已打卡</span>' : '<span class="hc-status">今日未打卡</span>';
      html += '</div>';
      if (today) html += '<div style="font-size:13px;color:var(--ink-2);margin-top:6px">' + (today.value.method || '') + (today.value.book ? (' · ' + today.value.book) : '') + '</div>';
      card.innerHTML = html;

      if (today) {
        const undo = document.createElement('button'); undo.className = 'btn-ghost'; undo.style.marginTop = '10px'; undo.textContent = '撤销今日打卡';
        undo.addEventListener('click', () => { logs[id] = (logs[id] || []).filter(r => r.day !== todayKey()); save(); renderMethod(); toast('已撤销'); });
        card.appendChild(undo);
      } else {
        const btn = document.createElement('button'); btn.className = 'btn-primary'; btn.style.marginTop = '10px'; btn.textContent = '打卡';
        btn.addEventListener('click', () => {
          card.innerHTML = '<div class="hc-top"><div class="hc-ico">' + h.icon + '</div><div class="hc-name">' + h.name + '</div></div>';
          const form = document.createElement('div'); form.className = 'habit-form'; form.style.marginTop = '8px';
          const inputs = [];
          h.fields.forEach(f => { const fi = fieldEl(f, ''); form.appendChild(fi.el); inputs.push(fi); });
          const submit = document.createElement('button'); submit.className = 'btn-primary'; submit.textContent = '提交打卡';
          submit.addEventListener('click', () => {
            const value = {}; h.fields.forEach((f, i) => { value[f.key] = inputs[i].getValue(); });
            logs[id] = logs[id] || []; logs[id].push({ day: todayKey(), ts: new Date().toISOString(), value });
            save(); renderMethod(); toast('✓ 已打卡');
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
  }

  function toast(msg) {
    const t = document.getElementById('toast'); if (!t) return;
    t.textContent = msg; t.classList.remove('hidden');
    clearTimeout(t._tm); t._tm = setTimeout(() => t.classList.add('hidden'), 1800);
  }

  /* ---------- 初始化 ---------- */
  const saved = (function () { try { return localStorage.getItem('vocab_bigmod'); } catch (e) { return null; } })() || 'writing';
  showMod(saved);
})();
