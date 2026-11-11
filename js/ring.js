// 2K17 NBA Stats Database · Ring of Honor: every retired number in the league in one place
// (Retired # tab merged with the # Retired columns of All Players, as on each team page).

function ringData() {
  return cached('ringData', () => DB.teams.filter(t => !t.defunct).flatMap(t => retiredForTeam(t.Team).map(r => ({ ...r, team: t.Team, numKey: String(r.num).trim() }))));
}
const ringState = { q: '', team: '', kind: 'players' };
function setRingKind(k) { ringState.kind = k; renderRingList(); document.querySelectorAll('#ringKind button').forEach(b => b.classList.toggle('active', b.dataset.k === k)); }
function renderRing() {
  const all = ringData(), players = all.filter(r => r.type === 'Player');
  const el = document.getElementById('ringContent');
  if (!all.length) { el.innerHTML = '<p class="muted">No retired numbers recorded yet.</p>'; return; }
  // Players honored by two or more franchises
  const byPlayer = {};
  players.forEach(r => (byPlayer[r.player] = byPlayer[r.player] || []).push(r));
  const multi = Object.entries(byPlayer).map(([player, rs]) => ({ player, rs, teams: new Set(rs.map(r => r.team)).size })).filter(x => x.teams >= 2)
    .sort((a, b) => b.teams - a.teams || a.player.localeCompare(b.player));
  // Franchises by count, and the most-retired jersey numbers
  const byTeam = {};
  all.forEach(r => { const e = (byTeam[r.team] = byTeam[r.team] || { players: 0, all: 0 }); e.all++; if (r.type === 'Player') e.players++; });
  const teams = Object.entries(byTeam).sort((a, b) => b[1].players - a[1].players || b[1].all - a[1].all);
  const byNum = {};
  players.filter(r => /^\d+$/.test(r.numKey)).forEach(r => (byNum[r.numKey] = byNum[r.numKey] || []).push(r));
  const nums = Object.entries(byNum).sort((a, b) => b[1].length - a[1].length || Number(a[0]) - Number(b[0]));
  const gameEra = players.filter(r => { const y = String(r.years || '').match(/\d{4}/g); return y && y.some(v => Number(v) > 2016); }).length;
  const tile = (label, value, sub) => `<div class="stat-card"><div class="label">${label}</div><div class="value">${value}</div><div class="sub">${sub || '&nbsp;'}</div></div>`;
  el.innerHTML = `
    <div class="stats-cards">
      ${tile('Retired numbers', players.length, `${all.length - players.length} more honors for coaches and others`)}
      ${tile('Honored by 2+ teams', multi.length, multi[0] ? `e.g. ${multi.slice(0, 2).map(m => m.player).join(', ')}` : '')}
      ${teams[0] ? tile('Most by a franchise', teams[0][1].players, teamCode(teams[0][0]) + ' players') : ''}
      ${nums[0] ? tile('Most-retired number', '#' + nums[0][0], `${nums[0][1].length} times`) : ''}
    </div>
    <div class="player-grid ring-grid">
      <div>
        <div class="toolbar ring-toolbar"><div class="search-wrap"><span class="icon"><svg class="ic"><use href="#i-search"/></svg></span><input type="text" placeholder="Search player, number..." oninput="ringState.q=this.value.toLowerCase();renderRingList()" aria-label="Search retired numbers"></div>
          <select onchange="ringState.team=this.value;renderRingList()" aria-label="Team"><option value="">All franchises</option>${teams.map(([t]) => t).sort().map(t => `<option value="${t}">${t}</option>`).join('')}</select>
          <div class="seg" id="ringKind">${[['players', 'Players'], ['all', 'Everyone'], ['game', 'Game era']].map(([k, l]) => `<button data-k="${k}" class="${ringState.kind === k ? 'active' : ''}" onclick="setRingKind('${k}')">${l}</button>`).join('')}</div></div>
        <div class="muted ring-count" id="ringCount"></div>
        <div id="ringList" class="ring-list"></div>
      </div>
      <div>
        <div class="chart-card rb-card"><div class="chart-title">${icon('people')} Honored by 2+ Teams</div>
          ${multi.length ? multi.map(m => `<div class="rb-row"><span class="rb-rank">${m.teams}</span><span class="rb-main">${m.rs.some(r => r.linked) ? nameLink(m.player) : `<span class="name-plain">${m.player}</span>`}</span><span class="rb-val"></span>
            <span class="rb-sub">${m.rs.map(r => `#${r.num} ${teamLink(r.team, teamCode(r.team))}`).join(' · ')}</span></div>`).join('') : '<p class="muted">No player is honored by two teams yet.</p>'}</div>
        <div class="chart-card rb-card"><div class="chart-title">${icon('jersey')} Most Retired Numbers</div>
          ${teams.slice(0, 10).map(([t, v], i) => `<div class="rb-row"><span class="rb-rank">${i + 1}</span><span class="rb-main">${teamLink(t)}</span><span class="rb-val">${v.players}</span>${v.all > v.players ? `<span class="rb-sub">+${v.all - v.players} coaches and others</span>` : ''}</div>`).join('')}</div>
        <div class="chart-card rb-card"><div class="chart-title">${icon('jersey')} Most-Retired Jersey Numbers</div>
          ${nums.slice(0, 10).map(([n, rs], i) => `<div class="rb-row"><span class="rb-rank">${i + 1}</span><span class="rb-main">#${n}</span><span class="rb-val">${rs.length}</span>
            <span class="rb-sub">${rs.slice(0, 4).map(r => r.player).join(', ')}${rs.length > 4 ? ` and ${rs.length - 4} more` : ''}</span></div>`).join('')}</div>
        ${gameEra ? `<p class="muted fx-note">${gameEra} of the ${players.length} player numbers were earned in the game era (after 2016).</p>` : ''}
      </div>
    </div>`;
  renderRingList();
}
function renderRingList() {
  const q = ringState.q, isGame = r => { const y = String(r.years || '').match(/\d{4}/g); return !!y && y.some(v => Number(v) > 2016); };
  const list = ringData().filter(r => (ringState.kind === 'all' || r.type === 'Player') && (ringState.kind !== 'game' || isGame(r)) && (!ringState.team || r.team === ringState.team) &&
    (!q || String(r.player).toLowerCase().includes(q) || ('#' + r.num).includes(q) || String(r.num) === q || r.team.toLowerCase().includes(q)));
  const groups = {};
  list.forEach(r => (groups[r.team] = groups[r.team] || []).push(r));
  document.getElementById('ringCount').textContent = `${list.length} honored · ${Object.keys(groups).length} franchises`;
  document.getElementById('ringList').innerHTML = Object.entries(groups).sort((a, b) => a[0].localeCompare(b[0])).map(([t, rs]) => `<div class="ring-team">
    <div class="ring-team-head">${teamLink(t)} <span class="muted">${rs.length}</span></div>
    <div class="ring-items">${rs.sort((a, b) => (parseInt(a.num) || 999) - (parseInt(b.num) || 999)).map(r => `<div class="ring-item">
      <span class="ring-num">${r.type === 'Player' ? r.num : '—'}</span>
      <span class="ring-who">${r.linked ? nameLink(r.player) : `<span class="name-plain">${r.player}</span>`}${r.type !== 'Player' ? ` <span class="muted">${r.type}</span>` : ''}${r.years ? `<span class="ring-years">${r.years}</span>` : ''}</span></div>`).join('')}</div></div>`).join('') || '<p class="muted">Nothing matches.</p>';
}
