import test from 'node:test'
import { authorRedirects } from '../lib/author-redirects.mjs'
import assert from 'node:assert/strict'
import { renderBio, getAuthorBySlug } from '../lib/authors.ts'

test('author Markdown preserves paragraphs, emphasis and links', () => {
  const html = renderBio('**A**\n\nhttps://example.com', '')
  assert.match(html, /<p><strong>A<\/strong><\/p>/)
  assert.match(html, /href="https:\/\/example.com"/)
  assert.equal((html.match(/<p>/g) || []).length, 2)
})

test('author HTML removes executable markup and unsafe URLs', () => {
  const html = renderBio('<script>alert(1)</script><p onclick="alert(1)"><a href="javascript:alert(1)">A</a></p>', '')
  assert.doesNotMatch(html, /script|onclick|javascript|alert/)
})

test('archive fallback and intentionally empty biographies remain distinct', () => {
  assert.equal(renderBio(undefined, '<p>A</p>'), '<p>A</p>')
  assert.equal(renderBio('', '<p>A</p>'), '')
})

test('the corrected editorial author URL keeps a permanent legacy redirect', () => {
  assert.equal(authorRedirects.length, 1)
  const redirect = authorRedirects[0]
  assert.equal(redirect.permanent, true)
  assert.match(redirect.source, /szepesi_judit-png/)
  assert.equal(redirect.destination, redirect.source.replace('_', '-'))
  assert.ok(getAuthorBySlug(redirect.destination.slice('/szerzok/'.length)))
})
