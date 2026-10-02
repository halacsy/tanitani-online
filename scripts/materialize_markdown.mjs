#!/usr/bin/env node

/**
 * Create and keep in sync the editable Markdown layer for migrated articles
 * and authors.
 *
 * The JSON export (content/migrated/tanitani/) remains the lossless
 * archival source. For every migrated article/author this script
 * deterministically regenerates what the Markdown file should contain from
 * that source and compares it to what is on disk:
 *
 * - missing file  -> created
 * - disk matches the freshly generated content -> left untouched (no write)
 * - disk differs  -> overwritten with the freshly generated content
 *
 * This is intentionally "always regenerate from source, write only on
 * change": there is no AI/agent judgment involved, and no notion of
 * "protect a human edit" — this script only ever touches files that are
 * matched to a migrated JSON record, and a matched file's content is always
 * exactly what the source data says it should be. Markdown files with no
 * matching migrated record (genuinely new editorial-only content, e.g. a
 * brand-new article with no migratedId) are never touched.
 */

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createRequire } from 'node:module'
import matter from 'gray-matter'
import TurndownService from 'turndown'

const require = createRequire(import.meta.url)
const { gfm } = require('turndown-plugin-gfm')

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const migratedDir = path.join(root, 'content', 'migrated', 'tanitani')
const migratedArticleDir = path.join(migratedDir, 'articles')
const articleDir = path.join(root, 'content', 'cikkek')
const authorDir = path.join(root, 'content', 'szerzok')
const checkOnly = process.argv.includes('--check')

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'))
}

function comparable(value) {
  return String(value || '')
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '')
}

// Named HTML entities that actually occur in the migrated descriptionHtml
// (verified against content/migrated/tanitani/authors.json and
// articles/*.json). The source HTML predates a consistent UTF-8 export and
// mixes raw accented characters with named entities for the same letters,
// so plainText() must decode these explicitly — a generic tag-stripper
// alone leaves them as literal "&eacute;"-style garbage in the rendered
// plain-text bio. Missing an entity here silently corrupts a real person's
// bio text, so keep this list complete rather than "common enough".
const NAMED_ENTITIES = {
  aacute: 'á', eacute: 'é', iacute: 'í', oacute: 'ó', ouml: 'ö',
  uacute: 'ú', uuml: 'ü', odblac: 'ő', udblac: 'ű',
  Aacute: 'Á', Eacute: 'É', Iacute: 'Í', Oacute: 'Ó', Ouml: 'Ö',
  Uacute: 'Ú', Uuml: 'Ü', Odblac: 'Ő', Udblac: 'Ű',
  ndash: '–', mdash: '—', bdquo: '„', rdquo: '”', ldquo: '“', hellip: '…',
  rsquo: '’', lsquo: '‘',
}

function decodeNamedEntities(value) {
  return value.replace(/&([a-zA-Z]+);/g, (match, name) => NAMED_ENTITIES[name] ?? match)
}

function plainText(value) {
  return decodeNamedEntities(
    String(value || '')
      .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, ' ')
      .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, ' ')
      .replace(/<[^>]+>/g, ' ')
      .replace(/&nbsp;/gi, ' ')
      .replace(/&amp;/gi, '&')
      .replace(/&quot;/gi, '"')
      .replace(/&#0?39;/gi, "'")
      .replace(/&lt;/gi, '<')
      .replace(/&gt;/gi, '>'),
  )
    .replace(/\s+/g, ' ')
    .trim()
}

