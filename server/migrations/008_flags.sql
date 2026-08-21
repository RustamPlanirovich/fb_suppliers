-- Автоматические флаги контроля данных: очередь «что разгрести» для админа.

CREATE TABLE data_flags (
  id          BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  entity      TEXT NOT NULL CHECK (entity IN ('supplier', 'offer', 'variant')),
  entity_id   BIGINT NOT NULL,
  type        TEXT NOT NULL
              CHECK (type IN ('price_spike_up', 'price_spike_down', 'price_stale',
                              'offer_removed', 'source_unreachable', 'price_anomaly',
                              'supplier_stale_check', 'many_complaints', 'broken_link')),
  severity    TEXT NOT NULL DEFAULT 'warning' CHECK (severity IN ('info', 'warning', 'critical')),
  details     JSONB NOT NULL DEFAULT '{}'::jsonb,
  status      TEXT NOT NULL DEFAULT 'open'
              CHECK (status IN ('open', 'resolved', 'ignored')),
  resolved_by BIGINT REFERENCES admins (id) ON DELETE SET NULL,
  resolved_at TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX data_flags_open_uniq_idx
  ON data_flags (entity, entity_id, type) WHERE status = 'open';
CREATE INDEX data_flags_status_idx ON data_flags (status, severity, created_at DESC);
