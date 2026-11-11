// v71: Turnarounds and Heartbreak in the Record Book, team Trophy Cabinet, Ring of Honor
const { chromium, devices } = require(process.argv[2] + '/node_modules/playwright');
(async () => { const [,, pw, html, xlsm, out] = process.argv; const b = await chromium.launch(); const r = {}; const bad = [];
  for (const [label, opts] of [['desk', { viewport: { width: 1400, height: 1000 } }], ['phone', { ...devices['iPhone 13'] }]]) {
    const ctx = await b.newContext(opts);
    await ctx.route(/cdnjs\.cloudflare\.com\/ajax\/libs\/xlsx/, r => r.fulfill({ path: pw + '/node_modules/xlsx/dist/xlsx.full.min.js', contentType: 'application/javascript' }));
    await ctx.route(/fonts\./, r => r.abort());
    const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
    await p.goto('file://' + html); await p.setInputFiles('#fileInput', xlsm); await p.waitForSelector('#app', { state: 'visible', timeout: 60000 });
    await p.evaluate(() => showSection('records')); await p.waitForTimeout(300);
    r[`${label} record sections`] = await p.evaluate(() => ['#rb-turnarounds', '#rb-heartbreak'].map(s => document.querySelectorAll(s + ' .rb-row').length));
    if (r[`${label} record sections`].some(n => !n)) bad.push(label + ' records');
    await p.evaluate(() => openTeamModal(DB.teams.find(t => !t.defunct && Number(t.Championship) > 0).Team)); await p.waitForTimeout(400);
    r[`${label} cabinet`] = await p.evaluate(() => !!document.querySelector('.tc-card .tc-tile'));
    if (!r[`${label} cabinet`]) bad.push(label + ' cabinet');
    await p.evaluate(() => showSection('ring')); await p.waitForTimeout(300);
    r[`${label} ring`] = await p.evaluate(() => document.querySelectorAll('.ring-item').length);
    if (!r[`${label} ring`]) bad.push(label + ' ring');
    await p.screenshot({ path: `${out}/ring-${label}.png` });
    r[`${label} overflow`] = await p.evaluate(() => document.documentElement.scrollWidth - innerWidth);
    r[`${label} errors`] = errs; await ctx.close(); }
  console.log(JSON.stringify(r, null, 1)); await b.close(); if (bad.length) { console.error('failed', bad); process.exit(1); } })();
