import type { ArticleComment } from '@/lib/content'

function formatCommentDate(timestamp: number): string {
  return new Date(timestamp * 1000).toLocaleDateString('hu-HU', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
}

function commentDepth(comment: ArticleComment, byId: Map<number, ArticleComment>): number {
  let depth = 0
  let parentId = comment.parentId
  const seen = new Set<number>()
  while (parentId && byId.has(parentId) && !seen.has(parentId) && depth < 4) {
    seen.add(parentId)
    depth += 1
    parentId = byId.get(parentId)?.parentId ?? null
  }
  return depth
}

export default function ArticleComments({ comments }: { comments: ArticleComment[] }) {
  if (comments.length === 0) return null
  const byId = new Map(comments.map(comment => [comment.id, comment]))

  return (
    <section className="mt-14 pt-8 border-t border-line" aria-labelledby="comments-title">
      <div className="flex items-end justify-between gap-4 mb-6">
        <div>
          <p className="font-sans text-xs font-semibold tracking-widest uppercase text-muted mb-1">
            Archív beszélgetés
          </p>
          <h2 id="comments-title" className="font-display text-2xl font-bold text-charcoal">
            {comments.length} hozzászólás
          </h2>
        </div>
        <p className="font-sans text-xs text-muted text-right max-w-56">
          Az eredeti oldalról megőrzött, csak olvasható hozzászólások.
        </p>
      </div>

      <div className="flex flex-col gap-3">
        {comments.map(comment => {
          const depth = commentDepth(comment, byId)
          return (
            <article
              key={comment.id}
              className="bg-white border border-line rounded-xl p-4 md:p-5"
              style={{ marginLeft: `${depth * 1.25}rem` }}
            >
              <header className="flex flex-wrap items-baseline gap-x-2 gap-y-1 mb-3 font-sans">
                <strong className="text-sm text-charcoal">{comment.authorName}</strong>
                <span className="text-xs text-muted">{formatCommentDate(comment.publishedAt)}</span>
                {comment.subject && (
                  <span className="w-full text-sm font-medium text-charcoal">{comment.subject}</span>
                )}
              </header>
              <div
                className="comment-body font-body text-sm leading-relaxed text-charcoal"
                dangerouslySetInnerHTML={{ __html: comment.bodyHtml }}
              />
            </article>
          )
        })}
      </div>
    </section>
  )
}
