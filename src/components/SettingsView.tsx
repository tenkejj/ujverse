import { useCallback, useEffect, useState } from 'react'
import type { ComponentType, ReactNode } from 'react'
import { ArrowLeft, LogOut } from 'lucide-react'
import {
  AcademicCapIcon,
  AtSymbolIcon,
  BellAlertIcon,
  CheckCircleIcon,
  CircleStackIcon,
  ClipboardDocumentIcon,
  ClockIcon,
  ExclamationTriangleIcon,
  IdentificationIcon,
  InformationCircleIcon,
  KeyIcon,
  MagnifyingGlassIcon,
  MoonIcon,
  PaintBrushIcon,
  ShieldCheckIcon,
  SparklesIcon,
  SpeakerWaveIcon,
  SunIcon,
  TrashIcon,
  UserCircleIcon,
} from '@heroicons/react/24/outline'
import { toast } from '../lib/appToast'
import { supabase } from '../supabaseClient'
import { useTheme } from '../ThemeContext'
import {
  applyVisualPreferences,
  getUserPreferences,
  setUserPreference,
  subscribePreferences,
  type UserPreferences,
} from '../lib/userPreferences'
import {
  HISTORY_KEY,
  clearAllHistory,
  loadSearchHistory,
} from '../lib/searchHistory'
import { playNotificationPing } from '../lib/notificationSound'
import { UJ_DEPARTMENTS } from '../lib/departments'
import type { Profile } from '../types'
import BaseCard from './ui/BaseCard'

type StudyMode = 'stacjonarne' | 'niestacjonarne' | 'doktoranckie'

type ProfilePatch = Partial<
  Pick<
    Profile,
    'is_searchable' | 'show_department' | 'department' | 'study_program' | 'year_started' | 'study_mode'
  >
>

type Props = {
  email: string | undefined
  myProfile: Profile | null
  onProfilePatch: (patch: ProfilePatch) => void
  onBack: () => void
}

// ── Tokens ────────────────────────────────────────────────────────────────
const accentText = 'text-[#1e293b] dark:text-brand-gold-bright'
const accentIconCls = `shrink-0 ${accentText}`

const sectionHeaderCls =
  'flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.22em] ' +
  'text-[#1e293b] dark:text-brand-gold-bright'

const sectionIconBubble =
  'flex h-8 w-8 items-center justify-center rounded-xl ' +
  'border border-[#1e293b]/15 bg-[#1e293b]/[0.05] text-[#1e293b] ' +
  'dark:border-brand-gold-bright/30 dark:bg-brand-gold-bright/[0.06] dark:text-brand-gold-bright'

const outlineBtnCls =
  'inline-flex shrink-0 items-center justify-center gap-1.5 rounded-full border px-4 py-1.5 ' +
  'text-sm font-semibold transition-colors ' +
  'border-[#1e293b]/35 bg-transparent text-[#1e293b] hover:border-[#1e293b]/55 hover:bg-[#1e293b]/[0.04] ' +
  'dark:border-brand-gold/45 dark:text-brand-gold-bright dark:hover:border-brand-gold-bright/60 ' +
  'dark:hover:bg-brand-gold-bright/[0.06] disabled:cursor-not-allowed disabled:opacity-55'

const dangerBtnCls =
  'inline-flex shrink-0 items-center justify-center gap-1.5 rounded-full border px-4 py-1.5 ' +
  'text-sm font-semibold transition-colors ' +
  'border-rose-500/40 text-rose-600 hover:border-rose-500/60 hover:bg-rose-500/[0.05] ' +
  'dark:border-rose-500/40 dark:text-rose-300 dark:hover:border-rose-400/55 dark:hover:bg-rose-500/[0.08]'

const primaryBtnCls =
  'inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#1e293b] py-2.5 text-sm font-bold ' +
  'text-white transition-colors hover:bg-[#1e293b]/90 ' +
  'dark:bg-brand-gold dark:text-black dark:hover:bg-brand-gold/85 ' +
  'disabled:cursor-not-allowed disabled:opacity-55'

