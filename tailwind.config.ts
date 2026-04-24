import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: 'class',
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "var(--background)",
        foreground: "var(--foreground)",
        // Luxury brand palette — used on /tienda customer surfaces.
        // Kept opt-in so the dashboard's existing slate/teal usage is untouched.
        brand: {
          teal:     '#0D9488',
          tealDark: '#0F766E',
          navy:     '#0F172A',
          cream:    '#FDFBF7',
          gold:     '#C9A961',
          mint:     '#ECFDF5',
          charcoal: '#334155',
          stone:    '#F5F2ED',
        },
      },
      fontFamily: {
        serif: ['var(--font-serif)', 'ui-serif', 'Georgia', 'serif'],
        sans:  ['var(--font-sans)', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
      letterSpacing: {
        luxe: '0.18em',
      },
      animation: {
        'skeleton': 'skeleton 1.5s ease-in-out infinite',
        'shimmer':  'shimmer 2.4s ease-in-out infinite',
        'fade-up':  'fadeUp 0.7s ease-out both',
      },
      keyframes: {
        skeleton: {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.4' },
        },
        shimmer: {
          '0%': { backgroundPosition: '-120% 0' },
          '100%': { backgroundPosition: '220% 0' },
        },
        fadeUp: {
          '0%': { opacity: '0', transform: 'translateY(12px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
      },
    },
  },
  plugins: [],
};
export default config;
