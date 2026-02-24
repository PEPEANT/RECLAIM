// Shared color palettes for Unit Render V2.
(function attachUnitRenderV2Palettes(globalScope) {
    'use strict';

    const fallbackPlayer = '#8b7a5a';
    const fallbackEnemy = '#6b8e23';
    const fallbackNeutral = '#94a3b8';
    const tc = globalScope.TeamColors;
    const pick = (team, fallback) => {
        if (tc && typeof tc.get === 'function') return tc.get(team, 'primary');
        return fallback;
    };

    globalScope.UnitRenderV2Palettes = {
        team: {
            player: pick('player', fallbackPlayer),
            enemy: pick('enemy', fallbackEnemy),
            neutral: pick('neutral', fallbackNeutral)
        }
    };
})(typeof window !== 'undefined' ? window : globalThis);
