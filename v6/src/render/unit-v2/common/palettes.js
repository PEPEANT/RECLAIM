// Shared color palettes for Unit Render V2.
(function attachUnitRenderV2Palettes(globalScope) {
    'use strict';

    const fallbackPlayer = '#8b7a5a';
    const fallbackEnemy = '#6b8e23';
    const fallbackNeutral = '#94a3b8';
    const tc = globalScope.TeamColors;

    function normalizeHex(raw, fallback) {
        const source = String(raw || '').trim();
        if (/^#[0-9a-fA-F]{6}$/.test(source)) return source.toLowerCase();
        if (/^#[0-9a-fA-F]{3}$/.test(source)) {
            const r = source[1];
            const g = source[2];
            const b = source[3];
            return `#${r}${r}${g}${g}${b}${b}`.toLowerCase();
        }
        return String(fallback || '').trim().toLowerCase();
    }

    function shouldSwapLegacyPaletteTeam() {
        try {
            if (tc && typeof tc.getState === 'function') {
                const state = tc.getState();
                const faction = String(state && state.faction || '').trim().toLowerCase();
                if (faction === 'usa') return true;
                if (faction === 'russia') return false;
            }

            if (!tc || typeof tc.get !== 'function') return true;
            const player = normalizeHex(tc.get('player', 'primary'), fallbackPlayer);
            const enemy = normalizeHex(tc.get('enemy', 'primary'), fallbackEnemy);
            return player === fallbackPlayer && enemy === fallbackEnemy;
        } catch (_) {
            return true;
        }
    }

    function resolveLegacyTeam(team) {
        let key = String(team || '').trim().toLowerCase();
        if (key === 'ally') key = 'player';
        if (key === 'foe') key = 'enemy';
        if (key !== 'player' && key !== 'enemy') return key;

        if (!shouldSwapLegacyPaletteTeam()) return key;
        return (key === 'player') ? 'enemy' : 'player';
    }

    const pick = (team, fallback) => {
        if (tc && typeof tc.get === 'function') return tc.get(team, 'primary');
        return fallback;
    };

    globalScope.UnitRenderV2Palettes = {
        team: {
            player: pick('player', fallbackPlayer),
            enemy: pick('enemy', fallbackEnemy),
            neutral: pick('neutral', fallbackNeutral)
        },
        resolveLegacyTeam
    };
})(typeof window !== 'undefined' ? window : globalThis);
