import type { AnnouncementMeta, UnifiedContent } from '../../types/content'
import AnnouncementPills from '../AnnouncementPills'
import HorizontalPillScroller from '../ui/HorizontalPillScroller'

/**
 * MobileDashboard — cienki sticky-paskowy slot pod headerem (`<md`).
 *
 * Po refakcie nawigacji ten rząd ma JEDEN cel: pokazać poziomą listę
 * **pigułek komunikatów wykładowców** (`AnnouncementPills`). Wcześniej
 * mieszkały tu też quick-taby (Mój Plan / Zniżki / USOS / Miejsca / Aula),
 * Niezbędnik (PEGAZ / POCZTA / USOS-web) i Strefy — ale wszystko to żyje
 * teraz w `BottomNav` (Mój Plan) lub `MobileDrawer` (sekcje „Strefa
 * studenta", „Linki UJ", „Strefy"). Komunikaty wykładowców są jedyną
 * rzeczą, która NIE ma drugiego punktu wejścia na mobile, dlatego
 * zostają tutaj, na wiodącej pozycji nad filtrem wydziałów.
 *
 * Render używa tego samego scroll-trackera co `DepartmentFilter`
 * (`HorizontalPillScroller`) — single-line poziomy scroll + chevrony
 * po lewej/prawej gdy jest co przewinąć. `AnnouncementPills` w trybie
 * `inline` zwraca tylko same `<button>`-pigułki (i portalowy drawer),
 * więc mogą żyć jako bezpośrednie dzieci scroll-tracka.
 *
 * Gdy nie ma żadnego komunikatu i nic się nie ładuje, komponent NICZEGO
 * nie renderuje (zero pustego paska zajmującego miejsce).
 */

const WRAPPER_CLS = '-mx-4 px-4 py-1.5'

const SCROLL_TRACK_CLS =
  'm-0 flex w-full min-w-0 max-w-full flex-nowrap justify-start gap-1.5 ' +
  'overflow-x-auto overscroll-x-contain [touch-action:pan-x] ' +
  'scrollbar-hide scroll-smooth [-webkit-overflow-scrolling:touch] ' +
  '[-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden ' +
  'py-1 pl-0 pr-1'

type Props = {
  className?: string
  /** Komunikaty już przefiltrowane po wydziale (z `useAnnouncements`). */
  announcements: UnifiedContent<AnnouncementMeta>[]
  announcementsLoading: boolean
}

export default function MobileDashboard({
  className = '',
  announcements,
  announcementsLoading,
}: Props) {
  const hasContent = announcementsLoading || announcements.length > 0
  if (!hasContent) return null

  return (
    <div className={`${WRAPPER_CLS} ${className}`.trim()}>
      <HorizontalPillScroller
        scrollClassName={SCROLL_TRACK_CLS}
        watchDeps={[announcements.length, announcementsLoading]}
        scrollLeftLabel="Przewiń komunikaty w lewo"
        scrollRightLabel="Przewiń komunikaty w prawo"
        withMobileEdgeSpacer={false}
      >
        <AnnouncementPills
          inline
          announcements={announcements}
          loading={announcementsLoading}
        />
      </HorizontalPillScroller>
    </div>
  )
}
