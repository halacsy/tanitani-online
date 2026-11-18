import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import vm from 'node:vm'
import { parseHTML } from 'linkedom'
import { collectCandidates, resolvePhotos, validateDecisions, imagePath, loadPhotoData, applyDecisions, writeReview } from './author_photos.mjs'
import { authorContent } from './materialize_markdown.mjs'

const author = { id: 914, slug: 'kertai-csenger', name: 'Kertai Csenger', descriptionHtml: '' }
const src = '/sites/default/files/kertai_csenger.jpg'
const other = '/sites/default/files/other.jpg'
const article = (id, html) => ({ id, slug: `article-${id}`, title: String(id), authors: [author], bodyHtml: html })
const image = (url = src, alt = author.name) => `<img src="${url}" alt="${alt}">`

test('exact decoded name, author byline and one repeated local image yield one traceable portrait', () => {
  const rows = collectCandidates([author], [article(1, image(src, ' Kertai&#32;Csenger ')), article(2, image())], () => true)
  assert.equal(rows[0].candidates.length, 1)
  assert.deepEqual(rows[0].candidates[0].sources.map(source => source.id), [1, 2])
  assert.equal(resolvePhotos(rows)[0].photo, src)
  const stranger = { ...article(3, image()), authors: [] }
  assert.equal(collectCandidates([author], [stranger], () => true)[0].candidates.length, 0)
})

test('multiple files, missing files and colliding author names never silently get a portrait', () => {
  const rows = collectCandidates([author], [article(1, image() + image(other))], value => value === src)
  assert.equal(resolvePhotos(rows)[0].status, 'multiple')
  assert.equal(resolvePhotos(rows)[0].photo, null)
  assert.equal(resolvePhotos(collectCandidates([author], [article(1, image())], () => false))[0].status, 'missing')
  const duplicate = { ...author, slug: 'duplicate' }
  assert.equal(collectCandidates([author, duplicate], [article(1, image())], () => true)[0].candidates.length, 0)
  assert.equal(collectCandidates([author], [article(1, image(src, 'Kertai Csenger és mások'))], () => true)[0].candidates.length, 0)
})

test('review choices and explicit rejections override automatic selection, with full validation', () => {
  const rows = collectCandidates([author], [article(1, image() + image(other))], () => true)
  const decisions = validateDecisions({ version: 1, decisions: { [author.slug]: other } }, rows, () => true)
  assert.equal(resolvePhotos(rows, decisions)[0].photo, other)
  assert.equal(resolvePhotos(rows, { [author.slug]: null })[0].status, 'rejected')
  for (const invalid of [{ version: 2, decisions: {} }, { version: 1, decisions: [] }, { version: 1, decisions: { missing: src } }, { version: 1, decisions: { [author.slug]: '/sites/default/files/unrelated.jpg' } }]) {
    assert.throws(() => validateDecisions(invalid, rows, () => true))
  }
  assert.throws(() => validateDecisions({ version: 1, decisions: { [author.slug]: src } }, rows, () => false))
})

test('only safe local raster URLs are accepted and canonicalized', () => {
  assert.equal(imagePath('https://www.tani-tani.info/sites/default/files/kertai_csenger.jpg?x=1'), src)
  assert.equal(imagePath('/sites/default/files/a%20b.jpg'), '/sites/default/files/a b.jpg')
  for (const value of ['https://evil.example/sites/default/files/a.jpg', 'javascript:alert(1)', '/sites/default/files/a.svg', '/sites/default/files/%2e%2e%2fsecret.jpg', '/sites/default/files/a%00.jpg', '/sites/default/files/a%5cb.jpg']) assert.equal(imagePath(value), null)
})

test('decisions survive fresh source loads and materialization; portable report embeds media safely', t => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'tanitani-photos-'))
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }))
  const write = (name, value) => {
    const file = path.join(dir, name)
    fs.mkdirSync(path.dirname(file), { recursive: true })
    fs.writeFileSync(file, value)
  }
  write('content/migrated/tanitani/authors.json', JSON.stringify([author]))
  const source = article(1, image() + image(other))
  source.title = '</script><script>throw 1</script>'
  write('content/migrated/tanitani/articles.json', JSON.stringify([{ id: 1 }]))
  write('content/migrated/tanitani/articles/1.json', JSON.stringify(source))
  write('content/szerzok/kertai-csenger.md', '---\nname: Kertai Csenger\n---\n')
  write('content/author-photo-decisions.json', '{"version":1,"decisions":{}}')
  write(`public${src}`, Buffer.from('image fixture'))
  write(`public${other}`, Buffer.from('other fixture'))
  applyDecisions({ version: 1, decisions: { [author.slug]: other } }, dir)
  let data = loadPhotoData(dir)
  assert.equal(resolvePhotos(data.records, data.decisions)[0].photo, other)
  assert.match(authorContent(author, other), /photo: \/sites\/default\/files\/other.jpg/)
  const before = fs.readFileSync(path.join(dir, 'content/author-photo-decisions.json'), 'utf8')
  applyDecisions({ version: 1, decisions: {} }, dir)
  assert.equal(fs.readFileSync(path.join(dir, 'content/author-photo-decisions.json'), 'utf8'), before)
  assert.throws(() => applyDecisions({ version: 1, decisions: { [author.slug]: '/sites/default/files/invalid.jpg' } }, dir))
  assert.equal(fs.readFileSync(path.join(dir, 'content/author-photo-decisions.json'), 'utf8'), before)
  const output = writeReview(dir)
  const html = fs.readFileSync(output, 'utf8')
  assert.doesNotMatch(html, /<script>throw 1/)
  assert.match(html, /data:image\/jpeg;base64/)
  const scripts = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)]
  assert.equal(scripts.length, 2)
  scripts.forEach(([, code]) => new vm.Script(code))
  applyDecisions({ version: 1, decisions: { [author.slug]: null } }, dir)
  data = loadPhotoData(dir)
  assert.equal(resolvePhotos(data.records, data.decisions)[0].photo, null)
})

