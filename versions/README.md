# Saved versions

Each file here is a complete earlier version of the dashboard that still opens on its own.
They share the saved workbook with the main app (same site), so there's nothing to reload.

Kept: two milestones (v20, v22) and the last 10 versions. Older ones (v23–v40) were removed from this folder;
they are still in the git history if ever needed.

| File | Version | Saved before |
|---|---|---|
| `v20.html` | v20: phone app, custom icon, locked table headers | player pages, compare v2, draft, legacy ranking, search, data check |
| `v22.html` | v22: player pages, compare v2, draft, simple legacy formula, search, data check | points-system legacy formula |
| `v56.html` | v56: ROTY table without Pick | "LeBron James Jr." read as Bronny James |
| `v57.html` | v57: "LeBron James Jr." = Bronny | Runner-Up Stars: roles and Finals-loss points in the legacy score |
| `v58.html` | v58: Runner-Up Stars in the legacy score | silver "Conference Title" trophy on player timelines |
| `v59.html` | v59: silver Conference Title on timelines | conference titles on Team Journey stops |
| `v60.html` | v60: conference titles on Team Journey | Top 20 / position check ignores retired-number order, clearer wording |
| `v61.html` | v61: retired numbers compared as a set | Data Check no longer lists names without a player row |
| `v62.html` | v62: no "not in All Players" notes | Legacy column and sort on every player list |
| `v63.html` | v63: Legacy column and sort on player lists | Finals page (head to head, upsets, matchups, rivalries), Finals card on player pages |
| `v64.html` | v64: Finals page, Finals card on player pages | upsets judged by star power (all listed stars), shown on each Finals card |
| `v65.html` | v65: upsets by star power | cleaner Finals card on player pages, closed by default |

Online: https://hong111o.github.io/2k17universe/versions/v20.html and .../versions/v22.html


From v40 on the site is split into `index.html`, `css/` and `js/`. Backups stay single files: they are built with `python3 tools/bundle.py versions/vNN.html`.
