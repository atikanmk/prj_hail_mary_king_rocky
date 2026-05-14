// ================================================================
//  PROJECT HAIL MARY — King Rocky  |  game.js
//  Phases: walk -> asteroid -> dock -> planet -> win/lose
// ================================================================
const HERO = 'Dr. Kungking';

// ── CANVAS ───────────────────────────────────────────────────────
const canvas = document.getElementById('gameCanvas');
const ctx    = canvas.getContext('2d');
let W = 0, H = 0;
function resize() {
  W = canvas.width  = window.innerWidth;
  H = canvas.height = window.innerHeight;
}
window.addEventListener('resize', resize);

// ── INPUT ─────────────────────────────────────────────────────────
const keys = {}, keysJP = {};
window.addEventListener('keydown', e => { if (!keys[e.key]) keysJP[e.key] = true; keys[e.key] = true; });
window.addEventListener('keyup',   e => { keys[e.key] = false; });
function clearJP() { for (const k in keysJP) delete keysJP[k]; }

let touchDir = {x:0,y:0}, touchActive = false;
function initTouch() {
  canvas.addEventListener('touchstart', onT, {passive:false});
  canvas.addEventListener('touchmove',  onT, {passive:false});
  canvas.addEventListener('touchend',   () => { touchDir={x:0,y:0}; touchActive=false; });
}
function onT(e) {
  e.preventDefault();
  const t=e.touches[0], r=canvas.getBoundingClientRect();
  const cx = (phase==='walk') ? walker.x : ship.x;
  const cy = (phase==='walk') ? walker.y : ship.y;
  const dx=t.clientX-r.left-cx, dy=t.clientY-r.top-cy;
  const len=Math.hypot(dx,dy)||1;
  touchDir={x:dx/len,y:dy/len}; touchActive=true;
}

// ── PHASE ─────────────────────────────────────────────────────────
let phase = 'idle';
let fc = 0;      // frame counter, resets per phase
let animId;

function startPhase(p) {
  cancelAnimationFrame(animId);
  phase = p; fc = 0;
  if (p==='walk')     { resize(); initWalk(); showScreen('game-screen'); }
  else if (p==='asteroid') { initAsteroid(); }
  else if (p==='dock')     { initDock(); }
  else if (p==='planet')   { initPlanet(); }
  else if (p==='win')      { showScreen('win-screen'); return; }
  else if (p==='lose')     { showScreen('lose-screen'); return; }
  animId = requestAnimationFrame(loop);
}
function loop() {
  clearJP();
  if      (phase==='walk')     { updateWalk();     drawWalk(); }
  else if (phase==='asteroid') { updateAsteroid(); drawAsteroid(); }
  else if (phase==='dock')     { updateDock();     drawDock(); }
  else if (phase==='planet')   { updatePlanet();   drawPlanet(); }
  else return;
  animId = requestAnimationFrame(loop);
}
function restartGame() { startPhase('walk'); }

// ─────────────────────────────────────────────────────────────────
//  SHARED HELPERS
// ─────────────────────────────────────────────────────────────────
function showScreen(id) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.getElementById(id).classList.add('active');
}
function drawSpace() {
  const g = ctx.createLinearGradient(0,0,W,H);
  g.addColorStop(0,'#000008'); g.addColorStop(.5,'#00001a'); g.addColorStop(1,'#000010');
  ctx.fillStyle=g; ctx.fillRect(0,0,W,H);
}
function roundRect(x,y,w,h,r=8) {
  ctx.beginPath();
  ctx.moveTo(x+r,y); ctx.lineTo(x+w-r,y); ctx.quadraticCurveTo(x+w,y,x+w,y+r);
  ctx.lineTo(x+w,y+h-r); ctx.quadraticCurveTo(x+w,y+h,x+w-r,y+h);
  ctx.lineTo(x+r,y+h); ctx.quadraticCurveTo(x,y+h,x,y+h-r);
  ctx.lineTo(x,y+r); ctx.quadraticCurveTo(x,y,x+r,y); ctx.closePath();
}
function explodeAt(x,y,n=18) {
  for (let i=0;i<n;i++) {
    const a=Math.random()*Math.PI*2, s=2+Math.random()*5;
    particles.push({x,y,vx:Math.cos(a)*s,vy:Math.sin(a)*s,
      life:1,decay:.03+Math.random()*.04,r:2+Math.random()*4,
      color:['#ff6600','#ffcc00','#ff2200','#fff'][Math.floor(Math.random()*4)]});
  }
}

// shared arrays (reused across phases)
let stars=[], particles=[];

function initStars() {
  stars=[];
  for (let i=0;i<200;i++) stars.push({
    x:Math.random()*W, y:Math.random()*H,
    r:Math.random()*1.8+.2, speed:Math.random()*1.8+.4,
    brightness:Math.random()*.7+.3,
    color:['#fff','#aacf','#ffec','#faac'][Math.floor(Math.random()*4)],
  });
}
function scrollStars(mul=1) {
  for (const s of stars) { s.x-=s.speed*mul; if(s.x<0){s.x=W;s.y=Math.random()*H;} }
}
function drawStars() {
  for (const s of stars) {
    ctx.globalAlpha=s.brightness; ctx.fillStyle=s.color;
    ctx.beginPath(); ctx.arc(s.x,s.y,s.r,0,Math.PI*2); ctx.fill();
  }
  ctx.globalAlpha=1;
}
function updateParticles() {
  for (let i=particles.length-1;i>=0;i--) {
    const p=particles[i]; p.x+=p.vx; p.y+=p.vy; p.life-=p.decay;
    if(p.life<=0) particles.splice(i,1);
  }
}
function drawParticles() {
  for (const p of particles) {
    ctx.globalAlpha=p.life; ctx.fillStyle=p.color;
    ctx.beginPath(); ctx.arc(p.x,p.y,p.r*p.life,0,Math.PI*2); ctx.fill();
  }
  ctx.globalAlpha=1;
}

// ─────────────────────────────────────────────────────────────────
//  PHASE 1 — WALK  (ship interior exploration)
// ─────────────────────────────────────────────────────────────────
const walker = {x:0,y:0,speed:3.5,facing:1};
let alertState='none'; // none | flash | show
let alertTimer=0, bridgeReached=false, bridgeTransTimer=0;

const ROOMS = [
  {key:'cryo',     label:'CRYO BAY',      icon:'\u2744\ufe0f', relX:.03, relW:.19, bg:'#000d22', accent:'#003366'},
  {key:'lab',      label:'LABORATORY',    icon:'🔬',    relX:.24, relW:.20, bg:'#001110', accent:'#003322'},
  {key:'quarters', label:'CREW QUARTERS', icon:'🛏\ufe0f', relX:.46, relW:.19, bg:'#100a00', accent:'#332200'},
  {key:'bridge',   label:'BRIDGE',        icon:'🎮', relX:.67, relW:.30, bg:'#001500', accent:'#003300', isBridge:true},
];
const SHIP_TOP  = () => H * .18;
const SHIP_H    = () => H * .58;

function initWalk() {
  walker.x = W*.10; walker.y = SHIP_TOP() + SHIP_H()*.5;
  alertState='none'; alertTimer=0; bridgeReached=false; bridgeTransTimer=0;
  particles=[];
}

function updateWalk() {
  fc++;
  const sTop=SHIP_TOP(), sH=SHIP_H(), sBot=sTop+sH;
  let dx=0,dy=0;
  if (keys['ArrowLeft'] ||keys['a']||keys['A']) { dx=-1; walker.facing=-1; }
  if (keys['ArrowRight']||keys['d']||keys['D']) { dx= 1; walker.facing= 1; }
  if (keys['ArrowUp']   ||keys['w']||keys['W']) dy=-1;
  if (keys['ArrowDown'] ||keys['s']||keys['S']) dy= 1;
  if (touchActive) { dx=touchDir.x; dy=touchDir.y; }
  walker.x = Math.max(W*.04+20, Math.min(W*.97-20, walker.x+dx*walker.speed));
  walker.y = Math.max(sTop+20,  Math.min(sBot-20,  walker.y+dy*walker.speed));

  // Alert after 4 seconds
  if (alertState==='none' && fc>240) { alertState='flash'; alertTimer=0; }
  if (alertState==='flash') { alertTimer++; if(alertTimer>120) alertState='show'; }

  // Check if in bridge
  const br = ROOMS[3];
  if (alertState==='show' && walker.x > W*(br.relX+br.relW*.25)) {
    bridgeReached=true;
  }
  if (bridgeReached) {
    bridgeTransTimer++;
    if (bridgeTransTimer>90) startPhase('asteroid');
  }
}

