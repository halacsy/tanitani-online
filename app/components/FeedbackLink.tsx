'use client'

import { usePathname } from 'next/navigation'

// Set NEXT_PUBLIC_FEEDBACK_URL to an empty string to remove the testing link.
const feedbackUrl = process.env.NEXT_PUBLIC_FEEDBACK_URL
  ?? 'https://github.com/halacsy/tanitani-online/issues/new'

export default function FeedbackLink() {
  const pathname = usePathname()
  if (!feedbackUrl) return null

  const href = new URL(feedbackUrl)
  href.searchParams.set('body', pathname)

  return (
    <div className="max-w-7xl mx-auto px-6 mt-10 flex justify-end">
      <a
        href={href.toString()}
        target="_blank"
        rel="noopener noreferrer"
        onClick={event => {
          const current = new URL(feedbackUrl)
          current.searchParams.set('body', window.location.href)
          event.currentTarget.href = current.toString()
        }}
        className="inline-flex items-center gap-2 rounded-full bg-brand-light px-5 py-3 font-sans text-sm font-medium text-brand hover:bg-sand focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-brand"
      >
        Visszajelzés
        <span aria-hidden="true">↗</span>
      </a>
    </div>
  )
}
