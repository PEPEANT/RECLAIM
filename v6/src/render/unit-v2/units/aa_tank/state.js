// Per-unit runtime render state for: aa_tank
(function attachUnitRenderV2State_aa_tank(globalScope) {
    'use strict';

    function getState(unit) {
        if (!unit) return null;
        if (!unit._renderV2State || typeof unit._renderV2State !== 'object') {
            unit._renderV2State = {};
        }
        return unit._renderV2State;
    }

    globalScope['UnitRenderV2State_aa_tank'] = {
        getState: getState
    };
})(typeof window !== 'undefined' ? window : globalThis);
