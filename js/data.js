// 2K17 NBA Stats Database · Data store, loading the workbook (file picker, saved copy) and reading every sheet.
// Loaded in order by index.html; all files share one global scope.

// =====================================================================
// DATA STORE
// =====================================================================
let DB = {
  allPlayers: [], top20: [], positions: {PG:[],SG:[],SF:[],PF:[],C:[]},
  teams: [], history: [], statLeaders: [], currentPlayers: [],
  allNbaSeasons: [], decades: [], awardRecords: [], allTimeStats: []
};

// =====================================================================
// FILE LOADING
// =====================================================================
const dropZone = document.getElementById('dropZone');
const fileInput = document.getElementById('fileInput');
const progressMsg = document.getElementById('progressMsg');
const errorMsg = document.getElementById('errorMsg');

dropZone.addEventListener('dragover', e => { e.preventDefault(); dropZone.classList.add('drag-over'); });
dropZone.addEventListener('dragleave', () => dropZone.classList.remove('drag-over'));
dropZone.addEventListener('drop', e => { e.preventDefault(); dropZone.classList.remove('drag-over'); handleFile(e.dataTransfer.files[0]); });
fileInput.addEventListener('change', e => handleFile(e.target.files[0]));
dropZone.addEventListener('click', e => { if (!e.target.closest('label')) fileInput.click(); });

let dataLoaded = false;
function showLoadOverlay() {
  document.getElementById('loadOverlay').style.display = 'flex';
  document.getElementById('app').style.display = 'none';
  errorMsg.style.display = 'none';
  renderSavedInfo();
}
function hideLoadOverlay() {
  document.getElementById('loadOverlay').style.display = 'none';
  document.getElementById('app').style.display = 'block';
}

function setProgress(msg) { progressMsg.textContent = msg; }
function showError(msg) {
  errorMsg.textContent = msg;
  errorMsg.style.display = 'block';
  setProgress('');
}

function handleFile(file) {
  if (!file) return;
  errorMsg.style.display = 'none';
  const ext = file.name.split('.').pop().toLowerCase();
  if (!['xlsm','xlsx','xls'].includes(ext)) {
    showError('Please drop an Excel file (.xlsm, .xlsx, or .xls)');
    return;
  }
  setProgress('Reading file...');
  const reader = new FileReader();
  reader.onload = e => {
    if (loadWorkbookData(e.target.result, file.name)) saveWorkbook(file.name, e.target.result);
  };
  reader.readAsArrayBuffer(file);
}

// Parses the workbook and shows the dashboard; returns false if the file couldn't be read
function loadWorkbookData(buf, fileName, savedAt) {
  try {
    setProgress('Parsing Excel data...');
    const wb = XLSX.read(new Uint8Array(buf), { type: 'array', cellDates: true, bookFiles: true });
    setProgress('Processing sheets...');
    parseWorkbook(wb);
  } catch(err) {
    showError('Error reading file: ' + err.message);
    console.error(err);
    return false;
  }
  setProgress('Building dashboard...');
  loadInfo = { name: fileName, at: savedAt || Date.now() };
  // Logos are shrunk to icon size first (a few hundred ms), then the dashboard is drawn
  setProgress('Preparing team logos...');
  setTimeout(() => shrinkLogos().catch(() => {}).then(() => {
    initDashboard();
    dataLoaded = true;
    const when = new Date(savedAt || Date.now()).toLocaleString([], {dateStyle:'medium', timeStyle:'short'});
    document.getElementById('dataInfo').textContent = `${fileName} · ${when}`;
    hideLoadOverlay();
    setProgress('');
  }), 50);
  return true;
}

// =====================================================================
// SAVED WORKBOOK (IndexedDB, stays on this device)
// =====================================================================
function openStore() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open('nba2k17-dashboard', 1);
    req.onupgradeneeded = () => req.result.createObjectStore('files');
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}
function storeRequest(mode, fn) {
  return openStore().then(db => new Promise((resolve, reject) => {
    const req = fn(db.transaction('files', mode).objectStore('files'));
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  }));
}
// Storage can be unavailable (private window, blocked site data): the dashboard still works, it just won't remember
function saveWorkbook(name, buf) {
  return storeRequest('readwrite', st => st.put({ name, buf, savedAt: Date.now() }, 'last'))
    .catch(err => console.warn('Could not save workbook for next time:', err));
}
function getSavedWorkbook() {
  return storeRequest('readonly', st => st.get('last')).catch(() => null);
}
function forgetSavedWorkbook() {
  storeRequest('readwrite', st => st.delete('last')).catch(() => {}).then(renderSavedInfo);
}
function renderSavedInfo() {
  const el = document.getElementById('savedInfo');
  getSavedWorkbook().then(saved => {
    if (!saved) { el.innerHTML = ''; return; }
    const when = new Date(saved.savedAt).toLocaleString([], {dateStyle:'medium', timeStyle:'short'});
    el.innerHTML = `Saved on this device: <strong>${saved.name}</strong> (${when})
      ${dataLoaded ? '<button class="link-btn" onclick="hideLoadOverlay()">Back to dashboard</button>' : ''}
      <button class="link-btn" onclick="forgetSavedWorkbook()">Forget saved file</button>`;
  });
}


