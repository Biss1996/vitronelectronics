-- Where an imported product came from. The product itself (text + copied images)
-- lives in products / Spaces, so it never depends on the source page again.
CREATE TABLE product_sources (
  id           SERIAL PRIMARY KEY,
  product_id   INTEGER     NOT NULL REFERENCES products (id) ON DELETE CASCADE,
  source       TEXT        NOT NULL,              -- 'jumia' | 'kilimall'
  url          TEXT        NOT NULL,
  external_id  TEXT,                              -- e.g. Jumia SKU
  source_price INTEGER,
  source_old_price INTEGER,
  imported_by  INTEGER     REFERENCES users (id) ON DELETE SET NULL,
  imported_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX product_sources_url_idx ON product_sources (url);
CREATE INDEX product_sources_product_idx ON product_sources (product_id);
CREATE INDEX product_sources_external_idx ON product_sources (source, external_id);
