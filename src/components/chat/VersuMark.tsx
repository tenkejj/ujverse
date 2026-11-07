/** Original Versuś mascot, with a quieter static image for reduced motion. */

export type VersuMarkVariant = 'brand' | 'onAccent'

type Props = {
  size: number
  className?: string
  variant?: VersuMarkVariant
}

export default function VersuMark({
  size,
  className = '',
  variant = 'brand',
}: Props) {
  // The portrait keeps the face legible in the chat's smaller avatars.
  const asset = size < 72 ? 'face' : 'idle'
  const source = `/versus/${asset}`

  return (
    <span
      aria-hidden="true"
      data-variant={variant}
      className={`relative inline-flex shrink-0 items-center justify-center ${className}`}
      style={{ width: size, height: size }}
    >
      <picture className="block h-full w-full">
        <source
          media="(prefers-reduced-motion: reduce)"
          srcSet={`${source}.png`}
        />
        <source type="image/webp" srcSet={`${source}.webp`} />
        <img
          src={`${source}.gif`}
          alt=""
          width={size}
          height={size}
          draggable={false}
          decoding="async"
          className="h-full w-full object-contain object-center"
        />
      </picture>
    </span>
  )
}
