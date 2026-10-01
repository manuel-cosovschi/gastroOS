import type { Config } from 'tailwindcss';

/**
 * Paleta de GastroOS — dirección "Gastronómico cálido".
 *
 * Dos escalas y nada más: un neutro cálido que va de la crema al oliva, y la
 * terracota como único acento.
 *
 * Las dos se definen pisando los nombres de Tailwind (`stone` y `brand`) en
 * vez de inventar nombres nuevos. El motivo es práctico: hay más de mil usos
 * de `stone-*` repartidos en ochenta y ocho archivos, y redefinir la escala
 * los repinta todos de una, de forma coherente, sin una tanda de reemplazos a
 * mano que se olvida de la mitad. El precio es que `stone` ya no es el `stone`
 * de Tailwind, y por eso está escrito acá.
 *
 * Lo que sí sigue siendo de Tailwind son los colores de estado de los pedidos
 * (ámbar, celeste, violeta, esmeralda, pizarra). Esos no son marca: son
 * información, y conviene que se distingan entre sí más de lo que combinan.
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
        // Karla para la interfaz: una grotesca de formas abiertas que aguanta
        // bien los cuerpos chicos de una tabla de pedidos.
        sans: ['var(--font-karla)', 'system-ui', 'sans-serif'],
        // Fraunces para el logotipo y los títulos. Tiene el contraste y la
        // calidez que la interfaz no necesita y la marca sí.
        display: ['var(--font-fraunces)', 'Georgia', 'serif'],
      },
      colors: {
        /**
         * Blanco tibio.
         *
         * Sobre la crema de la página, el blanco puro se ve azulado y rompe la
         * temperatura de toda la paleta. Se pisa el nombre `white` —y no se
         * cambian sesenta y ocho `bg-white` a mano— porque en este sistema no
         * hay nada que necesite el blanco de verdad: las tarjetas quieren este
         * tono, y el texto sobre terracota u oliva se lee mejor en crema que en
         * blanco, que es además lo que hace el manual.
         */
        white: '#FFFDF9',

        /**
         * Neutro cálido: de la crema al oliva.
         *
         * Los dos extremos y el 100 son los de la marca —crema #FBF5EA,
         * superficie #F3EADA, oliva #26302A—; el resto es la rampa que los une
         * manteniendo las relaciones de claridad que la interfaz ya daba por
         * sentadas (el 200 separa, el 400 es para íconos, el 500 y el 600 son
         * texto secundario, el 900 es el texto principal).
         */
        stone: {
          50: '#FBF5EA',
          100: '#F3EADA',
          200: '#E5DAC6',
          300: '#CFC3AC',
          400: '#9A9080',
          500: '#6B6454',
          600: '#565042',
          700: '#45443A',
          800: '#333A31',
          900: '#26302A',
          950: '#18201A',
        },
        /**
         * Terracota.
         *
         * El 600 es el color de marca (#C0553A) y el 400 es el que la propia
         * dirección pide sobre oliva profundo (#E08A6B): ahí el 600 se apaga y
         * hay que subir de escalón.
         */
        brand: {
          50: '#FDF3EF',
          100: '#FAE3DA',
          200: '#F4C7B6',
          300: '#EBA48B',
          400: '#E08A6B',
          500: '#D06A4B',
          600: '#C0553A',
          700: '#A04630',
          800: '#813928',
          900: '#682F22',
          950: '#3A1811',
        },
      },
      boxShadow: {
        // Sombras teñidas de oliva en vez de negro: sobre un fondo crema, una
        // sombra gris se ve sucia.
        card: '0 1px 2px 0 rgb(38 48 42 / 0.05), 0 1px 3px 0 rgb(38 48 42 / 0.07)',
        lift: '0 4px 12px -2px rgb(38 48 42 / 0.10), 0 2px 6px -2px rgb(38 48 42 / 0.07)',
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
