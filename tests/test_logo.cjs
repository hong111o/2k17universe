const { chromium, devices } = require(process.argv[2] + '/node_modules/playwright');
(async () => { const [,, pw, html, xlsm, out] = process.argv; const b = await chromium.launch(); const R = {};
  for (const [label, opts] of [['desk', { viewport: { width: 1360, height: 900 } }], ['phone', { ...devices['iPhone 13'], colorScheme: 'dark' }]]) {
    const ctx = await b.newContext(opts);
    await ctx.route(/cdnjs\.cloudflare\.com\/ajax\/libs\/xlsx/, r => r.fulfill({ path: pw + '/node_modules/xlsx/dist/xlsx.full.min.js', contentType: 'application/javascript' }));
    await ctx.route(/fonts\./, r => r.abort());
    const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
    await p.goto('file://' + html); await p.setInputFiles('#fileInput', xlsm); await p.waitForSelector('#app', { state: 'visible', timeout: 60000 });
    await p.waitForTimeout(800);
    R[label + ' logos'] = await p.evaluate(() => { const have = Object.keys(DB.logos); return { n: have.length, missing: DB.teams.map(t => t.Team).filter(t => !DB.logos[t]) }; });
    R[label + ' broken'] = await p.evaluate(() => [...document.querySelectorAll('img.tlogo')].filter(i => i.complete && !i.naturalWidth).length);
    await p.locator('.home-hero').screenshot({ path: `${out}/logo-hero-${label}.png` });
    await p.waitForTimeout(2500); R[label + ' unloaded'] = await p.evaluate(() => [...document.querySelectorAll('img.tlogo')].filter(i => !i.complete || !i.naturalWidth).length);
    await p.locator('.home-grid .chart-card').first().screenshot({ path: `${out}/logo-stand-${label}.png` });
    await p.evaluate(() => showSection('teams')); await p.waitForTimeout(500);
    await p.screenshot({ path: `${out}/logo-teams-${label}.png` });
    await p.evaluate(() => openTeamModal('Brooklyn Nets')); await p.waitForTimeout(500);
    await p.locator('.team-hero').screenshot({ path: `${out}/logo-teamhero-${label}.png` });
    R[label + ' overflow'] = await p.evaluate(() => document.documentElement.scrollWidth - innerWidth);
    R[label + ' errors'] = errs; await ctx.close(); }
  console.log(JSON.stringify(R, null, 1)); await b.close(); })();
