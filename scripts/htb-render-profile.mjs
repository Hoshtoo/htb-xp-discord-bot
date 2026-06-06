#!/usr/bin/env node
/**
 * Render an HTB profile page like a real browser (Vue SPA + API calls).
 *
 * Usage:
 *   export HTB_TOKEN='your-app-token'
 *   node scripts/htb-render-profile.mjs [userId] [outputDir]
 *
 * Outputs: profile.html, profile.png, profile.txt, api-captures.json
 */

import { chromium } from 'playwright';
import { writeFile, mkdir } from 'fs/promises';
import { join } from 'path';
import { fileURLToPath } from 'url';

/**
 * @param {string} userId - HTB numeric user ID
 * @param {string} outDir - Directory for output files
 * @param {{ token?: string }} [options]
 * @returns {Promise<{ outDir: string, captureCount: number }>}
 */
export async function captureProfile(userId, outDir, options = {}) {
  const token = options.token ?? process.env.HTB_TOKEN;
  if (!token) {
    throw new Error('Set HTB_TOKEN to your Hack The Box app token.');
  }

  await mkdir(outDir, { recursive: true });

  const apiCaptures = [];

  const launchOptions = { headless: true };
  if (process.env.PW_EXECUTABLE_PATH) {
    launchOptions.executablePath = process.env.PW_EXECUTABLE_PATH;
  } else {
    launchOptions.channel = process.env.PW_CHANNEL || 'chrome';
  }

  const browser = await chromium.launch(launchOptions);
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    userAgent:
      'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
  });

  const page = await context.newPage();

  page.on('response', async (response) => {
    const url = response.url();
    if (!/hackthebox\.com\/api\//.test(url)) return;
    try {
      const ct = response.headers()['content-type'] || '';
      if (!ct.includes('json')) return;
      const body = await response.json();
      apiCaptures.push({ url, status: response.status(), body });
    } catch {
      /* non-json or aborted */
    }
  });

  await page.goto('https://app.hackthebox.com/', { waitUntil: 'domcontentloaded' });
  await page.evaluate((t) => {
    localStorage.setItem('htb-token', t);
  }, token);

  const profileUrl = `https://app.hackthebox.com/users/${userId}`;
  console.log(`Loading ${profileUrl} ...`);

  await page.goto(profileUrl, { waitUntil: 'domcontentloaded', timeout: 60_000 });

  await page
    .waitForFunction(
      () => {
        const app = document.querySelector('#app');
        if (!app) return false;
        const text = app.innerText || '';
        if (text.includes("doesn't work properly without JavaScript")) return false;
        return text.trim().length > 200;
      },
      { timeout: 90_000 }
    )
    .catch(() => {
      console.warn('Timed out waiting for rich profile content; saving partial render.');
    });

  await page.waitForTimeout(2000);

  const html = await page.content();
  const text = await page.evaluate(() => document.body.innerText);
  const screenshot = await page.screenshot({ fullPage: true });

  await writeFile(join(outDir, 'profile.html'), html, 'utf8');
  await writeFile(join(outDir, 'profile.png'), screenshot);
  await writeFile(join(outDir, 'profile.txt'), text, 'utf8');
  await writeFile(
    join(outDir, 'api-captures.json'),
    JSON.stringify(apiCaptures, null, 2),
    'utf8'
  );

  await browser.close();

  return { outDir, captureCount: apiCaptures.length };
}

async function main() {
  const userId = process.argv[2] || '1986668';
  const outDir = process.argv[3] || join(process.cwd(), `htb-profile-${userId}`);

  const { captureCount } = await captureProfile(userId, outDir);

  console.log(`Saved to ${outDir}/`);
  console.log(`  profile.html  — full rendered DOM`);
  console.log(`  profile.png   — full-page screenshot`);
  console.log(`  profile.txt   — visible text`);
  console.log(`  api-captures.json — ${captureCount} API JSON responses`);
}

const isMain = process.argv[1] === fileURLToPath(import.meta.url);

if (isMain) {
  main().catch((err) => {
    console.error(err.message || err);
    process.exit(1);
  });
}
