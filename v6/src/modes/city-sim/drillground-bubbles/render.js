(function attachCityDrillgroundBubbleRender(global) {
    'use strict';

    function appendBubbleElement(cell, payload) {
        if (!cell || !payload || typeof payload !== 'object') return false;
        const text = String(payload.text || '').trim();
        if (!text) return false;

        const bubble = document.createElement('span');
        bubble.className = 'city-drillground-bubble';

        const mode = String(payload.mode || '').trim().toLowerCase();
        if (mode === 'group') bubble.classList.add('is-group');
        else bubble.classList.add('is-personal');

        const eventType = String(payload.eventType || '').trim().toLowerCase();
        if (eventType === 'battle_pre') bubble.classList.add('event-battle-pre');
        if (eventType === 'battle_post_victory') bubble.classList.add('event-battle-victory');
        if (eventType === 'battle_post_defeat') bubble.classList.add('event-battle-defeat');

        bubble.setAttribute('aria-hidden', 'true');
        bubble.textContent = text;
        cell.appendChild(bubble);
        return true;
    }

    function appendBubbleForSlot(cell, game, slotPayload) {
        if (!cell || !slotPayload || typeof slotPayload !== 'object') return false;
        if (slotPayload.preview === true || slotPayload.isCompanion === true) return false;

        const runtime = global.CitySimDrillgroundBubbleRuntime;
        if (!runtime || typeof runtime.getBubblePayload !== 'function') return false;

        const payload = runtime.getBubblePayload(game, slotPayload);
        if (!payload) return false;
        return appendBubbleElement(cell, payload);
    }

    global.CitySimDrillgroundBubbleRender = {
        appendBubbleForSlot
    };
})(window);
