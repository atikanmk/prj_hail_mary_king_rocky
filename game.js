// ================================================================
//  PROJECT HAIL MARY — King Rocky  |  game.js  (3-Act Story)
// ================================================================

/* ══════════════════════════════════════════════════════
   ACT 0 — WAKE UP
   Ratchet Grace wakes up alone; crew is dead.
══════════════════════════════════════════════════════ */
const WAKEUP_LINES = [
  "[SHIP LOG — Day 1,095]",
  "",
  "> ระบบ cryo-pod ตรวจพบสัญญาณชีพ...",
  "> กำลังปลุก... นักบิน GRACE, RATCHET",
  "",
  "...",
  "",
  "คุณรู้สึกตัว — แต่ไม่จำอะไรได้เลย",
  "ชื่อ? ไม่รู้  ที่นี่คือที่ไหน? ไม่รู้",
  "",
  "> ตรวจสอบ cryo-pod อื่น...",
  "> Pod #2 — LECLERC, IRINA ......... [DECEASED]",
  "> Pod #3 — SHAPIRO, YÁO ........... [DECEASED]",
  "",
  "หัวใจคุณหนักขึ้น — คุณอยู่คนเดียว",
  "บนยานอวกาศ กลางจักรวาล",
  "",
  "> ระบบนำทาง: มุ่งหน้าสู่ Tau Ceti",
  "> ระยะทางเหลือ: 3.2 ปีแสง",
  "",
  "ความทรงจำค่อยๆ กลับมา...",
  "คุณคือ Dr. Ratchet Grace — นักชีววิทยาดาราศาสตร์",
  "ภารกิจนี้คือความหวังสุดท้ายของมวลมนุษยชาติ",
];

const BRIEFING_LINES = [
  "Astrophage — สิ่งมีชีวิตจิ๋วในอวกาศ กินพลังงานจากดวงอาทิตย์",
  "ทุกปี ดวงอาทิตย์หรี่ลง 0.1% — โลกกำลังเข้าสู่ยุคน้ำแข็ง",
  "Tau Ceti คือดาวเดียวที่ไม่ถูกรบกวน — ต้องมีคำตอบอยู่ที่นั่น",
  "คุณถูกส่งมาคนเดียว เพราะเชื้อเพลิงมีจำกัด — ไปแล้วไม่กลับ",
  "แต่ถ้าคุณพบคำตอบ และส่งสัญญาณกลับได้... โลกจะรอด",
  "ระวังแถบอุกกาบาต Tau Ceti — อันตรายมาก ขับยานให้ดีๆ!",
];

const ROCKY_LINES = [
  "[ปีที่ 3 — เข้าใกล้ Tau Ceti]",
  "",
  "> ตรวจพบยานอวกาศ... จากทิศทางตรงข้าม!",
  "> ไม่ตรงกับฐานข้อมูลยานโลก",
  "> สัญญาณ: ความถี่ที่ไม่เคยพบมาก่อน",
  "",
  "มีใครอีกคนมาที่นี่ด้วย...",
  "มาจากดาวอีก Eridani — ชื่อว่า 'Rocky'",
  "",
  "> Rocky ก็กำลังศึกษา Astrophage เหมือนกัน!",
  "> สัตว์มีชีวิตต่างดาว — แต่มาด้วยเจตนาเดียวกัน",
  "",
  "คุณไม่ได้อยู่คนเดียวอีกต่อไปแล้ว",
  "ร่วมมือกัน — สองสายพันธุ์ หนึ่งเป้าหมาย",
];

/* ── Typewriter ─────────────────────────────────────── */
function typeLines(lines, elId, onDone, speed = 28) {
  const el = document.getElementById(elId);
  el.textContent = '';
  let li = 0, ci = 0;
  function tick() {
    if (li >= lines.length) { if (onDone) onDone(); return; }
    const line = lines[li];
    if (ci < line.length) {
      el.textContent += line[ci++];
      setTimeout(tick, speed);
    } else {
      el.textContent += '\n';
      li++; ci = 0;
      setTimeout(tick, li < lines.length && lines[li] === '' ? 40 : 600);
    }
  }
  tick();
}

