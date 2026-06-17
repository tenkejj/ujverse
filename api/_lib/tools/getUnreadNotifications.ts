/**
 * Tool: `get_unread_notifications`
 *
 * Nieprzeczytane powiadomienia usera — markdown passthrough (bez syntezy Llama).
 */

import { z } from 'zod'
import {
  fetchUnreadNotifications,
  formatNotificationsMarkdown,
} from '../notificationHelpers.js'
import { registerTool, type ToolContext } from './registry.js'

const NOT_LOGGED_IN_MESSAGE =
  'Aby zobaczyć powiadomienia musisz być zalogowany w UJverse.'

const ArgsSchema = z.object({
  limit: z.number().int().min(1).max(20).optional(),
})

type Args = z.infer<typeof ArgsSchema>

async function execute(args: Args, ctx: ToolContext): Promise<string> {
  if (!ctx.userId) {
    return NOT_LOGGED_IN_MESSAGE
  }

  const parsed = ArgsSchema.safeParse(args)
  const limit = parsed.success ? (parsed.data.limit ?? 10) : 10

  const items = await fetchUnreadNotifications(
    ctx.supabaseAdmin,
    ctx.userId,
    limit,
  )

  if (items.length === 0) {
    return '**Powiadomienia**\nNic nieprzeczytanego — możesz odetchnąć.'
  }

  return formatNotificationsMarkdown(items, {
    heading: '**Nieprzeczytane**',
  })
}

registerTool<Args, string>({
  tool: {
    name: 'get_unread_notifications',
    description:
      'Nieprzeczytane powiadomienia zalogowanego usera (lajki, komentarze, Aula, wykładowcy, briefing). Wymaga logowania.',
    parameters: {
      type: 'object',
      properties: {
        limit: {
          type: 'integer',
          description: 'Max wyników (domyślnie 10, max 20).',
        },
      },
      additionalProperties: false,
    },
  },
  execute,
})
