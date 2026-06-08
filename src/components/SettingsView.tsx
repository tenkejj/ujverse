import { useCallback, useEffect, useMemo, useState } from 'react'
import type { ComponentType, ReactNode } from 'react'
import { ArrowLeft, LogOut } from 'lucide-react'
import {
  AcademicCapIcon,
  BellAlertIcon,
  CheckCircleIcon,
  CircleStackIcon,
  ClockIcon,
  DocumentTextIcon,
  EnvelopeIcon,
  ExclamationTriangleIcon,
  InformationCircleIcon,
  KeyIcon,
  MagnifyingGlassIcon,
  MoonIcon,
  PaintBrushIcon,
  ShieldCheckIcon,
  SparklesIcon,
  SpeakerWaveIcon,
  Squares2X2Icon,
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
  type Density,
  type UserPreferences,
} from '../lib/userPreferences'
import {
  HISTORY_KEY,
  clearAllHistory,
  loadSearchHistory,
} from '../lib/searchHistory'
import BaseCard from './ui/BaseCard'

type Props = {
  email: string | undefined
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

export default function SettingsView({ email, onBack }: Props) {
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

  // Po przyznaniu/odebraniu zezwolenia (np. via OS) — odśwież stan przy fokusie.
  useEffect(() => {
    const onFocus = () => setPushPermission(readPushPermission())
    window.addEventListener('focus', onFocus)
    return () => window.removeEventListener('focus', onFocus)
  }, [])

  const displayEmail = useMemo(() => email?.trim() || 'test@uj.pl', [email])

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
  const setDensity = (next: Density) => {
    setUserPreference('density', next)
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
  }

  // ── Privacy ─────────────────────────────────────────────────────────────

  const setShowProfileInSearch = (next: boolean) => {
    setUserPreference('showProfileInSearch', next)
  }
  const setShowDepartmentOnPosts = (next: boolean) => {
    setUserPreference('showDepartmentOnPosts', next)
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
    setUserPreference('density', 'comfortable')
    applyVisualPreferences()
    toast.success('Przywrócono domyślne ustawienia wyglądu.')
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
          <Row>
            <div className="min-w-0 flex-1">
              <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-zinc-500 dark:text-zinc-400">
                E-mail
              </p>
              <p className="mt-1 flex items-center gap-2 truncate text-sm font-medium text-zinc-900 dark:text-white">
                <EnvelopeIcon className={`h-4 w-4 ${accentIconCls}`} aria-hidden />
                <span className="truncate">{displayEmail}</span>
              </p>
            </div>
            <button
              type="button"
              onClick={() => toast('Zmiana adresu e-mail będzie dostępna wkrótce.')}
              className={outlineBtnCls}
            >
              Zmień
            </button>
          </Row>

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

          <Row>
            <RowLabel
              icon={Squares2X2Icon}
              title="Gęstość interfejsu"
              hint="Kompaktowa wersja zmniejsza odstępy i typografię."
            />
            <DensitySegmented value={prefs.density} onChange={setDensity} />
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
              hint="Krótki sygnał dźwiękowy przy nowych alertach w aplikacji."
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
              hint="Inni studenci znajdą Cię po loginie i imieniu."
            />
            <SettingsToggle
              id="privacy-search"
              ariaLabel="Pokaż mój profil w wyszukiwarce"
              enabled={prefs.showProfileInSearch}
              onChange={setShowProfileInSearch}
            />
          </Row>

          <Row>
            <RowLabel
              icon={AcademicCapIcon}
              title="Pokaż wydział przy postach"
              hint="Pod nazwą widoczny będzie skrót Twojego wydziału."
            />
            <SettingsToggle
              id="privacy-dept"
              ariaLabel="Pokaż wydział przy postach"
              enabled={prefs.showDepartmentOnPosts}
              onChange={setShowDepartmentOnPosts}
            />
          </Row>
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
          description="Wersja, regulamin i polityka."
        >
          <Row>
            <RowLabel icon={InformationCircleIcon} title="Wersja aplikacji" />
            <span className="font-mono text-sm font-semibold text-zinc-900 dark:text-white">
              v1.0.4-beta
            </span>
          </Row>

          <button
            type="button"
            onClick={() => toast('Regulamin — treść wkrótce.')}
            className="-mx-2 flex w-[calc(100%+1rem)] items-center justify-between gap-3 rounded-xl px-2 py-3.5 text-left transition-colors hover:bg-[#1e293b]/[0.04] dark:hover:bg-white/[0.04]"
          >
            <span className="flex items-center gap-3">
              <DocumentTextIcon className={`h-5 w-5 ${accentIconCls}`} aria-hidden />
              <span className="text-sm font-semibold text-zinc-900 dark:text-white">Regulamin</span>
            </span>
            <span className="text-zinc-400 text-lg">›</span>
          </button>

          <button
            type="button"
            onClick={() => toast('Polityka prywatności — treść wkrótce.')}
            className="-mx-2 flex w-[calc(100%+1rem)] items-center justify-between gap-3 rounded-xl px-2 py-3.5 text-left transition-colors hover:bg-[#1e293b]/[0.04] dark:hover:bg-white/[0.04]"
          >
            <span className="flex items-center gap-3">
              <ShieldCheckIcon className={`h-5 w-5 ${accentIconCls}`} aria-hidden />
              <span className="text-sm font-semibold text-zinc-900 dark:text-white">
                Polityka prywatności
              </span>
            </span>
            <span className="text-zinc-400 text-lg">›</span>
          </button>

          <Row className="items-start">
            <RowLabel
              icon={ExclamationTriangleIcon}
              title="Zgłoś problem"
              hint="Wersja beta — daj znać jeśli coś nie działa."
            />
            <a
              href="mailto:support@ujverse.test?subject=UJverse%20%E2%80%94%20zg%C5%82oszenie%20b%C5%82%C4%99du"
              className={outlineBtnCls}
            >
              Napisz
            </a>
          </Row>
        </SectionCard>
      </div>
    </div>
  )
}

// ── Density segmented control ─────────────────────────────────────────────

function DensitySegmented({
  value,
  onChange,
}: {
  value: Density
  onChange: (next: Density) => void
}) {
  const options: ReadonlyArray<{ id: Density; label: string }> = [
    { id: 'comfortable', label: 'Wygodna' },
    { id: 'compact', label: 'Kompaktowa' },
  ]
  return (
    <div
      role="radiogroup"
      aria-label="Gęstość interfejsu"
      className="inline-flex shrink-0 items-center rounded-full border border-zinc-200 bg-zinc-100/70 p-0.5 text-xs font-semibold dark:border-white/10 dark:bg-white/[0.04]"
    >
      {options.map((opt) => {
        const active = value === opt.id
        return (
          <button
            key={opt.id}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(opt.id)}
            className={`min-w-[88px] rounded-full px-3 py-1.5 transition-colors ${
              active
                ? 'bg-[#1e293b] text-white shadow-sm dark:bg-brand-gold dark:text-black'
                : 'text-zinc-600 hover:text-[#1e293b] dark:text-zinc-300 dark:hover:text-brand-gold-bright'
            }`}
          >
            {opt.label}
          </button>
        )
      })}
    </div>
  )
}
