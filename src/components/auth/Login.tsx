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

/**
 * Wspólny styl pola tekstowego — eksportowany dla `ResetPassword`.
 *
 * Frosted glass: pół-przezroczyste tło + backdrop-blur, żeby pola
 * były z tego samego materiału co karta AuthShell. Focus token-based:
 * navy w light, gold w dark.
 */
export const authInputCls =
  'w-full rounded-xl border px-3.5 py-3 text-base text-zinc-900 ' +
  'placeholder:text-zinc-400 outline-none transition-all duration-200 ' +
  'bg-white/60 backdrop-blur-md ' +
  'border-white/60 hover:border-zinc-300/70 ' +
  'focus:border-[#1e293b] focus:bg-white/85 ' +
  'caret-[#1e293b] ' +
  'shadow-[inset_0_1px_0_rgba(255,255,255,0.5)] ' +
  'dark:border-white/10 dark:bg-white/[0.04] dark:text-white ' +
  'dark:placeholder:text-white/30 dark:hover:border-white/15 ' +
  'dark:focus:border-brand-gold-bright dark:focus:bg-white/[0.06] ' +
  'dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] ' +
  'dark:caret-brand-gold-bright'

/** Wariant `authInputCls` z miejscem na ikonkę po lewej (pl-10). */
const inputWithIconCls = authInputCls.replace('px-3.5', 'pl-10 pr-3.5')

const primaryBtnCls =
  'group inline-flex w-full items-center justify-center gap-2 rounded-xl py-3.5 ' +
  'font-bold transition-all duration-200 disabled:cursor-not-allowed disabled:opacity-70 ' +
  'bg-[#1e293b] text-white hover:bg-[#172033] active:scale-[0.99] ' +
  'dark:bg-brand-gold-bright dark:text-black dark:hover:bg-[#f3d35f]'

