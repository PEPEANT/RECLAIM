// [RULE] 신규 기능 로직은 game.js에 직접 추가하지 말고 src/* 모듈로 분리 후 연결 (docs/engineering/CODE_ORGANIZATION_RULES.md 참고).
// [RULE] 인게임 안내/상태/채팅 메시지는 UI 토스트 금지. ChatPanel.push()로만 출력.
const LOGICAL_HEIGHT = 720;

function countAliveUnits(arr) {
    let alive = 0;
    for (let i = 0; i < arr.length; i++) {
        const u = arr[i];
        if (u && !u.dead) alive++;
    }
    return alive;
}

function hasPositiveValue(obj) {
    if (!obj || typeof obj !== 'object') return false;
    for (const k in obj) {
        if (Object.prototype.hasOwnProperty.call(obj, k) && obj[k] > 0) return true;
    }
    return false;
}

const CAMPAIGN_OCCUPATION_STAGES = window.CAMPAIGN_OCCUPATION_STAGES || [];


const CAMPAIGN_SKIRMISH_STAGES = window.CAMPAIGN_SKIRMISH_STAGES || [];

const MAP_SELECT_BGM_FILE = 'bgm/ost/dunebuggydubai01.mp3';

// 퀘스트 미션 로직은 src/modes/city-sim/quest-mission/* 로 분리됨.

// 하위 호환용
const CAMPAIGN_STAGE_TEMPLATE = CAMPAIGN_OCCUPATION_STAGES;

