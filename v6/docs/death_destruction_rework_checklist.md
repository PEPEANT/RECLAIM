# Death/Destruction Rework Checklist

Updated: 2026-02-24

## Policy
- Do not batch everything at once.
- Complete items one by one and mark each as done.
- Important scope note:
  - "Remove old destruction render/sprite/debris/wreck references" applies to armored units only.

## Priority Order
1. Bagpiper death render missing/placeholder box
2. Infantry explosion death showing standing pose
3. Armored destruction old-render mixed references cleanup
4. Unified destruction presentation rework (re-render color-variant + simple FX)

## Tasks
- [x] P1 Bagpiper death render missing/placeholder fix
  - [x] Ensure corpse render path does not fall into unknown placeholder for `bagpiper`
  - [x] Validate bagpiper death appears as normal fallen infantry-style corpse

- [x] P2 Explosion death stance bug (infantry)
  - [x] Audit death-type branch and corpse animation path for explosive attacks
  - [x] Prevent standing-looking death on explosion/bomb impact

- [x] P3 Armored-only old destruction reference removal
  - [x] Remove legacy armored destruction sprite/debris/wreck references
  - [x] Keep non-armored behavior out of scope for this item

- [x] P4 Unified destruction style pass
  - [x] Replace complex legacy wreck visuals with simplified re-render style
  - [x] Use color damage variant + minimal FX as common rule

## Progress Log
- 2026-02-24: Checklist created. Work starts from P1.
- 2026-02-24: P1 completed. `bagpiper` corpse render now maps to V2 `infantry` renderer to avoid placeholder fallback.
- 2026-02-24: P2 completed. Explosion deaths now accelerate fall progression and force infantry-family corpse pose away from standing.
- 2026-02-24: P3 completed. Armored wrecks now bypass legacy `IngameRenderer.drawWreck` and use simplified color-variant rerender only.
- 2026-02-24: P4 completed. Armored destruction visuals are unified under simplified rerender (burned tone + scorch + minimal ember/smoke).
