(function (global) {
    'use strict';

    const state = global.__reclaimMapRegistryState || {
        types: Object.create(null),
        rules: Object.create(null),
        maps: Object.create(null)
    };
    global.__reclaimMapRegistryState = state;

    function registerMapDefinition(definition) {
        if (!definition || typeof definition !== 'object') return false;
        const id = String(definition.id || '').trim();
        if (!id) return false;

        const prev = state.maps[id] || { id, theme: {}, rules: {}, hooks: {} };
        const next = {
            id,
            theme: { ...(prev.theme || {}) },
            rules: { ...(prev.rules || {}) },
            hooks: { ...(prev.hooks || {}) }
        };

        if (definition.theme && typeof definition.theme === 'object') {
            next.theme = { ...next.theme, ...definition.theme };
            state.types[id] = { ...next.theme };
        }
        if (definition.rules && typeof definition.rules === 'object') {
            next.rules = { ...next.rules, ...definition.rules };
            state.rules[id] = { ...next.rules };
        }
        if (definition.hooks && typeof definition.hooks === 'object') {
            next.hooks = { ...next.hooks, ...definition.hooks };
        }

        state.maps[id] = next;
        return true;
    }

    function extendMapDefinition(id, patch) {
        const mapId = String(id || '').trim();
        if (!mapId) return false;
        const ext = (patch && typeof patch === 'object') ? patch : {};
        return registerMapDefinition({ id: mapId, ...ext });
    }

    function getDefinitions() {
        return {
            types: { ...state.types },
            rules: { ...state.rules }
        };
    }

    function getMapDefinition(id) {
        const mapId = String(id || '').trim();
        if (!mapId) return null;
        return state.maps[mapId] || null;
    }

    function getMapHook(id, hookName) {
        const map = getMapDefinition(id);
        if (!map || !map.hooks || typeof map.hooks !== 'object') return null;
        const fn = map.hooks[String(hookName || '').trim()];
        return (typeof fn === 'function') ? fn : null;
    }

    function listMapIds() {
        const ids = new Set([
            ...Object.keys(state.maps),
            ...Object.keys(state.types),
            ...Object.keys(state.rules)
        ]);
        return Array.from(ids);
    }

    global.MapRegistry = {
        registerMapDefinition,
        extendMapDefinition,
        getDefinitions,
        getMapDefinition,
        getMapHook,
        listMapIds
    };
})(typeof window !== 'undefined' ? window : globalThis);
