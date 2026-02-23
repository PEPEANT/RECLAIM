// Team faction/runtime color utility.
(function attachTeamColors(globalScope) {
    'use strict';

    const STORAGE_KEY = 'RECLAIM_TEAM_COLORS_V2';

    const FACTIONS = Object.freeze({
        usa: Object.freeze({
            id: 'usa',
            name: 'US 미군',
            player: '#3b82f6',
            enemy: '#6b8e23'
        }),
        russia: Object.freeze({
            id: 'russia',
            name: 'RS 러시아',
            player: '#6b8e23',
            enemy: '#3b82f6'
        })
    });

    const DEFAULTS = Object.freeze({
        player: FACTIONS.usa.player,
        enemy: FACTIONS.usa.enemy,
        neutral: '#94a3b8'
    });

    let state = {
        faction: null,
        player: DEFAULTS.player,
        enemy: DEFAULTS.enemy,
        neutral: DEFAULTS.neutral
    };

    function clampByte(v) {
        const n = Number(v);
        if (!Number.isFinite(n)) return 0;
        return Math.max(0, Math.min(255, Math.round(n)));
    }

    function normalizeHex(raw, fallback) {
        const s = String(raw || '').trim();
        if (/^#[0-9a-fA-F]{6}$/.test(s)) return s.toLowerCase();
        if (/^#[0-9a-fA-F]{3}$/.test(s)) {
            const r = s[1], g = s[2], b = s[3];
            return `#${r}${r}${g}${g}${b}${b}`.toLowerCase();
        }
        return String(fallback || DEFAULTS.player).toLowerCase();
    }

    function hexToRgb(hex) {
        const safe = normalizeHex(hex, '#000000');
        return {
            r: parseInt(safe.slice(1, 3), 16),
            g: parseInt(safe.slice(3, 5), 16),
            b: parseInt(safe.slice(5, 7), 16)
        };
    }

    function rgbToHex(r, g, b) {
        const rr = clampByte(r).toString(16).padStart(2, '0');
        const gg = clampByte(g).toString(16).padStart(2, '0');
        const bb = clampByte(b).toString(16).padStart(2, '0');
        return `#${rr}${gg}${bb}`;
    }

    function shiftHex(hex, delta) {
        const rgb = hexToRgb(hex);
        return rgbToHex(rgb.r + delta, rgb.g + delta, rgb.b + delta);
    }

    function inferFaction(playerHex, enemyHex) {
        const p = normalizeHex(playerHex, DEFAULTS.player);
        const e = normalizeHex(enemyHex, DEFAULTS.enemy);
        if (p === FACTIONS.usa.player && e === FACTIONS.usa.enemy) return 'usa';
        if (p === FACTIONS.russia.player && e === FACTIONS.russia.enemy) return 'russia';
        return null;
    }

    function applyRuntime() {
        const root = (typeof document !== 'undefined') ? document.documentElement : null;
        if (root && root.style) {
            root.style.setProperty('--team-player-color', state.player);
            root.style.setProperty('--team-enemy-color', state.enemy);
            root.style.setProperty('--team-neutral-color', state.neutral);
        }

        if (globalScope.UnitRenderV2Palettes && globalScope.UnitRenderV2Palettes.team) {
            globalScope.UnitRenderV2Palettes.team.player = state.player;
            globalScope.UnitRenderV2Palettes.team.enemy = state.enemy;
            globalScope.UnitRenderV2Palettes.team.neutral = state.neutral;
        }
    }

    function load() {
        try {
            const raw = localStorage.getItem(STORAGE_KEY);
            if (!raw) {
                state = {
                    faction: null,
                    player: DEFAULTS.player,
                    enemy: DEFAULTS.enemy,
                    neutral: DEFAULTS.neutral
                };
                applyRuntime();
                return { ...state };
            }

            const parsed = JSON.parse(raw);
            if (!parsed || typeof parsed !== 'object') {
                state = {
                    faction: null,
                    player: DEFAULTS.player,
                    enemy: DEFAULTS.enemy,
                    neutral: DEFAULTS.neutral
                };
                applyRuntime();
                return { ...state };
            }

            const factionId = String(parsed.faction || '').trim().toLowerCase();
            if (Object.prototype.hasOwnProperty.call(FACTIONS, factionId)) {
                const f = FACTIONS[factionId];
                state = {
                    faction: f.id,
                    player: f.player,
                    enemy: f.enemy,
                    neutral: DEFAULTS.neutral
                };
                applyRuntime();
                return { ...state };
            }

            const player = normalizeHex(parsed.player, DEFAULTS.player);
            const enemy = normalizeHex(parsed.enemy, DEFAULTS.enemy);
            state = {
                faction: inferFaction(player, enemy),
                player,
                enemy,
                neutral: DEFAULTS.neutral
            };
            applyRuntime();
            return { ...state };
        } catch (_) {
            state = {
                faction: null,
                player: DEFAULTS.player,
                enemy: DEFAULTS.enemy,
                neutral: DEFAULTS.neutral
            };
            applyRuntime();
            return { ...state };
        }
    }

    function save() {
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify({
                faction: state.faction || inferFaction(state.player, state.enemy),
                player: state.player,
                enemy: state.enemy
            }));
            return true;
        } catch (_) {
            return false;
        }
    }

    function setFaction(factionId, persist = true) {
        const key = String(factionId || '').trim().toLowerCase();
        const f = Object.prototype.hasOwnProperty.call(FACTIONS, key) ? FACTIONS[key] : FACTIONS.usa;
        state = {
            faction: f.id,
            player: f.player,
            enemy: f.enemy,
            neutral: DEFAULTS.neutral
        };
        applyRuntime();
        if (persist) save();
        return { ...state };
    }

    function setColors(next, persist = true) {
        const src = (next && typeof next === 'object') ? next : {};
        const player = normalizeHex(src.player, state.player || DEFAULTS.player);
        const enemy = normalizeHex(src.enemy, state.enemy || DEFAULTS.enemy);
        state = {
            faction: inferFaction(player, enemy),
            player,
            enemy,
            neutral: DEFAULTS.neutral
        };
        applyRuntime();
        if (persist) save();
        return { ...state };
    }

    function get(team, variant = 'primary') {
        const key = String(team || '').trim().toLowerCase();
        const base = (key === 'player')
            ? state.player
            : ((key === 'enemy') ? state.enemy : DEFAULTS.neutral);

        const v = String(variant || 'primary').trim().toLowerCase();
        if (v === 'dark' || v === 'hp') return shiftHex(base, -28);
        if (v === 'light') return shiftHex(base, 22);
        if (v === 'soft') return shiftHex(base, 12);
        return base;
    }

    function hasSelection() {
        try {
            const raw = localStorage.getItem(STORAGE_KEY);
            if (!raw) return false;
            const parsed = JSON.parse(raw);
            const factionId = String(parsed && parsed.faction || '').trim().toLowerCase();
            return Object.prototype.hasOwnProperty.call(FACTIONS, factionId);
        } catch (_) {
            return false;
        }
    }

    function ensure() {
        return load();
    }

    globalScope.TeamColors = {
        STORAGE_KEY,
        DEFAULTS: { ...DEFAULTS },
        ensure,
        load,
        save,
        setColors,
        setFaction,
        get,
        getState: () => ({ ...state }),
        hasSelection,
        getFactions: () => Object.values(FACTIONS).map((f) => ({ ...f }))
    };

    ensure();
})(typeof window !== 'undefined' ? window : globalThis);
