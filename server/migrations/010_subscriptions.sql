-- Гибкие тарифы: набор возможностей собирается администратором в features (JSONB).

CREATE TABLE plans (
  id          BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  code        TEXT NOT NULL UNIQUE,
  name        TEXT NOT NULL,
  description TEXT,
  price       NUMERIC(14, 2) NOT NULL DEFAULT 0,
  currency    TEXT NOT NULL DEFAULT 'RUB',
  days        INT NOT NULL DEFAULT 30,
  features    JSONB NOT NULL DEFAULT '{}'::jsonb,
  sort_order  INT NOT NULL DEFAULT 0,
  is_active   BOOLEAN NOT NULL DEFAULT TRUE,
  is_default  BOOLEAN NOT NULL DEFAULT FALSE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX plans_single_default_idx ON plans (is_default) WHERE is_default;

CREATE TABLE subscriptions (
  id         BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id    BIGINT NOT NULL REFERENCES bot_users (id) ON DELETE CASCADE,
  plan_id    BIGINT NOT NULL REFERENCES plans (id) ON DELETE RESTRICT,
  status     TEXT NOT NULL DEFAULT 'active'
             CHECK (status IN ('active', 'expired', 'cancelled')),
  starts_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  ends_at    TIMESTAMPTZ NOT NULL,
  source     TEXT NOT NULL DEFAULT 'manual',
  created_by BIGINT REFERENCES admins (id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX subscriptions_user_idx ON subscriptions (user_id, ends_at DESC);
CREATE INDEX subscriptions_status_idx ON subscriptions (status, ends_at);

CREATE TABLE promo_codes (
  id           BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  code         TEXT NOT NULL UNIQUE,
  plan_id      BIGINT REFERENCES plans (id) ON DELETE SET NULL,
  discount_pct NUMERIC(5, 2) NOT NULL DEFAULT 0 CHECK (discount_pct BETWEEN 0 AND 100),
  bonus_days   INT NOT NULL DEFAULT 0,
  max_uses     INT,
  used_count   INT NOT NULL DEFAULT 0,
  expires_at   TIMESTAMPTZ,
  is_active    BOOLEAN NOT NULL DEFAULT TRUE,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE payments (
  id              BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id         BIGINT NOT NULL REFERENCES bot_users (id) ON DELETE CASCADE,
  plan_id         BIGINT REFERENCES plans (id) ON DELETE SET NULL,
  subscription_id BIGINT REFERENCES subscriptions (id) ON DELETE SET NULL,
  promo_code_id   BIGINT REFERENCES promo_codes (id) ON DELETE SET NULL,
  amount          NUMERIC(14, 2) NOT NULL,
  currency        TEXT NOT NULL DEFAULT 'RUB',
  status          TEXT NOT NULL DEFAULT 'pending'
                  CHECK (status IN ('pending', 'paid', 'failed', 'refunded')),
  provider        TEXT NOT NULL DEFAULT 'manual',
  external_id     TEXT,
  paid_at         TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX payments_user_idx ON payments (user_id, created_at DESC);
CREATE INDEX payments_status_idx ON payments (status, created_at DESC);
