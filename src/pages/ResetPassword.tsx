import { useEffect, useState, type FormEvent, type KeyboardEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Eye, EyeOff, Loader2, Lock, ShieldAlert } from 'lucide-react'
import { toast } from '../lib/appToast'
import { supabase } from '../supabaseClient.ts'
import AuthShell from '../components/auth/AuthShell'
import { authInputCls } from '../components/auth/Login.tsx'
import { AUTH_MOBILE } from '../styles/mobile-theme'

const MIN_PASSWORD_LEN = 8

const inputWithIconCls = authInputCls.replace('px-3.5', 'pl-10 pr-3.5')

export default function ResetPassword() {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(false)
  const [sessionReady, setSessionReady] = useState(false)
  const [hasUser, setHasUser] = useState(false)
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [capsLockOn, setCapsLockOn] = useState(false)

  useEffect(() => {
    let cancelled = false

    const resolveSession = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (cancelled) return
      if (session?.user) {
        setHasUser(true)
        setSessionReady(true)
        return
      }
      await new Promise((r) => setTimeout(r, 400))
      const { data: { session: retry } } = await supabase.auth.getSession()
      if (cancelled) return
      setHasUser(Boolean(retry?.user))
      setSessionReady(true)
    }

    void resolveSession()
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (cancelled) return
      if (session?.user) {
        setHasUser(true)
        setSessionReady(true)
      }
    })
    return () => {
      cancelled = true
      subscription.unsubscribe()
    }
  }, [])

  const handleKey = (e: KeyboardEvent<HTMLInputElement>) => {
    setCapsLockOn(e.getModifierState?.('CapsLock') ?? false)
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (!hasUser) return

    if (password.length < MIN_PASSWORD_LEN) {
      toast.error(`Hasło musi mieć co najmniej ${MIN_PASSWORD_LEN} znaków.`)
      return
    }
    if (password !== confirmPassword) {
      toast.error('Hasła muszą być takie same.')
      return
    }

    setLoading(true)
    const { error } = await supabase.auth.updateUser({ password })
    setLoading(false)

    if (error) {
      toast.error(error.message)
      return
    }
    toast.success('Hasło zostało pomyślnie zmienione')
    navigate('/', { replace: true })
  }

  if (!sessionReady) {
    return (
      <AuthShell>
        <div className="flex items-center justify-center gap-2 py-6">
          <Loader2 size={18} className="animate-spin text-zinc-400 dark:text-white/40" />
          <p className="text-sm text-zinc-500 dark:text-white/55">Ładowanie…</p>
        </div>
      </AuthShell>
    )
  }

  if (!hasUser) {
    return (
      <AuthShell>
        <div className="w-full text-center">
          <h1 className={AUTH_MOBILE.header.titleClass}>
            Link wygasł lub jest nieprawidłowy
          </h1>
          <p className={AUTH_MOBILE.header.subtitleClass}>
            Poproś o nowy link resetujący na stronie logowania.
          </p>
          <button
            type="button"
            onClick={() => navigate('/', { replace: true })}
            className={AUTH_MOBILE.button.primary + ' mt-6'}
          >
            Wróć do logowania
          </button>
        </div>
      </AuthShell>
    )
  }

  const passwordsMismatch =
    confirmPassword.length > 0 && password !== confirmPassword
  const passwordTooShort = password.length > 0 && password.length < MIN_PASSWORD_LEN

  return (
    <AuthShell>
      <div className={AUTH_MOBILE.header.blockClass}>
        <h1 className={AUTH_MOBILE.header.titleClass}>
          Ustaw nowe hasło
        </h1>
        <p className={AUTH_MOBILE.header.subtitleClass}>
          Wpisz dwa razy nowe hasło dla swojego konta.
        </p>
      </div>

      <form onSubmit={handleSubmit} className={AUTH_MOBILE.panel.className + ' w-full text-left'}>
        <label
          htmlFor="reset-new-password"
          className={AUTH_MOBILE.input.labelClass}
        >
          Nowe hasło
        </label>
        <div className="relative mb-1.5">
          <Lock size={18} className={AUTH_MOBILE.input.iconClass} />
          <input
            id="reset-new-password"
            type={showPassword ? 'text' : 'password'}
            className={inputWithIconCls + ' pr-11'}
            placeholder={`Minimum ${MIN_PASSWORD_LEN} znaków`}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onKeyDown={handleKey}
            onKeyUp={handleKey}
            required
            minLength={MIN_PASSWORD_LEN}
            autoComplete="new-password"
          />
          <button
            type="button"
            onClick={() => setShowPassword((s) => !s)}
            aria-label={showPassword ? 'Ukryj hasło' : 'Pokaż hasło'}
            className={AUTH_MOBILE.button.showPasswordClass + ' right-2 p-1.5 min-h-0 min-w-0'}
          >
            {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
          </button>
        </div>
        <div className="mb-4 min-h-4 space-y-1">
          {capsLockOn && (
            <p className="flex items-center gap-1.5 text-xs font-medium text-amber-700 dark:text-amber-400">
              <ShieldAlert size={12} className="shrink-0" />
              Caps Lock jest włączony
            </p>
          )}
          {passwordTooShort && (
            <p className="flex items-center gap-1.5 text-xs text-zinc-500 dark:text-white/45">
              <Lock size={12} className="shrink-0" />
              Jeszcze {MIN_PASSWORD_LEN - password.length}{' '}
              {MIN_PASSWORD_LEN - password.length === 1 ? 'znak' : 'znaków'} do minimum
            </p>
          )}
        </div>

        <label
          htmlFor="reset-confirm-password"
          className={AUTH_MOBILE.input.labelClass}
        >
          Potwierdź hasło
        </label>
        <div className="relative mb-1.5">
          <Lock size={18} className={AUTH_MOBILE.input.iconClass} />
          <input
            id="reset-confirm-password"
            type={showConfirm ? 'text' : 'password'}
            className={inputWithIconCls + ' pr-11'}
            placeholder="Powtórz hasło"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            required
            autoComplete="new-password"
          />
          <button
            type="button"
            onClick={() => setShowConfirm((s) => !s)}
            aria-label={showConfirm ? 'Ukryj hasło' : 'Pokaż hasło'}
            className={AUTH_MOBILE.button.showPasswordClass + ' right-2 p-1.5 min-h-0 min-w-0'}
          >
            {showConfirm ? <EyeOff size={18} /> : <Eye size={18} />}
          </button>
        </div>
        <div className="mb-6 min-h-4">
          {passwordsMismatch && (
            <p className="flex items-center gap-1.5 text-xs text-rose-600 dark:text-rose-400">
              <ShieldAlert size={12} className="shrink-0" />
              Hasła muszą być takie same
            </p>
          )}
        </div>

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
            'Zapisz nowe hasło'
          )}
        </motion.button>
      </form>
    </AuthShell>
  )
}
