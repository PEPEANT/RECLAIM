// Render-related VFX for: drone_operator
(function attachUnitRenderV2Fx_drone_operator(globalScope) {
    'use strict';

    function resolveMuzzleLocal(state) {
        try {
            var api = globalScope['UnitRenderV2Weapons_drone_operator'];
            if (api && typeof api.getMuzzleLocal === 'function') {
                var m = api.getMuzzleLocal(state);
                if (m && Number.isFinite(m.x) && Number.isFinite(m.y)) return m;
            }
        } catch (_) { }
        return { x: 18, y: -20 };
    }

    function drawFx(unit, ctx, state) {
        if (!ctx || !state) return;
        if (state.mode === 'laptop') return;
        var flash = Number(state.muzzleFlash) || 0;
        if (flash <= 0) return;

        var muzzle = resolveMuzzleLocal(state);
        var alpha = Math.min(1, flash / 4);

        ctx.save();
        ctx.globalAlpha = alpha * 0.55;
        ctx.fillStyle = '#f97316';
        ctx.beginPath();
        ctx.arc(muzzle.x, muzzle.y, 4.2, 0, Math.PI * 2);
        ctx.fill();

        ctx.globalAlpha = alpha;
        ctx.fillStyle = '#fef08a';
        ctx.beginPath();
        ctx.arc(muzzle.x, muzzle.y, 2.6, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    }

    globalScope['UnitRenderV2Fx_drone_operator'] = {
        drawFx: drawFx
    };
})(typeof window !== 'undefined' ? window : globalThis);
