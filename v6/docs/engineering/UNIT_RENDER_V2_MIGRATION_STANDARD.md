# Unit Render V2 마이그레이션 표준

## 목적
- 레거시 유닛 렌더링을 V2로 교체할 때, 유닛별 작업 방식이 항상 동일하도록 표준을 정의한다.
- 모든 유닛 교체에서 같은 구조, 검증, 롤백, 상태 추적 규칙을 사용한다.

## 핵심 원칙
- 한 번에 **유닛 1개씩** 교체한다.
- 각 유닛 검증이 끝날 때까지 레거시 렌더러를 fallback으로 유지한다.
- 렌더러 교체와 월드/배경 대규모 스케일 변경을 한 단계에서 섞지 않는다.

## 표준 폴더 구조
```text
src/render/unit-v2/
  index.js
  registry.js
  common/
    scale.js
    palettes.js
    math.js
  units/
    <unit-id>/
      index.js
      state.js
      weapons.js
      render_body.js
      render_parts.js
      fx.js
```

## 문서 구조
```text
docs/engineering/unit-v2/
  UNIT_V2_SPEC_TEMPLATE.md
  <unit-id>.md
```

교체 대상 유닛은 반드시 1개 문서를 가진다.
- `docs/engineering/unit-v2/<unit-id>.md`

## 런타임 계약 (필수)
- `registry.js`는 `unit.stats.id` 기준으로 유닛 렌더러를 조회할 수 있어야 한다.
- 유닛 렌더러는 아래 함수를 제공해야 한다.
1. `canRender(unit)` -> boolean
2. `draw(unit, ctx, env)` -> boolean (`true`면 렌더 처리 완료)

- 디스패치 규칙 예시:
```js
const renderer = UnitRenderV2Registry[unitId];
if (unit.renderVersion === 'v2' && renderer && renderer.canRender(unit)) {
  if (renderer.draw(unit, ctx, env) === true) return;
}
// fallback
LegacyUnitRenderer.draw(unit, ctx);
```

## 기능 플래그 규칙
- 전역 플래그 객체:
```js
window.RENDER_V2_UNITS = window.RENDER_V2_UNITS || {};
```
- 유닛별 온/오프:
```js
window.RENDER_V2_UNITS.mbt = true;
window.RENDER_V2_UNITS.apc = false;
```

- 스폰 시점 할당:
```js
if (window.RENDER_V2_UNITS[unit.stats.id] === true) {
  unit.renderVersion = 'v2';
}
```

## 스케일 규칙
- V2 공통 스케일 토큰은 `src/render/unit-v2/common/scale.js`에서만 관리한다.
- 유닛 코드에서 임의 상수를 흩뿌리지 않는다.
- 단계 순서:
1. 시각적 인플레이션만 적용
2. 히트박스/충돌 판정 동기화
3. 배경/월드 스케일 변경 (별도 마일스톤)

## 유닛별 작업 절차
1. 템플릿으로 유닛 스펙 문서 생성 (`docs/engineering/unit-v2/<unit-id>.md`)
2. 렌더러 폴더 생성 (`src/render/unit-v2/units/<unit-id>/`)
3. 게임플레이 변경 없이 V2 렌더러 구현
4. V2 레지스트리 등록
5. 해당 유닛 기능 플래그 연결
6. 체크리스트 검증 (시각 + 안정성)
7. 레거시 fallback 유지 (즉시 삭제 금지)

## 완료 기준 (유닛 단위)
1. 유닛이 등장하는 모든 맵/모드에서 V2 렌더 정상 동작
2. 지면 접지(뜸/묻힘) 이상 없음
3. 포구/발사체 시작 좌표 정렬 정상
4. 콘솔 에러 없음
5. 플래그 OFF 시 즉시 레거시 렌더 복귀
6. 유닛 스펙 문서 작성 및 제한사항 반영 완료

## 회귀 체크리스트 (필수)
1. 선택 링/HP 바 정렬
2. 좌우 반전(`player` / `enemy`) 동작
3. 반동/애니메이션 상태 연속성
4. 스폰/소멸 이펙트 표시 유지
5. 대량 스폰 시 성능 저하 허용 범위 확인

## 롤백 기준
- 초기 마이그레이션 동안 레거시 렌더 제거 금지
- 롤백은 유닛 플래그 OFF로 처리
- 장애 대응 시 V2 파일 삭제 대신 비활성화 우선

## 네이밍 규칙
- 렌더러 엔트리: `src/render/unit-v2/units/<unit-id>/index.js`
- 유닛 문서: `docs/engineering/unit-v2/<unit-id>.md`
- 커밋 스코프 권장: `render-v2(<unit-id>): ...`

## 상태 추적 규칙
- 계획 문서에 아래 상태를 동일하게 사용한다.
- `planned` -> `in_progress` -> `qa` -> `released`

모든 유닛 마이그레이션은 이 상태 모델을 공통으로 사용한다.
