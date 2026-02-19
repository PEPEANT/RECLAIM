# BUG VERIFICATION PLAN (Master Backlog)

## 0) 운영 규칙
1. 한 번에 하나의 이슈만 처리한다.
2. 순서: `재현 -> 원인 확인 -> 수정 -> 재검증 -> 회귀 점검`.
3. 완료 조건을 통과하기 전 다음 이슈로 넘어가지 않는다.
4. 인게임/모바일 이슈는 반드시 수동 확인 시나리오를 남긴다.
5. 상태 표기는 `pending / in_progress / done / blocked`만 사용한다.

## 1) 우선순위 분류
- P0: 게임 진행 불가/판정 오류
- P1: 핵심 전투 체감 저하
- P2: UI/연출/가독성 개선

## 2) 전체 이슈 목록

### A. 전투 판정/치명 버그
- A-01 (P0) 저격수가 가끔 안 죽는 현상
- A-02 (P0) 일부 유닛이 가끔 안 죽는 현상
- A-03 (P0) 국지전 감시탑이 가끔 파괴되지 않는 현상
- A-04 (P0) 명예훈장 지급이 유닛에 적용되지 않는 현상
- A-05 (P0) 점령전에서 아군이 모두 사라지면 즉시 패배되는 현상(규칙 재정의 필요)

### B. 점령전 규칙/밸런스
- B-01 (P1) 점령전 초반 난이도 과다(적군 비율/강도 하향 필요)
- B-02 (P1) 점령전 제한시간 정책: 기본 12분, 첫 점령전만 24분
- B-03 (P1) 점령전 적군 스폰풀 정리(작업병/방송국/정찰기 제외)

### C. 유닛 스케일/포지션/전투 연출
- C-01 (P1) 기갑류 유닛이 전체적으로 작게 보임
- C-02 (P1) 험비가 아래로 내려가 보임(y축 접지 불일치)
- C-03 (P2) RPG병 로켓 폭발 이펙트가 기갑 대상에서 작게 보임
- C-04 (P2) 자주포 발사 미사일 탄체가 너무 커 보임(시각 축소 필요)
- C-05 (P2) ICBM 발사 전 포대 상승(준비) 시간을 더 늦추기

### D. HUD/UI/모바일
- D-01 (P1) 명예훈장 쓰기 UI가 모바일에서 잘림
- D-02 (P2) 인게임 시작 시 채팅 옆 배속 버튼 단순화
  - 요구: 소형 원형, `1x/2x` 단일 선택 토글

### E. 맵 배경 렌더/색감
- E-01 (P1) 점령전/상륙전 배경(섬/구름) 레이어가 줌/카메라 이동 시 분리되어 보임
- E-02 (P2) 국지전 첫 맵/도시맵/마을맵 배경 색감이 너무 강함
  - 요구: 전경 유닛 가독성 우선(배경 톤다운), 원경 레이어 반투명 처리

### F. 경제/시간
- F-01 (P1) 세금 수금 대기시간 단축 필요

## 3) 검증 템플릿 (이슈별 공통)
- 이슈 ID:
- 상태:
- 재현 맵/모드:
- 재현 절차:
- 기대 결과:
- 실제 결과:
- 원인 후보 파일/함수:
- 수정 파일:
- 재검증 결과:
- 회귀 체크:

## 4) 실행 순서 제안
1. P0 먼저: `A-01 -> A-02 -> A-03 -> A-04 -> A-05`
2. 점령전 룰 정리: `B-01 -> B-02 -> B-03`
3. 전투 체감: `C-01 -> C-02 -> C-03 -> C-04 -> C-05`
4. UI/모바일: `D-01 -> D-02`
5. 배경/색감: `E-01 -> E-02`
6. 경제: `F-01`

## 5) 현재 작업 원칙
- 지금은 계획 단계이므로 이 문서를 기준으로 항목별 착수한다.
- 사용자가 새 이슈를 말하면 즉시 이 문서에 항목 ID를 추가한다.

## 6) 진행 로그
- 2026-02-19 (A 단계 착수)
  - A-01/A-02 원인 후보:
    - `projectiles.js`에서 일부 탄종이 `hit()` 조건(근접)과 실제 피해 반경이 달라 직격 누락 가능
  - A-03 원인 후보:
    - `buildings.js takeDamage()` 숫자 안전 처리 부재로 비정상 damage 입력 시 HP가 NaN 고정될 가능성
  - 반영 코드:
    - `projectiles.js` 직격 우선 데미지 + 중복 스플래시 방지
    - `buildings.js` damage/hp 숫자 가드 추가
  - 상태:
    - 코드 적용 완료, 수동 재현 검증 대기

