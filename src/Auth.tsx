import { useEffect } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import AuthShell from './components/auth/AuthShell'
import Login from './components/auth/Login.tsx'
import { sanitizeNextPath } from './lib/info/links'
import { rememberPostAuthPath } from './lib/info/postAuth'

/**
 * `/logowanie` — logowanie i rejestracja poza powłoką aplikacji.
 * `?next=` (tylko ścieżki wewnętrzne) wskazuje, dokąd wrócić po zalogowaniu;
 * zapisujemy go też w sessionStorage, bo OAuth wraca na `/`.
 */
export default function Auth() {
  const [params] = useSearchParams()
  const next = sanitizeNextPath(params.get('next'))
  const initialView = params.get('tryb') === 'rejestracja' ? 'signup' : 'login'

  useEffect(() => {
    rememberPostAuthPath(next)
  }, [next])

  return (
    <AuthShell
      footerSlot={
        <Link
          to={next ?? '/'}
          className="mt-6 inline-flex min-h-11 items-center gap-1.5 rounded-xl px-3 text-sm font-semibold text-brand-ink transition-colors hover:bg-black/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-ink/35 dark:text-brand-gold-bright dark:hover:bg-white/5 dark:focus-visible:ring-brand-gold/45"
        >
          <ArrowLeft size={16} aria-hidden />
          Przeglądaj bez konta
        </Link>
      }
    >
      <Login key={initialView} initialView={initialView} />
    </AuthShell>
  )
}
