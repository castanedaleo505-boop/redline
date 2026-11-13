#!/usr/bin/env python3
"""Build Redline's 3D body (body.glb) from the MakeHuman base mesh and targets (CC0).

usage: build_body.py <makehuman/data dir> <out.glb>

The body is the MakeHuman base mesh, male/young/average, body group only. Every shape control is a
glTF morph target made from MakeHuman's own targets, forced to be exactly mirrored left to right.
Muscle-group and clothing masks are stored as extra vertex attributes for the app's shader.
"""
import sys,json,struct,collections,os
import numpy as np
from scipy.spatial import cKDTree

D=sys.argv[1];OUT=sys.argv[2]
T=os.path.join(D,'targets')

# ---------- load ----------
V=[];groups=collections.defaultdict(list);g=None
for l in open(os.path.join(D,'3dobjs','base.obj')):
    if l.startswith('v '):V.append([float(x) for x in l.split()[1:4]])
    elif l.startswith('g '):g=l.split()[1]
    elif l.startswith('f '):groups[g].append([int(p.split('/')[0])-1 for p in l.split()[1:]])
V=np.array(V);NV=len(V)
quads=np.array(groups['body'])
BODY=np.array(sorted(set(quads.flatten())))          # body vertex ids (0..13379)
NB=len(BODY);assert (BODY==np.arange(NB)).all()

def tgt(name,opt=False):
    d=np.zeros((NV,3));p=os.path.join(T,name+'.target')
    for l in open(p):
        if l.startswith('#') or not l.strip():continue
        a=l.split();d[int(a[0])]=[float(a[1]),float(a[2]),float(a[3])]
    return d
def both(fmt):return tgt(fmt%'l')+tgt(fmt%'r')

# ---------- base: male, young, average muscle and weight ----------
U=lambda m,w:tgt('macrodetails/universal-male-young-%smuscle-%sweight'%(m,w))
Uavg=U('average','average')
race=(tgt('macrodetails/african-male-young')+tgt('macrodetails/asian-male-young')+tgt('macrodetails/caucasian-male-young'))/3
ideal=tgt('macrodetails/proportions/male-young-averagemuscle-averageweight-idealproportions')
base=V+Uavg+race+0.6*ideal+0.55*both('armslegs/%s-hand-scale-decr')

# ---------- shape controls ----------
M={}
def pm(name,plus,minus):M[name+'+']=plus;M[name+'-']=minus
ms=lambda n:(tgt('measure/measure-%s-incr'%n),tgt('measure/measure-%s-decr'%n))
musc=U('max','average')-Uavg
delts=both('armslegs/%s-upperarm-shoulder-muscle-incr')
pm('shoulders',ms('shoulder-dist')[0]+0.6*delts,ms('shoulder-dist')[1])
pm('chest',ms('bust-circ')[0]*0.6+tgt('torso/torso-muscle-pectoral-incr')*0.8+tgt('torso/torso-muscle-dorsi-incr')*0.5,
           ms('bust-circ')[1]*0.6+tgt('torso/torso-muscle-pectoral-decr')*0.6)
pm('waist',*ms('waist-circ'))
pm('hips',*ms('hips-circ'))
pm('upperarm',ms('upperarm-circ')[0]*0.7+both('armslegs/%s-upperarm-muscle-incr')*0.7,ms('upperarm-circ')[1])
pm('forearm',both('armslegs/%s-lowerarm-muscle-incr')+both('armslegs/%s-lowerarm-fat-incr')*0.4,both('armslegs/%s-lowerarm-muscle-decr')+both('armslegs/%s-lowerarm-fat-decr')*0.5)
pm('thigh',ms('thigh-circ')[0]*0.7+both('armslegs/%s-upperleg-muscle-incr')*0.6,ms('thigh-circ')[1])
pm('calf',ms('calf-circ')[0]*0.7+both('armslegs/%s-lowerleg-muscle-incr')*0.6,ms('calf-circ')[1])
Umax=U('max','average')
pm('fat',0.5*(U('average','max')-Uavg)+0.5*(U('max','max')-Umax),0.5*(U('average','min')-Uavg)+0.5*(U('max','min')-Umax))
pm('muscle',musc+0.5*tgt('torso/torso-vshape-incr')+0.35*delts+0.5*tgt('stomach/stomach-tone-incr')+0.3*tgt('torso/torso-muscle-dorsi-incr'),U('min','average')-Uavg)

