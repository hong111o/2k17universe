// 2K17 NBA Stats Database · Draws every page after a workbook loads, then reopens the saved workbook on startup.
// Loaded in order by index.html; all files share one global scope.

// =====================================================================
// INIT DASHBOARD
// =====================================================================
function initDashboard() {
  initOverview();
  populatePlayerFilters();
  filterPlayers();
  setupToolbarToggles();
  populateTeamCompare();
  if (!sortStates.top20) sortStates.top20 = {col:'Rank',dir:1};
  filterTop20();
  initPos();
  filterTeams();
  filterHistory();
  filterStat();
  filterCurrent();
  filterAllNba();
  initDecades();
  renderRecords();
  try { updateRecap(); } catch (e) { console.warn('Could not build the update recap:', e); }
  renderHome();
  updateDataCheckDot();
  // Season list is rebuilt from the new file next time standings are opened
  document.getElementById('standingsSeason').innerHTML = '';
  if (document.getElementById('standingsView').style.display !== 'none') initStandings();
  restoreSection();
}

// =====================================================================
// STARTUP: runs last, once every script above has loaded
// =====================================================================
// On startup, reopen the last workbook so it doesn't need dropping again
getSavedWorkbook().then(saved => {
  if (saved && saved.buf) {
    setProgress(`Opening saved ${saved.name}...`);
    if (!loadWorkbookData(saved.buf, saved.name, saved.savedAt)) renderSavedInfo();
  } else {
    renderSavedInfo();
  }
});

// Big award names (Home hero, Season Hub tiles) stay on one line: shrink the text until it fits
function fitNames() {
  // Standings: a name that still doesn't fit (narrowest phones) shows the nickname, full name on hover
  document.querySelectorAll('td.st-team').forEach(td => {
    if (!td.offsetWidth || td.scrollWidth <= td.clientWidth + 1) return;
    const link = td.querySelector('.team-link'), text = link && [...link.childNodes].reverse().find(n => n.nodeType === 3 && n.textContent.trim());
    if (text) { link.title = link.title || text.textContent.trim(); text.textContent = shortTeam(text.textContent.trim()); }
  });
  document.querySelectorAll('.ha-name, .value-name, .cmp-name').forEach(el => {
    if (!el.offsetWidth) return;
    el.style.fontSize = '';
    let size = parseFloat(getComputedStyle(el).fontSize);
    el.classList.remove('fit-wrap');
    const min = el.classList.contains('cmp-name') ? 10 : 14;
    while (el.scrollWidth > el.clientWidth + 1 && size > min) { size -= 1; el.style.fontSize = size + 'px'; }
    // Still too long at the smallest size: wrap between words rather than cut the name off
    if (el.scrollWidth > el.clientWidth + 1) el.classList.add('fit-wrap');
  });
}
let fitFrame = 0;
const fitSoon = () => { cancelAnimationFrame(fitFrame); fitFrame = requestAnimationFrame(fitNames); };
new MutationObserver(fitSoon).observe(document.body, { childList: true, subtree: true });
window.addEventListener('resize', fitSoon);
if (document.fonts) { document.fonts.ready.then(fitSoon); document.fonts.addEventListener('loadingdone', fitSoon); }

syncThemeButton();
matchMedia('(prefers-color-scheme: dark)').addEventListener('change', syncThemeButton);
