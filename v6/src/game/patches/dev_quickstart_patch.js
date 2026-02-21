(function attachDevQuickstartPatch(globalScope) {
    'use strict';

    var STORAGE_KEY = 'reclaim_dev_quickstart_v1';
    var DEFAULT_MAP_ID = 'skirmish';
    var quickstartTimer = null;
    var DEFAULT_ALLY_SLOTS = [
        { unitId: 'mbt', count: 3 },
        { unitId: 'apc', count: 2 },
        { unitId: 'infantry', count: 8 }
    ];
    var DEFAULT_ENEMY_SLOTS = [
        { unitId: 'mbt', count: 3 },
        { unitId: 'aa_tank', count: 2 },
        { unitId: 'infantry', count: 8 }
    ];

    function isLocalRuntime() {
        try {
            var p = String(globalScope.location && globalScope.location.protocol || '').toLowerCase();
            var h = String(globalScope.location && globalScope.location.hostname || '').toLowerCase();
            if (p === 'file:') return true;
            if (h === 'localhost' || h === '127.0.0.1' || h === '') return true;
        } catch (_) { }
        return false;
    }

    function readRawConfig() {
        try {
            var raw = globalScope.localStorage.getItem(STORAGE_KEY);
            if (!raw) return null;
            return JSON.parse(raw);
        } catch (_) {
            return null;
        }
    }

    function sanitizeSlotList(input, fallback) {
        var source = Array.isArray(input) ? input : fallback;
        var out = [];
        var units = (globalScope.CONFIG && globalScope.CONFIG.units && typeof globalScope.CONFIG.units === 'object')
            ? globalScope.CONFIG.units
            : null;
        for (var i = 0; i < source.length; i++) {
            var s = source[i];
            if (!s || typeof s !== 'object') continue;
            var unitId = String(s.unitId || '').trim();
            var count = Math.max(1, Math.min(30, Math.floor(Number(s.count) || 0)));
            if (units && !Object.prototype.hasOwnProperty.call(units, unitId)) continue;
            if (units && units[unitId] && units[unitId].disabled) continue;
            if (!unitId || !count) continue;
            out.push({ unitId: unitId, count: count });
        }
        if (out.length <= 0) {
            return fallback.map(function (s) { return { unitId: s.unitId, count: s.count }; });
        }
        return out.slice(0, 10);
    }

    function getConfig() {
        var raw = readRawConfig() || {};
        var cfg = {
            enabled: raw.enabled === true,
            autoOpenCustom: raw.autoOpenCustom !== false,
            autoStartCustom: raw.autoStartCustom === true,
            skipBootGate: raw.skipBootGate !== false,
            mapId: String(raw.mapId || DEFAULT_MAP_ID).trim() || DEFAULT_MAP_ID,
            allySlots: sanitizeSlotList(raw.allySlots, DEFAULT_ALLY_SLOTS),
            enemySlots: sanitizeSlotList(raw.enemySlots, DEFAULT_ENEMY_SLOTS)
        };
        return cfg;
    }

    function isVisible(id) {
        var el = document.getElementById(id);
        if (!el) return false;
        return !el.classList.contains('hidden');
    }

    function clickBootPlayButton() {
        var gate = document.getElementById('boot-gate');
        var btn = document.getElementById('boot-play-btn');
        if (!gate || !btn) return false;
        if (gate.classList.contains('hidden')) return false;
        try {
            btn.click();
            return true;
        } catch (_) {
            return false;
        }
    }

    function forceShowLobbyFast() {
        var gate = document.getElementById('boot-gate');
        var loading = document.getElementById('loading-screen');
        var lobby = document.getElementById('lobby-screen');
        if (!lobby) return false;

        try {
            if (gate) gate.classList.add('hidden');
            if (loading) loading.classList.add('hidden');
            lobby.classList.remove('hidden');

            if (typeof globalScope.LobbyBackground !== 'undefined' && globalScope.LobbyBackground) {
                if (typeof globalScope.LobbyBackground.init === 'function') globalScope.LobbyBackground.init();
                if (typeof globalScope.LobbyBackground.start === 'function') globalScope.LobbyBackground.start();
            }
            if (typeof globalScope.AudioSystem !== 'undefined' && globalScope.AudioSystem) {
                if (typeof globalScope.AudioSystem.init === 'function') globalScope.AudioSystem.init();
                if (typeof globalScope.AudioSystem.playMP3 === 'function') globalScope.AudioSystem.playMP3(0);
            }
            return true;
        } catch (err) {
            console.warn('[DevQuickstart] fast lobby bypass failed:', err);
            return false;
        }
    }

    function applyPresetSlots(gameRef, cfg) {
        if (!gameRef) return;
        gameRef._customAllySlots = sanitizeSlotList(cfg.allySlots, DEFAULT_ALLY_SLOTS);
        gameRef._customEnemySlots = sanitizeSlotList(cfg.enemySlots, DEFAULT_ENEMY_SLOTS);
    }

    function ensureCustomPanel(gameRef, cfg) {
        if (!gameRef || typeof gameRef.openCampaignMap !== 'function') return false;
        try {
            gameRef.openCampaignMap();
            if (typeof gameRef.switchCampaignTab === 'function') gameRef.switchCampaignTab('custom');
            if (typeof gameRef.selectCustomMap === 'function') gameRef.selectCustomMap(cfg.mapId || DEFAULT_MAP_ID);
            applyPresetSlots(gameRef, cfg);
            if (typeof gameRef.renderCustomBattleScreen === 'function') {
                gameRef.renderCustomBattleScreen();
            }
            return true;
        } catch (err) {
            console.warn('[DevQuickstart] custom panel open failed:', err);
            return false;
        }
    }

    function tryStartCustomBattle(gameRef) {
        if (!gameRef || typeof gameRef.startCustomBattle !== 'function') return false;
        try {
            gameRef.startCustomBattle();
            return true;
        } catch (err) {
            console.warn('[DevQuickstart] custom battle start failed:', err);
            return false;
        }
    }

    function stopQuickstartTimer() {
        if (quickstartTimer) {
            clearInterval(quickstartTimer);
            quickstartTimer = null;
        }
    }

    function applyToRunningGame(cfgInput) {
        if (!isLocalRuntime()) return false;
        var cfg = cfgInput || getConfig();
        if (!cfg || cfg.enabled !== true) return false;

        var gameRef = globalScope.game || null;
        if (!gameRef || gameRef.running === true) return false;

        var lobbyVisible = isVisible('lobby-screen');
        var campaignVisible = isVisible('campaign-screen');
        var customVisible = isVisible('custom-battle-screen');
        if (!lobbyVisible && !campaignVisible && !customVisible) return false;

        var opened = false;
        if (cfg.autoOpenCustom === true) {
            opened = ensureCustomPanel(gameRef, cfg);
        } else {
            applyPresetSlots(gameRef, cfg);
            if (customVisible && typeof gameRef.renderCustomBattleScreen === 'function') {
                try {
                    gameRef.renderCustomBattleScreen();
                } catch (_) { }
            }
            opened = true;
        }

        if (cfg.autoStartCustom === true && opened === true) {
            tryStartCustomBattle(gameRef);
        }
        return opened;
    }

    function startQuickstartFlow() {
        if (!isLocalRuntime()) return;
        var cfg = getConfig();
        if (cfg.enabled !== true) return;
        stopQuickstartTimer();

        var opened = false;
        var started = false;
        var bypassed = false;
        var beganAt = Date.now();

        quickstartTimer = setInterval(function () {
            if ((Date.now() - beganAt) > 25000) {
                stopQuickstartTimer();
                return;
            }

            if (cfg.skipBootGate === true) {
                if (!bypassed) bypassed = forceShowLobbyFast();
                if (!bypassed) clickBootPlayButton();
            }

            var gameRef = globalScope.game || null;
            if (!gameRef || gameRef.running === true) return;

            var lobbyVisible = isVisible('lobby-screen');
            var campaignVisible = isVisible('campaign-screen');
            var readyForMenu = lobbyVisible || campaignVisible;
            if (!readyForMenu) return;

            if (cfg.autoOpenCustom === true && opened !== true) {
                opened = ensureCustomPanel(gameRef, cfg);
                if (opened) {
                    console.info('[DevQuickstart] custom battle screen opened');
                }
            }

            if (cfg.autoStartCustom === true && opened === true && started !== true) {
                started = tryStartCustomBattle(gameRef);
                if (started) {
                    console.info('[DevQuickstart] custom battle started');
                    stopQuickstartTimer();
                    return;
                }
            }

            if (cfg.autoStartCustom !== true && opened === true) {
                stopQuickstartTimer();
            }
        }, 220);
    }

    function onStorageConfigUpdated(evt) {
        try {
            if (!evt || evt.key !== STORAGE_KEY) return;
            var cfg = getConfig();
            if (cfg.enabled !== true) return;
            if (applyToRunningGame(cfg) !== true) {
                startQuickstartFlow();
            }
        } catch (_) { }
    }

    // Expose helpers for dev-admin page/manual console checks.
    globalScope.RECLAIM_DEV_QUICKSTART = {
        storageKey: STORAGE_KEY,
        isLocalRuntime: isLocalRuntime,
        getConfig: getConfig,
        applyToRunningGame: function () {
            return applyToRunningGame(getConfig());
        },
        runNow: startQuickstartFlow
    };

    globalScope.addEventListener('storage', onStorageConfigUpdated);
    globalScope.addEventListener('load', startQuickstartFlow, { once: true });
})(typeof window !== 'undefined' ? window : globalThis);
