// ==========================================
// KOINOT HIMOYACHISI - SPACE DEFENDER GAME
// ==========================================

const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

// UI elementlari
const scoreVal = document.getElementById('scoreVal');
const livesVal = document.getElementById('livesVal');
const highScoreVal = document.getElementById('highScoreVal');
const startScreen = document.getElementById('startScreen');
const gameOverScreen = document.getElementById('gameOverScreen');
const startBtn = document.getElementById('startBtn');
const restartBtn = document.getElementById('restartBtn');
const finalScore = document.getElementById('finalScore');
const finalHighScore = document.getElementById('finalHighScore');

// Canvas o'lchamlari
function resizeCanvas() {
    canvas.width = canvas.parentElement.clientWidth;
    canvas.height = canvas.parentElement.clientHeight;
}
resizeCanvas();
window.addEventListener('resize', resizeCanvas);

// ==========================================
// OVOZ EFFEKTLARI (Web Audio API)
// ==========================================
class SoundFX {
    constructor() {
        this.ctx = null;
    }

    init() {
        if (!this.ctx) {
            const AudioContext = window.AudioContext || window.webkitAudioContext;
            this.ctx = new AudioContext();
        }
        if (this.ctx.state === 'suspended') {
            this.ctx.resume();
        }
    }

    playShoot() {
        if (!this.ctx) return;
        try {
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();
            osc.type = 'sawtooth';
            osc.frequency.setValueAtTime(880, this.ctx.currentTime);
            osc.frequency.exponentialRampToValueAtTime(110, this.ctx.currentTime + 0.12);
            gain.gain.setValueAtTime(0.15, this.ctx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.12);
            osc.connect(gain);
            gain.connect(this.ctx.destination);
            osc.start();
            osc.stop(this.ctx.currentTime + 0.12);
        } catch (e) {}
    }

    playExplosion() {
        if (!this.ctx) return;
        try {
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();
            osc.type = 'triangle';
            osc.frequency.setValueAtTime(140, this.ctx.currentTime);
            osc.frequency.exponentialRampToValueAtTime(20, this.ctx.currentTime + 0.3);
            gain.gain.setValueAtTime(0.3, this.ctx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.3);
            osc.connect(gain);
            gain.connect(this.ctx.destination);
            osc.start();
            osc.stop(this.ctx.currentTime + 0.3);
        } catch (e) {}
    }

    playPowerup() {
        if (!this.ctx) return;
        try {
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();
            osc.type = 'sine';
            const now = this.ctx.currentTime;
            osc.frequency.setValueAtTime(330, now);
            osc.frequency.setValueAtTime(440, now + 0.08);
            osc.frequency.setValueAtTime(660, now + 0.16);
            gain.gain.setValueAtTime(0.2, now);
            gain.gain.exponentialRampToValueAtTime(0.01, now + 0.3);
            osc.connect(gain);
            gain.connect(this.ctx.destination);
            osc.start();
            osc.stop(now + 0.3);
        } catch (e) {}
    }

    playHit() {
        if (!this.ctx) return;
        try {
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();
            osc.type = 'square';
            const now = this.ctx.currentTime;
            osc.frequency.setValueAtTime(120, now);
            osc.frequency.exponentialRampToValueAtTime(30, now + 0.2);
            gain.gain.setValueAtTime(0.2, now);
            gain.gain.exponentialRampToValueAtTime(0.01, now + 0.2);
            osc.connect(gain);
            gain.connect(this.ctx.destination);
            osc.start(now);
            osc.stop(now + 0.2);
        } catch (e) {}
    }
}
const sfx = new SoundFX();

// ==========================================
// O'YIN DASTURI VA PARAMETRLARI
// ==========================================
let score = 0;
let lives = 3;
let highScore = localStorage.getItem('space_defender_highscore') || 0;
highScoreVal.innerText = highScore;

let isPlaying = false;
let animationId = null;
let lastSpawn = 0;
let lastShootTime = 0;

// Yulduzlar foni (Starfield)
const stars = [];
for (let i = 0; i < 70; i++) {
    stars.push({
        x: Math.random() * 480,
        y: Math.random() * 800,
        size: Math.random() * 2 + 0.5,
        speed: Math.random() * 1.5 + 0.5,
        alpha: Math.random() * 0.7 + 0.3
    });
}

