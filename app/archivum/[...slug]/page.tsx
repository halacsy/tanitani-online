import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import type { Metadata } from 'next'
import { getAllArchivePages, getArchivePageBySlug, getCurrentPageHref } from '@/lib/pages'

import PeriodicalNav from '@/app/components/PeriodicalNav'
import { isPeriodicalPage } from '@/lib/periodical'

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
  const destination = getCurrentPageHref(slug)
  if (destination) redirect(destination)
  const periodical = isPeriodicalPage(slug)

  return (
    <div className={periodical ? 'max-w-7xl mx-auto px-6 py-10 md:py-14 grid lg:grid-cols-[16rem_minmax(0,1fr)] gap-10' : 'max-w-3xl mx-auto px-6 py-10 md:py-14'}>
      {periodical && <div className="order-2 lg:order-1"><PeriodicalNav currentSlug={slug} /></div>}
      <div className="min-w-0 order-1 lg:order-2">
      {periodical && <Link href="/folyoirat" className="inline-block mb-5 font-sans text-brand underline">← Régi lapszámok</Link>}
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
      {page.editors && (
        <section className="mt-10" aria-labelledby="editorial-team-title">
          <h2 id="editorial-team-title" className="font-display text-2xl font-semibold text-charcoal mb-5">A szerkesztőség</h2>
          <div className="grid sm:grid-cols-2 gap-4">
            {page.editors.map((person, index) => {
              const content = (
                <>
                  {person.photo && <Image src={person.photo} alt="" width={85} height={85} className="h-[85px] w-[85px] shrink-0 rounded-full object-cover" />}
                  <span className="min-w-0">
                    <span className="block font-semibold text-charcoal">{person.name}</span>
                    <span className="block text-sm text-muted">{person.role}</span>
                  </span>
                </>
              )
              const className = 'flex items-center gap-4 rounded-xl border border-line bg-white p-4 font-sans'
              return person.authorSlug
                ? <Link key={person.authorSlug} href={`/szerzok/${person.authorSlug}`} className={`${className} hover:border-brand`}>{content}</Link>
                : <div key={`${person.name}-${index}`} className={className}>{content}</div>
            })}
          </div>
        </section>
      )}
      {page.closingHtml && <article className="prose prose-lg max-w-none imported-html mt-8" dangerouslySetInnerHTML={{ __html: page.closingHtml }} />}
      <div className="mt-10 pt-6 border-t border-line">
        <Link href="/" className="font-sans text-sm text-brand hover:underline">← Kezdőlap</Link>
      </div>
      </div>
    </div>
  )
}