const fieldCls =
  'w-full rounded-xl border border-zinc-200 bg-zinc-50/80 p-3 text-zinc-900 outline-none ' +
  'placeholder:text-zinc-400 focus:border-[#1e293b] ' +
  'dark:border-white/10 dark:bg-white/[0.03] dark:text-white dark:placeholder:text-zinc-500 ' +
  'dark:focus:border-brand-gold-bright'

// Mail kontaktowy do "Zgłoś problem". Trzymany jako stała żeby było widać
// w jednym miejscu i łatwo zaktualizować.
const SUPPORT_EMAIL = 'franciszek.dranka@student.uj.edu.pl'
const APP_AUTHOR = 'Franciszek Dranka'

// ── Helpers ───────────────────────────────────────────────────────────────

function SettingsToggle({
  enabled,
  onChange,
  id,
  ariaLabel,
  disabled,
}: {
  enabled: boolean
  onChange: (next: boolean) => void
  id?: string
  ariaLabel?: string
  disabled?: boolean
}) {
  return (
    <button
      type="button"
      id={id}
      role="switch"
      aria-checked={enabled}
      aria-label={ariaLabel}
      disabled={disabled}
      onClick={() => !disabled && onChange(!enabled)}
      className={`relative h-7 w-12 shrink-0 rounded-full transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1e293b]/40 dark:focus-visible:ring-brand-gold/45 ${
        disabled ? 'cursor-not-allowed opacity-55' : ''
      } ${
        enabled
          ? 'bg-[#1e293b] dark:bg-brand-gold dark:shadow-[0_0_10px_rgba(201,162,39,0.35)]'
          : 'bg-zinc-300 dark:bg-zinc-700'
      }`}
    >
      <span
        className={`pointer-events-none absolute top-0.5 left-0.5 h-6 w-6 rounded-full bg-white shadow transition-transform ${
          enabled ? 'translate-x-5' : 'translate-x-0'
        }`}
      />
    </button>
  )
}

function SectionCard({
  title,
  icon: Icon,
  description,
  children,
}: {
  title: string
  icon: ComponentType<{ className?: string; 'aria-hidden'?: boolean }>
  description?: string
  children: ReactNode
}) {
  return (
    <BaseCard className="px-4 py-4 sm:px-5 sm:py-5">
      <header className="mb-3 flex items-start gap-3">
        <span className={sectionIconBubble} aria-hidden>
          <Icon className="h-4 w-4" aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <h2 className={sectionHeaderCls}>{title}</h2>
          {description ? (
            <p className="mt-1 text-[12px] leading-snug text-zinc-500 dark:text-zinc-400">
              {description}
            </p>
          ) : null}
        </div>
      </header>
      <div className="divide-y divide-zinc-200/70 dark:divide-white/[0.06]">{children}</div>
    </BaseCard>
  )
}

function Row({
  children,
  className = '',
}: {
  children: ReactNode
  className?: string
}) {
  return (
    <div
      className={`flex items-center justify-between gap-3 py-3.5 first:pt-1 last:pb-1 ${className}`}
    >
      {children}
    </div>
  )
}

function RowLabel({
  icon: Icon,
  title,
  hint,
}: {
  icon: ComponentType<{ className?: string; 'aria-hidden'?: boolean }>
  title: string
  hint?: string
}) {
  return (
    <div className="flex min-w-0 flex-1 items-start gap-3 pr-2">
      <Icon className={`mt-0.5 h-5 w-5 ${accentIconCls}`} aria-hidden />
      <div className="min-w-0">
        <p className="text-sm font-semibold text-zinc-900 dark:text-white">{title}</p>
        {hint ? (
          <p className="mt-0.5 text-xs leading-snug text-zinc-500 dark:text-zinc-400">{hint}</p>
        ) : null}
      </div>
    </div>
  )
}

// ── Notification permission helper ────────────────────────────────────────

type PushPermission = 'granted' | 'denied' | 'default' | 'unsupported'

function readPushPermission(): PushPermission {
  if (typeof window === 'undefined' || !('Notification' in window)) return 'unsupported'
  return window.Notification.permission as PushPermission
}

// ── Local hooks ───────────────────────────────────────────────────────────

function useUserPrefs(): UserPreferences {
  const [prefs, setPrefs] = useState<UserPreferences>(() => getUserPreferences())
  useEffect(() => subscribePreferences(setPrefs), [])
  return prefs
}

