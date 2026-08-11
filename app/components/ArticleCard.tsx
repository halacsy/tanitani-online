import Link from 'next/link'
import Image from 'next/image'
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
  const href = `/cikkek/${article.slug}`
  const titleLinkClass = 'hover:text-brand transition-colors after:absolute after:inset-0 after:rounded-xl focus:outline-none focus-visible:after:ring-2 focus-visible:after:ring-brand focus-visible:after:ring-offset-2'

  const authorEl = article.authors.length > 0 ? (
    <span className="relative z-10">
      {article.authors.map((author, index) => (
        <span key={author.id}>
          {index > 0 && <span className="text-muted">, </span>}
          <Link
            href={`/szerzok/${author.slug}`}
            className="font-medium text-charcoal hover:text-brand transition-colors"
          >
            {author.name}
          </Link>
        </span>
      ))}
    </span>
  ) : <span className="font-medium text-charcoal">Szerkesztőség</span>

  // --- FEATURED (hero) ---
  if (featured) {
    return (
      <article
        className="card-lift relative bg-white rounded-2xl overflow-hidden border border-line
                   grid grid-cols-1 md:grid-cols-2"
      >
        {article.coverImage && (
          <div className="relative min-h-48 md:min-h-80 overflow-hidden">
            <Image
              src={article.coverImage}
              alt={article.coverAlt || article.title}
              fill
              sizes="(max-width: 767px) 100vw, 50vw"
              className="w-full h-full object-cover object-top"
            />
          </div>
        )}
        <div className="p-6 md:p-10 flex flex-col justify-center">
          <div className="flex flex-wrap gap-1.5 mb-4">
            {article.tags.slice(0, 3).map(tag => <span key={tag} className="tag-pill">{tag}</span>)}
          </div>
          <h2 className="font-display text-2xl md:text-3xl font-bold leading-tight text-charcoal mb-3">
            <Link href={href} className={titleLinkClass}>{article.title}</Link>
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
        className="card-lift relative bg-white rounded-xl overflow-hidden border border-line
                   col-span-1 md:col-span-2
                   grid grid-cols-1 sm:grid-cols-[2fr_3fr]"
      >
        {article.coverImage && (
          <div className="relative min-h-44 overflow-hidden">
            <Image
              src={article.coverImage}
              alt={article.coverAlt || article.title}
              fill
              sizes="(max-width: 639px) 100vw, 40vw"
              className="w-full h-full object-cover object-top"
            />
          </div>
        )}
        <div className="p-6 md:p-7 flex flex-col">
          <div className="flex flex-wrap gap-1.5 mb-3">
            {article.tags.slice(0, 3).map(tag => <span key={tag} className="tag-pill">{tag}</span>)}
          </div>
          <h3 className="font-display text-xl md:text-2xl font-bold leading-snug text-charcoal mb-2.5">
            <Link href={href} className={titleLinkClass}>{article.title}</Link>
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
      className="card-lift relative bg-white rounded-xl overflow-hidden border border-line
                 flex flex-col h-full"
    >
      {article.coverImage && (
        <div className="relative h-40 overflow-hidden shrink-0">
          <Image
            src={article.coverImage}
            alt={article.coverAlt || article.title}
            fill
            sizes="(max-width: 639px) 100vw, (max-width: 1023px) 50vw, 33vw"
            className="w-full h-full object-cover object-[center_20%]"
          />
        </div>
      )}
      <div className="p-4 md:p-5 flex flex-col flex-1">
        <div className="flex flex-wrap gap-1 mb-2">
          {article.tags.slice(0, 2).map(tag => <span key={tag} className="tag-pill">{tag}</span>)}
        </div>
        <h3 className="font-display text-base font-semibold leading-snug text-charcoal mb-1.5 flex-1">
          <Link href={href} className={titleLinkClass}>{article.title}</Link>
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
