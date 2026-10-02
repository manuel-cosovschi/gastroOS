import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { z } from 'zod';
import {
  afterApproval,
  provisionStore,
  resendAccess,
  sendReadyNotice,
  type ProvisionResult,
} from '@/lib/signup-flow';

/**
 * Lo que el panel de SOVARE le pide a la landing sobre una contratación.
 *
 * El panel decide (aprobar, avisar que está listo) pero no puede hacer el resto:
 * no tiene la clave de servicio ni la de Resend, y no debe tenerlas. Esas viven
 * acá. Así que después de guardar una decisión, el panel llama a este endpoint, y
 * la landing hace lo que corresponde: crear la cuenta, mandar el mail.
 *
 * Quién llama: el panel manda el token de sesión del administrador que está
 * logueado, y acá se le pregunta a Supabase si ese token es bueno y si esa
 * persona figura en `sovare.admins`. No hay una clave compartida que pueda
 * filtrarse ni rotar: si alguien no es administrador, el token no sirve de nada.
 *
 * Qué puede pedir: sólo efectos secundarios de algo que la base ya dice. El
 * endpoint no recibe montos, ni mails, ni estados; lee todo de la contratación.
 * Pedir `aprobada` sobre un pago que no está aprobado no hace nada.
 */

export const dynamic = 'force-dynamic';
// Crear una cuenta y mandar un mail juntos pueden pasar los 10 segundos.
export const maxDuration = 60;

const id = z.string().uuid();

const bodySchema = z.discriminatedUnion('accion', [
  z.object({ accion: z.literal('aprobada'), signupId: id }),
  z.object({ accion: z.literal('reenviar_mail'), signupId: id }),
  z.object({ accion: z.literal('crear_tienda'), signupId: id }),
  z.object({ accion: z.literal('reenviar_acceso'), signupId: id }),
  z.object({
    accion: z.literal('lista'),
    signupId: id,
    entryUrl: z.string().trim().max(300).optional(),
    note: z.string().trim().max(500).optional(),
  }),
]);

function json(body: Record<string, unknown>, status = 200) {
  return NextResponse.json(body, { status, headers: { 'Cache-Control': 'no-store' } });
}

/** El administrador detrás del token, o null si el token no sirve o no es admin. */
async function adminFrom(request: Request): Promise<{ id: string } | null> {
  const jwt = /^Bearer\s+(\S+)$/i.exec(request.headers.get('authorization') || '')?.[1];
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!jwt || !url || !anon) return null;

  const client = createClient(url, anon, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${jwt}` } },
    db: { schema: 'sovare' },
  });

  const {
    data: { user },
    error,
  } = await client.auth.getUser(jwt);
  if (error || !user) return null;

  // Con el token del usuario, RLS ya sólo deja ver la lista a los administradores.
  const { data } = await client.from('admins').select('user_id').eq('user_id', user.id).maybeSingle();
  return data ? { id: user.id } : null;
}

function summarize(provision: ProvisionResult | null) {
  if (!provision) return null;
  return provision.ok
    ? { ok: true, created: provision.created, slug: provision.slug, storeUrl: provision.storeUrl }
    : { ok: false, reason: provision.reason, message: provision.message };
}

export async function POST(request: Request) {
  if (!(await adminFrom(request))) return json({ ok: false, message: 'No autorizado.' }, 401);

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return json({ ok: false, message: 'Pedido inválido.' }, 400);
  const body = parsed.data;

  try {
    switch (body.accion) {
      case 'aprobada':
      case 'reenviar_mail': {
        const outcome = await afterApproval(body.signupId, 'panel', {
          force: body.accion === 'reenviar_mail',
        });
        return json({
          ok: true,
          mail: outcome.mail,
          mailReason: outcome.mailReason ?? null,
          provision: summarize(outcome.provision),
        });
      }

      case 'crear_tienda': {
        const provision = await provisionStore(body.signupId);
        return json({ ok: provision.ok, provision: summarize(provision) });
      }

      case 'lista': {
        const result = await sendReadyNotice(body.signupId, {
          entryUrl: body.entryUrl || null,
          note: body.note || null,
        });
        return json(result.ok ? { ok: true } : { ok: false, message: result.message });
      }

      case 'reenviar_acceso': {
        const result = await resendAccess(body.signupId);
        return json(
          result.ok ? { ok: true, link: result.detail ?? null } : { ok: false, message: result.message }
        );
      }
    }
  } catch (error) {
    console.error('[api/interno/contratacion] falló:', error);
    return json({ ok: false, message: 'Algo falló del lado de la landing.' }, 500);
  }
}
