// corpse.js - 보병 시체 시스템
(function () {
    'use strict';

    const rand = (min, max) => Math.random() * (max - min) + min;
    const INFANTRY_CORPSE_IDS = new Set([
        'infantry',
        'bagpiper',
        'engineer',
        'rpg',
        'sniper',
        'special_ops',
        'special_forces',
        'drone_operator'
    ]);
    const DEFAULT_CACHE_BUILD_BUDGET = 2;

    /**
     * Corpse - 보병 사망 시 생성되는 시체 객체
     * - 쓰러지는 애니메이션 (90° 회전)
     * - 5초 후 페이드아웃
     * - 총맞음 혈흔 + 보병별 간단 소품 드롭
     */
    class Corpse {
        constructor(x, y, typeKey, facing, team, deathInfo = {}) {
            this.x = x;
            this.y = y;
            this.typeKey = typeKey;
            this.facing = facing || 1;
            this.team = team || 'player';

            // 사망 메타 정보
            this.deathInfo = (deathInfo && typeof deathInfo === 'object') ? deathInfo : {};
            this.attackType = (typeof this.deathInfo.attackType === 'string') ? this.deathInfo.attackType : null;
            this.isGunshot = this.attackType === 'bullet' || this.attackType === 'machinegun';
            this.isExplosion = this._isExplosionAttack(this.attackType);
            const hvx = Number.isFinite(this.deathInfo.hitVx) ? this.deathInfo.hitVx : null;
            this.hitDir = (hvx !== null) ? (hvx >= 0 ? 1 : -1) : this.facing;
            this.opState = (typeof this.deathInfo.opState === 'string') ? this.deathInfo.opState : null;

            // 애니메이션 상태
            this.fallProgress = 0;      // 0~1 쓰러지는 진행도
            // 기본 5초 → 성능 저감을 위해 게임 설정값 사용
            const gameFade = (typeof game !== 'undefined' && Number.isFinite(game.corpseFadeTimer)) ? game.corpseFadeTimer : 300;
            this.fadeTimer = gameFade;
            this.opacity = 1.0;
            this.fallen = false;
            this.deadAt = (typeof game !== 'undefined' && Number.isFinite(game.frame)) ? game.frame : 0;
            this.staticAfter = 18; // 쓰러짐 이후 업데이트 중지 프레임

            // 민간인 시체는 더 빨리 사라짐
            if (this.typeKey === 'civ_a' || this.typeKey === 'civ_b' || this.typeKey === 'civ_crowd') {
                const civFade = (typeof game !== 'undefined' && Number.isFinite(game.corpseCivilianFadeTimer)) ? game.corpseCivilianFadeTimer : 90;
                this.fadeTimer = civFade; // 1.5초 기본
            }

            // 폭발 넉백/회전 (초기 0.2~0.4초)
            this.knockbackFrames = 0;
            this.knockbackFrame = 0;
            this.kbVx = 0;
            this.kbVy = 0;
            this.kbAngle = 0;
            this.kbSpin = 0;
            if (this.isExplosion) this._initKnockback();
            if (this.isExplosion) {
                // Explosive deaths should not linger in standing pose.
                this.fallProgress = 0.22;
            }

            // 총맞음 혈흔/소품 드롭(생성 시 고정)
            this.bloodSpots = this._initBloodSpots();
            this.drops = this._initDrops();

            // 캐시된 스킨 데이터
            this.skin = null;
            if (typeof UnitSkinDB !== 'undefined' && UnitSkinDB.getSkin) {
                this.skin = UnitSkinDB.getSkin(typeKey);
            }

            // Offscreen cache (static corpse)
            this._cacheCanvas = null;
            this._cacheReady = false;
            this._cacheKey = '';
            this._cacheSize = 140;
            this._dummyUnit = null;
        }

        /**
         * 매 프레임 업데이트
         * @returns {boolean} true면 제거 대상
         */
        update() {
            if (this.knockbackFrame < this.knockbackFrames) {
                this.x += this.kbVx;
                this.y += this.kbVy;
                this.kbVy += 0.22;
                this.kbVx *= 0.92;
                this.kbVy *= 0.92;
                this.kbAngle += this.kbSpin;
                this.knockbackFrame++;
            }

            // 바닥 아래로 내려가지 않도록 고정
            if (typeof game !== 'undefined' && Number.isFinite(game.groundY)) {
                const bounds = (typeof game.getGroundLaneBounds === 'function')
                    ? game.getGroundLaneBounds()
                    : null;
                const maxGroundY = (bounds && Number.isFinite(Number(bounds.max)))
                    ? Number(bounds.max)
                    : Number(game.groundY);
                const groundClampY = Number.isFinite(maxGroundY) ? maxGroundY : Number(game.groundY);
                if (this.y > groundClampY) {
                    this.y = groundClampY;
                    if (this.kbVy > 0) this.kbVy = 0;
                }
            }

            // 쓰러지는 애니메이션 (약 20프레임)
            if (this.fallProgress < 1) {
                const fallStep = this.isExplosion ? 0.11 : 0.05;
                this.fallProgress += fallStep;
                if (this.fallProgress >= 1) {
                    this.fallProgress = 1;
                    this.fallen = true;
                }
                return false;
            }

            // 쓰러짐 이후 업데이트 중지 (draw에서 페이드 계산)
            return true;
        }

        _isExplosionAttack(type) {
            if (!type) return false;
            const t = String(type);
            const explosionTypes = new Set([
                'rocket',
                'shell',
                'aa_shell',
                'artillery',
                'bomb',
                'tactical_missile',
                'nuke',
                'engineer_missile',
                'drone_explosion',
                'explosion'
            ]);
            return explosionTypes.has(t);
        }

        _initKnockback() {
            this.knockbackFrames = Math.floor(rand(12, 24));
            const hvx = Number.isFinite(this.deathInfo.hitVx) ? this.deathInfo.hitVx : null;
            const hvy = Number.isFinite(this.deathInfo.hitVy) ? this.deathInfo.hitVy : null;

            let dirX = this.facing || 1;
            let dirY = -0.9;
            if (hvx !== null || hvy !== null) {
                const vx = hvx !== null ? hvx : dirX;
                const vy = hvy !== null ? hvy : -Math.abs(vx);
                const mag = Math.hypot(vx, vy) || 1;
                dirX = vx / mag;
                dirY = vy / mag;
            } else {
                dirX = Math.random() < 0.5 ? -1 : 1;
                dirY = -rand(0.6, 1.2);
            }

            const baseSpeed = rand(1.0, 1.6);
            this.kbVx = dirX * baseSpeed * rand(1.4, 2.0);
            this.kbVy = dirY * baseSpeed * rand(1.2, 1.8);
            this.kbSpin = rand(0.12, 0.24) * (dirX >= 0 ? 1 : -1);
            this.kbAngle = 0;
        }

        _initBloodSpots() {
            if (!this.isGunshot) return [];
            const spots = [];
            const count = 1 + Math.floor(Math.random() * 2);
            const dir = this.hitDir || 1;
            for (let i = 0; i < count; i++) {
                const dx = dir * rand(2, 6) + rand(-2, 2);
                const dy = rand(-1, 3);
                const r = rand(2, 4);
                spots.push({
                    x: dx,
                    y: dy,
                    r,
                    rot: rand(0, Math.PI),
                    alpha: rand(0.25, 0.4)
                });
            }
            return spots;
        }

        _initDrops() {
            const drops = [];
            const fx = this.facing || 1;
            const jx = () => rand(-2, 2);
            const jy = () => rand(-1, 1);
            const gy = () => rand(-2, 0);

            switch (this.typeKey) {
                case 'worker':
                    drops.push({ kind: 'shovel', x: -10 * fx + jx(), y: gy() + jy(), rot: rand(-0.6, -0.2) * fx });
                    break;
                case 'infantry':
                    drops.push({ kind: 'rifle', x: 7 * fx + jx(), y: gy() + jy(), rot: rand(-0.3, 0.3) });
                    drops.push({ kind: 'helmet', x: -2 * fx + jx(), y: gy() + jy(), rot: rand(-0.6, 0.6) });
                    break;
                case 'engineer':
                case 'rpg':
                    drops.push({ kind: 'rpg', x: 8 * fx + jx(), y: gy() + jy(), rot: rand(-0.25, 0.25) });
                    drops.push({ kind: 'rocket_cap', x: 14 * fx + jx(), y: gy() + jy(), rot: rand(-0.5, 0.5) });
                    break;
                case 'infantry':
                    drops.push({ kind: 'rifle', x: 7 * fx + jx(), y: gy() + jy(), rot: rand(-0.3, 0.3) });
                    break;
                case 'drone_operator':
                    if (this.opState === 'laptop') {
                        drops.push({ kind: 'laptop', x: 4 * fx + jx(), y: gy() + jy(), rot: rand(-0.25, 0.25) });
                    } else {
                        drops.push({ kind: 'rifle', x: 7 * fx + jx(), y: gy() + jy(), rot: rand(-0.3, 0.3) });
                    }
                    break;
                default:
                    break;
            }
            return drops;
        }

        _getCacheKey(debug) {
            const noFilter = !!(debug && debug.corpseNoFilter);
            const op = this.opState || '';
            return `${this.typeKey}|${this.team}|${this.facing}|${op}|${this.isGunshot ? 1 : 0}|${noFilter ? 1 : 0}`;
        }

        _buildCache(allowFilter) {
            if (typeof document === 'undefined') return false;
            const size = this._cacheSize || 140;
            if (!this._cacheCanvas) {
                this._cacheCanvas = document.createElement('canvas');
            }
            const cvs = this._cacheCanvas;
            if (cvs.width !== size || cvs.height !== size) {
                cvs.width = size;
                cvs.height = size;
            }
            const cctx = cvs.getContext('2d');
            if (!cctx) return false;
            cctx.setTransform(1, 0, 0, 1, 0, 0);
            cctx.clearRect(0, 0, size, size);
            cctx.save();
            cctx.translate(size / 2, size / 2);
            this._drawCorpseBody(cctx, false, allowFilter);
            cctx.restore();
            this._cacheReady = true;
            return true;
        }

        _canBuildCacheThisFrame(debug) {
            if (typeof game === 'undefined' || !Number.isFinite(game.frame)) return true;
            const frame = Number(game.frame);
            if (Corpse._cacheBuildFrame !== frame) {
                Corpse._cacheBuildFrame = frame;
                Corpse._cacheBuildCount = 0;
            }
            const rawBudget = (debug && Number.isFinite(debug.corpseCacheBuildBudget))
                ? Number(debug.corpseCacheBuildBudget)
                : DEFAULT_CACHE_BUILD_BUDGET;
            const budget = Math.max(1, Math.floor(rawBudget || DEFAULT_CACHE_BUILD_BUDGET));
            if (Corpse._cacheBuildCount >= budget) return false;
            Corpse._cacheBuildCount += 1;
            return true;
        }

        _getDummyRenderUnit(renderId) {
            if (!this._dummyUnit) {
                this._dummyUnit = {
                    x: 0,
                    y: 0,
                    vx: 0,
                    facing: this.facing || 1,
                    team: this.team,
                    stats: {
                        id: renderId || 'infantry',
                        category: 'infantry',
                        speed: 0.9,
                        range: 260
                    },
                    hp: 100,
                    maxHp: 100,
                    dead: false,
                    commandMode: 'stop',
                    attackTarget: null,
                    lastAttack: -1,
                    lastDamagedFrame: -9999
                };
            }
            const dummyUnit = this._dummyUnit;
            dummyUnit.facing = this.facing || 1;
            dummyUnit.team = this.team;
            dummyUnit.stats.id = renderId || 'infantry';
            dummyUnit.commandMode = 'stop';
            dummyUnit._forcedInfantryStance = undefined;
            dummyUnit.opState = undefined;
            dummyUnit.engineerMode = undefined;
            return dummyUnit;
        }

        _drawUnitRenderV2Corpse(ctx, applyFilter) {
            const sourceId = String(this.typeKey || '').trim();
            if (!sourceId) return false;
            if (sourceId === 'civ_a' || sourceId === 'civ_b' || sourceId === 'civ_crowd') return false;
            if (typeof UnitRenderV2 === 'undefined' || !UnitRenderV2 || typeof UnitRenderV2.draw !== 'function') return false;

            // Use a single infantry corpse renderer path for infantry-family units.
            // This avoids unknown placeholder fallbacks and keeps death poses consistent.
            const renderId = INFANTRY_CORPSE_IDS.has(sourceId) ? 'infantry' : sourceId;
            const dummyUnit = this._getDummyRenderUnit(renderId);
            if (renderId === 'infantry') {
                dummyUnit._forcedInfantryStance = this.isExplosion ? 'prone' : 'crouching';
            }

            if (sourceId === 'drone_operator') {
                dummyUnit.opState = (this.opState === 'laptop') ? 'laptop' : 'rifle';
            } else if (sourceId === 'engineer' || sourceId === 'rpg') {
                dummyUnit.engineerMode = 'carrying';
            }

            ctx.save();
            applyFilter();
            // Battle renderer uses 1.4 as baseline unit model scale.
            ctx.scale(1.4, 1.4);
            let ok = false;
            try {
                ok = UnitRenderV2.draw(dummyUnit, ctx, {
                    mode: 'battle',
                    team: this.team
                }) === true;
            } catch (_) {
                // Prevent occasional double-render fallback when V2 path partially draws then throws.
                ok = (renderId === 'infantry');
            }
            ctx.restore();
            return ok;
        }

        _drawCorpseBody(ctx, simpleRender, allowFilter) {
            // 총맞음 혈흔 + 소품 드롭 (바닥 고정)
            if (!simpleRender) {
                this._drawBlood(ctx);
                this._drawDrops(ctx);
            }

            // 쓰러지는 회전: 총맞음은 반대 방향(뒤로 넘어짐)
            const fallDir = this.isGunshot ? -(this.hitDir || this.facing || 1) : (this.facing || 1);
            const fallAngle = (Math.PI / 2) * this.fallProgress * fallDir;
            ctx.rotate(fallAngle + (this.kbAngle || 0));

            const canFilter = ('filter' in ctx);
            const applyFilter = () => {
                if (canFilter && allowFilter) ctx.filter = 'brightness(0.55) saturate(0.6)';
            };

            if (simpleRender) {
                this.drawFallback(ctx);
                return;
            }
            else if (this._drawCivilianCorpse(ctx, applyFilter)) {
                // handled
            }
            else if (this._drawUnitRenderV2Corpse(ctx, applyFilter)) {
                // handled by Unit Render V2 (infantry family)
            }
            else if (INFANTRY_CORPSE_IDS.has(String(this.typeKey || '').trim())) {
                // Infantry-family corpses should not fallback to legacy renderer.
                this.drawFallback(ctx);
            }
            else if (this.skin && typeof IngameRenderer !== 'undefined' && IngameRenderer.drawUnitSkin) {
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
                applyFilter();
                ctx.translate(0, 0);
                IngameRenderer.drawUnitSkin(ctx, this.skin, dummyUnit, 0, 0);
                ctx.restore();
            } else if (typeof IngameRenderer !== 'undefined' && typeof IngameRenderer.draw === 'function') {
                const mode = (this.typeKey === 'drone_operator') ? (this.opState || 'rifle') : null;
                ctx.save();
                applyFilter();
                IngameRenderer.draw(ctx, this.typeKey, {
                    team: this.team,
                    facing: this.facing || 1,
                    rotorAngle: 0,
                    mode,
                    snapToGround: false
                });
                ctx.restore();
            } else {
                // 폴백: 간단한 사각형으로 표시
                ctx.save();
                applyFilter();
                this.drawFallback(ctx);
                ctx.restore();
            }
        }

        _drawBlood(ctx) {
            if (!this.isGunshot || this.bloodSpots.length === 0) return;
            if (this.fallProgress < 0.2) return;
            ctx.save();
            ctx.globalAlpha *= 0.8;
            for (const b of this.bloodSpots) {
                ctx.fillStyle = `rgba(185, 28, 28, ${b.alpha})`;
                ctx.beginPath();
                ctx.ellipse(b.x, b.y, b.r, b.r * 0.7, b.rot, 0, Math.PI * 2);
                ctx.fill();
            }
            ctx.restore();
        }

        _drawDrops(ctx) {
            if (!this.drops || this.drops.length === 0) return;
            for (const item of this.drops) {
                this._drawDropItem(ctx, item);
            }
        }

        _drawDropItem(ctx, item) {
            ctx.save();
            ctx.translate(item.x, item.y);
            if (Number.isFinite(item.rot)) ctx.rotate(item.rot);

            switch (item.kind) {
                case 'shovel':
                    ctx.fillStyle = '#854d0e';
                    ctx.fillRect(-1, -6, 2, 10);
                    ctx.fillStyle = '#94a3b8';
                    ctx.fillRect(-3, -8, 6, 4);
                    ctx.fillStyle = '#64748b';
                    ctx.fillRect(-3, -9, 6, 1);
                    break;
                case 'rifle':
                    ctx.fillStyle = '#0f172a';
                    ctx.fillRect(-8, -1, 16, 2);
                    ctx.fillStyle = '#1e293b';
                    ctx.fillRect(-1, -1, 3, 4);
                    ctx.fillRect(6, -2, 3, 2);
                    break;
                case 'helmet':
                    ctx.fillStyle = '#1e293b';
                    ctx.beginPath();
                    ctx.arc(0, -2, 3, Math.PI, 0);
                    ctx.fill();
                    ctx.fillRect(-3, -2, 6, 2);
                    break;
                case 'rpg':
                    ctx.fillStyle = '#4d7c0f';
                    ctx.fillRect(-10, -2, 20, 4);
                    ctx.fillStyle = '#111827';
                    ctx.fillRect(-12, -3, 3, 6);
                    ctx.fillStyle = '#ef4444';
                    ctx.fillRect(6, -1, 3, 2);
                    break;
                case 'rocket_cap':
                    ctx.fillStyle = '#ef4444';
                    ctx.fillRect(-2, -2, 4, 4);
                    break;
                case 'goggles':
                    ctx.fillStyle = '#334155';
                    ctx.fillRect(-4, -2, 8, 3);
                    ctx.fillStyle = '#64748b';
                    ctx.fillRect(-1, -2, 2, 3);
                    break;
                case 'silencer':
                    ctx.fillStyle = '#0f172a';
                    ctx.fillRect(-5, -1, 10, 2);
                    break;
                case 'laptop':
                    ctx.fillStyle = '#0f172a';
                    ctx.fillRect(-6, -2, 12, 2);
                    ctx.fillRect(-6, -8, 2, 6);
                    ctx.fillStyle = '#38bdf8';
                    ctx.fillRect(-5, -7, 1, 5);
                    break;
                default:
                    break;
            }

            ctx.restore();
        }

        _drawCivilianCorpse(ctx, applyFilter) {
            const id = this.typeKey;
            if (id !== 'civ_a' && id !== 'civ_b' && id !== 'civ_crowd') return false;

            ctx.save();
            applyFilter();

            if (id === 'civ_a') {
                const neutralGrey = '#94a3b8';
                const darkGrey = '#475569';
                ctx.fillStyle = neutralGrey;
                ctx.beginPath();
                if (ctx.roundRect) ctx.roundRect(-5, -15, 10, 15, 2);
                else ctx.rect(-5, -15, 10, 15);
                ctx.fill();
                ctx.fillStyle = '#e2e8f0';
                ctx.beginPath(); ctx.arc(0, -20, 5, 0, Math.PI * 2); ctx.fill();
                ctx.fillStyle = darkGrey;
                ctx.beginPath(); ctx.arc(0, -21, 5, Math.PI, 0); ctx.fill();
                ctx.restore();
                return true;
            }

            if (id === 'civ_b') {
                ctx.fillStyle = '#64748b';
                ctx.beginPath();
                if (ctx.roundRect) ctx.roundRect(-5, -15, 10, 15, 2);
                else ctx.rect(-5, -15, 10, 15);
                ctx.fill();
                ctx.strokeStyle = '#334155';
                ctx.lineWidth = 1.5;
                ctx.beginPath();
                ctx.moveTo(-5, -13); ctx.lineTo(5, -5);
                ctx.stroke();
                ctx.fillStyle = '#334155';
                ctx.fillRect(2, -7, 6, 5);
                ctx.fillStyle = '#cbd5e1';
                ctx.beginPath(); ctx.arc(0, -19, 5, 0, Math.PI * 2); ctx.fill();
                ctx.restore();
                return true;
            }

            if (id === 'civ_crowd') {
                const members = [
                    { x: -12, y: 5, scale: 0.9, color: '#94a3b8' },
                    { x: 12, y: 5, scale: 0.85, color: '#64748b' },
                    { x: 0, y: 5, scale: 1.0, color: '#475569' }
                ];
                members.forEach(m => {
                    ctx.save();
                    ctx.translate(m.x, m.y);
                    ctx.scale(m.scale, m.scale);
                    ctx.fillStyle = m.color;
                    ctx.fillRect(-5, -15, 10, 15);
                    ctx.fillStyle = '#e2e8f0';
                    ctx.beginPath(); ctx.arc(0, -19, 5, 0, Math.PI * 2); ctx.fill();
                    ctx.restore();
                });
                ctx.restore();
                return true;
            }

            ctx.restore();
            return false;
        }

        /**
         * 시체 렌더링
         */
        draw(ctx) {
            if (this.opacity <= 0) return;

            // 페이드 계산 (update 없이도 동작)
            if (typeof game !== 'undefined' && Number.isFinite(game.frame)) {
                const elapsed = game.frame - this.deadAt;
                const remaining = this.fadeTimer - Math.max(0, elapsed);
                if (remaining <= 0) {
                    this.opacity = 0;
                    return;
                }
                this.opacity = remaining < 60 ? Math.max(0, remaining / 60) : 1;
            }

            const debug = (typeof game !== 'undefined') ? game.debug : null;
            const corpseCount = (typeof game !== 'undefined' && Array.isArray(game.corpses)) ? game.corpses.length : 0;
            const threshold = (debug && Number.isFinite(debug.corpseSimpleRenderThreshold)) ? debug.corpseSimpleRenderThreshold : 30;
            const isAnimating = !this.fallen || this.knockbackFrame < this.knockbackFrames;
            const simpleRender = isAnimating || corpseCount >= threshold;

            const allowFilter = !simpleRender && !(debug && debug.corpseNoFilter);
            const canCache = !simpleRender && this.fallen && this.knockbackFrame >= this.knockbackFrames;
            if (canCache) {
                const key = this._getCacheKey(debug);
                if (this._cacheKey !== key) {
                    this._cacheKey = key;
                    this._cacheReady = false;
                }
                if (!this._cacheReady && this._canBuildCacheThisFrame(debug)) {
                    this._buildCache(allowFilter);
                }
                if (this._cacheReady && this._cacheCanvas) {
                    const cvs = this._cacheCanvas;
                    ctx.save();
                    ctx.globalAlpha = this.opacity;
                    ctx.drawImage(cvs, this.x - cvs.width / 2, this.y - cvs.height / 2);
                    ctx.restore();
                    return;
                }
                // 캐시 빌드 대기 중에는 단순 폴백으로 드로우 부하를 낮춘다.
                ctx.save();
                ctx.globalAlpha = this.opacity;
                ctx.translate(this.x, this.y);
                this._drawCorpseBody(ctx, true, false);
                ctx.restore();
                return;
            }

            ctx.save();
            ctx.globalAlpha = this.opacity;
            ctx.translate(this.x, this.y);
            this._drawCorpseBody(ctx, simpleRender, allowFilter);
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

    Corpse._cacheBuildFrame = -1;
    Corpse._cacheBuildCount = 0;

    // 전역 노출
    window.Corpse = Corpse;
})();