// Boshqaruv klavishlari
const keys = {
    left: false,
    right: false,
    space: false
};

// O'yinchi kemasi
const player = {
    x: 0,
    y: 0,
    width: 44,
    height: 48,
    speed: 7,
    shield: false,
    doubleShotTime: 0,
    invincibleTime: 0,

    reset() {
        this.x = canvas.width / 2;
        this.y = canvas.height - 75;
        this.shield = false;
        this.doubleShotTime = 0;
        this.invincibleTime = 0;
    },

    update() {
        if (keys.left) this.x -= this.speed;
        if (keys.right) this.x += this.speed;

        // Chegaralardan chiqib ketmaslik
        const halfW = this.width / 2;
        if (this.x < halfW) this.x = halfW;
        if (this.x > canvas.width - halfW) this.x = canvas.width - halfW;

        if (this.doubleShotTime > 0) this.doubleShotTime--;
        if (this.invincibleTime > 0) this.invincibleTime--;

        // Thruster zarralari
        if (Math.random() < 0.6) {
            particles.push(new Particle(
                this.x + (Math.random() * 10 - 5),
                this.y + 24,
                (Math.random() - 0.5) * 1.5,
                Math.random() * 3 + 2,
                Math.random() * 3 + 2,
                '#00f2fe',
                20
            ));
        }
    },

    draw() {
        ctx.save();
        ctx.translate(this.x, this.y);

        // Jon yo'qotgandan keyin miltillash
        if (this.invincibleTime > 0 && Math.floor(this.invincibleTime / 4) % 2 === 0) {
            ctx.globalAlpha = 0.4;
        }

        // Qalqon (Shield) aylanasi
        if (this.shield) {
            ctx.beginPath();
            ctx.arc(0, 0, 32, 0, Math.PI * 2);
            ctx.strokeStyle = '#00f2fe';
            ctx.lineWidth = 2.5;
            ctx.shadowBlur = 12;
            ctx.shadowColor = '#00f2fe';
            ctx.stroke();
            ctx.shadowBlur = 0;
        }

        // Kema korpusi
        ctx.fillStyle = '#00d4ff';
        ctx.shadowBlur = 10;
        ctx.shadowColor = '#00f2fe';

        ctx.beginPath();
        ctx.moveTo(0, -22); // Burun qismi
        ctx.lineTo(20, 20);  // O'ng qanot
        ctx.lineTo(8, 14);
        ctx.lineTo(0, 18);
        ctx.lineTo(-8, 14);
        ctx.lineTo(-20, 20); // Chap qanot
        ctx.closePath();
        ctx.fill();

        // Kabina (Cockpit)
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.moveTo(0, -12);
        ctx.lineTo(4, 3);
        ctx.lineTo(-4, 3);
        ctx.closePath();
        ctx.fill();

        ctx.restore();
    }
};

// O'qlar (Bullets)
const bullets = [];
class Bullet {
    constructor(x, y, vx = 0, vy = -12) {
        this.x = x;
        this.y = y;
        this.vx = vx;
        this.vy = vy;
        this.radius = 3.5;
        this.alive = true;
    }

    update() {
        this.x += this.vx;
        this.y += this.vy;
        if (this.y < -10 || this.y > canvas.height + 10) {
            this.alive = false;
        }
    }

    draw() {
        ctx.save();
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
        ctx.fillStyle = '#00f2fe';
        ctx.shadowBlur = 8;
        ctx.shadowColor = '#00f2fe';
        ctx.fill();
        ctx.restore();
    }
}

// Dushmanlar (Enemies)
const enemies = [];
class Enemy {
    constructor() {
        this.type = Math.random() < 0.65 ? 'drone' : (Math.random() < 0.7 ? 'asteroid' : 'cruiser');
        this.x = Math.random() * (canvas.width - 50) + 25;
        this.y = -35;
        this.alive = true;

        if (this.type === 'drone') {
            this.width = 30;
            this.height = 30;
            this.speed = Math.random() * 2 + 2.5;
            this.hp = 1;
            this.color = '#ff3366';
            this.angle = 0;
        } else if (this.type === 'asteroid') {
            this.width = 36;
            this.height = 36;
            this.speed = Math.random() * 1.5 + 1.5;
            this.hp = 2;
            this.color = '#a855f7';
            this.angle = 0;
            this.rotSpeed = (Math.random() - 0.5) * 0.05;
        } else {
            // Cruiser - kattaroq va baquvvat
            this.width = 46;
            this.height = 42;
            this.speed = 1.8;
            this.hp = 3;
            this.color = '#f59e0b';
        }
    }

