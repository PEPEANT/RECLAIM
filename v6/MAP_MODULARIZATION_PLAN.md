# MAP 모듈 분리 계획서 (초안)

## 1) 목표
- 맵 코드를 맵별 폴더로 분리해서 유지보수 난이도를 낮춘다.
- 검은 화면, 맵 입장 실패, 건물 누락 같은 회귀 버그를 줄인다.
- `maps.js` 1파일 집중 구조(현재 1,600+줄)를 해소한다.
- 깨진 주석(문자 인코딩 깨짐)을 전면 정리한다.

## 2) 현재 문제 요약
- `maps.js`에 테마/룰/배경 렌더/데코 렌더/도시 특수 로직이 한 파일에 몰려 있음.
- `game.js` 안에 `ensureMapsReady()`와 `enforceCriticalMapThemes()` 같은 임시 복구 코드가 들어와 있음.
- `src/game/map_setup.js`가 `Maps.currentMap`에 직접 의존해 맵별 건물 스폰을 분기함.
- 주석 인코딩이 깨져 코드 가독성과 수정 안전성이 크게 떨어짐.

## 3) 목표 아키텍처

### 3-1. 폴더 구조
```text
src/maps/
  core/
    registry.js         # 맵 등록/조회
    adapter.js          # 기존 window.Maps 호환 어댑터
    types.js            # 공통 타입/기본값
    draw_utils.js       # 공용 랜덤/도형 유틸
  maps/
    plain/
      index.js
      theme.js
      rules.js
      render_base.js
      render_decor.js
      setup.js
    city/
      index.js
      theme.js
      rules.js
      render_base.js
      render_decor.js
      setup.js
    forest/
      index.js
      theme.js
      rules.js
      render_base.js
      render_decor.js
      setup.js
    mountain/
    village/
    fortress/
    desert/
    landing/
    skirmish/
    skirmish_kabul/
    skirmish_desert/
  index.js              # 전체 맵 등록 진입점
```

### 3-2. 맵 인터페이스(표준 계약)
각 맵은 아래 계약을 지킨다.
```js
{
  id: 'skirmish_kabul',
  theme: { sky, skyMid, ground, groundDark, name },
  rules: {
    playerHQ, enemyHQ, playerDefense, enemyDefense,
    bunkers, mapExpand, winCondition, survivalTime
  },
  renderBase(ctx, env),
  renderDecor(ctx, env),
  renderThreatOverlay(ctx, env), // optional
  applySetup(game, env)          // optional
}
```

## 4) 단계별 실행 계획

### Phase 0. 인코딩/주석 정리 (선행)
- 범위: `maps.js`, `src/game/map_setup.js`, `src/modes/campaign/skirmish.js`, 기존 계획 문서들.
- 작업:
  - 모든 소스 인코딩을 UTF-8로 통일.
  - 깨진 주석은 의미 보존해서 한국어 또는 영어로 재작성.
  - 주석은 "의도/제약"만 남기고 장식성 주석 제거.
- 완료 기준:
  - 깨진 문자(모지바케) 주석 0건.
  - 코드 리뷰 시 의미 파악 가능한 주석 상태.

### Phase 1. 코어 레지스트리 + 호환 어댑터 도입
- `src/maps/core/registry.js`: 맵 등록/조회 구현.
- `src/maps/core/adapter.js`: 기존 `window.Maps` API를 유지.
- 기존 의존 코드(`game.js`, `map_setup.js`)는 당분간 변경 최소화.
- 완료 기준:
  - 기존 `Maps.getRule()`, `Maps.drawBase()`, `Maps.drawDecorations()` 호출부 동작 유지.

### Phase 2. 고장 다발 맵 우선 분리
- 우선순위: `skirmish_kabul`, `skirmish_desert`, `landing`, `city`.
- 이유: 최근 검은 화면/입장 실패/건물 누락 이슈와 직접 연관.
- 작업:
  - 맵별 `theme/rules/render_*`로 분리.
  - 기존 `maps.js`에서는 해당 맵 로직 제거 후 레지스트리 참조.
- 완료 기준:
  - 4개 맵에서 입장/렌더/건물 스폰 정상.
  - 콘솔 오류 없이 5회 이상 재입장 테스트 통과.

### Phase 3. 나머지 맵 분리
- 대상: `plain`, `forest`, `mountain`, `village`, `fortress`, `desert`, `skirmish`.
- 완료 기준:
  - `maps.js`는 호환 어댑터 성격만 남기고, 맵 구현 코드는 `src/maps/maps/*`로 이동 완료.

### Phase 4. 맵 셋업 로직 이동
- `src/game/map_setup.js`의 `if (Maps.currentMap === ...)` 분기를 각 맵의 `setup.js`로 이동.
- 공통 건물 생성만 `map_setup.js`에 남기고, 특수 규칙은 맵 모듈에서 처리.
- 완료 기준:
  - 맵별 특수 스폰(예: 시티 방어선, 카불 특수 처리) 분산 완료.

### Phase 5. 임시 복구 코드 제거
- `game.js`의 `ensureMapsReady()`, `enforceCriticalMapThemes()`는 안정화 후 제거.
- 제거 전 1주일 회귀 테스트 구간 운영.
- 완료 기준:
  - 임시 폴백 없이도 모든 맵 정상 진입/렌더/종료.

## 5) 테스트 전략 (필수)

### 5-1. 맵 회귀 체크리스트
- 맵 선택 화면에서 각 맵 3회 이상 입장/퇴장 반복.
- 캠페인(landing/defense/skirmish) 각 스테이지 진입 확인.
- `skirmish` 101~105 스테이지 맵 매핑 검증.
- 맵별 건물 스폰 수량/종류 검증.
- 첫 프레임 검은 화면 여부 확인.

### 5-2. 콘솔 스모크 체크 도구 추가 권장
- `MapDebug.runSmokeTest()` 구현:
  - 모든 맵 id 순회
  - `Maps.currentMap` 전환
  - `drawBase/drawDecorations` 1프레임 렌더
  - 실패 맵/예외 로그 수집

## 6) 위험 요소와 대응
- 위험: 스크립트 로드 순서 꼬임으로 `Maps` 미정의.
  - 대응: `index.html`에서 `src/maps/index.js`를 `game.js`보다 먼저 로드.
- 위험: 기존 저장 데이터와 맵 id 불일치.
  - 대응: id 문자열은 절대 변경 금지(`skirmish_kabul` 등 유지).
- 위험: 분리 중간 단계에서 일부 맵만 동작.
  - 대응: Phase 단위로 배포, 단계별 완료 기준 통과 후 다음 단계 진행.

## 7) 실행 순서 제안 (현실적인 스타트)
1. Phase 0부터 먼저 수행 (인코딩/주석 정리).
2. Phase 1 + Phase 2를 한 묶음으로 진행 (핵심 4개 맵 우선).
3. 안정화 후 나머지 맵 확장.

## 8) 기대 효과
- 맵 한 개 수정 시 영향 범위를 해당 맵 폴더로 제한.
- 맵별 이슈 디버깅 시간 단축.
- 검은 화면/입장 실패 같은 회귀 버그 재발 가능성 감소.
- 신규 맵 추가 시 복붙 대신 규격 기반으로 추가 가능.
