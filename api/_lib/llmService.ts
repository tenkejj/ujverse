/**
 * LLMService — serwerowy switch providera AI (Edge runtime).
 *
 * Wybór providera per `NODE_ENV`:
 * - `production`: wymagany `GROQ_API_KEY` → `GroqProvider`. Brak klucza =
 *   natychmiastowy rzut przy starcie funkcji (lepsze niż ciche 502).
 * - inne (`development`, `test`, undefined): jeśli `GROQ_API_KEY` jest, też
 *   używamy `GroqProvider` (żeby dev mógł testować realne odpowiedzi);
 *   jeśli klucza brak — wpinamy `MockProvider`, który zwraca pojedynczy
 *   chunk SSE z echo userskiej wiadomości. Dzięki temu UI da się klikać
 *   bez klucza, a parser SSE klienta nadal dostaje strumień w spodziewanym
 *   formacie OpenAI.
 *
 * Eksportujemy gotową instancję `llmService` — `api/chat.ts` jej używa.
 */

import { GroqProvider } from './GroqProvider'
import type { ChatRequestMessage, GroqMessage, LLMProvider } from './types'

/**
 * Akademicka persona UJverse — wstrzykiwana JAKO PIERWSZY `system`-message
 * przy każdym chacie. Świadomie zdefiniowana w warstwie `LLMService` (a nie
 * w `GroqProvider`), żeby:
 *
 * - `GroqProvider` pozostał czystym vendor-clientem (testowalny, łatwo go
 *   przepiąć na inny provider OpenAI-compatible);
 * - inne use-case'y (np. `scrape-wziks.ts` z własnym strict-mode parserem
 *   nazwisk) mogły instancjonować `GroqProvider` bezpośrednio i NIE
 *   dziedziczyć persony, która by im zaśmieciła output.
 *
 * Skondensowana po przejściu na Function Calling: enumerację narzędzi i
 * parametrów modelowi i tak dostarcza pole `tools` requestu (`toGroqToolsArray()`),
 * więc wcześniejsza długa lista w prompcie była redundantna i kosztowała
 * tokeny przy każdym round-tripie pętli.
 */
export const UJVERSE_SYSTEM_PROMPT =
  'Jesteś asystentem UJverse. Używaj narzędzi do danych. Odpowiadaj zwięźle, akademicko.'

/**
 * Helper dla tool-aware orchestratora (`api/chat.ts`): wkłada personę jako
 * pierwszy `system` message i filtruje wszelkie inne `system`-y z wejścia
 * (klient nie może podmienić instrukcji modelu).
 */
export function withPersona(messages: GroqMessage[]): GroqMessage[] {
  const withoutSystem = messages.filter((m) => m.role !== 'system')
  return [{ role: 'system', content: UJVERSE_SYSTEM_PROMPT }, ...withoutSystem]
}

/** Provider awaryjny: nie woła sieci, generuje minimalny SSE OpenAI-like. */
class MockProvider implements LLMProvider {
  async sendMessage(
    messages: ChatRequestMessage[],
  ): Promise<ReadableStream<Uint8Array>> {
    const lastUser = [...messages].reverse().find((m) => m.role === 'user')
    const echo = lastUser?.content ?? '(brak treści użytkownika)'
    const reply = `[MockProvider] Otrzymałem: "${echo.slice(0, 200)}"`

    // Imitujemy format OpenAI streaming: jeden `data:` z `delta.content`,
    // potem `data: [DONE]`. Parser klienta (`BielikAdapter.parseSSEStream`)
    // konsumuje to bez modyfikacji.
    const chunks = [
      `data: ${JSON.stringify({ choices: [{ delta: { content: reply } }] })}\n\n`,
      'data: [DONE]\n\n',
    ]
    const encoder = new TextEncoder()
    return new ReadableStream<Uint8Array>({
      start(controller) {
        for (const c of chunks) controller.enqueue(encoder.encode(c))
        controller.close()
      },
    })
  }
}

class LLMService implements LLMProvider {
  private readonly provider: LLMProvider

  constructor() {
    const apiKey = process.env.GROQ_API_KEY
    const env = process.env.NODE_ENV

    if (env === 'production') {
      if (!apiKey) {
        throw new Error(
          'LLMService: GROQ_API_KEY is required when NODE_ENV=production',
        )
      }
      this.provider = new GroqProvider(apiKey)
      return
    }

    // dev / test / undefined — preferuj realny provider gdy klucz jest,
    // w przeciwnym razie zjedź na mocka (offline, brak klucza w `.env.local`).
    this.provider = apiKey ? new GroqProvider(apiKey) : new MockProvider()
  }

  sendMessage(
    messages: ChatRequestMessage[],
  ): Promise<ReadableStream<Uint8Array>> {
    // Persona zawsze idzie na pozycji 0. Klient (`ContextInjectedBielikAdapter`
    // w `src/services/ai/`) może dorzucić swój własny `system` z kontekstem
    // RAG — ląduje on po personie (czyli na pozycji 1), co jest zgodne z
    // OpenAI-compat: model konsumuje wiele `system`-ów łącząc je w jeden
    // kontekst, persona pozostaje "twardszą" instrukcją bo idzie pierwsza.
    const withPersona: ChatRequestMessage[] = [
      { role: 'system', content: UJVERSE_SYSTEM_PROMPT },
      ...messages,
    ]
    return this.provider.sendMessage(withPersona)
  }
}

export const llmService: LLMProvider = new LLMService()
