import sanitizeHtml from 'sanitize-html'
import { sanitizeEditorialHtml } from './content'

// The editor can contain Markdown with legacy inline HTML. Keep the tags
// needed by the migrated book layouts, but filter executable HTML and CSS.
export function sanitizePageHtml(value: string): string {
  return sanitizeHtml(sanitizeEditorialHtml(value), {
    allowedTags: [
      ...sanitizeHtml.defaults.allowedTags,
      'img', 'div', 'span', 'hr', 'h1', 'h2', 'table', 'tbody', 'thead',
      'tr', 'td', 'th',
    ],
    allowedAttributes: {
      '*': ['id', 'class', 'style'],
      a: ['href', 'name', 'title'],
      img: ['src', 'alt', 'title', 'width', 'height'],
      td: ['colspan', 'rowspan'],
      th: ['colspan', 'rowspan'],
    },
    allowedSchemes: ['http', 'https', 'mailto'],
    allowProtocolRelative: false,
    allowedStyles: {
      '*': {
        width: [/^\d+(?:\.\d+)?(?:px|%|em|rem)$/],
        height: [/^\d+(?:\.\d+)?(?:px|%|em|rem)$/],
        'text-align': [/^(?:left|right|center|justify)$/],
      },
    },
    nonTextTags: ['script', 'style', 'textarea', 'option', 'xmp'],
  })
}