function drawWalk() {
  const sTop = SHIP_TOP(), sH = SHIP_H();
  const floorY = sTop + sH * .68;   // floor Y
  const ceilY  = sTop + sH * .08;   // ceiling Y

  // ── Deep space background outside hull ──
  drawSpace();

  // ── Hull outer shell ──
  const hullGrad = ctx.createLinearGradient(0, sTop-30, 0, sTop+sH+30);
  hullGrad.addColorStop(0,   '#0d2035');
  hullGrad.addColorStop(0.5, '#071525');
  hullGrad.addColorStop(1,   '#0d2035');
  ctx.fillStyle = hullGrad;
  roundRect(W*.015, sTop-28, W*.97, sH+56, 32); ctx.fill();
  ctx.strokeStyle = '#1a5580'; ctx.lineWidth = 3; ctx.stroke();

  // Rivets along hull edge
  ctx.fillStyle = '#1a4060';
  for (let i = 0; i < 20; i++) {
    const rx = W*(.03 + i*(0.94/19));
    ctx.beginPath(); ctx.arc(rx, sTop-24, 3, 0, Math.PI*2); ctx.fill();
    ctx.beginPath(); ctx.arc(rx, sTop+sH+24, 3, 0, Math.PI*2); ctx.fill();
  }

  // ── Portholes (outside view — show stars) ──
  for (let i = 0; i < 6; i++) {
    const px = W*(.09 + i*.155);
    // porthole frame
    ctx.fillStyle = '#0a1e30'; ctx.strokeStyle = '#2266aa'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.ellipse(px, sTop-18, 28, 18, 0, 0, Math.PI*2); ctx.fill(); ctx.stroke();
    // space view inside porthole
    const pg = ctx.createRadialGradient(px, sTop-18, 2, px, sTop-18, 24);
    pg.addColorStop(0, '#000820'); pg.addColorStop(1, '#000410');
    ctx.fillStyle = pg;
    ctx.beginPath(); ctx.ellipse(px, sTop-18, 22, 14, 0, 0, Math.PI*2); ctx.fill();
    // tiny stars in porthole
    ctx.fillStyle = '#ffffff';
    for (let s = 0; s < 5; s++) {
      const sx = px-18 + ((i*37+s*71)%36), sy = sTop-26 + (s*5)%14;
      ctx.beginPath(); ctx.arc(sx, sy, .8, 0, Math.PI*2); ctx.fill();
    }
    // glint
    ctx.fillStyle = 'rgba(255,255,255,.25)';
    ctx.beginPath(); ctx.ellipse(px-8, sTop-24, 7, 4, -0.4, 0, Math.PI*2); ctx.fill();
  }

  // ── ROOM BACKGROUNDS ──
  for (const r of ROOMS) {
    const rx = W*r.relX, rw = W*r.relW;
    // floor-to-ceiling gradient per room
    const rg = ctx.createLinearGradient(rx, ceilY, rx, floorY);
    if (r.key==='cryo') {
      rg.addColorStop(0,'#000e24'); rg.addColorStop(.5,'#001535'); rg.addColorStop(1,'#000a1a');
    } else if (r.key==='lab') {
      rg.addColorStop(0,'#00120e'); rg.addColorStop(.5,'#001a14'); rg.addColorStop(1,'#000e0a');
    } else if (r.key==='quarters') {
      rg.addColorStop(0,'#120800'); rg.addColorStop(.5,'#1c1000'); rg.addColorStop(1,'#100800');
    } else {
      rg.addColorStop(0,'#001a00'); rg.addColorStop(.5,'#002800'); rg.addColorStop(1,'#001200');
    }
    ctx.fillStyle = rg; ctx.fillRect(rx, ceilY, rw, floorY - ceilY);
  }

  // ── CEILING ──
  const ceilGrad = ctx.createLinearGradient(0, ceilY-6, 0, ceilY+18);
  ceilGrad.addColorStop(0,'#0f2535'); ceilGrad.addColorStop(1,'#071520');
  ctx.fillStyle = ceilGrad; ctx.fillRect(W*.015, ceilY-6, W*.97, 24);
  ctx.strokeStyle = '#1a4060'; ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.moveTo(W*.015, ceilY+18); ctx.lineTo(W*.985, ceilY+18); ctx.stroke();

  // Ceiling light fixtures
  const numLights = 8;
  for (let i = 0; i < numLights; i++) {
    const lx = W*(.07 + i*(0.86/(numLights-1)));
    const flicker = .82 + .18*Math.sin(fc*.07 + i*1.3);
    // fixture box
    ctx.fillStyle = '#0a2030'; ctx.fillRect(lx-18, ceilY+2, 36, 10);
    ctx.strokeStyle = '#1a5070'; ctx.lineWidth=1; ctx.strokeRect(lx-18, ceilY+2, 36, 10);
    // light tube glow
    const lg = ctx.createLinearGradient(lx-14, ceilY+4, lx+14, ceilY+10);
    lg.addColorStop(0,'rgba(180,230,255,0)');
    lg.addColorStop(.5,`rgba(200,240,255,${flicker*.9})`);
    lg.addColorStop(1,'rgba(180,230,255,0)');
    ctx.fillStyle = lg; ctx.fillRect(lx-14, ceilY+4, 28, 6);
    // downward cone glow
    const dg = ctx.createRadialGradient(lx, ceilY+12, 0, lx, ceilY+12, 80);
    dg.addColorStop(0,`rgba(160,220,255,${flicker*.09})`);
    dg.addColorStop(1,'transparent');
    ctx.fillStyle = dg; ctx.beginPath(); ctx.arc(lx, ceilY+12, 80, 0, Math.PI*2); ctx.fill();
  }

  // ── PIPES along ceiling ──
  ctx.strokeStyle = '#1a3a50'; ctx.lineWidth = 6;
  ctx.beginPath(); ctx.moveTo(W*.02, ceilY+28); ctx.lineTo(W*.98, ceilY+28); ctx.stroke();
  ctx.strokeStyle = '#0d2535'; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.moveTo(W*.02, ceilY+34); ctx.lineTo(W*.98, ceilY+34); ctx.stroke();
  // pipe joints
  for (let i = 0; i < 9; i++) {
    const px = W*(.08 + i*.105);
    ctx.fillStyle = '#254060'; ctx.beginPath();
    ctx.arc(px, ceilY+28, 5, 0, Math.PI*2); ctx.fill();
  }

  // ── FLOOR ──
  const flGrad = ctx.createLinearGradient(0, floorY-4, 0, floorY+20);
  flGrad.addColorStop(0,'#091825'); flGrad.addColorStop(1,'#050e18');
  ctx.fillStyle = flGrad; ctx.fillRect(W*.015, floorY-4, W*.97, 24);
  // Floor grid lines (perspective)
  ctx.strokeStyle = 'rgba(0,80,140,.4)'; ctx.lineWidth = 1;
  for (let i = 0; i < 14; i++) {
    const fx = W*(.02 + i*(0.96/13));
    ctx.beginPath(); ctx.moveTo(fx, floorY); ctx.lineTo(fx, floorY+20); ctx.stroke();
  }
  ctx.strokeStyle = 'rgba(0,100,180,.5)'; ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.moveTo(W*.015, floorY); ctx.lineTo(W*.985, floorY); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(W*.015, floorY+10); ctx.lineTo(W*.985, floorY+10); ctx.stroke();

  // ── ROOM WALL DIVIDERS ──
  for (const r of ROOMS) {
    if (r.isBridge) continue;
    const rx = W*(r.relX + r.relW);
    // wall panel
    const wg = ctx.createLinearGradient(rx-6, ceilY, rx+6, ceilY);
    wg.addColorStop(0,'#0a2035'); wg.addColorStop(.5,'#1a3a55'); wg.addColorStop(1,'#0a2035');
    ctx.fillStyle = wg; ctx.fillRect(rx-5, ceilY+18, 10, floorY-ceilY-18);
    // door frame gap
    ctx.fillStyle = '#000810';
    ctx.fillRect(rx-8, floorY-H*.22, 16, H*.22);
    // door frame
    ctx.strokeStyle = '#2255aa'; ctx.lineWidth = 2;
    ctx.strokeRect(rx-8, floorY-H*.22, 16, H*.22);
    // door light strip
    const dl = fc%60<30 ? 'rgba(0,180,255,.6)' : 'rgba(0,100,180,.3)';
    ctx.fillStyle = dl; ctx.fillRect(rx-2, floorY-H*.22+4, 4, H*.22-8);
  }

  // ── ROOM DETAILS ──
  for (const r of ROOMS) {
    const rx = W*r.relX, rw = W*r.relW;
    drawRoomDecor(r, rx, sTop, rw, sH, floorY, ceilY);
    // Room name plate on wall
    ctx.fillStyle = '#0a1e2e'; ctx.strokeStyle = r.isBridge?'#004400':'#002244';
    ctx.lineWidth = 1; ctx.fillRect(rx+8, ceilY+22, rw-16, 22); ctx.strokeRect(rx+8, ceilY+22, rw-16, 22);
    ctx.fillStyle = r.isBridge ? '#66ff66' : '#4499bb';
    ctx.font = `bold ${Math.round(W*.011)}px Courier New`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(r.icon + '  ' + r.label, rx+rw/2, ceilY+33);
    ctx.textBaseline = 'alphabetic';
  }

  // ── BRIDGE ALERT glow ──
  const br = ROOMS[3];
  if (br && alertState==='show' && !bridgeReached) {
    const rx = W*br.relX, rw = W*br.relW;
    ctx.strokeStyle = `rgba(0,255,80,${.5+.3*Math.sin(fc*.12)})`; ctx.lineWidth = 4;
    ctx.strokeRect(rx+3, ceilY+3, rw-6, floorY-ceilY-3);
    const pulse = .5+.5*Math.sin(fc*.12);
    ctx.fillStyle = `rgba(0,255,80,${pulse*.12})`;
    ctx.fillRect(rx+3, ceilY+3, rw-6, floorY-ceilY-3);
    ctx.fillStyle = `rgba(0,255,80,${pulse})`;
    ctx.font = `bold ${Math.round(W*.02)}px Courier New`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('\u25B6\u25B6  ไปที่นี่!  \u25B6\u25B6', rx+rw/2, floorY - sH*.25);
    ctx.textBaseline = 'alphabetic';
  }

  drawWalker();

  // ── HUD ──
  ctx.fillStyle = 'rgba(0,10,25,.65)'; ctx.fillRect(0,0,W,62);
  ctx.fillStyle = '#aaddff'; ctx.font = `bold ${Math.round(W*.016)}px Courier New`;
  ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
  ctx.fillText('🧑\u200d🚀  ' + HERO, 18, 26);
  ctx.fillStyle = '#3a5568'; ctx.font = `${Math.round(W*.011)}px Courier New`;
  ctx.fillText('WASD / \u2191\u2193\u2190\u2192  \u0e40\u0e14\u0e34\u0e19\u0e44\u0e14\u0e49\u0e40\u0e25\u0e22', 18, 48);
  // ship status indicator
  ctx.fillStyle='#334455'; ctx.fillRect(W-160, 10, 145, 44);
  ctx.strokeStyle='#1a4060'; ctx.lineWidth=1; ctx.strokeRect(W-160,10,145,44);
  ctx.fillStyle='#3a8040'; ctx.font='bold 10px Courier New'; ctx.textAlign='right';
  ctx.fillText('LIFE SUPPORT  \u2588\u2588\u2588\u2588\u2588', W-18, 28);
  ctx.fillStyle='#aa6020';
  ctx.fillText('NAVIGATION    \u2588\u2588\u2588\u2591\u2591', W-18, 44);

  drawWalkAlert();

  // ── Bridge transition ──
  if (bridgeReached) {
    const a = Math.min(1, bridgeTransTimer/60);
    ctx.fillStyle = `rgba(0,30,0,${a*.9})`; ctx.fillRect(0,0,W,H);
    if (bridgeTransTimer > 20) {
      ctx.fillStyle = `rgba(0,255,80,${a})`;
      ctx.font = `bold ${Math.round(W*.042)}px Courier New`;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText('🚀  LAUNCHING...', W/2, H/2);
      ctx.fillStyle = `rgba(0,200,60,${a*.7})`;
      ctx.font = `${Math.round(W*.018)}px Courier New`;
      ctx.fillText('ยานออกจากสถานีแล้ว', W/2, H/2 + 50);
    }
    ctx.textBaseline = 'alphabetic';
  }
}

