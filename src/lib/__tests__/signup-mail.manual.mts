/**
 * Los mails de una contratación y el remitente de los mails de un pedido. No hay
 * corredor de tests en este proyecto, así que se corre a mano:
 *
 *   npx tsx src/lib/__tests__/signup-mail.manual.mts
 *
 * Lo que se mira acá es lo que más cuesta ver a ojo: que nada que escribió un
 * tercero entre al HTML sin escapar, que cada plan reciba lo que le corresponde
 * (el Taller no tiene videollamada ni formulario de alta) y que el remitente no
 * se pueda armar para hacerse pasar por otro.
 */
// tsx carga estos módulos como CommonJS: según el caso los nombres vienen sueltos
// o dentro de `default`. Se juntan las dos formas para no depender de eso.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const cargar = async (ruta: string): Promise<any> => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const m: any = await import(ruta);
  return { ...(m.default ?? {}), ...m };
};
const {
  buildAccessMail,
  buildOwnerAlert,
  buildReadyMail,
  buildSelfServiceApprovalMail,
  buildSelfServicePendingMail,
  buildSetupApprovalMail,
} = await cargar('../signup-mail');
const { fromWithName } = await cargar('../mailer');
const { escapeHtml, oneLine } = await cargar('../html');

let fallas = 0;
const check = (ok: boolean, nombre: string, detalle = '') => {
  if (!ok) fallas += 1;
  console.log(`${ok ? 'OK    ' : 'FALLA '} ${nombre}${detalle ? `  [${detalle}]` : ''}`);
};

const base = {
  token: 'f'.repeat(48),
  contactName: 'Ana Pérez',
  businessName: 'Panadería <b>Ñandú</b> & Hijos',
  planLabel: 'Taller',
  siteUrl: 'https://gastroos.shop',
  whatsappUrl: 'https://wa.me/5492235383082?text=Hola&x=1',
};
const todo = (m: { subject: string; html: string; text: string }) => `${m.subject}\n${m.html}\n${m.text}`;

// ---------- Autoservicio ----------
const taller = buildSelfServiceApprovalMail({
  ...base,
  amount: 15000,
  storeUrl: 'https://panaderia-nandu.gastroos.shop',
  needsPassword: true,
});
check(!taller.html.includes('<b>Ñandú</b>') && taller.html.includes('&lt;b&gt;'), 'el nombre del negocio se escapa en el HTML');
check(taller.text.includes('<b>Ñandú</b>'), 'y en el texto plano va tal cual');
check(!/videollamada|formulario de alta|instalación|montamos/i.test(todo(taller)), 'el Taller no promete videollamada, alta ni instalación');
check(taller.html.includes(`href="https://gastroos.shop/contratar/${base.token}"`), 'sin contraseña elegida, el botón lleva a elegirla');
check(taller.html.includes('panaderia-nandu.gastroos.shop'), 'muestra la dirección de la tienda');
check(taller.html.includes('$&nbsp;15.000') || /\$\s?15\.000/.test(taller.html), 'muestra el monto en pesos', (taller.html.match(/\$[^<]{0,8}15[^<]{0,6}/) || [''])[0]);
check(taller.subject === 'Tu cuenta de GastroOS está lista', 'asunto', taller.subject);

const conClave = buildSelfServiceApprovalMail({ ...base, amount: 15000, storeUrl: null, needsPassword: false });
check(conClave.html.includes('href="https://gastroos.shop/login"'), 'con contraseña ya elegida, el botón lleva a entrar');
check(/se activa en las próximas horas/.test(conClave.html) && !conClave.html.includes('.gastroos.shop"'), 'sin tienda activa no inventa una dirección');
check(conClave.html.includes('wa.me/5492235383082?text=Hola&amp;x=1'), 'el link de WhatsApp se escapa en el atributo');

const pendiente = buildSelfServicePendingMail({ ...base, amount: 15000 });
check(!/ya está creada|ya creamos|ya está lista/i.test(todo(pendiente)), 'si la cuenta no salió, no dice que está creada');
check(/terminando de preparar/.test(pendiente.text), 'dice que la está terminando de preparar');

// ---------- Con puesta a punto ----------
const negocio = buildSetupApprovalMail({ ...base, planLabel: 'Negocio', amount: 87000 });
check(/formulario de alta/.test(negocio.text) && /videollamada/.test(negocio.text), 'Negocio: formulario de alta y videollamada');
check(negocio.html.includes(`href="https://gastroos.shop/alta/${base.token}"`), 'Negocio: el botón lleva al alta');
check(!negocio.html.includes('<b>Ñandú</b>'), 'Negocio: el nombre se escapa');

