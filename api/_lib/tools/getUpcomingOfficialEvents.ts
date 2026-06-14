/**
 * Tool: `get_upcoming_official_events`
 *
 * Zwraca nadchodzące oficjalne wydarzenia UJ z `public.official_events`
 * (dane z scrapera `api/scrape-uj-events.ts`). Filtr czasowy:
 * `date >= now() AND date <= now() + days_ahead`.
 *
 * Default `days_ahead = 14` (max 60). Sort: `date ASC` (najbliższe najpierw).
 * Limit: 10.
 *
 * To jest komplement do `search_events` — to drugie szuka po fragmencie
 * tekstu w title/description/location, ale NIE filtruje po dacie. Tu
 * pytamy "co się dzieje w najbliższym tygodniu" bez konkretnego hasła.
 *
 * Cache TTL 600s — kalendarz oficjalny zmienia się rzadko (cron daily).
 */

import { z } from 'zod'
import { registerTool, type ToolContext } from './registry.js'

const MAX_ROWS = 10
const DEFAULT_DAYS = 14
const MAX_DAYS = 60

const EventRowSchema = z.object({
  id: z.string(),
  title: z.string(),
  date: z.string(),
  category: z.string().nullable(),
  location: z.string().nullable(),
  description: z.string().nullable(),
  faculty: z.string().nullable(),
  event_url: z.string().nullable(),
  image_url: z.string().nullable(),
})
const EventRowsSchema = z.array(EventRowSchema)

export type GetUpcomingOfficialEventsArgs = {
  days_ahead?: number
}

type ResultItem = z.infer<typeof EventRowSchema>

export type GetUpcomingOfficialEventsResult = {
  ok: true
  count: number
  items: ResultItem[]
}

export type GetUpcomingOfficialEventsError = {
  ok: false
  error: string
}

async function execute(
  args: GetUpcomingOfficialEventsArgs,
  ctx: ToolContext,
): Promise<
  GetUpcomingOfficialEventsResult | GetUpcomingOfficialEventsError | string
> {
  const days = Math.min(
    MAX_DAYS,
    Math.max(1, typeof args?.days_ahead === 'number' ? args.days_ahead : DEFAULT_DAYS),
  )
  const now = new Date()
  const upper = new Date(now.getTime() + days * 24 * 60 * 60 * 1000)

  const { data, error } = await ctx.supabaseAdmin
    .from('official_events')
    .select(
      'id, title, date, category, location, description, faculty, event_url, image_url',
    )
    .gte('date', now.toISOString())
    .lte('date', upper.toISOString())
    .order('date', { ascending: true })
    .limit(MAX_ROWS)

  if (error) {
    console.error('[get_upcoming_official_events] db error:', error.message)
    return { ok: false, error: error.message }
  }

  const parsed = EventRowsSchema.safeParse(data ?? [])
  if (!parsed.success) {
    console.error(
      '[get_upcoming_official_events] zod validation failed:',
      parsed.error.issues,
    )
    return { ok: false, error: 'invalid event row shape from database' }
  }

  if (parsed.data.length === 0) {
    return 'Brak nadchodzących oficjalnych wydarzeń UJ w tym okresie'
  }

  return { ok: true, count: parsed.data.length, items: parsed.data }
}

registerTool<
  GetUpcomingOfficialEventsArgs,
  GetUpcomingOfficialEventsResult | GetUpcomingOfficialEventsError | string
>({
  tool: {
    name: 'get_upcoming_official_events',
    description:
      'Nadchodzące oficjalne wydarzenia UJ (default 14 dni, max 60). Dla „co na UJ", „kalendarz UJ", „konferencje". Po nazwie → search_events.',
    parameters: {
      type: 'object',
      properties: {
        days_ahead: { type: 'integer', description: 'Default 14, max 60.' },
      },
      additionalProperties: false,
    },
  },
  execute,
})
