import type { JsonObject } from 'type-fest'

/**
 * Recursively checks if any string value in the object (including nested objects)
 * contains the keyword (case-insensitive). Numbers are coerced to strings for matching.
 * Arrays are traversed element-by-element.
 */
function deepIncludes(obj: unknown, keyword: string): boolean {
  if (obj === null || obj === undefined) {
    return false
  }

  if (typeof obj === 'string') {
    return obj.toLowerCase().includes(keyword)
  }

  if (typeof obj === 'number' || typeof obj === 'boolean') {
    return String(obj).toLowerCase().includes(keyword)
  }

  if (Array.isArray(obj)) {
    return obj.some((item) => deepIncludes(item, keyword))
  }

  if (typeof obj === 'object') {
    for (const value of Object.values(obj as Record<string, unknown>)) {
      if (deepIncludes(value, keyword)) {
        return true
      }
    }
  }

  return false
}

/**
 * Returns true if the item matches the keyword search.
 * The keyword is trimmed and lowercased before matching.
 * Returns true if the keyword is empty (no filtering).
 */
export function matchesSearch(item: JsonObject, keyword: string): boolean {
  const normalized = keyword.trim().toLowerCase()
  if (normalized === '') {
    return true
  }
  return deepIncludes(item, normalized)
}
