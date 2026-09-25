'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { listPackages, togglePackageActive } from '@/actions/packages';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { formatPrice } from '@/lib/utils';
import type { PackageDetail } from '@/types';
import { Plus, Pencil } from 'lucide-react';
import { toast } from 'sonner';

export default function PaquetesAdminPage() {
  const [packages, setPackages] = useState<PackageDetail[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    const data = await listPackages();
    setPackages(data);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const handleToggle = async (id: string) => {
    const result = await togglePackageActive(id);
    if (result.success) {
      toast.success('Estado actualizado');
      load();
    } else {
      toast.error(result.error || 'Error');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-stone-900">Paquetes</h1>
        <Button asChild>
          <Link href="/admin/combos/nuevo">
            <Plus className="mr-2 h-4 w-4" /> Nuevo paquete
          </Link>
        </Button>
      </div>

      <div className="rounded-lg border border-stone-200 bg-white overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-stone-200 border-t-stone-900" />
          </div>
        ) : packages.length === 0 ? (
          <p className="px-6 py-16 text-center text-stone-500">No hay paquetes creados.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-stone-200 bg-stone-50">
                <tr>
                  <th className="px-4 py-3 text-left font-medium text-stone-500">Nombre</th>
                  <th className="px-4 py-3 text-left font-medium text-stone-500">Productos</th>
                  <th className="px-4 py-3 text-left font-medium text-stone-500">Precio</th>
                  <th className="px-4 py-3 text-left font-medium text-stone-500">Estado</th>
                  <th className="px-4 py-3 text-left font-medium text-stone-500">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-200">
                {packages.map((pkg) => (
                  <tr key={pkg.id} className="hover:bg-stone-50">
                    <td className="px-4 py-3 font-medium text-stone-900">{pkg.name}</td>
                    <td className="px-4 py-3 text-stone-600">{pkg.items.length} productos</td>
                    <td className="px-4 py-3 text-stone-900">{formatPrice(pkg.price)}</td>
                    <td className="px-4 py-3">
                      <button onClick={() => handleToggle(pkg.id)}>
                        <Badge variant={pkg.is_active ? 'default' : 'secondary'}>
                          {pkg.is_active ? 'Activo' : 'Inactivo'}
                        </Badge>
                      </button>
                    </td>
                    <td className="px-4 py-3">
                      <Button asChild variant="ghost" size="sm">
                        <Link href={`/admin/combos/${pkg.id}`}>
                          <Pencil className="mr-1 h-3 w-3" /> Editar
                        </Link>
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
