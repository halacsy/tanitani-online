import navigation from '@/public/navigation.json'
import fs from 'fs'
import path from 'path'

export interface ArchivePage {
  id: number
  slug: string
  contentType: string
  title: string
  bodyHtml: string
  summaryHtml: string
  publishedAt: number
  updatedAt: number
}

const pagesPath = path.join(
  process.cwd(), 'content', 'migrated', 'tanitani', 'pages.json',
)

let pages: ArchivePage[] | null = null

function loadPages(): ArchivePage[] {
  if (pages) return pages
  if (!fs.existsSync(pagesPath)) return []
  pages = JSON.parse(fs.readFileSync(pagesPath, 'utf-8')) as ArchivePage[]
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
  }
  return destinations[slug] ?? null
}