# ---------- exact mirror ----------
tree=cKDTree(V[:NB]);dist,mir=tree.query(V[:NB]*[-1,1,1])
assert dist.max()<1e-6 and (mir[mir]==np.arange(NB)).all()
FL=np.array([-1,1,1.])
def sym(a):
    a=a[:NB];return (a+a[mir]*FL)/2
base_full=base.copy()
base=sym(base);M={k:sym(v) for k,v in M.items()}
base[mir==np.arange(NB),0]=0

# ---------- arms: relax the elbow bend ----------
# The source rest pose has the forearm swung about 45 degrees forward. Rotate everything below the elbow
# so the forearm nearly continues the upper arm (a small natural bend is kept). Each vertex turns by its
# own skin weight times the angle, which bends the elbow smoothly instead of shearing it.
Wraw=json.load(open(os.path.join(D,'rigs','default_weights.mhw')))['weights']
def rodrigues(v,axis,ang):
    c=np.cos(ang)[:,None];s_=np.sin(ang)[:,None]
    return v*c+np.cross(axis,v)*s_+axis*(v@axis)[:,None]*(1-c)
def jraw(n):
    ids=sorted(set(i for f in groups['joint-'+n] for i in f));return base_full[ids].mean(0)
def straighten(base,M):
    chain=[k for k in Wraw if k.endswith('.L') and (k.startswith(('lowerarm','wrist','metacarpal','finger')))]
    w=np.zeros(NB)
    for k in chain:
        for i,x in Wraw[k]:
            if i<NB:w[i]+=x
    w=np.clip(w,0,1)
    sh,el,hd=jraw('l-shoulder'),jraw('l-elbow'),jraw('l-hand')
    f=(hd-el)/np.linalg.norm(hd-el);ua=(el-sh)/np.linalg.norm(el-sh)
    t=ua+np.array([0,0,0.20]);t/=np.linalg.norm(t)
    axis=np.cross(f,t);ang=np.arcsin(np.linalg.norm(axis));axis/=np.linalg.norm(axis)
    idx=np.where(w>0)[0];a=w[idx]*ang
    base=base.copy();base[idx]=el+rodrigues(base[idx]-el,axis,a);base[mir[idx]]=base[idx]*FL   # right arm is the mirror image
    M2={}
    for k,d in M.items():
        d=d.copy();d[idx]=rodrigues(d[idx],axis,a);d[mir[idx]]=d[idx]*FL;M2[k]=d
    newhand=el+rodrigues((hd-el)[None],axis,np.array([ang]))[0]
    print('forearm rotated %.1f degrees'%np.degrees(ang))
    return base,M2,newhand
base,M,HAND_L=straighten(base,M)
base=sym(np.vstack([base,np.zeros((NV-NB,3))]));M={k:sym(np.vstack([v,np.zeros((NV-NB,3))])) for k,v in M.items()}

# ---------- joints (helper cubes follow the same targets) ----------
def joint(n):
    ids=sorted(set(i for f in groups['joint-'+n] for i in f));return base_full[ids].mean(0)
EYE=base_full[sorted(set(i for f in groups['helper-l-eye'] for i in f))].mean(0)
J={n:joint(n) for n in ['l-shoulder','l-elbow','l-hand','l-upper-leg','l-knee','l-ankle','pelvis','neck','head','spine-1','spine-2','spine-3','spine-4']}

# ---------- to metres, feet on the floor ----------
S=0.1;y0=base[:,1].min()
def tr(p):p=np.array(p,dtype=float)*S;p[...,1]-=y0*S;return p
P=tr(base);M={k:v*S for k,v in M.items()}
J['l-hand']=HAND_L
J={k:tr(v) for k,v in J.items()};EYE=tr(EYE)

# ---------- faceless mannequin head ----------
# The face is replaced by a smooth surface: a low-order spherical-harmonic fit of the head's outer skin.
# Eye sockets, nostrils and the mouth cavity are relaxed into flat fills across their openings, so the
# mesh keeps its topology (still watertight) but has no features.
nbrs0=[[] for _ in range(NB)]
for q in quads:
    for k in range(4):nbrs0[q[k]].append(q[(k+1)%4]);nbrs0[q[k]].append(q[(k+3)%4])
nbrs0=[np.array(sorted(set(x))) for x in nbrs0]
def cone_dirs():
    out=[(0,0)]+[(35,a) for a in range(0,360,60)]+[(65,a+30) for a in range(0,360,60)]
    return np.radians(np.array(out,float))
