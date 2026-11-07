// 2K17 NBA Stats Database · Settings, Data Check, phone card lists and the installable app.
// Loaded in order by index.html; all files share one global scope.

// =====================================================================
// SETTINGS + DATA CHECK
// =====================================================================
function colLetter(i) { let s = ''; i++; while (i > 0) { const m = (i - 1) % 26; s = String.fromCharCode(65 + m) + s; i = Math.floor((i - 1) / 26); } return s; }
// Checks the workbook for numbers that can't all be right. Returns [{level, sheet, cell, msg}]
function runDataCheck() {
  const out = [], add = (level, sheet, cell, msg) => out.push({ level, sheet, cell, msg });
  const H = DB.allPlayers.headers || [], col = k => H.indexOf(k);
  const cellOf = (row, k, headers) => { const i = (headers || H).indexOf(k); return i < 0 ? '' : colLetter(i) + row._row; };
  const num = (r, k) => { const v = getNum(r[k]); return v === -Infinity ? null : v; };
  // 0. Headers the dashboard couldn't find (a column was renamed or moved)
  layoutWarnings.forEach(w => add('warn', w.sheet, 'Row 1', w.msg));
  // 1. Every season's wins must add up to teams x 41
  (DB.teamSeasonCols || []).forEach(sc => {
    const recs = DB.teams.filter(t => t.seasonRecords[sc.year]);
    if (!recs.length) return;
    const total = recs.reduce((a, t) => a + t.seasonRecords[sc.year].w, 0), want = recs.length * 41;
    if (total !== want) add('error', 'Team Record', `${colLetter(sc.idx)} (season ${sc.year})`, `Wins add up to ${total}, but ${recs.length} teams × 41 = ${want} (off by ${total - want > 0 ? '+' : ''}${total - want}). One team's wins are probably mistyped.`);
  });
  // 2. Last Title / Last Finals vs NBA History
  const lastT = {}, lastF = {};
  DB.history.forEach(h => { const { champ, ru } = finalsTeams(h.Season); const y = Number(h.Season);
    if (champ) lastT[champ] = Math.max(lastT[champ] || 0, y); [champ, ru].filter(Boolean).forEach(t => lastF[t] = Math.max(lastF[t] || 0, y)); });
  DB.teams.forEach(t => {
    if (lastT[t.Team] && getNum(t['Last Title']) !== -Infinity && Number(t['Last Title']) !== lastT[t.Team]) add('error', 'Team Record', 'I' + t._row, `${t.Team}: Last Title is ${t['Last Title']}, but NBA History has their latest title in ${lastT[t.Team]}.`);
    if (lastF[t.Team] && getNum(t['Last Finals']) !== -Infinity && Number(t['Last Finals']) !== lastF[t.Team]) add('error', 'Team Record', 'J' + t._row, `${t.Team}: Last Finals is ${t['Last Finals']}, but NBA History has their latest Finals in ${lastF[t.Team]}.`);
  });
  // 3. Player rows that contradict themselves
  DB.allPlayers.forEach(r => {
    const gp = num(r, 'GP');
    [['PTS','APG','points per game'],['REB','ARG','rebounds per game'],['AST','AAG','assists per game'],['STL','ASG','steals per game'],['BLK','ABG','blocks per game'],['TO','TOV','turnovers per game'],['MIN','MPG','minutes per game']].forEach(([t, a, label]) => {
      const tv = num(r, t), av = num(r, a);
      if (gp && tv !== null && av !== null && Math.abs(tv / gp - av) > 0.15) add('warn', 'All Players', cellOf(r, a), `${r.Player}: ${label} is ${av}, but ${t} ${tv.toLocaleString()} ÷ ${gp.toLocaleString()} games = ${(tv / gp).toFixed(1)}.`);
    });
    [['FG%','FGM','FGA'],['3P%','3PM','3PA'],['FT%','FTM','FTA']].forEach(([pc, m, a]) => {
      const pv = num(r, pc), mv = num(r, m), av = num(r, a);
      if (mv !== null && av !== null && mv > av) add('error', 'All Players', `${cellOf(r, m)}:${cellOf(r, a)}`, `${r.Player}: ${m} ${mv.toLocaleString()} is more than ${a} ${av.toLocaleString()} (swapped?).`);
      else if (pv !== null && mv !== null && av && Math.abs(mv / av * 100 - pv) > 0.6) add('warn', 'All Players', cellOf(r, pc), `${r.Player}: ${pc} is ${pv}, but ${m} ÷ ${a} = ${(mv / av * 100).toFixed(1)}%.`);
    });
    const sum = ['1st Team','2nd Team','3rd Team'].reduce((a, k) => a + (num(r, k) || 0), 0);
    if (num(r, 'All NBA Team') !== null && sum && sum !== num(r, 'All NBA Team')) add('error', 'All Players', cellOf(r, 'All NBA Team'), `${r.Player}: All NBA Team is ${num(r, 'All NBA Team')}, but 1st + 2nd + 3rd = ${sum}.`);
    for (let i = 1; i <= 11; i++) { const k = i === 1 ? 'Team' : 'Team' + i, v = r[k]; if (v && !TEAM_NAMES[v]) add('warn', 'All Players', cellOf(r, k), `${r.Player}: team code "${v}" isn't recognized${TEAM_NAMES[String(v).toUpperCase()] ? ` (did you mean ${String(v).toUpperCase()}?)` : ''}.`); }
    if (r.Draft && !/^\d{2}(Rnd\dPick\d+|Territorial|Undrafted|Rnd\d \(ABA\))$/.test(String(r.Draft))) add('info', 'All Players', cellOf(r, 'Draft'), `${r.Player}: draft code "${r.Draft}" is unusual; read as ${draftLabel(draftInfo(r))}.`);
  });
  // Red team cells (title teams) must agree with Champions
  if (DB.hasTitleColors) [['All Players', DB.allPlayers], ['Current Player', DB.currentPlayers]].forEach(([sheet, list]) => (list || []).forEach(r => {
    if (!r._titleStints || !r.Player) return;
    const champs = Math.max(getNum(r.Champions), 0), red = new Set(titleTeams(r)).size;
    const at = cellOf(r, 'Champions', list.headers) || cellOf(r, 'Team', list.headers);
    if (champs && !red) add('warn', sheet, at, `${r.Player}: ${champs} title${champs > 1 ? 's' : ''}, but no team cell is in red.`);
    else if (!champs && red) add('warn', sheet, at, `${r.Player}: ${red} team${red > 1 ? 's are' : ' is'} in red, but Champions is ${r.Champions ?? 'empty'}.`);
    else if (red > champs) add('warn', sheet, at, `${r.Player}: ${red} teams are in red, but only ${champs} title${champs > 1 ? 's' : ''}.`);
  }));
  // 4. Ranking sheets must match All Players
  [['Top 20', DB.top20], ...POSITIONS.map(pos => [pos, DB.positions[pos]])].forEach(([sheet, list]) => (list || []).forEach(r => {
    const base = DB.allPlayers.find(x => x.Player === r.Player);
    if (!base) { add('warn', sheet, 'B' + r._row, `"${r.Player}" isn't in All Players.`); return; }
    if (POSITIONS.includes(sheet) && base.Position !== sheet) add('warn', sheet, 'B' + r._row, `${r.Player} is on the ${sheet} sheet, but All Players lists ${base.Position}.`);
    const diffs = (list.headers || []).filter(k => k in base && !['Rank','Position','Rookie Team','RookieTeam','_row'].includes(k))
      .filter(k => { const a = r[k], b = base[k]; return !((a ?? '') === (b ?? '') || (typeof a === 'number' && typeof b === 'number' && Math.abs(a - b) < 0.05)); });
    if (diffs.length) add('warn', sheet, 'row ' + r._row, `${r.Player} differs from All Players row ${base._row} in ${diffs.slice(0, 4).map(k => `${k} (${r[k] ?? 'blank'} vs ${base[k] ?? 'blank'})`).join(', ')}${diffs.length > 4 ? ` and ${diffs.length - 4} more` : ''}.`);
  }));
  // 5. Award counts vs NBA History, for careers that History fully covers
  const firstHist = Math.min(...DB.history.map(h => Number(h.Season)).filter(y => !isNaN(y)));
  const histCount = {};
  DB.history.forEach(h => [['MVP','MVP'],['FMVP','FMVP'],['DPOY','DPOY']].forEach(([k, key]) => { const p = h[k] && h[k] !== '-' ? resolvePlayer(h[k], h.Season) : null; if (p) { histCount[key + '|' + p.Player] = (histCount[key + '|' + p.Player] || 0) + 1; } }));
  everyPlayer().forEach(p => { const span = careerSpan(p.Season); if (!span || span[0] < firstHist) return;
    const headers = isActive(p) ? DB.currentPlayers.headers : H, sheet = isActive(p) ? 'Current Player' : 'All Players';
    ['MVP','FMVP','DPOY'].forEach(k => { const have = num(p, k) || 0, hist = histCount[k + '|' + p.Player] || 0;
      if (have !== hist) add('error', sheet, cellOf(p, k, headers), `${p.Player}: ${k} is ${have}, but NBA History lists ${hist}.`); }); });
  // 6. All-NBA counts vs the All NBA Team sheet. The sheet can have gaps (seasons never
  //    entered), so counts must match only when every season of the career is in the sheet;
  //    otherwise the sheet can only be wrong if it lists MORE selections than the player has.
  if (DB.allNbaSeasons.length) {
    const covered = new Set(DB.allNbaSeasons.filter(s => s.teams.some(t => t.slots.length)).map(s => Number(s.season))), cnt = {};
    DB.allNbaSeasons.forEach(s => s.teams.forEach(t => t.slots.forEach(sl => { const p = resolvePlayer(sl.player, s.season); if (p) cnt[t.team + '|' + p.Player] = (cnt[t.team + '|' + p.Player] || 0) + 1; })));
    const lastSeason = DB.latestSeason || Math.max(...covered);
    everyPlayer().forEach(p => { const span = careerSpan(p.Season); if (!span) return;
      let full = true;
      for (let y = span[0]; y <= Math.min(span[1], lastSeason); y++) if (!covered.has(y)) { full = false; break; }
      const headers = isActive(p) ? DB.currentPlayers.headers : H, sheet = isActive(p) ? 'Current Player' : 'All Players';
      [[1,'1st Team'],[2,'2nd Team'],[3,'3rd Team']].forEach(([n, k]) => { const have = num(p, k) || 0, got = cnt[n + '|' + p.Player] || 0;
        if (full ? have !== got : got > have) add('error', sheet, cellOf(p, k, headers), `${p.Player}: ${k} All-NBA is ${have}, but the All NBA Team sheet lists ${got}${full ? '' : ' (more than the player has, even though some of their seasons are missing from that sheet)'}.`); }); });
  }
  // 7. Names that only match a player approximately
  const seen = new Set();
  const nameCheck = (sheet, cell, raw, season) => {
    if (!raw || raw === '-') return;
    const clean = String(raw).replace(/\s*\(\d+\)\s*$/, '').trim();
    if (/^[A-Za-z]\.\s*\S/.test(clean)) return;
    const p = resolvePlayer(clean, season);
    if (p && p.Player !== clean && !seen.has(sheet + clean)) { seen.add(sheet + clean); add('info', sheet, cell, `"${clean}" is spelled differently from "${p.Player}" in the player sheets.`); }
  };
  DB.history.forEach(h => [['MVP','C'],['FMVP','D'],['DPOY','H'],['Star1','J'],['Star2','K'],['Star3','L']].forEach(([k, c]) => nameCheck('NBA History', c + h._row, h[k], h.Season)));
  [...DB.awardRecords, ...DB.allTimeStats].forEach(cat => cat.entries.forEach(e => nameCheck('NBA All-Time Record', `${cat.name} list`, e.player)));
  DB.decades.forEach(d => [...d.starter, ...d.subs].forEach(n => nameCheck('Decade NBA Team', d.decade, n)));
  // 9. Players named in other sheets who have no row in All Players or Current Player
  //    (their names can't link to a player page until they're added)
  const missing = new Map();
  const note = (raw, season, where) => {
    if (!raw || raw === '-') return;
    const clean = String(raw).replace(/\s*\(\d+\)\s*$/, '').trim();
    if (!clean || resolvePlayer(clean, season)) return;
    const k = normName(clean);
    if (!missing.has(k)) missing.set(k, { name: clean, where: [] });
    missing.get(k).where.push(where);
  };
  DB.allNbaSeasons.forEach(s => s.teams.forEach(t => t.slots.forEach(sl => note(sl.player, s.season, `All NBA Team ${seasonLabel(s.season)} (${['1st','2nd','3rd'][t.team - 1] || t.team} Team)`))));
  DB.history.forEach(h => [['MVP', 'MVP'], ['FMVP', 'Finals MVP'], ['DPOY', 'DPOY'], ['Star1', 'champion star'], ['Star2', 'champion star'], ['Star3', 'champion star']]
    .forEach(([k, l]) => note(h[k], h.Season, `NBA History ${seasonLabel(h.Season)} (${l})`)));
  DB.statLeaders.forEach(r => STAT_LEADER_KEYS.forEach(k => note(r[k], r.Season, `Season Stat Leader ${seasonLabel(r.Season)}`)));
  DB.decades.forEach(d => [...d.starter, ...d.subs].forEach(n => note(n, null, `Decade NBA Team ${d.decade}`)));
  [...missing.values()].sort((a, b) => b.where.length - a.where.length || a.name.localeCompare(b.name)).forEach(m =>
    add('info', 'All Players', '', `"${m.name}" isn't in All Players or Current Player, so the name can't link to a player page. Named in ${m.where.slice(0, 3).join('; ')}${m.where.length > 3 ? ` and ${m.where.length - 3} more` : ''}.`));
  // 10. Team History: every season's wins and losses must balance, and its Finals
  //     column must agree with NBA History
  const thName = 'Team History BC';
  const bySeason = {};
  (DB.teamHistoryRows || []).forEach(h => { const s = (bySeason[h.yr] = bySeason[h.yr] || { w: 0, l: 0, rows: [] }); s.w += h.w; s.l += h.l; s.rows.push(h); });
  Object.entries(bySeason).forEach(([yr, s]) => {
    if (s.w !== s.l) add('error', thName, `rows of ${seasonLabel(yr)}`, `${seasonLabel(yr)}: wins add up to ${s.w} but losses to ${s.l}. A record is probably mistyped.`);
    const { champ, ru } = finalsTeams(yr), name = h => (teamByCode(h.fr) || { Team: TEAM_NAMES[h.fr] }).Team;
    const marked = s.rows.filter(h => /champ/i.test(h.finals)), lostF = s.rows.filter(h => /lost finals/i.test(h.finals));
    if (champ && marked.length && !marked.some(h => name(h) === champ)) add('warn', thName, 'N' + marked[0]._row, `${seasonLabel(yr)}: Finals says ${marked.map(name).join(', ')} won, but NBA History has ${champ}.`);
    if (ru && lostF.length && !lostF.some(h => name(h) === ru)) add('warn', thName, 'N' + lostF[0]._row, `${seasonLabel(yr)}: Finals says ${lostF.map(name).join(', ')} lost, but NBA History has ${ru}.`);
  });
  //     A franchise that disappears for many years probably isn't one team (the 1949-50 Denver
  //     Nuggets folded; today's Nuggets joined in 1976-77): flag the lone early seasons
  const byFr = {};
  (DB.teamHistoryRows || []).forEach(h => (byFr[h.fr] = byFr[h.fr] || []).push(h));
  Object.entries(byFr).forEach(([fr, list]) => {
    const yrs = list.map(h => h.yr).sort((a, b) => a - b);
    for (let i = 1; i < yrs.length; i++) if (yrs[i] - yrs[i - 1] > 10) {
      const early = list.filter(h => h.yr < yrs[i]);
      add('warn', thName, 'C' + early[0]._row, `${fr}: ${early.map(h => `${seasonLabel(h.yr)} ${h.label}`).join(', ')} then nothing until ${seasonLabel(yrs[i])}. If that was a different team, give its rows their own code in Franchise and Team.`);
    }
  });
  // 11. Retired #: a player's retired number should also be on his All Players row
  (DB.retiredList || []).forEach(r => {
    const t = teamByCode(r.code);
    if (!t) { add('warn', 'Retired #', 'A' + r._row, `Team code "${r.code}" isn't recognized.`); return; }
    if (r.type !== 'Player') return;
    const p = resolvePlayer(r.who);
    if (!p || isActive(p)) return;
    const has = retiredNums(p).some(v => { const [n, ...rest] = String(v).trim().split(/\s+/); return String(n) === String(r.num) && teamByCode(rest.join(' '))?.Team === t.Team; });
    if (!has) add('warn', 'All Players', cellOf(p, '# Retired'), `${p.Player}: Retired # lists ${r.num} ${r.code}, but the player's All Players row doesn't.`);
  });
  // 8. Gaps the user is still filling in
  const missingLeaders = DB.statLeaders.filter(r => !statRowEntered(r)).map(r => r.Season);
  if (missingLeaders.length) add('info', 'Season Stat Leader', '', `${missingLeaders.length} seasons have no leaders entered yet.`);
  const latest = DB.latestSeason;
  if (latest && !DB.statLeaders.some(r => Number(r.Season) === latest)) add('info', 'Season Stat Leader', '', `There's no row for ${seasonLabel(latest)} yet.`);
  return out;
}
let dataCheckResults = [];
function updateDataCheckDot() {
  dataCheckResults = runDataCheck();
  const errs = dataCheckResults.filter(r => r.level === 'error').length;
  // The dot only flags problems you haven't seen yet in Settings
  const fresh = newDataProblems().length;
  const dot = document.getElementById('dcDot');
  dot.hidden = !fresh;
  document.getElementById('settingsBtn').title = fresh ? `Settings · Data check found ${fresh} new problem${fresh > 1 ? 's' : ''}` : errs ? `Settings · ${errs} known data problems` : 'Settings and data check';
}
const dcKey = r => [r.sheet, r.cell, r.msg].join('|');
function newDataProblems() {
  const seen = new Set(readJSON('nba2k17-dc-seen') || []);
  return dataCheckResults.filter(r => r.level !== 'info' && !seen.has(dcKey(r)));
}
function markDataProblemsSeen() {
  writeJSON('nba2k17-dc-seen', dataCheckResults.filter(r => r.level !== 'info').map(dcKey));
  const dot = document.getElementById('dcDot'); if (dot) dot.hidden = true;
}
function themeChoice() { try { return localStorage.getItem('nba2k17-theme') || 'system'; } catch (e) { return 'system'; } }
function setTheme(v) {
  try { v === 'system' ? localStorage.removeItem('nba2k17-theme') : localStorage.setItem('nba2k17-theme', v); } catch (e) {}
  if (v === 'system') document.documentElement.removeAttribute('data-theme'); else document.documentElement.setAttribute('data-theme', v);
  renderSettings();
  if (document.getElementById('winChart')) renderWinChart();
}
function renderSettings() {
  const res = dataCheckResults;
  const freshKeys = new Set(newDataProblems().map(dcKey));
  const by = l => res.filter(r => r.level === l);
  const groups = [['error', 'Numbers that can\'t all be right'], ['warn', 'Worth a look'], ['info', 'Spelling and gaps']];
  const w = legacyWeights();
  document.getElementById('settingsContent').innerHTML = `
    <div class="chart-card"><div class="card-head"><div class="chart-title">${icon('list')} Data Check</div><button class="card-link" onclick="updateDataCheckDot();renderSettings()">Run again</button></div>
      <div class="dc-summary">${groups.map(([l, t]) => `<div class="dc-pill dc-${l}"><b>${by(l).length}</b><span>${t}</span></div>`).join('')}</div>
      ${groups.map(([l, t]) => by(l).length ? `<details class="dc-group" ${l === 'error' ? 'open' : ''}><summary>${t} (${by(l).length})</summary>
        <div class="table-wrap dc-table"><table><thead><tr><th>Sheet</th><th>Cell</th><th>Problem</th></tr></thead><tbody>
        ${by(l).map(r => `<tr><td>${r.sheet}</td><td class="nowrap">${r.cell || '—'}</td><td class="dc-msg">${freshKeys.has(dcKey(r)) ? '<span class="dc-new">New</span> ' : ''}${r.msg}</td></tr>`).join('')}</tbody></table></div></details>` : '').join('')}
      ${res.length ? '' : '<p class="muted">No problems found.</p>'}</div>
    <div class="chart-card"><div class="card-head"><div class="chart-title">${icon('trophy')} Legacy Formula</div><button class="card-link" onclick="resetLegacyWeights()">Reset to defaults</button></div>
      <p class="muted" style="margin-bottom:12px">The points system behind the Legacy Ranking. A repeat of the same honor is worth its base points × a multiplier that starts at 1 and drops each time, down to the lowest multiplier. Changes apply straight away and are saved in this browser.</p>
      ${LEGACY_SCHEMA.map(g => `<div class="weight-group"><div class="weight-title">${g.group}</div><div class="weights">${g.items.map(([k, label]) => `<label class="weight"><span>${label}</span>
        <input type="number" id="w-${k}" min="0" step="${LEGACY_DEFAULTS[k] < 1 ? 0.05 : 1}" value="${w[k]}" onchange="saveLegacyWeight('${k}', this.value)"></label>`).join('')}</div></div>`).join('')}</div>
    <div class="chart-card"><div class="chart-title">${icon('star')} Appearance</div>
      <div class="seg theme-seg">${[['system', 'Match phone'], ['light', 'Light'], ['dark', 'Dark']].map(([v, l]) => `<button class="${themeChoice() === v ? 'active' : ''}" onclick="setTheme('${v}')">${l}</button>`).join('')}</div></div>
    <div class="chart-card"><div class="chart-title">${icon('file')} Saved Workbook</div><p id="settingsSaved" class="muted"></p>
      <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:10px"><button class="btn-primary" onclick="showLoadOverlay()">Load a new workbook</button>${readJSON(RECAP_KEY)?.groups?.length ? '<button class="icon-btn" onclick="showRecap()">Show last update recap</button>' : ''}<button class="icon-btn" onclick="forgetSavedWorkbook();renderSettings()">Forget saved file</button></div></div>`;
  getSavedWorkbook().then(saved => { const el = document.getElementById('settingsSaved'); if (el) el.textContent = saved ? `${saved.name}, saved ${new Date(saved.savedAt).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })} on this device.` : 'No workbook saved on this device.'; });
}
function saveLegacyWeight(k, v) {
  const w = legacyWeights(); w[k] = Math.max(0, Number(v) || 0);
  try { localStorage.setItem('nba2k17-legacy-v2', JSON.stringify(w)); } catch (e) {}
  engineCache = {};
  renderLegacy(); renderDraft();
}
function resetLegacyWeights() {
  try { localStorage.removeItem('nba2k17-legacy-v2'); } catch (e) {}
  engineCache = {};
  renderSettings(); renderLegacy(); renderDraft();
}

