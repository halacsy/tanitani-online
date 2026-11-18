'use client'

import { useEffect, useRef, useState, useSyncExternalStore, type FormEvent } from 'react'

const identityKey = 'tanitani-feedback-identity'

// The source page is captured when the form opens; no ongoing subscription is needed.
const subscribeToPage = () => () => {}

function getSourcePage() {
  return new URLSearchParams(window.location.search).get('oldal') || document.referrer || window.location.origin
}

function rememberIdentity(form: HTMLFormElement) {
  const data = new FormData(form)
  try {
    localStorage.setItem(identityKey, JSON.stringify({ name: data.get('name'), email: data.get('email') }))
  } catch {
    // Storage may be unavailable; submitting feedback must still work.
  }
}

export default function FeedbackForm({ pageUrl }: { pageUrl?: string }) {
  const sourcePage = useSyncExternalStore(subscribeToPage, () => pageUrl || getSourcePage(), () => pageUrl || '')
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle')
  const formRef = useRef<HTMLFormElement>(null)

  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(identityKey) || 'null')
      if (!saved || typeof saved !== 'object') return
      for (const field of ['name', 'email']) {
        const input = formRef.current?.elements.namedItem(field)
        if (input instanceof HTMLInputElement && typeof saved[field] === 'string') {
          input.value = saved[field]
        }
      }
    } catch {
      // Ignore unavailable storage and malformed saved data.
    }
  }, [])

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (status === 'sending' || status === 'sent') return
    const form = event.currentTarget
    const data = new FormData(form)
    if (!String(data.get('message') || '').trim()) return
    setStatus('sending')
    rememberIdentity(form)
    try {
      const response = await fetch('/__forms.html', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams(Array.from(data.entries(), ([key, value]) => [key, String(value)])).toString(),
      })
      if (!response.ok) throw new Error(String(response.status))
      setStatus('sent')
      const message = form.elements.namedItem('message')
      if (message instanceof HTMLTextAreaElement) message.value = ''
    } catch {
      setStatus('error')
    }
  }

  const inputClass = 'block w-full border border-line rounded-lg p-3 mt-2 bg-white'
  return <form ref={formRef} onSubmit={submit} onChange={event => rememberIdentity(event.currentTarget)} className="space-y-6">
    <input type="hidden" name="form-name" value="visszajelzes" />
    <input type="hidden" name="page" value={sourcePage} />
    {sourcePage && <div className="rounded-lg bg-sand p-3 text-sm">
      <span className="font-medium">Oldal</span>
      <p className="mt-1 break-all">{sourcePage}</p>
    </div>}
    <div hidden><label>Website<input name="bot-field" tabIndex={-1} autoComplete="off" /></label></div>
    <label className="block">Név (opcionális)<input className={inputClass} name="name" autoComplete="name" maxLength={200} /></label>
    <label className="block">E-mail<input className={inputClass} name="email" type="email" required autoComplete="email" maxLength={254} /></label>
    <label className="block">Üzenet<textarea className={inputClass} name="message" rows={5} required maxLength={10000} /></label>
    <button disabled={status === 'sending' || status === 'sent'} className="rounded-full bg-brand text-white px-6 py-3 disabled:opacity-50" type="submit">Küldés</button>
    <p role="status" aria-live="polite">{status === 'sent' ? 'Visszajelzés elküldve.' : status === 'error' ? 'Sikertelen küldés. Kérjük, próbálja újra.' : status === 'sending' ? 'Küldés…' : ''}</p>
  </form>
}
