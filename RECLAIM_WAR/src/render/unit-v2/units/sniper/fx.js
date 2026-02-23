// Render-related VFX for: sniper
(function attachUnitRenderV2Fx_sniper(globalScope) {
    'use strict';

    function resolveMuzzleLocal(state) {
        try {
            var api = globalScope['UnitRenderV2Weapons_sniper'];
            if (api && typeof api.getMuzzleLocal === 'function') {
                var m = api.getMuzzleLocal(state);
                if (m && Number.isFinite(m.x) && Number.isFinite(m.y)) return m;
            }
        } catch (_) { }
        return { x: 28, y: -20 };
    }

    function drawFx(unit, ctx, state) {
        if (!ctx || !state) return;
        var flash = Number(state.muzzleFlash) || 0;
        if (flash <= 0) return;

        var muzzle = resolveMuzzleLocal(state);
        var alpha = Math.min(1, flash / 5);

        ctx.save();
        ctx.globalAlpha = alpha * 0.8;
        ctx.fillStyle = '#fff7cc';
        ctx.beginPath();
        ctx.arc(muzzle.x, muzzle.y, 2.8 + flash * 0.18, 0, Math.PI * 2);
        ctx.fill();

        ctx.globalAlpha = alpha * 0.55;
        ctx.fillStyle = '#ff9f3f';
        ctx.beginPath();
        ctx.arc(muzzle.x + 2.2, muzzle.y, 2.2 + flash * 0.14, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    }

    globalScope['UnitRenderV2Fx_sniper'] = {
        drawFx: drawFx
    };
})(typeof window !== 'undefined' ? window : globalThis);
