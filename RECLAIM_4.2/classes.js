// [RULE] 인게임 안내/상태/채팅 메시지는 UI 토스트 금지. ChatPanel.push()로만 출력.
class Entity {
    constructor(x, y, team, hp, width, height) {
        this.x = x; this.y = y; this.team = team;
        this.maxHp = hp; this.hp = hp;
        this.width = width; this.height = height;
        this.dead = false;
        this.hideHp = false; // [NEW] Icon rendering flag
    }
    drawHp(ctx) {
        if (this.dead) return;
        if (this.hideHp) return;
        const alwaysShow = (typeof game !== 'undefined' && game.selectedBuilding === this);
        const w = this.width; const h = 3;
        const extra = (this.hpBarExtra || 0);
        const y = this.y - this.height - 8 - extra + (this.hpBarOffsetY || 0);
        ctx.fillStyle = '#1e293b'; ctx.fillRect(this.x - w / 2, y, w, h);
        const pct = Math.max(0, this.hp / this.maxHp);
        ctx.fillStyle = this.team === 'player' ? '#2563eb' : (this.team === 'enemy' ? '#dc2626' : (this.team === 'neutral' ? '#94a3b8' : '#eab308'));
        ctx.fillRect(this.x - w / 2, y, w * pct, h);

        if (alwaysShow) {
            ctx.font = '14px Arial';
            ctx.fillStyle = '#ffffff';
            ctx.textAlign = 'center';
            ctx.fillText(`${Math.floor(this.hp)} / ${this.maxHp}`, this.x, y - 8);
        }
    }
}

// Building class moved to buildings.js

class Unit extends Entity {
    constructor(typeKey, x, groundY, team, lockedTarget = null) {
        // [FIX] Invalid Unit Type Safety
        if (!CONFIG.units[typeKey]) {
            console.error(`Unit type '${typeKey}' not found! Defaulting to 'infantry'`);
            typeKey = 'infantry';
        }

        const stats = CONFIG.units[typeKey];
        if (!stats) return; // double safety

        let startY = groundY;
        // [FIX] Stealth Drone Height adjustment (Higher than normal air units)
        if (stats.id === 'stealth_drone') startY = groundY - 420 - Math.random() * 60;
        else if (stats.id === 'bomber') startY = groundY - 240 - Math.random() * 80; // Higher altitude
        else if (stats.type === 'air') startY = groundY - 150 - Math.random() * 100;

        super(x, startY, team, stats.hp, stats.width, stats.height);
        this.stats = stats;
        this.lastAttack = 0;
        this.lastBomb = 0;
        this.rotorAngle = 0;
        this.lockedTarget = lockedTarget;
        this.stunTimer = 0;
        this.evasion = (stats.category === 'drone'); // [NEW] Drone Evasion Flag
        this.deployed = false; // [NEW] APC ??뤾컧 ???
        this.returnToBase = false;
        this.attackTarget = null; // [OPTIMIZATION] Sticky Targeting
        this.flareUsed = false; // [NEW] Air units can flare once
        this.exiting = false; // [NEW] Transport exit state
        this.targetX = null;
        this.targetY = null;

        // [R 4.2 FIX v3] facing 초기화 (draw에서 계산 금지)
        this.facing = (team === 'player') ? 1 : -1;

        // [R 4.2] 드론병(drone_operator) 전용 필드 초기화
        if (stats.operator) {
            this.opState = 'rifle';  // [FIX] 기본: 소총 모드 전진
            this.coverTarget = null;
            this.ownedDrone = null;
            this.droneChargesLeft = stats.droneCharges || 1;
            this.launchPrepTimer = 0;
            // 수동 발진 지원
            this.manualDeployRequested = false;
            this.manualDeployType = null;  // 'drone_suicide' | 'drone_at'
            this.autoDeploy = true;  // 자동 발진 활성화
        }
    }

    takeDamage(damage) {
        if (this.dead) return;

        // [?섏젙] 移섎늻?ъ? 釉붾옓?명겕??臾댁쟻 ?곹깭?щ룄 ?곕?吏瑜?諛쏅룄濡??덉쇅 泥섎━ (怨듭쨷 ?붽꺽 媛??
        if (this.stats && this.stats.invulnerable) {
            if (!['chinook', 'blackhawk'].includes(this.stats.id)) return;
        }

        const isDrone = (this.stats?.id && this.stats.id.includes('drone'));
        const evade = isDrone ? (Number(this.stats?.mobility || 0) / 100) : 0;
        if (evade > 0 && Math.random() < evade) {
            if (game && game.createParticles) game.createParticles(this.x, this.y, 3, '#94a3b8');
            return;
        }

        const dmg = Number(damage) || 0;
        if (!Number.isFinite(this.hp)) this.hp = this.maxHp;
        this.hp -= dmg;
        if (this.hp < 0) this.hp = 0;

        // [NEW] 피격 프레임 기록 (이동 중 공격받으면 전투 전환용)
        this.lastDamagedFrame = game.frame;

        // [APC] ?꾪닾 ?섏감 (泥??쇨꺽 ??
        if (this.stats.id === 'apc' && !this.deployed && this.hp < this.maxHp) {
            this.deployed = true;
            if (game && game.spawnUnitDirect) {
                for (let i = 0; i < 4; i++) game.spawnUnitDirect('infantry', this.x + (Math.random() * 40 - 20), game.groundY, this.team);
            }
        }

        if (this.hp <= 0) {
            this.dead = true;
            if (this.team === 'enemy') game.killCount++;
            // [R 4.2] 플레이어 유닛 파괴 로그
            if (this.team === 'player' && typeof ChatPanel !== 'undefined') {
                ChatPanel.push(`[유닛 파괴] ${this.stats.name}`, 'WARN');
            }
            // [R 4.2] 드론병 사망 시 ownedDrone 동반 파괴
            if (this.stats.operator && this.ownedDrone && !this.ownedDrone.dead) {
                this.ownedDrone.dead = true;
                this.ownedDrone = null;
            }
        }
    }

