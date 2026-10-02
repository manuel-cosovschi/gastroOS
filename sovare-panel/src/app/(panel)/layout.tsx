import { redirect } from 'next/navigation';
import { createServerClient, requireAdmin } from '@/lib/supabase/server';
import { Shell } from '@/components/layout/shell';

/**
 * Todo lo que cuelga de acá exige estar en sovare.admins.
 *
 * El middleware ya pidió sesión; esto verifica que además sea admin. Una
 * sesión cualquiera de este proyecto de Supabase —por ejemplo la del usuario
 * de la demo de GastroOS, cuya clave es pública— llega hasta acá y se va.
 */
export default async function PanelLayout({ children }: { children: React.ReactNode }) {
  const admin = await requireAdmin();
  if (!admin) redirect('/login');

  // Los clientes que cargaron los vendedores y esperan aprobación. Si la consulta
  // falla el contador queda en cero: un número que falta no puede tumbar el panel.
  const supabase = await createServerClient();
  const { count } = await supabase
    .from('vendor_sales')
    .select('id', { count: 'exact', head: true })
    .eq('status', 'pendiente');

  return (
    <Shell email={admin.email} badges={{ '/vendedores': count ?? 0 }}>
      {children}
    </Shell>
  );
}
