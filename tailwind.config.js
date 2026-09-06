/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['"Plus Jakarta Sans"', 'system-ui', '-apple-system', 'sans-serif'],
        display: ['Outfit', '"Plus Jakarta Sans"', 'sans-serif'],
      },
      colors: {
        brand: {
          50: '#f8fafc',
          100: '#f1f5f9',
          500: '#0f172a',
          600: '#020617',
          gold: '#d97706',
          amber: '#f59e0b'
        }
      }
    },
  },
  plugins: [],
}
