import { useEffect, useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { toast } from '../lib/appToast'
import { supabase } from '../supabaseClient.ts'
import { authInputCls } from '../components/auth/Login.tsx'

const MIN_PASSWORD_LEN = 8

export default function ResetPassword() {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(false)
  const [sessionReady, setSessionReady] = useState(false)
  const [hasUser, setHasUser] = useState(false)
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')

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
      <div className="relative flex min-h-dvh flex-col items-center justify-center overflow-hidden bg-black bg-gradient-to-b from-black via-neutral-950 to-black p-4">
        <p className="text-sm text-white/70">Ładowanie…</p>
      </div>
    )
  }

  if (!hasUser) {
    return (
      <div className="relative flex min-h-dvh flex-col items-center justify-start overflow-hidden bg-black bg-gradient-to-b from-black via-neutral-950 to-black pt-[15vh] p-4">
        <div
          className="pointer-events-none absolute -left-1/4 top-1/4 h-[min(50vw,28rem)] w-[min(50vw,28rem)] rounded-full bg-amber-600/15 blur-[100px]"
          aria-hidden
        />
        <div className="relative z-10 w-full max-w-md rounded-3xl border border-[#C5A059]/30 bg-white/5 p-8 text-center backdrop-blur-xl">
          <h1 className="text-xl font-bold text-white">Link wygasł lub jest nieprawidłowy</h1>
          <p className="mt-2 text-sm text-white/70">
            Poproś o nowy link resetujący na stronie logowania.
          </p>
          <button
            type="button"
            onClick={() => navigate('/', { replace: true })}
            className="mt-6 w-full rounded-xl bg-[#C5A059] py-3 font-semibold text-neutral-950 transition-colors hover:bg-[#A6864A]"
          >
            Wróć do logowania
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="relative flex min-h-dvh flex-col items-center justify-start overflow-hidden bg-black bg-gradient-to-b from-black via-neutral-950 to-black pt-[15vh] p-4">
      <div
        className="pointer-events-none absolute -left-1/4 top-1/4 h-[min(50vw,28rem)] w-[min(50vw,28rem)] rounded-full bg-amber-600/15 blur-[100px]"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute -right-1/5 bottom-1/4 h-[min(45vw,24rem)] w-[min(45vw,24rem)] rounded-full bg-amber-900/25 blur-[100px]"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute left-1/2 top-1/2 h-64 w-64 -translate-x-1/2 -translate-y-1/2 rounded-full bg-amber-700/10 blur-3xl"
        aria-hidden
      />

      <motion.div
        className="relative z-10 flex w-full max-w-md flex-col items-center"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.55, ease: [0.16, 1, 0.3, 1] }}
      >
        <div
          aria-hidden
          style={{
            maskImage: 'url(/logo.png)',
            WebkitMaskImage: 'url(/logo.png)',
            maskSize: 'contain',
            WebkitMaskSize: 'contain',
            maskRepeat: 'no-repeat',
            WebkitMaskRepeat: 'no-repeat',
            maskPosition: 'center',
            WebkitMaskPosition: 'center',
            width: '14.5rem',
          }}
          className="mb-12 h-40 shrink-0 bg-[#C5A059] drop-shadow-[0_0_28px_rgba(197,160,89,0.45)]"
        />

        <div className="w-full rounded-3xl border border-[#C5A059]/30 bg-white/5 p-8 text-center backdrop-blur-xl">
          <h1 className="w-full text-center text-2xl font-extrabold tracking-tight text-white">
            Nowe hasło
          </h1>
          <p className="mt-2 text-center text-sm text-white/80">
            Ustaw nowe hasło dla swojego konta.
          </p>

          <form onSubmit={handleSubmit} className="mt-8 w-full text-left">
            <label className="mb-1 block text-xs font-medium text-white/60" htmlFor="reset-new-password">
              Nowe hasło
            </label>
            <input
              id="reset-new-password"
              type="password"
              className={authInputCls}
              placeholder={`Minimum ${MIN_PASSWORD_LEN} znaków`}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={MIN_PASSWORD_LEN}
              autoComplete="new-password"
            />

            <label className="mb-1 block text-xs font-medium text-white/60" htmlFor="reset-confirm-password">
              Potwierdź hasło
            </label>
            <input
              id="reset-confirm-password"
              type="password"
              className={authInputCls}
              placeholder="Powtórz hasło"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              autoComplete="new-password"
            />

            <motion.button
              type="submit"
              disabled={loading}
              whileHover={loading ? undefined : { y: -2 }}
              whileTap={loading ? undefined : { scale: 0.98 }}
              className="w-full rounded-xl bg-[#C5A059] py-4 font-bold text-neutral-950 shadow-none transition-colors duration-200 hover:bg-[#A6864A] disabled:cursor-not-allowed disabled:opacity-70 disabled:hover:bg-[#C5A059]"
            >
              {loading ? 'Proszę czekać…' : 'Zapisz nowe hasło'}
            </motion.button>
          </form>
        </div>
      </motion.div>
    </div>
  )
}
