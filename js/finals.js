// 2K17 NBA Stats Database · Finals page (every Finals head to head, upsets, matchups, rivalries)
// and the Finals card on player pages. Built from NBA History: Finals, Champion Stars, Runner-Up Stars.

// One entry per Finals: both teams and their listed stars ("Name (rating)")
const UPSET_GAP = 5;
function finalsData() {
  return cached('finalsData', () => DB.history.map(h => {
    const yr = Number(h.Season), { champ, ru } = finalsTeams(yr);
    if (isNaN(yr) || !champ || !ru) return null;
    const stars = list => list.filter(x => x && x !== '-').map(x => {
      const m = String(x).match(/^(.*?)\s*\((\d+)\)\s*$/), name = (m ? m[1] : String(x)).trim();
      const p = resolvePlayer(name, yr);
      return { name, key: p ? p.Player : name, p, r: m ? Number(m[2]) : null };
    });
    const cs = stars([h.Star1, h.Star2, h.Star3]), rs = stars([h.RU1, h.RU2, h.RU3]);
    const top = s => s.length && s[0].r !== null ? Math.max(...s.filter(x => x.r !== null).map(x => x.r)) : null;
    const ct = top(cs), rt = top(rs);
    // Star power: every listed star adds the points they are rated above 80, so depth counts
    // (three 95s = 45 beat a 97 + 88 = 25). An upset: the runner-up's star power was 5+ higher
    const power = s => s.reduce((a, x) => a + Math.max(0, (x.r ?? 80) - 80), 0);
    const cp = power(cs), rp = power(rs);
    const upset = cs.length && rs.length && rp - cp >= UPSET_GAP ? rp - cp : 0;
    return { yr, h, champ, ru, score: finalsScore(h), cs, rs, ct, rt, cp, rp, upset, fmvp: h.FMVP && h.FMVP !== '-' ? h.FMVP : null };
  }).filter(Boolean).sort((a, b) => b.yr - a.yr));
}
// Star duels: each team's top listed star against the other's, met in two or more Finals
function finalsRivalries() {
  return cached('finalsRivalries', () => {
    const pairs = {};
    const best = s => [...s].sort((a, b) => (b.r ?? 0) - (a.r ?? 0)).slice(0, 1);
    finalsData().forEach(f => best(f.cs).forEach(a => best(f.rs).forEach(b => {
      const [x, y] = [a.key, b.key].sort(), k = x + '|' + y;
      const e = (pairs[k] = pairs[k] || { x, y, n: 0, wins: { [x]: 0, [y]: 0 }, yrs: [] });
      e.n++; e.wins[a.key]++; e.yrs.push(f.yr);
    })));
    return Object.values(pairs).filter(e => e.n >= 2).sort((a, b) => b.n - a.n || Math.max(...b.yrs) - Math.max(...a.yrs));
  });
}
// Franchise pairs that met in the Finals more than once
function finalsMatchups() {
  return cached('finalsMatchups', () => {
    const m = {};
    finalsData().forEach(f => {
      const [x, y] = [f.champ, f.ru].sort(), k = x + '|' + y;
      const e = (m[k] = m[k] || { x, y, n: 0, wins: { [x]: 0, [y]: 0 }, yrs: [] });
      e.n++; e.wins[f.champ]++; e.yrs.push(f.yr);
    });
    return Object.values(m).filter(e => e.n >= 2).sort((a, b) => b.n - a.n || Math.max(...b.yrs) - Math.max(...a.yrs));
  });
}
// Finals won and lost by each franchise
function finalsByFranchise() {
  return cached('finalsByFranchise', () => {
    const t = {};
    finalsData().forEach(f => { (t[f.champ] = t[f.champ] || { w: 0, l: 0 }).w++; (t[f.ru] = t[f.ru] || { w: 0, l: 0 }).l++; });
    return Object.entries(t).map(([team, r]) => ({ team, ...r })).sort((a, b) => (b.w + b.l) - (a.w + a.l) || b.w - a.w);
  });
}

const finalsState = { filter: 'all', q: '', shown: 20 };
function setFinalsFilter(f) { finalsState.filter = f; finalsState.shown = 20; renderFinals(); }
function onFinalsSearch(v) { finalsState.q = v.toLowerCase(); finalsState.shown = 20; renderFinalsList(); }
function moreFinals() { finalsState.shown += 30; renderFinalsList(); }

