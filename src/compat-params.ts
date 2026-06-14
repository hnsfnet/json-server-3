/**
 * Compatibility layer for v0 query parameters.
 *
 * Normalizes legacy (v0) query parameters to their v1 equivalents so that
 * older clients continue to work without code changes.
 *
 * Supported mappings:
 *   _limit        → _per_page
 *   _start + _end → _page + _per_page  (offset-based → page-based)
 *   _start + _limit → _page + _per_page
 *   _expand       → _embed
 */

export interface NormalizedParams {
  sort?: string
  page?: number
  perPage?: number
  embed?: string | string[]
}

/**
 * All query keys that are treated as special (non-filter) parameters.
 * Both v0 and v1 keys are included so they are stripped from filter params.
 */
export const RESERVED_QUERY_KEYS = new Set([
  // v1
  '_sort',
  '_page',
  '_per_page',
  '_embed',
  '_where',
  // v0 compat
  '_limit',
  '_start',
  '_end',
  '_expand',
])

function toInt(value: string | null | undefined): number | undefined {
  if (value === null || value === undefined) return undefined
  const n = Number.parseInt(value, 10)
  return Number.isNaN(n) ? undefined : n
}

function ensureArray(arg: string | string[] | undefined): string[] {
  if (arg === undefined) return []
  return Array.isArray(arg) ? arg : [arg]
}

/**
 * Given raw URLSearchParams (and the original query object for array values),
 * produce a NormalizedParams with v0 keys translated to v1 semantics.
 *
 * Precedence rules when mixing old and new params:
 *   - v1 params (_page, _per_page) take precedence over v0 (_start, _end, _limit).
 *   - _expand is merged with _embed (deduplicated).
 */
export function normalizeQueryParams(
  params: URLSearchParams,
  query: Record<string, unknown> = {},
): NormalizedParams {
  const sort = params.get('_sort') ?? undefined

  // --- Pagination ---
  // v1 params
  let page = toInt(params.get('_page'))
  let perPage = toInt(params.get('_per_page'))

  // v0 params (used as fallback when v1 equivalents are absent)
  const v0Start = toInt(params.get('_start'))
  const v0End = toInt(params.get('_end'))
  const v0Limit = toInt(params.get('_limit'))

  // Fill perPage from v0 _limit or _end-_start if v1 _per_page not provided
  if (perPage === undefined) {
    if (v0Limit !== undefined) {
      perPage = Math.max(1, v0Limit)
    } else if (v0Start !== undefined && v0End !== undefined) {
      perPage = Math.max(1, v0End - v0Start)
    }
  }

  // Derive page from v0 offset params if v1 _page not provided
  if (page === undefined) {
    if (v0Start !== undefined && perPage !== undefined) {
      page = Math.floor(v0Start / perPage) + 1
    } else if (v0Start !== undefined) {
      // _start alone with no perPage info: use default 10
      perPage = 10
      page = Math.floor(v0Start / perPage) + 1
    } else if (perPage !== undefined) {
      // _limit or _end present without _start or _page: start at page 1
      page = 1
    }
  }

  // --- Embed / Expand ---
  const embedValues = ensureArray(query['_embed'] as string | string[] | undefined)
  const expandValues = ensureArray(query['_expand'] as string | string[] | undefined)

  // Merge and deduplicate
  const merged = [...new Set([...embedValues, ...expandValues])]
  const embed = merged.length > 0 ? merged : undefined

  return {
    sort,
    page,
    perPage,
    embed,
  }
}
