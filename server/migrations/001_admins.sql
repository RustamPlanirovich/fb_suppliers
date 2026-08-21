-- Администраторы админки и журнал изменений.

CREATE TABLE admins (
  id            BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  email         TEXT NOT NULL UNIQUE,
  name          TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  role          TEXT NOT NULL DEFAULT 'moderator'
                CHECK (role IN ('owner', 'admin', 'moderator')),
  is_active     BOOLEAN NOT NULL DEFAULT TRUE,
  last_login_at TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- История изменений: кто, когда и что поменял в любой сущности.
CREATE TABLE audit_log (
  id          BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  admin_id    BIGINT REFERENCES admins (id) ON DELETE SET NULL,
  entity      TEXT NOT NULL,
  entity_id   BIGINT,
  action      TEXT NOT NULL,
  changes     JSONB NOT NULL DEFAULT '{}'::jsonb,
  comment     TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX audit_log_entity_idx ON audit_log (entity, entity_id, created_at DESC);
CREATE INDEX audit_log_admin_idx ON audit_log (admin_id, created_at DESC);
