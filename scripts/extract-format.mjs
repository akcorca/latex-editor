#!/usr/bin/env node
// Robustly extract .fmt by pulling binary data directly from the browser context using earlyformat event.

import { chromium } from '@playwright/test'
import { createServer } from 'vite'
import { writeFileSync, mkdirSync, existsSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = join(__dirname, '..')
const outPath = join(root, 'public/swiftlatex/swiftlatexpdftex.fmt')

async function main() {
  console.log('Starting Vite dev server...')
  const server = await createServer({ root, configFile: join(root, 'vite.config.ts') })
  await server.listen()
  const addr = server.httpServer.address()
  const url = `http://localhost:${addr.port}`
  console.log(`Vite running at ${url}`)

  console.log('Launching browser...')
  const browser = await chromium.launch()
  const page = await browser.newPage()

  page.on('console', msg => {
    const text = msg.text();
    if (text.includes('[compile]') || text.includes('[kpse]') || text.includes('[engine]')) {
      console.log(`  [browser] ${text}`);
    }
  })

  await page.addInitScript(() => {
    window.__LATEX_EDITOR_OPTS = {
      skipFormatPreload: true,
      serviceWorker: false,
      texliveUrl: 'https://dwrg2en9emzif.cloudfront.net/2025/'
    };
  });

  await page.goto(url)

  console.log('Waiting for early format bridge data...');
  
  const b64Data = await page.evaluate(async () => {
    return new Promise((resolve) => {
      window.addEventListener('earlyformat', (e) => {
        console.log('Detected earlyformat event! Processing binary...');
        const data = e.detail;
        const binary = Array.from(data).map(b => String.fromCharCode(b)).join('');
        resolve(btoa(binary));
      }, { once: true });
      
      // 3 minute timeout
      setTimeout(() => resolve(null), 180000);
    });
  });

  if (b64Data) {
    const buffer = Buffer.from(b64Data, 'base64');
    mkdirSync(dirname(outPath), { recursive: true });
    writeFileSync(outPath, buffer);
    console.log(`\nSUCCESS: Format saved to ${outPath} (${buffer.length} bytes)`);
  } else {
    console.error('\nFAILED: Timeout or error while building format.');
    process.exit(1);
  }

  await browser.close()
  await server.close()
}

main().catch(e => {
  console.error(e)
  process.exit(1)
})
