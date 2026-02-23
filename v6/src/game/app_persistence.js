(function (global) {
    'use strict';

    const DEFAULT_MAP_ID = 'skirmish';
    const VALID_DIFFICULTY = new Set(['recruit', 'veteran', 'elite']);

    function toInt(value, fallback = 0) {
        const n = Number(value);
        return Number.isFinite(n) ? Math.floor(n) : fallback;
    }

    function clampSpeed(value) {
        const n = Number(value);
        if (!Number.isFinite(n)) return 1;
        return Math.max(0.5, Math.min(3, n));
    }

    function normalizeDifficulty(value) {
        const key = String(value || '').trim().toLowerCase();
        return VALID_DIFFICULTY.has(key) ? key : 'elite';
    }

    function safeParse(raw) {
        if (!raw || typeof raw !== 'string') return null;
        try {
            const parsed = JSON.parse(raw);
            return (parsed && typeof parsed === 'object') ? parsed : null;
        } catch (_) {
            return null;
        }
    }

    const appPersistence = {
        _makeState() {
            return {
                version: this.SCHEMA_VERSION,
                settings: {
                    speed: clampSpeed(game && game.speed),
                    difficulty: normalizeDifficulty((typeof AI !== 'undefined' && AI && AI.difficulty) ? AI.difficulty : 'elite'),
                    lastMapId: DEFAULT_MAP_ID,
                    iogAlwaysOpen: !!(game && game.settings && game.settings.iogAlwaysOpen === true)
                },
                stats: {
                    killCount: Math.max(0, toInt(game && game.killCount, 0))
                },
                progress: {
                    clearedMaps: [DEFAULT_MAP_ID],
                    firstRunDone: true,
                    devUnlockAllMaps: true
                }
            };
        },

        migrate(raw) {
            const next = (raw && typeof raw === 'object') ? raw : {};

            const settings = (next.settings && typeof next.settings === 'object') ? next.settings : {};
            const stats = (next.stats && typeof next.stats === 'object') ? next.stats : {};
            const progress = (next.progress && typeof next.progress === 'object') ? next.progress : {};

            const migrated = {
                version: this.SCHEMA_VERSION,
                settings: {
                    speed: clampSpeed(settings.speed),
                    difficulty: normalizeDifficulty(settings.difficulty),
                    lastMapId: DEFAULT_MAP_ID,
                    iogAlwaysOpen: settings.iogAlwaysOpen === true
                },
                stats: {
                    killCount: Math.max(0, toInt(stats.killCount, 0))
                },
                progress: {
                    clearedMaps: [DEFAULT_MAP_ID],
                    firstRunDone: true,
                    devUnlockAllMaps: true
                }
            };

            return migrated;
        },

        load() {
            const keys = [this.STORAGE_KEY, this.BACKUP_KEY_1, this.BACKUP_KEY_2];
            for (let i = 0; i < keys.length; i += 1) {
                const key = keys[i];
                try {
                    const parsed = safeParse(localStorage.getItem(key));
                    if (parsed) {
                        return this.migrate(parsed);
                    }
                } catch (_) { }
            }
            return this.migrate(this._makeState());
        },

        saveNow() {
            try {
                const state = this.migrate(this._makeState());

                const currentBak1 = localStorage.getItem(this.BACKUP_KEY_1);
                if (currentBak1 != null) {
                    localStorage.setItem(this.BACKUP_KEY_2, currentBak1);
                }

                const currentMain = localStorage.getItem(this.STORAGE_KEY);
                if (currentMain != null) {
                    localStorage.setItem(this.BACKUP_KEY_1, currentMain);
                }

                localStorage.setItem(this.STORAGE_KEY, JSON.stringify(state));
                this._lastSaveAt = performance.now ? performance.now() : Date.now();
                this._dirty = false;
                return true;
            } catch (_) {
                return false;
            }
        },

        loadIntoGame() {
            const state = this.load();
            const settings = (state.settings && typeof state.settings === 'object') ? state.settings : {};
            const stats = (state.stats && typeof state.stats === 'object') ? state.stats : {};

            if (typeof game !== 'undefined' && game) {
                game.speed = clampSpeed(settings.speed);
                game.currentMapId = DEFAULT_MAP_ID;
                game.mapOrder = [DEFAULT_MAP_ID];
                game.clearedMaps = [DEFAULT_MAP_ID];
                game.firstRunDone = true;
                game.devUnlockAllMaps = true;
                game.killCount = Math.max(0, toInt(stats.killCount, 0));

                if (!game.settings || typeof game.settings !== 'object') {
                    game.settings = {};
                }
                game.settings.iogAlwaysOpen = settings.iogAlwaysOpen === true;
            }

            if (typeof AI !== 'undefined' && AI && typeof AI.setDifficulty === 'function') {
                AI.setDifficulty(normalizeDifficulty(settings.difficulty));
            }

            this._dirty = false;
        }
    };

    global.GameAppPersistence = appPersistence;
})(window);
