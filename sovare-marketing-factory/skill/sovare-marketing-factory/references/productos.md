# Productos

## Dónde está la verdad

El catálogo vive en el servicio (`catalog/products/<id>.json` del repo de la Factory) y se lee con **`products_list`**. Esta referencia explica cómo está armado; **no copies datos de acá**: pueden estar viejos. Los precios, claims y ángulos vigentes son los que devuelve el servicio.

Cada producto tiene:

- **Hechos con evidencia.** Cada claim y cada ángulo trae `evidence: { file, contains }`: un texto exacto que tiene que estar en el repo del producto. `product_analyze` lo verifica; si el texto desapareció (cambió la página, cambió el precio), el claim deja de poder usarse y los conceptos que lo usaban quedan `stale`.
- **Planes** leídos del código del producto (sin ejecutarlo) con su fecha (`pricing.price_note`).
- **Ángulos**: los mismos titulares que el producto ya usa en su /conv, cada uno con su variante `?v=`. Un anuncio de un ángulo manda a la variante que dice lo mismo.
- **Recursos visuales reales**: capturas y grabaciones generadas por los scripts de cada repo, con datos de demo o de ejemplo (nunca de clientes).
- **Reglas** propias (p. ej. «no nombrar competidores», «no mostrar paneles de clientes») y **bloqueos** conocidos (p. ej. falta el píxel).

## Estado al 21/10/2026 (orientativo)

| Producto | Qué es | Vende | /conv | Bloqueos |
|---|---|---|---|---|
| GastroOS | Gestión para negocios gastronómicos por encargo | Online: planes → /contratar | gastroos.shop/conv (4 variantes) | Sin píxel ni CAPI en producción; Purchase no se envía al aprobar el pago |
| AlojaOS | Reservas propias para complejos de 3 a 15 unidades | Asistida: consulta → venta | alojaos.shop/conv (3 variantes) | Sin píxel ni CAPI en producción |

Otros repositorios se revisaron y no son productos anunciables hoy (ver `catalog/ecosystem.json` en el servicio): RestOps está en desarrollo (sin interfaz); COSOV. y Las Cañas son casos de clientes; el resto son proyectos de terceros o personales.

## Agregar un producto

No lo hagas desde la conversación: es un cambio en el repo de la Factory que decide el dueño. La guía está en `docs/AGREGAR-PRODUCTO.md` del repo. Lo que sí podés hacer: `products_discover` y proponer el archivo con evidencias concretas.
