import fs from 'fs'
import path from 'path'
import matter from 'gray-matter'
import { marked } from 'marked'

export interface AuthorRef {
  id: number
  slug: string
  name: string
}

export interface TagRef {
  id: number
  slug: string
  name: string
}

export interface SectionRef {
  id: number
  slug: string
  name: string
}

export interface MediaRef {
  id: number
  filename: string
  uri: string
  publicPath: string
  mimeType: string
  byteSize: number
  createdAt: number
}

export interface ArticleAttachment {
  articleId: number
  mediaId: number
  position: number
  description: string
  visible: boolean
  media: MediaRef
}

export interface ArticleComment {
  id: number
  parentId: number | null
  articleId: number
  authorName: string
  subject: string
  bodyHtml: string
  publishedAt: number
  threadPath: string
}

interface ArticleRecord {
  id: number
  slug: string
  contentType: string
  title: string
  authors: AuthorRef[]
  publishedAt: number
  date: string
  updatedAt: number
  tags: TagRef[]
  sections: SectionRef[]
  excerpt: string
  coverImage: string
  coverAlt: string
  coverTitle: string
  reads: number
  commentCount: number
  issueYear: string
  issueNumber: number | null
  issuePage: string
  summaryHtml?: string
  bodyHtml?: string
  attachments?: ArticleAttachment[]
  comments?: ArticleComment[]
  editorialOverride?: boolean
}

export interface Article {
  id: number
  slug: string
  contentType: string
  title: string
  authors: AuthorRef[]
  author: string
  authorSlug?: string
  date: string
  publishedAt: number
  updatedAt: number
  tags: string[]
  tagRefs: TagRef[]
  sections: SectionRef[]
  excerpt: string
  coverImage: string
  coverAlt: string
  coverTitle: string
  reads: number
  commentCount: number
  issueYear: string
  issueNumber: number | null
  issuePage: string
  content: string
  summaryHtml: string
  attachments: ArticleAttachment[]
  comments: ArticleComment[]
}

const migratedDir = path.join(process.cwd(), 'content', 'migrated', 'tanitani')
const articlesDir = path.join(migratedDir, 'articles')
const articleIndexPath = path.join(migratedDir, 'articles.json')
const editorialDir = path.join(process.cwd(), 'content', 'cikkek')
const authorRecordsPath = path.join(migratedDir, 'authors.json')
const curatedAuthorsDir = path.join(process.cwd(), 'content', 'szerzok')

let articleRecords: ArticleRecord[] | null = null
let articleBySlug: Map<string, ArticleRecord> | null = null

function stableNegativeId(value: string): number {
  let hash = 2166136261
  for (let index = 0; index < value.length; index++) {
    hash ^= value.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }
  return -(Math.abs(hash) || 1)
}

