# Saved versions

Each file here is a complete earlier version of the dashboard that still opens on its own.
They share the saved workbook with the main app (same site), so there's nothing to reload.

Kept: two milestones (v20, v22) and the last 10 versions. Older ones (v23–v40) were removed from this folder;
they are still in the git history if ever needed.

| File | Version | Saved before |
|---|---|---|
| `v20.html` | v20: phone app, custom icon, locked table headers | player pages, compare v2, draft, legacy ranking, search, data check |
| `v22.html` | v22: player pages, compare v2, draft, simple legacy formula, search, data check | points-system legacy formula |
| `v64.html` | v64: Finals page, Finals card on player pages | upsets judged by star power (all listed stars), shown on each Finals card |
| `v65.html` | v65: upsets by star power | cleaner Finals card on player pages, closed by default |
| `v66.html` | v66: cleaner Finals card, closed by default | all opposing stars named in the Finals card |
| `v67.html` | v67: all opposing stars named | names never split across two lines |
| `v68.html` | v68: names never split | Home award boxes, standings, draft list and wins chart fit small phones again |
| `v69.html` | v69: names fit their boxes on phones | Most Improved team on Home and Season Hub |
| `v70.html` | v70: Most Improved team | Turnarounds and Heartbreak records, team Trophy Cabinet, Ring of Honor |
| `v71.html` | v71: Turnarounds, Heartbreak, Trophy Cabinet, Ring of Honor | Trophy Cabinet without titles, Finals and Finals MVPs |
| `v72.html` | v72: Trophy Cabinet individual awards only | Ring of Honor tiles without notes, two per row on phones, honored by 3+ teams |
| `v73.html` | v73: Ring of Honor tiles | team season card, Franchise Stats, Fingerprint, Closest Match, theme button, NBA logos |

Online: https://hong111o.github.io/2k17universe/versions/v20.html and .../versions/v22.html


From v40 on the site is split into `index.html`, `css/` and `js/`. Backups stay single files: they are built with `python3 tools/bundle.py versions/vNN.html`.
