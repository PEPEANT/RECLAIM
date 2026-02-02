// corpse.js - 보병 시체 시스템
(function () {
    'use strict';

    /**
     * Corpse - 보병 사망 시 생성되는 시체 객체
     * - 쓰러지는 애니메이션 (90° 회전)
     * - 5초 후 페이드아웃
     */
    class Corpse {
        constructor(x, y, typeKey, facing, team) {
            this.x = x;
            this.y = y;
            this.typeKey = typeKey;
            this.facing = facing || 1;
            this.team = team || 'player';

            // 애니메이션 상태
            this.fallProgress = 0;      // 0~1 쓰러지는 진행도
            this.fadeTimer = 300;       // 5초 후 사라짐 (60fps × 5초)
            this.opacity = 1.0;
            this.fallen = false;

            // 캐시된 스킨 데이터
            this.skin = null;
            if (typeof UnitSkinDB !== 'undefined' && UnitSkinDB.getSkin) {
                this.skin = UnitSkinDB.getSkin(typeKey);
            }
        }

        /**
         * 매 프레임 업데이트
         * @returns {boolean} true면 제거 대상
         */
        update() {
            // 쓰러지는 애니메이션 (약 20프레임)
            if (this.fallProgress < 1) {
                this.fallProgress += 0.05;
                if (this.fallProgress >= 1) {
                    this.fallProgress = 1;
                    this.fallen = true;
                }
            } else {
                // 쓰러진 후 타이머 감소
                this.fadeTimer--;

                // 마지막 1초(60프레임) 페이드아웃
                if (this.fadeTimer < 60) {
                    this.opacity = Math.max(0, this.fadeTimer / 60);
                }
            }

            return this.fadeTimer <= 0;
        }

        /**
         * 시체 렌더링
         */
        draw(ctx) {
            if (this.opacity <= 0) return;

            ctx.save();
            ctx.globalAlpha = this.opacity;
            ctx.translate(this.x, this.y);

            // 쓰러지는 회전: facing 방향으로 90도 회전
            const fallAngle = (Math.PI / 2) * this.fallProgress * this.facing;
            ctx.rotate(fallAngle);

            // 스킨이 있으면 IngameRenderer로 그리기
            if (this.skin && typeof IngameRenderer !== 'undefined' && IngameRenderer.drawUnitSkin) {
                // 간단한 더미 유닛 객체 생성
                const dummyUnit = {
                    x: 0,
                    y: 0,
                    facing: 1,
                    team: this.team,
                    stats: { id: this.typeKey },
                    animFrame: 0,
                    dead: true
                };

                ctx.save();
                ctx.translate(0, 0);
                IngameRenderer.drawUnitSkin(ctx, this.skin, dummyUnit, 0, 0);
                ctx.restore();
            } else {
                // 폴백: 간단한 사각형으로 표시
                this.drawFallback(ctx);
            }

            ctx.restore();
        }

        /**
         * 스킨 없을 때 폴백 렌더링
         */
        drawFallback(ctx) {
            const color = this.team === 'player' ? '#3b82f6' : '#ef4444';
            const darkColor = this.team === 'player' ? '#1e3a8a' : '#991b1b';

            // 몸통
            ctx.fillStyle = darkColor;
            ctx.fillRect(-6, -20, 12, 16);

            // 머리
            ctx.fillStyle = '#d4a574';
            ctx.beginPath();
            ctx.arc(0, -24, 5, 0, Math.PI * 2);
            ctx.fill();

            // 팔
            ctx.fillStyle = color;
            ctx.fillRect(-10, -18, 4, 10);
            ctx.fillRect(6, -18, 4, 10);

            // 다리
            ctx.fillStyle = '#1e293b';
            ctx.fillRect(-5, -4, 4, 8);
            ctx.fillRect(1, -4, 4, 8);
        }
    }

    // 전역 노출
    window.Corpse = Corpse;
})();
