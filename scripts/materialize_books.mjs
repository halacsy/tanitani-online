#!/usr/bin/env node

// Seed the eight books from the archived public page. Existing editorial files
// are never overwritten. The source dump remains the source of historical text.
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { parseDocument } from 'htmlparser2'
import { findAll, getOuterHTML, textContent } from 'domutils'
import * as yaml from 'js-yaml'
import TurndownService from 'turndown'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const source = JSON.parse(fs.readFileSync(path.join(root, 'content/migrated/tanitani/pages.json'), 'utf8'))
const page = source.find(item => item.slug === 'konyvek/1' && item.id === 905)
if (!page) throw new Error('Hiányzó archív könyvoldal')
const check = process.argv.includes('--check')
const anchors = ['tarsasjatek', 'muveltseg', 'rogers', 'mindengyerek', 'bessenyei', 'gyermekkultura', 'nahalka', 'tolditanoda']
const elements = parseDocument(page.bodyHtml).children.filter(node => node.type === 'tag')
const containsAnchor = (node, anchor) => findAll(item => item.name === 'a' && item.attribs?.name === anchor, [node]).length > 0
const hasCover = node => findAll(item => item.name === 'img', [node]).length > 0
const startIndices = anchors.map(anchor => {
  const index = elements.findIndex(node => containsAnchor(node, anchor))
  if (index < 0) throw new Error(`Hiányzó könyvhorgony: ${anchor}`)
  return hasCover(elements[index]) ? index : index - 1
})
if (new Set(startIndices).size !== anchors.length || !startIndices.every((value, index) => index === 0 || value > startIndices[index - 1])) {
  throw new Error('Megváltozott a könyvek archív sorrendje')
}
const converter = new TurndownService({ headingStyle: 'atx', bulletListMarker: '-' })
const toMarkdown = nodes => {
  // Legacy inline formatting can cross tag boundaries and make Turndown emit
  // broken underscore markers. The book text stays intact without those tags.
  const html = nodes.map(getOuterHTML).join('\n').replace(/<\/?(?:em|strong|span)\b[^>]*>/gi, '')
  return converter.turndown(html).trim()
}
const bookDir = path.join(root, 'content/konyvek')
const introPath = path.join(root, 'content/oldalak/konyvek-bevezeto.md')
if (!check) {
  fs.mkdirSync(bookDir, { recursive: true })
  fs.mkdirSync(path.dirname(introPath), { recursive: true })
}
if (!fs.existsSync(introPath)) {
  if (check) throw new Error('Hiányzó könyvbevezető')
  // Cover navigation is replaced by the generated book list.
  const introduction = elements.slice(0, startIndices[0]).filter(node => node.name !== 'hr' && textContent(node).trim())
  fs.writeFileSync(introPath, `---\ntitle: ${page.title}\n---\n\n${toMarkdown(introduction)}\n`)
}
for (let index = 0; index < anchors.length; index++) {
  const slug = anchors[index]
  const target = path.join(bookDir, `${slug}.yml`)
  if (fs.existsSync(target)) {
    const data = yaml.load(fs.readFileSync(target, 'utf8'))
    if (!data || typeof data !== 'object' || !data.title || !data.creators || !data.publication || !data.description || !data.cover || !Number.isFinite(Number(data.order)) || !Array.isArray(data.links)) {
      throw new Error(`Hiányos könyvadat: ${slug}`)
    }
    continue
  }
  if (check) throw new Error(`Hiányzó könyvadat: ${slug}`)
  const section = elements.slice(startIndices[index], startIndices[index + 1] ?? elements.length)
  const headingIndex = section.findIndex(node => node.name === 'h2' || (slug === 'tolditanoda' && node.name === 'p' && textContent(node).includes('Csatári Tamara')))
  if (headingIndex < 0) throw new Error(`Hiányzó könyvcím: ${slug}`)
  const heading = textContent(section[headingIndex]).replace(/\s+/g, ' ').trim()
  const colon = heading.indexOf(': ')
  if (colon < 0) throw new Error(`Hiányzó szerző/cím elválasztó: ${slug}`)
  const publication = textContent(section[headingIndex + 1]).replace(/\s+/g, ' ').trim()
  const cover = findAll(node => node.name === 'img', section).at(0)?.attribs?.src
  if (!cover || !publication) throw new Error(`Hiányzó könyvmetaadat: ${slug}`)
  const links = findAll(node => node.name === 'a' && !!node.attribs?.href, section)
    .map(node => ({ label: textContent(node).replace(/\s+/g, ' ').trim(), url: node.attribs.href }))
    .filter(link => /^(PDF|MOBI|EPUB|OLVASS BELE!|AZ ÖSSZEHASONLÍTÓ TÁBLÁZAT KÜLÖN FÁJLBAN)$/i.test(link.label))
  const descriptionNodes = section.slice(headingIndex + 2).filter(node => {
    if (node.name === 'hr' || node.name === 'table') return false
    const content = textContent(node).replace(/\s+/g, ' ').trim()
    if (!content && findAll(item => item.name === 'img' && item.attribs?.src === cover, [node]).length) return false
    return !/^(LETÖLTÉS|PDF(?: MOBI)?(?: EPUB)?|OLVASS BELE!)$/.test(content)
  })
  const data = {
    title: heading.slice(colon + 2),
    creators: heading.slice(0, colon),
    publication,
    cover,
    order: index + 1,
    links,
    description: toMarkdown(descriptionNodes),
  }
  if (!data.description || !links.length) throw new Error(`Hiányzó leírás vagy letöltés: ${slug}`)
  fs.writeFileSync(target, yaml.dump(data, { lineWidth: -1, noRefs: true }), 'utf8')
  console.log(`Létrehozva: ${path.relative(root, target)}`)
}
