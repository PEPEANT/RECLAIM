// Weapon render/muzzle helpers for: apache
// 로켓 발사 기준점: 스터브 윙 파일런 끝 (로컬 좌표)
(function attachUnitRenderV2Weapons_apache(globalScope) {
    'use strict';

    // 헬파이어/로켓 발사 위치 (로컬, facing=1 기준)
    var MUZZLE_LOCAL = { x: 38, y: 27 };

    // APACHE_SCALE = 0.62 (index.js와 동일해야 함)
    var APACHE_SCALE = 0.62;

    function getMuzzlePosition(unit, state) {
        if (!unit) return null;
        var facing = (state && (state.facing === 1 || state.facing === -1)) ? state.facing : 1;
        // 스케일 보정: 로컬 좌표 × APACHE_SCALE = 게임 월드 오프셋
        return {
            x: (Number(unit.x) || 0) + MUZZLE_LOCAL.x * APACHE_SCALE * facing,
            y: (Number(unit.y) || 0) + MUZZLE_LOCAL.y * APACHE_SCALE
        };
    }

    globalScope['UnitRenderV2Weapons_apache'] = {
        getMuzzlePosition: getMuzzlePosition
    };
})(typeof window !== 'undefined' ? window : globalThis);
