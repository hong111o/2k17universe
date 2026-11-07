// 2K17 NBA Stats Database · Formatting helpers, player-name matching, sorting, pagination and player table rows.
// Loaded in order by index.html; all files share one global scope.

// =====================================================================
// HELPERS
// =====================================================================
function numFmt(v) {
  if (v === null || v === undefined || v === '' || v === '-') return '-';
  const num = parseFloat(v);
  if (isNaN(num)) return String(v);
  return num.toLocaleString();
}
function pctFmt(v) {
  if (v === null || v === undefined || v === '-' || v === '') return '-';
  const num = parseFloat(v);
  return isNaN(num) ? '-' : num.toFixed(1) + '%';
}
function getNum(v) { const x = parseFloat(v); return isNaN(x) ? -Infinity : x; }
function posBadge(pos) { return pos ? `<span class="pos-badge pos-${pos}">${pos}</span>` : ''; }
function teamTags(row) {
  const teams = [];
  for (let i = 1; i <= 11; i++) {
    const k = i === 1 ? 'Team' : `Team${i}`;
    if (row[k]) teams.push(row[k]);
  }
  return [...new Set(teams)].map(t => `<span class="team-tag">${teamLink(t)}</span>`).join(' ');
}
function retiredNums(row) {
  return ['# Retired','# Retired2','# Retired3'].map(k => row[k]).filter(v => v && v !== 0 && v !== '');
}
function rankCls(r) { return r === 1 ? 'top1' : r === 2 ? 'top2' : r === 3 ? 'top3' : ''; }
function plink(name) {
  return `<span class="player-link" onclick="openPlayerModal('${String(name).replace(/'/g,"\\'")}')"><span>${name}</span></span>`;
}
function extractChampTeam(finals) {
  if (!finals) return '';
  const m = String(finals).match(/^([A-Z]{2,4})\s+4/);
  return m ? m[1] : '';
}
// Full names of the champion and Finals loser for a season ('' if unknown)
function finalsTeams(season) {
  const h = DB.history.find(x => String(x.Season) === String(season));
  const champAbbr = h ? extractChampTeam(h.Finals || '') : '', ruAbbr = h ? extractLoserTeam(h.Finals || '') : '';
  return { champ: champAbbr ? fullTeamName(champAbbr) : '', ru: ruAbbr ? fullTeamName(ruAbbr) : '' };
}
function extractLoserTeam(finals) {
  if (!finals) return '';
  // Format: "WINNER 4-N LOSER" or "WINNER 4–N LOSER" (en-dash variant)
  // Split on whitespace and take last non-empty token
  const parts = String(finals).trim().split(/\s+/);
  return parts.length >= 3 ? parts[parts.length - 1] : '';
}
const TEAM_NAMES = {
  ATL:'Atlanta Hawks',BOS:'Boston Celtics',BYN:'Brooklyn Nets',BKN:'Brooklyn Nets',
  CHA:'Charlotte Hornets',CHI:'Chicago Bulls',CLE:'Cleveland Cavaliers',DAL:'Dallas Mavericks',
  DEN:'Denver Nuggets',DET:'Detroit Pistons',GSW:'Golden State Warriors',GS:'Golden State Warriors',
  HOU:'Houston Rockets',IND:'Indiana Pacers',LAC:'Los Angeles Clippers',LAL:'Los Angeles Lakers',
  MEM:'Memphis Grizzlies',MIA:'Miami Heat',MIL:'Milwaukee Bucks',MIN:'Minnesota Timberwolves',
  NOP:'New Orleans Pelicans',NO:'New Orleans Pelicans',NYK:'New York Knicks',NY:'New York Knicks',
  OKC:'Oklahoma City Thunder',ORL:'Orlando Magic',PHI:'Philadelphia 76ers',PHX:'Phoenix Suns',
  POR:'Portland Trail Blazers',SAC:'Sacramento Kings',SA:'San Antonio Spurs',SAS:'San Antonio Spurs',
  TOR:'Toronto Raptors',UTA:'Utah Jazz',WAS:'Washington Wizards',SD:'San Diego Surf',KC:'Kansas City Knights',VAN:'Vancouver Ravens',CIN:'Cincinnati Lions'
};
function fullTeamName(abbr) { return TEAM_NAMES[abbr] || TEAM_NAMES[String(abbr||'').toUpperCase()] || abbr; }
// Clickable team name if the team exists in Team Record; accepts a code (LAL) or full name
function teamLink(team, label) {
  if (!team || team === '—') return label || '—';
  const full = fullTeamName(team);
  const known = DB.teams.some(t => t.Team === full);
  const text = label || team;
  return known ? `<span class="team-link" title="${full}" onclick="event.stopPropagation();openTeamModal('${jsArg(full)}')">${teamLogo(full)}${text}</span>` : text;
}
// Escape a value for use inside a single-quoted JS string in an HTML attribute
function jsArg(v) { return String(v).replace(/\\/g,'\\\\').replace(/'/g,"\\'").replace(/"/g,'&quot;'); }

