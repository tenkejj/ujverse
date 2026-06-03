import type { Profile } from '../types'
import UserAvatar from './UserAvatar'

/**
 * Greeting — mobile compose trigger.
 *
 * Wcześniej inline w `FeedView.tsx` (avatar + "Co słychać na uczelni?"),
 * wydzielony na życzenie taska, żeby placeholder żył w jednym miejscu
 * i nagłówek pozostał czysty (Header.tsx nigdy nie miał tego napisu).
 *
 * Konsument odpowiada za widoczność (`md:hidden` na poziomie FeedView),
 * tak żeby komponent dało się też wykorzystać poza mobile gdyby zaszła
 * potrzeba.
 */

type Props = {
  myProfile: Profile | null
  displayName: string
  onCompose?: () => void
  /** Tekst placeholdera. Domyślny zgodny z `ComposeBox`. */
  placeholder?: string
  className?: string
}

const BUTTON_CLS =
  'm-0 flex w-full min-w-0 items-center gap-3 rounded-xl px-0 py-2 text-left ' +
  'transition-colors hover:bg-black/[0.03] active:bg-black/[0.05] ' +
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1e293b]/20 ' +
  'dark:hover:bg-white/[0.04] dark:active:bg-white/[0.06] dark:focus-visible:ring-brand-gold/25'

const PLACEHOLDER_CLS =
  'min-w-0 flex-1 text-[15px] font-normal text-zinc-500 dark:text-zinc-400'

export default function Greeting({
  myProfile,
  displayName,
  onCompose,
  placeholder = 'Co słychać na uczelni?',
  className = '',
}: Props) {
  return (
    <button
      type="button"
      onClick={() => onCompose?.()}
      aria-label={placeholder}
      className={`${BUTTON_CLS} ${className}`.trim()}
    >
      <UserAvatar
        profile={myProfile}
        name={displayName}
        className="h-9 w-9 shrink-0"
        textSize="text-xs"
      />
      <span className={PLACEHOLDER_CLS}>{placeholder}</span>
    </button>
  )
}