function drawRoomDecor(r, rx, sTop, rw, sH, floorY, ceilY) {
  const fY = floorY;
  ctx.save();
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';

  // ── CRYO BAY ──
  if (r.key === 'cryo') {
    // Ambient cold blue glow on walls
    const ambG = ctx.createRadialGradient(rx+rw/2, fY-sH*.25, 0, rx+rw/2, fY-sH*.25, rw*.6);
    ambG.addColorStop(0, 'rgba(0,80,160,.08)'); ambG.addColorStop(1, 'transparent');
    ctx.fillStyle = ambG; ctx.fillRect(rx, ceilY, rw, fY-ceilY);

    // 3 cryo pods
    for (let i = 0; i < 3; i++) {
      const px = rx + rw*(.18 + i*.32);
      const py = fY - 14;
      const podH = sH * .52, podW = rw * .2;
      // Pod base / housing
      ctx.fillStyle = '#001830'; ctx.strokeStyle = '#003870'; ctx.lineWidth = 2;
      roundRect(px - podW/2, py - podH, podW, podH, 8); ctx.fill(); ctx.stroke();
      // Pod inner gradient (frosted glass effect)
      const podG = ctx.createLinearGradient(px - podW/2, py-podH, px + podW/2, py-podH);
      podG.addColorStop(0,   'rgba(0,30,60,.9)');
      podG.addColorStop(0.45,'rgba(0,80,140,.6)');
      podG.addColorStop(0.55,'rgba(80,180,255,.25)');
      podG.addColorStop(1,   'rgba(0,30,60,.9)');
      ctx.fillStyle = podG;
      roundRect(px - podW/2+3, py-podH+3, podW-6, podH-6, 6); ctx.fill();
      // glass frost overlay
      ctx.fillStyle = 'rgba(120,210,255,.06)';
      roundRect(px - podW/2+3, py-podH+3, podW-6, podH-6, 6); ctx.fill();
      // Silhouette: person outline inside pod
      if (i === 0) {
        // Dr.Kungking pod — blue glow, alive
        ctx.strokeStyle = `rgba(0,200,255,${.5+.3*Math.sin(fc*.04+i)})`; ctx.lineWidth = 1.5;
        roundRect(px - podW/2+3, py-podH+3, podW-6, podH-6, 6); ctx.stroke();
        // head silhouette
        ctx.fillStyle = 'rgba(80,140,200,.7)';
        ctx.beginPath(); ctx.arc(px, py-podH+podH*.25, podW*.22, 0, Math.PI*2); ctx.fill();
        // body silhouette
        ctx.fillStyle = 'rgba(60,110,180,.5)';
        ctx.fillRect(px-podW*.2, py-podH+podH*.4, podW*.4, podH*.4);
        // Mist particles
        for (let m = 0; m < 4; m++) {
          const mx = px-podW*.4 + ((fc*2+m*31)%(podW*.8));
          const myy = py - 10 - m*7;
          ctx.fillStyle = `rgba(120,220,255,${.1+m*.04})`;
          ctx.beginPath(); ctx.ellipse(mx, myy, 8, 3, 0, 0, Math.PI*2); ctx.fill();
        }
        // Status: GREEN
        ctx.fillStyle = '#00ff80'; ctx.font = 'bold 8px Courier New';
        ctx.fillText('ALIVE', px, py - podH - 6);
      } else {
        // empty/dead pods — red tint
        ctx.strokeStyle = 'rgba(180,0,0,.4)'; ctx.lineWidth = 1;
        roundRect(px - podW/2+3, py-podH+3, podW-6, podH-6, 6); ctx.stroke();
        // X cross inside
        ctx.strokeStyle = 'rgba(180,0,0,.3)'; ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(px-podW*.25, py-podH+podH*.2); ctx.lineTo(px+podW*.25, py-podH+podH*.8);
        ctx.moveTo(px+podW*.25, py-podH+podH*.2); ctx.lineTo(px-podW*.25, py-podH+podH*.8);
        ctx.stroke();
        ctx.fillStyle = 'rgba(180,0,0,.6)'; ctx.font = 'bold 8px Courier New';
        ctx.fillText('OFFLINE', px, py - podH - 6);
      }
      // Status light bottom of pod
      const litC = i === 0 ? (fc%40<20?'#00ff80':'#008844') : '#440000';
      ctx.fillStyle = litC;
      ctx.beginPath(); ctx.arc(px, py - 6, 4, 0, Math.PI*2); ctx.fill();
      // Temperature readout
      ctx.fillStyle = i===0?'#4af':'#655';
      ctx.font = '7px Courier New'; ctx.fillText(i===0?'-196°C':'ERR', px, py-podH+podH*.93);
    }
    // Frost on floor in front of pods
    const frostG = ctx.createLinearGradient(rx, fY-20, rx, fY+2);
    frostG.addColorStop(0,'rgba(100,200,255,.08)'); frostG.addColorStop(1,'transparent');
    ctx.fillStyle = frostG; ctx.fillRect(rx, fY-20, rw, 20);
    // Pipes on back wall (horizontal)
    ctx.strokeStyle = '#0a2040'; ctx.lineWidth = 4;
    ctx.beginPath(); ctx.moveTo(rx+4, ceilY+48); ctx.lineTo(rx+rw-4, ceilY+48); ctx.stroke();
    ctx.strokeStyle = '#1a4070'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(rx+4, ceilY+52); ctx.lineTo(rx+rw-4, ceilY+52); ctx.stroke();
  }

  // ── LABORATORY ──
  else if (r.key === 'lab') {
    // Green ambient light
    const labG = ctx.createRadialGradient(rx+rw/2, fY-sH*.3, 0, rx+rw/2, fY-sH*.3, rw*.7);
    labG.addColorStop(0,'rgba(0,120,60,.07)'); labG.addColorStop(1,'transparent');
    ctx.fillStyle = labG; ctx.fillRect(rx, ceilY, rw, fY-ceilY);

    // Main workbench
    const bx = rx+rw*.06, bw = rw*.88, bh = sH*.12, by = fY - bh;
    ctx.fillStyle = '#0a2015'; ctx.strokeStyle = '#1a5030'; ctx.lineWidth = 1.5;
    ctx.fillRect(bx, by, bw, bh); ctx.strokeRect(bx, by, bw, bh);
    // bench legs
    for (const lx of [bx+4, bx+bw*.5-3, bx+bw-8]) {
      ctx.fillStyle = '#061510'; ctx.fillRect(lx, by+bh, 6, 10);
    }

    // Monitor 1 (left side) — data display
    const m1x = rx+rw*.08, m1y = fY - sH*.5, m1w = rw*.3, m1h = sH*.28;
    ctx.fillStyle = '#050f08'; ctx.strokeStyle = '#1a4025'; ctx.lineWidth=1.5;
    ctx.fillRect(m1x, m1y, m1w, m1h); ctx.strokeRect(m1x, m1y, m1w, m1h);
    // graph lines on monitor
    ctx.strokeStyle = '#00cc55'; ctx.lineWidth = 1.2;
    ctx.beginPath();
    for (let g = 0; g <= 5; g++) {
      const gy = m1y + m1h * (.2 + g*.12);
      ctx.moveTo(m1x+4, gy); ctx.lineTo(m1x+m1w-4, gy);
    }
    ctx.stroke();
    // animated scanning line
    const scanX = m1x+4 + ((fc*2)%(m1w-8));
    ctx.strokeStyle = `rgba(0,255,100,.8)`; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(scanX, m1y+4); ctx.lineTo(scanX, m1y+m1h-4); ctx.stroke();
    ctx.fillStyle='#00dd44'; ctx.font='6px Courier New';
    ctx.fillText('ASTROPHAGE DATA', m1x+m1w/2, m1y+m1h-6);

    // Test tubes rack (center of bench)
    const tubeColors = ['#00ff88','#ff8800','#4488ff','#ff4488','#88ff44'];
    for (let t = 0; t < 5; t++) {
      const tx = rx+rw*.38 + t*13, ty = by - 30;
      ctx.strokeStyle = 'rgba(180,220,255,.5)'; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.moveTo(tx, ty); ctx.lineTo(tx, by-2);
      ctx.arc(tx, by-2, 4, 0, Math.PI); ctx.stroke();
      // liquid
      const fillH = 12 + (t*7)%16;
      const tubeFillG = ctx.createLinearGradient(tx-3, ty+30-fillH, tx+3, ty+30-fillH);
      tubeFillG.addColorStop(0, tubeColors[t]); tubeFillG.addColorStop(1,'rgba(0,0,0,.2)');
      ctx.fillStyle = tubeFillG;
      ctx.fillRect(tx-3, by-2-fillH, 6, fillH);
    }

    // Monitor 2 (right side) — microscope view
    const m2x = rx+rw*.62, m2y = fY-sH*.42, m2w = rw*.3, m2h = sH*.22;
    ctx.fillStyle = '#050a0f'; ctx.strokeStyle = '#1a3040'; ctx.lineWidth=1.5;
    ctx.fillRect(m2x, m2y, m2w, m2h); ctx.strokeRect(m2x, m2y, m2w, m2h);
    // circle view (microscope)
    ctx.strokeStyle = '#224488'; ctx.lineWidth=1;
    ctx.beginPath(); ctx.arc(m2x+m2w*.5, m2y+m2h*.5, m2w*.3, 0,Math.PI*2); ctx.stroke();
    // spinning astrophage in microscope
    const ang = fc * .03;
    ctx.strokeStyle=`rgba(255,140,0,${.6+.3*Math.sin(fc*.08)})`; ctx.lineWidth=1;
    ctx.beginPath(); ctx.arc(m2x+m2w*.5+Math.cos(ang)*8, m2y+m2h*.5+Math.sin(ang)*5, 4,0,Math.PI*2); ctx.stroke();
    ctx.fillStyle='#2255aa'; ctx.font='6px Courier New';
    ctx.fillText('MICROSCOPE', m2x+m2w/2, m2y+m2h-5);

    // Wall pipes
    ctx.strokeStyle = '#0a2518'; ctx.lineWidth = 5;
    ctx.beginPath(); ctx.moveTo(rx+rw-4, ceilY+48); ctx.lineTo(rx+rw-4, fY-bh); ctx.stroke();
    ctx.strokeStyle = '#1a4028'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(rx+rw-10, ceilY+48); ctx.lineTo(rx+rw-10, fY-bh); ctx.stroke();
  }

  // ── CREW QUARTERS ──
  else if (r.key === 'quarters') {
    // Warm amber glow
    const qG = ctx.createRadialGradient(rx+rw*.3, fY-sH*.25, 0, rx+rw*.3, fY-sH*.25, rw*.6);
    qG.addColorStop(0,'rgba(120,60,0,.08)'); qG.addColorStop(1,'transparent');
    ctx.fillStyle = qG; ctx.fillRect(rx, ceilY, rw, fY-ceilY);

    // Bunk bed frame
    const bedX = rx+rw*.06, bedW = rw*.52, bedH = sH*.5, bedY = fY-bedH;
    // Legs
    ctx.fillStyle = '#1a0d00';
    ctx.fillRect(bedX+4, bedY, 6, bedH);
    ctx.fillRect(bedX+bedW-10, bedY, 6, bedH);
    // Lower bunk
    ctx.fillStyle = '#1a0e04'; ctx.strokeStyle = '#4a2800'; ctx.lineWidth = 1.5;
    ctx.fillRect(bedX+10, fY-bedH*.38, bedW-14, bedH*.34); ctx.strokeRect(bedX+10, fY-bedH*.38, bedW-14, bedH*.34);
    // mattress lower
    ctx.fillStyle = '#2a1a0a';
    ctx.fillRect(bedX+12, fY-bedH*.37, bedW-18, bedH*.18);
    // pillow lower
    ctx.fillStyle = '#3a2a18';
    ctx.fillRect(bedX+14, fY-bedH*.37+2, 18, 12);
    // Middle rail
    ctx.fillStyle='#2a1800'; ctx.fillRect(bedX+10, fY-bedH*.42, bedW-14, 5);
    // Upper bunk
    ctx.fillStyle = '#1a0e04'; ctx.strokeStyle = '#4a2800'; ctx.lineWidth = 1.5;
    ctx.fillRect(bedX+10, fY-bedH*.8, bedW-14, bedH*.34); ctx.strokeRect(bedX+10, fY-bedH*.8, bedW-14, bedH*.34);
    // mattress upper
    ctx.fillStyle = '#2a1a0a';
    ctx.fillRect(bedX+12, fY-bedH*.79, bedW-18, bedH*.18);
    // pillow upper
    ctx.fillStyle = '#3a2a18';
    ctx.fillRect(bedX+14, fY-bedH*.79+2, 18, 12);
    // small LED on bed frame
    ctx.fillStyle = fc%60<30?'#ff4400':'#882200';
    ctx.beginPath(); ctx.arc(bedX+14, fY-bedH*.405, 3, 0, Math.PI*2); ctx.fill();

    // Wall locker on right
    const lkX = rx+rw*.65, lkY = fY-sH*.58, lkW = rw*.28, lkH = sH*.52;
    ctx.fillStyle = '#160c04'; ctx.strokeStyle = '#3a2010'; ctx.lineWidth=1.5;
    ctx.fillRect(lkX, lkY, lkW, lkH); ctx.strokeRect(lkX, lkY, lkW, lkH);
    // locker door handle
    ctx.fillStyle = '#5a3010'; ctx.fillRect(lkX+lkW*.35, lkY+lkH*.42, lkW*.1, 20);
    ctx.strokeStyle = '#7a4020'; ctx.lineWidth=1; ctx.strokeRect(lkX+lkW*.35, lkY+lkH*.42, lkW*.1, 20);
    // locker label
    ctx.fillStyle = '#7a5020'; ctx.font = '7px Courier New';
    ctx.fillText('DR.KK', lkX+lkW*.5, lkY+12);
    // locker top vent slits
    for (let v=0;v<4;v++) {
      ctx.fillStyle='#0a0502'; ctx.fillRect(lkX+lkW*.15, lkY+lkH*.08+v*5, lkW*.7, 3);
    }

    // Framed photo on wall
    const phX = rx+rw*.68, phY = ceilY+56, phW = rw*.24, phH = sH*.18;
    ctx.fillStyle = '#2a1800'; ctx.strokeStyle = '#5a3800'; ctx.lineWidth=2;
    ctx.fillRect(phX, phY, phW, phH); ctx.strokeRect(phX, phY, phW, phH);
    // earth-like circle in photo
    ctx.fillStyle = '#0a2060'; ctx.fillRect(phX+2, phY+2, phW-4, phH-4);
    ctx.fillStyle = 'rgba(0,80,200,.6)'; ctx.beginPath();
    ctx.arc(phX+phW*.5, phY+phH*.5, Math.min(phW,phH)*.36, 0, Math.PI*2); ctx.fill();
    ctx.fillStyle = 'rgba(0,160,40,.4)'; ctx.beginPath();
    ctx.arc(phX+phW*.4, phY+phH*.5, Math.min(phW,phH)*.18, 0, Math.PI*2); ctx.fill();
    ctx.fillStyle='#556677'; ctx.font='6px Courier New';
    ctx.fillText('HOME', phX+phW*.5, phY+phH+7);

    // Small nightstand lamp
    const lampX = rx+rw*.58, lampY = fY - sH*.18;
    ctx.fillStyle='#1a1000'; ctx.fillRect(lampX-6, lampY, 12, 10);
    ctx.fillStyle='#2a1800'; ctx.fillRect(lampX-10, lampY+10, 20, 5);
    // lampshade
    ctx.fillStyle='#3a2000'; ctx.beginPath();
    ctx.moveTo(lampX-8,lampY); ctx.lineTo(lampX+8,lampY); ctx.lineTo(lampX+4,lampY-14); ctx.lineTo(lampX-4,lampY-14); ctx.closePath(); ctx.fill();
    // warm glow from lamp
    const lampGlow = ctx.createRadialGradient(lampX, lampY, 0, lampX, lampY, 40);
    lampGlow.addColorStop(0,`rgba(255,140,0,${.08+.04*Math.sin(fc*.05)})`); lampGlow.addColorStop(1,'transparent');
    ctx.fillStyle = lampGlow; ctx.beginPath(); ctx.arc(lampX, lampY, 40, 0, Math.PI*2); ctx.fill();
  }

  // ── BRIDGE ──
  else if (r.key === 'bridge') {
    // Main view window (porthole panoramic showing stars + asteroid warning)
    const winX = rx+rw*.06, winY = ceilY+48, winW = rw*.88, winH = sH*.32;
    ctx.fillStyle = '#000510';
    ctx.fillRect(winX, winY, winW, winH);
    ctx.strokeStyle = '#003355'; ctx.lineWidth = 3;
    ctx.strokeRect(winX, winY, winW, winH);
    // Star field in window
    ctx.fillStyle = '#ffffff';
    for (let s = 0; s < 24; s++) {
      const sx = winX+4 + (s*97)%(winW-8), sy = winY+4 + (s*67)%(winH-8);
      ctx.beginPath(); ctx.arc(sx, sy, .7, 0, Math.PI*2); ctx.fill();
    }
    // Far planet silhouette
    ctx.fillStyle = 'rgba(60,20,0,.8)'; ctx.beginPath();
    ctx.arc(winX+winW*.75, winY+winH*.6, 18, 0, Math.PI*2); ctx.fill();
    // asteroid cloud glow
    const aGlow = ctx.createRadialGradient(winX+winW*.3, winY+winH*.35, 0, winX+winW*.3, winY+winH*.35, 40);
    aGlow.addColorStop(0,`rgba(255,120,0,${.25+.15*Math.sin(fc*.1)})`); aGlow.addColorStop(1,'transparent');
    ctx.fillStyle = aGlow; ctx.beginPath(); ctx.arc(winX+winW*.3, winY+winH*.35, 40, 0, Math.PI*2); ctx.fill();
    // Asteroid warning text overlay
    ctx.fillStyle = `rgba(255,60,0,${.8+.2*Math.sin(fc*.15)})`;
    ctx.font = `bold ${Math.round(W*.012)}px Courier New`;
    ctx.fillText('\u26A0  ASTEROID FIELD DETECTED', winX+winW*.5, winY+winH*.18);
    ctx.fillStyle = '#ff8800'; ctx.font = `${Math.round(W*.009)}px Courier New`;
    ctx.fillText('ETA: 00:04:22 | BRACE FOR IMPACT', winX+winW*.5, winY+winH*.82);

    // Secondary status monitors (small side screens)
    const smonW = rw*.18, smonH = sH*.17;
    for (let m = 0; m < 2; m++) {
      const smX = m===0 ? rx+rw*.02 : rx+rw*.8;
      const smY = ceilY+52;
      ctx.fillStyle = '#001820'; ctx.strokeStyle = '#002840'; ctx.lineWidth=1;
      ctx.fillRect(smX, smY, smonW, smonH); ctx.strokeRect(smX, smY, smonW, smonH);
      // bar graphs
      for (let b=0;b<4;b++) {
        const bh2 = 5 + (m*17+b*13+Math.sin(fc*.05+b)*3)%18;
        ctx.fillStyle = ['#00ff88','#ffaa00','#4488ff','#ff4444'][b];
        ctx.fillRect(smX+4+b*(smonW/4+1), smY+smonH-6-bh2, smonW/4-2, bh2);
      }
    }

    // Control console
    const conX = rx+rw*.05, conW = rw*.9, conH = sH*.18, conY = fY-conH;
    ctx.fillStyle = '#001500'; ctx.strokeStyle = '#003300'; ctx.lineWidth=2;
    ctx.fillRect(conX, conY, conW, conH); ctx.strokeRect(conX, conY, conW, conH);
    // console top ridge
    const ridge = ctx.createLinearGradient(conX, conY, conX, conY+8);
    ridge.addColorStop(0,'#004020'); ridge.addColorStop(1,'#001500');
    ctx.fillStyle=ridge; ctx.fillRect(conX, conY, conW, 8);

    // Control buttons array
    const btnColors = ['#ff4444','#ffaa00','#44ff44','#4444ff','#ff88ff','#00ffff','#ffff00','#ff6600'];
    for (let b=0;b<8;b++) {
      const bx2 = conX+conW*(.08+b*.11), by2 = conY+conH*.35;
      const isLit = (fc + b*12) % 40 < 20;
      ctx.fillStyle = isLit ? btnColors[b] : btnColors[b].replace(/[0-9a-f]{2}/gi, m => Math.round(parseInt(m,16)*.3).toString(16).padStart(2,'0'));
      ctx.beginPath(); ctx.arc(bx2, by2, 6, 0, Math.PI*2); ctx.fill();
      ctx.strokeStyle='rgba(255,255,255,.2)'; ctx.lineWidth=1; ctx.stroke();
    }
    // Slider controls
    for (let s=0;s<3;s++) {
      const sx2 = conX+conW*(.08+s*.22), sy2 = conY+conH*.62;
      ctx.fillStyle = '#002200'; ctx.fillRect(sx2-1, sy2-14, 3, 28);
      const sliderPos = sy2 - 10 + (Math.sin(fc*.02+s)*8);
      ctx.fillStyle = '#55cc55';
      ctx.fillRect(sx2-6, sliderPos, 14, 6);
      ctx.strokeStyle = '#88ee88'; ctx.lineWidth=1; ctx.strokeRect(sx2-6, sliderPos, 14, 6);
    }
    // Navigation display center bottom
    const navX = conX+conW*.55, navY = conY+conH*.2, navR = conH*.35;
    ctx.fillStyle = '#001a00'; ctx.beginPath(); ctx.arc(navX, navY+navR*.2, navR, 0, Math.PI*2); ctx.fill();
    ctx.strokeStyle = '#005500'; ctx.lineWidth=1; ctx.stroke();
    // radar sweep
    const sweep = (fc*.03) % (Math.PI*2);
    ctx.strokeStyle = `rgba(0,255,80,${.6+.3*Math.sin(fc*.08)})`; ctx.lineWidth=2;
    ctx.beginPath(); ctx.moveTo(navX, navY+navR*.2);
    ctx.lineTo(navX+Math.cos(sweep)*navR*.9, navY+navR*.2+Math.sin(sweep)*navR*.9); ctx.stroke();
    // concentric rings
    ctx.strokeStyle = 'rgba(0,150,50,.4)'; ctx.lineWidth=1;
    for (const rr of [.4,.7,1]) {
      ctx.beginPath(); ctx.arc(navX, navY+navR*.2, navR*rr, 0, Math.PI*2); ctx.stroke();
    }
    // blip on radar
    ctx.fillStyle = `rgba(255,80,80,${.7+.3*Math.sin(fc*.06)})`;
    ctx.beginPath(); ctx.arc(navX+navR*.5, navY+navR*.2-navR*.3, 4, 0, Math.PI*2); ctx.fill();
    ctx.fillStyle = '#00cc44'; ctx.font='7px Courier New';
    ctx.fillText('NAV', navX, conY+conH-7);

    // Captain chair silhouette  
    const chX = rx+rw*.5, chY = fY-4;
    ctx.fillStyle = '#0a0800';
    // seat
    ctx.fillRect(chX-22, chY-28, 44, 18);
    // backrest
    ctx.fillRect(chX-18, chY-58, 36, 32);
    ctx.strokeStyle = '#2a2010'; ctx.lineWidth=1;
    ctx.strokeRect(chX-22, chY-28, 44, 18); ctx.strokeRect(chX-18, chY-58, 36, 32);
    // armrests
    ctx.fillStyle = '#080700';
    ctx.fillRect(chX-28, chY-28, 8, 14); ctx.fillRect(chX+20, chY-28, 8, 14);
    // headrest
    ctx.fillStyle = '#0f0c00'; ctx.fillRect(chX-12, chY-70, 24, 16);
  }

  ctx.restore();
}

