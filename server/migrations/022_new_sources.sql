-- Новые источники карточек: Digiseller и Playerok.
-- Как и FunPay, это площадки: контакты их продавцов не хранятся.

ALTER TABLE suppliers DROP CONSTRAINT suppliers_source_check;
ALTER TABLE suppliers ADD CONSTRAINT suppliers_source_check
  CHECK (source IN ('manual', 'telegram', 'funpay', 'digiseller', 'playerok', 'import', 'user'));

ALTER TABLE suppliers DROP CONSTRAINT suppliers_no_marketplace_contacts;
ALTER TABLE suppliers ADD CONSTRAINT suppliers_no_marketplace_contacts CHECK (
  source NOT IN ('funpay', 'digiseller', 'playerok')
  OR (telegram IS NULL AND phone IS NULL AND email IS NULL AND contacts_extra = '{}'::jsonb)
);