/* ══════════════════════════════════════════════════════
   BOOT
══════════════════════════════════════════════════════ */
window.addEventListener('DOMContentLoaded', () => {
  // ACT 0
  setTimeout(() => {
    typeLines(WAKEUP_LINES, 'terminal-text', () => {
      document.getElementById('wakeup-next-btn').style.display = 'block';
    }, 22);
  }, 2200); // wait for pod animation

  document.getElementById('wakeup-next-btn').addEventListener('click', () => {
    showScreen('intro-screen');
    typeLines(BRIEFING_LINES, 'story-text', () => {
      document.getElementById('start-btn').style.display = 'block';
    }, 30);
  });

  document.getElementById('start-btn').addEventListener('click', startGame);
});

/* ══════════════════════════════════════════════════════
   GAME ENGINE
══════════════════════════════════════════════════════ */
const canvas = document.getElementById('gameCanvas');
const ctx    = canvas.getContext('2d');
let W, H;
function resize() { W = canvas.width = canvas.offsetWidth; H = canvas.height = canvas.offsetHeight; }
window.addEventListener('resize', resize);

const STATE = { IDLE:0, PLAYING:1, WIN:2, LOSE:3 };
let gameState = STATE.IDLE;
let animId;

const ship = { x:0, y:0, w:64, h:38, vx:0, vy:0, speed:5.2, health:100, invincible:0 };

let distanceTravelled = 0;
const TOTAL_DISTANCE  = 5000;
let sunHealth = 100;
let stars = [], asteroids = [], particles = [];
let asteroidTimer = 0, asteroidInterval = 88;

// In-flight story milestones
const MILESTONES = [
  { at: 0.15, text: "ความทรงจำเริ่มกลับมา... คุณจำลูกเรือทั้งสองได้แล้ว", shown: false },
  { at: 0.35, text: "ดวงอาทิตย์ยังคงหรี่ลงทุกวัน — เวลาของโลกเหลือน้อยลงเรื่อยๆ", shown: false },
  { at: 0.55, text: "Tau Ceti ปรากฏบนจอเรดาร์แล้ว — ใกล้เข้ามาทุกที!", shown: false },
  { at: 0.78, text: "เซ็นเซอร์ตรวจพบสัญญาณแปลกๆ... มีบางอย่างอยู่ที่นั่น", shown: false },
];

/* Keys / Touch */
const keys = {};
window.addEventListener('keydown', e => keys[e.key] = true);
window.addEventListener('keyup',   e => keys[e.key] = false);
let touchDir = { x:0, y:0 }, touchActive = false;
canvas.addEventListener('touchstart', onTouch, { passive:false });
canvas.addEventListener('touchmove',  onTouch, { passive:false });
canvas.addEventListener('touchend', () => { touchDir={x:0,y:0}; touchActive=false; });
function onTouch(e) {
  e.preventDefault();
  const t = e.touches[0], r = canvas.getBoundingClientRect();
  const dx = t.clientX-r.left-ship.x, dy = t.clientY-r.top-ship.y;
  const len = Math.hypot(dx,dy)||1;
  touchDir={x:dx/len,y:dy/len}; touchActive=true;
}

/* ── START ──────────────────────────────────────────── */
function startGame() {
  showScreen('game-screen');
  resize();
  ship.x=130; ship.y=H/2; ship.vx=0; ship.vy=0;
  ship.health=100; ship.invincible=0;
  distanceTravelled=0; sunHealth=100;
  asteroids=[]; particles=[]; asteroidTimer=0; asteroidInterval=88;
  MILESTONES.forEach(m=>m.shown=false);

  stars=[];
  for(let i=0;i<220;i++) stars.push({
    x:Math.random()*W, y:Math.random()*H,
    r:Math.random()*1.8+0.2,
    speed:Math.random()*1.6+0.3,
    brightness:Math.random()*0.7+0.3,
    color:['#ffffff','#aaccff','#ffeecc','#ffaaaa'][Math.floor(Math.random()*4)],
  });

  gameState=STATE.PLAYING;
  cancelAnimationFrame(animId);
  gameLoop();
}

function restartGame() { startGame(); }

/* ── LOOP ───────────────────────────────────────────── */
function gameLoop() {
  if(gameState!==STATE.PLAYING) return;
  update(); draw();
  animId=requestAnimationFrame(gameLoop);
}

/* ── UPDATE ─────────────────────────────────────────── */
function update() {
  handleInput(); moveShip();
  spawnAsteroids(); moveAsteroids();
  spawnThrust(); updateParticles(); updateStars();
  checkCollisions(); advanceProgress();
  checkMilestones();
  updateHUD();
}