## F 최소 스코프(운영 확정)
필수(반드시 수행)
1. 세금 주기 단축값 적용
2. UI 남은시간 표시와 내부 타이머 동기화
3. 자동/수동 수금 회귀 확인

선택(시간 여유 시)
1. 재접속 후 타이머 복원 확인
2. 세무소 다중 설치 시 오차 확인
3. 배속(1x/2x) 적용 중 타이머 왜곡 확인

## 2026-02-19 Progress Update (A-04)
- Status: fixed (A stage still in progress for A-05)
- Scope: Honor Medal apply reliability
- File: `src/modes/city-sim/construction.js`
- Changes:
  - Added target re-resolution at apply time to prevent stale selection failures.
  - `applyHonorMedalToTarget` now accepts both target id string and target object.
  - Switched Honor Medal modal to compact bar layout (`layout: 'bar'`) for mobile usability.
  - Added apply lock state to prevent duplicate apply races.
  - Added second-tap quick apply on already selected target card.
- Verification:
  - `node -c src/modes/city-sim/construction.js` passed.
  - VM scenario passed for inventory + drillground targets with correct honor decrement and veteran creation.

## 2026-02-19 Progress Update (A-05)
- Status: fixed
- Scope: Occupation wipe-loss guard
- File: `src/game/victory.js`
- Changes:
  - Added `isOccupationBattle` flag extraction.
  - Added alive spawn-flag detection (`spawn_flag_player`).
  - Added wipe-loss ignore guard for occupation battles when HQ is absent but spawn flag is alive.
  - Preserved non-occupation wipe-loss behavior (skirmish remains unchanged).
- Verification:
  - `node -c src/game/victory.js` passed.
  - VM scenario passed:
    - occupation + spawn flag alive + no units => no immediate lose
    - occupation + no HQ/flag + no units => lose
    - skirmish + no HQ + no units => lose (unchanged)
- A stage: complete (`A-01`~`A-05`)

## 2026-02-19 Progress Update (B-01)
- Status: fixed
- Scope: Occupation early difficulty reduction
- Files:
  - `src/ai/ai_config.js`
  - `src/ai/ai_core.js`
  - `src/ai/spawn/spawn_selector.js`
  - `game.js`
- Changes:
  - Stage 1~2 occupation wave caps lowered (`[6,8,10]`, `[7,9,11]`).
  - Stage 1~2 spawn profiles shifted toward infantry/light units; heavy-air weights reduced.
  - Stage 1~2 spawn tempo slowed in AI update (early/mid frame bands).
  - Stage 1~2 early alive-limit tightened (`aliveCap - 4`) and extra reinforcement chance reduced (`* 0.55`).
  - Stage 1~2 initial enemy stock multipliers/min-stock lowered in `initGameObjects`.
- Verification:
  - `node -c src/ai/ai_config.js` passed.
  - `node -c src/ai/ai_core.js` passed.
  - `node -c src/ai/spawn/spawn_selector.js` passed.
  - `node -c game.js` passed.
- Stage status:
  - `B-01` done
  - `B` remains in progress (`B-02`, `B-03` pending)

## 2026-02-19 Progress Update (B-02)
- Status: fixed
- Scope: Occupation stage time-limit policy (`12 min default`, `24 min for first occupation stage`)
- Files:
  - `src/game/victory.js`
  - `game.js`
- Changes:
  - Added occupation attack time-limit helper in victory logic.
  - Applied timeout lose condition for occupation `hq_destroy` battles:
    - stage 1: lose after 24:00 if enemy HQ not destroyed
    - stage 2~6: lose after 12:00 if enemy HQ not destroyed
  - Preserved occupation final stage (stage 7) survival flow (`10:00 defense`).
  - Updated occupation mission objective text to show stage-based timer (`24:00` / `12:00`).
- Verification:
  - `node -c src/game/victory.js` passed.
  - `node -c game.js` passed.
- Stage status:
  - `B-01` done
  - `B-02` done
  - `B-03` pending

## 2026-02-19 Progress Update (B-03)
- Status: fixed
- Scope: Occupation enemy spawn-pool cleanup (remove non-combat units)
- Files:
  - `game.js`
  - `src/ai/spawn/spawn_caps.js`
