import assert from 'node:assert/strict'
import test, { beforeEach } from 'node:test'

import { Low, Memory } from 'lowdb'
import type { JsonObject } from 'type-fest'

import type { Data } from './service.ts'
import { Service } from './service.ts'

const defaultData = { posts: [], comments: [], object: {} }
const adapter = new Memory<Data>()
const db = new Low<Data>(adapter, defaultData)
const service = new Service(db)

const POSTS = 'posts'
const COMMENTS = 'comments'
const OBJECT = 'object'

const UNKNOWN_RESOURCE = 'xxx'
const UNKNOWN_ID = 'xxx'

const post1 = {
  id: '1',
  title: 'a',
  views: 100,
  published: true,
  author: { name: 'foo' },
  tags: ['foo', 'bar'],
}
const post2 = {
  id: '2',
  title: 'b',
  views: 200,
  published: false,
  author: { name: 'bar' },
  tags: ['bar'],
}
const post3 = {
  id: '3',
  title: 'c',
  views: 300,
  published: false,
  author: { name: 'baz' },
  tags: ['foo'],
}
const comment1 = { id: '1', title: 'a', postId: '1' }
const obj = {
  f1: 'foo',
}

beforeEach(() => {
  db.data = structuredClone({
    posts: [post1, post2, post3],
    comments: [comment1],
    object: obj,
  })
})

await test('findById', () => {
  const cases: [[string, string, { _embed?: string[] | string }], unknown][] = [
    [[POSTS, '1', {}], db.data?.[POSTS]?.[0]],
    [[POSTS, UNKNOWN_ID, {}], undefined],
    [[POSTS, '1', { _embed: ['comments'] }], { ...post1, comments: [comment1] }],
    [[COMMENTS, '1', { _embed: ['post'] }], { ...comment1, post: post1 }],
    [[UNKNOWN_RESOURCE, '1', {}], undefined],
  ]

  for (const [[name, id, query], expected] of cases) {
    assert.deepEqual(service.findById(name, id, query), expected)
  }
})

await test('find', async (t) => {
  const whereFromPayload = JSON.parse('{"author":{"name":{"eq":"bar"}}}') as JsonObject

  const cases: [{ where: JsonObject; sort?: string; page?: number; perPage?: number }, unknown][] =
    [
      [{ where: { title: { eq: 'b' } } }, [post2]],
      [{ where: whereFromPayload }, [post2]],
      [{ where: {}, sort: '-views' }, [post3, post2, post1]],
      [
        { where: {}, page: 2, perPage: 2 },
        {
          first: 1,
          prev: 1,
          next: null,
          last: 2,
          pages: 2,
          items: 3,
          data: [post3],
        },
      ],
    ]

  for (const [opts, expected] of cases) {
    await t.test(JSON.stringify(opts), () => {
      assert.deepEqual(service.find(POSTS, opts), expected)
    })
  }
})

await test('find with keyword search (q)', async (t) => {
  await t.test('searches top-level string fields', () => {
    const result = service.find(POSTS, { where: {}, q: 'a' })
    assert.deepEqual(result, [post1, post2, post3]) // all have 'a' somewhere (title or author)
  })

  await t.test('searches nested object fields', () => {
    const result = service.find(POSTS, { where: {}, q: 'foo' })
    assert.deepEqual(result, [post1, post3]) // post1 author.name='foo', post3 tags=['foo']
  })

  await t.test('searches number fields via string coercion', () => {
    const result = service.find(POSTS, { where: {}, q: '200' })
    assert.deepEqual(result, [post2]) // post2 views is 200
  })

  await t.test('case-insensitive search', () => {
    const result = service.find(POSTS, { where: {}, q: 'FOO' })
    assert.deepEqual(result, [post1, post3])
  })

  await t.test('empty q returns all items', () => {
    const result = service.find(POSTS, { where: {}, q: '' })
    assert.deepEqual(result, [post1, post2, post3])
  })

  await t.test('whitespace-only q returns all items', () => {
    const result = service.find(POSTS, { where: {}, q: '   ' })
    assert.deepEqual(result, [post1, post2, post3])
  })

  await t.test('q combined with where filter', () => {
    const result = service.find(POSTS, { where: { published: { eq: true } }, q: 'foo' })
    assert.deepEqual(result, [post1])
  })

  await t.test('q combined with sort', () => {
    const result = service.find(POSTS, { where: {}, q: 'bar', sort: '-views' })
    // post2 (views:200, author.name:'bar', tags:['bar']) and post1 (tags:['bar']) and post3 (tags: no 'bar' but author 'baz' has no bar)
    // post1 has tags ['foo','bar'] and author 'foo' => title 'a' doesn't match 'bar' but tags do
    // post2 has author 'bar' and tags ['bar']
    // Actually post1 author.name='foo' doesn't contain 'bar', but tags=['foo','bar'] does
    assert.deepEqual(result, [post2, post1])
  })

  await t.test('q combined with pagination', () => {
    const result = service.find(POSTS, { where: {}, q: 'a', page: 1, perPage: 2 }) as any
    assert.equal(result.items, 3)
    assert.equal(result.data.length, 2)
    assert.equal(result.pages, 2)
  })

  await t.test('q with no matches returns empty array', () => {
    const result = service.find(POSTS, { where: {}, q: 'zzzznotfound' })
    assert.deepEqual(result, [])
  })
})

