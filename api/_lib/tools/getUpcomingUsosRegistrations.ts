/**
 * Tool: `get_upcoming_usos_registrations`
 *
 * Zwraca nadchodzące rejestracje USOSweb (z `public.usos_registrations`)
 * w okresie `now() … now() + days_ahead` (default 30 dni, max 90).
 * Dodatkowe opcjonalne filtry:
 *   - `study_program` — fragment tekstu (`ilike`) np. „informatyka", „prawo"
 *   - `year` — rok studiów (1-7)
 *
 * `hidden_at` w schemacie nie istnieje (jest to katalog community-driven,
 * admin moderacja przez delete) — więc filtrujemy tylko po `opens_at`.
 *
 * Sort: `opens_at ASC` (najbliższe najpierw). Limit 10.
 *
 * Cache TTL 600s — rejestracje to rzadko zmieniany katalog.
 */

import { z } from 'zod'
import { registerTool, type ToolContext } from './registry.js'

const MAX_ROWS = 10
const DEFAULT_DAYS = 30
const MAX_DAYS = 90

const RegistrationRowSchema = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string().nullable(),
  study_program: z.string().nullable(),
  year: z.number().nullable(),
  audience_label: z.string().nullable(),
  opens_at: z.string(),
  closes_at: z.string().nullable(),
  registration_url: z.string(),
  info_url: z.string().nullable(),
  kind: z.string(),
  subscriber_count: z.number().nullable(),
})
const RegistrationRowsSchema = z.array(RegistrationRowSchema)

export type GetUpcomingUsosArgs = {
  days_ahead?: number
  study_program?: string
  year?: number
}

type ResultItem = z.infer<typeof RegistrationRowSchema>

export type GetUpcomingUsosResult = {
  ok: true
  count: number
  items: ResultItem[]
}

export type GetUpcomingUsosError = {
  ok: false
  error: string
}

function escapeIlikePattern(term: string): string {
  return term.replace(/[%_\\]/g, '\\$&')
}

async function execute(
  args: GetUpcomingUsosArgs,
  ctx: ToolContext,
): Promise<GetUpcomingUsosResult | GetUpcomingUsosError | string> {
  const days = Math.min(
    MAX_DAYS,
    Math.max(1, typeof args?.days_ahead === 'number' ? args.days_ahead : DEFAULT_DAYS),
  )
  const now = new Date()
  const upper = new Date(now.getTime() + days * 24 * 60 * 60 * 1000)

  let q = ctx.supabaseAdmin
    .from('usos_registrations')
    .select(
      'id, title, description, study_program, year, audience_label, ' +
        'opens_at, closes_at, registration_url, info_url, kind, subscriber_count',
    )
    .gte('opens_at', now.toISOString())
    .lte('opens_at', upper.toISOString())
    .order('opens_at', { ascending: true })
    .limit(MAX_ROWS)

  if (typeof args?.study_program === 'string' && args.study_program.trim().length >= 2) {
    const pattern = escapeIlikePattern(args.study_program.trim())
    q = q.ilike('study_program', `%${pattern}%`)
  }

  if (typeof args?.year === 'number' && args.year >= 1 && args.year <= 7) {
    q = q.eq('year', args.year)
  }

  const { data, error } = await q

  if (error) {
    console.error('[get_upcoming_usos_registrations] db error:', error.message)
    return { ok: false, error: error.message }
  }

  const parsed = RegistrationRowsSchema.safeParse(data ?? [])
  if (!parsed.success) {
    console.error(
      '[get_upcoming_usos_registrations] zod validation failed:',
      parsed.error.issues,
    )
    return { ok: false, error: 'invalid registration row shape from database' }
  }

  if (parsed.data.length === 0) {
    return 'Brak nadchodzących rejestracji USOS w tym okresie'
  }

  return { ok: true, count: parsed.data.length, items: parsed.data }
}

registerTool<
  GetUpcomingUsosArgs,
  GetUpcomingUsosResult | GetUpcomingUsosError | string
>({
  tool: {
    name: 'get_upcoming_usos_registrations',
    description:
      'Nadchodzące rejestracje USOSweb (default 30 dni). Filtr po kierunku/roku. Dla „kiedy rejestracja na…", „lektoraty", „WF".',
    parameters: {
      type: 'object',
      properties: {
        days_ahead: { type: 'integer', description: 'Default 30, max 90.' },
        study_program: { type: 'string', description: 'Fragment kierunku.' },
        year: { type: 'integer', description: '1-7.' },
      },
      additionalProperties: false,
    },
  },
  execute,
})
