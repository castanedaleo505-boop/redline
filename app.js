/* Redline. One file, no libraries. All data stays in this phone's localStorage. */
(function(){
'use strict';
const APP_VERSION='1.4.0';
const LS='redline.v1';
const HINT_KEY='redline.hint';
const TAB_DOW=[1,2,3,4,5,6,0];
const TAB_L=['M','T','W','T','F','S','S'];
const LONG=['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
const ARM_RE=/curl|tricep|pushdown|skull|dips|close-grip|superset|hammer/i;
const KEEP_DAYS=730;
const INC=5;
const isArm=n=>!/leg curl|hamstring/i.test(n)&&ARM_RE.test(n);
const $=s=>document.querySelector(s);
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const pad=n=>String(n).padStart(2,'0');
const dkey=d=>d.getFullYear()+'-'+pad(d.getMonth()+1)+'-'+pad(d.getDate());
const fmt=s=>{s=Math.max(0,Math.round(s));return Math.floor(s/60)+':'+pad(s%60)};
const fnum=n=>String(Math.round(n*10)/10);
const ms=k=>{const p=k.split('-');return Date.UTC(+p[0],+p[1]-1,+p[2])};
const dayDiff=(a,b)=>Math.round((ms(b)-ms(a))/86400000);
const fmtd=k=>{const p=k.split('-');return new Date(+p[0],+p[1]-1,+p[2]).toLocaleDateString('en-US',{month:'short',day:'numeric'})};
const nk=n=>String(n).trim().toLowerCase();

/* ---------- default plan ---------- */
function X(name,sets,reps,rest,nw){return {name:name,sets:sets,reps:reps,rest:rest,nw:!!nw}}
function defaultPlan(){
  const F=' to failure';
  const p={
    4:{title:'Day 1 · Shoulders + Arms (heavy)',ex:[
      X('Machine shoulder press',3,'6-8 (last set to failure)',120),X('Lateral raise (cable)',4,'12-15'+F,60),X('Reverse pec deck',3,'15'+F,60),
      X('Barbell curl',3,'8-10'+F,90),X('Bayesian cable curl',3,'10-12'+F,60),
      X('Dips',3,'8-12'+F,90),X('Single-arm cable pushdown',3,'12-15'+F,60)]},
    5:{title:'Day 2 · Chest + Back + Biceps',ex:[
      X('Bench press',4,'6-8 (last set to failure)',180),X('Incline machine press',3,'8-10'+F,90),
      X('Pull-ups',4,'8-12'+F,120),X('Seated cable row',3,'10-12'+F,90),
      X('Lateral raise (cable)',3,'15'+F,60),X('Preacher curl',3,'10-12'+F,60),X('Single-arm cable pushdown',3,'12-15'+F,60)]},
    6:{title:'Day 3 · Legs + Calves',ex:[
      X('Squat',4,'5-6 (last set to failure)',210),X('Hack squat',3,'8-10'+F,150),
      X('Seated leg curl',4,'10-12'+F,75),X('Hip abduction machine',3,'15'+F,60),X('Standing calf raise',5,'12-15'+F,60)]},
    0:{title:'Off · No Gym',ex:[
      X('Long easy walk',1,'30-60 min',0,true),X('Stretch (optional)',1,'10 min',0,true)]},
    1:{title:'Day 4 · Shoulders + Arms (volume)',ex:[
      X('Machine shoulder press',3,'8-10'+F,90),X('Lateral raise (cable)',5,'15-20'+F+' + partials',60),X('Reverse pec deck',3,'15'+F,60),
      X('EZ bar curl',3,'10'+F,90),X('Cable curl',3,'12-15'+F,60),
      X('Machine dips',3,'10-12'+F,90),X('Single-arm cable pushdown',3,'12-15'+F,60)]},
    2:{title:'Day 5 · Back + Chest + Biceps',ex:[
      X('Weighted pull-ups',4,'6-10 (last set to failure)',150),X('Chest-supported row',3,'10-12'+F,90),
      X('Machine chest press',4,'8-10'+F,120),X('Pec deck',3,'12-15'+F,60),
      X('Lateral raise (cable)',3,'15'+F,60),X('Cable curl',3,'12-15'+F,60),X('Single-arm cable pushdown',3,'12-15'+F,60)]},
    3:{title:'Day 6 · Legs + Calves',ex:[
      X('Pendulum squat',4,'8-10'+F,150),X('Leg extension',3,'12-15'+F,60),
      X('Lying leg curl',4,'10-12'+F,75),X('Hip adduction machine',3,'15'+F,60),X('Seated calf raise',5,'15-20'+F,60)]}
  };
  Object.keys(p).forEach(k=>{p[k].ex.forEach((e,i)=>{e.id='p2_'+k+'_'+i})});
  return p;
}

/* ---------- swap suggestions ---------- */
const ALTS=[
  [/leg extension/i,['Hack squat','Pendulum squat','Sissy squat']],
  [/leg curl|hamstring/i,['Seated leg curl','Lying leg curl','Romanian deadlift','Nordic curl']],
  [/hip (ab|ad)duction|glute|hip thrust/i,['Hip abduction machine','Hip adduction machine','Hip thrust machine','Glute kickback machine','Cable glute kickback']],
  [/calf/i,['Standing calf raise','Seated calf raise','Smith machine calf raise','Single-leg calf raise']],
  [/romanian|deadlift/i,['Romanian deadlift','Good morning','Back extension','Hip thrust machine']],
  [/squat|hack|pendulum/i,['Squat','Hack squat','Pendulum squat','Smith machine squat','Leg extension']],
  [/superset/i,[]],
  [/lateral raise/i,['Lateral raise (cable)','Machine lateral raise','DB lateral raise','Leaning cable lateral raise']],
  [/rear delt|reverse pec/i,['Reverse pec deck','Rear delt cable fly','Face pulls','Band pull-apart']],
  [/face pull/i,['Rear delt fly','Reverse pec deck','Band pull-apart']],
  [/dips|pushdown|tricep/i,['Dips','Single-arm cable pushdown','Machine pushdown','Machine dips']],
  [/bench|chest press|incline.*press/i,['Bench press','Machine chest press','Incline machine press','Smith machine bench','Push-ups']],
  [/fly|pec deck/i,['Pec deck','Cable fly','Machine fly','DB fly']],
  [/overhead press|arnold|shoulder press/i,['Machine shoulder press','Seated DB overhead press','Barbell overhead press','Smith machine shoulder press','Arnold press']],
  [/pull-up|pulldown|chin/i,['Pull-ups','Lat pulldown','Assisted pull-ups','Chin-ups','Neutral-grip pulldown']],
  [/row/i,['Seated cable row','Chest-supported row','Machine row','One-arm DB row','T-bar row']],
  [/reverse curl/i,['Reverse EZ bar curl','Wrist curl','Hammer curl']],
  [/curl/i,['Barbell curl','EZ bar curl','Cable curl','Bayesian cable curl','Preacher curl','Hammer curl']]
];
function alternates(name){
  for(const r of ALTS){if(r[0].test(name))return r[1].filter(a=>nk(a)!==nk(name)).slice(0,5)}
  return [];
}

/* ---------- state + storage ---------- */
const now=new Date();
const todayKey=dkey(now);
function freshState(){return {v:2,rev:0,plan:defaultPlan(),planVer:2,target:75,body:{},name:'Leo',log:{},auto:true,notes:{},names:{},blockLen:6,block:null,checks:{},title:'',ckSnooze:'',seenLv:0,oldSets:0}}
function migrate(s){
  if(!s||typeof s!=='object')s=freshState();
  const f=freshState();
  if(!s.plan||typeof s.plan!=='object')s.plan={};
  Object.keys(f.plan).forEach(k=>{if(!s.plan[k]||!Array.isArray(s.plan[k].ex))s.plan[k]=f.plan[k]});
  if(!s.log||typeof s.log!=='object')s.log={};
  if(typeof s.planVer!=='number')s.planVer=1;
  if(!s.body||typeof s.body!=='object')s.body={};
  if(typeof s.name!=='string'||!s.name.trim())s.name='Leo';
  if([60,75,90].indexOf(s.target)<0)s.target=75;
  if(typeof s.auto!=='boolean')s.auto=true;
  if(!s.notes||typeof s.notes!=='object')s.notes={};
  if(!s.names||typeof s.names!=='object')s.names={};
  if([6,7,8].indexOf(s.blockLen)<0)s.blockLen=6;
  if(!s.checks||typeof s.checks!=='object'||Array.isArray(s.checks))s.checks={};
  if(typeof s.title!=='string')s.title='';
  if(typeof s.ckSnooze!=='string')s.ckSnooze='';
  if(typeof s.seenLv!=='number')s.seenLv=0;
  if(!(s.oldSets>0))s.oldSets=0;
  if(!s.block||typeof s.block.start!=='string'){
    const ks=Object.keys(s.log).sort();
    s.block={start:ks.length?ks[0]:todayKey};
  }
  s.rev=s.rev||0;s.v=2;return s;
}
function localLoad(){try{const r=localStorage.getItem(LS);if(r)return migrate(JSON.parse(r))}catch(e){}return migrate(null)}
let saveOk=true;
function localSave(){try{localStorage.setItem(LS,JSON.stringify(state));saveOk=true}catch(e){saveOk=false}}
let state=localLoad();

const monday=new Date(now.getFullYear(),now.getMonth(),now.getDate()-((now.getDay()+6)%7));
const tabDate=i=>new Date(monday.getFullYear(),monday.getMonth(),monday.getDate()+i);
let sel=(now.getDay()+6)%7;
let view='work';
let progSel=null;
let editMode=false;
let armed=null,armT=null;
let bkText='';
const UI={};

const curKey=()=>dkey(tabDate(sel));
function dayLog(key,make){
  let l=state.log[key];
  if(!l&&make)l=state.log[key]={d:{},w:{}};
  if(l){if(!l.d)l.d={};if(!l.w)l.w={};}
  return l;
}
/* training block + deload */
const blockWeek=key=>Math.max(1,Math.floor(dayDiff(state.block.start,key)/7)+1);
function isDeload(key){const l=state.log[key];if(l&&l.dl!==undefined)return !!l.dl;return blockWeek(key)>state.blockLen}
const nsets=(key,e)=>(!e.nw&&isDeload(key))?Math.max(1,Math.ceil(e.sets/2)):e.sets;
const effName=(key,e)=>{const l=state.log[key];return (l&&l.sw&&l.sw[e.id])||e.name};

function getDone(key,e){
  const l=state.log[key],s=(l&&l.d&&l.d[e.id])||'',n=nsets(key,e),a=[];
  for(let i=0;i<n;i++)a.push(s.charAt(i)==='1');
  return a;
}
function putDone(key,e,a){
  const l=dayLog(key,true);
  if(l.dl===undefined)l.dl=isDeload(key)?1:0;
  l.d[e.id]=a.map(x=>x?'1':'0').join('');
}
const getW=(key,name)=>{const l=state.log[key];return (l&&l.w&&l.w[nk(name)])||''};
function lastW(date,name){
  const k=nk(name);
  const ks=Object.keys(state.log).filter(x=>x<date).sort().reverse();
  for(let i=0;i<ks.length;i++){const w=state.log[ks[i]].w&&state.log[ks[i]].w[k];if(w)return {w:w,d:ks[i]}}
  return null;
}
function suggest(key,name){
  const last=lastW(key,name);if(!last)return null;
  const lw=parseFloat(last.w);if(!(lw>0))return null;
  if(isDeload(key))return {v:fnum(Math.round(lw*0.85/2.5)*2.5),kind:'dl',last:last};
  const lg=state.log[last.d];
  if(lg&&lg.t&&lg.t[nk(name)]===1)return {v:fnum(lw+INC),kind:'up',last:last};
  return {v:fnum(lw),kind:'same',last:last};
}
function stats(i){
  const dow=TAB_DOW[i],key=dkey(tabDate(i));let t=0,d=0;
  const lf=state.log[key];if(lf&&lf.f)return {t:lf.f.t,d:lf.f.d,pct:lf.f.t?Math.round(lf.f.d*100/lf.f.t):0,key:key,dow:dow};
  state.plan[dow].ex.forEach(e=>{t+=nsets(key,e);d+=getDone(key,e).filter(Boolean).length});
  return {t:t,d:d,pct:t?Math.round(d*100/t):0,key:key,dow:dow};
}
function exById(id){const ex=state.plan[TAB_DOW[sel]].ex;for(let i=0;i<ex.length;i++)if(ex[i].id===id)return ex[i];return null}
const topReps=r=>{const m=String(r).match(/(\d+)(?!.*\d)/);return m?m[1]:r};

/* ---------- saving ---------- */
const STATUS_OK='Saved on this phone · Redline v'+APP_VERSION;
const STATUS_FAIL='Can’t save. This browser is blocking storage.';
let flashT=null;
const statusText=()=>saveOk?STATUS_OK:STATUS_FAIL;
function flash(msg){
  const el=$('#status');if(!el)return;
  el.textContent=msg;clearTimeout(flashT);
  flashT=setTimeout(()=>{const e2=$('#status');if(e2)e2.textContent=statusText()},4500);
}
/* days older than two years are dropped, but their sets stay in the lifetime count so a level never goes down */
function prune(){const c=new Date(now.getFullYear(),now.getMonth(),now.getDate()-KEEP_DAYS);const cut=dkey(c);Object.keys(state.log).forEach(k=>{if(k<cut){state.oldSets+=logSets(state.log[k]);delete state.log[k]}})}
function change(){
  state.rev=Date.now();prune();localSave();
  const el=$('#status');if(el&&!flashT)el.textContent=statusText();
}

/* ---------- progress charts ---------- */
function allSeries(){
  const m={};
  Object.keys(state.log).sort().forEach(d=>{
    const w=state.log[d].w||{};
    Object.keys(w).forEach(k=>{const v=parseFloat(w[k]);if(v>0)(m[k]=m[k]||[]).push({d:d,v:v})});
  });
  return m;
}
function chartSvg(pts,label){
  const W=360,H=210,L=44,R=18,T=18,B=30;
  const vs=pts.map(p=>p.v),mn=Math.min.apply(null,vs),mx=Math.max.apply(null,vs);
  const range=(mx-mn)||10;
  const steps=[5,10,20,25,50,100];let step=100;
  for(const s of steps){if(range/s<=4){step=s;break}}
  let y0=Math.floor(mn/step)*step;if(mn-y0<step*0.15)y0-=step;
  let y1=Math.ceil(mx/step)*step;if(y1-mx<step*0.15)y1+=step;
  if(y0<0)y0=0;
  const t0=ms(pts[0].d),t1=ms(pts[pts.length-1].d);
  const X=p=>(pts.length===1||t1===t0)?(L+(W-L-R)/2):L+(ms(p.d)-t0)/(t1-t0)*(W-L-R);
  const Y=v=>T+(1-(v-y0)/(y1-y0))*(H-T-B);
  let g='';
  for(let v=y0;v<=y1+1e-9;v+=step){
    g+='<line x1="'+L+'" x2="'+(W-R)+'" y1="'+Y(v).toFixed(1)+'" y2="'+Y(v).toFixed(1)+'" stroke="#262626" stroke-width="1"/>'+
       '<text x="'+(L-8)+'" y="'+(Y(v)+4).toFixed(1)+'" text-anchor="end" font-size="11" fill="#8d8d8d" style="font-family:var(--body)">'+fnum(v)+'</text>';
  }
  const line=pts.length>1?'<polyline fill="none" stroke="#e3171f" stroke-width="3" stroke-linejoin="round" stroke-linecap="round" points="'+pts.map(p=>X(p).toFixed(1)+','+Y(p.v).toFixed(1)).join(' ')+'"/>':'';
  let dots='';
  pts.forEach((p,i)=>{
    const last=i===pts.length-1;
    dots+='<circle cx="'+X(p).toFixed(1)+'" cy="'+Y(p.v).toFixed(1)+'" r="'+(last?6:4)+'" fill="#e3171f"'+(last?' stroke="#fff" stroke-width="2"':'')+'/>';
  });
  const lp=pts[pts.length-1],lx=X(lp),ly=Y(lp.v);
  const anchor=lx>W-40?'end':'middle';
  const ty=ly<T+22?ly+24:ly-12;
  const val='<text x="'+lx.toFixed(1)+'" y="'+ty.toFixed(1)+'" text-anchor="'+anchor+'" font-size="15" font-weight="700" fill="#f5f5f5" style="font-family:var(--body)">'+fnum(lp.v)+'</text>';
  let xl='';
  if(pts.length===1||t1===t0){
    xl='<text x="'+(L+(W-L-R)/2)+'" y="'+(H-8)+'" text-anchor="middle" font-size="11" fill="#8d8d8d" style="font-family:var(--body)">'+fmtd(pts[0].d)+'</text>';
  }else{
    xl='<text x="'+L+'" y="'+(H-8)+'" text-anchor="start" font-size="11" fill="#8d8d8d" style="font-family:var(--body)">'+fmtd(pts[0].d)+'</text>'+
       '<text x="'+(W-R)+'" y="'+(H-8)+'" text-anchor="end" font-size="11" fill="#8d8d8d" style="font-family:var(--body)">'+fmtd(lp.d)+'</text>';
  }
  return '<svg viewBox="0 0 '+W+' '+H+'" role="img" aria-label="'+esc(label)+'">'+g+line+dots+val+xl+'</svg>';
}
function spark(pts){
  const W=84,H=28,P=4;
  if(pts.length===1)return '<svg width="84" height="28" viewBox="0 0 84 28" aria-hidden="true"><circle cx="42" cy="14" r="3.5" fill="#e3171f"/></svg>';
  const vs=pts.map(p=>p.v),mn=Math.min.apply(null,vs),mx=Math.max.apply(null,vs),rg=(mx-mn)||1;
  const t0=ms(pts[0].d),t1=ms(pts[pts.length-1].d)||1,tr=(t1-t0)||1;
  const c=pts.map(p=>(P+(ms(p.d)-t0)/tr*(W-2*P)).toFixed(1)+','+(H-P-(p.v-mn)/rg*(H-2*P)).toFixed(1)).join(' ');
  return '<svg width="84" height="28" viewBox="0 0 84 28" aria-hidden="true"><polyline fill="none" stroke="#e3171f" stroke-width="2" stroke-linejoin="round" stroke-linecap="round" points="'+c+'"/></svg>';
}
function progressHtml(){
  const m=allSeries(),keys=Object.keys(m);
  if(!keys.length){
    return '<div class="empty"><b>No weights logged yet</b><p>Type a weight on any exercise in the Workout tab. Your charts show up here after your first session, and fill in as you repeat lifts.</p></div>';
  }
  keys.sort((a,b)=>m[b].length-m[a].length||(a<b?-1:1));
  if(!progSel||!m[progSel])progSel=keys[0];
  const pts=m[progSel],f=pts[0],l=pts[pts.length-1];
  const best=Math.max.apply(null,pts.map(p=>p.v)),dlt=l.v-f.v;
  const name=state.names[progSel]||progSel;
  const sub=pts.length+' '+(pts.length===1?'session':'sessions')+(pts.length>1?' · '+fmtd(f.d)+' to '+fmtd(l.d):' · '+fmtd(f.d));
  const hint=pts.length===1?'<div class="ed-note">Log this lift again to see a trend line.</div>':'';
  const card='<div class="chart-card"><div><div class="c-name">'+esc(name)+'</div><div class="c-sub">'+sub+'</div></div>'+
    chartSvg(pts,'Weight over time for '+name)+hint+
    '<div class="stats"><div class="stat"><b>'+fnum(l.v)+'</b><span>Latest</span></div><div class="stat"><b>'+fnum(best)+'</b><span>Best</span></div><div class="stat"><b style="color:'+(dlt>0?'var(--red-hi)':'var(--fg)')+'">'+(pts.length>1?(dlt>0?'+':'')+fnum(dlt):'–')+'</b><span>Change</span></div></div></div>';
  const rows=keys.map(k=>{
    const p=m[k],d=p[p.length-1].v-p[0].v;
    return '<button class="prow'+(k===progSel?' sel':'')+'" data-act="psel" data-k="'+esc(k)+'"><div><div class="nm">'+esc(state.names[k]||k)+'</div><div class="sub">'+fnum(p[p.length-1].v)+' lbs · '+p.length+' '+(p.length===1?'session':'sessions')+'</div></div>'+spark(p)+
      '<div class="dv" style="color:'+(d>0?'var(--red-hi)':'var(--fg)')+'">'+(p.length>1?(d>0?'+':'')+fnum(d):'–')+'</div></button>';
  }).join('');
  return card+'<div class="sec-t">All lifts</div>'+rows;
}


/* ---------- locked in: streak, weekly score, boss, session clock, pump ---------- */
const HIT=80;
const parseKey=k=>{const p=k.split('-');return new Date(+p[0],+p[1]-1,+p[2])};
const addDays=(d,n)=>new Date(d.getFullYear(),d.getMonth(),d.getDate()+n);
function dayStat(key){
  const l0=state.log[key];
  if(l0&&l0.f)return {off:false,t:l0.f.t,d:l0.f.d,pct:l0.f.t?Math.round(l0.f.d*100/l0.f.t):0,wl:l0.f.wl,wt:l0.f.wt};
  const pl=state.plan[parseKey(key).getDay()];
  if(!pl||!pl.ex.length||/^off\b/i.test(pl.title))return {off:true,t:0,d:0,pct:0,wl:0,wt:0};
  let t=0,d=0,wt=0,wl=0;
  pl.ex.forEach(e=>{
    const dn=getDone(key,e).filter(Boolean).length;
    t+=nsets(key,e);d+=dn;
    if(dn>0&&!e.nw){wt++;if(getW(key,effName(key,e)))wl++}
  });
  return {off:false,t:t,d:d,pct:t?Math.round(d*100/t):0,wl:wl,wt:wt};
}
/* session clock: starts at the first set, ends at 100% or after 45 minutes with no activity */
function sessInfo(key){
  const l=state.log[key];if(!l||!l.st)return null;
  const endAt=l.en||((Date.now()-(l.la||l.st)>45*60000)?(l.la||l.st):null);
  return {ms:Math.max(0,(endAt||Date.now())-l.st),running:!endAt};
}
function clockState(key){
  const tg=state.target,si=sessInfo(key);
  if(!si){
    if(key===todayKey)return {t:'Clock starts with your first set · target '+tg+' min',c:''};
    return {t:'',c:'hide'};
  }
  const mins=si.ms/60000;
  if(si.running)return {t:'Session '+fmt(si.ms/1000)+' / '+tg+':00',c:mins>tg?'over':'run'};
  const m=Math.round(mins);
  return {t:'Finished in '+m+' min · '+(mins<=tg?'under target':(Math.round(mins-tg)+' min over target')),c:mins<=tg?'ok':'over'};
}
function renderClock(){
  const el=document.getElementById('clk');if(!el)return;
  const c=clockState(curKey());el.textContent=c.t;el.className='clock '+c.c;
}
function touchSession(key,anyDone,pct){
  if(key!==todayKey)return;
  const l=dayLog(key,true),n=Date.now();
  if(!anyDone){delete l.st;delete l.la;delete l.en;return}
  if(!l.st)l.st=n;
  l.la=n;
  if(pct>=100)l.en=n;else delete l.en;
}
function weekStat(mon,m){
  let t=0,d=0,wt=0,wl=0,hit=0,sess=0,pn=0,ps=0;const days=[],missed=[],mins=[];
  for(let i=0;i<7;i++){
    const dt=addDays(mon,i),k=dkey(dt),s=dayStat(k),l=state.log[k];
    let st;
    if(s.off)st='off';
    else if(s.pct>=HIT)st='hit';
    else if(k<todayKey)st=s.d>0?'part':'miss';
    else if(k===todayKey)st=s.d>0?'part':'today';
    else st='ahead';
    if(st==='miss'||st==='part')missed.push(LONG[dt.getDay()].slice(0,3));
    days.push({k:k,l:['M','T','W','T','F','S','S'][i],st:st});
    if(!s.off){t+=s.t;d+=s.d;wt+=s.wt;wl+=s.wl;if(s.pct>=HIT)hit++;if(s.d>0)sess++}
    if(l&&l.pump){pn++;ps+=l.pump}
    const si=sessInfo(k);if(si&&!si.running&&si.ms>5*60000)mins.push(si.ms/60000);
  }
  const score=Math.round(100*(0.7*(t?d/t:0)+0.3*(wt?wl/wt:0)));
  const from=days[0].k,to=days[6].k;let prs=0;
  Object.keys(m).forEach(k=>{let best=0;m[k].forEach(p=>{if(best>0&&p.v>best&&p.d>=from&&p.d<=to)prs++;if(p.v>best)best=p.v})});
  const planned=days.filter(x=>x.st!=='off').length;
  const avg=mins.length?mins.reduce((a,b)=>a+b,0)/mins.length:0;
  return {score:score,sets:d,setsTotal:t,hit:hit,planned:planned,sess:sess,wl:wl,wt:wt,prs:prs,days:days,missed:missed,from:from,
    mins:mins,avg:avg,under:mins.filter(x=>x<=state.target).length,pump:pn?ps/pn:0,pumpN:pn};
}
function streakInfo(){
  const ks=Object.keys(state.log).filter(k=>{const l=state.log[k];return l&&(l.f||(l.d&&Object.keys(l.d).some(id=>/1/.test(l.d[id]))))}).sort();
  if(!ks.length)return {cur:0,best:0};
  let cur=0,best=0;
  for(let dt=parseKey(ks[0]);dkey(dt)<=todayKey;dt=addDays(dt,1)){
    const k=dkey(dt),s=dayStat(k);
    if(s.off)continue;
    if(s.pct>=HIT){cur++;if(cur>best)best=cur}
    else if(k!==todayKey)cur=0;
  }
  return {cur:cur,best:best};
}
function bestPumpDay(){
  const g={};
  Object.keys(state.log).forEach(k=>{
    const l=state.log[k];if(!l||!l.pump)return;
    const dow=parseKey(k).getDay(),pl=state.plan[dow];if(!pl)return;
    const nm=pl.title.split(' · ')[0];
    (g[nm]=g[nm]||{s:0,n:0});g[nm].s+=l.pump;g[nm].n++;
  });
  let best=null;
  Object.keys(g).forEach(k=>{const a=g[k].s/g[k].n;if(!best||a>best.a)best={k:k,a:a,n:g[k].n}});
  return best;
}
const PUMP_TXT=['','Flat. Did you even lift?','Mild. Respectable.','Solid pump.','Sleeves are tight. Veins reporting for duty.','Skin-splitting. Seek a bigger shirt.'];
function pumpHtml(key){
  const s=dayStat(key);if(s.off)return '';
  const l=state.log[key],cur=(l&&l.pump)||0;
  return '<div class="pump"><div class="lab">Pump check</div><div class="pump-b">'+[1,2,3,4,5].map(n=>'<button class="pbtn'+(cur===n?' on':'')+'" data-act="pump" data-v="'+n+'" aria-pressed="'+(cur===n)+'" aria-label="Pump '+n+' out of 5">'+n+'</button>').join('')+'</div>'+
    '<div class="ed-note">'+esc(PUMP_TXT[cur]||'End of session: how did the muscles feel? 1 flat, 5 skin-splitting.')+'</div></div>';
}
const BOSSES=[
  ['The Snooze Button','Has beaten you before. Does not remember your name.'],
  ['Couch Goblin','Keeps your seat warm. Takes it personally.'],
  ['Skip-Day Gremlin','Whispers “just one rest day.” Do not listen.'],
  ['The Motivation Thief','Steals your drive around 4 p.m. every day.'],
  ['Soreness Demon','Feeds on excuses. Allergic to sets.'],
  ['Phone-Scroll Wraith','Eats 40 minutes between sets. Quietly.'],
  ['Chicken-Leg Spirit','Haunts anyone who skips the lower half.'],
  ['The Plateau','Was here before you. Refuses to leave.']
];
function bossFor(wk,mon){
  const wn=Math.floor(dayDiff('2026-01-05',dkey(mon))/7),b=BOSSES[((wn%BOSSES.length)+BOSSES.length)%BOSSES.length];
  const max=Math.max(1,Math.ceil(wk.setsTotal*0.9)),dmg=Math.min(wk.sets,max),hp=max-dmg;
  return {name:b[0],taunt:b[1],max:max,hp:hp,dmg:dmg,slain:wk.setsTotal>0&&wk.sets>=max};
}
const TIERS=[
  [0,'Ghost','No sets logged yet. The weights are starting rumors about you.'],
  [1,'Pulse detected','A set happened. Medical staff are cautiously optimistic.'],
  [25,'Warming up','The iron has noticed you.'],
  [50,'Locked in','Phone face down. Jaw set. Zero small talk.'],
  [75,'Feral','You stopped asking if you feel like it. That question is gone.'],
  [90,'Unhinged','Neighbors have reported unusual levels of focus.']
];
const tierFor=sc=>{let t=TIERS[0];TIERS.forEach(x=>{if(sc>=x[0])t=x});return t};
function streakLine(n){
  if(n<=0)return 'Streak is at zero. Today fixes that.';
  if(n===1)return 'One down. The rest is repetition.';
  if(n<4)return 'Momentum is a rumor until it isn’t. It’s getting real.';
  if(n<6)return 'Your couch has filed a missing-person report.';
  if(n<12)return 'A full week. Friends are asking if you’re okay.';
  if(n<24)return 'Two weeks. This is no longer a phase.';
  return 'You’re not training anymore. You’re a lifestyle brand.';
}
function lockHtml(){
  const m=allSeries(),wk=weekStat(monday,m),lw=weekStat(addDays(monday,-7),m),sk=streakInfo(),tr=tierFor(wk.score);
  const lastHas=lw.sets>0;
  const diff=lastHas?wk.score-lw.score:null;
  const cls=wk.score>=90?' hot':(wk.score>=75?' warm':'');
  const ticks=[25,50,75,90].map(x=>'<u style="left:'+x+'%"></u>').join('');
  let h='<div class="lk-card'+cls+'"><div class="lk-top"><div class="lk-lab">Locked-in meter · this week</div>'+
    '<div class="lk-score" id="lk-score">'+wk.score+'</div></div>'+
    '<div class="lk-bar" role="img" aria-label="Locked in score '+wk.score+' out of 100"><i style="width:'+wk.score+'%"></i>'+ticks+'</div>'+
    '<div class="lk-tier">'+esc(tr[1])+'</div><p class="lk-q">'+esc(tr[2])+'</p>'+
    '<p class="lk-how">Score = 70% sets finished + 30% lifts with a weight logged. Full week resets Monday.</p></div>';
  /* weekly boss */
  const bs=bossFor(wk,monday);let slain=0;
  for(let i=1;i<=12;i++){const w=weekStat(addDays(monday,-7*i),m);if(w.setsTotal>0&&w.sets>=Math.max(1,Math.ceil(w.setsTotal*0.9)))slain++}
  const pct=bs.max?Math.round(bs.hp*100/bs.max):0;
  const bt=bs.slain?'Slain. Loot: nothing. But you look different.':(pct>66?bs.taunt:(pct>33?'It’s bleeding. Keep going.':'It’s begging now. Do not make eye contact. Finish it.'));
  h+='<div class="boss'+(bs.slain?' dead':'')+'"><div class="lk-lab">Weekly boss</div><div class="boss-n">'+esc(bs.name)+(bs.slain?' · slain':'')+'</div>'+
    '<div class="boss-bar" role="img" aria-label="Boss health '+bs.hp+' of '+bs.max+'"><i style="width:'+pct+'%"></i></div>'+
    '<div class="boss-hp"><span>HP '+bs.hp+' / '+bs.max+'</span><span>'+bs.dmg+' sets of damage</span></div>'+
    '<p class="lk-q">'+esc(bt)+'</p><p class="lk-how">Every finished set is 1 damage. Finish 90% of the week’s sets to win. Bosses slain, last 12 weeks: '+slain+'.</p></div>';
  h+='<div class="lk-streak"><div class="lk-flame" aria-hidden="true">🔥</div><div class="lk-sn"><b>'+sk.cur+'</b><span>'+(sk.cur===1?'session':'sessions')+' in a row</span></div>'+
    '<div class="lk-sb"><b>'+sk.best+'</b><span>best</span></div></div>'+
    '<p class="lk-q pad">'+esc(streakLine(sk.cur))+' <span class="lk-fine">A session counts at '+HIT+'% of sets. Sunday and off days never break it.</span></p>';
  h+='<div class="sec-t">This week</div><div class="lk-days">'+wk.days.map(x=>'<div class="lk-d '+x.st+'"><span>'+x.l+'</span><i></i></div>').join('')+'</div>';
  const bp=bestPumpDay();
  const rows=[
    ['Sets finished',wk.sets+' of '+wk.setsTotal],
    ['Sessions hit',wk.hit+' of '+wk.planned],
    ['Weights logged',wk.wt?wk.wl+' of '+wk.wt+' lifts':'–'],
    ['New personal bests',String(wk.prs)],
    ['Average session',wk.mins.length?Math.round(wk.avg)+' min':'–'],
    ['Under '+state.target+' min',wk.mins.length?wk.under+' of '+wk.mins.length:'–'],
    ['Pump this week',wk.pumpN?fnum(wk.pump)+' / 5':'–'],
    ['Best pump day',bp?bp.k+' ('+fnum(bp.a)+')':'–'],
    ['Vs last week',diff===null?'–':(diff>0?'+':'')+diff+' pts']
  ];
  h+='<div class="lk-rows">'+rows.map(r=>'<div><span>'+r[0]+'</span><b>'+esc(r[1])+'</b></div>').join('')+'</div>';
  let verdict='';
  if(wk.prs>0)verdict='New best on '+wk.prs+(wk.prs===1?' lift':' lifts')+'. The bar moved and you moved it.';
  else if(wk.missed.length)verdict='Skipped: '+wk.missed.join(', ')+'. It will be remembered.';
  else if(wk.sets>0)verdict='Clean week so far. Do not get weird about it. (Get weird about it.)';
  if(verdict)h+='<p class="lk-q pad">'+esc(verdict)+'</p>';
  const past=[];for(let i=5;i>=1;i--){const w=weekStat(addDays(monday,-7*i),m);past.push({s:w.score,has:w.sets>0,d:fmtd(w.from)})}
  if(past.some(x=>x.has)){
    h+='<div class="sec-t">Last 5 weeks</div><div class="lk-hist">'+past.map(x=>'<div><div class="col"><i style="height:'+(x.has?Math.max(4,x.s):0)+'%"></i></div><b>'+(x.has?x.s:'–')+'</b><span>'+esc(x.d)+'</span></div>').join('')+'</div>';
  }
  h+='<button class="wide-btn" data-act="lkshare">Share this week</button>';
  return h;
}
function shareLock(){
  const m=allSeries(),wk=weekStat(monday,m),sk=streakInfo(),tr=tierFor(wk.score),bs=bossFor(wk,monday);
  const text='REDLINE · '+wk.score+'/100 · '+tr[1].toUpperCase()+'\n🔥 '+sk.cur+' in a row · '+wk.sets+'/'+wk.setsTotal+' sets · '+wk.prs+' PR'+(wk.prs===1?'':'s')+'\nBoss: '+bs.name+(bs.slain?' (slain)':' ('+bs.hp+' HP left)')+'\n"'+tr[2]+'"';
  try{
    if(navigator.share){navigator.share({text:text}).catch(()=>{});return}
    if(navigator.clipboard&&navigator.clipboard.writeText){navigator.clipboard.writeText(text).then(()=>flash('Copied. Paste it in a group chat.'),()=>flash('Could not copy.'));return}
  }catch(e){}
  flash('Sharing is blocked in this browser.');
}
function loadNewPlan(){
  Object.keys(state.log).forEach(k=>{
    const l=state.log[k];
    if(k<todayKey&&l&&!l.f&&l.d&&Object.keys(l.d).some(id=>/1/.test(l.d[id]))){
      const x=dayStat(k);
      if(!x.off)l.f={t:x.t,d:x.d,wt:x.wt,wl:x.wl};
    }
  });
  state.plan=defaultPlan();state.planVer=2;
  change();
}
function planBannerHtml(){
  if(state.planVer>=2||state.planSkip)return '';
  return '<div class="banner"><b>New plan ready</b><p>About 20-23 sets a day, every isolation set to failure. Your triceps are dips and cable pushdowns only, and legs have no leg press or lunges. Your weights, streak and notes stay. Your current exercise list is replaced, so copy a backup first if you edited it.</p>'+
    '<button class="wide-btn" data-act="plan2">'+(armed==='plan2'?'Tap again to load':'Load new plan')+'</button><button class="mini" data-act="plan2x">Not now</button></div>';
}

/* ---------- check-ins: photos, body numbers ---------- */
const POSES=['front','side','back'];
const POSE_L={front:'Front',side:'Side',back:'Back'};
const POSE_HINT={front:'Face the camera. Arms slightly out, relaxed.',side:'Turn 90 degrees. Arms at your sides.',back:'Face away. Arms slightly out, relaxed.'};
const BODY_F=[['bw','Body weight','lb'],['sh','Shoulders','in'],['ch','Chest','in'],['wa','Waist','in'],['ar','Arm, flexed','in'],['th','Thigh','in'],['ca','Calf','in']];
const MUS=['shoulders','chest','back','biceps','triceps','quads','hams','glutes','calves'];
const MUS_L={shoulders:'Shoulders',chest:'Chest',back:'Back',biceps:'Biceps',triceps:'Triceps',quads:'Quads',hams:'Hamstrings',glutes:'Glutes',calves:'Calves'};
const MUSCLE_MAP=[
  [/reverse pec|rear delt|face pull/i,[['shoulders',.7]]],
  [/lateral raise/i,[['shoulders',1]]],
  [/shoulder press|overhead press|arnold/i,[['shoulders',1],['triceps',.4]]],
  [/pec deck|fly/i,[['chest',1]]],
  [/dips/i,[['triceps',1],['chest',.4]]],
  [/bench|chest press|incline.*press|push-up/i,[['chest',1],['triceps',.4],['shoulders',.3]]],
  [/pushdown|tricep|skull/i,[['triceps',1]]],
  [/leg curl|hamstring|nordic|romanian|deadlift|good morning/i,[['hams',1],['glutes',.4]]],
  [/curl/i,[['biceps',1]]],
  [/pull-up|pulldown|chin|row|straight-arm/i,[['back',1],['biceps',.4]]],
  [/hip |glute|kickback/i,[['glutes',1]]],
  [/calf/i,[['calves',1]]],
  [/squat|hack|pendulum|leg extension|leg press|lunge/i,[['quads',1],['glutes',.3]]]
];
const muscleOf=n=>{for(let i=0;i<MUSCLE_MAP.length;i++)if(MUSCLE_MAP[i][0].test(n))return MUSCLE_MAP[i][1];return []};
const TITLES=['Rookie','Regular','Grinder','Gym Rat','Iron Head','Menace','Feral','Unhinged','Final Boss','Mythic','Redline'];
const PH={list:[],loaded:false,loading:false,failed:false,urls:{}};
const CAM={on:false,step:0,facing:'user',timer:10,stream:null,shots:{},review:null,count:0,cd:null,err:'',saving:false};
let DBH=null;

/* photo storage (IndexedDB, stays on this phone) */
function idb(){return new Promise((res,rej)=>{
  if(DBH)return res(DBH);
  if(!window.indexedDB)return rej(new Error('no indexedDB'));
  let r;try{r=indexedDB.open('redline-photos',1)}catch(e){return rej(e)}
  r.onupgradeneeded=()=>{r.result.createObjectStore('photos',{keyPath:'k'})};
  r.onsuccess=()=>{DBH=r.result;res(DBH)};
  r.onerror=()=>rej(r.error);r.onblocked=()=>rej(new Error('blocked'));
})}
function idbRun(mode,fn){return idb().then(db=>new Promise((res,rej)=>{
  const tx=db.transaction('photos',mode),rq=fn(tx.objectStore('photos'));
  tx.oncomplete=()=>res(rq&&rq.result);tx.onerror=()=>rej(tx.error);tx.onabort=()=>rej(tx.error);
}))}
function loadPhotos(){
  if(PH.loading)return;PH.loading=true;
  idbRun('readonly',st=>st.getAll()).then(arr=>{
    Object.keys(PH.urls).forEach(k=>{try{URL.revokeObjectURL(PH.urls[k])}catch(e){}});PH.urls={};
    PH.list=(arr||[]).sort((a,b)=>a.date<b.date?-1:(a.date>b.date?1:0));PH.loaded=true;PH.loading=false;
    if(syncChecks())renderAll();else if(view==='phys')renderList();
  }).catch(()=>{PH.failed=true;PH.loaded=true;PH.loading=false;if(view==='phys')renderList()});
}
const photoRec=(d,p)=>PH.list.find(r=>r.date===d&&r.pose===p)||null;
function photoUrl(r){if(!PH.urls[r.k+r.ts])PH.urls[r.k+r.ts]=URL.createObjectURL(r.blob);return PH.urls[r.k+r.ts]}
function savePhoto(date,pose,blob,w,h){
  const rec={k:date+'|'+pose,date:date,pose:pose,blob:blob,w:w,h:h,ts:Date.now()};
  return idbRun('readwrite',st=>st.put(rec)).then(()=>{
    PH.list=PH.list.filter(r=>r.k!==rec.k);PH.list.push(rec);
    PH.list.sort((a,b)=>a.date<b.date?-1:(a.date>b.date?1:0));
  });
}
function delCheckin(date){
  return idbRun('readwrite',st=>{POSES.forEach(p=>st.delete(date+'|'+p))}).then(()=>{PH.list=PH.list.filter(r=>r.date!==date);recheckMonth(mkey(date))});
}
const checkDates=()=>{const s={};PH.list.forEach(r=>{s[r.date]=1});return Object.keys(s).sort()};

/* body numbers */
function dayBody(key,make){let b=state.body[key];if(!b&&make)b=state.body[key]={};return b}
function bodyPts(f){
  const o=[];Object.keys(state.body).sort().forEach(k=>{const v=parseFloat(state.body[k][f]);if(v>0)o.push({d:k,v:v})});return o;
}
function bodyLatest(f,before){
  const p=bodyPts(f).filter(x=>!before||x.d<before);return p.length?p[p.length-1]:null;
}
function bodySumHtml(){
  const rows=BODY_F.map(f=>{
    const p=bodyPts(f[0]);if(!p.length)return '';
    const a=p[0].v,b=p[p.length-1].v,d=b-a;
    return '<div class="prow static"><div><div class="nm">'+f[1]+'</div><div class="sub">'+fnum(b)+' '+f[2]+(p.length>1?' · since '+fmtd(p[0].d)+' ('+(d>0?'+':'')+fnum(d)+')':' · first entry')+'</div></div>'+(p.length>1?spark(p):'')+'</div>';
  }).join('');
  return rows||'<div class="ed-note">Enter any numbers above. Use a tape measure, relaxed, same spot each time. Optional. Nothing here feeds the character, that runs on sets.</div>';
}

/* muscle groups, level */
function weekMuscle(){
  const out={};MUS.forEach(g=>{out[g]={done:0,plan:0}});
  for(let i=0;i<7;i++){
    const dt=addDays(monday,i),key=dkey(dt),pl=state.plan[dt.getDay()];
    if(!pl||/^off\b/i.test(pl.title))continue;
    pl.ex.forEach(e=>{
      if(e.nw)return;
      const mm=muscleOf(effName(key,e)),n=nsets(key,e),dn=getDone(key,e).filter(Boolean).length;
      mm.forEach(x=>{out[x[0]].plan+=n*x[1];out[x[0]].done+=dn*x[1]});
    });
  }
  return out;
}
function logSets(l){
  if(!l)return 0;
  if(l.f)return l.f.d||0;
  let n=0;
  if(l.d)Object.keys(l.d).forEach(id=>{if(/^(d|p2_)0_/.test(id))return;const m=String(l.d[id]).match(/1/g);if(m)n+=m.length});
  return n;
}
function totalSets(){
  let n=state.oldSets||0;
  Object.keys(state.log).forEach(k=>{n+=logSets(state.log[k])});
  return n;
}
const CHECK_XP=25;
function levelInfo(){
  const sets=totalSets(),cks=Object.keys(state.checks).length,total=sets+cks*CHECK_XP;
  const n=1+Math.floor(Math.sqrt(total/30)),lo=30*(n-1)*(n-1),hi=30*n*n;
  return {n:n,total:total,sets:sets,cks:cks,title:TITLES[Math.min(n-1,TITLES.length-1)],next:hi,pct:Math.round((total-lo)*100/(hi-lo))};
}
/* compare + history markup */
function compareHtml(){
  const pose=UI.cmpPose||'front';
  let h='<div class="chips">'+POSES.map(p=>'<button class="chip'+(p===pose?' red':'')+'" data-act="cpose" data-p="'+p+'" aria-pressed="'+(p===pose)+'">'+POSE_L[p]+'</button>').join('')+'</div>';
  const ds=PH.list.filter(r=>r.pose===pose).map(r=>r.date);
  if(ds.length<2)return h+'<div class="ed-note">Compare needs two check-ins with a '+pose+' photo. You have '+ds.length+'.</div>';
  let a=UI.cmpA,b=UI.cmpB;
  if(ds.indexOf(a)<0)a=ds[0];if(ds.indexOf(b)<0)b=ds[ds.length-1];
  UI.cmpA=a;UI.cmpB=b;
  const ra=photoRec(a,pose),rb=photoRec(b,pose);
  const opt=v=>ds.map(d=>'<option value="'+d+'"'+(d===v?' selected':'')+'>'+fmtd(d)+', '+d.slice(0,4)+'</option>').join('');
  h+='<div class="chips"><button class="chip" data-act="cmpq" data-q="first">First vs latest</button><button class="chip" data-act="cmpq" data-q="prev">Last two</button></div>';
  h+='<div class="cmp-sel-row"><label>Before<select class="cmp-sel" id="cmp-a">'+opt(a)+'</select></label><label>After<select class="cmp-sel" id="cmp-b">'+opt(b)+'</select></label></div>';
  h+='<div class="cmp" id="cmp" style="--pos:50%;aspect-ratio:'+(rb.w||3)+' / '+(rb.h||4)+'"><img class="cmp-b" alt="After photo" src="'+photoUrl(rb)+'"><img class="cmp-a" alt="Before photo" src="'+photoUrl(ra)+'"><div class="cmp-line"></div>'+
    '<span class="cmp-la">'+esc(fmtd(a))+'</span><span class="cmp-lb">'+esc(fmtd(b))+'</span>'+
    '<input type="range" min="0" max="100" value="50" id="cmp-r" aria-label="Slide between before and after"></div>';
  return h;
}
function historyHtml(){
  const all=checkDates();
  return all.slice().reverse().map(d=>{
    const pi=all.indexOf(d)-1,since=pi>=0?setsBetween(all[pi],d)+' sets since '+fmtd(all[pi]):'First one. The baseline.';
    const th=POSES.map(p=>{const r=photoRec(d,p);return r?'<button class="thumb" data-act="phview" data-k="'+esc(r.k)+'" aria-label="View '+p+' photo"><img alt="" src="'+photoUrl(r)+'"><span>'+POSE_L[p]+'</span></button>':'<div class="thumb none"><span>'+POSE_L[p]+'</span></div>'}).join('');
    return '<div class="ex"><div class="ex-top"><div class="ex-name">'+esc(fmtd(d))+', '+d.slice(0,4)+'</div><div class="swapped">'+esc(since)+'</div></div><div class="thumbs">'+th+'</div>'+
      '<div class="ed-row"><button class="mini" style="flex:1" data-act="phshare" data-d="'+d+'">Share or save</button><button class="mini danger" style="flex:1" data-act="phdel" data-d="'+d+'">'+(armed==='phdel'+d?'Tap again to delete':'Delete')+'</button></div></div>';
  }).join('');
}
/* ---------- monthly check-ins ---------- */
const mkey=k=>k.slice(0,7);
const curMonth=mkey(todayKey);
const monthName=mk=>{const p=mk.split('-');return new Date(+p[0],+p[1]-1,1).toLocaleDateString('en-US',{month:'long'})};
const monthShort=mk=>{const p=mk.split('-');return new Date(+p[0],+p[1]-1,1).toLocaleDateString('en-US',{month:'short'})};
const monthAdd=(mk,n)=>{const p=mk.split('-'),d=new Date(+p[0],+p[1]-1+n,1);return d.getFullYear()+'-'+pad(d.getMonth()+1)};
const daysLeftInMonth=()=>new Date(now.getFullYear(),now.getMonth()+1,0).getDate()-now.getDate();
/* state.checks maps a month to the date of its check-in. It lives in the text backup, so the record
   of having checked in survives even though the photos themselves stay in this phone's photo store. */
function noteCheck(date){const m=mkey(date);if(!state.checks[m]||state.checks[m]<date){state.checks[m]=date;return true}return false}
function syncChecks(){
  let ch=false;PH.list.forEach(r=>{if(noteCheck(r.date))ch=true});
  if(ch)change();
  return ch;
}
function recheckMonth(m){
  const ds=checkDates().filter(d=>mkey(d)===m);
  if(ds.length)state.checks[m]=ds[ds.length-1];else delete state.checks[m];
  change();
}
const checkDue=()=>!state.checks[curMonth];
function monthStreak(){
  let m=curMonth,n=0;
  if(!state.checks[m])m=monthAdd(m,-1);
  while(state.checks[m]){n++;m=monthAdd(m,-1)}
  return n;
}
function monthLine(){
  const mn=monthName(curMonth),left=daysLeftInMonth(),has=Object.keys(state.checks).length;
  if(state.checks[curMonth])return mn+' is on the record. The camera has been appeased until '+monthName(monthAdd(curMonth,1))+' 1.';
  if(!has)return 'No photos yet. Future you is going to want receipts. Takes two minutes.';
  if(!state.checks[monthAdd(curMonth,-1)])return 'You ghosted '+monthName(monthAdd(curMonth,-1))+'. The camera noticed. '+mn+' is still open.';
  if(left<=3)return left+' '+(left===1?'day':'days')+' left in '+mn+'. The camera is tapping its foot.';
  return mn+' check-in is due. '+left+' days before the month files a complaint.';
}
function setsBetween(a,b){
  let n=0;Object.keys(state.log).forEach(k=>{if(k>a&&k<=b)n+=logSets(state.log[k])});return n;
}
function monthCardHtml(){
  const done=!!state.checks[curMonth],sk=monthStreak(),tot=Object.keys(state.checks).length;
  const ds=Object.keys(state.checks).map(m=>state.checks[m]).sort(),last=ds.length?ds[ds.length-1]:null;
  let cells='';
  for(let i=11;i>=0;i--){
    const m=monthAdd(curMonth,-i),d=state.checks[m],cls='mo'+(d?' hit':'')+(m===curMonth?' cur':'');
    const inner='<span>'+monthShort(m)+'</span><i></i>';
    cells+=d?'<button class="'+cls+'" data-act="mopen" data-d="'+d+'" aria-label="'+monthName(m)+', checked in '+fmtd(d)+'">'+inner+'</button>'
            :'<div class="'+cls+'" aria-label="'+monthName(m)+', no check-in">'+inner+'</div>';
  }
  return '<div class="mo-card'+(done?' done':' due')+'"><div class="lk-top"><div class="lk-lab">Monthly check-in · '+esc(monthName(curMonth))+'</div><div class="mo-st">'+(done?'Done':'Due')+'</div></div>'+
    '<p class="lk-q">'+esc(monthLine())+'</p>'+
    '<div class="mo-grid">'+cells+'</div>'+
    '<div class="stats"><div class="stat"><b>'+sk+'</b><span>'+(sk===1?'Month':'Months')+' in a row</span></div><div class="stat"><b>'+tot+'</b><span>Total</span></div><div class="stat"><b>'+(last?dayDiff(last,todayKey):'–')+'</b><span>Days since</span></div></div>'+
    '<button class="wide-btn'+(done?' dim':' solid')+'" data-act="camstart">'+(done?'Redo this month’s check-in':'Start '+esc(monthName(curMonth))+' check-in')+'</button>'+
    '<p class="lk-how">Front, side and back with a self-timer. Same spot, same light, same time of day. One check-in per calendar month counts, and each month is worth +'+CHECK_XP+' XP for your character. Photos never leave this phone.</p></div>';
}
function checkBannerHtml(){
  if(!checkDue()||PH.failed||(state.ckSnooze&&state.ckSnooze>todayKey))return '';
  return '<div class="banner"><b>'+esc(monthName(curMonth))+' check-in due</b><p>'+esc(monthLine())+'</p>'+
    '<button class="wide-btn" data-act="camstart">Do it now</button><button class="mini" data-act="cksnooze">Bug me in 3 days</button></div>';
}
function physHtml(){
  let h=monthCardHtml();
  const tb=state.body[todayKey]||{};
  h+='<div class="sec-t">Body numbers · today</div><div class="ex"><div class="bd-grid">'+BODY_F.map(f=>{
    const lastv=bodyLatest(f[0],todayKey);
    return '<div class="ed-f"><label for="bd-'+f[0]+'">'+f[1]+' ('+f[2]+')</label><input id="bd-'+f[0]+'" class="bd-in" data-f="'+f[0]+'" inputmode="decimal" autocomplete="off" placeholder="'+(lastv?fnum(lastv.v):'')+'" value="'+esc(tb[f[0]]||'')+'"></div>';
  }).join('')+'</div><div class="ed-note">Tape in inches, body weight in pounds. Saved under today’s date. Optional, but the tape does not lie and the mirror does.</div></div>';
  h+='<div id="bd-sum">'+bodySumHtml()+'</div>';
  h+='<div class="sec-t">Compare</div>';
  if(PH.failed)h+='<div class="empty"><b>Photos blocked</b><p>This browser is blocking photo storage, so check-ins can’t be saved here.</p></div>';
  else if(!PH.loaded)h+='<div class="ed-note">Loading photos…</div>';
  else if(!PH.list.length)h+='<div class="empty"><b>No photos yet</b><p>Do a check-in and your photos show up here. They stay on this phone.</p></div>';
  else h+='<div class="ex">'+compareHtml()+'</div><div class="sec-t">All check-ins</div>'+historyHtml()+
    '<div class="ed-note">Photos live only on this phone, not in the text backup. Use Share or save now and then so a phone problem can’t take them.</div>';
  return h;
}

/* ---------- character: drawn on this phone from your own training, no photo or scan involved ---------- */
const GEAR=[
  [2,'Wrist wraps','Purely cosmetic. Adds 40 lb to your confidence.'],
  [3,'Knee sleeves','For knees that have seen things.'],
  [5,'Lifting belt','Worn for curls. Nobody is brave enough to say anything.'],
  [7,'Red aura','Visible to gym staff. They have stopped making eye contact.'],
  [9,'Crown','Self-appointed. Uncontested.'],
  [11,'Redline glow','The needle is past the red. It lives there now.']
];
const LV_LINE=['','You exist. Bold first move.','They know your face at the front desk now.','You have opinions about cable attachments.','You own more than one shaker bottle.','Your skull is now load-bearing.',
  'Small children point. Dogs sit.','You growled at a dumbbell. It moved.','HR would like a word. HR cannot find you.','There is a health bar above your head.','Scholars dispute whether you were ever a beginner.','The needle is past the red and it is not coming back.'];
function featStats(){
  const m=allSeries();let prs=0,pump5=0,legs=0,bosses=0;
  Object.keys(m).forEach(k=>{let best=0;m[k].forEach(p=>{if(best>0&&p.v>best)prs++;if(p.v>best)best=p.v})});
  Object.keys(state.log).forEach(k=>{
    const l=state.log[k];if(!l)return;
    if(l.pump===5)pump5++;
    const pl=state.plan[parseKey(k).getDay()];
    if(pl&&/leg/i.test(pl.title)&&dayStat(k).pct>=HIT)legs++;
  });
  for(let i=0;i<=52;i++){const w=weekStat(addDays(monday,-7*i),m);if(w.setsTotal>0&&w.sets>=Math.max(1,Math.ceil(w.setsTotal*0.9)))bosses++}
  return {sets:totalSets(),months:Object.keys(state.checks).length,bosses:bosses,streak:streakInfo().best,prs:prs,pump5:pump5,legs:legs};
}
const FEATS=[
  ['Paparazzi','months',1,'Do 1 monthly check-in','Evidence now exists.'],
  ['Time-Lapse','months',3,'Do 3 monthly check-ins','Three frames. It’s basically a documentary.'],
  ['Calendar Model','months',12,'Do 12 monthly check-ins','A full year of receipts.'],
  ['Boss Slayer','bosses',1,'Slay 1 weekly boss','It had a family. You had a split.'],
  ['Serial Slayer','bosses',5,'Slay 5 weekly bosses','The bosses have a group chat about you.'],
  ['Clockwork','streak',6,'Hit 6 sessions in a row','You could set a watch by this. Nobody will.'],
  ['Problem','streak',24,'Hit 24 sessions in a row','Friends have stopped inviting you to things on gym days.'],
  ['PR Goblin','prs',10,'Set 10 personal bests','Hoards plates. Hisses at deloads.'],
  ['Sleeve Menace','pump5',5,'Log a 5/5 pump 5 times','Your shirts have filed a grievance.'],
  ['Leg Day Survivor','legs',10,'Finish 10 leg days','Stairs are a personal enemy now.'],
  ['Thousandaire','sets',1000,'Finish 1,000 lifetime sets','A thousand sets. None of them were the last one.']
];
function titleList(lv,fs){
  const out=[];
  TITLES.forEach((t,i)=>{out.push({t:t,ok:lv.n>=i+1,how:'Reach level '+(i+1),line:LV_LINE[i+1]||''})});
  FEATS.forEach(f=>{out.push({t:f[0],ok:fs[f[1]]>=f[2],how:f[3]+' ('+Math.min(fs[f[1]],f[2])+' of '+f[2]+')',line:f[4]})});
  return out;
}
/* the title on the card: the one you picked if it is still earned, otherwise your level title */
function wornTitle(lv,list){
  if(state.title&&list.some(x=>x.ok&&x.t===state.title))return state.title;
  return lv.title;
}
/* lifetime sets per muscle, from every logged day that still matches an exercise in the plan */
function lifeMuscle(){
  const out={},byId={};MUS.forEach(g=>{out[g]=0});
  Object.keys(state.plan).forEach(k=>{state.plan[k].ex.forEach(e=>{byId[e.id]=e})});
  Object.keys(state.log).forEach(k=>{
    const l=state.log[k];if(!l||l.f||!l.d)return;
    Object.keys(l.d).forEach(id=>{
      const e=byId[id];if(!e||e.nw)return;
      const c=String(l.d[id]).match(/1/g);if(!c)return;
      muscleOf((l.sw&&l.sw[id])||e.name).forEach(x=>{out[x[0]]+=c.length*x[1]});
    });
  });
  return out;
}
const DEV_FULL=1500;
function buildDev(lm,lv){
  const floor=Math.min(1,(lv.n-1)/10)*0.45,d={};
  MUS.forEach(g=>{d[g]=Math.max(floor,Math.min(1,Math.sqrt(lm[g]/DEV_FULL)))});
  return d;
}
function nameSize(name,S){return Math.max(8,Math.min(24,(2*S-18)/(Math.max(3,name.length)*0.56))).toFixed(1)}
function charSvg(o){
  const d=o.dev,cx=120,n=x=>(+x).toFixed(1),lv=o.lv;
  const S=40+13*d.shoulders+4*d.back,W=23+2*d.chest,H=27+4*d.glutes,lat=5+9*d.back,trapY=88-5*d.back;
  const yW=172,yH=192,SK='#ededed',DK='#1c1c1c';
  const arm=Math.max(d.biceps,d.triceps),ua=15+9*arm,fa=11+5*arm;
  const th=24+10*Math.max(d.quads,d.hams),cf=14+8*d.calves;
  const sn=Math.sin(28*Math.PI/180),cs=Math.cos(28*Math.PI/180);
  let back='',legs='',arms='',body='',gear='';
  if(lv>=7)back+='<circle cx="120" cy="190" r="150" fill="url(#ch-aura)"/><circle cx="120" cy="190" r="112" fill="none" stroke="#e3171f" stroke-opacity=".35" stroke-width="1.5" stroke-dasharray="3 7"/>';
  [-1,1].forEach(sd=>{
    const hx=cx+sd*H*0.55,hy=yH+2,kx=hx+sd*6,ky=262,ax=kx+sd*2,ay=328;
    legs+='<line x1="'+n(hx)+'" y1="'+hy+'" x2="'+n(kx)+'" y2="'+ky+'" stroke="'+SK+'" stroke-width="'+n(th)+'" stroke-linecap="round"/>'+
      '<line x1="'+n(kx)+'" y1="'+ky+'" x2="'+n(ax)+'" y2="'+ay+'" stroke="'+SK+'" stroke-width="'+n(cf)+'" stroke-linecap="round"/>'+
      '<ellipse cx="'+n(ax+sd*5)+'" cy="336" rx="13" ry="6" fill="'+SK+'"/>';
    /* shorts leg */
    const sx=hx+(kx-hx)*0.46,sy=hy+(ky-hy)*0.46;
    const tx=hx+(kx-hx)*0.12,ty=hy+(ky-hy)*0.12;
    legs+='<line x1="'+n(tx)+'" y1="'+n(ty)+'" x2="'+n(sx)+'" y2="'+n(sy)+'" stroke="#3a3a3a" stroke-width="'+n(th+5)+'"/>'+
      '<line x1="'+n(tx)+'" y1="'+n(ty)+'" x2="'+n(sx)+'" y2="'+n(sy-1.5)+'" stroke="'+DK+'" stroke-width="'+n(th+3)+'"/>'+
      '<line x1="'+n(tx+sd*(th/2+0.5))+'" y1="'+n(ty)+'" x2="'+n(sx+sd*(th/2+0.5))+'" y2="'+n(sy-1.5)+'" stroke="#e3171f" stroke-width="2.5"/>';
    if(lv>=3)gear+='<ellipse cx="'+n(kx)+'" cy="'+ky+'" rx="'+n((th+cf)/4+2)+'" ry="8.5" fill="'+DK+'" stroke="#e3171f" stroke-width="1.5"/>';
    const jx=cx+sd*(S+1),jy=104,ex=jx+sd*50*sn,ey=jy+50*cs,wx=jx+sd*98*sn,wy=jy+98*cs;
    arms+='<line x1="'+n(jx)+'" y1="'+jy+'" x2="'+n(ex)+'" y2="'+n(ey)+'" stroke="'+SK+'" stroke-width="'+n(ua)+'" stroke-linecap="round"/>'+
      '<line x1="'+n(ex)+'" y1="'+n(ey)+'" x2="'+n(wx)+'" y2="'+n(wy)+'" stroke="'+SK+'" stroke-width="'+n(fa)+'" stroke-linecap="round"/>'+
      '<circle cx="'+n(wx+sd*3)+'" cy="'+n(wy+7)+'" r="7.5" fill="'+SK+'"/>';
    if(lv>=2)gear+='<line x1="'+n(jx+sd*84*sn)+'" y1="'+n(jy+84*cs)+'" x2="'+n(jx+sd*96*sn)+'" y2="'+n(jy+96*cs)+'" stroke="#e3171f" stroke-width="'+n(fa+2.5)+'"/>';
    body+='<circle cx="'+n(cx+sd*(S-1))+'" cy="103" r="'+n(10+6*d.shoulders)+'" fill="'+SK+'"/>';
  });
  const torso='M'+(cx-9)+',84 L'+(cx+9)+',84 Q'+n(cx+S*0.5)+','+n(trapY)+' '+n(cx+S-2)+',96 C'+n(cx+S+lat*0.3)+',122 '+n(cx+W+lat)+',146 '+n(cx+W)+','+yW+' L'+n(cx+H)+','+yH+' L'+n(cx-H)+','+yH+' L'+n(cx-W)+','+yW+' C'+n(cx-W-lat)+',146 '+n(cx-S-lat*0.3)+',122 '+n(cx-S+2)+',96 Q'+n(cx-S*0.5)+','+n(trapY)+' '+(cx-9)+',84 Z';
  const pelvis='<path d="M'+n(cx-H)+','+(yH-3)+' L'+n(cx+H)+','+(yH-3)+' L'+n(cx+H+3)+','+(yH+18)+' L'+n(cx-H-3)+','+(yH+18)+' Z" fill="'+DK+'" stroke="#3a3a3a" stroke-width="1"/><rect x="'+n(cx-H)+'" y="'+(yH-4)+'" width="'+n(2*H)+'" height="4" rx="2" fill="#f5f5f5"/>';
  const top='<path d="'+torso+'" fill="#e3171f"/>'+
    '<path d="M'+(cx-13)+',83 Q'+cx+',104 '+(cx+13)+',83 Z" fill="'+SK+'"/>'+
    '<path d="M'+n(cx-S*0.6)+',140 Q'+cx+',149 '+n(cx+S*0.6)+',140" fill="none" stroke="#8e0c12" stroke-width="1.6" stroke-linecap="round" opacity="'+n(0.25+0.6*d.chest)+'"/>'+
    '<line x1="'+cx+'" y1="150" x2="'+cx+'" y2="'+(yW+12)+'" stroke="#8e0c12" stroke-width="1.2" opacity="'+n(0.2+0.4*d.chest)+'"/>';
  if(lv>=5)gear+='<rect x="'+n(cx-W-3)+'" y="'+(yW-5)+'" width="'+n(2*W+6)+'" height="13" rx="3" fill="#0b0b0b" stroke="#f5f5f5" stroke-width="1.5"/><rect x="'+(cx-6)+'" y="'+(yW-3)+'" width="12" height="9" rx="1.5" fill="none" stroke="#f5f5f5" stroke-width="1.5"/>';
  /* faceless head; the visor is the app icon: a red bar with a white marker, filled to this week's locked-in score */
  const sc=Math.max(0,Math.min(100,o.score)),vw=26,vx=cx-vw/2,fw=vw*sc/100;
  const head='<rect x="'+(cx-8)+'" y="74" width="16" height="14" fill="'+SK+'"/><ellipse cx="'+cx+'" cy="58" rx="17.5" ry="21.5" fill="'+SK+'"/>'+
    '<rect x="'+vx+'" y="53" width="'+vw+'" height="8" rx="4" fill="'+DK+'"/>'+(fw>0?'<rect x="'+vx+'" y="53" width="'+n(Math.max(8,fw))+'" height="8" rx="4" fill="#e3171f"/>':'')+
    '<rect x="'+n(vx+Math.max(fw,1)-1)+'" y="49.5" width="2.4" height="15" rx="1.2" fill="#fff" stroke="#000" stroke-width=".6"/>';
  if(lv>=9)gear+='<path d="M'+(cx-15)+',40 L'+(cx-16)+',25 L'+(cx-8)+',33 L'+cx+',21 L'+(cx+8)+',33 L'+(cx+16)+',25 L'+(cx+15)+',40 Z" fill="#f5f5f5" stroke="#000" stroke-width="1"/><circle cx="'+cx+'" cy="33.5" r="2.4" fill="#e3171f"/>';
  const nm='<text id="ch-nm" x="'+cx+'" y="126" text-anchor="middle" fill="#fff" font-size="'+nameSize(o.name,S)+'" font-weight="800" letter-spacing=".5" data-s="'+n(S)+'" style="font-family:var(--display)">'+esc(o.name.toUpperCase())+'</text>';
  return '<svg class="ch-svg'+(o.ghost?' ghost':'')+(lv>=11?' glow':'')+'" viewBox="0 0 240 352" role="img" aria-label="'+esc(o.name)+', level '+lv+' character">'+
    '<defs><radialGradient id="ch-aura"><stop offset="0" stop-color="#e3171f" stop-opacity=".42"/><stop offset=".6" stop-color="#e3171f" stop-opacity=".12"/><stop offset="1" stop-color="#e3171f" stop-opacity="0"/></radialGradient></defs>'+
    back+'<ellipse cx="120" cy="341" rx="62" ry="6" fill="#000" opacity=".55"/><g class="ch-fig">'+arms+legs+pelvis+top+body+head+gear+nm+'</g></svg>';
}
function charHtml(){
  const lv=levelInfo(),m=allSeries(),wk=weekStat(monday,m),fs=featStats(),list=titleList(lv,fs),worn=wornTitle(lv,list);
  const lm=lifeMuscle(),dev=buildDev(lm,lv),wm=weekMuscle(),ghost=wk.sets===0,tr=tierFor(wk.score);
  if(lv.n>state.seenLv){if(state.seenLv>0)UI.lvUp=lv.n;state.seenLv=lv.n;change()}
  let h='';
  if(UI.lvUp)h+='<div class="banner hard"><b>Level '+UI.lvUp+' · '+esc(TITLES[Math.min(UI.lvUp-1,TITLES.length-1)])+'</b><p>'+esc(LV_LINE[Math.min(UI.lvUp,LV_LINE.length-1)])+'</p></div>';
  h+='<div class="av-card">'+
    '<div class="av-over"><div class="av-lv"><span>Level</span><b>'+lv.n+'</b></div><div class="av-id"><div class="av-name" id="av-name">'+esc(state.name)+'</div><div class="av-ti">'+esc(worn)+'</div></div></div>'+
    charSvg({dev:dev,lv:lv.n,score:wk.score,name:state.name,ghost:ghost})+
    '<div class="ch-mood">'+(ghost?'Currently a ghost. One set brings them back.':'Mood: '+esc(tr[1])+' · visor shows this week’s '+wk.score+'/100')+'</div>'+
    '<div class="av-xp"><i style="width:'+lv.pct+'%"></i></div><div class="av-xt"><span>'+lv.total+' XP</span><span>'+(lv.next-lv.total)+' to level '+(lv.n+1)+'</span></div>'+
    '<div class="ed-note">'+lv.sets+' lifetime sets'+(lv.cks?' + '+lv.cks+' monthly '+(lv.cks===1?'check-in':'check-ins')+' × '+CHECK_XP:'')+'. One finished set is 1 XP.</div>'+
    '<div class="ed-f av-nm"><label for="nm-in">Name on your character</label><input id="nm-in" class="name-in" maxlength="14" autocomplete="off" value="'+esc(state.name)+'"></div>'+
    '<div class="ed-note">Drawn on this phone from your own logged sets. No photo, scan or account involved, and nothing is uploaded. Muscles you train more get bigger on the character.</div></div>';
  h+='<button class="wide-btn" data-act="chshare">Share character card</button>';
  h+='<div class="sec-t">Gear</div><div class="lk-rows gear">'+GEAR.map(g=>{
    const ok=lv.n>=g[0];
    return '<div class="'+(ok?'ok':'no')+'"><span><b>'+esc(g[1])+'</b><em>'+esc(ok?g[2]:'Unlocks at level '+g[0])+'</em></span><b>'+(ok?'On':'Lv '+g[0])+'</b></div>';
  }).join('')+'</div>';
  const got=list.filter(x=>x.ok).length;
  h+='<div class="sec-t">Titles · '+got+' of '+list.length+' earned</div><div class="ed-note">Tap an earned title to wear it. Your level title is the default.</div><div class="ti-list">'+list.map(x=>{
    if(!x.ok)return '<div class="ti no"><b>'+esc(x.t)+'</b><span>'+esc(x.how)+'</span></div>';
    const on=x.t===worn;
    return '<button class="ti'+(on?' on':'')+'" data-act="titlepick" data-t="'+esc(x.t)+'" aria-pressed="'+on+'"><b>'+esc(x.t)+(on?' · wearing':'')+'</b><span>'+esc(x.line)+'</span></button>';
  }).join('')+'</div>';
  h+='<div class="sec-t">Build · lifetime sets by muscle</div><div class="mus">'+MUS.map(g=>
    '<div class="mrow"><span>'+MUS_L[g]+'</span><div class="mb"><i style="width:'+Math.round(dev[g]*100)+'%"></i></div><b>'+fnum(lm[g])+'</b></div>'
  ).join('')+'</div><div class="ed-note">The character’s proportions follow these bars. A muscle maxes out around '+DEV_FULL+' sets, so this takes a while. Good.</div>';
  h+='<div class="sec-t">This week by muscle</div><div class="mus">'+MUS.map(g=>{
    const x=wm[g],p=x.plan?Math.min(100,Math.round(x.done*100/x.plan)):0;
    return '<div class="mrow"><span>'+MUS_L[g]+'</span><div class="mb"><i style="width:'+p+'%"></i></div><b>'+fnum(x.done)+' / '+fnum(x.plan)+'</b></div>';
  }).join('')+'</div>';
  return h;
}
function shareChar(){
  const lv=levelInfo(),list=titleList(lv,featStats()),sk=streakInfo();
  const text='REDLINE · '+state.name.toUpperCase()+' · LEVEL '+lv.n+' '+wornTitle(lv,list).toUpperCase()+'\n'+lv.sets+' lifetime sets · '+lv.cks+' monthly check-in'+(lv.cks===1?'':'s')+' · best streak '+sk.best+'\n"'+(LV_LINE[Math.min(lv.n,LV_LINE.length-1)])+'"';
  try{
    if(navigator.share){navigator.share({text:text}).catch(()=>{});return}
    if(navigator.clipboard&&navigator.clipboard.writeText){navigator.clipboard.writeText(text).then(()=>flash('Copied. Paste it somewhere it will cause concern.'),()=>flash('Could not copy.'));return}
  }catch(e){}
  flash('Sharing is blocked in this browser.');
}
function sharePhotos(d){
  const files=POSES.map(p=>photoRec(d,p)).filter(Boolean).map(r=>new File([r.blob],'redline-'+r.date+'-'+r.pose+'.jpg',{type:'image/jpeg'}));
  try{
    if(files.length&&navigator.canShare&&navigator.canShare({files:files})){navigator.share({files:files,title:'Redline check-in '+d}).catch(()=>{});return}
  }catch(e){}
  flash('Sharing isn’t supported here. Tap a photo, then press and hold it to save.');
}
function viewPhoto(k){
  const r=PH.list.find(x=>x.k===k);if(!r)return;
  const v=$('#viewer');v.innerHTML='<button class="v-x" data-act="vclose" aria-label="Close photo">Close</button><img alt="'+POSE_L[r.pose]+' photo from '+esc(fmtd(r.date))+'" src="'+photoUrl(r)+'"><div class="v-cap">'+esc(fmtd(r.date))+' · '+POSE_L[r.pose]+'</div>';
  v.classList.add('on');
}

/* camera check-in */
const GUIDE='<svg class="cam-guide" viewBox="0 0 100 150" preserveAspectRatio="xMidYMid meet" aria-hidden="true"><g fill="none" stroke="#fff" stroke-opacity=".5" stroke-width=".7" stroke-dasharray="2 1.6"><circle cx="50" cy="17" r="7"/><path d="M33 31 L67 31 L61 80 L39 80 Z"/><path d="M33 31 L22 72 M67 31 L78 72"/><path d="M42 80 L40 142 M58 80 L60 142"/></g></svg>';
function camShell(){
  $('#cam').innerHTML=
    '<div class="cam-top"><button class="cam-btn" data-act="camx">Close</button><div class="cam-t" id="cam-t"></div><button class="cam-btn" data-act="camflip" id="cam-flip">Flip</button></div>'+
    '<div class="cam-stage"><video id="cam-v" playsinline muted autoplay></video><img id="cam-r" alt="Photo preview">'+GUIDE+'<div class="cam-count" id="cam-c"></div><div class="cam-msg" id="cam-m"></div></div>'+
    '<div class="cam-hint" id="cam-h"></div>'+
    '<div class="cam-bot" id="cam-live"><div class="cam-timers" id="cam-tm"></div><button class="shutter" id="cam-s" data-act="camshot" aria-label="Take photo"></button><div class="cam-side"><button class="cam-btn" data-act="camlib">Library</button><button class="cam-btn" data-act="camskip">Skip pose</button></div></div>'+
    '<div class="cam-bot rv" id="cam-rv"><button class="cam-btn big" data-act="camretake">Retake</button><button class="cam-btn big red" data-act="camkeep" id="cam-keep">Keep</button></div>'+
    '<input type="file" id="cam-f" accept="image/*" hidden>';
  $('#cam').classList.add('on');
}
function camUpdate(){
  const pose=POSES[CAM.step]||'front',rv=!!CAM.review;
  const g=id=>document.getElementById(id);if(!g('cam-t'))return;
  g('cam-t').textContent=(CAM.step+1)+' of 3 · '+POSE_L[pose];
  g('cam-h').textContent=CAM.err||POSE_HINT[pose];
  g('cam-h').className='cam-hint'+(CAM.err?' err':'');
  const v=g('cam-v');
  v.className=CAM.facing==='user'?'mir':'';
  v.style.display=rv?'none':'block';
  if(CAM.stream&&v.srcObject!==CAM.stream){v.srcObject=CAM.stream;const p=v.play();if(p&&p.catch)p.catch(()=>{})}
  const im=g('cam-r');im.style.display=rv?'block':'none';if(rv&&im.src!==CAM.review.url)im.src=CAM.review.url;
  g('cam-live').style.display=rv?'none':'flex';g('cam-rv').style.display=rv?'flex':'none';
  g('cam-tm').innerHTML=[0,5,10].map(n=>'<button class="cam-chip'+(CAM.timer===n?' on':'')+'" data-act="camtimer" data-n="'+n+'" aria-pressed="'+(CAM.timer===n)+'">'+(n?n+'s':'Off')+'</button>').join('');
  g('cam-c').textContent=CAM.count>0?String(CAM.count):'';
  g('cam-s').className='shutter'+(CAM.cd?' on':'');
  g('cam-s').setAttribute('aria-label',CAM.cd?'Cancel countdown':'Take photo');
  g('cam-keep').textContent=CAM.saving?'Saving…':(CAM.step>=2?'Save check-in':'Keep');
  g('cam-m').textContent=(!CAM.stream&&!rv)?'Starting camera…':'';
  g('cam-flip').style.visibility=CAM.stream?'visible':'hidden';
}
function camStop(){
  if(CAM.cd){clearInterval(CAM.cd);CAM.cd=null}CAM.count=0;
  if(CAM.stream){CAM.stream.getTracks().forEach(t=>t.stop());CAM.stream=null}
}
function camStart(){
  camStop();
  if(!navigator.mediaDevices||!navigator.mediaDevices.getUserMedia){CAM.err='This browser can’t open the camera. Use Library to pick a photo.';camUpdate();return}
  navigator.mediaDevices.getUserMedia({video:{facingMode:CAM.facing,width:{ideal:1080},height:{ideal:1440}},audio:false}).then(s=>{
    if(!CAM.on){s.getTracks().forEach(t=>t.stop());return}
    CAM.stream=s;CAM.err='';camUpdate();
  }).catch(()=>{CAM.err='Camera is blocked. Allow it in Settings, or use Library to pick a photo.';camUpdate()});
}
function camOpen(){
  CAM.on=true;CAM.step=0;CAM.shots={};CAM.review=null;CAM.err='';CAM.saving=false;
  camShell();camUpdate();camStart();
}
function camClose(){
  CAM.on=false;camStop();
  if(CAM.review){try{URL.revokeObjectURL(CAM.review.url)}catch(e){}CAM.review=null}
  const c=$('#cam');c.classList.remove('on');c.innerHTML='';
}
function tickBeep(f){
  ensureAudio();if(!ac)return;
  try{const t0=ac.currentTime,os=ac.createOscillator(),g=ac.createGain();os.type='sine';os.frequency.value=f;
    g.gain.setValueAtTime(.0001,t0);g.gain.exponentialRampToValueAtTime(.4,t0+.01);g.gain.exponentialRampToValueAtTime(.0001,t0+.15);
    os.connect(g);g.connect(ac.destination);os.start(t0);os.stop(t0+.16)}catch(e){}
}
function reviewFromCanvas(cv){
  cv.toBlob(b=>{
    if(!b){CAM.err='Could not capture the photo. Try again.';camUpdate();return}
    CAM.review={blob:b,url:URL.createObjectURL(b),w:cv.width,h:cv.height};camUpdate();
  },'image/jpeg',.85);
}
function drawScaled(src,sw,sh,mirror){
  const sc=Math.min(1,1280/Math.max(sw,sh)),w=Math.round(sw*sc),h=Math.round(sh*sc);
  const cv=document.createElement('canvas');cv.width=w;cv.height=h;
  const cx=cv.getContext('2d');
  if(mirror){cx.translate(w,0);cx.scale(-1,1)}
  cx.drawImage(src,0,0,w,h);return cv;
}
function camSnap(){
  const v=document.getElementById('cam-v');
  if(!v||!v.videoWidth){CAM.err='Camera isn’t ready yet. Try again in a moment.';camUpdate();return}
  reviewFromCanvas(drawScaled(v,v.videoWidth,v.videoHeight,CAM.facing==='user'));
}
function camShot(){
  if(CAM.cd){clearInterval(CAM.cd);CAM.cd=null;CAM.count=0;camUpdate();return}
  if(!CAM.stream)return;
  ensureAudio();
  if(CAM.timer<=0){camSnap();return}
  CAM.count=CAM.timer;camUpdate();
  CAM.cd=setInterval(()=>{
    CAM.count--;
    if(CAM.count>0&&CAM.count<=3)tickBeep(660);
    if(CAM.count<=0){clearInterval(CAM.cd);CAM.cd=null;tickBeep(1000);camSnap()}
    camUpdate();
  },1000);
}
function camFromFile(f){
  if(!f)return;
  const done=src=>{reviewFromCanvas(drawScaled(src,src.width,src.height,false))};
  const fallback=()=>{
    const u=URL.createObjectURL(f),im=new Image();
    im.onload=()=>{done(im);URL.revokeObjectURL(u)};
    im.onerror=()=>{CAM.err='That file couldn’t be opened as a photo.';camUpdate()};im.src=u;
  };
  if(window.createImageBitmap){createImageBitmap(f,{imageOrientation:'from-image'}).then(done,fallback)}else fallback();
}
function camKeep(){
  if(!CAM.review||CAM.saving)return;
  const pose=POSES[CAM.step];
  CAM.shots[pose]={blob:CAM.review.blob,w:CAM.review.w,h:CAM.review.h};
  try{URL.revokeObjectURL(CAM.review.url)}catch(e){}CAM.review=null;
  if(CAM.step>=2){camFinish();return}
  CAM.step++;camUpdate();
}
function camFinish(){
  const poses=Object.keys(CAM.shots);
  if(!poses.length){camClose();return}
  CAM.saving=true;camUpdate();
  poses.reduce((p,pose)=>p.then(()=>savePhoto(todayKey,pose,CAM.shots[pose].blob,CAM.shots[pose].w,CAM.shots[pose].h)),Promise.resolve()).then(()=>{
    noteCheck(todayKey);state.ckSnooze='';change();camClose();renderAll();flash(monthName(curMonth)+' check-in saved on this phone. +'+CHECK_XP+' XP.');
  }).catch(()=>{CAM.saving=false;CAM.err='Could not save. Photo storage may be blocked in this browser.';camUpdate()});
}
function camSkip(){
  if(CAM.step>=2){camFinish();return}
  CAM.step++;camUpdate();
}


/* ---------- rendering ---------- */
function renderHead(){
  const sb=(v,l,x)=>'<button class="'+(view===v?'on':'')+(x||'')+'" data-act="view" data-v="'+v+'" aria-pressed="'+(view===v)+'">'+l+'</button>';
  const seg='<div class="seg">'+sb('work','Workout')+sb('prog','Progress')+sb('lock','Locked in')+sb('phys','Check-in',checkDue()?' due':'')+sb('char','Character')+'</div>';
  let h='<div class="top-row">'+seg+(view==='work'&&editMode?'<button class="edit-btn on" data-act="edit" aria-pressed="true">Done</button>':'')+'</div>';
  if(view==='work'){
    const tabs=TAB_DOW.map((dow,i)=>{
      const s=stats(i),d=tabDate(i),cls=['tab'];
      if(i===sel)cls.push('sel');
      if(dkey(d)===todayKey)cls.push('today');
      if(s.pct===100)cls.push('full');
      return '<button class="'+cls.join(' ')+'" data-act="tab" data-i="'+i+'" aria-pressed="'+(i===sel)+'" aria-label="'+LONG[dow]+' the '+d.getDate()+', '+s.pct+' percent done"><span class="l">'+TAB_L[i]+'</span><span class="n">'+d.getDate()+'</span><span class="m" style="width:'+s.pct+'%"></span></button>';
    }).join('');
    const s=stats(sel),plan=state.plan[s.dow];
    const wkTxt=isDeload(s.key)?'Deload week':'Week '+blockWeek(s.key)+' of '+state.blockLen;
    h+='<div class="tabs">'+tabs+'</div>'+
      '<div class="p-top"><div class="p-title">'+esc(plan.title)+'</div><div class="p-pct" id="pp">'+s.pct+'%</div></div>'+
      '<div class="bar"><i id="pb" style="width:'+s.pct+'%"></i></div>'+
      '<div class="p-sub"><span id="pc">'+s.d+' of '+s.t+' sets'+(s.pct===100?' · day complete':'')+'</span><span>'+wkTxt+' · '+LONG[s.dow].slice(0,3)+' '+fmtd(s.key)+'</span></div>'+
      '<div id="clk" class="clock"></div>';
  }
  $('#hd').innerHTML=h;
  renderClock();
}
function swapPanel(e,key){
  const nm=effName(key,e),swapped=nm!==e.name;
  let chips='';
  if(swapped)chips+='<button class="chip red" data-act="swapto" data-id="'+esc(e.id)+'" data-n="'+esc(e.name)+'">Back to '+esc(e.name)+'</button>';
  alternates(nm).filter(a=>nk(a)!==nk(e.name)).forEach(a=>{chips+='<button class="chip" data-act="swapto" data-id="'+esc(e.id)+'" data-n="'+esc(a)+'">'+esc(a)+'</button>'});
  return '<div class="panel"><div class="lab">Swap for today only</div>'+(chips?'<div class="chips">'+chips+'</div>':'')+
    '<div class="swap-row"><input id="sw-'+esc(e.id)+'" data-id="'+esc(e.id)+'" placeholder="Or type another exercise" aria-label="Another exercise"><button class="mini" data-act="swapcustom" data-id="'+esc(e.id)+'">Use</button></div></div>';
}
function cardHtml(e,key){
  const nm=effName(key,e),k=nk(nm),done=getDone(key,e),full=done.every(Boolean),id=esc(e.id);
  const swapped=nm!==e.name,l=state.log[key];
  let sets;
  if(e.nw&&e.sets===1){
    sets='<button class="set wide'+(done[0]?' on':'')+'" data-act="set" data-id="'+id+'" data-i="0" aria-pressed="'+done[0]+'">'+(done[0]?'Done ✓':'Mark done')+'</button>';
  }else{
    sets=done.map((v,i)=>'<button class="set'+(v?' on':'')+'" data-act="set" data-id="'+id+'" data-i="'+i+'" aria-pressed="'+v+'" aria-label="Set '+(i+1)+'">'+(v?'✓':(i+1))+'</button>').join('');
  }
  let q='';
  if(!e.nw&&full){
    const t=l&&l.t&&l.t[k];
    q='<div class="q"><span>Hit all '+esc(topReps(e.reps))+' reps on every set?</span><button class="chip'+(t===1?' red':'')+'" data-act="th" data-id="'+id+'" data-v="1" aria-pressed="'+(t===1)+'">Yes</button><button class="chip'+(t===0?' red':'')+'" data-act="th" data-id="'+id+'" data-v="0" aria-pressed="'+(t===0)+'">Not yet</button></div>';
  }
  let bot='',tools='',panel='',prev='';
  if(!e.nw){
    const w=getW(key,nm),sg=suggest(key,nm);
    bot+='<label class="wt"><input class="wt-in" inputmode="decimal" autocomplete="off" data-id="'+id+'" value="'+esc(w)+'" placeholder="'+(sg?esc(sg.v):'0')+'" aria-label="Weight in pounds for '+esc(nm)+'"><span>lbs</span></label>';
    if(sg){
      bot+='<button class="last" data-act="fill" data-id="'+id+'" data-v="'+esc(sg.last.w)+'">Last '+esc(sg.last.w)+' · '+fmtd(sg.last.d)+'</button>';
      if(sg.kind==='up')bot+='<button class="sug" data-act="fill" data-id="'+id+'" data-v="'+esc(sg.v)+'" aria-label="Try '+esc(sg.v)+' pounds">Try '+esc(sg.v)+' ↑</button>';
      if(sg.kind==='dl')bot+='<button class="sug dl" data-act="fill" data-id="'+id+'" data-v="'+esc(sg.v)+'">Deload '+esc(sg.v)+'</button>';
    }
    const note=state.notes[k]||'';
    tools='<div class="ex-tools"><button class="tool'+(UI['swap:'+e.id]?' on':'')+'" data-act="swap" data-id="'+id+'" aria-expanded="'+!!UI['swap:'+e.id]+'">Swap</button>'+
      '<button class="tool'+(UI['note:'+e.id]?' on':'')+'" data-act="note" data-id="'+id+'" aria-expanded="'+!!UI['note:'+e.id]+'">Note'+(note?' ✎':'')+'</button>'+
      (e.rest>0?'<button class="rest-btn" data-act="rest" data-id="'+id+'">Rest '+fmt(e.rest)+'</button>':'')+'</div>';
    if(UI['swap:'+e.id])panel+=swapPanel(e,key);
    if(UI['note:'+e.id])panel+='<div class="panel"><div class="lab">Note for this exercise</div><textarea class="note-in" id="nt-'+id+'" data-k="'+esc(k)+'" placeholder="Seat 4, elbows in, pause at the top" aria-label="Note for '+esc(nm)+'">'+esc(note)+'</textarea></div>';
    else if(note)prev='<div class="note-prev">'+esc(note.length>140?note.slice(0,140)+'…':note)+'</div>';
  }else if(e.rest>0){
    tools='<div class="ex-tools"><button class="rest-btn" data-act="rest" data-id="'+id+'">Rest '+fmt(e.rest)+'</button></div>';
  }
  return '<div class="ex'+(full?' complete':'')+'" data-id="'+id+'"><div class="ex-top"><div style="min-width:0"><div class="ex-name'+(isArm(nm)?' arm':'')+'">'+esc(nm)+'</div>'+(swapped?'<div class="swapped">Swapped from '+esc(e.name)+'</div>':'')+'</div><div class="ex-target">'+(e.nw?esc(e.reps):done.length+' x '+esc(e.reps))+'</div></div><div class="sets">'+sets+'</div>'+q+(bot?'<div class="ex-bot">'+bot+'</div>':'')+prev+tools+panel+'</div>';
}
function rerenderCard(id){
  const e=exById(id);if(!e)return;
  const el=document.querySelector('.ex[data-id="'+id+'"]');if(!el)return;
  el.outerHTML=cardHtml(e,curKey());
}
function bannerHtml(){
  const wk=blockWeek(todayKey),L=state.blockLen;
  if(wk>L)return '<div class="banner hard"><b>Deload week</b><p>Do about half the sets and go 10-20% lighter. While this is on, the app halves your sets and suggests lighter weights. When the week is over, start a new block.</p><button class="wide-btn" data-act="newblock">Deload done · start new block</button></div>';
  if(wk===L)return '<div class="banner"><b>Last hard week</b><p>Week '+wk+' of '+L+'. Your deload week starts next week.</p></div>';
  return '';
}
function isStandalone(){return (window.navigator.standalone===true)||(window.matchMedia&&window.matchMedia('(display-mode: standalone)').matches)}
function hintHtml(){
  let seen=false;try{seen=localStorage.getItem(HINT_KEY)==='1'}catch(e){}
  if(seen||isStandalone()||!/iphone|ipad|ipod/i.test(navigator.userAgent))return '';
  return '<div class="hint"><span>To install: tap <b>Share</b>, then <b>Add to Home Screen</b>.</span><button class="mini" data-act="hintx">Got it</button></div>';
}
function editHtml(plan){
  const items=plan.ex.map((e,i)=>
    '<div class="ex">'+
      '<div class="ed-f"><label for="n'+i+'">Exercise</label><input id="n'+i+'" class="ed" data-f="name" data-i="'+i+'" value="'+esc(e.name)+'"></div>'+
      '<div class="ed-row">'+
        '<div class="ed-f" style="flex:1 1 70px"><label for="s'+i+'">Sets</label><input id="s'+i+'" class="ed" data-f="sets" data-i="'+i+'" inputmode="numeric" value="'+e.sets+'"></div>'+
        '<div class="ed-f" style="flex:2 1 110px"><label for="r'+i+'">Reps</label><input id="r'+i+'" class="ed" data-f="reps" data-i="'+i+'" value="'+esc(e.reps)+'"></div>'+
        '<div class="ed-f" style="flex:1 1 90px"><label for="t'+i+'">Rest (sec)</label><input id="t'+i+'" class="ed" data-f="rest" data-i="'+i+'" inputmode="numeric" value="'+e.rest+'"></div>'+
      '</div>'+
      '<div class="ed-btns"><button class="mini" data-act="up" data-i="'+i+'" aria-label="Move up">↑</button><button class="mini" data-act="down" data-i="'+i+'" aria-label="Move down">↓</button><button class="mini danger" data-act="del" data-i="'+i+'" style="margin-left:auto">'+(armed==='del'+e.id?'Tap again to delete':'Delete')+'</button></div>'+
    '</div>').join('');
  const blk='<div class="ex"><div class="lab">Deload every</div><div class="chips">'+
    [6,7,8].map(n=>'<button class="chip'+(state.blockLen===n?' red':'')+'" data-act="blen" data-n="'+n+'" aria-pressed="'+(state.blockLen===n)+'">'+n+' weeks</button>').join('')+
    '</div><div class="ed-note">This block started '+fmtd(state.block.start)+'. It is week '+blockWeek(todayKey)+'.</div>'+
    '<button class="wide-btn dim" data-act="startblock">'+(armed==='block'?'Tap again to restart the block':'Start a new block today')+'</button></div>';
  const tgt='<div class="ex"><div class="lab">Session target</div><div class="chips">'+
    [60,75,90].map(n=>'<button class="chip'+(state.target===n?' red':'')+'" data-act="tgt" data-n="'+n+'" aria-pressed="'+(state.target===n)+'">'+n+' min</button>').join('')+
    '</div><div class="ed-note">The session clock turns red past this. It starts at your first set and stops at 100% or after 45 minutes with nothing logged.</div></div>';
  const np=state.planVer<2?'<button class="wide-btn dim" data-act="plan2">'+(armed==='plan2'?'Tap again to replace my plan':'Load the new v1.2 plan')+'</button>':'';
  const bk='<div class="ex"><div class="lab">Backup</div><div class="ed-note">Your workouts live only on this phone. Photos are stored separately, so they aren’t in this text backup (use Share or save in Physique). Copy a backup now and then and paste it into Notes. To move to a new phone, paste it back here.</div>'+
    '<div class="ed-row"><button class="mini" style="flex:1" data-act="bkcopy">Copy backup</button>'+(navigator.share?'<button class="mini" style="flex:1" data-act="bkshare">Share backup</button>':'')+'</div>'+
    '<textarea class="bk-in" id="bk-in" placeholder="Paste a backup here to restore it" aria-label="Paste a backup to restore">'+esc(bkText)+'</textarea>'+
    '<button class="wide-btn dim" data-act="bkrestore">'+(armed==='restore'?'Tap again to replace everything on this phone':'Restore from pasted backup')+'</button></div>';
  return '<div class="ed-note">Editing this day. Changes save as you type. Weights are saved by exercise name, so renaming an exercise starts its history over.</div>'+blk+tgt+np+
    '<div class="ex"><div class="ed-f"><label for="ttl">Day name</label><input id="ttl" class="ed" data-f="title" value="'+esc(plan.title)+'"></div></div>'+
    items+
    '<button class="wide-btn" data-act="add">+ Add exercise</button>'+
    '<button class="wide-btn dim" data-act="reset">'+(armed==='reset'?'Tap again to restore':'Restore original plan for this day')+'</button>'+bk;
}
function renderList(){
  if(view==='phys'){$('#list').innerHTML=physHtml();return}
  if(view==='char'){$('#list').innerHTML=charHtml();return}
  if(view==='prog'){$('#list').innerHTML=progressHtml();return}
  if(view==='lock'){$('#list').innerHTML=lockHtml();return}
  const s=stats(sel),plan=state.plan[s.dow];
  $('#list').innerHTML=editMode?editHtml(plan):hintHtml()+planBannerHtml()+checkBannerHtml()+bannerHtml()+plan.ex.map(e=>cardHtml(e,s.key)).join('')+pumpHtml(s.key);
}
function renderFoot(){
  $('#ft').innerHTML=(editMode||view!=='work'?'':'<button class="wide-btn dim" data-act="edit">Edit this day</button><button class="wide-btn dim" data-act="clear">'+(armed==='clear'?'Tap again to clear':'Clear this day’s sets')+'</button>')+'<div class="status" id="status">'+statusText()+'</div>';
}
function renderAll(){renderHead();renderList();renderFoot()}
function arm(k){armed=k;clearTimeout(armT);armT=setTimeout(()=>{armed=null;renderList();renderFoot()},3000);renderList();renderFoot()}

/* ---------- audio, wake lock ---------- */
let ac=null;
function ensureAudio(){try{if(!ac){const C=window.AudioContext||window.webkitAudioContext;if(C)ac=new C()}if(ac&&ac.state==='suspended')ac.resume()}catch(e){}}
function beep(){
  ensureAudio();
  if(ac){
    const t0=ac.currentTime;
    [0,0.28,0.56].forEach((o,i)=>{
      const os=ac.createOscillator(),g=ac.createGain();
      os.type='sine';os.frequency.value=i===2?1175:880;
      g.gain.setValueAtTime(0.0001,t0+o);
      g.gain.exponentialRampToValueAtTime(0.5,t0+o+0.02);
      g.gain.exponentialRampToValueAtTime(0.0001,t0+o+0.22);
      os.connect(g);g.connect(ac.destination);os.start(t0+o);os.stop(t0+o+0.24);
    });
  }
  try{if(navigator.vibrate)navigator.vibrate([250,100,250,100,400])}catch(e){}
}
let wl=null;
function wake(){try{if(navigator.wakeLock&&!wl){navigator.wakeLock.request('screen').then(l=>{wl=l;l.addEventListener('release',()=>{wl=null})},()=>{})}}catch(e){}}

/* ---------- rest timer ---------- */
const T={state:'idle',end:0,total:0,label:'',iv:null,goT:null};
const PRESETS=[60,90,120,150,180];
function startTimer(sec,label){
  clearTimeout(T.goT);
  T.state='run';T.total=sec;T.end=Date.now()+sec*1000;T.label=label||'';
  renderTimer();
  if(!T.iv)T.iv=setInterval(tick,250);
  wake();
}
function tick(){
  if(T.state!=='run')return;
  const left=(T.end-Date.now())/1000;
  if(left<=0){finishTimer();return}
  const tt=$('#tt');if(tt)tt.textContent=fmt(Math.ceil(left));
  const tf=$('#tf');if(tf)tf.style.width=Math.min(100,100-left*100/T.total)+'%';
}
function finishTimer(){
  T.state='go';clearInterval(T.iv);T.iv=null;renderTimer();beep();
  T.goT=setTimeout(()=>{if(T.state==='go'){T.state='idle';renderTimer()}},10000);
}
function stopTimer(){clearTimeout(T.goT);clearInterval(T.iv);T.iv=null;T.state='idle';renderTimer()}
function renderTimer(){
  const bar=$('#tbar');let h='';
  bar.className=T.state==='go'?'go':'';
  if(T.state==='run'){
    const left=Math.max(0,(T.end-Date.now())/1000);
    h='<div class="t-fill" id="tf" style="width:'+Math.min(100,100-left*100/T.total)+'%"></div>'+
      '<div class="in"><div class="t-row"><div style="min-width:0"><div class="t-label">Rest · '+esc(T.label||'timer')+'</div><div class="t-time" id="tt">'+fmt(Math.ceil(left))+'</div></div>'+
      '<div class="t-btns"><button class="t-btn" data-act="tminus">−15</button><button class="t-btn" data-act="tplus">+15</button><button class="t-btn red" data-act="tstop">Skip</button></div></div></div>';
  }else if(T.state==='go'){
    h='<div class="in"><div class="t-row"><div><div class="t-label">Rest over</div><div class="t-time">GO</div></div><button class="t-btn" data-act="tstop">Dismiss</button></div></div>';
  }else{
    h='<div class="in"><div class="t-row"><div class="t-label">Rest timer</div><button class="auto'+(state.auto?' on':'')+'" data-act="auto" aria-pressed="'+state.auto+'">Auto-start '+(state.auto?'on':'off')+'</button></div>'+
      '<div class="presets">'+PRESETS.map(s=>'<button data-act="preset" data-s="'+s+'">'+fmt(s)+'</button>').join('')+'</div></div>';
  }
  bar.innerHTML=h;
}

/* ---------- backup ---------- */
function backupText(){return JSON.stringify(state)}
function copyBackup(){
  const text=backupText();
  const fallback=()=>{
    bkText=text;renderList();
    const t=document.getElementById('bk-in');if(t){t.focus();t.select()}
    flash('Backup is in the box. Select all, copy, and paste it into Notes.');
  };
  try{
    if(navigator.clipboard&&navigator.clipboard.writeText){
      navigator.clipboard.writeText(text).then(()=>flash('Backup copied. Paste it into Notes.'),fallback);
    }else fallback();
  }catch(e){fallback()}
}
function restoreBackup(){
  let obj=null;
  try{obj=JSON.parse(bkText.trim())}catch(e){}
  if(!obj||typeof obj!=='object'||!obj.plan||!obj.log){flash('That does not look like a Redline backup.');armed=null;return}
  if(armed!=='restore'){arm('restore');return}
  armed=null;
  state=migrate(obj);state.rev=Date.now();localSave();bkText='';
  editMode=false;renderAll();window.scrollTo(0,0);flash('Backup restored.');
}

/* ---------- events ---------- */
function setWeight(key,name,v){
  const l=dayLog(key,true),k=nk(name);
  if(v){l.w[k]=v;state.names[k]=name}else delete l.w[k];
}
document.addEventListener('click',ev=>{
  const b=ev.target.closest('[data-act]');if(!b)return;
  const a=b.dataset.act,i=+b.dataset.i,id=b.dataset.id;
  let e,key,plan,l;
  switch(a){
    case 'view':view=b.dataset.v;editMode=false;armed=null;UI.lvUp=0;renderAll();window.scrollTo(0,0);break;
    case 'lkshare':shareLock();break;
    case 'chshare':shareChar();break;
    case 'titlepick':state.title=b.dataset.t;change();renderList();break;
    case 'cksnooze':state.ckSnooze=dkey(addDays(now,3));change();renderList();flash('Fine. Three days. The camera will remember this.');break;
    case 'mopen':{
      const d=b.dataset.d,r=POSES.map(p=>photoRec(d,p)).filter(Boolean)[0];
      if(r)viewPhoto(r.k);else flash(PH.loaded?'That month’s photos aren’t on this phone anymore.':'Photos are still loading.');
      break;
    }
    case 'cmpq':{
      const ds=PH.list.filter(r=>r.pose===(UI.cmpPose||'front')).map(r=>r.date);
      if(ds.length>1){UI.cmpB=ds[ds.length-1];UI.cmpA=b.dataset.q==='prev'?ds[ds.length-2]:ds[0];renderList()}
      break;
    }
    case 'camstart':camOpen();break;
    case 'camx':camClose();break;
    case 'camflip':CAM.facing=CAM.facing==='user'?'environment':'user';CAM.stream=null;camUpdate();camStart();break;
    case 'camtimer':CAM.timer=+b.dataset.n;camUpdate();break;
    case 'camshot':camShot();break;
    case 'camlib':{const f=document.getElementById('cam-f');if(f){f.value='';f.click()}break}
    case 'camretake':if(CAM.review){try{URL.revokeObjectURL(CAM.review.url)}catch(x){}CAM.review=null;camUpdate()}break;
    case 'camkeep':camKeep();break;
    case 'camskip':camSkip();break;
    case 'cpose':UI.cmpPose=b.dataset.p;UI.cmpA=null;UI.cmpB=null;renderList();break;
    case 'phview':viewPhoto(b.dataset.k);break;
    case 'vclose':{const v=$('#viewer');v.classList.remove('on');v.innerHTML='';break}
    case 'phshare':sharePhotos(b.dataset.d);break;
    case 'phdel':{
      const d=b.dataset.d;
      if(armed==='phdel'+d){armed=null;delCheckin(d).then(()=>{renderList();flash('Check-in deleted.')}).catch(()=>flash('Could not delete.'))}
      else arm('phdel'+d);
      break;
    }
    case 'plan2':
      if(armed==='plan2'){armed=null;loadNewPlan();renderAll();window.scrollTo(0,0);flash('New plan loaded.')}else arm('plan2');
      break;
    case 'plan2x':state.planSkip=true;change();renderList();break;
    case 'pump':{
      key=curKey();l=dayLog(key,true);const v=+b.dataset.v;
      if(l.pump===v)delete l.pump;else l.pump=v;
      change();renderList();break;
    }
    case 'tgt':state.target=+b.dataset.n;change();renderAll();break;
    case 'psel':progSel=b.dataset.k;renderList();window.scrollTo(0,0);break;
    case 'tab':sel=i;armed=null;renderAll();window.scrollTo(0,0);break;
    case 'edit':editMode=!editMode;armed=null;renderAll();break;
    case 'hintx':try{localStorage.setItem(HINT_KEY,'1')}catch(x){}renderList();break;
    case 'set':{
      e=exById(id);if(!e)break;
      key=curKey();
      const arr=getDone(key,e),v=!arr[i];arr[i]=v;putDone(key,e,arr);
      if(!arr.every(Boolean)){l=state.log[key];if(l&&l.t)delete l.t[nk(effName(key,e))]}
      {const lf=state.log[key];if(lf&&lf.f)delete lf.f;const st0=stats(sel);touchSession(key,st0.d>0,st0.pct)}
      ensureAudio();wake();change();
      rerenderCard(id);renderHead();
      if(v&&state.auto&&e.rest>0&&key===todayKey&&stats(sel).pct<100)startTimer(e.rest,effName(key,e));
      break;
    }
    case 'th':{
      e=exById(id);if(!e)break;
      key=curKey();l=dayLog(key,true);if(!l.t)l.t={};
      l.t[nk(effName(key,e))]=+b.dataset.v;change();rerenderCard(id);
      break;
    }
    case 'fill':{
      e=exById(id);if(!e)break;
      key=curKey();setWeight(key,effName(key,e),b.dataset.v);change();rerenderCard(id);
      break;
    }
    case 'swap':UI['swap:'+id]=!UI['swap:'+id];rerenderCard(id);break;
    case 'note':{
      UI['note:'+id]=!UI['note:'+id];rerenderCard(id);
      if(UI['note:'+id]){const t=document.getElementById('nt-'+id);if(t)t.focus()}
      break;
    }
    case 'swapto':case 'swapcustom':{
      e=exById(id);if(!e)break;
      let name=a==='swapto'?b.dataset.n:(document.getElementById('sw-'+id)||{value:''}).value.trim();
      if(!name)break;
      name=name.slice(0,60);
      key=curKey();l=dayLog(key,true);if(!l.sw)l.sw={};
      if(nk(name)===nk(e.name))delete l.sw[e.id];else l.sw[e.id]=name;
      UI['swap:'+id]=false;change();rerenderCard(id);
      break;
    }
    case 'rest':e=exById(id);if(e){ensureAudio();startTimer(e.rest,effName(curKey(),e))}break;
    case 'preset':ensureAudio();startTimer(+b.dataset.s,'');break;
    case 'tplus':if(T.state==='run'){T.end+=15000;T.total+=15;tick()}break;
    case 'tminus':if(T.state==='run'){T.end-=15000;tick()}break;
    case 'tstop':stopTimer();break;
    case 'auto':state.auto=!state.auto;change();renderTimer();break;
    case 'blen':state.blockLen=+b.dataset.n;change();renderAll();break;
    case 'startblock':
      if(armed==='block'){armed=null;state.block={start:todayKey};change();renderAll()}else arm('block');
      break;
    case 'newblock':state.block={start:todayKey};change();renderAll();window.scrollTo(0,0);break;
    case 'bkcopy':copyBackup();break;
    case 'bkshare':
      try{navigator.share({title:'Redline backup',text:backupText()}).catch(()=>{})}catch(x){copyBackup()}
      break;
    case 'bkrestore':restoreBackup();break;
    case 'up':case 'down':{
      plan=state.plan[TAB_DOW[sel]];const j=a==='up'?i-1:i+1;
      if(j>=0&&j<plan.ex.length){const t=plan.ex[i];plan.ex[i]=plan.ex[j];plan.ex[j]=t;change();renderList()}
      break;
    }
    case 'del':{
      plan=state.plan[TAB_DOW[sel]];const ex=plan.ex[i];if(!ex)break;
      if(armed==='del'+ex.id){armed=null;plan.ex.splice(i,1);change();renderAll()}
      else arm('del'+ex.id);
      break;
    }
    case 'add':{
      plan=state.plan[TAB_DOW[sel]];
      plan.ex.push({id:'x'+Date.now().toString(36)+Math.floor(Math.random()*1000),name:'New exercise',sets:3,reps:'10',rest:90,nw:false});
      change();renderAll();
      const ins=document.querySelectorAll('.ed[data-f="name"]');if(ins.length){const last=ins[ins.length-1];last.focus();last.select()}
      break;
    }
    case 'reset':
      if(armed==='reset'){armed=null;const dow=TAB_DOW[sel];state.plan[dow]=defaultPlan()[dow];change();renderAll()}
      else arm('reset');
      break;
    case 'clear':
      if(armed==='clear'){armed=null;l=state.log[curKey()];if(l){l.d={};l.t={};delete l.dl;delete l.st;delete l.la;delete l.en;delete l.pump;delete l.f}change();renderAll()}
      else arm('clear');
      break;
  }
});
document.addEventListener('input',ev=>{
  const t=ev.target;if(!t.classList)return;
  if(t.classList.contains('wt-in')){
    const e=exById(t.dataset.id);if(!e)return;
    const v=t.value.replace(/[^0-9.]/g,'').slice(0,6);if(v!==t.value)t.value=v;
    const key=curKey();setWeight(key,effName(key,e),v);change();
  }else if(t.classList.contains('note-in')){
    const k=t.dataset.k,v=t.value.slice(0,500);
    if(v.trim())state.notes[k]=v;else delete state.notes[k];
    change();
  }else if(t.classList.contains('bk-in')){
    bkText=t.value;
  }else if(t.classList.contains('bd-in')){
    const f=t.dataset.f,v=t.value.replace(/[^0-9.]/g,'').slice(0,6);if(v!==t.value)t.value=v;
    const bb=dayBody(todayKey,true);
    if(v)bb[f]=v;else delete bb[f];
    if(!Object.keys(bb).length)delete state.body[todayKey];
    change();
    const el=$('#bd-sum');if(el)el.innerHTML=bodySumHtml();
  }else if(t.classList.contains('name-in')){
    state.name=t.value.slice(0,14).trim()||'Leo';change();
    const el=document.getElementById('av-name');if(el)el.textContent=state.name;
    const tx=document.getElementById('ch-nm');if(tx){tx.textContent=state.name.toUpperCase();tx.setAttribute('font-size',nameSize(state.name,+tx.dataset.s))}
  }else if(t.id==='cmp-r'){
    const el=document.getElementById('cmp');if(el)el.style.setProperty('--pos',t.value+'%');
  }
});
document.addEventListener('keydown',ev=>{
  if(ev.key==='Enter'&&ev.target.id&&ev.target.id.indexOf('sw-')===0){
    const b=ev.target.parentNode.querySelector('[data-act="swapcustom"]');if(b)b.click();
  }
});
document.addEventListener('change',ev=>{
  const t=ev.target;
  if(t.id==='cam-f'){camFromFile(t.files&&t.files[0]);return}
  if(t.id==='cmp-a'||t.id==='cmp-b'){if(t.id==='cmp-a')UI.cmpA=t.value;else UI.cmpB=t.value;renderList();return}
  if(!(t.classList&&t.classList.contains('ed')))return;
  const plan=state.plan[TAB_DOW[sel]],f=t.dataset.f,i=+t.dataset.i,v=t.value;
  if(f==='title'){plan.title=v.trim()||plan.title;renderHead()}
  else{
    const e=plan.ex[i];if(!e)return;
    if(f==='name'){e.name=v.trim()||e.name;t.value=e.name}
    else if(f==='reps'){e.reps=v.trim()||e.reps;t.value=e.reps}
    else if(f==='sets'){const n=parseInt(v,10);e.sets=isNaN(n)?e.sets:Math.max(1,Math.min(12,n));t.value=e.sets;renderHead()}
    else if(f==='rest'){const r=parseInt(v,10);e.rest=isNaN(r)?e.rest:Math.max(0,Math.min(600,r));t.value=e.rest}
  }
  change();
});
setInterval(renderClock,1000);
document.addEventListener('visibilitychange',()=>{
  if(document.visibilityState==='hidden'&&CAM.on)camStop();
  if(document.visibilityState==='visible'){
    /* opened again on a later day: reload so "today" is really today */
    if(dkey(new Date())!==todayKey&&!CAM.on){location.reload();return}
    tick();renderClock();if(T.state==='run')wake();if(CAM.on&&!CAM.review&&!CAM.stream)camStart()}
});
loadPhotos();

renderAll();
renderTimer();
localSave();
try{if(navigator.storage&&navigator.storage.persist)navigator.storage.persist().catch(()=>{})}catch(e){}
if('serviceWorker' in navigator){
  window.addEventListener('load',()=>{navigator.serviceWorker.register('./sw.js').catch(()=>{})});
}
})();
