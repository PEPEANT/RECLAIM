// Per-unit runtime render state for: drone_suicide
(function attachUnitRenderV2State_drone_suicide(globalScope) {
    'use strict';

    function getState(unit) {
        if (!unit) return null;
        if (!unit._renderV2State || typeof unit._renderV2State !== 'object') {
            unit._renderV2State = {};
        }
        return unit._renderV2State;
    }

    globalScope['UnitRenderV2State_drone_suicide'] = {
        getState: getState
    };
})(typeof window !== 'undefined' ? window : globalThis);
