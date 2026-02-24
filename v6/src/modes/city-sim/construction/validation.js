// src/modes/city-sim/construction/validation.js
(function attachCityConstructionValidation(global) {
    'use strict';

    const DEFAULT_PER_TILE_MAX = 8;
    const TAX_OFFICE_MAX_OWNED = 1;
    const GLOBAL_BUILD_LIMIT_EXCLUDED_TILES = new Set([
        'road',
        'tree',
        'hq',
        'park',
        'park_plaza',
        'monument'
    ]);

    function getDeps() {
        return (global.CitySimConstructionInternals && typeof global.CitySimConstructionInternals === 'object')
            ? global.CitySimConstructionInternals
            : {};
    }

    function normalizeOwnedObject(state, deps, index, tile) {
        if (!state || !Array.isArray(state.grid)) {
            return { index, tile };
        }
        const normalizeObjectSelection = deps && deps.normalizeObjectSelection;
        if (typeof normalizeObjectSelection !== 'function') {
            return { index, tile };
        }
        const normalized = normalizeObjectSelection(state, index, tile) || {};
        const nextIndex = Number(normalized.index);
        const nextTile = String(normalized.tile || '').trim();
        if (!Number.isInteger(nextIndex) || nextIndex < 0 || nextIndex >= state.grid.length || !nextTile) {
            return { index, tile };
        }
        return { index: nextIndex, tile: nextTile };
    }

    function isCountedBuildingTile(tile) {
        const key = String(tile || '').trim();
        if (!key) return false;
        return !GLOBAL_BUILD_LIMIT_EXCLUDED_TILES.has(key);
    }

    function countOwnedCountedBuildings(state, deps) {
        const isObjectTool = deps && deps.isObjectTool;
        if (!state || !Array.isArray(state.grid) || typeof isObjectTool !== 'function') {
            return { total: 0, taxOffice: 0, counts: {} };
        }

        const seen = new Set();
        let total = 0;
        let taxOffice = 0;
        const counts = Object.create(null);

        for (let i = 0; i < state.grid.length; i++) {
            const rawTile = state.grid[i] ?? null;
            if (!rawTile || !isObjectTool(rawTile)) continue;

            const normalized = normalizeOwnedObject(state, deps, i, rawTile);
            const normalizedTile = String(normalized.tile || '').trim();
            const key = `${normalized.index}:${normalizedTile}`;
            if (!normalizedTile || seen.has(key)) continue;
            seen.add(key);

            if (!isCountedBuildingTile(normalizedTile)) continue;

            total += 1;
            counts[normalizedTile] = (counts[normalizedTile] || 0) + 1;
            if (normalizedTile === 'tax_office') {
                taxOffice += 1;
            }
        }

        return { total, taxOffice, counts };
    }

    function isMapInputLocked(game, options) {
        const deps = getDeps();
        const CitySimState = global.CitySimState;
        if (!CitySimState || typeof CitySimState.ensure !== 'function') return false;

        const opts = options || {};
        const state = CitySimState.ensure(game);
        const allowBuildPlacement = opts.allowBuildPlacement === true;
        const modal = document.getElementById('city-action-modal');
        const modalOpen = !!(modal && modal.classList.contains('active'));
        if (modalOpen) return true;
        if (state.inventoryPanelOpen === true) return true;
        if (state.missionOpen === true) return true;
        if (state.buildPanelOpen === true && !allowBuildPlacement) return true;

        // keep room for future validators to hook in
        if (deps && typeof deps.isMapInputLockedExtra === 'function') {
            return !!deps.isMapInputLockedExtra(game, options, state);
        }
        return false;
    }

    function evaluatePlacement(game, index, placement) {
        const deps = getDeps();
        const CitySimState = global.CitySimState;
        const CitySimEconomy = global.CitySimEconomy;

        if (!CitySimState || typeof CitySimState.ensure !== 'function') {
            return { ok: false, reason: '상태 시스템을 불러오지 못했습니다.' };
        }

        const state = CitySimState.ensure(game);
        const p = placement || state.placement;
        const BUILDING_DEFS = deps.BUILDING_DEFS || {};

        if (!p || !p.active) {
            return { ok: false, reason: '배치 모드가 활성화되어 있지 않습니다.' };
        }

        if (!Number.isInteger(index) || index < 0 || index >= state.grid.length) {
            return { ok: false, reason: '유효하지 않은 타일입니다.' };
        }

        const tool = p.tool || state.selectedTool;
        if (!BUILDING_DEFS[tool]) {
            return { ok: false, reason: '도구를 먼저 선택하세요.' };
        }
        if (tool === 'hq') {
            return { ok: false, reason: '총사령부는 건설할 수 없습니다.' };
        }

        if (tool === 'ground_grass') return { ok: true, reason: '잔디 변경 가능' };
        if (tool === 'ground_dirt') return { ok: true, reason: '흙 타일 변경 가능' };
        if (tool === 'ground_concrete') return { ok: true, reason: '회색 타일 변경 가능' };
        if (tool === 'ground_asphalt') return { ok: true, reason: '아스팔트 타일 변경 가능' };
        if (tool === 'eraser') return { ok: true, reason: '오브젝트 제거 가능' };

        const isFootprintTool = deps.isFootprintTool;
        const getFootprintAtAnchor = deps.getFootprintAtAnchor;
        const getFootprintRequirementMessage = deps.getFootprintRequirementMessage;
        const isObjectTool = deps.isObjectTool;

        if (typeof isFootprintTool !== 'function'
            || typeof getFootprintAtAnchor !== 'function'
            || typeof getFootprintRequirementMessage !== 'function'
            || typeof isObjectTool !== 'function') {
            return { ok: false, reason: '배치 검증 헬퍼를 불러오지 못했습니다.' };
        }

        if (isFootprintTool(tool)) {
            const footprint = getFootprintAtAnchor(state, index, tool, true);
            if (!Array.isArray(footprint) || footprint.length === 0) {
                return { ok: false, reason: getFootprintRequirementMessage(tool) };
            }
            for (let i = 0; i < footprint.length; i++) {
                const entry = footprint[i];
                const currentTile = state.grid[entry.index] ?? null;
                if (currentTile && currentTile !== entry.tile) {
                    return { ok: false, reason: '다른 오브젝트와 겹칠 수 없습니다.' };
                }
            }
        } else {
            const current = state.grid[index] ?? null;
            if (tool === 'road' && current === 'tree') {
                return { ok: false, reason: '나무와 도로는 같은 칸에 배치할 수 없습니다.' };
            }
            if (tool === 'tree' && current === 'road') {
                return { ok: false, reason: '도로와 나무는 같은 칸에 배치할 수 없습니다.' };
            }
            if (current && current !== tool) {
                return { ok: false, reason: '다른 오브젝트와 겹칠 수 없습니다.' };
            }
        }

        const shouldChargeBuildPlacementCost = deps.shouldChargeBuildPlacementCost;
        const getBuildToolCostMoney = deps.getBuildToolCostMoney;
        const formatNumber = deps.formatNumber;
        if (typeof shouldChargeBuildPlacementCost !== 'function'
            || typeof getBuildToolCostMoney !== 'function'
            || typeof formatNumber !== 'function') {
            return { ok: false, reason: '비용 계산 헬퍼를 불러오지 못했습니다.' };
        }

        const shouldCharge = shouldChargeBuildPlacementCost(state, index, tool);
        if (shouldCharge && isObjectTool(tool) && isCountedBuildingTile(tool)) {
            const owned = countOwnedCountedBuildings(state, deps);
            if (tool === 'tax_office' && owned.taxOffice >= TAX_OFFICE_MAX_OWNED) {
                return { ok: false, reason: '세무소는 1개만 건설할 수 있습니다.' };
            }

            const maxOwnedMeta = BUILDING_DEFS[tool] && BUILDING_DEFS[tool].maxOwned;
            const maxAllowed = Number.isFinite(Number(maxOwnedMeta)) ? Math.max(0, Math.floor(Number(maxOwnedMeta))) : DEFAULT_PER_TILE_MAX;
            const currentCount = (owned.counts && owned.counts[tool]) ? owned.counts[tool] : 0;
            if (currentCount >= maxAllowed) {
                return { ok: false, reason: `${BUILDING_DEFS[tool]?.name || tool}은(는) 최대 ${maxAllowed}개까지 건설할 수 있습니다.` };
            }
        }

        const costMoney = getBuildToolCostMoney(tool);
        if (shouldCharge && costMoney > 0) {
            if (!CitySimEconomy || typeof CitySimEconomy.canPayCost !== 'function' || !CitySimEconomy.canPayCost(game, { costMoney })) {
                return { ok: false, reason: `자금이 부족합니다. (필요: ${formatNumber(costMoney)})` };
            }
        }

        return { ok: true, reason: '배치 가능합니다.' };
    }

    function evaluateMovePlacement(game, index, placement) {
        const deps = getDeps();
        const CitySimState = global.CitySimState;
        const CitySimEconomy = global.CitySimEconomy;
        const isDrillgroundTile = (typeof deps.isDrillgroundTile === 'function')
            ? deps.isDrillgroundTile
            : ((tile) => {
                const key = String(tile || '').trim();
                return key === 'drillground' || key === 'drillground_gray';
            });

        if (!CitySimState || typeof CitySimState.ensure !== 'function') {
            return { ok: false, reason: '상태 시스템을 불러오지 못했습니다.' };
        }

        const state = CitySimState.ensure(game);
        const p = placement || state.placement;
        if (!p || !p.active || p.mode !== 'move') {
            return { ok: false, reason: '이동 모드가 활성화되어 있지 않습니다.' };
        }

        const getMoveSourceInfo = deps.getMoveSourceInfo;
        const isFootprintTool = deps.isFootprintTool;
        const isFootprintTile = deps.isFootprintTile;
        const getFootprintAtAnchor = deps.getFootprintAtAnchor;
        const getFootprintRequirementMessage = deps.getFootprintRequirementMessage;
        const getDrillgroundUnitAt = deps.getDrillgroundUnitAt;
        const canPlaceDrillgroundUnitAtAnchor = deps.canPlaceDrillgroundUnitAtAnchor;
        const formatNumber = deps.formatNumber;
        const MOVE_COST_MONEY = Math.max(0, Math.floor(Number(deps.MOVE_COST_MONEY) || 0));

        if (typeof getMoveSourceInfo !== 'function'
            || typeof isFootprintTool !== 'function'
            || typeof isFootprintTile !== 'function'
            || typeof getFootprintAtAnchor !== 'function'
            || typeof getFootprintRequirementMessage !== 'function'
            || typeof formatNumber !== 'function') {
            return { ok: false, reason: '이동 검증 헬퍼를 불러오지 못했습니다.' };
        }

        const source = getMoveSourceInfo(state, p);
        if (!source) {
            return { ok: false, reason: '이동할 건물을 찾을 수 없습니다.' };
        }

        if (!Number.isInteger(index) || index < 0 || index >= state.grid.length) {
            return { ok: false, reason: '유효하지 않은 타일입니다.' };
        }

        if (index === source.index) {
            return { ok: false, reason: '원래 위치입니다.' };
        }

        if (MOVE_COST_MONEY > 0) {
            if (!CitySimEconomy
                || typeof CitySimEconomy.canPayCost !== 'function'
                || !CitySimEconomy.canPayCost(game, { costMoney: MOVE_COST_MONEY })) {
                return { ok: false, reason: `자금이 부족합니다. (필요: ${formatNumber(MOVE_COST_MONEY)})` };
            }
        }

        if (isFootprintTool(source.tile)) {
            const sourceFootprint = getFootprintAtAnchor(state, source.index, source.tile, false);
            if (!Array.isArray(sourceFootprint) || sourceFootprint.length === 0) {
                return { ok: false, reason: `${source.def?.name || source.tile} 원본 형태를 확인할 수 없습니다.` };
            }
            const sourceIndexSet = new Set(sourceFootprint.map((entry) => entry.index));
            const targetFootprint = getFootprintAtAnchor(state, index, source.tile, true);
            if (!Array.isArray(targetFootprint) || targetFootprint.length === 0) {
                return { ok: false, reason: getFootprintRequirementMessage(source.tile) };
            }
            for (let i = 0; i < targetFootprint.length; i++) {
                const entry = targetFootprint[i];
                const currentTile = state.grid[entry.index] ?? null;
                if (!currentTile) continue;
                if (sourceIndexSet.has(entry.index)) continue;
                return { ok: false, reason: '다른 오브젝트와 겹칠 수 없습니다.' };
            }
            if (MOVE_COST_MONEY > 0) {
                return { ok: true, reason: `이동 가능 · 비용 ${formatNumber(MOVE_COST_MONEY)}` };
            }
            return { ok: true, reason: '이동 가능 · 비용 없음' };
        }

        const currentTile = state.grid[index] ?? null;
        if (currentTile && index !== source.index) {
            return { ok: false, reason: '다른 오브젝트와 겹칠 수 없습니다.' };
        }

        if (isFootprintTile(currentTile) && index !== source.index) {
            return { ok: false, reason: '다른 오브젝트와 겹칠 수 없습니다.' };
        }

        if (
            isDrillgroundTile(source.tile)
            && typeof getDrillgroundUnitAt === 'function'
            && typeof canPlaceDrillgroundUnitAtAnchor === 'function'
        ) {
            const drillgroundUnitKey = getDrillgroundUnitAt(state, source.index);
            if (drillgroundUnitKey) {
                const simulatedGrid = Array.isArray(state.grid) ? state.grid.slice() : [];
                simulatedGrid[source.index] = null;
                simulatedGrid[index] = source.tile;

                const simulatedSlots = {};
                if (state.drillgroundSlots && typeof state.drillgroundSlots === 'object') {
                    Object.keys(state.drillgroundSlots).forEach((rawIndex) => {
                        simulatedSlots[rawIndex] = state.drillgroundSlots[rawIndex];
                    });
                }
                delete simulatedSlots[source.index];

                const simulatedState = Object.assign({}, state, {
                    grid: simulatedGrid,
                    drillgroundSlots: simulatedSlots
                });
                const drillgroundMoveCheck = canPlaceDrillgroundUnitAtAnchor(
                    simulatedState,
                    index,
                    drillgroundUnitKey
                );
                if (!drillgroundMoveCheck || drillgroundMoveCheck.ok !== true) {
                    return {
                        ok: false,
                        reason: String(drillgroundMoveCheck?.reason || '해당 위치에는 연병장 유닛을 이동할 수 없습니다.')
                    };
                }
            }
        }

        if (MOVE_COST_MONEY > 0) {
            return { ok: true, reason: `이동 가능 · 비용 ${formatNumber(MOVE_COST_MONEY)}` };
        }
        return { ok: true, reason: '이동 가능 · 비용 없음' };
    }

    const validationApi = {
        isMapInputLocked,
        evaluatePlacement,
        evaluateMovePlacement
    };

    global.CitySimConstructionValidation = validationApi;

    const api = global.CitySimConstruction;
    if (api && typeof api === 'object') {
        Object.assign(api, {
            isMapInputLocked,
            evaluatePlacement,
            evaluateMovePlacement
        });
    }
})(window);
