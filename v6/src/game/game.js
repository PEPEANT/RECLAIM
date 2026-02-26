// [FILE] game.js: ?? ??/??/? ??? ???? ?? ??? ?? ????.
// [RULE] 신규 기능 로직은 game.js에 직접 추가하지 말고 src/* 모듈로 분리 후 연결 (docs/engineering/CODE_ORGANIZATION_RULES.md 참고).
// [RULE] 인게임 안내/상태/채팅 메시지는 UI 토스트 금지. ChatPanel.push()로만 출력.
const LOGICAL_HEIGHT = 840;

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

function getGameTeamColor(team, variant = 'primary') {
    const key = String(team || '').trim().toLowerCase();
    if (typeof TeamColors !== 'undefined' && TeamColors && typeof TeamColors.get === 'function') {
        if (key === 'neutral') return (variant === 'minimap') ? '#eab308' : '#64748b';
        return TeamColors.get(key, variant === 'light' ? 'light' : 'primary');
    }
    if (key === 'player') return (variant === 'light') ? '#60a5fa' : '#3b82f6';
    if (key === 'enemy') return (variant === 'light') ? '#8cab43' : '#6b8e23';
    return (variant === 'minimap') ? '#eab308' : '#64748b';
}

const MAP_SELECT_BGM_FILE = (
    (typeof window !== 'undefined'
        && window
        && window.RECLAIM_AUDIO_MANIFEST
        && window.RECLAIM_AUDIO_MANIFEST.ost
        && window.RECLAIM_AUDIO_MANIFEST.ost.maps
        && window.RECLAIM_AUDIO_MANIFEST.ost.maps.map_select)
    || 'bgm/ost/maps/map_select.mp3'
);
const DEFAULT_BATTLE_MAP_ID = 'skirmish_kabul';
const BATTLE_MAP_IDS = Object.freeze([
    DEFAULT_BATTLE_MAP_ID,
    'skirmish_coast'
]);
const ENEMY_ICBM_SPAWN_UNLOCK_DELAY_FRAMES = 60 * 120; // 2 minutes
const COAST_ENEMY_INFANTRY_FOCUS_FRAMES = 60 * 75; // 75 seconds

// 퀘스트 미션 로직은 별도 모듈로 분리됨.

