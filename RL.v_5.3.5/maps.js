const Maps = {
    types: {
        'plain': { name: '평원 (Plains)', sky: '#87CEEB', ground: '#4ade80', groundDark: '#16a34a' },
        'city': { name: '도시 (City)', sky: '#cbd5e1', skyMid: '#8fb7e0', ground: '#475569', groundDark: '#334155' },
        'mountain': { name: '산악 (Mountain)', sky: '#bae6fd', ground: '#a8a29e', groundDark: '#78716c' },
        'village': { name: '마을 (Village)', sky: '#f0f9ff', ground: '#d97706', groundDark: '#b45309' }
    },

    // [NEW] 맵별 게임 규칙 설정
    rules: {
        'city': {
            playerHQ: true,           // 파랑 기지 O
            enemyHQ: false,           // 빨강 기지 X
            playerDefense: true,      // 방어시설 파랑만
            enemyDefense: false,
            bunkers: true,            // 거점(아파트) O
            mapExpand: true,          // 맵 가로 확장 O
            winCondition: 'survival', // 12분 버티기 OR 적 전멸
            survivalTime: 720         // 720초 = 12분
        },
        'plain': {
            playerHQ: true,           // 파랑 기지 O
            enemyHQ: true,            // 빨강 기지 O
            playerDefense: true,      // 방어시설 포함
            enemyDefense: true,
            bunkers: true,            // 거점 O
            mapExpand: true,          // 맵 가로 확장 O
            winCondition: 'annihilation' // 섬멸전
        },
        'mountain': {
            playerHQ: true,           // 파랑 기지 O
            enemyHQ: true,            // 빨강 기지 O
            playerDefense: true,      // 방어시설 포함
            enemyDefense: true,
            bunkers: false,           // 거점 X
            mapExpand: true,          // 맵 가로 확장 O
            winCondition: 'annihilation' // 섬멸전
        },
        'village': {
            playerHQ: true,           // 파랑 기지 O
            enemyHQ: true,            // 빨강 기지 O
            playerDefense: true,      // 방어시설 포함
            enemyDefense: true,
            bunkers: true,            // 거점 O
            mapExpand: true,          // 맵 가로 확장 O
            winCondition: 'hq_destroy' // 총사령부 파괴 승리
        }
    },

    // [NEW] 현재 맵의 규칙 가져오기
    getRule(key) {
        const mapRules = this.rules[this.currentMap];
        if (mapRules && key in mapRules) return mapRules[key];
        // 기본값
        const defaults = {
            playerHQ: true, enemyHQ: true,
            playerDefense: true, enemyDefense: true,
            bunkers: true, mapExpand: false,
            winCondition: 'hq_destroy', survivalTime: 600
        };
        return defaults[key];
    },

    currentMap: 'plain',

    drawBase(ctx, width, height, groundY) {
        const theme = this.types[this.currentMap] || this.types['plain'];

        const grad = ctx.createLinearGradient(0, 0, 0, height);
        grad.addColorStop(0, theme.sky);
        grad.addColorStop(0.5, theme.skyMid || '#ffffff');
        grad.addColorStop(1, theme.ground);

        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, width, height);

        ctx.fillStyle = theme.ground;
        ctx.fillRect(0, groundY, width, height - groundY);
    },

    drawDecorations(ctx, width, height, groundY, cameraX = 0) {
        ctx.save();
        const buffer = 200;

        if (this.currentMap === 'plain') {
            ctx.translate(-cameraX, 0);
            this.drawTrees(ctx, cameraX - buffer, cameraX + width + buffer, groundY);
        } else if (this.currentMap === 'city') {
            const pX = cameraX * 0.5;
            ctx.save();
            ctx.translate(-pX, 0);
            this.drawCitySkyline(ctx, pX - buffer, pX + width + buffer, groundY);
            ctx.restore();
            ctx.save();
            ctx.translate(-cameraX, 0);
            this.drawCityForeground(ctx, cameraX - buffer, cameraX + width + buffer, groundY);
            ctx.restore();
        } else if (this.currentMap === 'mountain') {
            const pX = cameraX * 0.3;
            ctx.translate(-pX, 0);
            this.drawMountains(ctx, pX - buffer, pX + width + buffer, groundY);
        } else if (this.currentMap === 'village') {
            ctx.translate(-cameraX, 0);
            this.drawVillage(ctx, cameraX - buffer, cameraX + width + buffer, groundY);
        }

        ctx.restore();
    },

    drawBackground(ctx, width, height, groundY, cameraX = 0) {
        this.drawBase(ctx, width, height, groundY);
        this.drawDecorations(ctx, width, height, groundY, cameraX);
    },

    drawTrees(ctx, startX, endX, groundY) {
        const interval = 80;
        const start = Math.floor(startX / interval) * interval;

        for (let i = start; i < endX; i += interval) {
            const seed = Math.abs(Math.sin(i * 12.34));
            const seed2 = Math.abs(Math.cos(i * 56.78));

            const scaleX = 0.7 + (seed * 0.6);
            const scaleY = 0.6 + (seed2 * 1.2);

            ctx.save();
            ctx.translate(i, groundY);
            ctx.scale(scaleX, scaleY);

            ctx.fillStyle = seed > 0.5 ? '#15803d' : '#166534';
            ctx.beginPath();
            ctx.moveTo(0, 0);
            ctx.lineTo(20, -60);
            ctx.lineTo(40, 0);
            ctx.fill();

            ctx.fillStyle = '#3f6212';
            ctx.fillRect(15, -10, 10, 10);
            ctx.restore();
        }
    },

    drawCitySkyline(ctx, startX, endX, groundY) {
        const interval = 80;
        const start = Math.floor(startX / interval) * interval;

        const worldW = (typeof CONFIG !== 'undefined' && Number.isFinite(CONFIG.mapWidth))
            ? CONFIG.mapWidth
            : Math.max(2000, endX - startX);

        const centerX = worldW * 0.5;
        const secondX = worldW * 0.7;
        const decoX1 = worldW * 0.4;
        const decoX2 = worldW * 0.6;

        const reserved = [
            { x: centerX, w: 140 },
            { x: secondX, w: 120 },
            { x: decoX1, w: 140 },
            { x: decoX2, w: 80 }
        ];

        const isReserved = (x) => reserved.some(r => Math.abs(x - r.x) < r.w * 0.6);

        ctx.fillStyle = '#64748b';
        for (let i = start; i < endX; i += interval) {
            const fixedH = ((i * 123) % 150) + 50;
            const center = i + 30;
            if (isReserved(center)) continue;
            ctx.fillRect(i, groundY - fixedH, 60, fixedH);

            ctx.fillStyle = '#fef08a';
            for (let j = 0; j < 3; j++) {
                if ((i * j * 7) % 2 === 0) ctx.fillRect(i + 10, groundY - fixedH + 10 + j * 15, 10, 10);
            }
            ctx.fillStyle = '#64748b';
        }

    },

    drawCityForeground(ctx, startX, endX, groundY) {
        const worldW = (typeof CONFIG !== 'undefined' && Number.isFinite(CONFIG.mapWidth))
            ? CONFIG.mapWidth
            : Math.max(2000, endX - startX);

        const decoX1 = worldW * 0.4;
        const decoX2 = worldW * 0.6;
        const inRange = (x, margin) => x > startX - margin && x < endX + margin;

        if (inRange(decoX1, 200)) this.drawShopBuilding(ctx, decoX1, groundY, 0.95);
        if (inRange(decoX2, 200)) this.drawStreetProps(ctx, decoX2, groundY, 0.95);
    },

    drawLuxuryApartment(ctx, x, groundY, scale = 1) {
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
    },

    drawLegacyApartment(ctx, x, groundY, scale = 1) {
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
    },

    // [NEW] 파괴된 고급 아파트 렌더링
    drawDestroyedLuxuryApartment(ctx, x, groundY, scale = 1) {
        const s = scale;
        const left = x - 60 * s;
        const px = (v) => left + v * s;
        const py = (v) => groundY + v * s;

        ctx.save();

        // 무너진 본체 (불규칙한 형태)
        ctx.fillStyle = '#4a5568';
        ctx.strokeStyle = '#2d3748';
        ctx.lineWidth = Math.max(1, 2 * s);
        ctx.beginPath();
        ctx.moveTo(px(0), py(0));           // 바닥 왼쪽
        ctx.lineTo(px(0), py(-110));        // 왼쪽 벽 (일부 남음)
        ctx.lineTo(px(20), py(-130));       // 무너진 상단
        ctx.lineTo(px(60), py(-115));       // 중간 잔해
        ctx.lineTo(px(100), py(-150));      // 오른쪽 상단 (높이 불규칙)
        ctx.lineTo(px(100), py(0));         // 바닥 오른쪽
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        // 균열 표현
        ctx.strokeStyle = '#1a202c';
        ctx.lineWidth = Math.max(1, 2 * s);
        ctx.beginPath();
        ctx.moveTo(px(10), py(-80));
        ctx.lineTo(px(35), py(-65));
        ctx.lineTo(px(20), py(-30));
        ctx.stroke();

        // 깨진 창문 (어두운 구멍)
        ctx.fillStyle = '#1a202c';
        ctx.fillRect(px(10), py(-100), 20 * s, 15 * s);
        ctx.fillRect(px(50), py(-80), 15 * s, 12 * s);

        // 잔해 조각들
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
    },

    // [NEW] 파괴된 구형 아파트 렌더링
    drawDestroyedLegacyApartment(ctx, x, groundY, scale = 1) {
        const s = scale;
        const left = x - 50 * s;
        const px = (v) => left + v * s;
        const py = (v) => groundY + v * s;

        ctx.save();

        // 무너진 본체
        ctx.fillStyle = '#4a5568';
        ctx.strokeStyle = '#2d3748';
        ctx.lineWidth = Math.max(1, 2 * s);
        ctx.beginPath();
        ctx.moveTo(px(0), py(0));           // 바닥 왼쪽
        ctx.lineTo(px(0), py(-90));         // 왼쪽 벽
        ctx.lineTo(px(15), py(-105));       // 무너진 상단
        ctx.lineTo(px(50), py(-95));        // 중간
        ctx.lineTo(px(80), py(-125));       // 오른쪽 상단
        ctx.lineTo(px(80), py(0));          // 바닥 오른쪽
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        // 균열
        ctx.strokeStyle = '#1a202c';
        ctx.lineWidth = Math.max(1, 1.5 * s);
        ctx.beginPath();
        ctx.moveTo(px(10), py(-70));
        ctx.lineTo(px(30), py(-55));
        ctx.lineTo(px(25), py(-20));
        ctx.stroke();

        // 어두운 창문/구멍
        ctx.fillStyle = '#2d3748';
        ctx.fillRect(px(8), py(-80), 15 * s, 12 * s);

        // 잔해
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
    },

    drawShopBuilding(ctx, x, groundY, scale = 1) {
        const s = scale;
        const w = 120 * s;
        const h = 90 * s;
        const left = x - w / 2;
        const top = groundY - h;
        const px = (v) => left + v * s;
        const py = (v) => top + v * s;

        ctx.save();
        ctx.fillStyle = '#a0aec0';
        ctx.strokeStyle = '#4a5568';
        ctx.lineWidth = Math.max(1, 2 * s);
        ctx.fillRect(left, top, w, h);
        ctx.strokeRect(left, top, w, h);

        ctx.fillStyle = '#2d3748';
        ctx.beginPath();
        ctx.moveTo(px(-5), py(10));
        ctx.lineTo(px(125), py(10));
        ctx.lineTo(px(115), py(0));
        ctx.lineTo(px(5), py(0));
        ctx.closePath();
        ctx.fill();

        ctx.fillStyle = '#4a5568';
        ctx.fillRect(px(5), py(40), 110 * s, 45 * s);

        ctx.fillStyle = '#90cdf4';
        ctx.globalAlpha = 0.85;
        ctx.fillRect(px(12), py(50), 28 * s, 28 * s);
        ctx.fillRect(px(80), py(50), 28 * s, 28 * s);
        ctx.globalAlpha = 1;

        ctx.fillStyle = '#e2e8f0';
        ctx.fillRect(px(52), py(50), 16 * s, 35 * s);
        ctx.fillStyle = '#2d3748';
        ctx.beginPath();
        ctx.arc(px(64), py(68), 1.5 * s, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = '#cbd5e0';
        ctx.fillRect(px(15), py(18), 25 * s, 16 * s);
        ctx.fillRect(px(80), py(18), 25 * s, 16 * s);

        ctx.fillStyle = '#1f2937';
        ctx.fillRect(px(5), py(30), 110 * s, 10 * s);
        ctx.fillStyle = '#f6e05e';
        ctx.font = `${Math.max(6, 8 * s)}px sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('STORE', x, py(35));
        ctx.restore();
    },

    drawStreetProps(ctx, x, groundY, scale = 1) {
        const s = scale;
        const poleH = 90 * s;
        ctx.save();

        ctx.fillStyle = '#4a5568';
        ctx.fillRect(x - 2 * s, groundY - poleH, 4 * s, poleH);
        ctx.fillRect(x - 22 * s, groundY - poleH + 15 * s, 44 * s, 4 * s);
        ctx.fillStyle = '#edf2f7';
        ctx.beginPath();
        ctx.arc(x - 20 * s, groundY - poleH + 13 * s, 2 * s, 0, Math.PI * 2);
        ctx.arc(x + 20 * s, groundY - poleH + 13 * s, 2 * s, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = '#e53e3e';
        ctx.beginPath();
        ctx.arc(x + 22 * s, groundY - poleH + 28 * s, 10 * s, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#fff';
        ctx.fillRect(x + 14 * s, groundY - poleH + 24 * s, 16 * s, 6 * s);

        ctx.fillStyle = '#e53e3e';
        ctx.fillRect(x - 26 * s, groundY - 22 * s, 12 * s, 20 * s);
        ctx.fillStyle = '#c53030';
        ctx.fillRect(x - 28 * s, groundY - 26 * s, 16 * s, 4 * s);

        ctx.fillStyle = '#718096';
        ctx.fillRect(x + 10 * s, groundY - 22 * s, 14 * s, 20 * s);
        ctx.strokeStyle = '#4a5568';
        ctx.lineWidth = Math.max(1, 1 * s);
        ctx.beginPath();
        ctx.moveTo(x + 12 * s, groundY - 18 * s);
        ctx.lineTo(x + 22 * s, groundY - 18 * s);
        ctx.stroke();
        ctx.restore();
    },

    drawMountains(ctx, startX, endX, groundY) {
        ctx.fillStyle = '#57534e';
        ctx.beginPath();
        ctx.moveTo(startX, groundY);

        let currentX = 0;

        while (currentX < endX + 200) {
            // [SHRUNK] Smaller Mountains
            const baseWidth = 100 + Math.abs(Math.sin(currentX) * 100);
            const height = 50 + Math.abs(Math.cos(currentX * 0.5) * 100);
            const peakX = currentX + (baseWidth / 2);

            if (currentX + baseWidth > startX) {
                ctx.lineTo(peakX, groundY - height);
                ctx.lineTo(currentX + baseWidth, groundY);
            } else {
                ctx.moveTo(currentX + baseWidth, groundY);
            }
            currentX += baseWidth;
        }

        ctx.lineTo(endX, groundY + 100);
        ctx.lineTo(startX, groundY + 100);
        ctx.fill();
    },

    drawVillage(ctx, startX, endX, groundY) {
        const interval = 120;
        const start = Math.floor(startX / interval) * interval;

        for (let i = start; i < endX; i += interval) {
            const offset = Math.sin(i) * 20;
            const x = i + offset;

            // House Body
            ctx.fillStyle = '#fef3c7';
            ctx.fillRect(x, groundY - 30, 40, 30);

            // Roof
            ctx.fillStyle = '#991b1b';
            ctx.beginPath();
            ctx.moveTo(x - 5, groundY - 30);
            ctx.lineTo(x + 20, groundY - 50);
            ctx.lineTo(x + 45, groundY - 30);
            ctx.fill();

            // Door/Window
            ctx.fillStyle = '#451a03';
            ctx.fillRect(x + 15, groundY - 15, 10, 15);
            ctx.fillStyle = '#93c5fd';
            ctx.fillRect(x + 5, groundY - 25, 8, 8);
        }
    }
};
