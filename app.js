(function () {
  'use strict';
  const LS_STATE = 'vocab_checkin_state_v1';
  const LS_SB = 'vocab_sb_config_v1';
  const LS_MINE = 'vocab_mine_v1';
  const LS_CUSTOM_TAGS = 'vocab_custom_tags_v1';
  const LS_ENTRY_TAGS = 'vocab_entry_tags_v1';
  // 分类覆盖层：表达功能/使用场景/词性可多值，词条字段可本地改；均不写回 data.js
  const LS_TAXONOMY = 'vocab_taxonomy_overrides_v1';
  const LS_EDITS = 'vocab_entry_edits_v1';
  const LS_EXTRA = 'vocab_extra_items_v1';
  const MASTERY = ['未用', '偶尔', '熟练'];

  const VOCAB = window.VOCAB || [];
  const USES = window.CATEGORIES || [];
  const TOPICS = window.TOPICS || [];
  // 副轴·领域标签（可多值，不参与分组统计）
  const DOMAINS = ['🏆 竞争格局', '👥 人性心理', '🏗️ 管理组织', '💰 投资决策', '🌿 人生修养'];
  // 新分类视图以原条目的人工维护分类为输入，不改动数据本身或打卡 ID。
  const SCENE_CATEGORIES = ['日常生活', '工作与沟通', '人际关系', '人物与心理描写', '环境与细节描写', '思考与分析', '阅读与写作', '❓ 待整理'];
  const HUMOR_SCENE_CATEGORIES = ['职场与协作', '社交与人际', '投资与消费', '学习与成长', '公共议题与围观', '竞争与冲突', '❓ 待整理'];
  const HUMOR_SCENE_BY_ID = {
    1642:'职场与协作',1643:'学习与成长',1644:'投资与消费',1645:'公共议题与围观',1646:'社交与人际',
    1647:'竞争与冲突',1648:'职场与协作',1649:'职场与协作',1650:'公共议题与围观',1651:'竞争与冲突',
    1652:'职场与协作',1653:'社交与人际',1654:'公共议题与围观',1655:'职场与协作',1656:'职场与协作',
    1657:'❓ 待整理',1658:'公共议题与围观',1659:'公共议题与围观',1660:'竞争与冲突',1661:'❓ 待整理',
    1662:'公共议题与围观',1663:'社交与人际',1664:'职场与协作',1665:'竞争与冲突',1666:'公共议题与围观',
    1667:'竞争与冲突',1668:'社交与人际',1669:'❓ 待整理',1729:'投资与消费',1730:'社交与人际'
  };
  const SCENE_TABS = ['vocab', 'phr', 'met', 'quote', 'humor'];
  const WORD_CLASSES = ['名词 / 概念', '动词', '形容词', '副词 / 连词', '❓ 待标词性'];
  const EXPRESSION_FUNCTIONS = ['观点与判断', '推理与解释', '对比与转折', '举例与证据', '概括与命名', '动作与变化', '状态与程度', '描写与刻画', '类比与形象化', '衔接与组织', '风险与边界', '❓ 待整理'];
  const EXPRESSION_SUBCATEGORIES = {
    '\u89c2\u70b9\u4e0e\u5224\u65ad': ['\u8868\u6001', '\u8bc4\u4ef7', '\u4e0b\u7ed3\u8bba'],
    '\u63a8\u7406\u4e0e\u89e3\u91ca': ['\u56e0\u679c', '\u6761\u4ef6', '\u903b\u8f91'],
    '\u5bf9\u6bd4\u4e0e\u8f6c\u6298': ['\u6bd4\u8f83', '\u8ba9\u6b65', '\u8f6c\u6298'],
    '\u4e3e\u4f8b\u4e0e\u8bc1\u636e': ['\u4e8b\u5b9e', '\u6570\u636e', '\u4f8b\u8bc1'],
    '\u6982\u62ec\u4e0e\u547d\u540d': ['\u603b\u7ed3\u89c4\u5f8b', '\u73b0\u8c61\u547d\u540d', '\u6982\u5ff5\u547d\u540d'],
    '\u52a8\u4f5c\u4e0e\u53d8\u5316': ['\u884c\u4e3a', '\u8fc7\u7a0b', '\u8d8b\u52bf'],
    '\u72b6\u6001\u4e0e\u7a0b\u5ea6': ['\u6027\u8d28', '\u72b6\u6001', '\u5f3a\u5f31'],
    '\u63cf\u5199\u4e0e\u523b\u753b': ['\u4eba\u7269', '\u5fc3\u7406', '\u73af\u5883', '\u7ec6\u8282'],
    '\u7c7b\u6bd4\u4e0e\u5f62\u8c61\u5316': ['\u76f8\u4f3c\u4e8b\u7269', '\u62bd\u8c61\u89e3\u91ca'],
    '\u8854\u63a5\u4e0e\u7ec4\u7ec7': ['\u627f\u63a5', '\u9012\u8fdb', '\u9650\u5b9a', '\u6536\u675f'],
    '\u98ce\u9669\u4e0e\u8fb9\u754c': ['\u98ce\u9669', '\u540e\u679c', '\u9002\u7528\u8303\u56f4']
  };
  const WORD_CLASS_BY_USE = {
    '📐 概念指代':'名词 / 概念','🗣️ 灵活动词':'动词','🔤 精准形容词':'形容词','↔️ 副词连词':'副词 / 连词'
  };
  const FUNCTION_BY_USE = {
    '🎯 立论判断':'观点与判断','🔗 论证推理':'推理与解释','⚖️ 对比转折':'对比与转折',
    '📊 举证说明':'举例与证据','💡 打比方':'类比与形象化','🔍 洞察本质':'概括与命名',
    '⚠️ 警示风险':'风险与边界','🖋️ 描写刻画':'描写与刻画','✍️ 写作技法':'衔接与组织',
    '❓ 待定':'❓ 待整理'
  };
  const SCENE_BY_OLD_CAT = {
    '01-观点与论述':'思考与分析','02-逻辑关系':'思考与分析','03-程度与属性':'人物与心理描写','04-行为与动作':'日常生活',
    '05-事物与指代':'环境与细节描写','06-概念与术语':'思考与分析','07A-素材与描写·人物与群体':'人物与心理描写',
    '07B-素材与描写·事物与状态':'环境与细节描写','07C-素材与描写·时空与环境':'环境与细节描写',
    '07D-素材与描写·动作与行为':'人物与心理描写','08-精准表达':'阅读与写作',
    '💰 估值与财务':'思考与分析','⚖️ 投资交易与法务':'工作与沟通','🏗️ 组织与管理':'工作与沟通',
    '🌐 宏观与周期':'思考与分析','🔍 逻辑与论证':'思考与分析','🧠 认知与思维':'思考与分析',
    '💼 商业判断':'工作与沟通','🛒 品牌与消费':'日常生活','⚔️ 竞争与生存':'思考与分析',
    '🧘 投资心态':'日常生活','👥 人性与关系':'人际关系','🔄 变化与趋势':'思考与分析',
    '🌿 人生感悟':'日常生活','⚠️ 风险与警示':'思考与分析','✍️ 表达句式与模板':'阅读与写作',
    '📈 投资理念':'思考与分析','💼 商务写作句式模板':'工作与沟通','⚖️ 判断断言类':'思考与分析',
    '🔄 对比揭示类':'思考与分析','🚀 文章开篇类':'阅读与写作','📋 列举论证类':'阅读与写作',
    '📊 因果分析类':'思考与分析','🎯 设问与反问类':'工作与沟通','📈 数据论证类':'思考与分析','✨ 排比与金句类':'阅读与写作'
  };
  function sceneOf(entry) { return SCENE_BY_OLD_CAT[entry && entry.cat] || '❓ 待整理'; }
  let state = {};
  let mine = {};
  let sbUrl = 'https://buzfmugezbemyfdmbgyt.supabase.co', sbKey = 'sb_publishable_HvD6YPPY-RpHLRicuoobSw_aSw1B_Ow', sbOn = true;
  const filters = { type: 'all', status: 'all', mastery: 'all', tier: 'all', use: 'all', scene: 'all', pos: 'all', role: 'all', function: 'all', customTag: 'all', q: '' };
  const desk = { q: '', use: 'all', topic: 'all', domain: 'all' };
  const deskOpen = new Set();   // 取用台内已展开详情的条目 id
  const openIds = new Set();
  const collapsedGroups = new Set();
  let selectedWordId = null;
  const isFiltering = () => filters.q.trim() || filters.status !== 'all' || filters.mastery !== 'all' || filters.tier !== 'all';

  /* ---------- 八个一级分类（tab）+ 首页 + 取用台 ---------- */
  const TABS = [
    { id: 'vocab', name: '词汇', icon: '📚', color: '#b8861b' },
    { id: 'phr',   name: '句式', icon: '✍️', color: '#2f8f9d' },
    { id: 'met',   name: '比喻', icon: '🎨', color: '#e07856' },
    { id: 'quote', name: '金句', icon: '💎', color: '#8a5cc4' },
    { id: 'humor', name: '幽默', icon: '😂', color: '#d4568a' },
    { id: 'diff',  name: '辨析', icon: '🔀', color: '#c0553a' },
    { id: 'cases', name: '案例', icon: '📒', color: '#3a6ea5' },
    { id: 'rule',  name: '规则', icon: '📐', color: '#6b8e23' },
  ];
  for (const id of SCENE_TABS) for (const sub of subcategoriesForTab(id)) collapsedGroups.add(id + '|' + sub);
  function tabOf(entry) { return (entry && entry.tab) || 'vocab'; }
  function tabName(id) { const t = TABS.find(x => x.id === id); return t ? t.name : id; }
  function tabVocab(tabId) { return VOCAB.filter(w => tabOf(w) === tabId); }
  function useOf(entry) { return (entry && entry.use && entry.use[0]) || '（未分）'; }
  function wordClassOf(entry) { return WORD_CLASS_BY_USE[useOf(entry)] || '❓ 待标词性'; }
  function expressionFunctionOf(entry) { return FUNCTION_BY_USE[useOf(entry)] || '❓ 待整理'; }
  function subUses(entry) { return (entry && entry.use && entry.use.slice(1)) || []; }
  function tabUses(tabId) {
    const s = new Set();
    for (const w of VOCAB) if (tabOf(w) === tabId) s.add(useOf(w));
    return USES.filter(u => s.has(u)).concat([...s].filter(u => USES.indexOf(u) < 0));
  }
  function tabGroups(tabId) {
    return SCENE_TABS.includes(tabId)
      ? subcategoriesForTab(tabId).map(sub => tabId + '|' + sub) : [];
  }
  function subcategoryOf(entry) {
    const tab = tabOf(entry);
    if (tab === 'vocab') return sceneOf(entry);
    if (tab === 'humor') return HUMOR_SCENE_BY_ID[entry.id] || '❓ 待整理';
    if (['phr', 'met', 'quote'].includes(tab)) return entry.cat || '❓ 待整理';
    return useOf(entry);
  }
  function subcategoriesForTab(tabId) {
    if (tabId === 'vocab') return SCENE_CATEGORIES.filter(s => tabVocab(tabId).some(w => subcategoryOf(w) === s));
    if (tabId === 'humor') return HUMOR_SCENE_CATEGORIES.filter(s => tabVocab(tabId).some(w => subcategoryOf(w) === s));
    if (['phr', 'met', 'quote'].includes(tabId)) return [...new Set(tabVocab(tabId).map(subcategoryOf))].sort((a, b) => a.localeCompare(b, 'zh-CN'));
    return tabUses(tabId);
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
  let customTags = [], entryTags = {};
  try { customTags = JSON.parse(localStorage.getItem(LS_CUSTOM_TAGS)) || []; } catch (e) { customTags = []; }
  try { entryTags = JSON.parse(localStorage.getItem(LS_ENTRY_TAGS)) || {}; } catch (e) { entryTags = {}; }
  function tagsForWord(entry) { return entryTags[String(entry.id)] || []; }
  function saveCustomTags() { try { localStorage.setItem(LS_CUSTOM_TAGS, JSON.stringify(customTags)); } catch (e) {} }
  function saveEntryTags() { try { localStorage.setItem(LS_ENTRY_TAGS, JSON.stringify(entryTags)); } catch (e) {} }

  /* ---------- 分类覆盖层：一条内容可同时归属多个表达功能与使用场景 ---------- */
  let taxOverrides = {}, entryEdits = {};
  try { taxOverrides = JSON.parse(localStorage.getItem(LS_TAXONOMY)) || {}; } catch (e) { taxOverrides = {}; }
  try { entryEdits = JSON.parse(localStorage.getItem(LS_EDITS)) || {}; } catch (e) { entryEdits = {}; }
  function saveTaxonomy() { try { localStorage.setItem(LS_TAXONOMY, JSON.stringify(taxOverrides)); } catch (e) {} }
  function saveEdits() { try { localStorage.setItem(LS_EDITS, JSON.stringify(entryEdits)); } catch (e) {} }
  // 参与功能/场景/词性分类的内容类型（辨析、案例、规则只在「内容类型」里出现）
  function isTaxonomized(w) { return SCENE_TABS.indexOf(tabOf(w)) >= 0; }
  function overrideOf(w) { return taxOverrides[String(w.id)] || null; }
  function posOf(w) {
    const o = overrideOf(w); if (o && o.pos) return o.pos;
    if (!isTaxonomized(w)) return '';
    return wordClassOf(w);
  }
  function functionsOf(w) {
    const o = overrideOf(w); if (o && o.func) return o.func;
    if (!isTaxonomized(w)) return [];
    const f = expressionFunctionOf(w);
    return f === '❓ 待整理' ? [] : [f];
  }
  function scenesOf(w) {
    const o = overrideOf(w); if (o && o.scene) return o.scene;
    if (!isTaxonomized(w)) return [];
    const s = subcategoryOf(w);
    return (!s || s === '❓ 待整理') ? [] : [s];
  }
  function setOverride(id, patch) {
    const k = String(id); const cur = taxOverrides[k] || {};
    for (const key of Object.keys(patch)) {
      const v = patch[key];
      if (v === null || v === undefined || v === '' || (Array.isArray(v) && !v.length)) delete cur[key];
      else cur[key] = v;
    }
    if (!Object.keys(cur).length) delete taxOverrides[k]; else taxOverrides[k] = cur;
    saveTaxonomy();
  }
  // 基于「当前生效值」做增删，保证勾选新值时原有派生值不丢
  function toggleTaxonomyValue(id, field, value) {
    const w = VOCAB.find(x => x.id === id); if (!w) return [];
    const cur = field === 'func' ? functionsOf(w) : scenesOf(w);
    const list = cur.slice();
    const i = list.indexOf(value);
    if (i >= 0) list.splice(i, 1); else list.push(value);
    const patch = {}; patch[field] = list; setOverride(id, patch);
    return list;
  }
  // 词性为单值：再次点击同一值即清除覆盖、回退派生值
  function setTaxonomyPos(id, value) {
    const w = VOCAB.find(x => x.id === id); if (!w) return '';
    const patch = { pos: (posOf(w) === value) ? '' : value };
    setOverride(id, patch);
    return patch.pos ? value : wordClassOf(w);
  }
  // 词条字段本地编辑（渲染时覆盖，不改 data.js）
  function wordView(w) {
    const e = entryEdits[String(w.id)];
    if (!e) return w;
    const merged = Object.assign({}, w);
    for (const k of ['word', 'syn', 'mean', 'example', 'scene', 'tier']) if (typeof e[k] === 'string') merged[k] = e[k];
    if (Array.isArray(e.use) && e.use.length) merged.use = e.use;
    return merged;
  }
  function isEdited(w) { return !!entryEdits[String(w.id)]; }

  /* ---------- 自建条目：批量导入的新内容并入 VOCAB（id 用 9 段，避开 data.js） ---------- */
  let extraItems = [];
  try { extraItems = JSON.parse(localStorage.getItem(LS_EXTRA)) || []; } catch (e) { extraItems = []; }
  if (extraItems.length) {
    const seen = {};
    for (const w of VOCAB) seen[w.id] = 1;
    const add = [];
    for (const it of extraItems) {
      let id = Number(it.id);
      if (!id || seen[id]) id = 900000 + add.length + 1;
      seen[id] = 1;
      add.push(Object.assign({ tab: 'vocab', syn: '', mean: '', example: '', scene: '', tier: '备用', use: ['❓ 待定'], cat: '01-观点与论述' }, it, { id: id }));
    }
    extraItems = add;
    for (const it of add) VOCAB.push(it);
  }
  function saveExtraItems() { try { localStorage.setItem(LS_EXTRA, JSON.stringify(extraItems)); } catch (e) {} }
  function nextExtraId() {
    let max = 900000;
    for (const w of VOCAB) if (w.id > max && w.id < 999999) max = w.id;
    return max + 1;
  }

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
  /* 句式模板占位符加粗：省略号 / XX YY / 独立 A B */
  function phrBold(s) {
    return s
      .replace(/(…{1,})/g, "<b>$1</b>")
      .replace(/(?<![A-Za-z])(XX|YY)(?![A-Za-z])/g, "<b>$1</b>")
      .replace(/(?<![A-Za-z])([AB])(?![A-Za-z])/g, "<b>$1</b>");
  }
  /* 句式例句骨架词加粗：仅对 phr 的例句生效，金色凸显关联词/句式标志 */
  const PAT_MARK = ['不在', '不在于', '而在于', '不是', '而是', '并非', '而非', '虽然', '但是', '看似', '实则', '实际上', '表面上', '一方面', '另一方面', '非但', '反而', '与其说', '不如说', '与其', '不如', '宁可', '也不', '不仅', '更', '不但', '而且', '既', '无论', '不论', '只有', '只要', '如果', '那么', '即便', '即使', '除非', '否则', '一旦', '关键在于', '关键不在', '而在', '根源在于', '根源是', '源于', '基于', '背后是', '背后', '说到底', '归根结底', '换言之', '换句话说', '说白了', '本质上', '本质是', '其实', '真正的', '所谓', '据此', '基于此', '对此', '表明', '我们建议', '我们提请', '予以', '印证了', '揭示了', '戳破', '颠覆', '绝非', '远比', '相比之下', '相较', '无非', '才是', '就是', '因为', '是由于', '是因为', '之所以', '原因是', '而应', '却', '恰恰', '正是'];
  const PAT_RE = new RegExp('(' + PAT_MARK.slice().sort((a, b) => b.length - a.length).map(x => x.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|') + ')', 'g');
  function exBold(text, q) {
    if (!text) return '';
    let h = esc(text).replace(PAT_RE, '<b>$1</b>');
    if (q) h = h.replace(new RegExp('(' + q.trim().split(/\s+/).filter(Boolean).map(t => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|') + ')', 'gi'), '<mark>$1</mark>');
    return h;
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
    const inLibrary = currentTab === 'library';
    const inTab = !inLibrary && TABS.some(t => t.id === currentTab);
    let arr = VOCAB.filter(raw => {
      const w = wordView(raw);
      if (inLibrary) { if (filters.type !== 'all' && tabOf(w) !== filters.type) return false; }
      else if (inTab) { if (tabOf(w) !== currentTab) return false; }
      const rec = getRec(w.id);
      if (filters.status === 'unused' && rec.count > 0) return false;
      if (filters.status === 'used' && rec.count === 0) return false;
      if (filters.status === 'review' && !needReview(rec)) return false;
      if (filters.status === 'sham' && !(rec.count >= 3 && rec.mastery !== '熟练')) return false;
      if (filters.mastery !== 'all' && rec.mastery !== filters.mastery) return false;
      if (filters.tier !== 'all' && w.tier !== filters.tier) return false;
      // 分类维度统一走多值版本：一条内容可同时命中多个表达功能 / 使用场景
      if (filters.pos !== 'all' && posOf(w) !== filters.pos) return false;
      if (filters.role !== 'all' && functionsOf(w).indexOf(filters.role) < 0) return false;
      if (filters.use !== 'all' && (w.use || []).indexOf(filters.use) < 0) return false;
      if (filters.scene !== 'all' && scenesOf(w).indexOf(filters.scene) < 0) return false;
      if (filters.customTag !== 'all' && !tagsForWord(w).includes(filters.customTag)) return false;
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

    // 顶部标题区：词条本体（让人一进来就知道是哪个词）
    const head = document.createElement('div');
    head.className = 'd-head';
    const wordHTML = (w.tab === 'phr') ? phrBold(esc(w.word))
      : q ? highlight(w.word, q) : esc(w.word);
    head.innerHTML = `<div class="d-word">${wordHTML}</div>` +
      `<div class="d-meta"><span class="d-tab">${esc(tabName(w.tab))}</span>` +
      (w.tier ? `<span class="d-tier t-${w.tier === '核心' ? 'a' : w.tier === '进阶' ? 'b' : 'c'}">${esc(w.tier)}</span>` : '') +
      `</div>`;
    d.appendChild(head);

    const appendRow = (label, value, exb) => {
      if (!value) return;
      const r = document.createElement('div'); r.className = 'row';
      const valHTML = exb ? exBold(value, q) : highlight(value, q);
      r.innerHTML = `<div class="label">${esc(label)}</div><div class="val">${valHTML}</div>`;
      d.appendChild(r);
    };
    if (w.mean) appendRow(w.tab === 'vocab' ? '\u6838\u5fc3\u91ca\u4e49' : L[1], w.mean, false);
    if (w.scene) appendRow(L[3], w.scene, false);
    const tags = document.createElement('div'); tags.className = 'detail-taxonomy';
    const addPillRow = (label, values, clickable, kind) => {
      if (!values.length) return;
      const row = document.createElement('div'); row.className = 'row';
      const val = document.createElement('div'); val.className = 'val';
      for (const value of values) {
        const pill = document.createElement(clickable ? 'button' : 'span');
        pill.className = 'tag' + (clickable ? ' ' + kind : '');
        pill.textContent = value;
        if (clickable && kind === 'idx') pill.dataset.idx = value;
        val.appendChild(pill);
      }
      const title = document.createElement('div'); title.className = 'label'; title.textContent = label;
      row.append(title, val); tags.appendChild(row);
    };
    if (w.tab === 'vocab') {
      addPillRow('\u573a\u666f\u5206\u7c7b', [sceneOf(w), ...subUses(w)], false, '');
      addPillRow('\u8bcd\u6027', [wordClassOf(w)], false, '');
      addPillRow('\u8868\u8fbe\u4f5c\u7528', [expressionFunctionOf(w)], false, '');
    } else {
      addPillRow('\u5206\u7c7b', [subcategoryOf(w)], false, '');
    }
    const topicTags = w.topic || [];
    if (topicTags.length) {
      const row = document.createElement('div'); row.className = 'row';
      const title = document.createElement('div'); title.className = 'label'; title.textContent = '\u9886\u57df\u6807\u7b7e';
      const val = document.createElement('div'); val.className = 'val';
      for (const topic of topicTags) {
        const ic = (TOPICS.find(x => x.name === topic) || {}).icon || '';
        const pill = document.createElement('button'); pill.className = 'tag tp'; pill.dataset.dom = topic;
        pill.textContent = (ic ? ic + ' ' : '') + topic; val.appendChild(pill);
      }
      row.append(title, val); tags.appendChild(row);
    }
    d.appendChild(tags);
    if (w.syn) appendRow(L[0], w.syn, false);
    if (w.example) appendRow(L[2], w.example, w.tab === 'phr');
    tags.querySelectorAll('.tag.tp').forEach(b => b.addEventListener('click', ev => {
      ev.stopPropagation();
      const dm = b.dataset.dom;
      currentTab = 'desk';
      try { localStorage.setItem(LS_TAB, currentTab); } catch (e) {}
      resetLibraryFilters();
      desk.q = ''; desk.use = 'all'; desk.topic = 'all'; desk.domain = dm;
      syncChips(); closeSidebar(); render();
      toast('已跳取用台，按领域标签「' + dm + '」筛选');
    }));
    tags.querySelectorAll('.tag.idx').forEach(b => b.addEventListener('click', ev => {
      ev.stopPropagation();
      const u = b.dataset.idx;
      currentTab = 'desk';
      try { localStorage.setItem(LS_TAB, currentTab); } catch (e) {}
      resetLibraryFilters();
      desk.q = ''; desk.use = u; desk.topic = 'all'; desk.domain = 'all';
      collapsedGroups.delete(u);
      syncChips(); closeSidebar(); render();
      toast('已跳取用台，按场景索引「' + u + '」筛出');
    }));
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
  function cardEl(raw) {
    const w = wordView(raw);
    const rec = getRec(w.id);
    const open = openIds.has(w.id);
    const q = filters.q.trim();
    const div = document.createElement('div');
    div.className = 'word' + (open ? ' open' : '') + (rec.count > 0 ? ' has-count' : '') + ' m-' + rec.mastery + (isEdited(w) ? ' locally-edited' : '');
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
    // 折叠时也能看到分类归属：内容类型 + 表达功能 + 场景
    const taxBits = [];
    if (isTaxonomized(w)) {
      for (const f of functionsOf(w)) taxBits.push('<span class="tax-mini tf">' + esc(f) + '</span>');
      for (const s of scenesOf(w)) taxBits.push('<span class="tax-mini ts">' + esc(s) + '</span>');
    } else {
      taxBits.push('<span class="tax-mini tt">' + esc(tabName(tabOf(w))) + '</span>');
    }
    if (posOf(w)) taxBits.push('<span class="tax-mini tp">' + esc(posOf(w)) + '</span>');
    tap.innerHTML = `<div class="w-text">${w.tab === "phr" ? phrBold(esc(w.word)) : highlight(w.word, q)}${myDot}</div>` +
      (w.syn ? `<div class="w-sub">${highlight(w.syn, q)}</div>` : '') +
      (extra || lastStr ? `<div class="w-foot">${extra}${lastStr ? `<span class="w-last">${esc(lastStr)}</span>` : ''}</div>` : '') +
      (taxBits.length ? `<div class="w-tax">${taxBits.join('')}</div>` : '');
    tap.addEventListener('click', () => { open ? openIds.delete(w.id) : openIds.add(w.id); render(); });
    const exp = document.createElement('button'); exp.type = 'button'; exp.className = 'expand-btn';
    exp.innerHTML = open
      ? '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 15 12 9 18 15"></polyline></svg>'
      : '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg>';
    exp.setAttribute('aria-label', open ? '收起' : '展开');
    exp.addEventListener('click', e => { e.stopPropagation(); open ? openIds.delete(w.id) : openIds.add(w.id); render(); });
    div.appendChild(cbtn); div.appendChild(tap); div.appendChild(exp);
    if (open) {
      const detail = buildDetail(w, rec);
      detail.appendChild(renderTaxonomyEditor(w));
      detail.appendChild(renderCustomTagEditor(w));
      detail.appendChild(renderEntryEditor(w));
      div.appendChild(detail);
    }
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
    const pageTitle = document.getElementById('pageTitle');
    const titles = { home: '首页', library: '我的词库', desk: '表达取用台', today: '今日打卡', categories: '分类管理', review: '复习训练', stats: '学习统计' };
    if (pageTitle) pageTitle.textContent = titles[currentTab] || tabName(currentTab);
    document.body.classList.toggle('on-home', ['home', 'desk'].includes(currentTab));
    document.body.classList.toggle('on-library', currentTab === 'library' || TABS.some(t => t.id === currentTab));
    document.body.classList.toggle('on-new-page', ['today', 'categories', 'review', 'stats'].includes(currentTab));
    if (currentTab === 'home') {
      document.body.classList.add('on-home');
      renderDashboard(); updateStats(); renderTabs(); return;
    }
    if (currentTab === 'desk') {
      document.body.classList.add('on-home');
      renderDesk(); updateStats(); renderTabs(); return;
    }
    if (currentTab === 'today') { renderTodayPage(); updateStats(); renderTabs(); return; }
    if (currentTab === 'categories') { renderCategoryManager(); updateStats(); renderTabs(); return; }
    if (currentTab === 'review') { renderReviewPage(); updateStats(); renderTabs(); return; }
    if (currentTab === 'stats') { renderStatsPage(); updateStats(); renderTabs(); return; }
    document.body.classList.remove('on-home');
    renderLibraryPage();
    updateStats(); renderTabs(); renderUseFilter(); updateToggleAll(); updateReviewBtn();
  }
  function currentVocab() { return currentTab === 'library' ? VOCAB : (TABS.some(t => t.id === currentTab) ? tabVocab(currentTab) : VOCAB); }
  function resetLibraryFilters() {
    filters.status = 'all'; filters.mastery = 'all'; filters.tier = 'all'; filters.use = 'all';
    filters.scene = 'all'; filters.pos = 'all'; filters.role = 'all'; filters.customTag = 'all'; filters.q = '';
    const search = document.getElementById('search'); if (search) search.value = '';
  }
  // 内容类型（vocab/phr/…）不再是独立页面，统一进「我的词库」并转成类型筛选
  function navigate(id, keepType) {
    if (TABS.some(t => t.id === id)) {
      navigateLibrary(keepType ? filters.type : id);
      return;
    }
    currentTab = id;
    selectedWordId = null;
    try { localStorage.setItem(LS_TAB, currentTab); } catch (e) {}
    resetLibraryFilters();
    syncChips();
    closeSidebar();
    render();
  }
  function navigateLibrary(typeId) {
    currentTab = 'library';
    selectedWordId = null;
    try { localStorage.setItem(LS_TAB, currentTab); } catch (e) {}
    filters.type = typeId || 'all';
    resetLibraryFiltersKeepType();
    syncChips();
    closeSidebar();
    render();
  }
  function resetLibraryFiltersKeepType() {
    const keep = filters.type;
    resetLibraryFilters();
    filters.type = keep;
  }
  // 供各页「跳到某条内容」使用：进词库、限定内容类型、自动展开该条
  function openInLibrary(w) {
    navigateLibrary(tabOf(w));
    openIds.add(w.id);
    render();
  }
  function pageHeading(title, subtitle) {
    const el = document.createElement('div'); el.className = 'page-heading';
    el.innerHTML = '<div><h2>' + esc(title) + '</h2><p>' + esc(subtitle || '') + '</p></div>';
    return el;
  }
  function renderLibraryPage() {
    const words = visibleWords();
    const page = document.createElement('div'); page.className = 'library-page';
    page.appendChild(pageHeading('我的词库', '共 ' + VOCAB.length + ' 条内容（词汇 / 短语 / 句式 / 表达）；点词条可展开详情、编辑与打标签'));

    // 内容类型切换
    const typeRow = document.createElement('div'); typeRow.className = 'library-type-row';
    const mkType = (id, name, count) => {
      const b = document.createElement('button'); b.type = 'button';
      b.className = 'type-chip' + (filters.type === id ? ' active' : '');
      b.innerHTML = esc(name) + '<b>' + count + '</b>';
      b.addEventListener('click', () => { filters.type = (filters.type === id ? 'all' : id); render(); });
      typeRow.appendChild(b);
    };
    mkType('all', '全部', VOCAB.length);
    for (const t of TABS) mkType(t.id, t.icon + ' ' + t.name, tabVocab(t.id).length);
    page.appendChild(typeRow);

    // 批量操作
    const ops = document.createElement('div'); ops.className = 'library-ops';
    const expAll = document.createElement('button'); expAll.type = 'button'; expAll.className = 'btn-ghost';
    expAll.textContent = '⇩ 导出全部';
    expAll.addEventListener('click', () => exportLibrary('all'));
    const expFiltered = document.createElement('button'); expFiltered.type = 'button'; expFiltered.className = 'btn-ghost';
    expFiltered.textContent = '⇩ 导出当前筛选';
    expFiltered.addEventListener('click', () => exportLibrary('filtered'));
    const impBtn = document.createElement('button'); impBtn.type = 'button'; impBtn.className = 'btn-primary';
    impBtn.textContent = '⇧ 批量导入';
    const impFile = document.createElement('input'); impFile.type = 'file'; impFile.accept = 'application/json,.json'; impFile.hidden = true;
    impBtn.addEventListener('click', () => impFile.click());
    impFile.addEventListener('change', () => { if (impFile.files && impFile.files[0]) importLibraryFile(impFile.files[0]); impFile.value = ''; });
    const hint = document.createElement('span'); hint.className = 'muted library-ops-hint';
    hint.textContent = '导入支持本工具导出的 JSON：同名词条更新字段与分类，新词条直接收录';
    ops.append(expAll, expFiltered, impBtn, impFile, hint);
    page.appendChild(ops);

    const result = document.createElement('div'); result.className = 'library-result';
    const activeBits = [];
    if (filters.type !== 'all') activeBits.push('内容类型：' + tabName(filters.type));
    if (filters.role !== 'all') activeBits.push('表达功能：' + filters.role);
    if (filters.scene !== 'all') activeBits.push('场景：' + filters.scene);
    if (filters.pos !== 'all') activeBits.push('词性：' + filters.pos);
    if (filters.customTag !== 'all') activeBits.push('自定义：' + filters.customTag);
    result.innerHTML = '<span>当前显示 ' + words.length + ' 条</span>' +
      (activeBits.length ? '<span class="library-active-filters">' + esc(activeBits.join('　·　')) + '</span>' : '');
    page.appendChild(result);

    const rows = document.createElement('div'); rows.className = 'library-rows library-flat-rows';
    if (words.length) {
      for (const w of words) rows.appendChild(cardEl(w));
    } else {
      const empty = document.createElement('div'); empty.className = 'empty';
      empty.textContent = '没有匹配的词条，试试清除筛选条件。';
      rows.appendChild(empty);
    }
    page.appendChild(rows); list.innerHTML = ''; list.appendChild(page);
  }
  function renderCustomTagEditor(entry) {
    const box = document.createElement('section'); box.className = 'custom-tag-editor';
    box.innerHTML = '<h3>自定义标签</h3>';
    const selected = new Set(tagsForWord(entry));
    if (!customTags.length) { const hint = document.createElement('p'); hint.className = 'muted'; hint.textContent = '还没有标签，可在下方新建并添加到这条内容。'; box.appendChild(hint); }
    const chips = document.createElement('div'); chips.className = 'custom-tag-list';
    for (const tag of customTags) {
      const label = document.createElement('label'); label.className = 'custom-tag-option';
      const input = document.createElement('input'); input.type = 'checkbox'; input.checked = selected.has(tag);
      input.addEventListener('change', () => {
        const values = new Set(tagsForWord(entry)); input.checked ? values.add(tag) : values.delete(tag);
        entryTags[String(entry.id)] = [...values]; saveEntryTags(); render();
      });
      label.append(input, document.createTextNode(tag)); chips.appendChild(label);
    }
    box.appendChild(chips);
    const row = document.createElement('div'); row.className = 'custom-tag-create';
    const input = document.createElement('input'); input.type = 'text'; input.maxLength = 20; input.placeholder = '新建标签并添加到此条';
    const add = document.createElement('button'); add.type = 'button'; add.className = 'btn-ghost'; add.textContent = '添加';
    add.addEventListener('click', () => {
      const tag = input.value.trim(); if (!tag) return;
      if (!customTags.includes(tag)) customTags.push(tag);
      const values = new Set(tagsForWord(entry)); values.add(tag); entryTags[String(entry.id)] = [...values];
      saveCustomTags(); saveEntryTags(); render();
    });
    row.append(input, add); box.appendChild(row); return box;
  }

  /* ---------- 分类标签编辑器：表达功能 / 使用场景可多选，词性单选 ---------- */
  const EXTRA_SCENE_VALUES = (function () {
    const set = {};
    for (const w of VOCAB) if (['phr', 'met', 'quote'].indexOf(tabOf(w)) >= 0 && w.cat) set[w.cat] = 1;
    return Object.keys(set);
  })();
  const SCENE_VALUES = SCENE_CATEGORIES.concat(HUMOR_SCENE_CATEGORIES, EXTRA_SCENE_VALUES)
    .filter((v, i, a) => a.indexOf(v) === i);
  function taxChip(label, active, onClick) {
    const b = document.createElement('button');
    b.type = 'button'; b.className = 'tax-chip' + (active ? ' on' : '');
    b.textContent = label;
    b.addEventListener('click', ev => { ev.stopPropagation(); onClick(); });
    return b;
  }
  function renderTaxonomyEditor(entry) {
    const box = document.createElement('section'); box.className = 'taxonomy-editor';
    const head = document.createElement('div'); head.className = 'tax-head';
    head.innerHTML = '<h3>分类标签</h3><span class="muted">一条内容可同时归属多个表达功能与使用场景</span>';
    box.appendChild(head);
    if (!isTaxonomized(entry)) {
      const p = document.createElement('p'); p.className = 'muted';
      p.textContent = '「' + tabName(tabOf(entry)) + '」按内容类型单列，不参与表达功能 / 使用场景 / 词性分类。';
      box.appendChild(p); return box;
    }
    const mkRow = (title, values, isOn, onToggle) => {
      const sec = document.createElement('div'); sec.className = 'tax-row';
      const lab = document.createElement('span'); lab.className = 'tax-label'; lab.textContent = title;
      const chips = document.createElement('div'); chips.className = 'tax-chips';
      for (const v of values) chips.appendChild(taxChip(v, isOn(v), () => onToggle(v)));
      sec.append(lab, chips); box.appendChild(sec);
    };
    mkRow('表达功能', EXPRESSION_FUNCTIONS, v => functionsOf(entry).indexOf(v) >= 0,
      v => { toggleTaxonomyValue(entry.id, 'func', v); render(); });
    mkRow('使用场景', SCENE_VALUES, v => scenesOf(entry).indexOf(v) >= 0,
      v => { toggleTaxonomyValue(entry.id, 'scene', v); render(); });
    mkRow('词性', WORD_CLASSES, v => posOf(entry) === v,
      v => { setTaxonomyPos(entry.id, v); render(); });
    return box;
  }

  /* ---------- 词条字段编辑（本地覆盖，不改 data.js） ---------- */
  function renderEntryEditor(entry) {
    const box = document.createElement('section'); box.className = 'entry-editor';
    const head = document.createElement('div'); head.className = 'tax-head';
    head.innerHTML = '<h3>编辑词条</h3><span class="muted">改动只存本机，原始词库不动</span>';
    box.appendChild(head);
    if (isEdited(entry)) {
      const warn = document.createElement('p'); warn.className = 'edited-flag';
      warn.innerHTML = '此条已本地修改。';
      const undo = document.createElement('button'); undo.type = 'button'; undo.className = 'btn-ghost'; undo.textContent = '撤销修改';
      undo.addEventListener('click', ev => { ev.stopPropagation(); delete entryEdits[String(entry.id)]; saveEdits(); toast('已还原为原始内容'); render(); });
      warn.appendChild(undo); box.appendChild(warn);
    }
    const fields = [['word', '词条'], ['syn', '同义词'], ['mean', '释义'], ['example', '例句'], ['scene', '使用场景']];
    const inputs = {};
    for (const [k, label] of fields) {
      const row = document.createElement('label'); row.className = 'edit-field';
      const cap = document.createElement('span'); cap.textContent = label;
      const inp = document.createElement(k === 'example' || k === 'mean' ? 'textarea' : 'input');
      if (inp.tagName === 'INPUT') inp.type = 'text';
      inp.value = entry[k] || '';
      inputs[k] = inp; row.append(cap, inp); box.appendChild(row);
    }
    const tierRow = document.createElement('label'); tierRow.className = 'edit-field';
    const tierCap = document.createElement('span'); tierCap.textContent = '分级';
    const tierSel = document.createElement('select');
    for (const t of ['核心', '进阶', '备用']) {
      const o = document.createElement('option'); o.value = t; o.textContent = t;
      if ((entry.tier || '备用') === t) o.selected = true;
      tierSel.appendChild(o);
    }
    tierRow.append(tierCap, tierSel); box.appendChild(tierRow);
    const save = document.createElement('button'); save.type = 'button'; save.className = 'btn-primary'; save.textContent = '保存修改';
    save.addEventListener('click', ev => {
      ev.stopPropagation();
      const patch = { tier: tierSel.value };
      for (const [k] of fields) patch[k] = inputs[k].value.trim();
      const base = VOCAB.find(x => x.id === entry.id) || entry;
      const changed = Object.keys(patch).some(k => String(patch[k] || '') !== String(base[k] || ''));
      if (!changed) { delete entryEdits[String(entry.id)]; } else { entryEdits[String(entry.id)] = patch; }
      saveEdits(); toast(changed ? '已保存到本机' : '已还原为原始内容'); render();
    });
    box.appendChild(save);
    return box;
  }

  /* ---------- 批量导入 / 导出 ---------- */
  function downloadJSON(obj, filename) {
    const blob = new Blob([JSON.stringify(obj, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = filename;
    document.body.appendChild(a); a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1500);
  }
  function exportLibrary(scope) {
    const words = scope === 'filtered' ? visibleWords() : VOCAB.slice();
    if (!words.length) { toast('没有可导出的内容'); return; }
    const payload = {
      导出时间: new Date().toISOString().slice(0, 19).replace('T', ' '),
      来源: 'check-in 我的词库',
      范围: scope === 'filtered' ? '当前筛选结果' : '全部词库',
      条数: words.length,
      items: words.map(w => ({
        id: w.id, 内容类型: tabOf(w), 词条: w.word, 同义词: w.syn || '', 释义: w.mean || '',
        例句: w.example || '', 使用场景: w.scene || '', 分级: w.tier || '备用', 用途: w.use || [],
        词性: posOf(w), 表达功能: functionsOf(w), 场景分类: scenesOf(w), 自定义标签: tagsForWord(w)
      }))
    };
    const stamp = new Date().toISOString().slice(0, 10);
    downloadJSON(payload, '我的词库_' + (scope === 'filtered' ? '筛选结果' : '全量') + '_' + stamp + '.json');
    toast('已导出 ' + words.length + ' 条');
  }
  const IMPORT_FIELDS = { 词条: 'word', word: 'word', 同义词: 'syn', syn: 'syn', 释义: 'mean', mean: 'mean', 例句: 'example', example: 'example', 使用场景: 'scene', scene: 'scene', 分级: 'tier', tier: 'tier' };
  function importLibraryFile(file) {
    const reader = new FileReader();
    reader.onload = () => {
      let data; try { data = JSON.parse(String(reader.result)); } catch (e) { toast('文件不是合法 JSON'); return; }
      const items = Array.isArray(data) ? data : (data.items || data.词库 || data.entries || []);
      if (!Array.isArray(items) || !items.length) { toast('文件里没有可导入的条目'); return; }
      const byId = {}, byWord = {};
      for (const w of VOCAB) { byId[w.id] = w; byWord[String(w.word).trim()] = w; }
      let added = 0, updated = 0, skipped = 0;
      for (const it of items) {
        if (!it || typeof it !== 'object') { skipped++; continue; }
        const word = String(it.词条 || it.word || '').trim();
        if (!word) { skipped++; continue; }
        const exist = (it.id && byId[it.id]) || byWord[word];
        if (exist) {
          const patch = {};
          for (const key of Object.keys(IMPORT_FIELDS)) {
            if (typeof it[key] === 'string') patch[IMPORT_FIELDS[key]] = it[key].trim();
          }
          if (Array.isArray(it.用途)) patch.use = it.用途;
          if (Object.keys(patch).length) {
            const base = VOCAB.find(x => x.id === exist.id) || exist;
            const real = {};
            for (const k of Object.keys(patch)) if (String(patch[k] || '') !== String(base[k] || '')) real[k] = patch[k];
            if (Object.keys(real).length) { entryEdits[String(exist.id)] = Object.assign({}, entryEdits[String(exist.id)], real); updated++; }
          }
          const tax = {};
          if (it.词性) tax.pos = it.词性;
          if (Array.isArray(it.表达功能)) tax.func = it.表达功能;
          if (Array.isArray(it.场景分类)) tax.scene = it.场景分类;
          if (Object.keys(tax).length) setOverride(exist.id, tax);
          if (Array.isArray(it.自定义标签)) {
            const values = new Set(tagsForWord(exist));
            for (const t of it.自定义标签) { values.add(t); if (customTags.indexOf(t) < 0) customTags.push(t); }
            entryTags[String(exist.id)] = [...values];
          }
        } else {
          const item = {
            id: (typeof it.id === 'number' && !byId[it.id]) ? it.id : nextExtraId(),
            tab: TABS.some(t => t.id === (it.内容类型 || it.tab)) ? (it.内容类型 || it.tab) : 'vocab',
            word: word,
            syn: String(it.同义词 || it.syn || ''), mean: String(it.释义 || it.mean || ''),
            example: String(it.例句 || it.example || ''), scene: String(it.使用场景 || it.scene || ''),
            tier: ['核心', '进阶', '备用'].indexOf(it.分级 || it.tier) >= 0 ? (it.分级 || it.tier) : '备用',
            use: Array.isArray(it.用途) && it.用途.length ? it.用途 : ['❓ 待定'],
            cat: '01-观点与论述', topic: []
          };
          extraItems.push(item); VOCAB.push(item);
          byId[item.id] = item; byWord[item.word] = item;
          const tax = {};
          if (it.词性) tax.pos = it.词性;
          if (Array.isArray(it.表达功能)) tax.func = it.表达功能;
          if (Array.isArray(it.场景分类)) tax.scene = it.场景分类;
          if (Object.keys(tax).length) setOverride(item.id, tax);
          if (Array.isArray(it.自定义标签)) {
            entryTags[String(item.id)] = it.自定义标签.slice();
            for (const t of it.自定义标签) if (customTags.indexOf(t) < 0) customTags.push(t);
          }
          added++;
        }
      }
      saveExtraItems(); saveEdits(); saveEntryTags(); saveCustomTags();
      toast('导入完成：新增 ' + added + ' 条，更新 ' + updated + ' 条' + (skipped ? '，跳过 ' + skipped + ' 条' : ''));
      render();
    };
    reader.readAsText(file, 'utf-8');
  }
  function renderTodayPage() {
    const target = 5, count = todayCount(), pct = Math.min(100, Math.round(count / target * 100));
    const wrap = document.createElement('div'); wrap.className = 'new-page';
    wrap.appendChild(pageHeading('今天练一点，表达就多一点', '每日推荐 5 条，复习旧内容并尝试把新表达用出来。'));
    const goal = document.createElement('section'); goal.className = 'goal-card';
    goal.innerHTML = '<div><span class="eyebrow">今日目标</span><h3>完成 5 次词条练习</h3><p>已记录 ' + count + ' 次 · 连续打卡 ' + streak() + ' 天</p></div>' +
      '<div class="goal-ring" style="--progress:' + pct + '%"><b>' + Math.min(count, target) + '<small>/5</small></b></div>';
    const bar = document.createElement('div'); bar.className = 'goal-bar'; bar.innerHTML = '<span style="width:' + pct + '%"></span>'; goal.appendChild(bar); wrap.appendChild(goal);
    const section = document.createElement('section'); section.className = 'new-card';
    const sh = document.createElement('div'); sh.className = 'new-card-head'; sh.innerHTML = '<h3>今日推荐</h3><button type="button" class="link-btn">换一批 ↻</button>';
    sh.querySelector('button').addEventListener('click', () => { let n = 0; try { n = +(localStorage.getItem(LS_TODAY_NONCE + dayKey(new Date())) || 0); localStorage.setItem(LS_TODAY_NONCE + dayKey(new Date()), String(n + 1)); } catch (e) {} renderTodayPage(); });
    section.appendChild(sh);
    const picks = pickToday();
    if (!picks.length) { const done = document.createElement('div'); done.className = 'empty'; done.textContent = '今天推荐的内容都练过了，可以去词库继续探索。'; section.appendChild(done); }
    for (const w of picks) {
      const rec = getRec(w.id); const row = document.createElement('article'); row.className = 'practice-item';
      row.innerHTML = '<div class="practice-main"><span class="eyebrow">' + esc(tabName(w.tab)) + ' · ' + esc(w.tier || '') + '</span><h4>' + (w.tab === 'phr' ? phrBold(esc(w.word)) : esc(w.word)) + '</h4><p>' + esc(w.mean || w.syn || '') + '</p><small>' + esc(w.scene || '') + '</small></div>';
      const actions = document.createElement('div'); actions.className = 'practice-actions';
      const open = document.createElement('button'); open.type = 'button'; open.className = 'btn-ghost'; open.textContent = '查看词条'; open.addEventListener('click', () => { navigate(w.tab); openIds.add(w.id); render(); });
      const check = document.createElement('button'); check.type = 'button'; check.className = 'btn-primary'; check.textContent = isToday(rec.last_used) ? '再练一次' : '完成练习'; check.addEventListener('click', () => checkIn(w.id));
      actions.append(open, check); row.appendChild(actions); section.appendChild(row);
    }
    wrap.appendChild(section); list.innerHTML = ''; list.appendChild(wrap);
  }
  function renderCategoryManager() {
    const wrap = document.createElement('div'); wrap.className = 'new-page';
    wrap.appendChild(pageHeading('分类管理', '分类即标签：一条内容可同时归属多个表达功能与使用场景。改动只存本机，随时可撤销，原始词库不动。'));
    // 参与功能/场景/词性分类的只有前五类；辨析、案例、规则仅出现在「内容类型」
    const taxScope = VOCAB.filter(isTaxonomized);
    const moduleCard = (index, title, subtitle) => {
      const sec = document.createElement('section'); sec.className = 'new-card cat-module';
      sec.innerHTML = '<div class="new-card-head"><h3><span class="module-index">' + index + '</span>' + esc(title) + '</h3><span class="muted">' + esc(subtitle) + '</span></div>';
      wrap.appendChild(sec); return sec;
    };
    const goLibrary = (patch) => {
      currentTab = 'library';
      try { localStorage.setItem(LS_TAB, currentTab); } catch (e) {}
      resetLibraryFilters();
      for (const k of Object.keys(patch)) filters[k] = patch[k];
      syncChips(); closeSidebar(); render();
    };
    const valueGrid = (values, countOf, onPick, subOf) => {
      const grid = document.createElement('div'); grid.className = 'category-grid';
      for (const v of values) {
        const n = countOf(v);
        const b = document.createElement('button'); b.type = 'button'; b.className = 'use-card';
        b.innerHTML = '<span>' + esc(v) + '</span><b>' + n + '</b>';
        b.title = n ? '查看这 ' + n + ' 条' : '暂无内容';
        b.addEventListener('click', () => onPick(v));
        if (subOf) {
          const subs = subOf(v);
          if (subs && subs.length) {
            const row = document.createElement('div'); row.className = 'value-subs';
            for (const s of subs) { const t = document.createElement('span'); t.className = 'sub-tag'; t.textContent = s; row.appendChild(t); }
            b.appendChild(row);
          }
        }
        grid.appendChild(b);
      }
      return grid;
    };

    /* 1. 内容类型 */
    const typeCard = moduleCard(1, '内容类型', '八类内容，全部收录在「我的词库」里');
    const typeGrid = document.createElement('div'); typeGrid.className = 'category-grid';
    for (const t of TABS) {
      const n = tabVocab(t.id).length;
      const solo = SCENE_TABS.indexOf(t.id) < 0;
      const b = document.createElement('button'); b.type = 'button'; b.className = 'category-card';
      b.innerHTML = '<span class="category-icon" style="--tc:' + t.color + '">' + t.icon + '</span><span><b>' + esc(t.name) +
        (solo ? '<small>仅内容类型</small>' : '') + '</b><small>' + n + ' 条内容</small></span><span class="category-arrow">›</span>';
      b.addEventListener('click', () => goLibrary({ type: t.id }));
      typeGrid.appendChild(b);
    }
    typeCard.appendChild(typeGrid);

    /* 2. 表达功能 */
    const funcCard = moduleCard(2, '表达功能', '覆盖词汇 / 句式 / 比喻 / 金句 / 幽默；可多选');
    funcCard.appendChild(valueGrid(EXPRESSION_FUNCTIONS,
      v => taxScope.filter(w => functionsOf(w).indexOf(v) >= 0).length,
      v => goLibrary({ role: v, type: 'all' }),
      v => EXPRESSION_SUBCATEGORIES[v]));

    /* 3. 使用场景 */
    const sceneCard = moduleCard(3, '使用场景', '覆盖词汇 / 句式 / 比喻 / 金句 / 幽默；可多选');
    sceneCard.appendChild(valueGrid(SCENE_VALUES,
      v => taxScope.filter(w => scenesOf(w).indexOf(v) >= 0).length,
      v => goLibrary({ scene: v, type: 'all' })));

    /* 4. 词性 */
    const posCard = moduleCard(4, '词性', '单选；点一下设为该词性，再点取消');
    posCard.appendChild(valueGrid(WORD_CLASSES,
      v => taxScope.filter(w => posOf(w) === v).length,
      v => goLibrary({ pos: v, type: 'all' })));

    /* 5. 自定义标签 */
    const tagCard = moduleCard(5, '自定义标签', '自己定义的标签，随词条保存');
    const createRow = document.createElement('div'); createRow.className = 'custom-tag-create';
    const tagInput = document.createElement('input'); tagInput.type = 'text'; tagInput.maxLength = 20;
    tagInput.placeholder = '例如：想练习、适合开头';
    const createButton = document.createElement('button'); createButton.type = 'button';
    createButton.className = 'btn-ghost'; createButton.textContent = '新建标签';
    createButton.addEventListener('click', () => {
      const value = tagInput.value.trim(); if (!value) return;
      if (!customTags.includes(value)) { customTags.push(value); saveCustomTags(); }
      renderCategoryManager();
    });
    createRow.append(tagInput, createButton); tagCard.appendChild(createRow);
    const customGrid = document.createElement('div'); customGrid.className = 'category-grid custom-tag-categories';
    if (!customTags.length) {
      const emptyTags = document.createElement('p'); emptyTags.className = 'muted';
      emptyTags.textContent = '暂无自定义标签。在词条详情里也能直接新建并打标。';
      customGrid.appendChild(emptyTags);
    }
    for (const tag of customTags) {
      const n = VOCAB.filter(w => tagsForWord(w).indexOf(tag) >= 0).length;
      const item = document.createElement('button'); item.type = 'button'; item.className = 'use-card';
      item.innerHTML = '<span>' + esc(tag) + '</span><b>' + n + '</b>';
      item.addEventListener('click', () => goLibrary({ customTag: tag, type: 'all' }));
      customGrid.appendChild(item);
    }
    tagCard.appendChild(customGrid);

    /* 附加：领域与主题标签（保留原有辅助筛选） */
    const tagValues = [];
    for (const w of taxScope) for (const t of (w.topic || [])) if (tagValues.indexOf(t) < 0) tagValues.push(t);
    if (tagValues.length) {
      const domainCard = document.createElement('section'); domainCard.className = 'new-card';
      domainCard.innerHTML = '<div class="new-card-head"><h3>领域与主题标签</h3><span class="muted">词库自带的辅助筛选，不参与上面的分类</span></div>';
      const grid = document.createElement('div'); grid.className = 'category-grid';
      for (const tag of tagValues.sort((a, b) => a.localeCompare(b, 'zh-CN'))) {
        const n = taxScope.filter(w => (w.topic || []).indexOf(tag) >= 0).length;
        const item = document.createElement('div'); item.className = 'use-card';
        item.innerHTML = '<span>' + esc(tag) + '</span><b>' + n + '</b>';
        grid.appendChild(item);
      }
      domainCard.appendChild(grid); wrap.appendChild(domainCard);
    }

    const note = document.createElement('p'); note.className = 'taxonomy-note';
    note.textContent = '表达功能、使用场景、词性的默认值来自词库原始分类；在词条详情里改动会存为本地覆盖，原始词库保持不变。辨析、案例、规则按你的要求只放在内容类型里，不再参与这三个维度。';
    wrap.appendChild(note);
    list.innerHTML = ''; list.appendChild(wrap);
  }
  function renderReviewPage() {
    const due = VOCAB.filter(w => needReview(getRec(w.id))).sort((a, b) => {
      const ar = getRec(a.id), br = getRec(b.id); const tier = { '核心': 0, '进阶': 1, '备用': 2 };
      return (tier[a.tier] ?? 3) - (tier[b.tier] ?? 3) || (ar.last_used || '').localeCompare(br.last_used || '');
    });
    const wrap = document.createElement('div'); wrap.className = 'new-page';
    wrap.appendChild(pageHeading('复习训练', '优先复习超过 7 天未使用的内容；可以直接练习，也可以标记掌握程度。'));
    const summary = document.createElement('div'); summary.className = 'metric-row';
    summary.innerHTML = '<div class="metric-card"><b>' + due.length + '</b><span>待复习</span></div><div class="metric-card"><b>' + todayCount() + '</b><span>今日练习</span></div><div class="metric-card"><b>' + streak() + ' 天</b><span>连续打卡</span></div>';
    wrap.appendChild(summary);
    const section = document.createElement('section'); section.className = 'new-card'; section.innerHTML = '<div class="new-card-head"><h3>复习队列</h3><span class="muted">先显示 60 条</span></div>';
    for (const w of due.slice(0, 60)) {
      const rec = getRec(w.id); const row = document.createElement('article'); row.className = 'practice-item compact';
      row.innerHTML = '<div class="practice-main"><span class="eyebrow">' + esc(tabName(w.tab)) + ' · ' + esc(w.tier || '') + '</span><h4>' + (w.tab === 'phr' ? phrBold(esc(w.word)) : esc(w.word)) + '</h4><p>' + esc(w.mean || w.syn || '') + '</p><small>' + (rec.last_used ? '上次使用：' + esc(fmt(rec.last_used)) : '尚未打卡') + '</small></div>';
      const actions = document.createElement('div'); actions.className = 'practice-actions';
      const open = document.createElement('button'); open.type = 'button'; open.className = 'btn-ghost'; open.textContent = '详情'; open.addEventListener('click', () => { navigate(w.tab); openIds.add(w.id); render(); });
      const check = document.createElement('button'); check.type = 'button'; check.className = 'btn-primary'; check.textContent = '练习'; check.addEventListener('click', () => checkIn(w.id)); actions.append(open, check); row.appendChild(actions); section.appendChild(row);
    }
    if (!due.length) { const empty = document.createElement('div'); empty.className = 'empty'; empty.textContent = '当前没有待复习内容，继续保持。'; section.appendChild(empty); }
    wrap.appendChild(section); list.innerHTML = ''; list.appendChild(wrap);
  }
  function renderStatsPage() {
    const done = checkedSet().size; const total = VOCAB.reduce((n, w) => n + (getRec(w.id).count || 0), 0);
    const wrap = document.createElement('div'); wrap.className = 'new-page';
    wrap.appendChild(pageHeading('学习统计', '统计依据现有词条打卡、掌握度与每日记录。'));
    const metrics = document.createElement('div'); metrics.className = 'metric-row';
    metrics.innerHTML = '<div class="metric-card"><b>' + VOCAB.length + '</b><span>词库条目</span></div><div class="metric-card"><b>' + done + '</b><span>练习过的条目</span></div><div class="metric-card"><b>' + total + '</b><span>累计打卡次数</span></div><div class="metric-card"><b>' + streak() + ' 天</b><span>连续打卡</span></div>';
    wrap.appendChild(metrics);
    wrap.appendChild(buildWeekChart()); wrap.appendChild(buildTabsBreakdown(checkedSet()));
    let m = [0, 0, 0]; for (const w of VOCAB) { const x = getRec(w.id).mastery; m[x === '偶尔' ? 1 : x === '熟练' ? 2 : 0]++; }
    wrap.appendChild(buildMastery(m[0], m[1], m[2]));
    list.innerHTML = ''; list.appendChild(wrap);
  }
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
    const welcome = document.createElement('section'); welcome.className = 'welcome-panel';
    welcome.innerHTML = '<div><span class="eyebrow">词汇工坊 · 每天练习一点</span><h2>早上好，继续积累你的表达力</h2><p>从词汇、比喻、金句和幽默中找到下一句好表达。</p></div>' +
      '<div class="welcome-streak">🔥 <b>' + streak() + '</b><small>天连续练习</small></div>';
    const quick = document.createElement('div'); quick.className = 'quick-grid';
    const quickPages = [
      ['📚', '我的词库', VOCAB.length + ' 条内容', 'vocab'],
      ['🗂️', '分类管理', TABS.length + ' 种形式', 'categories'],
      ['✅', '今日打卡', '今日 ' + todayCount() + ' 次练习', 'today'],
      ['📊', '学习统计', '查看练习进度', 'stats'],
    ];
    for (const [icon, name, sub, id] of quickPages) {
      const b = document.createElement('button'); b.type = 'button'; b.className = 'quick-card';
      b.innerHTML = '<span>' + icon + '</span><b>' + name + '</b><small>' + sub + '</small><i>›</i>';
      b.addEventListener('click', () => navigate(id)); quick.appendChild(b);
    }
    dash.appendChild(welcome); dash.appendChild(buildHero(totalWords, done, total, pct)); dash.appendChild(quick);
    dash.appendChild(buildToday());
    dash.appendChild(buildRecentWords());
    dash.appendChild(buildBlind(doneSet));
    dash.appendChild(buildWeekChart());
    dash.appendChild(buildTabsBreakdown(doneSet));
    dash.appendChild(buildMastery(m0, m1, m2));
    dash.appendChild(buildMineList());
    list.innerHTML = '';
    list.appendChild(dash);
  }
  function buildRecentWords() {
    const sec = document.createElement('section'); sec.className = 'dash-section recent-section';
    sec.innerHTML = '<h2 class="dash-h">最近加入 <small>按词条编号展示最近添加的内容</small></h2>';
    const items = VOCAB.slice().sort((a, b) => b.id - a.id).slice(0, 5);
    const rows = document.createElement('div'); rows.className = 'recent-grid';
    for (const w of items) {
      const b = document.createElement('button'); b.type = 'button'; b.className = 'recent-item';
      b.innerHTML = '<b>' + esc(w.word) + '</b><span>' + esc(tabName(w.tab)) + '</span><small>' + esc((w.mean || w.syn || '').slice(0, 44)) + '</small>';
      b.addEventListener('click', () => { navigate(w.tab); openIds.add(w.id); render(); }); rows.appendChild(b);
    }
    sec.appendChild(rows); return sec;
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
      row.innerHTML = '<div class="tr-main"><div class="tr-w">' + (w.tab === "phr" ? phrBold(esc(w.word)) : esc(w.word)) + '</div>' +
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
        // 用途维度天然跨多个形式 tab，盲区点开应到「取用台」按 use 跨形式聚合，
        // 否则切到 vocab 单页会把 quote/met/diff 里的条目全过滤掉（如「人生修养」vocab 里 0 条）
        currentTab = 'desk'; resetLibraryFilters();
        desk.q = ''; desk.use = r.use; desk.topic = 'all'; desk.domain = 'all';
        try { localStorage.setItem(LS_TAB, currentTab); } catch (e) {}
        collapsedGroups.delete(r.use);
        syncChips(); closeSidebar(); render();
        toast('已打开取用台 · 「' + r.label + '」全部形式');
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
        currentTab = 'library'; resetLibraryFilters(); filters.status = 'sham';
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
      const refWord = w ? w.word : "(已删条目)";
      const refHTML = (w && w.tab === "phr") ? phrBold(esc(refWord)) : esc(refWord);
      row.innerHTML = '<div class="mr-w">' + refHTML + '<small>' + esc(fmt(it.at)) + '</small></div>' +
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
    sec.innerHTML = '<h2 class="dash-h">八个一级分类完成度</h2>';
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
      card.addEventListener('click', () => navigate(t.id));
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
    if (desk.domain !== 'all') arr = arr.filter(w => (w.topic || []).indexOf(desk.domain) >= 0);
    if (desk.topic !== 'all') {
      const tp = TOPICS.find(t => t.name === desk.topic);
      const isDomain = DOMAINS.indexOf(desk.topic) >= 0;
      if (isDomain) {
        // 领域标签：优先读物化的 w.topic，无则回退关键词匹配
        arr = arr.filter(w => (w.topic || []).indexOf(desk.topic) >= 0);
      } else if (tp) {
        arr = arr.filter(w => {
          if ((w.topic || []).indexOf(desk.topic) >= 0) return true;
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
    inp.addEventListener('input', () => { desk.q = inp.value; deskOpen.clear(); renderDeskBody(body); });
    head.appendChild(inp);
    const urow = document.createElement('div'); urow.className = 'chip-row desk-chips';
    const uAll = document.createElement('button'); uAll.className = 'chip' + (desk.use === 'all' ? ' active' : ''); uAll.textContent = '用途·全部';
    uAll.addEventListener('click', () => { desk.use = 'all'; deskOpen.clear(); renderDeskBody(body); markChips(urow, desk.use); });
    urow.appendChild(uAll);
    for (const u of USES) {
      const b = document.createElement('button'); b.className = 'chip' + (desk.use === u ? ' active' : ''); b.dataset.u = u;
      b.textContent = u;
      b.addEventListener('click', () => { desk.use = (desk.use === u ? 'all' : u); deskOpen.clear(); renderDeskBody(body); markChips(urow, desk.use); });
      urow.appendChild(b);
    }
    head.appendChild(urow);
    // 副轴·领域标签（与分类/主题并列，语义互斥：领域指题材，主题指内容包）
    const drow = document.createElement('div'); drow.className = 'chip-row desk-chips';
    const dAll = document.createElement('button'); dAll.className = 'chip' + (desk.domain === 'all' ? ' active' : ''); dAll.textContent = '领域·全部';
    dAll.addEventListener('click', () => { desk.domain = 'all'; deskOpen.clear(); renderDeskBody(body); markChips(drow, desk.domain, 'd'); });
    drow.appendChild(dAll);
    for (const dm of DOMAINS) {
      const b = document.createElement('button'); b.className = 'chip' + (desk.domain === dm ? ' active' : ''); b.dataset.d = dm;
      b.textContent = dm;
      b.addEventListener('click', () => { desk.domain = (desk.domain === dm ? 'all' : dm); deskOpen.clear(); renderDeskBody(body); markChips(drow, desk.domain, 'd'); });
      drow.appendChild(b);
    }
    head.appendChild(drow);
    const trow = document.createElement('div'); trow.className = 'chip-row desk-chips';
    const tAll = document.createElement('button'); tAll.className = 'chip' + (desk.topic === 'all' ? ' active' : ''); tAll.textContent = '主题·全部';
    tAll.addEventListener('click', () => { desk.topic = 'all'; deskOpen.clear(); renderDeskBody(body); markChips(trow, desk.topic, 't'); });
    trow.appendChild(tAll);
    for (const tp of TOPICS) {
      const b = document.createElement('button'); b.className = 'chip' + (desk.topic === tp.name ? ' active' : ''); b.dataset.t = tp.name;
      b.textContent = tp.icon + ' ' + tp.name;
      b.addEventListener('click', () => { desk.topic = (desk.topic === tp.name ? 'all' : tp.name); deskOpen.clear(); renderDeskBody(body); markChips(trow, desk.topic, 't'); });
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
        const sub = (w.use || []).slice(1).map(u => '<button class="utag idx" data-idx="' + esc(u) + '">' + esc(u) + '</button>').join('');
        row.innerHTML = '<div class="dr-main"><div class="dr-w">' + (w.tab === "phr" ? phrBold(esc(w.word)) : esc(w.word)) + '</div>' +
          '<div class="dr-s">' + esc(w.syn || w.mean || '') + '</div></div>' +
          '<div class="dr-right">' + sub + (rec.count ? '<span class="dr-c">' + rec.count + '</span>' : '') +
          '<span class="dr-cp" title="复制">⧉</span></div>';
        // 点击行 → 原地展开详情（toggle 后重渲染）
        row.addEventListener('click', () => {
          if (deskOpen.has(w.id)) deskOpen.delete(w.id); else deskOpen.add(w.id);
          renderDeskBody(body);
        });
        // 点 ⧉ → 只复制词条
        const cp = row.querySelector('.dr-cp');
        if (cp) cp.addEventListener('click', ev => {
          ev.stopPropagation();
          copyText(w.word, '已复制：' + w.word.slice(0, 14));
          cp.textContent = '✓';
          setTimeout(() => { cp.textContent = '⧉'; }, 900);
        });
        row.querySelectorAll('.utag.idx').forEach(b => b.addEventListener('click', ev => {
          ev.stopPropagation();
          desk.use = (desk.use === b.dataset.idx ? 'all' : b.dataset.idx);
          desk.q = ''; deskOpen.clear();
          renderDeskBody(body);
          urow.querySelectorAll('.chip').forEach(x => {
            const v = x.dataset.u;
            x.classList.toggle('active', desk.use === 'all' ? !v : v === desk.use);
          });
          toast(desk.use === 'all' ? '已清除场景筛选' : '按场景索引「' + desk.use + '」筛选');
        }));
        sec.appendChild(row);
        // 已展开 → 在行下方插入详情面板
        if (deskOpen.has(w.id)) {
          const wrap = document.createElement('div');
          wrap.className = 'desk-detail';
          const det = buildDetail(w, rec);
          wrap.appendChild(det);
          const cbtn = document.createElement('button');
          cbtn.type = 'button';
          cbtn.className = 'checkin-btn' + (isToday(rec.last_used) ? ' today' : '');
          cbtn.setAttribute('aria-label', '打卡：' + w.word);
          cbtn.innerHTML = rec.count > 0 ? '<span class="n">' + rec.count + '</span>' : '<span class="plus">✚</span>';
          cbtn.addEventListener('click', ev => { ev.stopPropagation(); checkIn(w.id); });
          wrap.appendChild(cbtn);
          sec.appendChild(wrap);
        }
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
    const addPage = (id, icon, name, count) => {
      const b = document.createElement('button'); b.type = 'button';
      b.className = 'tab' + (currentTab === id ? ' active' : '');
      b.innerHTML = '<span class="t-ico">' + icon + '</span><span class="t-name">' + name + '</span>' +
        (count != null ? '<span class="t-count">' + count + '</span>' : '');
      b.addEventListener('click', () => navigate(id));
      el.appendChild(b);
    };
    const addLabel = text => { const x = document.createElement('div'); x.className = 'nav-label'; x.textContent = text; el.appendChild(x); };
    let doneAll = 0;
    for (const w of VOCAB) if (state[w.id] && state[w.id].count > 0) doneAll++;
    addPage('home', '\ud83c\udfe0', '首页');
    addPage('today', '\u2705', '今日打卡');
    addPage('library', '\ud83d\udcda', '我的词库', doneAll + '/' + VOCAB.length);
    addPage('categories', '\ud83d\uddd2', '分类管理');
    addPage('desk', '\ud83c\udfaf', '表达取用台');
    addPage('review', '\ud83e\udde0', '复习训练');
    addPage('stats', '\ud83d\udcca', '学习统计');
    addLabel('其他工具');
    const addModTab = (id, icon, name) => {
      const b = document.createElement('button'); b.type = 'button'; b.className = 'tab';
      b.innerHTML = '<span class="t-ico">' + icon + '</span><span class="t-name">' + name + '</span>';
      b.title = name;
      b.addEventListener('click', () => { if (window.showMod) window.showMod(id); });
      el.appendChild(b);
    };
    addModTab('sleep', '\ud83c\udf19', '早睡'); addModTab('method', '\ud83d\udca1', '底层框架');
  }
  function switchModule(id) {
    document.querySelectorAll('.module').forEach(m => { m.hidden = m.id !== 'mod-' + id; });
    document.querySelectorAll('.btab').forEach(b => b.classList.toggle('active', b.dataset.mod === id));
    closeSidebar();
    if (id === 'writing') render();
  }
  // 统计口径：当前内容类型范围内的全部条目
  function scopeWords() {
    if (currentTab === 'library') return filters.type === 'all' ? VOCAB : VOCAB.filter(w => tabOf(w) === filters.type);
    if (TABS.some(t => t.id === currentTab)) return tabVocab(currentTab);
    return VOCAB;
  }
  // 五个分类维度统一成可点选的筛选行：表达功能 / 使用场景 / 词性 / 自定义标签 / 用途
  function renderUseFilter() {
    const cf = document.getElementById('catFilter'); if (!cf) return;
    cf.innerHTML = '';
    const scope = scopeWords();
    const addLine = (label, values, key, countOf) => {
      const line = document.createElement('div'); line.className = 'facet-line';
      const heading = document.createElement('span'); heading.className = 'facet-label'; heading.textContent = label;
      line.appendChild(heading);
      const mk = (value, text) => {
        const b = document.createElement('button'); b.type = 'button';
        b.className = 'chip' + (filters[key] === value ? ' active' : '');
        b.dataset.facet = key; b.dataset.value = value;
        b.textContent = text;
        b.addEventListener('click', () => { filters[key] = (filters[key] === value && value !== 'all') ? 'all' : value; render(); });
        line.appendChild(b);
      };
      mk('all', '全部');
      for (const v of values) {
        const n = countOf(v);
        if (n) mk(v, v + ' ' + n);
      }
      cf.appendChild(line);
    };
    addLine('表达功能', EXPRESSION_FUNCTIONS, 'role', v => scope.filter(w => functionsOf(w).indexOf(v) >= 0).length);
    addLine('使用场景', SCENE_VALUES, 'scene', v => scope.filter(w => scenesOf(w).indexOf(v) >= 0).length);
    addLine('词性', WORD_CLASSES, 'pos', v => scope.filter(w => posOf(w) === v).length);
    if (customTags.length) addLine('自定义标签', customTags, 'customTag', v => scope.filter(w => tagsForWord(w).indexOf(v) >= 0).length);
    addLine('用途', USES, 'use', v => scope.filter(w => (w.use || []).indexOf(v) >= 0).length);
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
    if (cf) cf.querySelectorAll('.chip').forEach(x => {
      if (x.dataset.facet) x.classList.toggle('active', x.dataset.value === filters[x.dataset.facet]);
    });
  }
  wireChips(document.getElementById('statusFilter'), 'f', 'status');
  wireChips(document.getElementById('masteryFilter'), 'm', 'mastery');
  wireChips(document.getElementById('tierFilter'), 't', 'tier');
  document.getElementById('search').addEventListener('input', e => {
    filters.q = e.target.value;
    if (filters.q.trim() && SCENE_TABS.includes(currentTab)) collapsedGroups.clear();
    render();
  });

  /* ---------- 展开/收起全部分类 ---------- */
  const toggleAllBtn = document.getElementById('toggleAll');
  if (toggleAllBtn) toggleAllBtn.addEventListener('click', () => {
    const gs = tabGroups(currentTab);
    if (!gs.length) return;
    const allCollapsed = gs.every(c => collapsedGroups.has(c));
    if (allCollapsed) gs.forEach(c => collapsedGroups.delete(c));
    else gs.forEach(c => collapsedGroups.add(c));
    render();
  });
  function updateToggleAll() {
    if (!toggleAllBtn) return;
    const gs = tabGroups(currentTab);
    toggleAllBtn.hidden = !gs.length;
    if (!gs.length) return;
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
  const APP_PAGES = ['home', 'library', 'desk', 'today', 'categories', 'review', 'stats'];
  // 旧版本把内容类型当页面（vocab/phr/…），统一迁移到「我的词库」+ 内容类型筛选
  if (TABS.some(t => t.id === currentTab)) { filters.type = currentTab; currentTab = 'library'; }
  if (APP_PAGES.indexOf(currentTab) < 0) currentTab = 'home';
  try { localStorage.setItem(LS_TAB, currentTab); } catch (e) {}
  document.querySelectorAll('.btab').forEach(b => b.addEventListener('click', () => switchModule(b.dataset.mod)));
  switchModule('writing');
  render();
  if (sbOn) {
    syncPull().then(() => syncPushAll())
      .then(syncDailyPull).then(migrateDailyFromState).then(syncDailyPushAll)
      .then(minePull).then(minePushAll)
      .then(render).catch(e => toast('云端同步失败：' + e.message));
  }
})();
