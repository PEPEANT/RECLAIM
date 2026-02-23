// Body rendering for: worker
(function attachUnitRenderV2Body_worker(globalScope) {
    'use strict';

    function drawBody(unit, ctx) {
        if (!ctx) return;
        // TODO: implement body rendering for worker
    }

    globalScope['UnitRenderV2Body_worker'] = {
        drawBody: drawBody
    };
})(typeof window !== 'undefined' ? window : globalThis);
