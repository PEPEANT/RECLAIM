class Building extends Entity {
    constructor(type, x, y, team) {
        const data = CONFIG.buildings[type];
        super(x, y + (data.yOffset || 0), team, data.hp, data.width, data.height);
        this.type = type; this.name = data.name;
        this.canShoot = (data.canShoot === true) || (type === 'bunker' || type === 'turret');
        this.damage = data.damage || 0; this.range = data.range || 0;
        this.fireRate = data.rate || 0; this.lastShot = 0;
        this.captureProgress = 0;
        this.antiAir = data.antiAir || false;
        this.onlyAir = data.onlyAir || false;
        this.projectileType = data.projectileType || 'machinegun';
        this.allowAir = data.allowAir || false;
        this.ignoreDrone = data.ignoreDrone || false;
        this.airDamageMult = (data.airDamageMult == null) ? 1.0 : data.airDamageMult;
        this.hideHp = true;
        this.hpVisibleUntil = 0;
        this.destroyedAt = -1;
        this.hpBarExtra = data.hpBarExtra || 0;
        this.hpBarOffsetY = data.hpBarOffsetY || 0;
        this.stunTimer = 0;
        // [NEW] Destruction state
        this.destroying = false;
        this.destroyStartFrame = 0;
        this.destroyDuration = 0;
        this._deathFxSpawned = false;
    }

    takeDamage(amount) {
        // [NEW] 피격 시 HP바 표시 + 3초 뒤 숨김 예약(피격될 때마다 연장)
        if (amount > 0) {
            this.hideHp = false;
            this.hpVisibleUntil = game.frame + 180; // 60fps 기준 3초
        }
        if (this.type === 'bunker') {
            this.hp -= amount;
            if (this.hp <= 0) {
                this.team = 'neutral';
                this.hp = this.maxHp * 0.2;
                this.captureProgress = 0;
                if (game.selectedSpawn === this) game.selectSpawn(null);
            }
        } else {
            if (this.destroying) return;
            this.hp -= amount;
            if (this.hp <= 0) {
                this.hp = 0;

                // [NEW] Start destruction animation instead of instant vanish
                this.destroying = true;
                this.destroyStartFrame = game.frame || 0;
                this.destroyDuration = (String(this.type || '').includes('hq')) ? 90 : 55;

                // FX + SFX (once)
                if (!this._deathFxSpawned && game.spawnBuildingDestructionFX) {
                    this._deathFxSpawned = true;
                    game.spawnBuildingDestructionFX(this);
                }

                // [NEW] Trigger Total War on Enemy Turret Death (keep behavior)
                if (this.type === 'turret' && this.team === 'enemy') {
                    if (game.triggerTotalWar) game.triggerTotalWar();
                }
            }
        }
    }

    update(enemies, players) {
        // [NEW] 마지막 피격 이후 3초 지나면 HP바 다시 숨김 (단, 선택 중이면 유지)
        const isSelected = (typeof game !== 'undefined' && game.selectedBuilding === this);
        if (isSelected) {
            this.hideHp = false;
        } else if (this.hpVisibleUntil > 0 && game.frame > this.hpVisibleUntil) {
            this.hideHp = true;
        }
        if (this.dead) return;
        // [NEW] While destroying: stop logic/shooting, wait then remove
        if (this.destroying) {
            const dt = (game.frame || 0) - (this.destroyStartFrame || 0);
            if (dt >= (this.destroyDuration || 0)) {
                this.dead = true;
            }
            return;
        }

        if (this.type === 'bunker') {
            let pCount = 0, eCount = 0;
            players.forEach(u => { if (u && !u.dead && Math.abs(u.x - this.x) < 200 && u.stats && !u.stats.type.includes('air')) pCount++; });
            enemies.forEach(u => { if (u && !u.dead && Math.abs(u.x - this.x) < 200 && u.stats && !u.stats.type.includes('air')) eCount++; });

            if (pCount > eCount) this.captureProgress += 0.5;
            else if (eCount > pCount) this.captureProgress -= 0.5;

            if (pCount === 0 && eCount === 0 && this.team === 'neutral') {
                if (this.captureProgress > 0) this.captureProgress -= 0.1;
                if (this.captureProgress < 0) this.captureProgress += 0.1;
            }

            this.captureProgress = Math.max(-100, Math.min(100, this.captureProgress));

            if (this.captureProgress >= 100 && this.team !== 'player') {
                this.team = 'player'; this.hp = this.maxHp;
            } else if (this.captureProgress <= -100 && this.team !== 'enemy') {
                this.team = 'enemy'; this.hp = this.maxHp;
                if (game.selectedSpawn === this) game.selectSpawn(null);
            }
        }

        if (this.canShoot && this.team !== 'neutral') {
            const targets = this.team === 'player' ? enemies : players;
            let target = null;
            let minDist = this.range;

            // [CHANGE] antiAir면(=터렛/대공시설) 공중 타겟 우선 탐색
            if (this.antiAir) {
                const airTarget = targets.find(t => !t.dead && t.stats && !t.stats.invulnerable && Math.abs(t.x - this.x) < this.range && t.stats.type === 'air');
                if (airTarget) target = airTarget;
            }

            if (!target) {
                for (let t of targets) {
                    if (!t || t.dead) continue;
                    if (t.stats && t.stats.invulnerable) continue;
                    if (this.ignoreDrone && t.stats && t.stats.category === 'drone') continue;
                    if (this.onlyAir && t.stats && t.stats.type !== 'air') continue;
                    if (!this.antiAir && t.stats && t.stats.type === 'air' && !this.allowAir) continue;
                    const dist = Math.abs(t.x - this.x);
                    if (dist < minDist) { minDist = dist; target = t; }
                }
            }

            if (target && game.frame - this.lastShot > this.fireRate) {
                if (this.team === 'enemy' && game.empTimer > 0) return;
                if (this.stunTimer > 0) return;

                // Fire Projectile
                // If Projectile class is loaded via projectiles.js, this works.
                let dmg = this.damage;
                if (target && target.stats && target.stats.type === 'air' && !this.antiAir) {
                    dmg = Math.floor(dmg * this.airDamageMult);
                }
                if (this.antiAir && target && target.stats && target.stats.id === 'bomber') dmg *= 2.0;
                let spawnY = this.y - this.height / 2;
                if (this.type === 'watchtower') {
                    spawnY = this.y - this.height + 35;
                }
                game.projectiles.push(new Projectile(this.x, spawnY, target, dmg, this.team, this.projectileType));
                this.lastShot = game.frame;

                // 건물 발사 사운드 (flak)
                if (typeof AudioSystem !== 'undefined' && Math.random() < 0.25) {
                    AudioSystem.playGun('flak');
                }
            }
        }

        if (this.stunTimer > 0) {
            this.stunTimer--;
            if (game.frame % 20 === 0) game.createParticles(this.x, this.y, 1, '#60a5fa');
        }
    }

    draw(ctx) {
        if (this.dead) return;
        ctx.save(); ctx.translate(this.x, this.y);

        // [NEW] Destruction visual (fade + slight shake)
        if (this.destroying) {
            const dt = (game.frame || 0) - (this.destroyStartFrame || 0);
            const dur = Math.max(1, this.destroyDuration || 1);
            const k = Math.max(0, Math.min(1, dt / dur));
            ctx.globalAlpha = 1 - k;
            const j = (1 - k) * 2;
            ctx.translate((Math.random() - 0.5) * j, (Math.random() - 0.5) * j);
        }

        // [REMOVED] Bunker Spawn UI
        if (this.type.includes('hq')) {
            // [NEW] 진짜 총사령부(후방) 전용 디자인: hq_player / hq_enemy (대칭)
            if (this.type === 'hq_player' || this.type === 'hq_enemy') {
                const time = game.frame;
                const isEnemy = (this.team === 'enemy');

                const COLORS = {
                    base: '#3E4C59',
                    dark: '#232F3E',
                    light: '#52606D',
                    accent: isEnemy ? '#ef4444' : '#3498DB',
                    metal: '#95A5A6',
                    glass: '#85C1E9',
                    flag: isEnemy ? '#dc2626' : '#0052D4',
                    turret: '#2C3E50'
                };

                const w = this.width;
                const h = this.height;

                // 로컬 기준점(지면): (0,0)
                const cx = 0;
                const cy = 0;

                // [NEW] 적군 총사령부는 좌우 반전(대칭)
                ctx.save();
                if (isEnemy) ctx.scale(-1, 1);

                // 작은 깃발
                const drawSmallFlag = (x, y) => {
                    const poleHeight = 40;
                    const flagWidth = 30;
                    const flagHeight = 18;
                    ctx.fillStyle = '#BDC3C7';
                    ctx.fillRect(x - 1, y - poleHeight, 2, poleHeight);
                    ctx.fillStyle = COLORS.flag;
                    ctx.beginPath();
                    const startX = x + 1;
                    const startY = y - poleHeight + 2;
                    ctx.moveTo(startX, startY);
                    for (let i = 0; i <= flagWidth; i += 2) {
                        const wave = Math.sin((time * 0.2) + (i * 0.3)) * 2;
                        ctx.lineTo(startX + i, startY + wave * (i / flagWidth));
                    }
                    const finalWave = Math.sin((time * 0.2) + (flagWidth * 0.3)) * 2;
                    ctx.lineTo(startX + flagWidth, startY + flagHeight + finalWave);
                    for (let i = flagWidth; i >= 0; i -= 2) {
                        const wave = Math.sin((time * 0.2) + (i * 0.3)) * 2;
                        ctx.lineTo(startX + i, startY + flagHeight + wave * (i / flagWidth));
                    }
                    ctx.closePath();
                    ctx.fill();
                };

                // 현대식 방어 포탑(시각)
                const drawModernTurret = (x, y) => {
                    ctx.save();
                    ctx.translate(x, y);
                    const angle = Math.sin(time * 0.03) * 0.1;
                    ctx.fillStyle = COLORS.turret;
                    ctx.fillRect(-15, 0, 30, 10);
                    ctx.rotate(angle);
                    ctx.fillStyle = '#34495E';
                    ctx.beginPath();
                    ctx.moveTo(-10, 0);
                    ctx.lineTo(-12, -15);
                    ctx.lineTo(12, -15);
                    ctx.lineTo(10, 0);
                    ctx.fill();
                    ctx.fillStyle = '#111';
                    ctx.fillRect(5, -12, 25, 4);
                    ctx.fillRect(5, -8, 25, 4);
                    ctx.fillStyle = '#E74C3C';
                    ctx.fillRect(0, -10, 3, 3);
                    ctx.restore();
                };

                // 미사일 배터리(시각)
                const drawMissileBattery = (x, y) => {
                    ctx.fillStyle = COLORS.metal;
                    ctx.fillRect(x - 15, y - 20, 30, 20);
                    ctx.fillStyle = '#111';
                    for (let i = 0; i < 3; i++) {
                        for (let j = 0; j < 2; j++) {
                            ctx.beginPath();
                            ctx.arc(x - 10 + i * 10, y - 15 + j * 8, 3, 0, Math.PI * 2);
                            ctx.fill();
                        }
                    }
                    ctx.fillStyle = COLORS.light;
                    ctx.beginPath();
                    ctx.moveTo(x - 15, y - 20);
                    ctx.lineTo(x + 15, y - 25);
                    ctx.lineTo(x + 15, y - 20);
                    ctx.fill();
                };

                // -------- 본체 배치 (플랫폼 + 메인 타워(좌) + 방어동(우)) --------
                // 바닥 플랫폼
                ctx.fillStyle = '#2C3E50';
                ctx.fillRect(cx - w * 1.0, cy, w * 2.0, 18);

                // 메인 타워(좌측)
                const mainX = cx - w * 0.75;
                const mainW = w * 0.70;
                const mainH = h * 1.25;
                ctx.fillStyle = COLORS.base;
                ctx.fillRect(mainX, cy - mainH, mainW, mainH);
                ctx.fillStyle = COLORS.light;
                ctx.fillRect(mainX, cy - mainH, 5, mainH);
                ctx.fillRect(mainX, cy - mainH, mainW, 5);

                // 통유리 창
                ctx.fillStyle = COLORS.glass;
                ctx.fillRect(mainX + 10, cy - mainH + 20, mainW - 20, 30);
                ctx.strokeStyle = 'rgba(255,255,255,0.3)';
                ctx.beginPath();
                ctx.moveTo(mainX + 10, cy - mainH + 50);
                ctx.lineTo(mainX + mainW - 10, cy - mainH + 20);
                ctx.stroke();

                // 작은 문
                ctx.fillStyle = '#111';
                ctx.fillRect(mainX + mainW * 0.42, cy - 30, 20, 30);
                ctx.fillStyle = '#555';
                ctx.fillRect(mainX + mainW * 0.42 - 2, cy - 32, 24, 2);

                // 연결부
                ctx.fillStyle = COLORS.dark;
                ctx.fillRect(mainX + mainW, cy - 80, 20, 80);

                // 방어동(우측 사다리꼴)
                const defX = cx + w * 0.05;
                const defW = w * 0.90;
                const defH = h * 0.75;
                ctx.fillStyle = COLORS.base;
                ctx.beginPath();
                ctx.moveTo(defX, cy);
                ctx.lineTo(defX, cy - defH);
                ctx.lineTo(defX + defW - 20, cy - defH);
                ctx.lineTo(defX + defW, cy);
                ctx.fill();
                ctx.strokeStyle = '#2c3e50';
                ctx.lineWidth = 2;
                ctx.beginPath();
                ctx.moveTo(defX, cy - defH / 2);
                ctx.lineTo(defX + defW - 10, cy - defH / 2);
                ctx.stroke();

                // 옥상: 깃발 + 센서
                drawSmallFlag(mainX + mainW / 2, cy - mainH);
                ctx.fillStyle = '#333';
                ctx.fillRect(mainX + 20, cy - mainH - 10, 10, 10);
                ctx.fillStyle = COLORS.accent;
                ctx.fillRect(mainX + 26, cy - mainH - 8, 2, 2);

                // 옥상: 대공포탑 2개(시각)
                drawModernTurret(defX + defW * 0.35, cy - defH);
                drawModernTurret(defX + defW * 0.70, cy - defH);

                // 중간 데크: 미사일 포대
                drawMissileBattery(mainX + mainW + 10, cy - 80);

                // 방어동 경고등
                const blink = Math.sin(time * 0.1) > 0;
                ctx.fillStyle = blink ? '#E74C3C' : '#550000';
                ctx.beginPath();
                ctx.arc(defX + defW - 10, cy - 20, 3, 0, Math.PI * 2);
                ctx.fill();

                // 입구 조명
                ctx.fillStyle = 'rgba(255, 255, 0, 0.1)';
                ctx.beginPath();
                ctx.moveTo(mainX + mainW * 0.5, cy - 30);
                ctx.lineTo(mainX + mainW * 0.38, cy);
                ctx.lineTo(mainX + mainW * 0.62, cy);
                ctx.fill();

                // [NEW] 미러 해제
                ctx.restore();

                ctx.restore();
                this.drawHp(ctx);
                return;
            }

            ctx.fillStyle = this.team === 'player' ? '#1e3a8a' : '#7f1d1d';
            ctx.fillRect(-this.width / 2, -this.height, this.width, this.height);
            ctx.fillStyle = this.team === 'player' ? '#3b82f6' : '#ef4444';
            ctx.fillRect(-this.width / 2 + 10, -this.height + 20, this.width - 20, 20);
            ctx.strokeStyle = '#64748b'; ctx.beginPath(); ctx.moveTo(0, -this.height); ctx.lineTo(0, -this.height - 40); ctx.stroke();
            if (game.frame % 60 < 30) { ctx.fillStyle = 'red'; ctx.beginPath(); ctx.arc(0, -this.height - 40, 2, 0, Math.PI * 2); ctx.fill(); }
        }
        else if (this.type === 'fortress_player' || this.type === 'fortress_enemy') {
            // [Modern Fortress Structure Only]
            const time = game.frame;
            const isEnemy = (this.team === 'enemy');
            const colors = {
                concrete: '#3f4652',
                concreteLight: '#555e6d',
                concreteDark: '#2b3038',
                highlight: '#4facfe',
                danger: '#ff4b4b',
                warning: '#f0ad4e'
            };

            // [FIX] 폴리곤 원본 실제 크기 기준 + 추가 0.5 축소
            const BASE_W = 560;
            const BASE_H = 320;
            let scale = Math.min((this.width || 120) / BASE_W, (this.height || 90) / BASE_H);
            scale *= 1.35;

            // [NEW] 회전 레이더 색상: 아군=파랑, 적군=빨강
            const radarColor = isEnemy ? '#ff4b4b' : '#4facfe';
            const blinkColor = radarColor;
            ctx.save();
            ctx.scale(scale, scale);

            const drawPolygon = (points, color, strokeColor = null) => {
                ctx.beginPath();
                ctx.moveTo(points[0].x, points[0].y);
                for (let i = 1; i < points.length; i++) {
                    ctx.lineTo(points[i].x, points[i].y);
                }
                ctx.closePath();
                ctx.fillStyle = color;
                ctx.fill();
                if (strokeColor) {
                    ctx.strokeStyle = strokeColor;
                    ctx.lineWidth = 2;
                    ctx.stroke();
                }
            };

            // 1. 메인 구조물 (벙커 본체)
            const mainBody = [
                { x: -300, y: 0 },
                { x: 200, y: 0 },
                { x: 100, y: -250 },
                { x: -250, y: -250 },
                { x: -300, y: 0 }
            ];
            drawPolygon(mainBody, colors.concrete, colors.concreteDark);

            // 1-1. 장갑판 디테일 (사선 패턴)
            ctx.strokeStyle = colors.concreteLight;
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(180, 0); ctx.lineTo(90, -220);
            ctx.moveTo(100, 0); ctx.lineTo(10, -220);
            ctx.moveTo(20, 0); ctx.lineTo(-70, -220);
            ctx.stroke();

            // 2. 전면 추가 장갑 (Reactive Armor)
            const frontArmor = [
                { x: 200, y: 0 },
                { x: 260, y: 0 },
                { x: 220, y: -100 },
                { x: 160, y: -100 }
            ];
            drawPolygon(frontArmor, colors.concreteDark, '#111');

            // 3. 상단 지휘 통제실 (Command Center)
            const commandCenter = [
                { x: -200, y: -250 },
                { x: 0, y: -250 },
                { x: -20, y: -320 },
                { x: -180, y: -320 }
            ];
            drawPolygon(commandCenter, colors.concreteLight, colors.concreteDark);

            // 창문
            ctx.fillStyle = `rgba(79, 172, 254, ${0.5 + Math.sin(time * 3) * 0.2})`;
            ctx.fillRect(-160, -290, 120, 15);

            // 4. 레이더/안테나 (센서만 유지)
            const radarX = -100;
            const radarY = -320;
            const radarAngle = time * 2;
            ctx.save();
            ctx.translate(radarX - 40, radarY - 40);
            ctx.fillStyle = '#444';
            ctx.fillRect(-5, 0, 10, 30);
            ctx.scale(Math.cos(radarAngle), 1);
            ctx.beginPath();
            ctx.ellipse(0, -15, 30, 10, 0, 0, Math.PI * 2);
            ctx.fillStyle = radarColor;
            ctx.fill();
            ctx.restore();

            // 센서 돔
            ctx.fillStyle = colors.concreteDark;
            ctx.beginPath();
            ctx.arc(radarX, radarY - 10, 15, Math.PI, 0);
            ctx.fill();

            // 통신 안테나
            ctx.strokeStyle = '#888';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(radarX, radarY - 25);
            ctx.lineTo(radarX, radarY - 60);
            ctx.stroke();

            // 안테나 끝 깜빡임
            const blink = Math.sin(time * 10) > 0;
            if (blink) {
                ctx.fillStyle = blinkColor;
                ctx.beginPath();
                ctx.arc(radarX, radarY - 60, 2, 0, Math.PI * 2);
                ctx.fill();
            }

            ctx.restore();
        }
        else if (this.type === 'watchtower') {
            // 🔭 감시탑(Watchtower) - "낮은 기둥 감시탑" 디자인
            const isEnemy = (this.team === 'enemy');
            ctx.save();
            if (isEnemy) ctx.scale(-1, 1);

            // 원본 도형(90x220)을 현재 width/height에 맞게 스케일
            const sx = this.width / 90;
            const sy = this.height / 220;
            ctx.scale(sx, sy);

            const cx = 0;
            const groundY = 0;

            // 1. 기둥
            ctx.fillStyle = '#555';
            ctx.fillRect(cx - 25, groundY - 150, 50, 150);

            // 2. 받침대
            ctx.fillStyle = '#444';
            ctx.fillRect(cx - 45, groundY - 150, 90, 10);

            // 3. 기관총
            ctx.fillStyle = '#111';
            ctx.fillRect(cx + 25, groundY - 185, 35, 6);
            ctx.fillRect(cx + 55, groundY - 187, 8, 10);

            // 4. 벙커 본체
            ctx.fillStyle = '#666';
            ctx.fillRect(cx - 40, groundY - 210, 80, 60);

            // 5. 오른쪽 방어벽
            ctx.fillStyle = '#333';
            ctx.fillRect(cx + 20, groundY - 220, 20, 70);

            // 6. 관측 틈
            ctx.fillStyle = '#111';
            ctx.fillRect(cx + 20, groundY - 195, 20, 5);

            // 7. 지붕
            ctx.fillStyle = '#444';
            ctx.fillRect(cx - 45, groundY - 220, 90, 10);

            ctx.restore();
            ctx.restore();
            this.drawHp(ctx);
            return;
        }
        else if (this.type === 'bunker') {
            ctx.fillStyle = '#334155'; ctx.fillRect(-40, -60, 80, 60);
            ctx.fillStyle = '#000'; ctx.fillRect(-40, -70, 80, 6);
            if (this.captureProgress > 0) { ctx.fillStyle = '#3b82f6'; ctx.fillRect(-40, -70, 80 * (this.captureProgress / 100), 6); }
            else { ctx.fillStyle = '#ef4444'; ctx.fillRect(40 + (80 * (this.captureProgress / 100)), -70, -80 * (this.captureProgress / 100), 6); }

            ctx.fillStyle = this.team === 'neutral' ? '#64748b' : (this.team === 'player' ? '#3b82f6' : '#ef4444');
            ctx.beginPath(); ctx.moveTo(-45, -60); ctx.lineTo(0, -80); ctx.lineTo(45, -60); ctx.fill();
            ctx.fillStyle = '#0f172a'; ctx.fillRect(-10, -40, 20, 10);
        }
        else if (this.type === 'turret') {
            ctx.fillStyle = '#334155'; ctx.fillRect(-20, -40, 40, 40);
            ctx.fillStyle = this.team === 'player' ? '#60a5fa' : '#f87171';
            ctx.beginPath(); ctx.arc(0, -45, 20, 0, Math.PI * 2); ctx.fill();
            ctx.strokeStyle = '#cbd5e1'; ctx.lineWidth = 4;
            ctx.beginPath(); ctx.moveTo(0, -45); ctx.lineTo(this.team === 'player' ? 30 : -30, -55); ctx.stroke();
        }
        // ============================================
        // [NEW] 플레이어 건설 건물 렌더링
        // ============================================
        else if (this.type === 'barracks') {
            // 보병막사 - 군사 막사 스타일
            const w = this.width;
            const h = this.height;
            const teamColor = this.team === 'player' ? '#3b82f6' : '#ef4444';

            // 메인 건물
            ctx.fillStyle = '#4b5563';
            ctx.fillRect(-w / 2, -h, w, h);

            // 지붕
            ctx.fillStyle = '#374151';
            ctx.beginPath();
            ctx.moveTo(-w / 2 - 5, -h);
            ctx.lineTo(0, -h - 20);
            ctx.lineTo(w / 2 + 5, -h);
            ctx.closePath();
            ctx.fill();

            // 문
            ctx.fillStyle = '#1f2937';
            ctx.fillRect(-15, -40, 30, 40);

            // 창문들
            ctx.fillStyle = '#9ca3af';
            ctx.fillRect(-w / 2 + 10, -h + 15, 20, 15);
            ctx.fillRect(w / 2 - 30, -h + 15, 20, 15);

            // 팀 색상 마크
            ctx.fillStyle = teamColor;
            ctx.fillRect(-w / 2, -h, 5, h);
            ctx.fillRect(w / 2 - 5, -h, 5, h);
        }
        // [3.8] watchtower_new 렌더링 제거됨 - 이제 watchtower 타입 사용
        else if (this.type === 'tank_depot') {
            // 전차기지 - 대형 창고/차고 스타일
            const w = this.width;
            const h = this.height;
            const teamColor = this.team === 'player' ? '#3b82f6' : '#ef4444';

            // 메인 건물 (대형)
            ctx.fillStyle = '#374151';
            ctx.fillRect(-w / 2, -h, w, h);

            // 창고 문 (큰 셔터)
            ctx.fillStyle = '#1f2937';
            ctx.fillRect(-w / 2 + 20, -h / 2, w - 40, h / 2);

            // 셔터 라인
            ctx.strokeStyle = '#4b5563';
            ctx.lineWidth = 2;
            for (let i = 1; i < 5; i++) {
                ctx.beginPath();
                ctx.moveTo(-w / 2 + 20, -h / 2 + i * 10);
                ctx.lineTo(w / 2 - 20, -h / 2 + i * 10);
                ctx.stroke();
            }

            // 지붕
            ctx.fillStyle = '#4b5563';
            ctx.fillRect(-w / 2 - 5, -h - 10, w + 10, 15);

            // 굴뚝
            ctx.fillStyle = '#6b7280';
            ctx.fillRect(w / 2 - 30, -h - 30, 15, 25);

            // 팀 색상 표시
            ctx.fillStyle = teamColor;
            ctx.fillRect(-w / 2, -h, w, 5);

            // 탱크 아이콘 (문 위)
            ctx.fillStyle = teamColor;
            ctx.fillRect(-20, -h + 20, 40, 8);
            ctx.fillRect(-10, -h + 15, 30, 5);
        }
        ctx.restore();
        this.drawHp(ctx);
    }
}



