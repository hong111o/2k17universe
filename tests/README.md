# Dashboard tests

Browser checks that load `index.html` with your workbook in Chromium (desktop and iPhone sizes)
and look for page errors, sideways scrolling and the expected numbers on each page.

```
cd tests && npm install          # once
./run-all.sh /path/to/2K17.xlsm  # every check; screenshots go to tests/out/
```

- The workbook is passed in each time and is **never** stored in the repo (the repo is public).
- `xlsx` is installed locally so the tests don't need the CDN.
- Each `test*.cjs` takes: `<folder with node_modules> <index.html path or URL> <workbook> <output folder>`.
