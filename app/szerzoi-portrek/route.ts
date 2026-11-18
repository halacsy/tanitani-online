import fs from 'node:fs'
import path from 'node:path'

// Generated before development and production builds; served as static HTML.
export const dynamic = 'force-static'

export function GET() {
  const html = fs.readFileSync(path.join(process.cwd(), 'reports/author-photos.html'), 'utf8')
  return new Response(html, {
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'X-Robots-Tag': 'noindex, nofollow',
    },
  })
}