// ---------- Listo ----------
const listo = buildReadyMail({
  ...base,
  planLabel: 'Negocio',
  entryUrl: 'https://gastroos.shop/login',
  entryLabel: 'Entrar a mi panel',
  storeUrl: 'https://x.gastroos.shop',
  note: 'Cargué <i>todo</i> tu catálogo.',
});
check(listo.html.includes('&lt;i&gt;todo&lt;/i&gt;') && !listo.html.includes('<i>todo</i>'), 'la nota se escapa');
check(listo.subject === 'Tu sistema de GastroOS está listo', 'asunto de "está listo"');
check(/videollamada/.test(listo.text), '"está listo" habla de la capacitación');

// ---------- Acceso ----------
const acceso = buildAccessMail(base);
check(acceso.text.includes(`https://gastroos.shop/contratar/${base.token}`), 'el mail de acceso lleva el link');

// ---------- Aviso al dueño ----------
const aviso = buildOwnerAlert({
  kind: 'pago_a_revisar',
  businessName: 'Local\nCon\r\nSaltos <img src=x onerror=alert(1)>',
  planLabel: 'Taller',
  amount: 15000,
  contactName: 'Ana',
  email: 'ana@example.com',
  whatsapp: null,
  detail: 'El monto no coincide.',
  reviewUrl: 'https://sovare-panel.vercel.app/contrataciones/abc',
});
check(!/[\r\n]/.test(aviso.subject), 'el asunto del aviso va en una sola línea', JSON.stringify(aviso.subject));
check(!aviso.html.includes('<img src=x'), 'el aviso escapa lo que escribió el cliente');
check(aviso.html.includes('https://sovare-panel.vercel.app/contrataciones/abc'), 'el aviso lleva al panel');
check(aviso.subject.startsWith('Comprobante para revisar'), 'asunto del aviso', aviso.subject);

// ---------- Nada de rayas largas en lo que escribimos ----------
const todos = [taller, conClave, pendiente, negocio, listo, acceso, aviso];
check(!todos.some((m) => /—/.test(m.subject + m.html.replace(/Panadería.*?Hijos/g, '') + m.text.replace(/Panadería.*?Hijos/g, ''))), 'ningún mail usa raya larga');

// ---------- Remitente ----------
const from = 'GastroOS <hola@gastroos.shop>';
check(fromWithName(from, 'Dulce Estudio') === '"Dulce Estudio (vía GastroOS)" <hola@gastroos.shop>', 'el remitente lleva el nombre del negocio y la dirección de siempre', fromWithName(from, 'Dulce Estudio'));
const sucio = fromWithName(from, 'Evil" <ceo@banco.com>\r\nBcc: x@y.z');
check(!/[\r\n]/.test(sucio) && (sucio.match(/</g) || []).length === 1 && sucio.endsWith('<hola@gastroos.shop>'), 'un nombre con comillas, ángulos y saltos no cambia la dirección', sucio);
check(!sucio.slice(0, sucio.indexOf('<hola')).includes('@'), 'ni deja una dirección de mail a la vista en el nombre', sucio);
check(!fromWithName(from, 'https://banco.com/login').includes('://'), 'ni un link', fromWithName(from, 'https://banco.com/login'));
check(fromWithName(from, '   ') === from, 'un nombre vacío deja el remitente como estaba');
check(fromWithName('hola@gastroos.shop', 'Dulce') === '"Dulce (vía GastroOS)" <hola@gastroos.shop>', 'un remitente sin nombre también');
check(fromWithName(from, 'x'.repeat(200)).length < 100, 'un nombre larguísimo se corta');

// ---------- Utilidades ----------
check(escapeHtml(`<a href="x">'&'</a>`) === '&lt;a href=&quot;x&quot;&gt;&#39;&amp;&#39;&lt;/a&gt;', 'escapeHtml');
check(oneLine('  a\n\n b   c ', 10) === 'a b c' && oneLine('x'.repeat(50), 10).length === 10, 'oneLine');

console.log(`\n${fallas === 0 ? 'TODO OK' : `${fallas} CASO(S) FALLARON`}`);
process.exit(fallas === 0 ? 0 : 1);
