# Agregar un producto

La Skill no cambia: alcanza con un archivo en el catálogo.

## 1. Que el producto esté listo para recibir tráfico

- Página `/conv` con variantes `?v=` (copiar `src/app/conv`, `src/lib/conv` y `src/components/conv` de GastroOS o AlojaOS, como explica `gastroOS/docs/conv.md`).
- Píxel y CAPI cargados en su despliegue.
- Capturas y, si se puede, una grabación real (copiar `scripts/capturas.mts` / `videos.mts` con la guarda de datos personales).
- Precios en un archivo de código (una constante), no sólo en el HTML.

## 2. El archivo del catálogo

`catalog/products/<id>.json` (el id en minúsculas, igual que el nombre del archivo). Copiar `gastroos.json` como plantilla y completar:

- `repo`: URL, rama de producción y carpeta local.
- `audiences`, `angles`, `claims`: **cada uno con `evidence`** = un archivo del repo y un texto que esté literalmente ahí. Los ángulos son los titulares de las variantes de `/conv` (`conv_variant`), con la misma bajada.
- `pricing.extract`: dónde está la constante de precios y cómo se llaman sus campos (`map`).
- `assets`: capturas y grabaciones con `device` (`phone`, `desktop`, `desktop-strip`).
- `brand`: colores y tipografías (si la tipografía no es Fraunces, Karla o Archivo, agregar su paquete `@fontsource` y sumarla en `src/creative/template.ts`).
- `rules`: lo que no se puede decir o mostrar.
- `marketable: false` hasta que el dueño decida lo contrario.

## 3. Verificar

```bash
npx tsx src/cli.ts op product_analyze     # todas las evidencias tienen que dar ok
npx tsx src/cli.ts op landing_verify '{"product":"<id>"}'
npm test                                  # el test de catálogo revisa todas las evidencias
```

Sacarlo de `catalog/ecosystem.json` si estaba como candidato, poner `marketable: true` y desplegar.

## 4. Conversiones

- Lectura de su base: agregar una función en `src/conversion/sources.ts` (sólo columnas sin datos personales) y su variable de conexión.
- O que el producto mande eventos firmados a `/api/events`.
- Píxel en la Factory: `META_PIXEL_ID_<ID>` y `META_CAPI_TOKEN_<ID>`.
