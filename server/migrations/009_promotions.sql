-- Платное размещение поставщиков в «топе» + скидки за рекламу.

CREATE TABLE promo_placements (
  id          BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  code        TEXT NOT NULL UNIQUE,
  name        TEXT NOT NULL,
  description TEXT,
  slot        TEXT NOT NULL DEFAULT 'top' CHECK (slot IN ('top', 'category', 'search')),
  weight      INT NOT NULL DEFAULT 100,
  days        INT NOT NULL DEFAULT 30,
  price       NUMERIC(14, 2) NOT NULL DEFAULT 0,
  currency    TEXT NOT NULL DEFAULT 'RUB',
  is_active   BOOLEAN NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE promotions (
  id           BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  supplier_id  BIGINT NOT NULL REFERENCES suppliers (id) ON DELETE CASCADE,
  placement_id BIGINT REFERENCES promo_placements (id) ON DELETE SET NULL,
  category_id  BIGINT REFERENCES categories (id) ON DELETE SET NULL,
  slot         TEXT NOT NULL DEFAULT 'top' CHECK (slot IN ('top', 'category', 'search')),
  weight       INT NOT NULL DEFAULT 100,
  discount_pct NUMERIC(5, 2) NOT NULL DEFAULT 0 CHECK (discount_pct BETWEEN 0 AND 100),
  amount_paid  NUMERIC(14, 2) NOT NULL DEFAULT 0,
  currency     TEXT NOT NULL DEFAULT 'RUB',
  starts_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  ends_at      TIMESTAMPTZ NOT NULL,
  is_active    BOOLEAN NOT NULL DEFAULT TRUE,
  note         TEXT,
  created_by   BIGINT REFERENCES admins (id) ON DELETE SET NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX promotions_active_idx ON promotions (is_active, ends_at DESC);
CREATE INDEX promotions_supplier_idx ON promotions (supplier_id);
