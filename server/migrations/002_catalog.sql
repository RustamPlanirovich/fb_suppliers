-- Дерево категорий и теги.

CREATE TABLE categories (
  id         BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  parent_id  BIGINT REFERENCES categories (id) ON DELETE CASCADE,
  name       TEXT NOT NULL,
  slug       TEXT NOT NULL UNIQUE,
  path       TEXT NOT NULL DEFAULT '',
  depth      INT NOT NULL DEFAULT 0,
  sort_order INT NOT NULL DEFAULT 0,
  is_active  BOOLEAN NOT NULL DEFAULT TRUE,
  funpay_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX categories_parent_idx ON categories (parent_id, sort_order);
CREATE INDEX categories_path_idx ON categories (path);

CREATE TABLE tags (
  id         BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  name       TEXT NOT NULL,
  slug       TEXT NOT NULL UNIQUE,
  color      TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
