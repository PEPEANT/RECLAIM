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
                : 14;
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

            if ((dx * dx + dy * dy) < hitR * hitR || this.ballisticTime >= this.ballisticTotal || this.y > game.groundY + 5) {
                this.hit();
            }
            return;
        }

        if (this.type === 'artillery' || this.type === 'bomb') {
            this.x += this.vx; this.y += this.vy; this.vy += this.grav;
            if (this.y > game.groundY) this.hit();
        } else if (this.type === 'nuke') {
            this.y += this.vy;
            if (this.y > game.groundY) this.hit();
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
        if (this.rocketSound) {
            try { this.rocketSound.pause(); this.rocketSound.currentTime = 0; } catch (e) { }
            this.rocketSound = null;
        }
        let artilleryKilled = false;
        const targetIsEnemyInfantry = !!(this.target && this.target.team !== this.team && this.target.stats && this.target.stats.category === 'infantry');
        const skipDefaultHitVfx = this.impactVfxOnly === true;

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
                VFX.spawn(game, 'tactical', this.x, game.groundY);
            } else if (game.createParticles) {
                game.createParticles(this.x, this.y, 36, '#fb7185');
            }
            if (typeof AudioSystem !== 'undefined') AudioSystem.playBoom('tactical', this.x);

            const R = 280;
            const DMG = 760;
            const applyDamage = (t) => {
                if (!t || t.dead) return;
                const d = Math.abs(t.x - this.x);
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
                VFX.spawn(game, 'nuke', this.x, (game && game.groundY) ? game.groundY : this.y);
            } else if (game.createParticles) {
                game.createParticles(this.x, this.y, 120, '#ef4444');
            }
            if (typeof AudioSystem !== 'undefined') AudioSystem.playBoom('nuke', this.x);

            if (typeof Maps !== 'undefined' && Maps.currentMap === 'city' && typeof game !== 'undefined' && !game.cityNukePanicPlayed) {
                game.cityNukePanicPlayed = true;
                if (typeof AudioSystem !== 'undefined' && AudioSystem.playPanicScream) {
                    AudioSystem.playPanicScream(this.x);
                }
            }

            const applyNukeDamage = (t) => {
                if (!t || t.dead) return;
                if (Math.abs(t.x - this.x) < 520 && !(t.stats && t.stats.invulnerable)) {
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
            if (typeof VFX !== 'undefined' && VFX.PRESETS && VFX.PRESETS.emp) {
                VFX.spawn(game, 'emp', this.x, game.groundY, { anchorGround: true });
            } else if (game.createParticles) {
                game.createParticles(this.x, this.y, 48, '#60a5fa');
            }
            if (typeof AudioSystem !== 'undefined') AudioSystem.playSFX('emp', this.x);

            const r = 320;
            const r2 = r * r;
            const unitList = (this.team === 'player') ? game.enemies : game.players;
            const bldgList = (this.team === 'player') ? game.enemyBuildings : game.playerBuildings;

            for (let i = 0; i < unitList.length; i++) {
                const u = unitList[i];
                if (!u || u.dead || !u.stats) continue;
                if (u.stats.invulnerable) continue;
                if (u.stats.type === 'bio' || u.stats.type === 'civilian') continue;
                const dx = u.x - this.x;
                const dy = (u.y || game.groundY) - game.groundY;
                if (dx * dx + dy * dy > r2) continue;
                u.stunTimer = Math.max(u.stunTimer || 0, 360);
                u.attackTarget = null;
                if (typeof u.lastAttack === 'number') u.lastAttack = (game.frame || 0) + 120;
            }

            for (let i = 0; i < bldgList.length; i++) {
                const b = bldgList[i];
                if (!b || b.dead) continue;
                const dx = b.x - this.x;
                const dy = (b.y || game.groundY) - game.groundY;
                if (dx * dx + dy * dy > r2) continue;
                b.stunTimer = Math.max(b.stunTimer || 0, 420);
            }
            return;
        }

        if (this.type === 'tactical_missile') {
            // ???꾩닠湲???컻 (?묒? 踰덉찉???곌퀬由??놁쓬: VFX 洹쒖튃 ?곕쫫)
            if (typeof VFX !== 'undefined') {
                VFX.spawn(game, 'tactical', this.x, game.groundY);
            }

            // ????컻 ?ъ슫??(boom-3)
            if (typeof AudioSystem !== 'undefined') AudioSystem.playBoom('tactical', this.x);

            // ??踰붿쐞 ?쇳빐 (?꾩닠湲? - [FIX] 諛쒖궗 ? 湲곗??쇰줈 諛섎????寃?
            // [OPTIMIZATION] 배열 복사 제거 - 직접 순회로 GC 부하 감소
            const R = 260;
            const DMG = 700;
            const applyDamage = (t) => {
                if (!t || t.dead) return;
                const d = Math.abs(t.x - this.x);
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
                VFX.spawn(game, 'nuke', this.x, (game && game.groundY) ? game.groundY : this.y);
            } else {
                if (game.createParticles) game.createParticles(this.x, this.y, 100, '#ef4444');
            }
            // ???듯룺諛??ъ슫??(boom-1)
            if (typeof AudioSystem !== 'undefined') AudioSystem.playBoom('nuke', this.x);

            // [CITY] 첫 핵 낙하 시에만 군중 패닉 사운드
            if (typeof Maps !== 'undefined' && Maps.currentMap === 'city' && typeof game !== 'undefined' && !game.cityNukePanicPlayed) {
                game.cityNukePanicPlayed = true;
                if (typeof AudioSystem !== 'undefined' && AudioSystem.playPanicScream) {
                    AudioSystem.playPanicScream(this.x);
                }
            }

            // 광역 폭발 피해 범위 20% 증가 (400 -> 480)
            // [OPTIMIZATION] 배열 복사 제거 - 직접 순회로 GC 부하 감소
            const applyNukeDamage = (t) => {
                if (!t || t.dead) return;
                if (Math.abs(t.x - this.x) < 480 && !(t.stats && t.stats.invulnerable)) {
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
                VFX.spawn(game, this.type === 'bomb' ? 'bomb' : 'artillery', this.x, game.groundY);
                // ???먯＜????꺽湲???컻 ?ъ슫??(boom-3)
                if (this.type === 'bomb' && typeof AudioSystem !== 'undefined') AudioSystem.playBoom('bomber', this.x);
            }
            else if (!skipDefaultHitVfx && this.type === 'rocket') {
                // 공격헬기 미사일 명중: 자주포 계열 폭발 느낌
                if (isAirHit) {
                    VFX.spawn(game, 'airburst', this.x, this.y, { anchorGround: false });
                } else {
                    VFX.spawn(game, 'artillery', this.x, game.groundY, { anchorGround: true });
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
                if (Math.abs(this.target.x - this.x) <= (directRadius + halfW)
                    && Math.abs(this.target.y - this.y) <= (directRadius + halfH)) {
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
                if (Math.abs(this.target.x - this.x) < radius + hitW && Math.abs(this.target.y - this.y) < 100) {
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
                if (Math.abs(u.x - this.x) < radius + hitW && Math.abs(u.y - this.y) < 100) {
                    const d = Math.abs(u.x - this.x);
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

                if (Math.abs(u.x - this.x) < radius + hitW && Math.abs(u.y - this.y) < 100) {
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
