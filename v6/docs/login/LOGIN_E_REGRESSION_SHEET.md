# LOGIN E 단계 회귀 테스트 시트

- 작성일: 2026-02-20
- 목적: `LOGIN_ISSUE_PLAN.md`의 E-1~E-3 결과를 실행 단위로 기록

## 0. 공통 환경

- 브라우저:
- 빌드/커밋:
- 테스트 시간대:
- 네트워크 조건:
- 디버그 활성화: `localStorage.setItem('reclaim_login_debug', '1')`

## 1. 시나리오 실행 기록 (각 3회)

| 케이스 | 회차 | 시나리오 | 기대 결과 | 실제 결과 | PASS/FAIL | 비고 |
| --- | --- | --- | --- | --- | --- | --- |
| E1 | 1 | Google A -> 로그아웃 -> Guest | 교차 계정 기지 미노출 |  |  |  |
| E1 | 2 | Google A -> 로그아웃 -> Guest | 교차 계정 기지 미노출 |  |  |  |
| E1 | 3 | Google A -> 로그아웃 -> Guest | 교차 계정 기지 미노출 |  |  |  |
| E2 | 1 | Google A -> 로그아웃 -> Email B | 교차 계정 기지 미노출 |  |  |  |
| E2 | 2 | Google A -> 로그아웃 -> Email B | 교차 계정 기지 미노출 |  |  |  |
| E2 | 3 | Google A -> 로그아웃 -> Email B | 교차 계정 기지 미노출 |  |  |  |
| E3 | 1 | Email B -> 로그아웃 -> Google A | 최신 계정 상태 유지 |  |  |  |
| E3 | 2 | Email B -> 로그아웃 -> Google A | 최신 계정 상태 유지 |  |  |  |
| E3 | 3 | Email B -> 로그아웃 -> Google A | 최신 계정 상태 유지 |  |  |  |
| E4 | 1 | Guest -> Google A -> 로그아웃 -> Guest | Guest 복귀/재노출 없음 |  |  |  |
| E4 | 2 | Guest -> Google A -> 로그아웃 -> Guest | Guest 복귀/재노출 없음 |  |  |  |
| E4 | 3 | Guest -> Google A -> 로그아웃 -> Guest | Guest 복귀/재노출 없음 |  |  |  |

## 2. 로그 패턴 체크

| 로그 키 | 관찰 여부 | 비고 |
| --- | --- | --- |
| `load.skip.uid_unresolved_guard` |  |  |
| `save.local.skip.transition_uid_unresolved` |  |  |
| `risk.uid_unresolved_local_fallback` (미발생 기대) |  |  |
| `sync.skip.stale_flow` |  |  |
| `signout.abort_save_failed` |  |  |
| `signout.force_continue_after_save_fail` |  |  |
| `signout.firebase_signout.call` |  |  |

## 3. 문제 3 데이터 유지 비교

### 로그아웃 직전 (`save.snapshot.summary`)
- occupation:
- skirmish:
- cityQuestMission:

### 재로그인 후 (`load.snapshot.summary` / `load.applied.summary`)
- occupation:
- skirmish:
- cityQuestMission:

### 판정
- 동일성 유지 여부:
- 3회 반복 통과 여부:
- 최종 결론:

