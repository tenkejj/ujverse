import { CLUBS, CLUBS_SOURCE_URL, type Club } from '../../data/clubs'
import { UjverseSanitizer } from '../../lib/sanitizer'
import type { ClubMeta, ClubTagTone, UnifiedContent } from '../../types/content'
import type { ContentAdapter } from './BaseAdapter'

const VALID_TONES: ClubTagTone[] = ['gold', 'green', 'red']

function normalizeTone(value: unknown): ClubTagTone {
  if (typeof value === 'string' && (VALID_TONES as string[]).includes(value)) {
    return value as ClubTagTone
  }
  return 'gold'
}

/**
 * Adapter kół naukowych.
 *
 * Źródło: lokalna konfiguracja z `src/data/clubs.ts` (CLUBS). Gotowy slot pod
 * podmianę na Supabase — `fetch()` można zastąpić wywołaniem do tabeli `clubs`
 * bez żadnych zmian w UI.
 */
class ClubsAdapterImpl implements ContentAdapter<Club, ClubMeta> {
  readonly type = 'club' as const

  async fetch(): Promise<Club[]> {
    return CLUBS
  }

  toUnified(raw: Club): UnifiedContent<ClubMeta> | null {
    const name = UjverseSanitizer.normalizeTypography(raw.name).slice(0, 90)
    if (!name) return null

    const department =
      UjverseSanitizer.normalizeTypography(raw.department).slice(0, 60) || 'Nieznany wydział'
    const tag = UjverseSanitizer.normalizeTag(raw.tag).slice(0, 24)
    const tone = normalizeTone(raw.tone)
    const id = UjverseSanitizer.slugify(raw.id) || UjverseSanitizer.slugify(name)
    if (!id) return null

    return {
      id,
      type: 'club',
      title: name,
      author: {
        id: `club:${id}`,
        displayName: name,
        subtitle: department,
        avatarUrl: null,
      },
      body: '',
      timestamp: null,
      badges: [{ label: tag, tone }],
      metadata: { department, tag, tagTone: tone },
      actions: [
        {
          id: 'open-source',
          label: 'Oficjalna lista WZiKS',
          kind: 'link',
          href: CLUBS_SOURCE_URL,
        },
      ],
    }
  }

  /**
   * Pobranie + sanityzacja + deduplikacja (po id i nazwie). Jedno wywołanie z UI.
   */
  async list(): Promise<UnifiedContent<ClubMeta>[]> {
    const raws = await this.fetch()
    const byId = new Map<string, UnifiedContent<ClubMeta>>()
    const byName = new Set<string>()
    for (const raw of raws) {
      const uc = this.toUnified(raw)
      if (!uc) continue
      const nameKey = uc.title.toLowerCase()
      if (byId.has(uc.id) || byName.has(nameKey)) continue
      byId.set(uc.id, uc)
      byName.add(nameKey)
    }
    return [...byId.values()]
  }
}

export const ClubsAdapter = new ClubsAdapterImpl()
