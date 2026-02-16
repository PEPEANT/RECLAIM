(function (global) {
    'use strict';

    const appRuntime = {
        STORAGE_KEY: 'CT_STATE_V1',
        BACKUP_KEY_1: 'CT_STATE_V1_BAK1',
        BACKUP_KEY_2: 'CT_STATE_V1_BAK2',
        SCHEMA_VERSION: 1,

        _dirty: true,
        _uiDirty: true,
        _lastSaveAt: 0,
        _pendingMainCloudSave: null,
        _pendingMainCloudUid: '',

        // Dirty flag + unified commit point.
        markDirty() { this._dirty = true; },
        markUiDirty() { this._uiDirty = true; },

        commit(reason = '') {
            const wasDirty = this._dirty;
            const wasUiDirty = this._uiDirty;
            this._dirty = false;
            this._uiDirty = false;

            // UI updates run only when ui-dirty is set.
            if (wasUiDirty) {
                ui.updateCategoryTab(game.currentCategory);
                ui.updateUnitButtons(game.currentCategory, game.playerStock, game.cooldowns, game.supply, game.spawnQueue);
                ui.setSkillCount('emp', game.skillCharges.emp);
                ui.setSkillCount('nuke', game.skillCharges.nuke);
                ui.setSkillCount('tactical_missile', game.skillCharges.tactical);
                ui.updateSpeedBtns(game.speed);
            }

            if (!wasDirty) return;

            // Save state at most once per second.
            const now = performance.now ? performance.now() : Date.now();
            if (now - this._lastSaveAt > 1000) this.saveNow();
        },

        // Minimal app-facing mutation APIs.
        setSpeed(s) {
            game.setSpeed(s);
            this.markDirty();
            this.markUiDirty();
        },
        addSupply(n) {
            const v = Number(n) || 0;
            game.supply = Math.max(0, (Number(game.supply) || 0) + v);
            this.markDirty();
            this.markUiDirty();
        },
        spendSupply(n) {
            const v = Number(n) || 0;
            game.supply = Math.max(0, (Number(game.supply) || 0) - v);
            this.markDirty();
            this.markUiDirty();
        },
        spawnUnitDirect(key, x, team) {
            // Route direct spawn writes through app for save consistency.
            game.spawnUnitDirect(key, x, game.groundY, team);
            this.markDirty();
        }
    };

    if (global.GameAppPersistence && typeof global.GameAppPersistence === 'object') {
        Object.assign(appRuntime, global.GameAppPersistence);
    }

    global.app = appRuntime;
})(window);

// Ensure global identifier access (`app`) in classic scripts.
var app = window.app;
