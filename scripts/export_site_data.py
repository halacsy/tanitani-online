#!/usr/bin/env python3
"""Export public Taní-tani content from the restored Drupal MariaDB dump.

The full dump remains the archival source. This script deliberately excludes
accounts, email addresses, password hashes, sessions, IP addresses and logs.
It writes a portable SQLite database plus build-friendly JSON files.
"""

from __future__ import annotations

import argparse
import base64
import html
import json
import os
import re
import shutil
import sqlite3
import subprocess
import tempfile
import unicodedata
from collections import defaultdict
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Iterable


ROOT = Path(__file__).resolve().parents[1]
SCHEMA_PATH = ROOT / "db" / "public-schema.sql"
DEFAULT_DB_PATH = ROOT / "data" / "tanitani-public.sqlite"
DEFAULT_JSON_PATH = ROOT / "content" / "migrated" / "tanitani"
CONTAINER = "tanitani-recovery"
DATABASE = "tanitani"
KNOWN_MISSING_PUBLIC_MEDIA = {
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


def b64_sql(expression: str) -> str:
    return f"REPLACE(TO_BASE64(COALESCE({expression}, '')), CHAR(10), '')"


def decode_b64(value: str) -> str:
    if not value:
        return ""
    return base64.b64decode(value).decode("utf-8", errors="replace")


def mysql_rows(query: str) -> list[list[str]]:
    command = [
        "docker", "exec", CONTAINER, "mariadb", "-uroot", "--batch",
        "--raw", "--skip-column-names", DATABASE, "-e", query,
    ]
    result = subprocess.run(command, check=True, capture_output=True, text=True)
    if not result.stdout:
        return []
    return [line.split("\t") for line in result.stdout.splitlines()]


def slugify(value: str, fallback: str) -> str:
    normalized = unicodedata.normalize("NFKD", value)
    ascii_value = normalized.encode("ascii", "ignore").decode("ascii")
    slug = re.sub(r"[^a-z0-9]+", "-", ascii_value.lower()).strip("-")
    return slug or fallback


def unique_slugs(items: Iterable[tuple[int, str]], prefix: str) -> dict[int, str]:
    result: dict[int, str] = {}
    claimed: dict[str, int] = {}
    for item_id, name in items:
        base = slugify(name, f"{prefix}-{item_id}")
        slug = base if base not in claimed else f"{base}-{item_id}"
        claimed[slug] = item_id
        result[item_id] = slug
    return result


def plain_text(value: str) -> str:
    text = re.sub(r"<script\b[^>]*>.*?</script>", " ", value, flags=re.I | re.S)
    text = re.sub(r"<style\b[^>]*>.*?</style>", " ", text, flags=re.I | re.S)
    text = re.sub(r"<[^>]+>", " ", text)
    return re.sub(r"\s+", " ", html.unescape(text)).strip()


def sanitize_public_html(value: str) -> str:
    """Remove executable legacy markup while preserving editorial formatting."""
    cleaned = value
    # Keep internal links and media independent from the legacy hostname.
    for old_origin in (
        "https://www.tani-tani.info",
        "http://www.tani-tani.info",
        "https://tani-tani.info",
        "http://tani-tani.info",
    ):
        cleaned = cleaned.replace(f'href="{old_origin}/', 'href="/')
        cleaned = cleaned.replace(f"href='{old_origin}/", "href='/")
        cleaned = cleaned.replace(f'src="{old_origin}/', 'src="/')
        cleaned = cleaned.replace(f"src='{old_origin}/", "src='/")
    cleaned = re.sub(
        r"((?:href|src)\s*=\s*['\"])(/sites/default/files/[^'\"]*?)[ \t]+(['\"])",
        r"\1\2\3",
        cleaned,
        flags=re.I,
    )
    cleaned = re.sub(
        r"<script\b[^>]*>.*?</script\s*>", "", cleaned, flags=re.I | re.S,
    )
    cleaned = re.sub(
        r"<(?:object|embed)\b[^>]*>.*?</(?:object|embed)\s*>",
        "",
        cleaned,
        flags=re.I | re.S,
    )
    cleaned = re.sub(r"<(?:object|embed)\b[^>]*/?>", "", cleaned, flags=re.I)
    cleaned = re.sub(
        r"\s+on[a-z]+\s*=\s*(?:\"[^\"]*\"|'[^']*'|[^\s>]+)",
        "",
        cleaned,
        flags=re.I,
    )
    cleaned = re.sub(
        r"\s+style\s*=\s*(?:\"[^\"]*(?:expression\s*\(|javascript\s*:)[^\"]*\"|'[^']*(?:expression\s*\(|javascript\s*:)[^']*')",
        "",
        cleaned,
        flags=re.I,
    )
    cleaned = re.sub(
        r"((?:href|src)\s*=\s*[\"'])\s*javascript:[^\"']*([\"'])",
        r"\1#\2",
        cleaned,
        flags=re.I,
    )
    for missing_path in KNOWN_MISSING_PUBLIC_MEDIA:
        cleaned = re.sub(
            rf"<img\b[^>]*\bsrc\s*=\s*([\"']){re.escape(missing_path)}\1[^>]*>",
            "",
            cleaned,
            flags=re.I,
        )
    return cleaned


def make_excerpt(summary_html: str, body_html: str, limit: int = 320) -> str:
    source = summary_html.strip()
    if not source:
        source = re.split(r"<!--\s*break\s*-->", body_html, maxsplit=1, flags=re.I)[0]
    text = plain_text(source)
    if len(text) <= limit:
        return text
    shortened = text[: limit + 1].rsplit(" ", 1)[0].rstrip(" ,;:-")
    return f"{shortened}…"


def public_path(uri: str) -> str:
    if uri.startswith("public://"):
        return "/sites/default/files/" + uri.removeprefix("public://").lstrip("/")
    if uri.startswith("sites/"):
        return "/" + uri
    return uri


def iso_date(timestamp: int) -> str:
    return datetime.fromtimestamp(timestamp, timezone.utc).date().isoformat()


def write_json(path: Path, value: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(
        json.dumps(value, ensure_ascii=False, indent=2, sort_keys=False) + "\n",
        encoding="utf-8",
    )


def fetch_terms(vocabulary_id: int) -> list[dict[str, Any]]:
    rows = mysql_rows(
        f"""
        SELECT tid, {b64_sql('name')}, {b64_sql('description')}, weight
        FROM taxonomy_term_data
        WHERE vid = {vocabulary_id}
        ORDER BY weight, name, tid
        """
    )
    return [
        {
            "id": int(row[0]),
            "name": decode_b64(row[1]),
            "descriptionHtml": sanitize_public_html(decode_b64(row[2])),
            "weight": int(row[3]),
        }
        for row in rows
    ]


def fetch_articles() -> list[dict[str, Any]]:
    alias_expression = """
      COALESCE(
        (SELECT ua.alias FROM url_alias ua
         WHERE ua.source = CONCAT('node/', n.nid)
         ORDER BY CASE WHEN ua.language = 'hu' THEN 0 ELSE 1 END, ua.pid DESC
         LIMIT 1),
        CONCAT('node-', n.nid)
      )
    """
    rows = mysql_rows(
        f"""
        SELECT n.nid, {b64_sql(alias_expression)}, {b64_sql('n.type')},
          {b64_sql('n.title')}, n.created, n.changed,
          {b64_sql('b.body_value')}, {b64_sql('b.body_summary')},
          {b64_sql('b.body_format')}, COALESCE(nc.totalcount, 0),
          COALESCE(fi.field_image_fid, 0), {b64_sql('fm.uri')},
          {b64_sql('fi.field_image_alt')}, {b64_sql('fi.field_image_title')},
          {b64_sql('legacy.field_ev_value')},
          COALESCE(legacy.field_lapszam_value, 0),
          {b64_sql('legacy.field_oldal_value')}
        FROM node n
        JOIN field_data_body b
          ON b.entity_type = 'node' AND b.entity_id = n.nid
         AND b.deleted = 0 AND b.delta = 0
        LEFT JOIN node_counter nc ON nc.nid = n.nid
        LEFT JOIN field_data_field_image fi
          ON fi.entity_type = 'node' AND fi.entity_id = n.nid
         AND fi.deleted = 0 AND fi.delta = 0
        LEFT JOIN file_managed fm ON fm.fid = fi.field_image_fid
        LEFT JOIN content_type_cikk legacy ON legacy.nid = n.nid
        WHERE n.status = 1 AND n.type IN ('poszt', 'cikk')
        ORDER BY n.created DESC, n.nid DESC
        """
    )
    articles: list[dict[str, Any]] = []
    for row in rows:
        body_html = sanitize_public_html(decode_b64(row[6]))
        summary_html = sanitize_public_html(decode_b64(row[7]))
        articles.append(
            {
                "id": int(row[0]),
                "slug": decode_b64(row[1]),
                "contentType": decode_b64(row[2]),
                "title": decode_b64(row[3]),
                "publishedAt": int(row[4]),
                "updatedAt": int(row[5]),
                "bodyHtml": body_html,
                "summaryHtml": summary_html,
                "bodyFormat": decode_b64(row[8]),
                "excerpt": make_excerpt(summary_html, body_html),
                "reads": int(row[9]),
                "coverMediaId": int(row[10]),
                "coverImage": public_path(decode_b64(row[11])),
                "coverAlt": decode_b64(row[12]),
                "coverTitle": decode_b64(row[13]),
                "issueYear": decode_b64(row[14]),
                "issueNumber": int(row[15]) or None,
                "issuePage": decode_b64(row[16]),
            }
        )
    return articles


def fetch_relation(table: str, term_column: str) -> list[tuple[int, int, int]]:
    rows = mysql_rows(
        f"""
        SELECT f.entity_id, f.{term_column}, f.delta
        FROM {table} f
        JOIN node n ON n.nid = f.entity_id
        WHERE f.entity_type = 'node' AND f.deleted = 0
          AND n.status = 1 AND n.type IN ('poszt', 'cikk')
        ORDER BY f.entity_id, f.delta
        """
    )
    return [(int(row[0]), int(row[1]), int(row[2])) for row in rows]


def fetch_media() -> list[dict[str, Any]]:
    rows = mysql_rows(
        f"""
        SELECT fid, {b64_sql('filename')}, {b64_sql('uri')},
               {b64_sql('filemime')}, filesize, timestamp
        FROM file_managed WHERE status = 1 ORDER BY fid
        """
    )
    media = []
    for row in rows:
        uri = decode_b64(row[2])
        media.append(
            {
                "id": int(row[0]),
                "filename": decode_b64(row[1]),
                "uri": uri,
                "publicPath": public_path(uri),
                "mimeType": decode_b64(row[3]),
                "byteSize": int(row[4]),
                "createdAt": int(row[5]),
            }
        )
    return media


def fetch_attachments() -> list[dict[str, Any]]:
    rows = mysql_rows(
        f"""
        SELECT u.entity_id, u.upload_fid, u.delta,
               {b64_sql('u.upload_description')}, u.upload_display
        FROM field_data_upload u
        JOIN node n ON n.nid = u.entity_id
        WHERE u.entity_type = 'node' AND u.deleted = 0
          AND n.status = 1 AND n.type IN ('poszt', 'cikk')
        ORDER BY u.entity_id, u.delta
        """
    )
    return [
        {
            "articleId": int(row[0]),
            "mediaId": int(row[1]),
            "position": int(row[2]),
            "description": decode_b64(row[3]),
            "visible": int(row[4]) == 1,
        }
        for row in rows
    ]


def fetch_comments() -> list[dict[str, Any]]:
    author_expression = "COALESCE(NULLIF(c.name, ''), NULLIF(u.name, ''), 'Névtelen')"
    rows = mysql_rows(
        f"""
        SELECT c.cid, c.pid, c.nid, {b64_sql(author_expression)},
               {b64_sql('c.subject')}, {b64_sql('cb.comment_body_value')},
               c.created, {b64_sql('c.thread')}
        FROM comment c
        JOIN node n ON n.nid = c.nid
        JOIN field_data_comment_body cb
          ON cb.entity_type = 'comment' AND cb.entity_id = c.cid
         AND cb.deleted = 0 AND cb.delta = 0
        LEFT JOIN users u ON u.uid = c.uid
        WHERE c.status = 1 AND n.status = 1
          AND n.type IN ('poszt', 'cikk')
        ORDER BY c.nid, c.thread, c.created, c.cid
        """
    )
    return [
        {
            "id": int(row[0]),
            "parentId": int(row[1]) or None,
            "articleId": int(row[2]),
            "authorName": decode_b64(row[3]),
            "subject": decode_b64(row[4]),
            "bodyHtml": sanitize_public_html(decode_b64(row[5])),
            "publishedAt": int(row[6]),
            "threadPath": decode_b64(row[7]),
        }
        for row in rows
    ]


def fetch_pages() -> list[dict[str, Any]]:
    alias_expression = """
      COALESCE(
        (SELECT ua.alias FROM url_alias ua
         WHERE ua.source = CONCAT('node/', n.nid)
         ORDER BY CASE WHEN ua.language = 'hu' THEN 0 ELSE 1 END, ua.pid DESC
         LIMIT 1),
        CONCAT('node-', n.nid)
      )
    """
    rows = mysql_rows(
        f"""
        SELECT n.nid, {b64_sql(alias_expression)}, {b64_sql('n.type')},
               {b64_sql('n.title')}, {b64_sql('b.body_value')},
               {b64_sql('b.body_summary')}, n.created, n.changed
        FROM node n
        JOIN field_data_body b
          ON b.entity_type = 'node' AND b.entity_id = n.nid
         AND b.deleted = 0 AND b.delta = 0
        WHERE n.status = 1
          AND n.type IN ('page', 'story', 'blog', 'sajtohir', 'forum')
        ORDER BY n.created DESC, n.nid DESC
        """
    )
    return [
        {
            "id": int(row[0]),
            "slug": decode_b64(row[1]),
            "contentType": decode_b64(row[2]),
            "title": decode_b64(row[3]),
            "bodyHtml": sanitize_public_html(decode_b64(row[4])),
            "summaryHtml": sanitize_public_html(decode_b64(row[5])),
            "publishedAt": int(row[6]),
            "updatedAt": int(row[7]),
        }
        for row in rows
    ]


def build_export(db_path: Path, json_path: Path) -> dict[str, int]:
    authors = fetch_terms(4)
    tags = fetch_terms(5)
    sections = fetch_terms(2)
    articles = fetch_articles()
    media = fetch_media()
    attachments = fetch_attachments()
    comments = fetch_comments()
    pages = fetch_pages()

    author_slugs = unique_slugs(((x["id"], x["name"]) for x in authors), "szerzo")
    tag_slugs = unique_slugs(((x["id"], x["name"]) for x in tags), "tema")
    section_slugs = unique_slugs(((x["id"], x["name"]) for x in sections), "rovat")
    for item in authors:
        item["slug"] = author_slugs[item["id"]]
    for item in tags:
        item["slug"] = tag_slugs[item["id"]]
    for item in sections:
        item["slug"] = section_slugs[item["id"]]

    article_authors = fetch_relation(
        "field_data_taxonomy_vocabulary_4", "taxonomy_vocabulary_4_tid"
    )
    article_tags = fetch_relation(
        "field_data_taxonomy_vocabulary_5", "taxonomy_vocabulary_5_tid"
    )
    article_sections = fetch_relation(
        "field_data_taxonomy_vocabulary_2", "taxonomy_vocabulary_2_tid"
    )

    article_ids = {article["id"] for article in articles}
    media_ids = {item["id"] for item in media}
    author_ids = {item["id"] for item in authors}
    tag_ids = {item["id"] for item in tags}
    section_ids = {item["id"] for item in sections}

    article_authors = [x for x in article_authors if x[0] in article_ids and x[1] in author_ids]
    article_tags = [x for x in article_tags if x[0] in article_ids and x[1] in tag_ids]
    article_sections = [x for x in article_sections if x[0] in article_ids and x[1] in section_ids]
    attachments = [
        x for x in attachments
        if x["articleId"] in article_ids and x["mediaId"] in media_ids
    ]
    comments = [x for x in comments if x["articleId"] in article_ids]

    author_links: dict[int, list[tuple[int, int]]] = defaultdict(list)
    tag_links: dict[int, list[tuple[int, int]]] = defaultdict(list)
    section_links: dict[int, list[tuple[int, int]]] = defaultdict(list)
    for article_id, term_id, position in article_authors:
        author_links[article_id].append((position, term_id))
    for article_id, term_id, position in article_tags:
        tag_links[article_id].append((position, term_id))
    for article_id, term_id, position in article_sections:
        section_links[article_id].append((position, term_id))

    author_by_id = {x["id"]: x for x in authors}
    tag_by_id = {x["id"]: x for x in tags}
    section_by_id = {x["id"]: x for x in sections}
    media_by_id = {x["id"]: x for x in media}
    attachments_by_article: dict[int, list[dict[str, Any]]] = defaultdict(list)
    comments_by_article: dict[int, list[dict[str, Any]]] = defaultdict(list)
    for item in attachments:
        linked = dict(item)
        linked["media"] = media_by_id[item["mediaId"]]
        attachments_by_article[item["articleId"]].append(linked)
    for item in comments:
        comments_by_article[item["articleId"]].append(item)

    author_counts: dict[int, int] = defaultdict(int)
    tag_counts: dict[int, int] = defaultdict(int)
    section_counts: dict[int, int] = defaultdict(int)
    for _, author_id, _ in article_authors:
        author_counts[author_id] += 1
    for _, tag_id, _ in article_tags:
        tag_counts[tag_id] += 1
    for _, section_id, _ in article_sections:
        section_counts[section_id] += 1
    for item in authors:
        item["articleCount"] = author_counts[item["id"]]
    for item in tags:
        item["articleCount"] = tag_counts[item["id"]]
    for item in sections:
        item["articleCount"] = section_counts[item["id"]]

    if db_path.exists():
        db_path.unlink()
    db_path.parent.mkdir(parents=True, exist_ok=True)
    connection = sqlite3.connect(db_path)
    try:
        connection.executescript(SCHEMA_PATH.read_text(encoding="utf-8"))
        connection.executemany(
            "INSERT INTO metadata(key, value) VALUES (?, ?)",
            [
                ("source", "Drupal 7 / MariaDB 10.11"),
                ("source_dump", "tanitani.sql"),
                ("source_dump_completed_at", "2026-05-05T19:27:53Z"),
                ("exported_at", datetime.now(timezone.utc).isoformat()),
                ("privacy", "public content only; accounts and operational logs excluded"),
            ],
        )
        connection.executemany(
            "INSERT INTO authors(id, slug, name, bio_html, article_count) VALUES (?, ?, ?, ?, ?)",
            [(x["id"], x["slug"], x["name"], x["descriptionHtml"], x["articleCount"]) for x in authors],
        )
        connection.executemany(
            "INSERT INTO tags(id, slug, name, description_html, article_count) VALUES (?, ?, ?, ?, ?)",
            [(x["id"], x["slug"], x["name"], x["descriptionHtml"], x["articleCount"]) for x in tags],
        )
        connection.executemany(
            "INSERT INTO sections(id, slug, name, description_html, article_count) VALUES (?, ?, ?, ?, ?)",
            [(x["id"], x["slug"], x["name"], x["descriptionHtml"], x["articleCount"]) for x in sections],
        )
        connection.executemany(
            """
            INSERT INTO articles(
              id, slug, content_type, title, body_html, summary_html, excerpt,
              published_at, updated_at, read_count, cover_uri, cover_alt,
              cover_title, issue_year, issue_number, issue_page, comment_count
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            [
                (
                    x["id"], x["slug"], x["contentType"], x["title"], x["bodyHtml"],
                    x["summaryHtml"], x["excerpt"], x["publishedAt"], x["updatedAt"],
                    x["reads"], x["coverImage"], x["coverAlt"], x["coverTitle"],
                    x["issueYear"], x["issueNumber"], x["issuePage"],
                    len(comments_by_article[x["id"]]),
                )
                for x in articles
            ],
        )
        connection.executemany(
            "INSERT INTO article_authors(article_id, author_id, position) VALUES (?, ?, ?)",
            article_authors,
        )
        connection.executemany(
            "INSERT INTO article_tags(article_id, tag_id, position) VALUES (?, ?, ?)",
            article_tags,
        )
        connection.executemany(
            "INSERT INTO article_sections(article_id, section_id, position) VALUES (?, ?, ?)",
            article_sections,
        )
        connection.executemany(
            "INSERT INTO media(id, filename, uri, public_path, mime_type, byte_size, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
            [(x["id"], x["filename"], x["uri"], x["publicPath"], x["mimeType"], x["byteSize"], x["createdAt"]) for x in media],
        )
        connection.executemany(
            "INSERT INTO attachments(article_id, media_id, position, description, is_visible) VALUES (?, ?, ?, ?, ?)",
            [(x["articleId"], x["mediaId"], x["position"], x["description"], int(x["visible"])) for x in attachments],
        )
        connection.executemany(
            "INSERT INTO comments(id, article_id, parent_id, author_name, subject, body_html, published_at, thread_path) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
            [(x["id"], x["articleId"], x["parentId"], x["authorName"], x["subject"], x["bodyHtml"], x["publishedAt"], x["threadPath"]) for x in comments],
        )
        connection.executemany(
            "INSERT INTO pages(id, slug, content_type, title, body_html, summary_html, published_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
            [(x["id"], x["slug"], x["contentType"], x["title"], x["bodyHtml"], x["summaryHtml"], x["publishedAt"], x["updatedAt"]) for x in pages],
        )

        redirects = []
        for article in articles:
            target = f"/cikkek/{article['slug']}"
            redirects.extend(
                [
                    (f"/{article['slug']}", target, "legacy_alias"),
                    (f"/node/{article['id']}", target, "drupal_node"),
                ]
            )
        for page in pages:
            target = f"/archivum/{page['slug']}"
            redirects.extend(
                [
                    (f"/{page['slug']}", target, "legacy_alias"),
                    (f"/node/{page['id']}", target, "drupal_node"),
                ]
            )
        connection.executemany(
            "INSERT OR IGNORE INTO redirects(source_path, target_path, source_kind) VALUES (?, ?, ?)",
            redirects,
        )
        connection.execute("PRAGMA optimize")
        connection.commit()
    finally:
        connection.close()

    temporary_parent = json_path.parent
    temporary_parent.mkdir(parents=True, exist_ok=True)
    temporary_dir = Path(tempfile.mkdtemp(prefix="tanitani-export-", dir=temporary_parent))
    try:
        article_index = []
        for article in articles:
            article_id = article["id"]
            article_author_items = [
                author_by_id[term_id]
                for _, term_id in sorted(author_links[article_id])
                if term_id in author_by_id
            ]
            article_tag_items = [
                tag_by_id[term_id]
                for _, term_id in sorted(tag_links[article_id])
                if term_id in tag_by_id
            ]
            article_section_items = [
                section_by_id[term_id]
                for _, term_id in sorted(section_links[article_id])
                if term_id in section_by_id
            ]
            metadata = {
                "id": article_id,
                "slug": article["slug"],
                "contentType": article["contentType"],
                "title": article["title"],
                "authors": [
                    {"id": x["id"], "slug": x["slug"], "name": x["name"]}
                    for x in article_author_items
                ],
                "publishedAt": article["publishedAt"],
                "date": iso_date(article["publishedAt"]),
                "updatedAt": article["updatedAt"],
                "tags": [
                    {"id": x["id"], "slug": x["slug"], "name": x["name"]}
                    for x in article_tag_items
                ],
                "sections": [
                    {"id": x["id"], "slug": x["slug"], "name": x["name"]}
                    for x in article_section_items
                ],
                "excerpt": article["excerpt"],
                "coverImage": article["coverImage"],
                "coverAlt": article["coverAlt"],
                "coverTitle": article["coverTitle"],
                "reads": article["reads"],
                "commentCount": len(comments_by_article[article_id]),
                "issueYear": article["issueYear"],
                "issueNumber": article["issueNumber"],
                "issuePage": article["issuePage"],
            }
            article_index.append(metadata)
            write_json(
                temporary_dir / "articles" / f"{article_id}.json",
                {
                    **metadata,
                    "summaryHtml": article["summaryHtml"],
                    "bodyHtml": article["bodyHtml"],
                    "attachments": attachments_by_article[article_id],
                    "comments": comments_by_article[article_id],
                },
            )

        write_json(temporary_dir / "articles.json", article_index)
        write_json(temporary_dir / "authors.json", authors)
        write_json(temporary_dir / "tags.json", tags)
        write_json(temporary_dir / "sections.json", sections)
        write_json(temporary_dir / "pages.json", pages)
        write_json(temporary_dir / "media.json", media)
        write_json(
            temporary_dir / "manifest.json",
            {
                "sourceDump": "tanitani.sql",
                "sourceDumpCompletedAt": "2026-05-05T19:27:53Z",
                "privacy": "Public content only; accounts and operational logs excluded.",
                "counts": {
                    "articles": len(articles),
                    "authors": len(authors),
                    "tags": len(tags),
                    "sections": len(sections),
                    "comments": len(comments),
                    "pages": len(pages),
                    "media": len(media),
                    "attachments": len(attachments),
                },
            },
        )
        if json_path.exists():
            shutil.rmtree(json_path)
        os.replace(temporary_dir, json_path)
    except Exception:
        shutil.rmtree(temporary_dir, ignore_errors=True)
        raise

    return {
        "articles": len(articles),
        "authors": len(authors),
        "tags": len(tags),
        "sections": len(sections),
        "comments": len(comments),
        "pages": len(pages),
        "media": len(media),
        "attachments": len(attachments),
    }


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser()
    parser.add_argument("--database", type=Path, default=DEFAULT_DB_PATH)
    parser.add_argument("--json", type=Path, default=DEFAULT_JSON_PATH)
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    counts = build_export(args.database.resolve(), args.json.resolve())
    print(json.dumps(counts, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
