// 2K17 NBA Stats Database · Section navigation, sub-tabs, Home leaders, All Players, Top 20 and By Position.
// Loaded in order by index.html; all files share one global scope.

// =====================================================================
// SECTION NAVIGATION
// =====================================================================
const SECTIONS = ['overview','players','top20','bypos','current','draft','compare','player','legacy','settings','teams','team','awards','season','history','statleaders','allnba','decades','records','leaders'];
function showSection(id) {
  if (!SECTIONS.includes(id)) id = 'overview';
  document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
  document.getElementById('sec-' + id).classList.add('active');
  // Masthead highlights the section; the sub-nav shows only that section's pages
  const group = document.querySelector(`#mainNav button[data-sec="${id}"]`)?.dataset.group;
  document.querySelectorAll('#groupNav button').forEach(b => b.classList.toggle('active', b.dataset.group === group));
  const pages = [...document.querySelectorAll('#mainNav button')];
  pages.forEach(b => { b.hidden = b.dataset.group !== group; b.classList.toggle('active', b.dataset.sec === id); });
  document.getElementById('subnav').hidden = pages.filter(b => !b.hidden).length < 2;
  // The active sub-tab already names the page, so its big title is hidden when it says the same thing
  const sec = document.getElementById('sec-' + id), tab = pages.find(b => b.dataset.sec === id && !b.hidden);
  const title = sec.querySelector(':scope > .section-title');
  if (title) {
    const norm = v => String(v).toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
    sec.classList.toggle('title-dup', !!tab && !document.getElementById('subnav').hidden && norm(title.textContent).includes(norm(tab.textContent)));
  }
  // Bring the active sub-tab into view without scrolling the page itself
  const navEl = document.getElementById('mainNav');
  if (tab && navEl.scrollWidth > navEl.clientWidth) navEl.scrollLeft = Math.max(0, tab.offsetLeft - (navEl.clientWidth - tab.offsetWidth) / 2);
  updateSubnavFade();
  // Remember the tab: in the address (refresh/bookmark) and for the next visit
  const hash = id === 'season' && seasonState.yr ? 'season-' + seasonState.yr
    : id === 'player' && playerState.p ? 'player-' + playerSlug(playerState.p.Player)
    : id === 'team' && teamState.t ? 'team-' + playerSlug(teamState.t) : id;
  if (location.hash.slice(1) !== hash) history.replaceState(null, '', '#' + hash);
  if (id === 'draft') renderDraft();
  if (id === 'awards') renderAwards();
  if (id === 'legacy') renderLegacy();
  if (id === 'settings') { renderSettings(); markDataProblemsSeen(); }
  if (id !== 'player' && id !== 'team') { try { localStorage.setItem('nba2k17-tab', id); } catch(e) {} }
}
// On phones each toolbar keeps its search box and folds the other controls
// behind one "Filters" button, which shows how many filters are in use
function setupToolbarToggles() {
  document.querySelectorAll('.toolbar').forEach(tb => {
    if (tb.dataset.toggle || !tb.querySelector('.search-wrap')) return;
    const controls = [...tb.children].filter(c => c.matches('select, button, label.check'));
    if (!controls.length) return;
    tb.dataset.toggle = '1'; tb.classList.add('has-toggle');
    const btn = document.createElement('button');
    btn.className = 'icon-btn tb-toggle'; btn.type = 'button';
    btn.setAttribute('aria-expanded', 'false');
    const count = () => controls.filter(c => (c.tagName === 'SELECT' && !c.classList.contains('m-sort') && c.selectedIndex > 0) || (c.matches('label.check') && c.querySelector('input').checked)).length;
    const label = () => { const n = count(); btn.innerHTML = `${tb.querySelector('select.m-sort') ? 'Filter &amp; Sort' : 'Filters'}${n ? ` <span class="tb-badge">${n}</span>` : ''}`; };
    btn.onclick = () => { const open = tb.classList.toggle('open'); btn.setAttribute('aria-expanded', String(open)); };
    tb.addEventListener('change', label);
    label();
    tb.querySelector('.search-wrap').after(btn);
  });
}
// Fade the sub-tab row's edge while more tabs are hidden off-screen
function updateSubnavFade() {
  const el = document.getElementById('mainNav');
  if (!el) return;
  const more = el.scrollWidth - el.clientWidth - el.scrollLeft > 4, less = el.scrollLeft > 4;
  el.classList.toggle('fade-right', more); el.classList.toggle('fade-left', less);
}
document.addEventListener('DOMContentLoaded', () => { document.getElementById('mainNav')?.addEventListener('scroll', updateSubnavFade, { passive: true }); });
window.addEventListener('resize', () => updateSubnavFade());
function restoreSection() {
  if (openSeasonFromHash() || openPlayerFromHash() || openTeamFromHash()) return;
  let id = location.hash.slice(1);
  if (!SECTIONS.includes(id)) { try { id = localStorage.getItem('nba2k17-tab'); } catch(e) { id = null; } }
  showSection(id || 'overview');
}
// Back/forward and edited addresses: reopen whatever the address points at
const followHash = () => { if (dataLoaded && !openSeasonFromHash() && !openPlayerFromHash() && !openTeamFromHash()) showSection(location.hash.slice(1)); };
window.addEventListener('hashchange', followHash);
window.addEventListener('popstate', followHash);

