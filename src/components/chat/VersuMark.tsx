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
  const src = theme === 'dark' ? ASSETS.dark : ASSETS.light

  let imgClass = 'h-full w-full object-contain object-center'
  if (variant === 'onAccent') {
    imgClass += theme === 'dark' ? ' brightness-0' : ' invert'
  }

  return (
    <span
      aria-hidden
      className={`relative inline-block shrink-0 ${className}`}
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
