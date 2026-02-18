#!/usr/bin/env node
// Highly robust extraction using a temporary local upload server.

import { chromium } from '@playwright/test'
import { createServer } from 'vite'
import { writeFileSync, mkdirSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import http from 'http'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = join(__dirname, '..')
const outPath = join(root, 'public/swiftlatex/swiftlatexpdftex.fmt')

async function main() {
  // 1. Start a tiny HTTP server to receive the file from the browser
  let fmtReceived = false;
  const uploadServer = http.createServer((req, res) => {
    if (req.url === '/upload-fmt' && req.method === 'POST') {
      const chunks = [];
      req.on('data', chunk => chunks.push(chunk));
      req.on('end', () => {
        const buffer = Buffer.concat(chunks);
        mkdirSync(dirname(outPath), { recursive: true });
        writeFileSync(outPath, buffer);
        console.log(`\nSUCCESS: Format received and saved to ${outPath} (${buffer.length} bytes)`);
        fmtReceived = true;
        res.writeHead(200);
        res.end('OK');
      });
    } else {
      res.writeHead(404);
      res.end();
    }
  });

  // Listen on a random available port
  uploadServer.listen(0);
  const uploadPort = uploadServer.address().port;
  console.log(`Upload server listening on port ${uploadPort}`);

  // 2. Start Vite
  console.log('Starting Vite dev server...');
  const server = await createServer({ 
    root, 
    configFile: join(root, 'vite.config.ts'),
    server: {
      proxy: {
        '/upload-fmt': `http://localhost:${uploadPort}`
      }
    }
  })
  await server.listen()
  const addr = server.httpServer.address()
  const url = `http://localhost:${addr.port}`

  // 3. Run Playwright
  console.log('Launching browser...');
  const browser = await chromium.launch()
  const page = await browser.newPage()

  page.on('console', msg => {
    const text = msg.text();
    if (text.includes('[compile]') || text.includes('[main]') || text.includes('failed')) {
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

  console.log('Waiting for format build and upload (watching earlyformat event)...');
  
  const earlyFmtData = await page.evaluate(async () => {
    return new Promise((resolve) => {
      window.addEventListener('earlyformat', (e) => {
        console.log('Detected earlyformat event!');
        const data = e.detail;
        const binary = Array.from(data).map(b => String.fromCharCode(b)).join('');
        resolve(btoa(binary));
      }, { once: true });
      
      setTimeout(() => resolve(null), 180000);
    });
  });

  if (earlyFmtData) {
    const buffer = Buffer.from(earlyFmtData, 'base64');
    mkdirSync(dirname(outPath), { recursive: true });
    writeFileSync(outPath, buffer);
    console.log(`\nSUCCESS: Format received via early bridge and saved to ${outPath} (${buffer.length} bytes)`);
    fmtReceived = true;
  }

  // Fallback to polling if early bridge missed
  if (!fmtReceived) {
    const start = Date.now();
    while (!fmtReceived && Date.now() - start < 180000) {
    await new Promise(r => setTimeout(r, 1000));
  }

  if (!fmtReceived) {
    console.error('\nFAILED: Timeout waiting for browser upload.');
    process.exit(1);
  }

  await browser.close()
  await server.close()
  uploadServer.close()
  console.log('Done!');
}

main().catch(e => {
  console.error(e)
  process.exit(1)
})
