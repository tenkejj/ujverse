import { useMemo, useState, type FormEvent, type KeyboardEvent } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import {
  AtSign,
  Eye,
  EyeOff,
  Loader2,
  Lock,
  Mail,
  ShieldAlert,
  User,
} from 'lucide-react'
import { toast } from '../../lib/appToast'
import { supabase } from '../../supabaseClient.ts'
import { AUTH_MOBILE } from '../../styles/mobile-theme'

/** Wspólny styl pola tekstowego — eksportowany dla `ResetPassword`. */
export const authInputCls = AUTH_MOBILE.input.baseClass
const inputWithIconCls = authInputCls.replace('px-4', 'pl-11 pr-4')

const USERNAME_PATTERN = /^[a-z0-9._-]+$/i
type AuthView = 'login' | 'signup' | 'forgot'

const titleByView: Record<AuthView, string> = {
  login: 'Witaj ponownie',
  signup: 'Załóż konto',
  forgot: 'Odzyskaj hasło',
}

const subtitleByView: Record<AuthView, string> = {
  login: 'Zaloguj się, żeby wrócić do społeczności UJ',
  signup: 'Dołącz do społeczności UJverse w kilka sekund',
  forgot: 'Wyślemy Ci link do zmiany hasła',
}

export default function Login() {
  const reducedMotion = useReducedMotion()
  const [loading, setLoading] = useState(false)
  const [oauthLoading, setOauthLoading] = useState(false)
  const [view, setView] = useState<AuthView>('login')

  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [resetEmail, setResetEmail] = useState('')

  const [showPassword, setShowPassword] = useState(false)
  const [capsLockOn, setCapsLockOn] = useState(false)

  const usernameValid = useMemo(() => {
    const v = username.trim()
    if (!v) return true
    return USERNAME_PATTERN.test(v)
  }, [username])

  const passwordTooShort = view === 'signup' && password.length > 0 && password.length < 8

  const handlePasswordKeyEvent = (e: KeyboardEvent<HTMLInputElement>) => {
    setCapsLockOn(e.getModifierState?.('CapsLock') ?? false)
  }

  const handleLogin = async (e: FormEvent) => {
    e.preventDefault()
    setLoading(true)

    const trimmedUsername = username.trim()
    if (!trimmedUsername) {
      toast.error('Podaj nazwę użytkownika')
      setLoading(false)
      return
    }
    if (!USERNAME_PATTERN.test(trimmedUsername)) {
      toast.error('Nazwa użytkownika zawiera niedozwolone znaki')
      setLoading(false)
      return
    }

    const shadowEmail = `${trimmedUsername.toLowerCase()}@ujverse.test`
    const { error } = await supabase.auth.signInWithPassword({
      email: shadowEmail,
      password,
    })
    if (error) toast.error(error.message)

    setLoading(false)
  }

  const handleSignUp = async (e: FormEvent) => {
    e.preventDefault()
    setLoading(true)

    const trimmedUsername = username.trim()
    if (!trimmedUsername) {
      toast.error('Podaj nazwę użytkownika')
      setLoading(false)
      return
    }
    if (!USERNAME_PATTERN.test(trimmedUsername)) {
      toast.error('Nazwa użytkownika zawiera niedozwolone znaki')
      setLoading(false)
      return
    }
    if (password.length < 8) {
      toast.error('Hasło musi mieć co najmniej 8 znaków')
      setLoading(false)
      return
    }

    const shadowEmail = `${trimmedUsername.toLowerCase()}@ujverse.test`
    const { error } = await supabase.auth.signUp({
      email: shadowEmail,
      password,
    })
    if (error) toast.error(error.message)
    else toast.success('Sprawdź e-mail lub zaloguj się!')

    setLoading(false)
  }

  const handleGoogleLogin = async () => {
    setOauthLoading(true)
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: window.location.origin,
        queryParams: {
          hd: 'uj.edu.pl',
          prompt: 'select_account',
        },
      },
    })
    if (error) {
      toast.error('Logowanie Google nieudane: ' + error.message)
      setOauthLoading(false)
    }
  }

  const handleForgot = async (e: FormEvent) => {
    e.preventDefault()
    setLoading(true)
    const email = resetEmail.trim()
    if (!email) {
      toast.error('Podaj adres e-mail')
      setLoading(false)
      return
    }

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    })
    if (error) {
      toast.error(error.message)
    } else {
      toast.success('Email z linkiem został wysłany')
    }
    setLoading(false)
  }

  const formTransition = {
    duration: reducedMotion ? 0 : AUTH_MOBILE.motion.formTransition.duration,
  }

  return (
    <div className="w-full">
      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={`hdr-${view}`}
          initial={reducedMotion ? false : { opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={reducedMotion ? { opacity: 0 } : { opacity: 0, y: -6 }}
          transition={formTransition}
          className={AUTH_MOBILE.header.blockClass}
        >
          <h1 className={AUTH_MOBILE.header.titleClass}>
            {titleByView[view]}
          </h1>
          <p className={AUTH_MOBILE.header.subtitleClass}>
            {subtitleByView[view]}
          </p>
        </motion.div>
      </AnimatePresence>

      {view !== 'forgot' && (
        <div
          className={AUTH_MOBILE.tabs.rowClass}
          role="tablist"
          aria-label="Tryb autoryzacji"
        >
          {(['login', 'signup'] as const).map((id) => {
            const active = view === id
            return (
              <button
                key={id}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setView(id)}
                className={AUTH_MOBILE.tabs.tabClass}
              >
                {active && (
                  <motion.span
                    layoutId={AUTH_MOBILE.tabs.layoutId}
                    className={AUTH_MOBILE.tabs.pillClass}
                    transition={AUTH_MOBILE.motion.segmentSpring}
                  />
                )}
                <span
                  className={
                    'relative z-10 ' +
                    (active
                      ? AUTH_MOBILE.tabs.tabActiveClass
                      : AUTH_MOBILE.tabs.tabInactiveClass)
                  }
                >
                  {id === 'login' ? 'Logowanie' : 'Rejestracja'}
                </span>
              </button>
            )
          })}
        </div>
      )}

      <div className={AUTH_MOBILE.panel.className + ' w-full text-left'}>
      <AnimatePresence mode="wait" initial={false}>
        {view === 'forgot' ? (
          <motion.form
            key="form-forgot"
            onSubmit={handleForgot}
            className="text-left"
            initial={reducedMotion ? false : { opacity: 0, x: -8 }}
            animate={{ opacity: 1, x: 0 }}
            exit={reducedMotion ? { opacity: 0 } : { opacity: 0, x: 8 }}
            transition={formTransition}
          >
            <FieldLabel htmlFor="reset-email">Adres e-mail</FieldLabel>
            <div className="relative mb-2">
              <Mail size={18} className={AUTH_MOBILE.input.iconClass} />
              <input
                id="reset-email"
                type="email"
                className={inputWithIconCls}
                placeholder="ty@ujverse.test"
                value={resetEmail}
                onChange={(e) => setResetEmail(e.target.value)}
                required
                autoComplete="email"
              />
            </div>
            <p className="mb-6 text-xs text-zinc-500 dark:text-white/45">
              Konta UJverse mają adres w formacie{' '}
              <span className="font-medium text-zinc-700 dark:text-white/70">
                nazwa@ujverse.test
              </span>
              .
            </p>

            <SubmitButton loading={loading}>Wyślij link resetujący</SubmitButton>

            <div className="mt-6 text-left">
              <button
                type="button"
                onClick={() => {
                  setView('login')
                  setResetEmail('')
                }}
                className={AUTH_MOBILE.button.ghost}
              >
                Wróć do logowania
              </button>
            </div>
          </motion.form>
        ) : (
          <motion.form
            key={`form-${view}`}
            onSubmit={view === 'signup' ? handleSignUp : handleLogin}
            className="text-left"
            initial={reducedMotion ? false : { opacity: 0, x: 8 }}
            animate={{ opacity: 1, x: 0 }}
            exit={reducedMotion ? { opacity: 0 } : { opacity: 0, x: -8 }}
            transition={formTransition}
          >
            <FieldLabel htmlFor="auth-username">Nazwa użytkownika</FieldLabel>
            <div className="relative mb-2">
              <User size={18} className={AUTH_MOBILE.input.iconClass} />
              <input
                id="auth-username"
                type="text"
                className={inputWithIconCls}
                placeholder={view === 'signup' ? 'np. jan_kowalski' : 'Twój login'}
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                autoComplete="username"
                inputMode="text"
                pattern="[a-zA-Z0-9._\-]+"
              />
            </div>
            <p
              className={
                'mb-6 flex items-center gap-1.5 text-xs ' +
                (usernameValid
                  ? 'text-zinc-500 dark:text-white/45'
                  : 'text-rose-600 dark:text-rose-400')
              }
            >
              <AtSign size={12} className="shrink-0" />
              {usernameValid
                ? 'Dozwolone: litery, cyfry, kropki, myślniki, podkreślniki'
                : 'Niedozwolone znaki — użyj a-z, 0-9, kropki, myślnika lub podkreślnika'}
            </p>

            <FieldLabel htmlFor="auth-password">Hasło</FieldLabel>
            <div className="relative mb-2">
              <Lock size={18} className={AUTH_MOBILE.input.iconClass} />
              <input
                id="auth-password"
                type={showPassword ? 'text' : 'password'}
                className={inputWithIconCls + ' pr-11'}
                placeholder={view === 'signup' ? 'Min. 8 znaków' : 'Twoje hasło'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onKeyDown={handlePasswordKeyEvent}
                onKeyUp={handlePasswordKeyEvent}
                required
                minLength={view === 'signup' ? 8 : undefined}
                autoComplete={view === 'signup' ? 'new-password' : 'current-password'}
              />
              <button
                type="button"
                onClick={() => setShowPassword((s) => !s)}
                aria-label={showPassword ? 'Ukryj hasło' : 'Pokaż hasło'}
                className={AUTH_MOBILE.button.showPasswordClass}
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>

            <div className="mb-6 flex min-h-4 items-start justify-between gap-3">
              <div className="flex-1 space-y-1">
                <AnimatePresence>
                  {capsLockOn && (
                    <motion.p
                      key="caps"
                      initial={{ opacity: 0, y: -4 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -4 }}
                      className="flex items-center gap-1.5 text-xs font-medium text-amber-700 dark:text-amber-400"
                    >
                      <ShieldAlert size={12} className="shrink-0" />
                      Caps Lock jest włączony
                    </motion.p>
                  )}
                </AnimatePresence>
                {passwordTooShort && (
                  <p className="flex items-center gap-1.5 text-xs text-zinc-500 dark:text-white/45">
                    <Lock size={12} className="shrink-0" />
                    Jeszcze {8 - password.length}{' '}
                    {8 - password.length === 1 ? 'znak' : 'znaków'} do minimum
                  </p>
                )}
              </div>
              {view === 'login' && (
                <button
                  type="button"
                  onClick={() => setView('forgot')}
                  className={AUTH_MOBILE.button.forgotClass}
                >
                  Zapomniałeś hasła?
                </button>
              )}
            </div>

            <SubmitButton loading={loading}>
              {view === 'signup' ? 'Załóż konto' : 'Zaloguj się'}
            </SubmitButton>

            <div className="mt-6">
              <OrDivider />
              <GoogleAuthButton onClick={handleGoogleLogin} loading={oauthLoading} />
            </div>

            <div className="mt-6 text-left text-sm text-zinc-500 dark:text-white/55">
              {view === 'signup' ? 'Masz już konto?' : 'Nie masz jeszcze konta?'}{' '}
              <button
                type="button"
                onClick={() => setView((v) => (v === 'signup' ? 'login' : 'signup'))}
                className={AUTH_MOBILE.button.ghostStrong}
              >
                {view === 'signup' ? 'Zaloguj się' : 'Zarejestruj się'}
              </button>
            </div>
          </motion.form>
        )}
      </AnimatePresence>
      </div>
    </div>
  )
}

function FieldLabel({
  htmlFor,
  children,
}: {
  htmlFor: string
  children: React.ReactNode
}) {
  return (
    <label htmlFor={htmlFor} className={AUTH_MOBILE.input.labelClass}>
      {children}
    </label>
  )
}

function SubmitButton({
  loading,
  children,
}: {
  loading: boolean
  children: React.ReactNode
}) {
  return (
    <motion.button
      type="submit"
      disabled={loading}
      whileHover={loading ? undefined : { y: -1 }}
      whileTap={loading ? undefined : { scale: 0.99 }}
      className={AUTH_MOBILE.button.primary}
    >
      {loading ? (
        <>
          <Loader2 size={18} className="animate-spin" />
          <span>Proszę czekać…</span>
        </>
      ) : (
        children
      )}
    </motion.button>
  )
}

function GoogleAuthButton({
  onClick,
  loading,
}: {
  onClick: () => void
  loading: boolean
}) {
  return (
    <motion.button
      type="button"
      onClick={onClick}
      disabled={loading}
      whileHover={loading ? undefined : { y: -1 }}
      whileTap={loading ? undefined : { scale: 0.99 }}
      className={AUTH_MOBILE.button.oauth}
    >
      {loading ? (
        <>
          <Loader2 size={18} className="animate-spin text-zinc-500" />
          <span>Przekierowuję do Google…</span>
        </>
      ) : (
        <>
          <GoogleLogo />
          <span>Kontynuuj z Google</span>
        </>
      )}
    </motion.button>
  )
}

function GoogleLogo() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 18 18"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <path
        d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844a4.14 4.14 0 0 1-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.874 2.684-6.615z"
        fill="#4285F4"
      />
      <path
        d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z"
        fill="#34A853"
      />
      <path
        d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332z"
        fill="#FBBC05"
      />
      <path
        d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z"
        fill="#EA4335"
      />
    </svg>
  )
}

function OrDivider({ label = 'lub' }: { label?: string }) {
  return (
    <div className={AUTH_MOBILE.divider.wrapperClass} role="presentation">
      <span className={AUTH_MOBILE.divider.lineClass} />
      {label}
      <span className={AUTH_MOBILE.divider.lineClass} />
    </div>
  )
}
