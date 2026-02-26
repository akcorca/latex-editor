# Warmup / Preload

Eliminate cold-start latency by pre-fetching TeX Live files before the WASM engine initializes.

## Problem

On first compilation, the WASM worker makes **90 sequential synchronous XHR requests** to the CDN for TeX Live packages (64 file downloads + 26 wasted 403 lookups). Each blocks the worker thread, adding ~2 seconds of network wait before the first PDF appears.

## Quick Start

```ts
import { FastLatex, warmup } from 'fastlatex'

// Start fetching as early as possible (e.g. on page load)
const cache = warmup()

// Later, when mounting the editor:
const editor = new FastLatex('#editor', '#preview', {
  warmupCache: await cache,
})
await editor.init()
```

## How It Works

1. `warmup()` injects a `<link rel="preconnect">` hint for the CDN
2. Fetches all 64 known TeX Live files in parallel (concurrency pool of 6)
3. Tries `.gz` compressed versions first, falls back to raw
4. Returns a `WarmupCache` containing the fetched `ArrayBuffer`s and a list of known-404 entries
5. When passed to the constructor, the engine sends all files to the worker via `postMessage` (with transferables) before compilation starts
6. Known-404 entries are batch-injected into the worker's 404 cache, preventing wasted XHR

## Options

```ts
interface WarmupOptions {
  texliveVersion?: '2020' | '2025'  // default: '2025'
  texliveUrl?: string               // override CDN endpoint
  concurrency?: number              // max parallel fetches (default: 6)
  signal?: AbortSignal              // cancellation
  onProgress?: (completed: number, total: number) => void
}
```

## Performance

Measured with Playwright (Chromium, localhost dev server):

| Metric | Before | After |
|--------|--------|-------|
| Sync XHR during compile | 90 (64 OK + 26 wasted 403) | 0 |
| Time to first PDF | ~4.9s | ~2.9s |

The warmup fetch runs concurrently with other page initialization (Monaco loading, DOM setup), so the effective cost is near zero when called early enough.
