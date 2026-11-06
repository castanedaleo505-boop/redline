/* Redline. One file, no libraries. All data stays in this phone's localStorage. */
(function(){
'use strict';
const APP_VERSION='1.1';
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
  const p={
    4:{title:'Day 1 · Shoulders + Arms (heavy)',ex:[
      X('Seated DB overhead press',4,'6-8',150),X('Lateral raise (cable or DB)',5,'12-15',60),X('Rear delt fly',4,'15',60),
      X('Barbell curl',4,'8-10',90),X('Incline DB curl',3,'10-12',75),X('Hammer curl',3,'10',60),
      X('Skull crusher / EZ bar',4,'10',90),X('Rope pushdown',3,'12',60),X('Overhead cable triceps ext.',3,'12',60),X('Cable curl pump (burnout)',2,'20',45)]},
    5:{title:'Day 2 · Chest + Back + Biceps',ex:[
      X('Flat bench press',4,'6-8',180),X('Incline DB press',3,'8-10',120),X('Cable fly',3,'12-15',75),
      X('Pull-ups (add weight at 15+)',4,'8-12',150),X('Barbell or chest-supported row',4,'8-10',120),X('Lat pulldown / cable row',3,'10-12',90),
      X('Face pulls',3,'15',60),X('Lateral raise',3,'15',60),X('Preacher curl',3,'10-12',75),X('Cable curl',2,'15',60)]},
    6:{title:'Day 3 · Legs + Calves + Arm Finisher',ex:[
      X('Squat',4,'5-6',210),X('Romanian deadlift',3,'8',150),X('Leg press',3,'10-12',120),
      X('Leg curl',3,'12',75),X('Walking lunges',2,'12 each',90),X('Standing calf raise',5,'12-15',60),
      X('Seated calf raise',3,'15-20',60),X('Lateral raise',3,'15-20',60),X('Cable curl',3,'12',60),X('Pushdown',3,'12',60)]},
    0:{title:'Off · No Gym',ex:[
      X('Long easy walk',1,'30-60 min',0,true),X('Stretch (optional)',1,'10 min',0,true)]},
    1:{title:'Day 4 · Shoulders + Arms (volume)',ex:[
      X('Machine or Arnold press',4,'8-10',120),X('Lateral raise (last set: partials)',5,'15-20',60),X('Reverse pec deck',4,'15',60),
      X('EZ bar curl',4,'10',90),X('Bayesian cable curl',3,'12',75),X('Rope hammer curl',3,'12',60),
      X('Close-grip bench',3,'8',120),X('Pushdown',3,'12-15',60),X('Overhead DB triceps ext.',3,'12',75),X('Reverse curl (forearms)',3,'12',60)]},
    2:{title:'Day 5 · Back + Chest + Biceps',ex:[
      X('Weighted pull-ups',4,'6-10',150),X('Chest-supported row',4,'10',120),X('One-arm cable row',3,'12',90),
      X('Straight-arm pulldown',3,'12',75),X('Bench press',4,'5-6',180),X('Incline cable fly',3,'12-15',75),
      X('Dips',3,'10',90),X('Rear delt fly',3,'15',60),X('Lateral raise',3,'15',60),X('Incline curl',3,'12',75),X('Hammer curl',3,'10',60)]},
    3:{title:'Day 6 · Legs + Calves + Arm Pump',ex:[
      X('Hack squat or front squat',4,'8',180),X('Leg extension',3,'12-15',75),X('Hamstring curl',3,'12',75),
      X('Bulgarian split squat',3,'10 each',120),X('Standing calf raise',5,'12-15',60),X('Calf raise (burnout)',3,'20',45),
      X('Lateral raise',4,'15-20',60),X('Superset: cable curl + pushdown',3,'15 + 15',75),X('Superset: hammer curl + OH ext.',2,'12 + 12',75)]}
  };
  Object.keys(p).forEach(k=>{p[k].ex.forEach((e,i)=>{e.id='d'+k+'_'+i})});
  return p;
}

/* ---------- swap suggestions ---------- */
const ALTS=[
  [/leg extension/i,['Sissy squat','Leg press (high reps)','Goblet squat']],
  [/leg curl|hamstring/i,['Seated leg curl','Lying leg curl','Stiff-leg deadlift','Nordic curl']],
  [/calf/i,['Seated calf raise','Standing calf raise','Leg press calf raise','Single-leg calf raise']],
  [/romanian|deadlift/i,['DB Romanian deadlift','Good morning','Back extension','Hip thrust']],
  [/squat|hack|leg press|lunge/i,['Leg press','Hack squat','Goblet squat','Smith machine squat','Walking lunges']],
  [/superset/i,[]],
  [/lateral raise/i,['DB lateral raise','Cable lateral raise','Machine lateral raise','Leaning cable lateral raise']],
  [/rear delt|reverse pec/i,['Reverse pec deck','Rear delt cable fly','Face pulls','Band pull-apart']],
  [/face pull/i,['Rear delt fly','Reverse pec deck','Band pull-apart']],
  [/close-grip/i,['Dips','Rope pushdown','Close-grip push-ups']],
  [/dips/i,['Assisted dips','Bench dips','Close-grip push-ups','Rope pushdown']],
  [/bench|chest press|incline.*press/i,['Machine chest press','DB bench press','Smith machine bench','Push-ups']],
  [/fly/i,['Pec deck','Cable fly','DB fly','Machine fly']],
  [/overhead press|arnold|shoulder press/i,['Machine shoulder press','Standing DB press','Barbell overhead press','Smith machine shoulder press']],
  [/pull-up|pulldown|chin/i,['Lat pulldown','Assisted pull-ups','Chin-ups','Neutral-grip pulldown']],
  [/row/i,['Chest-supported row','Cable row','One-arm DB row','Machine row','T-bar row']],
  [/reverse curl/i,['Reverse EZ bar curl','Wrist curl','Hammer curl']],
  [/curl/i,['EZ bar curl','Cable curl','Preacher curl','DB curl','Hammer curl','Incline DB curl']],
  [/pushdown|skull|tricep|ext/i,['Rope pushdown','Skull crushers','Overhead cable triceps ext.','Overhead DB triceps ext.','Dips']]
];
function alternates(name){
  for(const r of ALTS){if(r[0].test(name))return r[1].filter(a=>nk(a)!==nk(name)).slice(0,5)}
  return [];
}

/* ---------- state + storage ---------- */
const now=new Date();
const todayKey=dkey(now);
function freshState(){return {v:2,rev:0,plan:defaultPlan(),log:{},auto:true,notes:{},names:{},blockLen:6,block:null}}
function migrate(s){
  if(!s||typeof s!=='object')s=freshState();
  const f=freshState();
  if(!s.plan||typeof s.plan!=='object')s.plan={};
  Object.keys(f.plan).forEach(k=>{if(!s.plan[k]||!Array.isArray(s.plan[k].ex))s.plan[k]=f.plan[k]});
  if(!s.log||typeof s.log!=='object')s.log={};
  if(typeof s.auto!=='boolean')s.auto=true;
  if(!s.notes||typeof s.notes!=='object')s.notes={};
  if(!s.names||typeof s.names!=='object')s.names={};
  if([6,7,8].indexOf(s.blockLen)<0)s.blockLen=6;
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
function prune(){const c=new Date(now.getFullYear(),now.getMonth(),now.getDate()-KEEP_DAYS);const cut=dkey(c);Object.keys(state.log).forEach(k=>{if(k<cut)delete state.log[k]})}
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


/* ---------- locked in: streak, weekly score, recap ---------- */
const HIT=80;
const parseKey=k=>{const p=k.split('-');return new Date(+p[0],+p[1]-1,+p[2])};
const addDays=(d,n)=>new Date(d.getFullYear(),d.getMonth(),d.getDate()+n);
function dayStat(key){
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
function weekStat(mon){
  let t=0,d=0,wt=0,wl=0,hit=0,sess=0;const days=[],missed=[];
  for(let i=0;i<7;i++){
    const dt=addDays(mon,i),k=dkey(dt),s=dayStat(k);
    let st;
    if(s.off)st='off';
    else if(s.pct>=HIT)st='hit';
    else if(k<todayKey)st=s.d>0?'part':'miss';
    else if(k===todayKey)st=s.d>0?'part':'today';
    else st='ahead';
    if(st==='miss'||st==='part')missed.push(LONG[dt.getDay()].slice(0,3));
    days.push({k:k,l:['M','T','W','T','F','S','S'][i],st:st});
    if(!s.off){t+=s.t;d+=s.d;wt+=s.wt;wl+=s.wl;if(s.pct>=HIT)hit++;if(s.d>0)sess++}
  }
  const score=Math.round(100*(0.7*(t?d/t:0)+0.3*(wt?wl/wt:0)));
  const m=allSeries(),from=days[0].k,to=days[6].k;let prs=0;
  Object.keys(m).forEach(k=>{let best=0;m[k].forEach(p=>{if(best>0&&p.v>best&&p.d>=from&&p.d<=to)prs++;if(p.v>best)best=p.v})});
  const planned=days.filter(x=>x.st!=='off').length;
  return {score:score,sets:d,setsTotal:t,hit:hit,planned:planned,sess:sess,wl:wl,wt:wt,prs:prs,days:days,missed:missed,from:from};
}
function streakInfo(){
  const ks=Object.keys(state.log).filter(k=>{const l=state.log[k];return l&&l.d&&Object.keys(l.d).some(id=>/1/.test(l.d[id]))}).sort();
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
  const wk=weekStat(monday),lw=weekStat(addDays(monday,-7)),sk=streakInfo(),tr=tierFor(wk.score);
  const lastHas=lw.sets>0;
  const diff=lastHas?wk.score-lw.score:null;
  const cls=wk.score>=90?' hot':(wk.score>=75?' warm':'');
  const ticks=[25,50,75,90].map(x=>'<u style="left:'+x+'%"></u>').join('');
  let h='<div class="lk-card'+cls+'"><div class="lk-top"><div class="lk-lab">Locked-in meter · this week</div>'+
    '<div class="lk-score" id="lk-score">'+wk.score+'</div></div>'+
    '<div class="lk-bar" role="img" aria-label="Locked in score '+wk.score+' out of 100"><i style="width:'+wk.score+'%"></i>'+ticks+'</div>'+
    '<div class="lk-tier">'+esc(tr[1])+'</div><p class="lk-q">'+esc(tr[2])+'</p>'+
    '<p class="lk-how">Score = 70% sets finished + 30% lifts with a weight logged. Full week resets Monday.</p></div>';
  h+='<div class="lk-streak"><div class="lk-flame" aria-hidden="true">🔥</div><div class="lk-sn"><b>'+sk.cur+'</b><span>'+(sk.cur===1?'session':'sessions')+' in a row</span></div>'+
    '<div class="lk-sb"><b>'+sk.best+'</b><span>best</span></div></div>'+
    '<p class="lk-q pad">'+esc(streakLine(sk.cur))+' <span class="lk-fine">A session counts at '+HIT+'% of sets. Sunday and off days never break it.</span></p>';
  h+='<div class="sec-t">This week</div><div class="lk-days">'+wk.days.map(x=>'<div class="lk-d '+x.st+'"><span>'+x.l+'</span><i></i></div>').join('')+'</div>';
  const rows=[
    ['Sets finished',wk.sets+' of '+wk.setsTotal],
    ['Sessions hit',wk.hit+' of '+wk.planned],
    ['Weights logged',wk.wt?wk.wl+' of '+wk.wt+' lifts':'–'],
    ['New personal bests',String(wk.prs)],
    ['Vs last week',diff===null?'–':(diff>0?'+':'')+diff+' pts']
  ];
  h+='<div class="lk-rows">'+rows.map(r=>'<div><span>'+r[0]+'</span><b>'+esc(r[1])+'</b></div>').join('')+'</div>';
  let verdict='';
  if(wk.prs>0)verdict='New best on '+wk.prs+(wk.prs===1?' lift':' lifts')+'. The bar moved and you moved it.';
  else if(wk.missed.length)verdict='Skipped: '+wk.missed.join(', ')+'. It will be remembered.';
  else if(wk.sets>0)verdict='Clean week so far. Do not get weird about it. (Get weird about it.)';
  if(verdict)h+='<p class="lk-q pad">'+esc(verdict)+'</p>';
  const past=[];for(let i=5;i>=1;i--){const w=weekStat(addDays(monday,-7*i));past.push({s:w.score,has:w.sets>0,d:fmtd(w.from)})}
  if(past.some(x=>x.has)){
    h+='<div class="sec-t">Last 5 weeks</div><div class="lk-hist">'+past.map(x=>'<div><div class="col"><i style="height:'+(x.has?Math.max(4,x.s):0)+'%"></i></div><b>'+(x.has?x.s:'–')+'</b><span>'+esc(x.d)+'</span></div>').join('')+'</div>';
  }
  h+='<button class="wide-btn" data-act="lkshare">Share this week</button>';
  return h;
}
function shareLock(){
  const wk=weekStat(monday),sk=streakInfo(),tr=tierFor(wk.score);
  const text='REDLINE · '+wk.score+'/100 · '+tr[1].toUpperCase()+'\n🔥 '+sk.cur+' in a row · '+wk.sets+'/'+wk.setsTotal+' sets · '+wk.prs+' PR'+(wk.prs===1?'':'s')+'\n"'+tr[2]+'"';
  try{
    if(navigator.share){navigator.share({text:text}).catch(()=>{});return}
    if(navigator.clipboard&&navigator.clipboard.writeText){navigator.clipboard.writeText(text).then(()=>flash('Copied. Paste it in a group chat.'),()=>flash('Could not copy.'));return}
  }catch(e){}
  flash('Sharing is blocked in this browser.');
}

/* ---------- rendering ---------- */
function renderHead(){
  const seg='<div class="seg"><button class="'+(view==='work'?'on':'')+'" data-act="view" data-v="work" aria-pressed="'+(view==='work')+'">Workout</button><button class="'+(view==='prog'?'on':'')+'" data-act="view" data-v="prog" aria-pressed="'+(view==='prog')+'">Progress</button><button class="'+(view==='lock'?'on':'')+'" data-act="view" data-v="lock" aria-pressed="'+(view==='lock')+'">Locked in</button></div>';
  let h='<div class="top-row">'+seg+(view==='work'?'<button class="edit-btn'+(editMode?' on':'')+'" data-act="edit" aria-pressed="'+editMode+'">'+(editMode?'Done':'Edit')+'</button>':'')+'</div>';
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
      '<div class="p-sub"><span id="pc">'+s.d+' of '+s.t+' sets'+(s.pct===100?' · day complete':'')+'</span><span>'+wkTxt+' · '+LONG[s.dow].slice(0,3)+' '+fmtd(s.key)+'</span></div>';
  }
  $('#hd').innerHTML=h;
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
  const bk='<div class="ex"><div class="lab">Backup</div><div class="ed-note">Your workouts live only on this phone. Copy a backup now and then and paste it into Notes. To move to a new phone, paste it back here.</div>'+
    '<div class="ed-row"><button class="mini" style="flex:1" data-act="bkcopy">Copy backup</button>'+(navigator.share?'<button class="mini" style="flex:1" data-act="bkshare">Share backup</button>':'')+'</div>'+
    '<textarea class="bk-in" id="bk-in" placeholder="Paste a backup here to restore it" aria-label="Paste a backup to restore">'+esc(bkText)+'</textarea>'+
    '<button class="wide-btn dim" data-act="bkrestore">'+(armed==='restore'?'Tap again to replace everything on this phone':'Restore from pasted backup')+'</button></div>';
  return '<div class="ed-note">Editing this day. Changes save as you type. Weights are saved by exercise name, so renaming an exercise starts its history over.</div>'+blk+
    '<div class="ex"><div class="ed-f"><label for="ttl">Day name</label><input id="ttl" class="ed" data-f="title" value="'+esc(plan.title)+'"></div></div>'+
    items+
    '<button class="wide-btn" data-act="add">+ Add exercise</button>'+
    '<button class="wide-btn dim" data-act="reset">'+(armed==='reset'?'Tap again to restore':'Restore original plan for this day')+'</button>'+bk;
}
function renderList(){
  if(view==='prog'){$('#list').innerHTML=progressHtml();return}
  if(view==='lock'){$('#list').innerHTML=lockHtml();return}
  const s=stats(sel),plan=state.plan[s.dow];
  $('#list').innerHTML=editMode?editHtml(plan):hintHtml()+bannerHtml()+plan.ex.map(e=>cardHtml(e,s.key)).join('');
}
function renderFoot(){
  $('#ft').innerHTML=(editMode||view!=='work'?'':'<button class="wide-btn dim" data-act="clear">'+(armed==='clear'?'Tap again to clear':'Clear this day’s sets')+'</button>')+'<div class="status" id="status">'+statusText()+'</div>';
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
    case 'view':view=b.dataset.v;editMode=false;armed=null;renderAll();window.scrollTo(0,0);break;
    case 'lkshare':shareLock();break;
    case 'psel':progSel=b.dataset.k;renderList();window.scrollTo(0,0);break;
    case 'tab':sel=i;armed=null;renderAll();window.scrollTo(0,0);break;
    case 'edit':editMode=!editMode;armed=null;renderAll();break;
    case 'hintx':try{localStorage.setItem(HINT_KEY,'1')}catch(x){}renderList();break;
    case 'set':{
      e=exById(id);if(!e)break;
      key=curKey();
      const arr=getDone(key,e),v=!arr[i];arr[i]=v;putDone(key,e,arr);
      if(!arr.every(Boolean)){l=state.log[key];if(l&&l.t)delete l.t[nk(effName(key,e))]}
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
      if(armed==='clear'){armed=null;l=state.log[curKey()];if(l){l.d={};l.t={};delete l.dl}change();renderAll()}
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
  }
});
document.addEventListener('keydown',ev=>{
  if(ev.key==='Enter'&&ev.target.id&&ev.target.id.indexOf('sw-')===0){
    const b=ev.target.parentNode.querySelector('[data-act="swapcustom"]');if(b)b.click();
  }
});
document.addEventListener('change',ev=>{
  const t=ev.target;
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
document.addEventListener('visibilitychange',()=>{
  if(document.visibilityState==='visible'){tick();if(T.state==='run')wake()}
});

renderAll();
renderTimer();
localSave();
try{if(navigator.storage&&navigator.storage.persist)navigator.storage.persist().catch(()=>{})}catch(e){}
if('serviceWorker' in navigator){
  window.addEventListener('load',()=>{navigator.serviceWorker.register('./sw.js').catch(()=>{})});
}
})();
