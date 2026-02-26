// [FILE] unit_commands.js: ?? ??/???/?? ??? ?? ?? ?? ??.
/**
 * unit_commands.js - R 2.4 유닛 명령 패널/다중 선택/드래그 선택
 */

(function () {
    'use strict';

    const resolveGameApi = () => (typeof game !== 'undefined' && game)
        ? game
        : ((typeof window !== 'undefined' && window.game) ? window.game : null);
    const withGameApi = (label, installer) => {
        const runInstall = () => {
            const api = resolveGameApi();
            if (!api) return false;
            if (api[`__${label}Installed__`] === true) return true;
            installer(api);
            api[`__${label}Installed__`] = true;
            return true;
        };
        if (runInstall()) return;
        console.warn(`[${label}] game unavailable; waiting for late init.`);
        let retries = 0;
        const timer = setInterval(() => {
            retries += 1;
            if (runInstall() || retries >= 120) clearInterval(timer);
        }, 50);
        if (typeof window !== 'undefined') {
            window.addEventListener('reclaim:game-ready', () => {
                if (runInstall()) clearInterval(timer);
            }, { once: true });
        }
    };

    withGameApi('UnitCommands', (game) => {

    // ============================================
    // A) ?곹깭 蹂??珥덇린??(?ㅼ쨷 ?좏깮)
    // ============================================
    game.selectedUnits = new Set();

    // ============================================
    // A-2) Direct Control runtime (combat units only)
    //  - Toggle with E key / HUD interact command
    //  - Eligible: armored + infantry + combat aircraft
    //  - Transport heli keeps DROP/transport interaction flow
    // ============================================
    const DIRECT_CONTROL_ELIGIBLE_IDS = new Set([
        'mbt', 'spg', 'aa_tank', 'apache',
        'infantry', 'engineer', 'special_ops', 'sniper', 'rpg', 'drone_operator',
        'fighter', 'bomber', 'recon'
    ]);
    const DIRECT_CONTROL_INFANTRY_IDS = new Set([
        'infantry', 'engineer', 'special_ops', 'sniper', 'rpg', 'drone_operator', 'recon'
    ]);
    const DIRECT_CONTROL_BLOCKED_IDS = new Set(['icbm', 'icbm_enemy', 'cameraman', 'worker']);
    const DIRECT_CONTROL_TRANSPORT_IDS = new Set(['blackhawk', 'uh60', 'chinook']);
    const DIRECT_CONTROL_AIM_LOCK_RADIUS = 220;
    const DIRECT_CONTROL_MANUAL_AIM_STALE_FRAMES = 36;

    function ensureDirectControlState() {
        if (!game.directControl || typeof game.directControl !== 'object') {
            game.directControl = {};
        }
        const state = game.directControl;
        if (typeof state.active !== 'boolean') state.active = false;
        if (!Object.prototype.hasOwnProperty.call(state, 'unit')) state.unit = null;
        if (!Object.prototype.hasOwnProperty.call(state, 'cancelSuppressedUnit')) state.cancelSuppressedUnit = null;
        if (!state.keys || typeof state.keys !== 'object') state.keys = {};
        if (state.weaponMode !== 'sub') state.weaponMode = 'main';

        const keys = state.keys;
        if (typeof keys.w !== 'boolean') keys.w = false;
        if (typeof keys.a !== 'boolean') keys.a = false;
        if (typeof keys.s !== 'boolean') keys.s = false;
        if (typeof keys.d !== 'boolean') keys.d = false;
        if (typeof keys.r !== 'boolean') keys.r = false;
        if (typeof keys.f !== 'boolean') keys.f = false;
        if (typeof keys.arrowLeft !== 'boolean') keys.arrowLeft = false;
        if (typeof keys.arrowRight !== 'boolean') keys.arrowRight = false;
        if (typeof keys.arrowUp !== 'boolean') keys.arrowUp = false;
        if (typeof keys.arrowDown !== 'boolean') keys.arrowDown = false;
        if (typeof keys.shift !== 'boolean') keys.shift = false;
        return state;
    }

    function clearDirectControlKeys() {
        const state = ensureDirectControlState();
        const keys = state.keys;
        keys.w = false;
        keys.a = false;
        keys.s = false;
        keys.d = false;
        keys.r = false;
        keys.f = false;
        keys.arrowLeft = false;
        keys.arrowRight = false;
        keys.arrowUp = false;
        keys.arrowDown = false;
        keys.shift = false;
    }

    function isDirectControlEligibleUnit(unit) {
        if (!unit || unit.dead || !unit.stats) return false;
        if (unit.team !== 'player') return false;
        const id = String(unit.stats.id || '');
        if (DIRECT_CONTROL_BLOCKED_IDS.has(id)) return false;
        if (DIRECT_CONTROL_TRANSPORT_IDS.has(id)) return false;
        if (unit.isCameraman || unit.stats.isCameraman || unit.stats.civilian) return false;

        if (DIRECT_CONTROL_ELIGIBLE_IDS.has(id)) return true;

        const category = String(unit.stats.category || '').trim().toLowerCase();
        const unitType = String(unit.stats.type || '').trim().toLowerCase();
        if (category === 'civilian') return false;
        if (unitType === 'air') return true;
        if (category === 'infantry' || category === 'armored' || category === 'special' || category === 'drone') return true;

        const speed = Number(unit.stats.speed);
        const range = Number(unit.stats.range);
        const damage = Number(unit.stats.damage);
        return (
            (Number.isFinite(speed) && speed > 0)
            || (Number.isFinite(range) && range > 0)
            || (Number.isFinite(damage) && damage > 0)
        );
    }

    function getSelectedDirectControlCandidate() {
        if (!game.selectedUnits || game.selectedUnits.size !== 1) return null;
        const it = game.selectedUnits.values().next();
        const unit = (it && !it.done) ? it.value : null;
        return isDirectControlEligibleUnit(unit) ? unit : null;
    }

    function syncDirectControlSelection(unit) {
        if (!unit || unit.dead || !game.selectedUnits) return;
        let changed = false;
        game.selectedUnits.forEach((u) => {
            if (u !== unit && u && !u.dead && u.isSelected) {
                u.isSelected = false;
                changed = true;
            }
        });
        if (game.selectedUnits.size !== 1 || !game.selectedUnits.has(unit)) {
            game.selectedUnits.clear();
            game.selectedUnits.add(unit);
            changed = true;
        }
        unit.isSelected = true;
        if (game.selectedBuilding) {
            game.selectedBuilding = null;
            changed = true;
        }
        if (changed && typeof app !== 'undefined' && app && typeof app.markUiDirty === 'function') {
            app.markUiDirty();
        }
    }

    function getDirectControlEnemyPools(unit) {
        if (!unit || unit.team !== 'player') {
            return { enemies: [], enemyBuildings: [] };
        }
        const enemies = Array.isArray(game.enemies) ? game.enemies : [];
        const enemyBuildings = Array.isArray(game.enemyBuildings)
            ? game.enemyBuildings
            : (Array.isArray(game.buildings) ? game.buildings.filter((b) => b && b.team === 'enemy') : []);
        return { enemies, enemyBuildings };
    }

    function getDirectControlActiveRange(unit) {
        if (!unit || !unit.stats) return 0;
        const id = String((unit.stats && unit.stats.id) || '');
        const unitRange = Number(unit.getEffectiveRange ? unit.getEffectiveRange() : (unit.stats && unit.stats.range)) || 0;
        const missileRange = Number(unit.getEffectiveMissileRange ? unit.getEffectiveMissileRange() : unitRange) || unitRange;
        const usesExtendedMissileRange = (id === 'apc' || id === 'engineer' || id === 'rpg');
        return usesExtendedMissileRange ? Math.max(unitRange, missileRange) : unitRange;
    }

    function canUnitEngageAir(unit, target = null) {
        if (!unit || !unit.stats) return false;
        if (typeof unit.canEngageAirTarget === 'function') {
            try { return !!unit.canEngageAirTarget(target); } catch (_) { }
        }

        const id = String(unit.stats.id || '').trim().toLowerCase();
        const category = String(unit.stats.category || '').trim().toLowerCase();
        const unitType = String(unit.stats.type || '').trim().toLowerCase();

        if (unitType === 'air' || category === 'air') return true;
        if (id === 'aa_tank' || id === 'turret') return true;
        if (id === 'humvee' || id === 'apc') return true;
        if (id === 'rpg' || id === 'engineer') return true;
        if (category === 'infantry') return false;
        return !!unit.stats.antiAir;
    }

    function isDirectControlTargetInRange(unit, target, maxRange) {
        if (!unit || !target || target.dead) return false;
        const tx = Number(target.x);
        const ux = Number(unit.x);
        if (!Number.isFinite(tx) || !Number.isFinite(ux)) return false;
        return Math.abs(tx - ux) <= Math.max(140, Number(maxRange) || 0);
    }

    function resolveDirectControlAutoTarget(unit, aim = null) {
        if (!unit || unit.dead || typeof unit.findNearestEnemy !== 'function') return null;
        const pools = getDirectControlEnemyPools(unit);
        const activeRange = getDirectControlActiveRange(unit);
        const maxRange = Math.max(140, activeRange);
        const restrictRear = (typeof unit.shouldRestrictRearTargeting === 'function')
            ? unit.shouldRestrictRearTargeting()
            : (String((unit.stats && unit.stats.id) || '') !== 'aa_tank');
        const aimX = Number(aim && aim.x);
        const aimY = Number(aim && aim.y);
        const hasAim = Number.isFinite(aimX) && Number.isFinite(aimY);

        if (hasAim) {
            let bestTarget = null;
            let bestAimDist = Infinity;
            const candidates = []
                .concat(Array.isArray(pools.enemies) ? pools.enemies : [])
                .concat(Array.isArray(pools.enemyBuildings) ? pools.enemyBuildings : []);
            for (let i = 0; i < candidates.length; i += 1) {
                const candidate = candidates[i];
                if (!candidate || candidate.dead) continue;
                const candidateIsAir = !!(candidate.stats && candidate.stats.type === 'air');
                if (candidateIsAir && !canUnitEngageAir(unit, candidate)) continue;
                if (!isDirectControlTargetInRange(unit, candidate, maxRange)) continue;
                if (restrictRear && typeof unit.isTargetBehindX === 'function' && unit.isTargetBehindX(candidate.x, 20)) continue;

                const tx = Number(candidate.x);
                let ty = Number(candidate.y);
                if (!Number.isFinite(ty)) ty = Number(unit.y);
                const height = Number(candidate.height);
                if (Number.isFinite(height)) ty -= (height * 0.35);

                const dx = tx - aimX;
                const dy = ty - aimY;
                const dist = Math.hypot(dx, dy);
                if (!Number.isFinite(dist) || dist > DIRECT_CONTROL_AIM_LOCK_RADIUS) continue;

                if (dist < bestAimDist) {
                    bestAimDist = dist;
                    bestTarget = candidate;
                }
            }
            if (bestTarget) return bestTarget;
        }

        const target = unit.findNearestEnemy(pools.enemies, pools.enemyBuildings);
        if (!target || target.dead) return null;
        const targetIsAir = !!(target.stats && target.stats.type === 'air');
        if (targetIsAir && !canUnitEngageAir(unit, target)) return null;
        if (!isDirectControlTargetInRange(unit, target, maxRange)) return null;
        if (restrictRear && typeof unit.isTargetBehindX === 'function' && unit.isTargetBehindX(target.x, 20)) return null;
        return target;
    }

    function clearDirectControlManualAim(unit) {
        if (!unit || typeof unit !== 'object') return;
        unit.manualAimX = null;
        unit.manualAimY = null;
        unit.manualAimFrame = -1;
    }

    function getFreshDirectControlManualAim(unit, frameNow = NaN) {
        if (!unit || unit.dead) return null;
        const mx = Number(unit.manualAimX);
        const my = Number(unit.manualAimY);
        if (!Number.isFinite(mx) || !Number.isFinite(my)) return null;

        const now = Number.isFinite(frameNow)
            ? Number(frameNow)
            : Number(game && game.frame);
        if (Number.isFinite(now)) {
            const aimFrame = Number(unit.manualAimFrame);
            if (!Number.isFinite(aimFrame)) return null;
            if ((now - aimFrame) > DIRECT_CONTROL_MANUAL_AIM_STALE_FRAMES) return null;
        }
        return { x: mx, y: my };
    }

    function resolveDirectControlAim(unit) {
        if (!unit || unit.dead) return null;

        const manualAim = getFreshDirectControlManualAim(unit);
        if (manualAim) return manualAim;

        const target = resolveDirectControlAutoTarget(unit);
        if (target && Number.isFinite(Number(target.x))) {
            const targetY = Number(target.y) - ((Number(target.height) || 0) * 0.35);
            return {
                x: Number(target.x),
                y: Number.isFinite(targetY) ? targetY : Number(unit.y)
            };
        }

        const facingRaw = Number(unit.facing);
        const facing = Number.isFinite(facingRaw) && facingRaw < 0 ? -1 : 1;
        const id = String((unit.stats && unit.stats.id) || '');
        const baseDist = (id === 'spg') ? 900 : (id === 'mbt' ? 700 : 520);
        return {
            x: Number(unit.x) + (facing * baseDist),
            y: Number(unit.y) - ((Number(unit.height) || 0) * 0.55)
        };
    }

    function buildDirectControlBlindFireTarget(unit, aim) {
        const tx = Number(aim && aim.x);
        const ty = Number(aim && aim.y);
        if (!Number.isFinite(tx) || !Number.isFinite(ty)) return null;

        const onlyAir = !!(unit && unit.stats && unit.stats.onlyAir);
        const targetTeam = (unit && unit.team === 'player') ? 'enemy' : 'player';
        return {
            __directControlBlind: true,
            x: tx,
            y: ty,
            width: onlyAir ? 26 : 20,
            height: onlyAir ? 20 : 28,
            team: targetTeam,
            dead: true,
            stats: {
                id: 'direct_control_dummy',
                type: onlyAir ? 'air' : 'mech',
                category: onlyAir ? 'air' : 'armored',
                invulnerable: false
            },
            takeDamage: () => { }
        };
    }

    function unitHasDirectSubWeapon(unit) {
        const id = String((unit && unit.stats && unit.stats.id) || '');
        return id === 'mbt';
    }

    function isDirectControlInfantryUnit(unit) {
        if (!unit || unit.dead || !unit.stats) return false;
        const id = String(unit.stats.id || '').trim();
        const category = String(unit.stats.category || '').trim().toLowerCase();
        return DIRECT_CONTROL_INFANTRY_IDS.has(id) || category === 'infantry';
    }

    function getDirectControlWeaponMode(unit = null) {
        const state = ensureDirectControlState();
        const activeUnit = unit || ((typeof game.getDirectControlUnit === 'function') ? game.getDirectControlUnit() : null);
        if (!activeUnit || activeUnit.dead || !unitHasDirectSubWeapon(activeUnit)) return 'main';
        return (state.weaponMode === 'sub') ? 'sub' : 'main';
    }

    function setDirectControlWeaponMode(mode) {
        const state = ensureDirectControlState();
        const unit = (typeof game.getDirectControlUnit === 'function') ? game.getDirectControlUnit() : null;
        if (!unit || unit.dead || !unitHasDirectSubWeapon(unit)) {
            state.weaponMode = 'main';
            return false;
        }

        const nextMode = (mode === 'sub') ? 'sub' : 'main';
        state.weaponMode = nextMode;

        if (nextMode !== 'sub') {
            unit.manualMgHeld = false;
            if (typeof unit.stopManualTankMG === 'function') {
                unit.stopManualTankMG(true);
            } else if (typeof unit._stopTankMGSound === 'function') {
                unit._stopTankMGSound();
            }
        }
        return true;
    }

    function getDirectControlWeaponToggleInfo() {
        const unit = (typeof game.getDirectControlUnit === 'function') ? game.getDirectControlUnit() : null;
        if (!unit || unit.dead || !unitHasDirectSubWeapon(unit)) {
            return {
                enabled: false,
                currentMode: 'main',
                nextMode: 'main',
                currentLabel: '포탑',
                nextLabel: '포탑'
            };
        }
        const currentMode = getDirectControlWeaponMode(unit);
        const nextMode = (currentMode === 'sub') ? 'main' : 'sub';
        const currentLabel = (currentMode === 'sub') ? '기관총' : '포탑';
        const nextLabel = (nextMode === 'sub') ? '기관총' : '포탑';
        return {
            enabled: true,
            currentMode,
            nextMode,
            currentLabel,
            nextLabel
        };
    }

    function getDirectControlInfantryStanceInfo() {
        const unit = (typeof game.getDirectControlUnit === 'function') ? game.getDirectControlUnit() : null;
        if (!unit || unit.dead || !isDirectControlInfantryUnit(unit)) {
            return {
                enabled: false,
                current: 'standing',
                next: 'crouching',
                currentLabel: '서서쏴',
                nextLabel: '앉아쏴',
                active: false
            };
        }
        const raw = String(unit._forcedInfantryStance || '').trim().toLowerCase();
        const current = (raw === 'crouching') ? 'crouching' : 'standing';
        const next = (current === 'crouching') ? 'standing' : 'crouching';
        const currentLabel = (current === 'crouching') ? '앉아쏴' : '서서쏴';
        const nextLabel = (next === 'crouching') ? '앉아쏴' : '서서쏴';
        return {
            enabled: true,
            current,
            next,
            currentLabel,
            nextLabel,
            active: current === 'crouching'
        };
    }

    function toggleDirectControlInfantryStance() {
        const info = getDirectControlInfantryStanceInfo();
        if (!info.enabled) return false;
        const unit = (typeof game.getDirectControlUnit === 'function') ? game.getDirectControlUnit() : null;
        if (!unit || unit.dead) return false;
        unit._forcedInfantryStance = info.next;
        unit._dcReleaseHold = true;

        if (typeof ui !== 'undefined' && ui && typeof ui.showToast === 'function') {
            ui.showToast(`자세 전환: ${info.nextLabel}`);
        }
        if (typeof game.updateHUDSelection === 'function') game.updateHUDSelection();
        if (typeof app !== 'undefined' && app && typeof app.markUiDirty === 'function') app.markUiDirty();
        if (typeof window !== 'undefined'
            && window.MobileDirectControlUI
            && typeof window.MobileDirectControlUI.refresh === 'function') {
            window.MobileDirectControlUI.refresh();
        }
        return true;
    }

    function normalizeInfantryStance(value) {
        const raw = String(value || '').trim().toLowerCase();
        if (raw === 'standing' || raw === 'crouching' || raw === 'prone') return raw;
        return '';
    }

    function getCurrentInfantryRenderStance(unit) {
        if (!unit || !unit._renderV2State || typeof unit._renderV2State !== 'object') return '';
        const stateStore = unit._renderV2State;
        const keys = ['infantry', 'sniper', 'special_ops', 'engineer', 'drone_operator'];
        for (let i = 0; i < keys.length; i++) {
            const st = stateStore[keys[i]];
            const stance = normalizeInfantryStance(st && st.stance);
            if (stance) return stance;
        }
        for (const k in stateStore) {
            if (!Object.prototype.hasOwnProperty.call(stateStore, k)) continue;
            const st = stateStore[k];
            const stance = normalizeInfantryStance(st && st.stance);
            if (stance) return stance;
        }
        return '';
    }

    function hasDirectControlReleaseHold(unit) {
        return !!(unit && unit._dcReleaseHold === true);
    }

    function setDirectControlReleaseHold(unit, enabled = true) {
        if (!unit || typeof unit !== 'object') return false;
        unit._dcReleaseHold = !!enabled;
        return true;
    }

    function clearAllDirectControlReleaseHold() {
        const list = (game && Array.isArray(game.players)) ? game.players : [];
        let changed = false;
        for (let i = 0; i < list.length; i++) {
            const u = list[i];
            if (!u || u.dead || u.team !== 'player') continue;
            if (u._dcReleaseHold === true) changed = true;
            u._dcReleaseHold = false;
        }
        return changed;
    }

    function setDirectControlCameraFollow(unit, enabled = true) {
        if (!game) return false;
        if (!enabled) {
            game.cameraLockActive = false;
            game.cameraLockTarget = null;
            return true;
        }
        if (!unit || unit.dead) return false;
        game.cameraLockActive = true;
        game.cameraLockTarget = unit;
        return true;
    }

    function toggleDirectControlWeaponMode() {
        const info = getDirectControlWeaponToggleInfo();
        if (!info.enabled) return false;
        const ok = setDirectControlWeaponMode(info.nextMode);
        if (!ok) return false;

        if (typeof ui !== 'undefined' && ui && typeof ui.showToast === 'function') {
            ui.showToast(`무기 전환: ${info.nextLabel}`);
        }
        if (typeof game.updateHUDSelection === 'function') game.updateHUDSelection();
        if (typeof window !== 'undefined'
            && window.MobileDirectControlUI
            && typeof window.MobileDirectControlUI.refresh === 'function') {
            window.MobileDirectControlUI.refresh();
        }
        return true;
    }

    function fireDirectControlAuto(unit, opts = null) {
        if (!unit || unit.dead) return false;
        const id = String((unit.stats && unit.stats.id) || '');
        const frameNow = Number.isFinite(game.frame) ? game.frame : 0;
        let aim = getFreshDirectControlManualAim(unit, frameNow);
        if (!aim) {
            aim = resolveDirectControlAim(unit);
            if (aim && Number.isFinite(aim.x) && Number.isFinite(aim.y)) {
                unit.manualAimX = aim.x;
                unit.manualAimY = aim.y;
                if (Number.isFinite(game.frame)) unit.manualAimFrame = game.frame;
            }
        }

        let target = resolveDirectControlAutoTarget(unit, aim);
        const usedBlindTarget = !target;
        if (!target) {
            target = buildDirectControlBlindFireTarget(unit, aim);
        }
        if (!target) return false;

        const channel = (opts && opts.channel === 'sub') ? 'sub' : 'main';
        const key = (channel === 'sub') ? '_mobileDirectSubLastFireFrame' : '_mobileDirectMainLastFireFrame';
        const defaultRate = (id === 'aa_tank') ? 10 : (id === 'apache' ? 18 : 24);
        const rate = Math.max(4, Math.floor(Number(opts && opts.rate) || defaultRate));
        const lastFrame = Number(unit[key]);
        if (Number.isFinite(lastFrame) && (frameNow - lastFrame) < rate) return false;

        try {
            unit.attack(target);
            unit.lastAttack = frameNow;
            unit[key] = frameNow;
            unit.attackTarget = usedBlindTarget ? null : target;
            return true;
        } catch (_) {
            return false;
        }
    }

    function getDirectControlMobileProfile(unit) {
        const id = String((unit && unit.stats && unit.stats.id) || '');
        if (id === 'mbt') {
            return {
                mainLabel: '주포',
                subLabel: '기관총',
                hasSub: true,
                subHold: true,
                mainRate: 120,
                subRate: 3
            };
        }
        if (id === 'spg') {
            return {
                mainLabel: '포격',
                subLabel: '보조',
                hasSub: false,
                subHold: false,
                mainRate: 420,
                subRate: 0
            };
        }
        if (id === 'aa_tank') {
            return {
                mainLabel: '기관포',
                subLabel: '속사',
                hasSub: true,
                subHold: false,
                mainRate: 10,
                subRate: 6
            };
        }
        if (id === 'apache') {
            return {
                mainLabel: '로켓',
                subLabel: '보조',
                hasSub: false,
                subHold: false,
                mainRate: 18,
                subRate: 0
            };
        }
        return {
            mainLabel: '발사',
            subLabel: '보조',
            hasSub: false,
            subHold: false,
            mainRate: 24,
            subRate: 0
        };
    }

    function mobileDirectMainFire() {
        const unit = (typeof game.getDirectControlUnit === 'function') ? game.getDirectControlUnit() : null;
        if (!isDirectControlEligibleUnit(unit)) return false;

        const id = String((unit.stats && unit.stats.id) || '');
        const aim = resolveDirectControlAim(unit);
        if (aim && Number.isFinite(aim.x) && Number.isFinite(aim.y)) {
            unit.manualAimX = aim.x;
            unit.manualAimY = aim.y;
            if (Number.isFinite(game.frame)) unit.manualAimFrame = game.frame;
        }

        if (id === 'mbt' && typeof unit.tryManualTankMainFire === 'function') {
            return !!unit.tryManualTankMainFire(aim && aim.x, aim && aim.y);
        }
        if (id === 'spg' && typeof unit.tryManualSpgMainFire === 'function') {
            return !!unit.tryManualSpgMainFire(aim && aim.x, aim && aim.y);
        }

        const profile = getDirectControlMobileProfile(unit);
        return fireDirectControlAuto(unit, { channel: 'main', rate: profile.mainRate });
    }

    function mobileDirectSubFireStart() {
        const unit = (typeof game.getDirectControlUnit === 'function') ? game.getDirectControlUnit() : null;
        if (!isDirectControlEligibleUnit(unit)) return false;

        const id = String((unit.stats && unit.stats.id) || '');
        const profile = getDirectControlMobileProfile(unit);
        if (!profile.hasSub) return false;

        if (id === 'mbt') {
            const aim = resolveDirectControlAim(unit);
            if (aim && Number.isFinite(aim.x) && Number.isFinite(aim.y)) {
                unit.manualAimX = aim.x;
                unit.manualAimY = aim.y;
                if (Number.isFinite(game.frame)) unit.manualAimFrame = game.frame;
            }
            unit.manualMgHeld = true;
            if (typeof unit.tryManualTankMGFire === 'function') {
                return !!unit.tryManualTankMGFire(aim && aim.x, aim && aim.y);
            }
            return true;
        }

        return fireDirectControlAuto(unit, { channel: 'sub', rate: profile.subRate });
    }

    function mobileDirectSubFireStop() {
        const unit = (typeof game.getDirectControlUnit === 'function') ? game.getDirectControlUnit() : null;
        if (!unit || unit.dead || !unit.stats) return false;
        if (String(unit.stats.id || '') !== 'mbt') return false;

        unit.manualMgHeld = false;
        if (typeof unit.stopManualTankMG === 'function') {
            unit.stopManualTankMG(true);
        } else if (typeof unit._stopTankMGSound === 'function') {
            unit._stopTankMGSound();
        }
        return true;
    }

    function directControlFireCurrentWeapon() {
        const unit = (typeof game.getDirectControlUnit === 'function') ? game.getDirectControlUnit() : null;
        if (!isDirectControlEligibleUnit(unit)) return false;

        const mode = getDirectControlWeaponMode(unit);
        if (mode !== 'sub') {
            return mobileDirectMainFire();
        }

        const id = String((unit.stats && unit.stats.id) || '');
        if (id !== 'mbt') {
            return mobileDirectSubFireStart();
        }

        const aim = resolveDirectControlAim(unit);
        if (aim && Number.isFinite(aim.x) && Number.isFinite(aim.y)) {
            unit.manualAimX = aim.x;
            unit.manualAimY = aim.y;
            if (Number.isFinite(game.frame)) unit.manualAimFrame = game.frame;
        }

        unit.manualMgHeld = true;
        let fired = false;
        if (typeof unit.tryManualTankMGFire === 'function') {
            fired = !!unit.tryManualTankMGFire(aim && aim.x, aim && aim.y);
        }

        const releaseOnce = () => {
            if (!unit || unit.dead) return;
            unit.manualMgHeld = false;
            if (typeof unit.stopManualTankMG === 'function') {
                unit.stopManualTankMG(false);
            } else if (typeof unit._stopTankMGSound === 'function') {
                unit._stopTankMGSound();
            }
        };

        if (typeof window !== 'undefined' && typeof window.setTimeout === 'function') {
            window.setTimeout(releaseOnce, 120);
        } else {
            releaseOnce();
        }

        return fired;
    }

    function startDirectControl(unit) {
        const state = ensureDirectControlState();
        if ((game.buildMode && game.buildMode.active) || game.targetingType) {
            if (typeof ui !== 'undefined' && ui && typeof ui.showToast === 'function') {
                ui.showToast('타게팅/건설 모드에서는 조종을 시작할 수 없습니다.');
            }
            return false;
        }
        const target = isDirectControlEligibleUnit(unit) ? unit : getSelectedDirectControlCandidate();
        if (!target) {
            if (typeof ui !== 'undefined' && ui && typeof ui.showToast === 'function') {
                ui.showToast('조종 가능한 유닛 1개를 선택하세요. (기갑/보병/항공)');
            }
            return false;
        }

        if (state.active && state.unit === target) {
            syncDirectControlSelection(target);
            return true;
        }

        if (state.active && state.unit && state.unit !== target) {
            stopDirectControl('internal');
        }

        state.active = true;
        state.unit = target;
        state.cancelSuppressedUnit = null;
        clearDirectControlKeys();
        state.weaponMode = 'main';

        target.commandMode = 'stop';
        target.returnToBase = false;
        target.targetX = null;
        target.targetY = null;
        target.commandTargetX = null;
        target.lockedTarget = null;
        target.attackTarget = null;
        clearDirectControlManualAim(target);
        setDirectControlCameraFollow(target, true);

        syncDirectControlSelection(target);

        if (typeof ui !== 'undefined' && ui && typeof ui.showToast === 'function') {
            const label = target.stats && target.stats.name ? target.stats.name : (target.stats && target.stats.id ? target.stats.id : 'UNIT');
            ui.showToast(`조종 시작: ${label} (X: 조종취소)`);
        }
        if (typeof game.updateHUDSelection === 'function') game.updateHUDSelection();
        if (typeof app !== 'undefined' && app && typeof app.markUiDirty === 'function') app.markUiDirty();
        if (typeof window !== 'undefined'
            && window.MobileDirectControlUI
            && typeof window.MobileDirectControlUI.refresh === 'function') {
            window.MobileDirectControlUI.refresh();
        }
        return true;
    }

    function stopDirectControl(reason = '') {
        const state = ensureDirectControlState();
        if (!state.active && !state.unit) return false;

        const unit = state.unit;
        state.active = false;
        state.unit = null;
        if (reason !== 'internal') {
            state.cancelSuppressedUnit = unit || null;
        } else if (state.cancelSuppressedUnit === unit) {
            state.cancelSuppressedUnit = null;
        }
        clearDirectControlKeys();
        state.weaponMode = 'main';

        if (unit && !unit.dead) {
            const hasSavedHold = hasDirectControlReleaseHold(unit);
            const forcedStance = normalizeInfantryStance(unit._forcedInfantryStance);
            const infantryPoseHold = (
                isDirectControlInfantryUnit(unit)
                && (
                    forcedStance === 'crouching'
                    || forcedStance === 'prone'
                )
            );
            const preserveHoldOnRelease = hasSavedHold || infantryPoseHold;

            unit.commandMode = preserveHoldOnRelease ? 'stop' : 'attack';
            unit.returnToBase = false;
            unit.targetX = null;
            unit.targetY = null;
            unit.commandTargetX = null;
            unit.lockedTarget = null;
            unit.attackTarget = null;
            clearDirectControlManualAim(unit);
            if (isDirectControlInfantryUnit(unit) && preserveHoldOnRelease) {
                // Preserve crouch/prone pose after direct-control release while unit holds position.
                const stanceToKeep = (forcedStance === 'crouching' || forcedStance === 'prone')
                    ? forcedStance
                    : '';
                if (stanceToKeep) {
                    unit._forcedInfantryStance = stanceToKeep;
                } else if (forcedStance === 'standing') {
                    unit._forcedInfantryStance = null;
                }
            } else if (isDirectControlInfantryUnit(unit)) {
                unit._forcedInfantryStance = null;
            }
            if (unit.stats && unit.stats.id === 'mbt' && typeof unit.stopManualTankMG === 'function') {
                unit.stopManualTankMG(true);
            }
        }
        setDirectControlCameraFollow(null, false);

        // Command cancel should also clear current selection marker.
        if (reason === 'cancel' || reason === 'escape') {
            if (game && typeof game.clearAllSelection === 'function') {
                game.clearAllSelection();
            } else if (game && game.selectedUnits && typeof game.selectedUnits.clear === 'function') {
                game.selectedUnits.forEach((u) => {
                    if (u) u.isSelected = false;
                });
                game.selectedUnits.clear();
                game.selectedBuilding = null;
            }
        }

        if (reason !== 'internal' && typeof ui !== 'undefined' && ui && typeof ui.showToast === 'function') {
            ui.showToast('조종 취소');
        }
        if (typeof game.updateHUDSelection === 'function') game.updateHUDSelection();
        if (typeof app !== 'undefined' && app && typeof app.markUiDirty === 'function') app.markUiDirty();
        if (typeof window !== 'undefined'
            && window.MobileDirectControlUI
            && typeof window.MobileDirectControlUI.refresh === 'function') {
            window.MobileDirectControlUI.refresh();
        }
        return true;
    }

    function toggleDirectControl(unit) {
        const state = ensureDirectControlState();
        if (state.active) return stopDirectControl('toggle');
        return startDirectControl(unit);
    }

    ensureDirectControlState();
    game.isDirectControlEligible = isDirectControlEligibleUnit;
    game.getDirectControlSelectedCandidate = getSelectedDirectControlCandidate;
    game.isDirectControlActive = function () {
        const state = ensureDirectControlState();
        return !!(state.active && state.unit && !state.unit.dead);
    };
    game.getDirectControlUnit = function () {
        return this.isDirectControlActive() ? ensureDirectControlState().unit : null;
    };
    game.startDirectControl = startDirectControl;
    game.stopDirectControl = stopDirectControl;
    game.toggleDirectControl = toggleDirectControl;
    game.setDirectControlReleaseHold = setDirectControlReleaseHold;
    game.clearAllDirectControlReleaseHold = clearAllDirectControlReleaseHold;
    game.setDirectControlKeyState = function (key, pressed) {
        const state = ensureDirectControlState();
        const k = String(key || '');
        if (!Object.prototype.hasOwnProperty.call(state.keys, k)) return false;
        state.keys[k] = !!pressed;
        return true;
    };
    game.clearDirectControlKeys = clearDirectControlKeys;
    game.getDirectControlWeaponMode = getDirectControlWeaponMode;
    game.setDirectControlWeaponMode = setDirectControlWeaponMode;
    game.toggleDirectControlWeaponMode = toggleDirectControlWeaponMode;
    game.getDirectControlWeaponToggleInfo = getDirectControlWeaponToggleInfo;
    game.getDirectControlInfantryStanceInfo = getDirectControlInfantryStanceInfo;
    game.toggleDirectControlInfantryStance = toggleDirectControlInfantryStance;
    game.directControlFireCurrentWeapon = directControlFireCurrentWeapon;
    game.getDirectControlMobileProfile = function (unit) {
        const target = unit || ((typeof this.getDirectControlUnit === 'function') ? this.getDirectControlUnit() : null);
        return getDirectControlMobileProfile(target);
    };
    game.mobileDirectMainFire = mobileDirectMainFire;
    game.mobileDirectSubFireStart = mobileDirectSubFireStart;
    game.mobileDirectSubFireStop = mobileDirectSubFireStop;

    // ============================================
    // [NEW] Custom cursor + move marker (PC)
    //  - system cursor is hidden via CSS (#game-canvas{cursor:none;})
    //  - we draw cursor + right-click move marker in-canvas
    // ============================================
    game.moveEffects = game.moveEffects || [];
    game.__cursor = game.__cursor || {
        clientX: 0,
        clientY: 0,
        x: 0,
        y: 0,
        down: false,
        button: 0,
        inCanvas: false
    };

    function __clientToCanvas(clientX, clientY) {
        const wrapper = document.getElementById('game-wrapper');
        const rect = wrapper
            ? wrapper.getBoundingClientRect()
            : (game.canvas && typeof game.canvas.getBoundingClientRect === 'function'
                ? game.canvas.getBoundingClientRect()
                : { left: 0, top: 0, width: Number(game.width) || 1, height: Number(game.height) || 1 });
        const viewW = Math.max(1, Number(game && game.width) || 1);
        const viewH = Math.max(1, Number(game && game.height) || 1);
        const scaleX = Math.max(0.0001, Number(rect.width) / viewW);
        const scaleY = Math.max(0.0001, Number(rect.height) / viewH);
        return {
            x: (clientX - rect.left) / scaleX,
            y: (clientY - rect.top) / scaleY
        };
    }

    function __updateCursor(clientX, clientY) {
        const p = __clientToCanvas(clientX, clientY);
        game.__cursor.clientX = clientX;
        game.__cursor.clientY = clientY;
        game.__cursor.x = p.x;
        game.__cursor.y = p.y;
        const wrapper = document.getElementById('game-wrapper');
        if (wrapper) {
            const rect = wrapper.getBoundingClientRect();
            game.__cursor.inCanvas = (
                clientX >= rect.left
                && clientX <= rect.right
                && clientY >= rect.top
                && clientY <= rect.bottom
            );
        }
    }

    if (!game.__cursorListenersBound) {
        game.__cursorListenersBound = true;

        window.addEventListener('mousemove', (e) => __updateCursor(e.clientX, e.clientY));
        window.addEventListener('mousedown', (e) => {
            __updateCursor(e.clientX, e.clientY);
            if (e.button === 0 || e.button === 2) {
                game.__cursor.down = true;
                game.__cursor.button = e.button;
            }
        });
        window.addEventListener('mouseup', (e) => {
            __updateCursor(e.clientX, e.clientY);
            if (e.button === 0 || e.button === 2) {
                game.__cursor.down = false;
            }
        });

        if (game.canvas) {
            game.canvas.addEventListener('mouseenter', () => { game.__cursor.inCanvas = true; });
            game.canvas.addEventListener('mouseleave', () => { game.__cursor.inCanvas = false; });
        }
    }

    // ============================================
    // B) Unit.prototype.update 紐쏀궎?⑥튂
    // ============================================
    const __origUpdate = Unit.prototype.update;

    Unit.prototype.update = function (enemies, buildings) {
        if (this.dead) return;

        // [FIX] Builder buildTask priority: allow construction movement even when selected
        if (this.stats.isBuilder && this.buildTask) {
            __origUpdate.call(this, enemies, buildings);
            return;
        }

        // [FIX] Crash descent must always run through base update.
        // Otherwise player air units in wrapped stop/move branches can freeze mid-air on lethal hit.
        if (this.crashState) {
            __origUpdate.call(this, enemies, buildings);
            return;
        }

        // [FIX] Keep transport heli drop state machine running even when command wrappers
        // would otherwise early-return on move/stop/retreat.
        if (typeof this.isAirTransport === 'function'
            && typeof this.updateAirDrop === 'function'
            && this.isAirTransport()
            && this.dropState) {
            __origUpdate.call(this, enemies, buildings);
            return;
        }

        // [NEW] Direct control priority (player combat units)
        const directControlUnit = (typeof game.getDirectControlUnit === 'function')
            ? game.getDirectControlUnit()
            : null;
        if (directControlUnit && directControlUnit === this) {
            if (!isDirectControlEligibleUnit(this)) {
                if (typeof game.stopDirectControl === 'function') game.stopDirectControl('internal');
                return;
            }
            setDirectControlCameraFollow(this, true);

            const dcState = ensureDirectControlState();
            const keys = dcState.keys || {};
            const unitId = String((this.stats && this.stats.id) || '');

            // Keep transient fire effects decaying while direct-control override is active.
            if (this.recoil && this.recoil > 0) {
                this.recoil = Math.max(0, this.recoil - 0.6);
            }
            if (this.missileFlash && this.missileFlash > 0) {
                this.missileFlash = Math.max(0, this.missileFlash - 1);
            }

            this.commandMode = 'stop';
            this.returnToBase = false;
            this.targetX = null;
            this.commandTargetX = null;
            this.lockedTarget = null;

            let moveXAxis = 0;
            if (keys.a || keys.arrowLeft) moveXAxis -= 1;
            if (keys.d || keys.arrowRight) moveXAxis += 1;
            if (moveXAxis > 1) moveXAxis = 1;
            if (moveXAxis < -1) moveXAxis = -1;

            let moveDepthAxis = 0;
            if (keys.w || keys.arrowUp) moveDepthAxis -= 1;
            if (keys.s || keys.arrowDown) moveDepthAxis += 1;
            if (moveDepthAxis > 1) moveDepthAxis = 1;
            if (moveDepthAxis < -1) moveDepthAxis = -1;

            const baseSpeed = Math.max(0.45, Number(this.stats && this.stats.speed) || 0.45);
            const unitCategory = String((this.stats && this.stats.category) || '').trim().toLowerCase();
            const unitType = String((this.stats && this.stats.type) || '').trim().toLowerCase();
            const isArmoredLike = (unitCategory === 'armored' || unitType === 'mech');
            const isInfantryLike = (unitCategory === 'infantry' || unitType === 'bio');
            const sprintMul = (keys.shift && isArmoredLike) ? 1.45 : 1.0;
            let moveSpeed = baseSpeed * ((this.stats && this.stats.type === 'air') ? 1.35 : 1.2) * sprintMul;
            // Direct-control tuning: infantry/armored should not feel over-accelerated.
            if (isInfantryLike) moveSpeed *= 0.72;
            else if (isArmoredLike) moveSpeed *= 0.68;
            if (moveXAxis !== 0) {
                this.x += moveXAxis * moveSpeed;
                this.facing = (moveXAxis > 0) ? 1 : -1;
            }

            if (this.stats.type === 'air') {
                const depthSpeed = Math.max(0.4, baseSpeed * 0.95);
                const currentDepth = Number.isFinite(Number(this.depthZ)) ? Number(this.depthZ) : 0;
                const depthMin = -120;
                const depthMax = 120;
                const apacheLegacyVertical = (
                    unitId === 'apache'
                    && !(keys.r || keys.f)
                    && moveDepthAxis !== 0
                );
                const effectiveDepthAxis = apacheLegacyVertical ? 0 : moveDepthAxis;
                if (effectiveDepthAxis !== 0) {
                    const nextDepth = currentDepth + (effectiveDepthAxis * depthSpeed * 1.6);
                    this.depthZ = Math.max(depthMin, Math.min(depthMax, nextDepth));
                } else if (!Number.isFinite(Number(this.depthZ))) {
                    this.depthZ = 0;
                }
            } else {
                this.depthZ = 0;
            }

            const frameNow = Number.isFinite(Number(game && game.frame)) ? Number(game.frame) : NaN;
            const manualAim = getFreshDirectControlManualAim(this, frameNow);
            const hasManualAim = !!manualAim;
            if (moveXAxis === 0 && manualAim) {
                const aimDx = Number(manualAim.x) - Number(this.x);
                if (Math.abs(aimDx) > 4) {
                    this.facing = (aimDx >= 0) ? 1 : -1;
                }
            }

            if (this.stats.type === 'air') {
                let verticalAxis = 0;
                if (keys.r) verticalAxis -= 1;
                if (keys.f) verticalAxis += 1;
                if (verticalAxis === 0 && unitId === 'apache') {
                    if (keys.w || keys.arrowUp) verticalAxis -= 1;
                    if (keys.s || keys.arrowDown) verticalAxis += 1;
                }
                if (verticalAxis !== 0) {
                    const climbSpeed = Math.max(0.6, baseSpeed * 0.9);
                    this.y += verticalAxis * climbSpeed;
                }
                const minY = game.groundY - 620;
                const maxY = game.groundY - 300;
                if (this.y < minY) this.y = minY;
                if (this.y > maxY) this.y = maxY;
                this.rotorAngle += 1.0;
            } else {
                let groundMoveStep = Math.max(0.45, baseSpeed * 1.05);
                if (isInfantryLike) groundMoveStep *= 0.78;
                else if (isArmoredLike) groundMoveStep *= 0.74;
                if (moveDepthAxis !== 0) {
                    const baseTargetY = Number.isFinite(this.targetY)
                        ? this.targetY
                        : (Number.isFinite(this.y) ? this.y : Number(game.groundY));
                    const nextTargetY = baseTargetY + (moveDepthAxis * groundMoveStep * 2.4);
                    this.targetY = (typeof game.clampGroundLaneY === 'function')
                        ? game.clampGroundLaneY(nextTargetY)
                        : nextTargetY;
                } else if (!Number.isFinite(this.targetY)) {
                    this.targetY = Number.isFinite(this.y) ? this.y : Number(game.groundY);
                }

                if (typeof this.applyGroundLanePostUpdate === 'function') {
                    this.applyGroundLanePostUpdate({ immediate: true, noSeparation: true });
                } else {
                    this.y = game.groundY;
                }
            }

            // Keep MBT manual MG hold behavior consistent with base update path.
            if (unitId === 'mbt') {
                const buildActive = !!(game && game.buildMode && game.buildMode.active);
                const targetingActive = !!(game && game.targetingType);
                if (this.manualMgHeld === true && hasManualAim && !buildActive && !targetingActive) {
                    if (typeof this.tryManualTankMGFire === 'function') {
                        this.tryManualTankMGFire(manualAim.x, manualAim.y);
                    }
                } else if (this.manualMgModeActive === true && typeof this.stopManualTankMG === 'function') {
                    this.stopManualTankMG(false);
                }
            }

            const halfWidth = Math.max(8, (Number(this.width) || 16) / 2);
            const mapWidth = Number((typeof CONFIG !== 'undefined' && CONFIG) ? CONFIG.mapWidth : NaN);
            if (Number.isFinite(mapWidth) && mapWidth > 0) {
                if (this.x < halfWidth) this.x = halfWidth;
                if (this.x > mapWidth - halfWidth) this.x = mapWidth - halfWidth;
            }
            this._lastX = this.x;

            // Direct-control combat is manual-fire only (mobile ATK / PC click).
            // Do not run nearest-enemy auto fire in this branch.
            if (this.attackTarget && this.attackTarget.dead) {
                this.attackTarget = null;
            }
            return;
        }

        // [NEW] Move mode processing
        if (this.team === 'player' && this.commandMode === 'move') {
            const isAirUnit = !!(this.stats && this.stats.type === 'air');
            if (isAirUnit) this.rotorAngle += 0.8;
            if (this.lastDamagedFrame && game.frame - this.lastDamagedFrame < 10) {
                this.commandMode = 'stop';
                this.targetX = null;
                this.targetY = null;
                if (typeof this.updateFacing === 'function') this.updateFacing();
                return;
            }
            const rawTargetX = this.targetX;
            const moveTargetX = Number.isFinite(Number(this.commandTargetX))
                ? Number(this.commandTargetX)
                : ((rawTargetX === null || rawTargetX === undefined) ? NaN : Number(rawTargetX));
            let reachedX = !Number.isFinite(moveTargetX);
            if (!reachedX) {
                const dx = moveTargetX - this.x;
                if (Math.abs(dx) < 10) {
                    this.x = moveTargetX;
                    reachedX = true;
                } else {
                    this.x += (Number(this.stats && this.stats.speed) || 0.5) * Math.sign(dx);
                }
            }

            let reachedY = true;
            if (!isAirUnit && this.targetY !== null && this.targetY !== undefined) {
                if (typeof game.clampGroundLaneY === 'function') {
                    this.targetY = game.clampGroundLaneY(this.targetY);
                }
                if (typeof this.applyGroundLanePostUpdate === 'function') {
                    this.applyGroundLanePostUpdate({ noSeparation: true });
                } else {
                    const stepY = Math.max(0.35, (Number(this.stats && this.stats.speed) || 0.5) * 0.75);
                    const dyRaw = Number(this.targetY) - Number(this.y);
                    if (Number.isFinite(dyRaw) && Math.abs(dyRaw) > stepY) {
                        this.y += Math.sign(dyRaw) * stepY;
                    } else if (Number.isFinite(this.targetY)) {
                        this.y = this.targetY;
                    }
                }

                const dyRemain = Number(this.targetY) - Number(this.y);
                reachedY = Number.isFinite(dyRemain) ? (Math.abs(dyRemain) <= 8) : true;
            }

            if (reachedX && reachedY) {
                this.commandMode = 'stop';
                this.targetX = null;
                this.commandTargetX = null;
                if (!isAirUnit) this.targetY = null;
            }

            if (typeof this.updateFacing === 'function') this.updateFacing();
            return;
        }

        // ?뚮젅?댁뼱 ?좊떅??而ㅻ㎤??紐⑤뱶 泥섎━
        if (this.team === 'player' && this.commandMode) {
            if (this.commandMode === 'stop') {
                // 공중은 제자리 유지
                if (this.stats.type === 'air') { this.rotorAngle += 0.8; return; }

                // ICBM은 정지 명령 중에도 발사 상태머신을 계속 갱신해야 함
                const icbmLaunching = (this.stats.id === 'icbm') &&
                    (((this.icbmLaunchState || 'idle') !== 'idle') || !!this.icbmLaunchRequest);
                if (icbmLaunching) {
                    __origUpdate.call(this, enemies, buildings);
                    return;
                }

                // Direct-control release hold: keep position, but still allow stop-mode auto fire.
                if (this._dcReleaseHold === true) {
                    this.targetX = null;
                    this.commandTargetX = null;
                    this.targetY = null;
                    if (this.manualMgHeld === true) {
                        this.manualMgHeld = false;
                        if (typeof this.stopManualTankMG === 'function') {
                            this.stopManualTankMG(true);
                        } else if (typeof this._stopTankMGSound === 'function') {
                            this._stopTankMGSound();
                        }
                    }
                }

                // 지상: 제자리 유지 + 사거리 내 자동 공격만 수행
                const target = this.findNearestEnemy(enemies, buildings);
                const unitRange = Number(this.getEffectiveRange ? this.getEffectiveRange() : (this.stats.range || 0));
                const missileRange = Number(this.getEffectiveMissileRange ? this.getEffectiveMissileRange() : unitRange);
                const usesExtendedMissileRange = (this.stats.id === 'apc' || this.stats.id === 'engineer' || this.stats.id === 'rpg');
                const activeRange = usesExtendedMissileRange ? Math.max(unitRange, missileRange) : unitRange;
                const restrictRear = (typeof this.shouldRestrictRearTargeting === 'function')
                    ? this.shouldRestrictRearTargeting()
                    : (String((this.stats && this.stats.id) || '') !== 'aa_tank');
                const targetBehind = !!(target && restrictRear && typeof this.isTargetBehindX === 'function' && this.isTargetBehindX(target.x, 20));
                const targetIsAir = !!(target && target.stats && target.stats.type === 'air');
                const canAttackAir = !targetIsAir || canUnitEngageAir(this, target);
                const canAttack = (target && !targetBehind && canAttackAir && Math.abs(target.x - this.x) <= activeRange);
                if (canAttack) {
                    this.attackTarget = target;
                    let rate = 60;
                    if (['humvee', 'apc', 'aa_tank', 'turret', 'blackhawk'].includes(this.stats.id)) rate = 15;
                    else if (this.stats.id === 'spg') rate = 300;
                    else if (this.stats.id === 'sniper') rate = 210;

                    if (game.frame - this.lastAttack > rate) {
                        this.attack(target);
                        this.lastAttack = game.frame;
                    }
                } else {
                    const sticky = this.attackTarget;
                    if (sticky && (
                        sticky.dead
                        || (restrictRear && typeof this.isTargetBehindX === 'function' && this.isTargetBehindX(sticky.x, 20))
                        || Math.abs((Number(sticky.x) || 0) - this.x) > (activeRange + 80)
                    )) {
                        this.attackTarget = null;
                    }
                }
                if (typeof this.updateFacing === 'function') this.updateFacing();
                return;
            }

            if (this.commandMode === 'retreat') {
                // 후퇴: HQ가 있으면 HQ 근처, 없으면 좌측 맵 끝까지 복귀
                const stopX = (typeof game.getPlayerRetreatStopX === 'function')
                    ? game.getPlayerRetreatStopX()
                    : 250;
                this.targetY = null;

                if (this.x > stopX) {
                    this.attackTarget = null;
                    const speed = this.stats.speed || 0.5;
                    this.x -= speed;
                    const category = String((this.stats && this.stats.category) || '');
                    const unitType = String((this.stats && this.stats.type) || '');
                    const isArmoredLike = (category === 'armored' || unitType === 'mech');
                    if (isArmoredLike) {
                        let threatX = Number(this._retreatThreatX);
                        if (!Number.isFinite(threatX) && this._retreatThreatRef && !this._retreatThreatRef.dead) {
                            threatX = Number(this._retreatThreatRef.x);
                        }
                        if (!Number.isFinite(threatX) && typeof this.findNearestEnemy === 'function') {
                            const retreatThreat = this.findNearestEnemy(enemies || [], buildings || []);
                            if (retreatThreat && !retreatThreat.dead && Number.isFinite(Number(retreatThreat.x))) {
                                threatX = Number(retreatThreat.x);
                                this._retreatThreatRef = retreatThreat;
                                this._retreatThreatX = threatX;
                            }
                        }
                        if (Number.isFinite(threatX)) {
                            const dtx = threatX - this.x;
                            if (Math.abs(dtx) > 3) this.facing = dtx >= 0 ? 1 : -1;
                        } else if (this.facing == null) {
                            this.facing = (this.team === 'player') ? 1 : -1;
                        }
                        this._lastX = this.x;
                    } else {
                        this.updateFacing();
                    }
                } else {
                    // 湲곗? ???꾨떖: ?먮룞 ?뺤?
                    this.commandMode = 'stop';
                    this.returnToBase = false;
                    this._retreatThreatRef = null;
                    this._retreatThreatX = null;
                }

                if (this.stats.type === 'air') this.rotorAngle += 0.8;
                return;
            }
            // commandMode === 'attack'?대㈃ 湲곕낯 AI濡?吏꾪뻾
        }

        // 湲곕낯 update ?ㅽ뻾
        __origUpdate.call(this, enemies, buildings);
    };

    // ============================================
    // C) ?좊떅 ?덊듃?뚯뒪??
    // ============================================
    function getUnitRenderY(u) {
        if (!u) return 0;
        const renderYRaw = (typeof u.getRenderY === 'function')
            ? Number(u.getRenderY())
            : Number(u.y);
        return Number.isFinite(renderYRaw) ? renderYRaw : Number(u.y || 0);
    }

    function getUnitVisualY(u) {
        const renderY = getUnitRenderY(u);
        if (!u) return renderY;
        let snapDy = 0;
        try {
            if (typeof u.computeFeetSnapDy === 'function') {
                const snap = Number(u.computeFeetSnapDy());
                if (Number.isFinite(snap)) snapDy = snap;
            }
        } catch (_) { }
        return renderY + snapDy;
    }

    function isInfantryLikeUnit(u) {
        if (!u || !u.stats) return false;
        const unitCategory = String((u.stats && u.stats.category) || '').trim().toLowerCase();
        const unitType = String((u.stats && u.stats.type) || '').trim().toLowerCase();
        return (unitCategory === 'infantry' || unitType === 'bio');
    }

    function getUnitHitRenderScale(u) {
        const id = String((u && u.stats && u.stats.id) || '').trim().toLowerCase();
        const armoredBoost = {
            humvee: 1.18,
            apc: 1.16,
            mbt: 1.16,
            spg: 1.16,
            aa_tank: 1.12,
            icbm: 1.16,
            icbm_enemy: 1.16
        };
        const boost = Number(armoredBoost[id]) || 1;
        return 1.4 * boost;
    }

    function isCoarseLikePointer() {
        let coarsePointer = false;
        let touchCapable = false;
        try {
            coarsePointer = !!(window.matchMedia && window.matchMedia('(pointer: coarse)').matches);
        } catch (_) { }
        try {
            touchCapable = (typeof navigator !== 'undefined')
                ? ((Number(navigator.maxTouchPoints) || 0) > 0)
                : false;
        } catch (_) { }
        return !!(coarsePointer || touchCapable);
    }

    function getUnitHitProfile(u, soft = false) {
        if (!u || u.dead) return null;
        const unitY = getUnitVisualY(u);
        const zoom = (typeof Camera !== 'undefined' && Number.isFinite(Number(Camera.zoom)) && Number(Camera.zoom) > 0)
            ? Number(Camera.zoom)
            : 1;
        const coarseLike = isCoarseLikePointer();
        const unitCategory = String((u.stats && u.stats.category) || '').trim().toLowerCase();
        const unitType = String((u.stats && u.stats.type) || '').trim().toLowerCase();
        const isAir = unitType === 'air';
        const isInfantryLike = (unitCategory === 'infantry' || unitType === 'bio');
        const isArmoredLike = (unitCategory === 'armored' || unitType === 'mech');
        const renderScale = getUnitHitRenderScale(u);
        const padPxX = coarseLike ? (soft ? 52 : 42) : 18;
        const padPxY = coarseLike ? (soft ? 44 : 34) : 14;
        const extraAirPadX = isAir ? (coarseLike ? (soft ? 30 : 24) : 12) : 0;
        const extraAirPadY = isAir ? (coarseLike ? (soft ? 24 : 18) : 10) : 0;
        const extraArmorPadX = isArmoredLike ? (coarseLike ? (soft ? 20 : 14) : 8) : 0;
        const extraArmorPadY = isArmoredLike ? (coarseLike ? (soft ? 16 : 12) : 6) : 0;
        const extraInfPadX = isInfantryLike ? (coarseLike ? (soft ? 14 : 10) : 4) : 0;
        const extraInfPadY = isInfantryLike ? (coarseLike ? (soft ? 12 : 8) : 3) : 0;
        const padX = (padPxX + extraAirPadX + extraArmorPadX + extraInfPadX) / zoom;
        const padY = (padPxY + extraAirPadY + extraArmorPadY + extraInfPadY) / zoom;
        const infWidthScale = isInfantryLike ? 1.18 : 1;
        const infHeightScale = isInfantryLike ? 1.35 : 1;
        const baseHalfW = (Number(u.width || 0) / 2) * renderScale * infWidthScale;
        const baseH = Number(u.height || 0) * renderScale * infHeightScale;
        const minInfHalfW = isInfantryLike
            ? ((coarseLike ? (soft ? 30 : 26) : (soft ? 18 : 16)) / zoom)
            : 0;
        const minInfH = isInfantryLike
            ? ((coarseLike ? (soft ? 44 : 38) : (soft ? 28 : 24)) / zoom)
            : 0;
        const halfW = Math.max(baseHalfW, minInfHalfW);
        const bodyH = Math.max(baseH, minInfH);
        const infBottomPad = isInfantryLike
            ? ((coarseLike ? (soft ? 8 : 6) : (soft ? 4 : 3)) / zoom)
            : 0;
        const left = (Number(u.x) || 0) - halfW - padX;
        const right = (Number(u.x) || 0) + halfW + padX;
        const top = unitY - bodyH - padY;
        const bottom = unitY + padY + infBottomPad;

        let footBand = null;
        let groundBand = null;
        if (!isAir) {
            const footHalfW = (
                isInfantryLike
                    ? (coarseLike ? (soft ? 30 : 24) : (soft ? 18 : 14))
                    : (isArmoredLike
                        ? (coarseLike ? (soft ? 86 : 72) : (soft ? 58 : 46))
                        : (coarseLike ? (soft ? 64 : 52) : (soft ? 40 : 32)))
            ) / zoom;
            const footTopPad = (
                isInfantryLike
                    ? (coarseLike ? (soft ? 6 : 4) : (soft ? 3 : 2))
                    : (coarseLike ? (soft ? 12 : 8) : (soft ? 7 : 5))
            ) / zoom;
            const footBottomPad = (
                isInfantryLike
                    ? (coarseLike ? (soft ? 14 : 10) : (soft ? 8 : 6))
                    : (coarseLike ? (soft ? 46 : 34) : (soft ? 28 : 20))
            ) / zoom;
            const cx = Number(u.x) || 0;
            footBand = {
                left: cx - footHalfW,
                right: cx + footHalfW,
                top: unitY - footTopPad,
                bottom: unitY + footBottomPad
            };

            // Ground-anchor band: guarantees reliable "feet / under-body" picking.
            // Uses lane-ground Y as fallback anchor because render feet can drift by skin/snap.
            const rawGroundY = Number(u.y);
            const groundY = Number.isFinite(rawGroundY) ? Math.max(unitY, rawGroundY) : unitY;
            const groundHalfW = (
                isInfantryLike
                    ? (coarseLike ? (soft ? 40 : 34) : (soft ? 26 : 22))
                    : (isArmoredLike
                        ? (coarseLike ? (soft ? 96 : 82) : (soft ? 68 : 56))
                        : (coarseLike ? (soft ? 72 : 60) : (soft ? 46 : 38)))
            ) / zoom;
            const groundTopPad = (
                isInfantryLike
                    ? (coarseLike ? (soft ? 12 : 9) : (soft ? 8 : 6))
                    : (coarseLike ? (soft ? 14 : 10) : (soft ? 10 : 8))
            ) / zoom;
            const groundBottomPad = (
                isInfantryLike
                    ? (coarseLike ? (soft ? 28 : 22) : (soft ? 20 : 16))
                    : (isArmoredLike
                        ? (coarseLike ? (soft ? 64 : 50) : (soft ? 42 : 34))
                        : (coarseLike ? (soft ? 54 : 42) : (soft ? 36 : 28)))
            ) / zoom;
            groundBand = {
                left: cx - groundHalfW,
                right: cx + groundHalfW,
                top: groundY - groundTopPad,
                bottom: groundY + groundBottomPad
            };
        }

        let ellipse = null;
        if (!isInfantryLike) {
            const cx = Number(u.x) || 0;
            const cy = unitY - (bodyH * (isAir ? 0.48 : 0.44));
            const rx = Math.max(
                halfW * (isAir ? 1.05 : 0.95),
                ((coarseLike ? (soft ? 96 : 82) : (soft ? 62 : 50)) / zoom)
            );
            const ry = Math.max(
                bodyH * (isAir ? 0.82 : 0.74),
                ((coarseLike ? (soft ? 84 : 72) : (soft ? 52 : 44)) / zoom)
            );
            ellipse = { cx, cy, rx, ry };
        }

        let infantryFallback = null;
        if (isInfantryLike) {
            const baseR = ((coarseLike ? (soft ? 30 : 24) : (soft ? 18 : 15)) / zoom);
            infantryFallback = {
                headY: unitY - (bodyH * 0.88),
                torsoY: unitY - (bodyH * 0.56),
                baseR
            };
        }

        return {
            left, right, top, bottom,
            footBand,
            groundBand,
            ellipse,
            infantryFallback,
            isInfantryLike,
            coarseLike
        };
    }

    // Client-space profile (screen pixels): keeps hitbox size stable across zoom.
    function getUnitClientHitProfile(ownerGame, u, soft = false, metrics = null) {
        if (!u || u.dead) return null;
        const m = metrics || getClientProjectionMetrics(ownerGame);
        if (!m) return null;

        const unitWorldX = Number(u.x) || 0;
        const unitWorldY = getUnitVisualY(u);
        const unitClientX = worldToClientX(unitWorldX, m);
        const unitClientY = worldToClientY(unitWorldY, m);
        if (!Number.isFinite(unitClientX) || !Number.isFinite(unitClientY)) return null;

        const scaleX = Math.max(0.0001, Number(m.scaleX) || 1);
        const scaleY = Math.max(0.0001, Number(m.scaleY) || 1);
        const coarseLike = isCoarseLikePointer();
        const unitCategory = String((u.stats && u.stats.category) || '').trim().toLowerCase();
        const unitType = String((u.stats && u.stats.type) || '').trim().toLowerCase();
        const isAir = unitType === 'air';
        const isInfantryLike = (unitCategory === 'infantry' || unitType === 'bio');
        const isArmoredLike = (unitCategory === 'armored' || unitType === 'mech');
        const renderScale = getUnitHitRenderScale(u);

        const padPxX = coarseLike ? (soft ? 52 : 42) : 18;
        const padPxY = coarseLike ? (soft ? 44 : 34) : 14;
        const extraAirPadX = isAir ? (coarseLike ? (soft ? 30 : 24) : 12) : 0;
        const extraAirPadY = isAir ? (coarseLike ? (soft ? 24 : 18) : 10) : 0;
        const extraArmorPadX = isArmoredLike ? (coarseLike ? (soft ? 20 : 14) : 8) : 0;
        const extraArmorPadY = isArmoredLike ? (coarseLike ? (soft ? 16 : 12) : 6) : 0;
        const extraInfPadX = isInfantryLike ? (coarseLike ? (soft ? 14 : 10) : 4) : 0;
        const extraInfPadY = isInfantryLike ? (coarseLike ? (soft ? 12 : 8) : 3) : 0;
        const padX = padPxX + extraAirPadX + extraArmorPadX + extraInfPadX;
        const padY = padPxY + extraAirPadY + extraArmorPadY + extraInfPadY;

        // Keep hitbox dimensions in stable screen-pixel bands, independent from camera zoom.
        const categoryBaseHalfW = isInfantryLike
            ? 22
            : (isArmoredLike ? 56 : (isAir ? 52 : 34));
        const categoryBaseH = isInfantryLike
            ? 52
            : (isArmoredLike ? 50 : (isAir ? 58 : 46));
        const coarseMul = coarseLike ? 1.28 : 1.0;
        const softMul = soft ? 1.16 : 1.0;
        const baseHalfW = categoryBaseHalfW * coarseMul * softMul;
        const baseBodyH = categoryBaseH * coarseMul * softMul;

        // Apply only a capped visual-size hint so very large hulls still feel fair,
        // while preventing zoom from affecting hitbox dimensions.
        const visualHalfWRaw = (Number(u.width || 0) / 2) * renderScale * scaleX;
        const visualBodyHRaw = Number(u.height || 0) * renderScale * scaleY;
        const maxVisualBoost = isInfantryLike ? 1.08 : (isAir ? 1.34 : 1.30);
        const clampedVisualHalfW = Math.min(Math.max(0, visualHalfWRaw), baseHalfW * maxVisualBoost);
        const clampedVisualBodyH = Math.min(Math.max(0, visualBodyHRaw), baseBodyH * maxVisualBoost);
        const halfW = Math.max(baseHalfW, clampedVisualHalfW);
        const bodyH = Math.max(baseBodyH, clampedVisualBodyH);
        const infBottomPad = isInfantryLike
            ? (coarseLike ? (soft ? 8 : 6) : (soft ? 4 : 3))
            : 0;

        const left = unitClientX - halfW - padX;
        const right = unitClientX + halfW + padX;
        const top = unitClientY - bodyH - padY;
        const bottom = unitClientY + padY + infBottomPad;

        let footBand = null;
        let groundBand = null;
        if (!isAir) {
            const footHalfW = (
                isInfantryLike
                    ? (coarseLike ? (soft ? 30 : 24) : (soft ? 18 : 14))
                    : (isArmoredLike
                        ? (coarseLike ? (soft ? 86 : 72) : (soft ? 58 : 46))
                        : (coarseLike ? (soft ? 64 : 52) : (soft ? 40 : 32)))
            );
            const footTopPad = (
                isInfantryLike
                    ? (coarseLike ? (soft ? 6 : 4) : (soft ? 3 : 2))
                    : (coarseLike ? (soft ? 12 : 8) : (soft ? 7 : 5))
            );
            const footBottomPad = (
                isInfantryLike
                    ? (coarseLike ? (soft ? 14 : 10) : (soft ? 8 : 6))
                    : (coarseLike ? (soft ? 46 : 34) : (soft ? 28 : 20))
            );
            footBand = {
                left: unitClientX - footHalfW,
                right: unitClientX + footHalfW,
                top: unitClientY - footTopPad,
                bottom: unitClientY + footBottomPad
            };

            const rawGroundY = Number(u.y);
            const groundWorldY = Number.isFinite(rawGroundY) ? Math.max(unitWorldY, rawGroundY) : unitWorldY;
            const groundClientYRaw = worldToClientY(groundWorldY, m);
            const groundClientY = Number.isFinite(groundClientYRaw) ? groundClientYRaw : unitClientY;
            const groundHalfW = (
                isInfantryLike
                    ? (coarseLike ? (soft ? 40 : 34) : (soft ? 26 : 22))
                    : (isArmoredLike
                        ? (coarseLike ? (soft ? 96 : 82) : (soft ? 68 : 56))
                        : (coarseLike ? (soft ? 72 : 60) : (soft ? 46 : 38)))
            );
            const groundTopPad = (
                isInfantryLike
                    ? (coarseLike ? (soft ? 12 : 9) : (soft ? 8 : 6))
                    : (coarseLike ? (soft ? 14 : 10) : (soft ? 10 : 8))
            );
            const groundBottomPad = (
                isInfantryLike
                    ? (coarseLike ? (soft ? 28 : 22) : (soft ? 20 : 16))
                    : (isArmoredLike
                        ? (coarseLike ? (soft ? 64 : 50) : (soft ? 42 : 34))
                        : (coarseLike ? (soft ? 54 : 42) : (soft ? 36 : 28)))
            );
            groundBand = {
                left: unitClientX - groundHalfW,
                right: unitClientX + groundHalfW,
                top: groundClientY - groundTopPad,
                bottom: groundClientY + groundBottomPad
            };
        }

        let ellipse = null;
        if (!isInfantryLike) {
            const ecx = unitClientX;
            const ecy = unitClientY - (bodyH * (isAir ? 0.48 : 0.44));
            const rx = Math.max(
                halfW * (isAir ? 1.05 : 0.95),
                (coarseLike ? (soft ? 96 : 82) : (soft ? 62 : 50))
            );
            const ry = Math.max(
                bodyH * (isAir ? 0.82 : 0.74),
                (coarseLike ? (soft ? 84 : 72) : (soft ? 52 : 44))
            );
            ellipse = { cx: ecx, cy: ecy, rx, ry };
        }

        let infantryFallback = null;
        if (isInfantryLike) {
            const baseR = (coarseLike ? (soft ? 30 : 24) : (soft ? 18 : 15));
            infantryFallback = {
                headY: unitClientY - (bodyH * 0.88),
                torsoY: unitClientY - (bodyH * 0.56),
                baseR
            };
        }

        return {
            left, right, top, bottom,
            footBand,
            groundBand,
            ellipse,
            infantryFallback,
            isInfantryLike,
            coarseLike
        };
    }

    function isUnitHit(u, wx, wy, soft = false) {
        const profile = getUnitHitProfile(u, soft);
        if (!profile) return false;
        const boxHit = (
            wx >= profile.left
            && wx <= profile.right
            && wy >= profile.top
            && wy <= profile.bottom
        );
        if (boxHit) return true;
        if (profile.footBand) {
            const footHit = (
                wx >= profile.footBand.left
                && wx <= profile.footBand.right
                && wy >= profile.footBand.top
                && wy <= profile.footBand.bottom
            );
            if (footHit) return true;
        }
        if (profile.groundBand) {
            const groundHit = (
                wx >= profile.groundBand.left
                && wx <= profile.groundBand.right
                && wy >= profile.groundBand.top
                && wy <= profile.groundBand.bottom
            );
            if (groundHit) return true;
        }
        if (!profile.isInfantryLike && profile.ellipse) {
            // Non-infantry fallback ellipse: improves armored/air tap reliability while preserving intent.
            const dx = (Number(wx) || 0) - profile.ellipse.cx;
            const dy = (Number(wy) || 0) - profile.ellipse.cy;
            const rx = profile.ellipse.rx;
            const ry = profile.ellipse.ry;
            const nx = dx / Math.max(1, rx);
            const ny = dy / Math.max(1, ry);
            return ((nx * nx) + (ny * ny)) <= 1.0;
        }

        // Infantry fallback: prioritize head/torso proximity so small units stay reliably clickable.
        if (!profile.infantryFallback) return false;
        const headDx = Math.abs((Number(wx) || 0) - (Number(u.x) || 0));
        const headDy = Math.abs((Number(wy) || 0) - profile.infantryFallback.headY);
        const baseR = profile.infantryFallback.baseR;
        if (headDx <= (baseR * 0.95) && headDy <= (baseR * 1.05)) return true;
        const torsoDy = Math.abs((Number(wy) || 0) - profile.infantryFallback.torsoY);
        if (headDx <= (baseR * 1.12) && torsoDy <= (baseR * 1.25)) return true;
        return false;
    }

    function isNearUnitHitbox(u, wx, wy, nearPx = 16) {
        const profile = getUnitHitProfile(u, false);
        if (!profile) return false;
        const zoom = (typeof Camera !== 'undefined' && Number.isFinite(Number(Camera.zoom)) && Number(Camera.zoom) > 0)
            ? Number(Camera.zoom)
            : 1;
        const nearWorld = Math.max(0, Number(nearPx) || 0) / zoom;
        if (nearWorld <= 0.001) return false;

        const rectDistSq = (left, right, top, bottom) => {
            const dx = (wx < left) ? (left - wx) : ((wx > right) ? (wx - right) : 0);
            const dy = (wy < top) ? (top - wy) : ((wy > bottom) ? (wy - bottom) : 0);
            return (dx * dx) + (dy * dy);
        };

        let minDistSq = rectDistSq(profile.left, profile.right, profile.top, profile.bottom);
        if (profile.footBand) {
            const footDistSq = rectDistSq(
                profile.footBand.left,
                profile.footBand.right,
                profile.footBand.top,
                profile.footBand.bottom
            );
            if (footDistSq < minDistSq) minDistSq = footDistSq;
        }
        if (profile.groundBand) {
            const groundDistSq = rectDistSq(
                profile.groundBand.left,
                profile.groundBand.right,
                profile.groundBand.top,
                profile.groundBand.bottom
            );
            if (groundDistSq < minDistSq) minDistSq = groundDistSq;
        }
        return minDistSq <= (nearWorld * nearWorld);
    }

    function isUnitHoverHit(u, wx, wy) {
        if (!u || u.dead) return false;
        if (isUnitHit(u, wx, wy)) return true;
        const coarseLike = isCoarseLikePointer();
        if (coarseLike && isUnitHit(u, wx, wy, true)) return true;
        return isNearUnitHitbox(u, wx, wy, coarseLike ? 20 : 14);
    }

    function shouldShowUnitHitboxDebug() {
        const debug = (game && game.debug && typeof game.debug === 'object') ? game.debug : null;
        if (debug && Object.prototype.hasOwnProperty.call(debug, 'showUnitHitboxes')) {
            return !!debug.showUnitHitboxes;
        }
        return false;
    }

    function drawUnitHitboxDebugOverlay(ctx, ownerGame) {
        if (!ctx || !ownerGame || !shouldShowUnitHitboxDebug()) return;
        const metrics = getClientProjectionMetrics(ownerGame);
        if (!metrics) return;
        const toViewX = (clientX) => ((Number(clientX) - Number(metrics.rect.left)) / Math.max(0.0001, Number(metrics.scaleX) || 1));
        const toViewY = (clientY) => ((Number(clientY) - Number(metrics.rect.top)) / Math.max(0.0001, Number(metrics.scaleY) || 1));

        const drawOne = (u, teamColor) => {
            if (!u || u.dead) return;
            const box = getUnitClientHitProfile(ownerGame, u, false, metrics);
            if (!box) return;

            let left = box.left;
            let right = box.right;
            let top = box.top;
            let bottom = box.bottom;
            if (box.footBand) {
                left = Math.min(left, box.footBand.left);
                right = Math.max(right, box.footBand.right);
                top = Math.min(top, box.footBand.top);
                bottom = Math.max(bottom, box.footBand.bottom);
            }
            if (box.groundBand) {
                left = Math.min(left, box.groundBand.left);
                right = Math.max(right, box.groundBand.right);
                top = Math.min(top, box.groundBand.top);
                bottom = Math.max(bottom, box.groundBand.bottom);
            }
            const x = toViewX(left);
            const y = toViewY(top);
            const w = Math.max(0, toViewX(right) - toViewX(left));
            const h = Math.max(0, toViewY(bottom) - toViewY(top));
            if (!(w > 0.001 && h > 0.001)) return;

            ctx.strokeStyle = teamColor;
            ctx.fillStyle = teamColor;
            ctx.lineWidth = 1.8;
            ctx.setLineDash([]);
            ctx.globalAlpha = 0.88;
            ctx.strokeRect(x, y, w, h);
            ctx.globalAlpha = 0.08;
            ctx.fillRect(x, y, w, h);

            ctx.globalAlpha = 1.0;
        };

        ctx.save();
        if (Array.isArray(ownerGame.players)) {
            for (let i = 0; i < ownerGame.players.length; i++) {
                drawOne(ownerGame.players[i], 'rgba(34, 197, 94, 1)');
            }
        }
        if (Array.isArray(ownerGame.enemies)) {
            for (let i = 0; i < ownerGame.enemies.length; i++) {
                drawOne(ownerGame.enemies[i], 'rgba(239, 68, 68, 1)');
            }
        }
        ctx.restore();
    }

    function getUnitHitScore(u, wx, wy) {
        if (!u || u.dead) return Number.POSITIVE_INFINITY;
        const unitY = getUnitVisualY(u);
        const cx = Number(u.x) || 0;
        const unitCategory = String((u.stats && u.stats.category) || '').trim().toLowerCase();
        const unitType = String((u.stats && u.stats.type) || '').trim().toLowerCase();
        const isInfantryLike = (unitCategory === 'infantry' || unitType === 'bio');
        const isAir = unitType === 'air';
        const isArmoredLike = (unitCategory === 'armored' || unitType === 'mech');
        const renderScale = getUnitHitRenderScale(u);
        const zoom = (typeof Camera !== 'undefined' && Number.isFinite(Number(Camera.zoom)) && Number(Camera.zoom) > 0)
            ? Number(Camera.zoom)
            : 1;
        const h = Math.max(1, Number(u.height) || 1) * renderScale * (isInfantryLike ? 1.35 : 1);
        const cy = isInfantryLike
            ? (unitY - (h * 0.88))
            : (isAir
                ? (unitY - (h * 0.46))
                : (isArmoredLike ? (unitY - (h * 0.44)) : (unitY - (h * 0.55))));
        const dx = (Number(wx) || 0) - cx;
        const dy = (Number(wy) || 0) - cy;
        const score = (dx * dx) + (dy * dy);
        if (!isInfantryLike) {
            const sizeBias = Math.min(
                2600,
                Math.max(0, (Number(u.width) || 0) * (Number(u.height) || 0) * renderScale * 0.3)
            );
            return score - sizeBias;
        }
        const headLockR = (isCoarseLikePointer() ? 54 : 38) / zoom;
        if (score <= (headLockR * headLockR)) {
            // Strongly favor infantry when pointer is on/near head.
            return (score * 0.35) - 2400;
        }
        return score - 420;
    }

    // ============================================
    // D) ?좊떅???ш컖???댁뿉 ?덈뒗吏 泥댄겕
    // ============================================
    function isUnitInRect(u, x1, y1, x2, y2) {
        if (!u || u.dead) return false;
        const unitY = getUnitVisualY(u);
        const isInfantryLike = isInfantryLikeUnit(u);

        // ?ш컖???뺢퇋??
        const left = Math.min(x1, x2);
        const right = Math.max(x1, x2);
        const top = Math.min(y1, y2);
        const bottom = Math.max(y1, y2);

        // ?좊떅 諛붿슫??諛뺤뒪
        const bodyW = Number(u.width || 0) * (isInfantryLike ? 1.25 : 1);
        const bodyH = Number(u.height || 0) * (isInfantryLike ? 1.45 : 1);
        const uLeft = u.x - bodyW / 2;
        const uRight = u.x + bodyW / 2;
        const uTop = unitY - bodyH;
        const uBottom = unitY + (isInfantryLike ? 8 : 0);

        // 援먯쭛??泥댄겕
        return !(uRight < left || uLeft > right || uBottom < top || uTop > bottom);
    }

    // ============================================
    // E) 紐⑺몴 吏???좊떅 泥댄겕 (?좏깮 遺덇? ?좊떅)
    // ============================================
    function isLockedUnit(u) {
        if (!u || !u.stats) return false;

        const lockedTypes = ['tactical_drone', 'stealth_drone'];
        if (lockedTypes.includes(u.stats.id)) {
            if (u.targetX !== null && u.targetX !== undefined) return true;
            if (u.lockedTarget) return true;
        }

        return false;
    }

    function getSelectionPickUid(u) {
        if (!u || typeof u !== 'object') return 0;
        const current = Number(u._selectionPickUid);
        if (Number.isFinite(current) && current > 0) return current;
        const seq = Number(game._selectionPickUidSeq);
        const nextSeq = (Number.isFinite(seq) && seq > 0) ? (seq + 1) : 1;
        game._selectionPickUidSeq = nextSeq;
        u._selectionPickUid = nextSeq;
        return nextSeq;
    }

    function collectPlayerHitCandidates(ownerGame, wx, wy, opts = null) {
        const options = (opts && typeof opts === 'object') ? opts : {};
        const coarseLike = (typeof options.coarseLike === 'boolean')
            ? options.coarseLike
            : isCoarseLikePointer();
        const includeSoft = options.includeSoft !== false;
        const includeNear = options.includeNear !== false;
        const includeFarNear = options.includeFarNear !== false;
        const preferNearest = !!options.preferNearest;
        const ignoreUnit = options.ignoreUnit || null;
        const nearPxRaw = Number(options.nearPx);
        const nearPx = (Number.isFinite(nearPxRaw) && nearPxRaw > 0)
            ? nearPxRaw
            : (coarseLike ? 20 : 16);
        const forcedNearRadiusPxRaw = Number(options.forceNearRadiusPx);
        const forcedNearRadiusPx = (Number.isFinite(forcedNearRadiusPxRaw) && forcedNearRadiusPxRaw > 0)
            ? forcedNearRadiusPxRaw
            : null;
        const list = Array.isArray(ownerGame && ownerGame.players) ? ownerGame.players : [];
        const hitCandidates = [];

        for (let i = 0; i < list.length; i++) {
            const u = list[i];
            if (!u || u.dead || u === ignoreUnit) continue;
            if (!isUnitHit(u, wx, wy)) continue;
            hitCandidates.push(u);
        }

        if (hitCandidates.length === 0 && coarseLike && includeSoft) {
            for (let i = 0; i < list.length; i++) {
                const u = list[i];
                if (!u || u.dead || u === ignoreUnit) continue;
                if (!isUnitHit(u, wx, wy, true)) continue;
                hitCandidates.push(u);
            }
        }

        if (hitCandidates.length === 0 && includeNear) {
            for (let i = 0; i < list.length; i++) {
                const u = list[i];
                if (!u || u.dead || u === ignoreUnit) continue;
                if (!isNearUnitHitbox(u, wx, wy, nearPx)) continue;
                hitCandidates.push(u);
            }
        }

        if (hitCandidates.length === 0 && includeFarNear) {
            const zoom = (typeof Camera !== 'undefined' && Number.isFinite(Number(Camera.zoom)) && Number(Camera.zoom) > 0)
                ? Number(Camera.zoom)
                : 1;
            const nearPickRadius = (
                (forcedNearRadiusPx != null)
                    ? forcedNearRadiusPx
                    : (coarseLike ? 120 : 80)
            ) / zoom;
            const nearPickRadiusSq = nearPickRadius * nearPickRadius;
            let nearest = null;
            let nearestScore = Number.POSITIVE_INFINITY;
            for (let i = 0; i < list.length; i++) {
                const u = list[i];
                if (!u || u.dead || u === ignoreUnit) continue;
                const score = getUnitHitScore(u, wx, wy);
                if (!Number.isFinite(score)) continue;
                if (score < nearestScore) {
                    nearestScore = score;
                    nearest = u;
                }
            }
            if (nearest && nearestScore <= nearPickRadiusSq) {
                hitCandidates.push(nearest);
            }
        }

        if (preferNearest || coarseLike) {
            hitCandidates.sort((a, b) => {
                const sa = getUnitHitScore(a, wx, wy);
                const sb = getUnitHitScore(b, wx, wy);
                if (Math.abs(sa - sb) > 0.01) return sa - sb;
                return getUnitRenderY(b) - getUnitRenderY(a);
            });
        } else {
            hitCandidates.sort((a, b) => getUnitRenderY(b) - getUnitRenderY(a));
        }

        return { candidates: hitCandidates, coarseLike };
    }

    function getClientProjectionMetrics(ownerGame) {
        const wrapper = document.getElementById('game-wrapper');
        const rect = wrapper
            ? wrapper.getBoundingClientRect()
            : (ownerGame && ownerGame.canvas && typeof ownerGame.canvas.getBoundingClientRect === 'function'
                ? ownerGame.canvas.getBoundingClientRect()
                : null);
        if (!rect) return null;
        const viewW = Math.max(1, Number(ownerGame && ownerGame.width) || 1);
        const viewH = Math.max(1, Number(ownerGame && ownerGame.height) || 1);
        const scaleX = Math.max(0.0001, rect.width / viewW);
        const scaleY = Math.max(0.0001, rect.height / viewH);
        const zoom = (typeof Camera !== 'undefined' && Number.isFinite(Number(Camera.zoom)) && Number(Camera.zoom) > 0)
            ? Number(Camera.zoom)
            : 1;
        const pivotRaw = (ownerGame && typeof ownerGame.getCameraPivotY === 'function')
            ? Number(ownerGame.getCameraPivotY())
            : Number(ownerGame && ownerGame.groundY);
        const pivotY = Number.isFinite(pivotRaw) ? pivotRaw : Number(ownerGame && ownerGame.groundY || 0);
        const cameraX = Number(ownerGame && ownerGame.cameraX) || 0;
        return { rect, scaleX, scaleY, zoom, pivotY, cameraX };
    }

    function worldToClientX(wx, metrics) {
        if (!metrics) return Number.NaN;
        return Number(metrics.rect.left) + (((Number(wx) || 0) - Number(metrics.cameraX)) * Number(metrics.zoom) * Number(metrics.scaleX));
    }

    function worldToClientY(wy, metrics) {
        if (!metrics) return Number.NaN;
        const y = Number(wy) || 0;
        const viewY = Number(metrics.pivotY) + ((y - Number(metrics.pivotY)) * Number(metrics.zoom));
        return Number(metrics.rect.top) + (viewY * Number(metrics.scaleY));
    }

    function clientRectDistSq(cx, cy, left, right, top, bottom) {
        const dx = (cx < left) ? (left - cx) : ((cx > right) ? (cx - right) : 0);
        const dy = (cy < top) ? (top - cy) : ((cy > bottom) ? (cy - bottom) : 0);
        return (dx * dx) + (dy * dy);
    }

    function isClientHitProjectedProfile(ownerGame, u, clientX, clientY, opts = null) {
        if (!u || u.dead) return false;
        const options = (opts && typeof opts === 'object') ? opts : {};
        const metrics = options.metrics || getClientProjectionMetrics(ownerGame);
        if (!metrics) return false;
        const soft = !!options.soft;
        const nearPx = Math.max(0, Number(options.nearPx) || 0);
        const cx = Number(clientX);
        const cy = Number(clientY);
        if (!Number.isFinite(cx) || !Number.isFinite(cy)) return false;
        const profile = getUnitClientHitProfile(ownerGame, u, soft, metrics);
        if (!profile) return false;

        const left = Math.min(profile.left, profile.right);
        const right = Math.max(profile.left, profile.right);
        const top = Math.min(profile.top, profile.bottom);
        const bottom = Math.max(profile.top, profile.bottom);
        const inMain = (cx >= left && cx <= right && cy >= top && cy <= bottom);
        if (inMain) return true;

        if (profile.footBand) {
            const footLeft = Math.min(profile.footBand.left, profile.footBand.right);
            const footRight = Math.max(profile.footBand.left, profile.footBand.right);
            const footTop = Math.min(profile.footBand.top, profile.footBand.bottom);
            const footBottom = Math.max(profile.footBand.top, profile.footBand.bottom);
            const inFoot = (cx >= footLeft && cx <= footRight && cy >= footTop && cy <= footBottom);
            if (inFoot) return true;
        }
        if (profile.groundBand) {
            const groundLeft = Math.min(profile.groundBand.left, profile.groundBand.right);
            const groundRight = Math.max(profile.groundBand.left, profile.groundBand.right);
            const groundTop = Math.min(profile.groundBand.top, profile.groundBand.bottom);
            const groundBottom = Math.max(profile.groundBand.top, profile.groundBand.bottom);
            const inGround = (cx >= groundLeft && cx <= groundRight && cy >= groundTop && cy <= groundBottom);
            if (inGround) return true;
        }

        if (nearPx <= 0.001) return false;
        let minDistSq = clientRectDistSq(cx, cy, left, right, top, bottom);
        if (profile.footBand) {
            const footLeft = Math.min(profile.footBand.left, profile.footBand.right);
            const footRight = Math.max(profile.footBand.left, profile.footBand.right);
            const footTop = Math.min(profile.footBand.top, profile.footBand.bottom);
            const footBottom = Math.max(profile.footBand.top, profile.footBand.bottom);
            const footDistSq = clientRectDistSq(cx, cy, footLeft, footRight, footTop, footBottom);
            if (footDistSq < minDistSq) minDistSq = footDistSq;
        }
        if (profile.groundBand) {
            const groundLeft = Math.min(profile.groundBand.left, profile.groundBand.right);
            const groundRight = Math.max(profile.groundBand.left, profile.groundBand.right);
            const groundTop = Math.min(profile.groundBand.top, profile.groundBand.bottom);
            const groundBottom = Math.max(profile.groundBand.top, profile.groundBand.bottom);
            const groundDistSq = clientRectDistSq(cx, cy, groundLeft, groundRight, groundTop, groundBottom);
            if (groundDistSq < minDistSq) minDistSq = groundDistSq;
        }
        return minDistSq <= (nearPx * nearPx);
    }

    function getUnitClientPickScore(ownerGame, u, clientX, clientY, metrics = null) {
        if (!u || u.dead) return Number.POSITIVE_INFINITY;
        const m = metrics || getClientProjectionMetrics(ownerGame);
        if (!m) return Number.POSITIVE_INFINITY;
        const unitX = Number(u.x) || 0;
        const unitY = getUnitVisualY(u);
        const sx = worldToClientX(unitX, m);
        const sy = worldToClientY(unitY, m);
        const dx = (Number(clientX) || 0) - sx;
        const dy = (Number(clientY) || 0) - sy;
        return (dx * dx) + (dy * dy);
    }

    function collectPlayerClientHitCandidates(ownerGame, clientX, clientY, opts = null) {
        const options = (opts && typeof opts === 'object') ? opts : {};
        const coarseLike = (typeof options.coarseLike === 'boolean')
            ? options.coarseLike
            : isCoarseLikePointer();
        const includeSoft = options.includeSoft !== false;
        const includeNear = options.includeNear !== false;
        const includeFarNear = options.includeFarNear !== false;
        const preferNearest = !!options.preferNearest;
        const ignoreUnit = options.ignoreUnit || null;
        const nearPxRaw = Number(options.nearPx);
        const nearPx = (Number.isFinite(nearPxRaw) && nearPxRaw > 0)
            ? nearPxRaw
            : (coarseLike ? 20 : 16);
        const forcedNearRadiusPxRaw = Number(options.forceNearRadiusPx);
        const forcedNearRadiusPx = (Number.isFinite(forcedNearRadiusPxRaw) && forcedNearRadiusPxRaw > 0)
            ? forcedNearRadiusPxRaw
            : null;
        const list = Array.isArray(ownerGame && ownerGame.players) ? ownerGame.players : [];
        const hitCandidates = [];
        const metrics = getClientProjectionMetrics(ownerGame);
        if (!metrics) return { candidates: hitCandidates, coarseLike };

        for (let i = 0; i < list.length; i++) {
            const u = list[i];
            if (!u || u.dead || u === ignoreUnit) continue;
            if (!isClientHitProjectedProfile(ownerGame, u, clientX, clientY, { metrics, soft: false, nearPx: 0 })) continue;
            hitCandidates.push(u);
        }

        if (hitCandidates.length === 0 && coarseLike && includeSoft) {
            for (let i = 0; i < list.length; i++) {
                const u = list[i];
                if (!u || u.dead || u === ignoreUnit) continue;
                if (!isClientHitProjectedProfile(ownerGame, u, clientX, clientY, { metrics, soft: true, nearPx: 0 })) continue;
                hitCandidates.push(u);
            }
        }

        if (hitCandidates.length === 0 && includeNear) {
            for (let i = 0; i < list.length; i++) {
                const u = list[i];
                if (!u || u.dead || u === ignoreUnit) continue;
                if (!isClientHitProjectedProfile(ownerGame, u, clientX, clientY, { metrics, soft: false, nearPx })) continue;
                hitCandidates.push(u);
            }
        }

        if (hitCandidates.length === 0 && includeFarNear) {
            const nearPickRadius = (
                (forcedNearRadiusPx != null)
                    ? forcedNearRadiusPx
                    : (coarseLike ? 120 : 80)
            );
            const nearPickRadiusSq = nearPickRadius * nearPickRadius;
            let nearest = null;
            let nearestScore = Number.POSITIVE_INFINITY;
            for (let i = 0; i < list.length; i++) {
                const u = list[i];
                if (!u || u.dead || u === ignoreUnit) continue;
                const score = getUnitClientPickScore(ownerGame, u, clientX, clientY, metrics);
                if (!Number.isFinite(score)) continue;
                if (score < nearestScore) {
                    nearestScore = score;
                    nearest = u;
                }
            }
            if (nearest && nearestScore <= nearPickRadiusSq) {
                hitCandidates.push(nearest);
            }
        }

        if (preferNearest || coarseLike) {
            hitCandidates.sort((a, b) => {
                const sa = getUnitClientPickScore(ownerGame, a, clientX, clientY, metrics);
                const sb = getUnitClientPickScore(ownerGame, b, clientX, clientY, metrics);
                if (Math.abs(sa - sb) > 0.01) return sa - sb;
                return getUnitRenderY(b) - getUnitRenderY(a);
            });
        } else {
            hitCandidates.sort((a, b) => getUnitRenderY(b) - getUnitRenderY(a));
        }

        return { candidates: hitCandidates, coarseLike };
    }

    const unitHitTestApi = {
        getProfile(u, soft = false) {
            return getUnitHitProfile(u, !!soft);
        },
        hit(u, wx, wy, soft = false) {
            return isUnitHit(u, wx, wy, !!soft);
        },
        hover(u, wx, wy) {
            return isUnitHoverHit(u, wx, wy);
        },
        near(u, wx, wy, nearPx = 16) {
            return isNearUnitHitbox(u, wx, wy, nearPx);
        },
        score(u, wx, wy) {
            return getUnitHitScore(u, wx, wy);
        },
        getPlayerUnitAt(wx, wy, opts = null) {
            const picked = collectPlayerHitCandidates(game, wx, wy, opts);
            return (picked.candidates.length > 0) ? picked.candidates[0] : null;
        },
        getPlayerUnitAtClient(clientX, clientY, opts = null) {
            const picked = collectPlayerClientHitCandidates(game, clientX, clientY, opts);
            return (picked.candidates.length > 0) ? picked.candidates[0] : null;
        },
        hasPlayerUnitAt(wx, wy, ignoreUnit = null, opts = null) {
            const options = Object.assign({}, (opts && typeof opts === 'object') ? opts : {});
            options.ignoreUnit = ignoreUnit;
            return !!this.getPlayerUnitAt(wx, wy, options);
        },
        hasPlayerUnitAtClient(clientX, clientY, ignoreUnit = null, opts = null) {
            const options = Object.assign({}, (opts && typeof opts === 'object') ? opts : {});
            options.ignoreUnit = ignoreUnit;
            return !!this.getPlayerUnitAtClient(clientX, clientY, options);
        }
    };
    game._unitHitTest = unitHitTestApi;

    // ============================================
    // F) game.checkUnitClick 援ы쁽 (?⑥씪 ?대┃ ?좉?)
    // ============================================
    game.checkUnitClick = function (wx, wy, opts = null) {
        const keepSelectedOnRepeatTap = !!(opts && opts.keepSelectedOnRepeatTap);
        const preferNearestHit = !!(opts && opts.preferNearestHit);
        const singleSelect = !!(opts && opts.singleSelect);
        const forcedNearRadiusPxRaw = Number(opts && opts.forceNearRadiusPx);
        const forcedNearRadiusPx = (Number.isFinite(forcedNearRadiusPxRaw) && forcedNearRadiusPxRaw > 0)
            ? forcedNearRadiusPxRaw
            : null;
        const clientX = Number(opts && opts.clientX);
        const clientY = Number(opts && opts.clientY);
        const hasClientPoint = Number.isFinite(clientX) && Number.isFinite(clientY);
        const hitCandidates = [];
        let coarseLike = isCoarseLikePointer();
        if (hasClientPoint) {
            const clientCollected = collectPlayerClientHitCandidates(this, clientX, clientY, {
                coarseLike: coarseLike,
                includeSoft: true,
                includeNear: true,
                includeFarNear: true,
                preferNearest: preferNearestHit,
                forceNearRadiusPx: forcedNearRadiusPx,
                ignoreUnit: null
            });
            coarseLike = clientCollected.coarseLike;
            if (clientCollected.candidates.length > 0) {
                hitCandidates.push(...clientCollected.candidates);
            }
        } else {
            const worldCollected = collectPlayerHitCandidates(this, wx, wy, {
                coarseLike: coarseLike,
                includeSoft: true,
                includeNear: true,
                includeFarNear: true,
                preferNearest: preferNearestHit,
                forceNearRadiusPx: forcedNearRadiusPx,
                ignoreUnit: null
            });
            coarseLike = worldCollected.coarseLike;
            if (worldCollected.candidates.length > 0) {
                hitCandidates.push(...worldCollected.candidates);
            }
        }

        // Overlap-cycle: repeated taps/clicks near the same stack cycle through candidates.
        if (singleSelect && keepSelectedOnRepeatTap && hitCandidates.length > 1) {
            const now = (typeof performance !== 'undefined' && performance.now)
                ? performance.now()
                : Date.now();
            const state = (this._selectionCycleState && typeof this._selectionCycleState === 'object')
                ? this._selectionCycleState
                : null;
            const cycleTol = coarseLike ? 58 : 36;
            const cycleWindowMs = coarseLike ? 1600 : 1200;
            const key = hitCandidates.map((u) => String(getSelectionPickUid(u))).join(',');

            let pickIndex = 0;
            if (
                state
                && state.key === key
                && Math.abs((Number(wx) || 0) - (Number(state.wx) || 0)) <= cycleTol
                && Math.abs((Number(wy) || 0) - (Number(state.wy) || 0)) <= cycleTol
                && (now - (Number(state.at) || 0)) <= cycleWindowMs
            ) {
                pickIndex = ((Number(state.index) || 0) + 1) % hitCandidates.length;
            }
            this._selectionCycleState = {
                key,
                wx: Number(wx) || 0,
                wy: Number(wy) || 0,
                at: now,
                index: pickIndex
            };
            if (pickIndex > 0 && pickIndex < hitCandidates.length) {
                const picked = hitCandidates.splice(pickIndex, 1)[0];
                if (picked) hitCandidates.unshift(picked);
            }
        } else {
            // Reset cycle when target stack changes or non-single-select path is used.
            this._selectionCycleState = null;
        }

        let lockedHit = false;
        const nearPickPx = coarseLike ? 20 : 16;
        const allowSoftHit = coarseLike;
        const clientMetrics = hasClientPoint ? getClientProjectionMetrics(this) : null;
        const useClientValidation = !!(hasClientPoint && clientMetrics);
        for (let i = 0; i < hitCandidates.length; i++) {
            const u = hitCandidates[i];
            const strictHit = isUnitHit(u, wx, wy);
            const softHit = allowSoftHit && isUnitHit(u, wx, wy, true);
            const nearHit = isNearUnitHitbox(u, wx, wy, nearPickPx);
            const clientStrictHit = useClientValidation && isClientHitProjectedProfile(this, u, clientX, clientY, {
                metrics: clientMetrics, soft: false, nearPx: 0
            });
            const clientSoftHit = useClientValidation && allowSoftHit && isClientHitProjectedProfile(this, u, clientX, clientY, {
                metrics: clientMetrics, soft: true, nearPx: 0
            });
            const clientNearHit = useClientValidation && isClientHitProjectedProfile(this, u, clientX, clientY, {
                metrics: clientMetrics, soft: false, nearPx: nearPickPx
            });
            const validHit = useClientValidation
                ? (clientStrictHit || clientSoftHit || clientNearHit)
                : (strictHit || softHit || nearHit);
            if (!validHit) continue;

            if (isLockedUnit(u)) {
                lockedHit = true;
                continue;
            }

            const clickedEligible = !!(
                typeof this.isDirectControlEligible === 'function'
                && this.isDirectControlEligible(u)
            );
            const keepOnRepeat = keepSelectedOnRepeatTap || clickedEligible;

            if (singleSelect) {
                const wasSingleSelected = this.selectedUnits.size === 1 && this.selectedUnits.has(u);
                const wasSelected = this.selectedUnits.has(u);
                this.selectedUnits.forEach((sel) => {
                    if (sel && sel !== u) sel.isSelected = false;
                });
                if (!wasSingleSelected) {
                    this.selectedUnits.clear();
                    this.selectedUnits.add(u);
                }
                u.isSelected = true;
                u.commandMode = 'stop';
                u.returnToBase = false;
                const uid = u.stats ? u.stats.id : null;
                const heliIds = ['apache', 'blackhawk', 'uh60', 'chinook'];
                if (!wasSelected && uid && heliIds.includes(uid) && typeof AudioSystem !== 'undefined') {
                    AudioSystem.playSFX('helicopter_select', u.x);
                }
            } else if (this.selectedUnits.has(u)) {
                if (!keepOnRepeat) {
                    this.selectedUnits.delete(u);
                    u.isSelected = false;
                }
            } else {
                this.selectedUnits.add(u);
                u.isSelected = true;
                u.commandMode = 'stop';
                u.returnToBase = false;
                const uid = u.stats ? u.stats.id : null;
                const heliIds = ['apache', 'blackhawk', 'uh60', 'chinook'];
                if (uid && heliIds.includes(uid) && typeof AudioSystem !== 'undefined') {
                    AudioSystem.playSFX('helicopter_select', u.x);
                }
            }

            if (typeof app !== 'undefined') app.markUiDirty();

            const shouldAutoStartDirectControl = !!(
                this.selectedUnits
                && this.selectedUnits.has(u)
                && typeof this.startDirectControl === 'function'
                && clickedEligible
            );
            if (shouldAutoStartDirectControl) {
                this.startDirectControl(u);
            }

            // [NEW] Update HUD selection display
            if (typeof this.updateHUDSelection === 'function') {
                this.updateHUDSelection();
            }

            return u;
        }

        if (lockedHit) {
            ui.showToast('목표가 지정된 유닛은 조작할 수 없습니다.');
            return true;
        }

        return false;
    };

    // ============================================
    // G) game.selectUnitsInRect 援ы쁽 (?쒕옒洹?諛뺤뒪 ?좏깮)
    // ============================================
    game.selectUnitsInRect = function () {
        const x1 = this.selectStartX;
        const y1 = this.selectStartY;
        const x2 = this.selectEndX;
        const y2 = this.selectEndY;

        // 기존 선택 해제 (명령은 유지)
        this.selectedUnits.forEach(u => {
            u.isSelected = false;
        });
        this.selectedUnits.clear();

        // 박스 내 유닛 선택
        for (const u of this.players) {
            if (isLockedUnit(u)) continue;
            if (!isUnitInRect(u, x1, y1, x2, y2)) continue;
            this.selectedUnits.add(u);
            u.isSelected = true;
        }

        if (this.selectedUnits.size > 0) {
            ui.showToast(`${this.selectedUnits.size}개 유닛 선택`);
        }

        if (typeof app !== 'undefined') app.markUiDirty();

        // [NEW] Update HUD selection display
        if (typeof this.updateHUDSelection === 'function') {
            this.updateHUDSelection();
        }
    };

    // ============================================
    // H) game.clearAllSelection 援ы쁽 (?꾩껜 ?좏깮 痍⑥냼)
    // ============================================
    game.clearAllSelection = function () {
        this.selectedUnits.forEach(u => {
            u.isSelected = false;
            // commandMode ?좎? (?뺤? ?곹깭硫??뺤? ?좎?)
        });
        this.selectedUnits.clear();

        if (typeof app !== 'undefined') app.markUiDirty();

        // [NEW] Update HUD selection display
        if (typeof this.updateHUDSelection === 'function') {
            this.updateHUDSelection();
        }
    };

    // ============================================
    // H-2) game.toggleCmdPanel 援ы쁽 (?⑤꼸 ?닿퀬 ?リ린)
    // ============================================
    game.toggleCmdPanel = function (e) {
        if (e) { e.stopPropagation(); e.preventDefault(); }
        const cmdActions = document.getElementById('cmd-actions');
        if (!cmdActions) return;
        cmdActions.classList.toggle('hidden');
    };

    // ============================================
    // I) Command panel button wiring (multi-select apply)
    // ============================================
    function setupCommandPanel() {
        const panel = document.getElementById('unit-cmd-panel');
        if (!panel) return;

        const btns = panel.querySelectorAll('button[data-cmd]');
        btns.forEach(btn => {
            btn.addEventListener('click', function (e) {
                e.stopPropagation();
                const cmd = this.dataset.cmd;

                // [RECON] 정찰: 전력 분석 모달 열기 (명령모드로 흘리지 않음)
                if (cmd === 'recon') {
                    if (typeof game.toggleScope === 'function') game.toggleScope();
                    if (typeof ui !== 'undefined' && typeof ui.showToast === 'function') {
                        ui.showToast('적군 전력 분석');
                    }
                    btns.forEach(b => b.classList.remove('active'));
                    this.classList.add('active');
                    return;
                }

                // [FIX] move command enters targeting mode (click ground to set destination)
                if (cmd === 'move') {
                    if (typeof game.prepareMoveCommand === 'function') {
                        game.prepareMoveCommand();
                    }
                    btns.forEach(b => b.classList.remove('active'));
                    this.classList.add('active');
                    return;
                }

                // [NEW] smoke grenade targeting (special forces only)
                if (cmd === 'smoke') {
                    if (typeof game.prepareSmokeCommand === 'function') {
                        game.prepareSmokeCommand();
                    }
                    if (game.targetingType === '__smoke__') {
                        btns.forEach(b => b.classList.remove('active'));
                        this.classList.add('active');
                    }
                    return;
                }

                // [NEW] medkit immediate heal command
                if (cmd === 'medkit') {
                    if (typeof game.useMedkitCommand === 'function') {
                        game.useMedkitCommand();
                    }
                    return;
                }

                if (cmd === 'bagpipe') {
                    if (typeof game.useBagpipeCommand === 'function') {
                        game.useBagpipeCommand();
                    }
                    return;
                }

                // [NEW] transport drop command
                if (cmd === 'drop') {
                    if (typeof game.prepareDropCommand === 'function') {
                        game.prepareDropCommand();
                    }
                    if (game.targetingType === '__drop__') {
                        btns.forEach(b => b.classList.remove('active'));
                        this.classList.add('active');
                    }
                    return;
                }

                // [NEW] fighter jet missile command
                if (cmd === 'missile') {
                    if (typeof game.prepareMissileCommand === 'function') {
                        game.prepareMissileCommand();
                    }
                    if (game.targetingType === '__missile__') {
                        btns.forEach(b => b.classList.remove('active'));
                        this.classList.add('active');
                    }
                    return;
                }

                // [NEW] camera lock toggle
                if (cmd === 'camera') {
                    if (typeof game.toggleCameraLock === 'function') {
                        game.toggleCameraLock();
                    }
                    if (typeof game.updateHUDSelection === 'function') {
                        game.updateHUDSelection();
                    }
                    return;
                }

                // [P0-3] retreat = 드론 복귀(회수) 통합
                if (cmd === 'retreat') {
                    let droneRecalled = false;

                    // 1순위: 선택된 드론 복귀
                    game.selectedUnits.forEach(u => {
                        if (u && !u.dead && (u.stats?.id === 'drone_suicide' || u.stats?.id === 'drone_at' || u.stats?.category === 'drone')) {
                            if (typeof game.requestDroneRecall === 'function') {
                                game.requestDroneRecall(u);
                                droneRecalled = true;
                            }
                        }
                    });

                    // 2순위: 선택된 드론병의 ownedDrone 복귀
                    if (!droneRecalled) {
                        game.selectedUnits.forEach(u => {
                            if (u && !u.dead && u.stats?.operator) {
                                const owned = (typeof game.getAliveOperatorDrones === 'function')
                                    ? game.getAliveOperatorDrones(u)
                                    : ((u.ownedDrone && !u.ownedDrone.dead) ? [u.ownedDrone] : []);
                                if (typeof game.requestDroneRecall === 'function') {
                                    owned.forEach(d => {
                                        if (game.requestDroneRecall(d)) droneRecalled = true;
                                    });
                                }
                            }
                        });
                    }

                    // 3순위: 일반 유닛 후퇴
                    if (!droneRecalled) {
                        game.selectedUnits.forEach(u => {
                            if (!u.dead) {
                                if (typeof setDirectControlReleaseHold === 'function') {
                                    setDirectControlReleaseHold(u, false);
                                }
                                u.commandMode = 'retreat';
                                u.returnToBase = true;
                                u.targetX = null;
                                u.targetY = null;
                                u.attackTarget = null;
                            }
                        });
                    }

                    btns.forEach(b => b.classList.remove('active'));
                    this.classList.add('active');
                    return;
                }

                // (기존: stop/attack 등은 바로 적용)
                game.selectedUnits.forEach(u => {
                    if (!u.dead) {
                        if (cmd !== 'stop') {
                            if (typeof setDirectControlReleaseHold === 'function') {
                                setDirectControlReleaseHold(u, false);
                            }
                        }
                        if (cmd === 'stop'
                            && typeof game.isDirectControlActive === 'function'
                            && game.isDirectControlActive()
                            && typeof game.getDirectControlUnit === 'function'
                            && game.getDirectControlUnit() === u
                            && typeof setDirectControlReleaseHold === 'function') {
                            setDirectControlReleaseHold(u, true);
                        }
                        u.commandMode = cmd;
                        if (cmd === 'stop' || cmd === 'attack') {
                            u.targetX = null;
                            u.targetY = null;
                        }
                    }
                });

                btns.forEach(b => b.classList.remove('active'));
                this.classList.add('active');
            });
        });

        const clearBtn = document.getElementById('clear-units-btn');
        if (clearBtn) {
            clearBtn.addEventListener('click', function (e) {
                e.stopPropagation();
                game.clearAllSelection();
            });
        }

        const layoutToggle = document.getElementById('cmd-layout-toggle');
        const cmdActions = document.getElementById('cmd-actions');
        const cmdPanel = document.getElementById('unit-cmd-panel');
        if (layoutToggle && cmdActions && cmdPanel) {
            layoutToggle.addEventListener('click', function (e) {
                e.preventDefault();
                e.stopPropagation();
                const isRow = cmdActions.classList.toggle('is-row');
                cmdPanel.classList.toggle('is-horizontal', isRow);
                layoutToggle.textContent = isRow ? '\u2194' : '\u2195';
            });
        }

        const wrapper = document.getElementById('unit-cmd-wrapper');
        const handle = document.getElementById('cmd-panel-toggle');
        if (!wrapper || !handle) return;

        let dragging = false;
        let dragMoved = false;
        let startX = 0;
        let startY = 0;
        let baseLeft = 0;
        let baseTop = 0;

        const clamp = (v, min, max) => Math.max(min, Math.min(v, max));

        const beginDrag = (clientX, clientY) => {
            const rect = wrapper.getBoundingClientRect();
            wrapper.style.left = `${rect.left}px`;
            wrapper.style.top = `${rect.top}px`;
            wrapper.style.right = 'auto';
            wrapper.style.bottom = 'auto';
            wrapper.style.position = 'fixed';
            baseLeft = rect.left;
            baseTop = rect.top;
            startX = clientX;
            startY = clientY;
            dragging = true;
            dragMoved = false;
        };

        const updateDrag = (clientX, clientY) => {
            if (!dragging) return;
            const dx = clientX - startX;
            const dy = clientY - startY;
            if (Math.abs(dx) + Math.abs(dy) > 3) dragMoved = true;
            const rect = wrapper.getBoundingClientRect();
            const maxLeft = window.innerWidth - rect.width;
            const maxTop = window.innerHeight - rect.height;
            const nextLeft = clamp(baseLeft + dx, 0, maxLeft);
            const nextTop = clamp(baseTop + dy, 0, maxTop);
            wrapper.style.left = `${nextLeft}px`;
            wrapper.style.top = `${nextTop}px`;
        };

        const endDrag = () => {
            dragging = false;
        };

        handle.addEventListener('mousedown', (e) => {
            if (!e.target.closest('#cmd-panel-toggle')) return;
            beginDrag(e.clientX, e.clientY);
        });

        window.addEventListener('mousemove', (e) => {
            updateDrag(e.clientX, e.clientY);
        });

        window.addEventListener('mouseup', () => {
            endDrag();
        });

        handle.addEventListener('touchstart', (e) => {
            if (!e.touches[0]) return;
            if (!e.target.closest('#cmd-panel-toggle')) return;
            e.preventDefault();
            beginDrag(e.touches[0].clientX, e.touches[0].clientY);
        }, { passive: false });

        window.addEventListener('touchmove', (e) => {
            if (!dragging) return;
            if (!e.touches[0]) return;
            e.preventDefault();
            updateDrag(e.touches[0].clientX, e.touches[0].clientY);
        }, { passive: false });

        window.addEventListener('touchend', () => {
            if (!dragging) return;
            if (!dragMoved) handle.click();
            endDrag();
        });

        handle.addEventListener('click', (e) => {
            if (dragMoved) {
                e.preventDefault();
                e.stopPropagation();
                dragMoved = false;
            }
        });
    }

    function setupHudCtrlPanel() {
        const wrapper = document.getElementById('hud-ctrl-wrapper');
        const handle = document.getElementById('hud-ctrl-toggle');
        const controls = document.getElementById('hud-ctrl-body');
        if (!wrapper || !handle || !controls) return;

        let dragging = false;
        let dragMoved = false;
        let startX = 0;
        let startY = 0;
        let baseLeft = 0;
        let baseTop = 0;

        const clamp = (v, min, max) => Math.max(min, Math.min(v, max));

        const beginDrag = (clientX, clientY) => {
            const rect = wrapper.getBoundingClientRect();
            wrapper.style.left = `${rect.left}px`;
            wrapper.style.top = `${rect.top}px`;
            wrapper.style.right = 'auto';
            wrapper.style.bottom = 'auto';
            wrapper.style.position = 'fixed';
            baseLeft = rect.left;
            baseTop = rect.top;
            startX = clientX;
            startY = clientY;
            dragging = true;
            dragMoved = false;
        };

        const updateDrag = (clientX, clientY) => {
            if (!dragging) return;
            const dx = clientX - startX;
            const dy = clientY - startY;
            if (!dragMoved && Math.abs(dx) + Math.abs(dy) <= 6) return;
            if (Math.abs(dx) + Math.abs(dy) > 6) dragMoved = true;
            const rect = wrapper.getBoundingClientRect();
            const maxLeft = window.innerWidth - rect.width;
            const maxTop = window.innerHeight - rect.height;
            const nextLeft = clamp(baseLeft + dx, 0, maxLeft);
            const nextTop = clamp(baseTop + dy, 0, maxTop);
            wrapper.style.left = `${nextLeft}px`;
            wrapper.style.top = `${nextTop}px`;
        };

        const endDrag = () => { dragging = false; };

        const toggleControls = (e) => {
            if (e) { e.preventDefault(); e.stopPropagation(); }
            const isHidden = controls.classList.toggle('hidden');
            handle.textContent = isHidden ? '\u2795' : '\uD83C\uDF9B';
        };

        handle.addEventListener('click', (e) => {
            if (dragMoved) {
                e.preventDefault();
                e.stopPropagation();
                dragMoved = false;
                return;
            }
            toggleControls(e);
        });

        handle.addEventListener('mousedown', (e) => {
            beginDrag(e.clientX, e.clientY);
        });

        window.addEventListener('mousemove', (e) => {
            updateDrag(e.clientX, e.clientY);
        });

        window.addEventListener('mouseup', () => {
            endDrag();
        });

        handle.addEventListener('touchstart', (e) => {
            if (!e.touches[0]) return;
            e.preventDefault();
            beginDrag(e.touches[0].clientX, e.touches[0].clientY);
        }, { passive: false });

        window.addEventListener('touchmove', (e) => {
            if (!dragging) return;
            if (!e.touches[0]) return;
            e.preventDefault();
            updateDrag(e.touches[0].clientX, e.touches[0].clientY);
        }, { passive: false });

        window.addEventListener('touchend', () => {
            if (!dragging) return;
            if (!dragMoved) toggleControls();
            endDrag();
        });
    }

    // ============================================
    // J) Selection box + highlight rendering (game.draw wrap)
    // ============================================
    const __origDraw = game.draw.bind(game);

    game.draw = function () {
        // During battle on PC, suppress native cursor across wrapper to prevent pointer flicker.
        const wrapper = document.getElementById('game-wrapper');
        if (wrapper) {
            let finePointer = false;
            try {
                finePointer = !!(window.matchMedia && window.matchMedia('(pointer: fine)').matches);
            } catch (_) { }
            const lockCursor = !!(finePointer && this.running && !this.isGameOver);
            wrapper.classList.toggle('battle-cursor-lock', lockCursor);
        }

        __origDraw();

        const ctx = this.ctx;
        drawUnitHitboxDebugOverlay(ctx, this);

        if (this.selectDragActive) {
            ctx.save();

            // [FIX] 줌 레벨 적용 - 선택 박스가 커서와 정확히 일치하도록
            const z = (typeof Camera !== 'undefined' && Camera.zoom) ? Camera.zoom : 1;
            const pivotRaw = (typeof this.getCameraPivotY === 'function')
                ? Number(this.getCameraPivotY())
                : Number(this.groundY);
            const gy = Number.isFinite(pivotRaw) ? pivotRaw : Number(this.groundY || 0);

            // 월드(view) → 스크린 변환(렌더와 동일: cameraPivotY 기준 스케일)
            const toSX = (worldX) => (worldX - this.cameraX) * z;
            const toSY = (viewY) => gy + (viewY - gy) * z;

            const x1 = toSX(this.selectStartX);
            const y1 = toSY(this.selectStartY);
            const x2 = toSX(this.selectEndX);
            const y2 = toSY(this.selectEndY);

            const left = Math.min(x1, x2);
            const top = Math.min(y1, y2);
            const width = Math.abs(x2 - x1);
            const height = Math.abs(y2 - y1);

            ctx.fillStyle = 'rgba(34, 197, 94, 0.2)';
            ctx.fillRect(left, top, width, height);

            ctx.strokeStyle = '#22c55e';
            ctx.lineWidth = 2;
            ctx.setLineDash([5, 5]);
            ctx.strokeRect(left, top, width, height);

            ctx.restore();
        }

        /*
        // Selected unit marker: HP bar under the unit (replaces green dot)
        if (this.selectedUnits.size > 0) {
            ctx.save();

            // [FIX] 줌 레벨 적용 - HP바가 유닛 아래에 정확히 붙도록
            const z = (typeof Camera !== 'undefined' && Camera.zoom) ? Camera.zoom : 1;
            const gy = this.groundY;

            this.selectedUnits.forEach(u => {
                if (!u || u.dead || !u.isSelected) return;

                const hp = (typeof u.hp === 'number') ? u.hp : 0;
                const maxHp = (typeof u.maxHp === 'number' && u.maxHp > 0) ? u.maxHp : 1;
                const ratio = Math.max(0, Math.min(1, hp / maxHp));

                const barW = 34 * z;
                const barH = 5 * z;

                // 월드 좌표를 스크린 좌표로 변환
                const screenX = (u.x - this.cameraX) * z - barW / 2;
                const screenY = gy + (u.y + 12 - gy) * z;

                ctx.fillStyle = 'rgba(15, 18, 21, 0.85)';
                ctx.fillRect(screenX, screenY, barW, barH);

                ctx.fillStyle = '#22c55e';
                ctx.fillRect(screenX, screenY, Math.floor(barW * ratio), barH);

                ctx.strokeStyle = 'rgba(255,255,255,0.85)';
                ctx.lineWidth = 1;
                ctx.strokeRect(screenX - 0.5, screenY - 0.5, barW + 1, barH + 1);
            });

            ctx.restore();
        }
        */

        // Move marker effects (screen-space)
        if (this.moveEffects && this.moveEffects.length) {
            for (let i = 0; i < this.moveEffects.length; i++) {
                const eff = this.moveEffects[i];
                eff.life -= 0.05;
                eff.radius -= 0.6;

                if (eff.life <= 0) {
                    this.moveEffects.splice(i, 1);
                    i--;
                    continue;
                }

                ctx.save();
                ctx.translate(eff.x, eff.y);

                const color = `rgba(50, 255, 100, ${eff.life})`;
                ctx.strokeStyle = color;
                ctx.fillStyle = color;
                ctx.lineWidth = 2;

                ctx.beginPath();
                ctx.arc(0, 0, Math.max(0, eff.radius), 0, Math.PI * 2);
                ctx.stroke();

                ctx.beginPath();
                ctx.arc(0, 0, 3, 0, Math.PI * 2);
                ctx.fill();

                const innerR = Math.max(6, eff.radius - 6);
                ctx.beginPath();
                ctx.moveTo(0, -innerR); ctx.lineTo(0, -3);
                ctx.moveTo(0, innerR); ctx.lineTo(0, 3);
                ctx.moveTo(-innerR, 0); ctx.lineTo(-3, 0);
                ctx.moveTo(innerR, 0); ctx.lineTo(3, 0);
                ctx.stroke();

                ctx.restore();
            }
        }

        // Custom cursor (screen-space)
        let coarsePointer = false;
        try {
            coarsePointer = !!(window.matchMedia && window.matchMedia('(pointer: coarse)').matches);
        } catch (_) { }

        if (this.__cursor && this.__cursor.inCanvas && !coarsePointer) {
            let isHovering = false;
            let hoverType = null;
            let hoverUnit = null;

            const cursorClientX = Number(this.__cursor.clientX);
            const cursorClientY = Number(this.__cursor.clientY);
            const hoverMetrics = (Number.isFinite(cursorClientX) && Number.isFinite(cursorClientY))
                ? getClientProjectionMetrics(this)
                : null;
            const useClientHover = !!hoverMetrics;
            const p = Camera.screenToView ? Camera.screenToView(this, this.__cursor.clientX, this.__cursor.clientY) : { x: this.__cursor.x, y: this.__cursor.y };
            const wx = p.x + this.cameraX;
            const wy = p.y;

            if (Array.isArray(this.players)) {
                for (let i = this.players.length - 1; i >= 0; i--) {
                    const u = this.players[i];
                    const hovered = useClientHover
                        ? (
                            isClientHitProjectedProfile(this, u, cursorClientX, cursorClientY, {
                                metrics: hoverMetrics, soft: false, nearPx: 0
                            })
                            || isClientHitProjectedProfile(this, u, cursorClientX, cursorClientY, {
                                metrics: hoverMetrics, soft: true, nearPx: 0
                            })
                            || isClientHitProjectedProfile(this, u, cursorClientX, cursorClientY, {
                                metrics: hoverMetrics, soft: false, nearPx: 18
                            })
                        )
                        : isUnitHoverHit(u, wx, wy);
                    if (u && !u.dead && u.team === 'player' && hovered) {
                        isHovering = true;
                        hoverType = 'ally';
                        hoverUnit = u;
                        break;
                    }
                }
            }
            if (!isHovering && Array.isArray(this.enemies)) {
                for (let i = this.enemies.length - 1; i >= 0; i--) {
                    const u = this.enemies[i];
                    const hovered = useClientHover
                        ? (
                            isClientHitProjectedProfile(this, u, cursorClientX, cursorClientY, {
                                metrics: hoverMetrics, soft: false, nearPx: 0
                            })
                            || isClientHitProjectedProfile(this, u, cursorClientX, cursorClientY, {
                                metrics: hoverMetrics, soft: true, nearPx: 0
                            })
                            || isClientHitProjectedProfile(this, u, cursorClientX, cursorClientY, {
                                metrics: hoverMetrics, soft: false, nearPx: 18
                            })
                        )
                        : isUnitHoverHit(u, wx, wy);
                    if (u && !u.dead && u.team === 'enemy' && hovered) {
                        isHovering = true;
                        hoverType = 'enemy';
                        hoverUnit = u;
                        break;
                    }
                }
            }

            const mx = this.__cursor.x;
            const my = this.__cursor.y;

            ctx.save();
            ctx.translate(mx, my);

            const directControlActive = !!(
                typeof this.isDirectControlActive === 'function'
                && this.isDirectControlActive()
                && typeof this.getDirectControlUnit === 'function'
                && this.getDirectControlUnit()
            );

            if (directControlActive) {
                // Direct-control cursor: always show explicit aim reticle on PC.
                const aimColor = (hoverType === 'enemy') ? '#ff4d4d' : '#66ffd9';
                const outerR = (hoverType === 'enemy') ? 12 : 11;
                const innerR = 3;

                ctx.strokeStyle = aimColor;
                ctx.lineWidth = 2;
                ctx.setLineDash((hoverType === 'enemy') ? [] : [4, 3]);
                ctx.beginPath();
                ctx.arc(0, 0, outerR, 0, Math.PI * 2);
                ctx.stroke();
                ctx.setLineDash([]);

                ctx.beginPath();
                ctx.moveTo(-outerR - 6, 0); ctx.lineTo(-innerR, 0);
                ctx.moveTo(innerR, 0); ctx.lineTo(outerR + 6, 0);
                ctx.moveTo(0, -outerR - 6); ctx.lineTo(0, -innerR);
                ctx.moveTo(0, innerR); ctx.lineTo(0, outerR + 6);
                ctx.stroke();

                ctx.fillStyle = aimColor;
                ctx.beginPath();
                ctx.arc(0, 0, (hoverType === 'enemy') ? 2.2 : 1.8, 0, Math.PI * 2);
                ctx.fill();
            } else if (isHovering) {
                // Hover cursor (ally/enemy)
                const targetColor = (hoverType === 'ally') ? '#00ff00' : '#ff3333';
                const infantryHover = !!(hoverUnit && isInfantryLikeUnit(hoverUnit));
                ctx.strokeStyle = targetColor;
                ctx.lineWidth = 2;
                if (infantryHover) {
                    // Infantry-specific cursor: circular lock + top chevron.
                    const r = 10;
                    ctx.beginPath();
                    ctx.arc(0, 0, r, 0, Math.PI * 2);
                    ctx.stroke();

                    ctx.beginPath();
                    ctx.moveTo(0, -r - 7);
                    ctx.lineTo(6, -r - 1);
                    ctx.lineTo(-6, -r - 1);
                    ctx.closePath();
                    ctx.stroke();

                    ctx.beginPath();
                    ctx.moveTo(-r - 5, 0); ctx.lineTo(-r + 1, 0);
                    ctx.moveTo(r - 1, 0); ctx.lineTo(r + 5, 0);
                    ctx.moveTo(0, r - 1); ctx.lineTo(0, r + 5);
                    ctx.stroke();

                    ctx.fillStyle = targetColor;
                    ctx.beginPath();
                    ctx.arc(0, 0, 1.8, 0, Math.PI * 2);
                    ctx.fill();
                } else {
                    const size = 12;
                    ctx.beginPath();
                    ctx.moveTo(0, -size); ctx.lineTo(size, 0);
                    ctx.lineTo(0, size); ctx.lineTo(-size, 0);
                    ctx.closePath();
                    ctx.stroke();

                    const tickLen = 6;
                    ctx.beginPath();
                    ctx.moveTo(0, -size - tickLen); ctx.lineTo(0, -size);
                    ctx.moveTo(0, size + tickLen); ctx.lineTo(0, size);
                    ctx.moveTo(-size - tickLen, 0); ctx.lineTo(-size, 0);
                    ctx.moveTo(size + tickLen, 0); ctx.lineTo(size, 0);
                    ctx.stroke();

                    ctx.fillStyle = targetColor;
                    ctx.beginPath();
                    ctx.arc(0, 0, 2, 0, Math.PI * 2);
                    ctx.fill();
                }
            } else if (this.__cursor.down && this.__cursor.button === 0 && this.selectDragActive) {
                // Drag-select cursor
                ctx.strokeStyle = '#ffcc00';
                ctx.lineWidth = 2;
                const size = 15;
                const gap = 5;

                ctx.beginPath();
                ctx.moveTo(-size, -gap); ctx.lineTo(-size, -size); ctx.lineTo(-gap, -size);
                ctx.moveTo(gap, -size); ctx.lineTo(size, -size); ctx.lineTo(size, -gap);
                ctx.moveTo(size, gap); ctx.lineTo(size, size); ctx.lineTo(gap, size);
                ctx.moveTo(-gap, size); ctx.lineTo(-size, size); ctx.lineTo(-size, gap);
                ctx.stroke();

                ctx.fillStyle = '#ffcc00';
                ctx.beginPath();
                ctx.arc(0, 0, 2, 0, Math.PI * 2);
                ctx.fill();
            } else {
                // Default cursor
                ctx.strokeStyle = '#00ffcc';
                ctx.lineWidth = 3;
                const size = 12;
                const gap = 4;

                ctx.beginPath();
                ctx.moveTo(0, -size); ctx.lineTo(0, -gap);
                ctx.moveTo(0, gap); ctx.lineTo(0, size);
                ctx.moveTo(-size, 0); ctx.lineTo(-gap, 0);
                ctx.moveTo(gap, 0); ctx.lineTo(size, 0);
                ctx.stroke();

                ctx.fillStyle = '#fff';
                ctx.beginPath();
                ctx.arc(0, 0, 1, 0, Math.PI * 2);
                ctx.fill();
            }

            ctx.restore();
        }
    };

    // ============================================
    // K) Remove dead units from selection (game.update wrap)
    // ============================================
    const __origGameUpdate = game.update.bind(game);

    game.update = function () {
        __origGameUpdate();

        this.selectedUnits.forEach(u => {
            if (u.dead) {
                this.selectedUnits.delete(u);
            }
        });

        const directUnit = (typeof this.getDirectControlUnit === 'function')
            ? this.getDirectControlUnit()
            : null;
        if (directUnit) {
            if (directUnit.dead || !isDirectControlEligibleUnit(directUnit)) {
                if (typeof this.stopDirectControl === 'function') this.stopDirectControl('internal');
            } else {
                syncDirectControlSelection(directUnit);
            }
        }
    };

    // [RECON] 선택 유닛에 recon이 있을 때만 정찰 버튼 노출
    (function hookReconButtonVisibility() {
        if (!game || typeof game.updateHUDSelection !== 'function') return;
        const _orig = game.updateHUDSelection.bind(game);
        game.updateHUDSelection = function () {
            _orig();
            const reconBtn = document.getElementById('cmd-recon-btn');
            if (reconBtn) {
                const hasRecon = this.selectedUnits && [...this.selectedUnits].some(u => u && !u.dead && u.stats && u.stats.id === 'recon');
                reconBtn.classList.toggle('hidden', !hasRecon);
            }

            const smokeBtn = document.getElementById('cmd-smoke-btn');
            if (smokeBtn) {
                const hasSpecial = this.selectedUnits && [...this.selectedUnits].some(u => u && !u.dead && (u.smokeChargesLeft || 0) > 0);
                smokeBtn.classList.toggle('hidden', !hasSpecial);
            }

            const medkitBtn = document.getElementById('cmd-medkit-btn');
            if (medkitBtn) {
                const hasMedkit = this.selectedUnits && [...this.selectedUnits].some(u => u && !u.dead && (u.medkitChargesLeft || 0) > 0);
                medkitBtn.classList.toggle('hidden', !hasMedkit);
            }

            const dropBtn = document.getElementById('cmd-drop-btn');
            if (dropBtn) {
                let hasTransport = false;
                let canDrop = false;
                if (this.selectedUnits) {
                    this.selectedUnits.forEach(u => {
                        if (!u || u.dead || !u.stats) return;
                        if (['blackhawk', 'chinook', 'uh60', 'apc', 'humvee'].includes(u.stats.id)) {
                            hasTransport = true;
                            if ((u.transportDropsLeft || 0) > 0) canDrop = true;
                        }
                    });
                }
                dropBtn.classList.toggle('hidden', !hasTransport);
                dropBtn.disabled = !canDrop;
                dropBtn.classList.toggle('disabled', !canDrop);
            }

            // [NEW] Missile 버튼: 미사일 명령 유닛 선택 시 노출
            const missileBtn = document.getElementById('cmd-missile-btn');
            if (missileBtn) {
                let hasMissileUnit = false;
                let hasMissileCharge = false;
                if (this.selectedUnits) {
                    this.selectedUnits.forEach(u => {
                        if (!u || u.dead || !u.stats) return;
                        const supportsMissile = (typeof this.unitHasMissileCommand === 'function')
                            ? this.unitHasMissileCommand(u)
                            : (u.stats.id === 'fighter');
                        if (supportsMissile) {
                            hasMissileUnit = true;
                            if ((u.missileChargesLeft || 0) > 0) hasMissileCharge = true;
                        }
                    });
                }
                missileBtn.classList.toggle('hidden', !hasMissileUnit);
                missileBtn.disabled = !hasMissileCharge;
                missileBtn.classList.toggle('disabled', !hasMissileCharge);
            }
        };
    })();

    // ============================================
    // Init
    // ============================================
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            setupCommandPanel();
            setupHudCtrlPanel();
        });
    } else {
        setupCommandPanel();
        setupHudCtrlPanel();
    }

    });
})();
