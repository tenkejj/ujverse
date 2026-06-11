/**
 * UJverse — aulaUpload: zcentralizowany helper do uploadu załączników
 * wiadomości Auli. Wymusza limity (size, MIME) zgodne z `storage.buckets`
 * w migracji `20260612090000_aula_files.sql`. Pierwszy taki helper w repo —
 * uploady awatara/banera/postu zostają legacy w bucketcie `media`.
 *
 * Copyright © 2026 Franciszek Dranka. All rights reserved.
 * License: Proprietary — see LICENSE in repo root.
 */
import {
  File as FileIcon,
  FileArchive,
  FileSpreadsheet,
  FileText,
  Image as ImageIcon,
  Presentation,
  type LucideIcon,
} from 'lucide-react'
import { supabase } from '../supabaseClient'

export const AULA_BUCKET = 'aula-files'

export const MAX_FILE_SIZE = 25 * 1024 * 1024 // 25 MB

/** MIRROR migracji `allowed_mime_types` — trzymaj zsynchronizowane. */
export const ALLOWED_MIME_TYPES: ReadonlySet<string> = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'application/msword',
  'application/vnd.ms-excel',
  'application/vnd.ms-powerpoint',
  'text/plain',
  'text/markdown',
  'application/zip',
])

/** Lista do `<input accept="...">`. */
export const ACCEPT_ATTR = Array.from(ALLOWED_MIME_TYPES).join(',')

export function isImageMime(mime: string): boolean {
  return mime.startsWith('image/')
}

export function formatFileSize(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 0) return '–'
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export function getFileIcon(mime: string): LucideIcon {
  if (isImageMime(mime)) return ImageIcon
  if (mime === 'application/pdf') return FileText
  if (mime.includes('spreadsheet') || mime === 'application/vnd.ms-excel') {
    return FileSpreadsheet
  }
  if (mime.includes('presentation') || mime === 'application/vnd.ms-powerpoint') {
    return Presentation
  }
  if (mime === 'application/zip') return FileArchive
  if (mime.startsWith('text/') || mime.includes('word')) return FileText
  return FileIcon
}

/**
 * Sanityzacja nazwy pliku — zachowuje literki/cyfry/`._-`, resztę zastępuje `_`.
 * Max 100 znaków (ostatnich N po cięciu); rozszerzenie zachowane jeśli było.
 */
export function sanitizeFileName(name: string): string {
  const safe = name.replace(/[^\w.-]+/g, '_').replace(/^_+|_+$/g, '')
  if (safe.length === 0) return 'file'
  if (safe.length <= 100) return safe
  // Zostaw końcówkę z rozszerzeniem
  const dot = safe.lastIndexOf('.')
  if (dot > 0 && safe.length - dot <= 12) {
    const ext = safe.slice(dot)
    return safe.slice(0, 100 - ext.length) + ext
  }
  return safe.slice(0, 100)
}

function genUuid(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID()
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
}

/** `<cohort_id>/<user_id>/<uuid>-<safeName>` — RLS gatuje po segmentach. */
export function buildAttachmentPath(
  cohortId: string,
  userId: string,
  file: File,
): string {
  const safe = sanitizeFileName(file.name)
  return `${cohortId}/${userId}/${genUuid()}-${safe}`
}

export type FileValidation = { ok: true } | { ok: false; reason: string }

export function validateFile(file: File): FileValidation {
  if (file.size > MAX_FILE_SIZE) {
    return {
      ok: false,
      reason: `Plik za duży (${formatFileSize(file.size)}). Maks. 25 MB.`,
    }
  }
  if (!ALLOWED_MIME_TYPES.has(file.type)) {
    return {
      ok: false,
      reason: `Typ pliku nieobsługiwany (${file.type || 'nieznany'}).`,
    }
  }
  return { ok: true }
}

/**
 * Wyciąga wymiary obrazka w przeglądarce. Zwraca `null` gdy się nie udaje
 * (uszkodzony plik, nie-obrazek). Czyści objectURL po wczytaniu.
 */
export function getImageDimensions(
  file: File,
): Promise<{ width: number; height: number } | null> {
  if (!isImageMime(file.type)) return Promise.resolve(null)
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file)
    const img = new window.Image()
    img.onload = () => {
      const dims = { width: img.naturalWidth, height: img.naturalHeight }
      URL.revokeObjectURL(url)
      resolve(dims)
    }
    img.onerror = () => {
      URL.revokeObjectURL(url)
      resolve(null)
    }
    img.src = url
  })
}

export type UploadResult = {
  path: string
  width: number | null
  height: number | null
}

/**
 * Upload pliku do `aula-files`. Waliduje rozmiar+MIME przed wysłaniem,
 * dolicza wymiary jeśli obrazek. Zwraca finalny path (do INSERTu attachmentu)
 * + wymiary (do CLS-safe renderu).
 *
 * Brak progress callbacku w MVP — Supabase JS XHR onUploadProgress jest
 * niestabilne między wersjami; w UI dajemy spinner per chip.
 */
export async function uploadAulaFile(
  file: File,
  cohortId: string,
  userId: string,
): Promise<UploadResult> {
  const v = validateFile(file)
  if (!v.ok) throw new Error(v.reason)

  const path = buildAttachmentPath(cohortId, userId, file)
  const dims = await getImageDimensions(file)

  const { error } = await supabase.storage
    .from(AULA_BUCKET)
    .upload(path, file, {
      contentType: file.type,
      upsert: false,
    })

  if (error) throw new Error(error.message || 'Upload failed')

  return {
    path,
    width: dims?.width ?? null,
    height: dims?.height ?? null,
  }
}