- Changes:
  - Added centralized enemy spawn-block guard: `isEnemySpawnBlockedUnit(key)`.
  - Excluded non-combat keys from enemy pipeline:
    - `worker`, `recon`, `cameraman`
    - disabled/civilian/builder/cameraman-flag units
  - Applied guard to:
    - initial enemy stock generation (`initGameObjects`)
    - total-war bulk spawn loop (`triggerTotalWar`)
    - normal AI enemy spawn entry (`spawnEnemy`)
    - AI spawn feasibility check (`_canSpawnUnit`)
- Verification:
  - `node -c game.js` passed.
  - `node -c src/ai/spawn/spawn_caps.js` passed.
- Stage status:
  - `B-01` done
  - `B-02` done
  - `B-03` done
  - `B` complete

## 2026-02-19 Progress Update (C-01)
- Status: fixed
- Scope: Armored unit in-battle visual size boost
- File:
  - `classes.js`
- Changes:
  - Added armored-only render scale boost map at unit draw entry.
  - Applied per-unit visual boost:
    - `humvee`: `1.18`
    - `apc`: `1.16`
    - `mbt`: `1.16`
    - `spg`: `1.16`
    - `aa_tank`: `1.12`
  - Kept gameplay values untouched (hp/hitbox/damage/range unchanged).
- Verification:
  - `node -c classes.js` passed.
- Stage status:
  - `C-01` done
  - `C-02` pending

## 2026-02-19 Progress Update (C-02)
- Status: fixed
- Scope: Humvee vertical alignment (slightly lowered look)
- File:
  - `src/entities/unit-render-utils.js`
- Changes:
  - Adjusted humvee feet-snap fallback from `20` to `24`.
  - Result: humvee render anchor is lifted by `+4px` to reduce “sunk” appearance.
- Verification:
  - `node -c src/entities/unit-render-utils.js` passed.
- Stage status:
  - `C-01` done
  - `C-02` done
  - `C-03` pending

## 2026-02-19 Progress Update (C-03)
- Status: fixed
- Scope: RPG/engineer missile explosion readability against armored targets
- Files:
  - `projectiles.js`
  - `src/vfx/explosion.js`
- Changes:
  - Added armored-hit detection for `engineer_missile` impacts.
  - Switched armored impact VFX from `atm` to new `atm_heavy` preset.
  - Added new VFX preset `atm_heavy` and dedicated scale mapping (`0.62`) for stronger on-hit feedback.
  - Non-armored and air-hit behavior remains unchanged (`atm` / `airburst`).
- Verification:
  - `node -c src/vfx/explosion.js` passed.
  - `node -c projectiles.js` passed.
- Stage status:
  - `C-01` done
  - `C-02` done
  - `C-03` done
  - `C-04` pending

## 2026-02-19 Progress Update (C-04)
- Status: fixed
- Scope: SPG projectile visual downscale
- File:
  - `projectiles.js`
- Changes:
  - Applied artillery-only render scale at projectile draw stage:
    - `artilleryVisualScale = 0.78`
  - Only visual size changed; ballistic path / hit logic / damage unchanged.
- Verification:
  - `node -c projectiles.js` passed.
- Stage status:
  - `C-01` done
  - `C-02` done
  - `C-03` done
  - `C-04` done
  - `C-05` pending

## 2026-02-19 Progress Update (C-05)
- Status: fixed
- Scope: Delay ICBM launcher raise/pre-launch timing
- File:
  - `classes.js`
- Changes:
  - Slowed launcher raise step (`icbmAngle` step) from `0.45` to `0.34` deg/frame.
  - Increased pre-launch hold after full raise from `18` to `24` frames before missile fire.
  - Keeps launch payload, damage, and projectile behavior unchanged.
- Verification:
  - `node -c classes.js` passed.
- Stage status:
  - `C-01` done
  - `C-02` done
  - `C-03` done
  - `C-04` done
  - `C-05` done
  - `C` complete

## 2026-02-19 Intake Update (G-01)
- Status: pending
- Priority: P1
- Scope: Tank machine-gun SFX loop persists after retreat or victory.
- Repro note:
  - Trigger retreat or win battle while tank MG loop is active.
  - MG sound should stop immediately on battle-end transition.
- Target fix direction:
  - Flush/stop looped tank-fire channels on retreat, victory, defeat, and scene change.
  - Ensure unit death/despawn also releases tank MG loop handles.

## 2026-02-19 Intake Update (C-06)
- Status: pending
- Priority: P1
- Scope: Drillground unit placement visual bug for ICBM launcher.
- Symptom:
  - When placing icbm launcher unit on drillground, launcher model is not shown.
  - A large missile graphic appears instead of the vehicle body.
- Repro note:
  - Open drillground placement UI.
  - Select ICBM launcher unit.
  - Preview/placed visual renders missile-only at oversized scale.
