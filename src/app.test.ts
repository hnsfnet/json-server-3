   import assert from 'node:assert/strict'
import { writeFileSync } from 'node:fs'
import { join } from 'node:path'
import test from 'node:test'

import getPort from 'get-port'
import { Low, Memory } from 'lowdb'
import { temporaryDirectory } from 'tempy'

import { createApp } from './app.ts'
import type { Data } from './service.ts'

type Test = {
  method: HTTPMethods
  url: string
  statusCode: number
}

type HTTPMethods = 'DELETE' | 'GET' | 'HEAD' | 'PATCH' | 'POST' | 'PUT' | 'OPTIONS'

const port = await getPort()

// Create custom static dir with an html file
const tmpDir = temporaryDirectory()
const file = 'file.html'
writeFileSync(join(tmpDir, file), 'utf-8')

// Create app
const db = new Low<Data>(new Memory<Data>(), {})
db.data = {
  posts: [
    { id: '1', title: 'foo' },
    { id: '2', title: 'bar' },
    { id: '3', title: 'baz' },
    { id: '4', title: 'qux' },
    { id: '5', title: 'quux' },
  ],
  comments: [
    { id: '1', postId: '1' },
    { id: '2', postId: '1' },
    { id: '3', postId: '2' },
  ],
  tags: [
    { id: '1', postId: '1', name: 'tech' },
    { id: '2', postId: '2', name: 'life' },
  ],
  object: { f1: 'foo' },
}
const app = createApp(db, { static: [tmpDir] })

await new Promise<void>((resolve, reject) => {
  try {
    const server = app.listen(port, () => resolve())
    test.after(() => server.close())
  } catch (err) {
    reject(err)
  }
})

