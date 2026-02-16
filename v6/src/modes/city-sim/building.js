(function (global) {
    const DEFAULT_SIZE = 128;
    const SPRITE_CACHE = new Map();
    const AIRPORT_SCENE_CACHE = new Map();
    const PARK_PLAZA_SCENE_CACHE = new Map();

    function createCanvas(size) {
        const safe = Math.max(32, Math.floor(Number(size) || DEFAULT_SIZE));
        const canvas = document.createElement('canvas');
        canvas.width = safe;
        canvas.height = safe;
        return canvas;
    }

    function createRectCanvas(w, h) {
        const safeW = Math.max(32, Math.floor(Number(w) || DEFAULT_SIZE));
        const safeH = Math.max(32, Math.floor(Number(h) || DEFAULT_SIZE));
        const canvas = document.createElement('canvas');
        canvas.width = safeW;
        canvas.height = safeH;
        return canvas;
    }

    function toPx(size, ratio) {
        return Math.round(size * ratio);
    }

    function drawBarracks(ctx, size) {
        const baseX = toPx(size, 0.16);
        const baseY = toPx(size, 0.36);
        const width = toPx(size, 0.68);
        const height = toPx(size, 0.46);
        const groundY = toPx(size, 0.86);
        const cx = Math.round(size / 2);

        ctx.fillStyle = '#636e72';
        ctx.fillRect(baseX, baseY, width, height);

        ctx.fillStyle = '#2d3436';
        ctx.fillRect(baseX - 2, baseY - 6, width + 4, 7);
        ctx.fillRect(baseX, groundY - 6, width, 6);

        ctx.strokeStyle = '#535c68';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(baseX, baseY + toPx(size, 0.13));
        ctx.lineTo(baseX + width, baseY + toPx(size, 0.13));
        ctx.moveTo(baseX, baseY + toPx(size, 0.28));
        ctx.lineTo(baseX + width, baseY + toPx(size, 0.28));
        ctx.stroke();

        const doorW = toPx(size, 0.16);
        const doorH = toPx(size, 0.27);
        const doorX = cx - Math.round(doorW / 2);
        const doorY = groundY - doorH;
        ctx.fillStyle = '#353b48';
        ctx.fillRect(doorX - 2, doorY - 2, doorW + 4, doorH + 2);
        ctx.fillStyle = '#7f8c8d';
        ctx.fillRect(doorX, doorY, doorW, doorH);
        ctx.fillStyle = '#3498db';
        ctx.fillRect(doorX + 4, doorY + 4, doorW - 8, 8);
        ctx.fillStyle = '#e74c3c';
        ctx.fillRect(doorX + doorW - 7, doorY + 13, 3, 3);

        function windowAt(x, y) {
            const w = toPx(size, 0.15);
            const h = toPx(size, 0.1);
            ctx.fillStyle = '#2c3e50';
            ctx.fillRect(x - 2, y - 2, w + 4, h + 4);
            ctx.fillStyle = 'rgba(52, 152, 219, 0.75)';
            ctx.fillRect(x, y, w, h);
            ctx.fillStyle = '#2c3e50';
            ctx.fillRect(x + Math.round(w / 2) - 1, y, 2, h);
        }

        windowAt(baseX + toPx(size, 0.08), baseY + toPx(size, 0.2));
        windowAt(baseX + width - toPx(size, 0.23), baseY + toPx(size, 0.2));

        ctx.strokeStyle = '#2d3436';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(cx + toPx(size, 0.18), baseY - 5);
        ctx.lineTo(cx + toPx(size, 0.18), baseY - toPx(size, 0.17));
        ctx.stroke();
        ctx.fillStyle = '#c0392b';
        ctx.beginPath();
        ctx.arc(cx + toPx(size, 0.18), baseY - toPx(size, 0.17), 2, 0, Math.PI * 2);
        ctx.fill();
    }

    function drawFactory(ctx, size) {
        const x = toPx(size, 0.1);
        const y = toPx(size, 0.32);
        const w = toPx(size, 0.76);
        const h = toPx(size, 0.5);
        const ground = toPx(size, 0.86);

        const wall = ctx.createLinearGradient(x, y, x, y + h);
        wall.addColorStop(0, '#7f8c8d');
        wall.addColorStop(0.5, '#95a5a6');
        wall.addColorStop(1, '#535c68');
        ctx.fillStyle = wall;
        ctx.fillRect(x, y, w, h);

        ctx.fillStyle = '#f39c12';
        ctx.fillRect(x, y + 10, w, 4);
        ctx.strokeStyle = '#d35400';
        ctx.lineWidth = 1;
        ctx.beginPath();
        for (let i = 0; i < w; i += 8) {
            ctx.moveTo(x + i, y + 10);
            ctx.lineTo(x + i - 4, y + 14);
        }
        ctx.stroke();

        const doorW = toPx(size, 0.34);
        const doorH = toPx(size, 0.36);
        const doorX = x + toPx(size, 0.13);
        const doorY = ground - doorH;
        ctx.fillStyle = '#2c3e50';
        ctx.fillRect(doorX - 4, doorY - 4, doorW + 8, doorH + 4);
        const door = ctx.createLinearGradient(doorX, doorY, doorX, ground);
        door.addColorStop(0, '#bdc3c7');
        door.addColorStop(1, '#7f8c8d');
        ctx.fillStyle = door;
        ctx.fillRect(doorX, doorY, doorW, doorH);
        ctx.strokeStyle = 'rgba(0,0,0,0.25)';
        for (let i = 8; i < doorH; i += 8) {
            ctx.beginPath();
            ctx.moveTo(doorX, doorY + i);
            ctx.lineTo(doorX + doorW, doorY + i);
            ctx.stroke();
        }

        const chimX = x + w - toPx(size, 0.16);
        ctx.fillStyle = '#5d6d7e';
        ctx.fillRect(chimX, y - toPx(size, 0.16), toPx(size, 0.06), toPx(size, 0.16));
        ctx.fillRect(chimX + toPx(size, 0.08), y - toPx(size, 0.12), toPx(size, 0.06), toPx(size, 0.12));
        ctx.fillStyle = '#2c3e50';
        ctx.fillRect(chimX - 1, y - toPx(size, 0.16), toPx(size, 0.06) + 2, 4);
        ctx.fillRect(chimX + toPx(size, 0.08) - 1, y - toPx(size, 0.12), toPx(size, 0.06) + 2, 4);
    }

    function drawResearchLab(ctx, size) {
        const x = toPx(size, 0.12);
        const y = toPx(size, 0.34);
        const w = toPx(size, 0.72);
        const h = toPx(size, 0.46);
        const ground = toPx(size, 0.86);

        const wall = ctx.createLinearGradient(x, y, x, y + h);
        wall.addColorStop(0, '#ecf0f1');
        wall.addColorStop(1, '#bdc3c7');
        ctx.fillStyle = wall;
        ctx.fillRect(x, y, w, h);

        ctx.fillStyle = '#3498db';
        ctx.fillRect(x, y + 9, w, 3);
        ctx.fillStyle = '#2c3e50';
        ctx.fillRect(x - 2, ground - 5, w + 4, 5);

        const doorW = toPx(size, 0.2);
        const doorH = toPx(size, 0.23);
        const doorX = x + Math.round((w - doorW) / 2);
        const doorY = ground - doorH;
        ctx.fillStyle = '#34495e';
        ctx.fillRect(doorX - 3, doorY - 3, doorW + 6, doorH + 3);
        ctx.fillStyle = '#dff9fb';
        ctx.fillRect(doorX, doorY, doorW, doorH);
        ctx.fillStyle = '#bdc3c7';
        ctx.fillRect(doorX + Math.round(doorW / 2) - 1, doorY, 2, doorH);
        ctx.fillStyle = '#e74c3c';
        ctx.fillRect(doorX + doorW + 4, doorY + 10, 3, 5);

        const winX = x + toPx(size, 0.05);
        const winY = y + toPx(size, 0.18);
        const winW = toPx(size, 0.18);
        const winH = toPx(size, 0.12);
        ctx.fillStyle = '#34495e';
        ctx.fillRect(winX - 2, winY - 2, winW + 4, winH + 4);
        ctx.fillStyle = '#81ecec';
        ctx.fillRect(winX, winY, winW, winH);

        const domeX = x + w - toPx(size, 0.14);
        ctx.fillStyle = '#ecf0f1';
        ctx.beginPath();
        ctx.arc(domeX, y, toPx(size, 0.1), Math.PI, 0);
        ctx.fill();
        ctx.strokeStyle = '#bdc3c7';
        ctx.lineWidth = 1;
        ctx.stroke();

        const antX = x + toPx(size, 0.13);
        ctx.strokeStyle = '#7f8c8d';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(antX, y);
        ctx.lineTo(antX, y - toPx(size, 0.14));
        ctx.stroke();
        ctx.fillStyle = '#e74c3c';
        ctx.beginPath();
        ctx.arc(antX, y - toPx(size, 0.14), 2, 0, Math.PI * 2);
        ctx.fill();
    }

    function drawDormitory(ctx, size) {
        const x = toPx(size, 0.08);
        const y = toPx(size, 0.16);
        const w = toPx(size, 0.82);
        const h = toPx(size, 0.7);
        const ground = toPx(size, 0.88);

        const wall = ctx.createLinearGradient(x, y, x, y + h);
        wall.addColorStop(0, '#99a8b2');
        wall.addColorStop(0.55, '#7e8e99');
        wall.addColorStop(1, '#657883');
        ctx.fillStyle = wall;
        ctx.fillRect(x, y, w, h);

        ctx.fillStyle = '#4f5f69';
        ctx.fillRect(x - 3, y - 7, w + 6, 8);
        ctx.fillStyle = '#556770';
        ctx.fillRect(x - 2, ground - 6, w + 4, 6);

        const sideW = Math.max(3, toPx(size, 0.03));
        ctx.fillStyle = 'rgba(34, 43, 50, 0.35)';
        ctx.fillRect(x + w - sideW, y, sideW, h);

        const floors = 4;
        const floorGap = Math.round(h / floors);
        ctx.fillStyle = 'rgba(54, 67, 76, 0.65)';
        for (let f = 1; f < floors; f++) {
            const fy = y + (f * floorGap);
            ctx.fillRect(x, fy - 1, w, 3);
        }

        const cols = 7;
        const rows = 4;
        const winW = toPx(size, 0.066);
        const winH = toPx(size, 0.072);
        const padX = toPx(size, 0.038);
        const padTop = toPx(size, 0.055);
        const gapX = Math.max(2, Math.floor((w - (padX * 2) - (winW * cols)) / (cols - 1)));
        const gapY = Math.max(5, Math.floor((h - padTop - toPx(size, 0.18) - (winH * rows)) / (rows - 1)));
        for (let ry = 0; ry < rows; ry++) {
            for (let cx = 0; cx < cols; cx++) {
                if (ry === rows - 1 && (cx === 3 || cx === 4)) continue;
                const wx = x + padX + (cx * (winW + gapX));
                const wy = y + padTop + (ry * (winH + gapY));
                const glass = ctx.createLinearGradient(wx, wy, wx, wy + winH);
                glass.addColorStop(0, '#2f4658');
                glass.addColorStop(1, '#1c2b36');
                ctx.fillStyle = '#3f4e58';
                ctx.fillRect(wx - 1, wy - 1, winW + 2, winH + 2);
                ctx.fillStyle = glass;
                ctx.fillRect(wx, wy, winW, winH);
                ctx.fillStyle = 'rgba(173, 216, 230, 0.22)';
                ctx.fillRect(wx + 1, wy + 1, Math.max(2, Math.floor(winW * 0.22)), winH - 2);
            }
        }

        const doorW = toPx(size, 0.19);
        const doorH = toPx(size, 0.22);
        const doorX = x + Math.round((w - doorW) / 2);
        const doorY = ground - doorH;
        ctx.fillStyle = '#41535e';
        ctx.fillRect(doorX - 2, doorY - 2, doorW + 4, doorH + 2);
        ctx.fillStyle = '#9eb0ba';
        ctx.fillRect(doorX, doorY, doorW, doorH);
        ctx.fillStyle = '#294357';
        ctx.fillRect(doorX + 3, doorY + 3, Math.round((doorW / 2) - 4), doorH - 8);
        ctx.fillRect(doorX + Math.round(doorW / 2) + 1, doorY + 3, Math.round((doorW / 2) - 4), doorH - 8);

        ctx.fillStyle = '#60717b';
        ctx.fillRect(doorX - toPx(size, 0.06), ground - toPx(size, 0.02), doorW + toPx(size, 0.12), toPx(size, 0.03));
    }

    function drawApartmentLarge(ctx, size) {
        const x = toPx(size, 0.1);
        const y = toPx(size, 0.08);
        const w = toPx(size, 0.8);
        const h = toPx(size, 0.78);
        const ground = toPx(size, 0.88);

        const wall = ctx.createLinearGradient(x, y, x, y + h);
        wall.addColorStop(0, '#9aa6b3');
        wall.addColorStop(0.55, '#7f8d9c');
        wall.addColorStop(1, '#657483');
        ctx.fillStyle = wall;
        ctx.fillRect(x, y, w, h);

        ctx.fillStyle = '#4f5b68';
        ctx.fillRect(x - 3, y - 7, w + 6, 8);
        ctx.fillRect(x - 2, ground - 6, w + 4, 6);

        ctx.fillStyle = 'rgba(26, 33, 41, 0.34)';
        ctx.fillRect(x + w - Math.max(3, toPx(size, 0.035)), y, Math.max(3, toPx(size, 0.035)), h);

        const cols = 6;
        const rows = 5;
        const winW = toPx(size, 0.086);
        const winH = toPx(size, 0.075);
        const padX = toPx(size, 0.05);
        const padTop = toPx(size, 0.07);
        const gapX = Math.max(2, Math.floor((w - (padX * 2) - (winW * cols)) / (cols - 1)));
        const gapY = Math.max(4, Math.floor((h - padTop - toPx(size, 0.2) - (winH * rows)) / (rows - 1)));

        for (let ry = 0; ry < rows; ry++) {
            for (let cx = 0; cx < cols; cx++) {
                if (ry === rows - 1 && (cx === 2 || cx === 3)) continue;
                const wx = x + padX + (cx * (winW + gapX));
                const wy = y + padTop + (ry * (winH + gapY));
                const glass = ctx.createLinearGradient(wx, wy, wx, wy + winH);
                glass.addColorStop(0, '#2f4558');
                glass.addColorStop(1, '#1b2a36');
                ctx.fillStyle = '#3e4c58';
                ctx.fillRect(wx - 1, wy - 1, winW + 2, winH + 2);
                ctx.fillStyle = glass;
                ctx.fillRect(wx, wy, winW, winH);
                ctx.fillStyle = 'rgba(176, 214, 238, 0.2)';
                ctx.fillRect(wx + 1, wy + 1, Math.max(2, Math.floor(winW * 0.24)), winH - 2);
            }
        }

        const doorW = toPx(size, 0.2);
        const doorH = toPx(size, 0.23);
        const doorX = x + Math.round((w - doorW) / 2);
        const doorY = ground - doorH;
        ctx.fillStyle = '#41515d';
        ctx.fillRect(doorX - 2, doorY - 2, doorW + 4, doorH + 2);
        ctx.fillStyle = '#9fb0bb';
        ctx.fillRect(doorX, doorY, doorW, doorH);
        ctx.fillStyle = '#294456';
        ctx.fillRect(doorX + 3, doorY + 3, Math.round((doorW / 2) - 4), doorH - 8);
        ctx.fillRect(doorX + Math.round(doorW / 2) + 1, doorY + 3, Math.round((doorW / 2) - 4), doorH - 8);
    }

    function drawShopStore(ctx, size) {
        const x = toPx(size, 0.12);
        const y = toPx(size, 0.34);
        const w = toPx(size, 0.76);
        const h = toPx(size, 0.44);
        const ground = toPx(size, 0.88);

        const wall = ctx.createLinearGradient(x, y, x, y + h);
        wall.addColorStop(0, '#f1e2bf');
        wall.addColorStop(1, '#d2c09d');
        ctx.fillStyle = wall;
        ctx.fillRect(x, y, w, h);

        ctx.fillStyle = '#61463a';
        ctx.fillRect(x - 2, y - 7, w + 4, 8);

        ctx.fillStyle = '#b64b3d';
        ctx.fillRect(x, y + toPx(size, 0.1), w, toPx(size, 0.12));
        ctx.fillStyle = '#f2d6a1';
        for (let i = 0; i < 6; i++) {
            const sx = x + Math.round((w / 6) * i);
            ctx.fillRect(sx, y + toPx(size, 0.1), Math.max(4, Math.round(w / 12)), toPx(size, 0.12));
        }

        const winY = y + toPx(size, 0.26);
        const winH = toPx(size, 0.16);
        const winW = toPx(size, 0.22);
        const leftX = x + toPx(size, 0.06);
        const rightX = x + w - toPx(size, 0.06) - winW;

        [leftX, rightX].forEach((wx) => {
            ctx.fillStyle = '#5f4c3e';
            ctx.fillRect(wx - 2, winY - 2, winW + 4, winH + 4);
            const glass = ctx.createLinearGradient(wx, winY, wx, winY + winH);
            glass.addColorStop(0, '#8ed5e5');
            glass.addColorStop(1, '#5aa8bf');
            ctx.fillStyle = glass;
            ctx.fillRect(wx, winY, winW, winH);
            ctx.fillStyle = 'rgba(255,255,255,0.26)';
            ctx.fillRect(wx + 2, winY + 2, 3, winH - 4);
        });

        const doorW = toPx(size, 0.16);
        const doorH = toPx(size, 0.2);
        const doorX = x + Math.round((w - doorW) / 2);
        const doorY = ground - doorH;
        ctx.fillStyle = '#5f4b3d';
        ctx.fillRect(doorX, doorY, doorW, doorH);
        ctx.fillStyle = '#b99f82';
        ctx.fillRect(doorX + 2, doorY + 2, doorW - 4, doorH - 4);
        ctx.fillStyle = '#705945';
        ctx.fillRect(doorX + doorW - 4, doorY + Math.round(doorH / 2), 2, 2);

        ctx.fillStyle = '#2e7d32';
        ctx.fillRect(x - toPx(size, 0.04), ground - toPx(size, 0.025), w + toPx(size, 0.08), toPx(size, 0.04));
    }

    function drawTaxOffice(ctx, size) {
        const x = toPx(size, 0.1);
        const y = toPx(size, 0.2);
        const w = toPx(size, 0.8);
        const h = toPx(size, 0.64);
        const ground = toPx(size, 0.88);

        // Main facade
        const wall = ctx.createLinearGradient(x, y, x, y + h);
        wall.addColorStop(0, '#dfe7ee');
        wall.addColorStop(0.5, '#c9d4de');
        wall.addColorStop(1, '#aebdca');
        ctx.fillStyle = wall;
        ctx.fillRect(x, y, w, h);

        // Roof and base strips
        ctx.fillStyle = '#1f6b47';
        ctx.fillRect(x - 3, y - toPx(size, 0.06), w + 6, toPx(size, 0.065));
        ctx.fillStyle = '#0f5132';
        ctx.fillRect(x - 1, y + toPx(size, 0.08), w + 2, toPx(size, 0.045));
        ctx.fillStyle = '#7f93a2';
        ctx.fillRect(x - 1, ground - toPx(size, 0.055), w + 2, toPx(size, 0.055));

        // Pillars
        ctx.fillStyle = '#e7edf3';
        const pillarW = Math.max(3, toPx(size, 0.05));
        const pillarTop = y + toPx(size, 0.16);
        const pillarH = toPx(size, 0.52);
        const p1 = x + toPx(size, 0.12);
        const p2 = x + toPx(size, 0.3);
        const p3 = x + toPx(size, 0.48);
        const p4 = x + toPx(size, 0.66);
        [p1, p2, p3, p4].forEach((px) => {
            ctx.fillRect(px, pillarTop, pillarW, pillarH);
        });

        // Door
        const doorW = toPx(size, 0.19);
        const doorH = toPx(size, 0.24);
        const doorX = x + Math.round((w - doorW) / 2);
        const doorY = ground - doorH;
        ctx.fillStyle = '#324552';
        ctx.fillRect(doorX - 2, doorY - 2, doorW + 4, doorH + 2);
        const doorGrad = ctx.createLinearGradient(doorX, doorY, doorX, doorY + doorH);
        doorGrad.addColorStop(0, '#8eb6cf');
        doorGrad.addColorStop(1, '#5f879f');
        ctx.fillStyle = doorGrad;
        ctx.fillRect(doorX, doorY, doorW, doorH);
        ctx.fillStyle = 'rgba(255,255,255,0.25)';
        ctx.fillRect(doorX + 2, doorY + 2, Math.max(3, toPx(size, 0.03)), doorH - 4);

        // Window rows
        const winW = toPx(size, 0.11);
        const winH = toPx(size, 0.08);
        const winY1 = y + toPx(size, 0.25);
        const winY2 = y + toPx(size, 0.4);
        const leftWinX = x + toPx(size, 0.16);
        const rightWinX = x + w - toPx(size, 0.16) - winW;
        [leftWinX, rightWinX].forEach((wx) => {
            [winY1, winY2].forEach((wy) => {
                ctx.fillStyle = '#445463';
                ctx.fillRect(wx - 1, wy - 1, winW + 2, winH + 2);
                const glass = ctx.createLinearGradient(wx, wy, wx, wy + winH);
                glass.addColorStop(0, '#a7d4ea');
                glass.addColorStop(1, '#6794ad');
                ctx.fillStyle = glass;
                ctx.fillRect(wx, wy, winW, winH);
            });
        });

        // TAX sign
        const signW = toPx(size, 0.3);
        const signH = toPx(size, 0.1);
        const signX = x + Math.round((w - signW) / 2);
        const signY = y - toPx(size, 0.03);
        ctx.fillStyle = '#14532d';
        ctx.fillRect(signX, signY, signW, signH);
        ctx.fillStyle = '#dcfce7';
        ctx.font = `700 ${Math.max(8, toPx(size, 0.07))}px sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('TAX', signX + Math.round(signW / 2), signY + Math.round(signH / 2));
    }

    function drawSupplyDepot(ctx, size) {
        const x = toPx(size, 0.1);
        const y = toPx(size, 0.34);
        const w = toPx(size, 0.76);
        const h = toPx(size, 0.44);
        const ground = toPx(size, 0.86);

        ctx.fillStyle = '#7f8c8d';
        ctx.fillRect(x, y, w, h);
        ctx.fillStyle = 'rgba(0,0,0,0.1)';
        for (let i = 0; i < w; i += 8) {
            ctx.fillRect(x + i, y, 2, h);
        }
        ctx.fillStyle = '#2d3436';
        ctx.beginPath();
        ctx.moveTo(x - 5, y);
        ctx.lineTo(x + w + 5, y);
        ctx.lineTo(x + w, y - 8);
        ctx.lineTo(x, y - 8);
        ctx.closePath();
        ctx.fill();

        const doorW = toPx(size, 0.22);
        const doorH = toPx(size, 0.26);
        const doorY = ground - toPx(size, 0.16) - doorH;
        const leftDoor = x + toPx(size, 0.18);
        const rightDoor = x + w - toPx(size, 0.18) - doorW;
        [leftDoor, rightDoor].forEach((doorX) => {
            ctx.fillStyle = '#2d3436';
            ctx.fillRect(doorX - 2, doorY - 2, doorW + 4, doorH + 2);
            ctx.fillStyle = '#95a5a6';
            ctx.fillRect(doorX, doorY, doorW, doorH);
            ctx.strokeStyle = '#7f8c8d';
            ctx.lineWidth = 1;
            for (let i = 6; i < doorH; i += 7) {
                ctx.beginPath();
                ctx.moveTo(doorX, doorY + i);
                ctx.lineTo(doorX + doorW, doorY + i);
                ctx.stroke();
            }
        });

        ctx.fillStyle = '#636e72';
        ctx.fillRect(x, ground - toPx(size, 0.16), w, toPx(size, 0.16));
        ctx.fillStyle = '#f1c40f';
        ctx.fillRect(x, ground - toPx(size, 0.16), w, 3);
    }

    function drawAirportScene(ctx, width, height) {
        // Canvas is landscape 4:2 ratio (e.g. 512x256)
        // Top half = facilities (transparent bg), Bottom half = runway
        // Background is TRANSPARENT so ground tiles show through
        const midY = Math.floor(height * 0.5);
        const topH = midY;

        ctx.clearRect(0, 0, width, height);

        // ====== TOP HALF: BUILDINGS ONLY (transparent background) ======

        // --- Terminal building (centered-left) ---
        const terminalW = Math.round(width * 0.36);
        const terminalH = Math.round(topH * 0.42);
        const terminalX = Math.round(width * 0.32) - Math.round(terminalW * 0.5);
        const terminalY = Math.round(topH * 0.18);
        const terminalBody = ctx.createLinearGradient(terminalX, terminalY, terminalX, terminalY + terminalH);
        terminalBody.addColorStop(0, '#6b7380');
        terminalBody.addColorStop(1, '#4a525f');
        ctx.fillStyle = terminalBody;
        ctx.fillRect(terminalX, terminalY, terminalW, terminalH);

        // Terminal roof
        const roofH = Math.max(5, Math.round(terminalH * 0.18));
        ctx.fillStyle = '#2e3642';
        ctx.fillRect(terminalX - 3, terminalY - roofH, terminalW + 6, roofH);

        // Terminal base
        ctx.fillStyle = '#5a6371';
        const tBaseH = Math.max(6, Math.round(terminalH * 0.14));
        ctx.fillRect(terminalX, terminalY + terminalH - tBaseH, terminalW, tBaseH);

        // Terminal windows
        const winY = terminalY + Math.round(terminalH * 0.18);
        const winH = Math.max(5, Math.round(terminalH * 0.32));
        const winCols = 8;
        const winGap = Math.max(4, Math.round(terminalW * 0.02));
        const winW = Math.round((terminalW - (winGap * (winCols + 1))) / winCols);
        for (let i = 0; i < winCols; i++) {
            const wx = terminalX + winGap + i * (winW + winGap);
            ctx.fillStyle = '#15283f';
            ctx.fillRect(wx, winY, winW, winH);
            ctx.fillStyle = 'rgba(96, 165, 250, 0.26)';
            ctx.fillRect(wx, winY, Math.max(2, Math.round(winW * 0.22)), winH);
        }

        // --- Hangars (left and right) ---
        const drawHangar = (cx) => {
            const hangarW = Math.round(width * 0.12);
            const hangarH = Math.round(topH * 0.30);
            const halfW = Math.round(hangarW * 0.5);
            const baseY = Math.round(topH * 0.92);
            const roofTopY = baseY - hangarH;
            const left = cx - halfW;
            ctx.fillStyle = '#596272';
            ctx.beginPath();
            ctx.moveTo(left, baseY);
            ctx.lineTo(left + hangarW, baseY);
            ctx.lineTo(cx + Math.round(hangarW * 0.42), roofTopY);
            ctx.lineTo(cx - Math.round(hangarW * 0.42), roofTopY);
            ctx.closePath();
            ctx.fill();
            ctx.fillStyle = '#1b222c';
            ctx.fillRect(
                cx - Math.round(hangarW * 0.28),
                roofTopY + Math.round(hangarH * 0.26),
                Math.round(hangarW * 0.56),
                Math.round(hangarH * 0.50)
            );
        };
        drawHangar(Math.round(width * 0.10));
        drawHangar(Math.round(width * 0.90));

        // --- Control tower (right side, GROUNDED, transparent behind) ---
        const shaftW = Math.round(width * 0.03);
        const shaftH = Math.round(topH * 0.52);
        const shaftX = Math.round(width * 0.72);
        const shaftBottomY = Math.round(topH * 0.92);
        const shaftTopY = shaftBottomY - shaftH;
        ctx.fillStyle = '#576172';
        ctx.fillRect(shaftX, shaftTopY, shaftW, shaftH);

        // Tower observation head
        const headW = Math.round(width * 0.08);
        const headH = Math.round(topH * 0.14);
        const headX = shaftX - Math.round((headW - shaftW) * 0.5);
        const headY = shaftTopY - headH + 2;
        ctx.fillStyle = '#667287';
        ctx.fillRect(headX, headY, headW, headH);

        // Tower glass
        const towerGlass = ctx.createLinearGradient(0, headY, 0, headY + headH);
        towerGlass.addColorStop(0, '#4d88ff');
        towerGlass.addColorStop(1, '#294d8f');
        ctx.fillStyle = towerGlass;
        ctx.fillRect(
            headX + Math.round(headW * 0.08),
            headY + Math.round(headH * 0.20),
            Math.round(headW * 0.84),
            Math.round(headH * 0.54)
        );

        // Tower base (grounded)
        ctx.fillStyle = '#4a525f';
        ctx.fillRect(shaftX - 2, shaftBottomY - 3, shaftW + 4, 5);

        // --- Taxiway line (dashed yellow near bottom of top half) ---
        const taxiY = Math.round(topH - Math.max(6, height * 0.025));
        ctx.strokeStyle = '#c99722';
        ctx.lineWidth = Math.max(2, Math.round(height * 0.007));
        ctx.setLineDash([Math.max(8, Math.round(width * 0.025)), Math.max(6, Math.round(width * 0.018))]);
        ctx.beginPath();
        ctx.moveTo(Math.round(width * 0.04), taxiY);
        ctx.lineTo(Math.round(width * 0.96), taxiY);
        ctx.stroke();
        ctx.setLineDash([]);

        // ====== SEPARATOR ======
        ctx.fillStyle = '#5d6674';
        ctx.fillRect(0, midY - 1, width, 3);

        // ====== BOTTOM HALF: RUNWAY ======
        const runwayY = midY;
        const runwayH = height - runwayY;

        // Runway surface
        const runwayGrad = ctx.createLinearGradient(0, runwayY, 0, height);
        runwayGrad.addColorStop(0, '#3b434f');
        runwayGrad.addColorStop(1, '#2b313a');
        ctx.fillStyle = runwayGrad;
        ctx.fillRect(0, runwayY, width, runwayH);

        // Runway shoulders
        const shoulderH = Math.max(4, Math.round(runwayH * 0.10));
        ctx.fillStyle = 'rgba(18, 23, 30, 0.4)';
        ctx.fillRect(0, runwayY, width, shoulderH);
        ctx.fillRect(0, height - shoulderH, width, shoulderH);

        // Runway edge lines (horizontal white)
        const edgeTop = runwayY + shoulderH;
        const edgeBot = height - shoulderH;
        ctx.strokeStyle = 'rgba(241, 245, 249, 0.45)';
        ctx.lineWidth = Math.max(2, Math.round(height * 0.005));
        ctx.beginPath();
        ctx.moveTo(0, edgeTop);
        ctx.lineTo(width, edgeTop);
        ctx.moveTo(0, edgeBot);
        ctx.lineTo(width, edgeBot);
        ctx.stroke();

        // Center dashed line (yellow, horizontal)
        const runwayCenterY = Math.round(runwayY + runwayH * 0.5);
        ctx.strokeStyle = '#e4b523';
        ctx.lineWidth = Math.max(2, Math.round(height * 0.012));
        ctx.setLineDash([Math.max(12, Math.round(width * 0.04)), Math.max(8, Math.round(width * 0.03))]);
        ctx.beginPath();
        ctx.moveTo(0, runwayCenterY);
        ctx.lineTo(width, runwayCenterY);
        ctx.stroke();
        ctx.setLineDash([]);

        // Threshold bars (vertical white bars at left/right ends)
        ctx.fillStyle = 'rgba(236, 240, 241, 0.82)';
        const barW = Math.max(3, Math.round(height * 0.012));
        const barH = Math.max(6, Math.round(runwayH * 0.32));
        const barY = runwayY + Math.round((runwayH - barH) * 0.5);
        const barGap = Math.max(4, Math.round(width * 0.010));
        for (let i = 0; i < 6; i++) {
            const lx = Math.round(width * 0.02) + i * (barW + barGap);
            const rx = Math.round(width * 0.98) - (i + 1) * (barW + barGap);
            ctx.fillRect(lx, barY, barW, barH);
            ctx.fillRect(rx, barY, barW, barH);
        }

        // Runway edge lights (small blue dots)
        const lightStep = Math.max(10, Math.round(width * 0.03));
        ctx.fillStyle = '#7dd3fc';
        for (let x = 6; x < width; x += lightStep) {
            ctx.globalAlpha = 0.85;
            ctx.fillRect(x, edgeTop + 2, 2, 2);
            ctx.fillRect(x, edgeBot - 4, 2, 2);
        }
        ctx.globalAlpha = 1;
    }

    const AIRPORT_GRID_COLS = 4;
    const AIRPORT_GRID_ROWS = 2;

    function getAirportPartOffset(partId) {
        const key = String(partId || '').trim();
        if (key === 'airport') return { col: 0, row: 0 };
        if (key === 'airport_tr') return { col: 1, row: 0 };
        if (key === 'airport_bl') return { col: 0, row: 1 };
        if (key === 'airport_br') return { col: 1, row: 1 };

        const m = /^airport_r([01])c([0-3])$/.exec(key);
        if (!m) return null;
        const row = Math.max(0, Math.min(AIRPORT_GRID_ROWS - 1, Number(m[1]) || 0));
        const col = Math.max(0, Math.min(AIRPORT_GRID_COLS - 1, Number(m[2]) || 0));
        return { col, row };
    }

    function drawAirportPart(ctx, size, partId) {
        const part = getAirportPartOffset(partId);
        if (!part) return;

        const fullWidth = size * AIRPORT_GRID_COLS;
        const fullHeight = size * AIRPORT_GRID_ROWS;
        const cacheKey = `${fullWidth}x${fullHeight}`;
        let fullCanvas = AIRPORT_SCENE_CACHE.get(cacheKey) || null;
        if (!fullCanvas) {
            fullCanvas = createRectCanvas(fullWidth, fullHeight);
            const fullCtx = fullCanvas.getContext('2d');
            if (!fullCtx) return;
            drawAirportScene(fullCtx, fullWidth, fullHeight);
            AIRPORT_SCENE_CACHE.set(cacheKey, fullCanvas);
        }

        const sx = Math.round(part.col * size);
        const sy = Math.round(part.row * size);
        ctx.drawImage(fullCanvas, sx, sy, size, size, 0, 0, size, size);
    }

    const PARK_PLAZA_GRID_COLS = 2;
    const PARK_PLAZA_GRID_ROWS = 2;

    function getParkPlazaPartOffset(partId) {
        const key = String(partId || '').trim();
        if (key === 'park_plaza') return { col: 0, row: 0 };
        if (key === 'park_plaza_tr') return { col: 1, row: 0 };
        if (key === 'park_plaza_bl') return { col: 0, row: 1 };
        if (key === 'park_plaza_br') return { col: 1, row: 1 };
        return null;
    }

    function drawParkPlazaScene(ctx, width, height) {
        ctx.clearRect(0, 0, width, height);

        const grass = ctx.createLinearGradient(0, 0, 0, height);
        grass.addColorStop(0, '#4a8f4f');
        grass.addColorStop(1, '#34713d');
        ctx.fillStyle = grass;
        ctx.fillRect(0, 0, width, height);

        ctx.fillStyle = '#2d5e35';
        for (let i = 0; i < 36; i++) {
            const rx = Math.floor((i * 71) % width);
            const ry = Math.floor((i * 53) % height);
            ctx.fillRect(rx, ry, 2, 2);
        }

        const pathW = Math.max(10, Math.round(width * 0.11));
        const pathH = Math.max(10, Math.round(height * 0.11));
        ctx.fillStyle = '#c8b48d';
        ctx.fillRect(Math.round((width - pathW) * 0.5), 0, pathW, height);
        ctx.fillRect(0, Math.round((height - pathH) * 0.5), width, pathH);

        const pondW = Math.max(26, Math.round(width * 0.22));
        const pondH = Math.max(18, Math.round(height * 0.14));
        const pondX = Math.round(width * 0.65);
        const pondY = Math.round(height * 0.18);
        ctx.fillStyle = '#6bc5f3';
        ctx.beginPath();
        ctx.ellipse(pondX, pondY, pondW, pondH, -0.1, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = 'rgba(255,255,255,0.45)';
        ctx.lineWidth = 2;
        ctx.stroke();

        const drawTreeCluster = (cx, cy, scale) => {
            const s = Math.max(0.6, Number(scale) || 1);
            ctx.fillStyle = '#5a3f30';
            ctx.fillRect(cx - 2 * s, cy - 8 * s, 4 * s, 10 * s);
            ctx.fillStyle = '#2e7d32';
            ctx.beginPath();
            ctx.arc(cx, cy - 12 * s, 8 * s, 0, Math.PI * 2);
            ctx.arc(cx - 6 * s, cy - 9 * s, 6 * s, 0, Math.PI * 2);
            ctx.arc(cx + 7 * s, cy - 9 * s, 6 * s, 0, Math.PI * 2);
            ctx.fill();
        };

        drawTreeCluster(Math.round(width * 0.2), Math.round(height * 0.28), 1.1);
        drawTreeCluster(Math.round(width * 0.22), Math.round(height * 0.78), 1.2);
        drawTreeCluster(Math.round(width * 0.78), Math.round(height * 0.8), 1.05);
        drawTreeCluster(Math.round(width * 0.82), Math.round(height * 0.42), 0.95);

        ctx.fillStyle = '#7a5b3f';
        ctx.fillRect(Math.round(width * 0.36), Math.round(height * 0.22), Math.round(width * 0.08), 3);
        ctx.fillRect(Math.round(width * 0.56), Math.round(height * 0.73), Math.round(width * 0.08), 3);
    }

    function drawParkPlazaPart(ctx, size, partId) {
        const part = getParkPlazaPartOffset(partId);
        if (!part) return;

        const fullWidth = size * PARK_PLAZA_GRID_COLS;
        const fullHeight = size * PARK_PLAZA_GRID_ROWS;
        const cacheKey = `${fullWidth}x${fullHeight}`;
        let fullCanvas = PARK_PLAZA_SCENE_CACHE.get(cacheKey) || null;
        if (!fullCanvas) {
            fullCanvas = createRectCanvas(fullWidth, fullHeight);
            const fullCtx = fullCanvas.getContext('2d');
            if (!fullCtx) return;
            drawParkPlazaScene(fullCtx, fullWidth, fullHeight);
            PARK_PLAZA_SCENE_CACHE.set(cacheKey, fullCanvas);
        }

        const sx = Math.round(part.col * size);
        const sy = Math.round(part.row * size);
        ctx.drawImage(fullCanvas, sx, sy, size, size, 0, 0, size, size);
    }

    function drawCommandCenter(ctx, size) {
        const w = toPx(size, 0.62);
        const h = toPx(size, 0.62);
        const x = Math.round((size - w) / 2);
        const y = toPx(size, 0.24);
        const ground = toPx(size, 0.88);
        const cx = Math.round(size / 2);

        const wall = ctx.createLinearGradient(x, y, x, y + h);
        wall.addColorStop(0, '#95a5a6');
        wall.addColorStop(1, '#7f8c8d');
        ctx.fillStyle = wall;
        ctx.fillRect(x, y, w, h);
        ctx.fillStyle = '#535c68';
        ctx.fillRect(x - 5, y, 10, h);
        ctx.fillRect(x + w - 5, y, 10, h);
        ctx.fillRect(x, y - 5, w, 10);

        const winW = toPx(size, 0.34);
        const winH = toPx(size, 0.14);
        const winX = cx - Math.round(winW / 2);
        const winY = y + toPx(size, 0.12);
        ctx.fillStyle = '#2c3e50';
        ctx.fillRect(winX - 3, winY - 3, winW + 6, winH + 6);
        ctx.fillStyle = '#3498db';
        ctx.fillRect(winX, winY, winW, winH);

        const doorW = toPx(size, 0.16);
        const doorH = toPx(size, 0.15);
        const doorX = cx - Math.round(doorW / 2);
        const doorY = ground - doorH;
        ctx.fillStyle = '#2d3436';
        ctx.fillRect(doorX - 3, doorY - 3, doorW + 6, doorH + 3);
        ctx.fillStyle = '#bdc3c7';
        ctx.fillRect(doorX, doorY, doorW, doorH);
        ctx.fillStyle = '#7f8c8d';
        ctx.fillRect(cx - 1, doorY, 2, doorH);
        ctx.fillStyle = '#f1c40f';
        ctx.beginPath();
        ctx.moveTo(cx, doorY + 7);
        ctx.lineTo(cx - 6, doorY + 16);
        ctx.lineTo(cx + 6, doorY + 16);
        ctx.closePath();
        ctx.fill();

        const domeX = cx - toPx(size, 0.17);
        ctx.fillStyle = '#ecf0f1';
        ctx.beginPath();
        ctx.arc(domeX, y - 4, toPx(size, 0.09), Math.PI, 0);
        ctx.fill();

        const antX = cx + toPx(size, 0.16);
        ctx.strokeStyle = '#2c3e50';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(antX, y);
        ctx.lineTo(antX, y - toPx(size, 0.18));
        ctx.stroke();
        ctx.fillStyle = '#e74c3c';
        ctx.beginPath();
        ctx.arc(antX, y - toPx(size, 0.18), 2, 0, Math.PI * 2);
        ctx.fill();
    }

    function drawTree(ctx, size) {
        const cx = Math.round(size * 0.5);
        const cy = Math.round(size * 0.68);

        // Trunk (slightly thicker) to keep tree readable on dense ground.
        ctx.fillStyle = '#5D4037';
        ctx.beginPath();
        ctx.moveTo(cx - toPx(size, 0.06), cy + toPx(size, 0.16));
        ctx.quadraticCurveTo(cx - toPx(size, 0.035), cy + toPx(size, 0.045), cx - toPx(size, 0.045), cy - toPx(size, 0.13));
        ctx.lineTo(cx + toPx(size, 0.045), cy - toPx(size, 0.13));
        ctx.quadraticCurveTo(cx + toPx(size, 0.035), cy + toPx(size, 0.045), cx + toPx(size, 0.06), cy + toPx(size, 0.16));
        ctx.closePath();
        ctx.fill();

        const drawBlob = (bx, by, r, color) => {
            ctx.fillStyle = color;
            ctx.beginPath();
            ctx.arc(bx, by, r, 0, Math.PI * 2);
            ctx.arc(bx - r * 0.45, by + r * 0.2, r * 0.55, 0, Math.PI * 2);
            ctx.arc(bx + r * 0.42, by + r * 0.12, r * 0.52, 0, Math.PI * 2);
            ctx.fill();
        };

        drawBlob(cx, cy - toPx(size, 0.17), toPx(size, 0.19), '#1B5E20');
        drawBlob(cx - toPx(size, 0.09), cy - toPx(size, 0.22), toPx(size, 0.15), '#2E7D32');
        drawBlob(cx + toPx(size, 0.1), cy - toPx(size, 0.24), toPx(size, 0.14), '#4CAF50');
        drawBlob(cx + toPx(size, 0.01), cy - toPx(size, 0.28), toPx(size, 0.12), '#66BB6A');

        ctx.fillStyle = '#81C784';
        ctx.beginPath();
        ctx.arc(cx + toPx(size, 0.05), cy - toPx(size, 0.31), toPx(size, 0.05), 0, Math.PI * 2);
        ctx.fill();
    }

    function drawPark(ctx, size) {
        ctx.fillStyle = '#2e7d32';
        ctx.fillRect(toPx(size, 0.18), toPx(size, 0.42), toPx(size, 0.64), toPx(size, 0.36));
        ctx.strokeStyle = '#81c784';
        ctx.lineWidth = 2;
        ctx.strokeRect(toPx(size, 0.18), toPx(size, 0.42), toPx(size, 0.64), toPx(size, 0.36));

        ctx.fillStyle = '#c8e6c9';
        ctx.fillRect(toPx(size, 0.28), toPx(size, 0.48), toPx(size, 0.44), toPx(size, 0.06));

        drawTree(ctx, size);
    }

    function drawMonument(ctx, size) {
        ctx.fillStyle = '#9e9e9e';
        ctx.fillRect(toPx(size, 0.32), toPx(size, 0.52), toPx(size, 0.36), toPx(size, 0.24));
        ctx.fillStyle = '#616161';
        ctx.fillRect(toPx(size, 0.44), toPx(size, 0.28), toPx(size, 0.12), toPx(size, 0.24));
        ctx.fillStyle = '#bdbdbd';
        ctx.beginPath();
        ctx.arc(Math.round(size / 2), toPx(size, 0.25), toPx(size, 0.05), 0, Math.PI * 2);
        ctx.fill();
    }

    function drawTrainStation(ctx, size) {
        ctx.fillStyle = '#78909c';
        ctx.fillRect(toPx(size, 0.12), toPx(size, 0.32), toPx(size, 0.76), toPx(size, 0.3));
        ctx.fillStyle = '#37474f';
        ctx.fillRect(toPx(size, 0.1), toPx(size, 0.28), toPx(size, 0.8), toPx(size, 0.05));
        ctx.fillStyle = '#607d8b';
        ctx.fillRect(0, toPx(size, 0.62), size, toPx(size, 0.08));
        ctx.fillStyle = '#fbc02d';
        ctx.fillRect(0, toPx(size, 0.68), size, 3);
        ctx.fillStyle = '#5d4037';
        ctx.fillRect(0, toPx(size, 0.77), size, toPx(size, 0.02));
        ctx.fillRect(0, toPx(size, 0.82), size, toPx(size, 0.02));
        ctx.fillStyle = '#4e342e';
        ctx.fillRect(toPx(size, 0.56), toPx(size, 0.54), toPx(size, 0.28), toPx(size, 0.14));
        ctx.fillStyle = '#3e2723';
        ctx.fillRect(toPx(size, 0.75), toPx(size, 0.5), toPx(size, 0.1), toPx(size, 0.06));
    }

    function drawDecor(ctx, size) {
        const x = toPx(size, 0.15);
        const y = toPx(size, 0.34);
        const w = toPx(size, 0.7);
        const h = toPx(size, 0.48);
        const ground = toPx(size, 0.86);

        // Front yard base
        ctx.fillStyle = '#6fa95a';
        ctx.fillRect(x - toPx(size, 0.04), ground - toPx(size, 0.1), w + toPx(size, 0.08), toPx(size, 0.12));

        // Main house body
        const wall = ctx.createLinearGradient(x, y, x, y + h);
        wall.addColorStop(0, '#e6d8bf');
        wall.addColorStop(1, '#cdbb9d');
        ctx.fillStyle = wall;
        ctx.fillRect(x, y, w, h);

        // Roof
        ctx.fillStyle = '#8b3f2f';
        ctx.beginPath();
        ctx.moveTo(x - toPx(size, 0.04), y + toPx(size, 0.06));
        ctx.lineTo(x + Math.round(w / 2), y - toPx(size, 0.13));
        ctx.lineTo(x + w + toPx(size, 0.04), y + toPx(size, 0.06));
        ctx.closePath();
        ctx.fill();

        ctx.fillStyle = '#6f2f22';
        ctx.fillRect(x - toPx(size, 0.02), y + toPx(size, 0.06), w + toPx(size, 0.04), toPx(size, 0.03));

        // Chimney
        ctx.fillStyle = '#7a5147';
        ctx.fillRect(x + w - toPx(size, 0.14), y - toPx(size, 0.08), toPx(size, 0.08), toPx(size, 0.14));
        ctx.fillStyle = '#5b3a33';
        ctx.fillRect(x + w - toPx(size, 0.145), y - toPx(size, 0.08), toPx(size, 0.09), toPx(size, 0.02));

        // Windows
        const drawWindow = (wx, wy) => {
            const ww = toPx(size, 0.12);
            const wh = toPx(size, 0.13);
            ctx.fillStyle = '#6f5d4d';
            ctx.fillRect(wx - 2, wy - 2, ww + 4, wh + 4);
            const glass = ctx.createLinearGradient(wx, wy, wx, wy + wh);
            glass.addColorStop(0, '#9ed2e8');
            glass.addColorStop(1, '#6ea9c6');
            ctx.fillStyle = glass;
            ctx.fillRect(wx, wy, ww, wh);
            ctx.fillStyle = 'rgba(255,255,255,0.32)';
            ctx.fillRect(wx + 2, wy + 2, 3, wh - 4);
            ctx.fillStyle = '#6f5d4d';
            ctx.fillRect(wx + Math.round(ww / 2) - 1, wy, 2, wh);
            ctx.fillRect(wx, wy + Math.round(wh / 2) - 1, ww, 2);
        };

        drawWindow(x + toPx(size, 0.08), y + toPx(size, 0.15));
        drawWindow(x + w - toPx(size, 0.2), y + toPx(size, 0.15));

        // Door and stairs
        const doorW = toPx(size, 0.14);
        const doorH = toPx(size, 0.22);
        const doorX = x + Math.round((w - doorW) / 2);
        const doorY = ground - doorH;
        ctx.fillStyle = '#7c583f';
        ctx.fillRect(doorX, doorY, doorW, doorH);
        ctx.fillStyle = '#cfb49a';
        ctx.fillRect(doorX + 2, doorY + 3, doorW - 4, doorH - 6);
        ctx.fillStyle = '#6a4a34';
        ctx.fillRect(doorX + doorW - 5, doorY + Math.round(doorH / 2), 3, 3);

        ctx.fillStyle = '#9f8d72';
        ctx.fillRect(doorX - 4, ground - 3, doorW + 8, 3);
        ctx.fillStyle = '#8a775f';
        ctx.fillRect(doorX - 7, ground, doorW + 14, 3);

        // Small fence
        ctx.fillStyle = '#d8ccb4';
        const fenceY = ground - toPx(size, 0.02);
        for (let i = 0; i < 6; i++) {
            const fx = x - toPx(size, 0.03) + (i * toPx(size, 0.14));
            ctx.fillRect(fx, fenceY, 3, toPx(size, 0.06));
        }
        ctx.fillRect(x - toPx(size, 0.03), fenceY + toPx(size, 0.02), w + toPx(size, 0.06), 2);
    }

    const DRAWERS = {
        hq: drawCommandCenter,
        barracks: drawBarracks,
        airport: (ctx, size) => drawAirportPart(ctx, size, 'airport'),
        airport_tr: (ctx, size) => drawAirportPart(ctx, size, 'airport_tr'),
        airport_bl: (ctx, size) => drawAirportPart(ctx, size, 'airport_bl'),
        airport_br: (ctx, size) => drawAirportPart(ctx, size, 'airport_br'),
        factory: drawFactory,
        powerplant: drawResearchLab,
        oilrig: drawSupplyDepot,
        house: drawDormitory,
        apartment_large: drawApartmentLarge,
        shop_store: drawShopStore,
        tax_office: drawTaxOffice,
        tree: drawTree,
        park_plaza: (ctx, size) => drawParkPlazaPart(ctx, size, 'park_plaza'),
        park_plaza_tr: (ctx, size) => drawParkPlazaPart(ctx, size, 'park_plaza_tr'),
        park_plaza_bl: (ctx, size) => drawParkPlazaPart(ctx, size, 'park_plaza_bl'),
        park_plaza_br: (ctx, size) => drawParkPlazaPart(ctx, size, 'park_plaza_br'),
        park: drawPark,
        monument: drawMonument,
        decor: drawDecor
    };

    for (let row = 0; row < AIRPORT_GRID_ROWS; row++) {
        for (let col = 0; col < AIRPORT_GRID_COLS; col++) {
            if ((row === 0 && col === 0) || (row === 0 && col === 1) || (row === 1 && col === 0) || (row === 1 && col === 1)) {
                continue;
            }
            const tile = `airport_r${row}c${col}`;
            DRAWERS[tile] = (ctx, size) => drawAirportPart(ctx, size, tile);
        }
    }

    function hasSprite(tile) {
        return Object.prototype.hasOwnProperty.call(DRAWERS, tile);
    }

    function getSpriteDataUrl(tile, size = DEFAULT_SIZE) {
        if (!tile || !hasSprite(tile)) return null;
        const safeSize = Math.max(32, Math.floor(Number(size) || DEFAULT_SIZE));
        const key = `${tile}:${safeSize}`;
        if (SPRITE_CACHE.has(key)) return SPRITE_CACHE.get(key);

        const canvas = createCanvas(safeSize);
        const ctx = canvas.getContext('2d');
        if (!ctx) return null;

        try {
            DRAWERS[tile](ctx, safeSize);
            const dataUrl = canvas.toDataURL('image/png');
            SPRITE_CACHE.set(key, dataUrl);
            return dataUrl;
        } catch (_) {
            return null;
        }
    }

    function clearCache() {
        SPRITE_CACHE.clear();
        AIRPORT_SCENE_CACHE.clear();
        PARK_PLAZA_SCENE_CACHE.clear();
    }

    global.CitySimBuildingRenderer = {
        DEFAULT_SIZE,
        hasSprite,
        getSpriteDataUrl,
        clearCache
    };
})(window);
