PRAGMA foreign_keys = ON;

CREATE TABLE metadata (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

CREATE TABLE authors (
  id INTEGER PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  bio_html TEXT NOT NULL DEFAULT '',
  article_count INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE tags (
  id INTEGER PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description_html TEXT NOT NULL DEFAULT '',
  article_count INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE sections (
  id INTEGER PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description_html TEXT NOT NULL DEFAULT '',
  article_count INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE articles (
  id INTEGER PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  content_type TEXT NOT NULL,
  title TEXT NOT NULL,
  body_html TEXT NOT NULL,
  summary_html TEXT NOT NULL DEFAULT '',
  excerpt TEXT NOT NULL DEFAULT '',
  published_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  read_count INTEGER NOT NULL DEFAULT 0,
  cover_uri TEXT NOT NULL DEFAULT '',
  cover_alt TEXT NOT NULL DEFAULT '',
  cover_title TEXT NOT NULL DEFAULT '',
  issue_year TEXT NOT NULL DEFAULT '',
  issue_number INTEGER,
  issue_page TEXT NOT NULL DEFAULT '',
  comment_count INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX idx_articles_published_at
ON articles(published_at DESC);

CREATE TABLE article_authors (
  article_id INTEGER NOT NULL REFERENCES articles(id) ON DELETE CASCADE,
  author_id INTEGER NOT NULL REFERENCES authors(id) ON DELETE CASCADE,
  position INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (article_id, author_id)
);

CREATE INDEX idx_article_authors_author_id
ON article_authors(author_id, article_id);

CREATE TABLE article_tags (
  article_id INTEGER NOT NULL REFERENCES articles(id) ON DELETE CASCADE,
  tag_id INTEGER NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
  position INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (article_id, tag_id)
);

CREATE INDEX idx_article_tags_tag_id
ON article_tags(tag_id, article_id);

CREATE TABLE article_sections (
  article_id INTEGER NOT NULL REFERENCES articles(id) ON DELETE CASCADE,
  section_id INTEGER NOT NULL REFERENCES sections(id) ON DELETE CASCADE,
  position INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (article_id, section_id)
);

CREATE INDEX idx_article_sections_section_id
ON article_sections(section_id, article_id);

CREATE TABLE media (
  id INTEGER PRIMARY KEY,
  filename TEXT NOT NULL,
  uri TEXT NOT NULL UNIQUE,
  public_path TEXT NOT NULL,
  mime_type TEXT NOT NULL DEFAULT '',
  byte_size INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE attachments (
  article_id INTEGER NOT NULL REFERENCES articles(id) ON DELETE CASCADE,
  media_id INTEGER NOT NULL REFERENCES media(id) ON DELETE CASCADE,
  position INTEGER NOT NULL DEFAULT 0,
  description TEXT NOT NULL DEFAULT '',
  is_visible INTEGER NOT NULL DEFAULT 1,
  PRIMARY KEY (article_id, media_id)
);

CREATE INDEX idx_attachments_media_id
ON attachments(media_id, article_id);

CREATE TABLE comments (
  id INTEGER PRIMARY KEY,
  article_id INTEGER NOT NULL REFERENCES articles(id) ON DELETE CASCADE,
  parent_id INTEGER,
  author_name TEXT NOT NULL,
  subject TEXT NOT NULL DEFAULT '',
  body_html TEXT NOT NULL,
  published_at INTEGER NOT NULL,
  thread_path TEXT NOT NULL DEFAULT ''
);

CREATE INDEX idx_comments_article_created
ON comments(article_id, published_at, id);

CREATE TABLE pages (
  id INTEGER PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  content_type TEXT NOT NULL,
  title TEXT NOT NULL,
  body_html TEXT NOT NULL,
  summary_html TEXT NOT NULL DEFAULT '',
  published_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE redirects (
  source_path TEXT PRIMARY KEY,
  target_path TEXT NOT NULL,
  source_kind TEXT NOT NULL
);

CREATE INDEX idx_redirects_target_path
ON redirects(target_path);
