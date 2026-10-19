/**
 * `VersuMark` — ikona Versusia (sowa), osobne assety light / dark.
 */

import { useTheme } from '../../ThemeContext'

export type VersuMarkVariant = 'brand' | 'onAccent'

type Props = {
  size: number
  className?: string
  variant?: VersuMarkVariant
}

const ASSETS = {
  light: '/versu-icon-light.png?v=7',
  dark: '/versu-icon-dark.png?v=7',
} as const

export default function VersuMark({
  size,
  className = '',
  variant = 'brand',
}: Props) {
  const { theme } = useTheme()
  // Kolory UJ to ciemny motyw — złota sowa (asset „dark”), nie granatowa z light.
  const src = theme === 'light' ? ASSETS.light : ASSETS.dark

  let imgClass = 'h-full w-full object-contain object-center'
  if (variant === 'onAccent') {
    imgClass += theme === 'light' ? ' invert' : ' brightness-0'
  }

  const ujPlate =
    theme === 'uj'
      ? 'rounded-full bg-[#0b1220]/90 ring-1 ring-[#cdb590]/45 shadow-[0_0_0_1px_rgb(0_81_158/0.25)]'
      : ''

  return (
    <span
      aria-hidden
      className={`relative inline-flex shrink-0 items-center justify-center ${ujPlate} ${className}`}
      style={{ width: size, height: size }}
    >
      <img
        key={src}
        src={src}
        alt=""
        draggable={false}
        decoding="async"
        className={imgClass}
      />
    </span>
  )
}
