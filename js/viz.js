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
