export type ProfileTab = 'posts' | 'replies' | 'events' | 'media' | 'achievements'

export const TAB_ITEMS: { id: ProfileTab; label: string }[] = [
  { id: 'posts', label: 'Wpisy' },
  { id: 'replies', label: 'Odpowiedzi' },
  { id: 'events', label: 'Wydarzenia' },
  { id: 'media', label: 'Multimedia' },
  { id: 'achievements', label: 'Odznaki' },
]
