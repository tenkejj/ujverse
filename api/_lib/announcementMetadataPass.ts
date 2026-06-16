/**
 * Wspólny pass ekstrakcji metadanych komunikatu (TL;DR + kalendarz).
 * Używany przez `scrape-faculty-announcements.ts` (pass 3) oraz
 * `reextract-announcements.ts` (masowy re-run po zmianie promptu Versusia).
 */
import type { SupabaseClient } from '@supabase/supabase-js'
import type { GroqProvider } from './GroqProvider.js'
import { extractAnnouncementMetadata } from './calendarExtraction.js'

export async function runAnnouncementMetadataExtractionForRow(
  supabase: SupabaseClient,
  provider: GroqProvider,
  row: { id: string; body: string },
  logPrefix = '[announcement-metadata]',
): Promise<{ ok: boolean; rateLimited: boolean }> {
  const result = await extractAnnouncementMetadata(provider, row.body)

  if (result.status === 'rate_limited') {
    console.warn(`${logPrefix} metadata extraction 429 — pausing, id=`, row.id)
    return { ok: false, rateLimited: true }
  }

  if (result.status === 'error') {
    console.warn(
      `${logPrefix} metadata extraction error id=`,
      row.id,
      'msg=',
      result.message,
    )
    return { ok: false, rateLimited: false }
  }

  const { error: updateError } = await supabase
    .from('announcements')
    .update({
      summary: result.summary,
      extracted_calendar: result.extraction,
      extraction_attempted_at: new Date().toISOString(),
    })
    .eq('id', row.id)

  if (updateError) {
    console.error(
      `${logPrefix} failed to write extracted metadata id=`,
      row.id,
      updateError.message,
    )
    return { ok: false, rateLimited: false }
  }

  return { ok: true, rateLimited: false }
}
