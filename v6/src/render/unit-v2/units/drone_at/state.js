// Per-unit runtime render state for: drone_at
(function attachUnitRenderV2State_drone_at(globalScope) {
    'use strict';

    function getState(unit) {
        if (!unit) return null;
        if (!unit._renderV2State || typeof unit._renderV2State !== 'object') {
            unit._renderV2State = {};
        }
        return unit._renderV2State;
    }

    globalScope['UnitRenderV2State_drone_at'] = {
        getState: getState
    };
})(typeof window !== 'undefined' ? window : globalThis);
