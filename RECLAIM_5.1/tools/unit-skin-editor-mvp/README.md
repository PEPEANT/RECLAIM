# Unit Skin Editor MVP

Purpose
- Minimal, isolated unit skin editor for points-only polygon editing.
- Does not modify existing REC_unit-editor / unit-editor.

Location
- tools/unit-skin-editor-mvp/index.html

Storage
- localStorage key: reclaim_skins_mvp_v1
- Format:
  {
    "version": 1,
    "units": {
      "unitKey": { "points": [ {"x":0,"y":0}, ... ] }
    }
  }

Controls
- Click: select point
- Drag: move selected point
- Shift+Click: add point (nearest segment if close, otherwise append)
- Delete/Backspace: delete selected point
- Wheel: zoom
- Space+Drag or Middle Drag: pan

Buttons
- Save: write current unit points to localStorage
- Reset: clear current unit from storage and restore default box
- Export: download JSON
- Import: load JSON and merge into current set
- Use the Overwrite checkbox to replace all units instead of merge
- Back: history.back()

Notes
- Unit list uses CONFIG.units if available (data.js only). Falls back to a hardcoded list.
- Editor is always in edit mode (no view/edit toggle).
