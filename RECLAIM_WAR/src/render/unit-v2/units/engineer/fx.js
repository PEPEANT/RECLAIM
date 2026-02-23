// Render-related VFX for: engineer
(function attachUnitRenderV2Fx_engineer(globalScope) {
    'use strict';

    function resolveMuzzleLocal(state) {
        try {
            var api = globalScope['UnitRenderV2Weapons_engineer'];
            if (api && typeof api.getMuzzleLocal === 'function') {
                var m = api.getMuzzleLocal(state);
                if (m && Number.isFinite(m.x) && Number.isFinite(m.y)) return m;
            }
        } catch (_) { }
        return { x: 18, y: -20 };
    }

    function drawFx(unit, ctx, state) {
        if (!ctx || !state) return;
        var flash = Number(state.muzzleFlash) || 0;
        if (flash <= 0) return;

        var muzzle = resolveMuzzleLocal(state);
        var isLauncher = (state.mode === 'firing');
        var alpha = Math.min(1, flash / (isLauncher ? 5 : 4));
        var r = isLauncher ? (4.3 + flash * 0.32) : (3 + flash * 0.2);

        ctx.save();
        ctx.globalAlpha = alpha * 0.55;
        ctx.fillStyle = '#f97316';
        ctx.beginPath();
        ctx.arc(muzzle.x, muzzle.y, r * 1.6, 0, Math.PI * 2);
        ctx.fill();

        ctx.globalAlpha = alpha;
        ctx.fillStyle = '#fde68a';
        ctx.beginPath();
        ctx.arc(muzzle.x, muzzle.y, r, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    }

    globalScope['UnitRenderV2Fx_engineer'] = {
        drawFx: drawFx
    };
})(typeof window !== 'undefined' ? window : globalThis);
