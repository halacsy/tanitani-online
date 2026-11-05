import assert from 'node:assert/strict'
import fs from 'node:fs'
import test from 'node:test'
import matter from 'gray-matter'
import { findTagName, tagHref } from '../lib/tags.mjs'
import { isCanonicalSlug } from '../lib/slug.mjs'

const articlesDir = new URL('../content/cikkek/', import.meta.url)
const tags = [...new Set(fs.readdirSync(articlesDir)
  .filter(file => file.endsWith('.md'))
  .flatMap(file => matter(fs.readFileSync(new URL(file, articlesDir), 'utf8')).data.tags ?? []))]

test('topic URLs use unique ASCII slugs and resolve to the original names', () => {
  assert(tags.length > 0)
  const urls = tags.map(tagHref)
  assert.equal(new Set(urls).size, tags.length, 'Topic slug collision')
  for (const name of tags) {
    const slug = tagHref(name).split('/').pop()
    assert(isCanonicalSlug(slug), name)
    assert.equal(findTagName(tags, slug), name)
    assert.equal(findTagName(tags, name), name)
    assert.equal(findTagName(tags, encodeURIComponent(name)), name)
  }
})

test('accented names stay readable while their URLs are ASCII', () => {
  assert.equal(tagHref('drámapedagógia'), '/temakorok/dramapedagogia')
  assert.equal(tagHref('alternatív iskolák'), '/temakorok/alternativ-iskolak')
  assert.equal(tagHref('IKT'), '/temakorok/ikt')
})

test('unknown topics and invalid escape sequences do not resolve', () => {
  assert.equal(findTagName(tags, 'nincs-ilyen-temakor'), null)
  assert.equal(findTagName(tags, '%E0%A4%A'), null)
})
