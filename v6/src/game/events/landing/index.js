(function (global) {
    'use strict';

    function resolveLandingRuleConfig(game) {
        const mapApi = (typeof Maps !== 'undefined' && Maps)
            ? Maps
            : ((typeof window !== 'undefined' && window.Maps) ? window.Maps : null);
        if (!mapApi || typeof mapApi.getRule !== 'function') return null;
        const raw = mapApi.getRule('landingIntro');
        if (!raw || typeof raw !== 'object') return null;
        return raw;
    }

    function createForGame(game) {
        if (!game || typeof game !== 'object') return null;
        const currentMap = String(game.currentMapId || '').trim();
        if (currentMap !== 'skirmish_coast') return null;

        const controllerApi = global.LandingIntroController;
        if (!controllerApi || typeof controllerApi.createLandingIntroController !== 'function') {
            return null;
        }

        const mapConfig = resolveLandingRuleConfig(game);
        if (mapConfig && mapConfig.enabled === false) return null;
        try {
            return controllerApi.createLandingIntroController(game, mapConfig || {
                enabled: true,
                initialCrafts: 3
            });
        } catch (err) {
            if (typeof console !== 'undefined' && console && typeof console.warn === 'function') {
                console.warn('[LandingIntro] createForGame failed:', err);
            }
            return null;
        }
    }

    global.LandingIntroEvent = {
        createForGame
    };
})(typeof window !== 'undefined' ? window : globalThis);
