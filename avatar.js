/* Redline character: a low-poly figure built from simple shapes with three.js.
   Proportions come from tape measurements, red glow from this week's training. */
(function(){
'use strict';
if(!window.THREE){return}
const T=THREE;
const IN=0.026;
const REF={sh:46,ch:38,wa:30,ar:12.5,th:22,ca:14.5};
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const GROUPS=['shoulders','chest','back','biceps','triceps','quads','hams','glutes','calves'];

function kOf(meas,f){const v=parseFloat(meas&&meas[f]);return v>0?clamp(v/REF[f],0.7,1.5):1}

function build(group,P,mats){
  const kk={};Object.keys(REF).forEach(f=>{kk[f]=kOf(P.meas,f)});
  const dark=new T.MeshStandardMaterial({color:0x2b2b2e,roughness:.6,metalness:.15,flatShading:true});
  const geos=[];
  const add=(geo,mat,x,y,z,sx,sy,sz,rx,ry,rz)=>{
    geos.push(geo);
    const m=new T.Mesh(geo,mat);
    m.position.set(x||0,y||0,z||0);
    if(sx!==undefined)m.scale.set(sx,sy,sz);
    m.rotation.set(rx||0,ry||0,rz||0);
    group.add(m);return m;
  };
  const M=g=>mats[g];
  const waistA=.15*kk.wa,waistB=.10*kk.wa;
  const chestA=.19*kk.ch*(0.55+0.45*kk.sh),depth=.66;
  const shHalf=.26*kk.sh;
  const rAr=.052*kk.ar,rTh=.091*kk.th,rCa=.06*kk.ca;
  const hipX=.095;
  // torso
  add(new T.CylinderGeometry(chestA,waistA*1.18,.30,14),dark,0,1.35,0,1,1,depth);
  add(new T.CylinderGeometry(waistA*1.18,waistA,.26,14),dark,0,1.07,0,1,1,depth*.95);
  add(new T.CylinderGeometry(waistA,.16,.18,14),dark,0,.85,0,1,1,.78);
  // head + neck
  add(new T.SphereGeometry(.105,10,8),dark,0,1.74,0,1,1.12,1);
  add(new T.CylinderGeometry(.05,.058,.09,8),dark,0,1.60,0);
  // shoulders (delts) and traps
  [-1,1].forEach(s=>{
    add(new T.SphereGeometry(.078*kk.sh,10,8),M('shoulders'),s*shHalf,1.46,0,1,1,.95);
    add(new T.SphereGeometry(.06,8,6),M('shoulders'),s*.08,1.54,-.03,1.6,.6,.9);
  });
  // chest
  [-1,1].forEach(s=>{
    add(new T.SphereGeometry(.1*kk.ch,10,8),M('chest'),s*chestA*.46,1.38,chestA*depth*.62,1.15,.85,.55);
  });
  // back (lats)
  [-1,1].forEach(s=>{
    add(new T.SphereGeometry(.11*kk.ch,10,8),M('back'),s*chestA*.62,1.30,-chestA*depth*.5,.8,1.4,.45,0,0,s*.2);
  });
  // arms
  [-1,1].forEach(s=>{
    const ax=s*(shHalf+.012);
    add(new T.CapsuleGeometry(rAr,.22,3,8),dark,ax,1.30,0,1,1,1,0,0,s*.08);
    add(new T.SphereGeometry(rAr*1.1,9,7),M('biceps'),ax+s*.004,1.31,rAr*.7,1,1.45,.95);
    add(new T.SphereGeometry(rAr*1.05,9,7),M('triceps'),ax+s*.004,1.31,-rAr*.7,1,1.4,.95);
    add(new T.CapsuleGeometry(rAr*.78,.24,3,8),dark,ax+s*.03,1.02,0,1,1,1,0,0,s*.1);
    add(new T.SphereGeometry(rAr*.8,8,6),dark,ax+s*.05,.85,0,.9,1.2,.7);
  });
  // legs
  [-1,1].forEach(s=>{
    const lx=s*hipX;
    add(new T.CapsuleGeometry(rTh,.30,3,8),dark,lx,.66,0,1,1,1,0,0,s*.02);
    add(new T.SphereGeometry(rTh*1.08,9,7),M('quads'),lx,.68,rTh*.55,1,1.9,.85);
    add(new T.SphereGeometry(rTh*1.0,9,7),M('hams'),lx,.64,-rTh*.55,1,1.7,.8);
    add(new T.SphereGeometry(.088,9,7),M('glutes'),lx*.9,.86,-.085,1,1,.9);
    add(new T.CapsuleGeometry(rCa,.30,3,8),dark,lx,.27,0);
    add(new T.SphereGeometry(rCa*1.12,9,7),M('calves'),lx,.33,-rCa*.55,1,1.7,.85);
    add(new T.BoxGeometry(.075,.04,.17),dark,lx,.025,.035);
  });
  return geos;
}

function create(canvas,params){
  let renderer;
  try{renderer=new T.WebGLRenderer({canvas:canvas,antialias:true,alpha:true})}catch(e){return null}
  renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,2));
  const scene=new T.Scene();
  const cam=new T.PerspectiveCamera(30,1,.1,50);
  cam.position.set(0,1.14,4.4);cam.lookAt(0,1.02,0);
  scene.add(new T.HemisphereLight(0xffffff,0x33181a,.95));
  const key=new T.DirectionalLight(0xffffff,1.15);key.position.set(2,3,4);scene.add(key);
  const rim=new T.PointLight(0xe3171f,1.6,9);rim.position.set(-2.2,1.4,-2.2);scene.add(rim);
  const fill=new T.PointLight(0xff4b50,.5,8);fill.position.set(2.2,.4,-2);scene.add(fill);
  // pedestal
  const ped=new T.Mesh(new T.CylinderGeometry(.46,.5,.03,48),new T.MeshStandardMaterial({color:0x0c0c0c,roughness:.8}));
  ped.position.y=-.015;scene.add(ped);
  const ring=new T.Mesh(new T.TorusGeometry(.47,.007,6,72),new T.MeshBasicMaterial({color:0xe3171f}));
  ring.rotation.x=Math.PI/2;ring.position.y=.003;scene.add(ring);
  const root=new T.Group();scene.add(root);
  let figure=null,geos=[],mats={},tag=null,tagTex=null;
  function nameTag(txt){
    if(tag){scene.remove(tag);tag.material.dispose();if(tagTex)tagTex.dispose();tag=null;tagTex=null}
    if(!txt)return;
    const c=document.createElement('canvas');c.width=512;c.height=128;
    const x=c.getContext('2d');
    x.font='800 84px "Barlow Condensed","Arial Narrow",Impact,sans-serif';x.textAlign='center';x.textBaseline='middle';
    x.shadowColor='rgba(227,23,31,.9)';x.shadowBlur=18;x.fillStyle='#fff';
    x.fillText(String(txt).toUpperCase(),256,66);
    tagTex=new T.CanvasTexture(c);
    tag=new T.Sprite(new T.SpriteMaterial({map:tagTex,transparent:true,depthTest:false}));
    tag.scale.set(1.15,.29,1);tag.position.set(0,1.94,0);scene.add(tag);
  }
  GROUPS.forEach(g=>{mats[g]=new T.MeshStandardMaterial({color:0x333336,emissive:0xe3171f,emissiveIntensity:0,roughness:.55,metalness:.15,flatShading:true})});
  function setGlow(glow){GROUPS.forEach(g=>{const v=clamp((glow&&glow[g])||0,0,1);mats[g].emissiveIntensity=.04+.96*Math.pow(v,.8);mats[g].color.setHex(v>0.02?0x3a2426:0x333336)})}
  function rebuild(P){
    if(figure){root.remove(figure);geos.forEach(g=>g.dispose())}
    figure=new T.Group();geos=build(figure,P,mats);root.add(figure);setGlow(P.glow);nameTag(P.name);
  }
  rebuild(params||{});
  let angle=.5,vel=0,dragging=false,lastX=0,alive=true,visible=true;
  const reduce=window.matchMedia&&window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  canvas.style.touchAction='pan-y';
  const pd=e=>{dragging=true;lastX=e.clientX;try{canvas.setPointerCapture(e.pointerId)}catch(x){}};
  const pm=e=>{if(!dragging)return;const dx=e.clientX-lastX;lastX=e.clientX;angle+=dx*.012;vel=dx*.012};
  const pu=()=>{dragging=false};
  canvas.addEventListener('pointerdown',pd);canvas.addEventListener('pointermove',pm);
  canvas.addEventListener('pointerup',pu);canvas.addEventListener('pointercancel',pu);
  let io=null;
  if('IntersectionObserver' in window){io=new IntersectionObserver(es=>{visible=es[0].isIntersecting});io.observe(canvas)}
  let last=performance.now();
  function size(){
    const w=canvas.clientWidth,h=canvas.clientHeight;
    if(w&&h&&(canvas.width!==Math.round(w*renderer.getPixelRatio())||canvas.height!==Math.round(h*renderer.getPixelRatio()))){
      renderer.setSize(w,h,false);cam.aspect=w/h;cam.updateProjectionMatrix();
    }
  }
  function frame(t){
    if(!alive)return;
    requestAnimationFrame(frame);
    const dt=Math.min(.05,(t-last)/1000);last=t;
    if(!visible||document.hidden)return;
    if(!dragging){if(Math.abs(vel)>.0005){angle+=vel;vel*=.94}else if(!reduce)angle+=dt*.45}
    root.rotation.y=angle;
    size();renderer.render(scene,cam);
  }
  requestAnimationFrame(frame);
  return {
    update:function(P){rebuild(P)},
    glow:function(g){setGlow(g)},
    destroy:function(){
      alive=false;if(io)io.disconnect();
      canvas.removeEventListener('pointerdown',pd);canvas.removeEventListener('pointermove',pm);
      canvas.removeEventListener('pointerup',pu);canvas.removeEventListener('pointercancel',pu);
      nameTag('');geos.forEach(g=>g.dispose());Object.keys(mats).forEach(k=>mats[k].dispose());
      renderer.dispose();
    }
  };
}
window.RedlineAvatar={create:create,GROUPS:GROUPS,REF:REF};
})();
