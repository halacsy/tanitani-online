import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { GET, dynamic } from '../app/szerzoi-portrek/route.ts'

test('hosted review serves the generated HTML with indexing disabled', async t => {
  const html = '<!doctype html><html lang="hu"><title>Test</title></html>'
  t.mock.method(fs, 'readFileSync', (filename, encoding) => {
    assert.equal(filename, path.join(process.cwd(), 'reports/author-photos.html'))
    assert.equal(encoding, 'utf8')
    return html
  })
  const response = GET()
  assert.equal(response.status, 200)
  assert.equal(response.headers.get('content-type'), 'text/html; charset=utf-8')
  assert.equal(response.headers.get('x-robots-tag'), 'noindex, nofollow')
  assert.equal(await response.text(), html)
  assert.equal(dynamic, 'force-static')
})
