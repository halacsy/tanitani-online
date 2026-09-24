import { getArchivePageBySlug } from './pages'

// The original /mi_ez sidebar, checked on 2026-09-24. Prefer 54_szam
// over the duplicate 103_tartalom: it includes links to the articles.
const issueSlugs = [
  '074_tartalom', '081_tartalom', '082_tartalom', 'node-19', '084tartalom',
  'node-69', '092tartalom', '093tartalom', '094_tartalom',
  '101_tartalom', '102_tartalom', '54_szam',
]

export function getPeriodicalIssues() {
  return issueSlugs.map(slug => {
    const page = getArchivePageBySlug(slug)
    if (!page) throw new Error(`Missing periodical issue: ${slug}`)
    return page
  })
}

export function isPeriodicalPage(slug: string) {
  return issueSlugs.includes(slug) || slug === '103_tartalom'
}

export const specialIssueHref = 'https://drive.google.com/file/d/1-S6DqtoHshKZDiVr7BNLleVg1YZbqj5G/view?usp=sharing'
