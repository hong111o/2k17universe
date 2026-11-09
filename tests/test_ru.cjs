// Runner-Up Stars: read from NBA History, shown in League History and Season Hub, scored in the legacy formula
const { chromium, devices } = require(process.argv[2] + '/node_modules/playwright');
(async () => { const [,, pw, html, xlsm, out] = process.argv; const b = await chromium.launch(); const r = {}; const bad = [];
  for (const [label, opts] of [['desk', { viewport: { width: 1400, height: 1000 } }], ['phone', { ...devices['iPhone 13'] }]]) {
    const ctx = await b.newContext(opts);
    await ctx.route(/cdnjs\.cloudflare\.com\/ajax\/libs\/xlsx/, r => r.fulfill({ path: pw + '/node_modules/xlsx/dist/xlsx.full.min.js', contentType: 'application/javascript' }));
    await ctx.route(/fonts\./, r => r.abort());
    const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
    await p.goto('file://' + html); await p.setInputFiles('#fileInput', xlsm); await p.waitForSelector('#app', { state: 'visible', timeout: 60000 });
    const has = await p.evaluate(() => (DB.historyRuCols || []).length > 0);
    // Misspelt names must not jump to a different surname
    r[`${label} Oakley`] = await p.evaluate(() => resolvePlayer('Charles Oakley', 1994)?.Player || null);
    if (r[`${label} Oakley`] === 'Charles Barkley') bad.push(label + ' Oakley');
    if (has) {
      await p.evaluate(() => showSection('history')); await p.waitForTimeout(300);
      r[`${label} history`] = await p.evaluate(() => ({ cards: document.querySelectorAll('#histCards .hc-ru').length, col: !!document.querySelector('.hist-ru-h') }));
      await p.screenshot({ path: `${out}/ru-history-${label}.png` });
      const yr = await p.evaluate(() => Number(DB.history.find(h => h.RU1).Season));
      await p.evaluate(y => openSeason ? openSeason(y) : null, yr).catch(() => {});
      r[`${label} legacy finals part`] = await p.evaluate(() => Object.values(legacyContext().ruRoles).flat().length);
      if (!r[`${label} history`].cards || !r[`${label} legacy finals part`]) bad.push(label + ' runner-up');
    }
    r[`${label} overflow`] = await p.evaluate(() => document.documentElement.scrollWidth - innerWidth);
    r[`${label} errors`] = errs; await ctx.close(); }
  console.log(JSON.stringify(r, null, 1)); await b.close(); if (bad.length) { console.error('failed', bad); process.exit(1); } })();
