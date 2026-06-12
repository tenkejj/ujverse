/**
 * UJverse — panel importu planu zajęć (.ics z USOSweb).
 *
 * Tryby:
 *   - „Wklej link" — URL z dialogu USOSweb „Eksport do iCalendar".
 *     Najmniej tarcia: user wkleja gotowy link, my pobieramy ICS przez
 *     proxy `/api/fetch-usos-ics` (apps.usos.uj.edu.pl nie wystawia CORS).
 *   - drag-drop pliku `.ics`
 *   - paste surowego tekstu (dla userów którzy mają plik na drugim urządzeniu)
 *
 * Po imporcie pokazuje skrót: ile entries dodano, ile pominięto, podgląd
 * pierwszych 3 zajęć żeby user widział że parsing zadziałał.
 */
import { useRef, useState } from 'react'
import { ClipboardPaste, FileUp, Link2, Loader2, Trash2 } from 'lucide-react'
import BaseCard from './ui/BaseCard'
import { DataService } from '../services/DataService'
import { theme } from '../styles/theme'
import { toast } from '../lib/appToast'
import {
  isLikelyUsosIcsUrl,
  type ImportIcsResult,
} from '../services/adapters/TimetableAdapter'

type Props = {
  userId: string
  /** Liczba istniejących entries — do pokazania „Masz N zajęć w planie". */
  existingCount: number
  /** Callback po udanym imporcie (do refetcha widgetu i licznika). */
  onImported: () => void
  /** Callback po wyczyszczeniu planu. */
  onCleared: () => void
}

function summarizeResult(r: ImportIcsResult): string {
  const parts: string[] = []
  if (r.insertedCount > 0) parts.push(`Zaimportowano ${r.insertedCount} zajęć`)
  if (r.skippedCount > 0) parts.push(`pominięto ${r.skippedCount}`)
  if (r.parserErrors.length > 0) parts.push(`${r.parserErrors.length} ostrzeżeń parsera`)
  return parts.join(' · ')
}

