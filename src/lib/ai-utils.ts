/// <reference types="node" />
import type { SupabaseClient } from '@supabase/supabase-js'

const GROQ_CHAT_COMPLETIONS_URL = 'https://api.groq.com/openai/v1/chat/completions'
const GROQ_MODEL = 'llama-3.1-8b-instant'

const LECTURER_NOMINATIVE_SYSTEM_PROMPT = `Jesteś ekspertem języka polskiego. Zmień nazwisko z dopełniacza na mianownik.
Zasady:

Jeśli nazwisko to "Rak", w mianowniku brzmi "Rak".

Jeśli nazwisko żeńskie kończy się na spółgłoskę, nie odmieniaj go (np. Dorota Rak).

Zwróć TYLKO imię i nazwisko w mianowniku, bez żadnych dodatkowych słów i kropek.
Przykład: "dr Palomy Korycińskiej" -> "dr Paloma Korycińska".`

/** Zgodne ze scraperem — bez Groq ani zapisu do cache. */
const SKIP_GROQ_LECTURER_LABEL = 'Komunikat ISI / WZiKS'

type OpenAIChatCompletionResponse = {
  choices?: Array<{ message?: { content?: string | null } }>
}

function sanitizeNominativeModelOutput(text: string, fallback: string): string {
  let t = text
    .replace(/^```[a-z]*\s*/i, '')
    .replace(/\s*```\s*$/i, '')
    .trim()
  const firstLine = t.split('\n').find((line) => line.trim().length > 0)?.trim() ?? t
  if (firstLine.length < 2 || firstLine.length > 220) return fallback
  return firstLine.replace(/\.$/, '').trim()
}

async function fetchGroqNominative(raw: string): Promise<{ value: string; cacheable: boolean }> {
  const apiKey = process.env.GROQ_API_KEY
  if (!apiKey) return { value: raw, cacheable: false }

  try {
    const body = {
      model: GROQ_MODEL,
      messages: [
        { role: 'system', content: LECTURER_NOMINATIVE_SYSTEM_PROMPT },
        { role: 'user', content: raw },
      ],
      temperature: 0,
    }

    const response = await fetch(GROQ_CHAT_COMPLETIONS_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    })

    if (!response.ok) {
      throw new Error(`Groq HTTP status ${response.status}`)
    }

    const data = (await response.json()) as OpenAIChatCompletionResponse
    const modelOutput = data?.choices?.[0]?.message?.content
    const nominativeName = modelOutput?.trim() ?? ''
    if (!nominativeName) {
      throw new Error('Groq zwrócił pustą odpowiedź dla lecturerNameToNominative')
    }
    const result = sanitizeNominativeModelOutput(nominativeName, raw)
    console.log('Poprawiono:', raw, '->', result)
    return { value: result, cacheable: true }
  } catch (error) {
    if (error instanceof Error && error.message.includes('pustą odpowiedź')) {
      throw error
    }
    return { value: raw, cacheable: false }
  }
}

/**
 * Mianownik nazwiska wykładowcy: najpierw `lecturer_names_cache`, potem Groq i zapis do cache.
 * Używaj z klientem Supabase (np. service role w scraperze).
 */
export async function lecturerNameToNominativeWithCache(
  supabase: SupabaseClient,
  raw: string,
): Promise<string> {
  const key = raw.trim()
  const originalName = key
  if (!key) return raw
  if (key === SKIP_GROQ_LECTURER_LABEL) return raw

  const { data: cached, error: cacheReadError } = await supabase
    .from('lecturer_names_cache')
    .select('nominative_name')
    .eq('original_name', key)
    .maybeSingle()

  if (!cacheReadError && cached?.nominative_name) {
    return cached.nominative_name
  }

  const { value: fromGroq, cacheable } = await fetchGroqNominative(key)

  if (cacheable) {
    console.log('DEBUG CACHE: Próbuję zapisać do cache:', originalName)
    await supabase.from('lecturer_names_cache').upsert(
      {
        original_name: key,
        nominative_name: fromGroq,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'original_name' },
    )
  }

  return fromGroq
}
