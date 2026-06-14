/**
 * Admin Diagnostics — token-gated dashboard nad `/api/_diag/*`.
 *
 * Wyświetla:
 *  - Health: status Supabase / KV / Groq + circuit breaker
 *  - Cache: derived hit-rates (response, fast-path, tool)
 *  - Tools: top 10 narzędzi po użyciu (z `tool_cache:hit:<name>` + miss counters)
 *  - Latency: p50/p95 dla `chat:*_ms` i `tool:*_ms`
 *
 * Token: jest **input field** pamiętany w `localStorage` (`ujverse:diag_token`).
 * Endpointy `/api/_diag/cache-stats` i `/api/_diag/health` są token-gated
 * po stronie serwera — więc nawet jeśli widget pokażemy, dane nie wyciekną
 * bez znajomości tokena.
 *
 * Refresh: auto co 10s, można wyłączyć togglem (przy debug'u czasem chcesz
 * zamrozić moment). Plus przycisk „Odśwież teraz".
 *
 * Reset: `DELETE /api/_diag/cache-stats` z body `{confirm:true}` zeruje
 * wszystkie liczniki + ring buffery latency.
 */
import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  RefreshCcw,
  Trash2,
  XCircle,
} from 'lucide-react'
import BaseCard from '../ui/BaseCard'
import { theme } from '../../styles/theme'
import { toast } from '../../lib/appToast'

const TOKEN_STORAGE_KEY = 'ujverse:diag_token'
const REFRESH_INTERVAL_MS = 10_000

type CounterMap = Record<string, number>
type LatencySummary = {
  count: number
  p50: number
  p95: number
  avg: number
  min: number
  max: number
}
type LatencyMap = Record<string, LatencySummary>

type CacheStatsResponse = {
  counters: CounterMap
  latency: LatencyMap
  derived: Record<string, number | null>
  circuitBreaker: {
    state: 'CLOSED' | 'OPEN' | 'HALF_OPEN'
    openUntilEpochSec: number | null
    retryAfterSec: number | null
    recentErrors: number
  }
}

type HealthCheck = {
  ok: boolean
  latencyMs: number
  error?: string
}

type HealthResponse = {
  overall: 'ok' | 'degraded' | 'down'
  ts: string
  checks: {
    supabase: HealthCheck
    kv: HealthCheck
    groq: HealthCheck
  }
  circuitBreaker: CacheStatsResponse['circuitBreaker']
}

const API_BASE = import.meta.env.DEV ? 'http://localhost:3000' : ''

async function fetchJson<T>(
  endpoint: string,
  token: string,
  init?: RequestInit,
): Promise<T> {
  const res = await fetch(`${API_BASE}${endpoint}`, {
    ...init,
    headers: {
      ...(init?.headers ?? {}),
      Authorization: `Bearer ${token}`,
    },
  })
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`${endpoint} returned ${res.status}: ${text.slice(0, 200)}`)
  }
  return (await res.json()) as T
}

