/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/renderer/**/*.{ts,tsx,html}'],
  theme: {
    extend: {
      colors: {
        ink: '#0b0f17',
        panel: '#111827',
        line: '#243041',
        brand: '#41e6c3',
      },
      boxShadow: {
        glow: '0 0 40px rgba(65, 230, 195, 0.16)',
      },
    },
  },
  plugins: [],
};
