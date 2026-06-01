/** Liczba nowych postów w trendzie (odmiana po polsku). */
export function formatTrendingPostCount(count: number): string {
  const n = Math.max(0, Math.floor(count))
  if (n === 1) return '1 nowy post'
  if (n >= 2 && n <= 4) return `${n} nowe posty`
  return `${n} nowych postów`
}
