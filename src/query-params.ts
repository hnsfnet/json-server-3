import type { ParsedUrlQuery } from 'node:querystring'

import type { JsonObject } from 'type-fest'

import { parseWhere } from './parse-where.ts'

// Query keys that carry special meaning and must never be treated as filters.
// Keep every reserved key (current and backward-compatible) in this single set
// so future compatibility flags only need to be registered here.
const RESERVED_QUERY_KEYS = new Set([
  // v1
  '_sort',
  '_page',
  '_per_page',
  '_embed',
  '_where',
  // v0 backward-compatible aliases
  '_expand',
  '_limit',
  '_start',
  '_end',
])

export type ListParams = {
  where: JsonObject
  sort: string | undefined
  page: number | undefined
  perPage: number | undefined
  embed: string[]
  limit: number | undefined
  start: number | undefined
  end: number | undefined
}

type RequestLike = {
  url: string
  query: ParsedUrlQuery
}

function toArray(arg: string | string[] | undefined): string[] {
  if (arg === undefined) return []
  return Array.isArray(arg) ? arg : [arg]
}

function parseNumber(value: string | null): number | undefined {
  if (value === null) return undefined
  const n = Number.parseInt(value, 10)
  return Number.isNaN(n) ? undefined : n
}

// Relations can be requested with `_embed` (v1) or `_expand` (v0). Both feed the
// same relation-embedding logic in the service, so merge them into one list.
export function parseEmbed(query: ParsedUrlQuery): string[] {
  return [...toArray(query['_embed']), ...toArray(query['_expand'])]
}

export function parseListParams(req: RequestLike): ListParams {
  const queryString = req.url.split('?')[1] ?? ''
  const params = new URLSearchParams(queryString)

  const filterParams = new URLSearchParams()
  for (const [key, value] of params.entries()) {
    if (!RESERVED_QUERY_KEYS.has(key)) {
      filterParams.append(key, value)
    }
  }

  let where = parseWhere(filterParams.toString())
  const rawWhere = params.get('_where')
  if (typeof rawWhere === 'string') {
    try {
      const parsed = JSON.parse(rawWhere)
      if (typeof parsed === 'object' && parsed !== null) {
        where = parsed as JsonObject
      }
    } catch {
      // Ignore invalid JSON and fallback to parsed query params
    }
  }

  return {
    where,
    sort: params.get('_sort') ?? undefined,
    page: parseNumber(params.get('_page')),
    perPage: parseNumber(params.get('_per_page')),
    embed: parseEmbed(req.query),
    limit: parseNumber(params.get('_limit')),
    start: parseNumber(params.get('_start')),
    end: parseNumber(params.get('_end')),
  }
}
