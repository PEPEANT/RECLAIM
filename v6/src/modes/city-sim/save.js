(function (global) {
    const STORAGE_KEY = 'reclaim_citysim_v1';
    const MODE_VERSION = 'city_simple_v3';
    const MIN_CITY_LEVEL = 1;
    const MAX_CITY_LEVEL = 19;
    const DEFAULT_EXP_MAX = 100;
    const FACTORY_RESEARCH_KEYS = ['aa_tank', 'spg', 'icbm', 'chinook', 'bomber'];
    const INCOME_BUILDING_TILE_SET = new Set(['house', 'apartment_large', 'shop_store', 'decor']);
    const VETERAN_ITEM_COMPAT = {
        drone_module: new Set(['drone_operator'])
    };
    const VETERAN_ITEM_KEYS = Object.keys(VETERAN_ITEM_COMPAT);
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

    function sanitizeVeteranEntry(rawEntry, index, allowedUnitKeys) {
        if (!rawEntry || typeof rawEntry !== 'object' || Array.isArray(rawEntry)) return null;
        const unitKey = String(rawEntry.unitKey || rawEntry.key || '').trim();
        if (!unitKey) return null;
        if (allowedUnitKeys && !allowedUnitKeys.has(unitKey)) return null;
        const id = String(rawEntry.id || '').trim() || `vet_${Math.max(0, Math.floor(Number(index) || 0)).toString(36)}`;
        const level = Math.max(2, Math.floor(parseNumber(rawEntry.level, 2)));
        const createdAt = Math.max(0, Math.floor(parseNumber(rawEntry.createdAt, 0)));
        const name = String(rawEntry.name || '').trim().slice(0, 24);
        const rawLoadout = (rawEntry.loadout && typeof rawEntry.loadout === 'object') ? rawEntry.loadout : {};
        const itemKey = sanitizeVeteranItemKey(rawLoadout.itemKey || rawEntry.itemKey || '', unitKey);
        return {
            id,
            unitKey,
            level,
            createdAt,
            name,
            loadout: {
                itemKey
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

    function sanitizeVeteranItemKey(value, unitKey) {
        const key = String(value || '').trim();
        if (!key) return '';
        if (!Object.prototype.hasOwnProperty.call(VETERAN_ITEM_COMPAT, key)) return '';
        const unit = String(unitKey || '').trim();
        const allowed = VETERAN_ITEM_COMPAT[key];
        if (!unit || !(allowed instanceof Set) || !allowed.has(unit)) return '';
        return key;
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
            researchUnlocks: { ...(defaultState.researchUnlocks || {}) },
            grid: seededGrid,
            ground: Array.isArray(defaultState.ground) ? defaultState.ground.slice() : [],
            drillgroundSlots: {},
            drillgroundInfantryCounts: {},
            productionCooldowns: {},
            incomeSlots: {},
            taxAuto: sanitizeTaxAuto(defaultState.taxAuto),
            hud: { ...defaultState.hud },
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
        const user = (fb && typeof fb.getUser === 'function') ? fb.getUser() : null;
        const uid = user && user.uid ? String(user.uid) : '';
        const hasUid = uid.length > 0;
        // Boot race fix: allow local load while auth uid is unresolved.
        const localOwnedByUid = (!saveBridge || typeof saveBridge.isLocalOwnedBy !== 'function')
            ? true
            : (!hasUid ? true : !!saveBridge.isLocalOwnedBy('city', uid));

        if (uid && saveBridge && typeof saveBridge.getCachedCity === 'function') {
            loaded = saveBridge.getCachedCity(uid);
        }

        if (!loaded && localOwnedByUid) {
            try {
                const raw = localStorage.getItem(STORAGE_KEY);
                if (raw) loaded = JSON.parse(raw);
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
            researchUnlocks: isCompatible
                ? sanitizeResearchUnlocks(loaded?.researchUnlocks)
                : sanitizeResearchUnlocks(defaults.researchUnlocks),
            grid: defaults.grid.slice(),
            ground: Array.isArray(defaults.ground)
                ? defaults.ground.slice()
                : new Array(Math.max(1, defaults.cols * defaults.rows)).fill('grass'),
            drillgroundSlots: {},
            drillgroundInfantryCounts: {},
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
            productionCooldowns: serializeProductionCooldowns(state.productionCooldowns, state.grid),
            incomeSlots: serializeIncomeSlots(state.incomeSlots, state.grid),
            taxAuto: sanitizeTaxAuto(state.taxAuto),
            hud: {
                level: currentLevel,
                exp: Math.max(0, Math.min(currentExpMax, Math.floor(Number(state.hud?.exp) || 0))),
                expMax: currentExpMax,
                honor: Math.max(0, Math.floor(Number(state.hud?.honor) || 0))
            },
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
        const uid = user && user.uid ? String(user.uid) : '';
        const authApi = (typeof CitySimAuth !== 'undefined' && CitySimAuth) ? CitySimAuth : null;
        const guestSession = !!(authApi && typeof authApi.isGuestSession === 'function' && authApi.isGuestSession());

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
