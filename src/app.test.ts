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
  posts: [{ id: '1', title: 'foo' }],
  comments: [{ id: '1', postId: '1' }],
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
      posts: [{ id: '1', title: 'foo' }],
      comments: [{ id: '1', postId: '1' }],
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

  await t.test('v0-compatible query params', async (t) => {
    // Reset to a known multi-item dataset
    db.data = {
      posts: [
        { id: '1', title: 'a' },
        { id: '2', title: 'b' },
        { id: '3', title: 'c' },
      ],
      comments: [{ id: '1', postId: '1' }],
      object: { f1: 'foo' },
    }

    await t.test('_limit returns a plain array slice', async () => {
      const response = await fetch(`http://localhost:${port}/posts?_limit=2`)
      assert.equal(response.status, 200)
      const data = await response.json()
      assert.ok(Array.isArray(data), 'should keep the plain array shape')
      assert.deepEqual(data, [
        { id: '1', title: 'a' },
        { id: '2', title: 'b' },
      ])
    })

    await t.test('_start and _end slice the list', async () => {
      const response = await fetch(`http://localhost:${port}/posts?_start=1&_end=3`)
      assert.equal(response.status, 200)
      const data = await response.json()
      assert.deepEqual(data, [
        { id: '2', title: 'b' },
        { id: '3', title: 'c' },
      ])
    })

    await t.test('_page + _limit keeps the v1 pagination shape', async () => {
      const response = await fetch(`http://localhost:${port}/posts?_page=1&_limit=2`)
      assert.equal(response.status, 200)
      const data = await response.json()
      assert.deepEqual(data, {
        first: 1,
        prev: null,
        next: 2,
        last: 2,
        pages: 2,
        items: 3,
        data: [
          { id: '1', title: 'a' },
          { id: '2', title: 'b' },
        ],
      })
    })

    await t.test('_expand embeds the parent on a list', async () => {
      const response = await fetch(`http://localhost:${port}/comments?_expand=post`)
      assert.equal(response.status, 200)
      const data = await response.json()
      assert.deepEqual(data, [{ id: '1', postId: '1', post: { id: '1', title: 'a' } }])
    })

    await t.test('_expand embeds the parent on a single item', async () => {
      const response = await fetch(`http://localhost:${port}/comments/1?_expand=post`)
      assert.equal(response.status, 200)
      const data = await response.json()
      assert.deepEqual(data, { id: '1', postId: '1', post: { id: '1', title: 'a' } })
    })
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
})