def openness(P,idx,ftris,c):
    """Fraction of a cone of outward rays from each vertex that escape without hitting the head."""
    u=P[idx]-c;u/=np.linalg.norm(u,axis=1,keepdims=True)
    t1=np.cross(u,[0,1,0.3]);t1/=np.linalg.norm(t1,axis=1,keepdims=True);t2=np.cross(u,t1)
    v0=P[ftris[:,0]];e1=P[ftris[:,1]]-v0;e2=P[ftris[:,2]]-v0
    free=np.zeros(len(idx));cd=cone_dirs()
    for th,ph in cd:
        d=np.cos(th)*u+np.sin(th)*(np.cos(ph)*t1+np.sin(ph)*t2)
        o=P[idx]+d*2e-4
        for s0 in range(0,len(idx),150):
            D=d[s0:s0+150,None,:];O=o[s0:s0+150,None,:]
            pv=np.cross(D,e2[None]);det=(e1[None]*pv).sum(-1)
            ok=np.abs(det)>1e-12;inv=np.where(ok,1/np.where(ok,det,1),0)
            tv=O-v0[None];uu=(tv*pv).sum(-1)*inv
            qv=np.cross(tv,e1[None]);vv=(D*qv).sum(-1)*inv;tt=(e2[None]*qv).sum(-1)*inv
            hit=ok&(uu>=0)&(vv>=0)&(uu+vv<=1)&(tt>3e-4)
            free[s0:s0+150]+=~hit.any(1)
    return free/len(cd)
def facefix(P,M,quads):
    """Blank mannequin head: every vertex above the jaw line is moved onto one smooth egg. Ears, nose, eye
    sockets and the mouth cavity are first flattened into the skin around them (exact harmonic fill), so
    nothing folds over itself and the mesh keeps its topology."""
    import scipy.sparse as sp,scipy.sparse.linalg as spl
    chin=J['head'][1]-0.105;top=P[:,1].max()
    c=np.array([0,(chin+top)/2+0.006,0.034])
    ax,by,cz=0.0755,(top-chin)/2-0.006,0.0990
    def egg(u):
        t=np.clip(-u[:,1],0,1);k=1-0.36*t**2         # jaw: narrower toward the chin
        up=np.clip(u[:,1],0,1);fr=np.clip(u[:,2],0,1)
        bk=np.clip(-u[:,2],0,1)
        zz=cz*(1-0.13*t**2)*(1+0.12*fr*t**2)*(1-0.24*bk*t**2)  # chin slightly forward, less bulge above the nape
        yy=by*(1.0-0.05*np.tanh(3*u[:,1]))               # flatter crown, longer jaw (smooth, no crease)
        return 1/np.sqrt((u[:,0]/(ax*k))**2+(u[:,1]/yy)**2+(u[:,2]/zz)**2)
    # the head is everything above a plane that runs from under the chin up to the nape
    plane=chin+(0.085-P[:,2])*0.40
    w=ss(P[:,1]-plane,0.0,0.04)
    hi=np.where(w>0)[0]
    r=np.linalg.norm(P-c,axis=1);u=(P-c)/r[:,None];R=egg(u)
    headm=P[:,1]>plane-0.03
    hq=quads[headm[quads].all(1)];ft=np.concatenate([hq[:,[0,1,2]],hq[:,[0,2,3]]])
    ti=hi[(w[hi]>0.3)]
    op=openness(P,ti,ft,c)
    feat=np.zeros(NB,bool);feat[ti]=op<0.5
    feat|=(w>0.3)&((r-R)>0.004)&(np.abs(u[:,0])>0.78)                 # ears
    feat|=(w>0.3)&((r-R)>0.006)&(np.abs(u[:,0])<0.35)&(u[:,2]>0.45)   # nose, lips, brow
    feat|=feat[mir]
    for _ in range(2):
        g2=feat.copy()
        for i in np.where(feat)[0]:g2[nbrs0[i]]=True
        feat=g2&(w>0.05)
    ci=np.where(feat)[0]
    loc=-np.ones(NB,int);loc[ci]=np.arange(len(ci));rows=[];cols=[];vals=[];rhs=np.zeros((len(ci),3))
    for k,i in enumerate(ci):
        nb=nbrs0[i];rows.append(k);cols.append(k);vals.append(1.0)
        for j in nb:
            if loc[j]>=0:rows.append(k);cols.append(loc[j]);vals.append(-1.0/len(nb))
            else:rhs[k]+=P[j]/len(nb)
    Am=sp.csr_matrix((vals,(rows,cols)),shape=(len(ci),len(ci)))
    P2=P.copy();P2[ci]=np.stack([spl.spsolve(Am,rhs[:,a]) for a in range(3)],1)
    def project(Q):
        rr=np.linalg.norm(Q[hi]-c,axis=1);uu=(Q[hi]-c)/rr[:,None]
        Q=Q.copy();Q[hi]=c+uu*(rr+(egg(uu)-rr)*w[hi])[:,None];return Q
    P2=project(P2)
    for _ in range(3):                     # even out the vertex spacing, then put it back on the egg
        for _ in range(12):
            Q=P2.copy();Q[hi]=np.array([P2[nbrs0[i]].mean(0) for i in hi]);P2=P2+(Q-P2)*(0.5*np.minimum(1,w*1.5)[:,None])
        P2=project(P2)
    # soften the join under the jaw and at the nape
    jb=np.where((P[:,1]>plane-0.05)&(w<0.97))[0]
    for _ in range(60):
        Q=P2.copy();Q[jb]=np.array([P2[nbrs0[i]].mean(0) for i in jb]);P2[jb]=P2[jb]+(Q[jb]-P2[jb])*0.5
    P2=(P2+P2[mir]*FL)/2
    M2={}
    for k,d in M.items():
        d=d.copy()
        for _ in range(60):
            q2=d.copy();q2[hi]=np.array([d[nbrs0[i]].mean(0) for i in hi]);d=d+(q2-d)*w[:,None]
        M2[k]=(d+d[mir]*FL)/2
    print('head: %d verts on the egg, %d feature/cavity verts flattened'%(len(hi),len(ci)))
    return P2,M2,w