// =====================================================================
// NAME MATCHING
// Sheets write the same player in different ways ("H.McDaniels",
// "Michael Jordon"), so links resolve names here instead of exact lookups.
// =====================================================================
let playerIndex = null, resolveCache = {};
function normName(v) {
  return String(v||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'')
    .replace(/[^a-z0-9 ]/g,' ').replace(/\s+/g,' ').trim();
}
// Typo distance between two names; two swapped neighbouring letters ("Geogre") count as one typo
function editDistance(a, b) {
  if (Math.abs(a.length - b.length) > 3) return 99;
  const d = Array.from({ length: a.length + 1 }, (_, i) => [i]);
  for (let j = 1; j <= b.length; j++) d[0][j] = j;
  for (let i = 1; i <= a.length; i++)
    for (let j = 1; j <= b.length; j++) {
      d[i][j] = Math.min(d[i-1][j] + 1, d[i][j-1] + 1, d[i-1][j-1] + (a[i-1] === b[j-1] ? 0 : 1));
      if (i > 1 && j > 1 && a[i-1] === b[j-2] && a[i-2] === b[j-1]) d[i][j] = Math.min(d[i][j], d[i-2][j-2] + 1);
    }
  return d[a.length][b.length];
}
// "1985-93,94-98,01-03" -> [1985, 2003]; "2060-" (still active) -> [2060, Infinity]
function careerSpan(season) {
  const str = String(season||'');
  const m = str.match(/^(\d{4})/);
  if (!m) return null;
  const start = +m[1];
  if (/-\s*$/.test(str)) return [start, Infinity];
  const last = str.match(/\d+/g).pop();
  let end = last.length === 4 ? +last : Math.floor(start/100)*100 + +last;
  while (end < start) end += 100;
  return [start, end];
}
function buildPlayerIndex() {
  const seen = new Map();
  const add = p => {
    if (!p || !p.Player || seen.has(p.Player)) return;
    const norm = normName(p.Player), parts = norm.split(' ');
    seen.set(p.Player, { name: String(p.Player), norm, initial: parts[0][0], rest: parts.slice(1).join(' '), span: careerSpan(p.Season), rec: p });
  };
  [DB.allPlayers, DB.currentPlayers, ...Object.values(DB.positions), DB.top20].forEach(list => (list||[]).forEach(add));
  playerIndex = [...seen.values()];
  resolveCache = {};
}
// Returns the player record a sheet name refers to, or null if unknown or ambiguous.
// season (optional) picks between players who share a short name, e.g. "B.James".
// Earlier names of players (normalised) -> the name used on their player row
const NAME_ALIASES = { lalcindor: 'Kareem Abdul-Jabbar', lewalcindor: 'Kareem Abdul-Jabbar', chrisjackson: 'Mahmoud Abdul-Rauf', ronartest: 'Metta World Peace' };
function resolvePlayer(raw, season) {
  if (!raw) return null;
  const key = raw + '|' + (season || '');
  if (key in resolveCache) return resolveCache[key];
  if (!playerIndex) buildPlayerIndex();
  const pick = cands => {
    if (cands.length > 1 && season) {
      const yr = Number(season);
      const inSeason = cands.filter(c => c.span && yr >= c.span[0] && yr <= c.span[1]);
      if (inSeason.length) cands = inSeason;
    }
    return cands.length === 1 ? cands[0].rec : null;
  };
  const closest = (list, field, target, maxDist) => {
    let best = maxDist + 1, out = [];
    list.forEach(c => {
      const d = editDistance(c[field], target);
      if (d < best) { best = d; out = [c]; } else if (d === best) out.push(c);
    });
    return best <= maxDist ? out : [];
  };
  let result = null;
  // Players who changed their name: the earlier name points at the row's current name
  const alias = NAME_ALIASES[normName(raw).replace(/ /g, '')];
  if (alias && alias !== raw) return (resolveCache[key] = resolvePlayer(alias, season));
  const n = normName(raw);
  const exact = playerIndex.filter(c => c.name === raw || c.norm === n);
  if (exact.length) {
    result = pick(exact);
  } else {
    const abbr = String(raw).match(/^\s*([A-Za-z])\.\s*(\S.*)$/);
    if (abbr) {
      // "H.McDaniels" -> first initial + surname, allowing a small typo in the surname
      const initial = abbr[1].toLowerCase(), rest = normName(abbr[2]);
      const sameInitial = playerIndex.filter(c => c.initial === initial);
      let cands = closest(sameInitial, 'rest', rest, rest.length >= 7 ? 2 : 1);
      // A short name in a season list must belong to someone playing that season:
      // "C.Hawkins" in 1970 is Connie Hawkins, not a player who started in 2063
      if (season) { const yr = Number(season); cands = cands.filter(c => !c.span || (yr >= c.span[0] && yr <= c.span[1])); }
      result = pick(cands);
    } else if (n.length >= 6) {
      // Misspelt full name, e.g. "Michael Jordon"
      result = pick(closest(playerIndex, 'norm', n, n.length >= 10 ? 2 : 1));
    }
  }
  return (resolveCache[key] = result);
}
// Player name as written in the sheet, clickable when it can be matched to a player.
function nameLink(raw, opts) {
  opts = opts || {};
  if (!raw) return '—';
  const p = resolvePlayer(raw, opts.season);
  const label = opts.label || raw;
  const style = opts.style ? ` style="${opts.style}"` : '';
  if (!p) return `<span class="name-plain"${style}>${label}</span>`;
  const title = p.Player !== raw ? ` title="${p.Player}"` : '';
  return `<span class="player-link"${style}${title} onclick="event.stopPropagation();openPlayerModal('${jsArg(p.Player)}')">${label}</span>`;
}

