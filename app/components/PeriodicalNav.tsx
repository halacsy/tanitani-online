import Link from 'next/link'
import { getPeriodicalIssues, specialIssueHref } from '@/lib/periodical'

export default function PeriodicalNav({ currentSlug }: { currentSlug?: string }) {
  const issues = getPeriodicalIssues()
  const years = [...new Set(issues.map(issue => issue.title.slice(0, 4)))]
  return (
    <nav aria-label="Nyomtatott folyóirat" className="rounded-xl border border-line bg-sand p-5 font-sans text-sm">
      <Link href="/folyoirat" className="font-semibold text-brand">Régi lapszámok</Link>
      <Link href="/folyoirat/rovatok" aria-current={currentSlug === 'rovatok' ? 'page' : undefined} className="block py-3 text-brand underline">Rovatok</Link>
      {years.map(year => (
        <div key={year} className="mt-3">
          <h2 className="font-semibold text-charcoal mb-1">{year}</h2>
          <ul>
            {issues.filter(issue => issue.title.startsWith(year)).map(issue => (
              <li key={issue.slug}>
                <Link href={`/archivum/${issue.slug}`} aria-current={currentSlug === issue.slug || (currentSlug === '103_tartalom' && issue.slug === '54_szam') ? 'page' : undefined}
                  className="block py-2 text-brand hover:underline aria-[current=page]:font-bold">
                  {issue.title}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      ))}
      <a href={specialIssueHref} className="block pt-4 text-brand underline">Különszám, 2009 (Google Drive)</a>
      <Link href="/rolunk#tortenet" className="block pt-4 text-brand underline">A folyóirat története</Link>
    </nav>
  )
}
