// src/game/news.js - battle news utilities
(function () {
    'use strict';

    function ensureCameraman(game) {
        if (!game || game.cameramanDisabled) return;
        if (typeof game.getActiveCameraman !== 'function') return;
        if (game.getActiveCameraman()) return;

        const spawnX = (typeof CONFIG !== 'undefined' && Number.isFinite(Number(CONFIG.mapWidth)))
            ? Number(CONFIG.mapWidth) * 0.5
            : 3000;

        if (typeof game.spawnCameramanUnit === 'function') {
            game.spawnCameramanUnit(spawnX, game.groundY);
        }
    }

    function showNews(preset, durationMs, onDone) {
        if (typeof NewsOverlay === 'undefined' || !NewsOverlay || typeof NewsOverlay.setCustomText !== 'function') {
            if (typeof onDone === 'function') onDone();
            return;
        }

        const beginOverlay = () => {
            NewsOverlay.setCustomText(preset || {});
            if (typeof NewsOverlay.show === 'function') {
                NewsOverlay.show(durationMs);
            }
            if (typeof onDone === 'function') onDone();
        };

        const skipIntro = !!(preset && preset.skipIntro === true);
        if (!skipIntro && typeof NewsIntro !== 'undefined' && NewsIntro && typeof NewsIntro.show === 'function') {
            NewsIntro.show(3000, beginOverlay);
        } else {
            beginOverlay();
        }
    }

    function scheduleNewsEnd(game, durationMs) {
        setTimeout(() => {
            if (typeof NewsOverlay !== 'undefined' && NewsOverlay && typeof NewsOverlay.clearCustomText === 'function') {
                NewsOverlay.clearCustomText();
            }
            if (game) game.newsCameraX = null;
        }, Math.max(1000, Number(durationMs) || 0) + 400);
    }

    window.GameNews = {
        presets: [
            {
                lockLocation: true,
                location: 'FORWARD LINE | LIVE',
                title: 'URGENT',
                headline: '[BREAKING] Heavy crossfire reported on the front line.',
                ticker: 'Field unit reports incoming armor movement.'
            },
            {
                lockLocation: true,
                location: 'TACTICAL HQ | LIVE',
                title: 'COMMAND BRIEF',
                headline: '[ALERT] Reinforcement request approved for sector defense.',
                ticker: 'Maintain formation and hold the line.'
            },
            {
                lockLocation: true,
                skipIntro: true,
                location: 'WAR ROOM | LIVE',
                title: 'UPDATE',
                headline: '[NOTICE] Civilian evacuation route has been opened.',
                ticker: 'Units should avoid crossfire near evacuation corridors.'
            }
        ],

        update(game) {
            if (!game) return;
            ensureCameraman(game);
        },

        playManualNews(game) {
            if (!game) return;
            const list = Array.isArray(this.presets) ? this.presets : [];
            if (!list.length) return;
            const preset = list[Math.floor(Math.random() * list.length)];
            showNews(preset, 9000, () => scheduleNewsEnd(game, 9000));
        }
    };
})();