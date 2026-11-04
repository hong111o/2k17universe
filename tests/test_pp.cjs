const { chromium, devices } = require(process.argv[2] + '/node_modules/playwright');
(async () => {
  const [,, pw, html, xlsm, out] = process.argv;
  const b = await chromium.launch();
  const r = {};
  for (const [label, opts] of [['desk', { viewport: { width: 1400, height: 1000 } }], ['phone', { ...devices['iPhone 13'] }]]) {
    const ctx = await b.newContext(opts);
    await ctx.route(/cdnjs\.cloudflare\.com\/ajax\/libs\/xlsx/, r => r.fulfill({ path: pw + '/node_modules/xlsx/dist/xlsx.full.min.js', contentType: 'application/javascript' }));
    await ctx.route(/fonts\./, r => r.abort());
    const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
    await p.goto('file://' + html); await p.setInputFiles('#fileInput', xlsm);
    await p.waitForSelector('#app', { state: 'visible', timeout: 60000 });
    await p.evaluate(() => showSection('players')); await p.waitForTimeout(200);
    // open via a real link click from the table / card
    if (label === 'desk') { await p.fill('#playerSearch', 'LeBron'); await p.waitForTimeout(200); await p.locator('#playersBody .player-link', { hasText: 'LeBron James' }).first().click(); }
    else { await p.fill('#playerSearch', 'LeBron'); await p.waitForTimeout(200); await p.locator('#playersCards .pcard').first().tap(); }
    await p.waitForTimeout(400);
    r[label + 'Hash'] = await p.evaluate(() => location.hash);
    r[label + 'Hero'] = (await p.locator('.player-hero').innerText()).replace(/\s+/g, ' ').slice(0, 260);
    await p.screenshot({ path: `${out}/pp-${label}-top.png` });
    await p.screenshot({ path: `${out}/pp-${label}-full.png`, fullPage: true });
    await p.evaluate(() => setPctPool('pos')); await p.waitForTimeout(100);
    r[label + 'PosPct'] = (await p.locator('.pct-list').innerText()).replace(/\s+/g, ' ').slice(0, 120);
    // back goes to the list
    await p.click('.hero-back'); await p.waitForTimeout(300);
    r[label + 'AfterBack'] = await p.evaluate(() => location.hash + ' ' + document.querySelector('.section.active').id);
    // search
    if (label === 'desk') { await p.keyboard.press('/'); } else { await p.locator('.mast-icon').first().tap(); }
    await p.fill('#globalSearch', 'dean'); await p.waitForTimeout(150);
    r[label + 'Search'] = (await p.locator('#searchResults').innerText()).replace(/\s+/g, ' ').slice(0, 160);
    await p.screenshot({ path: `${out}/pp-${label}-search.png` });
    await p.keyboard.press('Enter'); await p.waitForTimeout(400);
    r[label + 'ActivePage'] = (await p.locator('.player-hero').innerText()).replace(/\s+/g, ' ').slice(0, 200);
    await p.screenshot({ path: `${out}/pp-${label}-active.png`, fullPage: true });
    r[label + 'HScroll'] = await p.evaluate(() => document.documentElement.scrollWidth - innerWidth);
    r[label + 'Errors'] = errs;
    await ctx.close();
  }
  console.log(JSON.stringify(r, null, 1));
  await b.close();
})();
