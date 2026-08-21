-- Пользователь пишет «ютуб», «ют», «гпт» — это те же товары, что youtube и chatgpt.
-- Регистр и пробелы решаются нормализацией, разные языки и сокращения — словарём синонимов,
-- опечатки — нечётким совпадением по триграммам.

CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE TABLE product_aliases (
  id         BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  product_id BIGINT NOT NULL REFERENCES products (id) ON DELETE CASCADE,
  -- как ввёл человек
  alias      TEXT NOT NULL,
  -- нормализованный вид: нижний регистр, без лишних пробелов
  alias_norm TEXT NOT NULL,
  -- ключ сравнения: латиница без пробелов и знаков, кириллица транслитерирована
  alias_key  TEXT NOT NULL,
  source     TEXT NOT NULL DEFAULT 'manual'
             CHECK (source IN ('auto', 'manual', 'query')),
  created_by BIGINT REFERENCES admins (id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX product_aliases_uniq_idx ON product_aliases (product_id, alias_key);
CREATE INDEX product_aliases_norm_idx ON product_aliases (alias_norm text_pattern_ops);
CREATE INDEX product_aliases_key_idx ON product_aliases (alias_key text_pattern_ops);
CREATE INDEX product_aliases_key_trgm_idx ON product_aliases USING GIN (alias_key gin_trgm_ops);
