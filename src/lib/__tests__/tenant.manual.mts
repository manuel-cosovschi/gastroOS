/**
 * El reconocimiento de tiendas por subdominio. No hay corredor de tests en este
 * proyecto, así que se corre a mano:
 *
 *   npx tsx src/lib/__tests__/tenant.manual.mts
 *
 * Es la puerta por la que se decide qué tienda se muestra, así que cada caso de
 * acá es un intento de colarse (un host parecido, un subdominio reservado, un
 * nombre con caracteres raros) o un nombre real que tiene que dar una dirección
 * válida.
 */
process.env.NEXT_PUBLIC_SITE_URL = 'https://gastroos.shop';
delete process.env.NEXT_PUBLIC_ROOT_DOMAIN;
delete process.env.TENANT_STORES;

const t = await import('../tenant');

let fallas = 0;
const check = (ok: boolean, nombre: string, detalle = '') => {
  if (!ok) fallas += 1;
  console.log(`${ok ? 'OK    ' : 'FALLA '} ${nombre}${detalle ? `  [${detalle}]` : ''}`);
};
const igual = (real: unknown, esperado: unknown, nombre: string) =>
  check(real === esperado, nombre, `esperaba ${JSON.stringify(esperado)}, dio ${JSON.stringify(real)}`);

// ---------- Hosts ----------
igual(t.tenantFromHost('dulce.gastroos.shop'), 'dulce', 'un subdominio es una tienda');
igual(t.tenantFromHost('DULCE.GastroOS.shop'), 'dulce', 'mayúsculas no importan');
igual(t.tenantFromHost('panaderia-nandu.gastroos.shop'), 'panaderia-nandu', 'con guiones');
igual(t.tenantFromHost('dulce.gastroos.shop:443'), 'dulce', 'el puerto estándar no cuenta');
igual(t.tenantFromHost('dulce.gastroos.shop.'), 'dulce', 'el punto final del DNS no cuenta');
igual(t.tenantFromHost('gastroos.shop'), null, 'el dominio raíz no es una tienda');
igual(t.tenantFromHost('www.gastroos.shop'), null, 'www está reservado');
igual(t.tenantFromHost('admin.gastroos.shop'), null, 'admin está reservado');
igual(t.tenantFromHost('send.gastroos.shop'), null, 'send (el mail) está reservado');
igual(t.tenantFromHost('demo-ae06c91fa4894f68.gastroos.shop'), null, 'las copias de la demo no son tiendas');
igual(t.tenantFromHost('a.b.gastroos.shop'), null, 'dos niveles no es una tienda');
igual(t.tenantFromHost('ab.gastroos.shop'), null, 'menos de 3 letras no es una tienda');
igual(t.tenantFromHost('x_y_z.gastroos.shop'), null, 'guion bajo no es válido en DNS');
igual(t.tenantFromHost('-abc.gastroos.shop'), null, 'no puede empezar con guion');
igual(t.tenantFromHost('abc-.gastroos.shop'), null, 'no puede terminar con guion');
igual(t.tenantFromHost('evilgastroos.shop'), null, 'un dominio parecido no es el raíz');
igual(t.tenantFromHost('dulce.gastroos.shop.evil.com'), null, 'el raíz tiene que estar al final');
igual(t.tenantFromHost('dulce.evil-gastroos.shop'), null, 'un dominio que termina parecido');
igual(t.tenantFromHost('gastroos-gilt.vercel.app'), null, 'el dominio de un deploy no es una tienda');
igual(t.tenantFromHost('localhost:3000'), null, 'localhost no es una tienda');
igual(t.tenantFromHost(''), null, 'host vacío');
igual(t.tenantFromHost(null), null, 'sin host');

// ---------- Subdominios que no son tiendas ----------
check(t.isOtherRootSubdomain('www.gastroos.shop'), 'www es un subdominio que no es tienda');
check(t.isOtherRootSubdomain('admin.gastroos.shop'), 'admin también');
check(t.isOtherRootSubdomain('demo-abc.gastroos.shop'), 'y los de la demo');
check(t.isOtherRootSubdomain('a.b.gastroos.shop'), 'y los de dos niveles');
check(!t.isOtherRootSubdomain('dulce.gastroos.shop'), 'una tienda no');
check(!t.isOtherRootSubdomain('gastroos.shop'), 'el dominio raíz tampoco');
check(!t.isOtherRootSubdomain('gastroos-gilt.vercel.app'), 'ni un host de otro dominio');
check(!t.isOtherRootSubdomain('evilgastroos.shop') && !t.isOtherRootSubdomain(null), 'ni uno parecido ni vacío');

// ---------- Nombres ----------
igual(t.slugFromName('Panadería Ñandú'), 'panaderia-nandu', 'tildes y eñes');
igual(t.slugFromName('Dulce & Salado'), 'dulce-y-salado', 'el & se lee "y"');
igual(t.slugFromName('  Café   del   Sur  '), 'cafe-del-sur', 'espacios de más');
igual(t.slugFromName('Yo'), 'yo-tienda', 'muy corto se completa');
igual(t.slugFromName('!!!'), 'mi-tienda', 'sin letras ni números');
igual(t.slugFromName('😀😀'), 'mi-tienda', 'sólo emojis');
const largo = t.slugFromName('Pastelería artesanal de la familia Rodríguez González en Mar del Plata');
check(largo.length <= 40 && !largo.endsWith('-') && t.isValidSlug(largo), 'un nombre largo se corta bien', largo);
check(t.isValidSlug(t.slugFromName('Torta Mía')), 'el resultado siempre es una dirección válida');
check(!/<|>|"|'|;|\s/.test(t.slugFromName('<script>alert(1)</script>')), 'nada raro pasa al slug');

// ---------- Reservados y válidos ----------
check(t.isReservedSlug('admin') && t.isReservedSlug('demo-123') && t.isReservedSlug('cosov'), 'reservados');
check(!t.isReservedSlug('dulce-estudio'), 'dulce-estudio no está reservado');
check(t.isValidSlug('dulce-estudio') && !t.isValidSlug('Dulce') && !t.isValidSlug('a'), 'válidos e inválidos');

// ---------- Direcciones ----------
igual(t.tenantStoreUrl('dulce'), 'https://dulce.gastroos.shop', 'la dirección de una tienda');
igual(t.rootOrigin(), 'https://gastroos.shop', 'el origen raíz');
igual(t.tenantStoresLive(), false, 'las tiendas por subdominio arrancan apagadas');
process.env.TENANT_STORES = 'on';
igual(t.tenantStoresLive(), true, 'TENANT_STORES=on las prende');
process.env.TENANT_STORES = 'true';
igual(t.tenantStoresLive(), false, 'sólo "on" las prende');

// ---------- Otro dominio raíz (puerto incluido), como en una prueba local ----------
process.env.NEXT_PUBLIC_SITE_URL = 'http://gastroos.test:3100';
igual(t.tenantFromHost('dulce.gastroos.test:3100'), 'dulce', 'con puerto, en pruebas locales');
igual(t.tenantFromHost('dulce.gastroos.test'), null, 'sin el puerto no es la misma tienda');
igual(t.tenantStoreUrl('dulce'), 'http://dulce.gastroos.test:3100', 'dirección local');

console.log(`\n${fallas === 0 ? 'TODO OK' : `${fallas} CASO(S) FALLARON`}`);
process.exit(fallas === 0 ? 0 : 1);
