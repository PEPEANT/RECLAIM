// Per-unit runtime render state for: bomber
(function attachUnitRenderV2State_bomber(globalScope) {
    'use strict';

    function getState(unit) {
        if (!unit) return null;
        if (!unit._renderV2State || typeof unit._renderV2State !== 'object') {
            unit._renderV2State = {};
        }
        return unit._renderV2State;
    }

    globalScope['UnitRenderV2State_bomber'] = {
        getState: getState
    };
})(typeof window !== 'undefined' ? window : globalThis);
