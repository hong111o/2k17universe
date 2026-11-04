const { chromium, devices } = require(process.argv[2] + '/node_modules/playwright');
(async () => {
  const [,, pw, html, xlsm, out] = process.argv;
  const b = await chromium.launch();
  const r = {};
  const ctx = await b.newContext({ viewport: { width: 1400, height: 1000 } });
  await ctx.route(/cdnjs\.cloudflare\.com\/ajax\/libs\/xlsx/, r => r.fulfill({ path: pw + '/node_modules/xlsx/dist/xlsx.full.min.js', contentType: 'application/javascript' }));
  await ctx.route(/fonts\./, r => r.abort());
  const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto('file://' + html); await p.setInputFiles('#fileInput', xlsm);
  await p.waitForSelector('#app', { state: 'visible', timeout: 60000 });
  const shot = async (name, full) => { await p.waitForTimeout(350); await p.mouse.move(0, 0); await p.screenshot({ path: `${out}/n-${name}.png`, fullPage: !!full }); };
  // Compare
  await p.evaluate(() => compareWith('Michael Jordan', 'LeBron James')); await p.evaluate(() => cmpSelect(3, 'Kobe Bryant')); await p.evaluate(() => renderCompare());
  r.board = (await p.locator('.cmp-board').innerText()).replace(/\s+/g, ' ');
  await shot('compare', true);
  await p.click('#cmpModeBtn'); await p.click('#cmpModeBtn');
  r.per36 = (await p.locator('.cmp-table tbody tr').nth(1).innerText()).replace(/\s+/g, ' ');
  // Draft
  await p.evaluate(() => showSection('draft'));
  r.draftCards = (await p.locator('#draftContent .stats-cards').innerText()).replace(/\s+/g, ' ');
  r.draftClass = (await p.locator('.draft-class').innerText()).replace(/\s+/g, ' ').slice(0, 200);
  r.allPicks = await p.locator('#draftContent .table-wrap tbody tr').count();
  await shot('draft');
  // Legacy
  await p.evaluate(() => showSection('legacy'));
  r.legacyRows = await p.locator('#legacyContent tbody tr').count();
  r.legacyTop = (await p.locator('#legacyContent tbody tr').first().innerText()).replace(/\s+/g, ' ');
  await shot('legacy');
  // Legends
  await p.evaluate(() => openTeamModal('Los Angeles Lakers'));
  r.legends = (await p.locator('#teamPage .modal-section:has-text("Franchise Legends") .leader-list').innerText()).replace(/\s+/g, ' ').slice(0, 400);
  await p.locator('#teamPage .modal-section:has-text("Franchise Legends")').screenshot({ path: `${out}/n-legends.png` });
  await p.keyboard.press('Escape');
  // Settings / data check
  r.dot = await p.evaluate(() => !document.getElementById('dcDot').hidden);
  await p.click('#settingsBtn');
  r.dcSummary = (await p.locator('.dc-summary').innerText()).replace(/\s+/g, ' ');
  r.dcErrors = await p.evaluate(() => dataCheckResults.filter(x => x.level === 'error').map(x => `${x.sheet}!${x.cell}: ${x.msg}`));
  await shot('settings');
  // weight change reorders legacy
  await p.fill('#w-mvp', '30'); await p.dispatchEvent('#w-mvp', 'change');
  r.legacyTopMvp30 = await p.evaluate(() => legacyRanking().slice(0, 3).map(x => x.p.Player).join(', '));
  await p.click('text=Reset to defaults');
  r.legacyTopReset = await p.evaluate(() => legacyRanking().slice(0, 3).map(x => x.p.Player).join(', '));
  r.errors = errs;
  console.log(JSON.stringify(r, null, 1));
  // phone screenshots
  const ph = await b.newContext({ ...devices['iPhone 13'] });
  await ph.route(/cdnjs\.cloudflare\.com\/ajax\/libs\/xlsx/, r => r.fulfill({ path: pw + '/node_modules/xlsx/dist/xlsx.full.min.js', contentType: 'application/javascript' }));
  await ph.route(/fonts\./, r => r.abort());
  const q = await ph.newPage(); const perrs = []; q.on('pageerror', e => perrs.push(e.message));
  await q.goto('file://' + html); await q.setInputFiles('#fileInput', xlsm); await q.waitForSelector('#app', { state: 'visible', timeout: 60000 });
  for (const [name, fn] of [['player', () => openPlayerModal('Michael Jordan')], ['compare', () => { compareWith('Michael Jordan', 'LeBron James'); }], ['draft', () => showSection('draft')], ['legacy', () => showSection('legacy')], ['settings', () => showSection('settings')]]) {
    await q.evaluate(fn); await q.waitForTimeout(350);
    const over = await q.evaluate(() => document.documentElement.scrollWidth - innerWidth);
    console.log('phone', name, 'sideways overflow', over);
    await q.screenshot({ path: `${out}/n-phone-${name}.png` });
  }
  console.log('phone mast', await q.evaluate(() => { const m = document.querySelector('.masthead-inner'); return m.scrollWidth + ' / ' + m.clientWidth; }), 'errors', perrs);
  await b.close();
})();
