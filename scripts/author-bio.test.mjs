import test from 'node:test'
import assert from 'node:assert/strict'
import { renderBio } from '../lib/authors.ts'

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
