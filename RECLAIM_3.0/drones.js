const DroneBehavior = {
    update(drone, enemies, buildings) {
        if (drone.dead) return;

        if (isNaN(drone.x) || isNaN(drone.y)) {
            drone.dead = true;
            return;
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

    updateStealth(drone, enemies, buildings) {
        // 지정된 위치로 이동(고고도) -> 대각선 하강 -> 광역 폭발
        if (drone.targetX === null || drone.targetX === undefined) {
            drone.dead = true;
            return;
        }

        // init
        if (!drone.stealthPhase) {
            drone.stealthPhase = 'cruise';
            drone.cruiseY = (game && game.groundY ? (game.groundY - 420) : (drone.y - 200));
            drone.y = drone.cruiseY;
            drone.diveSpeed = 8.0;   // 시작 속도 (부드럽게)
        }

        const targetX = drone.targetX;
        const groundY = (game && game.groundY) ? game.groundY : drone.y;

        // 목표 지점 (지면) 좌표
        const tx = targetX;
        const ty = groundY - 8;

        if (drone.stealthPhase === 'cruise') {
            // 1) 수평 이동 + (가까워지면) 자연스러운 하강 시작
            const dx = tx - drone.x;
            const dir = dx > 0 ? 1 : -1;

            // 접근 구간에서 y를 서서히 내려줌 (갑툭튀 낙하 방지)
            const approachDist = 260;      // 이 거리 안에 들어오면 점점 하강
            const descendAmount = 220;     // 크루즈 고도에서 얼마나 내려오며 접근할지
            const t = Math.max(0, Math.min(1, 1 - (Math.abs(dx) / approachDist))); // 0~1
            drone.y = drone.cruiseY + (descendAmount * t);

            drone.x += drone.stats.speed * dir;

            // 충분히 가까우면 "대각선 하강" 단계 진입
            if (Math.abs(dx) <= Math.max(90, drone.stats.speed * 10)) {
                drone.stealthPhase = 'dive';
            }
            return;
        }

        // dive: 목표점(tx, ty)로 "대각선" 가속 이동 (자연스럽게)
        drone.diveSpeed = Math.min(26, (drone.diveSpeed || 8) + 1.0); // 점진 가속
        const dx = tx - drone.x;
        const dy = ty - drone.y;
        const dist = Math.hypot(dx, dy) || 1;

        // 목표 도착(충돌) 처리
        if (dist <= drone.diveSpeed + 6) {
            const radius = drone.stats.splashRadius || 180;
            const baseDmg = drone.stats.damage || 1000;

            // [VFX] 스텔스드론 자폭 폭발
            if (typeof VFX !== 'undefined') {
                VFX.spawn(game, 'stealth', tx, groundY);
            } else {
                if (game && game.createParticles) game.createParticles(tx, groundY, 28, '#f59e0b');
            }
            if (typeof AudioSystem !== 'undefined') AudioSystem.playSFX('explode');

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

            // 유닛/병력 피해: 그대로
            applyAoE(enemies, 1.0);

            // 건물 피해: 절반
            applyAoE(buildings, 0.5);

            drone.dead = true;
            drone.exploded = true;
            return;
        }

        // 이동(대각선) 적용
        const nx = dx / dist;
        const ny = dy / dist;

        drone.x += nx * drone.diveSpeed;
        drone.y += ny * drone.diveSpeed;
    },

    updateHoming(drone, enemies, buildings) {
        // [수정] 플레어 맞아서 혼란 상태일 때 (타겟팅 불가, 직진)
        if (drone.confusedTimer > 0) {
            drone.confusedTimer--;
            // 그냥 현재 방향(혹은 앞으로) 쭉 날아감
            const dir = drone.team === 'player' ? 1 : -1;
            drone.x += drone.stats.speed * dir;
            // 회전/동요 효과
            drone.y += Math.sin(game.frame * 0.5) * 2;
            return;
        }

        // Swarm Move Logic
        if (drone.swarmTarget) {
            const dx = drone.swarmTarget.x - drone.x;
            const dy = drone.swarmTarget.y - drone.y;
            const distSq = dx * dx + dy * dy;

            if (distSq < 400) { // Arrived
                drone.swarmTarget = null;
            } else {
                const angle = Math.atan2(dy, dx);
                drone.x += Math.cos(angle) * drone.stats.speed;
                drone.y += Math.sin(angle) * drone.stats.speed;
                return;
            }
        }

        // 타겟 유효성 체크
        if (drone.lockedTarget && drone.lockedTarget.dead) {
            drone.lockedTarget = null;
        }

        if (drone.lockedTarget) {
            const tx = drone.lockedTarget.x;
            const tH = drone.lockedTarget.height || 20;
            const ty = drone.lockedTarget.y - tH / 2;

            const dx = tx - drone.x;
            const dy = ty - drone.y;
            const distSq = dx * dx + dy * dy;

            if (distSq < 900) {
                drone.explode(drone.lockedTarget);
                return;
            }

            const angle = Math.atan2(dy, dx);
            drone.x += Math.cos(angle) * drone.stats.speed;
            drone.y += Math.sin(angle) * drone.stats.speed;
        } else {
            // 새 타겟 찾기
            const newTarget = this.findNearestEnemy(drone, enemies, buildings);
            if (newTarget) {
                drone.lockedTarget = newTarget;
            } else {
                drone.x += (drone.team === 'player' ? 1 : -1) * drone.stats.speed * 0.5;
                if (drone.x < -100 || drone.x > CONFIG.mapWidth + 100) drone.dead = true;
            }
        }
    },

    findNearestEnemy(drone, enemies, buildings) {
        let t = null;
        let minSq = 999999999;
        const x = drone.x;

        // [OPTIMIZATION] Avoid creating new arrays every frame
        // Use standard loops instead of forEach
        const scan = (arr) => {
            for (let i = 0; i < arr.length; i++) {
                const e = arr[i];
                if (!e || e.dead || e.team === drone.team || e.team === 'neutral') continue;

                const dx = e.x - x;
                const dSq = dx * dx;

                if (dSq < minSq) {
                    minSq = dSq;
                    t = e;
                }
            }
        };

        scan(enemies);

        // [NEW] 유닛 타겟이 없으면 "1차 방어시설 -> 총사령부" 우선순위로 건물 타겟팅
        if (!t && buildings && buildings.length) {
            const wantTower = 'watchtower';
            const wantFortress = (drone.team === 'player') ? 'fortress_enemy' : 'fortress_player';
            const wantRear = (drone.team === 'player') ? 'hq_enemy' : 'hq_player';

            const pickNearestByType = (typeName) => {
                let best = null;
                let bestSq = 999999999;
                for (let i = 0; i < buildings.length; i++) {
                    const b = buildings[i];
                    if (!b || b.dead) continue;
                    if (b.team === drone.team || b.team === 'neutral') continue;
                    if (b.type !== typeName) continue;
                    const dx = b.x - x;
                    const dSq = dx * dx;
                    if (dSq < bestSq) { bestSq = dSq; best = b; }
                }
                return best;
            };

            // 1) 감시탑(방어화력) 최우선
            t = pickNearestByType(wantTower);
            // 2) 그 다음 전방 요새
            if (!t) t = pickNearestByType(wantFortress);
            // 3) 마지막으로 후방 총사령부
            if (!t) t = pickNearestByType(wantRear);

            // 4) 그래도 없으면 HQ류 아무거나(예외 안전망)
            if (!t) {
                let best = null;
                let bestSq = 999999999;
                for (let i = 0; i < buildings.length; i++) {
                    const b = buildings[i];
                    if (!b || b.dead) continue;
                    if (b.team === drone.team || b.team === 'neutral') continue;
                    if (!b.type || !b.type.includes('hq')) continue;
                    const dx = b.x - x;
                    const dSq = dx * dx;
                    if (dSq < bestSq) { bestSq = dSq; best = b; }
                }
                if (best) t = best;
            }
        }
        return t;
    }
};

