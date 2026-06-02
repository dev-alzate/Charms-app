-- Para gen_random_uuid()
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- =============================================================================
-- TABLAS
-- =============================================================================

CREATE TABLE IF NOT EXISTS categories (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name          text NOT NULL UNIQUE,
  display_order int NOT NULL DEFAULT 0,
  color         text NOT NULL DEFAULT '#7C3AED',
  active        boolean NOT NULL DEFAULT true,
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS products (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code          text NOT NULL UNIQUE,
  name          text NOT NULL,
  price         numeric(12, 2) NOT NULL CHECK (price >= 0),
  category_id   uuid REFERENCES categories(id) ON DELETE SET NULL,
  image_url     text,
  active        boolean NOT NULL DEFAULT true,
  display_order int NOT NULL DEFAULT 0,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

-- Migración para bases existentes (sin efecto si la columna ya existe)
ALTER TABLE products ADD COLUMN IF NOT EXISTS image_url text;

CREATE INDEX IF NOT EXISTS idx_products_category ON products(category_id);
CREATE INDEX IF NOT EXISTS idx_products_active   ON products(active);

CREATE TABLE IF NOT EXISTS sales (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_number  text UNIQUE,
  ticket_number   int,
  items           jsonb NOT NULL,
  total           numeric(12, 2) NOT NULL CHECK (total >= 0),
  payment_method  text NOT NULL CHECK (payment_method IN ('cash', 'nequi', 'daviplata')),
  customer_name   text,
  customer_phone  text,
  identifier_name text,
  notes           text,
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sales_created ON sales(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_sales_invoice ON sales(invoice_number);

CREATE TABLE IF NOT EXISTS settings (
  key        text PRIMARY KEY,
  value      text,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS sellers (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name       text NOT NULL,
  code       text NOT NULL UNIQUE,
  active     boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS payment_methods (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key           text NOT NULL UNIQUE,
  label         text NOT NULL,
  active        boolean NOT NULL DEFAULT true,
  display_order int NOT NULL DEFAULT 0
);

-- =============================================================================
-- FUNCIONES Y TRIGGERS
-- =============================================================================

-- Próximo número de factura del año actual (F-YYYY-XXXX, secuencia anual)
CREATE OR REPLACE FUNCTION generate_invoice_number()
RETURNS text
LANGUAGE plpgsql
AS $$
DECLARE
  current_year int := EXTRACT(YEAR FROM now())::int;
  next_seq int;
BEGIN
  SELECT COALESCE(
    MAX(
      CAST(SPLIT_PART(invoice_number, '-', 3) AS int)
    ),
    0
  ) + 1
  INTO next_seq
  FROM sales
  WHERE invoice_number LIKE 'F-' || current_year || '-%';

  RETURN 'F-' || current_year || '-' || LPAD(next_seq::text, 4, '0');
END;
$$;

-- Próximo número de ticket del día (resetea cada día)
CREATE OR REPLACE FUNCTION get_next_ticket_number()
RETURNS int
LANGUAGE plpgsql
AS $$
DECLARE
  today_start timestamptz := date_trunc('day', now());
  today_end   timestamptz := today_start + interval '1 day';
  next_ticket int;
BEGIN
  SELECT COALESCE(MAX(ticket_number), 0) + 1
  INTO next_ticket
  FROM sales
  WHERE created_at >= today_start AND created_at < today_end;

  RETURN next_ticket;
END;
$$;

-- Trigger BEFORE INSERT en sales: asigna invoice_number y ticket_number
CREATE OR REPLACE FUNCTION set_invoice_number()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.invoice_number IS NULL THEN
    NEW.invoice_number := generate_invoice_number();
  END IF;
  IF NEW.ticket_number IS NULL THEN
    NEW.ticket_number := get_next_ticket_number();
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_set_invoice_number ON sales;
CREATE TRIGGER trg_set_invoice_number
BEFORE INSERT ON sales
FOR EACH ROW EXECUTE FUNCTION set_invoice_number();

-- Trigger para mantener products.updated_at
CREATE OR REPLACE FUNCTION touch_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_products_updated_at ON products;
CREATE TRIGGER trg_products_updated_at
BEFORE UPDATE ON products
FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

-- =============================================================================
-- ROW LEVEL SECURITY
--
-- Habilitamos RLS pero permitimos todo a anon. El equipo no usa autenticación
-- (es un POS interno). Si en el futuro se agrega login, refinar políticas.
-- =============================================================================

ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE products   ENABLE ROW LEVEL SECURITY;
ALTER TABLE sales      ENABLE ROW LEVEL SECURITY;
ALTER TABLE settings   ENABLE ROW LEVEL SECURITY;
ALTER TABLE sellers         ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_methods ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS p_all_categories ON categories;
CREATE POLICY p_all_categories ON categories FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS p_all_products ON products;
CREATE POLICY p_all_products ON products FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS p_all_sales ON sales;
CREATE POLICY p_all_sales ON sales FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS p_all_settings ON settings;
CREATE POLICY p_all_settings ON settings FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS p_all_sellers ON sellers;
CREATE POLICY p_all_sellers ON sellers FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS p_all_payment_methods ON payment_methods;
CREATE POLICY p_all_payment_methods ON payment_methods FOR ALL USING (true) WITH CHECK (true);



INSERT INTO settings (key, value) VALUES ('require_seller_login', 'false')
ON CONFLICT (key) DO NOTHING;

INSERT INTO payment_methods (key, label, active, display_order) VALUES
  ('cash',     'Efectivo',      true, 1),
  ('transfer', 'Transferencia', true, 2),
  ('card',     'Datafono',      true, 3)
ON CONFLICT (key) DO NOTHING;

ALTER TABLE sales DROP CONSTRAINT IF EXISTS sales_payment_method_check;
ALTER TABLE sales ADD CONSTRAINT sales_payment_method_check
  CHECK (payment_method IN ('cash', 'transfer', 'card'));

INSERT INTO categories (name, display_order, color, active) VALUES
  ('Cadenas',    1, '#9333EA', true),
  ('Argollas',   2, '#A78BFA', true),
  ('Letras',     3, '#06B6D4', true),
  ('Zodiaco',    4, '#F59E0B', true),
  ('Animales',   5, '#10B981', true),
  ('Símbolos',   6, '#EF4444', true),
  ('Religiosos', 7, '#6366F1', true),
  ('Especiales', 8, '#EC4899', true)
ON CONFLICT (name) DO NOTHING;

-- Productos de muestra. category_id se resuelve por nombre.
INSERT INTO products (code, name, price, category_id, display_order) VALUES
  ('CAD-01', 'Cadena plata corta',  25000, (SELECT id FROM categories WHERE name = 'Cadenas'), 1),
  ('CAD-02', 'Cadena plata larga',  32000, (SELECT id FROM categories WHERE name = 'Cadenas'), 2),
  ('CAD-03', 'Cadena dorada corta', 28000, (SELECT id FROM categories WHERE name = 'Cadenas'), 3),
  ('CAD-04', 'Cadena dorada larga', 35000, (SELECT id FROM categories WHERE name = 'Cadenas'), 4),
  ('CAD-05', 'Cadena de cuero',     18000, (SELECT id FROM categories WHERE name = 'Cadenas'), 5),

  ('ARG-01', 'Argolla plata',       3000,  (SELECT id FROM categories WHERE name = 'Argollas'), 1),
  ('ARG-02', 'Argolla dorada',      3500,  (SELECT id FROM categories WHERE name = 'Argollas'), 2),
  ('ARG-03', 'Argolla pequeña',     2500,  (SELECT id FROM categories WHERE name = 'Argollas'), 3),

  ('L-A',    'Letra A',             5000,  (SELECT id FROM categories WHERE name = 'Letras'), 1),
  ('L-B',    'Letra B',             5000,  (SELECT id FROM categories WHERE name = 'Letras'), 2),
  ('L-C',    'Letra C',             5000,  (SELECT id FROM categories WHERE name = 'Letras'), 3),
  ('L-D',    'Letra D',             5000,  (SELECT id FROM categories WHERE name = 'Letras'), 4),
  ('L-E',    'Letra E',             5000,  (SELECT id FROM categories WHERE name = 'Letras'), 5),
  ('L-M',    'Letra M',             5000,  (SELECT id FROM categories WHERE name = 'Letras'), 6),
  ('L-J',    'Letra J',             5000,  (SELECT id FROM categories WHERE name = 'Letras'), 7),
  ('L-S',    'Letra S',             5000,  (SELECT id FROM categories WHERE name = 'Letras'), 8),

  ('Z-AR',   'Aries',               6500,  (SELECT id FROM categories WHERE name = 'Zodiaco'), 1),
  ('Z-TA',   'Tauro',               6500,  (SELECT id FROM categories WHERE name = 'Zodiaco'), 2),
  ('Z-GE',   'Géminis',             6500,  (SELECT id FROM categories WHERE name = 'Zodiaco'), 3),
  ('Z-CA',   'Cáncer',              6500,  (SELECT id FROM categories WHERE name = 'Zodiaco'), 4),
  ('Z-LE',   'Leo',                 6500,  (SELECT id FROM categories WHERE name = 'Zodiaco'), 5),

  ('S-47',   'Corazón pequeño',     5500,  (SELECT id FROM categories WHERE name = 'Símbolos'), 1),
  ('S-89',   'Estrella',            5500,  (SELECT id FROM categories WHERE name = 'Símbolos'), 2),
  ('S-12',   'Luna',                5500,  (SELECT id FROM categories WHERE name = 'Símbolos'), 3),
  ('S-33',   'Infinito',            6000,  (SELECT id FROM categories WHERE name = 'Símbolos'), 4),
  ('S-77',   'Trébol',              5500,  (SELECT id FROM categories WHERE name = 'Símbolos'), 5)
ON CONFLICT (code) DO NOTHING;
