// 2K17 NBA Stats Database · Franchises list, team page, folding cards, dynasties and the wins chart.
// Loaded in order by index.html; all files share one global scope.

// =====================================================================
// TEAMS
// =====================================================================
// Franchises can be sorted high-to-low or low-to-high on any of the menu's measures
let teamSortDir = -1;
function teamSortVal(t, sc) {
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
let teamState = { t: null };
// Kept under its old name because every team link in the app calls it
function openTeamModal(teamName, fromHistory) {
  const t = DB.teams.find(x => x.Team === teamName);
  if (!t) return;
  closeModal();
  closeSearch();
  teamState.t = t.Team;
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
    const p = r.type === 'Player' ? resolvePlayer(r.who) : null;
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

  const bio = [
    ['Conference', t.Conference === 'EAST' ? 'East' : t.Conference === 'WEST' ? 'West' : (t.Conference || '—')],
    ['Established', t['Est. Date'] || '—'],
    ['Glory rank', t.Rank ? `#${t.Rank} of ${DB.teams.filter(x => !x.defunct).length}` : '—'],
    ['Glory score', t['Glory Score'] || 0],
    ...(seasonInfo.length ? [[`Record (${seasonInfo.length} seasons)`, `${totW.toLocaleString()}-${totL.toLocaleString()} (${(totW / Math.max(totW + totL, 1)).toFixed(3).replace(/^0/, '')})`]] : []),
    ...(won.length + lost.length ? [['Finals record', `${won.length}-${lost.length}`]] : []),
    ['Last title', t['Last Title'] || '—'],
  ];
  parts.push(`<section class="player-hero team-hero">
    <button class="hero-back" onclick="teamBack()" aria-label="Back">← Back</button>
    <div class="ph-main">
      <div class="team-hero-head">${teamLogo(t.Team, 'tlogo-xl')}<div>
        <div class="hero-kicker">${icon('trophy')} Franchise</div>
        <h1 class="ph-name">${t.Team}</h1></div></div>
      <dl class="bio-strip">${bio.map(([k, v]) => `<div><dt>${k}</dt><dd>${v}</dd></div>`).join('')}</dl>
    </div>
    <div class="ph-stats">${[['Titles', t.Championship || 0], ['Conf. titles', t['Conference Titles'] || 0], ['Playoffs', t.Playoffs || 0]].map(([k, v]) => `<div><b>${v}</b><span>${k}</span></div>`).join('')}
      <div class="ph-sub">${t['Division Titles'] || 0} division titles · last Finals ${t['Last Finals'] || '—'}</div>
    </div>
  </section>`);

  const main = [], side = [];
  // Finals history, newest first
  const fin = [...won.map(yr => ({ yr, w: true })), ...lost.map(yr => ({ yr, w: false }))].sort((a, b) => b.yr - a.yr);
  if (fin.length || earlier) main.push(`<div class="chart-card"><div class="chart-title">${icon('trophy', 'ic-champ')} Finals History</div>
    <div class="fin-chips">${fin.map(f => `<span class="fin-chip ${f.w ? 'won' : 'lost'}" onclick="openSeason(${f.yr})" role="button" tabindex="0" title="${f.w ? 'Won' : 'Lost'} the ${seasonLabel(f.yr)} Finals">${icon('trophy', f.w ? 'ic-champ' : 'ic-silver')} ${seasonLabel(f.yr)}</span>`).join('')}</div>
    <div class="fin-key"><span>${icon('trophy', 'ic-champ')} Won ${won.length}</span><span>${icon('trophy', 'ic-silver')} Lost ${lost.length}</span>${earlier ? `<span>+${earlier} title${earlier > 1 ? 's' : ''} before ${seasonLabel(firstHist)}</span>` : ''}</div></div>`);
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
  if (rivalRows.length) main.push(`<div class="chart-card rb-card"><div class="chart-title">${icon('trophy', 'ic-champ')} Finals Rivalries</div>
    ${rivalRows.map(([opp, r]) => `<div class="rb-row"><span class="rb-rank"></span><span class="rb-main">${teamLink(opp)}</span>
      <span class="rb-val ${r.w > r.l ? 'rec-win' : r.w < r.l ? 'rec-loss' : ''}">${r.w}-${r.l}</span>
      <span class="rb-sub">${r.games.sort((a, b) => b.yr - a.yr).map(g => `<span class="nowrap">${icon('trophy', g.won ? 'ic-champ' : 'ic-silver')}${seasonLink(g.yr)}</span>`).join(' · ')}</span></div>`).join('')}</div>`);
  main.push(`<div class="chart-card">${legendsHtml(t.Team)}</div>`);
  if (seasonInfo.length >= 2) main.push(`<div class="chart-card"><div class="chart-title">${icon('line')} Wins per Season</div>
    <div class="wc-key"><span><i class="wc-dot champ"></i>Champion</span><span><i class="wc-dot silver"></i>Lost Finals</span><span><i class="wc-rule"></i>.500 (41 wins)</span></div>
    <div class="seg wc-range" id="winRange"></div>
    <div class="win-chart" id="winChart"></div></div>`);
  if (seasonInfo.length) main.push(`<div class="chart-card"><div class="chart-title">${icon('calendar')} Season by Season</div>
    <div class="season-scroll"><table class="standings-table">
      <thead><tr><th>Season</th><th class="num">Record</th><th class="num">Conf</th><th class="num">League</th><th class="num">Win%</th><th>Result</th></tr></thead>
      <tbody>${seasonInfo.map(si => `<tr class="${si.isChamp ? 'row-champ' : si.isRU ? 'row-ru' : si.madePlayoffs ? 'row-playoff' : ''}">
        <td>${seasonLink(si.yr)}${si.label ? `<div class="muted st-era">${si.label}</div>` : ''}</td><td class="num ${recClass(si.w, si.l)}">${si.w}-${si.l}</td>
        <td class="num">${si.confRk > 0 ? '#' + si.confRk : '—'}</td><td class="num">${si.leagueRk > 0 ? '#' + si.leagueRk : '—'}</td>
        <td class="num">${si.pct.toFixed(3).replace(/^0/, '')}</td>
        <td>${resultMark(si.isChamp, si.isRU, true) || (si.madePlayoffs ? '<span class="muted">Playoffs</span>' : '')}</td></tr>`).join('')}</tbody>
    </table></div></div>`);

  // Side column: best run, best and worst seasons, retired numbers, active players
  const runs = [3, 5, 10].map(len => ({ len, r: teamWindows(len).find(x => x.team === teamName) })).filter(x => x.r);
  if (runs.length) side.push(`<div class="chart-card rb-card"><div class="chart-title">${icon('star')} Best Runs</div>
    ${runs.map(({ len, r }) => `<div class="rb-row"><span class="rb-rank"></span><span class="rb-main">${len} seasons</span><span class="rb-val">${r.titles} title${r.titles > 1 ? 's' : ''}</span>
      <span class="rb-sub">${runLabel(r)}</span></div>`).join('')}
    <button class="card-link" onclick="showSection('records');setTimeout(()=>document.getElementById('rb-dynasties')?.scrollIntoView(),50)">All dynasties</button></div>`);
  const seasonRow = si => `<div class="rb-row"><span class="rb-rank"></span><span class="rb-main">${seasonLink(si.yr)}</span><span class="rb-val">${si.w}-${si.l}</span>
    <span class="rb-sub">${si.isChamp ? 'Won the title' : si.isRU ? 'Lost in the Finals' : si.madePlayoffs === false ? `Missed the playoffs (#${si.confRk})` : `#${si.confRk} in the ${confName(si.conf)}`}${si.label ? ` · ${si.label}` : ''}</span></div>`;
  if (seasonInfo.length) {
    side.push(`<div class="chart-card rb-card bw-card"><div class="card-head"><div class="chart-title">${icon('calendar')} Best &amp; Worst Seasons</div>
      <div class="seg"><button class="active" onclick="bwSwitch(this, 'best')">Best</button><button onclick="bwSwitch(this, 'worst')">Worst</button></div></div>
      <div class="bw-list" data-list="best">${[...seasonInfo].sort((a, b) => b.pct - a.pct || b.w - a.w || b.yr - a.yr).slice(0, 5).map(seasonRow).join('')}</div>
      <div class="bw-list" data-list="worst" hidden>${[...seasonInfo].sort((a, b) => a.pct - b.pct || a.w - b.w || b.yr - a.yr).slice(0, 5).map(seasonRow).join('')}</div></div>`);
  }
  const retired = retiredForTeam(teamName);
  const jerseys = retired.filter(r => r.type === 'Player'), others = retired.filter(r => r.type !== 'Player');
  const byNum = (a, b) => (parseInt(a.num) || 999) - (parseInt(b.num) || 999);
  if (retired.length) side.push(`<div class="chart-card"><div class="chart-title">${icon('jersey')} Retired Numbers <span class="muted">${retired.length}</span></div>
    <div class="chip-row">${jerseys.sort(byNum).map(r => `<div class="jersey" ${r.years ? `title="${r.years}"` : ''}><div class="jersey-num">${r.num}</div>
      <div class="jersey-name">${r.linked ? nameLink(r.player) : `<span class="name-plain">${r.player}</span>`}</div>${r.years ? `<div class="jersey-years">${r.years}</div>` : ''}</div>`).join('')}</div>
    ${others.length ? `<div class="jersey-others"><div class="jo-title">Also honored</div>${others.map(r => `<div class="jo-row"><b>${r.num && r.num !== '—' ? r.num : '—'}</b> ${r.player} <span class="muted">${r.type}${r.years ? ' · ' + r.years : ''}</span></div>`).join('')}</div>` : ''}</div>`);
  const activeHere = DB.currentPlayers.filter(p => { const ts = playerTeams(p); return ts[ts.length - 1] === teamName; })
    .sort((a, b) => legacy(b).total - legacy(a).total);
  // Players whose first listed team is this one
  const startedHere = everyPlayer().filter(p => playerTeams(p)[0] === teamName).sort((a, b) => legacy(b).total - legacy(a).total);
  if (startedHere.length) {
    const row = p => {
      const span = careerSpan(p.Season), teams = [...new Set(playerTeams(p))];
      const stay = teams.length === 1 ? 'One-team career' : `Then ${teams.slice(1).map(x => teamLink(x)).join(', ')}`;
      return `<div class="rb-row"><span class="rb-rank">${posBadge(p.Position)}</span><span class="rb-main">${nameLink(p.Player)}${isActive(p) ? ' <span class="muted">active</span>' : ''}</span>
        <span class="rb-val rb-val-sm">${span ? seasonLabel(span[0]) : ''}</span><span class="rb-sub">${stay}</span></div>`;
    };
    side.push(`<div class="chart-card rb-card"><div class="chart-title">${icon('people')} Started Here</div>
      ${startedHere.slice(0, 8).map(row).join('')}
      ${startedHere.length > 8 ? `<details class="more-legends"><summary>All ${startedHere.length} players who started here</summary>${startedHere.slice(8).map(row).join('')}</details>` : ''}
      <div class="muted" style="font-size:12px;margin-top:6px">First team on the player's row · season = their first</div></div>`);
  }
  if (activeHere.length) side.push(`<div class="chart-card rb-card"><div class="chart-title">${icon('people')} Active Players Here</div>
    ${activeHere.map(p => `<div class="rb-row"><span class="rb-rank">${posBadge(p.Position)}</span><span class="rb-main">${nameLink(p.Player)}</span><span class="rb-val">${p['All Stars'] || 0}</span>
      <span class="rb-sub">${draftCareer(p)}</span></div>`).join('')}<div class="muted" style="font-size:12px;margin-top:6px">Last team listed on their row · number = All-Star selections</div></div>`);

  parts.push(`<div class="player-grid"><div>${main.join('')}</div><div>${side.join('')}</div></div>`);
  const tp = document.getElementById('teamPage');
  tp.innerHTML = parts.join('');
  applyFolds(tp, TEAM_FOLDS);
  winChartData = { team: t, seasons: [...seasonInfo].reverse() };
}

// =====================================================================
// FOLDING CARDS: secondary cards on the team and player pages start closed;
// tapping the title opens or closes them, and the choice is remembered
// =====================================================================
const TEAM_FOLDS = { 'Finals Rivalries': false, 'Season by Season': false, 'Best Runs': false, 'Started Here': false, 'Active Players Here': false };
const PLAYER_FOLDS = { 'Percentile Ranks': false, 'Advanced Stats': false, 'Similar Players': false, 'Legacy Score': false };
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
  const m = { l: 30, r: 48, t: 12, b: 24 };
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

  el.innerHTML = `<svg width="${W}" height="${H}" tabindex="0" role="img"
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
  svgEl.addEventListener('mousemove', e => show(nearest(e.clientX - svgEl.getBoundingClientRect().left)));
  svgEl.addEventListener('mouseleave', hide);
  svgEl.addEventListener('focus', () => show(data.length - 1));
  svgEl.addEventListener('blur', hide);
  svgEl.addEventListener('keydown', e => {
    if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') { e.preventDefault(); show(cur + (e.key === 'ArrowRight' ? 1 : -1)); }
  });
}
window.addEventListener('resize', () => { if (document.getElementById('winChart')) renderWinChart(); });
