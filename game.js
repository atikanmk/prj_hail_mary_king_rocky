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
  drawSpace();
  const sTop=SHIP_TOP(), sH=SHIP_H();

  // Hull outer
  ctx.fillStyle='#0a1828'; ctx.strokeStyle='#005588'; ctx.lineWidth=3;
  roundRect(W*.02,sTop-22,W*.96,sH+44,28); ctx.fill(); ctx.stroke();

  // Portholes
  for (let i=0;i<7;i++) {
    const px=W*(.08+i*.13);
    ctx.fillStyle='#001133'; ctx.strokeStyle='#004488'; ctx.lineWidth=2;
    ctx.beginPath(); ctx.ellipse(px,sTop-10,26,16,0,0,Math.PI*2); ctx.fill(); ctx.stroke();
    ctx.fillStyle='rgba(255,255,255,.7)';
    ctx.beginPath(); ctx.arc(px+5,sTop-14,1.5,0,Math.PI*2); ctx.fill();
  }

  // Rooms
  for (const r of ROOMS) {
    const rx=W*r.relX, rw=W*r.relW;
    ctx.fillStyle=r.bg; ctx.fillRect(rx,sTop,rw,sH);
    ctx.strokeStyle=r.accent; ctx.lineWidth=1; ctx.strokeRect(rx,sTop,rw,sH);
    // Divider wall
    if (!r.isBridge) {
      ctx.strokeStyle='#224455'; ctx.lineWidth=3;
      ctx.beginPath();
      ctx.moveTo(rx+rw,sTop); ctx.lineTo(rx+rw,sTop+sH*.3);
      ctx.moveTo(rx+rw,sTop+sH*.7); ctx.lineTo(rx+rw,sTop+sH);
      ctx.stroke();
    }
    // Label
    ctx.font=`bold ${Math.round(W*.013)}px Courier New`;
    ctx.fillStyle=r.isBridge?'#88ff88':'#4488aa';
    ctx.textAlign='center'; ctx.textBaseline='alphabetic';
    ctx.fillText(r.icon+' '+r.label, rx+rw/2, sTop+26);
    // Room decor
    drawRoomDecor(r,rx,sTop,rw,sH);
    // Bridge glow + GO indicator
    if (r.isBridge && alertState==='show' && !bridgeReached) {
      ctx.strokeStyle=`rgba(0,255,80,${.4+.3*Math.sin(fc*.1)})`; ctx.lineWidth=4;
      ctx.strokeRect(rx+2,sTop+2,rw-4,sH-4);
      ctx.fillStyle='#00ff55';
      ctx.font=`bold ${Math.round(W*.022)}px Courier New`;
      ctx.textAlign='center'; ctx.textBaseline='middle';
      ctx.fillText('\u25B6\u25B6 GO HERE \u25B6\u25B6', rx+rw/2, sTop+sH/2);
      ctx.textBaseline='alphabetic';
    }
  }

  // Floor line
  ctx.strokeStyle='#113355'; ctx.lineWidth=2;
  ctx.beginPath(); ctx.moveTo(W*.02,sTop+sH*.65); ctx.lineTo(W*.98,sTop+sH*.65); ctx.stroke();

  drawWalker();

  // HUD
  ctx.fillStyle='#aaddff'; ctx.font=`${Math.round(W*.017)}px Courier New`;
  ctx.textAlign='left'; ctx.textBaseline='alphabetic';
  ctx.fillText('🧑\u200d🚀 '+HERO, 18, 30);
  ctx.fillStyle='#556677'; ctx.font=`${Math.round(W*.011)}px Courier New`;
  ctx.fillText('WASD / \u2191\u2193\u2190\u2192 \u0e40\u0e14\u0e34\u0e19\u0e44\u0e14\u0e49\u0e40\u0e25\u0e22', 18, 50);

  drawWalkAlert();

  // Bridge transition flash
  if (bridgeReached) {
    const a=Math.min(1,bridgeTransTimer/60);
    ctx.fillStyle=`rgba(0,40,0,${a*.85})`; ctx.fillRect(0,0,W,H);
    if (bridgeTransTimer>25) {
      ctx.fillStyle=`rgba(0,255,80,${a})`;
      ctx.font=`bold ${Math.round(W*.045)}px Courier New`;
      ctx.textAlign='center'; ctx.fillText('🚀 LAUNCHING...', W/2, H/2);
    }
  }
}

