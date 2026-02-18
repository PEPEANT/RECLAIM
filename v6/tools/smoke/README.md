# Smoke Runner

Reusable Playwright smoke runner for RECLAIM v6.

## Setup

```bash
npm i --no-save playwright
npx playwright install chromium
```

## Run

```bash
node tools/smoke/smoke_runner.cjs
```

Optional port:

```bash
SMOKE_PORT=4273 node tools/smoke/smoke_runner.cjs
```

## Checks

- boot gate -> cinematic -> skip -> lobby
- guest login -> city -> campaign -> battle
- end screen -> return to city
- `pageerror` and `Uncaught` console error count
- local network `4xx/5xx` summary (useful for missing asset checks)