function markdownConverter() {
  const service = new TurndownService({
    bulletListMarker: '-',
    codeBlockStyle: 'fenced',
    emDelimiter: '*',
    headingStyle: 'atx',
    hr: '---',
    strongDelimiter: '**',
  })
  service.use(gfm)

  // These elements carry layout, embedded-media or anchor information that a
  // plain Markdown representation cannot preserve. Raw HTML is valid Markdown
  // and keeps the public rendering stable while the surrounding prose remains
  // pleasant to edit in the CMS.
  service.addRule('layoutSensitiveHtml', {
    filter: [
      'address', 'b', 'center', 'em', 'fn', 'font', 'i', 'iframe', 'img',
      'hr', 'ol', 'strike', 'strong', 'sup', 'table', 'u', 'ul',
    ],
    replacement: (_content, node) => node.outerHTML.replace(/\*/g, '&#42;'),
  })
  service.addRule('namedAnchor', {
    filter: node => node.nodeName === 'A' && !node.getAttribute('href') && Boolean(node.getAttribute('name')),
    replacement: (_content, node) => node.outerHTML,
  })
  service.addRule('identifiedSpan', {
    filter: node => node.nodeName === 'SPAN' && Boolean(node.getAttribute('id')),
    replacement: (_content, node) => node.outerHTML,
  })
  service.addRule('lineBreak', {
    filter: 'br',
    replacement: () => '<br>',
  })
  service.addRule('cleanHeading', {
    filter: ['h1', 'h2', 'h3', 'h4', 'h5', 'h6'],
    replacement: (content, node) => {
      const level = Number(node.nodeName.slice(1))
      const heading = content.replace(/^(?:\s|<br>)+/gi, '').trim()
      return heading ? `\n\n${'#'.repeat(level)} ${heading}\n\n` : ''
    },
  })
  return service
}

const turndown = markdownConverter()

