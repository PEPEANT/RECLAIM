#!/usr/bin/env node

const http = require('http');
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const HOST = '127.0.0.1';
const PORT = Number(process.env.SMOKE_PORT || 4173);
const ROOT = path.resolve(__dirname, '..', '..');

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.mp3': 'audio/mpeg',
  '.mp4': 'video/mp4',
  '.wav': 'audio/wav',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2'
};

function safePath(urlPath) {
  const cleanPath = decodeURIComponent((urlPath || '/').split('?')[0]);
  const relPath = cleanPath === '/' ? '/index.html' : cleanPath;
  const absPath = path.resolve(ROOT, '.' + relPath);
  if (!absPath.startsWith(ROOT)) return null;
  return absPath;
}

function createStaticServer() {
  return http.createServer((req, res) => {
    const absPath = safePath(req.url);
    if (!absPath) {
      res.statusCode = 403;
      res.end('Forbidden');
      return;
    }
    fs.stat(absPath, (err, stat) => {
      if (err || !stat.isFile()) {
        res.statusCode = 404;
        res.end('Not found');
        return;
      }
      const ext = path.extname(absPath).toLowerCase();
      res.setHeader('Content-Type', MIME[ext] || 'application/octet-stream');
      fs.createReadStream(absPath).pipe(res);
    });
  });
}

async function waitVisible(page, selector, timeoutMs = 30000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const visible = await page.evaluate((sel) => {
      const el = document.querySelector(sel);
      if (!el) return false;
      const css = getComputedStyle(el);
      if (el.classList.contains('hidden')) return false;
      if (css.display === 'none' || css.visibility === 'hidden') return false;
      return true;
    }, selector).catch(() => false);
    if (visible) return;
    await page.waitForTimeout(100);
  }
  throw new Error('Timeout waiting visible: ' + selector);
}

async function finishBattle(page) {
  await page.evaluate(() => {
    const g = (typeof game !== 'undefined') ? game : (window.game || null);
    if (g && typeof g.endGame === 'function') {
      g.endGame('win', 'SMOKE', 'smoke runner validation');
    }
  });
}

async function runSmoke() {
  const server = createStaticServer();
  let browser = null;
  let pageErrors = 0;
  let uncaughtErrors = 0;
  const network404 = [];

  try {
    await new Promise((resolve, reject) => {
      server.once('error', reject);
      server.listen(PORT, HOST, resolve);
    });

    browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await context.newPage();

    page.on('pageerror', (err) => {
      pageErrors += 1;
      console.error('[pageerror]', err && err.message ? err.message : String(err));
    });

    page.on('console', (msg) => {
      const text = msg.text();
      if (msg.type() === 'error' && /uncaught/i.test(text)) {
        uncaughtErrors += 1;
        console.error('[uncaught]', text);
      }
    });

    page.on('response', (response) => {
      const status = response.status();
      if (status >= 400) {
        const url = response.url();
        if (url.startsWith('http://' + HOST + ':' + PORT + '/')) {
          network404.push({ status, url: new URL(url).pathname });
        }
      }
    });

    await page.goto('http://' + HOST + ':' + PORT + '/index.html', {
      waitUntil: 'domcontentloaded',
      timeout: 45000
    });

    await page.waitForSelector('#boot-play-btn', { timeout: 20000 });
    await page.click('#boot-play-btn');

    await waitVisible(page, '#cinematic-modal', 30000);
    await page.waitForSelector('#cinematic-skip-btn:not([disabled])', { timeout: 15000 });
    await page.click('#cinematic-skip-btn');

    await waitVisible(page, '#map-select-screen', 30000);
    await page.click('.map-card[data-map="skirmish"]');
    await page.waitForFunction(() => {
      const g = (typeof game !== 'undefined') ? game : (window.game || null);
      const mapId = (typeof Maps !== 'undefined' && Maps && Maps.currentMap) ? Maps.currentMap : '';
      return !!(g && g.running === true && mapId === 'skirmish');
    }, null, { timeout: 30000 });

    await finishBattle(page);

    await waitVisible(page, '#end-screen', 15000);
    await page.click('#end-screen button');
    await waitVisible(page, '#map-select-screen', 30000);

    console.log('NETWORK_4XX_5XX_COUNT=' + network404.length);
    for (const item of network404.slice(0, 20)) {
      console.log('NETWORK_' + item.status + ' ' + item.url);
    }

    if (pageErrors === 0 && uncaughtErrors === 0) {
      console.log('SMOKE_OK');
      return 0;
    }

    console.error('SMOKE_FAIL pageErrors=' + pageErrors + ' uncaughtErrors=' + uncaughtErrors);
    return 1;
  } catch (err) {
    console.error('SMOKE_FAIL', err && err.stack ? err.stack : String(err));
    return 1;
  } finally {
    try {
      if (browser) await browser.close();
    } catch (_) {}
    try {
      await new Promise((resolve) => server.close(resolve));
    } catch (_) {}
  }
}

runSmoke().then((code) => {
  process.exitCode = code;
});
