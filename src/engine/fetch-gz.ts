/**
 * Shared gzip-first fetch utility used by both the warmup module and
 * the SwiftLatex engine for pre-loading TeX Live files.
 */

/** Collect all chunks from a ReadableStream into a single ArrayBuffer. */
export async function readStreamToBuffer(stream: ReadableStream<Uint8Array>): Promise<ArrayBuffer> {
  const reader = stream.getReader()
  const chunks: Uint8Array[] = []
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    chunks.push(value)
  }
  const total = chunks.reduce((s, c) => s + c.length, 0)
  const result = new Uint8Array(total)
  let offset = 0
  for (const c of chunks) {
    result.set(c, offset)
    offset += c.length
  }
  return result.buffer
}

/**
 * Fetch a URL, trying `.gz` compressed version first (with DecompressionStream),
 * falling back to the raw URL. Returns null if both fail.
 */
export async function fetchGzWithFallback(
  url: string,
  opts?: RequestInit,
): Promise<ArrayBuffer | null> {
  if (typeof DecompressionStream !== 'undefined') {
    try {
      const resp = await fetch(`${url}.gz`, opts)
      if (resp.ok) {
        const ds = new DecompressionStream('gzip')
        return await readStreamToBuffer(resp.body!.pipeThrough(ds))
      }
    } catch {
      // .gz fetch or decompress failed — try raw
    }
  }

  try {
    const resp = await fetch(url, opts)
    if (!resp.ok) return null
    return await resp.arrayBuffer()
  } catch {
    return null
  }
}
