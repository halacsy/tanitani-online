import { getAllArticles } from '@/lib/content'
import { getAllAuthors } from '@/lib/authors'
import Link from 'next/link'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Szerzőink – Taní-tani Online',
}

export default async function SzerzokrolPage() {
  const articles = getAllArticles()
  const authors = getAllAuthors()

  const slugStats = new Map<string, { count: number; tags: Set<string> }>()
  for (const article of articles) {
    if (!article.authorSlug) continue
    if (!slugStats.has(article.authorSlug)) {
      slugStats.set(article.authorSlug, { count: 0, tags: new Set() })
    }
    const s = slugStats.get(article.authorSlug)!
    s.count++
    article.tags.forEach(t => s.tags.add(t))
  }

  const profiledAuthors = authors
    .map(a => ({
      ...a,
      count: slugStats.get(a.slug)?.count ?? 0,
      tags: Array.from(slugStats.get(a.slug)?.tags ?? []).slice(0, 3),
    }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, 'hu'))

  return (
    <>
      {/* Header */}
      <section className="bg-brand-light border-b border-line px-6 py-12">
        <div className="max-w-7xl mx-auto">
          <h1 className="font-display text-3xl md:text-4xl lg:text-5xl font-bold text-charcoal mb-2">
            Szerzőink
          </h1>
          <p className="font-sans text-sm text-muted">
            {profiledAuthors.length} szerző bemutatkozóval – az élő oldalon 900+
          </p>
        </div>
      </section>

      {/* Grid */}
      <div className="max-w-7xl mx-auto px-6 py-10">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {profiledAuthors.map(author => (
            <Link key={author.slug} href={`/szerzok/${author.slug}`} className="block">
              <div className="card-lift bg-white rounded-xl border border-line p-5 h-full">
                <div className="flex items-center gap-3.5 mb-3">
                  {author.photo ? (
                    <img
                      src={author.photo}
                      alt={author.name}
                      className="w-12 h-12 rounded-full object-cover object-top border-2 border-line shrink-0"
                    />
                  ) : (
                    <div className="w-12 h-12 rounded-full bg-brand-light flex items-center justify-center font-display text-lg font-bold text-brand shrink-0">
                      {author.name.charAt(0)}
                    </div>
                  )}
                  <div>
                    <div className="font-sans text-sm font-semibold text-charcoal leading-snug">{author.name}</div>
                    <div className="font-sans text-xs text-muted">
                      {author.count > 0 ? `${author.count} cikk` : 'Szerző'}
                    </div>
                  </div>
                </div>

                {author.bio && (
                  <p className="font-body text-xs leading-relaxed text-muted mb-3 line-clamp-2">
                    {author.bio}
                  </p>
                )}

                {author.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {author.tags.map(tag => (
                      <span key={tag} className="tag-pill text-[0.7rem]">{tag}</span>
                    ))}
                  </div>
                )}
              </div>
            </Link>
          ))}
        </div>
      </div>
    </>
  )
}
