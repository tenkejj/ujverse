/**
 * `chatModel` — jedyna prawda po stronie klienta o tym, jaki model siedzi
 * pod asystentem UJverse. Wartość pokazywana wszędzie, gdzie UI mówi „kto
 * mówi" (header `/chat`, podtytuł wyspy, podtytuł mobilnego FAB-a).
 *
 * Po stronie serwera kanonicznym źródłem jest `DEFAULT_GROQ_MODEL` w
 * `api/_lib/llmService.ts` (`qwen/qwen3-32b`). Tutaj trzymamy tylko etykietę
 * człowiekoczytelną — proxy do tej samej decyzji bez konieczności importu
 * server-side modułu do bundla klienta.
 */
export const CHAT_MODEL_LABEL = 'Qwen3 32B'

/** Provider — opcjonalne do drobnego druku w stopce / tooltipie. */
export const CHAT_PROVIDER_LABEL = 'Groq'
