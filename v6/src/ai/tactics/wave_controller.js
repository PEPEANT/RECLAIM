(function (global) {
    'use strict';

    const AI = global.AI;
    if (!AI) return;

    Object.assign(AI, {
    _ensureWaveRuntimeState(frame) {
        if (!this.wave || typeof this.wave !== 'object') {
            this.wave = {
                phase: 'HOLD',
                wpIndex: 0,
                holdUntil: 0,
                retreatUntil: 0,
                lastCommandFrame: frame || 0,
                lastThreatCheck: frame || 0
            };
        }

        if (!Number.isFinite(Number(this.wave.wpIndex))) this.wave.wpIndex = 0;
        if (!Number.isFinite(Number(this.wave.holdUntil))) this.wave.holdUntil = 0;
        if (!Number.isFinite(Number(this.wave.retreatUntil))) this.wave.retreatUntil = 0;
        if (!Number.isFinite(Number(this.wave.lastCommandFrame))) this.wave.lastCommandFrame = frame || 0;
        if (!Number.isFinite(Number(this.wave.lastThreatCheck))) this.wave.lastThreatCheck = frame || 0;
        if (!Number.isFinite(Number(this.wave.phaseLockUntil))) this.wave.phaseLockUntil = 0;
        if (!Number.isFinite(Number(this.wave.stabilizeMeter))) this.wave.stabilizeMeter = 0;
        if (!Number.isFinite(Number(this.wave.advanceMeter))) this.wave.advanceMeter = 0;
        if (!Number.isFinite(Number(this.wave.fallbackMeter))) this.wave.fallbackMeter = 0;
        if (!this.wave.lastThreat || typeof this.wave.lastThreat !== 'object') this.wave.lastThreat = null;

        const phase = String(this.wave.phase || 'HOLD');
        if (phase === 'PUSH') this.wave.phase = 'ENGAGE';
        if (phase === 'RETREAT') this.wave.phase = 'FALLBACK';
    },

    _setWavePhase(nextPhase, frame, lockFrames = 90) {
        const next = String(nextPhase || 'HOLD');
        if (this.wave.phase !== next) {
            this.wave.phase = next;
            this.wave.phaseLockUntil = frame + Math.max(24, Math.floor(Number(lockFrames) || 90));
        }
    },

    _getWaveCommandInterval() {
        const phase = String(this.wave && this.wave.phase || 'HOLD');
        if (phase === 'ASSAULT') return 42;
        if (phase === 'FALLBACK') return 56;
        if (phase === 'ENGAGE') return 64;
        return 54; // HOLD default
    },

    _updateWaveController(frame) {
        this._ensureWaveRuntimeState(frame);
        const wps = this._getWaypoints();
        if (!wps || wps.length < 2) return;
        if (this.enableSafeAiV2 && this.wave.phase === 'RETREAT') this.wave.phase = 'FALLBACK';

        // 거점이 모두 파괴된 상태에서는 교착 방지를 위해 강제 공세 모드만 사용
        if (this.enableSafeAiV2 && !this._hasEnemyAnchor()) {
            if (frame - this.wave.lastCommandFrame < 36) return;
            this._setWavePhase('ASSAULT', frame, 54);
            this.wave.wpIndex = Math.max(0, wps.length - 1);
            this.wave.holdUntil = 0;
            this.wave.retreatUntil = 0;
            this._orderAssaultTo(this._getAssaultTargetX());
            this.wave.lastCommandFrame = frame;
            return;
        }

        // 명령 전환 빈도 제한
        const cmdInterval = this._getWaveCommandInterval();
        if (frame - this.wave.lastCommandFrame < cmdInterval) return;

        // 위협 체크는 더 자주 하되, 전환은 lock으로 억제한다.
        const doThreatCheck = (frame - this.wave.lastThreatCheck > 26);

        // 초기/초반일수록 HOLD 시간을 길게
        const early = frame < 60 * 70; // 약 70초까지는 신중하게
        const baseHold = early ? (60 * 2) : 60;   // 2초 vs 1초

        // 현재 웨이포인트 목표
        this.wave.wpIndex = Math.max(0, Math.min(this.wave.wpIndex, wps.length - 1));
        const wp = wps[this.wave.wpIndex];

        // 위협 평가
        let threat = this.wave.lastThreat;
        if (doThreatCheck) {
            threat = this._assessThreat(wps);
            this.wave.lastThreatCheck = frame;
            this.wave.lastThreat = threat;
            const smooth = 0.72;
            const stabilizeP = Math.max(0, Number(threat && threat.stabilizePressure) || 0);
            const fallbackP = Math.max(0, Number(threat && threat.fallbackPressure) || 0);
            const advanceP = Math.max(0, Number(threat && threat.advancePressure) || 0);
            this.wave.stabilizeMeter = (this.wave.stabilizeMeter * smooth) + (stabilizeP * (1 - smooth));
            this.wave.fallbackMeter = (this.wave.fallbackMeter * smooth) + (fallbackP * (1 - smooth));
            this.wave.advanceMeter = (this.wave.advanceMeter * smooth) + (advanceP * (1 - smooth));
        }
        if (!threat || typeof threat !== 'object') {
            threat = {
                shouldStabilize: false,
                shouldFallback: false,
                shouldAdvance: false,
                emergency: false,
                stabilizePressure: this.wave.stabilizeMeter || 0,
                fallbackPressure: this.wave.fallbackMeter || 0,
                advancePressure: this.wave.advanceMeter || 0
            };
        }
        const canSwitchPhase = frame >= (Number(this.wave.phaseLockUntil) || 0);
        const emergency = !!threat.emergency;

        // 마지막 전진 거점 도달 후에는 HOLD/PUSH 루프를 끊고 지속 공세만 유지
        const atFrontWaypoint = this.wave.wpIndex >= (wps.length - 1);
        if (this.enableSafeAiV2 && (this.wave.phase === 'ASSAULT' || atFrontWaypoint)) {
            // 단, 압박이 너무 강하면 ASSAULT에서 FALLBACK으로 전환 가능.
            if (this._hasEnemyAnchor()
                && (emergency || this.wave.fallbackMeter >= 1.55 || threat.shouldFallback)
                && canSwitchPhase) {
                this._setWavePhase('FALLBACK', frame, early ? 130 : 100);
                this.wave.wpIndex = Math.min(1, wps.length - 1);
                this.wave.holdUntil = frame + (early ? 60 * 3 : 60 * 2);
                this._orderRetreatTo(wps[this.wave.wpIndex].x);
                this.wave.lastCommandFrame = frame;
                return;
            }

            this._setWavePhase('ASSAULT', frame, 54);
            this.wave.holdUntil = 0;
            this._orderAssaultTo(this._getAssaultTargetX());
            this.wave.lastCommandFrame = frame;
            return;
        }

        // ===== 상태 전이 규칙 =====
        // (1) 압박이 크면 FALLBACK으로 전환
        const shouldFallback = !!(
            (threat.shouldFallback || this.wave.fallbackMeter >= 1.45)
            && this.wave.wpIndex < (wps.length - 1)
        );
        if ((emergency || shouldFallback) && (canSwitchPhase || emergency)) {
            this._setWavePhase('FALLBACK', frame, early ? 130 : 96);
            this.wave.wpIndex = Math.min(1, wps.length - 1); // FORT 우선 집결
            this.wave.holdUntil = Math.max(this.wave.holdUntil || 0, frame + (early ? 60 * 4 : 60 * 3));
            this._orderRetreatTo(wps[this.wave.wpIndex].x);
            this.wave.lastCommandFrame = frame;
            return;
        }

        // (2) FALLBACK: 후방 집결 후 안정화
        if (this.wave.phase === 'FALLBACK') {
            const fallbackWp = wps[Math.max(0, Math.min(this.wave.wpIndex, wps.length - 1))];
            const needFallbackMore = (
                frame < this.wave.holdUntil
                || this.wave.stabilizeMeter > 0.88
                || threat.shouldStabilize
            );
            if (needFallbackMore) {
                this._orderRetreatTo(fallbackWp.x);
                this.wave.lastCommandFrame = frame;
                return;
            }

            this._setWavePhase('HOLD', frame, early ? 100 : 76);
            this.wave.holdUntil = frame + baseHold + 30;
            this._orderHoldAt(fallbackWp.x, 340);
            this.wave.lastCommandFrame = frame;
            return;
        }

        // (3) HOLD: 거점에서 잠시 정지(대열 정비) + 거점 방어 우선
        if (this.wave.phase === 'HOLD') {
            const needHoldMore = (
                frame < this.wave.holdUntil
                || this.wave.stabilizeMeter > 1.0
                || threat.shouldStabilize
            );
            if (needHoldMore) {
                this._orderHoldAt(wp.x, 320);
                this.wave.lastCommandFrame = frame;
                return;
            }

            // HOLD 종료 → ENGAGE
            if (canSwitchPhase || threat.shouldAdvance || this.wave.advanceMeter >= 0.74) {
                this._setWavePhase('ENGAGE', frame, early ? 96 : 72);
            } else {
                this.wave.holdUntil = frame + 40;
                this._orderHoldAt(wp.x, 320);
                this.wave.lastCommandFrame = frame;
                return;
            }
        }

        // (4) ENGAGE: 다음 거점으로 이동시키되, 일부는 거점 수비로 남김
        if (this.wave.phase === 'ENGAGE') {
            if ((threat.shouldStabilize || this.wave.stabilizeMeter >= 1.08) && canSwitchPhase) {
                this._setWavePhase('HOLD', frame, early ? 100 : 80);
                this.wave.holdUntil = frame + (early ? 60 * 2 : 60);
                this._orderHoldAt(wp.x, 320);
                this.wave.lastCommandFrame = frame;
                return;
            }

            // 다음 거점으로 단계적으로 전진
            const nextIndex = Math.min(this.wave.wpIndex + 1, wps.length - 1);
            const nextWp = wps[nextIndex];

            this._orderPushTo(nextWp.x, wp.x, threat);
            this.wave.wpIndex = nextIndex;

            // FRONT 도달 이후에는 조건부 ASSAULT 진입
            if (nextIndex >= (wps.length - 1)) {
                const canAssault = (this.wave.advanceMeter >= 0.84 && this.wave.stabilizeMeter < 0.92);
                if (this.enableSafeAiV2 && canAssault) {
                    this._setWavePhase('ASSAULT', frame, 70);
                    this.wave.holdUntil = 0;
                    this.wave.lastCommandFrame = frame;
                    return;
                }

                this._setWavePhase('HOLD', frame, early ? 108 : 84);
                this.wave.holdUntil = frame + baseHold + Math.floor(Math.random() * 60);
                this.wave.lastCommandFrame = frame;
                return;
            }

            // 중간 전진 구간은 lock 기간 동안 phase 유지
            if (canSwitchPhase && this.wave.stabilizeMeter > 0.96) {
                this._setWavePhase('HOLD', frame, early ? 96 : 72);
                this.wave.holdUntil = frame + baseHold + Math.floor(Math.random() * 45);
            }

            this.wave.lastCommandFrame = frame;
            return;
        }

        // 알 수 없는 상태는 HOLD로 정규화
        if (this.wave.phase !== 'ASSAULT') {
            this._setWavePhase('HOLD', frame, 72);
            this.wave.holdUntil = frame + baseHold;
            this._orderHoldAt(wp.x, 320);
            this.wave.lastCommandFrame = frame;
            return;
        }

        if (this.wave.phase === 'ASSAULT') {
            this._orderAssaultTo(this._getAssaultTargetX());
            this.wave.lastCommandFrame = frame;
            return;
        }
    },
    });
})(window);
