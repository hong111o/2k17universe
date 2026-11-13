// v74: team season card and Franchise Stats, Compare fingerprint, Closest Match, header theme button,
// NBA logos with the workbook logo (background removed) as fallback
const { chromium, devices } = require(process.argv[2] + '/node_modules/playwright');
(async () => { const [,, pw, html, xlsm, out] = process.argv; const b = await chromium.launch(); const r = {}; const bad = [];
  for (const [label, opts] of [['desk', { viewport: { width: 1400, height: 1000 } }], ['phone', { ...devices['iPhone 13'] }]]) {
    const ctx = await b.newContext(opts);
    await ctx.route(/cdnjs\.cloudflare\.com\/ajax\/libs\/xlsx/, r => r.fulfill({ path: pw + '/node_modules/xlsx/dist/xlsx.full.min.js', contentType: 'application/javascript' }));
    await ctx.route(/fonts\.|cdn\.nba\.com/, r => r.abort());
    const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
    await p.goto('file://' + html); await p.setInputFiles('#fileInput', xlsm); await p.waitForSelector('#app', { state: 'visible', timeout: 60000 });
    await p.evaluate(() => openTeamModal(DB.teams.find(t => !t.defunct && t.seasonRecords?.[DB.latestSeason]).Team)); await p.waitForTimeout(500);
    r[`${label} team`] = await p.evaluate(() => ({ season: !!document.querySelector('.ts-card .ts-rec'), tiles: document.querySelectorAll('.fs-tile').length, logos: document.querySelectorAll('#teamPage img.tlogo').length }));
    if (!r[`${label} team`].season || r[`${label} team`].tiles < 6 || !r[`${label} team`].logos) bad.push(label + ' team');
    await p.evaluate(() => { showSection('compare'); const ps = careerPlayers().slice(0, 2); cmpPlayers[1] = ps[0]; cmpPlayers[2] = ps[1]; cmpPlayers[3] = null; renderCompare(); }); await p.waitForTimeout(300);
    r[`${label} fingerprint rows`] = await p.evaluate(() => document.querySelectorAll('#cmpResult .fp-row').length);
    if (!r[`${label} fingerprint rows`]) bad.push(label + ' fingerprint');
    const before = await p.evaluate(() => document.documentElement.getAttribute('data-theme'));
    await p.click('#themeBtn'); r[`${label} theme toggled`] = (await p.evaluate(() => document.documentElement.getAttribute('data-theme'))) !== before;
    if (!r[`${label} theme toggled`]) bad.push(label + ' theme');
    await p.evaluate(() => setTheme('system'));
    r[`${label} overflow`] = await p.evaluate(() => document.documentElement.scrollWidth - innerWidth);
    r[`${label} errors`] = errs; await ctx.close(); }
  console.log(JSON.stringify(r, null, 1)); await b.close(); if (bad.length) { console.error('failed', bad); process.exit(1); } })();
