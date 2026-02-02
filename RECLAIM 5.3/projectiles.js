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
            // ?꾩닠誘몄궗??諛쒖궗 ?ъ슫??(?곗?硫??먮룞 以묒?)
            if (typeof AudioSystem !== 'undefined') {
                this.rocketSound = AudioSystem.playTacticalMissileSound();
            }
        }
        else if (type === 'engineer_missile') {
            this.speed = 12;
            this.vx = (dx / dist) * this.speed;
            this.vy = (dy / dist) * this.speed;
            this.trailTick = 0;
            // 諛쒖궗 ?ъ슫??
            if (typeof AudioSystem !== 'undefined') {
                AudioSystem.playSFX('rocket_launcher');
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
            const hitRadius = (this.type === 'machinegun' || this.type === 'bullet') ? 20 : 30;
            if (Math.abs(this.x - this.targetX) < hitRadius && Math.abs(this.y - this.targetY) < hitRadius) this.hit();
            if (this.x < 0 || this.x > CONFIG.mapWidth) this.dead = true;
        }
    }

    hit() {
        this.dead = true;
        let artilleryKilled = false;

        if (this.type === 'tactical_missile') {
            // 諛쒖궗 ?ъ슫??以묒?
            if (this.rocketSound) {
                try { this.rocketSound.pause(); this.rocketSound.currentTime = 0; } catch (e) { }
            }

            // ???꾩닠湲???컻 (?묒? 踰덉찉???곌퀬由??놁쓬: VFX 洹쒖튃 ?곕쫫)
            if (typeof VFX !== 'undefined') {
                VFX.spawn(game, 'tactical', this.x, game.groundY);
            }

            // ????컻 ?ъ슫??(boom-3)
            if (typeof AudioSystem !== 'undefined') AudioSystem.playBoom('tactical');

            // ??踰붿쐞 ?쇳빐 (?꾩닠湲? - [FIX] 諛쒖궗 ? 湲곗??쇰줈 諛섎????寃?
            // [OPTIMIZATION] 배열 복사 제거 - 직접 순회로 GC 부하 감소
            const R = 260;
            const DMG = 700;
            const applyDamage = (t) => {
                if (!t || t.dead) return;
                const d = Math.abs(t.x - this.x);
                if (d < R && !(t.stats && t.stats.invulnerable)) t.takeDamage(DMG, 'tactical_missile');
            };

            if (this.team === 'player') {
                game.enemies.forEach(applyDamage);
                game.enemyBuildings.forEach(applyDamage);
            } else {
                game.players.forEach(applyDamage);
                if (game.civilians) game.civilians.forEach(applyDamage);
                game.playerBuildings.forEach(applyDamage);
            }

            return;
        }

        // [NEW] 怨듬퀝 ?좊룄 誘몄궗???쇨꺽 泥섎━
        if (this.type === 'engineer_missile') {
            // ??컻 VFX
            if (typeof VFX !== 'undefined') {
                const isAir = this.target && this.target.stats && this.target.stats.type === 'air';
                // [P1] 대전차 미사일 - atm/airburst 프리셋 사용
                VFX.spawn(game, isAir ? 'airburst' : 'atm', this.x, this.y, { anchorGround: !isAir });
            }

            // ??컻 ?ъ슫??
            if (typeof AudioSystem !== 'undefined') {
                AudioSystem.playSFX('engineer_explosion');
            }

            // ?⑥씪 ?寃??쇳빐
            if (this.target && !this.target.dead) {
                if (!(this.target.stats && this.target.stats.invulnerable)) {
                    const isAir = this.target && this.target.stats && this.target.stats.type === 'air';
                    const dmg = isAir ? Math.round(this.damage * 1.6) : this.damage;
                    this.target.takeDamage(dmg);
                }
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
            if (typeof AudioSystem !== 'undefined') AudioSystem.playBoom('nuke');

            // 광역 폭발 피해 범위 20% 증가 (400 -> 480)
            // [OPTIMIZATION] 배열 복사 제거 - 직접 순회로 GC 부하 감소
            const applyNukeDamage = (t) => {
                if (!t || t.dead) return;
                if (Math.abs(t.x - this.x) < 480 && !(t.stats && t.stats.invulnerable)) {
                    t.takeDamage(800, 'nuke');
                }
            };
            // [FIX] 핵미사일: 발사 팀에 따라 대상 팀만 피해
            if (this.team === 'player') {
                game.enemies.forEach(applyNukeDamage);
                game.enemyBuildings.forEach(applyNukeDamage);
            } else {
                game.players.forEach(applyNukeDamage);
                if (game.civilians) game.civilians.forEach(applyNukeDamage);
                game.playerBuildings.forEach(applyNukeDamage);
            }
            return;
        }

        // [VFX] ??꺽/?먯＜???곕?吏 ?뚰삎 ??컻 遺꾧린
        if (typeof VFX !== 'undefined') {
            // 怨듭쨷 ?좊떅??留욎텣 寃쎌슦: hit_air
            const isAirHit = (this.target && this.target.stats && this.target.stats.type === 'air');

            if (this.type === 'artillery' || this.type === 'bomb') {
                VFX.spawn(game, this.type === 'bomb' ? 'bomb' : 'artillery', this.x, game.groundY);
                // ???먯＜????꺽湲???컻 ?ъ슫??(boom-3)
                if (this.type === 'bomb' && typeof AudioSystem !== 'undefined') AudioSystem.playBoom('bomber');
            }
            else if (this.type === 'rocket' || this.type === 'aa_shell' || this.type === 'shell') {
                // RPG / ?怨듯룷 / ?꾩감???쇨꺽 ??컻
                // [P1] 대공포 공중 타격 시 airburst, 그 외 shell_hit
                if (this.type === 'aa_shell' && isAirHit) {
                    VFX.spawn(game, 'airburst', this.x, this.y, { anchorGround: false });
                } else {
                    VFX.spawn(game, isAirHit ? 'hit_air' : 'shell_hit', this.x, this.y, { anchorGround: !isAirHit });
                }
            }
            else {
                // 洹??몃뒗 湲곗〈 ?좎?
                if (game.createParticles) game.createParticles(this.x, this.y, 5, this.type === 'rocket' ? '#ef4444' : '#fbbf24');
            }
        } else {
            if (game.createParticles) game.createParticles(this.x, this.y, 5, this.type === 'rocket' ? '#ef4444' : '#fbbf24');
        }
        // [Optimization] Conditional SFX - small ground explosions use boom-4
        if (this.type !== 'artillery' && Math.random() < 0.3 && typeof AudioSystem !== 'undefined') AudioSystem.playBoom('small');

        const enemiesList = this.team === 'player'
            ? game.enemies
            : [...game.players, ...(game.civilians || [])];
        const enemyBldgs = this.team === 'player' ? game.enemyBuildings : game.playerBuildings;
        const bunkers = game.buildings.filter(b => b.type === 'bunker');

        const list = [...enemiesList, ...enemyBldgs, ...bunkers];
        const radius = this.type === 'artillery' || this.type === 'bomb' ? 120 : (this.type === 'rocket' ? 50 : 15);

        if (this.type === 'machinegun' || this.type === 'bullet') {
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
                    // Hit Chance (?꾩떎?? AA??100%???꾨떂)
                    let hitChance = 1.0;
                    if (this.type === 'aa_shell') {
                        hitChance = (isUnit && u.evasion) ? 0.65 : 0.85;
                    }

                    if (Math.random() < hitChance) {
                        if (this.type === 'artillery' && isUnit) {
                            const wasDead = u.dead;
                            u.skipDeathSound = true;
                            u.takeDamage(this.damage, this.type);
                            if (!u.dead) u.skipDeathSound = false;
                            if (!wasDead && u.dead) artilleryKilled = true;
                        } else {
                            // [NEW] 건물에 공격 유형 전달
                            u.takeDamage(this.damage, this.type);
                        }
                    }
                    else if (game.createParticles) game.createParticles(u.x, u.y - 10, 2, '#fff');
                }
            });
        }

        if (this.type === 'artillery' && typeof AudioSystem !== 'undefined') {
            if (artilleryKilled) AudioSystem.playBoom('death_exp3');
            else AudioSystem.playBoom('spg');
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
        else if (this.type === 'artillery') { ctx.fillStyle = '#f97316'; ctx.arc(this.x, this.y, 6, 0, Math.PI * 2); ctx.fill(); }
        else if (this.type === 'nuke') { ctx.fillStyle = '#ef4444'; ctx.arc(this.x, this.y, 10, 0, Math.PI * 2); ctx.fill(); }
        else if (this.type === 'tactical_missile') {
            ctx.save();
            ctx.translate(this.x, this.y);
            ctx.rotate(Math.atan2(this.vy, this.vx));

            // 蹂몄껜
            ctx.fillStyle = '#e5e7eb';
            ctx.fillRect(-14, -3, 28, 6);

            // ?몄쫰(鍮④컯)
            ctx.fillStyle = '#ef4444';
            ctx.fillRect(10, -3, 6, 6);

            // ?붿쭊 遺덇퐙
            ctx.fillStyle = '#f59e0b';
            ctx.beginPath();
            ctx.arc(-14, 0, 4, 0, Math.PI * 2);
            ctx.fill();

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
    }
}


