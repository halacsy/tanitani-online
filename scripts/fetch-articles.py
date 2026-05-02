#!/usr/bin/env python3
"""Fetch full article text and inline images from tani-tani.info"""

import urllib.request
import re
import os
import sys
from html.parser import HTMLParser

ARTICLES = [
    ("kommunikacio-az-ovodaban",   "https://www.tani-tani.info/kommunikacio_az_ovodaban"),
    ("a-kivulmaradok",              "https://www.tani-tani.info/a_kivulmaradok"),
    ("ezt-a-kis-idot-meg-kibirjuk", "https://www.tani-tani.info/ezt_a_kis_idot_meg_kibirjuk_valahogy"),
    ("az-mi-az-iskolaban-2",        "https://www.tani-tani.info/az_mi_az_iskolaban_2"),
    ("nem-lehet-csak-tanitani",     "https://www.tani-tani.info/nem_lehet_csak_tanitani"),
    ("le-a-piros-tollal",           "https://www.tani-tani.info/le_a_piros_tollal"),
    ("pedagogiai-igazsagkonstrukcio","https://www.tani-tani.info/pedagogiai_igazsagkonstrukcio"),
    ("a-pedagogusprofesszio",       "https://www.tani-tani.info/a_pedagogusprofesszio"),
    ("mi-egyeni-utak-onszervezo-tanulas", "https://www.tani-tani.info/mi_egyeni_utak_onszervezo_tanulas_i"),
    ("a-kozoktatas-felforgatasa",   "https://www.tani-tani.info/a_kozoktatas_felforgatasa"),
    ("az-oktatas-vege",             "https://www.tani-tani.info/az_oktatas_vege"),
    ("jatszva-egyutt-alkotni",      "https://www.tani-tani.info/jatszva_egyutt_alkotni"),
    ("tanuloi-ertekeles",           "https://www.tani-tani.info/082_cseh"),
    ("erintettek",                  "https://www.tani-tani.info/erintettek"),
    ("a-pedagogia-lelke",           "https://www.tani-tani.info/a_pedagogia_lelke"),
    ("szegregacios-buntetes",       "https://www.tani-tani.info/szegregacios_buntetes"),
    ("mindenki-onmaga",             "https://www.tani-tani.info/mindenki_onmaga"),
    ("az-antropologiai-gyerek",     "https://www.tani-tani.info/az_antropologiai_gyerek"),
    ("hatarokon-innen-es-tul",      "https://www.tani-tani.info/hatarokon_innen_es_tul"),
    ("gyermekjogok-es-a-korczaki-orokseg", "https://www.tani-tani.info/gyermekjogok_es_a_korczaki_orokseg"),
]

IMAGES_DIR = os.path.join(os.path.dirname(__file__), "..", "public", "images", "cikkek")
CONTENT_DIR = os.path.join(os.path.dirname(__file__), "..", "content", "cikkek")

# Sidebar images to skip
SKIP_IMAGES = {"tani_tani_konyvek.jpg", "tto_hirlevel.jpg", "logo.png", "tanitani_logo"}

def fetch(url):
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
    with urllib.request.urlopen(req, timeout=15) as r:
        return r.read().decode("utf-8", errors="replace")

def extract_body_html(html):
    """Extract the article body div (field-items), stopping before sidebar."""
    start = html.find('class="field-items"')
    if start == -1:
        start = html.find("field-items")
    if start == -1:
        return ""
    # Find the opening > after class="field-items"
    div_start = html.rfind("<div", 0, start)
    chunk = html[div_start:]
    # Stop at comments section or sidebar indicators
    for stopper in ['id="comments"', 'class="sidebar"', 'class="region-sidebar"',
                    'id="block-tanitani', 'class="view-display-id-block']:
        idx = chunk.find(stopper)
        if idx != -1:
            chunk = chunk[:idx]
    return chunk

def extract_images(body_html):
    """Find article inline images (not sidebar widgets)."""
    imgs = re.findall(r'<img[^>]+src="(/sites/default/files/[^"]+)"', body_html)
    result = []
    for img in imgs:
        filename = img.split("/")[-1]
        if not any(skip in filename for skip in SKIP_IMAGES):
            result.append("https://www.tani-tani.info" + img)
    return result

