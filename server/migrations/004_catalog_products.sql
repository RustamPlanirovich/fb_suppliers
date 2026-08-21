-- Каталог: товар → вариант → оффер поставщика → история цены.
-- Отдельно — рыночные цены площадок (источник: FunPay и др.).

CREATE TABLE marketplaces (
  id             BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  code           TEXT NOT NULL UNIQUE,
  name           TEXT NOT NULL,
  commission_pct NUMERIC(5, 2) NOT NULL DEFAULT 0,
  payout_fee     NUMERIC(14, 2) NOT NULL DEFAULT 0,
  url            TEXT,
  is_active      BOOLEAN NOT NULL DEFAULT TRUE,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE products (
  id            BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  category_id   BIGINT REFERENCES categories (id) ON DELETE SET NULL,
  name          TEXT NOT NULL,
  slug          TEXT NOT NULL UNIQUE,
  description   TEXT,
  is_active     BOOLEAN NOT NULL DEFAULT TRUE,
  search_vector TSVECTOR,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX products_search_idx ON products USING GIN (search_vector);
CREATE INDEX products_category_idx ON products (category_id);

CREATE TABLE product_variants (
  id            BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  product_id    BIGINT NOT NULL REFERENCES products (id) ON DELETE CASCADE,
  name          TEXT NOT NULL,
  attrs         JSONB NOT NULL DEFAULT '{}'::jsonb,
  is_active     BOOLEAN NOT NULL DEFAULT TRUE,

  -- агрегаты (пересчитываются сервисом статистики)
  offers_count      INT NOT NULL DEFAULT 0,
  suppliers_count   INT NOT NULL DEFAULT 0,
  buy_min           NUMERIC(14, 2),
  buy_max           NUMERIC(14, 2),
  buy_avg           NUMERIC(14, 2),
  sell_avg          NUMERIC(14, 2),
  sell_min          NUMERIC(14, 2),
  sell_max          NUMERIC(14, 2),
  sellers_count     INT,
  margin_pct        NUMERIC(6, 2),
  competition       TEXT CHECK (competition IN ('low', 'medium', 'high')),
  trend_7d_pct      NUMERIC(6, 2),
  demand_score      NUMERIC(6, 2) NOT NULL DEFAULT 0,
  stats_updated_at  TIMESTAMPTZ,

  search_vector TSVECTOR,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX product_variants_name_idx ON product_variants (product_id, lower(name));
CREATE INDEX product_variants_search_idx ON product_variants USING GIN (search_vector);
CREATE INDEX product_variants_margin_idx ON product_variants (margin_pct DESC NULLS LAST);

CREATE TABLE offers (
  id               BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  variant_id       BIGINT NOT NULL REFERENCES product_variants (id) ON DELETE CASCADE,
  supplier_id      BIGINT NOT NULL REFERENCES suppliers (id) ON DELETE CASCADE,
  title            TEXT,
  price            NUMERIC(14, 2),
  prev_price       NUMERIC(14, 2),
  currency         TEXT NOT NULL DEFAULT 'RUB',
  min_qty          INT NOT NULL DEFAULT 1,
  stock            INT,
  url              TEXT,
  external_id      TEXT,
  is_active        BOOLEAN NOT NULL DEFAULT TRUE,
  price_checked_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  price_changed_at TIMESTAMPTZ,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX offers_supplier_variant_idx ON offers (supplier_id, variant_id);
CREATE UNIQUE INDEX offers_external_idx ON offers (supplier_id, external_id) WHERE external_id IS NOT NULL;
CREATE INDEX offers_variant_price_idx ON offers (variant_id, price) WHERE is_active;
CREATE INDEX offers_stale_idx ON offers (price_checked_at) WHERE is_active;

-- История цены оффера с доказательством происхождения правки.
CREATE TABLE offer_price_history (
  id          BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  offer_id    BIGINT NOT NULL REFERENCES offers (id) ON DELETE CASCADE,
  price       NUMERIC(14, 2) NOT NULL,
  currency    TEXT NOT NULL DEFAULT 'RUB',
  source      TEXT NOT NULL DEFAULT 'admin'
              CHECK (source IN ('admin', 'parser', 'user', 'import')),
  evidence    TEXT,
  admin_id    BIGINT REFERENCES admins (id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX offer_price_history_offer_idx ON offer_price_history (offer_id, created_at DESC);

-- Рыночные цены площадки по варианту: срез на дату.
CREATE TABLE market_prices (
  id             BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  variant_id     BIGINT NOT NULL REFERENCES product_variants (id) ON DELETE CASCADE,
  marketplace_id BIGINT NOT NULL REFERENCES marketplaces (id) ON DELETE CASCADE,
  price_min      NUMERIC(14, 2),
  price_avg      NUMERIC(14, 2),
  price_max      NUMERIC(14, 2),
  price_median   NUMERIC(14, 2),
  sellers_count  INT,
  sales_count    INT,
  source_url     TEXT,
  collected_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX market_prices_variant_idx ON market_prices (variant_id, marketplace_id, collected_at DESC);

CREATE FUNCTION products_search_refresh() RETURNS TRIGGER AS $$
BEGIN
  NEW.search_vector :=
    setweight(to_tsvector('russian', coalesce(NEW.name, '')), 'A') ||
    setweight(to_tsvector('simple',  coalesce(NEW.name, '')), 'A') ||
    setweight(to_tsvector('russian', coalesce(NEW.description, '')), 'C');
  NEW.updated_at := now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER products_search_trg BEFORE INSERT OR UPDATE ON products
  FOR EACH ROW EXECUTE FUNCTION products_search_refresh();

CREATE FUNCTION variants_search_refresh() RETURNS TRIGGER AS $$
DECLARE
  product_name TEXT;
BEGIN
  SELECT name INTO product_name FROM products WHERE id = NEW.product_id;
  NEW.search_vector :=
    setweight(to_tsvector('russian', coalesce(product_name, '') || ' ' || coalesce(NEW.name, '')), 'A') ||
    setweight(to_tsvector('simple',  coalesce(product_name, '') || ' ' || coalesce(NEW.name, '')), 'A');
  NEW.updated_at := now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER variants_search_trg BEFORE INSERT OR UPDATE ON product_variants
  FOR EACH ROW EXECUTE FUNCTION variants_search_refresh();
