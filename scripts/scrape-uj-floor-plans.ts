/**
 * scrape-uj-floor-plans.ts
 *
 * Próba pobrania publicznie dostępnych rzutów pięter dla budynków UJ
 * z manifestu. Skrypt jest CELOWO konserwatywny: dla większości budynków
 * UJ rzuty NIE są publicznie dostępne (sprawdzaliśmy strony wydziałowe),
 * więc framework jest zbudowany pod stopniowe dopisywanie wpisów do
 * `MANIFEST` w miarę jak admini odnajdują źródła.
 *
 * Co skrypt robi:
 *   1. Iteruje po `MANIFEST` (tablica `{ building_id, level, url, … }`).
 *   2. Pobiera każdy URL (PDF / PNG / JPG) do `public/floor-plans/{id}/{level}.{ext}`.
 *   3. Loguje wynik per wpis (OK / 404 / failed download).
 *   4. NIE robi UPSERT do Supabase samodzielnie — bounds wymagają
 *      ręcznej kalibracji w narzędziu typu MapWarper / qgis. Skrypt
 *      tylko ściąga obrazek; admin potem georeferuje i robi UPDATE
 *      bezpośrednio w SQL (albo używa drugiego skryptu `upload-floor-plan.ts`
 *      gdy go napiszemy).
 *
 * Użycie:
 *   npm run floor-plans:scrape           # pobierz wszystko
 *   npm run floor-plans:scrape -- --only=mickiewicza-22-bj
 *
 * Dorzucanie nowych wpisów: po prostu dodaj rekord do `MANIFEST` poniżej.
 * Format `source_url` to MOCK; podstaw prawdziwy URL gdy ktoś go znajdzie.
 *
 * UWAGA: Skrypt nie scrapuje WordPressów wydziałowych "magicznie" —
 * wymaga ręcznego znalezienia URLi. Dla każdego nowego budynku trzeba:
 *   a) wyszukać na stronie wydziału `plan piętra | rzut budynku | mapa`,
 *   b) skopiować bezpośredni URL do PDF/PNG,
 *   c) dorzucić wpis tutaj.
 */

import { mkdir, writeFile } from 'node:fs/promises'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

type ManifestEntry = {
  building_id: string
  level: number
  source_url: string
  source_label: string
  /** Wymuszony format pliku po stronie zapisu (jeśli URL nie ma rozszerzenia). */
  ext?: 'png' | 'jpg' | 'pdf' | 'svg'
  /** Komentarz do dziennika — np. "wymaga konwersji PDF→PNG". */
  notes?: string
}

const __dirname = dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = resolve(__dirname, '..')
const PUBLIC_DIR = join(REPO_ROOT, 'public', 'floor-plans')

/**
 * EDIT ME: dorzucaj wpisy w miarę odnajdywania publicznych URLi.
 *
 * Status po pierwszym recon (2026-06):
 *   * Biblioteka Jagiellońska: bj.uj.edu.pl publikuje "plan czytelni"
 *     na stronie kontaktowej, ale to PDF z wieloma stronami — wymaga
 *     manualnej ekstrakcji jednej strony per piętro.
 *   * Auditorium Maximum: auditoriummaximum.uj.edu.pl ma "plan sal"
 *     w sekcji "wynajem". URL ukryty pod redirect'em — sprawdź ręcznie.
 *   * Reszta budynków UJ: brak publicznych planów. Crowdsourcing
 *     przez `Wgraj plan piętra` CTA w aplikacji.
 *
 * Format URL: bezpośredni link do obrazka albo PDF. Jeśli PDF —
 * skrypt zapisze .pdf i zostawi konwersję na admina (poppler / pdf2png).
 */
const MANIFEST: ManifestEntry[] = [
  // Przykładowe wpisy — odkomentuj i podstaw prawdziwe URLe.
  //
  // {
  //   building_id: 'mickiewicza-22-bj',
  //   level: 0,
  //   source_url: 'https://bj.uj.edu.pl/plan-budynku/parter.pdf',
  //   source_label: 'BJ — plan parteru (PDF, oficjalny)',
  //   ext: 'pdf',
  //   notes: 'Wymaga konwersji PDF → PNG; zostaw na adminie po pobraniu.',
  // },
  // {
  //   building_id: 'auditorium-maximum',
  //   level: 0,
  //   source_url: 'https://auditoriummaximum.uj.edu.pl/uploads/plany/parter.png',
  //   source_label: 'Audi Max — plan sal parter',
  // },
]