function handleInput() {
  let dx=0, dy=0;
  if(keys['ArrowUp']   ||keys['w']||keys['W']) dy=-1;
  if(keys['ArrowDown'] ||keys['s']||keys['S']) dy= 1;
  if(keys['ArrowLeft'] ||keys['a']||keys['A']) dx=-1;
  if(keys['ArrowRight']||keys['d']||keys['D']) dx= 1;
  if(touchActive){dx=touchDir.x;dy=touchDir.y}
  const len=Math.hypot(dx,dy)||1;
  if(dx||dy){dx/=len;dy/=len}
  const friction=0.84,accel=0.5;
  ship.vx=ship.vx*friction+dx*accel*ship.speed*(1-friction)/friction;
  ship.vy=ship.vy*friction+dy*accel*ship.speed*(1-friction)/friction;
  const spd=Math.hypot(ship.vx,ship.vy);
  if(spd>ship.speed){ship.vx*=ship.speed/spd;ship.vy*=ship.speed/spd}
}

function moveShip() {
  ship.x+=ship.vx; ship.y+=ship.vy;
  const px=ship.w/2+4;
  ship.x=Math.max(px,Math.min(W-px,ship.x));
  ship.y=Math.max(ship.h/2+4,Math.min(H-ship.h/2-4,ship.y));
  if(ship.invincible>0) ship.invincible--;
}

/* ── ASTEROIDS ──────────────────────────────────────── */
function spawnAsteroids() {
  if(++asteroidTimer<asteroidInterval) return;
  asteroidTimer=0;
  asteroidInterval=Math.max(22,88-Math.floor(distanceTravelled*65));
  const variants=['💫','🪨','☄️','🌑'];
  const size=18+Math.random()*32;
  const speed=2.2+Math.random()*3+distanceTravelled*3.5;
  const y=size+Math.random()*(H-size*2);
  const angle=(Math.random()-0.5)*0.45;
  asteroids.push({
    x:W+size,y,
    vx:-speed, vy:Math.sin(angle)*speed*0.5,
    r:size,
    emoji:variants[Math.floor(Math.random()*variants.length)],
    rot:Math.random()*Math.PI*2, rotSpeed:(Math.random()-0.5)*0.07,
  });
}
function moveAsteroids() {
  for(let i=asteroids.length-1;i>=0;i--){
    const a=asteroids[i];
    a.x+=a.vx;a.y+=a.vy;a.rot+=a.rotSpeed;
    if(a.x<-a.r*2) asteroids.splice(i,1);
  }
}

/* ── PARTICLES ──────────────────────────────────────── */
function spawnThrust() {
  for(let i=0;i<3;i++) particles.push({
    type:'thrust',
    x:ship.x-ship.w/2-5, y:ship.y+(Math.random()-.5)*14,
    vx:-3-Math.random()*3, vy:(Math.random()-.5)*1.5,
    life:1, decay:0.04+Math.random()*0.04,
    r:3+Math.random()*4,
    color:['#ff8800','#ffcc00','#ff4400','#ffffff'][Math.floor(Math.random()*4)],
  });
}
function explodeAt(x,y,count=20) {
  for(let i=0;i<count;i++){
    const a=Math.random()*Math.PI*2, spd=2+Math.random()*5;
    particles.push({
      type:'explode',x,y,
      vx:Math.cos(a)*spd, vy:Math.sin(a)*spd,
      life:1, decay:0.025+Math.random()*0.04,
      r:2+Math.random()*5,
      color:['#ff6600','#ffcc00','#ff2200','#ffffff','#ffaaaa'][Math.floor(Math.random()*5)],
    });
  }
}
function updateParticles() {
  for(let i=particles.length-1;i>=0;i--){
    const p=particles[i];p.x+=p.vx;p.y+=p.vy;p.life-=p.decay;
    if(p.life<=0) particles.splice(i,1);
  }
}

/* ── STARS ──────────────────────────────────────────── */
function updateStars() {
  const scroll=1.4+distanceTravelled*2.2;
  for(const s of stars){
    s.x-=s.speed*scroll;
    if(s.x<0){s.x=W;s.y=Math.random()*H}
  }
}

