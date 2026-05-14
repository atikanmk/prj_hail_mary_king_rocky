// ============================================================
//  PROJECT HAIL MARY — King Rocky  |  game.js
// ============================================================

/* ── STORY INTRO ─────────────────────────────────────────── */
const STORY_LINES = [
  "ปี 2091... นักวิทยาศาสตร์ค้นพบสิ่งมีชีวิตขนาดจิ๋วในอวกาศ…",
  "พวกมันเรียกมันว่า 'Astrophage' — สิ่งมีชีวิตที่กินพลังงานจากดวงอาทิตย์",
  "ทุกวัน ดวงอาทิตย์ค่อยๆ หรี่ลง... อุณหภูมิโลกลดต่ำลงเรื่อยๆ",
  "โลกมีเวลาเหลืออีกไม่กี่สิบปีก่อนที่ทุกอย่างจะสิ้นสุด…",
  "ภารกิจ HAIL MARY ถูกเปิดตัว — ส่งยานอวกาศไปยังระบบดาว Tau Ceti",
  "เพราะดาว Tau Ceti ไม่ได้รับผลกระทบ — ต้องมีคำตอบอยู่ที่นั่น",
  "คุณคือ นักบินอวกาศคนสุดท้ายที่ยังมีสติ บนยาน 'King Rocky'",
  "ภารกิจ: ฝ่าแถบอุกกาบาต และถึง Tau Ceti โดยสวัสดิภาพ!",
];

let storyIdx = 0;
let charIdx  = 0;
let storyInterval;

function typeStory() {
  const el  = document.getElementById('story-text');
  const btn = document.getElementById('start-btn');
  const line = STORY_LINES[storyIdx];

  if (charIdx < line.length) {
    el.textContent += line[charIdx++];
    storyInterval = setTimeout(typeStory, 32);
  } else {
    storyIdx++;
    if (storyIdx < STORY_LINES.length) {
      storyInterval = setTimeout(() => {
        el.textContent = '';
        charIdx = 0;
        typeStory();
      }, 1400);
    } else {
      btn.style.display = 'block';
    }
  }
}

window.addEventListener('DOMContentLoaded', () => {
  typeStory();
  document.getElementById('start-btn').addEventListener('click', startGame);

  // Allow skip with any key / click on story box
  document.getElementById('story-box').addEventListener('click', skipStory);
});

function skipStory() {
  clearTimeout(storyInterval);
  document.getElementById('story-text').textContent = STORY_LINES[STORY_LINES.length - 1];
  document.getElementById('start-btn').style.display = 'block';
}

/* ── GAME BOOTSTRAP ──────────────────────────────────────── */
const canvas = document.getElementById('gameCanvas');
const ctx    = canvas.getContext('2d');

let W, H;
function resize() {
  W = canvas.width  = canvas.offsetWidth;
  H = canvas.height = canvas.offsetHeight;
}
window.addEventListener('resize', resize);

/* ── GAME STATE ──────────────────────────────────────────── */
const STATE = { IDLE:0, PLAYING:1, WIN:2, LOSE:3 };
let gameState = STATE.IDLE;
let animId;

// Ship
const ship = {
  x: 0, y: 0, w: 60, h: 36,
  vx: 0, vy: 0,
  speed: 5,
  health: 100,
  invincible: 0,   // frames of invincibility after hit
  thrustParticles: [],
};

// Progress
let distanceTravelled = 0;   // 0..1
const TOTAL_DISTANCE  = 6000; // game units to reach destination

// Sun health (decreases over time — Astrophage eating it)
let sunHealth = 100;

// Stars (parallax layers)
let stars = [];

// Asteroids
let asteroids = [];
let asteroidTimer = 0;
let asteroidInterval = 90; // frames between spawns (decreases over time)

// Particles
let particles = [];

// Keys
const keys = {};
window.addEventListener('keydown', e => { keys[e.key] = true; });
window.addEventListener('keyup',   e => { keys[e.key] = false; });

// Mobile touch / joystick
let touchDir = { x: 0, y: 0 };
let touchActive = false;

canvas.addEventListener('touchstart', onTouch, { passive: false });
canvas.addEventListener('touchmove',  onTouch, { passive: false });
canvas.addEventListener('touchend',   () => { touchDir = { x:0, y:0 }; touchActive = false; });

