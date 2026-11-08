// ROTY from NBA History: League History column/cards, Awards tab with teams, shared awards split
const { chromium, devices } = require(process.argv[2] + '/node_modules/playwright');
(async () => { const [,, pw, html, xlsm, out] = process.argv; const b = await chromium.launch(); const r = {}; let bad = [];
  for (const [label, opts] of [['desk', { viewport: { width: 1400, height: 1000 } }], ['phone', { ...devices['iPhone 13'] }]]) {
    const ctx = await b.newContext(opts);
    await ctx.route(/cdnjs\.cloudflare\.com\/ajax\/libs\/xlsx/, r => r.fulfill({ path: pw + '/node_modules/xlsx/dist/xlsx.full.min.js', contentType: 'application/javascript' }));
    await ctx.route(/fonts\./, r => r.abort());
    const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
    await p.goto('file://' + html); await p.setInputFiles('#fileInput', xlsm); await p.waitForSelector('#app', { state: 'visible', timeout: 60000 });
    const hasCol = await p.evaluate(() => DB.historyCols && DB.historyCols.ROTY !== undefined);
    await p.evaluate(() => showSection('history')); await p.waitForTimeout(400);
    const seen = await p.evaluate(() => ({ th: [...document.querySelectorAll('#histBody')].length && [...document.querySelectorAll('th')].some(t => t.textContent.trim() === 'ROTY'),
      cards: [...document.querySelectorAll('#histCards .hc-award span')].filter(s => s.textContent === 'ROTY').length }));
    r[`${label} history`] = seen;
    await p.screenshot({ path: `${out}/roty-history-${label}.png` });
    await p.evaluate(() => { showSection('awards'); setAwardTab('ROY'); }); await p.waitForTimeout(400);
    const aw = await p.evaluate(() => ({ rows: document.querySelectorAll('#awardsContent tbody tr').length, logos: document.querySelectorAll('#awardsContent tbody td.nowrap .player-link, #awardsContent tbody td.nowrap a, #awardsContent tbody td.nowrap span').length,
      byTeam: !!document.querySelector('#awardsContent .rb-card'), shared: DB.history.filter(h => / \/ /.test(h.ROTY || '')).every(h => !h.ROTYTeam) }));
    r[`${label} awards`] = aw;
    await p.screenshot({ path: `${out}/roty-awards-${label}.png` });
    if (hasCol && (!seen.th || !aw.rows || !aw.byTeam || !aw.shared)) bad.push(label);
    r[`${label} overflow`] = await p.evaluate(() => document.documentElement.scrollWidth - innerWidth);
    r[`${label} errors`] = errs; await ctx.close(); }
  console.log(JSON.stringify(r, null, 1)); await b.close(); if (bad.length) { console.error('ROTY missing on', bad); process.exit(1); } })();
