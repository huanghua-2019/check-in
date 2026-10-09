// 真机截图：用 playwright-core 驱动本机 Edge，走手机视口
const { chromium } = require('playwright-core');
const path = require('path');

const URL = 'file:///' + path.resolve('D:/我的GitHub/check-in/index.html').replace(/\\/g, '/');
const OUT = 'D:/我的GitHub/check-in/build/shots';

(async () => {
  const browser = await chromium.launch({ channel: 'msedge' });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
  const errs = [];
  page.on('pageerror', e => errs.push('pageerror: ' + e.message));
  page.on('console', m => { if (m.type() === 'error' && !/offline-test|Failed to fetch|supabase/.test(m.text())) errs.push('console: ' + m.text()); });
  await page.goto(URL, { waitUntil: 'load' });
  await page.waitForTimeout(700);

  const shot = async (name, full) => {
    await page.screenshot({ path: `${OUT}/${name}.png`, fullPage: !!full });
    console.log('shot', name);
  };

  // 首页
  await shot('01-home-top');
  await page.evaluate(() => window.scrollTo(0, 900));
  await page.waitForTimeout(300);
  await shot('02-home-mid');
  await page.evaluate(() => window.scrollTo(0, 99999));
  await page.waitForTimeout(300);
  await shot('03-home-bottom');

  const tab = async label => {
    await page.evaluate(l => {
      const b = [...document.querySelectorAll('#tabs .tab')].find(x => x.querySelector('.t-name') && x.querySelector('.t-name').textContent === l);
      if (b) b.click();
    }, label);
    await page.waitForTimeout(400);
  };
  const menu = async () => {
    await page.evaluate(() => { document.body.classList.add('sb-open'); });
    await page.waitForTimeout(350);
  };

  await page.evaluate(() => window.scrollTo(0, 0));
  await menu();
  await shot('04-sidebar');
  await page.evaluate(() => document.body.classList.remove('sb-open'));

  // 词汇：展开全部 + 展开一张卡
  await tab('词汇');
  await page.evaluate(() => document.getElementById('toggleAll').click());
  await page.waitForTimeout(400);
  await shot('05-vocab-groups');
  await page.evaluate(() => {
    const c = document.querySelector('#list .word');
    if (c) { c.querySelector('.tap').click(); c.scrollIntoView({ block: 'center' }); }
  });
  await page.waitForTimeout(400);
  await shot('06-vocab-detail');

  // 比喻 tab（word 归位效果最直观）
  await tab('比喻');
  await page.evaluate(() => {
    const h = [...document.querySelectorAll('#list .cat-head')].find(x => /警示风险/.test(x.textContent));
    if (h) h.click();
  });
  await page.waitForTimeout(400);
  await shot('07-met-list');
  await page.evaluate(() => {
    const g = [...document.querySelectorAll('#list .cat')].find(x => !x.classList.contains('collapsed'));
    const c = g && g.querySelector('.word');
    if (c) { c.querySelector('.tap').click(); c.scrollIntoView({ block: 'center' }); }
  });
  await page.waitForTimeout(400);
  await shot('08-met-detail');

  // 辨析
  await tab('辨析');
  await page.evaluate(() => {
    const h = [...document.querySelectorAll('#list .cat-head')].find(x => /立论判断/.test(x.textContent));
    if (h) h.click();
  });
  await page.waitForTimeout(400);
  await page.evaluate(() => {
    const g = [...document.querySelectorAll('#list .cat')].find(x => !x.classList.contains('collapsed'));
    const c = g && g.querySelector('.word');
    if (c) { c.querySelector('.tap').click(); c.scrollIntoView({ block: 'start' }); }
  });
  await page.waitForTimeout(400);
  await shot('09-diff-detail');

  // 取用台
  await tab('取用台');
  await page.waitForTimeout(400);
  await shot('10-desk');
  await page.evaluate(() => {
    const i = document.querySelector('.desk-search');
    i.value = '护城河';
    i.dispatchEvent(new Event('input', { bubbles: true }));
    window.scrollTo(0, 380);
  });
  await page.waitForTimeout(400);
  await shot('11-desk-search');

  // 桌面视口
  const page2 = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  await page2.goto(URL, { waitUntil: 'load' });
  await page2.waitForTimeout(700);
  await page2.screenshot({ path: `${OUT}/12-desktop-home.png` });
  await page2.evaluate(() => {
    const b = [...document.querySelectorAll('#tabs .tab')].find(x => x.querySelector('.t-name') && x.querySelector('.t-name').textContent === '取用台');
    if (b) b.click();
  });
  await page2.waitForTimeout(500);
  await page2.screenshot({ path: `${OUT}/13-desktop-desk.png` });
  console.log('shots done');

  if (errs.length) { console.log('!! 页面错误'); errs.slice(0, 10).forEach(e => console.log('  ' + e)); }
  else console.log('页面错误：0');
  await browser.close();
})();