const game = {
    canvas: document.getElementById('game-canvas'),
    ctx: null, width: 0, height: 0, groundY: 0,
    frame: 0, running: false, cameraX: 0,
    minimapInterval: 8,
    cameraLockActive: false,
    cameraLockTarget: null,

    // [VFX] Screen Shake / Flash (screen-space)
    shake: 0,
    shakeDecay: 0.90,
    flash: 0,
    flashDecay: 0.85,

    addShake(amount) {
        // amount: 대략 0~30
        const a = Math.max(0, Number(amount) || 0);
        this.shake = Math.max(this.shake || 0, a);
    },

    addFlash(amount) {
        // amount: 0~1
        const a = Math.max(0, Math.min(1, Number(amount) || 0));
        this.flash = Math.max(this.flash || 0, a);
    },

    scaleRatio: 1,
    logicalWidth: 1280, // Note: This might be less relevant if we calc width dynamically, but keeping for legacy refs or init
    logicalHeight: LOGICAL_HEIGHT,

    // [NEW] Total War Trigger Flag
    totalWarTriggered: false,

    // [NEW] 프리게임 커스텀 옵션
    settings: {
        includeForwardDefense: false,
        iogAlwaysOpen: false,
    },
    citySim: (typeof CitySimState !== 'undefined' && typeof CitySimState.createInitialState === 'function')
        ? CitySimState.createInitialState()
        : {
            cols: 24,
            rows: 14,
            selectedTool: 'road',
            buildPanelOpen: false,
            loopMs: 2500,
            loopTimer: null,
            res: {
                money: 10000,
                gold: 0,
                pop: 6,
                maxPop: 20
            },
            units: {
                icbm: 0
            },
            grid: [],
            ground: []
        },
    _cityBound: false,
    mapOrder: ['city', 'plain', 'mountain', 'village'],
    clearedMaps: [],
    firstRunDone: false,
    campaignStages: [],
    campaignSelectedStageId: null,
    campaignThreatLevel: 1,
    campaignView: { x: 0, y: 0, scale: 1.2 },
    campaignBriefVisible: false,
    _campaignBattleTab: '',
    activeCampaignStageId: null,
    activeCampaignTab: 'skirmish',
    campaignOccupation: { stages: [], selectedStageId: null, view: { x: 0, y: 0, scale: 1.2 } },
    campaignSkirmish: { stages: [], selectedStageId: null, view: { x: 0, y: 0, scale: 1.2 } },
    cityQuestMission: null,
    _uiRecoverySuspendUntil: 0,
    _uiBlankTicks: 0,
    _resumeAfterVisibilityHidden: false,
    _campaignBound: false,
    _campaignDrag: {
        active: false,
        pointerId: null,
        pointerType: '',
        downOnStageNode: false,
        startX: 0,
        startY: 0,
        originX: 0,
        originY: 0,
        moved: false,
        justDragged: false
    },
    devUnlockAllMaps: false,
    _tempAdminUnlockUid: '',
    _devPPressCount: 0,
    _devLastPPressAt: 0,

    players: [], enemies: [], civilians: [], projectiles: [], particles: [], buildings: [], wreckages: [], corpses: [],
    corpseCap: 30,
    corpseCapEnemyInfantry: 12,
    corpseFadeTimer: 180,         // default corpse lifetime (frames)
    corpseCivilianFadeTimer: 60,  // faster decay for civilians
    corpseCullPadding: 120,       // offscreen cull padding (world-space via zoom)
    corpseReplaceOldest: false,   // true: cap 도달 시 교체, false: 신규 시체 스킵
    corpseSpawnQueue: [],
    corpseSpawnQueueHead: 0,
    corpseSpawnBudget: 4,         // 프레임당 시체 생성 예산 (버스트 완화)
    corpseSpawnQueueLimit: 80,    // 큐 과도 누적 방지
    enemySmokeCap: 2,
    particleCap: 300,
    particleSpawnCap: 60,
    particleCullPadding: 200,
    _particleSpawnFrame: -1,
    _particleSpawnCount: 0,
    // Debug / profiling toggles (set via console)
    debug: {
        disableCorpses: false,          // true: 시체 생성 완전 비활성
        corpseProfile: false,           // true: 시체 렌더링 시간 로그
        corpseProfileEvery: 120,        // N프레임마다 로그
        corpseSimpleRenderThreshold: 20,// 시체 단순 렌더링 전환 임계치
        corpseNoFilter: false           // true: ctx.filter 비활성 (성능 테스트용)
    },

    enqueueCorpseSpawn(data) {
        if (!data) return false;
        if (!Array.isArray(this.corpseSpawnQueue)) this.corpseSpawnQueue = [];
        if (!Number.isFinite(this.corpseSpawnQueueHead)) this.corpseSpawnQueueHead = 0;

        const isInfantryType = (typeKey) => {
            if (!typeKey || typeof CONFIG === 'undefined' || !CONFIG.units) return false;
            const def = CONFIG.units[typeKey];
            return !!(def && def.category === 'infantry');
        };

        const cap = Number.isFinite(this.corpseCap) ? this.corpseCap : 0;
        const pending = this.corpses.length + (this.corpseSpawnQueue.length - this.corpseSpawnQueueHead);
        if (cap > 0 && !this.corpseReplaceOldest && pending >= cap) return false;

        const enemyCap = Number.isFinite(this.corpseCapEnemyInfantry) ? this.corpseCapEnemyInfantry : 0;
        if (enemyCap > 0 && data.team === 'enemy' && isInfantryType(data.typeKey)) {
            let enemyInfCount = 0;
            for (const c of this.corpses) {
                if (c && c.team === 'enemy' && isInfantryType(c.typeKey)) enemyInfCount++;
            }
            for (let i = this.corpseSpawnQueueHead; i < this.corpseSpawnQueue.length; i++) {
                const q = this.corpseSpawnQueue[i];
                if (q && q.team === 'enemy' && isInfantryType(q.typeKey)) enemyInfCount++;
            }
            if (enemyInfCount >= enemyCap) return false;
        }

        const limit = Number.isFinite(this.corpseSpawnQueueLimit) ? this.corpseSpawnQueueLimit : 0;
        if (limit > 0 && (this.corpseSpawnQueue.length - this.corpseSpawnQueueHead) >= limit) return false;

        this.corpseSpawnQueue.push(data);
        return true;
    },

    _processCorpseSpawnQueue() {
        if (typeof Corpse === 'undefined') return;
        if (!Array.isArray(this.corpseSpawnQueue) || this.corpseSpawnQueue.length === 0) return;
        let head = Number.isFinite(this.corpseSpawnQueueHead) ? this.corpseSpawnQueueHead : 0;
        const budget = (Number.isFinite(this.corpseSpawnBudget) && this.corpseSpawnBudget > 0)
            ? this.corpseSpawnBudget
            : 4;
        const cap = Number.isFinite(this.corpseCap) ? this.corpseCap : 0;

        let spawned = 0;
        while (spawned < budget && head < this.corpseSpawnQueue.length) {
            const data = this.corpseSpawnQueue[head++];
            if (!data) continue;

            if (cap > 0 && this.corpses.length >= cap) {
                if (this.corpseReplaceOldest) {
                    this.corpses.shift();
                } else {
                    continue;
                }
            }

            this.corpses.push(new Corpse(
                data.x, data.y, data.typeKey, data.facing, data.team, data.deathInfo
            ));
            spawned++;
        }

        this.corpseSpawnQueueHead = head;
        if (head >= this.corpseSpawnQueue.length) {
            this.corpseSpawnQueue.length = 0;
            this.corpseSpawnQueueHead = 0;
        } else if (head > 64) {
            this.corpseSpawnQueue = this.corpseSpawnQueue.slice(head);
            this.corpseSpawnQueueHead = 0;
        }
    },

    supply: CONFIG.startSupply, enemySupply: CONFIG.startSupply,
    cooldowns: {}, playerStock: {}, enemyStock: {}, enemyCooldowns: {},
    playerVeteransById: {}, playerVeteranStock: {}, playerVeteranOrder: [],
    skillCharges: { emp: 5, nuke: 1, tactical: 5 },
    empTimer: 0, targetingType: null, killCount: 0,
    playerBuildings: [], enemyBuildings: [],
    selectedBuilding: null,
    enemyEverSeen: false,
    playerEverSeen: false,
    civilianDeaths: 0,
    airRaidTriggered: false,
    airRaidBomberTimeout: null,
    civilianEvacActive: false,
    civilianEvacX: null,
    civilianGlobalPanic: 0,
    cityArmorNewsShown: false,
    cityMidNewsShown: false,
    cityTotalWarNewsShown: false,
    cityNukePanicPlayed: false,
    cameramanDisabled: false,

    // ============================================
    // [NEW] 건설 모드 상태
    // ============================================
    buildMode: {
        active: false,
        type: null,           // 건설할 건물 타입 (watchtower)
        previewX: 0,          // 프리뷰 위치 (월드 좌표)
        previewY: 0,
        valid: false,         // 배치 가능 여부
        worker: null,         // 건설 중인 작업자 참조
    },
    builderCooldown: 0,       // 작업자 공용 쿨타임
    watchtowerBuilt: false,   // [3.8] 감시탑 1회 건설 제한 플래그

    // [Queue System]
    spawnQueue: {},
    holdTimer: null, holdKey: null,

    // [Category & Spawn]
    currentCategory: 'infantry',

    // [MOVED] 드론 소유권/상태 관리 함수 → src/units/drone/drone-manager.js
    // [MOVED] 드론 발진/회수 커맨드 함수   → src/units/drone/drone-commands.js

    triggerIcbmSkillFromCommand(skillKey) {
        if (!this.isIcbmSkillKey(skillKey)) return false;
        const inSkirmishButNotBattle = this._skirmishMode && (
            typeof SkirmishMode === 'undefined' ||
            !SkirmishMode.isActive ||
            SkirmishMode.phase !== 'battle'
        );
        if (inSkirmishButNotBattle) {
            if (typeof ChatPanel !== 'undefined') {
                ChatPanel.push('ICBM 스킬은 전투 단계에서만 사용할 수 있습니다.', 'WARN');
            }
            return false;
        }
        if (typeof this.prepareTargeting !== 'function') return false;
        this.prepareTargeting(skillKey);
        return this.targetingType === skillKey;
    },

    _hasMissileCommandInStats(stats) {
        if (!stats || typeof stats !== 'object') return false;
        if (stats.missileCommand === true || stats.canUseMissileCommand === true) return true;

        const singleCmd = (typeof stats.specialCommand === 'string')
            ? stats.specialCommand.trim().toLowerCase()
            : '';
        if (singleCmd === 'missile') return true;

        if (Array.isArray(stats.specialCommands)) {
            for (const cmd of stats.specialCommands) {
                if (String(cmd || '').trim().toLowerCase() === 'missile') return true;
            }
        }

        // Backward compatibility: legacy fighter ids
        const id = (typeof stats.id === 'string') ? stats.id.trim().toLowerCase() : '';
        if (id === 'fighter' || id.includes('fighter')) return true;
        return false;
    },

    unitHasMissileCommand(unit) {
        if (!unit || unit.dead || !unit.stats) return false;
        return this._hasMissileCommandInStats(unit.stats);
    },

    getSelectedMissileUnits(readyOnly = false) {
        if (!this.selectedUnits || this.selectedUnits.size === 0) return [];
        const result = [];
        for (const u of this.selectedUnits) {
            if (!this.unitHasMissileCommand(u)) continue;
            if (readyOnly && (Number(u.missileChargesLeft) || 0) <= 0) continue;
            result.push(u);
        }
        return result;
    },

    isIcbmSkillKey(key) {
        return key === 'nuke' || key === 'tactical_missile' || key === 'emp';
    },

    getIcbmLauncherIdByTeam(team = 'player') {
        return (team === 'enemy') ? 'icbm_enemy' : 'icbm';
    },

    isIcbmLauncherUnit(u, team = null) {
        const id = u && u.stats ? u.stats.id : null;
        if (!id) return false;
        if (team === 'enemy') return id === 'icbm_enemy';
        if (team === 'player') return id === 'icbm';
        return id === 'icbm' || id === 'icbm_enemy';
    },

    getIcbmLaunchers(team = 'player') {
        const list = (team === 'enemy') ? this.enemies : this.players;
        if (!Array.isArray(list) || list.length === 0) return [];
        return list.filter(u => u && !u.dead && this.isIcbmLauncherUnit(u, team));
    },

    getSelectedIcbmLaunchers() {
        if (!this.selectedUnits || this.selectedUnits.size === 0) return [];
        return Array.from(this.selectedUnits).filter(u => u && !u.dead && this.isIcbmLauncherUnit(u, 'player'));
    },

    shouldShowIcbmSkills() {
        return this.getSelectedIcbmLaunchers().length > 0;
    },

    getReadyIcbmLauncher(team = 'player') {
        const isReady = (u) => {
            if (!u || u.dead || !this.isIcbmLauncherUnit(u, team)) return false;
            if (typeof u.isIcbmReady === 'function') return u.isIcbmReady();
            return (u.icbmLaunchState || 'idle') === 'idle' && !u.icbmLaunchRequest;
        };

        if (team === 'player') {
            const selected = this.getSelectedIcbmLaunchers();
            for (let i = 0; i < selected.length; i++) {
                if (isReady(selected[i])) return selected[i];
            }
            return null;
        }

        const launchers = this.getIcbmLaunchers(team);
        for (let i = 0; i < launchers.length; i++) {
            if (isReady(launchers[i])) return launchers[i];
        }
        return null;
    },

    hasReadyIcbmLauncher(team = 'player') {
        return !!this.getReadyIcbmLauncher(team);
    },

    requestIcbmLaunch(team, payloadKey, targetX, targetY, opts = {}) {
        if (!this.isIcbmSkillKey(payloadKey)) return false;

        const skillDef = CONFIG.units[payloadKey];
        const launcher = opts.launcher || this.getReadyIcbmLauncher(team);
        if (!launcher) return false;
        if (typeof launcher.requestIcbmLaunch !== 'function') return false;

        const tx = Math.max(40, Math.min(CONFIG.mapWidth - 40, Number(targetX) || 0));
        const tyRaw = Number.isFinite(Number(targetY)) ? Number(targetY) : this.groundY;
        const ty = Math.min(this.groundY, tyRaw);

        let chargeKey = null;
        if (team === 'player' && !opts.bypassCharge) {
            if (!skillDef || !skillDef.isSkill) return false;
            chargeKey = skillDef.chargeKey;
            if (!chargeKey) return false;
            if ((this.skillCharges[chargeKey] || 0) <= 0) return false;
            if (!opts.skipCooldown && (this.cooldowns[payloadKey] || 0) > 0) return false;
        }

        const accepted = launcher.requestIcbmLaunch(payloadKey, tx, ty);
        if (!accepted) return false;

        if (team === 'player' && !opts.bypassCharge) {
            this.skillCharges[chargeKey] = Math.max(0, (this.skillCharges[chargeKey] || 0) - 1);
            if (!opts.skipCooldown && skillDef && skillDef.cooldown > 0) {
                this.cooldowns[payloadKey] = skillDef.cooldown;
            }
        }

        if (team === 'player' && typeof ChatPanel !== 'undefined') {
            ChatPanel.push(`[ICBM 준비] ${(skillDef && skillDef.name) ? skillDef.name : payloadKey}`, 'ACTION');
        }
        if (typeof app !== 'undefined') {
            app.markDirty();
            app.markUiDirty();
        }
        return true;
    },

    onIcbmLaunchFired(launcher, payloadKey, targetX, targetY) {
        if (!launcher || launcher.dead || !this.isIcbmSkillKey(payloadKey)) return null;
        const team = launcher.team || 'player';

        let startX = launcher.x;
        let startY = launcher.y - 80;
        if (typeof launcher.getIcbmMuzzleWorldPosition === 'function') {
            const muzzle = launcher.getIcbmMuzzleWorldPosition();
            if (muzzle && Number.isFinite(muzzle.x) && Number.isFinite(muzzle.y)) {
                startX = muzzle.x;
                startY = muzzle.y;
            }
        }

        const tx = Math.max(40, Math.min(CONFIG.mapWidth - 40, Number(targetX) || 0));
        const tyRaw = Number.isFinite(Number(targetY)) ? Number(targetY) : this.groundY;
        const ty = Math.min(this.groundY, tyRaw);

        let projectileType = 'icbm_emp_missile';
        let damage = 0;
        const shotOpts = { source: launcher, targetX: tx, targetY: ty };
        if (payloadKey === 'nuke') {
            projectileType = 'icbm_nuke_missile';
            shotOpts.arcHeight = 520;
            shotOpts.grav = 0.16;
            shotOpts.hitRadius = 44;
        } else if (payloadKey === 'tactical_missile') {
            projectileType = 'icbm_tactical_missile';
            damage = 350;
            shotOpts.arcHeight = 340;
            shotOpts.grav = 0.23;
            shotOpts.hitRadius = 30;
        } else {
            projectileType = 'icbm_emp_missile';
            shotOpts.arcHeight = 390;
            shotOpts.grav = 0.20;
            shotOpts.hitRadius = 42;
        }

        const p = new Projectile(startX, startY, null, damage, team, projectileType, shotOpts);
        if (payloadKey === 'tactical_missile') p._tactical = true;
        this.projectiles.push(p);

        if (team === 'player' && typeof ChatPanel !== 'undefined') {
            const skillDef = CONFIG.units[payloadKey];
            ChatPanel.push(`[ICBM 발사] ${(skillDef && skillDef.name) ? skillDef.name : payloadKey}`, 'ACTION');
        }
        if (typeof app !== 'undefined') app.markDirty();
        return p;
    },

    getEnemyAt(wx, wy, radius = 64) {
        const maxDist = Math.max(6, radius);
        let best = null;
        let bestDist = maxDist;

        const consider = (t, tx, ty) => {
            const dx = tx - wx;
            const dy = ty - wy;
            const dist = Math.hypot(dx, dy);
            if (dist <= bestDist) {
                bestDist = dist;
                best = t;
                if (bestDist <= 1) return true;
            }
            return false;
        };

        const enemies = this.enemies || [];
        for (let i = 0; i < enemies.length; i++) {
            const e = enemies[i];
            if (!e || e.dead) continue;
            const tx = e.x;
            const ty = e.y - (e.height || 20) * 0.5;
            if (consider(e, tx, ty)) return best;
        }

        const buildings = this.enemyBuildings || [];
        for (let i = 0; i < buildings.length; i++) {
            const b = buildings[i];
            if (!b || b.dead) continue;
            const halfW = (b.width || 40) * 0.5;
            const left = b.x - halfW;
            const right = b.x + halfW;
            const top = b.y - (b.height || 40);
            const bottom = b.y;
            const dx = (wx < left) ? (left - wx) : (wx > right ? (wx - right) : 0);
            const dy = (wy < top) ? (top - wy) : (wy > bottom ? (wy - bottom) : 0);
            const dist = Math.hypot(dx, dy);
            if (dist <= bestDist) {
                bestDist = dist;
                best = b;
                if (bestDist <= 1) return best;
            }
        }

        return best;
    },

    assignDroneLocks(target, dronePool = null) {
        if (!target || target.dead) return false;
        const drones = Array.isArray(dronePool)
            ? dronePool
            : ((typeof this.getSelectedDronesForLockdown === 'function')
                ? this.getSelectedDronesForLockdown()
                : this.getSelectedDrones());
        if (drones.length === 0) return false;

        const isAssignableDrone = (d) => !!(
            d
            && !d.dead
            && !d.recallRequested
        );
        const isUnlockedDrone = (d) => !!(!d.lockedTarget || d.lockedTarget.dead);

        // 1순위: 잠금 안 된 드론
        let chosen = drones.find(d => isAssignableDrone(d) && isUnlockedDrone(d));
        // 2순위: 이미 잠금된 드론이라도 재지정 허용(완전 무반응 방지)
        if (!chosen) {
            chosen = drones.find(isAssignableDrone);
        }
        if (!chosen) return false;

        chosen.lockedTarget = target;
        chosen.recallRequested = false;
        chosen.recallPhase = null;
        chosen.recallTarget = null;
        chosen.swarmTarget = null;
        chosen.attackTarget = null;
        chosen.holdFrames = 0;
        chosen.launchInit = false;
        chosen.autoSeekTarget = false;
        chosen.commandState = 'locked';
        chosen.attackPhase = null;

        this.droneLockCursor = (this.droneLockCursor || 0) + 1;

        if (typeof ChatPanel !== 'undefined') {
            ChatPanel.push('[락다운] 드론 1기 -> 타겟 지정', 'ACTION');
        }
        return true;
    },

    tryDroneLockdown(wx, wy) {
        const drones = (typeof this.getSelectedDronesForLockdown === 'function')
            ? this.getSelectedDronesForLockdown()
            : this.getSelectedDrones();
        if (drones.length === 0) return false;
        const enemy = this.getEnemyAt(wx, wy, 96);
        if (!enemy) return false;
        const assigned = this.assignDroneLocks(enemy, drones);
        if (!assigned && typeof ChatPanel !== 'undefined') {
            ChatPanel.push('[락다운] 대기 중인 드론이 없습니다.', 'WARN');
        }
        return assigned === true;
    },

    // Toast Wrapper
    showToast(msg) { ui.showToast(msg); },

    /**
     * [NEW] Update HUD selection display
     * Called from all selection change points (single entry point)
     */
    updateHUDSelection() {
        if (typeof HUD === 'undefined') return;

        // Priority: selectedUnits > selectedBuilding > null
        if (this.selectedUnits && this.selectedUnits.size > 0) {
            if (this.selectedUnits.size === 1) {
                // Single unit selected
                const u = this.selectedUnits.values().next().value;
                if (u && !u.dead) {
                    HUD.setSelection({
                        kind: 'unit',
                        name: u.stats?.name || 'Unit',
                        hp: u.hp || 0,
                        hpMax: u.stats?.hp || 100,
                        color: u.stats?.color || '#60a5fa'
                    });
                    return;
                }
            } else {
                // Multiple units selected
                HUD.setSelection({
                    kind: 'multi',
                    count: this.selectedUnits.size
                });
                return;
            }
        }

        if (this.selectedBuilding && !this.selectedBuilding.dead) {
            const b = this.selectedBuilding;
            HUD.setSelection({
                kind: 'building',
                name: b.name || b.type || 'Building',
                buildingType: b.type,  // [NEW] 건물 타입 (bunker, hq_player 등)
                building: b,           // [NEW] 건물 객체 참조 (주둔 보병 정보용)
                hp: b.hp || 0,
                hpMax: b.maxHp || 100,
                team: b.team || 'neutral'
            });
            return;
        }

        // Nothing selected
        HUD.setSelection(null);
    },

    // [PATCH] Apply unit/map overrides from localStorage (editor)
    applyLocalPatch() {
        let raw = null;
        try {
            raw = localStorage.getItem('reclaim_unit_patch_v1');
        } catch (_) {
            return;
        }
        if (!raw) return;

        let patch = null;
        try {
            patch = JSON.parse(raw);
        } catch (_) {
            return;
        }
        if (!patch || typeof patch !== 'object') return;

        const unitsPatch = (patch.units && typeof patch.units === 'object') ? patch.units : null;
        if (unitsPatch && typeof CONFIG !== 'undefined' && CONFIG.units) {
            Object.keys(unitsPatch).forEach((unitKey) => {
                const unit = CONFIG.units[unitKey];
                const fields = unitsPatch[unitKey];
                if (!unit || typeof unit !== 'object' || !fields || typeof fields !== 'object') return;

                Object.keys(fields).forEach((field) => {
                    if (!Object.prototype.hasOwnProperty.call(unit, field)) return;
                    const val = fields[field];
                    if (typeof val === 'number') {
                        if (!Number.isFinite(val)) return;
                        unit[field] = val;
                    } else if (typeof val === 'string' || typeof val === 'boolean') {
                        unit[field] = val;
                    }
                });
            });
        }

        const mapsPatch = (patch.maps && typeof patch.maps === 'object') ? patch.maps : null;
        if (mapsPatch && typeof Maps !== 'undefined' && Maps.types) {
            Object.keys(mapsPatch).forEach((mapKey) => {
                const map = Maps.types[mapKey];
                const fields = mapsPatch[mapKey];
                if (!map || typeof map !== 'object' || !fields || typeof fields !== 'object') return;

                Object.keys(fields).forEach((field) => {
                    if (!Object.prototype.hasOwnProperty.call(map, field)) return;
                    const val = fields[field];
                    if (typeof val === 'number') {
                        if (!Number.isFinite(val)) return;
                        map[field] = val;
                    } else if (typeof val === 'string' || typeof val === 'boolean') {
                        map[field] = val;
                    }
                });
            });
        }

        if (typeof window !== 'undefined') {
            let skinsRaw = null;
            try {
                skinsRaw = localStorage.getItem('reclaim_skins_v1');
            } catch (_) { }

            const sanitizedSkins = {};
            if (skinsRaw && typeof CONFIG !== 'undefined' && CONFIG.units) {
                try {
                    const parsed = JSON.parse(skinsRaw);
                    if (parsed && typeof parsed === 'object') {
                        Object.keys(parsed).forEach((unitKey) => {
                            if (!CONFIG.units[unitKey]) return;
                            const skin = parsed[unitKey];
                            if (!skin || typeof skin !== 'object') return;

                            const clean = {};
                            const scale = Number(skin.scale);
                            if (Number.isFinite(scale)) clean.scale = scale;

                            if (skin.anchor && typeof skin.anchor === 'object') {
                                const ax = Number(skin.anchor.x);
                                const ay = Number(skin.anchor.y);
                                if (Number.isFinite(ax) || Number.isFinite(ay)) {
                                    clean.anchor = {
                                        x: Number.isFinite(ax) ? ax : 0,
                                        y: Number.isFinite(ay) ? ay : 0
                                    };
                                }
                            }

                            if (Array.isArray(skin.layers)) {
                                const layers = [];
                                skin.layers.forEach((layer) => {
                                    if (!layer || typeof layer !== 'object') return;
                                    const name = (typeof layer.name === 'string' && layer.name.trim()) ? layer.name.trim() : 'Layer';
                                    const color = (typeof layer.color === 'string' && layer.color.trim()) ? layer.color.trim() : '#38bdf8';
                                    const curve = (typeof layer.curve === 'string' && layer.curve.trim()) ? layer.curve.trim() : null;
                                    const shape = (typeof layer.shape === 'string' && layer.shape.trim()) ? layer.shape.trim() : null;
                                    const points = [];
                                    if (Array.isArray(layer.points)) {
                                        layer.points.forEach((pt) => {
                                            if (!pt || typeof pt !== 'object') return;
                                            const x = Number(pt.x);
                                            const y = Number(pt.y);
                                            if (!Number.isFinite(x) || !Number.isFinite(y)) return;
                                            points.push({ x, y });
                                        });
                                    }

                                    let cleanLayer = null;
                                    if (shape === 'circle') {
                                        const cx = Number(layer.cx);
                                        const cy = Number(layer.cy);
                                        const r = Number(layer.r);
                                        if (Number.isFinite(cx) && Number.isFinite(cy) && Number.isFinite(r) && r > 0) {
                                            cleanLayer = { name, color, shape: 'circle', cx, cy, r };
                                        }
                                    } else if (shape === 'arc') {
                                        const cx = Number(layer.cx);
                                        const cy = Number(layer.cy);
                                        const r = Number(layer.r);
                                        const start = Number(layer.start);
                                        const end = Number(layer.end);
                                        if (Number.isFinite(cx) && Number.isFinite(cy) && Number.isFinite(r) && r > 0 &&
                                            Number.isFinite(start) && Number.isFinite(end)) {
                                            cleanLayer = {
                                                name,
                                                color,
                                                shape: 'arc',
                                                cx,
                                                cy,
                                                r,
                                                start,
                                                end
                                            };
                                            if (layer.ccw === true) cleanLayer.ccw = true;
                                            if (layer.closed === false) cleanLayer.closed = false;
                                        }
                                    }

                                    if (!cleanLayer && points.length >= 2) {
                                        cleanLayer = { name, color, points };
                                        if (curve) cleanLayer.curve = curve;
                                    }

                                    if (cleanLayer) {
                                        layers.push(cleanLayer);
                                    }
                                });
                                if (layers.length) clean.layers = layers;
                            }

                            if (clean.layers) sanitizedSkins[unitKey] = clean;
                        });
                    }
                } catch (_) { }
            }
            // [R 5.1] DEFAULT_UNIT_SHAPES를 기본값으로 사용, localStorage 스킨으로 덮어쓰기
            if (typeof DEFAULT_UNIT_SHAPES !== 'undefined') {
                // 깊은 복사로 원본 보호
                window.RECLAIM_SKINS = JSON.parse(JSON.stringify(DEFAULT_UNIT_SHAPES));
                // localStorage 커스텀 스킨 병합
                Object.keys(sanitizedSkins).forEach(key => {
                    window.RECLAIM_SKINS[key] = sanitizedSkins[key];
                });
            } else {
                window.RECLAIM_SKINS = sanitizedSkins;
            }
        }
    },

    ensureMapsReady() {
        if (typeof Maps !== 'undefined' && Maps && typeof Maps === 'object') return;
        if (typeof window === 'undefined') return;
        if (window.Maps && typeof window.Maps === 'object') return;

        console.error('[Boot] maps.js not loaded. Using fallback Maps shim.');
        window.Maps = {
            types: {
                plain: { name: 'Plains', sky: '#87CEEB', skyMid: '#e0f2fe', ground: '#4ade80', groundDark: '#16a34a' },
                skirmish: { name: 'Skirmish', sky: '#87CEEB', skyMid: '#b0d4e8', ground: '#4ade80', groundDark: '#16a34a' },
                skirmish_kabul: { name: 'Kabul', sky: '#6E8594', skyMid: '#9e9789', ground: '#3b3d3f', groundDark: '#2a2b2d' },
                skirmish_desert: { name: '사막 도시 (Desert City)', sky: '#40a8c4', skyMid: '#dcedc1', ground: '#e3b768', groundDark: '#c69c55' }
            },
            rules: {
                plain: { playerHQ: true, enemyHQ: true, playerDefense: true, enemyDefense: true, bunkers: true, mapExpand: true, winCondition: 'hq_destroy' },
                skirmish: { playerHQ: false, enemyHQ: false, playerDefense: false, enemyDefense: false, bunkers: false, mapExpand: false, winCondition: 'annihilation' },
                skirmish_kabul: { playerHQ: false, enemyHQ: false, playerDefense: false, enemyDefense: false, bunkers: false, mapExpand: false, winCondition: 'annihilation' },
                skirmish_desert: { playerHQ: false, enemyHQ: false, playerDefense: false, enemyDefense: false, bunkers: false, mapExpand: false, winCondition: 'annihilation' }
            },
            currentMap: 'plain',
            __fallback: true,
            _rand(seed) {
                let h = 2166136261;
                const s = String(seed);
                for (let i = 0; i < s.length; i++) {
                    h ^= s.charCodeAt(i);
                    h = Math.imul(h, 16777619);
                }
                return (h >>> 0) / 4294967295;
            },
            getRule(key) {
                const mapRules = this.rules[this.currentMap];
                if (mapRules && key in mapRules) return mapRules[key];
                const defaults = {
                    playerHQ: true,
                    enemyHQ: true,
                    playerDefense: true,
                    enemyDefense: true,
                    bunkers: true,
                    mapExpand: false,
                    winCondition: 'hq_destroy',
                    survivalTime: 600
                };
                return defaults[key];
            },
            drawBase(ctx, width, height, groundY) {
                if (!ctx) return;
                const t = this.types[this.currentMap] || this.types.plain;
                const grad = ctx.createLinearGradient(0, 0, 0, height);
                grad.addColorStop(0, t.sky || '#87CEEB');
                grad.addColorStop(0.55, t.skyMid || '#e0f2fe');
                grad.addColorStop(1, t.ground || '#4ade80');
                ctx.fillStyle = grad;
                ctx.fillRect(0, 0, width, height);
                ctx.fillStyle = t.ground || '#4ade80';
                ctx.fillRect(0, groundY, width, Math.max(0, height - groundY));
            },
            drawDecorations(ctx, width, height, groundY, cameraX = 0) {
                if (!ctx) return;
                const mapId = this.currentMap || 'plain';
                const buffer = 220;
                const screenStart = cameraX - buffer;
                const screenEnd = cameraX + width + buffer;

                if (mapId === 'skirmish_kabul') {
                    ctx.save();
                    const mx = cameraX * 0.12;
                    ctx.translate(-mx, 0);
                    const interval = 1700;
                    const start = Math.floor((mx - buffer) / interval) * interval;
                    const end = mx + width + buffer + interval;
                    ctx.fillStyle = '#5B6266';
                    for (let i = start; i < end; i += interval) {
                        ctx.beginPath();
                        ctx.moveTo(i - 120, groundY + 140);
                        ctx.lineTo(i + 180, groundY - 210);
                        ctx.lineTo(i + 420, groundY - 90);
                        ctx.lineTo(i + 720, groundY - 250);
                        ctx.lineTo(i + 980, groundY - 70);
                        ctx.lineTo(i + 1280, groundY - 220);
                        ctx.lineTo(i + 1660, groundY - 40);
                        ctx.lineTo(i + 1980, groundY + 140);
                        ctx.closePath();
                        ctx.fill();
                    }
                    ctx.restore();

                    ctx.save();
                    const cx = cameraX * 0.34;
                    ctx.translate(-cx, 0);
                    const cStart = Math.floor((cx - buffer) / 92) * 92;
                    const cEnd = cx + width + buffer;
                    const palette = ['#A19C93', '#C4BDB1', '#8A8275', '#9b9487'];
                    for (let x = cStart; x < cEnd; x += 92) {
                        const r = this._rand(x * 0.017 + 31);
                        const h = 120 + Math.floor(r * 300);
                        const w = 64 + Math.floor(this._rand(x * 0.031 + 77) * 110);
                        const y = groundY;
                        const color = palette[Math.floor(this._rand(x * 0.013 + 9) * palette.length) % palette.length];
                        ctx.fillStyle = color;
                        ctx.fillRect(x, y - h, w, h);
                        ctx.strokeStyle = '#55514a';
                        ctx.lineWidth = 1;
                        ctx.strokeRect(x, y - h, w, h);
                        for (let wy = 16; wy < h - 10; wy += 24) {
                            for (let wx = 10; wx < w - 10; wx += 18) {
                                const on = this._rand((x + wx) * (wy + 13) * 0.0019) > 0.92;
                                ctx.fillStyle = on ? '#d8cf9b' : '#2C2A28';
                                ctx.fillRect(x + wx, y - h + wy, 8, 12);
                            }
                        }
                    }
                    ctx.restore();

                    ctx.save();
                    ctx.translate(-cameraX, 0);
                    ctx.fillStyle = '#7A756E';
                    ctx.fillRect(screenStart, groundY, screenEnd - screenStart, 20);
                    ctx.fillStyle = '#3A3C3E';
                    ctx.fillRect(screenStart, groundY + 20, screenEnd - screenStart, Math.max(0, height - groundY - 20));
                    ctx.strokeStyle = '#a8a29e';
                    ctx.lineWidth = 2;
                    for (let x = Math.floor(screenStart / 120) * 120; x < screenEnd; x += 120) {
                        ctx.beginPath();
                        ctx.moveTo(x + 34, groundY + 30);
                        ctx.lineTo(x + 78, groundY + 30);
                        ctx.stroke();
                    }
                    for (let x = Math.floor(screenStart / 260) * 260; x < screenEnd; x += 260) {
                        ctx.fillStyle = '#5b5b5b';
                        ctx.fillRect(x + 24, groundY - 12, 24, 12);
                        ctx.fillStyle = '#7d7d7d';
                        ctx.fillRect(x + 28, groundY - 9, 16, 5);
                    }
                    ctx.restore();
                    return;
                }

                if (mapId === 'skirmish_desert') {
                    ctx.save();
                    const cityX = cameraX * 0.24;
                    ctx.translate(-cityX, 0);
                    const start = Math.floor((cityX - buffer) / 120) * 120;
                    const end = cityX + width + buffer;
                    const palette = ['#b2895d', '#8f6f4b', '#c39b70'];
                    for (let x = start; x < end; x += 120) {
                        const h = 90 + Math.floor(this._rand(x * 0.02 + 1) * 210);
                        const w = 90 + Math.floor(this._rand(x * 0.027 + 11) * 90);
                        ctx.fillStyle = palette[Math.floor(this._rand(x * 0.041 + 3) * palette.length) % palette.length];
                        ctx.fillRect(x, groundY - h, w, h);
                    }
                    ctx.restore();

                    ctx.save();
                    const duneX = cameraX * 0.12;
                    ctx.translate(-duneX, 0);
                    ctx.fillStyle = '#d7b679';
                    const dStart = Math.floor((duneX - buffer) / 240) * 240;
                    const dEnd = duneX + width + buffer + 240;
                    for (let x = dStart; x < dEnd; x += 240) {
                        ctx.beginPath();
                        ctx.moveTo(x, groundY + 22);
                        ctx.quadraticCurveTo(x + 120, groundY - 40, x + 240, groundY + 22);
                        ctx.lineTo(x + 240, groundY + 80);
                        ctx.lineTo(x, groundY + 80);
                        ctx.closePath();
                        ctx.fill();
                    }
                    ctx.restore();
                    return;
                }

                if (mapId === 'plain' || mapId === 'skirmish') {
                    ctx.save();
                    ctx.translate(-cameraX, 0);
                    const start = Math.floor(screenStart / 80) * 80;
                    for (let x = start; x < screenEnd; x += 80) {
                        const h = 42 + Math.floor(this._rand(x * 0.07 + 5) * 36);
                        ctx.fillStyle = '#166534';
                        ctx.beginPath();
                        ctx.moveTo(x, groundY);
                        ctx.lineTo(x + 18, groundY - h);
                        ctx.lineTo(x + 36, groundY);
                        ctx.fill();
                        ctx.fillStyle = '#3f6212';
                        ctx.fillRect(x + 14, groundY - 9, 8, 9);
                    }
                    ctx.restore();
                }
            },
            drawThreatOverlay() { }
        };
    },

    enforceCriticalMapThemes() {
        if (typeof Maps === 'undefined' || !Maps || typeof Maps !== 'object') return;
        if (!Maps.types || typeof Maps.types !== 'object') Maps.types = {};
        if (!Maps.rules || typeof Maps.rules !== 'object') Maps.rules = {};

        const ensureTheme = (id, defaults) => {
            const src = (Maps.types[id] && typeof Maps.types[id] === 'object') ? Maps.types[id] : {};
            const out = { ...src };
            Object.keys(defaults).forEach((k) => {
                const v = out[k];
                const bad = (typeof v !== 'string')
                    || !v.trim()
                    || v === '#000'
                    || v === '#000000'
                    || v.toLowerCase() === 'black';
                if (bad) out[k] = defaults[k];
            });
            Maps.types[id] = out;
        };

        ensureTheme('skirmish', { name: 'Skirmish', sky: '#87CEEB', skyMid: '#b0d4e8', ground: '#4ade80', groundDark: '#16a34a' });
        ensureTheme('skirmish_kabul', { name: 'Kabul', sky: '#6E8594', skyMid: '#9e9789', ground: '#3b3d3f', groundDark: '#2a2b2d' });
        ensureTheme('skirmish_desert', { name: '사막 도시 (Desert City)', sky: '#40a8c4', skyMid: '#dcedc1', ground: '#e3b768', groundDark: '#c69c55' });

        const ensureRules = (id) => {
            if (!Maps.rules[id] || typeof Maps.rules[id] !== 'object') Maps.rules[id] = {};
            Maps.rules[id].playerHQ = false;
            Maps.rules[id].enemyHQ = false;
            Maps.rules[id].playerDefense = false;
            Maps.rules[id].enemyDefense = false;
            Maps.rules[id].bunkers = false;
            Maps.rules[id].mapExpand = false;
            if (!Maps.rules[id].winCondition) Maps.rules[id].winCondition = 'annihilation';
        };
        ensureRules('skirmish');
        ensureRules('skirmish_kabul');
        ensureRules('skirmish_desert');
    },

    init() {
        this.ensureMapsReady();
        this.enforceCriticalMapThemes();
        this.ctx = this.canvas.getContext('2d');
        this.resize();
        window.addEventListener('resize', () => this.resize()); // 회전 시 즉시 반응
        window.addEventListener('orientationchange', () => setTimeout(() => this.resize(), 50));

        // [PATCH] Apply editor overrides before any game init
        this.applyLocalPatch();

        this.setupInputs();
        this.initGameObjects();

        // UI 초기화
        ui.init();
        ui.initUnitButtons(this.currentCategory);
        if (typeof Lang !== 'undefined') Lang.updateDOM();
        this.updateZoomUI();
        this.applyVersionLabels();
        this.initCitySim();

        // [NEW] HUD 초기화
        if (typeof HUD !== 'undefined') HUD.init();

        // [Safety] 화면 전환 꼬임으로 모든 레이어가 숨겨졌을 때 자동 복구
        this._startUiRecoveryWatchdog();

        // [P0-4] EMP 플래시 DOM 캐싱
        this.$empFlash = document.getElementById('emp-flash');
        this._empWasActive = false;
        this.$hudTimer = document.getElementById('hud-timer');
        this.$hudTimerContainer = document.getElementById('hud-timer-container');
        this.$missionModal = document.getElementById('mission-objective-modal');
        this.$missionText = document.getElementById('mission-objective-text');
        this._lastTimerText = null;
        if (this.$hudTimer) this.$hudTimer.textContent = '00:00';

        // [FIX] Force HUD selection state to null on init (prevent production UI from showing)
        this.updateHUDSelection();

        // [ADD][APP] 저장된 설정/스키마를 로드해서 게임에 적용
        if (typeof app !== 'undefined') {
            app.loadIntoGame();      // speed/difficulty/lastMapId 등 반영
            app.commit('init');      // UI 1회 정렬 + 저장 포맷 정리
        }
        this.ensureCampaignProgress();

        // [NEW] History API Handle for Back Button
        window.addEventListener('popstate', (event) => {
            const isVisible = (id) => {
                const el = document.getElementById(id);
                return !!el && !el.classList.contains('hidden');
            };
            const isMapOpen = isVisible('map-select-screen');
            const isDiffOpen = isVisible('difficulty-select-screen');
            const isUnitDexOpen = isVisible('unitdex-screen');
            const isCityOpen = isVisible('city-screen');
            const isCampaignOpen = isVisible('campaign-screen');
            const isEndOpen = isVisible('end-screen');
            if (this.isGameOver || isEndOpen) {
                history.pushState({ page: 'gameover' }, "GameOver", "#game");
                return;
            }
            if (this.running) {
                history.pushState({ page: 'game' }, "Game", "#game");
                ui.showExitConfirmation('retreat');
            } else if (isMapOpen || isDiffOpen || isUnitDexOpen || isCityOpen || isCampaignOpen) {
                this.backToLobby();
            } else {
                history.pushState({ page: 'lobby' }, "Lobby", "#lobby"); // Keep in page
                ui.showExitConfirmation('quit');
            }
        });

        // Push initial state
        history.replaceState({ page: 'lobby' }, "Lobby", "#lobby");

        // Startup flow (cinematic vs loading) is controlled in index.html.
        // Avoid forcing loading screen here; it can override cinematic playback.

        // Minimap Inputs
        const miniCvs = document.getElementById('hud-minimap');
        if (miniCvs) {
            const handleMinimap = (mx, my) => {
                const rect = miniCvs.getBoundingClientRect();
                const x = mx - rect.left;
                const ratio = x / rect.width;
                this.cameraX = (ratio * CONFIG.mapWidth) - (Camera.viewW(this) / 2);
                this.cameraX = Camera.clampCameraX(this, this.cameraX);
            };
            let miniDrag = false;
            miniCvs.addEventListener('mousedown', e => { miniDrag = true; handleMinimap(e.clientX, e.clientY); });
            window.addEventListener('mousemove', e => { if (miniDrag) handleMinimap(e.clientX, e.clientY); });
            window.addEventListener('mouseup', () => miniDrag = false);
        }

        // Visibility / Freeze Prevention
        const persistSessionState = () => {
            try {
                if (typeof this.saveCitySimState === 'function') this.saveCitySimState();
            } catch (err) {
                console.warn('[Visibility] city save failed:', err);
            }
            try {
                if (typeof app !== 'undefined' && app && typeof app.saveNow === 'function') app.saveNow();
            } catch (err) {
                console.warn('[Visibility] app save failed:', err);
            }
        };

        document.addEventListener('visibilitychange', () => {
            if (document.hidden) {
                this._resumeAfterVisibilityHidden = this.running === true;
                this._uiBlankTicks = 0;
                persistSessionState();
                if (typeof AudioSystem !== 'undefined' && AudioSystem.ctx) AudioSystem.ctx.suspend();
                this.running = false;
                if (this.loopId) {
                    cancelAnimationFrame(this.loopId);
                    this.loopId = null;
                }
                return;
            }

            if (typeof AudioSystem !== 'undefined' && AudioSystem.ctx) AudioSystem.ctx.resume();
            this._uiBlankTicks = 0;
            const shouldResumeBattle = this._resumeAfterVisibilityHidden === true && !this.isGameOver;
            this._resumeAfterVisibilityHidden = false;
            if (shouldResumeBattle && !this.running) {
                this.running = true;
                if (!this.loopId) this.loop();
            }
        });

        window.addEventListener('pagehide', persistSessionState);
        window.addEventListener('beforeunload', persistSessionState);
    },

    applyVersionLabels() {
        const v = (typeof window !== 'undefined') ? window.RECLAIM_VERSION : null;
        const brandEl = document.getElementById('lobby-brand');
        if (brandEl) {
            brandEl.textContent = (v && (v.brand || v.brandName)) ? (v.brand || v.brandName) : 'RECLAIM';
        }
        const labelEl = document.getElementById('lobby-version-label');
        const runtimeEl = document.getElementById('lobby-runtime-status');

        const versionText = (v && v.version)
            ? String(v.version)
            : `v${Math.floor(Number(v && v.major) || 0)}.${Math.floor(Number(v && v.minor) || 0)}.${Math.floor(Number(v && v.patch) || 0)}`;

        const formatDateTime = (date) => {
            const d = date instanceof Date ? date : new Date();
            const yyyy = String(d.getFullYear());
            const mm = String(d.getMonth() + 1).padStart(2, '0');
            const dd = String(d.getDate()).padStart(2, '0');
            const hh = String(d.getHours()).padStart(2, '0');
            const mi = String(d.getMinutes()).padStart(2, '0');
            const ss = String(d.getSeconds()).padStart(2, '0');
            return `${yyyy}-${mm}-${dd} ${hh}:${mi}:${ss}`;
        };

        const renderVersionTime = () => {
            const nowText = formatDateTime(new Date());
            // Keep only one runtime text in the lobby center.
            if (labelEl) {
                labelEl.textContent = '';
                labelEl.style.display = 'none';
            }
            if (runtimeEl) runtimeEl.textContent = `버전 ${versionText} · ${nowText}`;
        };

        renderVersionTime();
        if (this._lobbyVersionTimer) clearInterval(this._lobbyVersionTimer);
        this._lobbyVersionTimer = setInterval(renderVersionTime, 1000);
    },

    getCityBuildingDefs() {
        return CitySimConstruction.getBuildingDefs();
    },

    createDefaultCityGrid(cols, rows) {
        return CitySimConstruction.createDefaultGrid(cols, rows);
    },

    getCityDefaults() {
        return CitySimSave.getDefaults(this);
    },

    loadCitySimState() {
        CitySimSave.load(this);
    },

    saveCitySimState(options) {
        return CitySimSave.save(this, options);
    },

    bindCityEvents() {
        CitySimMode.bindEvents(this);
    },

    initCitySim() {
        CitySimMode.init(this);
    },

    loginAndEnterCity() {
        CitySimAuth.loginAndEnter(this);
    },

    startGoogleLogin() {
        CitySimAuth.startGoogle(this);
    },

    startGuestPlay() {
        CitySimAuth.startGuest(this);
    },

    launchBattleFromCity() {
        CitySimMode.launchBattle(this);
    },

    enterCityScreen() {
        this.stopMapSelectBgm();
        CitySimMode.enter(this);
        if (typeof CityQuestMission !== 'undefined'
            && CityQuestMission
            && typeof CityQuestMission.init === 'function') {
            CityQuestMission.init(this);
        }
        this.refreshCityQuestPanel();
    },

    hideCityScreen() {
        CitySimMode.leave(this);
    },

    openCityActionModal(title, message, options) {
        CitySimMode.openActionModal(title, message, options);
    },

    closeCityActionModal() {
        CitySimMode.closeActionModal();
    },

    openCityBuildPanel(forceOpen) {
        CitySimConstruction.openBuildPanel(this, forceOpen);
    },

    toggleCityMissionPanel(forceOpen) {
        CitySimMode.toggleMissionPanel(this, forceOpen);
        this.refreshCityQuestPanel();
    },

    setCityBuildTool(tool) {
        CitySimConstruction.setBuildTool(this, tool);
    },

    setCityBuildTab(tab) {
        CitySimConstruction.setBuildTab(this, tab);
    },

    setCityInventoryTab(tab) {
        CitySimConstruction.setInventoryTab(this, tab);
    },

    renderCityBuildSelection() {
        CitySimConstruction.renderBuildSelection(this);
    },

    renderCityContextBar() {
        CitySimConstruction.renderContextBar(this);
    },

    renderCityResources() {
        CitySimEconomy.renderResources(this);
    },

    renderCityUnits() {
        CitySimBarracks.renderUnits(this);
    },

    renderCityGrid() {
        CitySimConstruction.renderGrid(this);
    },

    renderCityInventoryPanel() {
        CitySimConstruction.renderInventoryPanel(this);
    },

    renderCityScreen() {
        CitySimMode.renderScreen(this);
        this.refreshCityQuestPanel();
    },

    canPayCityCost(cost) {
        return CitySimEconomy.canPayCost(this, cost);
    },

    payCityCost(cost) {
        CitySimEconomy.payCost(this, cost);
    },

    handleCityCellAction(index, options) {
        CitySimConstruction.handleCellAction(this, index, options);
    },

    tickCityConstruction() {
        if (typeof CitySimConstruction !== 'undefined' && CitySimConstruction && typeof CitySimConstruction.tickProductionCooldowns === 'function') {
            CitySimConstruction.tickProductionCooldowns(this);
        }
    },

    updateCityPlacementPreview(index) {
        CitySimConstruction.updatePlacementPreview(this, index);
    },

    clearCityPlacementPreview() {
        CitySimConstruction.clearPlacementPreview(this);
    },

    cityActionPrimary() {
        CitySimConstruction.triggerPrimaryAction(this);
    },

    claimCityIncomeBatch() {
        if (typeof CitySimEconomy !== 'undefined'
            && CitySimEconomy
            && typeof CitySimEconomy.claimAllIncome === 'function') {
            CitySimEconomy.claimAllIncome(this);
        }
    },

    activateCityTaxAutoCollect() {
        if (typeof CitySimEconomy !== 'undefined'
            && CitySimEconomy
            && typeof CitySimEconomy.activateAutoTaxCollect === 'function') {
            CitySimEconomy.activateAutoTaxCollect(this);
        }
    },

    cityActionSell() {
        CitySimConstruction.sellSelected(this);
    },

    cityActionMove() {
        CitySimConstruction.moveSelected(this);
    },

    cityActionConfirm() {
        CitySimConstruction.confirmSelection(this);
    },

    recalcCityDerived() {
        CitySimEconomy.recalcDerived(this);
    },

    applyCityUnitsToBattleStock() {
        if (typeof CONFIG === 'undefined' || !CONFIG || !CONFIG.units) return;
        const cityState = (typeof CitySimState !== 'undefined'
            && CitySimState
            && typeof CitySimState.ensure === 'function')
            ? CitySimState.ensure(this)
            : this.citySim;
        if (!cityState || typeof cityState !== 'object') return;
        if (!cityState.units || typeof cityState.units !== 'object') {
            cityState.units = {};
        }
        if (!cityState.drillgroundSlots || typeof cityState.drillgroundSlots !== 'object') {
            cityState.drillgroundSlots = {};
        }
        if (!cityState.drillgroundInfantryCounts || typeof cityState.drillgroundInfantryCounts !== 'object') {
            cityState.drillgroundInfantryCounts = {};
        }

        const cityUnits = cityState.units;
        const drillgroundSlots = cityState.drillgroundSlots;
        const drillgroundInfantryCounts = cityState.drillgroundInfantryCounts;
        const drillgroundUnitCounts = {};
        let recoveredDrillgroundSlots = false;

        Object.keys(drillgroundSlots).forEach((rawIndex) => {
            const slotKey = String(rawIndex || '').trim();
            if (!slotKey) return;
            const unitKey = String(drillgroundSlots[rawIndex] || '').trim();
            if (!unitKey) {
                delete drillgroundSlots[rawIndex];
                delete drillgroundInfantryCounts[rawIndex];
                recoveredDrillgroundSlots = true;
                return;
            }

            const unit = CONFIG.units[unitKey];
            if (!unit) {
                delete drillgroundSlots[rawIndex];
                delete drillgroundInfantryCounts[rawIndex];
                recoveredDrillgroundSlots = true;
                return;
            }

            const unitType = String(unit.type || '').trim().toLowerCase();
            const unitCategory = String(unit.category || '').trim().toLowerCase();
            const blockedForDrillground = (
                unit.disabled === true
                || unit.isBuilder === true
                || unit.droneLaunchOnly === true
                || unit.hideFromUnitBar === true
                || unitType === 'civilian'
                || unitCategory === 'civilian'
            );

            if (unit.isSkill === true) {
                const current = Math.max(0, Math.floor(Number(cityUnits[unitKey]) || 0));
                cityUnits[unitKey] = current + 1;
                delete drillgroundSlots[rawIndex];
                delete drillgroundInfantryCounts[rawIndex];
                recoveredDrillgroundSlots = true;
                return;
            }

            if (blockedForDrillground) {
                delete drillgroundSlots[rawIndex];
                delete drillgroundInfantryCounts[rawIndex];
                recoveredDrillgroundSlots = true;
                return;
            }

            const isInfantry = unitCategory === 'infantry';
            const slotCount = isInfantry
                ? Math.max(1, Math.min(4, Math.floor(Number(drillgroundInfantryCounts?.[rawIndex]) || 1)))
                : 1;
            if (!isInfantry && Object.prototype.hasOwnProperty.call(drillgroundInfantryCounts, rawIndex)) {
                delete drillgroundInfantryCounts[rawIndex];
                recoveredDrillgroundSlots = true;
            }

            const current = Math.max(0, Math.floor(Number(drillgroundUnitCounts[unitKey]) || 0));
            drillgroundUnitCounts[unitKey] = current + slotCount;
        });

        if (recoveredDrillgroundSlots) {
            if (typeof this.recalcCityDerived === 'function') {
                try { this.recalcCityDerived(); } catch (_) { }
            }
            if (typeof this.saveCitySimState === 'function') {
                try { this.saveCitySimState(); } catch (_) { }
            }
        }

        Object.keys(CONFIG.units).forEach((key) => {
            const unit = CONFIG.units[key];
            if (!unit) return;
            if (key === 'icbm_enemy') return;
            if (unit.hideFromUnitBar === true) return;
            if (unit.disabled === true) return;

            const cityCount = Math.max(0, Math.floor(Number(cityUnits[key]) || 0));
            if (unit.isSkill === true && unit.chargeKey) {
                if (!this.skillCharges || typeof this.skillCharges !== 'object') this.skillCharges = {};
                this.skillCharges[unit.chargeKey] = cityCount;
                return;
            }

            if (!this.playerStock || typeof this.playerStock !== 'object') this.playerStock = {};
            this.playerStock[key] = cityCount;
        });

        Object.keys(drillgroundUnitCounts).forEach((key) => {
            const unit = CONFIG.units[key];
            if (!unit) return;
            if (unit.isSkill === true) return;
            if (unit.hideFromUnitBar === true) return;
            if (unit.disabled === true) return;
            const count = Math.max(0, Math.floor(Number(drillgroundUnitCounts[key]) || 0));
            if (count <= 0) return;
            if (!this.playerStock || typeof this.playerStock !== 'object') this.playerStock = {};
            const current = Math.max(0, Math.floor(Number(this.playerStock[key]) || 0));
            this.playerStock[key] = current + count;
        });

        this.playerVeteransById = {};
        this.playerVeteranStock = {};
        this.playerVeteranOrder = [];

        const cityVeterans = (this.citySim && Array.isArray(this.citySim.veterans))
            ? this.citySim.veterans
            : [];
        cityVeterans.forEach((entry, index) => {
            const unitKey = String(entry?.unitKey || '').trim();
            const id = String(entry?.id || '').trim();
            if (!unitKey || !id) return;
            const unit = CONFIG.units[unitKey];
            if (!unit || unit.disabled === true) return;
            if (unit.isSkill === true) return;
            if (unit.hideFromUnitBar === true) return;
            this.playerVeteransById[id] = {
                id,
                unitKey,
                level: Math.max(2, Math.floor(Number(entry?.level) || 2)),
                name: String(entry?.name || '').trim().slice(0, 24),
                createdAt: Math.max(0, Math.floor(Number(entry?.createdAt) || 0)),
                loadout: {
                    itemKey: String(entry?.loadout?.itemKey || '').trim(),
                    skillItemKeys: Array.isArray(entry?.loadout?.skillItemKeys)
                        ? entry.loadout.skillItemKeys.map((key) => String(key || '').trim())
                        : []
                },
                _order: index
            };
            this.playerVeteranStock[id] = 1;
        });

        this.playerVeteranOrder = Object.keys(this.playerVeteransById).sort((a, b) => {
            const av = this.playerVeteransById[a];
            const bv = this.playerVeteransById[b];
            if (!av && !bv) return 0;
            if (!av) return 1;
            if (!bv) return -1;
            if (av.createdAt !== bv.createdAt) return av.createdAt - bv.createdAt;
            if (av._order !== bv._order) return av._order - bv._order;
            return av.id.localeCompare(bv.id);
        });
    },

    getVeteranSpawnEntries() {
        if (!this.playerVeteransById || typeof this.playerVeteransById !== 'object') return [];
        if (!Array.isArray(this.playerVeteranOrder) || this.playerVeteranOrder.length <= 0) return [];
        if (typeof CONFIG === 'undefined' || !CONFIG || !CONFIG.units) return [];

        const list = [];
        this.playerVeteranOrder.forEach((veteranId) => {
            const veteran = this.playerVeteransById[veteranId];
            if (!veteran) return;
            const unit = CONFIG.units[veteran.unitKey];
            if (!unit || unit.disabled === true || unit.isSkill === true) return;
            const stock = Math.max(0, Math.floor(Number(this.playerVeteranStock?.[veteranId]) || 0));
            list.push({
                id: veteran.id,
                unitKey: veteran.unitKey,
                unit,
                level: veteran.level,
                name: String(veteran.name || '').trim(),
                displayName: String(veteran.name || '').trim() || String(unit.name || veteran.unitKey),
                stock
            });
        });
        return list;
    },

    applyVeteranStats(unit, veteranMeta) {
        if (!unit || !veteranMeta) return;
        const level = Math.max(2, Math.floor(Number(veteranMeta.level) || 2));
        unit.isVeteran = true;
        unit.veteranId = String(veteranMeta.id || '').trim();
        unit.veteranLevel = level;
        unit.veteranName = String(veteranMeta.name || '').trim().slice(0, 24);
        const supportedLoadoutItemKeys = new Set([
            'rifle_d',
            'body_armor_d',
            'scope_d',
            'smoke_grenade',
            'medkit_c',
            'drone_suicide_item',
            'drone_at_item',
            'bp_missile'
        ]);
        const rawItemKey = String(veteranMeta?.loadout?.itemKey || '').trim();
        const rawSkillItemKeys = Array.isArray(veteranMeta?.loadout?.skillItemKeys)
            ? veteranMeta.loadout.skillItemKeys
            : [];
        const isOperator = (unit.typeKey === 'drone_operator') || unit.stats?.operator === true;
        const isInfantryCategory = (typeof CONFIG !== 'undefined' && CONFIG && CONFIG.units)
            ? String(CONFIG.units[unit.typeKey]?.category || '').trim().toLowerCase() === 'infantry'
            : false;
        const loadoutSkillItemKeys = ['', '', ''];
        if (isOperator) {
            for (let slotIndex = 1; slotIndex <= 2; slotIndex++) {
                const key = String(rawSkillItemKeys[slotIndex] || '').trim();
                if (key === 'drone_suicide_item' || key === 'drone_at_item') {
                    loadoutSkillItemKeys[slotIndex] = key;
                }
            }
            if (!loadoutSkillItemKeys[1] && (rawItemKey === 'drone_suicide_item' || rawItemKey === 'drone_at_item')) {
                loadoutSkillItemKeys[1] = rawItemKey;
            }
        } else if (isInfantryCategory) {
            // 보병 카테고리: 스킬 슬롯 1,2에서 smoke_grenade, medkit_c 읽기
            for (let slotIndex = 1; slotIndex <= 2; slotIndex++) {
                const key = String(rawSkillItemKeys[slotIndex] || '').trim();
                if (key === 'smoke_grenade' || key === 'medkit_c') {
                    loadoutSkillItemKeys[slotIndex] = key;
                }
            }
        }
        const normalizedRawItemKey = supportedLoadoutItemKeys.has(rawItemKey) ? rawItemKey : '';
        const passiveLoadoutItemKey = (normalizedRawItemKey
            && !(isOperator && (normalizedRawItemKey === 'drone_suicide_item' || normalizedRawItemKey === 'drone_at_item'))
            && !((normalizedRawItemKey === 'smoke_grenade' || normalizedRawItemKey === 'medkit_c') && isInfantryCategory && loadoutSkillItemKeys.includes(normalizedRawItemKey)))
            ? normalizedRawItemKey
            : '';
        const loadoutItemKey = passiveLoadoutItemKey
            || loadoutSkillItemKeys[1]
            || loadoutSkillItemKeys[2]
            || '';
        unit.veteranLoadoutSkillItemKeys = loadoutSkillItemKeys;
        unit.veteranLoadoutItemKey = loadoutItemKey;

        const hpMult = 1.12;
        unit.maxHp = Math.max(1, Math.floor((Number(unit.maxHp) || 1) * hpMult));
        unit.hp = unit.maxHp;

        if (unit.stats && typeof unit.stats === 'object') {
            const nextStats = { ...unit.stats };
            const damageMult = 1.08;
            const damageKeys = ['damage', 'damageGround', 'damageAir', 'missileDamage'];
            damageKeys.forEach((field) => {
                const base = Number(nextStats[field]);
                if (!Number.isFinite(base) || base <= 0) return;
                nextStats[field] = Math.max(1, Math.floor(base * damageMult));
            });

            // [ITEM] 아이템별 추가 스탯 적용
            const loadoutKey = unit.veteranLoadoutItemKey || '';
            if (loadoutKey === 'rifle_d') {
                // M249: 사거리 +25%, 데미지 +20% 추가, 총소리/탄속 플래그
                nextStats.range = Math.floor((Number(nextStats.range) || 200) * 1.25);
                const dmgKeys2 = ['damage', 'damageGround', 'damageAir'];
                dmgKeys2.forEach((field) => {
                    const base = Number(nextStats[field]);
                    if (!Number.isFinite(base) || base <= 0) return;
                    nextStats[field] = Math.max(1, Math.floor(base * 1.20));
                });
                unit.veteranGunType = 'rifle_d';
            } else if (loadoutKey === 'scope_d') {
                // 조준경: 사거리 +30%
                nextStats.range = Math.floor((Number(nextStats.range) || 200) * 1.30);
            }

            unit.stats = nextStats;
        }

        // [ITEM] 방탄복: 기본 HP 부스트 이후 추가 +25%
        if (unit.veteranLoadoutItemKey === 'body_armor_d') {
            unit.maxHp = Math.max(1, Math.floor(unit.maxHp * 1.25));
            unit.hp = unit.maxHp;
        }

        // [ITEM] 연막탄: 패시브 또는 스킬 슬롯 장착 시 스킬 장전
        if (unit.veteranLoadoutItemKey === 'smoke_grenade' || loadoutSkillItemKeys.includes('smoke_grenade')) {
            unit.smokeChargesLeft = 2;
            unit.smokeAiTimer = 60 + Math.floor(Math.random() * 240);
        }

        // [ITEM] 의료 키트: 패시브 또는 스킬 슬롯 장착 시 스킬 장전
        if (unit.veteranLoadoutItemKey === 'medkit_c' || loadoutSkillItemKeys.includes('medkit_c')) {
            unit.medkitChargesLeft = 2;
        }
    },

    // [ITEM] 의료 키트 스킬 — 자신 + 반경 내 아군 보병 즉시 치유
    useMedkitCommand() {
        if (!this.selectedUnits) return false;
        let used = false;
        this.selectedUnits.forEach((unit) => {
            if (!unit || unit.dead) return;
            if ((unit.medkitChargesLeft || 0) <= 0) return;
            unit.medkitChargesLeft -= 1;
            used = true;

            // 자신 치유 +40% maxHp
            const selfHeal = Math.floor((unit.maxHp || 1) * 0.40);
            unit.hp = Math.min(unit.maxHp, (unit.hp || 0) + selfHeal);

            // 반경 150px 내 아군 보병 치유 +30% maxHp
            const healRadius = 150;
            if (this.units && Array.isArray(this.units)) {
                this.units.forEach((ally) => {
                    if (!ally || ally.dead || ally === unit) return;
                    if (ally.team !== unit.team) return;
                    if (!ally.stats || String(ally.stats.category || '').trim().toLowerCase() !== 'infantry') return;
                    const dx = ally.x - unit.x;
                    if (Math.abs(dx) > healRadius) return;
                    const allyHeal = Math.floor((ally.maxHp || 1) * 0.30);
                    ally.hp = Math.min(ally.maxHp, (ally.hp || 0) + allyHeal);
                    // 치유 파티클
                    if (typeof this.createParticles === 'function') {
                        this.createParticles(ally.x, ally.y - 8, 5, '#4ade80');
                    }
                });
            }
            // 자신 치유 파티클
            if (typeof this.createParticles === 'function') {
                this.createParticles(unit.x, unit.y - 8, 8, '#4ade80');
            }
        });
        if (used && typeof ui !== 'undefined' && typeof ui.showToast === 'function') {
            ui.showToast('의료 키트 사용! 주변 보병 치유');
        }
        if (used && typeof this.updateHUDSelection === 'function') {
            this.updateHUDSelection();
        }
        return used;
    },

    // [ITEM] 활성 연막 구름 위치 목록 반환 (데미지 감소 판정용)
    getSmokeZones() {
        if (!Array.isArray(this.particles)) return [];
        const zones = [];
        this.particles.forEach((p) => {
            if (!p || typeof p !== 'object') return;
            if (typeof SmokeCloudFX !== 'undefined' && !(p instanceof SmokeCloudFX)) return;
            if (p.age == null || p.maxFrames == null) return;
            if (p.age >= p.maxFrames) return;
            // 연막이 실제로 보이는 구간(emitFrames 이내 또는 그 직후)만 유효
            if (p.age > (p.emitFrames || 220) + 80) return;
            zones.push({ x: p.x, y: p.y, radius: 90 });
        });
        return zones;
    },

    queueVeteranUnit(veteranId) {
        const id = String(veteranId || '').trim();
        if (!id) return false;

        const veteran = this.playerVeteransById?.[id];
        if (!veteran) return false;
        const unit = (typeof CONFIG !== 'undefined' && CONFIG && CONFIG.units)
            ? CONFIG.units[veteran.unitKey]
            : null;
        if (!unit || unit.isSkill === true) return false;

        if (this._skirmishMode && typeof SkirmishMode !== 'undefined' && SkirmishMode.isActive) {
            if (SkirmishMode.phase === 'placement') {
                if (typeof SkirmishMode.selectUnitFromBar === 'function') {
                    SkirmishMode.selectUnitFromBar(this, veteran.unitKey, id);
                }
                return true;
            }
            if (typeof ChatPanel !== 'undefined') {
                ChatPanel.push('국지전에서는 배치 단계에서만 유닛을 선택할 수 있습니다.', 'WARN');
            }
            return false;
        }

        const stock = Math.max(0, Math.floor(Number(this.playerVeteranStock?.[id]) || 0));
        if (stock <= 0) {
            if (typeof ui !== 'undefined' && typeof ui.showToast === 'function') {
                ui.showToast('베테랑 출격 가능 수량이 없습니다.');
            }
            return false;
        }

        const cooldown = Math.max(0, Number(this.cooldowns?.[veteran.unitKey]) || 0);
        if (cooldown > 0) {
            if (typeof ui !== 'undefined' && typeof ui.showToast === 'function') {
                ui.showToast('아직 재출격 대기중입니다.');
            }
            return false;
        }

        const cost = Math.max(0, Number(unit.cost) || 0);
        if (this.supply < cost) {
            if (typeof ui !== 'undefined' && typeof ui.showToast === 'function') {
                ui.showToast('자원이 부족합니다.');
            }
            return false;
        }

        this.supply -= cost;
        this.playerVeteranStock[id] = stock - 1;
        this.cooldowns[veteran.unitKey] = Math.max(0, Number(unit.cooldown) || 0);

        const spawnX = this.getPlayerSpawnX();
        const spawned = this.spawnUnitDirect(
            veteran.unitKey,
            spawnX,
            this.groundY,
            'player',
            { veteran }
        );
        if (!spawned) {
            this.supply += cost;
            this.playerVeteranStock[id] = stock;
            this.cooldowns[veteran.unitKey] = 0;
            return false;
        }

        if (typeof app !== 'undefined') {
            app.markDirty();
            app.markUiDirty();
        }
        return true;
    },

    cityTick() {
        CitySimMode.tick(this);
    },

    startCityLoop() {
        CitySimMode.startLoop(this);
    },

    stopCityLoop() {
        CitySimMode.stopLoop(this);
    },

    cityEarnMoney() {
        CitySimEconomy.earnMoney(this);
    },

    trainCityUnit(type) {
        CitySimBarracks.trainUnit(this, type);
    },

    openCityTrainingGuide() {
        CitySimBarracks.openTrainingGuide(this);
    },

    openCityGacha() {
        CitySimGacha.open(this);
    },

    openCityUpgrade() {
        CitySimUnitUpgrade.open(this);
    },

    openCityPolicy() {
        CitySimStocks.openPolicy(this);
    },

    openCityNews() {
        CitySimMode.openNews(this);
    },

    ensureCityQuestState() {
        if (typeof CityQuestMission !== 'undefined'
            && CityQuestMission
            && typeof CityQuestMission.ensureState === 'function') {
            return CityQuestMission.ensureState(this);
        }
        if (!this.cityQuestMission || typeof this.cityQuestMission !== 'object') {
            this.cityQuestMission = {};
        }
        return this.cityQuestMission;
    },

    markCityQuestCompleted(questKey, options = {}) {
        return this.grantCityQuestReward(questKey, options);
    },

    recordCityQuestBattleResult(options = {}) {
        const opts = (options && typeof options === 'object') ? options : {};
        let changed = false;
        const kills = Math.max(0, Math.floor(Number(opts.kills) || 0));
        const didWin = opts.didWin === true;
        const mode = String(opts.mode || this.activeCampaignTab || '').trim().toLowerCase();
        if (kills > 0 && typeof this.onQuestMissionEvent === 'function') {
            changed = this.onQuestMissionEvent('kill', { count: kills }) || changed;
        }
        if (didWin && typeof this.onQuestMissionEvent === 'function') {
            changed = this.onQuestMissionEvent('win', { count: 1, mode }) || changed;
        }
        return changed;
    },

    getCityQuestProgress() {
        if (typeof CityQuestMission !== 'undefined'
            && CityQuestMission
            && typeof CityQuestMission.getProgressRows === 'function') {
            return CityQuestMission.getProgressRows(this);
        }
        return [];
    },

    refreshCityQuestPanel() {
        if (typeof CityQuestMission !== 'undefined'
            && CityQuestMission
            && typeof CityQuestMission.renderPanel === 'function') {
            CityQuestMission.renderPanel(this);
        }
    },

    grantCityQuestReward(questKey, options = {}) {
        if (typeof CityQuestMission !== 'undefined'
            && CityQuestMission
            && typeof CityQuestMission.markLegacyQuest === 'function') {
            return CityQuestMission.markLegacyQuest(this, questKey, options);
        }
        return false;
    },

    claimCityQuest(questId, options = {}) {
        if (typeof CityQuestMission !== 'undefined'
            && CityQuestMission
            && typeof CityQuestMission.claimQuest === 'function') {
            return CityQuestMission.claimQuest(this, questId, options);
        }
        return false;
    },

    claimAllCityQuests(options = {}) {
        if (typeof CityQuestMission !== 'undefined'
            && CityQuestMission
            && typeof CityQuestMission.claimAllQuests === 'function') {
            return CityQuestMission.claimAllQuests(this, options);
        }
        return 0;
    },

    claimCityQuestReward(questKey, options = {}) {
        return this.claimCityQuest(questKey, options);
    },

    onQuestMissionEvent(eventType, payload = {}) {
        if (typeof CityQuestMission !== 'undefined'
            && CityQuestMission
            && typeof CityQuestMission.markEvent === 'function') {
            return CityQuestMission.markEvent(this, eventType, payload);
        }
        return false;
    },

    openCityFriends() {
        const authed = !!(
            typeof CitySimAuth !== 'undefined'
            && CitySimAuth
            && typeof CitySimAuth.isAuthenticated === 'function'
            && CitySimAuth.isAuthenticated()
        );
        const guest = !!(
            typeof CitySimAuth !== 'undefined'
            && CitySimAuth
            && typeof CitySimAuth.isGuestSession === 'function'
            && CitySimAuth.isGuestSession()
        );
        if (!authed && !guest) {
            if (typeof ui !== 'undefined' && ui && typeof ui.showToast === 'function') {
                ui.showToast('친구 기능은 로그인 후 이용할 수 있습니다.');
            }
            if (typeof CitySimAuth !== 'undefined' && CitySimAuth && typeof CitySimAuth.loginAndEnter === 'function') {
                CitySimAuth.loginAndEnter(this);
            }
            return;
        }
        CitySimChat.openFriends(this);
    },

    openCityInventory(forceOpen) {
        CitySimConstruction.openInventory(this, forceOpen);
    },

    openCityDecorMode() {
        CitySimMode.openDecorMode(this);
    },

    simulateLoading() {
        if (this._loadingIntervalId) return;
        const bar = document.getElementById('loading-bar');
        const text = document.getElementById('loading-text');
        const tipText = document.getElementById('loading-tip-text');
        let progress = 0;

        // TIP 목록
        const tips = [
            "초반에는 생산 건물 위주로 지어 자원을 확보하는 것이 좋습니다.",
            "병영을 먼저 건설하여 보병을 빠르게 생산하세요.",
            "연구소를 통해 기술을 업그레이드하면 전투력이 크게 향상됩니다.",
            "자원이 부족할 때는 공장과 보급소를 우선 건설하세요.",
            "적의 공격을 대비해 방어 시설을 미리 배치하는 것이 중요합니다.",
            "다양한 유닛을 조합하면 더 효과적인 전투가 가능합니다.",
            "맵마다 고유한 특성이 있으니 전략을 조정하세요.",
            "친구와 협력하여 더 강력한 기지를 건설할 수 있습니다."
        ];

        // 랜덤 TIP 선택
        const randomTip = tips[Math.floor(Math.random() * tips.length)];
        if (tipText) tipText.textContent = randomTip;

        this._loadingIntervalId = setInterval(() => {
            progress += Math.random() * 5;
            if (progress > 100) progress = 100;
            if (bar) bar.style.width = `${progress}%`;

            if (progress < 30) { if (text) text.innerText = (typeof Lang !== 'undefined') ? Lang.getText('loading_system') : "System Initializing..."; }
            else if (progress < 80) { if (text) text.innerText = (typeof Lang !== 'undefined') ? Lang.getText('loading_assets') : "Loading Data..."; }
            else { if (text) text.innerText = (typeof Lang !== 'undefined') ? Lang.getText('loading_complete') : "Ready."; }

            if (progress >= 100) {
                clearInterval(this._loadingIntervalId);
                this._loadingIntervalId = null;
                if (text) text.classList.remove('animate-pulse');
                // [변경] 로딩 끝나면 자동으로 완료
                setTimeout(() => {
                    this.completeLoading();
                }, 800); // 0.8초 지연 후 자동 진행
            }
        }, 30);
    },

    completeLoading() {
        if (this._loadingIntervalId) {
            clearInterval(this._loadingIntervalId);
            this._loadingIntervalId = null;
        }
        document.getElementById('loading-screen').classList.add('hidden');
        document.getElementById('lobby-screen').classList.remove('hidden');

        // [NEW] 로비 배경 초기화 및 시작
        if (typeof LobbyBackground !== 'undefined') {
            LobbyBackground.init();
            LobbyBackground.start();
        }

        // [New] Play Lobby BGM (BGM 1)
        if (typeof AudioSystem !== 'undefined') {
            AudioSystem.init();
            AudioSystem.playMP3(0);
        }
    },

    // ---- 캠페인 탭 헬퍼 ----
    _campaignTemplateFor(tab) {
        if (tab === 'skirmish') return CAMPAIGN_SKIRMISH_STAGES;
        if (tab === 'occupation') return CAMPAIGN_OCCUPATION_STAGES;
        return CAMPAIGN_SKIRMISH_STAGES;
    },

    _activeCampaign() {
        if (this.activeCampaignTab === 'skirmish') return this.campaignSkirmish;
        if (this.activeCampaignTab === 'occupation') return this.campaignOccupation;
        return this.campaignSkirmish;
    },

    _campaignDataForTab(tab) {
        if (tab === 'skirmish') return this.campaignSkirmish;
        if (tab === 'occupation') return this.campaignOccupation;
        return null;
    },

    _isCampaignTabFullyCleared(tab) {
        const data = this._campaignDataForTab(tab);
        if (!data || !Array.isArray(data.stages) || data.stages.length <= 0) return false;
        return data.stages.every((stage) => String(stage?.status || '') === 'cleared');
    },

    getActiveAuthUid() {
        try {
            if (typeof CitySimAuth !== 'undefined' && CitySimAuth && typeof CitySimAuth.getCurrentUser === 'function') {
                const user = CitySimAuth.getCurrentUser();
                if (user && user.uid) return String(user.uid);
            }
        } catch (_) { }
        try {
            if (typeof RECLAIM_FB !== 'undefined' && RECLAIM_FB && typeof RECLAIM_FB.getUser === 'function') {
                const user = RECLAIM_FB.getUser();
                if (user && user.uid) return String(user.uid);
            }
        } catch (_) { }
        return '';
    },

    isTemporaryAdminUnlockActive() {
        const unlockUid = String(this._tempAdminUnlockUid || '').trim();
        if (!unlockUid) return false;
        const currentUid = String(this.getActiveAuthUid() || '').trim();
        if (!currentUid) return false;
        return unlockUid === currentUid;
    },

    enableTemporaryAdminUnlockForUid(uid) {
        const targetUid = String(uid || '').trim();
        if (!targetUid) return false;
        this._tempAdminUnlockUid = targetUid;
        this.updateMapSelectLocks();
        this.updateCampaignTabLockUi();
        if (typeof this.renderCampaignMap === 'function') {
            try {
                const campaignScreen = document.getElementById('campaign-screen');
                if (campaignScreen && !campaignScreen.classList.contains('hidden')) {
                    this.renderCampaignMap();
                }
            } catch (_) { }
        }
        return true;
    },

    clearTemporaryAdminUnlock() {
        this._tempAdminUnlockUid = '';
        this.updateMapSelectLocks();
        this.updateCampaignTabLockUi();
    },

    isCampaignTabUnlocked(tab) {
        const target = String(tab || '').trim();
        if (this.devUnlockAllMaps === true || this.isTemporaryAdminUnlockActive()) return true;
        if (target === 'skirmish') return true;
        if (target === 'occupation') return true;
        if (target === 'custom') return true;
        return false;
    },

    updateCampaignTabLockUi() {
        const tabs = document.querySelectorAll('.campaign-tab-btn[data-tab]');
        tabs.forEach((btn) => {
            const tab = String(btn.dataset.tab || '').trim();
            const unlocked = this.isCampaignTabUnlocked(tab);
            btn.disabled = !unlocked;
            btn.classList.toggle('campaign-tab-locked', !unlocked);
            btn.setAttribute('aria-disabled', unlocked ? 'false' : 'true');
            if (tab === 'occupation') {
                btn.title = '점령전';
            } else if (tab === 'custom') {
                btn.title = '커스텀';
            } else {
                btn.title = '국지전';
            }
        });
    },

    _getCampaignSelectedStage(data) {
        if (!data || !Array.isArray(data.stages) || data.stages.length === 0) return null;
        const selectedId = Math.floor(Number(data.selectedStageId) || 0);
        if (selectedId > 0) {
            const selected = data.stages.find((stage) => stage.id === selectedId);
            if (selected) return selected;
        }
        return data.stages.find((stage) => stage.status === 'current') || data.stages[0] || null;
    },

    _centerCampaignViewOnStage(data, stage) {
        if (!data || !stage) return;
        const scale = Math.max(0.8, Math.min(2.5, Number(data.view?.scale) || 1.2));
        data.view = {
            ...data.view,
            scale: Math.round(scale * 100) / 100,
            x: Math.round(-stage.x * scale),
            y: Math.round(-stage.y * scale)
        };
    },

    _centerCampaignViewOnIsland(data) {
        if (!data) return;
        const scale = Math.max(0.8, Math.min(2.5, Number(data.view?.scale) || 1.2));
        data.view = {
            ...data.view,
            scale: Math.round(scale * 100) / 100,
            x: 0,
            y: 0
        };
    },

    switchCampaignTab(tab) {
        if (tab !== 'occupation' && tab !== 'skirmish' && tab !== 'custom') return;
        this.ensureCampaignProgress();
        if (!this.isCampaignTabUnlocked(tab)) {
            this.updateCampaignTabLockUi();
            return;
        }

        // 커스텀 탭: 커스텀 설정 화면 표시
        const customScreen = document.getElementById('custom-battle-screen');
        const campaignRoot = document.getElementById('campaign-map-root');
        if (tab === 'custom') {
            this.activeCampaignTab = tab;
            document.querySelectorAll('.campaign-tab-btn').forEach((btn) => {
                btn.classList.toggle('active', btn.dataset.tab === tab);
            });
            if (campaignRoot) campaignRoot.classList.add('hidden');
            const briefing = document.getElementById('campaign-briefing');
            if (briefing) briefing.classList.add('hidden');
            if (customScreen) {
                customScreen.classList.remove('hidden');
                this.renderCustomBattleScreen();
            }
            return;
        }

        // 국지전/점령전: 기존 캠페인 맵 표시
        if (customScreen) customScreen.classList.add('hidden');
        if (campaignRoot) campaignRoot.classList.remove('hidden');
        this.activeCampaignTab = tab;
        this.campaignBriefVisible = true;
        document.querySelectorAll('.campaign-tab-btn').forEach((btn) => {
            btn.classList.toggle('active', btn.dataset.tab === tab);
        });
        this.updateCampaignTabLockUi();
        const data = this._activeCampaign();
        const stage = this._getCampaignSelectedStage(data);
        if (stage) {
            data.selectedStageId = stage.id;
        }
        this._centerCampaignViewOnIsland(data);
        this.renderCampaignMap();
    },

    buildCampaignDefaultStages(tab) {
        const template = this._campaignTemplateFor(tab || this.activeCampaignTab);
        return template.map((stage, idx) => ({
            ...stage,
            status: idx === 0 ? 'current' : 'locked',
            stars: 0
        }));
    },

    normalizeCampaignStages(stagesInput, tab) {
        const base = this.buildCampaignDefaultStages(tab);
        if (!Array.isArray(stagesInput) || stagesInput.length === 0) return base;

        const savedMap = new Map();
        stagesInput.forEach((stage) => {
            const id = Math.floor(Number(stage?.id) || 0);
            if (id > 0) savedMap.set(id, stage || {});
        });

        const stages = base.map((stage) => {
            const saved = savedMap.get(stage.id) || {};
            const statusRaw = String(saved.status || stage.status);
            const status = (statusRaw === 'cleared' || statusRaw === 'current' || statusRaw === 'locked')
                ? statusRaw
                : 'locked';
            const stars = Math.max(0, Math.min(3, Math.floor(Number(saved.stars) || 0)));
            return {
                ...stage,
                status,
                stars
            };
        });

        let currentFound = false;
        stages.forEach((stage) => {
            if (stage.status === 'current') {
                if (currentFound) stage.status = 'locked';
                currentFound = true;
            }
        });

        if (!currentFound) {
            const next = stages.find((stage) => stage.status !== 'cleared');
            if (next) next.status = 'current';
        }

        return stages;
    },

    getCampaignThreatLevel(tab) {
        const data = tab === 'occupation' ? this.campaignOccupation
            : tab === 'skirmish' ? this.campaignSkirmish
            : this._activeCampaign();
        const cleared = Array.isArray(data.stages)
            ? data.stages.filter((stage) => stage.status === 'cleared').length
            : 0;
        return Math.max(1, Math.min(10, 1 + cleared));
    },

    _resolveBattleMapId(stage, tab) {
        const mapId = String(stage?.mapId || '').trim();
        const targetTab = String(tab || this.activeCampaignTab || '').trim();
        if (targetTab === 'skirmish') {
            const legacyByStageId = {
                101: 'skirmish_kabul',
                102: 'skirmish_desert'
            };
            const sid = Math.floor(Number(stage?.id) || 0);
            if (mapId) return mapId;
            const title = String(stage?.title || '').trim();
            if (title.includes('요새')) return 'fortress';
            if (title.includes('전초기지')) return 'forest';
            return legacyByStageId[sid] || 'skirmish';
        }
        return mapId || 'plain';
    },

    ensureCampaignProgress() {
        // 캠페인 정규화
        this.campaignOccupation.stages = this.normalizeCampaignStages(this.campaignOccupation.stages, 'occupation');
        this.campaignSkirmish.stages = this.normalizeCampaignStages(this.campaignSkirmish.stages, 'skirmish');

        if (!this.isCampaignTabUnlocked(this.activeCampaignTab)) {
            this.activeCampaignTab = 'skirmish';
        }

        for (const tab of ['occupation', 'skirmish']) {
            const data = tab === 'skirmish' ? this.campaignSkirmish
                : this.campaignOccupation;
            const current = data.stages.find((stage) => stage.status === 'current');
            const selectedId = Math.floor(Number(data.selectedStageId) || 0);
            const selectedExists = selectedId > 0 && data.stages.some((stage) => stage.id === selectedId);
            if (!selectedExists) {
                data.selectedStageId = current ? current.id : data.stages[0]?.id || null;
            }
        }

        // 하위 호환: 기존 코드가 참조하는 필드 동기화
        const active = this._activeCampaign();
        this.campaignStages = active.stages;
        this.campaignSelectedStageId = active.selectedStageId;
        this.campaignThreatLevel = this.getCampaignThreatLevel();
        this.campaignView = active.view;

        if (typeof AI !== 'undefined' && typeof AI.setDifficulty === 'function' && AI.difficulty !== 'elite') {
            AI.setDifficulty('elite');
        }
    },

    getCampaignStageById(stageId) {
        const id = Math.floor(Number(stageId) || 0);
        if (!id) return null;
        // 캠페인에서 검색
        const fromOccupation = Array.isArray(this.campaignOccupation.stages)
            ? this.campaignOccupation.stages.find((stage) => stage.id === id)
            : null;
        if (fromOccupation) return fromOccupation;
        const fromSkirmish = Array.isArray(this.campaignSkirmish.stages)
            ? this.campaignSkirmish.stages.find((stage) => stage.id === id)
            : null;
        return fromSkirmish || null;
    },

    _getCampaignStageIndex(data, stageId) {
        if (!data || !Array.isArray(data.stages) || data.stages.length === 0) return -1;
        const id = Math.floor(Number(stageId) || 0);
        if (!id) return -1;
        return data.stages.findIndex((stage) => Math.floor(Number(stage?.id) || 0) === id);
    },

    _getStageByIdInData(data, stageId) {
        if (!data || !Array.isArray(data.stages) || data.stages.length === 0) return null;
        const id = Math.floor(Number(stageId) || 0);
        if (!id) return null;
        return data.stages.find((stage) => Math.floor(Number(stage?.id) || 0) === id) || null;
    },

    _getCampaignMapLabel(mapId) {
        const id = String(mapId || '').trim();
        if (id === 'skirmish_kabul') return '카불 시가지';
        if (id === 'skirmish_desert') return '사막 도시 지대';
        if (id === 'skirmish') return '시가지 외곽';
        if (id === 'landing') return '해안 지대';
        if (id === 'plain') return '평원 지대';
        if (id === 'mountain') return '산악 지대';
        if (id === 'village') return '마을 지대';
        if (id === 'city') return '대도시 지대';
        if (id === 'forest') return '산림 지대';
        if (id === 'desert') return '사막 지대';
        if (id === 'fortress') return '요새 지대';
        return id || '-';
    },

    cycleCampaignStage(direction) {
        if (typeof GameCampaignMap !== 'undefined' && typeof GameCampaignMap.cycleCampaignStage === 'function') {
            return GameCampaignMap.cycleCampaignStage.call(this, direction);
        }
    },

    applyCampaignView() {
        if (typeof GameCampaignMap !== 'undefined' && typeof GameCampaignMap.applyCampaignView === 'function') {
            return GameCampaignMap.applyCampaignView.call(this);
        }
    },

    _resetCampaignDragState() {
        if (typeof GameCampaignMap !== 'undefined' && typeof GameCampaignMap._resetCampaignDragState === 'function') {
            return GameCampaignMap._resetCampaignDragState.call(this);
        }
    },

    bindCampaignEvents() {
        if (typeof GameCampaignMap !== 'undefined' && typeof GameCampaignMap.bindCampaignEvents === 'function') {
            return GameCampaignMap.bindCampaignEvents.call(this);
        }
    },

    renderCampaignMap() {
        if (typeof GameCampaignMap !== 'undefined' && typeof GameCampaignMap.renderCampaignMap === 'function') {
            return GameCampaignMap.renderCampaignMap.call(this);
        }
    },

    renderCampaignBriefing() {
        if (typeof GameCampaignMap !== 'undefined' && typeof GameCampaignMap.renderCampaignBriefing === 'function') {
            return GameCampaignMap.renderCampaignBriefing.call(this);
        }
    },

    selectCampaignStage(stageId) {
        if (typeof GameCampaignMap !== 'undefined' && typeof GameCampaignMap.selectCampaignStage === 'function') {
            return GameCampaignMap.selectCampaignStage.call(this, stageId);
        }
    },

    campaignZoom(delta) {
        if (typeof GameCampaignMap !== 'undefined' && typeof GameCampaignMap.campaignZoom === 'function') {
            return GameCampaignMap.campaignZoom.call(this, delta);
        }
    },

    startSelectedCampaignBattle() {
        if (typeof GameCampaignMap !== 'undefined' && typeof GameCampaignMap.startSelectedCampaignBattle === 'function') {
            return GameCampaignMap.startSelectedCampaignBattle.call(this);
        }
    },

    // ── 커스텀 전투 모드 ──────────────────────────────────
    _customMapId: null,
    _customAllySlots: [],
    _customEnemySlots: [],
    _customMode: false,

    renderCustomBattleScreen() {
        if (typeof GameCustomBattle !== 'undefined' && typeof GameCustomBattle.renderCustomBattleScreen === 'function') {
            return GameCustomBattle.renderCustomBattleScreen.call(this);
        }
    },

    selectCustomMap(mapId) {
        if (typeof GameCustomBattle !== 'undefined' && typeof GameCustomBattle.selectCustomMap === 'function') {
            return GameCustomBattle.selectCustomMap.call(this, mapId);
        }
        this._customMapId = mapId;
    },

    _customMapText(ko, en) {
        if (typeof GameCustomBattle !== 'undefined' && typeof GameCustomBattle._customMapText === 'function') {
            return GameCustomBattle._customMapText.call(this, ko, en);
        }
        if (typeof Lang !== 'undefined' && Lang && Lang.current === 'en') return en;
        return ko;
    },

    _getCustomMapRules(mapId) {
        if (typeof GameCustomBattle !== 'undefined' && typeof GameCustomBattle._getCustomMapRules === 'function') {
            return GameCustomBattle._getCustomMapRules.call(this, mapId);
        }
        const mapRulesObj = (typeof Maps !== 'undefined' && Maps && Maps.rules && typeof Maps.rules === 'object') ? Maps.rules : {};
        const mapRules = (mapRulesObj[mapId] && typeof mapRulesObj[mapId] === 'object') ? mapRulesObj[mapId] : {};
        return {
            playerHQ: true,
            enemyHQ: true,
            playerDefense: true,
            enemyDefense: true,
            bunkers: true,
            mapExpand: false,
            winCondition: 'hq_destroy',
            survivalTime: 600,
            ...mapRules
        };
    },

    _getCustomMapTerrainLabel(mapId) {
        if (typeof GameCustomBattle !== 'undefined' && typeof GameCustomBattle._getCustomMapTerrainLabel === 'function') {
            return GameCustomBattle._getCustomMapTerrainLabel.call(this, mapId);
        }
        return this._customMapText('복합 지형', 'Mixed terrain');
    },

    _getCustomMapTraitLabel(mapId) {
        if (typeof GameCustomBattle !== 'undefined' && typeof GameCustomBattle._getCustomMapTraitLabel === 'function') {
            return GameCustomBattle._getCustomMapTraitLabel.call(this, mapId);
        }
        return this._customMapText('특성: 기본 전장 규칙이 적용됩니다.', 'Trait: default battlefield rules apply.');
    },

    _getCustomMapObjectiveLabel(rules) {
        if (typeof GameCustomBattle !== 'undefined' && typeof GameCustomBattle._getCustomMapObjectiveLabel === 'function') {
            return GameCustomBattle._getCustomMapObjectiveLabel.call(this, rules);
        }
        return this._customMapText('적 전멸', 'Eliminate enemy forces');
    },

    _getCustomMapHqLabel(rules) {
        if (typeof GameCustomBattle !== 'undefined' && typeof GameCustomBattle._getCustomMapHqLabel === 'function') {
            return GameCustomBattle._getCustomMapHqLabel.call(this, rules);
        }
        return this._customMapText('본부 없음', 'No HQ');
    },

    _getCustomMapDefenseLabel(rules) {
        if (typeof GameCustomBattle !== 'undefined' && typeof GameCustomBattle._getCustomMapDefenseLabel === 'function') {
            return GameCustomBattle._getCustomMapDefenseLabel.call(this, rules);
        }
        return this._customMapText('방어시설 없음', 'No fixed defenses');
    },

    _drawCustomMapPreviewFallback(ctx, w, h, mapData) {
        if (typeof GameCustomBattle !== 'undefined' && typeof GameCustomBattle._drawCustomMapPreviewFallback === 'function') {
            return GameCustomBattle._drawCustomMapPreviewFallback.call(this, ctx, w, h, mapData);
        }
    },

    _drawCustomMapProfileRows(mapId, rules) {
        if (typeof GameCustomBattle !== 'undefined' && typeof GameCustomBattle._drawCustomMapProfileRows === 'function') {
            return GameCustomBattle._drawCustomMapProfileRows.call(this, mapId, rules);
        }
    },

    _drawCustomMapPreviewMarkers(ctx, w, h, groundY, rules) {
        if (typeof GameCustomBattle !== 'undefined' && typeof GameCustomBattle._drawCustomMapPreviewMarkers === 'function') {
            return GameCustomBattle._drawCustomMapPreviewMarkers.call(this, ctx, w, h, groundY, rules);
        }
    },

    _updateCustomMapPreview() {
        if (typeof GameCustomBattle !== 'undefined' && typeof GameCustomBattle._updateCustomMapPreview === 'function') {
            return GameCustomBattle._updateCustomMapPreview.call(this);
        }
    },

    _getCustomUnitList() {
        if (typeof GameCustomBattle !== 'undefined' && typeof GameCustomBattle._getCustomUnitList === 'function') {
            return GameCustomBattle._getCustomUnitList.call(this);
        }
        const units = CONFIG.units || {};
        const result = [];
        const excludeCategories = ['special', 'civilian'];
        for (const [uid, udata] of Object.entries(units)) {
            if (excludeCategories.includes(udata.category)) continue;
            if (udata.disabled) continue;
            result.push({ id: uid, name: udata.name || uid, category: udata.category || 'unknown' });
        }
        return result;
    },

    _renderCustomSlots(team) {
        if (typeof GameCustomBattle !== 'undefined' && typeof GameCustomBattle._renderCustomSlots === 'function') {
            return GameCustomBattle._renderCustomSlots.call(this, team);
        }
    },

    addCustomSlot(team) {
        if (typeof GameCustomBattle !== 'undefined' && typeof GameCustomBattle.addCustomSlot === 'function') {
            return GameCustomBattle.addCustomSlot.call(this, team);
        }
        const slots = team === 'ally' ? this._customAllySlots : this._customEnemySlots;
        if (!Array.isArray(slots) || slots.length >= 10) return;
        slots.push({ unitId: 'infantry', count: 1 });
        if (typeof this._renderCustomSlots === 'function') this._renderCustomSlots(team);
    },

    removeCustomSlot(team, idx) {
        if (typeof GameCustomBattle !== 'undefined' && typeof GameCustomBattle.removeCustomSlot === 'function') {
            return GameCustomBattle.removeCustomSlot.call(this, team, idx);
        }
        const slots = team === 'ally' ? this._customAllySlots : this._customEnemySlots;
        if (!Array.isArray(slots) || slots.length <= 1) return;
        slots.splice(idx, 1);
        if (typeof this._renderCustomSlots === 'function') this._renderCustomSlots(team);
    },

    startCustomBattle() {
        if (typeof GameCustomBattle !== 'undefined' && typeof GameCustomBattle.startCustomBattle === 'function') {
            return GameCustomBattle.startCustomBattle.call(this);
        }
    },

    completeCampaignStage(stageId, didWin) {
        if (!didWin) return;
        // 커스텀 모드 보상 차단
        if (this._customMode) {
            this._customMode = false;
            return;
        }
        const stage = this.getCampaignStageById(stageId);
        if (!stage) return;

        // 해당 스테이지가 어느 캠페인에 속하는지 먼저 판별
        const id = stage.id;
        let targetData = null;
        let targetTab = '';
        if (this.campaignOccupation.stages.some((s) => s.id === id)) {
            targetData = this.campaignOccupation;
            targetTab = 'occupation';
        } else if (this.campaignSkirmish.stages.some((s) => s.id === id)) {
            targetData = this.campaignSkirmish;
            targetTab = 'skirmish';
        } else {
            targetTab = String(this.activeCampaignTab || '').trim().toLowerCase();
        }
        const isSkirmishStage = targetTab === 'skirmish';

        const firstClear = stage.status !== 'cleared';
        if (firstClear) {
            stage.status = 'cleared';
            stage.stars = Math.max(stage.stars || 0, Math.floor(Math.random() * 3) + 1);
        }

        // 보상금 지급 (첫 클리어 시)
        const rewardAmount = Number(stage.reward) || 0;
        let gotMoneyReward = false;
        if (firstClear && rewardAmount > 0 && typeof CitySimState !== 'undefined') {
            CitySimState.mutate(this, (draft) => {
                if (!draft.res || typeof draft.res !== 'object') draft.res = {};
                draft.res.money = Math.max(0, Number(draft.res.money) || 0) + rewardAmount;
            });
            gotMoneyReward = true;
        }

        // 스테이지 클리어 경험치 지급 (반복 클리어 포함)
        const hud = (this.citySim && this.citySim.hud && typeof this.citySim.hud === 'object') ? this.citySim.hud : null;
        const currentLevel = Math.max(1, Math.floor(Number(hud?.level) || 1));
        const currentExp = Math.max(0, Math.floor(Number(hud?.exp) || 0));
        let expResult = null;
        if (typeof CitySimEconomy !== 'undefined'
            && CitySimEconomy
            && typeof CitySimEconomy.getStageClearExpReward === 'function'
            && typeof CitySimEconomy.addExp === 'function') {
            const expMultiplier = isSkirmishStage ? 2 : 1;
            const expRewardBase = CitySimEconomy.getStageClearExpReward(stage, currentLevel, currentExp);
            const expReward = Math.max(0, Math.floor((Number(expRewardBase) || 0) * expMultiplier));
            if (expReward > 0) {
                expResult = CitySimEconomy.addExp(this, expReward, { render: false, save: false });
            }
        }

        if ((gotMoneyReward || expResult) && typeof this.renderCityResources === 'function') {
            this.renderCityResources();
        }

        if (typeof ui !== 'undefined' && typeof ui.showToast === 'function') {
            const messages = [];
            if (gotMoneyReward && rewardAmount > 0) {
                messages.push(`보상금 +${rewardAmount.toLocaleString('ko-KR')}원`);
            }
            if (expResult && expResult.addedExp > 0) {
                messages.push(`경험치 +${expResult.addedExp}`);
                if (expResult.levelsGained > 0) {
                    messages.push(`Lv.${expResult.level} 승급`);
                }
            }
            if (messages.length > 0) {
                ui.showToast(messages.join(' / '));
            }
        }

        if (typeof this.onQuestMissionEvent === 'function') {
            this.onQuestMissionEvent('win', {
                count: 1,
                mode: targetTab,
                mapId: stage.mapId || '',
                firstClear: firstClear === true
            });
        }

        if (firstClear && targetTab === 'skirmish' && typeof this.grantCityQuestReward === 'function') {
            this.grantCityQuestReward('skirmish_first_win_supply_box');
        }

        if (targetData) {
            const idx = targetData.stages.findIndex((item) => item.id === id);
            if (idx >= 0 && idx + 1 < targetData.stages.length) {
                const next = targetData.stages[idx + 1];
                if (next.status === 'locked') next.status = 'current';
            }
            targetData.stages = this.normalizeCampaignStages(targetData.stages, targetTab);
            const nextCurrent = targetData.stages.find((item) => item.status === 'current');
            if (nextCurrent) targetData.selectedStageId = nextCurrent.id;
        }

        this.campaignThreatLevel = this.getCampaignThreatLevel();
        if (typeof AI !== 'undefined' && typeof AI.setDifficulty === 'function' && AI.difficulty !== 'elite') {
            AI.setDifficulty('elite');
        }

        this.updateCampaignTabLockUi();

        if (typeof this.saveCitySimState === 'function') this.saveCitySimState();
        if (typeof app !== 'undefined' && app.markDirty) {
            app.markDirty();
            app.saveNow();
        }
    },

    openCampaignMap() {
        this.hideCityScreen();
        this.campaignBriefVisible = true;
        this._resetCampaignDragState();

        if (typeof LobbyBackground !== 'undefined') {
            LobbyBackground.stop();
        }

        document.getElementById('lobby-screen')?.classList.add('hidden');
        document.getElementById('difficulty-select-screen')?.classList.add('hidden');
        document.getElementById('map-select-screen')?.classList.add('hidden');
        document.getElementById('unitdex-screen')?.classList.add('hidden');
        document.getElementById('campaign-screen')?.classList.remove('hidden');
        this.playMapSelectBgm();

        this.bindCampaignEvents();
        this.activeCampaignTab = 'skirmish';
        this.ensureCampaignProgress();
        const data = this._activeCampaign();
        const stage = this._getCampaignSelectedStage(data);
        if (stage) {
            data.selectedStageId = stage.id;
        }
        this._centerCampaignViewOnIsland(data);
        this.renderCampaignMap();
    },

    playMapSelectBgm() {
        if (typeof AudioSystem === 'undefined' || !AudioSystem) return;
        const path = String(MAP_SELECT_BGM_FILE || '').trim();
        if (!path) return;
        try {
            if (typeof AudioSystem.init === 'function') AudioSystem.init();
            if (typeof AudioSystem.setBGMLock === 'function') AudioSystem.setBGMLock('');
            if (typeof AudioSystem.playBGMFile === 'function') {
                AudioSystem.playBGMFile(path);
            }
        } catch (_) { }
    },

    stopMapSelectBgm() {
        if (typeof AudioSystem === 'undefined' || !AudioSystem) return;
        const path = String(MAP_SELECT_BGM_FILE || '').trim();
        if (!path) return;
        try {
            const currentSrc = (AudioSystem.bgmEl && AudioSystem.bgmEl.dataset)
                ? String(AudioSystem.bgmEl.dataset.src || '')
                : '';
            if (currentSrc === path && typeof AudioSystem.stopBGM === 'function') {
                AudioSystem.stopBGM();
            }
        } catch (_) { }
    },

    closeCampaignMap() {
        document.getElementById('campaign-screen')?.classList.add('hidden');
    },

    openMapSelect(mode) {
        if (mode === 'online') {
            ui.showToast(Lang.getText('online_desc'));
            return;
        }
        this.openCampaignMap();
    },

    showMapSelect() {
        document.getElementById('loading-screen')?.classList.add('hidden');
        this.openCampaignMap();
    },

    syncDifficultyButtons() {
        const btns = document.querySelectorAll('.btn-diff');
        if (!btns.length) return;
        const diff = (typeof AI !== 'undefined' && AI.difficulty) ? AI.difficulty : null;
        const target = diff
            ? document.querySelector(`.btn-diff[data-diff="${diff}"]`)
            : document.querySelector('.btn-diff[data-diff="elite"]') || btns[0];
        if (target && typeof ui !== 'undefined' && typeof ui.updateDiffBtn === 'function') {
            ui.updateDiffBtn(target);
        } else if (target) {
            btns.forEach(b => b.classList.remove('active'));
            target.classList.add('active');
        }
    },

    openDifficultySelect() {
        this.openCampaignMap();
    },

    getUnlockedMapCount() {
        if (this.devUnlockAllMaps || this.isTemporaryAdminUnlockActive()) return (this.mapOrder || []).length;
        if (!this.firstRunDone) return 1;
        const order = this.mapOrder || [];
        const cleared = Array.isArray(this.clearedMaps) ? this.clearedMaps : [];
        let unlocked = 1;
        for (let i = 0; i < order.length; i++) {
            if (cleared.includes(order[i])) unlocked = i + 2;
            else break;
        }
        return Math.min(order.length, unlocked);
    },

    isMapUnlocked(mapId) {
        if (this.devUnlockAllMaps || this.isTemporaryAdminUnlockActive()) return true;
        const order = this.mapOrder || [];
        if (!order.includes(mapId)) return true;
        const unlockedCount = this.getUnlockedMapCount();
        const unlockedSet = new Set(order.slice(0, unlockedCount));
        return unlockedSet.has(mapId);
    },

    updateMapSelectLocks() {
        const order = this.mapOrder || [];
        const devUnlock = this.devUnlockAllMaps === true || this.isTemporaryAdminUnlockActive();
        const unlockedCount = devUnlock ? order.length : this.getUnlockedMapCount();
        const unlockedSet = new Set(order.slice(0, unlockedCount));
        const cards = document.querySelectorAll('.map-card[data-map]');
        cards.forEach(card => {
            const mapId = card.dataset.map;
            const unlocked = devUnlock || unlockedSet.has(mapId);
            card.classList.toggle('locked', !unlocked);
            if ('disabled' in card) card.disabled = !unlocked;
            card.setAttribute('aria-disabled', unlocked ? 'false' : 'true');
            const lock = card.querySelector('.map-lock');
            if (lock) lock.classList.toggle('hidden', unlocked);
        });
    },

    enableDevUnlockAllMaps() {
        if (this.devUnlockAllMaps) return;
        this.devUnlockAllMaps = true;
        this.updateMapSelectLocks();
        if (typeof ui !== 'undefined' && typeof ui.showToast === 'function') {
            ui.showToast('DEV: 모든 맵 해금');
        }
    },

    markMapCleared(mapId) {
        if (!mapId) return;
        if (!Array.isArray(this.clearedMaps)) this.clearedMaps = [];
        if (!this.clearedMaps.includes(mapId)) {
            this.clearedMaps.push(mapId);
            if (!this.firstRunDone) this.firstRunDone = true;
            if (typeof app !== 'undefined' && app.markDirty) app.markDirty();
            const screen = document.getElementById('map-select-screen');
            if (screen && !screen.classList.contains('hidden')) {
                this.updateMapSelectLocks();
            }
        }
    },

    resetCitySimForFreshStart() {
        if (typeof CitySimState === 'undefined') return;

        let defaults = null;
        if (typeof CitySimSave !== 'undefined' && typeof CitySimSave.getDefaults === 'function') {
            defaults = CitySimSave.getDefaults(this);
        }

        if (!defaults || typeof defaults !== 'object') {
            const cols = Math.max(1, Math.floor(Number(this.citySim?.cols) || CitySimState.DEFAULT_COLS || 24));
            const rows = Math.max(1, Math.floor(Number(this.citySim?.rows) || CitySimState.DEFAULT_ROWS || 14));
            const total = cols * rows;
            const grid = new Array(total).fill(null);
            defaults = CitySimState.createInitialState({ cols, rows, grid });
        }

        CitySimState.replace(this, defaults);
        CitySimState.clearPlacement(this);
        CitySimState.clearSelection(this);
        if (typeof this.recalcCityDerived === 'function') this.recalcCityDerived();
        if (typeof this.saveCitySimState === 'function') this.saveCitySimState();
    },

    resetCampaignProgressForFreshStart() {
        const defaultView = { x: 0, y: 0, scale: 1.2 };
        const makePack = (tab) => {
            const stages = this.buildCampaignDefaultStages(tab);
            return {
                stages,
                selectedStageId: stages[0]?.id || null,
                view: { ...defaultView }
            };
        };

        this.campaignOccupation = makePack('occupation');
        this.campaignSkirmish = makePack('skirmish');

        this.activeCampaignTab = 'skirmish';
        this.activeCampaignStageId = null;
        this.campaignBriefVisible = false;
        this.campaignThreatLevel = 1;
        this.campaignView = { ...defaultView };
        this.campaignStages = this.campaignSkirmish.stages;
        this.campaignSelectedStageId = this.campaignSkirmish.selectedStageId;
    },

    resetProgress() {
        this.clearedMaps = [];
        this.firstRunDone = false;
        this.currentMapId = 'city';
        this.devUnlockAllMaps = false;
        this._tempAdminUnlockUid = '';
        if (typeof CityQuestMission !== 'undefined' && CityQuestMission && typeof CityQuestMission.reset === 'function') {
            CityQuestMission.reset(this);
        } else {
            this.cityQuestMission = null;
        }
        this.resetCampaignProgressForFreshStart();
        this.resetCitySimForFreshStart();
        this.refreshCityQuestPanel();
        if (typeof app !== 'undefined') {
            app.markDirty();
            app.saveNow();
        }
        const screen = document.getElementById('map-select-screen');
        if (screen && !screen.classList.contains('hidden')) {
            this.updateMapSelectLocks();
        }
    },

    _forceHideBattleUI() {
        const hideIds = [
            'hud-minimap-container',
            'hud-minimap-toggle',
            'hud-ctrl-wrapper',
            'hud-camera-btn',
            'hud-option-btn',
            'unit-panel-container',
            'hud-footer',
            'unit-cmd-wrapper',
            'unit-cmd-panel',
            'unit-info-panel',
            'targeting-overlay',
            'hud-timer-container',
            'map-modal',
            'scope-modal',
            'mission-objective-modal',
            'chat-panel',
            'chat-hq-open-btn',
            'spawn-indicator',
            'skirmish-placement-ui',
            'skirmish-countdown',
            'news-intro-widget',
            'news-widget'
        ];
        hideIds.forEach((id) => {
            const el = document.getElementById(id);
            if (el) el.classList.add('hidden');
        });

        const optionModal = document.getElementById('option-modal');
        if (optionModal) optionModal.classList.remove('active');
        const exitModal = document.getElementById('exit-modal');
        if (exitModal) exitModal.classList.add('hidden');
        const endScreen = document.getElementById('end-screen');
        if (endScreen) {
            endScreen.classList.add('hidden');
            endScreen.style.display = 'none';
        }
        if (this.$hudTimerContainer) this.$hudTimerContainer.classList.add('hidden');

        if (typeof HUD !== 'undefined') HUD.hide();
        if (typeof NewsIntro !== 'undefined') NewsIntro.hide();
        if (typeof NewsOverlay !== 'undefined') NewsOverlay.hide();

        // Safety: clean up any leftover skirmish zone hint node from older sessions.
        document.querySelectorAll('.skirmish-placement-zone-hint').forEach((el) => {
            if (el && el.parentNode) el.parentNode.removeChild(el);
        });
    },

    _forceShowBattleViewport() {
        const hideIds = [
            'boot-gate',
            'loading-screen',
            'cinematic-modal',
            'portrait-overlay',
            'lobby-screen',
            'difficulty-select-screen',
            'map-select-screen',
            'campaign-screen',
            'unitdex-screen',
            'city-screen',
            'end-screen',
            'exit-modal',
            'mission-objective-modal',
            'news-intro-widget',
            'news-widget'
        ];
        hideIds.forEach((id) => {
            const el = document.getElementById(id);
            if (el) el.classList.add('hidden');
        });

        const endScreen = document.getElementById('end-screen');
        if (endScreen) endScreen.style.display = 'none';

        const optionModal = document.getElementById('option-modal');
        if (optionModal) optionModal.classList.remove('active');

        const canvas = this.canvas || document.getElementById('game-canvas');
        if (canvas) {
            canvas.classList.remove('hidden');
            canvas.style.display = 'block';
            canvas.style.opacity = '1';
        }

        if (typeof Cinematic !== 'undefined' && Cinematic && typeof Cinematic.stop === 'function') {
            try { Cinematic.stop('battle_start'); } catch (_) { }
        }
    },

    _cleanupSkirmishSession() {
        if (this._skirmishMode && typeof SkirmishMode !== 'undefined' && typeof SkirmishMode.cleanup === 'function') {
            try {
                SkirmishMode.cleanup();
            } catch (err) {
                console.warn('[Skirmish] cleanup failed:', err);
            }
        }
        this._skirmishMode = false;
        this._skirmishData = null;
    },

    _isElementVisible(id) {
        const el = document.getElementById(id);
        if (!el) return false;
        if (el.classList.contains('hidden')) return false;
        const cs = window.getComputedStyle(el);
        if (!cs) return false;
        if (cs.display === 'none' || cs.visibility === 'hidden') return false;
        return Number(cs.opacity || '1') > 0;
    },

    _startUiRecoveryWatchdog() {
        if (this._uiRecoveryTimer) return;
        this._uiRecoveryTimer = setInterval(() => {
            const suspendUntil = Number(this._uiRecoverySuspendUntil) || 0;
            if (Date.now() < suspendUntil) return;
            if (document.hidden) {
                this._uiBlankTicks = 0;
                return;
            }

            if (this.isGameOver) {
                const endScreen = document.getElementById('end-screen');
                if (endScreen) {
                    endScreen.classList.remove('hidden');
                    endScreen.style.display = 'flex';
                }
                this._uiBlankTicks = 0;
                return;
            }

            // Keep exit confirmation modal visible during battle until player explicitly confirms/cancels.
            const blockerIds = ['boot-gate', 'loading-screen', 'cinematic-modal', 'portrait-overlay', 'end-screen'];

            if (this.running) {
                this._uiBlankTicks = 0;
                blockerIds.forEach((id) => {
                    const el = document.getElementById(id);
                    if (!el) return;
                    if (id === 'end-screen') {
                        if (this.isGameOver) {
                            el.classList.remove('hidden');
                            el.style.display = 'flex';
                            return;
                        }
                        el.classList.add('hidden');
                        el.style.display = 'none';
                    } else {
                        el.classList.add('hidden');
                    }
                });
                return;
            }

            const stageIds = [
                'boot-gate',
                'loading-screen',
                'cinematic-modal',
                'lobby-screen',
                'difficulty-select-screen',
                'map-select-screen',
                'campaign-screen',
                'city-screen',
                'unitdex-screen',
                'end-screen',
                'exit-modal',
                'portrait-overlay'
            ];
            const anyVisible = stageIds.some((id) => this._isElementVisible(id));
            if (anyVisible) {
                this._uiBlankTicks = 0;
                return;
            }

            this._uiBlankTicks = (Number(this._uiBlankTicks) || 0) + 1;
            if (this._uiBlankTicks < 6) return;
            this._uiBlankTicks = 0;

            console.warn('[UIRecovery] Blank screen detected for 4s. Restoring lobby.');
            this._forceHideBattleUI();
            document.getElementById('boot-gate')?.classList.add('hidden');
            document.getElementById('loading-screen')?.classList.add('hidden');
            document.getElementById('cinematic-modal')?.classList.add('hidden');
            document.getElementById('lobby-screen')?.classList.remove('hidden');
            if (typeof LobbyBackground !== 'undefined') {
                if (typeof LobbyBackground.init === 'function') LobbyBackground.init();
                if (typeof LobbyBackground.start === 'function') LobbyBackground.start();
            }
        }, 700);
    },

    retreatToCity() {
        this.running = false;
        this.isGameOver = false;
        if (this.loopId) {
            cancelAnimationFrame(this.loopId);
            this.loopId = null;
        }

        if (typeof this._cleanupTimers === 'function') {
            this._cleanupTimers();
        }
        if (typeof this.cancelTargeting === 'function') {
            this.cancelTargeting();
        }
        this._cleanupSkirmishSession();
        this._forceHideBattleUI();

        document.getElementById('lobby-screen')?.classList.add('hidden');
        document.getElementById('difficulty-select-screen')?.classList.add('hidden');
        document.getElementById('map-select-screen')?.classList.add('hidden');
        document.getElementById('campaign-screen')?.classList.add('hidden');
        document.getElementById('unitdex-screen')?.classList.add('hidden');

        if (typeof this.saveCitySimState === 'function') {
            this.saveCitySimState();
        }
        if (typeof app !== 'undefined' && app && typeof app.saveNow === 'function') {
            app.saveNow();
        }

        if (typeof AudioSystem !== 'undefined' && typeof AudioSystem.stopIcbmRaise === 'function') {
            AudioSystem.stopIcbmRaise(true);
        }

        this.enterCityScreen();
        try {
            history.replaceState({ page: 'city' }, "City", "#city");
        } catch (_) { }
    },

    backToLobby() {
        this.running = false;
        this.isGameOver = false;
        this._uiRecoverySuspendUntil = Date.now() + 1500;

        if (this.loopId) {
            cancelAnimationFrame(this.loopId);
            this.loopId = null;
        }

        if (typeof this._cleanupTimers === 'function') {
            try { this._cleanupTimers(); } catch (err) { console.warn('[backToLobby] timer cleanup failed:', err); }
        }

        if (typeof this.saveCitySimState === 'function') {
            try { this.saveCitySimState(); } catch (err) { console.warn('[backToLobby] city save failed:', err); }
        }
        if (typeof app !== 'undefined' && app && typeof app.saveNow === 'function') {
            try { app.saveNow(); } catch (err) { console.warn('[backToLobby] app save failed:', err); }
        }

        try { this._cleanupSkirmishSession(); } catch (err) { console.warn('[backToLobby] skirmish cleanup failed:', err); }
        try { this._forceHideBattleUI(); } catch (err) { console.warn('[backToLobby] battle ui cleanup failed:', err); }

        document.getElementById('map-select-screen')?.classList.add('hidden');
        document.getElementById('difficulty-select-screen')?.classList.add('hidden');
        document.getElementById('campaign-screen')?.classList.add('hidden');
        document.getElementById('unitdex-screen')?.classList.add('hidden');
        try { this.hideCityScreen(); } catch (err) { console.warn('[backToLobby] hideCityScreen failed:', err); }
        document.getElementById('unit-cmd-wrapper')?.classList.add('hidden');
        document.getElementById('unit-cmd-panel')?.classList.add('hidden');

        // [FIX] 로비로 복귀
        document.getElementById('lobby-screen')?.classList.remove('hidden');

        // [NEW] 로비 배경 재시작
        if (typeof LobbyBackground !== 'undefined') {
            LobbyBackground.start();
        }

        // Switch back to Lobby BGM
        if (typeof AudioSystem !== 'undefined') {
            if (typeof AudioSystem.stopIcbmRaise === 'function') AudioSystem.stopIcbmRaise(true);
            AudioSystem.playMP3(0);
        }
    },

    // [R 2.2] 유닛 도감 열기
    openUnitDex() {
        // [NEW] 로비 배경 정지
        if (typeof LobbyBackground !== 'undefined') {
            LobbyBackground.stop();
        }

        document.getElementById('lobby-screen').classList.add('hidden');
        document.getElementById('unitdex-screen').classList.remove('hidden');
        if (typeof UnitDex !== 'undefined') UnitDex.render();
    },

    // [R 2.2] 유닛 도감 닫기
    closeUnitDex() {
        document.getElementById('unitdex-screen').classList.add('hidden');
        document.getElementById('lobby-screen').classList.remove('hidden');

        // [NEW] 로비 배경 재시작
        if (typeof LobbyBackground !== 'undefined') {
            LobbyBackground.start();
        }
    },

    startGame(mapType, options = {}) {
        this.stopMapSelectBgm();
        this._skirmishObjectiveWatchtowerWasPresent = false;
        this._skirmishObjectiveHintShown = false;
        const opts = (options && typeof options === 'object') ? options : {};
        const campaignMode = String(opts.campaignMode || '').trim().toLowerCase();
        const isCampaignStageStart = Number.isFinite(Number(opts.campaignStageId))
            && Math.floor(Number(opts.campaignStageId)) > 0;
        this.ensureCampaignProgress();
        this.ensureMapsReady();
        this.enforceCriticalMapThemes();
        this._uiRecoverySuspendUntil = Date.now() + 12000;
        this._campaignBattleTab = (
            isCampaignStageStart
            && (campaignMode === 'occupation' || campaignMode === 'skirmish')
        )
            ? campaignMode
            : '';

        if (Number.isFinite(Number(opts.campaignStageId))) {
            this.activeCampaignStageId = Math.floor(Number(opts.campaignStageId));
        } else {
            this.activeCampaignStageId = null;
        }

        if (Number.isFinite(Number(opts.threatLevel))) {
            const threat = Math.floor(Number(opts.threatLevel));
            this.campaignThreatLevel = Math.max(1, Math.min(10, threat));
        } else {
            this.campaignThreatLevel = this.getCampaignThreatLevel();
        }

        const nextMap = mapType || 'plain';
        // Campaign stages own their unlock flow (current/locked in campaign data),
        // so do not apply generic map-select lock rules here.
        if (!isCampaignStageStart && !this.isMapUnlocked(nextMap)) {
            if (typeof ui !== 'undefined') ui.showToast('LOCKED');
            this.updateMapSelectLocks();
            return;
        }
        const mapApi = (typeof Maps !== 'undefined' && Maps)
            ? Maps
            : ((typeof window !== 'undefined' && window.Maps) ? window.Maps : null);
        if (!mapApi) {
            console.error('[GameStart] Maps API is unavailable.');
            if (typeof ui !== 'undefined' && typeof ui.showToast === 'function') {
                ui.showToast('맵 시스템 로드 실패. 새로고침 후 다시 시도하세요.');
            }
            return;
        }

        document.getElementById('campaign-screen')?.classList.add('hidden');
        document.getElementById('map-select-screen')?.classList.add('hidden');
        mapApi.currentMap = nextMap;

        // [NEW] 맵 규칙에 따른 옵션 자동 설정
        const skirmishBattle = !!opts.skirmish;
        const mapExpand = skirmishBattle
            ? false
            : ((typeof mapApi.getRule === 'function') ? mapApi.getRule('mapExpand') : false);
        const hasPlayerDefense = skirmishBattle
            ? false
            : ((typeof mapApi.getRule === 'function') ? mapApi.getRule('playerDefense') : true);
        const optDefense = document.getElementById('opt-forward-defense');
        if (!this.settings || typeof this.settings !== 'object') {
            this.settings = { includeForwardDefense: false };
        }

        // 방어시설 옵션: 맵에서 허용되면 적용 (옵션 없으면 맵 규칙에 따름)
        const hasEnemyDefense = skirmishBattle
            ? false
            : ((typeof mapApi.getRule === 'function') ? mapApi.getRule('enemyDefense') : true);
        const forceDefense = !optDefense && (hasPlayerDefense || hasEnemyDefense);
        this.settings.includeForwardDefense = (hasPlayerDefense || hasEnemyDefense)
            && (optDefense ? !!optDefense.checked : forceDefense);

        // [NEW] 맵 가로폭 동적 확장 (맵 규칙 또는 방어시설 옵션에 따라)
        const baseW = CONFIG.baseMapWidth || CONFIG.mapWidth || 6000;
        let extraW = 0;
        if (mapExpand) {
            extraW = CONFIG.defenseExtraWidth || 1500; // 맵 규칙에 의한 확장
        } else if (this.settings.includeForwardDefense) {
            extraW = CONFIG.defenseExtraWidth || 0; // 방어시설 옵션에 의한 확장
        }
        CONFIG.mapWidth = baseW + extraW;

        // [NEW] 마지막 선택 맵 저장
        this.currentMapId = nextMap;

        // 국지전 모드 설정
        this._skirmishMode = !!opts.skirmish;
        this._skirmishData = opts.skirmishData || null;

        try {
            if (typeof CitySimDrillgroundBubbles !== 'undefined'
                && CitySimDrillgroundBubbles
                && typeof CitySimDrillgroundBubbles.queueBattleEvent === 'function') {
                CitySimDrillgroundBubbles.queueBattleEvent(this, 'battle_pre', { immediate: true });
            }
        } catch (err) {
            console.warn('[startGame] drillground bubble pre-event queue failed:', err);
        }

        this.start();
    },

    // [핵심] 흔들림 없는 리사이즈 로직
    resize() {
        const wrapper = document.getElementById('game-wrapper');
        const vv = window.visualViewport || null;
        const winW = (vv && Number.isFinite(vv.width) && vv.width > 0) ? vv.width : window.innerWidth;
        const winH = (vv && Number.isFinite(vv.height) && vv.height > 0) ? vv.height : window.innerHeight;
        const prevViewW = Camera.viewW(this);

        // 1. 배율 계산 (세로 높이를 720px에 맞춤)
        // 화면이 작으면 알아서 축소(Zoom Out)되고, 크면 확대됩니다.
        this.scaleRatio = winH / LOGICAL_HEIGHT;

        // 2. 가로 길이 계산 (화면 비율에 따라 유동적으로 넓어짐)
        // 예: 가로 모드면 width가 1400px 이상으로 늘어나서 PC처럼 보임
        this.width = winW / this.scaleRatio;
        this.height = LOGICAL_HEIGHT; // 높이는 무조건 720 고정!

        // 3. 캔버스 크기 적용
        this.canvas.width = this.width;
        this.canvas.height = this.height;

        // 4. 땅 높이 계산
        // 맵별로 지면 오프셋을 적용한다. (예: 해안 상륙은 유닛을 조금 더 아래로)
        const activeMapId = (typeof Maps !== 'undefined' && Maps && typeof Maps.currentMap === 'string')
            ? Maps.currentMap
            : '';
        const mapGroundOffset = (activeMapId === 'landing') ? 24 : 0;
        this.groundY = this.height - CONFIG.groundHeight + mapGroundOffset;

        // 5. CSS 스타일 적용 (화면 꽉 채우기)
        if (wrapper) {
            wrapper.style.width = `${winW}px`;
            wrapper.style.height = `${winH}px`;
            // wrapper 자체를 scale로 줄이거나 늘려서 딱 맞춤
            // transform 대신 캔버스 내부 해상도를 조절했으므로 여기선 크기만 맞춤
            wrapper.style.transform = 'none';

            // 캔버스 스타일 강제 지정 (중요)
            this.canvas.style.width = '100%';
            this.canvas.style.height = '100%';
        }

        Camera.preserveCenterOnResize(this, prevViewW);

        // [NEW] 모바일 자동 줌인: 사용자가 수동 줌하지 않았고, 터치 디바이스면 자동 줌 적용
        const isMobile = window.matchMedia('(pointer: coarse)').matches;
        if (isMobile && !Camera.userZoomed) {
            // 목표 뷰 너비: 1200px (적당한 시야)
            const targetViewW = 1200;
            const autoZoom = Math.min(Camera.MAX, Math.max(Camera.MIN, this.width / targetViewW));
            if (Math.abs(Camera.zoom - autoZoom) > 0.01) {
                Camera.zoom = autoZoom;
                this.cameraX = Camera.clampCameraX(this, this.cameraX);
            }
        }
    },

    initGameObjects() {
        // 아군 시작 보유 수량은 난이도와 무관하게 동일하게 유지한다.
        const stockMult = 1.0;
        const threatLevel = Math.max(1, Math.min(10, Math.floor(Number(this.campaignThreatLevel) || 1)));
        const campaignTab = String(this._campaignBattleTab || '').trim().toLowerCase();
        const isOccupationBattle = campaignTab === 'occupation';
        const stageId = Math.floor(Number(this.activeCampaignStageId) || 0);
        const isOccupationFinalStage = isOccupationBattle && stageId === 7;
        const isOccupationEarlyStage = isOccupationBattle && stageId > 0 && stageId <= 2;
        const enemyBaseMult = isOccupationBattle
            ? (isOccupationFinalStage ? 1.45 : (isOccupationEarlyStage ? 0.92 : 1.1))
            : 1.5;
        const enemyThreatStep = isOccupationBattle
            ? (isOccupationFinalStage ? 0.10 : (isOccupationEarlyStage ? 0.035 : 0.06))
            : 0.1;
        const enemyThreatMult = 1 + ((threatLevel - 1) * enemyThreatStep);
        const occupationMinStock = isOccupationBattle
            ? (
                stageId === 1
                    ? {
                        infantry: 12,
                        engineer: 4,
                        humvee: 4,
                        apc: 2,
                        mbt: 2,
                        spg: 1,
                        aa_tank: 1,
                        fighter: 0,
                        apache: 1,
                        bomber: 0,
                        drone_operator: 2
                    }
                    : (stageId === 2
                        ? {
                            infantry: 14,
                            engineer: 5,
                            humvee: 5,
                            apc: 3,
                            mbt: 4,
                            spg: 2,
                            aa_tank: 2,
                            fighter: 1,
                            apache: 1,
                            bomber: 0,
                            drone_operator: 3
                        }
                        : {
                            infantry: 20,
                            engineer: 8,
                            humvee: 8,
                            apc: 6,
                            mbt: 8,
                            spg: 4,
                            aa_tank: 4,
                            fighter: 3,
                            apache: 3,
                            bomber: 2,
                            drone_operator: 5
                        }
                    )
            )
            : null;
        const occupationFinalMinStock = isOccupationFinalStage
            ? {
                infantry: 40,
                engineer: 14,
                humvee: 14,
                apc: 12,
                mbt: 16,
                spg: 10,
                aa_tank: 9,
                fighter: 8,
                apache: 8,
                bomber: 6,
                drone_operator: 14
            }
            : null;

        for (let k in CONFIG.units) {
            this.cooldowns[k] = 0; this.enemyCooldowns[k] = 0;
            const isDroneKey = k.includes('drone');

            // [SPECIAL] 스텔스드론: 아군/적군 모두 5기 고정
            if (k === 'stealth_drone') {
                const fixedCount = Math.ceil(5 * 1.1);
                this.playerStock[k] = fixedCount;
                this.enemyStock[k] = fixedCount;
                this.spawnQueue[k] = 0;
                continue;
            }

            // [ICBM] 플레이어/적군 분리: 아군 icbm 2기, 적군 icbm_enemy 2기
            if (k === 'icbm') {
                this.playerStock[k] = 2;
                this.enemyStock[k] = 0;
                this.spawnQueue[k] = 0;
                continue;
            }
            if (k === 'icbm_enemy') {
                this.playerStock[k] = 0;
                this.enemyStock[k] = 2;
                this.spawnQueue[k] = 0;
                continue;
            }

            // Apply Multiplier
            let finalCount = Math.ceil(CONFIG.units[k].maxCount * stockMult);

            // [3.8] 작업자는 항상 최대 1명 고정 (난이도 보정 무시)
            if (k === 'worker') {
                finalCount = 1;
            }

            if (isDroneKey) {
                finalCount = Math.ceil(finalCount * 1.1);
            }

            this.playerStock[k] = finalCount;
            let enemyCount = Math.ceil(CONFIG.units[k].maxCount * enemyBaseMult);
            if (this.isEnemySpawnBlockedUnit(k)) {
                enemyCount = 0;
            } else {
                if (k === 'drone_suicide' || k === 'drone_at') {
                    enemyCount = Math.ceil(enemyCount * 0.5);
                }
                if (isDroneKey) {
                    enemyCount = Math.ceil(enemyCount * 1.1);
                }
                enemyCount = Math.ceil(enemyCount * enemyThreatMult);
                if (occupationFinalMinStock && Object.prototype.hasOwnProperty.call(occupationFinalMinStock, k)) {
                    enemyCount = Math.max(enemyCount, occupationFinalMinStock[k]);
                } else if (occupationMinStock && Object.prototype.hasOwnProperty.call(occupationMinStock, k)) {
                    enemyCount = Math.max(enemyCount, occupationMinStock[k]);
                }
            }
            this.enemyStock[k] = enemyCount;
            this.spawnQueue[k] = 0;
        }

        this.totalWarTriggered = false; // Reset Total War
        this._enemyHQWasPresent = false;
        this.cityArmorNewsShown = false;
        this.cityMidNewsShown = false;
        this.cityTotalWarNewsShown = false;
        this.cityNukePanicPlayed = false;

        // [NEW] 공습경보 상태 초기화
        this.airRaidWarning = null;
    },

    // [NEW] 적군 총력전 (Total War) 트리거
    triggerTotalWar() {
        if (this.totalWarTriggered || !this.running) return;
        this.totalWarTriggered = true;

        // [R 4.2] 스폰 금지 유닛 리스트
        const BLOCKED_UNITS = ['tactical_drone', 'stealth_drone', 'drone_suicide', 'drone_at'];

        const enemyHQ = this.buildings.find(b => b.type === 'hq_enemy' && !b.dead);
        const spawnX = enemyHQ ? enemyHQ.x : CONFIG.mapWidth;
        const aliveNow = Array.isArray(this.enemies)
            ? this.enemies.reduce((n, u) => n + ((u && !u.dead) ? 1 : 0), 0)
            : 0;
        let safeCap = 24;
        if (typeof AI !== 'undefined' && AI && typeof AI._getGlobalAliveCap === 'function') {
            try {
                safeCap = Math.max(1, Math.floor(Number(AI._getGlobalAliveCap(this.frame || 0)) || safeCap));
            } catch (e) { }
        }
        let budgetLeft = Math.max(0, safeCap - aliveNow);
        if (budgetLeft <= 0) return;

        let delayCount = 0;

        for (let key in this.enemyStock) {
            if (budgetLeft <= 0) break;
            // [R 4.2] disabled 유닛 및 BLOCKED_UNITS 스킵
            const unitDef = CONFIG.units[key];
            if (!unitDef) continue;
            if (this.isEnemySpawnBlockedUnit(key)) continue;
            if (BLOCKED_UNITS.includes(key)) continue;

            const count = Math.max(0, Math.floor(Number(this.enemyStock[key]) || 0));
            if (count <= 0) continue;
            const spawnCount = Math.min(count, budgetLeft);

            for (let i = 0; i < spawnCount; i++) {
                const trySpawn = () => {
                    if (!this.running) return;
                    if (this.paused) {
                        setTimeout(trySpawn, 180);
                        return;
                    }
                    const aliveNow2 = Array.isArray(this.enemies)
                        ? this.enemies.reduce((n, u) => n + ((u && !u.dead) ? 1 : 0), 0)
                        : 0;
                    if (aliveNow2 >= safeCap) return;
                    this.spawnUnitDirect(key, spawnX - 50 + (Math.random() * 60 - 30), this.groundY, 'enemy');
                };
                setTimeout(trySpawn, delayCount * 180);
                delayCount++;
            }
            this.enemyStock[key] = Math.max(0, count - spawnCount);
            budgetLeft -= spawnCount;
        }
    },

    isEnemySpawnBlockedUnit(key) {
        const unitDef = (CONFIG && CONFIG.units) ? CONFIG.units[key] : null;
        if (!unitDef) return true;
        if (unitDef.disabled === true) return true;

        const unitType = String(unitDef.type || '').trim().toLowerCase();
        const unitCategory = String(unitDef.category || '').trim().toLowerCase();
        if (unitType === 'civilian' || unitCategory === 'civilian') return true;
        if (unitDef.isBuilder === true || unitDef.isCameraman === true) return true;

        // B-03: 점령전 적군 스폰 풀 정리 (비전투 유틸 유닛 제외)
        if (key === 'worker' || key === 'recon' || key === 'cameraman') return true;
        return false;
    },

    start() {
        if (this.loopId) {
            cancelAnimationFrame(this.loopId);
            this.loopId = null;
        }
        this._forceShowBattleViewport();

        // [FIX] ID 수정: start-screen은 존재하지 않으므로 loading-screen을 숨김
        document.getElementById('loading-screen')?.classList.add('hidden');
        document.getElementById('lobby-screen')?.classList.add('hidden');
        document.getElementById('end-screen').classList.add('hidden');

        // [New] Push history state when game starts
        history.pushState({ page: 'game' }, "Game", "#game");

        this.players = []; this.enemies = []; this.civilians = []; this.projectiles = []; this.particles = [];
        this.buildings = []; this.wreckages = []; this.corpses = [];
        this.corpseSpawnQueue = []; this.corpseSpawnQueueHead = 0;
        this.supply = CONFIG.startSupply; this.enemySupply = CONFIG.startSupply;
        this.empTimer = 0;
        this.skillCharges = { emp: 5, nuke: 1, tactical: 5 };
        this.killCount = 0;
        this.isGameOver = false;
        this.enemyEverSeen = false;
        this.playerEverSeen = false;
        this.watchtowerBuilt = false;  // [3.8] 감시탑 1회 건설 제한 초기화
        this.civilianDeaths = 0;
        this.airRaidTriggered = false;
        this.civilianEvacActive = false;
        this.civilianEvacX = null;
        this.civilianGlobalPanic = 0;
        this.cameramanDisabled = false;
        this._activeCameraman = null;
        this.newsCameraX = null;
        this.cameraLockActive = false;
        this.cameraLockTarget = null;
        this.paused = false;
        if (typeof this.clearAllSelection === 'function') {
            this.clearAllSelection();
        } else if (this.selectedUnits && typeof this.selectedUnits.clear === 'function') {
            this.selectedUnits.clear();
        }
        this.selectedBuilding = null;
        if (this.airRaidBomberTimeout) {
            clearTimeout(this.airRaidBomberTimeout);
            this.airRaidBomberTimeout = null;
        }
        if (typeof AudioSystem !== 'undefined') {
            AudioSystem.panicMuted = false;
        }
        this.frame = 0;
        this._lastTimerText = null;
        if (this.$hudTimerContainer) {
            this.$hudTimerContainer.classList.remove('hidden');
        }
        if (this.$hudTimer) {
            this.$hudTimer.textContent = '00:00';
        }
        // [NEW] 맵별 임무 목표 텍스트 설정
        this._updateMissionObjectiveText();

        // Recalculate groundY fresh to be sure
        this.resize();

        // [Safety] Ensure Map is selected
        if (typeof Maps !== 'undefined' && !Maps.currentMap) Maps.currentMap = 'plain';

        this.initGameObjects();
        this.applyCityUnitsToBattleStock();
        this.running = true;
        this.centerCameraForBattleStart();

        // HUD
        this.minimapVisible = true;
        // [CHANGE] Hide old floating UI, use fixed HUD instead
        document.getElementById('hud-minimap-container')?.classList.add('hidden');
        document.getElementById('hud-minimap-toggle')?.classList.add('hidden');
        document.getElementById('hud-ctrl-wrapper')?.classList.add('hidden');
        document.getElementById('hud-camera-btn')?.classList.remove('hidden');
        document.getElementById('hud-option-btn').classList.remove('hidden');
        document.getElementById('unit-cmd-wrapper')?.classList.add('hidden');
        // [FIX] endGame에서 숨긴 UI 복구
        document.getElementById('hud-footer')?.classList.remove('hidden');
        if (typeof ui !== 'undefined') ui.updateSpeedBtns(this.speed);

        // [NEW] Show fixed bottom HUD
        if (typeof HUD !== 'undefined') HUD.show();

        // [FIX] 전투 시작 직후 재고 UI를 즉시 동기화한다.
        // (이전 전투 수량이 잠깐 남는 stale 표시 방지)
        if (typeof app !== 'undefined') {
            app.markUiDirty();
            app.commit('start-sync-stocks');
        }

        // In-game BGM
        if (typeof AudioSystem !== 'undefined') {
            if (AudioSystem.stopBGM) AudioSystem.stopBGM();
            const cityMapBattle = (typeof Maps !== 'undefined' && Maps.currentMap === 'city');
            if (typeof AudioSystem.setBGMLock === 'function') {
                AudioSystem.setBGMLock(cityMapBattle ? 'bgm/ost/tunetank.mp3' : '');
            }
            if (cityMapBattle && AudioSystem.playBGMFile) {
                AudioSystem.playBGMFile('bgm/ost/tunetank.mp3');
            }
        }

        // AI - [FIX] 완전한 스폰 상태 리셋
        if (typeof AI !== 'undefined') {
            AI.lastSpawn = 0;
            AI.nextSpawnAt = 0;
            AI.seqKey = '';
            AI.seqIndex = 0;
            AI.counterIndex = 0;
            AI._totalWarIssued = false;
            if (AI.wave) {
                AI.wave.lastCommandFrame = 0;
                AI.wave.lastThreatCheck = 0;
                AI.wave.phase = 'HOLD';
                AI.wave.wpIndex = 0;
                AI.wave.holdUntil = 0;
                AI.wave.retreatUntil = 0;
            }
            // 특수무기 상태 초기화
            AI._initSpecialState();
        }

        // [NEW] Map Setup (buildings + city setup)
        if (typeof GameMapSetup !== 'undefined' && GameMapSetup.apply) {
            try {
                GameMapSetup.apply(this);
            } catch (e) {
                console.error('[GameStart] GameMapSetup.apply failed:', e);
            }
        }
        // [HUD/UX] 전투 시작 기본 속도는 1배속
        this.setSpeed(1.0);
        this.engineFrame = 0;

        // [R 4.2] ChatPanel 초기화 및 표시
        if (typeof ChatPanel !== 'undefined') {
            const keepIogOpen = !!(this.settings && this.settings.iogAlwaysOpen === true);
            ChatPanel.init({ open: keepIogOpen });
            ChatPanel.clear();
            ChatPanel.show();
            ChatPanel.push('작전 개시. 행운을 빌니다.', 'INFO');
        }

        // 국지전 모드: 배치 페이즈 시작
        if (this._skirmishMode && typeof SkirmishMode !== 'undefined') {
            try {
                SkirmishMode.init(this, this._skirmishData);
            } catch (e) {
                console.error('[GameStart] SkirmishMode.init failed:', e);
                if (typeof SkirmishMode.cleanup === 'function') {
                    try { SkirmishMode.cleanup(); } catch (_) { }
                }
                this._skirmishMode = false;
                this._skirmishData = null;
            }
        }

        // 시작 직전 한 번 더 중앙 정렬 (모드 초기화 중 시야 변경 방지)
        // 단, 국지전 배치 단계는 좌측 배치영역 시야를 유지해야 한다.
        const keepSkirmishPlacementCamera = !!(
            this._skirmishMode
            && typeof SkirmishMode !== 'undefined'
            && SkirmishMode
            && SkirmishMode.isActive
            && SkirmishMode.phase === 'placement'
        );
        if (!keepSkirmishPlacementCamera) {
            this.centerCameraForBattleStart();
        }

        try {
            this.draw();
        } catch (e) {
            this._reportLoopError('draw:start-prime', e);
            this._drawFallbackFrame();
        }
        this.loop();
    },

    setupInputs() {
        if (typeof GameInput !== 'undefined' && GameInput.setup) {
            GameInput.setup.call(this);
        }
    },

    setCategory(cat) {
        this.currentCategory = cat;
        // UI 갱신은 commit에서 처리
        if (typeof app !== 'undefined') app.markUiDirty();
    },

    getPlayerSpawnX() {
        const hq = this.buildings.find((b) => b.type === 'hq_player');
        if (hq) return hq.x + 50;
        const spawnFlag = this.buildings.find((b) => b && !b.dead && b.type === 'spawn_flag_player' && b.team === 'player');
        if (spawnFlag) return spawnFlag.x + 40;
        // HQ가 없는 맵(예: 해안 상륙)은 좌측 맵 끝에서 생성
        return 44;
    },

    getPlayerRetreatStopX() {
        const hq = this.buildings.find((b) => b.type === 'hq_player');
        if (hq) return hq.x + 100;
        const spawnFlag = this.buildings.find((b) => b && !b.dead && b.type === 'spawn_flag_player' && b.team === 'player');
        if (spawnFlag) return spawnFlag.x + 90;
        // HQ가 없으면 좌측 맵 끝 쪽으로 완전히 복귀
        return 34;
    },

    // [FIX] Bunker Spawn Selection Stub (Prevent Crash)
    selectSpawn(bunker) {
        // Feature removed, but keeping method to prevent buildings.js crash
        this.selectedSpawn = bunker;
    },

    spawnUnitExecution(key) {
        const spawnX = this.getPlayerSpawnX();
        this.spawnUnitDirect(key, spawnX, this.groundY, 'player');
    },

    prepareTargeting(key) {
        if (this.targetingType) return;
        const u = CONFIG.units[key];
        if (u.isSkill) {
            if (this.isIcbmSkillKey(key)) {
                if (!this.shouldShowIcbmSkills()) {
                    ui.showToast("ICBM 미사일차량을 먼저 선택하세요!");
                    return;
                }
                if (!this.hasReadyIcbmLauncher('player')) {
                    ui.showToast("발사 가능한 ICBM이 없습니다!");
                    return;
                }
            }
            if (this.skillCharges[u.chargeKey] <= 0) { ui.showToast("사용 가능 횟수 부족!"); return; }
        } else {
            if (this.supply < u.cost || this.playerStock[key] <= 0) { ui.showToast("자원 또는 재고 부족!"); return; }
        }
        this.targetingType = key;
        document.getElementById('targeting-overlay').classList.remove('hidden');
        const strikeKeys = ['nuke', 'emp', 'tactical_missile', 'stealth_drone'];
        const msg = strikeKeys.includes(key)
            ? '타격지점을 선택하십시요'
            : '목표지점을 선택하십시요';
        document.getElementById('target-msg').innerText = msg;
        if (typeof app !== 'undefined') app.markUiDirty();
    },

    handleTargeting(x, y) {
        if (!this.targetingType) return;
        const key = this.targetingType;

        // [FIX] move는 CONFIG.units에 없는 가짜 키
        if (key === '__move__') {
            this.handleMoveTargeting(x);
            this.cancelTargeting();
            return;
        }

        // [NEW] smoke grenade targeting
        if (key === '__smoke__') {
            this.handleSmokeTargeting(x, y);
            this.cancelTargeting();
            return;
        }

        // [NEW] news camera targeting
        if (key === '__news__') {
            this.handleNewsTargeting(x, y);
            this.cancelTargeting();
            return;
        }

        // [NEW] transport drop targeting
        if (key === '__drop__') {
            this.handleDropTargeting(x);
            this.cancelTargeting();
            return;
        }

        // [NEW] fighter jet missile targeting
        if (key === '__missile__') {
            this.handleMissileTargeting(x, y);
            this.cancelTargeting();
            return;
        }

        const u = CONFIG.units[key];
        if (!u) {
            console.warn('[TARGETING] Unknown targetingType:', key);
            this.cancelTargeting();
            return;
        }

        if (this.isIcbmSkillKey(key)) {
            const launched = this.requestIcbmLaunch('player', key, x, y);
            if (!launched) {
                ui.showToast("발사 가능한 ICBM이 없습니다!");
            }
            this.cancelTargeting();
            return;
        } else if (key === 'stealth_drone') {
            // 위치 지정형 (락온 없음): 지정 지점으로 침투 후 급강하 폭발
            this.supply -= u.cost;
            this.cooldowns[key] = u.cooldown;
            this.playerStock[key]--;

            const drone = new Unit(key, 50, this.groundY, 'player', null);
            drone.x = 50;
            drone.y = this.groundY - 640;
            drone.targetX = x;
            this.players.push(drone);
            ui.showToast(`${u.name} 출격!`);

            // [FIX] 재고/공급/쿨타임 UI 즉시 반영
            if (typeof app !== 'undefined') { app.markDirty(); app.markUiDirty(); }
        } else {
            let target = null;
            let minDist = 300;
            const validTargets = [...this.enemies, ...this.enemyBuildings];
            validTargets.forEach(e => {
                const dy = e.y - (e.height ? e.height / 2 : 0) - y;
                const dx = e.x - x;
                const d = Math.sqrt(dx * dx + dy * dy);
                if (d < minDist) { minDist = d; target = e; }
            });

            if (u.lockOn && !target) { ui.showToast("타겟을 찾을 수 없습니다!"); return; }

            this.supply -= u.cost;
            this.cooldowns[key] = u.cooldown;
            this.playerStock[key]--;

            const drone = new Unit(key, 50, this.groundY, 'player', target);
            if (key === 'blackhawk' || key === 'chinook') {
                drone.x = 40;
                drone.y = this.groundY - 450;
                drone.targetX = x;
                drone.targetY = this.groundY - 450;
            } else if (!target) {
                drone.x = x; drone.y = y;
            }
            this.players.push(drone);
            ui.showToast(`${u.name} 출격!`);

            // [FIX] 재고/공급/쿨타임 UI 즉시 반영
            if (typeof app !== 'undefined') { app.markDirty(); app.markUiDirty(); }
        }
        this.cancelTargeting();
    },

    cancelTargeting() {
        this.targetingType = null;
        document.getElementById('targeting-overlay').classList.add('hidden');
    },

    // ============================================
    // [NEW] 이동 명령 타겟팅 시작
    // ============================================
    prepareMoveCommand() {
        if (!this.selectedUnits || this.selectedUnits.size === 0) {
            ui.showToast('유닛을 먼저 선택하세요');
            return;
        }
        if (this.targetingType) return; // 이미 타겟팅 중

        this.targetingType = '__move__';
        document.getElementById('targeting-overlay').classList.remove('hidden');
        document.getElementById('target-msg').innerText = '이동 위치 선택';
    },

    // ============================================
    // [NEW] 연막탄 명령 타겟팅 시작 (보병)
    // ============================================
    prepareSmokeCommand() {
        if (!this.selectedUnits || this.selectedUnits.size === 0) {
            ui.showToast('유닛을 먼저 선택하세요');
            return;
        }
        if (this.targetingType) return; // 이미 타겟팅 중

        // [ITEM] smoke_grenade 아이템 포함 — smokeChargesLeft > 0 이면 모든 유닛 허용
        let hasSmoke = false;
        for (const u of this.selectedUnits) {
            if (u && !u.dead && (u.smokeChargesLeft || 0) > 0) {
                hasSmoke = true;
                break;
            }
        }
        if (!hasSmoke) {
            ui.showToast('연막탄 사용 가능한 유닛이 없습니다');
            return;
        }

        this.targetingType = '__smoke__';
        document.getElementById('targeting-overlay').classList.remove('hidden');
        document.getElementById('target-msg').innerText = '연막탄 투척 위치 선택';
    },

    // ============================================
    // [NEW] 뉴스 송출 위치 타겟팅 시작 (카메라맨)
    // ============================================
    prepareNewsCommand() {
        if (!this.selectedUnits || this.selectedUnits.size === 0) {
            ui.showToast('유닛을 먼저 선택하세요');
            return;
        }
        if (this.targetingType) return; // 이미 타겟팅 중

        let hasCameraman = false;
        for (const u of this.selectedUnits) {
            if (u && !u.dead && (u.isCameraman || u.stats?.isCameraman)) {
                hasCameraman = true;
                break;
            }
        }
        if (!hasCameraman) {
            ui.showToast('카메라맨이 선택되지 않았습니다');
            return;
        }

        this.targetingType = '__news__';
        document.getElementById('targeting-overlay').classList.remove('hidden');
        document.getElementById('target-msg').innerText = '방송 위치 선택';
    },

    // ============================================
    // [NEW] 전투기 미사일 타겟팅 시작
    // ============================================
    prepareMissileCommand() {
        if (!this.selectedUnits || this.selectedUnits.size === 0) {
            ui.showToast('유닛을 먼저 선택하세요');
            return;
        }
        if (this.targetingType) return;

        const readyMissileUnits = this.getSelectedMissileUnits(true);
        if (readyMissileUnits.length === 0) {
            ui.showToast('미사일 사용 가능한 유닛이 없습니다');
            return;
        }

        this.targetingType = '__missile__';
        document.getElementById('targeting-overlay').classList.remove('hidden');
        document.getElementById('target-msg').innerText = '미사일 타격 대상 선택';
    },

    // ============================================
    // [NEW] 수송 하차 명령 타겟팅 시작
    // ============================================
    prepareDropCommand() {
        if (!this.selectedUnits || this.selectedUnits.size === 0) {
            ui.showToast('유닛을 먼저 선택하세요');
            return;
        }
        if (this.targetingType) return; // 이미 타겟팅 중

        let hasAir = false;
        let groundDropped = 0;

        this.selectedUnits.forEach(u => {
            if (!u || u.dead || !u.stats) return;
            const id = u.stats.id;
            if (id === 'blackhawk' || id === 'chinook') {
                if ((u.transportDropsLeft || 0) > 0) hasAir = true;
            } else if (id === 'apc' || id === 'humvee') {
                if ((u.transportDropsLeft || 0) > 0) {
                    if (typeof u.requestGroundDrop === 'function') {
                        if (u.requestGroundDrop()) groundDropped++;
                    }
                }
            }
        });

        if (groundDropped > 0) {
            ui.showToast(`지상 수송 ${groundDropped}대 하차`);
        }

        if (hasAir) {
            this.targetingType = '__drop__';
            document.getElementById('targeting-overlay').classList.remove('hidden');
            document.getElementById('target-msg').innerText = '하차 지점 선택';
            return;
        }

        if (groundDropped === 0) {
            ui.showToast('하차 가능한 수송 유닛이 없습니다');
        }
    },

    // ============================================
    // [NEW] 이동 명령 처리 (handleTargeting에서 호출)
    // ============================================
    handleMoveTargeting(x) {
        if (!this.selectedUnits || this.selectedUnits.size === 0) return;

        this.selectedUnits.forEach(u => {
            if (!u.dead) {
                u.commandMode = 'move';
                u.targetX = x;
                u.attackTarget = null;
                u.lockedTarget = null;
            }
        });

        ui.showToast(`${this.selectedUnits.size}개 유닛 이동 명령!`);
        this.createParticles(x, this.groundY - 10, 8, '#22c55e');
    },

    // ============================================
    // [NEW] 연막탄 투척 처리 (handleTargeting에서 호출)
    // ============================================
    handleSmokeTargeting(x, y) {
        if (!this.selectedUnits || this.selectedUnits.size === 0) return;

        // [ITEM] smoke_grenade 아이템 포함 — smokeChargesLeft > 0 인 모든 유닛 허용
        let usedUnit = null;
        for (const u of this.selectedUnits) {
            if (u && !u.dead && (u.smokeChargesLeft || 0) > 0) {
                usedUnit = u;
                break;
            }
        }
        if (!usedUnit) {
            ui.showToast('연막탄을 사용할 유닛이 없습니다');
            return;
        }

        // [ITEM] 연막탄 사거리 제한: 유닛으로부터 최대 350px
        const SMOKE_THROW_RANGE = 350;
        const clampedX = Math.max(
            usedUnit.x - SMOKE_THROW_RANGE,
            Math.min(usedUnit.x + SMOKE_THROW_RANGE, x)
        );

        // [ITEM] 연막탄은 항상 지면(groundY)에서 터짐
        const groundLevel = Number.isFinite(this.groundY) ? this.groundY : y;

        usedUnit.smokeChargesLeft = Math.max(0, (usedUnit.smokeChargesLeft || 0) - 1);
        this.spawnSmokeAt(clampedX, groundLevel, { team: usedUnit.team });
        ui.showToast('연막탄 투척!');
        if (typeof this.updateHUDSelection === 'function') this.updateHUDSelection();
    },

    // ============================================
    // [NEW] 뉴스 카메라 위치 지정
    // ============================================
    handleNewsTargeting(x, y) {
        if (!this.selectedUnits || this.selectedUnits.size === 0) return;

        let cam = null;
        for (const u of this.selectedUnits) {
            if (u && !u.dead && (u.isCameraman || u.stats?.isCameraman)) { cam = u; break; }
        }
        if (!cam) {
            ui.showToast('카메라맨이 없습니다');
            return;
        }

        const minX = 100;
        const maxX = (typeof CONFIG !== 'undefined' && Number.isFinite(CONFIG.mapWidth)) ? CONFIG.mapWidth - 100 : 5900;
        const tx = Math.max(minX, Math.min(maxX, x));
        this._activeCameraman = cam;
        this.newsCameraX = tx;

        if (typeof GameNews !== 'undefined' && GameNews.playManualNews) {
            GameNews.playManualNews(this);
        }
    },

    // ============================================
    // [NEW] 전투기 미사일 발사 처리 (handleTargeting에서 호출)
    // ============================================
    handleMissileTargeting(x, y) {
        if (!this.selectedUnits || this.selectedUnits.size === 0) return;

        // 미사일 사용 가능한 유닛 1기 선택
        const usedUnit = this.getSelectedMissileUnits(true)[0] || null;
        if (!usedUnit) { ui.showToast('미사일을 사용할 유닛이 없습니다'); return; }

        // 클릭 위치 근처 적 유닛/건물 스냅
        let target = null;
        let minDist = 300;
        const candidates = [...(this.enemies || []), ...(this.enemyBuildings || [])];
        for (const e of candidates) {
            if (!e || e.dead) continue;
            const dx = e.x - x;
            const dy = (e.y - (e.height ? e.height / 2 : 0)) - y;
            const d = Math.sqrt(dx * dx + dy * dy);
            if (d < minDist) { minDist = d; target = e; }
        }
        if (!target) { ui.showToast('타겟을 찾을 수 없습니다'); return; }

        // 차지 소모
        usedUnit.missileChargesLeft = Math.max(0, (Number(usedUnit.missileChargesLeft) || 0) - 1);

        const missileType = (typeof usedUnit.stats?.missileProjectile === 'string' && usedUnit.stats.missileProjectile.trim())
            ? usedUnit.stats.missileProjectile.trim()
            : 'fighter_missile';
        const missileSpeedRaw = Number(usedUnit.stats?.missileSpeed);
        const missileSpeed = (Number.isFinite(missileSpeedRaw) && missileSpeedRaw > 0)
            ? missileSpeedRaw
            : 400;

        // 미사일 발사
        this.projectiles.push(new Projectile(
            usedUnit.x, usedUnit.y, target, missileSpeed, usedUnit.team,
            missileType, { source: usedUnit }
        ));

        if (typeof AudioSystem !== 'undefined') AudioSystem.playSFX('rocket_launcher', usedUnit.x);
        ui.showToast('미사일 발사!');
        if (typeof this.updateHUDSelection === 'function') this.updateHUDSelection();
    },

    // ============================================
    // [NEW] 수송 하차 처리 (handleTargeting에서 호출)
    // ============================================
    handleDropTargeting(x) {
        if (!this.selectedUnits || this.selectedUnits.size === 0) return;
        let tx = x;
        if (typeof CONFIG !== 'undefined' && Number.isFinite(CONFIG.mapWidth)) {
            tx = Math.max(0, Math.min(CONFIG.mapWidth, x));
        }

        let count = 0;
        this.selectedUnits.forEach(u => {
            if (!u || u.dead || !u.stats) return;
            const id = u.stats.id;
            if (id !== 'blackhawk' && id !== 'chinook') return;
            if ((u.transportDropsLeft || 0) <= 0) return;
            if (typeof u.requestAirDrop === 'function') {
                if (u.requestAirDrop(tx)) count++;
            }
        });

        if (count > 0) {
            ui.showToast(`수송 헬기 하차 지점 지정 (${count}대)`);
            if (this.createParticles) this.createParticles(tx, this.groundY - 10, 6, '#22c55e');
        }
        if (typeof this.updateHUDSelection === 'function') this.updateHUDSelection();
    },

    // ============================================
    // [NEW] 건설 모드 함수
    // 감시탑(watchtower)만 건설 가능, 1회 제한
    // ============================================
    enterBuildMode(buildingType, worker) {
        // [3.8] 감시탑만 건설 가능
        if (buildingType !== 'watchtower') {
            ui.showToast('감시탑만 건설할 수 있습니다!');
            console.warn(`[BUILD] Blocked: ${buildingType} - only watchtower allowed`);
            return;
        }

        // [3.8] 감시탑 1회 건설 제한
        if (this.watchtowerBuilt) {
            ui.showToast('감시탑은 1회만 건설 가능합니다!');
            return;
        }

        if (!CONFIG.constructable[buildingType]) {
            ui.showToast('알 수 없는 건물 타입!');
            return;
        }
        if (this.builderCooldown > 0) {
            ui.showToast('건설 쿨타임 중!');
            return;
        }
        const bData = CONFIG.constructable[buildingType];
        if (this.supply < bData.cost) {
            ui.showToast('자원 부족!');
            return;
        }

        this.buildMode.active = true;
        this.buildMode.type = buildingType;
        this.buildMode.worker = worker;
        this.buildMode.valid = false;

        // 취소 오버레이 표시
        document.getElementById('targeting-overlay').classList.remove('hidden');
        document.getElementById('target-msg').innerText = `${bData.name} 배치 위치 선택`;
    },

    cancelBuildMode() {
        this.buildMode.active = false;
        this.buildMode.type = null;
        this.buildMode.worker = null;
        this.buildMode.valid = false;
        document.getElementById('targeting-overlay').classList.add('hidden');
    },

    updateBuildPreview(worldX, worldY) {
        if (!this.buildMode.active) return;

        const bType = this.buildMode.type;
        const bData = CONFIG.constructable[bType];
        if (!bData) return;

        // 프리뷰 위치 업데이트 (지면에 고정)
        this.buildMode.previewX = worldX;
        this.buildMode.previewY = this.groundY;

        // 배치 가능 여부 판정
        this.buildMode.valid = this.checkBuildPlacement(worldX, bData);
    },

    checkBuildPlacement(x, bData) {
        // 1. 맵 범위 체크
        const halfW = (bData.footprint?.w || bData.width) / 2;
        if (x - halfW < 50 || x + halfW > CONFIG.mapWidth - 50) return false;

        // 2. 기존 건물과 중첩 체크
        for (const b of this.buildings) {
            if (b.dead) continue;
            const bHalfW = (b.width || 100) / 2;
            const dist = Math.abs(b.x - x);
            const minDist = halfW + bHalfW + 20; // 여유 간격
            if (dist < minDist) return false;
        }

        // 3. 건설 중인 건물과도 중첩 체크
        if (this.constructingBuildings) {
            for (const cb of this.constructingBuildings) {
                if (cb.dead) continue;
                const cbHalfW = (cb.width || 100) / 2;
                const dist = Math.abs(cb.x - x);
                const minDist = halfW + cbHalfW + 20;
                if (dist < minDist) return false;
            }
        }

        return true;
    },

    handleBuildPlacement(worldX) {
        if (!this.buildMode.active) return;

        const bType = this.buildMode.type;
        const bData = CONFIG.constructable[bType];
        const worker = this.buildMode.worker;
        if (!bData) return;

        // 유효성 재확인
        if (!this.checkBuildPlacement(worldX, bData)) {
            ui.showToast('이 위치에 건설할 수 없습니다!');
            return;
        }

        // 자원 소모
        if (this.supply < bData.cost) {
            ui.showToast('자원 부족!');
            this.cancelBuildMode();
            return;
        }
        this.supply -= bData.cost;

        // [3.8] 감시탑 건설 1회 제한 플래그 설정
        if (bType === 'watchtower') {
            this.watchtowerBuilt = true;
        }

        // [3.8] 작업자에게 buildTask 생성 (즉시 건설 시작하지 않음)
        if (worker && !worker.dead) {
            worker.buildTask = {
                type: bType,
                x: worldX,
                phase: 'move',     // 'move' → 'build' → done
                started: false,
                buildTime: bData.buildTime
            };
            worker.targetX = worldX;
            ui.showToast('작업자가 이동 중...');
        } else {
            // 작업자가 없거나 죽었으면 즉시 건설 (폴백)
            this.startConstruction(bType, worldX, this.groundY, 'player');
            ui.showToast(`${bData.name} 건설 시작!`);
        }

        // 쿨타임 시작
        this.builderCooldown = bData.cooldown || 120;

        // 건설 모드 종료
        this.cancelBuildMode();

        if (typeof app !== 'undefined') {
            app.markDirty();
            app.markUiDirty();
        }
    },

    // 건설 시작 (Commit C에서 완전 구현)
    startConstruction(bType, x, y, team) {
        // 임시: 바로 완성된 건물 생성 (Commit C에서 건설 중 상태로 변경)
        if (!this.constructingBuildings) this.constructingBuildings = [];

        const bData = CONFIG.constructable[bType];
        const construction = {
            type: bType,
            x: x,
            y: y,
            team: team,
            width: bData.width,
            height: bData.height,
            hp: 1,
            maxHp: bData.hp,
            progress: 0,
            buildTime: bData.buildTime,
            dead: false,
            isConstruction: true,
        };
        this.constructingBuildings.push(construction);
    },

    // [NEW] 건설 프리뷰 렌더링
    drawBuildPreview(ctx) {
        const bType = this.buildMode.type;
        const bData = CONFIG.constructable[bType];
        if (!bData) return;

        const x = this.buildMode.previewX;
        const y = this.groundY;
        const w = bData.width;
        const h = bData.height;

        ctx.save();

        // 유효/무효에 따른 색상
        const isValid = this.buildMode.valid;
        const fillColor = isValid ? 'rgba(34, 197, 94, 0.4)' : 'rgba(239, 68, 68, 0.4)';
        const strokeColor = isValid ? '#22c55e' : '#ef4444';

        // 건물 프리뷰 (반투명)
        ctx.fillStyle = fillColor;
        ctx.fillRect(x - w / 2, y - h, w, h);

        // 테두리 (점선)
        ctx.strokeStyle = strokeColor;
        ctx.lineWidth = 2;
        ctx.setLineDash([8, 4]);
        ctx.strokeRect(x - w / 2, y - h, w, h);

        // 건물 이름 표시
        ctx.setLineDash([]);
        ctx.fillStyle = strokeColor;
        ctx.font = 'bold 14px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(bData.name, x, y - h - 8);

        ctx.restore();
    },

    drawSkirmishPlacementZone(ctx) {
        if (!ctx) return;
        if (!this._skirmishMode || typeof SkirmishMode === 'undefined') return;
        if (!SkirmishMode.isActive || SkirmishMode.phase !== 'placement') return;

        const mapW = (typeof CONFIG !== 'undefined' && Number.isFinite(Number(CONFIG.mapWidth)))
            ? Number(CONFIG.mapWidth)
            : 6000;
        const zoneRight = mapW * 0.35;
        if (!(zoneRight > 0)) return;

        const z = (typeof Camera !== 'undefined' && Number.isFinite(Number(Camera.zoom)) && Number(Camera.zoom) > 0)
            ? Number(Camera.zoom)
            : 1;
        const top = this.groundY + ((0 - this.groundY) / z);
        const bottom = this.groundY + ((this.height - this.groundY) / z);
        const zoneHeight = Math.max(0, bottom - top);

        ctx.save();
        ctx.fillStyle = 'rgba(59, 130, 246, 0.08)';
        ctx.fillRect(0, top, zoneRight, zoneHeight);

        ctx.strokeStyle = 'rgba(59, 130, 246, 0.55)';
        ctx.lineWidth = 2 / z;
        ctx.setLineDash([10 / z, 6 / z]);
        ctx.beginPath();
        ctx.moveTo(zoneRight, top);
        ctx.lineTo(zoneRight, bottom);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.restore();
    },

    // [NEW] 건설 진행 업데이트
    updateConstructions() {
        if (!this.constructingBuildings) return;

        const completed = [];

        for (let i = this.constructingBuildings.length - 1; i >= 0; i--) {
            const c = this.constructingBuildings[i];
            if (c.dead) {
                this.constructingBuildings.splice(i, 1);
                continue;
            }

            c.progress++;
            c.hp = Math.floor((c.progress / c.buildTime) * c.maxHp);

            // 건설 완료
            if (c.progress >= c.buildTime) {
                completed.push(c);
                this.constructingBuildings.splice(i, 1);
            }
        }

        // 완료된 건물을 실제 Building으로 변환
        for (const c of completed) {
            this.completeConstruction(c);
        }
    },

    // [NEW] 건설 완료 처리
    completeConstruction(c) {
        const bData = CONFIG.constructable[c.type];
        if (!bData) return;

        // Building 클래스 인스턴스 생성
        const building = new Building(c.type, c.x, c.y, c.team);

        // CONFIG.constructable 데이터로 오버라이드
        building.hp = bData.hp;
        building.maxHp = bData.hp;
        building.width = bData.width;
        building.height = bData.height;
        building.isConstructed = true;  // 플레이어가 건설한 건물 표시

        // 생산 가능 건물인 경우 추가 속성
        if (bData.productionTab) {
            building.productionTab = bData.productionTab;
            building.canProduce = true;
        }

        // 감시탑인 경우 공격 속성 추가
        if (bData.canShoot) {
            building.canShoot = true;
            building.damage = bData.damage;
            building.range = bData.range;
            building.rate = bData.rate;
            building.lastAttack = 0;
        }

        this.buildings.push(building);

        ui.showToast(`${bData.name} 건설 완료!`);

        if (typeof AudioSystem !== 'undefined') {
            AudioSystem.play('build_complete');
        }
    },

    // [NEW] 건설 중인 건물 렌더링 (회색 건설현장 스타일 + 상단 게이지)
    drawConstructingBuilding(ctx, c) {
        const bData = CONFIG.constructable[c.type];
        if (!bData) return;

        const x = c.x, y = c.y, w = c.width, h = c.height;
        const progress = Math.max(0, Math.min(1, c.progress / c.buildTime));
        const pct = Math.floor(progress * 100);

        ctx.save();

        // 1) 건설현장 본체(회색 + 스캐폴드 느낌)
        const left = x - w / 2;
        const top = y - h;

        ctx.fillStyle = '#374151';
        ctx.fillRect(left, top, w, h);

        ctx.strokeStyle = '#9ca3af';
        ctx.lineWidth = 2;
        ctx.strokeRect(left + 2, top + 2, w - 4, h - 4);

        // 세로 기둥
        ctx.globalAlpha = 0.55;
        for (let i = 1; i <= 3; i++) {
            const px = left + (w * i) / 4;
            ctx.beginPath();
            ctx.moveTo(px, top + 6);
            ctx.lineTo(px, y - 6);
            ctx.stroke();
        }

        // 대각 스트라이프(작업중 느낌)
        ctx.globalAlpha = 0.18;
        ctx.strokeStyle = '#e5e7eb';
        ctx.lineWidth = 1;
        const step = 10;
        for (let xx = left - h; xx < left + w + h; xx += step) {
            ctx.beginPath();
            ctx.moveTo(xx, y);
            ctx.lineTo(xx + h, top);
            ctx.stroke();
        }
        ctx.globalAlpha = 1;

        // 2) 상단 작은 게이지 + %
        const barW = Math.max(40, w * 0.78);
        const barH = 7;
        const barX = x - barW / 2;
        const barY = top - 14;

        ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
        ctx.fillRect(barX, barY, barW, barH);
        ctx.fillStyle = '#9ca3af';
        ctx.fillRect(barX, barY, barW * progress, barH);
        ctx.strokeStyle = '#e5e7eb';
        ctx.lineWidth = 1;
        ctx.strokeRect(barX, barY, barW, barH);

        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 11px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(`${pct}%`, x, barY - 2);

        // 이름
        ctx.font = 'bold 12px sans-serif';
        ctx.fillStyle = '#e5e7eb';
        ctx.fillText(bData.name, x, barY - 16);

        ctx.restore();
    },

    drawDroneLockTargets(ctx) {
        if (!this.selectedUnits || this.selectedUnits.size === 0) return;
        ctx.save();
        ctx.strokeStyle = '#ef4444';
        ctx.lineWidth = 2 / (Camera.zoom || 1);

        this.selectedUnits.forEach(u => {
            if (!u || u.dead || !u.stats) return;
            if (u.stats.operator) return;
            const isDrone = (u.stats.category === 'drone' || (u.stats.id && u.stats.id.includes('drone')));
            if (!isDrone) return;
            const t = u.lockedTarget;
            if (!t || t.dead) return;
            const w = t.width || 32;
            const h = t.height || 32;
            ctx.strokeRect(t.x - w / 2, t.y - h, w, h);
        });

        ctx.restore();
    },

    commandDrones(x, y) {
        const pool = (typeof this.getSelectedDronesForLockdown === 'function')
            ? this.getSelectedDronesForLockdown()
            : this.getSelectedDrones();
        if (!Array.isArray(pool) || pool.length === 0) return 0;

        let count = 0;
        const seen = new Set();
        for (let i = 0; i < pool.length; i++) {
            const u = pool[i];
            if (!u || u.dead || !u.stats || seen.has(u)) continue;
            seen.add(u);
            if (u.stats.operator) continue;
            const isDrone = (u.stats.category === 'drone' || (u.stats.id && u.stats.id.startsWith('drone')));
            if (!isDrone) continue;
            if (!['drone_suicide', 'drone_at'].includes(u.stats.id)) continue;

            u.swarmTarget = { x, y };
            u.lockedTarget = null;
            u.attackTarget = null;
            u.attackPhase = null;
            u.recallRequested = false;
            u.recallPhase = null;
            u.recallTarget = null;
            u.commandState = 'move';
            u.autoSeekTarget = false;
            count++;
        }

        if (count > 0) {
            ui.showToast(`드론 ${count}기 이동 명령!`);
            this.createParticles(x, y, 10, '#facc15');
        }
        return count;
    },

    createParticles(x, y, count, color) {
        const n = Number(count) || 0;
        if (n <= 0) return;

        // [P0] 화면 밖 파티클 생성 스킵
        if (Number.isFinite(x)) {
            const pad = Number(this.particleCullPadding) || 0;
            const viewW = (typeof Camera !== 'undefined' && Camera.viewW) ? Camera.viewW(this) : this.width;
            const minX = (this.cameraX || 0) - pad;
            const maxX = (this.cameraX || 0) + (viewW || 0) + pad;
            if (x < minX || x > maxX) return;
        }

        // [P0] 프레임당 생성량 캡
        if (this._particleSpawnFrame !== this.frame) {
            this._particleSpawnFrame = this.frame;
            this._particleSpawnCount = 0;
        }
        let remaining = n;
        const perFrameCap = Number(this.particleSpawnCap) || 0;
        if (perFrameCap > 0) {
            const room = perFrameCap - this._particleSpawnCount;
            if (room <= 0) return;
            remaining = Math.min(remaining, room);
        }

        // [P0] 전체 개수 캡
        const totalCap = Number(this.particleCap) || 0;
        if (totalCap > 0) {
            const room = totalCap - this.particles.length;
            if (room <= 0) return;
            remaining = Math.min(remaining, room);
        }

        if (remaining <= 0) return;
        for (let i = 0; i < remaining; i++) this.particles.push(new Particle(x, y, color));
        this._particleSpawnCount += remaining;
    },

    // [NEW] Smoke grenade VFX
    spawnSmokeAt(x, y, opts = {}) {
        if (typeof SmokeCloudFX === 'undefined') return;
        if (!this.particles) return;

        const sx = Number.isFinite(x) ? x : 0;
        const gy = Number.isFinite(this.groundY) ? this.groundY : y;
        const sy = Number.isFinite(y) ? Math.min(y, gy) : gy;
        const team = opts && opts.team ? opts.team : null;

        if (team === 'enemy') {
            const cap = Number.isFinite(this.enemySmokeCap) ? this.enemySmokeCap : 0;
            if (cap > 0) {
                let active = 0;
                for (const p of this.particles) {
                    if (p && p instanceof SmokeCloudFX && p.team === 'enemy' && p.life > 0) active++;
                }
                if (active >= cap) return;
            }
        }

        // 기본 캡 적용
        const totalCap = Number(this.particleCap) || 0;
        if (totalCap > 0 && this.particles.length >= totalCap) return;

        this.particles.push(new SmokeCloudFX(sx, sy, { team }));
    },

    // [NEW] Building destruction FX + SFX
    spawnBuildingDestructionFX(b) {
        try {
            const kind = (b && String(b.type || '').includes('hq')) ? 'hq' : 'defense';

            // add FX (rendered in world-space via game.particles pipeline)
            if (typeof BuildingDestructionFX !== 'undefined') {
                this.particles.push(new BuildingDestructionFX(b.x, b.y, b.width, b.height, b.team, kind));
            } else {
                // fallback particles
                this.createParticles(b.x, b.y - (b.height || 80) * 0.5, kind === 'hq' ? 40 : 18, '#111');
                this.createParticles(b.x, b.y - (b.height || 80) * 0.5, kind === 'hq' ? 18 : 8, '#fff');
            }

            // small extra sparks
            this.createParticles(b.x, b.y - (b.height || 80) * 0.5, kind === 'hq' ? 12 : 6, '#facc15');

            // sound - building destruction uses boom-2
            if (typeof AudioSystem !== 'undefined') AudioSystem.playBoom('other', b.x);
        } catch (e) {
            console.warn('spawnBuildingDestructionFX failed', e);
        }
    },

    // Queue System
    startHold(key) {
        if (!this.running || this.holdTimer) return;
        // [P0-2] 드론은 단일 클릭으로 즉시 스폰 (hold 반복 안 함)
        if (key === 'drone_suicide' || key === 'drone_at') {
            this.queueUnit(key);
            return;
        }
        this.holdKey = key;
        this.queueUnit(key);
        this.holdTimer = setInterval(() => { this.queueUnit(key); }, 150);
    },

    endHold(key) {
        if (this.holdKey !== key) return;
        if (this.holdTimer) { clearInterval(this.holdTimer); this.holdTimer = null; }
        this.holdKey = null;
    },

    queueUnit(key) {
        const u = CONFIG.units[key];
        const isOperatorDroneLaunch = (key === 'drone_suicide' || key === 'drone_at');
        const isIcbmSkillLaunch = (typeof this.isIcbmSkillKey === 'function') && this.isIcbmSkillKey(key);

        // 국지전 배치 페이즈에서는 기존 유닛생성바 클릭을 "선택"으로 처리
        if (this._skirmishMode && typeof SkirmishMode !== 'undefined' && SkirmishMode.isActive) {
            if (SkirmishMode.phase === 'placement') {
                if (typeof SkirmishMode.selectUnitFromBar === 'function') {
                    SkirmishMode.selectUnitFromBar(this, key);
                }
            } else {
                const warnMsg = (isOperatorDroneLaunch || isIcbmSkillLaunch)
                    ? '국지전 전투 중 드론/미사일은 명령바 스킬로만 사용 가능합니다.'
                    : '국지전에서는 배치 단계에서만 유닛을 선택할 수 있습니다.';
                if (typeof ChatPanel !== 'undefined') {
                    ChatPanel.push(warnMsg, 'WARN');
                }
            }

            if (this.holdTimer) {
                clearInterval(this.holdTimer);
                this.holdTimer = null;
            }
            this.holdKey = null;
            return;
        }

        // [P0-2] 드론 탭 클릭 = 즉시 출격
        // 드론병이 선택된 상태에서 드론 버튼 클릭 시 즉시 스폰
        if (key === 'drone_suicide' || key === 'drone_at') {
            this.launchOperatorDroneFromCommand(key);
            return;
        }

        // Special logic for targeting
        const needsTargeting = ['tactical_drone', 'stealth_drone', 'emp', 'nuke', 'tactical_missile'].includes(key);
        if (needsTargeting) {
            // [FIX] Clear holdTimer value so startHold can run again.
            if (this.holdTimer) {
                clearInterval(this.holdTimer);
                this.holdTimer = null;
            }
            this.holdKey = null;

            this.prepareTargeting(key);
            return;
        }

        if (this.supply >= u.cost && this.playerStock[key] > 0) {
            this.supply -= u.cost;
            this.playerStock[key]--;
            this.spawnQueue[key]++;
            // [FIX] 클릭 즉시 UI 갱신
            if (typeof app !== 'undefined') {
                app.markUiDirty();
                app.commit('queueUnit');
            }
        }
    },

    processQueue() {
        for (let key in this.spawnQueue) {
            if (this.spawnQueue[key] > 0) {
                if (this.cooldowns[key] <= 0) {
                    this.spawnUnitExecution(key);
                    this.spawnQueue[key]--;
                    this.cooldowns[key] = CONFIG.units[key].cooldown;
                }
            }
        }
    },

    spawnUnitDirect(key, x, y, team, bypassBlock = false) {
        let spawnOptions = null;
        let bypass = bypassBlock === true;
        if (bypassBlock && typeof bypassBlock === 'object') {
            spawnOptions = bypassBlock;
            bypass = bypassBlock.bypassBlock === true;
        }

        // [R 4.2 FIX v3] 구 드론 절대 생성 불가 (하드 가드)
        const OBSOLETE_DRONES = ['tactical_drone', 'stealth_drone'];
        if (OBSOLETE_DRONES.includes(key)) {
            console.warn(`[spawnUnitDirect] HARD BLOCK: ${key} is obsolete`);
            return null;  // 어떤 경우에도 생성 불가
        }

        // 신규 드론은 bypassBlock=true일 때만 생성 가능
        const NEW_DRONES = ['drone_suicide', 'drone_at'];
        if (NEW_DRONES.includes(key) && !bypass) {
            if (team === 'player') {
                if (typeof ChatPanel !== 'undefined') ChatPanel.push(`[차단] ${key}는 직접 생산 불가`, 'WARN');
            }
            console.warn(`[spawnUnitDirect] Blocked: ${key}`);
            return null;
        }

        let spawnX = Number.isFinite(Number(x)) ? Number(x) : 0;
        const spawnY = Number.isFinite(Number(y)) ? Number(y) : this.groundY;
        const unitDef = (typeof CONFIG !== 'undefined' && CONFIG && CONFIG.units)
            ? CONFIG.units[key]
            : null;
        const isAirUnit = !!(unitDef && unitDef.type === 'air');
        const preserveDroneLaunch = (key === 'drone_suicide' || key === 'drone_at');
        const isSkirmishPlacementPhase = !!(
            typeof SkirmishMode !== 'undefined'
            && SkirmishMode
            && SkirmishMode.isActive === true
            && SkirmishMode.phase === 'placement'
        );

        // Air units (except operator-launched drones) always enter from off-map.
        // During skirmish predeploy placement, keep requested spawnX so air units can be placed on-map.
        if (isAirUnit && !preserveDroneLaunch && (team === 'player' || team === 'enemy') && !isSkirmishPlacementPhase) {
            const mapW = (typeof CONFIG !== 'undefined' && Number.isFinite(Number(CONFIG.mapWidth)))
                ? Number(CONFIG.mapWidth)
                : 6000;
            const baseMargin = Math.max(140, Math.round(mapW * 0.03));
            const jitterMax = Math.max(12, Math.min(72, Math.round(baseMargin * 0.35)));
            const jitter = Math.round((Math.random() * 2 - 1) * jitterMax);

            spawnX = (team === 'enemy')
                ? (mapW + baseMargin + jitter)
                : (-baseMargin + jitter);
        }

        const unit = new Unit(key, spawnX, spawnY, team);
        if (spawnOptions && spawnOptions.veteran) {
            this.applyVeteranStats(unit, spawnOptions.veteran);
        }
        if (team === 'player') {
            this.players.push(unit);
            this.playerEverSeen = true;
        } else {
            this.enemies.push(unit);
            this.enemyEverSeen = true;
        }

        // [R 4.2] 생성된 unit 반환 (치명 버그 수정)
        return unit;
    },

    spawnCivilianUnit(key, x, y) {
        const unit = new Unit(key, x, y != null ? y : this.groundY, 'civilian');
        unit.hideHp = true;
        unit.disableFeetSnap = true;
        this.civilians.push(unit);
        return unit;
    },

    // [NEW] 뉴스 카메라맨 스폰 (플레이어 조종 가능)
    spawnCameramanUnit(x, y) {
        const unit = new Unit('cameraman', x, y != null ? y : this.groundY, 'player');
        unit.hideHp = true;
        unit.isCameraman = true;
        unit.commandMode = 'stop'; // 기본 정지 상태
        this.players.push(unit); // 플레이어 유닛으로 추가
        this._activeCameraman = unit;
        return unit;
    },

    // [NEW] 활성 카메라맨 조회
    getActiveCameraman() {
        if (this._activeCameraman && !this._activeCameraman.dead) {
            return this._activeCameraman;
        }
        return null;
    },

    spawnCityCivilians() {
        this.civilians = [];
        const spawnDefs = [
            { id: 'civ_sedan', ratio: 0.08 },
            { id: 'civ_suv', ratio: 0.14 },
            { id: 'civ_bus', ratio: 0.22 },
            { id: 'civ_a', ratio: 0.30 },
            { id: 'civ_b', ratio: 0.36 },
            { id: 'civ_crowd', ratio: 0.44 },
            { id: 'civ_sedan', ratio: 0.52 },
            { id: 'civ_suv', ratio: 0.58 },
            { id: 'civ_bus', ratio: 0.64 },
            { id: 'civ_a', ratio: 0.70 },
            { id: 'civ_b', ratio: 0.76 },
            { id: 'civ_crowd', ratio: 0.82 },
            { id: 'civ_sedan', ratio: 0.88 },
            { id: 'civ_suv', ratio: 0.92 }
        ];

        const pad = 80;
        spawnDefs.forEach(def => {
            const jitter = (Math.random() * 120 - 60);
            let x = CONFIG.mapWidth * def.ratio + jitter;
            x = Math.max(pad, Math.min(CONFIG.mapWidth - pad, x));
            this.spawnCivilianUnit(def.id, x, this.groundY);
        });

        // [NEW] 중앙 밀집도 강화 (중립 시민 추가 스폰)
        const centerPool = [
            'civ_crowd', 'civ_crowd', 'civ_crowd', 'civ_crowd',
            'civ_a', 'civ_b', 'civ_a', 'civ_b',
            'civ_sedan', 'civ_suv'
        ];
        const centerCount = 14;
        const centerX = CONFIG.mapWidth * 0.5;
        const centerSpread = 260;
        for (let i = 0; i < centerCount; i++) {
            const id = centerPool[Math.floor(Math.random() * centerPool.length)];
            const bias = (Math.random() - Math.random()) * centerSpread;
            let x = centerX + bias;
            x = Math.max(pad, Math.min(CONFIG.mapWidth - pad, x));
            this.spawnCivilianUnit(id, x, this.groundY);
        }
    },

    triggerCivilianPanic(duration = 240) {
        const d = Math.max(60, Number(duration) || 0);
        this.civilianGlobalPanic = Math.max(this.civilianGlobalPanic || 0, d);
    },

    handleCivilianDeath() {
        this.civilianDeaths = (this.civilianDeaths || 0) + 1;
        if (this.civilianDeaths >= 5 && typeof AudioSystem !== 'undefined' && AudioSystem.stopPanicScream) {
            AudioSystem.stopPanicScream();
        }
        if (this.civilianDeaths >= 2 && !this.airRaidTriggered) {
            this.airRaidTriggered = true;
            const isCityMap = (typeof Maps !== 'undefined' && Maps.currentMap === 'city');
            if (typeof AudioSystem !== 'undefined' && !isCityMap) {
                if (AudioSystem.stopBGM) AudioSystem.stopBGM();
                if (AudioSystem.playAirRaidAlarm) AudioSystem.playAirRaidAlarm(14000);
            }
            if (typeof Maps !== 'undefined' && Maps.currentMap === 'city') {
                if (this.airRaidBomberTimeout) {
                    clearTimeout(this.airRaidBomberTimeout);
                }
                this.airRaidBomberTimeout = setTimeout(() => {
                    if (!this.running || this.isGameOver || this.paused) return;
                    const enemyHQ = this.buildings.find(b => b.type === 'hq_enemy');
                    const spawnX = enemyHQ ? (enemyHQ.x - 50) : (CONFIG.mapWidth - 120);
                    this.spawnUnitDirect('bomber', spawnX, this.groundY, 'enemy');
                }, 30000);
            }
        }
    },

    onAirRaidEnded() {
        if (typeof Maps === 'undefined' || Maps.currentMap !== 'city') return;
        const playerHQ = this.buildings.find(b => b.type === 'hq_player');
        const enemyHQ = this.buildings.find(b => b.type === 'hq_enemy');
        const evacX = playerHQ ? playerHQ.x : (enemyHQ ? enemyHQ.x : 100);
        this.civilianEvacActive = true;
        this.civilianEvacX = evacX;
        if (Array.isArray(this.civilians)) {
            this.civilians.forEach(c => {
                if (!c || c.dead) return;
                c.wanderTargetX = evacX;
                c.wanderTimer = 0;
            });
        }
    },

    spawnEnemy(key) {
        const u = CONFIG.units[key];
        if (!u) return false;
        if (this.isEnemySpawnBlockedUnit(key)) return false;
        if (this.enemySupply < u.cost || this.enemyCooldowns[key] > 0 || this.enemyStock[key] <= 0) return false;
        const hasEnemyHqType = this.buildings.some(b => b && b.type === 'hq_enemy');
        const hq = this.buildings.find(b => b && !b.dead && b.type === 'hq_enemy');
        if (hasEnemyHqType && !hq) return false;

        this.enemySupply -= u.cost;
        this.enemyCooldowns[key] = u.cooldown;
        this.enemyStock[key]--;
        const spawnX = hq ? (hq.x - 50) : (CONFIG.mapWidth - 120);
        this.spawnUnitDirect(key, spawnX, this.groundY, 'enemy');
        return true;
    },

    // [New] Speed Control
    speed: 1,
    paused: false,
    // HUD
    minimapVisible: true,

    setSpeed(s) {
        this.speed = s;
        // 즉시 UI 갱신(미니맵 아래 버튼 상태)
        if (typeof ui !== 'undefined') ui.updateSpeedBtns(this.speed);
        // [NEW] Update fixed HUD speed buttons
        if (typeof HUD !== 'undefined') HUD.updateSpeedButtons(this.speed);
    },

    setPaused(p) {
        this.paused = !!p;
        if (typeof HUD !== 'undefined' && HUD.updatePauseButton) {
            HUD.updatePauseButton(this.paused);
        }
    },

    togglePause() {
        this.setPaused(!this.paused);
    },

    updateZoomUI() {
        if (typeof GameCamera !== 'undefined' && GameCamera.updateZoomUI) {
            GameCamera.updateZoomUI(this);
        }
    },

    centerCameraForBattleStart() {
        const viewW = (typeof Camera !== 'undefined' && typeof Camera.viewW === 'function')
            ? Camera.viewW(this)
            : this.width;
        const mapW = Math.max(viewW, Number(CONFIG.mapWidth) || viewW);
        const centered = (mapW * 0.5) - (viewW * 0.5); // 섬/전장 중앙
        if (typeof Camera !== 'undefined' && typeof Camera.clampCameraX === 'function') {
            this.cameraX = Camera.clampCameraX(this, centered);
        } else {
            this.cameraX = Math.max(0, Math.min(centered, mapW - viewW));
        }
    },

    zoomIn() {
        if (typeof GameCamera !== 'undefined' && GameCamera.zoomIn) {
            GameCamera.zoomIn(this);
        }
    },

    zoomOut() {
        if (typeof GameCamera !== 'undefined' && GameCamera.zoomOut) {
            GameCamera.zoomOut(this);
        }
    },

    // Minimap open/close (deprecated - minimap always visible in new HUD)
    toggleMinimap() {
        // Legacy: kept for compatibility but no longer toggles
        // New HUD always shows minimap
        this.minimapVisible = true;
    },

    // [NEW] Camera lock
    getPrimarySelectedUnit() {
        if (typeof GameCamera !== 'undefined' && GameCamera.getPrimarySelectedUnit) {
            return GameCamera.getPrimarySelectedUnit(this);
        }
        return null;
    },

    isCameraLocked() {
        if (typeof GameCamera !== 'undefined' && GameCamera.isCameraLocked) {
            return GameCamera.isCameraLocked(this);
        }
        return !!this.cameraLockActive;
    },

    toggleCameraLock() {
        if (typeof GameCamera !== 'undefined' && GameCamera.toggleCameraLock) {
            GameCamera.toggleCameraLock(this);
        }
    },

    applyCameraLock() {
        if (typeof GameCamera !== 'undefined' && GameCamera.applyCameraLock) {
            GameCamera.applyCameraLock(this);
        }
    },

    _reportLoopError(scope, err) {
        const mapId = (typeof Maps !== 'undefined' && Maps.currentMap) ? Maps.currentMap : 'unknown';
        const frame = Number.isFinite(this.frame) ? this.frame : 0;
        const name = (err && err.name) ? err.name : 'Error';
        const message = (err && err.message) ? err.message : String(err);
        const key = `${scope}|${mapId}|${name}|${message}`;
        const now = Date.now();

        if (!this._loopErrorState) {
            this._loopErrorState = { key: '', at: 0, count: 0 };
        }

        const sameError = this._loopErrorState.key === key && (now - this._loopErrorState.at) < 2000;
        this._loopErrorState.key = key;
        this._loopErrorState.at = now;
        this._loopErrorState.count = sameError ? (this._loopErrorState.count + 1) : 1;

        const repeat = this._loopErrorState.count > 1 ? ` x${this._loopErrorState.count}` : '';
        console.error(`[GameLoop:${scope}] map=${mapId} frame=${frame}${repeat}`, err);
    },

    _drawFallbackFrame() {
        if (!this.ctx) return;
        try {
            const ctx = this.ctx;
            ctx.setTransform(1, 0, 0, 1, 0, 0);
            ctx.clearRect(0, 0, this.width, this.height);
            ctx.fillStyle = '#0f172a';
            ctx.fillRect(0, 0, this.width, this.height);
            ctx.fillStyle = '#e2e8f0';
            ctx.font = 'bold 18px sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText('Recovering render loop...', Math.floor(this.width / 2), Math.floor(this.height / 2));
        } catch (_) { }
    },

    loop() {
        if (typeof GameRuntimeLoop !== 'undefined' && GameRuntimeLoop && typeof GameRuntimeLoop.loop === 'function') {
            return GameRuntimeLoop.loop(this);
        }
    },

    update() {
        if (typeof GameRuntimeLoop !== 'undefined' && GameRuntimeLoop && typeof GameRuntimeLoop.update === 'function') {
            return GameRuntimeLoop.update(this);
        }
    },

    renderUI() {
        if (typeof GameRuntimeLoop !== 'undefined' && GameRuntimeLoop && typeof GameRuntimeLoop.renderUI === 'function') {
            return GameRuntimeLoop.renderUI(this);
        }
    },

    draw() {
        if (typeof GameRuntimeLoop !== 'undefined' && GameRuntimeLoop && typeof GameRuntimeLoop.draw === 'function') {
            return GameRuntimeLoop.draw(this);
        }
    },

    toggleScope() {
        const modal = document.getElementById('scope-modal');
        modal.classList.toggle('hidden');
        ui.updateEnemyStatus(this.enemyStock);
    },

    toggleMap() {
        // Replaced by HUD
    },

    drawHUD() {
        if (typeof GameRuntimeLoop !== 'undefined' && GameRuntimeLoop && typeof GameRuntimeLoop.drawHUD === 'function') {
            return GameRuntimeLoop.drawHUD(this);
        }
    },

    drawHUDMinimap() {
        const cvs = document.getElementById('hud-minimap');
        if (!cvs) return;
        const ctx = cvs.getContext('2d');
        if (cvs.width !== cvs.clientWidth) { cvs.width = cvs.clientWidth; cvs.height = cvs.clientHeight; }

        ctx.fillStyle = '#0f172a'; ctx.fillRect(0, 0, cvs.width, cvs.height);
        const scale = cvs.width / CONFIG.mapWidth;
        const groundY = cvs.height * 0.7;

        ctx.strokeStyle = '#334155'; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(0, groundY); ctx.lineTo(cvs.width, groundY); ctx.stroke();

        this.buildings.forEach(b => {
            ctx.fillStyle = b.team === 'player' ? '#3b82f6' : (b.team === 'enemy' ? '#ef4444' : '#eab308');
            const w = Math.max(2, b.width * scale);
            const h = Math.max(2, b.height * scale);
            ctx.fillRect(b.x * scale - w / 2, groundY - h, w, h);
        });

        ctx.fillStyle = '#60a5fa'; this.players.forEach(u => ctx.fillRect(u.x * scale, groundY - 2, 2, 2));
        ctx.fillStyle = '#f87171'; this.enemies.forEach(u => ctx.fillRect(u.x * scale, groundY - 2, 2, 2));

        const cw = (Camera.viewW(this) / CONFIG.mapWidth) * cvs.width;
        const cx = (this.cameraX / CONFIG.mapWidth) * cvs.width;
        ctx.strokeStyle = '#fbbf24'; ctx.lineWidth = 1; ctx.strokeRect(cx, 0, cw, cvs.height);
    },

    // [FIX] 메모리 누수 방지 - 게임 종료 시 타이머 정리
    _stopPersistentBattleSfx() {
        const visited = new Set();
        const unitLists = [this.players, this.enemies, this.civilians];

        unitLists.forEach((list) => {
            if (!Array.isArray(list)) return;
            list.forEach((unit) => {
                if (!unit || visited.has(unit)) return;
                visited.add(unit);
                if (typeof unit._stopTankMGSound === 'function') {
                    try { unit._stopTankMGSound(); } catch (_) { }
                }
            });
        });

        if (typeof AudioSystem !== 'undefined' && typeof AudioSystem.stopIcbmRaise === 'function') {
            try { AudioSystem.stopIcbmRaise(true); } catch (_) { }
        }
    },

    _cleanupTimers() {
        // 전투 루프가 멈출 때 남아있는 지속 사운드(MBT 기관총/ICBM 상승음) 정리
        this._stopPersistentBattleSfx();

        // AI 타이머 정리
        if (typeof AI !== 'undefined') {
            if (AI._nukeWarningTimeout) { clearTimeout(AI._nukeWarningTimeout); AI._nukeWarningTimeout = null; }
            if (AI._tacticalWarningTimeout) { clearTimeout(AI._tacticalWarningTimeout); AI._tacticalWarningTimeout = null; }
        }
        // 폭격기 에어레이드 타이머 정리
        if (this.airRaidBomberTimeout) { clearTimeout(this.airRaidBomberTimeout); this.airRaidBomberTimeout = null; }
        // 미니맵 인터벌 정리
        if (this._minimapInterval) { clearInterval(this._minimapInterval); this._minimapInterval = null; }
        // 유닛 생산 홀드 타이머 정리
        if (this.holdTimer) { clearInterval(this.holdTimer); this.holdTimer = null; }
        // 뉴스 타이머 정리
        if (typeof NewsOverlay !== 'undefined') {
            if (NewsOverlay._showTimer) { clearTimeout(NewsOverlay._showTimer); NewsOverlay._showTimer = null; }
            if (NewsOverlay._hideTimer) { clearTimeout(NewsOverlay._hideTimer); NewsOverlay._hideTimer = null; }
        }
        if (typeof NewsIntro !== 'undefined' && NewsIntro._timer) {
            clearTimeout(NewsIntro._timer); NewsIntro._timer = null;
        }
    },

    endGame(result, title, desc) {
        if (this.isGameOver) return;
        this.isGameOver = true;
        this.running = false;
        this._uiRecoverySuspendUntil = Date.now() + 3000;

        try {
            if (typeof CitySimDrillgroundBubbles !== 'undefined'
                && CitySimDrillgroundBubbles
                && typeof CitySimDrillgroundBubbles.queueBattleEvent === 'function') {
                const eventType = result === 'win' ? 'battle_post_victory' : 'battle_post_defeat';
                CitySimDrillgroundBubbles.queueBattleEvent(this, eventType, { immediate: true });
            }
        } catch (err) {
            console.warn('[endGame] drillground bubble result-event queue failed:', err);
        }

        // 국지전 모드 정리
        try {
            this._cleanupSkirmishSession();
        } catch (err) {
            console.warn('[endGame] skirmish cleanup failed:', err);
        }

        // [FIX] 메모리 누수 방지 - 타이머 정리
        try {
            this._cleanupTimers();
        } catch (err) {
            console.warn('[endGame] timer cleanup failed:', err);
        }

        try {
            if (result === 'win') {
                if (typeof Maps !== 'undefined' && Maps.currentMap) {
                    this.markMapCleared(Maps.currentMap);
                }
            }
        } catch (err) {
            console.warn('[endGame] map clear mark failed:', err);
        }

        const campaignStageId = Math.floor(Number(this.activeCampaignStageId) || 0);
        if (campaignStageId > 0) {
            try {
                this.completeCampaignStage(campaignStageId, result === 'win');
            } catch (err) {
                console.warn('[endGame] completeCampaignStage failed:', err);
            }
            this.activeCampaignStageId = null;
        }
        this._campaignBattleTab = '';

        // [NEW] 게임 오버(승/패 무관)에도 난이도/맵 진행도 저장
        if (typeof app !== 'undefined' && app.saveNow) {
            try {
                app.saveNow();
            } catch (err) {
                console.warn('[endGame] app save failed:', err);
            }
        }

        // [R 4.2] 작전실패 시 하단 유닛생성바 숨김
        this.cancelTargeting();
        document.getElementById('unit-panel-container')?.classList.add('hidden');
        document.getElementById('hud-footer')?.classList.add('hidden');
        if (typeof HUD !== 'undefined') HUD.hide();
        if (typeof NewsIntro !== 'undefined') NewsIntro.hide();
        if (typeof NewsOverlay !== 'undefined') NewsOverlay.hide();

        const s = document.getElementById('end-screen');
        const titleEl = document.getElementById('end-title');
        const descEl = document.getElementById('end-desc');
        if (s) {
            s.classList.remove('hidden');
            s.style.display = 'flex';
        }
        if (titleEl) {
            titleEl.innerText = title;
            titleEl.className = `text-5xl font-bold mb-4 ${result === 'win' ? 'text-blue-500' : 'text-red-500'}`;
        }
        if (descEl) {
            descEl.innerText = desc;
        }
    },

    // ================================
    // [NEW] 임무 목표 시스템
    // ================================
    _updateMissionObjectiveText() {
        if (!this.$missionText) return;
        const map = (typeof Maps !== 'undefined' && Maps.currentMap) ? Maps.currentMap : 'plain';
        const campaignBattleTab = String(this._campaignBattleTab || '').trim().toLowerCase();
        if (campaignBattleTab === 'occupation') {
            const stageId = Math.floor(Number(this.activeCampaignStageId) || 0);
            if (stageId === 7) {
                this.$missionText.textContent = '10:00까지 방어선을 유지하고 적의 총공세를 버텨내세요.';
                return;
            }
            const limitMinutes = stageId === 1 ? 24 : 12;
            const timerLabel = `${String(limitMinutes).padStart(2, '0')}:00`;
            this.$missionText.textContent = `${timerLabel} 안에 적 총사령부를 파괴하거나 적을 모두 섬멸하세요.`;
            return;
        }
        if (campaignBattleTab === 'skirmish') {
            this.$missionText.textContent = '모든적을 섬멸하세요.';
            return;
        }
        const survivalTime = (typeof Maps !== 'undefined') ? Maps.getRule('survivalTime') : 600;
        const totalSeconds = Number.isFinite(survivalTime) ? survivalTime : 600;
        const min = Math.floor(totalSeconds / 60).toString().padStart(2, '0');
        const sec = Math.floor(totalSeconds % 60).toString().padStart(2, '0');
        const survivalLabel = `${min}:${sec}`;
        let text = '';
        switch (map) {
            case 'city':
                text = `${survivalLabel}까지 버티거나 적을 모두 섬멸하세요.`;
                break;
            case 'plain':
            case 'mountain':
                text = `${survivalLabel}까지 버티거나 적을 모두 섬멸하세요.`;
                break;
            case 'village':
                text = `${survivalLabel}까지 버티거나 적을 모두 섬멸하세요.`;
                break;
            default:
                text = '작전을 성공적으로 완수하세요.';
        }
        this.$missionText.textContent = text;
    },

    showMissionObjective() {
        if (this.$missionModal) {
            this.$missionModal.classList.remove('hidden');
        }
    },

    hideMissionObjective() {
        if (this.$missionModal) {
            this.$missionModal.classList.add('hidden');
        }
    }
};

// App runtime/storage moved to split modules.
// - src/game/app_persistence.js
// - src/game/app_runtime.js
window.onload = () => game.init();

