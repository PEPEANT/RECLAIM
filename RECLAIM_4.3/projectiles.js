class Projectile {
    constructor(x, y, target, damage, team, type, opts) {
        this.x = x; this.y = y; this.target = target;
        this.damage = damage; this.team = team; this.type = type; this.dead = false;

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

        if (type === 'artillery') { this.speed = 8; this.vx = dx / 80; this.vy = -14; this.grav = 0.35; }
        else if (type === 'bomb') { this.speed = 0; this.vx = 2 * (team === 'player' ? 1 : -1); this.vy = 5; this.grav = 0.5; }
        else if (type === 'nuke') { this.x = this.targetX; this.y = -500; this.vx = 0; this.vy = 20; }
        else if (type === 'tactical_missile') {
            this.speed = 22;
            this.vx = (dx / dist) * this.speed;
            this.vy = (dy / dist) * this.speed;
            this.trailTick = 0;
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

    update() {
        if (this.dead) return;

        if (this.type === 'artillery' || this.type === 'bomb') {
            this.x += this.vx; this.y += this.vy; this.vy += this.grav;
            if (this.y > game.groundY) this.hit();
        } else if (this.type === 'nuke') {
            this.y += this.vy;
            if (this.y > game.groundY) this.hit();
        } else if (this.type === 'tactical_missile') {
            this.x += this.vx;
            this.y += this.vy;

            // ✅ 연기 트레일(가벼운 스모크 퍼프)
            this.trailTick++;
            if (this.trailTick % 2 === 0 && typeof VFX !== 'undefined') {
                VFX.spawn(game, 'trail', this.x - this.vx * 0.35, this.y - this.vy * 0.35, { anchorGround: false });
            }

            // 목표 도달 체크
            const dx = this.targetX - this.x;
            const dy = this.targetY - this.y;
            if ((dx * dx + dy * dy) < 30 * 30) this.hit();
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
            if (Math.abs(this.x - this.targetX) < 30 && Math.abs(this.y - this.targetY) < 30) this.hit();
            if (this.x < 0 || this.x > CONFIG.mapWidth) this.dead = true;
        }
    }

    hit() {
        this.dead = true;

        if (this.type === 'tactical_missile') {
            // ✅ 전술급 폭발 (작은 번쩍임/흰고리 없음: VFX 규칙 따름)
            if (typeof VFX !== 'undefined') {
                VFX.spawn(game, 'tactical', this.x, game.groundY);
            }

            // ✅ 폭발 사운드 (boom-3)
            if (typeof AudioSystem !== 'undefined') AudioSystem.playBoom('tactical');

            // ✅ 범위 피해 (전술급) - [FIX] 발사 팀 기준으로 반대편 타격
            const targets = (this.team === 'player')
                ? [...game.enemies, ...game.enemyBuildings]
                : [...game.players, ...game.playerBuildings];
            const R = 260;
            const DMG = 700;

            targets.forEach(t => {
                if (!t || t.dead) return;
                const d = Math.abs(t.x - this.x);
                if (d < R && !(t.stats && t.stats.invulnerable)) t.takeDamage(DMG);
            });

            return;
        }

        if (this.type === 'nuke') {
            // ✅ 핵폭발 - 흰색 플래시 먼저 (강하게, 오래 유지)
            if (game.addFlash) {
                game.addFlash(1.0);
                // 더 오래 유지되도록 decay를 일시적으로 느리게
                const originalDecay = game.flashDecay;
                game.flashDecay = 0.96; // 느린 감쇠
                setTimeout(() => {
                    game.flashDecay = originalDecay; // 원래대로 복원
                }, 1500);
            }

            // [VFX] 핵폭발
            if (typeof VFX !== 'undefined') {
                VFX.spawn(game, 'nuke', this.x, (game && game.groundY) ? game.groundY : this.y);
            } else {
                if (game.createParticles) game.createParticles(this.x, this.y, 100, '#ef4444');
            }
            // ✅ 핵폭발 사운드 (boom-1)
            if (typeof AudioSystem !== 'undefined') AudioSystem.playBoom('nuke');

            // ✅ 핵 폭발 범위 20% 증가 (400 -> 480)
            const allTargets = [...game.enemies, ...game.enemyBuildings];
            allTargets.forEach(t => { if (!t.dead && Math.abs(t.x - this.x) < 480 && !(t.stats && t.stats.invulnerable)) t.takeDamage(800); });
            return;
        }

        // [VFX] 폭격/자주포/데미지 소형 폭발 분기
        if (typeof VFX !== 'undefined') {
            // 공중 유닛을 맞춘 경우: hit_air
            const isAirHit = (this.target && this.target.stats && this.target.stats.type === 'air');

            if (this.type === 'artillery' || this.type === 'bomb') {
                VFX.spawn(game, this.type === 'bomb' ? 'bomb' : 'artillery', this.x, game.groundY);
                // ✅ 자주포/폭격기 폭발 사운드 (boom-3)
                if (typeof AudioSystem !== 'undefined') AudioSystem.playBoom(this.type === 'bomb' ? 'bomber' : 'spg');
            }
            else if (this.type === 'rocket' || this.type === 'aa_shell' || this.type === 'shell') {
                // RPG / 대공포 / 전차포 피격 폭발
                VFX.spawn(game, isAirHit ? 'hit_air' : 'hit', this.x, this.y, { anchorGround: !isAirHit });
            }
            else {
                // 그 외는 기존 유지
                if (game.createParticles) game.createParticles(this.x, this.y, 5, this.type === 'rocket' ? '#ef4444' : '#fbbf24');
            }
        } else {
            if (game.createParticles) game.createParticles(this.x, this.y, 5, this.type === 'rocket' ? '#ef4444' : '#fbbf24');
        }
        // [Optimization] Conditional SFX - small ground explosions use boom-4
        if (Math.random() < 0.3 && typeof AudioSystem !== 'undefined') AudioSystem.playBoom('small');

        const enemiesList = this.team === 'player' ? game.enemies : game.players;
        const enemyBldgs = this.team === 'player' ? game.enemyBuildings : game.playerBuildings;
        const bunkers = game.buildings.filter(b => b.type === 'bunker');

        const list = [...enemiesList, ...enemyBldgs, ...bunkers];
        const radius = this.type === 'artillery' || this.type === 'bomb' ? 120 : (this.type === 'rocket' ? 50 : 15);

        if (this.type === 'machinegun' || this.type === 'bullet') {
            // Single target Logic
            let closest = null;
            let minD = radius + 999;

            list.forEach(u => {
                if (!u || u.dead || u.team === this.team) return;
                const isUnit = (u.stats !== undefined);
                // AA Shell은 공중 유닛만 타격 (지상/건물 스플래시 방지)
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
                    if (!(closest.stats && closest.stats.invulnerable)) closest.takeDamage(this.damage);
                } else {
                    if (game.createParticles) game.createParticles(closest.x, closest.y - 10, 2, '#fff');
                }
            }

        } else {
            // Area Damage (Rocket/Bomb/Shell)
            list.forEach(u => {
                if (!u || u.dead) return;
                if (u.team === this.team) return;

                const isUnit = (u.stats !== undefined);
                if (isUnit && u.stats.type === 'air' && !['rocket', 'aa_shell'].includes(this.type)) return;

                const hitW = (!isUnit) ? u.width : (u.width ? u.width / 2 : 10);

                if (Math.abs(u.x - this.x) < radius + hitW && Math.abs(u.y - this.y) < 100) {
                    if (isUnit && u.stats && u.stats.invulnerable) return;
                    // Hit Chance (현실성: AA도 100%는 아님)
                    let hitChance = 1.0;
                    if (this.type === 'aa_shell') {
                        hitChance = (isUnit && u.evasion) ? 0.65 : 0.85;
                    }

                    if (Math.random() < hitChance) u.takeDamage(this.damage);
                    else if (game.createParticles) game.createParticles(u.x, u.y - 10, 2, '#fff');
                }
            });
        }
    }

    draw(ctx) {
        if (this.dead) return;
        ctx.fillStyle = '#fff';
        ctx.beginPath();
        if (this.type === 'machinegun') { ctx.fillStyle = '#fbbf24'; ctx.fillRect(this.x, this.y, 4, 4); }
        else if (this.type === 'bullet') { ctx.fillStyle = '#e5e7eb'; ctx.fillRect(this.x, this.y, 3, 3); }
        else if (this.type === 'shell') { ctx.fillStyle = '#fbbf24'; ctx.arc(this.x, this.y, 3, 0, Math.PI * 2); ctx.fill(); }
        else if (this.type === 'aa_shell') { ctx.fillStyle = '#f472b6'; ctx.arc(this.x, this.y, 3, 0, Math.PI * 2); ctx.fill(); }
        else if (this.type === 'rocket') { ctx.fillStyle = '#f87171'; ctx.fillRect(this.x - 4, this.y - 2, 8, 4); }
        else if (this.type === 'bomb') {
            // 미사일형(수직 낙하 느낌)
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

            // 작은 연기/불꽃
            ctx.fillStyle = "rgba(255,180,60,0.9)";
            ctx.fillRect(-1, 10, 2, 5);

            ctx.restore();
        }
        else if (this.type === 'artillery') { ctx.fillStyle = '#f97316'; ctx.arc(this.x, this.y, 6, 0, Math.PI * 2); ctx.fill(); }
        else if (this.type === 'nuke') { ctx.fillStyle = '#ef4444'; ctx.arc(this.x, this.y, 10, 0, Math.PI * 2); ctx.fill(); }
        else if (this.type === 'tactical_missile') {
            ctx.save();
            ctx.translate(this.x, this.y);
            ctx.rotate(Math.atan2(this.vy, this.vx));

            // 본체
            ctx.fillStyle = '#e5e7eb';
            ctx.fillRect(-14, -3, 28, 6);

            // 노즈(빨강)
            ctx.fillStyle = '#ef4444';
            ctx.fillRect(10, -3, 6, 6);

            // 엔진 불꽃
            ctx.fillStyle = '#f59e0b';
            ctx.beginPath();
            ctx.arc(-14, 0, 4, 0, Math.PI * 2);
            ctx.fill();

            ctx.restore();
        }
    }
}
