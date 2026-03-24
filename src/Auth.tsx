import { useState, type FormEvent } from 'react'
import { toast } from 'react-hot-toast'
import { supabase } from './supabaseClient.ts'

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
    <div className="min-h-screen flex items-center justify-center bg-[#002147] p-4">
      <div className="bg-white p-8 rounded-3xl shadow-2xl w-full max-w-md text-center">
        <h1 className="text-slate-900 text-3xl font-extrabold tracking-tight">UJverse</h1>
        <p className="text-slate-900 mt-2 text-sm">{isSignUp ? 'Załóż konto' : 'Zaloguj się'}</p>

        <form onSubmit={handleAuth} className="mt-8">
          <input
            type="email"
            className="w-full p-3 rounded-xl border border-slate-200 bg-slate-50 text-black mb-4"
            placeholder="E-mail"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoComplete="email"
            inputMode="email"
          />

          <input
            type="password"
            className="w-full p-3 rounded-xl border border-slate-200 bg-slate-50 text-black mb-4"
            placeholder="Hasło"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            autoComplete={isSignUp ? 'new-password' : 'current-password'}
          />

          <button
            disabled={loading}
            className="w-full py-4 bg-[#D4AF37] text-[#002147] font-bold rounded-xl hover:scale-[1.02] transition-transform disabled:opacity-70 disabled:hover:scale-100"
          >
            {loading ? 'Proszę czekać…' : isSignUp ? 'Zarejestruj się' : 'Zaloguj się'}
          </button>

          <button
            type="button"
            onClick={() => setIsSignUp((v) => !v)}
            className="mt-4 text-sm text-slate-700 hover:text-slate-900 underline underline-offset-4"
          >
            {isSignUp ? 'Masz konto? Zaloguj się' : 'Nie masz konta? Zarejestruj się'}
          </button>
        </form>
      </div>
    </div>
  )
}