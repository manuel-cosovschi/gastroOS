import type { Config } from 'tailwindcss';

/**
 * Paleta de GastroOS.
 *
 * Neutro cálido (`stone`) + un verde profundo como acento. El verde no compite
 * con los colores de estado de los pedidos (ámbar, celeste, violeta, esmeralda)
 * y sirve para cualquier rubro: no es "de pastelería" ni "de panadería".
 */
const config: Config = {
  // Todo `src`, no sólo app/ y components/: los colores de estado de los
  // pedidos viven en src/types y los tokens de los gráficos en src/lib.
  // Si esos archivos quedan fuera, las clases no se generan y los badges
  // salen sin color.
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['var(--font-inter)', 'system-ui', 'sans-serif'],
      },
      colors: {
        brand: {
          50: '#ECFDF5',
          100: '#D1FAE5',
          200: '#A7F3D0',
          300: '#6EE7B7',
          400: '#34D399',
          500: '#10B981',
          600: '#059669',
          700: '#047857',
          800: '#065F46',
          900: '#064E3B',
          950: '#022C22',
        },
      },
      boxShadow: {
        card: '0 1px 2px 0 rgb(28 25 23 / 0.04), 0 1px 3px 0 rgb(28 25 23 / 0.06)',
        lift: '0 4px 12px -2px rgb(28 25 23 / 0.08), 0 2px 6px -2px rgb(28 25 23 / 0.06)',
      },
      keyframes: {
        'fade-in': {
          from: { opacity: '0', transform: 'translateY(4px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
      },
      animation: {
        'fade-in': 'fade-in 0.25s ease-out',
      },
    },
  },
  plugins: [],
};

export default config;