export default function AdminDiagView() {
  const [token, setToken] = useState<string>(() => {
    try {
      return localStorage.getItem(TOKEN_STORAGE_KEY) ?? ''
    } catch {
      return ''
    }
  })
  const [tokenInput, setTokenInput] = useState(token)
  const [autoRefresh, setAutoRefresh] = useState(true)
  const [stats, setStats] = useState<CacheStatsResponse | null>(null)
  const [health, setHealth] = useState<HealthResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [lastRefresh, setLastRefresh] = useState<number | null>(null)

  const persistToken = useCallback((value: string) => {
    setToken(value)
    try {
      if (value) localStorage.setItem(TOKEN_STORAGE_KEY, value)
      else localStorage.removeItem(TOKEN_STORAGE_KEY)
    } catch {
      // ignore (localStorage off / private mode)
    }
  }, [])

  const refresh = useCallback(async () => {
    if (!token) {
      setError('Wpisz token diag w polu powyżej')
      return
    }
    setLoading(true)
    setError(null)
    try {
      const [statsResult, healthResult] = await Promise.all([
        fetchJson<CacheStatsResponse>('/api/_diag/cache-stats', token),
        fetchJson<HealthResponse>('/api/_diag/health', token),
      ])
      setStats(statsResult)
      setHealth(healthResult)
      setLastRefresh(Date.now())
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      setError(msg)
    } finally {
      setLoading(false)
    }
  }, [token])

  // Auto-refresh, off-able togglem.
  useEffect(() => {
    if (!autoRefresh || !token) return
    void refresh()
    const id = window.setInterval(() => void refresh(), REFRESH_INTERVAL_MS)
    return () => window.clearInterval(id)
  }, [autoRefresh, token, refresh])

  const handleResetMetrics = useCallback(async () => {
    if (!token) return
    if (!window.confirm('Wyczyścić WSZYSTKIE liczniki + latency ring buffer?')) {
      return
    }
    try {
      await fetchJson<{ ok: boolean; cleared: number }>(
        '/api/_diag/cache-stats',
        token,
        {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ confirm: true }),
        },
      )
      toast('Metryki wyczyszczone')
      void refresh()
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      toast.error(`Reset failed: ${msg}`)
    }
  }, [token, refresh])

  return (
    <div className="mx-auto w-full max-w-5xl space-y-4 px-4 py-6 md:px-6 md:py-8">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-fg-primary">
            Diagnostyka /api/_diag
          </h1>
          <p className={`mt-1 text-sm ${theme.colors.text.secondary}`}>
            Cache hit-rates, latency, health checks, circuit breaker.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <label className="flex cursor-pointer items-center gap-2 text-sm text-fg-secondary">
            <input
              type="checkbox"
              checked={autoRefresh}
              onChange={(e) => setAutoRefresh(e.target.checked)}
              className="h-4 w-4 rounded border-zinc-300 dark:border-white/20"
            />
            Auto refresh (10s)
          </label>
          <button
            type="button"
            onClick={() => void refresh()}
            disabled={loading || !token}
            className="inline-flex items-center gap-1.5 rounded-md border border-zinc-200 bg-white/80 px-3 py-1.5 text-sm text-fg-secondary transition-colors hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-white/10 dark:bg-zinc-900/70 dark:hover:bg-zinc-800"
          >
            <RefreshCcw size={14} className={loading ? 'animate-spin' : ''} />
            Odśwież
          </button>
          <button
            type="button"
            onClick={() => void handleResetMetrics()}
            disabled={!token}
            className="inline-flex items-center gap-1.5 rounded-md border border-rose-200 bg-rose-50 px-3 py-1.5 text-sm text-rose-700 transition-colors hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-50 dark:border-rose-400/30 dark:bg-rose-500/10 dark:text-rose-200 dark:hover:bg-rose-500/20"
          >
            <Trash2 size={14} />
            Reset
          </button>
        </div>
      </header>

      {/* Token */}
      <BaseCard className="p-4">
        <label
          htmlFor="diag-token"
          className="mb-2 block text-xs font-medium text-fg-secondary"
        >
          DIAG_TOKEN — pamiętany w localStorage
        </label>
        <div className="flex items-center gap-2">
          <input
            id="diag-token"
            type="password"
            value={tokenInput}
            onChange={(e) => setTokenInput(e.target.value)}
            placeholder="Wklej token (env DIAG_TOKEN na Vercelu)"
            className="flex-1 rounded-md border border-zinc-200 bg-white/80 px-3 py-2 font-mono text-xs text-fg-primary outline-none focus:border-logo-navy focus:ring-2 focus:ring-logo-navy/20 dark:border-white/10 dark:bg-zinc-900/70 dark:focus:border-brand-gold-bright dark:focus:ring-brand-gold-bright/20"
          />
          <button
            type="button"
            onClick={() => persistToken(tokenInput.trim())}
            className="rounded-md bg-logo-navy px-3 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90 dark:bg-brand-gold-bright dark:text-zinc-950"
          >
            Zapisz
          </button>
          {token ? (
            <button
              type="button"
              onClick={() => {
                persistToken('')
                setTokenInput('')
                setStats(null)
                setHealth(null)
              }}
              className="rounded-md border border-zinc-200 bg-white/80 px-3 py-2 text-sm text-fg-secondary transition-colors hover:bg-zinc-50 dark:border-white/10 dark:bg-zinc-900/70 dark:hover:bg-zinc-800"
            >
              Wyczyść
            </button>
          ) : null}
        </div>
        {lastRefresh ? (
          <p className="mt-2 text-xs text-fg-tertiary">
            Ostatni refresh:{' '}
            {new Date(lastRefresh).toLocaleTimeString('pl-PL')}
          </p>
        ) : null}
      </BaseCard>

      {error ? (
        <BaseCard className="border-rose-300 bg-rose-50 p-4 text-sm text-rose-800 dark:border-rose-400/40 dark:bg-rose-500/10 dark:text-rose-200">
          <div className="flex items-start gap-2">
            <AlertTriangle size={16} className="mt-0.5 shrink-0" />
            <div>
              <p className="font-medium">Błąd pobierania</p>
              <p className="mt-1 wrap-break-word font-mono text-xs">{error}</p>
            </div>
          </div>
        </BaseCard>
      ) : null}

      {health ? <HealthSection health={health} /> : null}
      {stats ? <CacheStatsSection stats={stats} /> : null}
      {stats ? <ToolUsageSection counters={stats.counters} /> : null}
      {stats ? <LatencySection latency={stats.latency} /> : null}
      {stats ? <RawDataSection stats={stats} health={health} /> : null}

      {!stats && !error && !loading ? (
        <BaseCard className="p-8 text-center">
          <Activity size={36} className="mx-auto mb-3 text-fg-tertiary" />
          <p className="text-sm text-fg-secondary">
            Wpisz token i kliknij „Odśwież" żeby pobrać dane.
          </p>
        </BaseCard>
      ) : null}
    </div>
  )
}

