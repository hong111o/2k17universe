// 2K17 NBA Stats Database · League History, standings, Home, What's New, Season Hub, Record Book, Stat Leaders, Active Players, All-NBA and Decade Teams.
// Loaded in order by index.html; all files share one global scope.

// =====================================================================
// HISTORY
// =====================================================================
let histState = { filtered: [], page: 1, perPage: 40, sort: {col:'Season', dir:-1} };
function switchHistView(view) {
  document.getElementById('historyView').style.display = view === 'history' ? '' : 'none';
  document.getElementById('standingsView').style.display = view === 'standings' ? '' : 'none';
  document.querySelectorAll('#sec-history .sub-tab').forEach((b, i) =>
    b.classList.toggle('active', (i === 0 && view === 'history') || (i === 1 && view === 'standings')));
  if (view === 'standings') initStandings();
}

function initStandings() {
  const sel = document.getElementById('standingsSeason');
  if (!sel) return;
  if (sel.options.length > 0) { renderStandings(); return; }
  const allSeasons = new Set();
  DB.teams.forEach(t => {
    Object.keys(t.seasonRecords || {}).forEach(s => allSeasons.add(String(s)));
  });
  const seasons = [...allSeasons].sort((a,b) => Number(b)-Number(a));
  if (!seasons.length) {
    document.getElementById('standingsContent').innerHTML =
      '<p style="color:var(--text3);padding:20px">Season records load after dropping your Excel file.</p>';
    return;
  }
  sel.innerHTML = seasons.map(s =>
    `<option value="${s}">${seasonLabel(s)}</option>`).join('');
  renderStandings();
}

function buildStandingsTable(teamsArr, season, champFull, ruFull, topN, showConf) {
  topN = topN || 8;
  showConf = showConf !== undefined ? showConf : true;
  const top = teamsArr.length > 0 ? teamsArr[0].seasonRecords[season] : null;
  const hist = top && top.hist;
  return teamsArr.map((t, i) => {
    const rec = t.seasonRecords[season];
    const isChamp = champFull && t.Team === champFull;
    const isRU = ruFull && t.Team === ruFull;
    // Older seasons: shade only teams the sheet marks as playoff teams, and no cut line
    const madePlayoffs = hist ? rec.playoffs === true : (i + 1) <= topN;
    const pct = (rec.w / Math.max(rec.w + rec.l, 1)).toFixed(3).replace(/^0/, '');
    const gb = i === 0 ? '—' : (((top.w - rec.w) + (rec.l - top.l)) / 2).toFixed(1).replace('.0', '');
    const rowCls = [isChamp ? 'row-champ' : isRU ? 'row-ru' : madePlayoffs ? 'row-playoff' : '', !hist && i + 1 === topN ? 'cut' : ''].join(' ');
    return `<tr class="${rowCls}">
      <td class="st-rank">${i + 1}</td>
      <td>${teamLink(t.Team, rec.label || t.Team)}</td>
      ${showConf ? `<td><span class="conf-badge">${rec.conf || t.Conference}</span></td>` : ''}
      <td class="num ${recClass(rec.w, rec.l)}">${rec.w}-${rec.l}</td>
      <td class="num">${pct}</td>
      <td class="num">${gb}</td>
      <td>${resultMark(isChamp, isRU, false)}</td>
    </tr>`;
  }).join('');
}

function standingsHead(showConf) {
  return `<thead><tr><th>#</th><th>Team</th>${showConf ? '<th>Conf</th>' : ''}<th class="num">W-L</th><th class="num">Win%</th><th class="num">GB</th><th></th></tr></thead>`;
}
// East and West tables side by side (stacked on phones); '' if the season has no team records
function splitStandingsHtml(season) {
  const { champ, ru } = finalsTeams(season);
  const confOf = t => t.seasonRecords[season].conf || t.Conference;
  const playing = DB.teams.filter(t => t.seasonRecords?.[season]);
  const confs = ['EAST', 'WEST', 'CENTRAL'].filter(c => playing.some(t => confOf(t) === c));
  if (!confs.length) return '';
  const hist = playing.some(t => t.seasonRecords[season].hist);
  const block = c => { const teams = playing.filter(t => confOf(t) === c).sort((a,b) => b.seasonRecords[season].rawW - a.seasonRecords[season].rawW);
    return `<div>
      <div class="conf-title">${confTitle(c, season)}</div>
      <div style="overflow-x:auto"><table class="standings-table">${standingsHead(false)}<tbody>${buildStandingsTable(teams,season,champ,ru,8,false)}</tbody></table></div>
    </div>`; };
  return `<div class="split-standings${confs.length > 2 ? ' three' : ''}">${confs.map(block).join('')}</div>`;
}
function renderStandings() {
  const season = document.getElementById('standingsSeason').value;
  const conf = document.getElementById('standingsConf').value;
  if (!season) return;

  const { champ: champFull, ru: ruFull } = finalsTeams(season);
  const allTeams = DB.teams.filter(t => t.seasonRecords?.[season]);
  const byRaw = t => t.seasonRecords[season].rawW;
  const confOf = t => t.seasonRecords[season].conf || t.Conference;

  if (conf === 'SPLIT') {
    document.getElementById('standingsContent').innerHTML = splitStandingsHtml(season);
  } else {
    let teams = conf ? allTeams.filter(t => confOf(t) === conf) : allTeams;
    teams = [...teams].sort((a,b)=>byRaw(b)-byRaw(a));
    const topN = conf ? 8 : 16;
    const showC = !conf; // show Conf column only in Full League view
    document.getElementById('standingsContent').innerHTML = `
      <div style="overflow-x:auto"><table class="standings-table">${standingsHead(showC)}<tbody>${buildStandingsTable(teams,season,champFull,ruFull,topN,showC)}</tbody></table></div>`;
  }
}

function filterHistory() {
  const q = document.getElementById('histSearch').value.toLowerCase();
  histState.filtered = DB.history.filter(h =>
    !q || String(h.Season).includes(q) ||
    ['MVP','FMVP','DPOY','Finals','Star1','Star2','Star3'].some(k => String(h[k]||'').toLowerCase().includes(q)) ||
    fullTeamName(extractChampTeam(h.Finals||'')).toLowerCase().includes(q));
  histState.page = 1;
  renderHistory();
}
function sortHist(col) {
  toggleSortState('hist', col);
  histState.page = 1;
  renderHistory();
}
function renderHistory() {
  const { filtered, page, perPage } = histState;
  const s = sortStates.hist || {col:'Season',dir:-1};
  const sorted = [...filtered].sort((a,b) => (getNum(a[s.col])-getNum(b[s.col]))*s.dir || String(a[s.col]||'').localeCompare(String(b[s.col]||''))*s.dir);
  const slice = sorted.slice((page-1)*perPage, page*perPage);
  document.getElementById('histBody').innerHTML = slice.map(h => {
    const champAbbr = extractChampTeam(h.Finals||'');
    // Winner's name, with the team logo from the NBA History sheet in front of it
    const histName = (name, team) => (!name || name === '-')
      ? '<td class="muted">—</td>'
      : `<td class="nowrap">${team ? teamLogo(team) : ''}${nameLink(name, {season: h.Season})}</td>`;
    // "Name (97)" -> linked name plus its rating
    const starCell = name => {
      if (!name) return '<td class="muted">—</td>';
      const clean = String(name).replace(/\s*\(\d+\)\s*$/, '').trim();
      const rating = String(name).match(/\((\d+)\)$/)?.[1] || '';
      return `<td>${nameLink(clean, {season: h.Season})}${rating ? ` <span class="muted">${rating}</span>` : ''}</td>`;
    };
    return `<tr>
      <td class="stick-1">${seasonLink(h.Season, seasonLabel(h.Season))}</td>
      <td><span class="hist-champion">${champAbbr ? icon('trophy','ic-champ') + ' ' + teamIn(fullTeamName(champAbbr), h.Season) : '—'}</span></td>
      <td class="muted">${h.Finals||'—'}</td>
      ${histName(h.FMVP, h.FMVPTeam)}
      ${histName(h.MVP, h.MVPTeam)}
      ${histName(h.DPOY, h.DPOYTeam)}
      ${starCell(h.Star1)}${starCell(h.Star2)}${starCell(h.Star3)}
    </tr>`;
  }).join('');
  // Phones: one card per season instead of the nine-column table
  const nm = (name, h) => String(name).replace(/\s*\(\d+\)\s*$/, '').trim();
  document.getElementById('histCards').innerHTML = slice.map(h => {
    const champAbbr = extractChampTeam(h.Finals || ''), { ru } = finalsTeams(h.Season);
    const award = (label, name, team) => name && name !== '-' ? `<div class="hc-award"><span>${label}</span><b>${team ? teamLogo(team) : ''}${nameLink(name, { season: h.Season })}</b></div>` : '';
    const stars = [h.Star1, h.Star2, h.Star3].filter(Boolean).map(s => { const r = String(s).match(/\((\d+)\)$/)?.[1]; return `${nameLink(nm(s), { season: h.Season })}${r ? ` <span class="muted">${r}</span>` : ''}`; });
    return `<div class="hcard">
      <div class="hc-top"><span class="hc-season">${seasonLink(h.Season)}</span><span class="hc-score">${h.Finals || ''}</span></div>
      <div class="hc-champ">${champAbbr ? `${icon('trophy', 'ic-champ')} ${teamIn(fullTeamName(champAbbr), h.Season)}${ru ? ` <span class="muted nowrap">over ${teamLink(ru, teamCode(ru))}</span>` : ''}` : '<span class="muted">Champion not recorded</span>'}</div>
      <div class="hc-awards">${award('Finals MVP', h.FMVP, h.FMVPTeam)}${award('MVP', h.MVP, h.MVPTeam)}${award('DPOY', h.DPOY, h.DPOYTeam)}</div>
      ${stars.length ? `<div class="hc-stars"><span>Champion stars</span> ${stars.join(' · ')}</div>` : ''}
    </div>`;
  }).join('');
  renderPag('histPag', filtered.length, perPage, page, 'goHistPage');
}
function goHistPage(p) { histState.page = p; renderHistory(); }

