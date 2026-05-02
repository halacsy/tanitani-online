import { notFound } from 'next/navigation'
import { getAllArticles, getArticleBySlug, readingTime, getArticlesByAuthorSlug } from '@/lib/content'
import { getAuthorBySlug } from '@/lib/authors'
import { marked } from 'marked'
import Link from 'next/link'
import type { Metadata } from 'next'
import ReadingProgress from '@/app/components/ReadingProgress'
import AuthorBioBlock from '@/app/components/AuthorBioBlock'
import ArticleCard from '@/app/components/ArticleCard'

interface Props {
  params: Promise<{ slug: string }>
}

export async function generateStaticParams() {
  return getAllArticles().map(a => ({ slug: a.slug }))
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params
  const article = getArticleBySlug(slug)
  if (!article) return {}
  return {
    title: `${article.title} – Taní-tani Online`,
    description: article.excerpt,
  }
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('hu-HU', { year: 'numeric', month: 'long', day: 'numeric' })
}

export default async function ArticlePage({ params }: Props) {
  const { slug } = await params
  const article = getArticleBySlug(slug)
  if (!article) notFound()

  const author = article.authorSlug ? getAuthorBySlug(article.authorSlug) : null
  const authorArticleCount = article.authorSlug ? getArticlesByAuthorSlug(article.authorSlug).length : 0

  const allArticles = getAllArticles()
  const related = allArticles
    .filter(a => a.slug !== slug && a.tags.some(t => article.tags.includes(t)))
    .slice(0, 3)

  const html = marked(article.content) as string
  const minutes = readingTime(article.content)

  return (
    <>
      <ReadingProgress />

      {/* Cover image */}
      {article.coverImage && (
        <div className="w-full h-48 sm:h-72 md:h-96 overflow-hidden relative">
          <img
            src={article.coverImage}
            alt={article.title}
            className="w-full h-full object-cover object-top"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-black/30" />
        </div>
      )}

      {/* Article header */}
      <header className="bg-white border-b border-line px-6 pt-8 pb-0">
        <div className="max-w-3xl mx-auto">
          {/* Breadcrumb */}
          <div className="flex gap-1.5 items-center mb-5 font-sans text-xs text-muted">
            <Link href="/" className="hover:text-brand transition-colors">Kezdőlap</Link>
            <span className="text-line">›</span>
            <Link href="/cikkek" className="hover:text-brand transition-colors">Cikkek</Link>
          </div>

          {/* Tags */}
          <div className="flex flex-wrap gap-1.5 mb-4">
            {article.tags.map(tag => (
              <Link key={tag} href={`/temakorok/${encodeURIComponent(tag)}`} className="tag-pill">{tag}</Link>
            ))}
          </div>

          {/* Title */}
          <h1 className="font-display text-3xl md:text-4xl lg:text-5xl font-bold leading-tight text-charcoal mb-4 tracking-tight">
            {article.title}
          </h1>

          {/* Excerpt */}
          <p className="font-body text-base md:text-lg leading-relaxed text-muted italic mb-6">
            {article.excerpt}
          </p>

          {/* Author + meta */}
          <div className="flex items-center gap-3 flex-wrap pb-6 border-b border-line">
            {author?.photo ? (
              <Link href={`/szerzok/${author.slug}`} className="shrink-0">
                <img
                  src={author.photo}
                  alt={author.name}
                  className="w-11 h-11 rounded-full object-cover object-top border-2 border-line"
                />
              </Link>
            ) : (
              <div className="w-11 h-11 rounded-full bg-brand-light flex items-center justify-center font-display text-base font-bold text-brand shrink-0">
                {article.author.charAt(0)}
              </div>
            )}

            <div className="flex flex-col gap-0.5">
              {article.authorSlug ? (
                <Link href={`/szerzok/${article.authorSlug}`} className="font-sans text-sm font-semibold text-charcoal hover:text-brand transition-colors">
                  {article.author}
                </Link>
              ) : (
                <span className="font-sans text-sm font-semibold text-charcoal">{article.author}</span>
              )}
              <div className="flex items-center gap-1.5 flex-wrap font-sans text-xs text-muted">
                <span>{formatDate(article.date)}</span>
                <span className="text-line">·</span>
                <span>◷ {minutes} perc</span>
                <span className="text-line">·</span>
                <span>{article.reads.toLocaleString('hu-HU')} olvasás</span>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Article body */}
      <div className="max-w-7xl mx-auto px-6">
        <div className="lg:grid lg:grid-cols-[1fr_min(48rem,100%)_1fr] lg:gap-8">

          {/* Left sidebar — desktop only */}
          <aside className="hidden lg:block pt-12">
            <div className="sticky top-24 flex flex-col items-end gap-2">
              <span className="font-sans text-xs text-muted whitespace-nowrap">◷ {minutes} perc</span>
            </div>
          </aside>

          {/* Main content */}
          <div className="py-10 md:py-14">
            <article className="prose" dangerouslySetInnerHTML={{ __html: html }} />

            {/* Author bio */}
            {author && (
              <div className="mt-12 pt-8 border-t border-line">
                <h2 className="font-sans text-xs font-semibold tracking-widest uppercase text-muted mb-4">A szerzőről</h2>
                <AuthorBioBlock author={author} articleCount={authorArticleCount} />
              </div>
            )}

            {/* Back link */}
            <div className="mt-8">
              <Link href="/cikkek" className="font-sans text-sm text-brand hover:underline inline-flex items-center gap-1.5">
                ← Vissza a cikkekhez
              </Link>
            </div>

            {/* Related articles */}
            {related.length > 0 && (
              <div className="mt-12 pt-8 border-t border-line">
                <h2 className="font-display text-2xl font-bold text-charcoal mb-5">Kapcsolódó cikkek</h2>
                <div className="flex flex-col gap-4">
                  {related.map(rel => <ArticleCard key={rel.slug} article={rel} />)}
                </div>
              </div>
            )}
          </div>

          {/* Right gutter */}
          <div className="hidden lg:block" />
        </div>
      </div>
    </>
  )
}