ss=lambda x,a,b:np.clip((x-a)/(b-a),0,1)**2*(3-2*np.clip((x-a)/(b-a),0,1))
P,M,FACE=facefix(P,M,quads)
P[mir==np.arange(NB),0]=0

# ---------- triangles: split each quad on its shorter diagonal (mirror-safe) ----------
tris=[]
for a,b,c,d in quads:
    if np.linalg.norm(P[a]-P[c])<=np.linalg.norm(P[b]-P[d]):tris+=[[a,b,c],[a,c,d]]
    else:tris+=[[a,b,d],[b,c,d]]
tris=np.array(tris,dtype=np.uint32)
def normals(P):
    n=np.zeros_like(P);fn=np.cross(P[tris[:,1]]-P[tris[:,0]],P[tris[:,2]]-P[tris[:,0]])
    for k in range(3):np.add.at(n,tris[:,k],fn)
    return n/np.maximum(np.linalg.norm(n,axis=1,keepdims=True),1e-12)
N=normals(P)
# outward check: signed volume must be positive
vol=np.einsum('ij,ij->i',P[tris[:,0]],np.cross(P[tris[:,1]],P[tris[:,2]])).sum()/6
assert vol>0,vol

# ---------- definition: losing fat sharpens muscle separation ----------
def lap(A,it):
    for _ in range(it):A=np.array([A[nb].mean(0) for nb in nbrs0])
    return A
_shred=P+0.9*M['muscle+']+M['fat-']
_detail=_shred-lap(_shred,6)
_keep=(1-ss(P[:,1],J['neck'][1]-0.02,J['neck'][1]+0.03))*ss(P[:,1],J['l-ankle'][1]+0.02,J['l-ankle'][1]+0.08)
_hw=np.zeros(NB)
for k in Wraw:
    if k.startswith(('wrist','metacarpal','finger')):
        for i,x in Wraw[k]:
            if i<NB:_hw[i]+=x
_keep*=1-np.clip(_hw,0,1)
dd=_detail*_keep[:,None]*1.1;dd=(dd+dd[mir]*FL)/2
M['fat-']=M['fat-']+dd
N=normals(P)

# ---------- masks ----------
W=json.load(open(os.path.join(D,'rigs','default_weights.mhw')))['weights']
def bone(*names):
    w=np.zeros(NB)
    for n in names:
        for s in (['.L','.R'] if n.endswith('*') else ['']):
            for i,x in W[n.rstrip('*')+s]:
                if i<NB:w[i]+=x
    return np.clip(w,0,1)
nbrs=[[] for _ in range(NB)]
for q in quads:
    for k in range(4):nbrs[q[k]].append(q[(k+1)%4]);nbrs[q[k]].append(q[(k+3)%4])
