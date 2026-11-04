import { Link } from 'react-router-dom'
import { Lock } from 'lucide-react'
import BaseCard from '../ui/BaseCard'
import { theme } from '../../styles/theme'
import { loginPathFor } from '../../lib/info/postAuth'
import { FOCUS_RING } from './infoUi'
import type { ProtectedFeatureCopy } from './protectedFeatures'

export default function AuthRequired({ copy, nextPath }: { copy: ProtectedFeatureCopy; nextPath: string }) {
  return (
    <div className="mx-auto w-full max-w-xl py-4 sm:py-8">
      <BaseCard variant="default" className="p-6 text-center sm:p-8">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full border border-brand-ink/20 bg-brand-ink/[0.06] text-brand-ink dark:border-brand-gold-bright/30 dark:bg-brand-gold-bright/[0.08] dark:text-brand-gold-bright">
          <Lock size={22} aria-hidden />
        </div>
        <h1 className="text-lg font-bold text-zinc-900 dark:text-zinc-50">{copy.feature} — potrzebne konto</h1>
        <p className="mx-auto mt-2 max-w-md text-sm text-zinc-600 dark:text-zinc-400">{copy.reason}</p>
        <div className="mt-5 flex flex-wrap justify-center gap-2">
          <Link to={loginPathFor(nextPath)} className={`${theme.button.primary} min-h-11 px-5 text-sm ${FOCUS_RING}`}>
            Zaloguj się
          </Link>
          <Link to={loginPathFor(nextPath, 'signup')} className={`${theme.button.outline} min-h-11 px-5 text-sm ${FOCUS_RING}`}>
            Załóż konto
          </Link>
        </div>
        <p className="mt-6 text-xs text-zinc-500 dark:text-zinc-400">
          Komunikaty, rejestracje i wydarzenia są dostępne bez konta.{' '}
          <Link
            to={copy.alternative?.to ?? '/'}
            className="font-semibold text-brand-ink underline-offset-2 hover:underline dark:text-brand-gold-bright"
          >
            {copy.alternative?.label ?? 'Wróć do strony startowej'}
          </Link>
        </p>
      </BaseCard>
    </div>
  )
}
