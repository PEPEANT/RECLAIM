(function (global) {
    'use strict';

    const AI = global.AI;
    if (!AI || typeof document === 'undefined') return;

    const STATE = {
        enabled: false,
        lastRenderMs: 0,
        element: null
    };

    function ensureElement() {
        if (STATE.element) return STATE.element;
        const el = document.createElement('div');
        el.id = 'ai-debug-overlay';
        el.style.position = 'fixed';
        el.style.top = '10px';
        el.style.right = '10px';
        el.style.zIndex = '99999';
        el.style.padding = '10px 12px';
        el.style.minWidth = '240px';
        el.style.maxWidth = '360px';
        el.style.border = '1px solid rgba(56, 189, 248, 0.7)';
        el.style.background = 'rgba(2, 6, 23, 0.92)';
        el.style.color = '#e2e8f0';
        el.style.fontFamily = 'Consolas, Menlo, monospace';
        el.style.fontSize = '12px';
        el.style.lineHeight = '1.45';
        el.style.whiteSpace = 'pre-line';
        el.style.pointerEvents = 'none';
        el.style.display = 'none';
        document.body.appendChild(el);
        STATE.element = el;
        return el;
    }

    function aliveEnemyCount() {
        const list = (global.game && Array.isArray(global.game.enemies)) ? global.game.enemies : [];
        let alive = 0;
        for (let i = 0; i < list.length; i++) {
            if (list[i] && !list[i].dead) alive++;
        }
        return alive;
    }

    function formatSpecial(special) {
        if (!special) return 'special: n/a';
        const ch = special.charges || {};
        const cd = special.cd || {};
        return [
            'special charges n/e/t: ' + [ch.nuke ?? '-', ch.emp ?? '-', ch.tactical ?? '-'].join('/'),
            'special cd      n/e/t: ' + [cd.nuke ?? '-', cd.emp ?? '-', cd.tactical ?? '-'].join('/'),
            'tacticalInFlight: ' + (!!special.tacticalInFlight)
        ].join('\n');
    }

    function render() {
        const el = ensureElement();
        if (!STATE.enabled) {
            el.style.display = 'none';
            return;
        }

        const g = global.game;
        const frame = g ? (Number(g.frame) || 0) : 0;
        const nextSpawnAt = Number(AI.nextSpawnAt) || 0;
        const spawnIn = nextSpawnAt - frame;
        const cap = (typeof AI._getGlobalAliveCap === 'function') ? AI._getGlobalAliveCap(frame) : 'n/a';
        const alive = aliveEnemyCount();
        const wave = AI.wave || {};
        const holdLeft = Math.max(0, (Number(wave.holdUntil) || 0) - frame);

        el.textContent = [
            '[AI DEBUG] F7 Toggle',
            'difficulty: ' + (AI.difficulty || 'n/a'),
            'frame: ' + frame,
            'enemySupplyRate: ' + (g ? (g.enemySupplyRate ?? 'n/a') : 'n/a'),
            'nextSpawnAt: ' + nextSpawnAt + ' (in ' + spawnIn + 'f)',
            'alive/cap: ' + alive + '/' + cap,
            'wave: ' + (wave.phase || 'n/a') + ' wp=' + (wave.wpIndex ?? 'n/a') + ' holdLeft=' + holdLeft,
            'totalWarIssued: ' + (!!AI._totalWarIssued),
            formatSpecial(AI.special)
        ].join('\n');

        el.style.display = 'block';
    }

    const oldUpdate = AI.update;
    if (typeof oldUpdate === 'function' && !AI.__debugWrappedUpdate) {
        AI.update = function wrappedUpdate(frame) {
            const result = oldUpdate.call(this, frame);
            const now = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
            if (now - STATE.lastRenderMs >= 80) {
                STATE.lastRenderMs = now;
                try { render(); } catch (e) { }
            }
            return result;
        };
        AI.__debugWrappedUpdate = true;
    }

    document.addEventListener('keydown', (e) => {
        if (e.key !== 'F7') return;
        e.preventDefault();
        STATE.enabled = !STATE.enabled;
        render();
    });
})(window);
