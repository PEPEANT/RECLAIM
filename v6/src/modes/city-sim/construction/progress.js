// src/modes/city-sim/construction/progress.js
(function attachCityConstructionProgress(global) {
    'use strict';

    function getDeps() {
        return (global.CitySimConstructionInternals && typeof global.CitySimConstructionInternals === 'object')
            ? global.CitySimConstructionInternals
            : {};
    }

    function syncReadyKeyCache(game, readySet) {
        if (!game || typeof game !== 'object') return { changed: false };

        const prev = Array.isArray(game._cityProductionReadyKeys)
            ? game._cityProductionReadyKeys
            : [];
        const prevSet = new Set(prev);

        let changed = false;
        readySet.forEach((key) => {
            if (!prevSet.has(key)) changed = true;
        });
        if (!changed) {
            prevSet.forEach((key) => {
                if (!readySet.has(key)) changed = true;
            });
        }

        game._cityProductionReadyKeys = Array.from(readySet);
        return { changed };
    }

    function tickProductionCooldowns(game) {
        const deps = getDeps();
        const CitySimState = global.CitySimState;
        if (!CitySimState || typeof CitySimState.ensure !== 'function') return;

        const state = CitySimState.ensure(game);
        const cooldowns = (state.productionCooldowns && typeof state.productionCooldowns === 'object')
            ? state.productionCooldowns
            : null;
        if (!cooldowns) return;

        const now = Date.now();
        const readySet = new Set();
        let cleaned = false;
        let hasLiveCooldown = false;

        Object.keys(cooldowns).forEach((rawIndex) => {
            const index = Number(rawIndex);
            if (!Number.isInteger(index) || index < 0 || index >= state.grid.length) {
                if (Object.prototype.hasOwnProperty.call(cooldowns, rawIndex)) {
                    delete cooldowns[rawIndex];
                    cleaned = true;
                }
                return;
            }

            const queue = (typeof deps.getProductionQueueAt === 'function')
                ? deps.getProductionQueueAt(state, index)
                : null;
            if (!queue) {
                if (typeof CitySimState.clearProductionQueue === 'function') {
                    CitySimState.clearProductionQueue(game, index);
                    cleaned = true;
                }
                return;
            }

            const tile = state.grid[index] ?? null;
            const canProduce = !!(tile
                && typeof deps.getProductionCatalog === 'function'
                && deps.getProductionCatalog(tile));
            if (!canProduce) {
                if (typeof CitySimState.clearProductionQueue === 'function') {
                    CitySimState.clearProductionQueue(game, index);
                    cleaned = true;
                }
                return;
            }

            if (Number(queue.until) <= now) {
                const readyKey = `${index}:${String(queue.unitKey || '')}:${Math.floor(Number(queue.until) || 0)}`;
                readySet.add(readyKey);
            } else {
                hasLiveCooldown = true;
            }
        });

        const readyDiff = syncReadyKeyCache(game, readySet);
        const needsRefresh = cleaned || readyDiff.changed;

        if (hasLiveCooldown && typeof deps.ensureProductionCountdownTicker === 'function') {
            deps.ensureProductionCountdownTicker(game);
        }

        if (cleaned && typeof deps.persist === 'function') {
            deps.persist(game);
        }

        if (needsRefresh) {
            if (typeof deps.renderGrid === 'function') {
                deps.renderGrid(game);
            }
            if (global.CitySimConstructionRender
                && typeof global.CitySimConstructionRender.renderContextBar === 'function') {
                global.CitySimConstructionRender.renderContextBar(game);
            }
        }
    }

    const progressApi = {
        tickProductionCooldowns
    };

    global.CitySimConstructionProgress = progressApi;

    const api = global.CitySimConstruction;
    if (api && typeof api === 'object') {
        Object.assign(api, progressApi);
    }
})(window);
