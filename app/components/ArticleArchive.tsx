import Link from 'next/link'
import ArticleCard from './ArticleCard'
import type { Article } from '@/lib/content'

export const ARTICLES_PER_PAGE = 24

function pageHref(page: number): string {
  return page === 1 ? '/cikkek' : `/cikkek/oldal/${page}`
}

export default function ArticleArchive({
  articles,
  page,
  totalArticles,
}: {
  articles: Article[]
  page: number
  totalArticles: number
}) {
  const totalPages = Math.ceil(totalArticles / ARTICLES_PER_PAGE)
  const visiblePages = Array.from({ length: totalPages }, (_, index) => index + 1)
    .filter(value => value === 1 || value === totalPages || Math.abs(value - page) <= 2)

  return (
    <>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
        {articles.map(article => <ArticleCard key={article.slug} article={article} />)}
      </div>

      {totalPages > 1 && (
        <nav className="mt-10 flex flex-wrap items-center justify-center gap-2" aria-label="Cikkoldalak">
          {page > 1 && (
            <Link className="archive-page-link" href={pageHref(page - 1)}>← Előző</Link>
          )}
          {visiblePages.map((value, index) => {
            const previous = visiblePages[index - 1]
            return (
              <span key={value} className="contents">
                {previous && value - previous > 1 && <span className="text-muted px-1">…</span>}
                <Link
                  href={pageHref(value)}
                  aria-current={value === page ? 'page' : undefined}
                  className={`archive-page-link ${value === page ? 'archive-page-link-active' : ''}`}
                >
                  {value}
                </Link>
              </span>
            )
          })}
          {page < totalPages && (
            <Link className="archive-page-link" href={pageHref(page + 1)}>Következő →</Link>
          )}
        </nav>
      )}
    </>
  )
}