function closeModal() { document.getElementById('playerModal').classList.remove('open'); }
document.addEventListener('keydown', e => {
  if (e.key !== 'Escape') return;
  if (document.getElementById('playerModal').classList.contains('open')) closeModal();
  closeSearch();
  [1,2,3].forEach(n => { document.getElementById(`cmpDropdown${n}`).innerHTML = ''; });
});

// =====================================================================
// OVERVIEW
// =====================================================================
function initOverview() {
  const players = DB.allPlayers;
  const maxPts = Math.max(...players.map(p => getNum(p.PTS)));
  const ptLeader = players.find(p => getNum(p.PTS) === maxPts);
  const maxRings = Math.max(...players.map(p => getNum(p.Champions)));
  const ringLeader = players.find(p => getNum(p.Champions) === maxRings);
  const maxMvp = Math.max(...players.map(p => getNum(p.MVP)));
  const mvpLeader = players.find(p => getNum(p.MVP) === maxMvp);

  document.getElementById('overviewSub').textContent = `Career awards and statistics · ${players.length} players`;
  document.getElementById('playersSub').textContent = `${players.length} Players — Career Stats`;
  document.getElementById('teamsSub').textContent = `All-Time Franchise Performance — ${DB.teams.length} Teams`;

  const leaderTile = (label, p, value) => `<div class="stat-card"><div class="label">${label}</div>
    <div class="value value-name">${p ? nameLink(p.Player) : '—'}</div><div class="sub">${value}</div></div>`;
  document.getElementById('overviewCards').innerHTML = [
    leaderTile('Career Points', ptLeader, maxPts.toLocaleString() + ' points'),
    leaderTile('Most Titles', ringLeader, maxRings + ' championships'),
    leaderTile('Most MVPs', mvpLeader, maxMvp + ' MVP awards'),
  ].join('');

  // One series per chart, so one color per chart
  buildRecordTabs('atr', DB.awardRecords,
    {MVP:'MVP', Champions:'Titles', FMVP:'Finals MVP', DOTY:'DPOY'}, ['bar-fill-champ']);
  buildRecordTabs('stat', DB.allTimeStats,
    {PTS:'Points', REB:'Rebounds', AST:'Assists', STL:'Steals', BLK:'Blocks', GP:'Games', MIN:'Minutes', FGM:'Field Goals', FTM:'Free Throws', '3PM':'3-Pointers', DD2:'Double-Doubles', TD3:'Triple-Doubles', TO:'Turnovers'},
    ['bar-fill-pts']);
}

