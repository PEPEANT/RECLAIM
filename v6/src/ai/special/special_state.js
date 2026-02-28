(function (global) {
    'use strict';

    const AI = global.AI;
    if (!AI) return;

    Object.assign(AI, {
    // ==========================
    // 특수무기 AI 운용 상태
    // ==========================
    special: null,


    _initSpecialState() {
        const tacticalCharges = (this.difficulty === 'elite') ? 10 : (this.difficulty === 'veteran' ? 8 : 6);
        const tacticalGrace = (this.difficulty === 'elite') ? (60 * 40) : (60 * 55);

        this.special = {
            charges: { nuke: 3, emp: 3, tactical: tacticalCharges },
            cd: { nuke: 0, emp: 0, tactical: 0 },
            // 시작 후 바로 안 씀 (지능적 사용)
            graceUntil: 60 * 25, // 약 25초
            lastThink: 0,
            thinkEvery: 20, // 매 20프레임 체크
            // 방어요새(1차방어사령부 대체) 파괴 감지
            fortressWasAlive: true,
            nukeUsedOnFortressBreak: false,
            // 전술미사일: 도착 프레임에 추가 폭발/추가 피해 트리거
            pending: [],
            // [NEW] 전술미사일 전용 설정
            tacticalGraceUntil: tacticalGrace,
            tacticalInFlight: false,      // 한 발 비행 중이면 다음 발 금지
            pendingLaunch: [],            // 발사 예약 큐
            // [NEW] 공습경보 시스템
            pendingNukeWarning: null,     // { at: frame, x, y } - 핵 경고 후 발사 예약
            pendingTacticalWarning: null  // { at: frame, x, y } - 전술미사일 경고 후 발사 예약
        };
    },
    });
})(window);
