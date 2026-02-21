// Body rendering for: infantry
(function attachUnitRenderV2Body_infantry(globalScope) {
    'use strict';

    function drawBody(unit, ctx) {
        if (!ctx) return;
        // TODO: implement body rendering for infantry
    }

    globalScope['UnitRenderV2Body_infantry'] = {
        drawBody: drawBody
    };
})(typeof window !== 'undefined' ? window : globalThis);
