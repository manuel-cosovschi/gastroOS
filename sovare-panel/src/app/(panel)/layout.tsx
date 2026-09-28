import { redirect } from 'next/navigation';
import { requireAdmin } from '@/lib/supabase/server';
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

  return <Shell email={admin.email}>{children}</Shell>;
}
