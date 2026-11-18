'use client'

import { useEffect, useRef, useState } from 'react'
import FeedbackForm from '../visszajelzes/FeedbackForm'

// Build-time switch: independent of the old NEXT_PUBLIC_FEEDBACK_URL setting.
const testMode = process.env.NEXT_PUBLIC_TEST_MODE === 'true'

export default function FeedbackLink() {
  const trigger = useRef<HTMLButtonElement>(null)
  const dialog = useRef<HTMLDialogElement>(null)
  const [open, setOpen] = useState(false)
  const [pageUrl, setPageUrl] = useState('')

  useEffect(() => {
    if (!testMode) return
    // Keep the feedback button above the consent banner, including on mobile.
    function updatePosition() {
      const banner = document.getElementById('analytics-consent-banner')
      trigger.current?.style.setProperty('--consent-height', `${banner?.getBoundingClientRect().height ?? 0}px`)
    }
    const resize = new ResizeObserver(updatePosition)
    function watchBanner() {
      const banner = document.getElementById('analytics-consent-banner')
      resize.disconnect()
      if (banner) resize.observe(banner)
      updatePosition()
    }
    const mutations = new MutationObserver(watchBanner)
    mutations.observe(document.body, { childList: true })
    watchBanner()
    return () => {
      resize.disconnect()
      mutations.disconnect()
    }
  }, [])

  useEffect(() => {
    if (!open) return
    const modal = dialog.current
    modal?.showModal()
    const overflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      modal?.close()
      document.body.style.overflow = overflow
    }
  }, [open])

  if (!testMode) return null

  return (
    <>
      <button
        ref={trigger}
        type="button"
        aria-haspopup="dialog"
        onClick={() => {
          setPageUrl(window.location.href)
          setOpen(true)
        }}
        className="fixed right-4 bottom-[calc(var(--consent-height,0px)+max(1rem,env(safe-area-inset-bottom)))] z-[70] rounded-full bg-brand px-5 py-3 font-sans text-sm font-medium text-white shadow-lg hover:bg-charcoal focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-brand"
      >
        Visszajelzés
      </button>
      <dialog
        ref={dialog}
        aria-labelledby="feedback-title"
        onClose={() => setOpen(false)}
        onClick={event => {
          if (event.target === event.currentTarget) dialog.current?.close()
        }}
        className="m-auto max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] max-w-xl overflow-y-auto rounded-2xl bg-white p-0 text-charcoal shadow-xl backdrop:bg-black/40"
      >
        {open && (
          <div className="p-5 sm:p-8">
            <div className="mb-5 flex items-center justify-between gap-4">
              <h2 id="feedback-title" className="font-display text-2xl">Visszajelzés</h2>
              <button type="button" onClick={() => dialog.current?.close()} className="rounded-lg border border-line px-3 py-2 text-sm hover:bg-sand">Bezárás</button>
            </div>
            <FeedbackForm pageUrl={pageUrl} />
          </div>
        )}
      </dialog>
    </>
  )
}
