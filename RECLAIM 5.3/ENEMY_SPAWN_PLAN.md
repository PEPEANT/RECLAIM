# Enemy Spawn Plan (Time-Based)

모든 적 유닛 생성은 시간 구간에 따라 **순차적으로** 결정됩니다.

## Timeline

- **00:00–00:30**: 보병 + 험비 위주 (infantry, humvee)
- **00:30–01:00**: 보병 + 험비 + 공병 + 드론병 + RPG (infantry, humvee, engineer, drone_operator, rpg)
- **01:00–03:00**: 보병 + 탱크 + 대공유닛 (infantry, mbt, aa_tank)
- **03:00–05:00**: APC + 공격헬기 중심 (apc, apache, humvee, infantry)
- **05:00–07:00**: 공중 + 자주포 (fighter, apache, spg)
- **07:00+**: 폭격기 포함 전 유닛 로테이션 (bomber, fighter, apache, apc, mbt, aa_tank, spg, infantry, engineer, humvee, special_forces, rpg, drone_operator)

## Notes

- “중간에 작은 시간”을 반영하기 위해 00:30–01:00 구간을 별도로 추가했습니다.
- 각 구간 내부는 **순차 로테이션**으로 스폰됩니다(약간의 시간 편차 포함).
