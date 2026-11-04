const { chromium } = require(process.argv[2] + '/node_modules/playwright');
(async () => {
  const [,, pw, html, xlsm, out] = process.argv;
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1400, height: 900 } });
  const errs = [];
  await p.route(/cdnjs\.cloudflare\.com\/ajax\/libs\/xlsx/, r => r.fulfill({ path: pw + '/node_modules/xlsx/dist/xlsx.full.min.js', contentType: 'application/javascript' }));
  await p.route(/fonts\.googleapis/, r => r.abort());
  p.on('pageerror', e => errs.push('PAGEERROR ' + e.message));
  await p.goto('file://' + html);
  await p.setInputFiles('#fileInput', xlsm);
  await p.waitForSelector('#app', { state: 'visible', timeout: 60000 });
  const r = {};
  r.badge = await p.textContent('#seasonBadge');
  r.teams = await p.evaluate(() => [DB.teams.length, DB.teams.slice(-2).map(t => t.Team)]);
  r.teamCards = await p.locator('.team-card').count();
  r.current = await p.evaluate(() => DB.currentPlayers.length);
  r.curSub = await p.textContent('#currentSub');
  // column consistency for each table, each mode
  const colCheck = async (sec, key) => {
    const res = [];
    for (const exp of [false, true]) for (const mode of ['avg', 'total']) {
      await p.evaluate(([k, e, m]) => { expanded[k] = e; modes[k] = m; ({players: renderPlayers, top20: renderTop20, pos: renderPos})[k](); }, [key, exp, mode]);
      const [h, d] = await p.evaluate(([s]) => [document.querySelectorAll(`#${s}Head th`).length, document.querySelector(`#${s}Body tr`)?.children.length], [sec]);
      res.push(`${exp?'exp':'std'}/${mode}:${h}=${d}${h===d?'':' MISMATCH'}`);
    }
    return res.join(' ');
  };
  r.colsPlayers = await colCheck('players', 'players');
  r.colsTop20 = await colCheck('top20', 'top20');
  r.colsPos = await colCheck('pos', 'pos');
  // TOV values: LeBron in top20 expanded, avg vs total
  r.tov = await p.evaluate(() => { const lb = DB.top20[0]; expanded.top20 = true;
    modes.top20 = 'avg'; renderTop20(); const idx = [...document.querySelectorAll('#top20Head th')].findIndex(t => t.textContent.startsWith('TOV'));
    const a = document.querySelector('#top20Body tr').children[idx].textContent;
    modes.top20 = 'total'; renderTop20(); const t = document.querySelector('#top20Body tr').children[idx].textContent;
    expanded.top20 = false; modes.top20 = 'total'; renderTop20(); return `${lb.Player}: avg=${a} total=${t}`; });
  // Active players sort
  await p.evaluate(() => showSection('current'));
  await p.click('#curHead th:has-text("All-Stars")'); await p.click('#curHead th:has-text("All-Stars")');
  r.curTopAllStar = await p.textContent('#curBody tr td:nth-child(1)');
  // Stat leaders
  await p.evaluate(() => showSection('statleaders'));
  r.statCount = await p.textContent('#statCount');
  r.pendingRows = await p.locator('#statBody tr.row-pending').count();
  r.mpg = await p.evaluate(() => DB.statLeaders.find(s => s.MinLeader)?.MinLeader + ' ' + DB.statLeaders.find(s => s.MinLeader)?.MPG);
  await p.waitForTimeout(500); await p.mouse.move(0,0); await p.screenshot({ path: out + '/v12-statleaders.png' });
  // History search
  await p.evaluate(() => showSection('history'));
  await p.fill('#histSearch', 'Chester Adams'); r.histChester = await p.locator('#histBody tr').count();
  await p.fill('#histSearch', 'washington'); r.histWas = await p.locator('#histBody tr').count();
  await p.fill('#histSearch', '');
  await p.click('#sec-history .sub-tab:has-text("Season Standings")');
  r.standOpt = await p.textContent('#standingsSeason option:first-child');
  await p.selectOption('#standingsConf', 'SPLIT');
  r.standRows = await p.locator('#standingsContent tbody tr').count();
  // Teams + modal
  await p.evaluate(() => showSection('teams'));
  await p.waitForTimeout(500); await p.mouse.move(0,0); await p.screenshot({ path: out + '/v12-teams.png' });
  await p.click('.team-card:has-text("Vancouver Ravens")'); r.ravensModal = await p.textContent('#teamPage .ph-name');
  await p.keyboard.press('Escape'); await p.evaluate(() => document.getElementById('playerModal').classList.remove('open'));
  // D-Team sort
  await p.evaluate(() => showSection('players'));
  await p.click('#playersHead th:has-text("D-Team")');
  r.dteamTop = await p.evaluate(() => { const s = sortedByMode(playersState.filtered, 'players', modes.players)[0]; return s.Player + ' ' + dTeamTotal(s); });
  // every tab renders without errors
  for (const t of ['Overview','Top 20','Positional Rankings','All-NBA Teams','Decade Teams','Compare Players']) await p.evaluate(t => showSection(t), {'Overview':'overview','Top 20':'top20','Positional Rankings':'bypos','All-NBA Teams':'allnba','Decade Teams':'decades','Compare Players':'compare'}[t]);
  await p.evaluate(() => showSection('overview'));
  await p.waitForTimeout(500); await p.mouse.move(0,0); await p.screenshot({ path: out + '/v12-overview.png' });
  // phone width split standings
  await p.setViewportSize({ width: 390, height: 800 });
  await p.evaluate(() => showSection('history'));
  await p.selectOption('#standingsConf', 'SPLIT'); await p.waitForTimeout(500); await p.screenshot({ path: out + '/v12-phone-standings.png' }); r.splitCols = await p.evaluate(() => getComputedStyle(document.querySelector('.split-standings')).gridTemplateColumns);
  r.errors = errs;
  console.log(JSON.stringify(r, null, 1));
  await b.close();
})();
