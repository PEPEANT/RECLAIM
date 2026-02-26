(function (global) {
    'use strict';

    const types = global.LandingIntroTypes || {};
    const STATES = types.STATES || {
        APPROACH: 'approach',
        BEACH: 'beach',
        RAMP_OPEN: 'ramp_open',
        HOLD: 'hold',
        DONE: 'done',
        FAILED: 'failed'
    };

    class LandingCraftEntity {
        constructor(options = {}) {
            this.id = String(options.id || '').trim() || ('craft-' + Math.random().toString(36).slice(2));
            this.index = Number(options.index) || 0;
            this.x = Number(options.x) || 0;
            this.y = Number(options.y) || 0;
            this.beachX = Number(options.beachX) || this.x;
            this.approachSpeed = Math.max(10, Number(options.approachSpeed) || 120);
            this.delaySec = Math.max(0, Number(options.delaySec) || 0);
            this.approachSec = Math.max(0.4, Number(options.approachSec) || 3.5);
            this.beachSec = Math.max(0.2, Number(options.beachSec) || 1.2);
            this.rampOpenSec = Math.max(0.3, Number(options.rampOpenSec) || 1.2);
            this.holdSec = Math.max(0.4, Number(options.holdSec) || 2.8);
            this.timeoutSec = Math.max(4, Number(options.timeoutSec) || 20);
            this.scale = Math.max(0.4, Number(options.scale) || 1);

            this.elapsedSec = 0;
            this.approachElapsedSec = 0;
            this.beachElapsedSec = 0;
            this.rampElapsedSec = 0;
            this.holdElapsedSec = 0;
            this.state = STATES.APPROACH;
            this.rampOpenT = 0;
            this.active = false;
            this.failedReason = '';
        }

        _setState(next) {
            this.state = next;
        }

        _fail(reason) {
            this.failedReason = String(reason || '').trim() || 'unknown';
            this._setState(STATES.FAILED);
        }

        update(dtSec) {
            const dt = Math.max(0, Number(dtSec) || 0);
            if (this.state === STATES.DONE || this.state === STATES.FAILED) return;

            this.elapsedSec += dt;
            if (this.elapsedSec > this.timeoutSec) {
                this._fail('timeout');
                return;
            }

            if (!this.active) {
                if (this.elapsedSec < this.delaySec) return;
                this.active = true;
            }

            if (this.state === STATES.APPROACH) {
                const prevX = this.x;
                this.x = Math.min(this.beachX, this.x + (this.approachSpeed * dt));
                this.approachElapsedSec += dt;
                if (this.x >= this.beachX || this.approachElapsedSec >= this.approachSec) {
                    this.x = this.beachX;
                    this._setState(STATES.BEACH);
                } else if (this.x === prevX && dt > 0) {
                    this._fail('stuck');
                }
                return;
            }

            if (this.state === STATES.BEACH) {
                this.beachElapsedSec += dt;
                if (this.beachElapsedSec >= this.beachSec) {
                    this._setState(STATES.RAMP_OPEN);
                }
                return;
            }

            if (this.state === STATES.RAMP_OPEN) {
                this.rampElapsedSec += dt;
                this.rampOpenT = Math.max(0, Math.min(1, this.rampElapsedSec / this.rampOpenSec));
                if (this.rampOpenT >= 1) {
                    this._setState(STATES.HOLD);
                }
                return;
            }

            if (this.state === STATES.HOLD) {
                this.holdElapsedSec += dt;
                if (this.holdElapsedSec >= this.holdSec) {
                    this._setState(STATES.DONE);
                }
            }
        }

        isFinished() {
            return this.state === STATES.DONE || this.state === STATES.FAILED;
        }
    }

    global.LandingCraftEntity = LandingCraftEntity;
})(typeof window !== 'undefined' ? window : globalThis);
