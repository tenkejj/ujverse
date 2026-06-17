/**
 * Czyści PNG sowy Versusia.
 *
 * Light: usuwa tylko matte od krawędzi (oczy zostają białe).
 * Dark:  usuwa matte + wszystkie białe wypełnienia (oczy = dziury → widać tło karty).
 */
import sharp from 'sharp'
import { readFileSync, writeFileSync } from 'fs'
import { resolve } from 'path'

const THRESHOLD = 235

function isNearWhite(r, g, b, a) {
  return a > 8 && r >= THRESHOLD && g >= THRESHOLD && b >= THRESHOLD
}

function zeroRgb(data, o) {
  data[o] = 0
  data[o + 1] = 0
  data[o + 2] = 0
  data[o + 3] = 0
}

function floodEdgeWhite(data, width, height, channels) {
  const visited = new Uint8Array(width * height)
  const queue = []
  const idx = (x, y) => y * width + x
  const pushIfBg = (x, y) => {
    const i = idx(x, y)
    if (visited[i]) return
    const o = i * channels
    if (!isNearWhite(data[o], data[o + 1], data[o + 2], data[o + 3])) return
    visited[i] = 1
    queue.push(i)
  }

  for (let x = 0; x < width; x++) {
    pushIfBg(x, 0)
    pushIfBg(x, height - 1)
  }
  for (let y = 0; y < height; y++) {
    pushIfBg(0, y)
    pushIfBg(width - 1, y)
  }

  while (queue.length > 0) {
    const i = queue.pop()
    const x = i % width
    const y = (i - x) / width
    zeroRgb(data, i * channels)
    if (x > 0) pushIfBg(x - 1, y)
    if (x < width - 1) pushIfBg(x + 1, y)
    if (y > 0) pushIfBg(x, y - 1)
    if (y < height - 1) pushIfBg(x, y + 1)
  }
}

function stripAllWhite(data, channels) {
  for (let i = 0; i < data.length; i += channels) {
    if (isNearWhite(data[i], data[i + 1], data[i + 2], data[i + 3])) {
      zeroRgb(data, i)
    }
  }
}

async function cleanVersuPng(fileName, stripInteriorWhite) {
  const filePath = resolve('public', fileName)
  const input = readFileSync(filePath)
  const { data, info } = await sharp(input).ensureAlpha().raw().toBuffer({ resolveWithObject: true })
  const { width, height, channels } = info

  floodEdgeWhite(data, width, height, channels)
  if (stripInteriorWhite) stripAllWhite(data, channels)

  for (let i = 0; i < data.length; i += channels) {
    if (data[i + 3] < 8) zeroRgb(data, i)
  }

  const trimmed = await sharp(data, { raw: { width, height, channels } })
    .trim()
    .png()
    .toBuffer()

  writeFileSync(filePath, trimmed)
  const meta = await sharp(trimmed).metadata()
  console.log('cleaned', fileName, `${meta.width}x${meta.height}`, stripInteriorWhite ? '(dark eyes)' : '')
}

// Przywróć oryginały przed czyszczeniem
const assets = resolve(
  'C:/Users/frani/.cursor/projects/c-Users-frani-ujverse/assets',
)
const lightSrc =
  `${assets}/c__Users_frani_AppData_Roaming_Cursor_User_workspaceStorage_289b3f3c12a5833ed81a6a48615cc744_images_flux-pro-2.0_Same_owl_logo._Remove_black_background___fully_transparent._Merge_to_single-co-0-e09feb35-caa9-479f-b230-77e1184d8436.png`
const darkSrc =
  `${assets}/c__Users_frani_AppData_Roaming_Cursor_User_workspaceStorage_289b3f3c12a5833ed81a6a48615cc744_images_flux-pro-2.0_Same_owl_logo_identical_shape_and_proportions._Recolor_only._Dark_mode_app_icon_-0-4d714a84-553b-462d-bd03-197becf89391.png`

writeFileSync(resolve('public/versu-icon-light.png'), readFileSync(lightSrc))
writeFileSync(resolve('public/versu-icon-dark.png'), readFileSync(darkSrc))

await cleanVersuPng('versu-icon-light.png', false)
await cleanVersuPng('versu-icon-dark.png', true)
