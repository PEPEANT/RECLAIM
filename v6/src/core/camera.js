(function () {
    const clamp = (value, min, max) => Math.max(min, Math.min(value, max));

    const Camera = {
        zoom: 1.0,
        MIN: 0.5,
        MAX: 2.0,  // [FIX] 紐⑤컮??以뚯씤 ?덉슜 ?뺣?
        STEP: 0.1,
        userZoomed: false,  // [NEW] ?ъ슜???섎룞 以??щ?

        getEffectiveMinZoom(game) {
            // Keep zoom-out from entering the extreme far range where framing feels empty.
            const softFloor = 0.6;
            return Math.max(this.MIN, softFloor);
        },

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
            const pivotRaw = (game && typeof game.getCameraPivotY === 'function')
                ? Number(game.getCameraPivotY())
                : Number(game.groundY);
            const pivotY = Number.isFinite(pivotRaw) ? pivotRaw : Number(game.groundY || 0);
            const viewY = pivotY + (sy - pivotY) / this.zoom;
            return { x: viewX, y: viewY };
        },

        applyZoomWithAnchor(game, newZoom, anchorClientX, anchorClientY) {
            const minZoom = this.getEffectiveMinZoom(game);
            const nextZoom = clamp(newZoom, minZoom, this.MAX);
            if (Math.abs(nextZoom - this.zoom) < 0.0001) return;
            this.userZoomed = true;  // [NEW] ?ъ슜?먭? 以뚰뻽?쇰㈃ ?먮룞以?諛⑹?

            const prevView = this.screenToView(game, anchorClientX, anchorClientY);
            const anchorWorldX = prevView.x + game.cameraX;

            this.zoom = nextZoom;

            const nextView = this.screenToView(game, anchorClientX, anchorClientY);
            game.cameraX = this.clampCameraX(game, anchorWorldX - nextView.x);
        }
    };

    window.Camera = Camera;
})();


