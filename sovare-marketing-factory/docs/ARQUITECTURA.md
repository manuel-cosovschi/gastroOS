# Arquitectura

```
                     ┌──────────────────────── Claude ─────────────────────────┐
                     │  Cowork / claude.ai / Desktop        Claude Code         │
                     │  Skill sovare-marketing-factory      Skill + CLI local   │
                     └──────────┬───────────────────────────────┬──────────────┘
                     conector MCP (OAuth, actor agent)    npm run smf / smf.mjs
                                │                               │
┌───────────────────────────────▼───────────────────────────────▼─────────────────┐
│                       Sovare Marketing Factory (servicio)                        │
│                                                                                  │
│  /mcp  /api/ops/*  /api/events (HMAC)  /oauth/*  /panel (dueño)  /healthz        │
│                         │                                                        │
│                  ops.ts — una sola lista de operaciones                          │
│                         │                                                        │
│   core/policy.ts  guard(): niveles 1/2/3, pausa general, topes, canales,         │
│                   autorizaciones (sólo las decide el dueño)                      │
│                                                                                  │
│  catalog/   Product Intelligence  catálogo JSON + evidencias verificadas en repo  │
│  creative/  Creative Engine       conceptos → proyecto → Chromium → FFmpeg       │
│  meta/      Meta Ads + Orgánico   Graph v26, simulado en modo prueba, CAPI       │
│  conversion/ Conversión           /conv, eventos firmados, lectura de bases      │
│  optimize/  Optimización          reglas con muestra mínima y Wilson             │
│  notify/    Avisos                mail (Resend), Telegram, webhook (n8n)         │
│  report/    Reportes                                                             │
│  runtime/   Scheduler             cola en Postgres, cron AR, tick / serve        │
└───────────────┬───────────────────────┬──────────────────────────┬───────────────┘
                │                       │                          │
         Postgres (smf.*)       Meta Graph API            Repos y bases de los
         Supabase o propio      (Ads, IG, Páginas, CAPI)  productos (sólo lectura)
```

## Decisiones

**Servicio + Skill, separados.** La Skill son instrucciones; no corre sola. El servicio es el que trabaja con Claude cerrado: un proceso `smf serve` (Docker) con un tick cada 30 s, o `smf tick` disparado por cron (GitHub Actions, Vercel Cron, n8n). Los dos usan la misma cola, así que se pueden combinar (por ejemplo, el servicio para la API y GitHub Actions para renderizar).

**Una sola lista de operaciones.** `ops.ts` define cada operación con su entrada (zod). La exponen el MCP, la API y la CLI. Ningún flujo de la Skill depende de una llamada improvisada.

**Los controles están en el código que actúa.** `guard()` se llama adentro de cada función con efectos (crear en Meta, lanzar, publicar, cambiar presupuesto), no en la capa de transporte. El cliente de Graph se niega a escribir sin una decisión de `guard()`. El actor lo fija el transporte: lo que entra por MCP/API es `agent`, y `agent` no tiene forma de aprobar.

**Modo de prueba de verdad.** En `test` las escrituras a Meta no salen: se registran en `smf.api_calls` y devuelven ids `dry_…`. Una campaña simulada nunca se promueve a real. Las lecturas (verificar cuenta, métricas) sí van a Meta. Pausar algo real se hace de verdad siempre.

**Nada inventado.** Cada claim, ángulo y precio tiene una evidencia (archivo + texto exacto) en el repo del producto; el análisis la verifica en cada corrida. El validador de copy rechaza números que no estén en los hechos verificados. Los videos usan capturas y grabaciones reales generadas por los scripts de cada producto.

**Video sin dependencias de pago.** Composición HTML/CSS con una función `__render(t)` determinística, capturada cuadro a cuadro con Chromium y codificada con FFmpeg (H.264 + AAC, faststart). Las grabaciones reales se pasan a cuadros (el Chromium de Playwright no decodifica H.264). Se eligió esto antes que Remotion por: sin licencia que revisar, sin descarga de navegador propia, y el mismo Chromium que ya usan los productos para sus capturas.

**Datos personales afuera.** Los eventos guardan tipo, monto, plan y atribución; el contacto queda en la base del producto. La lectura de las bases usa un rol de sólo lectura y selecciona columnas sin datos personales.

**OAuth propio para Cowork.** Los conectores personalizados de Claude piden OAuth (DCR o CIMD) o encabezados estáticos (beta). La Factory trae un servidor OAuth 2.1 mínimo: DCR, PKCE S256, refresh rotado, redirecciones sólo de Claude, y el consentimiento lo da el dueño con su llave.

## Tablas (`smf.*`)

`settings` (modo, pausa, política, valores por defecto) · `products`, `product_snapshots` · `concepts`, `creatives` · `campaigns`, `ads` · `metrics_daily` · `events` · `organic_posts` · `landing_checks` · `jobs`, `schedules`, `heartbeats` · `approvals`, `audit_log`, `alerts`, `api_calls` · `oauth_*`, `panel_sessions`.

## Tareas programadas (hora argentina)

| Tarea | Cuándo |
|---|---|
| Catálogo y cambios de producto | 6:10 |
| Repos nuevos | lunes 6:20 |
| /conv y píxel | 6:30 y 14:30 |
| Leads y ventas de los productos | cada 15 min |
| Métricas de Meta | cada 2 h |
| Estado y revisión de anuncios | cada hora |
| Optimización | 9:00 y 18:00 |
| Orgánico vencido | cada 10 min |
| Reporte semanal | lunes 8:00 |
| Salud | cada 30 min |
