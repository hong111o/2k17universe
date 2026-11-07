// Team History tab (1946-47 onward) and Retired # tab: team pages, standings, records, chart
const { chromium, devices } = require(process.argv[2] + '/node_modules/playwright');
(async () => { const [,, pw, html, xlsm, out] = process.argv; const b = await chromium.launch(); const R = {};
  for (const [label, opts] of [['phone', { ...devices['iPhone 13'], colorScheme: 'dark' }], ['desk', { viewport: { width: 1360, height: 900 } }]]) {
    const ctx = await b.newContext(opts);
    await ctx.route(/cdnjs\.cloudflare\.com\/ajax\/libs\/xlsx/, r => r.fulfill({ path: pw + '/node_modules/xlsx/dist/xlsx.full.min.js', contentType: 'application/javascript' }));
    await ctx.route(/fonts\./, r => r.abort());
    const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
    await p.goto(/^https?:/.test(html) ? html : 'file://' + html); await p.setInputFiles('#fileInput', xlsm); await p.waitForSelector('#app', { state: 'visible', timeout: 120000 });
    const hasHistory = await p.evaluate(() => (DB.teamHistoryRows || []).length > 0);
    R[label + ' history rows'] = await p.evaluate(() => (DB.teamHistoryRows || []).length);
    await p.evaluate(() => openTeamModal('Boston Celtics')); await p.waitForTimeout(800);
    R[label + ' celtics hero'] = (await p.locator('.team-hero .bio-strip').innerText()).replace(/\s+/g, ' ');
    R[label + ' retired'] = (await p.locator('#teamPage .chart-card:has-text("Retired Numbers")').innerText()).replace(/\s+/g, ' ').slice(0, 160);
    R[label + ' chart points'] = await p.evaluate(() => winChartData && winChartData.seasons.length);
    await p.screenshot({ path: `${out}/hist-team-${label}.png`, fullPage: true });
    if (hasHistory) {
      await p.evaluate(() => openSeason(1950)); await p.waitForTimeout(500);
      R[label + ' 1950 standings'] = await p.evaluate(() => [...document.querySelectorAll('#sec-season .conf-title')].map(e => e.textContent).join(' | '));
      await p.screenshot({ path: `${out}/hist-1950-${label}.png`, fullPage: label === 'desk' });
      await p.evaluate(() => openTeamModal('Chicago Stags')); await p.waitForTimeout(400);
      R[label + ' defunct page'] = (await p.locator('#teamPage .ph-name').innerText()) + ' | ' + await p.evaluate(() => winChartData.seasons.length) + ' seasons';
      await p.evaluate(() => showSection('teams')); await p.waitForTimeout(200);
      R[label + ' defunct hidden from list'] = await p.locator('#teamGrid .team-name', { hasText: 'Chicago Stags' }).count() === 0;
      await p.evaluate(() => showSection('records')); await p.waitForTimeout(400);
      R[label + ' best record'] = (await p.locator('.rb-card:has-text("Best Records") .rb-row').first().innerText()).replace(/\s+/g, ' ');
    }
    R[label + ' overflow'] = await p.evaluate(() => document.documentElement.scrollWidth - innerWidth);
    R[label + ' errors'] = errs; await ctx.close(); }
  console.log(JSON.stringify(R, null, 1)); await b.close(); })();
