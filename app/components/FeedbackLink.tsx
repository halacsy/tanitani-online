'use client'

import { usePathname } from 'next/navigation'

// An empty value disables the temporary testing link.
const feedbackUrl = process.env.NEXT_PUBLIC_FEEDBACK_URL ?? '/visszajelzes'

export default function FeedbackLink() {
  const pathname = usePathname()
  if (!feedbackUrl || pathname === '/visszajelzes') return null
  const local = feedbackUrl.startsWith('/')
  const href = local ? `${feedbackUrl}?oldal=${encodeURIComponent(pathname)}` : feedbackUrl
  return (
    <div className="max-w-7xl mx-auto px-6 mt-10 flex justify-end">
      <a href={href}
        onClick={event => {
          if (local) event.currentTarget.href = `${feedbackUrl}?oldal=${encodeURIComponent(window.location.href)}`
        }}
        className="inline-flex items-center gap-2 rounded-full bg-brand-light px-5 py-3 font-sans text-sm font-medium text-brand hover:bg-sand focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-brand">
        Visszajelzés
      </a>
    </div>
  )
}
