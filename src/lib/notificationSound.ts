/**
 * notificationSound — drobny "ping" Web Audio API odtwarzany kiedy do appki
 * trafia nowe powiadomienie. Brak assetu mp3 — generujemy ton w locie,
 * dwie krótkie nuty (E5 → A5), tak żeby było słyszalne ale nie nachalne.
 *
 * Wywołanie: sprawdza preferencję użytkownika (`notificationSound`) — jeśli
 * wyłączone, nic nie robi. Bezpieczne dla SSR (brak `window`).
 */

import { getUserPreferences } from './userPreferences'

type AudioCtxCtor = typeof AudioContext
type WindowWithWebkit = Window & {
  webkitAudioContext?: AudioCtxCtor
}

let cachedCtx: AudioContext | null = null

function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null
  if (cachedCtx) return cachedCtx
  const w = window as WindowWithWebkit
  const Ctor: AudioCtxCtor | undefined = window.AudioContext ?? w.webkitAudioContext
  if (!Ctor) return null
  try {
    cachedCtx = new Ctor()
    return cachedCtx
  } catch {
    return null
  }
}

function scheduleTone(ctx: AudioContext, frequency: number, startAt: number, duration: number) {
  const osc = ctx.createOscillator()
  const gain = ctx.createGain()
  osc.type = 'sine'
  osc.frequency.value = frequency
  // Krótka obwiednia ADSR — bez "klika" na koniec.
  gain.gain.setValueAtTime(0, startAt)
  gain.gain.linearRampToValueAtTime(0.085, startAt + 0.012)
  gain.gain.exponentialRampToValueAtTime(0.0001, startAt + duration)
  osc.connect(gain)
  gain.connect(ctx.destination)
  osc.start(startAt)
  osc.stop(startAt + duration + 0.02)
}

/**
 * Odtwórz delikatny ping (dwie nuty). Respektuje `notificationSound` z prefs
 * oraz `prefers-reduced-motion` (nie chce drażnić użytkownika z dostępnościowym
 * trybem).
 */
export function playNotificationPing(): void {
  if (typeof window === 'undefined') return
  const prefs = getUserPreferences()
  if (!prefs.notificationSound) return
  if (prefs.reducedMotion) return

  const ctx = getAudioContext()
  if (!ctx) return

  // Niektóre przeglądarki blokują AudioContext do czasu user gesture —
  // jeśli jest "suspended", próbujemy wznowić, ale nie czekamy synchronicznie.
  if (ctx.state === 'suspended') {
    void ctx.resume().catch(() => {})
  }

  const start = ctx.currentTime + 0.01
  scheduleTone(ctx, 659.25, start, 0.12) // E5
  scheduleTone(ctx, 880.0, start + 0.09, 0.16) // A5
}
