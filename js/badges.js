// 2K17 NBA Stats Database · Player badges, 2K style: each badge has up to four levels
// (Bronze, Silver, Gold, Legendary). Levels are set for this league, where almost every
// player is an all-time great, so a level means something compared with the others.
// Career numbers come from All Players; season feats from NBA History and Season Stat Leader.

const BADGE_TIERS = ['Bronze', 'Silver', 'Gold', 'Legendary'];
const BADGE_GROUPS = ['Scoring', 'Shooting', 'Rebounding', 'Playmaking', 'Defense', 'All-Around', 'Durability', 'Honors', 'Titles', 'Season Feats', 'Legacy'];

// Small helpers: a career number, a per-game average, a share
const bN = (p, k) => { const v = getNum(p[k]); return v === -Infinity || isNaN(v) ? null : v; };
const bPG = (p, k) => { const v = perGame(p, k); return v === null || isNaN(v) ? null : v; };
const bFmt = v => v >= 1000 ? Math.round(v).toLocaleString() : String(Math.round(v * 10) / 10);
const bPct = v => (Math.round(v * 10) / 10) + '%';

// The badge level for a value: the highest level whose threshold it reaches (null = level not used).
// Club badges compare every part; one-off achievements are 1 when earned.
function badgeLevelFor(b, v, tiers = b.tiers) {
  if (v === null || v === undefined) return 0;
  return tiers.reduce((n, t, i) => t === null || t === undefined ? n : (Array.isArray(t) ? t.every((x, j) => v[j] >= x) : v >= t) ? i + 1 : n, 0);
}
function badgeTierText(b, t) { return t === null || t === undefined ? null : b.kind === 'flag' ? 'Achieved' : b.kind === 'club' ? b.labels(t) : b.fmt(t); }
function makeBadge(b) {
  b.defName = b.name; b.defTiers = JSON.parse(JSON.stringify(b.tiers)); b.on = b.defOn = !b.off;
  b.level = p => badgeLevelFor(b, b.get(p));
  b.tierText = b.tiers.map(t => badgeTierText(b, t));
  return b;
}
// A badge earned by reaching a number: tiers are the four thresholds
function statBadge(id, name, group, desc, get, tiers, fmt = bFmt) { return makeBadge({ id, name, group, desc, tiers, fmt, get, kind: 'stat' }); }
// A club: every part must reach that level's number (e.g. points/rebounds/assists)
function clubBadge(id, name, group, desc, gets, tiers, labels) {
  return makeBadge({ id, name, group, desc, tiers, labels, kind: 'club', get: p => { const v = gets.map(g => g(p)); return v.some(x => x === null || x === undefined) ? null : v; } });
}
// A badge that starts switched off
function switchedOff(b) { b.off = true; b.on = b.defOn = false; return b; }
// A one-off achievement at one level (0 = Bronze ... 3 = Legendary)
function flagBadge(id, name, group, desc, tier, test) {
  const tiers = [null, null, null, null]; tiers[tier] = 1;
  return makeBadge({ id, name, group, desc, tiers, kind: 'flag', single: true, get: p => test(p) ? 1 : null });
}

// Season-by-season facts the career rows don't hold, built once per workbook
function badgeContext() {
  return cached('badgeContext', () => {
    const ctx = legacyContext(), c = { mvpYrs: {}, fmvpYrs: {}, dpoyYrs: {}, titleYrs: {}, titleTeams: {}, fmvpTeams: {}, statYrs: {}, upsetWins: {}, ruYrs: {}, face: {}, lineups: {}, rank: {} };
    const add = (m, k, v) => (m[k] = m[k] || []).push(v);
    Object.entries(ctx.mvp).forEach(([k, yrs]) => c.mvpYrs[k] = [...yrs]);
    Object.entries(ctx.fmvp).forEach(([k, yrs]) => c.fmvpYrs[k] = [...yrs]);
    Object.entries(ctx.roles).forEach(([k, rs]) => rs.forEach(r => { add(c.titleYrs, k, r.yr); const champ = finalsTeams(r.yr).champ; if (champ) add(c.titleTeams, k, champ); }));
    Object.entries(ctx.ruRoles).forEach(([k, rs]) => rs.forEach(r => add(c.ruYrs, k, r.yr)));
    DB.history.forEach(h => {
      const yr = Number(h.Season); if (isNaN(yr)) return;
      if (h.DPOY && h.DPOY !== '-') coNames(h.DPOY).forEach(nm => { const p = resolvePlayer(nm, yr); if (p) add(c.dpoyYrs, p.Player, yr); });
      if (h.FMVP && h.FMVP !== '-' && h.FMVPTeam) { const p = resolvePlayer(h.FMVP, yr); if (p) add(c.fmvpTeams, p.Player, fullTeamName(h.FMVPTeam)); }
    });
    [['Pts', 'pts'], ['Reb', 'reb'], ['Ast', 'ast'], ['Stl', 'stl'], ['Blk', 'blk']].forEach(([k, key]) => DB.statLeaders.forEach(r => {
      const p = r[k + 'Leader'] ? resolvePlayer(r[k + 'Leader'], r.Season) : null; if (p) add(c.statYrs, p.Player, { key, yr: Number(r.Season) });
    }));
    finalsData().filter(f => f.upset).forEach(f => f.cs.forEach(s => s.p && add(c.upsetWins, s.p.Player, f.yr)));
    DB.teams.filter(t => !t.defunct).forEach(t => {
      const f = franchiseLegends(t.Team)[0]; if (f) add(c.face, f.p.Player, t.Team);
      const L = franchiseLineup(t.Team); if (L.list.length >= 5) L.starters.forEach(x => x.p && add(c.lineups, x.p.Player, t.Team));
    });
    [...everyPlayer()].sort((a, b) => legacy(b).total - legacy(a).total).forEach((p, i) => c.rank[p.Player] = i + 1);
    return c;
  });
}
const bc = () => badgeContext();
const yrsOf = (m, p) => m[p.Player] || [];
// Longest run of consecutive seasons in a list of years
const longestRun = yrs => { const s = [...new Set(yrs)].sort((a, b) => a - b); let best = 0, run = 0; s.forEach((y, i) => { run = i && y === s[i - 1] + 1 ? run + 1 : 1; best = Math.max(best, run); }); return best; };
const sameYear = (a, b) => a.filter(y => b.includes(y)).length;
const statTitleYrs = (p, key) => yrsOf(bc().statYrs, p).filter(x => !key || x.key === key).map(x => x.yr);
const isBig = p => /C|PF/.test(String(p.Position || ''));
const isGuard = p => /G/.test(String(p.Position || '')) && !/F|C/.test(String(p.Position || ''));
const withMin = (p, k, min, get) => (bN(p, k) ?? 0) >= min ? get(p) : null;