function onTouch(e) {
  e.preventDefault();
  const t = e.touches[0];
  const rect = canvas.getBoundingClientRect();
  const tx = t.clientX - rect.left;
  const ty = t.clientY - rect.top;
  // Direction relative to ship
  const dx = tx - ship.x;
  const dy = ty - ship.y;
  const len = Math.hypot(dx, dy) || 1;
  touchDir = { x: dx/len, y: dy/len };
  touchActive = true;
}

/* ── START / RESTART ─────────────────────────────────────── */
function startGame() {
  showScreen('game-screen');
  resize();

  // Reset state
  ship.x      = 120;
  ship.y      = H / 2;
  ship.vx     = 0;
  ship.vy     = 0;
  ship.health = 100;
  ship.invincible = 0;
  ship.thrustParticles = [];

  distanceTravelled = 0;
  sunHealth         = 100;
  asteroids         = [];
  particles         = [];
  asteroidTimer     = 0;
  asteroidInterval  = 90;

  // Generate star layers
  stars = [];
  for (let i = 0; i < 200; i++) {
    stars.push({
      x: Math.random() * W,
      y: Math.random() * H,
      r: Math.random() * 1.8 + 0.2,
      speed: Math.random() * 1.5 + 0.3,
      brightness: Math.random() * 0.7 + 0.3,
      color: ['#ffffff','#aaccff','#ffeecc','#ffaaaa'][Math.floor(Math.random()*4)],
    });
  }

  // Add controls tip
  let tip = document.getElementById('controls-tip');
  if (!tip) {
    tip = document.createElement('div');
    tip.id = 'controls-tip';
    tip.textContent = '↑↓←→ / WASD — ควบคุมยาน';
    document.getElementById('game-screen').appendChild(tip);
  }

  gameState = STATE.PLAYING;
  cancelAnimationFrame(animId);
  gameLoop();
}

function restartGame() {
  startGame();
}

/* ── MAIN LOOP ───────────────────────────────────────────── */
function gameLoop() {
  if (gameState !== STATE.PLAYING) return;
  update();
  draw();
  animId = requestAnimationFrame(gameLoop);
}

/* ── UPDATE ──────────────────────────────────────────────── */
function update() {
  handleInput();
  moveShip();
  spawnAsteroids();
  moveAsteroids();
  spawnThrust();
  updateParticles();
  updateStars();
  checkCollisions();
  advanceProgress();
  updateHUD();
}

function handleInput() {
  let dx = 0, dy = 0;

  if (keys['ArrowUp']    || keys['w'] || keys['W']) dy = -1;
  if (keys['ArrowDown']  || keys['s'] || keys['S']) dy =  1;
  if (keys['ArrowLeft']  || keys['a'] || keys['A']) dx = -1;
  if (keys['ArrowRight'] || keys['d'] || keys['D']) dx =  1;

  if (touchActive) { dx = touchDir.x; dy = touchDir.y; }

  // Normalize diagonal
  const len = Math.hypot(dx, dy) || 1;
  if (dx !== 0 || dy !== 0) { dx /= len; dy /= len; }

  const accel = 0.5;
  const friction = 0.85;

  ship.vx = ship.vx * friction + dx * accel * ship.speed * (1 - friction) / friction;
  ship.vy = ship.vy * friction + dy * accel * ship.speed * (1 - friction) / friction;

  // Cap speed
  const spd = Math.hypot(ship.vx, ship.vy);
  if (spd > ship.speed) { ship.vx *= ship.speed/spd; ship.vy *= ship.speed/spd; }
}

function moveShip() {
  ship.x += ship.vx;
  ship.y += ship.vy;

  // Clamp inside canvas with a bit of padding
  const pad = ship.w / 2 + 4;
  ship.x = Math.max(pad, Math.min(W - pad, ship.x));
  ship.y = Math.max(ship.h / 2 + 4, Math.min(H - ship.h / 2 - 4, ship.y));

  if (ship.invincible > 0) ship.invincible--;
}

