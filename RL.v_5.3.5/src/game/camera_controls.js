// src/game/camera_controls.js - Camera and view helpers
(function () {
    'use strict';

    window.GameCamera = {
        updateZoomUI(game) {
            if (!game) return;
            const el = document.getElementById('hud-zoom-text');
            if (el) el.textContent = `${Math.round(Camera.zoom * 100)}%`;
            // [NEW] Update fixed HUD zoom display
            if (typeof HUD !== 'undefined') HUD.updateZoomDisplay();
        },

        zoomIn(game) {
            if (!game) return;
            const wrapper = document.getElementById('game-wrapper');
            if (!wrapper) return;
            const rect = wrapper.getBoundingClientRect();
            const prevZoom = Camera.zoom;
            const newZoom = Camera.zoom + Camera.STEP;
            Camera.applyZoomWithAnchor(game, newZoom, rect.left + rect.width / 2, rect.top + rect.height / 2);
            if (Camera.zoom !== prevZoom) this.updateZoomUI(game);
        },

        zoomOut(game) {
            if (!game) return;
            const wrapper = document.getElementById('game-wrapper');
            if (!wrapper) return;
            const rect = wrapper.getBoundingClientRect();
            const prevZoom = Camera.zoom;
            const newZoom = Camera.zoom - Camera.STEP;
            Camera.applyZoomWithAnchor(game, newZoom, rect.left + rect.width / 2, rect.top + rect.height / 2);
            if (Camera.zoom !== prevZoom) this.updateZoomUI(game);
        },

        getPrimarySelectedUnit(game) {
            if (!game || !game.selectedUnits || game.selectedUnits.size === 0) return null;
            for (const u of game.selectedUnits) {
                if (u && !u.dead) return u;
            }
            return null;
        },

        isCameraLocked(game) {
            if (!game) return false;
            return !!game.cameraLockActive;
        },

        toggleCameraLock(game) {
            if (!game) return;
            if (game.cameraLockActive) {
                game.cameraLockActive = false;
                game.cameraLockTarget = null;
                return;
            }

            const target = this.getPrimarySelectedUnit(game);
            if (!target) {
                if (typeof ui !== 'undefined' && typeof ui.showToast === 'function') {
                    ui.showToast('유닛을 먼저 선택하세요');
                }
                return;
            }

            game.cameraLockActive = true;
            game.cameraLockTarget = target;
        },

        applyCameraLock(game) {
            if (!game || !game.cameraLockActive) return;

            let target = game.cameraLockTarget;
            if (!target || target.dead) {
                target = this.getPrimarySelectedUnit(game);
                game.cameraLockTarget = target;
            } else if (game.selectedUnits && game.selectedUnits.size > 0 && !game.selectedUnits.has(target)) {
                const nextTarget = this.getPrimarySelectedUnit(game);
                if (nextTarget) game.cameraLockTarget = nextTarget;
                target = game.cameraLockTarget;
            }

            if (!target) {
                game.cameraLockActive = false;
                return;
            }

            const viewW = (typeof Camera !== 'undefined' && Camera.viewW) ? Camera.viewW(game) : game.width;
            game.cameraX = (target.x || 0) - viewW / 2;
            if (typeof Camera !== 'undefined' && Camera.clampCameraX) {
                game.cameraX = Camera.clampCameraX(game, game.cameraX);
            } else {
                game.cameraX = Math.max(0, Math.min(game.cameraX, CONFIG.mapWidth - game.width));
            }
        }
    };
})();