function drawWalker() {
  const x = walker.x, y = walker.y;
  const isMoving = Math.abs(ship.vx) > 0.1 || Math.abs(ship.vy) > 0.1
    || keys['ArrowLeft']||keys['ArrowRight']||keys['ArrowUp']||keys['ArrowDown']
    || keys['a']||keys['d']||keys['w']||keys['s']||keys['A']||keys['D']||keys['W']||keys['S']
    || touchActive;

  // Walk cycle: legs swing when moving
  const walk = isMoving ? Math.sin(fc * 0.22) : 0;
  const bob  = isMoving ? Math.abs(Math.sin(fc * 0.22)) * -2 : 0;

  ctx.save();
  ctx.translate(x, y);
  if (walker.facing < 0) ctx.scale(-1, 1);

  // ── Shadow ──
  ctx.fillStyle = 'rgba(0,0,0,.35)';
  ctx.beginPath(); ctx.ellipse(0, 22, 14, 4, 0, 0, Math.PI*2); ctx.fill();

  ctx.translate(0, bob);

  // ── Legs ──
  const legSwing = walk * 10;
  ctx.lineCap = 'round';
  // Back leg
  ctx.strokeStyle = '#334477'; ctx.lineWidth = 7;
  ctx.beginPath();
  ctx.moveTo(-2, 8);
  ctx.lineTo(-4 - legSwing * 0.5, 18);
  ctx.lineTo(-5 - legSwing * 0.3, 26);
  ctx.stroke();
  // Front leg
  ctx.strokeStyle = '#4455aa';
  ctx.beginPath();
  ctx.moveTo(2, 8);
  ctx.lineTo(4 + legSwing * 0.5, 18);
  ctx.lineTo(5 + legSwing * 0.3, 26);
  ctx.stroke();
  // Boots
  ctx.fillStyle = '#223366';
  ctx.beginPath(); ctx.ellipse(-5 - legSwing*.3, 27, 6, 3, -0.2, 0, Math.PI*2); ctx.fill();
  ctx.fillStyle = '#2244aa';
  ctx.beginPath(); ctx.ellipse( 5 + legSwing*.3, 27, 6, 3,  0.2, 0, Math.PI*2); ctx.fill();

  // ── Body / Spacesuit ──
  const bodyGrad = ctx.createLinearGradient(-12, -10, 12, 10);
  bodyGrad.addColorStop(0, '#6699cc');
  bodyGrad.addColorStop(0.4, '#aaccee');
  bodyGrad.addColorStop(1, '#334466');
  ctx.fillStyle = bodyGrad;
  ctx.beginPath();
  ctx.moveTo(-11, 8); ctx.lineTo(-12, -4);
  ctx.quadraticCurveTo(-12, -12, 0, -12);
  ctx.quadraticCurveTo(12, -12, 12, -4);
  ctx.lineTo(11, 8); ctx.quadraticCurveTo(0, 12, -11, 8);
  ctx.closePath(); ctx.fill();
  ctx.strokeStyle = '#88bbdd'; ctx.lineWidth = 1; ctx.stroke();

  // Suit chest panel
  ctx.fillStyle = '#002244';
  ctx.fillRect(-5, -7, 10, 7);
  ctx.fillStyle = fc % 40 < 20 ? '#00ff88' : '#004422'; // blinking light
  ctx.beginPath(); ctx.arc(-2, -3, 2, 0, Math.PI*2); ctx.fill();
  ctx.fillStyle = '#ffaa00';
  ctx.beginPath(); ctx.arc(3, -3, 1.5, 0, Math.PI*2); ctx.fill();

  // ── Arms ──
  const armSwing = walk * 8;
  // Back arm
  ctx.strokeStyle = '#334477'; ctx.lineWidth = 6;
  ctx.beginPath(); ctx.moveTo(-10, -6); ctx.lineTo(-14, 4 + armSwing); ctx.stroke();
  ctx.fillStyle = '#334477';
  ctx.beginPath(); ctx.arc(-14, 5 + armSwing, 3.5, 0, Math.PI*2); ctx.fill();
  // Front arm
  ctx.strokeStyle = '#5577bb'; ctx.lineWidth = 6;
  ctx.beginPath(); ctx.moveTo(10, -6); ctx.lineTo(14, 4 - armSwing); ctx.stroke();
  ctx.fillStyle = '#5577bb';
  ctx.beginPath(); ctx.arc(14, 5 - armSwing, 3.5, 0, Math.PI*2); ctx.fill();

  // ── Helmet ──
  // Outer ring
  ctx.fillStyle = '#445566';
  ctx.beginPath(); ctx.arc(0, -18, 13.5, 0, Math.PI*2); ctx.fill();
  ctx.strokeStyle = '#7799aa'; ctx.lineWidth = 1.5; ctx.stroke();
  // Visor
  const visorGrad = ctx.createRadialGradient(-3, -21, 1, 0, -18, 12);
  visorGrad.addColorStop(0, 'rgba(180,240,255,0.95)');
  visorGrad.addColorStop(0.4, 'rgba(80,160,220,0.7)');
  visorGrad.addColorStop(1, 'rgba(0,60,120,0.85)');
  ctx.fillStyle = visorGrad;
  ctx.beginPath(); ctx.arc(0, -18, 10, 0, Math.PI*2); ctx.fill();
  ctx.strokeStyle = '#aaddff'; ctx.lineWidth = 1; ctx.stroke();
  // Visor shine
  ctx.fillStyle = 'rgba(255,255,255,0.45)';
  ctx.beginPath(); ctx.ellipse(-3, -22, 4, 2.5, -0.4, 0, Math.PI*2); ctx.fill();
  // Face inside visor
  ctx.fillStyle = 'rgba(255,200,160,0.7)';
  ctx.beginPath(); ctx.arc(0, -18, 6, 0, Math.PI*2); ctx.fill();
  ctx.fillStyle = '#222';
  ctx.beginPath(); ctx.arc(-2, -19, 1, 0, Math.PI*2); ctx.fill(); // left eye
  ctx.beginPath(); ctx.arc( 2, -19, 1, 0, Math.PI*2); ctx.fill(); // right eye
  ctx.strokeStyle = '#333'; ctx.lineWidth = 0.8;
  ctx.beginPath(); ctx.arc(0, -17, 2, 0.1, Math.PI-0.1); ctx.stroke(); // smile
  // Helmet antenna
  ctx.strokeStyle = '#aabbcc'; ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.moveTo(6, -29); ctx.lineTo(6, -34); ctx.stroke();
  ctx.fillStyle = '#ff4444';
  ctx.beginPath(); ctx.arc(6, -35, 2, 0, Math.PI*2); ctx.fill();

  ctx.restore();

  // Name tag above
  ctx.fillStyle = '#aaddff';
  ctx.font = `bold ${Math.round(W * .012)}px Courier New`;
  ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
  ctx.fillText(HERO, x, y - 44);
}

function drawWalkAlert() {
  if (alertState==='none') return;
  if (alertState==='flash') {
    const a=.18*Math.abs(Math.sin(fc*.15));
    ctx.fillStyle=`rgba(255,0,0,${a})`; ctx.fillRect(0,0,W,H);
    ctx.strokeStyle=`rgba(255,60,0,${.5+.5*Math.abs(Math.sin(fc*.15))})`; ctx.lineWidth=8;
    ctx.strokeRect(4,4,W-8,H-8);
    ctx.fillStyle=`rgba(255,100,0,${.8+.2*Math.sin(fc*.2)})`;
    ctx.font=`bold ${Math.round(W*.034)}px Courier New`;
    ctx.textAlign='center'; ctx.textBaseline='alphabetic';
    ctx.fillText('\u26a0\ufe0f  RED ALERT  \u26a0\ufe0f', W/2, H*.12);
  }
  if (alertState==='show'||alertState==='flash') {
    const bw=Math.min(560,W*.72), bh=150, bx=W/2-bw/2, by=H*.73;
    ctx.fillStyle='rgba(25,0,0,.94)'; roundRect(bx,by,bw,bh,10); ctx.fill();
    ctx.strokeStyle='#ff4400'; ctx.lineWidth=2; ctx.stroke();
    ctx.fillStyle='#ff6644'; ctx.font=`bold ${Math.round(W*.017)}px Courier New`;
    ctx.textAlign='center'; ctx.textBaseline='alphabetic';
    ctx.fillText('\u26a0\ufe0f ASTEROID INCOMING!', W/2, by+32);
    ctx.fillStyle='#ffcc88'; ctx.font=`${Math.round(W*.013)}px Courier New`;
    ctx.fillText(HERO+' \u2014 \u0e44\u0e1b\u0e17\u0e35\u0e48 BRIDGE \u0e40\u0e1e\u0e37\u0e48\u0e2d\u0e02\u0e31\u0e1a\u0e22\u0e32\u0e19\u0e2b\u0e25\u0e1a\u0e2d\u0e38\u0e01\u0e01\u0e32\u0e1a\u0e32\u0e15!', W/2, by+62);
    if (alertState==='show') {
      ctx.fillStyle='#88ff44'; ctx.font=`${Math.round(W*.013)}px Courier New`;
      ctx.fillText('\u25B6\u25B6 \u0e40\u0e14\u0e34\u0e19\u0e44\u0e1b\u0e17\u0e32\u0e07 BRIDGE \u0e14\u0e49\u0e32\u0e19\u0e02\u0e27\u0e32', W/2, by+92);
      ctx.fillStyle='#556677'; ctx.font=`${Math.round(W*.01)}px Courier New`;
      ctx.fillText('(\u0e01\u0e14 \u2192 \u0e2b\u0e23\u0e37\u0e2d D \u0e40\u0e14\u0e34\u0e19\u0e02\u0e27\u0e32)', W/2, by+116);
    }
  }
}