function htmlToMarkdown(value) {
  return turndown.turndown(String(value || '').replace(/<\/?o:p\b[^>]*>/gi, ''))
    .replace(/\\_/g, '_')
    .replace(/\\\[(\/?fn)\\\]/gi, '[$1]')
    .replace(/^(\s*\d+)([.)])(?=\s)/gm, '$1\\$2')
    .replace(/^((?:>\s*)+\d+)([.)])(?=\s)/gm, '$1\\$2')
    .replace(/[ \t]+$/gm, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

function cleanText(value) {
  return String(value || '').replace(/[ \t]+$/gm, '').trim()
}

function normalizedFile(value) {
  return String(value).replace(/[ \t]+$/gm, '').replace(/\n+$/g, '\n')
}

function uniqueArticlePath(slug, id, occupied) {
  const preferred = path.join(articleDir, `${slug}.md`)
  if (!occupied.has(preferred)) return preferred
  return path.join(articleDir, `${slug}-${id}.md`)
}

function articleFrontMatter(article) {
  const data = {
    title: cleanText(article.title),
    migratedId: article.id,
    overrideMigrated: true,
    authorSlugs: article.authors.map(author => author.slug),
    date: article.date,
    tags: article.tags.map(tag => tag.name),
    excerpt: cleanText(article.excerpt),
  }
  if (article.coverImage) data.coverImage = article.coverImage
  if (article.coverAlt) data.coverAlt = cleanText(article.coverAlt)
  if (article.coverTitle) data.coverTitle = cleanText(article.coverTitle)
  data.reads = article.reads
  return data
}

// Pure: what the article's Markdown file content should be, given the full
// migrated JSON record (frontmatter + body). No I/O.
function articleContent(article) {
  return normalizedFile(matter.stringify(`${htmlToMarkdown(article.bodyHtml)}\n`, articleFrontMatter(article)))
}

// Pure: what the author's Markdown file content should be, given the
// migrated JSON record. No I/O.
function authorContent(author) {
  const data = { name: cleanText(author.name) }
  const bio = plainText(author.descriptionHtml)
  if (bio) data.bio = bio
  return normalizedFile(matter.stringify('', data))
}

/**
 * Matches every existing content/cikkek/*.md file to a migrated article (by
 * migratedId, else slug, else a unique title match) — identical matching
 * rules to the ones lib/content.ts uses at render time, so "materialized"
 * and "rendered" never disagree about which file is which article.
 */
function matchExistingArticles(migratedArticles) {
  const migratedById = new Map(migratedArticles.map(article => [article.id, article]))
  const migratedBySlug = new Map(migratedArticles.map(article => [comparable(article.slug), article]))
  const migratedByTitle = new Map()
  for (const article of migratedArticles) {
    const key = comparable(article.title)
    const matches = migratedByTitle.get(key) || []
    matches.push(article)
    migratedByTitle.set(key, matches)
  }

  const matchedById = new Map()
  const occupied = new Set()
  for (const filename of fs.readdirSync(articleDir).filter(name => name.endsWith('.md')).sort()) {
    const filePath = path.join(articleDir, filename)
    occupied.add(filePath)
    const parsed = matter(fs.readFileSync(filePath, 'utf8'))
    const numericId = Number(parsed.data.migratedId)
    const slug = filename.replace(/\.md$/, '')
    const titleMatches = migratedByTitle.get(comparable(parsed.data.title)) || []
    const migrated = (
      (Number.isInteger(numericId) && migratedById.get(numericId))
      || migratedBySlug.get(comparable(slug))
      || (titleMatches.length === 1 ? titleMatches[0] : undefined)
    )
    if (!migrated) continue
    if (matchedById.has(migrated.id)) {
      throw new Error(`Több Markdown-fájl tartozik a(z) ${migrated.id} migrált cikkhez.`)
    }
    matchedById.set(migrated.id, filePath)
  }
  return { matchedById, occupied }
}

/**
 * Creates missing articles and regenerates matched ones whose on-disk
 * content no longer matches what the current migrated JSON would produce.
 * In --check mode nothing is written; it only counts what would change.
 */
function syncArticles(migratedArticles, matchedById, occupied) {
  let created = 0
  let updated = 0
  for (const article of migratedArticles) {
    const fullArticle = readJson(path.join(migratedArticleDir, `${article.id}.json`))
    const nextContent = articleContent(fullArticle)
    const filePath = matchedById.get(article.id)
    if (filePath) {
      const current = fs.readFileSync(filePath, 'utf8')
      if (current === nextContent) continue
      updated += 1
      if (!checkOnly) fs.writeFileSync(filePath, nextContent, 'utf8')
    } else {
      const newPath = uniqueArticlePath(article.slug, article.id, occupied)
      occupied.add(newPath)
      created += 1
      if (!checkOnly) fs.writeFileSync(newPath, nextContent, 'utf8')
    }
  }
  return { created, updated }
}

/**
 * Creates missing authors and regenerates matched ones (matched purely by
 * slug/filename — content/szerzok/<slug>.md) whose on-disk content no
 * longer matches what the current migrated JSON would produce.
 */
function syncAuthors(migratedAuthors) {
  let created = 0
  let updated = 0
  for (const author of migratedAuthors) {
    const filePath = path.join(authorDir, `${author.slug}.md`)
    const nextContent = authorContent(author)
    if (fs.existsSync(filePath)) {
      const current = fs.readFileSync(filePath, 'utf8')
      if (current === nextContent) continue
      updated += 1
      if (!checkOnly) fs.writeFileSync(filePath, nextContent, 'utf8')
    } else {
      created += 1
      if (!checkOnly) fs.writeFileSync(filePath, nextContent, 'utf8')
    }
  }
  return { created, updated }
}

function main() {
  fs.mkdirSync(articleDir, { recursive: true })
  fs.mkdirSync(authorDir, { recursive: true })

  const migratedArticles = readJson(path.join(migratedDir, 'articles.json'))
  const migratedAuthors = readJson(path.join(migratedDir, 'authors.json'))
  const { matchedById, occupied } = matchExistingArticles(migratedArticles)

  const articleResult = syncArticles(migratedArticles, matchedById, occupied)
  const authorResult = syncAuthors(migratedAuthors)

  if (checkOnly) {
    const pending = articleResult.created + articleResult.updated + authorResult.created + authorResult.updated
    if (pending) {
      console.error('A szerkeszthető Markdown-réteg nincs szinkronban a migrált forrással.')
      if (articleResult.created) console.error(`- ${articleResult.created} migrált cikkhez nincs Markdown-fájl`)
      if (articleResult.updated) console.error(`- ${articleResult.updated} meglévő cikk eltér a forrástól, frissítés szükséges`)
      if (authorResult.created) console.error(`- ${authorResult.created} szerzőhöz nincs Markdown-fájl`)
      if (authorResult.updated) console.error(`- ${authorResult.updated} meglévő szerző eltér a forrástól, frissítés szükséges`)
      console.error('Futtasd: npm run migrate:markdown')
      process.exit(1)
    }
    console.log(`MARKDOWN ELLENŐRZÉS: RENDBEN (${migratedArticles.length} cikk, ${migratedAuthors.length} szerző)`)
    return
  }

  console.log('MARKDOWN SZINKRON: RENDBEN')
  console.log(`- cikkek: ${articleResult.created} létrehozva, ${articleResult.updated} frissítve`)
  console.log(`- szerzők: ${authorResult.created} létrehozva, ${authorResult.updated} frissítve`)
}

if (import.meta.url === `file://${process.argv[1]}`) main()

export {
  migratedDir, migratedArticleDir, articleDir, authorDir,
  readJson, articleContent, authorContent, matchExistingArticles,
}
