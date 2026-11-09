/**
 * Mini-twarz Versusia w composerze / pickerze (owl PNG albo pixel face).
 */

import VersuMark from './VersuMark'
import type { VersusPortraitId } from '../../lib/versusPortrait'

type Props = {
  portrait: VersusPortraitId
  size?: number
  className?: string
}

export default function VersusPortraitFace({
  portrait,
  size = 28,
  className = '',
}: Props) {
  if (portrait === 'pixel') {
    return (
      <img
        src="/versus/face-idle.webp"
        alt=""
        width={size}
        height={size}
        draggable={false}
        decoding="async"
        className={`shrink-0 object-contain [image-rendering:pixelated] ${className}`}
        style={{ width: size, height: size }}
      />
    )
  }

  return <VersuMark size={size} className={className} />
}
