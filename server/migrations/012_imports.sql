-- Задания импорта Excel/CSV: предпросмотр с сопоставлением колонок → применение.

CREATE TABLE import_jobs (
  id           BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  admin_id     BIGINT REFERENCES admins (id) ON DELETE SET NULL,
  filename     TEXT NOT NULL,
  target       TEXT NOT NULL DEFAULT 'suppliers'
               CHECK (target IN ('suppliers', 'offers')),
  status       TEXT NOT NULL DEFAULT 'preview'
               CHECK (status IN ('preview', 'applied', 'cancelled', 'failed')),
  mapping      JSONB NOT NULL DEFAULT '{}'::jsonb,
  rows_total   INT NOT NULL DEFAULT 0,
  rows_created INT NOT NULL DEFAULT 0,
  rows_updated INT NOT NULL DEFAULT 0,
  rows_skipped INT NOT NULL DEFAULT 0,
  error        TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  applied_at   TIMESTAMPTZ
);

CREATE INDEX import_jobs_admin_idx ON import_jobs (admin_id, created_at DESC);
