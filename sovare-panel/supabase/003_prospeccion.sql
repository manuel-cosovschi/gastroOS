-- ============================================
-- Prospección: el mensaje y el registro de contacto
-- ============================================
-- No hay tabla nueva a propósito. `sovare.clients` ya nace con el estado
-- 'prospecto' y el comentario de 001_core.sql dice por qué: "un prospecto y un
-- cliente activo son la misma ficha en distinto momento". Un prospecto al que
-- le escribimos por WhatsApp y después cierra no tiene que cambiar de tabla,
-- sólo de estado.
--
-- Lo que falta son tres datos que la ficha no tenía:

-- El mensaje escrito para ESTE negocio. Vive en la base y no en el código
-- porque es contenido, no lógica: se corrige desde el panel cuando una frase no
-- funciona, sin tocar un deploy.
ALTER TABLE sovare.clients
  ADD COLUMN IF NOT EXISTS outreach_message TEXT;

-- Cuándo le escribimos. NULL significa "todavía no", y es la única diferencia
-- que importa en la pantalla de prospección: separa la lista de los que faltan
-- de la de los que ya saben que existimos. `first_contact_at` no servía para
-- esto: nace con DEFAULT CURRENT_DATE, así que todas las fichas dicen que se
-- las contactó el día que se cargaron.
ALTER TABLE sovare.clients
  ADD COLUMN IF NOT EXISTS contacted_at TIMESTAMPTZ;

-- El asunto del mail. Va aparte del mensaje y no se deriva de él: un asunto no
-- es una oración. Derivarlo obligaba a cortar la segunda frase a los setenta
-- caracteres, y un asunto que termina en "y que trabajan con…" se lee como un
-- mail automático, que es exactamente lo que estos mensajes tratan de no parecer.
ALTER TABLE sovare.clients
  ADD COLUMN IF NOT EXISTS outreach_subject TEXT;

-- De dónde salió el contacto. Un teléfono sin fuente no se puede verificar, y
-- medio dato de directorio está viejo: cuando el chat no existe, esto dice
-- dónde ir a mirar.
ALTER TABLE sovare.clients
  ADD COLUMN IF NOT EXISTS source_url TEXT;

-- La pantalla de prospección ordena por "a quién le falta" y filtra por ciudad.
CREATE INDEX IF NOT EXISTS idx_sovare_clients_prospeccion
  ON sovare.clients (status, contacted_at NULLS FIRST, city);
