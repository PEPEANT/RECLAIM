// src/vfx/particle.js - 파티클 효과 클래스
// [분리] classes.js에서 추출

class Particle {
    constructor(x, y, color) {
        this.x = x;
        this.y = y;
        this.color = color;
        this.life = 1.0;
        this.vx = (Math.random() - 0.5) * 8;
        this.vy = (Math.random() - 0.5) * 8;
    }

    update() {
        this.x += this.vx;
        this.y += this.vy;
        this.life -= 0.05;
    }

    draw(ctx) {
        ctx.globalAlpha = Math.max(0, this.life);
        ctx.fillStyle = this.color;
        ctx.beginPath();
        ctx.arc(this.x, this.y, Math.random() * 4, 0, 7);
        ctx.fill();
        ctx.globalAlpha = 1;
    }
}

// 연막탄 효과
class SmokeCloudFX {
    constructor(x, y, opts = {}) {
        this.x = x;
        this.y = y;
        this.puffs = [];
        this.life = 1;
        this.age = 0;

        this.emitFrames = Number.isFinite(opts.emitFrames) ? opts.emitFrames : 220;
        this.maxFrames = Number.isFinite(opts.maxFrames) ? opts.maxFrames : 520;
        this.spawnEvery = Number.isFinite(opts.spawnEvery) ? opts.spawnEvery : 2;
        this.spawnCount = Number.isFinite(opts.spawnCount) ? opts.spawnCount : 4;
        this.spread = Number.isFinite(opts.spread) ? opts.spread : 26;
    }

    _spawnPuff() {
        const tone = Math.floor(210 + Math.random() * 35);
        this.puffs.push({
            x: this.x + (Math.random() - 0.5) * this.spread,
            y: this.y + (Math.random() - 0.5) * 10,
            r: 8 + Math.random() * 12,
            vx: (Math.random() - 0.5) * 0.7,
            vy: -0.3 - Math.random() * 0.4,
            alpha: 0.45 + Math.random() * 0.25,
            color: `rgb(${tone},${tone},${tone - 10})`
        });
    }

    update() {
        this.age++;
        if (this.age < this.emitFrames && this.age % this.spawnEvery === 0) {
            for (let i = 0; i < this.spawnCount; i++) this._spawnPuff();
        }
        this.puffs.forEach(p => {
            p.x += p.vx;
            p.y += p.vy;
            p.r += 0.12;
            p.alpha -= 0.003;
        });
        this.puffs = this.puffs.filter(p => p.alpha > 0);
        if (this.age > this.maxFrames || (this.age >= this.emitFrames && this.puffs.length === 0)) {
            this.life = 0;
        }
    }

    draw(ctx) {
        ctx.save();
        this.puffs.forEach(p => {
            ctx.globalAlpha = Math.max(0, p.alpha);
            ctx.fillStyle = p.color;
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
            ctx.fill();
        });
        ctx.restore();
    }
}
