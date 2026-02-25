// [FILE] classes.js: Entity/Unit/Building ?? ?? ?? ??? ?? ??.
// [RULE] 인게임 안내/상태/채팅 메시지는 UI 토스트 금지. ChatPanel.push()로만 출력.
function getTeamColor(team, variant = 'primary') {
    if (typeof TeamColors !== 'undefined' && TeamColors && typeof TeamColors.get === 'function') {
        return TeamColors.get(team, variant);
    }
    if (team === 'player') return (variant === 'dark' || variant === 'hp') ? '#2563eb' : '#3b82f6';
    if (team === 'enemy') return (variant === 'dark' || variant === 'hp') ? '#4d6b16' : '#6b8e23';
    if (team === 'neutral') return '#94a3b8';
    return '#eab308';
}

// Lower aerial lane slightly for current battle framing and reduce visual footprint.
const AIR_ALTITUDE_DROP_PX = 70;
const AIR_RENDER_SCALE_MULTIPLIER = 0.86;
const RANGE_TARGET_MIN_BY_ID = Object.freeze({
    infantry: 500,
    engineer: 610,
    rpg: 670,
    drone_operator: 540,
    special_ops: 760,
    sniper: 1900,
    humvee: 650,
    apc: 520,
    mbt: 1100,
    aa_tank: 1050,
    apache: 900,
    blackhawk: 650,
    fighter: 1800,
    spg: 2200
});
const INFANTRY_SUPPRESSION_V1 = Object.freeze({
    maxLevel: 100,
    movePenaltyCombat: 0.58,
    movePenaltyMarch: 0.45,
    moveFloorCombat: 0.36,
    moveFloorMarch: 0.52,
    rangePenalty: 0.22,
    rangeRecoverCrouch: 0.11,
    rangeRecoverProne: 0.24,
    rangeFloor: 0.78,
    rangeCeil: 1.10,
    hitPenalty: 0.38,
    hitRecoverCrouch: 0.10,
    hitRecoverProne: 0.17,
    hitFloor: 0.48,
    hitCeil: 1.08,
    gainDefault: 5.8,
    gainSmallArms: 8.2,
    gainHeavyImpact: 12.8,
    gainBlast: 16.0,
    gainBurstBonus: 2.8,
    burstWindowFrames: 54,
    gainMoveMult: 1.12,
    gainDmgRef: 26,
    gainDmgMinMul: 0.65,
    gainDmgMaxMul: 1.95,
    gainThreatMult: 1.12,
    recoverBlockDefault: 64,
    recoverBlockHeavy: 88,
    recoverBlockBlast: 104,
    decayMoving: 0.08,
    decayStationary: 0.12,
    decayCrouchingBonus: 0.08,
    decayProneBonus: 0.14,
    decaySafeBonus: 0.10,
    decayRetreatBonus: 0.08,
    decaySafeFrames: 210,
    nonCombatHoldThreshold: 52
});

function getFeatureFlagsSnapshot() {
    if (typeof globalThis !== 'undefined'
        && globalThis
        && globalThis.RECLAIM_FEATURE_FLAGS
        && typeof globalThis.RECLAIM_FEATURE_FLAGS === 'object') {
        return globalThis.RECLAIM_FEATURE_FLAGS;
    }
    if (typeof FeatureFlags !== 'undefined'
        && FeatureFlags
        && typeof FeatureFlags.getAll === 'function') {
        try {
            return FeatureFlags.getAll();
        } catch (_) { }
    }
    return null;
}

function isFeatureFlagEnabled(flagName, snapshot = null) {
    const key = String(flagName || '').trim();
    if (!key) return false;
    const flags = snapshot && typeof snapshot === 'object' ? snapshot : getFeatureFlagsSnapshot();
    if (!flags || typeof flags !== 'object') return false;
    return flags[key] === true;
}

function nextSeed(seed) {
    return ((seed * 1664525) + 1013904223) >>> 0;
}