// =====================================================================
// SORTING & PAGINATION
// =====================================================================
let sortStates = {};
function toggleSortState(key, col) {
  const prev = sortStates[key];
  if (prev && prev.col === col) { sortStates[key] = {col, dir: prev.dir * -1}; }
  else { sortStates[key] = {col, dir: -1}; }
}
function renderPag(id, total, perPage, cur, cb) {
  const pages = Math.ceil(total / perPage);
  const el = document.getElementById(id);
  if (!el) return;
  let h = `<button ${cur <= 1 ? 'disabled' : ''} onclick="${cb}(${cur-1})">← Prev</button>`;
  const range = [];
  for (let i = 1; i <= pages; i++) {
    if (i===1||i===pages||Math.abs(i-cur)<=2) range.push(i);
    else if (range[range.length-1]!=='...') range.push('...');
  }
  for (const p of range) {
    if (p==='...') h += `<span style="color:var(--text3);padding:0 4px">…</span>`;
    else h += `<button class="${p===cur?'active-page':''}" onclick="${cb}(${p})">${p}</button>`;
  }
  h += `<button ${cur>=pages?'disabled':''} onclick="${cb}(${cur+1})">Next →</button>`;
  h += `<span class="page-info">${(cur-1)*perPage+1}–${Math.min(cur*perPage,total)} of ${total}</span>`;
  el.innerHTML = h;
}

