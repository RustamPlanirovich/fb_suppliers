-- Данные, полученные с площадки-источника: рейтинг и отзывы там, а не у нас.
-- Наши собственные rating/reviews_count считаются по нашим отзывам и не смешиваются с чужими.

ALTER TABLE suppliers
  ADD COLUMN source_rating        NUMERIC(3, 2),
  ADD COLUMN source_reviews_count INT,
  ADD COLUMN source_stats         JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN source_synced_at     TIMESTAMPTZ;

CREATE INDEX suppliers_source_rating_idx ON suppliers (source_rating DESC NULLS LAST);

-- Срез рынка знает, из какого раздела площадки он собран.
ALTER TABLE market_prices
  ADD COLUMN source_node_id TEXT;

CREATE INDEX market_prices_node_idx ON market_prices (source_node_id, collected_at DESC);

-- Разделы площадки, которые администратор поставил на синхронизацию.
CREATE TABLE source_nodes (
  id             BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  marketplace_id BIGINT NOT NULL REFERENCES marketplaces (id) ON DELETE CASCADE,
  node_id        TEXT NOT NULL,
  url            TEXT NOT NULL,
  game_name      TEXT,
  node_name      TEXT,
  product_id     BIGINT REFERENCES products (id) ON DELETE SET NULL,
  category_id    BIGINT REFERENCES categories (id) ON DELETE SET NULL,
  variant_attrs  JSONB NOT NULL DEFAULT '[]'::jsonb,
  with_sellers   BOOLEAN NOT NULL DEFAULT TRUE,
  is_active      BOOLEAN NOT NULL DEFAULT TRUE,
  last_synced_at TIMESTAMPTZ,
  last_result    JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_by     BIGINT REFERENCES admins (id) ON DELETE SET NULL,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX source_nodes_uniq_idx ON source_nodes (marketplace_id, node_id);
CREATE INDEX source_nodes_active_idx ON source_nodes (is_active, last_synced_at NULLS FIRST);
