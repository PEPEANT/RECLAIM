// [RULE] ?¸ê²Œ???ˆë‚´/?íƒœ/ì±„íŒ… ë©”ì‹œì§€??UI ? ìŠ¤??ê¸ˆì?. ChatPanel.push()ë¡œë§Œ ì¶œë ¥.

const DroneBehavior = {
    update(drone, enemies, buildings) {
        if (drone.dead) return;

        if (isNaN(drone.x) || isNaN(drone.y)) {
            drone.dead = true;
            return;
        }

        // [R 4.2] ?œë¡ ë³?drone_operator)?€ ?¬ê¸°??ì²˜ë¦¬ ????
        if (drone.stats.operator) return;

        // [FIX] ?œë¡ ë³??¬ë§ ???œë¡  ì¦‰ì‹œ ?œê±° (orphan drone ë°©ì?)
        if (typeof game !== 'undefined') {
            let owner = drone.ownerRef || drone.recallTarget || null;
            if (!owner || owner.dead) {
                owner = (typeof game.findDroneOwner === 'function')
                    ? game.findDroneOwner(drone, true)
                    : ((game.players || []).find(p => p && p.stats?.operator && p.ownedDrone === drone) ||
                        (game.enemies || []).find(p => p && p.stats?.operator && p.ownedDrone === drone) ||
                        null);
            }
            if (owner && owner.dead) {
                if (typeof game.removeOperatorDrone === 'function') {
                    game.removeOperatorDrone(owner, drone);
                } else if (owner.ownedDrone === drone) {
                    owner.ownedDrone = null;
                }
                drone.dead = true;
                return;
            }
        }

        if (drone.commandState === 'recall' && !drone.recallRequested) {
            drone.recallRequested = true;
        }
        // [NEW] Recall override (highest priority)
        if (drone.recallRequested) {
            // owner ?°ê²°???œê°„ ?Šê²¨??ë³µê??”ì²­??ì·¨ì†Œ?˜ì? ë§ê³  ë§??„ë ˆ??ë³µêµ¬ ?œë„
            let owner = drone.ownerRef || drone.recallTarget;
            if ((!owner || owner.dead) && typeof game !== 'undefined') {
                owner = (typeof game.findDroneOwner === 'function')
                    ? game.findDroneOwner(drone, false)
                    : (game.players || []).find(p => p && !p.dead && p.stats?.operator && p.ownedDrone === drone);
                if (owner) {
                    drone.ownerRef = owner;
                    drone.recallTarget = owner;
                    if (typeof game.addOperatorDrone === 'function') {
                        game.addOperatorDrone(owner, drone);
                    } else if (owner.ownedDrone !== drone) {
                        owner.ownedDrone = drone;
                    }
                }
            }

            // ?„ì§ ownerë¥?ëª?ì°¾ìœ¼ë©? ë³µê??”ì²­ ? ì? + ê³µê²© ?€ê²??œê±° + ?€ê¸?
            if (!owner || owner.dead) {
                drone.lockedTarget = null;
                drone.attackTarget = null;
                drone.swarmTarget = null;
                return;
            }

            const facing = (owner.facing != null) ? owner.facing : ((owner.team === 'player') ? 1 : -1);
            const tx = owner.x + facing * 22;
            const ty = (typeof owner.y === 'number') ? (owner.y - 6) : (game.groundY - 6);
            const dx = tx - drone.x;
            const dy = ty - drone.y;
            const dist = Math.hypot(dx, dy);
            const speed = (drone.stats?.speed || 1) * 1.2;
            const pickupThreshold = 22;

            drone.lockedTarget = null;
            drone.attackTarget = null;
            drone.swarmTarget = null;

            if (drone.holdFrames && drone.holdFrames > 0 && drone.recallPhase !== 'land') {
                drone.holdFrames = 0;
                drone.launchInit = false;
                drone.postLaunchHoverFrames = 0;
            }

            if (!drone.recallPhase) drone.recallPhase = 'approach';

            if (drone.recallPhase === 'approach') {
                if (drone.stats?.id === 'drone_at') {
                    drone.facing = (dx >= 0) ? 1 : -1;
                }
                if (dist <= pickupThreshold) {
                    drone.recallPhase = 'land';
                    drone.holdFrames = 25;
                    drone.x = tx;
                    drone.y = ty;
                    return;
                }

                if (dist > 0) {
                    drone.x += (dx / dist) * speed;
                    drone.y += (dy / dist) * speed;
                }
                return;
            }

            if (drone.recallPhase === 'land') {
                drone.x = tx;
                drone.y = ty;
                if (drone.holdFrames && drone.holdFrames > 0) {
                    drone.holdFrames--;
                    return;
                }
                drone.recallPhase = 'pickup';
            }

            if (drone.recallPhase === 'pickup') {
                if (typeof game !== 'undefined' && typeof game.removeOperatorDrone === 'function') {
                    game.removeOperatorDrone(owner, drone);
                } else if (owner.ownedDrone === drone) {
                    owner.ownedDrone = null;
                    owner.opState = 'rifle';
                }
                // Allow only one refund launch after successful recall.
                const refundsLeftRaw = Number(owner.droneRecallRefundsLeft);
                const refundsLeft = Number.isFinite(refundsLeftRaw) ? Math.max(0, Math.floor(refundsLeftRaw)) : 0;
                if (refundsLeft > 0) {
                    const maxChargesRaw = Number(owner.maxDroneCharges);
                    const maxCharges = Number.isFinite(maxChargesRaw) && maxChargesRaw > 0
                        ? Math.floor(maxChargesRaw)
                        : 1;
                    owner.droneChargesLeft = Math.min(maxCharges, (owner.droneChargesLeft || 0) + 1);
                    owner.droneRecallRefundsLeft = refundsLeft - 1;
                } else {
                    owner.droneChargesLeft = Math.max(0, owner.droneChargesLeft || 0);
                }
                drone.dead = true;
                if (typeof ChatPanel !== 'undefined') {
                    ChatPanel.push('[ë³µê? ?„ë£Œ]', 'INFO');
                }
                return;
            }
            return;
        }
        // [R 4.2 FIX v3] ?°ì¹˜ ? ë‹ˆë©”ì´??(?‰ê¸° ???ìŠ¹ ??ê°€??
        if (drone.holdFrames && drone.holdFrames > 0) {
            // ?°ì¹˜ ?Œë¼ë¯¸í„° ì´ˆê¸°??(1??
            if (!drone.launchInit) {
                drone.launchInit = true;
                const holdRaw = Number(drone.holdFrames);
                const legacyTotal = Number.isFinite(holdRaw) ? Math.max(1, Math.floor(holdRaw)) : 90;
                const groundHoldRaw = Number(drone.launchGroundHoldFrames);
                const riseRaw = Number(drone.launchRiseFrames);
                const defaultGroundHold = Math.max(0, Math.floor(legacyTotal * 0.4));

                drone.launchGroundHold = Number.isFinite(groundHoldRaw)
                    ? Math.max(0, Math.floor(groundHoldRaw))
                    : defaultGroundHold;
                drone.launchRise = Number.isFinite(riseRaw)
                    ? Math.max(1, Math.floor(riseRaw))
                    : Math.max(1, legacyTotal - drone.launchGroundHold);
                drone.launchTotal = Math.max(1, drone.launchGroundHold + drone.launchRise);
                drone.launchT = 0;
                drone.launchY0 = drone.y;
                drone.launchY1 = (drone.launchTargetY != null) ? drone.launchTargetY : (game.groundY - 110);
                const maxRiseStepRaw = Number(drone.launchMaxRisePerFrame);
                drone.launchMaxRisePerFrame = Number.isFinite(maxRiseStepRaw)
                    ? Math.max(0.35, maxRiseStepRaw)
                    : 0.75;
                drone.launchSpeedMul = 0.0;
            }

            drone.launchT++;
            const phaseFrame = Math.min(drone.launchT, drone.launchTotal);

            if (phaseFrame <= drone.launchGroundHold) {
                // ?‰ê¸° êµ¬ê°„: y ê³ ì • + ?ë„ 0
                drone.y = drone.launchY0;
                drone.launchSpeedMul = 0.0;
            } else {
                // ?ìŠ¹ êµ¬ê°„: smoothstep easing?¼ë¡œ ì²œì²œ???ìŠ¹
                const riseFrame = phaseFrame - drone.launchGroundHold;
                const t = riseFrame / Math.max(1, drone.launchRise);
                const tt = Math.min(1, Math.max(0, t));
                const ease = tt * tt * (3 - 2 * tt);

                const desiredY = drone.launchY0 + (drone.launchY1 - drone.launchY0) * ease;
                const maxRiseStep = Math.max(0.35, Number(drone.launchMaxRisePerFrame) || 0.75);
                const dy = desiredY - drone.y;
                if (Math.abs(dy) > maxRiseStep) {
                    drone.y += Math.sign(dy) * maxRiseStep;
                } else {
                    drone.y = desiredY;
                }
                drone.launchSpeedMul = 0.2 + 0.8 * ease;
            }

            drone.holdFrames--;
            if (drone.holdFrames <= 0 && drone.y > drone.launchY1 + 0.5) {
                // ?ìŠ¹ ?ë„ ìº¡ìœ¼ë¡??„ì§ ë¯¸ë„?¬ì´ë©??°ì¹˜ ?íƒœë¥?1?„ë ˆ???°ì¥
                drone.holdFrames = 1;
            }
            return;  // ì¤€ë¹„ì‹œê°?ì¤‘ì—??AI/ê³µê²© ê¸ˆì?
        }

        // ?°ì¹˜ ?„ë£Œ ??speedMul ?•ìƒ??
        if (drone.launchSpeedMul !== undefined && drone.launchSpeedMul < 1) {
            drone.launchSpeedMul = 1.0;
        }

        try {
            // 1) Stealth Drone: location-designated high-altitude dive + AoE blast
            if (drone.stats.id === 'stealth_drone') {
                this.updateStealth(drone, enemies, buildings);
                return;
            }

            // 2) Tactical/Suicide/AT Drone Logic (Homing)
            this.updateHoming(drone, enemies, buildings);

        } catch (e) {
            console.error("Drone Error:", e);
            drone.dead = true;
        }
    },

    playPreAttackCue(drone, worldX = null) {
        if (!drone || drone.dead) return;
        if (typeof AudioSystem === 'undefined' || !AudioSystem || typeof AudioSystem.playSFX !== 'function') return;
        const frameNow = (typeof game !== 'undefined' && game && Number.isFinite(Number(game.frame)))
            ? Number(game.frame)
            : 0;
        const last = Number(drone._preAttackCueFrame);
        if (Number.isFinite(last) && (frameNow - last) < 90) return;
        drone._preAttackCueFrame = frameNow;
        const sx = Number.isFinite(Number(worldX)) ? Number(worldX) : Number(drone.x);
        const droneId = String((drone.stats && drone.stats.id) || '').trim().toLowerCase();
        let sfxKey = 'drone_pre_attack';
        if (droneId === 'drone_suicide') sfxKey = 'drone_pre_attack_suicide';
        else if (droneId === 'drone_at') sfxKey = 'drone_pre_attack_at';
        AudioSystem.playSFX(sfxKey, sx);
    },

    updateStealth(drone, enemies, buildings) {
        // ì§€?•ëœ ?„ì¹˜ë¡??´ë™(ê³ ê³ ?? -> ?€ê°ì„  ?˜ê°• -> ê´‘ì—­ ??°œ
        if (drone.targetX === null || drone.targetX === undefined) {
            drone.dead = true;
            return;
        }

        // init
        if (!drone.stealthPhase) {
            drone.stealthPhase = 'cruise';
            drone.cruiseY = (game && game.groundY ? (game.groundY - 420) : (drone.y - 200));
            drone.y = drone.cruiseY;
            drone.diveSpeed = 8.0;   // ?œì‘ ?ë„ (ë¶€?œëŸ½ê²?
        }

        const targetX = drone.targetX;
        const groundY = (game && game.groundY) ? game.groundY : drone.y;

        // ëª©í‘œ ì§€??(ì§€ë©? ì¢Œí‘œ
        const tx = targetX;
        const ty = groundY - 8;

        if (drone.stealthPhase === 'cruise') {
            // 1) ?˜í‰ ?´ë™ + (ê°€ê¹Œì›Œì§€ë©? ?ì—°?¤ëŸ¬???˜ê°• ?œì‘
            const dx = tx - drone.x;
            const dir = dx > 0 ? 1 : -1;

            // ?‘ê·¼ êµ¬ê°„?ì„œ yë¥??œì„œ???´ë ¤ì¤?(ê°‘íˆ­?€ ?™í•˜ ë°©ì?)
            const approachDist = 260;      // ??ê±°ë¦¬ ?ˆì— ?¤ì–´?¤ë©´ ?ì  ?˜ê°•
            const descendAmount = 220;     // ?¬ë£¨ì¦?ê³ ë„?ì„œ ?¼ë§ˆ???´ë ¤?¤ë©° ?‘ê·¼? ì?
            const t = Math.max(0, Math.min(1, 1 - (Math.abs(dx) / approachDist))); // 0~1
            drone.y = drone.cruiseY + (descendAmount * t);

            drone.x += drone.stats.speed * dir;

            // ì¶©ë¶„??ê°€ê¹Œìš°ë©?"?€ê°ì„  ?˜ê°•" ?¨ê³„ ì§„ì…
            if (Math.abs(dx) <= Math.max(90, drone.stats.speed * 10)) {
                this.playPreAttackCue(drone, tx);
                drone.stealthPhase = 'dive';
            }
            return;
        }

        // dive: ëª©í‘œ??tx, ty)ë¡?"?€ê°ì„ " ê°€???´ë™ (?ì—°?¤ëŸ½ê²?
        drone.diveSpeed = Math.min(26, (drone.diveSpeed || 8) + 1.0); // ?ì§„ ê°€??
        const dx = tx - drone.x;
        const dy = ty - drone.y;
        const dist = Math.hypot(dx, dy) || 1;

        // ëª©í‘œ ?„ì°©(ì¶©ëŒ) ì²˜ë¦¬
        if (dist <= drone.diveSpeed + 6) {
            const radius = drone.stats.splashRadius || 180;
            const baseDmg = drone.stats.damage || 1000;

            // [VFX] ?¤í…”?¤ë“œë¡??í­ ??°œ
            if (typeof VFX !== 'undefined') {
                VFX.spawn(game, 'stealth', tx, groundY);
            } else {
                if (game && game.createParticles) game.createParticles(tx, groundY, 28, '#f59e0b');
            }
            // ???¤í…”?¤ë“œë¡???°œ ?¬ìš´??(boom-3)
            if (typeof AudioSystem !== 'undefined') AudioSystem.playBoom('stealth', tx);

            const applyAoE = (arr, mult = 1.0) => {
                for (let i = 0; i < arr.length; i++) {
                    const t = arr[i];
                    if (!t || t.dead) continue;

                    const d = Math.abs(t.x - tx);
                    if (d > radius) continue;

                    const falloff = 1 - (d / radius) * 0.55;
                    const dmg = Math.max(1, Math.floor(baseDmg * falloff * mult));

                    try { if (typeof t.takeDamage === 'function') t.takeDamage(dmg); } catch (e) { }
                }
            };

            // ? ë‹›/ë³‘ë ¥ ?¼í•´: ê·¸ë?ë¡?
            applyAoE(enemies, 1.0);

            // ê±´ë¬¼ ?¼í•´: ?ˆë°˜
            applyAoE(buildings, 0.5);

            drone.dead = true;
            drone.exploded = true;
            return;
        }

        // ?´ë™(?€ê°ì„ ) ?ìš©
        const nx = dx / dist;
        const ny = dy / dist;

        drone.x += nx * drone.diveSpeed;
        drone.y += ny * drone.diveSpeed;
    },
    updateHoming(drone, enemies, buildings) {
        const baseSpeed = Math.max(0.1, (drone.stats?.speed || 1) * (Number.isFinite(drone.launchSpeedMul) ? drone.launchSpeedMul : 1));

        // [?˜ì •] ?Œë ˆ??ë§ì•„???¼ë? ?íƒœ????(?€ê²ŸíŒ… ë¶ˆê?, ì§ì§„)
        if (drone.confusedTimer > 0) {
            drone.confusedTimer--;
            // ê·¸ëƒ¥ ?„ì¬ ë°©í–¥(?¹ì? ?ìœ¼ë¡? ì­?? ì•„ê°?
            const dir = drone.team === 'player' ? 1 : -1;
            drone.x += baseSpeed * dir;
            // ?Œì „/?™ìš” ?¨ê³¼
            drone.y += Math.sin(game.frame * 0.5) * 2;
            if (this.trySuicideImpactDetonation(drone, enemies)) return;
            return;
        }

        // Swarm Move Logic (ëª…ì‹œ??move ?íƒœ?ì„œë§?
        if (drone.swarmTarget && drone.commandState === 'move') {
            const dx = drone.swarmTarget.x - drone.x;
            const dy = drone.swarmTarget.y - drone.y;
            const distSq = dx * dx + dy * dy;

            if (distSq < 400) { // Arrived
                drone.swarmTarget = null;
            } else {
                const angle = Math.atan2(dy, dx);
                drone.x += Math.cos(angle) * baseSpeed;
                drone.y += Math.sin(angle) * baseSpeed;
                if (this.trySuicideImpactDetonation(drone, enemies)) return;
                return;
            }
        }
        if (drone.commandState !== 'move') {
            drone.swarmTarget = null;
        }

        const groundY = (typeof game !== 'undefined' && Number.isFinite(game.groundY))
            ? game.groundY
            : null;

        if (this.trySuicideImpactDetonation(drone, enemies)) return;

        // ?€ê²?? íš¨??ì²´í¬ (dead/?„êµ°/?€??ë¬´ì /ê³µì¤‘ ?€ê²??œì™¸)
        if (drone.lockedTarget) {
            const lt = drone.lockedTarget;
            const ltStats = lt.stats || {};
            const invalidLocked = (
                lt.dead ||
                lt.team === drone.team ||
                lt.team === 'neutral' ||
                ltStats.stealth === true ||
                ltStats.invulnerable === true ||
                ltStats.type === 'air'
            );
            if (invalidLocked) {
                drone.lockedTarget = null;
                drone.attackPhase = null;
                drone.lockedPursuitFrames = 0;
            }
        }

        if (drone.lockedTarget) {
            drone.commandState = 'locked';
            drone.noTargetFrames = 0;
            // While cruising/climbing, allow dynamic retarget to higher-priority targets.
            const dynamicRetargetEnabled = drone.dynamicRetargetEnabled !== false;
            const dynamicRetargetMarginRaw = Number(drone.dynamicRetargetMargin);
            const dynamicRetargetMargin = Number.isFinite(dynamicRetargetMarginRaw)
                ? Math.max(0, dynamicRetargetMarginRaw)
                : 60;
            const currentTarget = drone.lockedTarget;
            const currentDistForRetarget = Math.abs((Number(currentTarget && currentTarget.x) || drone.x) - drone.x);
            const retargetPhase = String(drone.attackPhase || '').trim().toLowerCase();
            const retargetFrames = Number(drone.lockedPursuitFrames) || 0;
            const retargetAllowedPhase = (retargetPhase === '' || retargetPhase === 'climb');
            if (drone.autoSeekTarget === true
                && dynamicRetargetEnabled
                && retargetAllowedPhase
                && retargetFrames < 110
                && currentDistForRetarget > 320) {
                const candidateTarget = this.findNearestEnemy(drone, enemies, buildings);
                if (candidateTarget && candidateTarget !== currentTarget) {
                    const currentDist = Math.abs((Number(currentTarget.x) || drone.x) - drone.x);
                    const candidateDist = Math.abs((Number(candidateTarget.x) || drone.x) - drone.x);
                    const currentArmored = this.isArmoredTarget(currentTarget, !currentTarget.stats);
                    const candidateArmored = this.isArmoredTarget(candidateTarget, !candidateTarget.stats);
                    const shouldSwitch =
                        (candidateArmored && !currentArmored) ||
                        (candidateArmored === currentArmored && candidateDist + dynamicRetargetMargin < currentDist);
                    if (shouldSwitch) {
                        drone.lockedTarget = candidateTarget;
                        drone.attackTarget = candidateTarget;
                        drone.attackPhase = 'climb';
                        drone.lockedPursuitFrames = 0;
                    }
                }
            }
            drone.lockedPursuitFrames = (Number(drone.lockedPursuitFrames) || 0) + 1;
            drone.attackTarget = drone.lockedTarget;
            const tx = drone.lockedTarget.x;
            const ty = this.getTargetImpactY(
                drone.lockedTarget,
                (groundY !== null) ? (groundY - 8) : drone.y
            );
            const targetWidth = Math.max(24, Number(drone.lockedTarget.width) || 0);
            const diveFloorY = this.getDiveFloorY(
                (groundY !== null) ? groundY : drone.y,
                drone.lockedTarget
            );
            const engageDistBase = Math.max(180, Number(drone.attackDiveTriggerRange) || 260);
            const engageDist = Math.min(520, engageDistBase + Math.min(120, targetWidth * 0.85));
            if (String(drone.stats?.id || '').trim() === 'drone_suicide' && (drone.lockedPursuitFrames || 0) > 240) {
                const dxRetry = Math.abs(tx - drone.x);
                if (dxRetry > 320) {
                    const retryTarget = this.findNearestEnemy(drone, enemies, buildings);
                    if (!retryTarget || retryTarget === drone.lockedTarget) {
                        drone.lockedTarget = null;
                        drone.attackTarget = null;
                        drone.attackPhase = null;
                        drone.lockedPursuitFrames = 0;
                        return;
                    }
                    drone.lockedTarget = retryTarget;
                    drone.attackTarget = retryTarget;
                    drone.attackPhase = 'climb';
                    drone.lockedPursuitFrames = 0;
                }
            }
            const attackCruiseY = Number.isFinite(drone.attackCruiseY)
                ? drone.attackCruiseY
                : ((groundY !== null) ? (groundY - 430) : (drone.y - 140));
            drone.attackCruiseY = attackCruiseY;

            const postLaunchHoverFrames = Number(drone.postLaunchHoverFrames);
            if (postLaunchHoverFrames > 0) {
                drone.attackPhase = 'cruise';
                if (diveFloorY !== null && drone.y > diveFloorY) {
                    drone.y = diveFloorY;
                }
                const settle = attackCruiseY - drone.y;
                drone.y += Math.max(-1.1, Math.min(1.1, settle * 0.2));
                drone.postLaunchHoverFrames = postLaunchHoverFrames - 1;
                return;
            }

            if (!drone.attackPhase) {
                const highEnough = (groundY === null) ? true : (drone.y <= attackCruiseY + 6);
                drone.attackPhase = highEnough ? 'cruise' : 'climb';
            }

            if (diveFloorY !== null && drone.y > diveFloorY) {
                drone.y = diveFloorY;
            }

            if (drone.attackPhase === 'climb') {
                const climbSpeed = Math.max(0.6, Math.min(1.15, baseSpeed * 0.5));
                const dxClimb = tx - drone.x;
                if (Math.abs(dxClimb) <= engageDist) {
                    // Enter dive as soon as target enters the attack trigger range.
                    this.playPreAttackCue(drone, tx);
                    drone.attackPhase = 'dive';
                }
                if (drone.y > attackCruiseY + 2) {
                    drone.y = Math.max(attackCruiseY, drone.y - climbSpeed);
                    if (Math.abs(dxClimb) > 12) {
                        const climbChaseSpeed = Math.max(baseSpeed * 0.7, baseSpeed + 0.3);
                        drone.x += Math.sign(dxClimb) * Math.min(climbChaseSpeed, Math.abs(dxClimb));
                    }
                    if (drone.attackPhase !== 'dive') return;
                }
                if (drone.attackPhase !== 'dive') {
                    drone.attackPhase = 'cruise';
                }
            }

            if (drone.attackPhase === 'cruise') {
                const dxCruise = tx - drone.x;
                const nearEnoughForDive = Math.abs(dxCruise) <= (engageDist * 1.15);
                const forceDive = (drone.lockedPursuitFrames || 0) >= 130;
                if (Math.abs(dxCruise) > engageDist && !nearEnoughForDive && !forceDive) {
                    const chaseSpeed = Math.max(baseSpeed * 1.8, baseSpeed + 1.8);
                    drone.x += Math.sign(dxCruise) * Math.min(chaseSpeed, Math.abs(dxCruise));
                    const settle = attackCruiseY - drone.y;
                    drone.y += Math.max(-1.2, Math.min(1.2, settle * 0.2));
                    return;
                }
                // ? íš¨ ì§„ì…ê±°ë¦¬ ?„ë‹¬ ??ë©ˆì¶”ì§€ ?Šê³  ì¦‰ì‹œ ?€ê°ì„  ?Œì…
                this.playPreAttackCue(drone, tx);
                drone.attackPhase = 'dive';
            }

            const dx = tx - drone.x;
            const dy = ty - drone.y;
            const distSq = dx * dx + dy * dy;
            if (distSq < 2500) {
                drone.explode(drone.lockedTarget);
                return;
            }
            if (this.shouldDetonateOnLockedTarget(drone, drone.lockedTarget, dx, dy)) {
                drone.explode(drone.lockedTarget);
                return;
            }
            if (diveFloorY !== null
                && drone.y >= (diveFloorY - 3)
                && Math.abs(dx) <= Math.max(26, targetWidth * 0.85)) {
                drone.explode(drone.lockedTarget);
                return;
            }
            if ((drone.lockedPursuitFrames || 0) > 300 && Math.abs(dx) < 90 && Math.abs(dy) < 120) {
                drone.explode(drone.lockedTarget);
                return;
            }

            const angle = Math.atan2(dy, dx);
            const diveSpeed = Math.max(baseSpeed * 1.2, baseSpeed + 1.4);
            drone.x += Math.cos(angle) * diveSpeed;
            drone.y += Math.sin(angle) * diveSpeed;
            if (diveFloorY !== null && drone.y > diveFloorY - 2) {
                drone.y = diveFloorY - 2;
            }
            if (this.trySuicideImpactDetonation(drone, enemies)) return;
            return;
        } else {
            drone.lockedPursuitFrames = 0;
            drone.noTargetFrames = (Number(drone.noTargetFrames) || 0) + 1;
            // ?ë™ ì¶”ì ??ì¼œì§„ ?œë¡ ë§?? ê·œ ?€ê²Ÿì„ ?ë“?œë‹¤.
            if (drone.autoSeekTarget === true) {
                const newTarget = this.findNearestEnemy(drone, enemies, buildings);
                if (newTarget) {
                    drone.lockedTarget = newTarget;
                    drone.commandState = 'locked';
                    drone.lockedPursuitFrames = 0;
                    drone.noTargetFrames = 0;
                    drone.attackPhase = null;
                    return;
                }
            }

            // ê¸°ë³¸ ?íƒœ: ì§€???€ê¸?(?˜ë™ ?½ë‹¤???ëŠ” ?´ë™ ëª…ë ¹ ?€ê¸?
            drone.attackTarget = null;
            drone.attackPhase = null;
            if (drone.commandState !== 'move') {
                drone.commandState = 'standby';
            }
            if (groundY !== null) {
                const settleSpeed = Math.max(0.8, baseSpeed * 0.6);
                if (drone.y < groundY) {
                    drone.y = Math.min(groundY, drone.y + settleSpeed);
                } else if (drone.y > groundY) {
                    drone.y = groundY;
                }
                // Fallback: if target was lost at high altitude, keep drifting forward while descending.
                if (drone.noTargetFrames > 45 && drone.y < groundY - 60) {
                    const sweepDir = (drone.team === 'player') ? 1 : -1;
                    drone.x += Math.max(0.8, baseSpeed * 0.9) * sweepDir;
                }
            }
            if (String(drone.stats?.id || '').trim() === 'drone_suicide' && drone.noTargetFrames > 120) {
                const sweepDir = (drone.team === 'player') ? 1 : -1;
                drone.x += Math.max(1.1, baseSpeed * 1.25) * sweepDir;
            }
            if (this.trySuicideImpactDetonation(drone, enemies)) return;
            return;
        }
    },
    getTargetImpactY(target, fallbackY = null) {
        const fallback = Number(fallbackY);
        if (!target) return Number.isFinite(fallback) ? fallback : 0;
        const tyRaw = Number(target.y);
        if (!Number.isFinite(tyRaw)) {
            return Number.isFinite(fallback) ? fallback : 0;
        }
        const targetStats = target.stats || {};
        const targetHeight = Math.max(10, Number(target.height || targetStats.height || 20));
        const impactOffset = Math.max(6, targetHeight * 0.35);
        return tyRaw - impactOffset;
    },
    getDiveFloorY(baseY, target = null) {
        const base = Number(baseY);
        let floorY = Number.isFinite(base) ? base : 0;
        if (typeof game !== 'undefined' && game && typeof game.getGroundLaneBounds === 'function') {
            const laneBounds = game.getGroundLaneBounds();
            const laneMax = Number(laneBounds && laneBounds.max);
            if (Number.isFinite(laneMax)) {
                floorY = Math.max(floorY, laneMax);
            }
        }
        if (target) {
            const targetY = Number(target.y);
            if (Number.isFinite(targetY)) {
                floorY = Math.max(floorY, targetY + 2);
            }
        }
        return floorY;
    },
    shouldDetonateOnLockedTarget(drone, target, dx, dy) {
        if (!drone || !target || target.dead) return false;
        const absDx = Math.abs(Number(dx));
        const absDy = Math.abs(Number(dy));
        if (!Number.isFinite(absDx) || !Number.isFinite(absDy)) return false;
        const droneStats = drone.stats || {};
        const targetStats = target.stats || {};
        const droneWidth = Math.max(10, Number(drone.width || droneStats.width || 16));
        const droneHeight = Math.max(6, Number(drone.height || droneStats.height || 8));
        const targetWidth = Math.max(12, Number(target.width || targetStats.width || 32));
        const targetHeight = Math.max(10, Number(target.height || targetStats.height || 20));
        const radiusX = Math.max(20, (droneWidth + targetWidth) * 0.55);
        const radiusY = Math.max(16, (droneHeight + targetHeight) * 0.72);
        const nx = absDx / Math.max(1, radiusX);
        const ny = absDy / Math.max(1, radiusY);
        return ((nx * nx) + (ny * ny)) <= 1;
    },
    trySuicideImpactDetonation(drone, enemies) {
        if (!drone || drone.dead) return false;
        if (String(drone.stats?.id || '').trim() !== 'drone_suicide') return false;
        if (!Array.isArray(enemies) || enemies.length <= 0) return false;

        const droneX = Number(drone.x);
        const droneY = Number(drone.y);
        if (!Number.isFinite(droneX) || !Number.isFinite(droneY)) return false;

        const droneWidth = Math.max(10, Number(drone.width || drone.stats?.width || 16));
        const droneHeight = Math.max(6, Number(drone.height || drone.stats?.height || 8));

        let impactTarget = null;
        let bestScore = Infinity;

        for (let i = 0; i < enemies.length; i++) {
            const target = enemies[i];
            if (!target || target.dead) continue;
            if (target.team === drone.team || target.team === 'neutral') continue;

            const tStats = target.stats || {};
            if (tStats.stealth === true || tStats.invulnerable === true) continue;


            const tx = Number(target.x);
            const tyRaw = Number(target.y);
            if (!Number.isFinite(tx) || !Number.isFinite(tyRaw)) continue;

            const targetWidth = Math.max(12, Number(target.width || tStats.width || 32));
            const targetHeight = Math.max(10, Number(target.height || tStats.height || 20));
            const targetCenterY = tyRaw - (targetHeight * 0.5);

            const dx = Math.abs(tx - droneX);
            const dy = Math.abs(targetCenterY - droneY);
            const hitRadiusX = Math.max(14, ((droneWidth + targetWidth) * 0.5) - 2);
            const hitRadiusY = Math.max(10, ((droneHeight + targetHeight) * 0.5) + 4);

            const nx = dx / Math.max(1, hitRadiusX);
            const ny = dy / Math.max(1, hitRadiusY);
            if ((nx * nx + ny * ny) > 1) continue;

            const score = dx + dy;
            if (score < bestScore) {
                bestScore = score;
                impactTarget = target;
            }
        }

        if (!impactTarget) return false;
        drone.explode(impactTarget);
        return true;
    },
    isArmoredTarget(target, asBuilding = false) {
        if (!target) return false;
        if (asBuilding) return true;
        const tStats = target.stats || {};
        const tId = String(tStats.id || '').toLowerCase();
        const tCategory = String(tStats.category || '').toLowerCase();
        const tType = String(tStats.type || target.type || '').toLowerCase();
        if (target.armored === true) return true;
        if (tType.includes('hq') || tType.includes('fortress') || tType.includes('turret') || tType.includes('bunker')) return true;
        if (tCategory === 'armored') return true;
        if (tType === 'mech' || tType === 'vehicle' || tType === 'tank') return true;
        if (['mbt', 'apc', 'aa_tank', 'humvee', 'spg', 'tank', 'ifv', 'sam', 'mlrs'].includes(tId)) return true;
        if (Number(target.maxHp) >= 220) return true;
        if (Number(target.width) >= 48) return true;
        return false;
    },
    findNearestEnemy(drone, enemies, buildings) {
        const x = drone.x;
        const team = drone.team;
        const droneId = String(drone && drone.stats && drone.stats.id || '').trim().toLowerCase();
        const isAtDrone = droneId === 'drone_at';
        const isSuicideDrone = droneId === 'drone_suicide';
        const seekRangeRaw = Number(drone.stats?.seekRange);
        const defaultSeekRange = isSuicideDrone ? 1300 : 2200;
        const seekRange = Number.isFinite(seekRangeRaw) ? Math.max(300, seekRangeRaw) : defaultSeekRange;
        const maxSeekSq = seekRange * seekRange;
        let bestArmored = null;
        let bestArmoredSq = Infinity;
        let bestInfantry = null;
        let bestInfantrySq = Infinity;
        let bestBuilding = null;
        let bestBuildingSq = Infinity;

        const considerTarget = (target, asBuilding = false) => {
            if (!target || target.dead) return;
            if (target.team === team || target.team === 'neutral') return;
            const tStats = target.stats || {};
            if (!asBuilding && tStats.type === 'air') return;
            if (!asBuilding && (tStats.stealth === true || tStats.invulnerable === true)) return;
            const dx = Number(target.x) - x;
            if (!Number.isFinite(dx)) return;
            const dSq = dx * dx;
            if (dSq > maxSeekSq) return;

            if (asBuilding) {
                if (dSq < bestBuildingSq) {
                    bestBuildingSq = dSq;
                    bestBuilding = target;
                }
                return;
            }

            if (this.isArmoredTarget(target, false)) {
                if (dSq < bestArmoredSq) {
                    bestArmoredSq = dSq;
                    bestArmored = target;
                }
            } else if (dSq < bestInfantrySq) {
                bestInfantrySq = dSq;
                bestInfantry = target;
            }
        };

        for (let i = 0; i < enemies.length; i++) {
            considerTarget(enemies[i], false);
        }
        if (buildings && buildings.length) {
            for (let i = 0; i < buildings.length; i++) {
                considerTarget(buildings[i], true);
            }
        }

        // AT µå·Ğ: Àå°©/°Ç¹° ¿ì¼±
        if (isAtDrone) {
            return bestArmored || bestBuilding || bestInfantry || null;
        }

        // ÀÚÆøµå·Ğ: º¸º´/¿¬¼ºÇ¥Àû ¿ì¼±. ¸Õ °Ç¹° ÃßÀûÀ¸·Î »ó°ø ¹èÈ¸ÇÏ´Â Çö»ó ¹æÁö.
        if (isSuicideDrone) {
            const nearBuildingLimitSq = Math.pow(Math.min(seekRange, 700), 2);
            if (bestInfantry) return bestInfantry;
            if (bestArmored) return bestArmored;
            if (bestBuilding && bestBuildingSq <= nearBuildingLimitSq) return bestBuilding;
            return null;
        }

        return bestArmored || bestInfantry || bestBuilding || null;
    }
};



