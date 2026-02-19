(function attachCityDrillgroundBubbleRender(global) {
    'use strict';

    function clampInt(value, fallback, minValue, maxValue) {
        const parsed = Math.floor(Number(value));
        const base = Number.isFinite(parsed) ? parsed : fallback;
        if (base < minValue) return minValue;
        if (base > maxValue) return maxValue;
        return base;
    }

    function getTailOffsetPercent(infantryCount, speakerIndex) {
        const count = clampInt(infantryCount, 1, 1, 4);
        const index = clampInt(speakerIndex, 0, 0, Math.max(0, count - 1));
        if (count === 1) return 50;
        if (count === 2) return index === 0 ? 36 : 64;
        if (count === 3) {
            if (index === 0) return 34;
            if (index === 1) return 66;
            return 50;
        }
        if (index === 0) return 34;
        if (index === 1) return 66;
        if (index === 2) return 38;
        return 62;
    }

    function appendBubbleElement(cell, payload) {
        if (!cell || !payload || typeof payload !== 'object') return false;
        const text = String(payload.text || '').trim();
        if (!text) return false;

        const bubble = document.createElement('span');
        bubble.className = 'city-drillground-bubble';

        const mode = String(payload.mode || '').trim().toLowerCase();
        if (mode === 'group') bubble.classList.add('is-group');
        else bubble.classList.add('is-personal');

        if (mode === 'personal') {
            const infantryCount = clampInt(payload.infantryCount, 1, 1, 4);
            const speakerIndex = clampInt(payload.speakerIndex, 0, 0, Math.max(0, infantryCount - 1));
            const tailX = getTailOffsetPercent(infantryCount, speakerIndex);
            bubble.style.setProperty('--city-bubble-tail-x', `${tailX}%`);
        }

        const eventType = String(payload.eventType || '').trim().toLowerCase();
        if (eventType === 'battle_pre') bubble.classList.add('event-battle-pre');
        if (eventType === 'battle_post_victory') bubble.classList.add('event-battle-victory');
        if (eventType === 'battle_post_defeat') bubble.classList.add('event-battle-defeat');

        bubble.setAttribute('aria-hidden', 'true');
        const content = document.createElement('span');
        content.className = 'city-drillground-bubble-text';
        content.textContent = text;
        bubble.appendChild(content);
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
