/**
 * API de conversiones de Meta, desde la Factory.
 *
 * Los productos ya mandan `Lead` por CAPI desde su servidor (con el mismo
 * `event_id` que el píxel). Lo que la Factory manda es lo que los productos
 * todavía no: la COMPRA confirmada (`Purchase`), con el monto, cuando el
 * producto avisa que se aprobó un pago. Mismo `event_id` que use el producto,
 * así Meta deduplica si algún día el producto lo manda también.
 *
 * Sin datos personales: sólo `fbp`/`fbc`, el navegador y la URL, igual que
 * hacen los productos.
 *
 * Con `META_TEST_EVENT_CODE` los eventos van a «Probar eventos» del
 * Administrador de eventos y no cuentan para las campañas: es la forma de
 * validar la conexión de verdad sin ensuciar los datos.
 */

import { config } from '../config.ts';
import { guard } from '../core/policy.ts';
import type { Actor } from '../core/audit.ts';
import { graph } from './graph.ts';

export interface CapiEvent {
  product: string;
  event_name: 'Purchase' | 'Lead' | 'InitiateCheckout' | 'Contact' | 'QualifiedLead';
  event_id: string;
  event_time?: number;
  url?: string;
  value?: number;
  currency?: string;
  fbp?: string;
  fbc?: string;
  client_user_agent?: string;
  custom?: Record<string, string | number | undefined>;
}

export async function sendCapi(e: CapiEvent, actor: Actor = 'system'): Promise<{ sent: boolean; simulated?: boolean; reason?: string; response?: unknown }> {
  const { pixelId, capiToken } = config.pixelFor(e.product);
  if (!pixelId || !capiToken) return { sent: false, reason: `sin píxel o token de CAPI para ${e.product}` };
  const dec = await guard({ action: 'capi.send', actor, product: e.product, target: e.event_id, details: { event: e.event_name } });
  const testCode = process.env.META_TEST_EVENT_CODE?.trim();
  const body = {
    data: [
      {
        event_name: e.event_name,
        event_time: e.event_time ?? Math.floor(Date.now() / 1000),
        event_id: e.event_id,
        action_source: 'website',
        ...(e.url ? { event_source_url: e.url } : {}),
        user_data: {
          ...(e.fbp ? { fbp: e.fbp } : {}),
          ...(e.fbc ? { fbc: e.fbc } : {}),
          ...(e.client_user_agent ? { client_user_agent: e.client_user_agent } : {}),
        },
        custom_data: { ...(e.custom ?? {}), ...(e.value ? { value: e.value, currency: e.currency ?? 'ARS' } : {}) },
      },
    ],
    ...(testCode ? { test_event_code: testCode } : {}),
  };
  // Un evento con código de prueba no afecta campañas: se manda de verdad
  // aunque la Factory esté en modo de prueba, porque eso ES la prueba.
  const decision = testCode ? { ...dec, dryRun: false } : dec;
  const response = await graph('POST', `${pixelId}/events`, body, { decision, token: capiToken, dryKind: 'capi' });
  return { sent: !decision.dryRun, simulated: decision.dryRun, response };
}
