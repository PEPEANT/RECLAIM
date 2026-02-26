(function (global) {
    'use strict';

    const AI = global.AI;
    if (!AI) return;

    Object.assign(AI, {
    _canSpawnUnit(id) {
        const u = CONFIG.units[id];
        if (!u) return false;
        if (game && typeof game.isEnemySpawnBlockedUnit === 'function' && game.isEnemySpawnBlockedUnit(id)) return false;
        if (game.enemySupply < u.cost) return false;
        if (game.enemyCooldowns && game.enemyCooldowns[id] > 0) return false;
        if (game.enemyStock && game.enemyStock[id] <= 0) return false;
        return true;
    },

    _getAliveEnemyUnitCount() {
        const list = (game && Array.isArray(game.enemies)) ? game.enemies : [];
        let alive = 0;
        for (let i = 0; i < list.length; i++) {
            const u = list[i];
            if (u && !u.dead) alive++;
        }
        return alive;
    },

    _getGlobalAliveCap(frame = 0) {
        const table = (this.globalAliveCaps && typeof this.globalAliveCaps === 'object') ? this.globalAliveCaps : {};
        const tiers = table[this.difficulty] || table.elite || [12, 18, 24];
        const f = Math.max(0, Number(frame) || 0);
        let cap = tiers[0];
        if (f >= 60 * 210) cap = tiers[2];
        else if (f >= 60 * 90) cap = tiers[1];
        const mapId = String((game && game.currentMapId) || '').trim();
        if (mapId === 'skirmish_coast') {
            cap = Math.round(cap * 1.45);
        }
        return Math.max(1, Math.floor(Number(cap) || 1));
    },

    _canSpawnByWaveCap(extraUnits = 0, frame = null) {
        const refFrame = (frame == null) ? (game ? game.frame : 0) : frame;
        const cap = this._getGlobalAliveCap(refFrame);
        if (!Number.isFinite(cap) || cap <= 0) return true;

        const extra = Math.max(0, Math.floor(Number(extraUnits) || 0));
        const alive = this._getAliveEnemyUnitCount();
        return (alive + extra) <= cap;
    },

    _spawnEnemyWithArmoredRatio(id, opts = {}) {
        const ignoreRatio = !!opts.ignoreArmoredRatio;
        let finalId = id;
        if (!ignoreRatio && id === 'aa_tank') {
            if (this.armoredWaveTankCount < 6 && this._canSpawnUnit('mbt')) {
                finalId = 'mbt';
            }
        }
        if (!this._canSpawnUnit(finalId)) {
            // Fallback: allow AA if MBT isn't available
            if (finalId !== id && this._canSpawnUnit(id)) {
                finalId = id;
            } else {
                return false;
            }
        }
        const spawned = (typeof game.spawnEnemy === 'function') ? game.spawnEnemy(finalId) : false;
        if (spawned) {
            if (finalId === 'mbt') this.armoredWaveTankCount++;
            else if (finalId === 'aa_tank') this.armoredWaveTankCount = 0;
            this._registerSpawnDecision(finalId, Math.max(0, Number(game?.frame) || 0));
        }
        return spawned;
    },
    });
})(window);
