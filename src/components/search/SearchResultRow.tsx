import BaseCard from '../ui/BaseCard'
import type { SearchHit } from '../../types/search'

type Props = {
  result: SearchHit
  onOpen: (result: SearchHit) => void
}

function stripHighlight(input: string): string {
  return input.replaceAll('<mark>', '').replaceAll('</mark>', '')
}

function typeLabel(type: SearchHit['type']): string {
  return type === 'post' ? 'Wpis' : 'Komunikat'
}

export default function SearchResultRow({ result, onOpen }: Props) {
  const snippet = stripHighlight(result._formatted?.content ?? result.content)
  const author = stripHighlight(result._formatted?.author ?? result.author)

  return (
    <BaseCard
      as="button"
      type="button"
      variant="inner"
      interactive
      onClick={() => onOpen(result)}
      className="w-full text-left"
    >
      <div className="flex items-start justify-between gap-3 px-4 py-3">
        <div className="min-w-0 flex-1">
          <p className="line-clamp-2 text-sm text-zinc-700 dark:text-zinc-200">{snippet}</p>
          <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">{author}</p>
        </div>
        <span className="shrink-0 rounded-full border border-zinc-300/80 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-zinc-600 dark:border-white/15 dark:text-zinc-300">
          {typeLabel(result.type)}
        </span>
      </div>
    </BaseCard>
  )
}
