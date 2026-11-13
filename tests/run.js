/* Redline end-to-end tests. Usage: node tests/run.js [screenshot-dir]
   Starts its own static server, drives the app in a phone-sized Chromium with a fake camera.
   Needs Playwright with Chromium (require('playwright')). */
const http=require('http'),fs=require('fs'),path=require('path'),os=require('os');
const {chromium,devices}=require('playwright');
const ROOT=path.join(__dirname,'..'),OUT=process.argv[2]||path.join(__dirname,'shots');
fs.mkdirSync(OUT,{recursive:true});
const TYPES={'.html':'text/html','.js':'text/javascript','.css':'text/css','.png':'image/png','.woff2':'font/woff2','.webmanifest':'application/manifest+json'};
const server=http.createServer((q,r)=>{
  let p=decodeURIComponent(q.url.split('?')[0]);if(p.endsWith('/'))p+='index.html';
  const f=path.join(ROOT,p);if(!f.startsWith(ROOT)||!fs.existsSync(f)){r.writeHead(404);r.end();return}
  r.writeHead(200,{'content-type':TYPES[path.extname(f)]||'application/octet-stream'});fs.createReadStream(f).pipe(r);
});
const res=[];let fails=0;
const ok=(n,c,x)=>{if(!c)fails++;res.push((c?'PASS ':'FAIL ')+n+(x!==undefined&&x!==''?' — '+x:''));if(!c)console.log('FAIL',n,x||'')};
const pad=n=>String(n).padStart(2,'0'),dk=d=>d.getFullYear()+'-'+pad(d.getMonth()+1)+'-'+pad(d.getDate());
const fmtd=k=>{const p=k.split('-');return new Date(+p[0],+p[1]-1,+p[2]).toLocaleDateString('en-US',{month:'short',day:'numeric'})};

/* an old (v1.3.1-shaped) save: 200 days of history, body weights, 3 months of photos, none of the newer fields */
async function seedOld(p){
  return p.evaluate(async()=>{
    const pad=n=>String(n).padStart(2,'0'),dk=d=>d.getFullYear()+'-'+pad(d.getMonth()+1)+'-'+pad(d.getDate());
    const s=JSON.parse(localStorage.getItem('redline.v1'));
    ['checks','title','ckSnooze','seenLv','oldSets','goal','look','excuses','lastBk','seenTro','goalsHit','dripped'].forEach(k=>delete s[k]);
    s.name='Leo';s.log={};s.body={};s.notes={'bench press':'Seat 4, elbows in'};
    const t=new Date();let sets=0;
    for(let i=200;i>=1;i--){
      const d=new Date(t.getFullYear(),t.getMonth(),t.getDate()-i),pl=s.plan[d.getDay()];
      if(i<=30)s.body[dk(d)]={bw:(190-0.2*(30-i)).toFixed(1)};
      if(d.getDay()===0||i%9===0)continue;
      const l={d:{},w:{},t:{},dl:0};
      pl.ex.forEach((e,j)=>{l.d[e.id]='1'.repeat(e.sets);sets+=e.sets;const k=e.name.toLowerCase();l.w[k]=String(50+j*10+Math.floor((200-i)/14)*5);l.t[k]=1;s.names[k]=e.name});
      if(i%4===0)l.pump=5;
      l.st=new Date(d.getFullYear(),d.getMonth(),d.getDate(),i%20===0?5:18,0).getTime();l.la=l.st+60*60000;l.en=l.la;
      s.log[dk(d)]=l;
    }
    s.block={start:dk(new Date(t.getFullYear(),t.getMonth(),t.getDate()-20))};
    localStorage.setItem('redline.v1',JSON.stringify(s));
    const mkBlob=(col,txt)=>new Promise(r=>{const cv=document.createElement('canvas');cv.width=600;cv.height=800;const x=cv.getContext('2d');x.fillStyle=col;x.fillRect(0,0,600,800);x.fillStyle='#fff';x.font='48px sans-serif';x.fillText(txt,40,400);cv.toBlob(r,'image/jpeg',.8)});
    const db=await new Promise((res,rej)=>{const r=indexedDB.open('redline-photos',1);r.onupgradeneeded=()=>r.result.createObjectStore('photos',{keyPath:'k'});r.onsuccess=()=>res(r.result);r.onerror=rej});
    for(const mo of [3,2,1]){
      const d=dk(new Date(t.getFullYear(),t.getMonth()-mo,5));
      for(const pose of ['front','side','back']){
        const blob=await mkBlob(['#333','#553','#355'][mo-1],pose+' '+d);
        await new Promise(res=>{const tx=db.transaction('photos','readwrite');tx.objectStore('photos').put({k:d+'|'+pose,date:d,pose:pose,blob:blob,w:600,h:800,ts:Date.now()});tx.oncomplete=res});
      }
    }
    db.close();
    return {sets:sets,days:Object.keys(s.log).length};
  });
}
const state=p=>p.evaluate(()=>JSON.parse(localStorage.getItem('redline.v1')));
const photoCount=p=>p.evaluate(()=>new Promise(res=>{const r=indexedDB.open('redline-photos',1);r.onupgradeneeded=()=>r.result.createObjectStore('photos',{keyPath:'k'});r.onsuccess=()=>{const q=r.result.transaction('photos').objectStore('photos').count();q.onsuccess=()=>{r.result.close();res(q.result)}}}));
const overflow=p=>p.evaluate(()=>({page:document.documentElement.scrollWidth>window.innerWidth+1,seg:[...document.querySelectorAll('.seg button')].some(x=>x.scrollWidth>x.clientWidth+1)}));
const go=async(p,v,s)=>{await p.click('.seg [data-v="'+v+'"]');if(s)await p.click('.subnav [data-s="'+s+'"]')};
const SUBFIT={prog:1,lock:1,char:1};
const shot=(p,n,full)=>p.screenshot({path:path.join(OUT,n+'.png'),fullPage:!!full});