// =====================================================================
// EXCEL PARSING
// =====================================================================
function safeText(v) { return v.replace(/</g, '‹').replace(/>/g, '›').replace(/"/g, '”').replace(/&(?![a-z]+;|#\d+;)/gi, '&amp;'); }
function sheetToArr(ws) {
  const ref = ws['!ref'];
  if (!ref) return [];
  const range = XLSX.utils.decode_range(ref);
  // Excel sometimes reports a sheet as a million rows tall (formatting down to the bottom);
  // stop at the last row that actually holds a value
  if (range.e.r - range.s.r > 5000) {
    let last = range.s.r;
    for (const k in ws) { if (k[0] === '!') continue; const cell = ws[k]; if (cell && cell.v !== undefined && cell.v !== null && cell.v !== '') { const r = XLSX.utils.decode_cell(k).r; if (r > last) last = r; } }
    range.e.r = last;
  }
  const rows = [];
  for (let r = range.s.r; r <= range.e.r; r++) {
    const row = [];
    for (let c = range.s.c; c <= range.e.c; c++) {
      const cell = ws[XLSX.utils.encode_cell({r, c})];
      // Workbook text is shown as HTML everywhere, so angle brackets and stray
      // quotes are swapped for look-alikes here and can never break the page
      row.push(cell ? (typeof cell.v === 'string' ? safeText(cell.v) : cell.v) : null);
    }
    rows.push(row);
  }
  return rows;
}

// Rows become objects keyed by header; _row keeps the Excel row number and the
// array's .headers keeps column order (Data Check uses both to name cells)
function rowsToObjects(rows) {
  if (!rows || rows.length < 2) return [];
  const headers = rows[0].map((h, i) => h !== null && h !== undefined ? String(h) : `col_${i}`);
  const out = rows.slice(1)
    .map((r, i) => [r, i + 2])
    .filter(([r]) => r.some(v => v !== null && v !== undefined))
    .map(([r, excelRow]) => {
      const obj = { _row: excelRow };
      headers.forEach((h, i) => { obj[h] = (r[i] !== undefined && r[i] !== null) ? r[i] : null; });
      return obj;
    });
  out.headers = headers;
  return out;
}

// Red text in a team cell means the player won a title with that team.
// SheetJS doesn't expose font colors, so this reads styles.xml and the sheet
// XML from the workbook's raw files. Returns { sheetName: Set of red cell refs }.
function redCellsBySheet(wb) {
  const out = {};
  try {
    const files = wb.files || {}, dec = new TextDecoder();
    const text = k => { const f = files[k] || files['/' + k]; const c = f && f.content; return !c ? '' : typeof c === 'string' ? c : dec.decode(c); };
    const attr = (tag, name) => { const m = tag.match(new RegExp('\\b' + name + '="([^"]*)"')); return m ? m[1] : null; };
    const styles = text('xl/styles.xml'); if (!styles) return out;
    const fontsXml = (styles.match(/<fonts\b[^>]*>([\s\S]*?)<\/fonts>/) || [])[1] || '';
    const redFont = (fontsXml.match(/<font\b[^>]*?(?:\/>|>[\s\S]*?<\/font>)/g) || []).map(f => {
      const c = (f.match(/<color\b[^>]*>/) || [])[0]; if (!c) return false;
      const rgb = attr(c, 'rgb'), idx = attr(c, 'indexed');
      if (rgb && rgb.length >= 6) { const h = rgb.slice(-6), r = parseInt(h.slice(0, 2), 16), g = parseInt(h.slice(2, 4), 16), b = parseInt(h.slice(4, 6), 16); return r >= 0xC0 && g <= 0x50 && b <= 0x50; }
      return idx === '2' || idx === '10';
    });
    const xfsXml = (styles.match(/<cellXfs\b[^>]*>([\s\S]*?)<\/cellXfs>/) || [])[1] || '';
    const redXf = (xfsXml.match(/<xf\b[^>]*>/g) || []).map(x => !!redFont[Number(attr(x, 'fontId') || 0)]);
    if (!redXf.some(Boolean)) return out;
    const rels = {};
    (text('xl/_rels/workbook.xml.rels').match(/<Relationship\b[^>]*>/g) || []).forEach(r => { rels[attr(r, 'Id')] = attr(r, 'Target'); });
    (text('xl/workbook.xml').match(/<sheet\b[^>]*>/g) || []).forEach(sh => {
      const name = (attr(sh, 'name') || '').replace(/&amp;/g, '&').replace(/&apos;/g, "'").replace(/&quot;/g, '"');
      let target = rels[attr(sh, 'r:id')]; if (!target) return;
      target = target.startsWith('/') ? target.slice(1) : 'xl/' + target.replace(/^\.\//, '');
      const set = new Set();
      (text(target).match(/<c\b[^>]*>/g) || []).forEach(c => { const st = attr(c, 's'); if (st && redXf[Number(st)]) set.add(attr(c, 'r')); });
      out[name] = set;
    });
  } catch (err) { console.warn('Could not read cell colors:', err); }
  return out;
}
// Team logos come from the pictures on the "NBA Logo" sheet. A picture is matched
// to a team by a team name or code typed in a cell just below or beside it; without
// one, by its spot in the sheet's grid (the layout the workbook already uses).
const LOGO_SLOTS = {
  '0,3': 'Atlanta Hawks', '0,6': 'Boston Celtics', '0,9': 'Brooklyn Nets', '0,12': 'Charlotte Hornets', '0,15': 'Chicago Bulls',
  '0,18': 'Cleveland Cavaliers', '0,21': 'Dallas Mavericks', '0,24': 'Denver Nuggets', '0,27': 'Detroit Pistons', '0,30': 'Golden State Warriors',
  '2,3': 'Houston Rockets', '2,6': 'Indiana Pacers', '2,9': 'Los Angeles Clippers', '2,12': 'Los Angeles Lakers', '2,15': 'Memphis Grizzlies',
  '2,18': 'Miami Heat', '2,21': 'Milwaukee Bucks', '2,24': 'Minnesota Timberwolves', '2,27': 'New Orleans Pelicans', '2,30': 'New York Knicks',
  '4,3': 'Oklahoma City Thunder', '4,6': 'Orlando Magic', '4,9': 'Philadelphia 76ers', '4,12': 'Phoenix Suns', '4,15': 'Portland Trail Blazers',
  '4,18': 'Sacramento Kings', '4,21': 'San Antonio Spurs', '4,24': 'Toronto Raptors', '4,27': 'Utah Jazz', '4,30': 'Washington Wizards',
  '6,3': 'Kansas City Knights', '6,6': 'San Diego Surf', '6,9': 'Vancouver Ravens', '6,12': 'Cincinnati Lions',
};
let logoUrls = [], logoMediaTeam = {};
function readTeamLogos(wb) {
  logoUrls.forEach(u => URL.revokeObjectURL(u)); logoUrls = []; logoMediaTeam = {};
  const logos = {};
  try {
    const files = wb.files || {}, dec = new TextDecoder();
    const raw = k => { const f = files[k] || files['/' + k]; return f && f.content; };
    const text = k => { const c = raw(k); return !c ? '' : typeof c === 'string' ? c : dec.decode(c); };
    const attr = (tag, name) => { const m = tag.match(new RegExp('\\b' + name + '="([^"]*)"')); return m ? m[1] : null; };
    const relsOf = path => { const out = {}; const dir = path.replace(/[^/]*$/, ''), base = path.slice(dir.length);
      (text(dir + '_rels/' + base + '.rels').match(/<Relationship\b[^>]*>/g) || []).forEach(r => { out[attr(r, 'Id')] = resolvePath(dir, attr(r, 'Target')); }); return out; };
    const resolvePath = (dir, target) => {
      if (!target) return '';
      if (target.startsWith('/')) return target.slice(1);
      const parts = (dir + target).split('/'), out = [];
      parts.forEach(p => { if (p === '..') out.pop(); else if (p && p !== '.') out.push(p); });
      return out.join('/');
    };
    const sheetName = wb.SheetNames.find(n => /logo/i.test(n));
    if (!sheetName) return logos;
    const wbRels = relsOf('xl/workbook.xml');
    const sh = (text('xl/workbook.xml').match(/<sheet\b[^>]*>/g) || []).find(t => (attr(t, 'name') || '').replace(/&amp;/g, '&') === sheetName);
    const sheetPath = sh && wbRels[attr(sh, 'r:id')];
    if (!sheetPath) return logos;
    const drawingPath = Object.values(relsOf(sheetPath)).find(t => /drawings\/[^/]+\.xml$/.test(t));
    if (!drawingPath) return logos;
    const media = relsOf(drawingPath), ws = wb.Sheets[sheetName];
    // A team name or code typed in the cell right under the picture, or right beside it,
    // wins over the grid position
    const labelAt = (c, r, toC, toR) => {
      for (const [lc, lr] of [[c, toR + 1], [toC + 1, r], [toC + 1, toR]]) {
        const cell = ws && ws[XLSX.utils.encode_cell({ c: lc, r: lr })];
        const v = cell && cell.v != null ? String(cell.v).trim() : '';
        if (!v) continue;
        const full = TEAM_NAMES[v.toUpperCase()] || DB.teams.find(t => normName(t.Team) === normName(v))?.Team;
        if (full) return full;
      }
      return null;
    };
    (text(drawingPath).match(/<xdr:(?:twoCellAnchor|oneCellAnchor|absoluteAnchor)\b[\s\S]*?<\/xdr:(?:twoCellAnchor|oneCellAnchor|absoluteAnchor)>/g) || []).forEach(a => {
      const from = a.match(/<xdr:from>[\s\S]*?<xdr:col>(\d+)<\/xdr:col>[\s\S]*?<xdr:row>(\d+)<\/xdr:row>/), emb = a.match(/r:embed="([^"]+)"/);
      if (!from || !emb) return;
      const to = a.match(/<xdr:to>[\s\S]*?<xdr:col>(\d+)<\/xdr:col>[\s\S]*?<xdr:row>(\d+)<\/xdr:row>/);
      const c = Number(from[1]), r = Number(from[2]), toC = to ? Number(to[1]) : c, toR = to ? Number(to[2]) : r;
      const team = labelAt(c, r, toC, toR) || LOGO_SLOTS[c + ',' + r];
      const path = media[emb[1]], bytes = path && raw(path);
      if (team && path && !logoMediaTeam[path]) logoMediaTeam[path] = team;   // other sheets reuse these image files
      if (!team || !bytes || logos[team]) return;
      const ext = (path.split('.').pop() || '').toLowerCase();
      const type = { png: 'image/png', gif: 'image/gif', jpg: 'image/jpeg', jpeg: 'image/jpeg', webp: 'image/webp', svg: 'image/svg+xml' }[ext] || 'image/png';
      const url = URL.createObjectURL(new Blob([bytes], { type }));
      logoUrls.push(url);
      logos[team] = url;
    });
    // Team Record may spell a name differently ("Indaina Pacers"): point close matches at the same logo
    DB.teams.forEach(t => {
      if (logos[t.Team]) return;
      const near = Object.keys(logos).find(k => editDistance(normName(k), normName(t.Team)) <= 2);
      if (near) logos[t.Team] = logos[near];
    });
  } catch (err) { console.warn('Could not read team logos:', err); }
  return logos;
}
// NBA History has a small team logo beside each MVP, Finals MVP and DPOY (columns B, E and G).
// Those pictures reuse the NBA Logo sheet's image files, so each one tells us the winner's team.
function readAwardTeams(wb) {
  const out = {};
  try {
    const files = wb.files || {}, dec = new TextDecoder();
    const text = k => { const f = files[k] || files['/' + k], c = f && f.content; return !c ? '' : typeof c === 'string' ? c : dec.decode(c); };
    const attr = (tag, name) => { const m = tag.match(new RegExp('\\b' + name + '="([^"]*)"')); return m ? m[1] : null; };
    const resolve = (dir, target) => { if (!target) return ''; if (target.startsWith('/')) return target.slice(1);
      const out2 = []; (dir + target).split('/').forEach(p => { if (p === '..') out2.pop(); else if (p && p !== '.') out2.push(p); }); return out2.join('/'); };
    const relsOf = path => { const o = {}, dir = path.replace(/[^/]*$/, ''), base = path.slice(dir.length);
      (text(dir + '_rels/' + base + '.rels').match(/<Relationship\b[^>]*>/g) || []).forEach(r => { o[attr(r, 'Id')] = resolve(dir, attr(r, 'Target')); }); return o; };
    const sh = (text('xl/workbook.xml').match(/<sheet\b[^>]*>/g) || []).find(t => (attr(t, 'name') || '').replace(/&amp;/g, '&') === 'NBA History');
    const sheetPath = sh && relsOf('xl/workbook.xml')[attr(sh, 'r:id')];
    const drawingPath = sheetPath && Object.values(relsOf(sheetPath)).find(t => /drawings\/[^/]+\.xml$/.test(t));
    if (!drawingPath || !DB.historyCols) return out;
    const media = relsOf(drawingPath), cols = DB.historyCols;
    const byRow = new Map(DB.history.map(h => [h._row, h]));
    (text(drawingPath).match(/<xdr:(?:twoCellAnchor|oneCellAnchor)\b[\s\S]*?<\/xdr:(?:twoCellAnchor|oneCellAnchor)>/g) || []).forEach(a => {
      const from = a.match(/<xdr:from>[\s\S]*?<xdr:col>(\d+)<\/xdr:col>[\s\S]*?<xdr:row>(\d+)<\/xdr:row>/), emb = a.match(/r:embed="([^"]+)"/);
      if (!from || !emb) return;
      const c = Number(from[1]), h = byRow.get(Number(from[2]) + 1), team = logoMediaTeam[media[emb[1]]];
      if (!h || !team) return;
      // The logo belongs to the award column right beside it
      const kind = Object.entries(cols).map(([k, col]) => [k, Math.abs(col - c)]).sort((x, y) => x[1] - y[1])[0];
      if (kind && kind[1] <= 1 && h[kind[0]] && h[kind[0]] !== '-') h[kind[0] + 'Team'] = team;
    });
  } catch (err) { console.warn('Could not read award teams:', err); }
  // A logo picture that isn't on the NBA Logo sheet can't be recognised; a one-team career still tells us
  (DB.history || []).forEach(h => ['MVP', 'FMVP', 'DPOY'].forEach(k => {
    if (!h[k] || h[k] === '-' || h[k + 'Team']) return;
    const p = resolvePlayer(h[k], h.Season), teams = p ? [...new Set(playerTeams(p))] : [];
    if (teams.length === 1) h[k + 'Team'] = teams[0];
  }));
  return out;
}
// ---------------------------------------------------------------------
// TEAM HISTORY (1946-47 onward, one row per team per season) and RETIRED NUMBERS
// Each history row is added to its franchise's seasonRecords, so team pages, standings,
// records and the wins chart cover every season. A row keeps its own conference,
// games played, Finals result and playoff note. Defunct teams become small teams of
// their own (flagged defunct, left out of the Franchises list).
// ---------------------------------------------------------------------
const findSheet = (wb, re) => wb.SheetNames.find(n => re.test(n));
// Today's franchise for a team code; close spellings in Team Record ("Indaina Pacers") still match
function teamByCode(code) {
  const full = fullTeamName(code);
  return DB.teams.find(t => t.Team === full) || DB.teams.find(t => !t.defunct && editDistance(normName(t.Team), normName(full)) <= 2) || null;
}
function readTeamHistory(wb) {
  DB.teamHistoryRows = [];
  const name = findSheet(wb, /team (history|seasons)/i);
  if (!name) return;
  const rows = sheetToArr(wb.Sheets[name]), col = headerFinder(name, rows[0] || []);
  const c = { yr: col('Season', 0), fr: col('Franchise', 2), team: col('Team', 3), tname: col('Team Name', 4), conf: col('Conference', 5),
    w: col('W', 7), l: col('L', 8), finals: col('Finals', 13), po: col('Playoffs', 14) };
  rows.slice(1).forEach((r, i) => {
    const yr = Number(r[c.yr]), fr = String(r[c.fr] ?? '').trim().toUpperCase(), w = Number(r[c.w]), l = Number(r[c.l]);
    if (!yr || !fr || isNaN(w) || isNaN(l)) return;
    const label = String(r[c.tname] ?? '').trim() || fr;
    DB.teamHistoryRows.push({ _row: i + 2, yr, fr, team: String(r[c.team] ?? '').trim(), label, conf: String(r[c.conf] ?? '').trim().toUpperCase(), w, l,
      finals: String(r[c.finals] ?? '').trim(), playoffs: String(r[c.po] ?? '').trim() });
  });
  const defunct = {};
  DB.teamHistoryRows.forEach(h => {
    let t = teamByCode(h.fr);
    if (!t) {
      // A defunct team: name it after itself and register its code so Finals rows can find it
      if (!TEAM_NAMES[h.fr]) TEAM_NAMES[h.fr] = h.label;
      t = defunct[h.fr] || (defunct[h.fr] = { Team: TEAM_NAMES[h.fr], Conference: h.conf, defunct: true, seasonRecords: {}, Championship: 0 });
    }
    if (t.seasonRecords[h.yr]) return;   // Team Record wins when both have a season
    const g = h.w + h.l, po = h.playoffs.toLowerCase();
    t.seasonRecords[h.yr] = { w: h.w, l: h.l, rawW: g ? h.w / g * 82 + 1e-6 * h.w : 0, hist: true, label: h.label !== t.Team ? h.label : '',
      conf: h.conf, finals: h.finals, playoffs: !po ? null : /^(n|no|missed|-)$/.test(po) ? false : true, playoffNote: h.playoffs };
  });
  Object.values(defunct).forEach(t => { t.Championship = Object.values(t.seasonRecords).filter(r => /champ/i.test(r.finals)).length; DB.teams.push(t); });
}
function readRetiredList(wb) {
  DB.retiredList = [];
  const name = findSheet(wb, /^retired/i);
  if (!name) return;
  const rows = sheetToArr(wb.Sheets[name]), col = headerFinder(name, rows[0] || []);
  const c = { team: col('Team', 0), num: col('Number', 2), who: col('Honoree', 3), type: col('Type', 4), status: col('Status', 5), years: col('Years with Franchise', 6) };
  rows.slice(1).forEach((r, i) => {
    const who = String(r[c.who] ?? '').trim(), code = String(r[c.team] ?? '').trim().toUpperCase();
    if (!who || !code) return;
    DB.retiredList.push({ _row: i + 2, code, num: String(r[c.num] ?? '').trim(), who, type: String(r[c.type] ?? 'Player').trim() || 'Player',
      status: String(r[c.status] ?? '').trim(), years: String(r[c.years] ?? '').trim() });
  });
}
// Short code for a full team name (Washington Wizards -> WAS), for compact tables
function teamCode(full) { return Object.keys(TEAM_NAMES).find(k => TEAM_NAMES[k] === full && k.length === 3) || Object.keys(TEAM_NAMES).find(k => TEAM_NAMES[k] === full) || full; }
// The sheet's logos are up to ~900px; drawing them once at 160px keeps memory low on phones
async function shrinkLogos(size = 160) {
  if (!DB.logos || typeof createImageBitmap !== 'function') return;
  const done = {};
  for (const [team, url] of Object.entries(DB.logos)) {
    if (done[url]) { DB.logos[team] = done[url]; continue; }
    try {
      const blob = await (await fetch(url)).blob();
      const bmp = await createImageBitmap(blob);
      const k = Math.min(1, size / Math.max(bmp.width, bmp.height));
      if (k >= 1) { done[url] = url; bmp.close?.(); continue; }
      const c = document.createElement('canvas');
      c.width = Math.round(bmp.width * k); c.height = Math.round(bmp.height * k);
      const g = c.getContext('2d'); g.imageSmoothingQuality = 'high'; g.drawImage(bmp, 0, 0, c.width, c.height); bmp.close?.();
      const small = await new Promise(res => c.toBlob(res, 'image/png'));
      if (!small) { done[url] = url; continue; }
      const su = URL.createObjectURL(small);
      logoUrls.push(su); URL.revokeObjectURL(url);
      done[url] = DB.logos[team] = su;
    } catch (e) { done[url] = url; }
  }
}
function teamLogo(team, cls) {
  const u = DB.logos && (DB.logos[fullTeamName(team)] || DB.logos[team]);
  return u ? `<img class="tlogo${cls ? ' ' + cls : ''}" src="${u}" alt="" aria-hidden="true" decoding="async">` : '';
}
// Flags which of a player's team stints are in red (aligned with playerTeams)
function markTitleStints(players, ws, red) {
  if (!red || !red.size || !ws || !ws['!ref'] || !players.headers) return;
  const start = XLSX.utils.decode_range(ws['!ref']).s.c;
  players.forEach(p => {
    const stints = [];
    for (let i = 1; i <= 11; i++) {
      const k = i === 1 ? 'Team' : 'Team' + i, col = players.headers.indexOf(k);
      if (col >= 0 && p[k]) stints.push(red.has(XLSX.utils.encode_col(start + col) + p._row));
    }
    p._titleStints = stints;
  });
  DB.hasTitleColors = true;
}

// Find a column by its header text (case and spacing ignored); falls back to the usual
// position and records a Data Check warning when the header is missing
let layoutWarnings = [];
function layoutWarn(sheet, msg) { layoutWarnings.push({ sheet, msg }); }
function headerFinder(sheet, headers) {
  const norm = v => String(v ?? '').toLowerCase().replace(/[^a-z0-9]/g, '');
  const H = headers.map(norm);
  return (name, fallback) => {
    const i = H.indexOf(norm(name));
    if (i >= 0) return i;
    layoutWarn(sheet, `Couldn't find the "${name}" header; reading column ${XLSX.utils.encode_col(fallback)} instead. Check the header row if numbers look wrong.`);
    return fallback;
  };
}
const TEAM_RECORD_COLS = [['Rank', 0], ['Team', 1], ['Conference', 2], ['Championship', 3], ['Conference Titles', 4], ['Division Titles', 5], ['Playoffs', 6],
  ['Glory Score', 7], ['Last Title', 8], ['Last Finals', 9], ['Last Playoffs', 10], ['Est. Date', 11], ['Avg. W Last 5Y', 12], ['Avg. W Last 10Y', 13]];
function parseWorkbook(wb) {
  layoutWarnings = [];
  DB.historyCols = null;
  setProgress('Loading All Players...');
  const apSheet = wb.Sheets['All Players'] ? 'All Players' : wb.SheetNames[0];
  DB.allPlayers = rowsToObjects(sheetToArr(wb.Sheets[apSheet]));
  DB.hasTitleColors = false;
  const redCells = redCellsBySheet(wb);
  markTitleStints(DB.allPlayers, wb.Sheets[apSheet], redCells[apSheet]);

  setProgress('Loading Positional rankings...');
  ['PG','SG','SF','PF','C'].forEach(pos => {
    if (wb.Sheets[pos]) DB.positions[pos] = rowsToObjects(sheetToArr(wb.Sheets[pos]));
  });

  setProgress('Loading Top 20...');
  if (wb.Sheets['Top 20']) DB.top20 = rowsToObjects(sheetToArr(wb.Sheets['Top 20']));

  setProgress('Loading History...');
  if (wb.Sheets['NBA History']) {
    const rows = sheetToArr(wb.Sheets['NBA History']);
    // Columns are found by their header, so inserting or moving a column in Excel is safe
    const H = rows[0] || [], col = headerFinder('NBA History', H);
    const cSeason = col('Season', 0), cMVP = col('MVP', 2), cFMVP = col('FMVP', 3), cFinals = col('Finals', 5), cDPOY = col('DPOY', 7);
    // "Champion Stars (Rating)" sits over three columns; use the ones that hold "Name (99)" values
    const hStars = H.findIndex(h => /champion stars/i.test(String(h || '')));
    let starCols = [9, 10, 11];
    if (hStars >= 0) {
      const looksStar = c => rows.slice(1, 40).some(r => /\(\d+\)\s*$/.test(String(r[c] ?? '')));
      const near = [hStars - 1, hStars, hStars + 1, hStars + 2, hStars + 3].filter(c => c >= 0 && looksStar(c));
      if (near.length) starCols = near.slice(0, 3);
    } else layoutWarn('NBA History', 'Couldn\'t find the "Champion Stars" header; reading columns J–L.');
    DB.history = rows.slice(1)
      .filter(r => r[cSeason] !== null && r[cSeason] !== undefined)
      .map(r => ({
        _row: rows.indexOf(r) + 1,
        Season: r[cSeason], MVP: r[cMVP], FMVP: r[cFMVP], Finals: r[cFinals], DPOY: r[cDPOY],
        Star1: r[starCols[0]], Star2: r[starCols[1]], Star3: r[starCols[2]]
      }));
    DB.historyCols = { MVP: cMVP, FMVP: cFMVP, DPOY: cDPOY };
  }

  setProgress('Loading Teams...');
  if (wb.Sheets['Team Record']) {
    const rows = sheetToArr(wb.Sheets['Team Record']);
    const headers = rows[0];
    // Season columns: numeric headers > 2000 (years like 2051, 2052 ... 2076)
    const seasonCols = [];
    headers.forEach((h, i) => {
      if (h !== null && h !== undefined) {
        const num = typeof h === 'number' ? h : parseFloat(h);
        if (!isNaN(num) && num > 2000 && num < 3000) seasonCols.push({idx: i, year: Math.round(num)});
      }
    });
    // Team rows have a numeric rank in col 0; notes below the table don't
    DB.teamSeasonCols = seasonCols;
    const trFind = headerFinder('Team Record', headers);
    const trCols = TEAM_RECORD_COLS.map(([k, fallback]) => trFind(k, fallback));
    DB.teams = rows.slice(1)
      .filter(r => typeof r[trCols[0]] === 'number' && r[trCols[1]] !== null && r[trCols[1]] !== undefined)
      .map(r => {
        const t = { _row: rows.indexOf(r) + 1, seasonRecords: {} };
        TEAM_RECORD_COLS.forEach(([k, fallback], i) => { t[k] = r[trCols[i] ?? fallback]; });
        seasonCols.forEach(sc => {
          const raw = r[sc.idx];
          if (raw !== null && raw !== undefined) {
            // Some values have .01 added as a tiebreaker indicator - floor to get real wins
            const rawNum = parseFloat(raw);
            const w = Math.floor(rawNum);
            if (!isNaN(w) && w >= 0) {
              t.seasonRecords[sc.year] = { w, l: 82 - w, rawW: rawNum };
            }
          }
        });
        return t;
      });
  }

  setProgress('Loading team logos...');
  DB.logos = readTeamLogos(wb);
  readAwardTeams(wb);

  setProgress('Loading team history...');
  readTeamHistory(wb);
  readRetiredList(wb);

  setProgress('Loading Stat Leaders...');
  if (wb.Sheets['Season Stat Leader']) {
    const rows = sheetToArr(wb.Sheets['Season Stat Leader']);
    // Each stat block is "Team, Leader, PPG": find the stat header, the two before it are leader and team
    const col = headerFinder('Season Stat Leader', rows[0] || []), cS = col('Season', 0);
    const blocks = [['Pts', 'PPG', 3], ['Reb', 'RPG', 6], ['Ast', 'APG', 9], ['Stl', 'SPG', 12], ['Blk', 'BPG', 15], ['Min', 'MPG', 18]].map(([k, unit, fb]) => [k, unit, col(unit, fb)]);
    DB.statLeaders = rows.slice(1)
      .filter(r => r[cS] !== null && r[cS] !== undefined)
      .map(r => {
        const o = { Season: r[cS] };
        blocks.forEach(([k, unit, c]) => { o[k + 'Team'] = r[c - 2]; o[k + 'Leader'] = r[c - 1]; o[unit] = r[c]; });
        return o;
      });
  }

  setProgress('Loading Current Players...');
  if (wb.Sheets['Current Player']) {
    const cpRows = sheetToArr(wb.Sheets['Current Player']);
    // Player rows have a position in col 0; notes below the table don't
    const cpHeaders = cpRows[0].map((h,i) => h !== null && h !== undefined ? String(h) : `col_${i}`);
    DB.currentPlayers = cpRows.slice(1)
      .map((r, i) => Object.assign(r, { _excelRow: i + 2 }))
      .filter(r => POSITIONS.includes(r[0]) && r[1] !== null && r[1] !== undefined)
      .map(r => {
        const obj = { _row: r._excelRow };
        cpHeaders.forEach((h, i) => { obj[h] = (r[i] !== undefined && r[i] !== null) ? r[i] : null; });
        return obj;
      });
    DB.currentPlayers.headers = cpHeaders;
    markTitleStints(DB.currentPlayers, wb.Sheets['Current Player'], redCells['Current Player']);
  }

  setProgress('Loading All-NBA Teams...');
  if (wb.Sheets['All NBA Team']) {
    DB.allNbaSeasons = parseAllNbaTeams(sheetToArr(wb.Sheets['All NBA Team']));
  }

  setProgress('Loading Decade Teams...');
  if (wb.Sheets['Decade NBA Team']) {
    DB.decades = parseDecades(sheetToArr(wb.Sheets['Decade NBA Team']));
  }

  setProgress('Loading All-Time Records...');
  if (wb.Sheets['NBA All-Time Record']) {
    parseAllTimeRecords(sheetToArr(wb.Sheets['NBA All-Time Record']));
  }

  playerIndex = null; // rebuilt from the new data on first lookup
  engineCache = {};
  standingsCache = {};
  seasonState.yr = null;
  DB.latestSeason = latestSeasonOf(DB.history);
  document.getElementById('seasonBadge').textContent = DB.latestSeason ? `SEASON ${seasonLabel(DB.latestSeason)}` : 'NO SEASON DATA';
}

const POSITIONS = ['PG','SG','SF','PF','C'];
// Highest season number in the history sheet, regardless of row order
function latestSeasonOf(history) {
  const yrs = history.map(h => Number(h.Season)).filter(y => !isNaN(y));
  return yrs.length ? Math.max(...yrs) : null;
}
// A season is named by the year it ends in: 2078 -> "2077–78"
function seasonLabel(yr) {
  const y = Number(yr);
  return isNaN(y) ? String(yr) : `${y - 1}–${String(y).slice(-2)}`;
}

function parseAllNbaTeams(rows) {
  const seasons = [];
  const POSITIONS = ['G','G','F','F','C'];
  // Each season is a block: a row with the season year, a row of positions (G G F F C),
  // then the 1st, 2nd and 3rd teams. Two blocks sit side by side (year in D or L).
  // Blocks are found by their year heading, so any season (1947 on) and any spacing works.
  const isYear = v => typeof v === 'number' && v > 1940 && v < 2200;
  for (let i = 0; i < rows.length; i++) {
    const r0 = rows[i];
    if (!r0) continue;
    [[3, [0,1,2,3,4,5]], [11, [8,9,10,11,12,13]]].forEach(([yearCol, dataCols]) => {
      const yr = r0[yearCol];
      if (!isYear(yr)) return;
      // The positions row (G G F F C) is optional: All-NBA teams had no positions before 1955-56
      const next = rows[i + 1] || [];
      const hasPos = dataCols.slice(1).some(c => /^[GFC]$/i.test(String(next[c] ?? '').trim()));
      const first = i + (hasPos ? 2 : 1);
      if (Number((rows[first] || [])[dataCols[0]]) !== 1) return;   // the 1st Team row must follow
      const teams = [];
      for (let ti = 0; ti < 3; ti++) {
        const dataRow = rows[first + ti];
        if (!dataRow || Number(dataRow[dataCols[0]]) !== ti + 1) continue;
        const slots = [];
        for (let pi = 1; pi <= 5; pi++) {
          const playerName = dataRow[dataCols[pi]];
          if (playerName) slots.push({ pos: hasPos ? String(next[dataCols[pi]] || POSITIONS[pi-1]).trim().toUpperCase() : '', player: String(playerName) });
        }
        if (slots.length > 0) teams.push({ team: ti + 1, slots });
      }
      if (teams.length > 0 && !seasons.some(x => x.season === yr)) seasons.push({ season: yr, teams });
    });
  }
  return seasons.sort((a, b) => b.season - a.season);
}

function parseDecades(rows) {
  const decades = [];
  let current = null;
  rows.forEach(r => {
    if (!r || r.every(v => v === null)) { current = null; return; }
    // Detect era header: col3 or col4 contains era name
    const eraName = r[4];
    const decadeName = r[3];
    if (typeof decadeName === 'string' && decadeName.includes('Era') && !r[0]) {
      current = {
        decade: decadeName, era: eraName || '', positions: ['G','G','F','F','C'],
        starter: [], subs: [], info: {}
      };
      decades.push(current);
      return;
    }
    if (!current) return;
    // Starter row
    if (r[0] === 'Starter') {
      current.starter = [r[1],r[2],r[3],r[4],r[5]].filter(v => v !== null && v !== undefined);
      return;
    }
    // Subs row
    if (r[0] === 'Subs') {
      current.subs = [r[1],r[2],r[3],r[4],r[5]].filter(v => v !== null && v !== undefined);
      return;
    }
    // More subs (continuation row - no label, just player names in cols 1-5)
    if (r[0] === null && (r[1] !== null || r[2] !== null) && current.starter.length > 0) {
      const moreSubs = [r[1],r[2],r[3],r[4],r[5]].filter(v => v !== null && v !== undefined && typeof v === 'string');
      if (moreSubs.length > 0) current.subs.push(...moreSubs);
    }
    // Info rows: col7 = label, col8 = value1, col9 = value2
    if (r[7]) {
      const label = String(r[7]).toLowerCase().replace(/\s+/g,'_');
      const val1 = r[8] ? String(r[8]) : '';
      const val2 = r[9] ? String(r[9]) : '';
      if (label.includes('franchise') || label.includes('best_franchise')) {
        current.info.franchise1 = val1 || null;
        current.info.franchise2 = val2 || null;
      } else if (label.includes('mvp')) {
        current.info.mvpList = [val1, val2].filter(Boolean);
      } else if (label.includes('doty') || label.includes('dpoy')) {
        current.info.dotyList = [val1, val2].filter(Boolean);
      }
    }
  });
  return decades.reverse();
}

function parseAllTimeRecords(rows) {
  // AWARD RECORDS - 4 columns (rows 1-20): MVP, Champions, FMVP, DOTY
  const awardDefs = [
    {name:'MVP',       pCol:1, vCol:2},
    {name:'Champions', pCol:5, vCol:6},
    {name:'FMVP',      pCol:9, vCol:10},
    {name:'DOTY',      pCol:13,vCol:14},
  ];
  DB.awardRecords = awardDefs.map(d => ({name: d.name, entries: []}));

  // STAT RECORDS - 4 blocks of rows
  // Block 2 (header row2=23): PTS(0-2), REB(4-6), AST(8-10), STL(12-14)
  // Block 3 (header row3=46): BLK(0-2), DD2(4-6), TD3(8-10), TO(12-14)
  // Block 4 (header row4=69): FGM(0-2), 3PM(4-6), FTM(8-10), MIN(12-14)
  // Block 5 (header row5=92): GP(0-2) only
  const statDefs = [
    {name:'PTS', pCol:1, vCol:2}, {name:'REB', pCol:5, vCol:6}, {name:'AST', pCol:9,  vCol:10}, {name:'STL', pCol:13,vCol:14},
    {name:'BLK', pCol:1, vCol:2}, {name:'DD2', pCol:5, vCol:6}, {name:'TD3', pCol:9,  vCol:10}, {name:'TO',  pCol:13,vCol:14},
    {name:'FGM', pCol:1, vCol:2}, {name:'3PM', pCol:5, vCol:6}, {name:'FTM', pCol:9,  vCol:10}, {name:'MIN', pCol:13,vCol:14},
    {name:'GP',  pCol:1, vCol:2},
  ];
  DB.allTimeStats = statDefs.map(d => ({name: d.name, entries: []}));

  // Determine which block each row belongs to by tracking header rows
  let section = 'awards'; // 'awards', 'block2', 'block3', 'block4', 'block5'
  let blockIdx = -1; // index into 4-wide or 1-wide defs per block

  const blockHeaders = {
    'PTS': {section:'block2', startIdx:0},
    'BLK': {section:'block3', startIdx:4},
    'FGM': {section:'block4', startIdx:8},
    'GP':  {section:'block5', startIdx:12},
  };

  rows.forEach(r => {
    if (!r || r.every(v => v === null || v === undefined)) return;
    const c0 = r[0], c2 = r[2];

    // Check for block header rows
    if (c0 === 'Rank' && (c2 === 'PTS' || c2 === 'BLK' || c2 === 'FGM' || c2 === 'GP')) {
      const bh = blockHeaders[c2];
      section = bh.section;
      blockIdx = bh.startIdx;
      return;
    }
    if (c0 === 'Rank' && c2 === 'MVP') { section = 'awards'; return; }

    if (section === 'awards') {
      awardDefs.forEach((d, ci) => {
        const player = r[d.pCol], val = r[d.vCol];
        if (player && val !== null && val !== undefined) {
          DB.awardRecords[ci].entries.push({rank: r[d.pCol-1], player: String(player), value: String(val)});
        }
      });
    } else if (section === 'block5') {
      // GP only - single column
      const player = r[1], val = r[2];
      if (player && val !== null && val !== undefined) {
        DB.allTimeStats[12].entries.push({rank: r[0], player: String(player), value: numFmt(val)});
      }
    } else {
      // 4-column stat block
      const cols = [{pCol:1,vCol:2},{pCol:5,vCol:6},{pCol:9,vCol:10},{pCol:13,vCol:14}];
      cols.forEach((dc, ci) => {
        const idx = blockIdx + ci;
        if (idx >= DB.allTimeStats.length) return;
        const player = r[dc.pCol], val = r[dc.vCol];
        if (player && val !== null && val !== undefined) {
          DB.allTimeStats[idx].entries.push({rank: r[dc.pCol-1], player: String(player), value: numFmt(val)});
        }
      });
    }
  });
}
