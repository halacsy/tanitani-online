import type { MetadataRoute } from 'next'
import { getAllArticles, getAllTags } from '@/lib/content'
import { getAllAuthors } from '@/lib/authors'
import { getAllArchivePages } from '@/lib/pages'
import { SITE_URL } from '@/lib/site'

const ARTICLES_PER_PAGE = 24

function absolute(path: string): string {
  return `${SITE_URL}${path}`
}

export default function sitemap(): MetadataRoute.Sitemap {
  const articles = getAllArticles()
  const latest = articles[0]?.updatedAt
    ? new Date(articles[0].updatedAt * 1000)
    : new Date('2026-08-11T00:00:00+02:00')
  const pageCount = Math.ceil(articles.length / ARTICLES_PER_PAGE)

  const staticPages: MetadataRoute.Sitemap = [
    { url: absolute('/'), lastModified: latest, changeFrequency: 'weekly', priority: 1 },
    { url: absolute('/cikkek'), lastModified: latest, changeFrequency: 'weekly', priority: 0.9 },
    { url: absolute('/kereses'), lastModified: latest, changeFrequency: 'weekly', priority: 0.7 },
    { url: absolute('/temakorok'), lastModified: latest, changeFrequency: 'monthly', priority: 0.7 },
    { url: absolute('/szerzokrol'), lastModified: latest, changeFrequency: 'monthly', priority: 0.7 },
    { url: absolute('/rolunk'), lastModified: latest, changeFrequency: 'yearly', priority: 0.5 },
  ]

  const archivePagination: MetadataRoute.Sitemap = Array.from(
    { length: Math.max(0, pageCount - 1) },
    (_, index) => ({
      url: absolute(`/cikkek/oldal/${index + 2}`),
      lastModified: latest,
      changeFrequency: 'monthly' as const,
      priority: 0.5,
    }),
  )

  return [
    ...staticPages,
    ...archivePagination,
    ...articles.map(article => ({
      url: absolute(`/cikkek/${encodeURIComponent(article.slug)}`),
      lastModified: new Date(article.updatedAt * 1000),
      changeFrequency: 'yearly' as const,
      priority: 0.8,
    })),
    ...getAllAuthors().filter(author => author.articleCount > 0).map(author => ({
      url: absolute(`/szerzok/${encodeURIComponent(author.slug)}`),
      lastModified: latest,
      changeFrequency: 'monthly' as const,
      priority: 0.5,
    })),
    ...getAllTags().map(tag => ({
      url: absolute(`/temakorok/${encodeURIComponent(tag)}`),
      lastModified: latest,
      changeFrequency: 'monthly' as const,
      priority: 0.5,
    })),
    ...getAllArchivePages().map(page => ({
      url: absolute(`/archivum/${page.slug.split('/').map(encodeURIComponent).join('/')}`),
      lastModified: new Date(page.updatedAt * 1000),
      changeFrequency: 'yearly' as const,
      priority: 0.3,
    })),
  ]
}
