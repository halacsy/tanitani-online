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

export function readingTime(content: string): number {
  const wordsPerMinute = 200
  const words = content.trim().split(/\s+/).length
  return Math.ceil(words / wordsPerMinute)
}

export function getAllArticles(): Article[] {
  if (!fs.existsSync(cikkekDir)) return []

  const files = fs.readdirSync(cikkekDir).filter(f => f.endsWith('.md'))

  const articles = files.map(filename => {
    const slug = filename.replace(/\.md$/, '')
    const filePath = path.join(cikkekDir, filename)
    const raw = fs.readFileSync(filePath, 'utf-8')
    const { data, content } = matter(raw)

    return {
      slug,
      title: data.title ?? '',
      author: data.author ?? '',
      authorSlug: data.authorSlug ?? undefined,
      date: data.date ?? '',
      tags: data.tags ?? [],
      excerpt: data.excerpt ?? '',
      coverImage: data.coverImage ?? data.image ?? '',
      reads: data.reads ?? 0,
      content,
    } as Article
  })

  return articles.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
}

export function getArticleBySlug(slug: string): Article | null {
  const filePath = path.join(cikkekDir, `${slug}.md`)
  if (!fs.existsSync(filePath)) return null

  const raw = fs.readFileSync(filePath, 'utf-8')
  const { data, content } = matter(raw)

  return {
    slug,
    title: data.title ?? '',
    author: data.author ?? '',
    authorSlug: data.authorSlug ?? undefined,
    date: data.date ?? '',
    tags: data.tags ?? [],
    excerpt: data.excerpt ?? '',
    coverImage: data.coverImage ?? data.image ?? '',
    reads: data.reads ?? 0,
    content,
  }
}

export function getArticlesByAuthorSlug(authorSlug: string): Article[] {
  return getAllArticles().filter(a => a.authorSlug === authorSlug)
}

// Returns tags sorted by article frequency (most used first)
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
