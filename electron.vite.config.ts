import { copyFileSync, cpSync, existsSync, mkdirSync, readdirSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { defineConfig } from 'electron-vite'
import react from '@vitejs/plugin-react'
import type { Plugin } from 'vite'

/** Splash + `public/` are not entry points — copy them into `out/renderer` after each renderer build. */
function copyRendererStaticAssets(): Plugin {
  return {
    name: 'copy-renderer-static-assets',
    writeBundle() {
      const outDir = resolve('out/renderer')
      mkdirSync(outDir, { recursive: true })
      const splashSrc = resolve('src/renderer/splash.html')
      if (existsSync(splashSrc)) {
        copyFileSync(splashSrc, join(outDir, 'splash.html'))
      }
      const splashSticker = resolve('src/renderer/public/splash-sticker.png')
      if (existsSync(splashSticker)) {
        copyFileSync(splashSticker, join(outDir, 'splash-sticker.png'))
      }
      const headerMascot = resolve('src/renderer/src/assets/soccer-wizard-mascot.png')
      if (existsSync(headerMascot)) {
        copyFileSync(headerMascot, join(outDir, 'soccer-wizard-mascot.png'))
      }
      const publicDir = resolve('src/renderer/public')
      for (const name of ['favicon.png', 'favicon-32.png', 'favicon-48.png', 'favicon-64.png', 'favicon-128.png', 'favicon-256.png']) {
        const src = join(publicDir, name)
        if (existsSync(src)) copyFileSync(src, join(outDir, name))
      }
      const publicAssets = resolve('src/renderer/public')
      if (existsSync(publicAssets)) {
        for (const name of readdirSync(publicAssets)) {
          if (name.startsWith('favicon')) continue
          const src = join(publicAssets, name)
          cpSync(src, join(outDir, name), { recursive: true })
        }
      }
    },
  }
}

export default defineConfig({
  main: {},
  preload: {
    build: {
      rollupOptions: {
        output: {
          format: 'cjs',
        },
      },
    },
  },
  renderer: {
    base: './',
    publicDir: resolve('src/renderer/public'),
    plugins: [react(), copyRendererStaticAssets()],
    build: {
      copyPublicDir: true,
    },
  },
})