function useSearchHistoryCount(): [number, () => void] {
  const [count, setCount] = useState<number>(() => loadSearchHistory().length)
  const refresh = useCallback(() => {
    setCount(loadSearchHistory().length)
  }, [])
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === HISTORY_KEY) refresh()
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [refresh])
  return [count, refresh]
}

// ── Cache reset ───────────────────────────────────────────────────────────

const CACHE_KEYS_TO_CLEAR = [
  'ujverse_events',
  'ujverse_official_ingest_v3',
  'ujverse.repliesPanel.draftsByTarget.v1',
] as const

function clearLocalAppCache(): number {
  let removed = 0
  for (const key of CACHE_KEYS_TO_CLEAR) {
    try {
      if (window.localStorage.getItem(key) !== null) {
        window.localStorage.removeItem(key)
        removed++
      }
    } catch {
      /* ignore */
    }
  }
  return removed
}

// ── Main component ────────────────────────────────────────────────────────

export default function SettingsView({ email, myProfile, onProfilePatch, onBack }: Props) {
  const { theme, toggleTheme } = useTheme()
  const prefs = useUserPrefs()

  const [showPasswordForm, setShowPasswordForm] = useState(false)
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [passwordSubmitting, setPasswordSubmitting] = useState(false)

  const [signingOut, setSigningOut] = useState(false)

  const [pushPermission, setPushPermission] = useState<PushPermission>(() => readPushPermission())
  const [pushBusy, setPushBusy] = useState(false)

  const [searchHistoryCount, refreshSearchHistoryCount] = useSearchHistoryCount()

  // Server-side privacy flags z `profiles` — domyślnie `true` żeby nie psuć
  // wyświetlania zanim user ich nie ruszy (i dla wierszy sprzed migracji).
  const profileSearchable = myProfile?.is_searchable !== false
  const profileShowDept = myProfile?.show_department !== false

  const [privacyBusy, setPrivacyBusy] = useState<{
    is_searchable: boolean
    show_department: boolean
  }>({ is_searchable: false, show_department: false })

  // ── Studia (Aula → rocznik) ───────────────────────────────────────────────
  const currentYear = new Date().getFullYear()
  const studyYears = Array.from({ length: 8 }, (_, i) => currentYear - i)
  const [studyDept, setStudyDept] = useState(myProfile?.department ?? '')
  const [studyProgram, setStudyProgram] = useState(myProfile?.study_program ?? '')
  const [studyYear, setStudyYear] = useState<number | ''>(myProfile?.year_started ?? '')
  const [studyMode, setStudyMode] = useState<StudyMode | ''>(myProfile?.study_mode ?? '')
  const [studyBusy, setStudyBusy] = useState(false)

  useEffect(() => {
    setStudyDept(myProfile?.department ?? '')
    setStudyProgram(myProfile?.study_program ?? '')
    setStudyYear(myProfile?.year_started ?? '')
    setStudyMode(myProfile?.study_mode ?? '')
  }, [myProfile?.department, myProfile?.study_program, myProfile?.year_started, myProfile?.study_mode])

  const studyDirty =
    studyDept !== (myProfile?.department ?? '') ||
    studyProgram !== (myProfile?.study_program ?? '') ||
    studyYear !== (myProfile?.year_started ?? '') ||
    studyMode !== (myProfile?.study_mode ?? '')

  const handleSaveStudies = useCallback(async () => {
    if (!myProfile?.id || studyBusy) return
    if (!studyDept.trim() || !studyProgram.trim() || studyYear === '' || studyMode === '') {
      toast.error('Uzupełnij wydział, kierunek, rok i tryb.')
      return
    }
    setStudyBusy(true)
    const patch: ProfilePatch = {
      department: studyDept.trim(),
      study_program: studyProgram.trim(),
      year_started: Number(studyYear),
      study_mode: studyMode as StudyMode,
    }
    const { error } = await supabase.from('profiles').update(patch).eq('id', myProfile.id)
    setStudyBusy(false)
    if (error) {
      toast.error(error.message || 'Nie udało się zapisać danych studiów.')
      return
    }
    onProfilePatch(patch)
    toast.success('Zapisano dane studiów. Trafiłeś/aś do właściwego rocznika.')
  }, [myProfile?.id, studyBusy, studyDept, studyProgram, studyYear, studyMode, onProfilePatch])

  // Po przyznaniu/odebraniu zezwolenia (np. via OS) — odśwież stan przy fokusie.
  useEffect(() => {
    const onFocus = () => setPushPermission(readPushPermission())
    window.addEventListener('focus', onFocus)
    return () => window.removeEventListener('focus', onFocus)
  }, [])

  // ── Account ─────────────────────────────────────────────────────────────

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (passwordSubmitting) return
    if (newPassword.length < 8) {
      toast.error('Nowe hasło musi mieć min. 8 znaków.')
      return
    }
    if (newPassword !== confirmPassword) {
      toast.error('Hasła nie są zgodne.')
      return
    }
    if (!currentPassword) {
      toast.error('Podaj obecne hasło.')
      return
    }
    if (!email) {
      toast.error('Brak adresu e-mail w sesji.')
      return
    }
    setPasswordSubmitting(true)
    try {
      const reauth = await supabase.auth.signInWithPassword({
        email,
        password: currentPassword,
      })
      if (reauth.error) {
        toast.error('Niepoprawne obecne hasło.')
        return
      }
      const { error } = await supabase.auth.updateUser({ password: newPassword })
      if (error) {
        toast.error(error.message || 'Nie udało się zmienić hasła.')
        return
      }
      toast.success('Hasło zostało zmienione.')
      setShowPasswordForm(false)
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
    } finally {
      setPasswordSubmitting(false)
    }
  }

  const handleSignOut = async () => {
    if (signingOut) return
    setSigningOut(true)
    try {
      await supabase.auth.signOut()
    } catch (err) {
      toast.error((err as Error)?.message || 'Nie udało się wylogować.')
    } finally {
      setSigningOut(false)
    }
  }

  // ── Appearance ──────────────────────────────────────────────────────────

  const setReducedMotion = (next: boolean) => {
    setUserPreference('reducedMotion', next)
  }

  // ── Notifications ───────────────────────────────────────────────────────

  const togglePush = async (next: boolean) => {
    if (pushBusy) return
    if (pushPermission === 'unsupported') {
      toast.error('Twoja przeglądarka nie wspiera powiadomień.')
      return
    }
    if (next) {
      if (pushPermission === 'granted') return
      if (pushPermission === 'denied') {
        toast.error('Powiadomienia są zablokowane w przeglądarce — odblokuj je w ustawieniach strony.')
        return
      }
      setPushBusy(true)
      try {
        const result = await window.Notification.requestPermission()
        setPushPermission(result as PushPermission)
        if (result === 'granted') {
          toast.success('Powiadomienia w przeglądarce włączone.')
        } else if (result === 'denied') {
          toast.error('Odmówiono dostępu do powiadomień.')
        }
      } finally {
        setPushBusy(false)
      }
    } else {
      // Nie da się programatycznie cofnąć grant — informujemy użytkownika.
      toast(
        'Aby wyłączyć powiadomienia, zmień zgodę dla tej strony w ustawieniach przeglądarki.',
      )
    }
  }

  const pushEnabled = pushPermission === 'granted'
  const pushHint =
    pushPermission === 'unsupported'
      ? 'Przeglądarka nie wspiera powiadomień.'
      : pushPermission === 'denied'
        ? 'Zablokowane w przeglądarce — odblokuj w ustawieniach strony.'
        : pushPermission === 'granted'
          ? 'Otrzymasz alert systemowy o nowych powiadomieniach.'
          : 'Pozwól wyświetlać alerty systemowe na pulpicie.'

  const setNotificationSound = (next: boolean) => {
    setUserPreference('notificationSound', next)
    // Przy włączeniu odtwórz krótki preview, żeby user usłyszał jak brzmi
    // (i jednocześnie odblokował AudioContext przy pierwszej interakcji).
    if (next) {
      // setTimeout 0 — oddziela od kliknięcia, dzięki czemu AudioContext
      // ma już aktywne user-gesture w niektórych przeglądarkach.
      window.setTimeout(() => playNotificationPing(), 0)
    }
  }

  // ── Privacy (server-side) ───────────────────────────────────────────────

  const updateProfileFlag = useCallback(
    async (
      key: 'is_searchable' | 'show_department',
      next: boolean,
      labels: { onSuccess: string; onError: string },
    ) => {
      if (!myProfile?.id) {
        toast.error('Brak profilu — zaloguj się ponownie.')
        return
      }
      if (privacyBusy[key]) return

      const previous = myProfile[key] !== false
      setPrivacyBusy((prev) => ({ ...prev, [key]: true }))
      onProfilePatch({ [key]: next } as ProfilePatch)

      const { error } = await supabase
        .from('profiles')
        .update({ [key]: next })
        .eq('id', myProfile.id)

      setPrivacyBusy((prev) => ({ ...prev, [key]: false }))

      if (error) {
        onProfilePatch({ [key]: previous } as ProfilePatch)
        toast.error(error.message || labels.onError)
        return
      }
      toast.success(labels.onSuccess)
    },
    [myProfile, onProfilePatch, privacyBusy],
  )

  const setShowProfileInSearch = (next: boolean) => {
    void updateProfileFlag('is_searchable', next, {
      onSuccess: next
        ? 'Profil widoczny w wyszukiwarce.'
        : 'Profil ukryty w wyszukiwarce.',
      onError: 'Nie udało się zapisać preferencji.',
    })
  }
  const setShowDepartmentOnPosts = (next: boolean) => {
    void updateProfileFlag('show_department', next, {
      onSuccess: next
        ? 'Wydział jest pokazywany przy postach.'
        : 'Wydział ukryty przy postach.',
      onError: 'Nie udało się zapisać preferencji.',
    })
  }

  // ── Data ────────────────────────────────────────────────────────────────

  const handleClearSearchHistory = () => {
    if (searchHistoryCount === 0) {
      toast('Historia wyszukiwania jest już pusta.')
      return
    }
    clearAllHistory()
    refreshSearchHistoryCount()
    toast.success('Historia wyszukiwania wyczyszczona.')
  }

  const handleClearLocalCache = () => {
    const removed = clearLocalAppCache()
    if (removed === 0) {
      toast('Brak lokalnej pamięci do wyczyszczenia.')
      return
    }
    toast.success(`Wyczyszczono lokalną pamięć (${removed} pozycji).`)
  }

  const handleResetVisualPrefs = () => {
    setUserPreference('reducedMotion', false)
    applyVisualPreferences()
    toast.success('Przywrócono domyślne ustawienia wyglądu.')
  }

  // ── Contact ─────────────────────────────────────────────────────────────

  const handleCopySupportEmail = async () => {
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(SUPPORT_EMAIL)
      } else {
        // Fallback dla starszych przeglądarek / bez secure context.
        const textarea = document.createElement('textarea')
        textarea.value = SUPPORT_EMAIL
        textarea.setAttribute('readonly', '')
        textarea.style.position = 'fixed'
        textarea.style.opacity = '0'
        document.body.appendChild(textarea)
        textarea.select()
        document.execCommand('copy')
        document.body.removeChild(textarea)
      }
      toast.success('Adres skopiowany do schowka.')
    } catch {
      toast.error('Nie udało się skopiować adresu.')
    }
  }

  // ── Render ──────────────────────────────────────────────────────────────

  return (
    <div className="space-y-5 -mx-4 px-4 py-2 md:mx-0 md:px-0">
      {/* Header */}
      <div className="relative flex items-start gap-3 pt-1">
        <button
          type="button"
          onClick={onBack}
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-zinc-200 bg-white/70 text-zinc-700 backdrop-blur transition-colors hover:border-[#1e293b]/30 hover:bg-white hover:text-[#1e293b] dark:border-white/10 dark:bg-white/[0.04] dark:text-zinc-300 dark:hover:border-brand-gold-bright/40 dark:hover:bg-white/[0.07] dark:hover:text-brand-gold-bright"
          aria-label="Poprzednia strona"
        >
          <ArrowLeft size={20} strokeWidth={2.25} aria-hidden />
        </button>
        <div className="min-w-0 flex-1">
          <h1 className="text-3xl font-extrabold tracking-tight text-zinc-900 dark:text-white">
            Ustawienia
          </h1>
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
            Konto, wygląd i preferencje aplikacji w jednym miejscu.
          </p>
        </div>
      </div>

      <div className="space-y-4 pb-10">
        {/* Konto ───────────────────────────────────────────────────────── */}
        <SectionCard
          title="Konto"
          icon={UserCircleIcon}
          description="Twój login w UJverse i dostęp do konta."
        >
          <div>
            <Row>
              <RowLabel
                icon={KeyIcon}
                title="Zmiana hasła"
                hint="Zalecane co kilka miesięcy."
              />
              <button
                type="button"
                onClick={() => setShowPasswordForm((v) => !v)}
                className={outlineBtnCls}
              >
                {showPasswordForm ? 'Ukryj' : 'Otwórz'}
              </button>
            </Row>
            {showPasswordForm && (
              <form
                onSubmit={handlePasswordSubmit}
                className="space-y-3 border-t border-zinc-200/70 py-4 dark:border-white/[0.06]"
              >
                <label className="block">
                  <span className="mb-1 block text-xs font-medium text-zinc-600 dark:text-zinc-400">
                    Obecne hasło
                  </span>
                  <input
                    type="password"
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    className={fieldCls}
                    autoComplete="current-password"
                    required
                  />
                </label>
                <label className="block">
                  <span className="mb-1 block text-xs font-medium text-zinc-600 dark:text-zinc-400">
                    Nowe hasło
                  </span>
                  <input
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className={fieldCls}
                    autoComplete="new-password"
                    minLength={8}
                    required
                  />
                </label>
                <label className="block">
                  <span className="mb-1 block text-xs font-medium text-zinc-600 dark:text-zinc-400">
                    Potwierdź nowe hasło
                  </span>
                  <input
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className={fieldCls}
                    autoComplete="new-password"
                    minLength={8}
                    required
                  />
                </label>
                <button
                  type="submit"
                  disabled={passwordSubmitting}
                  className={primaryBtnCls}
                >
                  {passwordSubmitting ? 'Zapisuję…' : 'Zapisz nowe hasło'}
                </button>
              </form>
            )}
          </div>

          <Row>
            <RowLabel
              icon={LogOut}
              title="Wyloguj się"
              hint="Zakończ bieżącą sesję na tym urządzeniu."
            />
            <button
              type="button"
              onClick={() => void handleSignOut()}
              disabled={signingOut}
              className={dangerBtnCls}
            >
              {signingOut ? 'Wylogowuję…' : 'Wyloguj'}
            </button>
          </Row>
        </SectionCard>

        {/* Wygląd ──────────────────────────────────────────────────────── */}
        <SectionCard
          title="Wygląd"
          icon={PaintBrushIcon}
          description="Dopasuj motyw i intensywność animacji do swoich preferencji."
        >
          <Row>
            <div className="flex min-w-0 flex-1 items-center gap-3 pr-2">
              {theme === 'dark' ? (
                <MoonIcon className={`h-5 w-5 ${accentIconCls}`} aria-hidden />
              ) : (
                <SunIcon className={`h-5 w-5 ${accentIconCls}`} aria-hidden />
              )}
              <div>
                <p className="text-sm font-semibold text-zinc-900 dark:text-white">Motyw</p>
                <p className="text-xs text-zinc-500 dark:text-zinc-400">
                  {theme === 'dark' ? 'Ciemny — granat + złoto.' : 'Jasny — biała mleczna szyba.'}
                </p>
              </div>
            </div>
            <SettingsToggle
              id="theme-toggle"
              ariaLabel="Przełącz motyw"
              enabled={theme === 'dark'}
              onChange={() => toggleTheme()}
            />
          </Row>

          <Row>
            <RowLabel
              icon={SparklesIcon}
              title="Ogranicz animacje"
              hint="Wyłącza efekty wejścia i przejścia w całej aplikacji."
            />
            <SettingsToggle
              id="reduce-motion"
              ariaLabel="Ogranicz animacje"
              enabled={prefs.reducedMotion}
              onChange={setReducedMotion}
            />
          </Row>
        </SectionCard>

        {/* Powiadomienia ──────────────────────────────────────────────── */}
        <SectionCard
          title="Powiadomienia"
          icon={BellAlertIcon}
          description="Decyduj, jak UJverse przykuwa Twoją uwagę."
        >
          <Row>
            <RowLabel
              icon={BellAlertIcon}
              title="Powiadomienia w przeglądarce"
              hint={pushHint}
            />
            <SettingsToggle
              id="push-notifications"
              ariaLabel="Powiadomienia w przeglądarce"
              enabled={pushEnabled}
              disabled={pushBusy || pushPermission === 'unsupported'}
              onChange={(next) => void togglePush(next)}
            />
          </Row>

          <Row>
            <RowLabel
              icon={SpeakerWaveIcon}
              title="Dźwięk powiadomień"
              hint="Krótki ton odtwarzany przy nowym powiadomieniu — kliknij, aby usłyszeć."
            />
            <SettingsToggle
              id="notification-sound"
              ariaLabel="Dźwięk powiadomień"
              enabled={prefs.notificationSound}
              onChange={setNotificationSound}
            />
          </Row>
        </SectionCard>

        {/* Prywatność ─────────────────────────────────────────────────── */}
        <SectionCard
          title="Prywatność"
          icon={ShieldCheckIcon}
          description="Kontroluj, jak Twój profil pojawia się w UJverse."
        >
          <Row>
            <RowLabel
              icon={MagnifyingGlassIcon}
              title="Pokaż mój profil w wyszukiwarce"
              hint="Po wyłączeniu znikasz z indeksu Meilisearch — inni nie znajdą Cię po loginie ani imieniu."
            />
            <SettingsToggle
              id="privacy-search"
              ariaLabel="Pokaż mój profil w wyszukiwarce"
              enabled={profileSearchable}
              disabled={privacyBusy.is_searchable || !myProfile?.id}
              onChange={setShowProfileInSearch}
            />
          </Row>

          <Row>
            <RowLabel
              icon={AcademicCapIcon}
              title="Pokaż wydział przy postach"
              hint="Po wyłączeniu badge wydziału zniknie przy Twoich postach w feedzie i na profilu."
            />
            <SettingsToggle
              id="privacy-dept"
              ariaLabel="Pokaż wydział przy postach"
              enabled={profileShowDept}
              disabled={privacyBusy.show_department || !myProfile?.id}
              onChange={setShowDepartmentOnPosts}
            />
          </Row>
        </SectionCard>

        {/* Studia ──────────────────────────────────────────────────────── */}
        <SectionCard
          title="Studia"
          icon={AcademicCapIcon}
          description="Kierunek, rok i tryb decydują o Twoim roczniku w Auli (czat grupy)."
        >
          <div className="space-y-3 py-3">
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-zinc-600 dark:text-zinc-400">Wydział</span>
              <select
                className={fieldCls}
                value={studyDept}
                onChange={(e) => setStudyDept(e.target.value)}
              >
                <option value="">Wybierz wydział…</option>
                {UJ_DEPARTMENTS.map((d) => (
                  <option key={d} value={d}>{d}</option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-zinc-600 dark:text-zinc-400">Kierunek studiów</span>
              <input
                type="text"
                className={fieldCls}
                placeholder="np. Informatyka Stosowana"
                value={studyProgram}
                onChange={(e) => setStudyProgram(e.target.value)}
                autoComplete="off"
              />
            </label>
            <div className="grid grid-cols-2 gap-3">
              <label className="block">
                <span className="mb-1 block text-xs font-medium text-zinc-600 dark:text-zinc-400">Rok rozpoczęcia</span>
                <select
                  className={fieldCls}
                  value={studyYear}
                  onChange={(e) => setStudyYear(e.target.value ? Number(e.target.value) : '')}
                >
                  <option value="">Rok…</option>
                  {studyYears.map((y) => (
                    <option key={y} value={y}>{y}</option>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className="mb-1 block text-xs font-medium text-zinc-600 dark:text-zinc-400">Tryb</span>
                <select
                  className={fieldCls}
                  value={studyMode}
                  onChange={(e) => setStudyMode((e.target.value || '') as StudyMode | '')}
                >
                  <option value="">Tryb…</option>
                  <option value="stacjonarne">Stacjonarne</option>
                  <option value="niestacjonarne">Niestacjonarne</option>
                  <option value="doktoranckie">Doktoranckie</option>
                </select>
              </label>
            </div>
            <button
              type="button"
              onClick={() => void handleSaveStudies()}
              disabled={studyBusy || !studyDirty || !myProfile?.id}
              className={primaryBtnCls}
            >
              {studyBusy ? 'Zapisuję…' : 'Zapisz dane studiów'}
            </button>
          </div>
        </SectionCard>

        {/* Dane ────────────────────────────────────────────────────────── */}
        <SectionCard
          title="Dane i pamięć"
          icon={CircleStackIcon}
          description="Zarządzaj lokalną pamięcią aplikacji."
        >
          <Row>
            <RowLabel
              icon={ClockIcon}
              title="Historia wyszukiwania"
              hint={
                searchHistoryCount > 0
                  ? `Zapamiętane frazy: ${searchHistoryCount}.`
                  : 'Brak zapisanych fraz.'
              }
            />
            <button
              type="button"
              onClick={handleClearSearchHistory}
              disabled={searchHistoryCount === 0}
              className={outlineBtnCls}
            >
              <TrashIcon className="h-4 w-4" aria-hidden />
              Wyczyść
            </button>
          </Row>

          <Row>
            <RowLabel
              icon={CircleStackIcon}
              title="Lokalna pamięć aplikacji"
              hint="Cache wydarzeń, oficjalne ingesty i nieprzesłane szkice odpowiedzi."
            />
            <button
              type="button"
              onClick={handleClearLocalCache}
              className={outlineBtnCls}
            >
              <TrashIcon className="h-4 w-4" aria-hidden />
              Wyczyść
            </button>
          </Row>

          <Row>
            <RowLabel
              icon={CheckCircleIcon}
              title="Reset preferencji wyglądu"
              hint="Przywraca domyślne wartości motywu i animacji."
            />
            <button type="button" onClick={handleResetVisualPrefs} className={outlineBtnCls}>
              Przywróć
            </button>
          </Row>
        </SectionCard>

        {/* Informacje ──────────────────────────────────────────────────── */}
        <SectionCard
          title="Informacje"
          icon={InformationCircleIcon}
          description="Wersja aplikacji, autor i adres kontaktowy."
        >
          <Row>
            <RowLabel icon={InformationCircleIcon} title="Wersja aplikacji" />
            <span className="font-mono text-sm font-semibold text-zinc-900 dark:text-white">
              v1.0.0-alpha
            </span>
          </Row>

          <Row>
            <RowLabel
              icon={IdentificationIcon}
              title="Autor"
              hint="Twórca i opiekun projektu UJverse."
            />
            <span className="text-sm font-semibold text-zinc-900 dark:text-white">
              {APP_AUTHOR}
            </span>
          </Row>

          <div className="py-3.5">
            <RowLabel
              icon={ExclamationTriangleIcon}
              title="Zgłoszenia błędów i sugestie"
              hint="Aplikacja znajduje się w fazie alpha. Wszelkie napotkane usterki oraz uwagi prosimy zgłaszać na poniższy adres kontaktowy."
            />
            <div className="mt-3 ml-8 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <span className="inline-flex min-w-0 items-center gap-2 rounded-xl border border-zinc-200 bg-zinc-50/80 px-3 py-2 font-mono text-[13px] text-zinc-800 dark:border-white/10 dark:bg-white/[0.03] dark:text-zinc-100">
                <AtSymbolIcon className={`h-4 w-4 ${accentIconCls}`} aria-hidden />
                <span className="truncate">{SUPPORT_EMAIL}</span>
              </span>
              <button
                type="button"
                onClick={() => void handleCopySupportEmail()}
                className={outlineBtnCls}
              >
                <ClipboardDocumentIcon className="h-4 w-4" aria-hidden />
                Kopiuj adres
              </button>
            </div>
          </div>
        </SectionCard>

        <p className="pt-1 text-center text-[11px] text-zinc-500 dark:text-zinc-500">
          UJverse · {APP_AUTHOR} · v1.0.0-alpha
        </p>
      </div>
    </div>
  )
}

