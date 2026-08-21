-- Отзывы, жалобы, подтверждённые сделки и пользовательские правки на модерацию.

CREATE TABLE reviews (
  id          BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  supplier_id BIGINT NOT NULL REFERENCES suppliers (id) ON DELETE CASCADE,
  user_id     BIGINT REFERENCES bot_users (id) ON DELETE SET NULL,
  rating      SMALLINT CHECK (rating BETWEEN 1 AND 5),
  score_response SMALLINT CHECK (score_response BETWEEN 1 AND 5),
  score_delivery SMALLINT CHECK (score_delivery BETWEEN 1 AND 5),
  score_accuracy SMALLINT CHECK (score_accuracy BETWEEN 1 AND 5),
  text        TEXT,
  status      TEXT NOT NULL DEFAULT 'pending'
              CHECK (status IN ('pending', 'approved', 'rejected')),
  resolved_by BIGINT REFERENCES admins (id) ON DELETE SET NULL,
  resolved_at TIMESTAMPTZ,
  resolution  TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX reviews_supplier_idx ON reviews (supplier_id, status);
CREATE INDEX reviews_status_idx ON reviews (status, created_at DESC);

CREATE TABLE complaints (
  id          BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  supplier_id BIGINT NOT NULL REFERENCES suppliers (id) ON DELETE CASCADE,
  offer_id    BIGINT REFERENCES offers (id) ON DELETE SET NULL,
  user_id     BIGINT REFERENCES bot_users (id) ON DELETE SET NULL,
  reason      TEXT NOT NULL
              CHECK (reason IN ('closed', 'no_answer', 'wrong_contacts', 'scam',
                                'price', 'out_of_stock', 'other')),
  text        TEXT,
  status      TEXT NOT NULL DEFAULT 'new'
              CHECK (status IN ('new', 'in_progress', 'resolved', 'rejected')),
  resolved_by BIGINT REFERENCES admins (id) ON DELETE SET NULL,
  resolved_at TIMESTAMPTZ,
  resolution  TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX complaints_status_idx ON complaints (status, created_at DESC);
CREATE INDEX complaints_supplier_idx ON complaints (supplier_id);

-- Подтверждения сделок: питают счётчик «N успешных покупок за 30 дней».
CREATE TABLE deal_confirmations (
  id          BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  supplier_id BIGINT NOT NULL REFERENCES suppliers (id) ON DELETE CASCADE,
  offer_id    BIGINT REFERENCES offers (id) ON DELETE SET NULL,
  user_id     BIGINT REFERENCES bot_users (id) ON DELETE SET NULL,
  price       NUMERIC(14, 2),
  qty         INT NOT NULL DEFAULT 1,
  is_problem  BOOLEAN NOT NULL DEFAULT FALSE,
  status      TEXT NOT NULL DEFAULT 'pending'
              CHECK (status IN ('pending', 'approved', 'rejected')),
  resolved_by BIGINT REFERENCES admins (id) ON DELETE SET NULL,
  resolved_at TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX deal_confirmations_supplier_idx ON deal_confirmations (supplier_id, status, created_at DESC);

-- Пользовательские правки: новый поставщик, новая цена, «товар закончился» и т.п.
CREATE TABLE submissions (
  id          BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id     BIGINT REFERENCES bot_users (id) ON DELETE SET NULL,
  type        TEXT NOT NULL
              CHECK (type IN ('new_supplier', 'new_offer', 'price_update',
                              'out_of_stock', 'supplier_request', 'other')),
  supplier_id BIGINT REFERENCES suppliers (id) ON DELETE SET NULL,
  offer_id    BIGINT REFERENCES offers (id) ON DELETE SET NULL,
  variant_id  BIGINT REFERENCES product_variants (id) ON DELETE SET NULL,
  payload     JSONB NOT NULL DEFAULT '{}'::jsonb,
  evidence    TEXT,
  status      TEXT NOT NULL DEFAULT 'new'
              CHECK (status IN ('new', 'approved', 'rejected')),
  resolved_by BIGINT REFERENCES admins (id) ON DELETE SET NULL,
  resolved_at TIMESTAMPTZ,
  resolution  TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX submissions_status_idx ON submissions (status, created_at DESC);
CREATE INDEX submissions_type_idx ON submissions (type, status);
