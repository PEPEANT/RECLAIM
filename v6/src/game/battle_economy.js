(function (global) {
    'use strict';

    const FACTORY_REQUIRED_UNIT_KEYS = new Set(['humvee', 'apc', 'mbt', 'aa_tank', 'spg']);
    const AIRPORT_REQUIRED_UNIT_KEYS = new Set(['fighter', 'apache', 'blackhawk', 'chinook', 'bomber']);

    function toNonNegativeNumber(value) {
        const n = Number(value);
        if (!Number.isFinite(n)) return 0;
        return Math.max(0, n);
    }

    function toNonNegativeInt(value) {
        return Math.max(0, Math.floor(toNonNegativeNumber(value)));
    }

    function getCityState(game) {
        if (!game) return null;
        if (typeof CitySimState !== 'undefined'
            && CitySimState
            && typeof CitySimState.ensure === 'function') {
            return CitySimState.ensure(game);
        }
        return game.citySim || null;
    }

    function scanInfrastructureFromGrid(cityState) {
        const grid = Array.isArray(cityState?.grid) ? cityState.grid : [];
        let hasFactory = false;
        let hasAirport = false;

        for (let i = 0; i < grid.length; i += 1) {
            const tile = String(grid[i] || '').trim().toLowerCase();
            if (!tile) continue;
            if (tile === 'factory') hasFactory = true;
            if (tile === 'airport' || tile.startsWith('airport_')) hasAirport = true;
            if (hasFactory && hasAirport) break;
        }

        return { hasFactory, hasAirport };
    }

    function isFactoryRestrictedUnit(unitKey, unitDef) {
        if (!unitDef || unitDef.isSkill === true) return false;
        if (FACTORY_REQUIRED_UNIT_KEYS.has(unitKey)) return true;
        const category = String(unitDef.category || '').trim().toLowerCase();
        const type = String(unitDef.type || '').trim().toLowerCase();
        return category === 'armored' || type === 'mech';
    }

    function isAirportRestrictedUnit(unitKey, unitDef) {
        if (!unitDef || unitDef.isSkill === true) return false;
        if (AIRPORT_REQUIRED_UNIT_KEYS.has(unitKey)) return true;
        const category = String(unitDef.category || '').trim().toLowerCase();
        const type = String(unitDef.type || '').trim().toLowerCase();
        return category === 'air' || type === 'air';
    }

    function syncCityToStock(game) {
        if (!game || typeof CONFIG === 'undefined' || !CONFIG || !CONFIG.units) {
            return { hasFactory: false, hasAirport: false, forcedFactory: [], forcedAirport: [] };
        }
        if (!game.playerStock || typeof game.playerStock !== 'object') {
            game.playerStock = {};
        }

        const cityState = getCityState(game);
        const { hasFactory, hasAirport } = scanInfrastructureFromGrid(cityState);
        const forcedFactory = [];
        const forcedAirport = [];

        Object.keys(CONFIG.units).forEach((key) => {
            const unit = CONFIG.units[key];
            if (!unit || unit.isSkill === true) return;

            if (!hasFactory && isFactoryRestrictedUnit(key, unit)) {
                if (toNonNegativeInt(game.playerStock[key]) > 0) {
                    forcedFactory.push(key);
                }
                game.playerStock[key] = 0;
            }

            if (!hasAirport && isAirportRestrictedUnit(key, unit)) {
                if (toNonNegativeInt(game.playerStock[key]) > 0) {
                    forcedAirport.push(key);
                }
                game.playerStock[key] = 0;
            }
        });

        // Debug trace for city-to-battle stock synchronization.
        try {
            console.warn('[BattleEconomy.syncCityToStock]', {
                hasFactory,
                hasAirport,
                forcedFactory,
                forcedAirport
            });
        } catch (_) { }

        return { hasFactory, hasAirport, forcedFactory, forcedAirport };
    }

    function canSpend(game, cost, options) {
        if (!game) return false;
        const need = toNonNegativeNumber(cost);
        if (toNonNegativeNumber(game.supply) < need) return false;

        const opts = (options && typeof options === 'object') ? options : {};
        const unitKey = String(opts.unitKey || '').trim();
        if (!unitKey || opts.consumeStock === false) return true;

        const stockMap = (opts.stockMap && typeof opts.stockMap === 'object')
            ? opts.stockMap
            : game.playerStock;
        if (!stockMap || typeof stockMap !== 'object') return false;
        return toNonNegativeInt(stockMap[unitKey]) > 0;
    }

    function spend(game, cost, options) {
        if (!canSpend(game, cost, options)) return false;
        const need = toNonNegativeNumber(cost);
        game.supply = toNonNegativeNumber(game.supply) - need;

        const opts = (options && typeof options === 'object') ? options : {};
        const unitKey = String(opts.unitKey || '').trim();
        if (!unitKey || opts.consumeStock === false) return true;

        const stockMap = (opts.stockMap && typeof opts.stockMap === 'object')
            ? opts.stockMap
            : game.playerStock;
        if (!stockMap || typeof stockMap !== 'object') return false;

        const current = toNonNegativeInt(stockMap[unitKey]);
        if (current <= 0) return false;
        stockMap[unitKey] = current - 1;
        return true;
    }

    function refund(game, cost, options) {
        if (!game) return false;
        const gain = toNonNegativeNumber(cost);
        game.supply = toNonNegativeNumber(game.supply) + gain;

        const opts = (options && typeof options === 'object') ? options : {};
        const unitKey = String(opts.unitKey || '').trim();
        if (!unitKey || opts.refundStock !== true) return true;

        const stockMap = (opts.stockMap && typeof opts.stockMap === 'object')
            ? opts.stockMap
            : game.playerStock;
        if (!stockMap || typeof stockMap !== 'object') return false;
        const current = toNonNegativeInt(stockMap[unitKey]);
        stockMap[unitKey] = current + 1;
        return true;
    }

    function regenerate(game) {
        if (!game || typeof CONFIG === 'undefined' || !CONFIG) return;
        const maxSupply = toNonNegativeNumber(CONFIG.maxSupply);
        const playerRate = toNonNegativeNumber(CONFIG.supplyRate);
        if (toNonNegativeNumber(game.supply) < maxSupply) {
            game.supply = toNonNegativeNumber(game.supply) + playerRate;
        }

        const fallbackEnemyRate = toNonNegativeNumber(CONFIG.supplyRate);
        const enemyRate = Number.isFinite(Number(game.enemySupplyRate))
            ? toNonNegativeNumber(game.enemySupplyRate)
            : fallbackEnemyRate;
        if (toNonNegativeNumber(game.enemySupply) < maxSupply) {
            game.enemySupply = toNonNegativeNumber(game.enemySupply) + enemyRate;
        }
    }

    global.BattleEconomy = {
        syncCityToStock,
        canSpend,
        spend,
        refund,
        regenerate,
        canSpendSupply: canSpend,
        spendSupply: spend,
        refundSupply: refund
    };
})(window);