def html_to_markdown(html):
    """Convert article HTML to clean markdown."""
    # Remove script/style blocks
    html = re.sub(r'<script[^>]*>.*?</script>', '', html, flags=re.DOTALL)
    html = re.sub(r'<style[^>]*>.*?</style>', '', html, flags=re.DOTALL)

    # Block elements → newlines first
    html = re.sub(r'<br\s*/?>', '\n', html)
    html = re.sub(r'</p>', '\n\n', html)
    html = re.sub(r'</div>', '\n', html)
    html = re.sub(r'</li>', '\n', html)
    html = re.sub(r'</tr>', '\n', html)

    # Headings
    for n in range(6, 0, -1):
        html = re.sub(rf'<h{n}[^>]*>(.*?)</h{n}>', lambda m, n=n: '\n' + '#'*n + ' ' + m.group(1).strip() + '\n', html, flags=re.DOTALL)

    # Bold / italic
    html = re.sub(r'<strong[^>]*>(.*?)</strong>', r'**\1**', html, flags=re.DOTALL)
    html = re.sub(r'<b[^>]*>(.*?)</b>', r'**\1**', html, flags=re.DOTALL)
    html = re.sub(r'<em[^>]*>(.*?)</em>', r'*\1*', html, flags=re.DOTALL)
    html = re.sub(r'<i[^>]*>(.*?)</i>', r'*\1*', html, flags=re.DOTALL)

    # Blockquote
    html = re.sub(r'<blockquote[^>]*>(.*?)</blockquote>', lambda m: '\n> ' + m.group(1).strip().replace('\n', '\n> ') + '\n', html, flags=re.DOTALL)

    # Links - keep text only (internal links not useful in rebuild)
    html = re.sub(r'<a[^>]*href="(https?://[^"]+)"[^>]*>(.*?)</a>', r'[\2](\1)', html, flags=re.DOTALL)
    html = re.sub(r'<a[^>]*>(.*?)</a>', r'\1', html, flags=re.DOTALL)

    # Images - convert to markdown with alt text
    html = re.sub(r'<img[^>]+src="(/sites/default/files/[^"]+)"[^>]*alt="([^"]*)"[^>]*/?>',
                  lambda m: f'\n![{m.group(2)}](https://www.tani-tani.info{m.group(1)})\n', html)
    html = re.sub(r'<img[^>]+src="(/sites/default/files/[^"]+)"[^>]*/?>',
                  lambda m: f'\n![kép](https://www.tani-tani.info{m.group(1)})\n', html)

    # Lists
    html = re.sub(r'<ul[^>]*>', '\n', html)
    html = re.sub(r'</ul>', '\n', html)
    html = re.sub(r'<ol[^>]*>', '\n', html)
    html = re.sub(r'</ol>', '\n', html)
    html = re.sub(r'<li[^>]*>', '- ', html)

    # Strip remaining tags
    html = re.sub(r'<[^>]+>', '', html)

    # Decode HTML entities
    html = html.replace('&nbsp;', ' ').replace('&amp;', '&').replace('&lt;', '<')
    html = html.replace('&gt;', '>').replace('&quot;', '"').replace('&#039;', "'")
    html = html.replace('&ndash;', '–').replace('&mdash;', '—').replace('&hellip;', '…')

    # Clean up whitespace
    html = re.sub(r'\n{4,}', '\n\n\n', html)
    html = re.sub(r' {2,}', ' ', html)
    lines = [l.rstrip() for l in html.split('\n')]
    return '\n'.join(lines).strip()

def extract_frontmatter(slug):
    """Read existing frontmatter from the .md file."""
    path = os.path.join(CONTENT_DIR, f"{slug}.md")
    if not os.path.exists(path):
        return {}
    with open(path) as f:
        content = f.read()
    fm = {}
    m = re.search(r'^---\n(.*?)\n---', content, re.DOTALL)
    if not m:
        return {}
    for line in m.group(1).split('\n'):
        if ':' in line:
            key, _, val = line.partition(':')
            fm[key.strip()] = val.strip()
    return fm

def download_image(url, dest_path):
    """Download an image if it doesn't already exist or is a stock photo."""
    try:
        req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
        with urllib.request.urlopen(req, timeout=15) as r:
            data = r.read()
        with open(dest_path, 'wb') as f:
            f.write(data)
        return len(data)
    except Exception as e:
        print(f"  Image download failed: {e}")
        return 0

def process_article(slug, url):
    print(f"\n📄 {slug}")
    try:
        html = fetch(url)
    except Exception as e:
        print(f"  ERROR fetching: {e}")
        return

    body_html = extract_body_html(html)
    if not body_html:
        print(f"  WARNING: no body found")
        return

    # Extract inline images
    inline_imgs = extract_images(body_html)
    print(f"  Inline images: {[u.split('/')[-1] for u in inline_imgs]}")

    # Download inline images (save as slug_1.jpg, slug_2.jpg etc.)
    saved_img_paths = []
    for i, img_url in enumerate(inline_imgs):
        ext = img_url.split('.')[-1].lower()
        if ext not in ('jpg', 'jpeg', 'png', 'gif', 'webp'):
            ext = 'jpg'
        if i == 0:
            # First inline image → overwrite main article image
            dest = os.path.join(IMAGES_DIR, f"{slug}.jpg")
        else:
            dest = os.path.join(IMAGES_DIR, f"{slug}_{i}.{ext}")
        size = download_image(img_url, dest)
        if size > 0:
            print(f"  Downloaded {img_url.split('/')[-1]} → {os.path.basename(dest)} ({size//1024}KB)")
            if i == 0:
                saved_img_paths.append(f"/images/cikkek/{slug}.jpg")
            else:
                saved_img_paths.append(f"/images/cikkek/{slug}_{i}.{ext}")

    # Convert body to markdown
    body_md = html_to_markdown(body_html)

    # Read existing frontmatter to preserve title, author, date, tags, excerpt, reads
    fm = extract_frontmatter(slug)

    title = fm.get('title', f'"{slug}"')
    author = fm.get('author', '""')
    date = fm.get('date', '"2026-01-01"')
    tags = fm.get('tags', '[]')
    excerpt = fm.get('excerpt', '""')
    image = f'/images/cikkek/{slug}.jpg'
    reads = fm.get('reads', '0')

    new_md = f"""---
title: {title}
author: {author}
date: {date}
tags: {tags}
excerpt: {excerpt}
image: {image}
reads: {reads}
---

{body_md}
"""

    out_path = os.path.join(CONTENT_DIR, f"{slug}.md")
    with open(out_path, 'w') as f:
        f.write(new_md)
    print(f"  ✓ Written {len(body_md)} chars to {os.path.basename(out_path)}")

if __name__ == "__main__":
    os.makedirs(IMAGES_DIR, exist_ok=True)
    slugs = [sys.argv[1]] if len(sys.argv) > 1 else None

    for slug, url in ARTICLES:
        if slugs and slug not in slugs:
            continue
        process_article(slug, url)

    print("\n✅ Done")
