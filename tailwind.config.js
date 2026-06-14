/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: [
          '-apple-system',
          'BlinkMacSystemFont',
          '"SF Pro Display"',
          '"SF Pro Text"',
          '"Helvetica Neue"',
          'sans-serif',
        ],
      },
      colors: {
        chalk: '#f5f0e8',
        surface: '#1c1c1e',
        surface2: '#2c2c2e',
        separator: 'rgba(255,255,255,0.12)',
        'pr-red': '#c0392b',
      },
    },
  },
  plugins: [],
}
