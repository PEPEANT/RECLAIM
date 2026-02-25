// [FILE] projectiles.js: ???, ??, ??? ? ?? ??/??? ????.
class EmpShockwaveFX {
    constructor(gameRef, x, y) {
        this.game = gameRef || null;
        this.x = Number(x) || 0;
        this.y = Number(y) || 0;
        this.age = 0;
        this.maxAge = 58;
        this.life = 1;
        this.ringR = 18;
        this.outerR = 42;

        if (this.game) {
            if (typeof this.game.addFlash === 'function') this.game.addFlash(0.42);
            else this.game.flash = Math.max(Number(this.game.flash) || 0, 0.42);
        }
    }

    update() {
        this.age += 1;
        const t = this.age / Math.max(1, this.maxAge);
        this.life = Math.max(0, 1 - t);
        this.ringR += 22;
        this.outerR += 26;
        if (this.life <= 0.01) this.life = 0;
    }

    draw(ctx) {
        if (!ctx || this.life <= 0) return;
        const alpha = Math.max(0, Math.min(1, this.life));
        const TAU = Math.PI * 2;

        ctx.save();
        ctx.globalCompositeOperation = 'lighter';

        // Cyan EMP pulse ring.
        const grad = ctx.createRadialGradient(
            this.x,
            this.y,
            Math.max(0, this.outerR * 0.72),
            this.x,
            this.y,
            this.outerR
        );
        grad.addColorStop(0.0, 'rgba(0,0,0,0)');
        grad.addColorStop(0.45, `rgba(0,255,255,${0.12 * alpha})`);
        grad.addColorStop(0.85, `rgba(0,255,255,${0.78 * alpha})`);
        grad.addColorStop(1.0, `rgba(0,255,255,${0.40 * alpha})`);
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.outerR, 0, TAU);
        ctx.fill();

        // Secondary ring stroke.
        ctx.strokeStyle = `rgba(140,255,255,${0.86 * alpha})`;
        ctx.lineWidth = Math.max(1.5, 12 * alpha);
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.ringR, 0, TAU);
        ctx.stroke();

        // Electric arcs.
        const arcCount = 10;
        ctx.strokeStyle = `rgba(0,255,255,${0.64 * alpha})`;
        ctx.lineWidth = Math.max(1, 2.2 * alpha);
        ctx.shadowBlur = 11 * alpha;
        ctx.shadowColor = '#00ffff';
        for (let i = 0; i < arcCount; i++) {
            const angle = (i / arcCount) * TAU + (this.age * 0.19) + (Math.random() * 0.55);
            const len = this.ringR * (0.78 + Math.random() * 0.36);
            const segments = 5;
            let px = this.x;
            let py = this.y;
            ctx.beginPath();
            ctx.moveTo(px, py);
            for (let j = 0; j < segments; j++) {
                px += (Math.cos(angle) * len / segments) + (Math.random() * 18 - 9);
                py += (Math.sin(angle) * len / segments) + (Math.random() * 18 - 9);
                ctx.lineTo(px, py);
            }
            ctx.stroke();
        }

        ctx.restore();
    }
}
class Projectile {
    constructor(x, y, target, damage, team, type, opts) {
        this.x = x; this.y = y; this.target = target;
        this.damage = damage; this.team = team; this.type = type; this.dead = false;
        this.ballistic = false;
        this.ballisticTime = 0;
        this.ballisticTotal = 0;
        this.ballisticHitRadius = 0;
        this.impactVfx = (opts && opts.impactVfx) ? opts.impactVfx : null;
        this.impactVfxAir = (opts && opts.impactVfxAir) ? opts.impactVfxAir : null;
        this.impactVfxOnly = !!(opts && opts.impactVfxOnly);
        this.source = (opts && opts.source) ? opts.source : null;
        const hitChanceMulRaw = Number(opts && opts.hitChanceMul);
        this.hitChanceMul = Number.isFinite(hitChanceMulRaw)
            ? Math.max(0.25, Math.min(2.0, hitChanceMulRaw))
            : 1;
        this.impactGroundY = Number.isFinite(Number(y)) ? Number(y) : 0;
        this._impactScatterApplied = false;

        if (opts && opts.targetX != null) {
            this.targetX = opts.targetX;
            this.targetY = (opts.targetY != null) ? opts.targetY : y;
        } else if (type === 'bomb') {
            this.targetX = x;
            this.targetY = game.groundY;
        } else {
            const isUnit = target && (target.stats !== undefined);
            const tY = target ? (isUnit ? target.y - 10 : target.y - target.height / 2) : y;
            this.targetX = target ? target.x : x + (team === 'player' ? 300 : -300);
            this.targetY = tY;
        }

        if (this._isGroundImpactType(type)) {
            this.targetY = this._getGroundImpactY(this.targetY);
            this.impactGroundY = this.targetY;
            const enableScatter = !(opts && opts.scatter === false);
            if (enableScatter) {
                this._applyImpactScatter(type, target, opts);
            }
        }

        const dx = this.targetX - x; const dy = this.targetY - y;
        let dist = Math.sqrt(dx * dx + dy * dy);
        if (!dist) dist = 0.001;

        if (type === 'artillery') {
            const dxAbs = Math.abs(dx);
            const arcHeight = (opts && opts.arcHeight != null)
                ? opts.arcHeight
                : Math.max(120, Math.min(260, Math.round(dxAbs * 0.25)));
            this._initBallistic({
                arcHeight,
                grav: (opts && opts.grav != null) ? opts.grav : 0.35,
                flightTime: (opts && opts.flightTime != null) ? opts.flightTime : null,
                hitRadius: (opts && opts.hitRadius != null) ? opts.hitRadius : 22
            });
        }
        else if (type === 'bomb') { this.speed = 0; this.vx = 2 * (team === 'player' ? 1 : -1); this.vy = 5; this.grav = 0.5; }
        else if (type === 'nuke') { this.x = this.targetX; this.y = -500; this.vx = 0; this.vy = 20; }
        else if (type === 'icbm_nuke_missile' || type === 'icbm_tactical_missile' || type === 'icbm_emp_missile') {
            this.trailTick = 0;
            const defaults = {
                icbm_nuke_missile: { arcMin: 420, arcMax: 680, arcMul: 0.42, grav: 0.16, hitRadius: 44 },
                icbm_tactical_missile: { arcMin: 260, arcMax: 420, arcMul: 0.34, grav: 0.23, hitRadius: 30 },
                icbm_emp_missile: { arcMin: 300, arcMax: 500, arcMul: 0.36, grav: 0.20, hitRadius: 42 }
            };
            const cfg = defaults[type] || defaults.icbm_tactical_missile;
            const dxAbs = Math.abs(dx);
            const arcHeight = (opts && opts.arcHeight != null)
                ? opts.arcHeight
                : Math.max(cfg.arcMin, Math.min(cfg.arcMax, Math.round(dxAbs * cfg.arcMul)));
            const ballisticCfg = {
                arcHeight,
                grav: (opts && opts.grav != null) ? opts.grav : cfg.grav,
                flightTime: (opts && opts.flightTime != null) ? opts.flightTime : null,
                hitRadius: (opts && opts.hitRadius != null) ? opts.hitRadius : cfg.hitRadius
            };

            // ICBM는 초기에 수직 상승 후 탄도 전환 (첫 프레임 대각선 출발 방지)
            this.icbmPendingBallistic = ballisticCfg;
            this.icbmLaunchRiseFrames = (opts && opts.icbmRiseFrames != null)
                ? Math.max(0, Math.floor(Number(opts.icbmRiseFrames) || 0))
                : 24;
            const riseSpeedRaw = (opts && opts.icbmRiseSpeed != null) ? Number(opts.icbmRiseSpeed) : 8;
            this.icbmLaunchRiseSpeed = -Math.max(3, Math.abs(riseSpeedRaw || 8));
            this.vx = 0;
            this.vy = this.icbmLaunchRiseSpeed;
            this.ballistic = false;
            if (this.icbmLaunchRiseFrames <= 0) {
                this._initBallistic(this.icbmPendingBallistic);
                this.icbmPendingBallistic = null;
            }
            if (typeof AudioSystem !== 'undefined') {
                this.rocketSound = AudioSystem.playTacticalMissileSound(this.x);
            }
        }
        else if (type === 'tactical_missile') {
            this.trailTick = 0;
            if (!opts || opts.ballistic !== false) {
                const dxAbs = Math.abs(dx);
                const arcHeight = (opts && opts.arcHeight != null)
                    ? opts.arcHeight
                    : Math.max(240, Math.min(380, Math.round(dxAbs * 0.35)));
                this._initBallistic({
                    arcHeight,
                    grav: (opts && opts.grav != null) ? opts.grav : 0.22,
                    flightTime: (opts && opts.flightTime != null) ? opts.flightTime : null,
                    hitRadius: (opts && opts.hitRadius != null) ? opts.hitRadius : 30
                });
            } else {
                this.speed = 22;
                this.vx = (dx / dist) * this.speed;
                this.vy = (dy / dist) * this.speed;
            }
            // ?꾩닠誘몄궗??諛쒖궗 ?ъ슫??(?곗?硫??먮룞 以묒?)
            if (typeof AudioSystem !== 'undefined') {
                this.rocketSound = AudioSystem.playTacticalMissileSound(this.x);
            }
        }
        else if (type === 'engineer_missile') {
            this.speed = 12;
            this.vx = (dx / dist) * this.speed;
            this.vy = (dy / dist) * this.speed;
            this.trailTick = 0;
            // 諛쒖궗 ?ъ슫??
            if (typeof AudioSystem !== 'undefined') {
                AudioSystem.playSFX('rocket_launcher', this.x);
            }
        }
        else if (type === 'fighter_missile') {
            this.speed = 14;
            this.vx = (dx / dist) * this.speed;
            this.vy = (dy / dist) * this.speed;
            this.trailTick = 0;
            if (typeof AudioSystem !== 'undefined') {
                AudioSystem.playSFX('rocket_launcher', this.x);
            }
        }
        else {
            this.speed =
                (type === 'machinegun') ? 22 :
                    (type === 'bullet') ? 18 :
                        (type === 'aa_shell') ? 25 : 15;
            this.vx = (dx / dist) * this.speed; this.vy = (dy / dist) * this.speed;
        }

        // [New] Bomb Whistle SFX
        if (type === 'bomb' && typeof AudioSystem !== 'undefined') {
            AudioSystem.playSFX('bomb_drop');
        }

    }

