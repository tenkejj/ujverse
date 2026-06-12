import {
  createElement,
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
 *  - premium — oficjalne wydarzenia: gradient + akcent + ring.
 *
 * `interactive=true` dodaje hover akcentu krawędzi + cardGlow + cursor-pointer.
 * Kolor akcentu jest świadomy trybu: navy (`#1e293b`) w light, gold w dark.
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
        // Light: navy outline + delikatny gradient zinc (czyste, bez kremowości).
        // Dark:  złoty ring + neutralna ciemna powierzchnia (bez brunatnego
        //        `#1a1508` "sepia" tinta, który czytał się jak krem na ciemnym tle).
        //        Premium-akcent niesie WYŁĄCZNIE border + ring + shadow.premium.
        'border-[#1e293b]/30 dark:border-[#D4AF37]/45',
        'bg-gradient-to-br from-zinc-50 via-[#1e293b]/[0.04] to-white ' +
          'dark:from-zinc-950/70 dark:via-zinc-950/55 dark:to-zinc-950/40',
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
  // Hover-akcent krawędzi: navy w light, gold w dark — spójnie dla wszystkich
  // wariantów. Wcześniej `hover:border-[#D4AF37]/45` (gold) leciał też w light.
  const accentBorderHover =
    'hover:border-[#1e293b]/45 dark:hover:border-[#D4AF37]/45'

  if (variant === 'inner') {
    return `${theme.transition.base} ${accentBorderHover} cursor-pointer`
  }
  if (variant === 'premium') {
    return `${theme.transition.base} cursor-pointer hover:border-[#1e293b]/55 hover:ring-[#1e293b]/20 dark:hover:border-[#D4AF37]/60 dark:hover:ring-[#D4AF37]/40`
  }
  // `default` — hover dodaje aureolę systemową:
  //   light: subtelny granat, dark: ciepły złoty (jak `theme.shadow.cardGlow`).
  // Wariant z explicit `dark:hover:` żeby Tailwind v4 stabilnie sparsował.
  const cardGlowHover =
    'hover:shadow-[0_0_26px_-14px_rgba(15,23,42,0.22)] ' +
    'dark:hover:shadow-[0_0_26px_-14px_rgba(212,175,55,0.55)]'
  return `${theme.transition.base} ${accentBorderHover} ${cardGlowHover} cursor-pointer`
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

  // Polimorficzny `as` powoduje że TS w trybie build (`tsc -b`) nie potrafi
  // zwęzić children type Component do ReactNode. Używamy `createElement` —
  // omija strict JSX children inference, ale zachowuje runtime semantykę.
  return createElement(
    Component as ElementType,
    { ref, className: composed, ...(rest as object) },
    children,
  )
}

/**
 * Polimorficzny komponent z `as`. Forwardowanie ref dla framer-motion / buttonów.
 */
const BaseCard = forwardRef(BaseCardInner) as BaseCardComponent

export default BaseCard
