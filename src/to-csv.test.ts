import assert from 'node:assert/strict'
import test from 'node:test'

import type { Item } from './service.ts'
import { toCsv } from './to-csv.ts'

await test('toCsv', async (t) => {
  const cases: { name: string; items: Item[]; columns?: string[]; expected: string }[] = [
    {
      name: 'header + rows in first-appearance order',
      items: [
        { id: '1', title: 'foo' },
        { id: '2', title: 'bar' },
      ],
      expected: 'id,title\r\n1,foo\r\n2,bar',
    },
    {
      name: 'union of keys, missing values become empty cells',
      items: [
        { id: '1', title: 'foo' },
        { id: '2', views: 10 },
      ],
      expected: 'id,title,views\r\n1,foo,\r\n2,,10',
    },
    {
      name: 'quotes a value containing a comma',
      items: [{ id: '1', title: 'a, b' }],
      expected: 'id,title\r\n1,"a, b"',
    },
    {
      name: 'doubles embedded double quotes',
      items: [{ id: '1', title: 'say "hi"' }],
      expected: 'id,title\r\n1,"say ""hi"""',
    },
    {
      name: 'quotes a value containing a newline',
      items: [{ id: '1', title: 'line1\nline2' }],
      expected: 'id,title\r\n1,"line1\nline2"',
    },
    {
      name: 'null and undefined become empty cells',
      items: [{ id: '1', a: null, b: undefined }],
      expected: 'id,a,b\r\n1,,',
    },
    {
      name: 'numbers and booleans are stringified',
      items: [{ id: '1', views: 100, active: true }],
      expected: 'id,views,active\r\n1,100,true',
    },
    {
      name: 'nested objects/arrays are JSON-encoded and escaped',
      items: [{ id: '1', comments: [{ id: '9', text: 'hi' }] }],
      expected: 'id,comments\r\n1,"[{""id"":""9"",""text"":""hi""}]"',
    },
    {
      name: 'empty input without columns yields empty output',
      items: [],
      expected: '',
    },
    {
      name: 'empty input with explicit columns yields header only',
      items: [],
      columns: ['id', 'title'],
      expected: 'id,title',
    },
    {
      name: 'explicit columns control order and selection',
      items: [{ id: '1', title: 'foo', secret: 'x' }],
      columns: ['title', 'id'],
      expected: 'title,id\r\nfoo,1',
    },
  ]

  for (const tc of cases) {
    await t.test(tc.name, () => {
      assert.equal(toCsv(tc.items, tc.columns ? { columns: tc.columns } : {}), tc.expected)
    })
  }
})
