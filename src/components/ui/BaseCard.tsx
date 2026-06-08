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
        // Light: navy outline + delikatny kremowy gradient (spójny z paletą logotypu).
        // Dark:  złoty ring + ciemny gradient z prześwitem `brand-gold/[0.07]`.
        'border-[#1e293b]/30 dark:border-[#D4AF37]/45',
        'bg-gradient-to-br from-zinc-50 via-[#1e293b]/[0.04] to-white ' +
          'dark:from-[#1a1508]/90 dark:via-[#D4AF37]/[0.07] dark:to-transparent',
        shadow.premium,
        'ring-1 ring-[#1e293b]/10 dark:ring-[#D4AF37]/20',
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
    // Hover spójny w obu trybach — w light wzmacnia navy ring, w dark złoty ring.
    return `${theme.transition.base} cursor-pointer hover:border-[#1e293b]/55 hover:ring-[#1e293b]/20 dark:hover:border-[#D4AF37]/60 dark:hover:ring-[#D4AF37]/40`
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
  const synchronizedThemeTransitionCls = theme.transition.base
  // Domyślnie karta nie narzuca paddingu — spacing kontrolują komponenty domenowe.
  const paddingCls = 'p-0'
  const composed = `${variantCls} ${paddingCls} ${synchronizedThemeTransitionCls} ${interactiveCls} ${className}`.replace(/\s+/g, ' ').trim()

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
