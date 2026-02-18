(function () {
    const targetGame = (typeof window !== 'undefined' && window.game)
        ? window.game
        : ((typeof game !== 'undefined') ? game : null);
    if (!targetGame) return;
    if (typeof window !== 'undefined' && !window.game) {
        window.game = targetGame;
    }

    Object.assign(window.game, {
        drawHUDMinimap() {
            const cvs = document.getElementById('hud-minimap');
            if (!cvs) return;
            const ctx = cvs.getContext('2d');
            if (cvs.width !== cvs.clientWidth) { cvs.width = cvs.clientWidth; cvs.height = cvs.clientHeight; }

            ctx.fillStyle = '#0f172a'; ctx.fillRect(0, 0, cvs.width, cvs.height);
            const scale = cvs.width / CONFIG.mapWidth;
            const groundY = cvs.height * 0.7;

            ctx.strokeStyle = '#334155'; ctx.lineWidth = 1;
            ctx.beginPath(); ctx.moveTo(0, groundY); ctx.lineTo(cvs.width, groundY); ctx.stroke();

            this.buildings.forEach(b => {
                ctx.fillStyle = b.team === 'player' ? '#3b82f6' : (b.team === 'enemy' ? '#ef4444' : '#eab308');
                const w = Math.max(2, b.width * scale);
                const h = Math.max(2, b.height * scale);
                ctx.fillRect(b.x * scale - w / 2, groundY - h, w, h);
            });

            ctx.fillStyle = '#60a5fa'; this.players.forEach(u => ctx.fillRect(u.x * scale, groundY - 2, 2, 2));
            ctx.fillStyle = '#f87171'; this.enemies.forEach(u => ctx.fillRect(u.x * scale, groundY - 2, 2, 2));

            const cw = (Camera.viewW(this) / CONFIG.mapWidth) * cvs.width;
            const cx = (this.cameraX / CONFIG.mapWidth) * cvs.width;
            ctx.strokeStyle = '#fbbf24'; ctx.lineWidth = 1; ctx.strokeRect(cx, 0, cw, cvs.height);
        }
    });
})();
