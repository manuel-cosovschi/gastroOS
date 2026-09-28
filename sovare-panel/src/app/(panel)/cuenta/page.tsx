import { redirect } from 'next/navigation';
import { KeyRound } from 'lucide-react';
import { requireAdmin } from '@/lib/supabase/server';
import { SectionCard } from '@/components/ui';
import { PasswordForm } from '@/components/password-form';

export const metadata = { title: 'Mi cuenta' };
export const dynamic = 'force-dynamic';

export default async function AccountPage() {
  const admin = await requireAdmin();
  if (!admin) redirect('/login');

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-stone-900">Mi cuenta</h1>
        <p className="mt-1 text-sm text-stone-500">{admin.email}</p>
      </div>

      <SectionCard title="Cambiar la contraseña">
        <div className="space-y-5 p-5">
          <p className="flex gap-3 rounded-xl bg-stone-50 px-4 py-3 text-sm leading-relaxed text-stone-600">
            <KeyRound className="mt-0.5 h-4 w-4 shrink-0 text-stone-400" />
            <span>
              Se cambia acá, con la sesión abierta. No hace falta el mail de recuperación ni
              entrar al panel de Supabase.
            </span>
          </p>
          <PasswordForm />
        </div>
      </SectionCard>
    </div>
  );
}
