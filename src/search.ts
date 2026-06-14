// Full-text keyword search used by the `_q` query param.
//
// Unlike `_where` (field-level, exact/operator filtering), this performs a
// case-insensitive substring match across every nested string and number value
// of an item, so simple keyword searches don't require hand-written conditions.

function valueMatches(value: unknown, term: string): boolean {
  if (typeof value === 'string') {
    return value.toLowerCase().includes(term)
  }

  // Coerce numbers (and bigints) so that e.g. `?_q=100` matches `views: 100`.
  if (typeof value === 'number' || typeof value === 'bigint') {
    if (typeof value === 'number' && !Number.isFinite(value)) return false
    return String(value).toLowerCase().includes(term)
  }

  if (Array.isArray(value)) {
    return value.some((entry) => valueMatches(entry, term))
  }

  if (value !== null && typeof value === 'object') {
    return Object.values(value as Record<string, unknown>).some((entry) =>
      valueMatches(entry, term),
    )
  }

  // Booleans, null, undefined and functions are intentionally not searchable.
  return false
}

/**
 * Normalize a raw `_q` value into a comparable search term.
 *
 * Returns `null` when there is nothing meaningful to search for (missing value,
 * empty string, whitespace-only, or a non-string such as an array of repeated
 * params), so callers can simply skip filtering and keep the endpoint stable.
 */
export function normalizeSearchTerm(raw: unknown): string | null {
  if (typeof raw !== 'string') return null

  const trimmed = raw.trim()
  if (trimmed === '') return null

  return trimmed.toLowerCase()
}

/**
 * Returns `true` when `item` contains `term` somewhere in its nested values.
 *
 * `term` is expected to be already normalized via {@link normalizeSearchTerm}.
 * An empty term matches everything, so an accidental empty search never hides
 * results.
 */
export function matchesSearch(item: unknown, term: string): boolean {
  if (term === '') return true
  return valueMatches(item, term)
}