export default function ImportTimetablePanel({
  userId,
  existingCount,
  onImported,
  onCleared,
}: Props) {
  const [mode, setMode] = useState<'idle' | 'paste' | 'url'>('idle')
  const [rawText, setRawText] = useState('')
  const [urlValue, setUrlValue] = useState('')
  const [isImporting, setIsImporting] = useState(false)
  const [lastResult, setLastResult] = useState<ImportIcsResult | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [isClearing, setIsClearing] = useState(false)
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  const handleResult = (result: ImportIcsResult): boolean => {
    setLastResult(result)
    if (result.fetchError) {
      toast.error(result.fetchError)
      return false
    }
    if (result.dbError) {
      const msg = result.dbError.message?.toLowerCase() ?? ''
      if (msg.includes('user_timetable_entries') && msg.includes('does not exist')) {
        toast.error('Brak tabeli planu w bazie. Wklej migrację 20260616120000_user_timetable.sql.')
      } else {
        toast.error('Import nieudany: ' + (result.dbError.message ?? 'nieznany błąd'))
      }
      return false
    }
    if (result.insertedCount === 0 && result.parsedCount === 0) {
      toast.error('Plik nie zawierał żadnych poprawnych zajęć (VEVENT z DTSTART/DTEND).')
      return false
    }
    toast.success(summarizeResult(result))
    return true
  }

  const doImport = async (raw: string) => {
    if (!raw.trim()) {
      toast.error('Plik wygląda na pusty.')
      return
    }
    setIsImporting(true)
    const result = await DataService.importTimetableIcs(userId, raw)
    setIsImporting(false)
    if (handleResult(result)) {
      setRawText('')
      setMode('idle')
      onImported()
    }
  }

  const doImportFromUrl = async (url: string) => {
    const trimmed = url.trim()
    if (!trimmed) {
      toast.error('Wklej URL z USOSweb.')
      return
    }
    if (!isLikelyUsosIcsUrl(trimmed)) {
      toast.error('URL musi pochodzić z apps.usos.uj.edu.pl i zawierać parametr "key".')
      return
    }
    setIsImporting(true)
    const result = await DataService.importTimetableFromUrl(userId, trimmed)
    setIsImporting(false)
    if (handleResult(result)) {
      setUrlValue('')
      setMode('idle')
      onImported()
    }
  }

  const handleFile = async (file: File) => {
    if (!file.name.toLowerCase().endsWith('.ics') && file.type !== 'text/calendar') {
      toast.error('Wybierz plik .ics z USOSweb (eksport iCalendar).')
      return
    }
    const text = await file.text()
    await doImport(text)
  }

  const handleDrop = async (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    setIsDragging(false)
    const file = e.dataTransfer.files?.[0]
    if (file) await handleFile(file)
  }

  const handleClear = async () => {
    if (existingCount === 0) return
    if (!window.confirm(`Usunąć ${existingCount} zajęć z Twojego planu?`)) return
    setIsClearing(true)
    const { error } = await DataService.clearTimetable(userId)
    setIsClearing(false)
    if (error) {
      toast.error('Nie udało się wyczyścić planu: ' + (error.message ?? 'nieznany błąd'))
      return
    }
    toast.success('Plan wyczyszczony.')
    setLastResult(null)
    onCleared()
  }

  return (
    <BaseCard variant="default" className="p-4 sm:p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className={`text-[15px] font-bold ${theme.text.primary}`}>Plan z USOSweb</p>
          <p className={`mt-0.5 text-[13px] leading-relaxed ${theme.text.muted}`}>
            Wejdź w <strong>USOSweb → Mój USOSweb → Mój plan zajęć</strong>, kliknij <em>„Eksport do iCalendar"</em>. Możesz albo wkleić podany tam <strong>link</strong>, albo pobrać plik <code className="rounded bg-zinc-100 px-1 text-[12px] dark:bg-white/[0.06]">.ics</code> i wrzucić go niżej.
          </p>
        </div>
        {existingCount > 0 && (
          <button
            type="button"
            onClick={handleClear}
            disabled={isClearing}
            className="shrink-0 inline-flex items-center gap-1.5 rounded-full border border-red-300 bg-red-50/70 px-3 py-1 text-[11px] font-semibold text-red-700 transition-colors hover:bg-red-100 disabled:opacity-50 dark:border-red-500/40 dark:bg-red-500/[0.08] dark:text-red-300 dark:hover:bg-red-500/[0.14]"
          >
            {isClearing ? <Loader2 size={12} className="animate-spin" /> : <Trash2 size={12} />}
            Wyczyść
          </button>
        )}
      </div>

      {existingCount > 0 && !lastResult && (
        <p className={`mt-2 text-[12px] ${theme.text.muted}`}>
          Masz {existingCount} {existingCount === 1 ? 'zajęcia' : existingCount < 5 ? 'zajęcia' : 'zajęć'} w bazie. Re-import nadpisuje istniejące wpisy (po UID).
        </p>
      )}

      <div
        onDragEnter={() => setIsDragging(true)}
        onDragOver={(e) => {
          e.preventDefault()
          setIsDragging(true)
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
        className={`mt-4 flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed px-4 py-8 text-center transition-colors ${
          isDragging
            ? 'border-brand-gold/60 bg-brand-gold/[0.08] dark:border-brand-gold-bright/60 dark:bg-brand-gold-bright/[0.08]'
            : 'border-zinc-200 bg-zinc-50/50 dark:border-white/10 dark:bg-white/[0.02]'
        }`}
      >
        <FileUp size={26} className="text-brand-gold dark:text-brand-gold-bright" strokeWidth={1.75} />
        <p className={`text-[13px] font-semibold ${theme.text.primary}`}>
          Upuść plik <code className="font-mono text-[12px]">.ics</code> tutaj
        </p>
        <p className={`text-[11.5px] ${theme.text.muted}`}>albo</p>
        <div className="flex flex-wrap items-center justify-center gap-2">
          <button
            type="button"
            onClick={() => setMode((m) => (m === 'url' ? 'idle' : 'url'))}
            disabled={isImporting}
            className="inline-flex items-center gap-1.5 rounded-full border border-brand-gold/40 bg-brand-gold/10 px-4 py-1.5 text-[12px] font-semibold text-brand-gold transition-colors hover:bg-brand-gold/15 disabled:opacity-50 dark:border-brand-gold-bright/40 dark:bg-brand-gold-bright/10 dark:text-brand-gold-bright dark:hover:bg-brand-gold-bright/15"
          >
            <Link2 size={12} /> Wklej link z USOSweb
          </button>
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={isImporting}
            className="inline-flex items-center gap-1.5 rounded-full border border-zinc-200 bg-white px-4 py-1.5 text-[12px] font-semibold text-zinc-800 transition-colors hover:bg-zinc-50 disabled:opacity-50 dark:border-white/10 dark:bg-white/[0.05] dark:text-zinc-200 dark:hover:bg-white/[0.09]"
          >
            <FileUp size={12} /> Wybierz plik
          </button>
          <button
            type="button"
            onClick={() => setMode((m) => (m === 'paste' ? 'idle' : 'paste'))}
            disabled={isImporting}
            className="inline-flex items-center gap-1.5 rounded-full border border-zinc-200 bg-white px-4 py-1.5 text-[12px] font-semibold text-zinc-800 transition-colors hover:bg-zinc-50 disabled:opacity-50 dark:border-white/10 dark:bg-white/[0.05] dark:text-zinc-200 dark:hover:bg-white/[0.09]"
          >
            <ClipboardPaste size={12} /> Wklej tekst
          </button>
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept=".ics,text/calendar"
          onChange={(e) => {
            const file = e.target.files?.[0]
            if (file) void handleFile(file)
            e.target.value = ''
          }}
          className="hidden"
        />
      </div>

      {mode === 'url' && (
        <div className="mt-3 space-y-2">
          <p className={`text-[11.5px] ${theme.text.muted}`}>
            Wklej cały URL z dialogu „Eksport planu zajęć" (zaczyna się od <code className="rounded bg-zinc-100 px-1 dark:bg-white/[0.06]">https://apps.usos.uj.edu.pl/services/tt/…</code>). Klucz służy tylko do pobrania planu — nie zapisujemy go.
          </p>
          <input
            type="url"
            value={urlValue}
            onChange={(e) => setUrlValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !isImporting && urlValue.trim()) {
                e.preventDefault()
                void doImportFromUrl(urlValue)
              }
            }}
            placeholder="https://apps.usos.uj.edu.pl/services/tt/upcoming_ical?lang=pl&user_id=…&key=…"
            spellCheck={false}
            autoComplete="off"
            className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 font-mono text-[12px] text-zinc-900 placeholder-zinc-400 outline-none focus:border-brand-gold/45 focus:ring-2 focus:ring-brand-gold/15 dark:border-white/10 dark:bg-white/[0.04] dark:text-zinc-100 dark:placeholder-zinc-500 dark:focus:border-brand-gold-bright/40 dark:focus:ring-brand-gold-bright/15"
          />
          <div className="flex justify-end">
            <button
              type="button"
              onClick={() => void doImportFromUrl(urlValue)}
              disabled={isImporting || !urlValue.trim()}
              className="inline-flex items-center gap-1.5 rounded-full bg-[#1e293b] px-4 py-1.5 text-[12px] font-semibold text-white transition-colors hover:bg-[#1e293b]/90 disabled:opacity-50 dark:bg-brand-gold dark:text-black dark:hover:bg-brand-gold/85"
            >
              {isImporting && <Loader2 size={12} className="animate-spin" />}
              Pobierz i zaimportuj
            </button>
          </div>
        </div>
      )}

      {mode === 'paste' && (
        <div className="mt-3 space-y-2">
          <textarea
            value={rawText}
            onChange={(e) => setRawText(e.target.value)}
            placeholder="Wklej tu zawartość pliku .ics (BEGIN:VCALENDAR…)"
            rows={6}
            className="w-full rounded-xl border border-zinc-200 bg-white p-2.5 font-mono text-[11.5px] text-zinc-900 placeholder-zinc-400 outline-none focus:border-brand-gold/45 focus:ring-2 focus:ring-brand-gold/15 dark:border-white/10 dark:bg-white/[0.04] dark:text-zinc-100 dark:placeholder-zinc-500 dark:focus:border-brand-gold-bright/40 dark:focus:ring-brand-gold-bright/15"
          />
          <div className="flex justify-end">
            <button
              type="button"
              onClick={() => void doImport(rawText)}
              disabled={isImporting || !rawText.trim()}
              className="inline-flex items-center gap-1.5 rounded-full bg-[#1e293b] px-4 py-1.5 text-[12px] font-semibold text-white transition-colors hover:bg-[#1e293b]/90 disabled:opacity-50 dark:bg-brand-gold dark:text-black dark:hover:bg-brand-gold/85"
            >
              {isImporting && <Loader2 size={12} className="animate-spin" />}
              Importuj
            </button>
          </div>
        </div>
      )}

      {lastResult && (
        <div className="mt-4 rounded-xl border border-zinc-200 bg-zinc-50/60 p-3 dark:border-white/10 dark:bg-white/[0.03]">
          <p className={`text-[12px] font-semibold ${theme.text.primary}`}>
            {summarizeResult(lastResult) || 'Plan zaimportowany.'}
          </p>
          {lastResult.parserErrors.length > 0 && (
            <ul className={`mt-1.5 list-disc space-y-0.5 pl-4 text-[11px] ${theme.text.muted}`}>
              {lastResult.parserErrors.slice(0, 3).map((err, i) => (
                <li key={i}>{err}</li>
              ))}
              {lastResult.parserErrors.length > 3 && (
                <li>i {lastResult.parserErrors.length - 3} więcej…</li>
              )}
            </ul>
          )}
        </div>
      )}
    </BaseCard>
  )
}
