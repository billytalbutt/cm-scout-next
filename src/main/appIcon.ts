import { app, nativeImage, type NativeImage } from 'electron'
import { existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))

/** Paths to try for window / dock / taskbar icon (dev + packaged). */
function appIconCandidates(): string[] {
  if (app.isPackaged) {
    return [
      join(process.resourcesPath, 'icon.ico'),
      join(process.resourcesPath, 'icon.png'),
    ]
  }
  return [
    join(__dirname, '../renderer/favicon.png'),
    join(__dirname, '../../build/icon.png'),
    join(__dirname, '../../src/renderer/public/favicon.png'),
  ]
}

/** Wizard mascot for title bar, taskbar, dock, and installer branding. */
export function resolveAppIcon(): NativeImage | undefined {
  for (const p of appIconCandidates()) {
    if (!existsSync(p)) continue
    const img = nativeImage.createFromPath(p)
    if (!img.isEmpty()) return img
  }
  return undefined
}

export function applyAppIcon(): void {
  const icon = resolveAppIcon()
  if (!icon) return
  if (process.platform === 'darwin' && app.dock) {
    app.dock.setIcon(icon)
  }
}
