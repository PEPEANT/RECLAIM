/**
 * DEFAULT_UNIT_SHAPES
 * 유닛의 공식 기하 데이터 (Single Source of Truth)
 *
 * 이 데이터가 게임 렌더링과 에디터 모두에서 사용됩니다.
 * - classes.js draw()에서 직접 렌더링에 사용
 * - REC_unit-editor에서 편집에 사용
 *
 * 레이어 속성:
 * - name: 레이어 이름
 * - color: 기본 색상
 * - teamColor: true면 팀 색상으로 대체됨
 * - parent: 부모 레이어 이름 (변형 전파용)
 * - points: 폴리곤 점 배열
 */
const DEFAULT_UNIT_SHAPES = {
  // =====================
  // [INFANTRY] 보병 유닛
  // =====================

  worker: {
    scale: 1,
    anchor: { x: 0, y: 0 },
    layers: [
      // 몸통 (노란색 조끼 - 색상 유지)
      { name: "Body", color: "#facc15", teamColor: false, parent: null, points: [
        { x: -7, y: -22 }, { x: 7, y: -22 }, { x: 7, y: 0 }, { x: -7, y: 0 }
      ]},
      // 머리 (팀 색상)
      { name: "Head", color: "#3b82f6", teamColor: true, parent: "Body", points: [
        { x: -5, y: -31 }, { x: 5, y: -31 }, { x: 5, y: -21 }, { x: -5, y: -21 }
      ]},
      // 헬멧
      { name: "Helmet", color: "#f59e0b", teamColor: false, parent: "Head", points: [
        { x: -6, y: -33 }, { x: 6, y: -33 }, { x: 6, y: -27 }, { x: -6, y: -27 }
      ]},
      // 도구
      { name: "Tool", color: "#64748b", teamColor: false, parent: "Body", points: [
        { x: 6, y: -18 }, { x: 15, y: -18 }, { x: 15, y: -12 }, { x: 6, y: -12 }
      ]}
    ]
  },

  infantry: {
    scale: 1,
    anchor: { x: 0, y: 0 },
    layers: [
      // 몸통 (팀 색상)
      { name: "Body", color: "#3b82f6", teamColor: true, parent: null, points: [
        { x: -6, y: -20 }, { x: 6, y: -20 }, { x: 6, y: 0 }, { x: -6, y: 0 }
      ]},
      // 머리 (팀 색상)
      { name: "Head", color: "#3b82f6", teamColor: true, parent: "Body", points: [
        { x: -5, y: -29 }, { x: 5, y: -29 }, { x: 5, y: -19 }, { x: -5, y: -19 }
      ]},
      // 총
      { name: "Gun", color: "#1e293b", teamColor: false, parent: "Body", points: [
        { x: 2, y: -18 }, { x: 12, y: -18 }, { x: 12, y: -15 }, { x: 2, y: -15 }
      ]}
    ]
  },

  rpg: {
    scale: 1,
    anchor: { x: 0, y: 0 },
    layers: [
      // 몸통 (팀 색상)
      { name: "Body", color: "#3b82f6", teamColor: true, parent: null, points: [
        { x: -5, y: -18 }, { x: 5, y: -18 }, { x: 5, y: 0 }, { x: -5, y: 0 }
      ]},
      // 머리 (팀 색상)
      { name: "Head", color: "#3b82f6", teamColor: true, parent: "Body", points: [
        { x: -4, y: -26 }, { x: 4, y: -26 }, { x: 4, y: -18 }, { x: -4, y: -18 }
      ]},
      // RPG 발사관
      { name: "Launcher", color: "#334155", teamColor: false, parent: "Body", points: [
        { x: -2, y: -24 }, { x: 10, y: -24 }, { x: 10, y: -18 }, { x: -2, y: -18 }
      ]},
      // 탄두
      { name: "Warhead", color: "#7f1d1d", teamColor: false, parent: "Launcher", points: [
        { x: 8, y: -24 }, { x: 12, y: -24 }, { x: 12, y: -18 }, { x: 8, y: -18 }
      ]}
    ]
  },

  special_forces: {
    scale: 1,
    anchor: { x: 0, y: 0 },
    layers: [
      // 몸통 하단
      { name: "BodyLower", color: "#171717", teamColor: false, parent: null, points: [
        { x: -7, y: -12 }, { x: 7, y: -12 }, { x: 7, y: 0 }, { x: -7, y: 0 }
      ]},
      // 몸통 상단 (조끼)
      { name: "BodyUpper", color: "#1e293b", teamColor: false, parent: "BodyLower", points: [
        { x: -7, y: -22 }, { x: 7, y: -22 }, { x: 7, y: -12 }, { x: -7, y: -12 }
      ]},
      // 머리
      { name: "Head", color: "#171717", teamColor: false, parent: "BodyUpper", points: [
        { x: -5, y: -31 }, { x: 5, y: -31 }, { x: 5, y: -21 }, { x: -5, y: -21 }
      ]},
      // 야간투시경
      { name: "NVG", color: "#10b981", teamColor: false, parent: "Head", points: [
        { x: -4, y: -28 }, { x: 4, y: -28 }, { x: 4, y: -25 }, { x: -4, y: -25 }
      ]},
      // 총
      { name: "Gun", color: "#000000", teamColor: false, parent: "BodyUpper", points: [
        { x: 4, y: -18 }, { x: 16, y: -18 }, { x: 16, y: -14 }, { x: 4, y: -14 }
      ]}
    ]
  },

  drone_operator: {
    scale: 1,
    anchor: { x: 0, y: 0 },
    layers: [
      // 백팩
      { name: "Backpack", color: "#334155", teamColor: false, parent: null, points: [
        { x: -10, y: -18 }, { x: -4, y: -18 }, { x: -4, y: -4 }, { x: -10, y: -4 }
      ]},
      // 몸통 (팀 색상)
      { name: "Body", color: "#3b82f6", teamColor: true, parent: "Backpack", points: [
        { x: -6, y: -20 }, { x: 6, y: -20 }, { x: 6, y: 0 }, { x: -6, y: 0 }
      ]},
      // 머리 (팀 색상)
      { name: "Head", color: "#3b82f6", teamColor: true, parent: "Body", points: [
        { x: -5, y: -29 }, { x: 5, y: -29 }, { x: 5, y: -19 }, { x: -5, y: -19 }
      ]},
      // 모자
      { name: "Cap", color: "#334155", teamColor: false, parent: "Head", points: [
        { x: -5, y: -30 }, { x: 9, y: -30 }, { x: 9, y: -25 }, { x: -5, y: -25 }
      ]}
    ]
  },

  // =====================
  // [ARMORED] 차량 유닛
  // =====================

  humvee: {
    scale: 1,
    anchor: { x: 0, y: 0 },
    layers: [
      // 차체 (팀 색상)
      { name: "Body", color: "#3b82f6", teamColor: true, parent: null, points: [
        { x: -20, y: -15 }, { x: 20, y: -15 }, { x: 20, y: 0 }, { x: -20, y: 0 }
      ]},
      // 창문/캐빈
      { name: "Cabin", color: "#1e293b", teamColor: false, parent: "Body", points: [
        { x: -10, y: -15 }, { x: -5, y: -25 }, { x: 10, y: -25 }, { x: 15, y: -15 }
      ]},
      // 앞바퀴
      { name: "FrontWheel", color: "#000000", teamColor: false, parent: "Body", points: [
        { x: -18, y: -6 }, { x: -6, y: -6 }, { x: -6, y: 6 }, { x: -18, y: 6 }
      ]},
      // 뒷바퀴
      { name: "RearWheel", color: "#000000", teamColor: false, parent: "Body", points: [
        { x: 6, y: -6 }, { x: 18, y: -6 }, { x: 18, y: 6 }, { x: 6, y: 6 }
      ]}
    ]
  },

  apc: {
    scale: 1,
    anchor: { x: 0, y: 0 },
    layers: [
      // 차체 (팀 색상)
      { name: "Body", color: "#3b82f6", teamColor: true, parent: null, points: [
        { x: -20, y: -16 }, { x: 20, y: -16 }, { x: 20, y: 0 }, { x: -20, y: 0 }
      ]},
      // 포탑
      { name: "Turret", color: "#1e293b", teamColor: false, parent: "Body", points: [
        { x: -15, y: -22 }, { x: 15, y: -22 }, { x: 15, y: -16 }, { x: -15, y: -16 }
      ]},
      // 바퀴들
      { name: "Wheels", color: "#000000", teamColor: false, parent: "Body", points: [
        { x: -18, y: -6 }, { x: -6, y: -6 }, { x: -6, y: 6 }, { x: -18, y: 6 }
      ]}
    ]
  },

  aa_tank: {
    scale: 1,
    anchor: { x: 0, y: 0 },
    layers: [
      // 차체 (팀 색상)
      { name: "Body", color: "#3b82f6", teamColor: true, parent: null, points: [
        { x: -22, y: -14 }, { x: 22, y: -14 }, { x: 22, y: 0 }, { x: -22, y: 0 }
      ]},
      // 포탑
      { name: "Turret", color: "#1e293b", teamColor: false, parent: "Body", points: [
        { x: -12, y: -22 }, { x: 12, y: -22 }, { x: 12, y: -14 }, { x: -12, y: -14 }
      ]},
      // 대공포 (좌)
      { name: "GunLeft", color: "#1e293b", teamColor: false, parent: "Turret", points: [
        { x: -4, y: -34 }, { x: 0, y: -34 }, { x: 0, y: -22 }, { x: -4, y: -22 }
      ]},
      // 대공포 (우)
      { name: "GunRight", color: "#1e293b", teamColor: false, parent: "Turret", points: [
        { x: 4, y: -34 }, { x: 8, y: -34 }, { x: 8, y: -22 }, { x: 4, y: -22 }
      ]},
      // 무한궤도
      { name: "Tracks", color: "#000000", teamColor: false, parent: "Body", points: [
        { x: -24, y: -4 }, { x: 24, y: -4 }, { x: 24, y: 0 }, { x: -24, y: 0 }
      ]}
    ]
  },

  mbt: {
    scale: 1,
    anchor: { x: 0, y: 0 },
    layers: [
      // 차체 (팀 색상)
      { name: "Body", color: "#3b82f6", teamColor: true, parent: null, points: [
        { x: -25, y: -15 }, { x: 25, y: -15 }, { x: 25, y: 0 }, { x: -25, y: 0 }
      ]},
      // 포탑
      { name: "Turret", color: "#1e293b", teamColor: false, parent: "Body", points: [
        { x: -15, y: -25 }, { x: 15, y: -25 }, { x: 15, y: -15 }, { x: -15, y: -15 }
      ]},
      // 주포
      { name: "MainGun", color: "#1e293b", teamColor: false, parent: "Turret", points: [
        { x: 0, y: -23 }, { x: 40, y: -23 }, { x: 40, y: -19 }, { x: 0, y: -19 }
      ]},
      // 무한궤도
      { name: "Tracks", color: "#000000", teamColor: false, parent: "Body", points: [
        { x: -28, y: -5 }, { x: 28, y: -5 }, { x: 28, y: 0 }, { x: -28, y: 0 }
      ]}
    ]
  },

  spg: {
    scale: 1,
    anchor: { x: 0, y: 0 },
    layers: [
      // 차체 (팀 색상)
      { name: "Body", color: "#3b82f6", teamColor: true, parent: null, points: [
        { x: -25, y: -20 }, { x: 25, y: -20 }, { x: 25, y: 0 }, { x: -25, y: 0 }
      ]},
      // 포신 (45도 각도)
      { name: "Barrel", color: "#1e293b", teamColor: false, parent: "Body", points: [
        { x: -10, y: -20 }, { x: 22, y: -52 }, { x: 30, y: -45 }, { x: -2, y: -13 }
      ]}
    ]
  },

  // =====================
  // [AIR] 공중 유닛
  // =====================

  fighter: {
    scale: 1,
    anchor: { x: 0, y: 0 },
    layers: [
      // 동체 (팀 색상)
      { name: "Fuselage", color: "#3b82f6", teamColor: true, parent: null, points: [
        { x: 32, y: -8 }, { x: -16, y: -14 }, { x: -24, y: -8 }, { x: -16, y: -2 }
      ]},
      // 날개
      { name: "Wing", color: "#1e293b", teamColor: false, parent: "Fuselage", points: [
        { x: 4, y: -8 }, { x: -8, y: -18 }, { x: -16, y: -8 }, { x: -8, y: 2 }
      ]}
    ]
  },

  apache: {
    scale: 1,
    anchor: { x: 0, y: 0 },
    layers: [
      // 꼬리
      { name: "Tail", color: "#334155", teamColor: false, parent: null, points: [
        { x: -40, y: -5 }, { x: -10, y: -5 }, { x: -10, y: 3 }, { x: -40, y: 3 }
      ]},
      // 본체 (팀 색상 - 어둡게)
      { name: "Body", color: "#1e3a8a", teamColor: true, parent: "Tail", points: [
        { x: 20, y: 5 }, { x: 25, y: -5 }, { x: -10, y: -10 }, { x: -15, y: 5 }
      ]},
      // 날개/무장
      { name: "Wing", color: "#1e293b", teamColor: false, parent: "Body", points: [
        { x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }, { x: 0, y: 10 }
      ]},
      // 로터
      { name: "Rotor", color: "#000000", teamColor: false, parent: "Body", points: [
        { x: -30, y: -12 }, { x: 30, y: -12 }, { x: 30, y: -9 }, { x: -30, y: -9 }
      ]}
    ]
  },

  blackhawk: {
    scale: 1,
    anchor: { x: 0, y: 0 },
    layers: [
      // 본체
      { name: "Body", color: "#111827", teamColor: false, parent: null, points: [
        { x: 15, y: -5 }, { x: -25, y: -5 }, { x: -35, y: -15 },
        { x: -25, y: 5 }, { x: 10, y: 10 }, { x: 20, y: 5 }
      ]},
      // 콕핏
      { name: "Cockpit", color: "#0f172a", teamColor: false, parent: "Body", points: [
        { x: -10, y: -5 }, { x: 15, y: -5 }, { x: 15, y: 7 }, { x: -10, y: 7 }
      ]},
      // 메인 로터
      { name: "MainRotor", color: "#000000", teamColor: false, parent: "Body", points: [
        { x: -50, y: -14 }, { x: 40, y: -14 }, { x: 40, y: -10 }, { x: -50, y: -10 }
      ]}
    ]
  },

  chinook: {
    scale: 1,
    anchor: { x: 0, y: 0 },
    layers: [
      // 본체
      { name: "Body", color: "#4b5563", teamColor: false, parent: null, points: [
        { x: -30, y: -10 }, { x: 30, y: -10 }, { x: 35, y: 5 },
        { x: -35, y: 5 }, { x: -35, y: -20 }
      ]},
      // 랜딩기어 (앞)
      { name: "GearFront", color: "#1f2937", teamColor: false, parent: "Body", points: [
        { x: -25, y: 5 }, { x: -17, y: 5 }, { x: -17, y: 9 }, { x: -25, y: 9 }
      ]},
      // 랜딩기어 (뒤)
      { name: "GearRear", color: "#1f2937", teamColor: false, parent: "Body", points: [
        { x: 15, y: 5 }, { x: 23, y: 5 }, { x: 23, y: 9 }, { x: 15, y: 9 }
      ]},
      // 전방 로터
      { name: "FrontRotor", color: "#000000", teamColor: false, parent: "Body", points: [
        { x: -75, y: -22 }, { x: 5, y: -22 }, { x: 5, y: -18 }, { x: -75, y: -18 }
      ]},
      // 후방 로터
      { name: "RearRotor", color: "#000000", teamColor: false, parent: "Body", points: [
        { x: -5, y: -22 }, { x: 75, y: -22 }, { x: 75, y: -18 }, { x: -5, y: -18 }
      ]}
    ]
  },

  bomber: {
    scale: 1,
    anchor: { x: 0, y: 0 },
    layers: [
      // 동체
      { name: "Fuselage", color: "#334155", teamColor: false, parent: null, points: [
        { x: 60, y: 0 }, { x: 40, y: -7 }, { x: -20, y: -7 },
        { x: -40, y: -25 }, { x: -35, y: -5 }, { x: -50, y: 0 },
        { x: -45, y: 5 }, { x: 20, y: 8 }
      ]},
      // 콕핏
      { name: "Cockpit", color: "#000000", teamColor: false, parent: "Fuselage", points: [
        { x: 40, y: -7 }, { x: 50, y: -2 }, { x: 42, y: -2 }
      ]},
      // 날개
      { name: "Wings", color: "#1e293b", teamColor: false, parent: "Fuselage", points: [
        { x: 10, y: -2 }, { x: -30, y: -2 }, { x: -40, y: 15 }, { x: -10, y: 15 }
      ]},
      // 팀 마크 (팀 색상)
      { name: "TeamMark", color: "#3b82f6", teamColor: true, parent: "Fuselage", points: [
        { x: -10, y: -4 }, { x: 5, y: -4 }, { x: 5, y: -1 }, { x: -10, y: -1 }
      ]}
    ]
  },

  recon: {
    scale: 0.5,
    anchor: { x: 0, y: 0 },
    layers: [
      // 동체
      { name: "Fuselage", color: "#cbd5e1", teamColor: false, parent: null, points: [
        { x: 30, y: 5 }, { x: 10, y: -12 }, { x: -40, y: -5 },
        { x: -35, y: 2 }, { x: 20, y: 10 }
      ]},
      // 날개
      { name: "Wings", color: "#94a3b8", teamColor: false, parent: "Fuselage", points: [
        { x: -5, y: -5 }, { x: -25, y: -5 }, { x: -35, y: 25 }, { x: 5, y: 25 }
      ]},
      // 꼬리 날개
      { name: "TailWing", color: "#64748b", teamColor: false, parent: "Fuselage", points: [
        { x: -35, y: -5 }, { x: -45, y: -25 }, { x: -40, y: -5 }
      ]},
      // 센서/카메라
      { name: "Sensor", color: "#1e293b", teamColor: false, parent: "Fuselage", points: [
        { x: 20, y: 5 }, { x: 30, y: 5 }, { x: 30, y: 12 }, { x: 20, y: 12 }
      ]}
    ]
  },

  // =====================
  // [DRONE] 드론 유닛
  // =====================

  drone_suicide: {
    scale: 0.52,
    anchor: { x: 0, y: 0 },
    layers: [
      // 본체
      { name: "Body", color: "#475569", teamColor: false, parent: null, points: [
        { x: -12, y: -8 }, { x: 12, y: -8 }, { x: 12, y: 4 }, { x: -12, y: 4 }
      ]},
      // 팀 컬러 띠 (팀 색상)
      { name: "TeamStripe", color: "#3b82f6", teamColor: true, parent: "Body", points: [
        { x: -12, y: -2 }, { x: 12, y: -2 }, { x: 12, y: 1 }, { x: -12, y: 1 }
      ]},
      // 로터 암
      { name: "RotorArm", color: "#1e293b", teamColor: false, parent: "Body", points: [
        { x: -20, y: -4 }, { x: 20, y: -4 }, { x: 20, y: 0 }, { x: -20, y: 0 }
      ]},
      // 폭발물
      { name: "Explosive", color: "#ef4444", teamColor: false, parent: "Body", points: [
        { x: -4, y: 4 }, { x: 4, y: 4 }, { x: 4, y: 8 }, { x: -4, y: 8 }
      ]}
    ]
  },

  drone_at: {
    scale: 0.52,
    anchor: { x: 0, y: 0 },
    layers: [
      // 동체
      { name: "Body", color: "#e2e8f0", teamColor: false, parent: null, points: [
        { x: 20, y: 2 }, { x: 0, y: -10 }, { x: -20, y: -2 },
        { x: -20, y: 2 }, { x: 0, y: 8 }
      ]},
      // 꼬리 날개 (상)
      { name: "TailUp", color: "#94a3b8", teamColor: false, parent: "Body", points: [
        { x: -15, y: -2 }, { x: -25, y: -12 }, { x: -20, y: -2 }
      ]},
      // 꼬리 날개 (하)
      { name: "TailDown", color: "#94a3b8", teamColor: false, parent: "Body", points: [
        { x: -15, y: 2 }, { x: -25, y: 12 }, { x: -20, y: 2 }
      ]},
      // 대전차 미사일
      { name: "Missile", color: "#dc2626", teamColor: false, parent: "Body", points: [
        { x: -8, y: 5 }, { x: 8, y: 5 }, { x: 8, y: 8 }, { x: -8, y: 8 }
      ]},
      // 팀 마크 (팀 색상)
      { name: "TeamMark", color: "#3b82f6", teamColor: true, parent: "Body", points: [
        { x: 2, y: -3 }, { x: 8, y: -3 }, { x: 8, y: 3 }, { x: 2, y: 3 }
      ]}
    ]
  },

  tactical_drone: {
    scale: 1,
    anchor: { x: 0, y: 0 },
    layers: [
      // 동체 (팀 색상)
      { name: "Body", color: "#3b82f6", teamColor: true, parent: null, points: [
        { x: 10, y: 0 }, { x: -5, y: 6 }, { x: -2, y: 0 }, { x: -5, y: -6 }
      ]}
    ]
  },

  stealth_drone: {
    scale: 1,
    anchor: { x: 0, y: 0 },
    layers: [
      // 동체 (팀 색상)
      { name: "Body", color: "#3b82f6", teamColor: true, parent: null, points: [
        { x: 14, y: 0 }, { x: -10, y: 9 }, { x: -4, y: 0 }, { x: -10, y: -9 }
      ]},
      // 센서
      { name: "Sensor", color: "#0f172a", teamColor: false, parent: "Body", points: [
        { x: -2, y: -2 }, { x: 4, y: -2 }, { x: 4, y: 2 }, { x: -2, y: 2 }
      ]}
    ]
  },

  // =====================
  // [SPECIAL] 특수 유닛
  // =====================

  emp: {
    scale: 1,
    anchor: { x: 0, y: 0 },
    layers: [
      // 외곽 원
      { name: "Ring", color: "#3b82f6", teamColor: true, parent: null, points: [
        { x: -15, y: -15 }, { x: 15, y: -15 }, { x: 15, y: 15 }, { x: -15, y: 15 }
      ]},
      // 번개 모양
      { name: "Lightning", color: "#3b82f6", teamColor: true, parent: "Ring", points: [
        { x: -5, y: -8 }, { x: 8, y: -2 }, { x: -2, y: 2 }, { x: 6, y: 10 },
        { x: -8, y: 4 }, { x: 2, y: 0 }
      ]}
    ]
  },

  nuke: {
    scale: 1,
    anchor: { x: 0, y: 0 },
    layers: [
      // 외곽 원
      { name: "Circle", color: "#ef4444", teamColor: false, parent: null, points: [
        { x: -15, y: -15 }, { x: 15, y: -15 }, { x: 15, y: 15 }, { x: -15, y: 15 }
      ]},
      // 중심
      { name: "Core", color: "#facc15", teamColor: false, parent: "Circle", points: [
        { x: -4, y: -4 }, { x: 4, y: -4 }, { x: 4, y: 4 }, { x: -4, y: 4 }
      ]}
    ]
  },

  tactical_missile: {
    scale: 1,
    anchor: { x: 0, y: 0 },
    layers: [
      // 동체
      { name: "Body", color: "#e5e7eb", teamColor: false, parent: null, points: [
        { x: -12, y: -3 }, { x: 12, y: -3 }, { x: 12, y: 3 }, { x: -12, y: 3 }
      ]},
      // 노즈콘
      { name: "Nose", color: "#ef4444", teamColor: false, parent: "Body", points: [
        { x: 12, y: -3 }, { x: 18, y: 0 }, { x: 12, y: 3 }
      ]},
      // 꼬리 날개 (상)
      { name: "FinTop", color: "#475569", teamColor: false, parent: "Body", points: [
        { x: -8, y: -3 }, { x: -12, y: -8 }, { x: -12, y: -3 }
      ]},
      // 꼬리 날개 (하)
      { name: "FinBottom", color: "#475569", teamColor: false, parent: "Body", points: [
        { x: -8, y: 3 }, { x: -12, y: 8 }, { x: -12, y: 3 }
      ]},
      // 화염
      { name: "Flame", color: "#f59e0b", teamColor: false, parent: "Body", points: [
        { x: -16, y: -4 }, { x: -12, y: 0 }, { x: -16, y: 4 }, { x: -20, y: 0 }
      ]}
    ]
  }
};

// window에 등록 (게임과 에디터 모두에서 사용)
if (typeof window !== 'undefined') {
  window.DEFAULT_UNIT_SHAPES = DEFAULT_UNIT_SHAPES;
}
