export type ProfileTab = 'posts' | 'replies' | 'events' | 'media'

export const TAB_ITEMS: { id: ProfileTab; label: string }[] = [
  { id: 'posts', label: 'Wpisy' },
  { id: 'replies', label: 'Odpowiedzi' },
  { id: 'events', label: 'Wydarzenia' },
  { id: 'media', label: 'Multimedia' },
]
