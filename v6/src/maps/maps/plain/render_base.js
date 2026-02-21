(function (global) {
    'use strict';

    if (!global || !global.MapRegistry) return;

    function hash01(seed) {
        let h = 2166136261;
        const s = String(seed);
        for (let i = 0; i < s.length; i++) {
            h ^= s.charCodeAt(i);
            h = Math.imul(h, 16777619);
        }
        return ((h >>> 0) / 4294967295);
    }

    function rand01(seed, maps) {
        if (maps && typeof maps._rand === 'function') return maps._rand(seed);
        return hash01(seed);
    }

    function renderBase(ctx, env) {
        const maps = env && env.maps;
        if (!ctx || !maps) return false;

        const width = Math.max(1, Number(env.width) || 1);
        const height = Math.max(1, Number(env.height) || 1);
        const groundY = Math.max(0, Number(env.groundY) || 0);
        const cameraX = Number(env.cameraX) || 0;

        const skyGrad = ctx.createLinearGradient(0, 0, 0, groundY);
        skyGrad.addColorStop(0, '#8ecff1');
        skyGrad.addColorStop(0.62, '#c7e9ff');
        skyGrad.addColorStop(1, '#d8eeb9');
        ctx.fillStyle = skyGrad;
        ctx.fillRect(0, 0, width, groundY);

        const groundGrad = ctx.createLinearGradient(0, groundY, 0, height);
        groundGrad.addColorStop(0, '#73b95f');
        groundGrad.addColorStop(1, '#4f8f43');
        ctx.fillStyle = groundGrad;
        ctx.fillRect(0, groundY, width, height - groundY);

        ctx.fillStyle = 'rgba(225, 255, 205, 0.18)';
        ctx.fillRect(0, groundY, width, 2);

        // Tile-based grass texture using short diagonal blades (no circular blobs).
        const tileSize = 84;
        const tileStart = Math.floor((cameraX - 100) / tileSize) * tileSize;
        const tileEnd = cameraX + width + 100;
        const rows = Math.max(2, Math.floor((height - groundY) / tileSize));

        for (let wx = tileStart; wx <= tileEnd; wx += tileSize) {
            for (let row = 0; row < rows; row++) {
                const baseX = wx - cameraX;
                const baseY = groundY + row * tileSize;
                const seed = `plain.tile.${wx}.${row}`;
                const tone = rand01(`${seed}.tone`, maps);
                if (tone > 0.56) {
                    ctx.fillStyle = 'rgba(176, 220, 132, 0.060)';
                    ctx.fillRect(baseX, baseY, tileSize, tileSize);
                } else if (tone < 0.22) {
                    ctx.fillStyle = 'rgba(42, 92, 37, 0.060)';
                    ctx.fillRect(baseX, baseY, tileSize, tileSize);
                }

                const density = 2 + Math.floor(rand01(`${seed}.n`, maps) * 4); // 2~5

                for (let i = 0; i < density; i++) {
                    const px = baseX + 5 + rand01(`${seed}.x.${i}`, maps) * (tileSize - 10);
                    const py = baseY + 5 + rand01(`${seed}.y.${i}`, maps) * (tileSize - 10);
                    const bladeLen = 4 + Math.floor(rand01(`${seed}.h.${i}`, maps) * 6);
                    const lean = (rand01(`${seed}.lean.${i}`, maps) - 0.5) * 2.2;

                    // Fill-based tuft to avoid "outline-only" look.
                    ctx.fillStyle = `rgba(30, 86, 28, ${(0.14 + rand01(`${seed}.a.${i}`, maps) * 0.10).toFixed(3)})`;
                    ctx.fillRect(px, py, 1, bladeLen);
                    ctx.fillRect(px + 1 + lean * 0.35, py + 1, 1, Math.max(2, bladeLen - 1));

                    if (rand01(`${seed}.sub.${i}`, maps) < 0.5) {
                        const bladeLen2 = Math.max(2, bladeLen - 2);
                        ctx.fillStyle = 'rgba(171, 221, 126, 0.14)';
                        ctx.fillRect(px + 1, py, 1, bladeLen2);
                    }
                }

                const propChance = rand01(`${seed}.prop`, maps);
                if (row > 0 && propChance > 0.965) {
                    ctx.fillStyle = 'rgba(255, 235, 59, 0.65)';
                    ctx.fillRect(baseX + 10 + rand01(`${seed}.fx`, maps) * (tileSize - 20), baseY + 10 + rand01(`${seed}.fy`, maps) * (tileSize - 20), 2, 2);
                } else if (row > 0 && propChance < 0.02) {
                    ctx.fillStyle = 'rgba(120, 120, 120, 0.45)';
                    ctx.fillRect(baseX + 10 + rand01(`${seed}.rx`, maps) * (tileSize - 20), baseY + 10 + rand01(`${seed}.ry`, maps) * (tileSize - 20), 2, 2);
                }
            }
        }

        return true;
    }

    const extend = (typeof global.MapRegistry.extendMapDefinition === 'function')
        ? global.MapRegistry.extendMapDefinition
        : null;

    if (extend) {
        extend('plain', { hooks: { renderBase } });
        extend('skirmish', { hooks: { renderBase } });
        return;
    }

    if (typeof global.MapRegistry.registerMapDefinition === 'function') {
        global.MapRegistry.registerMapDefinition({
            id: 'plain',
            hooks: { renderBase }
        });
    }
})(typeof window !== 'undefined' ? window : globalThis);