// =====================================================================
// MODE TOGGLES (avg/total)
// =====================================================================
const modes = {players: 'avg', top20: 'total', pos: 'avg'};
const TABLE_RENDERERS = { players: () => renderPlayers(), top20: () => renderTop20(), pos: () => renderPos(), hist: () => renderHistory() };
const expanded = {players: false, top20: false, pos: false};
function toggleMode(key) {
  modes[key] = modes[key] === 'avg' ? 'total' : 'avg';
  const btn = document.getElementById(key + 'ModeBtn');
  if (btn) btn.textContent = modes[key] === 'avg' ? 'AVERAGES' : 'TOTALS';
  TABLE_RENDERERS[key]();
}
function toggleExpand(key) {
  expanded[key] = !expanded[key];
  const btn = document.getElementById(key + 'ExpandBtn');
  if (btn) btn.textContent = expanded[key] ? '- LESS COLS' : '+ MORE COLS';
  TABLE_RENDERERS[key]();
}
// The sheets keep their own per-game columns (APG holds points per game). Use them when
// present: steals, blocks and turnovers weren't tracked for every season of older careers,
// so career total / games understates those players.
const PER_GAME_COL = { PTS: 'APG', REB: 'ARG', AST: 'AAG', STL: 'ASG', BLK: 'ABG', TO: 'TOV', MIN: 'MPG' };
function perGame(row, key) {
  const sheet = getNum(row[PER_GAME_COL[key]]);
  if (sheet !== -Infinity) return sheet;
  const raw = getNum(row[key]);
  if (raw === -Infinity) return null;
  return raw / Math.max(getNum(row['GP']) || 1, 1);
}
function getStatVal(row, key, mode) {
  if (mode === 'avg') return perGame(row, key);
  const raw = getNum(row[key]);
  return raw === -Infinity ? null : raw;
}
function fmtStatVal(row, key, mode) {
  const v = getStatVal(row, key, mode);
  if (v === null) return '-';
  return mode === 'avg' ? v.toFixed(1) : Math.round(v).toLocaleString();
}

