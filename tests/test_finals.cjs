// Finals page (head to head, upsets, matchups, rivalries) and the Finals card on player pages
const { chromium, devices } = require(process.argv[2] + '/node_modules/playwright');
(async () => { const [,, pw, html, xlsm, out] = process.argv; const b = await chromium.launch(); const r = {}; const bad = [];
  for (const [label, opts] of [['desk', { viewport: { width: 1400, height: 1000 } }], ['phone', { ...devices['iPhone 13'] }]]) {
    const ctx = await b.newContext(opts);
    await ctx.route(/cdnjs\.cloudflare\.com\/ajax\/libs\/xlsx/, r => r.fulfill({ path: pw + '/node_modules/xlsx/dist/xlsx.full.min.js', contentType: 'application/javascript' }));
    await ctx.route(/fonts\./, r => r.abort());
    const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
    await p.goto('file://' + html); await p.setInputFiles('#fileInput', xlsm); await p.waitForSelector('#app', { state: 'visible', timeout: 60000 });
    await p.evaluate(() => showSection('finals')); await p.waitForTimeout(400);
    r[`${label} page`] = await p.evaluate(() => ({ finals: finalsData().length, cards: document.querySelectorAll('.fx-card').length, tiles: document.querySelectorAll('#finalsContent .stat-card').length }));
    if (!r[`${label} page`].cards) bad.push(label + ' no cards');
    await p.evaluate(() => setFinalsFilter('upsets')); await p.waitForTimeout(200);
    r[`${label} upsets shown`] = await p.evaluate(() => [...document.querySelectorAll('.fx-card')].every(c => c.classList.contains('fx-upset')));
    if (!r[`${label} upsets shown`]) bad.push(label + ' upset filter');
    await p.screenshot({ path: `${out}/finals-${label}.png` });
    // A player with Finals gets the card
    const who = await p.evaluate(() => finalsData().flatMap(f => f.cs).find(s => s.p)?.p.Player);
    if (who) { await p.evaluate(n => openPlayerModal(n), who); await p.waitForTimeout(300); r[`${label} player card`] = await p.evaluate(() => !!document.querySelector('.pf-list')); if (!r[`${label} player card`]) bad.push(label + ' player card'); }
    r[`${label} overflow`] = await p.evaluate(() => document.documentElement.scrollWidth - innerWidth);
    r[`${label} errors`] = errs; await ctx.close(); }
  console.log(JSON.stringify(r, null, 1)); await b.close(); if (bad.length) { console.error('failed', bad); process.exit(1); } })();
