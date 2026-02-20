# Code Organization Rules

## Goal
- Keep `style.css` and `game.js` as legacy entry bundles.
- Add new features in scoped modules/files so future contributors and AI agents can find/edit safely.

## Rules
1. Do not add new feature styles directly to `style.css`.
2. Do not add new feature gameplay logic directly to `game.js`.
3. Add new code to feature folders first, then wire from entry files only when needed.

## Recommended Paths
- City tutorial styles: `src/modes/city-sim/tutorial/tutorial.css`
- City tutorial state/progress logic: `src/modes/city-sim/tutorial/progress.js`
- City tutorial flow logic: `src/modes/city-sim/tutorial/intro.js`
- General feature styles: `src/styles/*.css`
- Game mode logic: `src/modes/**`

## Allowed Exceptions
- Emergency hotfixes can patch `style.css` or `game.js` temporarily.
- If exception is used, move code to module files in the next cleanup commit.
