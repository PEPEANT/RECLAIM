(function (global) {
    'use strict';

    if (!global || !global.MapRegistry) return;

    function drawLuxuryApartment(ctx, x, groundY, scale = 1) {
        const s = scale;
        const w = 100 * s;
        const h = 150 * s;
        const left = x - w / 2;
        const top = groundY - h;
        const px = (v) => left + v * s;
        const py = (v) => top + v * s;

        ctx.save();
        ctx.fillStyle = '#718096';
        ctx.strokeStyle = '#2d3748';
        ctx.lineWidth = Math.max(1, 2 * s);
        ctx.fillRect(left, top, w, h);
        ctx.strokeRect(left, top, w, h);

        ctx.strokeStyle = '#4a5568';
        ctx.lineWidth = Math.max(1, 1 * s);
        [37, 74, 111].forEach(y => {
            ctx.beginPath();
            ctx.moveTo(left, py(y));
            ctx.lineTo(left + w, py(y));
            ctx.stroke();
        });

        const winW = 20 * s;
        const winH = 15 * s;
        const winXs = [10, 40, 70];
        const winYs = [10, 47, 84];
        ctx.fillStyle = '#bee3f8';
        ctx.strokeStyle = '#2d3748';
        winYs.forEach(y => {
            winXs.forEach(xw => {
                ctx.fillRect(px(xw), py(y), winW, winH);
                ctx.strokeRect(px(xw), py(y), winW, winH);
            });
        });

        ctx.fillStyle = '#a0aec0';
        ctx.fillRect(px(42), py(50), 16 * s, 10 * s);

        ctx.fillStyle = '#4a5568';
        ctx.fillRect(px(20), py(-10), 20 * s, 10 * s);

        ctx.strokeStyle = '#a0aec0';
        ctx.lineWidth = Math.max(1, 1 * s);
        ctx.beginPath();
        ctx.moveTo(px(80), py(0));
        ctx.lineTo(px(80), py(-20));
        ctx.stroke();
        ctx.fillStyle = '#f56565';
        ctx.beginPath();
        ctx.arc(px(80), py(-20), 2 * s, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = '#2c3e50';
        ctx.fillRect(px(35), py(130), 30 * s, 20 * s);
        ctx.restore();
    }

    function drawLegacyApartment(ctx, x, groundY, scale = 1) {
        const s = scale;
        const w = 80 * s;
        const h = 150 * s;
        const left = x - w / 2;
        const top = groundY - h;
        const px = (v) => left + v * s;
        const py = (v) => top + v * s;

        ctx.save();
        ctx.fillStyle = '#718096';
        ctx.strokeStyle = '#2d3748';
        ctx.lineWidth = Math.max(1, 2 * s);
        ctx.fillRect(left, top, w, h);
        ctx.strokeRect(left, top, w, h);

        const winW = 16 * s;
        const winH = 16 * s;
        const winXs = [8, 32, 56];
        const winYs = [15, 45, 75, 105];
        ctx.fillStyle = '#bee3f8';
        winYs.forEach(y => {
            winXs.forEach(xw => {
                ctx.fillRect(px(xw), py(y), winW, winH);
            });
        });

        ctx.fillStyle = '#2c3e50';
        ctx.fillRect(px(30), py(130), 20 * s, 20 * s);
        ctx.restore();
    }

    function drawDestroyedLuxuryApartment(ctx, x, groundY, scale = 1) {
        const s = scale;
        const left = x - 60 * s;
        const px = (v) => left + v * s;
        const py = (v) => groundY + v * s;

        ctx.save();
        ctx.fillStyle = '#4a5568';
        ctx.strokeStyle = '#2d3748';
        ctx.lineWidth = Math.max(1, 2 * s);
        ctx.beginPath();
        ctx.moveTo(px(0), py(0));
        ctx.lineTo(px(0), py(-110));
        ctx.lineTo(px(20), py(-130));
        ctx.lineTo(px(60), py(-115));
        ctx.lineTo(px(100), py(-150));
        ctx.lineTo(px(100), py(0));
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        ctx.strokeStyle = '#1a202c';
        ctx.lineWidth = Math.max(1, 2 * s);
        ctx.beginPath();
        ctx.moveTo(px(10), py(-80));
        ctx.lineTo(px(35), py(-65));
        ctx.lineTo(px(20), py(-30));
        ctx.stroke();

        ctx.fillStyle = '#1a202c';
        ctx.fillRect(px(10), py(-100), 20 * s, 15 * s);
        ctx.fillRect(px(50), py(-80), 15 * s, 12 * s);

        ctx.fillStyle = '#2d3748';
        ctx.save();
        ctx.translate(px(85), py(-5));
        ctx.rotate(Math.PI / 8);
        ctx.fillRect(0, 0, 10 * s, 8 * s);
        ctx.restore();

        ctx.save();
        ctx.translate(px(15), py(-15));
        ctx.rotate(-Math.PI / 12);
        ctx.fillRect(0, 0, 12 * s, 6 * s);
        ctx.restore();
        ctx.restore();
    }

    function drawDestroyedLegacyApartment(ctx, x, groundY, scale = 1) {
        const s = scale;
        const left = x - 50 * s;
        const px = (v) => left + v * s;
        const py = (v) => groundY + v * s;

        ctx.save();
        ctx.fillStyle = '#4a5568';
        ctx.strokeStyle = '#2d3748';
        ctx.lineWidth = Math.max(1, 2 * s);
        ctx.beginPath();
        ctx.moveTo(px(0), py(0));
        ctx.lineTo(px(0), py(-90));
        ctx.lineTo(px(15), py(-105));
        ctx.lineTo(px(50), py(-95));
        ctx.lineTo(px(80), py(-125));
        ctx.lineTo(px(80), py(0));
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        ctx.strokeStyle = '#1a202c';
        ctx.lineWidth = Math.max(1, 1.5 * s);
        ctx.beginPath();
        ctx.moveTo(px(10), py(-70));
        ctx.lineTo(px(30), py(-55));
        ctx.lineTo(px(25), py(-20));
        ctx.stroke();

        ctx.fillStyle = '#2d3748';
        ctx.fillRect(px(8), py(-80), 15 * s, 12 * s);

        ctx.fillStyle = '#4a5568';
        ctx.save();
        ctx.translate(px(-5), py(-5));
        ctx.rotate(Math.PI / 10);
        ctx.fillRect(0, 0, 10 * s, 5 * s);
        ctx.restore();

        ctx.save();
        ctx.translate(px(70), py(-10));
        ctx.rotate(-Math.PI / 15);
        ctx.fillRect(0, 0, 12 * s, 6 * s);
        ctx.restore();
        ctx.restore();
    }

    const extend = (typeof global.MapRegistry.extendMapDefinition === 'function')
        ? global.MapRegistry.extendMapDefinition
        : null;

    if (extend) {
        extend('city', {
            hooks: {
                drawLuxuryApartment,
                drawLegacyApartment,
                drawDestroyedLuxuryApartment,
                drawDestroyedLegacyApartment
            }
        });
        return;
    }

    if (typeof global.MapRegistry.registerMapDefinition === 'function') {
        global.MapRegistry.registerMapDefinition({
            id: 'city',
            hooks: {
                drawLuxuryApartment,
                drawLegacyApartment,
                drawDestroyedLuxuryApartment,
                drawDestroyedLegacyApartment
            }
        });
    }
})(typeof window !== 'undefined' ? window : globalThis);
