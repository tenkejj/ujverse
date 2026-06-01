/**
 * scripts/check-meili-tags.ts
 *
 * Diagnostyka stanu pola `tags` w indeksie `ujverse_content`. Uruchamiaj, gdy
 * filtr `#<tag>` w aplikacji nie zwraca wyników mimo, że w Postgresie tagi są.
 *
 * Skrypt odpowiada na cztery pytania jednym przebiegiem:
 *   1. Czy indeks `ujverse_content` istnieje?
 *   2. Czy w `filterableAttributes` znajduje się `tags`? (jeśli nie, filtry padają
 *      błędem `attribute tags is not filterable`).
 *   3. Ile dokumentów typu `post` MA pole `tags` z co najmniej jednym elementem?
 *   4. Czy konkretny filtr (`--tag=<value>`, default `studia`) zwraca wyniki?
 *
 * Uruchomienie:
 *   npx tsx scripts/check-meili-tags.ts
 *   npx tsx scripts/check-meili-tags.ts --tag=ankieta
 *   npx tsx scripts/check-meili-tags.ts --tag=studia --sample=10
 */

import { Meilisearch, type Settings } from 'meilisearch'
import * as dotenv from 'dotenv'

dotenv.config()
dotenv.config({ path: '.env.local', override: true })

const MEILI_HOST = (
  process.env.MEILISEARCH_HOST ||
  process.env.VITE_MEILISEARCH_HOST ||
  'http://localhost:7700'
).trim()

const MEILI_KEY = (
  process.env.MEILISEARCH_MASTER_KEY ||
  process.env.MEILI_MASTER_KEY ||
  process.env.VITE_MEILISEARCH_MASTER_KEY ||
  'admin'
).trim()

const INDEX_UID = (
  process.env.MEILISEARCH_INDEX ||
  process.env.VITE_MEILISEARCH_INDEX ||
  'ujverse_content'
).trim()

function readArg(name: string, fallback: string): string {
  const flag = process.argv.find((arg) => arg.startsWith(`--${name}=`))
  if (!flag) return fallback
  return flag.slice(name.length + 3)
}

const TARGET_TAG = readArg('tag', 'studia').toLowerCase()
const SAMPLE_SIZE = Number.parseInt(readArg('sample', '5'), 10) || 5

const meili = new Meilisearch({ host: MEILI_HOST, apiKey: MEILI_KEY })

type PostDoc = {
  id: string
  sourceId?: string
  type?: string
  content?: string
  tags?: unknown
}

function badge(ok: boolean): string {
  return ok ? '✓' : '✗'
}

async function main(): Promise<void> {
  console.log(`[check] Meilisearch: ${MEILI_HOST}, index="${INDEX_UID}", tag="${TARGET_TAG}"`)
  console.log('')

  // 1. Istnienie indeksu
  try {
    const info = await meili.getIndex(INDEX_UID)
    console.log(`${badge(true)} Indeks "${INDEX_UID}" istnieje (uid=${info.uid}, primaryKey=${info.primaryKey}).`)
  } catch (error) {
    console.error(`${badge(false)} Indeks "${INDEX_UID}" NIE istnieje:`, error)
    process.exit(1)
  }

  const index = meili.index<PostDoc>(INDEX_UID)
  const stats = await index.getStats()
  console.log(`   ↳ łącznie dokumentów: ${stats.numberOfDocuments}`)

  // 2. filterableAttributes
  const settings: Settings = await index.getSettings()
  const filterable = Array.isArray(settings.filterableAttributes) ? settings.filterableAttributes : []
  const hasTags = filterable.includes('tags')
  console.log('')
  console.log(`${badge(hasTags)} filterableAttributes zawiera "tags": ${hasTags}`)
  console.log(`   ↳ aktualne: [${filterable.join(', ')}]`)
  if (!hasTags) {
    console.log('   ↳ FIX: uruchom `npx tsx scripts/resync-search-final.ts` — pchnie filterableAttributes i upsertuje wszystkie posty.')
    // Filtr `tags = ...` dalej nie zadziała, więc pomijamy sanity-search niżej.
    return
  }

  // 3. Próbka postów + ile ma niepustą tablicę `tags`
  const sample = await index.search('', {
    filter: 'type = "post"',
    limit: 1000,
    attributesToRetrieve: ['id', 'sourceId', 'content', 'tags'],
  })

  const postHits = sample.hits ?? []
  const withTags = postHits.filter((hit) => Array.isArray(hit.tags) && hit.tags.length > 0)
  const tagCounter = new Map<string, number>()
  for (const hit of withTags) {
    const tags = Array.isArray(hit.tags) ? hit.tags : []
    for (const raw of tags) {
      if (typeof raw !== 'string') continue
      tagCounter.set(raw, (tagCounter.get(raw) ?? 0) + 1)
    }
  }

  console.log('')
  console.log(
    `${badge(withTags.length > 0)} Posty z co najmniej jednym tagiem: ${withTags.length} / ${postHits.length} pobranych (limit 1000).`,
  )
  if (tagCounter.size > 0) {
    const topTags = [...tagCounter.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([tag, count]) => `${tag} (${count})`)
      .join(', ')
    console.log(`   ↳ TOP tagi w indeksie: ${topTags}`)
  } else {
    console.log('   ↳ Żaden post w indeksie nie ma `tags` — sprawdź sync (webhook / resync).')
  }

  // 4. Sanity check dla konkretnego tagu
  console.log('')
  const escapedTag = TARGET_TAG.replaceAll('"', '\\"')
  const filtered = await index.search('', {
    filter: `tags = "${escapedTag}"`,
    limit: SAMPLE_SIZE,
    attributesToRetrieve: ['id', 'sourceId', 'content', 'tags'],
  })

  const filterHits = filtered.hits ?? []
  const total = filtered.estimatedTotalHits ?? filterHits.length
  console.log(`${badge(filterHits.length > 0)} Filter \`tags = "${TARGET_TAG}"\` zwraca ${total} dokumentów (sample ${filterHits.length}).`)

  if (filterHits.length === 0) {
    const tagPresentSomewhere = tagCounter.has(TARGET_TAG)
    if (tagPresentSomewhere) {
      console.log(`   ↳ Tag "${TARGET_TAG}" widziany w innym dokumencie, ale filtr nic nie zwraca — sprawdź case/normalizację po stronie SearchService.`)
    } else {
      console.log(`   ↳ Tag "${TARGET_TAG}" NIE występuje w żadnym dokumencie w indeksie.`)
      console.log('   ↳ FIX A: jeśli post był publikowany przed wdrożeniem webhooka — `npx tsx scripts/resync-search-final.ts`.')
      console.log('   ↳ FIX B: jeśli w Postgresie post.content ma `#studia` ale post.tags = [] — uruchom `npx tsx scripts/backfill-tags.ts`, potem resync.')
      console.log('   ↳ FIX C: jeśli post.tags w DB ma wartość różną (np. spacja, polski znak), porównaj z `extractPostTags` (regex [a-zA-Z0-9_]).')
    }
  } else {
    console.log(`   ↳ Przykład: id=${filterHits[0].id}, content="${(filterHits[0].content ?? '').slice(0, 80)}..."`)
  }

  console.log('')
  console.log('[check] Gotowe.')
}

main().catch((error: unknown) => {
  console.error('[check] BŁĄD:', error)
  process.exit(1)
})
