import { useState, type FormEvent } from 'react'
import { motion } from 'framer-motion'
import { toast } from '../../lib/appToast'
import { supabase } from '../../supabaseClient.ts'

export const authInputCls =
  'w-full p-3 rounded-xl border border-white/10 bg-white/[0.03] text-white placeholder:text-white/40 outline-none ring-0 shadow-none transition-colors duration-200 focus:border-brand-gold-bright mb-4 caret-brand-gold-bright'

type AuthView = 'login' | 'signup' | 'forgot'

export default function Login() {
  const [loading, setLoading] = useState(false)
  const [view, setView] = useState<AuthView>('login')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [resetEmail, setResetEmail] = useState('')

  const handleLogin = async (e: FormEvent) => {
    e.preventDefault()
    setLoading(true)

    const trimmedUsername = username.trim()
    if (!trimmedUsername) {
      toast.error('Podaj nazwę użytkownika')
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

    const shadowEmail = `${trimmedUsername.toLowerCase()}@ujverse.test`
    const { error } = await supabase.auth.signUp({
      email: shadowEmail,
      password,
    })
    if (error) toast.error(error.message)
    else toast.success('Sprawdź e-mail lub zaloguj się!')

    setLoading(false)
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

  const subtitle =
    view === 'forgot'
      ? 'Odzyskaj hasło'
      : view === 'signup'
        ? 'Załóż konto'
        : 'Zaloguj się'

  return (
    <>
      <h1 className="w-full text-center text-4xl font-extrabold tracking-tight text-white">
        UJverse
      </h1>
      <p className="mt-2 text-center text-sm text-white/80">{subtitle}</p>

      {view === 'forgot' ? (
        <form onSubmit={handleForgot} className="mt-8 w-full text-left">
          <input
            type="email"
            className={authInputCls}
            placeholder="Adres e-mail konta"
            value={resetEmail}
            onChange={(e) => setResetEmail(e.target.value)}
            required
            autoComplete="email"
          />
          <p className="mb-4 -mt-2 text-xs text-white/50">
            Dla kont UJverse wpisz adres w formacie{' '}
            <span className="text-white/70">nazwa@ujverse.test</span>.
          </p>

          <motion.button
            type="submit"
            disabled={loading}
            whileHover={loading ? undefined : { y: -2 }}
            whileTap={loading ? undefined : { scale: 0.98 }}
            className="w-full rounded-xl bg-[#C5A059] py-4 font-bold text-neutral-950 shadow-none transition-colors duration-200 hover:bg-[#A6864A] disabled:cursor-not-allowed disabled:opacity-70 disabled:hover:bg-[#C5A059]"
          >
            {loading ? 'Proszę czekać…' : 'Wyślij link resetujący'}
          </motion.button>

          <button
            type="button"
            onClick={() => { setView('login'); setResetEmail('') }}
            className="mt-4 w-full text-center text-sm text-white/60 underline underline-offset-4 transition-colors hover:text-white/90"
          >
            Wróć do logowania
          </button>
        </form>
      ) : (
        <form
          onSubmit={view === 'signup' ? handleSignUp : handleLogin}
          className="mt-8 w-full text-left"
        >
          <input
            type="text"
            className={authInputCls}
            placeholder="Nazwa użytkownika"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            required
            autoComplete="username"
          />

          <input
            type="password"
            className={authInputCls}
            placeholder="Hasło"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            autoComplete={view === 'signup' ? 'new-password' : 'current-password'}
          />

          {view === 'login' && (
            <div className="-mt-2 mb-4 text-right">
              <button
                type="button"
                onClick={() => setView('forgot')}
                className="text-sm text-white/60 underline underline-offset-4 transition-colors hover:text-white/90"
              >
                Zapomniałeś hasła?
              </button>
            </div>
          )}

          <motion.button
            type="submit"
            disabled={loading}
            whileHover={loading ? undefined : { y: -2 }}
            whileTap={loading ? undefined : { scale: 0.98 }}
            className="w-full rounded-xl bg-[#C5A059] py-4 font-bold text-neutral-950 shadow-none transition-colors duration-200 hover:bg-[#A6864A] disabled:cursor-not-allowed disabled:opacity-70 disabled:hover:bg-[#C5A059]"
          >
            {loading ? 'Proszę czekać…' : view === 'signup' ? 'Zarejestruj się' : 'Zaloguj się'}
          </motion.button>

          <button
            type="button"
            onClick={() => setView((v) => (v === 'signup' ? 'login' : 'signup'))}
            className="mt-4 w-full text-center text-sm text-white/60 underline underline-offset-4 transition-colors hover:text-white/90"
          >
            {view === 'signup' ? 'Masz konto? Zaloguj się' : 'Nie masz konta? Zarejestruj się'}
          </button>
        </form>
      )}
    </>
  )
}
