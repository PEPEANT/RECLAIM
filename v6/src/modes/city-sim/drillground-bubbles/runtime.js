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
            intervalMs: 8000,
            intervalJitterMs: 1200,
            bubbleDurationMs: 6200,
            minGapMs: 900,
            eventTtlMs: 12 * 60 * 1000,
            initialDelayMinMs: 150,
            initialDelayMaxMs: 500,
            maxQueuedEvents: 16,
            maxConcurrentBubbles: 3,
            lineRepeatWindow: 18,
            eventBurstQueueCount: 6,
            eventBurstMinGapMs: 220,
            eventBurstDurationMs: 7000,
            ambientBattlePreChancePct: 72,
            defaultGroupChancePct: 45,
            battlePreGroupChancePct: 78
        };
    }

    function sanitizeOptions(baseInput, patchInput) {
        const base = (baseInput && typeof baseInput === 'object') ? baseInput : getDefaultOptions();
        const patch = (patchInput && typeof patchInput === 'object') ? patchInput : {};
        return {
            intervalMs: clampInt(patch.intervalMs, base.intervalMs, 3000, 20 * 60 * 1000),
            intervalJitterMs: clampInt(patch.intervalJitterMs, base.intervalJitterMs, 0, 10 * 60 * 1000),
            bubbleDurationMs: clampInt(patch.bubbleDurationMs, base.bubbleDurationMs, 700, 15000),
            minGapMs: clampInt(patch.minGapMs, base.minGapMs, 500, 5 * 60 * 1000),
            eventTtlMs: clampInt(patch.eventTtlMs, base.eventTtlMs, 10000, 60 * 60 * 1000),
            initialDelayMinMs: clampInt(patch.initialDelayMinMs, base.initialDelayMinMs, 0, 10 * 60 * 1000),
            initialDelayMaxMs: clampInt(patch.initialDelayMaxMs, base.initialDelayMaxMs, 0, 10 * 60 * 1000),
            maxQueuedEvents: clampInt(patch.maxQueuedEvents, base.maxQueuedEvents, 1, 64),
            maxConcurrentBubbles: clampInt(patch.maxConcurrentBubbles, base.maxConcurrentBubbles, 1, 8),
            lineRepeatWindow: clampInt(patch.lineRepeatWindow, base.lineRepeatWindow, 1, 120),
            eventBurstQueueCount: clampInt(patch.eventBurstQueueCount, base.eventBurstQueueCount, 1, 32),
            eventBurstMinGapMs: clampInt(patch.eventBurstMinGapMs, base.eventBurstMinGapMs, 60, 2000),
            eventBurstDurationMs: clampInt(patch.eventBurstDurationMs, base.eventBurstDurationMs, 500, 30000),
            ambientBattlePreChancePct: clampInt(patch.ambientBattlePreChancePct, base.ambientBattlePreChancePct, 0, 100),
            defaultGroupChancePct: clampInt(patch.defaultGroupChancePct, base.defaultGroupChancePct, 0, 100),
            battlePreGroupChancePct: clampInt(patch.battlePreGroupChancePct, base.battlePreGroupChancePct, 0, 100)
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

    function pickRandomLine(lines, lastLine, recentSet) {
        if (!Array.isArray(lines) || lines.length <= 0) return '';
        if (lines.length === 1) return String(lines[0] || '').trim();
        const last = String(lastLine || '').trim();
        const recent = (recentSet instanceof Set) ? recentSet : new Set();
        const filtered = lines.filter((line) => {
            const text = String(line || '').trim();
            if (!text) return false;
            if (text === last) return false;
            if (recent.has(text)) return false;
            return true;
        });
        const fallback = lines.filter((line) => String(line || '').trim() !== last);
        const pool = filtered.length > 0 ? filtered : (fallback.length > 0 ? fallback : lines);
        return String(pool[randomInt(0, pool.length - 1)] || '').trim();
    }

    function pickDialogue(eventType, mode, lastLine, recentSet) {
        const primary = pickRandomLine(getDialogueLines(eventType, mode), lastLine, recentSet);
        if (primary) return primary;

        const normal = pickRandomLine(getDialogueLines('normal', mode), lastLine, recentSet);
        if (normal) return normal;

        const opposite = mode === 'group' ? 'personal' : 'group';
        const fallback = pickRandomLine(getDialogueLines(eventType, opposite), lastLine, recentSet);
        if (fallback) return fallback;

        return pickRandomLine(getDialogueLines('normal', opposite), lastLine, recentSet);
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
                activeBubbles: [],
                pendingEvents: [],
                lastQueuedType: '',
                lastQueuedAt: 0,
                lastLine: '',
                recentLines: [],
                burstUntil: 0,
                burstMinGapMs: 0
            };
        } else if (!Array.isArray(game[RUNTIME_KEY].activeBubbles)) {
            const legacyActive = game[RUNTIME_KEY].active;
            const legacyActiveUntil = Number(game[RUNTIME_KEY].activeUntil) || 0;
            game[RUNTIME_KEY].activeBubbles = [];
            if (legacyActive && typeof legacyActive === 'object' && legacyActiveUntil > nowMs()) {
                game[RUNTIME_KEY].activeBubbles.push({
                    ...legacyActive,
                    expiresAt: legacyActiveUntil
                });
            }
            delete game[RUNTIME_KEY].active;
            delete game[RUNTIME_KEY].activeUntil;
        }
        if (!Array.isArray(game[RUNTIME_KEY].recentLines)) game[RUNTIME_KEY].recentLines = [];
        if (!Number.isFinite(Number(game[RUNTIME_KEY].burstUntil))) game[RUNTIME_KEY].burstUntil = 0;
        if (!Number.isFinite(Number(game[RUNTIME_KEY].burstMinGapMs))) game[RUNTIME_KEY].burstMinGapMs = 0;
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

    function pruneExpiredActiveBubbles(runtime, now) {
        if (!runtime || !Array.isArray(runtime.activeBubbles)) return false;
        const before = runtime.activeBubbles.length;
        runtime.activeBubbles = runtime.activeBubbles.filter((bubble) => {
            if (!bubble || typeof bubble !== 'object') return false;
            return Number(bubble.expiresAt) > now;
        });
        return runtime.activeBubbles.length !== before;
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

        const infantryCount = clampInt(entry.infantryCount, 1, 1, 4);
        const groupContext = infantryCount >= 2;
        const defaultGroupChance = clampInt(runtime.options.defaultGroupChancePct, 45, 0, 100) / 100;
        const battlePreGroupChance = clampInt(runtime.options.battlePreGroupChancePct, 78, 0, 100) / 100;
        const groupChanceBase = eventType === 'battle_pre' ? battlePreGroupChance : defaultGroupChance;
        const groupBoost = forceGroupMode === true ? 0.12 : 0;
        const groupChance = Math.max(0, Math.min(1, groupChanceBase + groupBoost));
        const mode = groupContext
            ? ((Math.random() < groupChance) ? 'group' : 'personal')
            : 'personal';
        const recentSet = new Set(Array.isArray(runtime.recentLines) ? runtime.recentLines : []);
        const text = pickDialogue(eventType, mode, runtime.lastLine, recentSet);
        if (!text) return false;
        const speakerIndex = (mode === 'personal')
            ? randomInt(0, Math.max(0, infantryCount - 1))
            : -1;

        runtime.sequence += 1;
        runtime.lastLine = text;
        if (!Array.isArray(runtime.recentLines)) runtime.recentLines = [];
        runtime.recentLines.push(text);
        const repeatWindow = clampInt(runtime.options.lineRepeatWindow, 18, 1, 120);
        while (runtime.recentLines.length > repeatWindow) {
            runtime.recentLines.shift();
        }
        const bubble = {
            token: `${runtime.sequence}:${Math.floor(now / 1000)}`,
            anchorIndex: entry.anchorIndex,
            unitKey: entry.unitKey,
            infantryCount,
            speakerIndex,
            mode,
            eventType,
            text,
            expiresAt: now + runtime.options.bubbleDurationMs
        };
        if (!Array.isArray(runtime.activeBubbles)) runtime.activeBubbles = [];
        runtime.activeBubbles.push(bubble);
        const maxConcurrent = clampInt(runtime.options.maxConcurrentBubbles, 3, 1, 8);
        while (runtime.activeBubbles.length > maxConcurrent) {
            runtime.activeBubbles.shift();
        }
        const burstActive = now < Number(runtime.burstUntil || 0);
        const burstGap = clampInt(runtime.burstMinGapMs, runtime.options.minGapMs, 60, 2000);
        const nextGap = burstActive ? Math.min(runtime.options.minGapMs, burstGap) : runtime.options.minGapMs;
        runtime.nextEligibleAt = now + nextGap;
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
        let dirty = pruneExpiredActiveBubbles(runtime, now);

        const entries = collectInfantryEntries(game);
        if (entries.length <= 0) {
            if (Array.isArray(runtime.activeBubbles) && runtime.activeBubbles.length > 0) {
                runtime.activeBubbles = [];
                dirty = true;
            }
            return dirty;
        }

        if (now < runtime.nextEligibleAt) return dirty;

        const broadGroupContext = entries.length >= 2 || entries.some((entry) => entry.infantryCount >= 2);

        const pendingType = popPendingEvent(runtime, now);
        if (pendingType) {
            const groupContext = broadGroupContext;
            const chosen = chooseEntry(entries, groupContext);
            if (spawnBubble(runtime, chosen, pendingType, now, groupContext)) {
                return true;
            }
        }

        if (!Number.isFinite(runtime.nextNormalAt) || runtime.nextNormalAt <= 0) {
            scheduleInitial(runtime, now);
        }

        if (now >= runtime.nextNormalAt) {
            const preferGroup = broadGroupContext && Math.random() < 0.45;
            const chosen = chooseEntry(entries, preferGroup);
            const ambientBattlePreChance = clampInt(runtime.options.ambientBattlePreChancePct, 72, 0, 100) / 100;
            const ambientEventType = (Math.random() < ambientBattlePreChance) ? 'battle_pre' : 'normal';
            if (spawnBubble(runtime, chosen, ambientEventType, now, preferGroup)) {
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

        const isResultBurst = safeType === 'battle_post_victory' || safeType === 'battle_post_defeat';
        const requestedBurstCount = clampInt(options?.burstCount, runtime.options.eventBurstQueueCount, 1, 32);
        const burstCount = isResultBurst ? requestedBurstCount : 1;

        for (let i = 0; i < burstCount; i++) {
            runtime.pendingEvents.push({
                type: safeType,
                queuedAt: now,
                expiresAt: now + runtime.options.eventTtlMs
            });
        }

        while (runtime.pendingEvents.length > runtime.options.maxQueuedEvents) {
            runtime.pendingEvents.shift();
        }

        if (isResultBurst) {
            runtime.burstMinGapMs = runtime.options.eventBurstMinGapMs;
            runtime.burstUntil = now + runtime.options.eventBurstDurationMs;
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
        return true;
    }

    function getMatchedActiveBubble(runtime, payload) {
        if (!runtime || !Array.isArray(runtime.activeBubbles) || runtime.activeBubbles.length <= 0) return null;
        let matched = null;
        for (const bubble of runtime.activeBubbles) {
            if (!matchActiveSlot(bubble, payload)) continue;
            if (!matched || Number(bubble.expiresAt || 0) >= Number(matched.expiresAt || 0)) {
                matched = bubble;
            }
        }
        return matched;
    }

    function getRenderToken(game, payload) {
        const runtime = game && typeof game === 'object' ? game[RUNTIME_KEY] : null;
        if (!runtime) return '';
        const now = nowMs();
        pruneExpiredActiveBubbles(runtime, now);
        const active = getMatchedActiveBubble(runtime, payload);
        if (!active) return '';
        return String(active.token || '');
    }

    function getBubblePayload(game, payload) {
        const runtime = game && typeof game === 'object' ? game[RUNTIME_KEY] : null;
        if (!runtime) return null;
        const now = nowMs();
        pruneExpiredActiveBubbles(runtime, now);
        const active = getMatchedActiveBubble(runtime, payload);
        if (!active) return null;
        return {
            token: String(active.token || ''),
            text: String(active.text || ''),
            mode: String(active.mode || 'personal'),
            eventType: String(active.eventType || 'normal'),
            infantryCount: clampInt(active.infantryCount, 1, 1, 4),
            speakerIndex: clampInt(active.speakerIndex, 0, 0, 3)
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
