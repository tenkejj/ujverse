import type { Area } from 'react-easy-crop'

function createImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image()
    image.addEventListener('load', () => resolve(image))
    image.addEventListener('error', (err) => reject(err))
    if (!url.startsWith('data:')) {
      image.crossOrigin = 'anonymous'
    }
    image.src = url
  })
}

const MAX_OUTPUT_WIDTH = 1200
const JPEG_QUALITY = 0.92

/** Kadruje obraz wg `pixelCrop` (współrzędne w pikselach naturalnych obrazka), skaluje max szer. 1200px, zwraca JPEG Base64. */
export async function getCroppedImageAsJpegBase64(
  imageSrc: string,
  pixelCrop: Area,
): Promise<string> {
  const image = await createImage(imageSrc)
  const canvas = document.createElement('canvas')
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Brak kontekstu Canvas')

  const cx = Math.round(pixelCrop.x)
  const cy = Math.round(pixelCrop.y)
  const cw = Math.max(1, Math.round(pixelCrop.width))
  const ch = Math.max(1, Math.round(pixelCrop.height))
  canvas.width = cw
  canvas.height = ch

  ctx.drawImage(image, cx, cy, cw, ch, 0, 0, cw, ch)

  let outW = canvas.width
  let outH = canvas.height
  if (outW > MAX_OUTPUT_WIDTH) {
    outH = Math.round((outH * MAX_OUTPUT_WIDTH) / outW)
    outW = MAX_OUTPUT_WIDTH
    const out = document.createElement('canvas')
    out.width = outW
    out.height = outH
    const octx = out.getContext('2d')
    if (!octx) return canvas.toDataURL('image/jpeg', JPEG_QUALITY)
    octx.imageSmoothingEnabled = true
    octx.imageSmoothingQuality = 'high'
    octx.drawImage(canvas, 0, 0, outW, outH)
    return out.toDataURL('image/jpeg', JPEG_QUALITY)
  }

  return canvas.toDataURL('image/jpeg', JPEG_QUALITY)
}
