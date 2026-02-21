# Unit Render V2 Migration Standard

## Purpose
- Define one unified process for replacing legacy unit rendering with V2, unit by unit.
- Ensure every migration has the same structure, validation, rollback path, and status tracking.

## Core Rule
- Migrate **one unit at a time**.
- Keep legacy renderer active as fallback until each unit is verified.
- Do not combine renderer rewrite with unrelated world/background rewrites in the same step.

## Standard Folder Layout
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

## Standard Doc Layout
```text
docs/engineering/unit-v2/
  UNIT_V2_SPEC_TEMPLATE.md
  <unit-id>.md
```

Each migrated unit must have one spec file:
- `docs/engineering/unit-v2/<unit-id>.md`

## Runtime Contract (Mandatory)
- `registry.js` must expose unit-level renderer lookup by `unit.stats.id`.
- Unit-level renderer must expose:
1. `canRender(unit)` -> boolean
2. `draw(unit, ctx, env)` -> boolean (`true` means draw handled)

- Draw dispatch policy:
```js
const renderer = UnitRenderV2Registry[unitId];
if (unit.renderVersion === 'v2' && renderer && renderer.canRender(unit)) {
  if (renderer.draw(unit, ctx, env) === true) return;
}
// fallback
LegacyUnitRenderer.draw(unit, ctx);
```

## Feature Flag Policy
- Global flag object:
```js
window.RENDER_V2_UNITS = window.RENDER_V2_UNITS || {};
```
- Per-unit flags:
```js
window.RENDER_V2_UNITS.mbt = true;
window.RENDER_V2_UNITS.apc = false;
```

- Spawn-time assignment:
```js
if (window.RENDER_V2_UNITS[unit.stats.id] === true) {
  unit.renderVersion = 'v2';
}
```

## Scale Policy
- Shared V2 scale tokens only in `src/render/unit-v2/common/scale.js`.
- Unit code must consume shared tokens, not hardcode random scale constants.
- Phase order:
1. Visual inflation only
2. Hitbox/collision sync
3. Background/world scale (separate milestone)

## Per-Unit Migration Workflow
1. Create spec file from template (`docs/engineering/unit-v2/<unit-id>.md`).
2. Add renderer folder (`src/render/unit-v2/units/<unit-id>/`).
3. Implement V2 renderer with no gameplay behavior changes.
4. Register unit in V2 registry.
5. Add feature flag gate for that unit.
6. Validate checklist (visual + gameplay safety).
7. Keep legacy fallback; do not delete legacy path yet.

## Definition of Done (Per Unit)
1. V2 render works in all playable maps/modes where the unit appears.
2. No visual ground floating/sinking.
3. Weapon muzzle/projectile spawn alignment matches expected position.
4. No new runtime errors in console.
5. Flag off returns unit to legacy rendering instantly.
6. Unit spec doc exists and is updated with known limitations.

## Regression Checklist (Mandatory)
1. Selection ring and HP bar alignment
2. Facing flip behavior (`player` / `enemy`)
3. Recoil/animation state continuity
4. Spawn/despawn effects still visible
5. Performance impact acceptable in mass-spawn cases

## Rollback Standard
- Never remove legacy rendering during initial migration.
- Rollback = disable per-unit flag.
- Keep V2 files for iterative fixes; do not hot-delete during incident response.

## Naming Convention
- Renderer module: `src/render/unit-v2/units/<unit-id>/index.js`
- Spec file: `docs/engineering/unit-v2/<unit-id>.md`
- Commit scope recommendation: `render-v2(<unit-id>): ...`

## Tracking Recommendation
- Maintain a simple status table in each planning doc:
- `planned` -> `in_progress` -> `qa` -> `released`

This status model must be used consistently for all unit migrations.