    update() {
        this.y += this.speed;

        if (this.type === 'drone') {
            this.x += Math.sin(this.y * 0.04) * 1.5;
        } else if (this.type === 'asteroid') {
            this.angle += this.rotSpeed;
        }

        if (this.y > canvas.height + 40) {
            this.alive = false;
        }
    }

    draw() {
        ctx.save();
        ctx.translate(this.x, this.y);

        ctx.fillStyle = this.color;
        ctx.shadowBlur = 10;
        ctx.shadowColor = this.color;

        if (this.type === 'drone') {
            // Uchburchak dushman
            ctx.beginPath();
            ctx.moveTo(0, 16);
            ctx.lineTo(16, -16);
            ctx.lineTo(-16, -16);
            ctx.closePath();
            ctx.fill();
        } else if (this.type === 'asteroid') {
            // Aylanuvchi ko'pburchak asteroid
            ctx.rotate(this.angle);
            ctx.beginPath();
            for (let i = 0; i < 6; i++) {
                const a = (i / 6) * Math.PI * 2;
                const r = i % 2 === 0 ? 18 : 13;
                const px = Math.cos(a) * r;
                const py = Math.sin(a) * r;
                if (i === 0) ctx.moveTo(px, py);
                else ctx.lineTo(px, py);
            }
            ctx.closePath();
            ctx.fill();
        } else {
            // Og'ir cruiser
            ctx.beginPath();
            ctx.moveTo(0, 20);
            ctx.lineTo(22, -10);
            ctx.lineTo(12, -20);
            ctx.lineTo(-12, -20);
            ctx.lineTo(-22, -10);
            ctx.closePath();
            ctx.fill();
        }

        ctx.restore();
    }
}

// Bonuslar (Power-ups)
const powerups = [];
class PowerUp {
    constructor(x, y) {
        this.x = x;
        this.y = y;
        this.type = Math.random() < 0.5 ? 'double' : (Math.random() < 0.6 ? 'shield' : 'life');
        this.speed = 2;
        this.radius = 14;
        this.alive = true;
    }

    update() {
        this.y += this.speed;
        if (this.y > canvas.height + 20) this.alive = false;
    }

    draw() {
        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.beginPath();
        ctx.arc(0, 0, this.radius, 0, Math.PI * 2);
        
        let label = '⚡';
        ctx.fillStyle = '#10b981';
        if (this.type === 'double') {
            label = '⚡';
            ctx.fillStyle = '#fbbf24';
        } else if (this.type === 'shield') {
            label = '🛡️';
            ctx.fillStyle = '#00f2fe';
        } else if (this.type === 'life') {
            label = '❤️';
            ctx.fillStyle = '#f43f5e';
        }

        ctx.shadowBlur = 10;
        ctx.shadowColor = ctx.fillStyle;
        ctx.fill();

        ctx.fillStyle = '#000';
        ctx.font = '12px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(label, 0, 0);

        ctx.restore();
    }
}

// Portlash va zarralar (Particles)
const particles = [];
class Particle {
    constructor(x, y, vx, vy, size, color, maxLife = 30) {
        this.x = x;
        this.y = y;
        this.vx = vx;
        this.vy = vy;
        this.size = Math.max(1, size);
        this.color = color;
        this.life = maxLife;
        this.maxLife = maxLife;
    }

    update() {
        this.x += this.vx;
        this.y += this.vy;
        this.life--;
    }

