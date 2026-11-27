// 2K17 NBA Stats Database · Franchises list, team page, folding cards, dynasties and the wins chart.
// Loaded in order by index.html; all files share one global scope.

// =====================================================================
// TEAMS
// =====================================================================
// Franchises can be sorted high-to-low or low-to-high on any of the menu's measures
let teamSortDir = -1;
// All-time regular-season record over every season the franchise has (Team History + Team Record)
function allTimeRecord(t) {
  let w = 0, l = 0;
  Object.values(t.seasonRecords || {}).forEach(r => { w += r.w || 0; l += r.l || 0; });
  return { w, l, pct: w + l ? w / (w + l) : null, seasons: Object.keys(t.seasonRecords || {}).length };
}
function teamSortVal(t, sc) {
  // Win %: franchises with under 10 seasons sort after the rest, so one good season can't top the list
  if (sc === '_allPct') { const a = allTimeRecord(t); if (a.pct === null) return -Infinity; return a.seasons < 10 ? (teamSortDir < 0 ? a.pct - 10 : a.pct + 10) : a.pct; }
  if (sc === '_allWins') return allTimeRecord(t).w;
  if (sc === '_lastWins') { const r = DB.latestSeason && t.seasonRecords?.[DB.latestSeason]; return r ? r.rawW : -Infinity; }
  const v = getNum(t[sc]); return v === -Infinity ? (teamSortDir < 0 ? -Infinity : Infinity) : v;
}
function flipTeamSort() {
  teamSortDir = -teamSortDir;
  document.getElementById('teamSortDir').textContent = teamSortDir < 0 ? '↓ High first' : '↑ Low first';
  filterTeams();
}
function filterTeams() {
  const q = document.getElementById('teamSearch').value.toLowerCase();
  const conf = document.getElementById('teamConfFilter').value;
  const sc = document.getElementById('teamSortFilter').value || 'Glory Score';
  const arr = DB.teams.filter(t => t.Team && !t.defunct &&
    (!q || String(t.Team).toLowerCase().includes(q)) &&
    (!conf || t.Conference === conf)).sort((a, b) => (teamSortVal(a, sc) - teamSortVal(b, sc)) * teamSortDir || a.Team.localeCompare(b.Team));
  const latest = DB.latestSeason;
  const st = latest ? seasonStandings(latest) : [];
  const fmt1dp = v => (v !== null && v !== undefined && v !== '—' && !isNaN(parseFloat(v))) ? parseFloat(v).toFixed(1) : '—';
  const avgSpan = v => `<strong class="${parseFloat(v||0) >= 41 ? 'rec-win' : 'rec-loss'}">${fmt1dp(v)}</strong>`;
  document.getElementById('teamGrid').innerHTML = arr.map(t => {
    const r = st.find(x => x.team === t.Team);
    return `<div class="team-card" onclick="openTeamModal('${jsArg(t.Team)}')">
      <div class="team-card-head">${teamLogo(t.Team, 'tlogo-md')}<div class="team-name">${t.Team}</div></div>
      <div class="team-card-meta">
        <span class="conf-badge">${t.Conference||'—'}</span>
        ${r ? `<span class="team-rank">#${r.confRk} in ${t.Conference === 'EAST' ? 'East' : 'West'} · #${r.leagueRk} in league</span>` : ''}
      </div>
      <div class="team-meta">Est. ${t['Est. Date']||'—'} · Glory Score ${t['Glory Score']||0}</div>
      ${(() => { const a = allTimeRecord(t); return a.pct === null ? '' : `<div class="team-meta team-alltime${/^_all/.test(sc) ? ' on' : ''}">All-time <b>${a.w.toLocaleString()}-${a.l.toLocaleString()}</b> · <b>${a.pct.toFixed(3).replace(/^0/, '')}</b> · ${a.seasons} season${a.seasons === 1 ? '' : 's'}</div>`; })()}
      <div class="team-stats-row">
        <div class="team-stat"><div class="tv">${t.Championship||0}</div><div class="tl">Titles</div></div>
        <div class="team-stat"><div class="tv">${t['Conference Titles']||0}</div><div class="tl">Conf</div></div>
        <div class="team-stat"><div class="tv">${t.Playoffs||0}</div><div class="tl">Playoffs</div></div>
        <div class="team-stat"><div class="tv ${r ? recClass(r.w, r.l) : ''}">${r ? r.w+'-'+r.l : t['Last Title']||'—'}</div><div class="tl">${r ? seasonLabel(latest) : 'Last Title'}</div></div>
      </div>
      <div class="team-avgs">Avg. wins <span class="nowrap">5 yrs ${avgSpan(t['Avg. W Last 5Y'])}</span> · <span class="nowrap">10 yrs ${avgSpan(t['Avg. W Last 10Y'])}</span></div>
    </div>`;
  }).join('');
}

// =====================================================================
// TEAM PAGE (replaces the old team popup; every team link lands here)
// =====================================================================
let teamState = { t: null, tab: 'home' };
// Kept under its old name because every team link in the app calls it
function openTeamModal(teamName, fromHistory) {
  const t = DB.teams.find(x => x.Team === teamName);
  if (!t) return;
  noteRecent('team', teamName); queueBalance();
  closeModal();
  closeSearch();
  teamState.t = t.Team; teamState.tab = 'home';
  const hash = '#team-' + playerSlug(t.Team);
  if (!fromHistory && location.hash !== hash) history.pushState(null, '', hash);
  renderTeamPage();
  showSection('team');
  window.scrollTo(0, 0);
  renderWinChart();
}
function openTeamFromHash() {
  const m = location.hash.match(/^#team-(.+)$/);
  if (!m) return false;
  const t = DB.teams.find(x => playerSlug(x.Team) === m[1]);
  if (!t) return false;
  openTeamModal(t.Team, true);
  return true;
}
function teamBack() {
  if (history.length > 1) history.back();
  else showSection('teams');
}
// Retired numbers for a team: the Retired # tab (real life, with years and coaches/others)
// joined with the "# Retired" columns of All Players; a number shows once per person
function retiredForTeam(teamName) {
  const out = [], seen = new Set(), key = (num, who) => String(num).replace(/\D/g, '') + '|' + normName(who);
  (DB.retiredList || []).forEach(r => {
    const t = teamByCode(r.code);
    if (!t || t.Team !== teamName) return;
    const p = r.type === 'Player' ? resolveRetired(r) : null;
    seen.add(key(r.num, p ? p.Player : r.who));
    out.push({ num: r.num, player: p ? p.Player : r.who, linked: !!p, type: r.type, years: r.years });
  });
  return out.concat(retiredFromPlayers(teamName).filter(r => !seen.has(key(r.num, r.player))).map(r => ({ ...r, linked: true, type: 'Player' })));
}
function retiredFromPlayers(teamName) {
  const out = [];
  DB.allPlayers.forEach(p => {
    ['# Retired', '# Retired2', '# Retired3'].forEach(k => {
      const v = p[k];
      if (!v || v === 0 || v === '/') return;
      const [num, abbr] = String(v).trim().split(' ');
      if (abbr && (fullTeamName(abbr) === teamName || abbr === teamName)) out.push({ num, player: p.Player });
    });
  });
  return out;
}
// Trophy cabinet: individual awards won by the franchise's players while with it (NBA History
// logos, Season Stat Leader teams), grouped by player with the seasons. Titles and Finals MVPs
// are left out: the header and Finals History already show them, and Finals MVPs match titles
function trophyCabinet(teamName, titles, finals, divTitles = 0) {
  const groups = [];
  const collect = (label, entries) => {
    const by = new Map();
    entries.forEach(({ name, yr }) => { const k = playerKey(name, yr); if (!by.has(k)) by.set(k, { name, yrs: [] }); by.get(k).yrs.push(yr); });
    const list = [...by.values()].sort((a, b) => b.yrs.length - a.yrs.length || Math.max(...b.yrs) - Math.max(...a.yrs));
    if (entries.length) groups.push({ label, n: entries.length, list });
  };
  const hist = k => DB.history.filter(h => h[k] && h[k] !== '-' && h[k + 'Team'] === teamName).flatMap(h => coNames(h[k]).map(name => ({ name, yr: Number(h.Season) })));
  collect('MVP', hist('MVP')); collect('DPOY', hist('DPOY')); collect('Rookie of the Year', hist('ROTY'));
  [['Pts', 'Scoring title'], ['Reb', 'Rebounding title'], ['Ast', 'Assists title'], ['Stl', 'Steals title'], ['Blk', 'Blocks title']].forEach(([k, l]) =>
    collect(l, DB.statLeaders.filter(r => r[k + 'Leader'] && teamByCode(r[k + 'Team'])?.Team === teamName).map(r => ({ name: r[k + 'Leader'], yr: Number(r.Season) }))));
  if (!groups.length && !divTitles) return '';
  const tiles = [['Division titles', divTitles], ...groups.filter(g => !/title$/.test(g.label)).map(g => [g.label === 'Rookie of the Year' ? 'ROTY' : g.label, g.n]),
    ['Stat titles', groups.filter(g => /title$/.test(g.label)).reduce((a, g) => a + g.n, 0)]].filter(([, v]) => v > 0);
  return `<div class="chart-card tc-card"><div class="chart-title">${icon('trophy', 'ic-champ')} Trophy Cabinet</div>
    <div class="tc-tiles fold-keep">${tiles.map(([l, v]) => `<div class="tc-tile"><b>${v}</b><span>${l}</span></div>`).join('')}</div>
    ${groups.map(g => `<div class="tc-group"><div class="tc-label">${g.n > 1 ? (g.label === 'Rookie of the Year' ? 'Rookies of the Year' : g.label + 's') : g.label} <span class="muted">${g.n}</span></div>
      <div class="tc-list">${g.list.map(x => `<span class="tc-item">${nameLink(x.name, { season: x.yrs[0] })}${x.yrs.length > 1 ? ` <b>×${x.yrs.length}</b>` : ''} <span class="muted">${x.yrs.sort((a, b) => a - b).map(y => seasonLabel(y)).join(', ')}</span></span>`).join('')}</div></div>`).join('')}
  </div>`;
}
function renderTeamPage() {
  const teamName = teamState.t, t = DB.teams.find(x => x.Team === teamName);
  if (!t) return;
  const finals = DB.history.map(h => ({ yr: Number(h.Season), ...finalsTeams(h.Season) })).filter(f => !isNaN(f.yr));
  const won = finals.filter(f => f.champ === teamName).map(f => f.yr);
  const lost = finals.filter(f => f.ru === teamName).map(f => f.yr);
  const seasons = Object.keys(t.seasonRecords || {}).map(Number).sort((a, b) => b - a);
  const seasonInfo = seasons.map(yr => {
    const r = seasonStandings(yr).find(x => x.team === teamName);
    // cw = wins scaled to 82 games, so older shorter seasons sit right on the wins chart
    return { yr, w: r.w, l: r.l, pct: r.w / Math.max(r.w + r.l, 1), cw: r.w / Math.max(r.w + r.l, 1) * 82, conf: r.conf, label: r.label,
      confRk: r.confRk, leagueRk: r.leagueRk, isChamp: won.includes(yr), isRU: lost.includes(yr), madePlayoffs: r.playoffs };
  });
  const totW = seasonInfo.reduce((a, s) => a + s.w, 0), totL = seasonInfo.reduce((a, s) => a + s.l, 0);
  const firstHist = finals.length ? Math.min(...finals.map(f => f.yr)) : null;
  const earlier = Math.max(0, (Number(t.Championship) || 0) - won.length);
  const parts = [];

  parts.push(teamHeroHtml(t, won, lost));

  // Latest season at a glance, then the franchise's numbers with their league rank
  const C = {};
  C.lineup = franchiseLineupHtml(teamName);
  // Finals history, newest first
  const fin = [...won.map(yr => ({ yr, w: true })), ...lost.map(yr => ({ yr, w: false }))].sort((a, b) => b.yr - a.yr);
  if (fin.length || earlier) C.finals = (`<div class="chart-card"><div class="chart-title">${icon('trophy', 'ic-champ')} Finals History</div>
    <div class="fin-chips">${fin.map(f => `<span class="fin-chip ${f.w ? 'won' : 'lost'}" onclick="openSeason(${f.yr})" role="button" tabindex="0" title="${f.w ? 'Won' : 'Lost'} the ${seasonLabel(f.yr)} Finals">${icon('trophy', f.w ? 'ic-champ' : 'ic-silver')} ${seasonLabel(f.yr)}</span>`).join('')}</div>
    <div class="fin-key"><span>${icon('trophy', 'ic-champ')} Won ${won.length}</span><span>${icon('trophy', 'ic-silver')} Lost ${lost.length}</span>${t['Last Title'] && t['Last Title'] !== '-' ? `<span>Last title ${t['Last Title']}</span>` : ''}${earlier ? `<span>+${earlier} title${earlier > 1 ? 's' : ''} before ${seasonLabel(firstHist)}</span>` : ''}</div></div>`);
  // Finals record against each opponent
  const rivals = {};
  finals.filter(f => f.champ === teamName || f.ru === teamName).forEach(f => {
    const opp = f.champ === teamName ? f.ru : f.champ;
    if (!opp) return;
    const r = (rivals[opp] = rivals[opp] || { w: 0, l: 0, games: [] });
    if (f.champ === teamName) r.w++; else r.l++;
    r.games.push({ yr: f.yr, won: f.champ === teamName });
  });
  const rivalRows = Object.entries(rivals).sort((a, b) => (b[1].w + b[1].l) - (a[1].w + a[1].l) || b[1].w - a[1].w || Math.max(...b[1].games.map(g => g.yr)) - Math.max(...a[1].games.map(g => g.yr)));
  if (rivalRows.length) C.rivals = (`<div class="chart-card rb-card"><div class="chart-title">${icon('trophy', 'ic-champ')} Finals Rivalries</div>
    ${rivalRows.map(([opp, r]) => `<div class="rb-row"><span class="rb-rank"></span><span class="rb-main">${teamLink(opp)}</span>
      <span class="rb-val ${r.w > r.l ? 'rec-win' : r.w < r.l ? 'rec-loss' : ''}">${r.w}-${r.l}</span>
      <span class="rb-sub">${r.games.sort((a, b) => b.yr - a.yr).map(g => `<span class="nowrap">${icon('trophy', g.won ? 'ic-champ' : 'ic-silver')}${seasonLink(g.yr)}</span>`).join(' · ')}</span></div>`).join('')}</div>`);
  C.legends = `<div class="chart-card">${legendsHtml(t.Team)}</div>`;
  if (seasonInfo.length >= 2) C.wins = (`<div class="chart-card"><div class="chart-title">${icon('line')} Wins per Season</div>
    <div class="wc-key"><span><i class="wc-dot champ"></i>Champion</span><span><i class="wc-dot silver"></i>Lost Finals</span><span><i class="wc-rule"></i>.500 (41 wins)</span></div>
    <div class="seg wc-range" id="winRange"></div>
    <div class="win-chart" id="winChart"></div></div>`);
  const latestLine = [t['Est. Date'] ? `Since ${t['Est. Date']}` : '', `${seasonInfo.length} seasons recorded`].filter(Boolean).join(' · ');
  if (seasonInfo.length) C.sbs = (`<div class="chart-card"><div class="chart-title">${icon('calendar')} Season by Season</div>
    ${latestLine ? `<p class="sbs-latest fold-keep">${latestLine}</p>` : ''}
    <div class="season-scroll"><table class="standings-table">
      <thead><tr><th>Season</th><th class="num">Record</th><th class="num">Conf</th><th class="num">League</th><th class="num">Win%</th><th>Result</th></tr></thead>
      <tbody>${seasonInfo.map(si => `<tr class="${si.isChamp ? 'row-champ' : si.isRU ? 'row-ru' : si.madePlayoffs ? 'row-playoff' : ''}">
        <td>${seasonLink(si.yr)}${si.label ? `<div class="muted st-era">${si.label}</div>` : ''}</td><td class="num ${recClass(si.w, si.l)}">${si.w}-${si.l}</td>
        <td class="num">${si.confRk > 0 ? '#' + si.confRk : '—'}</td><td class="num">${si.leagueRk > 0 ? '#' + si.leagueRk : '—'}</td>
        <td class="num">${si.pct.toFixed(3).replace(/^0/, '')}</td>
        <td>${resultMark(si.isChamp, si.isRU, true) || (si.madePlayoffs ? '<span class="muted">Playoffs</span>' : '')}</td></tr>`).join('')}</tbody>
    </table></div></div>`);

  // Side column: trophy cabinet, best run, best and worst seasons, retired numbers, active players
  const cabinet = trophyCabinet(teamName, won.length, won.length + lost.length, Number(t['Division Titles']) || 0);
  if (cabinet) C.cabinet = (cabinet);
  const runs = [3, 5, 10].map(len => ({ len, r: teamWindows(len).find(x => x.team === teamName) })).filter(x => x.r);
  if (runs.length) C.runs = (`<div class="chart-card rb-card"><div class="chart-title">${icon('star')} Best Runs</div>
    ${runs.map(({ len, r }) => `<div class="rb-row"><span class="rb-rank"></span><span class="rb-main">${len} seasons</span><span class="rb-val">${r.titles} title${r.titles > 1 ? 's' : ''}</span>
      <span class="rb-sub">${runLabel(r)}</span></div>`).join('')}
    <button class="card-link" onclick="showSection('records');setTimeout(()=>document.getElementById('rb-dynasties')?.scrollIntoView(),50)">All dynasties</button></div>`);
  const seasonRow = si => `<div class="rb-row"><span class="rb-rank"></span><span class="rb-main">${seasonLink(si.yr)}</span><span class="rb-val">${si.w}-${si.l}</span>
    <span class="rb-sub">${si.isChamp ? 'Won the title' : si.isRU ? 'Conf. Champion' : si.madePlayoffs === false ? `Missed the playoffs (#${si.confRk})` : `#${si.confRk} in the ${confName(si.conf)}`}${si.label ? ` · ${si.label}` : ''}</span></div>`;
  if (seasonInfo.length) {
    C.bw = (`<div class="chart-card rb-card bw-card"><div class="card-head"><div class="chart-title">${icon('calendar')} Best &amp; Worst Seasons</div>
      <div class="seg"><button class="active" onclick="bwSwitch(this, 'best')">Best</button><button onclick="bwSwitch(this, 'worst')">Worst</button></div></div>
      <div class="bw-list" data-list="best">${[...seasonInfo].sort((a, b) => b.pct - a.pct || b.w - a.w || b.yr - a.yr).slice(0, 5).map(seasonRow).join('')}</div>
      <div class="bw-list" data-list="worst" hidden>${[...seasonInfo].sort((a, b) => a.pct - b.pct || a.w - b.w || b.yr - a.yr).slice(0, 5).map(seasonRow).join('')}</div></div>`);
  }
  const retired = retiredForTeam(teamName);
  const jerseys = retired.filter(r => r.type === 'Player'), others = retired.filter(r => r.type !== 'Player');
  const byNum = (a, b) => (parseInt(a.num) || 999) - (parseInt(b.num) || 999);
  if (retired.length) C.retired = (`<div class="chart-card"><div class="chart-title">${icon('jersey')} Retired Numbers <span class="muted">${retired.length}</span></div>
    <div class="chip-row">${jerseys.sort(byNum).map(r => `<div class="jersey" ${r.years ? `title="${r.years}"` : ''}><div class="jersey-num">${r.num}</div>
      <div class="jersey-name">${r.linked ? nameLink(r.player) : `<span class="name-plain">${r.player}</span>`}</div>${r.years ? `<div class="jersey-years">${r.years}</div>` : ''}</div>`).join('')}</div>
    ${others.length ? `<div class="jersey-others"><div class="jo-title">Also honored</div>${others.map(r => `<div class="jo-row"><b>${r.num && r.num !== '—' ? r.num : '—'}</b> ${r.player} <span class="muted">${r.type}${r.years ? ' · ' + r.years : ''}</span></div>`).join('')}</div>` : ''}</div>`);
  const activeHere = DB.currentPlayers.filter(p => { const ts = playerTeams(p); return ts[ts.length - 1] === teamName; })
    .sort((a, b) => legacy(b).total - legacy(a).total);
  // Players whose first listed team is this one
  const startedHere = everyPlayer().filter(p => playerTeams(p)[0] === teamName).sort((a, b) => legacy(b).total - legacy(a).total);
  if (startedHere.length) {
    const row = (p, i, attr = '') => {
      const span = careerSpan(p.Season), teams = [...new Set(playerTeams(p))];
      const stay = teams.length === 1 ? 'One-team career' : `Then ${teams.slice(1).map(x => teamLink(x)).join(', ')}`;
      return `<div class="rb-row"${attr}><span class="rb-rank">${posBadge(p.Position)}</span><span class="rb-main">${nameLink(p.Player)}${isActive(p) ? ' <span class="muted">active</span>' : ''}</span>
        <span class="rb-val rb-val-sm">${span ? seasonLabel(span[0]) : ''}</span><span class="rb-sub">${stay}</span></div>`;
    };
    C.started = (`<div class="chart-card rb-card"><div class="chart-title">${icon('people')} Started Here</div>
      ${startedHere.slice(0, 8).map(p => row(p)).join('')}
      ${startedHere.slice(8).map((p, i) => row(p, i, ` class="fill-x" data-dup="st${i}" hidden`).replace('<div class="rb-row" class="fill-x"', '<div class="rb-row fill-x"')).join('')}
      ${startedHere.length > 8 ? `<details class="more-legends" data-dups><summary data-label="{n} more players who started here">${startedHere.length - 8} more players who started here</summary>${startedHere.slice(8).map((p, i) => row(p, i, ` data-dupof="st${i}"`)).join('')}</details>` : ''}
      <div class="muted" style="font-size:12px;margin-top:6px">First team on the player's row · season = their first</div></div>`);
  }
  if (activeHere.length) C.active = (`<div class="chart-card rb-card"><div class="chart-title">${icon('people')} Active Players Here</div>
    ${activeHere.map(p => `<div class="rb-row"><span class="rb-rank">${posBadge(p.Position)}</span><span class="rb-main">${nameLink(p.Player)}</span><span class="rb-val">${p['All Stars'] || 0}</span>
      <span class="rb-sub">${draftCareer(p)}</span></div>`).join('')}<div class="muted" style="font-size:12px;margin-top:6px">Last team listed on their row · number = All-Star selections</div></div>`);

  C.home = teamHomeHtml(t, seasonInfo, won, lost);
  // Each tab is its own short page; the team always opens on Home
  const grid = (m, sd) => `<div class="player-grid"><div>${m.filter(Boolean).join('')}</div><div>${sd.filter(Boolean).join('')}</div></div>`;
  const tabs = {
    home: C.home,
    seasons: grid([C.wins, C.sbs], [C.bw, C.runs]),
    players: (C.lineup || '') + grid([C.legends, teamDecadesHtml(teamName)], [C.retired, C.started, C.active]),
    trophies: grid([C.finals, C.rivals], [C.cabinet]),
  };
  parts.push(Object.entries(tabs).map(([k, html]) => `<div class="tm-tab" data-tab="${k}"${k === teamState.tab ? '' : ' hidden'}>${html}</div>`).join(''));
  const tp = document.getElementById('teamPage');
  tp.innerHTML = parts.join('');
  finishTeamHero(tp);
  winChartData = { team: t, seasons: [...seasonInfo].reverse() };
}

// =====================================================================
// TEAM HEADER: the team's colour behind its logo, the franchise numbers with
// their rank among all franchises, and buttons that jump to each section
// =====================================================================
// Main colours of the 30 teams, the darker one where the main colour is too light for white text
const TEAM_COLORS = {
  'Atlanta Hawks': '#C8102E', 'Boston Celtics': '#007A33', 'Brooklyn Nets': '#1F1F1F', 'Charlotte Hornets': '#1D1160', 'Chicago Bulls': '#CE1141',
  'Cleveland Cavaliers': '#860038', 'Dallas Mavericks': '#00538C', 'Denver Nuggets': '#0E2240', 'Detroit Pistons': '#1D42BA', 'Golden State Warriors': '#1D428A',
  'Houston Rockets': '#BA2A35', 'Indiana Pacers': '#002D62', 'Los Angeles Clippers': '#1B2148', 'Los Angeles Lakers': '#552583', 'Memphis Grizzlies': '#12173F',
  'Miami Heat': '#98002E', 'Milwaukee Bucks': '#00471B', 'Minnesota Timberwolves': '#236192', 'New Orleans Pelicans': '#0C2340', 'New York Knicks': '#006BB6',
  'Oklahoma City Thunder': '#007AC1', 'Orlando Magic': '#0077C0', 'Philadelphia 76ers': '#006BB6', 'Phoenix Suns': '#1D1160', 'Portland Trail Blazers': '#C4262E',
  'Sacramento Kings': '#5A2D81', 'San Antonio Spurs': '#2E3236', 'Toronto Raptors': '#CE1141', 'Utah Jazz': '#4A0F86', 'Washington Wizards': '#002B5C',
};
// Logos that are the same colour as their header are shown in white, as the NBA app does
const TEAM_LOGO_WHITE = new Set(['Houston Rockets', 'Toronto Raptors', 'Utah Jazz']);
// Darken a colour until white text on it is easy to read (contrast 4.5 or more)
function readableTeamColor(rgb) {
  let [r, g, b] = rgb;
  const lum = c => { c /= 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; };
  for (let i = 0; i < 30 && 1.05 / (0.2126 * lum(r) + 0.7152 * lum(g) + 0.0722 * lum(b) + 0.05) < 4.5; i++) { r *= 0.9; g *= 0.9; b *= 0.9; }
  return `rgb(${Math.round(r)},${Math.round(g)},${Math.round(b)})`;
}
// Other teams: the most common strong colour in the workbook logo
const logoColorCache = {};
function logoColor(src) {
  if (logoColorCache[src]) return logoColorCache[src];
  return (logoColorCache[src] = new Promise(res => {
    const img = new Image();
    img.onload = () => {
      try {
        const n = 48, c = document.createElement('canvas'); c.width = c.height = n;
        const g = c.getContext('2d'); g.drawImage(img, 0, 0, n, n);
        const d = g.getImageData(0, 0, n, n).data, buckets = {};
        for (let i = 0; i < d.length; i += 4) {
          const [r, gg, b, a] = [d[i], d[i + 1], d[i + 2], d[i + 3]];
          const mx = Math.max(r, gg, b), mn = Math.min(r, gg, b);
          if (a < 200 || mx < 40 || mn > 225 || mx - mn < 50) continue;   // skip clear, black, white and grey pixels
          const k = (r >> 5) + ',' + (gg >> 5) + ',' + (b >> 5);
          const e = (buckets[k] = buckets[k] || [0, 0, 0, 0]); e[0] += r; e[1] += gg; e[2] += b; e[3]++;
        }
        const top = Object.values(buckets).sort((x, y) => y[3] - x[3])[0];
        res(top && top[3] > 20 ? readableTeamColor([top[0] / top[3], top[1] / top[3], top[2] / top[3]]) : null);
      } catch (e) { res(null); }
    };
    img.onerror = () => res(null);
    img.src = src;
  }));
}
// Team Home: the first page of every team, a short summary with links into the other tabs
function teamHomeHtml(t, seasonInfo, won, lost) {
  const name = t.Team, L = teamLatest(t), parts = [], side = [];
  const more = (tab, label) => `<button class="card-link th-more" onclick="setTeamTab('${tab}')">${label} →</button>`;
  // This season, beyond the record and result already in the header
  if (L) parts.push(`<div class="chart-card"><div class="card-head"><div class="chart-title">${icon('calendar')} ${seasonLabel(L.yr)} Season</div>${more('seasons', 'All seasons')}</div>
    <div class="th-strip">
      <div><span>Games back</span><b>${L.gb ? String(L.gb).replace(/\.0$/, '') : '—'}</b></div>
      <div><span>League rank</span><b>${ordinalRank(L.me.leagueRk)} <small>of ${L.n}</small></b></div>
      <div><span>Last season</span><b>${L.prev ? `${L.prev.w}-${L.prev.l}` : '—'}</b></div>
      <div><span>Change</span><b class="${L.delta > 0 ? 'rec-win' : L.delta < 0 ? 'rec-loss' : ''}">${L.delta === null ? '—' : (L.delta > 0 ? '+' : L.delta < 0 ? '−' : '') + Math.abs(L.delta) + ' win' + (Math.abs(L.delta) === 1 ? '' : 's')}</b></div>
    </div></div>`);
  // The last 10 seasons as bars (wins scaled to 82 games)
  const last = seasonInfo.slice(0, 10).reverse();
  if (last.length >= 2) parts.push(`<div class="chart-card"><div class="card-head"><div class="chart-title">${icon('chart')} Last ${last.length} Seasons</div>${more('seasons', 'Wins chart')}</div>
    <div class="th-bars">${last.map(si => `<div class="th-bar ${si.isChamp ? 'is-champ' : si.isRU ? 'is-ru' : si.madePlayoffs ? 'is-po' : ''}" title="${seasonLabel(si.yr)}: ${si.w}-${si.l}${si.isChamp ? ', champion' : si.isRU ? ', conference champion' : si.madePlayoffs ? ', playoffs' : ''}" onclick="openSeason(${si.yr})">
      <b>${si.w}</b><i style="height:${Math.max(4, Math.round(si.cw / 82 * 100))}%"></i><span>${String(si.yr).slice(-2)}'</span></div>`).join('')}</div>
    <div class="th-key"><span><i class="k-champ"></i>Champion</span><span><i class="k-ru"></i>Conf. Champion</span><span><i class="k-po"></i>Playoffs</span><span><i class="k-out"></i>Missed</span></div></div>`);
  // All-Time starting five, compact
  const LU = franchiseLineup(name);
  if (LU.list.length >= 5) parts.push(`<div class="chart-card"><div class="card-head"><div class="chart-title">${icon('people')} All-Time Starting Five</div>${more('players', 'Full lineup')}</div>
    <div class="th-five">${LU.starters.map(x => `<div><span class="lu-pos">${x.pos}</span>${x.p ? nameLink(x.p.Player) : `<span class="name-plain">${x.name}</span>`}</div>`).join('')}</div>
    ${(LU.bench || []).length ? `<div class="fill-x th-bench" hidden><span class="lu-pos">Bench</span>${LU.bench.map(x => x.p ? nameLink(x.p.Player) : `<span class="name-plain">${x.name || ''}</span>`).join(' · ')}</div>` : ''}</div>`);
  // Face of the franchise
  const face = franchiseLegends(name)[0];
  if (face) side.push(`<div class="chart-card th-face"><div class="card-head"><div class="chart-title">${icon('star')} Face of the Franchise</div>${more('players', 'Legends')}</div>
    <div class="th-face-name">${nameLink(face.p.Player)} ${posBadge(face.p.Position)}</div>
    <div class="journey-tags">${face.ret.map(r => `<em class="tag-ret">#${r.num} retired</em>`).join('')}${face.titles ? `<em class="tag-gold">${icon('trophy')} ${face.titles} here</em>` : ''}${face.oneTeam ? '<em class="tag-plain">One-team career</em>' : ''}</div>
    <div class="muted th-face-sub">Here: ${honorsHereText(face)}</div></div>`);
  // Titles at a glance
  const lastTitle = Number(t['Last Title']) || null, lastFinals = Number(t['Last Finals']) || null;
  const drought = lastTitle && DB.latestSeason ? DB.latestSeason - lastTitle : null;
  side.push(`<div class="chart-card"><div class="card-head"><div class="chart-title">${icon('trophy', 'ic-champ')} Titles</div>${more('trophies', 'Trophies')}</div>
    <div class="th-tiles">
      <div><b>${won.length + lost.length ? `${won.length}-${lost.length}` : '—'}</b><span>Finals record</span></div>
      <div><b>${lastTitle || '—'}</b><span>Last title</span></div>
      <div><b>${lastFinals || '—'}</b><span>Last Finals</span></div>
      <div><b>${drought === null ? '—' : drought === 0 ? 'Champs' : drought}</b><span>${drought ? 'Seasons since' : 'Title drought'}</span></div>
      ${(() => { const tn = x => { const v = Number(x); return isNaN(v) ? '—' : v; };
        const bestSeason = seasonInfo.length ? seasonInfo.reduce((a, b) => (b.cw > a.cw ? b : a)) : null;
        return `<div class="fill-x" hidden><div><b>${tn(t['Conference Titles'])}</b><span>Conf. titles</span></div><div><b>${tn(t.Playoffs)}</b><span>Playoff trips</span></div></div>
          <div class="fill-x" hidden><div><b>${bestSeason ? `${bestSeason.w}-${bestSeason.l}` : '—'}</b><span>Best record${bestSeason ? ` · ${seasonLabel(bestSeason.yr)}` : ''}</span></div><div><b>${(() => { const d = [...won].map(Number).sort((a, b) => b - a); return d.length >= 2 ? Math.min(...d.slice(1).map((y, i) => d[i] - y)) + ' yr' : '—'; })()}</b><span>Shortest wait between titles</span></div></div>`; })()}
    </div></div>`);
  // Best active players here
  const act = DB.currentPlayers.filter(p => { const ts = playerTeams(p); return ts[ts.length - 1] === name; }).sort((a, b) => legacy(b).total - legacy(a).total).slice(0, 8);
  if (act.length) side.push(`<div class="chart-card rb-card"><div class="card-head"><div class="chart-title">${icon('people')} Top Active Players</div>${more('players', 'All')}</div>
    ${act.map((p, i) => `<div class="rb-row${i >= 3 ? ' fill-x' : ''}"${i >= 3 ? ' hidden' : ''}><span class="rb-rank">${i + 1}</span><span class="rb-main">${nameLink(p.Player)} ${posBadge(p.Position)}</span><span class="rb-val">${p['All Stars'] || 0}</span><span class="rb-sub">${draftCareer(p)}</span></div>`).join('')}
    <div class="muted" style="font-size:12px;margin-top:6px">Number = All-Star selections</div></div>`);
  return `<div class="player-grid"><div>${parts.join('')}</div><div>${side.join('')}</div></div>`;
}
function setTeamTab(tab) {
  queueBalance();
  teamState.tab = tab;
  const tp = document.getElementById('teamPage');
  tp.querySelectorAll('.tm-tab').forEach(el => el.hidden = el.dataset.tab !== tab);
  tp.querySelectorAll('.tm-btns button').forEach(b => b.classList.toggle('active', b.dataset.tab === tab));
  if (tab === 'seasons' && document.getElementById('winChart')) renderWinChart();
  // Keep the header in view, start the tab at its top
  const hero = tp.querySelector('.tm-hero');
  if (hero && scrollY > hero.offsetTop + hero.offsetHeight - 200) scrollTo({ top: hero.offsetTop + hero.offsetHeight - 160 });
}
// The latest season for one team: result, games back, league rank and the change from last season
function teamLatest(t) {
  const yr = DB.latestSeason, name = t.Team, me = t.seasonRecords?.[yr] && seasonStandings(yr).find(r => r.team === name);
  if (!me) return null;
  const st = seasonStandings(yr), top = st.filter(r => r.conf === me.conf).sort((a, b) => b.raw - a.raw)[0];
  const gb = top === me ? 0 : ((top.w - me.w) + (me.l - top.l)) / 2;
  const { champ, ru } = finalsTeams(yr);
  const result = champ === name ? `${icon('trophy', 'ic-champ')} Champion` : ru === name ? `${icon('trophy', 'ic-silver')} Conf. Champion` : me.playoffs ? 'Playoffs' : 'Missed playoffs';
  const prev = t.seasonRecords?.[yr - 1], pct = r => r.w / Math.max(1, r.w + r.l);
  const delta = prev ? Math.round((pct(t.seasonRecords[yr]) - pct(prev)) * 82) : null;
  const mi = mostImproved(yr), best = [...st].sort((a, b) => b.raw - a.raw)[0];
  const badge = best && best.team === name ? 'Best record in the league' : mi && mi.team === name ? 'Most improved team' : '';
  return { yr, me, n: st.length, gb, result, prev, delta, badge };
}
// Eras whose era player has this team as his main team (as on his own page)
function teamEras(team) {
  return (DB.decades || []).map(d => ({ d, player: eraPlayer(d) })).filter(x => x.player && mainTeam(x.player).team === team)
    .sort((a, b) => decadeStart(b.d) - decadeStart(a.d)).map(x => ({ name: eraName(x.d), player: x.player, decade: decadeStart(x.d) + 's' }));
}
// Players tab: Decade Team players who played here, newest decade first
function teamDecadesHtml(team) {
  const rows = [...(DB.decades || [])].sort((a, b) => decadeStart(b) - decadeStart(a)).map(d => {
    const here = list => (list || []).map(n => resolvePlayer(n)).filter(p => p && playerTeams(p).includes(team));
    return { d, st: here(d.starter), be: here(d.subs) };
  }).filter(r => r.st.length || r.be.length);
  if (!rows.length) return '';
  const total = rows.reduce((a, r) => a + r.st.length + r.be.length, 0), starters = rows.reduce((a, r) => a + r.st.length, 0);
  return `<div class="chart-card rb-card"><div class="chart-title">${icon('star')} All-Decade Players <span class="muted">${total}</span></div>
    <p class="muted fx-note" style="margin-top:-4px">${starters} in a decade's starting five · players who played here at any point of their career</p>
    ${rows.map(r => `<div class="rb-row"><span class="rb-rank"></span><span class="rb-main">${decadeStart(r.d)}s${eraName(r.d) ? ` <span class="muted">· ${eraName(r.d)} Era</span>` : ''}</span><span class="rb-val">${r.st.length + r.be.length}</span>
      <span class="rb-sub">${[...r.st.map(p => `<b>${nameLink(p.Player)}</b>`), ...r.be.map(p => nameLink(p.Player))].join(', ')}</span></div>`).join('')}
    <div class="muted" style="font-size:12px;margin-top:6px">Bold = starting five</div></div>`;
}
function teamHeroHtml(t, won, lost) {
  const name = t.Team, nick = shortTeam(name), city = name.slice(0, name.length - nick.length).trim();
  const teams = DB.teams.filter(x => !x.defunct);
  const num = v => { const x = getNum(v); return x === -Infinity ? null : x; };
  const rankOf = get => { const v = get(t); if (v === null || v === undefined || t.defunct) return { v, rk: '' };
    const vals = teams.map(get).filter(x => x !== null && x !== undefined), rk = vals.filter(x => x > v).length + 1;
    return { v, rk: (vals.filter(x => x === v).length > 1 ? 'T-' : '') + ordinalRank(rk) }; };
  const stats = [
    ['Titles', x => num(x.Championship) ?? 0, v => v],
    ['Glory', x => num(x['Glory Score']), v => Math.round(v).toLocaleString()],
    ['Conf titles', x => num(x['Conference Titles']) ?? 0, v => v],
    ['Win %', x => allTimeRecord(x).pct, v => v.toFixed(3).replace(/^0/, '')],
    ['Playoffs', x => num(x.Playoffs) ?? 0, v => v],
    ['10-yr wins', x => num(x['Avg. W Last 10Y']), v => v.toFixed(1)],
  ].map(([k, get, fmt]) => { const r = rankOf(get); return r.v === null || r.v === undefined ? '' : `<div class="tm-stat"><span class="tm-k">${k}</span><b>${r.rk}</b><span class="tm-v">${fmt(r.v)}</span></div>`; }).join('');
  // Latest season, as in "14th in West | 31-51 · Missed playoffs"
  const L = teamLatest(t);
  // rank | record, then result | season, lined up in two rows
  const kicker = L ? `<span>${ordinalRank(L.me.confRk)} in ${confName(L.me.conf)}</span><i>|</i><span>${L.me.w}-${L.me.l}</span><span>${L.result}</span><i>|</i><span>${seasonLabel(L.yr)}</span>` : `<span>${t.defunct ? 'Former franchise' : 'Franchise'}</span>`;
  const color = TEAM_COLORS[name];
  return `<section class="tm-hero" ${color ? `style="--tc:${color}"` : ''} data-team="${name}">
    ${backButton('Back', 'teamBack()', true)}
    <div class="tm-top">
      <div class="tm-id"><div class="tm-kicker${L ? ' tm-kicker-grid' : ''}">${kicker}</div>
        <h1 class="tm-name">${city ? `<span>${city}</span> ` : ''}<span>${nick}</span></h1>
        ${(() => { const eras = teamEras(name); return eras.length ? `<div class="tm-era">${eras.map(e => `<div class="pl-era">${icon('crown')}<b>Home of the ${e.player ? nameLink(e.player.Player, { label: e.name }) : e.name} Era</b><span>· ${e.decade}</span></div>`).join('')}</div>` : ''; })()}
        ${L && L.badge ? `<span class="tm-badge">${L.badge}</span>` : ''}</div>
      <div class="tm-logo${TEAM_LOGO_WHITE.has(name) ? ' tm-logo-white' : ''}">${teamLogo(name, 'tm-logo-img', true)}</div>
    </div>
    ${stats ? `<div class="tm-stats">${stats}</div>` : ''}
    <div class="tm-btns"></div>
  </section>`;
}
// The whole team page in the team's colour: --tc fills (with white text), and an accent for text,
// lines and icons that is readable on the page: --ta-l (light theme) and --ta-d (dark theme)
function teamTheme(root, color) {
  const m = String(color).match(/[0-9a-f]{6}/i), rgb = m ? [0, 2, 4].map(i => parseInt(m[0].slice(i, i + 2), 16)) : (String(color).match(/\d+(\.\d+)?/g) || []).slice(0, 3).map(Number);
  if (rgb.length < 3) return;
  const lum = c => { const f = v => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }; return 0.2126 * f(c[0]) + 0.7152 * f(c[1]) + 0.0722 * f(c[2]); };
  const ratio = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
  const css = c => `rgb(${c.map(Math.round).join(',')})`;
  let l = [...rgb]; for (let i = 0; i < 30 && ratio(l, [255, 255, 255]) < 4.5; i++) l = l.map(v => v * 0.9);
  // Dark theme: same hue, lighter and kept vivid (mixing with white would turn navy into grey)
  const toHsl = ([r, g, b]) => { r /= 255; g /= 255; b /= 255; const mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2, dd = mx - mn;
    if (!dd) return [0, 0, l]; const s = dd / (1 - Math.abs(2 * l - 1)); const h = mx === r ? ((g - b) / dd) % 6 : mx === g ? (b - r) / dd + 2 : (r - g) / dd + 4; return [h * 60, s, l]; };
  const fromHsl = ([h, s, l]) => { const c = (1 - Math.abs(2 * l - 1)) * s, x = c * (1 - Math.abs(((h / 60) % 2 + 2) % 2 - 1)), m = l - c / 2;
    const [r, g, b] = h < 60 ? [c, x, 0] : h < 120 ? [x, c, 0] : h < 180 ? [0, c, x] : h < 240 ? [0, x, c] : h < 300 ? [x, 0, c] : [c, 0, x]; return [r, g, b].map(v => (v + m) * 255); };
  let [hh, ss, ll] = toHsl(rgb); if (ss > 0.15) ss = Math.max(ss, 0.6);
  let d = fromHsl([hh < 0 ? hh + 360 : hh, ss, ll]); for (let i = 0; i < 40 && ratio(d, [18, 26, 41]) < 4.5; i++) { ll = Math.min(0.95, ll + 0.03); d = fromHsl([hh < 0 ? hh + 360 : hh, ss, ll]); }
  root.style.setProperty('--tc', css(rgb)); root.style.setProperty('--ta-l', css(l)); root.style.setProperty('--ta-d', css(d));
  root.classList.add('tm-themed');
}
// After the page is drawn: colour from the logo when there's no team colour, and the jump buttons
function finishTeamHero(root) {
  const hero = root.querySelector('.tm-hero'); if (!hero) return;
  root.classList.remove('tm-themed'); ['--tc', '--ta-l', '--ta-d'].forEach(v => root.style.removeProperty(v));
  if (TEAM_COLORS[hero.dataset.team]) teamTheme(root, TEAM_COLORS[hero.dataset.team]);
  else {
    const src = DB.logos && DB.logos[hero.dataset.team], team = hero.dataset.team;
    if (src) logoColor(src).then(c => { if (c && teamState.t === team) { hero.style.setProperty('--tc', c); teamTheme(root, c); } });
  }
  const tabs = [['home', 'Home'], ['seasons', 'Seasons'], ['players', 'Players'], ['trophies', 'Trophies']].filter(([k]) => root.querySelector(`.tm-tab[data-tab="${k}"]`)?.textContent.trim());
  hero.querySelector('.tm-btns').innerHTML = tabs.map(([k, label]) => `<button data-tab="${k}" class="${teamState.tab === k ? 'active' : ''}" onclick="setTeamTab('${k}')">${label}</button>`).join('');
}

// =====================================================================
// FOLDING CARDS: secondary cards on the team and player pages start closed;
// tapping the title opens or closes them, and the choice is remembered
// =====================================================================
const PLAYER_FOLDS = { 'Closest Match': false, 'Percentile Ranks': false, 'Advanced Stats': false, 'Similar Players': false, 'Legacy Score': false, 'Finals': false };
function foldState() { return readJSON('nba2k17-folds') || {}; }
function applyFolds(root, defaults) {
  const saved = foldState();
  root.querySelectorAll('.chart-card').forEach(card => {
    const title = card.querySelector('.chart-title');
    const name = title && title.textContent.trim();
    if (!name || !(name in defaults)) return;
    const head = title.closest('.card-head') || title;
    if (head.parentElement !== card) return;
    head.classList.add('fold-head');
    card.classList.add('fold');
    const open = name in saved ? saved[name] : defaults[name];
    card.classList.toggle('folded', !open);
    head.setAttribute('role', 'button'); head.tabIndex = 0;
    head.setAttribute('aria-expanded', String(open));
    const toggle = e => {
      if (e.target.closest('button, a, .seg, .team-link, .name-link, select')) return;
      if (e.type === 'keydown' && e.key !== 'Enter' && e.key !== ' ') return;
      e.preventDefault();
      const nowOpen = card.classList.toggle('folded') === false;
      head.setAttribute('aria-expanded', String(nowOpen));
      const st = foldState(); st[name] = nowOpen; writeJSON('nba2k17-folds', st);
    };
    head.addEventListener('click', toggle);
    head.addEventListener('keydown', toggle);
  });
}
function bwSwitch(btn, which) {
  const card = btn.closest('.bw-card');
  card.querySelectorAll('.seg button').forEach(b => b.classList.toggle('active', b === btn));
  card.querySelectorAll('.bw-list').forEach(l => { l.hidden = l.dataset.list !== which; });
}

// =====================================================================
// DYNASTIES: best runs of N seasons by titles, then Finals, then wins.
// Each team keeps only runs that don't overlap its better ones.
// =====================================================================
function teamWindows(len) {
  return cached('runs|' + len, () => {
    const fin = DB.history.map(h => ({ yr: Number(h.Season), ...finalsTeams(h.Season) })).filter(f => !isNaN(f.yr) && f.champ);
    if (!fin.length) return [];
    const minY = Math.min(...fin.map(f => f.yr)), maxY = Math.max(...fin.map(f => f.yr));
    const out = [];
    DB.teams.forEach(t => {
      const cands = [];
      for (let s = minY; s + len - 1 <= maxY; s++) {
        const e = s + len - 1, inWin = fin.filter(f => f.yr >= s && f.yr <= e);
        const titles = inWin.filter(f => f.champ === t.Team).length;
        if (!titles) continue;
        const finals = inWin.filter(f => f.champ === t.Team || f.ru === t.Team).length;
        let w = 0, l = 0, n = 0;
        for (let y = s; y <= e; y++) { const r = t.seasonRecords?.[y]; if (r) { w += r.w; l += r.l; n++; } }
        cands.push({ team: t.Team, s, e, titles, finals, w, l, n, score: titles * 1e6 + finals * 1e3 + (n ? w / n : 0) });
      }
      cands.sort((a, b) => b.score - a.score || a.s - b.s);
      const picked = [];
      cands.forEach(c => { if (!picked.some(p => c.s <= p.e && c.e >= p.s)) picked.push(c); });
      out.push(...picked);
    });
    return out.sort((a, b) => b.score - a.score || b.e - a.e);
  });
}
function runLabel(r) {
  return `${seasonLabel(r.s)} to ${seasonLabel(r.e)} · ${r.finals} Finals${r.n ? ` · ${r.w}-${r.l}${r.n < r.e - r.s + 1 ? ` (${r.n} seasons recorded)` : ''}` : ''}`;
}
// Best team of each decade (decades by the year a season starts: 2060s = 2060–61 to 2069–70)
function teamsOfDecades() {
  return cached('decadeTeams', () => {
    const fin = DB.history.map(h => ({ yr: Number(h.Season), ...finalsTeams(h.Season) })).filter(f => !isNaN(f.yr) && f.champ);
    const decades = [...new Set(fin.map(f => Math.floor((f.yr - 1) / 10) * 10))].sort((a, b) => b - a);
    return decades.map(d => {
      const inDec = fin.filter(f => f.yr - 1 >= d && f.yr - 1 < d + 10);
      const rows = DB.teams.map(t => {
        const titles = inDec.filter(f => f.champ === t.Team).length, finals = inDec.filter(f => f.champ === t.Team || f.ru === t.Team).length;
        let w = 0, l = 0;
        for (let y = d + 1; y <= d + 10; y++) { const r = t.seasonRecords?.[y]; if (r) { w += r.w; l += r.l; } }
        return { team: t.Team, titles, finals, w, l, score: titles * 1e6 + finals * 1e3 + w };
      }).filter(r => r.titles).sort((a, b) => b.score - a.score);
      return { d, best: rows[0], seasons: inDec.length };
    }).filter(x => x.best && x.seasons >= 5); // skip decades NBA History barely covers (the 1970s has one season)
  });
}

// =====================================================================
// TEAM WIN CHART
// Line of wins by season (oldest left). Gold/silver dots mark titles and
// Finals losses; hover or arrow keys show that season's details.
// =====================================================================
let winChartData = null;
// A long history is shown 20 seasons at a time (newest first by default), or all at once
function winChartWindows(all) {
  if (!all.length) return [];
  // Blocks line up on decades (1960-79, 1980-99, 2000-19...), newest first
  const first = all[0].yr, last = all[all.length - 1].yr, out = [];
  for (let from = Math.floor(last / 20) * 20; from + 19 >= first; from -= 20) { const to = from + 19; if (all.some(s => s.yr >= from && s.yr <= to)) out.push({ from, to }); }
  return out;
}
function setWinRange(i) { winChartData.range = i; renderWinChart(); }
function renderWinChart() {
  const el = document.getElementById('winChart');
  if (!el || !winChartData) return;
  const all = winChartData.seasons, conf = winChartData.team.Conference;
  const wins = winChartWindows(all), span = all.length ? all[all.length - 1].yr - all[0].yr : 0;
  const rangeEl = document.getElementById('winRange');
  if (winChartData.range === undefined) winChartData.range = span > 30 ? 0 : -1;   // -1 = all seasons
  if (rangeEl) {
    rangeEl.hidden = span <= 30;
    rangeEl.innerHTML = wins.map((w, i) => `<button class="${winChartData.range === i ? 'active' : ''}" onclick="setWinRange(${i})">${w.from}–${String(w.to).slice(-2)}</button>`).reverse().join('')
      + `<button class="${winChartData.range === -1 ? 'active' : ''}" onclick="setWinRange(-1)">All</button>`;
  }
  const win = wins[winChartData.range];
  const data = win ? all.filter(s => s.yr >= win.from && s.yr <= win.to) : all;
  if (!data.length) { el.innerHTML = ''; return; }
  const W = Math.max(el.clientWidth, 280), H = 210;
  const m = { l: 30, r: 58, t: 12, b: 24 };
  const pw = W - m.l - m.r, ph = H - m.t - m.b;
  const y0 = data[0].yr, y1 = data[data.length-1].yr;
  const x = yr => m.l + (yr - y0) / Math.max(y1 - y0, 1) * pw;
  const y = w => m.t + ph - w / 82 * ph;

  // Grid + axes (solid hairlines), .500 reference line
  // 41 wins (.500) replaces the 40 gridline so the two don't sit 1px apart
  let svg = [0, 20, 41, 60, 80].map(v =>
    `<line x1="${m.l}" x2="${m.l+pw}" y1="${y(v)}" y2="${y(v)}" class="${v === 41 ? 'wc-ref' : 'wc-grid'}"/>` +
    `<text x="${m.l-6}" y="${y(v)+4}" class="wc-tick" text-anchor="end">${v}</text>`).join('');
  // As many year labels as fit (about one per 46px)
  const fit = Math.max(2, Math.floor(pw / 46)), step = [1, 2, 5, 10, 20, 25, 50].find(s => (y1 - y0) / s <= fit) || 50;
  for (let yr = Math.ceil(y0/step)*step; yr <= y1; yr += step)
    svg += `<text x="${x(yr)}" y="${H-6}" class="wc-tick" text-anchor="middle">${yr}</text>`;

  // Line, broken where the team has no record for a season
  let d = '';
  data.forEach((s, i) => { d += (i && s.yr === data[i-1].yr + 1 ? 'L' : 'M') + x(s.yr).toFixed(1) + ' ' + y(s.cw ?? s.w).toFixed(1); });
  svg += `<path d="${d}" class="wc-line"/>`;
  data.forEach(s => {
    if (s.isChamp) svg += `<circle cx="${x(s.yr)}" cy="${y(s.cw ?? s.w)}" r="5" class="wc-mark" fill="var(--champ)"/>`;
    else if (s.isRU) svg += `<circle cx="${x(s.yr)}" cy="${y(s.cw ?? s.w)}" r="4.5" class="wc-mark" fill="var(--silver)"/>`;
  });
  // Direct label on the latest season only
  const last = data[data.length-1];
  if (!last.isChamp && !last.isRU) svg += `<circle cx="${x(last.yr)}" cy="${y(last.cw ?? last.w)}" r="4" class="wc-mark" fill="var(--link)"/>`;
  svg += `<text x="${x(last.yr)+8}" y="${y(last.cw ?? last.w)+4}" class="wc-end">${last.w}-${last.l}</text>`;
  // Hover layer
  svg += `<line class="wc-cross" y1="${m.t}" y2="${m.t+ph}" visibility="hidden"/><circle class="wc-focus wc-mark" r="4.5" fill="var(--link)" visibility="hidden"/>`;

  el.innerHTML = `<svg width="100%" viewBox="0 0 ${W} ${H}" style="max-width:${W}px" tabindex="0" role="img"
      aria-label="${winChartData.team.Team} wins per season, ${seasonLabel(y0)} to ${seasonLabel(y1)}. Use left and right arrow keys to step through seasons.">${svg}</svg>
    <div class="wc-tip" hidden></div>`;

  const svgEl = el.querySelector('svg'), tip = el.querySelector('.wc-tip');
  const cross = el.querySelector('.wc-cross'), focus = el.querySelector('.wc-focus');
  let cur = -1;
  const show = i => {
    cur = Math.max(0, Math.min(data.length - 1, i));
    const s = data[cur], cx = x(s.yr), cy = y(s.cw ?? s.w);
    cross.setAttribute('x1', cx); cross.setAttribute('x2', cx); cross.setAttribute('visibility', 'visible');
    focus.setAttribute('cx', cx); focus.setAttribute('cy', cy); focus.setAttribute('visibility', 'visible');
    const result = resultMark(s.isChamp, s.isRU, true) || (s.madePlayoffs === true ? 'Made playoffs' : s.madePlayoffs === false ? 'Missed playoffs' : '');
    tip.innerHTML = `<div class="wc-tip-title">${seasonLabel(s.yr)}${s.label ? ` · ${s.label}` : ''}</div>
      <div><strong>${s.w}-${s.l}</strong> · #${s.confRk} ${confName(s.conf || conf)} · #${s.leagueRk} league</div>
      <div class="wc-tip-sub">${result}</div>`;
    tip.hidden = false;
    // Keep the tooltip inside the chart: flip to the left of the point near the right edge
    const tw = tip.offsetWidth;
    tip.style.left = (cx + 12 + tw > W ? cx - 12 - tw : cx + 12) + 'px';
    tip.style.top = Math.max(0, Math.min(cy - 20, H - tip.offsetHeight)) + 'px';
  };
  const hide = () => { cur = -1; tip.hidden = true; cross.setAttribute('visibility', 'hidden'); focus.setAttribute('visibility', 'hidden'); };
  const nearest = px => data.reduce((bi, s, i) => Math.abs(x(s.yr) - px) < Math.abs(x(data[bi].yr) - px) ? i : bi, 0);
  svgEl.addEventListener('mousemove', e => { const r = svgEl.getBoundingClientRect(); show(nearest((e.clientX - r.left) * W / r.width)); });
  svgEl.addEventListener('mouseleave', hide);
  svgEl.addEventListener('focus', () => show(data.length - 1));
  svgEl.addEventListener('blur', hide);
  svgEl.addEventListener('keydown', e => {
    if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') { e.preventDefault(); show(cur + (e.key === 'ArrowRight' ? 1 : -1)); }
  });
}
window.addEventListener('resize', () => { if (document.getElementById('winChart')) renderWinChart(); });
