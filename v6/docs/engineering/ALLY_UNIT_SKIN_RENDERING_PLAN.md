# Ally Unit Skin Rendering Plan (Gray/Green)

## Status
- This plan is valid only for minor visual variation work.
- If unit behavior/spec itself is being overhauled, use:
- `docs/engineering/UNIT_SYSTEM_V2_REWORK_PLAN.md`

## Goal
- Add two selectable skins for allied (`team === 'player'`) units:
- `ally_gray`
- `ally_green`
- Keep current gameplay logic unchanged and isolate large rendering code in a separate folder.

## Why This First
- Current unit rendering is concentrated in `classes.js` and is already large.
- Team color is hardcoded in many unit branches, so direct in-place edits can cause regressions.
- A modular renderer path allows gradual migration without breaking existing units.

## Scope
- Rendering only.
- Allied units only.
- Support skin selection from preset/slot data where needed.

## Out Of Scope (Phase 1)
- Enemy/neutral/civilian skin system.
- Balance/stat changes.
- Rewriting all legacy hardcoded draw branches at once.

## Proposed Folder Structure
```text
src/render/unit-skins/
  index.js                # public API (resolve + render)
  skin-ids.js             # skin constants
  palettes.js             # ally_gray / ally_green color tokens
  resolver.js             # decide effective skin per unit/team
  renderers/
    infantry.js
    armored.js
    air.js
```

## Data Contract
- Unit-level render key:
- `unit.renderSkinId` (string, optional)
- Allowed values (phase 1):
- `ally_gray`
- `ally_green`

- Spawn option extension (compatible with existing object path):
- In `spawnUnitDirect(key, x, y, team, spawnArg)` allow:
- `spawnArg.skinId`

- Slot/preset extension:
- Custom battle slot: `{ unitId, count, skinId }`
- Skirmish preset entry: `{ unitId, count, skinId }`

## Integration Points (Current Code)
- `game.js`
- `spawnUnitDirect(...)` currently accepts object spawn options (already used for `veteran`).
- Add optional `skinId` mapping to spawned unit: `unit.renderSkinId = ...`.

- `classes.js`
- `Unit.draw(ctx)` currently tries `UnitRenderUtils.renderSkinLayers(...)` then falls back to hardcoded branch rendering.
- Insert new renderer hook before hardcoded branches:
- `UnitSkinRenderer.render(this, ctx)` -> boolean
- If `true`, skip legacy branch; if `false`, continue current code.

- `src/game/custom_battle.js`
- Slot model currently `{ unitId, count }`.
- Extend to `{ unitId, count, skinId }` for ally slots first.

## Fallback Rules
- If `team !== 'player'`: ignore `ally_*` skin and use existing renderer.
- If skin renderer for a unit type is missing: fall back to legacy draw path.
- If invalid `skinId`: use default allied color flow (current behavior).

## Phase Plan
1. Add renderer scaffolding in `src/render/unit-skins/`.
2. Wire `classes.js` hook with safe fallback.
3. Extend `spawnUnitDirect` to accept/apply `skinId`.
4. Extend custom battle ally slot UI/model with skin selector.
5. Migrate priority unit groups first (infantry -> armored -> air).
6. Regression test (spawn, skirmish deploy, custom battle presets).

## Acceptance Criteria
- Allied unit can render in either `ally_gray` or `ally_green`.
- Existing units without skin selection render exactly as before.
- Enemy rendering remains unchanged.
- No runtime errors when skin data is absent/invalid.
