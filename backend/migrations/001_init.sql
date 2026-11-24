-- Vitron initial schema. Money is stored as whole Kenyan shillings (INTEGER).

CREATE TABLE users (
  id            SERIAL PRIMARY KEY,
  full_name     TEXT        NOT NULL,
  phone         TEXT        NOT NULL UNIQUE,          -- normalized +2547XXXXXXXX
  email         TEXT,
  password_hash TEXT        NOT NULL,
  role          TEXT        NOT NULL DEFAULT 'customer'
                CHECK (role IN ('customer', 'staff', 'admin')),
  active        BOOLEAN     NOT NULL DEFAULT TRUE,
  last_login_at TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX users_role_idx ON users (role);

CREATE TABLE categories (
  id         SERIAL PRIMARY KEY,
  name       TEXT        NOT NULL,
  slug       TEXT        NOT NULL UNIQUE,
  image_url  TEXT,
  sort_order INTEGER     NOT NULL DEFAULT 0,
  active     BOOLEAN     NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE products (
  id               SERIAL PRIMARY KEY,
  name             TEXT        NOT NULL,
  slug             TEXT        NOT NULL UNIQUE,
  brand            TEXT,
  category_id      INTEGER      REFERENCES categories (id) ON DELETE SET NULL,
  sku              TEXT,
  description      TEXT        NOT NULL DEFAULT '',
  price            INTEGER     NOT NULL CHECK (price >= 0),
  compare_at_price INTEGER     CHECK (compare_at_price IS NULL OR compare_at_price >= 0),
  stock            INTEGER     NOT NULL DEFAULT 0 CHECK (stock >= 0),
  condition        TEXT        NOT NULL DEFAULT 'new'
                   CHECK (condition IN ('new', 'refurbished', 'ex_uk')),
  warranty_months  INTEGER     NOT NULL DEFAULT 0 CHECK (warranty_months >= 0),
  specs            JSONB       NOT NULL DEFAULT '[]',   -- [{ "label": "RAM", "value": "8GB" }]
  images           JSONB       NOT NULL DEFAULT '[]',   -- ["https://..."]
  featured         BOOLEAN     NOT NULL DEFAULT FALSE,
  is_new           BOOLEAN     NOT NULL DEFAULT FALSE,
  active           BOOLEAN     NOT NULL DEFAULT TRUE,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX products_category_idx ON products (category_id);
CREATE INDEX products_active_idx   ON products (active);
CREATE INDEX products_brand_idx    ON products (lower(brand));

-- Optional per-product options (e.g. "256GB / Black") with their own price and stock.
CREATE TABLE product_variants (
  id         SERIAL PRIMARY KEY,
  product_id INTEGER  NOT NULL REFERENCES products (id) ON DELETE CASCADE,
  label      TEXT    NOT NULL,
  price      INTEGER NOT NULL CHECK (price >= 0),
  stock      INTEGER NOT NULL DEFAULT 0 CHECK (stock >= 0),
  sku        TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX product_variants_product_idx ON product_variants (product_id);

CREATE TABLE orders (
  id             SERIAL PRIMARY KEY,
  order_number   TEXT        NOT NULL UNIQUE,
  user_id        INTEGER      REFERENCES users (id) ON DELETE SET NULL,
  customer_name  TEXT        NOT NULL,
  phone          TEXT        NOT NULL,
  alt_phone      TEXT,
  email          TEXT,
  delivery_zone  TEXT        NOT NULL,
  town           TEXT        NOT NULL,
  address        TEXT        NOT NULL,
  notes          TEXT,
  subtotal       INTEGER     NOT NULL,
  delivery_fee   INTEGER     NOT NULL,
  total          INTEGER     NOT NULL,
  status         TEXT        NOT NULL DEFAULT 'pending'
                 CHECK (status IN ('pending', 'confirmed', 'dispatched', 'delivered', 'cancelled')),
  payment_method TEXT        NOT NULL DEFAULT 'cash_on_delivery',
  payment_status TEXT        NOT NULL DEFAULT 'unpaid' CHECK (payment_status IN ('unpaid', 'paid')),
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX orders_user_idx    ON orders (user_id);
CREATE INDEX orders_phone_idx   ON orders (phone);
CREATE INDEX orders_status_idx  ON orders (status);
CREATE INDEX orders_created_idx ON orders (created_at DESC);

-- Name and price are copied at order time so order history never changes.
CREATE TABLE order_items (
  id            SERIAL PRIMARY KEY,
  order_id      INTEGER  NOT NULL REFERENCES orders (id) ON DELETE CASCADE,
  product_id    INTEGER  REFERENCES products (id) ON DELETE SET NULL,
  variant_id    INTEGER  REFERENCES product_variants (id) ON DELETE SET NULL,
  name          TEXT    NOT NULL,
  variant_label TEXT,
  image_url     TEXT,
  unit_price    INTEGER NOT NULL,
  quantity      INTEGER NOT NULL CHECK (quantity > 0),
  line_total    INTEGER NOT NULL
);
CREATE INDEX order_items_order_idx ON order_items (order_id);

CREATE TABLE order_status_history (
  id         SERIAL PRIMARY KEY,
  order_id   INTEGER      NOT NULL REFERENCES orders (id) ON DELETE CASCADE,
  status     TEXT        NOT NULL,
  note       TEXT,
  changed_by INTEGER      REFERENCES users (id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX order_status_history_order_idx ON order_status_history (order_id);

CREATE TABLE settings (
  key        TEXT PRIMARY KEY,
  value      JSONB       NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
