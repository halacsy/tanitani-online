import fs from 'fs'
import path from 'path'
import matter from 'gray-matter'

export interface Article {
  slug: string
  title: string
  author: string
  authorSlug?: string
  date: string
  tags: string[]
  excerpt: string
  coverImage: string
  reads: number
  content: string
}

const cikkekDir = path.join(process.cwd(), 'content', 'cikkek')
const szerzokDir = path.join(process.cwd(), 'content', 'szerzok')

// Resolve author name from authorSlug, fall back to stored author string
function resolveAuthorName(authorSlug: string | undefined, fallback: string): string {
  if (!authorSlug) return fallback
  const filePath = path.join(szerzokDir, `${authorSlug}.md`)
  if (!fs.existsSync(filePath)) return fallback
  const { data } = matter(fs.readFileSync(filePath, 'utf-8'))
  return data.name ?? fallback
}

function parseArticle(slug: string, raw: string): Article {
  const { data, content } = matter(raw)
  const authorSlug: string | undefined = data.authorSlug ?? undefined
  return {
    slug,
    title: data.title ?? '',
    author: resolveAuthorName(authorSlug, data.author ?? ''),
    authorSlug,
    date: data.date ?? '',
    tags: data.tags ?? [],
    excerpt: data.excerpt ?? '',
    coverImage: data.coverImage ?? data.image ?? '',
    reads: data.reads ?? 0,
    content,
  }
}

export function readingTime(content: string): number {
  const wordsPerMinute = 200
  const words = content.trim().split(/\s+/).length
  return Math.ceil(words / wordsPerMinute)
}

export function getAllArticles(): Article[] {
  if (!fs.existsSync(cikkekDir)) return []
  return fs.readdirSync(cikkekDir)
    .filter(f => f.endsWith('.md'))
    .map(filename => {
      const slug = filename.replace(/\.md$/, '')
      const raw = fs.readFileSync(path.join(cikkekDir, filename), 'utf-8')
      return parseArticle(slug, raw)
    })
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
}

export function getArticleBySlug(slug: string): Article | null {
  const filePath = path.join(cikkekDir, `${slug}.md`)
  if (!fs.existsSync(filePath)) return null
  return parseArticle(slug, fs.readFileSync(filePath, 'utf-8'))
}

export function getArticlesByAuthorSlug(authorSlug: string): Article[] {
  return getAllArticles().filter(a => a.authorSlug === authorSlug)
}

export function getAllTags(): string[] {
  const articles = getAllArticles()
  const tagCount = new Map<string, number>()
  articles.forEach(a => a.tags.forEach(t => tagCount.set(t, (tagCount.get(t) ?? 0) + 1)))
  return Array.from(tagCount.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([t]) => t)
}

export function getArticlesByTag(tag: string): Article[] {
  return getAllArticles().filter(a => a.tags.includes(tag))
}