// Tab row + top-20 bar chart per category, used for award and stat records.
// prefix picks the elements (#atrTabs/#atrContent, #statTabs/#statContent).
function buildRecordTabs(prefix, categories, labels, colors) {
  const tabs = document.getElementById(prefix + 'Tabs');
  const content = document.getElementById(prefix + 'Content');
  tabs.innerHTML = ''; content.innerHTML = '';
  const num = v => parseFloat(String(v).replace(/,/g,'')) || 0;
  const shown = categories.filter(cat => cat.entries.length);
  shown.forEach((cat, i) => {
    const btn = document.createElement('button');
    btn.className = 'atr-tab' + (i===0?' active':'');
    btn.textContent = labels[cat.name] || cat.name;
    const div = document.createElement('div');
    div.className = 'atr-section' + (i===0?' active':'');
    btn.onclick = () => {
      tabs.querySelectorAll('.atr-tab').forEach(b => b.classList.remove('active'));
      content.querySelectorAll('.atr-section').forEach(sec => sec.classList.remove('active'));
      btn.classList.add('active');
      div.classList.add('active');
    };
    const rows = withRanks(cat.entries.slice(0, 20), e => num(e.value));
    div.innerHTML = `<ol class="ldr-list">${rows.map(e => {
      const p = resolvePlayer(e.player), span = p && careerSpan(p.Season);
      const pg = p && PER_GAME_COL[cat.name] ? perGame(p, cat.name) : null;
      const sub = p ? posBadge(p.Position) + ' ' + [span ? `${span[0]}–${span[1] === Infinity ? 'now' : span[1]}` : '',
        pg != null && isFinite(pg) ? `${pg.toFixed(1)} per game` : ''].filter(Boolean).join(' · ') : '';
      return `<li class="ldr-row${e.rank <= 3 ? ' ldr-top' : ''}"><span class="ldr-rank">${e.rank}</span>
        <span class="ldr-name">${nameLink(e.player)}${sub ? `<small>${sub}</small>` : ''}</span>
        <span class="ldr-val">${e.value}</span></li>`; }).join('')}</ol>`;
    tabs.appendChild(btn);
    content.appendChild(div);
  });
}

