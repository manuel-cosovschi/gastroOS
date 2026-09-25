'use client';

import { useState, useRef } from 'react';
import Image from 'next/image';
import { RefreshCw, Trash2, Loader2, ImageIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { uploadImage, deleteImage } from '@/actions/storage';
import { toast } from 'sonner';

interface ImageUploadProps {
  value: string | null;
  onChange: (url: string | null) => void;
}

export function ImageUpload({ value, onChange }: ImageUploadProps) {
  const [uploading, setUploading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);

      const result = await uploadImage(formData);

      if (!result.success) {
        toast.error(result.error || 'Error al subir la imagen');
        return;
      }

      // Si había imagen anterior, borrarla del storage
      if (value) {
        await deleteImage(value).catch(() => {});
      }

      onChange(result.url!);
      toast.success('Imagen subida');
    } catch {
      toast.error('Error al subir la imagen');
    } finally {
      setUploading(false);
      // Reset input para permitir subir el mismo archivo
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  const handleRemove = async () => {
    if (value) {
      await deleteImage(value).catch(() => {});
    }
    onChange(null);
    toast.success('Imagen eliminada');
  };

  const triggerFileSelect = () => {
    inputRef.current?.click();
  };

  return (
    <div className="space-y-3">
      <input
        ref={inputRef}
        type="file"
        className="hidden"
        accept="image/jpeg,image/png,image/webp"
        onChange={handleFileSelect}
        disabled={uploading}
      />

      {value ? (
        <div className="space-y-3">
          {/* Preview */}
          <div className="relative inline-block rounded-lg overflow-hidden border border-stone-200 bg-stone-50">
            <Image
              src={value}
              alt="Imagen del producto"
              width={280}
              height={280}
              className="object-cover"
              style={{ maxHeight: '280px' }}
            />
            {uploading && (
              <div className="absolute inset-0 flex items-center justify-center bg-white/70">
                <Loader2 className="h-8 w-8 animate-spin text-stone-600" />
              </div>
            )}
          </div>

          {/* Acciones explícitas: subir y quitar, sin menús escondidos */}
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={triggerFileSelect}
              disabled={uploading}
            >
              <RefreshCw className="mr-2 h-3.5 w-3.5" />
              Cambiar imagen
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleRemove}
              disabled={uploading}
              className="text-red-600 hover:text-red-700 hover:bg-red-50"
            >
              <Trash2 className="mr-2 h-3.5 w-3.5" />
              Quitar
            </Button>
          </div>
        </div>
      ) : (
        /* Zona de subida */
        <button
          type="button"
          onClick={triggerFileSelect}
          disabled={uploading}
          className="flex w-full cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-stone-300 bg-stone-50 p-10 transition-colors hover:bg-stone-100 hover:border-stone-400 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {uploading ? (
            <>
              <Loader2 className="h-10 w-10 animate-spin text-stone-400" />
              <p className="mt-3 text-sm font-medium text-stone-500">Subiendo imagen...</p>
            </>
          ) : (
            <>
              <div className="rounded-full bg-stone-200 p-3">
                <ImageIcon className="h-6 w-6 text-stone-500" />
              </div>
              <p className="mt-3 text-sm font-medium text-stone-700">
                Hacé click para subir una imagen
              </p>
              <p className="mt-1 text-xs text-stone-400">
                JPG, PNG o WebP — Máximo 5MB
              </p>
            </>
          )}
        </button>
      )}
    </div>
  );
}