// ─────────────────────────────────────────────────────────────────
//  PHASE 2 — ASTEROID DODGE  (intense 30-second barrage)
// ─────────────────────────────────────────────────────────────────
const ship = {x:0,y:0,vx:0,vy:0,health:100,invincible:0};
const ASTEROID_FRAMES = 1800; // 30 s
let asteroids=[], astTimer=0, astInterval=22;
let flashMsg='', flashTimer=0;

function initAsteroid() {
  ship.x=W*.18; ship.y=H/2; ship.vx=0; ship.vy=0;
  ship.health=100; ship.invincible=0;
  asteroids=[]; particles=[]; astTimer=0; astInterval=22;
  flashMsg='🪨 ASTEROID FIELD!'; flashTimer=100;
  initStars();
}

function updateAsteroid() {
  fc++;
  scrollStars(2.2);
  // Ship control
  let dx=0,dy=0;
  if (keys['ArrowLeft'] ||keys['a']||keys['A']) dx=-1;
  if (keys['ArrowRight']||keys['d']||keys['D']) dx= 1;
  if (keys['ArrowUp']   ||keys['w']||keys['W']) dy=-1;
  if (keys['ArrowDown'] ||keys['s']||keys['S']) dy= 1;
  if (touchActive) { dx=touchDir.x; dy=touchDir.y; }
  const spd=5.5, fr=.82;
  ship.vx=ship.vx*fr+dx*spd*(1-fr);
  ship.vy=ship.vy*fr+dy*spd*(1-fr);
  const s=Math.hypot(ship.vx,ship.vy); if(s>spd){ship.vx*=spd/s;ship.vy*=spd/s;}
  ship.x=Math.max(35,Math.min(W-35,ship.x+ship.vx));
  ship.y=Math.max(30,Math.min(H-30,ship.y+ship.vy));
  if(ship.invincible>0) ship.invincible--;
  // Thrust sparks
  for(let i=0;i<2;i++) particles.push({
    x:ship.x-34,y:ship.y+(Math.random()-.5)*12,
    vx:-3-Math.random()*3,vy:(Math.random()-.5)*2,
    life:1,decay:.06+Math.random()*.04,r:2+Math.random()*3,
    color:['#ff8800','#ffcc00','#ff4400'][Math.floor(Math.random()*3)]
  });
  // Spawn asteroids — LOTS
  astTimer++;
  const prog=fc/ASTEROID_FRAMES;
  astInterval=Math.max(6,22-Math.floor(prog*16));
  if(astTimer>=astInterval){ astTimer=0; spawnAst(prog); }
  // Move asteroids
  for(let i=asteroids.length-1;i>=0;i--){
    const a=asteroids[i]; a.x+=a.vx; a.y+=a.vy; a.rot+=a.rs;
    if(a.x<-90||a.y<-90||a.y>H+90) asteroids.splice(i,1);
  }
  updateParticles();
  // Collision
  if(ship.invincible<=0){
    for(let i=asteroids.length-1;i>=0;i--){
      const a=asteroids[i];
      if(Math.hypot(ship.x-a.x,ship.y-a.y)<22+a.r*.6){
        ship.health-=25; ship.invincible=80;
        explodeAt(ship.x,ship.y,22); asteroids.splice(i,1);
        if(ship.health<=0){startPhase('lose');return;}
      }
    }
  }
  if(flashTimer>0) flashTimer--;
  if(fc>=ASTEROID_FRAMES) startPhase('dock');
}

function spawnAst(prog) {
  const em=['🪨','\u2604\ufe0f','💫','🌑'];
  const size=14+Math.random()*32, spd=3+Math.random()*4+prog*5;
  const side=Math.random();
  let x,y,vx,vy;
  if(side<.55){x=W+size;y=Math.random()*H;const a=Math.PI+(Math.random()-.5)*.9;vx=Math.cos(a)*spd;vy=Math.sin(a)*spd;}
  else if(side<.77){x=Math.random()*W;y=-size;vx=(Math.random()-.5)*2;vy=spd*.8;}
  else{x=Math.random()*W;y=H+size;vx=(Math.random()-.5)*2;vy=-spd*.8;}
  asteroids.push({x,y,vx,vy,r:size,emoji:em[Math.floor(Math.random()*em.length)],rot:Math.random()*Math.PI*2,rs:(Math.random()-.5)*.1});
}

function drawAsteroid() {
  drawSpace(); drawStars(); drawParticles();
  for(const a of asteroids){
    ctx.save(); ctx.translate(a.x,a.y); ctx.rotate(a.rot);
    ctx.font=`${a.r*1.8}px serif`; ctx.textAlign='center'; ctx.textBaseline='middle';
    ctx.fillText(a.emoji,0,0); ctx.restore();
  }
  drawShipAt(ship.x,ship.y,ship.invincible);
  // HUD
  drawBar(16,16,200,18,ship.health/100,ship.health>50?'#22cc55':ship.health>25?'#ffaa00':'#ff2200');
  ctx.fillStyle='#fff'; ctx.font='bold 12px Courier New'; ctx.textAlign='left'; ctx.textBaseline='alphabetic';
  ctx.fillText('\u2764\ufe0f '+Math.max(0,Math.round(ship.health))+'%',22,50);
  const prog=fc/ASTEROID_FRAMES;
  drawBar(16,58,200,10,prog,'#0088ff');
  ctx.fillStyle='#aaddff'; ctx.font='11px Courier New'; ctx.fillText('\u0e1d\u0e48\u0e32\u0e2a\u0e19\u0e32\u0e21\u0e2d\u0e38\u0e01\u0e01\u0e32\u0e1a\u0e32\u0e15',22,82);
  ctx.fillStyle='#aaddff'; ctx.font=`bold ${Math.round(W*.015)}px Courier New`;
  ctx.textAlign='center';
  ctx.fillText('🛸 King Rocky \u2014 \u0e1d\u0e48\u0e32\u0e2a\u0e19\u0e32\u0e21\u0e2d\u0e38\u0e01\u0e01\u0e32\u0e1a\u0e32\u0e15!', W/2, 28);
  ctx.fillStyle='#556688'; ctx.font=`${Math.round(W*.011)}px Courier New`;
  ctx.fillText('\u2191\u2193\u2190\u2192 \u0e2b\u0e25\u0e1a!', W/2, 46);
  if(prog>.8){
    const rem=Math.ceil((ASTEROID_FRAMES-fc)/60);
    ctx.fillStyle='#ffcc00'; ctx.font=`bold ${Math.round(W*.032)}px Courier New`;
    ctx.textAlign='center';
    ctx.fillText('\u26a1 \u0e2d\u0e2d\u0e01\u0e08\u0e32\u0e01\u0e2a\u0e19\u0e32\u0e21... '+rem+'s', W/2, H*.12);
  }
  if(flashTimer>0){
    const a=flashTimer/100;
    ctx.fillStyle=`rgba(255,80,0,${a*.3})`; ctx.fillRect(0,0,W,H);
    ctx.fillStyle=`rgba(255,200,0,${a})`;
    ctx.font=`bold ${Math.round(W*.05)}px Courier New`; ctx.textAlign='center';
    ctx.fillText(flashMsg, W/2, H/2);
  }
}

// ─────────────────────────────────────────────────────────────────
//  PHASE 3 — DOCK WITH ROCKY
// ─────────────────────────────────────────────────────────────────
let rockyY=0, dockTimer=0, docked=false, dockFlashTimer=0;
const DOCK_NEED=300; // 5 s

function initDock() {
  rockyY=H/2; dockTimer=0; docked=false; dockFlashTimer=0;
  ship.x=W*.12; ship.y=H/2; ship.vx=0; ship.vy=0; ship.health=100; ship.invincible=0;
  asteroids=[]; particles=[];
  flashMsg='👽 \u0e1e\u0e1a\u0e22\u0e32\u0e19\u0e41\u0e1b\u0e25\u0e01\u0e1b\u0e25\u0e2d\u0e21!'; flashTimer=90;
  initStars();
}

function updateDock() {
  fc++;
  scrollStars(.4);
  rockyY = H/2 + Math.sin(fc*.025)*H*.30;
  // Ship control
  let dx=0,dy=0;
  if(keys['ArrowLeft'] ||keys['a']||keys['A']) dx=-1;
  if(keys['ArrowRight']||keys['d']||keys['D']) dx= 1;
  if(keys['ArrowUp']   ||keys['w']||keys['W']) dy=-1;
  if(keys['ArrowDown'] ||keys['s']||keys['S']) dy= 1;
  if(touchActive){dx=touchDir.x;dy=touchDir.y;}
  const spd=5, fr=.84;
  ship.vx=ship.vx*fr+dx*spd*(1-fr);
  ship.vy=ship.vy*fr+dy*spd*(1-fr);
  ship.x=Math.max(30,Math.min(W*.62,ship.x+ship.vx));
  ship.y=Math.max(30,Math.min(H-30,ship.y+ship.vy));
  // Thrust
  for(let i=0;i<2;i++) particles.push({
    x:ship.x-34,y:ship.y+(Math.random()-.5)*12,
    vx:-2-Math.random()*2,vy:(Math.random()-.5)*1.5,
    life:1,decay:.07+Math.random()*.04,r:2+Math.random()*3,
    color:['#ff8800','#ffcc00'][Math.floor(Math.random()*2)]
  });
  updateParticles();
  // Dock check
  const rockyX=W*.76;
  const dist=Math.hypot(ship.x-rockyX, ship.y-rockyY);
  if(dist<90) dockTimer=Math.min(DOCK_NEED,dockTimer+1);
  else dockTimer=Math.max(0,dockTimer-2);

  if(flashTimer>0) flashTimer--;
  if(dockTimer>=DOCK_NEED&&!docked){ docked=true; dockFlashTimer=130; }
  if(docked){ dockFlashTimer--; if(dockFlashTimer<=0) startPhase('planet'); }
}

function drawDock() {
  drawSpace(); drawStars(); drawParticles();
  const rockyX=W*.76;
  // Dock zone ring
  const inRange=dockTimer>0;
  ctx.globalAlpha=inRange?.4:.13;
  ctx.strokeStyle=inRange?'#00ff88':'#446655'; ctx.lineWidth=2;
  ctx.setLineDash([8,6]);
  ctx.beginPath(); ctx.arc(rockyX,rockyY,90,0,Math.PI*2); ctx.stroke();
  ctx.setLineDash([]); ctx.globalAlpha=1;
  // Rocky's saucer
  drawRockyShip(rockyX,rockyY);
  // Player ship
  drawShipAt(ship.x,ship.y,ship.invincible);
  // Arrow guide
  const dist=Math.hypot(ship.x-rockyX,ship.y-rockyY);
  if(dist>130){
    const ang=Math.atan2(rockyY-ship.y,rockyX-ship.x);
    ctx.save(); ctx.translate(ship.x+Math.cos(ang)*80,ship.y+Math.sin(ang)*80); ctx.rotate(ang);
    ctx.fillStyle='#ffcc00'; ctx.font='22px serif'; ctx.textAlign='center'; ctx.textBaseline='middle';
    ctx.fillText('\u25B6',0,0); ctx.restore();
  }
  // HUD
  ctx.fillStyle='#aaddff'; ctx.font=`bold ${Math.round(W*.019)}px Courier New`;
  ctx.textAlign='center'; ctx.textBaseline='alphabetic';
  ctx.fillText('👽 \u0e1e\u0e1a\u0e22\u0e32\u0e19\u0e41\u0e1b\u0e25\u0e01 \u2014 \u0e40\u0e02\u0e49\u0e32\u0e40\u0e17\u0e35\u0e22บ\u0e22\u0e32\u0e19\u0e43\u0e2b\u0e49\u0e44\u0e14\u0e49 5 \u0e27\u0e34\u0e19\u0e32\u0e17\u0e35!', W/2, 30);
  const prog=dockTimer/DOCK_NEED;
  const bw=Math.min(420,W*.48);
  drawBar(W/2-bw/2, 40, bw, 16, prog, `hsl(${120*prog},100%,50%)`);
  ctx.fillStyle='#fff'; ctx.font='bold 11px Courier New'; ctx.textAlign='center';
  ctx.fillText('🔗 DOCKING '+Math.round(prog*100)+'%  ('+Math.round(dockTimer/60*10)/10+'s / 5s)', W/2, 72);
  // Flash
  if(flashTimer>0){
    const a=flashTimer/90;
    ctx.fillStyle=`rgba(0,130,80,${a*.25})`; ctx.fillRect(0,0,W,H);
    ctx.fillStyle=`rgba(0,255,150,${a})`;
    ctx.font=`bold ${Math.round(W*.04)}px Courier New`; ctx.textAlign='center';
    ctx.fillText(flashMsg,W/2,H/2);
  }
  // Docked!
  if(docked){
    const a=Math.min(1,(130-dockFlashTimer)/60);
    ctx.fillStyle=`rgba(0,180,90,${a*.75})`; ctx.fillRect(0,0,W,H);
    ctx.fillStyle='#00ff88'; ctx.font=`bold ${Math.round(W*.045)}px Courier New`;
    ctx.textAlign='center';
    ctx.fillText('🔗 \u0e40\u0e0a\u0e37่\u0e2d\u0e21\u0e22\u0e32\u0e19\u0e2a\u0e33\u0e40\u0e23\u0e47\u0e08!', W/2, H/2-20);
    ctx.fillStyle='#aaffcc'; ctx.font=`${Math.round(W*.022)}px Courier New`;
    ctx.fillText('\u0e21\u0e38\u0e48\u0e07\u0e2b\u0e19\u0e49\u0e32\u0e2a\u0e39\u0e48\u0e14\u0e32\u0e27\u0e40\u0e04\u0e23\u0e32\u0e30\u0e2b\u0e4c Erid...', W/2, H/2+30);
  }
}

