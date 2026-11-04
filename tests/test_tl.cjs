const { chromium, devices } = require(process.argv[2] + '/node_modules/playwright');
(async () => { const [,, pw, html, xlsm, out] = process.argv; const b = await chromium.launch(); const R = {};
  for (const [label, opts] of [['phone', { ...devices['iPhone 13'], colorScheme: 'dark' }], ['phonelight', { ...devices['iPhone 13'], colorScheme: 'light' }], ['desk', { viewport: { width: 1360, height: 900 } }]]) {
    const ctx = await b.newContext(opts);
    await ctx.route(/cdnjs\.cloudflare\.com\/ajax\/libs\/xlsx/, r => r.fulfill({ path: pw + '/node_modules/xlsx/dist/xlsx.full.min.js', contentType: 'application/javascript' }));
    await ctx.route(/fonts\./, r => r.abort());
    const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
    await p.goto('file://' + html); await p.setInputFiles('#fileInput', xlsm); await p.waitForSelector('#app', { state: 'visible', timeout: 60000 });
    await p.evaluate(() => showSection('draft')); await p.waitForTimeout(500);
    const card = p.locator('.chart-card:has(.season-nav select[aria-label="Draft year"])');
    await card.screenshot({ path: `${out}/draftnav-${label}.png` });
    R[label + ' nav fits'] = await p.evaluate(() => { const c = document.querySelector('select[aria-label="Draft year"]').closest('.chart-card').getBoundingClientRect(); return [...document.querySelectorAll('select[aria-label="Draft year"] ~ button, .season-nav button')].every(b => { const r = b.getBoundingClientRect(); return !r.width || r.right <= c.right + 0.5; }); });
    await p.evaluate(() => openPlayerModal('Owen Horton')); await p.waitForTimeout(400);
    await p.locator('.chart-card:has-text("Career Timeline")').screenshot({ path: `${out}/tl-${label}.png` });
    R[label + ' overflow'] = await p.evaluate(() => document.documentElement.scrollWidth - innerWidth);
    R[label + ' errors'] = errs; await ctx.close(); }
  console.log(JSON.stringify(R)); await b.close(); })();
