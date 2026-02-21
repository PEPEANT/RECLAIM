// Per-unit runtime render state for: chinook
(function attachUnitRenderV2State_chinook(globalScope) {
    'use strict';

    function getState(unit) {
        if (!unit) return null;
        if (!unit._renderV2State || typeof unit._renderV2State !== 'object') {
            unit._renderV2State = {};
        }
        return unit._renderV2State;
    }

    globalScope['UnitRenderV2State_chinook'] = {
        getState: getState
    };
})(typeof window !== 'undefined' ? window : globalThis);
