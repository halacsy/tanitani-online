import { notFound } from 'next/navigation'
import Link from 'next/link'
import type { Metadata } from 'next'
import { getAllArchivePages, getArchivePageBySlug } from '@/lib/pages'

interface Props {
  params: Promise<{ slug: string[] }>
}

export function generateStaticParams() {
  return getAllArchivePages().map(page => ({ slug: page.slug.split('/') }))
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const slug = (await params).slug.join('/')
  const page = getArchivePageBySlug(slug)
  return page ? { title: page.title } : {}
}

export default async function ArchivedPage({ params }: Props) {
  const slug = (await params).slug.join('/')
  const page = getArchivePageBySlug(slug)
  if (!page) notFound()

  return (
    <div className="max-w-3xl mx-auto px-6 py-10 md:py-14">
      <div className="mb-7 rounded-xl border border-line bg-brand-light px-4 py-3 font-sans text-sm text-charcoal">
        Ez az eredeti Taní-tani oldalról megőrzött archív tartalom.
      </div>
      <h1 className="font-display text-3xl md:text-5xl font-bold text-charcoal leading-tight mb-8">
        {page.title}
      </h1>
      <article
        className="prose prose-lg max-w-none imported-html"
        dangerouslySetInnerHTML={{ __html: page.bodyHtml }}
      />
      <div className="mt-10 pt-6 border-t border-line">
        <Link href="/" className="font-sans text-sm text-brand hover:underline">← Kezdőlap</Link>
      </div>
    </div>
  )
}
