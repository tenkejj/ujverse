/**
 * Dodaje grupę w Supabase (slug = nazwa tagu).
 * Mapowanie post → grupa robi trigger `on_post_created_or_updated` w bazie.
 *
 * Użycie: npx tsx scripts/create-tag-group.ts <slug>
 * Wymaga: SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY (lub VITE_* odpowiedniki).
 */

import { createClient } from '@supabase/supabase-js'

const supabaseUrl =
  process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL ?? ''
const supabaseKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY ??
  process.env.SUPABASE_SERVICE_KEY ??
  ''

if (!supabaseUrl || !supabaseKey) {
  console.error('Ustaw SUPABASE_URL i SUPABASE_SERVICE_ROLE_KEY w .env')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey)

async function createTagGroup(rawSlug: string) {
  const slug = rawSlug.trim().toLowerCase()
  if (!slug) {
    throw new Error('Slug nie może być pusty.')
  }

  const name = slug.charAt(0).toUpperCase() + slug.slice(1)
  console.log(`Tworzenie grupy: slug="${slug}", name="${name}"…`)

  const { data: group, error } = await supabase
    .from('groups')
    .upsert({ name, slug }, { onConflict: 'slug' })
    .select('id, slug, name')
    .single()

  if (error) {
    console.error('Błąd bazy:', error.message)
    throw error
  }

  console.log('Gotowe:', group)
  console.log(
    'Posty z tagiem #%s będą automatycznie dopinane po INSERT/UPDATE tags (trigger DB).',
    slug,
  )
}

const slug = process.argv[2]
if (!slug) {
  console.error('Użycie: npx tsx scripts/create-tag-group.ts <slug>')
  process.exit(1)
}

createTagGroup(slug).catch(() => process.exit(1))