    update(enemies, buildings) {
        if (this.dead) return;
        if (this.commandMode !== 'retreat') this.returnToBase = false;

        // ?ㅽ꽩 ?곹깭 (EMP ??
        if (this.stunTimer > 0) {
            this.stunTimer--;
            if (game.frame % 20 === 0) game.createParticles(this.x, this.y, 1, '#60a5fa');
            return;
        }

        if (this.stats.type === 'air') this.rotorAngle += 0.8;

        // [?섏젙] ?뚮젅??濡쒖쭅 (?쒕줎??硫덉텛吏 ?딄퀬 吏?섍?寃???
        if (this.stats.type === 'air' && this.stats.category !== 'drone' && this.stats.id !== 'tactical_drone' && !this.flareUsed) {
            const flareRange = 150;
            const candidates = (this.team === 'player') ? game.enemies : game.players;
            let nearest = null;
            let bestD = flareRange + 1;

            for (const u of candidates) {
                if (!u || u.dead || !u.stats) continue;
                // ?쒕줎 移댄뀒怨좊━?닿굅??id??drone???ы븿??寃쎌슦 (?꾩닠?쒕줎 ?쒖쇅)
                if ((u.stats.category === 'drone' || u.stats.id.includes('drone')) && u.stats.id !== 'tactical_drone') {
                    const d = Math.abs(u.x - this.x);
                    if (d < bestD) { bestD = d; nearest = u; }
                }
            }

            if (nearest) {
                this.flareUsed = true;

                // [?섏젙] ?쒕줎??硫덉텛?붽쾶 ?꾨땲???寃잛쓣 ?껉퀬 ?쇰? ?곹깭濡?留뚮벀 (洹몃깷 吏?섍컧)
                nearest.lockedTarget = null;
                nearest.confusedTimer = 180; // 3珥덇컙 ?寃잜똿 遺덇? (drones.js?먯꽌 泥섎━)

                // [?붿옄?? ?뚮젅?? ?ㅼ뿉???몃? 遺덇퐙??肉쒖뼱???섏샂
                const dir = this.team === 'player' ? -1 : 1; // ?ㅼそ 諛⑺뼢
                for (let i = 0; i < 8; i++) {
                    game.createParticles(this.x + (dir * 20), this.y, 1, '#facc15'); // ?몃옉
                    game.createParticles(this.x + (dir * 25), this.y + (Math.random() * 20 - 10), 1, '#ffffff'); // ?곌린
                }

                if (typeof AudioSystem !== 'undefined') AudioSystem.playSFX('emp'); // ?뚮젅???ъ슫?????
            }
        }

        // [R 4.2] 드론병(drone_operator) 상태머신
        if (this.stats.operator) {
            this.updateDroneOperator(enemies, buildings);
            return;
        }

        // 드론 업데이트
        if (this.stats.id.startsWith('drone') || this.stats.id === 'tactical_drone' || this.stats.id === 'stealth_drone') {
            this.updateDrone(enemies, buildings);
            return;
        }

        // [3.8] Worker 유닛: buildTask가 있으면 이동→건설→정지
        if (this.stats.isBuilder) {
            // buildTask가 있으면 태스크 처리
            if (this.buildTask) {
                if (this.buildTask.phase === 'move') {
                    // targetX로 이동
                    const dx = this.buildTask.x - this.x;
                    if (Math.abs(dx) < 15) {
                        // 도착: 건설 시작
                        game.startConstruction(this.buildTask.type, this.buildTask.x, game.groundY, 'player');
                        this.buildTask.phase = 'build';
                        this.buildTask.endFrame = game.frame + this.buildTask.buildTime;
                        this.buildTask.started = true;
                        ui.showToast('건설 시작!');
                    } else {
                        // 이동 (건설 이동 시 4배 빠르게)
                        this.x += this.stats.speed * 4 * Math.sign(dx);
                    }
                } else if (this.buildTask.phase === 'build') {
                    // 건설 완료 대기 (game.updateConstructions()가 실제 건설 처리)
                    if (game.frame >= this.buildTask.endFrame) {
                        delete this.buildTask;
                        this.targetX = null;
                        this.commandMode = 'stop'; // [FIX] 건설 완료 후 정지
                        // 완료 메시지는 game.completeConstruction()에서 표시
                    }
                    // 정지 상태 유지 (아무것도 안 함)
                }
            } else if (this.targetX !== null && this.targetX !== undefined) {
                // 명령 받은 이동 (buildTask 없이 targetX만 있는 경우)
                const dx = this.targetX - this.x;
                if (Math.abs(dx) < 5) {
                    this.targetX = null; // 도착 시 정지
                } else {
                    this.x += this.stats.speed * Math.sign(dx);
                }
            }
            // buildTask도 없고 targetX도 없으면 정지 (아무것도 안 함)
            return;
        }

        // 怨듭쨷 ?좊떅 留??댄깉 泥섎━ (洹??
        if (this.stats.type === 'air' && !this.stats.id.startsWith('drone') && !['blackhawk', 'chinook'].includes(this.stats.id)) {
            const isOut = (this.team === 'player' && this.x > CONFIG.mapWidth + 100) || (this.team === 'enemy' && this.x < -100);
            if (isOut) {
                this.dead = true;
                if (this.team === 'player') game.playerStock[this.stats.id]++;
                else game.enemyStock[this.stats.id]++;
                return;
            }
        }

        // [FIX] 수송 헬기 로직 (블랙호크 버그 수정 포함)
        if (['blackhawk', 'chinook'].includes(this.stats.id)) {
            const hasMoveOrder = (this.commandMode === 'move' && this.commandTargetX != null);
            const orderX = hasMoveOrder ? this.commandTargetX : this.targetX;

            // [FIX] 플레이어 팀: 투입 명령 없으면 '수송 전용 로직' 자체를 타지 않게 (=> 일반 조종 가능)
            if (this.team === 'player' && orderX == null && !this.deployed) {
                // fallthrough: behave like normal air unit (stop/retreat/move works)
                // 일반 공중 유닛처럼 동작 (아래 로직 스킵)
            } else {
                if (orderX != null) this.targetX = orderX;
                const deployY = game.groundY - 80;

                // --- CHINOOK: 투입 로직 ---
                if (this.stats.id === 'chinook') {
                    if (this.exiting) {
                        this.y -= 2.0;
                        if (this.y < -200) this.dead = true;
                    } else if (this.deployed) {
                        this.exiting = true;
                    } else {
                        const dx = this.targetX - this.x;
                        const dy = deployY - this.y;
                        const dist = Math.sqrt(dx * dx + dy * dy);
                        const speed = this.stats.speed || 2.5;

                        if (dist < 20) {
                            this.deployed = true;
                            if (game && game.spawnUnitDirect) {
                                for (let i = 0; i < 10; i++) {
                                    setTimeout(() => {
                                        if (game.running) game.spawnUnitDirect('infantry', this.x + (Math.random() * 60 - 30), game.groundY, this.team);
                                    }, i * 100);
                                }
                            }
                        } else {
                            this.x += (dx / dist) * speed;
                            this.y += (dy / dist) * (speed * 0.8);
                        }
                    }
                    return;
                }

                // --- BLACKHAWK: 투입 후 전투 모드 전환 ---
                if (this.stats.id === 'blackhawk') {
                    if (!this.deployed) {
                        const dx = this.targetX - this.x;
                        const dy = deployY - this.y;
                        const dist = Math.sqrt(dx * dx + dy * dy);
                        const speed = this.stats.speed || 3.0;

                        if (dist < 20) {
                            this.deployed = true;
                            // 특수부대 투하
                            if (game && game.spawnUnitDirect) {
                                for (let i = 0; i < 4; i++) {
                                    setTimeout(() => {
                                        if (game.running) game.spawnUnitDirect('special_forces', this.x + (Math.random() * 40 - 20), game.groundY, this.team);
                                    }, i * 150);
                                }
                            }
                            // [FIX] 투입 완료 직후 명령값 정리 (거꾸로 반전 방지)
                            this._insertDone = true;
                            this.targetX = null;
                            this.commandTargetX = null;
                            this.commandMode = 'stop';
                            this.returnToBase = false;
                            this.attackTarget = null;
                        } else {
                            this.x += (dx / dist) * speed;
                            this.y += (dy / dist) * (speed * 0.8);
                            return;
                        }
                    }
                    // deployed === true면 아래 일반 전투 로직으로 진행 (공격 헬기로 변환)
                }
            }
        }


        // ?꾨왂 ??꺽湲?
        if (this.stats.id === 'bomber') {
            const dir = this.team === 'player' ? 1 : -1;
            this.x += this.stats.speed * dir;
            if (game.frame - this.lastBomb > 40 && this.x > 0 && this.x < CONFIG.mapWidth) {
                const targets = [...enemies, ...buildings];
                const hasTarget = targets.some(t => t && !t.dead && t.team !== 'neutral' && !(t.stats && t.stats.invulnerable) && Math.abs(t.x - this.x) < 50);
                if (hasTarget) {
                    game.projectiles.push(new Projectile(this.x, this.y, null, this.stats.damage, this.team, 'bomb'));
                    this.lastBomb = game.frame;
                }
            }
            return;
        }

        // ?꾪닾湲?
        if (this.stats.id === 'fighter') {
            const dir = this.team === 'player' ? 1 : -1;
            this.x += this.stats.speed * dir;

            if (this.attackTarget && (this.attackTarget.dead || (this.attackTarget.stats && this.attackTarget.stats.invulnerable) || Math.abs(this.attackTarget.x - this.x) > 600)) {
                this.attackTarget = null;
            }
            if (!this.attackTarget) {
                this.attackTarget = enemies.find(e =>
                    !e.dead && e.stats && !e.stats.invulnerable &&
                    (e.stats.type === 'air' || e.stats.id === 'aa_tank') &&
                    e.stats.category !== 'drone' &&
                    Math.abs(e.x - this.x) < 550
                );
            }
            const target = this.attackTarget;
            if (target && game.frame - this.lastAttack > 10) {
                let dmg = this.stats.damage;
                // 怨좊룄 ?곗쐞 蹂대꼫??
                if (target.stats.type === 'air') {
                    const heightDiff = target.y - this.y;
                    if (heightDiff > 10) dmg *= (1 + Math.min(0.5, heightDiff / 200));
                }
                if (target.stats.id === 'aa_tank') dmg *= 0.5;

                game.projectiles.push(new Projectile(this.x, this.y, target, dmg, this.team, 'machinegun'));
                this.lastAttack = game.frame;
            }
            return;
        }

        // [?쇰컲 ?꾪닾 濡쒖쭅] (吏???좊떅, ?꾪뙆移? **?꾧컻??釉붾옓?명겕**)
        if (this.attackTarget) {
            const dist = Math.abs(this.attackTarget.x - this.x);
            const isStealth = this.attackTarget.stats && this.attackTarget.stats.stealth;
            const isInvulnerable = this.attackTarget.stats && this.attackTarget.stats.invulnerable;

            if (this.attackTarget.dead ||
                dist > this.stats.range + 50 ||
                this.attackTarget.team === this.team ||
                this.attackTarget.team === 'neutral' ||
                isInvulnerable ||
                (isStealth && dist > 100)) {
                this.attackTarget = null;
            }
        }

        if (!this.attackTarget) {
            let bestScore = Infinity;
            const canHitAir = this.stats.antiAir || this.stats.type === 'air' || ['humvee', 'apc'].includes(this.stats.id);

            for (let e of enemies) {
                if (!e || e.dead || (e.stats && (e.stats.stealth || e.stats.invulnerable))) continue;
                if (this.stats.id === 'humvee' && e.stats.id === 'fighter') continue;
                if (e.stats.type === 'air' && !canHitAir) continue;

                const dist = Math.abs(e.x - this.x);
                if (dist > this.stats.range) continue;

                let score = dist;
                // ?怨??좊떅? ??났湲??곗꽑
                if (this.stats.antiAir && e.stats.type === 'air') score -= 2000;
                else if (!this.stats.antiAir && e.stats.type === 'air') score += 2000;

                if (score < bestScore) { bestScore = score; this.attackTarget = e; }
            }

            // ???좊떅 ?놁쑝硫?嫄대Ъ ?寃?
            if (!this.attackTarget) {
                for (let b of buildings) {
                    if (!b || b.dead || b.team === this.team || b.team === 'neutral') continue;
                    const dist = Math.abs(b.x - this.x);
                    if (dist > this.stats.range + b.width / 2) continue;
                    if (dist < bestScore) { bestScore = dist; this.attackTarget = b; }
                }
            }
        }

        const target = this.attackTarget;
        const isAttacking = (target !== null) && !(this.team === 'enemy' && game.empTimer > 0);

        if (isAttacking) {
            let rate = 60;
            // [?섏젙] 釉붾옓?명겕??鍮좊Ⅸ ?곗궗 (15?꾨젅?? ?곸슜
            if (['humvee', 'apc', 'aa_tank', 'turret', 'blackhawk'].includes(this.stats.id)) rate = 15;
            else if (this.stats.id === 'spg') rate = 300;

            if (game.frame - this.lastAttack > rate) {
                this.attack(target);
                this.lastAttack = game.frame;
            }
        } else {
            // 怨듦꺽 ??곸씠 ?놁쑝硫??꾩쭊
            const moveDir = this.team === 'player' ? 1 : -1;
            this.x += this.stats.speed * moveDir;
        }
    }

