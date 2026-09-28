import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { createServerClient } from '@/lib/supabase/server';
import { ClientForm } from '@/components/client-form';
import type { Client } from '@/types';

export const dynamic = 'force-dynamic';

export default async function EditClientPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createServerClient();
  const { data } = await supabase.from('clients').select('*').eq('id', id).maybeSingle();

  const client = data as Client | null;
  if (!client) notFound();

  return (
    <div className="space-y-6">
      <div>
        <Link
          href={`/clientes/${client.id}`}
          className="inline-flex items-center gap-1.5 text-sm text-stone-500 transition-colors hover:text-stone-900"
        >
          <ArrowLeft className="h-4 w-4" />
          {client.business_name}
        </Link>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight text-stone-900">Editar cliente</h1>
      </div>

      <ClientForm client={client} />
    </div>
  );
}
