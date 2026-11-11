// Draft, not loaded by the site: Legacy Race (on hold while its season-by-season method is reworked)
// 2K17 NBA Stats Database · Legacy Race: how each player's legacy score built up season by season,
// and who held the #1 spot ("greatest of all time so far") at the end of each season.
//
// Each part of the legacy score is placed in the seasons it was earned: MVPs, Finals MVPs, DPOYs,
// title and Finals roles, All-NBA teams, stat titles and Rookie of the Year go to their season;
// parts the workbook has no season for (All-Star, production, All-Defense, other awards) are
// spread evenly over the career. The final season always adds up to today's legacy score.

function legacyTimeline(p) {
  return cached('legacyTimeline|' + p.Player, () => {
    const span = careerSpan(p.Season); if (!span) return null;
    const start = span[0], end = span[1] === Infinity ? DB.latestSeason : Math.min(span[1], DB.latestSeason);
    if (!(end >= start)) return null;
    const years = []; for (let y = start; y <= end; y++) years.push(y);
    const L = legacy(p).parts, ctx = legacyContext(), add = {};
    years.forEach(y => add[y] = 0);
    const n = k => { const v = getNum(p[k]); return v === -Infinity ? 0 : Math.round(v); };
    const spread = v => years.forEach(y => add[y] += v / years.length);
    // A part with `total` events, of which `seasons` are known: one equal share per event
    const place = (part, seasons, total) => {
      const v = L[part] || 0; if (!v) return;
      const known = seasons.filter(y => y in add), count = Math.max(total, known.length);
      if (!count) { spread(v); return; }
      known.forEach(y => add[y] += v / count);
      if (count > known.length) spread(v * (count - known.length) / count);
    };
    const histYears = k => DB.history.filter(h => h[k] && h[k] !== '-' && coNames(h[k]).some(nm => resolvePlayer(nm, h.Season) === p)).map(h => Number(h.Season));
    place('mvp', ctx.mvp[p.Player] || [], n('MVP'));
    place('fmvp', ctx.fmvp[p.Player] || [], n('FMVP'));
    place('dpoy', histYears('DPOY'), n('DPOY'));
    place('titles', (ctx.roles[p.Player] || []).map(r => r.yr), n('Champions'));
    place('finals', (ctx.ruRoles[p.Player] || []).map(r => r.yr), Math.max(0, n('Finals App') - n('Champions')));
    const allNba = []; DB.allNbaSeasons.forEach(s => s.teams.forEach(t => { if (t.slots.some(sl => resolvePlayer(sl.player, s.season) === p)) allNba.push(Number(s.season)); }));
    place('teams', allNba, n('1st Team') + n('2nd Team') + n('3rd Team') + n('1st D Team') + n('2nd D Team') + (/^(1st|2nd)$/.test(String(p.RookieTeam ?? p['Rookie Team'] ?? '').trim()) ? 1 : 0));
    const stat = []; ['Pts', 'Reb', 'Ast', 'Stl', 'Blk'].forEach(k => DB.statLeaders.forEach(r => { if (r[k + 'Leader'] && resolvePlayer(r[k + 'Leader'], r.Season) === p) stat.push(Number(r.Season)); }));
    place('statTitles', stat, stat.length);
    place('other', rotySeasons(p), (isRoty(p) ? 1 : 0) + 1);
    spread(L.allStar || 0); spread(L.production || 0);
    let run = 0; const cum = {};
    years.forEach(y => { run += add[y]; cum[y] = run; });
    return { start, end, cum };
  });
}
// Score at the end of a season: 0 before the career, the final total after it
function legacyAt(p, yr) {
  const t = legacyTimeline(p); if (!t || yr < t.start) return 0;
  return t.cum[Math.min(yr, t.end)];
}
// Who was #1 at the end of each season, and when the lead changed hands
function legacyRaceData() {
  return cached('legacyRace', () => {
    const ps = everyPlayer().filter(p => legacyTimeline(p));
    const first = Math.min(...ps.map(p => legacyTimeline(p).start)), last = DB.latestSeason;
    const seasons = []; for (let y = first; y <= last; y++) seasons.push(y);
    const leaders = seasons.map(yr => { let best = null, bs = 0; ps.forEach(p => { const s = legacyAt(p, yr); if (s > bs) { bs = s; best = p; } }); return { yr, p: best, score: bs }; });
    const changes = leaders.filter((l, i) => l.p && (!i || leaders[i - 1].p !== l.p));
    return { ps, seasons, leaders, changes };
  });
}