function slugify(value: string): string {
  return value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

function comparableSlug(value: string): string {
  return slugify(value).replaceAll('-', '')
}

function comparableTitle(value: string): string {
  return value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('hu')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

function editorialDate(value: unknown, fallback?: string): string {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.toISOString().slice(0, 10)
  }
  const normalized = String(value || fallback || new Date().toISOString().slice(0, 10))
  const isoDate = normalized.match(/^\d{4}-\d{2}-\d{2}/)?.[0]
  return isoDate ?? new Date().toISOString().slice(0, 10)
}

function sanitizeEditorialHtml(value: string): string {
  let cleaned = value
  for (const origin of [
    'https://www.tani-tani.info',
    'http://www.tani-tani.info',
    'https://tani-tani.info',
    'http://tani-tani.info',
  ]) {
    cleaned = cleaned
      .replaceAll(`href="${origin}/`, 'href="/')
      .replaceAll(`href='${origin}/`, "href='/")
      .replaceAll(`src="${origin}/`, 'src="/')
      .replaceAll(`src='${origin}/`, "src='/")
  }
  return cleaned
    .replace(/<script\b[^>]*>[\s\S]*?<\/script\s*>/gi, '')
    .replace(/<(?:object|embed)\b[^>]*>[\s\S]*?<\/(?:object|embed)\s*>/gi, '')
    .replace(/<(?:object|embed)\b[^>]*\/?>/gi, '')
    .replace(/\s+on[a-z]+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, '')
    .replace(/((?:href|src)\s*=\s*["'])\s*javascript:[^"']*(["'])/gi, '$1#$2')
    .replace(/\s+style\s*=\s*(?:"[^"]*(?:expression\s*\(|javascript\s*:)[^"]*"|'[^']*(?:expression\s*\(|javascript\s*:)[^']*')/gi, '')
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

function editorialAuthorMap(): Map<string, AuthorRef> {
  const result = new Map<string, AuthorRef>()
  if (fs.existsSync(authorRecordsPath)) {
    const records = JSON.parse(fs.readFileSync(authorRecordsPath, 'utf-8')) as AuthorRef[]
    records.forEach(author => result.set(author.slug, author))
  }
  if (fs.existsSync(curatedAuthorsDir)) {
    for (const filename of fs.readdirSync(curatedAuthorsDir).filter(name => name.endsWith('.md'))) {
      const authorSlug = filename.replace(/\.md$/, '')
      const { data } = matter(fs.readFileSync(path.join(curatedAuthorsDir, filename), 'utf-8'))
      const existing = result.get(authorSlug)
      result.set(authorSlug, {
        id: existing?.id ?? stableNegativeId(`author:${authorSlug}`),
        slug: authorSlug,
        name: String(data.name || existing?.name || authorSlug),
      })
    }
  }
  return result
}

function loadEditorialRecords(migrated: ArticleRecord[]): ArticleRecord[] {
  if (!fs.existsSync(editorialDir)) return []
  const migratedById = new Map(migrated.map(article => [article.id, article]))
  const migratedBySlug = new Map(migrated.map(article => [comparableSlug(article.slug), article]))
  const migratedTitles = migrated.map(article => comparableTitle(article.title))
  const authors = editorialAuthorMap()
  const usedIds = new Set(migrated.map(article => article.id))
  const records: ArticleRecord[] = []

  for (const filename of fs.readdirSync(editorialDir).filter(name => name.endsWith('.md')).sort()) {
    const fileSlug = filename.replace(/\.md$/, '')
    const filePath = path.join(editorialDir, filename)
    const { data, content } = matter(fs.readFileSync(filePath, 'utf-8'))
    const title = String(data.title || '').trim()
    const titleKey = comparableTitle(title)
    const migratedId = Number(data.migratedId)
    const idMatch = Number.isInteger(migratedId) ? migratedById.get(migratedId) : undefined
    const slugMatch = migratedBySlug.get(comparableSlug(fileSlug))
    const titleMatches = migrated.filter(article => comparableTitle(article.title) === titleKey)
    const migratedMatch = idMatch ?? slugMatch ?? (titleMatches.length === 1 ? titleMatches[0] : undefined)
    const alreadyMigrated = Boolean(slugMatch) || migratedTitles.some(existing =>
      existing === titleKey || existing.endsWith(` ${titleKey}`) || titleKey.endsWith(` ${existing}`),
    )
    const overrideMigrated = data.overrideMigrated === true
    if (!title || (alreadyMigrated && !overrideMigrated)) {
      continue
    }
    const fullMigratedPath = migratedMatch
      ? path.join(articlesDir, `${migratedMatch.id}.json`)
      : ''
    const baseRecord = fullMigratedPath && fs.existsSync(fullMigratedPath)
      ? JSON.parse(fs.readFileSync(fullMigratedPath, 'utf-8')) as ArticleRecord
      : migratedMatch
    const authorSlugs = Array.isArray(data.authorSlugs)
      ? data.authorSlugs.map(String).filter(Boolean)
      : data.authorSlug
        ? [String(data.authorSlug)]
        : []
    const authorRefs = authorSlugs
      .map(authorSlug => authors.get(authorSlug))
      .filter((author): author is AuthorRef => Boolean(author))
    if (authorRefs.length === 0 && baseRecord?.authors.length) {
      authorRefs.push(...baseRecord.authors)
    } else if (authorRefs.length === 0 && data.author) {
      authorRefs.push({
        id: stableNegativeId(`author-name:${data.author}`),
        slug: slugify(String(data.author)),
        name: String(data.author),
      })
    }
    if (authorRefs.length === 0) continue
    const date = editorialDate(data.date, baseRecord?.date)
    const publishedAt = baseRecord?.date === date
      ? baseRecord.publishedAt
      : Math.floor(new Date(`${date}T12:00:00+02:00`).getTime() / 1000)
    const tagNames = Array.isArray(data.tags) ? data.tags.map(String) : null
    const tags = tagNames
      ? tagNames.map(name => ({
          id: stableNegativeId(`tag:${name}`),
          slug: slugify(name),
          name,
        }))
      : baseRecord?.tags ?? []
    const bodyHtml = sanitizeEditorialHtml(String(marked.parse(content)))
    let id = baseRecord?.id ?? stableNegativeId(`article:${fileSlug}`)
    while (!baseRecord && usedIds.has(id)) id -= 1
    usedIds.add(id)
    records.push({
      ...baseRecord,
      id,
      slug: baseRecord?.slug ?? fileSlug,
      contentType: baseRecord?.contentType ?? 'poszt',
      title,
      authors: authorRefs,
      publishedAt,
      date,
      updatedAt: baseRecord?.updatedAt ?? publishedAt,
      tags,
      sections: baseRecord?.sections ?? [],
      excerpt: String(data.excerpt || baseRecord?.excerpt || plainText(bodyHtml).slice(0, 320)),
      coverImage: String(data.coverImage || data.image || baseRecord?.coverImage || ''),
      coverAlt: String(data.coverAlt || baseRecord?.coverAlt || title),
      coverTitle: String(data.coverTitle || baseRecord?.coverTitle || ''),
      reads: data.reads === undefined ? baseRecord?.reads ?? 0 : Number(data.reads),
      commentCount: baseRecord?.commentCount ?? 0,
      issueYear: baseRecord?.issueYear ?? '',
      issueNumber: baseRecord?.issueNumber ?? null,
      issuePage: baseRecord?.issuePage ?? '',
      summaryHtml: '',
      bodyHtml,
      attachments: baseRecord?.attachments ?? [],
      comments: baseRecord?.comments ?? [],
      editorialOverride: Boolean(baseRecord),
    })
  }
  return records
}

function loadArticleRecords(): ArticleRecord[] {
  if (articleRecords) return articleRecords
  if (!fs.existsSync(articleIndexPath)) return []
  const migrated = JSON.parse(fs.readFileSync(articleIndexPath, 'utf-8')) as ArticleRecord[]
  const editorial = loadEditorialRecords(migrated)
  const overriddenIds = new Set(
    editorial.filter(article => article.editorialOverride).map(article => article.id),
  )
  articleRecords = [...migrated.filter(article => !overriddenIds.has(article.id)), ...editorial]
    .sort((a, b) => b.publishedAt - a.publishedAt || b.id - a.id)
  articleBySlug = new Map(articleRecords.map(article => [article.slug, article]))
  return articleRecords
}

function toArticle(record: ArticleRecord): Article {
  const authorNames = record.authors.map(author => author.name)
  return {
    id: record.id,
    slug: record.slug,
    contentType: record.contentType,
    title: record.title,
    authors: record.authors,
    author: authorNames.join(', '),
    authorSlug: record.authors.length === 1 ? record.authors[0].slug : undefined,
    date: record.date,
    publishedAt: record.publishedAt,
    updatedAt: record.updatedAt,
    tags: record.tags.map(tag => tag.name),
    tagRefs: record.tags,
    sections: record.sections,
    excerpt: record.excerpt,
    coverImage: record.coverImage,
    coverAlt: record.coverAlt,
    coverTitle: record.coverTitle,
    reads: record.reads,
    commentCount: record.commentCount,
    issueYear: record.issueYear,
    issueNumber: record.issueNumber,
    issuePage: record.issuePage,
    content: record.bodyHtml ?? '',
    summaryHtml: record.summaryHtml ?? '',
    attachments: record.attachments ?? [],
    comments: record.comments ?? [],
  }
}

function decodeSlug(slug: string): string {
  try {
    return decodeURIComponent(slug)
  } catch {
    return slug
  }
}

function findArticleRecord(slug: string): ArticleRecord | undefined {
  loadArticleRecords()
  const decoded = decodeSlug(slug)
  return articleBySlug?.get(decoded) ?? articleBySlug?.get(decoded.replaceAll('-', '_'))
}

export function readingTime(content: string): number {
  const plainText = content
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&[a-zA-Z0-9#]+;/g, ' ')
  const wordCount = plainText.trim() ? plainText.trim().split(/\s+/).length : 0
  return Math.max(1, Math.ceil(wordCount / 200))
}

export function getAllArticles(): Article[] {
  return loadArticleRecords().map(toArticle)
}

export function getArticleBySlug(slug: string): Article | null {
  const indexRecord = findArticleRecord(slug)
  if (!indexRecord) return null
  if (indexRecord.editorialOverride) return toArticle(indexRecord)
  const fullPath = path.join(articlesDir, `${indexRecord.id}.json`)
  if (!fs.existsSync(fullPath)) return toArticle(indexRecord)
  const fullRecord = JSON.parse(fs.readFileSync(fullPath, 'utf-8')) as ArticleRecord
  return toArticle(fullRecord)
}

export function getArticleById(id: number): Article | null {
  const record = loadArticleRecords().find(article => article.id === id)
  return record ? getArticleBySlug(record.slug) : null
}

export function getArticlesByAuthorSlug(authorSlug: string): Article[] {
  return getAllArticles().filter(article =>
    article.authors.some(author => author.slug === authorSlug),
  )
}

export function getAllTags(): string[] {
  const counts = new Map<string, number>()
  for (const article of getAllArticles()) {
    for (const tag of article.tags) counts.set(tag, (counts.get(tag) ?? 0) + 1)
  }
  return Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'hu'))
    .map(([tag]) => tag)
}

export function getArticlesByTag(tag: string): Article[] {
  const decoded = decodeSlug(tag)
  return getAllArticles().filter(article => article.tags.includes(decoded))
}
