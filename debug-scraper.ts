/**
 * UJverse — debug runner do testowania parserów komunikatów wydziałowych.
 * Copyright © 2026 Franciszek Dranka. All rights reserved.
 * License: Proprietary — see LICENSE in repo root.
 *
 * Uruchomienie:
 *   tsx debug-scraper.ts                # default: WZiKS (ISI UJ)
 *   tsx debug-scraper.ts wpia            # wybrane source by id
 *   tsx debug-scraper.ts wpia phils wbbib  # kilka źródeł na raz
 *
 * Drukuje sparsowane wiersze do stdout bez wpisu do DB i bez Groqa
 * (czysty test parser → ParsedAnnouncement[]).
 */
import {
  FACULTY_SOURCES,
  parseIsiDrupal,
  parseLiferay,
  parseWordpressCm,
  fetchHtml,
} from './api/_lib/scrapers/index.js'
import type { FacultySource, ParsedAnnouncement } from './api/_lib/scrapers/index.js'

function runParser(source: FacultySource, html: string): ParsedAnnouncement[] {
  const department = source.faculty_departments[0] ?? 'Unknown'
  const ctx = { department, source: source.source_label }
  switch (source.parser) {
    case 'isi_drupal':
      return parseIsiDrupal(html, ctx)
    case 'liferay':
      return parseLiferay(html, { ...ctx, baseUrl: source.url })
    case 'wordpress_cm':
      return parseWordpressCm(html, { ...ctx, baseUrl: source.url })
  }
}

async function main() {
  const wanted = process.argv.slice(2)
  const sources =
    wanted.length === 0
      ? FACULTY_SOURCES.filter((s) => s.id === 'wziks')
      : FACULTY_SOURCES.filter((s) => wanted.includes(s.id))

  if (sources.length === 0) {
    console.error('No matching sources. Available:', FACULTY_SOURCES.map((s) => s.id).join(', '))
    process.exitCode = 1
    return
  }

  for (const source of sources) {
    console.log(`\n========= ${source.id} (${source.parser}) =========`)
    console.log(`URL: ${source.url}`)

    let html: string
    try {
      html = await fetchHtml(source.url)
    } catch (e) {
      console.error('  fetch failed:', e instanceof Error ? e.message : e)
      continue
    }

    const rows = runParser(source, html)
    console.log(`  → parsed ${rows.length} announcements`)
    rows.slice(0, 5).forEach((r, i) => {
      console.log(`\n  #${i + 1}`, {
        title: r.title?.slice(0, 80) ?? '(null)',
        lecturer_name: r.lecturer_name,
        status: r.status,
        source_url: r.source_url?.slice(0, 80) ?? '(null)',
        bodyPreview: r.body.slice(0, 160) + (r.body.length > 160 ? '…' : ''),
      })
    })
    if (rows.length > 5) console.log(`\n  … ${rows.length - 5} more`)
  }
}

main().catch((e) => {
  console.error(e)
  process.exitCode = 1
})
