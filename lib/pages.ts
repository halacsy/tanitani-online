import navigation from '@/public/navigation.json'
import fs from 'fs'
import path from 'path'
import matter from 'gray-matter'
import { marked } from 'marked'
import { sanitizePageHtml } from './sanitize-page'
import { getAuthorBySlug } from './authors'

export interface EditorialPerson {
  name: string
  role: string
  photo: string
  authorSlug?: string
}

export interface ArchivePage {
  id: number
  slug: string
  contentType: string
  title: string
  bodyHtml: string
  summaryHtml: string
  publishedAt: number
  updatedAt: number
  editors?: EditorialPerson[]
  closingHtml?: string
}

const pagesPath = path.join(
  process.cwd(), 'content', 'migrated', 'tanitani', 'pages.json',
)

let pages: ArchivePage[] | null = null

// Only these current informational pages have an editorial counterpart.
// The filename and migrated ID are fixed, so edits cannot change legacy URLs.
const editablePages: Record<string, { filename: string; id: number }> = {
  szerzoinknek: { filename: 'szerzoinknek.md', id: 405 },
  kapcsolat_: { filename: 'kapcsolat.md', id: 221 },
  impresszum: { filename: 'impresszum.md', id: 2 },
  jogi_nyilatkozat: { filename: 'jogi-nyilatkozat.md', id: 590 },
}

function loadPages(): ArchivePage[] {
  if (pages) return pages
  if (!fs.existsSync(pagesPath)) return []
  const archived = JSON.parse(fs.readFileSync(pagesPath, 'utf-8')) as ArchivePage[]
  pages = archived.map(page => {
    const editable = editablePages[page.slug]
    if (!editable || editable.id !== page.id) return page
    const filePath = path.join(process.cwd(), 'content', 'oldalak', editable.filename)
    if (!fs.existsSync(filePath)) return page
    const { data, content } = matter(fs.readFileSync(filePath, 'utf-8'))
    if (Number(data.migratedId) !== page.id) {
      throw new Error(`Hibás archív azonosító: ${editable.filename}`)
    }
    const editors = page.slug === 'impresszum' && Array.isArray(data.editors)
      ? data.editors.map((entry: EditorialPerson) => {
          const authorSlug = String(entry.authorSlug || '')
          const author = authorSlug ? getAuthorBySlug(authorSlug) : null
          if (authorSlug && !author) throw new Error(`Hiányzó szerzői profil: ${authorSlug}`)
          return {
            name: author?.name || String(entry.name || ''),
            role: String(entry.role || ''),
            photo: String(entry.photo || author?.photo || ''),
            ...(authorSlug ? { authorSlug } : {}),
          }
        })
      : undefined
    return {
      ...page,
      title: String(data.title || page.title),
      bodyHtml: sanitizePageHtml(String(marked.parse(content))),
      ...(editors ? { editors, closingHtml: sanitizePageHtml(String(marked.parse(String(data.closing || '')))) } : {}),
    }
  })
  return pages
}

function decodeSlug(slug: string): string {
  try {
    return decodeURIComponent(slug)
  } catch {
    return slug
  }
}

export function getAllArchivePages(): ArchivePage[] {
  return loadPages()
}

export function getArchivePageBySlug(slug: string): ArchivePage | null {
  const decoded = decodeSlug(slug)
  return loadPages().find(page => page.slug === decoded) ?? null
}

export function getArchivePageById(id: number): ArchivePage | null {
  return loadPages().find(page => page.id === id) ?? null
}

// Current navigation destinations for historical entry points.
export function getCurrentPageHref(slug: string): string | null {
  const destinations: Record<string, string> = {
    mi_ez: '/folyoirat',
    rovatok: '/folyoirat/rovatok',
    fomunkatarsaink: '/fomunkatarsaink',
    hirlevel: navigation.newsletter.href,
    'konyvek/1': '/konyvek',
  }
  return destinations[slug] ?? null
}
