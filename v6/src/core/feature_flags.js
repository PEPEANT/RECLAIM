// Runtime feature flags for risky gameplay changes.
(function attachFeatureFlags(globalScope) {
    'use strict';

    const STORAGE_KEY = 'RECLAIM_FEATURE_FLAGS_V2';

    const DEFAULTS = Object.freeze({
        airFormation: true,
        airCrashV2: true,
        infantryAccuracyV2: true,
        corpseRenderV2Only: true,
        icbmTeamColorFix: true,
        // Phase 1 safety switches (default off; no gameplay change until explicitly enabled)
        infantrySuppressionV1: false,
        squadTacticsV1: false,
        reconIntelV2: false
    });

    let state = { ...DEFAULTS };

    function normalizeBoolean(raw, fallback) {
        if (typeof raw === 'boolean') return raw;
        if (typeof raw === 'number') return raw !== 0;
        if (typeof raw === 'string') {
            const s = raw.trim().toLowerCase();
            if (s === '1' || s === 'true' || s === 'on' || s === 'yes' || s === 'y') return true;
            if (s === '0' || s === 'false' || s === 'off' || s === 'no' || s === 'n') return false;
        }
        return !!fallback;
    }

    function sanitize(input) {
        const safe = { ...DEFAULTS };
        if (!input || typeof input !== 'object') return safe;
        Object.keys(DEFAULTS).forEach((key) => {
            safe[key] = normalizeBoolean(input[key], DEFAULTS[key]);
        });
        return safe;
    }

    function cloneState() {
        return { ...state };
    }

    function hasKey(key) {
        return Object.prototype.hasOwnProperty.call(DEFAULTS, key);
    }

    function applyRuntime() {
        // Keep direct plain-object access available for hot paths.
        globalScope.RECLAIM_FEATURE_FLAGS = state;
    }

    function save() {
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
            return true;
        } catch (_) {
            return false;
        }
    }

    function load() {
        try {
            const raw = localStorage.getItem(STORAGE_KEY);
            if (!raw) {
                state = { ...DEFAULTS };
                applyRuntime();
                return cloneState();
            }
            state = sanitize(JSON.parse(raw));
        } catch (_) {
            state = { ...DEFAULTS };
        }
        applyRuntime();
        return cloneState();
    }

    function set(key, enabled, persist = true) {
        const safeKey = String(key || '').trim();
        if (!hasKey(safeKey)) return cloneState();
        state = {
            ...state,
            [safeKey]: normalizeBoolean(enabled, DEFAULTS[safeKey])
        };
        applyRuntime();
        if (persist) save();
        return cloneState();
    }

    function setMany(values, persist = true) {
        state = sanitize({
            ...state,
            ...(values && typeof values === 'object' ? values : {})
        });
        applyRuntime();
        if (persist) save();
        return cloneState();
    }

    function reset(persist = true) {
        state = { ...DEFAULTS };
        applyRuntime();
        if (persist) save();
        return cloneState();
    }

    function isEnabled(key) {
        const safeKey = String(key || '').trim();
        return hasKey(safeKey) ? !!state[safeKey] : false;
    }

    function parseUrlOverrides() {
        if (typeof location === 'undefined' || !location.search) return null;
        const q = new URLSearchParams(location.search);
        const raw = q.get('ff');
        if (!raw) return null;

        const patch = {};
        const parts = raw.split(',');
        for (let i = 0; i < parts.length; i++) {
            const token = String(parts[i] || '').trim();
            if (!token) continue;
            const pair = token.split(':');
            const key = String(pair[0] || '').trim();
            if (!hasKey(key)) continue;
            const valueRaw = (pair.length > 1) ? pair[1] : '1';
            patch[key] = normalizeBoolean(valueRaw, DEFAULTS[key]);
        }
        return patch;
    }

    function applyUrlOverrides() {
        const patch = parseUrlOverrides();
        if (!patch) return cloneState();
        // URL override is runtime-only by default.
        return setMany(patch, false);
    }

    globalScope.FeatureFlags = {
        STORAGE_KEY,
        DEFAULTS: { ...DEFAULTS },
        load,
        save,
        reset,
        set,
        setMany,
        isEnabled,
        getAll: cloneState,
        applyUrlOverrides
    };

    load();
    applyUrlOverrides();
})(typeof window !== 'undefined' ? window : globalThis);
