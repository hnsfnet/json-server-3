import assert from 'node:assert/strict'
import { parse, type ParsedUrlQuery } from 'node:querystring'
import test from 'node:test'

import { parseEmbed, parseListParams, type ListParams } from './query-params.ts'

const base: ListParams = {
  where: {},
  sort: undefined,
  page: undefined,
  perPage: undefined,
  embed: [],
  limit: undefined,
  start: undefined,
  end: undefined,
}

function makeReq(queryString: string) {
  return { url: `/posts?${queryString}`, query: parse(queryString) }
}

await test('parseListParams', async (t) => {
  const cases: [string, ListParams][] = [
    ['', base],
    // v1 params still work
    ['_sort=-views', { ...base, sort: '-views' }],
    ['_page=2&_per_page=5', { ...base, page: 2, perPage: 5 }],
    ['_embed=comments', { ...base, embed: ['comments'] }],
    ['views:gt=100', { ...base, where: { views: { gt: 100 } } }],
    // v0 slice pagination
    ['_limit=2', { ...base, limit: 2 }],
    ['_start=1&_end=3', { ...base, start: 1, end: 3 }],
    ['_start=1&_limit=2', { ...base, start: 1, limit: 2 }],
    // v0 `_page` + `_limit`
    ['_page=2&_limit=5', { ...base, page: 2, limit: 5 }],
    // v0 `_expand`, alone and combined with `_embed`
    ['_expand=post', { ...base, embed: ['post'] }],
    ['_embed=comments&_expand=post', { ...base, embed: ['comments', 'post'] }],
    // Reserved keys (new and old) must not leak into the where filter
    ['_limit=2&title=foo', { ...base, limit: 2, where: { title: { eq: 'foo' } } }],
    // Invalid numbers are ignored
    ['_limit=abc', base],
    // _where JSON keeps overriding query params
    [
      `_where=${encodeURIComponent(JSON.stringify({ title: { eq: 'foo' } }))}`,
      { ...base, where: { title: { eq: 'foo' } } },
    ],
  ]

  for (const [queryString, expected] of cases) {
    await t.test(queryString || '(empty)', () => {
      assert.deepEqual(parseListParams(makeReq(queryString)), expected)
    })
  }
})

await test('parseEmbed', async (t) => {
  const cases: [ParsedUrlQuery, string[]][] = [
    [{}, []],
    [{ _embed: 'comments' }, ['comments']],
    [{ _embed: ['comments', 'tags'] }, ['comments', 'tags']],
    [{ _expand: 'post' }, ['post']],
    [{ _embed: 'comments', _expand: 'post' }, ['comments', 'post']],
  ]

  for (const [query, expected] of cases) {
    await t.test(JSON.stringify(query), () => {
      assert.deepEqual(parseEmbed(query), expected)
    })
  }
})
