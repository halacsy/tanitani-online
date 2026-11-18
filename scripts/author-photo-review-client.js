/* Standalone browser script, embedded into the portable review HTML. */
(() => {
  const { rows, decisions: baseline, media, dataset } = window.reviewData
  const decisions = Object.assign(Object.create(null), baseline)
  const labels = {
    automatic: 'Automatikusan hozzárendelve', multiple: 'Több kép közül választandó',
    missing: 'Nem találtunk elérhető képet', reviewed: 'Korábban kiválasztva', rejected: 'Korábban elvetve',
  }
  const $ = id => document.getElementById(id)
  const cards = []
  const storageKey = `tanitani-author-photos-${dataset}`
  const normalize = value => value.normalize('NFKC').toLocaleLowerCase('hu')
  const notice = message => { $('notice').textContent = message }
  function element(tag, text, parent, className) {
    const node = document.createElement(tag)
    if (text) node.textContent = text
    if (className) node.className = className
    if (parent) parent.append(node)
    return node
  }
  function link(text, route, parent) {
    const anchor = element('a', text, parent)
    anchor.href = `https://www.tani-tani.info${route}`
    anchor.target = '_blank'
    anchor.rel = 'noopener noreferrer'
  }
  function validate(value) {
    if (value?.version !== 1 || !value.decisions || typeof value.decisions !== 'object' || Array.isArray(value.decisions)) throw new Error('Érvénytelen döntésfájl.')
    for (const [slug, src] of Object.entries(value.decisions)) {
      const row = rows.find(row => row.slug === slug)
      if (!row || (src !== null && !row.candidates.some(candidate => candidate.src === src && candidate.available))) {
        throw new Error(`Ismeretlen szerző vagy nem választható kép: ${slug}`)
      }
    }
    return value.decisions
  }
  function documentData() {
    return { version: 1, dataset, decisions }
  }
  function save() {
    try {
      localStorage.setItem(storageKey, JSON.stringify(documentData()))
      notice('A választást ebben a böngészőben megőriztük. Átadáshoz töltsd le a döntéseket.')
    } catch {
      notice('A böngésző nem tudja megőrizni a választást. Mentéshez töltsd le a döntéseket!')
    }
  }
  function syncRadios() {
    for (const { row, card } of cards) {
      const selected = Object.hasOwn(decisions, row.slug) ? decisions[row.slug] : row.photo
      for (const radio of card.querySelectorAll('input[type=radio]')) radio.checked = radio.value === (selected ?? '')
    }
  }
  try {
    const stored = localStorage.getItem(storageKey)
    if (stored) {
      Object.assign(decisions, validate(JSON.parse(stored)))
      notice('A korábbi választásokat visszatöltöttük ebből a böngészőből.')
    }
  } catch { notice('A helyi mentés nem tölthető be. Korábbi JSON-fájlból továbbra is folytathatod.') }

  const counts = Object.fromEntries(Object.keys(labels).map(key => [key, rows.filter(row => row.status === key).length]))
  $('summary').textContent = `${rows.length} szerző. ${Object.entries(labels).map(([key, label]) => `${label}: ${counts[key]}`).join(' · ')}`
  for (const row of rows) {
    const card = element('section', '', $('authors'), 'card')
    const heading = element('h2', '', card)
    link(row.name, `/szerzok/${encodeURIComponent(row.slug)}`, heading)
    element('span', labels[row.status], card, 'badge')
    const choices = element('div', '', card, 'candidates')
    function radioChoice(src, text, parent, available = true) {
      const label = element('label', '', parent, 'choice')
      const radio = element('input', '', label)
      radio.type = 'radio'
      radio.name = row.slug
      radio.value = src ?? ''
      radio.disabled = !available
      label.append(document.createTextNode(` ${text}`))
      radio.addEventListener('change', () => { decisions[row.slug] = src; save() })
      return label
    }
    for (const candidate of row.candidates) {
      const box = element('div', '', choices, 'candidate')
      const label = radioChoice(candidate.src, candidate.available ? 'Ezt a képet választom / jóváhagyom' : 'A képfájl hiányzik', box, candidate.available)
      if (candidate.available) {
        const img = element('img', '', label)
        img.src = media[candidate.src]
        img.alt = row.name
        img.loading = 'lazy'
      }
      element('p', candidate.src, box, 'path')
      if (candidate.editorial) element('p', 'Meglévő szerkesztői képbeállítás.', box)
      for (const source of candidate.sources) {
        const paragraph = element('p', '', box)
        link(source.title, `/cikkek/${encodeURIComponent(source.slug)}`, paragraph)
        if (source.credit) element('p', source.credit, box, 'path')
      }
    }
    radioChoice(null, 'Maradjon monogram', card)
    cards.push({ row, card })
  }
  syncRadios()
  function filter() {
    const query = normalize($('search').value.trim())
    const status = $('filter').value
    let count = 0
    for (const { row, card } of cards) {
      card.hidden = !normalize(row.name).includes(query) || (status !== 'all' && row.status !== status)
      if (!card.hidden) count++
    }
    $('visible-count').textContent = `${count} szerző látható`
  }
  $('search').addEventListener('input', filter)
  $('filter').addEventListener('change', filter)
  filter()
  $('download').addEventListener('click', () => {
    const blob = new Blob([JSON.stringify(documentData(), null, 2) + '\n'], { type: 'application/json' })
    const href = URL.createObjectURL(blob)
    const anchor = element('a', '', document.body)
    anchor.href = href
    anchor.download = 'szerzoi-portrek-dontesek.json'
    anchor.click()
    anchor.remove()
    setTimeout(() => URL.revokeObjectURL(href), 1000)
    notice('A döntésfájl letöltése elindult. Add vissza a projekt gondozójának.')
  })
  $('load').addEventListener('click', () => $('import').click())
  $('import').addEventListener('change', async event => {
    const input = event.currentTarget
    try {
      const file = input.files[0]
      if (!file) return
      const imported = validate(JSON.parse(await file.text()))
      Object.assign(decisions, imported)
      syncRadios()
      save()
    } catch (error) { notice(error.message) }
    finally { input.value = '' }
  })
})()
