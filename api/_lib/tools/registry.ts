/**
 * Tool Registry — kontrakt Function Calling po stronie serwera.
 *
 * Konwencja: każde narzędzie deklaruje (a) `Tool` (metadane przekazywane do
 * Groqa w polu `tools` zgodnie z OpenAI-compat), (b) `ToolExecutor`
 * (asynchroniczna funkcja realizująca zapytanie do Supabase). Komplet trafia
 * do `toolRegistry` przez `registerTool()`.
 *
 * `ToolExecutor` dostaje:
 * - `args` — sparsowany JSON z `tool_call.function.arguments` (Groq je wysyła
 *   jako string z JSON-em, parsowanie robi orchestrator w `api/chat.ts`),
 * - `ctx` — `userId` (z weryfikacji JWT, może być `null`) + `supabaseAdmin`
 *   (service-role klient, RLS bypass).
 *
 * Wynik egzekutora jest serializowany do JSON i wkładany jako `content`
 * wiadomości `role: 'tool'` z pasującym `tool_call_id`. Klient nie widzi
 * surowych wyników — model dostaje je do "konsumpcji" i syntetyzuje
 * finalną odpowiedź dla użytkownika.
 *
 * Granice:
 * - narzędzia NIE rzucają wyjątków na błędy logiczne — zwracają struct
 *   `{ ok: false, error }` żeby model mógł powiedzieć użytkownikowi co poszło
 *   nie tak. Wyjątki z `supabaseAdmin` (sieć, 500) propagujemy do orchestratora,
 *   który zamienia je na zwykłą odpowiedź błędu HTTP.
 * - rozmiar `content` (po `JSON.stringify`) trzymamy zwięzły — modele małe
 *   (llama-3.1-8b-instant) mają context window 128k, ale tokeny kosztują.
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import {
  buildToolCacheKey,
  TTLMemoryCache,
  TOOL_CACHE_TTL_MS,
  ttlForTool,
} from '../cache'

/**
 * Minimalne JSON Schema akceptowane przez Groq w polu `tools[*].function.parameters`.
 * Świadomie zawężone do tego, czego potrzebujemy dziś — nie próbujemy odwzorować
 * całego JSON Schema draft.
 */
export type ToolJsonSchema = {
  type: 'object'
  properties: Record<
    string,
    {
      type: 'string' | 'number' | 'integer' | 'boolean'
      description?: string
      enum?: string[]
    }
  >
  required?: string[]
  additionalProperties?: false
}

export type Tool = {
  name: string
  description: string
  parameters: ToolJsonSchema
}

export type ToolContext = {
  /** `null` gdy request anonimowy lub JWT niepoprawny. */
  userId: string | null
  /** Service-role klient — RLS bypass. Każde narzędzie samo decyduje o filtrach. */
  supabaseAdmin: SupabaseClient
}

export type ToolExecutor<TArgs = Record<string, unknown>, TResult = unknown> = (
  args: TArgs,
  ctx: ToolContext,
) => Promise<TResult>

export type ToolEntry = {
  tool: Tool
  execute: ToolExecutor
}

/** Format wymagany przez Groqa (OpenAI-compatible) w polu `tools` requestu. */
export type GroqToolDescriptor = {
  type: 'function'
  function: Tool
}

const registry = new Map<string, ToolEntry>()

/**
 * Cache wyników narzędzi — klucz = `<toolName>::<fnv1a(args)>::<len>`,
 * TTL pobierany per narzędzie z `TOOL_TTL_MS` w `cache.ts`
 * (60s announcements / 300s events / 30s posts; default 60s).
 *
 * Cache działa jako DEKORATOR wokół `execute` — owijanie odbywa się raz, w
 * `registerTool`. Konsumenci (`api/chat.ts`) wołają po prostu `entry.execute`
 * i nie widzą warstwy cache; to celowe, żeby orchestrator pozostał prosty,
 * a pojedynczy egzekutor był testowalny w izolacji bez cache.
 *
 * Cache'ujemy WYŁĄCZNIE wyniki sukcesu (`ok: true` lub dowolna inna wartość
 * truthy). Błędy (`ok: false`, rzuty wyjątków) NIE trafiają do cache'u —
 * następne wywołanie powinno spróbować ponownie.
 */
