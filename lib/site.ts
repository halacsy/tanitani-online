export const SITE_NAME = 'Taní-tani Online'

/**
 * A kiadási környezet: a Netlify `CONTEXT` értéke. A szerkesztői folyamat (#13)
 * piszkozatai `deploy-preview` környezetben épülnek, a publikálás után pedig
 * `production` környezetben. Helyi fejlesztésnél nincs beállítva.
 */
const DEPLOY_CONTEXT = process.env.CONTEXT ?? ''

export const IS_PRODUCTION_DEPLOY = DEPLOY_CONTEXT === '' || DEPLOY_CONTEXT === 'production'

/**
 * Az előnézeti (pull request) buildek saját Netlify-címükön futnak; a kanonikus
 * URL-eknek és a sitemapnek ilyenkor is a saját címükre kell mutatniuk, hogy a
 * szerkesztő a piszkozatban ellenőrizhesse a hivatkozásokat.
 */
const PREVIEW_URL = IS_PRODUCTION_DEPLOY ? '' : process.env.DEPLOY_PRIME_URL || process.env.DEPLOY_URL || ''

export const SITE_URL = (
  process.env.NEXT_PUBLIC_SITE_URL || PREVIEW_URL || 'https://www.tani-tani.info'
).replace(/\/$/, '')

export const SITE_DESCRIPTION = 'A szabad pedagógiai gondolkodás fóruma. Hosszú formátumú cikkek, esszék és elemzések pedagógusoknak.'
