-- Маржа не ограничена снизу: если закупка в разы дороже продажи, значение уходит
-- в большой минус и NUMERIC(6,2) переполняется, обрушивая весь пересчёт связок.
ALTER TABLE arbitrage_links ALTER COLUMN margin_pct TYPE NUMERIC(12, 2);
ALTER TABLE product_variants ALTER COLUMN margin_pct TYPE NUMERIC(12, 2);
