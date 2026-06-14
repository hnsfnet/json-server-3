import type { Item } from './service.ts'

// UTF-8 BOM so Excel opens the file with correct encoding
const BOM = '\uFEFF'

function escapeField(value: unknown): string {
  if (value === null || value === undefined) return ''
  // Stringify nested objects/arrays so they don't break CSV structure
  const str = typeof value === 'object' ? JSON.stringify(value) : String(value)
  // RFC 4180: fields containing comma, double-quote, or newline must be quoted
  if (str.includes('"') || str.includes(',') || str.includes('\n') || str.includes('\r')) {
    return `"${str.replace(/"/g, '""')}"`
  }
  return str
}

/**
 * Collect all unique keys across every item, preserving insertion order.
 * This ensures the header row is complete even when items have different shapes.
 */
function collectHeaders(items: Item[]): string[] {
  const seen = new Set<string>()
  const headers: string[] = []
  for (const item of items) {
    for (const key of Object.keys(item)) {
      if (!seen.has(key)) {
        seen.add(key)
        headers.push(key)
      }
    }
  }
  return headers
}

/**
 * Convert an array of items to a CSV string.
 *
 * - Prepends a UTF-8 BOM for Excel compatibility.
 * - Generates a header row from all unique keys across items.
 * - Escapes fields that contain commas, double-quotes, or newlines.
 * - Returns only the BOM + header row (with no data rows) when items is empty,
 *   so the exported file still has meaningful structure.
 */
export function toCSV(items: Item[]): string {
  const headers = collectHeaders(items)
  const lines = [headers.join(',')]
  for (const item of items) {
    lines.push(headers.map((h) => escapeField(item[h])).join(','))
  }
  return BOM + lines.join('\r\n') + '\r\n'
}