// =====================================================================
// PHONE CARD LISTS
// On narrow screens the wide player tables are swapped for cards (CSS decides
// which one shows); both are rendered from the same sorted slice.
// =====================================================================
function playerCard(row, rank, mode, active) {
  const stat = (key, label) => { const v = fmtStatVal(row, key, mode); return v === '-' ? '' : `<span><b>${v}</b> ${label}</span>`; };
  const honors = [[row.Champions,'title'],[row.MVP,'MVP'],[row.FMVP,'Finals MVP'],[row['All Stars'],'All-Star'],[row.DPOY,'DPOY']]
    .filter(([v]) => getNum(v) > 0).map(([v, l]) => `${v} ${l}${v > 1 && !/MVP|DPOY/.test(l) ? 's' : ''}`);
  const statsLine = active
    ? `<span><b>${row.Exp || '—'}</b> seasons</span><span><b>${row['All NBA Team'] || 0}</b> All-NBA</span><span><b>${row['Finals App'] || 0}</b> Finals</span>`
    : stat('PTS', mode === 'avg' ? 'PPG' : 'PTS') + stat('REB', mode === 'avg' ? 'RPG' : 'REB') + stat('AST', mode === 'avg' ? 'APG' : 'AST') + `<span><b>${numFmt(row.GP)}</b> GP</span>`;
  return `<div class="pcard" role="button" tabindex="0" onclick="openPlayerModal('${jsArg(row.Player)}')" onkeydown="if(event.key==='Enter')this.click()">
    ${rank != null ? `<div class="pc-rank">${rank}</div>` : ''}
    <div class="pc-body">
      <div class="pc-top"><span class="pc-name">${row.Player}</span>${posBadge(row.Position)}</div>
      <div class="pc-meta">${row.Season || ''}${active ? '' : ' · ' + [...new Set(['Team','Team2','Team3'].map(k => row[k]).filter(Boolean))].join(', ')}</div>
      <div class="pc-stats">${statsLine}</div>
      ${honors.length ? `<div class="pc-honors">${honors.join(' · ')}</div>` : ''}
    </div>
  </div>`;
}
// Phone "Sort by" picker: same sort state the table headers use
// Phone sort menus: the column comes from the menu, the direction from the ↓/↑ button next to it
const mSortDir = { players: -1, top20: -1, pos: -1, cur: -1 };
function flipSortDir(key) {
  mSortDir[key] = -mSortDir[key];
  const btn = document.getElementById(key + 'SortDir');
  if (btn) btn.textContent = mSortDir[key] < 0 ? '↓ High first' : '↑ Low first';
  const sel = btn?.parentElement.querySelector('select.m-sort');
  mobileSort(key, sel ? sel.value : '');
}
function mobileSort(key, col) {
  if (!col) delete sortStates[key];
  else sortStates[key] = { col, dir: mSortDir[key] };
  // No column picked: the button reverses the list's own order (sheet order, rank or newest first)
  if (!col) {
    if (key === 'top20') sortStates.top20 = { col: 'Rank', dir: -mSortDir[key] };
    else if (key === 'pos') sortStates.pos = { col: 'Rank', dir: -mSortDir[key] };
    else if (key === 'cur') { if (mSortDir[key] > 0) sortStates.cur = { col: 'Season', dir: -1 }; }
    else if (mSortDir[key] > 0) sortStates[key] = { col: '_row', dir: -1 };
  }
  if (key === 'cur') { curState.page = 1; renderCurrent(); return; }
  ({ players: playersState, top20: top20State, pos: posState })[key].page = 1;
  TABLE_RENDERERS[key]();
}

