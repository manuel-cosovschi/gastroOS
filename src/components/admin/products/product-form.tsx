'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ImageUpload } from './image-upload';
import { productSchema, type ProductFormValues } from '@/lib/validations/product';
import { createProduct, updateProduct } from '@/actions/products';
import type { Product, Category } from '@/types';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';

interface ProductFormProps {
  product?: Product;
  categories: Category[];
}

export function ProductForm({ product, categories }: ProductFormProps) {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const isEditing = !!product;

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<ProductFormValues>({
    resolver: zodResolver(productSchema),
    defaultValues: product
      ? {
          name: product.name,
          category_id: product.category_id,
          short_description: product.short_description || '',
          long_description: product.long_description || '',
          ingredients: product.ingredients || '',
          price: product.price,
          cost_override: product.cost_override,
          image_url: product.image_url,
          sale_unit: product.sale_unit,
          min_quantity: product.min_quantity,
          min_advance_hours: product.min_advance_hours,
          batch_size: product.batch_size,
          is_active: product.is_active,
        }
      : {
          sale_unit: 'unidad',
          min_quantity: 1,
          batch_size: 1,
          is_active: true,
        },
  });

  const imageUrl = watch('image_url');

  const onSubmit = async (data: ProductFormValues) => {
    setIsSubmitting(true);
    try {
      const cleanData = { ...data, category_id: data.category_id ?? undefined, image_url: data.image_url ?? undefined };
      const result = isEditing
        ? await updateProduct(product.id, cleanData)
        : await createProduct(cleanData);

      if (result.success) {
        toast.success(isEditing ? 'Producto actualizado' : 'Producto creado');
        router.push('/admin/productos');
        router.refresh();
      } else {
        toast.error(result.error || 'Error al guardar');
      }
    } catch {
      toast.error('Error al guardar el producto');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="surface max-w-2xl space-y-6 p-5">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="name">Nombre *</Label>
          <Input id="name" {...register('name')} />
          {errors.name && <p className="text-sm text-rose-600">{errors.name.message}</p>}
        </div>

        <div className="space-y-2">
          <Label>Categoría</Label>
          <Select
            defaultValue={product?.category_id || undefined}
            onValueChange={(v) => setValue('category_id', v)}
          >
            <SelectTrigger>
              <SelectValue placeholder="Sin categoría" />
            </SelectTrigger>
            <SelectContent>
              {categories.map((cat) => (
                <SelectItem key={cat.id} value={cat.id}>
                  {cat.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="price">Precio de venta *</Label>
          <Input
            id="price"
            type="number"
            step="0.01"
            {...register('price', { valueAsNumber: true })}
          />
          {errors.price && <p className="text-sm text-rose-600">{errors.price.message}</p>}
        </div>

        <div className="space-y-2">
          <Label htmlFor="cost_override">Costo unitario</Label>
          <Input
            id="cost_override"
            type="number"
            step="0.01"
            placeholder="Ej: 800"
            {...register('cost_override', { valueAsNumber: true })}
          />
          <p className="text-xs text-stone-500">
            Cuánto te cuesta producir una unidad. Si lo dejás vacío, se calcula desde
            la receta.
          </p>
          {errors.cost_override && (
            <p className="text-sm text-rose-600">{errors.cost_override.message}</p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="sale_unit">Unidad de venta</Label>
          <Input id="sale_unit" {...register('sale_unit')} placeholder="unidad, docena, kg..." />
        </div>

        <div className="space-y-2">
          <Label htmlFor="min_quantity">Cantidad mínima</Label>
          <Input
            id="min_quantity"
            type="number"
            {...register('min_quantity', { valueAsNumber: true })}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="batch_size">Unidades por lote</Label>
          <Input
            id="batch_size"
            type="number"
            min={1}
            {...register('batch_size', { valueAsNumber: true })}
          />
          <p className="text-xs text-stone-500">
            Cuántas unidades salen de una tanda de producción. Define el costo unitario
            cuando el producto tiene receta cargada.
          </p>
        </div>

        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="short_description">Descripción corta</Label>
          <Input id="short_description" {...register('short_description')} />
        </div>

        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="long_description">Descripción larga</Label>
          <Textarea id="long_description" {...register('long_description')} />
        </div>

        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="ingredients">Ingredientes</Label>
          <Textarea
            id="ingredients"
            {...register('ingredients')}
            placeholder="Harina, manteca, azúcar..."
          />
        </div>

        <div className="space-y-2 sm:col-span-2">
          <Label>Foto principal</Label>
          <ImageUpload
            value={imageUrl || null}
            onChange={(url) => setValue('image_url', url)}
          />
        </div>

        <div className="flex items-center gap-2 sm:col-span-2">
          <input
            type="checkbox"
            id="is_active"
            className="h-4 w-4 rounded border-stone-300"
            {...register('is_active')}
          />
          <Label htmlFor="is_active" className="font-normal">
            Producto activo (visible en el catálogo)
          </Label>
        </div>
      </div>

      <div className="flex gap-3">
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {isEditing ? 'Guardar cambios' : 'Crear producto'}
        </Button>
        <Button type="button" variant="outline" onClick={() => router.back()}>
          Cancelar
        </Button>
      </div>
    </form>
  );
}
