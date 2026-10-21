-- Sovare Marketing Factory — esquema inicial.
--
-- Todo vive en el esquema `smf` para poder compartir un proyecto de Postgres
-- (por ejemplo, Supabase) sin pisar las tablas de nadie. Ninguna tabla guarda
-- datos personales de leads o clientes: los eventos traen qué pasó, cuánto
-- valió y de qué campaña vino, nunca nombre, teléfono ni mail.

CREATE SCHEMA IF NOT EXISTS smf;

-- Ajustes globales: modo (test/live), pausa general, política de presupuesto
-- y de piloto automático. Se escriben sólo a través de src/core/policy.ts.
CREATE TABLE IF NOT EXISTS smf.settings (
  key        TEXT PRIMARY KEY,
  value      JSONB NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by TEXT NOT NULL DEFAULT 'system'
);

-- El catálogo sincronizado desde catalog/products/*.json. La fuente de verdad
-- es el archivo; esto es la copia que usan el panel y los jobs, con su huella
-- para detectar cambios.
CREATE TABLE IF NOT EXISTS smf.products (
  id         TEXT PRIMARY KEY,
  data       JSONB NOT NULL,
  hash       TEXT NOT NULL,
  marketable BOOLEAN NOT NULL DEFAULT false,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS smf.product_snapshots (
  id         BIGSERIAL PRIMARY KEY,
  product_id TEXT NOT NULL,
  hash       TEXT NOT NULL,
  data       JSONB NOT NULL,
  changes    JSONB NOT NULL DEFAULT '[]',
  taken_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS smf.concepts (
  id           TEXT PRIMARY KEY,
  product_id   TEXT NOT NULL,
  angle        TEXT NOT NULL,
  hook         TEXT NOT NULL,
  headline     TEXT NOT NULL,
  primary_text TEXT NOT NULL,
  cta          TEXT NOT NULL,
  claims       JSONB NOT NULL DEFAULT '[]',
  variant      TEXT,
  status       TEXT NOT NULL DEFAULT 'draft',
  created_by   TEXT NOT NULL DEFAULT 'system',
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS smf.creatives (
  id           TEXT PRIMARY KEY,
  concept_id   TEXT NOT NULL REFERENCES smf.concepts(id),
  product_id   TEXT NOT NULL,
  format       TEXT NOT NULL,
  width        INT,
  height       INT,
  duration_s   NUMERIC(8,2),
  path         TEXT,
  poster_path  TEXT,
  project_path TEXT,
  bytes        BIGINT,
  sha256       TEXT,
  status       TEXT NOT NULL DEFAULT 'queued',
  validation   JSONB NOT NULL DEFAULT '{}',
  public_url   TEXT,
  meta_video_id TEXT,
  meta_image_hash TEXT,
  fatigue      JSONB NOT NULL DEFAULT '{}',
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS smf.campaigns (
  id               TEXT PRIMARY KEY,
  product_id       TEXT NOT NULL,
  name             TEXT NOT NULL,
  objective        TEXT NOT NULL,
  status           TEXT NOT NULL DEFAULT 'draft',
  daily_budget_ars NUMERIC(14,2) NOT NULL DEFAULT 0,
  destination_url  TEXT NOT NULL,
  plan             JSONB NOT NULL DEFAULT '{}',
  meta_campaign_id TEXT,
  meta_adset_id    TEXT,
  meta_status      JSONB NOT NULL DEFAULT '{}',
  dry_run          BOOLEAN NOT NULL DEFAULT true,
  blockers         JSONB NOT NULL DEFAULT '[]',
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS smf.ads (
  id               TEXT PRIMARY KEY,
  campaign_id      TEXT NOT NULL REFERENCES smf.campaigns(id),
  creative_id      TEXT NOT NULL REFERENCES smf.creatives(id),
  concept_id       TEXT NOT NULL,
  utm_content      TEXT NOT NULL,
  url              TEXT NOT NULL,
  meta_ad_id       TEXT,
  meta_creative_id TEXT,
  status           TEXT NOT NULL DEFAULT 'draft',
  effective_status TEXT,
  review           JSONB NOT NULL DEFAULT '{}',
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Métricas diarias de Meta, por anuncio. `meta_id` es el id del anuncio en
-- Meta; la clave evita duplicar el mismo día al re-sincronizar.
CREATE TABLE IF NOT EXISTS smf.metrics_daily (
  day          DATE NOT NULL,
  meta_ad_id   TEXT NOT NULL,
  ad_id        TEXT,
  campaign_id  TEXT,
  product_id   TEXT,
  impressions  BIGINT NOT NULL DEFAULT 0,
  reach        BIGINT NOT NULL DEFAULT 0,
  clicks       BIGINT NOT NULL DEFAULT 0,
  link_clicks  BIGINT NOT NULL DEFAULT 0,
  spend        NUMERIC(14,2) NOT NULL DEFAULT 0,
  leads        INT NOT NULL DEFAULT 0,
  purchases    INT NOT NULL DEFAULT 0,
  frequency    NUMERIC(8,3) NOT NULL DEFAULT 0,
  video_p75    BIGINT NOT NULL DEFAULT 0,
  source       TEXT NOT NULL DEFAULT 'meta',
  synced_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (day, meta_ad_id)
);

-- Eventos de negocio (leads, checkouts, compras) que llegan de los productos.
-- `event_id` es la clave de deduplicación: el mismo que usan el píxel y la API
-- de conversiones, así que un evento repetido no cuenta dos veces.
CREATE TABLE IF NOT EXISTS smf.events (
  id          TEXT PRIMARY KEY,
  event_id    TEXT NOT NULL UNIQUE,
  product_id  TEXT NOT NULL,
  type        TEXT NOT NULL,
  occurred_at TIMESTAMPTZ NOT NULL,
  value       NUMERIC(14,2),
  currency    TEXT,
  plan        TEXT,
  quality     TEXT,
  attribution JSONB NOT NULL DEFAULT '{}',
  campaign_id TEXT,
  ad_id       TEXT,
  source      TEXT NOT NULL,
  capi        JSONB NOT NULL DEFAULT '{}',
  received_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS smf.organic_posts (
  id           TEXT PRIMARY KEY,
  product_id   TEXT NOT NULL,
  creative_id  TEXT REFERENCES smf.creatives(id),
  channel      TEXT NOT NULL,
  kind         TEXT NOT NULL,
  caption      TEXT NOT NULL,
  media_urls   JSONB NOT NULL DEFAULT '[]',
  scheduled_at TIMESTAMPTZ NOT NULL,
  status       TEXT NOT NULL DEFAULT 'scheduled',
  container_id TEXT,
  remote_id    TEXT,
  permalink    TEXT,
  attempts     INT NOT NULL DEFAULT 0,
  last_error   TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- La cola. `idempotency_key` impide encolar dos veces el mismo trabajo (por
-- ejemplo, el mismo cron en el mismo minuto desde dos ejecutores).
CREATE TABLE IF NOT EXISTS smf.jobs (
  id              TEXT PRIMARY KEY,
  type            TEXT NOT NULL,
  payload         JSONB NOT NULL DEFAULT '{}',
  run_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  status          TEXT NOT NULL DEFAULT 'queued',
  attempts        INT NOT NULL DEFAULT 0,
  max_attempts    INT NOT NULL DEFAULT 3,
  idempotency_key TEXT UNIQUE,
  needs           TEXT NOT NULL DEFAULT 'any',
  locked_by       TEXT,
  locked_until    TIMESTAMPTZ,
  last_error      TEXT,
  result          JSONB,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  started_at      TIMESTAMPTZ,
  finished_at     TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS jobs_ready ON smf.jobs (status, run_at);

CREATE TABLE IF NOT EXISTS smf.schedules (
  id          TEXT PRIMARY KEY,
  cron        TEXT NOT NULL,
  job_type    TEXT NOT NULL,
  payload     JSONB NOT NULL DEFAULT '{}',
  enabled     BOOLEAN NOT NULL DEFAULT true,
  description TEXT NOT NULL DEFAULT '',
  last_slot   TEXT,
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS smf.heartbeats (
  worker     TEXT PRIMARY KEY,
  kind       TEXT NOT NULL,
  at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  info       JSONB NOT NULL DEFAULT '{}'
);

-- Autorizaciones de nivel 3. Las pide cualquiera (el agente, un job); sólo
-- las decide el dueño (panel, CLI con la llave de dueño o el link firmado).
CREATE TABLE IF NOT EXISTS smf.approvals (
  id           TEXT PRIMARY KEY,
  action       TEXT NOT NULL,
  scope        JSONB NOT NULL DEFAULT '{}',
  summary      TEXT NOT NULL,
  status       TEXT NOT NULL DEFAULT 'pending',
  requested_by TEXT NOT NULL,
  requested_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  decided_by   TEXT,
  decided_at   TIMESTAMPTZ,
  expires_at   TIMESTAMPTZ NOT NULL,
  link_hash    TEXT,
  used_at      TIMESTAMPTZ,
  note         TEXT
);

CREATE TABLE IF NOT EXISTS smf.audit_log (
  id       BIGSERIAL PRIMARY KEY,
  at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  actor    TEXT NOT NULL,
  action   TEXT NOT NULL,
  tier     INT,
  decision TEXT NOT NULL,
  target   TEXT,
  details  JSONB NOT NULL DEFAULT '{}'
);
CREATE INDEX IF NOT EXISTS audit_at ON smf.audit_log (at DESC);

CREATE TABLE IF NOT EXISTS smf.alerts (
  id          TEXT PRIMARY KEY,
  kind        TEXT NOT NULL,
  severity    TEXT NOT NULL,
  title       TEXT NOT NULL,
  body        TEXT NOT NULL DEFAULT '',
  dedup_key   TEXT UNIQUE,
  status      TEXT NOT NULL DEFAULT 'open',
  data        JSONB NOT NULL DEFAULT '{}',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  notified    JSONB NOT NULL DEFAULT '[]'
);

-- Cada llamada a una API externa con efectos, real o simulada. En modo de
-- prueba es la única huella de lo que se HUBIERA hecho.
CREATE TABLE IF NOT EXISTS smf.api_calls (
  id        BIGSERIAL PRIMARY KEY,
  at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  service   TEXT NOT NULL,
  method    TEXT NOT NULL,
  path      TEXT NOT NULL,
  dry_run   BOOLEAN NOT NULL,
  status    INT,
  request   JSONB NOT NULL DEFAULT '{}',
  response  JSONB NOT NULL DEFAULT '{}'
);

-- OAuth para el conector MCP de Claude (Cowork / claude.ai / Desktop).
CREATE TABLE IF NOT EXISTS smf.oauth_clients (
  client_id     TEXT PRIMARY KEY,
  name          TEXT NOT NULL DEFAULT '',
  redirect_uris JSONB NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS smf.oauth_codes (
  code_hash      TEXT PRIMARY KEY,
  client_id      TEXT NOT NULL,
  redirect_uri   TEXT NOT NULL,
  code_challenge TEXT NOT NULL,
  scope          TEXT NOT NULL DEFAULT 'smf',
  expires_at     TIMESTAMPTZ NOT NULL,
  used           BOOLEAN NOT NULL DEFAULT false
);
CREATE TABLE IF NOT EXISTS smf.oauth_tokens (
  token_hash TEXT PRIMARY KEY,
  kind       TEXT NOT NULL,
  client_id  TEXT NOT NULL,
  scope      TEXT NOT NULL DEFAULT 'smf',
  expires_at TIMESTAMPTZ NOT NULL,
  revoked    BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS smf.panel_sessions (
  id_hash    TEXT PRIMARY KEY,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS smf.migrations (
  name       TEXT PRIMARY KEY,
  applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
