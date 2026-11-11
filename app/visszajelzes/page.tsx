import FeedbackForm from './FeedbackForm'

export const metadata = { title: 'Visszajelzés', robots: { index: false, follow: true } }

export default function FeedbackPage() {
  return <section className="max-w-2xl mx-auto px-6 py-12">
    <h1 className="font-display text-3xl mb-8">Visszajelzés</h1>
    <FeedbackForm />
  </section>
}