function drawRockyShip(x,y) {
  ctx.save(); ctx.translate(x,y);
  // Glow
  const g=ctx.createRadialGradient(0,0,10,0,0,85);
  g.addColorStop(0,'rgba(100,255,150,.18)'); g.addColorStop(1,'transparent');
  ctx.fillStyle=g; ctx.beginPath(); ctx.arc(0,0,85,0,Math.PI*2); ctx.fill();
  // Saucer
  ctx.beginPath(); ctx.ellipse(0,0,68,22,0,0,Math.PI*2);
  const sg=ctx.createLinearGradient(-68,-22,68,22);
  sg.addColorStop(0,'#334433'); sg.addColorStop(.5,'#88aa88'); sg.addColorStop(1,'#223322');
  ctx.fillStyle=sg; ctx.fill(); ctx.strokeStyle='#44ff88'; ctx.lineWidth=2; ctx.stroke();
  // Dome
  ctx.beginPath(); ctx.ellipse(0,-8,32,24,0,0,Math.PI,Math.PI*2);
  const dg=ctx.createRadialGradient(-8,-18,2,0,-10,32);
  dg.addColorStop(0,'rgba(150,255,180,.8)'); dg.addColorStop(1,'rgba(0,80,30,.5)');
  ctx.fillStyle=dg; ctx.fill(); ctx.strokeStyle='#66ffaa'; ctx.lineWidth=1.5; ctx.stroke();
  ctx.font='20px serif'; ctx.textAlign='center'; ctx.textBaseline='middle';
  ctx.fillText('🪨',0,-14);
  // Rim lights
  for(let i=0;i<9;i++){
    const a=(i/9)*Math.PI*2+fc*.05;
    ctx.fillStyle=i%2===0?'#00ff88':'#ffcc00';
    ctx.beginPath(); ctx.arc(Math.cos(a)*58,Math.sin(a)*11,4,0,Math.PI*2); ctx.fill();
  }
  ctx.restore(); ctx.textBaseline='alphabetic';
  ctx.fillStyle='#88ffcc'; ctx.font=`bold ${Math.round(W*.013)}px Courier New`;
  ctx.textAlign='center'; ctx.fillText('ROCKY',x,y+46);
}

// ─────────────────────────────────────────────────────────────────
//  PHASE 4 — PLANET COMBAT
// ─────────────────────────────────────────────────────────────────
const pp = {x:0,y:0,speed:4,health:100,facing:1,bullets:[],shootCD:0};
const rc = {x:0,y:0,bullets:[]};
let aliens=[], alienTimer=0, alienInterval=90, aliensKilled=0, alienWave=0;
const KILL_TARGET=20;
let pParticles=[];

function initPlanet() {
  pp.x=W*.1; pp.y=H*.68; pp.health=100; pp.facing=1; pp.bullets=[]; pp.shootCD=0;
  rc.x=W*.24; rc.y=H*.68; rc.bullets=[];
  aliens=[]; alienTimer=0; alienInterval=90; aliensKilled=0; alienWave=0;
  pParticles=[]; particles=[];
  flashMsg='🌍 \u0e25\u0e07\u0e08\u0e2d\u0e14\u0e17\u0e35\u0e48 ERID!'; flashTimer=90;
}

function updatePlanet() {
  fc++;
  // Player move
  if(keys['ArrowLeft'] ||keys['a']||keys['A']){pp.x-=pp.speed;pp.facing=-1;}
  if(keys['ArrowRight']||keys['d']||keys['D']){pp.x+=pp.speed;pp.facing= 1;}
  pp.x=Math.max(30,Math.min(W*.55,pp.x));
  // Shoot
  if(pp.shootCD>0) pp.shootCD--;
  if((keysJP[' ']||keysJP['z']||keysJP['Z'])&&pp.shootCD===0){
    pp.bullets.push({x:pp.x+22,y:pp.y-10,vx:10,vy:0,alive:true});
    pp.shootCD=14;
  }
  // Rocky auto-shoots
  if(fc%55===0&&aliens.length>0){
    let near=null,nd=9999;
    for(const a of aliens){const d=a.x-rc.x;if(d>0&&d<nd){nd=d;near=a;}}
    if(near) rc.bullets.push({x:rc.x+22,y:rc.y-10,vx:9,vy:0,alive:true});
  }
  // Move bullets
  for(const b of pp.bullets){b.x+=b.vx;}
  for(const b of rc.bullets){b.x+=b.vx;}
  pp.bullets=pp.bullets.filter(b=>b.x<W+20&&b.alive);
  rc.bullets=rc.bullets.filter(b=>b.x<W+20&&b.alive);
  // Spawn aliens
  if(aliensKilled<KILL_TARGET){
    alienTimer++;
    alienInterval=Math.max(45,90-alienWave*8);
    if(alienTimer>=alienInterval){
      alienTimer=0;
      aliens.push({
        x:W+30, y:H*.68+(Math.random()-.5)*H*.08,
        vx:-(1.5+Math.random()*1.5+alienWave*.3),
        hp:1+Math.floor(alienWave/4),
        maxHp:1+Math.floor(alienWave/4),
        emoji:['👾','🤖','👽'][Math.floor(Math.random()*3)],
        shootT:Math.floor(Math.random()*80), bullets:[],
      });
    }
  }
  // Update aliens
  for(let i=aliens.length-1;i>=0;i--){
    const a=aliens[i]; a.x+=a.vx;
    // Alien shoots
    a.shootT++; if(a.shootT>80+Math.random()*60){a.shootT=0;a.bullets.push({x:a.x-15,y:a.y-5,vx:-5,alive:true});}
    // Alien bullets
    for(const b of a.bullets) b.x+=b.vx;
    for(const b of a.bullets){
      if(Math.hypot(b.x-pp.x,b.y-pp.y)<26&&b.alive){
        pp.health-=12; b.alive=false;
        if(pp.health<=0){startPhase('lose');return;}
      }
    }
    a.bullets=a.bullets.filter(b=>b.x>-20&&b.alive);
    // Alien reaches left
    if(a.x<pp.x+28){pp.health-=18;pExplode(a.x,a.y);aliens.splice(i,1);if(pp.health<=0){startPhase('lose');return;}continue;}
    if(a.x<-50){aliens.splice(i,1);continue;}
  }
  // Bullet-alien collisions
  for(const src of [pp.bullets, rc.bullets]){
    for(const b of src){
      for(let i=aliens.length-1;i>=0;i--){
        const a=aliens[i];
        if(b.alive&&Math.hypot(b.x-a.x,b.y-a.y)<30){
          b.alive=false; a.hp--;
          pExplode(a.x,a.y);
          if(a.hp<=0){aliensKilled++;aliens.splice(i,1);if(aliensKilled%5===0)alienWave++;}
          break;
        }
      }
    }
  }
  // Planet particles
  for(let i=pParticles.length-1;i>=0;i--){
    const p=pParticles[i];p.x+=p.vx;p.y+=p.vy;p.life-=p.decay;
    if(p.life<=0)pParticles.splice(i,1);
  }
  if(flashTimer>0) flashTimer--;
  if(aliensKilled>=KILL_TARGET&&aliens.length===0) startPhase('win');
}

function pExplode(x,y){
  for(let i=0;i<10;i++){
    const a=Math.random()*Math.PI*2,s=2+Math.random()*4;
    pParticles.push({x,y,vx:Math.cos(a)*s,vy:Math.sin(a)*s-1,life:1,decay:.04+Math.random()*.04,r:2+Math.random()*3,
      color:['#ff6600','#ffaa00','#ff2200','#ffff00'][Math.floor(Math.random()*4)]});
  }
}

// ── Pixel art cloud helper ──
function drawPixelCloud(cx, cy, sc) {
  ctx.fillStyle = '#f0c880';
  const blobs = [[0,0,30,19],[-24,7,22,15],[24,7,20,14],[-11,-11,24,16],[13,-9,20,14],[0,10,26,13]];
  for (const [bx,by,bw,bh] of blobs) {
    ctx.beginPath(); ctx.ellipse(cx+bx*sc, cy+by*sc, bw*sc, bh*sc, 0, 0, Math.PI*2); ctx.fill();
  }
  // highlight
  ctx.fillStyle = 'rgba(255,255,220,.35)';
  ctx.beginPath(); ctx.ellipse(cx-8*sc, cy-12*sc, 14*sc, 7*sc, -0.3, 0, Math.PI*2); ctx.fill();
}

// ── Pixel art platform helper ──
function drawPlatform(px, py, pw, ph) {
  // Body gradient (brownish rock)
  const platG = ctx.createLinearGradient(px, py, px, py+ph);
  platG.addColorStop(0,   '#a06838');
  platG.addColorStop(0.15,'#8b5a2c');
  platG.addColorStop(0.6, '#7a4e24');
  platG.addColorStop(1,   '#5c3818');
  ctx.fillStyle = platG; ctx.fillRect(px, py, pw, ph);
  // rock layer striations
  for (let sy = py+14; sy < py+ph; sy += 16) {
    ctx.fillStyle = 'rgba(0,0,0,.1)'; ctx.fillRect(px+2, sy, pw-4, 3);
    ctx.fillStyle = 'rgba(255,255,255,.04)'; ctx.fillRect(px+2, sy+3, pw-4, 1);
  }
  // hanging vines/moss on sides
  ctx.fillStyle = '#2d6e2e';
  for (let vx = px+8; vx < px+pw-4; vx += 14) {
    const vlen = 6 + ((vx * 7 + 3) % 16);
    ctx.fillRect(vx, py+ph-2, 3, vlen);
    ctx.fillStyle = '#3a8e3e'; ctx.fillRect(vx, py+ph+vlen-4, 5, 4);
    ctx.fillStyle = '#2d6e2e';
  }
  // dark bottom shadow
  ctx.fillStyle = 'rgba(0,0,0,.28)'; ctx.fillRect(px, py+ph-4, pw, 4);
  // Grass top
  ctx.fillStyle = '#56c45a'; ctx.fillRect(px, py, pw, 9);
  ctx.fillStyle = '#3e9e42'; ctx.fillRect(px, py+9, pw, 4);
  // grass tufts
  ctx.fillStyle = '#70d874';
  for (let tx = px+5; tx < px+pw-4; tx += 10) {
    ctx.fillRect(tx,   py-4, 3, 6);
    ctx.fillRect(tx+4, py-6, 2, 8);
  }
}

// ── Pixel art tree helper ──
function drawPixelTree(tx, ty, sz) {
  // trunk
  ctx.fillStyle = '#7b4520';
  ctx.fillRect(tx - sz*.12, ty, sz*.24, sz*.48);
  ctx.fillStyle = '#5c3318';
  ctx.fillRect(tx + sz*.02, ty, sz*.08, sz*.48); // shadow side
  // foliage layers (wide at bottom)
  const layers = [
    ['#2e7d32', sz*.92, sz*.38, 0],
    ['#388e3c', sz*.74, sz*.34, -sz*.24],
    ['#43a047', sz*.54, sz*.30, -sz*.44],
    ['#4caf50', sz*.36, sz*.26, -sz*.62],
    ['#66bb6a', sz*.20, sz*.18, -sz*.76],
  ];
  for (const [col, fw, fh, dy] of layers) {
    ctx.fillStyle = col;
    ctx.beginPath();
    ctx.ellipse(tx, ty+dy, fw/2, fh/2, 0, 0, Math.PI*2); ctx.fill();
    // dark underside
    ctx.fillStyle = 'rgba(0,0,0,.15)';
    ctx.beginPath();
    ctx.ellipse(tx, ty+dy+fh*.15, fw*.45, fh*.25, 0, 0, Math.PI*2); ctx.fill();
  }
  // top highlight
  ctx.fillStyle = 'rgba(200,255,200,.22)';
  ctx.beginPath();
  ctx.ellipse(tx-sz*.06, ty-sz*.68, sz*.12, sz*.1, -0.3, 0, Math.PI*2); ctx.fill();
}

