const { chromium, devices } = require(process.argv[2] + '/node_modules/playwright');
(async () => { const [,, pw, url, xlsm, out] = process.argv; const b = await chromium.launch(); const R = {};
  for (const [label, opts] of [['desk', { viewport: { width: 1360, height: 900 }, deviceScaleFactor: 1 }], ['phone', { ...devices['iPhone 13'], colorScheme: 'dark' }]]) {
    const ctx = await b.newContext({ ...opts, serviceWorkers: 'block' });
    await ctx.route(/cdnjs\.cloudflare\.com\/ajax\/libs\/xlsx/, r => r.fulfill({ path: pw + '/node_modules/xlsx/dist/xlsx.full.min.js', contentType: 'application/javascript' }));
    await ctx.route(/fonts\./, r => r.abort());
    const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('console', m => { if (m.type() === 'warning' || m.type() === 'error') errs.push('console: ' + m.text()); });
    await p.goto(url); await p.setInputFiles('#fileInput', xlsm); await p.waitForSelector('#app', { state: 'visible', timeout: 60000 });
    await p.waitForTimeout(500);
    // Simulate an older previous workbook, then reload so the recap appears
    await p.evaluate(() => {
      const s = JSON.parse(localStorage.getItem('nba2k17-snapshot'));
      s.seasons = s.seasons.filter(y => y !== Math.max(...s.seasons)); s.sig = 1; s.file = '2K17 (last season).xlsm'; s.at = Date.now() - 86400000 * 30;
      const pd = s.players['Patrick Dean']; if (pd) { pd.r.MVP = 6; pd.L = 40; }
      if (s.players['Danny Norton']) s.players['Danny Norton'].L = 30;
      ['Kris Worthy', 'Gheorghe Eminescu'].forEach(n => { if (s.players[n]) { s.players[n].a = 1; s.players[n].r = {}; } });
      
      localStorage.setItem('nba2k17-snapshot', JSON.stringify(s)); localStorage.removeItem('nba2k17-recap');
    });
    await p.evaluate(() => { location.hash = '#overview'; }); await p.reload(); await p.waitForSelector('#app', { state: 'visible', timeout: 60000 }); await p.waitForTimeout(800);
    R[label + ' recap'] = (await p.locator('#recapCard').innerText().catch(() => 'NONE')).replace(/\n+/g, ' | ').slice(0, 900);
    await p.locator('#homeContent').screenshot({ path: `${out}/v30-home-${label}.png` });
    R[label + ' archive'] = (await p.locator('#archiveCard').innerText()).replace(/\n+/g, ' | ');
    R[label + ' spot'] = (await p.locator('#spotlightCard').innerText()).replace(/\n+/g, ' | ');
    await p.click('#spotlightCard .card-link'); R[label + ' reroll'] = await p.locator('#spotlightCard').count();
    // Team page
    await p.evaluate(() => openTeamModal('Los Angeles Lakers')); await p.waitForTimeout(600);
    R[label + ' hash'] = await p.evaluate(() => location.hash);
    R[label + ' team'] = (await p.locator('#teamPage').innerText()).replace(/\n+/g, ' | ').slice(0, 700);
    R[label + ' chart'] = await p.locator('#winChart svg').count();
    await p.locator('#teamPage').screenshot({ path: `${out}/v30-team-${label}.png` });
    // Reload on team hash
    await p.reload(); await p.waitForSelector('#app', { state: 'visible', timeout: 60000 }); await p.waitForTimeout(600);
    R[label + ' team after reload'] = await p.evaluate(() => document.getElementById('sec-team').classList.contains('active') && teamState.t);
    // Dynasties
    await p.evaluate(() => showSection('records')); await p.waitForTimeout(400);
    R[label + ' dyn'] = (await p.locator('#rb-dynasties').innerText()).replace(/\n+/g, ' | ').slice(0, 900);
    await p.locator('#rb-dynasties').screenshot({ path: `${out}/v30-dyn-${label}.png` });
    // Slider
    await p.evaluate(() => showSection('legacy')); await p.waitForTimeout(300);
    const top = async () => (await p.locator('#legacyContent tbody tr').first().innerText()).split('\t').slice(0, 4).join(' ');
    R[label + ' legacy 50'] = await top();
    await p.locator('#legacyRatio').fill('100'); await p.waitForTimeout(300);
    R[label + ' legacy stats-only'] = await top() + ' | ' + await p.locator('#legacyRatioOut').innerText();
    await p.locator('#legacyRatio').fill('0'); await p.waitForTimeout(300);
    R[label + ' legacy awards-only'] = await top();
    await p.locator('.ratio-bar').screenshot({ path: `${out}/v30-ratio-${label}.png` });
    await p.locator('.ratio-bar .card-link').click(); await p.waitForTimeout(300);
    R[label + ' legacy reset'] = await top();
    R[label + ' overflow'] = await p.evaluate(() => document.documentElement.scrollWidth - innerWidth);
    R[label + ' errors'] = errs; await ctx.close(); }
  console.log(JSON.stringify(R, null, 1)); await b.close(); })();
