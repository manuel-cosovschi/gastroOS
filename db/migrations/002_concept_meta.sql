-- Lo que la composición necesita del concepto (plantilla, bullets, precio,
-- recursos y el resultado de la validación del copy).
ALTER TABLE smf.concepts ADD COLUMN IF NOT EXISTS meta JSONB NOT NULL DEFAULT '{}';
