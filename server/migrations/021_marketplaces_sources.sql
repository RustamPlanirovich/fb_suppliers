-- Новые источники цен. Комиссии — ориентировочные, уточняются в справочнике площадок.
INSERT INTO marketplaces (code, name, commission_pct, url)
VALUES ('playerok', 'Playerok', 5.00, 'https://playerok.com')
ON CONFLICT (code) DO NOTHING;

UPDATE marketplaces SET url = 'https://plati.market' WHERE code = 'digiseller' AND url IS NULL;
