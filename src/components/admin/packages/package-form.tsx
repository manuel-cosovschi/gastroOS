'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { ImageUpload } from '@/components/admin/products/image-upload';
import { createPackage, updatePackage } from '@/actions/packages';
import type { Product, PackageDetail } from '@/types';
import { toast } from 'sonner';
import { Loader2, Plus, Trash2 } from 'lucide-react';

interface PackageFormProps {
  pkg?: PackageDetail;
  products: Product[];
}

interface PackageItemDraft {
  product_id: string;
  quantity: number;
}

export function PackageForm({ pkg, products }: PackageFormProps) {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const isEditing = !!pkg;

  const [name, setName] = useState(pkg?.name || '');
  const [description, setDescription] = useState(pkg?.description || '');
  const [price, setPrice] = useState(pkg?.price || 0);
  const [imageUrl, setImageUrl] = useState<string | null>(pkg?.image_url || null);
  const [isEditable, setIsEditable] = useState(pkg?.is_editable || false);
  const [isActive, setIsActive] = useState(pkg?.is_active ?? true);
  const [items, setItems] = useState<PackageItemDraft[]>(
    pkg?.items.map((i) => ({ product_id: i.product_id, quantity: i.quantity })) || []
  );

  const addItem = () => {
    if (products.length === 0) return;
    setItems([...items, { product_id: products[0].id, quantity: 1 }]);
  };

  const removeItem = (index: number) => {
    setItems(items.filter((_, i) => i !== index));
  };

  const updateItem = (index: number, field: keyof PackageItemDraft, value: string | number) => {
    setItems(items.map((item, i) => (i === index ? { ...item, [field]: value } : item)));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!name.trim()) {
      toast.error('El nombre es obligatorio');
      return;
    }
    if (price <= 0) {
      toast.error('El precio debe ser mayor a 0');
      return;
    }
    if (items.length === 0) {
      toast.error('Agregá al menos un producto al paquete');
      return;
    }

    setIsSubmitting(true);
    try {
      const data = {
        name,
        description: description || undefined,
        image_url: imageUrl || undefined,
        price,
        is_editable: isEditable,
        is_active: isActive,
        items,
      };

      const result = isEditing
        ? await updatePackage(pkg.id, data)
        : await createPackage(data);

      if (result.success) {
        toast.success(isEditing ? 'Paquete actualizado' : 'Paquete creado');
        router.push('/admin/combos');
        router.refresh();
      } else {
        toast.error(result.error || 'Error al guardar');
      }
    } catch {
      toast.error('Error al guardar el paquete');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6 max-w-2xl">
      <div className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="name">Nombre *</Label>
          <Input id="name" value={name} onChange={(e) => setName(e.target.value)} />
        </div>

        <div className="space-y-2">
          <Label htmlFor="description">Descripción</Label>
          <Textarea
            id="description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="price">Precio *</Label>
          <Input
            id="price"
            type="number"
            step="0.01"
            value={price}
            onChange={(e) => setPrice(Number(e.target.value))}
          />
        </div>

        <div className="space-y-2">
          <Label>Foto</Label>
          <ImageUpload value={imageUrl} onChange={setImageUrl} />
        </div>

        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="is_editable"
              className="h-4 w-4 rounded border-stone-300"
              checked={isEditable}
              onChange={(e) => setIsEditable(e.target.checked)}
            />
            <Label htmlFor="is_editable" className="font-normal">
              Editable por el cliente
            </Label>
          </div>

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="is_active"
              className="h-4 w-4 rounded border-stone-300"
              checked={isActive}
              onChange={(e) => setIsActive(e.target.checked)}
            />
            <Label htmlFor="is_active" className="font-normal">
              Activo
            </Label>
          </div>
        </div>
      </div>

      {/* Items */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <Label>Productos incluidos *</Label>
          <Button type="button" variant="outline" size="sm" onClick={addItem}>
            <Plus className="mr-1 h-3 w-3" /> Agregar producto
          </Button>
        </div>

        {items.length === 0 && (
          <p className="text-sm text-stone-400">No hay productos en este paquete.</p>
        )}

        {items.map((item, index) => (
          <div key={index} className="flex items-center gap-3">
            <select
              className="flex-1 rounded-md border border-stone-300 px-3 py-2 text-sm"
              value={item.product_id}
              onChange={(e) => updateItem(index, 'product_id', e.target.value)}
            >
              {products.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
            <Input
              type="number"
              className="w-20"
              min={1}
              value={item.quantity}
              onChange={(e) => updateItem(index, 'quantity', Number(e.target.value))}
            />
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="text-stone-400 hover:text-red-600"
              onClick={() => removeItem(index)}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        ))}
      </div>

      <div className="flex gap-3">
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {isEditing ? 'Guardar cambios' : 'Crear paquete'}
        </Button>
        <Button type="button" variant="outline" onClick={() => router.back()}>
          Cancelar
        </Button>
      </div>
    </form>
  );
}
