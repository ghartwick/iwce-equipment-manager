/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        yellow: {
          50:  'rgb(var(--yellow-50) / <alpha-value>)',
          100: 'rgb(var(--yellow-100) / <alpha-value>)',
          200: 'rgb(var(--yellow-200) / <alpha-value>)',
          300: 'rgb(var(--yellow-300) / <alpha-value>)',
          400: 'rgb(var(--yellow-400) / <alpha-value>)',
          500: 'rgb(var(--yellow-500) / <alpha-value>)',
          600: 'rgb(var(--yellow-600) / <alpha-value>)',
          700: 'rgb(var(--yellow-700) / <alpha-value>)',
          800: 'rgb(var(--yellow-800) / <alpha-value>)',
          900: 'rgb(var(--yellow-900) / <alpha-value>)',
          950: 'rgb(var(--yellow-950) / <alpha-value>)',
        },
      },
    },
  },
  plugins: [],
}
