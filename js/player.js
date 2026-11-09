// 2K17 NBA Stats Database · Career timeline, player page, Compare (players and teams), Awards and global search.
// Loaded in order by index.html; all files share one global scope.

// =====================================================================
// PLAYER MODAL
// =====================================================================
// Season-by-season honors for one player, gathered from NBA History, All NBA Team and
// Season Stat Leader. Titles show where the player is a listed champion star or Finals MVP.
function careerEvents(name) {
  const ev = {};
  const add = (yr, label, cls, tip) => {
    const list = (ev[yr] = ev[yr] || []);
    if (!list.some(e => e.label === label)) list.push({ label, cls: cls || '', tip });
  };
  const isMe = (raw, yr) => raw && raw !== '-' && resolvePlayer(String(raw).replace(/\s*\(\d+\)\s*$/, '').trim(), yr)?.Player === name;
  DB.history.forEach(h => {
    const yr = Number(h.Season);
    if ([h.Star1, h.Star2, h.Star3].some(x => isMe(x, yr)) || isMe(h.FMVP, yr)) {
      const role = (legacyContext().roles[name] || []).find(r => r.yr === yr);
      add(yr, 'Champion', 'ev-champ', role ? `Title as ${role.label}` : '');
    }
    if ([h.RU1, h.RU2, h.RU3].some(x => isMe(x, yr))) {
      const role = (legacyContext().ruRoles[name] || []).find(r => r.yr === yr);
      const winner = finalsTeams(yr).champ;
      add(yr, 'Conference Title', 'ev-ru', `Lost the Finals${winner ? ' to the ' + winner : ''}${role ? ' as ' + role.label : ''}`);
    }
    if (isMe(h.FMVP, yr)) add(yr, 'Finals MVP', 'ev-fmvp');
    if (isMe(h.MVP, yr)) add(yr, 'MVP', 'ev-mvp');
    if (isMe(h.DPOY, yr)) add(yr, 'DPOY', 'ev-dpoy');
  });
  DB.allNbaSeasons.forEach(s => s.teams.forEach(t => {
    if (t.slots.some(sl => isMe(sl.player, s.season))) add(Number(s.season), `All-NBA ${['1st','2nd','3rd'][t.team-1] || t.team + 'th'} Team`, 'ev-nba' + Math.min(t.team, 3));
  }));
  const cats = [['PtsLeader','PPG','Scoring'],['RebLeader','RPG','Rebounding'],['AstLeader','APG','Assists'],['StlLeader','SPG','Steals'],['BlkLeader','BPG','Blocks']];
  DB.statLeaders.forEach(r => cats.forEach(([k, unit, label]) => { if (isMe(r[k], r.Season)) add(Number(r.Season), `${label} leader · ${r[unit]} ${unit}`, 'ev-stat'); }));
  // Rookie honors carry no year in the workbook; a rookie award belongs to the first season
  const me = everyPlayer().find(x => x.Player === name), first = me && careerSpan(me.Season)?.[0];
  if (first) {
    const tip = 'The workbook doesn\'t record the year; shown in the first season';
    const ry = rotySeasons(me);
    if (ry.length) ry.forEach(y => add(y, 'Rookie of the Year', 'ev-roy'));
    else if (isRoty(me)) add(first, 'Rookie of the Year', 'ev-roy', tip);
    const rt = String(me.RookieTeam ?? me['Rookie Team'] ?? '').trim();
    if (rt === '1st' || rt === '2nd') add(first, `All-Rookie ${rt} Team`, 'ev-rookie', tip);
  }
  return Object.entries(ev).map(([yr, items]) => ({ yr: Number(yr), items })).sort((a, b) => a.yr - b.yr);
}
// All-time top-20 ranks among players in the workbook; ties share a rank.
// Turnovers are left out on purpose: leading them isn't an honor.
const ALL_TIME_CHECKS = [['PTS','Points','c'],['REB','Rebounds','c'],['AST','Assists','c'],['STL','Steals','c'],['BLK','Blocks','c'],
  ['MIN','Minutes','c'],['GP','Games','c'],['DD2','Double-doubles','c'],['TD3','Triple-doubles','c'],['FGM','Field goals','c'],['3PM','3-pointers','c'],['FTM','Free throws','c'],
  ['Champions','Titles','e'],['MVP','MVPs','e'],['FMVP','Finals MVPs','e'],['DPOY','DPOY awards','e'],['All Stars','All-Star selections','e'],['1st Team','All-NBA 1st Teams','e']];
function allTimeRanks(p) {
  const careers = DB.allPlayers, everyone = [...DB.allPlayers, ...DB.currentPlayers];
  return ALL_TIME_CHECKS.map(([key, label, w]) => {
    const pool = w === 'c' ? careers : everyone;
    if (!pool.includes(p)) return null;
    const v = getNum(p[key]);
    if (v === -Infinity || v <= 0) return null;
    return { key, label, rank: 1 + pool.filter(x => getNum(x[key]) > v).length };
  }).filter(r => r && r.rank <= 20).sort((a, b) => a.rank - b.rank);
}

