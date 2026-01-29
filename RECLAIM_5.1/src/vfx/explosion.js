// src/vfx/explosion.js
// RECLAIM VFX: nuke / bomb / artillery / drone explosions
// - game.particles 파이프라인(월드 좌표)과 호환: update(), draw(ctx), life
// - 화면 플래시/흔들림은 game.addFlash / game.addShake 로 연결

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

    // game.particles 과다 누적 방지 (최우선으로 단순 Particle 제거)
    function pruneParticles(game, limit) {
        if (!game || !Array.isArray(game.particles)) return;
        const arr = game.particles;
        if (arr.length <= limit) return;

        // 1) 가장 오래된 것부터 "단순 Particle" 위주 제거
        //    (classes.js Particle: 보통 kind 없음)
        for (let i = 0; i < arr.length && arr.length > limit; i++) {
            const p = arr[i];
            const isSimple = p && p.constructor && p.constructor.name === 'Particle';
            if (isSimple) {
                arr.splice(i, 1);
                i--;
            }
        }

        // 2) 그래도 많으면 앞에서부터 제거
        while (arr.length > limit) arr.shift();
    }

    // ==========================
    // Internal Particle Model (ExplosionFX 내부용)
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

            // 흔들림/플래시
            if (p.shake) safeAddShake(this.game, p.shake);
            if (p.flash) safeAddFlash(this.game, p.flash);

            // 충격파
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

            // 파티클 수(화면 크기에 따라 자동 완화)
            const w = (this.game && this.game.width) ? this.game.width : window.innerWidth;
            const isSmallScreen = w < 520;
            const q = isSmallScreen ? 0.72 : 1.0;

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

            // Dust (지면에 붙는 먼지/파편)
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

                    // 색: 밝음 -> 어두움(연기)
                    const k = 1 - (p.life / p.maxLife);
                    if (p.kind === 'fire') {
                        p.hue = 42 - k * 40;           // 40 -> 2
                        p.light = 80 - k * 55;         // 80 -> 25
                        p.alpha = clamp(1 - k * 0.85, 0, 1);
                    } else {
                        // spark: 빠르게 사라짐
                        p.light = 85 - k * 80;
                        p.alpha = clamp(1 - k * 0.95, 0, 1);
                    }
                } else if (p.kind === 'smoke') {
                    // smoke: 느린 상승, 점점 커지고 옅어짐
                    p.vy -= 0.03 * s;
                    p.r *= 1.012;
                    const k = 1 - (p.life / p.maxLife);
                    p.light = 22 + k * 12;
                    p.alpha = clamp(0.75 - k * 0.70, 0, 1);
                } else if (p.kind === 'dust') {
                    // dust: 중력 + 바닥 충돌(지면 고정 느낌)
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

            // shockwaves 먼저
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
    // Presets (크기/강도 자동 조절은 spawn에서 scale로)
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
            // 스텔스드론은 지정 지점 자폭이므로 bomb보다 살짝 큼
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
            // AT 드론(대전차 자폭) - 폭은 중간, 스파크 많음
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

        // [ADD] 소형 데미지 폭발(지상/피격)
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

        // [ADD] 공중 피격/드론 파괴용(먼지 없음)
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

        // [ADD] 전술미사일 폭발(핵보다 작고 폭탄보다 큼)
        tactical: {
            life: 1.25,
            decay: 0.035,
            shake: 12,
            flash: 0.30,
            wave: { maxR: 520, speed: 34, width: 24, color: 'rgba(255,230,180,0.8)', life: 1.0 },
            count: { fire: 90, dust: 55, smoke: 40, spark: 60 },
            fire: { spdMin: 1.5, spdMax: 10.5, spread: 0.88, liftMin: 6, liftMax: 14, lifeMin: 30, lifeMax: 80, rMin: 6, rMax: 20 },
            spark: { spdMin: 8, spdMax: 26, lifeMin: 12, lifeMax: 28, rMin: 1.2, rMax: 2.8 },
            smoke: { spd: 2.1, liftMin: 1.0, liftMax: 3.2, lifeMin: 55, lifeMax: 120, rMin: 12, rMax: 36 },
            dust: { spd: 15, lifeMin: 26, lifeMax: 72, rMin: 4, rMax: 10 }
        },

        // [ADD] 연기 트레일용 (전술미사일 비행)
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
        }
    };

    // ==========================
    // Public API
    // ==========================
    const VFX = {
        // kind: 'nuke' | 'bomb' | 'artillery' | 'drone' | 'stealth' | 'at'
        spawnExplosion(game, kind, x, y, opts) {
            if (!game || !game.particles) return;

            const presetBase = PRESETS[kind] || PRESETS.drone;
            // ✅ 핵만 flash + wave 유지 / ❌ 나머지는 flash + wave 제거
            const preset = (kind === 'nuke')
                ? presetBase
                : Object.assign({}, presetBase, { flash: 0, wave: null });
            const groundY = (opts && opts.groundY != null) ? opts.groundY : (game.groundY != null ? game.groundY : y);

            // y 고정 규칙:
            // - nuke/bomb/artillery/stealth: 지면 고정
            // - drone/at: 월드 좌표 유지(공중/지상 모두 가능)
            const anchorGround = (opts && typeof opts.anchorGround === 'boolean')
                ? opts.anchorGround
                : (kind === 'nuke' || kind === 'bomb' || kind === 'artillery' || kind === 'stealth');

            const gy = anchorGround ? groundY : y;

            // scale: 화면/맵/줌 기준 자동 조절
            let base =
                (kind === 'nuke') ? 1.25 :
                    (kind === 'tactical') ? 0.98 :
                        (kind === 'hit') ? 0.45 :
                            (kind === 'hit_air') ? 0.40 :
                                (kind === 'stealth') ? 1.0 : 0.85;
            const zoom = (window.Camera && typeof Camera.zoom === 'number') ? Camera.zoom : 1;
            const scale = clamp(base / Math.max(0.75, zoom), 0.6, 1.35);

            // 너무 쌓이면 정리 후 추가
            pruneParticles(game, 420);
            game.particles.push(new ExplosionFX(game, x, gy, scale, preset));
        },

        // 편의 함수
        spawn(game, kind, x, y, opts) {
            this.spawnExplosion(game, kind, x, y, opts);
        },

        prune(game, limit) { pruneParticles(game, limit || 420); },
        PRESETS
    };

    // 전역 공개
    window.VFX = VFX;
})();
