/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        admin: [ '"Plus Jakarta Sans"', 'ui-sans-serif', 'system-ui', 'sans-serif' ],
        display: [ 'Sora', '"Plus Jakarta Sans"', 'ui-sans-serif', 'system-ui', 'sans-serif' ],
      },
    },
  },
  plugins: [],
}

