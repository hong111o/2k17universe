// 2K17 NBA Stats Database · Visual cards: the percentile "fingerprint" dot chart (Compare and
// Similar Players), franchise stat tiles with league rank, and the team page season card.

const ordinalRank = n => n + (n % 100 >= 11 && n % 100 <= 13 ? 'th' : ['th', 'st', 'nd', 'rd'][n % 10] || 'th');

// One row per percentile metric; a dot per player on a 0-100 track, joined by a bar from the
// lowest to the highest so the gaps and shared strengths read at a glance
function fingerprintHtml(players, colors, opts) {
  opts = opts || {};
  const pool = careerPlayers();
  const rows = PCT_METRICS.map(m => ({ m, pts: players.map((p, i) => ({ p, i, pct: percentile(m, p, pool), v: m.get(p) })).filter(x => x.pct !== null) }))
    .filter(r => r.pts.length === players.length);
  if (!rows.length) return '';
  return `<div class="chart-card fp-card"><div class="chart-title">${icon('chart')} ${opts.title || 'Fingerprint'}</div>
    ${opts.sub ? `<p class="muted fx-note">${opts.sub}</p>` : ''}
    <div class="fp-legend">${players.map((p, i) => `<span class="fp-key"><i style="background:${colors[i]}"></i>${p.Player}</span>`).join('')}</div>
    <div class="fp-head"><span class="fp-label muted">percentile</span><div class="fp-scale"><span>0</span><span>50</span><span>100</span></div></div>
    ${rows.map(r => {
      const lo = Math.min(...r.pts.map(x => x.pct)), hi = Math.max(...r.pts.map(x => x.pct));
      const tip = r.pts.map(x => `${x.p.Player}: ${r.m.fmt(x.v)} (${ordinalRank(x.pct)} pct.)`).join(' · ');
      return `<div class="fp-row" title="${tip}"><span class="fp-label">${r.m.label}</span>
        <span class="fp-track"><i class="fp-tick" style="left:0"></i><i class="fp-tick" style="left:50%"></i><i class="fp-tick" style="left:100%"></i>
          <i class="fp-span" style="left:${lo}%;width:${hi - lo}%"></i>${[...r.pts].sort((a, b) => a.i - b.i).map(x => `<i class="fp-dot" style="left:${x.pct}%;background:${colors[x.i]}"></i>`).join('')}</span></div>`;
    }).join('')}
    <p class="muted fx-note">Percentile among all retired players with career stats (100 = best). Tap or hover a row for the values.</p></div>`;
}

// Franchise stat tiles: value, league rank and a bar for where that rank sits
function franchiseStats(teamName) {
  const teams = DB.teams.filter(t => !t.defunct);
  const fin = Object.fromEntries(finalsByFranchise().map(r => [r.team, r.w + r.l]));
  const allTime = t => { let w = 0, l = 0; Object.values(t.seasonRecords || {}).forEach(r => { w += r.w || 0; l += r.l || 0; }); return w + l ? w / (w + l) : null; };
  const num = v => { const x = getNum(v); return x === -Infinity ? null : x; };
  const metrics = [
    ['Titles', t => num(t.Championship) ?? 0, v => v],
    ['Finals', t => fin[t.Team] || 0, v => v],
    ['Conf titles', t => num(t['Conference Titles']) ?? 0, v => v],
    ['Playoffs', t => num(t.Playoffs) ?? 0, v => v],
    ['Win %', allTime, v => (v * 100).toFixed(1)],
    ['Glory', t => num(t['Glory Score']), v => Math.round(v).toLocaleString()],
    ['Div titles', t => num(t['Division Titles']) ?? 0, v => v],
    ['Wins, 5 yrs', t => num(t['Avg. W Last 5Y']), v => v.toFixed(1)],
    ['Wins, 10 yrs', t => num(t['Avg. W Last 10Y']), v => v.toFixed(1)],
  ];
  const me = teams.find(t => t.Team === teamName); if (!me) return '';
  const tiles = metrics.map(([label, get, fmt]) => {
    const v = get(me); if (v === null || v === undefined) return '';
    const vals = teams.map(get).filter(x => x !== null && x !== undefined);
    const rank = vals.filter(x => x > v).length + 1, tie = vals.filter(x => x === v).length > 1, n = vals.length;
    const fill = n > 1 ? Math.round((n - rank) / (n - 1) * 100) : 100;
    return `<div class="fs-tile"><div class="fs-label">${label}</div><div class="fs-val">${fmt(v)}</div>
      <div class="fs-foot"><div class="fs-bar"><i style="width:${Math.max(fill, 3)}%"></i></div><span class="fs-rank">${tie ? 'T-' : ''}${ordinalRank(rank)}</span></div></div>`;
  }).join('');
  return `<div class="chart-card fs-card"><div class="card-head"><div class="chart-title">${icon('chart')} Franchise Stats</div><span class="muted fs-note">rank of ${teams.length}</span></div>
    <div class="fs-grid">${tiles}</div>
    <p class="muted fx-note">Win % is all-time since the franchise began; wins are the average per season over the last 5 and 10 seasons.</p></div>`;
}

