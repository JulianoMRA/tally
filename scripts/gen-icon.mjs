// scripts/gen-icon.mjs
// Gera build/icon.ico (multi-resolução) e build/icon.png (256x256)
// a partir do SVG primary do Tally. Roda manualmente: `npm run gen:icon`.
// Pré-requisito: sharp e png-to-ico instalados.

import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'
import pngToIco from 'png-to-ico'

const __dirname = dirname(fileURLToPath(import.meta.url))
const rootDir = resolve(__dirname, '..')
const buildDir = resolve(rootDir, 'build')
mkdirSync(buildDir, { recursive: true })

// SVG primary do Tally — adaptado de TallyDesign/marks.js
// Forest #3f6e47 (--income) com fill cream #f7f3e8 (--bg-elev)
const svg = `
<svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg">
  <rect width="64" height="64" rx="14" fill="#3f6e47"/>
  <g fill="#f7f3e8">
    <rect x="12" y="14" width="40" height="6" rx="1"/>
    <rect x="28" y="24" width="8" height="4" rx="1"/>
    <rect x="28" y="30" width="8" height="4" rx="1"/>
    <rect x="28" y="36" width="8" height="4" rx="1"/>
    <rect x="28" y="42" width="8" height="4" rx="1"/>
    <rect x="28" y="48" width="8" height="4" rx="1"/>
  </g>
</svg>`.trim()

const sizes = [16, 32, 48, 64, 128, 256]

console.log('[gen-icon] renderizando PNGs em', sizes.join(', '), 'px...')
const pngBuffers = await Promise.all(
  sizes.map((size) => sharp(Buffer.from(svg)).resize(size, size).png().toBuffer())
)

console.log('[gen-icon] gerando build/icon.ico (multi-res)...')
const icoBuffer = await pngToIco(pngBuffers)
writeFileSync(resolve(buildDir, 'icon.ico'), icoBuffer)

console.log('[gen-icon] gerando build/icon.png (256x256)...')
writeFileSync(resolve(buildDir, 'icon.png'), pngBuffers[pngBuffers.length - 1])

console.log('[gen-icon] OK.')