nbrs=[np.array(sorted(set(x))) for x in nbrs]
def smooth(m,it=3):
    for _ in range(it):m=np.array([0.5*m[i]+0.5*m[nb].mean() for i,nb in enumerate(nbrs)])
    return m
ss=lambda x,a,b:np.clip((x-a)/(b-a),0,1)**2*(3-2*np.clip((x-a)/(b-a),0,1))
band=lambda x,a,b,f:ss(x,a-f,a+f)*(1-ss(x,b-f,b+f))
x,y,z=P[:,0],P[:,1],P[:,2];ax=np.abs(x)
front=ss(N[:,2],-0.15,0.35);backf=1-ss(N[:,2],-0.35,0.15)
uarm=bone('upperarm01*','upperarm02*');larm=bone('lowerarm01*','lowerarm02*');hand=bone('wrist*')
thigh=bone('upperleg01*','upperleg02*');shin=bone('lowerleg01*','lowerleg02*');pelv=bone('pelvis*','root')
torso=bone('spine01','spine02','spine03','spine04','spine05','clavicle*','breast*','shoulder01*')
sh,el,hd=J['l-shoulder'],J['l-elbow'],J['l-hand']
Pm=P*[1,1,1];Pm[:,0]=ax
def along(a,b):
    d=b-a;return ((Pm-a)@d)/(d@d)
t_u=along(sh,el);t_l=along(el,hd)
d_sh=np.linalg.norm(Pm-sh,axis=1)
hipY,kneeY,ankY=J['l-upper-leg'][1],J['l-knee'][1],J['l-ankle'][1];shY=sh[1];neckY=J['neck'][1]
armish=np.clip(uarm+larm+hand,0,1)
m={}
m['shoulders']=np.clip((1-ss(d_sh,0.075,0.135))*(1-ss(y,shY+0.045,shY+0.075))*ss(ax,sh[0]-0.075,sh[0]-0.03),0,1)
tors=np.clip(torso+pelv-armish-m['shoulders']*0.8,0,1)
m['chest']=tors*front*band(y,shY-0.20,shY-0.015,0.02)*(1-ss(ax,sh[0]-0.02,sh[0]+0.02))
m['back']=tors*backf*band(y,hipY+0.14,shY+0.05,0.03)
arm_dir=(el-sh)/np.linalg.norm(el-sh)
m['biceps']=uarm*front*band(t_u,0.32,0.98,0.08)*(1-m['shoulders'])
m['triceps']=uarm*backf*band(t_u,0.28,0.98,0.08)*(1-m['shoulders'])
m['quads']=thigh*front*band(y,kneeY+0.03,hipY-0.03,0.03)
m['hams']=thigh*backf*band(y,kneeY+0.03,hipY-0.10,0.03)
m['glutes']=np.clip(pelv+thigh,0,1)*backf*band(y,hipY-0.10,hipY+0.11,0.025)*(1-armish)
m['calves']=shin*(1-ss(N[:,2],-0.1,0.5))*band(y,ankY+0.14,kneeY-0.03,0.03)
m['abs']=tors*front*band(y,hipY+0.12,shY-0.21,0.02)*(1-ss(ax,0.09,0.13))
legs=np.clip(pelv+thigh+tors,0,1)*(1-armish)
m['lower']=legs
m['face']=FACE
m['wraps']=np.clip(larm+hand,0,1)*band(t_l,0.70,0.93,0.02)
m['head']=bone('head','jaw','neck03')*ss(y,neckY+0.02,neckY+0.06)
SM={'wraps':1,'head':2,'lower':6,'face':0}
for k in m:
    v=smooth(np.clip(m[k],0,1),SM.get(k,4));m[k]=np.clip((v+v[mir])/2,0,1)
ORDER=['shoulders','chest','back','biceps','triceps','quads','hams','glutes','calves','abs','lower','wraps','head','face']
packs=[np.stack([m[ORDER[i+j]] if i+j<len(ORDER) else np.zeros(NB) for j in range(4)],1) for i in range(0,16,4)]

# ---------- checks ----------
ec=collections.Counter()
for t in tris:
    for k in range(3):a,b=int(t[k]),int(t[(k+1)%3]);ec[(min(a,b),max(a,b))]+=1
