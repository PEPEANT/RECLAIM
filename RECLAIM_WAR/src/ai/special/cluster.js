(function (global) {
    'use strict';

    const AI = global.AI;
    if (!AI) return;

    Object.assign(AI, {
    // ==========================
    // Special Weapon Logic
    // ==========================
    _rand(min, max) { return Math.random() * (max - min) + min; },

    // [OPTIMIZED] SpatialGrid를 사용한 클러스터 검색 (O(N²) → O(N×K))
    _createClusterGrid(list, cellSize) {
        if (typeof SpatialGrid === 'undefined') return null;
        const grid = new SpatialGrid(CONFIG.mapWidth || 2400, 600, cellSize);
        for (let i = 0; i < list.length; i++) {
            const e = list[i];
            if (e && !e.dead) grid.insert(e);
        }
        return grid;
    },

    _bestClusterTarget(list, radius) {
        if (!list || list.length === 0) return null;

        // SpatialGrid 사용 시 O(N×K), 없으면 O(N²) 폴백
        const cellSize = Math.max(radius, 150);
        const grid = this._createClusterGrid(list, cellSize);

        let best = null;
        const r2 = radius * radius;

        for (let i = 0; i < list.length; i++) {
            const a = list[i];
            if (!a || a.dead) continue;

            let cnt = 0;
            let sx = 0, sy = 0;

            // SpatialGrid로 주변 셀만 검색 (평균 O(K) where K << N)
            const candidates = grid ? grid.retrieve(a) : list;
            const ay = a.y || game.groundY;

            for (let j = 0; j < candidates.length; j++) {
                const b = candidates[j];
                if (!b || b.dead) continue;
                const dx = b.x - a.x;
                const dy = (b.y || game.groundY) - ay;
                if (dx * dx + dy * dy <= r2) {
                    cnt++;
                    sx += b.x;
                    sy += (b.y || game.groundY);
                }
            }

            if (!best || cnt > best.count) {
                best = {
                    x: sx / Math.max(1, cnt),
                    y: sy / Math.max(1, cnt),
                    count: cnt
                };
            }
        }
        return best;
    },

    _countBuildingsNear(x, y, r) {
        const list = game.playerBuildings || [];
        let c = 0;
        for (const b of list) {
            if (!b || b.dead) continue;
            const dx = b.x - x;
            const dy = (b.y || game.groundY) - y;
            if (dx * dx + dy * dy <= r * r) c++;
        }
        return c;
    },
    });
})(window);
