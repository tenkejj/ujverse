import type { ContentType, UnifiedContent } from '../../types/content'

/**
 * Kontrakt adaptera — tłumaczy surowe dane (Supabase row / scraper payload /
 * lokalny JSON) na `UnifiedContent`. Każdy nowy moduł dashboardu = 1 adapter.
 *
 * Zwraca `null` gdy `UjverseSanitizer` odrzuca rekord (np. pusty autor/body).
 */
export interface ContentAdapter<
  TRaw,
  TMeta extends Record<string, unknown>,
> {
  readonly type: ContentType
  toUnified(raw: TRaw): UnifiedContent<TMeta> | null
}

/** Funkcja aborująca zwracana przez `subscribe*` w `DataService`. */
export type Unsubscribe = () => void
