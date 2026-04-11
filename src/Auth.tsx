import { useState, type FormEvent } from 'react'
import { motion } from 'framer-motion'
import { toast } from './lib/appToast'
import { supabase } from './supabaseClient.ts'

const inputCls =
  'w-full p-3 rounded-xl border border-white/10 bg-white/[0.03] text-white placeholder:text-white/40 outline-none ring-0 shadow-none transition-colors duration-200 focus:border-brand-gold-bright mb-4 caret-brand-gold-bright'

export default function Auth() {
  const [loading, setLoading] = useState(false)
  const [isSignUp, setIsSignUp] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')

  const handleAuth = async (e: FormEvent) => {
    e.preventDefault()
    setLoading(true)

    if (isSignUp) {
      const { error } = await supabase.auth.signUp({ email, password })
      if (error) toast.error(error.message)
      else toast.success('Sprawdź e-mail lub zaloguj się!')
    } else {
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) toast.error(error.message)
    }

    setLoading(false)
  }

  return (
    <div className="relative min-h-screen overflow-hidden bg-black bg-gradient-to-b from-black via-neutral-950 to-black flex items-center justify-center p-4">
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
            width: '8.5rem',
          }}
          className="mb-6 h-24 shrink-0 bg-brand-gold-bright drop-shadow-[0_0_24px_rgba(232,200,74,0.35)]"
        />

        <div className="w-full rounded-3xl border border-white/10 bg-white/5 p-8 text-center backdrop-blur-xl">
          <h1 className="text-2xl font-extrabold tracking-tight text-white">UJverse</h1>
          <p className="mt-2 text-sm text-white/80">
            {isSignUp ? 'Załóż konto' : 'Zaloguj się'}
          </p>

          <form onSubmit={handleAuth} className="mt-8 text-left">
            <input
              type="email"
              className={inputCls}
              placeholder="E-mail"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
              inputMode="email"
            />

            <input
              type="password"
              className={inputCls}
              placeholder="Hasło"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete={isSignUp ? 'new-password' : 'current-password'}
            />

            <motion.button
              type="submit"
              disabled={loading}
              whileHover={loading ? undefined : { y: -2 }}
              whileTap={loading ? undefined : { scale: 0.98 }}
              className="w-full rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 py-4 font-bold text-black shadow-none disabled:cursor-not-allowed disabled:opacity-70"
            >
              {loading ? 'Proszę czekać…' : isSignUp ? 'Zarejestruj się' : 'Zaloguj się'}
            </motion.button>

            <button
              type="button"
              onClick={() => setIsSignUp((v) => !v)}
              className="mt-4 w-full text-center text-sm text-white/60 underline underline-offset-4 transition-colors hover:text-white/90"
            >
              {isSignUp ? 'Masz konto? Zaloguj się' : 'Nie masz konta? Zarejestruj się'}
            </button>
          </form>
        </div>
      </motion.div>
    </div>
  )
}
