import { Layers } from 'lucide-react'
import { STREFY_SECTION_LABEL } from '../lib/channelPresentation'

type Props = {
  className?: string
}

/** Nagłówek — identyczny styl jak „Niezbędnik UJ”. */
export default function StrefySectionHeader({ className = '' }: Props) {
  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <Layers
        size={13}
        className="text-zone-accent-strong shrink-0"
        strokeWidth={2}
        aria-hidden
      />
      <span className="text-xs font-bold tracking-wider uppercase text-zone-accent-strong">
        {STREFY_SECTION_LABEL}
      </span>
    </div>
  )
}
