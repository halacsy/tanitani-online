#!/usr/bin/env node

/**
 * Create the editable Markdown layer for migrated articles and authors.
 *
 * The JSON export remains the lossless archival source. Existing Markdown is
 * never replaced: this script only adds missing files and upgrades the small
 * set of legacy front-matter keys needed by the CMS.
 */

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createRequire } from 'node:module'
import { execFileSync } from 'node:child_process'
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
const refreshUntracked = process.argv.includes('--refresh-untracked')

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'))
}

function comparable(value) {
  return String(value || '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '')
}

function plainText(value) {
  return String(value || '')
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#0?39;/gi, "'")
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
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

function writeArticle(filePath, article) {
  fs.writeFileSync(
    filePath,
    normalizedFile(matter.stringify(`${htmlToMarkdown(article.bodyHtml)}\n`, articleFrontMatter(article))),
    'utf8',
  )
}

function writeAuthor(filePath, author) {
  const data = { name: cleanText(author.name) }
  const bio = plainText(author.descriptionHtml)
  if (bio) data.bio = bio
  fs.writeFileSync(filePath, normalizedFile(matter.stringify('', data)), 'utf8')
}

function indexExistingArticles(migratedArticles) {
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
  const upgrades = []
  for (const filename of fs.readdirSync(articleDir).filter(name => name.endsWith('.md')).sort()) {
    const filePath = path.join(articleDir, filename)
    occupied.add(filePath)
    const source = fs.readFileSync(filePath, 'utf8')
    const parsed = matter(source)
    const numericId = Number(parsed.data.migratedId)
    const slug = filename.replace(/\.md$/, '')
    const titleMatches = migratedByTitle.get(comparable(parsed.data.title)) || []
    const migrated = (
      (Number.isInteger(numericId) && migratedById.get(numericId))
      || migratedBySlug.get(comparable(slug))
      || (titleMatches.length === 1 ? titleMatches[0] : undefined)
    )

    const nextData = { ...parsed.data }
    let changed = false
    if (!Array.isArray(nextData.authorSlugs) && nextData.authorSlug) {
      nextData.authorSlugs = [String(nextData.authorSlug)]
      delete nextData.authorSlug
      changed = true
    }
    if (!nextData.coverImage && nextData.image) {
      nextData.coverImage = nextData.image
      delete nextData.image
      changed = true
    }
    if (migrated) {
      if (matchedById.has(migrated.id)) {
        throw new Error(`Több Markdown-fájl tartozik a(z) ${migrated.id} migrált cikkhez.`)
      }
      matchedById.set(migrated.id, filePath)
      if (nextData.migratedId !== migrated.id) {
        nextData.migratedId = migrated.id
        changed = true
      }
      if (nextData.overrideMigrated !== true) {
        nextData.overrideMigrated = true
        changed = true
      }
      if (!Array.isArray(nextData.authorSlugs) || nextData.authorSlugs.length === 0) {
        nextData.authorSlugs = migrated.authors.map(author => author.slug)
        changed = true
      }
    }
    if (changed) upgrades.push({ filePath, content: normalizedFile(matter.stringify(parsed.content, nextData)) })
  }
  return { matchedById, occupied, upgrades }
}

function main() {
  fs.mkdirSync(articleDir, { recursive: true })
  fs.mkdirSync(authorDir, { recursive: true })

  const migratedArticles = readJson(path.join(migratedDir, 'articles.json'))
  const migratedAuthors = readJson(path.join(migratedDir, 'authors.json'))
  const { matchedById, occupied, upgrades } = indexExistingArticles(migratedArticles)
  const missingArticles = migratedArticles.filter(article => !matchedById.has(article.id))
  const existingAuthorSlugs = new Set(
    fs.readdirSync(authorDir)
      .filter(name => name.endsWith('.md'))
      .map(name => name.replace(/\.md$/, '')),
  )
  const missingAuthors = migratedAuthors.filter(author => !existingAuthorSlugs.has(author.slug))

  if (checkOnly) {
    if (missingArticles.length || missingAuthors.length || upgrades.length) {
      console.error('A szerkeszthető Markdown-réteg hiányos.')
      if (missingArticles.length) console.error(`- ${missingArticles.length} migrált cikkhez nincs Markdown-fájl`)
      if (missingAuthors.length) console.error(`- ${missingAuthors.length} szerzőhöz nincs Markdown-fájl`)
      if (upgrades.length) console.error(`- ${upgrades.length} meglévő fájl front mattere frissítendő`)
      process.exit(1)
    }
    console.log(`MARKDOWN ELLENŐRZÉS: RENDBEN (${migratedArticles.length} cikk, ${migratedAuthors.length} szerző)`)
    return
  }

  for (const upgrade of upgrades) fs.writeFileSync(upgrade.filePath, upgrade.content, 'utf8')

  if (refreshUntracked) {
    const trackedArticles = new Set(
      execFileSync('git', ['ls-tree', '-r', '--name-only', 'HEAD', '--', 'content/cikkek'], { cwd: root, encoding: 'utf8' })
        .split('\n')
        .filter(Boolean),
    )
    for (const [id, filePath] of matchedById) {
      const relativePath = path.relative(root, filePath)
      if (trackedArticles.has(relativePath)) continue
      writeArticle(filePath, readJson(path.join(migratedArticleDir, `${id}.json`)))
    }

    const trackedAuthors = new Set(
      execFileSync('git', ['ls-tree', '-r', '--name-only', 'HEAD', '--', 'content/szerzok'], { cwd: root, encoding: 'utf8' })
        .split('\n')
        .filter(Boolean),
    )
    for (const author of migratedAuthors) {
      const filePath = path.join(authorDir, `${author.slug}.md`)
      const relativePath = path.relative(root, filePath)
      if (trackedAuthors.has(relativePath) || !fs.existsSync(filePath)) continue
      writeAuthor(filePath, author)
    }
  }

  for (const article of missingArticles) {
    const fullArticle = readJson(path.join(migratedArticleDir, `${article.id}.json`))
    const filePath = uniqueArticlePath(article.slug, article.id, occupied)
    occupied.add(filePath)
    writeArticle(filePath, fullArticle)
  }

  for (const author of missingAuthors) {
    writeAuthor(path.join(authorDir, `${author.slug}.md`), author)
  }

  console.log('MARKDOWN LÉTREHOZÁS: RENDBEN')
  console.log(`- ${missingArticles.length} cikk létrehozva, ${upgrades.length} meglévő cikk frissítve`)
  console.log(`- ${missingAuthors.length} szerző létrehozva`)
}

main()
