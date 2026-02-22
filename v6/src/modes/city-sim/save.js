(function (global) {
    const STORAGE_KEY = 'reclaim_citysim_v1';
    const MODE_VERSION = 'city_simple_v3';
    const MIN_CITY_LEVEL = 1;
    const MAX_CITY_LEVEL = 19;
    const DEFAULT_EXP_MAX = 100;
    const FACTORY_RESEARCH_KEYS = ['aa_tank', 'spg', 'icbm', 'chinook', 'bomber'];
    const INCOME_BUILDING_TILE_SET = new Set(['house', 'apartment_large', 'shop_store', 'decor']);
    const CITY_ITEM_KEYS = ['rifle_d', 'body_armor_d', 'scope_d', 'smoke_grenade', 'medkit_c', 'drone_suicide_item', 'drone_at_item', 'bp_missile'];
    const CITY_ITEM_KEY_SET = new Set(CITY_ITEM_KEYS);
    const SUPPLY_BOX_KEYS = ['box_level1', 'box_level2', 'confidential'];
    const VETERAN_ITEM_COMPAT = {};
    const VETERAN_ITEM_KEYS = Object.keys(VETERAN_ITEM_COMPAT);
    const VETERAN_SKILL_SLOT_COUNT = 3;
    const VETERAN_FIXED_SKILL_SLOT_INDEX = 0;
    const VETERAN_DRONE_ITEM_TO_COMMAND = {
        drone_suicide_item: 'drone_suicide',
        drone_at_item: 'drone_at',
        body_armor_d: '',
        scope_d: '',
        medkit_c: 'medkit'
    };
    // 보병 카테고리 전용 스킬 슬롯 아이템 (construction.js / state.js와 동기화 유지)
    const VETERAN_INFANTRY_ITEM_TO_COMMAND = {
        smoke_grenade: 'smoke',
        medkit_c: 'medkit',
        body_armor_d: '',
        scope_d: ''
    };
    const VETERAN_INFANTRY_UNIT_KEY_SET = new Set(['infantry', 'engineer', 'sniper', 'special_ops', 'worker']);
    const LOGIN_DEBUG_KEY = 'reclaim_login_debug';
    let pendingCityCloudSave = null;
    let pendingCityCloudUid = '';

    function clampLevel(value) {
        return Math.max(MIN_CITY_LEVEL, Math.min(MAX_CITY_LEVEL, Math.floor(Number(value) || MIN_CITY_LEVEL)));
    }

    function getExpRequiredForLevel(level) {
        if (typeof CitySimState !== 'undefined' && CitySimState && typeof CitySimState.getExpRequiredForLevel === 'function') {
            return Math.max(1, Math.floor(Number(CitySimState.getExpRequiredForLevel(level)) || 1));
        }
        return DEFAULT_EXP_MAX;
    }

    function parseNumber(value, fallback) {
        const n = Number(value);
        return Number.isFinite(n) ? n : fallback;
    }

    function sanitizeTutorialMode(value) {
        const key = String(value || '').trim();
        if (key === 'guided' || key === 'skip') return key;
        return '';
    }

    function sanitizeTutorialChoice(value) {
        const key = String(value || '').trim();
        if (key === 'guided' || key === 'skip') return key;
        return '';
    }

    function createDefaultTutorialState() {
        return {
            cityIntroSeen: false,
            cityIntroSkipped: false,
            cityIntroChoice: '',
            mode: '',
            step: 0,
            maxStep: 10,
            completed: false,
            updatedAt: 0
        };
    }

    function sanitizeTutorialState(rawTutorial, fallbackTutorial, legacyCityIntroSeen) {
        const fallback = (fallbackTutorial && typeof fallbackTutorial === 'object' && !Array.isArray(fallbackTutorial))
            ? fallbackTutorial
            : createDefaultTutorialState();
        const raw = (rawTutorial && typeof rawTutorial === 'object' && !Array.isArray(rawTutorial))
            ? rawTutorial
            : {};

        const maxStep = Math.max(1, Math.floor(parseNumber(raw.maxStep, fallback.maxStep || 10)));
        const rawStep = Math.floor(parseNumber(raw.step, fallback.step || 0));
        const seen = raw.cityIntroSeen === true
            || legacyCityIntroSeen === true
            || fallback.cityIntroSeen === true;
        const mode = sanitizeTutorialMode(raw.mode || fallback.mode || '');
        const choice = sanitizeTutorialChoice(raw.cityIntroChoice || fallback.cityIntroChoice || '');
        const skipped = seen && (
            raw.cityIntroSkipped === true
            || fallback.cityIntroSkipped === true
            || mode === 'skip'
            || choice === 'skip'
        );
        const completed = raw.completed === true || fallback.completed === true;
        const updatedAt = Math.max(0, Math.floor(parseNumber(raw.updatedAt, fallback.updatedAt || 0)));

        const normalizedStep = seen
            ? (skipped ? 0 : Math.max(1, Math.min(maxStep, rawStep)))
            : Math.max(0, Math.min(maxStep, rawStep));

        return {
            cityIntroSeen: seen,
            cityIntroSkipped: skipped,
            cityIntroChoice: seen ? (choice || (skipped ? 'skip' : 'guided')) : '',
            mode: mode || (seen ? (skipped ? 'skip' : 'guided') : ''),
            step: normalizedStep,
            maxStep,
            completed,
            updatedAt
        };
    }

    function serializeTutorialState(rawTutorial) {
        return sanitizeTutorialState(rawTutorial, createDefaultTutorialState(), false);
    }

    function isLoginDebugEnabled() {
        if (global && global.__RECLAIM_LOGIN_DEBUG__ === true) return true;
        try {
            return localStorage.getItem(LOGIN_DEBUG_KEY) === '1';
        } catch (_) {
            return false;
        }
    }

    function logLoginDebug(eventName, payload) {
        if (!isLoginDebugEnabled()) return;
        try {
            console.info('[LoginDebug][CitySave]', String(eventName || ''), payload || {});
        } catch (_) { }
    }

    function readLocalOwnerUidForDebug(localKey) {
        const key = `${String(localKey || '').trim()}__owner_uid`;
        if (!key || key === '__owner_uid') return '';
        try {
            return String(localStorage.getItem(key) || '').trim();
        } catch (_) {
            return '';
        }
    }

    function sanitizeTaxAuto(rawAuto) {
        return {
            untilMs: Math.max(0, Math.floor(parseNumber(rawAuto?.untilMs, 0)))
        };
    }

    function cloneJson(value) {
        if (!value || typeof value !== 'object') return null;
        try {
            return JSON.parse(JSON.stringify(value));
        } catch (_) {
            return value;
        }
    }

    function mergeQuestMissionState(primary, secondary) {
        const toState = (value) => (value && typeof value === 'object') ? value : null;
        const a = toState(primary);
        const b = toState(secondary);
        if (!a && !b) return null;
        if (a && !b) return cloneJson(a) || a;
        if (!a && b) return cloneJson(b) || b;

        const recurringIds = new Set(['kill_contract', 'victory_contract']);
        const isRecurringQuestId = (id) => recurringIds.has(String(id || '').trim());
        const statusRank = (status) => {
            const key = String(status || '').trim();
            if (key === 'claimed') return 2;
            if (key === 'claimable') return 1;
            return 0;
        };
        const score = (state) => {
            if (!state || typeof state !== 'object') return 0;
            const counters = (state.counters && typeof state.counters === 'object') ? state.counters : {};
            const quests = (state.quests && typeof state.quests === 'object') ? state.quests : {};
            let claimed = 0;
            Object.keys(quests).forEach((id) => {
                if (String(quests[id]?.status || '') === 'claimed') claimed += 1;
            });
            const kill = Math.max(0, Math.floor(Number(counters.kill) || 0));
            const win = Math.max(0, Math.floor(Number(counters.win) || 0));
            const levelUp = Math.max(0, Math.floor(Number(counters.levelUp) || 0));
            return (claimed * 1000000) + (kill * 1000) + (win * 100) + levelUp;
        };

        const preferred = (score(a) >= score(b)) ? a : b;
        const fallback = (preferred === a) ? b : a;
        const base = cloneJson(preferred) || {};
        const other = cloneJson(fallback) || {};

        const baseQuests = (base.quests && typeof base.quests === 'object') ? base.quests : {};
        const otherQuests = (other.quests && typeof other.quests === 'object') ? other.quests : {};
        base.quests = baseQuests;

        Object.keys(otherQuests).forEach((id) => {
            const src = otherQuests[id];
            if (!src || typeof src !== 'object') return;
            const dst = baseQuests[id];
            if (!dst || typeof dst !== 'object') {
                baseQuests[id] = src;
                return;
            }

            const srcRank = statusRank(src.status);
            const dstRank = statusRank(dst.status);
            if (srcRank > dstRank) {
                dst.status = src.status;
            }

            const srcProgress = Math.max(0, Math.floor(Number(src.progress) || 0));
            const dstProgress = Math.max(0, Math.floor(Number(dst.progress) || 0));
            dst.progress = Math.max(dstProgress, srcProgress);

            const dstTarget = Math.max(0, Math.floor(Number(dst.target) || 0));
            const srcTarget = Math.max(0, Math.floor(Number(src.target) || 0));
            if (srcTarget > 0 && dstTarget <= 0) dst.target = srcTarget;

            if (!isRecurringQuestId(id) && (statusRank(dst.status) >= 2 || srcRank >= 2)) {
                dst.status = 'claimed';
                dst.progress = Math.max(dst.progress, dstTarget, srcTarget);
            }
        });

        const baseCounters = (base.counters && typeof base.counters === 'object') ? base.counters : {};
        const otherCounters = (other.counters && typeof other.counters === 'object') ? other.counters : {};
        base.counters = baseCounters;
        ['kill', 'win', 'levelUp'].forEach((key) => {
            const aValue = Math.max(0, Math.floor(Number(baseCounters[key]) || 0));
            const bValue = Math.max(0, Math.floor(Number(otherCounters[key]) || 0));
            baseCounters[key] = Math.max(aValue, bValue);
        });

        const baseMeta = (base.meta && typeof base.meta === 'object') ? base.meta : {};
        const otherMeta = (other.meta && typeof other.meta === 'object') ? other.meta : {};
        base.meta = baseMeta;
        baseMeta.lastLevel = Math.max(
            1,
            Math.floor(Number(baseMeta.lastLevel) || 1),
            Math.floor(Number(otherMeta.lastLevel) || 1)
        );
        baseMeta.loginSupplyClaimed = (baseMeta.loginSupplyClaimed === true) || (otherMeta.loginSupplyClaimed === true);
        baseMeta.skirmishFirstWinClaimed = (baseMeta.skirmishFirstWinClaimed === true) || (otherMeta.skirmishFirstWinClaimed === true);
        const permanentSet = new Set();
        const permanentA = Array.isArray(baseMeta.permanentClaimed) ? baseMeta.permanentClaimed : [];
        const permanentB = Array.isArray(otherMeta.permanentClaimed) ? otherMeta.permanentClaimed : [];
        permanentA.concat(permanentB).forEach((id) => {
            const key = String(id || '').trim();
            if (!key || isRecurringQuestId(key)) return;
            permanentSet.add(key);
        });

        Object.keys(baseQuests).forEach((id) => {
            const quest = baseQuests[id];
            if (!quest || typeof quest !== 'object') return;
            if (isRecurringQuestId(id)) return;
            if (String(quest.status || '') !== 'claimed') return;
            permanentSet.add(String(id || '').trim());
        });
        if (baseMeta.loginSupplyClaimed === true) permanentSet.add('login_supply_box');
        if (baseMeta.skirmishFirstWinClaimed === true) permanentSet.add('skirmish_first_win_supply_box');

        permanentSet.forEach((id) => {
            if (!id || isRecurringQuestId(id)) return;
            const quest = baseQuests[id];
            if (!quest || typeof quest !== 'object') return;
            const target = Math.max(1, Math.floor(Number(quest.target) || 1));
            quest.progress = Math.max(target, Math.floor(Number(quest.progress) || 0));
            quest.status = 'claimed';
        });

        baseMeta.permanentClaimed = Array.from(permanentSet);
        baseMeta.loginSupplyClaimed = permanentSet.has('login_supply_box');
        baseMeta.skirmishFirstWinClaimed = permanentSet.has('skirmish_first_win_supply_box');
        return base;
    }

    function sanitizeUnits(rawUnits, fallbackUnits, allowedUnitKeys) {
        const next = {
            ...(fallbackUnits && typeof fallbackUnits === 'object' ? fallbackUnits : {})
        };
        if (!rawUnits || typeof rawUnits !== 'object') return next;

        Object.keys(rawUnits).forEach((key) => {
            if (!key) return;
            if (allowedUnitKeys && !allowedUnitKeys.has(key)) return;
            const fallback = Math.max(0, Math.floor(parseNumber(next[key], 0)));
            const count = Math.max(0, Math.floor(parseNumber(rawUnits[key], fallback)));
            next[key] = count;
        });

        return next;
    }

    function serializeUnits(units) {
        const src = (units && typeof units === 'object') ? units : {};
        const serialized = {};

        Object.keys(src).forEach((key) => {
            if (!key) return;
            serialized[key] = Math.max(0, Math.floor(Number(src[key]) || 0));
        });

        if (!Object.prototype.hasOwnProperty.call(serialized, 'icbm')) {
            serialized.icbm = 0;
        }

        return serialized;
    }

    function sanitizeVeteranItemKey(value, unitKey) {
        const key = String(value || '').trim();
        if (!key) return '';
        const unit = String(unitKey || '').trim();
        if (CITY_ITEM_KEY_SET.has(key)) {
            return unit ? key : '';
        }
        if (!Object.prototype.hasOwnProperty.call(VETERAN_ITEM_COMPAT, key)) return '';
        const allowed = VETERAN_ITEM_COMPAT[key];
        if (!unit || !(allowed instanceof Set) || !allowed.has(unit)) return '';
        return key;
    }

    function sanitizeVeteranSkillLoadoutItemKey(value, unitKey) {
        const unit = String(unitKey || '').trim();
        const key = sanitizeVeteranItemKey(value, unit);
        if (!key) return '';
        if (unit === 'drone_operator') {
            if (Object.prototype.hasOwnProperty.call(VETERAN_DRONE_ITEM_TO_COMMAND, key)) return key;
            return '';
        }
        if (VETERAN_INFANTRY_UNIT_KEY_SET.has(unit)) {
            if (Object.prototype.hasOwnProperty.call(VETERAN_INFANTRY_ITEM_TO_COMMAND, key)) return key;
        }
        return '';
    }

    function getDefaultVeteranSkillItemKeys() {
        return Array.from({ length: VETERAN_SKILL_SLOT_COUNT }, () => '');
    }

    function sanitizeVeteranSkillItemKeys(rawLoadout, unitKey) {
        const unit = String(unitKey || '').trim();
        const loadout = (rawLoadout && typeof rawLoadout === 'object' && !Array.isArray(rawLoadout))
            ? rawLoadout
            : {};
        const rawSkillItemKeys = Array.isArray(loadout.skillItemKeys) ? loadout.skillItemKeys : [];
        const skillItemKeys = getDefaultVeteranSkillItemKeys();
        for (let slotIndex = 1; slotIndex < VETERAN_SKILL_SLOT_COUNT; slotIndex++) {
            const key = sanitizeVeteranSkillLoadoutItemKey(rawSkillItemKeys[slotIndex] || '', unit);
            if (!key) continue;
            skillItemKeys[slotIndex] = key;
        }
        const legacyItemKey = sanitizeVeteranSkillLoadoutItemKey(loadout.itemKey || '', unit);
        if (legacyItemKey && !skillItemKeys[1]) {
            skillItemKeys[1] = legacyItemKey;
        }
        skillItemKeys[VETERAN_FIXED_SKILL_SLOT_INDEX] = '';
        return skillItemKeys;
    }

    function getPrimaryVeteranLoadoutItemKey(skillItemKeys) {
        const keys = Array.isArray(skillItemKeys) ? skillItemKeys : [];
        for (let slotIndex = 0; slotIndex < keys.length; slotIndex++) {
            if (slotIndex === VETERAN_FIXED_SKILL_SLOT_INDEX) continue;
            const key = String(keys[slotIndex] || '').trim();
            if (!key) continue;
            return key;
        }
        return '';
    }

    function sanitizeVeteranPassiveLoadoutItemKey(rawLoadout, unitKey) {
        const unit = String(unitKey || '').trim();
        if (!unit) return '';
        const loadout = (rawLoadout && typeof rawLoadout === 'object' && !Array.isArray(rawLoadout))
            ? rawLoadout
            : {};
        const key = sanitizeVeteranItemKey(loadout.itemKey || '', unit);
        if (!key) return '';
        if (sanitizeVeteranSkillLoadoutItemKey(key, unit)) return '';
        return key;
    }

    function sanitizeVeteranEntry(rawEntry, index, allowedUnitKeys) {
        if (!rawEntry || typeof rawEntry !== 'object' || Array.isArray(rawEntry)) return null;
        const unitKey = String(rawEntry.unitKey || rawEntry.key || '').trim();
        if (!unitKey) return null;
        if (allowedUnitKeys && !allowedUnitKeys.has(unitKey)) return null;
        const id = String(rawEntry.id || '').trim() || `vet_${Math.max(0, Math.floor(Number(index) || 0)).toString(36)}`;
        const level = Math.max(2, Math.floor(parseNumber(rawEntry.level, 2)));
        const createdAt = Math.max(0, Math.floor(parseNumber(rawEntry.createdAt, 0)));
        const name = String(rawEntry.name || '').trim().slice(0, 24);
        const rawLoadout = (rawEntry.loadout && typeof rawEntry.loadout === 'object')
            ? rawEntry.loadout
            : { itemKey: rawEntry.itemKey || '' };
        const skillItemKeys = sanitizeVeteranSkillItemKeys(rawLoadout, unitKey);
        const itemKey = sanitizeVeteranPassiveLoadoutItemKey(rawLoadout, unitKey);
        return {
            id,
            unitKey,
            level,
            createdAt,
            name,
            loadout: {
                itemKey,
                skillItemKeys
            }
        };
    }

    function sanitizeVeterans(rawVeterans, allowedUnitKeys) {
        if (!Array.isArray(rawVeterans) || rawVeterans.length === 0) return [];
        const out = [];
        const seenIds = new Set();
        rawVeterans.forEach((entry, index) => {
            const normalized = sanitizeVeteranEntry(entry, index, allowedUnitKeys);
            if (!normalized) return;
            if (seenIds.has(normalized.id)) return;
            seenIds.add(normalized.id);
            out.push(normalized);
        });
        return out;
    }

    function serializeVeterans(rawVeterans, allowedUnitKeys) {
        return sanitizeVeterans(rawVeterans, allowedUnitKeys);
    }

    function sanitizeVeteranItems(rawItems) {
        const out = {};
        VETERAN_ITEM_KEYS.forEach((key) => {
            out[key] = Math.max(0, Math.floor(parseNumber(rawItems?.[key], 0)));
        });
        return out;
    }

    function serializeVeteranItems(rawItems) {
        return sanitizeVeteranItems(rawItems);
    }

    function sanitizeItems(rawItems) {
        const src = (rawItems && typeof rawItems === 'object' && !Array.isArray(rawItems)) ? rawItems : {};
        const out = {};
        CITY_ITEM_KEYS.forEach((key) => {
            const v = Math.max(0, Math.floor(parseNumber(src[key], 0)));
            if (v > 0) out[key] = v;
        });
        return out;
    }

    function sanitizeBoxes(rawBoxes) {
        const src = (rawBoxes && typeof rawBoxes === 'object' && !Array.isArray(rawBoxes)) ? rawBoxes : {};
        const out = {};
        SUPPLY_BOX_KEYS.forEach((key) => {
            const v = Math.max(0, Math.floor(parseNumber(src[key], 0)));
            if (v > 0) out[key] = v;
        });
        return out;
    }

    function sanitizeResearchUnlocks(rawUnlocks) {
        const src = (rawUnlocks && typeof rawUnlocks === 'object' && !Array.isArray(rawUnlocks))
            ? rawUnlocks
            : {};
        const out = {};
        FACTORY_RESEARCH_KEYS.forEach((key) => {
            out[key] = src[key] === true;
        });
        return out;
    }

    function isDrillgroundTile(tile) {
        const key = String(tile || '').trim();
        return key === 'drillground' || key === 'drillground_gray';
    }

    function serializeResearchUnlocks(rawUnlocks) {
        return sanitizeResearchUnlocks(rawUnlocks);
    }

    function sanitizeDrillgroundSlots(rawSlots, expectedSize, allowedUnitKeys, grid) {
        const next = {};
        if (!rawSlots || typeof rawSlots !== 'object' || Array.isArray(rawSlots)) return next;

        const size = Math.max(0, Math.floor(Number(expectedSize) || 0));
        const hasGrid = Array.isArray(grid) && grid.length === size;

        Object.keys(rawSlots).forEach((rawIndex) => {
            const index = Number(rawIndex);
            if (!Number.isInteger(index) || index < 0 || index >= size) return;
            if (hasGrid && !isDrillgroundTile(grid[index])) return;

            const unitKey = String(rawSlots[rawIndex] || '').trim();
            if (!unitKey) return;
            if (allowedUnitKeys && !allowedUnitKeys.has(unitKey)) return;
            next[index] = unitKey;
        });

        return next;
    }

    function serializeDrillgroundSlots(rawSlots, grid) {
        const next = {};
        if (!rawSlots || typeof rawSlots !== 'object' || Array.isArray(rawSlots)) return next;
        if (!Array.isArray(grid)) return next;

        const size = grid.length;
        Object.keys(rawSlots).forEach((rawIndex) => {
            const index = Number(rawIndex);
            if (!Number.isInteger(index) || index < 0 || index >= size) return;
            if (!isDrillgroundTile(grid[index])) return;
            const unitKey = String(rawSlots[rawIndex] || '').trim();
            if (!unitKey) return;
            next[index] = unitKey;
        });

        return next;
    }

    function sanitizeDrillgroundInfantryCounts(rawCounts, expectedSize, grid, drillgroundSlots, allowedUnitKeys) {
        const next = {};
        if (!rawCounts || typeof rawCounts !== 'object' || Array.isArray(rawCounts)) return next;
        if (!Array.isArray(grid)) return next;

        const size = Math.max(0, Math.floor(Number(expectedSize) || 0));
        if (grid.length !== size) return next;
        const slots = (drillgroundSlots && typeof drillgroundSlots === 'object' && !Array.isArray(drillgroundSlots))
            ? drillgroundSlots
            : {};

        Object.keys(rawCounts).forEach((rawIndex) => {
            const index = Number(rawIndex);
            if (!Number.isInteger(index) || index < 0 || index >= size) return;
            if (!isDrillgroundTile(grid[index])) return;
            const unitKey = String(slots[index] || '').trim();
            if (!unitKey) return;
            if (allowedUnitKeys && !allowedUnitKeys.has(unitKey)) return;
            const unitDef = (typeof CONFIG !== 'undefined' && CONFIG?.units)
                ? CONFIG.units[unitKey]
                : null;
            const isInfantry = String(unitDef?.category || '').trim().toLowerCase() === 'infantry';
            if (!isInfantry) return;
            next[index] = Math.max(1, Math.min(4, Math.floor(parseNumber(rawCounts[rawIndex], 1))));
        });

        return next;
    }

    function sanitizeDrillgroundVeteranSlots(rawSlots, expectedSize, grid, drillgroundSlots, veterans, allowedUnitKeys) {
        const next = {};
        if (!rawSlots || typeof rawSlots !== 'object' || Array.isArray(rawSlots)) return next;
        if (!Array.isArray(grid)) return next;

        const size = Math.max(0, Math.floor(Number(expectedSize) || 0));
        if (grid.length !== size) return next;
        const slots = (drillgroundSlots && typeof drillgroundSlots === 'object' && !Array.isArray(drillgroundSlots))
            ? drillgroundSlots
            : {};
        const veteranList = Array.isArray(veterans) ? veterans : [];
        const veteranUnitById = new Map();
        veteranList.forEach((entry) => {
            const id = String(entry?.id || '').trim();
            const unitKey = String(entry?.unitKey || '').trim();
            if (!id || !unitKey) return;
            veteranUnitById.set(id, unitKey);
        });

        Object.keys(rawSlots).forEach((rawIndex) => {
            const index = Number(rawIndex);
            if (!Number.isInteger(index) || index < 0 || index >= size) return;
            if (!isDrillgroundTile(grid[index])) return;
            const slotUnitKey = String(slots[index] || '').trim();
            if (!slotUnitKey) return;
            if (allowedUnitKeys && !allowedUnitKeys.has(slotUnitKey)) return;
            const veteranId = String(rawSlots[rawIndex] || '').trim();
            if (!veteranId) return;
            const veteranUnitKey = String(veteranUnitById.get(veteranId) || '').trim();
            if (!veteranUnitKey || veteranUnitKey !== slotUnitKey) return;
            if (allowedUnitKeys && !allowedUnitKeys.has(veteranUnitKey)) return;
            next[index] = veteranId;
        });

        return next;
    }

    function serializeDrillgroundVeteranSlots(rawSlots, grid, drillgroundSlots, veterans, allowedUnitKeys) {
        if (!Array.isArray(grid)) return {};
        return sanitizeDrillgroundVeteranSlots(
            rawSlots,
            grid.length,
            grid,
            drillgroundSlots,
            veterans,
            allowedUnitKeys
        );
    }

    function serializeDrillgroundInfantryCounts(rawCounts, grid, drillgroundSlots, allowedUnitKeys) {
        const next = {};
        if (!rawCounts || typeof rawCounts !== 'object' || Array.isArray(rawCounts)) return next;
        if (!Array.isArray(grid)) return next;

        const size = grid.length;
        const slots = (drillgroundSlots && typeof drillgroundSlots === 'object' && !Array.isArray(drillgroundSlots))
            ? drillgroundSlots
            : {};

        Object.keys(rawCounts).forEach((rawIndex) => {
            const index = Number(rawIndex);
            if (!Number.isInteger(index) || index < 0 || index >= size) return;
            if (!isDrillgroundTile(grid[index])) return;
            const unitKey = String(slots[index] || '').trim();
            if (!unitKey) return;
            if (allowedUnitKeys && !allowedUnitKeys.has(unitKey)) return;
            const unitDef = (typeof CONFIG !== 'undefined' && CONFIG?.units)
                ? CONFIG.units[unitKey]
                : null;
            const isInfantry = String(unitDef?.category || '').trim().toLowerCase() === 'infantry';
            if (!isInfantry) return;
            next[index] = Math.max(1, Math.min(4, Math.floor(parseNumber(rawCounts[rawIndex], 1))));
        });

        return next;
    }

    function sanitizeProductionQueueEntry(rawEntry, allowedUnitKeys) {
        if (!rawEntry || typeof rawEntry !== 'object' || Array.isArray(rawEntry)) return null;
        const unitKey = String(rawEntry.unitKey || rawEntry.key || '').trim();
        if (!unitKey) return null;
        if (allowedUnitKeys && !allowedUnitKeys.has(unitKey)) return null;
        const until = Math.max(0, Math.floor(parseNumber(rawEntry.until ?? rawEntry.untilMs ?? rawEntry.cooldownUntil, 0)));
        if (!Number.isFinite(until) || until <= 0) return null;
        return {
            unitKey,
            until
        };
    }

    function sanitizeProductionCooldowns(rawCooldowns, expectedSize, grid, allowedUnitKeys) {
        const next = {};
        if (!rawCooldowns || typeof rawCooldowns !== 'object' || Array.isArray(rawCooldowns)) return next;
        if (!Array.isArray(grid)) return next;

        const size = Math.max(0, Math.floor(Number(expectedSize) || 0));
        if (grid.length !== size) return next;

        Object.keys(rawCooldowns).forEach((rawIndex) => {
            const index = Number(rawIndex);
            if (!Number.isInteger(index) || index < 0 || index >= size) return;
            if (!grid[index]) return;
            const entry = sanitizeProductionQueueEntry(rawCooldowns[rawIndex], allowedUnitKeys);
            if (!entry) return;
            next[index] = entry;
        });

        return next;
    }

    function serializeProductionCooldowns(rawCooldowns, grid, allowedUnitKeys) {
        const next = {};
        if (!rawCooldowns || typeof rawCooldowns !== 'object' || Array.isArray(rawCooldowns)) return next;
        if (!Array.isArray(grid)) return next;

        const size = grid.length;
        Object.keys(rawCooldowns).forEach((rawIndex) => {
            const index = Number(rawIndex);
            if (!Number.isInteger(index) || index < 0 || index >= size) return;
            if (!grid[index]) return;
            const entry = sanitizeProductionQueueEntry(rawCooldowns[rawIndex], allowedUnitKeys);
            if (!entry) return;
            next[index] = entry;
        });

        return next;
    }

    function sanitizeIncomeSlots(rawSlots, expectedSize, grid) {
        const next = {};
        if (!rawSlots || typeof rawSlots !== 'object' || Array.isArray(rawSlots)) return next;
        if (!Array.isArray(grid)) return next;

        const size = Math.max(0, Math.floor(Number(expectedSize) || 0));
        if (grid.length !== size) return next;

        Object.keys(rawSlots).forEach((rawIndex) => {
            const index = Number(rawIndex);
            if (!Number.isInteger(index) || index < 0 || index >= size) return;
            if (!INCOME_BUILDING_TILE_SET.has(String(grid[index] || ''))) return;

            const rawEntry = rawSlots[rawIndex];
            const entry = (rawEntry && typeof rawEntry === 'object' && !Array.isArray(rawEntry))
                ? rawEntry
                : { stored: rawEntry, lastAt: 0 };
            const stored = Math.max(0, Math.floor(parseNumber(entry.stored, 0)));
            const lastAt = Math.max(0, Math.floor(parseNumber(entry.lastAt, 0)));
            if (stored <= 0 && lastAt <= 0) return;

            next[index] = { stored, lastAt };
        });

        return next;
    }

    function serializeIncomeSlots(rawSlots, grid) {
        const next = {};
        if (!rawSlots || typeof rawSlots !== 'object' || Array.isArray(rawSlots)) return next;
        if (!Array.isArray(grid)) return next;

        const size = grid.length;
        Object.keys(rawSlots).forEach((rawIndex) => {
            const index = Number(rawIndex);
            if (!Number.isInteger(index) || index < 0 || index >= size) return;
            if (!INCOME_BUILDING_TILE_SET.has(String(grid[index] || ''))) return;

            const rawEntry = rawSlots[rawIndex];
            const entry = (rawEntry && typeof rawEntry === 'object' && !Array.isArray(rawEntry))
                ? rawEntry
                : { stored: rawEntry, lastAt: 0 };
            const stored = Math.max(0, Math.floor(parseNumber(entry.stored, 0)));
            const lastAt = Math.max(0, Math.floor(parseNumber(entry.lastAt, 0)));
            if (stored <= 0 && lastAt <= 0) return;

            next[index] = { stored, lastAt };
        });

        return next;
    }

    function seedInitialHQ(grid, cols, rows) {
        if (!Array.isArray(grid) || grid.length === 0) return;
        const safeCols = Math.max(1, Math.floor(Number(cols) || 1));
        const safeRows = Math.max(1, Math.floor(Number(rows) || 1));
        if ((safeCols * safeRows) !== grid.length) return;

        const centerX = Math.floor(safeCols / 2);
        const centerY = Math.floor(safeRows / 2);
        const centerIndex = (centerY * safeCols) + centerX;

        if (grid[centerIndex] == null) {
            grid[centerIndex] = 'hq';
            return;
        }

        const maxRadius = Math.max(safeCols, safeRows);
        for (let radius = 1; radius <= maxRadius; radius++) {
            const minX = Math.max(0, centerX - radius);
            const maxX = Math.min(safeCols - 1, centerX + radius);
            const minY = Math.max(0, centerY - radius);
            const maxY = Math.min(safeRows - 1, centerY + radius);

            for (let y = minY; y <= maxY; y++) {
                for (let x = minX; x <= maxX; x++) {
                    const idx = (y * safeCols) + x;
                    if (grid[idx] == null) {
                        grid[idx] = 'hq';
                        return;
                    }
                }
            }
        }
    }

    function getDefaults(game) {
        const state = CitySimState.ensure(game);
        const cols = Math.max(CitySimState.DEFAULT_COLS, Number(state.cols) || CitySimState.DEFAULT_COLS);
        const rows = Math.max(CitySimState.DEFAULT_ROWS, Number(state.rows) || CitySimState.DEFAULT_ROWS);

        const defaultState = CitySimState.createInitialState({
            cols,
            rows,
            grid: CitySimConstruction.createDefaultGrid(cols, rows)
        });

        const seededGrid = defaultState.grid.slice();
        seedInitialHQ(seededGrid, defaultState.cols, defaultState.rows);

        return {
            cols: defaultState.cols,
            rows: defaultState.rows,
            selectedTool: defaultState.selectedTool,
            buildTab: defaultState.buildTab,
            inventoryTab: defaultState.inventoryTab,
            buildPanelOpen: false,
            missionOpen: false,
            loopMs: defaultState.loopMs,
            res: { ...defaultState.res },
            units: { ...defaultState.units },
            veterans: Array.isArray(defaultState.veterans) ? defaultState.veterans.slice() : [],
            veteranItems: { ...(defaultState.veteranItems || {}) },
            boxes: sanitizeBoxes(defaultState.boxes),
            items: sanitizeItems(defaultState.items),
            researchUnlocks: { ...(defaultState.researchUnlocks || {}) },
            grid: seededGrid,
            ground: Array.isArray(defaultState.ground) ? defaultState.ground.slice() : [],
            drillgroundSlots: {},
            drillgroundInfantryCounts: {},
            drillgroundVeteranSlots: {},
            productionCooldowns: {},
            incomeSlots: {},
            taxAuto: sanitizeTaxAuto(defaultState.taxAuto),
            hud: { ...defaultState.hud },
            tutorial: sanitizeTutorialState(defaultState.tutorial, defaultState.tutorial, false),
            view: { ...defaultState.view }
        };
    }

    function load(game) {
        const defaults = getDefaults(game);
        const defs = CitySimConstruction.getBuildingDefs();
        const allowedObjectTiles = new Set([null]);
        const allowedUnitKeys = new Set(Object.keys(defaults.units || {}));
        if (typeof CONFIG !== 'undefined' && CONFIG && typeof CONFIG.units === 'object') {
            Object.keys(CONFIG.units).forEach((key) => {
                if (!key || key === 'icbm_enemy') return;
                allowedUnitKeys.add(key);
            });
        }
        Object.keys(defs).forEach((tool) => {
            if (!tool || tool === 'eraser' || tool.startsWith('ground_')) return;
            allowedObjectTiles.add(tool);
        });
        let loaded = null;

        const fb = (typeof RECLAIM_FB !== 'undefined' && RECLAIM_FB) ? RECLAIM_FB : null;
        const saveBridge = (typeof RECLAIM_SAVE !== 'undefined' && RECLAIM_SAVE) ? RECLAIM_SAVE : null;
        const authApi = (typeof CitySimAuth !== 'undefined' && CitySimAuth) ? CitySimAuth : null;
        const user = (fb && typeof fb.getUser === 'function') ? fb.getUser() : null;
        const isAnonAuthUser = !!(user && user.uid && user.isAnonymous === true);
        const rawGuestSession = !!(authApi && typeof authApi.isGuestSession === 'function' && authApi.isGuestSession());
        const guestSession = isAnonAuthUser || (rawGuestSession && !user);
        const uid = user && user.uid ? String(user.uid) : '';
        const hasUid = uid.length > 0;
        const localOwnerUid = readLocalOwnerUidForDebug(STORAGE_KEY);
        let loadedSource = 'none';
        const authTransitioning = !!(authApi && typeof authApi.isAuthTransitioning === 'function' && authApi.isAuthTransitioning());
        const firebaseReady = !!(fb && typeof fb.isReady === 'function' && fb.isReady());
        // UID 미확정일 때:
        // 1) owner가 비어있으면(게스트 로컬) 허용
        // 2) owner가 있으면 cold boot(아직 firebase 미준비)에서만 허용
        // 계정 전환 중에는 항상 차단해 교차 계정 노출을 막는다.
        const unresolvedUidBootFallbackAllowed = (!hasUid
            && !guestSession
            && !authTransitioning
            && (!firebaseReady || !localOwnerUid));
        const localOwnedByUid = guestSession
            ? false
            : ((!saveBridge || typeof saveBridge.isLocalOwnedBy !== 'function')
                ? true
                : (!hasUid ? unresolvedUidBootFallbackAllowed : !!saveBridge.isLocalOwnedBy('city', uid)));
        logLoginDebug('load.start', {
            uid,
            hasUid,
            guestSession,
            STORAGE_KEY,
            localOwnerUid,
            localOwnedByUid,
            authTransitioning,
            firebaseReady,
            unresolvedUidBootFallbackAllowed,
            hasSaveBridge: !!saveBridge,
            hasOwnerCheck: !!(saveBridge && typeof saveBridge.isLocalOwnedBy === 'function')
        });

        if (!guestSession && uid && saveBridge && typeof saveBridge.getCachedCity === 'function') {
            loaded = saveBridge.getCachedCity(uid);
            if (loaded) loadedSource = 'cache';
        }

        if (!loaded && !hasUid && !unresolvedUidBootFallbackAllowed) {
            logLoginDebug('load.skip.uid_unresolved_guard', {
                uid,
                hasUid,
                STORAGE_KEY,
                localOwnerUid,
                authTransitioning,
                firebaseReady
            });
        }
        if (guestSession) {
            logLoginDebug('load.skip.guest_session', {
                uid,
                hasUid,
                guestSession,
                STORAGE_KEY
            });
        }

        if (!loaded && localOwnedByUid) {
            try {
                const raw = localStorage.getItem(STORAGE_KEY);
                if (raw) {
                    loaded = JSON.parse(raw);
                    if (loaded) loadedSource = 'local';
                }
            } catch (_) { }
        }

        const isCompatible = loaded?.modeVersion === MODE_VERSION || loaded?.modeVersion === 'city_simple_v2';

        const selectedTool = (typeof loaded?.selectedTool === 'string' && defs[loaded.selectedTool])
            ? loaded.selectedTool
            : defaults.selectedTool;

        const buildTab = (typeof loaded?.buildTab === 'string' && CitySimConstruction.getBuildTabs().some((tab) => tab.id === loaded.buildTab))
            ? loaded.buildTab
            : defaults.buildTab;

        const inventoryTab = (typeof loaded?.inventoryTab === 'string'
            && CitySimConstruction.getInventoryTabs().some((tab) => tab.id === loaded.inventoryTab))
            ? loaded.inventoryTab
            : defaults.inventoryTab;

        const maxPop = Math.max(1, parseNumber(loaded?.res?.maxPop, defaults.res.maxPop));
        const pop = Math.max(0, Math.min(maxPop, parseNumber(loaded?.res?.pop, defaults.res.pop)));
        const gold = Math.max(0, parseNumber(loaded?.res?.gold, defaults.res.gold));

        const loadedView = isCompatible ? loaded?.view : null;
        const loadedHud = isCompatible ? loaded?.hud : null;
        const hudLevel = clampLevel(parseNumber(loadedHud?.level, defaults.hud.level));
        const hudExpMax = getExpRequiredForLevel(hudLevel);
        const legacyExpMax = Math.max(1, Math.floor(parseNumber(loadedHud?.expMax, DEFAULT_EXP_MAX)));
        const rawHudExp = Math.max(0, Math.floor(parseNumber(loadedHud?.exp, defaults.hud.exp)));
        const hudExp = Math.max(
            0,
            Math.min(hudExpMax, Math.round((Math.min(rawHudExp, legacyExpMax) / legacyExpMax) * hudExpMax))
        );
        const hudHonor = Math.max(0, Math.floor(parseNumber(loadedHud?.honor, defaults.hud.honor || 0)));
        const loadedTutorial = isCompatible ? loaded?.tutorial : null;
        const legacyCityIntroSeen = loaded?.tutorial_city_intro_seen === true;
        const next = {
            cols: defaults.cols,
            rows: defaults.rows,
            selectedTool,
            buildTab,
            inventoryTab,
            buildPanelOpen: false,
            missionOpen: isCompatible && loaded?.missionOpen === true,
            loopMs: Math.max(800, parseNumber(loaded?.loopMs, defaults.loopMs)),
            loopTimer: null,
            res: {
                money: Math.max(0, parseNumber(loaded?.res?.money, defaults.res.money)),
                gold,
                pop,
                maxPop
            },
            units: isCompatible
                ? sanitizeUnits(loaded?.units, defaults.units, allowedUnitKeys)
                : { ...defaults.units },
            veterans: isCompatible
                ? sanitizeVeterans(loaded?.veterans, allowedUnitKeys)
                : (Array.isArray(defaults.veterans) ? defaults.veterans.slice() : []),
            veteranItems: isCompatible
                ? sanitizeVeteranItems(loaded?.veteranItems)
                : sanitizeVeteranItems(defaults.veteranItems),
            boxes: isCompatible
                ? sanitizeBoxes(loaded?.boxes)
                : sanitizeBoxes(defaults.boxes),
            items: isCompatible
                ? sanitizeItems(loaded?.items)
                : sanitizeItems(defaults.items),
            researchUnlocks: isCompatible
                ? sanitizeResearchUnlocks(loaded?.researchUnlocks)
                : sanitizeResearchUnlocks(defaults.researchUnlocks),
            grid: defaults.grid.slice(),
            ground: Array.isArray(defaults.ground)
                ? defaults.ground.slice()
                : new Array(Math.max(1, defaults.cols * defaults.rows)).fill('grass'),
            drillgroundSlots: {},
            drillgroundInfantryCounts: {},
            drillgroundVeteranSlots: {},
            productionCooldowns: {},
            incomeSlots: {},
            taxAuto: isCompatible
                ? sanitizeTaxAuto(loaded?.taxAuto)
                : sanitizeTaxAuto(defaults.taxAuto),
            hud: {
                level: hudLevel,
                exp: hudExp,
                expMax: hudExpMax,
                honor: hudHonor,
                netMoney: 0
            },
            tutorial: isCompatible
                ? sanitizeTutorialState(loadedTutorial, defaults.tutorial, legacyCityIntroSeen)
                : sanitizeTutorialState(defaults.tutorial, defaults.tutorial, false),
            view: {
                x: Math.round(parseNumber(loadedView?.x, defaults.view.x)),
                y: Math.round(parseNumber(loadedView?.y, defaults.view.y)),
                scale: Math.max(0.9, Math.min(2.4, parseNumber(loadedView?.scale, defaults.view.scale)))
            }
        };

        const expectedSize = next.cols * next.rows;
        if (isCompatible && Array.isArray(loaded?.grid) && loaded.grid.length === expectedSize) {
            next.grid = loaded.grid.map((tile) => (allowedObjectTiles.has(tile) ? tile : null));
        }
        if (isCompatible && Array.isArray(loaded?.ground) && loaded.ground.length === expectedSize) {
            next.ground = loaded.ground.map((tile) => {
                if (tile === 'concrete') return 'concrete';
                if (tile === 'dirt') return 'dirt';
                return 'grass';
            });
        }
        if (isCompatible) {
            next.drillgroundSlots = sanitizeDrillgroundSlots(
                loaded?.drillgroundSlots,
                expectedSize,
                allowedUnitKeys,
                next.grid
            );
            next.drillgroundInfantryCounts = sanitizeDrillgroundInfantryCounts(
                loaded?.drillgroundInfantryCounts,
                expectedSize,
                next.grid,
                next.drillgroundSlots,
                allowedUnitKeys
            );
            next.drillgroundVeteranSlots = sanitizeDrillgroundVeteranSlots(
                loaded?.drillgroundVeteranSlots,
                expectedSize,
                next.grid,
                next.drillgroundSlots,
                next.veterans,
                allowedUnitKeys
            );
            next.productionCooldowns = sanitizeProductionCooldowns(
                loaded?.productionCooldowns,
                expectedSize,
                next.grid,
                allowedUnitKeys
            );
            next.incomeSlots = sanitizeIncomeSlots(
                loaded?.incomeSlots,
                expectedSize,
                next.grid
            );
        }
        CitySimState.replace(game, next);
        CitySimState.clearPlacement(game);
        CitySimState.clearSelection(game);

        if (typeof game.recalcCityDerived === 'function') game.recalcCityDerived();

        // Quest state fallback/merge: city snapshot and main payload can diverge, so merge without regressions.
        const loadedQuestMission = (loaded && loaded.questMission && typeof loaded.questMission === 'object')
            ? loaded.questMission
            : null;
        const currentQuestMission = (game && game.cityQuestMission && typeof game.cityQuestMission === 'object')
            ? game.cityQuestMission
            : null;
        const mergedQuestMission = mergeQuestMissionState(loadedQuestMission, currentQuestMission);
        if (mergedQuestMission) {
            if (typeof CityQuestMission !== 'undefined'
                && CityQuestMission
                && typeof CityQuestMission.hydrate === 'function') {
                CityQuestMission.hydrate(game, mergedQuestMission);
            } else {
                game.cityQuestMission = mergedQuestMission;
            }
        }
        const finalLoadedSource = loadedSource === 'none' ? 'default' : loadedSource;
        const uidUnresolvedLocalFallback = (!hasUid && finalLoadedSource === 'local');
        logLoginDebug('load.result', {
            uid,
            hasUid,
            guestSession,
            STORAGE_KEY,
            localOwnerUid,
            localOwnedByUid,
            authTransitioning,
            firebaseReady,
            unresolvedUidBootFallbackAllowed,
            loadedSource: finalLoadedSource,
            loadedModeVersion: loaded && loaded.modeVersion ? String(loaded.modeVersion) : null,
            isCompatible,
            uidUnresolvedLocalFallback
        });
        if (uidUnresolvedLocalFallback) {
            logLoginDebug('risk.uid_unresolved_local_fallback', {
                uid,
                hasUid,
                STORAGE_KEY,
                localOwnerUid,
                localOwnedByUid,
                loadedSource: finalLoadedSource
            });
        }
    }

    function save(game, options) {
        const opts = (options && typeof options === 'object') ? options : {};
        const requireCloud = opts.requireCloud === true;
        const state = CitySimState.ensure(game);
        const allowedUnitKeys = new Set(Object.keys(state.units || {}));
        if (typeof CONFIG !== 'undefined' && CONFIG && typeof CONFIG.units === 'object') {
            Object.keys(CONFIG.units).forEach((key) => {
                if (!key) return;
                allowedUnitKeys.add(key);
            });
        }
        const currentLevel = clampLevel(state.hud?.level);
        const currentExpMax = getExpRequiredForLevel(currentLevel);
        const payload = {
            modeVersion: MODE_VERSION,
            loopMs: state.loopMs,
            selectedTool: state.selectedTool,
            buildTab: state.buildTab,
            inventoryTab: state.inventoryTab,
            missionOpen: state.missionOpen === true,
            res: {
                money: Math.max(0, Number(state.res?.money) || 0),
                gold: Math.max(0, Number(state.res?.gold) || 0),
                pop: Math.max(0, Number(state.res?.pop) || 0),
                maxPop: Math.max(1, Number(state.res?.maxPop) || 1)
            },
            units: serializeUnits(state.units),
            veterans: serializeVeterans(state.veterans, allowedUnitKeys),
            veteranItems: serializeVeteranItems(state.veteranItems),
            boxes: sanitizeBoxes(state.boxes),
            items: sanitizeItems(state.items),
            researchUnlocks: serializeResearchUnlocks(state.researchUnlocks),
            grid: Array.isArray(state.grid) ? state.grid : [],
            ground: Array.isArray(state.ground) ? state.ground.map((tile) => {
                if (tile === 'concrete') return 'concrete';
                if (tile === 'dirt') return 'dirt';
                return 'grass';
            }) : [],
            drillgroundSlots: serializeDrillgroundSlots(state.drillgroundSlots, state.grid),
            drillgroundInfantryCounts: serializeDrillgroundInfantryCounts(
                state.drillgroundInfantryCounts,
                state.grid,
                state.drillgroundSlots,
                allowedUnitKeys
            ),
            drillgroundVeteranSlots: serializeDrillgroundVeteranSlots(
                state.drillgroundVeteranSlots,
                state.grid,
                state.drillgroundSlots,
                state.veterans,
                allowedUnitKeys
            ),
            productionCooldowns: serializeProductionCooldowns(state.productionCooldowns, state.grid),
            incomeSlots: serializeIncomeSlots(state.incomeSlots, state.grid),
            taxAuto: sanitizeTaxAuto(state.taxAuto),
            hud: {
                level: currentLevel,
                exp: Math.max(0, Math.min(currentExpMax, Math.floor(Number(state.hud?.exp) || 0))),
                expMax: currentExpMax,
                honor: Math.max(0, Math.floor(Number(state.hud?.honor) || 0))
            },
            tutorial: serializeTutorialState(state.tutorial),
            tutorial_city_intro_seen: state.tutorial?.cityIntroSeen === true,
            view: {
                x: Math.round(Number(state.view?.x) || 0),
                y: Math.round(Number(state.view?.y) || 0),
                scale: Math.max(0.9, Math.min(2.4, Number(state.view?.scale) || 1))
            },
            questMission: (typeof CityQuestMission !== 'undefined'
                && CityQuestMission
                && typeof CityQuestMission.serialize === 'function')
                ? (CityQuestMission.serialize(game) || null)
                : null
        };

        const fb = (typeof RECLAIM_FB !== 'undefined' && RECLAIM_FB) ? RECLAIM_FB : null;
        const saveBridge = (typeof RECLAIM_SAVE !== 'undefined' && RECLAIM_SAVE) ? RECLAIM_SAVE : null;
        const user = (fb && typeof fb.getUser === 'function') ? fb.getUser() : null;
        const isAnonAuthUser = !!(user && user.uid && user.isAnonymous === true);
        const uid = user && user.uid ? String(user.uid) : '';
        const authApi = (typeof CitySimAuth !== 'undefined' && CitySimAuth) ? CitySimAuth : null;
        const rawGuestSession = !!(authApi && typeof authApi.isGuestSession === 'function' && authApi.isGuestSession());
        const guestSession = isAnonAuthUser || (rawGuestSession && !user);
        const authTransitioning = !!(authApi && typeof authApi.isAuthTransitioning === 'function' && authApi.isAuthTransitioning());
        const blockLocalWriteForUidTransition = (!guestSession && !uid && authTransitioning);

        let cloudSavePromise = Promise.resolve(true);
        if (!guestSession && uid && saveBridge && typeof saveBridge.saveCity === 'function') {
            const isReady = (!authApi || typeof authApi.isCloudSyncReady !== 'function')
                ? true
                : !!authApi.isCloudSyncReady(uid);

            const enqueueCloudSave = () => {
                try {
                    return Promise.resolve(saveBridge.saveCity(uid, payload))
                        .then(() => true)
                        .catch((err) => {
                            console.warn('[CitySimSave] cloud save failed(city):', err);
                            return false;
                        });
                } catch (err) {
                    console.warn('[CitySimSave] cloud save enqueue failed(city):', err);
                    return Promise.resolve(false);
                }
            };

            const ensureAndSaveCity = () => {
                if (authApi && typeof authApi.ensureCloudReadyForSave === 'function') {
                    return Promise.resolve(authApi.ensureCloudReadyForSave(uid, game))
                        .then((ready) => {
                            if (!ready) return false;
                            return enqueueCloudSave();
                        })
                        .catch((err) => {
                            console.warn('[CitySimSave] ensureCloudReadyForSave failed(city):', err);
                            return false;
                        });
                }
                return Promise.resolve(false);
            };

            if (isReady) {
                cloudSavePromise = enqueueCloudSave();
            } else if (requireCloud) {
                if (pendingCityCloudSave && pendingCityCloudUid === uid) {
                    cloudSavePromise = pendingCityCloudSave;
                } else {
                    cloudSavePromise = ensureAndSaveCity();
                }
            } else {
                if (!pendingCityCloudSave || pendingCityCloudUid !== uid) {
                    pendingCityCloudUid = uid;
                    pendingCityCloudSave = ensureAndSaveCity()
                        .finally(() => {
                            if (pendingCityCloudUid === uid) {
                                pendingCityCloudUid = '';
                                pendingCityCloudSave = null;
                            }
                        });
                }
                cloudSavePromise = Promise.resolve(true);
            }
        }

        if (guestSession) {
            logLoginDebug('save.local.skip.guest_session', {
                uid,
                guestSession,
                requireCloud,
                authTransitioning,
                STORAGE_KEY
            });
            return cloudSavePromise;
        }

        if (blockLocalWriteForUidTransition) {
            logLoginDebug('save.local.skip.transition_uid_unresolved', {
                uid,
                guestSession,
                requireCloud,
                authTransitioning,
                STORAGE_KEY
            });
            return cloudSavePromise;
        }

        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
            if (saveBridge && typeof saveBridge.setLocalOwner === 'function') {
                saveBridge.setLocalOwner('city', guestSession ? '' : (uid || ''));
            }
        } catch (_) { }
        return cloudSavePromise;
    }

    global.CitySimSave = {
        STORAGE_KEY,
        getDefaults,
        load,
        save
    };
})(window);