// Star chips for one side of a Finals, each with the role the legacy score gives it
function finalsStars(list, yr, roleMap) {
  if (!list.length) return '<span class="muted">No stars listed</span>';
  return list.map(s => {
    const role = s.p && (legacyContext()[roleMap][s.p.Player] || []).find(r => r.yr === yr);
    return `<span class="fx-star">${nameLink(s.name, { season: yr })}${s.r !== null ? ` <b>${s.r}</b>` : ''}${role ? `<i>${role.label}</i>` : ''}</span>`;
  }).join('');
}
function finalsCard(f) {
  return `<div class="fx-card${f.upset ? ' fx-upset' : ''}">
    <div class="fx-head"><span class="fx-season">${seasonLink(f.yr)}</span>${f.upset ? `<span class="fx-badge" title="The runner-up's star power was ${f.upset} higher">Upset</span>` : ''}${f.cs.length && f.rs.length ? `<span class="fx-power" title="Star power: each listed star adds their rating above 80">star power ${f.cp} vs ${f.rp}</span>` : ''}<span class="fx-score">${f.h.Finals || ''}</span></div>
    <div class="fx-sides">
      <div class="fx-side fx-win"><div class="fx-team">${icon('trophy', 'ic-champ')} ${teamIn(f.champ, f.yr)}</div><div class="fx-stars">${finalsStars(f.cs, f.yr, 'roles')}</div>
        ${f.fmvp ? `<div class="fx-fmvp">Finals MVP · ${nameLink(f.fmvp, { season: f.yr })}</div>` : ''}</div>
      <div class="fx-side fx-lose"><div class="fx-team">${icon('trophy', 'ic-silver')} ${teamIn(f.ru, f.yr)}</div><div class="fx-stars">${finalsStars(f.rs, f.yr, 'ruRoles')}</div></div>
    </div></div>`;
}
function finalsMatches(f) {
  const q = finalsState.q;
  if (finalsState.filter === 'upsets' && !f.upset) return false;
  if (!q) return true;
  return String(f.yr).includes(q) || seasonLabel(f.yr).includes(q) || [f.champ, f.ru].some(t => t.toLowerCase().includes(q)) ||
    [...f.cs, ...f.rs].some(s => s.name.toLowerCase().includes(q)) || String(f.h.Finals || '').toLowerCase().includes(q);
}
function renderFinalsList() {
  const list = finalsData().filter(finalsMatches), shown = list.slice(0, finalsState.shown);
  document.getElementById('finalsCount').textContent = `${list.length} Finals`;
  document.getElementById('finalsList').innerHTML = shown.map(finalsCard).join('') +
    (list.length > shown.length ? `<button class="icon-btn fx-more" onclick="moreFinals()">Show more (${list.length - shown.length} left)</button>` : '') +
    (list.length ? '' : '<p class="muted">No Finals match.</p>');
}
function renderFinals() {
  const all = finalsData();
  if (!all.length) { document.getElementById('finalsContent').innerHTML = '<p class="muted">No Finals in NBA History yet.</p>'; return; }
  const upsets = all.filter(f => f.upset), riv = finalsRivalries(), mu = finalsMatchups(), fr = finalsByFranchise();
  const hasRu = all.some(f => f.rs.length);
  const tile = (label, value, sub) => `<div class="stat-card"><div class="label">${label}</div><div class="value value-name">${value}</div><div class="sub">${sub || '&nbsp;'}</div></div>`;
  const biggest = [...upsets].sort((a, b) => b.upset - a.upset || b.yr - a.yr)[0];
  const rivRow = e => { const [a, b] = [e.x, e.y]; return `<div class="rb-row"><span class="rb-rank">${e.n}</span><span class="rb-main">${nameLink(a)} <span class="muted">vs</span> ${nameLink(b)}</span>
    <span class="rb-val">${e.wins[a]}–${e.wins[b]}</span><span class="rb-sub">${e.yrs.slice().sort((p, q) => p - q).map(y => seasonLink(y)).join(', ')}</span></div>`; };
  const muRow = e => `<div class="rb-row"><span class="rb-rank">${e.n}</span><span class="rb-main">${teamLink(e.x, teamCode(e.x))} <span class="muted">vs</span> ${teamLink(e.y, teamCode(e.y))}</span>
    <span class="rb-val">${e.wins[e.x]}–${e.wins[e.y]}</span><span class="rb-sub">last met ${seasonLabel(Math.max(...e.yrs))}</span></div>`;
  document.getElementById('finalsContent').innerHTML = `
    <div class="stats-cards">
      ${tile('Finals played', all.length, `${seasonLabel(all[all.length - 1].yr)} to ${seasonLabel(all[0].yr)}`)}
      ${hasRu ? tile('Upsets', upsets.length, biggest ? `biggest: ${seasonLabel(biggest.yr)}, ${teamCode(biggest.champ)} over ${teamCode(biggest.ru)} (${biggest.cp} vs ${biggest.rp} star power)` : '') : ''}
      ${mu[0] ? tile('Most common Finals', `${teamCode(mu[0].x)} vs ${teamCode(mu[0].y)}`, `${mu[0].n} times`) : ''}
      ${riv[0] ? (() => { const sx = riv[0].x.split(' ').pop(), sy = riv[0].y.split(' ').pop(), same = sx === sy;
        return tile('Top Finals rivalry', same ? `${riv[0].x} vs ${riv[0].y}` : `${sx} vs ${sy}`, `${riv[0].n} Finals, ${riv[0].wins[riv[0].x]}–${riv[0].wins[riv[0].y]}`); })() : ''}
    </div>
    <div class="player-grid fx-grid">
      <div>
        <div class="toolbar fx-toolbar"><div class="search-wrap"><span class="icon"><svg class="ic"><use href="#i-search"/></svg></span><input type="text" placeholder="Search season, team, player..." value="${finalsState.q}" oninput="onFinalsSearch(this.value)" aria-label="Search Finals"></div>
          <div class="seg">${[['all', 'All Finals'], ['upsets', 'Upsets']].map(([k, l]) => `<button class="${finalsState.filter === k ? 'active' : ''}" onclick="setFinalsFilter('${k}')">${l}</button>`).join('')}</div></div>
        <div class="muted fx-count" id="finalsCount"></div>
        <div id="finalsList" class="fx-list"></div>
      </div>
      <div>
        ${hasRu ? `<div class="chart-card rb-card"><div class="chart-title">${icon('people')} Finals Rivalries</div>
          <p class="muted fx-note">Each team's top star against the other's, met in two or more Finals, with each one's wins.</p>
          ${riv.length ? riv.slice(0, 15).map(rivRow).join('') : '<p class="muted">No two stars have met twice yet.</p>'}</div>` : ''}
        <div class="chart-card rb-card"><div class="chart-title">${icon('trophy', 'ic-champ')} Most Common Finals</div>
          ${mu.slice(0, 10).map(muRow).join('') || '<p class="muted">No repeat matchups yet.</p>'}</div>
        <div class="chart-card rb-card"><div class="chart-title">${icon('list')} Finals Record by Franchise</div>
          ${fr.slice(0, 15).map((r, i) => `<div class="rb-row"><span class="rb-rank">${i + 1}</span><span class="rb-main">${teamLink(r.team)}</span><span class="rb-val">${r.w}–${r.l}</span><span class="rb-sub">${r.w + r.l} Finals</span></div>`).join('')}</div>
        ${hasRu ? `<p class="muted fx-note">Star power: each listed star adds the points they're rated above 80 (a 95 adds 15). Upset: the runner-up's star power was ${UPSET_GAP} or more higher than the champion's.</p>` : ''}
      </div>
    </div>`;
  renderFinalsList();
}

// Player page: every Finals the player was a listed star in (or Finals MVP), with the opponents
function playerFinalsHtml(p) {
  const rows = [];
  finalsData().forEach(f => {
    const won = f.cs.some(s => s.p === p) || (f.fmvp && resolvePlayer(f.fmvp, f.yr) === p), lost = f.rs.some(s => s.p === p);
    if (won) rows.push({ f, won: true, opp: f.ru, oppStars: f.rs });
    else if (lost) rows.push({ f, won: false, opp: f.champ, oppStars: f.cs });
  });
  if (!rows.length) return '';
  const w = rows.filter(r => r.won).length, l = rows.length - w;
  // Who they met most: opposing listed stars across their Finals
  const met = {};
  rows.forEach(r => r.oppStars.forEach(s => { const e = (met[s.key] = met[s.key] || { name: s.name, n: 0, w: 0 }); e.n++; if (r.won) e.w++; }));
  const rivals = Object.values(met).filter(e => e.n >= 2).sort((a, b) => b.n - a.n).slice(0, 3);
  // Score from the player's side: a 4-2 loss reads 2–4
  const score = r => { const m = String(r.f.score).match(/(\d+)\D+(\d+)/); return m ? (r.won ? `${m[1]}–${m[2]}` : `${m[2]}–${m[1]}`) : ''; };
  return `<div class="chart-card pf-card"><div class="chart-title" title="Finals where the player is listed as a champion or runner-up star, or was Finals MVP">${icon('trophy', 'ic-champ')} Finals</div>
    <div class="pf-sum fold-keep"><span class="pf-tally"><b class="pf-wn">${w}</b> won</span><span class="pf-tally"><b>${l}</b> lost</span></div>
    <div class="pf-list">${rows.sort((a, b) => b.f.yr - a.f.yr).map(r => `<div class="pf-row">
      <span class="pf-season">${seasonLink(r.f.yr)}</span>
      <span class="pf-res ${r.won ? 'pf-w' : 'pf-l'}">${r.won ? 'W' : 'L'}</span>
      <span class="pf-opp"><span class="pf-team">${r.won ? 'over' : 'to'} ${teamIn(r.opp, r.f.yr, teamCode(r.opp))}</span>${r.oppStars.length ? `<span class="pf-stars">${r.oppStars.slice(0, 2).map(s => s.name).join(', ')}${r.oppStars.length > 2 ? ' …' : ''}</span>` : ''}</span>
      <span class="pf-score">${score(r)}</span></div>`).join('')}</div>
    ${rivals.length ? `<div class="pf-rivals"><span>Most-met</span> ${rivals.map(e => `${nameLink(e.name)} <span class="muted">${e.w}–${e.n - e.w}</span>`).join(' · ')}</div>` : ''}</div>`;
}