const subtleLinkCls =
  'text-sm font-medium text-zinc-500 underline-offset-4 transition-colors ' +
  'hover:text-[#1e293b] hover:underline ' +
  'dark:text-white/55 dark:hover:text-brand-gold-bright'

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
    if (!v) return true // walidacja dopiero przy submit
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

  /**
   * Google OAuth flow:
   *   1. signInWithOAuth → browser redirect na consent screen Google
   *   2. Google redirect → Supabase callback URL → callback URL → tutaj
   *      z `code` w query lub `access_token` w hash
   *   3. Supabase JS auto-wymienia code i ustawia session (detectSessionInUrl)
   *   4. App.tsx widzi session → uruchamia domain guard (UJ-only)
   *
   * `hd=uj.edu.pl` to HINT dla Google żeby pokazać tylko UJ G Suite konta
   * w accountchooserze. To NIE jest zabezpieczenie — user może przeskoczyć
   * na osobiste @gmail.com. Twardy filtr robi App.tsx po stronie klienta
   * (`session.user.email` matchowane regexem UJ).
   *
   * `redirectTo: window.location.origin` → wracamy na root, nie na
   * `/login` (którego nie ma — Login renderowany w App.tsx gdy brak session).
   */
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
    // Sukces → browser redirectuje, setOauthLoading(false) nie potrzebny.
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

  return (
    <div className="w-full">
      {/* Segmented switch login ↔ signup (chowamy w widoku „forgot") */}
      {view !== 'forgot' && (
        <div
          className={
            'relative grid grid-cols-2 rounded-full p-1 mb-6 ' +
            'bg-white/45 backdrop-blur-md border border-white/60 ' +
            'shadow-[inset_0_1px_0_rgba(255,255,255,0.5)] ' +
            'dark:bg-white/4 dark:border-white/5 ' +
            'dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]'
          }
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
                className="relative z-10 rounded-full py-2.5 text-sm font-semibold focus:outline-none"
              >
                {active && (
                  <motion.span
                    layoutId="auth-segment-pill"
                    className={
                      'absolute inset-0 -z-10 rounded-full ' +
                      'bg-[#1e293b] dark:bg-brand-gold-bright ' +
                      'shadow-[0_4px_12px_-4px_rgba(15,23,42,0.4)] ' +
                      'dark:shadow-[0_4px_12px_-4px_rgba(232,200,74,0.4)]'
                    }
                    transition={{ type: 'spring', damping: 30, stiffness: 350 }}
                  />
                )}
                <span
                  className={
                    active
                      ? 'text-white dark:text-black'
                      : 'text-zinc-500 dark:text-white/55'
                  }
                >
                  {id === 'login' ? 'Logowanie' : 'Rejestracja'}
                </span>
              </button>
            )
          })}
        </div>
      )}

      {/* Tytuł + podtytuł */}
      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={`hdr-${view}`}
          initial={reducedMotion ? false : { opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={reducedMotion ? { opacity: 0 } : { opacity: 0, y: -6 }}
          transition={{ duration: reducedMotion ? 0 : 0.18 }}
          className="mb-6 text-center"
        >
          <h1 className="text-2xl font-extrabold tracking-tight text-[#1e293b] dark:text-white">
            {titleByView[view]}
          </h1>
          <p className="mt-1.5 text-sm text-zinc-500 dark:text-white/55">
            {subtitleByView[view]}
          </p>
        </motion.div>
      </AnimatePresence>

      {/* Formularze */}
      <AnimatePresence mode="wait" initial={false}>
        {view === 'forgot' ? (
          <motion.form
            key="form-forgot"
            onSubmit={handleForgot}
            className="text-left"
            initial={reducedMotion ? false : { opacity: 0, x: -8 }}
            animate={{ opacity: 1, x: 0 }}
            exit={reducedMotion ? { opacity: 0 } : { opacity: 0, x: 8 }}
            transition={{ duration: reducedMotion ? 0 : 0.18 }}
          >
            <FieldLabel htmlFor="reset-email">Adres e-mail</FieldLabel>
            <div className="relative mb-2">
              <Mail
                size={18}
                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400 dark:text-white/35"
              />
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

            <div className="mt-5 text-center">
              <button
                type="button"
                onClick={() => {
                  setView('login')
                  setResetEmail('')
                }}
                className={subtleLinkCls}
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
            transition={{ duration: reducedMotion ? 0 : 0.18 }}
          >
            <FieldLabel htmlFor="auth-username">Nazwa użytkownika</FieldLabel>
            <div className="relative mb-1.5">
              <User
                size={18}
                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400 dark:text-white/35"
              />
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
                'mb-5 flex items-center gap-1.5 text-xs ' +
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
            <div className="relative mb-1.5">
              <Lock
                size={18}
                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400 dark:text-white/35"
              />
              <input
                id="auth-password"
                type={showPassword ? 'text' : 'password'}
                className={inputWithIconCls + ' pr-12'}
                placeholder={
                  view === 'signup' ? 'Min. 8 znaków' : 'Twoje hasło'
                }
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onKeyDown={handlePasswordKeyEvent}
                onKeyUp={handlePasswordKeyEvent}
                required
                minLength={view === 'signup' ? 8 : undefined}
                autoComplete={
                  view === 'signup' ? 'new-password' : 'current-password'
                }
              />
              <button
                type="button"
                onClick={() => setShowPassword((s) => !s)}
                aria-label={showPassword ? 'Ukryj hasło' : 'Pokaż hasło'}
                className={
                  'absolute right-1 top-1/2 -translate-y-1/2 rounded-lg p-2.5 ' +
                  'text-zinc-400 transition-colors hover:text-[#1e293b] ' +
                  'dark:text-white/40 dark:hover:text-brand-gold-bright'
                }
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>

            {/* Hinty pod hasłem (caps lock / za krótkie hasło / forgot link) */}
            <div className="mb-5 flex min-h-4 items-start justify-between gap-3">
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
                  className={
                    'shrink-0 -my-1.5 -mr-1.5 rounded-lg px-1.5 py-1.5 ' +
                    'text-xs font-semibold text-zinc-500 transition-colors ' +
                    'hover:text-[#1e293b] dark:text-white/55 ' +
                    'dark:hover:text-brand-gold-bright'
                  }
                >
                  Zapomniałeś hasła?
                </button>
              )}
            </div>

            <SubmitButton loading={loading}>
              {view === 'signup' ? 'Załóż konto' : 'Zaloguj się'}
            </SubmitButton>

            {/* Google jako *alternatywa*, nie default — pod formularzem,
                z separatorem „lub kontynuuj z". Konsekwentnie z apkami
                które stawiają email na 1. miejscu (Reddit, Discord). */}
            <div className="mt-5">
              <OrDivider />
              <GoogleAuthButton onClick={handleGoogleLogin} loading={oauthLoading} />
            </div>

            <div className="mt-5 text-center text-sm text-zinc-500 dark:text-white/55">
              {view === 'signup' ? 'Masz już konto?' : 'Nie masz jeszcze konta?'}{' '}
              <button
                type="button"
                onClick={() =>
                  setView((v) => (v === 'signup' ? 'login' : 'signup'))
                }
                className="font-semibold text-[#1e293b] underline-offset-4 transition-colors hover:underline dark:text-brand-gold-bright"
              >
                {view === 'signup' ? 'Zaloguj się' : 'Zarejestruj się'}
              </button>
            </div>
          </motion.form>
        )}
      </AnimatePresence>
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
    <label
      htmlFor={htmlFor}
      className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-white/55"
    >
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
      className={primaryBtnCls}
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

/**
 * Przycisk OAuth — Google. Świadomie BIAŁY w obu motywach (zgodne z
 * Google Brand Guidelines dla third-party sign-in), z oficjalnym
 * kolorowym G-logo wbudowanym SVG (zero zewnętrznych deps i 0 round-trip).
 */
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
      className={
        'group inline-flex w-full items-center justify-center gap-2.5 ' +
        'rounded-xl border bg-white py-3 font-semibold text-zinc-800 ' +
        'shadow-sm transition-all duration-200 ' +
        'border-zinc-200 hover:bg-zinc-50 hover:border-zinc-300 ' +
        'disabled:cursor-not-allowed disabled:opacity-70 ' +
        'dark:border-white/10 dark:bg-white dark:text-zinc-900 ' +
        'dark:hover:bg-zinc-50 dark:hover:border-zinc-200'
      }
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

/** Oficjalne kolorowe „G" Google — SVG inline (zero deps). */
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

/** Separator „lub" między formularzem (email+hasło) a OAuth fallbackiem. */
function OrDivider({ label = 'lub' }: { label?: string }) {
  return (
    <div
      className="mb-4 flex items-center gap-3 text-xs font-medium uppercase tracking-wider text-zinc-400 dark:text-white/40"
      role="presentation"
    >
      <span className="h-px flex-1 bg-zinc-200 dark:bg-white/10" />
      {label}
      <span className="h-px flex-1 bg-zinc-200 dark:bg-white/10" />
    </div>
  )
}
