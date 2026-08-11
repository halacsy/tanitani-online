#!/usr/bin/env python3
"""Add public articles published after the Drupal SQL dump.

The SQL dump remains the canonical historical source. This public-only sync
scans the current archive, downloads referenced media and updates the portable
SQLite database plus the build JSON. It never reads account or operational
Drupal data.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import mimetypes
import re
import shutil
import sqlite3
import time
import unicodedata
import urllib.error
import urllib.parse
import urllib.request
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime
from pathlib import Path
from typing import Any
from zoneinfo import ZoneInfo

from lxml import etree, html

from export_site_data import make_excerpt, plain_text, sanitize_public_html, slugify, write_json


ROOT = Path(__file__).resolve().parents[1]
CONTENT_DIR = ROOT / "content" / "migrated" / "tanitani"
SQLITE_PATH = ROOT / "data" / "tanitani-public.sqlite"
PUBLIC_DIR = ROOT / "public"
USER_AGENT = "TaniTani migration/1.0 (+public archival sync)"
MONTHS = {
    "jan": 1, "feb": 2, "marc": 3, "apr": 4, "maj": 5, "jun": 6,
    "jul": 7, "aug": 8, "szept": 9, "okt": 10, "nov": 11, "dec": 12,
}


def fetch(url: str, attempts: int = 4) -> tuple[bytes, dict[str, str]]:
    request = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
    last_error: Exception | None = None
    for attempt in range(attempts):
        try:
            with urllib.request.urlopen(request, timeout=45) as response:
                return response.read(), {key.lower(): value for key, value in response.headers.items()}
        except (urllib.error.URLError, TimeoutError) as error:
            last_error = error
            if attempt + 1 < attempts:
                time.sleep(0.5 * (2**attempt))
    raise RuntimeError(f"Nem sikerült letölteni: {url}: {last_error}")


def fetch_document(url: str) -> html.HtmlElement:
    body, _ = fetch(url)
    return html.fromstring(body, base_url=url)


def has_class(class_name: str) -> str:
    return f"contains(concat(' ', normalize-space(@class), ' '), ' {class_name} ')"


def inner_html(element: html.HtmlElement) -> str:
    parts = [element.text or ""]
    parts.extend(etree.tostring(child, encoding="unicode", method="html") for child in element)
    return "".join(parts).strip()


def normalize(value: str) -> str:
    return unicodedata.normalize("NFKD", value).encode("ascii", "ignore").decode("ascii").lower()


def parse_drupal_date(text: str) -> int:
    match = re.search(
        r"(20\d{2})\.\s*([\wáéíóöőúüű]+)\.\s*(\d{1,2})\.\s*-\s*(\d{1,2}):(\d{2})",
        text,
        flags=re.I,
    )
    if not match:
        raise ValueError(f"Ismeretlen Drupal-dátum: {text!r}")
    year, month_name, day, hour, minute = match.groups()
    month = MONTHS[normalize(month_name).rstrip(".")]
    local_time = datetime(
        int(year), month, int(day), int(hour), int(minute),
        tzinfo=ZoneInfo("Europe/Budapest"),
    )
    return int(local_time.timestamp())


def unique_slug(name: str, used: set[str], fallback: str) -> str:
    candidate = slugify(name, fallback)
    base = candidate
    suffix = 2
    while candidate in used:
        candidate = f"{base}-{suffix}"
        suffix += 1
    used.add(candidate)
    return candidate


def term_id(href: str | None) -> int | None:
    match = re.search(r"/taxonomy/term/(\d+)", href or "")
    return int(match.group(1)) if match else None


def resolve_media_url(url: str, origin: str) -> tuple[str, str] | None:
    absolute = urllib.parse.urljoin(origin + "/", url)
    parsed = urllib.parse.urlparse(absolute)
    if not parsed.path.startswith("/sites/default/files/"):
        return None
    return absolute, urllib.parse.unquote(parsed.path)


def find_media_urls(body_html: str, origin: str) -> list[tuple[str, str]]:
    fragment = html.fragment_fromstring(body_html or "<p></p>", create_parent=True)
    result: list[tuple[str, str]] = []
    seen: set[str] = set()
    for element in fragment.xpath(".//*[@src or @href]"):
        for attribute in ("src", "href"):
            resolved = resolve_media_url(element.get(attribute) or "", origin)
            if resolved and resolved[1] not in seen:
                result.append(resolved)
                seen.add(resolved[1])
    return result


def download_media(url: str, public_path: str) -> tuple[int, str]:
    target = PUBLIC_DIR / public_path.lstrip("/")
    if target.exists() and target.stat().st_size:
        return target.stat().st_size, mimetypes.guess_type(target.name)[0] or "application/octet-stream"
    body, headers = fetch(url)
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_bytes(body)
    mime_type = (
        headers.get("content-type", "").split(";", 1)[0]
        or mimetypes.guess_type(target.name)[0]
        or "application/octet-stream"
    )
    return len(body), mime_type


def source_media_url(public_path: str, origin: str) -> str:
    encoded = urllib.parse.quote(public_path.strip(), safe="/%:@?=&+,%")
    return origin + encoded


def decoded_public_path(public_path: str) -> str:
    raw_path = urllib.parse.unquote_to_bytes(public_path)
    try:
        return raw_path.decode("utf-8")
    except UnicodeDecodeError:
        return raw_path.decode("latin-1")


def local_media_path(public_path: str) -> Path | None:
    literal = PUBLIC_DIR / public_path.lstrip("/")
    if literal.is_file():
        return literal
    decoded = PUBLIC_DIR / decoded_public_path(public_path).lstrip("/")
    return decoded if decoded.is_file() else None


def historical_media_references(article_index: list[dict[str, Any]]) -> set[str]:
    pattern = re.compile(r"(?:href|src)\s*=\s*['\"](/sites/default/files/[^'\"?#]+)", re.I)
    references: set[str] = set()
    for article in article_index:
        full_path = CONTENT_DIR / "articles" / f"{article['id']}.json"
        if not full_path.exists():
            continue
        full = json.loads(full_path.read_text(encoding="utf-8"))
        html_parts = [full.get("summaryHtml", ""), full.get("bodyHtml", "")]
        html_parts.extend(comment.get("bodyHtml", "") for comment in full.get("comments", []))
        references.update(path.strip() for path in pattern.findall("\n".join(html_parts)))
        cover = article.get("coverImage", "")
        if cover.startswith("/sites/default/files/"):
            references.add(cover.strip())
    for page in json.loads((CONTENT_DIR / "pages.json").read_text(encoding="utf-8")):
        page_html = "\n".join((page.get("summaryHtml", ""), page.get("bodyHtml", "")))
        references.update(path.strip() for path in pattern.findall(page_html))
    return references


def archive_historical_inline_media(
    article_index: list[dict[str, Any]],
    media: list[dict[str, Any]],
    origin: str,
    workers: int = 12,
) -> tuple[dict[str, int], set[str]]:
    references = historical_media_references(article_index)
    missing = sorted(
        path for path in references if local_media_path(path) is None
    )
    if missing:
        print(f"Régi inline média: {len(references)} hivatkozás, {len(missing)} letöltendő")
    results: dict[str, tuple[int, str] | None] = {}

    def worker(public_path: str) -> tuple[str, tuple[int, str] | None]:
        try:
            details = download_media(source_media_url(public_path, origin), public_path)
            return public_path, details
        except RuntimeError:
            return public_path, None

    if missing:
        with ThreadPoolExecutor(max_workers=max(1, workers)) as executor:
            futures = [executor.submit(worker, path) for path in missing]
            for position, future in enumerate(as_completed(futures), 1):
                public_path, details = future.result()
                results[public_path] = details
                if position % 100 == 0:
                    print(f"  {position}/{len(missing)}")

    media_by_path = {entry["publicPath"]: entry for entry in media}
    downloaded = 0
    failed = 0
    for public_path, details in results.items():
        if details is None:
            failed += 1
            continue
        downloaded += 1
    # Catalogue every locally available HTML-referenced file, including files
    # retained from an earlier resumable run.
    for public_path in references:
        local_path = local_media_path(public_path)
        if local_path is None:
            continue
        catalog_path = "/" + local_path.relative_to(PUBLIC_DIR).as_posix()
        if catalog_path in media_by_path:
            continue
        byte_size = local_path.stat().st_size
        mime_type = mimetypes.guess_type(local_path.name)[0] or "application/octet-stream"
        digest = int(hashlib.sha1(catalog_path.encode()).hexdigest()[:8], 16)
        record = {
            "id": -(digest + 1),
            "filename": local_path.name,
            "uri": catalog_path.lstrip("/"),
            "publicPath": catalog_path,
            "mimeType": mime_type,
            "byteSize": byte_size,
            "createdAt": 0,
            "sourceNodeId": 0,
            "source": "historical-inline-html",
        }
        media.append(record)
        media_by_path[catalog_path] = record
    if missing:
        print(f"Régi inline média kész: {downloaded} letöltve, {failed} nem elérhető")
    failed_paths = {path for path, details in results.items() if details is None}
    return {"referenced": len(references), "downloaded": downloaded, "failed": failed}, failed_paths


def normalize_exported_media_attributes(article_index: list[dict[str, Any]]) -> int:
    pattern = re.compile(
        r"((?:href|src)\s*=\s*['\"])(/sites/default/files/[^'\"]*)(['\"])",
        flags=re.I,
    )

    def normalize_html(value: str) -> str:
        return pattern.sub(
            lambda match: f"{match.group(1)}{match.group(2).strip().replace(',', '%2C')}{match.group(3)}",
            value,
        )

    changes = 0
    changed_articles: list[dict[str, Any]] = []
    changed_comments: list[dict[str, Any]] = []
    for article in article_index:
        full_path = CONTENT_DIR / "articles" / f"{article['id']}.json"
        full = json.loads(full_path.read_text(encoding="utf-8"))
        changed = False
        for key in ("summaryHtml", "bodyHtml"):
            normalized = normalize_html(full.get(key, ""))
            if normalized != full.get(key, ""):
                full[key] = normalized
                changes += 1
                changed = True
        for comment in full.get("comments", []):
            normalized = normalize_html(comment.get("bodyHtml", ""))
            if normalized != comment.get("bodyHtml", ""):
                comment["bodyHtml"] = normalized
                changed_comments.append(comment)
                changes += 1
                changed = True
        cover = article.get("coverImage", "")
        if cover != cover.strip():
            article["coverImage"] = cover.strip()
            full["coverImage"] = cover.strip()
            changes += 1
            changed = True
        if changed:
            write_json(full_path, full)
            changed_articles.append(full)

    pages = json.loads((CONTENT_DIR / "pages.json").read_text(encoding="utf-8"))
    changed_pages: list[dict[str, Any]] = []
    for page in pages:
        changed = False
        for key in ("summaryHtml", "bodyHtml"):
            normalized = normalize_html(page.get(key, ""))
            if normalized != page.get(key, ""):
                page[key] = normalized
                changes += 1
                changed = True
        if changed:
            changed_pages.append(page)
    if changed_pages:
        write_json(CONTENT_DIR / "pages.json", pages)

    if SQLITE_PATH.exists() and (changed_articles or changed_pages or changed_comments):
        connection = sqlite3.connect(SQLITE_PATH)
        try:
            with connection:
                for article in changed_articles:
                    connection.execute(
                        "UPDATE articles SET body_html = ?, summary_html = ?, cover_uri = ? WHERE id = ?",
                        (article["bodyHtml"], article["summaryHtml"], article.get("coverImage", ""), article["id"]),
                    )
                for comment in changed_comments:
                    connection.execute(
                        "UPDATE comments SET body_html = ? WHERE id = ?",
                        (comment["bodyHtml"], comment["id"]),
                    )
                for page in changed_pages:
                    connection.execute(
                        "UPDATE pages SET body_html = ?, summary_html = ? WHERE id = ?",
                        (page["bodyHtml"], page["summaryHtml"], page["id"]),
                    )
        finally:
            connection.close()
    return changes


def localize_percent_encoded_media(
    article_index: list[dict[str, Any]], media: list[dict[str, Any]],
) -> int:
    """Rewrite legacy percent-encoded filenames to filesystem-safe local URLs."""
    references = historical_media_references(article_index)
    replacements: dict[str, str] = {}
    for public_path in references:
        if "%" not in public_path:
            continue
        source = PUBLIC_DIR / public_path.lstrip("/")
        if not source.is_file():
            continue
        decoded_path = decoded_public_path(public_path)
        if decoded_path == public_path or ".." in Path(decoded_path).parts:
            continue
        destination = PUBLIC_DIR / decoded_path.lstrip("/")
        destination.parent.mkdir(parents=True, exist_ok=True)
        if not destination.exists():
            shutil.copyfile(source, destination)
        replacements[public_path] = decoded_path

    if not replacements:
        return 0

    def replace_html(value: str) -> str:
        for old_path, new_path in replacements.items():
            value = value.replace(old_path, new_path)
        return value

    changed_articles: list[dict[str, Any]] = []
    changed_comments: list[dict[str, Any]] = []
    for article in article_index:
        full_path = CONTENT_DIR / "articles" / f"{article['id']}.json"
        full = json.loads(full_path.read_text(encoding="utf-8"))
        changed = False
        for key in ("summaryHtml", "bodyHtml"):
            localized = replace_html(full.get(key, ""))
            if localized != full.get(key, ""):
                full[key] = localized
                changed = True
        for comment in full.get("comments", []):
            localized = replace_html(comment.get("bodyHtml", ""))
            if localized != comment.get("bodyHtml", ""):
                comment["bodyHtml"] = localized
                changed_comments.append(comment)
                changed = True
        if article.get("coverImage") in replacements:
            article["coverImage"] = replacements[article["coverImage"]]
            full["coverImage"] = article["coverImage"]
            changed = True
        if changed:
            write_json(full_path, full)
            changed_articles.append(full)

    pages = json.loads((CONTENT_DIR / "pages.json").read_text(encoding="utf-8"))
    changed_pages: list[dict[str, Any]] = []
    for page in pages:
        changed = False
        for key in ("summaryHtml", "bodyHtml"):
            localized = replace_html(page.get(key, ""))
            if localized != page.get(key, ""):
                page[key] = localized
                changed = True
        if changed:
            changed_pages.append(page)
    if changed_pages:
        write_json(CONTENT_DIR / "pages.json", pages)

    media_by_path = {entry["publicPath"]: entry for entry in media}
    used_ids = {entry["id"] for entry in media}
    for old_path, new_path in replacements.items():
        if new_path in media_by_path:
            continue
        local_path = PUBLIC_DIR / new_path.lstrip("/")
        media_id = -(int(hashlib.sha1(new_path.encode()).hexdigest()[:8], 16) + 1)
        while media_id in used_ids:
            media_id -= 1
        used_ids.add(media_id)
        record = {
            "id": media_id,
            "filename": local_path.name,
            "uri": new_path.lstrip("/"),
            "publicPath": new_path,
            "mimeType": mimetypes.guess_type(local_path.name)[0] or "application/octet-stream",
            "byteSize": local_path.stat().st_size,
            "createdAt": 0,
            "sourceNodeId": 0,
            "source": "historical-inline-html",
            "legacyEncodedPath": old_path,
        }
        media.append(record)
        media_by_path[new_path] = record

    if SQLITE_PATH.exists():
        connection = sqlite3.connect(SQLITE_PATH)
        try:
            with connection:
                for article in changed_articles:
                    connection.execute(
                        "UPDATE articles SET body_html = ?, summary_html = ?, cover_uri = ? WHERE id = ?",
                        (article["bodyHtml"], article["summaryHtml"], article.get("coverImage", ""), article["id"]),
                    )
                for comment in changed_comments:
                    connection.execute(
                        "UPDATE comments SET body_html = ? WHERE id = ?",
                        (comment["bodyHtml"], comment["id"]),
                    )
                for page in changed_pages:
                    connection.execute(
                        "UPDATE pages SET body_html = ?, summary_html = ? WHERE id = ?",
                        (page["bodyHtml"], page["summaryHtml"], page["id"]),
                    )
        finally:
            connection.close()
    return len(replacements)


def repair_unavailable_references(
    failed_paths: set[str], article_index: list[dict[str, Any]],
) -> int:
    """Remove broken images and retarget lightbox links to local thumbnails."""
    if not failed_paths:
        return 0
    repaired = 0
    changed_articles: list[dict[str, Any]] = []
    for article in article_index:
        full_path = CONTENT_DIR / "articles" / f"{article['id']}.json"
        full = json.loads(full_path.read_text(encoding="utf-8"))
        fragment = html.fragment_fromstring(full.get("bodyHtml", "") or "<p></p>", create_parent=True)
        changed = False
        for element in list(fragment.xpath(".//*[@src or @href]")):
            source = (element.get("src") or "").strip()
            href = (element.get("href") or "").strip()
            if element.tag.lower() == "img" and source in failed_paths:
                element.drop_tree()
                repaired += 1
                changed = True
                continue
            if element.tag.lower() == "a" and href in failed_paths:
                thumbnails = element.xpath(".//img[@src]")
                local_thumbnail = next(
                    (
                        (thumbnail.get("src") or "").strip()
                        for thumbnail in thumbnails
                        if (thumbnail.get("src") or "").strip() not in failed_paths
                        and (PUBLIC_DIR / (thumbnail.get("src") or "").strip().lstrip("/")).is_file()
                    ),
                    "",
                )
                if local_thumbnail:
                    element.set("href", local_thumbnail)
                else:
                    element.attrib.pop("href", None)
                    element.attrib.pop("rel", None)
                repaired += 1
                changed = True
        if article.get("coverImage", "").strip() in failed_paths:
            article["coverImage"] = ""
            full["coverImage"] = ""
            repaired += 1
            changed = True
        if changed:
            full["bodyHtml"] = inner_html(fragment)
            write_json(full_path, full)
            changed_articles.append(full)

    pages = json.loads((CONTENT_DIR / "pages.json").read_text(encoding="utf-8"))
    changed_pages: list[dict[str, Any]] = []
    for page in pages:
        fragment = html.fragment_fromstring(page.get("bodyHtml", "") or "<p></p>", create_parent=True)
        changed = False
        for element in list(fragment.xpath(".//*[@src or @href]")):
            source = (element.get("src") or "").strip()
            href = (element.get("href") or "").strip()
            if element.tag.lower() == "img" and source in failed_paths:
                element.drop_tree()
                repaired += 1
                changed = True
            elif element.tag.lower() == "a" and href in failed_paths:
                element.attrib.pop("href", None)
                element.attrib.pop("rel", None)
                repaired += 1
                changed = True
        if changed:
            page["bodyHtml"] = inner_html(fragment)
            changed_pages.append(page)
    if changed_pages:
        write_json(CONTENT_DIR / "pages.json", pages)

    if SQLITE_PATH.exists() and (changed_articles or changed_pages):
        connection = sqlite3.connect(SQLITE_PATH)
        try:
            with connection:
                for article in changed_articles:
                    connection.execute(
                        "UPDATE articles SET body_html = ?, cover_uri = ? WHERE id = ?",
                        (article["bodyHtml"], article.get("coverImage", ""), article["id"]),
                    )
                for page in changed_pages:
                    connection.execute(
                        "UPDATE pages SET body_html = ? WHERE id = ?",
                        (page["bodyHtml"], page["id"]),
                    )
        finally:
            connection.close()
    return repaired


def discover_articles(origin: str, dump_max_id: int, max_pages: int) -> list[tuple[int, str]]:
    discovered: dict[int, str] = {}
    reached_dump = False
    for page in range(max_pages):
        suffix = "" if page == 0 else f"?page={page}"
        document = fetch_document(f"{origin}/node{suffix}")
        teaser_nodes = document.xpath("//article[starts-with(@id, 'node-')]")
        if not teaser_nodes:
            break
        for teaser in teaser_nodes:
            try:
                node_id = int((teaser.get("id") or "").removeprefix("node-"))
            except ValueError:
                continue
            if node_id <= dump_max_id:
                reached_dump = True
                continue
            title_links = teaser.xpath(".//h2//a[@href]")
            if title_links:
                discovered[node_id] = urllib.parse.urljoin(origin + "/", title_links[0].get("href"))
        if reached_dump:
            break
        time.sleep(0.1)
    return sorted(discovered.items())


def infer_tags(text: str, title: str, tags: list[dict[str, Any]]) -> list[dict[str, Any]]:
    normalized_text = normalize(text)
    normalized_title = normalize(title)
    ignored = {"film", "iras", "oktatas", "anyag", "iskola"}
    scored: list[tuple[int, int, dict[str, Any]]] = []
    for tag in tags:
        needle = normalize(tag["name"]).strip()
        if len(needle) < 4 or needle in ignored:
            continue
        pattern = rf"(?<!\w){re.escape(needle)}(?!\w)"
        score = len(re.findall(pattern, normalized_text)) + 5 * len(re.findall(pattern, normalized_title))
        if score:
            scored.append((score, len(needle), tag))
    scored.sort(key=lambda item: (-item[0], -item[1], item[2]["name"]))
    selected = [item[2] for item in scored[:4]]
    if not selected:
        fallback = next((tag for tag in tags if tag["slug"] == "neveles"), None)
        if fallback:
            selected = [fallback]
    return [{"id": tag["id"], "slug": tag["slug"], "name": tag["name"]} for tag in selected]


def extract_comments(document: html.HtmlElement, article_id: int) -> list[dict[str, Any]]:
    result: list[dict[str, Any]] = []
    for comment in document.xpath("//div[@id='comments']//article[starts-with(@id, 'comment-')]"):
        try:
            comment_id = int((comment.get("id") or "").removeprefix("comment-"))
        except ValueError:
            continue
        body_items = comment.xpath(
            f".//div[{has_class('field-name-comment-body')}]//div[{has_class('field-item')}]"
        )
        if not body_items:
            continue
        submitted = " ".join(comment.xpath(f".//*[{has_class('submitted')}]//text()")).strip()
        author_names = comment.xpath(f".//*[{has_class('submitted')}]//a/text()")
        result.append(
            {
                "id": comment_id,
                "parentId": None,
                "articleId": article_id,
                "authorName": author_names[0].strip() if author_names else "Olvasó",
                "subject": " ".join(comment.xpath(".//h3//text()")).strip() or "Hozzászólás",
                "bodyHtml": sanitize_public_html(inner_html(body_items[0])),
                "publishedAt": parse_drupal_date(submitted),
                "threadPath": "",
            }
        )
    return result


def parse_article(
    node_id: int,
    url: str,
    origin: str,
    authors: list[dict[str, Any]],
    tags: list[dict[str, Any]],
    media: list[dict[str, Any]],
) -> dict[str, Any]:
    document = fetch_document(url)
    nodes = document.xpath(f"//article[@id='node-{node_id}']")
    # Older Drupal renderings omit the semantic <article> wrapper entirely,
    # while newer ones expose article#node-ID. The field classes are stable in
    # both variants, so the full document is the safe fallback scope.
    node = nodes[0] if nodes else document
    title_nodes = document.xpath("//h1[@id='page-title']")
    title = " ".join(title_nodes[0].itertext()).strip() if title_nodes else f"Cikk {node_id}"
    canonical = document.xpath("//link[@rel='canonical']/@href")
    canonical_url = urllib.parse.urljoin(origin + "/", canonical[0] if canonical else url)
    canonical_path = urllib.parse.unquote(urllib.parse.urlparse(canonical_url).path.strip("/"))
    article_slug = canonical_path if "/" not in canonical_path else f"node-{node_id}"

    body_items = node.xpath(f".//div[{has_class('field-name-body')}]//div[{has_class('field-item')}]")
    if not body_items:
        raise RuntimeError(f"A {node_id}. cikk törzsszövege nem található")
    body_html = sanitize_public_html(inner_html(body_items[0]))
    text = plain_text(body_html)
    submitted = " ".join(node.xpath(f".//*[{has_class('submitted')}]//text()")).strip()
    published_at = parse_drupal_date(submitted)
    read_text = " ".join(node.xpath(f".//*[{has_class('statistics_counter')}]//text()"))
    read_match = re.search(r"\d+", read_text.replace(" ", ""))

    authors_by_id = {author["id"]: author for author in authors}
    authors_by_name = {normalize(author["name"]): author for author in authors}
    used_slugs = {author["slug"] for author in authors}
    author_refs: list[dict[str, Any]] = []
    for link in node.xpath(f".//div[{has_class('field-name-taxonomy-vocabulary-4')}]//a[@href]"):
        name = " ".join(link.itertext()).strip()
        author_id = term_id(link.get("href"))
        author = authors_by_id.get(author_id) if author_id is not None else None
        author = author or authors_by_name.get(normalize(name))
        if author is None:
            author_id = author_id or (900000 + node_id * 10 + len(author_refs))
            author = {
                "id": author_id,
                "name": name,
                "descriptionHtml": "",
                "weight": 0,
                "slug": unique_slug(name, used_slugs, f"szerzo-{author_id}"),
                "articleCount": 0,
            }
            authors.append(author)
            authors_by_id[author_id] = author
            authors_by_name[normalize(name)] = author
        author_refs.append({"id": author["id"], "slug": author["slug"], "name": author["name"]})

    media_candidates: list[tuple[str, str]] = []
    cover_image = ""
    cover_alt = ""
    cover_title = ""
    cover_nodes = node.xpath(f".//div[{has_class('field-name-field-image')}]//img[@src]")
    if cover_nodes:
        resolved = resolve_media_url(cover_nodes[0].get("src") or "", origin)
        if resolved:
            media_candidates.append(resolved)
            cover_image = resolved[1]
            cover_alt = cover_nodes[0].get("alt") or title
            cover_title = cover_nodes[0].get("title") or ""
    media_candidates.extend(find_media_urls(body_html, origin))

    media_by_path = {entry["publicPath"]: entry for entry in media}
    for media_url, public_path in dict.fromkeys(media_candidates):
        if public_path in media_by_path:
            continue
        try:
            byte_size, mime_type = download_media(media_url, public_path)
        except RuntimeError as error:
            print(f"FIGYELMEZTETÉS: {error}")
            continue
        digest = int(hashlib.sha1(public_path.encode()).hexdigest()[:8], 16)
        record = {
            "id": -(digest + 1),
            "filename": Path(public_path).name,
            "uri": public_path.lstrip("/"),
            "publicPath": public_path,
            "mimeType": mime_type,
            "byteSize": byte_size,
            "createdAt": published_at,
            "sourceNodeId": node_id,
        }
        media.append(record)
        media_by_path[public_path] = record

    attachments: list[dict[str, Any]] = []
    for position, link in enumerate(node.xpath(f".//div[{has_class('field-name-upload')}]//a[@href]")):
        resolved = resolve_media_url(link.get("href") or "", origin)
        media_record = media_by_path.get(resolved[1]) if resolved else None
        if media_record:
            attachments.append(
                {
                    "articleId": node_id,
                    "mediaId": media_record["id"],
                    "position": position,
                    "description": " ".join(link.itertext()).strip() or media_record["filename"],
                    "visible": True,
                    "media": media_record,
                }
            )

    comments = extract_comments(document, node_id)
    inferred_tags = infer_tags(text, title, tags)
    excerpt = make_excerpt("", body_html)
    return {
        "id": node_id,
        "slug": article_slug,
        "contentType": "poszt",
        "title": title,
        "authors": author_refs,
        "publishedAt": published_at,
        "date": datetime.fromtimestamp(published_at, ZoneInfo("Europe/Budapest")).date().isoformat(),
        "updatedAt": published_at,
        "tags": inferred_tags,
        "sections": [],
        "excerpt": excerpt,
        "coverImage": cover_image,
        "coverAlt": cover_alt,
        "coverTitle": cover_title,
        "reads": int(read_match.group()) if read_match else 0,
        "commentCount": len(comments),
        "issueYear": "",
        "issueNumber": None,
        "issuePage": "",
        "summaryHtml": "",
        "bodyHtml": body_html,
        "attachments": attachments,
        "comments": comments,
        "migration": {"source": "live-public-supplement", "tagSource": "content-inference"},
    }


def index_record(article: dict[str, Any]) -> dict[str, Any]:
    excluded = {"summaryHtml", "bodyHtml", "attachments", "comments", "migration"}
    return {key: value for key, value in article.items() if key not in excluded}


def sync_sqlite(
    live_articles: list[dict[str, Any]],
    authors: list[dict[str, Any]],
    tags: list[dict[str, Any]],
    media: list[dict[str, Any]],
) -> None:
    if not SQLITE_PATH.exists():
        return
    live_ids = {article["id"] for article in live_articles}
    connection = sqlite3.connect(SQLITE_PATH)
    try:
        with connection:
            for author in authors:
                connection.execute(
                    "INSERT OR IGNORE INTO authors(id, slug, name, bio_html, article_count) VALUES (?, ?, ?, ?, ?)",
                    (author["id"], author["slug"], author["name"], author.get("descriptionHtml", ""), author["articleCount"]),
                )
                connection.execute("UPDATE authors SET article_count = ? WHERE id = ?", (author["articleCount"], author["id"]))
            for tag in tags:
                connection.execute(
                    "INSERT OR IGNORE INTO tags(id, slug, name, description_html, article_count) VALUES (?, ?, ?, ?, ?)",
                    (tag["id"], tag["slug"], tag["name"], tag.get("descriptionHtml", ""), tag["articleCount"]),
                )
                connection.execute("UPDATE tags SET article_count = ? WHERE id = ?", (tag["articleCount"], tag["id"]))
            for entry in media:
                if entry.get("sourceNodeId") not in live_ids and entry.get("source") != "historical-inline-html":
                    continue
                connection.execute(
                    "INSERT OR REPLACE INTO media(id, filename, uri, public_path, mime_type, byte_size, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
                    (entry["id"], entry["filename"], entry["uri"], entry["publicPath"], entry["mimeType"], entry["byteSize"], entry["createdAt"]),
                )
            for article in live_articles:
                connection.execute(
                    "INSERT OR REPLACE INTO articles(id, slug, content_type, title, body_html, summary_html, excerpt, published_at, updated_at, read_count, cover_uri, cover_alt, cover_title, issue_year, issue_number, issue_page, comment_count) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
                    (
                        article["id"], article["slug"], article["contentType"], article["title"], article["bodyHtml"],
                        article["summaryHtml"], article["excerpt"], article["publishedAt"], article["updatedAt"],
                        article["reads"], article["coverImage"], article["coverAlt"], article["coverTitle"],
                        article["issueYear"], article["issueNumber"], article["issuePage"], article["commentCount"],
                    ),
                )
                connection.execute("DELETE FROM article_authors WHERE article_id = ?", (article["id"],))
                connection.execute("DELETE FROM article_tags WHERE article_id = ?", (article["id"],))
                connection.execute("DELETE FROM article_sections WHERE article_id = ?", (article["id"],))
                connection.execute("DELETE FROM attachments WHERE article_id = ?", (article["id"],))
                connection.execute("DELETE FROM comments WHERE article_id = ?", (article["id"],))
                for position, author in enumerate(article["authors"]):
                    connection.execute(
                        "INSERT INTO article_authors(article_id, author_id, position) VALUES (?, ?, ?)",
                        (article["id"], author["id"], position),
                    )
                for position, tag in enumerate(article["tags"]):
                    connection.execute(
                        "INSERT INTO article_tags(article_id, tag_id, position) VALUES (?, ?, ?)",
                        (article["id"], tag["id"], position),
                    )
                for attachment in article["attachments"]:
                    connection.execute(
                        "INSERT INTO attachments(article_id, media_id, position, description, is_visible) VALUES (?, ?, ?, ?, ?)",
                        (article["id"], attachment["mediaId"], attachment["position"], attachment["description"], int(attachment["visible"])),
                    )
                for comment in article["comments"]:
                    connection.execute(
                        "INSERT OR REPLACE INTO comments(id, article_id, parent_id, author_name, subject, body_html, published_at, thread_path) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
                        (comment["id"], article["id"], comment["parentId"], comment["authorName"], comment["subject"], comment["bodyHtml"], comment["publishedAt"], comment["threadPath"]),
                    )
                connection.execute(
                    "INSERT OR REPLACE INTO redirects(source_path, target_path, source_kind) VALUES (?, ?, ?)",
                    (f"/{article['slug']}", f"/cikkek/{article['slug']}", "live_alias"),
                )
                connection.execute(
                    "INSERT OR REPLACE INTO redirects(source_path, target_path, source_kind) VALUES (?, ?, ?)",
                    (f"/node/{article['id']}", f"/cikkek/{article['slug']}", "drupal_node"),
                )
            synced_at = datetime.now(ZoneInfo("Europe/Budapest")).isoformat(timespec="seconds")
            connection.execute("INSERT OR REPLACE INTO metadata(key, value) VALUES ('live_supplement_synced_at', ?)", (synced_at,))
            connection.execute("INSERT OR REPLACE INTO metadata(key, value) VALUES ('live_supplement_article_count', ?)", (str(len(live_articles)),))
    finally:
        connection.close()


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--origin", default="https://www.tani-tani.info")
    parser.add_argument("--dump-max-id", type=int, default=1411)
    parser.add_argument("--max-pages", type=int, default=10)
    args = parser.parse_args()
    origin = args.origin.rstrip("/")

    article_index = json.loads((CONTENT_DIR / "articles.json").read_text(encoding="utf-8"))
    authors = json.loads((CONTENT_DIR / "authors.json").read_text(encoding="utf-8"))
    tags = json.loads((CONTENT_DIR / "tags.json").read_text(encoding="utf-8"))
    media = json.loads((CONTENT_DIR / "media.json").read_text(encoding="utf-8"))
    manifest = json.loads((CONTENT_DIR / "manifest.json").read_text(encoding="utf-8"))

    historical_media, unavailable_paths = archive_historical_inline_media(article_index, media, origin)
    historical_media["localizedEncodedPaths"] = localize_percent_encoded_media(
        article_index, media,
    )
    historical_media["normalizedAttributes"] = normalize_exported_media_attributes(article_index)
    historical_media["repairedReferences"] = repair_unavailable_references(
        unavailable_paths, article_index,
    )

    discovered = discover_articles(origin, args.dump_max_id, args.max_pages)
    print(f"Élő kiegészítés: {len(discovered)} cikk")
    live_articles: list[dict[str, Any]] = []
    for position, (node_id, url) in enumerate(discovered, 1):
        print(f"[{position}/{len(discovered)}] {node_id}: {url}")
        live_articles.append(parse_article(node_id, url, origin, authors, tags, media))
        time.sleep(0.1)

    articles_by_id = {article["id"]: article for article in article_index}
    for article in live_articles:
        articles_by_id[article["id"]] = index_record(article)
        write_json(CONTENT_DIR / "articles" / f"{article['id']}.json", article)
    all_articles = sorted(articles_by_id.values(), key=lambda article: article["publishedAt"], reverse=True)

    author_counts: dict[int, int] = {}
    tag_counts: dict[int, int] = {}
    for article in all_articles:
        for author in article["authors"]:
            author_counts[author["id"]] = author_counts.get(author["id"], 0) + 1
        for tag in article["tags"]:
            tag_counts[tag["id"]] = tag_counts.get(tag["id"], 0) + 1
    for author in authors:
        author["articleCount"] = author_counts.get(author["id"], 0)
    for tag in tags:
        tag["articleCount"] = tag_counts.get(tag["id"], 0)

    authors.sort(key=lambda author: author["name"].casefold())
    tags.sort(key=lambda tag: tag["name"].casefold())
    write_json(CONTENT_DIR / "articles.json", all_articles)
    write_json(CONTENT_DIR / "authors.json", authors)
    write_json(CONTENT_DIR / "tags.json", tags)
    write_json(CONTENT_DIR / "media.json", media)
    manifest["liveSupplement"] = {
        "origin": origin,
        "dumpMaxNodeId": args.dump_max_id,
        "articleCount": len(live_articles),
        "nodeIds": [article["id"] for article in live_articles],
        "tagSource": "content-inference",
        "syncedAt": datetime.now(ZoneInfo("Europe/Budapest")).isoformat(timespec="seconds"),
    }
    manifest["historicalInlineMedia"] = historical_media
    manifest["counts"]["articles"] = len(all_articles)
    manifest["counts"]["authors"] = len(authors)
    manifest["counts"]["tags"] = len(tags)
    manifest["counts"]["comments"] = sum(article["commentCount"] for article in all_articles)
    manifest["counts"]["media"] = len(media)
    write_json(CONTENT_DIR / "manifest.json", manifest)
    sync_sqlite(live_articles, authors, tags, media)
    print(f"Kész: {len(all_articles)} cikk, {len(authors)} szerző, {len(media)} média")


if __name__ == "__main__":
    main()
