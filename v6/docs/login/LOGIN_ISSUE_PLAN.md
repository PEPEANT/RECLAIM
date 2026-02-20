# 로그인 문제 해결 계획서 (A~F 실행 단계)

- 작성일: 2026-02-20
- 대상 버전: `RECLAIM v6`
- 범위: `CitySim` 로그인, 로그아웃, 세션 전환, 클라우드 동기화

## 0. 핵심 문제 요약

1. Google 로그인 후 로그아웃하고 다른 계정/게스트로 진입해도 이전 기지가 보이는 현상
2. 로그인 방식(일반 vs Google) 조합에 따라 방문/연병장 렌더링이 다르게 보이는 현상
3. 가끔 로그아웃 직전 저장은 됐는데 점령/국지전 진행이 초기화되는 현상

## 1. 코드 검증 결론 (현재까지)

### 원인 A: `save.js`의 boot race 우회 로직 (유력도 최고)
- `src/modes/city-sim/save.js:579` 주석: `Boot race fix`
- `src/modes/city-sim/save.js:582` 로직: `!hasUid ? true`
- `src/modes/city-sim/save.js:588` 로직: owner 검증 통과 시 로컬 로드

핵심 맥락:
- UID가 비는 경우는 최소 2종류
1. 앱 초기 부팅 직후 auth 미확정(정상 케이스)
2. 로그아웃 직후/계정 전환 타이밍(문제 케이스)
- 현재는 두 경우를 같은 분기로 처리해 로컬 로드를 허용함.

추가 확정 근거:
- `src/modes/city-sim/save.js:2`의 `STORAGE_KEY = 'reclaim_citysim_v1'`는 계정 무관 단일 키.
- 즉, UID 미확정 타이밍에 로컬 로드가 열리면 이전 계정 데이터가 재노출될 수 있음.

### 원인 B: 로그아웃 중 저장 실패 시 세션 종료 중단
- `src/modes/city-sim/auth.js:1233` 저장 실패 판정
- `src/modes/city-sim/auth.js:1235` `return false`로 로그아웃 중단

보완 포인트:
- 단순히 세션 유지 문제를 넘어, 모듈 상태 변수(`guestSessionActive`, `lastSyncedUid`, `syncInFlight*`)가 의도와 다르게 남을 수 있음.
- 이는 후속 로그인/렌더 흐름 꼬임으로 이어질 수 있음.

### 원인 C: redirect 경로와 onAuth 경로의 부분 경합
- `src/modes/city-sim/auth.js:1362` redirect 처리에서도 sync 수행
- `src/modes/city-sim/auth.js:1372` onAuth에서도 sync 수행
- `src/modes/city-sim/auth.js:1374`~`src/modes/city-sim/auth.js:1377` null 이벤트 덮어쓰기 방지는 존재

보완 포인트:
- 위 방어 로직은 `null 이벤트` 덮어쓰기만 막음.
- redirect 후처리 vs onAuth 후처리 동시 경합 자체는 막지 못함.

## 2. 문제 3(점령/국지전 초기화) 추가 체크

`persistSessionProgress` 경로에서 진행 데이터가 저장되는지 별도 확인 필요.

- 호출 경로: `src/modes/city-sim/auth.js:453` (`persistSessionProgress`)
- 내부 저장:
1. `targetGame.saveCitySimState({ requireCloud: true })`
2. `app.saveNow({ requireCloud: true })`

점검 포인트:
- `app.saveNow`가 캠페인 진행을 실제 직렬화하는지 확인
  - `src/game/app_persistence.js:40` `progress` 블록
  - `src/game/app_persistence.js:45` `campaignOccupation`
  - `src/game/app_persistence.js:51` `campaignSkirmish`
- 저장은 했는데 로드/머지 단계에서 초기화되는지 추가 추적 필요.

## 3. 실행 순서 (필수)

수정 먼저 금지. 아래 순서 고정:

1. 디버그 로그 먼저 추가
2. 재현 3회로 원인 확정
3. 확정된 원인부터 순서대로 수정
4. 동일 시나리오 재검증

