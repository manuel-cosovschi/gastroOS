/**
 * Las variantes del titular de la página de conversión.
 *
 * La variante la elige el anuncio con `?v=`: `gastroos.shop/conv?v=stock`.
 * No se reparte al azar: sin un volumen de visitas que lo sostenga, un reparto
 * aleatorio da diferencias que son ruido, y alguien termina declarando
 * ganadora a la que tuvo suerte. Con la variante atada al anuncio, cada
 * campaña le habla a su público y la comparación se hace en el administrador
 * de anuncios, con el costo por consulta y por contratación de cada una.
 *
 * La variante viaja en la atribución: aparece en cada evento y en las notas de
 * cada consulta. **No hay ganadora declarada**: eso lo deciden los números.
 *
 * Sumar una: agregarla acá. Ninguna puede prometer algo que el sistema no hace.
 */

export const VARIANTES = {
  base: {
    para: 'Para pastelerías, viandas, catering y todo lo que se hace por encargo',
    titulo: 'Tus pedidos por encargo,',
    acento: 'en una sola pantalla',
    bajada: 'Cargás el pedido con su fecha y su seña, y el sistema te dice qué entregás cada día, qué te falta comprar y cuánto ganaste.',
  },
  stock: {
    para: 'Para negocios que producen por encargo',
    titulo: 'Que no te falte un insumo',
    acento: 'la semana de más pedidos',
    bajada: 'Cada producto con su receta: al confirmar un pedido se descuenta el stock y te avisa qué está bajo el mínimo antes de que te quedes sin.',
  },
  costos: {
    para: 'Para pastelerías, viandas y catering',
    titulo: 'Sabé cuánto te cuesta',
    acento: 'cada cosa que vendés',
    bajada: 'El costo sale de la receta de cada producto. Con tus gastos cargados ves la ganancia y el margen del mes, no sólo lo que facturaste.',
  },
  pedidos: {
    para: 'Para los que toman pedidos por WhatsApp',
    titulo: 'Ningún pedido más',
    acento: 'perdido en un chat',
    bajada: 'Cada encargo queda con su fecha, su seña y su saldo. Abrís el sistema y ves lo que sale hoy, ordenado por hora.',
  },
} as const;

export type ClaveDeVariante = keyof typeof VARIANTES;

export function varianteDe(v: string | undefined): ClaveDeVariante {
  return v && v in VARIANTES ? (v as ClaveDeVariante) : 'base';
}