(async()=>{
  await new Promise(r=>server.listen(0,r));const url='http://localhost:'+server.address().port+'/';
  const b=await chromium.launch({args:['--use-fake-device-for-media-stream','--use-fake-ui-for-media-stream']});
  const mk=async(dev)=>{const c=await b.newContext({...devices[dev||'iPhone 13'],permissions:['camera'],acceptDownloads:true});const p=await c.newPage();const errs=[];p.on('pageerror',e=>errs.push(String(e)));p.on('console',m=>{if(m.type()==='error')errs.push(m.text())});return {c,p,errs}};

  /* ---------- 1. fresh install ---------- */
  let {c,p,errs}=await mk();
  await p.goto(url);await p.waitForSelector('.seg');
  ok('fresh: loads with no JS errors',errs.length===0,errs.join('|'));
  ok('fresh: version is 1.5.0',/v1\.5\.0/.test(await p.textContent('#status')));
  const segs=await p.$$eval('.seg button',e=>e.map(x=>x.textContent));
  ok('fresh: five tabs unchanged',segs.join(',')==='Workout,Progress,Locked in,Check-in,Character',segs.join(','));
  await p.click('.set');ok('fresh: ticking a set counts',/1 of/.test(await p.textContent('#pc')));
  await p.click('[data-act="tstop"]').catch(()=>{});
  for(const [v,s] of [['prog','lifts'],['prog','str'],['prog','body'],['prog','cal'],['lock','week'],['lock','tro'],['lock','court'],['char','char'],['char','locker']]){await go(p,v,s);}
  ok('fresh: every new screen renders on an empty phone',errs.length===0,errs.join('|'));
  await go(p,'char','locker');
  ok('fresh: level-gated outfits are locked at level 1',await p.locator('[data-k="outfit"][data-v="hoodie"]').isDisabled()&&!(await p.locator('[data-k="outfit"][data-v="bare"]').isDisabled()));
  ok('fresh: gold is locked behind trophies',await p.locator('[data-k="top"][data-v="gold"]').isDisabled());
  /* camera check-in still works */
  await go(p,'phys');await p.click('[data-act="camstart"]');
  await p.waitForFunction(()=>{const v=document.getElementById('cam-v');return v&&v.videoWidth>0},null,{timeout:15000});
  await p.click('[data-act="camtimer"][data-n="0"]');
  for(let i=0;i<3;i++){await p.click('#cam-s');await p.waitForSelector('#cam-rv',{state:'visible'});await p.click('#cam-keep')}
  await p.waitForFunction(()=>!document.getElementById('cam').classList.contains('on'));await p.waitForSelector('.thumb img');
  ok('fresh: 3-pose camera check-in saves',await p.locator('.thumb img').count()===3&&(await p.textContent('.mo-st'))==='Done');
  ok('fresh: no JS errors overall',errs.length===0,errs.join('|'));
  await c.close();

  /* ---------- 2. old save survives the upgrade ---------- */
  ({c,p,errs}=await mk());
  await p.goto(url);await p.waitForSelector('.seg');
  const seed=await seedOld(p);
  await p.reload();await p.waitForSelector('.seg');await p.waitForTimeout(600);
  let st=await state(p);
  ok('upgrade: old save loads with no JS errors',errs.length===0,errs.join('|'));
  ok('upgrade: all '+seed.days+' logged days kept',Object.keys(st.log).length===seed.days);
  ok('upgrade: name kept',st.name==='Leo');
  ok('upgrade: all 9 photos kept',await photoCount(p)===9);
  ok('upgrade: 3 photo months back-filled',Object.keys(st.checks).length===3);
  await go(p,'char','char');
  const xp=seed.sets+75,lvExp=1+Math.floor(Math.sqrt(xp/30));
  ok('upgrade: level '+lvExp+' matches '+seed.sets+' lifetime sets + 3 check-ins',+(await p.textContent('.av-lv b'))===lvExp,await p.textContent('.av-lv b'));
  ok('upgrade: lifetime sets shown exactly',(await p.textContent('.av-card')).includes(seed.sets+' lifetime sets'));
  const svg0=await p.locator('.ch-svg').first().innerHTML();
  ok('upgrade: character keeps its v1.4 look (red tank, chalk body, name on chest)',svg0.includes('fill="#e3171f"')&&svg0.includes('fill="#ededed"')&&(await p.textContent('#ch-nm'))==='LEO'&&!svg0.includes('rx="24.5"'));
  ok('upgrade: Character tab still has name box, gear, titles, both muscle lists',await p.locator('#nm-in').count()===1&&await p.locator('.gear').count()===1&&await p.locator('.ti-list').count()===1&&await p.locator('.mus').count()===2);
  await shot(p,'01-character-unchanged');
  await go(p,'work');await shot(p,'02-workout');

  /* ---------- 3. strength ---------- */
  await go(p,'prog','lifts');
  ok('lifts: chart still there, plus an estimated max card',await p.locator('.chart-card svg').count()===1&&/Estimated 1-rep max/.test(await p.textContent('#list')));
  await go(p,'prog','str');
  const rows=await p.$$eval('#list .ex',e=>e.map(x=>({n:x.querySelector('.ex-name').textContent,v:+x.querySelector('.ex-target').textContent,sub:x.querySelector('.swapped').textContent})));
  const bench=rows.find(r=>r.n==='Bench press');
  const m=bench&&/From ([\d.]+) × (\d+)/.exec(bench.sub);
  ok('strength: Bench press estimate follows Epley at the top of its 6-8 range',!!m&&+m[2]===8&&bench.v===Math.round(+m[1]*(1+8/30)),bench&&bench.v+' from '+bench.sub);
  ok('strength: lifts sorted strongest first',rows.every((r,i)=>i===0||rows[i-1].v>=r.v));
  ok('strength: milestone bars and next targets shown',await p.locator('#list .mb.big').count()===rows.length&&/Next: \d+/.test(await p.textContent('#list')));
  await shot(p,'03-strength',true);

  /* ---------- 4. body weight goal ---------- */
  await go(p,'prog','body');
  ok('goal: chart draws from old body-weight entries',await p.locator('.chart-card svg').count()===1&&(await p.textContent('#goal-eta'))==='No goal set');
  await p.fill('#goal-in','180');await p.locator('#goal-in').blur();
  const y=new Date();const lastD=new Date(y.getFullYear(),y.getMonth(),y.getDate()-1);
  const eta=new Date(lastD.getFullYear(),lastD.getMonth(),lastD.getDate()+21);
  const etaTxt=await p.textContent('#goal-eta');
  ok('goal: 184.2 lb falling 1.4 lb/week reaches 180 in 21 days',etaTxt===fmtd(dk(eta))+', '+eta.getFullYear(),etaTxt);
  ok('goal: rate shown as -1.4 lb/week',(await p.locator('.chart-card .stat b').nth(1).textContent())==='-1.4');
  await shot(p,'04-body-goal',true);
  await p.fill('#goal-in','195');await p.locator('#goal-in').blur();
  ok('goal: a goal in the wrong direction is called out',(await p.textContent('#goal-eta'))==='Wrong way');
  await p.fill('#goal-in','180');await p.locator('#goal-in').blur();
  await p.fill('#bw-in','179.5');await p.locator('#bw-in').blur();
  st=await state(p);
  ok('goal: crossing the goal marks it reached, once',(await p.textContent('#goal-eta'))==='Goal reached'&&st.goalsHit===1);
  await p.fill('#bw-in','179');await p.locator('#bw-in').blur();
  ok('goal: reaching it again does not double count',(await state(p)).goalsHit===1);
  await p.fill('#bw-in','');await p.locator('#bw-in').blur();

  /* ---------- 5. calendar + report card ---------- */
  await go(p,'prog','cal');
  ok('calendar: 26 weeks of cells',await p.locator('.heat-g .hc').count()===182);
  const done=await p.locator('.heat-g .hc.l4').count(),off=await p.locator('.heat-g .hc.off').count();
  ok('calendar: finished days and off days are marked',done>100&&off>=25,done+' done, '+off+' off');
  await p.locator('.heat-g .hc.l4').last().click();
  ok('calendar: tapping a day shows what happened',/of \d+ sets/.test(await p.textContent('#cal-day')));
  ok('calendar: hit rate and gap stats shown',/\d+%/.test(await p.locator('#list .stats .stat b').nth(1).textContent()));
  const grade=await p.textContent('#rep-grade');
  ok('report card: this month gets a grade',/^(A\+|A|B|C|D|F)$/.test(grade),grade);
  await shot(p,'05-calendar',true);
  await p.click('[data-act="repnav"][data-n="-1"]');ok('report card: previous month works',/^(A\+|A|B|C|D|F)$/.test(await p.textContent('#rep-grade')));
  await p.click('[data-act="calnav"][data-n="1"]');ok('calendar: earlier page works',await p.locator('.heat-g .hc').count()===182);

  /* ---------- 6. trophies ---------- */
  await go(p,'lock','tro');
  const tn=await p.textContent('#tro-n'),got=await p.locator('.tro.ok').count(),all=await p.locator('.tro').count();
  ok('trophies: '+got+' of '+all+' earned from the old history',got>=12&&all>=35&&tn.startsWith(String(got)));
  ok('trophies: Dawn Goblin earned from a 5 a.m. session',await p.locator('.tro.ok[data-id="dawn"]').count()===1);
  ok('trophies: Scale Negotiator earned by the goal above',await p.locator('.tro.ok[data-id="goal"]').count()===1);
  ok('trophies: locked ones show progress',await p.locator('.tro:not(.ok) .mb').count()===all-got);
  ok('trophies: new ones flagged on first visit',await p.locator('.tro.new').count()===got);
  await shot(p,'06-trophies',true);
  await go(p,'lock','week');await go(p,'lock','tro');
  ok('trophies: flag clears on the next visit',await p.locator('.tro.new').count()===0);

  /* ---------- 7. excuse court ---------- */
  await go(p,'lock','court');
  const open0=+(await p.textContent('#court-open'));
  ok('court: missed days from the last 4 weeks are on the docket',open0>=2&&await p.locator('.exc-sel').count()===open0,String(open0));
  await p.locator('.exc-sel').first().selectOption('5');
  ok('court: "leg day" is overruled',/Contempt of court/.test(await p.textContent('#list'))&&+(await p.textContent('#court-open'))===open0-1);
  await p.locator('.exc-sel').first().selectOption('1');
  st=await state(p);ok('court: excuses are saved',Object.keys(st.excuses).length===2);
  await shot(p,'07-excuse-court',true);
  await p.locator('[data-act="excx"]').first().click();
  ok('court: an excuse can be withdrawn',Object.keys((await state(p)).excuses).length===1);

  /* ---------- 8. share image cards ---------- */
  const cardOk=async(name)=>{
    await p.waitForSelector('#share-img');await p.waitForFunction(()=>{const i=document.getElementById('share-img');return i.complete&&i.naturalWidth>0});
    const d=await p.evaluate(async()=>{const i=document.getElementById('share-img');const b=await (await fetch(i.src)).blob();const a=new Uint8Array(await b.arrayBuffer());let s='';for(let k=0;k<a.length;k++)s+=String.fromCharCode(a[k]);return {w:i.naturalWidth,h:i.naturalHeight,type:b.type,b64:btoa(s)}});
    fs.writeFileSync(path.join(OUT,name+'.png'),Buffer.from(d.b64,'base64'));
    return d.w===1080&&d.h===1350&&d.type==='image/png'&&d.b64.length>40000;
  };
  await go(p,'lock','week');await p.click('[data-act="lkshare"]');
  ok('share: week card is a 1080x1350 PNG',await cardOk('card-week'));
  const dl=p.waitForEvent('download');await p.click('[data-act="sharego"]');
  ok('share: image can be saved',/redline-week-.*\.png/.test((await dl).suggestedFilename()));
  await p.click('[data-act="shx"]');
  await go(p,'char','char');await p.click('[data-act="chshare"]');
  ok('share: character card is a 1080x1350 PNG',await cardOk('card-character'));await p.click('[data-act="shx"]');
  await go(p,'prog','cal');await p.click('[data-act="share"][data-k="month"]');
  ok('share: report card is a 1080x1350 PNG',await cardOk('card-report'));
  await shot(p,'08-share-sheet');await p.click('[data-act="shx"]');

  /* ---------- 9. locker ---------- */
  await go(p,'char','locker');
  ok('locker: outfits unlocked at this level',!(await p.locator('[data-k="outfit"][data-v="hoodie"]').isDisabled()));
  await p.click('[data-k="outfit"][data-v="hoodie"]');await p.click('[data-k="top"][data-v="black"]');await p.click('[data-k="skin"][data-v="bronze"]');await p.click('[data-k="accent"][data-v="white"]');
  let svg=await p.locator('.ch-svg').innerHTML();
  ok('locker: hoodie, black top and bronze finish are drawn',svg.includes('rx="24.5"')&&svg.includes('fill="#b07a4f"')&&!svg.includes('fill="#ededed"'));
  await shot(p,'09-locker',true);
  await p.reload();await go(p,'char','char');
  svg=await p.locator('.ch-svg').innerHTML();st=await state(p);
  ok('locker: the look is saved and shown on the Character tab',svg.includes('rx="24.5"')&&st.look.outfit==='hoodie'&&st.dripped===true);
  await shot(p,'10-character-custom-look');
  for(const o of ['tank','bare','tee','stringer','hoodie']){await go(p,'char','locker');await p.click('[data-k="outfit"][data-v="'+o+'"]');await p.locator('.av-card').screenshot({path:path.join(OUT,'look-'+o+'.png')})}
  await p.click('[data-act="lookreset"]');
  svg=await p.locator('.ch-svg').innerHTML();
  ok('locker: factory reset restores the original',svg===(svg0.replace(/<text[\s\S]*?<\/text>/,'')+'')||(svg.includes('fill="#e3171f"')&&svg.includes('fill="#ededed"')&&!svg.includes('rx="24.5"')));

  /* ---------- 10. plate math ---------- */
  await go(p,'work');await p.click('#ft [data-act="plates"]');
  await p.fill('#pl-in','225');
  ok('plates: 225 is two 45s a side',(await p.$$eval('#pl-list b',e=>e.map(x=>x.textContent).join(',')))==='45,45');
  await p.fill('#pl-in','187.5');
  ok('plates: an impossible total (187.5) loads the closest and says so',(await p.$$eval('#pl-list b',e=>e.map(x=>x.textContent).join(',')))==='45,25'&&/Can’t make 187\.5 exactly/.test(await p.textContent('#pl-out')));
  await p.fill('#pl-in','185');
  ok('plates: 185 is 45, 25 a side',(await p.$$eval('#pl-list b',e=>e.map(x=>x.textContent).join(',')))==='45,25'&&!/Can’t make/.test(await p.textContent('#pl-out')));
  await p.click('[data-act="plbar"][data-n="35"]');
  ok('plates: bar weight can change',(await p.$$eval('#pl-list b',e=>e.map(x=>x.textContent).join(',')))==='45,25,5');
  await p.fill('#pl-in','20');ok('plates: less than the bar is handled',/less than the bar/i.test(await p.textContent('#pl-out')));
  await p.fill('#pl-in','225');await shot(p,'11-plate-math');await p.click('[data-act="shx"]');
  const hasBar=await p.locator('.ex [data-act="plates"]').count();
  if(hasBar){await p.locator('.ex [data-act="plates"]').first().click();ok('plates: opens from a barbell exercise card with its weight',(await p.inputValue('#pl-in'))!=='');await p.click('[data-act="shx"]')}

  /* ---------- 11. backup file: save, wipe, restore ---------- */
  await p.click('[data-act="bkopen"]');
  ok('backup: sheet shows what is on the phone',(await p.textContent('#bk-last'))==='Never'&&/9/.test(await p.textContent('#bk-ph')));
  const d2=p.waitForEvent('download');await p.click('[data-act="bkfile"]');const dn=await d2;
  const bkPath=path.join(os.tmpdir(),'redline-test-backup.json');await dn.saveAs(bkPath);
  const bk=JSON.parse(fs.readFileSync(bkPath,'utf8'));
  ok('backup: file holds the state and all 9 photos',bk.app==='redline'&&Object.keys(bk.state.log).length===seed.days&&bk.photos.length===9&&bk.photos.every(x=>x.data.startsWith('data:image/jpeg;base64,')),(fs.statSync(bkPath).size/1048576).toFixed(2)+' MB');
  await p.waitForSelector('#bk-msg');
  ok('backup: last-backup date recorded',(await p.textContent('#bk-last'))==='Today'&&(await state(p)).lastBk!=='');
  await shot(p,'12-backup');
  const before=await state(p);
  await c.close();
  /* a brand-new phone */
  ({c,p,errs}=await mk());
  await p.goto(url);await p.waitForSelector('.seg');
  ok('restore: new phone starts empty',Object.keys((await state(p)).log).length===0&&await photoCount(p)===0);
  await p.click('[data-act="bkopen"]');
  const junk=path.join(os.tmpdir(),'redline-junk.txt');fs.writeFileSync(junk,'hello, not a backup');
  await p.setInputFiles('#bk-file',junk);await p.waitForSelector('#bk-msg');
  ok('restore: a random file is refused and nothing changes',/not a Redline backup/.test(await p.textContent('#bk-msg'))&&Object.keys((await state(p)).log).length===0);
  await p.setInputFiles('#bk-file',bkPath);await p.waitForSelector('#bk-sum');
  ok('restore: shows what is in the file before replacing',new RegExp(seed.days+' days logged, 9 photos').test(await p.textContent('#bk-sum')));
  await shot(p,'13-restore-preview');
  await p.click('[data-act="bkdo"]');
  ok('restore: needs a second tap',Object.keys((await state(p)).log).length===0&&/Tap again/.test(await p.textContent('[data-act="bkdo"]')));
  await p.click('[data-act="bkdo"]');
  await p.waitForFunction(()=>!document.getElementById('sheet').classList.contains('on'));
  const after=await state(p);
  ok('restore: history, name, goal, look, excuses and check-ins all come back',JSON.stringify(after.log)===JSON.stringify(before.log)&&after.name===before.name&&JSON.stringify(after.goal)===JSON.stringify(before.goal)&&JSON.stringify(after.excuses)===JSON.stringify(before.excuses)&&JSON.stringify(after.checks)===JSON.stringify(before.checks)&&JSON.stringify(after.body)===JSON.stringify(before.body));
  ok('restore: all 9 photos come back',await photoCount(p)===9);
  await go(p,'phys');await p.waitForSelector('.thumb img');
  ok('restore: photos display after restore',await p.locator('.thumb img').count()===9&&await p.evaluate(()=>[...document.querySelectorAll('.thumb img')].every(i=>i.complete&&i.naturalWidth===600)));
  await go(p,'char','char');
  ok('restore: level is the same',+(await p.textContent('.av-lv b'))===lvExp);
  /* legacy text backup (state only) keeps the photos that are on the phone */
  const legacy=path.join(os.tmpdir(),'redline-legacy.txt');const ls=JSON.parse(JSON.stringify(before));ls.name='Old Text';fs.writeFileSync(legacy,JSON.stringify(ls));
  await p.click('[data-act="bkopen"]');await p.setInputFiles('#bk-file',legacy);await p.waitForSelector('#bk-sum');await p.click('[data-act="bkdo"]');await p.click('[data-act="bkdo"]');
  await p.waitForFunction(()=>!document.getElementById('sheet').classList.contains('on'));
  ok('restore: an old text backup works and leaves photos alone',(await state(p)).name==='Old Text'&&await photoCount(p)===9);
  ok('restore: no JS errors',errs.length===0,errs.join('|'));

  /* ---------- 12. 320px-wide phone ---------- */
  await p.setViewportSize({width:320,height:568});
  const bad=[];
  for(const [v,s] of [['work'],['prog','lifts'],['prog','str'],['prog','body'],['prog','cal'],['lock','week'],['lock','tro'],['lock','court'],['phys'],['char','char'],['char','locker']]){
    await go(p,v,s);const o=await overflow(p);if(o.page||o.seg)bad.push(v+'/'+(s||''));
    if(SUBFIT[v]){const cut=await p.evaluate(()=>{const n=document.querySelector('.subnav');return n.scrollWidth>n.clientWidth+1});if(cut)bad.push('subnav '+v)}
    if(v==='prog'&&s==='cal')await shot(p,'20-320-calendar');if(s==='tro')await shot(p,'21-320-trophies');if(s==='locker')await shot(p,'22-320-locker');
  }
  ok('320px: all 11 screens fit with no sideways scroll',bad.length===0,bad.join(', '));
  await go(p,'work');await p.click('#ft [data-act="plates"]');await p.fill('#pl-in','315');
  const so=await p.evaluate(()=>document.getElementById('sheet').scrollWidth>window.innerWidth+1);await p.click('[data-act="shx"]');
  await p.click('[data-act="bkopen"]');const so2=await p.evaluate(()=>document.getElementById('sheet').scrollWidth>window.innerWidth+1);await p.click('[data-act="shx"]');
  ok('320px: tool sheets fit',!so&&!so2);
  await c.close();

  /* ---------- 13. offline ---------- */
  ({c,p,errs}=await mk());
  await p.goto(url);await p.waitForSelector('.seg');await seedOld(p);await p.reload();
  await p.evaluate(()=>navigator.serviceWorker.ready);await p.waitForTimeout(1500);
  const keys=await p.evaluate(()=>caches.keys());
  ok('offline: service worker cache is redline-v7',keys.join()==='redline-v7',keys.join());
  const ext=[];p.on('request',r=>{if(!r.url().startsWith(url)&&!r.url().startsWith('data:')&&!r.url().startsWith('blob:'))ext.push(r.url())});
  await c.setOffline(true);await p.reload();await p.waitForSelector('.seg');
  for(const [v,s] of [['prog','str'],['prog','body'],['prog','cal'],['lock','tro'],['lock','court'],['char','locker'],['phys']])await go(p,v,s);
  await go(p,'lock','week');await p.click('[data-act="lkshare"]');
  await p.waitForSelector('#share-img');await p.waitForFunction(()=>{const i=document.getElementById('share-img');return i.complete&&i.naturalWidth===1080});
  await p.click('[data-act="shx"]');
  const d3=p.waitForEvent('download');await p.click('[data-act="bkopen"]');await p.click('[data-act="bkfile"]');await d3;
  ok('offline: app, every new screen, share card and backup work with no network',errs.length===0,errs.join('|'));
  ok('offline: zero requests to any other host',ext.length===0,ext.join(','));
  await c.close();

  await b.close();server.close();
  console.log(res.join('\n'));console.log('\n'+(res.length-fails)+' passed, '+fails+' failed');
  process.exit(fails?1:0);
})().catch(e=>{console.log(res.join('\n'));console.error('CRASH',e);process.exit(2)});