// =====================================================================
// INSTALLED APP (PWA)
// Only where the page ships its manifest (GitHub Pages or a local server),
// not inside the claude.ai viewer, which can't run service workers.
// =====================================================================
const canInstall = !!document.querySelector('link[rel="manifest"]') && /^https?:$/.test(location.protocol);
const isStandalone = matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
if (canInstall && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(err => console.warn('Offline support unavailable:', err)));
}
// Ask the browser to keep the saved workbook even when the phone is short on space
try { navigator.storage?.persist?.().catch(() => {}); } catch (e) {}
// iPhone's file picker greys out .xlsm when the input lists extensions; the file is still checked on load
if (isIOS) fileInput.removeAttribute('accept');

let installEvent = null;
function installHintDismissed() { try { return localStorage.getItem('nba2k17-install-hint') === 'off'; } catch (e) { return false; } }
function dismissInstallHint() {
  document.getElementById('installHint').hidden = true;
  try { localStorage.setItem('nba2k17-install-hint', 'off'); } catch (e) {}
}
function showInstallHint() {
  if (!canInstall || isStandalone || installHintDismissed() || !matchMedia('(max-width: 900px)').matches) return;
  const how = document.getElementById('installHow'), btn = document.getElementById('installBtn');
  if (installEvent) { how.textContent = 'Install it for full-screen, offline use.'; btn.hidden = false; }
  else if (isIOS) how.textContent = 'Tap Share, then "Add to Home Screen".';
  else how.textContent = 'Use your browser menu, then "Install app" or "Add to Home screen".';
  document.getElementById('installHint').hidden = false;
}
window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); installEvent = e; showInstallHint(); });
document.getElementById('installBtn').addEventListener('click', async () => {
  if (!installEvent) return;
  installEvent.prompt();
  await installEvent.userChoice.catch(() => {});
  installEvent = null;
  dismissInstallHint();
});
window.addEventListener('appinstalled', dismissInstallHint);
setTimeout(showInstallHint, 1500);
