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
        'dark-bg':   '#000d21',
        'dark-card': '#000d21',
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