- Suspected area:
  - ICBM launcher draw path / preview render path mismatch.
  - Scale branch for ICBM missile payload leaking into unit render branch.

## 2026-02-19 Progress Update (C-06)
- Status: in_progress (repro confirmed)
- Scope: Drillground ICBM placement visual mismatch
- Repro verification result:
  - Confirmed by code path inspection.
  - icbm is currently included in drillground missile-icon key set.
- Root cause:
  - In src/modes/city-sim/construction.js, DRILLGROUND_MISSILE_ICON_KEYS contains icbm/icbm_enemy.
  - ppendDrillgroundVisual() routes those keys to drawDrillgroundMissileIcon() instead of drawInventoryUnitIcon().
  - Result: launcher vehicle body preview is replaced by missile-only icon (oversized perception with heavy size class).
- Evidence refs:
  - src/modes/city-sim/construction.js:461
  - src/modes/city-sim/construction.js:2397
  - src/modes/city-sim/construction.js:2568
  - Same duplicated logic exists in src/modes/city-sim/visit-renderer.js.
- Next fix plan:
  - Remove icbm/icbm_enemy from missile-icon key sets.
  - Keep missile icons only for skill payload keys (emp, 
uke, 	actical_missile).

## 2026-02-19 Progress Update (C-06 Fix)
- Status: fixed
- Scope: Drillground ICBM launcher preview should show launcher body, not missile-only icon.
- Files:
  - src/modes/city-sim/construction.js
  - src/modes/city-sim/visit-renderer.js
- Changes:
  - Removed icbm/icbm_enemy from DRILLGROUND_MISSILE_ICON_KEYS.
  - Missile-icon override now applies only to payload skill keys: emp, 
uke, 	actical_missile.
  - ICBM launcher now follows normal unit icon path (drawInventoryUnitIcon).
- Verification:
  - 
ode -c src/modes/city-sim/construction.js passed.
  - 
ode -c src/modes/city-sim/visit-renderer.js passed.
- Outcome:
  - Drillground placement no longer renders oversized missile-only graphic for ICBM launcher.

## 2026-02-19 Progress Update (G-01)
- Status: fixed
- Scope: Tank machine-gun loop SFX lingering after retreat/victory transitions
- Files:
  - game.js
  - src/game/patches/endgame_flow_patch.js
- Changes:
  - Added _stopPersistentBattleSfx() to force-stop per-unit looped MBT MG audio handles.
  - Hooked _stopPersistentBattleSfx() into _cleanupTimers() so it runs on retreat/back-to-lobby/endGame flow.
  - Added forced AudioSystem.stopIcbmRaise(true) in same cleanup path for consistency.
- Verification:
  - 
ode -c game.js passed.
  - 
ode -c src/game/patches/endgame_flow_patch.js passed.
- Outcome:
  - MBT ����� ������ ���� ����/���� �� �ܷ� ������� �ʵ��� ����.

## 2026-02-19 Progress Update (A-06)
- Status: fixed
- Scope: Skirmish air-unit placement failure during predeploy
- File:
  - game.js
- Root cause:
  - spawnUnitDirect() forced all air units to off-map spawn lanes, including skirmish placement phase.
  - As a result, predeploy click placement looked like it failed for air units.
- Changes:
  - Added skirmish placement phase detection in spawnUnitDirect().
  - Disabled off-map air spawn rewrite while SkirmishMode.phase === 'placement'.
  - Normal battle behavior remains unchanged (air units still enter from off-map in combat phase).
- Verification:
  - 
ode -c game.js passed.

## 2026-02-19 Progress Update (C-07)
- Status: fixed
- Scope: Remove legacy ICBM payload icons from unit placement bar and move visuals to command keys
- Files:
  - ui.js
  - hud.js
  - style.css
- Changes:
  - Unit placement bar now always hides `emp`, `nuke`, `tactical_missile` entries (no ICBM payload icons in spawn/placement slots).
  - Added HUD command-icon image support (`cmd-icon-img`) with fallback font icon.
  - Added cached missile icon renderer for ICBM command skills:
    - `icbm_tactical` -> `tactical_missile` icon
    - `icbm_emp` -> `emp` icon
    - `icbm_nuke` -> `nuke` icon
- Verification:
  - node -c ui.js passed.
  - node -c hud.js passed.
- Outcome:
  - ��ġĭ���� �̻��� �������� ��Ÿ���� �ʰ�, ICBM 3��ų ����Ű������ �̻��� �׸��� �����.
