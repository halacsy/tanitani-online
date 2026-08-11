import { getAllArticles, getAllTags } from '@/lib/content'
import Link from 'next/link'

export const metadata = {
  title: 'Témakörök',
}

export default async function TemakorokPage() {
  const articles = getAllArticles()
  const tags = getAllTags()

  const tagCounts = tags.map(tag => ({
    tag,
    count: articles.filter(a => a.tags.includes(tag)).length,
  }))

  return (
    <div className="max-w-7xl mx-auto px-6 py-10">
      <h1 className="font-display text-3xl md:text-4xl lg:text-5xl font-bold text-charcoal mb-2">
        Témakörök
      </h1>
      <p className="font-sans text-sm text-muted mb-10">
        Böngéssz cikkek között témakör szerint
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {tagCounts.map(({ tag, count }) => (
          <Link key={tag} href={`/temakorok/${encodeURIComponent(tag)}`}>
            <div className="card-lift bg-white rounded-xl border border-line px-5 py-4 flex justify-between items-center">
              <span className="font-display text-base font-semibold text-charcoal">{tag}</span>
              <span className="font-sans text-xs font-medium bg-brand-light text-brand px-2.5 py-0.5 rounded-full">
                {count}
              </span>
            </div>
          </Link>
        ))}
      </div>
    </div>
  )
}
