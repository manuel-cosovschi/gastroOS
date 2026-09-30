'use server';

import { randomBytes, randomUUID } from 'node:crypto';
import { redirect } from 'next/navigation';
import { createServerClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/service';
import { DEMO_MODE } from '@/lib/constants';

/**
 * Una demo propia para cada visitante.
 *
 * Antes la demo era una sola cuenta compartida. La guía invita a "cargá un
 * pedido, cambiá un precio, borrá algo", así que alcanzaba con que alguien
 * aceptara la invitación para que el próximo visitante encontrara una demo
 * rota o vacía — y con que dos personas la miraran a la vez para que se
 * pisaran entre ellas.
 *
 * Ahora hay un negocio plantilla, que nadie usa, y al entrar se copia entero:
 * negocio, catálogo, clientes, pedidos, recetas, gastos. Todos ven los mismos
 * datos iniciales, cada uno hace lo que quiere con los suyos, y nadie le toca
 * la demo a nadie.
 *
 * La copia vive tres días desde la última visita. El que vuelve con su sesión
 * abierta encuentra lo que había dejado; el que no vuelve, se limpia solo.
 */

/** Cuánto sobrevive una demo sin que la visiten. */
const DEMO_TTL = '3 days';

/**
 * El dominio de los mails de las cuentas de demo.
 *
 * No recibe correo ni hace falta que exista: la cuenta se crea confirmada con
 * la service role y nunca se le manda nada. Es un dominio propio y no uno
 * inventado para que, si alguna vez alguien mira la lista de usuarios, se
 * entienda de una qué son estas cuentas.
 */
const DEMO_EMAIL_DOMAIN = 'demo.gastroos.shop';

type DemoError = { error: string };

/**
 * Entra a la demo.
 *
 * Nunca devuelve si sale bien: `redirect` funciona lanzando, así que tiene que
 * quedar fuera de cualquier `try`.
 */
export async function enterDemo(): Promise<DemoError | never> {
  if (!DEMO_MODE) return { error: 'La demo no está disponible.' };

  const service = createServiceClient();
  if (!service) {
    console.error('[enterDemo] falta SUPABASE_SERVICE_ROLE_KEY: no se puede armar la demo.');
    return { error: 'La demo no está disponible en este momento.' };
  }

  const supabase = await createServerClient();
  const {
    data: { user: actual },
  } = await supabase.auth.getUser();

  if (actual) {
    // Ya hay sesión. Si es una demo vigente, se vuelve a ella con todo lo que
    // la persona haya dejado hecho; si es una cuenta real, no hay nada que
    // armar y el panel que corresponde es el suyo.
    const { data: suya } = await service.rpc('touch_demo_sandbox', {
      p_user_id: actual.id,
      p_ttl: DEMO_TTL,
    });
    if (suya) redirect('/admin');

    const { data: negocio } = await service
      .from('business_members')
      .select('business_id')
      .eq('user_id', actual.id)
      .limit(1)
      .maybeSingle();
    if (negocio) redirect('/admin');

    // Sesión sin negocio: es una demo que venció y se limpió. Sigue de largo y
    // se le arma una nueva a esta misma persona más abajo.
  }

  // Las demos abandonadas se van justo cuando importa que no estén: al armar
  // la siguiente. No hace falta un cron para algo que se puede hacer acá.
  const { error: purga } = await service.rpc('purge_demo_sandboxes', {});
  if (purga) console.error('[enterDemo] no se pudieron limpiar las demos viejas:', purga.message);

  const email = `demo-${randomUUID()}@${DEMO_EMAIL_DOMAIN}`;
  const password = randomBytes(24).toString('base64url');

  // La contraseña se genera acá y no se guarda en ningún lado: se usa una vez
  // para abrir la sesión y se olvida. Quien vuelve lo hace con su cookie.
  const { data: creado, error: errorAlta } = await service.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    app_metadata: { gastroos_demo: true },
  });

  if (errorAlta || !creado?.user) {
    console.error('[enterDemo] no se pudo crear la cuenta de demo:', errorAlta?.message);
    return { error: 'No pudimos abrir la demo. Probá de nuevo en un momento.' };
  }

  const { error: errorCopia } = await service.rpc('create_demo_sandbox', {
    p_user_id: creado.user.id,
    p_ttl: DEMO_TTL,
  });

  if (errorCopia) {
    console.error('[enterDemo] no se pudo copiar la plantilla:', errorCopia.message);
    // La cuenta sin negocio no sirve para nada y ensucia la lista de usuarios.
    await service.auth.admin.deleteUser(creado.user.id);
    return { error: 'No pudimos abrir la demo. Probá de nuevo en un momento.' };
  }

  const { error: errorSesion } = await supabase.auth.signInWithPassword({ email, password });
  if (errorSesion) {
    console.error('[enterDemo] no se pudo iniciar sesión en la demo:', errorSesion.message);
    return { error: 'No pudimos abrir la demo. Probá de nuevo en un momento.' };
  }

  redirect('/admin');
}

/**
 * Vuelve a empezar: tira esta demo y arma una nueva desde la plantilla.
 *
 * Existe porque la demo invita a romper cosas, y después de romperlas hay que
 * poder volver atrás sin tener que borrar cookies ni entender qué pasó.
 *
 * La sesión se mantiene: se le cambia el negocio a la misma cuenta, así que no
 * hay que volver a entrar.
 */
export async function resetDemo(): Promise<DemoError | never> {
  if (!DEMO_MODE) return { error: 'La demo no está disponible.' };

  const service = createServiceClient();
  if (!service) return { error: 'La demo no está disponible en este momento.' };

  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { error: 'Tu sesión se cerró. Volvé a entrar a la demo.' };

  // Sólo se reinicia una demo. Una cuenta real no se borra por tocar un botón,
  // por más que ese botón no le aparezca nunca.
  const { data: esDemo } = await service
    .from('demo_sandboxes')
    .select('business_id')
    .eq('user_id', user.id)
    .maybeSingle();

  if (!esDemo) return { error: 'Esto no es una demo: no hay nada que reiniciar.' };

  const { error: errorBaja } = await service.rpc('drop_demo_sandbox', { p_user_id: user.id });
  if (errorBaja) {
    console.error('[resetDemo] no se pudo tirar la demo anterior:', errorBaja.message);
    return { error: 'No pudimos reiniciar la demo. Probá de nuevo en un momento.' };
  }

  const { error: errorCopia } = await service.rpc('create_demo_sandbox', {
    p_user_id: user.id,
    p_ttl: DEMO_TTL,
  });

  if (errorCopia) {
    console.error('[resetDemo] no se pudo copiar la plantilla:', errorCopia.message);
    // Se queda sin negocio: el panel lo manda al login, y desde ahí "Entrar a
    // la demo" le arma una nueva. Feo, pero no deja a nadie encerrado.
    return { error: 'No pudimos reiniciar la demo. Entrá de nuevo desde el inicio.' };
  }

  redirect('/admin');
}
