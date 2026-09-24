import Link from 'next/link'
import Image from 'next/image'
import { getAllAuthors } from '@/lib/authors'

export const metadata = { title: 'Főmunkatársaink' }

// Membership and order from the original /fomunkatarsaink page.
const slugs = ['foti-peter', 'gyarmathy-eva', 'l-ritok-nora', 'nahalka-istvan', 'rado-peter', 'trencsenyi-laszlo']

export default function ContributorsPage() {
  const authors = getAllAuthors()
  return (
    <div className="max-w-5xl mx-auto px-6 py-12">
      <h1 className="font-display text-3xl md:text-5xl font-bold mb-8">Főmunkatársaink</h1>
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
        {slugs.map(slug => {
          const author = authors.find(author => author.slug === slug)
          if (!author) throw new Error(`Missing contributor: ${slug}`)
          return (
            <Link key={slug} href={`/szerzok/${slug}`} className="card-lift rounded-xl border border-line bg-white p-6">
              {author.photo && <Image src={author.photo} alt="" width={96} height={96} className="w-24 h-24 rounded-full object-cover object-top mb-4" />}
              <h2 className="font-display text-xl font-semibold text-brand">{author.name}</h2>
              <p className="font-sans text-sm text-muted mt-2">Bemutatkozás és cikkek →</p>
            </Link>
          )
        })}
      </div>
    </div>
  )
}
