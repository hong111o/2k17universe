# Saved versions

Each file here is a complete earlier version of the dashboard that still opens on its own.
They share the saved workbook with the main app (same site), so there's nothing to reload.

Kept: two milestones (v20, v22) and the last 10 versions. Older ones (v23–v40) were removed from this folder;
they are still in the git history if ever needed.

| File | Version | Saved before |
|---|---|---|
| `v20.html` | v20: phone app, custom icon, locked table headers | player pages, compare v2, draft, legacy ranking, search, data check |
| `v22.html` | v22: player pages, compare v2, draft, simple legacy formula, search, data check | points-system legacy formula |
| `v88.html` | v88: badge box with player number and next level | badge box shows only the level and what it needs |
| `v89.html` | v89: simple badge box | Settings → Badges: switch badges on or off, rename them, change their levels |
| `v90.html` | v90: Settings → Badges | Legacy Formula and Badges as Settings sub pages with Save and Discard |
| `v91.html` | v91: Settings sub pages | Grand badges (no levels), 17 new badges switched off, Levels/Grand switch |
| `v92.html` | v92: Grand badges | new player page: team-colour header, journey, Home/Stats/Career/Honors tabs, main teams, one back button |
| `v93.html` | v93: new player page | active players: seasons/teams/Finals/stat titles row, #Active rank |
| `v94.html` | v94: active player header | eras: Face of an Era line, season era label, era badges, Trophy Shelf on Honors, newest decade first |
| `v95.html` | v95: eras on player and season pages, era badges, Trophy Shelf | badge sort, team eras, Compare and Home redesign, season header, balanced cards |
| `v96.html` | v96: badge sort, team eras, Compare and Home redesign, season header, balanced cards | player header: main team logo faded behind, no rainbow frame |
| `v97.html` | v97: player header with the main team's logo faded behind | main team picked by a points score (titles by role, awards, seasons), close calls tagged in Settings |

Online: https://hong111o.github.io/2k17universe/versions/v20.html and .../versions/v22.html


From v40 on the site is split into `index.html`, `css/` and `js/`. Backups stay single files: they are built with `python3 tools/bundle.py versions/vNN.html`.
