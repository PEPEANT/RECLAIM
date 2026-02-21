// Body rendering for: apache (AH-64D Longbow)
// 좌표 계약: origin = 기체 중심(unit.x, unit.y), 기수 = +x 방향 (facing=1)
// ctx는 이미 scale(1.4 * APACHE_SCALE) + floatOffset + facing 적용됨
// 원형 좌표: apache_v2.html 프로토타입 기준 (로컬 px)
(function attachUnitRenderV2Body_apache(globalScope) {
    'use strict';

    function poly(ctx, pts) {
        ctx.beginPath();
        ctx.moveTo(pts[0], pts[1]);
        for (var i = 2; i < pts.length; i += 2) ctx.lineTo(pts[i], pts[i + 1]);
        ctx.closePath();
    }

    function drawBody(unit, ctx, state, palette) {
        if (!ctx || !palette) return;

        var c = palette;
        var rotorAngle     = Number(state.rotorAngle)     || 0;
        var tailRotorAngle = Number(state.tailRotorAngle) || 0;

        ctx.save();
        ctx.lineJoin = 'round';
        ctx.lineCap  = 'round';

        // ── 1. 꼬리 붐 (Tail Boom) ──────────────────────────────────
        // 상단 페어링 (밝은 면)
        ctx.fillStyle = c.panel;
        poly(ctx, [-30, -5,  -178, -5,  -178, -2,  -30, -1]);
        ctx.fill();
        // 붐 메인 (하단)
        ctx.fillStyle = c.body;
        poly(ctx, [-30, -5,  -178, -5,  -180, 3,  -30, 12]);
        ctx.fill();

        // ── 2. 수직 미익 (Vertical Fin) ─────────────────────────────
        // 후방 어두운 면
        ctx.fillStyle = c.dark;
        poly(ctx, [-142, -5,  -168, -5,  -188, -64,  -168, -66,  -144, -8]);
        ctx.fill();
        // 전방 밝은 면
        ctx.fillStyle = c.body;
        poly(ctx, [-142, -5,  -144, -8,  -168, -66,  -167, -64,  -146, -10]);
        ctx.fill();
        // 핀 상단 캡
        ctx.fillStyle = c.panel;
        poly(ctx, [-188, -64,  -182, -70,  -162, -70,  -168, -66]);
        ctx.fill();
        // 패널 라인
        ctx.strokeStyle = '#111416'; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(-168, -38); ctx.lineTo(-182, -38); ctx.stroke();

        // ── 3. 수평 안정익 (Horizontal Stabilizer) ──────────────────
        ctx.fillStyle = c.panel;
        poly(ctx, [-148, 3,  -112, 2,  -108, 18,  -152, 12]);
        ctx.fill();
        ctx.fillStyle = c.dark;
        poly(ctx, [-148, 8,  -112, 6,  -108, 18,  -152, 12]);
        ctx.fill();
        ctx.strokeStyle = c.accent; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(-148, 3); ctx.lineTo(-112, 2); ctx.stroke();

        // ── 4. 테일 로터 어셈블리 ───────────────────────────────────
        ctx.fillStyle = c.metal;
        ctx.fillRect(-180, -66, 5, 24);

        ctx.save();
        ctx.translate(-178, -54);
        ctx.fillStyle = c.dark;
        ctx.beginPath(); ctx.arc(0, 0, 5, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = c.metal;
        ctx.beginPath(); ctx.arc(0, 0, 2.5, 0, Math.PI * 2); ctx.fill();
        // 테일 로터 블러
        var tR1 = Math.cos(tailRotorAngle * 2.8) * 30;
        var tR2 = Math.cos(tailRotorAngle * 2.8 + 1.4) * 30;
        ctx.fillStyle = 'rgba(18,22,26,0.82)';
        ctx.beginPath(); ctx.ellipse(0, 0, 2, Math.abs(tR1), -0.3, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = 'rgba(18,22,26,0.48)';
        ctx.beginPath(); ctx.ellipse(0, 0, 2, Math.abs(tR2),  0.6, 0, Math.PI * 2); ctx.fill();
        ctx.restore();

        // 테일 스키드
        ctx.strokeStyle = c.metal; ctx.lineWidth = 2.5;
        ctx.beginPath(); ctx.moveTo(-150, 3); ctx.lineTo(-158, 24); ctx.stroke();
        ctx.fillStyle = '#040404';
        ctx.beginPath(); ctx.arc(-158, 25, 5.5, 0, Math.PI * 2); ctx.fill();

        // ── 5. 동체 하부 음영 ────────────────────────────────────────
        ctx.fillStyle = c.dark;
        ctx.beginPath();
        ctx.moveTo(-28, 11); ctx.lineTo(-8, 18); ctx.lineTo(20, 23);
        ctx.lineTo(52, 24);  ctx.lineTo(82, 18); ctx.lineTo(90, 22);
        ctx.lineTo(80, 28);  ctx.lineTo(48, 30); ctx.lineTo(16, 28);
        ctx.lineTo(-8, 22);  ctx.closePath();
        ctx.fill();

        // ── 6. 메인 동체 (Main Fuselage) ─────────────────────────────
        ctx.fillStyle = c.body;
        ctx.beginPath();
        ctx.moveTo(-28, 12);   // 꼬리 연결 하단
        ctx.lineTo(-28,  -4);  // 꼬리 연결 상단
        ctx.lineTo( -6, -16);  // 엔진 후단
        ctx.lineTo( 14, -16);  // 엔진 전단
        // 후방 조종석 (Pilot, 높음)
        ctx.lineTo( 16, -34);
        ctx.lineTo( 40, -34);
        // Step → 전방 조종석 (CPG, 낮고 경사)
        ctx.lineTo( 44, -22);
        ctx.lineTo( 62, -22);
        // 기수 사면 (날카로운 웨지)
        ctx.lineTo( 86,  -4);
        ctx.lineTo( 98,   0);
        ctx.lineTo(104,   6);  // 노즈 포인트
        // 기수 하단 / 턱
        ctx.lineTo( 98,  16);
        ctx.lineTo( 88,  22);
        // 복부
        ctx.lineTo( 52,  26);
        ctx.lineTo( 16,  25);
        ctx.lineTo( -8,  18);
        ctx.closePath();
        ctx.fill();

        // 동체 패널 분할선
        ctx.strokeStyle = '#161a1d'; ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.moveTo(16, -16); ctx.lineTo(16, 22); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(-6, -16); ctx.lineTo(-6, 14); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(62, -22); ctx.lineTo(66, 24); ctx.stroke();
        // 기수 앞전 하이라이트
        ctx.strokeStyle = c.accent; ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(-6, -16); ctx.lineTo(14, -16);
        ctx.lineTo(44, -22); ctx.lineTo(62, -22);
        ctx.lineTo(86, -4);  ctx.lineTo(98,  0);
        ctx.stroke();

        // ── 7. T700 엔진 나셀 ─────────────────────────────────────────
        ctx.fillStyle = c.panel;
        ctx.beginPath();
        ctx.moveTo(-42, -12); ctx.lineTo(-6, -18); ctx.lineTo(16, -18);
        ctx.lineTo(20, -8);   ctx.lineTo(14, 0);   ctx.lineTo(-12, -2);
        ctx.lineTo(-42, -7);  ctx.closePath();
        ctx.fill();
        // 흡입구
        ctx.fillStyle = '#050505';
        poly(ctx, [18, -18,  20, -8,  14, 0,  12, -4,  13, -16]);
        ctx.fill();
        // 흡입구 격자
        ctx.strokeStyle = '#1c2024'; ctx.lineWidth = 1;
        for (var i = 0; i < 4; i++) {
            ctx.beginPath();
            ctx.moveTo(13 + i * 1.8, -16);
            ctx.lineTo(13 + i * 1.8, -1);
            ctx.stroke();
        }
        // HIRSS 배기 억제기
        ctx.fillStyle = c.dark;
        ctx.beginPath(); ctx.roundRect(-46, -13, 17, 8, [4,0,0,4]); ctx.fill();
        ctx.fillStyle = '#030303'; ctx.fillRect(-44, -11, 8, 4);
        ctx.strokeStyle = '#111'; ctx.lineWidth = 1;
        for (var j = 0; j < 3; j++) {
            ctx.beginPath(); ctx.moveTo(-44, -10 + j*1.5); ctx.lineTo(-28, -10 + j*1.5); ctx.stroke();
        }
        // 나셀 앞전
        ctx.strokeStyle = c.accent; ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(-42, -12); ctx.lineTo(-6, -18); ctx.lineTo(16, -18);
        ctx.stroke();

        // ── 8. 조종석 캐노피 ──────────────────────────────────────────
        // 후방 Pilot: 좁고 높은 박스형
        ctx.fillStyle = c.glass;
        poly(ctx, [18, -32,  40, -32,  42, -46,  24, -48,  17, -38]);
        ctx.fill();
        // 전방 CPG: 넓고 낮은 랩어라운드
        ctx.fillStyle = c.glass;
        poly(ctx, [46, -21,  62, -21,  82, -4,  44, -4]);
        ctx.fill();
        // 프레임
        ctx.strokeStyle = c.body; ctx.lineWidth = 3.5;
        ctx.beginPath(); ctx.moveTo(43, -48); ctx.lineTo(43, -4); ctx.stroke();
        ctx.lineWidth = 2.5;
        ctx.beginPath(); ctx.moveTo(24, -48); ctx.lineTo(17, -38); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(62, -21); ctx.lineTo(72,  -4); ctx.stroke();
        ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(18, -32); ctx.lineTo(43, -32); ctx.stroke();
        // 반사광
        ctx.strokeStyle = c.glassRef; ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.moveTo(27, -45); ctx.lineTo(37, -43); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(48, -18); ctx.lineTo(58, -18); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(64, -12); ctx.lineTo(72,  -7); ctx.stroke();
        ctx.strokeStyle = 'rgba(80,140,200,0.22)'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(28, -42); ctx.lineTo(36, -40); ctx.stroke();

        // ── 9. TADS / PNVS 노즈 센서 클러스터 ────────────────────────
        // PNVS (상단 소형)
        ctx.fillStyle = '#1a1f26';
        ctx.beginPath(); ctx.arc(97, 0, 6.5, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#050a12';
        ctx.beginPath(); ctx.arc(98, 0, 3.5, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = 'rgba(50,100,160,0.55)';
        ctx.beginPath(); ctx.arc(99, -1, 1.8, 0, Math.PI * 2); ctx.fill();
        // TADS 마운트
        ctx.fillStyle = c.dark; ctx.fillRect(87, 8, 12, 5);
        // TADS 터렛 구체
        ctx.fillStyle = '#1c2028';
        ctx.beginPath(); ctx.arc(97, 18, 10, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = c.dark;
        ctx.beginPath(); ctx.arc(97, 18, 8,  0, Math.PI * 2); ctx.fill();
        // 렌즈
        ctx.fillStyle = '#080e18';
        ctx.beginPath(); ctx.arc(101, 14, 4.5, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.arc(101, 22, 3.2, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = 'rgba(20,60,120,0.6)';
        ctx.beginPath(); ctx.arc(102, 13, 2.2, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = 'rgba(20,60,120,0.4)';
        ctx.beginPath(); ctx.arc(102, 21, 1.5, 0, Math.PI * 2); ctx.fill();

        // ── 10. 스터브 윙 & 무장 파일런 ──────────────────────────────
        ctx.fillStyle = c.body;
        poly(ctx, [6, 4,  32, 4,  34, 10,  30, 16,  6, 14]);
        ctx.fill();
        ctx.fillStyle = c.dark;
        poly(ctx, [6, 10,  30, 10,  30, 16,  6, 14]);
        ctx.fill();
        ctx.strokeStyle = c.accent; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(6, 4); ctx.lineTo(32, 4); ctx.lineTo(34, 10); ctx.stroke();

        // 파일런
        ctx.fillStyle = c.weapon;
        ctx.beginPath(); ctx.roundRect(20, 16, 10, 8, 2); ctx.fill();
        ctx.beginPath(); ctx.roundRect(2,  16, 10, 8, 2); ctx.fill();

        // AGM-114 헬파이어 미사일 (2열)
        var missileYs = [24, 31];
        for (var m = 0; m < missileYs.length; m++) {
            var my = missileYs[m];
            ctx.fillStyle = c.weapon;
            ctx.beginPath(); ctx.roundRect(2, my, 36, 5.5, 2); ctx.fill();
            ctx.fillStyle = '#1e2228';
            ctx.fillRect(4, my + 0.5, 28, 4.5);
            // 탄두
            ctx.fillStyle = '#2c3038';
            ctx.beginPath();
            ctx.moveTo(32, my + 0.5); ctx.lineTo(38, my + 2.75); ctx.lineTo(32, my + 5);
            ctx.fill();
            // 식별띠
            ctx.fillStyle = '#b45309'; ctx.fillRect(18, my, 2.5, 5.5);
            ctx.fillStyle = '#d97706'; ctx.fillRect(9,  my, 2,   5.5);
            // 꼬리핀
            ctx.fillStyle = c.dark;
            ctx.fillRect(2, my + 0.5, 5, 2);
            ctx.fillRect(2, my + 3,   5, 2);
        }

        // M261 하이드라 70 로켓포드 (내측)
        ctx.fillStyle = c.dark;
        ctx.beginPath(); ctx.roundRect(-16, 16, 22, 16, [2, 2, 4, 4]); ctx.fill();
        ctx.fillStyle = '#030303';
        ctx.beginPath(); ctx.roundRect(3, 17, 4, 14, 1); ctx.fill();
        for (var h = 0; h < 4; h++) {
            ctx.fillStyle = '#010101';
            ctx.beginPath(); ctx.arc(5, 19 + h * 3.5, 1.4, 0, Math.PI * 2); ctx.fill();
        }
        ctx.strokeStyle = '#1a1e22'; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(-16, 24); ctx.lineTo(7, 24); ctx.stroke();

        // ── 11. 메인 랜딩 기어 ────────────────────────────────────────
        ctx.strokeStyle = c.dark; ctx.lineWidth = 6;
        ctx.beginPath(); ctx.moveTo(28, 24); ctx.lineTo(16, 44); ctx.stroke();
        ctx.strokeStyle = c.metal; ctx.lineWidth = 2.5;
        ctx.beginPath(); ctx.moveTo(22, 23); ctx.lineTo(16, 40); ctx.stroke();
        ctx.fillStyle = '#050505';
        ctx.beginPath(); ctx.arc(16, 44, 9.5, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = c.metal;
        ctx.beginPath(); ctx.arc(16, 44, 4.5, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = c.dark;
        ctx.beginPath(); ctx.arc(16, 44, 2.2, 0, Math.PI * 2); ctx.fill();

        // ── 12. M230 30mm 체인건 ─────────────────────────────────────
        // 마운트 박스
        ctx.fillStyle = c.dark;
        ctx.beginPath(); ctx.roundRect(68, 18, 18, 14, 3); ctx.fill();
        ctx.fillStyle = c.metal;
        ctx.beginPath(); ctx.arc(78, 26, 6, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = c.dark;
        ctx.beginPath(); ctx.arc(78, 26, 4, 0, Math.PI * 2); ctx.fill();

        ctx.save();
        ctx.translate(78, 26);
        // 지상 공격 각도 (약간 아래쪽)
        ctx.rotate(0.18);
        // 리시버
        ctx.fillStyle = c.weapon; ctx.fillRect(-5, -4.5, 20, 9);
        // 총열
        ctx.fillStyle = c.metal;  ctx.fillRect(14, -2.5, 32, 5);
        // 냉각 슬리브 리브
        ctx.strokeStyle = '#2a2f36'; ctx.lineWidth = 1;
        for (var r = 0; r < 8; r++) {
            ctx.beginPath();
            ctx.moveTo(16 + r * 3.8, -2.5);
            ctx.lineTo(16 + r * 3.8,  2.5);
            ctx.stroke();
        }
        // 가스 튜브
        ctx.fillStyle = '#1e2228'; ctx.fillRect(14, -4.5, 28, 2);
        // 소염기
        ctx.fillStyle = '#0a0c0f'; ctx.fillRect(44, -3.5, 6, 7);
        ctx.fillStyle = '#000';
        ctx.beginPath(); ctx.arc(50, 0, 2.5, 0, Math.PI * 2); ctx.fill();
        ctx.restore();

        // ── 13. 메인 로터 마스트 & 로터 헤드 ─────────────────────────
        ctx.fillStyle = c.metal;
        ctx.fillRect(4, -22, 8, 28);
        ctx.fillStyle = c.panel;
        ctx.fillRect(5, -22, 2, 28);

        ctx.fillStyle = c.dark;
        ctx.fillRect(-10, -44, 28, 18);
        // 스워시 플레이트
        ctx.strokeStyle = '#222629'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(-10, -36); ctx.lineTo(18, -36); ctx.stroke();
        // 피치 링크
        ctx.strokeStyle = '#282c30'; ctx.lineWidth = 1.5;
        for (var p = 0; p < 6; p++) {
            ctx.beginPath();
            ctx.moveTo(-8 + p * 5.5, -44);
            ctx.lineTo(-8 + p * 5.5, -28);
            ctx.stroke();
        }
        ctx.fillStyle = c.accent;
        ctx.fillRect(-10, -46, 28, 4);

        // ── 14. AN/APG-78 롱보우 레이더 돔 ───────────────────────────
        ctx.fillStyle = c.body;
        ctx.beginPath(); ctx.ellipse(8, -54, 24, 8, 0, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = c.panel;
        ctx.beginPath(); ctx.ellipse(8, -55, 24, 5.5, 0, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = c.dark;
        ctx.beginPath(); ctx.ellipse(8, -52, 24, 4.5, 0, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = '#111416'; ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.ellipse(8, -54, 24, 8, 0, 0, Math.PI * 2); ctx.stroke();
        ctx.strokeStyle = c.accent; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(-16, -54); ctx.lineTo(32, -54); ctx.stroke();
        ctx.fillStyle = c.metal;
        ctx.fillRect(5, -50, 6, 8);

        // ── 15. 메인 로터 4엽 블러 ───────────────────────────────────
        var rS1 = Math.cos(rotorAngle) * 185;
        ctx.fillStyle = 'rgba(16,20,24,0.82)';
        ctx.beginPath(); ctx.ellipse(8, -38, Math.abs(rS1), 3, 0, 0, Math.PI * 2); ctx.fill();

        var rS2 = Math.cos(rotorAngle + Math.PI / 4) * 185;
        ctx.fillStyle = 'rgba(16,20,24,0.45)';
        ctx.beginPath(); ctx.ellipse(8, -38, Math.abs(rS2), 3, 0, 0, Math.PI * 2); ctx.fill();

        var rS3 = Math.cos(rotorAngle + Math.PI / 2) * 185;
        ctx.fillStyle = 'rgba(16,20,24,0.22)';
        ctx.beginPath(); ctx.ellipse(8, -38, Math.abs(rS3), 3, 0, 0, Math.PI * 2); ctx.fill();

        ctx.restore();
    }

    globalScope['UnitRenderV2Body_apache'] = {
        drawBody: drawBody
    };
})(typeof window !== 'undefined' ? window : globalThis);