// Draft pick from "56Rnd1Pick2" (round, pick); undrafted / territorial give null
const draftPick = p => { const m = String(p.Draft || '').match(/Rnd(\d+)Pick(\d+)/i); return m ? { rnd: Number(m[1]), pick: Number(m[2]) } : null; };
const otherAward = (p, re) => { const m = String(p['Other Award'] || '').match(new RegExp(re + '\\s*\\((\\d+)\\)', 'i')); return m ? Number(m[1]) : 0; };
const allD = p => (bN(p, '1st D Team') ?? 0) + (bN(p, '2nd D Team') ?? 0);
// Each badge: id, name, group, what it measures, then Bronze / Silver / Gold / Legendary.
const BADGES = [
  // Scoring
  statBadge('pts', 'Walking Bucket', 'Scoring', 'Career points', p => bN(p, 'PTS'), [30000, 35000, 37000, 40000]),
  statBadge('ppg', 'Microwave', 'Scoring', 'Career points per game', p => bPG(p, 'PTS'), [22, 25, 26, 28], v => v.toFixed(1)),
  statBadge('ftm', 'Free Throw Bank', 'Scoring', 'Career free throws made', p => bN(p, 'FTM'), [6000, 7000, 8000, 9000]),
  statBadge('pps', 'Mr. Efficient', 'Scoring', 'Points per shot (points ÷ field goal attempts), 10,000+ attempts', p => withMin(p, 'FGA', 10000, x => bN(x, 'PTS') / bN(x, 'FGA')), [1.35, 1.4, 1.45, 1.5], v => v.toFixed(2)),
  clubBadge('ptsreb', 'Paint Beast', 'Scoring', 'Career points and rebounds', [p => bN(p, 'PTS'), p => bN(p, 'REB')], [[25000, 10000], [28000, 12500], [32000, 15000], [35000, 17500]], t => `${bFmt(t[0])} pts + ${bFmt(t[1])} reb`),
  clubBadge('ptsast', 'Dual Threat', 'Scoring', 'Career points and assists', [p => bN(p, 'PTS'), p => bN(p, 'AST')], [[25000, 8000], [28000, 9000], [32000, 10000], [35000, 12000]], t => `${bFmt(t[0])} pts + ${bFmt(t[1])} ast`),
  statBadge('scoretitle', 'Scoring Crown', 'Scoring', 'Scoring titles', p => statTitleYrs(p, 'pts').length, [1, 2, 3, 5]),
  statBadge('scorestreak', 'Scoring Dynasty', 'Scoring', 'Scoring titles in a row', p => longestRun(statTitleYrs(p, 'pts')), [null, 2, 3, 5]),
  // Shooting
  statBadge('3pm', 'Splash Machine', 'Shooting', 'Career three-pointers made', p => bN(p, '3PM'), [3500, 4200, 4600, 5000]),
  statBadge('fgpct', 'Automatic', 'Shooting', 'Career field goal %, 5,000+ attempts', p => withMin(p, 'FGA', 5000, x => bN(x, 'FG%')), [50, 53, 56, 58], bPct),
  statBadge('3pct', 'Sniper Scope', 'Shooting', 'Career three-point %, 2,000+ attempts', p => withMin(p, '3PA', 2000, x => bN(x, '3P%')), [38, 40, 42, 44], bPct),
  statBadge('ftpct', 'Ice Water', 'Shooting', 'Career free throw %, 2,000+ attempts', p => withMin(p, 'FTA', 2000, x => bN(x, 'FT%')), [88, 90, 93, 95], bPct),
  clubBadge('504090', '50/40/90 Club', 'Shooting', 'Career FG% / 3P% / FT% together (the career version of a 50/40/90 season)', [p => withMin(p, 'FGA', 5000, x => bN(x, 'FG%')), p => withMin(p, '3PA', 1000, x => bN(x, '3P%')), p => withMin(p, 'FTA', 1000, x => bN(x, 'FT%'))],
    [null, null, [50, 40, 90], [52, 42, 92]], t => `${t[0]} / ${t[1]} / ${t[2]}`),
  clubBadge('stretchbig', 'Pick & Pop Big', 'Shooting', 'Centers and power forwards: career threes made', [p => isBig(p) ? 1 : null, p => bN(p, '3PM')], [[1, 1000], [1, 1500], [1, 1800], [1, 2200]], t => `${bFmt(t[1])} threes`),
  clubBadge('unicorn', 'Unicorn', 'Shooting', 'Blocks per game and career threes together', [p => bPG(p, 'BLK'), p => bN(p, '3PM')], [[1.5, 1200], [2, 1500], [2.3, 2000], [2.5, 2200]], t => `${t[0]} bpg + ${bFmt(t[1])} threes`),
  // Rebounding
  statBadge('reb', 'Glass Eater', 'Rebounding', 'Career rebounds', p => bN(p, 'REB'), [15000, 17000, 18500, 20000]),
  statBadge('rpg', 'Board Bully', 'Rebounding', 'Career rebounds per game', p => bPG(p, 'REB'), [10.5, 12, 13, 14], v => v.toFixed(1)),
  statBadge('rebtitle', 'Rebound Crown', 'Rebounding', 'Rebounding titles', p => statTitleYrs(p, 'reb').length, [1, 2, 3, 5]),
  statBadge('rebstreak', 'Glass Dynasty', 'Rebounding', 'Rebounding titles in a row', p => longestRun(statTitleYrs(p, 'reb')), [null, 2, 3, 5]),
  clubBadge('guardreb', 'Guard on the Glass', 'Rebounding', 'Guards: rebounds per game', [p => isGuard(p) ? 1 : null, p => bPG(p, 'REB')], [[1, 5], [1, 6], [1, 7], [1, 8]], t => `${t[1]} rpg`),
  // Playmaking
  statBadge('ast', 'Dime Dropper', 'Playmaking', 'Career assists', p => bN(p, 'AST'), [10000, 11000, 12000, 12800]),
  statBadge('apg', 'Floor General', 'Playmaking', 'Career assists per game', p => bPG(p, 'AST'), [7.5, 8, 9, 10], v => v.toFixed(1)),
  statBadge('astto', 'Ball on a String', 'Playmaking', 'Assists per turnover, 3,000+ assists', p => withMin(p, 'AST', 3000, x => bN(x, 'TO') ? bN(x, 'AST') / bN(x, 'TO') : null), [2.5, 2.8, 3, 3.5], v => v.toFixed(2)),
  statBadge('asttitle', 'Assist Crown', 'Playmaking', 'Assist titles', p => statTitleYrs(p, 'ast').length, [1, 2, 3, 5]),
  statBadge('aststreak', 'Dime Dynasty', 'Playmaking', 'Assist titles in a row', p => longestRun(statTitleYrs(p, 'ast')), [null, 2, 3, 5]),
  clubBadge('bigpass', 'Hub Big', 'Playmaking', 'Centers and power forwards: assists per game', [p => isBig(p) ? 1 : null, p => bPG(p, 'AST')], [[1, 4], [1, 5], [1, 6], [1, 7]], t => `${t[1]} apg`),
  clubBadge('pointfwd', 'Point Forward', 'Playmaking', 'Rebounds and assists per game together', [p => bPG(p, 'REB'), p => bPG(p, 'AST')], [[7, 5], [8, 6], [9, 7], [10, 8]], t => `${t[0]} rpg + ${t[1]} apg`),
  // Defense
  statBadge('stl', 'Thief', 'Defense', 'Career steals', p => bN(p, 'STL'), [2500, 2800, 3250, 3500]),
  statBadge('spg', 'Passing Lane Patrol', 'Defense', 'Career steals per game', p => bPG(p, 'STL'), [2, 2.4, 2.6, 2.8], v => v.toFixed(1)),
  statBadge('blk', 'Shot Eraser', 'Defense', 'Career blocks', p => bN(p, 'BLK'), [2250, 2500, 3000, 3800]),
  statBadge('bpg', 'Block Party', 'Defense', 'Career blocks per game', p => bPG(p, 'BLK'), [2, 2.3, 2.6, 3], v => v.toFixed(1)),
  statBadge('stocks', 'Havoc', 'Defense', 'Career steals + blocks', p => (bN(p, 'STL') ?? 0) + (bN(p, 'BLK') ?? 0) || null, [4500, 5000, 5500, 6000]),
  statBadge('alld', 'Clamps', 'Defense', 'All-Defensive team selections', p => allD(p), [8, 10, 12, 14]),
  statBadge('dpoy', 'The Anchor', 'Defense', 'Defensive Player of the Year awards', p => bN(p, 'DPOY'), [1, 2, 4, 5]),
  statBadge('dpoystreak', 'Brick Wall', 'Defense', 'DPOYs in a row', p => longestRun(yrsOf(bc().dpoyYrs, p)), [null, 2, 3, null]),
  statBadge('stltitle', 'Steals Crown', 'Defense', 'Steals titles', p => statTitleYrs(p, 'stl').length, [1, 2, 3, 5]),
  statBadge('blktitle', 'Blocks Crown', 'Defense', 'Blocks titles', p => statTitleYrs(p, 'blk').length, [1, 2, 3, 5]),
  clubBadge('paint', 'No Fly Zone', 'Defense', 'Rebounds and blocks per game together', [p => bPG(p, 'REB'), p => bPG(p, 'BLK')], [[10, 2], [11, 2.2], [12, 2.5], [12.8, 2.8]], t => `${t[0]} rpg + ${t[1]} bpg`),
  clubBadge('twoway', 'Two-Way Menace', 'Defense', 'All-NBA and All-Defensive selections together', [p => bN(p, 'All NBA Team'), p => allD(p)], [[8, 8], [10, 10], [12, 12], [14, 14]], t => `${t[0]} All-NBA + ${t[1]} All-D`),
  flagBadge('dpoymvp', 'Both Ends', 'Defense', 'Won MVP and DPOY in his career', 2, p => (bN(p, 'MVP') ?? 0) > 0 && (bN(p, 'DPOY') ?? 0) > 0),
  // All-around
  statBadge('dd', 'Double Trouble', 'All-Around', 'Career double-doubles', p => bN(p, 'DD2'), [800, 900, 1000, 1100]),
  statBadge('td', 'Triple-Double Factory', 'All-Around', 'Career triple-doubles', p => bN(p, 'TD3'), [50, 100, 150, 200]),
  statBadge('pra', 'Stat Sheet Stuffer', 'All-Around', 'Career points + rebounds + assists', p => (bN(p, 'PTS') ?? 0) + (bN(p, 'REB') ?? 0) + (bN(p, 'AST') ?? 0) || null, [55000, 58000, 60000, 65000]),
  clubBadge('triangle', 'Triangle Club', 'All-Around', 'Career points, rebounds and assists all at the number', [p => bN(p, 'PTS'), p => bN(p, 'REB'), p => bN(p, 'AST')], [[8000, 8000, 8000], [9000, 9000, 9000], [10000, 10000, 10000], [12000, 12000, 12000]], t => `${bFmt(t[0])} / ${bFmt(t[1])} / ${bFmt(t[2])}`),
  clubBadge('25-5-5', 'Swiss Army Knife', 'All-Around', 'Career points, rebounds and assists per game', [p => bPG(p, 'PTS'), p => bPG(p, 'REB'), p => bPG(p, 'AST')], [[20, 5, 5], [22, 6, 6], [24, 7, 7], [25, 8, 8]], t => `${t[0]} / ${t[1]} / ${t[2]}`),
  clubBadge('5x5', 'Five-Tool Freak', 'All-Around', 'Per game: points, rebounds, assists, steals, blocks', [p => bPG(p, 'PTS'), p => bPG(p, 'REB'), p => bPG(p, 'AST'), p => bPG(p, 'STL'), p => bPG(p, 'BLK')],
    [[20, 5, 5, 0.8, 0.8], [22, 6, 6, 1, 1], [24, 7, 7, 1.2, 1.2], [25, 8, 8, 1.5, 1.5]], t => `${t.join(' / ')}`),
  statBadge('stattitles', 'Category King', 'All-Around', 'Stat titles of any kind', p => statTitleYrs(p).length, [5, 7, 10, 14]),
  statBadge('stattypes', 'Jack of All Trades', 'All-Around', 'Different stat titles won (points, rebounds, assists, steals, blocks)', p => new Set(yrsOf(bc().statYrs, p).map(x => x.key)).size, [null, 2, 3, 4]),
  statBadge('doubletitle', 'Two-Category Terror', 'All-Around', 'Seasons leading the league in two or more stats', p => { const by = {}; yrsOf(bc().statYrs, p).forEach(x => by[x.yr] = (by[x.yr] || 0) + 1); return Object.values(by).filter(n => n >= 2).length; }, [1, 2, 3, 5]),
  // Durability
  statBadge('gp', 'Iron Man', 'Durability', 'Career games played', p => bN(p, 'GP'), [1500, 1550, 1575, 1600]),
  statBadge('min', 'Workhorse', 'Durability', 'Career minutes', p => bN(p, 'MIN'), [50000, 52500, 55000, 57500]),
  statBadge('mpg', 'Never Sits', 'Durability', 'Career minutes per game', p => bPG(p, 'MIN'), [36, 37.5, 40, 42], v => v.toFixed(1)),
  statBadge('exp', 'Ageless', 'Durability', 'Seasons played', p => bN(p, 'Exp'), [20, 21, 22, 23]),
  statBadge('allstar', 'Perennial All-Star', 'Honors', 'All-Star selections', p => bN(p, 'All Stars'), [14, 15, 16, 19]),
  statBadge('allnba', 'All-League', 'Honors', 'All-NBA selections', p => bN(p, 'All NBA Team'), [12, 14, 15, 16]),
  statBadge('allnba1', 'First Team Lock', 'Honors', 'All-NBA 1st team selections', p => bN(p, '1st Team'), [7, 9, 11, 13]),
  statBadge('allnbaall', 'Mainstay', 'Honors', 'Share of seasons played with an All-NBA selection', p => bN(p, 'Exp') ? (bN(p, 'All NBA Team') ?? 0) / bN(p, 'Exp') * 100 : null, [70, 75, 80, 90], v => Math.round(v) + '%'),
  statBadge('mvp', 'MVP', 'Honors', 'MVP awards', p => bN(p, 'MVP'), [1, 2, 4, 5]),
  statBadge('mvpstreak', 'Repeat Offender', 'Honors', 'MVPs in a row', p => longestRun(yrsOf(bc().mvpYrs, p)), [null, 2, 3, 4]),
  statBadge('fmvp', 'Finals Closer', 'Honors', 'Finals MVP awards', p => bN(p, 'FMVP'), [1, 2, 3, 5]),
  flagBadge('rotymvp', 'Star From Day One', 'Honors', 'Won Rookie of the Year and later MVP', 1, p => isRoty(p) && (bN(p, 'MVP') ?? 0) > 0),
  flagBadge('triplecrown', 'Triple Crown', 'Honors', 'Won MVP, Finals MVP and DPOY', 3, p => (bN(p, 'MVP') ?? 0) > 0 && (bN(p, 'FMVP') ?? 0) > 0 && (bN(p, 'DPOY') ?? 0) > 0),
  flagBadge('grandslam', 'Grand Slam', 'Honors', 'Won Rookie of the Year, MVP, Finals MVP and a title', 2, p => isRoty(p) && (bN(p, 'MVP') ?? 0) > 0 && (bN(p, 'FMVP') ?? 0) > 0 && (bN(p, 'Champions') ?? 0) > 0),
  clubBadge('mvpfmvp', 'Double Crown', 'Honors', 'MVP and Finals MVP awards together', [p => bN(p, 'MVP'), p => bN(p, 'FMVP')], [[1, 1], [2, 2], [3, 3], [4, 4]], t => `${t[0]} MVP + ${t[1]} FMVP`),
  statBadge('awards', 'Trophy Room', 'Honors', 'MVP + Finals MVP + DPOY + ROTY awards', p => (bN(p, 'MVP') ?? 0) + (bN(p, 'FMVP') ?? 0) + (bN(p, 'DPOY') ?? 0) + (isRoty(p) ? 1 : 0), [4, 6, 9, 12]),
  // Titles
  statBadge('rings', 'Jewelry Box', 'Titles', 'Championships', p => bN(p, 'Champions'), [3, 4, 5, 6]),
  statBadge('finalsapp', 'June Regular', 'Titles', 'Finals appearances', p => bN(p, 'Finals App'), [5, 6, 8, 10]),
  statBadge('threepeat', 'Three-Peat', 'Titles', 'Titles in a row as a listed champion star', p => longestRun(yrsOf(bc().titleYrs, p)), [null, 3, 4, 6]),
  statBadge('ringteams', 'Ring Chaser', 'Titles', 'Different teams won a title with (as a listed champion star)', p => new Set(yrsOf(bc().titleTeams, p)).size, [null, 2, 3, 4]),
  statBadge('fmvpteams', 'Hero Anywhere', 'Titles', 'Different teams won Finals MVP with', p => new Set(yrsOf(bc().fmvpTeams, p)).size, [null, null, 2, 3]),
  statBadge('franchise', 'Alpha', 'Titles', 'Titles won as the franchise player or single core', p => (legacyContext().roles[p.Player] || []).filter(r => /franchise|single/.test(r.label)).length, [1, 2, 3, 5]),
  statBadge('championstar', 'Star of the Show', 'Titles', 'Titles won as a listed champion star', p => yrsOf(bc().titleYrs, p).length, [3, 5, 6, 7]),
  statBadge('perfect', 'Undefeated in June', 'Titles', 'Finals played without ever losing one', p => { const a = bN(p, 'Finals App') ?? 0, w = bN(p, 'Champions') ?? 0; return a && a === w ? a : null; }, [null, 3, 4, 6]),
  statBadge('upset', 'Giant Killer', 'Titles', 'Titles won in an upset Finals, as a listed champion star', p => yrsOf(bc().upsetWins, p).length, [null, 1, 2, null]),
  statBadge('conf', 'Big Stage', 'Titles', 'Finals played as a listed star, won or lost', p => yrsOf(bc().titleYrs, p).length + yrsOf(bc().ruYrs, p).length, [5, 6, 8, 10]),
  statBadge('mvpfmvpyr', 'Clean Sweep', 'Titles', 'MVP and Finals MVP in the same season (counted over the career)', p => sameYear(yrsOf(bc().mvpYrs, p), yrsOf(bc().fmvpYrs, p)), [1, 2, 3, 4]),
  statBadge('scorering', 'Bucket and a Ring', 'Titles', 'Scoring title and championship in the same season', p => sameYear(statTitleYrs(p, 'pts'), yrsOf(bc().titleYrs, p)), [null, 1, 2, null]),
  statBadge('dpoyring', 'Defense Wins Titles', 'Titles', 'DPOY and championship in the same season', p => sameYear(yrsOf(bc().dpoyYrs, p), yrsOf(bc().titleYrs, p)), [null, 1, 2, null]),
  statBadge('mvpdpoyyr', 'Two-Way MVP', 'Honors', 'MVP and DPOY in the same season', p => sameYear(yrsOf(bc().mvpYrs, p), yrsOf(bc().dpoyYrs, p)), [null, null, 1, 2]),
  // Legacy
  statBadge('legacypts', 'Hall of Famer', 'Legacy', 'Legacy score', p => legacy(p).total || null, [1800, 2000, 2500, 3000]),
  statBadge('retired', 'In the Rafters', 'Legacy', 'Teams that retired his number', p => [p['# Retired'], p['# Retired2'], p['# Retired3']].filter(x => x !== undefined && x !== null && String(x).trim() !== '' && String(x).trim() !== '/').length, [null, 2, null, 3]),
  flagBadge('lifer', 'Lifer', 'Legacy', 'Whole career (10+ seasons) with one team', 1, p => new Set(playerTeams(p)).size === 1 && (bN(p, 'Exp') ?? 0) >= 10),
  flagBadge('liferring', 'Franchise Icon', 'Legacy', 'Whole career with one team, 3+ titles there', 2, p => new Set(playerTeams(p)).size === 1 && (bN(p, 'Champions') ?? 0) >= 3),
  statBadge('face', 'Face of the Franchise', 'Legacy', "Teams where he is the #1 Franchise Legend", p => yrsOf(bc().face, p).length, [null, 1, 2, null]),
  statBadge('lineup', 'All-Time Starter', 'Legacy', "Teams' All-Time starting fives he is in", p => yrsOf(bc().lineups, p).length, [null, 1, 2, 3]),
  // Draft, era and shooting combos
  clubBadge('latepick', 'Late Bloomer', 'Legacy', 'Drafted 15th or later, then won MVP', [p => { const d = draftPick(p); return d && (d.rnd - 1) * 30 + d.pick >= 15 ? 1 : null; }, p => bN(p, 'MVP')], [null, [1, 1], null, null], t => `${t[1]} MVP`),
  statBadge('decade', 'Era Definer', 'Legacy', 'Decade Team selections', p => (DB.decades || []).filter(d => [...(d.starter || []), ...(d.subs || [])].some(n => resolvePlayer(n)?.Player === p.Player)).length || null, [null, null, 2, 3]),
  clubBadge('steal', 'Second-Round Steal', 'Legacy', 'Drafted in round 2 or later, then All-Star selections', [p => (draftPick(p)?.rnd ?? 0) >= 2 ? 1 : null, p => bN(p, 'All Stars')], [[1, 3], [1, 6], [1, 10], [1, 14]], t => `${t[1]} All-Stars`),
  flagBadge('oldschool', 'Old School', 'Legacy', 'Career began before 1980, with 10+ All-Star selections', 1, p => { const s = careerSpan(p.Season); return s && s[0] < 1980 && (bN(p, 'All Stars') ?? 0) >= 10; }),
  clubBadge('volsniper', 'Volume Sniper', 'Shooting', 'Threes made per game and career 3P% together', [p => bN(p, 'GP') ? (bN(p, '3PM') ?? 0) / bN(p, 'GP') : null, p => bN(p, '3P%')], [[2.5, 37.5], [3, 40], [3.2, 41], [3.5, 42]], t => `${t[0]} 3PM/g + ${t[1]}%`),
  clubBadge('ftmoney', 'Money at the Line', 'Shooting', 'Free throws made per game and career FT% together', [p => bN(p, 'GP') ? (bN(p, 'FTM') ?? 0) / bN(p, 'GP') : null, p => bN(p, 'FT%')], [[4.5, 85], [5, 86], [5.5, 87], [6, 88]], t => `${t[0]} FTM/g + ${t[1]}%`),
  statBadge('ts', 'Smooth Operator', 'Shooting', 'Career true shooting % (points ÷ 2 × (FGA + 0.44 × FTA))', p => bN(p, 'PTS') && bN(p, 'FGA') ? bN(p, 'PTS') / (2 * (bN(p, 'FGA') + 0.44 * (bN(p, 'FTA') ?? 0))) * 100 : null, [60.5, 61.5, 63.5, 65], bPct),
  clubBadge('effstar', 'Efficient Superstar', 'Scoring', 'Points per game and true shooting % together', [p => bPG(p, 'PTS'), p => bN(p, 'PTS') && bN(p, 'FGA') ? bN(p, 'PTS') / (2 * (bN(p, 'FGA') + 0.44 * (bN(p, 'FTA') ?? 0))) * 100 : null], [[24, 60], [25, 61], [26, 62], [27, 63]], t => `${t[0]} ppg + ${t[1]}% TS`),

  // Switched off (they can be turned on in Settings → Badges)
  switchedOff(statBadge('fgm', 'Shot Maker', 'Scoring', 'Career field goals made', p => bN(p, 'FGM'), [12000, 13500, 14800, 15800])),
  switchedOff(statBadge('fta', 'Contact Seeker', 'Scoring', 'Career free throw attempts', p => bN(p, 'FTA'), [8200, 8800, 9600, 11500])),
  switchedOff(statBadge('3pa', 'Limitless Trigger', 'Shooting', 'Career three-point attempts', p => bN(p, '3PA'), [8700, 10000, 11000, 12300])),
  switchedOff(statBadge('oreb', 'Putback Artist', 'Rebounding', 'Offensive rebounds per game', p => bN(p, 'Avg OREB'), [3.3, 4.2, 4.5, 4.9], v => v.toFixed(1))),
  switchedOff(statBadge('alld1', 'Lockdown', 'Defense', 'All-Defensive 1st team selections', p => bN(p, '1st D Team'), [5, 8, 10, 11])),
  switchedOff(statBadge('ddrate', 'Nightly Double', 'All-Around', 'Double-doubles per game played', p => bN(p, 'GP') ? (bN(p, 'DD2') ?? 0) / bN(p, 'GP') * 100 : null, [58, 66, 75, 82], v => Math.round(v) + '%')),
  switchedOff(clubBadge('25-10', 'Walking 25-10', 'All-Around', 'Career points and rebounds per game', [p => bPG(p, 'PTS'), p => bPG(p, 'REB')], [[22, 10], [24, 11], [26, 12], [28, 13]], t => `${t[0]} ppg + ${t[1]} rpg`)),
  switchedOff(clubBadge('agestar', 'Fine Wine', 'Durability', 'Long career with All-Star selections', [p => bN(p, 'Exp'), p => bN(p, 'All Stars')], [[19, 13], [20, 15], [21, 17], [22, 19]], t => `${t[0]} seasons + ${t[1]} All-Stars`)),
  switchedOff(flagBadge('roty', 'Rookie Sensation', 'Honors', 'Won Rookie of the Year', 0, p => isRoty(p))),
  switchedOff(statBadge('mvpring', 'King of the Hill', 'Titles', 'MVP and title in the same season (counted over the career)', p => sameYear(yrsOf(bc().mvpYrs, p), yrsOf(bc().titleYrs, p)), [1, 2, 3, 4])),
  switchedOff(statBadge('journey', 'Suitcase', 'Legacy', 'Teams played for', p => new Set(playerTeams(p)).size, [5, 6, 7, 9])),
  switchedOff(flagBadge('pick1', 'Number One', 'Legacy', 'Drafted 1st overall', 0, p => draftPick(p)?.rnd === 1 && draftPick(p)?.pick === 1)),
  switchedOff(statBadge('sixth', 'Sixth Man Spark', 'Honors', 'Sixth Man of the Year awards', p => otherAward(p, '6th Man') || null, [1, 2, 3, 5])),
  switchedOff(flagBadge('mip', 'Glow Up', 'Honors', 'Most Improved Player award', 0, p => otherAward(p, 'MIP') > 0)),
  switchedOff(flagBadge('rookie1', 'Instant Impact', 'Honors', 'All-Rookie 1st team', 0, p => String(p.RookieTeam || '').trim() === '1st')),
  switchedOff(statBadge('duo', 'Dynamic Duo', 'Titles', 'Most titles won with the same listed co-star', p => { const yrs = yrsOf(bc().titleYrs, p), c = {}; yrs.forEach(y => { const h = DB.history.find(x => Number(x.Season) === y); [h?.Star1, h?.Star2, h?.Star3].filter(Boolean).forEach(s => { const q = resolvePlayer(String(s).replace(/\s*\(\d+\)\s*$/, ''), y); if (q && q.Player !== p.Player) c[q.Player] = (c[q.Player] || 0) + 1; }); }); return Math.max(0, ...Object.values(c)) || null; }, [2, 3, 4, 5])),
  switchedOff(statBadge('rival', 'Rival Slayer', 'Titles', 'Most Finals won against the same team, as a listed star', p => { const c = {}; yrsOf(bc().titleYrs, p).forEach(y => { const ru = finalsTeams(y).ru; if (ru) c[ru] = (c[ru] || 0) + 1; }); return Math.max(0, ...Object.values(c)) || null; }, [null, 2, 3, 4])),
  switchedOff(flagBadge('hometown', 'Hometown Hero', 'Legacy', 'Number retired by the team that drafted him (his first team), after playing elsewhere too', 1, p => { const ts = playerTeams(p); return new Set(ts).size > 1 && retiredFor(p).some(r => r.team === ts[0]); })),
  switchedOff(statBadge('ironclad', 'Ironclad', 'Durability', 'Games played per season', p => bN(p, 'Exp') && bN(p, 'GP') ? bN(p, 'GP') / bN(p, 'Exp') : null, [74, 76, 78, 80], v => v.toFixed(1))),
  switchedOff(statBadge('bridesmaid', 'Always the Bridesmaid', 'Titles', 'Finals lost without ever winning a title', p => (bN(p, 'Champions') ?? 0) === 0 ? (bN(p, 'Finals App') ?? 0) || null : null, [2, 3, 4, 5])),
  switchedOff(clubBadge('fgvol', 'Bully Ball', 'Shooting', 'Field goals made per game and career FG% together', [p => bN(p, 'GP') ? (bN(p, 'FGM') ?? 0) / bN(p, 'GP') : null, p => bN(p, 'FG%')], [[8.5, 50], [9, 52], [10, 52], [10, 55]], t => `${t[0]} FGM/g + ${t[1]}%`)),
  switchedOff(statBadge('ftpg', 'And-One Artist', 'Scoring', 'Free throw attempts per game', p => bN(p, 'GP') ? (bN(p, 'FTA') ?? 0) / bN(p, 'GP') : null, [6.5, 7.5, 8.5, 10], v => v.toFixed(1))),
];


