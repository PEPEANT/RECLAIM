/**
 * UNIT_PARAMS
 * 하드코딩 유닛의 파라미터 튜너
 * classes.js draw()에서 참조하여 조절 가능하게 함
 *
 * [PoC] blackhawk만 지원
 */
const UNIT_PARAMS = {
  blackhawk: {
    // 본체 (6점 폴리곤) - 점 배열 아닌 스케일 조절
    body: {
      scaleX: 1.0,    // 가로 스케일 (0.5~1.5)
      scaleY: 1.0     // 세로 스케일 (0.5~1.5)
    },
    // 콕핏 (fillRect)
    cockpit: {
      x: -10,         // X 위치
      y: -5,          // Y 위치
      w: 25,          // 너비
      h: 12           // 높이
    },
    // 메인 로터 (fillRect)
    mainRotor: {
      x: -5,          // translate X
      y: -12,         // translate Y
      w: 90,          // 전체 너비
      h: 4            // 높이
    },
    // 꼬리 로터 (fillRect + rotate)
    tailRotor: {
      x: -35,         // translate X
      y: -15,         // translate Y
      w: 2,           // 너비
      h: 20,          // 높이
      speedMul: 3     // 회전 속도 배수
    }
  }
};

// window에 등록
if (typeof window !== 'undefined') {
  window.UNIT_PARAMS = UNIT_PARAMS;
}
