# Saved versions

Each file here is a complete earlier version of the dashboard that still opens on its own.
They share the saved workbook with the main app (same site), so there's nothing to reload.

Kept: two milestones (v20, v22) and the last 10 versions. Older ones (v23–v38) were removed from this folder;
they are still in the git history if ever needed.

| File | Version | Saved before |
|---|---|---|
| `v20.html` | v20: phone app, custom icon, locked table headers | player pages, compare v2, draft, legacy ranking, search, data check |
| `v22.html` | v22: player pages, compare v2, draft, simple legacy formula, search, data check | points-system legacy formula |
| `v39.html` | v39: awards page, compare teams, player filters, title case, light/dark | code split into files, stat titles, missing players in Data Check |
| `v40.html` | v40: code split into files, stat titles, missing players in Data Check | All-NBA check skips seasons not in the sheet |
| `v41.html` | v41: All-NBA check skips seasons not in the sheet | sort direction on phones, filters on every player list |
| `v42.html` | v42: sort direction on phones, filters on player lists | High/Low fix, same filters and sort options on every player list, team sort direction |
| `v43.html` | v43: High/Low fix, shared filters, team sort direction | Stat Leaders split into one table per stat |
| `v44.html` | v44: Stat Leaders one table per stat | award winners' teams from NBA History logos |
| `v45.html` | v45: award winners' teams from NBA History logos | Awards table without notes, fits phones |
| `v46.html` | v46: Awards table fits phones | League History as cards on phones |
| `v47.html` | v47: League History cards on phones | Team History BC + Retired # tabs, All-NBA back to 1947 |
| `v48.html` | v48: Team History + Retired # tabs, All-NBA to 1947 | wins chart in 20-season blocks, years on Team Journey |

Online: https://hong111o.github.io/2k17universe/versions/v20.html and .../versions/v22.html


From v40 on the site is split into `index.html`, `css/` and `js/`. Backups stay single files: they are built with `python3 tools/bundle.py versions/vNN.html`.
