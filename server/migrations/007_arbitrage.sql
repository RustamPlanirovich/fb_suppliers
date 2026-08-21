-- Связки «купить дешевле → продать дороже», алерты и мини-CRM реселлера.

CREATE TABLE arbitrage_links (
  id             BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  variant_id     BIGINT NOT NULL REFERENCES product_variants (id) ON DELETE CASCADE,
  offer_id       BIGINT NOT NULL REFERENCES offers (id) ON DELETE CASCADE,
  marketplace_id BIGINT NOT NULL REFERENCES marketplaces (id) ON DELETE CASCADE,

  buy_price      NUMERIC(14, 2) NOT NULL,
  sell_price     NUMERIC(14, 2) NOT NULL,
  commission_pct NUMERIC(5, 2) NOT NULL DEFAULT 0,
  payout_fee     NUMERIC(14, 2) NOT NULL DEFAULT 0,
  profit         NUMERIC(14, 2) NOT NULL,
  roi_pct        NUMERIC(6, 2) NOT NULL,
  margin_pct     NUMERIC(6, 2) NOT NULL,

  price_age_hours INT,
  competition     TEXT CHECK (competition IN ('low', 'medium', 'high')),
  risk_level      TEXT CHECK (risk_level IN ('low', 'medium', 'high')),

  admin_mark     TEXT NOT NULL DEFAULT 'auto'
                 CHECK (admin_mark IN ('auto', 'good', 'doubtful', 'stale')),
  admin_note     TEXT,
  is_active      BOOLEAN NOT NULL DEFAULT TRUE,
  computed_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX arbitrage_links_uniq_idx ON arbitrage_links (offer_id, marketplace_id);
CREATE INDEX arbitrage_links_roi_idx ON arbitrage_links (roi_pct DESC) WHERE is_active;
CREATE INDEX arbitrage_links_variant_idx ON arbitrage_links (variant_id);

-- Пользовательские уведомления по условию.
CREATE TABLE alerts (
  id          BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id     BIGINT NOT NULL REFERENCES bot_users (id) ON DELETE CASCADE,
  variant_id  BIGINT REFERENCES product_variants (id) ON DELETE CASCADE,
  type        TEXT NOT NULL
              CHECK (type IN ('price_below', 'price_drop_pct', 'margin_above',
                              'new_supplier', 'sell_price_up')),
  threshold   NUMERIC(14, 2) NOT NULL,
  is_active   BOOLEAN NOT NULL DEFAULT TRUE,
  last_fired_at TIMESTAMPTZ,
  fired_count INT NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX alerts_active_idx ON alerts (is_active, type);
CREATE INDEX alerts_variant_idx ON alerts (variant_id) WHERE is_active;

CREATE TABLE alert_hits (
  id         BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  alert_id   BIGINT NOT NULL REFERENCES alerts (id) ON DELETE CASCADE,
  value      NUMERIC(14, 2) NOT NULL,
  message    TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX alert_hits_alert_idx ON alert_hits (alert_id, created_at DESC);

-- Личный кабинет реселлера: свои позиции, закупка/продажа/прибыль.
CREATE TABLE reseller_positions (
  id          BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id     BIGINT NOT NULL REFERENCES bot_users (id) ON DELETE CASCADE,
  variant_id  BIGINT REFERENCES product_variants (id) ON DELETE SET NULL,
  supplier_id BIGINT REFERENCES suppliers (id) ON DELETE SET NULL,
  title       TEXT NOT NULL,
  buy_price   NUMERIC(14, 2) NOT NULL DEFAULT 0,
  sell_price  NUMERIC(14, 2) NOT NULL DEFAULT 0,
  qty         INT NOT NULL DEFAULT 1,
  commission_pct NUMERIC(5, 2) NOT NULL DEFAULT 0,
  note        TEXT,
  status      TEXT NOT NULL DEFAULT 'planned'
              CHECK (status IN ('planned', 'bought', 'sold', 'cancelled')),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX reseller_positions_user_idx ON reseller_positions (user_id, status, created_at DESC);