function seeded01(seed) {
    const safe = Number(seed) >>> 0;
    return safe / 4294967295;
}

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
        ctx.fillStyle = getTeamColor(this.team, 'hp');
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
        // Air lanes: globally lift all aerial units and keep altitude hierarchy.
        // Priority: recon > fighter > apache > blackhawk/uh60/chinook
        if (stats.id === 'stealth_drone') {
            startY = groundY - 620 + AIR_ALTITUDE_DROP_PX - Math.random() * 90;
        } else if (stats.id === 'recon') {
            startY = groundY - 600 + AIR_ALTITUDE_DROP_PX - Math.random() * 90;
        } else if (stats.id === 'fighter') {
            startY = groundY - 550 + AIR_ALTITUDE_DROP_PX - Math.random() * 90;
        } else if (stats.id === 'bomber') {
            startY = groundY - 570 + AIR_ALTITUDE_DROP_PX - Math.random() * 80;
        } else if (stats.id === 'apache') {
            startY = groundY - 500 + AIR_ALTITUDE_DROP_PX - Math.random() * 80;
        } else if (stats.id === 'blackhawk' || stats.id === 'chinook' || stats.id === 'uh60') {
            startY = groundY - 450 + AIR_ALTITUDE_DROP_PX - Math.random() * 80;
        // [R 4.2 FIX v4] 자폭/대전차 드론은 발밑에서 시작 (상승 애니메이션용)
        } else if (stats.id === 'drone_suicide' || stats.id === 'drone_at') {
            startY = groundY;
        } else if (stats.type === 'air') {
            startY = groundY - 430 + AIR_ALTITUDE_DROP_PX - Math.random() * 80;
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
        // 기본 전투 상태는 전진/교전(attack)으로 유지한다.
        // 별도 명령(stop/move/retreat)이 있을 때만 unit_commands에서 덮어쓴다.
        this.commandMode = 'attack';
        this.flareUsed = false; // [NEW] Air units can flare once
        this.exiting = false; // [NEW] Transport exit state
        this.targetX = null;
        this.commandTargetX = null;
        this.targetY = null;
        this._airFormationOffsetY = 0;
        this._airFormationSlot = null;
        this._airFormationDir = null;
        this._airFormationAnchorX = null;
        this.depthZ = 0;
        this._groundLaneUid = null;
        this._groundLaneOffset = null;
        this._groundLaneOffsetInitialized = false;
        this._marchSpeedMul = null;
        this._spawnSeed = (Math.random() * 0xFFFFFFFF) >>> 0;
        this._infantryCombatProfile = null;
        this.infantrySuppression = 0;
        this.infantrySuppressionLastHitFrame = -9999;
        this.infantrySuppressionRecoverBlockUntil = 0;
        this._infantrySuppressionActive = false;
        this._infantrySuppressionLevel = 0;
        this._infantrySuppressionRatio = 0;
        if (typeof game !== 'undefined' && game && typeof game._allocGroundLaneUid === 'function') {
            game._allocGroundLaneUid(this);
        }
        this.disableFeetSnap = false;
        this.skipDeathSound = false;
        this.crashState = null;
        this._forceDirectDeath = false;
        this.recoil = 0;
        this.missileFlash = 0;
        // Combat hold: armored/air can fire from fixed position for a period.
        this.combatHoldAnchorX = null;
        this.combatHoldTarget = null;
        this.combatHoldStartFrame = -1;
        // Retreat runtime state (AI/manual shared skeleton)
        this.retreatUntilFrame = 0;
        this.retreatMinHoldUntil = 0;
        this.retreatCooldownUntil = 0;
        this._retreatThreatRef = null;
        this._retreatThreatX = null;
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
            this.ownedDrones = [];
            const fixedDroneCharges = 2;
            this.droneChargesLeft = fixedDroneCharges;
            this.maxDroneCharges = fixedDroneCharges;
            this.droneLaunchLimit = fixedDroneCharges;
            this.droneLaunchCount = 0;
            this.droneRecallRefundsLeft = Number.isFinite(Number(stats.droneRecallRefunds))
                ? Math.max(0, Math.floor(Number(stats.droneRecallRefunds)))
                : 0;
            this.launchPrepTimer = 0;
            // 수동 발진 지원
            this.manualDeployRequested = false;
            this.manualDeployType = null;  // 'drone_suicide' | 'drone_at'
            this.autoDeploy = (team !== 'player');  // 플레이어는 수동 발진만, AI는 자동 발진 유지
        }

        // 보병 연막탄 — 기본 지급 제거됨
        // smoke_grenade 아이템 장착 베테랑에게만 applyVeteranStats()에서 부여
        if (stats.id === 'infantry') {
            this.smokeChargesLeft = 0;
            this.smokeAiTimer = 60 + Math.floor(Math.random() * 240);
        }

        if (stats.id === 'bagpiper') {
            this.bagpipeActive = false;
            this.bagpipeEffectActive = false;
            this.bagpipeHealTick = 0;
            this._bagpipePlayPending = false;
            this._bagpipeAudio = null;
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
            const icbmAmmoRaw = Number(stats.icbmAmmo);
            this.icbmAmmoMax = Number.isFinite(icbmAmmoRaw)
                ? Math.max(0, Math.floor(icbmAmmoRaw))
                : 3;
            this.icbmAmmoLeft = this.icbmAmmoMax;
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
        if (['blackhawk', 'chinook', 'uh60', 'apc', 'humvee'].includes(stats.id)) {
            this.transportDropsLeft = 1;
            this.transportDropManifest = null;
            if (stats.id === 'chinook') {
                this.transportDropManifest = [
                    { type: 'infantry', count: 4 },   // 보병
                    { type: 'engineer', count: 1 },   // RPG병
                    { type: 'sniper', count: 1 },     // 저격수
                    { type: 'special_ops', count: 2 } // 특수부대
                ];
                this.transportDropType = 'infantry';
                this.transportDropCount = 8;
            } else if (stats.id === 'blackhawk' || stats.id === 'uh60') {
                this.transportDropType = 'infantry';
                this.transportDropCount = 4;
            } else if (stats.id === 'apc') {
                this.transportDropType = 'infantry';
                this.transportDropCount = 4;
            } else if (stats.id === 'humvee') {
                this.transportDropType = 'infantry';
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
        if (stats.id === 'apc') {
            this.apcTowLastFrame = -9999;
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

    _buildInfantryCombatProfile() {
        if (!this.stats || this.stats.category !== 'infantry') return null;

        const id = String(this.stats.id || '').trim().toLowerCase();
        const baseById = {
            infantry: { hit: 0.94, range: 1.00, damage: 1.00 },
            engineer: { hit: 0.92, range: 1.03, damage: 0.95 },
            rpg: { hit: 0.91, range: 1.04, damage: 0.97 },
            sniper: { hit: 1.18, range: 1.22, damage: 1.12 },
            special_ops: { hit: 1.05, range: 1.05, damage: 1.06 },
            drone_operator: { hit: 0.88, range: 0.95, damage: 0.90 },
            worker: { hit: 0.80, range: 0.80, damage: 0.80 },
            bagpiper: { hit: 0.78, range: 0.82, damage: 0.78 }
        };
        const base = baseById[id] || { hit: 0.96, range: 1.00, damage: 1.00 };

        let seed = Number(this._spawnSeed) >>> 0;
        if (!seed) {
            const xSeed = (Math.abs(Math.floor(Number(this.x) || 0)) & 0xFFFF) << 8;
            const ySeed = (Math.abs(Math.floor(Number(this.y) || 0)) & 0xFFFF);
            const teamSeed = (String(this.team || '') === 'enemy') ? 0x9E37 : 0x7F4A;
            seed = (xSeed ^ ySeed ^ teamSeed ^ 0xA341316C) >>> 0;
        }

        seed = nextSeed(seed);
        const r1 = seeded01(seed);
        seed = nextSeed(seed);
        const r2 = seeded01(seed);
        seed = nextSeed(seed);
        const r3 = seeded01(seed);

        const hitChanceMul = Math.max(0.65, Math.min(1.32, base.hit + ((r1 - 0.5) * 0.34)));
        const rangeMul = Math.max(0.84, Math.min(1.30, base.range + ((r2 - 0.5) * 0.24)));
        const damageMul = Math.max(0.85, Math.min(1.20, base.damage + ((r3 - 0.5) * 0.16)));
        return { hitChanceMul, rangeMul, damageMul };
    }

    _getInfantryCombatProfile() {
        if (!this.stats || this.stats.category !== 'infantry') return null;
        if (!this._infantryCombatProfile || typeof this._infantryCombatProfile !== 'object') {
            this._infantryCombatProfile = this._buildInfantryCombatProfile();
        }
        return this._infantryCombatProfile;
    }

    _getInfantryRenderState() {
        if (!this.stats || this.stats.category !== 'infantry') return null;
        const store = this._renderV2State;
        if (!store || typeof store !== 'object') return null;

        const id = String((this.stats && this.stats.id) || '').trim().toLowerCase();
        const preferredById = {
            infantry: 'infantry',
            bagpiper: 'infantry',
            worker: 'infantry',
            engineer: 'engineer',
            rpg: 'engineer',
            sniper: 'sniper',
            special_ops: 'special_ops',
            drone_operator: 'drone_operator'
        };
        const primaryKey = preferredById[id] || 'infantry';
        const candidates = [
            primaryKey,
            'infantry',
            'sniper',
            'special_ops',
            'engineer',
            'drone_operator'
        ];

        for (let i = 0; i < candidates.length; i++) {
            const key = candidates[i];
            const state = store[key];
            if (state && typeof state === 'object') return state;
        }

        for (const k in store) {
            if (!Object.prototype.hasOwnProperty.call(store, k)) continue;
            const state = store[k];
            if (!state || typeof state !== 'object') continue;
            if (typeof state.stance === 'string') return state;
        }
        return null;
    }

    _getInfantryCurrentStance() {
        if (!this.stats || this.stats.category !== 'infantry') return '';
        const forced = String(this._forcedInfantryStance || '').trim().toLowerCase();
        if (forced === 'standing' || forced === 'crouching' || forced === 'prone') {
            return forced;
        }
        const runtimeState = this._getInfantryRenderState();
        const runtime = String((runtimeState && runtimeState.stance) || '').trim().toLowerCase();
        if (runtime === 'standing' || runtime === 'crouching' || runtime === 'prone') {
            return runtime;
        }
        return '';
    }

    _isInfantrySuppressionEnabled(flags = null) {
        if (!this.stats || this.stats.category !== 'infantry') return false;
        return isFeatureFlagEnabled('infantrySuppressionV1', flags);
    }

    _getInfantrySuppressionLevel(flags = null) {
        if (!this._isInfantrySuppressionEnabled(flags)) return 0;
        const raw = Number(this.infantrySuppression);
        if (!Number.isFinite(raw) || raw <= 0) return 0;
        return Math.max(0, Math.min(Number(INFANTRY_SUPPRESSION_V1.maxLevel) || 100, raw));
    }

    _getInfantrySuppressionMoveMul(flags = null, inCombat = false) {
        const level = this._getInfantrySuppressionLevel(flags);
        if (level <= 0) return 1;
        const ratio = level / (Number(INFANTRY_SUPPRESSION_V1.maxLevel) || 100);
        let mul = inCombat
            ? (1 - (ratio * (Number(INFANTRY_SUPPRESSION_V1.movePenaltyCombat) || 0.58)))
            : (1 - (ratio * (Number(INFANTRY_SUPPRESSION_V1.movePenaltyMarch) || 0.45)));
        if (this.commandMode === 'retreat') {
            mul = Math.max(mul, 0.78);
        }
        const floor = inCombat
            ? (Number(INFANTRY_SUPPRESSION_V1.moveFloorCombat) || 0.36)
            : (Number(INFANTRY_SUPPRESSION_V1.moveFloorMarch) || 0.52);
        return Math.max(floor, Math.min(1, mul));
    }

    _getInfantrySuppressionRangeMul(flags = null) {
        const level = this._getInfantrySuppressionLevel(flags);
        if (level <= 0) return 1;
        const ratio = level / (Number(INFANTRY_SUPPRESSION_V1.maxLevel) || 100);
        let mul = 1 - (ratio * (Number(INFANTRY_SUPPRESSION_V1.rangePenalty) || 0.22));
        const stance = this._getInfantryCurrentStance();
        if (stance === 'crouching') {
            mul += ratio * (Number(INFANTRY_SUPPRESSION_V1.rangeRecoverCrouch) || 0.11);
        } else if (stance === 'prone') {
            mul += ratio * (Number(INFANTRY_SUPPRESSION_V1.rangeRecoverProne) || 0.24);
        }
        return Math.max(
            Number(INFANTRY_SUPPRESSION_V1.rangeFloor) || 0.78,
            Math.min(Number(INFANTRY_SUPPRESSION_V1.rangeCeil) || 1.10, mul)
        );
    }

    _getInfantrySuppressionHitMul(flags = null) {
        const level = this._getInfantrySuppressionLevel(flags);
        if (level <= 0) return 1;
        const ratio = level / (Number(INFANTRY_SUPPRESSION_V1.maxLevel) || 100);
        let mul = 1 - (ratio * (Number(INFANTRY_SUPPRESSION_V1.hitPenalty) || 0.38));
        const stance = this._getInfantryCurrentStance();
        if (stance === 'crouching') {
            mul += ratio * (Number(INFANTRY_SUPPRESSION_V1.hitRecoverCrouch) || 0.10);
        } else if (stance === 'prone') {
            mul += ratio * (Number(INFANTRY_SUPPRESSION_V1.hitRecoverProne) || 0.17);
        }
        return Math.max(
            Number(INFANTRY_SUPPRESSION_V1.hitFloor) || 0.48,
            Math.min(Number(INFANTRY_SUPPRESSION_V1.hitCeil) || 1.08, mul)
        );
    }

    _applyInfantrySuppressionOnHit(dmgApplied, attackType = null, attacker = null, flags = null) {
        if (!this._isInfantrySuppressionEnabled(flags)) return;
        if (this.dead || !this.stats || this.stats.category !== 'infantry') return;

        const frameNow = (typeof game !== 'undefined' && Number.isFinite(game.frame))
            ? game.frame
            : 0;
        const attack = String(attackType || '').trim().toLowerCase();
        let gain = Number(INFANTRY_SUPPRESSION_V1.gainDefault) || 5.8;

        if (attack === 'machinegun' || attack === 'bullet' || attack === 'humvee_burst' || attack === 'aa_shell') {
            gain = Number(INFANTRY_SUPPRESSION_V1.gainSmallArms) || 8.2;
        } else if (attack === 'tank_shell' || attack === 'artillery') {
            gain = Number(INFANTRY_SUPPRESSION_V1.gainHeavyImpact) || 12.8;
        } else if (attack === 'explosion' || attack === 'splash' || attack === 'drone_explosion' || attack === 'nuke') {
            gain = Number(INFANTRY_SUPPRESSION_V1.gainBlast) || 16.0;
        }

        const dmg = Number(dmgApplied);
        if (Number.isFinite(dmg) && dmg > 0) {
            const dmgMul = Math.max(
                Number(INFANTRY_SUPPRESSION_V1.gainDmgMinMul) || 0.65,
                Math.min(
                    Number(INFANTRY_SUPPRESSION_V1.gainDmgMaxMul) || 1.95,
                    dmg / (Number(INFANTRY_SUPPRESSION_V1.gainDmgRef) || 26)
                )
            );
            gain *= dmgMul;
        }

        if (attacker && attacker.stats) {
            const attackerType = String(attacker.stats.type || '').trim().toLowerCase();
            const attackerCategory = String(attacker.stats.category || '').trim().toLowerCase();
            if (attackerType === 'air' || attackerType === 'mech' || attackerCategory === 'armored') {
                gain *= Number(INFANTRY_SUPPRESSION_V1.gainThreatMult) || 1.12;
            }
        }

        const lastHit = Number(this.infantrySuppressionLastHitFrame);
        const burstWindow = Number(INFANTRY_SUPPRESSION_V1.burstWindowFrames) || 54;
        if (Number.isFinite(lastHit) && (frameNow - lastHit) <= burstWindow) {
            gain += Number(INFANTRY_SUPPRESSION_V1.gainBurstBonus) || 2.8;
        }

        if (this.commandMode === 'move') {
            gain *= Number(INFANTRY_SUPPRESSION_V1.gainMoveMult) || 1.12;
        }

        const maxLevel = Number(INFANTRY_SUPPRESSION_V1.maxLevel) || 100;
        const nextLevel = Math.max(0, Math.min(maxLevel, this._getInfantrySuppressionLevel(flags) + gain));
        this.infantrySuppression = nextLevel;
        this.infantrySuppressionLastHitFrame = frameNow;

        let recoverBlockFrames = Number(INFANTRY_SUPPRESSION_V1.recoverBlockDefault) || 64;
        if (attack === 'explosion' || attack === 'splash' || attack === 'drone_explosion' || attack === 'artillery' || attack === 'nuke') {
            recoverBlockFrames = Number(INFANTRY_SUPPRESSION_V1.recoverBlockBlast) || 104;
        } else if (attack === 'tank_shell') {
            recoverBlockFrames = Number(INFANTRY_SUPPRESSION_V1.recoverBlockHeavy) || 88;
        }
        this.infantrySuppressionRecoverBlockUntil = Math.max(
            Number(this.infantrySuppressionRecoverBlockUntil) || 0,
            frameNow + recoverBlockFrames
        );

        this._infantrySuppressionActive = true;
        this._infantrySuppressionLevel = nextLevel;
        this._infantrySuppressionRatio = nextLevel / 100;
    }

    _updateInfantrySuppression(flags = null) {
        if (!this.stats || this.stats.category !== 'infantry') return;
        if (!this._isInfantrySuppressionEnabled(flags)) {
            this.infantrySuppression = 0;
            this.infantrySuppressionLastHitFrame = -9999;
            this.infantrySuppressionRecoverBlockUntil = 0;
            this._infantrySuppressionActive = false;
            this._infantrySuppressionLevel = 0;
            this._infantrySuppressionRatio = 0;
            return;
        }

        const frameNow = (typeof game !== 'undefined' && Number.isFinite(game.frame))
            ? game.frame
            : 0;
        let level = this._getInfantrySuppressionLevel(flags);
        const recoverBlockUntil = Number(this.infantrySuppressionRecoverBlockUntil);
        const canRecover = !Number.isFinite(recoverBlockUntil) || frameNow > recoverBlockUntil;

        if (canRecover && level > 0) {
            const stance = this._getInfantryCurrentStance();
            const moving = (
                this.commandMode === 'move'
                || Math.abs(Number(this.vx) || 0) > 0.05
            );

            let decay = moving
                ? (Number(INFANTRY_SUPPRESSION_V1.decayMoving) || 0.08)
                : (Number(INFANTRY_SUPPRESSION_V1.decayStationary) || 0.12);
            if (stance === 'crouching') {
                decay += Number(INFANTRY_SUPPRESSION_V1.decayCrouchingBonus) || 0.08;
            } else if (stance === 'prone') {
                decay += Number(INFANTRY_SUPPRESSION_V1.decayProneBonus) || 0.14;
            }

            const lastHit = Number(this.infantrySuppressionLastHitFrame);
            const safeFrames = Number(INFANTRY_SUPPRESSION_V1.decaySafeFrames) || 210;
            if (!Number.isFinite(lastHit) || (frameNow - lastHit) > safeFrames) {
                decay += Number(INFANTRY_SUPPRESSION_V1.decaySafeBonus) || 0.10;
            }
            if (this.commandMode === 'retreat') {
                decay += Number(INFANTRY_SUPPRESSION_V1.decayRetreatBonus) || 0.08;
            }

            level = Math.max(0, level - decay);
        }

        this.infantrySuppression = level;
        this._infantrySuppressionActive = true;
        this._infantrySuppressionLevel = level;
        this._infantrySuppressionRatio = level / 100;
    }

    getRangeBonus() {
        const now = (typeof game !== 'undefined' && Number.isFinite(game.frame)) ? game.frame : 0;
        const until = Number(this.tempRangeBonusUntil);
        if (!Number.isFinite(until) || until <= 0) return 0;
        if (now > until) {
            this.tempRangeBonusUntil = 0;
            this.tempRangeBonus = 0;
            return 0;
        }
        const bonus = Number(this.tempRangeBonus);
        if (!Number.isFinite(bonus) || bonus <= 0) return 0;
        return bonus;
    }

    getEffectiveRange() {
        const base = Number(this.stats && this.stats.range) || 0;
        const id = String((this.stats && this.stats.id) || '');
        const s = this.stats || {};
        const flags = getFeatureFlagsSnapshot();
        const useInfantryAccuracyV2 = isFeatureFlagEnabled('infantryAccuracyV2', flags);
        const bonus = this.getRangeBonus();
        if (base <= 0) return Math.max(0, bonus);

        // Baseline tuning + global range inflation.
        let tunedBase = base;
        if (id === 'spg') tunedBase = Math.round(base * 1.20);

        let globalMult = 1.24;
        if (s.category === 'infantry') globalMult = Math.max(globalMult, 1.46);
        if (s.type === 'mech' || s.category === 'armored') globalMult = Math.max(globalMult, 1.26);
        if (s.type === 'air' || s.category === 'air') globalMult = Math.max(globalMult, 1.28);
        if (id === 'bomber') globalMult = 1.28;
        if (id === 'worker' || id === 'recon') globalMult = 1.00;

        let scaled = Math.round(tunedBase * globalMult);
        const targetMin = Number(RANGE_TARGET_MIN_BY_ID[id]);
        if (Number.isFinite(targetMin) && targetMin > 0) {
            scaled = Math.max(scaled, targetMin);
        }

        if (s.category === 'infantry' && useInfantryAccuracyV2) {
            const profile = this._getInfantryCombatProfile();
            if (profile && Number.isFinite(Number(profile.rangeMul))) {
                scaled = Math.round(scaled * Number(profile.rangeMul));
            }
        }

        // Infantry stance/range profile
        if (s.category === 'infantry') {
            const infState = this._getInfantryRenderState();
            if (infState && this.commandMode !== 'retreat') {
                const stance = String(infState.stance || '').trim().toLowerCase();
                const stationaryFrames = Number(infState.stationaryFrames) || 0;
                if (useInfantryAccuracyV2) {
                    // V2: crouch can contest at medium-long range, prone excels at long-range hold.
                    if (stationaryFrames >= 10) {
                        if (stance === 'prone') scaled = Math.round(scaled * 1.36);
                        else if (stance === 'crouching') scaled = Math.round(scaled * 1.20);
                    } else if (this.commandMode === 'move') {
                        scaled = Math.round(scaled * 0.92);
                    }
                } else if (this.commandMode !== 'move') {
                    // Legacy stance bonus
                    if (stationaryFrames >= 24) {
                        if (stance === 'prone') scaled = Math.round(scaled * 1.30);
                        else if (stance === 'crouching') scaled = Math.round(scaled * 1.18);
                    }
                }
            }
        }

        if (s.category === 'infantry') {
            const suppressionRangeMul = this._getInfantrySuppressionRangeMul(flags);
            if (suppressionRangeMul !== 1) {
                scaled = Math.round(scaled * suppressionRangeMul);
            }
        }

        return Math.max(0, scaled + bonus);
    }

    getEffectiveMissileRange() {
        const id = String((this.stats && this.stats.id) || '');
        const unitRange = this.getEffectiveRange();
        const raw = Number(this.stats && this.stats.missileRange);
        const targetMinById = {
            engineer: 1300,
            rpg: 1300,
            fighter: 2250,
            apc: 1100
        };
        const targetMin = Number(targetMinById[id]) || 0;

        if (!Number.isFinite(raw) || raw <= 0) {
            if (targetMin > 0) return Math.max(unitRange, targetMin);
            return unitRange;
        }

        let scaled = Math.round(raw * 1.24);
        if (targetMin > 0) scaled = Math.max(scaled, targetMin);
        return Math.max(unitRange, scaled);
    }

    _isEngineerMissileTargetLocked(target, opts = null) {
        if (!target || target.dead) return false;
        const lock = target._engMissileLock;
        if (!lock || typeof lock !== 'object') return false;

        const frameNow = (typeof game !== 'undefined' && Number.isFinite(Number(game.frame)))
            ? Number(game.frame)
            : 0;
        const until = Number(lock.until);
        if (Number.isFinite(until) && frameNow > until) {
            target._engMissileLock = null;
            return false;
        }

        const lockTeam = (lock.team != null) ? String(lock.team) : '';
        const myTeam = String(this.team || '');
        if (lockTeam && lockTeam !== myTeam) return false;

        const allowOwner = (opts && Object.prototype.hasOwnProperty.call(opts, 'allowOwner'))
            ? opts.allowOwner
            : null;
        if (allowOwner && lock.owner === allowOwner) return false;
        return true;
    }

    _lockEngineerMissileTarget(target, holdFrames = 48) {
        if (!target || target.dead) return false;
        const frameNow = (typeof game !== 'undefined' && Number.isFinite(Number(game.frame)))
            ? Number(game.frame)
            : 0;
        const hold = Math.max(8, Math.floor(Number(holdFrames) || 0));
        const until = frameNow + hold;
        const current = target._engMissileLock;
        if (
            current
            && typeof current === 'object'
            && current.owner === this
            && Number.isFinite(Number(current.until))
            && Number(current.until) > until
        ) {
            return true;
        }
        target._engMissileLock = {
            team: this.team,
            owner: this,
            until
        };
        return true;
    }

    isRearTrackingAllowed() {
        const id = String((this.stats && this.stats.id) || '');
        return id === 'aa_tank';
    }

    shouldRestrictRearTargeting() {
        if (this.commandMode === 'retreat' || this.returnToBase) return false;
        return !this.isRearTrackingAllowed();
    }

    getRearCheckDirection() {
        const stats = this.stats || {};
        const id = String(stats.id || '');
        const category = String(stats.category || '');
        const unitType = String(stats.type || '');
        const isAirLike = (category === 'air' || unitType === 'air');

        if (isAirLike) {
            const isFixedRunAir = (id === 'fighter' || id === 'recon' || id === 'bomber');
            if (isFixedRunAir) {
                const fixedDir = (this.team === 'player') ? 1 : -1;
                this._rearCheckDir = fixedDir;
                return fixedDir;
            }

            const vx = Number(this.vx);
            if (Number.isFinite(vx) && Math.abs(vx) > 0.03) {
                const dirByVx = vx >= 0 ? 1 : -1;
                this._rearCheckDir = dirByVx;
                return dirByVx;
            }

            const targetX = Number(this.targetX);
            if (Number.isFinite(targetX)) {
                const dx = targetX - Number(this.x);
                if (Math.abs(dx) > 2) {
                    const dirByTarget = dx >= 0 ? 1 : -1;
                    this._rearCheckDir = dirByTarget;
                    return dirByTarget;
                }
            }

            const commandTargetX = Number(this.commandTargetX);
            if (Number.isFinite(commandTargetX)) {
                const cdx = commandTargetX - Number(this.x);
                if (Math.abs(cdx) > 2) {
                    const dirByCommand = cdx >= 0 ? 1 : -1;
                    this._rearCheckDir = dirByCommand;
                    return dirByCommand;
                }
            }

            const cachedDir = Number(this._rearCheckDir);
            if (Number.isFinite(cachedDir) && cachedDir !== 0) {
                return cachedDir >= 0 ? 1 : -1;
            }

            const fallbackAirDir = (this.team === 'player') ? 1 : -1;
            this._rearCheckDir = fallbackAirDir;
            return fallbackAirDir;
        }

        const facing = Number(this.facing);
        if (Number.isFinite(facing) && facing !== 0) return facing >= 0 ? 1 : -1;
        return (this.team === 'player') ? 1 : -1;
    }

    isTargetBehindX(targetX, margin = 20) {
        const tx = Number(targetX);
        if (!Number.isFinite(tx)) return false;
        const selfX = Number(this.x);
        if (!Number.isFinite(selfX)) return false;
        const facing = (typeof this.getRearCheckDirection === 'function')
            ? this.getRearCheckDirection()
            : (Number.isFinite(Number(this.facing))
                ? Number(this.facing)
                : ((this.team === 'player') ? 1 : -1));
        const backMargin = Number.isFinite(Number(margin)) ? Math.max(0, Number(margin)) : 20;
        return (facing >= 0)
            ? (tx < (selfX - backMargin))
            : (tx > (selfX + backMargin));
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

    getRenderYOffset() {
        const depthZ = Number(this.depthZ);
        if (!Number.isFinite(depthZ) || Math.abs(depthZ) < 0.01) return 0;
        return depthZ * 0.14;
    }

    getRenderY() {
        const baseY = Number(this.y);
        if (!Number.isFinite(baseY)) return 0;
        return baseY + this.getRenderYOffset();
    }

    isGroundLaneMover() {
        if (!this.stats) return false;
        if (this.stats.type === 'air') return false;
        if (this.stats.civilian === true) return false;
        if (this.isCameraman || this.stats.isCameraman) return false;
        return true;
    }

    _recordCaptureEdgeBreach() {
        const g = (typeof game !== 'undefined' && game && typeof game === 'object') ? game : null;
        if (!g) return;
        const team = String(this.team || '').trim().toLowerCase();
        const key = (team === 'enemy') ? 'enemy' : ((team === 'player') ? 'player' : '');
        if (!key) return;
        // Player breach counts only after manual control is released.
        if (key === 'player') {
            const directActive = (typeof g.isDirectControlActive === 'function') ? !!g.isDirectControlActive() : false;
            if (directActive) {
                const directUnit = (typeof g.getDirectControlUnit === 'function') ? g.getDirectControlUnit() : null;
                if (directUnit === this) return;
            }
        }
        if (!g._captureEdgeBreach || typeof g._captureEdgeBreach !== 'object') {
            g._captureEdgeBreach = { enemy: 0, player: 0 };
        }
        const prev = Number(g._captureEdgeBreach[key]);
        const safePrev = Number.isFinite(prev) ? Math.max(0, Math.floor(prev)) : 0;
        g._captureEdgeBreach[key] = safePrev + 1;
    }

    _resolveGroundLaneTargetY(options = null) {
        const g = (typeof game !== 'undefined') ? game : null;
        if (!g) return Number(this.y) || 0;
        if (typeof g._allocGroundLaneUid === 'function') {
            g._allocGroundLaneUid(this);
        }

        const hasExplicitTargetY = Number.isFinite(this.targetY);
        let desiredY = hasExplicitTargetY
            ? Number(this.targetY)
            : ((typeof g.getGroundLaneY === 'function')
                ? g.getGroundLaneY(this)
                : (Number.isFinite(Number(this.y))
                    ? Number(this.y)
                    : ((Number.isFinite(Number(g.groundY))) ? Number(g.groundY) : 0)));

        const enableDynamicLaneSeparation = !!(
            !(options && options.noSeparation === true)
            && this.commandMode === 'move'
            && hasExplicitTargetY
        );
        if (enableDynamicLaneSeparation) {
            const allyList = Array.isArray(options.allies)
                ? options.allies
                : ((this.team === 'player') ? g.players : g.enemies);
            if (Array.isArray(allyList) && allyList.length > 1) {
                let push = 0;
                let seen = 0;
                for (let i = 0; i < allyList.length; i++) {
                    const ally = allyList[i];
                    if (!ally || ally === this || ally.dead || !ally.stats) continue;
                    if (ally.stats.type === 'air' || ally.stats.civilian === true) continue;
                    if (typeof g._allocGroundLaneUid === 'function') {
                        g._allocGroundLaneUid(ally);
                    }

                    const allyId = String(ally.stats.id || '').trim().toLowerCase();
                    if (allyId === 'icbm' || allyId === 'icbm_enemy') continue;

                    const dx = Math.abs((Number(ally.x) || 0) - (Number(this.x) || 0));
                    if (dx > 30) continue;

                    const dy = (Number(this.y) || desiredY) - (Number(ally.y) || desiredY);
                    const absDy = Math.abs(dy);
                    if (absDy > 18) continue;

                    if (absDy < 0.001) {
                        const aUid = Number(this._groundLaneUid) || 0;
                        const bUid = Number(ally._groundLaneUid) || 0;
                        if (aUid !== bUid) {
                            push += (aUid > bUid) ? 1 : -1;
                        } else {
                            const selfX = Number(this.x) || 0;
                            const allyX = Number(ally.x) || 0;
                            push += (selfX >= allyX) ? 1 : -1;
                        }
                    } else {
                        push += (dy >= 0 ? 1 : -1) * (1 - (absDy / 18));
                    }

                    seen += 1;
                    if (seen >= 6) break;
                }

                if (push !== 0) {
                    desiredY += push * 4.5;
                }
            }
        }

        if (typeof g.clampGroundLaneY === 'function') {
            desiredY = g.clampGroundLaneY(desiredY);
        }

        return Number(desiredY) || Number(this.y) || 0;
    }

    applyGroundLanePostUpdate(options = null) {
        if (!this.isGroundLaneMover()) return;
        const desiredY = this._resolveGroundLaneTargetY(options);
        if (!Number.isFinite(desiredY)) return;

        if (options && options.immediate === true) {
            this.y = desiredY;
            return;
        }

        const baseSpeed = Number(this.stats && this.stats.speed) || 0.6;
        const hasExplicitTargetY = Number.isFinite(this.targetY);
        const step = hasExplicitTargetY
            ? Math.max(0.7, baseSpeed * 1.0)
            : Math.max(0.45, baseSpeed * 0.55);
        const dy = desiredY - (Number(this.y) || 0);
        if (Math.abs(dy) <= step) {
            this.y = desiredY;
        } else {
            this.y += Math.sign(dy) * step;
        }

        if (!(options && options.immediate === true)) {
            this._applyGroundMarchXSeparation(options);
        }
    }

    _getMarchSpeedMul() {
        const cached = this._marchSpeedMul;
        if (typeof cached === 'number' && Number.isFinite(cached) && cached > 0) {
            return cached;
        }
        const uid = Number(this._groundLaneUid) || 0;
        // Deterministic per-unit variance to avoid synchronized clumping march.
        const seed = ((uid * 9301 + 49297) % 233280) / 233280;
        const mul = 0.90 + (seed * 0.22); // 0.90 ~ 1.12
        this._marchSpeedMul = mul;
        return mul;
    }

    _applyGroundMarchXSeparation(options = null) {
        const g = (typeof game !== 'undefined') ? game : null;
        if (!g || !this.stats || this.stats.type === 'air') return;
        if (this.commandMode === 'retreat' || this.returnToBase) return;
        // 기본 전진(attack) 단계에서는 전진축(X)을 건드리지 않는다.
        // X 분리는 명시적 이동 명령(move)일 때만 적용해 스폰 정체를 방지한다.
        const cmd = String(this.commandMode || '').trim().toLowerCase();
        if (cmd !== 'move') return;
        const hasMoveTarget = Number.isFinite(this.commandTargetX) || Number.isFinite(this.targetX);
        if (!hasMoveTarget) return;
        const directUnit = (typeof g.getDirectControlUnit === 'function') ? g.getDirectControlUnit() : null;
        if (directUnit && directUnit === this) return;

        const allies = Array.isArray(options?.allies)
            ? options.allies
            : ((this.team === 'player') ? g.players : g.enemies);
        if (!Array.isArray(allies) || allies.length <= 1) return;

        const selfX = Number(this.x);
        const selfY = Number(this.y);
        if (!Number.isFinite(selfX) || !Number.isFinite(selfY)) return;

        const minGap = Math.max(16, (Number(this.width) || 16) * 0.95);
        const scopeX = minGap * 2.0;
        const scopeY = Math.max(12, (Number(this.height) || 20) * 0.52);
        let repel = 0;
        let seen = 0;

        for (let i = 0; i < allies.length; i++) {
            const ally = allies[i];
            if (!ally || ally === this || ally.dead || !ally.stats || ally.stats.type === 'air') continue;

            const ax = Number(ally.x);
            const ay = Number(ally.y);
            if (!Number.isFinite(ax) || !Number.isFinite(ay)) continue;

            const dx = selfX - ax;
            const adx = Math.abs(dx);
            if (adx > scopeX) continue;

            const ady = Math.abs(selfY - ay);
            if (ady > scopeY) continue;

            if (adx < 0.001) {
                const aUid = Number(this._groundLaneUid) || 0;
                const bUid = Number(ally._groundLaneUid) || 0;
                repel += (aUid >= bUid) ? 0.55 : -0.55;
            } else if (adx < minGap) {
                const push = (minGap - adx) / minGap;
                repel += (dx >= 0 ? 1 : -1) * push;
            }

            seen += 1;
            if (seen >= 10) break;
        }

        if (repel === 0) return;
        const speed = Number(this.stats.speed) || 0.6;
        const step = Math.max(0.08, Math.min(0.75, speed * 0.16));
        this.x += Math.sign(repel) * step;

        const mapWidth = Number((typeof CONFIG !== 'undefined' && CONFIG) ? CONFIG.mapWidth : NaN);
        const halfW = Math.max(8, (Number(this.width) || 16) / 2);
        if (Number.isFinite(mapWidth) && mapWidth > 0) {
            if (this.x < halfW) this.x = halfW;
            if (this.x > mapWidth - halfW) this.x = mapWidth - halfW;
        }
    }

    takeDamage(damage, attackType = null, hitX = null, hitY = null, hitVx = null, hitVy = null, attacker = null) {
        if (this.dead) return;

        if (this.stats && this.stats.invulnerable) return;

        const cleanAttackType = (typeof attackType === 'string' && attackType) ? attackType : null;
        const cleanHitX = Number.isFinite(hitX) ? hitX : null;
        const cleanHitY = Number.isFinite(hitY) ? hitY : null;
        const cleanHitVx = Number.isFinite(hitVx) ? hitVx : null;
        const cleanHitVy = Number.isFinite(hitVy) ? hitVy : null;

        // Drone hit chance is already handled in projectile collision logic.
        // Do not add another random dodge layer here, otherwise drones can feel invulnerable.

        // [NEW] 마지막 피격 정보 기록 (총맞음 판정/혈흔용)
        this.lastHitInfo = {
            attackType: cleanAttackType,
            hitX: cleanHitX,
            hitY: cleanHitY,
            hitVx: cleanHitVx,
            hitVy: cleanHitVy
        };

        let dmg = Number(damage) || 0;
        // [ITEM] 연막탄 존 데미지 감소: 연막 안에 있는 유닛은 피해 감소
        if (dmg > 0 && typeof game !== 'undefined' && game && typeof game.getSmokeZones === 'function') {
            const smokeZones = game.getSmokeZones();
            if (smokeZones.length > 0) {
                const inSmoke = smokeZones.some((zone) => Math.abs(this.x - zone.x) < zone.radius);
                if (inSmoke) {
                    const isSplash = (
                        attackType === 'explosion' ||
                        attackType === 'splash' ||
                        attackType === 'drone_explosion'
                    );
                    dmg = Math.max(1, Math.floor(dmg * (isSplash ? 0.45 : 0.60)));
                }
            }
        }
        if (!Number.isFinite(this.hp)) this.hp = this.maxHp;
        this.hp -= dmg;
        if (this.hp < 0) this.hp = 0;

        // [NEW] 피격 프레임 기록 (이동 중 공격받으면 전투 전환용)
        this.lastDamagedFrame = game.frame;
        this._applyInfantrySuppressionOnHit(dmg, cleanAttackType, attacker, getFeatureFlagsSnapshot());

        // [NEW] 플레이어 MBT에 맞은 적 유닛은 잠시 사거리 버프를 얻는다.
        if (attacker
            && attacker.team === 'player'
            && attacker.stats
            && attacker.stats.id === 'mbt'
            && this.team === 'enemy'
            && this.stats
            && Number.isFinite(Number(this.stats.range))
            && this.hp > 0) {
            const now = (typeof game !== 'undefined' && Number.isFinite(game.frame)) ? game.frame : 0;
            const bonus = 120;
            const dur = 240; // 약 4초
            this.tempRangeBonus = Math.max(Number(this.tempRangeBonus) || 0, bonus);
            this.tempRangeBonusUntil = Math.max(Number(this.tempRangeBonusUntil) || 0, now + dur);
        }

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
            const deathUnitId = String(this.stats?.id || '').trim().toLowerCase();
            const deathCategory = String(this.stats?.category || '').trim().toLowerCase();
            const deathType = String(this.stats?.type || '').trim().toLowerCase();
            const isDroneDeath = deathUnitId.includes('drone');
            const isAirDeath = (deathType === 'air' && !isDroneDeath);
            // Any air unit should enter crash descent before impact death.
            const isAirCrashCandidate = (deathType === 'air');
            const forceDirectDeath = (this._forceDirectDeath === true);

            // Keep falling until impact if already in crash state.
            if (this.crashState && !forceDirectDeath && cleanAttackType !== 'crash_impact') {
                this.hp = 1;
                return;
            }

            if (!forceDirectDeath && isAirCrashCandidate) {
                if (this._beginCrashDescent(cleanHitVx, cleanHitVy)) return;
            }

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
            if (this.stats && this.stats.id === 'bagpiper') {
                this.bagpipeActive = false;
                this._stopBagpipeLoopAudio();
            }
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

            const pushWreckage = (wreckId) => {
                if (typeof game === 'undefined' || !Array.isArray(game.wreckages)) return;
                const rawCap = Number(game.wreckageCap);
                const cap = Number.isFinite(rawCap) ? Math.max(1, Math.floor(rawCap)) : 18;
                if (cap > 0 && game.wreckages.length >= cap) {
                    game.wreckages.shift();
                }
                game.wreckages.push(new Wreckage(
                    wreckId,
                    this.x,
                    this.y,
                    this.facing,
                    this.team
                ));
            };

            // [NEW] 민간 차량 잔해 생성
            const isCivilianVehicle = this.stats?.category === 'civilian' && ['civ_sedan', 'civ_suv', 'civ_bus'].includes(unitId);
            if (isCivilianVehicle) {
                pushWreckage(unitId);
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
            // Infantry should always show death motion regardless of attack type.
            const allowCorpseSpawn = (
                !disableCorpses
                && (isInfantry || isCivilianHuman)
                && (!skipCorpseByAttack || isInfantry)
            );
            if (allowCorpseSpawn && typeof Corpse !== 'undefined' && typeof game !== 'undefined' && Array.isArray(game.corpses)) {
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
            }

            // [P1] 유닛 종류별 사망 VFX
            const isArmoredDeath = (
                deathCategory === 'armored'
                || ['mbt', 'apc', 'aa_tank', 'humvee', 'spg', 'tank', 'ifv', 'sam', 'mlrs'].includes(deathUnitId)
            );
            const isCrashImpact = cleanAttackType === 'crash_impact';

            if (typeof VFX !== 'undefined') {
                // 험비/기갑: 사망 시 지상 폭발 + 잔해
                if (isArmoredDeath) {
                    VFX.spawn(game, 'vehicle', this.x, this.y, { anchorGround: true });
                    pushWreckage(this.stats.id);
                    if (typeof game !== 'undefined' && game.createParticles) {
                        game.createParticles(this.x, this.y - 10, 8, '#333');
                    }
                }
                // 항공기: 기본 공중 폭발, 추락사는 지상 폭발
                else if (isAirDeath) {
                    const impactY = (isCrashImpact && typeof game !== 'undefined' && Number.isFinite(Number(game.groundY)))
                        ? Number(game.groundY)
                        : this.y;
                    VFX.spawn(game, 'aircraft', this.x, impactY, { anchorGround: !!isCrashImpact });
                }
                // 드론: 추락사는 소형 지상 폭발, 일반 피격사는 공중 소형 폭발
                else if (isDroneDeath) {
                    const impactY = (isCrashImpact && typeof game !== 'undefined' && Number.isFinite(Number(game.groundY)))
                        ? Number(game.groundY)
                        : this.y;
                    VFX.spawn(game, isCrashImpact ? 'hit' : 'hit_air', this.x, impactY, { anchorGround: !!isCrashImpact });
                }
            }

            if (typeof AudioSystem !== 'undefined' && !this.skipDeathSound) {
                if (isAirDeath) {
                    AudioSystem.playBoom(isCrashImpact ? 'death_exp2' : 'death_exp', this.x);
                } else if (isArmoredDeath) {
                    const armoredDeathSfx = (deathUnitId === 'humvee' || deathUnitId === 'apc')
                        ? 'death_exp2'
                        : 'death_exp3';
                    AudioSystem.playBoom(armoredDeathSfx, this.x);
                } else if (isDroneDeath) {
                    AudioSystem.playBoom(isCrashImpact ? 'drone' : 'other', this.x);
                }
            }
            this.skipDeathSound = false;
            // [R 4.2] 플레이어 유닛 파괴 로그
            if (this.team === 'player' && typeof ChatPanel !== 'undefined') {
                ChatPanel.push(`[유닛 파괴] ${this.stats.name}`, 'WARN');
            }
            // [R 4.2] 드론병 사망 시 소유 드론 전체 동반 파괴
            if (this.stats.operator) {
                const owned = [];
                if (Array.isArray(this.ownedDrones)) {
                    for (let i = 0; i < this.ownedDrones.length; i++) {
                        const d = this.ownedDrones[i];
                        if (d && !d.dead) owned.push(d);
                    }
                }
                if (this.ownedDrone && !this.ownedDrone.dead && !owned.includes(this.ownedDrone)) {
                    owned.push(this.ownedDrone);
                }
                for (let i = 0; i < owned.length; i++) {
                    owned[i].dead = true;
                }
                this.ownedDrones = [];
                this.ownedDrone = null;
            }
        }
    }

    _canUseCrashDescent() {
        if (!this.stats || this.stats.type !== 'air') return false;
        if (this.dead || this.crashState || this._forceDirectDeath) return false;

        const id = String((this.stats && this.stats.id) || '').trim().toLowerCase();
        if (!id) return false;

        // Drones should die on lethal hit immediately (no prolonged crash-state HP hold).
        const category = String((this.stats && this.stats.category) || '').trim().toLowerCase();
        if (category === 'drone' || id.includes('drone')) return false;

        // Airframes (jets/helis/etc) use crash descent.
        return true;
    }

    _resolveCrashForwardDir() {
        // 1) Current combat target direction (closest to "attacking direction")
        let target = null;
        if (this.attackTarget && !this.attackTarget.dead) {
            target = this.attackTarget;
        } else if (this._combatSideTarget && !this._combatSideTarget.dead) {
            target = this._combatSideTarget;
        }
        if (target && Number.isFinite(Number(target.x))) {
            const dtx = Number(target.x) - Number(this.x);
            if (Math.abs(dtx) > 3) return dtx >= 0 ? 1 : -1;
        }

        // 2) Recent manual aim direction
        if (Number.isFinite(Number(this.manualAimX))) {
            const dxAim = Number(this.manualAimX) - Number(this.x);
            if (Math.abs(dxAim) > 3) return dxAim >= 0 ? 1 : -1;
        }

        // 3) Actual movement vector
        if (Number.isFinite(Number(this.vx)) && Math.abs(Number(this.vx)) > 0.06) {
            return Number(this.vx) >= 0 ? 1 : -1;
        }

        // 4) Fallback: current facing
        if (Number.isFinite(Number(this.facing)) && Number(this.facing) !== 0) {
            return Number(this.facing) >= 0 ? 1 : -1;
        }

        // 5) Team-default facing
        return (this.team === 'player') ? 1 : -1;
    }

    _resolveCrashDescentBaseTuning(kind, speed, dir, useAirCrashV2 = false) {
        // Baseline crash tuning (current live behavior).
        let baseVx = dir * Math.max(0.95, speed * 0.46);
        let baseVy = 0.9;
        let gravity = 0.2;
        if (kind === 'drone') {
            baseVx = dir * Math.max(0.75, speed * 0.34);
            baseVy = 0.75;
            gravity = 0.26;
        } else if (kind === 'heli') {
            baseVx = dir * Math.max(0.8, speed * 0.33);
            baseVy = 0.85;
            gravity = 0.23;
        } else if (kind === 'aircraft') {
            baseVx = dir * Math.max(1.1, speed * 0.44);
            baseVy = 0.9;
            gravity = 0.21;
        } else if (kind === 'fighter') {
            baseVx = dir * Math.max(1.25, speed * 0.52);
            baseVy = 0.95;
            gravity = 0.2;
        }

        if (useAirCrashV2) {
            // V2: keep forward momentum for a brief glide, then transition to steeper dive.
            if (kind === 'drone') {
                baseVx = dir * Math.max(0.95, speed * 0.42);
                baseVy = 0.62;
                gravity = 0.17;
            } else if (kind === 'heli') {
                baseVx = dir * Math.max(1.15, speed * 0.47);
                baseVy = 0.68;
                gravity = 0.16;
            } else if (kind === 'aircraft') {
                baseVx = dir * Math.max(1.55, speed * 0.60);
                baseVy = 0.64;
                gravity = 0.14;
            } else if (kind === 'fighter') {
                baseVx = dir * Math.max(1.85, speed * 0.72);
                baseVy = 0.60;
                gravity = 0.13;
            }
        }
        return { baseVx, baseVy, gravity };
    }

    _beginCrashDescent(hitVx = null, hitVy = null) {
        if (this.dead || this.crashState || this._forceDirectDeath) return false;
        if (!this._canUseCrashDescent()) return false;

        const flags = getFeatureFlagsSnapshot();
        const useAirCrashV2 = isFeatureFlagEnabled('airCrashV2', flags);
        const id = String((this.stats && this.stats.id) || '').trim().toLowerCase();
        const isDrone = id.includes('drone');
        const isFighter = id === 'fighter';
        const isHeli = (id === 'apache' || id === 'blackhawk' || id === 'chinook' || id === 'uh60');
        const kind = isDrone ? 'drone' : (isFighter ? 'fighter' : (isHeli ? 'heli' : 'aircraft'));
        const speed = Math.max(0.6, Number(this.stats?.speed) || 0.6);
        const dir = this._resolveCrashForwardDir();
        const rawInertiaVx = Number.isFinite(Number(hitVx)) ? Number(hitVx) * 0.07 : 0;
        const inertiaVy = Number.isFinite(Number(hitVy)) ? Math.abs(Number(hitVy)) * 0.05 : 0;

        const baseTuning = this._resolveCrashDescentBaseTuning(kind, speed, dir, useAirCrashV2);
        const baseVx = Number(baseTuning.baseVx) || 0;
        const baseVy = Number(baseTuning.baseVy) || 0.9;
        const gravity = Number(baseTuning.gravity) || 0.2;

        // Keep crash direction consistent with the current attack/nose direction.
        // Hit inertia can bias speed, but should not flip the direction.
        const maxInertiaVx = Math.max(0.12, Math.abs(baseVx) * 0.55);
        let inertiaVx = Math.max(-maxInertiaVx, Math.min(maxInertiaVx, rawInertiaVx));
        let crashVx = baseVx + inertiaVx;
        if (crashVx * dir < 0) {
            crashVx = dir * Math.max(0.18, Math.abs(baseVx) * 0.42);
            inertiaVx = crashVx - baseVx;
        }

        const spinBase = (kind === 'aircraft') ? 0.045 : (kind === 'heli' ? 0.07 : 0.06);
        const spin = (Math.random() * spinBase + spinBase * 0.55) * dir;

        this.crashState = {
            kind,
            vx: crashVx,
            vy: Math.max(0.8, inertiaVy + baseVy),
            gravity,
            spin,
            sparkTick: 0,
            rollVisual: dir * 0.24,
            burnLevel: 0.18
        };
        if (useAirCrashV2) {
            this.crashState.v2 = true;
            this.crashState.forwardBias = dir * ((kind === 'fighter' || kind === 'aircraft') ? 0.024 : 0.015);
            this.crashState.forwardBiasDecay = 0.985;
            this.crashState.drag = (kind === 'fighter' || kind === 'aircraft') ? 0.9965 : 0.9952;
            this.crashState.minForwardVx = Math.max(0.46, Math.abs(baseVx) * 0.38);
            this.crashState.gravityGrow = (kind === 'drone') ? 0.0020 : 0.00135;
            this.crashState.maxGravity = (kind === 'drone') ? 0.34 : 0.30;
        }

        this.hp = Math.max(1, Number(this.hp) || 1);
        this.commandMode = 'stop';
        this.targetX = null;
        this.commandTargetX = null;
        this.returnToBase = false;
        this.attackTarget = null;
        this.lockedTarget = null;
        this.dropState = null;
        this.dropTargetX = null;
        this.dropTimer = 0;
        this.holdFrames = 0;
        this.postLaunchHoverFrames = 0;
        this.recallRequested = false;
        this.recallPhase = null;

        if (typeof game !== 'undefined' && game && typeof game.createParticles === 'function') {
            const burst = (kind === 'fighter') ? 4 : (kind === 'aircraft' ? 4 : (kind === 'heli' ? 3 : 2));
            game.createParticles(this.x, this.y, burst, '#6b7280');
        }
        return true;
    }

    _triggerCrashImpactDeath() {
        if (this.dead) return;
        this.crashState = null;
        const lethal = Math.max((Number(this.hp) || 0) + 5, (Number(this.maxHp) || 1) + 9999);
        this._forceDirectDeath = true;
        try {
            this.takeDamage(lethal, 'crash_impact', this.x, this.y, 0, 0, null);
        } finally {
            this._forceDirectDeath = false;
            this.crashState = null;
        }
    }

    _updateCrashDescent() {
        if (!this.crashState || this.dead) return false;
        const state = this.crashState;
        const gy = (typeof game !== 'undefined' && Number.isFinite(Number(game.groundY)))
            ? Number(game.groundY)
            : (Number(this.y) || 0) + 32;

        this.x += Number(state.vx) || 0;
        this.y += Number(state.vy) || 0;
        state.vy = (Number(state.vy) || 0) + (Number(state.gravity) || 0.2);
        if (state.v2 === true) {
            const gravityGrow = Number(state.gravityGrow) || 0;
            const maxGravity = Number(state.maxGravity) || 0.3;
            state.gravity = Math.min(maxGravity, (Number(state.gravity) || 0.2) + gravityGrow);

            const bias = Number(state.forwardBias) || 0;
            const decay = Number(state.forwardBiasDecay) || 1;
            const drag = Number(state.drag) || 0.995;
            state.vx = (Number(state.vx) || 0) + bias;
            state.vx *= drag;
            state.forwardBias = bias * decay;

            const minForward = Number(state.minForwardVx) || 0;
            if (minForward > 0 && Math.abs(Number(state.vx) || 0) < minForward) {
                const fallbackDir = (Math.abs(Number(state.forwardBias) || 0.0001) >= 0.0001)
                    ? ((Number(state.forwardBias) || 0) >= 0 ? 1 : -1)
                    : (((Number(state.vx) || 0) >= 0) ? 1 : -1);
                state.vx = fallbackDir * minForward;
            }
        } else {
            state.vx *= 0.992;
        }
        this.rotorAngle += Number(state.spin) || 0;
        if (Math.abs(Number(state.vx) || 0) > 0.04) {
            this.facing = (Number(state.vx) >= 0) ? 1 : -1;
        }

        const vxNow = Number(state.vx) || 0;
        const vyNow = Number(state.vy) || 0;
        const noseDir = (Math.abs(vxNow) > 0.03)
            ? (vxNow >= 0 ? 1 : -1)
            : ((Number(this.facing) || 1) >= 0 ? 1 : -1);
        const noseDown = Math.min(1.1, 0.22 + Math.max(0, vyNow) * 0.07);
        const frameNow = (typeof game !== 'undefined' && Number.isFinite(Number(game.frame))) ? Number(game.frame) : 0;
        const wobble = Math.sin((frameNow * 0.32) + ((Number(state.sparkTick) || 0) * 0.17)) * 0.12;
        const targetRoll = (noseDown * noseDir) + wobble;
        const rollNow = Number(state.rollVisual) || 0;
        state.rollVisual = rollNow + ((targetRoll - rollNow) * 0.08) + ((Number(state.spin) || 0) * 0.015);
        state.rollVisual = Math.max(-1.25, Math.min(1.25, Number(state.rollVisual) || 0));
        state.burnLevel = Math.min(0.65, (Number(state.burnLevel) || 0.18) + 0.0035 + (Math.max(0, vyNow) * 0.0018));

        const mapWidth = Number((typeof CONFIG !== 'undefined' && CONFIG) ? CONFIG.mapWidth : NaN);
        if (Number.isFinite(mapWidth) && mapWidth > 20) {
            this.x = Math.max(10, Math.min(mapWidth - 10, this.x));
        }

        state.sparkTick = (Number(state.sparkTick) || 0) + 1;
        if (typeof game !== 'undefined' && game && typeof game.createParticles === 'function' && state.sparkTick % 7 === 0) {
            game.createParticles(this.x, this.y, state.kind === 'fighter' ? 2 : 1, '#4b5563');
        }

        if (this.y >= gy - 4) {
            this.y = gy - 4;
            this._triggerCrashImpactDeath();
        }
        return true;
    }

    isAirTransport() {
        const id = this.stats && this.stats.id;
        return id === 'blackhawk' || id === 'chinook' || id === 'uh60';
    }

    isGroundTransport() {
        const id = this.stats && this.stats.id;
        return id === 'apc' || id === 'humvee';
    }

    canTransportDrop() {
        return (this.transportDropsLeft || 0) > 0;
    }

    getPreferredAirCruiseY() {
        const fallback = Number.isFinite(Number(this.cruiseY)) ? Number(this.cruiseY) : Number(this.y);
        if (!this.isAirTransport()) return Number.isFinite(fallback) ? fallback : Number(this.y);
        const gy = (typeof game !== 'undefined' && Number.isFinite(Number(game.groundY)))
            ? Number(game.groundY)
            : NaN;
        if (!Number.isFinite(gy)) return Number.isFinite(fallback) ? fallback : Number(this.y);
        const id = String(this.stats && this.stats.id || '').trim().toLowerCase();
        if (id === 'blackhawk' || id === 'chinook' || id === 'uh60') return gy - 450;
        return gy - 430;
    }

    requestAirDrop(targetX) {
        if (!this.isAirTransport()) return false;
        if (!this.canTransportDrop()) return false;
        if (!Number.isFinite(targetX)) return false;
        if (this.dropState) return false;

        const mapWidth = Number((typeof CONFIG !== 'undefined' && CONFIG) ? CONFIG.mapWidth : NaN);
        let clampedTargetX = Number(targetX);
        if (Number.isFinite(mapWidth) && mapWidth > 80) {
            clampedTargetX = Math.max(24, Math.min(mapWidth - 24, clampedTargetX));
        }

        this.cruiseY = this.getPreferredAirCruiseY();
        this.dropTargetX = clampedTargetX;
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
        let baseY = Number(this.y);
        if (typeof game.getGroundLaneBaseY === 'function') {
            const laneBase = Number(game.getGroundLaneBaseY());
            if (Number.isFinite(laneBase)) baseY = laneBase;
        } else if (Number.isFinite(Number(game.groundY))) {
            baseY = Number(game.groundY);
            if (typeof game.clampGroundLaneY === 'function') {
                baseY = Number(game.clampGroundLaneY(baseY));
            }
        }
        if (!Number.isFinite(baseY)) baseY = Number(this.y);

        const normalizeSpawnedUnit = (u) => {
            if (!u) return;
            if (typeof game.getGroundLaneY === 'function') {
                const laneY = Number(game.getGroundLaneY(u));
                if (Number.isFinite(laneY)) {
                    u.y = laneY;
                    u.targetY = laneY;
                    if (typeof u.applyGroundLanePostUpdate === 'function') {
                        u.applyGroundLanePostUpdate({ immediate: true, noSeparation: true });
                    }
                    return;
                }
            }
            if (typeof game.clampGroundLaneY === 'function') {
                const laneY = Number(game.clampGroundLaneY(baseY));
                if (Number.isFinite(laneY)) {
                    u.y = laneY;
                    u.targetY = laneY;
                    if (typeof u.applyGroundLanePostUpdate === 'function') {
                        u.applyGroundLanePostUpdate({ immediate: true, noSeparation: true });
                    }
                }
            }
        };

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
                    if (u) {
                        normalizeSpawnedUnit(u);
                        spawned++;
                    }
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
            if (u) {
                normalizeSpawnedUnit(u);
                spawned++;
            }
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

        const speed = Math.max(2.0, Number(this.stats && this.stats.speed) || 2.5);
        const cruiseY = this.getPreferredAirCruiseY();
        this.cruiseY = cruiseY;

        // IMPORTANT: landing Y must be inside the ground lane band.
        // Using `game.groundY - 80` looks like "still in air" instead of a landing.
        let groundBaseY = NaN;
        if (typeof game !== 'undefined' && game) {
            if (typeof game.getGroundLaneBaseY === 'function') {
                groundBaseY = Number(game.getGroundLaneBaseY());
            } else if (typeof game.getGroundLaneBounds === 'function') {
                const bounds = game.getGroundLaneBounds();
                groundBaseY = Number(bounds && bounds.base);
            }

            if (!Number.isFinite(groundBaseY) && Number.isFinite(Number(game.groundY))) {
                groundBaseY = Number(game.groundY);
                if (typeof game.clampGroundLaneY === 'function') {
                    groundBaseY = Number(game.clampGroundLaneY(groundBaseY));
                }
            }
        }

        if (!Number.isFinite(groundBaseY)) {
            const gy = (typeof game !== 'undefined' && Number.isFinite(Number(game.groundY)))
                ? Number(game.groundY)
                : Number(this.y);
            groundBaseY = Number.isFinite(gy) ? gy : Number(this.y);
        }

        // Model origin is above wheels; offset so touchdown reads as "on ground".
        const landingOffset = 34;
        let landY = groundBaseY - landingOffset;
        if (typeof game !== 'undefined' && game && typeof game.clampGroundLaneY === 'function') {
            landY = Number(game.clampGroundLaneY(landY));
        }

        const clampStep = (v, maxStep) => Math.max(-maxStep, Math.min(maxStep, v));

        if (this.dropState === 'approach') {
            const dx = this.dropTargetX - this.x;
            const distX = Math.abs(dx);
            if (distX <= speed) {
                this.x = this.dropTargetX;
                this.dropState = 'landing';
            } else {
                this.x += Math.sign(dx) * speed;
            }
            this.facing = dx >= 0 ? 1 : -1;

            // Start descending as transport closes in; makes landing readable.
            const near = Math.max(0, Math.min(1, 1 - (distX / 360)));
            const desiredY = (cruiseY * (1 - near)) + (landY * near);
            const maxYStep = 2.2 + near * 6.2;
            this.y += clampStep(desiredY - this.y, maxYStep);
            return true;
        }

        if (this.dropState === 'landing') {
            const dy = landY - this.y;
            const step = Math.max(4.2, Math.min(14, dy * 0.18));
            this.y += step;
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
            this.y = landY;
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
            const dy = this.y - cruiseY;
            const step = Math.max(4.0, Math.min(14, dy * 0.18));
            this.y -= step;
            if (this.y <= cruiseY) {
                this.y = cruiseY;
                this.targetY = null;
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
        const ammoLeft = Number(this.icbmAmmoLeft);
        if (Number.isFinite(ammoLeft) && ammoLeft <= 0) return false;
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
            targetX: Number.isFinite(targetX) ? targetX : this.x,
            targetY: Number.isFinite(targetY) ? targetY : tyDefault
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

    isBagpiperUnit() {
        return !!(this.stats && this.stats.id === 'bagpiper');
    }

    startBagpipeSkill() {
        if (!this.isBagpiperUnit()) return false;
        if (this.dead) return false;
        if (this.bagpipeActive === true) {
            this._stopBagpipeLoopAudio();
        }
        this.bagpipeActive = true;
        this.bagpipeEffectActive = false;
        this.bagpipeHealTick = 0;
        this._bagpipePlayPending = false;
        if (this._bagpipeAudio) {
            try { this._bagpipeAudio.pause(); } catch (e) { }
            try { this._bagpipeAudio.currentTime = 0; } catch (e) { }
        }
        this._syncBagpipeLoopAudio();
        if (typeof game !== 'undefined' && game && typeof game.createParticles === 'function') {
            game.createParticles(this.x, this.y - 10, 8, '#fbbf24');
        }
        return true;
    }

    _applyBagpipeAura() {
        if (!this.isBagpiperUnit()) return;
        if (this.bagpipeActive !== true) return;
        if (this.bagpipeEffectActive !== true) return;
        if (typeof game === 'undefined' || !game) return;

        const tickFrames = Math.max(8, Math.floor(Number(this.stats?.bagpipeBuffTickFrames) || Number(this.stats?.bagpipeHealTickFrames) || 30));
        if (!Number.isFinite(this.bagpipeHealTick) || this.bagpipeHealTick <= 0) {
            this.bagpipeHealTick = tickFrames;
        }
        this.bagpipeHealTick = Math.max(0, this.bagpipeHealTick - 1);
        if (this.bagpipeHealTick > 0) return;
        this.bagpipeHealTick = tickFrames;

        const radius = Math.max(40, Number(this.stats?.bagpipeSpeedRadius) || Number(this.stats?.bagpipeHealRadius) || 180);
        const speedMul = Math.max(1.02, Math.min(2.2, Number(this.stats?.bagpipeSpeedMul) || 1.3));
        const durationFrames = Math.max(10, Math.floor(Number(this.stats?.bagpipeSpeedDurationFrames) || (tickFrames + 8)));
        const nowFrame = (typeof game !== 'undefined' && Number.isFinite(game.frame)) ? Number(game.frame) : 0;
        const unitSources = Array.isArray(game.units)
            ? [game.units]
            : [this.team === 'player' ? game.players : game.enemies];
        let buffedCount = 0;

        for (let si = 0; si < unitSources.length; si += 1) {
            const list = unitSources[si];
            if (!Array.isArray(list)) continue;
            for (let i = 0; i < list.length; i += 1) {
                const ally = list[i];
                if (!ally || ally.dead || ally === this) continue;
                if (ally.team !== this.team) continue;

                const allyType = String(ally.stats?.type || '').trim().toLowerCase();
                const allyCategory = String(ally.stats?.category || '').trim().toLowerCase();
                if (allyType === 'air') continue;
                if (allyCategory === 'civilian') continue;

                const dx = Math.abs((Number(ally.x) || 0) - (Number(this.x) || 0));
                if (dx > radius) continue;
                const dy = Math.abs((Number(ally.y) || 0) - (Number(this.y) || 0));
                if (dy > 150) continue;

                const prevMul = Math.max(1, Number(ally._bagpipeSpeedMul) || 1);
                const prevUntil = Number(ally._bagpipeSpeedBuffUntilFrame);
                ally._bagpipeSpeedMul = Math.max(prevMul, speedMul);
                ally._bagpipeSpeedBuffUntilFrame = Math.max(
                    Number.isFinite(prevUntil) ? prevUntil : 0,
                    nowFrame + durationFrames
                );
                buffedCount += 1;

                if (typeof game.createParticles === 'function') {
                    game.createParticles(ally.x, ally.y - 8, 3, '#93c5fd');
                }
            }
        }

        if (buffedCount > 0 && typeof game.createParticles === 'function') {
            game.createParticles(this.x, this.y - 16, 4, '#fde047');
        }
    }

    _getBagpipeSpeedMul() {
        const nowFrame = (typeof game !== 'undefined' && Number.isFinite(game.frame)) ? Number(game.frame) : 0;
        const untilFrame = Number(this._bagpipeSpeedBuffUntilFrame);
        if (!Number.isFinite(untilFrame) || untilFrame <= nowFrame) {
            this._bagpipeSpeedBuffUntilFrame = 0;
            this._bagpipeSpeedMul = 1;
            return 1;
        }
        const mul = Number(this._bagpipeSpeedMul);
        return Math.max(1, Number.isFinite(mul) ? mul : 1);
    }

    _syncBagpipeLoopAudio() {
        if (!this.isBagpiperUnit()) return;
        if (typeof AudioSystem === 'undefined' || !AudioSystem) {
            this.bagpipeEffectActive = false;
            return;
        }

        if (this.bagpipeActive !== true || this.dead) {
            this._stopBagpipeLoopAudio();
            return;
        }

        if (!AudioSystem.volume || AudioSystem.volume.sfx <= 0 || AudioSystem.volume.master <= 0) {
            if (this._bagpipeAudio && !this._bagpipeAudio.paused) {
                try { this._bagpipeAudio.pause(); } catch (e) { }
            }
            this.bagpipeEffectActive = false;
            return;
        }

        try {
            const audibility = (typeof AudioSystem.getWorldAudibility === 'function')
                ? AudioSystem.getWorldAudibility(this.x)
                : 1;
            if (audibility <= 0.02) {
                if (this._bagpipeAudio && !this._bagpipeAudio.paused) {
                    try { this._bagpipeAudio.pause(); } catch (e) { }
                }
                this.bagpipeEffectActive = false;
                return;
            }
            if (!this._bagpipeAudio) {
                const a = new Audio('bgm/Brave.mp3');
                a.preload = 'auto';
                a.loop = false;
                a.playsInline = true;
                a.addEventListener('ended', () => {
                    this.bagpipeActive = false;
                    this.bagpipeEffectActive = false;
                    this.bagpipeHealTick = 0;
                    this._bagpipePlayPending = false;
                    if (typeof game !== 'undefined' && game && typeof game.updateHUDSelection === 'function') {
                        game.updateHUDSelection();
                    }
                });
                this._bagpipeAudio = a;
            }
            if (this._bagpipeAudio.ended) {
                this.bagpipeActive = false;
                this.bagpipeEffectActive = false;
                this.bagpipeHealTick = 0;
                return;
            }
            const vol = Math.max(0, Math.min(1, AudioSystem.volume.sfx * AudioSystem.volume.master * 0.75 * audibility));
            this._bagpipeAudio.volume = vol;
            if (!this._bagpipeAudio.paused && !this._bagpipeAudio.ended) {
                this.bagpipeEffectActive = true;
                return;
            }
            if (this._bagpipePlayPending === true) return;
            this._bagpipePlayPending = true;
            const p = this._bagpipeAudio.play();
            if (p && p.then) {
                p.then(() => {
                    this._bagpipePlayPending = false;
                    this.bagpipeEffectActive = !!(this.bagpipeActive && this._bagpipeAudio && !this._bagpipeAudio.paused && !this._bagpipeAudio.ended);
                }).catch(() => {
                    this._bagpipePlayPending = false;
                    this.bagpipeEffectActive = false;
                });
            } else {
                this._bagpipePlayPending = false;
                this.bagpipeEffectActive = !!(this._bagpipeAudio && !this._bagpipeAudio.paused && !this._bagpipeAudio.ended);
            }
        } catch (e) { }
    }

    _stopBagpipeLoopAudio() {
        this.bagpipeEffectActive = false;
        this._bagpipePlayPending = false;
        if (!this._bagpipeAudio) return;
        try { this._bagpipeAudio.pause(); } catch (e) { }
        try { this._bagpipeAudio.currentTime = 0; } catch (e) { }
    }

    updateBagpiper(enemies, buildings) {
        if (!this.isBagpiperUnit()) return false;
        this.attackTarget = null;
        this.combatHoldAnchorX = null;
        this.combatHoldTarget = null;
        this.combatHoldStartFrame = -1;

        this._tryAutoEnterRetreat(null, enemies, buildings);
        if (this.commandMode === 'retreat') {
            this._updateRetreat(enemies, buildings);
            this.updateFacing();
            return true;
        }

        const speed = Number(this.stats?.speed) || 0;
        if (this.commandMode === 'stop') {
            // no-op
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

        this.updateFacing();
        return true;
    }

    update(enemies, buildings) {
        if (this.dead) {
            if (this.isBagpiperUnit()) this._stopBagpipeLoopAudio();
            return;
        }
        if (this.crashState) {
            this._updateCrashDescent();
            return;
        }
        if (this.recoil && this.recoil > 0) {
            this.recoil = Math.max(0, this.recoil - 0.6);
        }
        if (this.missileFlash && this.missileFlash > 0) {
            this.missileFlash = Math.max(0, this.missileFlash - 1);
        }
        if (this.commandMode !== 'retreat') this.returnToBase = false;
        if (this.isBagpiperUnit()) {
            this._syncBagpipeLoopAudio();
            this._applyBagpipeAura();
        }
        const flags = getFeatureFlagsSnapshot();
        this._updateInfantrySuppression(flags);

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

        const isDroneUnit = (this.stats.category === 'drone' || (this.stats.id && this.stats.id.includes('drone'))) && !this.stats.operator;
        const useAirFormation = isFeatureFlagEnabled('airFormation', flags);
        if (this.stats.type === 'air' && !isDroneUnit) {
            this.rotorAngle += 0.8;
            const groundRefY = (typeof game !== 'undefined' && Number.isFinite(game.groundY)) ? game.groundY : null;
            if (Number.isFinite(groundRefY) && !this.dropState) {
                let desiredAirY = null;
                if (this.stats.id === 'stealth_drone') {
                    desiredAirY = groundRefY - 640 + AIR_ALTITUDE_DROP_PX;
                } else if (this.stats.id === 'recon') {
                    desiredAirY = groundRefY - 620 + AIR_ALTITUDE_DROP_PX;
                } else if (this.stats.id === 'fighter') {
                    desiredAirY = groundRefY - 560 + AIR_ALTITUDE_DROP_PX;
                } else if (this.stats.id === 'bomber') {
                    desiredAirY = groundRefY - 570 + AIR_ALTITUDE_DROP_PX;
                } else if (this.stats.id === 'apache') {
                    desiredAirY = groundRefY - 500 + AIR_ALTITUDE_DROP_PX;
                } else if (this.stats.id === 'blackhawk' || this.stats.id === 'chinook' || this.stats.id === 'uh60') {
                    desiredAirY = groundRefY - 450 + AIR_ALTITUDE_DROP_PX;
                } else {
                    desiredAirY = groundRefY - 430 + AIR_ALTITUDE_DROP_PX;
                }
                if (useAirFormation) {
                    const rawOffsetY = Number(this._airFormationOffsetY);
                    if (Number.isFinite(rawOffsetY)) {
                        let offsetY = Math.max(-132, Math.min(132, rawOffsetY));
                        // Keep formation only while moving in formation; otherwise relax back to base lane.
                        if (this.commandMode !== 'move') {
                            offsetY *= 0.92;
                            if (Math.abs(offsetY) < 0.6) offsetY = 0;
                            this._airFormationOffsetY = offsetY;
                        }
                        desiredAirY += offsetY;
                    }
                } else if (Number(this._airFormationOffsetY) !== 0) {
                    this._airFormationOffsetY = 0;
                }
                if (Number.isFinite(desiredAirY)) {
                    this.y += (desiredAirY - this.y) * 0.12;
                    if (Math.abs(this.y - desiredAirY) < 0.8) this.y = desiredAirY;
                    if (this.stats.id === 'blackhawk' || this.stats.id === 'chinook' || this.stats.id === 'uh60') {
                        this.cruiseY = desiredAirY;
                    }
                }
            }
        }

        // Player MBT manual right-click hold fire (PC): keep firing while held.
        if (this.team === 'player' && this.stats && this.stats.id === 'mbt') {
            if (this.isSelected !== true) {
                this.stopManualTankMG(false);
            } else if (this.manualMgHeld === true
                && Number.isFinite(this.manualAimX)
                && Number.isFinite(this.manualAimY)
                && !(game && game.buildMode && game.buildMode.active)
                && !(game && game.targetingType)) {
                this.tryManualTankMGFire(this.manualAimX, this.manualAimY);
            } else if (this.manualMgModeActive === true) {
                this.stopManualTankMG(false);
            }
        }

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

        if (this.updateBagpiper(enemies, buildings)) {
            return;
        }

        // 보병 AI 연막탄 1회 사용
        if (this.stats.id === 'infantry') {
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
        if (this.stats.type === 'air' && !this.stats.id.startsWith('drone') && !['blackhawk', 'chinook', 'uh60'].includes(this.stats.id)) {
            const isOut = (this.team === 'player' && this.x > CONFIG.mapWidth + 100) || (this.team === 'enemy' && this.x < -100);
            if (isOut) {
                this._recordCaptureEdgeBreach();
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

            const frameNow = Number(game.frame) || 0;
            const inMap = (this.x > 0 && this.x < CONFIG.mapWidth);

            const runCooldown = Math.max(120, Math.floor(Number(this.stats.bombStrikeCooldown) || 360));
            const burstCount = Math.max(3, Math.floor(Number(this.stats.carpetBurstCount) || 7));
            const burstInterval = Math.max(2, Math.floor(Number(this.stats.carpetBurstInterval) || 5));
            const triggerRange = Math.max(40, Number(this.stats.carpetTriggerRange) || 120);
            const spreadX = Math.max(0, Number(this.stats.carpetSpreadX) || 24);

            if (!Number.isFinite(this._lastCarpetRunFrame)) this._lastCarpetRunFrame = -999999;
            if (!Number.isFinite(this._carpetBombsLeft)) this._carpetBombsLeft = 0;
            if (!Number.isFinite(this._nextCarpetDropFrame)) this._nextCarpetDropFrame = frameNow;

            if (this._carpetBombsLeft <= 0 && inMap && (frameNow - this._lastCarpetRunFrame) >= runCooldown) {
                const targets = (this.team === 'enemy' && typeof game !== 'undefined' && Array.isArray(game.civilians))
                    ? [...enemies, ...game.civilians, ...buildings]
                    : [...enemies, ...buildings];
                const hasTarget = targets.some(t =>
                    t && !t.dead
                    && t.team !== 'neutral'
                    && !(t.stats && t.stats.invulnerable)
                    && Math.abs(t.x - this.x) < triggerRange
                );
                if (hasTarget) {
                    this._carpetBombsLeft = burstCount;
                    this._nextCarpetDropFrame = frameNow;
                    this._lastCarpetRunFrame = frameNow;
                }
            }

            if (this._carpetBombsLeft > 0 && inMap && frameNow >= this._nextCarpetDropFrame) {
                const scatter = (Math.random() * 2 - 1) * spreadX;
                const offsetAlongPath = -dir * (6 + (burstCount - this._carpetBombsLeft) * 1.4);
                const dropX = this.x + scatter + offsetAlongPath;
                game.projectiles.push(new Projectile(dropX, this.y, null, this.stats.damage, this.team, 'bomb', { source: this }));
                this.lastBomb = frameNow;
                this._carpetBombsLeft -= 1;
                this._nextCarpetDropFrame = frameNow + burstInterval;
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
                this._recordCaptureEdgeBreach();
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
            this.facing = dir;
            this._rearCheckDir = dir;
            this._lastX = this.x;
            const fighterRange = Math.max(450, Number(this.getEffectiveRange ? this.getEffectiveRange() : (this.stats && this.stats.range)) || 600);
            const fighterMissileRange = Math.max(fighterRange, Number(this.getEffectiveMissileRange ? this.getEffectiveMissileRange() : fighterRange) || fighterRange);
            const fighterLoseRange = fighterRange + 50;
            const fighterScanRange = Math.max(420, Math.round(fighterRange * 0.92));
            const fighterRestrictRear = (typeof this.shouldRestrictRearTargeting === 'function')
                ? this.shouldRestrictRearTargeting()
                : true;

            if (this.attackTarget) {
                const fighterTargetBehind = fighterRestrictRear
                    && (typeof this.isTargetBehindX === 'function')
                    && this.isTargetBehindX(this.attackTarget.x, 20);
                if (this.attackTarget.dead ||
                    fighterTargetBehind ||
                    (this.attackTarget.stats && this.attackTarget.stats.invulnerable) ||
                    Math.abs(this.attackTarget.x - this.x) > fighterLoseRange) {
                    this.attackTarget = null;
                }
            }
            if (!this.attackTarget) {
                this.attackTarget = enemies.find(e =>
                    !e.dead && e.stats && !e.stats.invulnerable &&
                    (e.stats.type === 'air' || e.stats.id === 'aa_tank') &&
                    String(e.stats.category || '').toLowerCase() !== 'drone' &&
                    !String(e.stats.id || '').toLowerCase().includes('drone') &&
                    (!(fighterRestrictRear && typeof this.isTargetBehindX === 'function' && this.isTargetBehindX(e.x, 20))) &&
                    Math.abs(e.x - this.x) < fighterScanRange
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
                if (!isDrone && dist <= fighterMissileRange && missileReady) {
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
        const unitId = String(this.stats && this.stats.id || '');
        const isEngineer = unitId === 'engineer';
        const isRpgUnit = (unitId === 'engineer' || unitId === 'rpg');
        const isApcTowUnit = unitId === 'apc';
        const unitRange = this.getEffectiveRange();
        const missileRange = this.getEffectiveMissileRange();
        const canUseMissile = (isRpgUnit && this.missileReady !== false) || isApcTowUnit;
        const isMissileTarget = (t) => {
            if (!t) return false;

            if (isRpgUnit) {
                if (!t.stats) return false;
                const tid = t.stats.id || '';
                const ttype = t.stats.type;
                const isDrone = tid.includes('drone') || tid === 'tactical_drone';
                return !isDrone && (ttype === 'mech' || ttype === 'air');
            }

            if (isApcTowUnit) {
                if (!t.stats) {
                    return !!(t.team && t.team !== this.team && t.team !== 'neutral');
                }
                const tid = String(t.stats.id || '');
                const ttype = String(t.stats.type || '');
                const isDrone = tid.includes('drone') || tid === 'tactical_drone';
                if (isDrone) return false;
                return ttype === 'mech' || tid === 'icbm' || tid === 'icbm_enemy';
            }

            return false;
        };
        const hasMissileTargetLockConflict = (t) => (
            isRpgUnit
            && canUseMissile
            && isMissileTarget(t)
            && this._isEngineerMissileTargetLocked(t, { allowOwner: this })
        );

        const extraCivilianTargets = (this.team === 'enemy' && typeof game !== 'undefined' && Array.isArray(game.civilians) && game.civilians.length)
            ? game.civilians
            : null;
        const blockDroneTargets = (unitId === 'apache' || unitId === 'fighter');
        const isDroneLikeTarget = (t) => {
            if (!t || !t.stats) return false;
            const tid = String(t.stats.id || '').toLowerCase();
            const tcat = String(t.stats.category || '').toLowerCase();
            return tcat === 'drone' || tid.includes('drone') || tid === 'tactical_drone';
        };
        const onlyAir = !!this.stats.onlyAir;
        const restrictForward = (typeof this.shouldRestrictRearTargeting === 'function')
            ? this.shouldRestrictRearTargeting()
            : (this.commandMode !== 'retreat' && !this.returnToBase && String((this.stats && this.stats.id) || '') !== 'aa_tank');
        const facing = Number.isFinite(this.facing) ? this.facing : (this.team === 'player' ? 1 : -1);
        const isBehind = (x) => (typeof this.isTargetBehindX === 'function')
            ? this.isTargetBehindX(x, 20)
            : ((facing >= 0) ? (x < this.x - 20) : (x > this.x + 20));

        if (this.attackTarget) {
            const dist = Math.abs(this.attackTarget.x - this.x);
            const isStealth = this.attackTarget.stats && this.attackTarget.stats.stealth;
            const isInvulnerable = this.attackTarget.stats && this.attackTarget.stats.invulnerable;
            const isCivilianTarget = this.attackTarget.stats && this.attackTarget.stats.civilian;
            const effRange = (canUseMissile && isMissileTarget(this.attackTarget)) ? missileRange : unitRange;
            const lockConflict = hasMissileTargetLockConflict(this.attackTarget);

            if (this.attackTarget.dead ||
                (restrictForward && isBehind(this.attackTarget.x)) ||
                (onlyAir && (!this.attackTarget.stats || this.attackTarget.stats.type !== 'air')) ||
                dist > effRange + 50 ||
                this.attackTarget.team === this.team ||
                this.attackTarget.team === 'neutral' ||
                (blockDroneTargets && isDroneLikeTarget(this.attackTarget)) ||
                (isCivilianTarget && this.team === 'player') ||
                isInvulnerable ||
                lockConflict ||
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
                    if (blockDroneTargets && isDroneLikeTarget(e)) continue;
                    if (this.stats.id === 'humvee' && e.stats.id === 'fighter') continue;
                    if (e.stats.type === 'air' && !canHitAir) continue;
                    if (restrictForward && isBehind(e.x)) continue;

                    const dist = Math.abs(e.x - this.x);
                    const effRange = (canUseMissile && isMissileTarget(e)) ? missileRange : unitRange;
                    if (dist > effRange) continue;
                    if (hasMissileTargetLockConflict(e)) continue;

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
                        if (blockDroneTargets && isDroneLikeTarget(e)) continue;
                        if (e.stats && e.stats.type === 'air' && !canHitAir) continue;
                        if (restrictForward && isBehind(e.x)) continue;
                        const dist = Math.abs(e.x - this.x);
                        const effRange = (canUseMissile && isMissileTarget(e)) ? missileRange : unitRange;
                        if (dist > effRange) continue;
                        if (hasMissileTargetLockConflict(e)) continue;
                        let score = dist;
                        if (score < bestScore) { bestScore = score; this.attackTarget = e; }
                    }
                }

                // ???좊떅 ?놁쑝硫?嫄대Ъ ?寃?
                if (!this.attackTarget && !onlyAir) {
                    for (let b of buildings) {
                        if (!b || b.dead || b.team === this.team || b.team === 'neutral') continue;
                        const dist = Math.abs(b.x - this.x);
                        const buildingRange = (canUseMissile && isMissileTarget(b)) ? missileRange : unitRange;
                        if (dist > buildingRange + b.width / 2) continue;
                        if (restrictForward && isBehind(b.x)) continue;
                        if (hasMissileTargetLockConflict(b)) continue;
                        if (dist < bestScore) { bestScore = dist; this.attackTarget = b; }
                    }
                }
            }
        }

        const target = this.attackTarget;
        const mgTarget = (this.stats.id === 'mbt') ? this._findTankMGTarget(enemies, extraCivilianTargets) : null;
        const isAttacking = (target !== null) && !(this.team === 'enemy' && game.empTimer > 0);

        // Retreat has the highest priority in general combat loop.
        this._tryAutoEnterRetreat(target, enemies, buildings);
        if (this.commandMode === 'retreat') {
            this._updateRetreat(enemies, buildings);
            if (this.stats.id === 'mbt') this._stopTankMGSound();
            this.updateFacing();
            return;
        }

        if (isAttacking) {
            const activeRange = (canUseMissile && isMissileTarget(target)) ? missileRange : unitRange;
            this._applyCombatSpacing(target, activeRange);

            let rate = 60;
            // [?섏젙] 釉붾옓?명겕??鍮좊Ⅸ ?곗궗 (15?꾨젅?? ?곸슜
            if (['humvee', 'aa_tank', 'turret', 'blackhawk'].includes(this.stats.id)) rate = 15;
            else if (this.stats.id === 'apc') rate = (canUseMissile && isMissileTarget(target)) ? 12 : 8;
            else if (this.stats.id === 'mbt') rate = 120;
            else if (this.stats.id === 'spg') rate = this._getSpgFireCooldownFrames();
            else if (this.stats.id === 'sniper') rate = 210;

            let handledAttackCycle = false;
            if (isRpgUnit && canUseMissile && isMissileTarget(target)) {
                const rawAimFrames = Number(this.stats.missileAimFrames);
                const aimFrames = Number.isFinite(rawAimFrames) ? Math.max(1, Math.floor(rawAimFrames)) : 54;
                if (this._isEngineerMissileTargetLocked(target, { allowOwner: this })) {
                    this.attackTarget = null;
                    this.engineerAimTarget = null;
                    this.engineerAimTimer = 0;
                    this.engineerMode = 'carrying';
                    handledAttackCycle = true;
                } else if (this.engineerAimTarget !== target) {
                    this.engineerAimTarget = target;
                    this.engineerAimTimer = aimFrames;
                }
                if (!handledAttackCycle) {
                    this.engineerMode = 'firing';
                    this._lockEngineerMissileTarget(target, aimFrames + 18);
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
                }
            } else if (isRpgUnit) {
                this.engineerAimTarget = null;
                this.engineerAimTimer = 0;
                this.engineerMode = 'carrying';
            }

            if (!handledAttackCycle && game.frame - this.lastAttack > rate) {
                if (this.stats.id === 'spg' && !this._canSpgFireNow()) {
                    // Keep tracking target while barrel raises to firing posture.
                } else {
                    this.attack(target);
                    this.lastAttack = game.frame;
                }
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
            this.combatHoldAnchorX = null;
            this.combatHoldTarget = null;
            this.combatHoldStartFrame = -1;

            const speed = Number(this.stats.speed) || 0;
            const moveSpeedMul = this._getMarchSpeedMul();
            const bagpipeSpeedMul = this._getBagpipeSpeedMul();
            const suppressionMoveMul = this._getInfantrySuppressionMoveMul(flags, false);
            const moveSpeed = speed * moveSpeedMul * bagpipeSpeedMul * suppressionMoveMul;
            const cmd = this.commandMode;
            const holdStance = this._getInfantryCurrentStance();
            const suppressionHoldThreshold = Number(INFANTRY_SUPPRESSION_V1.nonCombatHoldThreshold) || 52;
            const suppressionHold = (
                this.stats
                && this.stats.category === 'infantry'
                && cmd === 'attack'
                && this._getInfantrySuppressionLevel(flags) >= suppressionHoldThreshold
            );
            const stanceHold = (
                this.stats
                && this.stats.category === 'infantry'
                && cmd === 'attack'
                && this.commandMode !== 'retreat'
                && !this.returnToBase
                && (holdStance === 'crouching' || holdStance === 'prone')
            );

            // 공격 타겟이 없으면 기본 전진 대신 commandMode(stop/move)를 우선 적용
            if (suppressionHold || stanceHold) {
                // Suppressed infantry briefly hold position to recover posture/aim.
                if (stanceHold) {
                    if (!Number.isFinite(Number(this._infantryStanceHoldX))) {
                        this._infantryStanceHoldX = this.x;
                    }
                    this._infantryStanceHoldTarget = null;
                    this.x = Number(this._infantryStanceHoldX);
                }
            } else if (this.commandMode === 'stop') {
                // 정지 유지
            } else if (this.commandMode === 'move') {
                if (Number.isFinite(Number(this._infantryStanceHoldX)) || this._infantryStanceHoldTarget) {
                    this._infantryStanceHoldX = null;
                    this._infantryStanceHoldTarget = null;
                }
                const moveX = Number.isFinite(this.commandTargetX) ? this.commandTargetX : this.targetX;
                if (Number.isFinite(moveX)) {
                    const dx = moveX - this.x;
                    if (Math.abs(dx) < 10) {
                        this.commandMode = (this.team === 'enemy') ? 'attack' : 'stop';
                        this.targetX = null;
                        this.commandTargetX = null;
                    } else {
                        this.x += moveSpeed * Math.sign(dx);
                    }
                } else {
                    this.commandMode = (this.team === 'enemy') ? 'attack' : 'stop';
                    this.targetX = null;
                    this.commandTargetX = null;
                }
            } else {
                if (Number.isFinite(Number(this._infantryStanceHoldX)) || this._infantryStanceHoldTarget) {
                    this._infantryStanceHoldX = null;
                    this._infantryStanceHoldTarget = null;
                }
                const moveDir = this.team === 'player' ? 1 : -1;
                this.x += moveSpeed * moveDir;
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
        let droneControlMode = 'auto';
        if (typeof game !== 'undefined' && game) {
            if (typeof game.getDroneControlMode === 'function') {
                droneControlMode = game.getDroneControlMode();
            } else if (game.droneControlMode === 'manual') {
                droneControlMode = 'manual';
            }
        }
        if (isPlayer) {
            // Player operators follow global drone mode:
            // auto = detect/launch automatically, manual = lockdown-only operation.
            this.autoDeploy = (droneControlMode !== 'manual');
        }

        // Hard cap: each operator can launch at most 2 drones per battle.
        const fixedDroneCharges = 2;
        const launchLimitRaw = Number(this.droneLaunchLimit);
        const launchLimit = Number.isFinite(launchLimitRaw)
            ? Math.max(1, Math.min(fixedDroneCharges, Math.floor(launchLimitRaw)))
            : fixedDroneCharges;
        this.droneLaunchLimit = launchLimit;
        if (!Number.isFinite(Number(this.maxDroneCharges)) || Number(this.maxDroneCharges) !== launchLimit) {
            this.maxDroneCharges = launchLimit;
        }
        const launchCountRaw = Number(this.droneLaunchCount);
        this.droneLaunchCount = Number.isFinite(launchCountRaw)
            ? Math.max(0, Math.min(launchLimit, Math.floor(launchCountRaw)))
            : 0;
        const remainingByCount = Math.max(0, launchLimit - this.droneLaunchCount);
        const chargesRaw = Number(this.droneChargesLeft);
        this.droneChargesLeft = Number.isFinite(chargesRaw)
            ? Math.max(0, Math.min(remainingByCount, Math.floor(chargesRaw)))
            : remainingByCount;

        // === RIFLE: 소총 모드 (기본 상태) - 전진/사격 + 발진 트리거 ===
        if (this.opState === 'rifle') {
            // 1. 발진 트리거 체크
            const canDeploy = this.droneChargesLeft > 0;
            let shouldDeploy = false;
            let deployType = null;
            let autoLockTarget = null;

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
                    const baseDetectRangeRaw = Number(stats.detectRange);
                    const baseDetectRange = Number.isFinite(baseDetectRangeRaw) ? baseDetectRangeRaw : 1100;
                    const aiDetectRangeRaw = Number(stats.aiDetectRange);
                    const aiDetectRange = Number.isFinite(aiDetectRangeRaw) ? aiDetectRangeRaw : 1900;
                    // Auto-deploy should start early even for allied/player-side operators.
                    const detectRange = Math.max(baseDetectRange, aiDetectRange);
                    const isArmoredCandidate = (target, asBuilding = false) => {
                        if (!target) return false;
                        if (asBuilding) return true;
                        const tStats = target.stats || {};
                        const tId = String(tStats.id || '').toLowerCase();
                        const tCategory = String(tStats.category || '').toLowerCase();
                        const tType = String(tStats.type || target.type || '').toLowerCase();
                        if (target.armored === true) return true;
                        if (tCategory === 'armored') return true;
                        if (tType === 'mech' || tType === 'vehicle' || tType === 'tank') return true;
                        if (['mbt', 'apc', 'aa_tank', 'humvee', 'spg', 'tank', 'ifv', 'sam', 'mlrs'].includes(tId)) return true;
                        if (Number(target.maxHp) >= 220) return true;
                        if (Number(target.width) >= 48) return true;
                        return false;
                    };

                    let armoredTarget = null;
                    let armoredDist = detectRange + 1;
                    let infantryTarget = null;
                    let infantryDist = detectRange + 1;

                    // 1순위: 기갑/중장비(공중 제외), 2순위: 보병
                    for (const e of enemies) {
                        if (!e || e.dead) continue;
                        if (e.team === this.team || e.team === 'neutral') continue;
                        if (e.stats && (e.stats.stealth || e.stats.invulnerable)) continue;
                        if (e.stats && e.stats.type === 'air') continue;
                        const d = Math.abs(e.x - this.x);
                        if (d > detectRange) continue;
                        if (isArmoredCandidate(e, false)) {
                            if (d < armoredDist) {
                                armoredDist = d;
                                armoredTarget = e;
                            }
                        } else if (d < infantryDist) {
                            infantryDist = d;
                            infantryTarget = e;
                        }
                    }

                    if (buildings && buildings.length) {
                        for (const b of buildings) {
                            if (!b || b.dead) continue;
                            if (b.team === this.team || b.team === 'neutral') continue;
                            const d = Math.abs(b.x - this.x);
                            if (d > detectRange) continue;
                            if (d < armoredDist) {
                                armoredDist = d;
                                armoredTarget = b;
                            }
                        }
                    }

                    const nearestTarget = armoredTarget || infantryTarget;
                    const nearestDist = armoredTarget ? armoredDist : infantryDist;
                    if (nearestTarget && nearestDist <= detectRange) {
                        shouldDeploy = true;
                        autoLockTarget = nearestTarget;
                        deployType = armoredTarget ? 'drone_at' : 'drone_suicide';
                    }
                }
            }

            // 2. 발진 실행 (스폰 성공 시에만 laptop 모드 전환)
            if (shouldDeploy && deployType) {
                let spawned = false;

                const frontSpawnOffsetRaw = Number(isPlayer ? stats.frontSpawnOffset : stats.aiFrontSpawnOffset);
                const frontSpawnOffset = Number.isFinite(frontSpawnOffsetRaw)
                    ? Math.max(20, Math.floor(frontSpawnOffsetRaw))
                    : (isPlayer ? 80 : 100);
                const mapWidth = (typeof CONFIG !== 'undefined' && CONFIG && Number.isFinite(Number(CONFIG.mapWidth)))
                    ? Number(CONFIG.mapWidth)
                    : 6000;
                // Launch forward so operators can initiate drone runs earlier than rifle engagement range.
                const droneX = Math.max(16, Math.min(mapWidth - 16, this.x + moveDir * frontSpawnOffset));
                const droneY = game.groundY;  // 지면 레벨

                // 드론 스폰 (bypassBlock=true로 스폰 가드 우회)
                if (game && game.spawnUnitDirect) {
                    const drone = game.spawnUnitDirect(deployType, droneX, droneY, this.team, true);
                    if (drone) {
                        const launchPrepFramesRaw = Number(stats.launchPrepFrames);
                        const launchPrepFrames = Number.isFinite(launchPrepFramesRaw)
                            ? Math.max(1, Math.floor(launchPrepFramesRaw))
                            : 90;
                        const launchGroundHoldRaw = Number(isPlayer ? stats.launchGroundHoldFrames : stats.aiLaunchGroundHoldFrames);
                        const launchRiseRaw = Number(isPlayer ? stats.launchRiseFrames : stats.aiLaunchRiseFrames);
                        const launchHoverRaw = Number(isPlayer ? stats.launchHoverFrames : stats.aiLaunchHoverFrames);
                        const launchMaxRiseRaw = Number(isPlayer ? stats.launchMaxRisePerFrame : stats.aiLaunchMaxRisePerFrame);
                        const launchCruiseHeightRaw = Number(stats.launchCruiseHeight);
                        const attackCruiseHeightRaw = Number(stats.attackCruiseHeight);
                        const attackDiveTriggerRangeRaw = Number(stats.attackDiveTriggerRange);
                        const dynamicRetargetEnabled = stats.dynamicRetargetEnabled !== false;
                        const dynamicRetargetMarginRaw = Number(stats.dynamicRetargetMargin);

                        const launchGroundHoldFrames = Number.isFinite(launchGroundHoldRaw)
                            ? Math.max(0, Math.floor(launchGroundHoldRaw))
                            : Math.max(0, Math.floor(launchPrepFrames * 0.6));
                        const launchRiseFrames = Number.isFinite(launchRiseRaw)
                            ? Math.max(1, Math.floor(launchRiseRaw))
                            : Math.max(1, launchPrepFrames - launchGroundHoldFrames);
                        const launchHoverFrames = Number.isFinite(launchHoverRaw)
                            ? Math.max(0, Math.floor(launchHoverRaw))
                            : (isPlayer ? 25 : 35);
                        const launchMaxRisePerFrame = Number.isFinite(launchMaxRiseRaw)
                            ? Math.max(0.35, launchMaxRiseRaw)
                            : (isPlayer ? 0.78 : 0.68);
                        const launchCruiseHeight = Number.isFinite(launchCruiseHeightRaw)
                            ? Math.max(110, launchCruiseHeightRaw)
                            : 220;
                        const attackCruiseHeight = Number.isFinite(attackCruiseHeightRaw)
                            ? Math.max(260, attackCruiseHeightRaw)
                            : Math.max(430, launchCruiseHeight + 180);
                        const attackDiveTriggerRange = Number.isFinite(attackDiveTriggerRangeRaw)
                            ? Math.max(140, Math.floor(attackDiveTriggerRangeRaw))
                            : 260;
                        const dynamicRetargetMargin = Number.isFinite(dynamicRetargetMarginRaw)
                            ? Math.max(0, Math.floor(dynamicRetargetMarginRaw))
                            : 60;

                        drone.ownerRef = this;  // Owner 링크
                        drone.launchGroundHoldFrames = launchGroundHoldFrames;
                        drone.launchRiseFrames = launchRiseFrames;
                        drone.holdFrames = launchGroundHoldFrames + launchRiseFrames;
                        drone.postLaunchHoverFrames = launchHoverFrames;
                        drone.launchMaxRisePerFrame = launchMaxRisePerFrame;
                        drone.launchInit = false;
                        drone.launchTargetY = game.groundY - launchCruiseHeight;
                        drone.attackCruiseY = game.groundY - attackCruiseHeight;
                        drone.attackDiveTriggerRange = attackDiveTriggerRange;
                        drone.dynamicRetargetEnabled = dynamicRetargetEnabled;
                        drone.dynamicRetargetMargin = dynamicRetargetMargin;
                        drone.y = game.groundY;
                        drone.commandState = 'attack';
                        if (autoLockTarget && !autoLockTarget.dead) {
                            drone.lockedTarget = autoLockTarget;
                            drone.autoSeekTarget = true;
                        } else {
                            drone.lockedTarget = null;
                            drone.autoSeekTarget = true;
                        }
                        if (game && typeof game.addOperatorDrone === 'function') {
                            game.addOperatorDrone(this, drone);
                        } else {
                            this.ownedDrone = drone;
                            if (!Array.isArray(this.ownedDrones)) this.ownedDrones = [];
                            if (!this.ownedDrones.includes(drone)) this.ownedDrones.push(drone);
                            this.opState = 'laptop';
                        }
                        const launchLimitNow = Math.max(1, Math.min(2, Math.floor(Number(this.droneLaunchLimit) || Number(this.maxDroneCharges) || 2)));
                        const nextLaunchCount = Math.max(0, Math.min(launchLimitNow, (Math.floor(Number(this.droneLaunchCount) || 0) + 1)));
                        this.droneLaunchLimit = launchLimitNow;
                        this.maxDroneCharges = launchLimitNow;
                        this.droneLaunchCount = nextLaunchCount;
                        this.droneChargesLeft = Math.max(0, launchLimitNow - nextLaunchCount);
                        spawned = true;

                        if (typeof ChatPanel !== 'undefined' && this.team === 'player') {
                            ChatPanel.push(`[드론 발진] ${CONFIG.units[deployType]?.name || deployType}`, 'INFO');
                        }
                    }
                }
                if (spawned) {
                    return;
                }
            }

            // 3. 일반 보병처럼 전진/사격
            // 타겟 찾기
            const canHitAir = stats.antiAir || stats.type === 'air';
            const restrictRear = (typeof this.shouldRestrictRearTargeting === 'function')
                ? this.shouldRestrictRearTargeting()
                : (this.commandMode !== 'retreat' && !this.returnToBase && String((this.stats && this.stats.id) || '') !== 'aa_tank');
            if (this.attackTarget) {
                const t = this.attackTarget;
                if (t.dead ||
                    t.team === this.team ||
                    t.team === 'neutral' ||
                    (t.stats && (t.stats.stealth || t.stats.invulnerable)) ||
                    (restrictRear && typeof this.isTargetBehindX === 'function' && this.isTargetBehindX(t.x, 20)) ||
                    (!canHitAir && t.stats && t.stats.type === 'air')) {
                    this.attackTarget = null;
                }
            }

            if (!this.attackTarget || this.attackTarget.dead) {
                const opRange = Number(this.getEffectiveRange ? this.getEffectiveRange() : stats.range) || 0;
                let bestDist = opRange + 1;
                for (const e of enemies) {
                    if (!e || e.dead) continue;
                    if (e.stats && (e.stats.stealth || e.stats.invulnerable)) continue;
                    if (!canHitAir && e.stats && e.stats.type === 'air') continue;
                    if (restrictRear && typeof this.isTargetBehindX === 'function' && this.isTargetBehindX(e.x, 20)) continue;
                    const d = Math.abs(e.x - this.x);
                    if (d < bestDist) { bestDist = d; this.attackTarget = e; }
                }
            }

            const target = this.attackTarget;
            const opRange = Number(this.getEffectiveRange ? this.getEffectiveRange() : stats.range) || 0;
            if (target && Math.abs(target.x - this.x) <= opRange) {
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
            let aliveCount = 0;
            if (game && typeof game.getAliveOperatorDrones === 'function') {
                aliveCount = game.getAliveOperatorDrones(this).length;
            } else {
                if (Array.isArray(this.ownedDrones)) {
                    this.ownedDrones = this.ownedDrones.filter(d => d && !d.dead);
                    aliveCount = this.ownedDrones.length;
                }
                if (this.ownedDrone && !this.ownedDrone.dead && (!Array.isArray(this.ownedDrones) || !this.ownedDrones.includes(this.ownedDrone))) {
                    aliveCount = Math.max(1, aliveCount);
                }
            }
            if (aliveCount <= 0) {
                // 드론 죽음 → rifle 모드 복귀
                this.ownedDrone = null;
                this.ownedDrones = [];
                this.opState = 'rifle';
            }
            // laptop 상태 유지 (정지)
            this.updateFacing();  // [FIX] facing 확정
            return;
        }
    }

    // [R 4.3 HOTFIX] facing 우선순위:
    // 1) 실제 이동 방향 우선
    // 2) 정지 상태에서만 전투 타겟 방향 보정
    updateFacing() {
        if (this.dead) return;
        if (this.isIcbmLauncherUnit()) {
            this.facing = (this.stats.id === 'icbm') ? -1 : 1;
            this._lastX = this.x;
            return;
        }

        const category = String((this.stats && this.stats.category) || '');
        const unitType = String((this.stats && this.stats.type) || '');
        const isArmoredLike = (category === 'armored' || unitType === 'mech');

        // Armored reverse-retreat: keep hull facing the threat while moving away.
        if (this.commandMode === 'retreat'
            && isArmoredLike
            && !this.returnToBase) {
            if (this.facing == null) {
                this.facing = (this.team === 'player') ? 1 : -1;
            }
            let retreatThreatX = Number(this._retreatThreatX);
            if (!Number.isFinite(retreatThreatX) && this._retreatThreatRef && !this._retreatThreatRef.dead) {
                retreatThreatX = Number(this._retreatThreatRef.x);
            }
            if (Number.isFinite(retreatThreatX)) {
                const dtx = retreatThreatX - this.x;
                if (Math.abs(dtx) > 3) {
                    this.facing = dtx >= 0 ? 1 : -1;
                }
            }
            this._lastX = this.x;
            return;
        }

        var combatTarget = null;
        if (this.attackTarget && !this.attackTarget.dead) {
            combatTarget = this.attackTarget;
        } else if (this._combatSideTarget && !this._combatSideTarget.dead) {
            const sideTargetTeam = this._combatSideTarget.team;
            if (sideTargetTeam && sideTargetTeam !== this.team && sideTargetTeam !== 'neutral') {
                combatTarget = this._combatSideTarget;
            }
        }
        const frameNow = (typeof game !== 'undefined' && game && Number.isFinite(game.frame)) ? game.frame : NaN;
        const lastAttackFrame = Number(this.lastAttack);
        const attackedRecently = Number.isFinite(frameNow) && Number.isFinite(lastAttackFrame) && (frameNow - lastAttackFrame <= 180);
        const isAirLike = (category === 'air' || unitType === 'air');
        const isCombatFacingUnit = isArmoredLike || isAirLike;

        // Combat-facing priority for armored/air:
        // while actively fighting, keep nose/hull toward target to avoid left-right flips.
        if (isCombatFacingUnit
            && combatTarget
            && (this.attackTarget || attackedRecently)
            && this.commandMode !== 'retreat'
            && !this.returnToBase) {
            const tx = Number(combatTarget.x);
            if (Number.isFinite(tx)) {
                const dtx = tx - this.x;
                if (Math.abs(dtx) > 6) {
                    this.facing = dtx >= 0 ? 1 : -1;
                    this._lastX = this.x;
                    return;
                }
            }
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

        // 카테고리별 임계값(너무 작은 흔들림은 무시)
        let facingThreshold = 0.5;
        if (category === 'infantry') facingThreshold = 0.14;
        else if (category === 'armored' || unitType === 'mech') facingThreshold = 0.06;
        else if (category === 'air' || unitType === 'air') facingThreshold = 0.12;

        const dxAbs = Math.abs(dx);
        if (category === 'infantry'
            && combatTarget
            && (this.attackTarget || attackedRecently)
            && this.commandMode !== 'move'
            && this.commandMode !== 'retreat') {
            const tx = Number(combatTarget.x);
            if (Number.isFinite(tx)) {
                const dtx = tx - this.x;
                // While firing or micro-shuffling, keep facing to enemy to prevent flip jitter.
                if (dxAbs <= (facingThreshold * 2.2) && Math.abs(dtx) > 4) {
                    this.facing = dtx >= 0 ? 1 : -1;
                    return;
                }
            }
        }
        if (Math.abs(dx) > facingThreshold) {
            this.facing = dx > 0 ? 1 : -1;
            this._facingCandidate = 0;
            this._facingCandidateFrames = 0;
            return;
        }

        // Armored units keep hull facing to their combat target when almost stationary.
        if (isArmoredLike
            && combatTarget
            && (this.attackTarget || attackedRecently || this.commandMode === 'stop' || this.commandMode === 'attack')
            && this.commandMode !== 'move'
            && this.commandMode !== 'retreat'
            && !this.returnToBase) {
            const tx = Number(combatTarget.x);
            if (Number.isFinite(tx)) {
                const dtx = tx - this.x;
                if (Math.abs(dtx) > 5) {
                    this.facing = dtx >= 0 ? 1 : -1;
                }
            }
        }
    }

    _isRetreatCapableUnit() {
        const id = String((this.stats && this.stats.id) || '');
        // Fast fixed-route aircraft and strategic launchers are excluded.
        if (id === 'fighter' || id === 'recon' || id === 'bomber' || id === 'stealth_drone') return false;
        if (id === 'icbm' || id === 'icbm_enemy') return false;
        // Light wheeled vehicles look unnatural when repeatedly auto-retreating at low HP.
        if (id === 'humvee' || id === 'apc') return false;
        return true;
    }

    _findNearestRetreatThreat(enemies, buildings) {
        let best = null;
        let bestDist = Infinity;
        const selfTeam = this.team;
        const selfX = Number(this.x) || 0;

        const scan = (obj) => {
            if (!obj || obj.dead) return;
            if (obj.team === selfTeam || obj.team === 'neutral') return;
            if (obj.stats && obj.stats.invulnerable) return;
            const ox = Number(obj.x);
            if (!Number.isFinite(ox)) return;
            const d = Math.abs(ox - selfX);
            if (d < bestDist) {
                bestDist = d;
                best = obj;
            }
        };

        if (Array.isArray(enemies)) {
            for (let i = 0; i < enemies.length; i++) scan(enemies[i]);
        }
        if (Array.isArray(buildings)) {
            for (let i = 0; i < buildings.length; i++) scan(buildings[i]);
        }
        return best;
    }

    _clearRetreatState(frameNow) {
        const fNow = Number.isFinite(frameNow)
            ? frameNow
            : ((typeof game !== 'undefined' && game && Number.isFinite(game.frame)) ? game.frame : 0);
        this.retreatUntilFrame = 0;
        this.retreatMinHoldUntil = 0;
        this.retreatCooldownUntil = Math.max(Number(this.retreatCooldownUntil) || 0, fNow + 240);
        this._retreatThreatRef = null;
        this._retreatThreatX = null;
        this.attackTarget = null;
        this.targetX = null;
        this.commandTargetX = null;
        this.commandMode = (this.team === 'enemy') ? 'attack' : 'stop';
    }

    _tryAutoEnterRetreat(target, enemies, buildings) {
        // Auto retreat is AI-only for now. (Player retreat remains manual.)
        if (this.team !== 'enemy') return false;
        if (!this._isRetreatCapableUnit()) return false;
        if (this.commandMode === 'retreat') return true;

        const frameNow = (typeof game !== 'undefined' && game && Number.isFinite(game.frame)) ? game.frame : 0;
        const cooldownUntil = Number(this.retreatCooldownUntil) || 0;
        if (frameNow < cooldownUntil) return false;

        const hp = Number(this.hp);
        const maxHp = Math.max(1, Number(this.maxHp) || 1);
        const hpRatio = Number.isFinite(hp) ? (hp / maxHp) : 1;
        const category = String((this.stats && this.stats.category) || '');
        const unitType = String((this.stats && this.stats.type) || '');

        let hpThreshold = 0.34;
        if (category === 'armored' || unitType === 'mech') hpThreshold = 0.30;
        if (unitType === 'air') hpThreshold = 0.28;
        if (String((this.stats && this.stats.id) || '') === 'aa_tank') hpThreshold = 0.33;

        const lastHit = Number(this.lastDamagedFrame);
        const recentlyHit = Number.isFinite(lastHit) && (frameNow - lastHit <= 180);
        if (!recentlyHit && hpRatio > hpThreshold) return false;

        const threat = (target && !target.dead) ? target : this._findNearestRetreatThreat(enemies, buildings);
        if (!threat) return false;

        const tx = Number(threat.x);
        if (!Number.isFinite(tx)) return false;
        const dist = Math.abs(tx - this.x);
        const effRange = Number(this.getEffectiveRange ? this.getEffectiveRange() : (this.stats && this.stats.range)) || 0;
        const pressureRange = Math.max(130, effRange * 0.92);
        if (dist > pressureRange && hpRatio > hpThreshold) return false;

        this._retreatThreatRef = threat;
        this._retreatThreatX = tx;

        this.commandMode = 'retreat';
        this.returnToBase = false;
        this.attackTarget = null;
        this.targetX = null;
        this.commandTargetX = null;

        this.combatHoldAnchorX = null;
        this.combatHoldTarget = null;
        this.combatHoldStartFrame = -1;

        this.retreatMinHoldUntil = frameNow + 90;
        this.retreatUntilFrame = frameNow + 240;
        return true;
    }

    _updateRetreat(enemies, buildings) {
        if (this.commandMode !== 'retreat') return false;
        if (!this._isRetreatCapableUnit()) {
            this._clearRetreatState();
            return false;
        }

        const frameNow = (typeof game !== 'undefined' && game && Number.isFinite(game.frame)) ? game.frame : 0;
        let threat = (this.attackTarget && !this.attackTarget.dead) ? this.attackTarget : null;
        if (!threat) threat = this._findNearestRetreatThreat(enemies, buildings);

        const speed = Math.max(0, Number(this.stats && this.stats.speed) || 0);
        if (speed <= 0) {
            this._clearRetreatState(frameNow);
            return true;
        }

        const threatX = (threat && Number.isFinite(Number(threat.x))) ? Number(threat.x) : NaN;
        if (Number.isFinite(threatX)) {
            this._retreatThreatRef = threat;
            this._retreatThreatX = threatX;
        } else {
            this._retreatThreatRef = null;
            this._retreatThreatX = null;
        }

        let awayDir = 0;
        if (Number.isFinite(threatX)) {
            awayDir = (threatX >= this.x) ? -1 : 1;
        } else {
            awayDir = ((Number(this.facing) || 1) >= 0) ? -1 : 1;
        }

        const category = String((this.stats && this.stats.category) || '');
        const unitType = String((this.stats && this.stats.type) || '');
        const isArmoredLike = (category === 'armored' || unitType === 'mech');
        let retreatSpeedMul = 1.0;
        if (category === 'infantry') retreatSpeedMul = 1.15;
        else if (isArmoredLike) retreatSpeedMul = 0.95;
        else if (unitType === 'air') retreatSpeedMul = 1.05;

        this.x += awayDir * speed * retreatSpeedMul;
        if (!isArmoredLike) {
            this.facing = awayDir;
        } else if (Number.isFinite(threatX)) {
            const dtx = threatX - this.x;
            if (Math.abs(dtx) > 3) this.facing = dtx >= 0 ? 1 : -1;
        }

        const minHoldDone = frameNow >= (Number(this.retreatMinHoldUntil) || 0);
        const hardTimeout = frameNow >= (Number(this.retreatUntilFrame) || 0);

        let safeEnough = false;
        if (Number.isFinite(threatX)) {
            const dist = Math.abs(threatX - this.x);
            const safeDist = Math.max(180, (Number(this.getEffectiveRange ? this.getEffectiveRange() : (this.stats && this.stats.range)) || 0) * 1.20);
            safeEnough = dist >= safeDist;
        } else {
            safeEnough = true;
        }

        if ((minHoldDone && safeEnough) || hardTimeout) {
            this._clearRetreatState(frameNow);
        }
        return true;
    }

    findNearestEnemy(enemies, buildings, options = null) {
        let t = null; let min = 9999;
        const x = this.x;
        const team = this.team;
        const ignoreRearPolicy = !!(options && options.ignoreRearPolicy);
        const restrictRear = (!ignoreRearPolicy && typeof this.shouldRestrictRearTargeting === 'function')
            ? this.shouldRestrictRearTargeting()
            : false;
        // [P0-3] spread 배열 생성 제거 - 순차적 for loop으로 GC 할당 제거
        for (let i = 0; i < enemies.length; i++) {
            const e = enemies[i];
            if (e && !e.dead && e.team !== team && e.team !== 'neutral') {
                if (restrictRear && typeof this.isTargetBehindX === 'function' && this.isTargetBehindX(e.x, 20)) continue;
                const dx = e.x - x;
                const d = dx < 0 ? -dx : dx;
                if (d < min) { min = d; t = e; }
            }
        }
        for (let i = 0; i < buildings.length; i++) {
            const e = buildings[i];
            if (e && !e.dead && e.team !== team && e.team !== 'neutral') {
                if (restrictRear && typeof this.isTargetBehindX === 'function' && this.isTargetBehindX(e.x, 20)) continue;
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
                            const ey = Number.isFinite(Number(e.y))
                                ? Number(e.y)
                                : (Number.isFinite(Number(game && game.groundY)) ? Number(game.groundY) : Number(this.y));
                            const d = Math.hypot((Number(e.x) || 0) - (Number(this.x) || 0), ey - (Number(this.y) || 0));
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
                        const by = Number.isFinite(Number(b.y))
                            ? Number(b.y)
                            : (Number.isFinite(Number(game && game.groundY)) ? Number(game.groundY) : Number(this.y));
                        const d = Math.hypot((Number(b.x) || 0) - (Number(this.x) || 0), by - (Number(this.y) || 0));
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
                        if (!e || e.dead || e === this) return;
                        const ey = Number.isFinite(Number(e.y))
                            ? Number(e.y)
                            : (Number.isFinite(Number(game && game.groundY)) ? Number(game.groundY) : Number(this.y));
                        const d = Math.hypot((Number(e.x) || 0) - (Number(this.x) || 0), ey - (Number(this.y) || 0));
                        if (d < 150) {
                            try { e.takeDamage(150); } catch (err) { }
                        }
                    });
                }
            }

            // [R 4.2] Owner 링크 처리: 드론 death 시 드론병 rifle 전환
            if (this.ownerRef && !this.ownerRef.dead) {
                if (typeof game !== 'undefined' && typeof game.removeOperatorDrone === 'function') {
                    game.removeOperatorDrone(this.ownerRef, this);
                } else if (this.ownerRef.ownedDrone === this) {
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
            const vol = AudioSystem.volume.sfx * AudioSystem.volume.master * 0.72 * audibility;
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

    _playManualMGBurstSound() {
        // Manual MG sound is now simple: loop while held, stop on release.
        this.manualMgModeActive = true;
        this._startTankMGSound();
    }

    _playManualMGReloadSound() {
        // No reload sound in simplified manual MG mode.
    }

    stopManualTankMG(forceStopAudio = true) {
        this.manualMgHeld = false;
        this.manualMgBurstEndFrame = 0;
        this.manualMgReloadEndFrame = 0;
        this.manualMgLastReloadAt = -1;
        if (this._manualMgClipAudio) {
            try {
                if (this._manualMgClipAudio._manualMgClipTimer) {
                    clearTimeout(this._manualMgClipAudio._manualMgClipTimer);
                    this._manualMgClipAudio._manualMgClipTimer = null;
                }
                this._manualMgClipAudio.pause();
                this._manualMgClipAudio.currentTime = 0;
            } catch (e) { }
            this._manualMgClipAudio = null;
        }
        if (forceStopAudio || this.manualMgModeActive === true) {
            this._stopTankMGSound();
        }
        this.manualMgModeActive = false;
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

    _resolveTankManualAim(targetX, targetY, opts = {}) {
        const tx = Number(targetX);
        const ty = Number(targetY);
        if (!Number.isFinite(tx) || !Number.isFinite(ty)) return null;

        const weaponType = String(opts.weapon || 'main').trim().toLowerCase();
        const facingRaw = Number(this.facing);
        const facing = (Number.isFinite(facingRaw) && facingRaw < 0) ? -1 : 1;

        let worldScale = 1.23424;
        try {
            if (typeof UnitRenderV2MBT !== 'undefined'
                && UnitRenderV2MBT
                && typeof UnitRenderV2MBT.getBattleWorldScale === 'function') {
                const s = Number(UnitRenderV2MBT.getBattleWorldScale());
                if (Number.isFinite(s) && s > 0.01) worldScale = s;
            }
        } catch (e) { }

        const pivotX = this.x + (facing * (5 * worldScale));
        const pivotY = this.y + (-30 * worldScale);

        let angle = -0.1;
        const weaponApi = (typeof UnitRenderV2Weapons_mbt !== 'undefined' && UnitRenderV2Weapons_mbt)
            ? UnitRenderV2Weapons_mbt
            : null;
        if (weaponApi && typeof weaponApi.computeAimAngleFromPoint === 'function') {
            angle = Number(weaponApi.computeAimAngleFromPoint(this, tx, ty));
        } else {
            const dxLocal = (tx - pivotX) * facing;
            const dyLocal = ty - pivotY;
            angle = Math.atan2(dyLocal, dxLocal);
        }
        if (weaponApi && typeof weaponApi.clampTurretAngle === 'function') {
            angle = Number(weaponApi.clampTurretAngle(angle));
        }
        if (!Number.isFinite(angle)) angle = -0.1;

        const dirX = facing * Math.cos(angle);
        const dirY = Math.sin(angle);

        const toWorldFromTurret = (localX, localY) => {
            return {
                x: this.x + (facing * ((5 + localX) * worldScale)),
                y: this.y + ((-30 + localY) * worldScale)
            };
        };

        let muzzleLocalX = (10 + (Math.cos(angle) * 70));
        let muzzleLocalY = (Math.sin(angle) * 70);
        if (weaponType === 'mg') {
            const mgOffsetX = 20;
            const mgOffsetY = -23;
            const cosA = Math.cos(angle);
            const sinA = Math.sin(angle);
            muzzleLocalX = (mgOffsetX * cosA) - (mgOffsetY * sinA);
            muzzleLocalY = (mgOffsetX * sinA) + (mgOffsetY * cosA);
        } else if (weaponApi && typeof weaponApi.computeMuzzleLocal === 'function') {
            const stateStore = (this._renderV2State && this._renderV2State.mbt) ? this._renderV2State.mbt : null;
            const recoilNow = Math.max(0, Number(stateStore && stateStore.recoil) || Number(this.recoil) || 0);
            const muzzleLocal = weaponApi.computeMuzzleLocal({ turretAngle: angle, recoil: recoilNow }, { barrelLength: 70 });
            if (muzzleLocal && Number.isFinite(muzzleLocal.x) && Number.isFinite(muzzleLocal.y)) {
                muzzleLocalX = muzzleLocal.x;
                muzzleLocalY = muzzleLocal.y;
            }
        }

        const muzzleWorld = toWorldFromTurret(muzzleLocalX, muzzleLocalY);
        const muzzleX = muzzleWorld.x;
        const muzzleY = muzzleWorld.y;

        const forward = ((tx - muzzleX) * dirX) + ((ty - muzzleY) * dirY);
        const minDistance = Math.max(20, Number(opts.minDistance) || 80);
        const maxDistance = Math.max(minDistance + 20, Number(opts.maxDistance) || 1000);
        const distance = Math.max(minDistance, Math.min(maxDistance, forward));

        return {
            angle,
            dirX,
            dirY,
            muzzleX,
            muzzleY,
            targetX: muzzleX + (dirX * distance),
            targetY: muzzleY + (dirY * distance)
        };
    }

    _fireTankMGAtPoint(targetX, targetY, opts = null) {
        if (!game || !game.projectiles) return false;
        const tx = Number(targetX);
        const ty = Number(targetY);
        if (!Number.isFinite(tx) || !Number.isFinite(ty)) return false;
        const dmg = 12;
        const spawnX = (opts && Number.isFinite(Number(opts.spawnX))) ? Number(opts.spawnX) : (this.x + (this.facing || 1) * 16);
        const spawnY = (opts && Number.isFinite(Number(opts.spawnY))) ? Number(opts.spawnY) : (this.y - (this.height ? this.height * 0.92 : 0));
        try {
            game.projectiles.push(new Projectile(spawnX, spawnY, null, dmg, this.team, 'machinegun', {
                source: this,
                targetX: tx,
                targetY: ty
            }));
        } catch (e) { return false; }
        if (typeof game !== 'undefined' && Number.isFinite(game.frame)) {
            this._mgLastShotFrame = game.frame;
        }
        if (!opts || opts.noSound !== true) this._startTankMGSound();
        return true;
    }

    tryManualTankMGFire(targetX, targetY) {
        if (!this || !this.stats || this.stats.id !== 'mbt') return false;
        if (this.dead || this.stunTimer > 0) return false;
        if (this.team !== 'player') return false;
        if (this.isSelected !== true) return false;
        if (typeof game === 'undefined' || !game) return false;
        const frameNow = Number.isFinite(game.frame) ? game.frame : 0;
        const rate = 3; // simple continuous fire cadence while right-click is held
        if ((frameNow - (Number(this.lastMGAttack) || 0)) <= rate) {
            this.manualMgModeActive = true;
            this._startTankMGSound();
            return false;
        }
        const aim = this._resolveTankManualAim(targetX, targetY, { weapon: 'mg', minDistance: 80, maxDistance: 900 });
        if (!aim) return false;
        const fired = this._fireTankMGAtPoint(aim.targetX, aim.targetY, {
            spawnX: aim.muzzleX,
            spawnY: aim.muzzleY,
            noSound: true
        });
        if (!fired) return false;
        this.manualMgModeActive = true;
        this._startTankMGSound();
        if (game && game.createParticles) {
            game.createParticles(aim.muzzleX, aim.muzzleY, 2, '#fbbf24');
        }
        this.lastMGAttack = frameNow;
        this.attackTarget = null;
        return true;
    }

    tryManualTankMainFire(targetX, targetY) {
        if (!this || !this.stats || this.stats.id !== 'mbt') return false;
        if (this.dead || this.stunTimer > 0) return false;
        if (this.team !== 'player') return false;
        if (typeof game === 'undefined' || !game || !game.projectiles) return false;

        const aim = this._resolveTankManualAim(targetX, targetY, { weapon: 'main', minDistance: 120, maxDistance: 1400 });
        if (!aim) return false;

        const frameNow = Number.isFinite(game.frame) ? game.frame : 0;
        const rate = 120;
        if ((frameNow - (Number(this.lastAttack) || 0)) <= rate) return false;

        const dmg = Number(this.stats.damage) || 0;
        const spawnX = aim.muzzleX;
        const spawnY = aim.muzzleY;
        const shotOpts = {
            source: this,
            targetX: aim.targetX,
            targetY: aim.targetY,
            impactVfx: 'tank_shell',
            impactVfxAir: 'airburst',
            impactVfxOnly: true
        };

        try {
            game.projectiles.push(new Projectile(spawnX, spawnY, null, dmg, this.team, 'shell', shotOpts));
        } catch (e) { return false; }

        if (typeof AudioSystem !== 'undefined') {
            AudioSystem.playSFX('tank_fire', this.x);
        }
        this.recoil = Math.max(this.recoil || 0, 6);
        if (game && game.createParticles) {
            game.createParticles(spawnX, spawnY, 44, '#f59e0b');
            game.createParticles(spawnX, spawnY, 24, '#fff7c2');
        }
        this.lastAttack = frameNow;
        this.attackTarget = null;
        return true;
    }

    _getSpgGunAngleDeg() {
        let angleDeg = Number(this._spgGunAngleDeg);
        if (!Number.isFinite(angleDeg)) {
            const stateStore = (this._renderV2State && this._renderV2State.spg) ? this._renderV2State.spg : null;
            const gunAngle = Number(stateStore && stateStore.gunAngle);
            if (Number.isFinite(gunAngle)) angleDeg = gunAngle * 180 / Math.PI;
        }
        if (!Number.isFinite(angleDeg)) return NaN;
        while (angleDeg <= -180) angleDeg += 360;
        while (angleDeg > 180) angleDeg -= 360;
        return angleDeg;
    }

    _getSpgFireBlockDeg() {
        const deg = Number(this._spgFireBlockDeg);
        return Number.isFinite(deg) ? deg : 140;
    }

    _getSpgFireReadyAngleDeg() {
        const deg = Number(this._spgFireReadyAngleDeg);
        return Number.isFinite(deg) ? deg : -45;
    }

    _isSpgMovingForPosture() {
        return Math.abs(Number(this.vx) || 0) > 0.06;
    }

    _isSpgBarrelRaisedForFire(angleDeg) {
        const deg = Number.isFinite(angleDeg) ? angleDeg : this._getSpgGunAngleDeg();
        if (!Number.isFinite(deg)) return false;
        return deg <= this._getSpgFireReadyAngleDeg();
    }

    _canSpgFireNow() {
        if (!this || !this.stats || this.stats.id !== 'spg') return true;
        if (this._isSpgMovingForPosture()) return false;
        if (this._spgFireReady === true) return true;

        const angleDeg = this._getSpgGunAngleDeg();
        if (!Number.isFinite(angleDeg)) return false;
        if (Math.abs(angleDeg) >= this._getSpgFireBlockDeg()) return false;
        return this._isSpgBarrelRaisedForFire(angleDeg);
    }

    _getSpgFireCooldownFrames() {
        const angleDeg = this._getSpgGunAngleDeg();
        // Base 7s + extra delay on high-angle lob shots.
        if (Number.isFinite(angleDeg) && angleDeg <= -60) return 540; // 9.0s at 60fps
        if (Number.isFinite(angleDeg) && angleDeg <= -45) return 510; // 8.5s
        return 420; // 7.0s
    }

    _resolveSpgManualAim(targetX, targetY) {
        const tx = Number(targetX);
        const ty = Number(targetY);
        if (!Number.isFinite(tx) || !Number.isFinite(ty)) return null;

        const facingRaw = Number(this.facing);
        const facing = (Number.isFinite(facingRaw) && facingRaw < 0) ? -1 : 1;
        const baseRange = Number(this.getEffectiveRange ? this.getEffectiveRange() : (this.stats && this.stats.range)) || 900;
        const maxDistance = Math.max(900, baseRange);
        const minDistance = 260;

        let aimX = tx;
        let aimY = ty;
        const minForwardX = this.x + (facing * minDistance);
        const maxForwardX = this.x + (facing * maxDistance);
        if (facing > 0) {
            if (aimX < minForwardX) aimX = minForwardX;
            if (aimX > maxForwardX) aimX = maxForwardX;
        } else {
            if (aimX > minForwardX) aimX = minForwardX;
            if (aimX < maxForwardX) aimX = maxForwardX;
        }

        const travelDist = Math.abs(aimX - this.x);
        const arcHeight = Math.max(90, Math.min(260, Math.round(travelDist * 0.20)));
        const grav = 0.33;

        const weaponApi = (typeof UnitRenderV2Weapons_spg !== 'undefined' && UnitRenderV2Weapons_spg)
            ? UnitRenderV2Weapons_spg
            : null;
        let angle = -Math.PI / 4;
        if (weaponApi && typeof weaponApi.computeBallisticAimAngleFromPoint === 'function') {
            angle = Number(weaponApi.computeBallisticAimAngleFromPoint(this, aimX, aimY, {
                arcHeight: arcHeight,
                grav: grav
            }));
        } else if (weaponApi && typeof weaponApi.computeAimAngleFromPoint === 'function') {
            angle = Number(weaponApi.computeAimAngleFromPoint(this, aimX, aimY));
        } else {
            const dx = aimX - this.x;
            const dy = aimY - this.y;
            angle = Math.atan2(dy, dx * facing);
        }
        if (weaponApi && typeof weaponApi.clampGunAngle === 'function') {
            angle = Number(weaponApi.clampGunAngle(angle));
        }
        if (!Number.isFinite(angle)) angle = -Math.PI / 4;

        const stateStore = (this._renderV2State && this._renderV2State.spg) ? this._renderV2State.spg : null;
        let muzzleX = this.x + (facing * 20);
        let muzzleY = this.y - this.height * 0.55;
        if (weaponApi && typeof weaponApi.computeMuzzleWorld === 'function') {
            const muzzle = weaponApi.computeMuzzleWorld(this, { angle: angle, state: stateStore, barrelLength: 155 });
            if (muzzle && Number.isFinite(muzzle.x) && Number.isFinite(muzzle.y)) {
                muzzleX = muzzle.x;
                muzzleY = muzzle.y;
            }
        }

        return {
            angle: angle,
            muzzleX: muzzleX,
            muzzleY: muzzleY,
            targetX: aimX,
            targetY: aimY,
            arcHeight: arcHeight,
            grav: grav
        };
    }

    tryManualSpgMainFire(targetX, targetY) {
        if (!this || !this.stats || this.stats.id !== 'spg') return false;
        if (this.dead || this.stunTimer > 0) return false;
        if (this.team !== 'player') return false;
        if (this.isSelected !== true) return false;
        if (typeof game === 'undefined' || !game || !game.projectiles) return false;

        const frameNow = Number.isFinite(game.frame) ? game.frame : 0;
        const rate = this._getSpgFireCooldownFrames();
        if ((frameNow - (Number(this.lastAttack) || 0)) <= rate) return false;
        if (!this._canSpgFireNow()) return false;

        const aim = this._resolveSpgManualAim(targetX, targetY);
        if (!aim) return false;

        const angleDeg = aim.angle * 180 / Math.PI;
        if (Math.abs(angleDeg) >= this._getSpgFireBlockDeg()) return false;

        const dmg = Number(this.stats.damage) || 0;
        const dist = Math.abs(aim.targetX - aim.muzzleX);
        const shotArcHeight = Number.isFinite(Number(aim.arcHeight))
            ? Math.max(28, Number(aim.arcHeight))
            : Math.max(90, Math.min(260, Math.round(dist * 0.20)));
        const shotGrav = Number.isFinite(Number(aim.grav))
            ? Math.max(0.05, Number(aim.grav))
            : 0.33;
        const shotOpts = {
            source: this,
            targetX: aim.targetX,
            targetY: aim.targetY,
            arcHeight: shotArcHeight,
            grav: shotGrav,
            hitRadius: 24
        };

        try {
            game.projectiles.push(new Projectile(aim.muzzleX, aim.muzzleY, null, dmg, this.team, 'artillery', shotOpts));
        } catch (e) { return false; }

        this._spgLastShotAimX = shotOpts.targetX;
        this._spgLastShotAimY = shotOpts.targetY;
        this._spgLastShotFrame = frameNow;
        this._spgLastShotArcHeight = shotOpts.arcHeight;
        this._spgLastShotGrav = shotOpts.grav;
        this._spgLastShotAngle = Number.isFinite(Number(aim.angle)) ? Number(aim.angle) : null;

        this.recoil = Math.max(this.recoil || 0, 5);
        if (typeof AudioSystem !== 'undefined') {
            AudioSystem.playGun('self', this.x);
        }
        if (game && typeof game.createParticles === 'function') {
            game.createParticles(aim.muzzleX, aim.muzzleY, 14, '#ff7a00');
            game.createParticles(aim.muzzleX, aim.muzzleY, 8, '#fff1c2');
        }

        this.lastAttack = frameNow;
        this.attackTarget = null;
        return true;
    }

    _updateTankMG(target) {
        if (this.stats.id !== 'mbt') return;
        if (this.team === 'player' && this.manualMgHeld === true) {
            // Manual control path owns firing/audio while RMB is held.
            return;
        }
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
        const mgRange = Math.max(180, Math.min(420, this.getEffectiveRange() || 300));
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
        const mgRange = Math.max(180, Math.min(420, this.getEffectiveRange() || 300));
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

    _getRuntimeCombatUid(obj) {
        if (!obj || typeof obj !== 'object') return 0;
        const cur = Number(obj.__reclaimCombatUid);
        if (Number.isFinite(cur) && cur > 0) return cur;
        if (typeof game !== 'undefined' && game) {
            if (!Number.isFinite(game.__reclaimCombatUidSeq) || game.__reclaimCombatUidSeq < 1) {
                game.__reclaimCombatUidSeq = 1;
            }
            obj.__reclaimCombatUid = game.__reclaimCombatUidSeq++;
            return obj.__reclaimCombatUid;
        }
        obj.__reclaimCombatUid = Math.floor(Math.random() * 1000000) + 1;
        return obj.__reclaimCombatUid;
    }

    _getCombatHoldDistance(effectiveRange) {
        const range = Math.max(0, Number(effectiveRange) || 0);
        const id = String((this.stats && this.stats.id) || '');
        const type = String((this.stats && this.stats.type) || '');
        if (id === 'spg') return Math.max(260, Math.min(760, Math.round(range * 0.40)));
        if (id === 'sniper') return Math.max(260, Math.min(620, Math.round(range * 0.58)));
        if (id === 'mbt') return Math.max(240, Math.min(560, Math.round(range * 0.50)));
        if (id === 'aa_tank') return Math.max(220, Math.min(540, Math.round(range * 0.52)));
        if (type === 'air') return Math.max(220, Math.min(720, Math.round(range * 0.36)));
        if (id === 'humvee' || id === 'apc') return Math.max(160, Math.min(420, Math.round(range * 0.54)));
        return Math.max(120, Math.min(360, Math.round(range * 0.46)));
    }

    _getCombatSlotTier(target) {
        const selfUid = this._getRuntimeCombatUid(this);
        const targetUid = this._getRuntimeCombatUid(target);
        const hash = ((selfUid * 1103515245 + targetUid * 12345) >>> 0);
        return hash % 5; // 0..4
    }

    _getCombatHoldPolicy() {
        const id = String((this.stats && this.stats.id) || '');
        const type = String((this.stats && this.stats.type) || '');

        // Defaults: fixed-fire hold on armored/air for readability.
        let policy = { enabled: false, holdFrames: 120, safeNoHitFrames: 180 };
        if (type === 'air') policy = { enabled: true, holdFrames: 90, safeNoHitFrames: 120 };
        if (type === 'mech' || String((this.stats && this.stats.category) || '') === 'armored') {
            policy = { enabled: true, holdFrames: 120, safeNoHitFrames: 180 };
        }

        // Fast aircraft should keep moving.
        if (id === 'fighter' || id === 'recon' || id === 'bomber' || id === 'stealth_drone') {
            return { enabled: false, holdFrames: 0, safeNoHitFrames: 0 };
        }

        // AA tank keeps short hold only (must track air quickly).
        if (id === 'aa_tank') {
            return { enabled: true, holdFrames: 60, safeNoHitFrames: 90 };
        }

        // Helicopters: medium hold.
        if (id === 'apache' || id === 'blackhawk' || id === 'uh60' || id === 'chinook') {
            return { enabled: true, holdFrames: 90, safeNoHitFrames: 120 };
        }

        // Light armored: slightly shorter than MBT.
        if (id === 'humvee' || id === 'apc') {
            return { enabled: true, holdFrames: 96, safeNoHitFrames: 132 };
        }

        return policy;
    }

    _applyCombatSpacing(target, effectiveRange) {
        if (!target || target.dead) return;
        if (this.dead || this.stunTimer > 0) return;
        const id = String((this.stats && this.stats.id) || '');
        if (id === 'spg' || id === 'icbm' || id === 'icbm_enemy') return;

        const speed = Number(this.stats && this.stats.speed) || 0;
        if (speed <= 0) return;
        const targetX = Number(target.x);
        if (!Number.isFinite(targetX)) return;

        const category = String((this.stats && this.stats.category) || '');
        const unitType = String((this.stats && this.stats.type) || '');
        const isInfantry = (category === 'infantry');
        const isAir = !!(this.stats && this.stats.type === 'air');
        const isArmoredLike = (category === 'armored' || unitType === 'mech');
        if (isInfantry) {
            const forcedStance = String(this._forcedInfantryStance || '').trim().toLowerCase();
            const shouldHoldByForcedStance = (
                (forcedStance === 'crouching' || forcedStance === 'prone')
                && this.commandMode !== 'move'
                && this.commandMode !== 'retreat'
                && !this.returnToBase
            );
            if (shouldHoldByForcedStance) {
                if (!Number.isFinite(Number(this._infantryStanceHoldX))) {
                    this._infantryStanceHoldX = this.x;
                }
                this._infantryStanceHoldTarget = target;
                this.x = Number(this._infantryStanceHoldX);
                return;
            }
            const stateStore = this._getInfantryRenderState();
            if (stateStore) {
                const stance = String(stateStore.stance || '').trim().toLowerCase();
                const desiredStance = String(stateStore.desiredStance || '');
                const stationaryFrames = Number(stateStore.stationaryFrames) || 0;
                const pronePrepHoldFrames = 48; // 0.8s at 60fps.
                const shouldHoldByStance = (
                    (stance === 'crouching' || stance === 'prone')
                    && this.commandMode !== 'retreat'
                    && !this.returnToBase
                );
                if (shouldHoldByStance) {
                    // Explicit rule: crouching/prone infantry must fire from fixed position.
                    if (this.commandMode === 'move') this.commandMode = 'attack';
                    if (this._infantryStanceHoldTarget !== target || !Number.isFinite(Number(this._infantryStanceHoldX))) {
                        this._infantryStanceHoldTarget = target;
                        this._infantryStanceHoldX = this.x;
                    }
                    this.x = Number(this._infantryStanceHoldX);
                    return;
                }
                if (stance === 'crouching' && desiredStance === 'prone' && stationaryFrames < pronePrepHoldFrames) {
                    if (this.commandMode === 'move') this.commandMode = 'attack';
                    if (!Number.isFinite(Number(this._infantryStanceHoldX))) {
                        this._infantryStanceHoldX = this.x;
                    }
                    this._infantryStanceHoldTarget = target;
                    this.x = Number(this._infantryStanceHoldX);
                    return;
                }
            }
            if (this._infantryStanceHoldTarget === target || Number.isFinite(Number(this._infantryStanceHoldX))) {
                this._infantryStanceHoldTarget = null;
                this._infantryStanceHoldX = null;
            }
        }

        // Fixed-fire hold for armored/air:
        // stay at current position for N seconds, and only resume movement when not hit recently.
        const holdPolicy = this._getCombatHoldPolicy();
        if ((isAir || isArmoredLike)
            && holdPolicy.enabled
            && this.commandMode !== 'retreat'
            && this.commandMode !== 'move'
            && !this.returnToBase) {
            const frameNow = (typeof game !== 'undefined' && game && Number.isFinite(game.frame)) ? game.frame : 0;
            const holdFrames = Math.max(1, Number(holdPolicy.holdFrames) || 120);
            const safeNoHitFrames = Math.max(1, Number(holdPolicy.safeNoHitFrames) || 180);

            const sameHoldTarget = (this.combatHoldTarget === target);
            if (!sameHoldTarget || !Number.isFinite(Number(this.combatHoldAnchorX))) {
                this.combatHoldTarget = target;
                this.combatHoldAnchorX = this.x;
                this.combatHoldStartFrame = frameNow;
            }

            const lastHitFrame = Number(this.lastDamagedFrame);
            const recentlyHit = Number.isFinite(lastHitFrame) && ((frameNow - lastHitFrame) < safeNoHitFrames);
            const holdStart = Number(this.combatHoldStartFrame);
            const holdElapsed = Number.isFinite(holdStart) ? (frameNow - holdStart) : 0;
            const shouldHold = (holdElapsed < holdFrames) || recentlyHit;

            if (shouldHold) {
                if (Number.isFinite(Number(this.combatHoldAnchorX))) {
                    this.x = Number(this.combatHoldAnchorX);
                }
                return;
            }

            // Release hold and allow spacing move.
            this.combatHoldAnchorX = null;
            this.combatHoldTarget = null;
            this.combatHoldStartFrame = -1;
        } else {
            this.combatHoldAnchorX = null;
            this.combatHoldTarget = null;
            this.combatHoldStartFrame = -1;
        }

        const holdBase = this._getCombatHoldDistance(effectiveRange);
        let side = (this.x <= targetX) ? -1 : 1;
        const sameTarget = (this._combatSideTarget === target);
        const lockedSide = Number(this._combatSideSign);
        if (sameTarget && (lockedSide === -1 || lockedSide === 1)) {
            side = lockedSide;
        }
        if (isAir) {
            // Air units keep broad side separation but can switch if they crossed over.
            side = (this.team === 'player') ? -1 : 1;
            if (Math.abs(this.x - targetX) < holdBase * 0.45) side = (this.x <= targetX) ? -1 : 1;
        } else {
            // Ground units keep side unless they clearly crossed over target center.
            const crossMargin = isInfantry
                ? Math.max(38, holdBase * 0.32)
                : Math.max(18, holdBase * 0.18);
            if (side < 0 && this.x > targetX + crossMargin) side = 1;
            if (side > 0 && this.x < targetX - crossMargin) side = -1;
        }
        this._combatSideTarget = target;
        this._combatSideSign = side;

        const tier = this._getCombatSlotTier(target);
        const baseSlotStep = isAir ? 32 : 24;
        const minFront = isAir ? 48 : 62;
        const range = Math.max(0, Number(effectiveRange) || 0);
        const rangeMargin = isAir ? 18 : 12;
        const maxFireDist = Math.max(minFront, range - rangeMargin);
        const maxExtra = Math.max(0, maxFireDist - holdBase);
        const slotStep = (maxExtra > 0) ? Math.min(baseSlotStep, maxExtra / 4) : 0;

        let desiredDist = holdBase + (tier * slotStep);
        if (desiredDist < minFront) desiredDist = minFront;
        if (desiredDist > maxFireDist) desiredDist = maxFireDist;

        let desiredX = targetX + (side * desiredDist);

        // Repel nearby allies shooting the same target to reduce stacking.
        if (typeof game !== 'undefined' && game) {
            const allies = (this.team === 'player') ? game.players : game.enemies;
            if (Array.isArray(allies) && allies.length > 1) {
                const minGap = isAir
                    ? Math.max(24, Math.round((Number(this.width) || 20) * 0.8))
                    : Math.max(18, Math.round((Number(this.width) || 20) * 0.55));
                const repelScope = minGap * 2.2;
                let repel = 0;
                const selfUid = this._getRuntimeCombatUid(this);

                for (let i = 0; i < allies.length; i++) {
                    const u = allies[i];
                    if (!u || u === this || u.dead) continue;
                    if (u.attackTarget !== target) continue;
                    if (u.stats && this.stats && u.stats.type !== this.stats.type) continue;
                    const dx = this.x - u.x;
                    const adx = Math.abs(dx);
                    if (adx > repelScope) continue;

                    if (adx < 0.001) {
                        const otherUid = this._getRuntimeCombatUid(u);
                        repel += (selfUid > otherUid) ? 0.5 : -0.5;
                        continue;
                    }

                    if (adx < minGap) {
                        const push = (minGap - adx) / minGap;
                        repel += (dx >= 0 ? 1 : -1) * push;
                    }
                }

                if (repel !== 0) {
                    desiredX += repel * (isAir ? 16 : 12);
                }
            }
        }

        if (side < 0) {
            desiredX = Math.min(desiredX, targetX - minFront);
            desiredX = Math.max(desiredX, targetX - maxFireDist);
        } else {
            desiredX = Math.max(desiredX, targetX + minFront);
            desiredX = Math.min(desiredX, targetX + maxFireDist);
        }

        const dxMove = desiredX - this.x;
        const deadZone = isAir ? 12 : (isInfantry ? 14 : 8);
        if (Math.abs(dxMove) <= deadZone) return;

        const baseStep = Math.min(Math.max(speed * 0.8, 0.2), Math.abs(dxMove));
        const suppressionMoveMul = this._getInfantrySuppressionMoveMul(null, true);
        const step = Math.max(0.08, baseStep * suppressionMoveMul);
        const dir = Math.sign(dxMove);
        const nextX = this.x + (dir * step);

        // For armored/air, avoid "retreat-like backstep" while already in good firing range.
        if ((isAir || isArmoredLike)
            && this.commandMode !== 'retreat'
            && !this.returnToBase) {
            const distNow = Math.abs(targetX - this.x);
            const distNext = Math.abs(targetX - nextX);
            const holdRange = Math.max(70, (Number(effectiveRange) || 0) * 0.92);
            if (distNow <= holdRange && distNext > (distNow + 0.6)) {
                return;
            }
        }
        if (isInfantry
            && this.commandMode !== 'retreat'
            && !this.returnToBase) {
            const distNow = Math.abs(targetX - this.x);
            const distNext = Math.abs(targetX - nextX);
            const holdRange = Math.max(56, (Number(effectiveRange) || 0) * 0.95);
            if (distNow <= holdRange && distNext > (distNow + 0.35)) {
                return;
            }
        }

        this.x = nextX;
    }

    attack(target) {
        if (!game || !game.projectiles) return;
        if (this.stats.onlyAir && (!target || !target.stats || target.stats.type !== 'air')) return;
        if (target && target.stats && target.stats.invulnerable) return;
        const flags = getFeatureFlagsSnapshot();
        const useInfantryAccuracyV2 = isFeatureFlagEnabled('infantryAccuracyV2', flags);
        const useInfantrySuppressionV1 = this._isInfantrySuppressionEnabled(flags);
        const id = this.stats.id;
        if (id === 'bagpiper') return;
        if (id === 'apache' || id === 'fighter') {
            const targetId = String((target && target.stats && target.stats.id) || '').toLowerCase();
            const targetCategory = String((target && target.stats && target.stats.category) || '').toLowerCase();
            const isDroneLikeTarget = targetCategory === 'drone' || targetId.includes('drone') || targetId === 'tactical_drone';
            if (isDroneLikeTarget) return;
        }
        let dmg = this.stats.damage;
        let infantryShotHitChanceMul = 1;
        if (useInfantryAccuracyV2 && this.stats && this.stats.category === 'infantry') {
            const profile = this._getInfantryCombatProfile();
            if (profile) {
                const profileDamageMul = Number(profile.damageMul);
                if (Number.isFinite(profileDamageMul)) {
                    dmg = Math.max(1, Math.round((Number(dmg) || 0) * profileDamageMul));
                }
                const profileHitMul = Number(profile.hitChanceMul);
                if (Number.isFinite(profileHitMul)) {
                    infantryShotHitChanceMul *= profileHitMul;
                }
            }

            const infState = this._getInfantryRenderState();
            if (infState) {
                const stance = String(infState.stance || '').trim().toLowerCase();
                const stationaryFrames = Number(infState.stationaryFrames) || 0;
                if (stationaryFrames >= 14) {
                    if (stance === 'prone') infantryShotHitChanceMul *= 1.24;
                    else if (stance === 'crouching') infantryShotHitChanceMul *= 1.12;
                } else if (this.commandMode === 'move') {
                    infantryShotHitChanceMul *= 0.88;
                }
            }
        }

        if (useInfantrySuppressionV1 && this.stats && this.stats.category === 'infantry') {
            infantryShotHitChanceMul *= this._getInfantrySuppressionHitMul(flags);
        }
        if (this.stats && this.stats.category === 'infantry') {
            infantryShotHitChanceMul = Math.max(0.45, Math.min(1.45, infantryShotHitChanceMul));
        }

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

            if (isArmoredOrAir && !isDrone && this.missileReady !== false) {
                if (this._isEngineerMissileTargetLocked(target, { allowOwner: this })) {
                    this.engineerMode = 'carrying';
                    return;
                }
                this._lockEngineerMissileTarget(target, 96);
                // 미사일 모드: 기갑/공중 (드론 제외)
                this.engineerMode = 'firing';
                const missileDmgRaw = Number(this.stats.missileDamage);
                const missileDmg = (Number.isFinite(missileDmgRaw) && missileDmgRaw > 0) ? missileDmgRaw : 120;
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

        // Bradley IFV (apc): 25mm autocannon + TOW anti-armor missile.
        if (id === 'apc') {
            const targetType = target && target.stats ? String(target.stats.type || '') : '';
            const targetId = target && target.stats ? String(target.stats.id || '') : '';
            const isDrone = targetId.includes('drone') || targetId === 'tactical_drone';
            const isTowTarget = !!target && !isDrone && (
                targetType === 'mech'
                || targetId === 'icbm'
                || targetId === 'icbm_enemy'
                || (!target.stats && target.team && target.team !== this.team && target.team !== 'neutral')
            );
            const frameNow = Number.isFinite(game && game.frame) ? game.frame : 0;
            const towCooldown = Math.max(45, Math.floor(Number(this.stats && this.stats.missileCooldownFrames) || 150));
            const lastTowFrame = Number(this.apcTowLastFrame);
            const towReady = !Number.isFinite(lastTowFrame) || (frameNow - lastTowFrame) >= towCooldown;

            if (isTowTarget && towReady) {
                let spawnX = this.x + ((Number(this.facing) >= 0 ? 1 : -1) * 22);
                let spawnY = this.y - this.height * 0.55;
                const targetX = Number(target && target.x);
                const targetY = Number(target && target.y) - ((Number(target && target.height) || 0) * 0.30);
                if (typeof UnitRenderV2Weapons_apc !== 'undefined'
                    && UnitRenderV2Weapons_apc
                    && typeof UnitRenderV2Weapons_apc.computeMuzzleWorld === 'function') {
                    const stateStore = (this._renderV2State && this._renderV2State.apc) ? this._renderV2State.apc : null;
                    const muzzle = UnitRenderV2Weapons_apc.computeMuzzleWorld(this, {
                        targetX: targetX,
                        targetY: targetY,
                        state: stateStore,
                        weapon: 'tow'
                    });
                    if (muzzle && Number.isFinite(muzzle.x) && Number.isFinite(muzzle.y)) {
                        spawnX = muzzle.x;
                        spawnY = muzzle.y;
                    }
                }

                const towDamageRaw = Number(this.stats && this.stats.missileDamage);
                const towDamage = (Number.isFinite(towDamageRaw) && towDamageRaw > 0)
                    ? towDamageRaw
                    : Math.max(dmg * 4, 90);
                const towOpts = {
                    source: this,
                    impactVfx: 'tank_shell',
                    impactVfxAir: 'airburst'
                };
                game.projectiles.push(new Projectile(spawnX, spawnY, target, towDamage, this.team, 'engineer_missile', towOpts));
                this.apcTowLastFrame = frameNow;
                this.missileFlash = 7;
                this.recoil = Math.max(this.recoil || 0, 2.8);
                if (typeof AudioSystem !== 'undefined') {
                    AudioSystem.playSFX('rocket_launcher', this.x);
                }
                if (typeof game.createParticles === 'function') {
                    game.createParticles(spawnX, spawnY, 10, '#ffb347');
                    game.createParticles(spawnX, spawnY, 6, '#fff4cc');
                }
                return;
            }
        }

        // [기존] 발사체 타입 결정
        let type = 'bullet';
        let shotOpts = null;
        if (['spg'].includes(id)) type = 'artillery';
        else if (['mbt'].includes(id)) type = 'shell';
        else if (['apache'].includes(id)) type = 'rocket';
        else if (['aa_tank', 'turret'].includes(id)) type = 'aa_shell';
        else if (['humvee'].includes(id)) type = 'humvee_burst';  // [FIX] 험비는 건물 파괴 가능
        else if (['apc', 'blackhawk', 'uh60', 'fighter'].includes(id)) type = 'machinegun';
        if (id === 'apc') {
            shotOpts = { impactVfx: 'shell_hit', impactVfxAir: 'airburst' };
        } else if (id === 'mbt') {
            shotOpts = { impactVfx: 'tank_shell', impactVfxAir: 'airburst', impactVfxOnly: true };
        }

        let projectileTarget = target;
        let shotExtras = null;
        let artilleryAimX = null;
        let artilleryAimY = null;
        let artilleryShotAngle = null;
        if (id === 'spg' && type === 'artillery') {
            const facingRaw = Number(this.facing);
            const facingDir = Number.isFinite(facingRaw) && facingRaw !== 0
                ? (facingRaw > 0 ? 1 : -1)
                : (this.team === 'player' ? 1 : -1);
            const stateStore = (this._renderV2State && this._renderV2State.spg) ? this._renderV2State.spg : null;
            let barrelDeg = Number(this._spgGunAngleDeg);
            if (!Number.isFinite(barrelDeg)) {
                const barrelAngle = Number(stateStore && stateStore.gunAngle);
                if (Number.isFinite(barrelAngle)) barrelDeg = barrelAngle * 180 / Math.PI;
            }
            while (Number.isFinite(barrelDeg) && barrelDeg <= -180) barrelDeg += 360;
            while (Number.isFinite(barrelDeg) && barrelDeg > 180) barrelDeg -= 360;
            const fireBlockDeg = this._getSpgFireBlockDeg();
            // 이동 자세(포신 하강)에서는 발사하지 않고, 포신 상승 후에만 발사.
            if (!this._canSpgFireNow()) {
                return;
            }
            if (Number.isFinite(barrelDeg) && Math.abs(barrelDeg) >= fireBlockDeg) {
                return;
            }

            const effRange = Math.max(
                900,
                Number(this.getEffectiveRange ? this.getEffectiveRange() : (this.stats && this.stats.range)) || 900
            );
            const groundY = (game && Number.isFinite(game.groundY)) ? game.groundY : this.y;

            if (this.team === 'enemy') {
                const targetX = Number(target && target.x);
                const longShot = effRange * (0.9 + Math.random() * 0.7);
                let aimX = Number.isFinite(targetX)
                    ? (targetX + ((Math.random() - 0.5) * 360))
                    : (this.x + (facingDir * longShot));

                // Enemy SPG shoots by rough estimation (can miss).
                if (Math.random() < 0.4) {
                    aimX = this.x + (facingDir * longShot * (0.8 + Math.random() * 0.6));
                }

                const minForward = this.x + (facingDir * effRange * 0.45);
                if (facingDir > 0 && aimX < minForward) aimX = minForward + (Math.random() * 120);
                if (facingDir < 0 && aimX > minForward) aimX = minForward - (Math.random() * 120);

                artilleryAimX = aimX + ((Math.random() - 0.5) * 220);
                artilleryAimY = groundY + ((Math.random() - 0.5) * 24);
            } else {
                const targetX = Number(target && target.x);
                const targetY = Number(target && target.y);
                const fallbackDist = effRange * (0.9 + Math.random() * 0.4);
                artilleryAimX = Number.isFinite(targetX)
                    ? (targetX + ((Math.random() - 0.5) * 40))
                    : (this.x + (facingDir * fallbackDist));
                artilleryAimY = Number.isFinite(targetY)
                    ? (targetY - ((Number(target && target.height) || 0) * 0.2) + ((Math.random() - 0.5) * 18))
                    : groundY;
            }

            // Prevent near-self impact around turret.
            const minManualDist = 260;
            if (facingDir > 0 && artilleryAimX < (this.x + minManualDist)) {
                artilleryAimX = this.x + minManualDist;
            }
            if (facingDir < 0 && artilleryAimX > (this.x - minManualDist)) {
                artilleryAimX = this.x - minManualDist;
            }

            const travelDist = Math.abs(artilleryAimX - this.x);
            const shotArcHeight = Math.max(180, Math.min(460, Math.round(travelDist * 0.34)));
            const shotGrav = 0.33;
            shotExtras = {
                targetX: artilleryAimX,
                targetY: artilleryAimY,
                arcHeight: shotArcHeight,
                grav: shotGrav,
                hitRadius: 24
            };
            if (typeof UnitRenderV2Weapons_spg !== 'undefined'
                && UnitRenderV2Weapons_spg
                && typeof UnitRenderV2Weapons_spg.computeBallisticAimAngleFromPoint === 'function'
                && Number.isFinite(artilleryAimX)
                && Number.isFinite(artilleryAimY)) {
                artilleryShotAngle = Number(UnitRenderV2Weapons_spg.computeBallisticAimAngleFromPoint(this, artilleryAimX, artilleryAimY, {
                    arcHeight: shotArcHeight,
                    grav: shotGrav
                }));
            }
            projectileTarget = null;
        }

        // 총소리 재생 (유닛 타입별)
        // 고속 연사 유닛만 확률 샘플링하고, 나머지는 매 발사마다 재생해 체감 손실을 줄인다.
        let shouldPlayGunSFX = true;
        if (id === 'humvee' || id === 'apc' || id === 'aa_tank' || type === 'machinegun') {
            shouldPlayGunSFX = (Math.random() < 0.6);
        } else if (id === 'blackhawk' || id === 'uh60' || id === 'fighter') {
            shouldPlayGunSFX = (Math.random() < 0.5);
        }
        if (typeof AudioSystem !== 'undefined' && shouldPlayGunSFX) {
            // [ITEM] M249 장착 베테랑: gun4.mp3 총소리
            if (this.veteranGunType === 'rifle_d') AudioSystem.playGun('rifle_d', this.x);
            else if (id === 'infantry') AudioSystem.playGun('infantry', this.x);
            else if (id === 'special_ops') AudioSystem.playGun('special_ops', this.x);
            else if (id === 'sniper') AudioSystem.playGun('sniper', this.x);
            else if (id === 'humvee') AudioSystem.playGun('machine_gun', this.x);
            else if (id === 'apc') AudioSystem.playGun('flak', this.x);
            else if (id === 'aa_tank') AudioSystem.playGun('flak', this.x);
            else if (id === 'mbt') AudioSystem.playSFX('tank_fire', this.x);
            else if (id === 'spg' || id === 'apache') AudioSystem.playGun('self', this.x);
            else AudioSystem.playSFX('shoot', this.x);
        }

        const recoilKick = (id === 'mbt') ? 6 : ((id === 'spg') ? 5 : ((id === 'apc') ? 2.2 : ((id === 'aa_tank') ? 2.4 : 0)));
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
            let spawnX = this.x;
            let spawnY = this.y - this.height / 2;
            if (id === 'mbt' && type === 'shell') {
                spawnY = this.y - this.height * 0.38; // 포신 (아래쪽)
            }
            if (id === 'humvee' && type === 'humvee_burst') {
                const targetX = Number(target && target.x);
                const targetY = Number(target && target.y) - ((Number(target && target.height) || 0) * 0.30);
                if (typeof UnitRenderV2Weapons_humvee !== 'undefined'
                    && UnitRenderV2Weapons_humvee
                    && typeof UnitRenderV2Weapons_humvee.computeMuzzleWorld === 'function') {
                    const stateStore = (this._renderV2State && this._renderV2State.humvee) ? this._renderV2State.humvee : null;
                    const muzzle = UnitRenderV2Weapons_humvee.computeMuzzleWorld(this, {
                        targetX: targetX,
                        targetY: targetY,
                        state: stateStore,
                        weapon: 'mg'
                    });
                    if (muzzle && Number.isFinite(muzzle.x) && Number.isFinite(muzzle.y)) {
                        spawnX = muzzle.x;
                        spawnY = muzzle.y;
                    }
                }
            }
            if (id === 'apc') {
                const targetX = Number(target && target.x);
                const targetY = Number(target && target.y) - ((Number(target && target.height) || 0) * 0.30);
                if (typeof UnitRenderV2Weapons_apc !== 'undefined'
                    && UnitRenderV2Weapons_apc
                    && typeof UnitRenderV2Weapons_apc.computeMuzzleWorld === 'function') {
                    const stateStore = (this._renderV2State && this._renderV2State.apc) ? this._renderV2State.apc : null;
                    const muzzle = UnitRenderV2Weapons_apc.computeMuzzleWorld(this, {
                        targetX: targetX,
                        targetY: targetY,
                        state: stateStore,
                        weapon: 'auto'
                    });
                    if (muzzle && Number.isFinite(muzzle.x) && Number.isFinite(muzzle.y)) {
                        spawnX = muzzle.x;
                        spawnY = muzzle.y;
                    }
                }
            }
            if (id === 'aa_tank' && type === 'aa_shell') {
                const targetX = Number(target && target.x);
                const targetY = Number(target && target.y) - ((Number(target && target.height) || 0) * 0.30);
                if (typeof UnitRenderV2Weapons_aa_tank !== 'undefined'
                    && UnitRenderV2Weapons_aa_tank
                    && typeof UnitRenderV2Weapons_aa_tank.computeMuzzleWorld === 'function') {
                    const stateStore = (this._renderV2State && this._renderV2State.aa_tank) ? this._renderV2State.aa_tank : null;
                    const shotFrame = (game && Number.isFinite(game.frame)) ? game.frame : NaN;
                    const muzzle = UnitRenderV2Weapons_aa_tank.computeMuzzleWorld(this, {
                        targetX: targetX,
                        targetY: targetY,
                        state: stateStore,
                        weapon: 'auto',
                        shotFrame: shotFrame
                    });
                    if (muzzle && Number.isFinite(muzzle.x) && Number.isFinite(muzzle.y)) {
                        spawnX = muzzle.x;
                        spawnY = muzzle.y;
                    }
                }
            }
            if ((id === 'blackhawk' || id === 'uh60') && type === 'machinegun') {
                const targetX = Number(target && target.x);
                const targetY = Number(target && target.y) - ((Number(target && target.height) || 0) * 0.30);
                if (typeof UnitRenderV2Weapons_blackhawk !== 'undefined'
                    && UnitRenderV2Weapons_blackhawk
                    && typeof UnitRenderV2Weapons_blackhawk.computeMuzzleWorld === 'function') {
                    const stateStore = (this._renderV2State && this._renderV2State.blackhawk) ? this._renderV2State.blackhawk : null;
                    const muzzle = UnitRenderV2Weapons_blackhawk.computeMuzzleWorld(this, {
                        targetX: targetX,
                        targetY: targetY,
                        state: stateStore
                    });
                    if (muzzle && Number.isFinite(muzzle.x) && Number.isFinite(muzzle.y)) {
                        spawnX = muzzle.x;
                        spawnY = muzzle.y;
                    }
                } else {
                    const facing = Number.isFinite(this.facing) && this.facing !== 0 ? (this.facing > 0 ? 1 : -1) : 1;
                    spawnX = this.x + (facing * Math.max(12, this.width * 0.26));
                    spawnY = this.y - this.height * 0.55;
                }
            }
            if (id === 'spg' && type === 'artillery') {
                const fallbackTargetX = Number(target && target.x);
                const fallbackTargetY = Number(target && target.y) - ((Number(target && target.height) || 0) * 0.25);
                const targetX = Number.isFinite(artilleryAimX) ? artilleryAimX : fallbackTargetX;
                const targetY = Number.isFinite(artilleryAimY) ? artilleryAimY : fallbackTargetY;
                if (typeof UnitRenderV2Weapons_spg !== 'undefined'
                    && UnitRenderV2Weapons_spg
                    && typeof UnitRenderV2Weapons_spg.computeMuzzleWorld === 'function') {
                    const stateStore = (this._renderV2State && this._renderV2State.spg) ? this._renderV2State.spg : null;
                    const muzzle = UnitRenderV2Weapons_spg.computeMuzzleWorld(this, {
                        targetX: targetX,
                        targetY: targetY,
                        angle: Number.isFinite(artilleryShotAngle) ? artilleryShotAngle : NaN,
                        state: stateStore
                    });
                    if (muzzle && Number.isFinite(muzzle.x) && Number.isFinite(muzzle.y)) {
                        spawnX = muzzle.x;
                        spawnY = muzzle.y;
                    } else {
                        spawnY = this.y - this.height * 0.55;
                    }
                } else {
                    spawnY = this.y - this.height * 0.55;
                }
            }
            const finalOpts = Object.assign({ source: this }, shotOpts || {}, shotExtras || {});
            if ((useInfantryAccuracyV2 || useInfantrySuppressionV1)
                && this.stats
                && this.stats.category === 'infantry'
                && (type === 'bullet' || type === 'machinegun')
                && Number.isFinite(Number(infantryShotHitChanceMul))) {
                finalOpts.hitChanceMul = Math.max(0.45, Math.min(1.45, Number(infantryShotHitChanceMul)));
            }
            game.projectiles.push(new Projectile(spawnX, spawnY, projectileTarget, dmg, this.team, type, finalOpts));
            if (id === 'spg' && type === 'artillery') {
                const nowFrame = (game && Number.isFinite(game.frame)) ? game.frame : 0;
                const finalTargetX = Number(finalOpts && finalOpts.targetX);
                const finalTargetY = Number(finalOpts && finalOpts.targetY);
                const finalArcHeight = Number(finalOpts && finalOpts.arcHeight);
                const finalGrav = Number(finalOpts && finalOpts.grav);
                if (Number.isFinite(finalTargetX)) this._spgLastShotAimX = finalTargetX;
                if (Number.isFinite(finalTargetY)) this._spgLastShotAimY = finalTargetY;
                this._spgLastShotFrame = nowFrame;
                if (Number.isFinite(finalArcHeight)) this._spgLastShotArcHeight = finalArcHeight;
                if (Number.isFinite(finalGrav)) this._spgLastShotGrav = finalGrav;
                if (Number.isFinite(artilleryShotAngle)) this._spgLastShotAngle = artilleryShotAngle;
            }
            if (id === 'humvee' && type === 'humvee_burst' && game && typeof game.createParticles === 'function') {
                game.createParticles(spawnX, spawnY, 3, '#ffcc55');
            }
            if (id === 'apc' && game && typeof game.createParticles === 'function') {
                game.createParticles(spawnX, spawnY, 2, '#ffcc55');
            }
            if (id === 'spg' && type === 'artillery' && game && typeof game.createParticles === 'function') {
                game.createParticles(spawnX, spawnY, 14, '#ff7a00');
                game.createParticles(spawnX, spawnY, 8, '#fff1c2');
            }
            // [ITEM] M249 장착 베테랑: 탄속 +35%
            if (this.veteranGunType === 'rifle_d' && game.projectiles.length > 0) {
                const lastProj = game.projectiles[game.projectiles.length - 1];
                if (lastProj && !lastProj.ballistic) {
                    const speedMult = 1.35;
                    lastProj.vx *= speedMult;
                    lastProj.vy *= speedMult;
                    lastProj.speed = (lastProj.speed || 18) * speedMult;
                }
            }
        } catch (e) { }
    }

    draw(ctx) {
        if (this.dead) return;
        const id = this.stats.id;
        const disableSkinForV2Armor = (id === 'mbt' || id === 'spg' || id === 'humvee' || id === 'apc' || id === 'aa_tank');
        const skins = (typeof window !== 'undefined' && window.RECLAIM_SKINS) ? window.RECLAIM_SKINS : null;
        const skin = (!disableSkinForV2Armor && skins) ? (skins[id] || skins[this.typeKey]) : null;
        const snapDy = this.computeFeetSnapDy(skin);
        const renderY = this.getRenderY();
        // Selected units use a center star marker instead of an HP bar.
        const showHp = !this.hideHp && !this.isSelected && (this.hp < this.maxHp);
        const drawHpBar = () => {
            if (typeof UnitRenderUtils !== 'undefined' && UnitRenderUtils.drawUnitHpBar) {
                UnitRenderUtils.drawUnitHpBar(this, ctx, snapDy, showHp);
                return;
            }
            if (!showHp) return;
            const hpPct = Math.max(0, this.hp / this.maxHp);
            const w = 24; const h = 4; const yOffset = -50;
            const barX = this.x;
            const barY = (renderY + snapDy) + yOffset;
            ctx.fillStyle = '#ef4444'; ctx.fillRect(barX - w / 2, barY, w, h);
                ctx.fillStyle = '#22c55e'; ctx.fillRect(barX - w / 2, barY, w * hpPct, h);
                ctx.strokeStyle = '#000'; ctx.lineWidth = 0.5; ctx.strokeRect(barX - w / 2, barY, w, h);
        };
        const drawSelectionMarker = () => {
            if (!this.isSelected || this.dead) return;
            const cx = Number(this.x) || 0;
            const h = Math.max(12, Number(this.height) || 24);
            const cat = String((this.stats && this.stats.category) || '').trim().toLowerCase();
            const type = String((this.stats && this.stats.type) || '').trim().toLowerCase();
            const isInfantryMarker = (cat === 'infantry' || type === 'bio');
            const isAirMarker = (type === 'air' || cat === 'air');
            const isArmoredMarker = (cat === 'armored' || type === 'mech');
            const baseY = (renderY + snapDy);
            let cy = baseY - (h * 0.46);
            if (isInfantryMarker) {
                const stanceRaw = this._getInfantryCurrentStance() || 'standing';
                let headOffset = h * 1.88;
                if (stanceRaw === 'crouching') headOffset = h * 1.52;
                else if (stanceRaw === 'prone') headOffset = h * 1.08;
                cy = baseY - headOffset - 9;
            } else if (isArmoredMarker) {
                // Armored/mech units are rendered with extra V2 scale; account for that so marker sits above hull.
                const armoredMarkerBoost = {
                    humvee: 1.18,
                    apc: 1.16,
                    mbt: 1.16,
                    spg: 1.16,
                    aa_tank: 1.12,
                    icbm: 1.16,
                    icbm_enemy: 1.16
                };
                const visualScale = 1.4 * (Number(armoredMarkerBoost[id]) || 1);
                const visualH = h * visualScale;
                const armoredExtraUp = {
                    humvee: 18,
                    apc: 22,
                    mbt: 30,
                    spg: 28,
                    aa_tank: 22,
                    icbm: 34,
                    icbm_enemy: 34
                };
                cy = baseY - (visualH * 0.68) - (Number(armoredExtraUp[id]) || 20);
            } else if (isAirMarker) {
                // Keep air-unit selection marker above rotor/body top (not the center).
                const airVisualScale = 1.4 * AIR_RENDER_SCALE_MULTIPLIER;
                const airVisualH = h * airVisualScale;
                const airExtraUp = {
                    recon: 12,
                    fighter: 14,
                    bomber: 16,
                    apache: 20,
                    blackhawk: 16,
                    uh60: 16,
                    chinook: 18
                };
                cy = baseY - (airVisualH * 0.92) - (Number(airExtraUp[id]) || 16);
            }
            const outerBase = ((Number(this.width) || 24) * 0.18) + 3.8;
            const outer = isInfantryMarker
                ? Math.max(6.8, Math.min(12.4, outerBase + 1.2))
                : (isArmoredMarker
                    ? Math.max(7.2, Math.min(13.2, outerBase + 1.4))
                    : Math.max(5.6, Math.min(11.5, outerBase)));
            const inner = outer * 0.5;

            ctx.save();
            ctx.shadowColor = 'rgba(250, 204, 21, 0.55)';
            ctx.shadowBlur = 6;
            ctx.beginPath();
            for (let p = 0; p < 10; p++) {
                const angle = (-Math.PI / 2) + (p * Math.PI / 5);
                const r = (p % 2 === 0) ? outer : inner;
                const sx = cx + Math.cos(angle) * r;
                const sy = cy + Math.sin(angle) * r;
                if (p === 0) ctx.moveTo(sx, sy);
                else ctx.lineTo(sx, sy);
            }
            ctx.closePath();
            ctx.fillStyle = '#facc15';
            ctx.fill();
            ctx.strokeStyle = '#7c2d12';
            ctx.lineWidth = 1.2;
            ctx.stroke();
            ctx.restore();
        };
        const crashVisualState = (this.crashState && this.stats && this.stats.type === 'air')
            ? this.crashState
            : null;
        const applyCrashVisualTransform = () => {
            if (!crashVisualState) return;
            const vx = Number(crashVisualState.vx) || 0;
            const vy = Number(crashVisualState.vy) || 0;
            const dir = (Math.abs(vx) > 0.03)
                ? (vx >= 0 ? 1 : -1)
                : ((Number(this.facing) || 1) >= 0 ? 1 : -1);
            const noseDown = Math.min(1.05, Math.max(0.24, 0.2 + (Math.max(0, vy) * 0.07)));
            let tilt = Number(crashVisualState.rollVisual);
            if (!Number.isFinite(tilt)) tilt = noseDown * dir;
            tilt = Math.max(-1.2, Math.min(1.2, tilt));
            ctx.rotate(tilt);

            // Slight squash while falling to make impact trajectory readable.
            const squashY = Math.max(0.74, 1 - Math.min(0.24, Math.max(0, vy) * 0.03));
            ctx.scale(1, squashY);
        };
        const drawCrashDamageOverlay = () => {
            if (!crashVisualState) return;
            const burn = Math.min(0.68, 0.2 + Math.max(0, Number(crashVisualState.burnLevel) || 0.2));
            const w = Math.max(58, Number(this.width) || 58);
            const h = Math.max(30, Number(this.height) || 30);
            const ember = 0.35 + Math.sin((Number(this.rotorAngle) || 0) * 0.8) * 0.15;
            ctx.save();
            // Avoid source-atop on the shared world canvas: it can tint the background as a black rectangle.
            // Draw compact burn marks directly on/near the fuselage instead.
            ctx.globalAlpha = Math.min(0.95, 0.35 + burn * 0.75);
            ctx.fillStyle = `rgba(36, 16, 10, ${Math.min(0.7, 0.22 + burn * 0.78)})`;
            ctx.beginPath();
            ctx.ellipse(-w * 0.08, -h * 0.18, w * 0.34, h * 0.22, -0.12, 0, Math.PI * 2);
            ctx.ellipse(w * 0.2, -h * 0.06, w * 0.24, h * 0.17, 0.18, 0, Math.PI * 2);
            ctx.fill();

            ctx.globalAlpha = Math.min(0.75, 0.2 + burn * 0.5);
            ctx.strokeStyle = 'rgba(248, 113, 38, 0.7)';
            ctx.lineWidth = Math.max(1, w * 0.018);
            ctx.beginPath();
            ctx.moveTo(-w * 0.18, -h * 0.3);
            ctx.lineTo(-w * 0.03, -h * 0.12);
            ctx.lineTo(w * 0.1, -h * 0.2);
            ctx.moveTo(w * 0.03, -h * 0.02);
            ctx.lineTo(w * 0.16, h * 0.08);
            ctx.stroke();

            ctx.globalAlpha = Math.min(0.65, 0.18 + burn * 0.45);
            ctx.fillStyle = `rgba(255, 144, 66, ${Math.min(0.6, ember)})`;
            ctx.beginPath();
            ctx.arc(w * 0.03, -h * 0.1, Math.max(1.2, w * 0.03), 0, Math.PI * 2);
            ctx.arc(-w * 0.11, -h * 0.04, Math.max(1, w * 0.022), 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
        };
        ctx.save();
        ctx.translate(this.x, renderY + snapDy);
        applyCrashVisualTransform();
        const ARMORED_RENDER_BOOST = {
            humvee: 1.18,
            apc: 1.16,
            mbt: 1.16,
            spg: 1.16,
            aa_tank: 1.12,
            icbm: 1.16
        };
        const armoredBoost = Number(ARMORED_RENDER_BOOST[id]) || 1;
        const baseRenderScale = 1.4;
        const isAirVisual = !!(this.stats && this.stats.type === 'air');
        const airRenderScale = isAirVisual ? AIR_RENDER_SCALE_MULTIPLIER : 1;
        ctx.scale(
            baseRenderScale * armoredBoost * airRenderScale,
            baseRenderScale * armoredBoost * airRenderScale
        );  // [C-01] armored visual size boost + air size tune

        // ... (?꾩닠 ?쒕줎 ?쎌삩 諛뺤뒪 肄붾뱶??洹몃?濡??좎?) ...
        if (id === 'tactical_drone' && this.lockedTarget && !this.lockedTarget.dead) {
            ctx.save();
            ctx.translate(-this.x, -renderY);
            const tx = this.lockedTarget.x;
            const targetRenderY = (typeof this.lockedTarget.getRenderY === 'function')
                ? Number(this.lockedTarget.getRenderY())
                : Number(this.lockedTarget.y);
            const tyBase = Number.isFinite(targetRenderY) ? targetRenderY : Number(this.lockedTarget.y || 0);
            const ty = tyBase - (this.lockedTarget.height ? this.lockedTarget.height / 2 : 0);
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
        const useV2Armor = (id === 'mbt' || id === 'spg' || id === 'humvee' || id === 'apc' || id === 'aa_tank');
        const recoilX = (this.recoil || 0) * -facing;
        // Player armored V2 (MBT/SPG) already applies barrel-only recoil in renderer.
        if (!useV2Armor && recoilX) ctx.translate(recoilX, 0);

        // Chinook must always use V2 renderer to avoid legacy/custom skin mast-dot artifacts.
        const allowSkinRender = (id !== 'chinook');
        const renderedWithSkin = (allowSkinRender
            && typeof UnitRenderUtils !== 'undefined'
            && UnitRenderUtils.renderSkinLayers)
            ? UnitRenderUtils.renderSkinLayers(this, ctx, skin)
            : false;
        if (renderedWithSkin) {
            drawCrashDamageOverlay();
            ctx.restore();
            drawSelectionMarker();
            drawHpBar();
            return;
        }

        const legacyDisabledInfantryIds = new Set([
            'infantry',
            'sniper',
            'special_ops',
            'special_forces',
            'engineer',
            'rpg',
            'drone_operator'
        ]);

        // Unit Render V2: armored + infantry line expansion (sniper/special ops included).
        if ((id === 'mbt'
            || id === 'spg'
            || id === 'humvee'
            || id === 'apc'
            || id === 'aa_tank'
            || id === 'infantry'
            || id === 'sniper'
            || id === 'special_ops'
            || id === 'special_forces'
            || id === 'engineer'
            || id === 'rpg'
            || id === 'drone_operator'
            || id === 'fighter'
            || id === 'bomber'
            || id === 'apache'
            || id === 'blackhawk'
            || id === 'uh60'
            || id === 'chinook')
            && typeof UnitRenderV2 !== 'undefined' && UnitRenderV2 && typeof UnitRenderV2.draw === 'function') {
            let renderedWithV2 = false;
            try {
                renderedWithV2 = UnitRenderV2.draw(this, ctx, {
                    mode: 'battle',
                    team: this.team
                }) === true;
            } catch (_) { }
            if (renderedWithV2) {
                drawCrashDamageOverlay();
                ctx.restore();
                drawSelectionMarker();
                drawHpBar();
                return;
            }
        }
        if (legacyDisabledInfantryIds.has(id)) {
            // Do not fallback to legacy infantry renderer (prevents 1-frame old-style pop on death).
            ctx.restore();
            drawSelectionMarker();
            drawHpBar();
            return;
        }

        // [R 4.2 FIX v3] facing은 update()에서 확정됨 - draw()에서는 단순 적용만
        if (id !== 'drone_at') {
            ctx.scale(this.facing || 1, 1);
        }
        const colorExceptions = ['blackhawk', 'chinook'];
        if (colorExceptions.includes(this.stats.id)) {
            ctx.fillStyle = this.stats.color;
        } else {
            ctx.fillStyle = getTeamColor(this.team);
        }

        // [湲곗〈 ?좊떅 洹몃━湲?肄붾뱶 ?좎?, 釉붾옓?명겕/移섎늻?щ쭔 ?섏젙]
        // [NEW] Worker 유닛 렌더링
        if (id === 'worker') {
            const teamColor = getTeamColor(this.team);

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
        else if (id === 'bagpiper') {
            const teamPrimary = getTeamColor(this.team, 'primary');
            const teamDark = getTeamColor(this.team, 'dark');
            const teamSoft = getTeamColor(this.team, 'soft');
            const teamLight = getTeamColor(this.team, 'light');
            const active = this.bagpipeActive === true;
            const frameNow = (typeof game !== 'undefined' && Number.isFinite(game.frame)) ? game.frame : 0;
            const pulse = 0.5 + (Math.sin(frameNow * 0.14) * 0.25);

            // Legs and boots
            ctx.fillStyle = '#1f2937';
            ctx.fillRect(-5, -8, 3, 8);
            ctx.fillRect(2, -8, 3, 8);
            ctx.fillStyle = '#0f172a';
            ctx.fillRect(-6, -1, 4, 2);
            ctx.fillRect(2, -1, 4, 2);

            // Body + tactical vest
            ctx.fillStyle = teamPrimary;
            ctx.fillRect(-6, -20, 12, 18);
            ctx.fillStyle = teamDark;
            ctx.fillRect(-7, -19, 14, 11);
            ctx.fillStyle = teamLight;
            ctx.fillRect(-6, -14, 12, 2);

            // Kilt (team-soft plaid feel)
            ctx.fillStyle = teamSoft;
            ctx.fillRect(-6, -9, 12, 7);
            ctx.fillStyle = teamDark;
            ctx.fillRect(-4, -9, 1, 7);
            ctx.fillRect(-1, -9, 1, 7);
            ctx.fillRect(2, -9, 1, 7);

            ctx.fillStyle = '#ffdbac';
            ctx.beginPath();
            ctx.arc(0, -24, 5, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = teamDark;
            ctx.beginPath();
            ctx.arc(0, -25, 6, Math.PI, 0);
            ctx.fill();
            ctx.fillStyle = '#111827';
            ctx.fillRect(-6, -25, 12, 2);

            // Bag
            ctx.fillStyle = active ? '#be123c' : '#9f1239';
            ctx.beginPath();
            ctx.ellipse(-2, -13, 8, 6, Math.PI / 8, 0, Math.PI * 2);
            ctx.fill();
            ctx.strokeStyle = '#701a75';
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(-8, -15);
            ctx.lineTo(2, -10);
            ctx.moveTo(-7, -10);
            ctx.lineTo(3, -15);
            ctx.stroke();

            // Pipes
            ctx.strokeStyle = '#111827';
            ctx.lineWidth = 2;
            ctx.lineCap = 'round';
            ctx.beginPath();
            ctx.moveTo(-4, -19); ctx.lineTo(-10, -37);
            ctx.moveTo(0, -19); ctx.lineTo(-3, -35);
            ctx.moveTo(3, -18); ctx.lineTo(4, -31);
            ctx.stroke();

            ctx.strokeStyle = '#111827';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(1, -11);
            ctx.lineTo(12, -2);
            ctx.stroke();
            ctx.fillStyle = '#334155';
            ctx.fillRect(-11, -38, 2, 3);
            ctx.fillRect(-4, -36, 2, 3);
            ctx.fillRect(3, -32, 2, 3);
            ctx.fillRect(11, -3, 2, 3);

            // Hands
            ctx.fillStyle = '#ffdbac';
            ctx.fillRect(-8, -12, 3, 3);
            ctx.fillRect(4, -14, 3, 3);

            if (active) {
                ctx.save();
                ctx.globalAlpha = Math.max(0.2, Math.min(0.9, pulse));
                ctx.fillStyle = '#facc15';
                ctx.beginPath();
                ctx.arc(10, -16, 1.8, 0, Math.PI * 2);
                ctx.fill();
                ctx.beginPath();
                ctx.arc(14, -21, 1.6, 0, Math.PI * 2);
                ctx.fill();
                ctx.fillRect(11, -24, 1.2, 7);
                ctx.fillRect(15, -28, 1.2, 7);
                ctx.restore();
            }
        }
        else if (id === 'infantry') { ctx.fillRect(-6, -20, 12, 20); ctx.beginPath(); ctx.arc(0, -24, 5, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = '#1e293b'; ctx.fillRect(2, -18, 10, 3); }
        else if (id === 'sniper') {
            const teamColor = getTeamColor(this.team);
            ctx.fillStyle = teamColor; ctx.fillRect(-6, -20, 12, 20);
            ctx.fillStyle = '#475569'; ctx.fillRect(-8, -19, 16, 12);
            ctx.fillStyle = teamColor; ctx.beginPath(); ctx.arc(0, -24, 5, 0, Math.PI * 2); ctx.fill();
            ctx.fillStyle = '#334155'; ctx.beginPath(); ctx.arc(0, -26, 6, Math.PI, 0); ctx.fill(); ctx.fillRect(-8, -26, 16, 2);
            ctx.fillStyle = '#0f172a'; ctx.fillRect(0, -19, 26, 3);
            ctx.fillRect(10, -22, 8, 3);
            ctx.fillStyle = '#64748b'; ctx.fillRect(16, -21, 2, 2);
        }
        else if (id === 'special_ops') {
            const teamColor = getTeamColor(this.team);
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
            const teamColor = getTeamColor(this.team);
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
        else if (id === 'humvee') {
            const teamColor = getTeamColor(this.team);
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
            const teamColor = getTeamColor(this.team);
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
            const teamColor = getTeamColor(this.team);
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
            const flags = getFeatureFlagsSnapshot();
            const useIcbmTeamColorFix = isFeatureFlagEnabled('icbmTeamColorFix', flags);
            const isEnemyIcbm = (this.team === 'enemy' || id === 'icbm_enemy');
            const paletteTeam = (id === 'icbm_enemy')
                ? 'enemy'
                : ((id === 'icbm') ? 'player' : (isEnemyIcbm ? 'enemy' : 'player'));
            const icbmPalette = useIcbmTeamColorFix
                ? {
                    hullMain: getTeamColor(paletteTeam, 'primary'),
                    hullPanel: getTeamColor(paletteTeam, 'dark'),
                    cab: getTeamColor(paletteTeam, 'soft'),
                    window: 'rgba(59, 77, 89, 0.85)',
                    windowFrame: '#1e293b',
                    canister: getTeamColor(paletteTeam, 'dark'),
                    canisterRib: getTeamColor(paletteTeam, 'hp'),
                    cap: getTeamColor(paletteTeam, 'dark'),
                    support: '#2f3a2b',
                    mark: getTeamColor(paletteTeam, 'light')
                }
                : (isEnemyIcbm
                    ? {
                        hullMain: '#8b7a5a',
                        hullPanel: '#6f5f45',
                        cab: '#7a6a4f',
                        window: 'rgba(92, 84, 70, 0.86)',
                        windowFrame: '#4b3f2f',
                        canister: '#7a6b52',
                        canisterRib: '#5f523f',
                        cap: '#665944',
                        support: '#4a3f30',
                        mark: '#5a4630'
                    }
                    : {
                        hullMain: '#4E5B31',
                        hullPanel: '#3D4825',
                        cab: '#425239',
                        window: 'rgba(59, 77, 89, 0.85)',
                        windowFrame: '#2C3519',
                        canister: '#4A5D23',
                        canisterRib: '#324016',
                        cap: '#3D4825',
                        support: '#2C3519',
                        mark: '#3f2f1d'
                    });
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

            ctx.fillStyle = icbmPalette.hullMain;
            ctx.fillRect(0, 15, TEL_WIDTH - 10, TEL_HEIGHT - 15);
            ctx.fillStyle = icbmPalette.hullPanel;
            ctx.fillRect(100, 20, 40, 25);
            ctx.fillRect(290, 20, 40, 25);
            ctx.fillStyle = '#111';
            ctx.fillRect(90, 35, 15, 25);
            ctx.fillRect(280, 35, 15, 25);

            ctx.fillStyle = icbmPalette.cab;
            ctx.beginPath();
            ctx.moveTo(0, 50);
            ctx.lineTo(-20, 50);
            ctx.lineTo(-20, 10);
            ctx.lineTo(0, 0);
            ctx.lineTo(70, 0);
            ctx.lineTo(70, 50);
            ctx.closePath();
            ctx.fill();
            ctx.fillStyle = icbmPalette.window;
            ctx.fillRect(-15, 10, 15, 15);
            ctx.fillRect(5, 10, 25, 15);
            ctx.strokeStyle = icbmPalette.windowFrame;
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

            ctx.fillStyle = icbmPalette.canister;
            ctx.fillRect(-canLength, -canThick / 2, canLength + 20, canThick);
            ctx.fillStyle = icbmPalette.canisterRib;
            for (let i = 1; i < 5; i++) {
                ctx.fillRect(-canLength + (i * 45), -canThick / 2, 10, canThick);
            }

            if (!capOpen) {
                ctx.fillStyle = icbmPalette.cap;
                ctx.beginPath();
                ctx.arc(-canLength, 0, canThick / 2 + 2, Math.PI * 0.5, Math.PI * 1.5);
                ctx.fill();
            }

            ctx.fillStyle = icbmPalette.support;
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

            ctx.fillStyle = icbmPalette.mark;
            ctx.fillRect(120, 15, 54, 4);
            ctx.restore();
        }
        else if (id === 'apache') {
            const teamColor = getTeamColor(this.team);
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
            const teamColor = getTeamColor(this.team);

            // 스케일 축소 (과대 사이즈 조정)
            ctx.save();
            ctx.scale(1.6, 1.6);

            // 테일 로터 배경
            ctx.fillStyle = '#1e293b'; ctx.fillRect(-45, -5, 30, 6);

            // 테일 로터: 회전 원형 느낌 제거 + 형상 유지(고정 블레이드)
            ctx.save(); ctx.translate(-45, -5);
            ctx.fillStyle = '#000';
            ctx.fillRect(-1.4, -9, 2.8, 18);
            ctx.fillRect(-7, -1.2, 14, 2.4);
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
            const teamColor = getTeamColor(this.team);
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
            const teamColor = getTeamColor(this.team);
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
            const teamColor = getTeamColor(this.team);
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
            const teamColor = getTeamColor(this.team);
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
            const teamColor = getTeamColor(this.team);
            // 스케일 다운
            ctx.save();
            const baseScale = 0.48;
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
            const teamColor = getTeamColor(this.team);
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
        else if (id === 'tactical_drone') { const bc = getTeamColor(this.team); ctx.fillStyle = bc; ctx.beginPath(); ctx.moveTo(10, 0); ctx.lineTo(-5, 6); ctx.lineTo(-2, 0); ctx.lineTo(-5, -6); ctx.fill(); }
        else if (id === 'emp') { ctx.strokeStyle = '#3b82f6'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(0, 0, 15, 0, Math.PI * 2); ctx.stroke(); ctx.fillStyle = '#3b82f6'; ctx.beginPath(); ctx.moveTo(-5, -8); ctx.lineTo(8, -2); ctx.lineTo(-2, 2); ctx.lineTo(6, 10); ctx.lineTo(-8, 4); ctx.lineTo(2, 0); ctx.fill(); }
        else if (id === 'nuke') { ctx.fillStyle = '#ef4444'; ctx.beginPath(); ctx.arc(0, 0, 15, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = '#000'; ctx.beginPath(); ctx.moveTo(0, 0); ctx.arc(0, 0, 12, 0, Math.PI / 3); ctx.lineTo(0, 0); ctx.moveTo(0, 0); ctx.arc(0, 0, 12, 2 * Math.PI / 3, Math.PI); ctx.lineTo(0, 0); ctx.moveTo(0, 0); ctx.arc(0, 0, 12, 4 * Math.PI / 3, 5 * Math.PI / 3); ctx.lineTo(0, 0); ctx.fill(); ctx.fillStyle = '#facc15'; ctx.beginPath(); ctx.arc(0, 0, 4, 0, Math.PI * 2); ctx.fill(); }
        else if (id === 'tactical_missile') { ctx.fillStyle = '#e5e7eb'; ctx.fillRect(-12, -3, 24, 6); ctx.fillStyle = '#ef4444'; ctx.beginPath(); ctx.moveTo(12, -3); ctx.lineTo(18, 0); ctx.lineTo(12, 3); ctx.fill(); ctx.fillStyle = '#f59e0b'; ctx.beginPath(); ctx.arc(-12, 0, 4, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = '#475569'; ctx.beginPath(); ctx.moveTo(-8, -3); ctx.lineTo(-12, -8); ctx.lineTo(-12, -3); ctx.fill(); ctx.beginPath(); ctx.moveTo(-8, 3); ctx.lineTo(-12, 8); ctx.lineTo(-12, 3); ctx.fill(); }
        else if (id === 'stealth_drone') { const bc = getTeamColor(this.team); ctx.fillStyle = bc; ctx.beginPath(); ctx.moveTo(14, 0); ctx.lineTo(-10, 9); ctx.lineTo(-4, 0); ctx.lineTo(-10, -9); ctx.closePath(); ctx.fill(); ctx.fillStyle = '#0f172a'; ctx.beginPath(); ctx.ellipse(1, 0, 3.5, 2.2, 0, 0, Math.PI * 2); ctx.fill(); if (this.team === 'player' && this.targetX !== null && this.targetX !== undefined && !this.exploded) { const gx = (game && game.groundY) ? game.groundY : this.y; const tx = this.targetX; const ty = gx - 8; const dd = Math.hypot(this.x - tx, this.y - ty); if (dd > 70) { ctx.save(); ctx.translate(-this.x + tx, -this.y + ty); ctx.strokeStyle = '#ff2d2d'; ctx.lineWidth = 2; const s = 7; ctx.beginPath(); ctx.moveTo(-s, 0); ctx.lineTo(s, 0); ctx.moveTo(0, -s); ctx.lineTo(0, s); ctx.stroke(); ctx.restore(); } } }
        else if (id === 'bomber') {
            const teamColor = getTeamColor(this.team);

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
            const teamColor = getTeamColor(this.team);
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

        drawCrashDamageOverlay();
        ctx.restore();
        drawSelectionMarker();
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
        this.isArmored = this._isArmoredWreck();
        this.maxLife = this.isArmored ? 240 : 540; // 기갑 잔해는 더 짧게 유지
        this.fadeStartRatio = this.isArmored ? 0.45 : 0.7;
        this.smokeInterval = this.isArmored ? 85 : 40;
        this.smokeParticleCount = this.isArmored ? 1 : 2;
        this.age = 0;
        this.smokeTimer = 0;
        this.tilt = (Math.random() - 0.5) * 0.1; // 약간의 기울어짐
    }

    _isMobileSimpleMode() {
        return !!(typeof game !== 'undefined' && game && game.mobileViewportActive === true);
    }

    _getLifeConfig() {
        const mobileSimple = this._isMobileSimpleMode();
        if (this.isArmored) {
            if (mobileSimple) {
                return {
                    maxLife: 150,
                    fadeStartRatio: 0.3,
                    smokeInterval: 120,
                    smokeParticleCount: 0,
                    smokeLifeGate: 0.75
                };
            }
            return {
                maxLife: 240,
                fadeStartRatio: 0.45,
                smokeInterval: 85,
                smokeParticleCount: 1,
                smokeLifeGate: 0.5
            };
        }
        return {
            maxLife: 540,
            fadeStartRatio: 0.7,
            smokeInterval: 40,
            smokeParticleCount: 2,
            smokeLifeGate: 0.3
        };
    }

    update() {
        this.age++;
        const cfg = this._getLifeConfig();
        this.maxLife = cfg.maxLife;
        this.fadeStartRatio = cfg.fadeStartRatio;
        this.smokeInterval = cfg.smokeInterval;
        this.smokeParticleCount = cfg.smokeParticleCount;
        // 설정 비율 지점부터 fade out 시작
        const fadeStart = Math.max(1, this.maxLife * this.fadeStartRatio);
        const fadeSpan = Math.max(1, this.maxLife - fadeStart);
        if (this.age > fadeStart) {
            this.life = 1 - (this.age - fadeStart) / fadeSpan;
        }
        if (this.age >= this.maxLife) this.life = 0;
        if (this.life <= 0) this.life = 0;

        // 간헐적 연기 이펙트 (기갑은 횟수/강도 축소)
        this.smokeTimer++;
        const smokeLifeGate = cfg.smokeLifeGate;
        if (this.smokeTimer >= this.smokeInterval && this.life > smokeLifeGate) {
            this.smokeTimer = 0;
            if (typeof game !== 'undefined' && game.createParticles) {
                if (this.smokeParticleCount > 0 && (!this.isArmored || Math.random() < 0.5)) {
                    game.createParticles(
                        this.x + (Math.random() - 0.5) * 20,
                        this.y - 15,
                        this.smokeParticleCount,
                        '#333'
                    );
                }
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

        // Armored-only: do not use legacy wreck sprite/debris references.
        if (this.isArmored) {
            if (this._isMobileSimpleMode()) {
                this._drawArmoredMobileSimpleWreck(ctx);
                ctx.restore();
                return;
            }
            this._drawArmoredLiteWreck(ctx);
            ctx.restore();
            return;
        }

        // Non-armored wreck rendering keeps legacy path for now.
        if (typeof IngameRenderer !== 'undefined' && IngameRenderer.drawWreck) {
            IngameRenderer.drawWreck(ctx, this.unitId, {
                team: this.team,
                facing: 1  // facing is already applied by scale
            });
        } else {
            this._drawFallback(ctx);
        }

        ctx.restore();
    }

    _isArmoredWreck() {
        const id = String(this.unitId || '').trim().toLowerCase();
        return ['mbt', 'apc', 'aa_tank', 'humvee', 'spg', 'tank', 'ifv', 'sam', 'mlrs'].includes(id);
    }

    _normalizeArmoredRenderId(id) {
        const key = String(id || '').trim().toLowerCase();
        if (key === 'tank') return 'mbt';
        if (key === 'ifv') return 'apc';
        if (key === 'sam' || key === 'mlrs') return 'aa_tank';
        return key;
    }

    _drawArmoredFallbackSilhouette(ctx, id) {
        const sizeById = {
            humvee: { w: 30, h: 11, turret: false },
            apc: { w: 36, h: 12, turret: true },
            mbt: { w: 40, h: 13, turret: true },
            spg: { w: 39, h: 12, turret: true },
            aa_tank: { w: 37, h: 12, turret: true }
        };
        const s = sizeById[id] || { w: 35, h: 12, turret: true };

        ctx.save();
        ctx.rotate(-0.06);
        ctx.fillStyle = '#3c3f45';
        ctx.fillRect(-(s.w * 0.5), -(s.h * 0.5), s.w, s.h);
        ctx.fillStyle = '#272b32';
        ctx.fillRect(-(s.w * 0.5), -(s.h * 0.5), s.w, Math.max(3, s.h * 0.3));
        if (s.turret) {
            ctx.fillStyle = '#4d525b';
            ctx.fillRect(-(s.w * 0.14), -(s.h * 0.75), s.w * 0.28, s.h * 0.34);
            ctx.fillStyle = '#252a31';
            ctx.fillRect((s.w * 0.14), -(s.h * 0.72), s.w * 0.26, s.h * 0.08);
        }
        ctx.fillStyle = '#111827';
        ctx.fillRect(-(s.w * 0.45), (s.h * 0.24), s.w * 0.16, Math.max(2, s.h * 0.12));
        ctx.fillRect((s.w * 0.28), (s.h * 0.24), s.w * 0.17, Math.max(2, s.h * 0.12));
        ctx.restore();
    }

    _drawArmoredMobileSimpleWreck(ctx) {
        const life = Math.max(0, Math.min(1, this.life));
        ctx.save();
        ctx.globalAlpha = Math.min(0.95, 0.9 * life);

        // Ground shadow
        ctx.fillStyle = 'rgba(0,0,0,0.55)';
        ctx.beginPath();
        ctx.ellipse(0, 6, 19, 9, 0, 0, Math.PI * 2);
        ctx.fill();

        // Very simple wreck body (no detailed armored renderer on mobile)
        ctx.rotate(-0.04);
        ctx.fillStyle = '#30343a';
        ctx.fillRect(-18, -8, 36, 13);
        ctx.fillStyle = '#1e2228';
        ctx.fillRect(-18, -8, 36, 4);
        ctx.fillStyle = '#0f172a';
        ctx.fillRect(-15, 2, 7, 2);
        ctx.fillRect(8, 2, 7, 2);
        ctx.restore();
    }

    _drawArmoredLiteWreck(ctx) {
        const id = this._normalizeArmoredRenderId(this.unitId);
        const life = Math.max(0, Math.min(1, this.life));
        const t = (Math.max(0, Number(this.age) || 0) * 0.11);
        const overlaySize = {
            humvee: { w: 22, h: 12 },
            apc: { w: 25, h: 13 },
            mbt: { w: 27, h: 14 },
            spg: { w: 26, h: 13 },
            aa_tank: { w: 25, h: 13 }
        };
        const s = overlaySize[id] || { w: 24, h: 10 };

        ctx.save();
        ctx.translate(0, -2);
        ctx.globalAlpha = 0.34 * life;
        ctx.fillStyle = 'rgba(0,0,0,0.75)';
        ctx.beginPath();
        ctx.ellipse(0, 7, s.w * 1.45, s.h * 0.9, 0, 0, Math.PI * 2);
        ctx.fill();

        ctx.globalAlpha = Math.max(0.08, 0.2 * life);
        ctx.fillStyle = 'rgba(28,28,28,0.85)';
        ctx.beginPath();
        ctx.ellipse((Math.sin(t * 0.7) * 2), -11, s.w * 0.46, s.h * 0.4, 0, 0, Math.PI * 2);
        ctx.fill();

        this._drawArmoredFallbackSilhouette(ctx, id);

        ctx.globalAlpha = 0.48 * life;
        ctx.fillStyle = 'rgba(0,0,0,0.55)';
        ctx.beginPath();
        ctx.ellipse(-(s.w * 0.36), -3, s.w * 0.36, s.h * 0.28, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.ellipse((s.w * 0.28), -1, s.w * 0.28, s.h * 0.22, 0, 0, Math.PI * 2);
        ctx.fill();

        ctx.globalAlpha = Math.max(0.05, 0.12 * life);
        ctx.fillStyle = 'rgba(239,68,68,0.92)';
        ctx.beginPath();
        ctx.ellipse((s.w * 0.3), -5, s.w * 0.22, s.h * 0.18, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    }

    _drawArmoredRerenderWreck(ctx) {
        const id = this._normalizeArmoredRenderId(this.unitId);
        const life = Math.max(0, Math.min(1, this.life));
        const t = (Math.max(0, Number(this.age) || 0) * 0.09);
        const emberPulse = 0.45 + (Math.sin(t) * 0.25);
        const glow = Math.max(0.06, (0.18 * life * emberPulse));
        const overlaySize = {
            humvee: { w: 22, h: 12 },
            apc: { w: 25, h: 13 },
            mbt: { w: 27, h: 14 },
            spg: { w: 26, h: 13 },
            aa_tank: { w: 25, h: 13 }
        };
        const s = overlaySize[id] || { w: 24, h: 10 };
        const armoredBoostById = {
            humvee: 1.18,
            apc: 1.16,
            mbt: 1.16,
            spg: 1.16,
            aa_tank: 1.12
        };

        ctx.save();
        ctx.translate(0, -3);

        // Scorch and minimal smoke.
        ctx.globalAlpha = 0.38 * life;
        ctx.fillStyle = 'rgba(0,0,0,0.78)';
        ctx.beginPath();
        ctx.ellipse(0, 7, s.w * 1.55, s.h * 0.95, 0, 0, Math.PI * 2);
        ctx.fill();

        ctx.globalAlpha = Math.max(0.08, 0.22 * life);
        ctx.fillStyle = 'rgba(30,30,30,0.85)';
        ctx.beginPath();
        ctx.ellipse((Math.sin(t * 0.6) * 2.5), -13, s.w * 0.50, s.h * 0.45, 0, 0, Math.PI * 2);
        ctx.fill();

        // Main wreck silhouette: rerender armored body with burn filter.
        let rendered = false;
        if (typeof UnitRenderV2 !== 'undefined' && UnitRenderV2 && typeof UnitRenderV2.draw === 'function') {
            const boost = Number(armoredBoostById[id]) || 1.14;
            const bodyAlpha = Math.max(0, Math.min(1, 0.82 * life));
            const dummyUnit = {
                x: 0,
                y: 0,
                vx: 0,
                facing: 1,
                team: this.team,
                stats: {
                    id: id,
                    category: 'armored',
                    type: 'mech',
                    speed: 0.8,
                    range: 320
                },
                hp: 1,
                maxHp: 100,
                dead: false,
                commandMode: 'stop',
                attackTarget: null,
                lastAttack: -9999,
                lastDamagedFrame: -9999,
                recoil: 0,
                missileFlash: 0,
                _renderV2State: {}
            };
            ctx.globalAlpha = bodyAlpha;
            ctx.save();
            ctx.rotate(-0.035 + (Math.sin(t * 0.35) * 0.015));
            ctx.scale(1.4 * boost * 0.95, 1.4 * boost * 0.97);
            if ('filter' in ctx) {
                ctx.filter = 'saturate(0.20) brightness(0.43) contrast(0.92)';
            }
            try {
                rendered = UnitRenderV2.draw(dummyUnit, ctx, { mode: 'battle', team: this.team }) === true;
            } catch (_) {
                rendered = false;
            }
            ctx.restore();
        }
        if (!rendered) {
            this._drawArmoredFallbackSilhouette(ctx, id);
        }

        // Burn overlay and broken marks.
        ctx.save();
        ctx.globalCompositeOperation = 'multiply';
        ctx.globalAlpha = 0.22 * life;
        ctx.fillStyle = 'rgba(20,20,20,0.92)';
        ctx.beginPath();
        ctx.ellipse(-2, -4, s.w * 0.78, s.h * 0.54, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();

        ctx.globalAlpha = 0.56 * life;
        ctx.fillStyle = 'rgba(0,0,0,0.55)';
        ctx.beginPath();
        ctx.ellipse(-(s.w * 0.42), -4, s.w * 0.42, s.h * 0.36, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.ellipse((s.w * 0.32), -1, s.w * 0.32, s.h * 0.26, 0, 0, Math.PI * 2);
        ctx.fill();

        // Broken wheel/track hints.
        ctx.fillStyle = '#0b1220';
        ctx.fillRect(-(s.w * 1.18), 2, s.w * 0.36, Math.max(2, s.h * 0.18));
        ctx.fillRect((s.w * 0.76), 2, s.w * 0.38, Math.max(2, s.h * 0.18));

        // Hot ember.
        ctx.globalAlpha = glow;
        ctx.fillStyle = 'rgba(239, 68, 68, 0.95)';
        ctx.beginPath();
        ctx.ellipse((s.w * 0.35), -6, s.w * 0.30, s.h * 0.22, 0, 0, Math.PI * 2);
        ctx.fill();

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
