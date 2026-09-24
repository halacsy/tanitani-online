import type { MetadataRoute } from 'next'
import { IS_PRODUCTION_DEPLOY, SITE_URL } from '@/lib/site'

export default function robots(): MetadataRoute.Robots {
  // A szerkesztői folyamat előnézeti buildjei (#13) nem kerülhetnek a keresőkbe:
  // a még nem publikált piszkozat csak a szerkesztőnek szól.
  if (!IS_PRODUCTION_DEPLOY) {
    return { rules: { userAgent: '*', disallow: '/' } }
  }

  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: ['/admin/'],
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
  }
}
