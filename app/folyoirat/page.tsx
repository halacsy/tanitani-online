import Link from 'next/link'
import { getPeriodicalIssues, specialIssueHref } from '@/lib/periodical'

export const metadata = { title: 'Régi lapszámok', description: 'A nyomtatott Taní-tani folyóirat lapszámai és tartalomjegyzékei, 2007–2010.' }

export default function PeriodicalPage() {
  const issues = getPeriodicalIssues()
  const years = [...new Set(issues.map(issue => issue.title.slice(0, 4)))]
  return (
    <div className="max-w-5xl mx-auto px-6 py-12">
      <h1 className="font-display text-3xl md:text-5xl font-bold mb-5">Régi lapszámok</h1>
      <p className="font-body text-lg mb-6">A nyomtatott Taní-tani folyóirat 2007–2010 közötti lapszámai. Válassz egy számot a tartalomjegyzék és az elérhető cikkek megnyitásához.</p>
      <div className="flex flex-wrap gap-5 mb-10 font-sans text-brand underline">
        <Link href="/folyoirat/rovatok">Böngészés rovatok szerint</Link>
        <Link href="/rolunk#tortenet">A folyóirat története</Link>
      </div>
      <div className="grid sm:grid-cols-2 gap-6">
        {years.map(year => (
          <section key={year} className="rounded-xl border border-line bg-white p-6">
            <h2 className="font-display text-2xl font-bold mb-3">{year}</h2>
            <ul className="font-sans">
              {issues.filter(issue => issue.title.startsWith(year)).map(issue => (
                <li key={issue.slug}><Link href={`/archivum/${issue.slug}`} className="block py-3 text-brand hover:underline">{issue.title} →</Link></li>
              ))}
              {year === '2009' && <li><a href={specialIssueHref} className="block py-3 text-brand hover:underline">Különszám, 2009 (Google Drive) →</a></li>}
            </ul>
          </section>
        ))}
      </div>
    </div>
  )
}
