(function (global) {
    'use strict';

    function clamp01(v) {
        if (v <= 0) return 0;
        if (v >= 1) return 1;
        return v;
    }

    function drawLandingCraft(ctx, craft) {
        if (!ctx || !craft) return;
        if (craft.active !== true) return;

        const x = Number(craft.x) || 0;
        const y = Number(craft.y) || 0;
        const rampOpenT = clamp01(Number(craft.rampOpenT) || 0);
        const scale = Math.max(0.4, Number(craft.scale) || 1);
        const rampTopY = -46 + (38 * rampOpenT);

        ctx.save();
        ctx.translate(x, y);
        ctx.scale(scale, scale);

        ctx.fillStyle = '#4e5860';
        ctx.beginPath();
        ctx.moveTo(-120, -28);
        ctx.lineTo(95, -28);
        ctx.lineTo(118, -4);
        ctx.lineTo(98, 20);
        ctx.lineTo(-102, 20);
        ctx.closePath();
        ctx.fill();

        ctx.fillStyle = '#5f6870';
        ctx.fillRect(-118, -70, 40, 42);

        ctx.fillStyle = '#2c3238';
        ctx.fillRect(-102, -58, 12, 4);

        ctx.strokeStyle = '#3f474e';
        ctx.lineWidth = 1.8;
        for (let i = -95; i <= 85; i += 22) {
            ctx.beginPath();
            ctx.moveTo(i, -26);
            ctx.lineTo(i, 15);
            ctx.stroke();
        }

        ctx.fillStyle = '#707980';
        ctx.beginPath();
        ctx.moveTo(96, -28);
        ctx.lineTo(132, rampTopY);
        ctx.lineTo(135, rampTopY + 5);
        ctx.lineTo(115, -3);
        ctx.closePath();
        ctx.fill();

        ctx.strokeStyle = '#2f363c';
        ctx.lineWidth = 1.6;
        ctx.beginPath();
        ctx.moveTo(64, -24);
        ctx.lineTo(127, rampTopY + 2);
        ctx.stroke();

        const hpMax = Math.max(0, Number(craft.maxHp) || 0);
        if (hpMax > 0) {
            const hp = Math.max(0, Number(craft.hp) || 0);
            const hpRatio = clamp01(hp / hpMax);
            const barX = -116;
            const barY = -86;
            const barW = 216;
            const barH = 7;
            ctx.fillStyle = 'rgba(15,23,42,0.92)';
            ctx.fillRect(barX, barY, barW, barH);
            ctx.fillStyle = hpRatio > 0.6 ? '#22c55e' : (hpRatio > 0.32 ? '#f59e0b' : '#ef4444');
            ctx.fillRect(barX, barY, barW * hpRatio, barH);
            ctx.strokeStyle = 'rgba(148,163,184,0.7)';
            ctx.lineWidth = 1;
            ctx.strokeRect(barX + 0.5, barY + 0.5, barW - 1, barH - 1);
        }

        ctx.restore();
    }

    global.LandingCraftRenderer = {
        drawLandingCraft
    };
})(typeof window !== 'undefined' ? window : globalThis);
