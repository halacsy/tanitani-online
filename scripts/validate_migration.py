#!/usr/bin/env python3
"""Fail-fast integrity, privacy and media checks for the public migration."""

from __future__ import annotations

import json
import re
import sqlite3
import sys
import urllib.parse
from pathlib import Path
from typing import Any, Iterable


ROOT = Path(__file__).resolve().parents[1]
CONTENT_DIR = ROOT / "content" / "migrated" / "tanitani"
ARTICLE_DIR = CONTENT_DIR / "articles"
SQLITE_PATH = ROOT / "data" / "tanitani-public.sqlite"
PUBLIC_DIR = ROOT / "public"
KNOWN_UNAVAILABLE_MEDIA = {
    "/sites/default/files/lrn1.jpg",
    "/sites/default/files/7-w470.jpg",
    "/sites/default/files/csotai_heni.jpg",
    "/sites/default/files/dagaszto_470.png",
    "/sites/default/files/radio_470.png",
    "/sites/default/files/czenner_julia.jpg",
    "/sites/default/files/pictures/picture-18667-1656748429.gif",
    "/sites/default/files/pictures/picture-18668-1656748535.gif",
    "/sites/default/files/pictures/picture-18669-1656753316.gif",
}
FORBIDDEN_KEYS = {
    "email", "mail", "password", "pass", "password_hash", "hostname",
    "ip", "ip_address", "session", "session_id",
}
UNSAFE_HTML = re.compile(
    r"<\s*(?:script|object|embed)\b|\son[a-z]+\s*=|(?:href|src|style)\s*=\s*['\"][^'\"]*(?:javascript:|expression\s*\()",
    flags=re.I,
)
LEGACY_INTERNAL_ATTRIBUTE = re.compile(
    r"(?:href|src)\s*=\s*['\"]https?://(?:www\.)?tani-tani\.info/",
    flags=re.I,
)
LOCAL_MEDIA_ATTRIBUTE = re.compile(
    r"(?:href|src)\s*=\s*['\"](/sites/default/files/[^'\"?#]+)",
    flags=re.I,
)


def load_json(name: str) -> Any:
    return json.loads((CONTENT_DIR / name).read_text(encoding="utf-8"))


def nested_keys(value: Any) -> Iterable[str]:
    if isinstance(value, dict):
        for key, child in value.items():
            yield key.lower()
            yield from nested_keys(child)
    elif isinstance(value, list):
        for child in value:
            yield from nested_keys(child)


