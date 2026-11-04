const { chromium } = require(process.argv[2] + '/node_modules/playwright');
(async () => {
  const [,, pw, html, xlsm, out] = process.argv;
  const b = await chromium.launch(); const ctx = await b.newContext({ viewport: { width: 1400, height: 1000 } }); const p = await ctx.newPage();
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.route(/cdnjs\.cloudflare\.com\/ajax\/libs\/xlsx/, r => r.fulfill({ path: pw + '/node_modules/xlsx/dist/xlsx.full.min.js', contentType: 'application/javascript' }));
  await p.route(/fonts\.googleapis/, r => r.abort());
  await p.goto('file://' + html); await p.setInputFiles('#fileInput', xlsm);
  await p.waitForSelector('#app', { state: 'visible', timeout: 60000 });
  const r = {}; const settle = () => p.waitForTimeout(400);
  const txt = async sel => (await p.locator(sel).first().innerText()).replace(/\s+/g, ' ').trim();
  // Seasons tab default = latest
  await p.evaluate(() => openSeason()); await settle();
  r.title = await txt('#seasonTitle'); r.hash = await p.evaluate(() => location.hash);
  r.tiles = await txt('#seasonContent .stats-cards');
  r.sections2078 = await p.locator('#seasonContent .chart-title').allInnerTexts();
  r.standRows2078 = await p.locator('#seasonContent .standings-table tbody tr').count();
  r.statLeaders2078 = await txt('#seasonContent .chart-card:has-text("Stat Leaders")');
  await p.screenshot({ path: out + '/v16-season-2078.png', fullPage: false });
  r.nextDisabled = await p.isDisabled('#seasonNext');
  await p.click('#seasonPrev'); r.prev = await txt('#seasonTitle');
  // 2016 via History link
  await p.evaluate(() => showSection('history')); await settle();
  await p.fill('#histSearch', '2016'); await p.click('#histBody .season-link:text-is("2015–16")'); await settle();
  r.title2016 = await txt('#seasonTitle'); r.tiles2016 = await txt('#seasonContent .stats-cards');
  r.leaders2016 = await txt('#seasonContent .chart-card:has-text("Stat Leaders")');
  r.standings2016 = await txt('#seasonContent .chart-card:has-text("Standings")');
  r.allnba2016 = await txt('#seasonContent .chart-card:has-text("All-NBA")');
  // hash deep link survives reload
  await p.evaluate(() => { location.hash = '#season-1985'; }); await settle();
  r.hash1985 = await txt('#seasonTitle');
  await p.reload(); await p.waitForSelector('#app', { state: 'visible', timeout: 60000 }); await settle();
  r.afterReload = await txt('#seasonTitle');
  r.tiles1985 = await txt('#seasonContent .stats-cards');
  // Record book
  await p.evaluate(() => showSection('records')); await settle();
  const card = async t => txt(`#recordsContent .rb-card:has(.chart-title:text-is("${t}"))`);
  r.best = (await card('Best Records')).slice(0, 160);
  r.worst = (await card('Worst Records')).slice(0, 120);
  r.titles = (await card('Consecutive Titles')).slice(0, 200);
  r.sweeps = await p.locator('#recordsContent .chart-title:has-text("Sweeps")').innerText();
  r.g7 = await p.locator('#recordsContent .chart-title:has-text("Game 7")').innerText();
  r.mvpfmvp = await p.locator('#recordsContent .chart-title:has-text("MVP + Finals MVP")').innerText();
  r.mvpdpoy = await p.locator('#recordsContent .chart-title:has-text("MVP + DPOY")').innerText();
  r.ppg = (await card('Points per Game')).slice(0, 160);
  r.rpgNote = (await card('Rebounds per Game')).slice(-40);
  r.droughts = (await card('Longest Playoff Droughts')).slice(0, 160);
  r.matchups = (await card('Most Common Finals Matchups')).slice(0, 160);
  await p.screenshot({ path: out + '/v16-records.png' });
  await p.locator('.rb-section').nth(1).screenshot({ path: out + '/v16-records-streaks.png' });
  // season link from record book
  await p.locator('#recordsContent .season-link').first().click(); await settle();
  r.fromRecord = await txt('#seasonTitle');
  // team popup season link
  await p.evaluate(() => openTeamModal('Toronto Raptors')); await settle();
  if (await p.locator('#teamPage .fold.folded .fold-head:has-text("Season by Season")').count()) await p.locator('#teamPage .fold-head:has-text("Season by Season")').click();
  await p.locator('#teamPage .standings-table .season-link:text-is("2057–58")').click(); await settle();
  r.fromTeamModal = [await txt('#seasonTitle'), await p.isVisible('#playerModal')];
  // phone
  await p.setViewportSize({ width: 390, height: 900 }); await settle();
  r.phoneOverflow = await p.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
  await p.screenshot({ path: out + '/v16-season-phone.png' });
  await p.evaluate(() => showSection('records')); await settle();
  r.phoneOverflowRecords = await p.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
  r.errors = errs;
  console.log(JSON.stringify(r, null, 1));
  await b.close();
})();
