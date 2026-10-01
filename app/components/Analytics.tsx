'use client'
import { useEffect, useSyncExternalStore, Suspense } from 'react'
import { usePathname, useSearchParams } from 'next/navigation'
import Script from 'next/script'
import { GA_MEASUREMENT_ID, IS_PRODUCTION_DEPLOY } from '@/lib/site'

type Consent = 'granted' | 'denied'

const CONSENT_STORAGE_KEY = 'ga-consent'
const CONSENT_CHANGE_EVENT = 'ga-consent-change'

declare global {
  interface Window {
    dataLayer?: unknown[]
    gtag?: (...args: unknown[]) => void
  }
}

function gtag(...args: unknown[]) {
  window.dataLayer = window.dataLayer || []
  window.dataLayer.push(args)
}

function subscribeToConsent(callback: () => void) {
  window.addEventListener('storage', callback)
  window.addEventListener(CONSENT_CHANGE_EVENT, callback)
  return () => {
    window.removeEventListener('storage', callback)
    window.removeEventListener(CONSENT_CHANGE_EVENT, callback)
  }
}

function getConsentSnapshot(): Consent | null {
  const stored = window.localStorage.getItem(CONSENT_STORAGE_KEY)
  return stored === 'granted' || stored === 'denied' ? stored : null
}

function getServerConsentSnapshot(): Consent | null {
  return null
}

function storeConsent(value: Consent) {
  window.localStorage.setItem(CONSENT_STORAGE_KEY, value)
  window.dispatchEvent(new Event(CONSENT_CHANGE_EVENT))
  gtag('consent', 'update', { analytics_storage: value })
}

function PageviewTracker() {
  const pathname = usePathname()
  const searchParams = useSearchParams()

  useEffect(() => {
    if (!GA_MEASUREMENT_ID || typeof window.gtag !== 'function') return
    const query = searchParams.toString()
    gtag('event', 'page_view', {
      page_path: query ? `${pathname}?${query}` : pathname,
    })
  }, [pathname, searchParams])

  return null
}

/**
 * GA4 mérés hozzájárulás-kezeléssel (#5). A gtag Consent Mode alapértelmezetten
 * elutasítja a mérési cookie-kat; csak a látogató kifejezett hozzájárulása után
 * kapcsol mérésre. A döntést a böngésző tárolja el, hogy ne kérdezzen újra.
 */
export default function Analytics() {
  const consent = useSyncExternalStore(subscribeToConsent, getConsentSnapshot, getServerConsentSnapshot)
  const hasStoredDecision = useSyncExternalStore(
    subscribeToConsent,
    () => window.localStorage.getItem(CONSENT_STORAGE_KEY) !== null,
    () => false,
  )

  if (!GA_MEASUREMENT_ID || !IS_PRODUCTION_DEPLOY) return null

  return (
    <>
      <Script
        id="ga-gtag-src"
        src={`https://www.googletagmanager.com/gtag/js?id=${GA_MEASUREMENT_ID}`}
        strategy="afterInteractive"
      />
      <Script id="ga-gtag-init" strategy="afterInteractive">
        {`
          window.dataLayer = window.dataLayer || [];
          function gtag(){dataLayer.push(arguments);}
          gtag('consent', 'default', { analytics_storage: '${consent === 'granted' ? 'granted' : 'denied'}' });
          gtag('js', new Date());
          gtag('config', '${GA_MEASUREMENT_ID}', { send_page_view: false });
        `}
      </Script>
      {consent === 'granted' && (
        <Suspense fallback={null}>
          <PageviewTracker />
        </Suspense>
      )}
      {!hasStoredDecision && (
        <div className="fixed bottom-0 inset-x-0 z-[60] bg-charcoal text-white p-4 flex flex-col sm:flex-row items-center gap-3 justify-between text-sm">
          <p className="max-w-2xl">
            Névtelen látogatottsági statisztikát (Google Analytics) csak a
            hozzájárulásod után gyűjtünk. Az adatokat kizárólag a webhely
            fejlesztésére használjuk.
          </p>
          <div className="flex gap-2 shrink-0">
            <button
              onClick={() => storeConsent('denied')}
              className="px-3 py-1.5 rounded border border-white/40 hover:bg-white/10"
            >
              Elutasítom
            </button>
            <button
              onClick={() => storeConsent('granted')}
              className="px-3 py-1.5 rounded bg-brand hover:bg-brand/90"
            >
              Elfogadom
            </button>
          </div>
        </div>
      )}
    </>
  )
}