// =====================================================================
// SEASON STANDINGS (shared by team popup, season page and record book)
// =====================================================================
let standingsCache = {};
// Every team's record and ranks for one season; [] if Team Record has no column for it.
// Playoffs = top 8 in conference (the 2K17 format; the sheet doesn't store it).
// Older seasons (Team History) carry their own conference and playoff note; playoffs there are
// only known when the sheet says so (null otherwise), since formats changed many times.
function seasonStandings(yr) {
  if (standingsCache[yr]) return standingsCache[yr];
  const teams = DB.teams.filter(t => t.seasonRecords?.[yr]);
  const rows = teams.map(t => { const rec = t.seasonRecords[yr];
    return { team: t.Team, label: rec.label || '', conf: rec.conf || t.Conference, w: rec.w, l: rec.l, raw: rec.rawW, hist: !!rec.hist, histPlayoffs: rec.playoffs }; });
  [...rows].sort((a,b) => b.raw - a.raw).forEach((r, i) => r.leagueRk = i + 1);
  [...new Set(rows.map(r => r.conf))].forEach(c => rows.filter(r => r.conf === c).sort((a,b) => b.raw - a.raw).forEach((r, i) => r.confRk = i + 1));
  rows.forEach(r => r.playoffs = r.hist ? r.histPlayoffs : r.confRk <= 8);
  return (standingsCache[yr] = rows);
}
const CONF_NAMES = { EAST: 'East', WEST: 'West', CENTRAL: 'Central' };
const confName = c => CONF_NAMES[c] || c;
// Before 1970-71 the NBA had divisions where it now has conferences
const confTitle = (c, season) => ({ EAST: 'Eastern', WEST: 'Western', CENTRAL: 'Central' }[c] || c) + (Number(season) < 1971 ? ' Division' : ' Conference');
// Seasons that have team records, oldest first
function standingsSeasons() {
  const yrs = new Set();
  DB.teams.forEach(t => Object.keys(t.seasonRecords || {}).forEach(y => yrs.add(Number(y))));
  return [...yrs].sort((a,b) => a - b);
}
// A team as it was called in that season (Minneapolis Lakers in 1950), linking to today's franchise
function teamIn(team, yr, label) {
  const t = team && DB.teams.find(x => x.Team === team), era = t && t.seasonRecords?.[yr]?.label;
  return teamLink(team, label || era || undefined);
}
function seasonLink(yr, label) {
  return `<span class="season-link" onclick="event.stopPropagation();openSeason(${Number(yr)})">${label || seasonLabel(yr)}</span>`;
}

// =====================================================================
// HOME: the latest season at a glance
// =====================================================================
let homeHighlights = [];
const icon = (id, cls) => `<svg class="ic${cls ? ' ' + cls : ''}" aria-hidden="true"><use href="#i-${id}"/></svg>`;
// Winning record: more wins than losses (old seasons weren't always 82 games)
function recClass(w, l) { return (l === undefined ? w >= 41 : w >= l) ? 'rec-win' : 'rec-loss'; }
// Trophy for the champion, silver trophy for the Finals loser, each with a text label for screen readers
function resultMark(isChamp, isRU, withText) {
  if (isChamp) return `<span class="result-mark" title="Champion">${icon('trophy', 'ic-champ')}${withText ? ' Champion' : '<span class="sr">Champion</span>'}</span>`;
  if (isRU) return `<span class="result-mark" title="Lost in Finals">${icon('trophy', 'ic-silver')}${withText ? ' Lost in Finals' : '<span class="sr">Lost in Finals</span>'}</span>`;
  return '';
}
function renderHome() {
  const el = document.getElementById('homeContent');
  const yr = DB.latestSeason;
  if (!yr) { el.innerHTML = '<p class="muted">No seasons found in NBA History.</p>'; return; }
  const h = DB.history.find(x => Number(x.Season) === yr) || {};
  const { champ, ru } = finalsTeams(yr);
  const st = seasonStandings(yr);
  const champRow = st.find(r => r.team === champ);
  const score = h.Finals ? String(h.Finals).replace(/^\S+\s+/, '').replace(/\s+\S+$/, '') : '';
  const award = v => v && v !== '-' ? nameLink(v, {season: yr}) : '<span class="name-plain">—</span>';
  const best = [...st].sort((a,b) => b.raw - a.raw)[0];
  const parts = [];
  const recap = recapCard();
  if (recap) parts.push(`<div class="home-grid recap-wrap">${recap}</div>`);

  parts.push(`<section class="home-hero">
    <div>
      <div class="hero-kicker">${icon('trophy')} ${seasonLabel(yr)} Champions</div>
      <div class="hero-title">${champ ? teamLink(champ) : 'Champion not recorded'}</div>
      <div class="hero-sub">${ru ? `Beat ${teamLink(ru)} ${score} in the Finals` : ''}${champRow ? ` · ${champRow.w}-${champRow.l} regular season` : ''} · ${seasonLink(yr, 'Season recap')}</div>
    </div>
    <div class="hero-awards">
      <div class="hero-award"><div class="ha-label">Finals MVP</div><div class="ha-name">${h.FMVPTeam ? teamLogo(h.FMVPTeam) : ''}${award(h.FMVP)}</div></div>
      <div class="hero-award"><div class="ha-label">MVP</div><div class="ha-name">${h.MVPTeam ? teamLogo(h.MVPTeam) : ''}${award(h.MVP)}</div></div>
      <div class="hero-award"><div class="ha-label">DPOY</div><div class="ha-name">${h.DPOYTeam ? teamLogo(h.DPOYTeam) : ''}${award(h.DPOY)}</div></div>
      ${best ? `<div class="hero-award"><div class="ha-label">Best Record</div><div class="ha-name">${teamLink(best.team)} <span class="nowrap">${best.w}-${best.l}</span></div></div>` : ''}
    </div>
  </section>`);

  const cards = [];
  if (st.length) {
    const mini = conf => {
      const rows = st.filter(r => r.conf === conf).sort((a,b) => b.raw - a.raw).slice(0, 8);
      const top = rows[0];
      return `<div><div class="conf-title">${conf === 'EAST' ? 'East' : 'West'}</div>
        <table class="standings-table mini-standings"><thead><tr><th>#</th><th>Team</th><th class="num">W-L</th><th class="num">GB</th></tr></thead>
        <tbody>${rows.map((r, i) => `<tr><td class="st-rank">${i+1}</td><td>${teamLink(r.team)}${r.team === champ ? ' ' + icon('trophy', 'ic-champ') : r.team === ru ? ' ' + icon('trophy', 'ic-silver') : ''}</td>
          <td class="num ${recClass(r.w, r.l)}">${r.w}-${r.l}</td><td class="num">${i ? top.w - r.w : '—'}</td></tr>`).join('')}</tbody></table></div>`;
    };
    cards.push(`<div class="chart-card span-8"><div class="card-head"><div class="chart-title">Final Standings · Top 8</div>
      <button class="card-link" onclick="openSeason(${yr})">Full standings</button></div>
      <div class="split-standings">${mini('EAST')}${mini('WEST')}</div></div>`);
  }
  const active = [...DB.currentPlayers].sort((a,b) => getNum(b['All Stars']) - getNum(a['All Stars']) || getNum(b.MVP) - getNum(a.MVP)).slice(0, 8);
  cards.push(`<div class="chart-card span-4"><div class="card-head"><div class="chart-title">Active Stars <span class="muted">All-Stars</span></div>
    <button class="card-link" onclick="showSection('current')">All active</button></div>
    <div class="leader-list">${active.map((p, i) => {
      const extras = [[p.MVP,'MVP'],[p.Champions,'title'],[p.FMVP,'Finals MVP']].filter(([v]) => getNum(v) > 0).map(([v, l]) => `${v} ${l}${v > 1 && l !== 'MVP' && l !== 'Finals MVP' ? 's' : ''}`).join(' · ');
      return `<div class="rb-row"><span class="rb-rank">${i+1}</span><span class="rb-main">${nameLink(p.Player)}</span><span class="rb-val">${p['All Stars']||0}</span>
        <span class="rb-sub">${posBadge(p.Position)}${extras ? ' ' + extras : ''}</span></div>`;
    }).join('')}</div></div>`);
  cards.push(archiveCard(), spotlightCard());
  const an = DB.allNbaSeasons.find(x => Number(x.season) === yr);
  const first = an?.teams.find(t => t.team === 1);
  if (first) cards.push(`<div class="chart-card span-12"><div class="card-head"><div class="chart-title">${icon('star')} All-NBA First Team · ${seasonLabel(yr)}</div>
    <button class="card-link" onclick="showSection('allnba')">All selections</button></div>
    <div class="first-team">${first.slots.map(sl => `<div class="ft-player"><div class="ft-pos">${{G:'GUARD',F:'FORWARD',C:'CENTER'}[sl.pos]||sl.pos}</div>
      <div class="ft-name">${nameLink(resolvePlayer(sl.player, yr)?.Player || sl.player, {season: yr})}</div></div>`).join('')}</div></div>`);
  parts.push(`<div class="home-grid">${cards.join('')}</div>`);
  el.innerHTML = parts.join('');
}

