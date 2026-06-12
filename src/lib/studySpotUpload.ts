/**
 * UJverse — studySpotUpload: helper do uploadu zdjęć miejsc do nauki.
 *
 * Copyright © 2026 Franciszek Dranka. All rights reserved.
 * License: Proprietary — see LICENSE in repo root.
 *
 * Bucket `study-spots-photos` jest publiczny — getPublicUrl zwraca CDN link
 * (bez signed URL). Ścieżka `<spot_id>/<user_id>/<uuid>-<safeName>` jest
 * gatowana przez RLS w migracji `20260630100000_study_spots_drop2.sql`.
 *
 * Sanityzacja nazwy oraz `genUuid` współdzielone wzorem z `aulaUpload.ts`.
 */
import { supabase } from '../supabaseClient'

export const STUDY_SPOTS_BUCKET = 'study-spots-photos'

export const MAX_PHOTO_SIZE = 8 * 1024 * 1024 // 8 MB
export const MAX_PHOTOS_PER_SPOT = 6

export const ALLOWED_PHOTO_MIMES: ReadonlySet<string> = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
])

export const PHOTO_ACCEPT_ATTR = Array.from(ALLOWED_PHOTO_MIMES).join(',')

function sanitizeName(name: string): string {
  const safe = name.replace(/[^\w.-]+/g, '_').replace(/^_+|_+$/g, '')
  if (safe.length === 0) return 'photo'
  if (safe.length <= 80) return safe
  const dot = safe.lastIndexOf('.')
  if (dot > 0 && safe.length - dot <= 8) {
    const ext = safe.slice(dot)
    return safe.slice(0, 80 - ext.length) + ext
  }
  return safe.slice(0, 80)
}

function genUuid(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID()
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
}

export type PhotoValidation = { ok: true } | { ok: false; reason: string }

export function validatePhoto(file: File): PhotoValidation {
  if (file.size > MAX_PHOTO_SIZE) {
    const mb = (file.size / (1024 * 1024)).toFixed(1)
    return { ok: false, reason: `Plik za duży (${mb} MB). Maks. 8 MB.` }
  }
  if (!ALLOWED_PHOTO_MIMES.has(file.type)) {
    return {
      ok: false,
      reason: `Niewspierany typ (${file.type || 'nieznany'}). Tylko JPG, PNG, WEBP.`,
    }
  }
  return { ok: true }
}

export type UploadedPhoto = {
  /** Ścieżka w bucketcie, do removePhoto. */
  path: string
  /** Publiczny URL (CDN) do zapisu w `study_spots.photo_urls`. */
  publicUrl: string
}

export async function uploadStudySpotPhoto(
  file: File,
  spotId: string,
  userId: string,
): Promise<UploadedPhoto> {
  const v = validatePhoto(file)
  if (!v.ok) throw new Error(v.reason)

  const safe = sanitizeName(file.name)
  const path = `${spotId}/${userId}/${genUuid()}-${safe}`

  const { error } = await supabase.storage
    .from(STUDY_SPOTS_BUCKET)
    .upload(path, file, {
      contentType: file.type,
      upsert: false,
    })
  if (error) throw new Error(error.message || 'Upload nie powiódł się')

  const { data } = supabase.storage.from(STUDY_SPOTS_BUCKET).getPublicUrl(path)
  return { path, publicUrl: data.publicUrl }
}

/**
 * Z publicznego URL bucketu wyciąga ścieżkę `<spot_id>/<user_id>/<file>` do
 * `storage.remove([path])`. Zwraca null jeśli URL nie pasuje do bucketu.
 */
export function publicUrlToPath(publicUrl: string): string | null {
  const marker = `/storage/v1/object/public/${STUDY_SPOTS_BUCKET}/`
  const idx = publicUrl.indexOf(marker)
  if (idx === -1) return null
  return decodeURIComponent(publicUrl.slice(idx + marker.length))
}

export async function removeStudySpotPhoto(publicUrl: string): Promise<void> {
  const path = publicUrlToPath(publicUrl)
  if (!path) throw new Error('Nieprawidłowy URL zdjęcia')
  const { error } = await supabase.storage
    .from(STUDY_SPOTS_BUCKET)
    .remove([path])
  if (error) throw new Error(error.message || 'Nie udało się usunąć zdjęcia')
}
