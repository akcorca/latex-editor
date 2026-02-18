#!/usr/bin/env node
// Robustly extract .fmt by pulling binary data directly from the browser context.

import { chromium } from '@playwright/test'
import { createServer } from 'vite'
import { writeFileSync, mkdirSync } from 'fs'
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
    // Only log essential browser messages to keep output clean
    if (text.includes('[compile]') || text.includes('[kpse]') || text.includes('failed')) {
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

  console.log('Waiting for format generation (this takes ~1-2 mins)...');
  
  // Polling logic: check if the editor has finished building the format
  const fmtDataB64 = await page.evaluate(async () => {
    return new Promise((resolve) => {
      const start = Date.now();
      const check = setInterval(() => {
        // window.__latexEditor is exposed in main.ts after init()
        const editor = window.__latexEditor;
        if (editor) {
          const fmt = editor.getLastBuiltFormat();
          if (fmt) {
            clearInterval(check);
            // Convert Uint8Array to base64 for transport
            const binary = Array.from(fmt).map(b => String.fromCharCode(b)).join('');
            resolve(btoa(binary));
          }
        }
        
        // Timeout after 5 minutes
        if (Date.now() - start > 300000) {
          clearInterval(check);
          resolve(null);
        }
      }, 1000);
    });
  });

  if (fmtDataB64) {
    const buffer = Buffer.from(fmtDataB64, 'base64');
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
