/**
 * Logger zużycia tokenów AI per request → tabela `public.api_usage_logs`.
 *
 * Schemat: patrz migracja `supabase/migrations/20260603192000_api_usage_logs.sql`
 *   id            BIGSERIAL
 *   user_id       UUID NULL  -> auth.users(id) ON DELETE SET NULL
 *   input_tokens  INTEGER (prompt_tokens, łącznie z tool messages)
 *   output_tokens INTEGER (completion_tokens, łącznie z tool_calls)
 *   model         TEXT
 *   created_at    TIMESTAMPTZ
 *
 * Wzorzec użycia: fire-and-forget z `api/chat.ts`. NIE blokujemy odpowiedzi
 * SSE na zapis — log jest pomocniczy, nie source of truth dla użytkownika.
 *
 * Gdy zapis się nie powiedzie (np. brak migracji, RLS, sieć), logujemy
 * `console.warn` i milczymy — żaden błąd nie może uszkodzić ścieżki czatu.
 */

import { getSupabaseAdmin } from './supabaseAdmin.js'

export type TokenUsageRecord = {
  /** `null` gdy request anonimowy. */
  userId: string | null
  inputTokens: number
  outputTokens: number
  /** Identyfikator modelu (np. `llama-3.1-8b-instant`). */
  model: string
}

/**
 * Akumulator tokenów dla pętli Function Calling.
 *
 * Pętla może mieć N round-tripów do Groqa (każdy zwraca własne `usage`).
 * Sumujemy je tutaj, a `logTokenUsage` zapisuje finalną sumę raz na request
 * — żeby nie spamować bazy N insertami za jeden czat.
 */
export class TokenUsageAccumulator {
  private input = 0
  private output = 0

  add(usage: { prompt_tokens?: number; completion_tokens?: number } | null | undefined): void {
    if (!usage) return
    if (typeof usage.prompt_tokens === 'number' && Number.isFinite(usage.prompt_tokens)) {
      this.input += usage.prompt_tokens
    }
    if (typeof usage.completion_tokens === 'number' && Number.isFinite(usage.completion_tokens)) {
      this.output += usage.completion_tokens
    }
  }

  get inputTokens(): number {
    return this.input
  }

  get outputTokens(): number {
    return this.output
  }

  isEmpty(): boolean {
    return this.input === 0 && this.output === 0
  }
}

/**
 * Asynchroniczny insert do `api_usage_logs`. Świadomie **nie czeka** na
 * zakończenie zapytania — caller powinien wywołać `void logTokenUsage(...)`
 * lub użyć Edge runtime `waitUntil()` (jeśli dostępny). Promise jest zwracany
 * tylko dla testów, gdzie chcemy `await` na sprawdzenie idempotencji.
 *
 * Fail-silent: błąd zapisu loguje `console.warn`, ale NIE rzuca i nie zwraca
 * błędu — user dostaje swoją odpowiedź bez względu na status logowania.
 */
export async function logTokenUsage(record: TokenUsageRecord): Promise<void> {
  if (record.inputTokens <= 0 && record.outputTokens <= 0) {
    // Żaden round-trip do modelu się nie udał (np. natychmiastowy 429).
    // Brak czego logować — pomijamy.
    return
  }

  try {
    const supabase = getSupabaseAdmin()
    const { error } = await supabase.from('api_usage_logs').insert({
      user_id: record.userId,
      input_tokens: Math.max(0, Math.round(record.inputTokens)),
      output_tokens: Math.max(0, Math.round(record.outputTokens)),
      model: record.model,
    })
    if (error) {
      console.warn('[tokenUsage] insert failed:', error.message)
    }
  } catch (err) {
    console.warn(
      '[tokenUsage] threw:',
      err instanceof Error ? err.message : 'unknown error',
    )
  }
}
