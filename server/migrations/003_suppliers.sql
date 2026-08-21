-- Поставщики. Контакты хранятся ТОЛЬКО у независимых источников (manual/telegram/import).
-- Продавцы, подтянутые с FunPay, служат источником рыночных цен: контакты у них не собираются.

CREATE TABLE suppliers (
  id              BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  category_id     BIGINT REFERENCES categories (id) ON DELETE SET NULL,
  name            TEXT NOT NULL,
  description     TEXT,
  source          TEXT NOT NULL DEFAULT 'manual'
                  CHECK (source IN ('manual', 'telegram', 'funpay', 'import', 'user')),
  external_url    TEXT,
  external_id     TEXT,

  -- контакты: только для независимых поставщиков (см. constraint ниже)
  telegram        TEXT,
  phone           TEXT,
  email           TEXT,
  website         TEXT,
  contacts_extra  JSONB NOT NULL DEFAULT '{}'::jsonb,

  -- рейтинг разложен на составляющие (1..5), общий выводится расчётом
  score_reliability   NUMERIC(3, 2),
  score_response      NUMERIC(3, 2),
  score_delivery      NUMERIC(3, 2),
  score_accuracy      NUMERIC(3, 2),
  quality_score       SMALLINT CHECK (quality_score BETWEEN 1 AND 5),
  quality_note        TEXT,

  -- агрегаты, пересчитываются сервисом статистики
  reviews_count       INT NOT NULL DEFAULT 0,
  rating              NUMERIC(3, 2),
  complaints_count    INT NOT NULL DEFAULT 0,
  problem_rate        NUMERIC(5, 2) NOT NULL DEFAULT 0,
  confirmed_deals     INT NOT NULL DEFAULT 0,
  confirmed_deals_30d INT NOT NULL DEFAULT 0,
  offers_count        INT NOT NULL DEFAULT 0,
  sales_count         INT,
  first_seen_at       TIMESTAMPTZ NOT NULL DEFAULT now(),

  status          TEXT NOT NULL DEFAULT 'draft'
                  CHECK (status IN ('draft', 'pending', 'verified', 'recheck', 'blocked', 'archived')),
  is_hidden       BOOLEAN NOT NULL DEFAULT FALSE,

  checked_at      TIMESTAMPTZ,
  checked_by      BIGINT REFERENCES admins (id) ON DELETE SET NULL,
  merged_into_id  BIGINT REFERENCES suppliers (id) ON DELETE SET NULL,

  search_vector   TSVECTOR,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- Ограничение площадки: контакты FunPay-продавцов не хранятся.
  CONSTRAINT suppliers_no_marketplace_contacts CHECK (
    source <> 'funpay'
    OR (telegram IS NULL AND phone IS NULL AND email IS NULL AND contacts_extra = '{}'::jsonb)
  )
);

CREATE UNIQUE INDEX suppliers_external_idx ON suppliers (source, external_id) WHERE external_id IS NOT NULL;
CREATE INDEX suppliers_status_idx ON suppliers (status) WHERE merged_into_id IS NULL;
CREATE INDEX suppliers_category_idx ON suppliers (category_id);
CREATE INDEX suppliers_search_idx ON suppliers USING GIN (search_vector);
CREATE INDEX suppliers_checked_idx ON suppliers (checked_at NULLS FIRST);
CREATE INDEX suppliers_telegram_idx ON suppliers (lower(telegram)) WHERE telegram IS NOT NULL;
CREATE INDEX suppliers_phone_idx ON suppliers (phone) WHERE phone IS NOT NULL;
CREATE INDEX suppliers_email_idx ON suppliers (lower(email)) WHERE email IS NOT NULL;
CREATE INDEX suppliers_website_idx ON suppliers (lower(website)) WHERE website IS NOT NULL;

CREATE TABLE supplier_tags (
  supplier_id BIGINT NOT NULL REFERENCES suppliers (id) ON DELETE CASCADE,
  tag_id      BIGINT NOT NULL REFERENCES tags (id) ON DELETE CASCADE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (supplier_id, tag_id)
);

CREATE FUNCTION suppliers_search_refresh() RETURNS TRIGGER AS $$
BEGIN
  NEW.search_vector :=
    setweight(to_tsvector('russian', coalesce(NEW.name, '')), 'A') ||
    setweight(to_tsvector('simple',  coalesce(NEW.name, '')), 'A') ||
    setweight(to_tsvector('russian', coalesce(NEW.description, '')), 'C');
  NEW.updated_at := now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER suppliers_search_trg BEFORE INSERT OR UPDATE ON suppliers
  FOR EACH ROW EXECUTE FUNCTION suppliers_search_refresh();
