/** Wspólny wygląd listy stref (sidebar + /group). */
import { sidePanelHoverFocus } from './sidePanelStyles'

/** Kontener listy w panelu — wiersze rozdzielone gap (1:1 jak `space-y-3` w Niezbędniku UJ). */
export const ZONES_LIST_PANEL_CLS = 'flex flex-col gap-0'

/** Kontener listy w wersji mobile rail — poziomy scroll. */
export const ZONES_LIST_RAIL_CLS = 'flex gap-3 overflow-x-auto -mx-0.5 px-0.5 pb-1'

/** Wiersz strefy — BaseCard variant="inner" już daje border + rounded-2xl. */
export const ZONE_ROW_CLS =
  `group m-0 w-full cursor-pointer p-3 text-left transition-colors ${sidePanelHoverFocus}`

export const ZONE_NAME_CLS =
  'min-w-0 flex-1 truncate text-sm font-semibold text-left text-[#1e293b] dark:text-white leading-snug'

export const ZONE_HASHTAG_CLS =
  'shrink-0 text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wide'
