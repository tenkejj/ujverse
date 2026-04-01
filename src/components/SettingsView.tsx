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
import { toast } from 'react-hot-toast'
import { useTheme } from '../ThemeContext'

type Props = {
  email: string | undefined
  onBack: () => void
}

const settingsActionBtnClass =
  'shrink-0 rounded-full border border-slate-200/90 bg-white px-4 py-1 text-sm font-medium text-amber-600 transition-all hover:bg-slate-50 dark:border-amber-500/40 dark:bg-slate-950 dark:text-amber-400 dark:hover:border-amber-400/55 dark:hover:bg-slate-900'

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
      className={`relative h-7 w-12 shrink-0 rounded-full transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-[#ffa000]/50 ${
        enabled
          ? 'bg-[#ffa000] shadow-[0_0_10px_rgba(245,158,11,0.3)]'
          : 'bg-slate-300 shadow-none dark:bg-slate-600'
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
    <section className="mb-4 rounded-2xl bg-white p-4 shadow-sm last:mb-0 dark:bg-slate-900/50">
      <div className="mb-3 flex items-center gap-2">
        <Icon className="h-5 w-5 shrink-0 text-amber-500" aria-hidden />
        <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-900 opacity-70 dark:text-white">
          {title}
        </h2>
      </div>
      <div className="divide-y divide-slate-200/70 dark:divide-slate-700/50">{children}</div>
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
      className={`flex items-center justify-between gap-3 py-3.5 transition-colors first:pt-0 last:pb-0 hover:bg-slate-50/80 dark:hover:bg-white/[0.04] ${className}`}
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
    'w-full rounded-xl border border-[#1c2b4e] bg-[#f8fafc] p-3 text-slate-900 outline-none placeholder:text-slate-400 focus:border-[#ffa000] dark:bg-[#01020a] dark:text-white dark:placeholder:text-neutral-500'

  return (
    <div className="min-h-[50vh] space-y-5 bg-[#f8fafc] dark:bg-[#01020a] -mx-4 px-4 py-2 md:mx-0 md:rounded-2xl md:px-0 md:bg-transparent dark:md:bg-transparent">
      <div className="flex items-center gap-3 pt-1">
        <button
          type="button"
          onClick={onBack}
          className="flex items-center gap-2 rounded-xl px-2 py-2 text-sm font-bold text-slate-600 transition-colors hover:bg-white/5 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white"
          aria-label="Wróć"
        >
          <ArrowLeftIcon className="h-6 w-6 shrink-0 text-[#ffa000]" aria-hidden />
          <span>Wróć</span>
        </button>
        <h1 className="text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white">
          Ustawienia
        </h1>
      </div>

      <div className="pb-8">
        <SectionCard title="Konto" icon={UserCircleIcon}>
          <Row>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                E-mail
              </p>
              <p className="mt-1 flex items-center gap-2 truncate text-sm font-medium text-slate-900 dark:text-white">
                <EnvelopeIcon className="h-4 w-4 shrink-0 text-[#ffa000]" aria-hidden />
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
                <KeyIcon className="h-5 w-5 shrink-0 text-[#ffa000]" aria-hidden />
                <span className="text-sm font-semibold text-slate-900 dark:text-white">Zmiana hasła</span>
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
                className="space-y-3 border-t border-slate-200/70 py-4 dark:border-slate-700/50"
              >
                <label className="block">
                  <span className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-400">
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
                  <span className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-400">
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
                  <span className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-400">
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
                  className="w-full rounded-xl bg-[#ffa000] py-2.5 text-sm font-bold text-black transition-opacity hover:opacity-90"
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
                <MoonIcon className="h-5 w-5 shrink-0 text-[#ffa000]" aria-hidden />
              ) : (
                <SunIcon className="h-5 w-5 shrink-0 text-[#ffa000]" aria-hidden />
              )}
              <div>
                <p className="text-sm font-semibold text-slate-900 dark:text-white">Motyw</p>
                <p className="text-xs text-slate-500 dark:text-slate-400">
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
              <MagnifyingGlassIcon className="h-5 w-5 shrink-0 text-[#ffa000]" aria-hidden />
              <span className="text-sm font-medium text-slate-900 dark:text-white">
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
              <AcademicCapIcon className="h-5 w-5 shrink-0 text-[#ffa000]" aria-hidden />
              <span className="text-sm font-medium text-slate-900 dark:text-white">
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
              <InformationCircleIcon className="h-5 w-5 text-[#ffa000]" aria-hidden />
              <span className="text-sm text-slate-600 dark:text-slate-300">Wersja aplikacji</span>
            </div>
            <span className="text-sm font-mono font-semibold text-slate-900 dark:text-white sm:text-right">
              v1.0.4-beta
            </span>
          </Row>
          <button
            type="button"
            onClick={() => toast('Regulamin — treść wkrótce.')}
            className="flex w-full items-center justify-between gap-3 py-3.5 text-left transition-colors hover:bg-slate-50/80 dark:hover:bg-white/[0.04]"
          >
            <span className="flex items-center gap-3 text-sm font-medium text-slate-900 dark:text-white">
              <DocumentTextIcon className="h-5 w-5 shrink-0 text-[#ffa000]" aria-hidden />
              Regulamin
            </span>
            <span className="text-slate-400 text-lg">›</span>
          </button>
          <button
            type="button"
            onClick={() => toast('Polityka prywatności — treść wkrótce.')}
            className="flex w-full items-center justify-between gap-3 py-3.5 text-left transition-colors hover:bg-slate-50/80 dark:hover:bg-white/[0.04]"
          >
            <span className="flex items-center gap-3 text-sm font-medium text-slate-900 dark:text-white">
              <ShieldCheckIcon className="h-5 w-5 shrink-0 text-[#ffa000]" aria-hidden />
              Polityka prywatności
            </span>
            <span className="text-slate-400 text-lg">›</span>
          </button>
        </SectionCard>
      </div>
    </div>
  )
}
