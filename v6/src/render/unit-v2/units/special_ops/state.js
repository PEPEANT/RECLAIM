// Per-unit runtime render state for: special_ops
(function attachUnitRenderV2State_special_ops(globalScope) {
    'use strict';

    function getState(unit) {
        if (!unit) return null;
        if (!unit._renderV2State || typeof unit._renderV2State !== 'object') {
            unit._renderV2State = {};
        }
        return unit._renderV2State;
    }

    globalScope['UnitRenderV2State_special_ops'] = {
        getState: getState
    };
})(typeof window !== 'undefined' ? window : globalThis);
