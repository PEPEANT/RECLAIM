// Render-related VFX for: special_ops
(function attachUnitRenderV2Fx_special_ops(globalScope) {
    'use strict';

    function resolveMuzzleLocal(state) {
        try {
            var api = globalScope['UnitRenderV2Weapons_special_ops'];
            if (api && typeof api.getMuzzleLocal === 'function') {
                var m = api.getMuzzleLocal(state);
                if (m && Number.isFinite(m.x) && Number.isFinite(m.y)) return m;
            }
        } catch (_) { }
        return { x: 22, y: -20 };
    }

    function drawFx(unit, ctx, state) {
        if (!ctx || !state) return;
        var flash = Number(state.muzzleFlash) || 0;
        if (flash <= 0) return;

        var muzzle = resolveMuzzleLocal(state);
        var alpha = Math.min(1, flash / 4) * 0.5;

        // Suppressed rifle: subtle glow only.
        ctx.save();
        ctx.globalAlpha = alpha;
        ctx.fillStyle = '#d1fae5';
        ctx.beginPath();
        ctx.arc(muzzle.x, muzzle.y, 1.8 + flash * 0.12, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    }

    globalScope['UnitRenderV2Fx_special_ops'] = {
        drawFx: drawFx
    };
})(typeof window !== 'undefined' ? window : globalThis);