await test('create', async () => {
  const post = { title: 'new post' }
  let res = await service.create(POSTS, post)
  assert.equal(res?.['title'], post.title)
  assert.equal(typeof res?.['id'], 'string', 'id should be a string')

  res = await service.create(POSTS, { ...post, id: 'foo' })
  assert.notEqual(res?.['id'], 'foo', 'user should not be able to set id')

  assert.equal(await service.create(UNKNOWN_RESOURCE, post), undefined)
})

await test('update', async () => {
  const obj = { f1: 'bar' }
  const res = await service.update(OBJECT, obj)
  assert.equal(res, obj)

  assert.equal(
    await service.update(UNKNOWN_RESOURCE, obj),
    undefined,
    'should ignore unknown resources',
  )
  assert.equal(await service.update(POSTS, {}), undefined, 'should ignore arrays')
})

await test('patch', async () => {
  const obj = { f2: 'bar' }
  const res = await service.patch(OBJECT, obj)
  assert.deepEqual(res, { f1: 'foo', ...obj })

  assert.equal(
    await service.patch(UNKNOWN_RESOURCE, obj),
    undefined,
    'should ignore unknown resources',
  )
  assert.equal(await service.patch(POSTS, {}), undefined, 'should ignore arrays')
})

await test('updateById', async () => {
  const post = { id: 'xxx', title: 'updated post' }
  const res = await service.updateById(POSTS, post1.id, post)
  assert.equal(res?.['id'], post1.id, 'id should not change')
  assert.equal(res?.['title'], post.title)

  assert.equal(await service.updateById(UNKNOWN_RESOURCE, post1.id, post), undefined)
  assert.equal(await service.updateById(POSTS, UNKNOWN_ID, post), undefined)
})

await test('patchById', async () => {
  const post = { id: 'xxx', title: 'updated post' }
  const res = await service.patchById(POSTS, post1.id, post)
  assert.notEqual(res, undefined)
  assert.equal(res?.['id'], post1.id)
  assert.equal(res?.['title'], post.title)

  assert.equal(await service.patchById(UNKNOWN_RESOURCE, post1.id, post), undefined)
  assert.equal(await service.patchById(POSTS, UNKNOWN_ID, post), undefined)
})

await test('destroy', async (t) => {
  await t.test('nullifies foreign keys', async () => {
    const prevLength = Number(db.data?.[POSTS]?.length) || 0
    await service.destroyById(POSTS, post1.id)
    assert.equal(db.data?.[POSTS]?.length, prevLength - 1)
    assert.deepEqual(db.data?.[COMMENTS], [{ ...comment1, postId: null }])
  })

  await t.test('deletes dependent resources', async () => {
    const prevLength = Number(db.data?.[POSTS]?.length) || 0
    await service.destroyById(POSTS, post1.id, [COMMENTS])
    assert.equal(db.data[POSTS].length, prevLength - 1)
    assert.equal(db.data[COMMENTS].length, 0)
  })

  await t.test('ignores unknown resources', async () => {
    assert.equal(await service.destroyById(UNKNOWN_RESOURCE, post1.id), undefined)
    assert.equal(await service.destroyById(POSTS, UNKNOWN_ID), undefined)
  })
})