### 3.1 디버그 로그 활성화 방법 (A 단계용)
1. 브라우저 콘솔에서 `localStorage.setItem('reclaim_login_debug', '1')` 실행
2. 페이지 새로고침
3. 재현 테스트 수행 후 콘솔에서 `[LoginDebug][CitySave]`, `[LoginDebug][Auth]` 로그 확인
4. 테스트 종료 후 `localStorage.removeItem('reclaim_login_debug')` 실행

## 4. A~F 실행 단계

### A. 로그 계측 + 재현 조건 고정 (수정 전)
- [ ] 문제 1/2/3 재현 조건 문서화 (브라우저, 계정, 네트워크 상태)
- [ ] `uid`, `hasUid`, `STORAGE_KEY`, `localOwner`, `loadedSource(remote/cache/local)` 로그 추가
- [ ] 로그아웃 경로에서 `saveOk`, `persist`, `signOut 호출 여부`, 핵심 상태 변수 로그 추가

#### A-재현 기록 템플릿
- 브라우저/버전:
- 테스트 시간:
- 계정 시나리오: (예: Google A -> 로그아웃 -> Guest)
- 네트워크 조건: (정상 / 느림 / 오프라인 복구)
- 관찰 UID:
- `loadedSource`:
- `localOwner`:
- 로그아웃 시 `saveOk`:
- 로그아웃 시 `signOutInvoked`:
- 결과: (재현/미재현)

### B. 원인 A 확정
- [ ] Google A -> 로그아웃 -> 게스트/계정 B 3회 반복
- [ ] UID 미확정 시점의 `loadedSource=local` 발생 여부 확인
- [ ] `STORAGE_KEY` 단일 키(`reclaim_citysim_v1`)가 재노출에 연결되는지 로그로 입증

#### B-판정 로그 패턴
- 원인 A 유력 신호:
1. `[LoginDebug][CitySave] load.start`에서 `hasUid: false` 이고 `localOwnedByUid: true`
2. 이어서 `[LoginDebug][CitySave] load.result`에서 `loadedSource: 'local'`
3. 추가로 `[LoginDebug][CitySave] risk.uid_unresolved_local_fallback` 이벤트 발생

- 원인 A 확정 기준(실무):
1. 위 3개 패턴이 계정 전환 시나리오에서 3회 중 2회 이상 반복
2. 해당 시점 화면에서 이전 계정 기지 노출이 동반

### C. 원인 B/C + 문제 3 확정
- [ ] 저장 실패 강제 후 `fb.signOut()` 미호출/상태 변수 잔류 확인
- [ ] redirect + onAuth 동시 경로에서 후처리 중복 여부 확인
- [ ] 문제 3: 로그아웃 직전 `app.saveNow` payload와 재로그인 후 로드 데이터 diff 확인

#### C-판정 로그 패턴
- 원인 B 확인 로그:
1. `[LoginDebug][Auth] signout.persist.result`에서 `saveOk: false`
2. 이어서 `[LoginDebug][Auth] signout.abort_save_failed` 발생
3. 같은 시도 내 `signout.firebase_signout.call` 로그가 없음

- 원인 C 확인 로그:
1. 동일 계정/동일 시점에 `[LoginDebug][Auth] redirect.result` 발생
2. 근접 시간대에 `[LoginDebug][Auth] onAuth.event` 발생
3. 이어서 `[LoginDebug][Auth] sync.start`가 `reason: redirectResult`와 `reason: onAuth`로 각각 기록

- 문제 3 diff 로그:
1. 로그아웃 직전 `[LoginDebug][MainSave] save.snapshot` 확인
2. 재로그인 후 `[LoginDebug][MainSave] load.snapshot` 및 `load.applied` 확인
3. 아래 필드 비교:
   - `summary.occupation`
   - `summary.skirmish`
   - `summary.cityQuestMission`

### D. 핫픽스 적용 (확정 원인 순서대로)
- [x] 원인 A: UID 미확정 로컬 폴백 분리 + boot/계정전환 경로 분기
- [x] 원인 B: 저장 실패와 세션 종료 분리 (`강제 로그아웃` 경로)
- [x] 원인 C: 로그인 성공 후처리 단일 엔트리 + `authFlowToken` 적용
- 상태 메모: 2026-02-20 반영 완료 (`src/modes/city-sim/auth.js`, `src/modes/city-sim/save.js`, `src/game/app_persistence.js`)