const toolResultCache = new TTLMemoryCache<unknown>(TOOL_CACHE_TTL_MS)

/** Argumenty `registerTool` — `ttlMs` opcjonalny; bez niego sięga `ttlForTool(name)`. */
export type RegisterToolArgs<TArgs, TResult> = {
  tool: Tool
  execute: ToolExecutor<TArgs, TResult>
  /** Override TTL per rejestracja — przydatne w testach. Default: `ttlForTool(tool.name)`. */
  ttlMs?: number
}

export function registerTool<TArgs, TResult>(
  entry: RegisterToolArgs<TArgs, TResult>,
): void {
  if (registry.has(entry.tool.name)) {
    throw new Error(`Tool already registered: ${entry.tool.name}`)
  }
  const ttlMs = entry.ttlMs ?? ttlForTool(entry.tool.name)
  const decorated = withCache(entry.tool.name, entry.execute, ttlMs)
  registry.set(entry.tool.name, {
    tool: entry.tool,
    execute: decorated as ToolExecutor,
  })
}

export function getToolEntry(name: string): ToolEntry | undefined {
  return registry.get(name)
}

export function listToolNames(): string[] {
  return Array.from(registry.keys())
}

/**
 * Decorator: opakowuje `execute` w warstwę cache'u TTL.
 *
 * - HIT: zwraca wartość z `TTLMemoryCache` bez wołania egzekutora ([log] `[Tool Cache] HIT`).
 * - MISS: woła egzekutor; jeśli wynik nadaje się do cache'owania (`isCacheable`),
 *   wkłada do cache'u na `ttlMs`.
 *
 * Funkcja jest generyczna w args/result, ale do `Map<ToolEntry>` trafia jako
 * unknown-args (`ToolExecutor<Record<string, unknown>, unknown>`) — to celowe,
 * dziedziczone po pierwotnym kontrakcie registry.
 */
function withCache<TArgs, TResult>(
  toolName: string,
  execute: ToolExecutor<TArgs, TResult>,
  ttlMs: number,
): ToolExecutor<TArgs, TResult> {
  return async (args, ctx) => {
    const cacheKey = buildToolCacheKey(
      toolName,
      args as unknown as Record<string, unknown>,
    )
    const cached = toolResultCache.get(cacheKey)
    if (cached !== undefined) {
      console.log('[Tool Cache] HIT', toolName, 'key:', cacheKey)
      return cached as TResult
    }

    const result = await execute(args, ctx)
    if (isCacheable(result)) {
      toolResultCache.set(cacheKey, result, ttlMs)
      console.log(
        '[Tool Cache] MISS -> set',
        toolName,
        'key:',
        cacheKey,
        'ttlMs:',
        ttlMs,
      )
    } else {
      console.log('[Tool Cache] MISS -> skip (error result)', toolName)
    }
    return result
  }
}

function isCacheable(value: unknown): boolean {
  if (value === null || value === undefined) return false
  if (typeof value === 'object' && 'ok' in (value as Record<string, unknown>)) {
    return (value as { ok: unknown }).ok !== false
  }
  return true
}

/** Tylko dla testów / debug — nie używać w hot path. */
export function clearToolCache(): void {
  toolResultCache.clear()
}

/**
 * Zwraca tablicę narzędzi w kształcie wymaganym przez Groq:
 * `[{ type: 'function', function: { name, description, parameters } }, ...]`.
 *
 * Wywoływane przez orchestrator (`api/chat.ts`) tuż przed wysłaniem requestu
 * do Groqa.
 */
export function toGroqToolsArray(): GroqToolDescriptor[] {
  return Array.from(registry.values()).map(({ tool }) => ({
    type: 'function',
    function: tool,
  }))
}
