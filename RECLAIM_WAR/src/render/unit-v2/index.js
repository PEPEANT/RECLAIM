// Unit Render V2 public entry.
(function attachUnitRenderV2(globalScope) {
    'use strict';

    var registry = globalScope.UnitRenderV2Registry || {};

    function canRender(unit) {
        if (!unit || !unit.stats) return false;
        var id = String(unit.stats.id || '').trim();
        return !!(id && registry[id] && typeof registry[id].draw === 'function');
    }

    function draw(unit, ctx, env) {
        if (!unit || !unit.stats || !ctx) return false;
        var id = String(unit.stats.id || '').trim();
        var renderer = registry[id];
        if (!renderer || typeof renderer.draw !== 'function') return false;
        try {
            return renderer.draw(unit, ctx, env) === true;
        } catch (_) {
            return false;
        }
    }

    globalScope.UnitRenderV2 = {
        canRender: canRender,
        draw: draw
    };
})(typeof window !== 'undefined' ? window : globalThis);