// ---------------------------------------------------------------------
// Settings → Badges: switch badges on or off, rename them and change their levels.
// Saved on this device; anything left as it was follows the defaults above.
// ---------------------------------------------------------------------
const BADGE_SET_KEY = 'nba2k17-badges';
let badgeDraft = null;   // Settings → Badges changes not saved yet
// What each part of a club badge measures (null = a fixed gate such as "is a center")
const BADGE_PARTS = { ptsreb: ['pts', 'reb'], ptsast: ['pts', 'ast'], '504090': ['FG%', '3P%', 'FT%'], stretchbig: [null, 'threes'], unicorn: ['bpg', 'threes'], guardreb: [null, 'rpg'],
  bigpass: [null, 'apg'], pointfwd: ['rpg', 'apg'], paint: ['rpg', 'bpg'], twoway: ['All-NBA', 'All-D'], triangle: ['pts', 'reb', 'ast'], '25-10': ['ppg', 'rpg'], '25-5-5': ['ppg', 'rpg', 'apg'],
  '5x5': ['ppg', 'rpg', 'apg', 'spg', 'bpg'], agestar: ['seasons', 'All-Stars'], mvpfmvp: ['MVP', 'FMVP'], steal: [null, 'All-Stars'], latepick: [null, 'MVP'],
  volsniper: ['3PM/g', '3P%'], ftmoney: ['FTM/g', 'FT%'], fgvol: ['FGM/g', 'FG%'], effstar: ['ppg', 'TS%'] };