// ── Canvas-drawn alien character ──
function drawPixelAlien(ax, ay, type, maxHp) {
  ctx.save(); ctx.translate(ax, ay);
  const s = W * .028; // scale
  if (type === '👽') {
    // Grey alien: big head, huge eyes
    ctx.fillStyle = '#88bb66'; // alien green-grey
    ctx.beginPath(); ctx.ellipse(0, -s*1.4, s*.65, s*.82, 0, 0, Math.PI*2); ctx.fill();
    // big black eyes
    ctx.fillStyle = '#112200';
    ctx.beginPath(); ctx.ellipse(-s*.28, -s*1.5, s*.25, s*.32, -0.3, 0, Math.PI*2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(s*.28, -s*1.5, s*.25, s*.32, 0.3, 0, Math.PI*2); ctx.fill();
    // eye shine
    ctx.fillStyle = 'rgba(255,255,255,.3)';
    ctx.beginPath(); ctx.arc(-s*.2, -s*1.6, s*.07, 0, Math.PI*2); ctx.fill();
    ctx.beginPath(); ctx.arc(s*.36, -s*1.6, s*.07, 0, Math.PI*2); ctx.fill();
    // slit mouth
    ctx.strokeStyle = '#446633'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(-s*.2, -s*1.08); ctx.quadraticCurveTo(0, -s*.95, s*.2, -s*1.08); ctx.stroke();
    // body
    ctx.fillStyle = '#77aa55'; ctx.beginPath();
    ctx.ellipse(0, -s*.38, s*.36, s*.52, 0, 0, Math.PI*2); ctx.fill();
    // chest stripe
    ctx.fillStyle = '#99cc77'; ctx.fillRect(-s*.12, -s*.65, s*.24, s*.08);
    // arms
    ctx.strokeStyle = '#88bb66'; ctx.lineWidth = s*.28;
    ctx.beginPath(); ctx.moveTo(-s*.36,-s*.38); ctx.lineTo(-s*.7,-s*.7);
    ctx.moveTo(s*.36,-s*.38); ctx.lineTo(s*.7,-s*.7); ctx.stroke();
    // claw hands
    ctx.fillStyle = '#88bb66';
    for (const hx of [-s*.7, s*.7]) {
      ctx.beginPath(); ctx.arc(hx, -s*.7, s*.15, 0, Math.PI*2); ctx.fill();
    }
    // legs
    ctx.strokeStyle = '#88bb66'; ctx.lineWidth = s*.22;
    ctx.beginPath();
    ctx.moveTo(-s*.2, s*.12); ctx.lineTo(-s*.3, s*.6);
    ctx.moveTo(s*.2, s*.12); ctx.lineTo(s*.3, s*.6); ctx.stroke();
  } else if (type === '🤖') {
    // Robot alien: boxy
    ctx.fillStyle = '#4466aa';
    ctx.fillRect(-s*.45, -s*2.0, s*.9, s*.75); // head
    ctx.fillStyle = '#5577bb'; ctx.fillRect(-s*.42, -s*1.97, s*.84, s*.1); // head top shine
    // visor
    ctx.fillStyle = '#ff4400';
    ctx.fillRect(-s*.35, -s*1.85, s*.7, s*.4);
    ctx.fillStyle = '#ff8866'; ctx.fillRect(-s*.33, -s*1.83, s*.66, s*.1);
    // antenna
    ctx.fillStyle = '#334477'; ctx.fillRect(-s*.04, -s*2.2, s*.08, s*.22);
    ctx.fillStyle = '#ff2200'; ctx.beginPath(); ctx.arc(0, -s*2.22, s*.09, 0, Math.PI*2); ctx.fill();
    // body
    ctx.fillStyle = '#3355aa'; ctx.fillRect(-s*.5, -s*1.22, s*1.0, s*1.0);
    // chest panel
    ctx.fillStyle = '#001133'; ctx.fillRect(-s*.32, -s*1.08, s*.64, s*.58);
    const litC2 = [(fc+0)%30<15?'#00ff88':'#006633', (fc+10)%30<15?'#ff8800':'#883300', (fc+20)%30<15?'#4488ff':'#223388'];
    for (let li = 0; li < 3; li++) {
      ctx.fillStyle = litC2[li]; ctx.beginPath(); ctx.arc(-s*.2+li*s*.2, -s*.7, s*.1, 0, Math.PI*2); ctx.fill();
    }
    // arms
    ctx.fillStyle = '#334499';
    ctx.fillRect(-s*.8, -s*1.18, s*.32, s*.68);
    ctx.fillRect(s*.48, -s*1.18, s*.32, s*.68);
    // legs
    ctx.fillStyle = '#223377';
    ctx.fillRect(-s*.38, -s*.22, s*.28, s*.68);
    ctx.fillRect(s*.1, -s*.22, s*.28, s*.68);
    // feet
    ctx.fillStyle = '#1a2255';
    ctx.fillRect(-s*.44, s*.4, s*.36, s*.14);
    ctx.fillRect(s*.06, s*.4, s*.36, s*.14);
  } else {
    // Space invader style
    ctx.fillStyle = '#cc44ff';
    // body
    ctx.fillRect(-s*.5, -s*1.4, s*1.0, s*.8);
    // head bumps
    ctx.fillRect(-s*.5, -s*1.72, s*.24, s*.34);
    ctx.fillRect(s*.26, -s*1.72, s*.24, s*.34);
    // eyes
    ctx.fillStyle = '#000'; ctx.fillRect(-s*.32, -s*1.28, s*.2, s*.22);
    ctx.fillStyle = '#000'; ctx.fillRect(s*.12, -s*1.28, s*.2, s*.22);
    ctx.fillStyle = '#ffff00'; ctx.fillRect(-s*.26, -s*1.22, s*.1, s*.12);
    ctx.fillStyle = '#ffff00'; ctx.fillRect(s*.16, -s*1.22, s*.1, s*.12);
    // mouth
    ctx.fillStyle = '#000'; ctx.fillRect(-s*.24, -s*.82, s*.12, s*.14);
    ctx.fillRect(0, -s*.82, s*.12, s*.14);
    ctx.fillRect(s*.24, -s*.82, s*.12, s*.14);
    // tentacles
    ctx.fillStyle = '#cc44ff';
    for (let t = -2; t <= 2; t++) {
      ctx.fillRect(t*s*.2 - s*.06, -s*.6+s*.8, s*.12, s*.4 + Math.abs(Math.sin(fc*.08+t))*s*.2);
    }
  }
  ctx.restore();
}

// ── Canvas-drawn Rocky ──
function drawRockyCharacter(rx2, ry2) {
  ctx.save(); ctx.translate(rx2, ry2);
  const s = W*.025;
  // Rocky is a spider-like creature from the book — multiple arms, round body
  // body (round, rocky grey)
  const bG = ctx.createRadialGradient(-s*.15, -s*.15, s*.1, 0, 0, s*.8);
  bG.addColorStop(0, '#aabbcc'); bG.addColorStop(0.5, '#778899'); bG.addColorStop(1, '#445566');
  ctx.fillStyle = bG; ctx.beginPath(); ctx.arc(0, -s*.5, s*.72, 0, Math.PI*2); ctx.fill();
  // rock texture spots
  ctx.fillStyle = 'rgba(0,0,0,.15)';
  for (const [dx,dy,r] of [[-s*.2,-s*.3,s*.12],[s*.25,-s*.6,s*.09],[-s*.1,-s*.8,s*.08],[s*.15,-s*.2,s*.1]]) {
    ctx.beginPath(); ctx.arc(dx, dy, r, 0, Math.PI*2); ctx.fill();
  }
  // eyes (5 of them, yellow)
  const eyePos = [[-s*.4,-s*.6],[-s*.2,-s*.85],[s*.0,-s*.9],[s*.22,-s*.82],[s*.42,-s*.58]];
  for (const [ex,ey] of eyePos) {
    ctx.fillStyle = '#ffee44'; ctx.beginPath(); ctx.arc(ex, ey, s*.1, 0, Math.PI*2); ctx.fill();
    ctx.fillStyle = '#000'; ctx.beginPath(); ctx.arc(ex+s*.02, ey, s*.05, 0, Math.PI*2); ctx.fill();
  }
  // 5 arms (spider-like)
  ctx.strokeStyle = '#556677'; ctx.lineWidth = s*.22;
  const armAngles = [-2.4, -1.8, -1.2, 0.8, 1.4];
  for (const ang of armAngles) {
    const wave = Math.sin(fc*.06 + ang) * 0.3;
    ctx.beginPath();
    ctx.moveTo(Math.cos(ang)*s*.6, -s*.5+Math.sin(ang)*s*.6);
    ctx.quadraticCurveTo(
      Math.cos(ang+wave)*s*1.2, -s*.5+Math.sin(ang+wave)*s*1.2,
      Math.cos(ang+wave+.3)*s*1.7, -s*.5+Math.sin(ang+wave+.3)*s*1.7
    );
    ctx.stroke();
    // claw tip
    ctx.fillStyle = '#778899'; ctx.beginPath();
    ctx.arc(Math.cos(ang+wave+.3)*s*1.7, -s*.5+Math.sin(ang+wave+.3)*s*1.7, s*.12, 0, Math.PI*2); ctx.fill();
  }
  // Rocky's weapon glow (shoots astrophage)
  const gunGlow = ctx.createRadialGradient(s*.6, -s*.5, 0, s*.6, -s*.5, s*.35);
  gunGlow.addColorStop(0, `rgba(0,255,140,${.6+.4*Math.sin(fc*.12)})`);
  gunGlow.addColorStop(1, 'transparent');
  ctx.fillStyle = gunGlow; ctx.beginPath(); ctx.arc(s*.6, -s*.5, s*.35, 0, Math.PI*2); ctx.fill();
  ctx.restore();
}

// ── Canvas-drawn player on planet ──
function drawPlanetPlayer(px2, py2, facing) {
  const isMoving = keys['ArrowLeft']||keys['ArrowRight']||keys['a']||keys['d']||keys['A']||keys['D'];
  const walk = isMoving ? Math.sin(fc*.22) : 0;
  const bob  = isMoving ? Math.abs(Math.sin(fc*.22))*-2 : 0;
  ctx.save(); ctx.translate(px2, py2 + bob);
  if (facing < 0) ctx.scale(-1, 1);
  const s = W * .028;
  // shadow
  ctx.fillStyle = 'rgba(0,0,0,.25)';
  ctx.beginPath(); ctx.ellipse(0, 2, s*.55, s*.12, 0, 0, Math.PI*2); ctx.fill();
  // legs
  const lSwing = walk * s*.35;
  ctx.fillStyle = '#334466';
  // back leg
  ctx.save(); ctx.translate(-s*.14, 0); ctx.rotate(-lSwing*.6);
  ctx.fillRect(-s*.12, 0, s*.24, s*.62); ctx.restore();
  // front leg
  ctx.save(); ctx.translate(s*.14, 0); ctx.rotate(lSwing*.6);
  ctx.fillRect(-s*.12, 0, s*.24, s*.62); ctx.restore();
  // boots
  ctx.fillStyle = '#222244';
  ctx.save(); ctx.translate(-s*.14, 0); ctx.rotate(-lSwing*.6);
  ctx.fillRect(-s*.16, s*.52, s*.32, s*.18); ctx.restore();
  ctx.save(); ctx.translate(s*.14, 0); ctx.rotate(lSwing*.6);
  ctx.fillRect(-s*.16, s*.52, s*.32, s*.18); ctx.restore();
  // body suit
  const bodyG = ctx.createLinearGradient(-s*.38, -s*1.35, s*.38, -s*.1);
  bodyG.addColorStop(0, '#ccd8ee'); bodyG.addColorStop(.5, '#aabbdd'); bodyG.addColorStop(1, '#7a8eaa');
  ctx.fillStyle = bodyG;
  roundRect(-s*.34, -s*1.35, s*.68, s*1.2, s*.1); ctx.fill();
  // chest panel
  ctx.fillStyle = '#1a2a3a'; ctx.fillRect(-s*.18, -s*1.18, s*.36, s*.38);
  const panelLit = [(fc+0)%40<20?'#00ff88':'#008844', (fc+14)%40<20?'#ff8800':'#884400'];
  for (let li=0;li<2;li++) {
    ctx.fillStyle = panelLit[li];
    ctx.beginPath(); ctx.arc(-s*.08+li*s*.18, -s*.98, s*.07, 0, Math.PI*2); ctx.fill();
  }
  // arms
  ctx.fillStyle = '#aabbdd';
  ctx.save(); ctx.translate(-s*.38, -s*1.1); ctx.rotate(lSwing*.5+.1);
  ctx.fillRect(-s*.12, 0, s*.22, s*.62); ctx.restore();
  ctx.save(); ctx.translate(s*.38, -s*1.1); ctx.rotate(-lSwing*.5-.1);
  ctx.fillRect(-s*.12, 0, s*.22, s*.62); ctx.restore();
  // gloves
  ctx.fillStyle = '#8899aa';
  ctx.save(); ctx.translate(-s*.38, -s*1.1); ctx.rotate(lSwing*.5+.1);
  ctx.beginPath(); ctx.arc(s*.0, s*.7, s*.15, 0, Math.PI*2); ctx.fill(); ctx.restore();
  ctx.save(); ctx.translate(s*.38, -s*1.1); ctx.rotate(-lSwing*.5-.1);
  ctx.beginPath(); ctx.arc(s*.0, s*.7, s*.15, 0, Math.PI*2); ctx.fill(); ctx.restore();
  // helmet
  ctx.fillStyle = '#ddeeff';
  ctx.beginPath(); ctx.arc(0, -s*1.62, s*.42, 0, Math.PI*2); ctx.fill();
  ctx.strokeStyle = '#aaccee'; ctx.lineWidth = s*.06; ctx.stroke();
  // visor
  const vizG = ctx.createLinearGradient(-s*.28, -s*1.82, s*.28, -s*1.42);
  vizG.addColorStop(0,'#1a2a4a'); vizG.addColorStop(.4,'#2244aa'); vizG.addColorStop(1,'#0a1a3a');
  ctx.fillStyle = vizG;
  ctx.beginPath(); ctx.ellipse(0, -s*1.6, s*.3, s*.25, 0, 0, Math.PI*2); ctx.fill();
  // visor shine
  ctx.fillStyle = 'rgba(255,255,255,.3)';
  ctx.beginPath(); ctx.ellipse(-s*.1, -s*1.72, s*.12, s*.07, -0.4, 0, Math.PI*2); ctx.fill();
  // gun (held in front arm)
  ctx.fillStyle = '#334455';
  ctx.save(); ctx.translate(s*.38, -s*1.1); ctx.rotate(-lSwing*.5-.1);
  ctx.fillRect(s*.08, s*.55, s*.55, s*.12); // barrel
  ctx.fillRect(s*.08, s*.48, s*.2, s*.22);  // grip
  // muzzle flash when shooting
  if (pp.shootCD > 10) {
    ctx.fillStyle = `rgba(255,255,100,${(pp.shootCD-10)/14})`;
    ctx.beginPath(); ctx.arc(s*.63, s*.6, s*.12, 0, Math.PI*2); ctx.fill();
  }
  ctx.restore();
  ctx.restore();
}

function drawPlanet() {
  // ── Sky (blue gradient like the reference image) ──
  const skyG = ctx.createLinearGradient(0, 0, 0, H*.75);
  skyG.addColorStop(0,   '#4ab4e8');
  skyG.addColorStop(0.5, '#72caf0');
  skyG.addColorStop(1,   '#a8e2f8');
  ctx.fillStyle = skyG; ctx.fillRect(0, 0, W, H*.75);

  // ── Distant mountains — layer 1 (farthest, light cyan-blue) ──
  ctx.fillStyle = '#6aaec8';
  ctx.beginPath();
  ctx.moveTo(0, H*.72);
  const mts1 = [[.04,H*.32],[.1,H*.48],[.16,H*.20],[.24,H*.44],[.30,H*.16],[.38,H*.50],[.44,H*.26],[.50,H*.55]];
  for (const [rx,ry] of mts1) ctx.lineTo(W*rx, ry);
  ctx.lineTo(W*.52, H*.72); ctx.lineTo(0, H*.72); ctx.closePath(); ctx.fill();

  // ── Mountains — layer 2 (slightly closer, more saturated) ──
  ctx.fillStyle = '#4e97b8';
  ctx.beginPath();
  ctx.moveTo(W*.3, H*.72);
  const mts2 = [[.36,H*.30],[.44,H*.52],[.50,H*.22],[.58,H*.46],[.64,H*.18],[.72,H*.44],[.80,H*.28],[.90,H*.50],[1.0,H*.38]];
  for (const [rx,ry] of mts2) ctx.lineTo(W*rx, ry);
  ctx.lineTo(W, H*.72); ctx.lineTo(W*.3, H*.72); ctx.closePath(); ctx.fill();

  // ── Animated clouds ──
  const cOff = (fc * .12) % W;
  drawPixelCloud(W*.08  + cOff*.0, H*.10, 1.1);
  drawPixelCloud(W*.35  - cOff*.15%W, H*.07, 0.9);
  drawPixelCloud(W*.58  + cOff*.08%W, H*.14, 1.3);
  drawPixelCloud(W*.82  - cOff*.1%W, H*.06, 1.0);
  drawPixelCloud(W*.20  + cOff*.05%W, H*.19, 0.75);
  drawPixelCloud(W*.70  - cOff*.12%W, H*.20, 0.82);

  // ── Floating platforms ──
  const platList = [
    {x:W*.00, y:H*.50, w:W*.17, h:H*.16},
    {x:W*.24, y:H*.55, w:W*.15, h:H*.13},
    {x:W*.50, y:H*.43, w:W*.22, h:H*.20},
    {x:W*.78, y:H*.52, w:W*.22, h:H*.16},
  ];
  for (const p of platList) drawPlatform(p.x, p.y, p.w, p.h);

  // ── Main ground ──
  const gY = H * .72;
  const groundG = ctx.createLinearGradient(0, gY, 0, H);
  groundG.addColorStop(0,   '#9b6838');
  groundG.addColorStop(0.12,'#8b5c2e');
  groundG.addColorStop(0.5, '#7a5024');
  groundG.addColorStop(1,   '#5c3c18');
  ctx.fillStyle = groundG; ctx.fillRect(0, gY, W, H - gY);
  // rock layers
  ctx.fillStyle = 'rgba(0,0,0,.1)';
  for (let ly = gY+18; ly < H; ly += 20) {
    ctx.fillRect(0, ly, W, 3);
  }
  // grass strip
  ctx.fillStyle = '#56c45a'; ctx.fillRect(0, gY, W, 10);
  ctx.fillStyle = '#3e9e42'; ctx.fillRect(0, gY+10, W, 4);
  ctx.fillStyle = '#70d874';
  for (let tx = 4; tx < W-4; tx += 12) {
    ctx.fillRect(tx, gY-5, 3, 7); ctx.fillRect(tx+5, gY-7, 2, 9);
  }

  // ── Trees on platforms ──
  drawPixelTree(W*.04,  H*.50, W*.065);
  drawPixelTree(W*.11,  H*.50, W*.05);
  drawPixelTree(W*.295, H*.55, W*.06);
  drawPixelTree(W*.54,  H*.43, W*.072);
  drawPixelTree(W*.63,  H*.43, W*.055);
  drawPixelTree(W*.82,  H*.52, W*.065);
  drawPixelTree(W*.92,  H*.52, W*.05);
  // Ground trees
  drawPixelTree(W*.46, gY, W*.05);
  drawPixelTree(W*.73, gY, W*.055);

  // ── Stone ruins on the big platform ──
  const ruinPX = W*.51, ruinPY = H*.43;
  ctx.fillStyle = '#7a7a8a';
  for (const cx2 of [ruinPX+W*.03, ruinPX+W*.08, ruinPX+W*.13]) {
    ctx.fillRect(cx2, ruinPY-H*.17, W*.022, H*.17);
    ctx.fillStyle = '#888898'; ctx.fillRect(cx2-W*.005, ruinPY-H*.17, W*.032, H*.025);
    ctx.fillStyle = '#7a7a8a';
  }
  ctx.fillStyle = '#686878';
  ctx.fillRect(ruinPX+W*.025, ruinPY-H*.195, W*.12, H*.026);
  // moss on ruins
  ctx.fillStyle = '#3a7e3e';
  for (let mi = 0; mi < 5; mi++) {
    ctx.beginPath();
    ctx.arc(ruinPX+W*(.03+mi*.03), ruinPY-H*.17, W*.006, 0, Math.PI*2); ctx.fill();
  }

  // ── Planet particles ──
  for (const p of pParticles) {
    ctx.globalAlpha = p.life; ctx.fillStyle = p.color;
    ctx.beginPath(); ctx.arc(p.x, p.y, p.r*p.life, 0, Math.PI*2); ctx.fill();
  }
  ctx.globalAlpha = 1;

  // ── Player bullets ──
  for (const b of pp.bullets) {
    const bG = ctx.createLinearGradient(b.x-12, b.y, b.x+2, b.y);
    bG.addColorStop(0,'transparent'); bG.addColorStop(1,'#ffee44');
    ctx.fillStyle = bG;
    ctx.beginPath(); ctx.ellipse(b.x-5, b.y, 12, 4, 0, 0, Math.PI*2); ctx.fill();
    ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.arc(b.x, b.y, 3, 0, Math.PI*2); ctx.fill();
  }
  // Rocky bullets
  for (const b of rc.bullets) {
    const bG = ctx.createLinearGradient(b.x-10, b.y, b.x+2, b.y);
    bG.addColorStop(0,'transparent'); bG.addColorStop(1,'#44ffaa');
    ctx.fillStyle = bG;
    ctx.beginPath(); ctx.ellipse(b.x-4, b.y, 10, 3, 0, 0, Math.PI*2); ctx.fill();
    ctx.fillStyle = '#aaffdd'; ctx.beginPath(); ctx.arc(b.x, b.y, 2.5, 0, Math.PI*2); ctx.fill();
  }
  // Alien bullets
  for (const a of aliens) {
    for (const b of a.bullets) {
      ctx.fillStyle = '#ff3333';
      ctx.beginPath(); ctx.ellipse(b.x, b.y, 8, 3, 0, 0, Math.PI*2); ctx.fill();
      ctx.fillStyle = '#ff8888'; ctx.beginPath(); ctx.arc(b.x, b.y, 2, 0, Math.PI*2); ctx.fill();
    }
  }

  // ── Aliens ──
  for (const a of aliens) {
    drawPixelAlien(a.x, a.y, a.emoji, a.maxHp);
    if (a.maxHp > 1) {
      ctx.fillStyle = '#440000'; ctx.fillRect(a.x-22, a.y-56, 44, 6);
      ctx.fillStyle = '#ff4400'; ctx.fillRect(a.x-22, a.y-56, 44*(a.hp/a.maxHp), 6);
      ctx.strokeStyle = 'rgba(255,255,255,.25)'; ctx.lineWidth = 1;
      ctx.strokeRect(a.x-22, a.y-56, 44, 6);
    }
  }

  // ── Rocky ──
  drawRockyCharacter(rc.x, rc.y);
  ctx.fillStyle = '#88ffcc'; ctx.font = 'bold 11px Courier New';
  ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
  ctx.fillText('Rocky', rc.x, rc.y + 30);

  // ── Player ──
  drawPlanetPlayer(pp.x, pp.y, pp.facing);
  ctx.fillStyle = '#fff'; ctx.font = 'bold 11px Courier New';
  ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
  ctx.fillText(HERO, pp.x, pp.y - 38);

  // ── HUD bar ──
  ctx.fillStyle = 'rgba(0,0,0,.55)'; ctx.fillRect(0, 0, W, 60);
  drawBar(14, 10, 180, 14, pp.health/100, pp.health>50?'#44cc55':pp.health>25?'#ffaa00':'#ff3300');
  ctx.fillStyle = '#ffffff'; ctx.font = 'bold 12px Courier New';
  ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
  ctx.fillText('\u2665 ' + Math.max(0, pp.health) + '%', 20, 42);
  ctx.fillStyle = '#ffdd44'; ctx.font = `bold ${Math.round(W*.016)}px Courier New`;
  ctx.textAlign = 'center';
  ctx.fillText('👾 กำจัด: ' + aliensKilled + ' / ' + KILL_TARGET + '  |  SPACE/Z ยิง', W/2, 30);
  ctx.fillStyle = '#6688aa'; ctx.font = `${Math.round(W*.011)}px Courier New`;
  ctx.fillText('← → เดิน  |  SPACE/Z ยิง', W/2, 48);

  // ── Flash message ──
  if (flashTimer > 0) {
    const fa = Math.min(1, flashTimer/90);
    ctx.fillStyle = `rgba(0,20,50,${fa*.6})`; ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = `rgba(180,230,255,${fa})`;
    ctx.font = `bold ${Math.round(W*.04)}px Courier New`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(flashMsg, W/2, H/2);
    ctx.textBaseline = 'alphabetic';
  }
}

// ─────────────────────────────────────────────────────────────────
//  DRAW SHIP (shared)
// ─────────────────────────────────────────────────────────────────
function drawShipAt(x,y,inv) {
  if(inv>0&&Math.floor(inv/6)%2===0) return;
  const sw=64,sh=38;
  ctx.save(); ctx.translate(x,y);
  const eg=ctx.createRadialGradient(-sw/2-10,0,0,-sw/2-10,0,32);
  eg.addColorStop(0,'rgba(0,200,255,.5)'); eg.addColorStop(1,'transparent');
  ctx.fillStyle=eg; ctx.beginPath(); ctx.arc(-sw/2-10,0,32,0,Math.PI*2); ctx.fill();
  ctx.beginPath();
  ctx.moveTo(sw/2,0); ctx.lineTo(sw/4,-sh/2); ctx.lineTo(-sw/2,-sh/3);
  ctx.lineTo(-sw/2,sh/3); ctx.lineTo(sw/4,sh/2); ctx.closePath();
  const hg=ctx.createLinearGradient(-sw/2,-sh/2,sw/2,sh/2);
  hg.addColorStop(0,'#3377bb'); hg.addColorStop(.5,'#77bbee'); hg.addColorStop(1,'#1a3d66');
  ctx.fillStyle=hg; ctx.fill(); ctx.strokeStyle='#00aaff'; ctx.lineWidth=1.5; ctx.stroke();
  for(const s of[-1,1]){
    ctx.beginPath(); ctx.moveTo(0,s*sh/2); ctx.lineTo(-sw/2,s*sh); ctx.lineTo(-sw/2,s*sh/3);
    ctx.closePath(); ctx.fillStyle='#0d3d77'; ctx.fill(); ctx.strokeStyle='#0077cc'; ctx.stroke();
  }
  ctx.beginPath(); ctx.arc(sw/5,0,9,0,Math.PI*2);
  const cg=ctx.createRadialGradient(sw/5-3,-3,1,sw/5,0,9);
  cg.addColorStop(0,'#bbeeff'); cg.addColorStop(1,'#005588');
  ctx.fillStyle=cg; ctx.fill(); ctx.strokeStyle='#77ddff'; ctx.lineWidth=1; ctx.stroke();
  ctx.restore();
}

function drawBar(x,y,w,h,pct,color) {
  ctx.fillStyle='rgba(0,0,0,.55)'; roundRect(x,y,w,h,4); ctx.fill();
  if(pct>0){ ctx.fillStyle=color; roundRect(x,y,w*pct,h,4); ctx.fill(); }
  ctx.strokeStyle='rgba(255,255,255,.2)'; ctx.lineWidth=1; roundRect(x,y,w,h,4); ctx.stroke();
}

// ─────────────────────────────────────────────────────────────────
//  BOOT
// ─────────────────────────────────────────────────────────────────
window.addEventListener('DOMContentLoaded', () => {
  resize();
  initTouch();
  document.getElementById('start-btn').addEventListener('click', () => startPhase('walk'));
});
