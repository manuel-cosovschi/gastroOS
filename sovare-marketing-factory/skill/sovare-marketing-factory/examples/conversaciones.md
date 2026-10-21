# Ejemplos

## «Ejecutá el marketing de todos los productos de Sovare»

1. `smf_status` → modo `test`, sin pausa, falta Meta.
2. `smf_marketing_run {}` → `{ job: "job_…" }`.
3. `smf_job_status {job}` hasta `done`.
4. Respuesta:

> **Modo de prueba: nada se publicó ni se gastó.**
>
> **GastroOS** — hechos verificados (8 claims, 4 ángulos, 4 planes desde $15.000/mes, precios de octubre de 2026). /conv responde y muestra las 4 variantes; **el píxel no está instalado**. Generé 2 conceptos («Tus pedidos por encargo, en una sola pantalla», «Que no te falte un insumo…») y 4 videos (9:16 y 4:5), todos validados. La campaña quedó **bloqueada**: no hay píxel configurado, así que Meta no podría optimizar por consultas.
>
> **AlojaOS** — igual: /conv bien, sin píxel; 4 videos listos; campaña bloqueada por el píxel.
>
> **Para avanzar**: cargar el píxel en los dos productos (NEXT_PUBLIC_META_PIXEL_ID en Vercel) y en la Factory (META_PIXEL_ID_GASTROOS / _ALOJAOS); conectar la cuenta de Meta. Los videos se ven en el panel → Creativos.

## «Publicá las campañas aprobadas» (modo real)

1. `smf_campaigns_list {status: "in_meta_paused"}` → `cmp_a1…`.
2. `smf_campaign_launch {campaign: "cmp_a1…"}` → error `needs_approval`: «Es el primer lanzamiento con gasto real de gastroos (nivel 3). Se pidió la autorización apr_…».
3. Respuesta: «No la lancé: es el primer gasto real de GastroOS y eso lo autorizás vos. Te llegó el pedido por mail; también está en el panel → Autorizaciones. Cuando lo apruebes, decime y la lanzo.»

## «Escribí un anuncio que diga que GastroOS te ahorra 10 horas por semana»

1. `smf_concept_create_custom {… "primary_text": "…ahorrá 10 horas por semana…"}` → `check.ok: false`, «el número 10 no está en los hechos verificados de GastroOS».
2. Respuesta: «Eso no lo puedo afirmar: no está medido. Lo que sí está verificado es que "los pedidos se cargan en menos de un minuto". ¿Armo el anuncio con eso?»
