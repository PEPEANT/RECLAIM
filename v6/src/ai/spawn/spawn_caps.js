(function (global) {
    'use strict';

    const AI = global.AI;
    if (!AI) return;

    Object.assign(AI, {
    _canSpawnUnit(id) {
        const u = CONFIG.units[id];
        if (!u) return false;
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
        const occupationStageId = this._getOccupationStageId();
        let cap = tiers[0];
        if (f >= 60 * 210) cap = tiers[2];
        else if (f >= 60 * 90) cap = tiers[1];

        // Occupation final command stage(7): raise concurrent enemy pressure.
        if (occupationStageId === 7) {
            const bonus = (f >= 60 * 360) ? 10 : (f >= 60 * 150 ? 8 : 6);
            cap += bonus;
        }

        const stageCap = this._getOccupationWaveSpawnCap(f);
        if (Number.isFinite(stageCap)) cap = Math.min(cap, stageCap);
        return Math.max(1, Math.floor(Number(cap) || 1));
    },

    _getOccupationStageId() {
        if (!game || game._skirmishMode) return 0;
        const stageId = Math.floor(Number(game.activeCampaignStageId) || 0);
        return (stageId > 0 && stageId < 100) ? stageId : 0;
    },

    _getOccupationWaveSpawnCap(frame = 0) {
        const stageId = this._getOccupationStageId();
        if (!stageId) return null;

        const table = (this.occupationWaveCaps && typeof this.occupationWaveCaps === 'object')
            ? this.occupationWaveCaps
            : {};
        const fallback = table.default || { waveAt: [60 * 90, 60 * 210], caps: [10, 14, 18] };
        const custom = table[stageId] || {};

        const waveAtSrc = Array.isArray(custom.waveAt) ? custom.waveAt : fallback.waveAt;
        const capsSrc = Array.isArray(custom.caps) ? custom.caps : fallback.caps;

        const waveAt = [
            Math.max(0, Math.floor(Number(waveAtSrc?.[0]) || 0)),
            Math.max(0, Math.floor(Number(waveAtSrc?.[1]) || 0))
        ];
        const caps = [
            Math.max(1, Math.floor(Number(capsSrc?.[0]) || 1)),
            Math.max(1, Math.floor(Number(capsSrc?.[1]) || 1)),
            Math.max(1, Math.floor(Number(capsSrc?.[2]) || 1))
        ];

        const f = Math.max(0, Math.floor(Number(frame) || 0));
        if (f < waveAt[0]) return caps[0];
        if (f < waveAt[1]) return caps[1];
        return caps[2];
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
