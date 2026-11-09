# Saved versions

Each file here is a complete earlier version of the dashboard that still opens on its own.
They share the saved workbook with the main app (same site), so there's nothing to reload.

Kept: two milestones (v20, v22) and the last 10 versions. Older ones (v23–v40) were removed from this folder;
they are still in the git history if ever needed.

| File | Version | Saved before |
|---|---|---|
| `v20.html` | v20: phone app, custom icon, locked table headers | player pages, compare v2, draft, legacy ranking, search, data check |
| `v22.html` | v22: player pages, compare v2, draft, simple legacy formula, search, data check | points-system legacy formula |
| `v50.html` | v50: "-" = stat not tracked | typo-tolerant names (Geogre), more Team Journey years |
| `v51.html` | v51: retired-number years fill Team Journey gaps | Retired # matched by years (Connie ≠ Corie Hawkins), years-vs-career check |
| `v52.html` | v52: Retired # matched by years, years-vs-career check | Rookie of the Year from NBA History in League History, Awards, Home and Season Hub |
| `v53.html` | v53: Rookie of the Year from NBA History | app checks for new files on every open |
| `v54.html` | v54: app checks for new files on every open | ROTY table shows the overall draft pick instead of Win |
| `v55.html` | v55: ROTY table with overall draft pick | Pick column removed (most rookies have no draft code) |
| `v56.html` | v56: ROTY table without Pick | "LeBron James Jr." read as Bronny James |
| `v57.html` | v57: "LeBron James Jr." = Bronny | Runner-Up Stars: roles and Finals-loss points in the legacy score |
| `v58.html` | v58: Runner-Up Stars in the legacy score | silver "Conference Title" trophy on player timelines |
| `v59.html` | v59: silver Conference Title on timelines | conference titles on Team Journey stops |

Online: https://hong111o.github.io/2k17universe/versions/v20.html and .../versions/v22.html


From v40 on the site is split into `index.html`, `css/` and `js/`. Backups stay single files: they are built with `python3 tools/bundle.py versions/vNN.html`.
