-- ROI не ограничен сверху: при копеечной закупке он превышает 9999.99 и NUMERIC(6,2)
-- переполняется, обрушивая весь пересчёт связок. То же с трендом цены.

ALTER TABLE arbitrage_links
  ALTER COLUMN roi_pct TYPE NUMERIC(12, 2);

ALTER TABLE product_variants
  ALTER COLUMN trend_7d_pct TYPE NUMERIC(12, 2);
