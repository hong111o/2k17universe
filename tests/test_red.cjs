const { chromium, devices } = require(process.argv[2] + '/node_modules/playwright');
(async () => { const [,, pw, html, xlsm, out] = process.argv; const b = await chromium.launch();
  const ctx = await b.newContext({ ...devices['iPhone 13'], colorScheme: 'dark' });
  await ctx.route(/cdnjs\.cloudflare\.com\/ajax\/libs\/xlsx/, r => r.fulfill({ path: pw + '/node_modules/xlsx/dist/xlsx.full.min.js', contentType: 'application/javascript' }));
  await ctx.route(/fonts\./, r => r.abort());
  const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto('file://' + html); await p.setInputFiles('#fileInput', xlsm); await p.waitForSelector('#app', { state: 'visible', timeout: 60000 });
  console.log(await p.evaluate(() => ({ has: DB.hasTitleColors, marked: DB.allPlayers.filter(x => x._titleStints && x._titleStints.some(Boolean)).length,
    cur: DB.currentPlayers.filter(x => x._titleStints && x._titleStints.some(Boolean)).map(x => x.Player + ':' + titleTeams(x).join('/')),
    checks: runDataCheck().filter(r => /red/.test(r.msg)).map(r => r.cell + ' ' + r.msg) })));
  for (const n of ['Wilt Chamberlain', 'Bill Russell', 'Calvin Greene', 'Moses Malone', "Shaquille O'Neal", 'Kareem Abdul-Jabbar']) {
    await p.evaluate(n => openPlayerModal(n), n); await p.waitForTimeout(300);
    console.log(n, '|', (await p.locator('.journey').innerText()).replace(/\n+/g, ' '));
  }
  await p.evaluate(() => openPlayerModal('Wilt Chamberlain')); await p.waitForTimeout(300);
  await p.locator('.chart-card:has(.journey)').screenshot({ path: out + '/red-journey.png' });
  console.log('LAL legends', await p.evaluate(() => franchiseLegends(fullTeamName('LAL')).slice(0, 8).map(l => l.p.Player + ' ' + l.titles).join(', ')));
  console.log('errors', errs); await b.close(); })();
