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
        // [FIX] Invalid Unit Type Safety (must resolve before super)
        const hasConfig = (typeof CONFIG !== 'undefined' && CONFIG && CONFIG.units);
        let safeKey = typeKey;
        if (!hasConfig || !CONFIG.units[typeKey]) {
            console.warn(`Unit type '${typeKey}' not found! Defaulting to 'infantry'`);
            safeKey = 'infantry';
        }
        const stats = (hasConfig && CONFIG.units[safeKey]) ? CONFIG.units[safeKey] : {
            id: safeKey,
            name: safeKey,
            hp: 1,
            width: 10,
            height: 10,
            type: 'bio',
            category: 'infantry',
            speed: 0,
            range: 0,
            damage: 0
        };

        let startY = groundY;
        // Air lanes: move aerial combat higher into the sky.
        if (stats.id === 'stealth_drone') {
            startY = groundY - 440 - Math.random() * 70;
        } else if (stats.id === 'bomber') {
            startY = groundY - 330 - Math.random() * 100;
        } else if (stats.id === 'fighter' || stats.id === 'recon') {
            startY = groundY - 280 - Math.random() * 90;
        } else if (stats.id === 'apache' || stats.id === 'blackhawk' || stats.id === 'chinook' || stats.id === 'uh60') {
            startY = groundY - 220 - Math.random() * 70;
        // [R 4.2 FIX v4] 자폭/대전차 드론은 발밑에서 시작 (상승 애니메이션용)
        } else if (stats.id === 'drone_suicide' || stats.id === 'drone_at') {
            startY = groundY;
        } else if (stats.type === 'air') {
            startY = groundY - 240 - Math.random() * 90;
        }

        super(x, startY, team, stats.hp, stats.width, stats.height);
        this.typeKey = safeKey;
        this.stats = stats;
        this.lastAttack = 0;
        this.lastMGAttack = 0;
        this._mgLastShotFrame = -9999;
        this._mgAudio = null;
        this.lastBomb = 0;
        this.rotorAngle = 0;
        this.lockedTarget = lockedTarget;
        this.stunTimer = 0;
        const isDroneUnit = (stats.category === 'drone' || (stats.id && stats.id.includes('drone'))) && !stats.operator;
        this.evasion = isDroneUnit; // [NEW] Drone Evasion Flag
        this.deployed = false; // [NEW] APC ??뤾컧 ???
        this.returnToBase = false;
        this.attackTarget = null; // [OPTIMIZATION] Sticky Targeting
        this.flareUsed = false; // [NEW] Air units can flare once
        this.exiting = false; // [NEW] Transport exit state
        this.targetX = null;
        this.targetY = null;
        this.disableFeetSnap = false;
        this.skipDeathSound = false;
        this.recoil = 0;
        this.missileFlash = 0;
        this.engineerAimTarget = null;
        this.engineerAimTimer = 0;
        // [P0] 타겟 탐색 주기(프레임) - 유닛별로 분산
        this.targetScanInterval = Number.isFinite(stats.targetScanInterval) ? stats.targetScanInterval : this.getTargetScanInterval(stats);
        const baseFrame = (typeof game !== 'undefined' && Number.isFinite(game.frame)) ? game.frame : 0;
        this.nextTargetScanFrame = baseFrame + Math.floor(Math.random() * this.targetScanInterval);

        // [R 4.2 FIX v3] facing 초기화 (draw에서 계산 금지)
        this.facing = (team === 'player') ? 1 : -1;

        if (this.stats && this.stats.civilian) {
            this.hideHp = true;
            this.disableFeetSnap = true;
            this.panicTimer = 0;
            this.wanderTimer = 0;
            this.wanderTargetX = null;
            this.animFrame = 0;
        }

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

        // [NEW] 특수부대 연막탄 (1회)
        if (stats.id === 'special_forces') {
            this.smokeChargesLeft = 1;
            this.smokeAiTimer = 60 + Math.floor(Math.random() * 240);
        }

        // [NEW] 미사일 특수 명령 초기화 (기본 1회)
        const hasMissileCommand = (
            stats.missileCommand === true
            || stats.canUseMissileCommand === true
            || (typeof stats.specialCommand === 'string' && stats.specialCommand.trim().toLowerCase() === 'missile')
            || (Array.isArray(stats.specialCommands) && stats.specialCommands.some(cmd => String(cmd || '').trim().toLowerCase() === 'missile'))
            || (typeof stats.id === 'string' && stats.id.trim().toLowerCase().includes('fighter'))
        );
        if (hasMissileCommand) {
            const missileCount = Math.max(0, Math.floor(Number(stats.missileCount)));
            this.missileChargesLeft = Number.isFinite(missileCount) ? missileCount : 1;
            this.lastFighterMissile = -9999;
        }

        if (stats.id === 'icbm' || stats.id === 'icbm_enemy') {
            this.commandMode = 'stop';
            this.icbmAngle = 0;
            this.icbmLaunchState = 'idle';
            this.icbmLaunchTimer = 0;
            this.icbmLaunchRequest = null;
            this.icbmHasFired = false;
            this.icbmMuzzleFlash = 0;
            this.icbmRaiseSoundPlaying = false;
            // ICBM는 스프라이트 방향을 고정한다. (아군/적군 전용 모델 분리)
            this.facing = (stats.id === 'icbm') ? -1 : 1;
            if (stats.id === 'icbm_enemy') {
                // 적 ICBM: 발사할 때마다 전진 스텝을 한 칸씩 올린다.
                this.enemyIcbmAdvanceStep = 0;
                this.enemyIcbmMaxStep = 4;
                this.enemyIcbmSettleFrames = 20;
            }
        }

        // [NEW] 수송 유닛 하차 설정
        if (['blackhawk', 'chinook', 'apc', 'humvee'].includes(stats.id)) {
            this.transportDropsLeft = 1;
            this.transportDropManifest = null;
            if (stats.id === 'chinook') {
                this.transportDropManifest = [
                    { type: 'special_forces', count: 4 }, // 보병
                    { type: 'engineer', count: 1 },       // RPG병
                    { type: 'sniper', count: 1 },         // 저격수
                    { type: 'special_ops', count: 2 }     // 특수부대
                ];
                this.transportDropType = 'special_forces';
                this.transportDropCount = 8;
            } else if (stats.id === 'blackhawk') {
                this.transportDropType = 'special_forces';
                this.transportDropCount = 4;
            } else if (stats.id === 'apc') {
                this.transportDropType = 'special_forces';
                this.transportDropCount = 4;
            } else if (stats.id === 'humvee') {
                this.transportDropType = 'special_forces';
                this.transportDropCount = 2;
            }
            this.dropState = null; // approach | landing | dropping | takeoff
            this.dropTargetX = null;
            this.dropTimer = 0;
            this.dropCooldown = 0;
            this._dropResume = null;
            this._dropSpawned = false;
            if (stats.type === 'air') {
                this.cruiseY = this.y;
            }
        }
    }

    // [P0] 타겟 탐색 간격: 6~12프레임 사이로 유닛 타입/사거리별 분산
    getTargetScanInterval(stats) {
        const s = stats || this.stats || {};
        const range = Number(s.range) || 200;
        let base = 6;
        if (range >= 500) base = 12;
        else if (range >= 400) base = 10;
        else if (range >= 300) base = 9;
        else if (range >= 220) base = 8;
        else if (range >= 160) base = 7;

        if (s.type === 'air') base = Math.min(12, base + 1);
        if (s.id === 'spg') base = 12;

        const jitter = Math.floor(Math.random() * 2); // 0~1
        return Math.max(6, Math.min(12, base + jitter));
    }

    shouldFeetSnap() {
        if (typeof UnitRenderUtils !== 'undefined' && UnitRenderUtils.shouldFeetSnap) {
            return UnitRenderUtils.shouldFeetSnap(this);
        }
        if (this.disableFeetSnap) return false;
        if (this.lobbyPreview) return false;
        const s = this.stats || {};
        if (s.type === 'air' || s.category === 'air') return false;
        if (s.type === 'skill' || s.category === 'special') return false;
        return true;
    }

    getFeetYFromSkin(skin) {
        if (typeof UnitRenderUtils !== 'undefined' && UnitRenderUtils.getFeetYFromSkin) {
            return UnitRenderUtils.getFeetYFromSkin(skin);
        }
        return null;
    }

    getFeetYFromHardcoded() {
        if (typeof UnitRenderUtils !== 'undefined' && UnitRenderUtils.getFeetYFromHardcoded) {
            return UnitRenderUtils.getFeetYFromHardcoded(this);
        }
        return 0;
    }

    getFeetYForRender(skin) {
        if (typeof UnitRenderUtils !== 'undefined' && UnitRenderUtils.getFeetYForRender) {
            return UnitRenderUtils.getFeetYForRender(this, skin);
        }
        const fromSkin = this.getFeetYFromSkin(skin);
        if (Number.isFinite(fromSkin)) return fromSkin;
        return this.getFeetYFromHardcoded();
    }

    computeFeetSnapDy(skin) {
        if (typeof UnitRenderUtils !== 'undefined' && UnitRenderUtils.computeFeetSnapDy) {
            return UnitRenderUtils.computeFeetSnapDy(this, skin);
        }
        return 0;
    }

    takeDamage(damage, attackType = null, hitX = null, hitY = null, hitVx = null, hitVy = null, attacker = null) {
        if (this.dead) return;

        if (this.stats && this.stats.invulnerable) return;

        const isDrone = (this.stats?.id && this.stats.id.includes('drone'));
        const evade = isDrone ? (Number(this.stats?.mobility || 0) / 100) : 0;
        if (evade > 0 && Math.random() < evade) {
            if (game && game.createParticles) game.createParticles(this.x, this.y, 3, '#94a3b8');
            return;
        }

        const cleanAttackType = (typeof attackType === 'string' && attackType) ? attackType : null;
        const cleanHitX = Number.isFinite(hitX) ? hitX : null;
        const cleanHitY = Number.isFinite(hitY) ? hitY : null;
        const cleanHitVx = Number.isFinite(hitVx) ? hitVx : null;
        const cleanHitVy = Number.isFinite(hitVy) ? hitVy : null;

        // [NEW] 마지막 피격 정보 기록 (총맞음 판정/혈흔용)
        this.lastHitInfo = {
            attackType: cleanAttackType,
            hitX: cleanHitX,
            hitY: cleanHitY,
            hitVx: cleanHitVx,
            hitVy: cleanHitVy
        };

        const dmg = Number(damage) || 0;
        if (!Number.isFinite(this.hp)) this.hp = this.maxHp;
        this.hp -= dmg;
        if (this.hp < 0) this.hp = 0;

        // [NEW] 피격 프레임 기록 (이동 중 공격받으면 전투 전환용)
        this.lastDamagedFrame = game.frame;

        // [NEW] 거점(건물) 공격 중 피격되면 공격자에게 즉시 타겟 전환
        if (attacker && this.attackTarget && !this.attackTarget.stats) {
            if (attacker !== this.attackTarget && !attacker.dead) {
                const attackerTeam = attacker.team;
                if (attackerTeam && attackerTeam !== this.team && attackerTeam !== 'neutral') {
                    const attackerIsAir = !!(attacker.stats && attacker.stats.type === 'air');
                    const canHitAir = this.stats.antiAir || this.stats.type === 'air' || ['humvee', 'apc'].includes(this.stats.id);
                    const attackerInvuln = attacker.stats && attacker.stats.invulnerable;
                    if ((!attackerIsAir || canHitAir) && !attackerInvuln) {
                        this.attackTarget = attacker;
                        this.targetX = null;
                        this.commandTargetX = null;
                        this.returnToBase = false;
                    }
                }
            }
        }

        if (this.hp <= 0) {
            if (this.stats && this.stats.civilian) {
                const isNukeHit = cleanAttackType === 'nuke';
                if (!isNukeHit && typeof AudioSystem !== 'undefined' && AudioSystem.playPanicScream) {
                    AudioSystem.playPanicScream(this.x);
                }
                if (typeof game !== 'undefined' && game.triggerCivilianPanic) {
                    game.triggerCivilianPanic(240);
                }
                if (typeof game !== 'undefined' && game.handleCivilianDeath) {
                    game.handleCivilianDeath();
                }
            }
            if (this.stats && (this.stats.id === 'icbm' || this.stats.id === 'icbm_enemy') && this.icbmRaiseSoundPlaying && typeof AudioSystem !== 'undefined' && typeof AudioSystem.stopIcbmRaise === 'function') {
                AudioSystem.stopIcbmRaise();
            }
            if (this.stats && (this.stats.id === 'icbm' || this.stats.id === 'icbm_enemy')) this.icbmRaiseSoundPlaying = false;
            this.dead = true;
            if (this.stats && this.stats.id === 'mbt') {
                this._stopTankMGSound();
            }

            const unitId = this.stats?.id;
            // [NEW] 지상 수송차량 파괴 시 남은 병력 즉시 하차
            const isGroundTransport = unitId === 'apc' || unitId === 'humvee';
            if (isGroundTransport && (this.transportDropsLeft || 0) > 0) {
                const dropped = this._spawnTransportUnits ? this._spawnTransportUnits() : 0;
                if (dropped > 0) {
                    this.transportDropsLeft = 0;
                    if (typeof game !== 'undefined' && typeof game.updateHUDSelection === 'function') {
                        game.updateHUDSelection();
                    }
                }
            }
            const isCameraman = this.isCameraman || (this.stats && this.stats.isCameraman);
            if (isCameraman && typeof game !== 'undefined') {
                game.cameramanDisabled = true;
                game._activeCameraman = null;
            }

            // [NEW] 민간 차량 잔해 생성
            const isCivilianVehicle = this.stats?.category === 'civilian' && ['civ_sedan', 'civ_suv', 'civ_bus'].includes(unitId);
            if (isCivilianVehicle && typeof game !== 'undefined' && Array.isArray(game.wreckages)) {
                game.wreckages.push(new Wreckage(
                    unitId,
                    this.x,
                    this.y,
                    this.facing,
                    this.team
                ));
            }

            // [NEW] 보병/민간인 시체 생성 (보행 민간인 포함)
            const isInfantry = this.stats.category === 'infantry';
            const isCivilianHuman = this.stats.category === 'civilian' && ['civ_a', 'civ_b', 'civ_crowd'].includes(unitId);
            const noCorpseAttackTypes = new Set([
                'rocket',
                'shell',
                'aa_shell',
                'artillery',
                'bomb',
                'tactical_missile',
                'nuke',
                'engineer_missile',
                'drone_explosion',
                'explosion',
                'humvee_burst'
            ]);
            const skipCorpseByAttack = cleanAttackType && noCorpseAttackTypes.has(cleanAttackType);
            const disableCorpses = !!(typeof game !== 'undefined' && game.debug && game.debug.disableCorpses);
            if (!disableCorpses && !skipCorpseByAttack && (isInfantry || isCivilianHuman) && typeof Corpse !== 'undefined' && typeof game !== 'undefined' && Array.isArray(game.corpses)) {
                const deathInfo = {
                    attackType: cleanAttackType,
                    hitVx: cleanHitVx,
                    hitVy: cleanHitVy,
                    opState: this.opState || null
                };
                const cap = Number.isFinite(game.corpseCap) ? game.corpseCap : 0;
                const allowSpawn = cap > 0;
                if (allowSpawn) {
                    if (typeof game.enqueueCorpseSpawn === 'function') {
                        game.enqueueCorpseSpawn({
                            x: this.x,
                            y: this.y,
                            typeKey: this.typeKey,
                            facing: this.facing,
                            team: this.team,
                            deathInfo
                        });
                    } else {
                        if (game.corpses.length >= cap) {
                            if (game.corpseReplaceOldest) game.corpses.shift();
                            else return;
                        }
                        game.corpses.push(new Corpse(this.x, this.y, this.typeKey, this.facing, this.team, deathInfo));
                    }
                }
            }

            if (this.team === 'enemy') {
                game.killCount++;
                if (typeof game.onQuestMissionEvent === 'function') {
                    game.onQuestMissionEvent('kill', { count: 1 });
                }
            }

            // [P1] 유닛 종류별 사망 VFX
            if (typeof VFX !== 'undefined') {
                const id = this.stats?.id || '';
                const cat = this.stats?.category || '';
                const type = this.stats?.type || '';

                // 기갑 유닛 (탱크, APC, 험비 등) - 잔해(시체) 생성
                if (cat === 'armored') {
                    // 폭발 VFX 대신 잔해 스폰
                    if (typeof game !== 'undefined' && Array.isArray(game.wreckages)) {
                        game.wreckages.push(new Wreckage(
                            this.stats.id,
                            this.x,
                            this.y,
                            this.facing,
                            this.team
                        ));
                    }
                    // 연기만 약간 생성
                    if (typeof game !== 'undefined' && game.createParticles) {
                        game.createParticles(this.x, this.y - 10, 8, '#333');
                    }
                }
                // 항공기 (전투기, 폭격기, 아파치) - 공중 폭발
                else if (type === 'air' && ['fighter', 'apache', 'bomber'].includes(id)) {
                    VFX.spawn(game, 'aircraft', this.x, this.y, { anchorGround: false });
                }
                // 수송헬기 (블랙호크, 치누크) - 큰 공중 폭발
                else if (['blackhawk', 'chinook'].includes(id)) {
                    VFX.spawn(game, 'aircraft', this.x, this.y, { anchorGround: false });
                }
            }

            if (typeof AudioSystem !== 'undefined' && !this.skipDeathSound) {
                const airDeathIds = ['fighter', 'apache', 'blackhawk', 'uh60', 'chinook', 'bomber'];
                if (airDeathIds.includes(this.stats.id)) {
                    AudioSystem.playBoom('death_exp', this.x);
                }
            }
            this.skipDeathSound = false;
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

    isAirTransport() {
        const id = this.stats && this.stats.id;
        return id === 'blackhawk' || id === 'chinook';
    }

    isGroundTransport() {
        const id = this.stats && this.stats.id;
        return id === 'apc' || id === 'humvee';
    }

    canTransportDrop() {
        return (this.transportDropsLeft || 0) > 0;
    }

    requestAirDrop(targetX) {
        if (!this.isAirTransport()) return false;
        if (!this.canTransportDrop()) return false;
        if (!Number.isFinite(targetX)) return false;
        if (this.dropState) return false;

        this.cruiseY = Number.isFinite(this.y) ? this.y : (this.cruiseY || this.y);
        this.dropTargetX = targetX;
        this.dropState = 'approach';
        this.dropTimer = 0;
        this._dropSpawned = false;
        this._dropResume = {
            commandMode: this.commandMode,
            targetX: this.targetX,
            commandTargetX: this.commandTargetX,
            returnToBase: this.returnToBase,
            attackTarget: this.attackTarget
        };
        return true;
    }

    requestGroundDrop() {
        if (!this.isGroundTransport()) return false;
        if (!this.canTransportDrop()) return false;

        this.commandMode = 'stop';
        this.targetX = null;
        this.commandTargetX = null;
        this.attackTarget = null;

        const dropped = this._spawnTransportUnits();
        if (dropped > 0) {
            this.transportDropsLeft = Math.max(0, (this.transportDropsLeft || 0) - 1);
            if (typeof game !== 'undefined' && typeof game.updateHUDSelection === 'function') {
                game.updateHUDSelection();
            }
            return true;
        }
        return false;
    }

    _spawnTransportUnits() {
        if (typeof game === 'undefined' || typeof game.spawnUnitDirect !== 'function') return 0;
        const baseY = (typeof game !== 'undefined' && Number.isFinite(game.groundY)) ? game.groundY : this.y;
        let spawned = 0;
        const manifest = Array.isArray(this.transportDropManifest) ? this.transportDropManifest : null;
        if (manifest && manifest.length > 0) {
            for (let m = 0; m < manifest.length; m++) {
                const item = manifest[m];
                const type = String(item?.type || '').trim();
                const count = Math.max(0, Number(item?.count) || 0);
                if (!type || count <= 0) continue;
                for (let i = 0; i < count; i++) {
                    const ox = Math.random() * 40 - 20;
                    const u = game.spawnUnitDirect(type, this.x + ox, baseY, this.team);
                    if (u) spawned++;
                }
            }
            return spawned;
        }

        const type = this.transportDropType || 'infantry';
        const count = Math.max(0, Number(this.transportDropCount) || 0);
        if (count <= 0) return 0;
        for (let i = 0; i < count; i++) {
            const ox = Math.random() * 40 - 20;
            const u = game.spawnUnitDirect(type, this.x + ox, baseY, this.team);
            if (u) spawned++;
        }
        return spawned;
    }

    _restoreTransportCommand() {
        const resume = this._dropResume;
        if (!resume) return;
        this.commandMode = resume.commandMode;
        this.targetX = resume.targetX;
        this.commandTargetX = resume.commandTargetX;
        this.returnToBase = resume.returnToBase;
        this.attackTarget = resume.attackTarget;
        this._dropResume = null;
    }

    updateAirDrop() {
        if (!this.isAirTransport()) return false;
        if (!this.dropState) return false;
        if (!Number.isFinite(this.dropTargetX)) {
            this.dropState = null;
            this.dropTimer = 0;
            this._restoreTransportCommand();
            return false;
        }

        const speed = this.stats.speed || 2.5;
        const cruiseY = Number.isFinite(this.cruiseY) ? this.cruiseY : this.y;
        const landY = (typeof game !== 'undefined' && Number.isFinite(game.groundY)) ? (game.groundY - 80) : this.y;

        if (this.dropState === 'approach') {
            const dx = this.dropTargetX - this.x;
            if (Math.abs(dx) <= speed) {
                this.x = this.dropTargetX;
                this.dropState = 'landing';
            } else {
                this.x += Math.sign(dx) * speed;
            }
            this.facing = dx >= 0 ? 1 : -1;
            this.y = cruiseY;
            return true;
        }

        if (this.dropState === 'landing') {
            this.y += 2.2;
            if (this.y >= landY) {
                this.y = landY;
                this.dropState = 'dropping';
                this.dropTimer = 0;
                this._dropSpawned = false;
            }
            return true;
        }

        if (this.dropState === 'dropping') {
            this.dropTimer += 1;
            const dropDelay = 18;
            const dropHold = 36;
            if (!this._dropSpawned && this.dropTimer >= dropDelay) {
                const dropped = this._spawnTransportUnits();
                if (dropped > 0) {
                    this.transportDropsLeft = Math.max(0, (this.transportDropsLeft || 0) - 1);
                    if (typeof game !== 'undefined' && typeof game.updateHUDSelection === 'function') {
                        game.updateHUDSelection();
                    }
                }
                this._dropSpawned = true;
            }
            if (this.dropTimer >= dropHold) {
                this.dropState = 'takeoff';
                this.dropTimer = 0;
            }
            return true;
        }

        if (this.dropState === 'takeoff') {
            this.y -= 2.2;
            if (this.y <= cruiseY) {
                this.y = cruiseY;
                this.dropState = null;
                this.dropTargetX = null;
                this._dropSpawned = false;
                this._restoreTransportCommand();
            }
            return true;
        }

        return false;
    }

    isIcbmLauncherUnit() {
        const id = this.stats && this.stats.id;
        return id === 'icbm' || id === 'icbm_enemy';
    }

    isIcbmReady() {
        if (this.dead) return false;
        if (!this.isIcbmLauncherUnit()) return false;
        if (this.stunTimer > 0) return false;
        if (this.stats && this.stats.id === 'icbm_enemy') {
            if (!this.isEnemyIcbmAnchoredReady()) return false;
        }
        return (this.icbmLaunchState || 'idle') === 'idle' && !this.icbmLaunchRequest;
    }

    _getEnemyIcbmAnchorPlan() {
        let rearX = (typeof CONFIG !== 'undefined' && Number.isFinite(CONFIG.mapWidth))
            ? (CONFIG.mapWidth - 180)
            : (this.x || 0);
        const enemyHq = (typeof game !== 'undefined' && Array.isArray(game.buildings))
            ? game.buildings.find(b => b && !b.dead && b.type === 'hq_enemy')
            : null;
        const enemyFort = (typeof game !== 'undefined' && Array.isArray(game.buildings))
            ? game.buildings.find(b => b && !b.dead && b.type === 'fortress_enemy')
            : null;

        if (enemyHq && Number.isFinite(enemyHq.x)) rearX = enemyHq.x - 140;

        let frontX = rearX - 280;
        if (enemyFort && Number.isFinite(enemyFort.x)) {
            frontX = Math.min(frontX, enemyFort.x - 80);
        }
        frontX = Math.max(220, frontX);
        if (frontX > rearX - 50) frontX = rearX - 50;

        const steps = Math.max(1, Math.floor(Number(this.enemyIcbmMaxStep) || 4));
        return { rearX, frontX, steps };
    }

    _getEnemyIcbmStageX(step = 0) {
        const plan = this._getEnemyIcbmAnchorPlan();
        const s = Math.max(0, Math.min(plan.steps, Math.floor(Number(step) || 0)));
        const t = (plan.steps <= 0) ? 0 : (s / plan.steps);
        return plan.rearX + ((plan.frontX - plan.rearX) * t);
    }

    isEnemyIcbmAnchoredReady() {
        if (!this.stats || this.stats.id !== 'icbm_enemy') return true;
        const step = Math.max(0, Math.floor(Number(this.enemyIcbmAdvanceStep) || 0));
        const targetX = this._getEnemyIcbmStageX(step);
        const settled = (Number(this.enemyIcbmSettleFrames) || 0) <= 0;
        return settled && Math.abs(targetX - this.x) <= 8;
    }

    _advanceEnemyIcbmStepAfterShot() {
        if (!this.stats || this.stats.id !== 'icbm_enemy') return;
        const maxStep = Math.max(1, Math.floor(Number(this.enemyIcbmMaxStep) || 4));
        const cur = Math.max(0, Math.floor(Number(this.enemyIcbmAdvanceStep) || 0));
        this.enemyIcbmAdvanceStep = Math.min(maxStep, cur + 1);
        // 다음 발사 전, 새 자리에서 잠깐 고정 시간을 준다.
        this.enemyIcbmSettleFrames = 28;
    }

    requestIcbmLaunch(payloadKey, targetX, targetY) {
        if (!this.isIcbmReady()) return false;
        if (!['nuke', 'tactical_missile', 'emp'].includes(payloadKey)) return false;

        const tyDefault = (typeof game !== 'undefined' && Number.isFinite(game.groundY)) ? game.groundY : this.y;
        this.icbmLaunchRequest = {
            payloadKey,
            targetX: Number.isFinite(Number(targetX)) ? Number(targetX) : this.x,
            targetY: Number.isFinite(Number(targetY)) ? Number(targetY) : tyDefault
        };
        this.icbmLaunchState = 'raising';
        this.icbmLaunchTimer = 0;
        this.icbmHasFired = false;
        this.icbmRaiseSoundPlaying = false;
        this.commandMode = 'stop';
        this.targetX = null;
        this.attackTarget = null;
        this.lockedTarget = null;
        return true;
    }

    getIcbmMuzzleWorldPosition() {
        const facing = Number.isFinite(this.facing) ? this.facing : (this.team === 'player' ? 1 : -1);
        const angleDeg = Math.max(0, Math.min(90, Number(this.icbmAngle) || 0));
        const rad = angleDeg * Math.PI / 180;
        const SCALE = 0.44;
        const TEL_WIDTH = 360;
        const TEL_HEIGHT = 50;
        const WHEEL_RADIUS = 16;
        const centerX = TEL_WIDTH / 2;
        const groundRef = TEL_HEIGHT + WHEEL_RADIUS * 2;
        const pivotRawX = 340;
        const pivotRawY = 10;
        const canLength = 230;
        const muzzleRawX = pivotRawX + Math.cos(rad) * (-canLength);
        const muzzleRawY = pivotRawY + Math.sin(rad) * (-canLength);
        const localX = (muzzleRawX - centerX) * SCALE;
        const localY = (muzzleRawY - groundRef) * SCALE;
        return {
            x: this.x + facing * localX,
            y: this.y + localY
        };
    }

    updateIcbmLauncher() {
        if (!this.isIcbmLauncherUnit()) return false;

        if (this.icbmMuzzleFlash > 0) {
            this.icbmMuzzleFlash = Math.max(0, this.icbmMuzzleFlash - 1);
        }

        const state = this.icbmLaunchState || 'idle';
        if (state === 'idle') return false;

        this.commandMode = 'stop';
        this.targetX = null;
        this.attackTarget = null;

        if (!this.icbmLaunchRequest) {
            if (this.icbmRaiseSoundPlaying && typeof AudioSystem !== 'undefined' && typeof AudioSystem.stopIcbmRaise === 'function') {
                AudioSystem.stopIcbmRaise();
            }
            this.icbmRaiseSoundPlaying = false;
            this.icbmLaunchState = 'idle';
            this.icbmAngle = 0;
            this.icbmLaunchTimer = 0;
            this.icbmHasFired = false;
            return false;
        }

        if (state === 'raising') {
            if (!this.icbmRaiseSoundPlaying && typeof AudioSystem !== 'undefined' && typeof AudioSystem.startIcbmRaise === 'function') {
                AudioSystem.startIcbmRaise(this.x);
                this.icbmRaiseSoundPlaying = true;
            }
            if (this.icbmRaiseSoundPlaying && typeof AudioSystem !== 'undefined' && typeof AudioSystem.syncIcbmRaise === 'function') {
                AudioSystem.syncIcbmRaise(this.x);
            }
            // C-05: ICBM 포대 상승 구간을 더 길게 가져가 발사 전 준비시간을 늘린다.
            const ICBM_RAISE_STEP_DEG = 0.34;
            const ICBM_PRELAUNCH_HOLD_FRAMES = 24;
            this.icbmAngle = Math.min(90, (this.icbmAngle || 0) + ICBM_RAISE_STEP_DEG);
            if (this.icbmAngle >= 90) {
                this.icbmLaunchState = 'firing';
                this.icbmLaunchTimer = ICBM_PRELAUNCH_HOLD_FRAMES;
            }
            this.updateFacing();
            return true;
        }

        if (state === 'firing') {
            this.icbmLaunchTimer = Math.max(0, (this.icbmLaunchTimer || 0) - 1);
            if (this.icbmLaunchTimer <= 0) {
                if (!this.icbmHasFired) {
                    this.icbmHasFired = true;
                    this.icbmMuzzleFlash = 8;
                    if (this.stats && this.stats.id === 'icbm_enemy') {
                        this._advanceEnemyIcbmStepAfterShot();
                    }
                    if (this.icbmRaiseSoundPlaying && typeof AudioSystem !== 'undefined' && typeof AudioSystem.stopIcbmRaise === 'function') {
                        AudioSystem.stopIcbmRaise();
                    }
                    this.icbmRaiseSoundPlaying = false;
                    if (typeof game !== 'undefined' && typeof game.onIcbmLaunchFired === 'function') {
                        game.onIcbmLaunchFired(
                            this,
                            this.icbmLaunchRequest.payloadKey,
                            this.icbmLaunchRequest.targetX,
                            this.icbmLaunchRequest.targetY
                        );
                    }
                }
                this.icbmLaunchState = 'cooldown';
                this.icbmLaunchTimer = 72;
            }
            this.updateFacing();
            return true;
        }

        if (state === 'cooldown') {
            this.icbmLaunchTimer = Math.max(0, (this.icbmLaunchTimer || 0) - 1);
            if (this.icbmLaunchTimer <= 0) {
                this.icbmLaunchState = 'lowering';
            }
            this.updateFacing();
            return true;
        }

        if (state === 'lowering') {
            this.icbmAngle = Math.max(0, (this.icbmAngle || 0) - 1.6);
            if (this.icbmAngle <= 0) {
                this.icbmAngle = 0;
                this.icbmLaunchState = 'idle';
                this.icbmLaunchTimer = 0;
                this.icbmLaunchRequest = null;
                this.icbmHasFired = false;
                this.icbmRaiseSoundPlaying = false;
            }
            this.updateFacing();
            return true;
        }

        if (this.icbmRaiseSoundPlaying && typeof AudioSystem !== 'undefined' && typeof AudioSystem.stopIcbmRaise === 'function') {
            AudioSystem.stopIcbmRaise();
        }
        this.icbmRaiseSoundPlaying = false;
        this.icbmLaunchState = 'idle';
        this.icbmLaunchTimer = 0;
        this.icbmAngle = 0;
        this.icbmLaunchRequest = null;
        this.icbmHasFired = false;
        return false;
    }

    updateEnemyIcbmAnchor() {
        if (!this.stats || this.stats.id !== 'icbm_enemy') return false;
        const state = this.icbmLaunchState || 'idle';
        if (state !== 'idle' || this.icbmLaunchRequest) return false;
        const step = Math.max(0, Math.floor(Number(this.enemyIcbmAdvanceStep) || 0));
        const anchorX = this._getEnemyIcbmStageX(step);

        const speed = Math.max(0.2, Number(this.stats.speed) || 0.42) * 0.95;
        const dx = anchorX - this.x;
        if (Math.abs(dx) > 8) {
            this.x += Math.sign(dx) * Math.min(speed, Math.abs(dx));
            this.enemyIcbmSettleFrames = Math.max(Number(this.enemyIcbmSettleFrames) || 0, 16);
        } else if ((Number(this.enemyIcbmSettleFrames) || 0) > 0) {
            this.enemyIcbmSettleFrames = Math.max(0, (Number(this.enemyIcbmSettleFrames) || 0) - 1);
        }

        this.commandMode = 'stop';
        this.targetX = null;
        this.commandTargetX = null;
        this.returnToBase = false;
        this.attackTarget = null;
        this.updateFacing();
        return true;
    }

    update(enemies, buildings) {
        if (this.dead) return;
        if (this.recoil && this.recoil > 0) {
            this.recoil = Math.max(0, this.recoil - 0.6);
        }
        if (this.missileFlash && this.missileFlash > 0) {
            this.missileFlash = Math.max(0, this.missileFlash - 1);
        }
        if (this.commandMode !== 'retreat') this.returnToBase = false;

        // ?ㅽ꽩 ?곹깭 (EMP ??
        if (this.stunTimer > 0) {
            if (this.isIcbmLauncherUnit() && this.icbmRaiseSoundPlaying && typeof AudioSystem !== 'undefined' && typeof AudioSystem.stopIcbmRaise === 'function') {
                AudioSystem.stopIcbmRaise();
                this.icbmRaiseSoundPlaying = false;
            }
            this.stunTimer--;
            if (game.frame % 20 === 0) game.createParticles(this.x, this.y, 1, '#60a5fa');
            return;
        }

        if (this.stats.type === 'air') this.rotorAngle += 0.8;

        // [NEW] 카메라맨 전용 업데이트
        if (this.isCameraman || (this.stats && this.stats.isCameraman)) {
            this.updateCameraman();
            return;
        }

        if (this.stats && this.stats.civilian) {
            this.updateCivilian(enemies);
            return;
        }

        // [?섏젙] ?뚮젅??濡쒖쭅 (?쒕줎??硫덉텛吏 ?딄퀬 吏?섍?寃???
        const isDroneUnit = (this.stats.category === 'drone' || (this.stats.id && this.stats.id.includes('drone'))) && !this.stats.operator;
        if (this.stats.type === 'air' && !isDroneUnit && this.stats.id !== 'tactical_drone' && !this.flareUsed) {
            const flareRange = 150;
            const candidates = (this.team === 'player') ? game.enemies : game.players;
            let nearest = null;
            let bestD = flareRange + 1;

            for (const u of candidates) {
                if (!u || u.dead || !u.stats) continue;
                // ?쒕줎 移댄뀒怨좊━?닿굅??id??drone???ы븿??寃쎌슦 (?꾩닠?쒕줎 ?쒖쇅)
                if (!u.stats.operator && (u.stats.category === 'drone' || (u.stats.id && u.stats.id.includes('drone'))) && u.stats.id !== 'tactical_drone') {
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

        // ICBM 발사차량 상태머신 (기립/발사/복귀)
        if (this.isIcbmLauncherUnit()) {
            if (this.updateIcbmLauncher()) return;
            if (this.stats.id === 'icbm_enemy' && this.updateEnemyIcbmAnchor()) return;
        }

        // [NEW] 특수부대 AI 연막탄 1회 사용
        if (this.stats.id === 'special_forces') {
            if (this.team !== 'player' && (this.smokeChargesLeft || 0) > 0) {
                if (!Number.isFinite(this.smokeAiTimer)) {
                    this.smokeAiTimer = 60 + Math.floor(Math.random() * 240);
                }
                this.smokeAiTimer -= 1;
                if (this.smokeAiTimer <= 0) {
                    this.smokeChargesLeft = Math.max(0, (this.smokeChargesLeft || 0) - 1);
                    if (game && typeof game.spawnSmokeAt === 'function') {
                        const dx = (Math.random() * 80 - 40);
                        game.spawnSmokeAt(this.x + dx, game.groundY - 6, { team: this.team });
                    }
                }
            }
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
                if (this.team === 'player') {
                    if (this.isVeteran && this.veteranId && game.playerVeteranStock && Object.prototype.hasOwnProperty.call(game.playerVeteranStock, this.veteranId)) {
                        game.playerVeteranStock[this.veteranId] = Math.max(0, Math.floor(Number(game.playerVeteranStock[this.veteranId]) || 0)) + 1;
                    } else {
                        game.playerStock[this.stats.id]++;
                    }
                }
                else game.enemyStock[this.stats.id]++;
                return;
            }
        }

        // [NEW] 수송 헬기 하차 로직 (수동 하차 + 적군 자동 하차)
        if (this.isAirTransport()) {
            if (this.updateAirDrop()) return;

            // 적군은 목표 근처에서 자동 하차
            if (this.team !== 'player' && this.canTransportDrop()) {
                let autoX = null;
                if (this.attackTarget && !this.attackTarget.dead) autoX = this.attackTarget.x;
                else if (Number.isFinite(this.targetX)) autoX = this.targetX;
                if (Number.isFinite(autoX) && Math.abs(autoX - this.x) < 120) {
                    this.requestAirDrop(autoX);
                }
            }
        }


        // ?꾨왂 ??꺽湲?
        if (this.stats.id === 'bomber') {
            const dir = this.team === 'player' ? 1 : -1;
            this.x += this.stats.speed * dir;
            this.updateFacing();
            if (game.frame - this.lastBomb > 40 && this.x > 0 && this.x < CONFIG.mapWidth) {
                const targets = (this.team === 'enemy' && typeof game !== 'undefined' && Array.isArray(game.civilians))
                    ? [...enemies, ...game.civilians, ...buildings]
                    : [...enemies, ...buildings];
                const hasTarget = targets.some(t => t && !t.dead && t.team !== 'neutral' && !(t.stats && t.stats.invulnerable) && Math.abs(t.x - this.x) < 50);
                if (hasTarget) {
                    game.projectiles.push(new Projectile(this.x, this.y, null, this.stats.damage, this.team, 'bomb', { source: this }));
                    this.lastBomb = game.frame;
                }
            }
            return;
        }

        // [RECON] 정찰기 전용 - 직선 비행 후 이탈
        if (this.stats.id === 'recon') {
            const dir = this.team === 'player' ? 1 : -1;
            this.x += this.stats.speed * dir;
            this.updateFacing();
            const outOfBounds = (this.team === 'player' && this.x > CONFIG.mapWidth + 100) ||
                (this.team === 'enemy' && this.x < -100);
            if (outOfBounds) {
                this.dead = true;
                if (this.team === 'player') {
                    if (this.isVeteran && this.veteranId && game.playerVeteranStock && Object.prototype.hasOwnProperty.call(game.playerVeteranStock, this.veteranId)) {
                        game.playerVeteranStock[this.veteranId] = Math.max(0, Math.floor(Number(game.playerVeteranStock[this.veteranId]) || 0)) + 1;
                    } else {
                        game.playerStock['recon']++;
                    }
                }
                else game.enemyStock['recon']++;
            }
            return;
        }

        // ?꾪닾湲?
        if (this.stats.id === 'fighter') {
            const dir = this.team === 'player' ? 1 : -1;
            this.x += this.stats.speed * dir;
            this.updateFacing();

        if (this.attackTarget && (this.attackTarget.dead ||
            (this.attackTarget.stats && this.attackTarget.stats.invulnerable) ||
            Math.abs(this.attackTarget.x - this.x) > 600)) {
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

                game.projectiles.push(new Projectile(this.x, this.y, target, dmg, this.team, 'machinegun', { source: this }));
                this.lastAttack = game.frame;
            }

            // 적 전투기는 자동으로 공대공 미사일을 사용한다(보유 탄수 내에서).
            if (this.team === 'enemy' && target && !target.dead && (Number(this.missileChargesLeft) || 0) > 0) {
                const tid = target.stats ? String(target.stats.id || '') : '';
                const isDrone = tid.includes('drone') || (target.stats && target.stats.category === 'drone');
                const dist = Math.abs(target.x - this.x);
                const lastMissile = Number(this.lastFighterMissile) || -9999;
                const missileReady = (game.frame - lastMissile) > 150;
                if (!isDrone && dist <= 620 && missileReady) {
                    let missileDmg = Number(this.stats.missileDamage);
                    if (!Number.isFinite(missileDmg) || missileDmg <= 0) missileDmg = 420;
                    if (target.stats && target.stats.type === 'air') missileDmg = Math.round(missileDmg * 1.15);
                    const missileType = (typeof this.stats.missileProjectile === 'string' && this.stats.missileProjectile.trim())
                        ? this.stats.missileProjectile.trim()
                        : 'fighter_missile';
                    game.projectiles.push(new Projectile(this.x, this.y, target, missileDmg, this.team, missileType, { source: this }));
                    this.lastFighterMissile = game.frame;
                    this.missileChargesLeft = Math.max(0, (Number(this.missileChargesLeft) || 0) - 1);
                    this.missileFlash = 8;
                }
            }
            return;
        }

        // [?쇰컲 ?꾪닾 濡쒖쭅] (吏???좊떅, ?꾪뙆移? **?꾧컻??釉붾옓?명겕**)
        const isEngineer = this.stats.id === 'engineer';
        const isRpgUnit = (this.stats.id === 'engineer' || this.stats.id === 'rpg');
        const missileRange = Number(this.stats.missileRange) || this.stats.range;
        const canUseMissile = isRpgUnit && this.missileReady !== false;
        const isEngineerMissileTarget = (t) => {
            if (!t || !t.stats) return false;
            const tid = t.stats.id || '';
            const ttype = t.stats.type;
            const isDrone = tid.includes('drone') || tid === 'tactical_drone';
            return !isDrone && (ttype === 'mech' || ttype === 'air');
        };

        const extraCivilianTargets = (this.team === 'enemy' && typeof game !== 'undefined' && Array.isArray(game.civilians) && game.civilians.length)
            ? game.civilians
            : null;
        const onlyAir = !!this.stats.onlyAir;
        const restrictForward = (this.stats.type === 'air' && ['apache', 'fighter'].includes(this.stats.id)
            && this.commandMode !== 'retreat' && !this.returnToBase);
        const facing = Number.isFinite(this.facing) ? this.facing : (this.team === 'player' ? 1 : -1);
        const isBehind = (x) => (facing >= 0) ? (x < this.x - 20) : (x > this.x + 20);

        if (this.attackTarget) {
            const dist = Math.abs(this.attackTarget.x - this.x);
            const isStealth = this.attackTarget.stats && this.attackTarget.stats.stealth;
            const isInvulnerable = this.attackTarget.stats && this.attackTarget.stats.invulnerable;
            const isCivilianTarget = this.attackTarget.stats && this.attackTarget.stats.civilian;
            const effRange = (canUseMissile && isEngineerMissileTarget(this.attackTarget)) ? missileRange : this.stats.range;

            if (this.attackTarget.dead ||
                (restrictForward && isBehind(this.attackTarget.x)) ||
                (onlyAir && (!this.attackTarget.stats || this.attackTarget.stats.type !== 'air')) ||
                dist > effRange + 50 ||
                this.attackTarget.team === this.team ||
                this.attackTarget.team === 'neutral' ||
                (isCivilianTarget && this.team === 'player') ||
                isInvulnerable ||
                (isStealth && dist > 100)) {
                this.attackTarget = null;
            }
        }
        if (isRpgUnit && this.engineerAimTarget && this.attackTarget !== this.engineerAimTarget) {
            this.engineerAimTarget = null;
            this.engineerAimTimer = 0;
        }

        if (!this.attackTarget) {
            if (!Number.isFinite(this.targetScanInterval)) {
                this.targetScanInterval = this.getTargetScanInterval(this.stats);
            }
            if (!Number.isFinite(this.nextTargetScanFrame)) {
                this.nextTargetScanFrame = game.frame;
            }
            if (game.frame >= this.nextTargetScanFrame) {
                this.nextTargetScanFrame = game.frame + this.targetScanInterval;

                let bestScore = Infinity;
                const canHitAir = this.stats.antiAir || this.stats.type === 'air' || ['humvee', 'apc'].includes(this.stats.id);

                for (let e of enemies) {
                    if (!e || e.dead) continue;
                    if (e.stats && e.stats.stealth) continue;
                    if (onlyAir && (!e.stats || e.stats.type !== 'air')) continue;
                    if (e.stats && e.stats.invulnerable) continue;
                    if (this.stats.id === 'humvee' && e.stats.id === 'fighter') continue;
                    if (e.stats.type === 'air' && !canHitAir) continue;
                    if (restrictForward && isBehind(e.x)) continue;

                    const dist = Math.abs(e.x - this.x);
                    const effRange = (canUseMissile && isEngineerMissileTarget(e)) ? missileRange : this.stats.range;
                    if (dist > effRange) continue;

                    let score = dist;
                    // ?怨??좊떅? ??났湲??곗꽑
                    if (this.stats.antiAir && e.stats.type === 'air') score -= 2000;
                    else if (!this.stats.antiAir && e.stats.type === 'air') score += 2000;

                    if (score < bestScore) { bestScore = score; this.attackTarget = e; }
                }

                if (!this.attackTarget && extraCivilianTargets && !onlyAir) {
                    for (let e of extraCivilianTargets) {
                        if (!e || e.dead) continue;
                        if (e.stats && e.stats.stealth) continue;
                        if (e.stats && e.stats.invulnerable) continue;
                        if (e.stats && e.stats.type === 'air' && !canHitAir) continue;
                        if (restrictForward && isBehind(e.x)) continue;
                        const dist = Math.abs(e.x - this.x);
                        const effRange = (canUseMissile && isEngineerMissileTarget(e)) ? missileRange : this.stats.range;
                        if (dist > effRange) continue;
                        let score = dist;
                        if (score < bestScore) { bestScore = score; this.attackTarget = e; }
                    }
                }

                // ???좊떅 ?놁쑝硫?嫄대Ъ ?寃?
                if (!this.attackTarget && !onlyAir) {
                    for (let b of buildings) {
                        if (!b || b.dead || b.team === this.team || b.team === 'neutral') continue;
                        const dist = Math.abs(b.x - this.x);
                        if (dist > this.stats.range + b.width / 2) continue;
                        if (restrictForward && isBehind(b.x)) continue;
                        if (dist < bestScore) { bestScore = dist; this.attackTarget = b; }
                    }
                }
            }
        }

        const target = this.attackTarget;
        const mgTarget = (this.stats.id === 'mbt') ? this._findTankMGTarget(enemies, extraCivilianTargets) : null;
        const isAttacking = (target !== null) && !(this.team === 'enemy' && game.empTimer > 0);

        if (isAttacking) {
            let rate = 60;
            // [?섏젙] 釉붾옓?명겕??鍮좊Ⅸ ?곗궗 (15?꾨젅?? ?곸슜
            if (['humvee', 'apc', 'aa_tank', 'turret', 'blackhawk'].includes(this.stats.id)) rate = 15;
            else if (this.stats.id === 'mbt') rate = 120;
            else if (this.stats.id === 'spg') rate = 300;
            else if (this.stats.id === 'sniper') rate = 210;

            let handledAttackCycle = false;
            if (isRpgUnit && canUseMissile && isEngineerMissileTarget(target)) {
                const rawAimFrames = Number(this.stats.missileAimFrames);
                const aimFrames = Number.isFinite(rawAimFrames) ? Math.max(1, Math.floor(rawAimFrames)) : 54;
                if (this.engineerAimTarget !== target) {
                    this.engineerAimTarget = target;
                    this.engineerAimTimer = aimFrames;
                }
                this.engineerMode = 'firing';

                const timerNow = Math.max(0, Math.floor(Number(this.engineerAimTimer) || 0));
                if (timerNow > 0) {
                    this.engineerAimTimer = timerNow - 1;
                    handledAttackCycle = true;
                } else if (game.frame - this.lastAttack > rate) {
                    this.attack(target);
                    this.lastAttack = game.frame;
                    this.engineerAimTarget = null;
                    this.engineerAimTimer = 0;
                    handledAttackCycle = true;
                } else {
                    handledAttackCycle = true;
                }
            } else if (isRpgUnit) {
                this.engineerAimTarget = null;
                this.engineerAimTimer = 0;
                this.engineerMode = 'carrying';
            }

            if (!handledAttackCycle && game.frame - this.lastAttack > rate) {
                this.attack(target);
                this.lastAttack = game.frame;
            }

            if (this.stats.id === 'mbt') {
                this._updateTankMG(mgTarget || target);
            }
        } else {
            if (isRpgUnit) {
                this.engineerAimTarget = null;
                this.engineerAimTimer = 0;
                this.engineerMode = 'carrying';
            }

            const speed = Number(this.stats.speed) || 0;
            const cmd = this.commandMode;

            // 안전 모드: retreat는 이동 충돌을 피하기 위해 정지로 통합
            if (cmd === 'retreat') {
                this.commandMode = 'stop';
                this.returnToBase = false;
                this.targetX = null;
                this.commandTargetX = null;
            }

            // 공격 타겟이 없으면 기본 전진 대신 commandMode(stop/move)를 우선 적용
            if (this.commandMode === 'stop') {
                // 정지 유지
            } else if (this.commandMode === 'move') {
                const moveX = Number.isFinite(this.commandTargetX) ? this.commandTargetX : this.targetX;
                if (Number.isFinite(moveX)) {
                    const dx = moveX - this.x;
                    if (Math.abs(dx) < 10) {
                        this.commandMode = (this.team === 'enemy') ? 'attack' : 'stop';
                        this.targetX = null;
                        this.commandTargetX = null;
                    } else {
                        this.x += speed * Math.sign(dx);
                    }
                } else {
                    this.commandMode = (this.team === 'enemy') ? 'attack' : 'stop';
                    this.targetX = null;
                    this.commandTargetX = null;
                }
            } else {
                const moveDir = this.team === 'player' ? 1 : -1;
                this.x += speed * moveDir;
            }

            if (this.stats.id === 'mbt') {
                this._updateTankMG(mgTarget);
                if (!mgTarget) this._stopTankMGSound();
            }
        }

        // [R 4.2 FIX v3] facing 확정 (draw에서 계산 금지)
        this.updateFacing();
    }

    updateCivilian(threats) {
        const baseSpeed = Number(this.stats?.speed) || 0.4;
        const panicSpeed = baseSpeed * 2.2;
        const maxX = (typeof CONFIG !== 'undefined' && Number.isFinite(CONFIG.mapWidth)) ? CONFIG.mapWidth : 6000;
        const pad = 60;

        if (typeof game !== 'undefined' && Number.isFinite(game.civilianGlobalPanic) && game.civilianGlobalPanic > 0) {
            this.panicTimer = Math.max(this.panicTimer || 0, game.civilianGlobalPanic);
        }

        if (typeof game !== 'undefined' && game.civilianEvacActive && Number.isFinite(game.civilianEvacX)) {
            const evacSpeed = baseSpeed * 1.6;
            const dxEvac = game.civilianEvacX - this.x;
            const dirEvac = dxEvac === 0 ? (this.facing || 1) : Math.sign(dxEvac);
            this.x += dirEvac * evacSpeed;
            this.facing = dirEvac;
            if (Math.abs(dxEvac) < 35) {
                this.dead = true;
                return;
            }
            if (this.x < pad) this.x = pad;
            if (this.x > maxX - pad) this.x = maxX - pad;
            if (typeof game !== 'undefined' && Number.isFinite(game.groundY)) {
                this.y = game.groundY;
            }
            return;
        }

        let nearestThreat = null;
        let nearestDist = 99999;
        if (Array.isArray(threats) && threats.length) {
            for (const t of threats) {
                if (!t || t.dead) continue;
                const d = Math.abs(t.x - this.x);
                if (d < nearestDist) { nearestDist = d; nearestThreat = t; }
            }
            if (nearestThreat && nearestDist < 220) {
                this.panicTimer = Math.max(this.panicTimer || 0, 180);
            }
        }

        if (this.panicTimer > 0) this.panicTimer--;
        const speed = (this.panicTimer > 0) ? panicSpeed : baseSpeed;
        const jitterFrames = (this.panicTimer > 0) ? 20 : 90;

        this.animFrame = (this.animFrame || 0) + 0.1;
        if (!this.wanderTargetX || this.wanderTimer <= 0 || Math.abs(this.wanderTargetX - this.x) < 6) {
            let dir = Math.random() < 0.5 ? -1 : 1;
            if (this.panicTimer > 0 && nearestThreat) {
                dir = (nearestThreat.x > this.x) ? -1 : 1;
            }
            const dist = (this.panicTimer > 0)
                ? (120 + Math.random() * 220)
                : (60 + Math.random() * 160);
            this.wanderTargetX = this.x + dir * dist;
            this.wanderTargetX = Math.max(pad, Math.min(maxX - pad, this.wanderTargetX));
            this.wanderTimer = jitterFrames + Math.floor(Math.random() * jitterFrames);
        } else {
            this.wanderTimer--;
        }

        const dx = this.wanderTargetX - this.x;
        const moveDir = dx === 0 ? (this.facing || 1) : Math.sign(dx);
        this.x += moveDir * speed;
        this.facing = moveDir;

        if (this.x < pad) { this.x = pad; this.wanderTargetX = pad + 80; }
        if (this.x > maxX - pad) { this.x = maxX - pad; this.wanderTargetX = maxX - pad - 80; }

        if (typeof game !== 'undefined' && Number.isFinite(game.groundY)) {
            this.y = game.groundY;
        }
    }

    // [NEW] 카메라맨 이동 로직 - 플레이어 조종 가능
    updateCameraman() {
        const baseSpeed = (this.stats && this.stats.speed) || 0.6;
        const maxX = (typeof CONFIG !== 'undefined' && Number.isFinite(CONFIG.mapWidth)) ? CONFIG.mapWidth - 100 : 5900;
        const minX = 100;

        // 플레이어 명령 모드에 따라 이동
        if (this.commandMode === 'move' && typeof this.targetX === 'number') {
            // 이동 명령이 있으면 목표 지점으로 이동
            const dx = this.targetX - this.x;
            if (Math.abs(dx) > 10) {
                const dir = Math.sign(dx);
                this.x += dir * baseSpeed;
                this.facing = dir;
            } else {
                // 목표 도달 시 정지
                this.commandMode = 'stop';
                this.targetX = null;
            }
        }
        // 'stop' 모드면 제자리 대기

        // 경계 체크
        this.x = Math.max(minX, Math.min(maxX, this.x));

        // 지면 고정
        if (typeof game !== 'undefined' && Number.isFinite(game.groundY)) {
            this.y = game.groundY;
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
                    const detectRange = stats.detectRange || 600;  // [CHANGE] 사거리 증가 (400 → 600)
                    let nearestTarget = null;
                    let nearestDist = detectRange + 1;
                    let targetIsBuilding = false;

                    // [NEW] 적 유닛 검색
                    for (const e of enemies) {
                        if (!e || e.dead) continue;
                        const d = Math.abs(e.x - this.x);
                        if (d < nearestDist) { nearestDist = d; nearestTarget = e; targetIsBuilding = false; }
                    }

                    // [NEW] 적 건물도 검색 (유닛보다 가까운 건물이 있으면 타겟으로)
                    if (buildings && buildings.length) {
                        for (const b of buildings) {
                            if (!b || b.dead) continue;
                            if (b.team === this.team || b.team === 'neutral') continue;
                            const d = Math.abs(b.x - this.x);
                            if (d < nearestDist) { nearestDist = d; nearestTarget = b; targetIsBuilding = true; }
                        }
                    }

                    if (nearestTarget && nearestDist <= detectRange) {
                        shouldDeploy = true;
                        // 타겟 타입에 따라 드론 종류 자동 선택
                        const target = nearestTarget;
                        // [NEW] 건물은 항상 AT 드론으로 공격
                        const isArmored = targetIsBuilding ||
                            target.armored === true ||
                            ['tank', 'vehicle', 'mech'].includes(target.type) ||
                            ['mbt', 'apc', 'aa_tank', 'humvee', 'spg'].includes(target.stats?.id) ||
                            target.width > 50;
                        deployType = isArmored ? 'drone_at' : 'drone_suicide';
                    }
                }
            }

            // 2. 발진 실행 → laptop 모드 전환
            if (shouldDeploy && deployType) {
                this.opState = 'laptop';

                // [R 4.2 FIX v4] 드론 생성 위치: 드론병 바로 아래 (발밑)
                const droneX = this.x;  // 드론병 바로 아래
                const droneY = game.groundY;  // 지면 레벨

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
            const canHitAir = stats.antiAir || stats.type === 'air';
            if (this.attackTarget) {
                const t = this.attackTarget;
                if (t.dead ||
                    t.team === this.team ||
                    t.team === 'neutral' ||
                    (t.stats && (t.stats.stealth || t.stats.invulnerable)) ||
                    (!canHitAir && t.stats && t.stats.type === 'air')) {
                    this.attackTarget = null;
                }
            }

            if (!this.attackTarget || this.attackTarget.dead) {
                let bestDist = stats.range + 1;
                for (const e of enemies) {
                    if (!e || e.dead) continue;
                    if (e.stats && (e.stats.stealth || e.stats.invulnerable)) continue;
                    if (!canHitAir && e.stats && e.stats.type === 'air') continue;
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

    // [R 4.2 FIX v4] facing은 오직 실제 x 이동량으로만 결정
    // 제자리면 마지막 방향 유지 (타겟/명령 기반 X)
    updateFacing() {
        if (this.dead) return;
        if (this.isIcbmLauncherUnit()) {
            this.facing = (this.stats.id === 'icbm') ? -1 : 1;
            this._lastX = this.x;
            return;
        }

        // 이전 x 위치 초기화
        if (this._lastX == null) {
            this._lastX = this.x;
            // 초기 facing은 팀 기본 방향
            if (this.facing == null) {
                this.facing = (this.team === 'player') ? 1 : -1;
            }
            return;
        }

        // 실제 이동량 계산
        const dx = this.x - this._lastX;
        this._lastX = this.x;

        // 이동량이 임계값(0.5px) 이상일 때만 facing 변경
        // 제자리면 마지막 방향 유지
        if (Math.abs(dx) > 0.5) {
            this.facing = dx > 0 ? 1 : -1;
        }
        // else: 제자리 → facing 유지 (아무것도 안 함)
    }

    findNearestEnemy(enemies, buildings) {
        let t = null; let min = 9999;
        const x = this.x;
        const team = this.team;
        // [P0-3] spread 배열 생성 제거 - 순차적 for loop으로 GC 할당 제거
        for (let i = 0; i < enemies.length; i++) {
            const e = enemies[i];
            if (e && !e.dead && e.team !== team && e.team !== 'neutral') {
                const dx = e.x - x;
                const d = dx < 0 ? -dx : dx;
                if (d < min) { min = d; t = e; }
            }
        }
        for (let i = 0; i < buildings.length; i++) {
            const e = buildings[i];
            if (e && !e.dead && e.team !== team && e.team !== 'neutral') {
                const dx = e.x - x;
                const d = dx < 0 ? -dx : dx;
                if (d < min) { min = d; t = e; }
            }
        }
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
                if (id === 'drone_at') {
                    AudioSystem.playBoom('death_exp3', this.x);
                } else if (id === 'drone_suicide') {
                    AudioSystem.playBoom('death_exp2', this.x);
                } else if (id === 'tactical_drone') {
                    AudioSystem.playBoom('tactical_drone', this.x); // boom-2
                } else if (id === 'stealth_drone') {
                    AudioSystem.playBoom('stealth', this.x); // boom-3
                } else {
                    // 일반 드론 (지상 충돌 시 boom-4)
                    const isOnGround = this.y >= (game.groundY - 30);
                    if (isOnGround) {
                        AudioSystem.playBoom('drone', this.x); // boom-4
                    } else {
                        AudioSystem.playBoom('other', this.x); // boom-2 (공중)
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

                // 건물 피해 (0.6배) - [FIX] 드론 폭발 타입 전달
                [...buildingsList].forEach(b => {
                    if (b && !b.dead && b.team !== this.team && b.team !== 'neutral') {
                        const d = Math.abs(b.x - this.x);
                        if (d < radius) {
                            const falloff = 1 - (d / radius) * 0.5;
                            try { b.takeDamage(Math.floor(baseDmg * falloff * 0.6), 'drone_explosion'); } catch (err) { }
                        }
                    }
                });
            }
            // 일반 드론 (자폭/전술 등): 기존 로직 - [FIX] 타입 전달
            else if (target && !target.dead && typeof target.takeDamage === 'function') {
                target.takeDamage(this.stats.damage, 'drone_explosion');
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

    _startTankMGSound() {
        if (typeof AudioSystem === 'undefined') return;
        if (!AudioSystem.volume || AudioSystem.volume.sfx <= 0) return;
        try {
            const audibility = (typeof AudioSystem.getWorldAudibility === 'function')
                ? AudioSystem.getWorldAudibility(this.x)
                : 1;
            if (audibility <= 0.02) {
                this._stopTankMGSound();
                return;
            }
            if (!this._mgAudio) {
                const a = new Audio('bgm/machine_gun2.mp3');
                a.preload = 'auto';
                a.loop = true;
                a.playsInline = true;
                this._mgAudio = a;
            }
            const vol = AudioSystem.volume.sfx * AudioSystem.volume.master * 0.5 * audibility;
            this._mgAudio.volume = vol;
            if (this._mgAudio.paused) {
                const p = this._mgAudio.play();
                if (p && p.catch) {
                    p.catch(() => {
                        if (AudioSystem._playOneShot) {
                            AudioSystem._playOneShot('bgm/machine_gun2.mp3', vol, 6, this.x);
                        }
                    });
                }
            }
        } catch (e) { }
    }

    _stopTankMGSound() {
        if (!this._mgAudio) return;
        try { this._mgAudio.pause(); } catch (e) { }
        try { this._mgAudio.currentTime = 0; } catch (e) { }
    }

    _fireTankMG(target) {
        if (!game || !game.projectiles) return;
        if (!target || target.dead) return;
        const dmg = 12;
        const spawnY = this.y - (this.height ? this.height * 0.92 : 0);
        try {
            const fx = this.x + (this.facing || 1) * 16;
            game.projectiles.push(new Projectile(fx, spawnY, target, dmg, this.team, 'machinegun', { source: this }));
        } catch (e) { }
        if (game && game.createParticles) {
            const fx2 = this.x + (this.facing || 1) * 18;
            game.createParticles(fx2, spawnY, 4, '#fbbf24');
        }
        if (typeof game !== 'undefined' && Number.isFinite(game.frame)) {
            this._mgLastShotFrame = game.frame;
        }
        this._startTankMGSound();
    }

    _updateTankMG(target) {
        if (this.stats.id !== 'mbt') return;
        if (this.stunTimer > 0) {
            this._stopTankMGSound();
            return;
        }
        if (!target || target.dead || !target.stats) {
            if (typeof game !== 'undefined' && (game.frame - this._mgLastShotFrame) > 8) {
                this._stopTankMGSound();
            }
            return;
        }
        if (target.stats.type === 'air' || (target.stats && target.stats.invulnerable)) {
            if (typeof game !== 'undefined' && (game.frame - this._mgLastShotFrame) > 8) {
                this._stopTankMGSound();
            }
            return;
        }

        const dist = Math.abs(target.x - this.x);
        const mgRange = Math.min(300, Number(this.stats.range) || 300);
        if (dist > mgRange) {
            if (typeof game !== 'undefined' && (game.frame - this._mgLastShotFrame) > 8) {
                this._stopTankMGSound();
            }
            return;
        }

        const rate = 8;
        if (game.frame - this.lastMGAttack > rate) {
            this._fireTankMG(target);
            this.lastMGAttack = game.frame;
        }

        if ((game.frame - this._mgLastShotFrame) > 12) {
            this._stopTankMGSound();
        }
    }

    _findTankMGTarget(enemies, extraCivilianTargets) {
        if (this.stats.id !== 'mbt') return null;
        const mgRange = Math.min(300, Number(this.stats.range) || 300);
        let best = null;
        let bestDist = Infinity;
        const scanLists = [enemies || [], extraCivilianTargets || []];

        for (const list of scanLists) {
            for (const e of list) {
                if (!e || e.dead || !e.stats) continue;
                if (e.stats.type === 'air') continue;
                if (e.stats && e.stats.invulnerable) continue;
                const dist = Math.abs(e.x - this.x);
                if (dist > mgRange) continue;
                if (dist < bestDist) {
                    bestDist = dist;
                    best = e;
                }
            }
        }
        return best;
    }

    attack(target) {
        if (!game || !game.projectiles) return;
        if (this.stats.onlyAir && (!target || !target.stats || target.stats.type !== 'air')) return;
        if (target && target.stats && target.stats.invulnerable) return;
        const id = this.stats.id;
        let dmg = this.stats.damage;

        if (target?.stats?.type === 'air' && this.stats.damageAir != null) {
            dmg = this.stats.damageAir;
        }
        if (target?.stats?.type !== 'air' && this.stats.damageGround != null) {
            dmg = this.stats.damageGround;
        }
        if (target?.stats?.type === 'mech') {
            const antiArmorMult = Number(this.stats?.antiArmorMult);
            if (Number.isFinite(antiArmorMult) && antiArmorMult > 0 && antiArmorMult < 1) {
                dmg = Math.max(1, Math.floor(dmg * antiArmorMult));
            }
        }

        if (id === 'humvee' && target.stats && target.stats.type === 'air') {
            dmg = Math.max(1, Math.floor(dmg * 0.2));
        }
        if (['aa_tank', 'turret'].includes(id) && target.stats && target.stats.id === 'bomber') {
            dmg *= 1.6;
        }
        if (this.stunTimer > 0) return;

        // [?섏젙] 諛쒖궗泥?????ㅼ젙 (釉붾옓?명겕 異붽?)
        // [NEW] 공병 특수 처리
        if (id === 'engineer' || id === 'rpg') {
            const targetType = target.stats ? target.stats.type : null;
            const targetId = target.stats ? target.stats.id : null;
            const isDrone = targetId && (targetId.includes('drone') || targetId === 'tactical_drone');
            const isArmoredOrAir = targetType === 'mech' || targetType === 'air';
            const isAirTarget = targetType === 'air';

            const isEngineerMissileLocked = (t) => {
                if (!t || t.dead) return false;
                const lock = t._engMissileLock;
                if (!lock) return false;
                if (lock.team && lock.team !== this.team) return false;
                if (Number.isFinite(lock.until) && game.frame > lock.until) {
                    t._engMissileLock = null;
                    return false;
                }
                return true;
            };

            const lockEngineerMissile = (t) => {
                if (!t) return;
                t._engMissileLock = {
                    team: this.team,
                    until: game.frame + 40
                };
            };

            if (isArmoredOrAir && !isDrone && this.missileReady !== false) {
                if (isAirTarget && isEngineerMissileLocked(target)) {
                    this.engineerMode = 'carrying';
                    return;
                }
                if (isAirTarget) lockEngineerMissile(target);
                // 미사일 모드: 기갑/공중 (드론 제외)
                this.engineerMode = 'firing';
                const missileDmg = this.stats.missileDamage || 80;
                const spawnDir = Number.isFinite(this.facing) ? this.facing : (this.team === 'player' ? 1 : -1);
                const spawnX = this.x + (spawnDir * 16);
                const spawnY = this.y - this.height / 2 - 10;
                try {
                    game.projectiles.push(new Projectile(spawnX, spawnY, target, missileDmg, this.team, 'engineer_missile', { source: this }));
                } catch (e) { }
                this.missileFlash = 7;
                if (typeof game.createParticles === 'function') {
                    game.createParticles(spawnX, spawnY, 8, '#f59e0b');
                    game.createParticles(spawnX, spawnY, 4, '#fffbeb');
                }
                this.engineerAimTarget = null;
                this.engineerAimTimer = 0;
                this.missileReady = false; // 미사일 1발만
                this.engineerMode = 'carrying';
            } else {
                // 견착 모드: 보병 또는 미사일 소진
                this.engineerMode = 'carrying';
                if (typeof AudioSystem !== 'undefined' && Math.random() < 0.3) {
                    AudioSystem.playSFX('gun3', this.x);
                }
                try {
                    game.projectiles.push(new Projectile(this.x, this.y - this.height / 2, target, dmg, this.team, 'machinegun', { source: this }));
                } catch (e) { }
            }
            return;
        }

        // [기존] 발사체 타입 결정
        let type = 'bullet';
        let shotOpts = null;
        if (['spg'].includes(id)) type = 'artillery';
        else if (['mbt'].includes(id)) type = 'shell';
        else if (['apache'].includes(id)) type = 'rocket';
        else if (['aa_tank', 'turret'].includes(id)) type = 'aa_shell';
        else if (['humvee'].includes(id)) type = 'humvee_burst';  // [FIX] 험비는 건물 파괴 가능
        else if (['apc', 'blackhawk', 'fighter'].includes(id)) type = 'machinegun';
        if (id === 'apc') {
            shotOpts = { impactVfx: 'shell_hit', impactVfxAir: 'airburst' };
        } else if (id === 'mbt') {
            shotOpts = { impactVfx: 'tank_shell', impactVfxAir: 'airburst', impactVfxOnly: true };
        }

        // 총소리 재생 (유닛 타입별)
        const skipGunSFX = (id === 'mbt' && type === 'shell');
        const shouldPlayGunSFX = (id === 'sniper' || id === 'special_ops') ? true : (Math.random() < 0.3);
        if (!skipGunSFX && typeof AudioSystem !== 'undefined' && shouldPlayGunSFX) {
            if (id === 'infantry') AudioSystem.playGun('infantry', this.x);
            else if (id === 'special_forces') AudioSystem.playGun('special', this.x);
            else if (id === 'special_ops') AudioSystem.playGun('special_ops', this.x);
            else if (id === 'sniper') AudioSystem.playGun('sniper', this.x);
            else if (id === 'humvee') AudioSystem.playGun('machine_gun', this.x);
            else if (id === 'apc') AudioSystem.playGun('flak', this.x);
            else if (id === 'aa_tank') AudioSystem.playGun('flak', this.x);
            else if (id === 'spg' || id === 'apache') AudioSystem.playGun('self', this.x);
            else AudioSystem.playSFX('shoot', this.x);
        }
        if (typeof AudioSystem !== 'undefined' && id === 'mbt' && type === 'shell') {
            // [NOTE] 탱크 포탄 발사음 제거 - 명중 시 사운드로 이동
        }

        const recoilKick = (id === 'mbt') ? 6 : ((id === 'spg') ? 5 : 0);
        if (recoilKick > 0) {
            this.recoil = Math.max(this.recoil || 0, recoilKick);
        }
        if (id === 'apache' && type === 'rocket') {
            this.missileFlash = 6;
            if (typeof AudioSystem !== 'undefined') {
                AudioSystem.playSFX('apache_missile', this.x);
            }
        }

        try {
            let spawnY = this.y - this.height / 2;
            if (id === 'mbt' && type === 'shell') {
                spawnY = this.y - this.height * 0.38; // 포신 (아래쪽)
            }
            const finalOpts = shotOpts ? Object.assign({ source: this }, shotOpts) : { source: this };
            game.projectiles.push(new Projectile(this.x, spawnY, target, dmg, this.team, type, finalOpts));
        } catch (e) { }
    }

    draw(ctx) {
        if (this.dead) return;
        const id = this.stats.id;
        const skins = (typeof window !== 'undefined' && window.RECLAIM_SKINS) ? window.RECLAIM_SKINS : null;
        const skin = skins ? (skins[id] || skins[this.typeKey]) : null;
        const snapDy = this.computeFeetSnapDy(skin);
        const showHp = !this.hideHp && (this.isSelected || this.hp < this.maxHp);
        const drawHpBar = () => {
            if (typeof UnitRenderUtils !== 'undefined' && UnitRenderUtils.drawUnitHpBar) {
                UnitRenderUtils.drawUnitHpBar(this, ctx, snapDy, showHp);
                return;
            }
            if (!showHp) return;
            const hpPct = Math.max(0, this.hp / this.maxHp);
            const w = 24; const h = 4; const yOffset = -50;
            const barX = this.x;
            const barY = (this.y + snapDy) + yOffset;
            ctx.fillStyle = '#ef4444'; ctx.fillRect(barX - w / 2, barY, w, h);
            ctx.fillStyle = '#22c55e'; ctx.fillRect(barX - w / 2, barY, w * hpPct, h);
            ctx.strokeStyle = '#000'; ctx.lineWidth = 0.5; ctx.strokeRect(barX - w / 2, barY, w, h);
        };
        ctx.save();
        ctx.translate(this.x, this.y + snapDy);
        const ARMORED_RENDER_BOOST = {
            humvee: 1.18,
            apc: 1.16,
            mbt: 1.16,
            spg: 1.16,
            aa_tank: 1.12
        };
        const armoredBoost = Number(ARMORED_RENDER_BOOST[id]) || 1;
        const baseRenderScale = 1.4;
        ctx.scale(baseRenderScale * armoredBoost, baseRenderScale * armoredBoost);  // [C-01] armored visual size boost

        // ... (?꾩닠 ?쒕줎 ?쎌삩 諛뺤뒪 肄붾뱶??洹몃?濡??좎?) ...
        if (id === 'tactical_drone' && this.lockedTarget && !this.lockedTarget.dead) {
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

        const facing = Number.isFinite(this.facing) ? this.facing : (this.team === 'player' ? 1 : -1);
        const recoilX = (this.recoil || 0) * -facing;
        if (recoilX) ctx.translate(recoilX, 0);

        const renderedWithSkin = (typeof UnitRenderUtils !== 'undefined' && UnitRenderUtils.renderSkinLayers)
            ? UnitRenderUtils.renderSkinLayers(this, ctx, skin)
            : false;
        if (renderedWithSkin) {
            ctx.restore();
            drawHpBar();
            return;
        }

        // [R 4.2 FIX v3] facing은 update()에서 확정됨 - draw()에서는 단순 적용만
        if (id !== 'drone_at') {
            ctx.scale(this.facing || 1, 1);
        }
        // [R 2.2] ?좊떅 ?됱긽 ?듭씪 (?덉쇅: blackhawk, chinook, special_forces)
        const colorExceptions = ['blackhawk', 'chinook', 'special_forces'];
        if (colorExceptions.includes(this.stats.id)) {
            ctx.fillStyle = this.stats.color;
        } else {
            ctx.fillStyle = this.team === 'player' ? '#3b82f6' : '#ef4444';
        }

        // [湲곗〈 ?좊떅 洹몃━湲?肄붾뱶 ?좎?, 釉붾옓?명겕/移섎늻?щ쭔 ?섏젙]
        // [NEW] Worker 유닛 렌더링
        if (id === 'worker') {
            const teamColor = this.team === 'player' ? '#3b82f6' : '#ef4444';

            // 몸통
            ctx.fillStyle = teamColor;
            ctx.fillRect(-6, -20, 12, 20);

            // 머리
            ctx.beginPath();
            ctx.arc(0, -24, 5, 0, Math.PI * 2);
            ctx.fill();

            // 캡모자 베이스
            ctx.fillStyle = '#1e293b';
            ctx.beginPath();
            ctx.arc(0, -25, 5.2, Math.PI, 0);
            ctx.fill();

            // 캡모자 챙
            ctx.beginPath();
            ctx.moveTo(4, -26);
            ctx.lineTo(9, -24);
            ctx.lineTo(4, -23);
            ctx.fill();

            // 삽 (대각선 위로)
            ctx.save();
            ctx.translate(0, -8);
            ctx.rotate(-Math.PI / 4);

            // 삽 날
            ctx.fillStyle = '#94a3b8';
            ctx.fillRect(-3, -16, 6, 8);

            // 삽 자루
            ctx.fillStyle = '#854d0e';
            ctx.fillRect(-1, -8, 2, 14);

            // 손잡이 끝
            ctx.fillRect(-3, 6, 6, 2);
            ctx.restore();

            // 손
            ctx.fillStyle = teamColor;
            ctx.fillRect(-3, -15, 4, 4);
            ctx.fillRect(0, -10, 4, 4);
        }
        else if (id === 'civ_sedan') {
            ctx.save();
            ctx.scale(1.1, 1.1);
            const neutralGrey = '#94a3b8';
            const darkGrey = '#475569';
            const windowColor = '#e2e8f0';
            ctx.fillStyle = neutralGrey;
            ctx.beginPath();
            if (ctx.roundRect) ctx.roundRect(-25, -12, 50, 10, 2);
            else ctx.rect(-25, -12, 50, 10);
            ctx.fill();

            ctx.fillStyle = darkGrey;
            ctx.beginPath();
            ctx.moveTo(-15, -12); ctx.lineTo(-8, -20); ctx.lineTo(12, -20); ctx.lineTo(18, -12);
            ctx.closePath(); ctx.fill();

            ctx.fillStyle = windowColor;
            ctx.beginPath();
            ctx.moveTo(-12, -13); ctx.lineTo(-7, -18); ctx.lineTo(10, -18); ctx.lineTo(14, -13);
            ctx.closePath(); ctx.fill();

            ctx.fillStyle = '#fef08a';
            ctx.fillRect(22, -10, 3, 4);

            ctx.fillStyle = '#1e293b';
            ctx.beginPath(); ctx.arc(-15, -2, 5, 0, Math.PI * 2); ctx.fill();
            ctx.beginPath(); ctx.arc(15, -2, 5, 0, Math.PI * 2); ctx.fill();
            ctx.restore();
        }
        else if (id === 'civ_suv') {
            ctx.save();
            ctx.scale(1.1, 1.1);
            const neutralGrey = '#94a3b8';
            const darkGrey = '#475569';
            const windowColor = '#e2e8f0';
            ctx.fillStyle = darkGrey;
            ctx.beginPath();
            if (ctx.roundRect) ctx.roundRect(-28, -13, 56, 10, 3);
            else ctx.rect(-28, -13, 56, 10);
            ctx.fill();

            ctx.fillStyle = neutralGrey;
            ctx.beginPath();
            if (ctx.roundRect) ctx.roundRect(-20, -22, 38, 10, [5, 5, 0, 0]);
            else ctx.rect(-20, -22, 38, 10);
            ctx.fill();

            ctx.fillStyle = windowColor;
            ctx.fillRect(-15, -20, 10, 6);
            ctx.fillRect(0, -20, 15, 6);

            ctx.fillStyle = '#334155';
            ctx.fillRect(-15, -24, 30, 2);

            ctx.fillStyle = '#0f172a';
            ctx.beginPath(); ctx.arc(-16, -3, 4.5, 0, Math.PI * 2); ctx.fill();
            ctx.beginPath(); ctx.arc(16, -3, 4.5, 0, Math.PI * 2); ctx.fill();
            ctx.restore();
        }
        else if (id === 'civ_bus') {
            ctx.save();
            ctx.scale(1.1, 1.1);
            const darkGrey = '#475569';
            const windowColor = '#e2e8f0';
            ctx.fillStyle = '#cbd5e1';
            ctx.beginPath();
            if (ctx.roundRect) ctx.roundRect(-40, -35, 80, 30, 4);
            else ctx.rect(-40, -35, 80, 30);
            ctx.fill();

            ctx.fillStyle = darkGrey;
            ctx.fillRect(-40, -10, 80, 5);

            ctx.fillStyle = windowColor;
            for (let i = 0; i < 4; i++) {
                ctx.fillRect(-35 + (i * 18), -30, 14, 12);
            }

            ctx.fillStyle = '#94a3b8';
            ctx.fillRect(25, -30, 10, 20);

            ctx.fillStyle = '#fef08a';
            ctx.fillRect(37, -15, 3, 5);

            ctx.fillStyle = '#000';
            ctx.beginPath(); ctx.arc(-25, -5, 6, 0, Math.PI * 2); ctx.fill();
            ctx.beginPath(); ctx.arc(20, -5, 6, 0, Math.PI * 2); ctx.fill();
            ctx.restore();
        }
        else if (id === 'civ_a') {
            const neutralGrey = '#94a3b8';
            const darkGrey = '#475569';
            ctx.fillStyle = neutralGrey;
            ctx.beginPath();
            if (ctx.roundRect) ctx.roundRect(-5, -15, 10, 15, 2);
            else ctx.rect(-5, -15, 10, 15);
            ctx.fill();
            ctx.fillStyle = '#e2e8f0';
            ctx.beginPath(); ctx.arc(0, -20, 5, 0, Math.PI * 2); ctx.fill();
            ctx.fillStyle = darkGrey;
            ctx.beginPath(); ctx.arc(0, -21, 5, Math.PI, 0); ctx.fill();
        }
        else if (id === 'civ_b') {
            ctx.fillStyle = '#64748b';
            ctx.beginPath();
            if (ctx.roundRect) ctx.roundRect(-5, -15, 10, 15, 2);
            else ctx.rect(-5, -15, 10, 15);
            ctx.fill();
            ctx.strokeStyle = '#334155';
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            ctx.moveTo(-5, -13); ctx.lineTo(5, -5);
            ctx.stroke();
            ctx.fillStyle = '#334155';
            ctx.fillRect(2, -7, 6, 5);
            ctx.fillStyle = '#cbd5e1';
            ctx.beginPath(); ctx.arc(0, -19, 5, 0, Math.PI * 2); ctx.fill();
        }
        else if (id === 'civ_crowd') {
            const members = [
                { x: -12, y: 5, scale: 0.9, color: '#94a3b8' },
                { x: 12, y: 5, scale: 0.85, color: '#64748b' },
                { x: 0, y: 5, scale: 1.0, color: '#475569' }
            ];
            members.forEach(m => {
                ctx.save();
                ctx.translate(m.x, m.y);
                ctx.scale(m.scale, m.scale);
                ctx.fillStyle = m.color;
                ctx.fillRect(-5, -15, 10, 15);
                ctx.fillStyle = '#e2e8f0';
                ctx.beginPath(); ctx.arc(0, -19, 5, 0, Math.PI * 2); ctx.fill();
                ctx.restore();
            });
        }
        // [NEW] 방송국 카메라맨
        else if (id === 'cameraman') {
            const clothingColor = '#3b82f6'; // 파란색 조끼
            const pantsColor = '#1e3a5f';    // 진한 남색 바지
            const gearColor = '#475569';     // 장비 회색
            const darkGearColor = '#1e293b'; // 진한 회색

            // 하의 (남색 바지)
            ctx.fillStyle = pantsColor;
            ctx.fillRect(-5, -10, 4, 10);
            ctx.fillRect(1, -10, 4, 10);

            // 상의 (파란색 조끼)
            ctx.fillStyle = clothingColor;
            ctx.fillRect(-6, -22, 12, 12);

            // 조끼 주머니
            ctx.fillStyle = '#1d4ed8';
            ctx.fillRect(-5, -20, 4, 4);
            ctx.fillRect(1, -20, 4, 4);

            // 머리
            ctx.fillStyle = '#f1f5f9';
            ctx.beginPath();
            ctx.arc(0, -26, 5, 0, Math.PI * 2);
            ctx.fill();

            // 회색 캡모자
            ctx.fillStyle = gearColor;
            ctx.beginPath();
            ctx.arc(0, -27, 5.5, Math.PI, 0);
            ctx.fill();
            ctx.fillRect(4, -28, 6, 2); // 모자 챙

            // 헤드셋
            ctx.fillStyle = darkGearColor;
            ctx.fillRect(-7, -29, 2, 4);
            ctx.fillRect(5, -29, 2, 4);
            ctx.fillRect(-7, -30, 14, 2);

            // ENG 카메라 (어깨에)
            ctx.save();
            ctx.translate(6, -18);

            // 카메라 본체
            ctx.fillStyle = darkGearColor;
            ctx.fillRect(0, -6, 14, 8);

            // 렌즈
            ctx.fillStyle = '#334155';
            ctx.beginPath();
            ctx.arc(14, -2, 3, -Math.PI/2, Math.PI/2);
            ctx.fill();

            // 렌즈 유리
            ctx.fillStyle = '#38bdf8';
            ctx.beginPath();
            ctx.arc(14, -2, 2, 0, Math.PI * 2);
            ctx.fill();

            // 뷰파인더
            ctx.fillStyle = darkGearColor;
            ctx.fillRect(2, -10, 6, 4);

            // 녹화 LED
            ctx.fillStyle = '#ef4444';
            ctx.beginPath();
            ctx.arc(1, -8, 1.5, 0, Math.PI * 2);
            ctx.fill();

            ctx.restore();

            // 팔 (카메라 지지)
            ctx.fillStyle = clothingColor;
            ctx.fillRect(4, -18, 4, 6);
            ctx.fillRect(-2, -20, 4, 4);
        }
        else if (id === 'infantry') { ctx.fillRect(-6, -20, 12, 20); ctx.beginPath(); ctx.arc(0, -24, 5, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = '#1e293b'; ctx.fillRect(2, -18, 10, 3); }
        else if (id === 'sniper') {
            const teamColor = this.team === 'player' ? '#3b82f6' : '#ef4444';
            ctx.fillStyle = teamColor; ctx.fillRect(-6, -20, 12, 20);
            ctx.fillStyle = '#475569'; ctx.fillRect(-8, -19, 16, 12);
            ctx.fillStyle = teamColor; ctx.beginPath(); ctx.arc(0, -24, 5, 0, Math.PI * 2); ctx.fill();
            ctx.fillStyle = '#334155'; ctx.beginPath(); ctx.arc(0, -26, 6, Math.PI, 0); ctx.fill(); ctx.fillRect(-8, -26, 16, 2);
            ctx.fillStyle = '#0f172a'; ctx.fillRect(0, -19, 26, 3);
            ctx.fillRect(10, -22, 8, 3);
            ctx.fillStyle = '#64748b'; ctx.fillRect(16, -21, 2, 2);
        }
        else if (id === 'special_ops') {
            const teamColor = this.team === 'player' ? '#3b82f6' : '#ef4444';
            ctx.fillStyle = '#334155'; ctx.fillRect(-10, -19, 6, 13);
            ctx.fillStyle = teamColor; ctx.fillRect(-6, -20, 12, 20);
            ctx.fillStyle = '#475569'; ctx.fillRect(-8, -19, 16, 12);
            ctx.fillStyle = teamColor; ctx.beginPath(); ctx.arc(0, -24, 5, 0, Math.PI * 2); ctx.fill();
            ctx.fillStyle = '#1f2937'; ctx.beginPath(); ctx.arc(0, -25, 6, Math.PI, 0); ctx.fill(); ctx.fillRect(-6, -25, 12, 2);
            ctx.fillStyle = '#0f172a'; ctx.fillRect(3, -18, 16, 3);
            ctx.fillRect(9, -20, 4, 2);
            ctx.fillRect(8, -15, 3, 4);
        }
        // [UPDATED] 공병 - 두 가지 모드 (carrying/firing)
        else if (id === 'engineer' || id === 'rpg') {
            const teamColor = this.team === 'player' ? '#3b82f6' : '#ef4444';
            const isFiring = this.engineerMode === 'firing';

            if (isFiring) {
                // === Firing Mode: RPG 조준 자세 ===
                // 몸통
                ctx.fillStyle = teamColor; ctx.fillRect(-6, -20, 12, 20);
                ctx.fillStyle = '#1e293b'; ctx.fillRect(-8, -19, 16, 11);
                ctx.fillStyle = '#334155'; ctx.fillRect(-6, -15, 4, 5); ctx.fillRect(2, -15, 4, 5);

                // 머리
                ctx.fillStyle = teamColor;
                ctx.beginPath(); ctx.arc(0, -24, 5, 0, Math.PI * 2); ctx.fill();
                ctx.fillStyle = '#111827'; ctx.fillRect(-2, -26, 6, 2.5);

                // RPG 발사관
                ctx.save();
                ctx.rotate(-0.1);
                ctx.fillStyle = '#4d7c0f'; ctx.fillRect(-12, -29, 32, 8);
                ctx.fillStyle = '#111827'; ctx.fillRect(-14, -30, 3, 10); ctx.fillRect(19, -30, 3, 10);
                ctx.fillStyle = '#374151'; ctx.fillRect(-4, -34, 10, 5);
                ctx.fillStyle = '#ef4444'; ctx.fillRect(3, -33, 2, 2);

                if ((this.missileFlash || 0) > 0) {
                    const flashAlpha = Math.min(1, (this.missileFlash || 0) / 7);
                    ctx.save();
                    ctx.globalAlpha = flashAlpha;
                    ctx.fillStyle = '#f59e0b';
                    ctx.beginPath();
                    ctx.moveTo(20, -25);
                    ctx.lineTo(31, -23);
                    ctx.lineTo(20, -21);
                    ctx.closePath();
                    ctx.fill();
                    ctx.fillStyle = '#fffbeb';
                    ctx.beginPath();
                    ctx.moveTo(20, -24.2);
                    ctx.lineTo(27, -23);
                    ctx.lineTo(20, -21.8);
                    ctx.closePath();
                    ctx.fill();
                    ctx.restore();
                }
                ctx.restore();

                // 팔
                ctx.fillStyle = teamColor;
                ctx.beginPath(); ctx.arc(-2, -18, 3.5, 0, Math.PI * 2); ctx.fill();
                ctx.beginPath(); ctx.arc(8, -18, 3.5, 0, Math.PI * 2); ctx.fill();
            } else {
                // === Carrying Mode: 등에 로켓, LMG 사용 ===
                // 등에 맨 로켓
                ctx.save();
                ctx.translate(-4, -25);
                ctx.rotate(-Math.PI / 2.8);
                ctx.fillStyle = '#4d7c0f'; ctx.fillRect(-16, -4, 32, 8);
                ctx.fillStyle = '#111827'; ctx.fillRect(-18, -5, 3, 10); ctx.fillRect(15, -5, 3, 10);
                ctx.strokeStyle = '#3f3f46'; ctx.lineWidth = 2;
                ctx.beginPath(); ctx.moveTo(-10, 0); ctx.lineTo(10, 0); ctx.stroke();
                ctx.restore();

                // 몸통
                ctx.fillStyle = teamColor; ctx.fillRect(-6, -20, 12, 20);
                ctx.fillStyle = '#1e293b'; ctx.fillRect(-8, -19, 16, 11);
                ctx.fillStyle = '#334155'; ctx.fillRect(-6, -15, 4, 5); ctx.fillRect(2, -15, 4, 5);

                // 머리
                ctx.fillStyle = teamColor;
                ctx.beginPath(); ctx.arc(0, -24, 5, 0, Math.PI * 2); ctx.fill();
                ctx.fillStyle = '#111827'; ctx.fillRect(-2, -26, 6, 2.5);

                // LMG
                const gunY = -4;
                ctx.fillStyle = '#0f172a';
                ctx.fillRect(-2, -15 + gunY, 4, 3);
                ctx.fillRect(2, -16 + gunY, 10, 5);
                ctx.fillRect(12, -15 + gunY, 7, 2);
                ctx.fillStyle = '#1e293b'; ctx.fillRect(12, -14 + gunY, 4, 2);
                ctx.fillStyle = '#3f6212';
                ctx.beginPath(); ctx.arc(6, -12 + gunY, 3, 0, Math.PI * 2); ctx.fill();

                // 팔
                ctx.fillStyle = teamColor;
                ctx.beginPath(); ctx.arc(8, -13 + gunY, 3, 0, Math.PI * 2); ctx.fill();
                ctx.beginPath(); ctx.arc(1, -14 + gunY, 3, 0, Math.PI * 2); ctx.fill();
            }
        }
        // [UPDATED] 특수부대 - 가방맨 디자인
        else if (id === 'special_forces') {
            const teamColor = this.team === 'player' ? '#3b82f6' : '#ef4444';
            ctx.fillStyle = '#0f172a'; ctx.fillRect(-10, -20, 6, 14); // 가방
            ctx.fillStyle = teamColor; ctx.fillRect(-6, -20, 12, 20); // 몸통
            ctx.fillStyle = '#111827'; ctx.fillRect(-6, -20, 12, 10); // 방탄복
            ctx.fillStyle = teamColor; ctx.beginPath(); ctx.arc(0, -24, 5, 0, Math.PI * 2); ctx.fill(); // 머리
            ctx.fillStyle = '#000000'; ctx.beginPath(); ctx.arc(0, -25, 5.5, Math.PI, 0); ctx.fill(); // 헬멧
            ctx.fillStyle = '#334155'; ctx.fillRect(2, -26, 4, 2); // 고글
            ctx.fillStyle = '#000'; ctx.fillRect(2, -18, 10, 3); ctx.fillRect(12, -18, 4, 1.5); // 총
        }
        else if (id === 'humvee') {
            const teamColor = this.team === 'player' ? '#3b82f6' : '#ef4444';
            const bodyMain = '#64748b';
            const bodyDark = '#475569';
            const tireColor = '#0f172a';
            const black = '#020617';
            const glass = '#1e293b';
            const useCombatTruck = (this.skinVariant === 'combat_truck');
            const HUMVEE_WHEEL_Y = 8;

            ctx.save();
            ctx.scale(1.1, 1.1);
            ctx.lineWidth = 1;
            ctx.lineJoin = 'round';
            ctx.strokeStyle = 'rgba(0,0,0,0.3)';

            if (useCombatTruck) {
                const drawWheel = (x, rOuter = 7) => {
                    ctx.fillStyle = '#000';
                    ctx.beginPath(); ctx.arc(x, HUMVEE_WHEEL_Y, rOuter, 0, Math.PI * 2); ctx.fill();
                    ctx.fillStyle = '#4a5568';
                    ctx.beginPath(); ctx.arc(x, HUMVEE_WHEEL_Y, Math.max(3, rOuter * 0.5), 0, Math.PI * 2); ctx.fill();
                };

                ctx.fillStyle = '#2d3748';
                ctx.fillRect(-36, 4, 74, 7);

                // Combat truck body
                ctx.fillStyle = '#4a5568';
                ctx.beginPath();
                ctx.moveTo(-34, 4);
                ctx.lineTo(-32, -8);
                ctx.lineTo(-16, -12);
                ctx.lineTo(12, -12);
                ctx.lineTo(30, -5);
                ctx.lineTo(36, 4);
                ctx.closePath();
                ctx.fill();
                ctx.stroke();

                // Rear troop bed
                ctx.fillStyle = '#2d3748';
                ctx.fillRect(-10, -2, 44, 8);
                ctx.strokeRect(-10, -2, 44, 8);

                // Cabin window
                ctx.fillStyle = '#1a202c';
                ctx.beginPath();
                ctx.moveTo(-15, -9);
                ctx.lineTo(8, -9);
                ctx.lineTo(13, -3);
                ctx.lineTo(-14, -3);
                ctx.closePath();
                ctx.fill();

                // Team stripe
                ctx.fillStyle = teamColor;
                ctx.fillRect(-6, -1, 14, 3);

                // Turret + barrel
                ctx.fillStyle = '#1a202c';
                ctx.fillRect(8, -16, 13, 4);
                ctx.fillStyle = '#2d3748';
                ctx.fillRect(16, -15, 18, 2);
                ctx.fillStyle = '#000';
                ctx.fillRect(33, -15, 4, 2);

                // Wheels are drawn last to stay above body layer.
                drawWheel(-25);
                drawWheel(10);
                drawWheel(28);
            } else {
                // Wheels
                const drawWheel = (x) => {
                    ctx.fillStyle = tireColor;
                    ctx.beginPath(); ctx.arc(x, HUMVEE_WHEEL_Y, 6.5, 0, Math.PI * 2); ctx.fill();
                    ctx.fillStyle = '#334155';
                    ctx.beginPath(); ctx.arc(x, HUMVEE_WHEEL_Y, 3, 0, Math.PI * 2); ctx.fill();
                };

                // Body (Slant back styling)
                ctx.fillStyle = bodyMain;
                ctx.beginPath();
                ctx.moveTo(35, 6); // Front bumper
                ctx.lineTo(35, 2);
                ctx.lineTo(28, 0); // Hood front
                ctx.lineTo(18, -1); // Hood top
                ctx.lineTo(12, -11); // Windshield base
                ctx.lineTo(-10, -11); // Roof start
                ctx.lineTo(-35, -3); // Slant back
                ctx.lineTo(-38, 6); // Rear bumper
                ctx.lineTo(-20, 6); // Wheel arch
                ctx.lineTo(-15, 6);
                ctx.lineTo(35, 6);
                ctx.closePath();
                ctx.fill();
                ctx.stroke();

                // Door Team Stripe
                ctx.fillStyle = teamColor;
                ctx.fillRect(-10, 0, 16, 3);

                // Windows (Side + Windshield)
                ctx.fillStyle = glass;
                ctx.beginPath();
                ctx.moveTo(8, -9); ctx.lineTo(14, -4); ctx.lineTo(-8, -4); ctx.lineTo(-8, -9);
                ctx.closePath();
                ctx.fill();
                // Rear small window
                ctx.beginPath();
                ctx.moveTo(-12, -9); ctx.lineTo(-12, -5); ctx.lineTo(-20, -6); ctx.lineTo(-22, -8);
                ctx.closePath();
                ctx.fill();

                // Turret
                ctx.fillStyle = bodyDark; ctx.fillRect(-2, -16, 12, 3); // Base
                ctx.fillStyle = black; ctx.fillRect(2, -15, 18, 1.5); // Gun
                ctx.fillRect(0, -17, 6, 2.5); // Shield

                // Wheels are drawn last to stay above body layer.
                drawWheel(-25);
                drawWheel(25);
            }

            ctx.restore();
        }
        else if (id === 'mbt') {
            const teamColor = this.team === 'player' ? '#3b82f6' : '#ef4444';
            const bodyMain = '#64748b';
            const bodyDark = '#475569';
            const bodyLight = '#94a3b8';
            const tireColor = '#0f172a';
            const black = '#020617';
            const glass = '#1e293b';
            const glassHighlight = 'rgba(255, 255, 255, 0.3)';

            ctx.save();
            ctx.scale(1.12, 1.12);
            ctx.translate(0, -22);
            ctx.lineWidth = 1;
            ctx.lineJoin = 'round';
            ctx.strokeStyle = 'rgba(0,0,0,0.3)';

            const roundRect = (x, y, w, h, r) => {
                ctx.beginPath();
                ctx.moveTo(x + r, y);
                ctx.arcTo(x + w, y, x + w, y + h, r);
                ctx.arcTo(x + w, y + h, x, y + h, r);
                ctx.arcTo(x, y + h, x, y, r);
                ctx.arcTo(x, y, x + w, y, r);
                ctx.closePath();
            };

            // Tracks
            ctx.fillStyle = tireColor;
            roundRect(-40, 10, 80, 12, 5);
            ctx.fill();
            ctx.fillStyle = bodyDark;
            for (let i = 0; i < 6; i++) {
                ctx.beginPath();
                ctx.arc(-30 + (i * 12), 16, 4, 0, Math.PI * 2);
                ctx.fill();
            }

            // Hull
            ctx.fillStyle = bodyMain;
            ctx.beginPath();
            ctx.moveTo(-42, 10);
            ctx.lineTo(38, 10);
            ctx.lineTo(42, 4);
            ctx.lineTo(-40, 4);
            ctx.closePath();
            ctx.fill();
            ctx.stroke();

            // Skirt & Team Color
            ctx.fillStyle = bodyDark;
            ctx.fillRect(-42, 8, 84, 4);
            ctx.fillStyle = teamColor;
            ctx.fillRect(-20, 9, 40, 2);

            const iconBackTurret = this.iconRenderBackTurret === true;
            const drawMbtMainGun = () => {
                ctx.fillStyle = bodyDark;
                ctx.fillRect(10, -8, 60, 4);
                ctx.fillStyle = bodyLight;
                ctx.fillRect(35, -9, 8, 6);
                ctx.fillStyle = black;
                ctx.fillRect(70, -8, 2, 4);
            };
            if (iconBackTurret) {
                drawMbtMainGun();
            }

            // Turret
            ctx.fillStyle = bodyMain;
            ctx.beginPath();
            ctx.moveTo(15, 4);
            ctx.lineTo(30, 0);
            ctx.lineTo(20, -12);
            ctx.lineTo(-25, -14);
            ctx.lineTo(-45, -10);
            ctx.lineTo(-35, 4);
            ctx.closePath();
            ctx.fill();
            ctx.stroke();

            if (!iconBackTurret) {
                drawMbtMainGun();
            }

            // Optics
            ctx.fillStyle = glass;
            ctx.fillRect(-5, -15, 8, 3);
            ctx.fillStyle = glassHighlight;
            ctx.fillRect(-4, -14, 2, 1);

            // [NEW] Turret MG (top)
            ctx.fillStyle = black;
            ctx.fillRect(6, -20, 12, 3);   // base
            ctx.fillRect(16, -21, 14, 2);  // barrel
            ctx.fillStyle = bodyLight;
            ctx.fillRect(6, -21, 6, 2);    // shield

            // [NEW] MG muzzle flash
            if (typeof game !== 'undefined' && Number.isFinite(game.frame) && (game.frame - this._mgLastShotFrame) <= 2) {
                ctx.fillStyle = '#fbbf24';
                ctx.beginPath();
                ctx.moveTo(30, -20);
                ctx.lineTo(36, -22);
                ctx.lineTo(36, -18);
                ctx.closePath();
                ctx.fill();
            }

            ctx.restore();
        }
        else if (id === 'spg') {
            const teamColor = this.team === 'player' ? '#3b82f6' : '#ef4444';
            const bodyMain = '#64748b';
            const bodyDark = '#475569';
            const tireColor = '#0f172a';
            const black = '#020617';

            ctx.save();
            ctx.scale(1.15, 1.15);
            ctx.translate(0, -16.5);
            ctx.lineWidth = 1;
            ctx.lineJoin = 'round';
            ctx.strokeStyle = 'rgba(0,0,0,0.3)';

            const roundRect = (x, y, w, h, r) => {
                ctx.beginPath();
                ctx.moveTo(x + r, y);
                ctx.arcTo(x + w, y, x + w, y + h, r);
                ctx.arcTo(x + w, y + h, x, y + h, r);
                ctx.arcTo(x, y + h, x, y, r);
                ctx.arcTo(x, y, x + w, y, r);
                ctx.closePath();
            };

            ctx.fillStyle = tireColor;
            roundRect(-40, 10, 80, 12, 5);
            ctx.fill();
            ctx.fillStyle = bodyDark;
            for (let i = 0; i < 6; i++) {
                ctx.beginPath();
                ctx.arc(-30 + (i * 12), 16, 4, 0, Math.PI * 2);
                ctx.fill();
            }

            ctx.fillStyle = bodyMain;
            ctx.beginPath();
            ctx.moveTo(-42, 10);
            ctx.lineTo(38, 10);
            ctx.lineTo(35, 0);
            ctx.lineTo(-42, 0);
            ctx.closePath();
            ctx.fill();
            ctx.stroke();

            ctx.translate(-10, 0);
            const iconBackTurret = this.iconRenderBackTurret === true;
            const drawSpgMainGun = () => {
                ctx.save();
                ctx.rotate(-Math.PI / 12);
                ctx.fillStyle = bodyDark;
                ctx.fillRect(15, -8, 80, 5);
                ctx.fillStyle = black;
                ctx.fillRect(90, -9, 8, 7);
                ctx.restore();
            };
            if (iconBackTurret) {
                drawSpgMainGun();
            }

            ctx.fillStyle = bodyMain;
            ctx.beginPath();
            ctx.moveTo(20, 0);
            ctx.lineTo(25, -10);
            ctx.lineTo(-30, -10);
            ctx.lineTo(-35, 0);
            ctx.closePath();
            ctx.fill();
            ctx.stroke();

            ctx.fillStyle = teamColor;
            ctx.fillRect(-25, -6, 10, 3);

            if (!iconBackTurret) {
                drawSpgMainGun();
            }

            ctx.restore();
        }
        else if (id === 'icbm' || id === 'icbm_enemy') {
            const teamColor = this.team === 'player' ? '#3b82f6' : '#ef4444';
            const TEL_WIDTH = 360;
            const TEL_HEIGHT = 50;
            const WHEEL_RADIUS = 16;
            const SCALE = 0.44;
            const angle = Math.max(0, Math.min(90, Number(this.icbmAngle) || 0));
            const launchState = this.icbmLaunchState || 'idle';
            const payloadKey = (this.icbmLaunchRequest && this.icbmLaunchRequest.payloadKey) ? this.icbmLaunchRequest.payloadKey : 'nuke';
            const canLength = 230;
            const canThick = 54;
            const capOpen = (launchState === 'firing' || launchState === 'cooldown' || launchState === 'lowering' || this.icbmHasFired);
            const showLoadedMissile = !this.icbmHasFired;

            let missilePalette = { body: '#e2e8f0', nose: '#cbd5e1', band: '#facc15', fin: '#475569' };
            if (payloadKey === 'tactical_missile') {
                missilePalette = { body: '#f3f4f6', nose: '#ef4444', band: '#f59e0b', fin: '#64748b' };
            } else if (payloadKey === 'emp') {
                missilePalette = { body: '#dbeafe', nose: '#60a5fa', band: '#2563eb', fin: '#334155' };
            }

            ctx.save();
            ctx.scale(SCALE, SCALE);
            ctx.translate(-TEL_WIDTH / 2, -(TEL_HEIGHT + WHEEL_RADIUS * 2));

            const wheelPositions = [20, 50, 80, 150, 180, 210, 240, 270];
            for (let i = 0; i < wheelPositions.length; i++) {
                const wx = wheelPositions[i];
                ctx.fillStyle = '#1c1c1c';
                ctx.beginPath();
                ctx.arc(wx, TEL_HEIGHT + WHEEL_RADIUS, WHEEL_RADIUS, 0, Math.PI * 2);
                ctx.fill();
                ctx.fillStyle = '#2f352b';
                ctx.beginPath();
                ctx.arc(wx, TEL_HEIGHT + WHEEL_RADIUS, WHEEL_RADIUS * 0.5, 0, Math.PI * 2);
                ctx.fill();
            }

            ctx.fillStyle = '#3b4d32';
            ctx.fillRect(0, 15, TEL_WIDTH - 10, TEL_HEIGHT - 15);
            ctx.fillStyle = '#4a5e40';
            ctx.fillRect(100, 20, 40, 25);
            ctx.fillRect(290, 20, 40, 25);
            ctx.fillStyle = '#111';
            ctx.fillRect(90, 35, 15, 25);
            ctx.fillRect(280, 35, 15, 25);

            ctx.fillStyle = '#425239';
            ctx.beginPath();
            ctx.moveTo(0, 50);
            ctx.lineTo(-20, 50);
            ctx.lineTo(-20, 10);
            ctx.lineTo(0, 0);
            ctx.lineTo(70, 0);
            ctx.lineTo(70, 50);
            ctx.closePath();
            ctx.fill();
            ctx.fillStyle = 'rgba(60, 75, 90, 0.8)';
            ctx.fillRect(-15, 10, 15, 15);
            ctx.fillRect(5, 10, 25, 15);
            ctx.strokeStyle = '#35422e';
            ctx.lineWidth = 2;
            ctx.strokeRect(-15, 10, 15, 15);
            ctx.strokeRect(5, 10, 25, 15);

            ctx.save();
            ctx.translate(340, 10);
            ctx.rotate(angle * Math.PI / 180);

            if (showLoadedMissile) {
                const missilePos = -20;
                const mLen = 220;
                const mThick = 40;
                ctx.fillStyle = missilePalette.body;
                ctx.fillRect(missilePos - mLen, -26, mLen, mThick);
                ctx.fillStyle = missilePalette.nose;
                ctx.beginPath();
                ctx.moveTo(missilePos - mLen, -26);
                ctx.lineTo(missilePos - mLen - 30, -26 + mThick / 2);
                ctx.lineTo(missilePos - mLen, -26 + mThick);
                ctx.closePath();
                ctx.fill();
                ctx.fillStyle = missilePalette.band;
                ctx.fillRect(missilePos - 65, -26, 6, mThick);
                ctx.fillStyle = missilePalette.fin;
                ctx.beginPath();
                ctx.moveTo(missilePos - 10, -26);
                ctx.lineTo(missilePos, -31);
                ctx.lineTo(missilePos - 5, -26);
                ctx.closePath();
                ctx.fill();
                ctx.beginPath();
                ctx.moveTo(missilePos - 10, -26 + mThick);
                ctx.lineTo(missilePos, -21 + mThick);
                ctx.lineTo(missilePos - 5, -26 + mThick);
                ctx.closePath();
                ctx.fill();
            }

            ctx.fillStyle = '#4f6146';
            ctx.fillRect(-canLength, -canThick / 2, canLength + 20, canThick);
            ctx.fillStyle = '#3e4f36';
            for (let i = 1; i < 5; i++) {
                ctx.fillRect(-canLength + (i * 45), -canThick / 2, 10, canThick);
            }

            if (!capOpen) {
                ctx.fillStyle = '#3a4a32';
                ctx.beginPath();
                ctx.arc(-canLength, 0, canThick / 2 + 2, Math.PI * 0.5, Math.PI * 1.5);
                ctx.fill();
            }

            ctx.fillStyle = '#2b3326';
            ctx.fillRect(-150, canThick / 2, 120, 10);

            if ((this.icbmMuzzleFlash || 0) > 0) {
                const alpha = Math.min(1, (this.icbmMuzzleFlash || 0) / 8);
                ctx.save();
                ctx.globalAlpha = alpha;
                ctx.fillStyle = '#f59e0b';
                ctx.beginPath();
                ctx.moveTo(-20, -21);
                ctx.lineTo(26, -6);
                ctx.lineTo(-20, 9);
                ctx.closePath();
                ctx.fill();
                ctx.fillStyle = '#fffbeb';
                ctx.beginPath();
                ctx.moveTo(-20, -16);
                ctx.lineTo(6, -6);
                ctx.lineTo(-20, 4);
                ctx.closePath();
                ctx.fill();
                ctx.restore();
            }

            ctx.restore();

            ctx.fillStyle = teamColor;
            ctx.fillRect(120, 15, 54, 4);
            ctx.restore();
        }
        else if (id === 'apache') {
            const teamColor = (this.team === 'player') ? '#3b82f6' : '#ef4444';
            const missileFlash = (this.missileFlash || 0);

            ctx.save();
            ctx.scale(1.2, 1.2);

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

            // Main Body (match bomber body color)
            ctx.fillStyle = '#334155';
            ctx.beginPath();
            ctx.moveTo(20, 5);
            ctx.lineTo(25, -5);
            ctx.lineTo(-10, -10);
            ctx.lineTo(-15, 5);
            ctx.fill();

            // Team marking (subtle)
            ctx.fillStyle = teamColor;
            ctx.fillRect(-6, -2, 10, 2);

            // Windows (Pilot & Gunner)
            ctx.fillStyle = '#000';
            ctx.beginPath(); ctx.moveTo(12, -5); ctx.lineTo(18, -5); ctx.lineTo(16, -8); ctx.lineTo(14, -8); ctx.fill();
            ctx.beginPath(); ctx.moveTo(2, -8); ctx.lineTo(8, -8); ctx.lineTo(6, -11); ctx.lineTo(4, -11); ctx.fill();

            // Wing Stub & Weapons
            ctx.fillStyle = '#1e293b';
            ctx.fillRect(0, 0, 10, 8);
            ctx.fillStyle = '#000';
            ctx.fillRect(2, 6, 6, 4);
            if (missileFlash > 0) {
                const flashAlpha = Math.min(1, missileFlash / 6);
                ctx.save();
                ctx.globalAlpha = flashAlpha;
                ctx.fillStyle = '#f59e0b';
                ctx.beginPath();
                ctx.moveTo(8, 10);
                ctx.lineTo(14, 12);
                ctx.lineTo(8, 14);
                ctx.closePath();
                ctx.fill();
                ctx.restore();
            }

            // Main Rotor
            ctx.fillStyle = '#000';
            ctx.fillRect(-30, -12, 60, 3);
            ctx.fillRect(-5, -15, 10, 5); // Rotor Mast

            ctx.restore();
        }

        // [UPDATED] 수송헬기 UH-60 - 새로운 디자인
        else if (id === 'blackhawk' || id === 'uh60') {
            const teamColor = this.team === 'player' ? '#3b82f6' : '#ef4444';

            // 스케일 축소 (과대 사이즈 조정)
            ctx.save();
            ctx.scale(1.6, 1.6);

            // 테일 로터 배경
            ctx.fillStyle = '#1e293b'; ctx.fillRect(-45, -5, 30, 6);

            // 테일 로터 회전
            ctx.save(); ctx.translate(-45, -5);
            ctx.rotate(this.rotorAngle * 3);
            ctx.fillStyle = '#000'; ctx.fillRect(-2, -10, 4, 20);
            ctx.restore();

            // 몸체
            ctx.fillStyle = '#334155';
            ctx.beginPath();
            ctx.moveTo(25, 0); ctx.lineTo(20, -8); ctx.lineTo(-20, -10);
            ctx.lineTo(-25, 5); ctx.lineTo(20, 5);
            ctx.fill();

            // 조종석/엔진룸
            ctx.fillStyle = '#0f172a'; ctx.fillRect(-10, -5, 15, 8);
            ctx.fillStyle = '#000'; ctx.fillRect(15, -6, 6, 4);

            // 硫붿씤 濡쒗꽣 (?쇱옄)
            // 메인 로터
            ctx.fillStyle = '#000';
            ctx.fillRect(-35, -12, 70, 2);
            ctx.fillRect(-2, -14, 4, 4);
            // 팀 마킹
            ctx.fillStyle = teamColor; ctx.fillRect(-5, -2, 20, 2);

            ctx.restore(); // 스케일 복원
        }
        else if (false) { // DEAD CODE - TO BE REMOVED
            ctx.fillStyle = '#000';
            // ?뚯쟾 ?④낵: ?덈퉬媛 以꾩뼱?ㅼ뿀???섏뼱?щ떎 ??
            ctx.fillRect(-mainRotor.w / 2, -mainRotor.h / 2, mainRotor.w, mainRotor.h);
            ctx.restore();

            // 瑗щ━ 濡쒗꽣
            // Tail Rotor
            ctx.save();
            ctx.translate(tailRotor.x, tailRotor.y);
            ctx.rotate(this.rotorAngle * tailRotor.speedMul);
            ctx.fillStyle = '#333';
            ctx.fillRect(-tailRotor.w / 2, -tailRotor.h / 2, tailRotor.w, tailRotor.h);
            ctx.restore();
        }
        else if (id === 'chinook') {
            // Chinook body
            ctx.fillStyle = '#4b5563';
            ctx.beginPath();
            ctx.moveTo(-43, -14); ctx.lineTo(43, -14); ctx.lineTo(50, 7);
            ctx.lineTo(-50, 7); ctx.lineTo(-50, -29);
            ctx.fill();
            ctx.fillStyle = '#1f2937';
            ctx.fillRect(-34, 6, 8, 4);
            ctx.fillRect(22, 6, 8, 4);

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
        // [UPDATED] APC - 새로운 디자인
        else if (id === 'apc') {
            const teamColor = this.team === 'player' ? '#3b82f6' : '#ef4444';
            const bodyMain = '#64748b';
            const bodyDark = '#475569';
            const tireColor = '#0f172a';
            const black = '#020617';
            const glass = '#1e293b';
            const glassHighlight = 'rgba(255, 255, 255, 0.3)';

            const design = {
                body: [
                    { x: 35, y: -5 }, { x: 29, y: -11 }, { x: 25, y: -15 },
                    { x: -25, y: -15 }, { x: -35, y: -10 }, { x: -35, y: -5 },
                    { x: -35, y: 0 }, { x: -31, y: 7 }, { x: 27, y: 7 }
                ],
                window: [
                    { x: 24, y: -13 }, { x: 32, y: -6 }, { x: 26, y: -6 }
                ],
                wheels: [
                    { x: -21, y: 7 }, { x: -1, y: 7 }, { x: 17, y: 7 }
                ],
                turret: { x: -3, y: -20 }
            };

            ctx.save();
            ctx.scale(1.08, 1.08);
            ctx.translate(0, -15);
            ctx.lineWidth = 1;
            ctx.lineJoin = 'round';
            ctx.strokeStyle = 'rgba(0,0,0,0.3)';

            // Body
            ctx.fillStyle = bodyMain;
            ctx.beginPath();
            ctx.moveTo(design.body[0].x, design.body[0].y);
            for (let i = 1; i < design.body.length; i++) {
                ctx.lineTo(design.body[i].x, design.body[i].y);
            }
            ctx.closePath();
            ctx.fill();
            ctx.stroke();

            // Team stripe
            ctx.fillStyle = teamColor;
            ctx.fillRect(-20, -5, 40, 3);

            // Detail line
            ctx.beginPath();
            ctx.moveTo(-25, -2);
            ctx.lineTo(25, -2);
            ctx.stroke();

            // Window
            ctx.fillStyle = glass;
            ctx.beginPath();
            ctx.moveTo(design.window[0].x, design.window[0].y);
            for (let i = 1; i < design.window.length; i++) {
                ctx.lineTo(design.window[i].x, design.window[i].y);
            }
            ctx.closePath();
            ctx.fill();

            // Highlight
            ctx.fillStyle = glassHighlight;
            ctx.beginPath();
            ctx.moveTo(design.window[0].x + 2, design.window[0].y + 2);
            ctx.lineTo(design.window[0].x + 5, design.window[0].y + 2);
            ctx.lineTo(design.window[0].x + 2, design.window[0].y + 5);
            ctx.fill();

            // Turret
            ctx.save();
            ctx.translate(design.turret.x, design.turret.y);
            ctx.fillStyle = black;
            ctx.fillRect(-10, -5, 20, 10);
            ctx.fillStyle = '#000';
            ctx.fillRect(10, -2, 16, 4);
            ctx.fillStyle = bodyDark;
            ctx.fillRect(-5, -4, 10, 2);
            ctx.restore();

            // Wheels
            design.wheels.forEach(w => {
                ctx.fillStyle = tireColor;
                ctx.beginPath();
                ctx.arc(w.x, w.y, 6.5, 0, Math.PI * 2);
                ctx.fill();
                ctx.fillStyle = bodyDark;
                ctx.beginPath();
                ctx.arc(w.x, w.y, 3, 0, Math.PI * 2);
                ctx.fill();
            });

            ctx.restore();
        }
        else if (id === 'aa_tank') {
            const teamColor = this.team === 'player' ? '#3b82f6' : '#ef4444';
            const bodyMain = '#64748b';
            const bodyDark = '#475569';
            const bodyLight = '#94a3b8';
            const tireColor = '#0f172a';
            const black = '#020617';

            ctx.save();
            ctx.scale(1.25, 1.25);
            ctx.translate(0, -20);
            ctx.lineWidth = 1;
            ctx.lineJoin = 'round';
            ctx.strokeStyle = 'rgba(0,0,0,0.3)';

            const roundRect = (x, y, w, h, r) => {
                ctx.beginPath();
                ctx.moveTo(x + r, y);
                ctx.arcTo(x + w, y, x + w, y + h, r);
                ctx.arcTo(x + w, y + h, x, y + h, r);
                ctx.arcTo(x, y + h, x, y, r);
                ctx.arcTo(x, y, x + w, y, r);
                ctx.closePath();
            };

            ctx.fillStyle = tireColor;
            roundRect(-35, 10, 70, 12, 5);
            ctx.fill();
            ctx.fillStyle = bodyDark;
            for (let i = 0; i < 5; i++) {
                ctx.beginPath();
                ctx.arc(-25 + (i * 12), 16, 4, 0, Math.PI * 2);
                ctx.fill();
            }

            ctx.fillStyle = bodyMain;
            ctx.beginPath();
            ctx.moveTo(-38, 10);
            ctx.lineTo(35, 10);
            ctx.lineTo(32, 0);
            ctx.lineTo(-38, 0);
            ctx.closePath();
            ctx.fill();
            ctx.stroke();
            ctx.fillStyle = teamColor;
            ctx.fillRect(-38, 4, 70, 2);

            const iconBackTurret = this.iconRenderBackTurret === true;
            const drawAaLauncher = () => {
                ctx.save();
                ctx.translate(5, -5);
                ctx.rotate(-Math.PI / 4);
                ctx.fillStyle = bodyDark;
                ctx.fillRect(0, -4, 15, 8);
                ctx.fillStyle = black;
                ctx.fillRect(15, -3, 25, 2);
                ctx.fillRect(15, 1, 25, 2);
                ctx.restore();
            };
            if (iconBackTurret) {
                drawAaLauncher();
            }

            ctx.fillStyle = bodyMain;
            ctx.beginPath();
            ctx.moveTo(10, 0);
            ctx.lineTo(15, -10);
            ctx.lineTo(-20, -10);
            ctx.lineTo(-25, 0);
            ctx.closePath();
            ctx.fill();
            ctx.stroke();

            // Radar
            ctx.fillStyle = bodyLight;
            ctx.fillRect(-28, -25, 12, 15);
            ctx.strokeRect(-28, -25, 12, 15);

            if (!iconBackTurret) {
                drawAaLauncher();
            }

            ctx.restore();
        }
        else if (id === 'fighter') {
            const teamColor = this.team === 'player' ? '#3b82f6' : '#ef4444';
            const bodyMain = '#64748b';
            const bodyDark = '#475569';
            const bodyLight = '#94a3b8';
            const glass = '#1e293b';
            const glassHighlight = 'rgba(255, 255, 255, 0.3)';

            ctx.save();
            ctx.scale(0.8, 0.8);
            ctx.lineWidth = 1;
            ctx.lineJoin = 'round';
            ctx.strokeStyle = 'rgba(0,0,0,0.3)';

            ctx.fillStyle = bodyMain;
            ctx.beginPath();
            ctx.moveTo(60, 5);
            ctx.lineTo(20, 0);
            ctx.lineTo(-20, 0);
            ctx.lineTo(-45, -5);
            ctx.lineTo(-50, 5);
            ctx.lineTo(-45, 10);
            ctx.lineTo(0, 12);
            ctx.lineTo(40, 10);
            ctx.closePath();
            ctx.fill();
            ctx.stroke();

            // Rear wing (smaller)
            ctx.fillStyle = bodyDark;
            ctx.beginPath();
            ctx.moveTo(-32, -1);
            ctx.lineTo(-38, -16);
            ctx.lineTo(-28, -16);
            ctx.lineTo(-20, -1);
            ctx.closePath();
            ctx.fill();
            ctx.stroke();
            ctx.fillStyle = teamColor;
            ctx.fillRect(-45, -20, 10, 3);

            // Front wing (larger + wider)
            ctx.fillStyle = bodyLight;
            ctx.beginPath();
            ctx.moveTo(8, 6);
            ctx.lineTo(-36, 20);
            ctx.lineTo(-6, 6);
            ctx.closePath();
            ctx.fill();
            ctx.stroke();

            // Cockpit (slightly larger, attached, lower)
            ctx.fillStyle = glass;
            ctx.beginPath();
            ctx.ellipse(12, -1, 13.5, 5.5, 0, Math.PI, 0);
            ctx.fill();
            ctx.fillStyle = glassHighlight;
            ctx.beginPath();
            ctx.ellipse(10, -2, 4.5, 2.2, 0, Math.PI, 0);
            ctx.fill();

            ctx.fillStyle = '#cbd5e1';
            ctx.fillRect(-10, 16, 25, 2);
            ctx.fillStyle = teamColor;
            ctx.fillRect(12, 16, 3, 2);

            // [NEW] 미사일 비주얼 (missileChargesLeft > 0 일 때만)
            if (this.missileChargesLeft > 0) {
                ctx.fillStyle = '#e5e7eb';
                ctx.fillRect(-8, 20, 14, 3);     // 미사일 몸통
                ctx.fillStyle = '#dc2626';
                ctx.beginPath();
                ctx.moveTo(6, 21.5);
                ctx.lineTo(3, 19); ctx.lineTo(3, 24);
                ctx.closePath(); ctx.fill();       // 탄두(빨강)
                ctx.fillStyle = '#475569';
                ctx.fillRect(-10, 19, 2, 5);       // 꼬리 날개
            }

            // Afterburner removed

            ctx.restore();
        }
        // [R 4.2 FIX] 자폭드론 - 쿼드(네모) 디자인 (약한 폭발)
        else if (id === 'drone_suicide') {
            const teamColor = this.team === 'player' ? '#3b82f6' : '#ef4444';
            // 스케일 다운
            ctx.save();
            const baseScale = 0.52;
            const facing = (this.facing != null) ? this.facing : 1;
            const sx = (facing < 0 ? -1 : 1) * baseScale;
            ctx.scale(sx, baseScale);

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
            const baseScale = 0.52;
            const facing = (this.facing != null) ? this.facing : 1;
            const sx = (facing < 0 ? -1 : 1) * baseScale;
            ctx.scale(sx, baseScale);

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
        // [RECON] 정찰기 (Global Hawk 스타일)
        else if (id === 'recon') {
            ctx.save();
            ctx.scale(0.5, 0.5);
            const teamColor = this.team === 'player' ? '#3b82f6' : '#ef4444';
            const bodyColor = '#cbd5e1';
            const darkColor = '#475569';

            // Fuselage (동체)
            ctx.fillStyle = bodyColor;
            ctx.beginPath();
            ctx.moveTo(30, 5);
            ctx.bezierCurveTo(35, -10, 10, -15, -10, -12);
            ctx.lineTo(-40, -5);
            ctx.lineTo(-35, 2);
            ctx.lineTo(20, 10);
            ctx.fill();

            // V-Tail
            ctx.fillStyle = darkColor;
            ctx.beginPath();
            ctx.moveTo(-30, -5);
            ctx.lineTo(-45, -20);
            ctx.lineTo(-38, -5);
            ctx.fill();

            // Engine Intake
            ctx.fillStyle = '#334155';
            ctx.beginPath();
            ctx.ellipse(-5, -14, 8, 4, 0, 0, Math.PI * 2);
            ctx.fill();

            // Main Wing
            ctx.fillStyle = '#64748b';
            ctx.beginPath();
            ctx.moveTo(5, -5);
            ctx.lineTo(-15, -2);
            ctx.lineTo(-20, 2);
            ctx.lineTo(0, 2);
            ctx.fill();

            // Sensor Pod
            ctx.fillStyle = '#0f172a';
            ctx.beginPath();
            ctx.arc(15, 10, 4, 0, Math.PI);
            ctx.fill();
            ctx.fillStyle = '#38bdf8';
            ctx.beginPath();
            ctx.arc(16, 11, 1.5, 0, Math.PI * 2);
            ctx.fill();

            // Team ID Strip
            ctx.fillStyle = teamColor;
            ctx.fillRect(-15, -8, 10, 4);

            ctx.restore();
        }

        ctx.restore();
        drawHpBar();
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

// [NEW] Smoke grenade FX (simple radial puffs)
class SmokeCloudFX {
    constructor(x, y, opts = {}) {
        this.x = x;
        this.y = y;
        this.puffs = [];
        this.life = 1;
        this.age = 0;
        this.team = (opts && opts.team) ? opts.team : null;

        this.emitFrames = Number.isFinite(opts.emitFrames) ? opts.emitFrames : 200;
        this.maxFrames = Number.isFinite(opts.maxFrames) ? opts.maxFrames : 480;
        this.spawnEvery = Number.isFinite(opts.spawnEvery) ? opts.spawnEvery : 3;
        this.spawnCount = Number.isFinite(opts.spawnCount) ? opts.spawnCount : 3;
        this.spread = Number.isFinite(opts.spread) ? opts.spread : 26;
    }

    _spawnPuff() {
        const tone = Math.floor(210 + Math.random() * 35);
        this.puffs.push({
            x: this.x + (Math.random() - 0.5) * this.spread,
            y: this.y + (Math.random() - 0.5) * 6,
            vx: (Math.random() - 0.5) * 1.6,
            vy: -(0.6 + Math.random() * 1.6),
            r: 6 + Math.random() * 10,
            alpha: 0.10 + Math.random() * 0.16,
            decay: 0.0018 + Math.random() * 0.003,
            growth: 0.28 + Math.random() * 0.45,
            rgb: `${tone}, ${tone}, ${tone}`
        });
    }

    update() {
        this.age++;
        if (this.age <= this.emitFrames && this.age % this.spawnEvery === 0) {
            for (let i = 0; i < this.spawnCount; i++) this._spawnPuff();
        }

        for (let i = this.puffs.length - 1; i >= 0; i--) {
            const p = this.puffs[i];
            p.x += p.vx;
            p.y += p.vy;
            p.vx += (Math.random() - 0.5) * 0.05;
            p.vx *= 0.98;
            p.vy *= 0.99;
            p.r += p.growth;
            p.alpha -= p.decay;
            if (p.alpha <= 0) this.puffs.splice(i, 1);
        }

        if (this.age > this.maxFrames && this.puffs.length === 0) {
            this.life = 0;
        }
    }

    draw(ctx) {
        if (this.puffs.length === 0) return;
        for (const p of this.puffs) {
            const grad = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.r);
            grad.addColorStop(0, `rgba(${p.rgb}, ${p.alpha})`);
            grad.addColorStop(1, `rgba(${p.rgb}, 0)`);
            ctx.fillStyle = grad;
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
            ctx.fill();
        }
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

// ==================== Wreckage (파괴된 기갑 유닛 잔해) ====================
class Wreckage {
    constructor(unitId, x, y, facing, team) {
        this.unitId = unitId;       // 원본 유닛 타입 (humvee, mbt, apc 등)
        this.x = x;
        this.y = y;
        this.facing = facing || 1;  // 좌우 방향
        this.team = team;
        this.life = 1.0;            // 1.0 → 0.0 fade
        this.maxLife = 900;         // 15초 (60fps 기준)
        this.age = 0;
        this.smokeTimer = 0;
        this.tilt = (Math.random() - 0.5) * 0.1; // 약간의 기울어짐
    }

    update() {
        this.age++;
        // 70% 지점부터 fade out 시작
        if (this.age > this.maxLife * 0.7) {
            this.life = 1 - (this.age - this.maxLife * 0.7) / (this.maxLife * 0.3);
        }
        if (this.life <= 0) this.life = 0;

        // 간헐적 연기 이펙트 (life > 0.3 일 때만)
        this.smokeTimer++;
        if (this.smokeTimer > 25 && this.life > 0.3) {
            this.smokeTimer = 0;
            if (typeof game !== 'undefined' && game.createParticles) {
                game.createParticles(this.x + (Math.random() - 0.5) * 20, this.y - 15, 2, '#333');
            }
        }
    }

    draw(ctx) {
        if (this.life <= 0) return;

        ctx.save();
        ctx.globalAlpha = Math.min(1, this.life);
        ctx.translate(this.x, this.y);
        ctx.rotate(this.tilt);
        ctx.scale(this.facing, 1);

        if (this._drawCivilianVehicleWreck(ctx)) {
            ctx.restore();
            return;
        }

        // 잔해 렌더링
        if (typeof IngameRenderer !== 'undefined' && IngameRenderer.drawWreck) {
            IngameRenderer.drawWreck(ctx, this.unitId, {
                team: this.team,
                facing: 1  // facing은 이미 scale로 적용됨
            });
        } else {
            // Fallback: 간단한 잔해 표현
            this._drawFallback(ctx);
        }

        ctx.restore();
    }

    _drawCivilianVehicleWreck(ctx) {
        const id = this.unitId;
        if (!id || !id.startsWith('civ_')) return false;

        ctx.save();
        ctx.scale(1.1, 1.1);

        const rr = (x, y, w, h, r) => {
            ctx.beginPath();
            if (ctx.roundRect) ctx.roundRect(x, y, w, h, r);
            else ctx.rect(x, y, w, h);
        };

        const bodyMain = '#475569';
        const bodyDark = '#334155';
        const windowBroken = '#0f172a';
        const soot = 'rgba(0,0,0,0.55)';
        const metal = '#1e293b';

        if (id === 'civ_sedan') {
            ctx.fillStyle = bodyMain;
            rr(-25, -12, 50, 10, 2); ctx.fill();

            ctx.fillStyle = bodyDark;
            ctx.beginPath();
            ctx.moveTo(-18, -12); ctx.lineTo(-8, -20); ctx.lineTo(8, -18); ctx.lineTo(18, -12);
            ctx.closePath(); ctx.fill();

            ctx.fillStyle = windowBroken;
            ctx.beginPath();
            ctx.moveTo(-12, -13); ctx.lineTo(-6, -18); ctx.lineTo(6, -16); ctx.lineTo(12, -13);
            ctx.closePath(); ctx.fill();

            ctx.strokeStyle = '#111827';
            ctx.lineWidth = 1;
            ctx.beginPath(); ctx.moveTo(-4, -15); ctx.lineTo(6, -10); ctx.stroke();

            ctx.fillStyle = soot;
            ctx.beginPath(); ctx.ellipse(10, -14, 8, 4, 0, 0, Math.PI * 2); ctx.fill();

            ctx.fillStyle = metal;
            ctx.beginPath(); ctx.arc(-15, -2, 5, 0, Math.PI * 2); ctx.fill();
            ctx.fillRect(10, -3, 8, 2); // broken axle
            ctx.restore();
            return true;
        }

        if (id === 'civ_suv') {
            ctx.fillStyle = bodyDark;
            rr(-28, -13, 56, 10, 3); ctx.fill();

            ctx.fillStyle = bodyMain;
            rr(-20, -22, 38, 10, 4); ctx.fill();

            ctx.fillStyle = windowBroken;
            ctx.fillRect(-15, -20, 10, 6);
            ctx.fillRect(0, -20, 15, 6);

            ctx.fillStyle = '#1f2937';
            ctx.fillRect(-14, -24, 28, 2);

            ctx.fillStyle = soot;
            ctx.beginPath(); ctx.ellipse(-6, -14, 9, 4, 0, 0, Math.PI * 2); ctx.fill();

            ctx.fillStyle = '#0f172a';
            ctx.beginPath(); ctx.arc(-16, -3, 4.5, 0, Math.PI * 2); ctx.fill();
            ctx.fillRect(12, -4, 8, 3); // missing wheel stub
            ctx.restore();
            return true;
        }

        if (id === 'civ_bus') {
            ctx.fillStyle = '#64748b';
            rr(-40, -35, 80, 30, 4); ctx.fill();

            ctx.fillStyle = bodyDark;
            ctx.fillRect(-40, -10, 80, 5);

            ctx.fillStyle = windowBroken;
            for (let i = 0; i < 4; i++) {
                const wx = -35 + (i * 18);
                const wh = (i === 1) ? 8 : 12;
                ctx.fillRect(wx, -30, 14, wh);
            }

            ctx.fillStyle = soot;
            ctx.beginPath(); ctx.ellipse(5, -22, 14, 6, 0, 0, Math.PI * 2); ctx.fill();

            ctx.fillStyle = '#000';
            ctx.beginPath(); ctx.arc(-25, -5, 6, 0, Math.PI * 2); ctx.fill();
            ctx.fillRect(12, -6, 10, 3); // missing wheel stub
            ctx.restore();
            return true;
        }

        ctx.restore();
        return false;
    }

    _drawFallback(ctx) {
        // IngameRenderer가 없을 때 기본 잔해
        const burnedColor = '#3d3d3d';
        ctx.fillStyle = burnedColor;
        ctx.fillRect(-25, -15, 50, 20);
        // 손상 마크
        ctx.fillStyle = '#111';
        ctx.beginPath();
        ctx.arc(5, -5, 5, 0, Math.PI * 2);
        ctx.fill();
    }
}
