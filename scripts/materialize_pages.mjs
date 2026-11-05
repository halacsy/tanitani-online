#!/usr/bin/env node

// Seed the four curated editorial pages from the public archive.
// Existing files belong to editors and must never be regenerated over.
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createRequire } from 'node:module'
import matter from 'gray-matter'
import TurndownService from 'turndown'
import { htmlToMarkdown } from './materialize_markdown.mjs'

const require = createRequire(import.meta.url)
const { gfm } = require('turndown-plugin-gfm')

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const source = JSON.parse(fs.readFileSync(path.join(root, 'content/migrated/tanitani/pages.json'), 'utf8'))
const outputDir = path.join(root, 'content/oldalak')
const checkOnly = process.argv.includes('--check')
const refreshImpressum = process.argv.includes('--refresh-impresszum')
const refreshLegal = process.argv.includes('--refresh-legal')
const refreshGuide = process.argv.includes('--refresh-guide')
const selected = [
  ['szerzoinknek', 'szerzoinknek.md', 405],
  ['kapcsolat_', 'kapcsolat.md', 221],
  ['impresszum', 'impresszum.md', 2],
  ['jogi_nyilatkozat', 'jogi-nyilatkozat.md', 590],
]

const editorialSlugs = {
  'Alexovics Ingrid': 'alexovics-ingrid',
  'Juhász Orchidea': 'karlowits-juhasz-orchidea',
  'Knausz Imre': 'knausz-imre',
  'Lencse Máté': 'lencse-mate',
  'Lőrincz Andrea': 'lorincz-andrea',
}

function simpleMarkdown(value) {
  const converter = new TurndownService({ bulletListMarker: '-', headingStyle: 'atx' })
  converter.use(gfm)
  return converter.turndown(value).trim()
}

function simplePageContent(page) {
  return matter.stringify(`${simpleMarkdown(page.bodyHtml)}\n`, {
    title: page.title,
    migratedId: page.id,
  }).replace(/\n+$/, '\n')
}

function impressumContent(page, normalizeSpace = true, simpleClosing = true) {
  const parts = page.bodyHtml.match(/^([\s\S]*?)<h2[^>]*>\s*A szerkesztőség<\/h2>\s*<table[^>]*>([\s\S]*?)<\/table>([\s\S]*)$/i)
  if (!parts) throw new Error('Az archív impresszum szerkezete megváltozott')
  const editors = [...parts[2].matchAll(/<tr>\s*<td[^>]*>\s*<img\b[^>]*alt="([^"]+)"[^>]*src="([^"]+)"[^>]*>\s*<\/td>\s*<td>\s*([^<]+?)\s*<\/td>\s*<\/tr>/gi)].map(match => {
    const [, sourceName, photo, label] = match
    const description = label.trim().match(/^(.*?)\s+\(([^()]*)\)$/)
    if (!description) throw new Error(`Ismeretlen szerkesztőségi sor: ${label}`)
    return {
      ...(editorialSlugs[sourceName] ? { authorSlug: editorialSlugs[sourceName] } : {}),
      name: description[1],
      role: description[2],
      photo,
    }
  })
  if (editors.length !== 7) throw new Error(`Hibás szerkesztőségi létszám: ${editors.length}`)
  const closingSource = normalizeSpace ? parts[3].replace(/&nbsp;|\u00a0/gi, ' ') : parts[3]
  const closing = simpleClosing ? simpleMarkdown(closingSource) : htmlToMarkdown(closingSource)
  return matter.stringify(`${htmlToMarkdown(parts[1])}\n`, {
    title: page.title,
    migratedId: page.id,
    editors,
    closing,
  }).replace(/\n+$/, '\n')
}

function legalContent(page) {
  // This page has an ordinary numbered list and linked CC badge; neither
  // needs the raw-HTML preservation used by complex historical layouts.
  return simplePageContent(page)
}

if (!checkOnly) fs.mkdirSync(outputDir, { recursive: true })
for (const [slug, filename, id] of selected) {
  const page = source.find(item => item.slug === slug && item.id === id)
  if (!page) throw new Error(`Hiányzó archív oldal: ${slug} (${id})`)
  const target = path.join(outputDir, filename)
  const originalContent = matter.stringify(`${htmlToMarkdown(page.bodyHtml)}\n`, {
    title: page.title,
    migratedId: id,
  }).replace(/\n+$/, '\n')
  if (fs.existsSync(target)) {
    const current = fs.readFileSync(target, 'utf8')
    const existing = matter(current)
    if (Number(existing.data.migratedId) !== id) {
      throw new Error(`Hibás archív azonosító: ${filename}`)
    }
    if (slug === 'impresszum' && refreshImpressum) {
      if (current === impressumContent(page)) continue
      if (current !== originalContent && current !== impressumContent(page, false, false) && current !== impressumContent(page, true, false)) {
        throw new Error('Az impresszum már szerkesztve lett; nem írható felül automatikusan')
      }
      fs.writeFileSync(target, impressumContent(page), 'utf8')
      console.log(`Átalakítva: ${filename}`)
    }
    if (slug === 'jogi_nyilatkozat' && refreshLegal) {
      if (current === legalContent(page)) continue
      if (current !== originalContent) throw new Error('A jogi nyilatkozat már szerkesztve lett; nem írható felül automatikusan')
      fs.writeFileSync(target, legalContent(page), 'utf8')
      console.log(`Átalakítva: ${filename}`)
    }
    if (slug === 'szerzoinknek' && refreshGuide) {
      if (current === simplePageContent(page)) continue
      if (current !== originalContent) throw new Error('A szerzői útmutató már szerkesztve lett; nem írható felül automatikusan')
      fs.writeFileSync(target, simplePageContent(page), 'utf8')
      console.log(`Átalakítva: ${filename}`)
    }
    continue
  }
  if (checkOnly) throw new Error(`Hiányzó szerkesztői oldal: ${filename}`)
  fs.writeFileSync(target, slug === 'impresszum' ? impressumContent(page) : ['szerzoinknek', 'jogi_nyilatkozat'].includes(slug) ? simplePageContent(page) : originalContent, 'utf8')
  console.log(`Létrehozva: ${filename}`)
}
