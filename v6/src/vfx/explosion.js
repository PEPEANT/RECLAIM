// src/vfx/explosion.js
// RECLAIM VFX: nuke / bomb / artillery / drone explosions
// - uses game.particles (world-space objects): update(), draw(ctx), life
// - optional screen feedback hooks: game.addFlash / game.addShake

(function () {
    'use strict';

    // ==========================
    // Utils
    // ==========================
    const rand = (min, max) => Math.random() * (max - min) + min;
    const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

    function safeAddShake(game, amount) {
        if (!game) return;
        if (typeof game.addShake === 'function') game.addShake(amount);
        else game.shake = Math.max(game.shake || 0, amount);
    }

    function safeAddFlash(game, amount) {
        if (!game) return;
        if (typeof game.addFlash === 'function') game.addFlash(amount);
        else game.flash = Math.max(game.flash || 0, amount);
    }

    // Resolve ground impact Y to the active grass walk band.
    function resolveGroundImpactY(game, rawY) {
        const inputY = Number(rawY);
        if (game) {
            if (typeof game.clampGroundLaneY === 'function') {
                if (Number.isFinite(inputY)) return game.clampGroundLaneY(inputY);
                if (typeof game.getGroundLaneBaseY === 'function') {
                    const by = Number(game.getGroundLaneBaseY());
                    if (Number.isFinite(by)) return game.clampGroundLaneY(by);
                }
            }

            if (typeof game.getGroundLaneBounds === 'function') {
                const bounds = game.getGroundLaneBounds();
                const bMin = Number(bounds && bounds.min);
                const bMax = Number(bounds && bounds.max);
                const bBase = Number(bounds && bounds.base);
                if (Number.isFinite(bMin) && Number.isFinite(bMax) && bMax >= bMin) {
                    const candidate = Number.isFinite(inputY) ? inputY : (Number.isFinite(bBase) ? bBase : bMin);
                    return Math.max(bMin, Math.min(bMax, candidate));
                }
            }

            const gy = Number(game.groundY);
            const h = Number(game.height);
            if (Number.isFinite(gy) && Number.isFinite(h) && h > gy) {
                const min = gy + Math.max(38, Math.round((h - gy) * 0.30));
                const max = Math.max(min + 24, h - 18);
                const candidate = Number.isFinite(inputY) ? inputY : (min + ((max - min) * 0.55));
                return Math.max(min, Math.min(max, candidate));
            }

            if (Number.isFinite(gy)) return Number.isFinite(inputY) ? Math.max(gy, inputY) : gy;
        }

        return Number.isFinite(inputY) ? inputY : 0;
    }

    // Prevent unbounded game.particles growth (prune simple particles first).
    function pruneParticles(game, limit) {
        if (!game || !Array.isArray(game.particles)) return;
        const arr = game.particles;
        if (arr.length <= limit) return;

        // 1) Simple Particle 먼저 제거 (O(n) in-place)
        let excess = arr.length - limit;
        let removed = 0;
        let w = 0;
        for (let i = 0; i < arr.length; i++) {
            const p = arr[i];
            const isSimple = p && p.constructor && p.constructor.name === 'Particle';
            if (isSimple && removed < excess) {
                removed++;
                continue;
            }
            arr[w++] = p;
        }
        arr.length = w;

        // 2) 여전히 초과면 오래된 것부터 제거 (앞에서 drop)
        if (arr.length > limit) {
            const drop = arr.length - limit;
            for (let i = 0; i < limit; i++) {
                arr[i] = arr[i + drop];
            }
            arr.length = limit;
        }
    }

    // ==========================
    // Internal Particle Model (ExplosionFX)
    // ==========================
    function makeP(x, y, vx, vy, r, life, kind, hue, sat, light, alpha) {
        return {
            x, y, vx, vy, r,
            life, maxLife: life,
            kind,
            hue, sat, light, alpha
        };
    }

    class ShockwaveFX {
        constructor(x, y, maxR, speed, width, color, life) {
            this.x = x;
            this.y = y;
            this.r = 0;
            this.maxR = maxR;
            this.speed = speed;
            this.width = width;
            this.color = color;
            this.life = life; // 0~1
        }

        update() {
            if (this.life <= 0) return;
            this.r += this.speed;
            this.speed *= 0.92;
            this.life *= 0.94;
            if (this.r > this.maxR || this.life < 0.02) this.life = 0;
        }

        draw(ctx) {
            if (this.life <= 0) return;
            const a = clamp(this.life, 0, 1);
            ctx.save();
            ctx.globalAlpha = a;
            ctx.strokeStyle = this.color;
            ctx.lineWidth = this.width * a;
            ctx.beginPath();
            ctx.arc(this.x, this.y, this.r, 0, Math.PI * 2);
            ctx.stroke();
            ctx.restore();
        }
    }

    // ==========================
    // Generic Explosion
    // ==========================
    class ExplosionFX {
        constructor(game, x, groundY, scale, preset) {
            this.game = game;
            this.x = x;
            this.groundY = groundY;
            this.scale = scale;
            this.preset = preset;
            this.life = preset.life;

            this._t = 0;
            this._parts = [];
            this._waves = [];

            this._init();
        }

        _init() {
            const g = this.groundY;
            const x = this.x;
            const s = this.scale;
            const p = this.preset;

            // Immediate screen feedback.
            if (p.shake) safeAddShake(this.game, p.shake);
            if (p.flash) safeAddFlash(this.game, p.flash);

            // Shockwave ring.
            if (p.wave) {
                this._waves.push(new ShockwaveFX(
                    x,
                    g,
                    p.wave.maxR,
                    p.wave.speed,
                    p.wave.width,
                    p.wave.color,
                    p.wave.life
                ));
            }

            // Adaptive particle budget (small screens / heavy load).
            const w = (this.game && this.game.width) ? this.game.width : window.innerWidth;
            const isSmallScreen = w < 520;
            const particleLoad = (this.game && Array.isArray(this.game.particles)) ? this.game.particles.length : 0;
            let perfQ = 1.0;
            if (particleLoad > 200) {
                const t = Math.min(1, (particleLoad - 200) / 300);
                perfQ = 1 - (t * 0.6);
            }
            const q = clamp((isSmallScreen ? 0.72 : 1.0) * perfQ, 0.35, 1.0);

            const fireN = Math.floor(p.count.fire * q);
            const dustN = Math.floor(p.count.dust * q);
            const smokeN = Math.floor(p.count.smoke * q);
            const sparkN = Math.floor(p.count.spark * q);

            // Fire / Spark (lighter)
            for (let i = 0; i < fireN; i++) {
                const ang = rand(0, Math.PI * 2);
                const spd = rand(p.fire.spdMin, p.fire.spdMax) * s;
                const vx = Math.cos(ang) * spd * p.fire.spread;
                const vy = Math.sin(ang) * spd - rand(p.fire.liftMin, p.fire.liftMax) * s;
                const life = rand(p.fire.lifeMin, p.fire.lifeMax);
                const r = rand(p.fire.rMin, p.fire.rMax) * s;
                this._parts.push(makeP(x, g, vx, vy, r, life, 'fire', 40, 100, 80, 1));
            }

            for (let i = 0; i < sparkN; i++) {
                const ang = rand(0, Math.PI * 2);
                const spd = rand(p.spark.spdMin, p.spark.spdMax) * s;
                const vx = Math.cos(ang) * spd;
                const vy = Math.sin(ang) * spd - rand(2, 8) * s;
                const life = rand(p.spark.lifeMin, p.spark.lifeMax);
                const r = rand(p.spark.rMin, p.spark.rMax) * s;
                this._parts.push(makeP(x, g - rand(0, 10) * s, vx, vy, r, life, 'spark', 45, 100, 75, 1));
            }

            // Smoke (source-over)
            for (let i = 0; i < smokeN; i++) {
                const vx = rand(-p.smoke.spd, p.smoke.spd) * s;
                const vy = -rand(p.smoke.liftMin, p.smoke.liftMax) * s;
                const life = rand(p.smoke.lifeMin, p.smoke.lifeMax);
                const r = rand(p.smoke.rMin, p.smoke.rMax) * s;
                this._parts.push(makeP(x + rand(-12, 12) * s, g - rand(4, 20) * s, vx, vy, r, life, 'smoke', 0, 0, 18, 1));
            }

            // Dust (ground-hugging debris).
            for (let i = 0; i < dustN; i++) {
                const vx = rand(-p.dust.spd, p.dust.spd) * s;
                const vy = -rand(0.5, 4.5) * s;
                const life = rand(p.dust.lifeMin, p.dust.lifeMax);
                const r = rand(p.dust.rMin, p.dust.rMax) * s;
                this._parts.push(makeP(x + rand(-10, 10) * s, g, vx, vy, r, life, 'dust', 0, 0, 40, 0.65));
            }
        }

        update() {
            this._t++;
            this.life -= this.preset.decay;

            // shockwaves
            for (let i = this._waves.length - 1; i >= 0; i--) {
                const w = this._waves[i];
                w.update();
                if (w.life <= 0) this._waves.splice(i, 1);
            }

            // particles
            const g = this.groundY;
            const s = this.scale;
            for (let i = this._parts.length - 1; i >= 0; i--) {
                const p = this._parts[i];
                p.life -= 1;
                if (p.life <= 0) {
                    this._parts.splice(i, 1);
                    continue;
                }

                // physics
                p.x += p.vx;
                p.y += p.vy;

                // drag
                const drag = (p.kind === 'dust') ? 0.90 : 0.94;
                p.vx *= drag;
                p.vy *= drag;

                if (p.kind === 'fire' || p.kind === 'spark') {
                    // buoyancy + expansion
                    p.vy -= 0.10 * s;
                    p.r *= 1.008;

                    // Burn from bright to dark over lifetime.
                    const k = 1 - (p.life / p.maxLife);
                    if (p.kind === 'fire') {
                        p.hue = 42 - k * 40;           // 40 -> 2
                        p.light = 80 - k * 55;         // 80 -> 25
                        p.alpha = clamp(1 - k * 0.85, 0, 1);
                    } else {
                        // spark: fades faster.
                        p.light = 85 - k * 80;
                        p.alpha = clamp(1 - k * 0.95, 0, 1);
                    }
                } else if (p.kind === 'smoke') {
                    // smoke: slow rise, wider spread over time.
                    p.vy -= 0.03 * s;
                    p.r *= 1.012;
                    const k = 1 - (p.life / p.maxLife);
                    p.light = 22 + k * 12;
                    p.alpha = clamp(0.75 - k * 0.70, 0, 1);
                } else if (p.kind === 'dust') {
                    // dust: gravity + floor bounce for grounded feel.
                    p.vy += 0.22 * s;
                    if (p.y > g) {
                        p.y = g;
                        p.vy *= -0.35;
                        p.vx *= 0.75;
                    }
                    p.r *= 1.010;
                    const k = 1 - (p.life / p.maxLife);
                    p.alpha = clamp(0.60 - k * 0.55, 0, 1);
                }
            }

            // 종료 조건
            if (this.life <= 0 && this._parts.length === 0 && this._waves.length === 0) {
                this.life = 0;
            }
        }

        draw(ctx) {
            if (this.life <= 0) return;

            // Draw shockwaves first.
            for (let i = 0; i < this._waves.length; i++) this._waves[i].draw(ctx);

            // fire/spark: lighter
            ctx.save();
            ctx.globalCompositeOperation = 'lighter';
            for (let i = 0; i < this._parts.length; i++) {
                const p = this._parts[i];
                if (p.kind !== 'fire' && p.kind !== 'spark') continue;
                const a = clamp((p.life / p.maxLife) * p.alpha, 0, 1);
                ctx.globalAlpha = a;
                ctx.fillStyle = `hsla(${p.hue}, ${p.sat}%, ${p.light}%, ${a})`;
                ctx.beginPath();
                ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
                ctx.fill();
            }
            ctx.restore();

            // smoke/dust: source-over
            ctx.save();
            ctx.globalCompositeOperation = 'source-over';
            for (let i = 0; i < this._parts.length; i++) {
                const p = this._parts[i];
                if (p.kind === 'fire' || p.kind === 'spark') continue;
                const a = clamp((p.life / p.maxLife) * p.alpha, 0, 1);
                ctx.globalAlpha = a;

                if (p.kind === 'smoke') {
                    ctx.fillStyle = `rgba(40,40,40,${a})`;
                } else {
                    ctx.fillStyle = `rgba(90,90,90,${a * 0.9})`;
                }

                ctx.beginPath();
                ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
                ctx.fill();
            }
            ctx.restore();
        }
    }

    // ==========================
    // Nuke Mushroom FX (custom)
    // ==========================
    function getMushroomColor(life, type) {
        if (type === 'shockwave') return `rgba(255, 255, 255, ${life * 0.5})`;
        let r, g, b, a;
        a = life;
        if (life > 0.95) {
            r = 255; g = 255; b = 255;
        } else if (life > 0.8) {
            r = 255; g = 255; b = 100;
        } else if (life > 0.6) {
            r = 255; g = 160; b = 50;
        } else if (life > 0.4) {
            r = 200; g = 50; b = 20;
        } else if (life > 0.2) {
            r = 50; g = 40; b = 40;
            a = life * 0.8;
        } else {
            r = 20; g = 20; b = 20;
            a = life * 0.5;
        }
        return `rgba(${r}, ${g}, ${b}, ${a})`;
    }

    function makeMushParticle(x, y, type, scale) {
        const p = {
            x, y, type,
            vx: (Math.random() - 0.5) * 2,
            vy: (Math.random() - 0.5) * 2,
            size: rand(10, 30) * scale,
            life: 1.0,
            decay: rand(0.001, 0.003),
            drag: 0.96
        };

        if (type === 'head') {
            p.vx = (Math.random() - 0.5) * 15 * scale;
            p.vy = (Math.random() - 1.0) * 15 * scale - 5 * scale;
            p.drag = 0.92;
        } else if (type === 'stem') {
            p.vx = (Math.random() - 0.5) * 20 * scale;
            p.vy = Math.random() * -5 * scale;
            p.drag = 0.90;
            p.size = rand(5, 20) * scale;
            p.decay = 0.003;
        } else if (type === 'glow') {
            p.vx = 0;
            p.vy = -2 * scale;
            p.size = 150 * scale;
            p.decay = 0.01;
        }
        return p;
    }

    class NukeMushroomFX {
        constructor(game, x, groundY, scale) {
            this.game = game;
            this.x = x;
            this.groundY = groundY;
            this.scale = scale;
            this.life = 1;
            this.age = 0;
            this.heatHeadY = groundY - 50 * scale;
            this._parts = [];

            safeAddShake(this.game, 28 * scale);
            safeAddFlash(this.game, 1.2);

            for (let i = 0; i < 300; i++) {
                this._parts.push(makeMushParticle(x, groundY, 'head', scale));
            }
            this._parts.push(makeMushParticle(x, groundY, 'glow', scale));
        }

        update() {
            if (this.life <= 0) return;
            this.age += 1;
            const s = this.scale;

            const riseSpeed = Math.max(0.5, 6 - this.age * 0.02) * s;
            this.heatHeadY -= riseSpeed;

            if (this.age < 300) {
                const spawnX = this.x + (Math.random() - 0.5) * (100 + this.age) * s;
                this._parts.push(makeMushParticle(spawnX, this.groundY - 10 * s, 'stem', s));

                if (Math.random() < 0.3) {
                    const angle = Math.random() * Math.PI * 2;
                    const r = Math.random() * 30 * s;
                    const hx = this.x + Math.cos(angle) * r;
                    const hy = this.heatHeadY + Math.sin(angle) * r;
                    const hp = makeMushParticle(hx, hy, 'head', s);
                    hp.life = 0.7;
                    hp.vx *= 0.2;
                    this._parts.push(hp);
                }
            }

            for (let i = this._parts.length - 1; i >= 0; i--) {
                const p = this._parts[i];
                p.x += p.vx;
                p.y += p.vy;
                p.vx *= p.drag || 0.96;
                p.vy *= p.drag || 0.96;
                p.life -= p.decay;
                p.size += 0.2 * s;

                if (p.type === 'head') {
                    p.vy -= 0.05 * s;
                    const dx = p.x - this.x;
                    const dy = p.y - this.heatHeadY;
                    const dist = Math.max(1, Math.sqrt(dx * dx + dy * dy));
                    if (dist < 300 * s) {
                        p.vx += (dx / dist) * 0.15 * s;
                        if (p.y > this.heatHeadY) {
                            p.vx += (dx / dist) * 0.2 * s;
                        }
                        if (Math.abs(dx) > 100 * s) {
                            p.vy += 0.1 * s;
                            p.vx -= (dx / dist) * 0.02 * s;
                        }
                    }
                } else if (p.type === 'stem') {
                    const dx = this.x - p.x;
                    p.vx += dx * 0.015 * s;
                    p.vy -= 0.15 * s;
                    p.x += (Math.random() - 0.5) * 2 * s;
                }

                if (p.y > this.groundY && p.vy > 0) {
                    p.y = this.groundY;
                    p.vy *= -0.2;
                    p.vx *= 0.5;
                }

                if (p.life <= 0) {
                    this._parts.splice(i, 1);
                }
            }

            if (this.age > 900 && this._parts.length === 0) {
                this.life = 0;
            }
        }

        draw(ctx) {
            if (this.life <= 0) return;
            for (let i = 0; i < this._parts.length; i++) {
                const p = this._parts[i];
                if (p.life <= 0.01) continue;

                if (p.life > 0.5 && p.type !== 'stem') {
                    ctx.globalCompositeOperation = 'lighter';
                } else {
                    ctx.globalCompositeOperation = 'source-over';
                }

                const color = getMushroomColor(p.life, p.type);
                const grad = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.size);
                grad.addColorStop(0, color);
                grad.addColorStop(1, 'rgba(0,0,0,0)');
                ctx.fillStyle = grad;
                ctx.beginPath();
                ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
                ctx.fill();
            }
            ctx.globalCompositeOperation = 'source-over';
        }
    }

    // ==========================
    // Presets (base size/intensity; scaled at spawn time).
    // ==========================
    const PRESETS = {
        nuke: {
            life: 2.2,
            decay: 0.010,
            shake: 22,
            flash: 1.0,
            wave: { maxR: 1200, speed: 55, width: 48, color: 'rgba(255,255,255,0.9)', life: 1.0 },
            count: { fire: 220, dust: 140, smoke: 70, spark: 60 },
            fire: { spdMin: 2, spdMax: 12, spread: 0.55, liftMin: 10, liftMax: 22, lifeMin: 70, lifeMax: 150, rMin: 14, rMax: 42 },
            spark: { spdMin: 8, spdMax: 24, lifeMin: 18, lifeMax: 36, rMin: 1.8, rMax: 3.4 },
            smoke: { spd: 2.2, liftMin: 1.5, liftMax: 4.0, lifeMin: 90, lifeMax: 170, rMin: 18, rMax: 52 },
            dust: { spd: 18, lifeMin: 35, lifeMax: 90, rMin: 6, rMax: 14 }
        },
        bomb: {
            life: 1.2,
            decay: 0.028,
            shake: 10,
            flash: 0.28,
            wave: { maxR: 380, speed: 26, width: 20, color: 'rgba(255,220,180,0.8)', life: 1.0 },
            count: { fire: 70, dust: 55, smoke: 26, spark: 22 },
            fire: { spdMin: 1.5, spdMax: 9.5, spread: 0.85, liftMin: 6, liftMax: 12, lifeMin: 32, lifeMax: 70, rMin: 6, rMax: 18 },
            spark: { spdMin: 6, spdMax: 18, lifeMin: 12, lifeMax: 26, rMin: 1.2, rMax: 2.6 },
            smoke: { spd: 2.0, liftMin: 1.0, liftMax: 2.6, lifeMin: 55, lifeMax: 110, rMin: 10, rMax: 28 },
            dust: { spd: 14, lifeMin: 28, lifeMax: 70, rMin: 4, rMax: 10 }
        },
        artillery: {
            life: 1.0,
            decay: 0.032,
            shake: 8,
            flash: 0.18,
            wave: { maxR: 320, speed: 22, width: 16, color: 'rgba(255,210,140,0.75)', life: 1.0 },
            count: { fire: 58, dust: 46, smoke: 22, spark: 16 },
            fire: { spdMin: 1.2, spdMax: 8.0, spread: 0.85, liftMin: 5, liftMax: 10, lifeMin: 28, lifeMax: 62, rMin: 5, rMax: 16 },
            spark: { spdMin: 5, spdMax: 15, lifeMin: 10, lifeMax: 24, rMin: 1.1, rMax: 2.2 },
            smoke: { spd: 1.6, liftMin: 0.8, liftMax: 2.4, lifeMin: 50, lifeMax: 95, rMin: 10, rMax: 26 },
            dust: { spd: 12, lifeMin: 25, lifeMax: 60, rMin: 4, rMax: 9 }
        },
        drone: {
            life: 0.95,
            decay: 0.040,
            shake: 7,
            flash: 0.14,
            wave: { maxR: 260, speed: 20, width: 12, color: 'rgba(255,210,160,0.65)', life: 1.0 },
            count: { fire: 44, dust: 26, smoke: 14, spark: 18 },
            fire: { spdMin: 1.0, spdMax: 7.0, spread: 0.92, liftMin: 4, liftMax: 9, lifeMin: 22, lifeMax: 50, rMin: 4, rMax: 12 },
            spark: { spdMin: 5, spdMax: 16, lifeMin: 10, lifeMax: 22, rMin: 1.1, rMax: 2.4 },
            smoke: { spd: 1.4, liftMin: 0.8, liftMax: 2.1, lifeMin: 40, lifeMax: 80, rMin: 8, rMax: 20 },
            dust: { spd: 10, lifeMin: 20, lifeMax: 55, rMin: 3.5, rMax: 8.5 }
        },
        stealth: {
            // Stealth drone impact: slightly stronger than bomb.
            life: 1.25,
            decay: 0.028,
            shake: 12,
            flash: 0.30,
            wave: { maxR: 420, speed: 28, width: 22, color: 'rgba(255,220,160,0.8)', life: 1.0 },
            count: { fire: 86, dust: 62, smoke: 28, spark: 26 },
            fire: { spdMin: 1.6, spdMax: 10.5, spread: 0.90, liftMin: 7, liftMax: 13, lifeMin: 34, lifeMax: 78, rMin: 6, rMax: 19 },
            spark: { spdMin: 7, spdMax: 18, lifeMin: 12, lifeMax: 26, rMin: 1.2, rMax: 2.6 },
            smoke: { spd: 2.0, liftMin: 1.0, liftMax: 2.8, lifeMin: 55, lifeMax: 110, rMin: 10, rMax: 30 },
            dust: { spd: 15, lifeMin: 28, lifeMax: 72, rMin: 4, rMax: 10 }
        },
        at: {
            // AT drone (anti-vehicle impact): medium blast, more sparks.
            life: 1.05,
            decay: 0.036,
            shake: 9,
            flash: 0.20,
            wave: { maxR: 310, speed: 23, width: 16, color: 'rgba(255,220,180,0.75)', life: 1.0 },
            count: { fire: 56, dust: 34, smoke: 18, spark: 28 },
            fire: { spdMin: 1.2, spdMax: 8.6, spread: 0.9, liftMin: 5, liftMax: 11, lifeMin: 26, lifeMax: 58, rMin: 5, rMax: 15 },
            spark: { spdMin: 7, spdMax: 19, lifeMin: 12, lifeMax: 26, rMin: 1.2, rMax: 2.8 },
            smoke: { spd: 1.7, liftMin: 0.9, liftMax: 2.4, lifeMin: 45, lifeMax: 95, rMin: 9, rMax: 24 },
            dust: { spd: 12, lifeMin: 22, lifeMax: 60, rMin: 3.5, rMax: 8.5 }
        },

        // [ADD] Small direct-hit impact (ground strike).
        hit: {
            life: 0.55,
            decay: 0.07,
            shake: 3,
            flash: 0.06,
            wave: { maxR: 140, speed: 22, width: 8, color: 'rgba(255,240,200,0.7)', life: 1.0 },
            count: { fire: 14, dust: 8, smoke: 6, spark: 14 },
            fire: { spdMin: 1.0, spdMax: 6.0, spread: 0.95, liftMin: 2, liftMax: 7, lifeMin: 14, lifeMax: 28, rMin: 3.5, rMax: 10 },
            spark: { spdMin: 6, spdMax: 18, lifeMin: 8, lifeMax: 18, rMin: 1.0, rMax: 2.2 },
            smoke: { spd: 1.2, liftMin: 0.6, liftMax: 1.6, lifeMin: 22, lifeMax: 45, rMin: 6, rMax: 16 },
            dust: { spd: 8, lifeMin: 14, lifeMax: 30, rMin: 2.5, rMax: 6 }
        },

        // [ADD] Air impact / drone destruction (no dust).
        hit_air: {
            life: 0.50,
            decay: 0.08,
            shake: 2,
            flash: 0.05,
            wave: { maxR: 120, speed: 24, width: 7, color: 'rgba(255,240,210,0.6)', life: 1.0 },
            count: { fire: 12, dust: 0, smoke: 7, spark: 16 },
            fire: { spdMin: 1.0, spdMax: 6.0, spread: 0.98, liftMin: 2, liftMax: 8, lifeMin: 12, lifeMax: 26, rMin: 3, rMax: 9 },
            spark: { spdMin: 7, spdMax: 20, lifeMin: 8, lifeMax: 18, rMin: 1.0, rMax: 2.4 },
            smoke: { spd: 1.4, liftMin: 0.8, liftMax: 2.0, lifeMin: 20, lifeMax: 45, rMin: 6, rMax: 18 },
            dust: { spd: 0, lifeMin: 0, lifeMax: 0, rMin: 0, rMax: 0 }
        },

        // [ADD] Tactical missile impact (larger than bomb).
        tactical: {
            life: 1.25,
            decay: 0.035,
            shake: 12,
            flash: 0.30,
            wave: { maxR: 520, speed: 34, width: 24, color: 'rgba(255,230,180,0.8)', life: 1.0 },
            count: { fire: 70, dust: 40, smoke: 30, spark: 45 },
            fire: { spdMin: 1.5, spdMax: 10.5, spread: 0.88, liftMin: 6, liftMax: 14, lifeMin: 30, lifeMax: 80, rMin: 6, rMax: 20 },
            spark: { spdMin: 8, spdMax: 26, lifeMin: 12, lifeMax: 28, rMin: 1.2, rMax: 2.8 },
            smoke: { spd: 2.1, liftMin: 1.0, liftMax: 3.2, lifeMin: 55, lifeMax: 120, rMin: 12, rMax: 36 },
            dust: { spd: 15, lifeMin: 26, lifeMax: 72, rMin: 4, rMax: 10 }
        },
        emp: {
            life: 1.35,
            decay: 0.026,
            shake: 9,
            flash: 0.42,
            wave: { maxR: 760, speed: 40, width: 20, color: 'rgba(90,245,255,0.88)', life: 1.0 },
            count: { fire: 12, dust: 0, smoke: 28, spark: 68 },
            fire: { spdMin: 0.6, spdMax: 4.2, spread: 0.9, liftMin: 2, liftMax: 6, lifeMin: 16, lifeMax: 42, rMin: 3, rMax: 8 },
            spark: { spdMin: 10, spdMax: 28, lifeMin: 12, lifeMax: 30, rMin: 1.0, rMax: 2.6 },
            smoke: { spd: 1.2, liftMin: 0.6, liftMax: 1.8, lifeMin: 40, lifeMax: 100, rMin: 8, rMax: 24 },
            dust: { spd: 0, lifeMin: 0, lifeMax: 0, rMin: 0, rMax: 0 }
        },

        // [ADD] 비행 트레일용 (전술미사일 비행)
        trail: {
            life: 0.35,
            decay: 0.12,
            shake: 0,
            flash: 0,
            wave: null,
            count: { fire: 0, dust: 0, smoke: 2, spark: 0 },
            fire: { spdMin: 0, spdMax: 0, spread: 1, liftMin: 0, liftMax: 0, lifeMin: 0, lifeMax: 0, rMin: 0, rMax: 0 },
            spark: { spdMin: 0, spdMax: 0, lifeMin: 0, lifeMax: 0, rMin: 0, rMax: 0 },
            smoke: { spd: 0.7, liftMin: 0.1, liftMax: 0.4, lifeMin: 18, lifeMax: 34, rMin: 4, rMax: 10 },
            dust: { spd: 0, lifeMin: 0, lifeMax: 0, rMin: 0, rMax: 0 }
        },

        // =====================================================
        // [P1] 추가 폭발 이펙트 프리셋
        // =====================================================

        // 중장비 폭발 (탱크/APC 파괴 시) - 금속 파편, 강한 화염
        vehicle: {
            life: 1.15,
            decay: 0.032,
            shake: 14,
            flash: 0.32,
            wave: { maxR: 280, speed: 28, width: 18, color: 'rgba(255,200,120,0.8)', life: 1.0 },
            count: { fire: 65, dust: 48, smoke: 32, spark: 45 },
            fire: { spdMin: 1.5, spdMax: 10, spread: 0.85, liftMin: 6, liftMax: 14, lifeMin: 30, lifeMax: 72, rMin: 6, rMax: 22 },
            spark: { spdMin: 8, spdMax: 25, lifeMin: 14, lifeMax: 32, rMin: 1.2, rMax: 3.0 },
            smoke: { spd: 2.0, liftMin: 1.2, liftMax: 3.2, lifeMin: 60, lifeMax: 115, rMin: 12, rMax: 32 },
            dust: { spd: 16, lifeMin: 28, lifeMax: 68, rMin: 4, rMax: 11 }
        },

        // 공중 요격 (대공 미사일 요격) - 공중에서 터짐, 먼지 없음, 불꽃 많음
        airburst: {
            life: 0.70,
            decay: 0.055,
            shake: 6,
            flash: 0.18,
            wave: { maxR: 180, speed: 32, width: 10, color: 'rgba(255,240,200,0.7)', life: 1.0 },
            count: { fire: 28, dust: 0, smoke: 18, spark: 55 },
            fire: { spdMin: 2, spdMax: 12, spread: 1.0, liftMin: 3, liftMax: 8, lifeMin: 16, lifeMax: 38, rMin: 4, rMax: 14 },
            spark: { spdMin: 12, spdMax: 35, lifeMin: 10, lifeMax: 24, rMin: 1.0, rMax: 2.8 },
            smoke: { spd: 2.2, liftMin: 0.5, liftMax: 2.0, lifeMin: 35, lifeMax: 70, rMin: 8, rMax: 22 },
            dust: { spd: 0, lifeMin: 0, lifeMax: 0, rMin: 0, rMax: 0 }
        },

        // 항공기 폭발 (폭격기/전투기 격추) - 화염 낙하, 검은 연기
        aircraft: {
            life: 1.30,
            decay: 0.028,
            shake: 10,
            flash: 0.25,
            wave: { maxR: 220, speed: 25, width: 14, color: 'rgba(255,180,100,0.7)', life: 1.0 },
            count: { fire: 55, dust: 0, smoke: 45, spark: 38 },
            fire: { spdMin: 1.5, spdMax: 8, spread: 0.95, liftMin: -2, liftMax: 6, lifeMin: 35, lifeMax: 85, rMin: 6, rMax: 20 },
            spark: { spdMin: 6, spdMax: 22, lifeMin: 15, lifeMax: 35, rMin: 1.1, rMax: 2.6 },
            smoke: { spd: 2.5, liftMin: -0.5, liftMax: 1.5, lifeMin: 70, lifeMax: 140, rMin: 14, rMax: 40 },
            dust: { spd: 0, lifeMin: 0, lifeMax: 0, rMin: 0, rMax: 0 }
        },

        // 대전차 미사일 명중 (공병 AT 미사일) - 관통 후 폭발, 집중형
        atm: {
            life: 0.65,
            decay: 0.065,
            shake: 8,
            flash: 0.15,
            wave: { maxR: 160, speed: 30, width: 10, color: 'rgba(255,220,150,0.75)', life: 1.0 },
            count: { fire: 22, dust: 18, smoke: 12, spark: 32 },
            fire: { spdMin: 1.5, spdMax: 9, spread: 0.8, liftMin: 4, liftMax: 10, lifeMin: 18, lifeMax: 40, rMin: 4, rMax: 12 },
            spark: { spdMin: 10, spdMax: 28, lifeMin: 10, lifeMax: 22, rMin: 1.0, rMax: 2.4 },
            smoke: { spd: 1.5, liftMin: 0.8, liftMax: 2.2, lifeMin: 30, lifeMax: 60, rMin: 7, rMax: 18 },
            dust: { spd: 10, lifeMin: 18, lifeMax: 40, rMin: 3, rMax: 7 }
        },
        // C-03: RPG/공병 미사일이 기갑에 맞을 때 체감 보강용 프리셋
        atm_heavy: {
            life: 0.82,
            decay: 0.055,
            shake: 11,
            flash: 0.22,
            wave: { maxR: 220, speed: 32, width: 12, color: 'rgba(255,220,160,0.78)', life: 1.0 },
            count: { fire: 34, dust: 24, smoke: 16, spark: 46 },
            fire: { spdMin: 1.6, spdMax: 9.8, spread: 0.86, liftMin: 5, liftMax: 12, lifeMin: 22, lifeMax: 46, rMin: 4.5, rMax: 13.5 },
            spark: { spdMin: 11, spdMax: 30, lifeMin: 10, lifeMax: 24, rMin: 1.1, rMax: 2.6 },
            smoke: { spd: 1.7, liftMin: 0.9, liftMax: 2.6, lifeMin: 34, lifeMax: 68, rMin: 8, rMax: 20 },
            dust: { spd: 11, lifeMin: 20, lifeMax: 45, rMin: 3.2, rMax: 7.8 }
        },

        // 포탄/기관포 명중 (탱크 vs 탱크, 탱크 vs 보병) - 작지만 강렬
        shell_hit: {
            life: 0.50,
            decay: 0.08,
            shake: 5,
            flash: 0.10,
            wave: { maxR: 100, speed: 28, width: 6, color: 'rgba(255,240,180,0.65)', life: 1.0 },
            count: { fire: 16, dust: 12, smoke: 8, spark: 22 },
            fire: { spdMin: 1.2, spdMax: 7, spread: 0.9, liftMin: 3, liftMax: 8, lifeMin: 12, lifeMax: 28, rMin: 3, rMax: 10 },
            spark: { spdMin: 8, spdMax: 22, lifeMin: 8, lifeMax: 18, rMin: 0.9, rMax: 2.2 },
            smoke: { spd: 1.2, liftMin: 0.6, liftMax: 1.8, lifeMin: 24, lifeMax: 48, rMin: 5, rMax: 14 },
            dust: { spd: 8, lifeMin: 14, lifeMax: 32, rMin: 2.5, rMax: 6 }
        },

        // 탱크 포탄 명중 (보병에도 충분히 크게 보이도록)
        tank_shell: {
            life: 0.88,
            decay: 0.05,
            shake: 12,
            flash: 0.32,
            wave: { maxR: 320, speed: 30, width: 14, color: 'rgba(255,225,170,0.78)', life: 1.0 },
            count: { fire: 68, dust: 42, smoke: 22, spark: 58 },
            fire: { spdMin: 1.9, spdMax: 10.8, spread: 0.9, liftMin: 5, liftMax: 14, lifeMin: 24, lifeMax: 56, rMin: 4, rMax: 22 },
            spark: { spdMin: 11, spdMax: 30, lifeMin: 10, lifeMax: 26, rMin: 1.0, rMax: 3.2 },
            smoke: { spd: 1.6, liftMin: 0.9, liftMax: 2.6, lifeMin: 28, lifeMax: 64, rMin: 8, rMax: 22 },
            dust: { spd: 12, lifeMin: 18, lifeMax: 40, rMin: 2.8, rMax: 8.4 }
        }
    };

    // ==========================
    // Public API
    // ==========================
    const VFX = {
        // kind: 'nuke' | 'tactical' | 'emp' | 'bomb' | 'artillery' | 'drone' | 'stealth' | 'at'
        spawnExplosion(game, kind, x, y, opts) {
            if (!game || !game.particles) return;

            const presetBase = PRESETS[kind] || PRESETS.drone;
            const allowScreenShake = (kind === 'nuke' || kind === 'tactical');
            // Keep flash/wave only for nuke and tactical kinds.
            const keepFlashWave = (kind === 'nuke' || kind === 'tactical' || kind === 'emp');
            let preset = keepFlashWave
                ? presetBase
                : Object.assign({}, presetBase, { flash: 0, wave: null });
            if (!allowScreenShake && preset.shake) {
                preset = Object.assign({}, preset, { shake: 0 });
            }
            const noShake = !!(opts && opts.noShake);
            if (noShake && preset.shake) {
                preset = Object.assign({}, preset, { shake: 0 });
            }
            // Prefer caller-provided impact y first, then clamp to the ground walk band.
            const rawGroundY = (opts && opts.groundY != null) ? opts.groundY : y;
            const groundY = resolveGroundImpactY(game, rawGroundY);

            // y 고정 규칙:
            // - nuke/emp/bomb/artillery/stealth/vehicle: 지면 고정
            // - drone/at/airburst/aircraft: 월드 좌표 사용(공중/지상 모두 가능)
            const anchorGround = (opts && typeof opts.anchorGround === 'boolean')
                ? opts.anchorGround
                : (kind === 'nuke' || kind === 'emp' || kind === 'bomb' || kind === 'artillery' || kind === 'stealth' || kind === 'vehicle' || kind === 'tactical' || kind === 'tank_shell');

            const gy = anchorGround ? groundY : y;

            // scale: 화면/줌 기준 자동 조절
            let base =
                (kind === 'nuke') ? 1.25 :
                    (kind === 'emp') ? 1.06 :
                    (kind === 'tactical') ? 0.98 :
                        (kind === 'vehicle') ? 0.90 :
                            (kind === 'tank_shell') ? 1.08 :
                            (kind === 'aircraft') ? 0.80 :
                                (kind === 'airburst') ? 0.55 :
                                    (kind === 'atm_heavy') ? 0.62 :
                                    (kind === 'atm') ? 0.50 :
                                        (kind === 'shell_hit') ? 0.42 :
                                            (kind === 'hit') ? 0.45 :
                                                (kind === 'hit_air') ? 0.40 :
                                                    (kind === 'stealth') ? 1.0 : 0.85;
            const zoom = (window.Camera && typeof Camera.zoom === 'number') ? Camera.zoom : 1;
            const scale = clamp(base / Math.max(0.75, zoom), 0.6, 1.35);

            // 화면 밖 폭발은 생성 스킵 (큰 이벤트는 플래시/흔들림만 유지)
            if (Number.isFinite(x) && game && Number.isFinite(game.cameraX)) {
                const viewW = (window.Camera && typeof Camera.viewW === 'function')
                    ? Camera.viewW(game)
                    : game.width;
                if (Number.isFinite(viewW)) {
                    const pad = 220;
                    const minX = (game.cameraX || 0) - pad;
                    const maxX = (game.cameraX || 0) + viewW + pad;
                    if (x < minX || x > maxX) {
                        if (keepFlashWave) {
                            if (allowScreenShake && presetBase.shake && !noShake) safeAddShake(game, presetBase.shake);
                            if (presetBase.flash) safeAddFlash(game, presetBase.flash);
                        }
                        return;
                    }
                }
            }

            // Keep particle count under control.
            pruneParticles(game, 420);
            if (kind === 'nuke') {
                game.particles.push(new NukeMushroomFX(game, x, gy, scale));
            } else {
                game.particles.push(new ExplosionFX(game, x, gy, scale, preset));
            }
        },

        // Convenience alias.
        spawn(game, kind, x, y, opts) {
            this.spawnExplosion(game, kind, x, y, opts);
        },

        prune(game, limit) { pruneParticles(game, limit || 420); },
        PRESETS
    };

    // Expose globally.
    window.VFX = VFX;
})();



