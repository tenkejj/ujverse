import { useEffect, useRef } from 'react'

export const REACTION_EMOJIS = ['👍', '❤️', '😂', '🎉', '🙏', '🔥', '😢', '👀'] as const

type Props = {
  onPick: (emoji: string) => void
  onClose: () => void
  /** Tailwind position klasy — rodzic decyduje gdzie zakotwiczyć. */
  positionClass?: string
}

export default function EmojiReactionPicker({
  onPick,
  onClose,
  positionClass = 'absolute -top-10 right-0',
}: Props) {
  const ref = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    const onDown = (e: MouseEvent | TouchEvent) => {
      if (!ref.current) return
      const target = e.target as Node
      if (!ref.current.contains(target)) onClose()
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        onClose()
      }
    }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('touchstart', onDown, { passive: true })
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('touchstart', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [onClose])

  return (
    <div
      ref={ref}
      role="menu"
      aria-label="Wybierz reakcję"
      className={`${positionClass} z-20 flex items-center gap-0.5 rounded-full border border-zinc-200 bg-white/95 px-1.5 py-1 shadow-[0_10px_30px_-12px_rgba(15,23,42,0.35)] backdrop-blur-md backdrop-saturate-150 dark:border-white/10 dark:bg-bg-card/95 dark:shadow-[0_10px_30px_-12px_rgba(0,0,0,0.8)]`}
    >
      {REACTION_EMOJIS.map((emoji) => (
        <button
          key={emoji}
          type="button"
          role="menuitem"
          onClick={() => {
            onPick(emoji)
            onClose()
          }}
          className="flex h-8 w-8 items-center justify-center rounded-full text-lg transition-transform hover:scale-125 hover:bg-black/[0.04] focus:outline-none focus:ring-2 focus:ring-[#1e293b]/40 dark:hover:bg-white/[0.06] dark:focus:ring-brand-gold-bright/50"
        >
          <span aria-hidden>{emoji}</span>
          <span className="sr-only">Reaguj: {emoji}</span>
        </button>
      ))}
    </div>
  )
}