assert set(ec.values())=={2},'not watertight'
def mirror_err(A,flip=FL):return np.abs(A-A[mir]*flip).max()
assert mirror_err(P)<1e-9 and all(mirror_err(v)<1e-9 for v in M.values())
tset=set(tuple(sorted(t)) for t in tris.tolist())
assert all(tuple(sorted(mir[list(t)].tolist())) in tset for t in tset),'triangulation not mirrored'

# ---------- write glb ----------
P32=P.astype('<f4');N32=N.astype('<f4')
blobs=[];views=[];acc=[]
def view(b,target=None):
    off=sum(len(x) for x in blobs);pad=(-len(b))%4;blobs.append(b+b'\0'*pad)
    v={'buffer':0,'byteOffset':off,'byteLength':len(b)}
    if target:v['target']=target
    views.append(v);return len(views)-1
def accessor(arr,ctype,typ,target=None,norm=False,minmax=False):
    a={'bufferView':view(arr.tobytes(),target),'componentType':ctype,'count':len(arr),'type':typ}
    if norm:a['normalized']=True
    if minmax:a['min']=arr.min(0).tolist();a['max']=arr.max(0).tolist()
    acc.append(a);return len(acc)-1
attrs={'POSITION':accessor(P32,5126,'VEC3',34962,minmax=True),'NORMAL':accessor(N32,5126,'VEC3',34962)}
for i,pk in enumerate(packs):attrs['_MASK%d'%i]=accessor(np.round(pk*255).astype('u1'),5121,'VEC4',34962,norm=True)
idx=accessor(tris.astype('<u2').reshape(-1),5123,'SCALAR',34963)
names=list(M.keys());targets=[]
for n in names:
    d=M[n].astype('<f4');nz=np.where(np.abs(d).max(1)>2e-5)[0]
    a={'componentType':5126,'count':NB,'type':'VEC3','min':d.min(0).tolist(),'max':d.max(0).tolist()}
    if len(nz)<0.6*NB:   # sparse: only the vertices this control moves
        a['sparse']={'count':len(nz),'indices':{'bufferView':view(nz.astype('<u2').tobytes()),'componentType':5123},'values':{'bufferView':view(d[nz].tobytes())}}
    else:a['bufferView']=view(d.tobytes(),34962)
    acc.append(a);targets.append({'POSITION':len(acc)-1})
# head outline at eye height, for the visor the app builds around it
hz=0.02;angs=np.radians(np.arange(-152,153,8));band_=np.abs(P[:,1]-EYE[1])<0.022
hr=np.hypot(P[band_,0],P[band_,2]-hz);ha=np.arctan2(P[band_,0],P[band_,2]-hz)
prof=[float(hr[np.abs(ha-a)<np.radians(7)].max()) for a in angs]
extras={'eye':np.round(EYE,4).tolist(),'visor':{'z0':hz,'deg0':-152,'step':8,'r':np.round(prof,4).tolist()},'targetNames':names,'maskOrder':ORDER,'joints':{k:np.round(v,4).tolist() for k,v in J.items()},
        'source':'MakeHuman base mesh and targets, CC0 1.0 (makehumancommunity.org)'}
gl={'asset':{'version':'2.0','generator':'redline tools/build_body.py','copyright':'Body mesh derived from MakeHuman assets, CC0 1.0'},
    'scene':0,'scenes':[{'nodes':[0]}],'nodes':[{'mesh':0,'name':'body'}],
    'meshes':[{'name':'body','primitives':[{'attributes':attrs,'indices':idx,'targets':targets,'material':0}],'weights':[0]*len(names),'extras':extras}],
    'materials':[{'name':'skin','pbrMetallicRoughness':{'baseColorFactor':[0.85,0.85,0.85,1],'metallicFactor':0,'roughnessFactor':0.6}}],
    'accessors':acc,'bufferViews':views,'buffers':[{'byteLength':sum(len(x) for x in blobs)}]}
js=json.dumps(gl,separators=(',',':')).encode();js+=b' '*((-len(js))%4);bn=b''.join(blobs)
with open(OUT,'wb') as f:
    f.write(struct.pack('<4sII',b'glTF',2,12+8+len(js)+8+len(bn)));f.write(struct.pack('<I4s',len(js),b'JSON'));f.write(js);f.write(struct.pack('<I4s',len(bn),b'BIN\0'));f.write(bn)
print('verts',NB,'tris',len(tris),'targets',len(names),'size %.2f MB'%(os.path.getsize(OUT)/1e6))
print('watertight: every edge shared by exactly 2 triangles; mirror error',mirror_err(P),'; height %.3f m'%P[:,1].max())