// =====================================================================
// ALL PLAYERS
// =====================================================================
let playersState = { filtered: [], page: 1, perPage: 30 };
// The same four filters (team, decade, draft, honors) on every player list. All Players has them in
// its HTML; Top 20, By Position and Active Players get copies here, with ids prefixed by the list.
const FILTER_LISTS = { player: 'filterPlayers', top20: 'filterTop20', pos: 'filterPos', cur: 'filterCurrent' };
function addFilterMenus() {
  const proto = ['Team', 'Decade', 'Draft', 'Honor'].map(k => document.getElementById('player' + k + 'Filter'));
  Object.entries(FILTER_LISTS).forEach(([prefix, fn]) => {
    if (prefix === 'player' || document.getElementById(prefix + 'TeamFilter')) return;
    const tb = document.querySelector(`#sec-${{ top20: 'top20', pos: 'bypos', cur: 'current' }[prefix]} .toolbar`);
    const anchor = tb.querySelector('.search-wrap ~ select:not(.m-sort)') || tb.querySelector('.search-wrap');
    let after = anchor;
    proto.forEach(src => {
      const el = src.cloneNode(true);
      el.id = src.id.replace(/^player/, prefix); el.setAttribute('onchange', fn + '()'); el.value = '';
      after.after(el); after = el;
    });
  });
}
function populatePlayerFilters() {
  addFilterMenus();
  const fill = (id, opts) => { const el = document.getElementById(id); const keep = el.value; el.innerHTML = el.options[0].outerHTML + opts.map(([v, l]) => `<option value="${v}">${l}</option>`).join(''); el.value = opts.some(([v]) => String(v) === keep) ? keep : ''; };
  const everyone = everyPlayer();
  const teamsAll = [...new Set(everyone.flatMap(playerTeams))].filter(t => DB.teams.some(x => x.Team === t)).sort();
  const fillAll = (k, opts) => Object.keys(FILTER_LISTS).forEach(pf => fill(pf + k + 'Filter', opts));
  fillAll('Team', teamsAll.map(t => [t, t]));
  const decades = new Set();
  everyone.forEach(p => { const sp = careerSpan(p.Season); if (!sp) return; for (let d = Math.floor((sp[0] - 1) / 10) * 10; d <= Math.min(sp[1], DB.latestSeason || 3000) - 1; d += 10) decades.add(d); });
  fillAll('Decade', [...decades].sort((a, b) => b - a).map(d => [d, `${d}s`]));
  const drafts = new Set(); let undrafted = false;
  everyone.forEach(p => { const d = draftInfo(p); if (!d) return; if (d.kind === 'undrafted') undrafted = true; else if (d.year) drafts.add(d.year); });
  fillAll('Draft', [...[...drafts].sort((a, b) => b - a).map(y => [y, `${y} draft`]), ...(undrafted ? [['undrafted', 'Undrafted']] : [])]);
}
// prefix picks the list's menus ('player', 'top20', 'pos', 'cur'). Rows from the Top 20 and
// position sheets are matched to the player's full row so teams, draft and honors are known.
function playerMatchesFilters(row, prefix = 'player') {
  const v = k => document.getElementById(prefix + k + 'Filter')?.value;
  const team = v('Team'), dec = v('Decade'), draft = v('Draft'), honor = v('Honor');
  if (!team && !dec && !draft && !honor) return true;
  const p = (prefix === 'top20' || prefix === 'pos') ? (resolvePlayer(row.Player) || row) : row;
  if (team && !playerTeams(p).includes(team)) return false;
  if (dec) { const sp = careerSpan(p.Season), d = Number(dec); if (!sp || sp[0] - 1 > d + 9 || sp[1] - 1 < d) return false; }
  if (draft) { const d = draftInfo(p); if (!d || (draft === 'undrafted' ? d.kind !== 'undrafted' : d.year !== Number(draft))) return false; }
  if (honor) {
    if (honor === 'ROY') { if (!/^o$/i.test(String(p.ROTY || '').trim())) return false; }
    else { const [k, min] = honor.split(':'); if (!(getNum(p[k]) >= Number(min))) return false; }
  }
  return true;
}
function filterPlayers() {
  const q = document.getElementById('playerSearch').value.toLowerCase();
  const pos = document.getElementById('playerPosFilter').value;
  playersState.filtered = DB.allPlayers.filter(p =>
    (!q || String(p.Player||'').toLowerCase().includes(q) || String(p.Team||'').toLowerCase().includes(q)) &&
    (!pos || p.Position === pos) && playerMatchesFilters(p)
  );
  playersState.page = 1;
  document.getElementById('playerCount').textContent = playersState.filtered.length + ' players';
  renderPlayers();
}
function renderPlayers() {
  const { filtered, page, perPage } = playersState;
  const mode = modes.players;
  const sorted = sortedByMode(filtered, 'players', mode);
  const slice = sorted.slice((page-1)*perPage, page*perPage);
  const si = col => { const s = sortStates.players||{}; return s.col===col?(s.dir>0?' ↑':' ↓'):''; };
  document.getElementById('playersHead').innerHTML = `
    <th class="stick-1 rank-col">#</th>
    <th class="stick-2" onclick="onSort('players','Player')">Player${si('Player')}</th>
    <th>Pos</th>
    <th onclick="onSort('players','Season')">Season${si('Season')}</th>
    ${buildPlayerHead('players', mode)}`;
  document.getElementById('playersBody').innerHTML = slice.map((p, i) =>
    buildPlayerRow(p, 'players', mode, (page-1)*perPage+i+1, true)).join('');
  document.getElementById('playersCards').innerHTML = slice.map((p, i) => playerCard(p, (page-1)*perPage+i+1, mode)).join('');
  renderPag('playersPag', filtered.length, perPage, page, 'goPlayersPage');
}
function goPlayersPage(p) { playersState.page = p; renderPlayers(); }

