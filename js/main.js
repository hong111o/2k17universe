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
