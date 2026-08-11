import { notFound } from 'next/navigation'
import { getAllTags, getArticlesByTag } from '@/lib/content'
import ArticleCard from '../../components/ArticleCard'
import Link from 'next/link'
import type { Metadata } from 'next'

interface Props {
  params: Promise<{ tag: string }>
}

export async function generateStaticParams() {
  return getAllTags().map(tag => ({ tag: encodeURIComponent(tag) }))
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { tag } = await params
  return { title: decodeURIComponent(tag) }
}

export default async function TagPage({ params }: Props) {
  const { tag } = await params
  const decoded = decodeURIComponent(tag)
  const articles = getArticlesByTag(decoded)

  if (articles.length === 0) notFound()

  return (
    <div className="max-w-7xl mx-auto px-6 py-10">
      {/* Breadcrumb */}
      <div className="flex gap-2 items-center mb-6 font-sans text-xs text-muted">
        <Link href="/temakorok" className="hover:text-brand transition-colors">Témakörök</Link>
        <span className="text-line">›</span>
        <span className="text-charcoal">{decoded}</span>
      </div>

      <h1 className="font-display text-3xl md:text-4xl font-bold text-charcoal mb-2">
        {decoded}
      </h1>
      <p className="font-sans text-sm text-muted mb-10">
        {articles.length} cikk ebben a témakörben
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
        {articles.map(article => (
          <ArticleCard key={article.slug} article={article} />
        ))}
      </div>
    </div>
  )
}
