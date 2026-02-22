/**
 * unit_commands.js - R 2.4 유닛 명령 패널/다중 선택/드래그 선택
 */

(function () {
    'use strict';

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

    function ensureDirectControlState() {
        if (!game.directControl || typeof game.directControl !== 'object') {
            game.directControl = {};
        }
        const state = game.directControl;
        if (typeof state.active !== 'boolean') state.active = false;
        if (!Object.prototype.hasOwnProperty.call(state, 'unit')) state.unit = null;
        if (!state.keys || typeof state.keys !== 'object') state.keys = {};
        if (state.weaponMode !== 'sub') state.weaponMode = 'main';

        const keys = state.keys;
        if (typeof keys.w !== 'boolean') keys.w = false;
        if (typeof keys.a !== 'boolean') keys.a = false;
        if (typeof keys.s !== 'boolean') keys.s = false;
        if (typeof keys.d !== 'boolean') keys.d = false;
        if (typeof keys.arrowLeft !== 'boolean') keys.arrowLeft = false;
        if (typeof keys.arrowRight !== 'boolean') keys.arrowRight = false;
        return state;
    }

    function clearDirectControlKeys() {
        const state = ensureDirectControlState();
        const keys = state.keys;
        keys.w = false;
        keys.a = false;
        keys.s = false;
        keys.d = false;
        keys.arrowLeft = false;
        keys.arrowRight = false;
    }

    function isDirectControlEligibleUnit(unit) {
        if (!unit || unit.dead || !unit.stats) return false;
        if (unit.team !== 'player') return false;
        const id = String(unit.stats.id || '');
        return DIRECT_CONTROL_ELIGIBLE_IDS.has(id);
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

    function resolveDirectControlAutoTarget(unit) {
        if (!unit || unit.dead || typeof unit.findNearestEnemy !== 'function') return null;
        const pools = getDirectControlEnemyPools(unit);
        const target = unit.findNearestEnemy(pools.enemies, pools.enemyBuildings);
        if (!target || target.dead) return null;

        const id = String((unit.stats && unit.stats.id) || '');
        const unitRange = Number(unit.getEffectiveRange ? unit.getEffectiveRange() : (unit.stats && unit.stats.range)) || 0;
        const missileRange = Number(unit.getEffectiveMissileRange ? unit.getEffectiveMissileRange() : unitRange) || unitRange;
        const usesExtendedMissileRange = (id === 'apc' || id === 'engineer' || id === 'rpg');
        const activeRange = usesExtendedMissileRange ? Math.max(unitRange, missileRange) : unitRange;
        const dist = Math.abs((Number(target.x) || 0) - (Number(unit.x) || 0));
        if (dist > Math.max(140, activeRange)) return null;
        return target;
    }

    function resolveDirectControlAim(unit) {
        if (!unit || unit.dead) return null;

        const mx = Number(unit.manualAimX);
        const my = Number(unit.manualAimY);
        if (Number.isFinite(mx) && Number.isFinite(my)) {
            return { x: mx, y: my };
        }

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

    function unitHasDirectSubWeapon(unit) {
        const id = String((unit && unit.stats && unit.stats.id) || '');
        return id === 'mbt';
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
        const target = resolveDirectControlAutoTarget(unit);
        if (!target) return false;

        const frameNow = Number.isFinite(game.frame) ? game.frame : 0;
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
            unit.attackTarget = target;
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
        clearDirectControlKeys();
        state.weaponMode = 'main';

        target.commandMode = 'stop';
        target.returnToBase = false;
        target.targetX = null;
        target.targetY = null;
        target.commandTargetX = null;
        target.lockedTarget = null;
        target.attackTarget = null;

        syncDirectControlSelection(target);

        if (typeof ui !== 'undefined' && ui && typeof ui.showToast === 'function') {
            const label = target.stats && target.stats.name ? target.stats.name : (target.stats && target.stats.id ? target.stats.id : 'UNIT');
            ui.showToast(`조종 시작: ${label} (E: 조종취소)`);
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
        clearDirectControlKeys();
        state.weaponMode = 'main';

        if (unit && !unit.dead) {
            unit.commandMode = 'attack';
            unit.returnToBase = false;
            unit.targetX = null;
            unit.targetY = null;
            unit.commandTargetX = null;
            unit.lockedTarget = null;
            unit.attackTarget = null;
            if (unit.stats && unit.stats.id === 'mbt' && typeof unit.stopManualTankMG === 'function') {
                unit.stopManualTankMG(true);
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
        const rect = wrapper ? wrapper.getBoundingClientRect() : { left: 0, top: 0 };
        return {
            x: (clientX - rect.left) / (game.scaleRatio || 1),
            y: (clientY - rect.top) / (game.scaleRatio || 1)
        };
    }

    function __updateCursor(clientX, clientY) {
        const p = __clientToCanvas(clientX, clientY);
        game.__cursor.clientX = clientX;
        game.__cursor.clientY = clientY;
        game.__cursor.x = p.x;
        game.__cursor.y = p.y;
    }

    if (!game.__cursorListenersBound) {
        game.__cursorListenersBound = true;

        window.addEventListener('mousemove', (e) => __updateCursor(e.clientX, e.clientY));
        window.addEventListener('mousedown', (e) => {
            if (e.button === 0 || e.button === 2) {
                game.__cursor.down = true;
                game.__cursor.button = e.button;
            }
        });
        window.addEventListener('mouseup', (e) => {
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

        // [NEW] Direct control priority (player combat units)
        const directControlUnit = (typeof game.getDirectControlUnit === 'function')
            ? game.getDirectControlUnit()
            : null;
        if (directControlUnit && directControlUnit === this) {
            if (!isDirectControlEligibleUnit(this)) {
                if (typeof game.stopDirectControl === 'function') game.stopDirectControl('internal');
                return;
            }

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
            this.targetY = null;
            this.commandTargetX = null;
            this.lockedTarget = null;

            let moveAxis = 0;
            if (keys.a || keys.arrowLeft) moveAxis -= 1;
            if (keys.d || keys.arrowRight) moveAxis += 1;
            if (unitId !== 'apache') {
                if (keys.w) moveAxis += 1;
                if (keys.s) moveAxis -= 1;
            }
            if (moveAxis > 1) moveAxis = 1;
            if (moveAxis < -1) moveAxis = -1;

            const baseSpeed = Math.max(0.45, Number(this.stats && this.stats.speed) || 0.45);
            const moveSpeed = baseSpeed * ((this.stats && this.stats.type === 'air') ? 1.35 : 1.2);
            if (moveAxis !== 0) {
                this.x += moveAxis * moveSpeed;
                this.facing = (moveAxis > 0) ? 1 : -1;
            }
            const hasManualAim = Number.isFinite(Number(this.manualAimX)) && Number.isFinite(Number(this.manualAimY));
            if (moveAxis === 0 && hasManualAim) {
                const aimDx = Number(this.manualAimX) - Number(this.x);
                if (Math.abs(aimDx) > 4) {
                    this.facing = (aimDx >= 0) ? 1 : -1;
                }
            }

            if (unitId === 'apache') {
                let verticalAxis = 0;
                if (keys.w) verticalAxis -= 1;
                if (keys.s) verticalAxis += 1;
                if (verticalAxis !== 0) {
                    const climbSpeed = Math.max(0.6, baseSpeed * 0.9);
                    this.y += verticalAxis * climbSpeed;
                }
                const minY = game.groundY - 620;
                const maxY = game.groundY - 300;
                if (this.y < minY) this.y = minY;
                if (this.y > maxY) this.y = maxY;
                this.rotorAngle += 1.0;
            } else if (this.stats.type === 'air') {
                this.rotorAngle += 0.9;
            } else {
                this.y = game.groundY;
            }

            // Keep MBT manual MG hold behavior consistent with base update path.
            if (unitId === 'mbt') {
                const buildActive = !!(game && game.buildMode && game.buildMode.active);
                const targetingActive = !!(game && game.targetingType);
                if (this.manualMgHeld === true && hasManualAim && !buildActive && !targetingActive) {
                    if (typeof this.tryManualTankMGFire === 'function') {
                        this.tryManualTankMGFire(this.manualAimX, this.manualAimY);
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

            const target = this.findNearestEnemy(enemies, buildings);
            const unitRange = Number(this.getEffectiveRange ? this.getEffectiveRange() : (this.stats.range || 0));
            const missileRange = Number(this.getEffectiveMissileRange ? this.getEffectiveMissileRange() : unitRange);
            const usesExtendedMissileRange = (unitId === 'apc' || unitId === 'engineer' || unitId === 'rpg');
            const activeRange = usesExtendedMissileRange ? Math.max(unitRange, missileRange) : unitRange;
            let targetDirectionOk = true;
            if (target && hasManualAim) {
                const targetDx = Number(target.x) - Number(this.x);
                if (Math.abs(targetDx) > 10) {
                    targetDirectionOk = ((Number(this.facing) || 1) * targetDx) >= 0;
                }
            }
            const canAttack = (target && targetDirectionOk && Math.abs(target.x - this.x) <= activeRange);

            if (canAttack) {
                this.attackTarget = target;
                let rate = 60;
                if (['humvee', 'apc', 'aa_tank', 'turret', 'blackhawk'].includes(unitId)) rate = 15;
                else if (unitId === 'spg') rate = 300;
                else if (unitId === 'sniper') rate = 210;

                if (game.frame - this.lastAttack > rate) {
                    if (unitId !== 'spg' || (typeof this._canSpgFireNow === 'function' ? this._canSpgFireNow() : true)) {
                        this.attack(target);
                        this.lastAttack = game.frame;
                    }
                }
            } else if (this.attackTarget && (this.attackTarget.dead || Math.abs((Number(this.attackTarget.x) || 0) - this.x) > (activeRange + 80))) {
                this.attackTarget = null;
            }
            return;
        }

        // [NEW] Move mode processing
        if (this.team === 'player' && this.commandMode === 'move') {
            if (this.stats.type === 'air') this.rotorAngle += 0.8;
            if (this.lastDamagedFrame && game.frame - this.lastDamagedFrame < 10) {
                this.commandMode = 'stop';
                this.targetX = null;
                if (typeof this.updateFacing === 'function') this.updateFacing();
                return;
            }
            const enemy = this.findNearestEnemy(enemies, buildings);
            const unitRange = Number(this.getEffectiveRange ? this.getEffectiveRange() : (this.stats.range || 0));
            if (enemy && Math.abs(enemy.x - this.x) <= unitRange) {
                this.commandMode = 'stop';
                this.targetX = null;
                if (typeof this.updateFacing === 'function') this.updateFacing();
                return;
            }
            if (this.targetX !== null && this.targetX !== undefined) {
                const dx = this.targetX - this.x;
                if (Math.abs(dx) < 10) { this.commandMode = 'stop'; this.targetX = null; }
                else { this.x += this.stats.speed * Math.sign(dx); }
            } else { this.commandMode = 'stop'; }
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

                // 지상: 제자리 유지 + 사거리 내 자동 공격만 수행
                const target = this.findNearestEnemy(enemies, buildings);
                const unitRange = Number(this.getEffectiveRange ? this.getEffectiveRange() : (this.stats.range || 0));
                const missileRange = Number(this.getEffectiveMissileRange ? this.getEffectiveMissileRange() : unitRange);
                const usesExtendedMissileRange = (this.stats.id === 'apc' || this.stats.id === 'engineer' || this.stats.id === 'rpg');
                const activeRange = usesExtendedMissileRange ? Math.max(unitRange, missileRange) : unitRange;
                const canAttack = (target && Math.abs(target.x - this.x) <= activeRange);
                if (canAttack) {
                    this.attackTarget = target;
                    if (typeof this._applyCombatSpacing === 'function') {
                        this._applyCombatSpacing(target, activeRange);
                    }
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
                    if (sticky && (sticky.dead || Math.abs((Number(sticky.x) || 0) - this.x) > (activeRange + 80))) {
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

                if (this.x > stopX) {
                    this.attackTarget = null;
                    const speed = this.stats.speed || 0.5;
                    this.x -= speed;
                    this.updateFacing();
                } else {
                    // 湲곗? ???꾨떖: ?먮룞 ?뺤?
                    this.commandMode = 'stop';
                    this.returnToBase = false;
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
    function isUnitHit(u, wx, wy) {
        if (!u || u.dead) return false;

        const halfW = u.width / 2;
        const left = u.x - halfW;
        const right = u.x + halfW;
        const top = u.y - u.height;
        const bottom = u.y;

        return wx >= left && wx <= right && wy >= top && wy <= bottom;
    }

    // ============================================
    // D) ?좊떅???ш컖???댁뿉 ?덈뒗吏 泥댄겕
    // ============================================
    function isUnitInRect(u, x1, y1, x2, y2) {
        if (!u || u.dead) return false;

        // ?ш컖???뺢퇋??
        const left = Math.min(x1, x2);
        const right = Math.max(x1, x2);
        const top = Math.min(y1, y2);
        const bottom = Math.max(y1, y2);

        // ?좊떅 諛붿슫??諛뺤뒪
        const uLeft = u.x - u.width / 2;
        const uRight = u.x + u.width / 2;
        const uTop = u.y - u.height;
        const uBottom = u.y;

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

    // ============================================
    // F) game.checkUnitClick 援ы쁽 (?⑥씪 ?대┃ ?좉?)
    // ============================================
    game.checkUnitClick = function (wx, wy, opts = null) {
        const keepSelectedOnRepeatTap = !!(opts && opts.keepSelectedOnRepeatTap);
        for (let i = this.players.length - 1; i >= 0; i--) {
            const u = this.players[i];
            if (!isUnitHit(u, wx, wy)) continue;

            const tutorialApi = (typeof CitySimTutorialIntro !== 'undefined' && CitySimTutorialIntro)
                ? CitySimTutorialIntro
                : null;
            if (tutorialApi && typeof tutorialApi.isBattleUnitSelectionAllowed === 'function') {
                const allowed = tutorialApi.isBattleUnitSelectionAllowed(this, u);
                if (allowed === false) {
                    ui.showToast('튜토리얼 단계: 드론병만 선택할 수 있습니다.');
                    return true;
                }
            }

            if (isLockedUnit(u)) {
                ui.showToast('목표가 지정된 유닛은 조작할 수 없습니다.');
                return true;
            }

            const panel = document.getElementById('unit-cmd-panel');

            // ?좉?: ?좏깮/?댁젣
            if (this.selectedUnits.has(u)) {
                if (!keepSelectedOnRepeatTap) {
                    this.selectedUnits.delete(u);
                    u.isSelected = false;
                    u.commandMode = 'attack'; // ?댁젣 ??怨듦꺽 紐⑤뱶 蹂듦?
                    u.returnToBase = false;
                }
            } else {
                this.selectedUnits.add(u);
                u.isSelected = true;
                u.commandMode = 'stop'; // ?좏깮 ??利됱떆 ?뺤?
                u.returnToBase = false;
                const uid = u.stats ? u.stats.id : null;
                const heliIds = ['apache', 'blackhawk', 'uh60', 'chinook'];
                if (uid && heliIds.includes(uid) && typeof AudioSystem !== 'undefined') {
                    AudioSystem.playSFX('helicopter_select', u.x);
                }
            }

            if (typeof app !== 'undefined') app.markUiDirty();

            // [NEW] Update HUD selection display
            if (typeof this.updateHUDSelection === 'function') {
                this.updateHUDSelection();
            }

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
        let blockedByTutorial = 0;
        for (const u of this.players) {
            if (isLockedUnit(u)) continue;
            if (!isUnitInRect(u, x1, y1, x2, y2)) continue;
            const tutorialApi = (typeof CitySimTutorialIntro !== 'undefined' && CitySimTutorialIntro)
                ? CitySimTutorialIntro
                : null;
            if (tutorialApi && typeof tutorialApi.isBattleUnitSelectionAllowed === 'function') {
                const allowed = tutorialApi.isBattleUnitSelectionAllowed(this, u);
                if (allowed === false) {
                    blockedByTutorial++;
                    continue;
                }
            }
            this.selectedUnits.add(u);
            u.isSelected = true;
        }

        if (this.selectedUnits.size > 0) {
            ui.showToast(`${this.selectedUnits.size}개 유닛 선택`);
        } else if (blockedByTutorial > 0) {
            ui.showToast('튜토리얼 단계: 드론병만 선택할 수 있습니다.');
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

                if (cmd === 'control') {
                    if (typeof game.toggleDirectControl === 'function') {
                        const selected = (typeof game.getDirectControlSelectedCandidate === 'function')
                            ? game.getDirectControlSelectedCandidate()
                            : null;
                        const changed = game.toggleDirectControl(selected);
                        if (changed) {
                            btns.forEach(b => b.classList.remove('active'));
                            if (typeof game.isDirectControlActive === 'function' && game.isDirectControlActive()) {
                                this.classList.add('active');
                            }
                            if (typeof game.updateHUDSelection === 'function') game.updateHUDSelection();
                        }
                    }
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
                                u.commandMode = 'retreat';
                                u.returnToBase = true;
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
                        u.commandMode = cmd;
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
        __origDraw();

        const ctx = this.ctx;

        if (this.selectDragActive) {
            ctx.save();

            // [FIX] 줌 레벨 적용 - 선택 박스가 커서와 정확히 일치하도록
            const z = (typeof Camera !== 'undefined' && Camera.zoom) ? Camera.zoom : 1;
            const gy = this.groundY;

            // 월드(view) → 스크린 변환(렌더와 동일: groundY 기준 스케일)
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
        if (this.__cursor && this.__cursor.inCanvas) {
            let isHovering = false;
            let hoverType = null;

            if (!this.__cursor.down) {
                const p = Camera.screenToView ? Camera.screenToView(this, this.__cursor.clientX, this.__cursor.clientY) : { x: this.__cursor.x, y: this.__cursor.y };
                const wx = p.x + this.cameraX;
                const wy = p.y;

                if (Array.isArray(this.players)) {
                    for (let i = this.players.length - 1; i >= 0; i--) {
                        const u = this.players[i];
                        if (u && !u.dead && u.stats && u.stats.team === 'player' && isUnitHit(u, wx, wy)) {
                            isHovering = true;
                            hoverType = 'ally';
                            break;
                        }
                    }
                }
                if (!isHovering && Array.isArray(this.enemies)) {
                    for (let i = this.enemies.length - 1; i >= 0; i--) {
                        const u = this.enemies[i];
                        if (u && !u.dead && u.stats && u.stats.team === 'enemy' && isUnitHit(u, wx, wy)) {
                            isHovering = true;
                            hoverType = 'enemy';
                            break;
                        }
                    }
                }
            }

            const mx = this.__cursor.x;
            const my = this.__cursor.y;

            ctx.save();
            ctx.translate(mx, my);

            if (this.__cursor.down && this.__cursor.button === 0 && this.selectDragActive) {
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
            } else if (isHovering) {
                // Hover cursor (ally/enemy)
                const targetColor = (hoverType === 'ally') ? '#00ff00' : '#ff3333';
                ctx.strokeStyle = targetColor;
                ctx.lineWidth = 2;
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
                        if (['blackhawk', 'chinook', 'apc', 'humvee'].includes(u.stats.id)) {
                            hasTransport = true;
                            if ((u.transportDropsLeft || 0) > 0) canDrop = true;
                        }
                    });
                }
                dropBtn.classList.toggle('hidden', !hasTransport);
                dropBtn.disabled = !canDrop;
                dropBtn.classList.toggle('disabled', !canDrop);
            }

            const controlBtn = document.getElementById('cmd-control-btn');
            if (controlBtn) {
                const active = (typeof this.isDirectControlActive === 'function') && this.isDirectControlActive();
                const canStart = (typeof this.getDirectControlSelectedCandidate === 'function') && !!this.getDirectControlSelectedCandidate();
                const visible = active || canStart;
                controlBtn.classList.toggle('hidden', !visible);
                controlBtn.disabled = !visible;
                controlBtn.classList.toggle('disabled', !visible);
                controlBtn.classList.toggle('active', !!active);

                const labelEl = controlBtn.querySelector('[data-direct-control-label]') || controlBtn.querySelector('span:last-child');
                if (labelEl) {
                    const isEn = (typeof Lang !== 'undefined' && Lang && Lang.current === 'en');
                    labelEl.textContent = active
                        ? (isEn ? 'Control Off (E)' : '조종취소(E)')
                        : (isEn ? 'Control On (E)' : '조종시작(E)');
                }
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

})();