    updateDrone(enemies, buildings) {
        if (typeof DroneBehavior !== 'undefined') {
            DroneBehavior.update(this, enemies, buildings);
        } else {
            this.dead = true;
        }
    }

    // [R 4.2] 드론병 상태머신
    updateDroneOperator(enemies, buildings) {
        const stats = this.stats;
        const isPlayer = this.team === 'player';
        const moveDir = isPlayer ? 1 : -1;

        // === RIFLE: 소총 모드 (기본 상태) - 전진/사격 + 발진 트리거 ===
        if (this.opState === 'rifle') {
            // 1. 발진 트리거 체크
            const canDeploy = this.droneChargesLeft > 0 && !this.ownedDrone;
            let shouldDeploy = false;
            let deployType = null;

            if (canDeploy) {
                // 수동 발진 요청
                if (this.manualDeployRequested) {
                    shouldDeploy = true;
                    deployType = this.manualDeployType || 'drone_suicide';
                    this.manualDeployRequested = false;
                    this.manualDeployType = null;
                }
                // 자동 발진
                else if (this.autoDeploy) {
                    const detectRange = stats.detectRange || 400;
                    let nearestEnemy = null;
                    let nearestDist = detectRange + 1;

                    for (const e of enemies) {
                        if (!e || e.dead) continue;
                        const d = Math.abs(e.x - this.x);
                        if (d < nearestDist) { nearestDist = d; nearestEnemy = e; }
                    }

                    if (nearestEnemy && nearestDist <= detectRange) {
                        shouldDeploy = true;
                        // 타겟 타입에 따라 드론 종류 자동 선택
                        const target = nearestEnemy;
                        const isArmored = target.armored === true ||
                            ['tank', 'vehicle', 'mech'].includes(target.type) ||
                            ['mbt', 'apc', 'aa_tank', 'humvee', 'spg'].includes(target.stats?.id) ||
                            target.width > 50;  // 건물/장갑
                        deployType = isArmored ? 'drone_at' : 'drone_suicide';
                    }
                }
            }

            // 2. 발진 실행 → laptop 모드 전환
            if (shouldDeploy && deployType) {
                this.opState = 'laptop';

                // [R 4.2 FIX] 드론 생성 위치: 더 멀리서 + 땅 근처에서 시작
                const frontSpawnOffset = stats.frontSpawnOffset || 120;  // 확대
                const droneX = isPlayer ? this.x + frontSpawnOffset : this.x - frontSpawnOffset;
                const droneY = game.groundY - 6;  // [FIX v3] 발까지 내려옴

                // 드론 스폰 (bypassBlock=true로 스폰 가드 우회)
                if (game && game.spawnUnitDirect) {
                    const drone = game.spawnUnitDirect(deployType, droneX, droneY, this.team, true);
                    if (drone) {
                        drone.ownerRef = this;  // Owner 링크
                        drone.holdFrames = stats.launchPrepFrames || 90;
                        drone.launchTargetY = game.groundY - 110;  // [FIX v3] 상승 목표
                        this.ownedDrone = drone;
                        this.droneChargesLeft--;

                        if (typeof ChatPanel !== 'undefined' && this.team === 'player') {
                            ChatPanel.push(`[드론 발진] ${CONFIG.units[deployType]?.name || deployType}`, 'INFO');
                        }
                    }
                }
                return;  // laptop 모드로 전환 후 이번 프레임 종료
            }

            // 3. 일반 보병처럼 전진/사격
            // 타겟 찾기
            if (!this.attackTarget || this.attackTarget.dead) {
                let bestDist = stats.range + 1;
                for (const e of enemies) {
                    if (!e || e.dead) continue;
                    const d = Math.abs(e.x - this.x);
                    if (d < bestDist) { bestDist = d; this.attackTarget = e; }
                }
            }

            const target = this.attackTarget;
            if (target && Math.abs(target.x - this.x) <= stats.range) {
                // 공격
                if (game.frame - this.lastAttack > 30) {
                    this.attack(target);
                    this.lastAttack = game.frame;
                }
            } else {
                // 이동
                this.x += stats.speed * moveDir;
            }
            this.updateFacing();  // [FIX] facing 확정
            return;
        }

        // === LAPTOP: 노트북 모드 - 정지 + 드론 생존 체크 ===
        if (this.opState === 'laptop') {
            // Guard: laptop 상태는 이동/공격 완전 차단
            // 드론 생존 체크
            if (!this.ownedDrone || this.ownedDrone.dead) {
                // 드론 죽음 → rifle 모드 복귀
                this.ownedDrone = null;
                this.opState = 'rifle';
            }
            // laptop 상태 유지 (정지)
            this.updateFacing();  // [FIX] facing 확정
            return;
        }
    }

