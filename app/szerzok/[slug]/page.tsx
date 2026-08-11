import { notFound } from 'next/navigation'
import { getAllAuthors, getAuthorBySlug } from '@/lib/authors'
import { getArticlesByAuthorSlug } from '@/lib/content'
import ArticleCard from '@/app/components/ArticleCard'
import Link from 'next/link'
import type { Metadata } from 'next'
import Image from 'next/image'

interface Props {
  params: Promise<{ slug: string }>
}

export async function generateStaticParams() {
  return getAllAuthors().map(a => ({ slug: a.slug }))
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params
  const author = getAuthorBySlug(slug)
  if (!author) return {}
  return {
    title: author.name,
    description: author.bio,
  }
}

export default async function SzerzoPage({ params }: Props) {
  const { slug } = await params
  const author = getAuthorBySlug(slug)
  if (!author) notFound()

  const articles = getArticlesByAuthorSlug(slug)

  const tagCount = new Map<string, number>()
  articles.forEach(a => a.tags.forEach(t => tagCount.set(t, (tagCount.get(t) ?? 0) + 1)))
  const topTags = Array.from(tagCount.entries()).sort((a, b) => b[1] - a[1]).slice(0, 6).map(([t]) => t)

  return (
    <>
      {/* Author header */}
      <section className="bg-brand-light border-b border-line px-6 py-12">
        <div className="max-w-7xl mx-auto">
          {/* Breadcrumb */}
          <div className="flex gap-1.5 items-center mb-6 font-sans text-xs text-muted">
            <Link href="/szerzokrol" className="hover:text-brand transition-colors">Szerzők</Link>
            <span className="text-line">›</span>
            <span className="text-charcoal">{author.name}</span>
          </div>

          <div className="flex flex-col sm:flex-row gap-6 sm:gap-8 items-start">
            {/* Portrait */}
            {author.photo ? (
              <Image
                src={author.photo}
                alt={author.name}
                width={112}
                height={112}
                className="w-28 h-28 rounded-full object-cover object-top shrink-0 border-[3px] border-white shadow-md"
              />
            ) : (
              <div className="w-28 h-28 rounded-full bg-brand flex items-center justify-center font-display text-4xl font-bold text-white shrink-0">
                {author.name.charAt(0)}
              </div>
            )}

            <div className="flex-1 min-w-0">
              <h1 className="font-display text-3xl md:text-4xl lg:text-5xl font-bold text-charcoal mb-3 leading-tight">
                {author.name}
              </h1>

              {author.bio && (
                <p className="font-body text-base leading-relaxed text-charcoal mb-5 max-w-2xl">
                  {author.bio}
                </p>
              )}

              <div className="flex items-center gap-4 flex-wrap">
                <span className="font-sans text-sm text-muted">
                  {articles.length} cikk a Taní-tani Online-on
                </span>
                {topTags.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {topTags.map(tag => (
                      <Link key={tag} href={`/temakorok/${encodeURIComponent(tag)}`} className="tag-pill">{tag}</Link>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Articles */}
      <div className="max-w-7xl mx-auto px-6 py-10">
        <div className="flex items-center gap-3 mb-6">
          <h2 className="font-sans text-xs font-semibold tracking-widest uppercase text-muted">Cikkei</h2>
          <div className="flex-1 h-px bg-line" />
        </div>

        {articles.length === 0 ? (
          <p className="font-sans text-muted">Nincs még cikk ehhez a szerzőhöz.</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {articles.map(a => <ArticleCard key={a.slug} article={a} />)}
          </div>
        )}
      </div>
    </>
  )
}
