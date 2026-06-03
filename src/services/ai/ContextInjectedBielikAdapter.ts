/**
 * ContextInjectedBielikAdapter — dekorator (wzorzec Decorator) wokół dowolnego
 * `LLMProvider` (w produkcji: `BielikAdapter`). Wstrzykuje aktualny kontekst
 * (ogłoszenia akademickie + ostatnie posty) jako pierwsza wiadomość `system`
 * w historii czatu, dzięki czemu model „wie", co się dzieje na UJverse, bez
 * potrzeby pełnego RAG-a (embeddingi, vector store) i bez zmian w schemacie DB.
 *
 * Charakterystyka:
 * - Nie zna `supabase` ani `fetch`-a do bazy — całość przepływu danych idzie
 *   przez `DataService` (wymóg #4 z briefa).
 * - Implementuje pełny kontrakt `LLMProvider` (włącznie z `parseSSEStream`),
 *   żeby konsumenci (np. `useChatSend`) nie musieli wiedzieć, że pod spodem
 *   siedzi dekorator. Parser jest po prostu delegowany do bazowego adaptera.
 * - Trzyma prosty TTL-cache (60s) na wygenerowany system-prompt, żeby przy
 *   szybkich kolejnych wiadomościach nie bombardować Supabase. Cache jest
 *   per-instancja — singleton w `LLMService.ts` gwarantuje współdzielenie.
 * - Kolejność wiadomości po dekoracji: `System (Context) -> User -> Assistant`.
 *   Ewentualne wcześniejsze `system`-y wejściowe są filtrowane, żeby nie
 *   zdublować promptu.
 *
 * Brak `any` — wszystkie sygnatury operują na typach z `src/types/ai.ts`
 * i `src/types/content.ts`.
 */

import type {
  ChatConfig,
  ChatMessage,
  LLMProvider,
} from '../../types/ai'
import type { DataService } from '../DataService'
import { generateSystemContext, MAX_RECORDS } from './SystemPrompt'

/** TTL cache'u system-promptu — kompromis między świeżością danych a kosztem fetchy. */
const CACHE_TTL_MS = 60_000

/** Identyfikator stałej wiadomości systemowej. Nie używamy `crypto.randomUUID`,
 *  bo ten message nigdy nie ląduje w `useChatStore` — generujemy go za każdym
 *  razem od zera w pamięci dekoratora. */
const SYSTEM_MESSAGE_ID = 'rag-context'

type DataServiceFacade = typeof DataService

type CacheEntry = {
  fetchedAt: number
  prompt: string
}

export class ContextInjectedBielikAdapter implements LLMProvider {
  private readonly delegate: LLMProvider
  private readonly dataService: DataServiceFacade
  private cache: CacheEntry | null = null

  constructor(delegate: LLMProvider, dataService: DataServiceFacade) {
    this.delegate = delegate
    this.dataService = dataService
  }

  async sendMessage(
    messages: ChatMessage[],
    config?: Partial<ChatConfig>,
  ): Promise<ReadableStream<Uint8Array>> {
    const systemContent = await this.getCachedSystemPrompt()

    const systemMsg: ChatMessage = {
      id: SYSTEM_MESSAGE_ID,
      role: 'system',
      content: systemContent,
      createdAt: 0,
    }

    // Filtrujemy ewentualne `system`-y z wejścia — dekorator jest jedynym
    // źródłem prawdy dla system-promptu. Dzięki temu nie da się "podmienić"
    // instrukcji modelu z poziomu UI.
    const withoutSystem = messages.filter((m) => m.role !== 'system')

    return this.delegate.sendMessage([systemMsg, ...withoutSystem], config)
  }

  parseSSEStream(
    stream: ReadableStream<Uint8Array>,
  ): AsyncGenerator<string, void, void> {
    return this.delegate.parseSSEStream(stream)
  }

  /**
   * Zwraca system-prompt z cache'u (jeśli świeży) albo regeneruje przez
   * równoległe pobranie ogłoszeń + ostatnich postów z fasady DataService.
   * Błędy fetchy nie zatrzymują wysłania wiadomości — model dostanie wówczas
   * prompt zbudowany z pustych list (sekcja "brak danych"), co jest lepsze
   * niż błąd 500 w UI.
   */
  private async getCachedSystemPrompt(): Promise<string> {
    if (this.cache && Date.now() - this.cache.fetchedAt < CACHE_TTL_MS) {
      return this.cache.prompt
    }

    const [announcementsResult, postsResult] = await Promise.allSettled([
      this.dataService.listAnnouncements(),
      this.dataService.listRecentPosts(MAX_RECORDS),
    ])

    const announcements =
      announcementsResult.status === 'fulfilled' ? announcementsResult.value : []
    const posts = postsResult.status === 'fulfilled' ? postsResult.value : []

    const prompt = generateSystemContext(
      announcements.slice(0, MAX_RECORDS),
      posts.slice(0, MAX_RECORDS),
    )

    this.cache = { fetchedAt: Date.now(), prompt }
    return prompt
  }
}
