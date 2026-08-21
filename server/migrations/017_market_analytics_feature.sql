-- Аналитика рынка становится отдельной возможностью тарифа: её можно продавать.
UPDATE plans SET features = features || '{"market_analytics": true}'::jsonb
WHERE code IN ('reseller');

UPDATE plans SET features = features || '{"market_analytics": false}'::jsonb
WHERE code IN ('free', 'pro') AND NOT features ? 'market_analytics';
