import fs from 'node:fs'
import path from 'node:path'
import matter from 'gray-matter'
import { marked } from 'marked'
import * as yaml from 'js-yaml'
import { sanitizePageHtml } from './sanitize-page'

export interface Book {
  slug: string
  title: string
  creators: string
  publication: string
  cover: string
  order: number
  links: { label: string; url: string }[]
  descriptionHtml: string
}

const bookDir = path.join(process.cwd(), 'content/konyvek')
const introPath = path.join(process.cwd(), 'content/oldalak/konyvek-bevezeto.md')

function safeUrl(value: string): boolean {
  return (/^\/(?!\/)/.test(value) || /^https?:\/\//i.test(value)) && !/[\r\n]/.test(value)
}

export function getAllBooks(): Book[] {
  if (!fs.existsSync(bookDir)) return []
  return fs.readdirSync(bookDir).filter(name => /\.ya?ml$/.test(name)).map(filename => {
    const data = yaml.load(fs.readFileSync(path.join(bookDir, filename), 'utf8')) as Record<string, unknown>
    if (!data || typeof data !== 'object') throw new Error(`Hibás könyvadat: ${filename}`)
    const links = Array.isArray(data.links) ? data.links.map((entry: { label: string; url: string }) => ({
      label: String(entry.label || ''), url: String(entry.url || ''),
    })) : []
    const slug = filename.replace(/\.ya?ml$/, '')
    for (const key of ['title', 'creators', 'publication', 'cover', 'description']) {
      if (!data[key]) throw new Error(`Hiányzó ${key}: ${filename}`)
    }
    if (!safeUrl(String(data.cover)) || links.some(link => !link.label || !safeUrl(link.url))) {
      throw new Error(`Hibás könyvhivatkozás: ${filename}`)
    }
    return {
      slug,
      title: String(data.title),
      creators: String(data.creators),
      publication: String(data.publication),
      cover: String(data.cover),
      order: Number(data.order) || 999,
      links,
      descriptionHtml: sanitizePageHtml(String(marked.parse(String(data.description)))),
    }
  }).sort((a, b) => a.order - b.order || a.slug.localeCompare(b.slug, 'hu'))
}

export function getBookIntroduction(): { title: string; bodyHtml: string } {
  const { data, content } = matter(fs.readFileSync(introPath, 'utf8'))
  return { title: String(data.title), bodyHtml: sanitizePageHtml(String(marked.parse(content))) }
}
