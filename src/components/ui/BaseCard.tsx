import {
  forwardRef,
  type ComponentPropsWithoutRef,
  type ComponentPropsWithRef,
  type ElementType,
  type ForwardedRef,
  type ReactElement,
  type ReactNode,
} from 'react'
import { theme } from '../../styles/theme'

/**
 * BaseCard — fundament wszystkich kart w UJverse.
 *
 * Wszystkie widżety (Komunikat, Klub, Post, Event) opakowują treść w BaseCard
 * zamiast powielać klasy border/radius/bg. Tokeny z `src/styles/theme.ts`.
 *
 * Warianty:
 *  - default — zewnętrzna karta sekcji (glass, subtle border).
 *  - inner   — wiersz wewnątrz sekcji (mocniejsze czarne tło).
 *  - premium — oficjalne wydarzenia: gradient + złota aureola + ring.
 *
 * `interactive=true` dodaje hover złotej krawędzi + goldGlow + cursor-pointer.
 */

export type BaseCardVariant = 'default' | 'inner' | 'premium'

type BaseCardOwnProps = {
  variant?: BaseCardVariant
  interactive?: boolean
  /** Kiedy true, karta renderuje się bez paddingu — np. jeśli treść sama steruje odstępami. */
  flush?: boolean
  className?: string
  children?: ReactNode
}

type BaseCardProps<T extends ElementType> = BaseCardOwnProps &
  Omit<ComponentPropsWithoutRef<T>, keyof BaseCardOwnProps | 'as'> & {
    as?: T
  }

type BaseCardComponent = <T extends ElementType = 'div'>(
  props: BaseCardProps<T> & { ref?: ComponentPropsWithRef<T>['ref'] },
) => ReactElement | null

function variantClasses(variant: BaseCardVariant): string {
  const { colors, radius, shadow } = theme
  switch (variant) {
    case 'inner':
      return [
        radius.card,
        colors.border.base,
        colors.surface.inner,
        colors.surface.glass,
        'border',
      ].join(' ')
    case 'premium':
      return [
        radius.card,
        'border',
        colors.border.gold,
        'bg-gradient-to-br from-[#1a1508]/90 via-[#D4AF37]/[0.06] to-transparent',
        shadow.premium,
        'ring-1 ring-[#D4AF37]/20',
        colors.surface.glass,
      ].join(' ')
    case 'default':
    default:
      return [
        radius.card,
        'border',
        colors.border.base,
        colors.surface.base,
        colors.surface.glass,
        shadow.card,
      ].join(' ')
  }
}

function interactiveClasses(variant: BaseCardVariant): string {
  if (variant === 'inner') {
    return `${theme.transition.base} hover:border-[#D4AF37]/45 cursor-pointer`
  }
  const base = `${theme.transition.base} hover:border-[#D4AF37]/45 hover:${theme.shadow.goldGlow} cursor-pointer`
  if (variant === 'premium') {
    return `${theme.transition.base} hover:ring-[#D4AF37]/40 hover:border-[#D4AF37]/60 cursor-pointer`
  }
  return base
}

function BaseCardInner(
  {
    as,
    variant = 'default',
    interactive = false,
    flush = false,
    className = '',
    children,
    ...rest
  }: BaseCardProps<ElementType>,
  ref: ForwardedRef<Element>,
) {
  const Component = (as ?? 'div') as ElementType
  const variantCls = variantClasses(variant)
  const interactiveCls = interactive ? interactiveClasses(variant) : ''
  // Domyślnie karta nie narzuca paddingu — spacing kontrolują komponenty domenowe.
  const paddingCls = 'p-0'
  const composed = `${variantCls} ${paddingCls} ${interactiveCls} ${className}`.replace(/\s+/g, ' ').trim()

  return (
    <Component ref={ref} className={composed} {...rest}>
      {children}
    </Component>
  )
}

/**
 * Polimorficzny komponent z `as`. Forwardowanie ref dla framer-motion / buttonów.
 */
const BaseCard = forwardRef(BaseCardInner) as BaseCardComponent

export default BaseCard
