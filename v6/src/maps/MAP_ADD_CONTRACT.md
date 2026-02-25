# Map Add Contract (Pre-Battle Flow)

This is the required contract for adding a new playable map to pre-battle flow.

## 1) Map module files

For map id `YOUR_MAP_ID`, add:

- `src/maps/maps/skirmish/maps/YOUR_MAP_ID/definition.js`
- `src/maps/maps/skirmish/maps/YOUR_MAP_ID/render_base.js`
- `src/maps/maps/skirmish/maps/YOUR_MAP_ID/render_decor.js`

Each file must register into `MapRegistry`:

- `definition.js`: map id/theme/rules
- `render_base.js`: `hooks.renderBase`
- `render_decor.js`: `hooks.renderDecor`

## 2) Script loading in HTML

Load all three scripts in `index.html` and `index_dev.html`:

- `.../YOUR_MAP_ID/definition.js`
- `.../YOUR_MAP_ID/render_base.js`
- `.../YOUR_MAP_ID/render_decor.js`

## 3) Pre-battle flow config

Add `YOUR_MAP_ID` in `MAP_FLOW_CONFIG_BY_MAP` (both `index.html` and `index_dev.html`):

- `mapId`
- `requireFaction`
- `introVideo`
- `introBgm`

## 4) Map select card

Add one map card with:

- class: `.map-card`
- attribute: `data-map="YOUR_MAP_ID"`
- preview image `img src`

## 5) Resource path wiring

Provide real files for:

- preview image path used by the card
- intro video path used by `MAP_FLOW_CONFIG_BY_MAP`
- intro BGM path used by `MAP_FLOW_CONFIG_BY_MAP`

## 6) Runtime guard

Startup guard (`runMapContractChecks`) validates:

- card `data-map`
- `MAP_FLOW_CONFIG_BY_MAP` entry
- map scripts present (`definition`, `render_base`, `render_decor`)
- `MapRegistry` definition + hooks (`renderBase`, `renderDecor`)
- intro resource paths configured
- preview image path configured

Warnings are exposed to:

- `window.__RECLAIM_MAP_CONTRACT_WARNINGS__`
- browser console (`[MapContract] ...`)

