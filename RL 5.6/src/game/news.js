// src/game/news.js - 카메라맨 기반 수동 뉴스 시스템
(function () {
    'use strict';

    // ═══════════════════════════════════════════════════════════
    // 헬퍼 함수들
    // ═══════════════════════════════════════════════════════════

    function getPlayerHQ(buildings) {
        if (!Array.isArray(buildings) || buildings.length === 0) return null;
        return buildings.find(b => b && !b.dead && b.type === 'hq' && b.team === 'player') || null;
    }

    // 카메라맨 스폰 (도시맵 중앙)
    function ensureCameraman(game) {
        if (typeof game.getActiveCameraman !== 'function') return;
        if (game.cameramanDisabled) return;
        if (game.getActiveCameraman()) return; // 이미 있으면 스킵

        // 도시맵 중앙에서 스폰
        const spawnX = (typeof CONFIG !== 'undefined' && CONFIG.mapWidth)
            ? CONFIG.mapWidth * 0.5
            : 3000;

        if (typeof game.spawnCameramanUnit === 'function') {
            game.spawnCameramanUnit(spawnX, game.groundY);
        }
    }

    function getPreset(key, fallback) {
        if (typeof NEWS_TEXTS !== 'undefined' && NEWS_TEXTS && NEWS_TEXTS[key]) {
            return NEWS_TEXTS[key];
        }
        return fallback;
    }

    // 뉴스 표시 (인트로 포함/스킵 옵션)
    function showNews(preset, durationMs, onDone) {
        if (typeof NewsOverlay === 'undefined' || !NewsOverlay.setCustomText) return;

        const showOverlay = () => {
            NewsOverlay.setCustomText(preset);
            NewsOverlay.show(durationMs);
            if (typeof onDone === 'function') onDone();
        };

        // skipIntro 옵션 체크
        if (preset.skipIntro) {
            showOverlay();
        } else if (typeof NewsIntro !== 'undefined' && NewsIntro.show) {
            NewsIntro.show(3000, showOverlay);
        } else {
            showOverlay();
        }
    }

    // 뉴스 종료 후 정리
    function scheduleNewsEnd(game, durationMs) {
        setTimeout(() => {
            if (typeof NewsOverlay !== 'undefined' && NewsOverlay.clearCustomText) {
                NewsOverlay.clearCustomText();
            }
            game.newsCameraX = null;
        }, durationMs + 400);
    }

    // ═══════════════════════════════════════════════════════════
    // 메인 GameNews 객체
    // ═══════════════════════════════════════════════════════════

    window.GameNews = {
        // 뉴스 프리셋 목록 (랜덤 선택용)
        presets: [
            {
                lockLocation: true,
                location: '전선 현장 | 실시간',
                title: '긴급속보',
                headline: '[속보] 전선 상황 긴박… 양측 교전 격화',
                ticker: '현장 취재진 "총성과 포격 소리 끊이지 않아"   ///   군 당국 "상황 통제 중"   ///   시민 대피 권고 발령'
            },
            {
                lockLocation: true,
                location: '작전 지역 상공 | 실시간',
                title: '긴급속보',
                headline: '[속보] 원블루국 국군, 전선 돌파 시도 중',
                ticker: '기갑부대 진격 확인… 적 방어선 압박   ///   공중 지원 투입   ///   민간인 안전 구역 설정 완료'
            },
            {
                lockLocation: true,
                location: '전투 현장 | 실시간',
                title: '긴급속보',
                headline: '[속보] 적군 대규모 공세… 아군 방어전 돌입',
                ticker: '적 병력 다수 확인… 방어선 교전 중   ///   증원 부대 이동 중   ///   시민 대피 완료'
            },
            {
                lockLocation: true,
                skipIntro: true,
                location: '국방부 브리핑 | 실시간',
                title: '긴급담화',
                headline: '[속보] 국방부 "끝까지 싸운다"… 결전 의지 천명',
                ticker: '대통령 "국민 여러분 믿습니다"   ///   국제사회 지지 성명   ///   물자 지원 도착'
            },
            {
                lockLocation: true,
                location: '격전지 현장 | 실시간',
                title: '긴급속보',
                headline: '[속보] 치열한 교전 속 아군 우세… 적 후퇴 조짐',
                ticker: '전황 호전 보도   ///   적 지휘부 혼란 추정   ///   승전보 기대감 고조'
            }
        ],

        // 게임 업데이트 - 카메라맨만 확보
        update(game, elapsedSeconds, playerHQ) {
            if (!game || typeof Maps === 'undefined') return;

            // 도시맵에서만 카메라맨 스폰
            if (Maps.currentMap === 'city') {
                ensureCameraman(game);
            }
        },

        // [NEW] 수동 뉴스 재생 (플레이어가 버튼 클릭 시 호출)
        playManualNews(game) {
            if (!game) return;

            // 랜덤 프리셋 선택
            const preset = this.presets[Math.floor(Math.random() * this.presets.length)];

            // 뉴스 재생
            showNews(preset, 9000, () => scheduleNewsEnd(game, 9000));
        }
    };
})();
