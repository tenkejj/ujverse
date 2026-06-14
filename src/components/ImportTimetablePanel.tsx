/**
 * UJverse — panel importu planu zajęć z USOSweb.
 *
 * UI: tabbed wybór metody importu. Default = „Link" (preferowana ścieżka,
 * najmniej tarcia — user wkleja URL z USOSweb-owego dialogu eksportu
 * planu i my pobieramy treść przez proxy `/api/fetch-usos-ics`).
 *
 * Trzy taby:
 *   - **Link** — URL z USOSweb → proxy fetch → import
 *   - **Plik** — drag-drop / file picker (USOS-owy export pliku)
 *   - **Tekst** — surowy paste (np. user ma plik na drugim urządzeniu)
 *
 * Po imporcie panel jest collapse'd by default (sam przycisk „Aktualizuj
 * plan" + opcjonalnie „Wyczyść") — UI w „Moim Planie" jest skupione na
 * danych, kontrolki schodzą na drugi plan.
 *
 * Po imporcie pokazuje skrót: ile entries dodano, ile pominięto, ostrzeżenia.
 */
import { useEffect, useRef, useState } from 'react'
import {
  ChevronDown,
  ClipboardPaste,
  FileUp,
  Link2,
  Loader2,
  RefreshCw,
  Trash2,
} from 'lucide-react'
import BaseCard from './ui/BaseCard'
import { DataService } from '../services/DataService'
import { theme } from '../styles/theme'
import { toast } from '../lib/appToast'
import {
  isLikelyUsosIcsUrl,
  type ImportIcsResult,
} from '../services/adapters/TimetableAdapter'

type Tab = 'url' | 'file' | 'text'

type TabDescriptor = {
  id: Tab
  label: string
  icon: typeof Link2
}

