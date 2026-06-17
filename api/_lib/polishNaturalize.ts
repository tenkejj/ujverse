/**
 * Lekki post-processing — łapie najczęstsze „tłumaczeniowe" frazy,
 * które Llama/Qwen wciąż generują mimo promptu. Bez drugiego calla LLM.
 * Konserwatywnie: tylko oczywiste wzorce, żeby nie psuć sensu.
 */

const LEADING_MAM_DLA_CIEBIE = /^Mam dla Ciebie\s+/i
const LEADING_CHEtnie_POMOGE = /^Chętnie (Ci )?pomogę[.!]?\s*/i
const DOSTEPNE_OPCJE = /\bdostępne opcje\b/gi
const ZOSTALO_ZNALEZIONE = /\bzostało znalezion[eo]\b/gi
const WYNIKI_WYSZUKIWANIA = /\bwynik[ió]w wyszukiwania\b/gi
const LEADING_NA_PODSTAWIE = /^Na podstawie[^.!?]{0,80}[.!?]\s*/i
const NIEPOSIADAM = /\bNiestety,?\s+nie posiadam\b/gi
const ZNALAZLEM_ELEMENTY = /\bZnalazłem\s+(\d+)\s+(wyników?|elementów?|pozycji?)\b/gi
const W_TWOJEJ_OKOLICY = /\bw\s+Twojej\s+okolicy\b/gi
const W_KONTEKŚCIE = /\bW\s+kontekście\s+/gi
const WYGLADA_NA_TO = /\bWygląda\s+na\s+to,?\s+że\s+/gi
const INFORMUJE_ZE = /\bInformuję,?\s+że\s+/gi
const LOKALIZACJA = /\blokalizacja:\s*/gi

export function softenTranslationese(text: string): string {
  if (!text || text.length === 0) return text

  let t = text.trim()

  t = t.replace(LEADING_MAM_DLA_CIEBIE, '')
  t = t.replace(LEADING_CHEtnie_POMOGE, '')
  t = t.replace(DOSTEPNE_OPCJE, 'opcje')
  t = t.replace(ZOSTALO_ZNALEZIONE, 'jest')
  t = t.replace(WYNIKI_WYSZUKIWANIA, 'wyników')
  t = t.replace(LEADING_OTO, 'Masz $1 ')
  t = t.replace(LEADING_NA_PODSTAWIE, '')
  t = t.replace(NIEPOSIADAM, 'Nie mam')
  t = t.replace(
    ZNALAZLEM_ELEMENTY,
    (_, n: string, kind: string) =>
      kind.startsWith('wynik') ? `Jest ${n} miejsc` : `Jest ${n} rzeczy`,
  )
  t = t.replace(W_TWOJEJ_OKOLICY, 'w okolicy')
  t = t.replace(W_KONTEKŚCIE, '')
  t = t.replace(WYGLADA_NA_TO, '')
  t = t.replace(INFORMUJE_ZE, '')
  t = t.replace(LOKALIZACJA, 'miejsce: ')

  // Podwójne spacje po wycięciach
  t = t.replace(/\s{2,}/g, ' ').trim()

  // Kapitalizacja po wycięciu leada
  if (t.length > 0) {
    t = t.charAt(0).toUpperCase() + t.slice(1)
  }

  return t
}
