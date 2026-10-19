/* OBSCENE voxel engine v2: pixel-art turned into chunky voxel objects on a 2D canvas.
   v2 changes: cubes in flight draw as one flat face with no outline (about 4x less work),
   pooled typed arrays instead of per-face objects, cached colour strings, thinner orb.
   No dependencies. Exposes window.VX. */
(function(){
  const clamp01 = x => x < 0 ? 0 : x > 1 ? 1 : x;
  const lerp = (a, b, k) => a + (b - a)*k;
  const smooth = k => { k = clamp01(k); return k*k*(3 - 2*k); };
  const hash = (i, s=1) => { const x = Math.sin(i*127.1 + s*311.7)*43758.5453; return x - Math.floor(x); };

  const BASE = {K:[10,10,12], W:[255,255,255], B:[169,211,255], D:[127,169,214], G:[214,218,225], S:[90,98,112]};
  const CHROME = [[0,[251,253,255]],[.26,[214,235,255]],[.45,[143,178,218]],[.5,[26,31,42]],[.58,[58,66,82]],[.78,[169,180,198]],[1,[244,247,251]]];
  function ramp(v){ for(let i=1;i<CHROME.length;i++){ if(v <= CHROME[i][0]){ const [a,ca] = CHROME[i-1], [b,cb] = CHROME[i]; const k = (v - a)/(b - a); return [lerp(ca[0],cb[0],k), lerp(ca[1],cb[1],k), lerp(ca[2],cb[2],k)]; } } return CHROME[CHROME.length-1][1]; }
  const LV = (()=>{ const v = [-.42, -.74, -.52], l = Math.hypot(...v); return v.map(x=>x/l); })();
  const DIRS = [[1,0,0],[-1,0,0],[0,1,0],[0,-1,0],[0,0,1],[0,0,-1]];
  const CORNERS = [-1,-1, 1,-1, 1,1, -1,1];
  const TG = [[1,2],[1,2],[0,2],[0,2],[0,1],[0,1]];

  function makeDef(vox){
    let minx=1e9,maxx=-1e9,miny=1e9,maxy=-1e9,minz=1e9,maxz=-1e9;
    for(const v of vox){ minx=Math.min(minx,v.x); maxx=Math.max(maxx,v.x); miny=Math.min(miny,v.y); maxy=Math.max(maxy,v.y); minz=Math.min(minz,v.z); maxz=Math.max(maxz,v.z); }
    const cx=(minx+maxx)/2, cy=(miny+maxy)/2, cz=(minz+maxz)/2;
    const set = new Set(vox.map(v=>v.x+','+v.y+','+v.z));
    const hy = (maxy - miny)/2 || 1;
    vox.forEach(v=>{ v.mask = DIRS.map(d=> set.has((v.x+d[0])+','+(v.y+d[1])+','+(v.z+d[2]))); v.lx = v.x - cx; v.ly = v.y - cy; v.lz = v.z - cz; v.ny = v.ly/hy; });
    vox.sort((a,b)=> a.y - b.y || a.x - b.x || a.z - b.z);
    vox.forEach((v,i)=>{ const r1 = hash(i,3), r2 = hash(i,7), r3 = hash(i,11); const dx = v.lx + (r1-.5)*6, dy = v.ly + (r2-.5)*6, dz = (r3-.5)*10; const l = Math.hypot(dx,dy,dz) || 1; v.ed = [dx/l, dy/l, dz/l]; v.er = .5 + hash(i,19); });
    return {vox, w:maxx-minx+1, h:maxy-miny+1, d:maxz-minz+1};
  }
  function artDef(rows, depth=2){
    const vox = [];
    rows.forEach((r,y)=>[...r].forEach((ch,x)=>{
      if(ch === '.' || ch === ' ') return;
      const up = ch !== ch.toUpperCase(), c = ch.toUpperCase();
      for(let z=0; z<depth; z++) vox.push({x, y, z, c});
      if(up) vox.push({x, y, z:-1, c});
    }));
    return makeDef(vox);
  }
  function sphereDef(r, shell=1.6, col='C'){ const vox = []; for(let x=-r;x<=r;x++) for(let y=-r;y<=r;y++) for(let z=-r;z<=r;z++){ const d = Math.hypot(x,y,z); if(d <= r + .35 && d > r - shell) vox.push({x,y,z,c:col}); } return makeDef(vox); }

  const ART = {
    camera:["....KKKKK.......","...KCCCCCK..WW..","KKKKKKKKKKKKKKKK","KCCCKKKKKKKKCCCK","KCCKKccccccKKCCK","KCCKccKKKKccKCCK","KKKKcKBBBBKcKKKK","KKKKcKBWBBKcKKKK","KKKKcKBBBBKcKKKK","KCCKccKKKKccKCCK","KCCKKccccccKKCCK","KCCCKKKKKKKKCCCK","KKKKKKKKKKKKKKKK"],
    clapper:["KKKWWWKKKWWWKKK","KKWWWKKKWWWKKK.","...............","KKKKKKKKKKKKKKK","KWWKKWWWKKWWWKK","KKKKKKKKKKKKKKK","KBBBBBBBBBBBBBK","KBwwwwBBBBBBBBK","KBBBBBBBBBBBBBK","KBwwwwwwwBBBBBK","KBBBBBBBBBBBBBK","KBwwwBBBBBBBBBK","KKKKKKKKKKKKKKK"],
    headphones:[".....KKKKK.....","...KKCCCCCKK...","..KCCKKKKKCCK..",".KCK.......KCK.","KCK.........KCK","KCK.........KCK","KKKKK.....KKKKK","KbbbK.....KbbbK","KbwbK.....KbwbK","KbwbK.....KbbbK","KbbbK.....KbbbK","KKKKK.....KKKKK"],
    vinyl:["....KKKKK....","..KKSKKKSKK..",".KSKKKKKKKSK.",".KKKKBBBKKKK.","KKKKbbbbbKKKK","KSKbbbwbbbKSK","KKKbbwKwbbKKK","KSKbbbwbbbKSK","KKKKbbbbbKKKK",".KKKKBBBKKKK.",".KSKKKKKKKSK.","..KKSKKKSKK..","....KKKKK...."],
    heart:[".KKK...KKK.","KBBBK.KBBBK","KBWBBKBBBBK","KBWBBBBBBBK","KBBBBBBBBBK",".KBBBBBBBK.","..KBBBBBK..","...KBBBK...","....KBK....",".....K....."],
    coin:["...KKKKKK...","..KCCCCCCK..",".KCCCkkCCCK.","KCCCkkkkCCCK","KCCkkCCCCCCK","KCCCkkkCCCCK","KCCCCCkkkCCK","KCCCCCCCkkCK","KCCCkkkkCCCK",".KCCCkkCCCK.","..KCCCCCCK..","...KKKKKK..."],
    cash:["KKKKKKKKKKKKKKKK","KBBBBBBBBBBBBBBK","KBWBBBBkkBBBBWBK","KBBBBBkBBkBBBBBK","KBWBBBBkkBBBBWBK","KBBBBBBBBBBBBBBK","KKKKKKKKKKKKKKKK","KDDDDDDDDDDDDDDK","KKKKKKKKKKKKKKKK"],
    star:["......K......","......K......",".....KCK.....",".....KCK.....","....KCCCK....","..KKCCWCCKK..","KKCCCWWWCCCKK","..KKCCWCCKK..","....KCCCK....",".....KCK.....",".....KCK.....","......K......","......K......"],
    bubble:[".KKKKKKKKKKKK.","KWWWWWWWWWWWWK","KWWWWWWWWWWWWK","KWWkkWkkWkkWWK","KWWkkWkkWkkWWK","KWWWWWWWWWWWWK",".KKKKKKKKKWWK.","..........KWK.","...........KK."],
    calendar:["...c.....c...","KKKcKKKKKcKKK","KBBBBBBBBBBBK","KBBBBBBBBBBBK","KKKKKKKKKKKKK","KWWWWWWWWWWWK","KWkWWkWWkWWkK","KWWWWWWWWWWWK","KWkWWkWWbbbWK","KWWWWWWWbbbWK","KWkWWkWWWWWWK","KWWWWWWWWWWWK","KKKKKKKKKKKKK"],
    globe:["...KKKKKK...","..KBBWBBBK..",".KBBBWBBBBK.","KWWWWWWWWWWK","KBBBBWBBBBBK","KBBBBWBBBBBK","KWWWWWWWWWWK","KBBBBWBBBBBK",".KBBBWBBBBK.","..KBBWBBBK..","...KKKKKK..."],
    play:["KKKKKKKKKKKK","KBBBBBBBBBBK","KBBBwBBBBBBK","KBBBwwBBBBBK","KBBBwwwBBBBK","KBBBwwwwBBBK","KBBBwwwBBBBK","KBBBwwBBBBBK","KBBBwBBBBBBK","KBBBBBBBBBBK","KKKKKKKKKKKK"],
    phone:[".KKKKKKKK.","KCCCCCCCCK","KCKKKKKKCK","KCKBBBBKCK","KCKBWWBKCK","KCKBBBBKCK","KCKBWWBKCK","KCKBBBBKCK","KCKKKKKKCK","KCCCKKCCCK",".KKKKKKKK."],
  };
  const DEF = {};
  const MAPS = {};
  function morphMap(A, B){ const key = A.id + '>' + B.id; if(MAPS[key]) return MAPS[key]; const nA = A.vox.length, nB = B.vox.length, N = Math.max(nA, nB), m = new Uint16Array(N*2);
    for(let i=0;i<N;i++){ m[i*2] = Math.floor(i*nA/N); m[i*2+1] = Math.floor(i*nB/N); } m.n = N; return MAPS[key] = m; }

  /* face pool (reused every frame, grows when needed) */
  let cap = 0, FZ, FP, FC, FL, IDX;
  function ensure(n){ if(n <= cap) return; cap = Math.max(n, cap*2, 2048); FZ = new Float32Array(cap); FP = new Float32Array(cap*8); FC = new Array(cap); FL = new Uint8Array(cap); IDX = new Uint32Array(cap); }
  /* colour strings, quantised so the cache stays small */
  const CC = new Map();
  function col(r, g, b){ r = Math.min(255, r) & 252; g = Math.min(255, g) & 252; b = Math.min(255, b) & 252; const k = (r << 16) | (g << 8) | b; let s = CC.get(k);
    if(!s){ if(CC.size > 6000) CC.clear(); s = ['rgb('+r+','+g+','+b+')', 'rgb('+((r*.84)|0)+','+((g*.84)|0)+','+((b*.84)|0)+')']; CC.set(k, s); } return s; }

  /* o = {def, defB, m, x, y, z, u, rx, ry, rz, ex, a, clip, shadow, cs}; CX/CY = projection centre; F = focal length */
  function drawInst(ctx, o, CX, CY, F=420){
    const def = o.def, u = o.u, a = o.a === undefined ? 1 : o.a;
    if(a <= .01 || u <= .02) return 0;
    const cx = Math.cos(o.rx||0), sx = Math.sin(o.rx||0), cy = Math.cos(o.ry||0), sy = Math.sin(o.ry||0), cz = Math.cos(o.rz||0), sz = Math.sin(o.rz||0);
    const R0=cz*cy, R1=cz*sy*sx - sz*cx, R2=cz*sy*cx + sz*sx, R3=sz*cy, R4=sz*sy*sx + cz*cx, R5=sz*sy*cx - cz*sx, R6=-sy, R7=cy*sx, R8=cy*cx;
    const AX = [[R0,R3,R6],[R1,R4,R7],[R2,R5,R8]];
    const ND = [AX[0], AX[0].map(v=>-v), AX[1], AX[1].map(v=>-v), AX[2], AX[2].map(v=>-v)];
    const ex = o.ex || 0, m = o.defB ? clamp01(o.m) : 0, morphing = !!o.defB && m > 0 && m < 1;
    const loose = ex > .004 || morphing;
    const map = morphing ? morphMap(def, o.defB) : null;
    const src = (o.defB && m >= 1) ? o.defB : def;
    const n = map ? map.n : src.vox.length;
    const cs = o.cs || 0;
    ensure(n*(loose ? 1 : 6));
    let nf = 0;
    const ox = o.x - CX, oy = o.y - CY, oz = o.z || 0, h = u/2*1.02;
    for(let i=0;i<n;i++){
      let lx, ly, lz, c, ny, mask, ed, er;
      if(map){ const va = def.vox[map[i*2]], vb = o.defB.vox[map[i*2+1]]; const mm = smooth(clamp01((m - hash(i,23)*.25)/.75));
        lx = lerp(va.lx, vb.lx, mm); ly = lerp(va.ly, vb.ly, mm); lz = lerp(va.lz, vb.lz, mm); c = mm < .5 ? va.c : vb.c; ny = mm < .5 ? va.ny : vb.ny; mask = va.mask; ed = va.ed; er = va.er;
        const arc = Math.sin(Math.PI*mm)*7*(.6 + er*.6); lx += ed[0]*arc; ly += ed[1]*arc; lz += ed[2]*arc;
      } else { const v = src.vox[i]; lx = v.lx; ly = v.ly; lz = v.lz; c = v.c; ny = v.ny; mask = v.mask; ed = v.ed; er = v.er; }
      const X0 = lx*u, Y0 = ly*u, Z0 = lz*u;
      let px = R0*X0 + R1*Y0 + R2*Z0 + ox, py = R3*X0 + R4*Y0 + R5*Z0 + oy, pz = R6*X0 + R7*Y0 + R8*Z0 + oz;
      if(ex > 0){ const d = ex*(10 + 26*er)*u; px += ed[0]*d; py += ed[1]*d + ex*ex*6*u*er; pz += ed[2]*d; }
      let f0 = 0, f1 = 6;
      if(loose){ /* one face per cube in flight: the one facing the camera most */
        let best = 0, bd = 0; for(let f=0; f<6; f++){ const nd = ND[f]; const dd = nd[0]*px + nd[1]*py + nd[2]*(pz + F); if(dd < bd){ bd = dd; best = f; } }
        if(bd >= 0) continue; f0 = best; f1 = best + 1; }
      for(let f=f0; f<f1; f++){
        if(!loose && mask[f]) continue;
        const nd = ND[f];
        const fcx = px + nd[0]*u/2, fcy = py + nd[1]*u/2, fcz = pz + nd[2]*u/2;
        if(!loose && nd[0]*fcx + nd[1]*fcy + nd[2]*(fcz + F) >= 0) continue;
        const t1 = AX[TG[f][0]], t2 = AX[TG[f][1]], b = nf*8;
        for(let q=0;q<4;q++){
          const s0 = CORNERS[q*2], s1 = CORNERS[q*2+1];
          const X = fcx + (t1[0]*s0 + t2[0]*s1)*h, Y = fcy + (t1[1]*s0 + t2[1]*s1)*h, Z = fcz + (t1[2]*s0 + t2[2]*s1)*h;
          const k = F/(F + Z); FP[b + q*2] = CX + X*k; FP[b + q*2 + 1] = CY + Y*k;
        }
        let r, g, bl;
        if(c === 'C'){
          let vv;
          if(nd[1] < -.55) vv = .08 + .12*(ny + 1)/2;
          else if(nd[1] > .55) vv = .66;
          else vv = .5 + .36*ny + .16*nd[0];
          vv += cs;
          const rgb = ramp(clamp01(vv - Math.floor(vv))); r = rgb[0]; g = rgb[1]; bl = rgb[2];
        } else {
          const bs = BASE[c] || BASE.K, lam = Math.max(0, nd[0]*LV[0] + nd[1]*LV[1] + nd[2]*LV[2]), sh = .6 + .42*lam, add = 34*lam;
          r = bs[0]*sh + add; g = bs[1]*sh + add; bl = bs[2]*sh + add;
        }
        FZ[nf] = fcz; FC[nf] = col(r, g, bl); FL[nf] = loose ? 1 : 0; IDX[nf] = nf; nf++;
      }
    }
    const order = IDX.subarray(0, nf); order.sort((A,B)=> FZ[B] - FZ[A]);
    ctx.save();
    if(o.clip){ ctx.beginPath(); ctx.rect(o.clip[0], o.clip[1], o.clip[2], o.clip[3]); ctx.clip(); }
    if(o.shadow){ const sw = def.w*u*.5*(1 - ex*.6), syy = o.y + def.h*u*.62 + 4; const g = ctx.createRadialGradient(o.x, syy, 0, o.x, syy, Math.max(1, sw)); g.addColorStop(0, 'rgba(10,10,12,' + (o.shadowA ?? .22)*a*(1 - Math.min(1, ex)) + ')'); g.addColorStop(1, 'rgba(10,10,12,0)'); ctx.fillStyle = g; ctx.save(); ctx.translate(o.x, syy); ctx.scale(1, .16); ctx.translate(-o.x, -syy); ctx.beginPath(); ctx.arc(o.x, syy, Math.max(1, sw), 0, Math.PI*2); ctx.fill(); ctx.restore(); }
    ctx.globalAlpha = a;
    ctx.lineWidth = .45; ctx.lineJoin = 'round';
    let lastF = '', lastS = '';
    for(let j=0;j<nf;j++){
      const i = order[j], b = i*8, cc = FC[i];
      if(cc[0] !== lastF){ ctx.fillStyle = cc[0]; lastF = cc[0]; }
      ctx.beginPath(); ctx.moveTo(FP[b],FP[b+1]); ctx.lineTo(FP[b+2],FP[b+3]); ctx.lineTo(FP[b+4],FP[b+5]); ctx.lineTo(FP[b+6],FP[b+7]); ctx.closePath(); ctx.fill();
      if(!FL[i]){ if(cc[1] !== lastS){ ctx.strokeStyle = cc[1]; lastS = cc[1]; } ctx.stroke(); }
    }
    ctx.restore();
    return nf;
  }

  let ready = false;
  function init(){
    if(ready) return DEF;
    for(const k in ART) DEF[k] = artDef(ART[k]);
    DEF.orb = sphereDef(7, 1.05);
    for(const k in DEF) DEF[k].id = k;
    ready = true; return DEF;
  }
  window.VX = {init, DEF, ART, drawInst, artDef, sphereDef, clamp01, lerp, smooth, hash};
})();
