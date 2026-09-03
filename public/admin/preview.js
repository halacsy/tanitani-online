(function () {
  'use strict'

  function field(entry, name, fallback) {
    var value = entry.getIn(['data', name])
    return value === undefined || value === null || value === '' ? fallback : value
  }

  function list(value) {
    if (!value) return []
    if (typeof value.toArray === 'function') return value.toArray()
    return Array.isArray(value) ? value : [value]
  }

  function relationValue(props, collection, value, key) {
    if (!props.fieldsMetaData || !value) return ''
    var related = props.fieldsMetaData.getIn([collection, value])
    if (!related) return ''
    return typeof related.get === 'function' ? related.get(key, '') : related[key] || ''
  }

  function assetUrl(getAsset, value) {
    if (!value) return ''
    try {
      var asset = getAsset(value)
      return asset ? asset.toString() : ''
    } catch {
      return String(value)
    }
  }

  function authorLabel(slug) {
    if (!slug) return 'Szerző'
    return String(slug)
      .split('-')
      .filter(Boolean)
      .map(function (part) {
        return part.charAt(0).toLocaleUpperCase('hu-HU') + part.slice(1)
      })
      .join(' ')
  }

  function formatDate(value) {
    if (!value) return ''
    var raw = value instanceof Date ? value : new Date(String(value).slice(0, 10) + 'T12:00:00')
    if (Number.isNaN(raw.getTime())) return String(value)
    return raw.toLocaleDateString('hu-HU', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    })
  }

  function readingTime(value) {
    var plain = String(value || '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')
      .replace(/\[[^\]]*\]\([^)]*\)/g, ' ')
      .replace(/[#>*_`~\-]+/g, ' ')
      .trim()
    return Math.max(1, Math.ceil((plain ? plain.split(/\s+/).length : 0) / 200))
  }

  function nav() {
    var items = ['Cikkek', 'Témakörök', 'Szerzőkről', 'Keresés', 'Rólunk']
    return h(
      'header',
      { className: 'site-nav' },
      h(
        'div',
        { className: 'site-nav-inner' },
        h(
          'div',
          { className: 'site-logo' },
          h('span', { className: 'site-logo-name' }, 'Taní-tani'),
          h('span', { className: 'site-logo-online' }, 'Online'),
        ),
        h(
          'nav',
          { className: 'site-nav-links', 'aria-label': 'Fő navigáció' },
          items.map(function (item, index) {
            return h(
              'span',
              { key: item, className: 'site-nav-link' + (index === 0 ? ' is-active' : '') },
              item,
            )
          }),
        ),
        h(
          'span',
          { className: 'site-menu-icon', 'aria-hidden': 'true' },
          h('i', {}),
          h('i', {}),
          h('i', {}),
        ),
      ),
    )
  }

  function footer() {
    var tags = [
      'alternatív iskolák',
      'drámapedagógia',
      'hátrányos helyzet',
      'IKT',
      'iskolakritika',
      'kompetencia',
      'oktatáspolitika',
      'pedagógusok',
      'nevelés',
      'romák',
      'SNI',
      'szabad nevelés',
    ]
    return h(
      'footer',
      { className: 'site-footer' },
      h(
        'div',
        { className: 'site-footer-inner' },
        h(
          'div',
          { className: 'site-footer-grid' },
          h(
            'div',
            {},
            h('div', { className: 'site-footer-brand' }, 'Taní-tani Online'),
            h('p', {}, 'A szabad pedagógiai gondolkodás fóruma. Alapítva 1996-ban.'),
          ),
          h(
            'div',
            {},
            h('h4', {}, 'Tartalom'),
            h(
              'div',
              { className: 'site-footer-links' },
              ['Összes cikk', 'Témakörök', 'Szerzők', 'Rólunk'].map(function (item) {
                return h('span', { key: item }, item)
              }),
            ),
          ),
          h(
            'div',
            {},
            h('h4', {}, 'Témakörök'),
            h(
              'div',
              { className: 'site-footer-tags' },
              tags.map(function (tag) {
                return h('span', { key: tag }, tag)
              }),
            ),
          ),
        ),
        h(
          'div',
          { className: 'site-footer-bottom' },
          h('p', {}, '© Taní-tani Online · Creative Commons licenc alatt'),
          h('p', {}, 'Partnereink: Történelemtanárok Egylete · Magyar Pedagógiai Társaság'),
        ),
      ),
    )
  }

  var ArticlePreview = createClass({
    render: function () {
      var props = this.props
      var entry = props.entry
      var title = field(entry, 'title', 'A cikk címe')
      var excerpt = field(entry, 'excerpt', '')
      var authorSlugs = list(field(entry, 'authorSlugs', []))
        .concat(field(entry, 'authorSlug', '') || [])
        .filter(Boolean)
        .filter(function (slug, index, slugs) {
          return slugs.indexOf(slug) === index
        })
      var legacyAuthor = field(entry, 'author', '')
      var authors = authorSlugs.map(function (slug) {
        var name = relationValue(props, 'szerzok', slug, 'name')
        if (!name && authorSlugs.length === 1) name = legacyAuthor
        return {
          slug: slug,
          name: name || authorLabel(slug),
          photo: assetUrl(props.getAsset, relationValue(props, 'szerzok', slug, 'photo')),
          bio: relationValue(props, 'szerzok', slug, 'bio'),
        }
      })
      var authorName = authors.length
        ? authors.map(function (author) { return author.name }).join(', ')
        : legacyAuthor || 'Szerző'
      var primaryAuthor = authors[0]
      var imageValue = field(entry, 'coverImage', '') || field(entry, 'image', '')
      var coverImage = assetUrl(props.getAsset, imageValue)
      var coverAlt = field(entry, 'coverAlt', '') || title
      var tags = list(field(entry, 'tags', [])).filter(Boolean)
      var minutes = readingTime(field(entry, 'body', ''))
      var reads = Number(field(entry, 'reads', 0))
      var readsLabel = Number.isFinite(reads) ? reads.toLocaleString('hu-HU') : '0'

      return h(
        'div',
        { className: 'site-preview' },
        nav(),
        h(
          'main',
          {},
          coverImage
            ? h(
                'div',
                { className: 'article-cover' },
                h('img', { src: coverImage, alt: coverAlt }),
                h('div', { className: 'article-cover-shade' }),
              )
            : null,
          h(
            'header',
            { className: 'article-header' },
            h(
              'div',
              { className: 'article-header-inner' },
              h(
                'div',
                { className: 'breadcrumbs' },
                h('span', {}, 'Kezdőlap'),
                h('b', {}, '›'),
                h('span', {}, 'Cikkek'),
              ),
              tags.length
                ? h(
                    'div',
                    { className: 'article-tags' },
                    tags.map(function (tag) {
                      return h('span', { key: String(tag), className: 'tag-pill' }, String(tag))
                    }),
                  )
                : null,
              h('h1', {}, title),
              excerpt ? h('p', { className: 'article-excerpt' }, excerpt) : null,
              h(
                'div',
                { className: 'article-byline' },
                primaryAuthor && primaryAuthor.photo
                  ? h('img', { className: 'author-avatar', src: primaryAuthor.photo, alt: primaryAuthor.name })
                  : h('div', { className: 'author-avatar author-initial' }, String(authorName).charAt(0)),
                h(
                  'div',
                  {},
                  h('div', { className: 'author-name' }, authorName),
                  h(
                    'div',
                    { className: 'article-meta' },
                    h('span', {}, formatDate(field(entry, 'date', ''))),
                    h('b', {}, '·'),
                    h('span', {}, '◷ ' + minutes + ' perc'),
                    h('b', {}, '·'),
                    h('span', {}, readsLabel + ' olvasás'),
                  ),
                ),
              ),
            ),
          ),
          h(
            'div',
            { className: 'article-layout' },
            h(
              'aside',
              { className: 'reading-time' },
              '◷ ' + minutes + ' perc',
            ),
            h(
              'div',
              { className: 'article-column' },
              h('article', { className: 'article-prose imported-html' }, props.widgetFor('body')),
              authors.length
                ? h(
                    'section',
                    { className: 'author-section' },
                    h('h2', {}, authors.length > 1 ? 'A szerzőkről' : 'A szerzőről'),
                    h(
                      'div',
                      { className: 'author-cards' },
                      authors.map(function (author) {
                        return h(
                          'div',
                          { className: 'author-card', key: author.slug },
                          author.photo
                            ? h('img', { className: 'author-card-photo', src: author.photo, alt: author.name })
                            : h('div', { className: 'author-card-photo author-initial' }, String(author.name).charAt(0)),
                          h(
                            'div',
                            { className: 'author-card-content' },
                            h('div', { className: 'author-card-name' }, author.name),
                            author.bio ? h('p', {}, author.bio) : null,
                            h('span', { className: 'author-card-link' }, 'Összes cikke →'),
                          ),
                        )
                      }),
                    ),
                  )
                : null,
              h('div', { className: 'back-link' }, '← Vissza a cikkekhez'),
            ),
            h('div', { className: 'right-gutter' }),
          ),
        ),
        footer(),
      )
    },
  })

  CMS.registerPreviewStyle('/admin/preview.css')
  CMS.registerPreviewTemplate('cikkek', ArticlePreview)
})()