### E. 회귀 테스트
- [ ] 이메일/Google/게스트 전환 조합 테스트 (E-1 시트 기준)
- [ ] 문제 1/2/3 재발 여부 3회 반복 검증
- [ ] 점령/국지전 진행 데이터 유지 확인

#### E-0. 테스트 준비
1. 브라우저 콘솔: `localStorage.setItem('reclaim_login_debug', '1')`
2. 하드 리로드(캐시 무시)
3. 콘솔 `Preserve log` 활성화
4. 테스트 종료 후: `localStorage.removeItem('reclaim_login_debug')`

#### E-1. 전환 조합 회귀 시나리오 (각 3회)
| ID | 시나리오 | 기대 화면 결과 | 기대 로그(핵심) |
| --- | --- | --- | --- |
| E1 | Google A -> 로그아웃 -> Guest | Google A 기지 재노출 없음 | `load.skip.uid_unresolved_guard` 또는 `loadedSource`가 안전 경로(`default/cache`) |
| E2 | Google A -> 로그아웃 -> Email B 로그인 | A/B 교차 노출 없음 | `risk.uid_unresolved_local_fallback` 미발생 |
| E3 | Email B -> 로그아웃 -> Google A 로그인 | B/A 교차 노출 없음 | `sync.skip.stale_flow` 발생 시에도 최종 상태는 최신 계정 기준 |
| E4 | Guest -> Google A 로그인 -> 로그아웃 -> Guest | Guest 상태로 복귀, 이전 계정 기지 미노출 | `save.local.skip.transition_uid_unresolved` 발생 시 비정상 로드 없음 |

#### E-2. 강제 로그아웃 경로 검증 (원인 B 회귀)
1. 저장 실패 조건(네트워크 차단 등)에서 로그아웃 1회 클릭
2. 10초 내 로그아웃 2회 클릭
3. 기대 로그:
   - 1차: `signout.abort_save_failed`
   - 2차: `signout.force_continue_after_save_fail` + `signout.firebase_signout.call`
4. 기대 결과: 2차 시도에서 세션 종료 완료

#### E-3. 문제 3(점령/국지전) 데이터 유지 검증
1. 로그아웃 직전 `save.snapshot.summary` 기록
2. 재로그인 후 `load.snapshot.summary`, `load.applied.summary` 기록
3. 아래 필드 동일성 확인:
   - `occupation`
   - `skirmish`
   - `cityQuestMission`
4. 3회 반복 중 1회라도 불일치면 실패로 판정

#### E-4. 코드 기반 사전 검증 (완료)
- [x] `node --check src/modes/city-sim/auth.js`
- [x] `node --check src/modes/city-sim/save.js`
- [x] `node --check src/game/app_persistence.js`

### F. 문서/로그 정리 및 종료
- [ ] 임시 디버그 로그 정리 기준 확정
- [ ] `LOGIN_ISSUE_PLAN.md`, `LOGIN_ISSUE_EXPLAINED.md` 결과 반영
- [ ] 종료 기준 충족 여부 체크

## 5. 완료 기준 (DoD)

1. 원인 A/B/C 각각 로그로 재현-확정됨.
2. `STORAGE_KEY` 단일키 이슈의 영향이 확인되거나 배제됨.
3. 문제 3(점령/국지전 초기화)의 저장-로드 경로가 검증됨.
4. 핫픽스 적용 후 A~F 체크리스트 완료.

## 6. 작업 기록

- 2026-02-20: A/B/C 코드 검증 의견 반영.
- 2026-02-20: `STORAGE_KEY` 단일키 체크 및 문제 3 점검 항목 추가.
- 2026-02-20: 실행 순서(로그 -> 재현 -> 수정)와 A~F 실행 단계로 단순화.
- 2026-02-20: D 핫픽스 적용 완료 및 E 회귀 테스트 시나리오/판정 기준 구체화.
