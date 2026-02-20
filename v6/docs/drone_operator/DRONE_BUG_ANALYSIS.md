# 드론병(drone_operator) 버그 분석 문서

> 작성일: 2026-02-21
> 최종 업데이트: 2026-02-21 (파일 분리 반영)
> 브랜치: RECLAIM_v6_dev
> 상태: **분석 완료 / 수정 작업 대기**

---

## 목차

1. [시스템 구조 요약](#1-시스템-구조-요약)
2. [버그 목록](#2-버그-목록)
   - [BUG-01] 무한 드론 생성
   - [BUG-02] 스킬 사용 후 버튼 미비활성화
   - [BUG-03] 스킬 드론이 적을 공격하지 않음
   - [BUG-04] 구형(旧) 드론과의 상태 꼬임
   - [BUG-05] 발진-회수 과정 꼬임
3. [수정 우선순위 및 방향](#3-수정-우선순위-및-방향)
4. [회수(recall) 임시 비활성화 제안](#4-회수recall-임시-비활성화-제안)

---

## 1. 시스템 구조 요약

### 관련 파일

| 파일 | 역할 |
|------|------|
| `classes.js` (L1515~1683) | 드론병 AI 업데이트 (rifle/laptop 모드 전환, 자동 발진) |
| `src/units/drone/drone-manager.js` | `addOperatorDrone`, `removeOperatorDrone`, `getAliveOperatorDrones`, `findDroneOwner` 등 소유권/상태 관리 |
| `src/units/drone/drone-commands.js` | `launchOperatorDroneFromCommand`, `spawnDroneForOperator`, `requestDroneRecall`, `requestRecallFromSelection` 등 발진/회수 커맨드 |
| `src/units/drone/drone-behavior.js` | 드론 AI 프레임 업데이트 (recall 단계, homing, stealth) |
| `hud.js` (L620~750) | 드론 버튼 활성화 조건, `canDroneSuicide`, `canDroneAt` |
| `data.js` (L220~270) | 드론 스탯 정의 (`droneCharges: 1`) |

### 드론병 발진 경로 (두 가지가 병존)

```
[경로 A] HUD 버튼 클릭
  → hud.js executeCommand('drone_suicide' / 'drone_at')
  → game.launchOperatorDroneFromCommand(droneKey)          ← drone-commands.js
  → game.spawnDroneForOperator(op, droneKey)               ← drone-commands.js
  → game.addOperatorDrone(op, drone)                       ← drone-manager.js → opState = 'laptop'
  → op.droneChargesLeft -= 1

[경로 B] classes.js AI 자동 발진 (autoDeploy = true, 주로 AI 오퍼레이터)
  → rifle 모드 + 적 감지 → shouldDeploy = true
  → this.opState = 'laptop'             ← 먼저 상태 전환
  → game.spawnUnitDirect(deployType)    ← 드론 스폰
  → game.addOperatorDrone(this, drone)  ← drone-manager.js
  → this.droneChargesLeft -= 1         ← 드론 성공 시만 차감
```

### 드론 상태 필드 (이중 구조 문제)

```
operator.ownedDrone    = 단일 레퍼런스 (구형, 마지막 드론만)
operator.ownedDrones[] = 배열 (신형, 다중 드론 지원)
operator.opState       = 'rifle' | 'laptop'
operator.droneChargesLeft = 남은 발진 횟수 (초기값: stats.droneCharges = 3)
```

---

## 2. 버그 목록

---

### [BUG-01] 무한 드론 생성

**증상**: 스킬 사용 후 드론이 무한히 생성됨
**심각도**: Critical
**위치**: `classes.js:1574~1614`, `src/units/drone/drone-commands.js` (launchOperatorDroneFromCommand, spawnDroneForOperator)

#### 원인 A — spawnUnitDirect 실패 시 droneChargesLeft 미차감 루프

```js
// classes.js:1575~1614
if (shouldDeploy && deployType) {
    this.opState = 'laptop';  // ← (1) 먼저 laptop으로 전환

    if (game && game.spawnUnitDirect) {
        const drone = game.spawnUnitDirect(...);
        if (drone) {
            // ... 드론 설정 ...
            this.droneChargesLeft -= 1;  // ← (2) 드론 스폰 성공 시만 차감
        }
        // ← drone이 null이면 droneChargesLeft 차감 없음!
    }
    return;
}

// 다음 프레임 laptop 모드:
if (this.opState === 'laptop') {
    aliveCount = game.getAliveOperatorDrones(this).length;
    if (aliveCount <= 0) {
        this.opState = 'rifle';  // ← (3) rifle 복귀, 차감 없었으므로 charges 그대로
    }
}
// → rifle 복귀 후 enemy 감지 → 다시 deploy → 무한 반복
```

**재현 조건**: `game.spawnUnitDirect`가 null을 반환하거나 `bypassBlock`이 막힐 때

#### 원인 B — launchOperatorDroneFromCommand가 opState를 확인하지 않음

```js
// src/units/drone/drone-commands.js (launchOperatorDroneFromCommand)
const operators = this.getDeployableOperatorsForDrone(droneKey);
// getDeployableOperatorsForDrone = droneChargesLeft > 0 만 체크
// → opState === 'laptop' 인 오퍼레이터도 재발진 대상에 포함됨!

operators.forEach(op => {
    const drone = this.spawnDroneForOperator(op, droneKey);
    // → 이미 laptop 중인 오퍼레이터가 추가 드론 발진 가능
});
```

**결과**: 버튼 연타 시 charges 소진 전까지 매번 새 드론 생성 (charges 3이면 3개까지)
→ 이것이 "무한"처럼 느껴지는 핵심 원인 (회수 후 charges 복구 → 또 발진 반복 가능)

#### 원인 C — 경로 A·B 중복 실행 가능성

같은 프레임 내에서 HUD 버튼 클릭(경로 A)과 AI 업데이트(경로 B)가 모두 실행될 경우 동일 오퍼레이터에 드론이 이중 스폰될 수 있음.

---

### [BUG-02] 스킬 사용 후 버튼 미비활성화

**증상**: 드론을 발진한 후에도 HUD 드론 버튼이 회색(disabled)으로 전환되지 않음
**심각도**: High
**위치**: `hud.js:645~653`, `hud.js:692~693`

#### 원인

```js
// hud.js:645~647
const deployableOperators = selectedOperators.filter(u =>
    (u.droneChargesLeft || 0) > 0  // ← opState 체크 없음!
);

// hud.js:692~693
canDroneSuicide: deployableOperatorsForSuicide.length > 0,
canDroneAt:      deployableOperatorsForAt.length > 0,
```

`droneChargesLeft > 0`만 체크하므로, 오퍼레이터가 laptop 모드 중이고 charges가 남아있으면 버튼이 활성화 상태를 유지함.

**기대 동작**: 오퍼레이터가 laptop 모드이거나 이미 최대 드론 수를 운용 중이면 버튼 비활성화

---

### [BUG-03] 스킬 드론이 적을 공격하지 않음

**증상**: 발진된 드론이 standby 상태로 대기만 하고 공격을 시작하지 않음
**심각도**: High
**위치**: `src/units/drone/drone-commands.js` (spawnDroneForOperator), `src/units/drone/drone-behavior.js` (updateHoming)

#### 원인

```js
// src/units/drone/drone-commands.js (spawnDroneForOperator)
drone.autoSeekTarget = false;     // 자동추적 비활성화
drone.commandState = 'standby';   // 대기 상태로 생성
drone.lockedTarget = null;        // 타겟 없음
```

```js
// src/units/drone/drone-behavior.js (updateHoming)
} else {
    // 자동 추적은 AI 드론만 허용
    if (drone.autoSeekTarget === true && drone.team !== 'player') {
        // player 드론은 이 블록에 진입 못함
    }
    // 결과: lockedTarget 없음 → 영원히 standby
    drone.commandState = 'standby';
}
```

플레이어 드론은 `lockedTarget`이 명시적으로 설정되지 않으면 절대 공격하지 않음.
HUD의 "락다운" 명령이 `lockedTarget`을 설정해야 하는데, 드론 생성 후 자동 락다운이 연결되지 않음.

**구체적 흐름 문제**:
1. `spawnDroneForOperator`로 드론 생성 → standby
2. 플레이어가 락다운 커맨드를 내려야 `lockedTarget` 설정됨
3. 락다운 UI와 드론 발진 UI가 별도 동작 → 발진 직후 자동 타겟팅 없음

---

### [BUG-04] 구형(旧) 드론과의 상태 꼬임

**증상**: ownedDrone과 ownedDrones 불일치, 예상치 못한 드론 연결 해제
**심각도**: Medium
**위치**: `src/units/drone/drone-manager.js`, `classes.js:116~127`

#### 원인

두 가지 소유 필드가 병존:

```js
// classes.js:119~121 (초기화)
this.ownedDrone = null;      // 구형: 단일 드론만 추적
this.ownedDrones = [];       // 신형: 다중 드론 배열
```

```js
// src/units/drone/drone-manager.js (addOperatorDrone)
const alive = this.getAliveOperatorDrones(operator); // ← ownedDrones 덮어씀
if (!alive.includes(drone)) alive.push(drone);
operator.ownedDrones = alive;
operator.ownedDrone = drone;  // ← 항상 "마지막" 드론으로 덮어씀
```

```js
// src/units/drone/drone-manager.js (getAliveOperatorDrones)
operator.ownedDrones = alive;                                        // 배열 덮어씀
operator.ownedDrone = alive.length > 0 ? alive[alive.length - 1] : null; // 단일도 덮어씀
```

**문제 시나리오**:
- `ownedDrone` 참조를 직접 쓰는 구형 코드가 신형 배열과 불일치
- `addOperatorDrone` 호출이 여러 곳에서 중복 실행될 때 배열 상태 불안정
- `src/units/drone/drone-behavior.js` recall 처리 중 `addOperatorDrone` 재호출 → 의도치 않은 opState 재설정

---

### [BUG-05] 발진-회수 과정 꼬임

**증상**: 회수(recall) 중 드론이 엉뚱한 오퍼레이터에 붙거나, 회수 완료 후 charges 복구 오류
**심각도**: Medium~High
**위치**: `src/units/drone/drone-commands.js` (requestDroneRecall), `src/units/drone/drone-behavior.js` (recall 단계)

#### 원인 A — 강제 owner 결속 로직

```js
// src/units/drone/drone-commands.js (requestDroneRecall)
// 2차: owner 없으면 가장 가까운 operator를 강제 결속
if (!owner || owner.dead) {
    const availableOps = this.players.filter(p => p && !p.dead && p.stats?.operator);
    if (availableOps.length > 0) {
        owner = nearest; // ← 가장 가까운 아무 오퍼레이터에 납치!
        this.addOperatorDrone(owner, drone); // ← 그 오퍼레이터를 laptop으로 전환
    }
}

// + owner 결속 동기화 (항상 실행)
if (owner && !owner.dead) {
    this.addOperatorDrone(owner, drone); // ← addOperatorDrone 중복 호출
}
```

#### 원인 B — recall 중 addOperatorDrone 재호출

```js
// src/units/drone/drone-behavior.js (recall 처리, 매 프레임 실행 가능)
if (!owner && typeof game !== 'undefined') {
    owner = game.findDroneOwner(drone, false);
    if (owner) {
        game.addOperatorDrone(owner, drone); // ← recall 중에도 opState 재설정
    }
}
```

#### 원인 C — pickup 완료 시 charges 복구 버그

```js
// src/units/drone/drone-behavior.js (recallPhase === 'pickup')
const maxCharges = owner.stats?.droneCharges || owner.droneChargesLeft || 1;
//                                               ↑ droneChargesLeft가 0이면 fallback = 1!
owner.droneChargesLeft = Math.min((owner.droneChargesLeft || 0) + 1, maxCharges);
```

`owner.stats?.droneCharges`가 undefined일 때 `droneChargesLeft`가 0이면 maxCharges=1로 잘못 계산됨.

---

## 3. 수정 우선순위 및 방향

| 우선순위 | 버그 | 수정 방향 |
|----------|------|-----------|
| P0 | BUG-01 무한 드론 생성 | `drone-commands.js:launchOperatorDroneFromCommand`에서 `op.opState === 'laptop'` 체크 추가; `classes.js`에서 spawnUnitDirect 실패 시 `opState` 롤백 |
| P0 | BUG-02 버튼 미비활성화 | `deployableOperators` 필터에 `op.opState !== 'laptop'` 조건 추가 (또는 `getAliveOperatorDrones(op).length === 0`) |
| P1 | BUG-03 드론 공격 안 함 | `drone-commands.js:spawnDroneForOperator` 후 락다운 자동 연결, 또는 UI 플로우 재검토 |
| P1 | BUG-05 회수 꼬임 | 강제 owner 결속 제거 또는 조건 강화; recall 중 addOperatorDrone 호출 제한 |
| P2 | BUG-04 구형 꼬임 | ownedDrone 단일 필드 제거 후 ownedDrones 배열로 통일 |

---

## 4. 회수(recall) 임시 비활성화 제안

사용자 요청에 따라 발진-회수 꼬임 해결 전까지 회수 기능을 숨김 처리하는 것을 권장.

### 비활성화 범위

1. **HUD 회수 버튼** — recall 명령 버튼을 조건부 hide 처리
2. **unit_commands.js** — `requestDroneRecall` 호출 주석처리
3. **src/units/drone/drone-behavior.js** — `recallRequested` 브랜치 전체를 조건 플래그로 감싸기

### 임시 비활성화 플래그 (제안)

```js
// src/units/drone/drone-commands.js 상단 또는 config.js 에 추가
const DRONE_RECALL_ENABLED = false; // TODO: recall 버그 수정 후 true로 복구
```

```js
// src/units/drone/drone-behavior.js (recallRequested 브랜치 진입부)
if (DRONE_RECALL_ENABLED && drone.recallRequested) {
    // ... recall 로직 전체
}
```

```js
// src/units/drone/drone-commands.js (requestDroneRecall 최상단)
requestDroneRecall(drone) {
    if (!DRONE_RECALL_ENABLED) return false; // 임시 비활성화
    // ...
}
```

### 비활성화 시 드론 동작

- 드론은 발진 후 `standby` 또는 `locked` 상태 유지
- 자연사(폭발) 후 operator는 rifle 모드로 복귀
- charges가 남아있으면 재발진 가능 (recall 없이도 동작)

---

## 5. 코드 위치 참조 요약

| 기능 | 파일 |
|------|------|
| 드론병 초기화 | `classes.js:115~127` |
| rifle 모드 발진 AI | `classes.js:1519~1614` |
| laptop 모드 생존 체크 | `classes.js:1657~1682` |
| HUD 발진 커맨드 | `src/units/drone/drone-commands.js` (launchOperatorDroneFromCommand) |
| 드론 스폰 함수 | `src/units/drone/drone-commands.js` (spawnDroneForOperator) |
| 회수 요청 함수 | `src/units/drone/drone-commands.js` (requestDroneRecall, requestRecallFromSelection) |
| 드론 소유 추가/제거 | `src/units/drone/drone-manager.js` (addOperatorDrone, removeOperatorDrone) |
| 드론 AI (recall/homing) | `src/units/drone/drone-behavior.js` |
| HUD 버튼 활성화 조건 | `hud.js:645~693` |
| 드론 스탯 정의 | `data.js:220~270` |

---

## 6. 2026-02-20 패치 반영 메모 (경로 정합성)

아래는 실제 수정 반영 기준 파일입니다.

- `src/units/drone/drone-manager.js`
- `src/units/drone/drone-commands.js`
- `src/units/drone/drone-behavior.js`
- `classes.js`
- `hud.js`

### 반영 요약

1. 재발진 차단
- `src/units/drone/drone-manager.js`의 `_canOperatorLaunchDrone()` 기준으로 `laptop` 상태/활성 드론 보유 시 발진 불가.
- `src/units/drone/drone-commands.js` `spawnDroneForOperator()`에도 이중 가드 적용.

2. 공격 미진입 수정
- `src/units/drone/drone-commands.js`에서 수동 발진 드론을 `autoSeekTarget=true`, `commandState='attack'`으로 생성.
- `src/units/drone/drone-behavior.js`에서 auto-seek를 팀 구분 없이 동작하도록 수정.

3. 무한 생성 루프 차단
- `classes.js` `updateDroneOperator()`에서 스폰 성공 시에만 `laptop` 전환.
- 스폰 실패 시 `rifle` 흐름 유지.

4. 회수 꼬임 완화
- `src/units/drone/drone-commands.js` `requestDroneRecall()`에서 소유자 없는 드론을 근접 오퍼레이터에 강제 재연결하지 않음.

5. 충전 복구 안정화
- `classes.js` 오퍼레이터 초기화에 `maxDroneCharges` 추가.
- `src/units/drone/drone-behavior.js` 픽업 복귀 시 `maxDroneCharges` 기반으로 충전량 복구.

- 2026-02-20 추가 정책: 드론병 스킬은 전투 중 1회용이며, 회수(recall) 완료 시에도 `droneChargesLeft`는 복구되지 않음.