// =====================================================================
// PLAYER PAGE (replaces the old player popup; every player link lands here)
// =====================================================================
let playerState = { p: null, pool: 'all' };
// Kept under its old name because every player link in the app calls it
function openPlayerModal(rawName) {
  const p = resolvePlayer(rawName);
  if (p) openPlayer(p);
}
function openPlayer(p, fromHistory) {
  closeModal();
  closeSearch();
  playerState.p = p;
  const hash = '#player-' + playerSlug(p.Player);
  if (!fromHistory && location.hash !== hash) history.pushState(null, '', hash);
  renderPlayerPage();
  showSection('player');
  window.scrollTo(0, 0);
}
function openPlayerFromHash() {
  const m = location.hash.match(/^#player-(.+)$/);
  if (!m) return false;
  const p = everyPlayer().find(x => playerSlug(x.Player) === m[1]);
  if (!p) return false;
  openPlayer(p, true);
  return true;
}
function playerBack() {
  if (history.length > 1 && document.referrer !== undefined) history.back();
  else showSection('players');
}
function setPctPool(pool) { playerState.pool = pool; renderPlayerPage(); }

function renderPlayerPage() {
  const p = playerState.p;
  if (!p) return;
  const active = isActive(p);
  const hasStats = careerPlayers().includes(p);
  const n = k => { const v = getNum(p[k]); return v === -Infinity ? 0 : v; };
  const one = v => v === null ? '—' : v.toFixed(1);
  const span = careerSpan(p.Season);
  const lr = legacyRankOf(p);
  const top20 = DB.top20.find(x => x.Player === p.Player);
  const posRank = (DB.positions[p.Position] || []).find(x => x.Player === p.Player);
  const draft = draftInfo(p);
  const parts = [];

  // Header: name, bio strip, headline numbers
  const bio = [
    ['Position', POS_NAMES[p.Position] || p.Position || '—'],
    ['Career', `${span ? seasonLabel(span[0]) + ' to ' + (span[1] === Infinity ? 'present' : seasonLabel(span[1])) : (p.Season || '—')}`],
    ['Seasons', p.Exp || '—'],
    ['Draft', draftLabel(draft)],
    ['Teams', playerTeams(p).length || '—'],
    ['Legacy rank', lr ? `#${lr} of ${everyPlayer().length}` : '—'],
    ...(top20 ? [['Your Top 20', '#' + top20.Rank]] : []),
    ...(posRank ? [[`Your ${p.Position} rank`, '#' + posRank.Rank]] : []),
  ];
  const headline = hasStats
    ? [['PPG', one(perGame(p, 'PTS'))], ['RPG', one(perGame(p, 'REB'))], ['APG', one(perGame(p, 'AST'))]]
    : [['All-Stars', n('All Stars')], ['Titles', n('Champions')], ['MVPs', n('MVP')]];
  parts.push(`<section class="player-hero">
    <button class="hero-back" onclick="playerBack()" aria-label="Back">← Back</button>
    <div class="ph-main">
      <div class="hero-kicker">${p.Position ? posBadge(p.Position) : ''} ${active ? '<span class="badge-active">ACTIVE</span>' : 'Retired'}</div>
      <h1 class="ph-name">${p.Player}</h1>
      <dl class="bio-strip">${bio.map(([k, v]) => `<div><dt>${k}</dt><dd>${v}</dd></div>`).join('')}</dl>
    </div>
    <div class="ph-stats">${headline.map(([k, v]) => `<div><b>${v}</b><span>${k}</span></div>`).join('')}
      ${hasStats ? `<div class="ph-sub">${numFmt(p.GP)} games · ${one(perGame(p, 'MIN'))} min</div>` : ''}
      <button class="btn-primary ph-compare" onclick="compareWith('${jsArg(p.Player)}')">Compare</button>
    </div>
  </section>`);

  const ranks = allTimeRanks(p);
  if (ranks.length) parts.push(`<div class="rank-badges">${ranks.map(r => `<span class="rank-badge${r.rank <= 3 ? ' rb-podium' : ''}"><b>#${r.rank}</b> all-time ${r.label}</span>`).join('')}</div>`);

  // Trophy shelf
  const shelf = [
    ['trophy', 'Championships', n('Champions'), 'gold'], ['crown', 'MVP', n('MVP'), 'gold'], ['medal', 'Finals MVP', n('FMVP'), 'gold'],
    ['shield', 'DPOY', n('DPOY'), ''], ['star', 'All-Star', n('All Stars'), ''],
    ['list', 'All-NBA 1st', n('1st Team'), ''], ['list', 'All-NBA 2nd', n('2nd Team'), ''], ['list', 'All-NBA 3rd', n('3rd Team'), ''],
    ['shield', 'All-Defense 1st', n('1st D Team'), ''], ['shield', 'All-Defense 2nd', n('2nd D Team'), ''],
    ['star', 'Rookie of the Year', isRoty(p) ? 1 : 0, ''],
    ['star', String(p['Other Award'] || '').replace(/\s*\(\d+\)\s*$/, '').trim() || 'Other award', otherAwardCount(p), ''],
    ...[['PtsLeader', 'Scoring title'], ['RebLeader', 'Rebounding title'], ['AstLeader', 'Assists title'], ['StlLeader', 'Steals title'], ['BlkLeader', 'Blocks title']]
      .map(([k, l]) => { const c = DB.statLeaders.filter(r => r[k] && resolvePlayer(r[k], r.Season) === p).length; return ['chart', c > 1 ? l + 's' : l, c, '']; }),
    ['calendar', 'Finals appearances', n('Finals App'), ''],
  ].filter(t => t[2] > 0);
  // Where the legacy score comes from, with the title roles summed up in one line
  const L = legacy(p), rk = legacyRankOf(p);
  const partRows = LEGACY_PARTS.map(([k, label]) => ({ label, v: L.parts[k] })).filter(r => r.v > 0).sort((a, b) => b.v - a.v);
  const roleCount = {};
  (legacyContext().roles[p.Player] || []).forEach(r => roleCount[r.label] = (roleCount[r.label] || 0) + 1);
  const unlistedTitles = Math.max(0, n('Champions') - (legacyContext().roles[p.Player] || []).length);
  const span0 = careerSpan(p.Season);
  const ROLE_ORDER = ['single core', 'franchise player', 'co-star', 'second star', 'core'];
  const roleLine = [...Object.entries(roleCount).sort((a, b) => ROLE_ORDER.indexOf(a[0]) - ROLE_ORDER.indexOf(b[0])).map(([l, c]) => `${c} as ${l}`),
    ...(unlistedTitles ? [`${unlistedTitles} ${span0 && span0[0] < legacyContext().firstHistory ? 'before NBA History starts (estimated)' : 'as rotation player'}`] : [])].join(' · ');
  const legacyHtml = `<div class="chart-card"><div class="card-head"><div class="chart-title">${icon('chart')} Legacy Score</div>
      <button class="card-link" onclick="showSection('legacy')">Full ranking</button></div>
    <div class="legacy-total fold-keep"><b>${Math.round(L.total).toLocaleString()}</b><span>points${rk ? ` · #${rk} of ${everyPlayer().length}` : ''}</span></div>
    ${partRows.length ? `<div class="lg-parts">${partRows.map(r => `<div class="lg-part"><span>${r.label}</span><span class="lg-track"><i style="width:${Math.max(2, r.v / partRows[0].v * 100)}%"></i></span><b>${Math.round(r.v).toLocaleString()}</b></div>`).join('')}</div>` : '<p class="muted">No points yet.</p>'}
    ${roleLine ? `<div class="lg-roles"><b>Titles:</b> ${roleLine}</div>` : ''}
    ${(() => { const rr = legacyContext().ruRoles[p.Player] || [], cnt = {}; rr.forEach(r => cnt[r.label] = (cnt[r.label] || 0) + 1);
      const un = Math.max(0, n('Finals App') - n('Champions') - rr.length);
      const line = [...Object.entries(cnt).sort((a, b) => ROLE_ORDER.indexOf(a[0]) - ROLE_ORDER.indexOf(b[0])).map(([l, c]) => `${c} as ${l}`), ...(un ? [`${un} as rotation player`] : [])].join(' · ');
      return line ? `<div class="lg-roles lg-roles-ru"><b>Conference titles:</b> ${line}</div>` : ''; })()}</div>`;
  const shelfHtml = `<div class="chart-card"><div class="chart-title">${icon('trophy', 'ic-champ')} Trophy Shelf</div>
    ${shelf.length ? `<div class="trophy-shelf">${shelf.map(([ic, label, count, tone]) => `<div class="trophy ${tone}">${icon(ic)}<b>${count}</b><span>${label}</span></div>`).join('')}</div>` : '<p class="muted">No awards recorded yet.</p>'}
    </div>`;

  // Percentile bars
  let pctHtml = '';
  if (hasStats) {
    const pool = playerState.pool === 'pos' ? careerPlayers().filter(x => x.Position === p.Position) : careerPlayers();
    const rows = PCT_METRICS.map(m => ({ m, v: m.get(p), pct: percentile(m, p, pool) })).filter(r => r.pct !== null);
    pctHtml = `<div class="chart-card"><div class="card-head"><div class="chart-title">${icon('chart')} Percentile Ranks</div>
      <div class="seg"><button class="${playerState.pool === 'all' ? 'active' : ''}" onclick="setPctPool('all')">All players</button><button class="${playerState.pool === 'pos' ? 'active' : ''}" onclick="setPctPool('pos')">${p.Position}s</button></div></div>
      <div class="pct-list">${rows.map(r => `<div class="pct-row"><span class="pct-label">${r.m.label}</span>
        <span class="pct-track"><i style="width:${Math.max(r.pct, 2)}%" class="${r.pct >= 90 ? 'elite' : r.pct >= 60 ? 'good' : ''}"></i></span>
        <span class="pct-num">${r.pct}</span><span class="pct-val">${r.m.fmt(r.v)}</span></div>`).join('')}</div></div>`;
  }
  parts.push(`<div class="player-grid">${pctHtml ? `<div class="pg-wide">${pctHtml}</div>` : ''}<div class="${pctHtml ? 'pg-side' : 'pg-full'}">${shelfHtml}${legacyHtml}</div></div>`);

  // Advanced stats
  if (hasStats) {
    const adv = advStats(p);
    parts.push(`<div class="chart-card"><div class="chart-title">${icon('line')} Advanced Stats</div>
      <div class="adv-grid">${ADV_DEFS.map(d => `<div class="adv" title="${d.how}"><b>${adv[d.key] === null ? '—' : d.fmt(adv[d.key])}</b><span>${d.label}</span></div>`).join('')}</div></div>`);
  }

  // Team journey
  const teams = playerTeams(p), retired = retiredFor(p);
  // Years with each team: from the Retired # tab when it lists this player there (two spells
  // with one team are split between the two stops), or the whole career for a one-team career
  const oneTeam = new Set(teams).size === 1;
  const stintYears = (t, i) => {
    const row = (DB.retiredList || []).find(r => r.years && r.type === 'Player' && teamByCode(r.code)?.Team === t && resolveRetired(r) === p);
    if (row) {
      const parts2 = row.years.split(/\s*,\s*/), nth = teams.slice(0, i).filter(x => x === t).length, count = teams.filter(x => x === t).length;
      return count > 1 && parts2.length === count ? parts2[nth] : row.years;
    }
    if (oneTeam && span) return `${span[0] - 1}–${span[1] === Infinity ? 'present' : span[1]}`;
    return '';
  };
  // Fill the gaps from the career span: a stop between two known ones (or the career's start
  // or end) ran from where the previous one ended to where the next one began
  const known = teams.map((t, i) => stintYears(t, i));
  const ends = y => { const n = String(y).match(/\d{4}/g); return n ? { from: Number(n[0]), to: /present/i.test(y) ? 'present' : Number(n[n.length - 1]) } : null; };
  const careerFrom = span ? span[0] - 1 : null, careerTo = span ? (span[1] === Infinity ? 'present' : span[1]) : null;
  // Only when the team list is complete: if a team's known years show more spells than the row
  // lists stops for it (Garnett's two Minnesota spells, one Minnesota column), the order can't be trusted
  const spells = known.flatMap(y => y ? y.split(/\s*,\s*/).map(ends).filter(Boolean) : []);
  const complete = teams.every((t, i) => !known[i] || known[i].split(',').length <= teams.filter(x => x === t).length);
  const yearsOf = known.map((y, i) => {
    if (y || !span || !complete) return y;
    const prev = i === 0 ? { to: careerFrom } : known[i - 1] ? ends(known[i - 1]) : null;
    const next = i === teams.length - 1 ? { from: careerTo } : known[i + 1] ? ends(known[i + 1]) : null;
    if (!prev || !next || prev.to == null || next.from == null) return '';
    const from = prev.to, to = next.from === 'present' ? Infinity : next.from;
    // Must be a real stretch that no known spell already covers
    if (from >= to || spells.some(sp => sp.from < to && (sp.to === 'present' ? Infinity : sp.to) > from)) return '';
    return `${from}–${next.from}`;
  });
  if (teams.length) parts.push(`<div class="chart-card"><div class="chart-title">${icon('jersey')} Team Journey</div>
    <div class="journey">${teams.map((t, i) => {
      const red = p._titleStints, ret = retired.filter(r => r.team === t);
      // With red cells, mark the exact stint; a team with two red stints gets no count (it isn't known per stint)
      const twice = red && teams.filter((x, j) => x === t && red[j]).length > 1;
      const titles = red && !red[i] ? 0 : titlesWithTeam(p, t), label = twice ? 'Title' : `${titles} title${titles > 1 ? 's' : ''}`;
      return `${i ? '<span class="journey-arrow" aria-hidden="true">→</span>' : ''}<div class="journey-stop">
        <span class="journey-n">${i + 1}</span>${teamLink(t, t)}
        ${yearsOf[i] ? `<span class="journey-years">${yearsOf[i]}</span>` : ''}
        <span class="journey-tags">${titles ? `<em class="tag-gold">${icon('trophy')} ${label}</em>` : ''}${ret.map(r => `<em class="tag-ret">#${r.num} retired</em>`).join('')}</span></div>`;
    }).join('')}</div></div>`);

  // Career numbers
  if (hasStats) {
    const avg = k => { const v = perGame(p, k); return v === null ? '—' : v.toFixed(1); };
    parts.push(`<div class="chart-card"><div class="chart-title">${icon('list')} Career Stats</div>
      <div class="modal-section-title" style="border:0;margin:0 0 6px;padding:0;font-size:13px;color:var(--ink-3)">Per game</div>
      <div class="stat-grid">${[['PPG',avg('PTS')],['RPG',avg('REB')],['APG',avg('AST')],['SPG',avg('STL')],['BPG',avg('BLK')],['MPG',avg('MIN')],['FG%',pctFmt(p['FG%'])],['3P%',pctFmt(p['3P%'])],['FT%',pctFmt(p['FT%'])],['TOV',avg('TO')]].map(([l,v])=>`<div class="stat-box avg-box"><div class="sv">${v}</div><div class="sl">${l}</div></div>`).join('')}</div>
      <div class="modal-section-title" style="border:0;margin:16px 0 6px;padding:0;font-size:13px;color:var(--ink-3)">Totals</div>
      <div class="stat-grid">${[['Points',numFmt(p.PTS),'PTS'],['Rebounds',numFmt(p.REB),'REB'],['Assists',numFmt(p.AST),'AST'],['Steals',numFmt(p.STL),'STL'],['Blocks',numFmt(p.BLK),'BLK'],['Minutes',numFmt(p.MIN),'MIN'],['Games',numFmt(p.GP),'GP'],['Double-doubles',numFmt(p.DD2),'DD2'],['Triple-doubles',numFmt(p.TD3),'TD3'],['FGM / FGA',`${numFmt(p.FGM)} / ${numFmt(p.FGA)}`,'FGM'],['3PM / 3PA',`${numFmt(p['3PM'])} / ${numFmt(p['3PA'])}`,'3PM'],['FTM / FTA',`${numFmt(p.FTM)} / ${numFmt(p.FTA)}`,'FTM']].map(([l,v,k])=>{
        const r = ranks.find(x => x.key === k);
        return `<div class="stat-box${String(v).includes('/') ? ' wide' : ''}"><div class="sv">${v}</div><div class="sl">${l}</div>${r ? `<div class="srank${r.rank <= 3 ? ' podium' : ''}">#${r.rank} all-time</div>` : ''}</div>`; }).join('')}</div></div>`);
  } else {
    parts.push(`<div class="chart-card"><p class="muted">Career stats appear once the player retires and is added to your All Players sheet. Active players are tracked by awards in the Current Player sheet.</p></div>`);
  }

  // Timeline
  const timeline = careerEvents(p.Player);
  if (timeline.length) parts.push(`<div class="chart-card"><div class="chart-title">${icon('calendar')} Career Timeline</div>
    <div class="tl-key">${[['ev-champ', 'Title'], ['ev-fmvp', 'Finals MVP'], ['ev-mvp', 'MVP'], ['ev-dpoy', 'DPOY'], ['ev-ru', 'Conference Title'], ['ev-nba1', 'All-NBA'], ['ev-stat', 'Stat leader'], ['ev-roy', 'Rookie']]
      .filter(([c]) => timeline.some(t => t.items.some(e => c === 'ev-nba1' ? /^ev-nba/.test(e.cls) : c === 'ev-roy' ? /^ev-(roy|rookie)$/.test(e.cls) : e.cls === c)))
      .map(([c, l]) => `<span class="tl-chip ${c}">${l}</span>`).join('')}</div>
    <div class="timeline">${timeline.map(t => `<div class="tl-row"><div class="tl-season">${seasonLink(t.yr)}</div>
      <div class="tl-items">${t.items.map(e => `<span class="tl-chip ${e.cls}"${e.tip ? ` title="${e.tip}"` : ''}>${e.cls === 'ev-champ' && e.label === 'Champion' ? icon('trophy','ic-champ') + ' ' : e.cls === 'ev-ru' ? icon('trophy','ic-silver') + ' ' : ''}${e.label}</span>`).join('')}</div></div>`).join('')}</div></div>`);

  // Similar players
  const sim = similarPlayers(p, 5);
  if (sim.length) parts.push(`<div class="chart-card"><div class="chart-title">${icon('people')} Similar Players</div>
    <div class="sim-grid">${sim.map(sp => `<div class="sim" role="button" tabindex="0" onclick="openPlayerModal('${jsArg(sp.p.Player)}')" onkeydown="if(event.key==='Enter')this.click()">
      <div class="sim-match">${sp.match}%</div><div class="sim-name">${sp.p.Player} ${posBadge(sp.p.Position)}</div>
      <div class="sim-line">${one(perGame(sp.p, 'PTS'))} PPG · ${one(perGame(sp.p, 'REB'))} RPG · ${one(perGame(sp.p, 'AST'))} APG</div>
      <button class="card-link" onclick="event.stopPropagation();compareWith('${jsArg(p.Player)}','${jsArg(sp.p.Player)}')">Compare</button></div>`).join('')}</div></div>`);

  const pp = document.getElementById('playerPage');
  pp.innerHTML = parts.join('');
  applyFolds(pp, PLAYER_FOLDS);
}
// Open Compare with one or two players already picked
function compareWith(a, b) {
  clearCompare();
  cmpSelect(1, a);
  if (b) cmpSelect(2, b);
  showSection('compare');
  if (b) renderCompare();
  window.scrollTo(0, 0);
}

// =====================================================================
// COMPARE PLAYERS
// =====================================================================
let cmpPlayers = {1:null,2:null,3:null};
let cmpMode = 'avg';
const ALL_PLAYERS_LIST = () => [...DB.allPlayers,...DB.currentPlayers];

// Cycles per game -> totals -> per 36 minutes
function toggleCmpMode() {
  cmpMode = { avg: 'total', total: 'per36', per36: 'avg' }[cmpMode];
  document.getElementById('cmpModeBtn').textContent = { avg: 'PER GAME', total: 'TOTALS', per36: 'PER 36' }[cmpMode];
  const players = [cmpPlayers[1],cmpPlayers[2],cmpPlayers[3]].filter(Boolean);
  if (players.length >= 2) renderCompare();
}
function cmpSuggest(n) {
  const q = document.getElementById(`cmpSearch${n}`).value.toLowerCase().trim();
  const dd = document.getElementById(`cmpDropdown${n}`);
  if (!q) { dd.innerHTML=''; return; }
  const matches = ALL_PLAYERS_LIST().filter(p => String(p.Player||'').toLowerCase().includes(q)).slice(0,8);
  if (!matches.length) { dd.innerHTML=''; return; }
  dd.innerHTML = `<div class="cmp-dropdown">${
    matches.map(p=>`<div class="cmp-option" onmousedown="cmpSelect(${n},'${jsArg(p.Player||'')}');return false;">
      ${p.Player} <span class="muted">${p.Position||''}</span>
    </div>`).join('')
  }</div>`;
}
function cmpSelect(n, name) {
  const p = ALL_PLAYERS_LIST().find(x => x.Player === name);
  if (!p) return;
  cmpPlayers[n] = p;
  document.getElementById(`cmpSearch${n}`).value='';
  document.getElementById(`cmpDropdown${n}`).innerHTML='';
  document.getElementById(`cmpSelected${n}`).textContent = name;
}
function clearCompare() {
  [1,2,3].forEach(n=>{
    cmpPlayers[n]=null;
    document.getElementById(`cmpSearch${n}`).value='';
    document.getElementById(`cmpSelected${n}`).textContent='';
    document.getElementById(`cmpDropdown${n}`).innerHTML='';
  });
  document.getElementById('cmpResult').innerHTML='';
}
// Each row: value per player plus a bar showing that value's percentile among all
// players in the workbook; the leader of each row scores a point on the scoreboard
function compareMetrics() {
  const statVal = key => p => {
    if (cmpMode === 'total') { const v = getNum(p[key]); return v === -Infinity ? null : v; }
    const pg = perGame(p, key);
    if (cmpMode === 'avg' || pg === null) return pg;
    const mpg = perGame(p, 'MIN');
    return mpg ? pg * 36 / mpg : null;
  };
  const num = key => p => { const v = getNum(p[key]); return v === -Infinity ? null : v; };
  const award = key => p => { const v = getNum(p[key]); return v === -Infinity ? 0 : v; };
  const fmtStat = v => cmpMode === 'total' ? Math.round(v).toLocaleString() : v.toFixed(1);
  const pct = v => v.toFixed(1) + '%';
  const unit = { avg: ' per game', total: '', per36: ' per 36' }[cmpMode];
  const L = (cmpMode === 'total' ? ['Points','Rebounds','Assists','Steals','Blocks'] : ['Points','Rebounds','Assists','Steals','Blocks']).map(x => x + unit);
  return [
    { header: 'Production' + ({ avg: ' · per game', total: ' · career totals', per36: ' · per 36 minutes' }[cmpMode]) },
    { label: L[0], get: statVal('PTS'), fmt: fmtStat }, { label: L[1], get: statVal('REB'), fmt: fmtStat },
    { label: L[2], get: statVal('AST'), fmt: fmtStat }, { label: L[3], get: statVal('STL'), fmt: fmtStat },
    { label: L[4], get: statVal('BLK'), fmt: fmtStat },
    ...(cmpMode === 'per36' ? [] : [{ label: cmpMode === 'total' ? 'Minutes' : 'Minutes per game', get: statVal('MIN'), fmt: fmtStat }]),
    { label: 'Games played', get: num('GP'), fmt: v => Math.round(v).toLocaleString() },
    { label: 'Double-doubles', get: num('DD2'), fmt: v => Math.round(v).toLocaleString() },
    { label: 'Triple-doubles', get: num('TD3'), fmt: v => Math.round(v).toLocaleString() },
    { header: 'Efficiency' },
    { label: 'True shooting %', get: p => advStats(p).ts, fmt: v => (v * 100).toFixed(1) + '%' },
    { label: 'Effective FG %', get: p => advStats(p).efg, fmt: v => (v * 100).toFixed(1) + '%' },
    { label: 'FG%', get: num('FG%'), fmt: pct }, { label: '3P%', get: num('3P%'), fmt: pct }, { label: 'FT%', get: num('FT%'), fmt: pct },
    { label: 'Assist / turnover', get: p => advStats(p).astTo, fmt: v => v.toFixed(2) },
    { header: 'Honors', awards: true },
    { label: 'Championships', get: award('Champions'), fmt: v => v, awards: true },
    { label: 'MVP', get: award('MVP'), fmt: v => v, awards: true },
    { label: 'Finals MVP', get: award('FMVP'), fmt: v => v, awards: true },
    { label: 'Finals appearances', get: award('Finals App'), fmt: v => v, awards: true },
    { label: 'All-NBA selections', get: award('All NBA Team'), fmt: v => v, awards: true },
    { label: 'All-NBA 1st Team', get: award('1st Team'), fmt: v => v, awards: true },
    { label: 'All-Star selections', get: award('All Stars'), fmt: v => v, awards: true },
    { label: 'DPOY', get: award('DPOY'), fmt: v => v, awards: true },
    { label: 'All-Defensive selections', get: p => award('1st D Team')(p) + award('2nd D Team')(p), fmt: v => v, awards: true },
    { label: 'Legacy score', get: p => legacy(p).total, fmt: v => Math.round(v).toLocaleString(), awards: true },
  ];
}
// =====================================================================
// AWARDS: every MVP, Finals MVP, DPOY and Rookie of the Year, with counts
// =====================================================================
let awardTab = 'MVP';
const AWARD_TABS = [['MVP', 'MVP'], ['FMVP', 'Finals MVP'], ['DPOY', 'DPOY'], ['ROY', 'Rookie of the Year']];
function setAwardTab(k) { awardTab = k; renderAwards(); }
function renderAwards() {
  document.getElementById('awardTabs').innerHTML = AWARD_TABS.map(([k, l]) => `<button class="${k === awardTab ? 'active' : ''}" onclick="setAwardTab('${k}')">${l}</button>`).join('');
  let list;
  const histKey = awardTab === 'ROY' ? 'ROTY' : awardTab;
  list = DB.history.filter(h => h[histKey] && h[histKey] !== '-').flatMap(h => coNames(h[histKey]).map((n, i, all) => ({ yr: Number(h.Season), name: n, key: playerKey(n, h.Season), team: all.length > 1 ? null : h[histKey + 'Team'] })))
    .filter(x => !isNaN(x.yr));
  let guessed = 0;
  if (awardTab === 'ROY') {
    // Players marked "o" in All Players for a season NBA History has no ROTY for: shown in their first season
    const have = new Set(list.map(x => x.yr)), named = new Set(list.map(x => x.key));
    everyPlayer().filter(p => /^o$/i.test(String(p.ROTY || '').trim()) && !named.has(p.Player)).forEach(p => {
      const yr = careerSpan(p.Season)?.[0];
      if (yr && !have.has(yr)) { list.push({ yr, name: p.Player, key: p.Player, guess: true }); guessed++; }
    });
  }
  list.sort((a, b) => a.yr - b.yr);
  const counts = {}, nth = list.map(x => (counts[x.key] = (counts[x.key] || 0) + 1));
  const label = AWARD_TABS.find(([k]) => k === awardTab)[1];
  const champOf = yr => finalsTeams(yr).champ;
  const rows = list.map((x, i) => ({ ...x, nth: nth[i] })).reverse().map(x => {
    const p = resolvePlayer(x.name, x.yr);
    const team = x.team || (awardTab === 'FMVP' ? champOf(x.yr) : null);
    return `<tr><td class="stick-1">${seasonLink(x.yr)}${x.guess ? '<span class="muted" title="Year not in NBA History; shown in the first season"> *</span>' : ''}</td><td>${nameLink(x.name, { season: x.yr })} ${p ? posBadge(p.Position) : ''}</td>
      <td class="nowrap">${team ? teamLink(team, teamCode(team)) : '<span class="muted">—</span>'}</td>
      ${awardTab === 'ROY' ? '' : `<td class="num">${x.nth > 1 ? `<b>${ordinal(x.nth)}</b>` : '1st'}</td>`}</tr>`;
  }).join('');
  const most = withRanks(Object.entries(counts).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).filter(([, c]) => c >= 2).slice(0, 15), ([, c]) => c);
  const span = list.length ? `${seasonLabel(list[0].yr)} to ${seasonLabel(list[list.length - 1].yr)}` : '';
  document.getElementById('awardsSub').textContent = `${list.length} ${awardTab === 'ROY' ? 'Rookies of the Year' : label + ' winners'} from NBA History${span ? ', ' + span : ''}`
    + (guessed ? ` · * ${guessed} from All Players, shown in the first season` : '');
  document.getElementById('awardsContent').innerHTML = `<div class="player-grid">
    <div><div class="table-wrap stat-table"><table><thead><tr><th class="stick-1">Season</th><th>${label}</th><th>Team</th>${awardTab === 'ROY' ? '' : `<th class="num" title="Which win of the player's career">Win</th>`}</tr></thead><tbody>${rows || '<tr><td colspan="4" class="muted">No winners recorded.</td></tr>'}</tbody></table></div></div>
    <div>${(() => {
      // Which franchises its winners played for (from the logos beside each name in NBA History)
      const byTeam = {};
      list.forEach(x => { const t = x.team || (awardTab === 'FMVP' ? champOf(x.yr) : null); if (t) byTeam[t] = (byTeam[t] || 0) + 1; });
      const rows2 = withRanks(Object.entries(byTeam).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).slice(0, 10), ([, c]) => c);
      return rows2.length ? `<div class="chart-card rb-card"><div class="chart-title">${icon('people')} ${label}s by Team</div>
        ${rows2.map(r => `<div class="rb-row"><span class="rb-rank">${r.rank}</span><span class="rb-main">${teamLink(r[0])}</span><span class="rb-val">${r[1]}</span></div>`).join('')}</div>` : '';
    })()}${most.length ? `<div class="chart-card rb-card"><div class="chart-title">${icon('trophy', 'ic-champ')} Most ${label}${awardTab === 'ROY' ? '' : 's'}</div>
      ${most.map(m => `<div class="rb-row"><span class="rb-rank">${m.rank}</span><span class="rb-main">${nameLink(m[0])}</span><span class="rb-val">${m[1]}</span></div>`).join('')}</div>` : ''}</div>
  </div>`;
}

// =====================================================================
// COMPARE TEAMS
// =====================================================================
function setCmpKind(kind) {
  document.querySelectorAll('.cmp-kind button').forEach(b => b.classList.toggle('active', b.dataset.kind === kind));
  document.getElementById('cmpPlayersUI').hidden = kind !== 'players';
  document.getElementById('cmpTeamsUI').hidden = kind !== 'teams';
  document.getElementById('cmpSub').textContent = kind === 'teams' ? 'Pick two or three franchises to compare side by side' : 'Pick two or three players to compare side by side';
  if (kind === 'teams') renderTeamCompare();
}
function populateTeamCompare() {
  const teams = DB.teams.filter(t => !t.defunct).sort((a, b) => (a.Rank || 99) - (b.Rank || 99)).map(t => t.Team);
  [1, 2, 3].forEach(n => {
    const el = document.getElementById('cmpTeam' + n), keep = el.value;
    el.innerHTML = (n === 3 ? '<option value="">None</option>' : '<option value="">Pick a team…</option>') + teams.map(t => `<option>${t}</option>`).join('');
    el.value = teams.includes(keep) ? keep : '';
  });
}
function teamCompareStats(team) {
  const t = DB.teams.find(x => x.Team === team);
  const fin = DB.history.map(h => ({ yr: Number(h.Season), ...finalsTeams(h.Season) })).filter(f => !isNaN(f.yr));
  const won = fin.filter(f => f.champ === team).length, lost = fin.filter(f => f.ru === team).length;
  const recs = Object.values(t.seasonRecords || {});
  const w = recs.reduce((a, r) => a + r.w, 0), l = recs.reduce((a, r) => a + r.l, 0);
  return { t, won, lost, w, l, seasons: recs.length, best: recs.length ? Math.max(...recs.map(r => r.w)) : null, sixty: recs.filter(r => r.w >= 60).length,
    retired: retiredForTeam(team).filter(r => r.type === 'Player').length, legend: franchiseLegends(team)[0], oneTeam: franchiseLegends(team).filter(x => x.oneTeam).length };
}
function renderTeamCompare() {
  const picks = [1, 2, 3].map(n => document.getElementById('cmpTeam' + n)?.value).map((v, i) => v ? { v, n: i + 1 } : null).filter(Boolean);
  const out = document.getElementById('cmpTeamResult');
  const uniq = picks.filter((p, i) => picks.findIndex(x => x.v === p.v) === i);
  if (uniq.length < 2) { out.innerHTML = '<p class="muted" style="padding:20px 0">Pick at least two teams to compare.</p>'; return; }
  const st = uniq.map(p => ({ ...p, s: teamCompareStats(p.v) }));
  const num = v => (v === null || v === undefined || isNaN(v)) ? null : Number(v);
  const metrics = [
    { header: 'Honors' },
    { label: 'Championships', get: s => num(s.t.Championship) },
    { label: 'Finals appearances (since 1979–80)', get: s => s.won + s.lost },
    { label: 'Finals wins', get: s => s.won, fmt: (v, s) => `${s.won}-${s.lost}` },
    { label: 'Conference titles', get: s => num(s.t['Conference Titles']) },
    { label: 'Division titles', get: s => num(s.t['Division Titles']) },
    { label: 'Playoff appearances', get: s => num(s.t.Playoffs) },
    { label: 'Glory Score', get: s => num(s.t['Glory Score']) },
    { header: `Regular season (Team Record)` },
    { label: 'Win %', get: s => s.seasons ? s.w / (s.w + s.l) : null, fmt: (v, s) => `${v.toFixed(3).replace(/^0/, '')} <span class="muted">(${s.w.toLocaleString()}-${s.l.toLocaleString()})</span>` },
    { label: 'Best season (wins)', get: s => s.best },
    { label: '60-win seasons', get: s => s.sixty },
    { label: 'Avg. wins, last 5 years', get: s => num(parseFloat(s.t['Avg. W Last 5Y'])), fmt: v => v.toFixed(1) },
    { label: 'Avg. wins, last 10 years', get: s => num(parseFloat(s.t['Avg. W Last 10Y'])), fmt: v => v.toFixed(1) },
    { header: 'Legends' },
    { label: 'Retired numbers', get: s => s.retired },
    { label: 'One-team careers', get: s => s.oneTeam },
  ];
  const colors = st.map(x => `var(--p${x.n})`), wins = st.map(() => 0);
  const rows = metrics.map(m => {
    if (m.header) return `<tr class="section-header"><td colspan="${st.length + 1}">${m.header}</td></tr>`;
    const vals = st.map(x => m.get(x.s)), valid = vals.filter(v => v !== null), best = valid.length ? Math.max(...valid) : null;
    const leaders = vals.map(v => v !== null && v === best && valid.filter(x => x === best).length === 1 && valid.length > 1);
    leaders.forEach((ld, i) => { if (ld) wins[i]++; });
    return `<tr><td>${m.label}</td>${st.map((x, i) => vals[i] === null ? '<td class="muted">—</td>'
      : `<td class="${leaders[i] ? 'cmp-best' : ''}"><span class="cmp-val">${m.fmt ? m.fmt(vals[i], x.s) : vals[i].toLocaleString()}</span></td>`).join('')}</tr>`;
  }).join('');
  // Head-to-head in the Finals
  const fin = DB.history.map(h => ({ yr: Number(h.Season), ...finalsTeams(h.Season) }));
  const h2h = [];
  for (let i = 0; i < st.length; i++) for (let j = i + 1; j < st.length; j++) {
    const a = st[i].v, b = st[j].v, meet = fin.filter(f => (f.champ === a && f.ru === b) || (f.champ === b && f.ru === a)).sort((x, y) => y.yr - x.yr);
    if (meet.length) h2h.push(`<div class="rb-row"><span class="rb-rank"></span><span class="rb-main">${teamLink(a)} vs ${teamLink(b)}</span>
      <span class="rb-val">${meet.filter(f => f.champ === a).length}-${meet.filter(f => f.champ === b).length}</span>
      <span class="rb-sub">${meet.map(f => `<span class="nowrap">${teamLogo(f.champ)}${seasonLink(f.yr)}</span>`).join(' · ')}</span></div>`);
  }
  const top = Math.max(...wins);
  out.innerHTML = `<div class="cmp-board">${st.map((x, i) => `<div class="cmp-score${wins[i] === top && wins.filter(w => w === top).length === 1 ? ' lead' : ''}">
      <i class="cmp-swatch" style="background:${colors[i]}"></i><span class="cs-name">${teamLink(x.v)}</span><b>${wins[i]}</b><span class="cs-label">categories led</span></div>`).join('')}</div>
    <div style="overflow-x:auto;margin-top:8px"><table class="cmp-table"><thead><tr><th>Stat</th>${st.map((x, i) => `<th><i class="cmp-swatch" style="background:${colors[i]}"></i>${teamLink(x.v)}
      <div class="cmp-sub">${x.s.t.Conference === 'EAST' ? 'East' : 'West'} · Est. ${x.s.t['Est. Date'] || '—'}${x.s.legend ? ` · top legend ${nameLink(x.s.legend.p.Player)}` : ''}</div></th>`).join('')}</tr></thead>
      <tbody>${rows}</tbody></table></div>
    <div class="chart-card rb-card" style="margin-top:16px"><div class="chart-title">${icon('trophy', 'ic-champ')} Finals Meetings</div>
      ${h2h.length ? h2h.join('') : '<p class="muted">These teams have never met in the Finals.</p>'}</div>`;
}
function renderCompare() {
  const players = [cmpPlayers[1],cmpPlayers[2],cmpPlayers[3]].filter(Boolean);
  const out = document.getElementById('cmpResult');
  if (players.length < 2) { out.innerHTML = '<p class="muted" style="padding:20px 0">Pick at least two players to compare.</p>'; return; }
  const colors = [1,2,3].filter(n => cmpPlayers[n]).map(n => `var(--p${n})`);
  const wins = players.map(() => 0);
  const rows = compareMetrics().map(m => {
    if (m.header) return `<tr class="section-header"><td colspan="${players.length + 1}">${m.header}</td></tr>`;
    const pool = m.awards ? everyPlayer() : careerPlayers();
    const vals = players.map(p => { const v = m.get(p); return v === null || v === undefined || isNaN(v) ? null : Number(v); });
    const valid = vals.filter(v => v !== null), best = valid.length ? Math.max(...valid) : null;
    const leaders = vals.map(v => v !== null && v === best && valid.filter(x => x === best).length === 1 && valid.length > 1);
    leaders.forEach((l, i) => { if (l) wins[i]++; });
    return `<tr><td>${m.label}</td>${players.map((p, i) => {
      if (vals[i] === null) return '<td class="muted">—</td>';
      const pc = percentile({ get: m.get }, p, pool);
      return `<td class="${leaders[i] ? 'cmp-best' : ''}"><div class="cmp-cell"><span class="cmp-val">${m.fmt(vals[i])}</span>
        <span class="cmp-bar" title="${pc === null ? '' : pc + 'th percentile among all players'}"><i style="width:${pc === null ? 0 : Math.max(pc, 2)}%;background:${colors[i]}"></i></span></div></td>`;
    }).join('')}</tr>`;
  }).join('');
  const top = Math.max(...wins);
  const board = `<div class="cmp-board">${players.map((p, i) => `<div class="cmp-score${wins[i] === top && wins.filter(w => w === top).length === 1 ? ' lead' : ''}">
      <i class="cmp-swatch" style="background:${colors[i]}"></i><span class="cs-name">${nameLink(p.Player)}</span>
      <b>${wins[i]}</b><span class="cs-label">categories led</span></div>`).join('')}</div>`;
  const head = `<thead><tr><th>Stat</th>${players.map((p, i) => `<th><i class="cmp-swatch" style="background:${colors[i]}"></i>${nameLink(p.Player)}<div class="cmp-sub">${p.Position||''} · ${p.Season||''}${isActive(p) ? ' · Active' : ''}</div></th>`).join('')}</tr></thead>`;
  out.innerHTML = `${board}
    <div style="overflow-x:auto;margin-top:8px"><table class="cmp-table">${head}<tbody>${rows}</tbody></table></div>`;
}

// =====================================================================
// SEARCH FROM ANYWHERE (masthead button, or press "/")
// =====================================================================
let searchHits = [], searchSel = 0;
function openSearch() {
  if (!dataLoaded) return;
  const ov = document.getElementById('searchOverlay');
  ov.hidden = false;
  const input = document.getElementById('globalSearch');
  input.value = '';
  renderSearch();
  setTimeout(() => input.focus(), 30);
}
function closeSearch() { const ov = document.getElementById('searchOverlay'); if (ov) ov.hidden = true; }
function renderSearch() {
  const q = normName(document.getElementById('globalSearch').value);
  const box = document.getElementById('searchResults');
  if (!q) { searchHits = []; box.innerHTML = '<p class="muted search-tip">Type a player, team or season, e.g. "jordan", "lakers" or "2016".</p>'; return; }
  const score = name => { const nn = normName(name); return nn.startsWith(q) ? 0 : nn.split(' ').some(w => w.startsWith(q)) ? 1 : nn.includes(q) ? 2 : 9; };
  const players = everyPlayer().map(p => ({ p, sc: score(p.Player) })).filter(x => x.sc < 9)
    .sort((a, b) => a.sc - b.sc || legacy(b.p).total - legacy(a.p).total).slice(0, 8)
    .map(({ p }) => ({ kind: 'Player', label: p.Player, sub: `${POS_NAMES[p.Position] || ''}${p.Season ? ' · ' + p.Season : ''}${isActive(p) ? ' · Active' : ''}`, go: () => openPlayer(p) }));
  const teams = DB.teams.filter(t => !t.defunct && score(t.Team) < 9).slice(0, 5)
    .map(t => ({ kind: 'Team', label: t.Team, sub: `${t.Conference} · ${t.Championship || 0} titles`, go: () => { closeSearch(); openTeamModal(t.Team); } }));
  const yrs = allSeasonYears().filter(y => String(y).includes(q.replace(/\D/g, '')) && /\d/.test(q) || seasonLabel(y).replace(/\D/g, '').includes(q.replace(/\D/g, '')) && q.replace(/\D/g, '').length >= 2)
    .slice(0, 5).map(y => ({ kind: 'Season', label: seasonLabel(y), sub: (() => { const f = finalsTeams(y); return f.champ ? 'Champion: ' + f.champ : ''; })(), go: () => { closeSearch(); openSeason(y); } }));
  searchHits = [...players, ...teams, ...yrs];
  searchSel = 0;
  box.innerHTML = searchHits.length ? searchHits.map((h, i) => `<button class="search-hit${i === 0 ? ' sel' : ''}" onclick="pickSearch(${i})">
      <span class="sh-kind">${h.kind}</span><span class="sh-label">${h.label}</span><span class="sh-sub">${h.sub}</span></button>`).join('')
    : '<p class="muted search-tip">No matches.</p>';
}
function pickSearch(i) { const h = searchHits[i]; if (h) { closeSearch(); h.go(); } }
function searchKey(e) {
  if (e.key === 'Escape') { closeSearch(); return; }
  if (e.key === 'Enter') { e.preventDefault(); pickSearch(searchSel); return; }
  if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
  e.preventDefault();
  searchSel = Math.max(0, Math.min(searchHits.length - 1, searchSel + (e.key === 'ArrowDown' ? 1 : -1)));
  document.querySelectorAll('.search-hit').forEach((b, i) => b.classList.toggle('sel', i === searchSel));
}
document.addEventListener('keydown', e => {
  if (e.key === '/' && dataLoaded && !/INPUT|SELECT|TEXTAREA/.test(document.activeElement?.tagName || '')) { e.preventDefault(); openSearch(); }
});
