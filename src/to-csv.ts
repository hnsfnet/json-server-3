import type { Item } from './service.ts'

// Convert a single value to its string cell representation.
// - null/undefined become empty cells
// - objects/arrays (e.g. embedded relations) are JSON-encoded so nothing is lost
// - everything else is stringified
function formatCell(value: unknown): string {
  if (value === null || value === undefined) return ''
  if (typeof value === 'object') return JSON.stringify(value)
  return String(value)
}

// Escape a cell following RFC 4180: wrap in double quotes when it contains a
// comma, a double quote, or a line break, and double any embedded quotes.
function escapeCell(value: string): string {
  if (/[",\r\n]/.test(value)) {
    return `"${value.replaceAll('"', '""')}"`
  }
  return value
}

function collectColumns(items: Item[]): string[] {
  const seen = new Set<string>()
  const ordered: string[] = []
  for (const item of items) {
    for (const key of Object.keys(item)) {
      if (!seen.has(key)) {
        seen.add(key)
        ordered.push(key)
      }
    }
  }
  return ordered
}

export type ToCsvOptions = {
  // Explicit column order. When omitted, columns are the union of every item's
  // keys, kept in first-appearance order so the output is stable.
  columns?: string[]
}

// Serialize a list of items to an RFC 4180 CSV string (no BOM).
//
// The first row is always the header. When `items` is empty and no explicit
// `columns` are given, there is no way to know the schema, so an empty string
// is returned. Providing `columns` yields a header-only file for empty input.
export function toCsv(items: Item[], options: ToCsvOptions = {}): string {
  const columns = options.columns ?? collectColumns(items)

  if (columns.length === 0) return ''

  const lines: string[] = [columns.map(escapeCell).join(',')]
  for (const item of items) {
    lines.push(columns.map((column) => escapeCell(formatCell(item[column]))).join(','))
  }

  return lines.join('\r\n')
}
