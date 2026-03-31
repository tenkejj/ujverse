/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        'uj-blue':   '#003399',
        'uj-navy':   '#002D62',
        'uj-gold':   '#C49A6C',
        'uj-orange': '#FF9900',
        'app-bg':    '#000000',
        'card-bg':   '#01020a',
        'border-main': '#1c2b4e',
        'accent-gold': '#ffa000',
      },
      borderRadius: {
        'uj-xl':   '1rem',
        'uj-full': '9999px',
      },
      boxShadow: {
        'uj-soft': '0 4px 20px -2px rgba(0, 0, 0, 0.05)',
      },
    },
  },
  plugins: [],
}