/* ── COLLISIONS ─────────────────────────────────────── */
function checkCollisions() {
  if(ship.invincible>0) return;
  const sr=Math.min(ship.w,ship.h)*0.36;
  for(let i=asteroids.length-1;i>=0;i--){
    const a=asteroids[i];
    if(Math.hypot(ship.x-a.x,ship.y-a.y)<sr+a.r*0.62){
      ship.health-=22; ship.invincible=90;
      explodeAt(ship.x+(Math.random()-.5)*20,ship.y+(Math.random()-.5)*20,26);
      asteroids.splice(i,1);
      if(ship.health<=0){ship.health=0;endGame(false);return}
    }
  }
}

/* ── MILESTONES (in-flight story) ───────────────────── */
let popupTimeout;
function checkMilestones() {
  for(const m of MILESTONES){
    if(!m.shown && distanceTravelled>=m.at){
      m.shown=true; showPopup(m.text);
    }
  }
}
function showPopup(text) {
  clearTimeout(popupTimeout);
  const el=document.getElementById('story-popup');
  document.getElementById('story-popup-text').textContent=text;
  el.classList.remove('hidden');
  popupTimeout=setTimeout(()=>el.classList.add('hidden'),4500);
}

/* ── PROGRESS ───────────────────────────────────────── */
function advanceProgress() {
  distanceTravelled+=1/TOTAL_DISTANCE;
  distanceTravelled=Math.min(1,distanceTravelled);
  sunHealth-=0.007; if(sunHealth<0) sunHealth=0;
  if(distanceTravelled>=1) endGame(true);
}

/* ── HUD ─────────────────────────────────────────────── */
function updateHUD() {
  const hb=document.getElementById('health-bar');
  hb.style.width=ship.health+'%';
  hb.style.background=ship.health>50
    ?'linear-gradient(90deg,#22cc55,#88ff44)'
    :ship.health>25?'linear-gradient(90deg,#ffaa00,#ffdd44)'
    :'linear-gradient(90deg,#ff2200,#ff6644)';
  document.getElementById('dist-bar').style.width=(distanceTravelled*100)+'%';
  const sb=document.getElementById('sun-bar');
  sb.style.width=sunHealth+'%';
  sb.style.background=sunHealth>60
    ?'linear-gradient(90deg,#ffcc00,#ff8800)'
    :sunHealth>30?'linear-gradient(90deg,#ff8800,#ff4400)'
    :'linear-gradient(90deg,#aa2200,#ff0000)';
  document.getElementById('speed-val').textContent=(1+distanceTravelled*9).toFixed(1)+'x';
}

/* ── END ─────────────────────────────────────────────── */
function endGame(won) {
  gameState=won?STATE.WIN:STATE.LOSE;
  cancelAnimationFrame(animId);
  if(won) {
    showScreen('rocky-screen');
    setTimeout(() => {
      typeLines(ROCKY_LINES,'rocky-text',()=>{
        document.getElementById('rocky-next-btn').style.display='block';
      },25);
      document.getElementById('rocky-next-btn').addEventListener('click',()=>showScreen('win-screen'),{once:true});
    },600);
  } else {
    showScreen('lose-screen');
  }
}

/* ══════════════════════════════════════════════════════
   DRAW
══════════════════════════════════════════════════════ */
function draw() {
  ctx.clearRect(0,0,W,H);
  const bg=ctx.createLinearGradient(0,0,W,H);
  bg.addColorStop(0,'#000008');bg.addColorStop(0.5,'#00001a');bg.addColorStop(1,'#000010');
  ctx.fillStyle=bg;ctx.fillRect(0,0,W,H);
  drawStars(); drawNebula(); drawParticles(); drawAsteroids(); drawShip(); drawPlanet();
}

function drawStars() {
  for(const s of stars){
    ctx.globalAlpha=s.brightness;ctx.fillStyle=s.color;
    ctx.beginPath();ctx.arc(s.x,s.y,s.r,0,Math.PI*2);ctx.fill();
  }
  ctx.globalAlpha=1;
}

function drawNebula() {
  const t=Date.now()*0.00014;
  const g=ctx.createRadialGradient(W*(0.6+Math.sin(t)*0.15),H*(0.4+Math.cos(t*.7)*.2),30,W*(0.6+Math.sin(t)*.15),H*(0.4+Math.cos(t*.7)*.2),H*0.55);
  g.addColorStop(0,'rgba(40,0,80,0.1)');g.addColorStop(0.5,'rgba(0,30,80,0.06)');g.addColorStop(1,'transparent');
  ctx.fillStyle=g;ctx.fillRect(0,0,W,H);
}

