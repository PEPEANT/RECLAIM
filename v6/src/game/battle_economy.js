(function (global) {
    'use strict';

    function toNonNegativeNumber(value) {
        const n = Number(value);
        if (!Number.isFinite(n)) return 0;
        return Math.max(0, n);
    }

    function toNonNegativeInt(value) {
        return Math.max(0, Math.floor(toNonNegativeNumber(value)));
    }

    function syncStockPolicy(game) {
        if (!game || typeof CONFIG === 'undefined' || !CONFIG || !CONFIG.units) {
            return { initialized: false, affected: [] };
        }

        if (!game.playerStock || typeof game.playerStock !== 'object') {
            game.playerStock = {};
        }

        const affected = [];
        Object.keys(CONFIG.units).forEach((key) => {
            const unit = CONFIG.units[key];
            if (!unit || unit.isSkill === true || unit.disabled === true) return;

            const current = toNonNegativeInt(game.playerStock[key]);
            if (current !== game.playerStock[key]) {
                game.playerStock[key] = current;
                affected.push(key);
            }
        });

        return { initialized: true, affected };
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
        syncStockPolicy,
        canSpend,
        spend,
        refund,
        regenerate,
        canSpendSupply: canSpend,
        spendSupply: spend,
        refundSupply: refund
    };
})(window);