// 2K17 NBA Stats Database · Calculations: draft codes, advanced stats, percentiles, legacy score, Draft page and franchise legends.
// Loaded in order by index.html; all files share one global scope.

// =====================================================================
// PLAYER ENGINE
// Everything below is derived from the workbook: draft codes, advanced
// stats, percentiles, legacy score, similar players and titles per team.
// Results are cached per workbook load (engineCache is reset in parseWorkbook).
// =====================================================================
let engineCache = {};
const cached = (key, fn) => (key in engineCache ? engineCache[key] : (engineCache[key] = fn()));
const POS_NAMES = { PG: 'Point Guard', SG: 'Shooting Guard', SF: 'Small Forward', PF: 'Power Forward', C: 'Center' };
const careerPlayers = () => DB.allPlayers.filter(p => p.Player);
const everyPlayer = () => cached('everyPlayer', () => [...DB.allPlayers, ...DB.currentPlayers].filter(p => p.Player));
const isActive = p => DB.currentPlayers.includes(p);

// "03Rnd1Pick1" -> {year: 2003, round: 1, pick: 1}; also handles Territorial, Undrafted,
// ABA picks and the typos in the sheet ("58Rnd1Pcik1", "67Rick1Pick14", "79RndPick1")
function draftInfo(p) {
  return cached('draft|' + p.Player, () => {
    const code = String(p.Draft || '').trim();
    const m = code.match(/^(\d{2})/);
    if (!m) return null;
    const span = careerSpan(p.Season);
    const start = span ? span[0] : 2000;
    let year = Math.floor((start - 1) / 100) * 100 + Number(m[1]);
    if (year > start) year -= 100;
    const info = { year, code, round: null, pick: null, kind: 'pick', league: /ABA/i.test(code) ? 'ABA' : 'NBA' };
    if (/territorial/i.test(code)) info.kind = 'territorial';
    else if (/undrafted/i.test(code)) info.kind = 'undrafted';
    else {
      const rd = code.match(/R[a-z]*(\d)(?=\s*P|\s*\(|$)/i);
      const pk = code.match(/P[a-z]*(\d+)\s*$/i);
      info.round = rd ? Number(rd[1]) : (pk ? 1 : null);
      info.pick = pk ? Number(pk[1]) : null;
    }
    return info;
  });
}
function draftLabel(d) {
  if (!d) return '—';
  if (d.kind === 'territorial') return `${d.year} · Territorial pick`;
  if (d.kind === 'undrafted') return `${d.year} · Undrafted`;
  return `${d.year}${d.league === 'ABA' ? ' ABA' : ''} · Round ${d.round ?? '?'}${d.pick ? ' · Pick ' + d.pick : ''}`;
}

// Career advanced stats from the workbook's totals and per-game columns.
// Formulas: TS% = PTS / (2 x (FGA + 0.44 x FTA)); eFG% = (FGM + 0.5 x 3PM) / FGA;
// per 36 = per-game x 36 / MPG; AST/TO = APG / TOV; 3PA rate = 3PA / FGA;
// FT rate = FTA / FGA; double-double rate = DD2 / GP.
const ADV_DEFS = [
  { key: 'ts',     label: 'True shooting %', fmt: v => (v * 100).toFixed(1) + '%', how: 'Points ÷ (2 × (FGA + 0.44 × FTA)): scoring efficiency counting 3s and free throws' },
  { key: 'efg',    label: 'Effective FG %',  fmt: v => (v * 100).toFixed(1) + '%', how: '(FGM + 0.5 × 3PM) ÷ FGA: field goals with 3s worth 1.5' },
  { key: 'pts36',  label: 'Points per 36',   fmt: v => v.toFixed(1), how: 'Points per game scaled to 36 minutes' },
  { key: 'reb36',  label: 'Rebounds per 36', fmt: v => v.toFixed(1), how: 'Rebounds per game scaled to 36 minutes' },
  { key: 'ast36',  label: 'Assists per 36',  fmt: v => v.toFixed(1), how: 'Assists per game scaled to 36 minutes' },
  { key: 'stocks', label: 'Steals + blocks', fmt: v => v.toFixed(1), how: 'Steals plus blocks per game' },
  { key: 'astTo',  label: 'Assist / turnover', fmt: v => v.toFixed(2), how: 'Assists per game ÷ turnovers per game' },
  { key: 'par3',   label: '3-point attempt rate', fmt: v => (v * 100).toFixed(1) + '%', how: 'Share of shots taken from three: 3PA ÷ FGA' },
  { key: 'ftr',    label: 'Free-throw rate', fmt: v => (v * 100).toFixed(1) + '%', how: 'Free-throw attempts per shot: FTA ÷ FGA' },
  { key: 'dd2r',   label: 'Double-double rate', fmt: v => (v * 100).toFixed(1) + '%', how: 'Share of games with a double-double: DD2 ÷ GP' },
];
function advStats(p) {
  return cached('adv|' + p.Player, () => {
    const n = k => { const v = getNum(p[k]); return v === -Infinity ? null : v; };
    const pg = k => perGame(p, k);
    const div = (a, b) => (a === null || b === null || !b) ? null : a / b;
    const mpg = pg('MIN');
    const per36 = k => { const v = pg(k); return v === null || !mpg ? null : v * 36 / mpg; };
    const fga = n('FGA'), fta = n('FTA'), pts = n('PTS');
    const stl = pg('STL'), blk = pg('BLK');
    return {
      ts: fga && fta !== null && pts !== null ? pts / (2 * (fga + 0.44 * fta)) : null,
      efg: fga && n('FGM') !== null ? (n('FGM') + 0.5 * (n('3PM') || 0)) / fga : null,
      pts36: per36('PTS'), reb36: per36('REB'), ast36: per36('AST'),
      stocks: stl !== null && blk !== null ? stl + blk : null,
      astTo: div(pg('AST'), pg('TO')),
      par3: n('3PA') !== null && fga ? n('3PA') / fga : null,
      ftr: fta !== null && fga ? fta / fga : null,
      dd2r: div(n('DD2'), n('GP')),
    };
  });
}

// Percentile bars: share of players below this value (ties count half)
const PCT_METRICS = [
  { key: 'PTS', label: 'Scoring', get: p => perGame(p, 'PTS'), fmt: v => v.toFixed(1) + ' PPG' },
  { key: 'REB', label: 'Rebounding', get: p => perGame(p, 'REB'), fmt: v => v.toFixed(1) + ' RPG' },
  { key: 'AST', label: 'Playmaking', get: p => perGame(p, 'AST'), fmt: v => v.toFixed(1) + ' APG' },
  { key: 'STL', label: 'Steals', get: p => perGame(p, 'STL'), fmt: v => v.toFixed(1) + ' SPG' },
  { key: 'BLK', label: 'Blocks', get: p => perGame(p, 'BLK'), fmt: v => v.toFixed(1) + ' BPG' },
  { key: 'ts', label: 'Efficiency', get: p => advStats(p).ts, fmt: v => (v * 100).toFixed(1) + '% TS' },
  { key: '3P', label: '3-point shooting', get: p => { const v = getNum(p['3P%']); return v === -Infinity ? null : v; }, fmt: v => v.toFixed(1) + '% 3P' },
  { key: 'FT', label: 'Free throws', get: p => { const v = getNum(p['FT%']); return v === -Infinity ? null : v; }, fmt: v => v.toFixed(1) + '% FT' },
  { key: 'astTo', label: 'Ball security', get: p => advStats(p).astTo, fmt: v => v.toFixed(2) + ' AST/TO' },
  { key: 'GP', label: 'Durability', get: p => { const v = getNum(p.GP); return v === -Infinity ? null : v; }, fmt: v => Math.round(v).toLocaleString() + ' games' },
];
function percentile(metric, p, pool) {
  const v = metric.get(p);
  if (v === null || v === undefined || isNaN(v)) return null;
  const vals = pool.map(metric.get).filter(x => x !== null && x !== undefined && !isNaN(x));
  if (vals.length < 2) return null;
  const below = vals.filter(x => x < v).length, same = vals.filter(x => x === v).length;
  return Math.round(100 * (below + (same - 1) / 2) / (vals.length - 1));
}

// Legacy score: a points system for honors and production (source: a points system
// posted on a Chinese basketball platform, adapted to what the workbook records).
// Repeat awards earn less each time (decay step down to a floor); MVP and Finals MVP
// keep the previous value when won in back-to-back seasons. Every value is editable in
// Settings and stored per browser.
const LEGACY_SCHEMA = [
  { group: 'MVP', items: [['mvp', 'Base points', 250], ['mvpStep', 'Drop per repeat', 0.1], ['mvpFloor', 'Lowest multiplier', 0.7]] },
  { group: 'Finals MVP', items: [['fmvp', 'Base points', 100], ['fmvpStep', 'Drop per repeat', 0.1], ['fmvpFloor', 'Lowest multiplier', 0.7]] },
  { group: 'Defensive Player of the Year', items: [['dpoy', 'Base points', 50], ['dpoyStep', 'Drop per repeat', 0.2], ['dpoyFloor', 'Lowest multiplier', 0.4]] },
  { group: 'Other awards', items: [['roy', 'Rookie of the Year', 20], ['smoy', '6th Man of the Year', 25], ['mip', 'Most Improved Player', 25], ['otherStep', 'Drop per repeat', 0.1], ['otherFloor', 'Lowest multiplier', 0.2]] },
  { group: 'All-Star', items: [['allStar', 'Base points', 25], ['allStarStep', 'Drop per repeat', 0.1], ['allStarFloor', 'Lowest multiplier', 0.2]] },
  { group: 'Team selections (one shared count)', items: [['allNba1', 'All-NBA 1st Team', 100], ['allNba2', 'All-NBA 2nd Team', 50], ['allNba3', 'All-NBA 3rd Team', 25],
      ['allDef1', 'All-Defensive 1st Team', 15], ['allDef2', 'All-Defensive 2nd Team', 10], ['rookie1', 'All-Rookie 1st Team', 10], ['rookie2', 'All-Rookie 2nd Team', 5],
      ['teamStep', 'Drop per selection', 0.2], ['teamFloor', 'Lowest multiplier', 0.2]] },
  { group: 'Stat titles (Season Stat Leader)', items: [['ptsTitle', 'Scoring title', 100], ['rebTitle', 'Rebounding title', 40], ['astTitle', 'Assists title', 40],
      ['stlTitle', 'Steals title', 18], ['blkTitle', 'Blocks title', 18], ['titleStep', 'Drop per repeat', 0.2], ['titleFloor', 'Lowest multiplier', 0.2]] },
  { group: 'Championship roles (NBA History champion stars)', items: [['roleSingle', 'Only star listed (single core)', 120], ['roleFranchise', 'Top star (franchise player)', 100],
      ['roleCoStar', 'Co-stars (top two within the rating gap)', 80], ['roleSecond', 'Second star', 70], ['roleCore', 'Third star (core)', 60],
      ['roleRotation', 'Title as a non-listed player (rotation)', 25], ['coStarGap', 'Co-star rating gap', 2]] },
  { group: 'Career production', items: [['pts1000', 'Per 1,000 career points', 8], ['other1000', 'Per 1,000 rebounds, assists or steals + blocks', 4]] },
];
const LEGACY_DEFAULTS = Object.fromEntries(LEGACY_SCHEMA.flatMap(g => g.items.map(([k, , v]) => [k, v])));
function legacyWeights() {
  try { return { ...LEGACY_DEFAULTS, ...JSON.parse(localStorage.getItem('nba2k17-legacy-v2') || '{}') }; }
  catch (e) { return { ...LEGACY_DEFAULTS }; }
}
function otherAwardCount(p) {
  const m = String(p['Other Award'] || '').match(/\((\d+)\)/);
  return m ? Number(m[1]) : 0;
}
const awardCount = (p, re) => { const m = String(p['Other Award'] || '').match(re); return m ? Number(m[1]) : 0; };
// Sum of base x multiplier for each repeat. Multiplier starts at 1 and drops by step per
// repeat down to floor; with streak, a back-to-back season keeps the previous multiplier.
// Awards with no known season (older than NBA History) count first, as non-consecutive.
function decayedPoints(base, count, step, floor, seasons, streak) {
  const yrs = [...Array(Math.max(0, count - (seasons || []).length)).fill(null), ...[...(seasons || [])].sort((a, b) => a - b)].slice(0, count);
  let total = 0, prevC = null, prevY = null;
  yrs.forEach((y, k) => {
    let c = Math.max(floor, 1 - step * k);
    if (streak && y !== null && prevY !== null && y === prevY + 1) c = prevC;
    total += base * c; prevC = c; prevY = y;
  });
  return total;
}
// Seasons, roles and stat titles per player, read once from NBA History and Season Stat Leader
function legacyContext() {
  return cached('legacyContext', () => {
    const w = legacyWeights(), ctx = { mvp: {}, fmvp: {}, roles: {}, titles: {}, firstHistory: Infinity };
    const push = (map, p, v) => (map[p.Player] = map[p.Player] || []).push(v);
    DB.history.forEach(h => {
      const yr = Number(h.Season);
      if (isNaN(yr)) return;
      ctx.firstHistory = Math.min(ctx.firstHistory, yr);
      [['MVP', 'mvp'], ['FMVP', 'fmvp']].forEach(([k, m]) => { const p = h[k] && h[k] !== '-' ? resolvePlayer(h[k], yr) : null; if (p) push(ctx[m], p, yr); });
      const stars = [h.Star1, h.Star2, h.Star3].filter(x => x && x !== '-').map(x => {
        const r = String(x).match(/\((\d+)\)\s*$/);
        return { p: resolvePlayer(String(x).replace(/\s*\(\d+\)\s*$/, '').trim(), yr), rating: r ? Number(r[1]) : null };
      });
      if (!stars.length) return;
      const coStars = stars.length > 1 && stars[0].rating !== null && stars[1].rating !== null && stars[0].rating - stars[1].rating <= w.coStarGap;
      stars.forEach((st, i) => {
        if (!st.p) return;
        const role = stars.length === 1 ? ['roleSingle', 'single core'] : coStars && i < 2 ? ['roleCoStar', 'co-star'] : i === 0 ? ['roleFranchise', 'franchise player'] : i === 1 ? ['roleSecond', 'second star'] : ['roleCore', 'core'];
        push(ctx.roles, st.p, { yr, key: role[0], label: role[1] });
      });
    });
    [['PtsLeader', 'ptsTitle'], ['RebLeader', 'rebTitle'], ['AstLeader', 'astTitle'], ['StlLeader', 'stlTitle'], ['BlkLeader', 'blkTitle']].forEach(([k, key]) =>
      DB.statLeaders.forEach(r => { const p = r[k] ? resolvePlayer(r[k], r.Season) : null; if (p) { const t = (ctx.titles[p.Player] = ctx.titles[p.Player] || {}); t[key] = (t[key] || 0) + 1; } }));
    return ctx;
  });
}
const championRole = (p, yr) => (legacyContext().roles[p.Player] || []).find(r => r.yr === yr);
function legacy(p) {
  return cached('legacy|' + p.Player, () => {
    const w = legacyWeights(), ctx = legacyContext();
    const n = k => { const v = getNum(p[k]); return v === -Infinity ? 0 : Math.round(v); };
    const roty = /^o$/i.test(String(p.ROTY || '').trim());
    const rookieTeam = String(p.RookieTeam ?? p['Rookie Team'] ?? '').trim();
    const teamPicks = [...Array(n('1st Team')).fill(w.allNba1), ...Array(n('2nd Team')).fill(w.allNba2), ...Array(n('3rd Team')).fill(w.allNba3),
      ...Array(n('1st D Team')).fill(w.allDef1), ...Array(n('2nd D Team')).fill(w.allDef2), ...(rookieTeam === '1st' ? [w.rookie1] : rookieTeam === '2nd' ? [w.rookie2] : [])];
    // Titles: listed champion stars get their role; titles older than NBA History are
    // estimated from career level; any other title counts as a rotation player's
    const roles = ctx.roles[p.Player] || [];
    const unlisted = Math.max(0, n('Champions') - roles.length);
    const span = careerSpan(p.Season);
    const preHistoryRole = n('MVP') > 0 ? w.roleFranchise : (n('1st Team') > 0 || n('All Stars') >= 5) ? w.roleCore : w.roleRotation;
    const unlistedEach = span && span[0] < ctx.firstHistory ? preHistoryRole : w.roleRotation;
    const t = ctx.titles[p.Player] || {};
    const parts = {
      mvp: decayedPoints(w.mvp, n('MVP'), w.mvpStep, w.mvpFloor, ctx.mvp[p.Player], true),
      fmvp: decayedPoints(w.fmvp, n('FMVP'), w.fmvpStep, w.fmvpFloor, ctx.fmvp[p.Player], true),
      titles: roles.reduce((a, r) => a + w[r.key], 0) + unlisted * unlistedEach,
      teams: teamPicks.sort((a, b) => b - a).reduce((a, v, k) => a + v * Math.max(w.teamFloor, 1 - w.teamStep * k), 0),
      allStar: decayedPoints(w.allStar, n('All Stars'), w.allStarStep, w.allStarFloor),
      dpoy: decayedPoints(w.dpoy, n('DPOY'), w.dpoyStep, w.dpoyFloor),
      statTitles: ['ptsTitle', 'rebTitle', 'astTitle', 'stlTitle', 'blkTitle'].reduce((a, k) => a + decayedPoints(w[k], t[k] || 0, w.titleStep, w.titleFloor), 0),
      other: (roty ? w.roy : 0) + decayedPoints(w.smoy, awardCount(p, /6th Man\s*\((\d+)\)/i), w.otherStep, w.otherFloor) + decayedPoints(w.mip, awardCount(p, /MIP\s*\((\d+)\)/i), w.otherStep, w.otherFloor),
      production: (n('PTS') * w.pts1000 + (n('REB') + n('AST') + n('STL') + n('BLK')) * w.other1000) / 1000,
    };
    // Awards-vs-stats slider: 50/50 keeps the formula as set; each side scales 0x to 2x
    const r = legacyRatio() / 100;
    Object.keys(parts).forEach(k => { parts[k] *= k === 'production' ? 2 * r : 2 * (1 - r); });
    const total = Object.values(parts).reduce((a, b) => a + b, 0);
    return { total, parts };
  });
}
const LEGACY_PARTS = [['mvp', 'MVP'], ['fmvp', 'Finals MVP'], ['titles', 'Title roles'], ['teams', 'All-NBA / Def / Rookie'], ['allStar', 'All-Star'], ['dpoy', 'DPOY'], ['statTitles', 'Stat titles'], ['other', 'ROY / 6MOY / MIP'], ['production', 'Production']];
function legacyRatio() {
  try { const v = localStorage.getItem('nba2k17-legacy-ratio'); return v === null || isNaN(Number(v)) ? 50 : Math.min(100, Math.max(0, Number(v))); } catch (e) { return 50; }
}
let ratioFrame = 0;
function setLegacyRatio(v) {
  v = Math.min(100, Math.max(0, Number(v) || 0));
  try { localStorage.setItem('nba2k17-legacy-ratio', String(v)); } catch (e) {}
  syncRatioBar();
  cancelAnimationFrame(ratioFrame);
  ratioFrame = requestAnimationFrame(() => { engineCache = {}; renderLegacy(); });
}
function syncRatioBar() {
  const r = legacyRatio(), input = document.getElementById('legacyRatio'), out = document.getElementById('legacyRatioOut');
  if (input && Number(input.value) !== r) input.value = r;
  if (out) out.textContent = r === 50 ? 'Awards 50% · Stats 50% (formula as set)' : `Awards ${100 - r}% · Stats ${r}%`;
}
function legacyRanking() {
  return cached('legacyRanking', () => withRanks(everyPlayer().map(p => ({ p, score: legacy(p).total })).sort((a, b) => b.score - a.score), r => Math.round(r.score)));
}
const legacyRankOf = p => legacyRanking().find(r => r.p === p)?.rank;

// Closest statistical matches: distance between standardized per-game profiles
const SIM_KEYS = [
  p => perGame(p, 'PTS'), p => perGame(p, 'REB'), p => perGame(p, 'AST'), p => perGame(p, 'STL'), p => perGame(p, 'BLK'),
  p => perGame(p, 'MIN'), p => { const v = getNum(p['FG%']); return v === -Infinity ? null : v; },
  p => { const v = getNum(p['3P%']); return v === -Infinity ? null : v; }, p => { const v = getNum(p['FT%']); return v === -Infinity ? null : v; },
];
function similarPlayers(p, count) {
  const pool = careerPlayers();
  if (!pool.includes(p)) return [];
  const stats = cached('simStats', () => SIM_KEYS.map(f => {
    const vals = pool.map(f).filter(v => v !== null && !isNaN(v));
    const mean = vals.reduce((a, b) => a + b, 0) / vals.length;
    const sd = Math.sqrt(vals.reduce((a, b) => a + (b - mean) ** 2, 0) / vals.length) || 1;
    return { mean, sd };
  }));
  const vec = x => SIM_KEYS.map((f, i) => { const v = f(x); return (v === null || isNaN(v) ? stats[i].mean : v - 0) - stats[i].mean; }).map((v, i) => v / stats[i].sd);
  const me = vec(p);
  return pool.filter(o => o !== p).map(o => {
    const d = Math.sqrt(vec(o).reduce((a, v, i) => a + (v - me[i]) ** 2, 0)) + (o.Position === p.Position ? 0 : 0.6);
    return { p: o, match: Math.max(0, Math.round(100 - d * 22)) };
  }).sort((a, b) => b.match - a.match).slice(0, count || 5);
}

// Titles a player won with a given team: seasons where they are a listed champion
// star or Finals MVP and that team won; players with one team get all their titles
// Titles won with a team: NBA History gives exact counts; red team cells in the
// workbook mark every title team (also before 1979–80 and for non-star players)
function titleTeams(p) { return p._titleStints ? playerTeams(p).filter((t, i) => p._titleStints[i]) : null; }
function titlesWithTeam(p, team) {
  const teams = playerTeams(p), total = Math.max(getNum(p.Champions), 0);
  if (teams.length === 1 && teams[0] === team) return total;
  const hist = titlesWithTeamHistory(p, team), red = titleTeams(p);
  if (red && red.includes(team)) return new Set(red).size === 1 ? Math.max(hist, total) : Math.max(hist, 1);
  return hist;
}
function titlesWithTeamHistory(p, team) {
  return cached('titlesWith|' + p.Player + '|' + team, () => DB.history.filter(h => {
    const champ = fullTeamName(extractChampTeam(h.Finals || ''));
    if (champ !== team) return false;
    return [h.Star1, h.Star2, h.Star3, h.FMVP].some(x => x && x !== '-' && resolvePlayer(String(x).replace(/\s*\(\d+\)\s*$/, '').trim(), h.Season) === p);
  }).length);
}
// Teams in the order recorded on the player's row (full names; repeats kept as separate stints)
function playerTeams(p) {
  const out = [];
  for (let i = 1; i <= 11; i++) { const v = p[i === 1 ? 'Team' : 'Team' + i]; if (v) out.push(fullTeamName(v)); }
  return out;
}
function retiredFor(p) {
  return retiredNums(p).map(r => { const [num, ...rest] = String(r).trim().split(/\s+/); return { num, team: fullTeamName(rest.join(' ')) }; }).filter(r => r.team);
}
function playerSlug(name) { return String(name).normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^A-Za-z0-9]+/g, '-').replace(/^-|-$/g, ''); }