// Team page: the latest season at a glance, over a faded logo
function teamSeasonCard(teamName) {
  const t = DB.teams.find(x => x.Team === teamName); if (!t) return '';
  const yr = DB.latestSeason, rec = t.seasonRecords?.[yr]; if (!rec) return '';
  const st = seasonStandings(yr), me = st.find(r => r.team === teamName); if (!me) return '';
  const conf = st.filter(r => r.conf === me.conf).sort((a, b) => b.raw - a.raw), top = conf[0];
  const gb = top === me ? '—' : (((top.w - me.w) + (me.l - top.l)) / 2).toString().replace(/\.0$/, '');
  const { champ, ru } = finalsTeams(yr);
  const result = champ === teamName ? `${icon('trophy', 'ic-champ')} Champion` : ru === teamName ? `${icon('trophy', 'ic-silver')} Lost the Finals` : me.playoffs ? 'Playoffs' : 'Missed playoffs';
  const prev = t.seasonRecords?.[yr - 1];
  const pct = r => r.w / Math.max(1, r.w + r.l);
  const delta = prev ? Math.round((pct(rec) - pct(prev)) * 82) : null;
  const mi = mostImproved(yr), best = [...st].sort((a, b) => b.raw - a.raw)[0];
  const badge = best && best.team === teamName ? 'Best record in the league' : mi && mi.team === teamName ? 'Most improved team' : '';
  return `<section class="ts-card">
    <div class="ts-mark" aria-hidden="true">${teamLogo(teamName, 'ts-logo')}</div>
    <div class="ts-main"><div class="ts-kicker">${seasonLabel(yr)} season</div>
      <div class="ts-rec">${me.w}-${me.l}</div>
      <div class="ts-sub">${ordinalRank(me.confRk)} in ${confName(me.conf)} · ${result}${badge ? ` · <span class="ts-badge">${badge}</span>` : ''}</div></div>
    <div class="ts-strip">
      <div><span>Games back</span><b>${gb}</b></div>
      <div><span>League rank</span><b>${ordinalRank(me.leagueRk)} of ${st.length}</b></div>
      <div><span>Last season</span><b>${prev ? `${prev.w}-${prev.l}` : '—'}</b></div>
      <div><span>Change</span><b class="${delta > 0 ? 'ts-up' : delta < 0 ? 'ts-down' : ''}">${delta === null ? '—' : (delta > 0 ? '+' : '') + delta + ' wins'}</b></div>
    </div></section>`;
}

// Header button: switch light and dark in one tap
function toggleThemeQuick() {
  const dark = document.documentElement.getAttribute('data-theme') === 'dark' || (!document.documentElement.getAttribute('data-theme') && matchMedia('(prefers-color-scheme: dark)').matches);
  setTheme(dark ? 'light' : 'dark'); syncThemeButton();
}
function syncThemeButton() {
  const b = document.getElementById('themeBtn'); if (!b) return;
  const dark = document.documentElement.getAttribute('data-theme') === 'dark' || (!document.documentElement.getAttribute('data-theme') && matchMedia('(prefers-color-scheme: dark)').matches);
  b.innerHTML = `<svg class="ic"><use href="#i-${dark ? 'sun' : 'moon'}"/></svg>`;
  b.setAttribute('aria-label', dark ? 'Switch to light mode' : 'Switch to dark mode'); b.title = b.getAttribute('aria-label');
}

