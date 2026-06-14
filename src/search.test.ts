import assert from 'node:assert/strict'
import test from 'node:test'

import { matchesSearch, normalizeSearchTerm } from './search.ts'

await test('normalizeSearchTerm', async (t) => {
  const cases: [unknown, string | null][] = [
    ['Foo', 'foo'],
    ['  bar  ', 'bar'],
    ['Mixed CASE', 'mixed case'],
    ['123', '123'],
    ['', null],
    ['   ', null],
    [undefined, null],
    [null, null],
    [123, null],
    [['a', 'b'], null],
    [{ q: 'x' }, null],
  ]

  for (const [input, expected] of cases) {
    await t.test(JSON.stringify(input), () => {
      assert.equal(normalizeSearchTerm(input), expected)
    })
  }
})

await test('matchesSearch', async (t) => {
  const item = {
    id: '1',
    title: 'Hello World',
    views: 100,
    published: true,
    author: { name: 'Foo Bar' },
    tags: ['alpha', 'beta'],
    meta: { nested: { deep: 'treasure' } },
  }

  const cases: [string, boolean][] = [
    // Top-level string, case-insensitive
    ['hello', true],
    ['WORLD', false], // term is expected pre-normalized (lowercase)
    ['world', true],
    // Nested object
    ['foo', true],
    ['bar', true],
    // Array values
    ['alpha', true],
    ['beta', true],
    // Deeply nested
    ['treasure', true],
    // Number coerced to string
    ['100', true],
    ['10', true],
    // No match
    ['zzz', false],
    // Booleans are not searchable
    ['true', false],
    // Empty term matches everything
    ['', true],
  ]

  for (const [term, expected] of cases) {
    await t.test(`"${term}"`, () => {
      assert.equal(matchesSearch(item, term), expected)
    })
  }
})

await test('matchesSearch handles odd values without throwing', () => {
  assert.equal(matchesSearch(null, 'x'), false)
  assert.equal(matchesSearch(undefined, 'x'), false)
  assert.equal(matchesSearch(42, '4'), true)
  assert.equal(matchesSearch('plain', 'lai'), true)
})