    // [R 4.2 FIX v3] facing을 update에서 확정 (draw에서 계산 금지)
    updateFacing() {
        if (this.dead) return;

        const baseForward = (this.team === 'player') ? 1 : -1;

        // 1) 공격 타겟 기준
        if (this.attackTarget && !this.attackTarget.dead) {
            const dx = this.attackTarget.x - this.x;
            if (Math.abs(dx) > 2) this.facing = dx > 0 ? 1 : -1;
            return;
        }

        // 2) 수동 이동 명령 기준
        if (this.commandMode === 'move' && this.commandTargetX != null) {
            const dx = this.commandTargetX - this.x;
            if (Math.abs(dx) > 2) this.facing = dx > 0 ? 1 : -1;
            return;
        }

        // 3) 후퇴는 기지방향(=전진 반대)
        if (this.commandMode === 'retreat') {
            this.facing = -baseForward;
            return;
        }

        // 4) 기본 전진 방향
        this.facing = baseForward;
    }

    findNearestEnemy(enemies, buildings) {
        let t = null; let min = 9999;
        [...enemies, ...buildings].forEach(e => {
            if (e && !e.dead && e.team !== this.team && e.team !== 'neutral') {
                const d = Math.abs(e.x - this.x);
                if (d < min) { min = d; t = e; }
            }
        });
        return t;
    }

    explode(target) {
        if (this.dead || this.exploded) return;
        this.dead = true;
        this.exploded = true;
        try {
            // [VFX] 드론 자폭/폭발
            const id = this.stats && this.stats.id ? this.stats.id : '';
            let kind = 'hit';

            // 모든 드론 공통: 공중 소형 폭발
            if (id.includes('drone')) kind = 'hit_air';

            // 스텔스드론: 기존 유지(큰 자폭)
            if (id === 'stealth_drone') kind = 'stealth';

            // 전술드론 또는 AT드론: 전술급 폭발
            if (id === 'tactical_drone' || id === 'drone_at') kind = 'tactical';

            if (typeof VFX !== 'undefined') {
                const isAir = (this.stats && this.stats.type === 'air');
                VFX.spawn(game, kind, this.x, this.y, { anchorGround: !isAir });
            } else {
                if (game && game.createParticles) game.createParticles(this.x, this.y, 20, '#f59e0b');
            }

            // ✅ 드론 폭발 사운드
            if (typeof AudioSystem !== 'undefined') {
                if (id === 'tactical_drone' || id === 'drone_at') {
                    AudioSystem.playBoom('tactical_drone'); // boom-2
                } else if (id === 'stealth_drone') {
                    AudioSystem.playBoom('stealth'); // boom-3
                } else {
                    // 일반 드론 (지상 충돌 시 boom-4)
                    const isOnGround = this.y >= (game.groundY - 30);
                    if (isOnGround) {
                        AudioSystem.playBoom('drone'); // boom-4
                    } else {
                        AudioSystem.playBoom('other'); // boom-2 (공중)
                    }
                }
            }

            // [R 4.2] AT드론 전술급 AoE 폭발 (R=260, DMG=700)
            if (id === 'drone_at') {
                const radius = this.stats.splashRadius || 260;
                const baseDmg = this.stats.damage || 700;
                const targetsList = this.team === 'player' ? game.enemies : game.players;
                const buildingsList = game.buildings || [];

                // 유닛 피해
                if (targetsList) {
                    [...targetsList].forEach(e => {
                        if (e && !e.dead && e !== this) {
                            const d = Math.abs(e.x - this.x);
                            if (d < radius) {
                                const falloff = 1 - (d / radius) * 0.5;
                                try { e.takeDamage(Math.floor(baseDmg * falloff)); } catch (err) { }
                            }
                        }
                    });
                }

                // 건물 피해 (0.6배)
                [...buildingsList].forEach(b => {
                    if (b && !b.dead && b.team !== this.team && b.team !== 'neutral') {
                        const d = Math.abs(b.x - this.x);
                        if (d < radius) {
                            const falloff = 1 - (d / radius) * 0.5;
                            try { b.takeDamage(Math.floor(baseDmg * falloff * 0.6)); } catch (err) { }
                        }
                    }
                });
            }
            // 일반 드론 (자폭/전술 등): 기존 로직
            else if (target && !target.dead && typeof target.takeDamage === 'function') {
                target.takeDamage(this.stats.damage);
            }

            // 기존 splash 로직 (AT드론 제외)
            if (this.stats.splash && id !== 'drone_at') {
                const targetsList = this.team === 'player' ? game.enemies : game.players;
                if (targetsList) {
                    [...targetsList].forEach(e => {
                        if (e && !e.dead && e !== this && Math.abs(e.x - this.x) < 150) {
                            try { e.takeDamage(150); } catch (err) { }
                        }
                    });
                }
            }

            // [R 4.2] Owner 링크 처리: 드론 death 시 드론병 rifle 전환
            if (this.ownerRef && !this.ownerRef.dead) {
                if (this.ownerRef.ownedDrone === this) {
                    this.ownerRef.ownedDrone = null;
                    this.ownerRef.opState = 'rifle';
                }
            }

        } catch (e) { console.error("Explode error:", e); }
    }

