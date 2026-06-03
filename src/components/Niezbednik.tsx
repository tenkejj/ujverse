import { BookOpen, GraduationCap, Link2 as LinkIcon, Mail, type LucideIcon } from 'lucide-react'
import BaseCard from './ui/BaseCard'
import { sectionTitleCls, sidePanelHoverFocus, widgetGoldCls } from '../lib/sidePanelStyles'

/**
 * Niezbędnik UJ — desktopowa karta w prawym sidebarze feedu.
 *
 * Stałe linki do uczelnianych aplikacji (USOS / PEGAZ / Poczta). Mobilny
 * odpowiednik żyje teraz w `<MobileDashboard>` w jednym rzędzie razem ze
 * strefami — `NIEZBEDNIK_LINKS` jest reused przez ten komponent.
 */

type NiezbednikLink = {
  /** Pełna nazwa — używana w `panel` (desktop sidebar). */
  label: string
  /** Skrócona etykieta — używana w `<MobileDashboard>` (label hidden na <md). */
  shortLabel: string
  href: string
  Icon: LucideIcon
  tag: string
}

export const NIEZBEDNIK_LINKS: ReadonlyArray<NiezbednikLink> = [
  { label: 'USOSweb', shortLabel: 'USOS', href: 'https://usosweb.uj.edu.pl', Icon: GraduationCap, tag: 'Studia' },
  { label: 'Platforma PEGAZ', shortLabel: 'PEGAZ', href: 'https://pegaz.uj.edu.pl', Icon: BookOpen, tag: 'E-learning' },
  { label: 'Poczta studencka', shortLabel: 'POCZTA', href: 'https://outlook.office.com/mail/', Icon: Mail, tag: 'Poczta' },
] as const

type Props = {
  className?: string
}

const HEADER_CLS = 'mb-2 flex min-w-0 items-center gap-2'
const CARD_CLS = 'p-4 flex flex-col gap-4 shrink-0'
const ROW_CLS = `group m-0 w-full flex cursor-pointer items-start gap-2 p-2.5 shadow-none ${sidePanelHoverFocus}`

export default function Niezbednik({ className = '' }: Props) {
  return (
    <BaseCard variant="default" className={`${CARD_CLS} ${className}`.trim()}>
      <div className={HEADER_CLS}>
        <LinkIcon
          size={13}
          className={`${widgetGoldCls} shrink-0`}
          strokeWidth={2}
          aria-hidden
        />
        <span className={`${sectionTitleCls} min-w-0 flex-1`}>Niezbędnik UJ</span>
      </div>
      <div className="space-y-3">
        {NIEZBEDNIK_LINKS.map(({ label, href, Icon, tag }) => (
          <BaseCard
            key={label}
            as="a"
            variant="inner"
            flush
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            className={ROW_CLS}
          >
            <div className="shrink-0 flex w-12 items-center justify-center min-h-[36px]">
              <Icon
                size={18}
                className={`shrink-0 ${widgetGoldCls}`}
                strokeWidth={2}
                aria-hidden
              />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-bold text-[#1e293b] dark:text-white leading-snug truncate">
                {label}
              </p>
              <span className="text-xs text-zinc-500 dark:text-zinc-400">{tag}</span>
            </div>
          </BaseCard>
        ))}
      </div>
    </BaseCard>
  )
}
