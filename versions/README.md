# Saved versions

Each file here is a complete earlier version of the dashboard that still opens on its own.
They share the saved workbook with the main app (same site), so there's nothing to reload.

Kept: two milestones (v20, v22) and the last 10 versions. Older ones (v23–v30) were removed from this folder;
they are still in the git history if ever needed.

| File | Version | Saved before |
|---|---|---|
| `v20.html` | v20: phone app, custom icon, locked table headers | player pages, compare v2, draft, legacy ranking, search, data check |
| `v22.html` | v22: player pages, compare v2, draft, simple legacy formula, search, data check | points-system legacy formula |
| `v31.html` | v31: team logos from the NBA Logo sheet | stricter logo labels, VAN/CIN codes |
| `v32.html` | v32: stricter logo labels, VAN/CIN codes | coloured timeline awards, draft nav fits on phones |
| `v33.html` | v33: coloured timeline awards, draft nav fits on phones | Finals MVP chip back to light gold |
| `v34.html` | v34: Finals MVP chip light gold | rookie awards in the timeline |
| `v35.html` | v35: rookie awards in the timeline | All-NBA tiers one blue |
| `v36.html` | v36: All-NBA tiers one blue | Finals rivalries and Started Here on team pages |
| `v37.html` | v37: Finals rivalries and Started Here | folding cards, best/worst merged, home trimmed |
| `v38.html` | v38: folding cards, best/worst merged, home trimmed | awards page, compare teams, player filters, title case, light/dark switch |
| `v39.html` | v39: awards page, compare teams, player filters, title case, light/dark | code split into files, stat titles, missing players in Data Check |
| `v40.html` | v40: code split into files, stat titles, missing players in Data Check | All-NBA check skips seasons not in the sheet |

Online: https://hong111o.github.io/2k17universe/versions/v20.html and .../versions/v22.html


From v40 on the site is split into `index.html`, `css/` and `js/`. Backups stay single files: they are built with `python3 tools/bundle.py versions/vNN.html`.