/* ── ASTEROIDS ───────────────────────────────────────────── */
function spawnAsteroids() {
  asteroidTimer++;
  if (asteroidTimer < asteroidInterval) return;
  asteroidTimer = 0;

  // Difficulty ramp
  asteroidInterval = Math.max(25, 90 - Math.floor(distanceTravelled * 65));

  const variants = ['💫','🪨','☄️'];
  const size  = 20 + Math.random() * 30;
  const speed = 2.5 + Math.random() * 3 + distanceTravelled * 3;
  const y     = Math.random() * (H - size * 2) + size;
  const angle = (Math.random() - 0.5) * 0.4; // slight angle

  asteroids.push({
    x: W + size, y,
    vx: -speed,
    vy: Math.sin(angle) * speed * 0.5,
    r: size,
    emoji: variants[Math.floor(Math.random() * variants.length)],
    rot: Math.random() * Math.PI * 2,
    rotSpeed: (Math.random() - 0.5) * 0.06,
  });
}

function moveAsteroids() {
  for (let i = asteroids.length - 1; i >= 0; i--) {
    const a = asteroids[i];
    a.x  += a.vx;
    a.y  += a.vy;
    a.rot += a.rotSpeed;
    if (a.x < -a.r * 2) asteroids.splice(i, 1);
  }
}

/* ── THRUST PARTICLES ────────────────────────────────────── */
function spawnThrust() {
  for (let i = 0; i < 3; i++) {
    particles.push({
      type: 'thrust',
      x: ship.x - ship.w / 2 - 5,
      y: ship.y + (Math.random() - 0.5) * 14,
      vx: -3 - Math.random() * 3,
      vy: (Math.random() - 0.5) * 1.5,
      life: 1,
      decay: 0.04 + Math.random() * 0.04,
      r: 3 + Math.random() * 4,
      color: ['#ff8800','#ffcc00','#ff4400','#ffffff'][Math.floor(Math.random()*4)],
    });
  }
}

/* ── HIT PARTICLES ───────────────────────────────────────── */
function explodeAt(x, y, count = 18) {
  for (let i = 0; i < count; i++) {
    const angle = Math.random() * Math.PI * 2;
    const spd   = 2 + Math.random() * 5;
    particles.push({
      type: 'explode',
      x, y,
      vx: Math.cos(angle) * spd,
      vy: Math.sin(angle) * spd,
      life: 1,
      decay: 0.025 + Math.random() * 0.04,
      r: 2 + Math.random() * 5,
      color: ['#ff6600','#ffcc00','#ff2200','#ffffff','#ffaaaa'][Math.floor(Math.random()*5)],
    });
  }
}

function updateParticles() {
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    p.x += p.vx;
    p.y += p.vy;
    p.life -= p.decay;
    if (p.life <= 0) particles.splice(i, 1);
  }
}

/* ── STARS SCROLLING ─────────────────────────────────────── */
function updateStars() {
  const baseScroll = 1.5 + distanceTravelled * 2;
  for (const s of stars) {
    s.x -= s.speed * baseScroll;
    if (s.x < 0) { s.x = W; s.y = Math.random() * H; }
  }
}

/* ── COLLISIONS ──────────────────────────────────────────── */
function checkCollisions() {
  if (ship.invincible > 0) return;
  const sr = Math.min(ship.w, ship.h) * 0.38; // ship collision radius

  for (let i = asteroids.length - 1; i >= 0; i--) {
    const a  = asteroids[i];
    const dx = ship.x - a.x;
    const dy = ship.y - a.y;
    if (Math.hypot(dx, dy) < sr + a.r * 0.65) {
      ship.health -= 20;
      ship.invincible = 90; // ~1.5s
      explodeAt(ship.x + (Math.random()-0.5)*20, ship.y + (Math.random()-0.5)*20, 24);
      asteroids.splice(i, 1);

      if (ship.health <= 0) {
        ship.health = 0;
        endGame(false);
        return;
      }
    }
  }
}

/* ── PROGRESS ────────────────────────────────────────────── */
function advanceProgress() {
  distanceTravelled += 1 / TOTAL_DISTANCE;
  distanceTravelled  = Math.min(1, distanceTravelled);

  // Sun degrades slowly (independent timer)
  sunHealth -= 0.008;
  if (sunHealth < 0) sunHealth = 0;

  if (distanceTravelled >= 1) endGame(true);
}