await test('createApp', async (t) => {
  // URLs
  const POSTS = '/posts'
  const POSTS_WITH_COMMENTS = '/posts?_embed=comments'
  const POST_1 = '/posts/1'
  const POST_NOT_FOUND = '/posts/-1'
  const POST_WITH_COMMENTS = '/posts/1?_embed=comments'
  const COMMENTS = '/comments'
  const POST_COMMENTS = '/comments?postId=1'
  const NOT_FOUND = '/not-found'
  const OBJECT = '/object'
  const OBJECT_1 = '/object/1'

  const arr: Test[] = [
    // Static
    { method: 'GET', url: '/', statusCode: 200 },
    { method: 'GET', url: '/test.html', statusCode: 200 },
    { method: 'GET', url: `/${file}`, statusCode: 200 },

    // CORS
    { method: 'OPTIONS', url: POSTS, statusCode: 204 },

    // API
    { method: 'GET', url: POSTS, statusCode: 200 },
    { method: 'GET', url: POSTS_WITH_COMMENTS, statusCode: 200 },
    { method: 'GET', url: POST_1, statusCode: 200 },
    { method: 'GET', url: POST_NOT_FOUND, statusCode: 404 },
    { method: 'GET', url: POST_WITH_COMMENTS, statusCode: 200 },
    { method: 'GET', url: COMMENTS, statusCode: 200 },
    { method: 'GET', url: POST_COMMENTS, statusCode: 200 },
    { method: 'GET', url: OBJECT, statusCode: 200 },
    { method: 'GET', url: OBJECT_1, statusCode: 404 },
    { method: 'GET', url: NOT_FOUND, statusCode: 404 },

    { method: 'POST', url: POSTS, statusCode: 201 },
    { method: 'POST', url: POST_1, statusCode: 404 },
    { method: 'POST', url: POST_NOT_FOUND, statusCode: 404 },
    { method: 'POST', url: OBJECT, statusCode: 404 },
    { method: 'POST', url: OBJECT_1, statusCode: 404 },
    { method: 'POST', url: NOT_FOUND, statusCode: 404 },

    { method: 'PUT', url: POSTS, statusCode: 404 },
    { method: 'PUT', url: POST_1, statusCode: 200 },
    { method: 'PUT', url: OBJECT, statusCode: 200 },
    { method: 'PUT', url: OBJECT_1, statusCode: 404 },
    { method: 'PUT', url: POST_NOT_FOUND, statusCode: 404 },
    { method: 'PUT', url: NOT_FOUND, statusCode: 404 },

    { method: 'PATCH', url: POSTS, statusCode: 404 },
    { method: 'PATCH', url: POST_1, statusCode: 200 },
    { method: 'PATCH', url: OBJECT, statusCode: 200 },
    { method: 'PATCH', url: OBJECT_1, statusCode: 404 },
    { method: 'PATCH', url: POST_NOT_FOUND, statusCode: 404 },
    { method: 'PATCH', url: NOT_FOUND, statusCode: 404 },

    { method: 'DELETE', url: POSTS, statusCode: 404 },
    { method: 'DELETE', url: POST_1, statusCode: 200 },
    { method: 'DELETE', url: OBJECT, statusCode: 404 },
    { method: 'DELETE', url: OBJECT_1, statusCode: 404 },
    { method: 'DELETE', url: POST_NOT_FOUND, statusCode: 404 },
    { method: 'DELETE', url: NOT_FOUND, statusCode: 404 },
  ]

  for (const tc of arr) {
    await t.test(`${tc.method} ${tc.url}`, async () => {
      const response = await fetch(`http://localhost:${port}${tc.url}`, {
        method: tc.method,
      })
      assert.equal(
        response.status,
        tc.statusCode,
        `${response.status} !== ${tc.statusCode} ${tc.method} ${tc.url} failed`,
      )
      if (tc.statusCode === 404) {
        const body = await response.json()
        assert.deepEqual(body, { error: 'Not Found' })
      }
    })
  }

  await t.test('GET /posts?_where=... uses JSON query', async () => {
    // Reset data since previous tests may have modified it
    db.data = {
      posts: [
        { id: '1', title: 'foo' },
        { id: '2', title: 'bar' },
        { id: '3', title: 'baz' },
        { id: '4', title: 'qux' },
        { id: '5', title: 'quux' },
      ],
      comments: [
        { id: '1', postId: '1' },
        { id: '2', postId: '1' },
        { id: '3', postId: '2' },
      ],
      tags: [
        { id: '1', postId: '1', name: 'tech' },
        { id: '2', postId: '2', name: 'life' },
      ],
      object: { f1: 'foo' },
    }
    const where = encodeURIComponent(JSON.stringify({ title: { eq: 'foo' } }))
    const response = await fetch(`http://localhost:${port}/posts?_where=${where}`)
    assert.equal(response.status, 200)
    const data = await response.json()
    assert.deepEqual(data, [{ id: '1', title: 'foo' }])
  })

  await t.test('GET /posts?_where=... overrides query params', async () => {
    const where = encodeURIComponent(JSON.stringify({ title: { eq: 'foo' } }))
    const response = await fetch(
      `http://localhost:${port}/posts?title:eq=bar&_where=${where}`,
    )
    assert.equal(response.status, 200)
    const data = await response.json()
    assert.deepEqual(data, [{ id: '1', title: 'foo' }])
  })

  await t.test('POST /posts with array body returns 400', async () => {
    const response = await fetch(`http://localhost:${port}/posts`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify([{ title: 'foo' }]),
    })
    assert.equal(response.status, 400)
    const data = await response.json()
    assert.deepEqual(data, { error: 'Body must be a JSON object' })
  })

  await t.test('PATCH /posts/1 with string body returns 400', async () => {
    const response = await fetch(`http://localhost:${port}/posts/1`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify('hello'),
    })
    assert.equal(response.status, 400)
    const data = await response.json()
    assert.deepEqual(data, { error: 'Body must be a JSON object' })
  })

  await t.test('PUT /posts/1 with null body returns 400', async () => {
    const response = await fetch(`http://localhost:${port}/posts/1`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(null),
    })
    assert.equal(response.status, 400)
    const data = await response.json()
    assert.deepEqual(data, { error: 'Body must be a JSON object' })
  })

  // --- v0 compatibility tests ---

  await t.test('v0 compat: _limit returns limited results with pagination', async () => {
    db.data = {
      posts: [
        { id: '1', title: 'foo' },
        { id: '2', title: 'bar' },
        { id: '3', title: 'baz' },
        { id: '4', title: 'qux' },
        { id: '5', title: 'quux' },
      ],
      comments: [
        { id: '1', postId: '1' },
        { id: '2', postId: '1' },
        { id: '3', postId: '2' },
      ],
      tags: [
        { id: '1', postId: '1', name: 'tech' },
        { id: '2', postId: '2', name: 'life' },
      ],
      object: { f1: 'foo' },
    }
    const response = await fetch(`http://localhost:${port}/posts?_limit=2`)
    assert.equal(response.status, 200)
    const data = await response.json()
    assert.equal(data.data.length, 2)
    assert.equal(data.items, 5)
    assert.equal(data.pages, 3)
    assert.equal(data.first, 1)
    assert.equal(data.next, 2)
  })

  await t.test('v0 compat: _start + _limit returns correct page', async () => {
    const response = await fetch(`http://localhost:${port}/posts?_start=2&_limit=2`)
    assert.equal(response.status, 200)
    const data = await response.json()
    assert.equal(data.data.length, 2)
    assert.deepEqual(
      data.data.map((p: any) => p.id),
      ['3', '4'],
    )
  })

  await t.test('v0 compat: _start + _end returns correct page', async () => {
    const response = await fetch(`http://localhost:${port}/posts?_start=0&_end=3`)
    assert.equal(response.status, 200)
    const data = await response.json()
    assert.equal(data.data.length, 3)
    assert.deepEqual(
      data.data.map((p: any) => p.id),
      ['1', '2', '3'],
    )
  })

  await t.test('v0 compat: _expand on list works like _embed', async () => {
    const response = await fetch(`http://localhost:${port}/posts?_expand=comments&_limit=1`)
    assert.equal(response.status, 200)
    const data = await response.json()
    assert.equal(data.data.length, 1)
    assert.ok(Array.isArray(data.data[0].comments))
    assert.equal(data.data[0].comments.length, 2)
  })

  await t.test('v0 compat: _expand on single item works like _embed', async () => {
    const response = await fetch(`http://localhost:${port}/posts/1?_expand=comments`)
    assert.equal(response.status, 200)
    const data = await response.json()
    assert.ok(Array.isArray(data.comments))
    assert.equal(data.comments.length, 2)
  })

  await t.test('v0 compat: _expand + _embed merged on single item', async () => {
    const response = await fetch(
      `http://localhost:${port}/posts/1?_expand=comments&_embed=tags`,
    )
    assert.equal(response.status, 200)
    const data = await response.json()
    assert.ok(Array.isArray(data.comments))
    assert.ok(Array.isArray(data.tags))
  })

  await t.test('v0 compat: _limit + _sort works together', async () => {
    const response = await fetch(`http://localhost:${port}/posts?_limit=2&_sort=-title`)
    assert.equal(response.status, 200)
    const data = await response.json()
    assert.equal(data.data.length, 2)
    // sorted desc by title: qux, quux, foo, baz, bar
    assert.equal(data.data[0].title, 'qux')
    assert.equal(data.data[1].title, 'quux')
  })

  await t.test('v0 compat: v1 _page takes precedence over _start', async () => {
    const response = await fetch(
      `http://localhost:${port}/posts?_page=2&_per_page=2&_start=0&_limit=2`,
    )
    assert.equal(response.status, 200)
    const data = await response.json()
    // _page=2 with _per_page=2 should give items 3,4
    assert.equal(data.data.length, 2)
    assert.deepEqual(
      data.data.map((p: any) => p.id),
      ['3', '4'],
    )
  })
})