// =====================================================================
// HOME EXTRAS: a random past season and a random legend on every visit
// =====================================================================
const pickRandom = list => list[Math.floor(Math.random() * list.length)];
function finalsScore(h) { return h && h.Finals ? String(h.Finals).replace(/^\S+\s+/, '').replace(/\s+\S+$/, '') : ''; }
function archiveCard() {
  const yrs = DB.history.map(h => Number(h.Season)).filter(y => !isNaN(y) && y !== DB.latestSeason && finalsTeams(y).champ);
  if (!yrs.length) return '';
  const yr = pickRandom(yrs), h = DB.history.find(x => Number(x.Season) === yr) || {};
  const { champ, ru } = finalsTeams(yr), st = seasonStandings(yr), cr = st.find(r => r.team === champ);
  const best = [...st].sort((a, b) => b.raw - a.raw)[0], ago = DB.latestSeason - yr;
  const award = (label, v) => v && v !== '-' ? `<div class="rb-row"><span class="rb-rank"></span><span class="rb-main">${nameLink(v, { season: yr })}</span><span class="rb-val"></span><span class="rb-sub">${label}</span></div>` : '';
  return `<div class="chart-card span-6 rb-card" id="archiveCard"><div class="card-head"><div class="chart-title">${icon('calendar')} From the Archives</div>
      <button class="card-link" onclick="rerollHome('archive')">Another season</button></div>
    <div class="arch-head">${seasonLink(yr)} <span class="muted">· ${ago} season${ago === 1 ? '' : 's'} ago</span></div>
    <div class="rb-row"><span class="rb-rank">${icon('trophy', 'ic-champ')}</span><span class="rb-main">${teamIn(champ, yr)}</span><span class="rb-val">${cr ? `${cr.w}-${cr.l}` : ''}</span>
      <span class="rb-sub">Champion${ru ? ` · beat ${teamIn(ru, yr)} ${finalsScore(h)}` : ''}</span></div>
    ${award('Finals MVP', h.FMVP)}${award('MVP', h.MVP)}${award('DPOY', h.DPOY)}
    ${best && best.team !== champ ? `<div class="rb-row"><span class="rb-rank"></span><span class="rb-main">${teamIn(best.team, yr)}</span><span class="rb-val">${best.w}-${best.l}</span><span class="rb-sub">Best record</span></div>` : ''}
  </div>`;
}
function spotlightCard() {
  const pool = legacyRanking().filter(r => !isActive(r.p) && r.rank <= 60);
  if (!pool.length) return '';
  const { p, rank } = pickRandom(pool), span = careerSpan(p.Season), one = v => v === null ? '—' : v.toFixed(1);
  const badges = allTimeRanks(p).slice(0, 3);
  return `<div class="chart-card span-6" id="spotlightCard"><div class="card-head"><div class="chart-title">${icon('star')} Legend Spotlight</div>
      <button class="card-link" onclick="rerollHome('spotlight')">Another legend</button></div>
    <div class="spot">
      <div class="spot-name">${nameLink(p.Player)} ${posBadge(p.Position)}</div>
      <div class="spot-sub">${span ? `${seasonLabel(span[0])} to ${seasonLabel(span[1])}` : (p.Season || '')} · Legacy #${rank}</div>
      <div class="spot-stats">${[['PPG', 'PTS'], ['RPG', 'REB'], ['APG', 'AST']].map(([l, k]) => `<div><b>${one(perGame(p, k))}</b><span>${l}</span></div>`).join('')}</div>
      <div class="spot-honors">${draftCareer(p)}</div>
      ${badges.length ? `<div class="rank-badges">${badges.map(r => `<span class="rank-badge${r.rank <= 3 ? ' rb-podium' : ''}"><b>#${r.rank}</b> all-time ${r.label}</span>`).join('')}</div>` : ''}
      <div class="spot-teams">${playerTeams(p).map(t => teamLink(t)).join(' → ')}</div>
    </div></div>`;
}
function rerollHome(which) {
  const el = document.getElementById(which === 'archive' ? 'archiveCard' : 'spotlightCard');
  if (el) el.outerHTML = which === 'archive' ? archiveCard() : spotlightCard();
}

