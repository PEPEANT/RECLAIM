// Shared math helpers for Unit Render V2.
(function attachUnitRenderV2Math(globalScope) {
    'use strict';

    function clamp(value, min, max) {
        var v = Number(value);
        if (!Number.isFinite(v)) return min;
        if (v < min) return min;
        if (v > max) return max;
        return v;
    }

    globalScope.UnitRenderV2Math = {
        clamp: clamp
    };
})(typeof window !== 'undefined' ? window : globalThis);
