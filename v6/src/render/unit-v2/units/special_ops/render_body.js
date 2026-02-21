// Body rendering for: special_ops
(function attachUnitRenderV2Body_special_ops(globalScope) {
    'use strict';

    function drawHead(ctx, x, y, palette, state) {
        var breath = Number(state && state.idleBreath) || 0;
        ctx.save();
        ctx.translate(x, y + breath * 0.12);

        ctx.fillStyle = palette.skin;
        ctx.beginPath();
        ctx.arc(0, 0, 4.2, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = palette.helmet;
        ctx.beginPath();
        ctx.arc(0, -1, 5.1, Math.PI, 0);
        ctx.lineTo(5.1, 1.5);
        ctx.lineTo(-5.1, 1.5);
        ctx.closePath();
        ctx.fill();

        // Dark visor + NVG glow for special-ops flavor.
        ctx.fillStyle = '#0a130c';
        ctx.fillRect(-3.2, -1.2, 6.4, 2.1);
        ctx.fillStyle = palette.nvgGlow;
        ctx.fillRect(3.1, -1.1, 1.5, 1.2);

        ctx.restore();
    }

    function drawLeg(ctx, x, hipY, thighAngle, kneeAngle, palette) {
        ctx.save();
        ctx.translate(x, hipY);
        ctx.rotate(thighAngle);

        ctx.fillStyle = palette.uniform;
        ctx.fillRect(-1.8, 0, 3.6, 8.1);

        ctx.translate(0, 8.1);
        ctx.rotate(kneeAngle);
        ctx.fillRect(-1.6, 0, 3.2, 5.2);

        ctx.fillStyle = '#09120a';
        ctx.fillRect(-3.1, 4.2, 6.2, 1.8);
        ctx.restore();
    }

    function drawArm(ctx, x, y, angle, palette) {
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(angle);
        ctx.fillStyle = palette.uniform;
        ctx.fillRect(-1.3, 0, 2.6, 7.2);
        ctx.translate(0, 7.2);
        ctx.rotate(-0.08);
        ctx.fillRect(-1.2, 0, 2.4, 5.8);
        ctx.restore();
    }

    function drawGripToWeapon(ctx, palette, state, recoil) {
        var bobX = Number(state.weaponBobX) || 0;
        var bobY = Number(state.weaponBobY) || 0;
        var sway = Number(state.weaponSway) || 0;

        var baseX = 3 - (Number(recoil) || 0) * 0.4 + bobX;
        var baseY = -20 - bobY;
        var ang = -0.04 + sway * 0.75;

        var supportX = baseX + Math.cos(ang) * 6.3;
        var supportY = baseY + Math.sin(ang) * 6.3;
        var gripX = baseX + Math.cos(ang) * 4.0;
        var gripY = baseY + Math.sin(ang) * 4.0;

        ctx.strokeStyle = palette.uniform;
        ctx.lineWidth = 2.4;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(-4.2, -23);
        ctx.lineTo(supportX, supportY);
        ctx.moveTo(4.2, -23);
        ctx.lineTo(gripX, gripY);
        ctx.stroke();

        ctx.fillStyle = palette.skin || '#d9b08c';
        ctx.beginPath();
        ctx.arc(supportX, supportY, 1.2, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(gripX, gripY, 1.2, 0, Math.PI * 2);
        ctx.fill();
    }

    function drawStanding(ctx, palette, state, recoil) {
        var legSwing = Number(state.legSwing) || 0;
        var armSwing = Number(state.armSwing) || 0;
        var bodyBob = Number(state.bodyBob) || 0;
        var torsoLean = (Number(state.torsoLean) || 0) * 0.55;
        var idleBreath = Number(state.idleBreath) || 0;
        var cycle = Number(state.walkCycle) || 0;
        var stepSin = Math.sin(cycle);
        var kneeBlend = Math.min(1, Math.abs(legSwing) / 0.55);

        var leftThigh = legSwing;
        var rightThigh = -legSwing;
        var leftKnee = 0.18 + Math.max(0, -stepSin) * 0.33 * kneeBlend;
        var rightKnee = 0.18 + Math.max(0, stepSin) * 0.33 * kneeBlend;

        drawLeg(ctx, -2.3, -14, leftThigh, leftKnee, palette);
        drawLeg(ctx, 2.3, -14, rightThigh, rightKnee, palette);

        ctx.save();
        ctx.translate(0, -bodyBob - idleBreath * 0.2);
        ctx.rotate(torsoLean);

        // Heavier armored vest
        ctx.fillStyle = palette.vest;
        ctx.fillRect(-5.2, -26, 10.4, 13);
        ctx.fillStyle = palette.armor;
        ctx.fillRect(-5.7, -24.8, 11.4, 7.8);
        ctx.fillStyle = palette.pouch;
        ctx.fillRect(-4.1, -22.2, 2.5, 4.9);
        ctx.fillRect(-1.1, -22.2, 2.2, 4.9);
        ctx.fillRect(1.6, -22.2, 2.5, 4.9);

        // Tactical backpack + antenna.
        ctx.fillStyle = palette.pack;
        ctx.fillRect(-9.5, -24.5, 4, 9.4);
        ctx.strokeStyle = '#0f1d12';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(-8.2, -24.5);
        ctx.lineTo(-8.2, -30.2);
        ctx.stroke();

        drawArm(ctx, -4.2, -23, -0.26 + armSwing * 0.78, palette);
        drawArm(ctx, 4.2, -23, 0.18 - armSwing * 0.68 + recoil * 0.05, palette);
        drawGripToWeapon(ctx, palette, state, recoil);

        drawHead(ctx, 0, -29, palette, state);
        ctx.restore();
    }

    function drawCrouching(ctx, palette, state, recoil) {
        var shuffle = (Number(state.legSwing) || 0) * 0.32;
        var bob = (Number(state.bodyBob) || 0) * 0.42;
        var idleBreath = Number(state.idleBreath) || 0;

        ctx.save();
        ctx.translate(0, -bob - idleBreath * 0.2);

        ctx.fillStyle = palette.uniform;
        ctx.fillRect(-6 + shuffle, -8, 8, 5);
        ctx.fillRect(1 + shuffle * 0.4, -12, 4, 12);
        ctx.fillRect(-7.4 - shuffle * 0.4, -4, 7, 4);

        ctx.fillStyle = palette.vest;
        ctx.fillRect(-5.2, -20, 10.4, 11);
        ctx.fillStyle = palette.armor;
        ctx.fillRect(-5.4, -19.4, 10.8, 6.6);
        ctx.fillStyle = palette.pouch;
        ctx.fillRect(-3.8, -17.8, 2.4, 4.1);
        ctx.fillRect(-0.9, -17.8, 2.1, 4.1);
        ctx.fillRect(1.7, -17.8, 2.4, 4.1);

        ctx.fillStyle = palette.pack;
        ctx.fillRect(-9.2, -18.5, 3.8, 8.7);

        drawArm(ctx, -3.8, -18, -0.32, palette);
        drawArm(ctx, 3.7, -18, 0.24 + recoil * 0.05, palette);
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
        ctx.fillStyle = palette.armor;
        ctx.fillRect(-8.5, -9.4, 9.5, 2.7);

        ctx.fillStyle = palette.pack;
        ctx.fillRect(-7.6, -12.4, 9.2, 4.7);

        ctx.strokeStyle = palette.uniformHi;
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

    globalScope['UnitRenderV2Body_special_ops'] = {
        drawBody: drawBody
    };
})(typeof window !== 'undefined' ? window : globalThis);
