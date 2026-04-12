import axios from 'axios'
import { parsePage, WZIK_ISI_KOMUNIKATY_URL } from './api/scrape-wziks'

async function main() {
  const { data: html, status } = await axios.get<string>(WZIK_ISI_KOMUNIKATY_URL, {
    headers: {
      'User-Agent': 'UJverse-debug-scraper/1.0',
      Accept: 'text/html,application/xhtml+xml',
    },
    timeout: 30000,
    responseType: 'text',
    transformResponse: [(d) => d],
  })

  if (status !== 200 || typeof html !== 'string') {
    console.error('Nie udało się pobrać strony ISI, status:', status)
    process.exitCode = 1
    return
  }

  const rows = parsePage(html)

  console.log('\n--- Sparsowane ogłoszenia (', rows.length, ') ---\n')
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i]
    console.log(`#${i + 1}`, {
      lecturer_name: r.lecturer_name,
      status: r.status,
      department: r.department,
      bodyPreview: r.body.slice(0, 160) + (r.body.length > 160 ? '…' : ''),
    })
  }
  console.log('\n--- Pełny JSON (pierwsze 2 wpisy) ---\n')
  console.log(JSON.stringify(rows.slice(0, 2), null, 2))
}

main().catch((e) => {
  console.error(e)
  process.exitCode = 1
})
