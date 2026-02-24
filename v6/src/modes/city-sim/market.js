(function (global) {
    'use strict';

    const BASE_PRICE_TABLE = {
        money: 1,
        gold: 300,
        honor: 500,
        population: 120
    };

    // ── Inflation constants ───────────────────────────────────────────────────
    // 6% price increase per city level above 1, capped at 2.5×.
    // 세무소(tax_office) building reduces the inflation premium by 20%.
    var INFLATION_RATE_PER_LEVEL = 0.06;
    var INFLATION_CAP = 2.5;
    var TAX_OFFICE_DISCOUNT = 0.20; // fraction of premium removed

    // ── Internal helpers ─────────────────────────────────────────────────────
    function _getCityState(game) {
        if (!game) return null;
        if (typeof CitySimState !== 'undefined'
            && CitySimState
            && typeof CitySimState.ensure === 'function') {
            return CitySimState.ensure(game);
        }
        return game.citySim || null;
    }

    function _hasTaxOffice(grid) {
        if (!Array.isArray(grid)) return false;
        for (var i = 0; i < grid.length; i++) {
            if (String(grid[i] || '').trim().toLowerCase() === 'tax_office') return true;
        }
        return false;
    }

    // ── Public API ───────────────────────────────────────────────────────────

    /**
     * Returns the current inflation multiplier (>= 1.0).
     * Formula:  1.0 + (level - 1) * INFLATION_RATE_PER_LEVEL,  capped at INFLATION_CAP.
     * 세무소 building: reduces the premium above 1.0 by TAX_OFFICE_DISCOUNT.
     *
     * Examples (no tax_office):
     *   level  1 → 1.00×
     *   level  5 → 1.24×
     *   level 10 → 1.54×
     *   level 15 → 1.84×
     *   level 19 → 2.08×
     */
    function getInflationMultiplier(game) {
        var cityState = _getCityState(game);
        if (!cityState) return 1.0;

        var hud = (cityState.hud && typeof cityState.hud === 'object') ? cityState.hud : {};
        var level = Math.max(1, Math.floor(Number(hud.level) || 1));

        var raw = 1.0 + (level - 1) * INFLATION_RATE_PER_LEVEL;
        var mult = Math.min(INFLATION_CAP, raw);

        if (mult > 1.0 && _hasTaxOffice(cityState.grid)) {
            mult = 1.0 + (mult - 1.0) * (1.0 - TAX_OFFICE_DISCOUNT);
        }

        return mult;
    }

    /**
     * Returns a display-ready info object for the inflation indicator.
     * { mult: 1.24, premiumPct: 24, hasTaxOffice: false, label: '+24%' }
     */
    function getInflationInfo(game) {
        var mult = getInflationMultiplier(game);
        var cityState = _getCityState(game);
        var hasTaxOffice = cityState ? _hasTaxOffice(cityState.grid) : false;
        var premiumPct = Math.round((mult - 1.0) * 100);
        var label = premiumPct > 0 ? '+' + premiumPct + '%' : '기준가';
        return { mult: mult, premiumPct: premiumPct, hasTaxOffice: hasTaxOffice, label: label };
    }

    function openPolicy(game) {
        if (!game || typeof game.openCityActionModal !== 'function') return;
        game.openCityActionModal(
            '\uC815\uCC45',
            '\uC138\uAE08/\uBCF5\uC9C0/\uAD70\uC0AC \uC815\uCC45 \uC218\uCE58\uB294 \uB2E4\uC74C \uB2E8\uACC4\uC5D0\uC11C \uC5F0\uACB0\uB429\uB2C8\uB2E4.'
        );
    }

    function getStockPrice(key, options) {
        var type = String(key || '').trim().toLowerCase();
        var opts = (options && typeof options === 'object') ? options : {};
        var base = Math.max(0, Math.floor(Number(BASE_PRICE_TABLE[type]) || 0));
        if (base <= 0) return 0;
        var modifier = Number.isFinite(Number(opts.modifier))
            ? Math.max(0, Number(opts.modifier))
            : 1;
        return Math.max(0, Math.floor(base * modifier));
    }

    global.CitySimMarket = {
        openPolicy,
        getStockPrice,
        getInflationMultiplier,
        getInflationInfo
    };
})(window);