type ScrapeResult =
  | { ok: true; entry: ManifestEntry; outputPath: string; bytes: number }
  | { ok: false; entry: ManifestEntry; reason: string }

async function downloadOne(entry: ManifestEntry): Promise<ScrapeResult> {
  const ext =
    entry.ext ??
    (entry.source_url.match(/\.(png|jpg|jpeg|pdf|svg|webp)(\?|$)/i)?.[1]?.toLowerCase() ??
      'png')

  const outDir = join(PUBLIC_DIR, entry.building_id)
  const outFile = join(outDir, `${entry.level}.${ext}`)

  try {
    const res = await fetch(entry.source_url, {
      redirect: 'follow',
      headers: {
        'User-Agent': 'UJverse-FloorPlanScraper/1.0 (+https://ujverse.pl)',
      },
    })

    if (!res.ok) {
      return {
        ok: false,
        entry,
        reason: `HTTP ${res.status} ${res.statusText}`,
      }
    }

    const buf = new Uint8Array(await res.arrayBuffer())
    await mkdir(outDir, { recursive: true })
    await writeFile(outFile, buf)

    return { ok: true, entry, outputPath: outFile, bytes: buf.byteLength }
  } catch (err: unknown) {
    return {
      ok: false,
      entry,
      reason: err instanceof Error ? err.message : 'Unknown fetch error',
    }
  }
}

function parseArgs(): { only: string | null } {
  const arg = process.argv.find((a) => a.startsWith('--only='))
  if (!arg) return { only: null }
  return { only: arg.split('=')[1]?.trim() || null }
}

async function main() {
  const { only } = parseArgs()
  const filtered = only
    ? MANIFEST.filter((e) => e.building_id === only)
    : MANIFEST

  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log(' UJverse — scrape-uj-floor-plans.ts')
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log(`Output dir: ${PUBLIC_DIR}`)
  console.log(`Wpisów w manifeście: ${MANIFEST.length}`)
  if (only) console.log(`Filter: building_id=${only} (${filtered.length} wpisów)`)
  console.log('')

  if (filtered.length === 0) {
    console.log('⚠ Manifest jest pusty — dorzuć URLe do MANIFEST w skrypcie.')
    console.log('  Strony do recon (2026-06):')
    console.log('    * bj.uj.edu.pl / plan-budynku')
    console.log('    * auditoriummaximum.uj.edu.pl / wynajem-sal')
    console.log('    * wpia.uj.edu.pl / informacje praktyczne')
    console.log('    * maius.uj.edu.pl / muzeum (mapa zwiedzania)')
    console.log('  Dla pozostałych: liczymy na crowd-source przez UI ("Wgraj plan").')
    return
  }

  const results: ScrapeResult[] = []
  for (const entry of filtered) {
    process.stdout.write(`→ ${entry.building_id} L${entry.level} … `)
    const r = await downloadOne(entry)
    if (r.ok) {
      console.log(`OK (${(r.bytes / 1024).toFixed(1)} KB → ${r.outputPath})`)
    } else {
      console.log(`FAIL: ${r.reason}`)
    }
    results.push(r)
  }

  const ok = results.filter((r): r is Extract<ScrapeResult, { ok: true }> => r.ok)
  const fail = results.filter((r): r is Extract<ScrapeResult, { ok: false }> => !r.ok)

  console.log('')
  console.log('━━━━ Summary ━━━━')
  console.log(`Pobrane: ${ok.length}/${results.length}`)
  console.log(`Błędy:   ${fail.length}`)

  if (ok.length > 0) {
    console.log('')
    console.log('Następny krok (manualny, dla każdego pobranego):')
    console.log('  1. Otwórz obrazek/PDF w MapWarper.net albo QGIS.')
    console.log('  2. Zgeoreferencjuj — odczytaj N/S/E/W bounds w stopniach.')
    console.log('  3. UPDATE public.uj_building_floor_plans SET image_url=…,')
    console.log('     bounds_north=…, bounds_south=…, bounds_east=…, bounds_west=…,')
    console.log("     status='published' WHERE building_id='…' AND level=…;")
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