// =====================================================================
// WHAT'S NEW: after loading a changed workbook, compare it with a snapshot
// of the previous one (kept in this browser) and list what changed
// =====================================================================
const SNAP_KEY = 'nba2k17-snapshot', RECAP_KEY = 'nba2k17-recap';
let loadInfo = { name: '', at: 0 };
const ordinal = n => n + (['th', 'st', 'nd', 'rd'][(n % 100 - 20) % 10] || ['th', 'st', 'nd', 'rd'][n % 100] || 'th');
function buildSnapshot() {
  const players = {};
  everyPlayer().forEach(p => {
    const r = {};
    allTimeRanks(p).forEach(x => { r[x.key] = x.rank; });
    players[p.Player] = { a: isActive(p) ? 1 : 0, r, L: legacyRankOf(p) || 0 };
  });
  return { v: 1, seasons: DB.history.map(h => Number(h.Season)).filter(y => !isNaN(y)), players,
    formula: JSON.stringify(legacyWeights()) + '|' + legacyRatio() };
}
function hashString(str) { let h = 0; for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) | 0; return h; }
function readJSON(key) { try { return JSON.parse(localStorage.getItem(key) || 'null'); } catch (e) { return null; } }
function writeJSON(key, v) { try { localStorage.setItem(key, JSON.stringify(v)); } catch (e) {} }
function updateRecap() {
  const prev = readJSON(SNAP_KEY), snap = buildSnapshot();
  snap.sig = hashString(JSON.stringify([snap.seasons, snap.players]));
  snap.file = loadInfo.name; snap.at = loadInfo.at;
  if (prev && prev.v === 1 && prev.sig !== snap.sig) {
    const groups = diffSnapshots(prev, snap);
    if (groups.length) writeJSON(RECAP_KEY, { at: Date.now(), from: prev.file, fromAt: prev.at, groups, dismissed: false });
  }
  writeJSON(SNAP_KEY, snap);
}
function diffSnapshots(prev, cur) {
  const groups = [], P = n => everyPlayer().find(x => x.Player === n);
  const award = (label, v, yr) => v && v !== '-' ? `${label} ${nameLink(v, { season: yr })}` : '';
  // New seasons in NBA History
  // Seasons added before the previous latest one are history being filled in: one line, not one each
  const prevLatest = prev.seasons.length ? Math.max(...prev.seasons) : 0;
  const backfill = cur.seasons.filter(y => !prev.seasons.includes(y) && y < prevLatest).sort((a, b) => a - b);
  const seasons = cur.seasons.filter(y => !prev.seasons.includes(y) && y >= prevLatest).sort((a, b) => a - b).map(yr => {
    const h = DB.history.find(x => Number(x.Season) === yr) || {}, { champ, ru } = finalsTeams(yr);
    const t = DB.teams.find(x => x.Team === champ);
    const later = DB.history.filter(x => Number(x.Season) > yr && finalsTeams(x.Season).champ === champ).length;
    const nth = t && Number(t.Championship) ? Number(t.Championship) - later : 0;
    return `<b>${seasonLink(yr)}:</b> ${champ ? `${teamLink(champ)} win ${nth > 0 ? `their ${ordinal(nth)} title` : 'the title'}${ru ? `, beating ${teamLink(ru)} ${finalsScore(h)}` : ''}.` : ''}
      ${[award('Finals MVP', h.FMVP, yr), award('MVP', h.MVP, yr), award('DPOY', h.DPOY, yr)].filter(Boolean).join(' · ')}`;
  });
  if (seasons.length) groups.push({ title: 'New season' + (seasons.length > 1 ? 's' : ''), icon: 'trophy', items: seasons });
  if (backfill.length) groups.push({ title: 'History added', icon: 'calendar', items: [`${backfill.length} earlier season${backfill.length > 1 ? 's' : ''} added to NBA History (${seasonLabel(backfill[0])}${backfill.length > 1 ? ' to ' + seasonLabel(backfill[backfill.length - 1]) : ''})`] });
  // Retirements
  const retired = Object.keys(cur.players).filter(n => prev.players[n]?.a === 1 && cur.players[n].a === 0).map(n => {
    const p = P(n); return `${nameLink(n)} retired · ${p ? draftCareer(p) : ''}${cur.players[n].L ? ` · legacy #${cur.players[n].L}` : ''}`;
  });
  if (retired.length) groups.push({ title: 'Retired', icon: 'jersey', items: retired });
  // New players
  const added = Object.keys(cur.players).filter(n => !prev.players[n] && cur.players[n].a === 1);
  if (added.length) groups.push({ title: 'New players', icon: 'people', items: [added.slice(0, 12).map(n => nameLink(n)).join(', ') + (added.length > 12 ? ` and ${added.length - 12} more` : '')] });
  // All-time ranks: moves into the top 10, or new entries in the top 20
  const labels = Object.fromEntries(ALL_TIME_CHECKS.map(([k, l]) => [k, l]));
  const moves = [];
  Object.entries(cur.players).forEach(([n, c]) => {
    const pr = prev.players[n]?.r || {};
    Object.entries(c.r).forEach(([k, nr]) => {
      const or = pr[k];
      if (or ? nr < or && nr <= 10 : nr <= 20) moves.push({ nr, html: `${nameLink(n)} ${or ? 'moves up to' : 'enters the top 20 at'} <b>#${nr}</b> all-time in ${labels[k]}${or ? ` <span class="muted">(was #${or})</span>` : ''}` });
    });
  });
  moves.sort((a, b) => a.nr - b.nr);
  if (moves.length) groups.push({ title: 'All-time ranks', icon: 'list', items: moves.slice(0, 12).map(m => m.html), more: Math.max(0, moves.length - 12) });
  // Legacy ranking (skipped when the formula changed, since every score moves then)
  if (prev.formula === cur.formula) {
    const lm = Object.entries(cur.players).filter(([n, c]) => c.L && c.L <= 25 && (!prev.players[n]?.L || c.L < prev.players[n].L)).sort((a, b) => a[1].L - b[1].L)
      .map(([n, c]) => `${nameLink(n)} moves up to <b>#${c.L}</b> in the legacy ranking${prev.players[n]?.L ? ` <span class="muted">(was #${prev.players[n].L})</span>` : ''}`);
    if (lm.length) groups.push({ title: 'Legacy ranking', icon: 'star', items: lm.slice(0, 8), more: Math.max(0, lm.length - 8) });
  }
  return groups;
}
function recapCard() {
  const rc = readJSON(RECAP_KEY);
  if (!rc || rc.dismissed || !rc.groups?.length) return '';
  const when = t => t ? new Date(t).toLocaleDateString([], { dateStyle: 'medium' }) : '';
  return `<div class="chart-card span-12 recap-card" id="recapCard"><div class="card-head"><div class="chart-title">${icon('star')} What's New</div>
      <button class="card-link" onclick="dismissRecap()">Hide</button></div>
    <div class="recap-sub">Since your previous workbook${rc.from ? ` (${rc.from}${rc.fromAt ? ', ' + when(rc.fromAt) : ''})` : ''}</div>
    <div class="recap-groups">${rc.groups.map(g => `<div class="recap-group"><div class="recap-title">${icon(g.icon)} ${g.title}</div>
      <ul>${g.items.map(i => `<li>${i}</li>`).join('')}${g.more ? `<li class="muted">and ${g.more} more</li>` : ''}</ul></div>`).join('')}</div></div>`;
}
function dismissRecap() {
  const rc = readJSON(RECAP_KEY); if (rc) { rc.dismissed = true; writeJSON(RECAP_KEY, rc); }
  document.getElementById('recapCard')?.remove();
  if (document.getElementById('sec-settings').classList.contains('active')) renderSettings();
}
function showRecap() {
  const rc = readJSON(RECAP_KEY); if (rc) { rc.dismissed = false; writeJSON(RECAP_KEY, rc); }
  renderHome(); showSection('overview'); window.scrollTo(0, 0);
}

// =====================================================================
// SEASON DETAIL PAGE
// =====================================================================
let seasonState = { yr: null, list: [] };
function allSeasonYears() {
  const yrs = new Set();
  DB.history.forEach(h => { if (!isNaN(Number(h.Season))) yrs.add(Number(h.Season)); });
  standingsSeasons().forEach(y => yrs.add(y));
  DB.allNbaSeasons.forEach(s => yrs.add(Number(s.season)));
  DB.statLeaders.forEach(s => { if (statRowEntered(s)) yrs.add(Number(s.Season)); });
  return [...yrs].sort((a,b) => b - a);
}
function openSeasonFromHash() {
  const m = location.hash.match(/^#season-(\d{4})$/);
  if (!m) return false;
  openSeason(Number(m[1]));
  return true;
}
function openSeason(yr) {
  closeModal();
  seasonState.list = allSeasonYears();
  if (!seasonState.list.length) { showSection('season'); return; }
  yr = Number(yr) || seasonState.yr || seasonState.list[0];
  if (!seasonState.list.includes(yr)) yr = seasonState.list[0];
  seasonState.yr = yr;
  renderSeason();
  showSection('season');
  window.scrollTo(0, 0);
}
function stepSeason(dir) {
  const i = seasonState.list.indexOf(seasonState.yr) - dir; // list is newest first
  if (i >= 0 && i < seasonState.list.length) openSeason(seasonState.list[i]);
}
function renderSeason() {
  const yr = seasonState.yr, list = seasonState.list;
  const sel = document.getElementById('seasonSelect');
  sel.innerHTML = list.map(y => `<option value="${y}"${y === yr ? ' selected' : ''}>${seasonLabel(y)}</option>`).join('');
  document.getElementById('seasonPrev').disabled = list.indexOf(yr) >= list.length - 1;
  document.getElementById('seasonNext').disabled = list.indexOf(yr) <= 0;
  document.getElementById('seasonTitle').textContent = `${seasonLabel(yr)} Season`;

  const h = DB.history.find(x => Number(x.Season) === yr);
  const { champ, ru } = finalsTeams(yr);
  const standings = seasonStandings(yr);
  const champRow = standings.find(r => r.team === champ);
  const best = [...standings].sort((a,b) => b.raw - a.raw)[0];
  const award = v => v && v !== '-' ? nameLink(v, {season: yr}) : '<span class="muted">—</span>';
  const tile = (label, value, sub) => `<div class="stat-card"><div class="label">${label}</div><div class="value value-name">${value}</div><div class="sub">${sub || '&nbsp;'}</div></div>`;
  const finalsScore = h?.Finals ? String(h.Finals).replace(/^\S+\s+/, '').replace(/\s+\S+$/, '') : '';
  const sections = [];

  sections.push(`<div class="stats-cards sh-awards">
    ${tile(icon('trophy','ic-champ') + ' Champion', champ ? teamIn(champ, yr) : '<span class="muted">—</span>',
      ru ? `beat ${teamIn(ru, yr)} ${finalsScore}${champRow ? ` · ${champRow.w}-${champRow.l} season` : ''}` : '')}
    ${['FMVP', 'MVP', 'DPOY'].map(k => tile(k === 'FMVP' ? 'Finals MVP' : k, award(h?.[k]), h?.[k + 'Team'] && h[k] && h[k] !== '-' ? teamIn(h[k + 'Team'], yr) : '')).join('')}
    ${best ? tile('Best Record', teamIn(best.team, yr), `${best.w}-${best.l}`) : ''}
  </div>`);

  const stars = h ? [h.Star1, h.Star2, h.Star3].filter(Boolean) : [];
  if (stars.length) sections.push(`<div class="chart-card"><div class="chart-title">${icon('star')} Champion Stars <span class="muted">(rating)</span></div>
    <div class="decade-player-chips">${stars.map(st => {
      const clean = String(st).replace(/\s*\(\d+\)\s*$/, '').trim(), rating = String(st).match(/\((\d+)\)$/)?.[1];
      return `<div class="decade-chip starter">${nameLink(clean, {season: yr})}${rating ? ` <span class="muted">(${rating})</span>` : ''}</div>`;
    }).join('')}</div></div>`);

  const sl = DB.statLeaders.find(x => Number(x.Season) === yr);
  const leaders = [['Points','PtsLeader','PtsTeam','PPG'],['Rebounds','RebLeader','RebTeam','RPG'],['Assists','AstLeader','AstTeam','APG'],
                   ['Steals','StlLeader','StlTeam','SPG'],['Blocks','BlkLeader','BlkTeam','BPG'],['Minutes','MinLeader','MinTeam','MPG']];
  sections.push(`<div class="chart-card"><div class="chart-title">${icon('chart')} Stat Leaders</div>${sl && statRowEntered(sl)
    ? `<div class="stats-cards" style="margin-bottom:0">${leaders.filter(([, k]) => sl[k]).map(([label, k, tk, unit]) =>
        tile(label, nameLink(sl[k], {season: yr}), `${sl[unit]} ${unit}${sl[tk] ? ' · ' + teamLink(sl[tk]) : ''}`)).join('')}</div>`
    : '<p class="muted">Not entered yet in Season Stat Leader.</p>'}</div>`);

  const split = splitStandingsHtml(yr);
  const firstStandings = standingsSeasons()[0];
  sections.push(`<div class="chart-card"><div class="chart-title">${icon('list')} Standings</div>${split ||
    `<p class="muted">No team records for this season${firstStandings ? ` (Team Record starts in ${seasonLabel(firstStandings)})` : ''}.</p>`}</div>`);

  const an = DB.allNbaSeasons.find(x => Number(x.season) === yr);
  sections.push(`<div class="chart-card"><div class="chart-title">${icon('star')} All-NBA Teams</div>${an ? allNbaTeamsHtml(an)
    : '<p class="muted">No All-NBA teams recorded for this season.</p>'}</div>`);

  document.getElementById('seasonContent').innerHTML = sections.join('');
}

// =====================================================================
// RECORD BOOK
// Everything here is derived from NBA History, Team Record and
// Season Stat Leader; each card says which seasons it covers.
// =====================================================================
// Standard competition ranking: ties share a rank (1, 2, 2, 4)
function withRanks(items, valueOf) {
  return items.map((it, i) => ({ ...it, rank: i && valueOf(items[i-1]) === valueOf(it) ? null : i + 1 }))
    .map((it, i, arr) => ({ ...it, rank: it.rank ?? arr.slice(0, i).reverse().find(x => x.rank)?.rank }));
}
function recordCard(title, rows, note, empty) {
  const body = rows.length ? rows.map(r => `<div class="rb-row">
      <span class="rb-rank">${r.rank ?? ''}</span>
      <span class="rb-main">${r.main}</span>
      <span class="rb-val">${r.val}</span>
      ${r.sub ? `<span class="rb-sub">${r.sub}</span>` : ''}
    </div>`).join('') : `<p class="muted">${empty || 'Nothing recorded yet.'}</p>`;
  return `<div class="chart-card rb-card"><div class="chart-title">${title}</div>${body}</div>`;
}
// Runs of the same value over consecutive seasons: [{key, start, end, len}]
function seasonRuns(entries) {
  const runs = [];
  entries.sort((a,b) => a.yr - b.yr).forEach(e => {
    const last = runs.find(r => r.key === e.key && r.end === e.yr - 1);
    if (last) { last.end = e.yr; last.len++; } else runs.push({ key: e.key, start: e.yr, end: e.yr, len: 1 });
  });
  return runs;
}
const spanLabel = r => r.len === 1 ? seasonLink(r.start) : `${seasonLink(r.start)} to ${seasonLink(r.end)}`;
// Same player? Uses name matching so "Shaquile" and "Shaquille" count as one
function samePlayer(a, b, yr) {
  if (!a || !b || a === '-' || b === '-') return false;
  const pa = resolvePlayer(a, yr), pb = resolvePlayer(b, yr);
  return pa && pb ? pa === pb : normName(a) === normName(b);
}
function playerKey(name, yr) { const p = resolvePlayer(name, yr); return p ? p.Player : String(name); }

function renderRecords() {
  const latest = DB.latestSeason;
  const yrs = standingsSeasons();
  const finals = DB.history.map(h => {
    const m = String(h.Finals || '').match(/^(\S+)\s+4\s*[-–]\s*(\d)\s+(\S+)/);
    return m ? { yr: Number(h.Season), champ: fullTeamName(m[1]), ru: fullTeamName(m[3]), losses: Number(m[2]), raw: h.Finals } : null;
  }).filter(Boolean);
  const finalsYrs = finals.map(f => f.yr);
  const histSpan = finalsYrs.length ? `${seasonLabel(Math.min(...finalsYrs))} to ${seasonLabel(Math.max(...finalsYrs))}` : '';
  const teamSpan = yrs.length ? `${seasonLabel(yrs[0])} to ${seasonLabel(yrs[yrs.length-1])}` : '';
  const out = [];
  const section = (title, sub, cards) => out.push(`<div class="rb-section" id="rb-${title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}"><div class="rb-section-title">${title}</div>${sub ? `<div class="rb-section-sub">${sub}</div>` : ''}<div class="rb-grid">${cards.join('')}</div></div>`);
  const resultIcon = (team, yr) => { const f = finals.find(x => x.yr === yr); return ' ' + resultMark(f?.champ === team, f?.ru === team, false); };

  // ----- Team seasons
  if (yrs.length) {
    const all = yrs.flatMap(yr => seasonStandings(yr).map(r => ({ ...r, yr })));
    const teamRow = r => ({ main: teamIn(r.team, r.yr), val: `${r.w}-${r.l}`, sub: seasonLink(r.yr) + resultIcon(r.team, r.yr) });
    const top = (list, n, dir) => withRanks([...list].sort((a,b) => dir * (b.raw - a.raw)).slice(0, n), r => r.w).map(r => ({ ...teamRow(r), rank: r.rank }));
    const champs = all.filter(r => finals.some(f => f.yr === r.yr && f.champ === r.team));
    section('Team Seasons', `From Team Record, ${teamSpan}`, [
      recordCard('Best Records', top(all, 10, 1)),
      recordCard('Worst Records', top(all, 10, -1)),
      recordCard('Most Wins by a Champion', top(champs, 5, 1)),
      recordCard('Fewest Wins by a Champion', top(champs, 5, -1)),
      recordCard('Best Teams to Miss the Playoffs', top(all.filter(r => r.playoffs === false), 5, 1), 'Playoffs = top 8 in conference'),
      recordCard('Worst Playoff Teams', top(all.filter(r => r.playoffs === true), 5, -1), 'Playoffs = top 8 in conference'),
    ]);
  }

  // ----- Streaks
  const runCard = (title, runs, minLen, n, mainOf, note, unit) => {
    const best = runs.filter(r => r.len >= minLen).sort((a,b) => b.len - a.len || b.end - a.end).slice(0, n);
    return recordCard(title, withRanks(best, r => r.len).map(r => ({
      rank: r.rank, main: mainOf(r.key, r.end), val: `${r.len} ${unit || 'seasons'}`,
      sub: spanLabel(r) + (r.end === latest ? ' <span class="rb-active">ongoing</span>' : '') })), note, 'No streaks yet.');
  };
  const teamPlayoffEntries = flag => yrs.flatMap(yr => seasonStandings(yr).filter(r => r.playoffs === flag).map(r => ({ key: r.team, yr })));
  section('Streaks', '', [
    runCard('Consecutive Titles', seasonRuns(finals.map(f => ({ key: f.champ, yr: f.yr }))), 2, 8, k => teamLink(k), histSpan, 'titles'),
    runCard('Consecutive Finals Appearances', seasonRuns(finals.flatMap(f => [{ key: f.champ, yr: f.yr }, { key: f.ru, yr: f.yr }])), 3, 8, k => teamLink(k), histSpan, 'Finals'),
    runCard('Consecutive MVPs', seasonRuns(DB.history.filter(h => h.MVP && h.MVP !== '-').map(h => ({ key: playerKey(h.MVP, h.Season), yr: Number(h.Season) }))), 2, 8, (k, yr) => nameLink(k, {season: yr}), histSpan, 'MVPs'),
    ...(yrs.length ? [
      runCard('Longest Playoff Streaks', seasonRuns(teamPlayoffEntries(true)), 3, 8, k => teamLink(k), `${teamSpan} · playoffs = top 8 in conference`),
      runCard('Longest Playoff Droughts', seasonRuns(teamPlayoffEntries(false)), 3, 8, k => teamLink(k), `${teamSpan} · playoffs = top 8 in conference`),
    ] : []),
  ]);

  // ----- Finals
  const appear = {};
  finals.forEach(f => { [[f.champ, 'w'], [f.ru, 'l']].forEach(([t, k]) => { appear[t] = appear[t] || { w: 0, l: 0 }; appear[t][k]++; }); });
  const appearRows = withRanks(Object.entries(appear).map(([t, v]) => ({ t, n: v.w + v.l, v })).sort((a,b) => b.n - a.n || b.v.w - a.v.w).slice(0, 10), r => r.n)
    .map(r => ({ rank: r.rank, main: teamLink(r.t), val: `${r.n}`, sub: `${r.v.w} won · ${r.v.l} lost` }));
  const pairs = {};
  finals.forEach(f => { const k = [f.champ, f.ru].sort().join('|'); (pairs[k] = pairs[k] || []).push(f.yr); });
  const pairRows = withRanks(Object.entries(pairs).filter(([, v]) => v.length >= 2).sort((a,b) => b[1].length - a[1].length || Math.max(...b[1]) - Math.max(...a[1])).slice(0, 8), ([, v]) => v.length)
    .map(r => ({ rank: r.rank, main: r[0].split('|').map(t => teamLink(t)).join(' vs '), val: `${r[1].length}×`, sub: r[1].sort((a,b) => b - a).map(y => seasonLink(y, String(y))).join(', ') }));
  const seriesList = (losses) => finals.filter(f => f.losses === losses).sort((a,b) => b.yr - a.yr)
    .map(f => ({ main: `${teamLink(f.champ)} over ${teamLink(f.ru)}`, val: '', sub: seasonLink(f.yr) }));
  const sweeps = seriesList(0), sevens = seriesList(3);
  section('Finals', histSpan ? `From NBA History, ${histSpan}` : '', [
    recordCard('Most Finals Appearances', appearRows),
    recordCard('Most Common Finals Matchups', pairRows, '', 'No repeat matchups yet.'),
    recordCard(`Sweeps (4-0) · ${sweeps.length}`, sweeps),
    recordCard(`Went to Game 7 (4-3) · ${sevens.length}`, sevens),
  ]);

  // ----- Dynasties
  const runRows = (len, minTitles) => withRanks(teamWindows(len).filter(r => r.titles >= minTitles).slice(0, 8), r => r.titles * 100 + r.finals)
    .map(r => ({ rank: r.rank, main: teamLink(r.team), val: `${r.titles} title${r.titles > 1 ? 's' : ''}`, sub: runLabel(r) }));
  const decadeRows = teamsOfDecades().map(({ d, best }) => ({ rank: `${d}s`, main: teamLink(best.team), val: `${best.titles} title${best.titles > 1 ? 's' : ''}`,
    sub: `${best.finals} Finals${best.w + best.l ? ` · ${best.w}-${best.l}` : ''}` }));
  section('Dynasties', histSpan ? `From NBA History, ${histSpan}` : '', [
    recordCard('Best 3-Season Runs', runRows(3, 2), '', 'No team has won 2 titles in 3 seasons yet.'),
    recordCard('Best 5-Season Runs', runRows(5, 2), '', 'No team has won 2 titles in 5 seasons yet.'),
    recordCard('Best 10-Season Runs', runRows(10, 3), '', 'No team has won 3 titles in 10 seasons yet.'),
    recordCard('Team of Each Decade', decadeRows).replace('rb-card', 'rb-card rb-years'),
  ]);

  // ----- Award doubles
  // One row per player: "3 times: 2077–78, 2076–77, 2059–60"
  const doubles = (a, b) => {
    const hits = DB.history.filter(h => samePlayer(h[a], h[b], h.Season)).sort((x,y) => y.Season - x.Season);
    const by = new Map();
    hits.forEach(h => { const k = playerKey(h[a], h.Season); if (!by.has(k)) by.set(k, []); by.get(k).push(h); });
    const groups = [...by.values()].map(seasons => ({ seasons })).sort((x,y) => y.seasons.length - x.seasons.length || y.seasons[0].Season - x.seasons[0].Season);
    const rows = withRanks(groups, g => g.seasons.length).map(({ rank, seasons: g }) => ({ rank, main: nameLink(g[0][a], {season: g[0].Season}), val: '',
      sub: (g.length > 1 ? `${g.length} times: ` : '') + g.map(h => seasonLink(h.Season)).join(', ') }));
    rows.total = hits.length; return rows;
  };
  const mvpFmvp = doubles('MVP', 'FMVP'), mvpDpoy = doubles('MVP', 'DPOY');
  const dblTitle = (label, r) => `${label} · ${r.total}` + (r.total !== r.length ? ` by ${r.length} players` : '');
  section('Award Doubles', histSpan ? `From NBA History, ${histSpan}` : '', [
    recordCard(dblTitle('MVP + Finals MVP (+ Title)', mvpFmvp), mvpFmvp),
    recordCard(dblTitle('MVP + DPOY', mvpDpoy), mvpDpoy, '', 'No player has won both in the same season yet.'),
  ]);

  // ----- Leader seasons
  const cats = [['Points per Game','PtsLeader','PtsTeam','PPG'],['Rebounds per Game','RebLeader','RebTeam','RPG'],['Assists per Game','AstLeader','AstTeam','APG'],
                ['Steals per Game','StlLeader','StlTeam','SPG'],['Blocks per Game','BlkLeader','BlkTeam','BPG'],['Minutes per Game','MinLeader','MinTeam','MPG']];
  // ----- Stat titles: who led the league most often (grows as Season Stat Leader fills in)
  const titleCats = [['Scoring Titles', 'PtsLeader'], ['Rebounding Titles', 'RebLeader'], ['Assists Titles', 'AstLeader'],
                     ['Steals Titles', 'StlLeader'], ['Blocks Titles', 'BlkLeader'], ['Minutes Titles', 'MinLeader']];
  const entered = DB.statLeaders.filter(statRowEntered).length;
  section('Stat Titles', entered ? `From Season Stat Leader · ${entered} season${entered === 1 ? '' : 's'} entered` : '', titleCats.map(([title, k]) => {
    const by = new Map();
    DB.statLeaders.filter(r => r[k]).forEach(r => { const key = playerKey(r[k], r.Season); if (!by.has(key)) by.set(key, []); by.get(key).push(r); });
    const groups = [...by.entries()].map(([key, rs]) => ({ key, rs: rs.sort((a, b) => b.Season - a.Season) })).sort((a, b) => b.rs.length - a.rs.length || b.rs[0].Season - a.rs[0].Season).slice(0, 8);
    return recordCard(title, withRanks(groups, g => g.rs.length).map(g => ({ rank: g.rank, main: nameLink(g.key, { season: g.rs[0].Season }), val: String(g.rs.length),
      sub: g.rs.map(r => seasonLink(r.Season)).join(', ') })), '', 'No seasons entered yet.');
  }));

  section('Leader Seasons', '', cats.map(([title, k, tk, unit]) => {
    const rows = DB.statLeaders.filter(r => r[k] && !isNaN(parseFloat(r[unit]))).map(r => ({ ...r, v: parseFloat(r[unit]) }));
    const top = withRanks(rows.sort((a,b) => b.v - a.v).slice(0, 10), r => r.v);
    return recordCard(title, top.map(r => ({ rank: r.rank, main: nameLink(r[k], {season: r.Season}), val: r.v.toFixed(1),
      sub: seasonLink(r.Season) + (r[tk] ? ' · ' + teamLink(r[tk]) : '') })), `Based on ${rows.length} season${rows.length === 1 ? '' : 's'} entered`, 'No seasons entered yet.');
  }));

  // A few headline records for the Home page
  homeHighlights = [];
  if (yrs.length) {
    const b = yrs.flatMap(yr => seasonStandings(yr).map(r => ({ ...r, yr }))).sort((x,y) => y.raw - x.raw)[0];
    homeHighlights.push({ label: 'Best record', main: teamLink(b.team), val: `${b.w}-${b.l}`, sub: seasonLink(b.yr) });
  }
  const titleRun = seasonRuns(finals.map(f => ({ key: f.champ, yr: f.yr }))).sort((x,y) => y.len - x.len || y.end - x.end)[0];
  if (titleRun?.len > 1) homeHighlights.push({ label: 'Longest title streak', main: teamLink(titleRun.key), val: `${titleRun.len} straight`, sub: spanLabel(titleRun) });
  if (yrs.length) {
    const live = seasonRuns(teamPlayoffEntries(true)).filter(r => r.end === latest).sort((x,y) => y.len - x.len)[0];
    if (live) homeHighlights.push({ label: 'Longest active playoff streak', main: teamLink(live.key), val: `${live.len} seasons`, sub: spanLabel(live) });
  }
  const mostFinals = Object.entries(appear).sort((x,y) => (y[1].w + y[1].l) - (x[1].w + x[1].l))[0];
  if (mostFinals) homeHighlights.push({ label: 'Most Finals appearances', main: teamLink(mostFinals[0]), val: `${mostFinals[1].w + mostFinals[1].l}`, sub: `${mostFinals[1].w} won · ${mostFinals[1].l} lost` });

  document.getElementById('recordsContent').innerHTML = out.join('');
}

// =====================================================================
// STAT LEADERS
// =====================================================================
let statState = { filtered: [], page: 1, perPage: 40, cat: 'Pts' };
const STAT_LEADER_KEYS = ['PtsLeader','RebLeader','AstLeader','StlLeader','BlkLeader','MinLeader'];
// Seasons are listed in the sheet before their leaders are typed in
function statRowEntered(s) { return STAT_LEADER_KEYS.some(k => s[k]); }
// One table per stat (tabs), so each fits a phone: Season, Leader, Team, value and which title it was
const STAT_CATS = [['Pts', 'Points', 'PPG'], ['Reb', 'Rebounds', 'RPG'], ['Ast', 'Assists', 'APG'], ['Stl', 'Steals', 'SPG'], ['Blk', 'Blocks', 'BPG'], ['Min', 'Minutes', 'MPG']];
function setStatCat(k) { statState.cat = k; filterStat(); }
function filterStat() {
  const cat = statState.cat || 'Pts', [, label, unit] = STAT_CATS.find(c => c[0] === cat);
  document.getElementById('statCatTabs').innerHTML = STAT_CATS.map(([k, l]) => `<button class="${k === cat ? 'active' : ''}" onclick="setStatCat('${k}')">${l}</button>`).join('');
  const q = document.getElementById('statSearch').value.toLowerCase();
  const has = s => !!s[cat + 'Leader'];
  const matches = DB.statLeaders.filter(s => !q || String(s.Season).includes(q) || seasonLabel(s.Season).includes(q) || String(s[cat + 'Leader'] || '').toLowerCase().includes(q));
  const showMissing = document.getElementById('statShowMissing')?.checked;
  statState.filtered = showMissing ? matches : matches.filter(has);
  statState.page = 1;
  // Seasons marked "-" (stat not tracked yet) aren't missing data
  const entered = matches.filter(has).length, untracked = matches.filter(s => s[cat + 'NA']).length, missing = matches.length - entered - untracked;
  document.getElementById('statCount').textContent = `${entered} seasons with a ${label.toLowerCase()} leader` + (missing ? ` · ${missing} not entered` : '') + (untracked ? ` · not tracked before ${seasonLabel(Math.max(...matches.filter(s => s[cat + 'NA']).map(s => Number(s.Season))) + 1)}` : '');
  renderStat();
}
function renderStat() {
  const { filtered, page, perPage } = statState;
  const cat = statState.cat || 'Pts', [, label, unit] = STAT_CATS.find(c => c[0] === cat);
  // Which title of the player's career each one was (counted oldest first)
  const nth = new Map(), seen = {};
  [...DB.statLeaders].filter(s => s[cat + 'Leader']).sort((a, b) => a.Season - b.Season).forEach(s => {
    const k = playerKey(s[cat + 'Leader'], s.Season); seen[k] = (seen[k] || 0) + 1; nth.set(s, seen[k]); });
  const fmt = v => { const n = parseFloat(v); return isNaN(n) ? '—' : Number.isInteger(n) ? n.toFixed(1) : String(n); };
  const sorted = [...filtered].sort((a, b) => getNum(b.Season) - getNum(a.Season));
  const slice = sorted.slice((page - 1) * perPage, page * perPage);
  document.getElementById('statHead').innerHTML = `<th class="stick-1">Season</th><th>${label} Leader</th><th>Team</th><th class="num">${unit}</th><th class="num">Title</th>`;
  document.getElementById('statBody').innerHTML = slice.map(s => !s[cat + 'Leader']
    ? `<tr class="row-pending"><td class="stick-1">${seasonLink(s.Season)}</td><td colspan="4">${s[cat + 'NA'] ? 'Not tracked yet' : 'Not entered yet'}</td></tr>`
    : `<tr><td class="stick-1">${seasonLink(s.Season)}</td><td style="font-weight:600">${nameLink(s[cat + 'Leader'], { season: s.Season })}</td>
      <td class="team-tag">${teamLink(s[cat + 'Team'])}</td><td class="num highlight">${fmt(s[unit])}</td>
      <td class="num">${nth.get(s) > 1 ? `<b>${ordinal(nth.get(s))}</b>` : '1st'}</td></tr>`).join('');
  renderPag('statPag', filtered.length, perPage, page, 'goStatPage');
}
function goStatPage(p) { statState.page = p; renderStat(); }

// =====================================================================
// CURRENT PLAYERS
// =====================================================================
let curState = { filtered: [], page: 1, perPage: 30 };
function filterCurrent() {
  const q = document.getElementById('curSearch').value.toLowerCase();
  const pos = document.getElementById('curPosFilter').value;
  curState.filtered = DB.currentPlayers.filter(p =>
    (!q || String(p.Player||'').toLowerCase().includes(q)) &&
    (!pos || p.Position === pos) && playerMatchesFilters(p, 'cur'));
  curState.page = 1;
  document.getElementById('curCount').textContent = curState.filtered.length + ' players';
  // Set subtitle with season
  if (DB.latestSeason) document.getElementById('currentSub').textContent = `Active Players — Season ${seasonLabel(DB.latestSeason)}`;
  renderCurrent();
}
// Global so the header's inline onclick handlers can reach it
function onSortCur(col) {
  toggleSortState('cur', col);
  curState.page = 1;
  renderCurrent();
}
function renderCurrent() {
  const { filtered, page, perPage } = curState;
  const curSI = col => { const s2 = sortStates.cur||{}; return s2.col===col?(s2.dir>0?' ↑':' ↓'):''; };
  document.getElementById('curHead').innerHTML = `
    <th class="stick-1" onclick="onSortCur('Player')">Player${curSI('Player')}</th>
    <th>Pos</th>
    <th onclick="onSortCur('Season')">Season${curSI('Season')}</th>
    <th class="num" onclick="onSortCur('Exp')">Exp${curSI('Exp')}</th>
    <th class="num" onclick="onSortCur('Finals App')">Finals${curSI('Finals App')}</th>
    <th class="num" onclick="onSortCur('MVP')">MVP${curSI('MVP')}</th>
    <th class="num" onclick="onSortCur('Champions')">Champ${curSI('Champions')}</th>
    <th class="num" onclick="onSortCur('FMVP')">FMVP${curSI('FMVP')}</th>
    <th class="num" onclick="onSortCur('All Stars')">All-Stars${curSI('All Stars')}</th>
    <th class="num" onclick="onSortCur('All NBA Team')">All-NBA${curSI('All NBA Team')}</th>
    <th class="num" onclick="onSortCur('1st Team')">1st${curSI('1st Team')}</th>
    <th class="num" onclick="onSortCur('2nd Team')">2nd${curSI('2nd Team')}</th>
    <th class="num" onclick="onSortCur('3rd Team')">3rd${curSI('3rd Team')}</th>
    <th class="num" onclick="onSortCur('1st D Team')">1st-D${curSI('1st D Team')}</th>
    <th class="num" onclick="onSortCur('2nd D Team')">2nd-D${curSI('2nd D Team')}</th>
    <th class="num" onclick="onSortCur('DPOY')">DPOY${curSI('DPOY')}</th>
    <th>ROTY</th>
    <th onclick="onSortCur('Other Award')">Other${curSI('Other Award')}</th>
    <th>Teams</th>`;
  // Sort current players
  const curS = sortStates.cur || {col:'Season', dir:1};
  const curSorted = [...curState.filtered].sort((a,b) => {
    const av = a[curS.col], bv = b[curS.col];
    const an = parseFloat(av), bn = parseFloat(bv);
    if (!isNaN(an) && !isNaN(bn)) return (an - bn) * curS.dir;
    return String(av||'').localeCompare(String(bv||'')) * curS.dir;
  });
  const curSlice = curSorted.slice((curState.page-1)*curState.perPage, curState.page*curState.perPage);
  document.getElementById('curBody').innerHTML = curSlice.map(p => {
    const other = p['Other Award'];
    const roty = p.ROTY === 'O' || p.ROTY === 'o';
    const teams = [];
    for (let i=1;i<=6;i++){const k=i===1?'Team':'Team'+i; if(p[k])teams.push(p[k]);}
    return `<tr>
      <td class="stick-1">${plink(p.Player||'—')}</td>
      <td>${posBadge(p.Position)}</td>
      <td class="muted">${p.Season||'—'}</td>
      <td class="num">${p.Exp||'—'}</td>
      <td class="num">${p['Finals App']||0}</td>
      <td class="num">${p.MVP||0}</td>
      <td class="num">${p.Champions||0}</td>
      <td class="num">${p.FMVP||0}</td>
      <td class="num">${p['All Stars']||0}</td>
      <td class="num">${p['All NBA Team']||0}</td>
      <td class="num">${p['1st Team']||0}</td>
      <td class="num">${p['2nd Team']||0}</td>
      <td class="num">${p['3rd Team']||0}</td>
      <td class="num">${p['1st D Team']||0}</td>
      <td class="num">${p['2nd D Team']||0}</td>
      <td class="num">${p.DPOY||0}</td>
      <td>${roty?'Yes':'<span class="muted">—</span>'}</td>
      <td class="muted">${other&&other!=='/'&&other!==0?other:'—'}</td>
      <td>${[...new Set(teams)].map(t=>`<span class="team-tag">${teamLink(t)}</span>`).join(' ')}</td>
    </tr>`;
  }).join('');
  document.getElementById('curCards').innerHTML = curSlice.map(p => playerCard(p, null, 'total', true)).join('');
  renderPag('curPag', filtered.length, perPage, page, 'goCurPage');
}
function goCurPage(p) { curState.page = p; renderCurrent(); }

// =====================================================================
// ALL-NBA TEAMS
// =====================================================================
let allNbaState = { filtered: [], page: 1, perPage: 8 };
function filterAllNba() {
  const q = document.getElementById('allnbaSearch').value.toLowerCase();
  allNbaState.filtered = DB.allNbaSeasons.filter(s =>
    !q || String(s.season).includes(q) ||
    s.teams.some(t => t.slots.some(sl => sl.player.toLowerCase().includes(q))));
  allNbaState.page = 1;
  renderAllNba();
}
function allNbaTeamsHtml(s) {
  return s.teams.map(t => `<div class="allnba-team-row">
    <div class="allnba-team-label">${['1ST TEAM','2ND TEAM','3RD TEAM'][t.team-1]||t.team+'TH'}</div>
    <div>${t.slots.map(sl => `<div class="allnba-slot">
      <span class="allnba-pos">${sl.pos}</span>
      <span class="allnba-player">${nameLink(sl.player, {season: s.season})}</span>
    </div>`).join('')}</div>
  </div>`).join('');
}
function renderAllNba() {
  const { filtered, page, perPage } = allNbaState;
  const slice = filtered.slice((page-1)*perPage, page*perPage);
  document.getElementById('allNbaContent').innerHTML = slice.map(s => `
    <div class="allnba-season">
      <div class="allnba-season-title">${seasonLink(s.season, 'Season ' + seasonLabel(s.season))}</div>
      ${allNbaTeamsHtml(s)}
    </div>`).join('');
  renderPag('allNbaPag', filtered.length, perPage, page, 'goAllNbaPage');
}
function goAllNbaPage(p) { allNbaState.page = p; renderAllNba(); }

// =====================================================================
// DECADE TEAMS
// =====================================================================
function formatDecadeVal(v) {
  if (!v) return '';
  const s = String(v);
  const m = s.match(/^(.+?)\s*\((\d+)\)\s*$/);
  if (m) return `<span style="display:flex;justify-content:space-between;align-items:center;gap:12px;"><span>${m[1].trim()}</span><span class="di-count">${m[2]}&#215;</span></span>`;
  return `<span>${s}</span>`;
}
function decadeInfoItem(label, vals) {
  const validVals = (vals||[]).filter(Boolean);
  if (!validVals.length) return '';
  return `<div class="decade-info-item">
    <div class="di-label">${label}</div>
    <div class="di-val">${validVals.map(v=>formatDecadeVal(v)).join('')}</div>
  </div>`;
}
function initDecades() {
  document.getElementById('decadeGrid').innerHTML = DB.decades.map(d => {
    const chip = (name, cls, posLabel) => {
      const p = resolvePlayer(name);
      const click = p ? ` onclick="openPlayerModal('${jsArg(p.Player)}')"` : '';
      const title = p && p.Player !== name ? ` title="${p.Player}"` : '';
      const pos = posLabel ? `<span class="chip-pos">${posLabel}</span>` : '';
      return `<div class="decade-chip ${cls}${p ? '' : ' unlinked'}"${click}${title}>${pos}${name}</div>`;
    };
    const starterHtml = d.starter.map((name, i) => chip(name, 'starter', d.positions[i])).join('');
    const subHtml = d.subs.map(name => chip(name, 'sub')).join('');
    const infoHtml = [
      decadeInfoItem('Best Franchise', [d.info.franchise1, d.info.franchise2].filter(Boolean)),
      decadeInfoItem('Decade MVP', d.info.mvpList || []),
      decadeInfoItem('Decade DPOY', d.info.dotyList || []),
    ].join('');
    return `<div class="decade-card">
      <div class="decade-name">${d.decade}${d.era?' — '+d.era:''}</div>
      ${d.starter.length ? `<div class="decade-label">Starting Five</div><div class="decade-player-chips">${starterHtml}</div>` : ''}
      ${d.subs.length ? `<div class="decade-label">Bench</div><div class="decade-player-chips">${subHtml}</div>` : ''}
      ${infoHtml ? `<div class="decade-info">${infoHtml}</div>` : ''}
    </div>`;
  }).join('');
}
