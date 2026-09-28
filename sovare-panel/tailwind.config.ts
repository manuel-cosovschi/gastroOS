import type { Config } from 'tailwindcss';

/**
 * El panel de SOVARE usa la identidad de SOVARE, no la de GastroOS: grafito y
 * un acento cálido. Es una herramienta interna y tiene que distinguirse de un
 * vistazo del producto que vende.
 */
const config: Config = {
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['var(--font-inter)', 'system-ui', 'sans-serif'],
      },
      colors: {
        brand: {
          50: '#F5F6F7',
          100: '#E8EAEC',
          200: '#D1D5D9',
          300: '#AAB1B8',
          400: '#7C858E',
          500: '#5A636C',
          600: '#434B53',
          700: '#333A40',
          800: '#26292D',
          900: '#1C1E21',
          950: '#131517',
        },
        accent: {
          50: '#FFF7ED',
          100: '#FFEDD5',
          200: '#FED7AA',
          400: '#FB923C',
          500: '#EB6834',
          600: '#D4531F',
          700: '#B0411A',
        },
      },
      boxShadow: {
        card: '0 1px 2px 0 rgb(28 25 23 / 0.04), 0 1px 3px 0 rgb(28 25 23 / 0.06)',
        lift: '0 4px 12px -2px rgb(28 25 23 / 0.08), 0 2px 6px -2px rgb(28 25 23 / 0.06)',
      },
    },
  },
  plugins: [],
};

export default config;