const game = {
    canvas: document.getElementById('game-canvas'),
    ctx: null, width: 0, height: 0, groundY: 0,
    frame: 0, running: false, cameraX: 0,
    minimapInterval: 8,
    groundUnitLiftPx: 62,
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
    groundLaneBaseOffset: 0,
    groundLaneSpread: 0,
    mobileCameraPivotOffsetY: 0,
    mobileCameraPivotUserPercent: 0,
    mobileViewportActive: false,
    landingIntroController: null,
    _landingSpawnUiLocked: false,

    // [NEW] Total War Trigger Flag
    totalWarTriggered: false,

    // [NEW] 프리게임 커스텀 옵션
    settings: {
        includeForwardDefense: false,
        iogAlwaysOpen: false,
    },
    mapOrder: BATTLE_MAP_IDS.slice(),
    clearedMaps: [DEFAULT_BATTLE_MAP_ID],
    firstRunDone: true,
    _uiRecoverySuspendUntil: 0,
    _uiBlankTicks: 0,
    _resumeAfterVisibilityHidden: false,
    devUnlockAllMaps: true,
    _tempAdminUnlockUid: '',
    _devPPressCount: 0,
    _devLastPPressAt: 0,

    players: [], enemies: [], civilians: [], projectiles: [], particles: [], buildings: [], wreckages: [], corpses: [],
    wreckageCap: 18,
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
        corpseCacheBuildBudget: 2,      // 프레임당 시체 캐시 생성 허용량
        corpseNoFilter: false,          // true: ctx.filter 비활성 (성능 테스트용)
        showUnitHitboxes: false         // true: unit touch/debug hitbox overlay 표시
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
    skillCharges: { emp: 1, nuke: 1, tactical: 1 },
    enemyIcbmNextAllowedFrame: 0,
    enemyIcbmSpawnUnlockFrame: ENEMY_ICBM_SPAWN_UNLOCK_DELAY_FRAMES,
    enemyLastIcbmFrame: -999999,
    enemyLastEmpLaunchFrame: -999999,
    empTimer: 0, targetingType: null, killCount: 0,
    reconLockStrikeCooldownUntilFrame: 0,
    reconLockStrikeBaseCooldownFrames: 60 * 18,
    reconLockStrikeDuplicateGuardFrames: 18,
    _reconLockStrikeLastTargetRef: null,
    _reconLockStrikeLastFireFrame: -999999,
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
    battleArmorNewsShown: false,
    battleMidNewsShown: false,
    battleTotalWarNewsShown: false,
    nukePanicPlayed: false,
    cameramanDisabled: true,

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
    _groundLaneUidSeq: 1,
    _spawnSpreadSeq: null,

    _ensureSpawnSpreadSeq() {
        if (!this._spawnSpreadSeq || typeof this._spawnSpreadSeq !== 'object') {
            this._spawnSpreadSeq = {
                player: { infantry: 0, armored: 0, ground: 0 },
                enemy: { infantry: 0, armored: 0, ground: 0 }
            };
        }
        return this._spawnSpreadSeq;
    },

    _nextSpawnSpreadSlot(team = 'player', role = 'ground') {
        const seq = this._ensureSpawnSpreadSeq();
        const teamKey = (team === 'enemy') ? 'enemy' : 'player';
        const roleKey = (role === 'infantry' || role === 'armored') ? role : 'ground';
        const current = Number(seq[teamKey][roleKey]) || 0;
        seq[teamKey][roleKey] = current + 1;

        const xPattern = [0, 1, -1, 2, -2, 3, -3];
        const lanePattern = [3, 2, 4, 1, 5, 0, 6];
        return {
            xStep: xPattern[current % xPattern.length],
            laneIndex: lanePattern[current % lanePattern.length]
        };
    },

    getGroundWalkBounds() {
        const gyRaw = Number(this.groundY);
        const hRaw = Number(this.height);
        const gy = Number.isFinite(gyRaw) ? gyRaw : 0;
        const h = Number.isFinite(hRaw) ? hRaw : (gy + 320);
        const liftRaw = Number(this.groundUnitLiftPx);
        const lift = Number.isFinite(liftRaw) ? Math.max(0, Math.min(120, liftRaw)) : 0;
        const groundBand = Math.max(120, h - gy);
        // Keep combat walkers in lower grass band (away from the upper ground edge line).
        const min = Math.max(gy + 34, gy + Math.max(90, Math.round(groundBand * 0.34)) - lift);
        const max = Math.max(min + 32, (h - 26) - lift);
        const base = min + ((max - min) * 0.58);
        return { base, min, max };
    },

    getGroundLaneBaseY() {
        return this.getGroundWalkBounds().base;
    },

    getGroundLaneBounds() {
        const bounds = this.getGroundWalkBounds();
        return {
            base: Number(bounds.base) || 0,
            min: Number(bounds.min) || 0,
            max: Number(bounds.max) || 0
        };
    },

    clampGroundLaneY(y) {
        const bounds = this.getGroundLaneBounds();
        const value = Number(y);
        const safe = Number.isFinite(value) ? value : bounds.base;
        return Math.max(bounds.min, Math.min(bounds.max, safe));
    },

    getCameraPivotUserRangePx() {
        const h = Number(this.height);
        const raw = Number.isFinite(h) && h > 0 ? Math.round(h * 0.11) : 90;
        return Math.max(56, Math.min(130, raw));
    },

    getCameraPivotSnapRangePx() {
        const h = Number(this.height);
        const raw = Number.isFinite(h) && h > 0 ? Math.round(h * 0.24) : 170;
        return Math.max(120, Math.min(260, raw));
    },

    setCameraPivotUserPercent(percent) {
        const raw = Number(percent);
        const safe = Number.isFinite(raw) ? raw : 0;
        const clamped = Math.max(-100, Math.min(100, safe));
        // 3-step snap only: -100(bottom view), 0(mid), +100(sky)
        let snapped = 0;
        if (clamped >= 50) snapped = 100;
        else if (clamped <= -50) snapped = -100;
        this.mobileCameraPivotUserPercent = snapped;
        return snapped;
    },

    getCameraPivotUserPercent() {
        const raw = Number(this.mobileCameraPivotUserPercent);
        const safe = Number.isFinite(raw) ? raw : 0;
        return Math.max(-100, Math.min(100, safe));
    },

    getCameraPivotY() {
        const laneBaseRaw = (typeof this.getGroundLaneBaseY === 'function')
            ? Number(this.getGroundLaneBaseY())
            : Number(this.groundY);
        const fallbackBase = Number.isFinite(laneBaseRaw)
            ? laneBaseRaw
            : (Number.isFinite(Number(this.groundY)) ? Number(this.groundY) : 0);
        const combatBandRaw = Number(this.height) - Number(this.groundY);
        const combatBand = Number.isFinite(combatBandRaw) ? Math.max(60, combatBandRaw) : 300;
        const infantryFeetBias = Math.max(10, Math.min(34, Math.round(combatBand * 0.08)));
        const offset = Number(this.mobileCameraPivotOffsetY);
        const safeOffset = Number.isFinite(offset) ? offset : 0;
        let userOffset = 0;
        if (this.mobileViewportActive === true) {
            const userPercent = this.getCameraPivotUserPercent();
            const stage = (userPercent >= 50) ? 1 : ((userPercent <= -50) ? -1 : 0);
            const snapRange = this.getCameraPivotSnapRangePx();
            // 3-stage camera presets:
            // stage -1 = lower/background focus, 0 = middle, +1 = sky focus.
            userOffset = -(stage * snapRange);
        }
        const raw = fallbackBase + infantryFeetBias + safeOffset + userOffset;
        const h = Number(this.height);
        if (Number.isFinite(h) && h > 0) {
            return Math.max(0, Math.min(h, raw));
        }
        return Math.max(0, raw);
    },

    isGroundLaneUnit(unit) {
        if (!unit || !unit.stats) return false;
        if (unit.stats.type === 'air') return false;
        if (unit.stats.civilian === true) return false;
        if (unit.isCameraman || unit.stats.isCameraman) return false;
        return true;
    },

    isTriAxisInfantryUnit(unit) {
        // Legacy path kept for compatibility. Current ground movement uses randomized lane scatter.
        return false;
    },

    _allocGroundLaneUid(unit) {
        if (!unit || typeof unit !== 'object') return 0;
        const current = Number(unit._groundLaneUid);
        if (!Number.isFinite(current) || current <= 0) {
            unit._groundLaneUid = this._groundLaneUidSeq++;
        }
        return Number(unit._groundLaneUid) || 0;
    },

    getTriAxisInfantryY(unit) {
        const bounds = this.getGroundLaneBounds();
        this._allocGroundLaneUid(unit);

        if (!Number.isFinite(Number(unit._triAxisLaneIndex))) {
            const uid = Number(unit._groundLaneUid) || 0;
            const baseIdx = ((uid % 3) + 3) % 3;
            const enemyShift = (unit.team === 'enemy') ? 1 : 0;
            unit._triAxisLaneIndex = (baseIdx + enemyShift) % 3;
        }

        const idxRaw = Number(unit._triAxisLaneIndex);
        const idx = Number.isFinite(idxRaw) ? Math.max(0, Math.min(2, Math.floor(idxRaw))) : 1;
        const span = Math.max(40, Number(bounds.max) - Number(bounds.min));
        const laneGap = Math.max(20, Math.min(38, span * 0.17));
        const laneOffsets = [-laneGap, 0, laneGap];
        return this.clampGroundLaneY(Number(bounds.base) + laneOffsets[idx]);
    },

    getGroundLaneSpreadRange(unit) {
        const bounds = this.getGroundLaneBounds();
        const span = Math.max(40, Number(bounds.max) - Number(bounds.min));
        if (!unit || !unit.stats) return Math.max(24, span * 0.32);

        const stats = unit.stats || {};
        const id = String(stats.id || '').trim().toLowerCase();
        const category = String(stats.category || '').trim().toLowerCase();
        const type = String(stats.type || '').trim().toLowerCase();

        if (id === 'icbm' || id === 'icbm_enemy') {
            return Math.max(34, span * 0.44);
        }
        if (category === 'infantry' || type === 'bio') {
            return Math.max(26, span * 0.40);
        }
        if (category === 'armored' || type === 'mech' || type === 'vehicle') {
            return Math.max(24, span * 0.34);
        }
        return Math.max(24, span * 0.32);
    },

    getGroundLaneY(unit) {
        if (!this.isGroundLaneUnit(unit)) {
            const gy = Number(this.groundY);
            return Number.isFinite(gy) ? gy : this.getGroundLaneBaseY();
        }

        const bounds = this.getGroundLaneBounds();
        this._allocGroundLaneUid(unit);

        const hasInitFlag = unit && unit._groundLaneOffsetInitialized === true;
        const currentOffset = Number(unit && unit._groundLaneOffset);
        const needsInit = !hasInitFlag || !Number.isFinite(currentOffset);
        if (needsInit) {
            const range = this.getGroundLaneSpreadRange(unit);
            const teamBias = (unit.team === 'player')
                ? (-range * 0.08)
                : ((unit.team === 'enemy') ? (range * 0.08) : 0);
            const randomOffset = (Math.random() * 2 - 1) * range;
            unit._groundLaneOffset = teamBias + randomOffset;
            unit._groundLaneOffsetInitialized = true;
        } else if (Math.abs(currentOffset) < 0.001) {
            // Legacy save compatibility: zero-offset units tend to collapse into a single lane.
            const range = this.getGroundLaneSpreadRange(unit);
            const randomOffset = (Math.random() * 2 - 1) * Math.max(8, range * 0.55);
            unit._groundLaneOffset = randomOffset;
            unit._groundLaneOffsetInitialized = true;
        }

        return this.clampGroundLaneY(Number(bounds.base) + Number(unit._groundLaneOffset || 0));
    },

    isFeatureFlagEnabled(flagName) {
        const key = String(flagName || '').trim();
        if (!key) return false;
        const flags = (typeof window !== 'undefined'
            && window.RECLAIM_FEATURE_FLAGS
            && typeof window.RECLAIM_FEATURE_FLAGS === 'object')
            ? window.RECLAIM_FEATURE_FLAGS
            : null;
        return !!(flags && flags[key] === true);
    },

    planAirFormationAssignments(unitList, targetX) {
        if (!Array.isArray(unitList) || unitList.length === 0) return null;
        const anchorX = Number(targetX);
        if (!Number.isFinite(anchorX)) return null;

        const candidates = unitList.filter((u) => {
            if (!u || u.dead || !u.stats) return false;
            if (u.stats.type !== 'air') return false;
            if (u.stats.operator) return false;
            const category = String(u.stats.category || '').trim().toLowerCase();
            const id = String(u.stats.id || '').trim().toLowerCase();
            const isDroneFamily = category === 'drone' || id.includes('drone');
            return !isDroneFamily;
        });
        if (candidates.length <= 0) return null;

        const centerX = candidates.reduce((acc, u) => acc + (Number(u.x) || 0), 0) / candidates.length;
        const dir = (anchorX >= centerX) ? 1 : -1;
        const mapW = Number((typeof CONFIG !== 'undefined' && CONFIG) ? CONFIG.mapWidth : NaN);
        const widthSamples = candidates.map((u) => {
            const wRaw = Number(u.width);
            if (Number.isFinite(wRaw) && wRaw > 0) return wRaw;
            const swRaw = Number(u.stats && u.stats.width);
            return (Number.isFinite(swRaw) && swRaw > 0) ? swRaw : 52;
        });
        const totalWidth = widthSamples.reduce((acc, w) => acc + w, 0);
        const avgWidth = (widthSamples.length > 0) ? (totalWidth / widthSamples.length) : 52;
        const maxWidth = widthSamples.reduce((m, w) => Math.max(m, w), 52);
        // Large airframes need wider spacing to avoid overlap in mixed groups.
        const trailingStepX = Math.max(36, Math.min(88, Math.round((avgWidth * 0.52) + (maxWidth * 0.26) + 10)));
        const sideStepY = Math.max(20, Math.min(54, Math.round(trailingStepX * 0.56)));

        // Stable ordering keeps wing assignments from shuffling every right-click.
        const sorted = candidates.slice().sort((a, b) => {
            const ax = Number(a.x) || 0;
            const bx = Number(b.x) || 0;
            if (ax !== bx) return ax - bx;
            const ay = Number(a.y) || 0;
            const by = Number(b.y) || 0;
            return ay - by;
        });

        const slots = [];
        for (let i = 0; i < sorted.length; i++) {
            if (i === 0) {
                slots.push(0);
                continue;
            }
            const wing = Math.ceil(i / 2);
            const side = (i % 2 === 1) ? -1 : 1;
            slots.push(side * wing);
        }

        const plan = new Map();
        sorted.forEach((u, index) => {
            const slot = Number(slots[index]) || 0;
            const depth = Math.abs(slot);
            const side = slot === 0 ? 0 : (slot > 0 ? 1 : -1);
            const uid = Number(u._groundLaneUid) || (index + 1);

            const jitterScaleX = Math.max(3, trailingStepX * 0.12);
            const jitterScaleY = Math.max(2, sideStepY * 0.16);
            let jitterX = ((((uid * 17) % 11) - 5) * jitterScaleX * 0.22);
            let jitterY = ((((uid * 29) % 9) - 4) * jitterScaleY * 0.24);
            if (depth <= 0) {
                jitterX = 0;
                jitterY = 0;
            }

            const offsetX = (-dir * depth * trailingStepX) + jitterX;
            const offsetY = (side * Math.min(4, depth) * sideStepY) + jitterY;
            let commandX = anchorX + offsetX;
            if (Number.isFinite(mapW) && mapW > 80) {
                commandX = Math.max(24, Math.min(mapW - 24, commandX));
            }

            plan.set(u, {
                targetX: commandX,
                offsetY,
                slot,
                dir,
                anchorX
            });
        });

        return plan;
    },

    clearAirFormationState(unit) {
        if (!unit || typeof unit !== 'object') return;
        unit._airFormationOffsetY = 0;
        unit._airFormationSlot = null;
        unit._airFormationDir = null;
        unit._airFormationAnchorX = null;
    },

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

    getSelectedReconUnits() {
        if (!this.selectedUnits || this.selectedUnits.size === 0) return [];
        const result = [];
        for (const u of this.selectedUnits) {
            if (!u || u.dead || !u.stats) continue;
            const id = String(u.stats.id || '').trim().toLowerCase();
            if (id === 'recon') result.push(u);
        }
        return result;
    },

    getReconLockStrikeCooldownLeftFrames() {
        const nowFrame = Math.max(0, Math.floor(Number(this.frame) || 0));
        const until = Math.max(0, Math.floor(Number(this.reconLockStrikeCooldownUntilFrame) || 0));
        return Math.max(0, until - nowFrame);
    },

    isReconLockStrikeAvailable() {
        if (this.getSelectedReconUnits().length <= 0) return false;
        return this.getReconLockStrikeCooldownLeftFrames() <= 0;
    },

    _findReconLockStrikeTarget(wx, wy, radius = 260) {
        const nowFrame = Math.max(0, Math.floor(Number(this.frame) || 0));
        const maxDist = Math.max(80, Number(radius) || 260);
        let best = null;
        let bestDist = maxDist;
        const candidates = [...(this.enemies || []), ...(this.enemyBuildings || [])];

        for (const t of candidates) {
            if (!t || t.dead) continue;
            const lockUntil = Math.max(0, Number(t.__reconLockStrikeLockUntilFrame) || 0);
            if (nowFrame < lockUntil) continue;

            const tx = Number(t.x);
            const h = Number(t.height);
            const tyBase = Number(t.y);
            if (!Number.isFinite(tx) || !Number.isFinite(tyBase)) continue;
            const ty = tyBase - (Number.isFinite(h) ? (h * 0.5) : 0);
            const dx = tx - wx;
            const dy = ty - wy;
            const d = Math.hypot(dx, dy);
            if (d <= bestDist) {
                bestDist = d;
                best = t;
            }
        }
        return best;
    },

    _launchReconLockStrikeAtTarget(target) {
        if (!target || target.dead) return false;
        const nowFrame = Math.max(0, Math.floor(Number(this.frame) || 0));
        const duplicateGuardFrames = Math.max(8, Number(this.reconLockStrikeDuplicateGuardFrames) || 18);
        if (
            this._reconLockStrikeLastTargetRef === target &&
            (nowFrame - (Number(this._reconLockStrikeLastFireFrame) || -999999)) <= duplicateGuardFrames
        ) {
            return false;
        }

        const tx = Math.max(40, Math.min(CONFIG.mapWidth - 40, Number(target.x) || 0));
        const tyRaw = Number.isFinite(Number(target.y))
            ? (Number(target.y) - ((Number.isFinite(Number(target.height)) ? Number(target.height) : 0) * 0.5))
            : this.groundY;
        const ty = (typeof this.clampGroundLaneY === 'function')
            ? this.clampGroundLaneY(tyRaw)
            : tyRaw;

        const edgeJitter = (Math.random() * 80) - 40;
        const startX = -140 + edgeJitter;
        const startY = Math.max(70, Math.min(360, ty - 220));

        const shotOpts = {
            source: null,
            targetX: tx,
            targetY: ty,
            arcHeight: 330,
            grav: 0.24,
            hitRadius: 30,
            icbmRiseFrames: 0
        };
        const p = new Projectile(startX, startY, null, 350, 'player', 'icbm_tactical_missile', shotOpts);
        p._tactical = true;
        p._reconLockStrike = true;
        this.projectiles.push(p);

        this._reconLockStrikeLastTargetRef = target;
        this._reconLockStrikeLastFireFrame = nowFrame;
        target.__reconLockStrikeLockUntilFrame = nowFrame + duplicateGuardFrames;

        const cooldownFrames = Math.max(60, Number(this.reconLockStrikeBaseCooldownFrames) || (60 * 18));
        this.reconLockStrikeCooldownUntilFrame = nowFrame + cooldownFrames;

        if (typeof AudioSystem !== 'undefined') AudioSystem.playSFX('rocket_launcher', tx);
        ui.showToast('정찰 락온 타격 발사!');
        if (typeof this.updateHUDSelection === 'function') this.updateHUDSelection();
        if (typeof app !== 'undefined') {
            app.markDirty();
            app.markUiDirty();
        }
        return true;
    },

    isIcbmSkillKey(key) {
        return key === 'nuke' || key === 'tactical_missile' || key === 'emp';
    },

    getEnemyIcbmSpacingFrames(payloadKey = 'tactical_missile') {
        const key = String(payloadKey || '').trim().toLowerCase();
        if (key === 'nuke') return 60 * 44;
        if (key === 'emp') return 60 * 22;
        return 60 * 30;
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
            const ammoLeft = Number(u.icbmAmmoLeft);
            if (Number.isFinite(ammoLeft) && ammoLeft <= 0) return false;
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

        if (team === 'enemy' && !opts.ignoreEnemyGlobalSpacing) {
            const nowFrame = Number(this.frame) || 0;
            const nextAllowed = Number(this.enemyIcbmNextAllowedFrame) || 0;
            if (nowFrame < nextAllowed) return false;
        }

        const tx = Math.max(40, Math.min(CONFIG.mapWidth - 40, Number(targetX) || 0));
        const tyRaw = Number.isFinite(Number(targetY)) ? Number(targetY) : this.groundY;
        const ty = (typeof this.clampGroundLaneY === 'function')
            ? this.clampGroundLaneY(tyRaw)
            : tyRaw;

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

        if (team === 'enemy' && !opts.ignoreEnemyGlobalSpacing) {
            const nowFrame = Number(this.frame) || 0;
            const spacing = this.getEnemyIcbmSpacingFrames(payloadKey);
            this.enemyIcbmNextAllowedFrame = Math.max(
                Number(this.enemyIcbmNextAllowedFrame) || 0,
                nowFrame + spacing
            );
        }

        if (team === 'player' && !opts.bypassCharge) {
            // Battle-only policy: ICBM payload skills keep a fixed baseline charge.
            this.skillCharges[chargeKey] = Math.max(1, Number(this.skillCharges[chargeKey]) || 1);
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
        if (team === 'enemy') {
            const nowFrame = Number(this.frame) || 0;
            this.enemyLastIcbmFrame = nowFrame;
            if (payloadKey === 'emp') this.enemyLastEmpLaunchFrame = nowFrame;
            const spacing = this.getEnemyIcbmSpacingFrames(payloadKey);
            this.enemyIcbmNextAllowedFrame = Math.max(
                Number(this.enemyIcbmNextAllowedFrame) || 0,
                nowFrame + spacing
            );
        }

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
        const ty = (typeof this.clampGroundLaneY === 'function')
            ? this.clampGroundLaneY(tyRaw)
            : tyRaw;

        let projectileType = 'icbm_emp_missile';
        let damage = 0;
        const shotOpts = { source: launcher, targetX: tx, targetY: ty };
        if (payloadKey === 'nuke') {
            projectileType = 'icbm_nuke_missile';
            shotOpts.arcHeight = 520;
            shotOpts.grav = 0.16;
            shotOpts.hitRadius = 44;
            shotOpts.icbmRiseFrames = 30;
        } else if (payloadKey === 'tactical_missile') {
            projectileType = 'icbm_tactical_missile';
            damage = 350;
            shotOpts.arcHeight = 340;
            shotOpts.grav = 0.23;
            shotOpts.hitRadius = 30;
            shotOpts.icbmRiseFrames = 24;
        } else {
            projectileType = 'icbm_emp_missile';
            shotOpts.arcHeight = 390;
            shotOpts.grav = 0.20;
            shotOpts.hitRadius = 42;
            shotOpts.icbmRiseFrames = 26;
        }

        const p = new Projectile(startX, startY, null, damage, team, projectileType, shotOpts);
        if (payloadKey === 'tactical_missile') p._tactical = true;
        this.projectiles.push(p);
        if (this.isIcbmLauncherUnit(launcher)) {
            const currentAmmo = Number(launcher.icbmAmmoLeft);
            if (Number.isFinite(currentAmmo)) {
                launcher.icbmAmmoLeft = Math.max(0, Math.floor(currentAmmo) - 1);
            } else {
                launcher.icbmAmmoLeft = 0;
            }
        }

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

        console.error('[Boot] src/maps/maps.js not loaded. Using fallback Maps shim.');
        window.Maps = {
            types: {
                skirmish: { name: 'Skirmish', sky: '#87CEEB', skyMid: '#b0d4e8', ground: '#4ade80', groundDark: '#16a34a' },
                skirmish_kabul: { name: 'Kabul', sky: '#6E8594', skyMid: '#9e9789', ground: '#3b3d3f', groundDark: '#2a2b2d' },
                skirmish_coast: { name: 'Coast', sky: '#6eaed2', skyMid: '#91c9df', ground: '#b58e63', groundDark: '#8c6a47' }
            },
            rules: {
                skirmish: { playerHQ: true, enemyHQ: true, playerDefense: false, enemyDefense: false, bunkers: false, mapExpand: false, winCondition: 'annihilation' },
                skirmish_kabul: { playerHQ: false, enemyHQ: false, playerDefense: false, enemyDefense: false, bunkers: false, mapExpand: false, winCondition: 'annihilation' },
                skirmish_coast: { playerHQ: false, enemyHQ: false, playerDefense: false, enemyDefense: false, bunkers: false, mapExpand: false, winCondition: 'annihilation' }
            },
            currentMap: DEFAULT_BATTLE_MAP_ID,
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
                const mapId = String(this.currentMap || DEFAULT_BATTLE_MAP_ID).trim() || DEFAULT_BATTLE_MAP_ID;
                const mapRules = (this.rules && this.rules[mapId]) ? this.rules[mapId] : this.rules.skirmish;
                if (mapRules && key in mapRules) return mapRules[key];
                const defaults = {
                    playerHQ: true,
                    enemyHQ: true,
                    playerDefense: false,
                    enemyDefense: false,
                    bunkers: false,
                    mapExpand: false,
                    winCondition: 'annihilation',
                    survivalTime: 600
                };
                return defaults[key];
            },
            drawBase(ctx, width, height, groundY) {
                if (!ctx) return;
                const mapId = String(this.currentMap || DEFAULT_BATTLE_MAP_ID).trim() || DEFAULT_BATTLE_MAP_ID;
                const t = (this.types && this.types[mapId]) ? this.types[mapId] : this.types.skirmish;
                ctx.fillStyle = t.sky || '#87CEEB';
                ctx.fillRect(0, 0, width, Math.max(0, groundY));
                ctx.fillStyle = t.ground || '#4ade80';
                ctx.fillRect(0, groundY, width, Math.max(0, height - groundY));
            },
            drawDecorations(ctx, width, height, groundY, cameraX = 0) {
                return;
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
        ensureTheme(DEFAULT_BATTLE_MAP_ID, { name: 'Kabul', sky: '#6E8594', skyMid: '#9e9789', ground: '#3b3d3f', groundDark: '#2a2b2d' });
        ensureTheme('skirmish_coast', { name: 'Coast', sky: '#6eaed2', skyMid: '#91c9df', ground: '#b58e63', groundDark: '#8c6a47' });

        const ensureRules = (id, defaults) => {
            if (!Maps.rules[id] || typeof Maps.rules[id] !== 'object') Maps.rules[id] = {};
            Maps.rules[id].playerHQ = !!defaults.playerHQ;
            Maps.rules[id].enemyHQ = !!defaults.enemyHQ;
            Maps.rules[id].playerDefense = !!defaults.playerDefense;
            Maps.rules[id].enemyDefense = !!defaults.enemyDefense;
            Maps.rules[id].bunkers = !!defaults.bunkers;
            Maps.rules[id].mapExpand = !!defaults.mapExpand;
            if (!Maps.rules[id].winCondition) Maps.rules[id].winCondition = 'annihilation';
        };
        ensureRules('skirmish', {
            playerHQ: true,
            enemyHQ: true,
            playerDefense: false,
            enemyDefense: false,
            bunkers: false,
            mapExpand: false
        });
        ensureRules(DEFAULT_BATTLE_MAP_ID, {
            playerHQ: false,
            enemyHQ: false,
            playerDefense: false,
            enemyDefense: false,
            bunkers: false,
            mapExpand: false
        });
        ensureRules('skirmish_coast', {
            playerHQ: false,
            enemyHQ: false,
            playerDefense: false,
            enemyDefense: false,
            bunkers: false,
            mapExpand: false
        });
        const ensureNumericRule = (id, key, fallback) => {
            if (!Maps.rules[id] || typeof Maps.rules[id] !== 'object') Maps.rules[id] = {};
            const v = Number(Maps.rules[id][key]);
            if (!Number.isFinite(v) || v <= 0) {
                Maps.rules[id][key] = fallback;
            }
        };
        ensureNumericRule('skirmish_coast', 'mapWidth', 8200);
        ensureNumericRule('skirmish_coast', 'groundLift', 96);
        ensureNumericRule('skirmish_coast', 'playerSpawnX', 520);
        ensureNumericRule('skirmish_coast', 'playerRetreatStopX', 340);
        if (!Maps.currentMap) Maps.currentMap = DEFAULT_BATTLE_MAP_ID;
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
        const isMobileBackFlow = () => {
            let mobileUa = false;
            let coarsePointer = false;
            let touchPoints = 0;
            try {
                mobileUa = /Android|iPhone|iPad|iPod|Mobile/i.test(String(navigator.userAgent || ''));
            } catch (_) { }
            try {
                coarsePointer = !!(window.matchMedia && window.matchMedia('(pointer: coarse)').matches);
            } catch (_) { }
            try {
                touchPoints = Number(navigator.maxTouchPoints) || 0;
            } catch (_) { }
            return !!(mobileUa || (coarsePointer && touchPoints > 0));
        };

        // [NEW] History API Handle for Back Button
        window.addEventListener('popstate', (event) => {
            const isVisible = (id) => {
                const el = document.getElementById(id);
                return !!el && !el.classList.contains('hidden');
            };
            const isMapOpen = isVisible('map-select-screen');
            const isEndOpen = isVisible('end-screen');
            if (this.isGameOver || isEndOpen) {
                history.pushState({ page: 'gameover' }, "GameOver", "#game");
                return;
            }
            if (isMobileBackFlow()) {
                if (this.running) {
                    history.pushState({ page: 'game' }, "Game", "#game");
                } else {
                    history.pushState({ page: 'map-select' }, "MapSelect", "#map-select");
                }
                ui.showExitConfirmation('quit');
                return;
            }
            if (this.running) {
                history.pushState({ page: 'game' }, "Game", "#game");
                ui.showExitConfirmation('retreat');
            } else if (isMapOpen) {
                this.backToLobby();
            } else {
                history.pushState({ page: 'map-select' }, "MapSelect", "#map-select");
                ui.showExitConfirmation('quit');
            }
        });

        // Push initial state
        history.replaceState({ page: 'map-select' }, "MapSelect", "#map-select");

        // Startup flow (cinematic vs loading) is controlled in index.html.
        // Avoid forcing loading screen here; it can override cinematic playback.

        // Visibility / Freeze Prevention
        const persistSessionState = () => {
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
        // Battle-only flow: legacy runtime labels removed.
    },

    applyBattleUnitsToStock() {
        if (typeof CONFIG === 'undefined' || !CONFIG || !CONFIG.units) return;

        if (!this.playerStock || typeof this.playerStock !== 'object') this.playerStock = {};
        if (!this.skillCharges || typeof this.skillCharges !== 'object') this.skillCharges = {};

        Object.keys(CONFIG.units).forEach((key) => {
            const unit = CONFIG.units[key];
            if (!unit) return;
            if (key === 'icbm_enemy') return;
            if (unit.disabled === true) return;

            if (unit.isSkill === true) {
                if (unit.chargeKey) this.skillCharges[unit.chargeKey] = 1;
                return;
            }

            const maxCount = Math.max(0, Math.floor(Number(unit.maxCount) || 0));
            this.playerStock[key] = maxCount > 0 ? maxCount : 12;
        });

        this.playerVeteransById = {};
        this.playerVeteranStock = {};
        this.playerVeteranOrder = [];
    },

    getVeteranSpawnEntries() {
        if (!this.playerVeteransById || typeof this.playerVeteransById !== 'object') return [];
        if (!Array.isArray(this.playerVeteranOrder) || this.playerVeteranOrder.length <= 0) return [];
        if (typeof CONFIG === 'undefined' || !CONFIG || !CONFIG.units) return [];

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
        const list = [];
        this.playerVeteranOrder.forEach((veteranId) => {
            const veteran = this.playerVeteransById[veteranId];
            if (!veteran) return;
            const unit = CONFIG.units[veteran.unitKey];
            if (!unit || unit.disabled === true || unit.isSkill === true) return;
            const stock = Math.max(0, Math.floor(Number(this.playerVeteranStock?.[veteranId]) || 0));

            const unitCategory = String(unit?.category || '').trim().toLowerCase();
            const isOperator = String(veteran?.unitKey || '').trim() === 'drone_operator' || unit?.operator === true;
            const isInfantryCategory = unitCategory === 'infantry';
            const skillKeys = Array.isArray(veteran?.loadout?.skillItemKeys)
                ? veteran.loadout.skillItemKeys
                : [];
            let itemCount = 0;
            const countedSkillKeys = [];
            if (isOperator) {
                for (let slotIndex = 1; slotIndex <= 2; slotIndex++) {
                    const key = String(skillKeys[slotIndex] || '').trim();
                    if (key === 'drone_suicide_item' || key === 'drone_at_item') {
                        itemCount += 1;
                        countedSkillKeys.push(key);
                    }
                }
            } else if (isInfantryCategory) {
                for (let slotIndex = 1; slotIndex <= 2; slotIndex++) {
                    const key = String(skillKeys[slotIndex] || '').trim();
                    if (key === 'smoke_grenade' || key === 'medkit_c') {
                        itemCount += 1;
                        countedSkillKeys.push(key);
                    }
                }
            }

            const passiveItemKey = String(veteran?.loadout?.itemKey || '').trim();
            // 레거시 저장 데이터: 스킬 아이템이 itemKey에만 저장된 경우를 1회 보정 카운트.
            if (itemCount <= 0) {
                if (isOperator && (passiveItemKey === 'drone_suicide_item' || passiveItemKey === 'drone_at_item')) {
                    itemCount += 1;
                    countedSkillKeys.push(passiveItemKey);
                } else if (isInfantryCategory && (passiveItemKey === 'smoke_grenade' || passiveItemKey === 'medkit_c')) {
                    itemCount += 1;
                    countedSkillKeys.push(passiveItemKey);
                }
            }

            // +N은 플레이어가 지급한 아이템만 집계한다.
            // 고정 스킬(예: 보병 rifle_d)과 스킬 슬롯 중복 아이템은 제외.
            const passiveSupported = supportedLoadoutItemKeys.has(passiveItemKey);
            const passiveDuplicatedInSkillSlots = countedSkillKeys.some((key) => key === passiveItemKey);
            const passiveIsSkillItemForUnit = (isOperator && (passiveItemKey === 'drone_suicide_item' || passiveItemKey === 'drone_at_item'))
                || (isInfantryCategory && (passiveItemKey === 'smoke_grenade' || passiveItemKey === 'medkit_c'));
            const passiveIsFixedSkill = isInfantryCategory && passiveItemKey === 'rifle_d';
            if (passiveItemKey
                && passiveSupported
                && !passiveDuplicatedInSkillSlots
                && !passiveIsSkillItemForUnit
                && !passiveIsFixedSkill) {
                itemCount += 1;
            }
            list.push({
                id: veteran.id,
                unitKey: veteran.unitKey,
                unit,
                level: veteran.level,
                name: String(veteran.name || '').trim(),
                displayName: String(veteran.name || '').trim() || String(unit.name || veteran.unitKey),
                stock,
                itemCount: Math.max(0, Math.floor(Number(itemCount) || 0))
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

    // [ITEM] 의료 키트 스킬 ? 자신 + 반경 내 아군 보병 즉시 치유
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

    useBagpipeCommand() {
        if (!this.selectedUnits) return false;
        let started = 0;
        this.selectedUnits.forEach((unit) => {
            if (!unit || unit.dead) return;
            if (!unit.stats || unit.stats.id !== 'bagpiper') return;
            if (typeof unit.startBagpipeSkill === 'function') {
                if (unit.startBagpipeSkill() === true) {
                    started += 1;
                    return;
                }
            }
        });

        if (started > 0 && typeof ui !== 'undefined' && typeof ui.showToast === 'function') {
            ui.showToast('백파이프 연주 시작!');
        }

        if (started > 0 && typeof this.updateHUDSelection === 'function') {
            this.updateHUDSelection();
        }
        return started > 0;
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
        const canSpendSupply = (typeof BattleEconomy !== 'undefined'
            && BattleEconomy
            && typeof BattleEconomy.canSpendSupply === 'function')
            ? BattleEconomy.canSpendSupply(this, cost)
            : this.supply >= cost;
        if (!canSpendSupply) {
            if (typeof ui !== 'undefined' && typeof ui.showToast === 'function') {
                ui.showToast('자원이 부족합니다.');
            }
            return false;
        }

        const spent = (typeof BattleEconomy !== 'undefined'
            && BattleEconomy
            && typeof BattleEconomy.spendSupply === 'function')
            ? BattleEconomy.spendSupply(this, cost)
            : ((this.supply -= cost), true);
        if (!spent) return false;
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
            if (typeof BattleEconomy !== 'undefined'
                && BattleEconomy
                && typeof BattleEconomy.refundSupply === 'function') {
                BattleEconomy.refundSupply(this, cost);
            } else {
                this.supply += cost;
            }
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
        document.getElementById('loading-screen')?.classList.add('hidden');
        this.showMapSelect();
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

    openMapSelect(mode) {
        this.showMapSelect();
    },

    showMapSelect() {
        if (typeof window !== 'undefined' && typeof window.__RECLAIM_RESET_PRE_BATTLE_FLOW__ === 'function') {
            window.__RECLAIM_RESET_PRE_BATTLE_FLOW__();
        }
        if (typeof window !== 'undefined') window.__RECLAIM_BLOCK_FACTION_POPUP__ = false;
        if (typeof window !== 'undefined') window.__RECLAIM_MAP_START_LOCK__ = false;
        if (typeof window !== 'undefined') {
            if (typeof window.__RECLAIM_TRANSITION_FLOW__ === 'function') {
                window.__RECLAIM_TRANSITION_FLOW__('map_select');
            } else {
                window.__RECLAIM_FLOW_PHASE__ = 'map_select';
            }
        }
        document.getElementById('loading-screen')?.classList.add('hidden');
        document.getElementById('team-color-screen')?.classList.add('hidden');
        document.getElementById('map-intro-modal')?.classList.add('hidden');
        document.getElementById('map-select-screen')?.classList.remove('hidden');
        if (typeof AudioSystem !== 'undefined' && AudioSystem) {
            if (typeof AudioSystem.stopBattleMovementAmbience === 'function') {
                try { AudioSystem.stopBattleMovementAmbience(); } catch (_) { }
            }
            if (typeof AudioSystem.stopIcbmRaise === 'function') {
                try { AudioSystem.stopIcbmRaise(true); } catch (_) { }
            }
        }
        this.updateMapSelectLocks();
        this.playMapSelectBgm();
    },

    getUnlockedMapCount() {
        return BATTLE_MAP_IDS.length;
    },

    isMapUnlocked(mapId) {
        const id = String(mapId || '').trim();
        return BATTLE_MAP_IDS.indexOf(id) !== -1;
    },

    updateMapSelectLocks() {
        const cards = document.querySelectorAll('.map-card[data-map]');
        cards.forEach((card) => {
            const mapId = String(card?.dataset?.map || '').trim();
            const known = BATTLE_MAP_IDS.indexOf(mapId) !== -1;
            const unlocked = known && this.isMapUnlocked(mapId);
            card.classList.toggle('locked', !unlocked);
            if ('disabled' in card) card.disabled = !unlocked;
            card.setAttribute('aria-disabled', unlocked ? 'false' : 'true');
            const lock = card.querySelector('.map-lock');
            if (lock) lock.classList.toggle('hidden', unlocked);
            card.classList.toggle('hidden', !known);
        });
    },

    enableDevUnlockAllMaps() {
        this.devUnlockAllMaps = true;
        this.updateMapSelectLocks();
    },

    markMapCleared(mapId) {
        const id = String(mapId || '').trim();
        if (BATTLE_MAP_IDS.indexOf(id) === -1) return;
        if (!Array.isArray(this.clearedMaps)) this.clearedMaps = [];
        if (this.clearedMaps.indexOf(id) === -1) this.clearedMaps.push(id);
        if (this.clearedMaps.indexOf(DEFAULT_BATTLE_MAP_ID) === -1) this.clearedMaps.unshift(DEFAULT_BATTLE_MAP_ID);
        this.firstRunDone = true;
        if (typeof app !== 'undefined' && app && typeof app.markDirty === 'function') {
            app.markDirty();
        }
        this.updateMapSelectLocks();
    },

    resetProgress() {
        this.mapOrder = BATTLE_MAP_IDS.slice();
        this.clearedMaps = [DEFAULT_BATTLE_MAP_ID];
        this.firstRunDone = true;
        this.currentMapId = DEFAULT_BATTLE_MAP_ID;
        this.devUnlockAllMaps = true;
        this._tempAdminUnlockUid = '';
        this.updateMapSelectLocks();
        if (typeof app !== 'undefined') {
            app.markDirty();
            app.saveNow();
        }
        this._clearFactionSelection();
        this.showMapSelect();
    },

    _clearFactionSelection() {
        try {
            if (typeof TeamColors !== 'undefined'
                && TeamColors
                && typeof TeamColors.clearSelection === 'function') {
                TeamColors.clearSelection();
            }
        } catch (err) {
            console.warn('[Faction] clear selection failed:', err);
        }
    },

    _showFactionSelection() {
        try {
            if (this.running === true) return;
            const mapSelectScreen = document.getElementById('map-select-screen');
            if (!mapSelectScreen || mapSelectScreen.classList.contains('hidden')) return;

            const opener = (typeof window !== 'undefined')
                ? window.__RECLAIM_SHOW_FACTION_SELECTION__
                : null;
            if (typeof opener !== 'function') return;
            const result = opener({ force: true });
            if (result && typeof result.catch === 'function') {
                result.catch((err) => {
                    console.warn('[Faction] open selection failed:', err);
                });
            }
        } catch (err) {
            console.warn('[Faction] open selection failed:', err);
        }
    },

    _forceHideBattleUI() {
        const wrapper = document.getElementById('game-wrapper');
        if (wrapper) wrapper.classList.remove('battle-cursor-lock');

        const hideIds = [
            'hud-ctrl-wrapper',
            'hud-top-actions',
            'global-settings-btn',
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
            'mobile-direct-ui',
            'mobile-direct-toggle-btn',
            'mobile-camera-tilt-control',
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
            'map-intro-modal',
            'team-color-screen',
            'portrait-overlay',
            'map-select-screen',
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
            const now = Date.now();
            if (now < suspendUntil) return;
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
            const blockerIds = ['boot-gate', 'loading-screen', 'cinematic-modal', 'map-intro-modal', 'team-color-screen', 'portrait-overlay', 'end-screen'];

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
            const flowPhase = (typeof window !== 'undefined')
                ? String(window.__RECLAIM_FLOW_PHASE__ || '').trim()
                : '';
            const flowPhaseAt = (typeof window !== 'undefined')
                ? Number(window.__RECLAIM_FLOW_PHASE_AT__ || 0)
                : 0;
            const mapStartLock = (typeof window !== 'undefined')
                && window.__RECLAIM_MAP_START_LOCK__ === true;
            const inPreBattlePhase = flowPhase === 'faction_pick' || flowPhase === 'map_intro';
            const inFlowStabilizeWindow = flowPhaseAt > 0 && (now - flowPhaseAt) < 8000;
            const inBattleBootstrapGrace = (
                flowPhase === 'battle'
                && mapStartLock
                && now < (suspendUntil + 10000)
            );
            if (inPreBattlePhase || inBattleBootstrapGrace || inFlowStabilizeWindow) {
                this._uiBlankTicks = 0;
                return;
            }

            const stageIds = [
                'boot-gate',
                'loading-screen',
                'cinematic-modal',
                'map-intro-modal',
                'team-color-screen',
                'map-select-screen',
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

            console.warn('[UIRecovery] Blank screen detected for 4s. Restoring map select.');
            this._forceHideBattleUI();
            document.getElementById('boot-gate')?.classList.add('hidden');
            document.getElementById('loading-screen')?.classList.add('hidden');
            document.getElementById('cinematic-modal')?.classList.add('hidden');
            document.getElementById('map-intro-modal')?.classList.add('hidden');
            document.getElementById('team-color-screen')?.classList.add('hidden');
            this.showMapSelect();
        }, 700);
    },

    retreatToMapSelect() {
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

        if (typeof app !== 'undefined' && app && typeof app.saveNow === 'function') {
            app.saveNow();
        }

        if (typeof AudioSystem !== 'undefined' && typeof AudioSystem.stopIcbmRaise === 'function') {
            AudioSystem.stopIcbmRaise(true);
        }
        if (typeof AudioSystem !== 'undefined'
            && AudioSystem
            && typeof AudioSystem.stopBattleMovementAmbience === 'function') {
            try { AudioSystem.stopBattleMovementAmbience(); } catch (_) { }
        }

        this._clearFactionSelection();
        this.showMapSelect();
        try {
            history.replaceState({ page: 'map-select' }, "MapSelect", "#map-select");
        } catch (_) { }
    },

    backToLobby() {
        const shouldReopenFaction = this.running === true || this.isGameOver === true;
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

        if (typeof app !== 'undefined' && app && typeof app.saveNow === 'function') {
            try { app.saveNow(); } catch (err) { console.warn('[backToLobby] app save failed:', err); }
        }

        try { this._cleanupSkirmishSession(); } catch (err) { console.warn('[backToLobby] skirmish cleanup failed:', err); }
        try { this._forceHideBattleUI(); } catch (err) { console.warn('[backToLobby] battle ui cleanup failed:', err); }
        if (typeof AudioSystem !== 'undefined'
            && AudioSystem
            && typeof AudioSystem.stopBattleMovementAmbience === 'function') {
            try { AudioSystem.stopBattleMovementAmbience(); } catch (err) { console.warn('[backToLobby] stop movement ambience failed:', err); }
        }
        if (typeof AudioSystem !== 'undefined'
            && AudioSystem
            && typeof AudioSystem.stopIcbmRaise === 'function') {
            try { AudioSystem.stopIcbmRaise(true); } catch (err) { console.warn('[backToLobby] stop icbm raise failed:', err); }
        }

        document.getElementById('unit-cmd-wrapper')?.classList.add('hidden');
        document.getElementById('unit-cmd-panel')?.classList.add('hidden');

        if (shouldReopenFaction) {
            this._clearFactionSelection();
        }
        this.showMapSelect();
    },

    startGame(mapType, options = {}) {
        this.stopMapSelectBgm();
        if (typeof window !== 'undefined') {
            if (typeof window.__RECLAIM_TRANSITION_FLOW__ === 'function') {
                window.__RECLAIM_TRANSITION_FLOW__('battle');
            } else {
                window.__RECLAIM_FLOW_PHASE__ = 'battle';
            }
        }
        this._skirmishObjectiveWatchtowerWasPresent = false;
        this._skirmishObjectiveHintShown = false;
        this.ensureMapsReady();
        this.enforceCriticalMapThemes();
        this._uiRecoverySuspendUntil = Date.now() + 12000;

        const mapApi = (typeof Maps !== 'undefined' && Maps)
            ? Maps
            : ((typeof window !== 'undefined' && window.Maps) ? window.Maps : null);
        if (!mapApi) {
            console.error('[GameStart] Maps API is unavailable.');
            if (typeof window !== 'undefined') {
                window.__RECLAIM_MAP_START_LOCK__ = false;
                window.__RECLAIM_BLOCK_FACTION_POPUP__ = false;
            }
            if (typeof ui !== 'undefined' && typeof ui.showToast === 'function') {
                ui.showToast('맵 시스템 로드 실패. 새로고침 후 다시 시도하세요.');
            }
            this.showMapSelect();
            return;
        }
        const requestedMap = String(mapType || this.currentMapId || DEFAULT_BATTLE_MAP_ID).trim();
        const nextMap = (requestedMap && mapApi.types && mapApi.types[requestedMap])
            ? requestedMap
            : DEFAULT_BATTLE_MAP_ID;

        document.getElementById('map-select-screen')?.classList.add('hidden');
        if (typeof mapApi.setMap === 'function') mapApi.setMap(nextMap);
        else mapApi.currentMap = nextMap;

        if (!this.settings || typeof this.settings !== 'object') {
            this.settings = { includeForwardDefense: false };
        }
        this.settings.includeForwardDefense = false;
        const baseW = CONFIG.baseMapWidth || CONFIG.mapWidth || 6000;
        const mapSpecificW = Number((typeof mapApi.getRule === 'function') ? mapApi.getRule('mapWidth') : NaN);
        CONFIG.mapWidth = (Number.isFinite(mapSpecificW) && mapSpecificW > 0)
            ? mapSpecificW
            : baseW;

        // [NEW] 마지막 선택 맵 저장
        this.currentMapId = nextMap;

        // Battle-only: predeploy/placement flow disabled.
        this._skirmishMode = false;
        this._skirmishData = null;

        this.start();
    },

    // [핵심] 흔들림 없는 리사이즈 로직
    resize() {
        const wrapper = document.getElementById('game-wrapper');
        const vv = window.visualViewport || null;
        const winW = (vv && Number.isFinite(vv.width) && vv.width > 0) ? vv.width : window.innerWidth;
        const winH = (vv && Number.isFinite(vv.height) && vv.height > 0) ? vv.height : window.innerHeight;
        const prevViewW = Camera.viewW(this);

        // 1. 배율 계산 (세로 논리 높이에 맞춤)
        // 화면이 작으면 알아서 축소(Zoom Out)되고, 크면 확대됩니다.
        const logicalH = (Number.isFinite(Number(this.logicalHeight)) && Number(this.logicalHeight) > 0)
            ? Number(this.logicalHeight)
            : LOGICAL_HEIGHT;
        this.scaleRatio = winH / logicalH;

        // 2. 가로 길이 계산 (화면 비율에 따라 유동적으로 넓어짐)
        // 예: 가로 모드면 width가 1400px 이상으로 늘어나서 PC처럼 보임
        this.width = winW / this.scaleRatio;
        this.height = logicalH; // 세로 시야 확장: 논리 높이 가변

        // 3. 캔버스 크기 적용
        this.canvas.width = this.width;
        this.canvas.height = this.height;

        // 4. 땅 높이 계산
        this.groundY = this.height - CONFIG.groundHeight;
        const mapGroundLift = Number((typeof Maps !== 'undefined' && Maps && typeof Maps.getRule === 'function')
            ? Maps.getRule('groundLift')
            : NaN);
        if (Number.isFinite(mapGroundLift) && mapGroundLift > 0) {
            this.groundY = Math.max(140, this.groundY - mapGroundLift);
        }

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
        this.mobileViewportActive = isMobile;
        // Pivot base already follows infantry lane; keep extra mobile offset neutral.
        this.mobileCameraPivotOffsetY = 0;
        this.mobileCameraPivotUserPercent = this.getCameraPivotUserPercent();
        if (isMobile && !Camera.userZoomed) {
            // 목표 뷰 너비: 1200px (적당한 시야)
            const targetViewW = 1200;
            const autoZoom = Math.min(Camera.MAX, Math.max(Camera.MIN, this.width / targetViewW));
            // Never auto-zoom in on resize; only auto-zoom out when needed.
            if ((Camera.zoom - autoZoom) > 0.01) {
                Camera.zoom = autoZoom;
                this.cameraX = Camera.clampCameraX(this, this.cameraX);
            }
        }

        // Global floor: stop zoom-out before side blue background can appear.
        if (typeof Camera.getEffectiveMinZoom === 'function') {
            const minZoom = Camera.getEffectiveMinZoom(this);
            if (Number(Camera.zoom) < minZoom) {
                Camera.zoom = minZoom;
                this.cameraX = Camera.clampCameraX(this, this.cameraX);
            }
        }
    },

    initGameObjects() {
        // 아군 시작 보유 수량은 난이도와 무관하게 동일하게 유지한다.
        const stockMult = 1.0;
        const isCoastMap = String(this.currentMapId || '').trim() === 'skirmish_coast';
        const enemyBaseMult = isCoastMap ? 1.9 : 1.5;
        const enemyThreatMult = 1;

        for (let k in CONFIG.units) {
            this.cooldowns[k] = 0; this.enemyCooldowns[k] = 0;
            const unitDef = CONFIG.units[k];
            if (unitDef && unitDef.disabled === true) {
                this.playerStock[k] = 0;
                this.enemyStock[k] = 0;
                this.spawnQueue[k] = 0;
                continue;
            }
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

            // 작업자 비활성화: 시작 재고 0 고정.
            if (k === 'worker') {
                finalCount = 0;
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
            }
            this.enemyStock[k] = enemyCount;
            this.spawnQueue[k] = 0;
        }
        this.cooldowns.bagpipe_skill = 0;

        this.totalWarTriggered = false; // Reset Total War
        this._enemyHQWasPresent = false;
        this.battleArmorNewsShown = false;
        this.battleMidNewsShown = false;
        this.battleTotalWarNewsShown = false;
        this.nukePanicPlayed = false;

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
        const spawnX = enemyHQ ? (enemyHQ.x - 130) : (CONFIG.mapWidth - 180);
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
                    this.spawnUnitDirect(key, spawnX + (Math.random() * 60 - 30), this.groundY, 'enemy');
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

        // Prevent enemy ICBM TEL from appearing in the opening phase.
        if (String(key || '').trim().toLowerCase() === 'icbm_enemy') {
            const nowFrame = Math.max(0, Number(this.frame) || 0);
            const unlockFrame = Math.max(
                0,
                Math.floor(Number(this.enemyIcbmSpawnUnlockFrame) || ENEMY_ICBM_SPAWN_UNLOCK_DELAY_FRAMES)
            );
            if (nowFrame < unlockFrame) return true;
        }

        const unitType = String(unitDef.type || '').trim().toLowerCase();
        const unitCategory = String(unitDef.category || '').trim().toLowerCase();
        if (this.isCoastLimitedRosterMode() && !this.isCoastAllowedUnitKey(key)) return true;
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
        this._clearLandingIntroController();
        this._forceShowBattleViewport();

        // [FIX] ID 수정: start-screen은 존재하지 않으므로 loading-screen을 숨김
        document.getElementById('loading-screen')?.classList.add('hidden');
        document.getElementById('end-screen').classList.add('hidden');

        // [New] Push history state when game starts
        history.pushState({ page: 'game' }, "Game", "#game");

        this.players = []; this.enemies = []; this.civilians = []; this.projectiles = []; this.particles = [];
        this.buildings = []; this.wreckages = []; this.corpses = [];
        this.corpseSpawnQueue = []; this.corpseSpawnQueueHead = 0;
        this.supply = CONFIG.startSupply; this.enemySupply = CONFIG.startSupply;
        this.empTimer = 0;
        this.skillCharges = { emp: 1, nuke: 1, tactical: 1 };
        this._captureControlState = null;
        this.enemyIcbmNextAllowedFrame = 0;
        this.enemyIcbmSpawnUnlockFrame = ENEMY_ICBM_SPAWN_UNLOCK_DELAY_FRAMES;
        this.enemyLastIcbmFrame = -999999;
        this.enemyLastEmpLaunchFrame = -999999;
        this.killCount = 0;
        this.reconLockStrikeCooldownUntilFrame = 0;
        this._reconLockStrikeLastTargetRef = null;
        this._reconLockStrikeLastFireFrame = -999999;
        this.isGameOver = false;
        this.enemyEverSeen = false;
        this.playerEverSeen = false;
        this.watchtowerBuilt = false;  // [3.8] 감시탑 1회 건설 제한 초기화
        this.civilianDeaths = 0;
        this.airRaidTriggered = false;
        this.civilianEvacActive = false;
        this.civilianEvacX = null;
        this.civilianGlobalPanic = 0;
        this.cameramanDisabled = true;
        this._activeCameraman = null;
        this.newsCameraX = null;
        this.cameraLockActive = false;
        this.cameraLockTarget = null;
        this._cameraPanLeftKey = false;
        this._cameraPanRightKey = false;
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
        if (typeof Maps !== 'undefined' && !Maps.currentMap) Maps.currentMap = DEFAULT_BATTLE_MAP_ID;

        this.initGameObjects();
        this.applyBattleUnitsToStock();
        this.applyCoastLimitedRosterRules();
        this.running = true;
        this.centerCameraForBattleStart();
        this._setupLandingIntroController();

        // HUD
        this.minimapVisible = false;
        // [CHANGE] Hide old floating UI, use fixed HUD instead
        document.getElementById('hud-ctrl-wrapper')?.classList.add('hidden');
        [
            'hud-top-actions'
        ].forEach((id) => document.getElementById(id)?.classList.remove('hidden'));
        document.getElementById('unit-cmd-wrapper')?.classList.add('hidden');
        // [FIX] endGame에서 숨긴 UI 복구
        document.getElementById('hud-footer')?.classList.remove('hidden');
        document.getElementById('global-settings-btn')?.classList.remove('hidden');
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
            if (typeof AudioSystem.setBGMLock === 'function') {
                AudioSystem.setBGMLock('');
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
                AI.wave.phaseLockUntil = 0;
                AI.wave.stabilizeMeter = 0;
                AI.wave.advanceMeter = 0;
                AI.wave.fallbackMeter = 0;
                AI.wave.lastThreat = null;
            }
            // 특수무기 상태 초기화
            AI._initSpecialState();
        }

        // [NEW] Map Setup (buildings)
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
            ChatPanel.init({ open: false });
            ChatPanel.hide();
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
        const next = (cat === 'infantry' || cat === 'armored' || cat === 'air')
            ? cat
            : 'infantry';
        this.currentCategory = next;
        // UI 갱신은 commit에서 처리
        if (typeof app !== 'undefined') app.markUiDirty();
    },

    isInfantryOnlyMode() {
        // Legacy compatibility: infantry-only mode is no longer used.
        // Coast map now uses a limited mixed roster (infantry + partial air + selected armored).
        return false;
    },

    isCoastLimitedRosterMode() {
        return String(this.currentMapId || '').trim() === 'skirmish_coast';
    },

    isCoastAllowedArmoredKey(key) {
        const unitKey = String(key || '').trim();
        return unitKey === 'humvee' || unitKey === 'mbt' || unitKey === 'aa_tank';
    },
    isCoastEnemyAirBlockedKey(key) {
        const unitKey = String(key || '').trim();
        // Coast enemy air hard block: fighter spam prevention
        return unitKey === 'fighter';
    },

    isCoastAllowedUnitKey(key) {
        const unitKey = String(key || '').trim();
        if (!unitKey || typeof CONFIG === 'undefined' || !CONFIG || !CONFIG.units) return false;
        const unitDef = CONFIG.units[unitKey];
        if (!unitDef || unitDef.disabled === true || unitDef.isSkill === true) return false;
        if (unitKey === 'bomber') return false;
        const unitCategory = String(unitDef.category || '').trim().toLowerCase();
        if (unitCategory === 'infantry') return true;
        if (unitCategory === 'air') return true;
        return this.isCoastAllowedArmoredKey(unitKey);
    },

    applyCoastLimitedRosterRules() {
        if (!this.isCoastLimitedRosterMode()) return;
        if (typeof CONFIG === 'undefined' || !CONFIG || !CONFIG.units) return;
        const armoredStockCap = {
            humvee: 4,
            mbt: 3,
            aa_tank: 2
        };
        for (const key in CONFIG.units) {
            if (!Object.prototype.hasOwnProperty.call(CONFIG.units, key)) continue;
            const unitDef = CONFIG.units[key];
            if (!unitDef || unitDef.disabled === true || unitDef.isSkill === true) continue;
            const unitCategory = String(unitDef.category || '').trim().toLowerCase();
            const isAir = unitCategory === 'air';
            const isArmoredAllowed = this.isCoastAllowedArmoredKey(key);
            const isAllowed = this.isCoastAllowedUnitKey(key);

            if (!isAllowed) {
                this.playerStock[key] = 0;
                this.enemyStock[key] = 0;
                if (this.spawnQueue && typeof this.spawnQueue === 'object') {
                    this.spawnQueue[key] = 0;
                }
                continue;
            }

            if (isAir) {
                if (key === 'recon') {
                    this.playerStock[key] = 2;
                    this.enemyStock[key] = 0;
                    continue;
                }
                if (this.isCoastEnemyAirBlockedKey(key)) {
                    const p = Math.max(1, Math.floor(Math.max(0, Number(this.playerStock[key]) || 0) * 0.5));
                    this.playerStock[key] = p;
                    this.enemyStock[key] = 0;
                    continue;
                }
                if (key === 'apache') {
                    this.playerStock[key] = 1;
                    this.enemyStock[key] = 1;
                    continue;
                }
                const p = Math.max(1, Math.floor(Math.max(0, Number(this.playerStock[key]) || 0) * 0.5));
                const e = Math.max(1, Math.floor(Math.max(0, Number(this.enemyStock[key]) || 0) * 0.5));
                this.playerStock[key] = p;
                this.enemyStock[key] = e;
                continue;
            }

            if (isArmoredAllowed) {
                const cap = Math.max(0, Math.floor(Number(armoredStockCap[key]) || 0));
                this.playerStock[key] = Math.min(cap, Math.max(0, Math.floor(Number(this.playerStock[key]) || 0)));
                this.enemyStock[key] = Math.min(cap, Math.max(0, Math.floor(Number(this.enemyStock[key]) || 0)));
            }
        }
    },

    _setLandingSpawnUiLocked(locked, reason = '') {
        const nextLocked = locked === true;
        this._landingSpawnUiLocked = nextLocked;
        const unitPanel = document.getElementById('unit-panel-container');
        if (unitPanel) unitPanel.classList.toggle('hidden', nextLocked);
        if (typeof window !== 'undefined') {
            window.__RECLAIM_LANDING_UI_LOCK__ = {
                locked: nextLocked,
                reason: String(reason || '').trim() || (nextLocked ? 'locked' : 'unlocked')
            };
        }
        if (typeof app !== 'undefined') {
            app.markUiDirty();
        }
    },

    _clearLandingIntroController() {
        const ctrl = this.landingIntroController;
        if (ctrl && typeof ctrl.destroy === 'function') {
            try { ctrl.destroy(); } catch (_) { }
        }
        this.landingIntroController = null;
        this._setLandingSpawnUiLocked(false, 'clear-intro');
        if (typeof window !== 'undefined') {
            window.__RECLAIM_LANDING_INTRO_STATE__ = {
                active: false,
                finished: true,
                reason: 'cleared'
            };
        }
    },

    _setupLandingIntroController() {
        this._clearLandingIntroController();
        if (String(this.currentMapId || '').trim() !== 'skirmish_coast') return;
        this._setLandingSpawnUiLocked(true, 'wait-first-craft');

        const api = (typeof LandingIntroEvent !== 'undefined' && LandingIntroEvent)
            ? LandingIntroEvent
            : ((typeof window !== 'undefined' && window.LandingIntroEvent) ? window.LandingIntroEvent : null);
        if (!api || typeof api.createForGame !== 'function') {
            this._setLandingSpawnUiLocked(false, 'intro-api-missing');
            return;
        }

        try {
            const ctrl = api.createForGame(this);
            if (!ctrl || typeof ctrl.update !== 'function' || typeof ctrl.draw !== 'function') {
                this._setLandingSpawnUiLocked(false, 'intro-controller-invalid');
                return;
            }
            this.landingIntroController = ctrl;
            if (typeof window !== 'undefined') {
                window.__RECLAIM_LANDING_INTRO_STATE__ = {
                    active: true,
                    finished: false,
                    reason: 'started'
                };
            }
        } catch (err) {
            console.warn('[LandingIntro] setup failed:', err);
            this._clearLandingIntroController();
        }
    },

    getPlayerSpawnX() {
        const hq = this.buildings.find((b) => b.type === 'hq_player');
        if (hq) return hq.x + 150;
        const spawnFlag = this.buildings.find((b) => b && !b.dead && b.type === 'spawn_flag_player' && b.team === 'player');
        if (spawnFlag) return spawnFlag.x + 130;
        const mapRuleSpawnX = Number((typeof Maps !== 'undefined' && Maps && typeof Maps.getRule === 'function')
            ? Maps.getRule('playerSpawnX')
            : NaN);
        if (Number.isFinite(mapRuleSpawnX) && mapRuleSpawnX > 0) return mapRuleSpawnX;
        // HQ가 없는 맵(예: 해안 상륙)은 좌측 맵 끝에서 생성
        return 84;
    },

    getPlayerRetreatStopX() {
        const hq = this.buildings.find((b) => b.type === 'hq_player');
        if (hq) return hq.x + 100;
        const spawnFlag = this.buildings.find((b) => b && !b.dead && b.type === 'spawn_flag_player' && b.team === 'player');
        if (spawnFlag) return spawnFlag.x + 90;
        const mapRuleRetreatX = Number((typeof Maps !== 'undefined' && Maps && typeof Maps.getRule === 'function')
            ? Maps.getRule('playerRetreatStopX')
            : NaN);
        if (Number.isFinite(mapRuleRetreatX) && mapRuleRetreatX > 0) return mapRuleRetreatX;
        // HQ가 없으면 좌측 맵 끝 쪽으로 완전히 복귀
        return 34;
    },

    // [FIX] Bunker Spawn Selection Stub (Prevent Crash)
    selectSpawn(bunker) {
        // Feature removed, but keeping method to prevent src/entities/buildings.js crash
        this.selectedSpawn = bunker;
    },

    spawnUnitExecution(key) {
        const spawnX = this.getPlayerSpawnX();
        this.spawnUnitDirect(key, spawnX, this.groundY, 'player');
    },

    prepareTargeting(key) {
        if (this.targetingType) return;

        const u = CONFIG.units[key];
        if (!u) {
            ui.showToast('알 수 없는 스킬/유닛입니다.');
            return;
        }
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
            const canSpend = (typeof BattleEconomy !== 'undefined'
                && BattleEconomy
                && typeof BattleEconomy.canSpend === 'function')
                ? BattleEconomy.canSpend(this, u.cost, { unitKey: key })
                : (this.supply >= u.cost && this.playerStock[key] > 0);
            if (!canSpend) { ui.showToast("자원 또는 재고 부족!"); return; }
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
            this.handleMoveTargeting(x, y);
            this.cancelTargeting();
            return;
        }

        // [NEW] smoke grenade targeting
        if (key === '__smoke__') {
            this.handleSmokeTargeting(x, y);
            this.cancelTargeting();
            return;
        }

        // Cameraman/news command is disabled.
        if (key === '__news__') {
            ui.showToast('방송 카메라 기능은 비활성화되었습니다.');
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

        // [NEW] recon lock-strike targeting
        if (key === '__recon_lock_strike__') {
            this.handleReconLockStrikeTargeting(x, y);
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
            const spent = this.spendUnitCost(key, u.cost);
            if (!spent) {
                ui.showToast("자원 또는 재고 부족!");
                this.cancelTargeting();
                return;
            }
            this.cooldowns[key] = u.cooldown;

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

            const spent = this.spendUnitCost(key, u.cost);
            if (!spent) {
                ui.showToast("자원 또는 재고 부족!");
                this.cancelTargeting();
                return;
            }
            this.cooldowns[key] = u.cooldown;

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

        // [ITEM] smoke_grenade 아이템 포함 ? smokeChargesLeft > 0 이면 모든 유닛 허용
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
        ui.showToast('방송 카메라 기능은 비활성화되었습니다.');
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
    prepareReconLockStrikeCommand() {
        if (!this.selectedUnits || this.selectedUnits.size === 0) {
            ui.showToast('유닛을 먼저 선택하세요');
            return;
        }
        if (this.targetingType) return;

        const selectedRecon = this.getSelectedReconUnits();
        if (selectedRecon.length <= 0) {
            ui.showToast('정찰 드론 선택 시 사용 가능합니다');
            return;
        }

        const cooldownLeft = this.getReconLockStrikeCooldownLeftFrames();
        if (cooldownLeft > 0) {
            const sec = (cooldownLeft / 60).toFixed(1);
            ui.showToast(`락온 타격 재사용 대기 ${sec}s`);
            return;
        }

        this.targetingType = '__recon_lock_strike__';
        document.getElementById('targeting-overlay').classList.remove('hidden');
        document.getElementById('target-msg').innerText = '락온할 적 목표 선택';
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
            if (id === 'blackhawk' || id === 'chinook' || id === 'uh60') {
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
    handleMoveTargeting(x, y) {
        if (!this.selectedUnits || this.selectedUnits.size === 0) return;
        const useAirFormation = (typeof this.isFeatureFlagEnabled === 'function')
            ? this.isFeatureFlagEnabled('airFormation')
            : false;
        const targetYBase = (typeof this.clampGroundLaneY === 'function')
            ? this.clampGroundLaneY(y)
            : (Number.isFinite(Number(y)) ? Number(y) : Number(this.groundY));
        const unitList = Array.from(this.selectedUnits).filter(u => !!(u && !u.dead));
        const count = unitList.length;
        if (count <= 0) return;
        const mapW = Number((typeof CONFIG !== 'undefined' && CONFIG) ? CONFIG.mapWidth : NaN);
        const spreadBase = Math.min(160, Math.max(26, 18 + Math.sqrt(count) * 16));
        const formationPlan = (useAirFormation && typeof this.planAirFormationAssignments === 'function')
            ? this.planAirFormationAssignments(unitList, x)
            : null;

        unitList.forEach((u, index) => {
            if (!u.dead) {
                let unitTargetY = targetYBase;
                if (u.stats && u.stats.type !== 'air') {
                    const laneBias = Number(u._groundLaneOffset) || 0;
                    const yScatter = (Math.random() * 2 - 1) * Math.max(10, spreadBase * 0.28);
                    const rawY = Number(targetYBase) + yScatter + (laneBias * 0.35);
                    unitTargetY = (typeof this.clampGroundLaneY === 'function')
                        ? this.clampGroundLaneY(rawY)
                        : rawY;
                }

                u.commandMode = 'move';
                const isAirUnit = !!(u.stats && u.stats.type === 'air');
                if (useAirFormation && isAirUnit && formationPlan && formationPlan.has(u)) {
                    const info = formationPlan.get(u);
                    const targetX = Number(info && info.targetX);
                    const safeTargetX = Number.isFinite(targetX)
                        ? targetX
                        : (Number.isFinite(mapW) && mapW > 0 ? Math.max(24, Math.min(mapW - 24, Number(x))) : Number(x));
                    u.targetX = safeTargetX;
                    u.commandTargetX = safeTargetX;
                    u.targetY = null;
                    u._airFormationOffsetY = Number(info && info.offsetY) || 0;
                    u._airFormationSlot = Number(info && info.slot) || 0;
                    u._airFormationDir = Number(info && info.dir) || 0;
                    u._airFormationAnchorX = Number(info && info.anchorX);
                } else {
                    const t = (count <= 1) ? 0 : ((index / (count - 1)) - 0.5);
                    const xScatter = (t * spreadBase) + ((Math.random() * 2 - 1) * Math.max(6, spreadBase * 0.18));
                    const targetX = Number.isFinite(mapW) && mapW > 0
                        ? Math.max(24, Math.min(mapW - 24, Number(x) + xScatter))
                        : (Number(x) + xScatter);
                    u.targetX = targetX;
                    u.commandTargetX = targetX;
                    u.targetY = isAirUnit ? null : unitTargetY;
                    if (typeof this.clearAirFormationState === 'function') {
                        this.clearAirFormationState(u);
                    }
                }
                u.attackTarget = null;
                u.lockedTarget = null;
                if (u.stats && !u.stats.operator && (u.stats.category === 'drone' || (u.stats.id && String(u.stats.id).includes('drone')))) {
                    const droneTargetX = Number.isFinite(Number(u.commandTargetX)) ? Number(u.commandTargetX) : Number(x);
                    u.swarmTarget = { x: droneTargetX, y: unitTargetY };
                }
            }
        });

        ui.showToast(`${count}개 유닛 이동 명령!`);
        this.createParticles(x, targetYBase - 10, 8, '#22c55e');
    },

    // ============================================
    // [NEW] 연막탄 투척 처리 (handleTargeting에서 호출)
    // ============================================
    handleSmokeTargeting(x, y) {
        if (!this.selectedUnits || this.selectedUnits.size === 0) return;

        // [ITEM] smoke_grenade 아이템 포함 ? smokeChargesLeft > 0 인 모든 유닛 허용
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
        ui.showToast('방송 카메라 기능은 비활성화되었습니다.');
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
    handleReconLockStrikeTargeting(x, y) {
        const selectedRecon = this.getSelectedReconUnits();
        if (selectedRecon.length <= 0) {
            ui.showToast('정찰 드론 선택 시 사용 가능합니다');
            return;
        }

        const cooldownLeft = this.getReconLockStrikeCooldownLeftFrames();
        if (cooldownLeft > 0) {
            const sec = (cooldownLeft / 60).toFixed(1);
            ui.showToast(`락온 타격 재사용 대기 ${sec}s`);
            return;
        }

        const target = this._findReconLockStrikeTarget(x, y, 260);
        if (!target) {
            ui.showToast('락온 가능한 적이 없습니다');
            return;
        }

        const fired = this._launchReconLockStrikeAtTarget(target);
        if (!fired) {
            ui.showToast('락온 타격 처리 중입니다');
        }
    },

    // ============================================
    // [NEW] 수송 하차 처리 (handleTargeting에서 호출)
    // ============================================
    handleDropTargeting(x) {
        let tx = x;
        if (typeof CONFIG !== 'undefined' && Number.isFinite(CONFIG.mapWidth)) {
            tx = Math.max(0, Math.min(CONFIG.mapWidth, x));
        }

        let count = 0;
        this.selectedUnits.forEach(u => {
            if (!u || u.dead || !u.stats) return;
            const id = u.stats.id;
            if (id !== 'blackhawk' && id !== 'chinook' && id !== 'uh60') return;
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
        const canSpendSupply = (typeof BattleEconomy !== 'undefined'
            && BattleEconomy
            && typeof BattleEconomy.canSpendSupply === 'function')
            ? BattleEconomy.canSpendSupply(this, bData.cost)
            : this.supply >= bData.cost;
        if (!canSpendSupply) {
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
        const canSpendSupply = (typeof BattleEconomy !== 'undefined'
            && BattleEconomy
            && typeof BattleEconomy.canSpendSupply === 'function')
            ? BattleEconomy.canSpendSupply(this, bData.cost)
            : this.supply >= bData.cost;
        if (!canSpendSupply) {
            ui.showToast('자원 부족!');
            this.cancelBuildMode();
            return;
        }
        const spentBuildCost = (typeof BattleEconomy !== 'undefined'
            && BattleEconomy
            && typeof BattleEconomy.spendSupply === 'function')
            ? BattleEconomy.spendSupply(this, bData.cost)
            : ((this.supply -= bData.cost), true);
        if (!spentBuildCost) {
            ui.showToast('자원 부족!');
            this.cancelBuildMode();
            return;
        }

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

    spendUnitCost(key, cost, options = {}) {
        const unitKey = String(key || '').trim();
        if (!unitKey) return false;

        const opts = (options && typeof options === 'object') ? options : {};
        const consumeStock = opts.consumeStock !== false;
        const stockMap = (opts.stockMap && typeof opts.stockMap === 'object')
            ? opts.stockMap
            : this.playerStock;
        const need = Math.max(0, Number(cost) || 0);
        const readSupply = () => Math.max(0, Number(this.supply) || 0);
        const readStock = () => {
            if (!consumeStock) return 0;
            if (!stockMap || typeof stockMap !== 'object') return 0;
            return Math.max(0, Math.floor(Number(stockMap[unitKey]) || 0));
        };

        const beforeSupply = readSupply();
        const beforeStock = readStock();
        let spent = false;

        if (typeof BattleEconomy !== 'undefined'
            && BattleEconomy
            && typeof BattleEconomy.spend === 'function') {
            spent = BattleEconomy.spend(this, need, {
                unitKey,
                consumeStock,
                stockMap
            });
        } else if (beforeSupply >= need && (!consumeStock || beforeStock > 0)) {
            this.supply = beforeSupply - need;
            if (consumeStock && stockMap && typeof stockMap === 'object') {
                stockMap[unitKey] = beforeStock - 1;
            }
            spent = true;
        }

        if (!spent) {
            // Guard against partially-applied deduction when an upstream implementation misbehaves.
            this.supply = beforeSupply;
            if (consumeStock && stockMap && typeof stockMap === 'object') {
                stockMap[unitKey] = beforeStock;
            }
            return false;
        }

        const afterSupply = readSupply();
        const afterStock = readStock();
        const expectedSupply = Math.max(0, beforeSupply - need);
        const expectedStock = consumeStock
            ? Math.max(0, beforeStock - 1)
            : afterStock;

        const supplySynced = Math.abs(afterSupply - expectedSupply) <= 0.0001;
        const stockSynced = !consumeStock || afterStock === expectedStock;
        if (supplySynced && stockSynced) return true;

        if (beforeSupply < need || (consumeStock && beforeStock <= 0)) {
            return false;
        }

        this.supply = expectedSupply;
        if (consumeStock && stockMap && typeof stockMap === 'object') {
            stockMap[unitKey] = expectedStock;
        }

        try {
            console.warn('[BattleEconomy.guard] forced spend reconciliation', {
                unitKey,
                need,
                beforeSupply,
                afterSupply,
                expectedSupply,
                beforeStock,
                afterStock,
                expectedStock
            });
        } catch (_) { }

        return true;
    },

    queueUnit(key) {
        const u = CONFIG.units[key];
        if (!u) return;
        if (u.disabled === true) {
            ui.showToast('비활성화된 유닛입니다.');
            return;
        }
        if (this._landingSpawnUiLocked === true) {
            if (typeof ChatPanel !== 'undefined') {
                ChatPanel.push('상륙정 램프 개방 전에는 생산할 수 없습니다.', 'WARN');
            }
            return;
        }
        if (this.isCoastLimitedRosterMode() && u.isSkill !== true && !this.isCoastAllowedUnitKey(key)) {
            if (typeof ChatPanel !== 'undefined') {
                ChatPanel.push('해안 상륙전은 보병 + 공중(절반) + 제한 기갑(험비/전차/대공전차)만 사용 가능합니다.', 'WARN');
            }
            return;
        }
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

        const spent = this.spendUnitCost(key, u.cost);
        if (spent) {
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
        if (!unitDef || unitDef.disabled === true) {
            return null;
        }
        if (this.isCoastLimitedRosterMode()) {
            const teamKey = String(team || '').trim().toLowerCase();
            const shouldRestrictTeam = teamKey === 'player' || teamKey === 'enemy';
            if (teamKey === 'enemy' && this.isCoastEnemyAirBlockedKey(key)) {
                return null;
            }
            if (shouldRestrictTeam && unitDef.isSkill !== true && !this.isCoastAllowedUnitKey(key)) {
                return null;
            }
        }
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
        if (unit && typeof this.isGroundLaneUnit === 'function' && this.isGroundLaneUnit(unit)) {
            const inputY = Number(y);
            const gy = Number(this.groundY);
            const inputIsDefaultGround = Number.isFinite(inputY) && Number.isFinite(gy) && Math.abs(inputY - gy) < 0.01;
            const shouldAutoSpread = (!Number.isFinite(inputY) || inputIsDefaultGround);

            if (shouldAutoSpread && unit.stats) {
                const category = String(unit.stats.category || '').trim().toLowerCase();
                const role = (category === 'infantry') ? 'infantry' : ((category === 'armored') ? 'armored' : 'ground');
                const spread = this._nextSpawnSpreadSlot(team, role);
                const spreadPx = (role === 'infantry') ? 18 : 26;
                const xOffset = (Number(spread.xStep) * spreadPx) + ((Math.random() * 2 - 1) * Math.max(6, spreadPx * 0.45));

                if (Number.isFinite(xOffset) && xOffset !== 0) {
                    const mapW = Number((typeof CONFIG !== 'undefined' && CONFIG) ? CONFIG.mapWidth : NaN);
                    const halfW = Math.max(8, (Number(unit.width) || 16) * 0.5);
                    const nextX = Number(unit.x) + xOffset;
                    if (Number.isFinite(mapW) && mapW > 0) {
                        unit.x = Math.max(halfW, Math.min(mapW - halfW, nextX));
                    } else {
                        unit.x = nextX;
                    }
                }

                const laneIndex = Number(spread.laneIndex);
                const spreadRange = (typeof this.getGroundLaneSpreadRange === 'function')
                    ? this.getGroundLaneSpreadRange(unit)
                    : 30;
                const slotBiases = [-0.75, -0.45, -0.2, 0, 0.2, 0.45, 0.75];
                const idx = Number.isFinite(laneIndex) ? Math.max(0, Math.min(slotBiases.length - 1, Math.floor(laneIndex))) : 3;
                const slotOffset = slotBiases[idx] * spreadRange;
                const randomSpread = (Math.random() * 2 - 1) * spreadRange * 0.45;
                const teamBias = (team === 'player')
                    ? -(spreadRange * 0.06)
                    : ((team === 'enemy') ? (spreadRange * 0.06) : 0);
                unit._groundLaneOffset = slotOffset + randomSpread + teamBias;
                unit._groundLaneOffsetInitialized = true;
            }

            if (!Number.isFinite(inputY) || inputIsDefaultGround) {
                const laneY = (typeof this.getGroundLaneY === 'function') ? this.getGroundLaneY(unit) : null;
                if (Number.isFinite(Number(laneY))) {
                    unit.y = Number(laneY);
                }
            } else if (typeof this.clampGroundLaneY === 'function') {
                unit.y = this.clampGroundLaneY(inputY);
            }

            // Spawn de-overlap around HQ/frontline entry to avoid stack-on-spawn.
            const allies = (team === 'enemy') ? this.enemies : this.players;
            if (Array.isArray(allies) && allies.length > 0) {
                const mapW = Number((typeof CONFIG !== 'undefined' && CONFIG) ? CONFIG.mapWidth : NaN);
                const halfW = Math.max(8, (Number(unit.width) || 16) * 0.5);
                const sepXBase = Math.max(18, (Number(unit.width) || 16) * 0.95);
                const sepYBase = Math.max(14, (Number(unit.height) || 22) * 0.5);
                for (let attempt = 0; attempt < 10; attempt++) {
                    let crowded = false;
                    for (let i = 0; i < allies.length; i++) {
                        const ally = allies[i];
                        if (!ally || ally.dead || !ally.stats || ally.stats.type === 'air') continue;
                        const dxA = Math.abs((Number(ally.x) || 0) - (Number(unit.x) || 0));
                        const dyA = Math.abs((Number(ally.y) || 0) - (Number(unit.y) || 0));
                        if (dxA < sepXBase && dyA < sepYBase) {
                            crowded = true;
                            break;
                        }
                    }
                    if (!crowded) break;

                    const dir = (team === 'enemy') ? -1 : 1;
                    const pushX = (sepXBase + 6 + (attempt * 5)) * dir;
                    const jitterX = (Math.random() * 2 - 1) * 8;
                    unit.x = Number(unit.x) + pushX + jitterX;
                    if (Number.isFinite(mapW) && mapW > 0) {
                        unit.x = Math.max(halfW, Math.min(mapW - halfW, Number(unit.x)));
                    }

                    if (typeof this.clampGroundLaneY === 'function') {
                        const yKickDir = Math.random() < 0.5 ? -1 : 1;
                        const yKick = yKickDir * (sepYBase + 3 + (attempt * 2));
                        unit.y = this.clampGroundLaneY((Number(unit.y) || this.getGroundLaneBaseY()) + yKick);
                    }
                }
            }
        }
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

        // Auto-start bagpipe once when a player bagpiper is produced.
        if (
            team === 'player'
            && unit
            && unit.stats
            && unit.stats.id === 'bagpiper'
            && typeof unit.startBagpipeSkill === 'function'
        ) {
            const started = unit.startBagpipeSkill() === true;
            if (started && typeof this.updateHUDSelection === 'function') {
                this.updateHUDSelection();
            }
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
        if (this.cameramanDisabled) return null;
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

    spawnAmbientCivilians() {
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
            if (typeof AudioSystem !== 'undefined') {
                if (AudioSystem.stopBGM) AudioSystem.stopBGM();
                if (AudioSystem.playAirRaidAlarm) AudioSystem.playAirRaidAlarm(14000);
            }
            if (this.airRaidBomberTimeout) {
                clearTimeout(this.airRaidBomberTimeout);
            }
            this.airRaidBomberTimeout = setTimeout(() => {
                if (!this.running || this.isGameOver || this.paused) return;
                if (this.isCoastLimitedRosterMode()) return;
                const enemyHQ = this.buildings.find(b => b.type === 'hq_enemy');
                const spawnX = enemyHQ ? (enemyHQ.x - 130) : (CONFIG.mapWidth - 180);
                this.spawnUnitDirect('bomber', spawnX, this.groundY, 'enemy');
            }, 30000);
        }
    },

    onAirRaidEnded() {
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
        if (this.isCoastLimitedRosterMode() && !this.isCoastAllowedUnitKey(key)) return false;
        if (this.isCoastLimitedRosterMode() && this.isCoastEnemyAirBlockedKey(key)) return false;
        if (this.isEnemySpawnBlockedUnit(key)) return false;
        if (this.isCoastLimitedRosterMode()) {
            const nowFrame = Math.max(0, Math.floor(Number(this.frame) || 0));
            const unitCategory = String(u.category || '').trim().toLowerCase();
            const isInfantry = unitCategory === 'infantry';
            if (nowFrame < COAST_ENEMY_INFANTRY_FOCUS_FRAMES && !isInfantry) {
                if (Math.random() < 0.82) return false;
            }
        }
        if (this.enemySupply < u.cost || this.enemyCooldowns[key] > 0 || this.enemyStock[key] <= 0) return false;
        const hasEnemyHqType = this.buildings.some(b => b && b.type === 'hq_enemy');
        const hq = this.buildings.find(b => b && !b.dead && b.type === 'hq_enemy');
        if (hasEnemyHqType && !hq) return false;

        this.enemySupply -= u.cost;
        this.enemyCooldowns[key] = u.cooldown;
        this.enemyStock[key]--;
        const spawnX = hq ? (hq.x - 130) : (CONFIG.mapWidth - 180);
        this.spawnUnitDirect(key, spawnX, this.groundY, 'enemy');
        return true;
    },

    // [New] Speed Control
    speed: 1,
    paused: false,
    // HUD
    minimapVisible: false,

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
        const currentMap = String(this.currentMapId || '').trim();
        if (currentMap === 'skirmish_coast') {
            const leftFocus = 0;
            if (typeof Camera !== 'undefined' && typeof Camera.clampCameraX === 'function') {
                this.cameraX = Camera.clampCameraX(this, leftFocus);
            } else {
                this.cameraX = Math.max(0, Math.min(leftFocus, mapW - viewW));
            }
            return;
        }
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
        // Minimap removed
        this.minimapVisible = false;
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
            ctx.fillStyle = getGameTeamColor(b.team, 'minimap');
            const w = Math.max(2, b.width * scale);
            const h = Math.max(2, b.height * scale);
            ctx.fillRect(b.x * scale - w / 2, groundY - h, w, h);
        });

        ctx.fillStyle = getGameTeamColor('player', 'light'); this.players.forEach(u => ctx.fillRect(u.x * scale, groundY - 2, 2, 2));
        ctx.fillStyle = getGameTeamColor('enemy', 'light'); this.enemies.forEach(u => ctx.fillRect(u.x * scale, groundY - 2, 2, 2));

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
        document.getElementById('global-settings-btn')?.classList.add('hidden');
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
        this.$missionText.textContent = '모든 적을 섬멸하세요.';
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
if (typeof window !== 'undefined') {
    window.game = game;
    try {
        window.dispatchEvent(new Event('reclaim:game-ready'));
    } catch (_) { }
}
window.onload = () => game.init();







