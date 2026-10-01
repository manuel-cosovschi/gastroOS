import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

/**
 * La acción principal va en terracota, no en oliva.
 *
 * La terracota es el único acento de la marca: es lo que tiene que atraer el
 * ojo, y un botón oliva es sólo un botón oscuro — el aspecto genérico que la
 * dirección nueva vino a sacar. Además alinea el panel con la landing, donde
 * el llamado principal ya era terracota.
 *
 * El `outline` usa el blanco tibio de las tarjetas por el mismo motivo que
 * `.surface`: el blanco puro sobre crema se ve azulado.
 */
const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50',
  {
    variants: {
      variant: {
        default: 'bg-brand-600 text-white hover:bg-brand-700',
        destructive: 'bg-red-600 text-white hover:bg-red-700',
        outline: 'border border-stone-300 bg-white hover:bg-stone-100 text-stone-900',
        secondary: 'bg-stone-100 text-stone-900 hover:bg-stone-200',
        ghost: 'hover:bg-stone-100 text-stone-900',
        link: 'text-stone-900 underline-offset-4 hover:underline',
      },
      size: {
        default: 'h-10 px-4 py-2',
        sm: 'h-9 rounded-md px-3',
        lg: 'h-11 rounded-md px-8 text-base',
        icon: 'h-10 w-10',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : 'button';
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    );
  }
);
Button.displayName = 'Button';

export { Button, buttonVariants };
