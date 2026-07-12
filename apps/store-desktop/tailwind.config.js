/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/renderer/**/*.{ts,tsx,html}'],
  darkMode: 'media',
  theme: {
    extend: {
      colors: {
        // Semantic tokens driven by CSS variables (light/dark defined in main.css)
        bg: 'rgb(var(--c-bg) / <alpha-value>)',
        surface: 'rgb(var(--c-surface) / <alpha-value>)',
        raised: 'rgb(var(--c-raised) / <alpha-value>)',
        stroke: 'rgb(var(--c-stroke) / <alpha-value>)',
        ink: 'rgb(var(--c-ink) / <alpha-value>)',
        ink2: 'rgb(var(--c-ink2) / <alpha-value>)',
        ink3: 'rgb(var(--c-ink3) / <alpha-value>)',
        accent: 'rgb(var(--c-accent) / <alpha-value>)',
        'accent-ink': 'rgb(var(--c-accent-ink) / <alpha-value>)',
        brand: '#30d5b2',
      },
      borderRadius: {
        mac: '10px',
      },
      boxShadow: {
        card: '0 1px 2px rgb(0 0 0 / 0.08), 0 0 0 0.5px rgb(var(--c-stroke) / 0.9)',
        'card-hover': '0 12px 32px rgb(0 0 0 / 0.18), 0 2px 8px rgb(0 0 0 / 0.10), 0 0 0 0.5px rgb(var(--c-stroke))',
        sheet: '0 24px 80px rgb(0 0 0 / 0.45), 0 0 0 0.5px rgb(var(--c-stroke))',
      },
      fontFamily: {
        sans: [
          '-apple-system',
          'BlinkMacSystemFont',
          'SF Pro Text',
          'SF Pro Display',
          'Segoe UI Variable',
          'Segoe UI',
          'system-ui',
          'sans-serif',
        ],
      },
    },
  },
  plugins: [],
};
