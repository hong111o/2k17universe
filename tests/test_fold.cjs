const { chromium, devices } = require(process.argv[2] + '/node_modules/playwright');
(async () => { const [,, pw, html, xlsm, out] = process.argv; const b = await chromium.launch(); const R = {};
  for (const [label, opts] of [['phone', { ...devices['iPhone 13'], colorScheme: 'dark' }], ['desk', { viewport: { width: 1360, height: 900 } }]]) {
    const ctx = await b.newContext(opts);
    await ctx.route(/cdnjs\.cloudflare\.com\/ajax\/libs\/xlsx/, r => r.fulfill({ path: pw + '/node_modules/xlsx/dist/xlsx.full.min.js', contentType: 'application/javascript' }));
    await ctx.route(/fonts\./, r => r.abort());
    const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
    await p.goto('file://' + html); await p.setInputFiles('#fileInput', xlsm); await p.waitForSelector('#app', { state: 'visible', timeout: 60000 });
    R[label + ' home cards'] = await p.evaluate(() => [...document.querySelectorAll('#homeContent .chart-title')].map(t => t.textContent.trim()).join(' | '));
    await p.evaluate(() => openTeamModal('Los Angeles Lakers')); await p.waitForTimeout(1200);
    // Team pages open on Home; each tab is its own page and a new team starts on Home again
    R[label + ' team tabs'] = await p.evaluate(() => [...document.querySelectorAll('#teamPage .tm-btns button')].map(b => b.textContent + (b.classList.contains('active') ? '*' : '')).join(' | '));
    R[label + ' home only'] = await p.evaluate(() => [...document.querySelectorAll('#teamPage .tm-tab')].filter(t => !t.hidden).map(t => t.dataset.tab).join(','));
    await p.screenshot({ path: `${out}/fold-team-${label}.png`, fullPage: true });
    await p.locator('#teamPage .tm-btns button:has-text("Seasons")').click(); await p.waitForTimeout(300);
    R[label + ' table visible after tap'] = await p.locator('#teamPage .standings-table').isVisible();
    await p.locator('#teamPage .bw-card .seg button:has-text("Worst")').click();
    R[label + ' worst shown'] = (await p.locator('#teamPage .bw-list[data-list="worst"]').innerText()).split('\n')[0];
    await p.evaluate(() => openTeamModal('Boston Celtics')); await p.waitForTimeout(500);
    R[label + ' new team on home'] = await p.evaluate(() => teamState.tab === 'home' && !document.querySelector('#teamPage .standings-table').checkVisibility());
    if (!R[label + ' table visible after tap'] || !R[label + ' new team on home'] || R[label + ' home only'] !== 'home') { console.log(JSON.stringify(R, null, 1)); process.exit(1); }
    await p.evaluate(() => openPlayerModal('LeBron James')); await p.waitForTimeout(600);
    R[label + ' player folded'] = await p.evaluate(() => [...document.querySelectorAll('#playerPage .fold')].map(c => c.querySelector('.chart-title').textContent.trim() + (c.classList.contains('folded') ? ' [closed]' : ' [open]')).join(' | '));
    R[label + ' legacy total visible'] = await p.locator('#playerPage .legacy-total').isVisible();
    await p.locator('#playerPage .fold-head:has-text("Legacy Score") .card-link').click(); await p.waitForTimeout(300);
    R[label + ' full ranking link works'] = await p.evaluate(() => document.getElementById('sec-legacy').classList.contains('active'));
    await p.evaluate(() => openPlayerModal('LeBron James')); await p.waitForTimeout(500);
    await p.screenshot({ path: `${out}/fold-player-${label}.png`, fullPage: true });
    R[label + ' overflow'] = await p.evaluate(() => document.documentElement.scrollWidth - innerWidth);
    R[label + ' errors'] = errs; await ctx.close(); }
  console.log(JSON.stringify(R, null, 1)); await b.close(); })();
