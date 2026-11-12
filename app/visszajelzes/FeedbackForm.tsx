'use client'

import { useState, type FormEvent } from 'react'

export default function FeedbackForm() {
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle')

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (status === 'sending') return
    const form = event.currentTarget
    const data = new FormData(form)
    data.set('page', new URLSearchParams(window.location.search).get('oldal') || document.referrer || window.location.origin)
    if (!String(data.get('message') || '').trim()) return
    setStatus('sending')
    try {
      const response = await fetch('/__forms.html', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams(Array.from(data.entries(), ([key, value]) => [key, String(value)])).toString(),
      })
      if (!response.ok) throw new Error(String(response.status))
      setStatus('sent')
      form.reset()
    } catch {
      setStatus('error')
    }
  }

  const inputClass = 'block w-full border border-line rounded-lg p-3 mt-2 bg-white'
  return <form onSubmit={submit} className="space-y-6">
    <input type="hidden" name="form-name" value="visszajelzes" />
    <input type="hidden" name="page" value="" />
    <div hidden><label>Website<input name="bot-field" tabIndex={-1} autoComplete="off" /></label></div>
    <label className="block">Név (opcionális)<input className={inputClass} name="name" autoComplete="name" maxLength={200} /></label>
    <label className="block">E-mail<input className={inputClass} name="email" type="email" required autoComplete="email" maxLength={254} /></label>
    <label className="block">Üzenet<textarea className={inputClass} name="message" rows={7} required maxLength={10000} /></label>
    <button disabled={status === 'sending' || status === 'sent'} className="rounded-full bg-brand text-white px-6 py-3 disabled:opacity-50" type="submit">Küldés</button>
    <p role="status" aria-live="polite">{status === 'sent' ? 'Visszajelzés elküldve.' : status === 'error' ? 'Sikertelen küldés. Kérjük, próbálja újra.' : status === 'sending' ? 'Küldés…' : ''}</p>
  </form>
}