    attack(target) {
        if (!game || !game.projectiles) return;
        if (target && target.stats && target.stats.invulnerable) return;
        const id = this.stats.id;
        let dmg = this.stats.damage;

        if (target?.stats?.type === 'air' && this.stats.damageAir != null) {
            dmg = this.stats.damageAir;
        }
        if (target?.stats?.type !== 'air' && this.stats.damageGround != null) {
            dmg = this.stats.damageGround;
        }

        if (id === 'humvee' && target.stats && target.stats.type === 'air') {
            dmg = Math.max(1, Math.floor(dmg * 0.2));
        }
        if (['aa_tank', 'turret'].includes(id) && target.stats && target.stats.id === 'bomber') {
            dmg *= 1.6;
        }
        if (this.stunTimer > 0) return;

        // [?섏젙] 諛쒖궗泥?????ㅼ젙 (釉붾옓?명겕 異붽?)
        let type = 'bullet';
        if (['spg'].includes(id)) type = 'artillery';
        else if (['mbt'].includes(id)) type = 'shell';
        else if (['apache', 'rpg'].includes(id)) type = 'rocket';
        else if (['aa_tank', 'turret'].includes(id)) type = 'aa_shell';
        else if (['humvee', 'apc', 'blackhawk', 'fighter'].includes(id)) type = 'machinegun';

        // 총소리 재생 (유닛 타입별)
        if (typeof AudioSystem !== 'undefined' && Math.random() < 0.3) {
            if (id === 'infantry') AudioSystem.playGun('infantry');
            else if (id === 'special_forces') AudioSystem.playGun('special');
            else if (id === 'humvee' || id === 'apc') AudioSystem.playGun('machine_gun');
            else if (id === 'aa_tank') AudioSystem.playGun('flak');
            else AudioSystem.playSFX('shoot');
        }

        try {
            game.projectiles.push(new Projectile(this.x, this.y - this.height / 2, target, dmg, this.team, type));
        } catch (e) { }
    }