// =====================================================================
// DRAFT
// =====================================================================
let draftYear = null;
function draftRows() {
  return cached('draftRows', () => everyPlayer().map(p => ({ p, d: draftInfo(p) })).filter(r => r.d)
    .sort((a, b) => b.d.year - a.d.year || (a.d.round ?? 9) - (b.d.round ?? 9) || (a.d.pick ?? 99) - (b.d.pick ?? 99)));
}
const pickLabel = d => d.kind === 'territorial' ? 'Territorial' : d.kind === 'undrafted' ? 'Undrafted' : `${d.league === 'ABA' ? 'ABA ' : ''}R${d.round ?? '?'}${d.pick ? ' · #' + d.pick : ''}`;
function draftCareer(p) {
  const n = k => { const v = getNum(p[k]); return v === -Infinity ? 0 : v; };
  return [[n('Champions'), 'title'], [n('MVP'), 'MVP'], [n('All Stars'), 'All-Star']].filter(([v]) => v > 0).map(([v, l]) => `${v} ${l}${v > 1 && l !== 'MVP' ? 's' : ''}`).join(' · ') || '—';
}
function setDraftYear(y) { draftYear = Number(y); renderDraft(); }
function renderDraft() {
  const rows = draftRows();
  const years = [...new Set(rows.map(r => r.d.year))].sort((a, b) => b - a);
  if (!years.length) { document.getElementById('draftContent').innerHTML = '<p class="muted">No draft information found.</p>'; return; }
  if (!years.includes(draftYear)) draftYear = years[0];
  const classRows = rows.filter(r => r.d.year === draftYear);
  const firsts = rows.filter(r => r.d.pick === 1 && r.d.round === 1 && r.d.league === 'NBA');
  const steals = rows.filter(r => r.d.kind === 'undrafted' || r.d.round > 1 || r.d.pick >= 10).sort((a, b) => legacy(b.p).total - legacy(a.p).total).slice(0, 10);
  const bestByClass = years.map(y => rows.filter(r => r.d.year === y).sort((a, b) => legacy(b.p).total - legacy(a.p).total)[0]);
  const deepest = years.map(y => ({ y, n: rows.filter(r => r.d.year === y).length })).sort((a, b) => b.n - a.n)[0];
  const tr = r => `<tr><td class="num">${r.d.year}</td><td>${pickLabel(r.d)}</td><td class="stick-1">${nameLink(r.p.Player)}</td><td>${posBadge(r.p.Position)}</td>
    <td class="num">${Math.round(legacy(r.p).total).toLocaleString()}</td><td>${draftCareer(r.p)}</td></tr>`;
  const table = (list, cols) => `<div class="table-wrap"><table><thead><tr><th class="num">Year</th><th>Pick</th><th class="stick-1">Player</th><th>Pos</th><th class="num">Legacy</th><th>Career honors</th></tr></thead><tbody>${list.map(tr).join('')}</tbody></table></div>`;
  document.getElementById('draftContent').innerHTML = `
    <div class="stats-cards">
      <div class="stat-card"><div class="label">Draft classes</div><div class="value">${years.length}</div><div class="sub">${years[years.length - 1]} to ${years[0]}</div></div>
      <div class="stat-card"><div class="label">Number 1 picks</div><div class="value">${firsts.length}</div><div class="sub">in your database</div></div>
      <div class="stat-card"><div class="label">Biggest steal</div><div class="value value-name">${steals[0] ? nameLink(steals[0].p.Player) : '—'}</div><div class="sub">${steals[0] ? draftLabel(steals[0].d) : ''}</div></div>
      <div class="stat-card"><div class="label">Deepest class</div><div class="value">${deepest.y}</div><div class="sub">${deepest.n} players in your database</div></div>
    </div>
    <div class="chart-card"><div class="card-head card-head-wrap"><div class="chart-title">${icon('calendar')} Draft Class</div>
      <div class="season-nav"><button class="icon-btn" onclick="setDraftYear(${years[Math.min(years.indexOf(draftYear) + 1, years.length - 1)]})" ${years.indexOf(draftYear) === years.length - 1 ? 'disabled' : ''} aria-label="Older draft">←<span class="nav-word"> Older</span></button>
        <select onchange="setDraftYear(this.value)" aria-label="Draft year">${years.map(y => `<option value="${y}"${y === draftYear ? ' selected' : ''}>${y} draft</option>`).join('')}</select>
        <button class="icon-btn" onclick="setDraftYear(${years[Math.max(years.indexOf(draftYear) - 1, 0)]})" ${years.indexOf(draftYear) === 0 ? 'disabled' : ''} aria-label="Newer draft"><span class="nav-word">Newer </span>→</button></div></div>
      <div class="draft-class">${classRows.map(r => `<div class="draft-pick" role="button" tabindex="0" onclick="openPlayerModal('${jsArg(r.p.Player)}')" onkeydown="if(event.key==='Enter')this.click()">
        <div class="dp-slot">${r.d.pick ? '#' + r.d.pick : r.d.kind === 'territorial' ? 'T' : r.d.kind === 'undrafted' ? 'UD' : 'R' + r.d.round}</div>
        <div><div class="dp-name">${r.p.Player} ${posBadge(r.p.Position)}</div><div class="dp-sub">${pickLabel(r.d)} · ${draftCareer(r.p)}</div></div>
        <div class="dp-legacy"><b>${Math.round(legacy(r.p).total).toLocaleString()}</b><span>legacy</span></div></div>`).join('')}</div></div>
    <div class="rb-grid">
      <div class="chart-card rb-card rb-years"><div class="chart-title">Every #1 Pick</div>${firsts.map(r => `<div class="rb-row"><span class="rb-rank">${r.d.year}</span><span class="rb-main">${nameLink(r.p.Player)}</span><span class="rb-val">${Math.round(legacy(r.p).total).toLocaleString()}</span><span class="rb-sub">${draftCareer(r.p)}</span></div>`).join('')}</div>
      <div class="chart-card rb-card"><div class="chart-title">Biggest Steals</div>${withRanks(steals, r => legacy(r.p).total).map(r => `<div class="rb-row"><span class="rb-rank">${r.rank}</span><span class="rb-main">${nameLink(r.p.Player)}</span><span class="rb-val">${Math.round(legacy(r.p).total).toLocaleString()}</span><span class="rb-sub">${draftLabel(r.d)} · ${draftCareer(r.p)}</span></div>`).join('')}</div>
      <div class="chart-card rb-card rb-years"><div class="chart-title">Best Player of Each Class</div>${bestByClass.slice(0, 15).map(r => `<div class="rb-row"><span class="rb-rank">${r.d.year}</span><span class="rb-main">${nameLink(r.p.Player)}</span><span class="rb-val">${Math.round(legacy(r.p).total).toLocaleString()}</span><span class="rb-sub">${pickLabel(r.d)} · ${draftCareer(r.p)}</span></div>`).join('')}</div>
    </div>
    <div class="chart-card"><div class="chart-title">${icon('list')} Every Draft Pick</div>${table(rows)}</div>`;
}

