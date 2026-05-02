import { getAllArticles, getAllTags } from '@/lib/content'
import ArticleCard from '../components/ArticleCard'
import Link from 'next/link'

export const metadata = {
  title: 'Cikkek – Taní-tani Online',
}

export default async function CikkekPage() {
  const articles = getAllArticles()
  const tags = getAllTags()

  return (
    <div className="max-w-7xl mx-auto px-6 py-10">
      <div className="mb-10">
        <h1 className="font-display text-3xl md:text-4xl lg:text-5xl font-bold text-charcoal mb-2">
          Összes cikk
        </h1>
        <p className="font-sans text-sm text-muted">
          {articles.length} cikk · szűrj témakör szerint
        </p>
      </div>

      {/* Tag filters */}
      <div className="flex flex-wrap gap-2 mb-8">
        {tags.map(tag => (
          <Link
            key={tag}
            href={`/temakorok/${encodeURIComponent(tag)}`}
            className="font-sans text-sm px-3 py-1 rounded-full border-[1.5px] border-line text-charcoal bg-white hover:border-brand hover:text-brand transition-colors"
          >
            {tag}
          </Link>
        ))}
      </div>

      {/* Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
        {articles.map(article => (
          <ArticleCard key={article.slug} article={article} />
        ))}
      </div>
    </div>
  )
}
