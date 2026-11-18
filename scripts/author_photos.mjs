#!/usr/bin/env node
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createHash } from 'node:crypto'
import { spawnSync } from 'node:child_process'
import { Parser } from 'htmlparser2'
import matter from 'gray-matter'

export const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const hosts = new Set(['tani-tani.info', 'www.tani-tani.info', 'tani-tani.netlify.app'])
const normalizeName = value => String(value ?? '').normalize('NFKC').toLocaleLowerCase('hu').trim().replace(/\s+/g, ' ')

// Only existing public raster images are eligible. Never turn a source URL into
// an arbitrary filesystem read (also used when importing an editor's choices).
export function imagePath(src) {
  try {
    const url = new URL(src, 'https://www.tani-tani.info')
    if (!hosts.has(url.hostname) || !['http:', 'https:'].includes(url.protocol)) return null
    const pathname = decodeURIComponent(url.pathname)
    if (!/^\/(?:sites\/default\/files|images\/szerzok)\//.test(pathname)) return null
    if (/[\\\x00-\x1f]/.test(pathname) || pathname.split('/').some(part => part === '..' || part === '.')) return null
    return /\.(?:jpe?g|png|gif|webp|avif)$/i.test(pathname) ? pathname : null
  } catch { return null }
}

export function collectCandidates(authors, articles, exists) {
  const records = authors.map(author => ({ ...author, candidates: [] }))
  const bySlug = new Map(records.map(author => [author.slug, author]))
  const names = new Map()
  for (const author of records) {
    const name = normalizeName(author.name)
    names.set(name, [...(names.get(name) ?? []), author.slug])
  }
  for (const article of articles) {
    const linkedAuthors = new Set((article.authors ?? []).map(author => author.slug))
    const parser = new Parser({ onopentag(tag, attrs) {
      if (tag !== 'img') return
      const matches = names.get(normalizeName(attrs.alt)) ?? []
      // Name collisions and images of people who did not author this article
      // are deliberately excluded from automatic attribution.
      if (matches.length !== 1 || !linkedAuthors.has(matches[0])) return
      const src = imagePath(attrs.src)
      if (!src) return
      const record = bySlug.get(matches[0])
      let candidate = record.candidates.find(candidate => candidate.src === src)
      if (!candidate) {
        candidate = { src, available: exists(src), sources: [] }
        record.candidates.push(candidate)
      }
      if (!candidate.sources.some(source => source.id === article.id)) {
        candidate.sources.push({ id: article.id, slug: article.slug, title: article.title, credit: attrs.title ?? '' })
      }
    } })
    parser.end(article.bodyHtml ?? '')
  }
  for (const record of records) record.candidates.sort((a, b) => a.src.localeCompare(b.src))
  return records.sort((a, b) => a.name.localeCompare(b.name, 'hu'))
}

export function validateDecisions(document, records, exists) {
  if (!document || document.version !== 1 || !document.decisions || typeof document.decisions !== 'object' || Array.isArray(document.decisions)) {
    throw new Error('Érvénytelen döntésfájl: version: 1 és decisions objektum szükséges.')
  }
  const bySlug = new Map(records.map(record => [record.slug, record]))
  const decisions = Object.create(null)
  for (const [slug, src] of Object.entries(document.decisions)) {
    const author = bySlug.get(slug)
    if (!author) throw new Error(`Ismeretlen szerző: ${slug}`)
    if (src !== null && (typeof src !== 'string' || imagePath(src) !== src || !exists(src))) {
      throw new Error(`Hiányzó vagy érvénytelen képfájl: ${slug}`)
    }
    if (src !== null && !author.candidates.some(candidate => candidate.src === src)) {
      throw new Error(`A kép nem szerepel a szerző ellenőrizhető jelöltjei között: ${slug}`)
    }
    decisions[slug] = src
  }
  return decisions
}

export function resolvePhotos(records, decisions = {}) {
  return records.map(record => {
    const explicit = Object.hasOwn(decisions, record.slug)
    // Missing files are still candidates: do not silently resolve an ambiguity
    // just because only one of the named images was downloaded successfully.
    const automatic = record.candidates.length === 1 && record.candidates[0].available
    const photo = explicit ? decisions[record.slug] : automatic ? record.candidates[0].src : null
    const status = explicit ? photo ? 'reviewed' : 'rejected' : automatic ? 'automatic' : record.candidates.length > 1 ? 'multiple' : 'missing'
    return { ...record, photo, status }
  })
}

export function loadPhotoData(projectRoot = root) {
  const read = relative => JSON.parse(fs.readFileSync(path.join(projectRoot, relative), 'utf8'))
  const exists = src => {
    const filename = path.join(projectRoot, 'public', src)
    return fs.existsSync(filename) && fs.statSync(filename).isFile()
  }
  const archive = 'content/migrated/tanitani'
  const authors = read(`${archive}/authors.json`)
  const known = new Set(authors.map(author => author.slug))
  const editorial = new Map()
  for (const filename of fs.readdirSync(path.join(projectRoot, 'content/szerzok')).filter(filename => filename.endsWith('.md'))) {
    const slug = filename.slice(0, -3)
    const { data } = matter(fs.readFileSync(path.join(projectRoot, 'content/szerzok', filename), 'utf8'))
    if (!known.has(slug)) {
      authors.push({ slug, name: String(data.name || slug) })
      if (data.photo) editorial.set(slug, data.photo)
    }
  }
  const articles = read(`${archive}/articles.json`).map(article => read(`${archive}/articles/${article.id}.json`))
  const records = collectCandidates(authors, articles, exists)
  // Existing editorial selections remain reviewable even when they originate
  // in the CMS rather than in article HTML. They are not automatic matches.
  const stored = read('content/author-photo-decisions.json')
  for (const record of records) {
    const src = editorial.get(record.slug) ?? stored.decisions?.[record.slug]
    if (src && imagePath(src) === src && !record.candidates.some(candidate => candidate.src === src)) {
      record.candidates.push({ src, available: exists(src), sources: [], editorial: true })
    }
  }
  const baseline = validateDecisions({ version: 1, decisions: { ...Object.fromEntries(editorial), ...stored.decisions } }, records, exists)
  return { records, decisions: baseline, exists }
}

export function writeReview(projectRoot = root) {
  const { records, decisions } = loadPhotoData(projectRoot)
  const rows = resolvePhotos(records, decisions)
  const media = {}
  const mime = { jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', gif: 'image/gif', webp: 'image/webp', avif: 'image/avif' }
  for (const row of rows) for (const candidate of row.candidates) {
    if (!candidate.available || media[candidate.src]) continue
    const bytes = fs.readFileSync(path.join(projectRoot, 'public', candidate.src))
    media[candidate.src] = `data:${mime[path.extname(candidate.src).slice(1).toLowerCase()]};base64,${bytes.toString('base64')}`
  }
  const dataset = createHash('sha256').update(JSON.stringify(records)).digest('hex').slice(0, 16)
  const payload = JSON.stringify({ rows, decisions, media, dataset }).replace(/</g, '\\u003c')
  const template = fs.readFileSync(path.join(root, 'scripts/author-photo-review.html'), 'utf8')
  const client = fs.readFileSync(path.join(root, 'scripts/author-photo-review-client.js'), 'utf8')
  const html = template.replace('/* REVIEW_DATA */', () => `window.reviewData = ${payload};`).replace('/* REVIEW_CLIENT */', () => client)
  const output = path.join(projectRoot, 'reports/author-photos.html')
  fs.mkdirSync(path.dirname(output), { recursive: true })
  fs.writeFileSync(output, html)
  const counts = {}
  for (const row of rows) counts[row.status] = (counts[row.status] ?? 0) + 1
  console.log(JSON.stringify({ output, authors: rows.length, counts, bytes: Buffer.byteLength(html) }))
  return output
}

export function applyDecisions(document, projectRoot = root) {
  const { records, decisions: baseline, exists } = loadPhotoData(projectRoot)
  // Validate the complete import before writing anything. Earlier decisions
  // absent from a partial review are retained.
  const decisions = { ...baseline, ...validateDecisions(document, records, exists) }
  const sorted = Object.fromEntries(Object.entries(decisions).sort(([a], [b]) => a.localeCompare(b)))
  const migrated = new Set(JSON.parse(fs.readFileSync(path.join(projectRoot, 'content/migrated/tanitani/authors.json'), 'utf8')).map(author => author.slug))
  for (const [slug, photo] of Object.entries(sorted)) {
    if (migrated.has(slug)) continue
    const filename = path.join(projectRoot, 'content/szerzok', `${slug}.md`)
    const { data, content } = matter(fs.readFileSync(filename, 'utf8'))
    if ((data.photo ?? null) === photo) continue
    if (photo) data.photo = photo
    else delete data.photo
    fs.writeFileSync(filename, matter.stringify(content, data))
  }
  fs.writeFileSync(path.join(projectRoot, 'content/author-photo-decisions.json'), `${JSON.stringify({ version: 1, decisions: sorted }, null, 2)}\n`)
}

if (import.meta.url === `file://${process.argv[1]}`) {
  try {
    const args = process.argv.slice(2)
    if (args.length && (args[0] !== '--apply' || args.length !== 2)) throw new Error('Használat: npm run authors:photos -- [--apply döntések.json]')
    if (args[0] === '--apply') {
      applyDecisions(JSON.parse(fs.readFileSync(args[1], 'utf8')))
      const result = spawnSync(process.execPath, [path.join(root, 'scripts/materialize_markdown.mjs')], { stdio: 'inherit', cwd: root })
      if (result.status !== 0) throw new Error('A döntések mentése után a Markdown-frissítés sikertelen; futtasd: npm run migrate:markdown')
    }
    writeReview()
  } catch (error) {
    console.error(error.message)
    process.exitCode = 1
  }
}