// =====================================================================
// LEGACY RANKING
// =====================================================================
function renderLegacy() {
  syncRatioBar();
  const q = normName(document.getElementById('legacySearch').value);
  const f = document.getElementById('legacyFilter').value, pos = document.getElementById('legacyPos').value;
  const rows = legacyRanking().filter(r => (!q || normName(r.p.Player).includes(q)) && (!pos || r.p.Position === pos) && (!f || (f === 'active') === isActive(r.p)));
  document.getElementById('legacySub').textContent = `All-time ranking from honors and career production · ${everyPlayer().length} players`;
  const fmt = v => Math.round(v).toLocaleString();
  document.getElementById('legacyContent').innerHTML = `
    <div class="legacy-edit"><button class="card-link" onclick="showSection('settings')">Change the formula in Settings</button></div>
    <div class="table-wrap"><table><thead><tr><th class="stick-1 rank-col">#</th><th class="stick-2">Player</th><th>Pos</th><th class="num">Score</th>
      ${LEGACY_PARTS.map(([, l]) => `<th class="num">${l}</th>`).join('')}<th class="num">Your Top 20</th></tr></thead><tbody>
      ${rows.map(r => { const L = legacy(r.p), t20 = DB.top20.find(x => x.Player === r.p.Player);
        return `<tr><td class="rank-cell stick-1 rank-col ${rankCls(r.rank)}">${r.rank}</td><td class="stick-2">${nameLink(r.p.Player)}${isActive(r.p) ? ' <span class="muted">active</span>' : ''}</td><td>${posBadge(r.p.Position)}</td>
          <td class="num"><b>${fmt(L.total)}</b></td>${LEGACY_PARTS.map(([k]) => `<td class="num">${L.parts[k] ? fmt(L.parts[k]) : '<span class="muted">0</span>'}</td>`).join('')}
          <td class="num">${t20 ? '#' + t20.Rank + (t20.Rank === r.rank ? '' : ` <span class="muted">(${t20.Rank > r.rank ? '▲' : '▼'}${Math.abs(t20.Rank - r.rank)})</span>`) : '<span class="muted">—</span>'}</td></tr>`; }).join('')}
    </tbody></table></div>`;
}