def main() -> None:
    failures: list[str] = []
    articles = load_json("articles.json")
    authors = load_json("authors.json")
    tags = load_json("tags.json")
    sections = load_json("sections.json")
    pages = load_json("pages.json")
    media = load_json("media.json")
    manifest = load_json("manifest.json")

    collections = {
        "articles": articles,
        "authors": authors,
        "tags": tags,
        "sections": sections,
        "pages": pages,
        "media": media,
    }
    for name, collection in collections.items():
        ids = [item["id"] for item in collection]
        if len(ids) != len(set(ids)):
            failures.append(f"Duplikált azonosító: {name}")
        if manifest["counts"].get(name) != len(collection):
            failures.append(
                f"Manifest eltérés ({name}): {manifest['counts'].get(name)} != {len(collection)}"
            )

    slugs = [article["slug"] for article in articles]
    if len(slugs) != len(set(slugs)):
        failures.append("Duplikált cikkslug")
    if any(not slug or "/" in slug for slug in slugs):
        failures.append("Üres vagy útvonalat tartalmazó cikkslug")
    if any(not article["title"].strip() or not article["authors"] for article in articles):
        failures.append("Cím vagy szerző nélküli cikk")

    author_ids = {author["id"] for author in authors}
    tag_ids = {tag["id"] for tag in tags}
    section_ids = {section["id"] for section in sections}
    article_ids = {article["id"] for article in articles}
    if any(ref["id"] not in author_ids for article in articles for ref in article["authors"]):
        failures.append("Árva cikk–szerző kapcsolat")
    if any(ref["id"] not in tag_ids for article in articles for ref in article["tags"]):
        failures.append("Árva cikk–címke kapcsolat")
    if any(ref["id"] not in section_ids for article in articles for ref in article["sections"]):
        failures.append("Árva cikk–rovat kapcsolat")

    full_paths = list(ARTICLE_DIR.glob("*.json"))
    full_ids = {int(path.stem) for path in full_paths}
    if full_ids != article_ids:
        failures.append(
            f"Teljes cikkfájlok eltérése: hiány={len(article_ids - full_ids)}, extra={len(full_ids - article_ids)}"
        )

    referenced_media: set[str] = set()
    comment_count = 0
    attachment_count = 0
    for article in articles:
        full = json.loads((ARTICLE_DIR / f"{article['id']}.json").read_text(encoding="utf-8"))
        if full["slug"] != article["slug"] or full["title"] != article["title"]:
            failures.append(f"Index/teljes cikk eltérés: {article['id']}")
        body_parts = [full.get("summaryHtml", ""), full.get("bodyHtml", "")]
        body_parts.extend(comment.get("bodyHtml", "") for comment in full.get("comments", []))
        combined_html = "\n".join(body_parts)
        if UNSAFE_HTML.search(combined_html):
            failures.append(f"Végrehajtható HTML maradt a cikkben: {article['id']}")
        if LEGACY_INTERNAL_ATTRIBUTE.search(combined_html):
            failures.append(f"Régi domainhez kötött belső link maradt: {article['id']}")
        referenced_media.update(LOCAL_MEDIA_ATTRIBUTE.findall(combined_html))
        if article.get("coverImage", "").startswith("/sites/default/files/"):
            referenced_media.add(article["coverImage"])
        comment_count += len(full.get("comments", []))
        attachment_count += len(full.get("attachments", []))
        if article["commentCount"] != len(full.get("comments", [])):
            failures.append(f"Hozzászólásszám eltérés: {article['id']}")
        forbidden = FORBIDDEN_KEYS.intersection(nested_keys(full))
        if forbidden:
            failures.append(f"Privát kulcs a cikkexportban ({article['id']}): {sorted(forbidden)}")

    for page in pages:
        page_html = "\n".join((page.get("summaryHtml", ""), page.get("bodyHtml", "")))
        if UNSAFE_HTML.search(page_html):
            failures.append(f"Végrehajtható HTML maradt az archív oldalon: {page['id']}")
        if LEGACY_INTERNAL_ATTRIBUTE.search(page_html):
            failures.append(f"Régi domainhez kötött link maradt az archív oldalon: {page['id']}")
        referenced_media.update(LOCAL_MEDIA_ATTRIBUTE.findall(page_html))

    def referenced_file_exists(public_path: str) -> bool:
        literal = PUBLIC_DIR / public_path.lstrip("/")
        if literal.is_file():
            return True
        decoded = PUBLIC_DIR / urllib.parse.unquote(public_path).lstrip("/")
        return decoded.is_file()

    missing_referenced = sorted(path for path in referenced_media if not referenced_file_exists(path))
    if missing_referenced:
        failures.append(f"Hiányzó, ténylegesen hivatkozott média: {missing_referenced[:10]}")

    missing_catalog = {
        entry["publicPath"]
        for entry in media
        if not (PUBLIC_DIR / entry["publicPath"].lstrip("/")).is_file()
    }
    if missing_catalog != KNOWN_UNAVAILABLE_MEDIA:
        failures.append(
            f"Váratlan médiakatalógus-eltérés: hiány={sorted(missing_catalog)}, elvárt={sorted(KNOWN_UNAVAILABLE_MEDIA)}"
        )

    connection = sqlite3.connect(SQLITE_PATH)
    try:
        integrity = connection.execute("PRAGMA integrity_check").fetchone()[0]
        if integrity != "ok":
            failures.append(f"SQLite integrity_check: {integrity}")
        expected_counts = {
            "articles": len(articles),
            "authors": len(authors),
            "tags": len(tags),
            "sections": len(sections),
            "pages": len(pages),
            "media": len(media),
            "comments": comment_count,
            "attachments": attachment_count,
        }
        for table, expected in expected_counts.items():
            actual = connection.execute(f"SELECT COUNT(*) FROM {table}").fetchone()[0]
            if actual != expected:
                failures.append(f"SQLite darabszám ({table}): {actual} != {expected}")
        table_names = {
            row[0]
            for row in connection.execute("SELECT name FROM sqlite_master WHERE type = 'table'")
        }
        forbidden_tables = table_names.intersection({"users", "sessions", "watchdog", "accesslog"})
        if forbidden_tables:
            failures.append(f"Privát Drupal-tábla került az SQLite exportba: {sorted(forbidden_tables)}")
        orphan_queries = {
            "article_authors": "SELECT COUNT(*) FROM article_authors aa LEFT JOIN articles a ON a.id=aa.article_id LEFT JOIN authors u ON u.id=aa.author_id WHERE a.id IS NULL OR u.id IS NULL",
            "article_tags": "SELECT COUNT(*) FROM article_tags x LEFT JOIN articles a ON a.id=x.article_id LEFT JOIN tags t ON t.id=x.tag_id WHERE a.id IS NULL OR t.id IS NULL",
            "article_sections": "SELECT COUNT(*) FROM article_sections x LEFT JOIN articles a ON a.id=x.article_id LEFT JOIN sections s ON s.id=x.section_id WHERE a.id IS NULL OR s.id IS NULL",
            "comments": "SELECT COUNT(*) FROM comments c LEFT JOIN articles a ON a.id=c.article_id WHERE a.id IS NULL",
        }
        for relation, query in orphan_queries.items():
            if connection.execute(query).fetchone()[0]:
                failures.append(f"Árva SQLite-kapcsolat: {relation}")
    finally:
        connection.close()

    if failures:
        print("MIGRÁCIÓS ELLENŐRZÉS: HIBÁS")
        for failure in failures:
            print(f"- {failure}")
        sys.exit(1)

    print("MIGRÁCIÓS ELLENŐRZÉS: RENDBEN")
    print(f"- {len(articles)} cikk, {len(authors)} szerző, {len(tags)} témakör")
    print(f"- {len(pages)} archív oldal, {comment_count} hozzászólás, {attachment_count} csatolmány")
    print(f"- {len(media) - len(missing_catalog)}/{len(media)} médiabejegyzés helyben; a 9 régi 404 nincs tartalomban hivatkozva")
    print("- SQLite integritás, kapcsolatok, HTML-biztonság és privátadat-szűrés rendben")


if __name__ == "__main__":
    main()
