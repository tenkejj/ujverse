/** Legacy private-index job retired by the November 2026 search privacy fix.
 * Search now reads Supabase under caller RLS; do not recreate mixed/private indexes.
 */
console.info(
  JSON.stringify(
    {
      ok: true,
      action: 'skipped',
      searchBackend: 'supabase',
      reason: 'legacy_indexing_retired',
      message:
        'Wyszukiwanie korzysta bezpośrednio z Supabase i RLS. Synchronizacja prywatnych indeksów jest wycofana; nie wykonano odczytu ani zapisu danych.',
    },
    null,
    2,
  ),
)
export {}
