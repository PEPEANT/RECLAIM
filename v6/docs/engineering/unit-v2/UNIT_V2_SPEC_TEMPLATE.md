# Unit Render V2 유닛 스펙 템플릿

## 1) 기본 정보
- `unitId`:
- `상태`: `planned | in_progress | qa | released`
- `담당`:
- `최종 수정일`:

## 2) 범위
- 이번 단계에서 바꾸는 것:
- 이번 단계에서 바꾸지 않는 것:

## 3) 파일 구조
```text
src/render/unit-v2/units/<unit-id>/
  index.js
  state.js
  weapons.js
  render_body.js
  render_parts.js
  fx.js
```

## 4) 렌더 계약
- `canRender(unit)` 조건:
- `draw(unit, ctx, env)` 반환 규칙:
- 실패 시 fallback 동작:

## 5) 스케일/좌표 정책
- 적용 스케일 토큰:
- 지면 정렬 기준 (`groundY` 등):
- 기존 판정(`width/height`) 유지 여부:

## 6) 무기/이펙트 정렬
- 포구 좌표 규칙:
- 발사체 시작점 검증 방법:
- 반동/포탑/회전 파라미터:

## 7) 기능 플래그
- 플래그 키:
- ON 조건:
- OFF 시 동작:

## 8) 검증 체크리스트
1. 모든 맵에서 출력 정상
2. 접지 정상 (뜸/묻힘 없음)
3. 좌우 반전 정상
4. HP 바/선택 링 정렬 정상
5. 콘솔 에러 없음
6. 플래그 OFF 즉시 롤백

## 9) 알려진 이슈 / 제한
- 

## 10) 완료 기준
- [ ] 코드 반영 완료
- [ ] 검증 체크리스트 완료
- [ ] 문서 최신화 완료
