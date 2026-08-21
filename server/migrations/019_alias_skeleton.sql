-- «Скелет» слова — согласные и первая буква: youtube → ytb, ютуб → ytb.
-- Так пары «латиница ↔ кириллица» совпадают без ручного словаря.
ALTER TABLE product_aliases ADD COLUMN alias_skel TEXT NOT NULL DEFAULT '';
CREATE INDEX product_aliases_skel_idx ON product_aliases (alias_skel) WHERE alias_skel <> '';
