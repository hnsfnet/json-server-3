import assert from 'node:assert/strict'
import test from 'node:test'

import { normalizeQueryParams, RESERVED_QUERY_KEYS } from './compat-params.ts'

await test('normalizeQueryParams', async (t) => {
  await t.test('passes through v1 _sort', () => {
    const params = new URLSearchParams('_sort=title')
    const result = normalizeQueryParams(params)
    assert.equal(result.sort, 'title')
  })

  await t.test('passes through v1 _page and _per_page', () => {
    const params = new URLSearchParams('_page=2&_per_page=5')
    const result = normalizeQueryParams(params)
    assert.equal(result.page, 2)
    assert.equal(result.perPage, 5)
  })

  await t.test('maps _limit to perPage (page defaults to 1)', () => {
    const params = new URLSearchParams('_limit=10')
    const result = normalizeQueryParams(params)
    assert.equal(result.page, 1)
    assert.equal(result.perPage, 10)
  })

  await t.test('maps _start + _end to page + perPage', () => {
    // _start=10, _end=20 => perPage=10, page=2
    const params = new URLSearchParams('_start=10&_end=20')
    const result = normalizeQueryParams(params)
    assert.equal(result.perPage, 10)
    assert.equal(result.page, 2)
  })

  await t.test('maps _start + _limit to page + perPage', () => {
    // _start=20, _limit=10 => perPage=10, page=3
    const params = new URLSearchParams('_start=20&_limit=10')
    const result = normalizeQueryParams(params)
    assert.equal(result.perPage, 10)
    assert.equal(result.page, 3)
  })

  await t.test('maps _start alone to page using default perPage', () => {
    // _start=20 with default perPage=10 => page=3
    const params = new URLSearchParams('_start=20')
    const result = normalizeQueryParams(params)
    assert.equal(result.page, 3)
    assert.equal(result.perPage, 10)
  })

  await t.test('v1 _page takes precedence over v0 _start', () => {
    const params = new URLSearchParams('_page=5&_start=20&_limit=10')
    const result = normalizeQueryParams(params)
    assert.equal(result.page, 5)
    assert.equal(result.perPage, 10) // _limit still fills in perPage
  })

  await t.test('v1 _per_page takes precedence over v0 _limit', () => {
    const params = new URLSearchParams('_per_page=25&_limit=10')
    const result = normalizeQueryParams(params)
    // v1 _per_page wins; _limit still triggers page=1 default
    assert.equal(result.page, 1)
    assert.equal(result.perPage, 25)
  })

  await t.test('maps _expand to embed', () => {
    const params = new URLSearchParams('_expand=comments')
    const result = normalizeQueryParams(params, { _expand: 'comments' })
    assert.deepEqual(result.embed, ['comments'])
  })

  await t.test('merges _embed and _expand', () => {
    const params = new URLSearchParams('_embed=tags&_expand=comments')
    const result = normalizeQueryParams(params, { _embed: 'tags', _expand: 'comments' })
    assert.deepEqual(result.embed, ['tags', 'comments'])
  })

  await t.test('deduplicates _embed and _expand overlap', () => {
    const params = new URLSearchParams('_embed=comments&_expand=comments')
    const result = normalizeQueryParams(params, { _embed: 'comments', _expand: 'comments' })
    assert.deepEqual(result.embed, ['comments'])
  })

  await t.test('returns undefined embed when neither _embed nor _expand', () => {
    const params = new URLSearchParams('_sort=title')
    const result = normalizeQueryParams(params, {})
    assert.equal(result.embed, undefined)
  })

  await t.test('handles invalid numeric values gracefully', () => {
    const params = new URLSearchParams('_page=abc&_per_page=xyz')
    const result = normalizeQueryParams(params)
    assert.equal(result.page, undefined)
    assert.equal(result.perPage, undefined)
  })

  await t.test('handles _start=0 correctly', () => {
    const params = new URLSearchParams('_start=0&_limit=5')
    const result = normalizeQueryParams(params)
    assert.equal(result.page, 1)
    assert.equal(result.perPage, 5)
  })

  await t.test('handles mixed v0 pagination + v1 sort', () => {
    const params = new URLSearchParams('_start=0&_limit=5&_sort=-views')
    const result = normalizeQueryParams(params)
    assert.equal(result.page, 1)
    assert.equal(result.perPage, 5)
    assert.equal(result.sort, '-views')
  })
})

await test('RESERVED_QUERY_KEYS', async (t) => {
  await t.test('contains all v0 and v1 keys', () => {
    const expected = ['_sort', '_page', '_per_page', '_embed', '_where', '_limit', '_start', '_end', '_expand']
    for (const key of expected) {
      assert.ok(RESERVED_QUERY_KEYS.has(key), `missing key: ${key}`)
    }
  })
})
