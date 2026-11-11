// Every page on the smallest phones: nothing runs off the screen or spills out of its card
const { chromium, devices } = require(process.argv[2] + '/node_modules/playwright');
(async () => { const b = await chromium.launch(); const errs=[]; const out=[];
  for (const dev of ['iPhone SE','iPhone 13']) { const p = await (await b.newContext({...devices[dev]})).newPage(); p.on('pageerror',e=>errs.push(e.message));
  await p.route(/cdnjs/, r => r.fulfill({ path: process.argv[2] + '/node_modules/xlsx/dist/xlsx.full.min.js', contentType: 'application/javascript' })); await p.route(/fonts\./, r => r.abort());
  await p.goto('file://' + process.argv[3]); await p.setInputFiles('#fileInput', process.argv[4]); await p.waitForSelector('#app', { state: 'visible', timeout: 200000 });
  const check = async (label, fn, arg) => { await p.evaluate(fn, arg); await p.waitForTimeout(350);
    await p.evaluate(()=>document.querySelectorAll('.fold.folded').forEach(c=>c.classList.remove('folded'))); await p.waitForTimeout(100);
    const r = await p.evaluate(()=>{ const W=innerWidth; const bad=[...document.querySelectorAll('.section.active *')].filter(e=>{const b=e.getBoundingClientRect(); if(!(b.width>0 && b.right>W+1)) return false; let a=e.parentElement; while(a){ const o=getComputedStyle(a).overflowX; if(o==='auto'||o==='scroll'||o==='hidden') return false; a=a.parentElement;} return true;}).slice(0,3).map(e=>(e.className||e.tagName)+': '+e.textContent.trim().slice(0,40)); // Also text spilling out of its own box (card, tile, chip)
      const boxes=[...document.querySelectorAll('.section.active .chart-card, .section.active .stat-card, .section.active .hero-award, .section.active .pcard, .section.active .fx-card, .section.active .hcard, .section.active .journey-stop, .section.active .decade-chip')];
      const spill=boxes.filter(bx=>{ const r=bx.getBoundingClientRect(); if(!r.width) return false; return [...bx.querySelectorAll('*')].some(e=>{ const b=e.getBoundingClientRect(); if(!b.width) return false; let a=e.parentElement; while(a && a!==bx){ const o=getComputedStyle(a).overflowX; if(o==='auto'||o==='scroll'||o==='hidden') return false; a=a.parentElement;} return b.right>r.right+1; }); }).slice(0,3).map(bx=>(bx.className)+': '+bx.textContent.trim().replace(/\s+/g,' ').slice(0,50));
      return { doc: document.documentElement.scrollWidth-W, bad, spill }; });
    if (r.doc>0 || r.bad.length || r.spill.length) out.push(dev+' | '+label+' | '+JSON.stringify(r)); };
  for (const s of ['overview','players','top20','bypos','current','draft','legacy','teams','history','finals','awards','statleaders','allnba','decades','records','leaders']) await check(s, s=>showSection(s), s);
  await check('season 2073', y=>openSeason(y), 2073);
  for (const n of ['Giannis Antetokounmpo','Magic Johnson','LeBron James','Kareem Abdul-Jabbar','Liam Antetokounmpo']) await check('player '+n, n=>openPlayerModal(n), n);
  for (const t of ['Oklahoma City Thunder','Portland Trail Blazers','Los Angeles Lakers','Minnesota Timberwolves']) await check('team '+t, t=>openTeamModal(t), t);
  }
  console.log(JSON.stringify({ problems: out, errors: errs }, null, 1)); await b.close(); if (out.length) process.exit(1); })();