    draw() {
        if (this.life <= 0) return;
        ctx.save();
        const progress = Math.max(0, Math.min(1, this.life / this.maxLife));
        const radius = Math.max(0.1, this.size * progress);
        ctx.globalAlpha = progress;
        ctx.fillStyle = this.color;
        ctx.beginPath();
        ctx.arc(this.x, this.y, radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    }
}

function createExplosion(x, y, color = '#ff3366', count = 18) {
    for (let i = 0; i < count; i++) {
        const angle = Math.random() * Math.PI * 2;
        const spd = Math.random() * 4 + 1.5;
        particles.push(new Particle(
            x,
            y,
            Math.cos(angle) * spd,
            Math.sin(angle) * spd,
            Math.random() * 4 + 2,
            color,
            Math.random() * 20 + 20
        ));
    }
}

// O'q otish funksiyasi
function shootBullet() {
    const now = performance.now();
    if (now - lastShootTime < 160) return; // Otish oraliq vaqti
    lastShootTime = now;

    if (player.doubleShotTime > 0) {
        bullets.push(new Bullet(player.x - 12, player.y - 10));
        bullets.push(new Bullet(player.x + 12, player.y - 10));
    } else {
        bullets.push(new Bullet(player.x, player.y - 20));
    }
    sfx.playShoot();
}

// ==========================================
// TO'QNASHUVLARNI TEKSHIRISH (Collisions)
// ==========================================
function checkCollisions() {
    // 1. O'qlar va dushmanlar
    for (let b of bullets) {
        if (!b.alive) continue;
        for (let e of enemies) {
            if (!e.alive) continue;

            const dist = Math.hypot(b.x - e.x, b.y - e.y);
            if (dist < b.radius + e.width / 2) {
                b.alive = false;
                e.hp--;

                // Hit effekti
                createExplosion(b.x, b.y, '#00f2fe', 5);

                if (e.hp <= 0) {
                    e.alive = false;
                    createExplosion(e.x, e.y, e.color, 22);
                    sfx.playExplosion();

                    // Ball hisoblash
                    const points = e.type === 'cruiser' ? 30 : (e.type === 'asteroid' ? 20 : 10);
                    score += points;
                    scoreVal.innerText = score;

                    // Powerup tushishi (12% ehtimollik)
                    if (Math.random() < 0.12) {
                        powerups.push(new PowerUp(e.x, e.y));
                    }
                }
                break;
            }
        }
    }

    // 2. Kema va Power-uplar
    for (let p of powerups) {
        if (!p.alive) continue;
        const dist = Math.hypot(player.x - p.x, player.y - p.y);
        if (dist < player.width / 2 + p.radius) {
            p.alive = false;
            sfx.playPowerup();
            createExplosion(p.x, p.y, '#10b981', 12);

            if (p.type === 'double') {
                player.doubleShotTime = 600; // ~10 soniya
            } else if (p.type === 'shield') {
                player.shield = true;
            } else if (p.type === 'life') {
                if (lives < 4) {
                    lives++;
                    updateLivesUI();
                }
            }
        }
    }

    // 3. Kema va Dushmanlar to'qnashuvi
    if (player.invincibleTime <= 0) {
        for (let e of enemies) {
            if (!e.alive) continue;

            const dist = Math.hypot(player.x - e.x, player.y - e.y);
            if (dist < player.width / 2 + e.width / 2 - 4) {
                e.alive = false;
                createExplosion(e.x, e.y, e.color, 20);

                if (player.shield) {
                    player.shield = false;
                    sfx.playHit();
                    player.invincibleTime = 45;
                } else {
                    lives--;
                    updateLivesUI();
                    sfx.playHit();
                    player.invincibleTime = 80;

                    if (lives <= 0) {
                        gameOver();
                    }
                }
                break;
            }
        }
    }
}

function updateLivesUI() {
    let hearts = '';
    for (let i = 0; i < lives; i++) hearts += '❤️';
    livesVal.innerText = hearts || '💀';
}

// ==========================================
// ASOSIY O'YIN TIKLI (Main Game Loop)
// ==========================================
function gameLoop(timestamp) {
    if (!isPlaying) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // 1. Yulduzlar harakati
    ctx.fillStyle = '#ffffff';
    for (let star of stars) {
        star.y += star.speed;
        if (star.y > canvas.height) {
            star.y = 0;
            star.x = Math.random() * canvas.width;
        }
        ctx.globalAlpha = star.alpha;
        ctx.fillRect(star.x, star.y, star.size, star.size);
    }
    ctx.globalAlpha = 1.0;

    // 2. Dushmanlarni paydo qilish (Spawning)
    if (timestamp - lastSpawn > Math.max(500, 1400 - score * 0.8)) {
        enemies.push(new Enemy());
        lastSpawn = timestamp;
    }

    // 3. Space tugmasi bosib turilsa doimiy otish
    if (keys.space) {
        shootBullet();
    }

    // 4. Yangilanish va chizish
    player.update();
    player.draw();

    // O'qlar
    for (let i = bullets.length - 1; i >= 0; i--) {
        bullets[i].update();
        bullets[i].draw();
        if (!bullets[i].alive) bullets.splice(i, 1);
    }

    // Dushmanlar
    for (let i = enemies.length - 1; i >= 0; i--) {
        enemies[i].update();
        enemies[i].draw();
        if (!enemies[i].alive) enemies.splice(i, 1);
    }

    // Power-uplar
    for (let i = powerups.length - 1; i >= 0; i--) {
        powerups[i].update();
        powerups[i].draw();
        if (!powerups[i].alive) powerups.splice(i, 1);
    }

    // Zarralar
    for (let i = particles.length - 1; i >= 0; i--) {
        particles[i].update();
        particles[i].draw();
        if (particles[i].life <= 0) particles.splice(i, 1);
    }

    // To'qnashuvlar
    checkCollisions();

    animationId = requestAnimationFrame(gameLoop);
}

// ==========================================
// O'YINNI BOSHLASH VA TUGATISH
// ==========================================
function startGame() {
    sfx.init();
    score = 0;
    lives = 3;
    scoreVal.innerText = score;
    updateLivesUI();

    bullets.length = 0;
    enemies.length = 0;
    powerups.length = 0;
    particles.length = 0;

    player.reset();
    isPlaying = true;
    lastSpawn = performance.now();

    startScreen.classList.remove('active');
    gameOverScreen.classList.remove('active');

    if (animationId) cancelAnimationFrame(animationId);
    animationId = requestAnimationFrame(gameLoop);
}

function gameOver() {
    isPlaying = false;
    cancelAnimationFrame(animationId);
    createExplosion(player.x, player.y, '#00f2fe', 40);

    if (score > highScore) {
        highScore = score;
        localStorage.setItem('space_defender_highscore', highScore);
        highScoreVal.innerText = highScore;
    }

    finalScore.innerText = score;
    finalHighScore.innerText = highScore;

    setTimeout(() => {
        gameOverScreen.classList.add('active');
    }, 450);
}

// ==========================================
// NAZORAT TUGMALARI VA HODISALAR (Events)
// ==========================================
startBtn.addEventListener('click', startGame);
restartBtn.addEventListener('click', startGame);

window.addEventListener('keydown', (e) => {
    if (e.code === 'ArrowLeft' || e.key === 'a' || e.key === 'A') keys.left = true;
    if (e.code === 'ArrowRight' || e.key === 'd' || e.key === 'D') keys.right = true;
    if (e.code === 'Space') {
        keys.space = true;
        if (isPlaying) e.preventDefault();
    }
});

window.addEventListener('keyup', (e) => {
    if (e.code === 'ArrowLeft' || e.key === 'a' || e.key === 'A') keys.left = false;
    if (e.code === 'ArrowRight' || e.key === 'd' || e.key === 'D') keys.right = false;
    if (e.code === 'Space') keys.space = false;
});

// Sichqoncha orqali boshqaruv
canvas.addEventListener('mousemove', (e) => {
    if (!isPlaying) return;
    const rect = canvas.getBoundingClientRect();
    player.x = e.clientX - rect.left;
});

canvas.addEventListener('mousedown', () => {
    if (isPlaying) shootBullet();
});

// Sensorli ekran (Telefon/Planshet) uchun boshqaruv
canvas.addEventListener('touchmove', (e) => {
    if (!isPlaying) return;
    e.preventDefault();
    const rect = canvas.getBoundingClientRect();
    const touch = e.touches[0];
    player.x = touch.clientX - rect.left;
    shootBullet();
}, { passive: false });

canvas.addEventListener('touchstart', (e) => {
    if (!isPlaying) return;
    sfx.init();
    shootBullet();
});
