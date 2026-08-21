-- Редактируемый контент бота и рассылки.

CREATE TABLE content_blocks (
  id         BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  key        TEXT NOT NULL UNIQUE,
  type       TEXT NOT NULL DEFAULT 'text'
             CHECK (type IN ('text', 'banner', 'button', 'notification', 'terms')),
  title      TEXT,
  body       TEXT NOT NULL DEFAULT '',
  media_url  TEXT,
  is_active  BOOLEAN NOT NULL DEFAULT TRUE,
  updated_by BIGINT REFERENCES admins (id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE faq_entries (
  id         BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  question   TEXT NOT NULL,
  answer     TEXT NOT NULL,
  sort_order INT NOT NULL DEFAULT 0,
  is_active  BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE broadcasts (
  id           BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  title        TEXT NOT NULL,
  body         TEXT NOT NULL,
  media_url    TEXT,
  buttons      JSONB NOT NULL DEFAULT '[]'::jsonb,
  segment      JSONB NOT NULL DEFAULT '{}'::jsonb,
  status       TEXT NOT NULL DEFAULT 'draft'
               CHECK (status IN ('draft', 'scheduled', 'sending', 'sent', 'cancelled', 'failed')),
  scheduled_at TIMESTAMPTZ,
  started_at   TIMESTAMPTZ,
  finished_at  TIMESTAMPTZ,
  total_count  INT NOT NULL DEFAULT 0,
  sent_count   INT NOT NULL DEFAULT 0,
  failed_count INT NOT NULL DEFAULT 0,
  created_by   BIGINT REFERENCES admins (id) ON DELETE SET NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX broadcasts_status_idx ON broadcasts (status, scheduled_at);

CREATE TABLE broadcast_deliveries (
  id           BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  broadcast_id BIGINT NOT NULL REFERENCES broadcasts (id) ON DELETE CASCADE,
  user_id      BIGINT NOT NULL REFERENCES bot_users (id) ON DELETE CASCADE,
  status       TEXT NOT NULL DEFAULT 'pending'
               CHECK (status IN ('pending', 'sent', 'failed', 'blocked')),
  error        TEXT,
  sent_at      TIMESTAMPTZ,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX broadcast_deliveries_uniq_idx ON broadcast_deliveries (broadcast_id, user_id);
CREATE INDEX broadcast_deliveries_status_idx ON broadcast_deliveries (broadcast_id, status);