// =====================================================================
// PLAYER TABLE HEADER & ROW
// =====================================================================
function buildPlayerHead(tblKey, mode, extraCols) {
  const s = sortStates[tblKey] || {};
  const si = col => s.col === col ? (s.dir > 0 ? ' ↑' : ' ↓') : '';
  const th = (col, label) =>
    `<th class="num" onclick="onSort('${tblKey}','${col}')">${label}${si(col)}</th>`;
  const ptsL = mode==='avg'?'PPG':'PTS', rebL=mode==='avg'?'RPG':'REB';
  const astL = mode==='avg'?'APG':'AST', stlL=mode==='avg'?'SPG':'STL', blkL=mode==='avg'?'BPG':'BLK';
  const exp = expanded[tblKey] || false;
  return `${extraCols||''}
    ${th('GP','GP')} ${th('PTS',ptsL)} ${th('REB',rebL)} ${th('AST',astL)}
    ${th('STL',stlL)} ${th('BLK',blkL)} ${th('FG%','FG%')} ${th('3P%','3P%')} ${th('FT%','FT%')}
    ${th('DD2','DD2')} ${th('TD3','TD3')}
    ${exp ? th('MIN','MIN')+th(mode==='avg'?'TOV':'TO','TOV')+th('FGM','FGM')+th('FGA','FGA')+th('3PM','3PM')+th('3PA','3PA')+th('FTM','FTM')+th('FTA','FTA') : ''}
    ${th('Finals App','Finals')}
    ${th('MVP','MVP')} ${th('Champions','Champ')} ${th('FMVP','FMVP')}
    ${th('All Stars','All-Stars')} ${th('All NBA Team','All-NBA')}
    ${exp ? th('1st Team','1st')+th('2nd Team','2nd')+th('3rd Team','3rd') : ''}
    ${th('DTeam','D-Team')}
    ${exp ? th('1st D Team','1st-D')+th('2nd D Team','2nd-D') : ''}
    ${th('DPOY','DPOY')}
    <th>Retired#</th><th>Teams</th>`;
}
// Combined All-Defensive selections; a blank cell counts as 0
function dTeamTotal(row) {
  const v = k => { const x = getNum(row[k]); return x === -Infinity ? 0 : x; };
  return v('1st D Team') + v('2nd D Team');
}
// One row of the All Players / Top 20 / Positional tables (must match buildPlayerHead)
function buildPlayerRow(row, tblKey, mode, rank, showPos) {
  const v = key => fmtStatVal(row, key, mode);
  const exp = expanded[tblKey] || false;
  // TOV is per game in the sheet; TO is the career total
  const tov = mode === 'avg' ? (row.TOV ?? '-') : numFmt(row.TO);
  return `<tr>
    <td class="rank-cell stick-1 rank-col ${rankCls(rank)}">${rank}</td>
    <td class="stick-2">${plink(row.Player || '—')}</td>
    ${showPos ? `<td>${posBadge(row.Position)}</td>` : ''}
    <td class="muted">${row.Season||'—'}</td>
    <td class="num">${numFmt(row.GP)}</td>
    <td class="num highlight">${v('PTS')}</td>
    <td class="num">${v('REB')}</td>
    <td class="num">${v('AST')}</td>
    <td class="num">${v('STL')}</td>
    <td class="num">${v('BLK')}</td>
    <td class="num">${pctFmt(row['FG%'])}</td>
    <td class="num">${pctFmt(row['3P%'])}</td>
    <td class="num">${pctFmt(row['FT%'])}</td>
    <td class="num">${numFmt(row.DD2)}</td>
    <td class="num">${numFmt(row.TD3)}</td>
    ${exp ? `<td class="num">${numFmt(row.MIN)}</td><td class="num">${tov}</td><td class="num">${numFmt(row.FGM)}</td><td class="num">${numFmt(row.FGA)}</td><td class="num">${numFmt(row['3PM'])}</td><td class="num">${numFmt(row['3PA'])}</td><td class="num">${numFmt(row.FTM)}</td><td class="num">${numFmt(row.FTA)}</td>` : ''}
    <td class="num">${row['Finals App']||0}</td>
    <td class="num">${row.MVP||0}</td>
    <td class="num">${row.Champions||0}</td>
    <td class="num">${row.FMVP||0}</td>
    <td class="num">${row['All Stars']||0}</td>
    <td class="num">${row['All NBA Team']||0}</td>
    ${exp ? `<td class="num">${row['1st Team']||0}</td><td class="num">${row['2nd Team']||0}</td><td class="num">${row['3rd Team']||0}</td>` : ''}
    <td class="num">${dTeamTotal(row)}</td>
    ${exp ? `<td class="num">${row['1st D Team']||0}</td><td class="num">${row['2nd D Team']||0}</td>` : ''}
    <td class="num">${row.DPOY||0}</td>
    <td class="retired">${retiredNums(row).join(' · ')||'—'}</td>
    <td>${teamTags(row)}</td>
  </tr>`;
}
function sortedByMode(arr, key, mode) {
  const s = sortStates[key];
  if (!s || !s.col) return arr;
  const col = s.col, dir = s.dir;
  const statCols = ['PTS','REB','AST','STL','BLK'];
  return [...arr].sort((a, b) => {
    if (mode && statCols.includes(col)) {
      const av = getStatVal(a, col, mode), bv = getStatVal(b, col, mode);
      if (av !== null && bv !== null) return (av - bv) * dir;
    }
    if (col === 'DTeam') return (dTeamTotal(a) - dTeamTotal(b)) * dir;
    // Season column: sort by the numeric year part (e.g. "2004-24" -> 2004)
    if (col === 'Season') {
      const ay = parseInt(String(a[col]||'0').split('-')[0]) || 0;
      const by = parseInt(String(b[col]||'0').split('-')[0]) || 0;
      return (ay - by) * dir;
    }
    return (getNum(a[col]) - getNum(b[col])) * dir || String(a[col]||'').localeCompare(String(b[col]||'')) * dir;
  });
}
function onSort(key, col) {
  toggleSortState(key, col);
  TABLE_RENDERERS[key]?.();
}
