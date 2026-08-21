-- Разделы площадки без фильтров разбиваются на варианты правилами по названию предложения.
ALTER TABLE source_nodes
  ADD COLUMN title_rules JSONB NOT NULL DEFAULT '[]'::jsonb;
