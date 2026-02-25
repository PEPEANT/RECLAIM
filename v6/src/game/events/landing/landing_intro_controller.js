(function (global) {
    'use strict';

    const types = global.LandingIntroTypes || {};
    const STATES = types.STATES || {
        APPROACH: 'approach',
        BEACH: 'beach',
        RAMP_OPEN: 'ramp_open',
        HOLD: 'hold',
        DONE: 'done',
        FAILED: 'failed'
    };
    const normalizeConfig = (typeof types.normalizeLandingIntroConfig === 'function')
        ? types.normalizeLandingIntroConfig
        : ((raw) => raw || {});

    function createLandingIntroController(game, inputConfig = null) {
        const cfg = normalizeConfig(inputConfig);
        const CraftCtor = global.LandingCraftEntity;
        const renderer = global.LandingCraftRenderer;
        const crafts = [];
        const startedAt = Date.now();
        let finished = false;
        let disabled = false;
        const MOVE_AUDIO_PATH = 'bgm/mov/tank_moving2.mp3';
        const SEA_AUDIO_PATH = 'bgm/mov/solarmusic.mp3';
        const seaWindowEndMs = Date.now() + 7000;
        let moveAudio = null;
        let seaAudio = null;

        if (typeof CraftCtor !== 'function' || !renderer || typeof renderer.drawLandingCraft !== 'function') {
            return {
                update() { },
                draw() { },
                isFinished() { return true; },
                destroy() { },
                getDebugState() { return { finished: true, disabled: true, reason: 'missing-dependency' }; }
            };
        }

        const currentMap = String((game && game.currentMapId) || '').trim();
        const isCoastMap = currentMap === 'skirmish_coast';
        const beachOriginX = Math.max(80, Number(cfg.beachStartX) || 220);
        const startOriginX = Number(cfg.startX) || -760;
        const groundY = Number(game && game.groundY) || 0;
        const viewportH = Number(game && game.height) || 840;
        const seaSurfaceY = Math.max(32, Math.min(viewportH - 84, groundY + 18));
        const baseYOffset = Number(cfg.baseYOffset) || 0;
        const baseY = isCoastMap ? (seaSurfaceY + baseYOffset) : (groundY + baseYOffset);
        const beachGapX = Number(cfg.beachGapX) || 0;
        const beachGapY = Number(cfg.beachGapY) || 74;
        const approachSpeed = Math.max(10, Number(cfg.approachSpeed) || 120);
        const staggerSec = Math.max(0, Number(cfg.staggerSec) || 0);
        const arrivalRandomMinSec = Math.max(0, Number(cfg.arrivalRandomMinSec) || 0);
        const arrivalRandomMaxSec = Math.max(arrivalRandomMinSec, Number(cfg.arrivalRandomMaxSec) || arrivalRandomMinSec);
        const pickArrivalDelay = () => {
            if (arrivalRandomMaxSec <= arrivalRandomMinSec) return arrivalRandomMinSec;
            return arrivalRandomMinSec + (Math.random() * (arrivalRandomMaxSec - arrivalRandomMinSec));
        };
        for (let i = 0; i < cfg.initialCrafts; i += 1) {
            const craftStartX = startOriginX - (i * 96);
            const craftBeachX = beachOriginX + (i * beachGapX);
            const travelDistance = Math.max(1, Math.abs(craftBeachX - craftStartX));
            const minApproachSec = travelDistance / approachSpeed;
            const resolvedApproachSec = Math.max(Number(cfg.approachSec) || 0, minApproachSec + 0.15);
            const delaySec = (i * staggerSec) + pickArrivalDelay();
            crafts.push(new CraftCtor({
                id: `coast-craft-${i + 1}`,
                index: i,
                x: craftStartX,
                y: baseY + (i * beachGapY),
                beachX: craftBeachX,
                approachSpeed,
                delaySec,
                approachSec: resolvedApproachSec,
                beachSec: cfg.beachSec,
                rampOpenSec: cfg.rampOpenSec,
                holdSec: cfg.holdSec,
                timeoutSec: cfg.timeoutSec,
                scale: cfg.craftScale,
                maxHp: cfg.craftHp
            }));
        }

        function resolveAudioSystem() {
            try {
                if (typeof AudioSystem !== 'undefined' && AudioSystem) return AudioSystem;
            } catch (_) { }
            return (global && global.AudioSystem) ? global.AudioSystem : null;
        }

        function getSfxMix() {
            try {
                const api = resolveAudioSystem();
                if (!api || !api.volume) return 0;
                const sfx = Number(api.volume.sfx);
                const master = Number(api.volume.master);
                if (!(sfx > 0) || !(master > 0)) return 0;
                return Math.max(0, Math.min(1, sfx * master));
            } catch (_) {
                return 0;
            }
        }

        function ensureAudio(audioRef, src, shouldLoop) {
            let a = audioRef;
            if (!a) {
                try {
                    a = new Audio(src);
                    a.preload = 'auto';
                    a.playsInline = true;
                } catch (_) {
                    return null;
                }
            }
            a.loop = !!shouldLoop;
            return a;
        }

        function pauseAudio(a, resetTime) {
            if (!a) return;
            try { a.pause(); } catch (_) { }
            if (resetTime) {
                try { a.currentTime = 0; } catch (_) { }
            }
        }

        function playAudio(a) {
            if (!a) return;
            try {
                if (a.ended) {
                    try { a.currentTime = 0; } catch (_) { }
                }
                if (a.paused || a.ended) {
                    const p = a.play();
                    if (p && typeof p.catch === 'function') p.catch(() => { });
                }
            } catch (_) { }
        }

        function syncLandingAudio() {
            const paused = !!(game && game.paused);
            const mix = getSfxMix();
            const anyApproaching = crafts.some((c) => c && c.active === true && c.state === STATES.APPROACH);

            if (!paused && anyApproaching && mix > 0.001) {
                moveAudio = ensureAudio(moveAudio, MOVE_AUDIO_PATH, true);
                if (moveAudio) {
                    moveAudio.volume = Math.max(0, Math.min(1, mix * 1.35));
                    playAudio(moveAudio);
                }
            } else {
                pauseAudio(moveAudio, false);
            }

            const seaWindowActive = Date.now() < seaWindowEndMs;
            if (!paused && seaWindowActive && mix > 0.001) {
                seaAudio = ensureAudio(seaAudio, SEA_AUDIO_PATH, true);
                if (seaAudio) {
                    seaAudio.volume = Math.max(0, Math.min(1, mix * 1.15));
                    playAudio(seaAudio);
                }
            } else {
                pauseAudio(seaAudio, false);
            }
        }

        function getEnemyPressureWeight(unit, nowFrame) {
            if (!unit || !unit.stats) return 0;
            const type = String(unit.stats.type || '').trim().toLowerCase();
            const category = String(unit.stats.category || '').trim().toLowerCase();
            let weight = 0.8;
            if (category === 'infantry') weight = 0.55;
            else if (category === 'armored' || type === 'mech' || type === 'vehicle') weight = 1.55;
            else if (category === 'air' || type === 'air') weight = 1.15;
            const lastAttack = Math.max(0, Math.floor(Number(unit.lastAttack) || 0));
            if (nowFrame - lastAttack <= 45) {
                weight *= 1.32;
            }
            return weight;
        }

        function applyCraftCombatPressure(dt) {
            if (!game || !Array.isArray(game.enemies) || game.enemies.length <= 0) return;
            const delta = Math.max(0, Number(dt) || 0);
            if (delta <= 0) return;

            const radiusX = Math.max(60, Number(cfg.damageRadiusX) || 280);
            const radiusY = Math.max(40, Number(cfg.damageRadiusY) || 170);
            const pressureDps = Math.max(1, Number(cfg.enemyPressureDps) || 18);
            const nowFrame = Math.max(0, Math.floor(Number(game.frame) || 0));

            for (let i = 0; i < crafts.length; i += 1) {
                const craft = crafts[i];
                if (!craft || craft.active !== true) continue;
                if (craft.state === STATES.APPROACH || craft.state === STATES.FAILED) continue;
                if (typeof craft.isDestroyed === 'function' && craft.isDestroyed()) continue;

                const cx = Number(craft.x) || 0;
                const cy = Number(craft.y) || 0;
                let pressure = 0;

                for (let j = 0; j < game.enemies.length; j += 1) {
                    const enemy = game.enemies[j];
                    if (!enemy || enemy.dead || !enemy.stats) continue;
                    const ex = Number(enemy.x);
                    if (!Number.isFinite(ex)) continue;
                    const eyRaw = Number(enemy.y);
                    const ey = Number.isFinite(eyRaw) ? eyRaw : cy;
                    if (Math.abs(ex - cx) > radiusX) continue;
                    if (Math.abs(ey - cy) > radiusY) continue;
                    pressure += getEnemyPressureWeight(enemy, nowFrame);
                    if (pressure >= 16) break;
                }

                if (pressure <= 0) continue;
                if (typeof craft.applyDamage === 'function') {
                    craft.applyDamage(Math.min(16, pressure) * pressureDps * delta, 'enemy-fire');
                }
            }
        }

        function stopLandingAudio(resetTime) {
            pauseAudio(moveAudio, resetTime);
            pauseAudio(seaAudio, resetTime);
        }

        function safeFinish(reason) {
            finished = true;
            stopLandingAudio(true);
            if (typeof window !== 'undefined') {
                window.__RECLAIM_LANDING_INTRO_STATE__ = {
                    active: false,
                    finished: true,
                    reason: String(reason || '').trim() || 'done',
                    craftCount: crafts.length
                };
            }
        }

        function getDebugState() {
            return {
                active: !disabled && !finished,
                finished,
                disabled,
                mapId: game && game.currentMapId ? game.currentMapId : '',
                elapsedSec: Math.max(0, (Date.now() - startedAt) / 1000),
                crafts: crafts.map((c) => ({
                    id: c.id,
                    state: c.state,
                    x: Math.round(Number(c.x) || 0),
                    y: Math.round(Number(c.y) || 0),
                    hp: Math.max(0, Math.round(Number(c.hp) || 0)),
                    maxHp: Math.max(1, Math.round(Number(c.maxHp) || 1)),
                    destroyed: !!(typeof c.isDestroyed === 'function' ? c.isDestroyed() : c.destroyed === true),
                    destroyReason: c.destroyReason || '',
                    rampOpenT: Number((Number(c.rampOpenT) || 0).toFixed(3)),
                    active: c.active === true,
                    failedReason: c.failedReason || ''
                }))
            };
        }

        function update(dtSec) {
            if (disabled || finished) return;
            try {
                const dt = Math.max(0, Number(dtSec) || 0);
                for (let i = 0; i < crafts.length; i += 1) {
                    crafts[i].update(dt);
                }
                applyCraftCombatPressure(dt);
                syncLandingAudio();
                if (typeof window !== 'undefined') {
                    window.__RECLAIM_LANDING_INTRO_STATE__ = getDebugState();
                }
            } catch (err) {
                disabled = true;
                if (typeof console !== 'undefined' && console && typeof console.warn === 'function') {
                    console.warn('[LandingIntro] update failed. disable intro controller.', err);
                }
                safeFinish('exception-update');
            }
        }

        function draw(ctx) {
            if (disabled || finished || !ctx) return;
            try {
                syncLandingAudio();
                for (let i = 0; i < crafts.length; i += 1) {
                    const c = crafts[i];
                    if (c.state === STATES.FAILED && c.destroyed !== true) continue;
                    renderer.drawLandingCraft(ctx, c);
                }
            } catch (err) {
                disabled = true;
                if (typeof console !== 'undefined' && console && typeof console.warn === 'function') {
                    console.warn('[LandingIntro] draw failed. disable intro controller.', err);
                }
                safeFinish('exception-draw');
            }
        }

        function destroy() {
            disabled = true;
            safeFinish('destroy');
        }

        return {
            update,
            draw,
            isFinished() { return finished || disabled; },
            destroy,
            getDebugState
        };
    }

    global.LandingIntroController = {
        createLandingIntroController
    };
})(typeof window !== 'undefined' ? window : globalThis);
