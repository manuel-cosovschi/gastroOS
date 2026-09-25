'use client';

import { useEffect, useState } from 'react';
import { listCategories, createCategory, updateCategory, deleteCategory } from '@/actions/categories';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import type { Category } from '@/types';
import { Plus, Pencil, Trash2, Check, X } from 'lucide-react';
import { toast } from 'sonner';

export default function CategoriasPage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [newName, setNewName] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');

  const load = async () => {
    setLoading(true);
    const data = await listCategories();
    setCategories(data);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const handleCreate = async () => {
    if (!newName.trim()) return;
    const result = await createCategory({ name: newName.trim() });
    if (result.success) {
      toast.success('Categoría creada');
      setNewName('');
      load();
    } else {
      toast.error(result.error || 'Error');
    }
  };

  const handleUpdate = async (id: string) => {
    if (!editingName.trim()) return;
    const result = await updateCategory(id, { name: editingName.trim() });
    if (result.success) {
      toast.success('Categoría actualizada');
      setEditingId(null);
      load();
    } else {
      toast.error(result.error || 'Error');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('¿Eliminar esta categoría?')) return;
    const result = await deleteCategory(id);
    if (result.success) {
      toast.success('Categoría eliminada');
      load();
    } else {
      toast.error(result.error || 'Error');
    }
  };

  const handleToggle = async (id: string, isActive: boolean) => {
    const result = await updateCategory(id, { is_active: !isActive });
    if (result.success) {
      toast.success('Estado actualizado');
      load();
    }
  };

  return (
    <div className="space-y-6 max-w-2xl">
      <h1 className="text-2xl font-bold text-stone-900">Categorías</h1>

      {/* Create */}
      <div className="flex gap-2">
        <Input
          placeholder="Nueva categoría..."
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
        />
        <Button onClick={handleCreate} disabled={!newName.trim()}>
          <Plus className="mr-1 h-4 w-4" /> Agregar
        </Button>
      </div>

      {/* List */}
      <div className="rounded-lg border border-stone-200 bg-white divide-y divide-stone-200">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-stone-200 border-t-stone-900" />
          </div>
        ) : categories.length === 0 ? (
          <p className="px-4 py-8 text-center text-stone-500">No hay categorías.</p>
        ) : (
          categories.map((cat) => (
            <div key={cat.id} className="flex items-center justify-between px-4 py-3">
              {editingId === cat.id ? (
                <div className="flex items-center gap-2 flex-1">
                  <Input
                    value={editingName}
                    onChange={(e) => setEditingName(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleUpdate(cat.id)}
                    className="h-8"
                  />
                  <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => handleUpdate(cat.id)}>
                    <Check className="h-4 w-4 text-green-600" />
                  </Button>
                  <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => setEditingId(null)}>
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ) : (
                <>
                  <div className="flex items-center gap-3">
                    <span className="font-medium text-stone-900">{cat.name}</span>
                    <button onClick={() => handleToggle(cat.id, cat.is_active)}>
                      <Badge variant={cat.is_active ? 'default' : 'secondary'}>
                        {cat.is_active ? 'Activa' : 'Inactiva'}
                      </Badge>
                    </button>
                  </div>
                  <div className="flex gap-1">
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8"
                      onClick={() => { setEditingId(cat.id); setEditingName(cat.name); }}
                    >
                      <Pencil className="h-3 w-3" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8 text-red-500 hover:text-red-700"
                      onClick={() => handleDelete(cat.id)}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