// =====================================================================
// FRANCHISE LEGENDS (team popup)
// Awards are career totals, so a player's honors may come from other teams.
// Legends are ordered by what ties them to this franchise: a retired number,
// titles won here (NBA History and red team cells) and a one-team career, then legacy score.
// =====================================================================
function franchiseLegends(team) {
  return everyPlayer().filter(p => playerTeams(p).includes(team)).map(p => {
    const titles = titlesWithTeam(p, team), ret = retiredFor(p).filter(r => r.team === team), oneTeam = new Set(playerTeams(p)).size === 1;
    const L = legacy(p).total;
    return { p, titles, ret, oneTeam, score: L * (oneTeam ? 1 : 0.5) + titles * 120 + (ret.length ? 300 : 0) };
  }).sort((a, b) => b.score - a.score);
}
function legendsHtml(team) {
  const list = franchiseLegends(team);
  if (!list.length) return '';
  const row = (l, i) => `<div class="rb-row"><span class="rb-rank">${i + 1}</span><span class="rb-main">${nameLink(l.p.Player)} ${posBadge(l.p.Position)}
      <span class="journey-tags">${l.ret.map(r => `<em class="tag-ret">#${r.num} retired</em>`).join('')}${l.titles ? `<em class="tag-gold">${icon('trophy')} ${l.titles} here</em>` : ''}${l.oneTeam ? '<em class="tag-plain">One-team career</em>' : ''}${isActive(l.p) ? '<em class="tag-plain">Active</em>' : ''}</span></span>
      <span class="rb-val">${Math.round(legacy(l.p).total).toLocaleString()}</span><span class="rb-sub">Career, all teams: ${draftCareer(l.p)}</span></div>`;
  return `<div class="modal-section"><div class="modal-section-title">${icon('star')} Franchise Legends</div>
    <div class="leader-list">${list.slice(0, 8).map(row).join('')}</div>
    ${list.length > 8 ? `<details class="more-legends"><summary>All ${list.length} players who played here</summary>${list.slice(8).map((l, i) => row(l, i + 8)).join('')}</details>` : ''}</div>`;
}
