-- Пользователи бота, избранное, watchlist и события. Собираем только необходимый минимум.

CREATE TABLE bot_users (
  id           BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  telegram_id  BIGINT NOT NULL UNIQUE,
  username     TEXT,
  language     TEXT NOT NULL DEFAULT 'ru',
  is_blocked   BOOLEAN NOT NULL DEFAULT FALSE,
  blocked_note TEXT,
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX bot_users_last_seen_idx ON bot_users (last_seen_at DESC);

-- Избранные поставщики.
CREATE TABLE favorites (
  user_id     BIGINT NOT NULL REFERENCES bot_users (id) ON DELETE CASCADE,
  supplier_id BIGINT NOT NULL REFERENCES suppliers (id) ON DELETE CASCADE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, supplier_id)
);

CREATE INDEX favorites_supplier_idx ON favorites (supplier_id);

-- Watchlist: отслеживаемые товарные позиции пользователя.
CREATE TABLE watchlist (
  id         BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id    BIGINT NOT NULL REFERENCES bot_users (id) ON DELETE CASCADE,
  variant_id BIGINT NOT NULL REFERENCES product_variants (id) ON DELETE CASCADE,
  note       TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX watchlist_uniq_idx ON watchlist (user_id, variant_id);

CREATE TABLE bot_events (
  id          BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id     BIGINT REFERENCES bot_users (id) ON DELETE SET NULL,
  type        TEXT NOT NULL,
  supplier_id BIGINT REFERENCES suppliers (id) ON DELETE SET NULL,
  variant_id  BIGINT REFERENCES product_variants (id) ON DELETE SET NULL,
  payload     JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX bot_events_type_idx ON bot_events (type, created_at DESC);
CREATE INDEX bot_events_user_idx ON bot_events (user_id, created_at DESC);
CREATE INDEX bot_events_variant_idx ON bot_events (variant_id, type, created_at DESC);

CREATE TABLE search_queries (
  id            BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id       BIGINT REFERENCES bot_users (id) ON DELETE SET NULL,
  query         TEXT NOT NULL,
  query_norm    TEXT NOT NULL,
  category_id   BIGINT REFERENCES categories (id) ON DELETE SET NULL,
  results_count INT NOT NULL DEFAULT 0,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX search_queries_norm_idx ON search_queries (query_norm, created_at DESC);
CREATE INDEX search_queries_empty_idx ON search_queries (created_at DESC) WHERE results_count = 0;
