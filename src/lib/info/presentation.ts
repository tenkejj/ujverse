import type { InfoAnnouncement } from './types'

/** Status comes from the source classifier; topics never replace a status. */
export function announcementPresentation(
  item: Pick<InfoAnnouncement, 'status' | 'title' | 'excerpt'>,
) {
  if (item.status === 'cancelled')
    return {
      tone: 'cancelled',
      label: 'Odwołane',
      icon: 'cancelled',
    } as const
  if (item.status === 'remote')
    return { tone: 'remote', label: 'Zajęcia zdalne', icon: 'remote' } as const
  if (item.status === 'duty')
    return { tone: 'duty', label: 'Dyżur', icon: 'duty' } as const
  if (item.status === 'event')
    return { tone: 'event', label: 'Wydarzenie', icon: 'event' } as const
  if (
    /stypendi|zapomog|pomoc\s+materialn/i.test(`${item.title} ${item.excerpt}`)
  ) {
    return {
      tone: 'scholarship',
      label: 'Stypendia i wsparcie',
      icon: 'scholarship',
    } as const
  }
  return { tone: 'info', label: null, icon: 'info' } as const
}