test('portable review supports searching, filtering, choosing, rejection, export and atomic reimport', async () => {
  const records = collectCandidates([author, { slug: 'b', name: 'B' }], [article(1, image() + image(other))], () => true)
  const rows = resolvePhotos(records)
  const { window, document } = parseHTML(fs.readFileSync(new URL('./author-photo-review.html', import.meta.url), 'utf8'))
  window.location = { protocol: 'http:', origin: 'http://localhost:3001' }
  window.reviewData = { rows, decisions: {}, media: { [src]: 'data:image/jpeg;base64,AA==', [other]: 'data:image/jpeg;base64,AA==' }, dataset: 'fixture' }
  const storage = new Map()
  let blob
  const context = vm.createContext({
    window, document, Blob, setTimeout: callback => callback(),
    URL: { createObjectURL: value => { blob = value; return 'blob:test' }, revokeObjectURL() {} },
    localStorage: { getItem: key => storage.get(key), setItem: (key, value) => storage.set(key, value) },
  })
  vm.runInContext(fs.readFileSync(new URL('./author-photo-review-client.js', import.meta.url), 'utf8'), context)
  const event = type => new window.Event(type, { bubbles: true })
  const cards = [...document.querySelectorAll('.card')]
  assert.equal(cards.length, 2)
  assert.equal(document.querySelector('h2 a').href, 'http://localhost:3001/szerzok/b')
  const search = document.getElementById('search')
  search.value = 'Kertai'
  search.dispatchEvent(event('input'))
  assert.equal(cards.filter(card => !card.hidden).length, 1)
  search.value = ''
  search.dispatchEvent(event('input'))
  const select = document.getElementById('filter')
  select.querySelector('option[value="multiple"]').selected = true
  select.dispatchEvent(event('change'))
  assert.equal(cards.filter(card => !card.hidden).length, 1)
  const card = cards.find(card => card.querySelector('h2').textContent === author.name)
  const radios = [...card.querySelectorAll('input[type=radio]')]
  const choice = radios.find(radio => radio.value === other)
  choice.checked = true
  choice.dispatchEvent(event('change'))
  assert.match(document.getElementById('notice').textContent, /megőriztük/)
  document.getElementById('download').click()
  let downloaded = JSON.parse(await blob.text())
  assert.equal(downloaded.decisions[author.slug], other)
  assert.equal(validateDecisions(downloaded, records, () => true)[author.slug], other)
  radios.find(radio => radio.value === '').dispatchEvent(event('change'))
  document.getElementById('download').click()
  downloaded = JSON.parse(await blob.text())
  assert.equal(downloaded.decisions[author.slug], null)
  const input = document.getElementById('import')
  let contents = JSON.stringify({ version: 1, decisions: { [author.slug]: src } })
  Object.defineProperty(input, 'files', { get: () => [{ text: async () => contents }] })
  input.dispatchEvent(event('change'))
  await new Promise(resolve => setImmediate(resolve))
  assert.equal(radios.find(radio => radio.value === src).checked, true)
  contents = JSON.stringify({ version: 1, decisions: { [author.slug]: other, unknown: src } })
  input.dispatchEvent(event('change'))
  await new Promise(resolve => setImmediate(resolve))
  assert.match(document.getElementById('notice').textContent, /Ismeretlen/)
  document.getElementById('download').click()
  assert.equal(JSON.parse(await blob.text()).decisions[author.slug], src)
})

test('applying an editorial author rejection updates only its photo data and retains the decision', t => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'tanitani-editorial-photo-'))
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }))
  const write = (name, value) => {
    const filename = path.join(dir, name)
    fs.mkdirSync(path.dirname(filename), { recursive: true })
    fs.writeFileSync(filename, value)
  }
  write('content/migrated/tanitani/authors.json', '[]')
  write('content/migrated/tanitani/articles.json', '[]')
  write('content/author-photo-decisions.json', '{"version":1,"decisions":{}}')
  write('content/szerzok/kertai-csenger.md', `---\nname: Kertai Csenger\nphoto: ${src}\nbio: B\n---\nB\n`)
  write(`public${src}`, 'image fixture')
  applyDecisions({ version: 1, decisions: { [author.slug]: null } }, dir)
  const markdown = fs.readFileSync(path.join(dir, 'content/szerzok/kertai-csenger.md'), 'utf8')
  assert.doesNotMatch(markdown, /photo:/)
  assert.match(markdown, /bio: B/)
  assert.match(markdown, /---\nB\n$/)
  const data = loadPhotoData(dir)
  assert.equal(resolvePhotos(data.records, data.decisions)[0].photo, null)
})
