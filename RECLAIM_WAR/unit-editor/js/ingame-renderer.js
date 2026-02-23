/**
 * INGAME-RENDERER.JS
 * Renders units exactly as they appear in-game (hardcoded draw logic)
 * Extracted from classes.js Unit.draw() method
 */

const IngameRenderer = {
    /**
     * Draw unit using in-game hardcoded rendering
     * @param {CanvasRenderingContext2D} ctx
     * @param {string} unitId - Unit type ID
     * @param {Object} options - { team, facing, rotorAngle, mode }
     */
    draw(ctx, unitId, options = {}) {
        const team = options.team || 'player';
        const facing = options.facing || 1;
        const rotorAngle = options.rotorAngle || 0;
        const mode = options.mode || null;
        const snapToGround = options.snapToGround !== false;

        ctx.save();

        if (snapToGround && this.shouldSnapFeet(unitId)) {
            const feetY = this.getFeetY(unitId);
            if (Number.isFinite(feetY) && feetY !== 0) {
                ctx.translate(0, -feetY);
            }
        }

        // Apply facing (except drone_at)
        if (unitId !== 'drone_at') {
            ctx.scale(facing, 1);
        }

        // Team color
        const teamColor = team === 'player' ? '#3b82f6' : '#ef4444';

        // Draw unit based on ID
        switch (unitId) {
            case 'worker':
                this.drawWorker(ctx, teamColor);
                break;
            case 'infantry':
                this.drawInfantry(ctx, teamColor);
                break;
            case 'engineer':
            case 'rpg':
                this.drawEngineer(ctx, teamColor, mode || 'carrying');
                break;
            case 'special_forces':
                this.drawSpecialForces(ctx, teamColor);
                break;
            case 'drone_operator':
                this.drawDroneOperator(ctx, teamColor, mode || 'rifle');
                break;
            case 'humvee':
                this.drawHumvee(ctx, teamColor);
                break;
            case 'mbt':
                this.drawMBT(ctx, teamColor);
                break;
            case 'spg':
                this.drawSPG(ctx, teamColor);
                break;
            case 'apc':
                this.drawAPC(ctx, teamColor);
                break;
            case 'aa_tank':
                this.drawAATank(ctx, teamColor);
                break;
            case 'apache':
                this.drawApache(ctx, teamColor, rotorAngle);
                break;
            case 'blackhawk':
            case 'uh60':
                this.drawBlackhawk(ctx, teamColor, rotorAngle);
                break;
            case 'chinook':
                this.drawChinook(ctx, teamColor, rotorAngle);
                break;
            case 'fighter':
                this.drawFighter(ctx, teamColor);
                break;
            case 'bomber':
                this.drawBomber(ctx, teamColor);
                break;
            case 'recon':
                this.drawRecon(ctx, teamColor);
                break;
            case 'drone_suicide':
                this.drawDroneSuicide(ctx, teamColor, rotorAngle, facing);
                break;
            case 'drone_at':
                this.drawDroneAT(ctx, teamColor, rotorAngle, facing);
                break;
            case 'tactical_drone':
                this.drawTacticalDrone(ctx, teamColor);
                break;
            case 'stealth_drone':
                this.drawStealthDrone(ctx, teamColor);
                break;
            case 'tactical_missile':
                this.drawTacticalMissile(ctx);
                break;
            case 'nuke':
                this.drawNuke(ctx);
                break;
            case 'emp':
                this.drawEMP(ctx);
                break;
            default:
                // Fallback: simple rectangle
                ctx.fillStyle = teamColor;
                ctx.fillRect(-10, -20, 20, 20);
                break;
        }

        ctx.restore();
    },

    shouldSnapFeet(unitId) {
        const noSnap = new Set([
            'fighter', 'apache', 'blackhawk', 'uh60', 'chinook', 'bomber', 'recon',
            'drone_suicide', 'drone_at', 'tactical_drone', 'stealth_drone',
            'tactical_missile', 'nuke', 'emp'
        ]);
        return !noSnap.has(unitId);
    },

    getFeetY(unitId) {
        const map = {
            worker: 0,
            infantry: 0,
            engineer: 0,
            rpg: 0,
            special_forces: 0,
            drone_operator: 0,
            humvee: 20,
            apc: -1.6,
            mbt: 2,
            spg: 6.3,
            aa_tank: 2.5
        };
        if (unitId && Object.prototype.hasOwnProperty.call(map, unitId)) return map[unitId];
        return 0;
    },

    // ==================== Infantry Units ====================

    drawWorker(ctx, teamColor) {
        // Body
        ctx.fillStyle = teamColor;
        ctx.fillRect(-6, -20, 12, 20);

        // Head
        ctx.beginPath();
        ctx.arc(0, -24, 5, 0, Math.PI * 2);
        ctx.fill();

        // Cap base
        ctx.fillStyle = '#1e293b';
        ctx.beginPath();
        ctx.arc(0, -25, 5.2, Math.PI, 0);
        ctx.fill();

        // Cap brim
        ctx.beginPath();
        ctx.moveTo(4, -26);
        ctx.lineTo(9, -24);
        ctx.lineTo(4, -23);
        ctx.fill();

        // Shovel (diagonal)
        ctx.save();
        ctx.translate(0, -8);
        ctx.rotate(-Math.PI / 4);

        // Shovel blade
        ctx.fillStyle = '#94a3b8';
        ctx.fillRect(-3, -16, 6, 8);

        // Shovel handle
        ctx.fillStyle = '#854d0e';
        ctx.fillRect(-1, -8, 2, 14);

        // Handle end
        ctx.fillRect(-3, 6, 6, 2);
        ctx.restore();

        // Hands
        ctx.fillStyle = teamColor;
        ctx.fillRect(-3, -15, 4, 4);
        ctx.fillRect(0, -10, 4, 4);
    },

    drawInfantry(ctx, teamColor) {
        ctx.fillStyle = teamColor;
        ctx.fillRect(-6, -20, 12, 20);
        ctx.beginPath();
        ctx.arc(0, -24, 5, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#1e293b';
        ctx.fillRect(2, -18, 10, 3);
    },

    drawEngineer(ctx, teamColor, mode) {
        const isFiring = mode === 'firing';

        if (isFiring) {
            // === Firing Mode: RPG aiming pose ===
            // Body
            ctx.fillStyle = teamColor;
            ctx.fillRect(-6, -20, 12, 20);
            ctx.fillStyle = '#1e293b';
            ctx.fillRect(-8, -19, 16, 11);
            ctx.fillStyle = '#334155';
            ctx.fillRect(-6, -15, 4, 5);
            ctx.fillRect(2, -15, 4, 5);

            // Head
            ctx.fillStyle = teamColor;
            ctx.beginPath();
            ctx.arc(0, -24, 5, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = '#111827';
            ctx.fillRect(-2, -26, 6, 2.5);

            // RPG launcher
            ctx.save();
            ctx.rotate(-0.1);
            ctx.fillStyle = '#4d7c0f';
            ctx.fillRect(-12, -29, 32, 8);
            ctx.fillStyle = '#111827';
            ctx.fillRect(-14, -30, 3, 10);
            ctx.fillRect(19, -30, 3, 10);
            ctx.fillStyle = '#374151';
            ctx.fillRect(-4, -34, 10, 5);
            ctx.fillStyle = '#ef4444';
            ctx.fillRect(3, -33, 2, 2);
            ctx.restore();

            // Arms
            ctx.fillStyle = teamColor;
            ctx.beginPath();
            ctx.arc(-2, -18, 3.5, 0, Math.PI * 2);
            ctx.fill();
            ctx.beginPath();
            ctx.arc(8, -18, 3.5, 0, Math.PI * 2);
            ctx.fill();
        } else {
            // === Carrying Mode: Rocket on back, LMG ===
            // Rocket on back
            ctx.save();
            ctx.translate(-4, -25);
            ctx.rotate(-Math.PI / 2.8);
            ctx.fillStyle = '#4d7c0f';
            ctx.fillRect(-16, -4, 32, 8);
            ctx.fillStyle = '#111827';
            ctx.fillRect(-18, -5, 3, 10);
            ctx.fillRect(15, -5, 3, 10);
            ctx.strokeStyle = '#3f3f46';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(-10, 0);
            ctx.lineTo(10, 0);
            ctx.stroke();
            ctx.restore();

            // Body
            ctx.fillStyle = teamColor;
            ctx.fillRect(-6, -20, 12, 20);
            ctx.fillStyle = '#1e293b';
            ctx.fillRect(-8, -19, 16, 11);
            ctx.fillStyle = '#334155';
            ctx.fillRect(-6, -15, 4, 5);
            ctx.fillRect(2, -15, 4, 5);

            // Head
            ctx.fillStyle = teamColor;
            ctx.beginPath();
            ctx.arc(0, -24, 5, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = '#111827';
            ctx.fillRect(-2, -26, 6, 2.5);

            // LMG
            const gunY = -4;
            ctx.fillStyle = '#0f172a';
            ctx.fillRect(-2, -15 + gunY, 4, 3);
            ctx.fillRect(2, -16 + gunY, 10, 5);
            ctx.fillRect(12, -15 + gunY, 7, 2);
            ctx.fillStyle = '#1e293b';
            ctx.fillRect(12, -14 + gunY, 4, 2);
            ctx.fillStyle = '#3f6212';
            ctx.beginPath();
            ctx.arc(6, -12 + gunY, 3, 0, Math.PI * 2);
            ctx.fill();

            // Arms
            ctx.fillStyle = teamColor;
            ctx.beginPath();
            ctx.arc(8, -13 + gunY, 3, 0, Math.PI * 2);
            ctx.fill();
            ctx.beginPath();
            ctx.arc(1, -14 + gunY, 3, 0, Math.PI * 2);
            ctx.fill();
        }
    },

    drawSpecialForces(ctx, teamColor) {
        ctx.fillStyle = '#0f172a';
        ctx.fillRect(-10, -20, 6, 14); // Backpack
        ctx.fillStyle = teamColor;
        ctx.fillRect(-6, -20, 12, 20); // Body
        ctx.fillStyle = '#111827';
        ctx.fillRect(-6, -20, 12, 10); // Vest
        ctx.fillStyle = teamColor;
        ctx.beginPath();
        ctx.arc(0, -24, 5, 0, Math.PI * 2);
        ctx.fill(); // Head
        ctx.fillStyle = '#000000';
        ctx.beginPath();
        ctx.arc(0, -25, 5.5, Math.PI, 0);
        ctx.fill(); // Helmet
        ctx.fillStyle = '#334155';
        ctx.fillRect(2, -26, 4, 2); // Goggles
        ctx.fillStyle = '#000';
        ctx.fillRect(2, -18, 10, 3);
        ctx.fillRect(12, -18, 4, 1.5); // Gun
    },

    drawDroneOperator(ctx, teamColor, mode) {
        const opState = mode || 'rifle';

        // Backpack (common)
        ctx.fillStyle = '#334155';
        ctx.fillRect(-10, -18, 6, 14);

        // Body (team color)
        ctx.fillStyle = teamColor;
        ctx.fillRect(-6, -20, 12, 20);

        // Head
        ctx.beginPath();
        ctx.arc(0, -24, 5, 0, Math.PI * 2);
        ctx.fill();

        // Cap
        ctx.fillStyle = '#334155';
        ctx.beginPath();
        ctx.arc(0, -25, 5, Math.PI, 0);
        ctx.fill();
        ctx.fillRect(4, -27, 5, 2);

        if (opState === 'laptop') {
            // Laptop base
            ctx.fillStyle = '#0f172a';
            ctx.fillRect(4, -16, 10, 2);
            // Laptop screen
            ctx.save();
            ctx.translate(14, -16);
            ctx.rotate(Math.PI / 10);
            ctx.fillStyle = '#0f172a';
            ctx.fillRect(0, -10, 2, 10);
            ctx.fillStyle = '#38bdf8';
            ctx.fillRect(0, -9, 1, 8); // Screen glow
            ctx.restore();
            // Arm (support)
            ctx.fillStyle = teamColor;
            ctx.fillRect(0, -18, 6, 4);
        } else {
            // Rifle mode (rifle / seek_cover)
            ctx.fillStyle = '#0f172a';
            ctx.fillRect(2, -15, 12, 3); // Gun body + barrel
            ctx.fillRect(2, -14, 4, 5);  // Magazine/grip
            ctx.fillRect(-2, -14, 4, 2); // Stock connection
            // Arm (holding gun)
            ctx.fillStyle = teamColor;
            ctx.fillRect(0, -16, 8, 3);
        }
    },

    // ==================== Vehicle Units ====================

    drawHumvee(ctx, teamColor) {
        const bodyMain = '#64748b';
        const bodyDark = '#475569';
        const tireColor = '#0f172a';
        const black = '#020617';
        const glass = '#1e293b';

        ctx.save();
        ctx.scale(1.1, 1.1);
        ctx.lineWidth = 1;
        ctx.lineJoin = 'round';
        ctx.strokeStyle = 'rgba(0,0,0,0.3)';

        // Wheels
        const drawWheel = (x) => {
            ctx.fillStyle = tireColor;
            ctx.beginPath(); ctx.arc(x, 12, 6.5, 0, Math.PI * 2); ctx.fill();
            ctx.fillStyle = '#334155';
            ctx.beginPath(); ctx.arc(x, 12, 3, 0, Math.PI * 2); ctx.fill();
        };
        drawWheel(-25);
        drawWheel(25);

        // Body (Slant back styling)
        ctx.fillStyle = bodyMain;
        ctx.beginPath();
        ctx.moveTo(35, 6); // Front bumper
        ctx.lineTo(35, 2);
        ctx.lineTo(28, 0); // Hood front
        ctx.lineTo(18, -1); // Hood top
        ctx.lineTo(12, -11); // Windshield base
        ctx.lineTo(-10, -11); // Roof start
        ctx.lineTo(-35, -3); // Slant back
        ctx.lineTo(-38, 6); // Rear bumper
        ctx.lineTo(-20, 6); // Wheel arch
        ctx.lineTo(-15, 6);
        ctx.lineTo(35, 6);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        // Door Team Stripe
        ctx.fillStyle = teamColor;
        ctx.fillRect(-10, 0, 16, 3);

        // Windows (Side + Windshield)
        ctx.fillStyle = glass;
        ctx.beginPath();
        ctx.moveTo(8, -9); ctx.lineTo(14, -4); ctx.lineTo(-8, -4); ctx.lineTo(-8, -9);
        ctx.closePath();
        ctx.fill();
        // Rear small window
        ctx.beginPath();
        ctx.moveTo(-12, -9); ctx.lineTo(-12, -5); ctx.lineTo(-20, -6); ctx.lineTo(-22, -8);
        ctx.closePath();
        ctx.fill();

        // Turret
        ctx.fillStyle = bodyDark; ctx.fillRect(-2, -16, 12, 3); // Base
        ctx.fillStyle = black; ctx.fillRect(2, -15, 18, 1.5); // Gun
        ctx.fillRect(0, -17, 6, 2.5); // Shield

        ctx.restore();
    },

    drawMBT(ctx, teamColor) {
        const bodyMain = '#64748b';
        const bodyDark = '#475569';
        const bodyLight = '#94a3b8';
        const tireColor = '#0f172a';
        const black = '#020617';
        const glass = '#1e293b';
        const glassHighlight = 'rgba(255, 255, 255, 0.3)';

        ctx.save();
        ctx.scale(1.0, 1.0);
        ctx.translate(0, -20);
        ctx.lineWidth = 1;
        ctx.lineJoin = 'round';
        ctx.strokeStyle = 'rgba(0,0,0,0.3)';

        const roundRect = (x, y, w, h, r) => {
            ctx.beginPath();
            ctx.moveTo(x + r, y);
            ctx.arcTo(x + w, y, x + w, y + h, r);
            ctx.arcTo(x + w, y + h, x, y + h, r);
            ctx.arcTo(x, y + h, x, y, r);
            ctx.arcTo(x, y, x + w, y, r);
            ctx.closePath();
        };

        // Tracks
        ctx.fillStyle = tireColor;
        roundRect(-40, 10, 80, 12, 5);
        ctx.fill();
        ctx.fillStyle = bodyDark;
        for (let i = 0; i < 6; i++) {
            ctx.beginPath();
            ctx.arc(-30 + (i * 12), 16, 4, 0, Math.PI * 2);
            ctx.fill();
        }

        // Hull
        ctx.fillStyle = bodyMain;
        ctx.beginPath();
        ctx.moveTo(-42, 10);
        ctx.lineTo(38, 10);
        ctx.lineTo(42, 4);
        ctx.lineTo(-40, 4);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        // Skirt & Team Color
        ctx.fillStyle = bodyDark;
        ctx.fillRect(-42, 8, 84, 4);
        ctx.fillStyle = teamColor;
        ctx.fillRect(-20, 9, 40, 2);

        // Turret
        ctx.fillStyle = bodyMain;
        ctx.beginPath();
        ctx.moveTo(15, 4);
        ctx.lineTo(30, 0);
        ctx.lineTo(20, -12);
        ctx.lineTo(-25, -14);
        ctx.lineTo(-45, -10);
        ctx.lineTo(-35, 4);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        // Gun
        ctx.fillStyle = bodyDark;
        ctx.fillRect(10, -8, 60, 4);
        ctx.fillStyle = bodyLight;
        ctx.fillRect(35, -9, 8, 6);
        ctx.fillStyle = black;
        ctx.fillRect(70, -8, 2, 4);

        // Optics
        ctx.fillStyle = glass;
        ctx.fillRect(-5, -15, 8, 3);
        ctx.fillStyle = glassHighlight;
        ctx.fillRect(-4, -14, 2, 1);

        ctx.restore();
    },

    drawSPG(ctx, teamColor) {
        const bodyMain = '#64748b';
        const bodyDark = '#475569';
        const tireColor = '#0f172a';
        const black = '#020617';

        ctx.save();
        ctx.scale(1.15, 1.15);
        ctx.translate(0, -16.5);
        ctx.lineWidth = 1;
        ctx.lineJoin = 'round';
        ctx.strokeStyle = 'rgba(0,0,0,0.3)';

        const roundRect = (x, y, w, h, r) => {
            ctx.beginPath();
            ctx.moveTo(x + r, y);
            ctx.arcTo(x + w, y, x + w, y + h, r);
            ctx.arcTo(x + w, y + h, x, y + h, r);
            ctx.arcTo(x, y + h, x, y, r);
            ctx.arcTo(x, y, x + w, y, r);
            ctx.closePath();
        };

        ctx.fillStyle = tireColor;
        roundRect(-40, 10, 80, 12, 5);
        ctx.fill();
        ctx.fillStyle = bodyDark;
        for (let i = 0; i < 6; i++) {
            ctx.beginPath();
            ctx.arc(-30 + (i * 12), 16, 4, 0, Math.PI * 2);
            ctx.fill();
        }

        ctx.fillStyle = bodyMain;
        ctx.beginPath();
        ctx.moveTo(-42, 10);
        ctx.lineTo(38, 10);
        ctx.lineTo(35, 0);
        ctx.lineTo(-42, 0);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        ctx.translate(-10, 0);
        ctx.fillStyle = bodyMain;
        ctx.beginPath();
        ctx.moveTo(20, 0);
        ctx.lineTo(25, -10);
        ctx.lineTo(-30, -10);
        ctx.lineTo(-35, 0);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = teamColor;
        ctx.fillRect(-25, -6, 10, 3);

        ctx.save();
        ctx.rotate(-Math.PI / 12);
        ctx.fillStyle = bodyDark;
        ctx.fillRect(15, -8, 80, 5);
        ctx.fillStyle = black;
        ctx.fillRect(90, -9, 8, 7);
        ctx.restore();

        ctx.restore();
    },

    drawAPC(ctx, teamColor) {
        const bodyMain = '#64748b';
        const bodyDark = '#475569';
        const tireColor = '#0f172a';
        const black = '#020617';
        const glass = '#1e293b';
        const glassHighlight = 'rgba(255, 255, 255, 0.3)';

        const design = {
            body: [
                { x: 35, y: -5 }, { x: 29, y: -11 }, { x: 25, y: -15 },
                { x: -25, y: -15 }, { x: -35, y: -10 }, { x: -35, y: -5 },
                { x: -35, y: 0 }, { x: -31, y: 7 }, { x: 27, y: 7 }
            ],
            window: [
                { x: 24, y: -13 }, { x: 32, y: -6 }, { x: 26, y: -6 }
            ],
            wheels: [
                { x: -21, y: 7 }, { x: -1, y: 7 }, { x: 17, y: 7 }
            ],
            turret: { x: -3, y: -20 }
        };

        ctx.save();
        ctx.scale(1.08, 1.08);
        ctx.translate(0, -15);
        ctx.lineWidth = 1;
        ctx.lineJoin = 'round';
        ctx.strokeStyle = 'rgba(0,0,0,0.3)';

        // Body
        ctx.fillStyle = bodyMain;
        ctx.beginPath();
        ctx.moveTo(design.body[0].x, design.body[0].y);
        for (let i = 1; i < design.body.length; i++) {
            ctx.lineTo(design.body[i].x, design.body[i].y);
        }
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        // Team stripe
        ctx.fillStyle = teamColor;
        ctx.fillRect(-20, -5, 40, 3);

        // Detail line
        ctx.beginPath();
        ctx.moveTo(-25, -2);
        ctx.lineTo(25, -2);
        ctx.stroke();

        // Window
        ctx.fillStyle = glass;
        ctx.beginPath();
        ctx.moveTo(design.window[0].x, design.window[0].y);
        for (let i = 1; i < design.window.length; i++) {
            ctx.lineTo(design.window[i].x, design.window[i].y);
        }
        ctx.closePath();
        ctx.fill();

        // Reflection
        ctx.fillStyle = glassHighlight;
        ctx.beginPath();
        ctx.moveTo(design.window[0].x + 2, design.window[0].y + 2);
        ctx.lineTo(design.window[0].x + 5, design.window[0].y + 2);
        ctx.lineTo(design.window[0].x + 2, design.window[0].y + 5);
        ctx.fill();

        // Turret
        ctx.save();
        ctx.translate(design.turret.x, design.turret.y);
        ctx.fillStyle = black;
        ctx.fillRect(-10, -5, 20, 10);
        ctx.fillStyle = '#000';
        ctx.fillRect(10, -2, 16, 4);
        ctx.fillStyle = bodyDark;
        ctx.fillRect(-5, -4, 10, 2);
        ctx.restore();

        // Wheels
        design.wheels.forEach(w => {
            ctx.fillStyle = tireColor;
            ctx.beginPath();
            ctx.arc(w.x, w.y, 6.5, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = bodyDark;
            ctx.beginPath();
            ctx.arc(w.x, w.y, 3, 0, Math.PI * 2);
            ctx.fill();
        });

        ctx.restore();
    },

    drawAATank(ctx, teamColor) {
        const bodyMain = '#64748b';
        const bodyDark = '#475569';
        const bodyLight = '#94a3b8';
        const tireColor = '#0f172a';
        const black = '#020617';

        ctx.save();
        ctx.scale(1.25, 1.25);
        ctx.translate(0, -20);
        ctx.lineWidth = 1;
        ctx.lineJoin = 'round';
        ctx.strokeStyle = 'rgba(0,0,0,0.3)';

        const roundRect = (x, y, w, h, r) => {
            ctx.beginPath();
            ctx.moveTo(x + r, y);
            ctx.arcTo(x + w, y, x + w, y + h, r);
            ctx.arcTo(x + w, y + h, x, y + h, r);
            ctx.arcTo(x, y + h, x, y, r);
            ctx.arcTo(x, y, x + w, y, r);
            ctx.closePath();
        };

        ctx.fillStyle = tireColor;
        roundRect(-35, 10, 70, 12, 5);
        ctx.fill();
        ctx.fillStyle = bodyDark;
        for (let i = 0; i < 5; i++) {
            ctx.beginPath();
            ctx.arc(-25 + (i * 12), 16, 4, 0, Math.PI * 2);
            ctx.fill();
        }

        ctx.fillStyle = bodyMain;
        ctx.beginPath();
        ctx.moveTo(-38, 10);
        ctx.lineTo(35, 10);
        ctx.lineTo(32, 0);
        ctx.lineTo(-38, 0);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = teamColor;
        ctx.fillRect(-38, 4, 70, 2);

        ctx.fillStyle = bodyMain;
        ctx.beginPath();
        ctx.moveTo(10, 0);
        ctx.lineTo(15, -10);
        ctx.lineTo(-20, -10);
        ctx.lineTo(-25, 0);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        // Radar
        ctx.fillStyle = bodyLight;
        ctx.fillRect(-28, -25, 12, 15);
        ctx.strokeRect(-28, -25, 12, 15);

        ctx.save();
        ctx.translate(5, -5);
        ctx.rotate(-Math.PI / 4);
        ctx.fillStyle = bodyDark;
        ctx.fillRect(0, -4, 15, 8);
        ctx.fillStyle = black;
        ctx.fillRect(15, -3, 25, 2);
        ctx.fillRect(15, 1, 25, 2);
        ctx.restore();

        ctx.restore();
    },

    // ==================== Air Units ====================

    drawApache(ctx, teamColor, rotorAngle) {
        ctx.save();
        ctx.scale(1.35, 1.35);

        // Tail Boom
        ctx.fillStyle = '#334155';
        ctx.fillRect(-40, -5, 30, 8);

        // Tail Rotor
        ctx.save();
        ctx.translate(-40, -5);
        ctx.rotate(rotorAngle * 3);
        ctx.fillStyle = '#000';
        ctx.fillRect(-2, -12, 4, 24);
        ctx.restore();

        // Main Body (match bomber body color)
        ctx.fillStyle = '#334155';
        ctx.beginPath();
        ctx.moveTo(20, 5);
        ctx.lineTo(25, -5);
        ctx.lineTo(-10, -10);
        ctx.lineTo(-15, 5);
        ctx.fill();

        // Team marking (subtle)
        ctx.fillStyle = teamColor;
        ctx.fillRect(-6, -2, 10, 2);

        // Windows (Pilot & Gunner)
        ctx.fillStyle = '#000';
        ctx.beginPath();
        ctx.moveTo(12, -5);
        ctx.lineTo(18, -5);
        ctx.lineTo(16, -8);
        ctx.lineTo(14, -8);
        ctx.fill();
        ctx.beginPath();
        ctx.moveTo(2, -8);
        ctx.lineTo(8, -8);
        ctx.lineTo(6, -11);
        ctx.lineTo(4, -11);
        ctx.fill();

        // Wing Stub & Weapons
        ctx.fillStyle = '#1e293b';
        ctx.fillRect(0, 0, 10, 8);
        ctx.fillStyle = '#000';
        ctx.fillRect(2, 6, 6, 4);

        // Main Rotor
        ctx.fillStyle = '#000';
        ctx.fillRect(-30, -12, 60, 3);
        ctx.fillRect(-5, -15, 10, 5); // Rotor Mast

        ctx.restore();
    },

    drawBlackhawk(ctx, teamColor, rotorAngle) {
        ctx.save();
        ctx.scale(1.6, 1.6);

        // Tail rotor background
        ctx.fillStyle = '#1e293b';
        ctx.fillRect(-45, -5, 30, 6);

        // Tail rotor rotation
        ctx.save();
        ctx.translate(-45, -5);
        ctx.rotate(rotorAngle * 3);
        ctx.fillStyle = '#000';
        ctx.fillRect(-2, -10, 4, 20);
        ctx.restore();

        // Body
        ctx.fillStyle = '#334155';
        ctx.beginPath();
        ctx.moveTo(25, 0);
        ctx.lineTo(20, -8);
        ctx.lineTo(-20, -10);
        ctx.lineTo(-25, 5);
        ctx.lineTo(20, 5);
        ctx.fill();

        // Cockpit/Engine room
        ctx.fillStyle = '#0f172a';
        ctx.fillRect(-10, -5, 15, 8);
        ctx.fillStyle = '#000';
        ctx.fillRect(15, -6, 6, 4);

        // Main rotor
        ctx.fillStyle = '#000';
        ctx.fillRect(-35, -12, 70, 2);
        ctx.fillRect(-2, -14, 4, 4);

        // Team marking
        ctx.fillStyle = teamColor;
        ctx.fillRect(-5, -2, 20, 2);

        ctx.restore();
    },

    drawChinook(ctx, teamColor, rotorAngle) {
        // Chinook body
        ctx.fillStyle = '#4b5563';
        ctx.beginPath();
        ctx.moveTo(-43, -14);
        ctx.lineTo(43, -14);
        ctx.lineTo(50, 7);
        ctx.lineTo(-50, 7);
        ctx.lineTo(-50, -29);
        ctx.fill();
        ctx.fillStyle = '#1f2937';
        ctx.fillRect(-34, 6, 8, 4);
        ctx.fillRect(22, 6, 8, 4);

        // Rotors (fixed cross)
        ctx.fillStyle = '#000';
        // Front rotor
        ctx.save();
        ctx.translate(-35, -20);
        ctx.fillRect(-40, -2, 80, 4);
        ctx.restore();
        // Back rotor
        ctx.save();
        ctx.translate(35, -20);
        ctx.fillRect(-40, -2, 80, 4);
        ctx.restore();
    },

    drawFighter(ctx, teamColor) {
        const bodyMain = '#64748b';
        const bodyDark = '#475569';
        const bodyLight = '#94a3b8';
        const glass = '#1e293b';
        const glassHighlight = 'rgba(255, 255, 255, 0.3)';

        ctx.save();
        ctx.scale(0.8, 0.8);
        ctx.lineWidth = 1;
        ctx.lineJoin = 'round';
        ctx.strokeStyle = 'rgba(0,0,0,0.3)';

        ctx.fillStyle = bodyMain;
        ctx.beginPath();
        ctx.moveTo(60, 5);
        ctx.lineTo(20, 0);
        ctx.lineTo(-20, 0);
        ctx.lineTo(-45, -5);
        ctx.lineTo(-50, 5);
        ctx.lineTo(-45, 10);
        ctx.lineTo(0, 12);
        ctx.lineTo(40, 10);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        // Rear wing (smaller)
        ctx.fillStyle = bodyDark;
        ctx.beginPath();
        ctx.moveTo(-32, -1);
        ctx.lineTo(-38, -16);
        ctx.lineTo(-28, -16);
        ctx.lineTo(-20, -1);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = teamColor;
        ctx.fillRect(-45, -20, 10, 3);

        // Front wing (larger + wider)
        ctx.fillStyle = bodyLight;
        ctx.beginPath();
        ctx.moveTo(8, 6);
        ctx.lineTo(-36, 20);
        ctx.lineTo(-6, 6);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        // Cockpit (slightly larger, attached, lower)
        ctx.fillStyle = glass;
        ctx.beginPath();
        ctx.ellipse(12, -1, 13.5, 5.5, 0, Math.PI, 0);
        ctx.fill();
        ctx.fillStyle = glassHighlight;
        ctx.beginPath();
        ctx.ellipse(10, -2, 4.5, 2.2, 0, Math.PI, 0);
        ctx.fill();

        ctx.fillStyle = '#cbd5e1';
        ctx.fillRect(-10, 16, 25, 2);
        ctx.fillStyle = teamColor;
        ctx.fillRect(12, 16, 3, 2);

        // Afterburner removed
        ctx.restore();
    },

    drawBomber(ctx, teamColor) {
        ctx.fillStyle = '#334155';
        // Main Fuselage
        ctx.beginPath();
        ctx.moveTo(60, 0);
        ctx.lineTo(40, -7);
        ctx.lineTo(-20, -7);
        ctx.lineTo(-40, -25);
        ctx.lineTo(-35, -5);
        ctx.lineTo(-50, 0);
        ctx.lineTo(-45, 5);
        ctx.lineTo(20, 8);
        ctx.fill();

        // Cockpit Window
        ctx.fillStyle = '#000';
        ctx.beginPath();
        ctx.moveTo(40, -7);
        ctx.lineTo(50, -2);
        ctx.lineTo(42, -2);
        ctx.fill();

        // Wings (Swept back)
        ctx.fillStyle = '#1e293b';
        ctx.beginPath();
        ctx.moveTo(10, -2);
        ctx.lineTo(-30, -2);
        ctx.lineTo(-40, 15);
        ctx.lineTo(-10, 15);
        ctx.fill();

        // Engine Pods
        ctx.fillStyle = '#0f172a';
        ctx.beginPath();
        ctx.ellipse(-20, 12, 15, 4, 0, 0, Math.PI * 2);
        ctx.fill();

        // Team Mark
        ctx.fillStyle = teamColor;
        ctx.fillRect(-10, -4, 15, 3);
    },

    drawRecon(ctx, teamColor) {
        ctx.save();
        ctx.scale(0.5, 0.5);
        const bodyColor = '#cbd5e1';
        const darkColor = '#475569';

        // Fuselage
        ctx.fillStyle = bodyColor;
        ctx.beginPath();
        ctx.moveTo(30, 5);
        ctx.bezierCurveTo(35, -10, 10, -15, -10, -12);
        ctx.lineTo(-40, -5);
        ctx.lineTo(-35, 2);
        ctx.lineTo(20, 10);
        ctx.fill();

        // V-Tail
        ctx.fillStyle = darkColor;
        ctx.beginPath();
        ctx.moveTo(-30, -5);
        ctx.lineTo(-45, -20);
        ctx.lineTo(-38, -5);
        ctx.fill();

        // Engine Intake
        ctx.fillStyle = '#334155';
        ctx.beginPath();
        ctx.ellipse(-5, -14, 8, 4, 0, 0, Math.PI * 2);
        ctx.fill();

        // Main Wing
        ctx.fillStyle = '#64748b';
        ctx.beginPath();
        ctx.moveTo(5, -5);
        ctx.lineTo(-15, -2);
        ctx.lineTo(-20, 2);
        ctx.lineTo(0, 2);
        ctx.fill();

        // Sensor Pod
        ctx.fillStyle = '#0f172a';
        ctx.beginPath();
        ctx.arc(15, 10, 4, 0, Math.PI);
        ctx.fill();
        ctx.fillStyle = '#38bdf8';
        ctx.beginPath();
        ctx.arc(16, 11, 1.5, 0, Math.PI * 2);
        ctx.fill();

        // Team ID Strip
        ctx.fillStyle = teamColor;
        ctx.fillRect(-15, -8, 10, 4);

        ctx.restore();
    },

    // ==================== Drone Units ====================

    drawDroneSuicide(ctx, teamColor, rotorAngle, facing) {
        ctx.save();
        const baseScale = 0.52;
        const sx = (facing < 0 ? -1 : 1) * baseScale;
        ctx.scale(sx, baseScale);

        // Body
        ctx.fillStyle = '#475569';
        ctx.fillRect(-12, -8, 24, 12);
        ctx.fillStyle = teamColor;
        ctx.fillRect(-12, -2, 24, 3);  // Team color strip
        ctx.fillStyle = '#1e293b';
        ctx.fillRect(-20, -4, 40, 4);  // Rotor arm

        // Rotors (left/right - blur effect)
        const rotorAlpha = 0.3 + Math.abs(Math.sin(rotorAngle * 5)) * 0.5;
        ctx.save();
        ctx.translate(-18, -6);
        ctx.fillStyle = '#cbd5e1';
        ctx.fillRect(-1, -4, 2, 4);
        ctx.fillStyle = `rgba(0,0,0,${rotorAlpha})`;
        ctx.fillRect(-10, -5, 20, 2);
        ctx.restore();
        ctx.save();
        ctx.translate(18, -6);
        ctx.fillStyle = '#cbd5e1';
        ctx.fillRect(-1, -4, 2, 4);
        ctx.fillStyle = `rgba(0,0,0,${rotorAlpha + 0.1})`;
        ctx.fillRect(-10, -5, 20, 2);
        ctx.restore();

        // Bottom explosive
        ctx.fillStyle = '#ef4444';
        ctx.fillRect(-4, 4, 8, 4);

        ctx.restore();
    },

    drawDroneAT(ctx, teamColor, rotorAngle, facing) {
        ctx.save();
        const baseScale = 0.52;
        const sx = (facing < 0 ? -1 : 1) * baseScale;
        ctx.scale(sx, baseScale);

        // Body (white-ish)
        ctx.fillStyle = '#e2e8f0';
        ctx.beginPath();
        ctx.moveTo(20, 2);
        ctx.bezierCurveTo(20, -10, 0, -10, -20, -2);
        ctx.lineTo(-20, 2);
        ctx.bezierCurveTo(0, 8, 20, 8, 20, 2);
        ctx.fill();

        // Tail wings
        ctx.fillStyle = '#94a3b8';
        ctx.beginPath();
        ctx.moveTo(-15, -2);
        ctx.lineTo(-25, -12);
        ctx.lineTo(-20, -2);
        ctx.fill();
        ctx.beginPath();
        ctx.moveTo(-15, 2);
        ctx.lineTo(-25, 12);
        ctx.lineTo(-20, 2);
        ctx.fill();

        // Rear propeller (rotating)
        ctx.save();
        ctx.translate(-22, 0);
        ctx.rotate(rotorAngle * 5);
        ctx.fillStyle = '#000';
        ctx.fillRect(-1, -10, 2, 20);
        ctx.restore();

        // Camera/Sensor
        ctx.fillStyle = '#1e293b';
        ctx.beginPath();
        ctx.arc(12, 6, 3, 0, Math.PI * 2);
        ctx.fill();

        // Anti-tank missile (red)
        ctx.fillStyle = '#dc2626';
        ctx.fillRect(-8, 5, 16, 3);
        ctx.fillStyle = '#0f172a';
        ctx.fillRect(-2, 6, 6, 2);

        // Team ID mark
        ctx.fillStyle = teamColor;
        ctx.beginPath();
        ctx.arc(5, 0, 3, 0, Math.PI * 2);
        ctx.fill();

        ctx.restore();
    },

    drawTacticalDrone(ctx, teamColor) {
        ctx.fillStyle = teamColor;
        ctx.beginPath();
        ctx.moveTo(10, 0);
        ctx.lineTo(-5, 6);
        ctx.lineTo(-2, 0);
        ctx.lineTo(-5, -6);
        ctx.fill();
    },

    drawStealthDrone(ctx, teamColor) {
        ctx.fillStyle = teamColor;
        ctx.beginPath();
        ctx.moveTo(14, 0);
        ctx.lineTo(-10, 9);
        ctx.lineTo(-4, 0);
        ctx.lineTo(-10, -9);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = '#0f172a';
        ctx.beginPath();
        ctx.ellipse(1, 0, 3.5, 2.2, 0, 0, Math.PI * 2);
        ctx.fill();
    },

    // ==================== Special Units ====================

    drawTacticalMissile(ctx) {
        ctx.fillStyle = '#e5e7eb';
        ctx.fillRect(-12, -3, 24, 6);
        ctx.fillStyle = '#ef4444';
        ctx.beginPath();
        ctx.moveTo(12, -3);
        ctx.lineTo(18, 0);
        ctx.lineTo(12, 3);
        ctx.fill();
        ctx.fillStyle = '#f59e0b';
        ctx.beginPath();
        ctx.arc(-12, 0, 4, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#475569';
        ctx.beginPath();
        ctx.moveTo(-8, -3);
        ctx.lineTo(-12, -8);
        ctx.lineTo(-12, -3);
        ctx.fill();
        ctx.beginPath();
        ctx.moveTo(-8, 3);
        ctx.lineTo(-12, 8);
        ctx.lineTo(-12, 3);
        ctx.fill();
    },

    drawNuke(ctx) {
        ctx.fillStyle = '#ef4444';
        ctx.beginPath();
        ctx.arc(0, 0, 15, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#000';
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.arc(0, 0, 12, 0, Math.PI / 3);
        ctx.lineTo(0, 0);
        ctx.moveTo(0, 0);
        ctx.arc(0, 0, 12, 2 * Math.PI / 3, Math.PI);
        ctx.lineTo(0, 0);
        ctx.moveTo(0, 0);
        ctx.arc(0, 0, 12, 4 * Math.PI / 3, 5 * Math.PI / 3);
        ctx.lineTo(0, 0);
        ctx.fill();
        ctx.fillStyle = '#facc15';
        ctx.beginPath();
        ctx.arc(0, 0, 4, 0, Math.PI * 2);
        ctx.fill();
    },

    drawEMP(ctx) {
        ctx.strokeStyle = '#3b82f6';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(0, 0, 15, 0, Math.PI * 2);
        ctx.stroke();
        ctx.fillStyle = '#3b82f6';
        ctx.beginPath();
        ctx.moveTo(-5, -8);
        ctx.lineTo(8, -2);
        ctx.lineTo(-2, 2);
        ctx.lineTo(6, 10);
        ctx.lineTo(-8, 4);
        ctx.lineTo(2, 0);
        ctx.fill();
    },

    // ==================== Wreckage (파괴된 기갑 유닛 잔해) ====================

    drawWreck(ctx, unitId, options = {}) {
        const team = options.team || 'player';
        const facing = options.facing || 1;

        ctx.save();

        // [UPDATE] 더 어둡고 극적인 손상 색상 (레퍼런스 기반)
        const burnedMain = '#334155';   // slate-700 - 메인 잔해색
        const burnedDark = '#1e293b';   // slate-800 - 어두운 부분
        const burnedLight = '#475569';  // slate-600 - 밝은 부분
        const charred = '#020617';      // slate-950 - 완전히 탄 부분
        const rust = '#451a03';         // orange-950 - 녹/불탄 자국

        switch (unitId) {
            case 'humvee':
                this.drawHumveeWreck(ctx, burnedMain, burnedDark, burnedLight, charred, rust);
                break;
            case 'mbt':
                this.drawMBTWreck(ctx, burnedMain, burnedDark, burnedLight, charred, rust);
                break;
            case 'spg':
                this.drawSPGWreck(ctx, burnedMain, burnedDark, burnedLight, charred, rust);
                break;
            case 'apc':
                this.drawAPCWreck(ctx, burnedMain, burnedDark, burnedLight, charred, rust);
                break;
            case 'aa_tank':
                this.drawAATankWreck(ctx, burnedMain, burnedDark, burnedLight, charred, rust);
                break;
            default:
                this.drawGenericWreck(ctx, burnedMain, burnedDark);
                break;
        }

        ctx.restore();
    },

    // 험비 잔해 (바퀴 없음, 차체만) - [UPDATE] 더 극적인 파괴
    drawHumveeWreck(ctx, mainColor, darkColor, lightColor, charred, rust) {
        ctx.save();
        ctx.scale(1.1, 1.1);
        ctx.rotate(0.08); // 더 기울어짐

        // 손상된 차체 (찌그러진 전면부)
        ctx.fillStyle = mainColor;
        ctx.beginPath();
        ctx.moveTo(35, 6);
        ctx.lineTo(35, 2);
        ctx.lineTo(25, -2);      // 전면 찌그러짐
        ctx.lineTo(20, 2);
        ctx.lineTo(12, -8);
        ctx.lineTo(-15, -10);
        ctx.lineTo(-25, -2);
        ctx.lineTo(-34, 6);
        ctx.closePath();
        ctx.fill();

        // 큰 폭발 구멍 (엔진룸)
        ctx.fillStyle = charred;
        ctx.beginPath();
        ctx.arc(10, -5, 8, 0, Math.PI * 2);
        ctx.fill();

        // 추가 그을음 자국
        ctx.fillStyle = charred;
        ctx.beginPath();
        ctx.arc(-18, -3, 5, 0, Math.PI * 2);
        ctx.fill();

        // 녹/불탄 자국
        ctx.fillStyle = rust;
        ctx.beginPath();
        ctx.arc(0, 2, 4, 0, Math.PI * 2);
        ctx.fill();

        // 남은 앞바퀴 하나 (반파)
        ctx.fillStyle = darkColor;
        ctx.beginPath();
        ctx.arc(-20, 10, 6, 0.5, Math.PI);
        ctx.fill();

        // 손상된 창문
        ctx.fillStyle = darkColor;
        ctx.beginPath();
        ctx.moveTo(8, -8);
        ctx.lineTo(14, -2);
        ctx.lineTo(-8, -2);
        ctx.lineTo(-8, -8);
        ctx.closePath();
        ctx.fill();

        // 부서진 지붕
        ctx.fillStyle = darkColor;
        ctx.fillRect(-2, -13, 10, 2);

        ctx.restore();
    },

    // MBT 전차 잔해 - [UPDATE] 포탑 사출, 궤도 끊어짐
    drawMBTWreck(ctx, mainColor, darkColor, lightColor, charred, rust) {
        ctx.save();
        ctx.scale(1.0, 1.0);
        ctx.translate(0, -20);

        // 끊어진 궤도 (불규칙하게)
        ctx.fillStyle = charred;
        ctx.fillRect(-45, 12, 60, 8);

        // 손상된 차체 (포탑 없는 상태)
        ctx.fillStyle = darkColor;
        ctx.beginPath();
        ctx.moveTo(40, 10);
        ctx.lineTo(30, 2);
        ctx.lineTo(-30, 0);
        ctx.lineTo(-45, 12);
        ctx.closePath();
        ctx.fill();

        // 차체 상부 (포탑이 빠진 구멍)
        ctx.fillStyle = mainColor;
        ctx.beginPath();
        ctx.moveTo(-35, 0);
        ctx.lineTo(25, 0);
        ctx.lineTo(30, 5);
        ctx.lineTo(-40, 8);
        ctx.closePath();
        ctx.fill();

        // 포탑링 (빈 구멍)
        ctx.fillStyle = charred;
        ctx.beginPath();
        ctx.ellipse(-5, 2, 12, 6, 0, 0, Math.PI * 2);
        ctx.fill();

        // [핵심] 튕겨나간 포탑 (옆으로 분리됨)
        ctx.save();
        ctx.translate(-50, 18);
        ctx.rotate(-0.8);  // 뒤집어진 상태

        // 포탑 본체
        ctx.fillStyle = mainColor;
        ctx.fillRect(-15, -8, 30, 10);

        // 부러진 포신
        ctx.fillStyle = charred;
        ctx.fillRect(10, -5, 12, 2);

        ctx.restore();

        // 녹/불탄 자국
        ctx.fillStyle = rust;
        ctx.beginPath();
        ctx.arc(15, 5, 5, 0, Math.PI * 2);
        ctx.fill();

        ctx.restore();
    },

    // 자주포 잔해 - [UPDATE] 후방 캐빈 붕괴, 포신 두 토막
    drawSPGWreck(ctx, mainColor, darkColor, lightColor, charred, rust) {
        ctx.save();
        ctx.scale(1.15, 1.15);
        ctx.translate(0, -16.5);
        ctx.rotate(0.06);

        // 손상된 궤도
        ctx.fillStyle = darkColor;
        ctx.fillRect(-40, 10, 80, 8);

        // 손상된 차체 (기울어짐)
        ctx.fillStyle = mainColor;
        ctx.beginPath();
        ctx.moveTo(35, 10);
        ctx.lineTo(10, -5);
        ctx.lineTo(-35, -5);
        ctx.lineTo(-40, 10);
        ctx.closePath();
        ctx.fill();

        // 붕괴된 후방 캐빈 (찌그러진 상태)
        ctx.fillStyle = darkColor;
        ctx.beginPath();
        ctx.moveTo(-25, -5);
        ctx.lineTo(-15, -12);
        ctx.lineTo(5, -10);
        ctx.lineTo(10, -5);
        ctx.closePath();
        ctx.fill();

        // 부러진 포신 1조각 (본체에 연결)
        ctx.save();
        ctx.translate(10, -8);
        ctx.rotate(0.5);
        ctx.fillStyle = charred;
        ctx.fillRect(0, 0, 15, 3);
        ctx.restore();

        // 부러진 포신 2조각 (떨어진 부분)
        ctx.save();
        ctx.translate(35, 2);
        ctx.rotate(0.2);
        ctx.fillStyle = darkColor;
        ctx.fillRect(0, 0, 20, 3);
        ctx.restore();

        // 손상 자국
        ctx.fillStyle = charred;
        ctx.beginPath();
        ctx.arc(-15, -2, 5, 0, Math.PI * 2);
        ctx.fill();

        // 녹 자국
        ctx.fillStyle = rust;
        ctx.beginPath();
        ctx.arc(0, 5, 3, 0, Math.PI * 2);
        ctx.fill();

        ctx.restore();
    },

    // APC 장갑차 잔해 - [UPDATE] 상부 해치 폭발, 바퀴 비산
    drawAPCWreck(ctx, mainColor, darkColor, lightColor, charred, rust) {
        ctx.save();
        ctx.scale(1.08, 1.08);
        ctx.translate(0, -15);
        ctx.rotate(-0.05);

        // 손상된 차체 (메인)
        ctx.fillStyle = mainColor;
        ctx.beginPath();
        ctx.moveTo(35, 0);
        ctx.lineTo(25, -15);
        ctx.lineTo(-25, -15);
        ctx.lineTo(-35, 0);
        ctx.lineTo(-30, 10);
        ctx.lineTo(30, 10);
        ctx.closePath();
        ctx.fill();

        // 폭발로 열린 상부 해치
        ctx.fillStyle = charred;
        ctx.beginPath();
        ctx.ellipse(0, -15, 8, 3, 0, 0, Math.PI * 2);
        ctx.fill();

        // 중앙 폭발 구멍
        ctx.fillStyle = charred;
        ctx.beginPath();
        ctx.arc(0, -5, 6, 0, Math.PI * 2);
        ctx.fill();

        // 측면 손상
        ctx.fillStyle = charred;
        ctx.beginPath();
        ctx.arc(-20, 0, 4, 0, Math.PI * 2);
        ctx.fill();

        // 비산된 바퀴 1 (왼쪽 멀리)
        ctx.fillStyle = darkColor;
        ctx.beginPath();
        ctx.arc(-45, 15, 5, 0, Math.PI * 2);
        ctx.fill();

        // 비산된 바퀴 2 (오른쪽 멀리)
        ctx.fillStyle = darkColor;
        ctx.beginPath();
        ctx.arc(42, 12, 5, 0, Math.PI * 2);
        ctx.fill();

        // 빠진 바퀴 자리 (축만 남음)
        ctx.fillStyle = charred;
        ctx.beginPath();
        ctx.arc(-21, 10, 3, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(-1, 10, 3, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(17, 10, 3, 0, Math.PI * 2);
        ctx.fill();

        // 녹 자국
        ctx.fillStyle = rust;
        ctx.beginPath();
        ctx.arc(15, -8, 3, 0, Math.PI * 2);
        ctx.fill();

        ctx.restore();
    },

    // 대공전차 잔해 - [UPDATE] 레이더 구부러짐, 쌍열 포신 변형
    drawAATankWreck(ctx, mainColor, darkColor, lightColor, charred, rust) {
        ctx.save();
        ctx.scale(1.25, 1.25);
        ctx.translate(0, -20);
        ctx.rotate(0.03);

        // 손상된 궤도
        ctx.fillStyle = darkColor;
        ctx.fillRect(-35, 10, 70, 8);

        // 손상된 차체
        ctx.fillStyle = mainColor;
        ctx.beginPath();
        ctx.moveTo(30, 10);
        ctx.lineTo(10, -5);
        ctx.lineTo(-30, -5);
        ctx.lineTo(-35, 10);
        ctx.closePath();
        ctx.fill();

        // 손상된 포탑
        ctx.fillStyle = mainColor;
        ctx.beginPath();
        ctx.moveTo(10, -5);
        ctx.lineTo(13, -12);
        ctx.lineTo(-20, -12);
        ctx.lineTo(-25, -5);
        ctx.closePath();
        ctx.fill();

        // 파괴된 레이더 박스 (찌그러짐)
        ctx.fillStyle = charred;
        ctx.fillRect(-10, -12, 20, 8);

        // 구부러진 포신 1 (위쪽으로 휨)
        ctx.save();
        ctx.translate(5, -10);
        ctx.rotate(0.8);  // 심하게 휘어짐
        ctx.fillStyle = darkColor;
        ctx.fillRect(0, 0, 12, 2);
        ctx.restore();

        // 구부러진 포신 2 (아래쪽으로 휨)
        ctx.save();
        ctx.translate(5, -6);
        ctx.rotate(-0.5);
        ctx.fillStyle = darkColor;
        ctx.fillRect(0, 0, 10, 2);
        ctx.restore();

        // 손상 자국
        ctx.fillStyle = charred;
        ctx.beginPath();
        ctx.arc(-5, -8, 4, 0, Math.PI * 2);
        ctx.fill();

        // 녹 자국
        ctx.fillStyle = rust;
        ctx.beginPath();
        ctx.arc(20, 5, 3, 0, Math.PI * 2);
        ctx.fill();

        ctx.restore();
    },

    // 일반 잔해 (알 수 없는 유닛용)
    drawGenericWreck(ctx, mainColor, darkColor) {
        ctx.save();
        ctx.rotate(0.05);

        // 기본 차체
        ctx.fillStyle = mainColor;
        ctx.fillRect(-30, -15, 60, 25);

        // 손상 자국
        ctx.fillStyle = darkColor;
        ctx.beginPath();
        ctx.arc(0, -5, 8, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(-15, 2, 5, 0, Math.PI * 2);
        ctx.fill();

        ctx.restore();
    }
};

// Export for use in other modules
if (typeof window !== 'undefined') {
    window.IngameRenderer = IngameRenderer;
}
