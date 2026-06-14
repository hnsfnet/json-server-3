import assert from 'node:assert/strict'
import test from 'node:test'

import { matchesSearch } from './search.ts'

await test('matchesSearch', async (t) => {
  await t.test('matches top-level string field (case-insensitive)', () => {
    const item = { id: '1', title: 'Hello World' }
    assert.equal(matchesSearch(item, 'hello'), true)
    assert.equal(matchesSearch(item, 'WORLD'), true)
    assert.equal(matchesSearch(item, 'Hello World'), true)
    assert.equal(matchesSearch(item, 'xyz'), false)
  })

  await t.test('matches nested object string field', () => {
    const item = { id: '1', title: 'a post', author: { name: 'Typicode' } }
    assert.equal(matchesSearch(item, 'typicode'), true)
    assert.equal(matchesSearch(item, 'TYPI'), true)
    assert.equal(matchesSearch(item, 'post'), true)
    assert.equal(matchesSearch(item, 'unknown'), false)
  })

  await t.test('matches number fields by string coercion', () => {
    const item = { id: '1', title: 'a post', views: 1234 }
    assert.equal(matchesSearch(item, '1234'), true)
    assert.equal(matchesSearch(item, '123'), true)
    assert.equal(matchesSearch(item, '999'), false)
  })

  await t.test('matches boolean fields by string coercion', () => {
    const item = { id: '1', title: 'a post', published: true }
    assert.equal(matchesSearch(item, 'true'), true)
    assert.equal(matchesSearch(item, 'tru'), true)
    assert.equal(matchesSearch(item, 'false'), false)
  })

  await t.test('matches inside arrays', () => {
    const item = { id: '1', title: 'a post', tags: ['javascript', 'typescript'] }
    assert.equal(matchesSearch(item, 'javascript'), true)
    assert.equal(matchesSearch(item, 'script'), true)
    assert.equal(matchesSearch(item, 'python'), false)
  })

  await t.test('matches deeply nested structures', () => {
    const item = {
      id: '1',
      meta: {
        author: { name: 'Alice' },
        tags: [{ label: 'tech' }, { label: 'news' }],
      },
    }
    assert.equal(matchesSearch(item, 'alice'), true)
    assert.equal(matchesSearch(item, 'tech'), true)
    assert.equal(matchesSearch(item, 'news'), true)
    assert.equal(matchesSearch(item, 'missing'), false)
  })

  await t.test('returns true for empty keyword (no filtering)', () => {
    const item = { id: '1', title: 'Hello' }
    assert.equal(matchesSearch(item, ''), true)
    assert.equal(matchesSearch(item, '   '), true)
    assert.equal(matchesSearch(item, '\t'), true)
  })

  await t.test('handles null and undefined field values gracefully', () => {
    const item = { id: '1', title: null, description: undefined, body: 'content' }
    assert.equal(matchesSearch(item, 'content'), true)
    assert.equal(matchesSearch(item, 'null'), false)
    assert.equal(matchesSearch(item, 'undefined'), false)
  })

  await t.test('handles empty object', () => {
    const item = {}
    assert.equal(matchesSearch(item, 'anything'), false)
    assert.equal(matchesSearch(item, ''), true)
  })

  await t.test('partial match works', () => {
    const item = { id: '1', title: 'Introduction to JSON Server' }
    assert.equal(matchesSearch(item, 'intro'), true)
    assert.equal(matchesSearch(item, 'json'), true)
    assert.equal(matchesSearch(item, 'server'), true)
    assert.equal(matchesSearch(item, 'xyz'), false)
  })
})
