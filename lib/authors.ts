import fs from 'fs'
import path from 'path'
import matter from 'gray-matter'
import { marked } from 'marked'
import sanitizeHtml from 'sanitize-html'

interface AuthorRecord {
  id: number
  slug: string
  name: string
  descriptionHtml: string
  articleCount: number
}

export interface Author {
  id: number
  slug: string
  name: string
  photo: string
  bio: string
  bioHtml: string
  articleCount: number
}

const migratedPath = path.join(
  process.cwd(), 'content', 'migrated', 'tanitani', 'authors.json',
)
const curatedDir = path.join(process.cwd(), 'content', 'szerzok')

let authors: Author[] | null = null

function stableNegativeId(value: string): number {
  let hash = 2166136261
  for (let index = 0; index < value.length; index++) {
    hash ^= value.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }
  return -(Math.abs(hash) || 1)
}

function plainText(value: string): string {
  return value
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#0?39;/gi, "'")
    .replace(/\s+/g, ' ')
    .trim()
}

function curatedOverride(slug: string): { name?: string; photo?: string; bio?: string } {
  const filePath = path.join(curatedDir, `${slug}.md`)
  if (!fs.existsSync(filePath)) return {}
  const { data, content } = matter(fs.readFileSync(filePath, 'utf-8'))
  return { name: data.name, photo: data.photo, bio: data.bio ?? (content.trim() || undefined) }
}

export function renderBio(value: string | undefined, fallback: string): string {
  return sanitizeHtml(value === undefined ? fallback : String(marked.parse(String(value))), {
    allowedTags: ['p', 'br', 'strong', 'em', 'a', 'ul', 'ol', 'li', 'blockquote'],
    allowedAttributes: { a: ['href', 'title'] },
    allowedSchemes: ['http', 'https', 'mailto'],
    allowProtocolRelative: false,
  })
}

function loadAuthors(): Author[] {
  if (authors) return authors
  if (!fs.existsSync(migratedPath)) return []
  const records = JSON.parse(fs.readFileSync(migratedPath, 'utf-8')) as AuthorRecord[]
  const mergedRecords = [...records]
  const knownSlugs = new Set(records.map(record => record.slug))
  if (fs.existsSync(curatedDir)) {
    for (const filename of fs.readdirSync(curatedDir).filter(name => name.endsWith('.md'))) {
      const slug = filename.replace(/\.md$/, '')
      if (knownSlugs.has(slug)) continue
      const { data } = matter(fs.readFileSync(path.join(curatedDir, filename), 'utf-8'))
      mergedRecords.push({
        id: stableNegativeId(`author:${slug}`),
        slug,
        name: String(data.name || slug),
        descriptionHtml: '',
        articleCount: 0,
      })
      knownSlugs.add(slug)
    }
  }
  authors = mergedRecords
    .map(record => {
      const curated = curatedOverride(record.slug)
      const bioHtml = renderBio(curated.bio, record.descriptionHtml)
      return {
        id: record.id,
        slug: record.slug,
        name: curated.name ?? record.name,
        photo: curated.photo ?? '',
        bio: plainText(bioHtml),
        bioHtml,
        articleCount: record.articleCount,
      }
    })
    .sort((a, b) => a.name.localeCompare(b.name, 'hu'))
  return authors
}

export function getAllAuthors(): Author[] {
  return loadAuthors()
}

export function getAuthorBySlug(slug: string): Author | null {
  return loadAuthors().find(author => author.slug === slug) ?? null
}
