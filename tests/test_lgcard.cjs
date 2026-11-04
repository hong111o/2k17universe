const { chromium, devices } = require(process.argv[2] + '/node_modules/playwright');
(async () => { const [,, pw, html, xlsm, out] = process.argv; const b = await chromium.launch(); const r = {};
  for (const [label, opts] of [['desk', { viewport: { width: 1400, height: 1000 } }], ['phone', { ...devices['iPhone 13'] }]]) {
    const ctx = await b.newContext(opts);
    await ctx.route(/cdnjs\.cloudflare\.com\/ajax\/libs\/xlsx/, r => r.fulfill({ path: pw + '/node_modules/xlsx/dist/xlsx.full.min.js', contentType: 'application/javascript' }));
    await ctx.route(/fonts\./, r => r.abort());
    const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
    await p.goto('file://' + html); await p.setInputFiles('#fileInput', xlsm); await p.waitForSelector('#app', { state: 'visible', timeout: 60000 });
    for (const name of ["Shaquille O'Neal", 'Bill Russell', 'Calvin Greene']) {
      await p.evaluate(n => openPlayerModal(n), name); await p.waitForTimeout(300);
      const card = p.locator('.chart-card:has-text("Legacy Score")');
      r[`${label} ${name}`] = (await card.innerText()).replace(/\s+/g, ' ');
      if (name === "Shaquille O'Neal") {
        await p.locator('.player-grid').screenshot({ path: `${out}/lgc-${label}.png` });
        r[`${label} timeline`] = await p.evaluate(() => [...document.querySelectorAll('.timeline .tl-chip')].filter(c => c.textContent.includes('Champion')).map(c => c.title).join(' | '));
        r[`${label} role chips left`] = await p.locator('.tl-chip', { hasText: 'Title role' }).count();
      }
    }
    r[`${label} overflow`] = await p.evaluate(() => document.documentElement.scrollWidth - innerWidth);
    r[`${label} errors`] = errs; await ctx.close(); }
  console.log(JSON.stringify(r, null, 1)); await b.close(); })();
