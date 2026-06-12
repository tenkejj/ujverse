/**
 * UJverse — MessageAttachments: renderuje załączniki wiadomości Auli pod
 * jej treścią. Obrazki idą w grid z aspect-ratio z `width/height` (CLS-safe),
 * pozostałe pliki — karty z ikoną, nazwą, rozmiarem i przyciskiem pobierania.
 *
 * Copyright © 2026 Franciszek Dranka. All rights reserved.
 * License: Proprietary — see LICENSE in repo root.
 */
import { Download, Trash2 } from 'lucide-react'
import { formatFileSize, getFileIcon, isAudioMime, isImageMime } from '../../lib/aulaUpload'
import type { CohortMessageAttachment } from '../../types/database'
import VoiceMessagePlayer from './VoiceMessagePlayer'

type Props = {
  attachments: CohortMessageAttachment[]
  getSignedUrl: (path: string) => string | null
  /** Czy aktualny user jest autorem wiadomości — pokazuje delete buttony. */
  isOwner?: boolean
  onDelete?: (attachment: CohortMessageAttachment) => void
}

function imageGridColumnsClass(count: number): string {
  if (count <= 1) return 'grid-cols-1'
  if (count === 2) return 'grid-cols-2'
  if (count <= 4) return 'grid-cols-2'
  return 'grid-cols-3'
}

function ImageTile({
  attachment,
  url,
  isOwner,
  onDelete,
}: {
  attachment: CohortMessageAttachment
  url: string | null
  isOwner?: boolean
  onDelete?: (a: CohortMessageAttachment) => void
}) {
  const w = attachment.width ?? 4
  const h = attachment.height ?? 3
  return (
    <div className="group relative overflow-hidden rounded-lg border border-zinc-200 bg-zinc-100 dark:border-white/10 dark:bg-white/[0.04]">
      <div
        style={{ aspectRatio: `${w} / ${h}` }}
        className="relative w-full max-h-[420px]"
      >
        {url ? (
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="block h-full w-full"
            title={attachment.file_name}
          >
            <img
              src={url}
              alt={attachment.file_name}
              loading="lazy"
              className="h-full w-full object-cover transition-opacity duration-200"
            />
          </a>
        ) : (
          <div className="h-full w-full animate-pulse bg-zinc-200/80 dark:bg-white/[0.06]" />
        )}
        {isOwner && onDelete && (
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault()
              onDelete(attachment)
            }}
            aria-label="Usuń załącznik"
            className="absolute right-1.5 top-1.5 rounded-md bg-black/60 p-1 text-white opacity-0 transition-opacity hover:bg-black/80 group-hover:opacity-100"
          >
            <Trash2 size={13} />
          </button>
        )}
      </div>
    </div>
  )
}

function FileCard({
  attachment,
  url,
  isOwner,
  onDelete,
}: {
  attachment: CohortMessageAttachment
  url: string | null
  isOwner?: boolean
  onDelete?: (a: CohortMessageAttachment) => void
}) {
  const Icon = getFileIcon(attachment.mime_type)
  return (
    <div className="group flex items-center gap-3 rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 dark:border-white/10 dark:bg-white/[0.04]">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-black/[0.04] text-zinc-600 dark:bg-white/[0.06] dark:text-zinc-300">
        <Icon size={18} />
      </div>
      <div className="min-w-0 flex-1">
        <p
          className="truncate text-sm font-medium text-fg-primary"
          title={attachment.file_name}
        >
          {attachment.file_name}
        </p>
        <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
          {formatFileSize(attachment.size_bytes)}
        </p>
      </div>
      {url ? (
        <a
          href={url}
          download={attachment.file_name}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={`Pobierz ${attachment.file_name}`}
          className="shrink-0 rounded-md p-1.5 text-zinc-500 hover:bg-black/5 hover:text-[#1e293b] dark:text-zinc-400 dark:hover:bg-white/10 dark:hover:text-brand-gold-bright"
        >
          <Download size={15} />
        </a>
      ) : (
        <span className="h-5 w-5 shrink-0 animate-pulse rounded bg-zinc-200 dark:bg-white/10" />
      )}
      {isOwner && onDelete && (
        <button
          type="button"
          onClick={() => onDelete(attachment)}
          aria-label="Usuń załącznik"
          className="shrink-0 rounded-md p-1.5 text-zinc-400 opacity-0 transition-opacity hover:bg-black/5 hover:text-rose-600 group-hover:opacity-100 dark:hover:bg-white/10"
        >
          <Trash2 size={14} />
        </button>
      )}
    </div>
  )
}

export default function MessageAttachments({
  attachments,
  getSignedUrl,
  isOwner,
  onDelete,
}: Props) {
  if (attachments.length === 0) return null

  // 3 grupy: obrazki (grid), głosówki (pełnowymiarowy player), reszta (file card).
  // Audio renderujemy ZAWSZE jako player, nawet gdyby case był taki że ktoś
  // wrzuci mp3 z pickerze (obecnie zabronione, ale ochrona forward-compat).
  const images = attachments.filter((a) => isImageMime(a.mime_type))
  const audios = attachments.filter((a) => isAudioMime(a.mime_type))
  const files = attachments.filter(
    (a) => !isImageMime(a.mime_type) && !isAudioMime(a.mime_type),
  )

  return (
    <div className="mt-2 space-y-2">
      {images.length > 0 && (
        <div className={`grid gap-1.5 ${imageGridColumnsClass(images.length)}`}>
          {images.map((a) => (
            <ImageTile
              key={a.id}
              attachment={a}
              url={getSignedUrl(a.storage_path)}
              isOwner={isOwner}
              onDelete={onDelete}
            />
          ))}
        </div>
      )}
      {audios.length > 0 && (
        <div className="space-y-1.5">
          {audios.map((a) => (
            <VoiceMessagePlayer
              key={a.id}
              attachment={a}
              url={getSignedUrl(a.storage_path)}
              isOwner={isOwner}
              onDelete={onDelete}
            />
          ))}
        </div>
      )}
      {files.length > 0 && (
        <div className="space-y-1.5">
          {files.map((a) => (
            <FileCard
              key={a.id}
              attachment={a}
              url={getSignedUrl(a.storage_path)}
              isOwner={isOwner}
              onDelete={onDelete}
            />
          ))}
        </div>
      )}
    </div>
  )
}