function HealthSection({ health }: { health: HealthResponse }) {
  const overallTone =
    health.overall === 'ok'
      ? 'bg-emerald-50 text-emerald-800 dark:bg-emerald-500/10 dark:text-emerald-200'
      : health.overall === 'degraded'
        ? 'bg-amber-50 text-amber-800 dark:bg-amber-500/10 dark:text-amber-200'
        : 'bg-rose-50 text-rose-800 dark:bg-rose-500/10 dark:text-rose-200'

  return (
    <BaseCard className="p-4">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-fg-primary">Health</h2>
        <span
          className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ${overallTone}`}
        >
          {health.overall === 'ok' ? (
            <CheckCircle2 size={12} />
          ) : health.overall === 'degraded' ? (
            <AlertTriangle size={12} />
          ) : (
            <XCircle size={12} />
          )}
          {health.overall.toUpperCase()}
        </span>
      </div>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
        <CheckTile name="Supabase" check={health.checks.supabase} />
        <CheckTile name="KV (Upstash)" check={health.checks.kv} />
        <CheckTile name="Groq" check={health.checks.groq} />
      </div>
      <CircuitBreakerTile cb={health.circuitBreaker} />
    </BaseCard>
  )
}

function CheckTile({ name, check }: { name: string; check: HealthCheck }) {
  return (
    <div
      className={`rounded-md border p-3 ${
        check.ok
          ? 'border-emerald-200 bg-emerald-50/50 dark:border-emerald-400/30 dark:bg-emerald-500/5'
          : 'border-rose-200 bg-rose-50/50 dark:border-rose-400/30 dark:bg-rose-500/5'
      }`}
    >
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-fg-primary">{name}</span>
        {check.ok ? (
          <CheckCircle2 size={14} className="text-emerald-600 dark:text-emerald-400" />
        ) : (
          <XCircle size={14} className="text-rose-600 dark:text-rose-400" />
        )}
      </div>
      <p className="mt-1 font-mono text-xs text-fg-secondary">
        {check.latencyMs}ms
      </p>
      {check.error ? (
        <p className="mt-1 wrap-break-word font-mono text-[10px] text-rose-700 dark:text-rose-300">
          {check.error}
        </p>
      ) : null}
    </div>
  )
}

function CircuitBreakerTile({
  cb,
}: {
  cb: HealthResponse['circuitBreaker']
}) {
  const tone =
    cb.state === 'CLOSED'
      ? 'border-emerald-200 bg-emerald-50/40 text-emerald-800 dark:border-emerald-400/30 dark:bg-emerald-500/5 dark:text-emerald-200'
      : cb.state === 'HALF_OPEN'
        ? 'border-amber-200 bg-amber-50/40 text-amber-800 dark:border-amber-400/30 dark:bg-amber-500/5 dark:text-amber-200'
        : 'border-rose-300 bg-rose-50 text-rose-800 dark:border-rose-400/40 dark:bg-rose-500/10 dark:text-rose-200'
  return (
    <div className={`mt-3 rounded-md border p-3 ${tone}`}>
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold">Groq Circuit Breaker</span>
        <span className="rounded-full bg-white/60 px-2 py-0.5 font-mono text-[10px] dark:bg-zinc-900/60">
          {cb.state}
        </span>
      </div>
      <p className="mt-1 text-xs">
        Errory w oknie 60s: <span className="font-mono">{cb.recentErrors}</span>
        {cb.retryAfterSec != null ? (
          <>
            {' '}
            • Otwarty jeszcze <span className="font-mono">{cb.retryAfterSec}s</span>
          </>
        ) : null}
      </p>
    </div>
  )
}

function CacheStatsSection({ stats }: { stats: CacheStatsResponse }) {
  return (
    <BaseCard className="p-4">
      <h2 className="mb-3 text-sm font-semibold text-fg-primary">Hit rates</h2>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <HitRateTile
          label="Response cache"
          value={stats.derived['response_cache:hit_rate']}
          hits={stats.counters['response_cache:hit'] ?? 0}
          misses={stats.counters['response_cache:miss'] ?? 0}
          inverse
        />
        <HitRateTile
          label="Fast path"
          value={stats.derived['fast_path:hit_rate']}
          hits={stats.counters['fast_path:hit'] ?? 0}
          misses={stats.counters['fast_path:miss'] ?? 0}
        />
        <HitRateTile
          label="Tool cache"
          value={stats.derived['tool_cache:hit_rate']}
          hits={stats.counters['tool_cache:hit'] ?? 0}
          misses={stats.counters['tool_cache:miss'] ?? 0}
        />
      </div>
      <p className="mt-3 text-xs text-fg-tertiary">
        Inverse na response cache = niższy hit rate = więcej Groq calls (zgodne
        z polityką „mniej cache, więcej Groqa").
      </p>
    </BaseCard>
  )
}

function HitRateTile({
  label,
  value,
  hits,
  misses,
  inverse,
}: {
  label: string
  value: number | null | undefined
  hits: number
  misses: number
  inverse?: boolean
}) {
  const total = hits + misses
  const display =
    value == null ? '—' : `${Math.round(value * 1000) / 10}%`
  const tone =
    value == null
      ? 'border-zinc-200 dark:border-white/10'
      : (inverse ? value < 0.3 : value > 0.5)
        ? 'border-emerald-300 bg-emerald-50/40 dark:border-emerald-400/30 dark:bg-emerald-500/5'
        : (inverse ? value < 0.6 : value > 0.2)
          ? 'border-amber-300 bg-amber-50/40 dark:border-amber-400/30 dark:bg-amber-500/5'
          : 'border-rose-300 bg-rose-50/40 dark:border-rose-400/30 dark:bg-rose-500/5'
  return (
    <div className={`rounded-md border p-3 ${tone}`}>
      <p className="text-xs font-medium text-fg-secondary">{label}</p>
      <p className="mt-1 text-2xl font-semibold tabular-nums text-fg-primary">
        {display}
      </p>
      <p className="mt-1 font-mono text-[11px] text-fg-tertiary">
        {hits} hit / {misses} miss / {total} total
      </p>
    </div>
  )
}

function ToolUsageSection({ counters }: { counters: CounterMap }) {
  // Suma per-tool: tool_cache:hit:<name> + tool_cache:miss:<name>
  const toolStats = useMemo(() => {
    const map = new Map<string, { hits: number; misses: number }>()
    for (const [key, value] of Object.entries(counters)) {
      let m: RegExpMatchArray | null
      if ((m = key.match(/^tool_cache:hit:(.+)$/))) {
        const name = m[1]
        const cur = map.get(name) ?? { hits: 0, misses: 0 }
        cur.hits += value
        map.set(name, cur)
      } else if ((m = key.match(/^tool_cache:miss:(.+)$/))) {
        const name = m[1]
        const cur = map.get(name) ?? { hits: 0, misses: 0 }
        cur.misses += value
        map.set(name, cur)
      }
    }
    return Array.from(map.entries())
      .map(([name, s]) => ({ name, ...s, total: s.hits + s.misses }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 10)
  }, [counters])

  if (toolStats.length === 0) return null
  const max = toolStats[0].total
  return (
    <BaseCard className="p-4">
      <h2 className="mb-3 text-sm font-semibold text-fg-primary">
        Top tools (cache hit + miss)
      </h2>
      <div className="space-y-2">
        {toolStats.map((t) => (
          <div key={t.name} className="flex items-center gap-3">
            <span className="w-48 truncate font-mono text-xs text-fg-secondary">
              {t.name}
            </span>
            <div className="relative h-5 flex-1 overflow-hidden rounded-md bg-zinc-100 dark:bg-zinc-800">
              <div
                className="absolute inset-y-0 left-0 bg-emerald-500/60"
                style={{ width: `${(t.hits / max) * 100}%` }}
              />
              <div
                className="absolute inset-y-0 bg-amber-500/60"
                style={{
                  left: `${(t.hits / max) * 100}%`,
                  width: `${(t.misses / max) * 100}%`,
                }}
              />
            </div>
            <span className="w-32 text-right font-mono text-[11px] text-fg-tertiary">
              {t.hits}h / {t.misses}m
            </span>
          </div>
        ))}
      </div>
      <p className="mt-3 text-xs text-fg-tertiary">
        Zielony = hit (Supabase oszczędzony), pomarańczowy = miss (świeży
        fetch z DB).
      </p>
    </BaseCard>
  )
}

function LatencySection({ latency }: { latency: LatencyMap }) {
  const entries = Object.entries(latency).sort((a, b) =>
    a[0].localeCompare(b[0]),
  )
  if (entries.length === 0) return null

  return (
    <BaseCard className="p-4">
      <h2 className="mb-3 text-sm font-semibold text-fg-primary">
        Latency (ostatnie {entries[0]?.[1]?.count ?? 0} pomiarów / bucket)
      </h2>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead className="border-b border-zinc-200 text-left text-fg-secondary dark:border-white/10">
            <tr>
              <th className="py-2 pr-3 font-medium">Bucket</th>
              <th className="py-2 pr-3 text-right font-medium">count</th>
              <th className="py-2 pr-3 text-right font-medium">p50</th>
              <th className="py-2 pr-3 text-right font-medium">p95</th>
              <th className="py-2 pr-3 text-right font-medium">avg</th>
              <th className="py-2 pr-3 text-right font-medium">min</th>
              <th className="py-2 text-right font-medium">max</th>
            </tr>
          </thead>
          <tbody className="font-mono">
            {entries.map(([key, s]) => (
              <tr
                key={key}
                className="border-b border-zinc-100 last:border-0 dark:border-white/5"
              >
                <td className="py-1.5 pr-3 text-fg-primary">{key}</td>
                <td className="py-1.5 pr-3 text-right text-fg-secondary">{s.count}</td>
                <td className="py-1.5 pr-3 text-right text-fg-primary">{s.p50}</td>
                <td className="py-1.5 pr-3 text-right text-fg-primary">{s.p95}</td>
                <td className="py-1.5 pr-3 text-right text-fg-secondary">{s.avg}</td>
                <td className="py-1.5 pr-3 text-right text-fg-tertiary">{s.min}</td>
                <td className="py-1.5 text-right text-fg-tertiary">{s.max}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </BaseCard>
  )
}

function RawDataSection({
  stats,
  health,
}: {
  stats: CacheStatsResponse
  health: HealthResponse | null
}) {
  const [open, setOpen] = useState(false)
  return (
    <BaseCard className="p-4">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between text-sm font-semibold text-fg-primary"
      >
        Surowy JSON
        {open ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
      </button>
      {open ? (
        <pre className="mt-3 max-h-[600px] overflow-auto rounded-md bg-zinc-900 p-3 text-[11px] leading-snug text-zinc-100 dark:bg-zinc-950">
{JSON.stringify({ stats, health }, null, 2)}
        </pre>
      ) : null}
    </BaseCard>
  )
}
