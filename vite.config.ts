import { defineConfig } from 'vite'

const isLibBuild = process.env.BUILD_MODE === 'lib'

export default defineConfig({
  base: process.env.BASE_URL || '/',
  build: isLibBuild
    ? {
        target: 'es2022',
        lib: {
          entry: 'src/index.ts',
          formats: ['es'],
          fileName: 'latex-editor',
        },
        cssFileName: 'style',
        rollupOptions: {
          output: {
            assetFileNames: '[name][extname]',
          },
        },
      }
    : {
        target: 'es2022',
      },
  server: {
    // COOP/COEP not needed — SwiftLaTeX doesn't use SharedArrayBuffer
    // Omitting avoids blocking same-origin proxied texlive requests
    proxy: {
      // Proxy /texlive/ to the Texlive-Ondemand server
      // Worker fetches from texlive_endpoint + "pdftex/..."
      // so we set endpoint to "/texlive/" and proxy it
      '/texlive': {
        target: process.env.TEXLIVE_URL || 'http://localhost:5001',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/texlive/, ''),
      },
    },
  },
})
