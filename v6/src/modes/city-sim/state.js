(function (global) {
    const DEFAULT_COLS = 24;
    const DEFAULT_ROWS = 14;
    const DEFAULT_LOOP_MS = 2500;
    const MIN_CITY_LEVEL = 1;
    const MAX_CITY_LEVEL = 19;
    const DEFAULT_EXP_MAX = 100;
    const FACTORY_RESEARCH_KEYS = ['aa_tank', 'spg', 'icbm', 'chinook', 'bomber'];
    const INCOME_BUILDING_TILE_SET = new Set(['house', 'apartment_large', 'shop_store', 'decor']);
    const VETERAN_ITEM_COMPAT = {
        drone_module: new Set(['drone_operator'])
    };
    const VETERAN_ITEM_KEYS = Object.keys(VETERAN_ITEM_COMPAT);

    function clampLevel(value) {
        return Math.max(MIN_CITY_LEVEL, Math.min(MAX_CITY_LEVEL, Math.floor(Number(value) || MIN_CITY_LEVEL)));
    }

    // 초반(이등병~병장)은 빠르게, 하사/중사/상사 구간부터 단계적으로 어렵게 만든 경험치 곡선.
    function getExpRequiredForLevel(level) {
        const safeLevel = clampLevel(level);
        if (safeLevel >= MAX_CITY_LEVEL) return 1;
        if (safeLevel <= 1) return 12;
        if (safeLevel <= 2) return 16;
        if (safeLevel <= 3) return 20;
        if (safeLevel <= 4) return 26;  // 하사 진입 전
        if (safeLevel <= 5) return 36;  // 하사 이후
        if (safeLevel <= 6) return 50;  // 중사 이후
        if (safeLevel <= 7) return 68;  // 상사 이후
        if (safeLevel <= 9) return 82;
        if (safeLevel <= 11) return 98;
        if (safeLevel <= 13) return 118;
        if (safeLevel <= 15) return 142;
        if (safeLevel <= 17) return 172;
        return 206;
    }

    function createDefaultResources() {
        return {
            money: 10000,
            gold: 0,
            pop: 6,
            maxPop: 20
        };
    }

    function createDefaultUnits() {
        return {
            icbm: 0
        };
    }

    function toNumber(value, fallback) {
        const parsed = Number(value);
        return Number.isFinite(parsed) ? parsed : fallback;
    }

    function createPlacementState() {
        return {
            active: false,
            mode: 'build',
            tool: null,
            targetIndex: null,
            canPlace: false,
            reason: '',
            sourceIndex: null
        };
    }

    function normalizeGroundType(value) {
        if (value === 'dirt') return 'dirt';
        if (value === 'concrete') return 'concrete';
        if (value === 'asphalt') return 'asphalt';
        return 'grass';
    }

    function applyPerimeterGround(layer, cols, rows, type = 'dirt', thickness = 1) {
        if (!Array.isArray(layer) || layer.length === 0) return layer;

        const safeCols = Math.max(1, Math.floor(Number(cols) || 1));
        const safeRows = Math.max(1, Math.floor(Number(rows) || 1));
        const total = safeCols * safeRows;
        if (layer.length !== total) return layer;

        const borderType = normalizeGroundType(type);
        const borderWidth = Math.max(1, Math.floor(Number(thickness) || 1));

        for (let y = 0; y < safeRows; y++) {
            for (let x = 0; x < safeCols; x++) {
                const isPerimeter = (
                    x < borderWidth ||
                    y < borderWidth ||
                    x >= (safeCols - borderWidth) ||
                    y >= (safeRows - borderWidth)
                );
                if (!isPerimeter) continue;
                const index = (y * safeCols) + x;
                layer[index] = borderType;
            }
        }
        return layer;
    }

    function normalizeDrillgroundSlots(rawSlots, total, grid) {
        const next = {};
        if (!rawSlots || typeof rawSlots !== 'object' || Array.isArray(rawSlots)) return next;

        const safeTotal = Math.max(0, Math.floor(Number(total) || 0));
        const hasGrid = Array.isArray(grid) && grid.length === safeTotal;

        Object.keys(rawSlots).forEach((rawIndex) => {
            const index = Number(rawIndex);
            if (!Number.isInteger(index) || index < 0 || index >= safeTotal) return;
            if (hasGrid && grid[index] !== 'drillground') return;
            const unitKey = String(rawSlots[rawIndex] || '').trim();
            if (!unitKey) return;
            next[index] = unitKey;
        });

        return next;
    }

    function normalizeProductionQueueEntry(rawEntry) {
        if (!rawEntry || typeof rawEntry !== 'object' || Array.isArray(rawEntry)) return null;
        const unitKey = String(rawEntry.unitKey || rawEntry.key || '').trim();
        if (!unitKey) return null;
        const until = Math.max(0, Math.floor(Number(rawEntry.until ?? rawEntry.untilMs ?? rawEntry.cooldownUntil) || 0));
        if (!Number.isFinite(until) || until <= 0) return null;
        return {
            unitKey,
            until
        };
    }

    function cloneProductionQueueEntry(entry) {
        if (!entry) return null;
        return {
            unitKey: entry.unitKey,
            until: entry.until
        };
    }

    function normalizeProductionCooldowns(rawCooldowns, total, grid) {
        const next = {};
        if (!rawCooldowns || typeof rawCooldowns !== 'object' || Array.isArray(rawCooldowns)) return next;

        const safeTotal = Math.max(0, Math.floor(Number(total) || 0));
        const hasGrid = Array.isArray(grid) && grid.length === safeTotal;

        Object.keys(rawCooldowns).forEach((rawIndex) => {
            const index = Number(rawIndex);
            if (!Number.isInteger(index) || index < 0 || index >= safeTotal) return;
            if (hasGrid && !grid[index]) return;
            const entry = normalizeProductionQueueEntry(rawCooldowns[rawIndex]);
            if (!entry) return;
            next[index] = entry;
        });

        return next;
    }

    function normalizeIncomeSlots(rawSlots, total, grid) {
        const next = {};
        if (!rawSlots || typeof rawSlots !== 'object' || Array.isArray(rawSlots)) return next;

        const safeTotal = Math.max(0, Math.floor(Number(total) || 0));
        const hasGrid = Array.isArray(grid) && grid.length === safeTotal;

        Object.keys(rawSlots).forEach((rawIndex) => {
            const index = Number(rawIndex);
            if (!Number.isInteger(index) || index < 0 || index >= safeTotal) return;
            if (hasGrid && !INCOME_BUILDING_TILE_SET.has(String(grid[index] || ''))) return;

            const rawEntry = rawSlots[rawIndex];
            const entry = (rawEntry && typeof rawEntry === 'object' && !Array.isArray(rawEntry))
                ? rawEntry
                : { stored: rawEntry, lastAt: 0 };
            const stored = Math.max(0, Math.floor(Number(entry.stored) || 0));
            const lastAt = Math.max(0, Math.floor(Number(entry.lastAt) || 0));
            if (stored <= 0 && lastAt <= 0) return;

            next[index] = { stored, lastAt };
        });

        return next;
    }

    function normalizeTaxAuto(rawAuto) {
        return {
            untilMs: Math.max(0, Math.floor(Number(rawAuto?.untilMs) || 0))
        };
    }

    function normalizeVeteranName(value, fallback = '') {
        const base = String(value == null ? '' : value).trim();
        if (!base) return String(fallback || '');
        return base.slice(0, 24);
    }

    function normalizeVeteranItemKey(value, unitKey = '') {
        const key = String(value == null ? '' : value).trim();
        if (!key) return '';
        if (!Object.prototype.hasOwnProperty.call(VETERAN_ITEM_COMPAT, key)) return '';
        const unit = String(unitKey || '').trim();
        const allowed = VETERAN_ITEM_COMPAT[key];
        if (!unit || !(allowed instanceof Set) || !allowed.has(unit)) return '';
        return key;
    }

    function normalizeVeteranItems(rawItems) {
        const out = {};
        VETERAN_ITEM_KEYS.forEach((key) => {
            const count = Math.max(0, Math.floor(Number(rawItems?.[key]) || 0));
            out[key] = count;
        });
        return out;
    }

    function normalizeResearchUnlocks(rawUnlocks) {
        const src = (rawUnlocks && typeof rawUnlocks === 'object' && !Array.isArray(rawUnlocks))
            ? rawUnlocks
            : {};
        const out = {};
        FACTORY_RESEARCH_KEYS.forEach((key) => {
            out[key] = src[key] === true;
        });
        return out;
    }

    function normalizeVeteranEntry(rawEntry, fallbackIndex = 0) {
        if (!rawEntry || typeof rawEntry !== 'object' || Array.isArray(rawEntry)) return null;
        const unitKey = String(rawEntry.unitKey || rawEntry.key || '').trim();
        if (!unitKey) return null;
        const idRaw = String(rawEntry.id || '').trim();
        const id = idRaw || `vet_${Date.now().toString(36)}_${Math.max(0, Math.floor(Number(fallbackIndex) || 0)).toString(36)}`;
        const createdAt = Math.max(0, Math.floor(Number(rawEntry.createdAt) || 0));
        const level = Math.max(2, Math.floor(Number(rawEntry.level) || 2));
        const name = normalizeVeteranName(rawEntry.name || '', '');
        const rawLoadout = (rawEntry.loadout && typeof rawEntry.loadout === 'object') ? rawEntry.loadout : {};
        const itemKey = normalizeVeteranItemKey(rawLoadout.itemKey || rawEntry.itemKey || '', unitKey);
        return {
            id,
            unitKey,
            level,
            name,
            createdAt,
            loadout: {
                itemKey
            }
        };
    }

    function normalizeVeterans(rawVeterans) {
        if (!Array.isArray(rawVeterans) || rawVeterans.length === 0) return [];
        const out = [];
        const seenIds = new Set();
        rawVeterans.forEach((entry, index) => {
            const normalized = normalizeVeteranEntry(entry, index);
            if (!normalized) return;
            if (seenIds.has(normalized.id)) return;
            seenIds.add(normalized.id);
            out.push(normalized);
        });
        return out;
    }

    function createInitialState(options = {}) {
        const cols = Math.max(1, Math.floor(toNumber(options.cols, DEFAULT_COLS)));
        const rows = Math.max(1, Math.floor(toNumber(options.rows, DEFAULT_ROWS)));
        const total = cols * rows;
        const defaultRes = createDefaultResources();
        const defaultUnits = createDefaultUnits();

        const money = Math.max(0, toNumber(options?.res?.money, defaultRes.money));
        const gold = Math.max(0, toNumber(options?.res?.gold, defaultRes.gold));
        const maxPop = Math.max(1, toNumber(options?.res?.maxPop, defaultRes.maxPop));
        const pop = Math.max(0, Math.min(maxPop, toNumber(options?.res?.pop, defaultRes.pop)));
        const icbm = Math.max(0, Math.floor(toNumber(options?.units?.icbm, defaultUnits.icbm)));

        let ground = Array.isArray(options.ground) ? options.ground.slice(0, total) : null;
        if (!Array.isArray(ground) || ground.length !== total) {
            ground = new Array(total).fill('grass');
        } else {
            ground = ground.map((item) => normalizeGroundType(item));
        }
        applyPerimeterGround(ground, cols, rows, 'grass', 1);
        const baseGrid = Array.isArray(options.grid) ? options.grid.slice() : [];
        const drillgroundSlots = normalizeDrillgroundSlots(options.drillgroundSlots, total, baseGrid);
        const productionCooldowns = normalizeProductionCooldowns(options.productionCooldowns, total, baseGrid);
        const incomeSlots = normalizeIncomeSlots(options.incomeSlots, total, baseGrid);
        const level = clampLevel(toNumber(options?.hud?.level, MIN_CITY_LEVEL));
        const expMax = getExpRequiredForLevel(level);
        const rawExpMax = Math.max(1, Math.floor(toNumber(options?.hud?.expMax, DEFAULT_EXP_MAX)));
        const rawExp = Math.max(0, Math.floor(toNumber(options?.hud?.exp, 0)));
        const exp = Math.max(0, Math.min(expMax, Math.round((Math.min(rawExp, rawExpMax) / rawExpMax) * expMax)));
        const honor = Math.max(0, Math.floor(toNumber(options?.hud?.honor, 0)));
        const veterans = normalizeVeterans(options.veterans);
        const veteranItems = normalizeVeteranItems(options.veteranItems);
        const researchUnlocks = normalizeResearchUnlocks(options.researchUnlocks);

        return {
            cols,
            rows,
            selectedTool: (typeof options.selectedTool === 'string' && options.selectedTool) ? options.selectedTool : 'road',
            buildTab: (typeof options.buildTab === 'string' && options.buildTab) ? options.buildTab : 'base',
            inventoryTab: (typeof options.inventoryTab === 'string' && options.inventoryTab) ? options.inventoryTab : 'infantry',
            buildPanelOpen: options.buildPanelOpen === true,
            inventoryPanelOpen: options.inventoryPanelOpen === true,
            missionOpen: options.missionOpen === true,
            loopMs: Math.max(800, toNumber(options.loopMs, DEFAULT_LOOP_MS)),
            loopTimer: null,
            res: {
                money,
                gold,
                pop,
                maxPop
            },
            units: {
                icbm
            },
            veterans,
            veteranItems,
            researchUnlocks,
            boxes: {},
            grid: baseGrid,
            ground,
            drillgroundSlots,
            productionCooldowns,
            incomeSlots,
            taxAuto: normalizeTaxAuto(options.taxAuto),
            placement: createPlacementState(),
            selection: {
                index: null,
                tile: null
            },
            hud: {
                level,
                exp,
                expMax,
                honor,
                netMoney: 0
            },
            view: {
                x: toNumber(options?.view?.x, 0),
                y: toNumber(options?.view?.y, 0),
                scale: Math.max(0.9, Math.min(2.4, toNumber(options?.view?.scale, 1)))
            }
        };
    }

    function ensure(game) {
        if (!game || typeof game !== 'object') return createInitialState();
        if (!game.citySim || typeof game.citySim !== 'object') {
            game.citySim = createInitialState();
        }

        if (!game.citySim.res || typeof game.citySim.res !== 'object') {
            game.citySim.res = createDefaultResources();
        }

        if (!game.citySim.units || typeof game.citySim.units !== 'object') {
            game.citySim.units = createDefaultUnits();
        }

        if (!Array.isArray(game.citySim.veterans)) {
            game.citySim.veterans = [];
        }

        if (!game.citySim.veteranItems || typeof game.citySim.veteranItems !== 'object') {
            game.citySim.veteranItems = {};
        }

        if (!game.citySim.researchUnlocks || typeof game.citySim.researchUnlocks !== 'object') {
            game.citySim.researchUnlocks = {};
        }

        if (!game.citySim.boxes || typeof game.citySim.boxes !== 'object') {
            game.citySim.boxes = {};
        }

        if (!game.citySim.placement || typeof game.citySim.placement !== 'object') {
            game.citySim.placement = createPlacementState();
        }

        if (!game.citySim.selection || typeof game.citySim.selection !== 'object') {
            game.citySim.selection = { index: null, tile: null };
        }

        const total = Math.max(
            1,
            Math.floor(Number(game.citySim.cols) || DEFAULT_COLS) * Math.max(1, Math.floor(Number(game.citySim.rows) || DEFAULT_ROWS))
        );
        if (!Array.isArray(game.citySim.grid)) {
            game.citySim.grid = new Array(total).fill(null);
        }
        if (game.citySim.grid.length !== total) {
            const nextGrid = new Array(total).fill(null);
            for (let i = 0; i < Math.min(total, game.citySim.grid.length); i++) {
                nextGrid[i] = game.citySim.grid[i] ?? null;
            }
            game.citySim.grid = nextGrid;
        }

        game.citySim.drillgroundSlots = normalizeDrillgroundSlots(
            game.citySim.drillgroundSlots,
            total,
            game.citySim.grid
        );
        game.citySim.productionCooldowns = normalizeProductionCooldowns(
            game.citySim.productionCooldowns,
            total,
            game.citySim.grid
        );
        game.citySim.incomeSlots = normalizeIncomeSlots(
            game.citySim.incomeSlots,
            total,
            game.citySim.grid
        );
        game.citySim.taxAuto = normalizeTaxAuto(game.citySim.taxAuto);

        if (!Array.isArray(game.citySim.ground)) {
            game.citySim.ground = new Array(total).fill('grass');
        }
        if (game.citySim.ground.length !== total) {
            const next = new Array(total).fill('grass');
            for (let i = 0; i < Math.min(total, game.citySim.ground.length); i++) {
                next[i] = normalizeGroundType(game.citySim.ground[i]);
            }
            game.citySim.ground = next;
        }
        for (let i = 0; i < game.citySim.ground.length; i++) {
            game.citySim.ground[i] = normalizeGroundType(game.citySim.ground[i]);
        }
        applyPerimeterGround(
            game.citySim.ground,
            Math.max(1, Math.floor(Number(game.citySim.cols) || DEFAULT_COLS)),
            Math.max(1, Math.floor(Number(game.citySim.rows) || DEFAULT_ROWS)),
            'grass',
            1
        );

        if (!game.citySim.hud || typeof game.citySim.hud !== 'object') {
            game.citySim.hud = {
                level: MIN_CITY_LEVEL,
                exp: 0,
                expMax: getExpRequiredForLevel(MIN_CITY_LEVEL),
                honor: 0,
                netMoney: 0
            };
        }

        if (!game.citySim.view || typeof game.citySim.view !== 'object') {
            game.citySim.view = {
                x: 0,
                y: 0,
                scale: 1
            };
        }

        if (typeof game.citySim.buildTab !== 'string' || !game.citySim.buildTab) {
            game.citySim.buildTab = 'base';
        }

        if (typeof game.citySim.inventoryTab !== 'string' || !game.citySim.inventoryTab) {
            game.citySim.inventoryTab = 'infantry';
        }

        if (typeof game.citySim.missionOpen !== 'boolean') {
            game.citySim.missionOpen = false;
        }

        if (typeof game.citySim.inventoryPanelOpen !== 'boolean') {
            game.citySim.inventoryPanelOpen = false;
        }

        game.citySim.res.money = Math.max(0, Number(game.citySim.res.money) || 0);
        game.citySim.res.gold = Math.max(0, Number(game.citySim.res.gold) || 0);
        game.citySim.res.maxPop = Math.max(1, Number(game.citySim.res.maxPop) || 20);
        game.citySim.res.pop = Math.max(0, Number(game.citySim.res.pop) || 0);
        game.citySim.units.icbm = Math.max(0, Math.floor(Number(game.citySim.units.icbm) || 0));
        game.citySim.units.nuke = Math.min(Math.max(0, Math.floor(Number(game.citySim.units.nuke) || 0)), 2);
        game.citySim.veterans = normalizeVeterans(game.citySim.veterans);
        game.citySim.veteranItems = normalizeVeteranItems(game.citySim.veteranItems);
        game.citySim.researchUnlocks = normalizeResearchUnlocks(game.citySim.researchUnlocks);

        game.citySim.hud.level = clampLevel(game.citySim.hud.level);
        const targetExpMax = getExpRequiredForLevel(game.citySim.hud.level);
        const prevExpMax = Math.max(1, Math.floor(Number(game.citySim.hud.expMax) || DEFAULT_EXP_MAX));
        let normalizedExp = Math.max(0, Math.floor(Number(game.citySim.hud.exp) || 0));
        if (prevExpMax !== targetExpMax) {
            normalizedExp = Math.round((Math.min(normalizedExp, prevExpMax) / prevExpMax) * targetExpMax);
        }
        game.citySim.hud.expMax = targetExpMax;
        game.citySim.hud.exp = Math.max(0, Math.min(game.citySim.hud.expMax, normalizedExp));
        game.citySim.hud.honor = Math.max(0, Math.floor(Number(game.citySim.hud.honor) || 0));
        game.citySim.hud.netMoney = Number(game.citySim.hud.netMoney) || 0;

        game.citySim.view.scale = Math.max(0.9, Math.min(2.4, Number(game.citySim.view.scale) || 1));
        game.citySim.view.x = Math.round(Number(game.citySim.view.x) || 0);
        game.citySim.view.y = Math.round(Number(game.citySim.view.y) || 0);

        return game.citySim;
    }

    function replace(game, nextState) {
        const current = ensure(game);
        game.citySim = {
            ...current,
            ...(nextState || {})
        };
        ensure(game);
        return game.citySim;
    }

    function mutate(game, mutator) {
        const state = ensure(game);
        if (typeof mutator === 'function') {
            mutator(state);
        }
        return state;
    }

    function setBuildPanelOpen(game, open) {
        mutate(game, (state) => {
            state.buildPanelOpen = !!open;
        });
    }

    function setInventoryPanelOpen(game, open) {
        mutate(game, (state) => {
            state.inventoryPanelOpen = !!open;
        });
    }

    function setMissionOpen(game, open) {
        mutate(game, (state) => {
            state.missionOpen = !!open;
        });
    }

    function setBuildTab(game, tab) {
        if (!tab) return;
        mutate(game, (state) => {
            state.buildTab = tab;
        });
    }

    function setSelectedTool(game, tool) {
        if (!tool) return;
        mutate(game, (state) => {
            state.selectedTool = tool;
        });
    }

    function setInventoryTab(game, tab) {
        if (!tab) return;
        mutate(game, (state) => {
            state.inventoryTab = tab;
        });
    }

    function setGridTile(game, index, tile) {
        mutate(game, (state) => {
            if (!Array.isArray(state.grid)) state.grid = [];
            if (index < 0 || index >= state.grid.length) return;
            const prev = state.grid[index] ?? null;
            state.grid[index] = tile;
            if (tile !== 'drillground' && state.drillgroundSlots && typeof state.drillgroundSlots === 'object') {
                delete state.drillgroundSlots[index];
            }
            if (prev !== tile && state.productionCooldowns && typeof state.productionCooldowns === 'object') {
                delete state.productionCooldowns[index];
            }
            if (prev !== tile && state.incomeSlots && typeof state.incomeSlots === 'object') {
                delete state.incomeSlots[index];
            }
        });
    }

    function getDrillgroundUnit(game, index) {
        const state = ensure(game);
        if (!Number.isInteger(index) || index < 0 || index >= state.grid.length) return null;
        const unitKey = String(state.drillgroundSlots?.[index] || '').trim();
        return unitKey || null;
    }

    function setDrillgroundUnit(game, index, unitKey) {
        mutate(game, (state) => {
            if (!Number.isInteger(index) || index < 0 || index >= state.grid.length) return;
            if (!state.drillgroundSlots || typeof state.drillgroundSlots !== 'object') {
                state.drillgroundSlots = {};
            }
            const nextKey = String(unitKey || '').trim();
            if (!nextKey || state.grid[index] !== 'drillground') {
                delete state.drillgroundSlots[index];
                return;
            }
            state.drillgroundSlots[index] = nextKey;
        });
    }

    function clearDrillgroundUnit(game, index) {
        mutate(game, (state) => {
            if (!state.drillgroundSlots || typeof state.drillgroundSlots !== 'object') return;
            if (!Number.isInteger(index) || index < 0 || index >= state.grid.length) return;
            delete state.drillgroundSlots[index];
        });
    }

    function getProductionCooldownUntil(game, index) {
        const state = ensure(game);
        if (!Number.isInteger(index) || index < 0 || index >= state.grid.length) return 0;
        const entry = normalizeProductionQueueEntry(state.productionCooldowns?.[index]);
        return entry ? entry.until : 0;
    }

    function getProductionQueue(game, index) {
        const state = ensure(game);
        if (!Number.isInteger(index) || index < 0 || index >= state.grid.length) return null;
        const entry = normalizeProductionQueueEntry(state.productionCooldowns?.[index]);
        return cloneProductionQueueEntry(entry);
    }

    function setProductionCooldownUntil(game, index, until) {
        mutate(game, (state) => {
            if (!Number.isInteger(index) || index < 0 || index >= state.grid.length) return;
            if (!state.productionCooldowns || typeof state.productionCooldowns !== 'object') {
                state.productionCooldowns = {};
            }
            const untilMs = Math.max(0, Math.floor(Number(until) || 0));
            const currentEntry = normalizeProductionQueueEntry(state.productionCooldowns[index]);
            if (!currentEntry || untilMs <= 0 || !state.grid[index]) {
                delete state.productionCooldowns[index];
                return;
            }
            state.productionCooldowns[index] = {
                unitKey: currentEntry.unitKey,
                until: untilMs
            };
        });
    }

    function setProductionQueue(game, index, entry) {
        mutate(game, (state) => {
            if (!Number.isInteger(index) || index < 0 || index >= state.grid.length) return;
            if (!state.productionCooldowns || typeof state.productionCooldowns !== 'object') {
                state.productionCooldowns = {};
            }
            const normalized = normalizeProductionQueueEntry(entry);
            if (!normalized || !state.grid[index]) {
                delete state.productionCooldowns[index];
                return;
            }
            state.productionCooldowns[index] = normalized;
        });
    }

    function clearProductionQueue(game, index) {
        mutate(game, (state) => {
            if (!state.productionCooldowns || typeof state.productionCooldowns !== 'object') return;
            if (!Number.isInteger(index) || index < 0 || index >= state.grid.length) return;
            delete state.productionCooldowns[index];
        });
    }

    function clearProductionCooldown(game, index) {
        clearProductionQueue(game, index);
    }

    function setGroundTile(game, index, type) {
        mutate(game, (state) => {
            if (!Array.isArray(state.ground)) return;
            if (index < 0 || index >= state.ground.length) return;
            state.ground[index] = normalizeGroundType(type);
        });
    }

    function setLoopTimer(game, timerId) {
        mutate(game, (state) => {
            state.loopTimer = timerId || null;
        });
    }

    function clearLoopTimer(game) {
        mutate(game, (state) => {
            state.loopTimer = null;
        });
    }

    function setPlacement(game, patch) {
        mutate(game, (state) => {
            state.placement = {
                ...state.placement,
                ...(patch || {})
            };
        });
    }

    function clearPlacement(game) {
        mutate(game, (state) => {
            state.placement = createPlacementState();
        });
    }

    function setSelection(game, index, tile) {
        mutate(game, (state) => {
            state.selection = {
                index,
                tile
            };
        });
    }

    function clearSelection(game) {
        mutate(game, (state) => {
            state.selection = { index: null, tile: null };
        });
    }

    function patchView(game, patch) {
        mutate(game, (state) => {
            state.view = {
                ...state.view,
                ...(patch || {})
            };
            state.view.scale = Math.max(0.9, Math.min(2.4, Number(state.view.scale) || 1));
            state.view.x = Math.round(Number(state.view.x) || 0);
            state.view.y = Math.round(Number(state.view.y) || 0);
        });
    }

    function getVeterans(game) {
        const state = ensure(game);
        if (!Array.isArray(state.veterans)) return [];
        return state.veterans.map((entry) => ({
            id: entry.id,
            unitKey: entry.unitKey,
            level: entry.level,
            name: entry.name,
            createdAt: entry.createdAt,
            loadout: {
                itemKey: normalizeVeteranItemKey(entry?.loadout?.itemKey || '', entry?.unitKey || '')
            }
        }));
    }

    function addVeteran(game, payload) {
        let created = null;
        mutate(game, (state) => {
            if (!Array.isArray(state.veterans)) {
                state.veterans = [];
            }
            const unitKey = String(payload?.unitKey || '').trim();
            if (!unitKey) return;
            const id = String(payload?.id || '').trim()
                || `vet_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
            const loadoutItemKey = normalizeVeteranItemKey(
                payload?.loadout?.itemKey || payload?.itemKey || '',
                unitKey
            );
            const entry = normalizeVeteranEntry({
                id,
                unitKey,
                level: Math.max(2, Math.floor(Number(payload?.level) || 2)),
                name: normalizeVeteranName(payload?.name || '', ''),
                createdAt: Math.max(0, Math.floor(Number(payload?.createdAt) || Date.now())),
                loadout: {
                    itemKey: loadoutItemKey
                }
            });
            if (!entry) return;
            const exists = state.veterans.some((item) => item && item.id === entry.id);
            if (exists) return;
            state.veterans.push(entry);
            created = { ...entry };
        });
        return created;
    }

    function setVeteranLoadout(game, veteranId, nextItemKey) {
        const targetId = String(veteranId || '').trim();
        if (!targetId) return false;
        let updated = false;
        mutate(game, (state) => {
            if (!Array.isArray(state.veterans) || state.veterans.length === 0) return;
            const idx = state.veterans.findIndex((entry) => entry && entry.id === targetId);
            if (idx < 0) return;
            const current = state.veterans[idx];
            const unitKey = String(current?.unitKey || '').trim();
            if (!unitKey) return;
            const normalizedItemKey = normalizeVeteranItemKey(nextItemKey, unitKey);
            const currentItemKey = normalizeVeteranItemKey(current?.loadout?.itemKey || '', unitKey);
            if (normalizedItemKey === currentItemKey) return;
            state.veterans[idx] = {
                ...current,
                loadout: {
                    itemKey: normalizedItemKey
                }
            };
            updated = true;
        });
        return updated;
    }

    function renameVeteran(game, veteranId, nextName) {
        const targetId = String(veteranId || '').trim();
        if (!targetId) return false;
        let updated = false;
        mutate(game, (state) => {
            if (!Array.isArray(state.veterans) || state.veterans.length === 0) return;
            const idx = state.veterans.findIndex((entry) => entry && entry.id === targetId);
            if (idx < 0) return;
            const current = state.veterans[idx];
            const fallback = current?.name || '';
            state.veterans[idx] = {
                ...current,
                name: normalizeVeteranName(nextName, fallback)
            };
            updated = true;
        });
        return updated;
    }

    global.CitySimState = {
        DEFAULT_COLS,
        DEFAULT_ROWS,
        DEFAULT_LOOP_MS,
        FACTORY_RESEARCH_KEYS,
        getExpRequiredForLevel,
        createDefaultResources,
        createDefaultUnits,
        normalizeResearchUnlocks,
        createInitialState,
        ensure,
        replace,
        mutate,
        setBuildPanelOpen,
        setInventoryPanelOpen,
        setMissionOpen,
        setBuildTab,
        setSelectedTool,
        setInventoryTab,
        setGridTile,
        getDrillgroundUnit,
        setDrillgroundUnit,
        clearDrillgroundUnit,
        getProductionCooldownUntil,
        getProductionQueue,
        setProductionCooldownUntil,
        setProductionQueue,
        clearProductionQueue,
        clearProductionCooldown,
        setGroundTile,
        setLoopTimer,
        clearLoopTimer,
        setPlacement,
        clearPlacement,
        setSelection,
        clearSelection,
        patchView,
        normalizeVeteranItemKey,
        getVeterans,
        addVeteran,
        renameVeteran,
        setVeteranLoadout
    };
})(window);
