'use client'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import type { Article } from '@/lib/content'

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('hu-HU', { year: 'numeric', month: 'long', day: 'numeric' })
}

interface Props {
  article: Article
  featured?: boolean
  large?: boolean
}

export default function ArticleCard({ article, featured = false, large = false }: Props) {
  const router = useRouter()
  const href = `/cikkek/${article.slug}`

  const authorEl = article.authorSlug ? (
    <Link
      href={`/szerzok/${article.authorSlug}`}
      className="font-medium text-charcoal hover:text-brand transition-colors relative z-10"
    >
      {article.author}
    </Link>
  ) : (
    <span className="font-medium text-charcoal">{article.author}</span>
  )

  // --- FEATURED (hero) ---
  if (featured) {
    return (
      <article
        className="card-lift bg-white rounded-2xl overflow-hidden border border-line cursor-pointer
                   grid grid-cols-1 md:grid-cols-2"
        onClick={() => router.push(href)}
      >
        {article.coverImage && (
          <div className="relative min-h-48 md:min-h-80 overflow-hidden">
            <img
              src={article.coverImage}
              alt={article.title}
              className="w-full h-full object-cover object-top"
            />
          </div>
        )}
        <div className="p-6 md:p-10 flex flex-col justify-center">
          <div className="flex flex-wrap gap-1.5 mb-4">
            {article.tags.slice(0, 3).map(tag => <span key={tag} className="tag-pill">{tag}</span>)}
          </div>
          <h2 className="font-display text-2xl md:text-3xl font-bold leading-tight text-charcoal mb-3">
            {article.title}
          </h2>
          <p className="font-body text-sm md:text-base leading-relaxed text-muted mb-6">
            {article.excerpt}
          </p>
          <div className="flex items-center gap-2.5 flex-wrap mt-auto pt-4 border-t border-line font-sans text-sm">
            {authorEl}
            <span className="text-line">·</span>
            <span className="text-muted text-xs">{formatDate(article.date)}</span>
            <span className="text-line">·</span>
            <span className="text-muted text-xs">{article.reads.toLocaleString('hu-HU')} olvasás</span>
          </div>
        </div>
      </article>
    )
  }

  // --- LARGE (spans 2 cols on desktop) ---
  if (large) {
    return (
      <article
        className="card-lift bg-white rounded-xl overflow-hidden border border-line cursor-pointer
                   col-span-1 md:col-span-2
                   grid grid-cols-1 sm:grid-cols-[2fr_3fr]"
        onClick={() => router.push(href)}
      >
        {article.coverImage && (
          <div className="relative min-h-44 overflow-hidden">
            <img
              src={article.coverImage}
              alt={article.title}
              className="w-full h-full object-cover object-top"
            />
          </div>
        )}
        <div className="p-6 md:p-7 flex flex-col">
          <div className="flex flex-wrap gap-1.5 mb-3">
            {article.tags.slice(0, 3).map(tag => <span key={tag} className="tag-pill">{tag}</span>)}
          </div>
          <h3 className="font-display text-xl md:text-2xl font-bold leading-snug text-charcoal mb-2.5">
            {article.title}
          </h3>
          <p className="font-sans text-sm leading-relaxed text-muted mb-4 flex-1">
            {article.excerpt}
          </p>
          <div className="flex items-center gap-2 flex-wrap pt-3 border-t border-line font-sans text-sm">
            {authorEl}
            <span className="text-line text-xs">·</span>
            <span className="text-muted text-xs">{formatDate(article.date)}</span>
          </div>
        </div>
      </article>
    )
  }

  // --- STANDARD ---
  return (
    <article
      className="card-lift bg-white rounded-xl overflow-hidden border border-line cursor-pointer
                 flex flex-col h-full"
      onClick={() => router.push(href)}
    >
      {article.coverImage && (
        <div className="relative h-40 overflow-hidden shrink-0">
          <img
            src={article.coverImage}
            alt={article.title}
            className="w-full h-full object-cover object-[center_20%]"
          />
        </div>
      )}
      <div className="p-4 md:p-5 flex flex-col flex-1">
        <div className="flex flex-wrap gap-1 mb-2">
          {article.tags.slice(0, 2).map(tag => <span key={tag} className="tag-pill">{tag}</span>)}
        </div>
        <h3 className="font-display text-base font-semibold leading-snug text-charcoal mb-1.5 flex-1">
          {article.title}
        </h3>
        <p className="font-sans text-xs leading-relaxed text-muted mb-3 line-clamp-2">
          {article.excerpt}
        </p>
        <div className="flex items-center gap-1.5 flex-wrap mt-auto pt-2.5 border-t border-line font-sans text-xs">
          {authorEl}
          <span className="text-line">·</span>
          <span className="text-muted">{formatDate(article.date)}</span>
        </div>
      </div>
    </article>
  )
}
