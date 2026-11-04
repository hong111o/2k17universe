// v39 release: player filters, awards page, compare teams, theme switch, phone filter button,
// stat leaders hiding missing seasons, duplicate titles hidden, data-check dot, logo shrinking
const { chromium, devices } = require(process.argv[2] + '/node_modules/playwright');
(async () => { const [,, pw, html, xlsm, out] = process.argv; const b = await chromium.launch(); const R = {};
  for (const [label, opts] of [['phone', { ...devices['iPhone 13'] }], ['desk', { viewport: { width: 1360, height: 900 } }]]) {
    const ctx = await b.newContext(opts);
    await ctx.route(/cdnjs\.cloudflare\.com\/ajax\/libs\/xlsx/, r => r.fulfill({ path: pw + '/node_modules/xlsx/dist/xlsx.full.min.js', contentType: 'application/javascript' }));
    await ctx.route(/fonts\./, r => r.abort());
    const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
    await p.goto('file://' + html); await p.setInputFiles('#fileInput', xlsm); await p.waitForSelector('#app', { state: 'visible', timeout: 60000 });
    R[label + ' logo size'] = await p.evaluate(async () => { const u = Object.values(DB.logos)[0]; const im = new Image(); im.src = u; await im.decode(); return im.naturalWidth + 'x' + im.naturalHeight; });
    R[label + ' load button'] = await p.locator('.reload-btn').getAttribute('aria-label');
    R[label + ' dot before settings'] = await p.locator('#dcDot').isVisible();
    await p.evaluate(() => showSection('settings')); await p.waitForTimeout(200);
    R[label + ' new tags'] = await p.locator('.dc-new').count();
    await p.evaluate(() => showSection('overview'));
    R[label + ' dot after settings'] = await p.locator('#dcDot').isVisible();
    // player filters
    await p.evaluate(() => showSection('players')); await p.waitForTimeout(200);
    R[label + ' title hidden'] = await p.evaluate(() => getComputedStyle(document.querySelector('#sec-players > .section-title')).display);
    if (label === 'phone') {
      R[label + ' team filter hidden before tap'] = !(await p.locator('#playerTeamFilter').isVisible());
      await p.locator('#sec-players .tb-toggle').click();
    }
    await p.selectOption('#playerTeamFilter', 'Chicago Bulls');
    await p.selectOption('#playerHonorFilter', 'MVP:1');
    R[label + ' bulls MVPs'] = await p.locator('#playerCount').innerText();
    if (label === 'phone') { R[label + ' filter badge'] = await p.locator('#sec-players .tb-toggle').innerText(); await p.screenshot({ path: `${out}/v39-filters-${label}.png` }); }
    await p.selectOption('#playerTeamFilter', ''); await p.selectOption('#playerHonorFilter', '');
    await p.selectOption('#playerDecadeFilter', '1990'); R[label + ' 1990s'] = await p.locator('#playerCount').innerText();
    await p.selectOption('#playerDecadeFilter', ''); await p.selectOption('#playerDraftFilter', '2003'); R[label + ' 2003 draft'] = await p.locator('#playerCount').innerText();
    await p.selectOption('#playerDraftFilter', '');
    if (label === 'desk') await p.screenshot({ path: `${out}/v39-players-${label}.png` });
    // awards
    await p.evaluate(() => showSection('awards')); await p.waitForTimeout(300);
    R[label + ' awards MVP'] = (await p.locator('#awardsContent tbody tr').first().innerText()).replace(/\s+/g, ' ') + ' | ' + await p.locator('#awardsSub').innerText();
    await p.screenshot({ path: `${out}/v39-awards-${label}.png` });
    await p.locator('#awardTabs button:has-text("Rookie")').click();
    R[label + ' awards ROY'] = (await p.locator('#awardsContent tbody tr').first().innerText()).replace(/\s+/g, ' ');
    // compare teams
    await p.evaluate(() => showSection('compare')); await p.locator('.cmp-kind button:has-text("Teams")').click();
    await p.selectOption('#cmpTeam1', 'Los Angeles Lakers'); await p.selectOption('#cmpTeam2', 'Boston Celtics'); await p.waitForTimeout(400);
    R[label + ' team compare'] = (await p.locator('#cmpTeamResult .cmp-board').innerText()).replace(/\s+/g, ' ') + ' | ' + (await p.locator('#cmpTeamResult .chart-card').innerText()).replace(/\s+/g, ' ').slice(0, 120);
    await p.screenshot({ path: `${out}/v39-cmpteams-${label}.png`, fullPage: label === 'desk' });
    // stat leaders
    await p.evaluate(() => showSection('statleaders')); await p.waitForTimeout(200);
    R[label + ' pending rows'] = await p.locator('#statBody tr.row-pending').count();
    // season hub
    await p.evaluate(() => openSeason()); await p.waitForTimeout(300);
    await p.screenshot({ path: `${out}/v39-season-${label}.png` });
    // theme
    await p.evaluate(() => setTheme('dark')); R[label + ' theme'] = await p.evaluate(() => document.documentElement.dataset.theme + ' ' + getComputedStyle(document.body).backgroundColor);
    await p.reload(); await p.waitForSelector('#app', { state: 'visible', timeout: 60000 });
    R[label + ' theme after reload'] = await p.evaluate(() => document.documentElement.dataset.theme);
    await p.evaluate(() => showSection('overview')); await p.waitForTimeout(400);
    await p.screenshot({ path: `${out}/v39-home-dark-${label}.png` });
    await p.evaluate(() => setTheme('system'));
    R[label + ' overflow'] = await p.evaluate(() => document.documentElement.scrollWidth - innerWidth);
    R[label + ' errors'] = errs; await ctx.close(); }
  console.log(JSON.stringify(R, null, 1)); await b.close(); })();
