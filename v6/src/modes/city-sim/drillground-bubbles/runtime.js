(function attachCityDrillgroundBubbleRuntime(global) {
    'use strict';

    const RUNTIME_KEY = '__cityDrillgroundBubbleRuntime';
    const DRILLGROUND_TILE_SET = new Set(['drillground', 'drillground_gray']);

    function nowMs() {
        return Date.now();
    }

    function randomInt(minValue, maxValue) {
        const min = Math.floor(Number(minValue) || 0);
        const max = Math.floor(Number(maxValue) || 0);
        if (max <= min) return min;
        return min + Math.floor(Math.random() * (max - min + 1));
    }

    function clampInt(value, fallback, minValue, maxValue) {
        const parsed = Math.floor(Number(value));
        const base = Number.isFinite(parsed) ? parsed : fallback;
        const min = Number.isFinite(minValue) ? minValue : base;
        const max = Number.isFinite(maxValue) ? maxValue : base;
        if (base < min) return min;
        if (base > max) return max;
        return base;
    }

    function normalizeUnitKey(value) {
        const key = String(value || '').trim();
        return key || '';
    }

    function normalizeEventType(value) {
        const key = String(value || '').trim().toLowerCase();
        if (!key) return '';
        if (key === 'normal') return 'normal';
        if (key === 'battle_pre' || key === 'pre' || key === 'battle_before') return 'battle_pre';
        if (key === 'battle_post_victory' || key === 'win' || key === 'victory') return 'battle_post_victory';
        if (key === 'battle_post_defeat' || key === 'lose' || key === 'loss' || key === 'defeat') return 'battle_post_defeat';
        return '';
    }

    function getConfigApi() {
        const api = global.CitySimDrillgroundBubbleConfig;
        return (api && typeof api === 'object') ? api : null;
    }

    function getDefaultOptions() {
        const config = getConfigApi();
        if (config && typeof config.getDefaultOptions === 'function') {
            return config.getDefaultOptions();
        }
        return {
            intervalMs: 120000,
            intervalJitterMs: 24000,
            bubbleDurationMs: 4200,
            minGapMs: 9000,
            eventTtlMs: 12 * 60 * 1000,
            initialDelayMinMs: 7000,
            initialDelayMaxMs: 22000,
            maxQueuedEvents: 8
        };
    }

    function sanitizeOptions(baseInput, patchInput) {
        const base = (baseInput && typeof baseInput === 'object') ? baseInput : getDefaultOptions();
        const patch = (patchInput && typeof patchInput === 'object') ? patchInput : {};
        return {
            intervalMs: clampInt(patch.intervalMs, base.intervalMs, 15000, 20 * 60 * 1000),
            intervalJitterMs: clampInt(patch.intervalJitterMs, base.intervalJitterMs, 0, 10 * 60 * 1000),
            bubbleDurationMs: clampInt(patch.bubbleDurationMs, base.bubbleDurationMs, 1000, 15000),
            minGapMs: clampInt(patch.minGapMs, base.minGapMs, 1000, 5 * 60 * 1000),
            eventTtlMs: clampInt(patch.eventTtlMs, base.eventTtlMs, 10000, 60 * 60 * 1000),
            initialDelayMinMs: clampInt(patch.initialDelayMinMs, base.initialDelayMinMs, 0, 10 * 60 * 1000),
            initialDelayMaxMs: clampInt(patch.initialDelayMaxMs, base.initialDelayMaxMs, 0, 10 * 60 * 1000),
            maxQueuedEvents: clampInt(patch.maxQueuedEvents, base.maxQueuedEvents, 1, 64)
        };
    }

    function isDrillgroundTile(tile) {
        const key = String(tile || '').trim();
        if (!key) return false;
        const checker = global.CitySimConstructionInternals && global.CitySimConstructionInternals.isDrillgroundTile;
        if (typeof checker === 'function') return checker(key) === true;
        return DRILLGROUND_TILE_SET.has(key);
    }

    function getUnitDef(unitKey) {
        const units = global.CONFIG && global.CONFIG.units;
        if (!units || typeof units !== 'object') return null;
        const def = units[unitKey];
        return (def && typeof def === 'object') ? def : null;
    }

    function isInfantryUnit(unitKey) {
        if (!unitKey) return false;
        const def = getUnitDef(unitKey);
        const category = String(def?.category || '').trim().toLowerCase();
        return category === 'infantry';
    }

    function getDialogueLines(type, mode) {
        const config = getConfigApi();
        if (!config || typeof config.getDialogueLines !== 'function') return [];
        return config.getDialogueLines(type, mode);
    }

    function pickRandomLine(lines, lastLine) {
        if (!Array.isArray(lines) || lines.length <= 0) return '';
        if (lines.length === 1) return String(lines[0] || '').trim();
        const valid = lines.filter((line) => String(line || '').trim() !== String(lastLine || '').trim());
        const pool = valid.length > 0 ? valid : lines;
        return String(pool[randomInt(0, pool.length - 1)] || '').trim();
    }

    function pickDialogue(eventType, mode, lastLine) {
        const primary = pickRandomLine(getDialogueLines(eventType, mode), lastLine);
        if (primary) return primary;

        const normal = pickRandomLine(getDialogueLines('normal', mode), lastLine);
        if (normal) return normal;

        const opposite = mode === 'group' ? 'personal' : 'group';
        const fallback = pickRandomLine(getDialogueLines(eventType, opposite), lastLine);
        if (fallback) return fallback;

        return pickRandomLine(getDialogueLines('normal', opposite), lastLine);
    }

    function ensureRuntime(game) {
        if (!game || typeof game !== 'object') return null;
        if (!game[RUNTIME_KEY] || typeof game[RUNTIME_KEY] !== 'object') {
            const defaults = getDefaultOptions();
            game[RUNTIME_KEY] = {
                options: sanitizeOptions(defaults, null),
                initialized: false,
                nextNormalAt: 0,
                nextEligibleAt: 0,
                sequence: 0,
                active: null,
                activeUntil: 0,
                pendingEvents: [],
                lastQueuedType: '',
                lastQueuedAt: 0,
                lastLine: ''
            };
        }
        return game[RUNTIME_KEY];
    }

    function scheduleInitial(runtime, now) {
        const minDelay = Math.max(0, runtime.options.initialDelayMinMs);
        const maxDelay = Math.max(minDelay, runtime.options.initialDelayMaxMs);
        runtime.nextNormalAt = now + randomInt(minDelay, maxDelay);
    }

    function scheduleNextNormal(runtime, now) {
        const jitter = randomInt(-runtime.options.intervalJitterMs, runtime.options.intervalJitterMs);
        runtime.nextNormalAt = now + runtime.options.intervalMs + jitter;
    }

    function init(game, optionsPatch) {
        const runtime = ensureRuntime(game);
        if (!runtime) return false;
        runtime.options = sanitizeOptions(runtime.options, optionsPatch);
        const now = nowMs();
        if (!runtime.initialized) {
            runtime.initialized = true;
            runtime.nextEligibleAt = now;
            scheduleInitial(runtime, now);
        }
        return true;
    }

    function setOptions(game, optionsPatch) {
        const runtime = ensureRuntime(game);
        if (!runtime) return false;
        runtime.options = sanitizeOptions(runtime.options, optionsPatch);
        return true;
    }

    function clear(game) {
        if (!game || typeof game !== 'object') return;
        if (Object.prototype.hasOwnProperty.call(game, RUNTIME_KEY)) {
            delete game[RUNTIME_KEY];
        }
    }

    function collectInfantryEntries(game) {
        if (!global.CitySimState || typeof global.CitySimState.ensure !== 'function') return [];
        const state = global.CitySimState.ensure(game);
        if (!state || !Array.isArray(state.grid)) return [];

        const grid = state.grid;
        const slots = (state.drillgroundSlots && typeof state.drillgroundSlots === 'object') ? state.drillgroundSlots : null;
        if (!slots) return [];
        const counts = (state.drillgroundInfantryCounts && typeof state.drillgroundInfantryCounts === 'object')
            ? state.drillgroundInfantryCounts
            : null;

        const entries = [];
        for (const key of Object.keys(slots)) {
            const index = Math.floor(Number(key));
            if (!Number.isInteger(index) || index < 0 || index >= grid.length) continue;
            if (!isDrillgroundTile(grid[index])) continue;

            const unitKey = normalizeUnitKey(slots[key]);
            if (!unitKey || !isInfantryUnit(unitKey)) continue;

            const infantryCount = clampInt(counts?.[key], 1, 1, 4);
            entries.push({
                anchorIndex: index,
                unitKey,
                infantryCount
            });
        }

        entries.sort((a, b) => a.anchorIndex - b.anchorIndex);
        return entries;
    }

    function chooseEntry(entries, preferGroup) {
        if (!Array.isArray(entries) || entries.length <= 0) return null;
        const groupCandidates = entries.filter((entry) => entry.infantryCount >= 2);
        if (preferGroup && groupCandidates.length > 0) {
            return groupCandidates[randomInt(0, groupCandidates.length - 1)] || null;
        }
        return entries[randomInt(0, entries.length - 1)] || null;
    }

    function spawnBubble(runtime, entry, eventType, now, forceGroupMode) {
        if (!entry) return false;

        const groupContext = entry.infantryCount >= 2;
        const mode = forceGroupMode === true
            ? 'group'
            : ((groupContext && Math.random() < 0.55) ? 'group' : 'personal');
        const text = pickDialogue(eventType, mode, runtime.lastLine);
        if (!text) return false;

        runtime.sequence += 1;
        runtime.lastLine = text;
        runtime.active = {
            token: `${runtime.sequence}:${Math.floor(now / 1000)}`,
            anchorIndex: entry.anchorIndex,
            unitKey: entry.unitKey,
            infantryCount: entry.infantryCount,
            mode,
            eventType,
            text
        };
        runtime.activeUntil = now + runtime.options.bubbleDurationMs;
        runtime.nextEligibleAt = now + runtime.options.minGapMs;
        scheduleNextNormal(runtime, now);
        return true;
    }

    function popPendingEvent(runtime, now) {
        if (!Array.isArray(runtime.pendingEvents) || runtime.pendingEvents.length <= 0) return '';
        while (runtime.pendingEvents.length > 0) {
            const next = runtime.pendingEvents.shift();
            if (!next || typeof next !== 'object') continue;
            if (Number(next.expiresAt) > 0 && now > Number(next.expiresAt)) continue;
            const safeType = normalizeEventType(next.type);
            if (!safeType || safeType === 'normal') continue;
            return safeType;
        }
        return '';
    }

    function tick(game) {
        const runtime = ensureRuntime(game);
        if (!runtime) return false;
        if (!runtime.initialized) init(game);

        const now = nowMs();
        let dirty = false;

        if (runtime.active && now >= runtime.activeUntil) {
            runtime.active = null;
            runtime.activeUntil = 0;
            dirty = true;
        }

        const entries = collectInfantryEntries(game);
        if (entries.length <= 0) {
            if (runtime.active) {
                runtime.active = null;
                runtime.activeUntil = 0;
                dirty = true;
            }
            return dirty;
        }

        if (runtime.active) return dirty;
        if (now < runtime.nextEligibleAt) return dirty;

        const pendingType = popPendingEvent(runtime, now);
        if (pendingType) {
            const groupContext = entries.length >= 2 || entries.some((entry) => entry.infantryCount >= 2);
            const chosen = chooseEntry(entries, groupContext);
            if (spawnBubble(runtime, chosen, pendingType, now, groupContext)) {
                return true;
            }
        }

        if (!Number.isFinite(runtime.nextNormalAt) || runtime.nextNormalAt <= 0) {
            scheduleInitial(runtime, now);
        }

        if (now >= runtime.nextNormalAt) {
            const preferGroup = (entries.length >= 2 || entries.some((entry) => entry.infantryCount >= 2)) && Math.random() < 0.45;
            const chosen = chooseEntry(entries, preferGroup);
            if (spawnBubble(runtime, chosen, 'normal', now, preferGroup)) {
                return true;
            }
            runtime.nextNormalAt = now + Math.max(5000, Math.floor(runtime.options.intervalMs * 0.5));
        }

        return dirty;
    }

    function queueBattleEvent(game, eventType, options) {
        const runtime = ensureRuntime(game);
        if (!runtime) return false;
        if (!runtime.initialized) init(game);

        const safeType = normalizeEventType(eventType);
        if (!safeType || safeType === 'normal') return false;

        const now = nowMs();
        if (runtime.lastQueuedType === safeType && (now - runtime.lastQueuedAt) < 1200) {
            return false;
        }
        runtime.lastQueuedType = safeType;
        runtime.lastQueuedAt = now;

        runtime.pendingEvents.push({
            type: safeType,
            queuedAt: now,
            expiresAt: now + runtime.options.eventTtlMs
        });

        while (runtime.pendingEvents.length > runtime.options.maxQueuedEvents) {
            runtime.pendingEvents.shift();
        }

        if (options && options.immediate === true) {
            runtime.nextEligibleAt = Math.min(runtime.nextEligibleAt || now, now);
        }
        return true;
    }

    function matchActiveSlot(active, payload) {
        if (!active || !payload || typeof payload !== 'object') return false;
        const anchorIndex = Math.floor(Number(payload.anchorIndex));
        if (!Number.isInteger(anchorIndex) || anchorIndex < 0) return false;
        if (anchorIndex !== active.anchorIndex) return false;

        const unitKey = normalizeUnitKey(payload.unitKey);
        if (unitKey && active.unitKey && unitKey !== active.unitKey) return false;
        return true;
    }

    function getRenderToken(game, payload) {
        const runtime = game && typeof game === 'object' ? game[RUNTIME_KEY] : null;
        if (!runtime || !runtime.active) return '';
        const now = nowMs();
        if (now >= runtime.activeUntil) {
            runtime.active = null;
            runtime.activeUntil = 0;
            return '';
        }
        if (!matchActiveSlot(runtime.active, payload)) return '';
        return String(runtime.active.token || '');
    }

    function getBubblePayload(game, payload) {
        const runtime = game && typeof game === 'object' ? game[RUNTIME_KEY] : null;
        if (!runtime || !runtime.active) return null;
        const now = nowMs();
        if (now >= runtime.activeUntil) {
            runtime.active = null;
            runtime.activeUntil = 0;
            return null;
        }
        if (!matchActiveSlot(runtime.active, payload)) return null;
        return {
            token: String(runtime.active.token || ''),
            text: String(runtime.active.text || ''),
            mode: String(runtime.active.mode || 'personal'),
            eventType: String(runtime.active.eventType || 'normal')
        };
    }

    global.CitySimDrillgroundBubbleRuntime = {
        init,
        setOptions,
        clear,
        tick,
        queueBattleEvent,
        getRenderToken,
        getBubblePayload,
        normalizeEventType
    };
})(window);
