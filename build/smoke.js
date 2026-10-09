// 冒烟测试：用 jsdom 真跑一遍 index.html，抓运行时错误 + 校验关键渲染
const fs = require('fs');
const path = require('path');
const { JSDOM, VirtualConsole } = require('jsdom');

const DIR = 'D:/我的GitHub/check-in';
const errors = [];
const vc = new VirtualConsole();
vc.on('jsdomError', e => errors.push('jsdomError: ' + (e.stack || e.message)));
vc.on('error', (...a) => errors.push('console.error: ' + a.join(' ')));

const rawHtml = fs.readFileSync(path.join(DIR, 'index.html'), 'utf8');
// 把外链脚本内联，避免 jsdom 的网络加载（离线可靠）
const html = rawHtml.replace(/<script src="([^"?]+)(\?[^"]*)?"><\/script>/g, (m, f) => {
  const code = fs.readFileSync(path.join(DIR, f), 'utf8');
  return '<script>' + code.replace(/<\/script>/g, '<\\/script>') + '</script>';
});
const dom = new JSDOM(html, {
  runScripts: 'dangerously',
  url: 'https://example.test/',
  virtualConsole: vc,
  pretendToBeVisual: true,
  beforeParse(win) {
    win.fetch = () => Promise.reject(new Error('offline-test'));
    win.confirm = () => true;
    win.navigator.vibrate = () => {};
  },
});
const win = dom.window;

function done() {
  const doc = win.document;
  const out = [];
  const ok = (label, cond, extra) => out.push((cond ? '  ✓ ' : '  ✗ ') + label + (extra ? ' — ' + extra : ''));

  const tabs = [...doc.querySelectorAll('#tabs .tab .t-name')].map(e => e.textContent);
  ok('侧栏条目数 ' + tabs.length, tabs.length === 10, tabs.join('/'));
  ok('含取用台', tabs.includes('取用台'));
  ok('含辨析', tabs.includes('辨析'));

  const dashH = [...doc.querySelectorAll('.dash-h')].map(e => e.textContent.replace(/\s+/g, ' ').trim());
  ok('首页区块: ' + dashH.join(' | '), dashH.some(x => x.includes('今日 5 条')) && dashH.some(x => x.includes('使用盲区')) && dashH.some(x => x.includes('我的表达')));
  ok('今日5条有内容', doc.querySelectorAll('.today-row').length > 0, doc.querySelectorAll('.today-row').length + ' 行');
  ok('盲区有内容', doc.querySelectorAll('.blind-row').length > 0, doc.querySelectorAll('.blind-row').length + ' 行');

  // 点「词汇」
  const vocabBtn = [...doc.querySelectorAll('#tabs .tab')].find(b => b.querySelector('.t-name') && b.querySelector('.t-name').textContent === '词汇');
  vocabBtn.dispatchEvent(new win.MouseEvent('click', { bubbles: true }));
  const groups = [...doc.querySelectorAll('#list .cat-head .name')].map(e => e.textContent);
  ok('词汇按用途分组 ' + groups.length + ' 组', groups.length > 3, groups.slice(0, 6).join(' / '));
  ok('分组名是用途(带emoji)', groups.every(g => /\p{Emoji}/u.test(g)));

  // 展开全部 → 卡片出现
  doc.getElementById('toggleAll').dispatchEvent(new win.MouseEvent('click', { bubbles: true }));
  const cards = doc.querySelectorAll('#list .word');
  ok('卡片渲染 ' + cards.length + ' 张', cards.length > 100);

  // 展开第一张卡看详情
  const tap = cards[0].querySelector('.tap');
  tap.dispatchEvent(new win.MouseEvent('click', { bubbles: true }));
  const labels = [...doc.querySelectorAll('#list .detail .label')].map(e => e.textContent);
  ok('详情字段名: ' + labels.join('/'), labels.length >= 5);
  ok('有复制按钮', doc.querySelectorAll('.act-row .act').length === 2);
  ok('有我的例句框', !!doc.querySelector('.mine-box textarea'));

  // 搜索反查
  const search = doc.getElementById('search');
  search.value = '护城河';
  search.dispatchEvent(new win.Event('input', { bubbles: true }));
  const n1 = doc.querySelectorAll('#list .word').length;
  ok('搜索"护城河"命中 ' + n1 + ' 条', n1 > 0 && n1 < 200);

  // 用途 chip
  search.value = '';
  search.dispatchEvent(new win.Event('input', { bubbles: true }));
  const chips = [...doc.querySelectorAll('#catFilter .chip')];
  ok('用途筛选 chip ' + chips.length + ' 个', chips.length > 3, chips.slice(0, 4).map(c => c.textContent).join(' '));
  chips[1].dispatchEvent(new win.MouseEvent('click', { bubbles: true }));
  ok('按用途筛选后有结果', doc.querySelectorAll('#list .word').length > 0);

  // 分级 chip
  const tierChips = [...doc.querySelectorAll('#tierFilter .chip')];
  ok('分级 chip 4 个', tierChips.length === 4);
  tierChips[1].dispatchEvent(new win.MouseEvent('click', { bubbles: true }));
  const tierN = doc.querySelectorAll('#list .word').length;
  ok('筛核心后有结果 ' + tierN, tierN > 0);
  tierChips[0].dispatchEvent(new win.MouseEvent('click', { bubbles: true }));

  // 取用台
  const deskBtn = [...doc.querySelectorAll('#tabs .tab')].find(b => b.querySelector('.t-name') && b.querySelector('.t-name').textContent === '取用台');
  deskBtn.dispatchEvent(new win.MouseEvent('click', { bubbles: true }));
  ok('取用台搜索框', !!doc.querySelector('.desk-search'));
  ok('取用台主题 chip', doc.querySelectorAll('.desk-head .chip').length > 15, doc.querySelectorAll('.desk-head .chip').length + ' 个');
  const dIn = doc.querySelector('.desk-search');
  dIn.value = '护城河';
  dIn.dispatchEvent(new win.Event('input', { bubbles: true }));
  const rows = doc.querySelectorAll('.desk-row');
  ok('取用台搜"护城河"跨类命中 ' + rows.length + ' 条', rows.length > 0);
  const grp = [...doc.querySelectorAll('.dg-head')].map(e => e.textContent.replace(/\s+/g, ''));
  ok('取用台按形式分组: ' + grp.join(' '), grp.length >= 1);

  // 主题包
  const topicChip = [...doc.querySelectorAll('.desk-head .chip')].find(c => c.textContent.includes('估值与安全边际'));
  dIn.value = ''; dIn.dispatchEvent(new win.Event('input', { bubbles: true }));
  topicChip.dispatchEvent(new win.MouseEvent('click', { bubbles: true }));
  ok('主题包命中 ' + doc.querySelectorAll('.desk-row').length + ' 条', doc.querySelectorAll('.desk-row').length > 0);

  // 辨析 tab
  const diffBtn = [...doc.querySelectorAll('#tabs .tab')].find(b => b.querySelector('.t-name') && b.querySelector('.t-name').textContent === '辨析');
  diffBtn.dispatchEvent(new win.MouseEvent('click', { bubbles: true }));
  ok('辨析 tab 有卡片 ' + doc.querySelectorAll('#list .word').length, doc.querySelectorAll('#list .word').length > 0);

  console.log(out.join('\n'));
  const fails = out.filter(l => l.startsWith('  ✗'));
  console.log('\n通过 ' + (out.length - fails.length) + '/' + out.length);
  if (errors.length) { console.log('\n!! 运行时错误 ' + errors.length + ':'); errors.slice(0, 8).forEach(e => console.log('   ' + e.slice(0, 400))); }
  else console.log('运行时错误：0');
  process.exit(fails.length || errors.length ? 1 : 0);
}

win.addEventListener('load', () => setTimeout(done, 300));
setTimeout(() => { if (!win.__done) done(); }, 4000);
