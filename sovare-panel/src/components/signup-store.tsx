'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, Mail, Send, Store } from 'lucide-react';
import {
  createStoreNow,
  notifyReady,
  resendAccess,
  resendApprovalMail,
} from '@/actions/signups';

/**
 * Lo que se puede hacer con la cuenta de un cliente después de aprobar el pago.
 *
 * Son cuatro cosas y cada una llama a la landing, que es la que tiene la clave de
 * servicio y la de Resend:
 *
 *   - crear el negocio y la cuenta, cuando no salieron solos (o por adelantado en
 *     los planes con puesta a punto);
 *   - reenviar el mail de confirmación;
 *   - reabrir la contraseña y mandar el link, cuando alguien la perdió;
 *   - avisar que el sistema está listo, en los planes que lo armamos nosotros.
 */

interface Props {
  id: string;
  /** El plan no lleva puesta a punto: la cuenta se crea sola al aprobar el pago. */
  selfService: boolean;
  slug: string | null;
  /** `tunegocio.gastroos.shop`, ya armada; null si todavía no hay negocio. */
  address: string | null;
  provisioned: boolean;
  provisionError: string | null;
  passwordSetAt: string | null;
  notifiedAt: string | null;
  readyNotifiedAt: string | null;
}

type Feedback = { notice?: string; warning?: string; error?: string } | null;

const dateFormat = new Intl.DateTimeFormat('es-AR', { dateStyle: 'medium', timeStyle: 'short' });
const when = (value: string) => dateFormat.format(new Date(value));

export function SignupStore(props: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [feedback, setFeedback] = useState<Feedback>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [entryUrl, setEntryUrl] = useState('');
  const [note, setNote] = useState('');

  const run = (
    key: string,
    action: () => Promise<{ success: boolean; error?: string; notice?: string; warning?: string }>
  ) => {
    setFeedback(null);
    setBusy(key);
    startTransition(async () => {
      const result = await action();
      setBusy(null);
      setFeedback(
        result.success
          ? { notice: result.notice, warning: result.warning }
          : { error: result.error || 'No se pudo.' }
      );
      if (result.success) router.refresh();
    });
  };

  const button =
    'inline-flex h-9 items-center gap-2 rounded-lg border border-stone-300 bg-white px-3 text-sm font-medium text-stone-700 transition-colors hover:bg-stone-50 disabled:opacity-50';
  const primary =
    'inline-flex h-9 items-center gap-2 rounded-lg bg-brand-800 px-4 text-sm font-medium text-white transition-colors hover:bg-brand-900 disabled:opacity-50';

  const spinner = (key: string) =>
    busy === key ? <Loader2 className="h-4 w-4 animate-spin" /> : null;

  return (
    <div className="space-y-5 px-5 py-4">
      {/* ---------- La cuenta ---------- */}
      {props.provisioned ? (
        <dl className="space-y-1.5 text-sm">
          <div className="flex items-start justify-between gap-3">
            <dt className="shrink-0 text-stone-500">Negocio</dt>
            <dd className="min-w-0 break-all text-right font-mono text-xs text-stone-900">
              {props.slug}
            </dd>
          </div>
          {props.address && (
            <div className="flex items-start justify-between gap-3">
              <dt className="shrink-0 text-stone-500">Su tienda</dt>
              <dd className="min-w-0 break-all text-right text-stone-900">{props.address}</dd>
            </div>
          )}
          <div className="flex items-start justify-between gap-3">
            <dt className="shrink-0 text-stone-500">Contraseña</dt>
            <dd className="text-right text-stone-900">
              {props.passwordSetAt ? `La eligió el ${when(props.passwordSetAt)}` : 'Todavía no la eligió'}
            </dd>
          </div>
        </dl>
      ) : (
        <div className="space-y-3">
          <p className="text-sm leading-relaxed text-stone-600">
            {props.selfService
              ? 'La cuenta de este cliente no se creó sola.'
              : 'Todavía no tiene su negocio en GastroOS. Podés crearlo por adelantado y cargarle el catálogo antes de avisarle.'}
          </p>
          {props.provisionError && (
            <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-stone-800">
              {props.provisionError}
            </p>
          )}
          <button
            type="button"
            className={primary}
            disabled={pending}
            onClick={() => run('crear', () => createStoreNow(props.id))}
          >
            {spinner('crear') || <Store className="h-4 w-4" />}
            Crear su negocio y su cuenta
          </button>
        </div>
      )}

      {/* ---------- Los mails ---------- */}
      <div className="space-y-2 border-t border-stone-100 pt-4">
        <p className="flex items-center gap-1.5 text-sm text-stone-600">
          <Mail className="h-4 w-4 shrink-0 text-stone-400" />
          {props.notifiedAt
            ? `Mail de confirmación enviado el ${when(props.notifiedAt)}`
            : 'El mail de confirmación no salió'}
        </p>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className={button}
            disabled={pending}
            onClick={() => run('mail', () => resendApprovalMail(props.id))}
          >
            {spinner('mail')}
            Reenviar el mail
          </button>
          {props.provisioned && (
            <button
              type="button"
              className={button}
              disabled={pending}
              onClick={() => run('acceso', () => resendAccess(props.id))}
            >
              {spinner('acceso')}
              Reenviar el acceso
            </button>
          )}
        </div>
        {props.provisioned && (
          <p className="text-xs leading-relaxed text-stone-500">
            &quot;Reenviar el acceso&quot; reabre la elección de contraseña y le manda el link. Usalo
            cuando la perdió.
          </p>
        )}
      </div>

      {/* ---------- Avisar que está listo ---------- */}
      {!props.selfService && (
        <div className="space-y-3 border-t border-stone-100 pt-4">
          <p className="text-sm font-medium text-stone-900">Avisar que su sistema está listo</p>
          <p className="text-xs leading-relaxed text-stone-500">
            {props.readyNotifiedAt
              ? `Ya se le avisó el ${when(props.readyNotifiedAt)}. Podés volver a avisarle.`
              : 'Le llega un mail con el acceso y el próximo paso, la videollamada de capacitación.'}
          </p>
          {!props.provisioned && (
            <div>
              <label htmlFor="entry-url" className="text-xs font-medium text-stone-700">
                Dirección donde entra
              </label>
              <input
                id="entry-url"
                type="url"
                value={entryUrl}
                onChange={(event) => setEntryUrl(event.target.value)}
                placeholder="https://… (si lo armaste aparte)"
                className="mt-1 w-full rounded-md border border-stone-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
              />
            </div>
          )}
          <div>
            <label htmlFor="ready-note" className="text-xs font-medium text-stone-700">
              Un renglón para él (opcional)
            </label>
            <textarea
              id="ready-note"
              value={note}
              onChange={(event) => setNote(event.target.value)}
              rows={2}
              maxLength={500}
              className="mt-1 w-full rounded-md border border-stone-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
            />
          </div>
          <button
            type="button"
            className={primary}
            disabled={pending}
            onClick={() => run('lista', () => notifyReady(props.id, entryUrl, note))}
          >
            {spinner('lista') || <Send className="h-4 w-4" />}
            Avisarle que está lista
          </button>
        </div>
      )}

      {feedback?.error && <p className="text-sm text-rose-600">{feedback.error}</p>}
      {feedback?.warning && (
        <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-stone-800">
          {feedback.warning}
        </p>
      )}
      {feedback?.notice && <p className="text-sm text-emerald-700">{feedback.notice}</p>}
    </div>
  );
}
