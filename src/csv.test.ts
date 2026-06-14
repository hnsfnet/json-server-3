import assert from 'node:assert/strict'
import test from 'node:test'

import { toCSV } from './csv.ts'

// Strip the BOM for easier assertion
function stripBOM(s: string): string {
  return s.startsWith('\uFEFF') ? s.slice(1) : s
}

await test('toCSV', async (t) => {
  await t.test('returns BOM + header + rows for simple items', () => {
    const items = [
      { id: '1', name: 'Alice', age: 30 },
      { id: '2', name: 'Bob', age: 25 },
    ]
    const csv = stripBOM(toCSV(items))
    const lines = csv.split('\r\n')
    assert.equal(lines[0], 'id,name,age')
    assert.equal(lines[1], '1,Alice,30')
    assert.equal(lines[2], '2,Bob,25')
    // trailing CRLF produces an empty final element after split
    assert.equal(lines[3], '')
  })

  await t.test('starts with UTF-8 BOM', () => {
    const csv = toCSV([{ a: 1 }])
    assert.ok(csv.charCodeAt(0) === 0xfeff, 'should start with BOM')
  })

  await t.test('escapes fields containing commas', () => {
    const csv = stripBOM(toCSV([{ note: 'hello, world' }]))
    assert.equal(csv.split('\r\n')[1], '"hello, world"')
  })

  await t.test('escapes fields containing double quotes', () => {
    const csv = stripBOM(toCSV([{ note: 'she said "hi"' }]))
    assert.equal(csv.split('\r\n')[1], '"she said ""hi"""')
  })

  await t.test('escapes fields containing newlines', () => {
    const csv = stripBOM(toCSV([{ note: 'line1\nline2' }]))
    assert.equal(csv.split('\r\n')[1], '"line1\nline2"')
  })

  await t.test('handles null and undefined values as empty strings', () => {
    const csv = stripBOM(toCSV([{ a: null, b: undefined, c: 'ok' } as any]))
    assert.equal(csv.split('\r\n')[1], ',,ok')
  })

  await t.test('returns header-only CSV when items array is empty', () => {
    const csv = stripBOM(toCSV([]))
    // No headers, no data — just an empty header line + trailing CRLF
    assert.equal(csv, '\r\n')
  })

  await t.test('collects headers from all items when shapes differ', () => {
    const items = [
      { id: '1', name: 'Alice' },
      { id: '2', email: 'bob@test.com' },
    ]
    const csv = stripBOM(toCSV(items))
    const lines = csv.split('\r\n')
    assert.equal(lines[0], 'id,name,email')
    assert.equal(lines[1], '1,Alice,')
    assert.equal(lines[2], '2,,bob@test.com')
  })

  await t.test('stringifies nested objects and arrays', () => {
    const items = [{ id: '1', tags: ['a', 'b'], meta: { key: 'val' } }]
    const csv = stripBOM(toCSV(items))
    const lines = csv.split('\r\n')
    assert.equal(lines[0], 'id,tags,meta')
    // JSON.stringify output contains commas/quotes, so it will be escaped
    assert.ok(lines[1].includes('"[""a"",""b""]"'))
    assert.ok(lines[1].includes('"{""key"":""val""}"'))
  })
})