/* ── HUD UPDATE ──────────────────────────────────────────── */
function updateHUD() {
  document.getElementById('health-bar').style.width = ship.health + '%';
  document.getElementById('health-bar').style.background =
    ship.health > 50 ? 'linear-gradient(90deg,#22cc55,#88ff44)'
    : ship.health > 25 ? 'linear-gradient(90deg,#ffaa00,#ffdd44)'
    : 'linear-gradient(90deg,#ff2200,#ff6644)';

  document.getElementById('dist-bar').style.width = (distanceTravelled * 100) + '%';
  document.getElementById('sun-bar').style.width  = sunHealth + '%';
  document.getElementById('sun-bar').style.background =
    sunHealth > 60 ? 'linear-gradient(90deg,#ffcc00,#ff8800)'
    : sunHealth > 30 ? 'linear-gradient(90deg,#ff8800,#ff4400)'
    : 'linear-gradient(90deg,#aa2200,#ff0000)';

  const warpFactor = (1 + distanceTravelled * 9).toFixed(1);
  document.getElementById('speed-val').textContent = warpFactor + 'x';
}

/* ── END GAME ────────────────────────────────────────────── */
function endGame(won) {
  gameState = won ? STATE.WIN : STATE.LOSE;
  cancelAnimationFrame(animId);
  showScreen(won ? 'win-screen' : 'lose-screen');
}

/* ── DRAW ────────────────────────────────────────────────── */
function draw() {
  ctx.clearRect(0, 0, W, H);

  // Deep space gradient background
  const bg = ctx.createLinearGradient(0, 0, W, H);
  bg.addColorStop(0, '#000008');
  bg.addColorStop(0.5, '#00001a');
  bg.addColorStop(1, '#000010');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);

  drawStars();
  drawNebula();
  drawParticles();
  drawAsteroids();
  drawShip();
  drawDistantPlanet();
}