const raceState = { yr: null };
const RACE_COLORS = 6;
function renderRace() {
  const el = document.getElementById('raceContent');
  const { ps, seasons, leaders, changes } = legacyRaceData();
  if (!seasons.length) { el.innerHTML = '<p class="muted">No careers to chart yet.</p>'; return; }
  const yr = raceState.yr || DB.latestSeason;
  // Chart everyone who has been #1, then the closest challengers today, up to six lines;
  // colors follow the player in career order, so they don't change between seasons
  const holders = [...new Map(changes.map(c => [c.p.Player, c.p])).values()];
  const challengers = ps.filter(p => !holders.includes(p)).sort((a, b) => legacyAt(b, DB.latestSeason) - legacyAt(a, DB.latestSeason));
  const shown = [...holders.slice(-RACE_COLORS), ...challengers].slice(0, RACE_COLORS).sort((a, b) => legacyTimeline(a).start - legacyTimeline(b).start);
  const reign = p => leaders.filter(l => l.p === p).length;
  const top = ps.map(p => ({ p, s: legacyAt(p, yr) })).filter(x => x.s > 0).sort((a, b) => b.s - a.s).slice(0, 10);
  el.innerHTML = `
    <div class="stats-cards">
      <div class="stat-card"><div class="label">#1 today</div><div class="value value-name">${nameLink(leaders[leaders.length - 1].p.Player)}</div><div class="sub">since ${seasonLabel(changes[changes.length - 1].yr)}</div></div>
      <div class="stat-card"><div class="label">Times the lead changed</div><div class="value">${changes.length - 1}</div><div class="sub">${holders.length} players have been #1</div></div>
      <div class="stat-card"><div class="label">Longest at #1</div><div class="value value-name">${(() => { const best = holders.map(p => ({ p, n: reign(p) })).sort((a, b) => b.n - a.n)[0]; return `${nameLink(best.p.Player)}</div><div class="sub">${best.n} seasons`; })()}</div></div>
    </div>
    <div class="chart-card"><div class="chart-title">${icon('line')} Legacy score over time</div>
      <p class="muted fx-note">Everyone who has been #1${shown.length > holders.length ? ', plus the closest challengers today' : ''}. Hover or use the arrow keys to read a season.</p>
      <div class="race-legend">${shown.map((p, i) => `<span class="race-key"><i style="background:var(--race-${i + 1})"></i>${p.Player}</span>`).join('')}</div>
      <div id="raceChart" class="race-chart"></div>
    </div>
    <div class="player-grid">
      <div class="chart-card rb-card"><div class="card-head"><div class="chart-title">${icon('list')} Top 10 after</div>
        <select class="race-pick" onchange="raceState.yr=Number(this.value);renderRace()" aria-label="Season">${[...seasons].reverse().map(y => `<option value="${y}"${y === yr ? ' selected' : ''}>${seasonLabel(y)}</option>`).join('')}</select></div>
        ${top.map((x, i) => `<div class="rb-row"><span class="rb-rank">${i + 1}</span><span class="rb-main">${nameLink(x.p.Player)}</span><span class="rb-val">${Math.round(x.s).toLocaleString()}</span>
          <span class="rb-sub">${(() => { const t = legacyTimeline(x.p); return t.end < yr || (!isActive(x.p) && t.end <= yr) ? 'retired' : `season ${yr - t.start + 1}`; })()}</span></div>`).join('')}</div>
      <div class="chart-card rb-card"><div class="chart-title">${icon('crown')} Every change at #1</div>
        ${[...changes].reverse().map((c, i, arr) => { const prev = arr[i + 1]; return `<div class="rb-row"><span class="rb-rank">${seasonLink(c.yr, String(c.yr))}</span><span class="rb-main">${nameLink(c.p.Player)}</span>
          <span class="rb-val">${Math.round(c.score).toLocaleString()}</span><span class="rb-sub">${prev ? `passed ${prev.p.Player}` : 'first #1'} · ${reign(c.p)} season${reign(c.p) > 1 ? 's' : ''} at #1 in all</span></div>`; }).join('')}</div>
    </div>
    <p class="muted fx-note">Season-by-season scores place MVPs, titles, Finals roles, All-NBA teams and stat titles in the season they were won. Parts without a season (All-Stars, production, All-Defense) are spread evenly over the career, so the final season always matches today's legacy score.</p>`;
  drawRaceChart(shown, seasons);
}
function drawRaceChart(shown, seasons) {
  const el = document.getElementById('raceChart'); if (!el || !shown.length) return;
  const W = Math.max(el.clientWidth, 280), H = Math.min(360, Math.max(240, W * 0.5));
  // Phones: the legend names the lines; wider screens also label each line's end
  const labels = W >= 600, m = { l: 44, r: labels ? 104 : 12, t: 10, b: 26 }, pw = W - m.l - m.r, ph = H - m.t - m.b;
  const y0 = seasons[0], y1 = seasons[seasons.length - 1];
  const max = Math.max(...shown.map(p => legacyAt(p, y1)), 1);
  const x = yr => m.l + (yr - y0) / Math.max(1, y1 - y0) * pw, y = v => m.t + ph - v / max * ph;
  const step = [100, 250, 500, 1000, 2000].find(s => max / s <= 5) || 2000;
  let svg = '';
  for (let v = 0; v <= max; v += step) svg += `<line x1="${m.l}" x2="${m.l + pw}" y1="${y(v)}" y2="${y(v)}" class="race-grid"/><text x="${m.l - 6}" y="${y(v) + 4}" class="race-axis" text-anchor="end">${v.toLocaleString()}</text>`;
  const tick = (y1 - y0) / Math.max(1, Math.floor(pw / 70)), decade = [10, 20, 25, 50].find(d => d >= tick) || 50;
  for (let yr = Math.ceil(y0 / decade) * decade; yr <= y1; yr += decade) svg += `<text x="${x(yr)}" y="${H - 6}" class="race-axis" text-anchor="middle">${yr}</text>`;
  // End labels, nudged apart so they don't collide
  const ends = shown.map((p, i) => ({ i, p, v: legacyAt(p, y1), ly: y(legacyAt(p, y1)) })).sort((a, b) => a.ly - b.ly);
  ends.forEach((e, k) => { if (k && e.ly - ends[k - 1].ly < 14) e.ly = ends[k - 1].ly + 14; });
  shown.forEach((p, i) => {
    const t = legacyTimeline(p), pts = [];
    for (let yr = Math.max(t.start - 1, y0); yr <= y1; yr++) pts.push(`${x(yr).toFixed(1)},${y(legacyAt(p, yr)).toFixed(1)}`);
    svg += `<polyline points="${pts.join(' ')}" fill="none" stroke="var(--race-${i + 1})" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>`;
  });
  const last = nm => nm.split(' ').pop(), dup = nm => shown.filter(q => last(q.Player) === last(nm)).length > 1;
  if (labels) ends.forEach(e => { svg += `<text x="${m.l + pw + 6}" y="${e.ly + 4}" class="race-end">${dup(e.p.Player) ? e.p.Player[0] + '. ' + last(e.p.Player) : last(e.p.Player)}</text>`; });
  svg += `<line id="raceCross" class="race-cross" y1="${m.t}" y2="${m.t + ph}" x1="-10" x2="-10"/>`;
  el.innerHTML = `<svg width="100%" viewBox="0 0 ${W} ${H}" style="max-width:${W}px" tabindex="0" role="img" aria-label="Legacy score over time for ${shown.map(p => p.Player).join(', ')}">${svg}</svg><div class="race-tip" id="raceTip" hidden></div>`;
  const svgEl = el.querySelector('svg'), tip = el.querySelector('#raceTip'), cross = el.querySelector('#raceCross');
  let cur = y1;
  const show = yr => {
    cur = Math.max(y0, Math.min(y1, yr)); const cx = x(cur); cross.setAttribute('x1', cx); cross.setAttribute('x2', cx);
    const rows = shown.map((p, i) => ({ p, i, v: legacyAt(p, cur) })).sort((a, b) => b.v - a.v);
    tip.innerHTML = `<b>${seasonLabel(cur)}</b>${rows.map(r => `<div><i style="background:var(--race-${r.i + 1})"></i>${r.p.Player}<span>${r.v ? Math.round(r.v).toLocaleString() : '—'}</span></div>`).join('')}`;
    tip.hidden = false; const r = svgEl.getBoundingClientRect(), px = cx / W * r.width;
    tip.style.left = Math.min(Math.max(0, px + 12), r.width - tip.offsetWidth) + 'px';
  };
  const fromEvent = e => { const r = svgEl.getBoundingClientRect(); return Math.round(y0 + ((e.clientX - r.left) * W / r.width - m.l) / pw * (y1 - y0)); };
  svgEl.addEventListener('mousemove', e => show(fromEvent(e)));
  svgEl.addEventListener('touchstart', e => show(fromEvent(e.touches[0])), { passive: true });
  svgEl.addEventListener('touchmove', e => show(fromEvent(e.touches[0])), { passive: true });
  svgEl.addEventListener('mouseleave', () => { tip.hidden = true; cross.setAttribute('x1', -10); cross.setAttribute('x2', -10); });
  svgEl.addEventListener('keydown', e => { if (e.key === 'ArrowLeft') { e.preventDefault(); show(cur - 1); } if (e.key === 'ArrowRight') { e.preventDefault(); show(cur + 1); } });
  svgEl.addEventListener('focus', () => show(cur));
}
