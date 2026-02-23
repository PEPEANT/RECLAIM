(function (global) {
    'use strict';

    const AI = global.AI;
    if (!AI) return;

    Object.assign(AI, {
    _updateWaveController(frame) {
        const wps = this._getWaypoints();
        if (!wps || wps.length < 2) return;
        if (this.enableSafeAiV2 && this.wave.phase === 'RETREAT') this.wave.phase = 'HOLD';

        // 거점이 모두 파괴된 상태에서는 교착 방지를 위해 강제 공세 모드만 사용
        if (this.enableSafeAiV2 && !this._hasEnemyAnchor()) {
            if (frame - this.wave.lastCommandFrame < 36) return;
            this.wave.phase = 'ASSAULT';
            this.wave.wpIndex = Math.max(0, wps.length - 1);
            this.wave.holdUntil = 0;
            this.wave.retreatUntil = 0;
            this._orderAssaultTo(this._getAssaultTargetX());
            this.wave.lastCommandFrame = frame;
            return;
        }

        // 너무 자주 명령 내리면 난장판 => 0.8~1.2초 간격
        if (frame - this.wave.lastCommandFrame < 60) return;

        // 위협 체크는 조금 더 천천히(0.5초~1초)
        const doThreatCheck = (frame - this.wave.lastThreatCheck > 40);

        // 초기/초반일수록 HOLD 시간을 길게
        const early = frame < 60 * 70; // 약 70초까지는 신중하게
        const baseHold = early ? (60 * 2) : 60;   // 2초 vs 1초

        // 현재 웨이포인트 목표
        const wp = wps[Math.max(0, Math.min(this.wave.wpIndex, wps.length - 1))];

        // 위협 평가
        let threat = null;
        if (doThreatCheck) {
            threat = this._assessThreat(wps);
            this.wave.lastThreatCheck = frame;
        }

        // 마지막 전진 거점 도달 후에는 HOLD/PUSH 루프를 끊고 지속 공세만 유지
        const atFrontWaypoint = this.wave.wpIndex >= (wps.length - 1);
        if (this.enableSafeAiV2 && (this.wave.phase === 'ASSAULT' || atFrontWaypoint)) {
            this.wave.phase = 'ASSAULT';
            this.wave.holdUntil = 0;
            this._orderAssaultTo(this._getAssaultTargetX());
            this.wave.lastCommandFrame = frame;
            return;
        }

        // ===== 상태 전이 규칙 =====
        // (1) 압박이 크면 RETREAT 대신 거점 HOLD 시간을 늘린다.
        const shouldStabilize = !!(
            threat
            && (threat.shouldStabilize || threat.shouldRetreat)
            && early
            && this.wave.wpIndex < (wps.length - 1)
        );
        if (shouldStabilize) {
            this.wave.phase = 'HOLD';
            this.wave.wpIndex = Math.min(1, wps.length - 1); // FORT 우선 집결
            this.wave.holdUntil = Math.max(this.wave.holdUntil || 0, frame + (early ? 60 * 5 : 60 * 3));
            this._orderHoldAt(wps[this.wave.wpIndex].x, 320);
            this.wave.lastCommandFrame = frame;
            return;
        }

        // (2) HOLD: 거점에서 잠시 정지(대열 정비) + 거점 방어 우선
        if (this.wave.phase === 'HOLD') {
            if (frame < this.wave.holdUntil) {
                this._orderHoldAt(wp.x, 320);
                this.wave.lastCommandFrame = frame;
                return;
            }

            // HOLD 종료 → PUSH
            this.wave.phase = 'PUSH';
        }

        // (3) PUSH: 다음 거점으로 이동시키되, 일부는 거점 수비로 남김
        if (this.wave.phase === 'PUSH') {
            // 다음 거점으로 단계적으로 전진
            const nextIndex = Math.min(this.wave.wpIndex + 1, wps.length - 1);
            const nextWp = wps[nextIndex];

            this._orderPushTo(nextWp.x, wp.x);
            this.wave.wpIndex = nextIndex;

            // FRONT 도달 이후에는 정지 루프 없이 ASSAULT로 고정
            if (this.enableSafeAiV2 && nextIndex >= (wps.length - 1)) {
                this.wave.phase = 'ASSAULT';
                this.wave.holdUntil = 0;
                this.wave.lastCommandFrame = frame;
                return;
            }

            // 다음 거점 도착 전 정지 준비
            this.wave.phase = 'HOLD';
            this.wave.holdUntil = frame + baseHold + Math.floor(Math.random() * 60);

            this.wave.lastCommandFrame = frame;
        }
    },
    });
})(window);
