-- Cada verificación de una página /conv: si responde, si muestra el titular de
-- cada variante, si carga el píxel. Ninguna campaña paga sale a una página sin
-- una verificación correcta reciente.
CREATE TABLE IF NOT EXISTS smf.landing_checks (
  id         BIGSERIAL PRIMARY KEY,
  product_id TEXT NOT NULL,
  url        TEXT NOT NULL,
  ok         BOOLEAN NOT NULL,
  pixel      TEXT NOT NULL DEFAULT 'unknown',
  checks     JSONB NOT NULL DEFAULT '[]',
  checked_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS landing_checks_product ON smf.landing_checks (product_id, checked_at DESC);
