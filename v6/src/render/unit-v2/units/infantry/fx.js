// Render-related VFX (muzzle flash) for: infantry
(function attachUnitRenderV2Fx_infantry(globalScope) {
    'use strict';

    var FALLBACK_MUZZLE_LOCAL = {
        standing:  { x: 21, y: -20 },
        crouching: { x: 22, y: -14 },
        prone:     { x: 30, y:  -5 }
    };

    function resolveMuzzleLocal(state) {
        try {
            var api = globalScope['UnitRenderV2Weapons_infantry'];
            if (api && typeof api.getMuzzleLocal === 'function') {
                var m = api.getMuzzleLocal(state);
                if (m && Number.isFinite(m.x) && Number.isFinite(m.y)) return m;
            }
        } catch (_) { }
        var stance = (state && state.stance) ? state.stance : 'standing';
        return FALLBACK_MUZZLE_LOCAL[stance] || FALLBACK_MUZZLE_LOCAL.standing;
    }

    function drawFx(unit, ctx, state) {
        if (!ctx || !state) return;
        var flash = Number(state.muzzleFlash) || 0;
        if (flash <= 0) return;

        var muzzle = resolveMuzzleLocal(state);
        var alpha = (flash / 4) * 0.85;
        var radius = 3 + flash * 0.6;

        ctx.save();

        ctx.globalAlpha = alpha * 0.5;
        ctx.fillStyle = '#f97316';
        ctx.beginPath();
        ctx.arc(muzzle.x, muzzle.y, radius * 1.6, 0, Math.PI * 2);
        ctx.fill();

        ctx.globalAlpha = alpha;
        ctx.fillStyle = '#fef08a';
        ctx.beginPath();
        ctx.arc(muzzle.x, muzzle.y, radius, 0, Math.PI * 2);
        ctx.fill();

        ctx.globalAlpha = 1;
        ctx.restore();
    }

    globalScope['UnitRenderV2Fx_infantry'] = {
        drawFx: drawFx
    };
})(typeof window !== 'undefined' ? window : globalThis);