function drawStars() {
  for (const s of stars) {
    ctx.globalAlpha = s.brightness;
    ctx.fillStyle   = s.color;
    ctx.beginPath();
    ctx.arc(s.x, s.y, s.r, 0, Math.PI*2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

function drawNebula() {
  // Subtle nebula cloud drifting
  const t = Date.now() * 0.00015;
  const grd = ctx.createRadialGradient(
    W * (0.6 + Math.sin(t) * 0.15),
    H * (0.4 + Math.cos(t * 0.7) * 0.2),
    30,
    W * (0.6 + Math.sin(t) * 0.15),
    H * (0.4 + Math.cos(t * 0.7) * 0.2),
    H * 0.5
  );
  grd.addColorStop(0, 'rgba(40,0,80,0.12)');
  grd.addColorStop(0.5, 'rgba(0,30,80,0.07)');
  grd.addColorStop(1, 'transparent');
  ctx.fillStyle = grd;
  ctx.fillRect(0, 0, W, H);
}

function drawParticles() {
  for (const p of particles) {
    ctx.globalAlpha = p.life * (p.type === 'thrust' ? 0.8 : 1);
    ctx.fillStyle   = p.color;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.r * p.life, 0, Math.PI*2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

function drawAsteroids() {
  for (const a of asteroids) {
    ctx.save();
    ctx.translate(a.x, a.y);
    ctx.rotate(a.rot);
    ctx.font = `${a.r * 1.6}px serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(a.emoji, 0, 0);
    ctx.restore();
  }
}

function drawShip() {
  // Blink when invincible
  if (ship.invincible > 0 && Math.floor(ship.invincible / 6) % 2 === 0) return;

  ctx.save();
  ctx.translate(ship.x, ship.y);

  // Engine glow
  const glowR = ctx.createRadialGradient(-ship.w/2 - 8, 0, 0, -ship.w/2 - 8, 0, 28);
  glowR.addColorStop(0, 'rgba(0,180,255,0.6)');
  glowR.addColorStop(1, 'transparent');
  ctx.fillStyle = glowR;
  ctx.beginPath();
  ctx.arc(-ship.w/2 - 8, 0, 28, 0, Math.PI*2);
  ctx.fill();

  // Main hull (sleek rocket shape)
  ctx.beginPath();
  // Nose
  ctx.moveTo(ship.w / 2, 0);
  // Top
  ctx.lineTo(ship.w / 4,  -ship.h / 2);
  ctx.lineTo(-ship.w / 2, -ship.h / 3);
  // Engine back
  ctx.lineTo(-ship.w / 2,  ship.h / 3);
  // Bottom
  ctx.lineTo(ship.w / 4,   ship.h / 2);
  ctx.closePath();

  const hullGrad = ctx.createLinearGradient(-ship.w/2, -ship.h/2, ship.w/2, ship.h/2);
  hullGrad.addColorStop(0, '#4488cc');
  hullGrad.addColorStop(0.5, '#88ccff');
  hullGrad.addColorStop(1, '#224488');
  ctx.fillStyle = hullGrad;
  ctx.fill();
  ctx.strokeStyle = '#00aaff';
  ctx.lineWidth   = 1.5;
  ctx.stroke();

  // Top wing
  ctx.beginPath();
  ctx.moveTo(0, -ship.h / 2);
  ctx.lineTo(-ship.w / 2, -ship.h);
  ctx.lineTo(-ship.w / 2, -ship.h / 3);
  ctx.closePath();
  ctx.fillStyle = '#1155aa';
  ctx.fill();
  ctx.strokeStyle = '#0088ff';
  ctx.stroke();

  // Bottom wing
  ctx.beginPath();
  ctx.moveTo(0,  ship.h / 2);
  ctx.lineTo(-ship.w / 2,  ship.h);
  ctx.lineTo(-ship.w / 2,  ship.h / 3);
  ctx.closePath();
  ctx.fillStyle = '#1155aa';
  ctx.fill();
  ctx.stroke();

  // Cockpit window
  ctx.beginPath();
  ctx.arc(ship.w / 5, 0, 9, 0, Math.PI*2);
  const cockpitGrad = ctx.createRadialGradient(ship.w/5 - 3, -3, 1, ship.w/5, 0, 9);
  cockpitGrad.addColorStop(0, '#aaeeff');
  cockpitGrad.addColorStop(1, '#006699');
  ctx.fillStyle   = cockpitGrad;
  ctx.fill();
  ctx.strokeStyle = '#88ddff';
  ctx.lineWidth   = 1;
  ctx.stroke();

  ctx.restore();
}

function drawDistantPlanet() {
  // Draw destination planet growing larger as we get closer
  const prog = distanceTravelled;
  const r    = prog * 60 + 5;
  const px   = W - 60;
  const py   = H / 2;

  if (prog < 0.05) return; // not visible yet

  ctx.save();
  ctx.globalAlpha = Math.min(1, (prog - 0.05) * 5);

  // Glow
  const glowGrd = ctx.createRadialGradient(px, py, r * 0.5, px, py, r * 3);
  glowGrd.addColorStop(0, 'rgba(0,255,100,0.15)');
  glowGrd.addColorStop(1, 'transparent');
  ctx.fillStyle = glowGrd;
  ctx.beginPath();
  ctx.arc(px, py, r * 3, 0, Math.PI*2);
  ctx.fill();

  // Planet body
  const planetGrd = ctx.createRadialGradient(px - r*0.3, py - r*0.3, r*0.1, px, py, r);
  planetGrd.addColorStop(0, '#aaffcc');
  planetGrd.addColorStop(0.5,'#33bb66');
  planetGrd.addColorStop(1, '#114422');
  ctx.fillStyle = planetGrd;
  ctx.beginPath();
  ctx.arc(px, py, r, 0, Math.PI*2);
  ctx.fill();

  // Label
  if (prog > 0.3) {
    ctx.globalAlpha = Math.min(1, (prog - 0.3) * 4);
    ctx.fillStyle   = '#88ffcc';
    ctx.font        = 'bold 13px Courier New';
    ctx.textAlign   = 'center';
    ctx.fillText('Tau Ceti', px, py + r + 18);
  }

  ctx.restore();
}

/* ── SCREEN UTILS ────────────────────────────────────────── */
function showScreen(id) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.getElementById(id).classList.add('active');
}
