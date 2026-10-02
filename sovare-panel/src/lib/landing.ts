import { createServerClient } from '@/lib/supabase/server';
import { LANDING_URL } from '@/lib/vendedores';

/**
 * Hablar con la landing desde una acción del panel.
 *
 * Algunas cosas no se pueden hacer desde acá: crear la cuenta de un cliente y
 * mandar un mail necesitan la clave de servicio y la de Resend, y esas viven en
 * la landing, no en este panel. Después de guardar una decisión, el panel le
 * pide a la landing que haga el resto.
 *
 * Se identifica con el token de sesión del administrador que está logueado. La
 * landing le pregunta a Supabase si el token es bueno y si esa persona figura en
 * `sovare.admins`; no hay una clave compartida entre los dos proyectos.
 */

export type LandingResult<T> = { ok: true; data: T } | { ok: false; error: string };

export interface ProvisionSummary {
  ok: boolean;
  created?: boolean;
  slug?: string;
  storeUrl?: string | null;
  reason?: string;
  message?: string;
}

export async function callLanding<T extends Record<string, unknown>>(
  body: Record<string, unknown>
): Promise<LandingResult<T>> {
  const supabase = await createServerClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) return { ok: false, error: 'Se venció la sesión. Volvé a entrar.' };

  try {
    const response = await fetch(`${LANDING_URL}/api/interno/contratacion`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify(body),
      cache: 'no-store',
      // La landing puede tardar: crear una cuenta y mandar un mail son dos llamadas.
      signal: AbortSignal.timeout(55_000),
    });

    const json = (await response.json().catch(() => null)) as
      | (T & { message?: string; ok?: boolean })
      | null;

    if (!json) return { ok: false, error: `La landing respondió ${response.status}.` };
    if (!response.ok) return { ok: false, error: json.message || `La landing respondió ${response.status}.` };
    return { ok: true, data: json };
  } catch (error) {
    console.error('[callLanding] no se pudo hablar con la landing:', error);
    return { ok: false, error: 'No se pudo hablar con la landing. Probá de nuevo en un rato.' };
  }
}
