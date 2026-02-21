// Body rendering for: drone_operator
(function attachUnitRenderV2Body_drone_operator(globalScope) {
    'use strict';

    function drawHead(ctx, x, y, palette, state) {
        var breath = Number(state && state.idleBreath) || 0;
        ctx.save();
        ctx.translate(x, y + breath * 0.12);

        ctx.fillStyle = palette.skin;
        ctx.beginPath();
        ctx.arc(0, 0, 4, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = palette.helmet;
        ctx.beginPath();
        ctx.arc(0, -1, 4.6, Math.PI, 0);
        ctx.lineTo(4.6, 1.4);
        ctx.lineTo(-4.6, 1.4);
        ctx.closePath();
        ctx.fill();

        ctx.restore();
    }

    function drawLeg(ctx, x, hipY, thighAngle, kneeAngle, palette) {
        ctx.save();
        ctx.translate(x, hipY);
        ctx.rotate(thighAngle);
        ctx.fillStyle = palette.uniform;
        ctx.fillRect(-1.7, 0, 3.4, 8);
        ctx.translate(0, 8);
        ctx.rotate(kneeAngle);
        ctx.fillRect(-1.6, 0, 3.2, 5);
        ctx.fillStyle = '#1a1a1a';
        ctx.fillRect(-3, 4.2, 6, 1.8);
        ctx.restore();
    }

    function drawArm(ctx, x, y, angle, palette) {
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(angle);
        ctx.fillStyle = palette.uniform;
        ctx.fillRect(-1.2, 0, 2.4, 7.5);
        ctx.translate(0, 7.5);
        ctx.rotate(-0.08);
        ctx.fillRect(-1.1, 0, 2.2, 6.2);
        ctx.restore();
    }

    function drawRadioPack(ctx, palette, stance) {
        ctx.fillStyle = palette.pack;
        if (stance === 'prone') {
            ctx.fillRect(-7.8, -12.2, 9.4, 5.1);
            ctx.strokeStyle = '#111';
            ctx.lineWidth = 1.2;
            ctx.beginPath();
            ctx.moveTo(-3.2, -12);
            ctx.lineTo(4.8, -16.6);
            ctx.stroke();
            ctx.fillStyle = '#ef4444';
            ctx.fillRect(4.2, -17.5, 1.8, 1.8);
            return;
        }

        if (stance === 'crouching') {
            ctx.fillRect(-9.7, -18.5, 5.2, 10.4);
            ctx.strokeStyle = '#111';
            ctx.lineWidth = 1.2;
            ctx.beginPath();
            ctx.moveTo(-7.4, -18.2);
            ctx.lineTo(-7.4, -28.8);
            ctx.stroke();
            ctx.fillStyle = '#ef4444';
            ctx.fillRect(-8.3, -29.8, 1.8, 1.8);
            return;
        }

        ctx.fillRect(-10, -24.2, 5.4, 11.5);
        ctx.strokeStyle = '#111';
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.moveTo(-7.6, -24);
        ctx.lineTo(-7.6, -35);
        ctx.stroke();
        ctx.fillStyle = '#ef4444';
        ctx.fillRect(-8.5, -36, 1.8, 1.8);
    }

    function drawStanding(ctx, palette, state, recoil) {
        var legSwing = Number(state.legSwing) || 0;
        var armSwing = Number(state.armSwing) || 0;
        var bodyBob = Number(state.bodyBob) || 0;
        var torsoLean = (Number(state.torsoLean) || 0) * 0.5;
        var idleBreath = Number(state.idleBreath) || 0;
        var cycle = Number(state.walkCycle) || 0;
        var stepSin = Math.sin(cycle);
        var kneeBlend = Math.min(1, Math.abs(legSwing) / 0.55);

        drawLeg(ctx, -2.3, -14, 0.08 + legSwing, 0.2 + Math.max(0, -stepSin) * 0.35 * kneeBlend, palette);
        drawLeg(ctx, 2.3, -14, 0.08 - legSwing, 0.2 + Math.max(0, stepSin) * 0.35 * kneeBlend, palette);

        ctx.save();
        ctx.translate(0, -bodyBob - idleBreath * 0.2);
        ctx.rotate(torsoLean);
        ctx.fillStyle = palette.vest;
        ctx.fillRect(-5, -26, 10, 13);
        drawRadioPack(ctx, palette, 'standing');
        drawArm(ctx, -4.2, -23, -0.25 + armSwing * 0.75, palette);
        drawArm(ctx, 4.2, -23, 0.18 - armSwing * 0.68 + recoil * 0.05, palette);
        drawHead(ctx, 0, -29, palette, state);
        ctx.restore();
    }

    function drawCrouching(ctx, palette, state, recoil) {
        var shuffle = (Number(state.legSwing) || 0) * 0.35;
        var bob = (Number(state.bodyBob) || 0) * 0.45;
        var idleBreath = Number(state.idleBreath) || 0;

        ctx.save();
        ctx.translate(0, -bob - idleBreath * 0.2);
        ctx.fillStyle = palette.uniform;
        ctx.fillRect(-6 + shuffle, -8, 8, 5);
        ctx.fillRect(1 + shuffle * 0.4, -12, 4, 12);
        ctx.fillRect(-7.5 - shuffle * 0.4, -4, 7, 4);
        ctx.fillStyle = palette.vest;
        ctx.fillRect(-5, -20, 10, 11);
        drawRadioPack(ctx, palette, 'crouching');
        drawArm(ctx, -3.8, -18, -0.32, palette);
        drawArm(ctx, 3.6, -18, 0.22 + recoil * 0.04, palette);
        drawHead(ctx, 0, -23, palette, state);
        ctx.restore();
    }

    function drawProne(ctx, palette, state, recoil) {
        var breath = Number(state.idleBreath) || 0;
        ctx.save();
        ctx.translate(0, -breath * 0.3);
        ctx.fillStyle = palette.uniform;
        ctx.fillRect(-24, -5, 13, 4);
        ctx.fillStyle = palette.vest;
        ctx.fillRect(-11, -8, 14, 7);
        drawRadioPack(ctx, palette, 'prone');
        ctx.strokeStyle = palette.uniform;
        ctx.lineWidth = 3;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(-1, -5);
        ctx.lineTo(8 + recoil * 0.5, -5);
        ctx.stroke();
        drawHead(ctx, 5, -10, palette, state);
        ctx.restore();
    }

    function drawBody(unit, ctx, state, palette) {
        if (!ctx || !state || !palette) return;
        var stance = state.stance || 'standing';
        var recoil = Number(state.recoil) || 0;

        if (stance === 'prone') drawProne(ctx, palette, state, recoil);
        else if (stance === 'crouching') drawCrouching(ctx, palette, state, recoil);
        else drawStanding(ctx, palette, state, recoil);
    }

    globalScope['UnitRenderV2Body_drone_operator'] = {
        drawBody: drawBody
    };
})(typeof window !== 'undefined' ? window : globalThis);