function drawParticles() {
  for(const p of particles){
    ctx.globalAlpha=p.life*(p.type==='thrust'?0.8:1);
    ctx.fillStyle=p.color;ctx.beginPath();ctx.arc(p.x,p.y,p.r*p.life,0,Math.PI*2);ctx.fill();
  }
  ctx.globalAlpha=1;
}

function drawAsteroids() {
  for(const a of asteroids){
    ctx.save();ctx.translate(a.x,a.y);ctx.rotate(a.rot);
    ctx.font=`${a.r*1.6}px serif`;ctx.textAlign='center';ctx.textBaseline='middle';
    ctx.fillText(a.emoji,0,0);ctx.restore();
  }
}

function drawShip() {
  if(ship.invincible>0&&Math.floor(ship.invincible/6)%2===0) return;
  ctx.save();ctx.translate(ship.x,ship.y);

  // Engine glow
  const eg=ctx.createRadialGradient(-ship.w/2-10,0,0,-ship.w/2-10,0,32);
  eg.addColorStop(0,'rgba(0,200,255,0.55)');eg.addColorStop(1,'transparent');
  ctx.fillStyle=eg;ctx.beginPath();ctx.arc(-ship.w/2-10,0,32,0,Math.PI*2);ctx.fill();

  // Hull
  ctx.beginPath();
  ctx.moveTo(ship.w/2,0);
  ctx.lineTo(ship.w/4,-ship.h/2);
  ctx.lineTo(-ship.w/2,-ship.h/3);
  ctx.lineTo(-ship.w/2, ship.h/3);
  ctx.lineTo(ship.w/4, ship.h/2);
  ctx.closePath();
  const hg=ctx.createLinearGradient(-ship.w/2,-ship.h/2,ship.w/2,ship.h/2);
  hg.addColorStop(0,'#3377bb');hg.addColorStop(0.5,'#77bbee');hg.addColorStop(1,'#1a3d66');
  ctx.fillStyle=hg;ctx.fill();
  ctx.strokeStyle='#00aaff';ctx.lineWidth=1.5;ctx.stroke();

  // Wings
  for(const sign of[-1,1]){
    ctx.beginPath();
    ctx.moveTo(0,sign*ship.h/2);ctx.lineTo(-ship.w/2,sign*ship.h);ctx.lineTo(-ship.w/2,sign*ship.h/3);
    ctx.closePath();ctx.fillStyle='#0d3d77';ctx.fill();ctx.strokeStyle='#0077cc';ctx.stroke();
  }

  // Cockpit
  ctx.beginPath();ctx.arc(ship.w/5,0,9,0,Math.PI*2);
  const cg=ctx.createRadialGradient(ship.w/5-3,-3,1,ship.w/5,0,9);
  cg.addColorStop(0,'#bbeeff');cg.addColorStop(1,'#005588');
  ctx.fillStyle=cg;ctx.fill();ctx.strokeStyle='#77ddff';ctx.lineWidth=1;ctx.stroke();

  ctx.restore();
}

function drawPlanet() {
  const p=distanceTravelled;
  if(p<0.05) return;
  const r=p*65+4, px=W-70, py=H/2;
  ctx.save();ctx.globalAlpha=Math.min(1,(p-0.05)*5);
  // Glow
  const gg=ctx.createRadialGradient(px,py,r*0.4,px,py,r*3.2);
  gg.addColorStop(0,'rgba(0,255,100,0.13)');gg.addColorStop(1,'transparent');
  ctx.fillStyle=gg;ctx.beginPath();ctx.arc(px,py,r*3.2,0,Math.PI*2);ctx.fill();
  // Body
  const pg=ctx.createRadialGradient(px-r*.3,py-r*.3,r*.08,px,py,r);
  pg.addColorStop(0,'#bbffdd');pg.addColorStop(0.5,'#33bb66');pg.addColorStop(1,'#113322');
  ctx.fillStyle=pg;ctx.beginPath();ctx.arc(px,py,r,0,Math.PI*2);ctx.fill();
  if(p>0.3){
    ctx.globalAlpha=Math.min(1,(p-0.3)*4);
    ctx.fillStyle='#88ffcc';ctx.font='bold 12px Courier New';ctx.textAlign='center';
    ctx.fillText('Tau Ceti',px,py+r+18);
  }
  ctx.restore();
}

/* ── UTILS ───────────────────────────────────────────── */
function showScreen(id) {
  document.querySelectorAll('.screen').forEach(s=>s.classList.remove('active'));
  document.getElementById(id).classList.add('active');
}