    _isGroundImpactType(type) {
        return (
            type === 'artillery'
            || type === 'bomb'
            || type === 'nuke'
            || type === 'tactical_missile'
            || type === 'icbm_nuke_missile'
            || type === 'icbm_tactical_missile'
            || type === 'icbm_emp_missile'
        );
    }

    _getGroundImpactY(rawY) {
        const inputY = Number(rawY);
        if (typeof game !== 'undefined' && game) {
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

    _applyImpactScatter(type, target, opts) {
        const cfgTable = {
            artillery: { x: 56, y: 24 },
            bomb: { x: 72, y: 32 },
            tactical_missile: { x: 46, y: 18 },
            icbm_tactical_missile: { x: 68, y: 26 },
            icbm_emp_missile: { x: 56, y: 22 },
            icbm_nuke_missile: { x: 84, y: 34 },
            nuke: { x: 90, y: 36 }
        };
        const cfg = cfgTable[type];
        if (!cfg) return;

        const isAirTarget = !!(target && target.stats && target.stats.type === 'air');
        if (isAirTarget) return;

        const customX = Number(opts && opts.scatterX);
        const customY = Number(opts && opts.scatterY);
        const scatterX = Number.isFinite(customX) ? Math.abs(customX) : cfg.x;
        const scatterY = Number.isFinite(customY) ? Math.abs(customY) : cfg.y;

        if (scatterX <= 0 && scatterY <= 0) return;

        const jitterX = (Math.random() * 2 - 1) * scatterX;
        const jitterY = (Math.random() * 2 - 1) * scatterY;

        this.targetX = (Number(this.targetX) || 0) + jitterX;
        const mapW = Number((typeof CONFIG !== 'undefined' && CONFIG) ? CONFIG.mapWidth : NaN);
        if (Number.isFinite(mapW) && mapW > 80) {
            this.targetX = Math.max(24, Math.min(mapW - 24, this.targetX));
        }
        this.targetY = this._getGroundImpactY((Number(this.targetY) || 0) + jitterY);
        this.impactGroundY = this.targetY;
        this._impactScatterApplied = true;
    }

    _initBallistic(opts) {
        const gRaw = (opts && opts.grav != null) ? opts.grav : 0.35;
        const g = Math.max(0.05, gRaw);
        const dx = this.targetX - this.x;
        const dy = this.targetY - this.y;

        this.ballisticHitRadius = (opts && opts.hitRadius != null) ? opts.hitRadius : 24;

        if (opts && opts.flightTime != null) {
            let T = Math.max(8, opts.flightTime);
            if (dy > 0) {
                const minT = Math.sqrt((2 * dy) / g) + 6;
                if (T < minT) T = minT;
            }
            this.vx = dx / T;
            this.vy = (dy - 0.5 * g * T * T) / T;
            this.grav = g;
            this.ballistic = true;
            this.ballisticTime = 0;
            this.ballisticTotal = Math.max(8, Math.round(T));
            this.speed = Math.sqrt(this.vx * this.vx + this.vy * this.vy);
            return;
        }

        let arcHeight = (opts && opts.arcHeight != null) ? opts.arcHeight : 160;
        arcHeight = Math.max(40, arcHeight);

        const minY = Math.min(this.y, this.targetY);
        let apexY = minY - arcHeight;
        if (apexY > minY - 20) apexY = minY - 20;

        const dy0 = this.y - apexY;
        const dy1 = this.targetY - apexY;
        const t0 = Math.sqrt(Math.max(0.001, (2 * dy0) / g));
        const t1 = Math.sqrt(Math.max(0.001, (2 * dy1) / g));
        const T = t0 + t1;

        this.vx = dx / T;
        this.vy = -g * t0;
        this.grav = g;
        this.ballistic = true;
        this.ballisticTime = 0;
        this.ballisticTotal = Math.max(8, Math.round(T));
        this.speed = Math.sqrt(this.vx * this.vx + this.vy * this.vy);
    }

    _stopRocketLoopSound() {
        if (!this.rocketSound) return;
        try {
            this.rocketSound.pause();
            this.rocketSound.currentTime = 0;
        } catch (e) { }
        this.rocketSound = null;
    }

    _isIcbmPayloadProjectile() {
        return (
            this.type === 'icbm_nuke_missile'
            || this.type === 'icbm_tactical_missile'
            || this.type === 'icbm_emp_missile'
        );
    }

    // ICBM payloads can be intercepted by enemy aa_tank.
    // Single aa_tank has modest interception odds; multiple aa_tanks increase reliability.
    _tryAATankInterceptIcbm() {
        if (!this._isIcbmPayloadProjectile()) return false;
        if (typeof game === 'undefined' || !game) return false;

        const frameNow = Number(game.frame) || 0;
        const nextCheck = Number(this._aaInterceptNextCheckFrame) || 0;
        if (frameNow < nextCheck) return false;
        this._aaInterceptNextCheckFrame = frameNow + 9;

        const defenders = (this.team === 'player') ? game.enemies : game.players;
        if (!Array.isArray(defenders) || defenders.length === 0) return false;

        const missileX = Number(this.x) || 0;
        const missileY = Number(this.y) || 0;
        const baseRange = 560;
        let nearCount = 0;
        let weightedCoverage = 0;

        for (let i = 0; i < defenders.length; i++) {
            const u = defenders[i];
            if (!u || u.dead || !u.stats) continue;
            if (String(u.stats.id || '') !== 'aa_tank') continue;
            if ((Number(u.stunTimer) || 0) > 0) continue;

            const ux = Number(u.x);
            if (!Number.isFinite(ux)) continue;
            const dx = Math.abs(ux - missileX);
            if (dx > baseRange) continue;

            const uyRaw = (typeof u.getRenderY === 'function') ? Number(u.getRenderY()) : Number(u.y);
            const uy = Number.isFinite(uyRaw) ? uyRaw : missileY;
            const dy = Math.abs(uy - missileY);
            const xFactor = Math.max(0, 1 - (dx / baseRange));
            const altitudeFactor = Math.max(0.45, Math.min(1, 1 - (Math.max(0, dy - 220) / 700)));
            const weight = xFactor * altitudeFactor;
            if (weight <= 0.01) continue;

            nearCount += 1;
            weightedCoverage += weight;
        }

        if (nearCount <= 0) return false;

        const coverage = Math.max(0, Math.min(1.6, weightedCoverage));
        let chance = 0.0038 + (coverage * 0.0042);
        if (nearCount >= 2) chance += 0.004 + ((nearCount - 2) * 0.0018);
        if (this.type === 'icbm_nuke_missile') chance *= 0.92;
        chance = Math.max(0.004, Math.min(0.032, chance));

        if (Math.random() >= chance) return false;

        this.dead = true;
        this._stopRocketLoopSound();

        if (typeof VFX !== 'undefined') {
            VFX.spawn(game, 'airburst', missileX, missileY, { anchorGround: false, noShake: true });
        } else if (typeof game.createParticles === 'function') {
            game.createParticles(missileX, missileY, 7, '#e5e7eb');
        }
        if (typeof AudioSystem !== 'undefined') {
            if (typeof AudioSystem.playGun === 'function') AudioSystem.playGun('flak', missileX);
            if (typeof AudioSystem.playBoom === 'function') AudioSystem.playBoom('death_exp2', missileX);
        }
        return true;
    }

    update() {
        if (this.dead) return;
        const isTacticalLike = (this.type === 'tactical_missile' || this.type === 'icbm_tactical_missile');
        const isIcbmPayload = (this.type === 'icbm_nuke_missile' || this.type === 'icbm_tactical_missile' || this.type === 'icbm_emp_missile');

        if ((this.type === 'tactical_missile' || isIcbmPayload) && this.rocketSound && typeof AudioSystem !== 'undefined') {
            try {
                const audibility = (typeof AudioSystem.getWorldAudibility === 'function')
                    ? AudioSystem.getWorldAudibility(this.x)
                    : 1;
                this.rocketSound.volume = Math.max(0, Math.min(1, AudioSystem.volume.sfx * AudioSystem.volume.master * 0.7 * audibility));
            } catch (e) { }
        }

        if (isIcbmPayload && this._tryAATankInterceptIcbm()) return;

        // ICBM 발사 직후는 수직 상승만 수행하고, 이후 탄도로 전환한다.
        if (isIcbmPayload && (this.icbmLaunchRiseFrames || 0) > 0) {
            this.vx = 0;
            this.vy = this.icbmLaunchRiseSpeed;
            this.y += this.icbmLaunchRiseSpeed;
            this.icbmLaunchRiseFrames = Math.max(0, (this.icbmLaunchRiseFrames || 0) - 1);

            this.trailTick++;
            if (this.trailTick % 2 === 0 && typeof VFX !== 'undefined') {
                VFX.spawn(game, 'trail', this.x, this.y + 8, { anchorGround: false });
            }

            if (this.icbmLaunchRiseFrames <= 0 && this.icbmPendingBallistic) {
                this._initBallistic(this.icbmPendingBallistic);
                this.icbmPendingBallistic = null;
            }
            return;
        }

        if (this.ballistic) {
            this.x += this.vx; this.y += this.vy; this.vy += this.grav;
            this.ballisticTime++;

            if (isTacticalLike || isIcbmPayload) {
                this.trailTick++;
                if (this.trailTick % 2 === 0 && typeof VFX !== 'undefined') {
                    VFX.spawn(game, 'trail', this.x - this.vx * 0.35, this.y - this.vy * 0.35, { anchorGround: false });
                }
            }

            const dx = this.targetX - this.x;
            const dy = this.targetY - this.y;
            const hitR = this.ballisticHitRadius || ((isTacticalLike || this.type === 'icbm_emp_missile') ? 30 : 22);
            const impactY = this._isGroundImpactType(this.type)
                ? this._getGroundImpactY(this.impactGroundY)
                : (Number.isFinite(Number(game && game.groundY)) ? Number(game.groundY) : Number(this.targetY));
            const groundCrossed = Number.isFinite(impactY) && this.y > (impactY + 4);
            if ((dx * dx + dy * dy) < hitR * hitR || this.ballisticTime >= this.ballisticTotal || groundCrossed) {
                if (groundCrossed && Number.isFinite(impactY)) this.y = impactY;
                this.hit();
            }
            return;
        }

        if (this.type === 'artillery' || this.type === 'bomb') {
            this.x += this.vx; this.y += this.vy; this.vy += this.grav;
            const impactY = this._getGroundImpactY(this.impactGroundY);
            if (this.y > impactY) {
                this.y = impactY;
                this.hit();
            }
        } else if (this.type === 'nuke') {
            this.y += this.vy;
            const impactY = this._getGroundImpactY(this.impactGroundY);
            if (this.y > impactY) {
                this.y = impactY;
                this.hit();
            }
        } else if (this.type === 'tactical_missile') {
            this.x += this.vx;
            this.y += this.vy;

            // ???곌린 ?몃젅??媛踰쇱슫 ?ㅻえ???쇳봽)
            this.trailTick++;
            if (this.trailTick % 2 === 0 && typeof VFX !== 'undefined') {
                VFX.spawn(game, 'trail', this.x - this.vx * 0.35, this.y - this.vy * 0.35, { anchorGround: false });
            }

            // 紐⑺몴 ?꾨떖 泥댄겕
            const dx = this.targetX - this.x;
            const dy = this.targetY - this.y;
            if ((dx * dx + dy * dy) < 30 * 30) this.hit();
        } else if (this.type === 'engineer_missile') {
            // 怨듬퀝 ?좊룄 誘몄궗??- ?寃?異붿쟻
            if (this.target && !this.target.dead && this.target.stats) {
                this.targetX = this.target.x;
                this.targetY = this.target.y - (this.target.height ? this.target.height / 2 : 10);

                const dx = this.targetX - this.x;
                const dy = this.targetY - this.y;
                let dist = Math.sqrt(dx * dx + dy * dy);
                if (!dist) dist = 0.001;

                this.vx = (dx / dist) * this.speed;
                this.vy = (dy / dist) * this.speed;
            }

            this.x += this.vx;
            this.y += this.vy;

            // ?곌린 ?몃젅??
            this.trailTick++;
            if (this.trailTick % 3 === 0 && typeof VFX !== 'undefined') {
                VFX.spawn(game, 'trail', this.x - this.vx * 0.3, this.y - this.vy * 0.3, { anchorGround: false });
            }

            // 紐⑺몴 ?꾨떖 泥댄겕
            const dx = this.targetX - this.x;
            const dy = this.targetY - this.y;
            if ((dx * dx + dy * dy) < 25 * 25) this.hit();
            if (this.x < 0 || this.x > CONFIG.mapWidth) this.dead = true;
        } else if (this.type === 'fighter_missile') {
            // [NEW] 전투기 미사일 - 유도 추적
            if (this.target && !this.target.dead && this.target.stats) {
                this.targetX = this.target.x;
                this.targetY = this.target.y - (this.target.height ? this.target.height / 2 : 10);
                const dx = this.targetX - this.x;
                const dy = this.targetY - this.y;
                let dist = Math.sqrt(dx * dx + dy * dy);
                if (!dist) dist = 0.001;
                this.vx = (dx / dist) * this.speed;
                this.vy = (dy / dist) * this.speed;
            }
            this.x += this.vx;
            this.y += this.vy;

            this.trailTick++;
            if (this.trailTick % 2 === 0 && typeof VFX !== 'undefined') {
                VFX.spawn(game, 'trail', this.x - this.vx * 0.3, this.y - this.vy * 0.3, { anchorGround: false });
            }

            const dx2 = this.targetX - this.x;
            const dy2 = this.targetY - this.y;
            if ((dx2 * dx2 + dy2 * dy2) < 25 * 25) this.hit();
            if (this.x < 0 || this.x > CONFIG.mapWidth) this.dead = true;
        } else {
            // Homing Logic
            // [FIX] Target Validity Check
            if (this.target && !this.target.dead && this.target.stats) {
                this.targetX = this.target.x;
                this.targetY = this.target.y - (this.target.height ? this.target.height / 2 : 10);

                const dx = this.targetX - this.x;
                const dy = this.targetY - this.y;
                let dist = Math.sqrt(dx * dx + dy * dy);
                if (!dist) dist = 0.001;

                this.vx = (dx / dist) * this.speed;
                this.vy = (dy / dist) * this.speed;
            }

            this.x += this.vx; this.y += this.vy;
            // [FIX] hit 조건을 radius + target hitW와 일치시켜 데미지 누락 방지
            const hitRadius = (this.type === 'machinegun' || this.type === 'bullet' || this.type === 'humvee_burst') ? 20 : 30;
            if (Math.abs(this.x - this.targetX) < hitRadius && Math.abs(this.y - this.targetY) < hitRadius) this.hit();
            if (this.x < 0 || this.x > CONFIG.mapWidth) this.dead = true;
        }
    }

    hit() {
        this.dead = true;
        this._stopRocketLoopSound();
        let artilleryKilled = false;
        const targetIsEnemyInfantry = !!(this.target && this.target.team !== this.team && this.target.stats && this.target.stats.category === 'infantry');
        const skipDefaultHitVfx = this.impactVfxOnly === true;
        const getImpactPoint = (t) => {
            if (!t) {
                return { x: Number(this.x) || 0, y: Number(this.y) || 0 };
            }
            const tx = Number(t.x);
            const x = Number.isFinite(tx) ? tx : (Number(this.x) || 0);
            const renderY = (typeof t.getRenderY === 'function')
                ? Number(t.getRenderY())
                : Number(t.y);
            const baseY = Number.isFinite(renderY) ? renderY : (Number(t.y) || Number(this.y) || 0);
            const h = Number(t.height) || 0;
            const y = baseY - (h * 0.5);
            return { x, y: Number.isFinite(y) ? y : (Number(this.y) || 0) };
        };
        const getImpactDistance = (t) => {
            const p = getImpactPoint(t);
            return Math.hypot((p.x - (Number(this.x) || 0)), (p.y - (Number(this.y) || 0)));
        };
        const impactGroundY = this._getGroundImpactY(this.impactGroundY);
        if (this._isGroundImpactType(this.type) && Number.isFinite(impactGroundY)) {
            this.y = impactGroundY;
        }

        if (this.impactVfx) {
            const isAirHit = (this.target && this.target.stats && this.target.stats.type === 'air');
            const vfxName = (isAirHit && this.impactVfxAir) ? this.impactVfxAir : this.impactVfx;
            if (typeof VFX !== 'undefined') {
                VFX.spawn(game, vfxName, this.x, this.y, { anchorGround: !isAirHit });
            } else if (game.createParticles) {
                game.createParticles(this.x, this.y, 6, '#fbbf24');
            }
        }

        if (this.type === 'icbm_tactical_missile') {
            if (typeof VFX !== 'undefined') {
                VFX.spawn(game, 'tactical', this.x, impactGroundY);
            } else if (game.createParticles) {
                game.createParticles(this.x, this.y, 36, '#fb7185');
            }
            if (typeof AudioSystem !== 'undefined') AudioSystem.playBoom('tactical', this.x);

            const R = 280;
            const DMG = 760;
            const applyDamage = (t) => {
                if (!t || t.dead) return;
                const d = getImpactDistance(t);
                if (d < R && !(t.stats && t.stats.invulnerable)) {
                    t.takeDamage(DMG, 'tactical_missile', this.x, this.y, this.vx, this.vy, this.source);
                }
            };

            if (this.team === 'player') {
                game.enemies.forEach(applyDamage);
                game.enemyBuildings.forEach(applyDamage);
            } else {
                game.players.forEach(applyDamage);
                game.playerBuildings.forEach(applyDamage);
            }
            if (game.civilians) game.civilians.forEach(applyDamage);
            return;
        }

        if (this.type === 'icbm_nuke_missile') {
            if (game.addFlash) {
                game.addFlash(1.0);
                const originalDecay = game.flashDecay;
                game.flashDecay = 0.96;
                setTimeout(() => {
                    game.flashDecay = originalDecay;
                }, 1500);
            }

            if (typeof VFX !== 'undefined') {
                VFX.spawn(game, 'nuke', this.x, impactGroundY);
            } else if (game.createParticles) {
                game.createParticles(this.x, this.y, 120, '#ef4444');
            }
            if (typeof AudioSystem !== 'undefined') AudioSystem.playBoom('nuke', this.x);

            if (typeof game !== 'undefined' && !game.nukePanicPlayed) {
                game.nukePanicPlayed = true;
                if (typeof AudioSystem !== 'undefined' && AudioSystem.playPanicScream) {
                    AudioSystem.playPanicScream(this.x);
                }
            }

            const applyNukeDamage = (t) => {
                if (!t || t.dead) return;
                if (getImpactDistance(t) < 520 && !(t.stats && t.stats.invulnerable)) {
                    t.takeDamage(900, 'nuke', this.x, this.y, this.vx, this.vy, this.source);
                }
            };
            if (this.team === 'player') {
                game.enemies.forEach(applyNukeDamage);
                game.enemyBuildings.forEach(applyNukeDamage);
            } else {
                game.players.forEach(applyNukeDamage);
                game.playerBuildings.forEach(applyNukeDamage);
            }
            if (game.civilians) game.civilians.forEach(applyNukeDamage);
            return;
        }

        if (this.type === 'icbm_emp_missile') {
            const impactY = impactGroundY;

            if (typeof VFX !== 'undefined' && VFX.PRESETS && VFX.PRESETS.emp) {
                VFX.spawn(game, 'emp', this.x, impactY, { anchorGround: true });
            } else if (game.createParticles) {
                game.createParticles(this.x, this.y, 48, '#60a5fa');
            }
            if (game && Array.isArray(game.particles)) {
                game.particles.push(new EmpShockwaveFX(game, this.x, impactY));
            }
            if (typeof AudioSystem !== 'undefined') {
                if (typeof AudioSystem.playBoom === 'function') AudioSystem.playBoom('emp', this.x);
                else if (typeof AudioSystem.playSFX === 'function') AudioSystem.playSFX('emp', this.x);
            }
            if (game) {
                game.empTimer = Math.max(Number(game.empTimer) || 0, 110);
            }

            const viewW = (typeof Camera !== 'undefined' && Camera && typeof Camera.viewW === 'function')
                ? Math.max(1, Number(Camera.viewW(game)) || Number(game.width) || 1)
                : Math.max(1, Number(game.width) || 1);
            const viewH = Math.max(1, Number(game.height) || Number(game.groundY) || 720);
            const camX = Number(game.cameraX) || 0;
            const viewLeft = camX - 24;
            const viewRight = camX + viewW + 24;
            const viewTop = Math.min(-80, (Number(game.groundY) || viewH) - viewH - 120);
            const viewBottom = Math.max((Number(game.groundY) || viewH) + 140, viewH + 140);
            const isInViewport = (x, y) => (
                Number.isFinite(x)
                && Number.isFinite(y)
                && x >= viewLeft
                && x <= viewRight
                && y >= viewTop
                && y <= viewBottom
            );

            const ARMOR_ID_SET = new Set(['mbt', 'apc', 'aa_tank', 'humvee', 'spg', 'tank', 'ifv', 'sam', 'mlrs', 'icbm', 'icbm_enemy']);
            const getEmpDamage = (u) => {
                const st = u && u.stats ? u.stats : {};
                const maxHp = Math.max(1, Number(u && u.maxHp) || Number(st.hp) || 1);
                const unitType = String(st.type || u.type || '').toLowerCase();
                const unitCategory = String(st.category || '').toLowerCase();
                const unitId = String(st.id || '').toLowerCase();
                const isAir = unitType === 'air';
                const isArmored = unitCategory === 'armored' || unitType === 'mech' || unitType === 'vehicle' || ARMOR_ID_SET.has(unitId);
                const isInfantry = unitCategory === 'infantry' || unitType === 'bio' || unitType === 'infantry';

                if (isAir) return Math.round(Math.max(180, Math.min(900, maxHp * 0.55)));
                if (isArmored) return Math.round(Math.max(30, Math.min(180, maxHp * 0.14)));
                if (isInfantry) return Math.round(Math.max(18, Math.min(80, maxHp * 0.22)));
                return Math.round(Math.max(20, Math.min(120, maxHp * 0.16)));
            };

            const getEmpStunFrames = (u) => {
                const st = u && u.stats ? u.stats : {};
                const unitType = String(st.type || u.type || '').toLowerCase();
                const unitCategory = String(st.category || '').toLowerCase();
                const unitId = String(st.id || '').toLowerCase();
                const isAir = unitType === 'air';
                const isArmored = unitCategory === 'armored' || unitType === 'mech' || unitType === 'vehicle' || ARMOR_ID_SET.has(unitId);
                if (isAir) return 480;
                if (isArmored) return 600;
                return 180;
            };

            const unitList = (this.team === 'player') ? game.enemies : game.players;
            const bldgList = (this.team === 'player') ? game.enemyBuildings : game.playerBuildings;

            for (let i = 0; i < unitList.length; i++) {
                const u = unitList[i];
                if (!u || u.dead || !u.stats) continue;
                if (u.stats.invulnerable) continue;
                const uy = Number(u.y) - (Number(u.height || u.stats.height || 20) * 0.5);
                if (!isInViewport(Number(u.x), uy)) continue;

                const empDamage = getEmpDamage(u);
                if (empDamage > 0 && typeof u.takeDamage === 'function') {
                    u.takeDamage(empDamage, 'emp', this.x, this.y, this.vx, this.vy, this.source);
                }

                const stunFrames = getEmpStunFrames(u);
                if (stunFrames > 0) {
                    u.stunTimer = Math.max(Number(u.stunTimer) || 0, stunFrames);
                }
                u.attackTarget = null;
                if (typeof u.lastAttack === 'number') u.lastAttack = (game.frame || 0) + 120;
            }

            for (let i = 0; i < bldgList.length; i++) {
                const b = bldgList[i];
                if (!b || b.dead) continue;
                const bx = Number(b.x);
                const by = Number(b.y) - (Number(b.height || 60) * 0.5);
                if (!isInViewport(bx, by)) continue;
                b.stunTimer = Math.max(Number(b.stunTimer) || 0, 420);
            }
            return;
        }

        if (this.type === 'tactical_missile') {
            // ???꾩닠湲???컻 (?묒? 踰덉찉???곌퀬由??놁쓬: VFX 洹쒖튃 ?곕쫫)
            if (typeof VFX !== 'undefined') {
                VFX.spawn(game, 'tactical', this.x, impactGroundY);
            }

            // ????컻 ?ъ슫??(boom-3)
            if (typeof AudioSystem !== 'undefined') AudioSystem.playBoom('tactical', this.x);

            // ??踰붿쐞 ?쇳빐 (?꾩닠湲? - [FIX] 諛쒖궗 ? 湲곗??쇰줈 諛섎????寃?
            // [OPTIMIZATION] 배열 복사 제거 - 직접 순회로 GC 부하 감소
            const R = 260;
            const DMG = 700;
            const applyDamage = (t) => {
                if (!t || t.dead) return;
                const d = getImpactDistance(t);
                if (d < R && !(t.stats && t.stats.invulnerable)) t.takeDamage(DMG, 'tactical_missile', this.x, this.y, this.vx, this.vy, this.source);
            };

            if (this.team === 'player') {
                game.enemies.forEach(applyDamage);
                game.enemyBuildings.forEach(applyDamage);
            } else {
                game.players.forEach(applyDamage);
                game.playerBuildings.forEach(applyDamage);
            }
            if (game.civilians) game.civilians.forEach(applyDamage);

            return;
        }

        if (this.type === 'shell') {
            if (typeof AudioSystem !== 'undefined') {
                AudioSystem.playSFX('tank_shell', this.x);
            }
        }

        // [NEW] 怨듬퀝 ?좊룄 誘몄궗???쇨꺽 泥섎━
        if (this.type === 'engineer_missile') {
            // ??컻 VFX
            if (typeof VFX !== 'undefined') {
                const isAir = this.target && this.target.stats && this.target.stats.type === 'air';
                const targetStats = (this.target && this.target.stats) ? this.target.stats : null;
                const isArmoredTarget = !!(
                    targetStats
                    && (
                        targetStats.type === 'mech'
                        || targetStats.category === 'armored'
                        || targetStats.id === 'icbm'
                        || targetStats.id === 'icbm_enemy'
                    )
                );
                // [C-03] RPG/공병 미사일: 기갑 타격 시 더 큰 폭발 프리셋 사용
                const impactKind = isAir ? 'airburst' : (isArmoredTarget ? 'atm_heavy' : 'atm');
                VFX.spawn(game, impactKind, this.x, this.y, { anchorGround: !isAir });
            }

            // ??컻 ?ъ슫??
            if (typeof AudioSystem !== 'undefined') {
                AudioSystem.playSFX('engineer_explosion', this.x);
            }

            // Clear missile reservation lock on impact so other shooters can retarget immediately.
            if (this.target && this.target._engMissileLock) {
                const lock = this.target._engMissileLock;
                const lockTeam = (lock && lock.team != null) ? String(lock.team) : '';
                const shotTeam = String(this.team || '');
                if (!lockTeam || lockTeam === shotTeam) {
                    this.target._engMissileLock = null;
                }
            }

            // ?⑥씪 ?寃??쇳빐
            if (this.target && !this.target.dead) {
                if (!(this.target.stats && this.target.stats.invulnerable)) {
                    const isAir = this.target && this.target.stats && this.target.stats.type === 'air';
                    let dmg = isAir ? Math.round(this.damage * 1.6) : this.damage;
                    if (this.target && this.target.stats && this.target.stats.id === 'bomber') {
                        dmg = Math.round(dmg * 1.5);
                    }
                    this.target.takeDamage(dmg, this.type, this.x, this.y, this.vx, this.vy, this.source);
                }
            }
            return;
        }

        // [NEW] 전투기 미사일 충돌 처리
        if (this.type === 'fighter_missile') {
            if (typeof VFX !== 'undefined') {
                const isAir = this.target && this.target.stats && this.target.stats.type === 'air';
                VFX.spawn(game, isAir ? 'airburst' : 'tactical', this.x, this.y, { anchorGround: !isAir });
            }
            if (typeof AudioSystem !== 'undefined') AudioSystem.playBoom('tactical', this.x);

            // 직격 대미지 400
            if (this.target && !this.target.dead) {
                if (!(this.target.stats && this.target.stats.invulnerable)) {
                    this.target.takeDamage(this.damage, this.type, this.x, this.y, this.vx, this.vy, this.source);
                }
            }

            // 소범위 스플래시 (반경 100, 40% 대미지)
            const R = 100;
            const splashDmg = Math.round(this.damage * 0.4);
            const targets = (this.team === 'player')
                ? [...(game.enemies || []), ...(game.enemyBuildings || [])]
                : [...(game.players || []), ...(game.playerBuildings || [])];
            for (const t of targets) {
                if (!t || t.dead || t === this.target) continue;
                if (t.stats && t.stats.invulnerable) continue;
                const d = Math.hypot(t.x - this.x, t.y - this.y);
                if (d < R) t.takeDamage(splashDmg, this.type, this.x, this.y, this.vx, this.vy, this.source);
            }
            return;
        }

        if (this.type === 'nuke') {
            // ???듯룺諛?- ?곗깋 ?뚮옒??癒쇱? (媛뺥븯寃? ?ㅻ옒 ?좎?)
            if (game.addFlash) {
                game.addFlash(1.0);
                // ???ㅻ옒 ?좎??섎룄濡?decay瑜??쇱떆?곸쑝濡??먮━寃?
                const originalDecay = game.flashDecay;
                game.flashDecay = 0.96; // ?먮┛ 媛먯뇿
                setTimeout(() => {
                    game.flashDecay = originalDecay; // ?먮옒?濡?蹂듭썝
                }, 1500);
            }

            // [VFX] ?듯룺諛?
            if (typeof VFX !== 'undefined') {
                VFX.spawn(game, 'nuke', this.x, impactGroundY);
            } else {
                if (game.createParticles) game.createParticles(this.x, this.y, 100, '#ef4444');
            }
            // ???듯룺諛??ъ슫??(boom-1)
            if (typeof AudioSystem !== 'undefined') AudioSystem.playBoom('nuke', this.x);

            // 첫 핵 낙하 시에만 군중 패닉 사운드
            if (typeof game !== 'undefined' && !game.nukePanicPlayed) {
                game.nukePanicPlayed = true;
                if (typeof AudioSystem !== 'undefined' && AudioSystem.playPanicScream) {
                    AudioSystem.playPanicScream(this.x);
                }
            }

            // 광역 폭발 피해 범위 20% 증가 (400 -> 480)
            // [OPTIMIZATION] 배열 복사 제거 - 직접 순회로 GC 부하 감소
            const applyNukeDamage = (t) => {
                if (!t || t.dead) return;
                if (getImpactDistance(t) < 480 && !(t.stats && t.stats.invulnerable)) {
                    t.takeDamage(800, 'nuke', this.x, this.y, this.vx, this.vy, this.source);
                }
            };
            // [FIX] 핵미사일: 발사 팀에 따라 대상 팀만 피해
            if (this.team === 'player') {
                game.enemies.forEach(applyNukeDamage);
                game.enemyBuildings.forEach(applyNukeDamage);
            } else {
                game.players.forEach(applyNukeDamage);
                game.playerBuildings.forEach(applyNukeDamage);
            }
            if (game.civilians) game.civilians.forEach(applyNukeDamage);
            return;
        }

        // [VFX] ??꺽/?먯＜???곕?吏 ?뚰삎 ??컻 遺꾧린
        if (typeof VFX !== 'undefined') {
            // 怨듭쨷 ?좊떅??留욎텣 寃쎌슦: hit_air
            const isAirHit = (this.target && this.target.stats && this.target.stats.type === 'air');

            if (this.type === 'artillery' || this.type === 'bomb') {
                VFX.spawn(game, this.type === 'bomb' ? 'bomb' : 'artillery', this.x, impactGroundY);
                // ???먯＜????꺽湲???컻 ?ъ슫??(boom-3)
                if (this.type === 'bomb' && typeof AudioSystem !== 'undefined') AudioSystem.playBoom('bomber', this.x);
            }
            else if (!skipDefaultHitVfx && this.type === 'rocket') {
                // 공격헬기 미사일 명중: 자주포 계열 폭발 느낌
                if (isAirHit) {
                    VFX.spawn(game, 'airburst', this.x, this.y, { anchorGround: false });
                } else {
                    VFX.spawn(game, 'artillery', this.x, impactGroundY, { anchorGround: true });
                }
                if (typeof AudioSystem !== 'undefined') AudioSystem.playSFX('tank_shell', this.x); // boom-5
            }
            else if (!skipDefaultHitVfx && (this.type === 'aa_shell' || this.type === 'shell')) {
                // RPG / ?怨듯룷 / ?꾩감???쇨꺽 ??컻
                // [P1] 대공포 공중 타격 시 airburst, 그 외 shell_hit
                if (this.type === 'aa_shell' && isAirHit) {
                    VFX.spawn(game, 'airburst', this.x, this.y, { anchorGround: false, noShake: true });
                } else {
                    const noShake = (this.type === 'aa_shell');
                    VFX.spawn(game, isAirHit ? 'hit_air' : 'shell_hit', this.x, this.y, { anchorGround: !isAirHit, noShake });
                }
            }
            else {
                // 洹??몃뒗 湲곗〈 ?좎?
                if (game.createParticles) game.createParticles(this.x, this.y, 5, this.type === 'rocket' ? '#ef4444' : '#fbbf24');
            }
        } else {
            if (game.createParticles) game.createParticles(this.x, this.y, 5, this.type === 'rocket' ? '#ef4444' : '#fbbf24');
        }
        if (this.type === 'aa_shell' && typeof AudioSystem !== 'undefined') {
            AudioSystem.playBoom('death_exp2', this.x);
        }
        // [NOTE] small hit SFX(boom-4) removed to avoid overlap with impact sounds

        const enemiesList = this.team === 'player'
            ? game.enemies
            : [...game.players, ...(game.civilians || [])];
        const enemyBldgs = this.team === 'player' ? game.enemyBuildings : game.playerBuildings;
        const bunkers = game.buildings.filter(b => b.type === 'bunker');

        const list = [...enemiesList, ...enemyBldgs, ...bunkers];
        const radius = this.type === 'artillery' || this.type === 'bomb' ? 120 : (this.type === 'rocket' ? 50 : 15);
        const directHitTypes = new Set(['shell', 'rocket', 'artillery', 'bomb']);
        let directTargetApplied = false;

        // [P0 FIX] Prevent "hit without damage":
        // shell/rocket can call hit() within a larger proximity window than the area-damage radius.
        // Apply direct damage to the intended target first, then skip duplicate splash on the same target.
        if (directHitTypes.has(this.type) && this.target && !this.target.dead && this.target.team !== this.team) {
            const targetInvulnerable = !!(this.target.stats && this.target.stats.invulnerable);
            if (!targetInvulnerable) {
                const isUnitTarget = (this.target.stats !== undefined);
                const halfW = isUnitTarget
                    ? (this.target.width ? this.target.width / 2 : 10)
                    : Math.max(12, Number(this.target.width) || 12);
                const halfH = isUnitTarget
                    ? (this.target.height ? this.target.height / 2 : 12)
                    : Math.max(20, Number(this.target.height) || 20);
                const directRadius = 32;
                const directDx = (Number(this.target.x) || 0) - (Number(this.x) || 0);
                const directDy = (Number(this.target.y) || 0) - (Number(this.y) || 0);
                const directRange = directRadius + Math.max(halfW, halfH);
                if ((directDx * directDx + directDy * directDy) <= (directRange * directRange)) {
                    this.target.takeDamage(this.damage, this.type, this.x, this.y, this.vx, this.vy, this.source);
                    directTargetApplied = true;
                }
            }
        }

        if (this.type === 'machinegun' || this.type === 'bullet' || this.type === 'humvee_burst') {
            // Single target Logic
            let closest = null;
            let minD = radius + 999;

            // Prefer intended target if valid (prevents "air shots" / missed hits)
            if (this.target && !this.target.dead && this.target.team !== this.team) {
                const isUnit = (this.target.stats !== undefined);
                const hitW = (!isUnit) ? this.target.width : (this.target.width ? this.target.width / 2 : 10);
                const pdx = (Number(this.target.x) || 0) - (Number(this.x) || 0);
                const pdy = (Number(this.target.y) || 0) - (Number(this.y) || 0);
                const pRange = radius + hitW;
                if ((pdx * pdx + pdy * pdy) <= (pRange * pRange)) {
                    closest = this.target;
                    minD = -1;
                }
            }

            list.forEach(u => {
                if (!u || u.dead || u.team === this.team) return;
                const isUnit = (u.stats !== undefined);
                // AA Shell? 怨듭쨷 ?좊떅留??寃?(吏??嫄대Ъ ?ㅽ뵆?섏떆 諛⑹?)
                if (this.type === 'aa_shell') {
                    if (!isUnit) return;
                    if (!u.stats || u.stats.type !== 'air') return;
                }
                const hitW = (!isUnit) ? u.width : (u.width ? u.width / 2 : 10);
                const cdx = (Number(u.x) || 0) - (Number(this.x) || 0);
                const cdy = (Number(u.y) || 0) - (Number(this.y) || 0);
                const cRange = radius + hitW;
                if ((cdx * cdx + cdy * cdy) <= (cRange * cRange)) {
                    const d = Math.hypot(cdx, cdy);
                    if (d < minD) { minD = d; closest = u; }
                }
            });

            if (closest) {
                // Evasion Logic
                let hitChance = 1.0;
                if (closest.evasion) {
                    // Machinegun vs Drone -> High Miss rate
                    hitChance = 0.3;
                }
                hitChance *= Number(this.hitChanceMul) || 1;
                hitChance = Math.max(0.03, Math.min(0.995, hitChance));
                if (Math.random() < hitChance) {
                    if (!(closest.stats && closest.stats.invulnerable)) {
                        closest.takeDamage(this.damage, this.type, this.x, this.y, this.vx, this.vy, this.source);
                    }
                } else {
                    if (game.createParticles) game.createParticles(closest.x, closest.y - 10, 2, '#fff');
                }
            }

        } else {
            // Area Damage (Rocket/Bomb/Shell)
            list.forEach(u => {
                if (!u || u.dead) return;
                if (u.team === this.team) return;
                if (directTargetApplied && u === this.target) return;

                const isUnit = (u.stats !== undefined);
                if (isUnit && u.stats.type === 'air' && !['rocket', 'aa_shell'].includes(this.type)) return;

                const hitW = (!isUnit) ? u.width : (u.width ? u.width / 2 : 10);

                const adx = (Number(u.x) || 0) - (Number(this.x) || 0);
                const ady = (Number(u.y) || 0) - (Number(this.y) || 0);
                const aRange = radius + hitW;
                if ((adx * adx + ady * ady) <= (aRange * aRange)) {
                    if (isUnit && u.stats && u.stats.invulnerable) return;
                    // Hit Chance (?꾩떎?? AA??100%???꾨떂)
                    let hitChance = 1.0;
                    if (this.type === 'aa_shell') {
                        hitChance = (isUnit && u.evasion) ? 0.65 : 0.85;
                    }

                    if (Math.random() < hitChance) {
                        if (this.type === 'artillery' && isUnit) {
                            const wasDead = u.dead;
                            u.skipDeathSound = true;
                            u.takeDamage(this.damage, this.type, this.x, this.y, this.vx, this.vy, this.source);
                            if (!u.dead) u.skipDeathSound = false;
                            if (!wasDead && u.dead) artilleryKilled = true;
                        } else {
                            // [NEW] 건물에 공격 유형 전달
                            u.takeDamage(this.damage, this.type, this.x, this.y, this.vx, this.vy, this.source);
                        }
                    }
                    else if (game.createParticles) game.createParticles(u.x, u.y - 10, 2, '#fff');
                }
            });
        }

        // [NEW] Tank shell splash: infantry 주변 추가 피해
        if (this.type === 'shell' && targetIsEnemyInfantry) {
            const splashR = 70;
            const splashDmg = Math.max(1, Math.round(this.damage * 0.5));
            const splashList = (this.team === 'player') ? game.enemies : game.players;
            if (Array.isArray(splashList)) {
                const r2 = splashR * splashR;
                splashList.forEach(u => {
                    if (!u || u.dead || u === this.target) return;
                    if (!u.stats || u.stats.category !== 'infantry') return;
                    if (u.stats && u.stats.invulnerable) return;
                    const dx = u.x - this.x;
                    const dy = (u.y - (u.height ? u.height / 2 : 0)) - this.y;
                    if ((dx * dx + dy * dy) <= r2) {
                        u.takeDamage(splashDmg, 'shell', this.x, this.y, this.vx, this.vy, this.source);
                    }
                });
            }
        }

        if (this.type === 'artillery' && typeof AudioSystem !== 'undefined') {
            if (artilleryKilled) AudioSystem.playBoom('death_exp3', this.x);
            else AudioSystem.playBoom('spg', this.x);
        }
    }

    draw(ctx) {
        if (this.dead) return;
        const designs = (typeof ProjectileDesigns !== 'undefined') ? ProjectileDesigns : null;
        ctx.fillStyle = '#fff';
        ctx.beginPath();
        if (this.type === 'machinegun') {
            const vx = Number(this.vx) || 0;
            const vy = Number(this.vy) || 0;
            const speed = Math.max(0.001, Math.hypot(vx, vy));
            const len = Math.max(8, Math.min(18, speed * 0.9));
            const ang = Math.atan2(vy, vx);

            ctx.save();
            ctx.translate(this.x, this.y);
            ctx.rotate(ang);
            ctx.globalAlpha = 0.95;
            ctx.fillStyle = '#fff7c2';
            ctx.fillRect(-len * 0.8, -1.2, len, 2.4);
            ctx.fillStyle = '#f59e0b';
            ctx.fillRect(-len * 0.45, -0.9, len * 0.55, 1.8);
            ctx.fillStyle = '#ffd166';
            ctx.fillRect(0, -1.4, 2.2, 2.8);
            ctx.restore();
        }
        else if (this.type === 'humvee_burst') {
            const vx = Number(this.vx) || 0;
            const vy = Number(this.vy) || 0;
            const speed = Math.max(0.001, Math.hypot(vx, vy));
            const len = Math.max(7, Math.min(14, speed * 0.75));
            const ang = Math.atan2(vy, vx);

            ctx.save();
            ctx.translate(this.x, this.y);
            ctx.rotate(ang);
            ctx.globalAlpha = 0.95;
            ctx.fillStyle = '#ffe8a3';
            ctx.fillRect(-len * 0.75, -1.0, len, 2.0);
            ctx.fillStyle = '#f59e0b';
            ctx.fillRect(-len * 0.42, -0.8, len * 0.52, 1.6);
            ctx.restore();
        }
        else if (this.type === 'bullet') { ctx.fillStyle = '#e5e7eb'; ctx.fillRect(this.x, this.y, 3, 3); }
        else if (this.type === 'shell') { ctx.fillStyle = '#fbbf24'; ctx.arc(this.x, this.y, 3, 0, Math.PI * 2); ctx.fill(); }
        else if (this.type === 'aa_shell') { ctx.fillStyle = '#f472b6'; ctx.arc(this.x, this.y, 3, 0, Math.PI * 2); ctx.fill(); }
        else if (this.type === 'rocket') { ctx.fillStyle = '#f87171'; ctx.fillRect(this.x - 4, this.y - 2, 8, 4); }
        else if (this.type === 'bomb') {
            // 誘몄궗?쇳삎(?섏쭅 ?숉븯 ?먮굦)
            ctx.save();
            ctx.translate(this.x, this.y);
            const ang = Math.atan2(this.vy || 1, this.vx || 0);
            ctx.rotate(ang);

            // Body
            ctx.fillStyle = "#0b0f14";
            ctx.fillRect(-3, -10, 6, 18);

            // Nose
            ctx.fillStyle = "#111827";
            ctx.beginPath();
            ctx.moveTo(-3, -10);
            ctx.lineTo(3, -10);
            ctx.lineTo(0, -16);
            ctx.closePath();
            ctx.fill();

            // Fins
            ctx.fillStyle = "#111";
            ctx.beginPath();
            ctx.moveTo(-3, 6); ctx.lineTo(-8, 10); ctx.lineTo(-3, 10);
            ctx.closePath();
            ctx.fill();
            ctx.beginPath();
            ctx.moveTo(3, 6); ctx.lineTo(8, 10); ctx.lineTo(3, 10);
            ctx.closePath();
            ctx.fill();

            // ?묒? ?곌린/遺덇퐙
            ctx.fillStyle = "rgba(255,180,60,0.9)";
            ctx.fillRect(-1, 10, 2, 5);

            ctx.restore();
        }
        else if (this.type === 'artillery') {
            ctx.save();
            ctx.translate(this.x, this.y);
            const ang = Math.atan2(this.vy || 1, this.vx || 0);
            ctx.rotate(ang);
            const artilleryVisualScale = 0.78; // C-04: make SPG shell visually smaller
            ctx.scale(artilleryVisualScale, artilleryVisualScale);

            if (designs && designs.drawArtilleryShell) {
                designs.drawArtilleryShell(ctx, 1);
            } else {
                // Fallback simple shell
                ctx.fillStyle = '#f97316';
                ctx.fillRect(-8, -3, 16, 6);
                ctx.beginPath();
                ctx.moveTo(8, 0);
                ctx.lineTo(4, -4);
                ctx.lineTo(4, 4);
                ctx.closePath();
                ctx.fill();
            }

            ctx.restore();
        }
        else if (this.type === 'nuke') {
            ctx.save();
            ctx.translate(this.x, this.y);
            const ang = Math.atan2(this.vy || 1, this.vx || 0.001);
            ctx.rotate(ang);
            if (designs && designs.drawNuke) {
                designs.drawNuke(ctx, 1);
            } else {
                ctx.fillStyle = '#ef4444';
                ctx.arc(0, 0, 10, 0, Math.PI * 2);
                ctx.fill();
            }
            ctx.restore();
        }
        else if (this.type === 'icbm_nuke_missile') {
            ctx.save();
            ctx.translate(this.x, this.y);
            ctx.rotate(Math.atan2(this.vy || 1, this.vx || 0.001));

            if (designs && designs.drawIcbmNukeMissile) {
                designs.drawIcbmNukeMissile(ctx, 1);
            } else if (designs && designs.drawNuke) {
                designs.drawNuke(ctx, 1);
            } else {
                ctx.fillStyle = '#e5e7eb';
                ctx.fillRect(-22, -5, 40, 10);
                ctx.fillStyle = '#111827';
                ctx.beginPath();
                ctx.moveTo(18, -5); ctx.lineTo(24, 0); ctx.lineTo(18, 5);
                ctx.closePath();
                ctx.fill();
            }
            ctx.restore();
        }
        else if (this.type === 'icbm_tactical_missile') {
            ctx.save();
            ctx.translate(this.x, this.y);
            ctx.rotate(Math.atan2(this.vy, this.vx));

            if (designs && designs.drawIcbmTacticalMissile) {
                designs.drawIcbmTacticalMissile(ctx, 1);
            } else if (designs && designs.drawTacticalMissile) {
                designs.drawTacticalMissile(ctx, 1);
            } else {
                ctx.fillStyle = '#e5e7eb';
                ctx.fillRect(-16, -3, 32, 6);
                ctx.fillStyle = '#ef4444';
                ctx.beginPath();
                ctx.moveTo(16, -3); ctx.lineTo(22, 0); ctx.lineTo(16, 3);
                ctx.closePath();
                ctx.fill();
            }
            ctx.restore();
        }
        else if (this.type === 'icbm_emp_missile') {
            ctx.save();
            ctx.translate(this.x, this.y);
            ctx.rotate(Math.atan2(this.vy, this.vx));

            if (designs && designs.drawIcbmEmpMissile) {
                designs.drawIcbmEmpMissile(ctx, 1);
            } else {
                ctx.fillStyle = '#dbeafe';
                ctx.fillRect(-16, -3, 30, 6);
                ctx.fillStyle = '#60a5fa';
                ctx.fillRect(-2, -3, 4, 6);
                ctx.strokeStyle = '#1d4ed8';
                ctx.lineWidth = 2;
                ctx.beginPath();
                ctx.moveTo(14, -4); ctx.lineTo(20, 0); ctx.lineTo(14, 4);
                ctx.stroke();
            }
            ctx.restore();
        }
        else if (this.type === 'tactical_missile') {
            ctx.save();
            ctx.translate(this.x, this.y);
            ctx.rotate(Math.atan2(this.vy, this.vx));

            if (designs && designs.drawTacticalMissile) {
                designs.drawTacticalMissile(ctx, 1);
            } else {
                // Fallback
                ctx.fillStyle = '#e5e7eb';
                ctx.fillRect(-14, -3, 28, 6);
                ctx.fillStyle = '#ef4444';
                ctx.fillRect(10, -3, 6, 6);
                ctx.fillStyle = '#f59e0b';
                ctx.beginPath();
                ctx.arc(-14, 0, 4, 0, Math.PI * 2);
                ctx.fill();
            }

            ctx.restore();
        }
        // [NEW] 怨듬퀝 ?좊룄 誘몄궗??
        else if (this.type === 'engineer_missile') {
            ctx.save();
            ctx.translate(this.x, this.y);
            ctx.rotate(Math.atan2(this.vy, this.vx));

            // ?꾨몢 (?뱀깋)
            ctx.fillStyle = '#166534';
            ctx.beginPath();
            ctx.moveTo(8, 0);
            ctx.lineTo(4, -3);
            ctx.lineTo(4, 3);
            ctx.fill();

            // 紐명넻 (?뚯깋)
            ctx.fillStyle = '#3f3f46';
            ctx.fillRect(-4, -2, 8, 4);

            // 瑗щ━ ?좉컻
            ctx.fillStyle = '#18181b';
            ctx.beginPath();
            ctx.moveTo(-4, -2); ctx.lineTo(-6, -4); ctx.lineTo(-2, -2);
            ctx.fill();
            ctx.beginPath();
            ctx.moveTo(-4, 2); ctx.lineTo(-6, 4); ctx.lineTo(-2, 2);
            ctx.fill();

            // 異붿쭊泥?遺덇퐙
            ctx.fillStyle = '#f97316';
            ctx.beginPath();
            ctx.arc(-6, 0, 1.5, 0, Math.PI * 2);
            ctx.fill();

            ctx.restore();
        }
        // [NEW] 전투기 미사일
        else if (this.type === 'fighter_missile') {
            ctx.save();
            ctx.translate(this.x, this.y);
            ctx.rotate(Math.atan2(this.vy, this.vx));

            // 탄두(빨강)
            ctx.fillStyle = '#dc2626';
            ctx.beginPath();
            ctx.moveTo(10, 0); ctx.lineTo(6, -3); ctx.lineTo(6, 3);
            ctx.closePath(); ctx.fill();

            // 몸통(은색)
            ctx.fillStyle = '#e5e7eb';
            ctx.fillRect(-6, -2.5, 12, 5);

            // 밴드(주황)
            ctx.fillStyle = '#f59e0b';
            ctx.fillRect(2, -2.5, 2, 5);

            // 꼬리 날개
            ctx.fillStyle = '#475569';
            ctx.beginPath();
            ctx.moveTo(-6, -2); ctx.lineTo(-9, -6); ctx.lineTo(-3, -2);
            ctx.closePath(); ctx.fill();
            ctx.beginPath();
            ctx.moveTo(-6, 2); ctx.lineTo(-9, 6); ctx.lineTo(-3, 2);
            ctx.closePath(); ctx.fill();

            // 추진 불꽃
            ctx.fillStyle = '#f97316';
            ctx.beginPath();
            ctx.arc(-8, 0, 2, 0, Math.PI * 2);
            ctx.fill();

            ctx.restore();
        }
    }
}