const badgeSettings = () => readJSON(BADGE_SET_KEY) || {};
function applyBadgeSettings(set = badgeDraft || badgeSettings()) {
  BADGES.forEach(b => {
    const o = set[b.id] || {};
    b.on = o.on ?? b.defOn; b.name = o.name || b.defName;
    b.tiers = JSON.parse(JSON.stringify(o.tiers || b.defTiers));
    b.tierText = b.tiers.map(t => badgeTierText(b, t));
  });
  Object.keys(engineCache).forEach(k => { if (k.startsWith('badges|') || k === 'badgeHolders') delete engineCache[k]; });
}
applyBadgeSettings();
const activeBadges = () => BADGES.filter(b => b.on);
const badgeChanged = b => b.on !== b.defOn || b.name !== b.defName || JSON.stringify(b.tiers) !== JSON.stringify(b.defTiers);
// Settings → Badges edits a draft: changes show in the counts at once, and are written only on Save
function badgeDraftStart() { badgeDraft = JSON.parse(JSON.stringify(badgeSettings())); }
function badgeDraftSave() { if (badgeDraft) writeJSON(BADGE_SET_KEY, badgeDraft); applyBadgeSettings(); }
function badgeDraftDiscard() { badgeDraft = null; applyBadgeSettings(); }
function saveBadgeSetting(id, patch) {
  if (!badgeDraft) badgeDraftStart();
  const set = badgeDraft, b = BADGES.find(x => x.id === id);
  const o = { ...(set[id] || {}), ...patch };
  if (o.on === b.defOn) delete o.on;
  if (!o.name || o.name === b.defName) delete o.name;
  if (o.tiers && JSON.stringify(o.tiers) === JSON.stringify(b.defTiers)) delete o.tiers;
  if (Object.keys(o).length) set[id] = o; else delete set[id];
  applyBadgeSettings(set);
  if (typeof markSettingsDirty === 'function') markSettingsDirty();
}
// Each player's number for a badge, kept for live counts while levels are typed
const badgeValues = b => cached('bvals|' + b.id, () => everyPlayer().map(p => b.get(p)));
function badgeCounts(b) {
  const out = [0, 0, 0, 0]; badgeValues(b).forEach(v => { const lv = badgeLevelFor(b, v); if (lv) out[lv - 1]++; }); return out;
}
const badgeSetState = { group: 'Scoring' };
function badgeSettingsAvg() {
  const act = activeBadges(), n = everyPlayer().length;
  return (act.reduce((a, b) => a + badgeCounts(b).reduce((x, y) => x + y, 0), 0) / n).toFixed(1);
}
function badgeSettingRow(b) {
  const c = badgeCounts(b), parts = BADGE_PARTS[b.id] || [];
  const box = (k, j, val, lab) => `<span class="part"><input type="number" step="any" inputmode="decimal" id="bs-${b.id}-${k}${j === undefined ? '' : '-' + j}" value="${val ?? ''}" placeholder="off"
      aria-label="${BADGE_TIERS[k]}${lab ? ' ' + lab : ''}" onchange="setBadgeLevel('${b.id}',${k},${j === undefined ? 'null' : j},this.value)">${lab ? `<small>${lab}</small>` : ''}</span>`;
  const levels = b.kind === 'flag'
    ? `<span class="bd-level ${tierClass(b.tiers.findIndex(t => t) + 1)}"><i></i><select id="bs-${b.id}-flag" aria-label="Level" onchange="setBadgeFlag('${b.id}',this.value)">${BADGE_TIERS.map((n, i) => `<option value="${i}"${b.tiers[i] ? ' selected' : ''}>${n}</option>`).join('')}</select> <em>${c.reduce((a, x) => a + x, 0)}</em></span>`
    : b.tiers.map((t, k) => `<span class="bd-level ${tierClass(k + 1)}${t === null ? ' unused' : ''}"><i></i>${b.kind === 'club' ? parts.map((lab, j) => lab === null ? '' : box(k, j, t ? t[j] : null, lab)).join('') : box(k, undefined, t)} <em>${t === null ? '' : c[k]}</em></span>`).join('');
  return `<div class="bs-row${b.on ? '' : ' off'}" id="bs-row-${b.id}">
    <div class="bs-main"><div class="bs-head"><label class="bs-on"><input type="checkbox" id="bs-on-${b.id}" ${b.on ? 'checked' : ''} onchange="saveBadgeSetting('${b.id}',{on:this.checked});refreshBadgeSettings()"><span class="sr-only">Use ${b.defName}</span></label><input class="bs-name" id="bs-name-${b.id}" value="${b.name.replace(/"/g, '&quot;')}" placeholder="${b.defName}" aria-label="Badge name" onchange="saveBadgeSetting('${b.id}',{name:this.value.trim()});refreshBadgeSettings()">
      <span class="bs-total">${c.reduce((a, x) => a + x, 0)} players</span>${badgeChanged(b) ? `<button type="button" class="card-link" onclick="resetBadgeSetting('${b.id}')">Reset</button>` : ''}</div>
      <div class="muted bs-desc">${b.desc}</div><div class="bd-levels">${levels}</div></div></div>`;
}
function badgeSettingsHtml() {
  const groups = BADGE_GROUPS.filter(g => BADGES.some(b => b.group === g));
  const list = BADGES.filter(b => b.group === badgeSetState.group);
  return `<div class="chart-card" id="badgeSettings"><div class="card-head"><div class="chart-title">${icon('star')} Badges</div><button class="card-link" onclick="resetAllBadgeSettings()">Reset all</button></div>
    <p class="muted" style="margin-bottom:10px">Switch badges on or off, rename them and change the number each level needs. The player counts update as you change a level; leave a box empty to skip that level. Tap Save to keep your changes (saved on this device).</p>
    <div class="bs-summary"><b>${activeBadges().length}</b> of ${BADGES.length} badges on · <b>${badgeSettingsAvg()}</b> per player</div>
    <div class="bs-groups">${groups.map(g => `<button type="button" class=""${badgeSetState.group === g ? 'active' : ''}" onclick="badgeSetState.group='${g}';refreshBadgeSettings()">${g} <span class="muted">${BADGES.filter(b => b.group === g && b.on).length}/${BADGES.filter(b => b.group === g).length}</span></button>`).join('')}</div>
    <div class="bs-list">${list.map(badgeSettingRow).join('')}</div></div>`;
}
// Redraw on the next frame (an input's own change/blur events must finish first); keep the scroll position
let badgeSetFrame = 0;
function refreshBadgeSettings() {
  cancelAnimationFrame(badgeSetFrame);
  badgeSetFrame = requestAnimationFrame(() => { const el = document.getElementById('badgeSettings'); if (!el) return; const y = scrollY; el.outerHTML = badgeSettingsHtml(); scrollTo(0, y); });
}
function setBadgeLevel(id, k, j, raw) {
  const b = BADGES.find(x => x.id === id), t = JSON.parse(JSON.stringify(b.tiers)), v = raw === '' ? null : Number(raw);
  if (b.kind === 'club') {
    const parts = BADGE_PARTS[id] || [], cur = (t[k] || b.defTiers[k] || b.defTiers.find(Boolean)).slice();
    cur[j] = v;
    const boxes = [...document.querySelectorAll(`[id^="bs-${id}-${k}-"]`)];
    t[k] = boxes.every(x => x.value === '') ? null : cur.map((x, i) => parts[i] === null ? 1 : (x ?? 0));
  } else t[k] = v;
  saveBadgeSetting(id, { tiers: t }); refreshBadgeSettings();
}
function setBadgeFlag(id, k) { const t = [null, null, null, null]; t[Number(k)] = 1; saveBadgeSetting(id, { tiers: t }); refreshBadgeSettings(); }
function resetBadgeSetting(id) { if (!badgeDraft) badgeDraftStart(); delete badgeDraft[id]; applyBadgeSettings(badgeDraft); markSettingsDirty(); refreshBadgeSettings(); }
function resetAllBadgeSettings() { badgeDraft = {}; applyBadgeSettings(badgeDraft); markSettingsDirty(); refreshBadgeSettings(); }

// Every badge a player holds, best first
function playerBadges(p) {
  return cached('badges|' + p.Player, () => activeBadges().map(b => ({ b, lv: b.level(p) })).filter(x => x.lv > 0)
    .sort((a, c) => c.lv - a.lv || BADGE_GROUPS.indexOf(a.b.group) - BADGE_GROUPS.indexOf(c.b.group)));
}
// Holders of each badge at each level
function badgeHolders() {
  return cached('badgeHolders', () => {
    const out = {}; activeBadges().forEach(b => out[b.id] = [[], [], [], []]);
    everyPlayer().forEach(p => playerBadges(p).forEach(({ b, lv }) => out[b.id][lv - 1].push(p)));
    return out;
  });
}
const tierClass = lv => ['', 'bd-bronze', 'bd-silver', 'bd-gold', 'bd-legend'][lv];
// A badge chip: tap it (phones) or point at it (desktop) for a small box explaining it
function badgeChip(b, lv) {
  return `<button type="button" class="bd-chip ${tierClass(lv)}" data-badge="${b.id}" data-lv="${lv}" aria-expanded="false"><i></i>${b.name}</button>`;
}
// The box: the badge's level, what it measures and what this level needs
function badgeTipHtml(b, lv) {
  return `<div class="bd-tip-head"><span class="bd-count ${tierClass(lv)}"><i></i>${BADGE_TIERS[lv - 1]}</span><b>${b.name}</b></div>
    <div class="bd-tip-desc">${b.desc}${b.single ? '' : `: <b>${b.tierText[lv - 1]}</b>`}</div>`;
}
let badgeTipEl = null, badgeTipFor = null;
function showBadgeTip(chip) {
  const b = BADGES.find(x => x.id === chip.dataset.badge); if (!b) return;
  if (!badgeTipEl) { badgeTipEl = document.createElement('div'); badgeTipEl.className = 'bd-tip'; badgeTipEl.setAttribute('role', 'tooltip'); document.body.appendChild(badgeTipEl); }
  badgeTipEl.innerHTML = badgeTipHtml(b, Number(chip.dataset.lv));
  badgeTipEl.hidden = false;
  if (badgeTipFor) badgeTipFor.setAttribute('aria-expanded', 'false');
  badgeTipFor = chip; chip.setAttribute('aria-expanded', 'true');
  // Below the chip, kept inside the screen; above it when there is no room below
  const r = chip.getBoundingClientRect(), w = Math.min(300, innerWidth - 24);
  badgeTipEl.style.width = w + 'px';
  const left = Math.max(12, Math.min(innerWidth - w - 12, r.left + r.width / 2 - w / 2));
  const h = badgeTipEl.offsetHeight, below = r.bottom + 8 + h < innerHeight - 70;
  badgeTipEl.style.left = left + scrollX + 'px';
  badgeTipEl.style.top = (below ? r.bottom + 8 : r.top - 8 - h) + scrollY + 'px';
}
function hideBadgeTip() { if (badgeTipEl) badgeTipEl.hidden = true; if (badgeTipFor) badgeTipFor.setAttribute('aria-expanded', 'false'); badgeTipFor = null; }
document.addEventListener('click', e => {
  const chip = e.target.closest('.bd-chip[data-badge]');
  if (chip) { if (badgeTipFor === chip && !matchMedia('(hover: hover)').matches) hideBadgeTip(); else showBadgeTip(chip); return; }
  if (!e.target.closest('.bd-tip')) hideBadgeTip();
});
document.addEventListener('mouseover', e => { if (!matchMedia('(hover: hover)').matches) return; const chip = e.target.closest('.bd-chip[data-badge]'); if (chip && chip !== badgeTipFor) showBadgeTip(chip); });
document.addEventListener('mouseout', e => { if (!matchMedia('(hover: hover)').matches) return; const chip = e.target.closest('.bd-chip[data-badge]'); if (chip && !chip.contains(e.relatedTarget)) hideBadgeTip(); });
document.addEventListener('keydown', e => { if (e.key === 'Escape') hideBadgeTip(); });
addEventListener('scroll', () => { if (badgeTipFor && !matchMedia('(hover: hover)').matches) return; hideBadgeTip(); }, { passive: true });
// Player page card: one button per level (icon and count); the card opens on the player's best level
function playerBadgesHtml(p) {
  const list = playerBadges(p); if (!list.length) return '';
  const lvs = [4, 3, 2, 1].filter(lv => list.some(x => x.lv === lv)), start = lvs[0];
  return `<div class="chart-card bd-card"><div class="card-head"><div class="chart-title">${icon('star')} Badges <span class="muted">${list.length}</span></div>
      <button class="card-link" onclick="showSection('badges')">All badges →</button></div>
    <div class="bd-counts" role="group" aria-label="Show badges by level">
      <button type="button" class="bd-count bd-all" data-lv="0" aria-pressed="false" onclick="badgeLevelFilter(this)">All ${list.length}</button>
      ${lvs.map(lv => `<button type="button" class="bd-count ${tierClass(lv)}${lv === start ? ' on' : ''}" data-lv="${lv}" aria-pressed="${lv === start}" aria-label="${BADGE_TIERS[lv - 1]}: ${list.filter(x => x.lv === lv).length}" title="${BADGE_TIERS[lv - 1]}" onclick="badgeLevelFilter(this)"><i></i>${list.filter(x => x.lv === lv).length}</button>`).join('')}</div>
    <div class="bd-chips">${list.map(x => `<span data-lv="${x.lv}"${x.lv === start ? '' : ' hidden'}>${badgeChip(x.b, x.lv)}</span>`).join('')}</div></div>`;
}
function badgeLevelFilter(btn) {
  const card = btn.closest('.bd-card'), lv = Number(btn.dataset.lv);
  card.querySelectorAll('.bd-counts button').forEach(b => { const on = b === btn; b.classList.toggle('on', on); b.setAttribute('aria-pressed', on); });
  hideBadgeTip();
  card.querySelectorAll('.bd-chips > [data-lv]').forEach(c => c.hidden = lv && Number(c.dataset.lv) !== lv);
}
// Badges page: every badge, its levels and how many players reach each
const badgeState = { group: '', open: null };
function renderBadges() {
  const H = badgeHolders(), el = document.getElementById('badgesContent'); if (!el) return;
  const groups = BADGE_GROUPS.filter(g => activeBadges().some(b => b.group === g));
  const shown = activeBadges().filter(b => !badgeState.group || b.group === badgeState.group);
  // Players with the most badges, weighted by level
  const top = everyPlayer().map(p => { const l = playerBadges(p); return { p, n: l.length, score: l.reduce((a, x) => a + x.lv, 0), leg: l.filter(x => x.lv === 4).length }; })
    .sort((a, b) => b.score - a.score || b.leg - a.leg).slice(0, 10);
  el.innerHTML = `<div class="player-grid"><div>
      <div class="seg bd-groups"><button class="${badgeState.group ? '' : 'active'}" onclick="badgeState.group='';renderBadges()">All ${activeBadges().length}</button>${groups.map(g => `<button class="${badgeState.group === g ? 'active' : ''}" onclick="badgeState.group='${g}';renderBadges()">${g}</button>`).join('')}</div>
      <div class="bd-list">${shown.map(b => { const h = H[b.id], total = h.reduce((a, x) => a + x.length, 0), open = badgeState.open === b.id;
        return `<div class="bd-row${open ? ' open' : ''}"><div class="bd-row-head" role="button" tabindex="0" onclick="badgeState.open=${open ? 'null' : `'${b.id}'`};renderBadges()">
          <div><b>${b.name}</b> <span class="muted bd-group">${b.group}</span><div class="muted bd-desc">${b.desc}</div></div><span class="bd-total">${total}</span></div>
          <div class="bd-levels">${[0, 1, 2, 3].filter(i => b.tierText[i]).map(i => `<span class="bd-level ${tierClass(i + 1)}"><i></i>${b.single ? BADGE_TIERS[i] : b.tierText[i]} <em>${h[i].length}</em></span>`).join('')}</div>
          ${open ? `<div class="bd-holders">${[3, 2, 1, 0].filter(i => h[i].length).map(i => `<div><span class="bd-count ${tierClass(i + 1)}"><i></i>${BADGE_TIERS[i]}</span> ${h[i].map(p => nameLink(p.Player)).join(', ')}</div>`).join('') || '<span class="muted">Nobody yet.</span>'}</div>` : ''}
        </div>`; }).join('')}</div></div>
    <div><div class="chart-card rb-card"><div class="chart-title">${icon('star')} Most Decorated</div>
      ${top.map((x, i) => `<div class="rb-row"><span class="rb-rank">${i + 1}</span><span class="rb-main">${nameLink(x.p.Player)}</span><span class="rb-val">${x.n}</span><span class="rb-sub">${x.leg} Legendary · level points ${x.score}</span></div>`).join('')}
      <p class="muted fx-note">Level points: Bronze 1, Silver 2, Gold 3, Legendary 4.</p></div></div></div>`;
}