function drawRoomDecor(r,rx,sTop,rw,sH) {
  const flY=sTop+sH*.65;
  ctx.textAlign='center'; ctx.textBaseline='middle';
  if (r.key==='cryo') {
    for (let i=0;i<3;i++) {
      const px=rx+rw*(.2+i*.3);
      ctx.fillStyle='#002244'; ctx.strokeStyle='#004488'; ctx.lineWidth=1;
      ctx.fillRect(px-16,flY-78,32,72); ctx.strokeRect(px-16,flY-78,32,72);
      ctx.font='20px serif';
      ctx.fillText(i===0?'🧑\u200d🚀':'💀', px, flY-42);
    }
  } else if (r.key==='lab') {
    ctx.fillStyle='#112233'; ctx.fillRect(rx+rw*.1,flY-38,rw*.8,12);
    ctx.font='22px serif';
    ctx.fillText('🔬', rx+rw*.25, flY-18);
    ctx.fillText('🧪', rx+rw*.55, flY-18);
    ctx.fillText('💻', rx+rw*.82, flY-18);
  } else if (r.key==='quarters') {
    ctx.font='22px serif';
    ctx.fillText('🛏\ufe0f', rx+rw*.3, flY-14);
    ctx.fillStyle='#221100'; ctx.fillRect(rx+rw*.58,sTop+sH*.2,36,46);
    ctx.strokeStyle='#553311'; ctx.lineWidth=1.5; ctx.strokeRect(rx+rw*.58,sTop+sH*.2,36,46);
    ctx.font='18px serif'; ctx.fillText('📷', rx+rw*.76,sTop+sH*.43);
  } else if (r.key==='bridge') {
    // Control panel
    ctx.fillStyle='#001100'; ctx.fillRect(rx+rw*.08,flY-52,rw*.84,46);
    ctx.strokeStyle='#003300'; ctx.lineWidth=1; ctx.strokeRect(rx+rw*.08,flY-52,rw*.84,46);
    const bColors=['#ff4444','#ffaa00','#44ff44','#4444ff','#ff88ff','#00ffff'];
    for (let i=0;i<6;i++) {
      ctx.fillStyle=bColors[i]; ctx.beginPath();
      ctx.arc(rx+rw*(.16+i*.13),flY-28,5.5,0,Math.PI*2); ctx.fill();
    }
    // Main screen
    ctx.fillStyle='#002200'; ctx.fillRect(rx+rw*.1,sTop+sH*.14,rw*.8,sH*.3);
    ctx.strokeStyle='#005500'; ctx.lineWidth=1.5; ctx.strokeRect(rx+rw*.1,sTop+sH*.14,rw*.8,sH*.3);
    ctx.fillStyle='#00cc44'; ctx.font=`bold ${Math.round(W*.011)}px Courier New`;
    ctx.textAlign='center'; ctx.textBaseline='middle';
    ctx.fillText('\u26a0\ufe0f ASTEROID INCOMING', rx+rw*.5, sTop+sH*.32);
    ctx.fillStyle='#ff6600';
    ctx.fillText('BRACE FOR IMPACT', rx+rw*.5, sTop+sH*.22);
    ctx.textBaseline='alphabetic';
  }
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

function drawPlanet() {
  // Sky
  const sky=ctx.createLinearGradient(0,0,0,H*.73);
  sky.addColorStop(0,'#1a0022'); sky.addColorStop(.6,'#2a0a3a'); sky.addColorStop(1,'#3a1550');
  ctx.fillStyle=sky; ctx.fillRect(0,0,W,H*.73);
  // Stars in sky
  ctx.fillStyle='rgba(255,255,200,.35)';
  for(let i=0;i<35;i++){ctx.beginPath();ctx.arc((i*137.5)%W,(i*73.1)%(H*.6),Math.random()*1.5+.4,0,Math.PI*2);ctx.fill();}
  // Distant planet
  const pg=ctx.createRadialGradient(W*.82,H*.13,5,W*.82,H*.13,55);
  pg.addColorStop(0,'#aaffcc'); pg.addColorStop(1,'#224433');
  ctx.fillStyle=pg; ctx.beginPath(); ctx.arc(W*.82,H*.13,55,0,Math.PI*2); ctx.fill();
  ctx.fillStyle='#88ffcc'; ctx.font='12px Courier New'; ctx.textAlign='center';
  ctx.fillText('Tau Ceti',W*.82,H*.13+70);
  // Ground
  const gr=ctx.createLinearGradient(0,H*.72,0,H);
  gr.addColorStop(0,'#2a1a3a'); gr.addColorStop(.2,'#3d2550'); gr.addColorStop(1,'#1a0a22');
  ctx.fillStyle=gr; ctx.fillRect(0,H*.72,W,H*.28);
  ctx.strokeStyle='#6644aa'; ctx.lineWidth=2;
  ctx.beginPath(); ctx.moveTo(0,H*.73); ctx.lineTo(W,H*.73); ctx.stroke();
  // Ground rocks
  for(let i=0;i<9;i++){
    ctx.fillStyle='#332244'; ctx.beginPath();
    ctx.ellipse((i*157.3)%W,H*.77+(i%3)*8,15+i*2,8+i,0,0,Math.PI*2); ctx.fill();
  }
  // Planet particles
  for(const p of pParticles){
    ctx.globalAlpha=p.life; ctx.fillStyle=p.color;
    ctx.beginPath(); ctx.arc(p.x,p.y,p.r*p.life,0,Math.PI*2); ctx.fill();
  }
  ctx.globalAlpha=1;
  // Bullets
  for(const b of pp.bullets){ctx.fillStyle='#ffff00';ctx.beginPath();ctx.ellipse(b.x,b.y,10,4,0,0,Math.PI*2);ctx.fill();}
  for(const b of rc.bullets){ctx.fillStyle='#00ff88';ctx.beginPath();ctx.ellipse(b.x,b.y,8,3,0,0,Math.PI*2);ctx.fill();}
  // Alien bullets
  for(const a of aliens){for(const b of a.bullets){ctx.fillStyle='#ff4444';ctx.beginPath();ctx.ellipse(b.x,b.y,8,3,0,0,Math.PI*2);ctx.fill();}}
  // Aliens
  ctx.textBaseline='middle'; ctx.textAlign='center';
  for(const a of aliens){
    ctx.font=`${Math.round(W*.038)}px serif`; ctx.fillText(a.emoji,a.x,a.y);
    if(a.maxHp>1){
      ctx.fillStyle='#550000'; ctx.fillRect(a.x-22,a.y-38,44,7);
      ctx.fillStyle='#ff4400'; ctx.fillRect(a.x-22,a.y-38,44*(a.hp/a.maxHp),7);
    }
  }
  // Rocky
  ctx.font=`${Math.round(W*.036)}px serif`; ctx.fillText('🪨',rc.x,rc.y);
  ctx.fillStyle='#88ffcc'; ctx.font='bold 11px Courier New'; ctx.textAlign='center';
  ctx.textBaseline='alphabetic'; ctx.fillText('Rocky',rc.x,rc.y+26);
  // Player
  ctx.save(); ctx.translate(pp.x,pp.y); if(pp.facing<0) ctx.scale(-1,1);
  const wb=Math.abs(Math.sin(fc*.14))*3;
  ctx.font=`${Math.round(W*.038)}px serif`; ctx.textAlign='center'; ctx.textBaseline='middle';
  ctx.fillText('🧑\u200d🚀',0,-wb); ctx.restore();
  ctx.fillStyle='#aaddff'; ctx.font='bold 11px Courier New';
  ctx.textAlign='center'; ctx.textBaseline='alphabetic'; ctx.fillText(HERO,pp.x,pp.y-30);
  // HUD
  drawBar(16,16,180,16,pp.health/100,pp.health>50?'#22cc55':pp.health>25?'#ffaa00':'#ff2200');
  ctx.fillStyle='#fff'; ctx.font='bold 12px Courier New'; ctx.textAlign='left';
  ctx.fillText('\u2764\ufe0f '+Math.max(0,pp.health)+'%',22,48);
  ctx.fillStyle='#ffcc00'; ctx.font=`bold ${Math.round(W*.017)}px Courier New`;
  ctx.textAlign='center';
  ctx.fillText('👾 \u0e01\u0e33\u0e08\u0e31\u0e14: '+aliensKilled+' / '+KILL_TARGET+' | SPACE/Z \u0e22\u0e34\u0e07', W/2, 26);
  ctx.fillStyle='#556688'; ctx.font=`${Math.round(W*.011)}px Courier New`;
  ctx.fillText('\u2190\u2192 \u0e40\u0e14\u0e34\u0e19 | SPACE/Z \u0e22\u0e34\u0e07', W/2, 46);
  // Phase flash
  if(flashTimer>0){
    const a=flashTimer/90;
    ctx.fillStyle=`rgba(100,0,150,${a*.3})`; ctx.fillRect(0,0,W,H);
    ctx.fillStyle=`rgba(200,150,255,${a})`;
    ctx.font=`bold ${Math.round(W*.04)}px Courier New`; ctx.textAlign='center';
    ctx.fillText(flashMsg,W/2,H/2);
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