    draw(ctx) {
        if (this.dead) return;
        ctx.save();
        ctx.translate(this.x, this.y);

        // ... (?꾩닠 ?쒕줎 ?쎌삩 諛뺤뒪 肄붾뱶??洹몃?濡??좎?) ...
        if (this.stats.id === 'tactical_drone' && this.lockedTarget && !this.lockedTarget.dead) {
            ctx.save();
            ctx.translate(-this.x, -this.y);
            const tx = this.lockedTarget.x;
            const ty = this.lockedTarget.y - (this.lockedTarget.height ? this.lockedTarget.height / 2 : 0);
            ctx.strokeStyle = '#ef4444';
            ctx.lineWidth = 2;
            ctx.setLineDash([4, 2]);
            ctx.strokeRect(tx - 20, ty - 20, 40, 40);
            ctx.fillStyle = '#ef4444';
            ctx.font = 'bold 10px sans-serif';
            ctx.fillText("LOCK ON", tx - 22, ty - 25);
            ctx.restore();
        }

        // [NEW] Unit facing based on movement direction
        if (this.facing == null) this.facing = (this.team === 'player') ? 1 : -1;

        // Update facing based on movement target (retreat/move included)
        const fxTarget = (this.commandMode === 'move' && this.commandTargetX != null)
            ? this.commandTargetX
            : this.targetX;

        if (fxTarget != null && Math.abs(fxTarget - this.x) > 1) {
            this.facing = (fxTarget < this.x) ? -1 : 1;
        } else if (this.returnToBase) {
            this.facing = (this.team === 'player') ? -1 : 1;
        }

        // [FIX] facing fallback: when no clear target, use real movement delta
        if (this._faceLastX == null) this._faceLastX = this.x;
        const dxFace = this.x - this._faceLastX;
        if (Math.abs(dxFace) > 0.5) {
            this.facing = dxFace > 0 ? 1 : -1;
            this._faceLastX = this.x;
        }

        // Apply facing scale
        ctx.scale(this.facing, 1);
        // [R 2.2] ?좊떅 ?됱긽 ?듭씪 (?덉쇅: blackhawk, chinook, special_forces)
        const colorExceptions = ['blackhawk', 'chinook', 'special_forces'];
        if (colorExceptions.includes(this.stats.id)) {
            ctx.fillStyle = this.stats.color;
        } else {
            ctx.fillStyle = this.team === 'player' ? '#3b82f6' : '#ef4444';
        }

        const id = this.stats.id;

        // [湲곗〈 ?좊떅 洹몃━湲?肄붾뱶 ?좎?, 釉붾옓?명겕/移섎늻?щ쭔 ?섏젙]
        // [NEW] Worker 유닛 렌더링
        if (id === 'worker') {
            // 몸통 (노란색 조끼)
            ctx.fillStyle = '#facc15';
            ctx.fillRect(-7, -22, 14, 22);
            // 머리
            ctx.fillStyle = this.team === 'player' ? '#3b82f6' : '#ef4444';
            ctx.beginPath();
            ctx.arc(0, -26, 5, 0, Math.PI * 2);
            ctx.fill();
            // 헬멧
            ctx.fillStyle = '#f59e0b';
            ctx.beginPath();
            ctx.arc(0, -27, 6, Math.PI, 0);
            ctx.fill();
            // 도구 (망치/렌치)
            ctx.fillStyle = '#64748b';
            ctx.fillRect(6, -18, 8, 4);
            ctx.fillRect(12, -20, 3, 8);
        }
        else if (id === 'infantry') { ctx.fillRect(-6, -20, 12, 20); ctx.beginPath(); ctx.arc(0, -24, 5, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = '#1e293b'; ctx.fillRect(2, -18, 10, 3); }
        else if (id === 'rpg') { ctx.fillRect(-5, -18, 10, 18); ctx.beginPath(); ctx.arc(0, -22, 4, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = '#334155'; ctx.fillRect(-2, -24, 12, 6); ctx.fillStyle = '#7f1d1d'; ctx.fillRect(8, -24, 4, 6); }
        else if (id === 'special_forces') { ctx.fillStyle = '#171717'; ctx.fillRect(-7, -22, 14, 22); ctx.fillStyle = '#1e293b'; ctx.fillRect(-7, -22, 14, 10); ctx.beginPath(); ctx.arc(0, -26, 5, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = '#10b981'; ctx.beginPath(); ctx.arc(-2, -26, 1.5, 0, Math.PI * 2); ctx.arc(2, -26, 1.5, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = '#000'; ctx.fillRect(4, -18, 12, 4); }
        else if (id === 'humvee') { const bc = this.team === 'player' ? '#3b82f6' : '#ef4444'; ctx.fillStyle = bc; ctx.fillRect(-20, -15, 40, 15); ctx.fillStyle = '#1e293b'; ctx.beginPath(); ctx.moveTo(-10, -15); ctx.lineTo(-5, -25); ctx.lineTo(10, -25); ctx.lineTo(15, -15); ctx.fill(); ctx.fillStyle = '#000'; ctx.beginPath(); ctx.arc(-12, 0, 6, 0, Math.PI * 2); ctx.arc(12, 0, 6, 0, Math.PI * 2); ctx.fill(); }
        else if (id === 'mbt') { ctx.fillRect(-25, -15, 50, 15); ctx.fillStyle = '#1e293b'; ctx.fillRect(-15, -25, 30, 10); ctx.fillRect(0, -23, 40, 4); ctx.fillStyle = '#000'; ctx.fillRect(-28, -5, 56, 5); }
        else if (id === 'spg') { ctx.fillRect(-25, -20, 50, 20); ctx.fillStyle = '#1e293b'; ctx.save(); ctx.translate(-10, -20); ctx.rotate(-Math.PI / 4); ctx.fillRect(0, -5, 45, 10); ctx.restore(); }
        else if (id === 'apache') {
            const teamColor = (this.team === 'player') ? '#3b82f6' : '#ef4444';

            // Tail Boom
            ctx.fillStyle = '#334155';
            ctx.fillRect(-40, -5, 30, 8);

            // Tail Rotor
            ctx.save();
            ctx.translate(-40, -5);
            ctx.rotate(this.rotorAngle * 3);
            ctx.fillStyle = '#000';
            ctx.fillRect(-2, -12, 4, 24);
            ctx.restore();

            // Main Body
            ctx.fillStyle = (teamColor === '#3b82f6') ? '#1e3a8a' : '#7f1d1d';
            ctx.beginPath();
            ctx.moveTo(20, 5);
            ctx.lineTo(25, -5);
            ctx.lineTo(-10, -10);
            ctx.lineTo(-15, 5);
            ctx.fill();

            // Windows (Pilot & Gunner)
            ctx.fillStyle = '#000';
            ctx.beginPath(); ctx.moveTo(12, -5); ctx.lineTo(18, -5); ctx.lineTo(16, -8); ctx.lineTo(14, -8); ctx.fill();
            ctx.beginPath(); ctx.moveTo(2, -8); ctx.lineTo(8, -8); ctx.lineTo(6, -11); ctx.lineTo(4, -11); ctx.fill();

            // Wing Stub & Weapons
            ctx.fillStyle = '#1e293b';
            ctx.fillRect(0, 0, 10, 8);
            ctx.fillStyle = '#000';
            ctx.fillRect(2, 6, 6, 4);

            // Main Rotor
            ctx.fillStyle = '#000';
            ctx.fillRect(-30, -12, 60, 3);
            ctx.fillRect(-5, -15, 10, 5); // Rotor Mast
        }

        else if (id === 'blackhawk') {
            // [?섏젙] 釉붾옓?명겕: ?꾨줈?좊윭 ?쇱옄 (??
            ctx.fillStyle = '#111827';
            ctx.beginPath(); ctx.moveTo(15, -5); ctx.lineTo(-25, -5); ctx.lineTo(-35, -15); ctx.lineTo(-25, 5); ctx.lineTo(10, 10); ctx.lineTo(20, 5); ctx.fill();
            ctx.fillStyle = '#0f172a'; ctx.fillRect(-10, -5, 25, 12); // 肄뺥븦

            // 硫붿씤 濡쒗꽣 (?쇱옄)
            ctx.fillStyle = '#000';
            ctx.save();
            ctx.translate(-5, -12);
            // ?뚯쟾 ?④낵: ?덈퉬媛 以꾩뼱?ㅼ뿀???섏뼱?щ떎 ??
            const rotorScale = Math.abs(Math.sin(this.rotorAngle * 2));
            ctx.fillRect(-45, -2, 90, 4);
            ctx.restore();

            // 瑗щ━ 濡쒗꽣
            ctx.save();
            ctx.translate(-35, -15);
            ctx.rotate(this.rotorAngle * 3);
            ctx.fillStyle = '#333';
            ctx.fillRect(-1, -10, 2, 20);
            ctx.restore();
        }
        else if (id === 'chinook') {
            // Chinook body
            ctx.fillStyle = '#4b5563';
            ctx.beginPath();
            ctx.moveTo(-30, -10); ctx.lineTo(30, -10); ctx.lineTo(35, 5);
            ctx.lineTo(35, 5); ctx.lineTo(-35, 5); ctx.lineTo(-35, -20);
            ctx.fill();
            ctx.fillStyle = '#1f2937';
            ctx.fillRect(-25, 5, 8, 4);
            ctx.fillRect(15, 5, 8, 4);

            // [FIX] Rotors: 怨좎젙 ?쇱옄 (?뚯쟾 ?쒓굅)
            ctx.fillStyle = '#000';
            // Front rotor
            ctx.save();
            ctx.translate(-35, -20);
            ctx.fillRect(-40, -2, 80, 4);
            ctx.restore();
            // Back rotor
            ctx.save();
            ctx.translate(35, -20);
            ctx.fillRect(-40, -2, 80, 4);
            ctx.restore();
        }
        else if (id === 'apc') { const bc = this.team === 'player' ? '#3b82f6' : '#ef4444'; ctx.fillStyle = bc; ctx.fillRect(-20, -16, 40, 16); ctx.fillStyle = '#1e293b'; ctx.fillRect(-15, -22, 30, 6); ctx.fillStyle = '#000'; ctx.beginPath(); ctx.arc(-12, 0, 6, 0, Math.PI * 2); ctx.arc(0, 0, 6, 0, Math.PI * 2); ctx.arc(12, 0, 6, 0, Math.PI * 2); ctx.fill(); }
        else if (id === 'aa_tank') { ctx.fillRect(-22, -14, 44, 14); ctx.fillStyle = '#1e293b'; ctx.fillRect(-12, -22, 24, 8); ctx.save(); ctx.translate(0, -22); ctx.rotate(-Math.PI / 3); ctx.fillRect(-2, -12, 4, 12); ctx.fillRect(4, -12, 4, 12); ctx.restore(); ctx.fillStyle = '#000'; ctx.fillRect(-24, -4, 48, 4); }
        else if (id === 'fighter') { const bc = this.team === 'player' ? '#3b82f6' : '#ef4444'; ctx.fillStyle = bc; ctx.beginPath(); ctx.moveTo(32, -8); ctx.lineTo(-16, -14); ctx.lineTo(-24, -8); ctx.lineTo(-16, -2); ctx.fill(); ctx.fillStyle = '#1e293b'; ctx.beginPath(); ctx.moveTo(4, -8); ctx.lineTo(-8, -18); ctx.lineTo(-16, -8); ctx.fill(); }
        // [R 4.2 FIX] 자폭드론 - 쿼드(네모) 디자인 (약한 폭발)
        else if (id === 'drone_suicide') {
            const teamColor = this.team === 'player' ? '#3b82f6' : '#ef4444';
            // 스케일 다운
            ctx.save();
            ctx.scale(0.35, 0.35);

            // 본체
            ctx.fillStyle = '#475569'; ctx.fillRect(-12, -8, 24, 12);
            ctx.fillStyle = teamColor; ctx.fillRect(-12, -2, 24, 3);  // 팀 컬러 띠
            ctx.fillStyle = '#1e293b'; ctx.fillRect(-20, -4, 40, 4);  // 로터 암
            // 로터 (좌/우 - 흐릿한 회전 효과)
            const rotorAlpha = 0.3 + Math.abs(Math.sin(this.rotorAngle * 5)) * 0.5;
            ctx.save(); ctx.translate(-18, -6);
            ctx.fillStyle = '#cbd5e1'; ctx.fillRect(-1, -4, 2, 4);
            ctx.fillStyle = `rgba(0,0,0,${rotorAlpha})`; ctx.fillRect(-10, -5, 20, 2);
            ctx.restore();
            ctx.save(); ctx.translate(18, -6);
            ctx.fillStyle = '#cbd5e1'; ctx.fillRect(-1, -4, 2, 4);
            ctx.fillStyle = `rgba(0,0,0,${rotorAlpha + 0.1})`; ctx.fillRect(-10, -5, 20, 2);
            ctx.restore();
            // 하단 폭발물
            ctx.fillStyle = '#ef4444'; ctx.fillRect(-4, 4, 8, 4);

            ctx.restore();
        }
        // [R 4.2 FIX] 대전차드론 - 고정익(흰색) 디자인 (전술급 큰 폭발)
        else if (id === 'drone_at') {
            const teamColor = this.team === 'player' ? '#3b82f6' : '#ef4444';
            // 스케일 다운
            ctx.save();
            ctx.scale(0.35, 0.35);

            // 몸체 (흰색 계열)
            ctx.fillStyle = '#e2e8f0';
            ctx.beginPath();
            ctx.moveTo(20, 2);
            ctx.bezierCurveTo(20, -10, 0, -10, -20, -2);
            ctx.lineTo(-20, 2);
            ctx.bezierCurveTo(0, 8, 20, 8, 20, 2);
            ctx.fill();
            // 꼬리 날개
            ctx.fillStyle = '#94a3b8';
            ctx.beginPath(); ctx.moveTo(-15, -2); ctx.lineTo(-25, -12); ctx.lineTo(-20, -2); ctx.fill();
            ctx.beginPath(); ctx.moveTo(-15, 2); ctx.lineTo(-25, 12); ctx.lineTo(-20, 2); ctx.fill();
            // 후방 프로펠러 (회전)
            ctx.save();
            ctx.translate(-22, 0);
            ctx.rotate(this.rotorAngle * 5);
            ctx.fillStyle = '#000';
            ctx.fillRect(-1, -10, 2, 20);
            ctx.restore();
            // 카메라/센서
            ctx.fillStyle = '#1e293b';
            ctx.beginPath(); ctx.arc(12, 6, 3, 0, Math.PI * 2); ctx.fill();
            // 대전차 미사일 (빨간)
            ctx.fillStyle = '#dc2626'; ctx.fillRect(-8, 5, 16, 3);
            ctx.fillStyle = '#0f172a'; ctx.fillRect(-2, 6, 6, 2);
            // 팀 식별 마크
            ctx.fillStyle = teamColor;
            ctx.beginPath(); ctx.arc(5, 0, 3, 0, Math.PI * 2); ctx.fill();

            ctx.restore();
        }
        // [R 4.2] 드론병 - laptop/rifle 모드
        else if (id === 'drone_operator') {
            const teamColor = this.team === 'player' ? '#3b82f6' : '#ef4444';
            const opState = this.opState || 'seek_cover';

            // 백팩 (공통)
            ctx.fillStyle = '#334155'; ctx.fillRect(-10, -18, 6, 14);

            // 몸통 (팀색)
            ctx.fillStyle = teamColor; ctx.fillRect(-6, -20, 12, 20);

            // 머리
            ctx.beginPath(); ctx.arc(0, -24, 5, 0, Math.PI * 2); ctx.fill();

            // 모자
            ctx.fillStyle = '#334155';
            ctx.beginPath(); ctx.arc(0, -25, 5, Math.PI, 0); ctx.fill();
            ctx.fillRect(4, -27, 5, 2);

            if (opState === 'laptop') {
                // 노트북 베이스
                ctx.fillStyle = '#0f172a'; ctx.fillRect(4, -16, 10, 2);
                // 노트북 화면
                ctx.save();
                ctx.translate(14, -16);
                ctx.rotate(Math.PI / 10);
                ctx.fillStyle = '#0f172a'; ctx.fillRect(0, -10, 2, 10);
                ctx.fillStyle = '#38bdf8'; ctx.fillRect(0, -9, 1, 8);  // 화면 빛
                ctx.restore();
                // 팔 (받침)
                ctx.fillStyle = teamColor; ctx.fillRect(0, -18, 6, 4);
            } else {
                // 소총 모드 (rifle / seek_cover)
                ctx.fillStyle = '#0f172a';
                ctx.fillRect(2, -15, 12, 3);  // 총몸 + 총열
                ctx.fillRect(2, -14, 4, 5);   // 탄창/손잡이
                ctx.fillRect(-2, -14, 4, 2);  // 개머리판 연결부
                // 팔 (총 잡음)
                ctx.fillStyle = teamColor; ctx.fillRect(0, -16, 8, 3);
            }
        }
        else if (id === 'tactical_drone') { const bc = this.team === 'player' ? '#3b82f6' : '#ef4444'; ctx.fillStyle = bc; ctx.beginPath(); ctx.moveTo(10, 0); ctx.lineTo(-5, 6); ctx.lineTo(-2, 0); ctx.lineTo(-5, -6); ctx.fill(); }
        else if (id === 'emp') { ctx.strokeStyle = '#3b82f6'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(0, 0, 15, 0, Math.PI * 2); ctx.stroke(); ctx.fillStyle = '#3b82f6'; ctx.beginPath(); ctx.moveTo(-5, -8); ctx.lineTo(8, -2); ctx.lineTo(-2, 2); ctx.lineTo(6, 10); ctx.lineTo(-8, 4); ctx.lineTo(2, 0); ctx.fill(); }
        else if (id === 'nuke') { ctx.fillStyle = '#ef4444'; ctx.beginPath(); ctx.arc(0, 0, 15, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = '#000'; ctx.beginPath(); ctx.moveTo(0, 0); ctx.arc(0, 0, 12, 0, Math.PI / 3); ctx.lineTo(0, 0); ctx.moveTo(0, 0); ctx.arc(0, 0, 12, 2 * Math.PI / 3, Math.PI); ctx.lineTo(0, 0); ctx.moveTo(0, 0); ctx.arc(0, 0, 12, 4 * Math.PI / 3, 5 * Math.PI / 3); ctx.lineTo(0, 0); ctx.fill(); ctx.fillStyle = '#facc15'; ctx.beginPath(); ctx.arc(0, 0, 4, 0, Math.PI * 2); ctx.fill(); }
        else if (id === 'tactical_missile') { ctx.fillStyle = '#e5e7eb'; ctx.fillRect(-12, -3, 24, 6); ctx.fillStyle = '#ef4444'; ctx.beginPath(); ctx.moveTo(12, -3); ctx.lineTo(18, 0); ctx.lineTo(12, 3); ctx.fill(); ctx.fillStyle = '#f59e0b'; ctx.beginPath(); ctx.arc(-12, 0, 4, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = '#475569'; ctx.beginPath(); ctx.moveTo(-8, -3); ctx.lineTo(-12, -8); ctx.lineTo(-12, -3); ctx.fill(); ctx.beginPath(); ctx.moveTo(-8, 3); ctx.lineTo(-12, 8); ctx.lineTo(-12, 3); ctx.fill(); }
        else if (id === 'stealth_drone') { const bc = this.team === 'player' ? '#3b82f6' : '#ef4444'; ctx.fillStyle = bc; ctx.beginPath(); ctx.moveTo(14, 0); ctx.lineTo(-10, 9); ctx.lineTo(-4, 0); ctx.lineTo(-10, -9); ctx.closePath(); ctx.fill(); ctx.fillStyle = '#0f172a'; ctx.beginPath(); ctx.ellipse(1, 0, 3.5, 2.2, 0, 0, Math.PI * 2); ctx.fill(); if (this.team === 'player' && this.targetX !== null && this.targetX !== undefined && !this.exploded) { const gx = (game && game.groundY) ? game.groundY : this.y; const tx = this.targetX; const ty = gx - 8; const dd = Math.hypot(this.x - tx, this.y - ty); if (dd > 70) { ctx.save(); ctx.translate(-this.x + tx, -this.y + ty); ctx.strokeStyle = '#ff2d2d'; ctx.lineWidth = 2; const s = 7; ctx.beginPath(); ctx.moveTo(-s, 0); ctx.lineTo(s, 0); ctx.moveTo(0, -s); ctx.lineTo(0, s); ctx.stroke(); ctx.restore(); } } }
        else if (id === 'bomber') {
            const teamColor = (this.team === 'player') ? '#3b82f6' : '#ef4444';

            ctx.fillStyle = '#334155'; // Dark Grey Body
            // Main Fuselage
            ctx.beginPath();
            ctx.moveTo(60, 0);   // Nose
            ctx.lineTo(40, -7);
            ctx.lineTo(-20, -7); // Spine
            ctx.lineTo(-40, -25); // Vertical Stabilizer Top
            ctx.lineTo(-35, -5);
            ctx.lineTo(-50, 0);  // Exhaust area
            ctx.lineTo(-45, 5);
            ctx.lineTo(20, 8);   // Belly
            ctx.fill();

            // Cockpit Window
            ctx.fillStyle = '#000';
            ctx.beginPath();
            ctx.moveTo(40, -7); ctx.lineTo(50, -2); ctx.lineTo(42, -2);
            ctx.fill();

            // Wings (Swept back)
            ctx.fillStyle = '#1e293b';
            ctx.beginPath();
            ctx.moveTo(10, -2); ctx.lineTo(-30, -2); ctx.lineTo(-40, 15); ctx.lineTo(-10, 15);
            ctx.fill();

            // Engine Pods
            ctx.fillStyle = '#0f172a';
            ctx.beginPath();
            ctx.ellipse(-20, 12, 15, 4, 0, 0, Math.PI * 2);
            ctx.fill();

            // Team Mark
            ctx.fillStyle = teamColor;
            ctx.fillRect(-10, -4, 15, 3);
        }

        if (!this.hideHp && this.hp < this.maxHp) {
            const hpPct = Math.max(0, this.hp / this.maxHp);
            const w = 24; const h = 4; const yOffset = -35;
            ctx.fillStyle = '#ef4444'; ctx.fillRect(-w / 2, yOffset, w, h);
            ctx.fillStyle = '#22c55e'; ctx.fillRect(-w / 2, yOffset, w * hpPct, h);
            ctx.strokeStyle = '#000'; ctx.lineWidth = 0.5; ctx.strokeRect(-w / 2, yOffset, w, h);
        }
        ctx.restore();
    }
}

// Projectile class moved to projectiles.js

class Particle {
    constructor(x, y, color) {
        this.x = x; this.y = y; this.color = color; this.life = 1.0;
        this.vx = (Math.random() - 0.5) * 8; this.vy = (Math.random() - 0.5) * 8;
    }
    update() { this.x += this.vx; this.y += this.vy; this.life -= 0.05; }
    draw(ctx) {
        ctx.globalAlpha = Math.max(0, this.life); ctx.fillStyle = this.color;
        ctx.beginPath(); ctx.arc(this.x, this.y, Math.random() * 4, 0, 7); ctx.fill(); ctx.globalAlpha = 1;
    }
}

// [NEW] Building Destruction FX (HQ/Defense)
class BuildingDestructionFX {
    constructor(x, y, w, h, team, kind = 'defense') {
        this.x = x;
        this.y = y;
        this.w = Math.max(20, w || 60);
        this.h = Math.max(20, h || 60);
        this.team = team;
        this.kind = kind;

        // life: used by game.particles filter (life > 0)
        this.life = (kind === 'hq') ? 2.0 : 1.4;

        // debris pieces
        const pieceCount = (kind === 'hq') ? 28 : 14;
        this.pieces = [];
        for (let i = 0; i < pieceCount; i++) {
            const px = (Math.random() - 0.5) * this.w * 0.9;
            const py = -Math.random() * this.h * 0.7;
            const s = 4 + Math.random() * (kind === 'hq' ? 10 : 6);
            this.pieces.push({
                x: px, y: py,
                vx: (Math.random() - 0.5) * (kind === 'hq' ? 10 : 7),
                vy: -Math.random() * (kind === 'hq' ? 10 : 7),
                r: Math.random() * Math.PI * 2,
                vr: (Math.random() - 0.5) * 0.4,
                s
            });
        }

        this._flash = 1.0;
        this._smokeTick = 0;
    }

    update() {
        this.life -= 0.03;
        if (this._flash > 0) this._flash -= 0.12;

        const g = 0.6;
        for (const p of this.pieces) {
            p.vy += g;
            p.x += p.vx;
            p.y += p.vy;
            p.r += p.vr;

            // bounce near ground
            if (p.y > 10) {
                p.y = 10;
                p.vy *= -0.25;
                p.vx *= 0.6;
            }
        }

        this._smokeTick++;
    }

    draw(ctx) {
        if (this.life <= 0) return;

        ctx.save();
        ctx.translate(this.x, this.y);

        const maxLife = (this.kind === 'hq') ? 2.0 : 1.4;
        const fade = Math.max(0, Math.min(1, this.life / maxLife));

        // flash
        if (this._flash > 0) {
            ctx.globalAlpha = Math.min(0.9, this._flash) * 0.8;
            ctx.fillStyle = '#fff';
            ctx.beginPath();
            ctx.arc(0, -this.h * 0.55, (this.kind === 'hq' ? 90 : 55) * this._flash, 0, Math.PI * 2);
            ctx.fill();
        }

        // smoke
        if (this._smokeTick % 3 === 0) {
            ctx.globalAlpha = 0.25 * fade;
            ctx.fillStyle = '#111';
            for (let i = 0; i < (this.kind === 'hq' ? 4 : 2); i++) {
                const sx = (Math.random() - 0.5) * this.w * 1.2;
                const sy = -this.h * (0.2 + Math.random() * 0.8);
                const sr = 10 + Math.random() * (this.kind === 'hq' ? 26 : 18);
                ctx.beginPath();
                ctx.arc(sx, sy, sr, 0, Math.PI * 2);
                ctx.fill();
            }
        }

        // debris
        ctx.globalAlpha = 0.85 * fade;
        ctx.fillStyle = (this.team === 'player') ? '#334155' : '#3f1d1d';
        for (const p of this.pieces) {
            ctx.save();
            ctx.translate(p.x, p.y);
            ctx.rotate(p.r);
            ctx.fillRect(-p.s * 0.5, -p.s * 0.5, p.s, p.s);
            ctx.restore();
        }

        // scorch mark
        ctx.globalAlpha = 0.35 * fade;
        ctx.fillStyle = '#000';
        ctx.beginPath();
        ctx.ellipse(0, 5, this.w * 0.6, 10, 0, 0, Math.PI * 2);
        ctx.fill();

        ctx.restore();
        ctx.globalAlpha = 1;
    }
}