// =====================================================================
// TOP 20
// =====================================================================
let top20State = { filtered: [], page: 1, perPage: 20 };
function filterTop20() {
  const q = document.getElementById('top20Search').value.toLowerCase();
  top20State.filtered = DB.top20.filter(p => (!q || String(p.Player||'').toLowerCase().includes(q)) && playerMatchesFilters(p, 'top20'));
  top20State.page = 1;
  document.getElementById('top20Count').textContent = top20State.filtered.length + ' players';
  renderTop20();
}
function renderTop20() {
  const { filtered, page, perPage } = top20State;
  const mode = modes.top20;
  const sorted = sortedByMode(filtered, 'top20', mode);
  const slice = sorted.slice((page-1)*perPage, page*perPage);
  const si = col => { const s = sortStates.top20||{}; return s.col===col?(s.dir>0?' ↑':' ↓'):''; };
  document.getElementById('top20Head').innerHTML = `<th class="stick-1 rank-col" onclick="onSort('top20','Rank')">#${si('Rank')}</th>
    <th class="stick-2" onclick="onSort('top20','Player')">Player${si('Player')}</th>
    <th onclick="onSort('top20','Season')">Season${si('Season')}</th>
    ${buildPlayerHead('top20', mode)}`;
  document.getElementById('top20Body').innerHTML = slice.map(p =>
    buildPlayerRow(p, 'top20', mode, p.Rank || '—', false)).join('');
  document.getElementById('top20Cards').innerHTML = slice.map(p => playerCard(p, p.Rank || '—', mode)).join('');
  renderPag('top20Pag', filtered.length, perPage, page, 'goTop20Page');
}
function goTop20Page(p) { top20State.page = p; renderTop20(); }

// =====================================================================
// BY POSITION
// =====================================================================
let posState = { cur: 'PG', filtered: [], page: 1, perPage: 25 };
function initPos() {
  ['PG','SG','SF','PF','C'].forEach(pos => {
    const el = document.getElementById('cnt-' + pos);
    if (el) el.textContent = '(' + (DB.positions[pos]||[]).length + ')';
  });
  switchPos('PG');
}
function switchPos(pos) {
  posState.cur = pos; posState.page = 1;
  document.querySelectorAll('#posTabs .sub-tab').forEach((b,i) =>
    b.classList.toggle('active', ['PG','SG','SF','PF','C'][i] === pos));
  filterPos();
}
function filterPos() {
  const q = document.getElementById('posSearch').value.toLowerCase();
  posState.filtered = (DB.positions[posState.cur]||[]).filter(p =>
    (!q || String(p.Player||'').toLowerCase().includes(q)) && playerMatchesFilters(p, 'pos'));
  posState.page = 1;
  renderPos();
}
function renderPos() {
  const { filtered, page, perPage } = posState;
  const mode = modes.pos;
  const sorted = sortedByMode(filtered, 'pos', mode);
  const slice = sorted.slice((page-1)*perPage, page*perPage);
  const si = col => { const s = sortStates.pos||{}; return s.col===col?(s.dir>0?' ↑':' ↓'):''; };
  document.getElementById('posHead').innerHTML = `<th class="stick-1 rank-col" onclick="onSort('pos','Rank')">#${si('Rank')}</th>
    <th class="stick-2" onclick="onSort('pos','Player')">Player${si('Player')}</th>
    <th onclick="onSort('pos','Season')">Season${si('Season')}</th>
    ${buildPlayerHead('pos', mode)}`;
  document.getElementById('posBody').innerHTML = slice.map(p =>
    buildPlayerRow(p, 'pos', mode, p.Rank || '—', false)).join('');
  document.getElementById('posCards').innerHTML = slice.map(p => playerCard(p, p.Rank || '—', mode)).join('');
  renderPag('posPag', filtered.length, perPage, page, 'goPosPage');
}
function goPosPage(p) { posState.page = p; renderPos(); }
