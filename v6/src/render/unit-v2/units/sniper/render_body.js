// Body rendering for: sniper
(function attachUnitRenderV2Body_sniper(globalScope) {
    'use strict';

    function drawHead(ctx, x, y, palette, state) {
        var breath = Number(state && state.idleBreath) || 0;
        ctx.save();
        ctx.translate(x, y + breath * 0.12);

        ctx.fillStyle = palette.skin;
        ctx.beginPath();
        ctx.arc(0, 0, 4.2, 0, Math.PI * 2);
        ctx.fill();

        // Thick helmet + leafy cover to keep a camouflaged silhouette.
        ctx.fillStyle = palette.helmet;
        ctx.beginPath();
        ctx.arc(0, -1, 5.2, Math.PI, 0);
        ctx.lineTo(5.2, 1.5);
        ctx.lineTo(-5.2, 1.5);
        ctx.closePath();
        ctx.fill();

        ctx.fillStyle = palette.uniformHi;
        ctx.fillRect(-5.6, -3.8, 2.6, 1.2);
        ctx.fillRect(-2.1, -4.4, 2.4, 1.2);
        ctx.fillRect(1.3, -3.9, 2.5, 1.1);

        ctx.restore();
    }

    function drawLeg(ctx, x, hipY, thighAngle, kneeAngle, palette) {
        ctx.save();
        ctx.translate(x, hipY);
        ctx.rotate(thighAngle);

        ctx.fillStyle = palette.uniform;
        ctx.fillRect(-1.8, 0, 3.6, 8.2);

        ctx.translate(0, 8.2);
        ctx.rotate(kneeAngle);
        ctx.fillRect(-1.7, 0, 3.4, 5.4);

        ctx.fillStyle = '#11180f';
        ctx.fillRect(-3.1, 4.3, 6.2, 1.8);
        ctx.restore();
    }

    function drawArm(ctx, x, y, angle, palette) {
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(angle);

        ctx.fillStyle = palette.uniform;
        ctx.fillRect(-1.3, 0, 2.6, 7.6);
        ctx.translate(0, 7.6);
        ctx.rotate(-0.08);
        ctx.fillRect(-1.2, 0, 2.4, 6);

        ctx.restore();
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

        var leftThigh = 0.08 + legSwing;
        var rightThigh = 0.08 - legSwing;
        var leftKnee = 0.2 + Math.max(0, -stepSin) * 0.34 * kneeBlend;
        var rightKnee = 0.2 + Math.max(0, stepSin) * 0.34 * kneeBlend;

        drawLeg(ctx, -2.3, -14, leftThigh, leftKnee, palette);
        drawLeg(ctx, 2.3, -14, rightThigh, rightKnee, palette);

        ctx.save();
        ctx.translate(0, -bodyBob - idleBreath * 0.2);
        ctx.rotate(torsoLean);

        // Vest + ghillie shoulder mantle.
        ctx.fillStyle = palette.vest;
        ctx.fillRect(-5.2, -26, 10.4, 13);
        ctx.fillStyle = palette.uniformHi;
        ctx.fillRect(-6.4, -27, 12.8, 2.8);

        // Chest pouches.
        ctx.fillStyle = palette.pouch;
        ctx.fillRect(-3.8, -21.8, 2.6, 4.8);
        ctx.fillRect(-0.9, -22.2, 2.2, 4.9);
        ctx.fillRect(1.7, -21.8, 2.4, 4.8);

        // Backpack.
        ctx.fillStyle = palette.pack;
        ctx.fillRect(-9.4, -24.2, 3.8, 9.2);

        drawArm(ctx, -4.1, -23, -0.28 + armSwing * 0.7, palette);
        drawArm(ctx, 4.1, -23, 0.2 - armSwing * 0.64 + recoil * 0.05, palette);

        drawHead(ctx, 0, -29, palette, state);
        ctx.restore();
    }

    function drawCrouching(ctx, palette, state, recoil) {
        var shuffle = (Number(state.legSwing) || 0) * 0.3;
        var bob = (Number(state.bodyBob) || 0) * 0.4;
        var idleBreath = Number(state.idleBreath) || 0;

        ctx.save();
        ctx.translate(0, -bob - idleBreath * 0.2);

        ctx.fillStyle = palette.uniform;
        ctx.fillRect(-6 + shuffle, -8, 8, 5);
        ctx.fillRect(1 + shuffle * 0.4, -12, 4.2, 12);
        ctx.fillRect(-7.6 - shuffle * 0.4, -4, 7.2, 4);

        ctx.fillStyle = palette.vest;
        ctx.fillRect(-5.2, -20, 10.4, 11);
        ctx.fillStyle = palette.pouch;
        ctx.fillRect(-3.7, -17.8, 2.6, 4);
        ctx.fillRect(-0.8, -18.1, 2.1, 4.2);
        ctx.fillRect(1.6, -17.8, 2.3, 4);

        ctx.fillStyle = palette.pack;
        ctx.fillRect(-9.2, -18.5, 3.6, 8.5);

        drawArm(ctx, -3.8, -18, -0.34, palette);
        drawArm(ctx, 3.6, -18, 0.22 + recoil * 0.05, palette);
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

        // Backpack and drag bag.
        ctx.fillStyle = palette.pack;
        ctx.fillRect(-8, -12, 10, 4.5);

        ctx.strokeStyle = palette.uniformHi;
        ctx.lineWidth = 3;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(-1, -5);
        ctx.lineTo(8 + recoil * 0.45, -5);
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

    globalScope['UnitRenderV2Body_sniper'] = {
        drawBody: drawBody
    };
})(typeof window !== 'undefined' ? window : globalThis);
