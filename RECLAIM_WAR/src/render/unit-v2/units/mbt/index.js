// Unit Render V2 entry for: mbt
// [MBT 고정 요구사항]
// 1) 플레이어 조종 시 포탑 조준 각도 제한 구현
// 2) 포탑 조준 상한은 -45도 기준
// 3) 좌/우 방향 모두 공격 가능하도록 포탑 발사 로직 지원
// 4) 신규 포구 화염/연기/탄착 폭발 이펙트 적용
// 5) 발사 -> 비행 -> 충돌 -> 폭발 파이프라인 누락 없이 연결
//
// 위 요구사항은 mbt 전용이며, 다른 유닛 폴더에 강제 적용하지 않는다.
(function attachUnitRenderV2_mbt(globalScope) {
    'use strict';

    var BATTLE_MODEL_SCALE = 0.76;
    var BATTLE_BASE_DRAW_SCALE = 1.4 * 1.16;
    var BATTLE_WORLD_SCALE = BATTLE_BASE_DRAW_SCALE * BATTLE_MODEL_SCALE;
    var MANUAL_AIM_STALE_FRAMES = 45;

    function getDeps() {
        return {
            stateApi: globalScope.UnitRenderV2State_mbt,
            weaponApi: globalScope.UnitRenderV2Weapons_mbt,
            bodyApi: globalScope.UnitRenderV2Body_mbt,
            partsApi: globalScope.UnitRenderV2Parts_mbt,
            fxApi: globalScope.UnitRenderV2Fx_mbt
        };
    }

    function resolvePalette(unit, options) {
        var team = String(options && options.team ? options.team : (unit && unit.team ? unit.team : 'player')).trim();

        if (team === 'enemy') {
            return {
                main: '#8a795b',
                dark: '#6e5f46',
                shadow: '#4a3e2f',
                track: '#1f1d1a',
                wheelOuter: '#151515',
                wheelInner: '#675941',
                hub: '#222',
                sprocket: '#352c23',
                accent: '#5a4630',
                accent2: '#3f3021',
                enemyPattern: false
            };
        }
        if (team !== 'player') return null;

        return {
            main: '#4E5B31',
            dark: '#3D4825',
            shadow: '#2C3519',
            track: '#222',
            wheelOuter: '#151515',
            wheelInner: '#3D4825',
            hub: '#222',
            sprocket: '#333',
            accent: '#3f2f1d',
            accent2: '#2a2014',
            enemyPattern: false
        };
    }

    function drawModel(unit, ctx, state, options) {
        if (!ctx) return false;
        var deps = getDeps();
        if (!deps.bodyApi || !deps.partsApi || !deps.fxApi || !deps.weaponApi) return false;

        var palette = resolvePalette(unit, options || {});
        if (!palette) return false;

        var opts = options || {};
        var iconMode = opts.iconMode === true;
        var iconScale = Number(opts.iconScale);
        var modelScale = Number(opts.modelScale);
        var facing = Number(opts.facing);
        if (!Number.isFinite(facing) || facing === 0) facing = Number(state && state.facing) || 1;

        ctx.save();
        if (facing < 0) ctx.scale(-1, 1);
        if (Number.isFinite(modelScale) && modelScale > 0 && modelScale !== 1) {
            if (!iconMode) {
                // Keep track-bottom anchored to the same ground line after model scale changes.
                var groundPivotY = 15;
                ctx.translate(0, groundPivotY);
                ctx.scale(modelScale, modelScale);
                ctx.translate(0, -groundPivotY);
            } else {
                ctx.scale(modelScale, modelScale);
            }
        }
        if (Number.isFinite(iconScale) && iconScale > 0 && iconScale !== 1) {
            ctx.scale(iconScale, iconScale);
        }

        deps.partsApi.drawTracksAndWheels(ctx, state, palette);
        deps.bodyApi.drawBody(unit, ctx, palette);
        deps.partsApi.drawTurret(ctx, state, palette, opts);

        if (iconMode) {
            deps.fxApi.drawEngineHeat(ctx, { alpha: 0.16 });
        }

        var muzzle = deps.weaponApi.computeMuzzleLocal(state, { barrelLength: 70 });
        if (!iconMode && Number(state && state.mainFlash) > 0.05) {
            deps.fxApi.drawMainMuzzleFlash(ctx, {
                x: 5 + muzzle.x,
                y: -30 + muzzle.y,
                angle: muzzle.angle,
                alpha: state.mainFlash
            });
        }

        ctx.restore();
        return true;
    }

    function draw(unit, ctx, env) {
        if (!unit || !ctx || !unit.stats || String(unit.stats.id || '') !== 'mbt') return false;
        var deps = getDeps();
        if (!deps.stateApi) return false;

        var state = deps.stateApi.getState(unit);
        if (!state) return false;

        deps.stateApi.updateRuntimeState(unit, state);

        // 공격 타겟 기준 포탑 조준(없으면 전방 기본값 유지)
        if (deps.weaponApi && typeof deps.weaponApi.computeAimAngleFromPoint === 'function') {
            var tx = null;
            var ty = null;
            var manualX = Number(unit.manualAimX);
            var manualY = Number(unit.manualAimY);
            var manualFrame = Number(unit.manualAimFrame);
            var gameRef = (globalScope && globalScope.game) ? globalScope.game : null;
            var frameNow = (gameRef && Number.isFinite(gameRef.frame)) ? gameRef.frame : NaN;
            var hasManualAim = unit.isSelected === true
                && Number.isFinite(manualX)
                && Number.isFinite(manualY)
                && (!Number.isFinite(frameNow) || !Number.isFinite(manualFrame) || (frameNow - manualFrame) <= MANUAL_AIM_STALE_FRAMES);

            if (hasManualAim) {
                tx = manualX;
                ty = manualY;
            } else {
                var target = unit.attackTarget;
                if (target && !target.dead) {
                    tx = Number(target.x);
                    ty = Number(target.y) - (Number(target.height) || 0) * 0.35;
                }
            }
            if (Number.isFinite(tx) && Number.isFinite(ty)) {
                var next = deps.weaponApi.computeAimAngleFromPoint(unit, tx, ty);
                var diff = next - state.turretAngle;
                while (diff < -Math.PI) diff += Math.PI * 2;
                while (diff > Math.PI) diff -= Math.PI * 2;
                state.turretAngle += diff * 0.12;
            }
            state.turretAngle = deps.weaponApi.clampTurretAngle(state.turretAngle);
        }

        return drawModel(unit, ctx, state, {
            team: unit.team,
            iconMode: false,
            facing: state.facing,
            modelScale: BATTLE_MODEL_SCALE
        });
    }

    // 아이콘/프로필 캔버스용 정적 렌더 (아군 전용)
    function drawIcon(ctx, options) {
        if (!ctx) return false;
        var deps = getDeps();
        if (!deps.stateApi || !deps.weaponApi) return false;

        var state = {
            turretAngle: -0.12,
            trackOffset: 4.2,
            recoil: 0,
            mgFlash: 0,
            mainFlash: 0,
            facing: 1
        };
        deps.stateApi.setIconState(state, options || {});
        state.turretAngle = deps.weaponApi.clampTurretAngle(state.turretAngle);

        return drawModel({ team: 'player', stats: { id: 'mbt' } }, ctx, state, {
            team: 'player',
            iconMode: true,
            iconScale: Number(options && options.iconScale)
        });
    }

    var api = {
        draw: draw,
        drawIcon: drawIcon,
        getBattleWorldScale: function getBattleWorldScale() {
            return BATTLE_WORLD_SCALE;
        }
    };

    // Per-unit direct API (for inventory/drillground icon rendering)
    globalScope.UnitRenderV2MBT = api;

    var registry = (globalScope.UnitRenderV2Registry && typeof globalScope.UnitRenderV2Registry === 'object')
        ? globalScope.UnitRenderV2Registry
        : null;
    if (registry) {
        registry.mbt = api;
    }
})(typeof window !== 'undefined' ? window : globalThis);
