// Shared player filters on Top 20 / By Position / Active Players, and phone sort direction
const { chromium, devices } = require(process.argv[2] + '/node_modules/playwright');
(async () => { const [,, pw, html, xlsm, out] = process.argv; const b = await chromium.launch(); const R = {};
  for (const [label, opts] of [['phone', { ...devices['iPhone 13'] }], ['desk', { viewport: { width: 1360, height: 900 } }]]) {
    const ctx = await b.newContext(opts);
    await ctx.route(/cdnjs\.cloudflare\.com\/ajax\/libs\/xlsx/, r => r.fulfill({ path: pw + '/node_modules/xlsx/dist/xlsx.full.min.js', contentType: 'application/javascript' }));
    await ctx.route(/fonts\./, r => r.abort());
    const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
    await p.goto(/^https?:/.test(html) ? html : 'file://' + html); await p.setInputFiles('#fileInput', xlsm); await p.waitForSelector('#app', { state: 'visible', timeout: 60000 });
    const open = async sec => { if (label === 'phone') { const t = p.locator(`#${sec} .tb-toggle`); if (!(await p.locator(`#${sec} .toolbar`).getAttribute('class')).includes('open')) await t.click(); } };
    // Top 20 filtered to Bulls
    await p.evaluate(() => showSection('top20')); await open('sec-top20');
    await p.selectOption('#top20TeamFilter', 'Chicago Bulls');
    R[label + ' top20 bulls'] = await p.locator('#top20Count').innerText() + ' | ' + (await p.evaluate(() => top20State.filtered.map(x => x.Player).join(', ')));
    await p.selectOption('#top20TeamFilter', '');
    // By Position honors
    await p.evaluate(() => showSection('bypos')); await open('sec-bypos');
    await p.selectOption('#posHonorFilter', 'MVP:1');
    R[label + ' PG MVPs'] = await p.evaluate(() => posState.filtered.map(x => x.Player).join(', '));
    await p.selectOption('#posHonorFilter', '');
    // Active players by decade
    await p.evaluate(() => showSection('current')); await open('sec-current');
    await p.selectOption('#curHonorFilter', 'MVP:1');
    R[label + ' active MVPs'] = await p.locator('#curCount').innerText();
    await p.selectOption('#curHonorFilter', '');
    if (label === 'phone') {
      // sort direction on All Players
      await p.evaluate(() => showSection('players')); await open('sec-players');
      R.defaultFirst = await p.locator('#playersCards .pcard .pc-name').first().innerText();
      await p.locator('#playersSortDir').click();
      R.defaultFlipped = await p.locator('#playersCards .pcard .pc-name').first().innerText();
      if (R.defaultFirst === R.defaultFlipped) throw new Error('High/Low button did nothing with no sort column');
      await p.locator('#playersSortDir').click();
      await p.locator('#sec-players select.m-sort').selectOption('PTS');
      R.high = await p.locator('#playersCards .pcard .pc-name').first().innerText();
      await p.locator('#playersSortDir').click();
      R.low = await p.locator('#playersCards .pcard .pc-name').first().innerText() + ' | ' + await p.locator('#playersSortDir').innerText();
      await p.screenshot({ path: `${out}/filters-sort-phone.png` });
      await p.evaluate(() => showSection('top20')); await open('sec-top20');
      await p.locator('#top20SortDir').click();
      R.top20Reverse = await p.locator('#top20Cards .pcard .pc-rank').first().innerText();
    }
    // Top 20 position filter and Legacy Ranking shared filters
    await p.evaluate(() => showSection('top20')); await open('sec-top20');
    await p.selectOption('#top20PosFilter', 'C'); R[label + ' top20 C'] = await p.locator('#top20Count').innerText(); await p.selectOption('#top20PosFilter', '');
    await p.evaluate(() => showSection('legacy')); await open('sec-legacy');
    await p.selectOption('#legacyTeamFilter', 'Boston Celtics');
    R[label + ' legacy celtics'] = await p.evaluate(() => document.querySelectorAll('#legacyContent tbody tr').length);
    await p.selectOption('#legacyTeamFilter', '');
    // Franchises: sort direction
    await p.evaluate(() => showSection('teams')); await open('sec-teams');
    const firstTeam = () => p.locator('#teamGrid .team-name').first().innerText();
    const hi = await firstTeam(); await p.locator('#teamSortDir').click(); const lo = await firstTeam();
    if (hi === lo) throw new Error('Team High/Low button did nothing'); R[label + ' teams'] = hi + ' -> ' + lo;
    await p.locator('#teamSortDir').click();
    R[label + ' overflow'] = await p.evaluate(() => document.documentElement.scrollWidth - innerWidth);
    R[label + ' errors'] = errs; await ctx.close(); }
  console.log(JSON.stringify(R, null, 1)); await b.close(); })();