// =====================================================================
// ALL-TIME LINEUP: best Guard-Guard-Forward-Forward-Center and 3 bench for a franchise.
// Only players with a clear tie to the team qualify: a retired number there, an award or stat
// title won there (NBA History logos, Season Stat Leader teams), or a listed champion or
// runner-up star there. They are ranked by a franchise score: what they did with this team.
// =====================================================================
function posGroup(pos) { const p = String(pos || '').toUpperCase(); return /^(PG|SG|G)$/.test(p) ? 'G' : /^(SF|PF|F)$/.test(p) ? 'F' : p === 'C' ? 'C' : ''; }
// Positions for players without a row: All-NBA and Decade team slots ("H.McDaniels" -> G)
function sheetPositions() {
  return cached('sheetPositions', () => {
    const out = {};
    const put = (name, pos) => { const g = posGroup(pos); if (!g || !name) return; const n = normName(String(name).replace(/\./g, '. ')); (out[n] = out[n] || {})[g] = ((out[n] || {})[g] || 0) + 1; };
    DB.allNbaSeasons.forEach(s => s.teams.forEach(t => t.slots.forEach(sl => put(sl.player, sl.pos))));
    (DB.decades || []).forEach(d => (d.starter || []).forEach((n, i) => put(n, (d.positions || [])[i])));
    return out;
  });
}
function guessPosition(name) {
  const sp = sheetPositions(), n = normName(name), parts = n.split(' '), abbr = parts.length > 1 ? parts[0][0] + ' ' + parts.slice(1).join(' ') : n;
  const hit = sp[n] || sp[abbr]; if (!hit) return '';
  return Object.entries(hit).sort((a, b) => b[1] - a[1])[0][0];
}
function franchiseLineup(team) {
  return cached('lineup|' + team, () => {
    const w = legacyWeights(), ctx = legacyContext(), q = {};
    const get = (name, yr) => { const p = resolvePlayer(name, yr), k = p ? p.Player : String(name).trim(); return (q[k] = q[k] || { key: k, p, name: k, here: { mvp: [], fmvp: [], dpoy: [], roty: [], stat: [], titles: [], finals: [] }, retired: null }); };
    retiredForTeam(team).filter(r => r.type === 'Player').forEach(r => { get(r.player).retired = r.num; });
    DB.history.forEach(h => {
      const yr = Number(h.Season), f = finalsTeams(yr);
      [['MVP', 'mvp'], ['FMVP', 'fmvp'], ['DPOY', 'dpoy'], ['ROTY', 'roty']].forEach(([k, key]) => { if (h[k] && h[k] !== '-' && h[k + 'Team'] === team) coNames(h[k]).forEach(n => get(n, yr).here[key].push(yr)); });
      if (f.champ === team) [h.Star1, h.Star2, h.Star3].forEach(x => { if (x) get(String(x).replace(/\s*\(\d+\)\s*$/, '').trim(), yr).here.titles.push(yr); });
      if (f.ru === team) [h.RU1, h.RU2, h.RU3].forEach(x => { if (x) get(String(x).replace(/\s*\(\d+\)\s*$/, '').trim(), yr).here.finals.push(yr); });
    });
    const statW = { Pts: w.ptsTitle, Reb: w.rebTitle, Ast: w.astTitle, Stl: w.stlTitle, Blk: w.blkTitle };
    DB.statLeaders.forEach(r => Object.keys(statW).forEach(k => { if (r[k + 'Leader'] && teamByCode(r[k + 'Team'])?.Team === team) get(r[k + 'Leader'], r.Season).here.stat.push({ yr: Number(r.Season), w: statW[k], k }); }));
    // Franchise score
    const list = Object.values(q).map(x => {
      const p = x.p, H = x.here;
      // Title and Finals roles as the legacy score values them (franchise player, co-star...)
      const role = (map, yrs, fallback) => yrs.reduce((a, yr) => { const r = p && (ctx[map][p.Player] || []).find(z => z.yr === yr); return a + (r ? w[r.key] : fallback); }, 0);
      let score = H.mvp.length * w.mvp + H.fmvp.length * w.fmvp + H.dpoy.length * w.dpoy + H.roty.length * w.roy + H.stat.reduce((a, s) => a + s.w, 0)
        + role('roles', H.titles, w.roleCore) + role('ruRoles', H.finals, w.ruCore) + (x.retired !== null ? 100 : 0);
      // Titles won here without being a listed champion star (red team cells in the player sheet)
      // count as a rotation player's title
      const rowTitles = p ? titlesWithTeam(p, team) : 0, extraTitles = Math.max(0, rowTitles - H.titles.length);
      score += extraTitles * w.roleRotation;
      const titleCount = H.titles.length + extraTitles;
      // Career parts with no season (All-Stars, All-NBA, production) count by the share of the
      // career spent here: a one-team career gets all of it
      let share = 0;
      if (p) {
        const teams = playerTeams(p), uniq = new Set(teams);
        share = uniq.has(team) ? (uniq.size === 1 ? 1 : 1 / uniq.size) : 0;
        const L = legacy(p).parts; score += share * ((L.allStar || 0) + (L.production || 0) + (L.teams || 0) + (L.other || 0) * 0.5);
      }
      const pos = p ? posGroup(p.Position) : guessPosition(x.name);
      const tags = [];
      if (titleCount) tags.push(`${titleCount} title${titleCount > 1 ? 's' : ''}`);
      if (H.mvp.length) tags.push(`${H.mvp.length > 1 ? H.mvp.length + ' ' : ''}MVP${H.mvp.length > 1 ? 's' : ''}`);
      if (H.fmvp.length) tags.push(`${H.fmvp.length > 1 ? H.fmvp.length + ' ' : ''}Finals MVP${H.fmvp.length > 1 ? 's' : ''}`);
      if (H.dpoy.length) tags.push(`${H.dpoy.length > 1 ? H.dpoy.length + ' ' : ''}DPOY`);
      if (H.stat.length) tags.push(`${H.stat.length} stat title${H.stat.length > 1 ? 's' : ''}`);
      if (H.finals.length) tags.push(`${H.finals.length} conf. title${H.finals.length > 1 ? 's' : ''}`);
      if (H.roty.length) tags.push('ROTY');
      if (x.retired !== null) tags.push(`#${x.retired} retired`);
      return { ...x, score, pos, tags, oneTeam: share === 1 };
    }).filter(x => x.score > 0).sort((a, b) => b.score - a.score);
    // Starting five: 2 guards, 2 forwards, 1 center; bench: the next 3 of any position
    const starters = [], need = { G: 2, F: 2, C: 1 };
    list.forEach(x => { if (x.pos && need[x.pos] > 0) { need[x.pos]--; starters.push(x); } });
    // A position with no qualifying player goes to the best remaining player with a known
    // position (a team with no center plays G-G-G-F-F or G-G-F-F-F)
    let open = Object.values(need).reduce((a, b) => a + b, 0);
    list.forEach(x => { if (open > 0 && x.pos && !starters.includes(x)) { starters.push(x); open--; } });
    Object.keys(need).forEach(k => need[k] = 0); if (open > 0) need.F = open;
    const order = { G: 0, F: 1, C: 2 }; starters.sort((a, b) => order[a.pos] - order[b.pos] || b.score - a.score);
    const bench = list.filter(x => !starters.includes(x)).slice(0, 3);
    return { list, starters, bench, open: need };
  });
}
function franchiseLineupHtml(team) {
  const L = franchiseLineup(team);
  if (L.list.length < 5) return `<div class="chart-card lu-card"><div class="chart-title">${icon('people')} All-Time Lineup</div><p class="muted">Not enough franchise history yet: ${L.list.length} player${L.list.length === 1 ? '' : 's'} with a retired number, award or Finals star role here.</p></div>`;
  const posName = { G: 'Guard', F: 'Forward', C: 'Center' };
  const card = (x, slot) => `<div class="lu-player${slot ? '' : ' lu-bench'}">
      <span class="lu-pos">${slot || (x.pos || '—')}</span>
      <span class="lu-name">${x.p ? nameLink(x.p.Player) : `<span class="name-plain">${x.name}</span>`}</span>
      <span class="lu-tags">${x.tags.join(' · ') || (x.oneTeam ? 'one-team career' : '')}</span></div>`;
  const slots = [...L.starters.map(x => card(x, x.pos)), ...Object.entries(L.open).flatMap(([pos, n]) => Array(n).fill(`<div class="lu-player lu-open"><span class="lu-pos">${pos}</span><span class="lu-name muted">No qualifying ${posName[pos].toLowerCase()}</span></div>`))];
  return `<div class="chart-card lu-card"><div class="chart-title">${icon('people')} All-Time Lineup</div>
    <div class="lu-label">Starting five</div><div class="lu-five">${slots.join('')}</div>
    ${L.bench.length ? `<div class="lu-label">Bench</div><div class="lu-five lu-bench-row">${L.bench.map(x => card(x)).join('')}</div>` : ''}
    <p class="muted fx-note">Players with a retired number, an award or stat title won here, or a champion or runner-up star role here. Ranked by what they did with this team; career stats count by the share of the career spent here.</p></div>`;
}
