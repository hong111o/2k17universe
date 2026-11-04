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
    R[label + ' team folded'] = await p.evaluate(() => [...document.querySelectorAll('#teamPage .fold')].map(c => c.querySelector('.chart-title').textContent.trim() + (c.classList.contains('folded') ? ' [closed]' : ' [open]')).join(' | '));
    R[label + ' team height'] = await p.evaluate(() => document.getElementById('teamPage').scrollHeight);
    await p.screenshot({ path: `${out}/fold-team-${label}.png`, fullPage: true });
    // open Season by Season, then check it stays open after re-render
    await p.locator('#teamPage .fold-head:has-text("Season by Season")').click();
    R[label + ' table visible after tap'] = await p.locator('#teamPage .standings-table').isVisible();
    await p.locator('#teamPage .bw-card .seg button:has-text("Worst")').click();
    R[label + ' worst shown'] = (await p.locator('#teamPage .bw-list[data-list="worst"]').innerText()).split('\n')[0];
    await p.evaluate(() => openTeamModal('Boston Celtics')); await p.waitForTimeout(500);
    R[label + ' remembered'] = await p.locator('#teamPage .standings-table').isVisible();
    await p.locator('#teamPage .fold-head:has-text("Season by Season")').click();
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
