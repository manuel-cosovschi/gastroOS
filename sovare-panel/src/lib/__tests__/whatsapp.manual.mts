/**
 * Casos reales de teléfonos, tomados de las páginas de los negocios que
 * prospectamos. No hay corredor de tests en este proyecto todavía, así que se
 * corre a mano:
 *
 *   npx tsx src/lib/__tests__/whatsapp.manual.mts
 *
 * Vale la pena conservarlos porque cada uno costó un error: el 15 del interior
 * marca celular aunque el abonado arranque con el dígito de los fijos, y el
 * abonado mide distinto según cuántos dígitos tenga el área.
 */
// tsx carga este sub-proyecto como CommonJS, así que los nombres vienen en `default`.
import mod from '../whatsapp';
const { leerNumero, linkWhatsApp, formatearNumero, motivoSinWhatsApp } = mod as any;

/** Los formatos tal como los publican los negocios que encontré. */
const casos: [string, string, boolean][] = [
  // crudo, nacional esperado, es fijo
  ['223 6 886676', '2236886676', false],
  ['+54 223 539-6261', '2235396261', false],
  ['(0223) 474-8469', '2234748469', true],
  ['+5492235058027', '2235058027', false],
  ['542236014838', '2236014838', false],
  ['+542234514322', '2234514322', true],
  ['+54 223 545-6224', '2235456224', false],
  ['+5492235394646', '2235394646', false],
  ['2236999919', '2236999919', false],
  ['0223 15 538-3082', '2235383082', false],
  ['5491150638726', '1150638726', false],
  ['+54 2262 42-1234', '2262421234', true],
  ['+54 9 2262 55-1234', '2262551234', false],
  ['2262 60-1234', '2262601234', false],
  // El 15 manda: celular aunque el abonado arranque con 4.
  ['02262 15417254', '2262417254', false],
  ['+54 9 2262 63-8249', '2262638249', false],
  // Sin 15 y arrancando en 4: fijo de Necochea.
  ['02262 42-1234', '2262421234', true],
];

let mal = 0;
for (const [crudo, esperado, fijo] of casos) {
  const n = leerNumero(crudo);
  const okNac = n?.nacional === esperado;
  const okFijo = n?.esFijo === fijo;
  const marca = okNac && okFijo ? 'ok ' : 'MAL';
  if (!(okNac && okFijo)) mal += 1;
  console.log(
    `${marca} "${crudo}" -> ${n?.nacional ?? 'null'} (esperaba ${esperado}) ` +
      `fijo=${n?.esFijo} (esperaba ${fijo}) ciudad=${n?.ciudad ?? '-'} ` +
      `display="${formatearNumero(crudo)}"`
  );
}

console.log('\n--- links ---');
console.log('celular :', linkWhatsApp('+54 223 539-6261', 'Hola, ¿cómo va?'));
console.log('fijo    :', linkWhatsApp('(0223) 474-8469', 'Hola'), '|', motivoSinWhatsApp('(0223) 474-8469'));
console.log('vacío   :', linkWhatsApp(null), '|', motivoSinWhatsApp(null));
console.log('basura  :', linkWhatsApp('no tiene'), '|', motivoSinWhatsApp('no tiene'));
console.log('\n--- certeza ---');
for (const t of ['02262 15417254', '02262 42-1234', '+54 223 539-6261', '(0223) 474-8469', '5491150638726']) {
  const n = leerNumero(t);
  console.log(`  "${t}" -> ${n?.certeza}  link=${linkWhatsApp(t, 'hola') ? 'sí' : 'no'}`);
}
console.log(`\n${mal} casos mal de ${casos.length}`);
