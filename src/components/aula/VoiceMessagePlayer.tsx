/**
 * UJverse — VoiceMessagePlayer: odtwarzacz głosówki w wiadomościach Auli.
 *
 * Copyright © 2026 Franciszek Dranka. All rights reserved.
 * License: Proprietary — see LICENSE in repo root.
 *
 * Renderowany przez `MessageAttachments` zamiast `FileCard` gdy
 * `mime_type` zaczyna się od `audio/`. Layout:
 *
 *   [▶/❚❚]  ────────●──────  0:12 / 0:34  [⤓?]  [🗑?]
 *
 * UI używa natywnego `<audio>` w trybie metadata-only (preload = "metadata")
 * żeby uzyskać duration jeśli `attachment.duration_seconds` jest null
 * (legacy). Pasek progresu = pojedynczy bar z procentowym wypełnieniem
 * (bez fancy waveform — keepie minimalizm; waveform widać tylko podczas
 * nagrywania).
 *
 * Speed control + waveform-from-decode są na roadmapie (post-MVP).
 */
import { useEffect, useRef, useState } from 'react'
import { Download, Pause, Play, Trash2 } from 'lucide-react'
import { formatDuration } from '../../lib/aulaUpload'
import type { CohortMessageAttachment } from '../../types/database'

type Props = {
  attachment: CohortMessageAttachment
  url: string | null
  isOwner?: boolean
  onDelete?: (a: CohortMessageAttachment) => void
}

export default function VoiceMessagePlayer({
  attachment,
  url,
  isOwner,
  onDelete,
}: Props) {
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  // Duration source: stored value (DB) ma priorytet; fallback do audio.duration.
  // Bez tego nowo-uploadowane głosówki na inny klient mają natychmiast
  // poprawny czas (bo trigger nie liczy duration server-side).
  const [duration, setDuration] = useState(attachment.duration_seconds ?? 0)
  const [errored, setErrored] = useState(false)

  // Reset gdy attachment się zmieni (rzadko, ale defensywnie).
  useEffect(() => {
    setIsPlaying(false)
    setCurrentTime(0)
    setDuration(attachment.duration_seconds ?? 0)
    setErrored(false)
  }, [attachment.id, attachment.duration_seconds])

  const togglePlay = () => {
    const audio = audioRef.current
    if (!audio || !url) return
    if (audio.paused) {
      audio.play().catch(() => setErrored(true))
    } else {
      audio.pause()
    }
  }

  const handleScrub = (e: React.MouseEvent<HTMLDivElement>) => {
    const audio = audioRef.current
    if (!audio || !url || duration <= 0) return
    const rect = e.currentTarget.getBoundingClientRect()
    const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width))
    audio.currentTime = ratio * duration
    setCurrentTime(audio.currentTime)
  }

  const progress = duration > 0 ? Math.min(1, currentTime / duration) : 0

  return (
    <div className="group flex items-center gap-3 rounded-2xl border border-zinc-200 bg-zinc-50 px-3 py-2 dark:border-white/10 dark:bg-white/[0.04]">
      <button
        type="button"
        onClick={togglePlay}
        disabled={!url || errored}
        aria-label={isPlaying ? 'Pauza' : 'Odtwórz głosówkę'}
        className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#1e293b] text-white shadow-sm transition-colors hover:bg-[#1e293b]/90 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-brand-gold-bright dark:text-bg-card dark:hover:bg-brand-gold-bright/85"
      >
        {isPlaying ? <Pause size={16} strokeWidth={2.5} /> : <Play size={16} strokeWidth={2.5} className="ml-[2px]" />}
      </button>

      <div className="min-w-0 flex-1">
        <div
          onClick={handleScrub}
          role="slider"
          aria-label="Pozycja odtwarzania"
          aria-valuemin={0}
          aria-valuemax={duration > 0 ? Math.round(duration) : 100}
          aria-valuenow={Math.round(currentTime)}
          tabIndex={0}
          className="h-1.5 w-full cursor-pointer overflow-hidden rounded-full bg-zinc-300/70 dark:bg-white/15"
        >
          <div
            className="h-full rounded-full bg-[#1e293b] transition-[width] duration-100 dark:bg-brand-gold-bright"
            style={{ width: `${progress * 100}%` }}
          />
        </div>
        <div className="mt-1 flex items-center justify-between gap-2 text-[11px] tabular-nums text-zinc-500 dark:text-zinc-400">
          <span>{formatDuration(currentTime)}</span>
          <span>{formatDuration(duration)}</span>
        </div>
      </div>

      {url && (
        <a
          href={url}
          download={attachment.file_name}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={`Pobierz ${attachment.file_name}`}
          title="Pobierz"
          className="shrink-0 rounded-md p-1.5 text-zinc-400 opacity-0 transition-opacity hover:bg-black/[0.05] hover:text-[#1e293b] group-hover:opacity-100 dark:hover:bg-white/[0.06] dark:hover:text-brand-gold-bright"
        >
          <Download size={14} />
        </a>
      )}

      {isOwner && onDelete && (
        <button
          type="button"
          onClick={() => onDelete(attachment)}
          aria-label="Usuń głosówkę"
          className="shrink-0 rounded-md p-1.5 text-zinc-400 opacity-0 transition-opacity hover:bg-black/[0.05] hover:text-rose-600 group-hover:opacity-100 dark:hover:bg-white/[0.06]"
        >
          <Trash2 size={14} />
        </button>
      )}

      {/* Audio element off-screen — kontrolujemy przyciskiem + paskiem. */}
      {url && (
        <audio
          ref={audioRef}
          src={url}
          preload="metadata"
          onPlay={() => setIsPlaying(true)}
          onPause={() => setIsPlaying(false)}
          onEnded={() => {
            setIsPlaying(false)
            setCurrentTime(duration)
          }}
          onLoadedMetadata={(e) => {
            const d = e.currentTarget.duration
            if (Number.isFinite(d) && d > 0 && (!attachment.duration_seconds || d > 0.5)) {
              setDuration(d)
            }
          }}
          onTimeUpdate={(e) => setCurrentTime(e.currentTarget.currentTime)}
          onError={() => setErrored(true)}
        />
      )}
    </div>
  )
}
