// Per-unit runtime render state for: fighter
(function attachUnitRenderV2State_fighter(globalScope) {
    'use strict';

    function getState(unit) {
        if (!unit) return null;
        if (!unit._renderV2State || typeof unit._renderV2State !== 'object') {
            unit._renderV2State = {};
        }
        return unit._renderV2State;
    }

    globalScope['UnitRenderV2State_fighter'] = {
        getState: getState
    };
})(typeof window !== 'undefined' ? window : globalThis);
