import Link from 'next/link'
import Image from 'next/image'
import type { Author } from '@/lib/authors'

interface Props {
  author: Author
  articleCount?: number
  size?: 'small' | 'full'
}

export default function AuthorBioBlock({ author, articleCount, size = 'full' }: Props) {
  const photoSize = size === 'small' ? 'w-12 h-12 text-base' : 'w-20 h-20 text-2xl'
  const photoPixels = size === 'small' ? 48 : 80

  return (
    <div className={`flex gap-5 bg-cream border border-line rounded-xl ${size === 'small' ? 'p-4' : 'p-6'}`}>
      {/* Portrait */}
      <div className="shrink-0">
        {author.photo ? (
          <Image
            src={author.photo}
            alt={author.name}
            width={photoPixels}
            height={photoPixels}
            className={`${photoSize} rounded-full object-cover object-top border-2 border-line block`}
          />
        ) : (
          <div className={`${photoSize} rounded-full bg-brand-light flex items-center justify-center font-display font-bold text-brand shrink-0`}>
            {author.name.charAt(0)}
          </div>
        )}
      </div>

      {/* Text */}
      <div className="flex-1 min-w-0">
        <div className="mb-1.5">
          <Link
            href={`/szerzok/${author.slug}`}
            className={`font-sans font-semibold text-charcoal hover:text-brand transition-colors ${size === 'small' ? 'text-sm' : 'text-base'}`}
          >
            {author.name}
          </Link>
          {articleCount !== undefined && (
            <span className="font-sans text-xs text-muted ml-2">· {articleCount} cikk</span>
          )}
        </div>

        {author.bio && size === 'full' && (
          <p className="font-body text-sm leading-relaxed text-muted mb-3">
            {author.bio}
          </p>
        )}

        <Link
          href={`/szerzok/${author.slug}`}
          className="font-sans text-sm text-brand font-medium hover:underline"
        >
          Összes cikke →
        </Link>
      </div>
    </div>
  )
}