const TABS: TabDescriptor[] = [
  { id: 'url', label: 'Link', icon: Link2 },
  { id: 'file', label: 'Plik', icon: FileUp },
  { id: 'text', label: 'Wklej tekst', icon: ClipboardPaste },
]

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
  const [tab, setTab] = useState<Tab>('url')
  const [rawText, setRawText] = useState('')
  const [urlValue, setUrlValue] = useState('')
  const [isImporting, setIsImporting] = useState(false)
  const [lastResult, setLastResult] = useState<ImportIcsResult | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [isClearing, setIsClearing] = useState(false)
  /**
   * Collapse / expand panelu importu. Po pierwszym imporcie panel zwija
   * się automatycznie — user widzi mały przycisk „Aktualizuj", a tabbed
   * import wraca tylko gdy świadomie go rozwinie. Świeży user
   * (existingCount === 0) widzi rozwinięty panel od razu, żeby nie musiał
   * szukać CTA.
   */
  const [isExpanded, setIsExpanded] = useState<boolean>(existingCount === 0)
  /**
   * Pierwsze przejście `existingCount` 0 → N (po async loadzie counta
   * w parencie ALBO świeżym imporcie). Wtedy zwijamy panel, ale potem
   * NIE walczymy z manualnym toggle usera.
   */
  const hasAutoCollapsedRef = useRef(false)
  useEffect(() => {
    if (existingCount > 0 && !hasAutoCollapsedRef.current) {
      hasAutoCollapsedRef.current = true
      setIsExpanded(false)
    }
    if (existingCount === 0) {
      hasAutoCollapsedRef.current = false
    }
  }, [existingCount])
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
      toast.error('Plik nie zawiera poprawnych zajęć — sprawdź czy to eksport planu z USOSweb.')
      return false
    }
    toast.success(summarizeResult(result))
    setIsExpanded(false)
    return true
  }

  const doImportText = async (raw: string) => {
    if (!raw.trim()) {
      toast.error('Wklej tekst eksportu planu.')
      return
    }
    setIsImporting(true)
    const result = await DataService.importTimetableIcs(userId, raw)
    setIsImporting(false)
    if (handleResult(result)) {
      setRawText('')
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
      onImported()
    }
  }

  const handleFile = async (file: File) => {
    if (!file.name.toLowerCase().endsWith('.ics') && file.type !== 'text/calendar') {
      toast.error('Wybierz plik z eksportu planu USOSweb.')
      return
    }
    const text = await file.text()
    await doImportText(text)
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

  // Collapsed (post-import): chudy nagłówek + dwa małe przyciski („Aktualizuj plan",
  // „Wyczyść"). Bez tabbed UI, bez instrukcji dla USOSweb. To zmniejsza
  // crowding w aside, bo user po imporcie najczęściej tylko sprawdza plan,
  // a re-import dotyka raz na semestr.
  if (existingCount > 0 && !isExpanded) {
    return (
      <BaseCard variant="default" className="p-3 sm:p-4">
        <div className="flex items-center justify-between gap-2">
          <p className={`text-[13px] font-semibold ${theme.text.primary}`}>Plan z USOSweb</p>
          <div className="flex shrink-0 items-center gap-1.5">
            <button
              type="button"
              onClick={() => setIsExpanded(true)}
              className="inline-flex items-center gap-1.5 rounded-full border border-zinc-200 bg-white/80 px-2.5 py-1 text-[11px] font-semibold text-zinc-700 transition-colors hover:bg-zinc-100 dark:border-white/10 dark:bg-white/[0.04] dark:text-zinc-200 dark:hover:bg-white/[0.08]"
            >
              <RefreshCw size={11} />
              Aktualizuj
            </button>
            <button
              type="button"
              onClick={handleClear}
              disabled={isClearing}
              aria-label="Wyczyść plan"
              className="inline-flex h-6 w-6 items-center justify-center rounded-full border border-red-300 bg-red-50/70 text-red-700 transition-colors hover:bg-red-100 disabled:opacity-50 dark:border-red-500/40 dark:bg-red-500/10 dark:text-red-300 dark:hover:bg-red-500/20"
            >
              {isClearing ? <Loader2 size={11} className="animate-spin" /> : <Trash2 size={11} />}
            </button>
          </div>
        </div>
      </BaseCard>
    )
  }

  return (
    <BaseCard variant="default" className="p-3 sm:p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className={`text-[13px] font-semibold ${theme.text.primary}`}>
            Wklej link z USOSweb
          </p>
          <p className={`mt-0.5 text-[11.5px] ${theme.text.muted}`}>
            Mój USOSweb → Mój plan zajęć → eksport planu.
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          {existingCount > 0 && (
            <button
              type="button"
              onClick={() => setIsExpanded(false)}
              aria-label="Zwiń panel importu"
              className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-zinc-200 bg-white/80 text-zinc-600 transition-colors hover:bg-zinc-100 dark:border-white/10 dark:bg-white/[0.04] dark:text-zinc-300 dark:hover:bg-white/[0.08]"
            >
              <ChevronDown size={12} />
            </button>
          )}
          {existingCount > 0 && (
            <button
              type="button"
              onClick={handleClear}
              disabled={isClearing}
              className="shrink-0 inline-flex items-center gap-1.5 rounded-full border border-red-300 bg-red-50/70 px-3 py-1 text-[11px] font-semibold text-red-700 transition-colors hover:bg-red-100 disabled:opacity-50 dark:border-red-500/40 dark:bg-red-500/10 dark:text-red-300 dark:hover:bg-red-500/20"
            >
              {isClearing ? <Loader2 size={12} className="animate-spin" /> : <Trash2 size={12} />}
              Wyczyść
            </button>
          )}
        </div>
      </div>

      <div
        role="tablist"
        aria-label="Metoda importu"
        className="mt-4 inline-flex w-full rounded-xl border border-zinc-200 bg-zinc-100/70 p-1 dark:border-white/10 dark:bg-white/[0.04]"
      >
        {TABS.map((t) => {
          const active = tab === t.id
          const Icon = t.icon
          return (
            <button
              key={t.id}
              role="tab"
              aria-selected={active}
              type="button"
              onClick={() => setTab(t.id)}
              disabled={isImporting}
              className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg px-3 py-1.5 text-[12px] font-semibold transition-colors disabled:opacity-50 ${
                active
                  ? 'bg-white text-zinc-900 shadow-sm dark:bg-brand-gold dark:text-black'
                  : 'text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100'
              }`}
            >
              <Icon size={13} strokeWidth={2.25} />
              {t.label}
            </button>
          )
        })}
      </div>

      <div className="mt-3">
        {tab === 'url' && (
          <div className="space-y-2">
            <label
              className={`flex items-center gap-1.5 text-[11.5px] ${theme.text.muted}`}
              htmlFor="usos-ics-url"
            >
              <Link2 size={12} className="text-brand-gold dark:text-brand-gold-bright" />
              Link z USOSweb-owego dialogu eksportu planu (przyklejony do
              schowka po kliknięciu ikony kopiowania)
            </label>
            <input
              id="usos-ics-url"
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
            <div className="flex items-center justify-between gap-2">
              <p className={`text-[11px] ${theme.text.muted}`}>
                Klucz jest jednorazowo używany do pobrania planu. Nie zapisujemy go.
              </p>
              <button
                type="button"
                onClick={() => void doImportFromUrl(urlValue)}
                disabled={isImporting || !urlValue.trim()}
                className="shrink-0 inline-flex items-center gap-1.5 rounded-full bg-[#1e293b] px-4 py-1.5 text-[12px] font-semibold text-white transition-colors hover:bg-[#1e293b]/90 disabled:opacity-50 dark:bg-brand-gold dark:text-black dark:hover:bg-brand-gold/85"
              >
                {isImporting && <Loader2 size={12} className="animate-spin" />}
                Pobierz i zaimportuj
              </button>
            </div>
          </div>
        )}

        {tab === 'file' && (
          <div
            onDragEnter={() => setIsDragging(true)}
            onDragOver={(e) => {
              e.preventDefault()
              setIsDragging(true)
            }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={handleDrop}
            className={`flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed px-4 py-8 text-center transition-colors ${
              isDragging
                ? 'border-brand-gold/60 bg-brand-gold/10 dark:border-brand-gold-bright/60 dark:bg-brand-gold-bright/10'
                : 'border-zinc-200 bg-zinc-50/50 dark:border-white/10 dark:bg-white/[0.02]'
            }`}
          >
            <FileUp size={26} className="text-brand-gold dark:text-brand-gold-bright" strokeWidth={1.75} />
            <p className={`text-[13px] font-semibold ${theme.text.primary}`}>
              Upuść plik z eksportu planu tutaj
            </p>
            <p className={`text-[11.5px] ${theme.text.muted}`}>albo</p>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={isImporting}
              className="inline-flex items-center gap-1.5 rounded-full border border-zinc-200 bg-white px-4 py-1.5 text-[12px] font-semibold text-zinc-800 transition-colors hover:bg-zinc-50 disabled:opacity-50 dark:border-white/10 dark:bg-white/[0.05] dark:text-zinc-200 dark:hover:bg-white/[0.09]"
            >
              {isImporting ? <Loader2 size={12} className="animate-spin" /> : <FileUp size={12} />}
              Wybierz plik
            </button>
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
        )}

        {tab === 'text' && (
          <div className="space-y-2">
            <p className={`text-[11.5px] ${theme.text.muted}`}>
              Otwórz wyeksportowany plik w notatniku, skopiuj całą zawartość
              i wklej tutaj.
            </p>
            <textarea
              value={rawText}
              onChange={(e) => setRawText(e.target.value)}
              placeholder="BEGIN:VCALENDAR…"
              rows={6}
              className="w-full rounded-xl border border-zinc-200 bg-white p-2.5 font-mono text-[11.5px] text-zinc-900 placeholder-zinc-400 outline-none focus:border-brand-gold/45 focus:ring-2 focus:ring-brand-gold/15 dark:border-white/10 dark:bg-white/[0.04] dark:text-zinc-100 dark:placeholder-zinc-500 dark:focus:border-brand-gold-bright/40 dark:focus:ring-brand-gold-bright/15"
            />
            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => void doImportText(rawText)}
                disabled={isImporting || !rawText.trim()}
                className="inline-flex items-center gap-1.5 rounded-full bg-[#1e293b] px-4 py-1.5 text-[12px] font-semibold text-white transition-colors hover:bg-[#1e293b]/90 disabled:opacity-50 dark:bg-brand-gold dark:text-black dark:hover:bg-brand-gold/85"
              >
                {isImporting && <Loader2 size={12} className="animate-spin" />}
                Importuj
              </button>
            </div>
          </div>
        )}
      </div>

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
