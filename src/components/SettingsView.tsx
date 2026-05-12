import { useState } from 'react'
import type { ComponentType, ReactNode } from 'react'
import {
  AcademicCapIcon,
  ArrowLeftIcon,
  DocumentTextIcon,
  EnvelopeIcon,
  InformationCircleIcon,
  KeyIcon,
  MagnifyingGlassIcon,
  MoonIcon,
  PaintBrushIcon,
  ShieldCheckIcon,
  SunIcon,
  UserCircleIcon,
} from '@heroicons/react/24/outline'
import { toast } from '../lib/appToast'
import { useTheme } from '../ThemeContext'

type Props = {
  email: string | undefined
  onBack: () => void
}

const settingsActionBtnClass =
  'shrink-0 rounded-full border border-zinc-200/90 bg-white px-4 py-1 text-sm font-medium text-brand-gold transition-all hover:bg-zinc-50 dark:border-brand-gold/45 dark:bg-bg-card dark:text-brand-gold-bright dark:hover:border-brand-gold-bright/55 dark:hover:bg-zinc-900'

function SettingsToggle({
  enabled,
  onChange,
  id,
}: {
  enabled: boolean
  onChange: (next: boolean) => void
  id: string
}) {
  return (
    <button
      type="button"
      id={id}
      role="switch"
      aria-checked={enabled}
      onClick={() => onChange(!enabled)}
      className={`relative h-7 w-12 shrink-0 rounded-full transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold/50 ${
        enabled
          ? 'bg-brand-gold shadow-[0_0_10px_rgba(201,162,39,0.35)]'
          : 'bg-zinc-300 shadow-none dark:bg-zinc-600'
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
  children,
}: {
  title: string
  icon: ComponentType<{ className?: string; 'aria-hidden'?: boolean }>
  children: ReactNode
}) {
  return (
    <section className="mb-4 rounded-2xl bg-white p-4 shadow-sm last:mb-0 dark:bg-bg-card">
      <div className="mb-3 flex items-center gap-2">
        <Icon className="h-5 w-5 shrink-0 text-brand-gold dark:text-brand-gold-bright" aria-hidden />
        <h2 className="text-xs font-semibold uppercase tracking-wide text-zinc-900 opacity-70 dark:text-white">
          {title}
        </h2>
      </div>
      <div className="divide-y divide-zinc-200/70 dark:divide-zinc-700/50">{children}</div>
    </section>
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
      className={`flex items-center justify-between gap-3 py-3.5 transition-colors first:pt-0 last:pb-0 hover:bg-zinc-50/80 dark:hover:bg-white/[0.04] ${className}`}
    >
      {children}
    </div>
  )
}

export default function SettingsView({ email, onBack }: Props) {
  const { theme, toggleTheme } = useTheme()
  const [showPasswordForm, setShowPasswordForm] = useState(false)
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [profileInSearch, setProfileInSearch] = useState(true)
  const [departmentOnPosts, setDepartmentOnPosts] = useState(true)

  const displayEmail = email?.trim() || 'test@uj.pl'

  const handlePasswordSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (newPassword !== confirmPassword) {
      toast.error('Hasła nie są zgodne.')
      return
    }
    toast.success('Wkrótce: zmiana hasła przez Supabase Auth.')
    setShowPasswordForm(false)
    setCurrentPassword('')
    setNewPassword('')
    setConfirmPassword('')
  }

  const fieldCls =
    'w-full rounded-xl border border-zinc-200 bg-zinc-50 p-3 text-zinc-900 outline-none placeholder:text-zinc-400 focus:border-brand-gold dark:border-zinc-800 dark:bg-bg-card dark:text-white dark:placeholder:text-zinc-500'

  return (
    <div className="min-h-[50vh] space-y-5 bg-zinc-50 dark:bg-bg-app -mx-4 px-4 py-2 md:mx-0 md:rounded-2xl md:px-0 md:bg-transparent dark:md:bg-transparent">
      <div className="flex items-center gap-3 pt-1">
        <button
          type="button"
          onClick={onBack}
          className="flex items-center gap-2 rounded-xl px-2 py-2 text-sm font-bold text-zinc-600 transition-colors hover:bg-white/5 hover:text-zinc-900 dark:text-zinc-300 dark:hover:text-white"
          aria-label="Wróć"
        >
          <ArrowLeftIcon className="h-6 w-6 shrink-0 text-brand-gold dark:text-brand-gold-bright" aria-hidden />
          <span>Wróć</span>
        </button>
        <h1 className="text-3xl font-extrabold tracking-tight text-zinc-900 dark:text-white">
          Ustawienia
        </h1>
      </div>

      <div className="pb-8">
        <SectionCard title="Konto" icon={UserCircleIcon}>
          <Row>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                E-mail
              </p>
              <p className="mt-1 flex items-center gap-2 truncate text-sm font-medium text-zinc-900 dark:text-white">
                <EnvelopeIcon className="h-4 w-4 shrink-0 text-brand-gold dark:text-brand-gold-bright" aria-hidden />
                {displayEmail}
              </p>
            </div>
            <button
              type="button"
              onClick={() => toast('Zmiana adresu e-mail będzie dostępna wkrótce.')}
              className={settingsActionBtnClass}
            >
              Zmień
            </button>
          </Row>
          <div>
            <Row>
              <div className="flex min-w-0 flex-1 items-center gap-2">
                <KeyIcon className="h-5 w-5 shrink-0 text-brand-gold dark:text-brand-gold-bright" aria-hidden />
                <span className="text-sm font-semibold text-zinc-900 dark:text-white">Zmiana hasła</span>
              </div>
              <button
                type="button"
                onClick={() => setShowPasswordForm((v) => !v)}
                className={settingsActionBtnClass}
              >
                {showPasswordForm ? 'Ukryj' : 'Otwórz formularz'}
              </button>
            </Row>
            {showPasswordForm && (
              <form
                onSubmit={handlePasswordSubmit}
                className="space-y-3 border-t border-zinc-200/70 py-4 dark:border-zinc-700/50"
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
                  />
                </label>
                <button
                  type="submit"
                  className="w-full rounded-xl bg-brand-gold py-2.5 text-sm font-bold text-black transition-opacity hover:opacity-90"
                >
                  Zapisz nowe hasło
                </button>
              </form>
            )}
          </div>
        </SectionCard>

        <SectionCard title="Wygląd" icon={PaintBrushIcon}>
          <Row>
            <div className="flex items-center gap-3 min-w-0">
              {theme === 'dark' ? (
                <MoonIcon className="h-5 w-5 shrink-0 text-brand-gold dark:text-brand-gold-bright" aria-hidden />
              ) : (
                <SunIcon className="h-5 w-5 shrink-0 text-brand-gold dark:text-brand-gold-bright" aria-hidden />
              )}
              <div>
                <p className="text-sm font-semibold text-zinc-900 dark:text-white">Motyw</p>
                <p className="text-xs text-zinc-500 dark:text-zinc-400">
                  {theme === 'dark' ? 'Ciemny' : 'Jasny'} — kliknij, aby przełączyć
                </p>
              </div>
            </div>
            <SettingsToggle
              id="theme-toggle"
              enabled={theme === 'dark'}
              onChange={() => toggleTheme()}
            />
          </Row>
        </SectionCard>

        <SectionCard title="Prywatność" icon={ShieldCheckIcon}>
          <Row>
            <div className="flex items-center gap-3 min-w-0 pr-2">
              <MagnifyingGlassIcon className="h-5 w-5 shrink-0 text-brand-gold dark:text-brand-gold-bright" aria-hidden />
              <span className="text-sm font-medium text-zinc-900 dark:text-white">
                Pokaż mój profil w wyszukiwarce
              </span>
            </div>
            <SettingsToggle
              id="privacy-search"
              enabled={profileInSearch}
              onChange={setProfileInSearch}
            />
          </Row>
          <Row>
            <div className="flex items-center gap-3 min-w-0 pr-2">
              <AcademicCapIcon className="h-5 w-5 shrink-0 text-brand-gold dark:text-brand-gold-bright" aria-hidden />
              <span className="text-sm font-medium text-zinc-900 dark:text-white">
                Pokaż mój wydział przy postach
              </span>
            </div>
            <SettingsToggle
              id="privacy-dept"
              enabled={departmentOnPosts}
              onChange={setDepartmentOnPosts}
            />
          </Row>
        </SectionCard>

        <SectionCard title="Informacje" icon={InformationCircleIcon}>
          <Row className="!justify-start flex-col items-stretch sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-2">
              <InformationCircleIcon className="h-5 w-5 text-brand-gold dark:text-brand-gold-bright" aria-hidden />
              <span className="text-sm text-zinc-600 dark:text-zinc-300">Wersja aplikacji</span>
            </div>
            <span className="text-sm font-mono font-semibold text-zinc-900 dark:text-white sm:text-right">
              v1.0.4-beta
            </span>
          </Row>
          <button
            type="button"
            onClick={() => toast('Regulamin — treść wkrótce.')}
            className="flex w-full items-center justify-between gap-3 py-3.5 text-left transition-colors hover:bg-zinc-50/80 dark:hover:bg-white/[0.04]"
          >
            <span className="flex items-center gap-3 text-sm font-medium text-zinc-900 dark:text-white">
              <DocumentTextIcon className="h-5 w-5 shrink-0 text-brand-gold dark:text-brand-gold-bright" aria-hidden />
              Regulamin
            </span>
            <span className="text-zinc-400 text-lg">›</span>
          </button>
          <button
            type="button"
            onClick={() => toast('Polityka prywatności — treść wkrótce.')}
            className="flex w-full items-center justify-between gap-3 py-3.5 text-left transition-colors hover:bg-zinc-50/80 dark:hover:bg-white/[0.04]"
          >
            <span className="flex items-center gap-3 text-sm font-medium text-zinc-900 dark:text-white">
              <ShieldCheckIcon className="h-5 w-5 shrink-0 text-brand-gold dark:text-brand-gold-bright" aria-hidden />
              Polityka prywatności
            </span>
            <span className="text-zinc-400 text-lg">›</span>
          </button>
        </SectionCard>
      </div>
    </div>
  )
}
