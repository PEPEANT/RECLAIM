// src/game/news.js - Game news triggers for all maps
(function () {
    'use strict';

    // ═══════════════════════════════════════════════════════════
    // 헬퍼 함수들
    // ═══════════════════════════════════════════════════════════

    function getRightBunker(buildings) {
        if (!Array.isArray(buildings) || buildings.length === 0) return null;
        return buildings
            .filter(b => b && !b.dead && b.type === 'bunker')
            .sort((a, b) => b.x - a.x)[0] || null;
    }

    function getLeftBunker(buildings) {
        if (!Array.isArray(buildings) || buildings.length === 0) return null;
        return buildings
            .filter(b => b && !b.dead && b.type === 'bunker')
            .sort((a, b) => a.x - b.x)[0] || null;
    }

    function getPlayerHQ(buildings) {
        if (!Array.isArray(buildings) || buildings.length === 0) return null;
        return buildings.find(b => b && !b.dead && b.type === 'hq' && b.team === 'player') || null;
    }

    function getEnemyHQ(buildings) {
        if (!Array.isArray(buildings) || buildings.length === 0) return null;
        return buildings.find(b => b && !b.dead && b.type === 'hq' && b.team === 'enemy') || null;
    }

    // 랜덤 카메라 위치 선택 (총사령부/거점/적거점)
    function getRandomCameraTarget(game) {
        const candidates = [];
        const buildings = game.buildings || [];

        // 아군 HQ
        const playerHQ = getPlayerHQ(buildings);
        if (playerHQ) candidates.push({ x: playerHQ.x, label: 'playerHQ' });

        // 적 HQ
        const enemyHQ = getEnemyHQ(buildings);
        if (enemyHQ) candidates.push({ x: enemyHQ.x, label: 'enemyHQ' });

        // 거점들 (bunker)
        const bunkers = buildings.filter(b => b && !b.dead && b.type === 'bunker');
        bunkers.forEach((b, i) => {
            candidates.push({ x: b.x, label: 'bunker' + i });
        });

        // 방어시설 (defense_line)
        const defenseLine = buildings.find(b => b && !b.dead && b.type === 'defense_line');
        if (defenseLine) candidates.push({ x: defenseLine.x, label: 'defenseLine' });

        if (candidates.length === 0) {
            return (typeof CONFIG !== 'undefined' && CONFIG.mapWidth) ? CONFIG.mapWidth * 0.5 : 1000;
        }

        const pick = candidates[Math.floor(Math.random() * candidates.length)];
        return pick.x;
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
        update(game, elapsedSeconds, playerHQ) {
            if (!game || typeof Maps === 'undefined') return;

            const currentMap = Maps.currentMap;

            if (currentMap === 'city') {
                this.updateCity(game, elapsedSeconds, playerHQ);
            } else if (currentMap === 'plain') {
                this.updatePlain(game, elapsedSeconds);
            } else if (currentMap === 'mountain') {
                this.updateMountain(game, elapsedSeconds);
            } else if (currentMap === 'village') {
                this.updateVillage(game, elapsedSeconds);
            }
        },

        // ═══════════════════════════════════════════════════════════
        // 도시 맵 (기존)
        // ═══════════════════════════════════════════════════════════
        updateCity(game, elapsedSeconds, playerHQ) {
            // 1분 경과 + 아군 기갑 1기 이상(HQ 근처) -> 2번째 뉴스
            if (!game.cityArmorNewsShown) {
                const hq = playerHQ || null;
                const armoredNearHQ = (game.players || []).some(u => {
                    if (!u || u.dead || !u.stats || u.stats.category !== 'armored') return false;
                    if (!hq) return true;
                    return Math.abs(u.x - hq.x) <= 320;
                });

                if (elapsedSeconds >= 60 && armoredNearHQ) {
                    game.cityArmorNewsShown = true;
                    if (hq) game.newsCameraX = hq.x;

                    const preset = getPreset('cityArmor', {
                        lockLocation: true,
                        location: '수도권 외곽 순환도로 상공 | 17:45',
                        title: '긴급속보',
                        headline: '[속보] 원블루국 국군, 시가지 진입 개시 첫 교차로 확보',
                        ticker: '수도권 상공 헬기 편대 진입... 긴장 고조   ///   군 당국 \"시민 안전 위해 작전 지역 접근 금지\"   ///   통신망 일부 장애 발생... 복구 작업 중   ///   야간 통행 금지령 검토 중'
                    });

                    showNews(preset, 9000, () => scheduleNewsEnd(game, 9000));
                }
            }

            // 2분 30초 경과 -> 3번째 뉴스 (오른쪽 거점 고정)
            if (!game.cityMidNewsShown && elapsedSeconds >= 150) {
                game.cityMidNewsShown = true;
                const rightBunker = getRightBunker(game.buildings);
                if (rightBunker) game.newsCameraX = rightBunker.x;

                const preset = getPreset('cityMid', {
                    lockLocation: true,
                    location: '원블루국 도심 | 17:58',
                    title: '긴급속보',
                    headline: '붉은네모국 대통령',
                    ticker: '원블루국 도심, 적 병력 대거 유입... 피해 급증   ///   적군 공세 강화... 외곽 방어선 곳곳에서 교전   ///   도심 진입로로 적 병력 유입 확인... 긴급 대피 권고   ///   사상자 증가... 구급 출동 지연, 의료 대응 한계'
                });

                showNews(preset, 9000, () => scheduleNewsEnd(game, 9000));
            }

            // 9분 경과 -> 4번째 뉴스 (오른쪽 거점 고정)
            if (!game.cityTotalWarNewsShown && elapsedSeconds >= 540) {
                game.cityTotalWarNewsShown = true;
                const rightBunker = getRightBunker(game.buildings);
                if (rightBunker) game.newsCameraX = rightBunker.x;

                const preset = getPreset('cityTotalWar', {
                    lockLocation: true,
                    location: '도시 외곽 방어선 | 18:09',
                    title: '긴급속보',
                    headline: '붉은네모국 대통령 총력전 선포',
                    ticker: '[속보] 전면 총력전 돌입 선언   ///   국방부 \"모든 예비전력 즉시 동원\"   ///   도심 통제 구역 확대   ///   시민 대피령 강화'
                });

                showNews(preset, 9000, () => scheduleNewsEnd(game, 9000));
            }
        },

        // ═══════════════════════════════════════════════════════════
        // 평야 맵 - 반격 개시
        // ═══════════════════════════════════════════════════════════
        updatePlain(game, elapsedSeconds) {
            // 1분 경과 -> 초반 뉴스 (랜덤 카메라)
            if (!game.plainStartNewsShown && elapsedSeconds >= 60) {
                game.plainStartNewsShown = true;
                game.newsCameraX = getRandomCameraTarget(game);

                const preset = getPreset('plainStart', {
                    lockLocation: true,
                    location: '평야 전선 최전방 | 06:15',
                    title: '긴급속보',
                    headline: '[속보] 평야 전선, 원블루국 반격 개시… 적 방어시설 전면 압박',
                    ticker: '전선 전역 포격 교환… 진지 쟁탈전 격화   ///   원블루국 "주요 고지 확보 중"   ///   붉은네모국 방어시설 일부 파손 확인   ///   민간인 접근 통제 강화'
                });

                showNews(preset, 9000, () => scheduleNewsEnd(game, 9000));
            }

            // 3분 경과 -> 중반 뉴스 (대통령 담화, 인트로 스킵)
            if (!game.plainMidNewsShown && elapsedSeconds >= 180) {
                game.plainMidNewsShown = true;
                game.newsCameraX = getRandomCameraTarget(game);

                const preset = getPreset('plainMid', {
                    lockLocation: true,
                    skipIntro: true,
                    location: '평야 전선 중앙 | 06:32',
                    title: '긴급담화',
                    headline: '[속보] 원블루국 대통령 담화 "끝까지 버틴다"… 전선 돌파로 전황 반전',
                    ticker: '대통령 "이 전쟁은 침략에 대한 응징"… 국민 결속 호소   ///   국제사회 "민간 피해 중단 촉구"… 붉은네모국 강력 비난   ///   원블루국 기갑부대 돌파… 적 방어선 균열 확인   ///   전선 일부 구간, 원블루국 통제권 확대'
                });

                showNews(preset, 9000, () => scheduleNewsEnd(game, 9000));
            }

            // 7분 경과 -> 후반 뉴스 (승기)
            if (!game.plainFinalNewsShown && elapsedSeconds >= 420) {
                game.plainFinalNewsShown = true;
                game.newsCameraX = getRandomCameraTarget(game);

                const preset = getPreset('plainFinal', {
                    lockLocation: true,
                    location: '평야 전선 후방 | 06:58',
                    title: '긴급속보',
                    headline: '[속보] 원블루국, 평야 교전 승기… 붉은네모국 일부 부대 퇴로 차단',
                    ticker: '적 보급로 차단 시도 성공… 후퇴 부대 분산   ///   원블루국 "전선 안정화 단계 진입"   ///   붉은네모국 방어시설 잔존 구간 정리 중   ///   다음 작전 지역으로 전환 준비'
                });

                showNews(preset, 9000, () => scheduleNewsEnd(game, 9000));
            }
        },

        // ═══════════════════════════════════════════════════════════
        // 산악 맵 - 고지 쟁탈전
        // ═══════════════════════════════════════════════════════════
        updateMountain(game, elapsedSeconds) {
            // 1분 경과 -> 초반 뉴스
            if (!game.mountainStartNewsShown && elapsedSeconds >= 60) {
                game.mountainStartNewsShown = true;
                game.newsCameraX = getRandomCameraTarget(game);

                const preset = getPreset('mountainStart', {
                    lockLocation: true,
                    location: '산악 전선 능선 | 09:20',
                    title: '긴급속보',
                    headline: '[속보] 산악 지대 교전 확대… 원블루국, 매복 공격에도 진지 사수',
                    ticker: '시야 제한 속 근접 교전 잇따라   ///   산악로 통제 강화… 이동 제한 조치   ///   원블루국 "주요 능선선 유지"   ///   붉은네모국 기습 반복… 소모전 양상'
                });

                showNews(preset, 9000, () => scheduleNewsEnd(game, 9000));
            }

            // 4분 경과 -> 중반 뉴스 (인도주의, 인트로 스킵)
            if (!game.mountainMidNewsShown && elapsedSeconds >= 240) {
                game.mountainMidNewsShown = true;
                game.newsCameraX = getRandomCameraTarget(game);

                const preset = getPreset('mountainMid', {
                    lockLocation: true,
                    skipIntro: true,
                    location: '산악 핵심 고지 | 09:45',
                    title: '긴급속보',
                    headline: '[속보] 산악 핵심 고지 확보… 원블루국 "인명 피해 최소화" 긴급 지시',
                    ticker: '국방부 "포로·민간인 보호 원칙 준수"… 현장 통제 강화   ///   구조대 투입… 부상자 후송 작전 진행   ///   원블루국, 능선선 연결 성공… 붉은네모국 후퇴 정황   ///   주민 대피로 확보… 산악로 일부 개방'
                });

                showNews(preset, 9000, () => scheduleNewsEnd(game, 9000));
            }

            // 8분 경과 -> 후반 뉴스 (포위/정리)
            if (!game.mountainFinalNewsShown && elapsedSeconds >= 480) {
                game.mountainFinalNewsShown = true;
                game.newsCameraX = getRandomCameraTarget(game);

                const preset = getPreset('mountainFinal', {
                    lockLocation: true,
                    location: '산악 전선 종합 | 10:12',
                    title: '긴급속보',
                    headline: '[속보] 산악 전선 정리 국면… 원블루국, 잔여 적 병력 포위',
                    ticker: '수색·섬멸 작전 전환… 잔여 저항 최소화   ///   원블루국 "통로 확보 완료"   ///   붉은네모국 일부 부대 통신 두절 추정   ///   다음 전장 투입 준비 가속'
                });

                showNews(preset, 9000, () => scheduleNewsEnd(game, 9000));
            }
        },

        // ═══════════════════════════════════════════════════════════
        // 마을 맵 - 최종 결전
        // ═══════════════════════════════════════════════════════════
        updateVillage(game, elapsedSeconds) {
            // 30초 경과 -> 초반 뉴스 (빠른 시작)
            if (!game.villageStartNewsShown && elapsedSeconds >= 30) {
                game.villageStartNewsShown = true;
                game.newsCameraX = getRandomCameraTarget(game);

                const preset = getPreset('villageStart', {
                    lockLocation: true,
                    location: '마을 전선 입구 | 14:00',
                    title: '긴급속보',
                    headline: '[속보] 마을 전면전 돌입… 원블루국, 적 기지 압박 시작',
                    ticker: '양측 총사령부 가동… 포격·돌격 반복   ///   원블루국 "민가 지역 통제, 안전 구역 설정"   ///   붉은네모국 방어 병력 재배치   ///   교전 강도 \'최고조\''
                });

                showNews(preset, 9000, () => scheduleNewsEnd(game, 9000));
            }

            // 2분 경과 -> 중반 뉴스 (정부 경고, 인트로 스킵)
            if (!game.villageMidNewsShown && elapsedSeconds >= 120) {
                game.villageMidNewsShown = true;
                game.newsCameraX = getRandomCameraTarget(game);

                const preset = getPreset('villageMid', {
                    lockLocation: true,
                    skipIntro: true,
                    location: '마을 중앙 광장 | 14:28',
                    title: '긴급속보',
                    headline: '[속보] "용납 못한다" 원블루국 정부 강경 경고… 적 기지 외곽 붕괴',
                    ticker: '정부 "붉은네모국 즉각 철수하라"… 추가 제재 촉구   ///   시민들 분노 확산… 자원봉사·구호 물자 집결   ///   원블루국, 핵심 방어선 돌파… 기지 접근로 열려   ///   붉은네모국 "책임은 상대에" 주장… 국제 비난 거세'
                });

                showNews(preset, 9000, () => scheduleNewsEnd(game, 9000));
            }

            // 5분 경과 -> 후반 뉴스 (최종 승리 직전)
            if (!game.villageFinalNewsShown && elapsedSeconds >= 300) {
                game.villageFinalNewsShown = true;
                // 마지막은 적 HQ 방향으로 카메라
                const enemyHQ = getEnemyHQ(game.buildings);
                game.newsCameraX = enemyHQ ? enemyHQ.x : getRandomCameraTarget(game);

                const preset = getPreset('villageFinal', {
                    lockLocation: true,
                    location: '적 총사령부 인근 | 14:55',
                    title: '긴급속보',
                    headline: '[속보] 원블루국, 적 총사령부 타격 임박… 전쟁 종결 단계',
                    ticker: '적 기지 기능 마비 추정… 마지막 저항 산발적   ///   원블루국 "작전 목표 달성 눈앞"   ///   붉은네모국 지휘 체계 혼선 보도   ///   전면전 종결 \'초읽기\''
                });

                showNews(preset, 9000, () => scheduleNewsEnd(game, 9000));
            }
        }
    };
})();
