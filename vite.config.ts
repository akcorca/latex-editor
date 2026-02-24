import { defineConfig, loadEnv } from 'vite'
import dts from 'vite-plugin-dts'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const isLibBuild = env.BUILD_MODE === 'lib'

  return {
    base: env.BASE_URL || '/',
    plugins: isLibBuild ? [dts({ rollupTypes: true })] : [],
    build: isLibBuild
      ? {
          target: 'es2022',
          lib: {
            entry: 'src/index.ts',
            formats: ['es'] as const,
            fileName: 'fastlatex',
          },
          cssFileName: 'style',
          rollupOptions: {
            external: [/^monaco-editor/, /^pdfjs-dist/],
            output: {
              assetFileNames: '[name][extname]',
              globals: {
                'monaco-editor': 'monaco',
                'pdfjs-dist': 'pdfjsLib',
              },
            },
          },
        }
      : {
          target: 'es2022',
        },
    server: {
      proxy: {
        '/texlive': {
          target: env.TEXLIVE_URL,
          changeOrigin: true,
          secure: false,
          rewrite: (path: string) => path.replace(/^\/texlive/, ''),
        },
      },
    },
  }
})
