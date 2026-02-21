# Unit Render V2: Tank-First Rollout Plan

## Goal
- Start Unit Render V2 with `mbt` first.
- Keep map/background rendering unchanged in Phase 1.
- Replace rendering safely with legacy fallback at runtime.

## Key Decision
- Do **not** do a full overwrite of all units at once.
- Use **incremental migration**:
1. New renderer for one unit (`mbt`)
2. Legacy renderer remains as fallback
3. Expand to other units after verification

## Phase 1 Scope (Fixed)
- Target unit: `mbt` only
- Background size: no change
- Camera system: no change
- Ground alignment: reuse current `groundY` logic
- Collision/hitbox: keep current values first (visual-only inflation)

## Proposed Structure
```text
src/render/unit-v2/
  index.js
  registry.js
  common/
    scale.js
    team_palette.js
  units/
    mbt/
      index.js
      render_tracks.js
      render_hull.js
      render_turret.js
      fx.js
```

## Runtime Contract
- Unit fields:
- `unit.renderVersion` (`'legacy' | 'v2'`, optional)
- `unit.renderScale` (number, optional)

- Default:
- Existing units: legacy path
- `mbt` can be enabled with `unit.renderVersion = 'v2'`

## Draw Flow
```js
// classes.js (concept)
const canUseV2 = UnitRenderV2 && UnitRenderV2.canRender(this);
if (this.renderVersion === 'v2' && canUseV2) {
  const ok = UnitRenderV2.draw(this, ctx);
  if (ok) return;
}
// fallback
LegacyUnitRenderer.draw(this, ctx);
```

## Scale Strategy
- Introduce a unified scale layer in V2:
- `WORLD_SCALE` (global world policy, optional in phase 1)
- `UNIT_RENDER_SCALE` (unit visual inflation)
- `BG_SCALE` (background inflation, not used in phase 1)

- Phase 1 rule:
- Inflate `mbt` visuals using `UNIT_RENDER_SCALE` only.
- Keep gameplay dimensions unchanged initially to avoid side effects.

## Minimal Integration Points
- `classes.js`
- Add V2 dispatch hook before hardcoded MBT branch.

- `game.js`
- Optional: assign `unit.renderVersion = 'v2'` for spawned `mbt` under feature flag.

## Feature Flag
- Add one gate to enable/disable instantly:
- `window.RENDER_V2_MBT = true | false`

Example policy:
```js
if (unit.stats.id === 'mbt' && window.RENDER_V2_MBT === true) {
  unit.renderVersion = 'v2';
}
```

## Validation Checklist
1. MBT draw success on all maps
2. Ground contact visually stable (no foot/track floating)
3. Turret rotation and recoil look correct
4. Projectile origin aligns with barrel tip
5. No console errors when V2 is disabled
6. Legacy MBT path still works when flag is off

## Rollback Plan
- Set `window.RENDER_V2_MBT = false`
- Keep V2 files in place, but runtime uses legacy draw only
- No data migration required

## Next Phase (After MBT Stable)
1. `spg`
2. `apc`
3. `aa_tank`
4. Infantry/air units

## Notes
- If full world-scale inflation is needed later, run it as a separate phase after MBT V2 is stable.
- Do not mix "renderer rewrite" and "background/camera scale rewrite" in one release.
