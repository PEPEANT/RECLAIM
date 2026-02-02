(function () {
    const clamp = (value, min, max) => Math.max(min, Math.min(value, max));

    const Camera = {
        zoom: 1.0,
        MIN: 0.5,
        MAX: 1.5,
        STEP: 0.1,

        viewW(game) {
            return game.width / this.zoom;
        },

        clampCameraX(game, x) {
            const maxX = Math.max(0, CONFIG.mapWidth - this.viewW(game));
            return clamp(x, 0, maxX);
        },

        preserveCenterOnResize(game, prevViewW) {
            const centerX = game.cameraX + prevViewW / 2;
            const newViewW = this.viewW(game);
            game.cameraX = this.clampCameraX(game, centerX - newViewW / 2);
        },

        screenToView(game, clientX, clientY) {
            const wrapper = document.getElementById('game-wrapper');
            const rect = wrapper.getBoundingClientRect();
            const sx = (clientX - rect.left) / game.scaleRatio;
            const sy = (clientY - rect.top) / game.scaleRatio;
            const viewX = sx / this.zoom;
            const viewY = game.groundY + (sy - game.groundY) / this.zoom;
            return { x: viewX, y: viewY };
        },

        applyZoomWithAnchor(game, newZoom, anchorClientX, anchorClientY) {
            const nextZoom = clamp(newZoom, this.MIN, this.MAX);
            if (Math.abs(nextZoom - this.zoom) < 0.0001) return;

            const prevView = this.screenToView(game, anchorClientX, anchorClientY);
            const anchorWorldX = prevView.x + game.cameraX;

            this.zoom = nextZoom;

            const nextView = this.screenToView(game, anchorClientX, anchorClientY);
            game.cameraX = this.clampCameraX(game, anchorWorldX - nextView.x);
        }
    };

    window.Camera = Camera;
})();
