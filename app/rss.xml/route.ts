import { getAllArticles } from '@/lib/content'
import { SITE_DESCRIPTION, SITE_NAME, SITE_URL } from '@/lib/site'

function xml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;')
}

export function GET() {
  const articles = getAllArticles().slice(0, 50)
  const items = articles.map(article => {
    const link = `${SITE_URL}/cikkek/${encodeURIComponent(article.slug)}`
    return `
      <item>
        <title>${xml(article.title)}</title>
        <link>${xml(link)}</link>
        <guid isPermaLink="true">${xml(link)}</guid>
        <pubDate>${new Date(article.publishedAt * 1000).toUTCString()}</pubDate>
        <author>${xml(article.author)}</author>
        <description>${xml(article.excerpt)}</description>
        ${article.tags.map(tag => `<category>${xml(tag)}</category>`).join('')}
      </item>`
  }).join('')
  const lastBuildDate = articles[0]
    ? new Date(articles[0].updatedAt * 1000).toUTCString()
    : new Date().toUTCString()
  const body = `<?xml version="1.0" encoding="UTF-8"?>
    <rss version="2.0">
      <channel>
        <title>${xml(SITE_NAME)}</title>
        <link>${xml(SITE_URL)}</link>
        <description>${xml(SITE_DESCRIPTION)}</description>
        <language>hu</language>
        <lastBuildDate>${lastBuildDate}</lastBuildDate>
        ${items}
      </channel>
    </rss>`
  return new Response(body, {
    headers: {
      'Content-Type': 'application/rss+xml; charset=utf-8',
      'Cache-Control': 'public, max-age=3600, s-maxage=3600',
    },
  })
}
